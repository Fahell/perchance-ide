/**
 * BrowserPod Manager — Singleton interface for Node.js runtime in browser.
 *
 * Wraps @leaningtech/browserpod API with lifecycle management,
 * VFS synchronization, error recovery, and automatic WebSocket reconnection.
 *
 * Architecture: Main-thread boot (required by BrowserPod API),
 * async communication pattern similar to pyodide-manager.
 * Uses createCustomTerminal with onOutput callback for headless execution.
 */

// ─── ANSI Strip & Error Detection ──────────────────────────
// Same regex used by strip-ansi / ansi-regex (industry standard).
// Implemented inline to avoid ESM/CJS bundling issues with esbuild single-file output.
const ANSI_REGEX = /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g;

function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, "");
}

/** Known Node.js fatal error patterns that indicate real failure despite exitCode 0 */
const NODE_FATAL_PATTERNS = [
  "ERR_INVALID_PACKAGE_CONFIG",
  "EJSONPARSE",
  "MODULE_NOT_FOUND",
  "ERR_MODULE_NOT_FOUND",
  "SyntaxError",
  "Cannot find module",
  "Invalid package config",
  "Failed to parse root package.json",
];

function containsFatalError(output: string): boolean {
  return NODE_FATAL_PATTERNS.some((pattern) => output.includes(pattern));
}

// ─── Types ──────────────────────────────────────────────────
export type BrowserPodStatus = "idle" | "loading" | "ready" | "error";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface BrowserPodConfig {
  apiKey: string;
  storageKey?: string;
}

// ─── Dynamic import types ───────────────────────────────────
interface BrowserPodFile {
  write(content: string): Promise<void>;
  read(): Promise<string>;
  close(): Promise<void>;
}

interface BrowserPodTerminal {
  // Opaque terminal handle — created via createDefaultTerminal or createCustomTerminal
}

// Process is an opaque handle — pod.run() resolves when the process exits.
// There is no .wait() method; the Promise itself resolves at completion.

interface BrowserPodInstance {
  run(command: string, args?: string[], options?: Record<string, unknown>): Promise<unknown>;
  createFile(path: string, encoding?: "utf-8" | "binary"): Promise<BrowserPodFile>;
  openFile(path: string, encoding?: "utf-8" | "binary"): Promise<BrowserPodFile>;
  createDirectory(path: string): Promise<void>;
  createDefaultTerminal(element: HTMLElement): Promise<BrowserPodTerminal>;
  createCustomTerminal(config: { onOutput: (data: string | Uint8Array | number[]) => void }): Promise<BrowserPodTerminal>;
  dispose(): Promise<void>;
}

interface BrowserPodClass {
  boot(config: { apiKey: string; storageKey?: string }): Promise<BrowserPodInstance>;
}

// ─── Constants ──────────────────────────────────────────────
const MAX_RECONNECT_ATTEMPTS = 2;
const RECONNECT_DELAY_MS = 1000;

// ─── Manager ────────────────────────────────────────────────
class BrowserPodManager {
  private pod: BrowserPodInstance | null = null;
  private terminal: BrowserPodTerminal | null = null;
  private outputBuffer: string[] = [];
  private status: BrowserPodStatus = "idle";
  private error: string | null = null;
  private config: BrowserPodConfig | null = null;
  private statusListeners: Array<(status: BrowserPodStatus, error: string | null) => void> = [];

  /** Cache of last synced files for automatic re-sync after reconnection */
  private lastSyncedFiles: Array<{ path: string; content: string }> = [];

  getStatus(): BrowserPodStatus {
    return this.status;
  }

  getError(): string | null {
    return this.error;
  }

  isReady(): boolean {
    return this.status === "ready" && this.pod !== null;
  }

  onStatusChange(listener: (status: BrowserPodStatus, error: string | null) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(): void {
    for (const listener of this.statusListeners) {
      try {
        listener(this.status, this.error);
      } catch {
        // Listener error should not break manager
      }
    }
  }

  /**
   * Check if an error indicates a closed/closing WebSocket connection.
   */
  private isWebSocketError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return (
      message.includes("CLOSING") ||
      message.includes("CLOSED") ||
      message.includes("WebSocket") ||
      message.includes("connection") ||
      message.includes("disconnected")
    );
  }

  /**
   * Reconnect to BrowserPod: dispose current instance, re-boot, and re-sync cached files.
   * Returns true if reconnection succeeded.
   */
  private async reconnect(): Promise<boolean> {
    if (!this.config) {
      console.error("[BrowserPod] Cannot reconnect: no config stored");
      return false;
    }

    console.log("[BrowserPod] Reconnecting...");

    // Dispose current pod silently
    if (this.pod) {
      try {
        await this.pod.dispose();
      } catch {
        // Ignore dispose errors during reconnection
      }
      this.pod = null;
      this.terminal = null;
    }

    // Re-boot with same config
    const booted = await this.boot(this.config);
    if (!booted) {
      console.error("[BrowserPod] Reconnection failed: boot unsuccessful");
      return false;
    }

    // Re-sync cached files to the new pod instance
    if (this.lastSyncedFiles.length > 0) {
      console.log(`[BrowserPod] Re-syncing ${this.lastSyncedFiles.length} cached files after reconnection`);
      await this.syncFiles(this.lastSyncedFiles);
    }

    console.log("[BrowserPod] Reconnected successfully");
    return true;
  }

  /**
   * Boot the BrowserPod runtime. Must be called from main thread.
   * Requires valid API key from console.browserpod.io.
   * Creates a custom headless terminal with onOutput callback for capturing output.
   */
  async boot(config: BrowserPodConfig): Promise<boolean> {
    if (this.pod) {
      console.log("[BrowserPod] Already booted, skipping");
      return true;
    }

    this.config = config;
    this.setStatus("loading");
    console.log("[BrowserPod] Booting...");

    try {
      // Dynamic import — loaded from CDN at runtime
      const module = await import("https://cdn.jsdelivr.net/npm/@leaningtech/browserpod@latest/+esm") as { BrowserPod: BrowserPodClass };

      if (!module.BrowserPod || typeof module.BrowserPod.boot !== "function") {
        throw new Error("BrowserPod.boot not found in module");
      }

      this.pod = await module.BrowserPod.boot({
        apiKey: config.apiKey,
        storageKey: config.storageKey ?? "agent-perchance",
      });

      // Create custom headless terminal with onOutput callback
      // BrowserPod 2.0 delivers raw bytes (Uint8Array) — decode to UTF-8 string
      const decoder = new TextDecoder("utf-8");
      this.terminal = await this.pod.createCustomTerminal({
        onOutput: (data: string | Uint8Array | number[]) => {
          let text: string;
          if (typeof data === "string") {
            text = data;
          } else {
            // Copy to non-shared buffer — TextDecoder rejects SharedArrayBuffer views
            const bytes = new Uint8Array(data instanceof Uint8Array ? data.slice() : [...data]);
            text = decoder.decode(bytes);
          }
          this.outputBuffer.push(text);
        },
      });

      this.setStatus("ready");
      console.log("[BrowserPod] Ready");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[BrowserPod] Boot failed:", message);
      this.setStatus("error", message);
      this.pod = null;
      this.terminal = null;
      return false;
    }
  }

  /**
   * Execute a command inside the pod (e.g., "node", "npm").
   * Captures output via the custom terminal's onOutput callback.
   * Automatically reconnects and retries on WebSocket failure.
   *
   * API signature: pod.run(command, args[], { terminal })
   * Note: cwd is NOT supported natively by BrowserPod run().
   * Files must be written to the pod's FS at the expected paths before execution.
   */
  async run(command: string, args: string[] = []): Promise<RunResult> {
    if (!this.pod) {
      return { stdout: "", stderr: "BrowserPod not initialized", exitCode: 1 };
    }

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      try {
        // Clear output buffer before each execution
        this.outputBuffer = [];

        const options: Record<string, unknown> = {};
        if (this.terminal) options.terminal = this.terminal;

        // pod.run() resolves when the process exits — no .wait() needed.
        // Signature: pod.run(command, args[], { terminal })
        const result = await this.pod.run(command, args, options);

        // Collect all captured output from onOutput callback
        const rawStdout = this.outputBuffer.join("");

        // Strip ANSI escape codes and terminal artifacts (e.g., "null:0 null")
        const stdout = stripAnsi(rawStdout).replace(/^(?:null:\d+\s*null\s*)+/m, "").trimStart();

        // Safely extract exitCode if available (duck-typing)
        let exitCode = (result != null && typeof result === "object" && "exitCode" in result)
          ? (result as { exitCode: number }).exitCode
          : 0;

        // BrowserPod may return exitCode 0 even when Node.js fails fatally.
        // Detect known fatal error patterns and correct the exit code.
        if (exitCode === 0 && containsFatalError(stdout)) {
          console.warn("[BrowserPod] Detected fatal error in output despite exitCode 0, correcting to 1");
          exitCode = 1;
        }

        return { stdout, stderr: "", exitCode };
      } catch (err) {
        if (attempt < MAX_RECONNECT_ATTEMPTS && this.isWebSocketError(err)) {
          console.warn(`[BrowserPod] run(${command}) WebSocket error (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS + 1}), reconnecting...`);
          const reconnected = await this.reconnect();
          if (!reconnected) {
            const message = err instanceof Error ? err.message : String(err);
            return { stdout: "", stderr: `Reconnection failed: ${message}`, exitCode: 1 };
          }
          // Wait briefly before retry
          await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
          continue;
        }

        const message = err instanceof Error ? err.message : String(err);
        console.error(`[BrowserPod] run(${command}) failed:`, message);
        return { stdout: "", stderr: message, exitCode: 1 };
      }
    }

    return { stdout: "", stderr: "Max reconnection attempts exceeded", exitCode: 1 };
  }

  /**
   * Ensure all parent directories exist in the pod's FS before creating a file.
   * BrowserPod does not create intermediate directories automatically.
   */
  private async ensureDirectory(filePath: string): Promise<void> {
    if (!this.pod) return;

    const parts = filePath.split("/").filter(Boolean);
    // Remove the filename (last segment) — only create directories
    parts.pop();

    let currentPath = "";
    for (const part of parts) {
      currentPath += "/" + part;
      try {
        await this.pod.createDirectory(currentPath);
      } catch {
        // Directory may already exist — ignore errors
      }
    }
  }

  /**
   * Write a file into the pod's virtual filesystem.
   * Creates parent directories recursively before writing.
   * Automatically reconnects and retries on WebSocket failure.
   */
  async writeFile(path: string, content: string): Promise<boolean> {
    if (!this.pod) return false;

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      try {
        // Ensure parent directories exist first
        await this.ensureDirectory(path);

        // createFile(path, "utf-8") per BrowserPod 2.0 debugging docs.
        const file = await this.pod.createFile(path, "utf-8");
        await file.write(content);
        await file.close();
        return true;
      } catch (err) {
        if (attempt < MAX_RECONNECT_ATTEMPTS && this.isWebSocketError(err)) {
          console.warn(`[BrowserPod] writeFile(${path}) WebSocket error (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS + 1}), reconnecting...`);
          const reconnected = await this.reconnect();
          if (!reconnected) return false;
          await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
          continue;
        }

        console.error(`[BrowserPod] writeFile(${path}) failed:`, err);
        return false;
      }
    }

    return false;
  }

  /**
   * Read a file from the pod's virtual filesystem.
   * Automatically reconnects and retries on WebSocket failure.
   */
  async readFile(path: string): Promise<string | null> {
    if (!this.pod) return null;

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      try {
        const file = await this.pod.openFile(path, "utf-8");
        const content = await file.read();
        await file.close();
        return content;
      } catch (err) {
        if (attempt < MAX_RECONNECT_ATTEMPTS && this.isWebSocketError(err)) {
          console.warn(`[BrowserPod] readFile(${path}) WebSocket error (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS + 1}), reconnecting...`);
          const reconnected = await this.reconnect();
          if (!reconnected) return null;
          await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
          continue;
        }

        console.error(`[BrowserPod] readFile(${path}) failed:`, err);
        return null;
      }
    }

    return null;
  }

  /**
   * Sync multiple files from VFS to the pod.
   * Caches files for automatic re-sync after WebSocket reconnection.
   */
  async syncFiles(files: Array<{ path: string; content: string }>): Promise<number> {
    // Update cache for reconnection recovery
    this.lastSyncedFiles = [...files];

    let synced = 0;
    for (const file of files) {
      // Validate package.json before syncing to prevent corrupting the Pod environment
      if (file.path.endsWith("package.json")) {
        try {
          JSON.parse(file.content);
        } catch {
          console.warn(`[BrowserPod] Skipping invalid package.json at ${file.path} — content is not valid JSON`);
          continue;
        }
      }

      const ok = await this.writeFile(file.path, file.content);
      if (ok) synced++;
    }
    console.log(`[BrowserPod] Synced ${synced}/${files.length} files`);
    return synced;
  }

  /**
   * Terminate the pod and release resources.
   */
  async dispose(): Promise<void> {
    if (this.pod) {
      try {
        await this.pod.dispose();
      } catch (err) {
        console.error("[BrowserPod] dispose failed:", err);
      }
      this.pod = null;
      this.terminal = null;
    }
    this.outputBuffer = [];
    this.lastSyncedFiles = [];
    this.setStatus("idle");
    this.config = null;
    console.log("[BrowserPod] Disposed");
  }

  private setStatus(status: BrowserPodStatus, error: string | null = null): void {
    this.status = status;
    this.error = error;
    this.notifyStatus();
  }
}

// ─── Singleton Export ───────────────────────────────────────
export const browserPodManager = new BrowserPodManager();

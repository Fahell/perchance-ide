/**
 * BrowserPod Manager — Singleton interface for Node.js runtime in browser.
 *
 * Wraps @leaningtech/browserpod API with lifecycle management,
 * VFS synchronization, and error recovery.
 *
 * Architecture: Main-thread boot (required by BrowserPod API),
 * async communication pattern similar to pyodide-manager.
 * Uses createCustomTerminal with onOutput callback for headless execution.
 */

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
  createFile(path: string, type?: "utf-8" | "binary"): Promise<BrowserPodFile>;
  openFile(path: string, type?: "utf-8" | "binary"): Promise<BrowserPodFile>;
  createDefaultTerminal(element: HTMLElement): Promise<BrowserPodTerminal>;
  createCustomTerminal(config: { onOutput: (data: string) => void }): Promise<BrowserPodTerminal>;
  dispose(): Promise<void>;
}

interface BrowserPodClass {
  boot(config: { apiKey: string; storageKey?: string }): Promise<BrowserPodInstance>;
}

// ─── Manager ────────────────────────────────────────────────
class BrowserPodManager {
  private pod: BrowserPodInstance | null = null;
  private terminal: BrowserPodTerminal | null = null;
  private outputBuffer: string[] = [];
  private status: BrowserPodStatus = "idle";
  private error: string | null = null;
  private config: BrowserPodConfig | null = null;
  private statusListeners: Array<(status: BrowserPodStatus, error: string | null) => void> = [];

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
      // This is the correct headless approach per BrowserPod docs
      this.terminal = await this.pod.createCustomTerminal({
        onOutput: (data: string) => {
          this.outputBuffer.push(data);
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
   */
  /**
   * Execute a command inside the pod (e.g., "node", "npm").
   * Captures output via the custom terminal's onOutput callback.
   *
   * API signature: pod.run(command, args[], { terminal })
   * Note: cwd is NOT supported natively by BrowserPod run().
   * Files must be written to the pod's FS at the expected paths before execution.
   */
  async run(command: string, args: string[] = []): Promise<RunResult> {
    if (!this.pod) {
      return { stdout: "", stderr: "BrowserPod not initialized", exitCode: 1 };
    }

    try {
      // Clear output buffer before each execution
      this.outputBuffer = [];

      const options: Record<string, unknown> = {};
      if (this.terminal) options.terminal = this.terminal;

      // pod.run() resolves when the process exits — no .wait() needed.
      // Signature: pod.run(command, args[], { terminal })
      const result = await this.pod.run(command, args, options);

      // Collect all captured output from onOutput callback
      const stdout = this.outputBuffer.join("");

      // Safely extract exitCode if available (duck-typing)
      const exitCode = (result != null && typeof result === "object" && "exitCode" in result)
        ? (result as { exitCode: number }).exitCode
        : 0;

      return { stdout, stderr: "", exitCode };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[BrowserPod] run(${command}) failed:`, message);
      return { stdout: "", stderr: message, exitCode: 1 };
    }
  }

  /**
   * Write a file into the pod's virtual filesystem.
   */
  async writeFile(path: string, content: string): Promise<boolean> {
    if (!this.pod) return false;

    try {
      // createFile(path, "utf-8") per official error debugging docs.
      // "text" causes "Unsupported mode argument"; "utf-8" is the correct value.
      const file = await this.pod.createFile(path, "utf-8");
      await file.write(content);
      await file.close();
      return true;
    } catch (err) {
      console.error(`[BrowserPod] writeFile(${path}) failed:`, err);
      return false;
    }
  }

  /**
   * Read a file from the pod's virtual filesystem.
   */
  async readFile(path: string): Promise<string | null> {
    if (!this.pod) return null;

    try {
      const file = await this.pod.openFile(path, "utf-8");
      const content = await file.read();
      await file.close();
      return content;
    } catch (err) {
      console.error(`[BrowserPod] readFile(${path}) failed:`, err);
      return null;
    }
  }

  /**
   * Sync multiple files from VFS to the pod.
   */
  async syncFiles(files: Array<{ path: string; content: string }>): Promise<number> {
    let synced = 0;
    for (const file of files) {
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

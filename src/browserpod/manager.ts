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

import stripAnsi from "strip-ansi";

// ─── Error Detection ───────────────────────────────────────

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

export interface RunOptions {
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables as "KEY=value" strings */
  env?: string[];
  /** Echo command to terminal output */
  echo?: boolean;
}

/** Internal options sent to BrowserPod's pod.run(), includes terminal ref. */
interface PodRunOptions extends RunOptions {
  terminal: Terminal;
}

export interface BrowserPodConfig {
  apiKey: string;
  storageKey?: string;
  /** Node.js version (currently only "22" is supported by BrowserPod) */
  nodeVersion?: string;
}

// Dynamic import types — declared in browserpod.d.ts
import type { BrowserPodInstance, Terminal } from "https://cdn.jsdelivr.net/npm/@leaningtech/browserpod@2.12.1/+esm";

// ─── Constants ──────────────────────────────────────────────
const MAX_RECONNECT_ATTEMPTS = 2;
const RECONNECT_DELAY_MS = 1000;

// ─── Manager ────────────────────────────────────────────────
class BrowserPodManager {
  private pod: BrowserPodInstance | null = null;
  private terminal: Terminal | null = null;
  private outputBuffer: string[] = [];
  private status: BrowserPodStatus = "idle";
  private error: string | null = null;
  private config: BrowserPodConfig | null = null;
  private statusListeners: Array<(status: BrowserPodStatus, error: string | null) => void> = [];
  /** Multi-callback set for HTTP portal events — supports multiple simultaneous servers */
  private portalCallbacks: Set<(event: { url: string; port: number }) => void> = new Set();

  /** Cache of last synced files for automatic re-sync after reconnection */
  private lastSyncedFiles: Array<{ path: string; content: string }> = [];

  /** Interactive terminal handle — separate from the headless terminal used by agent tools */
  private interactiveTerminal: Terminal | null = null;

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

    // Diagnostic: BrowserPod requires cross-origin isolation for SharedArrayBuffer.
    // Without COOP/COEP headers, boot will fail. Log a helpful warning early.
    if (typeof crossOriginIsolated !== "undefined" && !crossOriginIsolated) {
      console.warn(
        "[BrowserPod] Page is not cross-origin isolated (crossOriginIsolated=false). " +
        "BrowserPod requires SharedArrayBuffer, which needs these HTTP headers:\n" +
        "  Cross-Origin-Opener-Policy: same-origin\n" +
        "  Cross-Origin-Embedder-Policy: require-corp\n" +
        "See https://browserpod.io/docs/overview#cross-origin-isolation"
      );
    }

    this.config = config;
    this.setStatus("loading");
    console.log("[BrowserPod] Booting...");

    try {
      // Dynamic import — loaded from CDN at runtime (types in browserpod.d.ts)
      const { BrowserPod } = await import("https://cdn.jsdelivr.net/npm/@leaningtech/browserpod@2.12.1/+esm");

      if (typeof BrowserPod.boot !== "function") {
        throw new Error("BrowserPod.boot not found in module");
      }

      this.pod = await BrowserPod.boot({
        apiKey: config.apiKey,
        storageKey: config.storageKey ?? "agent-perchance",
        nodeVersion: config.nodeVersion ?? "22",
      });

      // Create custom headless terminal with onOutput callback
      // BrowserPod delivers raw terminal data as ArrayBuffer — decode to UTF-8 string
      const decoder = new TextDecoder("utf-8");
      this.terminal = await this.pod.createCustomTerminal({
        onOutput: (buffer: ArrayBuffer, _vt?: unknown) => {
          // Copy via slice() to handle both ArrayBuffer and SharedArrayBuffer
          // TextDecoder may reject SharedArrayBuffer-backed views
          const bytes = new Uint8Array(buffer.slice(0));
          const text = decoder.decode(bytes);
          this.outputBuffer.push(text);
        },
      });

      // Register a single pod-level portal callback that fans out to all registered callbacks.
      // This enables multiple simultaneous HTTP servers (each with its own port).
      this.pod.onPortal((event) => {
        for (const cb of this.portalCallbacks) {
          try { cb(event); } catch { /* isolate individual callback failures */ }
        }
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
   * Accepts optional RunOptions for setting cwd, env, and echo.
   * Files must be written to the pod's FS at the expected paths before execution.
   */
  async run(command: string, args: string[] = [], options?: RunOptions): Promise<RunResult> {
    if (!this.pod) {
      return { stdout: "", stderr: "BrowserPod not initialized", exitCode: 1 };
    }

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      try {
        // Clear output buffer before each execution
        this.outputBuffer = [];

        // Build run options — terminal is always required
        const runOpts: PodRunOptions = {
          terminal: this.terminal!,
          ...(options?.cwd && { cwd: options.cwd }),
          ...(options?.env && { env: options.env }),
          ...(options?.echo && { echo: options.echo }),
        };

        // pod.run() resolves when the process exits — no .wait() needed.
        const result = await this.pod.run(command, args, runOpts);

        // Primary source of output is the terminal onOutput callback buffer.
        // Fall back to result.stdout when the buffer is empty but the process
        // result carries stdout directly (some run backends return it inline).
        const rawStdout = this.outputBuffer.length > 0
          ? this.outputBuffer.join("")
          : (result as { stdout?: string } | null)?.stdout ?? "";

        // Strip ANSI escape codes and terminal artifacts (e.g., "null:0 null")
        const stdout = stripAnsi(rawStdout).replace(/^(?:null:\d+\s*null\s*)+/m, "").trimStart();

        // Extract exitCode from the process result.
        // NOTE: BrowserPod's Process handle is documented as opaque with no public
        // exitCode property — output goes to the terminal callback only. The duck-typed
        // extraction below works in practice but relies on an undocumented internal.
        // If it breaks in a future version, fall back to wrapping commands with
        // `; echo "BP_EXIT:$?"` and parsing from stdout.
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

    // Extract parent directory from the file path
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash <= 0) return; // Root or no parent — nothing to create
    const parentDir = filePath.slice(0, lastSlash);

    try {
      // BrowserPod supports { recursive: true } for creating intermediate directories
      await this.pod.createDirectory(parentDir, { recursive: true });
    } catch (err) {
      // EEXIST is benign — directory already exists. Other errors should be logged.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("exists") && !msg.includes("EEXIST")) {
        console.warn(`[BrowserPod] ensureDirectory(${parentDir}) unexpected error:`, msg);
      }
    }
  }

  /**
   * Write a file into the pod's virtual filesystem.
   * Creates parent directories recursively before writing.
   * Skips if the file already exists with identical content (avoiding
   * unnecessary `createFile` which wipes existing content per BrowserPod docs).
   * Automatically reconnects and retries on WebSocket failure.
   */
  async writeFile(path: string, content: string): Promise<boolean> {
    if (!this.pod) return false;

    // Pre-check: read existing content and skip if already in sync
    // This prevents unnecessary Pod writes and avoids the destructive
    // nature of createFile (which wipes existing content on open).
    const existingContent = await this.readFile(path);
    if (existingContent !== null && existingContent === content) {
      // Already in sync — ensure it's tracked in the cache
      const existingIdx = this.lastSyncedFiles.findIndex((f) => f.path === path);
      if (existingIdx < 0) {
        this.lastSyncedFiles.push({ path, content });
      }
      return true;
    }

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      try {
        // Ensure parent directories exist first
        await this.ensureDirectory(path);

        // createFile(path, "utf-8") per BrowserPod 2.0 debugging docs.
        const file = await this.pod.createFile(path, "utf-8");
        await file.write(content);
        await file.close();

        // Track for reconnection recovery (used by subscribeToVfsChanges writes too)
        const existingIdx = this.lastSyncedFiles.findIndex((f) => f.path === path);
        if (existingIdx >= 0) {
          this.lastSyncedFiles[existingIdx] = { path, content };
        } else {
          this.lastSyncedFiles.push({ path, content });
        }

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
      let file: any = null;
      try {
        file = await this.pod.openFile(path, "utf-8");

        // BrowserPod's TextFile.read(length) REQUIRES an integer byte length.
        // Passing no argument reads 0 bytes and silently returns "".
        // Read the byte size via getSize() and iterate in chunks, advancing
        // the seek position by the actual UTF-8 bytes decoded per chunk.
        const totalBytes = await file.getSize();
        const CHUNK = 1024 * 1024; // 1 MiB
        const encoder = new TextEncoder();
        let content = "";
        let position = 0;
        while (position < totalBytes) {
          const toRead = Math.min(CHUNK, totalBytes - position);
          const chunk = await file.read(toRead);
          if (chunk === "") break; // EOF / read cap reached
          content += chunk;
          position += encoder.encode(chunk).length;
        }

        await file.close();
        file = null; // prevent double-close in finally
        return content;
      } catch (err) {
        if (attempt < MAX_RECONNECT_ATTEMPTS && this.isWebSocketError(err)) {
          console.warn(`[BrowserPod] readFile(${path}) WebSocket error (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS + 1}), reconnecting...`);
          if (file) try { await file.close(); } catch { /* ignore close errors during reconnect */ }
          const reconnected = await this.reconnect();
          if (!reconnected) return null;
          await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
          continue;
        }

        const message = err instanceof Error ? err.message : String(err);
        const isNotFound =
          message.includes("Failed to open file") ||
          message.includes("ENOENT") ||
          message.includes("no such file");
        if (isNotFound) {
          console.debug(`[BrowserPod] readFile(${path}) not found (expected during pre-check)`);
        } else {
          console.error(`[BrowserPod] readFile(${path}) failed:`, err);
        }
        return null;
      } finally {
        // Ensure file handle is closed even if read() throws
        if (file) try { await file.close(); } catch { /* best-effort close */ }
      }
    }

    return null;
  }

  /**
   * Sync multiple files from VFS to the pod.
   * Caches files for automatic re-sync after WebSocket reconnection.
   * Merges files into the existing cache instead of replacing it,
   * so files written by real-time subscription are not lost.
   */
  async syncFiles(files: Array<{ path: string; content: string }>): Promise<number> {
    // Merge: update existing entries, add new ones — don't remove
    for (const file of files) {
      const idx = this.lastSyncedFiles.findIndex((f) => f.path === file.path);
      if (idx >= 0) {
        this.lastSyncedFiles[idx] = file;
      } else {
        this.lastSyncedFiles.push(file);
      }
    }

    let synced = 0;
    for (const file of files) {
      // Validate package.json before syncing to prevent corrupting the Pod environment
      if (file.path.endsWith("package.json")) {
        try {
          // Defensive: strip UTF-8 BOM and invisible whitespace that LLMs may inject
          const sanitizedContent = file.content.replace(/^\uFEFF/, "").trim();
          JSON.parse(sanitizedContent);
        } catch {
          const preview = file.content.slice(0, 200).replace(/\n/g, "\\n");
          console.warn(`[BrowserPod] Skipping invalid package.json at ${file.path} — content is not valid JSON. Preview: ${preview}`);
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
   * Get the list of file paths from the last sync operation.
   * Used by shell-tools to reconcile deletions (VFS → Pod).
   */
  getLastSyncedPaths(): string[] {
    return this.lastSyncedFiles.map((f) => f.path);
  }

  /** Remove a path from the last-synced cache. Keeps the reconcile cache accurate. */
  untrackSyncedPath(path: string): void {
    this.lastSyncedFiles = this.lastSyncedFiles.filter((f) => f.path !== path);
  }

  /**
   * Delete a file or directory inside the Pod.
   * Uses `rm -rf` directly (no shell wrapping) for safety and to avoid shell injection.
   */
  async deleteFile(path: string): Promise<boolean> {
    if (!this.pod) return false;
    // Safety: never delete root or project root
    if (path === "/" || path === "/home" || path === "/home/user") return false;

    const result = await this.run("rm", ["-rf", path]);
    return result.exitCode === 0;
  }

  /**
   * Rename/move a file or directory inside the Pod.
   * Uses `mv` directly (no shell wrapping) for safety and to avoid shell injection.
   */
  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    if (!this.pod) return false;
    // Safety: never move root or project root
    if (oldPath === "/" || oldPath === "/home" || oldPath === "/home/user") return false;

    // Ensure destination parent directory exists
    await this.ensureDirectory(newPath);

    const result = await this.run("mv", [oldPath, newPath]);
    return result.exitCode === 0;
  }

  /**
   * List all regular files under a directory in the Pod.
   * Returns an array of absolute file paths.
   */
  async listFiles(dir: string): Promise<string[]> {
    if (!this.pod) return [];

    // Exclude common non-project directories to avoid traversing heavy trees (node_modules, .git, etc.)
    const result = await this.run("find", [
      dir, "-type", "f",
      "-not", "-path", "*/node_modules/*",
      "-not", "-path", "*/.git/*",
      "-not", "-path", "*/.npm/*",
      "-not", "-path", "*/__pycache__/*",
    ]);
    if (result.exitCode !== 0) {
      console.warn(`[BrowserPod] listFiles(${dir}) find exited with code ${result.exitCode}`);
      return [];
    }
    if (!result.stdout.trim()) return [];

    return result.stdout
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * List all directories under a path in the Pod (mirror of listFiles for -type d).
   */
  async listDirectories(dir: string): Promise<string[]> {
    if (!this.pod) return [];
    const result = await this.run("find", [
      dir, "-type", "d",
      "-not", "-path", "*/node_modules/*",
      "-not", "-path", "*/.git/*",
      "-not", "-path", "*/.npm/*",
      "-not", "-path", "*/__pycache__/*",
    ]);
    if (result.exitCode !== 0) return [];
    if (!result.stdout.trim()) return [];
    return result.stdout
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Create an interactive terminal attached to a DOM element AND start a shell.
   *
   * Uses createDefaultTerminal(element) for the xterm.js UI, then immediately
   * starts /bin/bash connected to that terminal via pod.run().
   *
   * IMPORTANT: createDefaultTerminal ONLY creates the visual xterm.js instance.
   * Without an explicit pod.run() with a shell binary, no shell process exists
   * — typing just echoes to the terminal and Enter produces a newline.
   *
   * This is separate from the headless createCustomTerminal used by agent tools.
   * Both can coexist within the same Pod instance.
   *
   * Call disposeInteractiveTerminal() when the panel is hidden to clean up.
   */
  async createInteractiveTerminal(element: HTMLElement): Promise<void> {
    // Initial guard: pod must be ready
    if (!this.pod) {
      throw new Error("BrowserPod not initialized");
    }

    // Dispose any previous interactive session
    await this.disposeInteractiveTerminal();

    // ── Re-check after await ──
    // The pod may have been disposed while we were awaiting disposeInteractiveTerminal.
    // This can happen if the panel was closed during the async operation.
    if (!this.pod) {
      throw new Error("BrowserPod was disposed while initializing the interactive terminal");
    }

    // Step 1: Create the xterm.js UI (visual terminal)
    // Per BrowserPod docs, createDefaultTerminal() always returns Promise<Terminal>.
    // But if the DOM element was cleared (by cleanup running concurrently), it may
    // return undefined or throw.
    this.interactiveTerminal = await this.pod.createDefaultTerminal(element);

    // ── Re-check after await ──
    // Pod could have been disposed while createDefaultTerminal was in-flight.
    if (!this.pod) {
      this.interactiveTerminal = null;
      throw new Error("BrowserPod was disposed while creating the terminal UI");
    }

    // Guard: ensure createDefaultTerminal returned a valid terminal.
    // An invalid/null DOM element (cleared by concurrent cleanup) can cause this.
    if (!this.interactiveTerminal) {
      throw new Error("createDefaultTerminal returned no terminal — the DOM element may have been cleared");
    }

    // Step 2: Start a bash shell connected to that terminal
    // pod.run() with the interactive terminal as the terminal option connects
    // stdin/stdout of the process to the xterm.js instance.
    // We use .catch() to avoid unhandled rejections since the shell process
    // runs indefinitely until the pod is disposed or the user closes the terminal.
    const runPromise = this.pod.run("/bin/bash", [], {
      terminal: this.interactiveTerminal,
      cwd: "/home/user",
    });

    // Guard: ensure pod.run() returned a valid Promise/thenable before chaining.
    // Per BrowserPod types, run() always returns Promise<Process>. But if the pod
    // is in a partially-disposed state (this.pod truthy but underlying runtime gone),
    // the Proxy may return undefined or a non-thenable instead of a proper Promise.
    if (!runPromise || typeof (runPromise as any).then !== "function") {
      console.warn("[BrowserPod] Interactive shell run() did not return a thenable");
      this.interactiveTerminal = null;
      throw new Error("Interactive shell could not be started — pod.run() returned no promise");
    }

    // Fire-and-forget: the shell runs until the xterm is destroyed or pod is disposed.
    // Errors (e.g., bash binary not found) are logged for debugging.
    (runPromise as Promise<unknown>).then(() => {
      console.log("[BrowserPod] Interactive shell exited");
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[BrowserPod] Interactive shell failed:", msg);
      this.interactiveTerminal = null;
    });
  }

  /**
   * Dispose the interactive terminal and its shell process.
   *
   * The shell lifecycle is tied to the xterm instance created by
   * createDefaultTerminal(). When the parent element's innerHTML is
   * cleared (by TerminalPanel cleanup), the xterm is destroyed, which
   * sends SIGHUP to the shell process, causing it to exit naturally.
   * Safe to call even if no interactive terminal is active.
   */
  async disposeInteractiveTerminal(): Promise<void> {
    this.interactiveTerminal = null;
  }

  /**
   * Register a callback for HTTP portal events.
   * Uses the official pod.onPortal() API from BrowserPod 2.0.
   * The callback is invoked whenever a process inside the Pod calls listen() on a port.
   * Supports multiple simultaneous callbacks (e.g., multiple HTTP servers on different ports).
   * Can be called before or after boot — callbacks are collected and registered during boot().
   * Returns an unsubscribe function.
   */
  registerPortalCallback(callback: (event: { url: string; port: number }) => void): () => void {
    this.portalCallbacks.add(callback);
    return () => {
      this.portalCallbacks.delete(callback);
    };
  }

  /**
   * TEST-ONLY: Inject a mock pod instance for unit testing without a real BrowserPod.
   * The mock must implement the same methods used by this manager:
   * createFile, openFile, createDirectory, run, onPortal, dispose.
   */
  __setTestPod(mockPod: any): void {
    this.pod = mockPod;
    this.terminal = {} as any;
    this.setStatus("ready");
    this.config = { apiKey: "test" };
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
    this.portalCallbacks.clear();
    this.setStatus("idle");
    this.config = null;
    this.interactiveTerminal = null;
    console.log("[BrowserPod] Disposed");
  }

  private setStatus(status: BrowserPodStatus, error: string | null = null): void {
    this.status = status;
    this.error = error;
    this.notifyStatus();
  }

  /**
   * Subscribe to VFS change events and propagate them to the Pod.
   * Must be called once after boot to enable real-time VFS → Pod sync.
   * - write: pushes file content to Pod via writeFile()
   * - delete: removes file/directory in Pod via deleteFile()
   * - rename: moves file/directory in Pod via renameFile()
   *
   * Returns an unsubscribe function.
   */
  subscribeToVfsChanges(): () => void {
    // Dynamic import to avoid circular dependency at module level
    // vfs.ts does not import from manager.ts, so this is safe at runtime
    const ref: { current: (() => void) | null } = { current: null };

    import("../vfs.js").then(({ onVfsChange, PROJECT_ROOT }) => {
      const unsubscribe = onVfsChange(async (event) => {
        if (!this.isReady()) return;

        // Only propagate changes under PROJECT_ROOT — system dirs are Pod-internal
        if (!event.path.startsWith(PROJECT_ROOT)) return;

        try {
          switch (event.type) {
            case "write": {
              // Read fresh content from VFS (may have changed since event fired)
              const { vfsRead } = await import("../vfs.js");
              const content = vfsRead(event.path);
              if (content === null) break;

              // Guard: never propagate an empty or invalid package.json to the Pod.
              // Doing so would overwrite/destroy the real package.json (e.g., after a
              // corrupt pull left the VFS entry empty). Mirror syncFiles() validation.
              if (event.path.endsWith("package.json")) {
                const trimmed = content.replace(/^\uFEFF/, "").trim();
                if (trimmed === "") {
                  console.warn(`[BrowserPod] Skipping VFS→Pod sync of EMPTY package.json at ${event.path} to preserve the Pod copy`);
                  break;
                }
                try {
                  JSON.parse(trimmed);
                } catch {
                  console.warn(`[BrowserPod] Skipping VFS→Pod sync of INVALID package.json at ${event.path} to preserve the Pod copy`);
                  break;
                }
              }

              await this.writeFile(event.path, content);
              break;
            }
            case "delete":
              await this.deleteFile(event.path);
              break;
            case "rename":
              if (event.newPath) {
                await this.renameFile(event.path, event.newPath);
              }
              break;
          }
        } catch (err) {
          console.warn(`[BrowserPod] VFS→Pod sync failed for ${event.type} ${event.path}:`, err);
        }
      });
      ref.current = unsubscribe;
    }).catch((err) => {
      console.error("[BrowserPod] Failed to subscribe to VFS changes:", err);
    });

    return () => {
      ref.current?.();
    };
  }
}

// ─── Standalone Key Validation ─────────────────────────────

/**
 * Result of a key validation attempt.
 * `ok` is true when the key is valid, false otherwise.
 * `error` contains a human-readable error message when validation fails.
 */
export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate a BrowserPod API key by attempting to boot and immediately disposing.
 *
 * ⚠ NOTE: Each BrowserPod.boot() call costs 10 tokens from your account.
 * Validation will deduct tokens even though the pod is disposed immediately.
 *
 * This function does NOT use the singleton manager — it creates a fresh boot
 * attempt so the key can be tested before being stored or activated.
 * Returns { ok: true } if the key is valid,
 * or { ok: false, error: "description" } on failure.
 *
 * Checks cross-origin isolation first — required for SharedArrayBuffer.
 * Without it, BrowserPod boot will always fail.
 */
export async function validateBrowserPodKey(apiKey: string): Promise<ValidationResult> {
  // Check 1: Cross-origin isolation (required for SharedArrayBuffer)
  if (typeof crossOriginIsolated !== "undefined" && !crossOriginIsolated) {
    return {
      ok: false,
      error: "Page is not cross-origin isolated. Server must send headers: Cross-Origin-Opener-Policy: same-origin & Cross-Origin-Embedder-Policy: require-corp",
    };
  }

  try {
    // Check 2: Dynamic import of BrowserPod CDN module
    let BrowserPodModule: any;
    try {
      BrowserPodModule = await import(
        "https://cdn.jsdelivr.net/npm/@leaningtech/browserpod@2.12.1/+esm"
      );
    } catch (importErr) {
      const msg = importErr instanceof Error ? importErr.message : String(importErr);
      return {
        ok: false,
        error: `Failed to load BrowserPod from CDN: ${msg}`,
      };
    }

    if (typeof BrowserPodModule.BrowserPod?.boot !== "function") {
      return {
        ok: false,
        error: "BrowserPod module loaded but boot() function not found — version mismatch",
      };
    }

    // Check 3: Attempt to boot (validates the API key)
    let pod: any;
    try {
      pod = await BrowserPodModule.BrowserPod.boot({
        apiKey,
        storageKey: "agent-perchance-validate",
        nodeVersion: "22",
      });
    } catch (bootErr) {
      const msg = bootErr instanceof Error ? bootErr.message : String(bootErr);
      return {
        ok: false,
        error: `BrowserPod boot failed: ${msg}`,
      };
    }

    // Cleanup: dispose immediately
    try {
      await pod.dispose();
    } catch {
      // dispose failure is non-critical, ignore
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Unexpected error: ${message}`,
    };
  }
}

/**
 * Check if the current page meets BrowserPod's cross-origin isolation requirement.
 * BrowserPod needs SharedArrayBuffer, which requires both COOP and COEP headers.
 * Returns true if isolated (or if running on localhost which is exempt), false otherwise.
 *
 * Per official docs: https://browserpod.io/docs/understanding-browserpod/cross-origin-isolation
 */
export function isCrossOriginIsolated(): boolean {
  return typeof crossOriginIsolated === "undefined" || crossOriginIsolated === true;
}

// ─── Singleton Export ───────────────────────────────────────
export const browserPodManager = new BrowserPodManager();

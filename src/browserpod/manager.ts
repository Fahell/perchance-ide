/**
 * BrowserPod Manager — Singleton interface for Node.js runtime in browser.
 *
 * Wraps @leaningtech/browserpod API with lifecycle management,
 * VFS synchronization, and error recovery.
 *
 * Architecture: Main-thread boot (required by BrowserPod API),
 * async communication pattern similar to pyodide-manager.
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

// ─── Dynamic import type ────────────────────────────────────
interface BrowserPodFile {
  write(content: string): Promise<void>;
  read(): Promise<string>;
  close(): Promise<void>;
}

interface BrowserPodProcess {
  wait(): Promise<{ exitCode: number }>;
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
}

interface BrowserPodInstance {
  run(command: string, args?: string[], options?: Record<string, unknown>): Promise<BrowserPodProcess>;
  createFile(path: string, encoding?: string): Promise<BrowserPodFile>;
  openFile(path: string, encoding?: string): Promise<BrowserPodFile>;
  dispose(): Promise<void>;
}

interface BrowserPodClass {
  boot(config: { apiKey: string; storageKey?: string }): Promise<BrowserPodInstance>;
}

// ─── Stream reader helper ───────────────────────────────────
async function readStream(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

// ─── Manager ────────────────────────────────────────────────
class BrowserPodManager {
  private pod: BrowserPodInstance | null = null;
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

      this.setStatus("ready");
      console.log("[BrowserPod] Ready");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[BrowserPod] Boot failed:", message);
      this.setStatus("error", message);
      this.pod = null;
      return false;
    }
  }

  /**
   * Execute a command inside the pod (e.g., "node", "npm").
   */
  async run(command: string, args: string[] = [], cwd?: string): Promise<RunResult> {
    if (!this.pod) {
      return { stdout: "", stderr: "BrowserPod not initialized", exitCode: 1 };
    }

    try {
      const options: Record<string, unknown> = {};
      if (cwd) options.cwd = cwd;

      const process = await this.pod.run(command, args, options);

      // Read stdout/stderr concurrently
      const [stdout, stderr, result] = await Promise.all([
        readStream(process.stdout),
        readStream(process.stderr),
        process.wait(),
      ]);

      return { stdout, stderr, exitCode: result.exitCode };
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
      // Ensure parent directories exist by creating file directly
      const file = await this.pod.createFile(path, "text");
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
      const file = await this.pod.openFile(path, "text");
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
    }
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

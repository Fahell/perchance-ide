/**
 * Pyodide Worker Manager — Promise-based interface for inline Pyodide Worker.
 *
 * Creates a Web Worker from embedded code (Blob URL), manages request/response
 * correlation via requestId, and provides the same API surface as the previous
 * direct Pyodide integration.
 *
 * Lifecycle:
 *   1. construct() → creates Worker, sends init
 *   2. waitForReady() → resolves when Pyodide is loaded in worker
 *   3. runPython() / installPackage() → async calls with timeout
 *   4. terminate() → cleanup
 */

import { PYODIDE_WORKER_CODE } from "./pyodide-worker-code.js";

// ─── Types ──────────────────────────────────────────────────

interface WorkerMessage {
  type: string;
  requestId?: string;
  message?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  changedFiles?: Record<string, string>;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface PythonWorkerResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  changedFiles: Record<string, string>;
}

// ─── Constants ──────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const INIT_TIMEOUT_MS = 60_000;     // 1 minute for Pyodide load
const PACKAGE_TIMEOUT_MS = 120_000; // 2 minutes for package install

// ─── Manager ────────────────────────────────────────────────

export class PyodideWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private _ready: boolean = false;
  private _readyPromise: Promise<void> | null = null;
  private _error: string | null = null;
  private _blobUrl: string | null = null;
  private onLog: ((msg: string) => void) | null = null;

  constructor(options?: { onLog?: (msg: string) => void }) {
    this.onLog = options?.onLog ?? null;
  }

  /** Check if the worker is ready for execution. */
  get isReady(): boolean {
    return this._ready;
  }

  /** Get current error state. */
  get error(): string | null {
    return this._error;
  }

  /**
   * Initialize the worker and wait for Pyodide to be ready.
   * Safe to call multiple times — returns the same promise.
   */
  async init(): Promise<void> {
    if (this._ready) return;
    if (this._readyPromise) return this._readyPromise;

    this._readyPromise = this._doInit();
    return this._readyPromise;
  }

  private async _doInit(): Promise<void> {
    try {
      // Create inline worker from embedded code
      const blob = new Blob([PYODIDE_WORKER_CODE], { type: "application/javascript" });
      this._blobUrl = URL.createObjectURL(blob);
      this.worker = new Worker(this._blobUrl);

      // Set up message handler
      this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        this._handleMessage(e.data);
      };

      this.worker.onerror = (e: ErrorEvent) => {
        console.error("[PyodideWorker] Worker error:", e.message);
        this._error = e.message || "Worker error";
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error(this._error!));
        }
        this.pendingRequests.clear();
      };

      // Send init command
      const requestId = this._nextRequestId();
      this.worker.postMessage({ type: "init", requestId });

      // Wait for ready response with timeout
      await this._waitForResponse(requestId, INIT_TIMEOUT_MS);
      this._ready = true;
      console.log("🐍 [PyodideWorker] Ready");
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      console.error("🐍 [PyodideWorker] Init failed:", this._error);
      throw err;
    }
  }

  /**
   * Execute Python code in the worker.
   * @param code - Python source code
   * @param vfsSnapshot - Current VFS file contents (path → content)
   * @param knownPaths - List of known VFS file paths for change detection
   * @param timeoutMs - Execution timeout in milliseconds
   */
  async runPython(
    code: string,
    vfsSnapshot: Record<string, string>,
    knownPaths: string[],
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<PythonWorkerResult> {
    await this.init();

    const requestId = this._nextRequestId();
    this.worker!.postMessage({
      type: "runPython",
      requestId,
      code,
      vfsSnapshot,
      knownPaths,
    });

    const result = await this._waitForResponse(requestId, timeoutMs);
    return result as PythonWorkerResult;
  }

  /**
   * Install a Python package in the worker.
   * @param name - Validated PEP 508 package name
   */
  async installPackage(name: string): Promise<string> {
    await this.init();

    const requestId = this._nextRequestId();
    this.worker!.postMessage({
      type: "installPackage",
      requestId,
      name,
    });

    const result = await this._waitForResponse(requestId, PACKAGE_TIMEOUT_MS);
    return (result as { message: string }).message;
  }

  /** Terminate the worker and clean up resources. */
  terminate(): void {
    if (this.worker) {
      this.worker.postMessage({ type: "terminate" });
      this.worker.terminate();
      this.worker = null;
    }
    if (this._blobUrl) {
      URL.revokeObjectURL(this._blobUrl);
      this._blobUrl = null;
    }
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Worker terminated"));
    }
    this.pendingRequests.clear();
    this._ready = false;
    this._readyPromise = null;
    this._error = null;
  }

  // ─── Internal ─────────────────────────────────────────────

  private _nextRequestId(): string {
    return `req-${++this.requestCounter}-${Date.now()}`;
  }

  private _handleMessage(msg: WorkerMessage): void {
    // Handle log messages (no requestId)
    if (msg.type === "log") {
      console.log("🐍 [PyodideWorker]", msg.message);
      this.onLog?.(msg.message ?? "");
      return;
    }

    // Handle messages with requestId
    const requestId = msg.requestId;
    if (!requestId) return;

    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    this.pendingRequests.delete(requestId);
    clearTimeout(pending.timer);

    switch (msg.type) {
      case "ready":
        pending.resolve(undefined);
        break;
      case "result":
        pending.resolve(msg);
        break;
      case "error":
        this._error = msg.message ?? "Unknown worker error";
        pending.reject(new Error(this._error));
        break;
      default:
        pending.reject(new Error(`Unexpected message type: ${msg.type}`));
    }
  }

  private _waitForResponse(requestId: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new DOMException(
            `Pyodide worker timed out after ${timeoutMs}ms`,
            "AbortError",
          ),
        );
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
    });
  }
}

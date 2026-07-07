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
 *   3. runPython() / installPackage() / syncFiles() → async calls with timeout
 *   4. subscribeToVfs() → incremental VFS sync via onVfsChange events
 *   5. terminate() → cleanup
 */
import { onVfsChange } from "../vfs-events.js";
import { vfsRead } from "../vfs.js";
import { PYODIDE_WORKER_CODE } from "./pyodide-worker-code.js";
// ─── Constants ──────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes
const INIT_TIMEOUT_MS = 180_000; // 3 minutes for Pyodide load
const PACKAGE_TIMEOUT_MS = 120_000; // 2 minutes for package install
const SYNC_TIMEOUT_MS = 30_000; // 30 seconds for VFS sync
const MAX_INIT_RETRIES = 2;
const INIT_RETRY_DELAYS = [5_000, 15_000]; // backoff: 5s, 15s
const SYNC_DEBOUNCE_MS = 300;
// ─── Manager ────────────────────────────────────────────────
export class PyodideWorkerManager {
    worker = null;
    pendingRequests = new Map();
    requestCounter = 0;
    _ready = false;
    _readyPromise = null;
    _error = null;
    _blobUrl = null;
    onLog = null;
    // VFS incremental sync state
    _vfsUnsubscribe = null;
    _syncBuffer = { added: {}, deleted: [] };
    _syncTimer = null;
    _syncActive = false;
    constructor(options) {
        this.onLog = options?.onLog ?? null;
    }
    /** Whether incremental VFS sync is currently active. */
    get syncActive() {
        return this._syncActive;
    }
    /** Check if the worker is ready for execution. */
    get isReady() {
        return this._ready;
    }
    /** Get current error state. */
    get error() {
        return this._error;
    }
    /**
     * Initialize the worker and wait for Pyodide to be ready.
     * Safe to call multiple times — returns the same promise.
     */
    async init() {
        if (this._ready)
            return;
        if (this._readyPromise)
            return this._readyPromise;
        this._readyPromise = this._doInitWithRetry();
        return this._readyPromise;
    }
    async _doInitWithRetry() {
        let lastError = null;
        for (let attempt = 0; attempt <= MAX_INIT_RETRIES; attempt++) {
            if (attempt > 0) {
                const delay = INIT_RETRY_DELAYS[attempt - 1] ?? INIT_RETRY_DELAYS[INIT_RETRY_DELAYS.length - 1];
                console.log(`🐍 [Pyodide] Retry ${attempt}/${MAX_INIT_RETRIES} in ${delay / 1000}s...`);
                await new Promise((r) => setTimeout(r, delay));
                // Terminate failed worker before retrying
                this._cleanupWorker();
            }
            try {
                await this._doInit();
                return; // Success
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                const isTimeout = lastError.name === "AbortError" || lastError.message.includes("timed out");
                if (!isTimeout && attempt < MAX_INIT_RETRIES) {
                    // Non-timeout errors: still retry but log differently
                    console.warn(`🐍 [Pyodide] Init attempt ${attempt + 1} failed:`, lastError.message);
                }
                else if (!isTimeout) {
                    // Non-timeout on last attempt: fail immediately
                    break;
                }
            }
        }
        this._error = lastError?.message ?? "Unknown init error";
        console.error("🐍 [Pyodide] All init attempts failed:", this._error);
        throw lastError;
    }
    _cleanupWorker() {
        if (this.worker) {
            this.worker.onmessage = null;
            this.worker.onerror = null;
            this.worker.terminate();
            this.worker = null;
        }
        if (this._blobUrl) {
            URL.revokeObjectURL(this._blobUrl);
            this._blobUrl = null;
        }
        // Reject pending requests from previous attempt
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
        }
        this.pendingRequests.clear();
        this._ready = false;
    }
    async _doInit() {
        // Create inline worker from embedded code
        const blob = new Blob([PYODIDE_WORKER_CODE], { type: "application/javascript" });
        this._blobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(this._blobUrl, { type: "module" });
        // Set up message handler
        this.worker.onmessage = (e) => {
            this._handleMessage(e.data);
        };
        this.worker.onerror = (e) => {
            console.error("🐍 [Pyodide] Worker error:", e.message);
            this._error = e.message || "Worker error";
            // Reject all pending requests
            for (const [id, pending] of this.pendingRequests) {
                clearTimeout(pending.timer);
                pending.reject(new Error(this._error));
            }
            this.pendingRequests.clear();
        };
        // Send init command
        const requestId = this._nextRequestId();
        this.worker.postMessage({ type: "init", requestId });
        // Wait for ready response with timeout
        await this._waitForResponse(requestId, INIT_TIMEOUT_MS);
        this._ready = true;
        console.log("🐍 [Pyodide] Ready");
    }
    /**
     * Execute Python code in the worker.
     * @param code - Python source code
     * @param vfsSnapshot - Current VFS file contents (path → content). Optional when incremental sync is active.
     * @param knownPaths - List of known VFS file paths for change detection
     * @param timeoutMs - Execution timeout in milliseconds
     */
    async runPython(code, vfsSnapshot, knownPaths, timeoutMs = DEFAULT_TIMEOUT_MS) {
        await this.init();
        const requestId = this._nextRequestId();
        this.worker.postMessage({
            type: "runPython",
            requestId,
            code,
            vfsSnapshot,
            knownPaths,
        });
        const result = await this._waitForResponse(requestId, timeoutMs);
        return result;
    }
    /**
     * Install a Python package in the worker.
     * @param name - Validated PEP 508 package name
     */
    async installPackage(name) {
        await this.init();
        const requestId = this._nextRequestId();
        this.worker.postMessage({
            type: "installPackage",
            requestId,
            name,
        });
        const result = await this._waitForResponse(requestId, PACKAGE_TIMEOUT_MS);
        return result.message;
    }
    /** Terminate the worker and clean up resources. */
    terminate() {
        this._stopVfsSync();
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
    // ─── Incremental VFS Sync ────────────────────────────────
    /**
     * Subscribe to VFS change events and propagate incremental updates to the worker.
     * Buffers changes with debounce to batch rapid mutations into single sync messages.
     * Safe to call multiple times — subsequent calls are no-ops.
     */
    subscribeToVfs() {
        if (this._vfsUnsubscribe)
            return;
        this._syncActive = true;
        this._vfsUnsubscribe = onVfsChange((event) => {
            switch (event.type) {
                case "created":
                case "modified": {
                    const content = vfsRead(event.path);
                    if (content != null) {
                        this._syncBuffer.added[event.path] = content;
                        // Remove from deleted if previously marked
                        const delIdx = this._syncBuffer.deleted.indexOf(event.path);
                        if (delIdx !== -1)
                            this._syncBuffer.deleted.splice(delIdx, 1);
                    }
                    break;
                }
                case "deleted": {
                    delete this._syncBuffer.added[event.path];
                    if (!this._syncBuffer.deleted.includes(event.path)) {
                        this._syncBuffer.deleted.push(event.path);
                    }
                    break;
                }
                case "renamed": {
                    // Treat rename as delete old + create new
                    delete this._syncBuffer.added[event.fromPath];
                    if (!this._syncBuffer.deleted.includes(event.fromPath)) {
                        this._syncBuffer.deleted.push(event.fromPath);
                    }
                    const newContent = vfsRead(event.toPath);
                    if (newContent != null) {
                        this._syncBuffer.added[event.toPath] = newContent;
                        const delIdx = this._syncBuffer.deleted.indexOf(event.toPath);
                        if (delIdx !== -1)
                            this._syncBuffer.deleted.splice(delIdx, 1);
                    }
                    break;
                }
            }
            this._scheduleFlush();
        });
        console.log("🐍 [Pyodide] VFS incremental sync enabled");
    }
    /** Send incremental VFS changes to the worker MEMFS. */
    async syncFiles(added, deleted, timeoutMs = SYNC_TIMEOUT_MS) {
        await this.init();
        const requestId = this._nextRequestId();
        this.worker.postMessage({
            type: "syncFiles",
            requestId,
            added,
            deleted,
        });
        const result = await this._waitForResponse(requestId, timeoutMs);
        return result.message;
    }
    _scheduleFlush() {
        if (this._syncTimer)
            clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => {
            this._flushSyncBuffer();
        }, SYNC_DEBOUNCE_MS);
    }
    async _flushSyncBuffer() {
        const added = { ...this._syncBuffer.added };
        const deleted = [...this._syncBuffer.deleted];
        this._syncBuffer = { added: {}, deleted: [] };
        const totalChanges = Object.keys(added).length + deleted.length;
        if (totalChanges === 0)
            return;
        if (!this._ready || !this.worker)
            return;
        try {
            await this.syncFiles(added, deleted);
        }
        catch (err) {
            console.warn("🐍 [Pyodide] VFS sync failed:", err);
        }
    }
    _stopVfsSync() {
        if (this._syncTimer) {
            clearTimeout(this._syncTimer);
            this._syncTimer = null;
        }
        if (this._vfsUnsubscribe) {
            this._vfsUnsubscribe();
            this._vfsUnsubscribe = null;
        }
        this._syncActive = false;
        this._syncBuffer = { added: {}, deleted: [] };
    }
    // ─── Internal ─────────────────────────────────────────────
    _nextRequestId() {
        return `req-${++this.requestCounter}-${Date.now()}`;
    }
    _handleMessage(msg) {
        // Handle log messages (no requestId) — forward to callback only, no console duplication
        if (msg.type === "log") {
            this.onLog?.(msg.message ?? "");
            return;
        }
        // Handle messages with requestId
        const requestId = msg.requestId;
        if (!requestId)
            return;
        const pending = this.pendingRequests.get(requestId);
        if (!pending)
            return;
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
    _waitForResponse(requestId, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new DOMException(`Pyodide worker timed out after ${timeoutMs}ms`, "AbortError"));
            }, timeoutMs);
            this.pendingRequests.set(requestId, { resolve, reject, timer });
        });
    }
}

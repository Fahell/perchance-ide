/**
 * Pyodide Bridge — Worker-based Python execution with VFS sync.
 *
 * Delegates all Python execution to an inline Web Worker via PyodideWorkerManager,
 * keeping the main thread responsive during Pyodide load and script execution.
 *
 * VFS sync:
 *   - Incremental: onVfsChange events propagate file changes to worker MEMFS automatically.
 *   - Full snapshot: sent on first execution or when incremental sync is not active.
 *   - Post-execution: changed files from worker are written back to VFS with anti-loop guard.
 *
 * Public API remains identical to the previous direct-Pyodide implementation.
 */

import { dbSaveVfs } from "../db.js";
import { ideStore } from "../store.js";
import { vfsGetAll, vfsSnapshot, vfsWrite } from "../vfs.js";
import { PyodideWorkerManager } from "../workers/pyodide-manager.js";

// ─── Singleton ──────────────────────────────────────────────
let _manager: PyodideWorkerManager | null = null;
let _initPromise: Promise<void> | null = null;
let _loadError: string | null = null;

// Anti-loop guard: prevents VFS writes from post-execution sync
// from triggering onVfsChange → worker sync → infinite loop
let _isSyncingFromWorker: boolean = false;

// ─── Persistence ────────────────────────────────────────────
async function persistVfs(): Promise<void> {
  try {
    await dbSaveVfs(vfsGetAll());
  } catch (e) {
    console.warn("[Pyodide] dbSaveVfs failed:", e);
  }
}

// ─── Manager Access ─────────────────────────────────────────

function getManager(): PyodideWorkerManager {
  if (!_manager) {
    _manager = new PyodideWorkerManager({
      onLog: (msg) => console.log("🐍 [Pyodide]", msg),
    });
  }
  return _manager;
}

export function getPyodideStatus(): { loaded: boolean; loading: boolean; error: string | null } {
  const manager = _manager;
  if (!manager) {
    return { loaded: false, loading: _initPromise !== null, error: _loadError };
  }
  return {
    loaded: manager.isReady,
    loading: !manager.isReady && manager.error === null,
    error: manager.error ?? _loadError,
  };
}

/**
 * Ensure the Pyodide worker is initialized and ready.
 * Safe to call multiple times — returns the same promise.
 */
export async function ensurePyodideReady(): Promise<void> {
  if (_manager?.isReady) return;
  if (_loadError) throw new Error(_loadError);
  if (_initPromise) return _initPromise;

  ideStore.getState().setPyodideStatus("loading");

  _initPromise = (async () => {
    try {
      const manager = getManager();
      await manager.init();
      // Enable incremental VFS sync after worker is ready
      manager.subscribeToVfs();
      ideStore.getState().setPyodideStatus("loaded");
      console.log("🐍 [Pyodide] Worker ready");
    } catch (err: any) {
      _loadError = String(err.message || err);
      ideStore.getState().setPyodideStatus("error", _loadError);
      console.error("🐍 [Pyodide] Worker init failed:", _loadError);
      throw err;
    }
  })();

  return _initPromise;
}

// ─── Execution ──────────────────────────────────────────────

export interface PythonResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute Python code with full stdout/stderr capture.
 * When incremental sync is active, skips full VFS snapshot (worker already has latest state).
 * Runs entirely in a Web Worker — main thread stays responsive.
 */
export async function executePython(code: string): Promise<PythonResult> {
  await ensurePyodideReady();
  const manager = getManager();

  // Only send full snapshot if incremental sync is NOT active
  const snapshot = manager.syncActive ? null : vfsSnapshot();
  const knownPaths = vfsGetAll()
    .filter((e) => e.type === "file")
    .map((e) => e.path);

  // Execute in worker (includes timeout handling)
  const result = await manager.runPython(code, snapshot, knownPaths);

  // Apply changed files back to VFS with anti-loop guard
  let changed = 0;
  if (result.changedFiles && Object.keys(result.changedFiles).length > 0) {
    _isSyncingFromWorker = true;
    try {
      for (const [path, content] of Object.entries(result.changedFiles)) {
        const existing = vfsGetAll().find((e) => e.path === path);
        if (!existing || existing.content !== content) {
          vfsWrite(path, content);
          changed++;
        }
      }
    } finally {
      _isSyncingFromWorker = false;
    }
  }

  if (changed > 0) {
    await persistVfs();
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

// ─── Package Name Validation ─────────────────────────────────

/**
 * Validates a Python package name according to PEP 508.
 * Only allows alphanumeric characters, dots, underscores, and hyphens.
 * Must start and end with alphanumeric character.
 */
function isValidPackageName(name: string): boolean {
  const PACKAGE_NAME_REGEX = /^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$/i;
  return PACKAGE_NAME_REGEX.test(name);
}

// ─── Package Installation ────────────────────────────────────

/**
 * Install a Python package via Pyodide's loadPackage or micropip.
 * Runs in the worker — main thread stays responsive.
 */
export async function installPackage(name: string): Promise<string> {
  // Validate package name BEFORE any use to prevent Python code injection
  if (!isValidPackageName(name)) {
    return `Error: Invalid package name '${name}'. Package names must match PEP 508: only letters, numbers, dots, underscores, and hyphens allowed, and must start/end with alphanumeric character.`;
  }

  await ensurePyodideReady();
  const manager = getManager();

  return manager.installPackage(name);
}

// ─── Cleanup ────────────────────────────────────────────────

/**
 * Terminate the Pyodide worker and reset state.
 * Useful for recovery after errors or memory pressure.
 */
export function terminatePyodide(): void {
  if (_manager) {
    _manager.terminate();
    _manager = null;
  }
  _initPromise = null;
  _loadError = null;
  _isSyncingFromWorker = false;
  ideStore.getState().setPyodideStatus("idle");
}

/**
 * Check if VFS writes are currently being synced from worker output.
 * Used by external consumers to avoid reacting to programmatic VFS updates.
 */
export function isSyncingFromWorker(): boolean {
  return _isSyncingFromWorker;
}

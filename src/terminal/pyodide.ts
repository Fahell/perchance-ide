/**
 * Pyodide Bridge — lazy loader, VFS↔MEMFS sync, Python execution.
 *
 * Pyodide is loaded dynamically from CDN (~3.5MB gzip, cold start 2-6s)
 * only when first needed. Subsequent calls reuse the already-loaded runtime.
 *
 * VFS sync:
 *   Before execution: all VFS files are written to Pyodide's MEMFS.
 *   After execution:  all known VFS paths are read back from MEMFS.
 *
 * Stdout/stderr are captured via batched handlers and returned as strings.
 */

import { withTimeout } from "../agent-loop.js";
import { dbSaveVfs } from "../db.js";
import { ideStore } from "../store.js";
import { vfsGetAll, vfsSnapshot, vfsWrite } from "../vfs.js";

// ─── Types ──────────────────────────────────────────────────
interface Pyodide {
  FS: {
    writeFile: (path: string, data: string, opts?: { encoding: string }) => void;
    readFile: (path: string, opts?: { encoding: string }) => any;
    mkdirTree: (path: string) => void;
    readdir: (path: string) => string[];
    stat: (path: string) => { isDirectory: boolean };
    analyzePath: (path: string) => { exists: boolean; isDirectory: boolean; object: { contents: Record<string, any> } };
  };
  runPython: (code: string) => any;
  runPythonAsync: (code: string) => Promise<any>;
  setStdout: (handler: any) => void;
  setStderr: (handler: any) => void;
  setStdin: (handler: any) => void;
  loadPackage: (name: string | string[]) => Promise<void>;
  globals: {
    get: (name: string) => any;
    set: (name: string, value: any) => void;
    delete: (name: string) => void;
  };
  /** Register a JavaScript module so it can be imported from Python. */
  registerJsModule?: (name: string, module: Record<string, unknown>) => void;
  /** Unregister a JavaScript module. */
  unregisterJsModule?: (name: string) => void;
}

// ─── Singleton ──────────────────────────────────────────────
let _pyodide: Pyodide | null = null;
let _loading: Promise<Pyodide> | null = null;
let _loadError: string | null = null;

// ─── Persistence ────────────────────────────────────────────
async function persistVfs(): Promise<void> {
  try {
    await dbSaveVfs(vfsGetAll());
  } catch (e) {
    console.warn("[Pyodide] dbSaveVfs failed:", e);
  }
}

// ─── Loader ─────────────────────────────────────────────────
export function getPyodideStatus(): { loaded: boolean; loading: boolean; error: string | null } {
  return {
    loaded: _pyodide !== null,
    loading: _loading !== null && _pyodide === null,
    error: _loadError,
  };
}

export async function getPyodide(): Promise<Pyodide> {
  if (_pyodide) return _pyodide;
  if (_loadError) throw new Error(_loadError);
  if (_loading) return _loading;

  // Notify store that loading has started
  ideStore.getState().setPyodideStatus("loading");

  _loading = (async () => {
    try {
      // Dynamic import from CDN — use .mjs for proper ESM exports
      const PYODIDE_MJS = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs";
      const pyodideModule: any = await import(PYODIDE_MJS);
      const pyodide = await pyodideModule.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/",
      });
      _pyodide = pyodide;
      ideStore.getState().setPyodideStatus("loaded");
      console.log("🐍 [Pyodide] Loaded successfully (v314.0.2)");
      return pyodide;
    } catch (err: any) {
      _loadError = String(err.message || err);
      ideStore.getState().setPyodideStatus("error", _loadError);
      console.error("🐍 [Pyodide] Failed to load:", _loadError);
      throw err;
    }
  })();

  return _loading;
}

// ─── VFS Sync ───────────────────────────────────────────────

/**
 * Sync all VFS files → Pyodide MEMFS.
 * Called before every Python execution.
 */
export async function syncToPyodide(): Promise<void> {
  const pyodide = await getPyodide();
  const snap = vfsSnapshot();

  for (const [path, content] of Object.entries(snap)) {
    // Ensure parent directory exists
    const dir = path.lastIndexOf("/");
    if (dir > 0) {
      const parent = path.slice(0, dir);
      pyodide.FS.mkdirTree(parent);
    }
    pyodide.FS.writeFile(path, content, { encoding: "utf8" });
  }
}

/**
 * Sync changed files from Pyodide MEMFS → VFS.
 * Called after every Python execution.
 * Reads back all known VFS file paths from MEMFS.
 * Also discovers new files created by Python in known directories.
 */
export async function syncFromPyodide(): Promise<void> {
  const pyodide = await getPyodide();
  let changed = 0;

  // 1. Check all known VFS file paths
  for (const entry of vfsGetAll()) {
    if (entry.type !== "file") continue;
    try {
      const newContent = pyodide.FS.readFile(entry.path, { encoding: "utf8" });
      if (typeof newContent === "string" && newContent !== entry.content) {
        vfsWrite(entry.path, newContent);
        changed++;
      }
    } catch {
      // File may not exist in MEMFS (e.g., deleted by Python) — ignore
    }
  }

  // 2. Discover new files created by Python in top-level directories
  //    Walk MEMFS recursively from root, find .py or .txt etc. not in VFS
  try {
    const memfsFiles = walkMemfs(pyodide, "/");
    const existingPaths = new Set(vfsGetAll().filter((e) => e.type === "file").map((e) => e.path));
    for (const filePath of memfsFiles) {
      if (!existingPaths.has(filePath)) {
        try {
          const content = pyodide.FS.readFile(filePath, { encoding: "utf8" });
          if (typeof content === "string") {
            vfsWrite(filePath, content);
            changed++;
          }
        } catch {
          // ignore binary files or unreadable paths
        }
      }
    }
  } catch {
    // MEMFS walk failed silently — some dirs may not be readable
  }

  if (changed > 0) {
    await persistVfs();
  }
}

/**
 * Walk Pyodide's MEMFS recursively, returning all file paths.
 */
function walkMemfs(pyodide: Pyodide, dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = pyodide.FS.readdir(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry === "." || entry === "..") continue;
    const fullPath = dir === "/" ? "/" + entry : dir + "/" + entry;
    try {
      const stat = pyodide.FS.stat(fullPath);
      if (stat.isDirectory) {
        results.push(...walkMemfs(pyodide, fullPath));
      } else {
        results.push(fullPath);
      }
    } catch {
      // skip unstatable entries
    }
  }
  return results;
}

// ─── Execution ──────────────────────────────────────────────

export interface PythonResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute Python code with full stdout/stderr capture.
 * Syncs VFS → MEMFS before, MEMFS → VFS after.
 */
export async function executePython(code: string): Promise<PythonResult> {
  const pyodide = await getPyodide();
  const stdoutBuffer: string[] = [];
  const stderrBuffer: string[] = [];

  // Capture stdout
  pyodide.setStdout({
    batched: (text: string) => {
      stdoutBuffer.push(text);
    },
  });

  // Capture stderr
  pyodide.setStderr({
    batched: (text: string) => {
      stderrBuffer.push(text);
    },
  });

  // Suppress stdin (raise error if Python tries to read input)
  pyodide.setStdin({ error: true });

  // Sync VFS → MEMFS
  await syncToPyodide();

  let exitCode = 0;

  try {
    await withTimeout(pyodide.runPythonAsync(code), 120_000, "runPythonAsync");
  } catch (err: unknown) {
    // Check if it was a timeout
    if (err instanceof DOMException && err.name === 'AbortError') {
      const msg = "Python execution timed out after 120 seconds.";
      stderrBuffer.push(msg);
    } else {
      stderrBuffer.push(err instanceof Error ? err.message : String(err));
    }
    exitCode = 1;
  }

  // Sync MEMFS → VFS
  await syncFromPyodide();

  return {
    stdout: stdoutBuffer.join("\n"),
    stderr: stderrBuffer.join("\n"),
    exitCode,
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
 */
export async function installPackage(name: string): Promise<string> {
  // Validate package name BEFORE any use to prevent Python code injection
  if (!isValidPackageName(name)) {
    return `Error: Invalid package name '${name}'. Package names must match PEP 508: only letters, numbers, dots, underscores, and hyphens allowed, and must start/end with alphanumeric character.`;
  }

  const pyodide = await getPyodide();

  try {
    // Try pre-built package first
    await withTimeout(pyodide.loadPackage(name), 60_000, "loadPackage");
    return `Success: Package '${name}' installed.`;
  } catch (err: unknown) {
    // Fallback to micropip for pure-Python wheels
    console.warn("[Pyodide] loadPackage failed, trying micropip:", err instanceof Error ? err.message : String(err));
    try {
      // Safe interpolation: name is already validated against PEP 508
      await withTimeout(pyodide.runPythonAsync(`
        import micropip
        await micropip.install("${name}")
      `), 120_000, "micropip");
      return `Success: Package '${name}' installed via micropip.`;
    } catch (err: any) {
      return `Error: Failed to install '${name}': ${err.message || err}`;
    }
  }
}

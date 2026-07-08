/**
 * Pyodide Worker Code — embedded as string for inline Blob URL Worker creation.
 *
 * This module exports the worker source code as a string constant.
 * The PyodideManager creates a Worker from this code via Blob URL,
 * keeping the entire IDE in a single bundle file.
 *
 * Message Protocol:
 *   Main → Worker: { type: "init" | "runPython" | "installPackage" | "syncFiles", requestId: string, ...payload }
 *   Worker → Main: { type: "ready" | "result" | "error" | "stdout" | "stderr" | "log", requestId?: string, ...data }
 */

export const PYODIDE_WORKER_CODE = `
// Module Worker context — top-level await supported

// ─── State ──────────────────────────────────────────────────
let pyodide = null;
let loading = false;
let loadError = null;
let _loadResolve = null;
let _loadReject = null;
let _loadPromise = null;

// ─── Helpers ────────────────────────────────────────────────
function sendMsg(msg) {
  self.postMessage(msg);
}

function ensureParentDirs(FS, path) {
  const dir = path.lastIndexOf("/");
  if (dir > 0) {
    const parent = path.slice(0, dir);
    try { FS.mkdirTree(parent); } catch {}
  }
}

function walkMemfs(FS, dir, depth, visited) {
  if (depth === undefined) depth = 0;
  if (visited === undefined) visited = new Set();
  const results = [];
  if (depth > 100 || visited.has(dir)) return results;
  visited.add(dir);
  let entries;
  try { entries = FS.readdir(dir); } catch { return results; }
  for (const entry of entries) {
    if (entry === "." || entry === "..") continue;
    const fullPath = dir === "/" ? "/" + entry : dir + "/" + entry;
    try {
      const stat = FS.stat(fullPath);
      if (stat.isDirectory) {
        results.push.apply(results, walkMemfs(FS, fullPath, depth + 1, visited));
      } else {
        results.push(fullPath);
      }
    } catch {}
  }
  return results;
}

// ─── Init ───────────────────────────────────────────────────
async function initPyodide(requestId) {
  if (pyodide) {
    sendMsg({ type: "ready", requestId });
    return;
  }
  if (loadError) {
    sendMsg({ type: "error", requestId, message: loadError });
    return;
  }
  if (loading) {
    // Await existing load via deferred promise instead of polling
    try {
      await _loadPromise;
      if (pyodide) sendMsg({ type: "ready", requestId });
      else sendMsg({ type: "error", requestId, message: loadError || "Unknown load error" });
    } catch {
      sendMsg({ type: "error", requestId, message: loadError || "Unknown load error" });
    }
    return;
  }

  loading = true;
  _loadPromise = new Promise((resolve, reject) => {
    _loadResolve = resolve;
    _loadReject = reject;
  });

  try {
    const PYODIDE_MJS = "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs";
    const mod = await import(PYODIDE_MJS);
    pyodide = await mod.loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/",
    });
    loading = false;
    _loadResolve();
    sendMsg({ type: "ready", requestId });
  } catch (err) {
    loading = false;
    loadError = String(err.message || err);
    _loadReject(new Error(loadError));
    sendMsg({ type: "error", requestId, message: loadError });
  }
}

// ─── Sync Files to MEMFS ───────────────────────────────────
function syncFilesToMemfs(files) {
  if (!pyodide) return;
  const FS = pyodide.FS;
  for (const [path, content] of Object.entries(files)) {
    ensureParentDirs(FS, path);
    FS.writeFile(path, content, { encoding: "utf8" });
  }
}

// ─── Sync Files from MEMFS ──────────────────────────────────
function syncFilesFromMemfs(knownPaths) {
  if (!pyodide) return {};
  const FS = pyodide.FS;
  const changed = {};

  // Check known paths
  for (const path of knownPaths) {
    try {
      const content = FS.readFile(path, { encoding: "utf8" });
      if (typeof content === "string") {
        changed[path] = content;
      }
    } catch {}
  }

  // Discover new files
  try {
    const memfsFiles = walkMemfs(FS, "/");
    const knownSet = new Set(knownPaths);
    for (const filePath of memfsFiles) {
      if (!knownSet.has(filePath)) {
        try {
          const content = FS.readFile(filePath, { encoding: "utf8" });
          if (typeof content === "string") {
            changed[filePath] = content;
          }
        } catch {}
      }
    }
  } catch {}

  return changed;
}

// ─── Run Python ─────────────────────────────────────────────
async function runPython(requestId, code, vfsSnapshot, knownPaths) {
  if (!pyodide) {
    sendMsg({ type: "error", requestId, message: "Pyodide not initialized" });
    return;
  }

  // Sync VFS → MEMFS
  if (vfsSnapshot) {
    syncFilesToMemfs(vfsSnapshot);
  }

  const stdoutBuffer = [];
  const stderrBuffer = [];

  pyodide.setStdout({ batched: (text) => stdoutBuffer.push(text) });
  pyodide.setStderr({ batched: (text) => stderrBuffer.push(text) });
  pyodide.setStdin({ error: true });

  let exitCode = 0;

  try {
    await pyodide.runPythonAsync(code);
  } catch (err) {
    stderrBuffer.push(err instanceof Error ? err.message : String(err));
    exitCode = 1;
  }

  // Sync MEMFS → VFS
  const changedFiles = syncFilesFromMemfs(knownPaths || []);

  sendMsg({
    type: "result",
    requestId,
    stdout: stdoutBuffer.join("\\n"),
    stderr: stderrBuffer.join("\\n"),
    exitCode,
    changedFiles,
  });
}

// ─── Install Package ────────────────────────────────────────
async function installPackage(requestId, name) {
  if (!pyodide) {
    sendMsg({ type: "error", requestId, message: "Pyodide not initialized" });
    return;
  }

  try {
    await pyodide.loadPackage(name);
    sendMsg({ type: "result", requestId, message: "Success: Package '" + name + "' installed." });
  } catch (err) {
    // Fallback to micropip
    try {
      await pyodide.runPythonAsync(
        'import micropip\\nawait micropip.install("' + name + '")'
      );
      sendMsg({ type: "result", requestId, message: "Success: Package '" + name + "' installed via micropip." });
    } catch (err2) {
      sendMsg({
        type: "result",
        requestId,
        message: "Error: Failed to install '" + name + "': " + (err2.message || err2),
      });
    }
  }
}

// ─── Incremental Sync Files ─────────────────────────────────
function handleSyncFiles(requestId, added, deleted) {
  if (!pyodide) {
    sendMsg({ type: "error", requestId, message: "Pyodide not initialized" });
    return;
  }
  const FS = pyodide.FS;
  let applied = 0;
  let errors = 0;

  if (added) {
    for (const [path, content] of Object.entries(added)) {
      try {
        ensureParentDirs(FS, path);
        FS.writeFile(path, content, { encoding: "utf8" });
        applied++;
      } catch (err) {
        errors++;
      }
    }
  }

  if (deleted) {
    for (const path of deleted) {
      try {
        FS.unlink(path);
        applied++;
      } catch (err) {
        errors++;
      }
    }
  }

  sendMsg({ type: "result", requestId, message: "Synced " + applied + " files (" + errors + " errors)" });
}

// ─── Message Handler ────────────────────────────────────────
self.onmessage = async (e) => {
  const msg = e.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case "init":
      await initPyodide(msg.requestId);
      break;
    case "runPython":
      await runPython(msg.requestId, msg.code, msg.vfsSnapshot, msg.knownPaths);
      break;
    case "installPackage":
      await installPackage(msg.requestId, msg.name);
      break;
    case "syncFiles":
      handleSyncFiles(msg.requestId, msg.added, msg.deleted);
      break;
    case "terminate":
      self.close();
      break;
    default:
      sendMsg({ type: "error", message: "Unknown message type: " + msg.type });
  }
};

`;

/**
 * Virtual File System — in-memory file storage with IndexedDB persistence.
 *
 * All paths are absolute (root = "/"). Directories are implicit — created
 * automatically when a file is written inside them.
 *
 * PROJECT_ROOT ("/home/user") mirrors the POSIX home directory used by
 * BrowserPod and standard Linux environments. All project files should
 * live under this path for runtime compatibility.
 */
// ─── Constants ──────────────────────────────────────────────
/** Project working directory — mirrors BrowserPod's default cwd. */
export const PROJECT_ROOT = "/home/user";
// ─── State ──────────────────────────────────────────────────
const _entries = new Map();
// Ensure root and project directories exist
const _initNow = Date.now();
for (const dir of ["/", "/home", PROJECT_ROOT]) {
    _entries.set(dir, {
        path: dir,
        content: "",
        type: "dir",
        createdAt: _initNow,
        modifiedAt: _initNow,
    });
}
// ─── Helpers ────────────────────────────────────────────────
function normalize(path) {
    // Collapse slashes, resolve ".." and "."
    const parts = path.replace(/\/+/g, "/").split("/").filter(Boolean);
    const resolved = [];
    for (const p of parts) {
        if (p === ".")
            continue;
        if (p === "..") {
            resolved.pop();
            continue;
        }
        resolved.push(p);
    }
    return "/" + resolved.join("/");
}
function parentDir(path) {
    const norm = normalize(path);
    if (norm === "/")
        return "/";
    const parts = norm.split("/").filter(Boolean);
    parts.pop();
    return "/" + parts.join("/") || "/";
}
function basename(path) {
    const norm = normalize(path);
    if (norm === "/")
        return "/";
    return norm.split("/").filter(Boolean).pop() ?? "";
}
function isDescendantOf(path, dir) {
    const p = normalize(path) + "/";
    const d = normalize(dir) === "/" ? "/" : normalize(dir) + "/";
    return p.startsWith(d);
}
function ensureDir(path, now) {
    const parent = parentDir(path);
    if (parent !== "/" && !_entries.has(parent)) {
        ensureDir(parent, now);
    }
    if (!_entries.has(path)) {
        _entries.set(path, {
            path,
            content: "",
            type: "dir",
            createdAt: now,
            modifiedAt: now,
        });
    }
}
// ─── API ────────────────────────────────────────────────────
/** Check if a path exists. */
export function vfsExists(path) {
    return _entries.has(normalize(path));
}
/** Get metadata for a path. Returns null if not found. */
export function vfsStat(path) {
    return _entries.get(normalize(path)) ?? null;
}
/** Read a file. Returns null if not found or is a directory. */
export function vfsRead(path) {
    const entry = _entries.get(normalize(path));
    if (!entry || entry.type === "dir")
        return null;
    return entry.content;
}
/** Write (or overwrite) a file. Creates parent directories implicitly. */
export function vfsWrite(path, content) {
    const npath = normalize(path);
    const now = Date.now();
    // Strip UTF-8 BOM and zero-width characters that LLMs may inject,
    // but preserve intentional leading whitespace (indentation).
    const sanitized = typeof content === "string" ? content.replace(/^[\uFEFF\u200B\u200C\u200D\u2060]+/, "") : content;
    // Ensure parent directory chain exists
    ensureDir(parentDir(npath), now);
    _entries.set(npath, {
        path: npath,
        content: sanitized,
        type: "file",
        createdAt: _entries.get(npath)?.createdAt ?? now,
        modifiedAt: now,
    });
    notifyVfsChange({ type: "write", path: npath });
}
/** Create a directory (no-op if already exists). */
export function vfsMkdir(path) {
    const npath = normalize(path);
    if (_entries.has(npath))
        return;
    const now = Date.now();
    ensureDir(parentDir(npath), now);
    _entries.set(npath, {
        path: npath,
        content: "",
        type: "dir",
        createdAt: now,
        modifiedAt: now,
    });
}
/** Recursively delete a path (file or directory tree). */
export function vfsDeleteTree(path) {
    const npath = normalize(path);
    if (npath === "/" || npath === PROJECT_ROOT)
        return false;
    if (!_entries.has(npath))
        return false;
    for (const p of _entries.keys()) {
        if (p === npath || isDescendantOf(p, npath)) {
            _entries.delete(p);
        }
    }
    notifyVfsChange({ type: "delete", path: npath });
    return true;
}
/** Build a nested tree structure for the file explorer. */
export function vfsTree(dir = PROJECT_ROOT) {
    const ndir = normalize(dir) === "/" ? "/" : normalize(dir) + "/";
    const nodes = [];
    for (const p of _entries.keys()) {
        if (!p.startsWith(ndir) || p === ndir)
            continue;
        const rest = p.slice(ndir.length);
        const parts = rest.split("/");
        const name = parts[0];
        const isDir = _entries.get(p)?.type === "dir";
        const directChild = parts.length === 1;
        if (directChild) {
            nodes.push({
                name,
                path: p,
                type: isDir ? "dir" : "file",
                children: isDir ? vfsTree(p) : undefined,
            });
        }
    }
    return nodes.sort((a, b) => {
        // Directories first, then alphabetical
        if (a.type !== b.type)
            return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}
/** Rename / move a file or directory. */
export function vfsRename(oldPath, newPath) {
    const nold = normalize(oldPath);
    const nnew = normalize(newPath);
    if (nold === "/" || nold === PROJECT_ROOT || !_entries.has(nold))
        return false;
    if (_entries.has(nnew))
        return false; // target exists
    // Destination parent directory must exist
    if (!_entries.has(parentDir(nnew)))
        return false;
    const entry = _entries.get(nold);
    const now = Date.now();
    const isDir = entry.type === "dir";
    if (isDir) {
        // Move all descendants
        const toMove = [];
        for (const p of _entries.keys()) {
            if (p === nold || isDescendantOf(p, nold)) {
                const rel = p.slice(nold.length);
                toMove.push([p, nnew + rel]);
            }
        }
        for (const [old, nw] of toMove) {
            const e = _entries.get(old);
            _entries.set(nw, { ...e, path: nw, modifiedAt: now });
            _entries.delete(old);
        }
    }
    else {
        _entries.set(nnew, { ...entry, path: nnew, modifiedAt: now });
        _entries.delete(nold);
    }
    notifyVfsChange({ type: "rename", path: nold, newPath: nnew });
    return true;
}
/** Get all entries (for persistence / sync). */
export function vfsGetAll() {
    return [..._entries.values()];
}
/** Load entries into the VFS (replaces all). */
export function vfsLoadAll(entries) {
    _entries.clear();
    for (const e of entries) {
        _entries.set(e.path, e);
    }
    // Ensure root and project directories exist
    const now = Date.now();
    for (const dir of ["/", "/home", PROJECT_ROOT]) {
        if (!_entries.has(dir)) {
            _entries.set(dir, {
                path: dir,
                content: "",
                type: "dir",
                createdAt: now,
                modifiedAt: now,
            });
        }
    }
}
/** Snapshot all file contents as a flat record (for Pyodide sync). */
export function vfsSnapshot() {
    const snap = {};
    for (const [path, entry] of _entries) {
        if (entry.type === "file") {
            snap[path] = entry.content;
        }
    }
    return snap;
}
/** Check if the VFS is empty (only system directories, no project files). */
export function vfsIsEmpty() {
    // Empty means only /, /home, /home/user exist (3 system dirs)
    if (_entries.size > 3)
        return false;
    return _entries.has("/") && _entries.has("/home") && _entries.has(PROJECT_ROOT);
}
const _vfsChangeListeners = [];
/** Subscribe to VFS mutation events. Returns an unsubscribe function. */
export function onVfsChange(listener) {
    _vfsChangeListeners.push(listener);
    return () => {
        const idx = _vfsChangeListeners.indexOf(listener);
        if (idx >= 0)
            _vfsChangeListeners.splice(idx, 1);
    };
}
function notifyVfsChange(event) {
    for (const listener of _vfsChangeListeners) {
        try {
            listener(event);
        }
        catch {
            // Listener error must not break VFS operations
        }
    }
}

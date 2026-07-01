/**
 * Virtual File System — in-memory file storage with IndexedDB persistence.
 *
 * All paths are absolute (root = "/"). Directories are implicit — created
 * automatically when a file is written inside them.
 *
 * Future: snapshot() API for Pyodide MEMFS sync (Phase 6).
 */

// ─── Types ──────────────────────────────────────────────────
export interface VfsEntry {
  path: string;
  content: string;
  type: "file" | "dir";
  createdAt: number;
  modifiedAt: number;
}

export interface VfsTreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: VfsTreeNode[];
}

// ─── State ──────────────────────────────────────────────────
const _entries = new Map<string, VfsEntry>();

// Ensure the root directory exists
_entries.set("/", {
  path: "/",
  content: "",
  type: "dir",
  createdAt: Date.now(),
  modifiedAt: Date.now(),
});

// ─── Helpers ────────────────────────────────────────────────
function normalize(path: string): string {
  // Collapse slashes, resolve ".." and "."
  const parts = path.replace(/\/+/g, "/").split("/").filter(Boolean);
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") { resolved.pop(); continue; }
    resolved.push(p);
  }
  return "/" + resolved.join("/");
}

function parentDir(path: string): string {
  const norm = normalize(path);
  if (norm === "/") return "/";
  const parts = norm.split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/") || "/";
}

function basename(path: string): string {
  const norm = normalize(path);
  if (norm === "/") return "/";
  return norm.split("/").filter(Boolean).pop() ?? "";
}

function isDescendantOf(path: string, dir: string): boolean {
  const p = normalize(path) + "/";
  const d = normalize(dir) === "/" ? "/" : normalize(dir) + "/";
  return p.startsWith(d);
}

function ensureDir(path: string, now: number): void {
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
export function vfsExists(path: string): boolean {
  return _entries.has(normalize(path));
}

/** Get metadata for a path. Returns null if not found. */
export function vfsStat(path: string): VfsEntry | null {
  return _entries.get(normalize(path)) ?? null;
}

/** Read a file. Returns null if not found or is a directory. */
export function vfsRead(path: string): string | null {
  const entry = _entries.get(normalize(path));
  if (!entry || entry.type === "dir") return null;
  return entry.content;
}

/** Write (or overwrite) a file. Creates parent directories implicitly. */
export function vfsWrite(path: string, content: string): void {
  const npath = normalize(path);
  const now = Date.now();

  // Ensure parent directory chain exists
  ensureDir(parentDir(npath), now);

  _entries.set(npath, {
    path: npath,
    content,
    type: "file",
    createdAt: _entries.get(npath)?.createdAt ?? now,
    modifiedAt: now,
  });
}

/** Create a directory (no-op if already exists). */
export function vfsMkdir(path: string): void {
  const npath = normalize(path);
  if (_entries.has(npath)) return;
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
export function vfsDeleteTree(path: string): boolean {
  const npath = normalize(path);
  if (npath === "/") return false;
  if (!_entries.has(npath)) return false;

  for (const p of _entries.keys()) {
    if (p === npath || isDescendantOf(p, npath)) {
      _entries.delete(p);
    }
  }
  return true;
}

/** Build a nested tree structure for the file explorer. */
export function vfsTree(dir = "/"): VfsTreeNode[] {
  const ndir = normalize(dir) === "/" ? "/" : normalize(dir) + "/";
  const nodes: VfsTreeNode[] = [];

  for (const p of _entries.keys()) {
    if (!p.startsWith(ndir) || p === ndir) continue;

    const rest = p.slice(ndir.length);
    const parts = rest.split("/");
    const name = parts[0]!;
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
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Rename / move a file or directory. */
export function vfsRename(oldPath: string, newPath: string): boolean {
  const nold = normalize(oldPath);
  const nnew = normalize(newPath);
  if (nold === "/" || !_entries.has(nold)) return false;
  if (_entries.has(nnew)) return false; // target exists
  // Destination parent directory must exist
  if (!_entries.has(parentDir(nnew))) return false;

  const entry = _entries.get(nold)!;
  const now = Date.now();
  const isDir = entry.type === "dir";

  if (isDir) {
    // Move all descendants
    const toMove: [string, string][] = [];
    for (const p of _entries.keys()) {
      if (p === nold || isDescendantOf(p, nold)) {
        const rel = p.slice(nold.length);
        toMove.push([p, nnew + rel]);
      }
    }
    for (const [old, nw] of toMove) {
      const e = _entries.get(old)!;
      _entries.set(nw, { ...e, path: nw, modifiedAt: now });
      _entries.delete(old);
    }
  } else {
    _entries.set(nnew, { ...entry, path: nnew, modifiedAt: now });
    _entries.delete(nold);
  }
  return true;
}

/** Get all entries (for persistence / sync). */
export function vfsGetAll(): VfsEntry[] {
  return [..._entries.values()];
}

/** Load entries into the VFS (replaces all). */
export function vfsLoadAll(entries: VfsEntry[]): void {
  _entries.clear();
  for (const e of entries) {
    _entries.set(e.path, e);
  }
  // Ensure root exists
  if (!_entries.has("/")) {
    _entries.set("/", {
      path: "/",
      content: "",
      type: "dir",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    });
  }
}

/** Snapshot all file contents as a flat record (for Pyodide sync). */
export function vfsSnapshot(): Record<string, string> {
  const snap: Record<string, string> = {};
  for (const [path, entry] of _entries) {
    if (entry.type === "file") {
      snap[path] = entry.content;
    }
  }
  return snap;
}

/** Check if the VFS is empty (only root). */
export function vfsIsEmpty(): boolean {
  return _entries.size <= 1 && _entries.has("/");
}

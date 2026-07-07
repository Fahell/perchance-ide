/**
 * VFS Events — tracked mutations with hash-based change detection.
 *
 * Wraps vfsWrite / vfsDeleteTree / vfsRename to:
 * 1. Compute FNV-1a hash of file content after mutation
 * 2. Compare with previous hash to determine event type
 * 3. Emit structured events to registered listeners
 *
 * This module is the single source of truth for "what changed in the VFS".
 * Consumers (mapper, preview, future features) subscribe to events
 * instead of polling or hooking into scattered call sites.
 */
import { vfsWrite as _vfsWrite, vfsDeleteTree as _vfsDeleteTree, vfsRename as _vfsRename, vfsGetAll, } from "./vfs.js";
// ─── FNV-1a 32-bit Hash ─────────────────────────────────────
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
/**
 * Compute FNV-1a 32-bit hash of a string.
 * Non-cryptographic, ~5μs per 10KB — sufficient for change detection.
 */
export function fnv1a(str) {
    let h = FNV_OFFSET;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, FNV_PRIME);
    }
    // Convert to unsigned 32-bit hex string
    return (h >>> 0).toString(16).padStart(8, "0");
}
// ─── Hash Table (in-memory) ─────────────────────────────────
const _hashes = new Map();
/** Get the current hash for a file path, or undefined if not tracked. */
export function getHash(path) {
    return _hashes.get(path)?.hash;
}
/** Get full hash entry metadata. */
export function getHashEntry(path) {
    return _hashes.get(path);
}
/** Get all tracked hashes (for persistence / debugging). */
export function getAllHashes() {
    const result = {};
    for (const [path, entry] of _hashes) {
        result[path] = { ...entry };
    }
    return result;
}
// ─── Event Emitter ──────────────────────────────────────────
const _listeners = new Set();
/** Register a listener for VFS change events. Returns unsubscribe function. */
export function onVfsChange(listener) {
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
}
function emit(event) {
    for (const listener of _listeners) {
        try {
            listener(event);
        }
        catch (e) {
            console.warn("[VfsEvents] Listener error:", e);
        }
    }
}
// ─── Tracked Mutations ──────────────────────────────────────
/**
 * Write a file with change tracking.
 * Computes hash before and after to determine created vs modified.
 */
export function trackedWrite(path, content) {
    const prevEntry = _hashes.get(path);
    const prevHash = prevEntry?.hash;
    _vfsWrite(path, content);
    const newHash = fnv1a(content);
    const now = Date.now();
    _hashes.set(path, { hash: newHash, updatedAt: now, size: content.length });
    const eventType = prevHash === undefined ? "created" : "modified";
    // Skip emitting if content didn't actually change
    if (eventType === "modified" && prevHash === newHash) {
        // Still update timestamp but don't emit
        return { type: "modified", path, previousHash: prevHash, currentHash: newHash, size: content.length, timestamp: now };
    }
    const event = {
        type: eventType,
        path,
        previousHash: prevHash,
        currentHash: newHash,
        size: content.length,
        timestamp: now,
    };
    emit(event);
    return event;
}
/**
 * Delete a file or directory tree with change tracking.
 * Emits delete events for all affected files.
 */
export function trackedDelete(path) {
    const events = [];
    const now = Date.now();
    // Collect all affected paths before deletion
    const affectedPaths = [];
    for (const p of _hashes.keys()) {
        if (p === path || p.startsWith(path + "/")) {
            affectedPaths.push(p);
        }
    }
    const deleted = _vfsDeleteTree(path);
    if (!deleted)
        return events;
    for (const p of affectedPaths) {
        const prevEntry = _hashes.get(p);
        _hashes.delete(p);
        const event = {
            type: "deleted",
            path: p,
            previousHash: prevEntry?.hash,
            timestamp: now,
        };
        events.push(event);
        emit(event);
    }
    return events;
}
/**
 * Rename/move a file or directory with change tracking.
 * Emits rename events for all affected files.
 */
export function trackedRename(oldPath, newPath) {
    const events = [];
    const now = Date.now();
    // Collect all affected entries before rename
    const affectedEntries = [];
    for (const [p, entry] of _hashes) {
        if (p === oldPath) {
            affectedEntries.push({ oldP: p, newP: newPath, entry: { ...entry } });
        }
        else if (p.startsWith(oldPath + "/")) {
            const rel = p.slice(oldPath.length);
            affectedEntries.push({ oldP: p, newP: newPath + rel, entry: { ...entry } });
        }
    }
    const success = _vfsRename(oldPath, newPath);
    if (!success)
        return events;
    for (const { oldP, newP, entry } of affectedEntries) {
        _hashes.delete(oldP);
        _hashes.set(newP, { ...entry, updatedAt: now });
        const event = {
            type: "renamed",
            path: newP,
            fromPath: oldP,
            toPath: newP,
            currentHash: entry.hash,
            size: entry.size,
            timestamp: now,
        };
        events.push(event);
        emit(event);
    }
    return events;
}
// ─── Initialization ─────────────────────────────────────────
/**
 * Initialize hash table from current VFS state.
 * Call this after vfsLoadAll() to populate hashes without emitting events.
 */
export function initHashes() {
    _hashes.clear();
    const entries = vfsGetAll();
    for (const entry of entries) {
        if (entry.type === "file") {
            _hashes.set(entry.path, {
                hash: fnv1a(entry.content),
                updatedAt: entry.modifiedAt,
                size: entry.content.length,
            });
        }
    }
    console.log(`[VfsEvents] Initialized ${_hashes.size} file hashes`);
}

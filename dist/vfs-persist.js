/**
 * VFS Persistence — centralized debounced persistence to IndexedDB.
 *
 * Replaces all scattered dbSaveVfs() calls across the codebase with a
 * single scheduleVfsPersist() / flushVfsPersist() API.
 *
 * - scheduleVfsPersist(): Debounced (dynamic, default 2000ms). Use for auto-save and tool writes.
 * - flushVfsPersist(): Immediate. Use for Ctrl+S, unmount, critical saves.
 *
 * Supports incremental persist: only dirty paths are written to IndexedDB,
 * reducing write amplification. Falls back to full persist when dirty tracking
 * is empty (e.g., after full VFS load).
 */
import { dbSaveSingleFile, dbSaveVfs, getDb } from "./db.js";
import { vfsGetAll, vfsStat } from "./vfs.js";
// ─── State ──────────────────────────────────────────────────
let _persistTimer = null;
let _pendingFlush = null;
let _persisting = false;
/** Current debounce interval. Can be changed dynamically via setDebounceMs(). */
let _debounceMs = 2000;
/** Paths modified or created since last persist. */
let _dirtyPaths = new Set();
/** Paths deleted since last persist (need removal from IndexedDB). */
let _tombstonePaths = new Set();
// ─── API ────────────────────────────────────────────────────
/**
 * Schedule a debounced VFS persist to IndexedDB.
 * Resets the timer if called again before the previous timer fires.
 * Safe to call from any context (tools, editor, UI).
 */
export function scheduleVfsPersist() {
    if (_persistTimer !== null) {
        clearTimeout(_persistTimer);
    }
    _persistTimer = setTimeout(() => {
        _persistTimer = null;
        _doPersist().catch((e) => console.warn("[VfsPersist] Scheduled persist failed:", e));
    }, _debounceMs);
}
/**
 * Immediately persist VFS to IndexedDB, bypassing debounce.
 * Cancels any pending scheduled persist.
 * Returns a promise that resolves when the write completes.
 */
export async function flushVfsPersist() {
    // Cancel any pending debounced persist
    if (_persistTimer !== null) {
        clearTimeout(_persistTimer);
        _persistTimer = null;
    }
    // Avoid concurrent flushes
    if (_pendingFlush)
        return _pendingFlush;
    _pendingFlush = _doPersist().finally(() => {
        _pendingFlush = null;
    });
    return _pendingFlush;
}
/**
 * Cancel any pending scheduled persist without flushing.
 * Useful during cleanup or when persistence is no longer needed.
 */
export function cancelScheduledPersist() {
    if (_persistTimer !== null) {
        clearTimeout(_persistTimer);
        _persistTimer = null;
    }
}
/**
 * Get the current debounce interval in milliseconds.
 */
export function getDebounceMs() {
    return _debounceMs;
}
/**
 * Dynamically change the debounce interval.
 * Does not reset a pending timer — next schedule uses the new value.
 */
export function setDebounceMs(ms) {
    _debounceMs = ms;
}
// ─── Dirty Path Tracking ────────────────────────────────────
/**
 * Mark a path as dirty (modified or created) since last persist.
 * Called from vfs-events.ts — trackedWrite / trackedDelete / trackedRename.
 */
export function markDirty(path) {
    _dirtyPaths.add(path);
    _tombstonePaths.delete(path);
}
/**
 * Mark a path as deleted since last persist.
 * The associated IndexedDB entry will be removed on next persist.
 */
export function markDeleted(path) {
    _tombstonePaths.add(path);
    _dirtyPaths.delete(path);
}
/**
 * Mark a path rename: the old path is deleted, the new path is dirty.
 */
export function markRenamed(oldPath, newPath) {
    markDeleted(oldPath);
    markDirty(newPath);
}
/**
 * Force the next persist to be a full save (clear + add all).
 * Useful after bulk operations or when incremental state is uncertain.
 */
export function markAllDirty() {
    _dirtyPaths.clear();
    _tombstonePaths.clear();
}
/**
 * Get count of dirty + tombstone paths (for UI status).
 */
export function getDirtyCount() {
    return { dirty: _dirtyPaths.size, deleted: _tombstonePaths.size };
}
// ─── Internal ───────────────────────────────────────────────
async function _doPersist() {
    // Guard against concurrent persists
    if (_persisting) {
        console.debug("[VfsPersist] Already persisting, skipping");
        return;
    }
    _persisting = true;
    try {
        const hasIncremental = _dirtyPaths.size > 0 || _tombstonePaths.size > 0;
        if (!hasIncremental) {
            // No dirty paths — full persist (initial load, or everything clean)
            await dbSaveVfs(vfsGetAll());
        }
        else {
            // Incremental persist: only write dirty paths, remove tombstones
            const allEntries = vfsGetAll();
            const entryMap = new Map();
            for (const entry of allEntries) {
                entryMap.set(entry.path, true);
            }
            // Write each dirty path (if it still exists in VFS)
            for (const path of _dirtyPaths) {
                if (entryMap.has(path)) {
                    const entry = vfsStat(path);
                    if (entry !== null && entry.type === "file") {
                        await dbSaveSingleFile(entry);
                    }
                }
            }
            // Remove each tombstone path from IndexedDB
            if (_tombstonePaths.size > 0) {
                const db = await getDb();
                const tx = db.transaction("files", "readwrite");
                for (const path of _tombstonePaths) {
                    await tx.store.delete(path);
                }
                await tx.done;
            }
        }
    }
    catch (e) {
        console.warn("[VfsPersist] Persist failed:", e);
        throw e;
    }
    finally {
        _dirtyPaths.clear();
        _tombstonePaths.clear();
        _persisting = false;
    }
}

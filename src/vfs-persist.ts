/**
 * VFS Persistence — centralized debounced persistence to IndexedDB.
 *
 * Replaces all scattered dbSaveVfs() calls across the codebase with a
 * single scheduleVfsPersist() / flushVfsPersist() API.
 *
 * - scheduleVfsPersist(): Debounced (2000ms). Use for auto-save and tool writes.
 * - flushVfsPersist(): Immediate. Use for Ctrl+S, unmount, critical saves.
 */

import { dbSaveVfs } from "./db.js";
import { vfsGetAll } from "./vfs.js";

// ─── State ──────────────────────────────────────────────────

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingFlush: Promise<void> | null = null;

const DEBOUNCE_MS = 2000;

// ─── API ────────────────────────────────────────────────────

/**
 * Schedule a debounced VFS persist to IndexedDB.
 * Resets the timer if called again before the previous timer fires.
 * Safe to call from any context (tools, editor, UI).
 */
export function scheduleVfsPersist(): void {
  if (_persistTimer !== null) {
    clearTimeout(_persistTimer);
  }
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    _doPersist().catch((e) =>
      console.warn("[VfsPersist] Scheduled persist failed:", e)
    );
  }, DEBOUNCE_MS);
}

/**
 * Immediately persist VFS to IndexedDB, bypassing debounce.
 * Cancels any pending scheduled persist.
 * Returns a promise that resolves when the write completes.
 */
export async function flushVfsPersist(): Promise<void> {
  // Cancel any pending debounced persist
  if (_persistTimer !== null) {
    clearTimeout(_persistTimer);
    _persistTimer = null;
  }

  // Avoid concurrent flushes
  if (_pendingFlush) return _pendingFlush;

  _pendingFlush = _doPersist().finally(() => {
    _pendingFlush = null;
  });

  return _pendingFlush;
}

/**
 * Cancel any pending scheduled persist without flushing.
 * Useful during cleanup or when persistence is no longer needed.
 */
export function cancelScheduledPersist(): void {
  if (_persistTimer !== null) {
    clearTimeout(_persistTimer);
    _persistTimer = null;
  }
}

// ─── Internal ───────────────────────────────────────────────

async function _doPersist(): Promise<void> {
  try {
    await dbSaveVfs(vfsGetAll());
  } catch (e) {
    console.warn("[VfsPersist] dbSaveVfs failed:", e);
    throw e;
  }
}

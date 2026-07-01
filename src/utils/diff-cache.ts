/**
 * Module-level diff cache for before/after content.
 *
 * Stores the old and new content of files modified by write_file,
 * keyed by file path. Used by ToolCallCard to render DiffView.
 *
 * Max 50 entries to prevent memory leaks in long sessions.
 * Oldest entries are evicted when limit is exceeded.
 */

const MAX_ENTRIES = 50;

interface DiffEntry {
  before: string;
  after: string;
}

const _cache = new Map<string, DiffEntry>();
const _order: string[] = [];

export function setDiff(path: string, before: string, after: string): void {
  // Evict oldest if at capacity
  if (_cache.size >= MAX_ENTRIES && !_cache.has(path)) {
    const oldest = _order.shift();
    if (oldest) _cache.delete(oldest);
  }
  _cache.set(path, { before, after });
  // Track insertion order
  if (!_order.includes(path)) {
    _order.push(path);
  }
}

export function getDiff(path: string): DiffEntry | undefined {
  return _cache.get(path);
}

export function clearDiff(path: string): void {
  _cache.delete(path);
  const idx = _order.indexOf(path);
  if (idx !== -1) _order.splice(idx, 1);
}

export function clearAllDiffs(): void {
  _cache.clear();
  _order.length = 0;
}

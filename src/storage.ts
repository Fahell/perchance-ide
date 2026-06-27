/**
 * Persistent storage layer using oc.thread.customData (Perchance native API).
 *
 * localStorage and IndexedDB are BLOCKED in Perchance sandboxed iframes.
 * oc.thread.customData persists via the parent frame's IndexedDB.
 *
 * Limitation: ~1-2KB recommended. Use prefix conventions:
 *   "agent:key" -> API keys, "agent:state" -> runtime state, etc.
 */

import type { Oc } from "./types.js";

let _oc: Oc | null = null;

/** Must be called once after oc is available (in bootstrap). */
export function initStorage(oc: Oc): void {
  _oc = oc;
}

function getData(): Record<string, unknown> {
  if (!_oc?.thread?.customData) return {};
  return _oc.thread.customData as Record<string, unknown>;
}

// --- API ---

export function storageGet<T = unknown>(key: string): T | undefined {
  try {
    const data = getData();
    return (data[key] as T) ?? undefined;
  } catch (e) {
    console.warn('[Storage] get(' + key + ') failed:', e);
    return undefined;
  }
}

export function storageSet<T = unknown>(key: string, value: T): void {
  try {
    if (!_oc?.thread?.customData) {
      console.warn('[Storage] set: oc.thread.customData not available');
      return;
    }
    (_oc.thread.customData as Record<string, unknown>)[key] = value;
  } catch (e) {
    console.warn('[Storage] set(' + key + ') failed:', e);
  }
}

export function storageDel(key: string): void {
  try {
    const data = getData();
    delete data[key];
  } catch (e) {
    console.warn('[Storage] del(' + key + ') failed:', e);
  }
}

export function storageHas(key: string): boolean {
  return storageGet(key) !== undefined;
}

export function storageKeys(): string[] {
  try {
    return Object.keys(getData());
  } catch {
    return [];
  }
}

export function storageClear(): void {
  try {
    const data = getData();
    for (const key of Object.keys(data)) {
      delete data[key];
    }
  } catch (e) {
    console.warn('[Storage] clear() failed:', e);
  }
}

/**
 * Persistent storage layer using localStorage.
 *
 * In standalone Perchance generators (HTML panel), localStorage is available.
 * Keys use "agent:" prefix to avoid collisions.
 */

// --- Internal Helpers ---

function getData(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem("agent:storage");
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function setData(data: Record<string, unknown>): void {
  try {
    localStorage.setItem("agent:storage", JSON.stringify(data));
  } catch (e) {
    console.warn('[Storage] set failed:', e);
  }
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
    const data = getData();
    data[key] = value;
    setData(data);
  } catch (e) {
    console.warn('[Storage] set(' + key + ') failed:', e);
  }
}

export function storageDel(key: string): void {
  try {
    const data = getData();
    delete data[key];
    setData(data);
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

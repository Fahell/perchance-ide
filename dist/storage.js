/**
 * Persistent storage layer using localStorage.
 *
 * Each key is stored as an individual localStorage entry with the prefix
 * "agent:k:" to avoid collisions and enable O(1) per-key operations.
 *
 * Legacy migration: on first access, if the old single-blob key
 * "agent:storage" exists, its contents are migrated to individual keys
 * and the legacy entry is removed. This runs at most once.
 */
const KEY_PREFIX = "agent:k:";
const LEGACY_KEY = "agent:storage";
// --- Migration ---
let _migrated = false;
function migrateIfNeeded() {
    if (_migrated)
        return;
    _migrated = true;
    try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (!raw)
            return;
        const data = JSON.parse(raw);
        if (data && typeof data === "object") {
            for (const [k, v] of Object.entries(data)) {
                try {
                    localStorage.setItem(KEY_PREFIX + k, JSON.stringify(v));
                }
                catch (e) {
                    console.warn("[Storage] migration write failed for key:", k, e);
                }
            }
        }
        localStorage.removeItem(LEGACY_KEY);
    }
    catch (e) {
        console.warn("[Storage] legacy migration failed:", e);
    }
}
// --- Internal Helpers ---
function prefixedKey(key) {
    return KEY_PREFIX + key;
}
// --- API ---
export function storageGet(key) {
    try {
        migrateIfNeeded();
        const raw = localStorage.getItem(prefixedKey(key));
        if (raw === null)
            return undefined;
        return JSON.parse(raw);
    }
    catch (e) {
        console.warn("[Storage] get(" + key + ") failed:", e);
        return undefined;
    }
}
export function storageSet(key, value) {
    try {
        migrateIfNeeded();
        localStorage.setItem(prefixedKey(key), JSON.stringify(value));
    }
    catch (e) {
        console.warn("[Storage] set(" + key + ") failed:", e);
    }
}
export function storageDel(key) {
    try {
        migrateIfNeeded();
        localStorage.removeItem(prefixedKey(key));
    }
    catch (e) {
        console.warn("[Storage] del(" + key + ") failed:", e);
    }
}
export function storageHas(key) {
    try {
        migrateIfNeeded();
        return localStorage.getItem(prefixedKey(key)) !== null;
    }
    catch {
        return false;
    }
}
export function storageKeys() {
    try {
        migrateIfNeeded();
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k !== null && k.startsWith(KEY_PREFIX)) {
                keys.push(k.slice(KEY_PREFIX.length));
            }
        }
        return keys;
    }
    catch {
        return [];
    }
}
export function storageClear() {
    try {
        migrateIfNeeded();
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k !== null && k.startsWith(KEY_PREFIX)) {
                keysToRemove.push(k);
            }
        }
        for (const k of keysToRemove) {
            localStorage.removeItem(k);
        }
    }
    catch (e) {
        console.warn("[Storage] clear() failed:", e);
    }
}

/**
 * IndexedDB persistence layer via idb v8.
 *
 * Provides specialized stores for:
 * - `messages` — chat message history (auto-increment, timestamp index)
 * - `kv`      — generic key-value store (memories, summaries, chunks)
 * - `files`   — VFS file entries (path-keyed)
 *
 * Small config (API key, panel mode, locale) stays in localStorage via storage.ts.
 */
import { openDB } from "idb";
const DB_NAME = "agent-perchance";
const DB_VERSION = 2;
let _db = null;
/** Open (or get cached) database connection. */
export async function getDb() {
    if (_db)
        return _db;
    _db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Messages store — auto-increment, indexed by timestamp
            if (!db.objectStoreNames.contains("messages")) {
                const msgStore = db.createObjectStore("messages", {
                    keyPath: "id",
                    autoIncrement: true,
                });
                msgStore.createIndex("by-timestamp", "timestamp");
            }
            // Generic key-value store
            if (!db.objectStoreNames.contains("kv")) {
                db.createObjectStore("kv", { keyPath: "key" });
            }
            // VFS file entries — path-keyed
            if (!db.objectStoreNames.contains("files")) {
                db.createObjectStore("files", { keyPath: "path" });
            }
        },
    });
    return _db;
}
// ─── Messages ───────────────────────────────────────────────
export async function dbAddMessage(msg) {
    const db = await getDb();
    return db.add("messages", msg);
}
export async function dbGetAllMessages() {
    const db = await getDb();
    return db.getAll("messages");
}
export async function dbGetMessagesByRange(from, to) {
    const db = await getDb();
    const index = db.transaction("messages").store.index("by-timestamp");
    const range = IDBKeyRange.bound(from, to ?? Infinity);
    return index.getAll(range);
}
export async function dbGetLastN(n) {
    const db = await getDb();
    const tx = db.transaction("messages");
    const index = tx.store.index("by-timestamp");
    const results = [];
    // Traverse index in reverse to collect only the last N entries,
    // avoiding getAllKeys() + N individual gets (N+1 pattern).
    let cursor = await index.openCursor(null, "prev");
    while (cursor && results.length < n) {
        results.push(cursor.value);
        cursor = await cursor.continue();
    }
    // Restore ascending timestamp order (cursor traverses in reverse)
    results.reverse();
    return results;
}
export async function dbGetMessageCount() {
    const db = await getDb();
    const tx = db.transaction("messages");
    const count = await tx.store.count();
    return count;
}
export async function dbClearMessages() {
    const db = await getDb();
    await db.clear("messages");
}
// ─── Key-Value Store (memories, summaries, chunks) ──────────
export async function dbKvGet(key) {
    const db = await getDb();
    const entry = await db.get("kv", key);
    return entry?.value ?? undefined;
}
/**
 * Like `dbKvGet<T>` but validates the stored value with a runtime type guard.
 * Returns `undefined` (with a warning) if the stored data doesn't match the expected shape.
 * Use this instead of `dbKvGet` for data that must be structurally correct.
 */
export async function dbKvGetValidated(key, validator) {
    const db = await getDb();
    const entry = await db.get("kv", key);
    if (entry?.value === undefined)
        return undefined;
    if (!validator(entry.value)) {
        console.warn(`[db] Validation failed for key "${key}" — stored data shape mismatch`);
        return undefined;
    }
    return entry.value;
}
export async function dbKvSet(key, value) {
    const db = await getDb();
    await db.put("kv", { key, value });
}
export async function dbKvDel(key) {
    const db = await getDb();
    await db.delete("kv", key);
}
export async function dbKvClear() {
    const db = await getDb();
    await db.clear("kv");
}
export async function dbKvKeys() {
    const db = await getDb();
    const keys = await db.getAllKeys("kv");
    return keys;
}
// ─── VFS (Virtual File System) ───────────────────────────────
/** Save all VFS entries to IndexedDB (replaces existing data). */
export async function dbSaveVfs(entries) {
    const db = await getDb();
    const tx = db.transaction("files", "readwrite");
    await tx.store.clear();
    for (const entry of entries) {
        if (entry.path !== "/") {
            // Skip root directory — it's implicit
            await tx.store.add(entry);
        }
    }
    await tx.done;
}
/**
 * Save a single VFS entry to IndexedDB (incremental).
 * Uses `put()` which upserts — no clear+add overhead.
 * Preferred over dbSaveVfs() when only a few files changed.
 */
export async function dbSaveSingleFile(entry) {
    if (entry.path === "/")
        return; // Root is implicit
    const db = await getDb();
    await db.put("files", entry);
}
/** Load all VFS entries from IndexedDB. */
export async function dbLoadVfs() {
    const db = await getDb();
    const entries = await db.getAll("files");
    return entries;
}
/** Count VFS entries. */
export async function dbCountVfs() {
    const db = await getDb();
    return db.count("files");
}

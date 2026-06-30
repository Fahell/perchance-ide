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

import { openDB, type IDBPDatabase } from "idb";
import type { VfsEntry } from "./vfs.js";

// ─── Schema ─────────────────────────────────────────────────
export interface DbMessage {
  id?: number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface DbKvEntry {
  key: string;
  value: unknown;
}

const DB_NAME = "agent-perchance";
const DB_VERSION = 2;

type DbSchema = {
  messages: {
    key: number;
    value: DbMessage;
    indexes: { "by-timestamp": number };
  };
  kv: {
    key: string;
    value: DbKvEntry;
  };
  files: {
    key: string;
    value: VfsEntry;
  };
};

let _db: IDBPDatabase<DbSchema> | null = null;

/** Open (or get cached) database connection. */
export async function getDb(): Promise<IDBPDatabase<DbSchema>> {
  if (_db) return _db;

  _db = await openDB<DbSchema>(DB_NAME, DB_VERSION, {
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
export async function dbAddMessage(msg: Omit<DbMessage, "id">): Promise<number> {
  const db = await getDb();
  return db.add("messages", msg as DbMessage);
}

export async function dbGetAllMessages(): Promise<DbMessage[]> {
  const db = await getDb();
  return db.getAll("messages");
}

export async function dbGetMessagesByRange(
  from: number,
  to?: number
): Promise<DbMessage[]> {
  const db = await getDb();
  const index = db.transaction("messages").store.index("by-timestamp");
  const range = IDBKeyRange.bound(from, to ?? Infinity);
  return index.getAll(range);
}

export async function dbGetLastN(n: number): Promise<DbMessage[]> {
  const db = await getDb();
  const index = db.transaction("messages").store.index("by-timestamp");
  // Get all keys in reverse order, take N
  const allKeys = await index.getAllKeys();
  const count = allKeys.length;
  if (count === 0) return [];
  const start = Math.max(0, count - n);
  const keys = allKeys.slice(start);
  const results: DbMessage[] = [];
  for (const id of keys) {
    const msg = await db.get("messages", id);
    if (msg) results.push(msg);
  }
  return results;
}

export async function dbGetMessageCount(): Promise<number> {
  const db = await getDb();
  const tx = db.transaction("messages");
  const count = await tx.store.count();
  return count;
}

export async function dbClearMessages(): Promise<void> {
  const db = await getDb();
  await db.clear("messages");
}

// ─── Key-Value Store (memories, summaries, chunks) ──────────
export async function dbKvGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const entry = await db.get("kv", key);
  return (entry?.value as T) ?? undefined;
}

export async function dbKvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("kv", { key, value });
}

export async function dbKvDel(key: string): Promise<void> {
  const db = await getDb();
  await db.delete("kv", key);
}

export async function dbKvClear(): Promise<void> {
  const db = await getDb();
  await db.clear("kv");
}

export async function dbKvKeys(): Promise<string[]> {
  const db = await getDb();
  const keys = await db.getAllKeys("kv");
  return keys as string[];
}

// ─── VFS (Virtual File System) ───────────────────────────────
/** Save all VFS entries to IndexedDB (replaces existing data). */
export async function dbSaveVfs(entries: VfsEntry[]): Promise<void> {
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

/** Load all VFS entries from IndexedDB. */
export async function dbLoadVfs(): Promise<VfsEntry[]> {
  const db = await getDb();
  const entries = await db.getAll("files");
  return entries;
}

/** Count VFS entries. */
export async function dbCountVfs(): Promise<number> {
  const db = await getDb();
  return db.count("files");
}

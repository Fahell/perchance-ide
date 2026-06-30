/**
 * IndexedDB persistence layer via idb v8.
 *
 * Provides specialized stores for:
 * - `messages` — chat message history (auto-increment, timestamp index)
 * - `kv`      — generic key-value store (memories, summaries, chunks)
 *
 * Small config (API key, panel mode, locale) stays in localStorage via storage.ts.
 */

import { openDB, type IDBPDatabase } from "idb";

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
const DB_VERSION = 1;

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

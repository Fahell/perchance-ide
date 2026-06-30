/**
 * Message Store — in-memory message storage with IndexedDB persistence.
 *
 * Messages are cached in memory for fast access and persisted to IndexedDB
 * via the db module for survival across page reloads.
 */

import { dbAddMessage, dbClearMessages, dbGetAllMessages, dbGetLastN, dbGetMessageCount, type DbMessage } from "./db.js";

// ─── Types ──────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

// ─── In-Memory Cache ───────────────────────────────────────
let messages: ChatMessage[] = [];
let loaded = false;

// ─── Internal Helpers ──────────────────────────────────────
function dbToChat(m: DbMessage): ChatMessage {
  return { role: m.role, content: m.content, timestamp: m.timestamp };
}

// ─── API ────────────────────────────────────────────────────
export async function initMessageStore(): Promise<void> {
  messages = [];
  try {
    const all = await dbGetAllMessages();
    messages = all.map(dbToChat);
  } catch (e) {
    console.warn("[MessageStore] load failed:", e);
  }
  loaded = true;
}

export async function addMessage(msg: Omit<ChatMessage, "timestamp">): Promise<ChatMessage> {
  const full: ChatMessage = { ...msg, timestamp: Date.now() };
  messages.push(full);
  // Fire-and-forget persistence
  dbAddMessage(full).catch((e) => console.warn("[MessageStore] persist failed:", e));
  return full;
}

export function getMessages(): ChatMessage[] {
  return [...messages];
}

export function getLastN(n: number): ChatMessage[] {
  return messages.slice(-n);
}

export function getMessageCount(): number {
  return messages.length;
}

export async function clearMessages(): Promise<void> {
  messages = [];
  try {
    await dbClearMessages();
  } catch (e) {
    console.warn("[MessageStore] clear failed:", e);
  }
}

export function getMessagesByRange(fromIndex: number, toIndex?: number): (ChatMessage & { index: number })[] {
  const start = Math.max(0, fromIndex);
  const end = toIndex !== undefined ? Math.min(messages.length, toIndex) : messages.length;
  return messages.slice(start, end).map((m, i) => ({ ...m, index: start + i }));
}

export function getAllMessages(): ChatMessage[] {
  return [...messages];
}

export { dbClearMessages, dbGetAllMessages, dbGetLastN, dbGetMessageCount };


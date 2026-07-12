/**
 * Message Store — in-memory message storage with IndexedDB persistence.
 *
 * Messages are cached in memory for fast access and persisted to IndexedDB
 * via the db module for survival across page reloads.
 */

import { dbAddMessage, dbClearMessages, dbGetAllMessages, dbGetMessageCount, type DbMessage } from "./db.js";

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
  // Persist to IndexedDB — await to ensure data survival
  try {
    await dbAddMessage(full);
  } catch (e) {
    console.warn("[MessageStore] persist failed:", e);
  }
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

// ─── Conversation Archive ────────────────────────────────────

export interface ArchivedConversation {
  id: string;
  label: string;
  timestamp: number;
  messageCount: number;
}

const ARCHIVE_INDEX_KEY = "conversations:index";

/**
 * Save current messages as an archived conversation and clear the working set.
 * Archives are stored in IndexedDB KV store.
 */
export async function archiveConversation(): Promise<string> {
  const currentMessages = [...messages];
  if (currentMessages.length === 0) return "";

  const id = `conv-${Date.now()}`;
  const firstMsg = currentMessages.find((m) => m.role === "user");
  const label = firstMsg
    ? firstMsg.content.slice(0, 60).replace(/\n/g, " ").trim() + (firstMsg.content.length > 60 ? "…" : "")
    : "(empty)";

  // Save messages to IndexedDB
  const { dbKvSet } = await import("./db.js");
  await dbKvSet(`conversation:${id}`, currentMessages);

  // Update index
  const index = await getArchivedConversations();
  index.unshift({ id, label, timestamp: Date.now(), messageCount: currentMessages.length });
  await dbKvSet(ARCHIVE_INDEX_KEY, index);

  // Clear current messages
  messages = [];

  return id;
}

/** Get list of archived conversations. */
export async function getArchivedConversations(): Promise<ArchivedConversation[]> {
  const { dbKvGet } = await import("./db.js");
  const raw = await dbKvGet<ArchivedConversation[]>(ARCHIVE_INDEX_KEY);
  if (!Array.isArray(raw)) return [];
  return raw;
}

/**
 * Restore an archived conversation's messages, replacing the current working set.
 */
export async function restoreConversation(id: string): Promise<ChatMessage[]> {
  const { dbKvGet } = await import("./db.js");
  const archived = await dbKvGet<ChatMessage[]>(`conversation:${id}`);
  if (!Array.isArray(archived)) return [];
  messages = archived;
  return [...messages];
}

/**
 * Delete an archived conversation and update the index.
 */
export async function deleteArchivedConversation(id: string): Promise<void> {
  const { dbKvDel, dbKvSet } = await import("./db.js");
  await dbKvDel(`conversation:${id}`);

  const index = await getArchivedConversations();
  const updated = index.filter((c) => c.id !== id);
  await dbKvSet(ARCHIVE_INDEX_KEY, updated);
}

export { dbClearMessages, dbGetAllMessages, dbGetMessageCount };


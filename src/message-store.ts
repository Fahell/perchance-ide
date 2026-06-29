/**
 * Message Store — custom in-memory message storage with customData persistence.
 *
 * Replaces oc.thread.messages for standalone generator context.
 * Messages are stored in memory and persisted to oc.thread.customData
 * for survival across page reloads.
 */

import { storageGet, storageSet } from "./storage.js";

// ─── Types ──────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

// ─── Constants ──────────────────────────────────────────────
const STORAGE_KEY = "agent:messages";

// ─── In-Memory Store ───────────────────────────────────────
let messages: ChatMessage[] = [];
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Persistence ────────────────────────────────────────────
function persist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      storageSet(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn("[MessageStore] persist failed:", e);
    }
  }, 300);
}

function load(): void {
  try {
    const raw = storageGet<string>(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed)) {
        messages = parsed;
      }
    }
  } catch (e) {
    console.warn("[MessageStore] load failed:", e);
    messages = [];
  }
}

// ─── API ────────────────────────────────────────────────────
export function initMessageStore(): void {
  messages = [];
  load();
}

export function addMessage(msg: Omit<ChatMessage, "timestamp">): ChatMessage {
  const full: ChatMessage = { ...msg, timestamp: Date.now() };
  messages.push(full);
  persist();
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

export function clearMessages(): void {
  messages = [];
  storageSet(STORAGE_KEY, "");
}

export function getMessagesByRange(fromIndex: number, toIndex?: number): ChatMessage[] {
  const start = Math.max(0, fromIndex);
  const end = toIndex !== undefined ? Math.min(messages.length, toIndex) : messages.length;
  return messages.slice(start, end).map((m, i) => ({ ...m, index: start + i } as ChatMessage & { index: number }));
}

export function getAllMessages(): ChatMessage[] {
  return [...messages];
}

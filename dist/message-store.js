/**
 * Message Store — in-memory message storage with IndexedDB persistence.
 *
 * Messages are cached in memory for fast access and persisted to IndexedDB
 * via the db module for survival across page reloads.
 */
import { dbAddMessage, dbClearMessages, dbGetAllMessages, dbGetMessageCount } from "./db.js";
// ─── In-Memory Cache ───────────────────────────────────────
let messages = [];
let loaded = false;
// ─── Internal Helpers ──────────────────────────────────────
function dbToChat(m) {
    return { role: m.role, content: m.content, timestamp: m.timestamp };
}
// ─── API ────────────────────────────────────────────────────
export async function initMessageStore() {
    messages = [];
    try {
        const all = await dbGetAllMessages();
        messages = all.map(dbToChat);
    }
    catch (e) {
        console.warn("[MessageStore] load failed:", e);
    }
    loaded = true;
}
export async function addMessage(msg) {
    const full = { ...msg, timestamp: Date.now() };
    messages.push(full);
    // Persist to IndexedDB — await to ensure data survival
    try {
        await dbAddMessage(full);
    }
    catch (e) {
        console.warn("[MessageStore] persist failed:", e);
    }
    return full;
}
export function getMessages() {
    return [...messages];
}
export function getLastN(n) {
    return messages.slice(-n);
}
export function getMessageCount() {
    return messages.length;
}
export async function clearMessages() {
    messages = [];
    try {
        await dbClearMessages();
    }
    catch (e) {
        console.warn("[MessageStore] clear failed:", e);
    }
}
export function getMessagesByRange(fromIndex, toIndex) {
    const start = Math.max(0, fromIndex);
    const end = toIndex !== undefined ? Math.min(messages.length, toIndex) : messages.length;
    return messages.slice(start, end).map((m, i) => ({ ...m, index: start + i }));
}
export function getAllMessages() {
    return [...messages];
}
export { dbClearMessages, dbGetAllMessages, dbGetMessageCount };

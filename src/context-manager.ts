/**
 * Context Manager — token-aware conversation history with summarization.
 *
 * Reads from message-store, estimates token usage, and builds a context
 * object with optional summary for older messages that exceed the budget.
 * Summaries are persisted in localStorage via storage module.
 */

import type { HistoryMessage } from "./agent-loop.js";
import { dbKvDel, dbKvGet, dbKvSet } from "./db.js";
import { getAllMessages, getLastN, getMessageCount, type ChatMessage } from "./message-store.js";
import { getAi } from "./types.js";

// ─── Constants ──────────────────────────────────────────────
const CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_TOKENS = 3000;
const MAX_RECENT_MESSAGES = 5;
const SUMMARY_KEY = "context_summary";
const SUMMARY_MSG_COUNT_KEY = "context_summary_msg_count";
const CHUNKS_KEY = "context_chunks";

// ─── Helpers ────────────────────────────────────────────────
function msgToHistory(m: ChatMessage): HistoryMessage {
  return { role: m.role as "user" | "assistant", content: m.content };
}

function allHistoryMessages(): HistoryMessage[] {
  return getAllMessages().map(msgToHistory);
}

// ─── Chunked Summary Storage ────────────────────────────────
export interface ChunkSummary {
  from: number;
  to: number;
  summary: string;
  tokenCount: number;
}

export async function getChunkedSummaries(): Promise<ChunkSummary[]> {
  return (await dbKvGet<ChunkSummary[]>(CHUNKS_KEY)) ?? [];
}

async function persistChunk(chunk: ChunkSummary): Promise<void> {
  const chunks = (await getChunkedSummaries()).slice();
  chunks.push(chunk);
  await dbKvSet(CHUNKS_KEY, chunks);
}

export async function clearChunkedSummaries(): Promise<void> {
  await dbKvDel(CHUNKS_KEY);
}

// ─── Token Estimation ───────────────────────────────────────
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ─── Summary Persistence ────────────────────────────────────
async function persistSummary(summary: string, msgCount: number): Promise<void> {
  await dbKvSet(SUMMARY_KEY, summary);
  await dbKvSet(SUMMARY_MSG_COUNT_KEY, msgCount);
}

export async function loadSummary(): Promise<string | null> {
  return (await dbKvGet<string>(SUMMARY_KEY)) ?? null;
}

export async function clearSummary(): Promise<void> {
  await dbKvDel(SUMMARY_KEY);
  await dbKvDel(SUMMARY_MSG_COUNT_KEY);
}

// ─── Summarization ──────────────────────────────────────────
async function summarizeOldMessages(messages: HistoryMessage[]): Promise<string> {
  const convoText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const instruction = `Summarize the following conversation into a concise paragraph (3-5 sentences). Focus on key facts, decisions, and context. Use names instead of pronouns. Be specific and factual.

---

${convoText}

---

Summary:`;

  console.log("📝 [Context] Summarizing", messages.length, "messages (~" + estimateTokens(convoText) + " tokens)");

  try {
    const result = await getAi()({ instruction });
    const summary = (result.generatedText || result.text || result.toString()).trim();
    console.log("📝 [Context] Summary generated (~" + estimateTokens(summary) + " tokens)");
    return summary;
  } catch (err) {
    console.error("❌ [Context] Summarization failed:", err);
    return "";
  }
}

// ─── Build Context ──────────────────────────────────────────
export interface ContextResult {
  summary: string | null;
  recentMessages: HistoryMessage[];
  totalTokens: number;
  summarizedCount: number;
}

export async function buildContext(
  currentUserMessage: string
): Promise<ContextResult> {
  // Get messages from our custom message store
  const recentMsgs = getLastN(MAX_RECENT_MESSAGES);

  // Estimate tokens for all messages
  const msgsWithTokens = recentMsgs.map((m) => ({
    ...msgToHistory(m),
    tokens: estimateTokens(m.content),
  }));

  // Check if we need summarization
  const totalMsgTokens = msgsWithTokens.reduce((sum, m) => sum + m.tokens, 0);
  const currentMsgTokens = estimateTokens(currentUserMessage);

  // Load existing summary
  const existingSummary = await loadSummary();
  const existingSummaryTokens = existingSummary ? estimateTokens(existingSummary) : 0;

  if (totalMsgTokens + currentMsgTokens + existingSummaryTokens <= MAX_CONTEXT_TOKENS) {
    // Under budget — include everything
    return {
      summary: existingSummary,
      recentMessages: msgsWithTokens.map(({ role, content }) => ({ role, content })),
      totalTokens: totalMsgTokens + currentMsgTokens + existingSummaryTokens,
      summarizedCount: 0,
    };
  }

  // Over budget — need to summarize older messages
  const budgetForHistory = MAX_CONTEXT_TOKENS - currentMsgTokens - existingSummaryTokens;
  let keptTokens = 0;
  let splitIndex = msgsWithTokens.length;

  for (let i = msgsWithTokens.length - 1; i >= 0; i--) {
    if (keptTokens + msgsWithTokens[i].tokens > budgetForHistory) break;
    keptTokens += msgsWithTokens[i].tokens;
    splitIndex = i;
  }

  // Messages to summarize (everything before the kept recent ones)
  const toSummarize = msgsWithTokens.slice(0, splitIndex);
  const recentKept = msgsWithTokens.slice(splitIndex);

  if (toSummarize.length === 0) {
    return {
      summary: existingSummary,
      recentMessages: recentKept.map(({ role, content }) => ({ role, content })),
      totalTokens: keptTokens + currentMsgTokens + existingSummaryTokens,
      summarizedCount: 0,
    };
  }

  // Build combined summary: existing + new
  const newSummary = await summarizeOldMessages(toSummarize);

  let combinedSummary: string;
  let summarizedCount: number;

  if (existingSummary && newSummary) {
    combinedSummary = existingSummary + "\n" + newSummary;
    summarizedCount = toSummarize.length;
  } else if (newSummary) {
    combinedSummary = newSummary;
    summarizedCount = toSummarize.length;
  } else {
    combinedSummary = existingSummary || "";
    summarizedCount = 0;
  }

  // Persist the updated summary
  const totalMsgs = getMessageCount();
  if (combinedSummary) {
    await persistSummary(combinedSummary, totalMsgs);
  }

  const finalTokens = estimateTokens(combinedSummary) + keptTokens + currentMsgTokens;

  return {
    summary: combinedSummary || null,
    recentMessages: recentKept.map(({ role, content }) => ({ role, content })),
    totalTokens: finalTokens,
    summarizedCount,
  };
}

// ─── Context State (for UI visualization) ───────────────────
export interface ContextState {
  summary: string | null;
  recentMessages: HistoryMessage[];
  totalTokens: number;
  maxTokens: number;
  summaryTokens: number;
  historyTokens: number;
}

export async function getContextState(
  currentUserMessage: string
): Promise<ContextState> {
  const recentMsgs = getLastN(MAX_RECENT_MESSAGES);
  const recentMessages = recentMsgs.map(msgToHistory);
  const summary = await loadSummary();
  const summaryTokens = summary ? estimateTokens(summary) : 0;
  const historyTokens = recentMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const currentMsgTokens = estimateTokens(currentUserMessage);
  const totalTokens = summaryTokens + historyTokens + currentMsgTokens;

  return {
    summary,
    recentMessages,
    totalTokens,
    maxTokens: MAX_CONTEXT_TOKENS,
    summaryTokens,
    historyTokens,
  };
}

// ─── Search & Range Retrieval (for context-tools) ───────────
export function getAllHistoryMessages(): { role: "user" | "assistant"; content: string }[] {
  return allHistoryMessages();
}

export function getTotalMessageCount(): number {
  return getMessageCount();
}

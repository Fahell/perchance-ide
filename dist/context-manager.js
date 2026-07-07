/**
 * Context Manager — token-aware conversation history with summarization.
 *
 * Reads from message-store, estimates token usage, and builds a context
 * object with optional summary for older messages that exceed the budget.
 * Summaries are persisted in localStorage via storage module.
 */
import { dbKvDel, dbKvGet, dbKvGetValidated, dbKvSet } from "./db.js";
import { getAllMessages, getLastN, getMessageCount } from "./message-store.js";
import { getAi } from "./types.js";
import { isArrayOf, validateShape } from "./utils/validate.js";
// ─── Constants ──────────────────────────────────────────────
const MAX_CONTEXT_TOKENS = 6000;
const MAX_SUMMARY_TOKENS = Math.floor(MAX_CONTEXT_TOKENS * 0.4); // 2400 tokens reserved for summary
const MAX_RECENT_MESSAGES = 5;
const SUMMARY_KEY = "context_summary";
const SUMMARY_MSG_COUNT_KEY = "context_summary_msg_count";
const CHUNKS_KEY = "context_chunks";
// ─── Helpers ────────────────────────────────────────────────
function msgToHistory(m) {
    return { role: m.role, content: m.content };
}
function allHistoryMessages() {
    return getAllMessages().map(msgToHistory);
}
const isChunkSummary = validateShape({
    from: (v) => typeof v === "number",
    to: (v) => typeof v === "number",
    summary: (v) => typeof v === "string",
    tokenCount: (v) => typeof v === "number",
});
const isChunkSummaryArray = isArrayOf(isChunkSummary);
export async function getChunkedSummaries() {
    return (await dbKvGetValidated(CHUNKS_KEY, isChunkSummaryArray)) ?? [];
}
async function persistChunk(chunk) {
    const chunks = (await getChunkedSummaries()).slice();
    chunks.push(chunk);
    await dbKvSet(CHUNKS_KEY, chunks);
}
export async function clearChunkedSummaries() {
    await dbKvDel(CHUNKS_KEY);
}
// ─── Token Estimation ───────────────────────────────────────
/**
 * Estimate token count for a text string.
 * Uses UTF-8 byte length divided by 4 as baseline.
 * If >15% of characters are code operators/brackets, uses divisor 3.0
 * (code tokens are denser than natural language).
 *
 * This is an approximation — actual tokenization depends on the model.
 */
export function estimateTokens(text) {
    if (!text)
        return 1;
    const bytes = new TextEncoder().encode(text).length;
    // Heuristic: detect code-heavy content by counting operator/bracket chars
    const codePattern = /[{}[\]()=+\-*/<>&|!?:;]/g;
    const codeCharCount = (text.match(codePattern)?.length ?? 0);
    const codeCharRatio = codeCharCount / text.length;
    // Code is typically ~3 chars/token, text ~4 chars/token
    const divisor = codeCharRatio > 0.15 ? 3.0 : 4.0;
    return Math.max(1, Math.ceil(bytes / divisor));
}
// ─── Summary Persistence ────────────────────────────────────
async function persistSummary(summary, msgCount) {
    await dbKvSet(SUMMARY_KEY, summary);
    await dbKvSet(SUMMARY_MSG_COUNT_KEY, msgCount);
}
export async function loadSummary() {
    return (await dbKvGet(SUMMARY_KEY)) ?? null;
}
export async function clearSummary() {
    await dbKvDel(SUMMARY_KEY);
    await dbKvDel(SUMMARY_MSG_COUNT_KEY);
}
// ─── Summarization ──────────────────────────────────────────
async function summarizeOldMessages(messages) {
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
    }
    catch (err) {
        console.error("❌ [Context] Summarization failed:", err);
        return "";
    }
}
// ─── Summary Condensation ───────────────────────────────────
/**
 * Condense two summaries into a single compact summary when the
 * combined token count exceeds MAX_SUMMARY_TOKENS.
 * Falls back to simple concatenation if the LLM call fails.
 */
async function condenseSummaries(existing, incoming) {
    const combinedTokens = estimateTokens(existing) + estimateTokens(incoming);
    console.log(`📝 [Context] Condensing summaries (${combinedTokens} tokens → target ≤${MAX_SUMMARY_TOKENS})`);
    const instruction = `Merge the following two conversation summaries into a single concise paragraph (3-5 sentences). Preserve key facts, decisions, user preferences, and essential context. Eliminate redundancy. Be specific and factual.

--- EXISTING SUMMARY ---
${existing}

--- NEW SUMMARY ---
${incoming}

--- MERGED SUMMARY ---`;
    try {
        const result = await getAi()({ instruction });
        const condensed = (result.generatedText || result.text || result.toString()).trim();
        const condensedTokens = estimateTokens(condensed);
        console.log(`📝 [Context] Condensed summary: ${combinedTokens} → ${condensedTokens} tokens`);
        return condensed;
    }
    catch (err) {
        console.error("❌ [Context] Condensation failed, falling back to concatenation:", err);
        return existing + "\n" + incoming;
    }
}
export async function buildContext(currentUserMessage) {
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
        if (keptTokens + msgsWithTokens[i].tokens > budgetForHistory)
            break;
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
    let combinedSummary;
    let summarizedCount;
    if (existingSummary && newSummary) {
        const naiveCombined = existingSummary + "\n" + newSummary;
        const combinedTokens = estimateTokens(naiveCombined);
        if (combinedTokens > MAX_SUMMARY_TOKENS) {
            // Condense via LLM to stay within budget
            combinedSummary = await condenseSummaries(existingSummary, newSummary);
        }
        else {
            combinedSummary = naiveCombined;
        }
        summarizedCount = toSummarize.length;
    }
    else if (newSummary) {
        combinedSummary = newSummary;
        summarizedCount = toSummarize.length;
    }
    else {
        combinedSummary = existingSummary || "";
        summarizedCount = 0;
    }
    // Defensive truncation: if summary still exceeds budget after condensation
    const summaryTokensAfter = estimateTokens(combinedSummary);
    if (summaryTokensAfter > MAX_SUMMARY_TOKENS) {
        console.warn(`⚠️ [Context] Summary still over budget (${summaryTokensAfter} > ${MAX_SUMMARY_TOKENS}), truncating`);
        // Approximate char limit: MAX_SUMMARY_TOKENS * 3.5 chars/token (conservative)
        const maxChars = Math.floor(MAX_SUMMARY_TOKENS * 3.5);
        if (combinedSummary.length > maxChars) {
            combinedSummary = combinedSummary.slice(0, maxChars).trimEnd() + "...";
        }
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
export async function getContextState(currentUserMessage) {
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
export function getAllHistoryMessages() {
    return allHistoryMessages();
}
export function getTotalMessageCount() {
    return getMessageCount();
}

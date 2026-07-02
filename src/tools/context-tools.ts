/**
 * Context tools — agent-accessible tools for querying conversation history.
 *
 * Provides search_history (BM25-lite keyword search) and get_messages
 * (index-based retrieval). Reads from the custom message store.
 */

import { getAllMessages } from "../message-store.js";
import type { Tool } from "./index.js";

// ─── Stopwords (minimal set for BM25-lite) ──────────────────
const STOPWORDS = new Set([
  // English
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "not", "only", "own", "same", "so", "than", "too", "very", "just",
  "because", "but", "and", "or", "if", "while", "about", "it", "its",
  "this", "that", "these", "those", "i", "me", "my", "we", "our",
  "you", "your", "he", "him", "his", "she", "her", "they", "them",
  "their", "what", "which", "who", "whom",
  // Portuguese
  "o", "a", "os", "as", "um", "uma", "uns", "umas", "de", "do", "da",
  "dos", "das", "em", "no", "na", "nos", "nas", "por", "para", "com",
  "sem", "sob", "se", "que", "seu", "sua", "seus", "suas", "eu",
  "tu", "ele", "ela", "nós", "vós", "eles", "elas", "meu", "meus",
  "minha", "minhas", "teu", "teus", "tua", "tuas", "nosso", "nossos",
  "nossa", "nossas", "esse", "essa", "esses", "essas", "este", "esta",
  "estes", "estas", "aquele", "aquela", "aqueles", "aquelas", "isto",
  "isso", "aquilo", "mas", "ou", "porém", "contudo", "todavia", "então",
  "pois", "como", "quando", "onde", "porque", "porquê", "também",
  // Spanish
  "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o",
  "pero", "sino", "como", "cuando", "donde", "porque", "por qué",
  "también", "muy", "más", "menos", "tan", "todo", "toda", "todos",
  "todas", "este", "esta", "estos", "estas", "ese", "esa", "esos",
  "esas", "aquel", "aquella", "aquellos", "aquellas",
]);

// ─── Tokenizer ──────────────────────────────────────────────
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-záàâãéèêíïóôõúüçñ0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// ─── BM25-Lite Search ───────────────────────────────────────
interface ScoredMessage {
  index: number;
  author: string;
  content: string;
  score: number;
}

function searchMessages(messages: { author: string; content: string }[], query: string, limit = 5): ScoredMessage[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const totalMessages = messages.length;

  // Phase 1: Pre-tokenize all messages once and build term-frequency maps
  const msgTermFreqs: Map<string, number>[] = new Array(totalMessages);
  const msgTermCounts: number[] = new Array(totalMessages);
  for (let i = 0; i < totalMessages; i++) {
    const terms = tokenize(messages[i].content);
    msgTermCounts[i] = terms.length;
    const freqMap = new Map<string, number>();
    for (const t of terms) {
      freqMap.set(t, (freqMap.get(t) ?? 0) + 1);
    }
    msgTermFreqs[i] = freqMap;
  }

  // Phase 2: Compute IDF for each query term exactly once
  const idfCache = new Map<string, number>();
  for (const qt of queryTerms) {
    let docsWithTerm = 0;
    for (let i = 0; i < totalMessages; i++) {
      if (msgTermFreqs[i].has(qt)) docsWithTerm++;
    }
    idfCache.set(qt, Math.log((totalMessages + 1) / (docsWithTerm + 1)));
  }

  // Phase 3: Score messages using O(1) lookups
  const scored: ScoredMessage[] = [];
  for (let i = 0; i < totalMessages; i++) {
    if (msgTermCounts[i] === 0) continue;

    let score = 0;
    const freqMap = msgTermFreqs[i];
    for (const qt of queryTerms) {
      const count = freqMap.get(qt);
      if (count !== undefined) {
        const tf = count / msgTermCounts[i];
        score += tf * idfCache.get(qt)!;
      }
    }

    if (score > 0) {
      scored.push({
        index: i,
        author: messages[i].author,
        content: messages[i].content,
        score,
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Tool Factory ───────────────────────────────────────────
export function createContextTools(): Record<string, Tool> {
  return {
    search_history: {
      name: "search_history",
      description:
        "Search your conversation history by keyword. USE this when the user references something from earlier in the conversation that is NOT in the recent messages above. Returns the most relevant matching messages with their positions.",
      parameters: {
        query: { description: "Keywords to search for. Use specific terms from what the user is asking about.", type: "string", required: true },
      },
      timeoutMs: 15_000,
      execute: async (args) => {
        const query = String(args.query || "");
        if (!query.trim()) return "Error: query is required.";

        // Get all messages from our custom message store
        const allMessages = getAllMessages().map((m) => ({
          author: m.role === "user" ? "user" : m.role === "assistant" ? "ai" : "system",
          content: m.content,
        }));

        if (allMessages.length === 0) return "No conversation history found.";

        const results = searchMessages(allMessages, query, 5);
        if (results.length === 0) return `No messages found matching "${query}".`;

        const lines = results.map(
          (r) => `[msg #${r.index}] ${r.author}: "${r.content.length > 200 ? r.content.slice(0, 200) + "..." : r.content}"`
        );

        return `Found ${results.length} relevant messages:\n${lines.join("\n")}`;
      },
    },

    get_messages: {
      name: "get_messages",
      description:
        "Get raw messages by position or count from your conversation history. USE this when you need exact quotes, full context, or specific messages. Returns formatted messages with author and position.",
      parameters: {
        count: { description: "Number of recent messages to retrieve (default 10).", type: "number" },
        from: { description: "Start index (0-based, inclusive). Example: 5", type: "number" },
        to: { description: "End index (0-based, exclusive). Example: 15", type: "number" },
      },
      timeoutMs: 15_000,
      execute: async (args) => {
        // Get all messages from our custom message store
        const allMessages = getAllMessages().map((m) => ({
          author: m.role === "user" ? "user" : m.role === "assistant" ? "ai" : "system",
          content: m.content,
        }));

        if (allMessages.length === 0) return "No conversation history found.";

        let from = 0;
        let to = allMessages.length;

        if (args.from !== undefined || args.to !== undefined) {
          from = Math.max(0, Number(args.from) || 0);
          to = Math.min(allMessages.length, Number(args.to) || allMessages.length);
        } else if (args.count !== undefined) {
          const count = Math.min(20, Math.max(1, Number(args.count) || 10));
          from = Math.max(0, allMessages.length - count);
          to = allMessages.length;
        } else {
          // Default: last 10
          from = Math.max(0, allMessages.length - 10);
          to = allMessages.length;
        }

        const slice = allMessages.slice(from, to);
        if (slice.length === 0) return "No messages in the specified range.";

        const lines = slice.map(
          (m, i) => `[${from + i}] ${m.author}: "${m.content.length > 300 ? m.content.slice(0, 300) + "..." : m.content}"`
        );

        return `Messages #${from}-${to - 1} (${slice.length} of ${allMessages.length}):\n${lines.join("\n")}`;
      },
    },
  };
}

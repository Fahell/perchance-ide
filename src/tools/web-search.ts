/**
 * Web search tool using Jina API (CORS-friendly)
 *
 * Search: POST https://s.jina.ai/ with {"q": "query"}
 * Scrape: POST https://r.jina.ai/ with {"url": "url"}
 * Auth: Bearer token required
 */

import { retryWithBackoff } from "../utils/retry.js";
import type { Tool } from "./index.js";

// ─── Typed Error ────────────────────────────────────────────
class FetchError extends Error {
  response: Response;
  constructor(message: string, response: Response) {
    super(message);
    this.name = "FetchError";
    this.response = response;
  }
}

// ─── Jina API Response Types ────────────────────────────────
interface JinaSearchResult {
  title: string;
  url: string;
  description: string;
  content?: string;
}

interface JinaSearchResponse {
  code?: number;
  data?: JinaSearchResult[];
  detail?: string;
}

// ─── API Key Management ─────────────────────────────────────
let currentApiKey = "";

export function setApiKey(key: string): void {
  currentApiKey = key;
}

export function getApiKey(): string {
  return currentApiKey;
}

export function hasApiKey(): boolean {
  return currentApiKey.length > 0;
}

export async function validateApiKey(key: string): Promise<boolean> {
  try {
    const res = await retryWithBackoff(async () => {
      const r = await fetch("https://s.jina.ai/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ q: "test" }),
        signal: AbortSignal.timeout(10_000),
      });
      return r;
    }, { maxRetries: 2 });
    return res.ok;
  } catch {
    return false;
  }
}

function jinaHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${currentApiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra,
  };
}

// ─── Types ──────────────────────────────────────────────────
export interface SearchResult {
  title: string;
  url: string;
  description: string;
  content?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  raw: string;
}

export interface ScrapeResponse {
  url: string;
  title: string;
  content: string;
}

// ─── Search ─────────────────────────────────────────────────
export async function webSearch(query: string, limit = 5): Promise<SearchResponse> {
  const res = await retryWithBackoff(async () => {
    const r = await fetch("https://s.jina.ai/", {
      method: "POST",
      headers: jinaHeaders({ "X-Return-Format": "json" }),
      body: JSON.stringify({ q: query, num: limit }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) {
      throw new FetchError(`Jina search failed: ${r.status} ${r.statusText}`, r);
    }
    return r;
  }, { maxRetries: 3 });

  const response: JinaSearchResponse = await res.json();

  // Jina returns an array of results
  const results: SearchResult[] = (response.data || []).slice(0, limit).map((item: JinaSearchResult) => ({
    title: item.title || "",
    url: item.url || "",
    description: item.description || "",
    content: item.content || "",
  }));

  // Build a readable summary for the AI
  const raw = results
    .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.description}`)
    .join("\n\n");

  return { query, results, raw };
}

// ─── Scrape URL ─────────────────────────────────────────────
export async function scrapeUrl(url: string, maxChars = 3000): Promise<ScrapeResponse> {
  const res = await retryWithBackoff(async () => {
    const r = await fetch("https://r.jina.ai/", {
      method: "POST",
      headers: jinaHeaders({ Accept: "text/markdown" }),
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) {
      throw new FetchError(`Jina scrape failed: ${r.status} ${r.statusText}`, r);
    }
    return r;
  }, { maxRetries: 3 });

  const content = await res.text();

  // Try to extract title from first markdown heading
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1] : new URL(url).hostname;

  // Truncate if too long
  const truncated = content.length > maxChars ? content.slice(0, maxChars) + "\n\n[...truncated]" : content;

  return { url, title, content: truncated };
}

// ─── Tool Factory ────────────────────────────────────────────
export function createWebTools(): Record<string, Tool> {
  return {
    web_search: {
      name: "web_search",
      description: "Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",
      parameters: {
        query: { description: "The search query string. Be specific — include topic, year, or context when relevant.", type: "string", required: true },
        limit: { description: "Maximum number of results (default 5).", type: "number" },
      },
      timeoutMs: 30_000,
      execute: async (args: Record<string, unknown>) => {
        const query = String(args.query ?? "");
        const limit = typeof args.limit === "number" ? args.limit : 5;
        const result = await webSearch(query, limit);
        return result.raw || "No results found.";
      },
    },

    scrape_url: {
      name: "scrape_url",
      description: "Fetch and extract the full text content from a specific URL as markdown. USE this after web_search to read the actual page content of the most relevant URLs. Returns real article/page text, not just summaries.",
      parameters: {
        url: { description: "The full URL to scrape (must start with http:// or https://)", type: "string", required: true },
        maxChars: { description: "Maximum characters to return (default 3000). Use higher values for detailed articles.", type: "number" },
      },
      timeoutMs: 30_000,
      execute: async (args: Record<string, unknown>) => {
        const url = String(args.url ?? "");
        const maxChars = typeof args.maxChars === "number" ? args.maxChars : 3000;
        const result = await scrapeUrl(url, maxChars);
        return `# ${result.title}\n\n${result.content}`;
      },
    },
  };
}

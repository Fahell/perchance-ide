/**
 * Web search tool using Jina API (CORS-friendly)
 *
 * Search: POST https://s.jina.ai/ with {"q": "query"}
 * Scrape: POST https://r.jina.ai/ with {"url": "url"}
 * Auth: Bearer token required
 *
 * Features:
 * - In-memory TTL cache (5 min) for search and scrape results
 * - Lazy expiration on read
 * - FIFO eviction when max size exceeded
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

// ─── TTL Cache ──────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs: number, maxSize = 50) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Lazy expiration check
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    // Evict oldest entry if at capacity and key is new
    if (!this.store.has(key) && this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }

    this.store.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.store.clear();
  }
}

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SCRAPE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const searchCache = new TtlCache<SearchResponse>(SEARCH_CACHE_TTL_MS, 50);
const scrapeCache = new TtlCache<ScrapeResponse>(SCRAPE_CACHE_TTL_MS, 50);

/** Clear all web search and scrape caches. Useful for testing or session reset. */
export function clearWebCache(): void {
  searchCache.clear();
  scrapeCache.clear();
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
  const cacheKey = `${query}::${limit}`;

  // Check cache first
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

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

  const result: SearchResponse = { query, results, raw };

  // Cache successful result only
  searchCache.set(cacheKey, result);

  return result;
}

// ─── Scrape URL ─────────────────────────────────────────────
export async function scrapeUrl(url: string, maxChars = 3000): Promise<ScrapeResponse> {
  const cacheKey = `${url}::${maxChars}`;

  // Check cache first
  const cached = scrapeCache.get(cacheKey);
  if (cached) return cached;

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

  const result: ScrapeResponse = { url, title, content: truncated };

  // Cache successful result only
  scrapeCache.set(cacheKey, result);

  return result;
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
      rateLimit: { maxCalls: 10, windowMs: 60_000 },
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
      rateLimit: { maxCalls: 8, windowMs: 60_000 },
      execute: async (args: Record<string, unknown>) => {
        const url = String(args.url ?? "");
        const maxChars = typeof args.maxChars === "number" ? args.maxChars : 3000;
        const result = await scrapeUrl(url, maxChars);
        return `# ${result.title}\n\n${result.content}`;
      },
    },
  };
}

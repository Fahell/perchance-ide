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

/**
 * Result of validating a Jina API key.
 *
 * Discriminated by `ok`:
 * - `{ ok: true }` — key is valid, request returned 2xx
 * - `{ ok: false; code; message }` — validation failed, classified by HTTP status
 *
 * The `code` is machine-readable; callers should map to localized user-facing
 * copy via i18n. The `message` is a short English fallback carrying the
 * underlying cause for logs / non-localized surfaces.
 */
export type JinaValidationResult =
  | { ok: true }
  | { ok: false; code: JinaValidationErrorCode; message: string };

/** Machine-readable classification of Jina validation failure. */
export type JinaValidationErrorCode =
  /** 401 / 403 / unknown 4xx — key invalid, revoked, or rejected */
  | "invalid_key"
  /** 402 — Jina account out of credits or subscription lapsed */
  | "no_credit"
  /** 429 — request rate-limited or quota reached for this period */
  | "rate_limited"
  /** 5xx / timeout / abort / DNS / network failure */
  | "network";

/**
 * Validate a Jina API key by issuing a single lightweight search probe.
 *
 * Unlike webSearch / scrapeUrl which use `retryWithBackoff` for real workloads,
 * validation deliberately issues ONE request without retries:
 * - 401/403/402/429 never succeed on retry (key still bad, credits still empty,
 *   rate still exceeded) — retrying just spends quota and delays user feedback.
 * - 5xx and network errors are passed through as `network` so the user sees
 *   a clear "retry" affordance rather than a confusing auto-retry blister.
 *
 * Returns a discriminated union carrying the HTTP classification.
 */
export async function validateApiKey(key: string): Promise<JinaValidationResult> {
  let res: Response;
  try {
    res = await fetch("https://s.jina.ai/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ q: "test" }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    // Network failure, DNS, AbortError (timeout), etc.
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "network", message: reason || "fetch failed" };
  }

  if (res.ok) return { ok: true };

  const status = res.status;
  const statusText = res.statusText || "";
  const httpLine = `HTTP ${status}${statusText ? ` ${statusText}` : ""}`.trim();

  if (status === 402) {
    return { ok: false, code: "no_credit", message: httpLine };
  }
  if (status === 429) {
    return { ok: false, code: "rate_limited", message: httpLine };
  }
  if (status === 401 || status === 403) {
    return { ok: false, code: "invalid_key", message: httpLine };
  }
  if (status >= 400 && status < 500) {
    // Conservative: any other 4xx is treated as the key being invalid
    // (the client did something the server rejected, not a network problem).
    return { ok: false, code: "invalid_key", message: httpLine };
  }
  if (status >= 500) {
    return { ok: false, code: "network", message: httpLine };
  }
  // Unknown status (1xx, 3xx edge cases) — surface as network so the user
  // sees a retry hint rather than blaming the key.
  return { ok: false, code: "network", message: httpLine };
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

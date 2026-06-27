/**
 * Web search tool using Jina API (CORS-friendly)
 *
 * Search: POST https://s.jina.ai/ with {"q": "query"}
 * Scrape: POST https://r.jina.ai/ with {"url": "url"}
 * Auth: Bearer token required
 */

// Get your Jina AI API key for free: https://jina.ai/?sui=apikey
const JINA_API_KEY = "jina_4cefc39c7f9c4e5e99ffabf239a709b4J1Z5UwXFlX-iw5hg3csfGGruBTo7";

function jinaHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${JINA_API_KEY}`,
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
  const res = await fetch("https://s.jina.ai/", {
    method: "POST",
    headers: jinaHeaders({ "X-Return-Format": "json" }),
    body: JSON.stringify({ q: query, num: limit }),
  });

  if (!res.ok) {
    throw new Error(`Jina search failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // Jina returns an array of results
  const results: SearchResult[] = (data.data || data || []).slice(0, limit).map((item: any) => ({
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
export async function scrapeUrl(url: string, maxChars = 5000): Promise<ScrapeResponse> {
  const res = await fetch("https://r.jina.ai/", {
    method: "POST",
    headers: jinaHeaders({ Accept: "text/markdown" }),
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    throw new Error(`Jina scrape failed: ${res.status} ${res.statusText}`);
  }

  const content = await res.text();

  // Try to extract title from first markdown heading
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch ? titleMatch[1] : new URL(url).hostname;

  // Truncate if too long
  const truncated = content.length > maxChars ? content.slice(0, maxChars) + "\n\n[...truncated]" : content;

  return { url, title, content: truncated };
}

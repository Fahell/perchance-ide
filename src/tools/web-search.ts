/**
 * Web search tool using Jina API (CORS-friendly, no auth required)
 *
 * Search: https://s.jina.ai/{query}
 * Scrape: https://r.jina.ai/{URL}
 */

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
  const url = `https://s.jina.ai/${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Return-Format": "json",
    },
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
  const jinaUrl = `https://r.jina.ai/${url}`;

  const res = await fetch(jinaUrl, {
    headers: {
      Accept: "text/markdown",
    },
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

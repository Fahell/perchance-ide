/**
 * Tool registry — maps tool names to their implementations
 */

import { webSearch, scrapeUrl } from "./web-search.js";

// ─── Tool Definition ────────────────────────────────────────
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, string>;
  execute: (args: Record<string, any>) => Promise<string>;
}

// ─── Registry ───────────────────────────────────────────────
const tools: Record<string, Tool> = {
  web_search: {
    name: "web_search",
    description: "Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",
    parameters: {
      query: "The search query string. Be specific — include topic, year, or context when relevant.",
    },
    execute: async (args) => {
      const result = await webSearch(args.query, 5);
      return result.raw || "No results found.";
    },
  },

  scrape_url: {
    name: "scrape_url",
    description: "Fetch and extract the full text content from a specific URL as markdown. USE this when you have a URL and need to read its content.",
    parameters: {
      url: "The full URL to scrape (must start with http:// or https://)",
    },
    execute: async (args) => {
      const result = await scrapeUrl(args.url, 5000);
      return `# ${result.title}\n\n${result.content}`;
    },
  },
};

// ─── Public API ─────────────────────────────────────────────
export function getTool(name: string): Tool | undefined {
  return tools[name];
}

export function getToolDescriptions(): string {
  return Object.values(tools)
    .map((t) => `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`)
    .join("\n");
}

export function hasTool(name: string): boolean {
  return name in tools;
}

/**
 * Tool registry — maps tool names to their implementations
 */

import { createContextTools } from "./context-tools.js";
import { createTerminalTools } from "./terminal-tools.js";
import { createVfsTools } from "./vfs-tools.js";
import { scrapeUrl, webSearch } from "./web-search.js";

// ─── Tool Definition ────────────────────────────────────────
export interface ToolDefinition<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: { [K in keyof TArgs]: { description: string; type: "string" | "number" | "boolean"; required?: boolean } };
  timeoutMs?: number;
  execute: (args: TArgs) => Promise<string>;
}

/** Non-generic alias for backward compatibility with tool factories. */
export type Tool = ToolDefinition;

// ─── Registry ───────────────────────────────────────────────
const tools: Record<string, Tool> = {
  web_search: {
    name: "web_search",
    description: "Search the web for REAL-TIME or CURRENT information. USE this for: prices, exchange rates, sports results, news, weather, events, recent facts, or anything you are not 100% sure about. Returns up to 5 results with titles, URLs, and descriptions.",
    parameters: {
      query: { description: "The search query string. Be specific — include topic, year, or context when relevant.", type: "string", required: true },
      limit: { description: "Maximum number of results (default 5).", type: "number" },
    },
    timeoutMs: 30_000,
    execute: async (args) => {
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
    execute: async (args) => {
      const url = String(args.url ?? "");
      const maxChars = typeof args.maxChars === "number" ? args.maxChars : 3000;
      const result = await scrapeUrl(url, maxChars);
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
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([key, meta]) => `    ${key} (${meta.type}${meta.required ? ", required" : ""}): ${meta.description}`)
        .join("\n");
      return `- ${t.name}: ${t.description}\n  Parameters:\n${params}`;
    })
    .join("\n");
}

export function hasTool(name: string): boolean {
  return name in tools;
}

// ─── Context Tools ─────────────────────────────────────────
export function initContextTools(): void {
  const contextTools = createContextTools();
  Object.assign(tools, contextTools);
  console.log("🔧 [Tools] Context tools registered:", Object.keys(contextTools).join(", "));
}

// ─── VFS Tools ───────────────────────────────────────────────
export function initVfsTools(): void {
  const vfsTools = createVfsTools();
  Object.assign(tools, vfsTools);
  console.log("📁 [Tools] VFS tools registered:", Object.keys(vfsTools).join(", "));
}

// ─── Terminal Tools ───────────────────────────────────────────
export function initTerminalTools(): void {
  const terminalTools = createTerminalTools();
  Object.assign(tools, terminalTools);
  console.log("🐍 [Tools] Terminal tools registered:", Object.keys(terminalTools).join(", "));
}

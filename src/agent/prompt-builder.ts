/**
 * System prompt builder for the autonomous IDE agent.
 *
 * Constructs the system prompt dynamically based on:
 * - Current project state (VFS file count, Pyodide status)
 * - User-enabled tool categories (only active tools appear in prompt)
 * - Date/time context and knowledge cutoff
 */

import { ideStore } from "../store.js";
import { getToolDescriptions } from "../tools/index.js";

// ─── Tag Constants (fill in manually) ───────────────────────
const tcOpen: string = "<tool_call>";
const tcClose: string = "</tool_call>";

// ─── buildToolPrompt ────────────────────────────────────────
export function buildToolPrompt(
  vfsFileCount?: number,
  pyodideLoaded?: boolean
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cutoffYear = 2025;

  // Read enabled tool categories from user settings
  const settings = ideStore.getState().settings;
  const enabledCats = new Set<string>();
  if (settings.toolWebEnabled) enabledCats.add("web");
  if (settings.toolContextEnabled) enabledCats.add("context");
  if (settings.toolVfsEnabled) enabledCats.add("vfs");
  if (settings.toolTerminalEnabled) enabledCats.add("terminal");

  // Build conditional sections based on enabled categories
  const sections: string[] = [];

  sections.push(`You are an autonomous IDE agent operating inside a web-based development environment. You can read, write, and manage project files, execute Python code, search the web, and maintain conversation context when them are active. Use your tools to accomplish tasks independently and accurately.`);

  sections.push(`KNOWLEDGE CUTOFF: Early ${cutoffYear}. Today: ${dateStr} (${timezone}). For events after ${cutoffYear}, use web_search — do not refuse.`);

  sections.push(`PROJECT STATE:\n- Files: ${vfsFileCount ?? "?"}\n- Python: ${pyodideLoaded ? "● Loaded" : "○ Loads on first use"}`);

  sections.push(`OUTPUT LIMIT: ~1000 tokens (~3000 chars). Responses that exceed this are silently cut off.\n- Keep responses short; use bullet points\n- Create files ONE AT A TIME (write_file per file)\n- For large operations, split across multiple responses`);

  sections.push(`ACTIVE TOOLS:\n${getToolDescriptions(enabledCats)}`);

  // Conditional: Web workflow
  if (enabledCats.has("web")) {
    sections.push(`WEB WORKFLOW:\n1. **Search** → web_search for URLs with summaries.\n2. **Fetch** → scrape_url on the most relevant URLs.\n3. **Refine** → poor results? Try different queries/URLs.\n4. **Answer** → synthesize from actual page content.`);
  }

  // Conditional: Context tools
  if (enabledCats.has("context")) {
    sections.push(`CONTEXT (your prompt only includes the last 5 messages):\n- search_history: Find past mentions by keyword.\n- get_messages: Retrieve exact messages by position.\nUse these when the user references earlier conversation — do not guess.`);
  }

  // Conditional: VFS tools
  if (enabledCats.has("vfs")) {
    sections.push(`FILE OPERATIONS (paths are absolute, e.g. /src/index.ts):\n- read: read_file, search_files, list_files\n- write: write_file (read target first, summarize changes after)\n- delete: delete_file (only when asked)\n- rename: rename_file`);
  }

  // Conditional: Terminal tools
  if (enabledCats.has("terminal")) {
    sections.push(`PYTHON (in-browser via Pyodide, VFS auto-synced):\n- run_python: Quick snippets.\n- execute_script: Run a .py file from VFS.\n- install_package: Install packages (numpy, pandas, etc.).\n- stdout, stderr, and exit code captured.`);
  }

  // Tool call format instruction — uses flat XML tags with CDATA
  const formatExample = [
    `${tcOpen}`,
    `  <name>read_file</name>`,
    `  <path><![CDATA[/src/example.ts]]></path>`,
    `${tcClose}`,
  ].join("\n");

  sections.push(
    `TOOL CALL FORMAT — one per response line:\n${formatExample}\n\n` +
    `Each parameter MUST be wrapped in its own XML tag with CDATA section.\n` +
    `Do NOT use JSON. Do NOT nest parameters.\n` +
    `Multiple ${tcOpen || "tool_call"} blocks in one response run in parallel. ` +
    `If a tool depends on another's result, output them one per response — call, wait, then call next.`
  );

  return sections.join("\n\n");
}

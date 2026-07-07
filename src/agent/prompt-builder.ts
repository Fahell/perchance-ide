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
  if (settings.toolNodeEnabled) enabledCats.add("node");
  if (settings.toolNodeEnabled) enabledCats.add("shell");

  // Build conditional sections based on enabled categories
  const sections: string[] = [];

  sections.push(`You are an autonomous IDE agent operating inside a web-based development environment. You can read, write, and manage project files, execute Python code, search the web, and maintain conversation context when them are active. Use your tools to accomplish tasks independently and accurately.`);

  sections.push(`KNOWLEDGE CUTOFF: Early ${cutoffYear}. Today: ${dateStr} (${timezone}). For events after ${cutoffYear}, use web_search — do not refuse.`);

  const bpStatus = ideStore.getState().browserPodStatus;
  sections.push(`PROJECT STATE:\n- Files: ${vfsFileCount ?? "?"}\n- Python: ${pyodideLoaded ? "● Loaded" : "○ Loads on first use"}\n- Node.js: ${bpStatus === "ready" ? "● Ready (BrowserPod)" : bpStatus === "error" ? "✗ Error" : "○ Not available"}`);

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
    sections.push(`FILE OPERATIONS (paths are absolute, e.g. /home/user/src/index.ts):\n- read: read_file, search_files, list_files\n- write: write_file (read target first, summarize changes after)\n- delete: delete_file (only when asked)\n- rename: rename_file`);
  }

  // Conditional: Terminal tools
  if (enabledCats.has("terminal")) {
    sections.push(`PYTHON (in-browser via Pyodide, VFS auto-synced):\n- run_python: Quick snippets.\n- execute_script: Run a .py file from VFS.\n- install_package: Install packages (numpy, pandas, etc.).\n- stdout, stderr, and exit code captured.`);
  }

  // Conditional: Node.js tools (BrowserPod)
  if (enabledCats.has("node")) {
    const nodeExample1 = [
      `${tcOpen}`,
      `  <name>run_node_script</name>`,
      `  <path><![CDATA[/home/user/hello.js]]></path>`,
      `${tcClose}`,
    ].join("\n");
    const nodeExample2 = [
      `${tcOpen}`,
      `  <name>run_npm_install</name>`,
      `  <packages><![CDATA[express lodash]]></packages>`,
      `${tcClose}`,
    ].join("\n");
    sections.push(`NODE.JS (in-browser via BrowserPod, VFS auto-synced):\n- run_npm_install: Install dependencies from package.json or specific packages.\n- run_node_script: Execute a .js/.mjs file from VFS. Only parameters: path (required), args (optional).\n- execute_npm_command: Run arbitrary npm/npx commands (e.g. "test", "build", "run dev").\n- stdout, stderr, and exit code captured.\n- Use Python tools for .py files; use Node.js tools for .js/.ts/npm workflows.\n⚠️ NEVER pass internal keywords (like "terminal", "node", "npm") as parameter values. The "args" parameter is ONLY for actual script arguments (e.g. "--verbose", "input.txt"). If no extra args are needed, omit the <args> tag entirely.\n\nEXAMPLES:\n${nodeExample1}\n${nodeExample2}`);
  }

  // Conditional: Shell tools (BrowserPod — Bash, Git, HTTP portals)
  if (enabledCats.has("shell")) {
    const shellExample1 = [
      `${tcOpen}`,
      `  <name>run_shell_command</name>`,
      `  <command><![CDATA[ls -la /home/user/src]]></command>`,
      `${tcClose}`,
    ].join("\n");
    const shellExample2 = [
      `${tcOpen}`,
      `  <name>run_git_command</name>`,
      `  <args><![CDATA[status]]></args>`,
      `${tcClose}`,
    ].join("\n");
    const shellExample3 = [
      `${tcOpen}`,
      `  <name>start_http_server</name>`,
      `  <command><![CDATA[node server.js]]></command>`,
      `  <port><![CDATA[3000]]></port>`,
      `${tcClose}`,
    ].join("\n");
    sections.push(`SHELL & SERVICES (in-browser via BrowserPod):
- run_shell_command: Execute safe Bash commands (ls, cat, grep, find, curl, mkdir, cp, mv, rm, node, npm, git, ps, kill, etc.). Whitelist-enforced.
- run_git_command: Native Git operations (status, log, diff, add, commit, branch, checkout). Destructive ops (push, fetch, remote, config) are blocked.
- start_http_server: Start an HTTP server and get a public portal URL. The server runs inside the BrowserPod sandbox.
⚠️ NEVER pass internal keywords (like "terminal", "bash", "shell") as parameter values.

PROJECT STRUCTURE RULE — When creating new projects or scaffolding code:
- Place ALL source code under a dedicated directory (e.g., src/, app/, lib/).
- In package.json, declare "files": ["src/"] (or equivalent) to mark source boundaries.
- Runtime artifacts (node_modules, dist, build, .cache, logs) must NEVER be placed alongside source files.
- Only files matching recognized source extensions (.ts, .js, .json, .md, .html, .css, etc.) and well-known config names (package.json, tsconfig.json, Dockerfile, Makefile, .gitignore, etc.) are synced back to the IDE filesystem. Binary files, logs, and unknown extensions are intentionally excluded.

EXAMPLES:
${shellExample1}
${shellExample2}
${shellExample3}`);
  }

  // Tool call format instruction — uses flat XML tags with CDATA
  const formatExample = [
    `${tcOpen}`,
    `  <name>read_file</name>`,
    `  <path><![CDATA[/home/user/src/example.ts]]></path>`,
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

/**
 * Mapper Agent — subagent that maintains project documentation in _review/.
 *
 * Processes ONE VFS change event per invocation with clean context (no history).
 * Uses a lightweight tool-calling loop with 4 internal tools:
 * read_file, write_file, edit_file, rename_file.
 *
 * These tools operate on raw VFS (no event emission) to avoid infinite loops.
 * The mapper is fire-and-forget, called by the dispatcher after agent idle.
 */

import { getAi } from "./types.js";
import type { VfsChangeEvent } from "./vfs-events.js";
import { scheduleVfsPersist } from "./vfs-persist.js";
import { vfsExists, vfsRead, vfsRename, vfsWrite } from "./vfs.js";

// ─── Tag Constants (fill in manually) ───────────────────────
const tcOpen: string = "<tool_call>";
const tcClose: string = "</tool_call>";

// ─── Constants ──────────────────────────────────────────────
const MAX_ITERATIONS = 15;
const WARN_ITERATIONS = 10;
const REVIEW_DIR = "/_review";
const INDEX_PATH = "/_review/index.md";

/** Valid internal tool names for the mapper agent. */
const MAPPER_TOOLS = new Set(["read_file", "write_file", "edit_file", "rename_file"]);

/** Max characters for injecting file content directly into prompt. */
const MAX_INJECT_CHARS = 12000;

// ─── System Prompt Builder ──────────────────────────────────

function buildMapperSystemPrompt(timestamp: string): string {
  return `You are a Project Mapper. Your ONLY job is to maintain structured documentation of the project in the virtual file system.

CURRENT TIMESTAMP: ${timestamp}
Use this exact timestamp in all "Updated:" fields. Do NOT invent or guess dates.

RULES:
- NEVER evaluate code quality, suggest improvements, or identify bugs.
- ONLY describe structure, interfaces, dependencies, and logic hotspots.
- All summaries go in ${REVIEW_DIR}/ directory.
- Index file: ${INDEX_PATH}
- Individual summaries MUST mirror the FULL source path: ${REVIEW_DIR}/<full-source-path>.md
  Example: /src/pages/index.html → ${REVIEW_DIR}/src/pages/index.html.md
  Example: /src/admin/index.html → ${REVIEW_DIR}/src/admin/index.html.md
  This prevents name collisions when different directories have files with the same name.

EVENT TYPES YOU RECEIVE:
- created: New file. Create summary, update index. If content is provided below, use it directly. Otherwise use read_file.
- modified: File changed. Read existing summary. Use edit_file to update only changed sections. Preserve existing findings. If updated content is provided below, use it directly. Otherwise use read_file.
- deleted: File removed. Remove summary file, update index, update references in other summaries.
- renamed: File moved. Use rename_file to move the summary, then update all references. Do NOT delete+recreate.

SUMMARY FORMAT (${REVIEW_DIR}/<full-source-path>.md):
\`\`\`markdown
# Summary: <source-path>
> Hash: <hash> | Lines: <count> | Updated: <timestamp>

## Interface & Exports
- \`exportName(params): ReturnType\` (L10-L25)

## Dependencies
- Internal: ./relative/path
- External: package-name

## Logic Hotspots
- **Feature name** (L30-L45): Brief description of complex logic

## Cross-References
- Called by: /other/file.ts (L89)
- Calls: /another/file.ts::functionName
\`\`\`

INDEX FORMAT (${INDEX_PATH}):
\`\`\`markdown
# Project Review Index
> Updated: <timestamp> | Files: <count>

| Path | Purpose | Hash |
|------|---------|------|
| src/auth/login.html.md | User authentication | a3f8c2d |
| src/admin/dashboard.html.md | Admin dashboard | b7e1f4a |

## Dependency Graph
auth/login → db/sessions, types/auth
\`\`\`

TOOLS AVAILABLE (use this EXACT syntax to call tools):
Each parameter must be wrapped in its own XML tag with CDATA. Do NOT use JSON.

${tcOpen}<name>read_file</name><path><![CDATA[/src/example.ts]]></path>${tcClose}
  - Reads source code or existing summaries from VFS.
  - Params: path (string, required) — absolute VFS path.
  - Returns file content (truncated to 4000 chars if too large).

${tcOpen}<name>write_file</name><path><![CDATA[/_review/src/example.md]]></path><content><![CDATA[# Summary...]]></content>${tcClose}
  - Creates or overwrites a file in ${REVIEW_DIR}/.
  - Params: path (string, required), content (string, required).
  - Path MUST start with ${REVIEW_DIR}/.

${tcOpen}<name>edit_file</name><file_path><![CDATA[/_review/index.md]]></file_path><old_string><![CDATA[| old/path.md | ...]]></old_string><new_string><![CDATA[| new/path.md | ...]]></new_string>${tcClose}
  - Replaces exactly one occurrence of old_string with new_string in an existing file.
  - Params: file_path (string, required), old_string (string, required), new_string (string, required).
  - Path MUST start with ${REVIEW_DIR}/.
  - Fails if old_string not found or found multiple times. Prefer this over write_file for updates.

${tcOpen}<name>rename_file</name><oldPath><![CDATA[/_review/old/path.md]]></oldPath><newPath><![CDATA[/_review/new/path.md]]></newPath>${tcClose}
  - Renames/moves a file within ${REVIEW_DIR}/. Use for renamed events instead of delete+create.
  - Params: oldPath (string, required), newPath (string, required).
  - Both paths MUST start with ${REVIEW_DIR}/.
  - Creates parent directories automatically. Fails if oldPath does not exist.

IMPORTANT: You can only call ONE tool per response. Wait for the result before calling another tool.

WORKFLOW:
1. If file content is provided below, use it directly. Otherwise read the source file via read_file.
2. Read existing summary if updating (via read_file).
3. Read current index (via read_file).
4. Create/update summary using write_file or edit_file.
5. Update index using edit_file (preferred) or write_file.
6. When done, respond with a brief confirmation message (no more tool calls)`;
}

// ─── Internal Tools (raw VFS, no events) ────────────────────

interface MapperToolResult {
  success: boolean;
  output: string;
}

function mapperReadFile(path: string): MapperToolResult {
  if (!vfsExists(path)) {
    return { success: false, output: `Error: File not found: ${path}` };
  }
  const content = vfsRead(path);
  if (content === null) {
    return { success: false, output: `Error: ${path} is a directory.` };
  }
  // Truncate very large files to stay within token budget
  const maxLen = 4000;
  if (content.length > maxLen) {
    return {
      success: true,
      output: content.slice(0, maxLen) + `\n\n[... truncated, ${content.length} chars total]`,
    };
  }
  return { success: true, output: content };
}

function mapperWriteFile(path: string, content: string): MapperToolResult {
  if (!path.startsWith(REVIEW_DIR)) {
    return { success: false, output: `Error: Mapper can only write to ${REVIEW_DIR}/. Got: ${path}` };
  }
  vfsWrite(path, content);
  scheduleVfsPersist();
  return { success: true, output: `Success: Wrote ${path} (${content.length} bytes)` };
}

function mapperEditFile(
  filePath: string,
  oldString: string,
  newString: string
): MapperToolResult {
  if (!filePath.startsWith(REVIEW_DIR)) {
    return { success: false, output: `Error: Mapper can only edit files in ${REVIEW_DIR}/. Got: ${filePath}` };
  }
  if (!vfsExists(filePath)) {
    return { success: false, output: `Error: File not found: ${filePath}` };
  }
  const content = vfsRead(filePath);
  if (content === null) {
    return { success: false, output: `Error: ${filePath} is a directory.` };
  }

  const idx = content.indexOf(oldString);
  if (idx === -1) {
    return { success: false, output: `Error: old_string not found in ${filePath}. Use read_file to check current content.` };
  }

  // Check for multiple occurrences
  const secondIdx = content.indexOf(oldString, idx + oldString.length);
  if (secondIdx !== -1) {
    return { success: false, output: `Error: old_string found multiple times in ${filePath}. Use a more specific string.` };
  }

  const newContent = content.replace(oldString, newString);
  vfsWrite(filePath, newContent);
  scheduleVfsPersist();
  return { success: true, output: `Success: Edited ${filePath} (replaced 1 occurrence)` };
}

function mapperRenameFile(oldPath: string, newPath: string): MapperToolResult {
  if (!oldPath.startsWith(REVIEW_DIR)) {
    return { success: false, output: `Error: Mapper can only rename files in ${REVIEW_DIR}/. Got: ${oldPath}` };
  }
  if (!newPath.startsWith(REVIEW_DIR)) {
    return { success: false, output: `Error: Mapper can only rename files to ${REVIEW_DIR}/. Got: ${newPath}` };
  }
  if (!vfsExists(oldPath)) {
    return { success: false, output: `Error: Source file not found: ${oldPath}` };
  }

  const ok = vfsRename(oldPath, newPath);
  if (!ok) {
    return { success: false, output: `Error: Failed to rename ${oldPath} → ${newPath}` };
  }
  scheduleVfsPersist();
  return { success: true, output: `Success: Renamed ${oldPath} → ${newPath}` };
}

// ─── Tool Execution Router ──────────────────────────────────

function executeMapperTool(name: string, args: Record<string, any>): string {
  switch (name) {
    case "read_file": {
      const path = String(args.path ?? "");
      if (!path) return "Error: path is required.";
      return mapperReadFile(path).output;
    }
    case "write_file": {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (!path) return "Error: path is required.";
      if (!content) return "Error: content is required.";
      return mapperWriteFile(path, content).output;
    }
    case "edit_file": {
      const filePath = String(args.file_path ?? "");
      const oldStr = String(args.old_string ?? "");
      const newStr = String(args.new_string ?? "");
      if (!filePath) return "Error: file_path is required.";
      if (!oldStr) return "Error: old_string is required.";
      return mapperEditFile(filePath, oldStr, newStr).output;
    }
    case "rename_file": {
      const oldPath = String(args.oldPath ?? "");
      const newPath = String(args.newPath ?? "");
      if (!oldPath) return "Error: oldPath is required.";
      if (!newPath) return "Error: newPath is required.";
      return mapperRenameFile(oldPath, newPath).output;
    }
    default:
      return `Error: Unknown tool '${name}'. Available: read_file, write_file, edit_file, rename_file`;
  }
}

// ─── Tool Call Parser (XML flat-tags + CDATA) ───────────────

interface ToolCall {
  name: string;
  args: Record<string, any>;
}

/**
 * Extract the content of a CDATA section from raw text.
 * Returns the inner text if CDATA wrappers are present, otherwise the raw text trimmed.
 */
function extractCdataContent(raw: string): string {
  const cdataMatch = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdataMatch) return cdataMatch[1];
  return raw.trim();
}

/**
 * Find all top-level tool call blocks using depth-aware matching.
 */
function findToolCallBlocks(text: string): Array<{ name: string; body: string }> {
  if (!tcOpen || !tcClose) return [];

  const blocks: Array<{ name: string; body: string }> = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const openIdx = text.indexOf(tcOpen, searchFrom);
    if (openIdx === -1) break;

    // Find the closing '>' of the opening tag
    const gtIdx = text.indexOf(">", openIdx + tcOpen.length);
    if (gtIdx === -1) {
      searchFrom = openIdx + tcOpen.length;
      continue;
    }

    const contentStart = gtIdx + 1;
    let depth = 1;
    let pos = contentStart;

    while (pos < text.length && depth > 0) {
      const nextOpen = text.indexOf(tcOpen, pos);
      const nextClose = text.indexOf(tcClose, pos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + tcOpen.length;
      } else {
        depth--;
        if (depth === 0) {
          const body = text.slice(contentStart, nextClose);

          // Extract name from <name>...</name> tag inside body
          const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
          if (nameMatch) {
            const name = extractCdataContent(nameMatch[1]);
            blocks.push({ name, body });
          }

          searchFrom = nextClose + tcClose.length;
        } else {
          pos = nextClose + tcClose.length;
        }
      }
    }

    // If we didn't find a matching close, skip this open tag
    if (depth > 0) {
      searchFrom = openIdx + tcOpen.length;
    }
  }

  return blocks;
}

/**
 * Parse individual parameter tags from the body of a tool call block.
 * Each parameter is expected as: <paramName><![CDATA[value]]></paramName>
 */
function parseParams(body: string): Record<string, any> {
  const params: Record<string, any> = {};
  const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = paramRegex.exec(body)) !== null) {
    const [, paramName, rawContent] = match;
    if (paramName === "name") continue;
    params[paramName] = extractCdataContent(rawContent);
  }

  return params;
}

function extractToolCalls(text: string): ToolCall[] {
  const blocks = findToolCallBlocks(text);
  const calls: ToolCall[] = [];

  for (const block of blocks) {
    if (!MAPPER_TOOLS.has(block.name)) continue;

    const args = parseParams(block.body);
    calls.push({ name: block.name, args });
  }

  return calls;
}

// ─── Event Formatting ───────────────────────────────────────

function formatSingleEventForPrompt(event: VfsChangeEvent): string {
  switch (event.type) {
    case "created":
      return `- CREATED: ${event.path} (hash: ${event.currentHash}, size: ${event.size}B)`;
    case "modified":
      return `- MODIFIED: ${event.path} (prev: ${event.previousHash} → curr: ${event.currentHash})`;
    case "deleted":
      return `- DELETED: ${event.path} (was: ${event.previousHash})`;
    case "renamed":
      return `- RENAMED: ${event.fromPath} → ${event.toPath} (hash: ${event.currentHash})`;
    default:
      return `- UNKNOWN: ${event.path}`;
  }
}

/**
 * Try to read file content for injection into the mapper prompt.
 * Returns content if ≤ MAX_INJECT_CHARS, otherwise null (mapper will use read_file).
 */
function tryInjectContent(event: VfsChangeEvent): string | null {
  if (event.type === "deleted" || event.type === "renamed") return null;

  const content = vfsRead(event.path);
  if (content === null) return null;
  if (content.length > MAX_INJECT_CHARS) return null;

  return content;
}

// ─── Filter Events ──────────────────────────────────────────

/**
 * Filter out events for files inside _review/ to avoid self-triggering loops.
 * Also filter non-file events and trivial changes.
 */
function filterMapperEvents(events: VfsChangeEvent[]): VfsChangeEvent[] {
  return events.filter((e) => {
    // Skip review directory changes (self-writes)
    if (e.path.startsWith(REVIEW_DIR + "/")) return false;
    if (e.fromPath?.startsWith(REVIEW_DIR + "/")) return false;
    if (e.toPath?.startsWith(REVIEW_DIR + "/")) return false;

    // Skip no-op modifications
    if (e.type === "modified" && e.previousHash === e.currentHash) return false;

    return true;
  });
}

// ─── Single Event Processing ────────────────────────────────

/**
 * Process a single VFS change event with clean context.
 * Each invocation starts fresh — no accumulated history from previous events.
 */
async function processSingleEvent(event: VfsChangeEvent): Promise<void> {
  const eventDescription = formatSingleEventForPrompt(event);

  // Try to inject file content for small files
  const injectedContent = tryInjectContent(event);

  // Check if index exists
  const indexExists = vfsExists(INDEX_PATH);
  const indexHint = indexExists
    ? `Current index exists at ${INDEX_PATH}. Read it first to understand the project structure.`
    : `No index exists yet. Create ${INDEX_PATH} as part of this run.`;

  // Build initial user message for this single event
  let userMessage = `VFS CHANGE EVENT:\n${eventDescription}\n\n${indexHint}`;

  if (injectedContent !== null) {
    userMessage += `\n\nFILE CONTENT (provided directly — no need to call read_file for this file):\n\`\`\`\n${injectedContent}\n\`\`\``;
  }

  userMessage += `\n\nProcess this event. Create/update summary and update the index.`;

  // Generate neutral ISO 8601 timestamp (no timezone/geographic info)
  const timestamp = new Date().toISOString().slice(0, 19);

  let conversationHistory = userMessage;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (iteration === WARN_ITERATIONS) {
      console.warn(`⚠️ [Mapper] Reached ${WARN_ITERATIONS} iterations for ${event.path} — still processing`);
    }

    const instruction = `${buildMapperSystemPrompt(timestamp)}\n\n---\n\n${conversationHistory}`;

    let resultText: string;
    try {
      const aiResult = await getAi()({ instruction });
      resultText = (aiResult.generatedText || aiResult.text || "").trim();
    } catch (err) {
      console.error(`❌ [Mapper] AI call failed for ${event.path}:`, err);
      return;
    }

    const toolCalls = extractToolCalls(resultText);

    if (toolCalls.length === 0) {
      console.log(`🗺️ [Mapper] Completed ${event.type} ${event.path} in ${iteration + 1} iteration(s)`);
      return;
    }

    // Execute tool calls and build feedback
    const feedbackLines: string[] = [];
    for (const tc of toolCalls) {
      const output = executeMapperTool(tc.name, tc.args);
      feedbackLines.push(`Tool ${tc.name}: ${output}`);
    }

    // Append assistant response + tool results to conversation history
    conversationHistory += `\n\nAssistant: ${resultText}\n\nTool Results:\n${feedbackLines.join("\n")}`;
  }

  console.warn(`⚠️ [Mapper] Reached max iterations (${MAX_ITERATIONS}) for ${event.path}`);
}

// ─── Main Entry Point ───────────────────────────────────────

/**
 * Run the mapper agent for a batch of VFS change events.
 * Processes each event individually with clean context (no history accumulation).
 * Events are processed sequentially to respect API rate limits.
 * Fire-and-forget — caller should .catch() errors.
 */
export async function runMapper(rawEvents: VfsChangeEvent[]): Promise<void> {
  const events = filterMapperEvents(rawEvents);
  if (events.length === 0) {
    console.log("🗺️ [Mapper] No relevant events, skipping");
    return;
  }

  console.log(`🗺️ [Mapper] Processing ${events.length} event(s) individually...`);

  for (const event of events) {
    await processSingleEvent(event);
  }

  console.log(`🗺️ [Mapper] Batch complete (${events.length} event(s))`);
}

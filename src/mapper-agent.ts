/**
 * Mapper Agent — subagent that maintains project documentation in _review/.
 *
 * Consumes VFS change events and uses a lightweight tool-calling loop
 * (max 5 iterations) with 3 internal tools: read_file, write_file, edit_file.
 *
 * These tools operate on raw VFS (no event emission) to avoid infinite loops.
 * The mapper is fire-and-forget, called by the dispatcher after agent idle.
 */

import { getAi } from "./types.js";
import type { VfsChangeEvent } from "./vfs-events.js";
import { scheduleVfsPersist } from "./vfs-persist.js";
import { vfsExists, vfsRead, vfsWrite } from "./vfs.js";

// ─── Constants ──────────────────────────────────────────────
const MAX_ITERATIONS = 5;
const REVIEW_DIR = "/_review";
const INDEX_PATH = "/_review/index.md";
const TOOL_CALL_REGEX = /<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;

// ─── System Prompt ──────────────────────────────────────────
const MAPPER_SYSTEM_PROMPT = `You are a Project Mapper. Your ONLY job is to maintain structured documentation of the project in the virtual file system.

RULES:
- NEVER evaluate code quality, suggest improvements, or identify bugs.
- ONLY describe structure, interfaces, dependencies, and logic hotspots.
- All summaries go in ${REVIEW_DIR}/ directory.
- Index file: ${INDEX_PATH}
- Individual summaries: ${REVIEW_DIR}/<path>.md (mirror source path)

EVENT TYPES YOU RECEIVE:
- created: New file. Read it, create summary, update index.
- modified: File changed. Read updated file + existing summary. Use edit_file to update only changed sections. Preserve existing findings.
- deleted: File removed. Remove summary file, update index, update references in other summaries.
- renamed: File moved. Rename summary file, update all references.

SUMMARY FORMAT (_review/<path>.md):
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
| src/auth/login.md | User authentication | a3f8c2d |

## Dependency Graph
auth/login → db/sessions, types/auth
\`\`\`

TOOLS AVAILABLE (use this EXACT syntax to call tools):

<tool_call name="read_file">{"path": "/src/example.ts"}<\tool_call>
  - Reads source code or existing summaries from VFS.
  - Params: path (string, required) — absolute VFS path.
  - Returns file content (truncated to 4000 chars if too large).

<tool_call name="write_file">{"path": "/_review/src/example.md", "content": "# Summary..."}<\tool_call>
  - Creates or overwrites a file in ${REVIEW_DIR}/.
  - Params: path (string, required), content (string, required).
  - Path MUST start with ${REVIEW_DIR}/.

<tool_call name="edit_file">{"file_path": "/_review/index.md", "old_string": "| old/path.md | ...", "new_string": "| new/path.md | ..."}<\tool_call>
  - Replaces exactly one occurrence of old_string with new_string in an existing file.
  - Params: file_path (string, required), old_string (string, required), new_string (string, required).
  - Path MUST start with ${REVIEW_DIR}/.
  - Fails if old_string not found or found multiple times. Prefer this over write_file for updates.

IMPORTANT: You can only call ONE tool per response. Wait for the result before calling another tool.

WORKFLOW:
1. Read the source file(s) referenced in events
2. Read existing summaries if updating
3. Read current index
4. Create/update summaries using write_file or edit_file
5. Update index using edit_file (preferred) or write_file
6. When done, respond with a brief confirmation message (no more tool calls)`;

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
    default:
      return `Error: Unknown tool '${name}'. Available: read_file, write_file, edit_file`;
  }
}

// ─── Tool Call Parser ───────────────────────────────────────

interface ToolCall {
  name: string;
  args: Record<string, any>;
}

function extractToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;
  TOOL_CALL_REGEX.lastIndex = 0;

  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    const [, name, argsStr] = match;
    try {
      const args = JSON.parse(argsStr);
      calls.push({ name, args });
    } catch {
      console.warn(`[Mapper] Failed to parse tool_call args for '${name}'`);
    }
  }
  return calls;
}

// ─── Event Formatting ───────────────────────────────────────

function formatEventsForPrompt(events: VfsChangeEvent[]): string {
  const lines: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "created":
        lines.push(`- CREATED: ${e.path} (hash: ${e.currentHash}, size: ${e.size}B)`);
        break;
      case "modified":
        lines.push(`- MODIFIED: ${e.path} (prev: ${e.previousHash} → curr: ${e.currentHash})`);
        break;
      case "deleted":
        lines.push(`- DELETED: ${e.path} (was: ${e.previousHash})`);
        break;
      case "renamed":
        lines.push(`- RENAMED: ${e.fromPath} → ${e.toPath} (hash: ${e.currentHash})`);
        break;
    }
  }
  return lines.join("\n");
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

    // Skip directories
    if (e.type === "modified" && e.previousHash === e.currentHash) return false;

    return true;
  });
}

// ─── Main Entry Point ───────────────────────────────────────

/**
 * Run the mapper agent for a batch of VFS change events.
 * Uses a lightweight tool-calling loop (max 5 iterations).
 * Fire-and-forget — caller should .catch() errors.
 */
export async function runMapper(rawEvents: VfsChangeEvent[]): Promise<void> {
  const events = filterMapperEvents(rawEvents);
  if (events.length === 0) {
    console.log("🗺️ [Mapper] No relevant events, skipping");
    return;
  }

  console.log(`🗺️ [Mapper] Processing ${events.length} event(s)...`);

  const eventsDescription = formatEventsForPrompt(events);

  // Check if index exists
  const indexExists = vfsExists(INDEX_PATH);
  const indexHint = indexExists
    ? `Current index exists at ${INDEX_PATH}. Read it first to understand the project structure.`
    : `No index exists yet. Create ${INDEX_PATH} as part of this run.`;

  let conversationHistory = `VFS CHANGE EVENTS:\n${eventsDescription}\n\n${indexHint}\n\nProcess these events. Read source files, create/update summaries, and update the index.`;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const instruction = `${MAPPER_SYSTEM_PROMPT}\n\n---\n\n${conversationHistory}`;

    let resultText: string;
    try {
      const aiResult = await getAi()({ instruction });
      resultText = (aiResult.generatedText || aiResult.text || "").trim();
    } catch (err) {
      console.error("❌ [Mapper] AI call failed:", err);
      return;
    }

    const toolCalls = extractToolCalls(resultText);

    if (toolCalls.length === 0) {
      // No tool calls — mapper is done
      console.log(`🗺️ [Mapper] Completed in ${iteration + 1} iteration(s)`);
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

  console.warn(`⚠️ [Mapper] Reached max iterations (${MAX_ITERATIONS})`);
}

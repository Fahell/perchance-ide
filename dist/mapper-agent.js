/**
 * Mapper Agent — subagent that maintains project documentation in <project>/_map/.
 *
 * Each project (top-level directory in /) has its own _map/ directory containing:
 * - Individual summary files mirroring the project structure
 * - An auto-generated index.md (rebuilt deterministically after each batch)
 *
 * Processes ONE VFS change event per invocation with clean context (no history).
 * Uses a lightweight tool-calling loop with 5 internal tools:
 * read_file, write_file, edit_file, rename_file, delete_file.
 *
 * These tools operate on raw VFS (no event emission) to avoid infinite loops.
 * The mapper is fire-and-forget, called by the dispatcher after agent idle.
 */
import { findToolCallBlocks, parseParams } from "./agent/tool-call-parser.js";
import { getAi } from "./types.js";
import { scheduleVfsPersist } from "./vfs-persist.js";
import { PROJECT_ROOT, vfsExists, vfsGetAll, vfsRead, vfsRename, vfsWrite } from "./vfs.js";
// ─── Tag Constants (fill in manually) ───────────────────────
const tcOpen = "<tool_call>";
const tcClose = "</tool_call>";
// ─── Constants ──────────────────────────────────────────────
const MAX_ITERATIONS = 15;
const WARN_ITERATIONS = 10;
const MAP_DIR_NAME = "_map";
/** Valid internal tool names for the mapper agent. */
const MAPPER_TOOLS = new Set(["read_file", "write_file", "edit_file", "rename_file", "delete_file"]);
/** Max characters for injecting file content directly into prompt. */
const MAX_INJECT_CHARS = 12000;
// ─── Project Detection Helpers ──────────────────────────────
/**
 * Extract project root from an absolute VFS path.
 * Strips PROJECT_ROOT prefix, then returns the first path segment.
 * E.g., "/home/user/gacha-game/index.html" → "gacha-game".
 * Returns null for root-level files (e.g., "/home/user/readme.md").
 */
function getProjectRoot(path) {
    // Strip PROJECT_ROOT prefix to get relative path within user workspace
    let relative = path;
    if (path.startsWith(PROJECT_ROOT)) {
        relative = path.slice(PROJECT_ROOT.length);
    }
    const normalized = relative.startsWith("/") ? relative.slice(1) : relative;
    const slashIdx = normalized.indexOf("/");
    if (slashIdx === -1)
        return null; // root-level file
    const first = normalized.slice(0, slashIdx);
    if (!first || first === MAP_DIR_NAME)
        return null;
    return first;
}
/** Get the _map directory path for a project. */
function getMapDir(projectRoot) {
    return `${PROJECT_ROOT}/${projectRoot}/${MAP_DIR_NAME}`;
}
/** Check if a path is inside any _map/ directory. */
function isInsideMapDir(path) {
    return path.includes(`/${MAP_DIR_NAME}/`);
}
/** Check if a path is a _map/index.md file. */
function isMapIndex(path) {
    return path.endsWith(`/${MAP_DIR_NAME}/index.md`);
}
// ─── System Prompt Builder ──────────────────────────────────
function buildMapperSystemPrompt(timestamp, mapDir) {
    return `You are a Project Mapper. Your ONLY job is to maintain structured documentation of individual files in the virtual file system. You do NOT manage any index file — that is handled automatically by the system.

CURRENT TIMESTAMP: ${timestamp}
Use this exact timestamp in all "Updated:" fields. Do NOT invent or guess dates.

RULES:
- NEVER evaluate code quality, suggest improvements, or identify bugs.
- ONLY describe structure, interfaces, dependencies, and logic hotspots.
- All summaries go in ${mapDir}/ directory.
- Individual summaries MUST mirror the source path relative to the project root: ${mapDir}/<relative-path>.md
  Example: If project root is /my-project and source is /my-project/src/index.html → ${mapDir}/src/index.html.md
  This prevents name collisions when different directories have files with the same name.

EVENT TYPES YOU RECEIVE:
- created: New file. Create summary. If content is provided below, use it directly. Otherwise use read_file.
- modified: File changed. Read existing summary. Use edit_file to update only changed sections. Preserve existing findings. Re-evaluate Purpose if the change alters the file's role. If updated content is provided below, use it directly. Otherwise use read_file.
- deleted: File removed. Remove summary file via delete_file.
- renamed: File moved. Use rename_file to move the summary. Do NOT delete+recreate.

SUMMARY FORMAT (${mapDir}/<relative-path>.md):
\`\`\`markdown
# Summary: <source-path>
> Hash: <hash> | Lines: <count> | Updated: <timestamp> | Purpose: <brief description of file role>

## Interface & Exports
- \`exportName(params): ReturnType\` (L10-L25)

## Dependencies
- Internal: /project-root/path/to/file | optional description (imports, symbols)
- External: package-name

IMPORTANT: For Internal dependencies, ALWAYS use absolute VFS paths starting with / (e.g., /my-project/js/auth.js). ALWAYS use the pipe separator (|) between the path and any description. The path MUST come before the first pipe. Example: \`- Internal: /my-project/settings.py | SCREEN_WIDTH, HEIGHT\`
If there are no internal dependencies, write: \`- Internal: (none)\`

## Logic Hotspots
- **Feature name** (L30-L45): Brief description of complex logic

## Cross-References
- Called by: /other/file.ts (L89)
- Calls: /another/file.ts::functionName
\`\`\`

Purpose is a brief description of the file's role in the project (e.g., "User authentication", "Visual styling and layout", "Gacha pull logic & probability"). On modified events, re-evaluate if the structural change alters the file's purpose and update accordingly.

TOOLS AVAILABLE (use this EXACT syntax to call tools):
Each parameter must be wrapped in its own XML tag with CDATA. Do NOT use JSON.

${tcOpen}<name>read_file</name><path><![CDATA[/src/example.ts]]></path>${tcClose}
  - Reads source code or existing summaries from VFS.
  - Params: path (string, required) — absolute VFS path.
  - Returns file content (truncated to 4000 chars if too large).

${tcOpen}<name>write_file</name><path><![CDATA[${mapDir}/src/example.md]]></path><content><![CDATA[# Summary...]]></content>${tcClose}
  - Creates or overwrites a summary file in ${mapDir}/.
  - Params: path (string, required), content (string, required).
  - Path MUST start with ${mapDir}/.

${tcOpen}<name>edit_file</name><file_path><![CDATA[${mapDir}/src/example.md]]></file_path><old_string><![CDATA[old text]]></old_string><new_string><![CDATA[new text]]></new_string>${tcClose}
  - Replaces exactly one occurrence of old_string with new_string in an existing file.
  - Params: file_path (string, required), old_string (string, required), new_string (string, required).
  - Path MUST start with ${mapDir}/.
  - Fails if old_string not found or found multiple times. Use for targeted summary updates.

${tcOpen}<name>rename_file</name><oldPath><![CDATA[${mapDir}/old/path.md]]></oldPath><newPath><![CDATA[${mapDir}/new/path.md]]></newPath>${tcClose}
  - Renames/moves a file within ${mapDir}/. Use for renamed events instead of delete+create.
  - Params: oldPath (string, required), newPath (string, required).
  - Both paths MUST start with ${mapDir}/.
  - Creates parent directories automatically. Fails if oldPath does not exist.

${tcOpen}<name>delete_file</name><path><![CDATA[${mapDir}/src/old-file.md]]></path>${tcClose}
  - Deletes a summary file from ${mapDir}/. Use for deleted events to remove obsolete summaries.
  - Params: path (string, required) — absolute VFS path within ${mapDir}/.
  - Fails if file does not exist.

IMPORTANT: You can only call ONE tool per response. Wait for the result before calling another tool.

WORKFLOW:
1. If file content is provided below, use it directly. Otherwise read the source file via read_file.
2. Read existing summary if updating (via read_file).
3. Create/update summary using write_file or edit_file.
4. When done, respond with a brief confirmation message (no more tool calls)`;
}
function mapperReadFile(path) {
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
function mapperWriteFile(path, content) {
    if (!isInsideMapDir(path)) {
        return { success: false, output: `Error: Mapper can only write to _map/ directories. Got: ${path}` };
    }
    vfsWrite(path, content);
    scheduleVfsPersist();
    return { success: true, output: `Success: Wrote ${path} (${content.length} bytes)` };
}
function mapperEditFile(filePath, oldString, newString) {
    if (!isInsideMapDir(filePath)) {
        return { success: false, output: `Error: Mapper can only edit files in _map/ directories. Got: ${filePath}` };
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
function mapperRenameFile(oldPath, newPath) {
    if (!isInsideMapDir(oldPath)) {
        return { success: false, output: `Error: Mapper can only rename files in _map/ directories. Got: ${oldPath}` };
    }
    if (!isInsideMapDir(newPath)) {
        return { success: false, output: `Error: Mapper can only rename files to _map/ directories. Got: ${newPath}` };
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
function mapperDeleteFile(path) {
    if (!isInsideMapDir(path)) {
        return { success: false, output: `Error: Mapper can only delete files in _map/ directories. Got: ${path}` };
    }
    if (isMapIndex(path)) {
        return { success: false, output: `Error: Cannot delete the index file itself.` };
    }
    if (!vfsExists(path)) {
        return { success: false, output: `Error: File not found: ${path}` };
    }
    vfsWrite(path, "");
    scheduleVfsPersist();
    return { success: true, output: `Success: Deleted ${path}` };
}
// ─── Tool Execution Router ──────────────────────────────────
function executeMapperTool(name, args) {
    switch (name) {
        case "read_file": {
            const path = String(args.path ?? "");
            if (!path)
                return "Error: path is required.";
            return mapperReadFile(path).output;
        }
        case "write_file": {
            const path = String(args.path ?? "");
            const content = String(args.content ?? "");
            if (!path)
                return "Error: path is required.";
            if (!content)
                return "Error: content is required.";
            return mapperWriteFile(path, content).output;
        }
        case "edit_file": {
            const filePath = String(args.file_path ?? "");
            const oldStr = String(args.old_string ?? "");
            const newStr = String(args.new_string ?? "");
            if (!filePath)
                return "Error: file_path is required.";
            if (!oldStr)
                return "Error: old_string is required.";
            return mapperEditFile(filePath, oldStr, newStr).output;
        }
        case "rename_file": {
            const oldPath = String(args.oldPath ?? "");
            const newPath = String(args.newPath ?? "");
            if (!oldPath)
                return "Error: oldPath is required.";
            if (!newPath)
                return "Error: newPath is required.";
            return mapperRenameFile(oldPath, newPath).output;
        }
        case "delete_file": {
            const path = String(args.path ?? "");
            if (!path)
                return "Error: path is required.";
            return mapperDeleteFile(path).output;
        }
        default:
            return `Error: Unknown tool '${name}'. Available: read_file, write_file, edit_file, rename_file, delete_file`;
    }
}
function extractToolCalls(text) {
    const blocks = findToolCallBlocks(text);
    const calls = [];
    for (const block of blocks) {
        if (!MAPPER_TOOLS.has(block.name))
            continue;
        const args = parseParams(block.body);
        calls.push({ name: block.name, args });
    }
    return calls;
}
// ─── Event Formatting ───────────────────────────────────────
function formatSingleEventForPrompt(event) {
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
function tryInjectContent(event) {
    if (event.type === "deleted" || event.type === "renamed")
        return null;
    const content = vfsRead(event.path);
    if (content === null)
        return null;
    if (content.length > MAX_INJECT_CHARS)
        return null;
    return content;
}
// ─── Filter Events ──────────────────────────────────────────
/**
 * Filter out events for files inside _map/ to avoid self-triggering loops.
 * Also filter root-level files (no project) and trivial changes.
 */
function filterMapperEvents(events) {
    return events.filter((e) => {
        // Skip _map directory changes (self-writes)
        if (isInsideMapDir(e.path))
            return false;
        if (e.fromPath && isInsideMapDir(e.fromPath))
            return false;
        if (e.toPath && isInsideMapDir(e.toPath))
            return false;
        // Skip root-level files (no project directory)
        if (!getProjectRoot(e.path))
            return false;
        // Skip no-op modifications
        if (e.type === "modified" && e.previousHash === e.currentHash)
            return false;
        return true;
    });
}
// ─── Single Event Processing ────────────────────────────────
/**
 * Process a single VFS change event with clean context.
 * Each invocation starts fresh — no accumulated history from previous events.
 * @param event The VFS change event to process
 * @param projectRoot The project root directory name
 */
async function processSingleEvent(event, projectRoot) {
    const mapDir = getMapDir(projectRoot);
    const eventDescription = formatSingleEventForPrompt(event);
    // Try to inject file content for small files
    const injectedContent = tryInjectContent(event);
    // Build initial user message for this single event
    let userMessage = `VFS CHANGE EVENT:\n${eventDescription}`;
    if (injectedContent !== null) {
        userMessage += `\n\nFILE CONTENT (provided directly — no need to call read_file for this file):\n\`\`\`\n${injectedContent}\n\`\`\``;
    }
    userMessage += `\n\nProcess this event. Create or update the summary.`;
    // Generate neutral ISO 8601 timestamp (no timezone/geographic info)
    const timestamp = new Date().toISOString().slice(0, 19);
    let conversationHistory = userMessage;
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        if (iteration === WARN_ITERATIONS) {
            console.warn(`⚠️ [Mapper] Reached ${WARN_ITERATIONS} iterations for ${event.path} — still processing`);
        }
        const instruction = `${buildMapperSystemPrompt(timestamp, mapDir)}\n\n---\n\n${conversationHistory}`;
        let resultText;
        try {
            const aiResult = await getAi()({ instruction });
            resultText = (aiResult.generatedText || aiResult.text || "").trim();
        }
        catch (err) {
            console.error(`❌ [Mapper] AI call failed for ${event.path}:`, err);
            return;
        }
        const toolCalls = extractToolCalls(resultText);
        if (toolCalls.length === 0) {
            console.log(`🗺️ [Mapper] Completed ${event.type} ${event.path} in ${iteration + 1} iteration(s)`);
            return;
        }
        // Execute tool calls and build feedback
        const feedbackLines = [];
        for (const tc of toolCalls) {
            const output = executeMapperTool(tc.name, tc.args);
            feedbackLines.push(`Tool ${tc.name}: ${output}`);
        }
        // Append assistant response + tool results to conversation history
        conversationHistory += `\n\nAssistant: ${resultText}\n\nTool Results:\n${feedbackLines.join("\n")}`;
    }
    console.warn(`⚠️ [Mapper] Reached max iterations (${MAX_ITERATIONS}) for ${event.path}`);
}
/**
 * Parse metadata from a summary markdown file.
 * Returns null if the file doesn't have the expected header format.
 */
export function parseSummaryMeta(content, relativePath) {
    // Match: > Hash: <hash> | Lines: <count> | Updated: <timestamp> | Purpose: <purpose>
    const headerMatch = content.match(/^>\s*Hash:\s*(\S+)\s*\|\s*Lines:\s*(\d+)\s*\|\s*Updated:\s*\S+\s*\|\s*Purpose:\s*(.+)$/m);
    if (!headerMatch)
        return null;
    const hash = headerMatch[1];
    const lines = parseInt(headerMatch[2], 10);
    const purpose = headerMatch[3].trim();
    // Extract internal dependencies: lines matching "- Internal: <path> | <desc>"
    // The path is everything before the first pipe (or end of line if no pipe)
    const internalDeps = [];
    const depRegex = /^-\s*Internal:\s*(.+)$/gm;
    let depMatch;
    while ((depMatch = depRegex.exec(content)) !== null) {
        const raw = depMatch[1].trim();
        const lower = raw.toLowerCase();
        if (!raw || lower === "none" || lower === "(none)" || lower === "n/a")
            continue;
        // Split by pipe and take only the first part (the path)
        const pathPart = raw.split("|")[0].trim();
        const ppLower = pathPart.toLowerCase();
        if (pathPart && ppLower !== "none" && ppLower !== "(none)" && ppLower !== "n/a") {
            internalDeps.push(pathPart);
        }
    }
    return { path: relativePath, hash, lines, purpose, internalDeps };
}
/**
 * Rebuild the project index deterministically from summary files.
 * Lists all .md files in the map directory, parses their metadata,
 * and generates a complete index with Files table, Dependency Graph,
 * Reverse Lookup, Entry Points, and Leaves sections.
 *
 * @param mapDir The _map directory path (e.g., "/gacha-game/_map")
 */
export function rebuildIndex(mapDir) {
    const indexPath = `${mapDir}/index.md`;
    const prefix = mapDir.endsWith("/") ? mapDir : mapDir + "/";
    // Collect all summary .md files (exclude index.md itself)
    const allEntries = vfsGetAll();
    const summaryFiles = [];
    for (const entry of allEntries) {
        if (entry.type !== "file")
            continue;
        if (!entry.path.startsWith(prefix))
            continue;
        if (!entry.path.endsWith(".md"))
            continue;
        if (entry.path === indexPath)
            continue;
        const relativePath = entry.path.slice(prefix.length);
        summaryFiles.push({ path: entry.path, relativePath });
    }
    // Parse metadata from each summary
    const metas = [];
    for (const sf of summaryFiles) {
        const content = vfsRead(sf.path);
        if (content === null)
            continue;
        const meta = parseSummaryMeta(content, sf.relativePath);
        if (meta)
            metas.push(meta);
    }
    // Sort by path for deterministic output
    metas.sort((a, b) => a.path.localeCompare(b.path));
    // Build Files table
    const timestamp = new Date().toISOString().slice(0, 19);
    const fileRows = metas.map((m) => `| ${m.path} | ${m.purpose} | ${m.hash} |`);
    // Build Dependency Graph: source → targets
    const depGraphLines = [];
    for (const m of metas) {
        const targets = m.internalDeps.length > 0 ? m.internalDeps.join(", ") : "(none)";
        const sourceDisplay = m.path.replace(/\.md$/, "");
        depGraphLines.push(`${sourceDisplay} → ${targets}`);
    }
    // Build Reverse Lookup: target ← sources
    const reverseMap = new Map();
    for (const m of metas) {
        for (const dep of m.internalDeps) {
            const existing = reverseMap.get(dep) || [];
            const sourceDisplay = m.path.replace(/\.md$/, "");
            existing.push(sourceDisplay);
            reverseMap.set(dep, existing);
        }
    }
    const reverseLines = [];
    for (const [target, sources] of [...reverseMap.entries()].sort()) {
        reverseLines.push(`${target} ← ${sources.join(", ")}`);
    }
    // Entry Points: files with no incoming dependencies
    const allTargets = new Set();
    for (const m of metas) {
        for (const dep of m.internalDeps) {
            allTargets.add(dep);
        }
    }
    const entryPoints = metas
        .filter((m) => {
        const display = m.path.replace(/\.md$/, "");
        return !allTargets.has(display);
    })
        .map((m) => `- ${m.path.replace(/\.md$/, "")}`);
    // Leaves: files with no outgoing dependencies
    const leaves = metas
        .filter((m) => m.internalDeps.length === 0)
        .map((m) => `- ${m.path.replace(/\.md$/, "")}`);
    // Assemble index markdown
    const sections = [
        `# Project Review Index`,
        `> Updated: ${timestamp} | Files: ${metas.length}`,
        ``,
        `## Files`,
        `| Path | Purpose | Hash |`,
        `|------|---------|------|`,
        ...fileRows,
        ``,
        `## Dependency Graph`,
        `> Source → depends on → Targets`,
        ``,
        ...depGraphLines,
    ];
    if (reverseLines.length > 0) {
        sections.push(``, `## Reverse Lookup`, `> Target ← is used by ← Sources`, ``, ...reverseLines);
    }
    if (entryPoints.length > 0) {
        sections.push(``, `## Entry Points`, `> Files with no incoming dependencies (start here)`, ``, ...entryPoints);
    }
    if (leaves.length > 0) {
        sections.push(``, `## Leaves`, `> Files with no outgoing dependencies (safe to change)`, ``, ...leaves);
    }
    const indexContent = sections.join("\n") + "\n";
    vfsWrite(indexPath, indexContent);
    scheduleVfsPersist();
}
// ─── Main Entry Point ───────────────────────────────────────
/**
 * Run the mapper agent for a batch of VFS change events.
 * Processes each event individually with clean context (no history accumulation).
 * Groups events by project and rebuilds each project's index once after all
 * its events are processed.
 * Fire-and-forget — caller should .catch() errors.
 */
export async function runMapper(rawEvents) {
    const events = filterMapperEvents(rawEvents);
    if (events.length === 0) {
        console.log("🗺️ [Mapper] No relevant events, skipping");
        return;
    }
    console.log(`🗺️ [Mapper] Processing ${events.length} event(s) individually...`);
    // Group events by project to know which indexes to rebuild
    const affectedProjects = new Set();
    for (const event of events) {
        const projectRoot = getProjectRoot(event.path);
        if (!projectRoot)
            continue;
        affectedProjects.add(projectRoot);
        await processSingleEvent(event, projectRoot);
    }
    // Rebuild index once per affected project (skip if _map/ was deleted with the project)
    for (const projectRoot of affectedProjects) {
        const mapDir = getMapDir(projectRoot);
        if (!vfsExists(mapDir)) {
            console.log(`🗺️ [Mapper] Skipping index rebuild for /${projectRoot} — _map/ directory no longer exists`);
            continue;
        }
        console.log(`🗺️ [Mapper] Rebuilding index for /${projectRoot}`);
        rebuildIndex(mapDir);
    }
    console.log(`🗺️ [Mapper] Batch complete (${events.length} event(s), ${affectedProjects.size} project(s))`);
}

/**
 * VFS Tools — agent-accessible tools for reading, writing, and managing files
 * in the Virtual File System.
 *
 * All tools operate within the VFS sandbox (in-memory, IndexedDB-backed).
 * No host file system access.
 *
 * Each tool returns descriptive strings (success or error) — never throws.
 */
import { dbSaveVfs } from "../db.js";
import { ideStore } from "../store.js";
import { setDiff } from "../utils/diff-cache.js";
import { truncateOutput } from "../utils/truncate.js";
import { vfsDeleteTree, vfsExists, vfsGetAll, vfsRead, vfsRename, vfsTree, vfsWrite, } from "../vfs.js";
// ─── Persistence ────────────────────────────────────────────
async function persistVfs() {
    try {
        await dbSaveVfs(vfsGetAll());
    }
    catch (e) {
        console.warn("[VfsTools] dbSaveVfs failed:", e);
    }
}
// ─── Helpers ────────────────────────────────────────────────
function formatTreeNode(node, indent = "") {
    const prefix = node.type === "dir" ? "📁 " : "📄 ";
    let result = indent + prefix + node.name + "\n";
    if (node.children) {
        for (const child of node.children) {
            result += formatTreeNode(child, indent + "  ");
        }
    }
    return result;
}
function countEntries(path) {
    const prefix = path === "/" ? "/" : path + "/";
    return vfsGetAll().filter((e) => e.path === path || e.path.startsWith(prefix)).length;
}
/** Find all occurrences of `search` in `content` with line numbers and surrounding context. */
function findOccurrences(content, search) {
    const occurrences = [];
    let startIndex = 0;
    const searchLen = search.length;
    while (true) {
        const idx = content.indexOf(search, startIndex);
        if (idx === -1)
            break;
        // Compute line number (1-based)
        const prefix = content.slice(0, idx);
        const line = prefix.split("\n").length;
        // Context: ~15 chars before and after
        const ctxStart = Math.max(0, idx - 15);
        const ctxEnd = Math.min(content.length, idx + searchLen + 15);
        let context = content.slice(ctxStart, ctxEnd);
        if (ctxStart > 0)
            context = "..." + context;
        if (ctxEnd < content.length)
            context = context + "...";
        occurrences.push({ index: idx, line, context });
        startIndex = idx + searchLen;
    }
    return occurrences;
}
// ─── Tool Factory ───────────────────────────────────────────
export function createVfsTools() {
    return {
        read_file: {
            name: "read_file",
            description: "Read the contents of a file from the project's virtual file system. Returns the file content (max 5000 characters). Use this to examine code, configs, documentation, or any text file in the project.",
            parameters: {
                path: { description: "Absolute path of the file to read (e.g., /src/index.ts). Must start with /.", type: "string", required: true },
            },
            timeoutMs: 15_000,
            execute: async (args) => {
                const path = String(args.path ?? "");
                if (!path)
                    return "Error: path is required.";
                if (!vfsExists(path))
                    return `Error: File not found: ${path}`;
                const content = vfsRead(path);
                if (content === null)
                    return `Error: ${path} is a directory, not a file.`;
                const maxLen = 5000;
                if (content.length > maxLen) {
                    return truncateOutput(content, maxLen);
                }
                return content;
            },
        },
        write_file: {
            name: "write_file",
            description: "Create a new file or overwrite an existing file in the project's virtual file system. Parent directories are created automatically. The file will be persisted to IndexedDB. If the file is currently open in the editor, it will be marked as modified (dirty).",
            parameters: {
                path: { description: "Absolute path of the file to write (e.g., /src/utils/helpers.ts). Must start with /.", type: "string", required: true },
                content: { description: "The full text content to write to the file.", type: "string" },
            },
            timeoutMs: 15_000,
            execute: async (args) => {
                const path = String(args.path ?? "");
                const content = String(args.content ?? "");
                if (!path)
                    return "Error: path is required.";
                if (!path.startsWith("/"))
                    return "Error: path must be absolute (start with /).";
                // Capture before content for diff view (11.1)
                const oldContent = vfsRead(path);
                vfsWrite(path, content);
                // Store diff data if file was modified
                if (oldContent !== null && oldContent !== content) {
                    setDiff(path, oldContent, content);
                }
                // Mark tab as dirty if file is open in editor
                const state = ideStore.getState();
                if (state.files.some((f) => f.path === path)) {
                    state.setFileDirty(path, true);
                }
                state.bumpVfsVersion();
                await persistVfs();
                const size = content.length;
                const isNew = oldContent === null;
                return `Success: ${isNew ? "Created" : "Updated"} ${path} (${size} byte${size === 1 ? "" : "s"})`;
            },
        },
        list_files: {
            name: "list_files",
            description: "List files and folders in a directory of the virtual file system. Returns a formatted tree view with icons (📁 for folders, 📄 for files). Use this to explore the project structure.",
            parameters: {
                dir: { description: "Directory path to list (default: /). Example: /src", type: "string" },
            },
            timeoutMs: 15_000,
            execute: async (args) => {
                const dir = String(args.dir ?? "/");
                if (!vfsExists(dir))
                    return `Error: Directory not found: ${dir}`;
                const tree = vfsTree(dir);
                if (tree.length === 0)
                    return `(empty directory: ${dir})`;
                let result = `Contents of ${dir}:\n`;
                for (const node of tree) {
                    result += formatTreeNode(node);
                }
                return truncateOutput(result.trimEnd(), 100, 'lines');
            },
        },
        search_files: {
            name: "search_files",
            description: "Search for files in the virtual file system by name or content (case-insensitive). Returns matching file paths with a content snippet (first 200 characters). Useful for finding where a function, variable, or concept is used in the project.",
            parameters: {
                query: { description: "The text to search for in file names and file contents (case-insensitive).", type: "string", required: true },
                maxResults: { description: "Maximum number of results to return (default 10, max 20).", type: "number" },
            },
            timeoutMs: 15_000,
            execute: async (args) => {
                const query = String(args.query ?? "").toLowerCase();
                if (!query.trim())
                    return "Error: query is required.";
                const maxResults = Math.min(20, Math.max(1, Number(args.maxResults) || 10));
                const allEntries = vfsGetAll();
                const results = [];
                for (const entry of allEntries) {
                    if (entry.type !== "file")
                        continue;
                    const nameMatch = entry.path.toLowerCase().includes(query);
                    const contentMatch = entry.content.toLowerCase().includes(query);
                    if (!nameMatch && !contentMatch)
                        continue;
                    const snippet = entry.content.slice(0, 200).replace(/\n/g, " ").trim();
                    const matchType = nameMatch
                        ? contentMatch
                            ? "name+content"
                            : "name"
                        : "content";
                    results.push(`${entry.path} (${matchType}): "${snippet}${entry.content.length > 200 ? "..." : ""}"`);
                    if (results.length >= maxResults)
                        break;
                }
                if (results.length === 0)
                    return `No files found matching "${args.query}".`;
                return `Found ${results.length} file${results.length === 1 ? "" : "s"} matching "${args.query}":\n${results.join("\n")}`;
            },
        },
        delete_file: {
            name: "delete_file",
            description: "Delete a file or folder (recursively) from the virtual file system. If any open editor tabs point to the deleted path, they will be closed automatically. Changes are persisted to IndexedDB. Use with caution — this operation cannot be undone.",
            parameters: {
                path: { description: "Absolute path of the file or folder to delete (e.g., /src/old-file.ts). Cannot delete root (/).", type: "string", required: true },
            },
            timeoutMs: 15_000,
            execute: async (args) => {
                const path = String(args.path ?? "");
                if (!path)
                    return "Error: path is required.";
                if (!vfsExists(path))
                    return `Error: Path not found: ${path}`;
                const count = countEntries(path);
                const success = vfsDeleteTree(path);
                if (!success)
                    return `Error: Could not delete ${path}.`;
                // Close any open tabs with this path or descendants
                const state = ideStore.getState();
                for (const f of [...state.files]) {
                    if (f.path === path || f.path.startsWith(path + "/")) {
                        state.closeFile(f.path);
                    }
                }
                await persistVfs();
                const label = count > 1 ? ` (${count} entries)` : "";
                return `Success: Deleted ${path}${label}`;
            },
        },
        rename_file: {
            name: "rename_file",
            description: "Rename or move a file or folder within the virtual file system. If the renamed file is currently open in the editor, its tab will be updated to reflect the new path. Cannot overwrite an existing path. Changes are persisted to IndexedDB.",
            parameters: {
                oldPath: { description: "Current absolute path of the file or folder (e.g., /src/old-name.ts).", type: "string", required: true },
                newPath: { description: "New absolute path (e.g., /src/new-name.ts). Must not already exist.", type: "string", required: true },
            },
            timeoutMs: 15_000,
            execute: async (args) => {
                const oldPath = String(args.oldPath ?? "");
                const newPath = String(args.newPath ?? "");
                if (!oldPath)
                    return "Error: oldPath is required.";
                if (!newPath)
                    return "Error: newPath is required.";
                if (!vfsExists(oldPath))
                    return `Error: Path not found: ${oldPath}`;
                if (vfsExists(newPath))
                    return `Error: Target already exists: ${newPath}`;
                const success = vfsRename(oldPath, newPath);
                if (!success)
                    return `Error: Could not rename ${oldPath} to ${newPath}.`;
                // Update open tabs (close old path, open new path)
                const state = ideStore.getState();
                for (const f of [...state.files]) {
                    if (f.path === oldPath) {
                        state.closeFile(oldPath);
                        const ext = newPath.split(".").pop()?.toLowerCase() ?? "js";
                        state.openFile(newPath, newPath.split("/").filter(Boolean).pop() ?? newPath, ext);
                    }
                    else if (f.path.startsWith(oldPath + "/")) {
                        const newTabPath = newPath + f.path.slice(oldPath.length);
                        state.closeFile(f.path);
                        const ext = newTabPath.split(".").pop()?.toLowerCase() ?? "js";
                        state.openFile(newTabPath, newTabPath.split("/").filter(Boolean).pop() ?? newTabPath, ext);
                    }
                }
                await persistVfs();
                return `Success: Renamed ${oldPath} → ${newPath}`;
            },
        },
        edit_file: {
            name: "edit_file",
            description: "Edit a file by replacing exact text. Safer than write_file for partial edits — only modifies the specified string. Returns error if old_string is not found or matches multiple locations.",
            parameters: {
                file_path: { description: "Absolute path of the file to edit (e.g., /src/utils/helpers.ts). Must start with /.", type: "string", required: true },
                old_string: { description: "The exact text to search for and replace. Must match exactly — whitespace, indentation, and line endings matter.", type: "string", required: true },
                new_string: { description: "The replacement text.", type: "string", required: true },
            },
            timeoutMs: 15_000,
            execute: async (args) => {
                const filePath = String(args.file_path ?? "");
                const oldString = String(args.old_string ?? "");
                const newString = String(args.new_string ?? "");
                if (!filePath)
                    return "Error: file_path is required.";
                if (!oldString)
                    return "Error: old_string is required.";
                if (!filePath.startsWith("/"))
                    return "Error: path must be absolute (start with /).";
                if (!vfsExists(filePath))
                    return `Error: File not found: ${filePath}`;
                const content = vfsRead(filePath);
                if (content === null)
                    return `Error: ${filePath} is a directory, not a file.`;
                const occurrences = findOccurrences(content, oldString);
                if (occurrences.length === 0) {
                    return `Error: old_string not found in ${filePath}.\n\nSuggestions:\n- Check that the file_path is correct (the file exists).\n- Check exact whitespace, indentation, and line endings.\n- Use read_file to see the current file content.\n- Use write_file if you need to overwrite the entire file.`;
                }
                if (occurrences.length > 1) {
                    const details = occurrences
                        .map((o, i) => `  ${i + 1}. Line ${o.line}: ...${o.context}...`)
                        .join("\n");
                    return `Error: old_string found ${occurrences.length} times in ${filePath}. Use a more specific string to match only one location, or use write_file for full overwrite.\n\nOccurrences:\n${details}`;
                }
                // Exactly 1 match — do the replacement
                const newContent = content.replace(oldString, newString);
                // Store diff data
                setDiff(filePath, content, newContent);
                vfsWrite(filePath, newContent);
                // Mark tab as dirty if file is open in editor
                const state = ideStore.getState();
                if (state.files.some((f) => f.path === filePath)) {
                    state.setFileDirty(filePath, true);
                }
                state.bumpVfsVersion();
                await persistVfs();
                const size = newContent.length;
                return `Success: Edited ${filePath} (replaced 1 occurrence, ${size} byte${size === 1 ? "" : "s"})`;
            },
        },
    };
}

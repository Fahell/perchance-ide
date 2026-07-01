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
import { truncateOutput } from "../utils/truncate.js";
import {
  vfsDeleteTree,
  vfsExists,
  vfsGetAll,
  vfsRead,
  vfsRename,
  vfsTree,
  vfsWrite,
  type VfsTreeNode,
} from "../vfs.js";
import type { Tool } from "./index.js";

// ─── Persistence ────────────────────────────────────────────
async function persistVfs(): Promise<void> {
  try {
    await dbSaveVfs(vfsGetAll());
  } catch (e) {
    console.warn("[VfsTools] dbSaveVfs failed:", e);
  }
}

// ─── Helpers ────────────────────────────────────────────────
function formatTreeNode(node: VfsTreeNode, indent: string = ""): string {
  const prefix = node.type === "dir" ? "📁 " : "📄 ";
  let result = indent + prefix + node.name + "\n";
  if (node.children) {
    for (const child of node.children) {
      result += formatTreeNode(child, indent + "  ");
    }
  }
  return result;
}

function countEntries(path: string): number {
  const prefix = path === "/" ? "/" : path + "/";
  return vfsGetAll().filter((e) => e.path === path || e.path.startsWith(prefix)).length;
}

// ─── Tool Factory ───────────────────────────────────────────
export function createVfsTools(): Record<string, Tool> {
  return {
    read_file: {
      name: "read_file",
      description:
        "Read the contents of a file from the project's virtual file system. Returns the file content (max 5000 characters). Use this to examine code, configs, documentation, or any text file in the project.",
      parameters: {
        path: "Absolute path of the file to read (e.g., /src/index.ts). Must start with /.",
      },
      timeoutMs: 15_000,
      execute: async (args) => {
        const path = String(args.path || "");
        if (!path) return "Error: path is required.";
        if (!vfsExists(path)) return `Error: File not found: ${path}`;
        const content = vfsRead(path);
        if (content === null) return `Error: ${path} is a directory, not a file.`;
        const maxLen = 5000;
        if (content.length > maxLen) {
          return truncateOutput(content, maxLen);
        }
        return content;
      },
    },

    write_file: {
      name: "write_file",
      description:
        "Create a new file or overwrite an existing file in the project's virtual file system. Parent directories are created automatically. The file will be persisted to IndexedDB. If the file is currently open in the editor, it will be marked as modified (dirty).",
      parameters: {
        path: "Absolute path of the file to write (e.g., /src/utils/helpers.ts). Must start with /.",
        content: "The full text content to write to the file.",
      },
      timeoutMs: 15_000,
      execute: async (args) => {
        const path = String(args.path || "");
        const content = String(args.content || "");
        if (!path) return "Error: path is required.";
        if (!path.startsWith("/")) return "Error: path must be absolute (start with /).";

        const before = vfsGetAll().length;
        vfsWrite(path, content);
        const after = vfsGetAll().length;
        const isNew = after > before;

        // Mark tab as dirty if file is open in editor
        const state = ideStore.getState();
        if (state.files.some((f) => f.path === path)) {
          state.setFileDirty(path, true);
        }

        await persistVfs();
        const size = content.length;
        return `Success: ${isNew ? "Created" : "Updated"} ${path} (${size} byte${size === 1 ? "" : "s"})`;
      },
    },

    list_files: {
      name: "list_files",
      description:
        "List files and folders in a directory of the virtual file system. Returns a formatted tree view with icons (📁 for folders, 📄 for files). Use this to explore the project structure.",
      parameters: {
        dir: "Directory path to list (default: /). Example: /src",
      },
      timeoutMs: 15_000,
      execute: async (args) => {
        const dir = String(args.dir || "/");
        if (!vfsExists(dir)) return `Error: Directory not found: ${dir}`;
        const tree = vfsTree(dir);
        if (tree.length === 0) return `(empty directory: ${dir})`;
        let result = `Contents of ${dir}:\n`;
        for (const node of tree) {
          result += formatTreeNode(node);
        }
        return truncateOutput(result.trimEnd(), 100, 'lines');
      },
    },

    search_files: {
      name: "search_files",
      description:
        "Search for files in the virtual file system by name or content (case-insensitive). Returns matching file paths with a content snippet (first 200 characters). Useful for finding where a function, variable, or concept is used in the project.",
      parameters: {
        query: "The text to search for in file names and file contents (case-insensitive).",
        maxResults: "Maximum number of results to return (default 10, max 20).",
      },
      timeoutMs: 15_000,
      execute: async (args) => {
        const query = String(args.query || "").toLowerCase();
        if (!query.trim()) return "Error: query is required.";
        const maxResults = Math.min(20, Math.max(1, Number(args.maxResults) || 10));

        const allEntries = vfsGetAll();
        const results: string[] = [];
        for (const entry of allEntries) {
          if (entry.type !== "file") continue;
          const nameMatch = entry.path.toLowerCase().includes(query);
          const contentMatch = entry.content.toLowerCase().includes(query);
          if (!nameMatch && !contentMatch) continue;
          const snippet = entry.content.slice(0, 200).replace(/\n/g, " ").trim();
          const matchType = nameMatch
            ? contentMatch
              ? "name+content"
              : "name"
            : "content";
          results.push(
            `${entry.path} (${matchType}): "${snippet}${entry.content.length > 200 ? "..." : ""}"`
          );
          if (results.length >= maxResults) break;
        }

        if (results.length === 0) return `No files found matching "${args.query}".`;
        return `Found ${results.length} file${results.length === 1 ? "" : "s"} matching "${args.query}":\n${results.join("\n")}`;
      },
    },

    delete_file: {
      name: "delete_file",
      description:
        "Delete a file or folder (recursively) from the virtual file system. If any open editor tabs point to the deleted path, they will be closed automatically. Changes are persisted to IndexedDB. Use with caution — this operation cannot be undone.",
      parameters: {
        path: "Absolute path of the file or folder to delete (e.g., /src/old-file.ts). Cannot delete root (/).",
      },
      timeoutMs: 15_000,
      execute: async (args) => {
        const path = String(args.path || "");
        if (!path) return "Error: path is required.";
        if (!vfsExists(path)) return `Error: Path not found: ${path}`;

        const count = countEntries(path);
        const success = vfsDeleteTree(path);
        if (!success) return `Error: Could not delete ${path}.`;

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
      description:
        "Rename or move a file or folder within the virtual file system. If the renamed file is currently open in the editor, its tab will be updated to reflect the new path. Cannot overwrite an existing path. Changes are persisted to IndexedDB.",
      parameters: {
        oldPath: "Current absolute path of the file or folder (e.g., /src/old-name.ts).",
        newPath: "New absolute path (e.g., /src/new-name.ts). Must not already exist.",
      },
      timeoutMs: 15_000,
      execute: async (args) => {
        const oldPath = String(args.oldPath || "");
        const newPath = String(args.newPath || "");
        if (!oldPath) return "Error: oldPath is required.";
        if (!newPath) return "Error: newPath is required.";
        if (!vfsExists(oldPath)) return `Error: Path not found: ${oldPath}`;
        if (vfsExists(newPath)) return `Error: Target already exists: ${newPath}`;

        const success = vfsRename(oldPath, newPath);
        if (!success) return `Error: Could not rename ${oldPath} to ${newPath}.`;

        // Update open tabs (close old path, open new path)
        const state = ideStore.getState();
        for (const f of [...state.files]) {
          if (f.path === oldPath) {
            state.closeFile(oldPath);
            const ext = newPath.split(".").pop()?.toLowerCase() ?? "js";
            state.openFile(
              newPath,
              newPath.split("/").filter(Boolean).pop() ?? newPath,
              ext
            );
          } else if (f.path.startsWith(oldPath + "/")) {
            const newTabPath = newPath + f.path.slice(oldPath.length);
            state.closeFile(f.path);
            const ext = newTabPath.split(".").pop()?.toLowerCase() ?? "js";
            state.openFile(
              newTabPath,
              newTabPath.split("/").filter(Boolean).pop() ?? newTabPath,
              ext
            );
          }
        }

        await persistVfs();
        return `Success: Renamed ${oldPath} → ${newPath}`;
      },
    },
  };
}

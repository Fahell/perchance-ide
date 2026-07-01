/**
 * VFS I/O — serialization and deserialization of the virtual file system.
 *
 * Used by Download/Upload VFS (11.4) to export/import projects as JSON.
 * Format: { files: Array<{ path: string, content: string }> }
 */

import { vfsGetAll, type VfsEntry } from "../vfs.js";

// ─── Types ──────────────────────────────────────────────────
export interface ProjectFile {
  path: string;
  content: string;
}

export interface ProjectManifest {
  files: ProjectFile[];
}

// ─── Serialize ──────────────────────────────────────────────
/**
 * Serialize the entire VFS into a pretty-printed JSON string.
 * Only file entries are included (directories are implicit).
 */
export function serializeProject(): string {
  const entries = vfsGetAll();
  const files: ProjectFile[] = [];

  for (const entry of entries) {
    if (entry.type === "file") {
      files.push({ path: entry.path, content: entry.content });
    }
  }

  const manifest: ProjectManifest = { files };
  return JSON.stringify(manifest, null, 2);
}

// ─── Deserialize ────────────────────────────────────────────
export class DeserializeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeserializeError";
  }
}

/**
 * Sanitize a file path from an uploaded project.
 * - Strips leading "/" (VFS paths are absolute internally)
 * - Rejects paths with ".." segments (path traversal prevention)
 * - Ensures the path is non-empty
 */
function sanitizePath(raw: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new DeserializeError(`Invalid path: "${String(raw)}"`);
  }

  // Strip leading slashes
  let cleaned = raw.replace(/^\/+/, "");

  // Reject path traversal
  const parts = cleaned.split("/");
  for (const part of parts) {
    if (part === "..") {
      throw new DeserializeError(`Path traversal rejected: "${raw}"`);
    }
  }

  // Re-absolute-ize
  return "/" + cleaned;
}

/**
 * Parse a project JSON string and return VfsEntry objects
 * ready to be loaded into the VFS.
 *
 * @throws DeserializeError on invalid input
 */
export function deserializeProject(json: string): VfsEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new DeserializeError("Invalid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new DeserializeError("Expected an object with a 'files' array");
  }

  const manifest = parsed as Record<string, unknown>;

  if (!Array.isArray(manifest.files)) {
    throw new DeserializeError("Missing or invalid 'files' array");
  }

  const now = Date.now();
  const result: VfsEntry[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < manifest.files.length; i++) {
    const item = manifest.files[i] as Record<string, unknown>;

    if (!item || typeof item !== "object") {
      console.warn(`[vfs-io] Skipping entry ${i}: not an object`);
      continue;
    }

    if (typeof item.path !== "string" || typeof item.content !== "string") {
      console.warn(`[vfs-io] Skipping entry ${i}: missing 'path' or 'content'`);
      continue;
    }

    try {
      const path = sanitizePath(item.path);

      // Skip duplicates (last write wins, but warn)
      if (seen.has(path)) {
        console.warn(`[vfs-io] Duplicate path "${path}" — last entry wins`);
      }
      seen.add(path);

      result.push({
        path,
        content: item.content,
        type: "file",
        createdAt: now,
        modifiedAt: now,
      });
    } catch (e) {
      if (e instanceof DeserializeError) {
        console.warn(`[vfs-io] Skipping entry ${i}: ${e.message}`);
      } else {
        throw e;
      }
    }
  }

  return result;
}

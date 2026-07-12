/**
 * VFS I/O — serialization, deserialization, and ZIP export of the virtual file system.
 *
 * Used by Download/Upload VFS to export/import projects as JSON.
 * ZIP export uses zero external dependencies (pure ZIP format implementation).
 */

import { PROJECT_ROOT, vfsGetAll, type VfsEntry } from "../vfs.js";

// ─── Types ──────────────────────────────────────────────────
export interface ProjectFile {
  path: string;
  content: string;
}

export interface ProjectManifest {
  files: ProjectFile[];
}

/**
 * Strip PROJECT_ROOT prefix from a VFS path to get a clean project-relative path.
 * E.g., "/home/user/src/index.ts" → "src/index.ts"
 */
function stripProjectRoot(path: string): string {
  if (path.startsWith(PROJECT_ROOT)) {
    return path.slice(PROJECT_ROOT.length + 1); // +1 for the trailing /
  }
  return path.replace(/^\/+/, "");
}

/**
 * Determine if a path is a project file (under PROJECT_ROOT and not a system dir).
 */
function isProjectFile(path: string): boolean {
  if (path === "/" || path === "/home" || path === PROJECT_ROOT) return false;
  if (path.startsWith(PROJECT_ROOT)) return true;
  return false;
}

/**
 * Collect project files from the VFS, filtered to only include user project files
 * under PROJECT_ROOT. Returns paths relative to the project root.
 */
export function getProjectFiles(prefix?: string): ProjectFile[] {
  const entries = vfsGetAll();
  const files: ProjectFile[] = [];

  for (const entry of entries) {
    if (entry.type !== "file") continue;
    if (!isProjectFile(entry.path)) continue;
    if (prefix && !entry.path.startsWith(prefix)) continue;

    files.push({
      path: stripProjectRoot(entry.path),
      content: entry.content,
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

// ─── ZIP Export ─────────────────────────────────────────────

/**
 * CRC-32 calculation for ZIP entries.
 * Uses a precomputed lookup table for speed.
 */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return ~crc >>> 0;
}

/** Encode a 32-bit integer as 4 little-endian bytes. */
function u32Le(v: number): Uint8Array {
  return new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]);
}

/** Encode a 16-bit integer as 2 little-endian bytes. */
function u16Le(v: number): Uint8Array {
  return new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF]);
}

/** Encode a string as UTF-8 bytes. */
function encodeStr(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/**
 * Create a ZIP file (stored method, no compression) from an array of files.
 * Uses the standard ZIP format with local file headers, central directory,
 * and end-of-central-directory record.
 */
export function createZipBlob(files: ProjectFile[]): Blob {
  const chunks: Uint8Array[] = [];
  const centralEntries: Uint8Array[] = [];
  let offset = 0;

  const SIG_LOCAL = 0x04034b50;
  const SIG_CENTRAL = 0x02014b50;
  const SIG_EOCD = 0x06054b50;
  const VERSION_NEEDED = 20; // 2.0
  const METHOD_STORED = 0;   // No compression
  const FLAG_UTF8 = 0x0800;  // Language encoding flag (UTF-8)

  for (const file of files) {
    const nameBytes = encodeStr(file.path);
    const dataBytes = encodeStr(file.content);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lh = new DataView(localHeader.buffer);
    let pos = 0;
    lh.setUint32(pos, SIG_LOCAL, true); pos += 4;  // signature
    lh.setUint16(pos, VERSION_NEEDED, true); pos += 2; // version needed
    lh.setUint16(pos, FLAG_UTF8, true); pos += 2;      // flags
    lh.setUint16(pos, METHOD_STORED, true); pos += 2;   // compression method
    lh.setUint16(pos, 0, true); pos += 2;               // mod time (unset)
    lh.setUint16(pos, 0, true); pos += 2;               // mod date (unset)
    lh.setUint32(pos, crc, true); pos += 4;             // crc-32
    lh.setUint32(pos, size, true); pos += 4;             // compressed size
    lh.setUint32(pos, size, true); pos += 4;             // uncompressed size
    lh.setUint16(pos, nameBytes.length, true); pos += 2; // filename length
    lh.setUint16(pos, 0, true); pos += 2;                // extra field length
    localHeader.set(nameBytes, pos);                     // filename

    chunks.push(localHeader);
    chunks.push(dataBytes);

    // Central directory entry
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const ch = new DataView(centralHeader.buffer);
    pos = 0;
    ch.setUint32(pos, SIG_CENTRAL, true); pos += 4;     // signature
    ch.setUint16(pos, VERSION_NEEDED, true); pos += 2;   // version made by
    ch.setUint16(pos, VERSION_NEEDED, true); pos += 2;   // version needed
    ch.setUint16(pos, FLAG_UTF8, true); pos += 2;        // flags
    ch.setUint16(pos, METHOD_STORED, true); pos += 2;    // compression method
    ch.setUint16(pos, 0, true); pos += 2;                // mod time (unset)
    ch.setUint16(pos, 0, true); pos += 2;                // mod date (unset)
    ch.setUint32(pos, crc, true); pos += 4;              // crc-32
    ch.setUint32(pos, size, true); pos += 4;              // compressed size
    ch.setUint32(pos, size, true); pos += 4;              // uncompressed size
    ch.setUint16(pos, nameBytes.length, true); pos += 2;  // filename length
    ch.setUint16(pos, 0, true); pos += 2;                 // extra field length
    ch.setUint16(pos, 0, true); pos += 2;                 // file comment length
    ch.setUint16(pos, 0, true); pos += 2;                 // disk number start
    ch.setUint16(pos, 0, true); pos += 2;                 // internal file attributes
    ch.setUint32(pos, 0, true); pos += 4;                 // external file attributes
    ch.setUint32(pos, offset, true); pos += 4;            // relative offset
    centralHeader.set(nameBytes, pos);                    // filename

    centralEntries.push(centralHeader);
    offset += 30 + nameBytes.length + size;
  }

  const totalEntries = files.length;
  const centralOffset = offset;
  const centralSize = centralEntries.reduce((s, e) => s + e.length, 0);

  // End of central directory record
  const eocd = new Uint8Array(22);
  const ed = new DataView(eocd.buffer);
  let epos = 0;
  ed.setUint32(epos, SIG_EOCD, true); epos += 4;       // signature
  ed.setUint16(epos, 0, true); epos += 2;               // disk number
  ed.setUint16(epos, 0, true); epos += 2;               // disk with central dir
  ed.setUint16(epos, totalEntries, true); epos += 2;    // entries on this disk
  ed.setUint16(epos, totalEntries, true); epos += 2;    // total entries
  ed.setUint32(epos, centralSize, true); epos += 4;     // central directory size
  ed.setUint32(epos, centralOffset, true); epos += 4;   // central directory offset
  ed.setUint16(epos, 0, true); epos += 2;               // comment length

  // Concatenate all chunks into a single Uint8Array to avoid BlobPart type conflicts
  const allParts = [...chunks, ...centralEntries, eocd];
  const totalSize = allParts.reduce((s, c) => s + c.length, 0);
  const combined = new Uint8Array(totalSize);
  let combinedPos = 0;
  for (const part of allParts) {
    combined.set(part, combinedPos);
    combinedPos += part.length;
  }
  return new Blob([combined], { type: "application/zip" });
}

// ─── JSON Serialize (for import/upload) ─────────────────────
/**
 * Serialize project files into a pretty-printed JSON string.
 * Only files under PROJECT_ROOT are included.
 */
export function serializeProject(): string {
  const files = getProjectFiles();
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

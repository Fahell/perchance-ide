/**
 * Sync Utilities — Shared VFS↔BrowserPod synchronization helpers.
 *
 * Consolidates the duplicated syncVfsToPod() logic from shell-tools.ts
 * and node-tools.ts into a single canonical implementation.
 *
 * Two sync modes:
 * - Push (VFS → Pod): write all VFS files to Pod, optionally reconcile deletions
 * - Pull (Pod → VFS): read matching files from Pod and write to VFS
 */

import { browserPodManager } from "../browserpod/manager.js";
import { trackedWrite } from "../vfs-events.js";
import { scheduleVfsPersist } from "../vfs-persist.js";
import { PROJECT_ROOT, vfsGetAll } from "../vfs.js";

// ─── VFS → Pod Push ─────────────────────────────────────────

/**
 * Sync all VFS files to the BrowserPod's isolated filesystem.
 * Must be called before every command execution since the pod
 * cannot see files created via VFS tools (write_file, edit_file, etc.).
 *
 * @param reconcileDeletions - If true, also delete Pod files that were previously
 *   synced but no longer exist in VFS. Use true for shell/git operations where
 *   the Pod filesystem should mirror VFS exactly. Use false for npm/node operations
 *   where node_modules should not be disturbed.
 */
export async function syncVfsToPod(reconcileDeletions = false): Promise<void> {
  const entries = vfsGetAll();
  if (entries.length === 0) return;

  const vfsFiles = entries
    .filter((e) => e.type === "file")
    .map((e) => ({ path: e.path, content: e.content ?? "" }));

  if (vfsFiles.length > 0) {
    await browserPodManager.syncFiles(vfsFiles);
  }

  // Reconcile VFS → Pod: delete files in Pod that were previously synced
  // but no longer exist in the VFS. Only targets files under PROJECT_ROOT
  // that are tracked by lastSyncedFiles cache (avoids deleting npm artifacts).
  if (reconcileDeletions) {
    const vfsFilePaths = new Set(vfsFiles.map((f) => f.path));
    const cachedPaths = browserPodManager.getLastSyncedPaths();

    // Track parent directories of deleted files so we can clean up empty dirs
    const deletedDirs = new Set<string>();

    for (const cachedPath of cachedPaths) {
      if (!vfsFilePaths.has(cachedPath) && cachedPath.startsWith(PROJECT_ROOT + "/")) {
        const ok = await browserPodManager.deleteFile(cachedPath);
        if (ok) {
          console.log(`[SyncUtils] Deleted stale file on Pod: ${cachedPath}`);
          // Collect ancestor directories for later cleanup
          let parent = cachedPath.slice(0, cachedPath.lastIndexOf("/"));
          while (parent.startsWith(PROJECT_ROOT + "/")) {
            deletedDirs.add(parent);
            parent = parent.slice(0, parent.lastIndexOf("/"));
          }
        }
      }
    }

    // Remove empty directories: for each dir that had deleted files, check if
    // any remaining synced file still lives under it. If not, delete the dir.
    if (deletedDirs.size > 0) {
      const remainingPaths = cachedPaths.filter((p) => vfsFilePaths.has(p));
      const sorted = [...deletedDirs].sort((a, b) => b.length - a.length); // deepest first
      for (const dir of sorted) {
        const hasContent = remainingPaths.some((p) => p.startsWith(dir + "/"));
        if (!hasContent) {
          const ok = await browserPodManager.deleteFile(dir);
          if (ok) console.log(`[SyncUtils] Deleted stale directory on Pod: ${dir}`);
        }
      }
    }
  }
}

// ─── Pod → VFS Pull ─────────────────────────────────────────

/**
 * Write a file into VFS from Pod data, ensuring hash tracking and persistence.
 * Use this instead of raw vfsWrite() when pulling data from the Pod.
 */
export function writeToVfs(path: string, content: string): void {
  trackedWrite(path, content);
  scheduleVfsPersist();
}

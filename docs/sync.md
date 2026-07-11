# VFS ↔ BrowserPod Bidirectional Synchronization

The `perchance-ide` uses a complex bidirectional synchronization mechanism to maintain consistency between the in-memory Virtual File System (VFS) and the remote BrowserPod Node.js runtime.

## Architecture Overview

The synchronization occurs across two primary paths: **Push (VFS $\to$ Pod)** and **Pull (Pod $\to$ VFS)**.

### 1. VFS $\to$ Pod (Push)

This path ensures that changes made in the editor or by the agent tools are reflected in the Pod's filesystem.

#### Real-time Sync (`subscribeToVfsChanges`)
Upon Pod boot, the manager subscribes to VFS mutation events. Whenever a file is written, deleted, or renamed in the VFS, the change is immediately propagated to the Pod:
- **Write**: Reads fresh content from VFS $\to$ `browserPodManager.writeFile()`.
- **Delete**: `browserPodManager.deleteFile()` $\to$ `rm -rf <path>` in Pod.
- **Rename**: `browserPodManager.renameFile()` $\to$ `mv <old> <new>` in Pod.

#### Bulk Sync (`syncVfsToPod`)
Before every shell/git/node command execution, a bulk sync is performed:
- All current VFS files are pushed to the Pod.
- **Reconcile Deletions (Optional)**: In shell tools, if enabled, the system checks the `lastSyncedFiles` cache. Any path in the cache that no longer exists in the VFS is deleted from the Pod (`rm -rf`).

---

### 2. Pod $\to$ VFS (Pull)

This path reflects changes made inside the Pod (e.g., by `npm install`, `git clone`, or custom scripts) back into the VFS.

#### Pull Mechanism (`pullProjectFilesFromPod`)
After each shell/git command, the system performs a bulk pull:
1. **Discovery**: Runs `find /home/user -type f` (regular files) and `find /home/user -type d` (directories) in the Pod.
2. **Filtering**: Only files matching `ALLOWED_SOURCE_EXTENSIONS` or `ALLOWED_SOURCE_NAMES` are pulled. Blacklisted directories (e.g., `node_modules`, `.git`) are excluded.
3. **Sync**: Qualifying files are read from the Pod and written to the VFS via `writeToVfs()` (which uses hash tracking and debounced persistence).
4. **Directory Reflection**: Empty directories discovered in the Pod are created as VFS directory entries via `vfsMkdir()`. This ensures the agent's world model matches the Pod's structure, preventing infinite loops when creating project directories.

#### Orphan Reconciliation
To prevent the VFS from accumulating stale files that were deleted in the Pod, the pull process performs "orphan removal":
- It compares the paths actually pulled from the Pod against the `lastSyncedFiles` cache (files previously synced VFS $\to$ Pod).
- If a previously-synced path is missing from the Pod's current state, it is considered an "orphan" and deleted from the VFS via `vfsDeleteTree()`.
- **Non-Destructive Design**: Orphan deletion is performed **silently** in the VFS. It does NOT emit a delete event that would propagate back to the Pod, preventing destructive feedback loops.
- **Cache Pruning**: The `lastSyncedFiles` cache is pruned whenever an orphan is removed, ensuring the cache remains honest and prevents redundant "orphan removed" logs.

---

### 3. Cache & Persistence

#### `lastSyncedFiles` Cache
A merge-based cache in `BrowserPodManager` that tracks every file successfully pushed to the Pod. It serves as the source of truth for the orphan reconciliation process.

#### VFS $\to$ IndexedDB
All changes (including those from the Pod pull) are persisted to IndexedDB via `vfs-persist.ts` using a debounced strategy (2000ms) to avoid write amplification.

## Testing & Validation

Because the sync logic is critical and involves asynchronous communication with a remote runtime, it is validated using a local mock harness:

- **`MockPodFs`**: An in-memory POSIX-ish filesystem that simulates the BrowserPod API (`createFile`, `openFile`, `run`, etc.).
- **`fake-indexeddb`**: Simulates IndexedDB in the Vitest `jsdom` environment.
- **`src/sync-mock.test.ts`**: Integration tests covering:
  - VFS $\to$ Pod real-time sync (create/edit/delete/rename)
  - Bulk sync and reconcile behavior
  - Pod $\to$ VFS pull and orphan removal
  - Edge cases (safety checks for root deletion, invalid `package.json` guards)

To run sync tests locally:
`npx vitest run src/sync-mock.test.ts`

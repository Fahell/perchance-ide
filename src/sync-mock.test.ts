import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockPodFs } from "./test-helpers/mock-pod-fs.js";
import { trackedWrite, trackedDelete, trackedRename, initHashes } from "./vfs-events.js";
import { vfsRead, vfsReset, PROJECT_ROOT } from "./vfs.js";
import { syncVfsToPod, writeToVfs } from "./tools/sync-utils.js";
import { browserPodManager } from "./browserpod/manager.js";

// Mock vfs-persist to avoid IndexedDB
vi.mock("./vfs-persist.js", () => ({
  markDirty: vi.fn(),
  markDeleted: vi.fn(),
  markRenamed: vi.fn(),
  scheduleVfsPersist: vi.fn(),
  flushVfsPersist: vi.fn(),
}));

async function flushMicrotasks(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

/** Read a file's content directly from the mock Pod filesystem. */
async function readMockFile(pod: MockPodFs, path: string): Promise<string> {
  const handle = await pod.openFile(path, "utf-8");
  const size = await handle.getSize();
  const content = await handle.read(size);
  await handle.close();
  return content;
}

/** Write content into the mock Pod filesystem (simulating a command output). */
async function writeMockFile(pod: MockPodFs, path: string, content: string): Promise<void> {
  const handle = await pod.createFile(path, "utf-8");
  await handle.write(content);
  await handle.close();
}

describe("VFS <-> BrowserPod bidirectional sync", () => {
  let mockPod: MockPodFs;

  beforeEach(() => {
    vfsReset();
    initHashes();
    mockPod = new MockPodFs();
    browserPodManager.__setTestPod(mockPod as any);
  });

  afterEach(() => {
    mockPod.dispose();
  });

  // ─── Phase 1: VFS tracked mutations emit correct events ───────────

  describe("Phase 1 — VFS tracked mutations", () => {
    it("trackedWrite emits created then modified events", () => {
      const ev1 = trackedWrite(PROJECT_ROOT + "/test.txt", "hello");
      expect(ev1.type).toBe("created");

      const ev2 = trackedWrite(PROJECT_ROOT + "/test.txt", "hello world");
      expect(ev2.type).toBe("modified");

      expect(vfsRead(PROJECT_ROOT + "/test.txt")).toBe("hello world");
    });

    it("trackedDelete on a file removes only that file", () => {
      trackedWrite(PROJECT_ROOT + "/a.txt", "a");
      trackedWrite(PROJECT_ROOT + "/b.txt", "b");

      const events = trackedDelete(PROJECT_ROOT + "/a.txt");
      expect(events).toHaveLength(1);
      expect(events[0].path).toBe(PROJECT_ROOT + "/a.txt");
      expect(events[0].type).toBe("deleted");

      expect(vfsRead(PROJECT_ROOT + "/a.txt")).toBeNull();
      expect(vfsRead(PROJECT_ROOT + "/b.txt")).toBe("b");
    });

    it("trackedDelete on a directory removes all files under it", () => {
      trackedWrite(PROJECT_ROOT + "/mydir/file1.txt", "f1");
      trackedWrite(PROJECT_ROOT + "/mydir/sub/file2.txt", "f2");
      trackedWrite(PROJECT_ROOT + "/other.txt", "other");

      const events = trackedDelete(PROJECT_ROOT + "/mydir");
      expect(events).toHaveLength(2);
      expect(events.map((e) => e.path).sort()).toEqual([
        PROJECT_ROOT + "/mydir/file1.txt",
        PROJECT_ROOT + "/mydir/sub/file2.txt",
      ]);

      expect(vfsRead(PROJECT_ROOT + "/mydir/file1.txt")).toBeNull();
      expect(vfsRead(PROJECT_ROOT + "/mydir/sub/file2.txt")).toBeNull();
      expect(vfsRead(PROJECT_ROOT + "/other.txt")).toBe("other");
    });
  });

  // ─── Phase 2: subscribeToVfsChanges -> real-time Pod sync (create/delete) ─

  describe("Phase 2 — Real-time VFS->Pod sync (create / delete)", () => {
    it("writes a file to Pod when trackedWrite creates a file", async () => {
      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedWrite(PROJECT_ROOT + "/hello.txt", "world");
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/hello.txt")).toBe(true);
      expect(mockPod.listAllFiles()).toContain(PROJECT_ROOT + "/hello.txt");

      unsub();
    });

    it("deletes a file from Pod when trackedDelete removes a file", async () => {
      await writeMockFile(mockPod, PROJECT_ROOT + "/keep.txt", "keep");
      await writeMockFile(mockPod, PROJECT_ROOT + "/delete.txt", "delete");
      trackedWrite(PROJECT_ROOT + "/keep.txt", "keep");
      trackedWrite(PROJECT_ROOT + "/delete.txt", "delete");
      await flushMicrotasks();

      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedDelete(PROJECT_ROOT + "/delete.txt");
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/delete.txt")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/keep.txt")).toBe(true);

      unsub();
    });

    it("removes entire directory tree from Pod when trackedDelete removes a directory", async () => {
      await writeMockFile(mockPod, PROJECT_ROOT + "/dir/a.txt", "a");
      await writeMockFile(mockPod, PROJECT_ROOT + "/dir/sub/b.txt", "b");
      await writeMockFile(mockPod, PROJECT_ROOT + "/dir/sub/c.txt", "c");
      await writeMockFile(mockPod, PROJECT_ROOT + "/other.txt", "other");
      trackedWrite(PROJECT_ROOT + "/dir/a.txt", "a");
      trackedWrite(PROJECT_ROOT + "/dir/sub/b.txt", "b");
      trackedWrite(PROJECT_ROOT + "/dir/sub/c.txt", "c");
      trackedWrite(PROJECT_ROOT + "/other.txt", "other");
      await flushMicrotasks();

      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedDelete(PROJECT_ROOT + "/dir");
      await flushMicrotasks();

      expect(mockPod.hasFilesUnder(PROJECT_ROOT + "/dir")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/dir")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/other.txt")).toBe(true);

      unsub();
    });
  });

  // ─── Phase 2b: edits (modify) reflect on Pod ─────────────────────

  describe("Phase 2b — Edits (modify) VFS->Pod", () => {
    it("updates Pod file content when a VFS file is edited", async () => {
      await writeMockFile(mockPod, PROJECT_ROOT + "/edit.txt", "version1");
      trackedWrite(PROJECT_ROOT + "/edit.txt", "version1");
      await flushMicrotasks();

      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedWrite(PROJECT_ROOT + "/edit.txt", "version2");
      await flushMicrotasks();

      expect(await readMockFile(mockPod, PROJECT_ROOT + "/edit.txt")).toBe("version2");
      unsub();
    });

    it("does not duplicate the file when editing (single entry on Pod)", async () => {
      await writeMockFile(mockPod, PROJECT_ROOT + "/dup.txt", "v1");
      trackedWrite(PROJECT_ROOT + "/dup.txt", "v1");
      await flushMicrotasks();

      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedWrite(PROJECT_ROOT + "/dup.txt", "v2");
      await flushMicrotasks();

      const files = mockPod.listAllFiles().filter((f) => f === PROJECT_ROOT + "/dup.txt");
      expect(files).toHaveLength(1);
      unsub();
    });
  });

  // ─── Phase 2c: renames (move) reflect on Pod ─────────────────────

  describe("Phase 2c — Renames (move) VFS->Pod", () => {
    it("moves a Pod file when a VFS file is renamed", async () => {
      await writeMockFile(mockPod, PROJECT_ROOT + "/old.txt", "data");
      trackedWrite(PROJECT_ROOT + "/old.txt", "data");
      await flushMicrotasks();

      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedRename(PROJECT_ROOT + "/old.txt", PROJECT_ROOT + "/new.txt");
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/new.txt")).toBe(true);
      expect(mockPod.has(PROJECT_ROOT + "/old.txt")).toBe(false);
      expect(await readMockFile(mockPod, PROJECT_ROOT + "/new.txt")).toBe("data");
      unsub();
    });

    it("moves a whole Pod directory tree when a VFS directory is renamed", async () => {
      await writeMockFile(mockPod, PROJECT_ROOT + "/dir/a.txt", "x");
      await writeMockFile(mockPod, PROJECT_ROOT + "/dir/sub/b.txt", "x");
      trackedWrite(PROJECT_ROOT + "/dir/a.txt", "x");
      trackedWrite(PROJECT_ROOT + "/dir/sub/b.txt", "x");
      await flushMicrotasks();

      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedRename(PROJECT_ROOT + "/dir", PROJECT_ROOT + "/renamed");
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/renamed/a.txt")).toBe(true);
      expect(mockPod.has(PROJECT_ROOT + "/renamed/sub/b.txt")).toBe(true);
      expect(mockPod.has(PROJECT_ROOT + "/dir")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/dir/a.txt")).toBe(false);
      unsub();
    });
  });

  // ─── Phase 3: syncVfsToPod reconcile removes stale dirs ──────────

  describe("Phase 3 — syncVfsToPod reconcile removes stale directories", () => {
    it("removes stale directories during reconciliation", async () => {
      const allFiles = [
        { path: PROJECT_ROOT + "/dir/sub/a.txt", content: "a" },
        { path: PROJECT_ROOT + "/dir/sub/b.txt", content: "b" },
        { path: PROJECT_ROOT + "/stay.txt", content: "stay" },
      ];

      await browserPodManager.syncFiles(allFiles);
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/dir/sub/a.txt")).toBe(true);

      trackedWrite(PROJECT_ROOT + "/stay.txt", "stay");
      // a.txt and b.txt are NOT in VFS — they were "deleted"

      await syncVfsToPod(true);
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/dir/sub/a.txt")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/dir/sub/b.txt")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/dir/sub")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/dir")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/stay.txt")).toBe(true);
    });

    it("does NOT remove directories that still have valid files", async () => {
      const allFiles = [
        { path: PROJECT_ROOT + "/dir/a.txt", content: "a" },
        { path: PROJECT_ROOT + "/dir/b.txt", content: "b" },
      ];

      await browserPodManager.syncFiles(allFiles);
      await flushMicrotasks();

      trackedWrite(PROJECT_ROOT + "/dir/a.txt", "a"); // still exists

      await syncVfsToPod(true);
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/dir/b.txt")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/dir")).toBe(true);
      expect(mockPod.has(PROJECT_ROOT + "/dir/a.txt")).toBe(true);
    });
  });

  // ─── Phase 3a: deeply nested dir deletion leaves no traces ───────

  describe("Phase 3a — Real-time dir deletion leaves no traces", () => {
    it("deleting a deeply nested directory removes all nested files and dirs from Pod", async () => {
      const paths = [
        PROJECT_ROOT + "/project/src/index.js",
        PROJECT_ROOT + "/project/src/utils/helper.js",
        PROJECT_ROOT + "/project/test/unit.test.js",
        PROJECT_ROOT + "/project/README.md",
        PROJECT_ROOT + "/other/keep.txt",
      ];

      for (const p of paths) {
        await writeMockFile(mockPod, p, "content");
        trackedWrite(p, "content");
      }
      await flushMicrotasks();

      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedDelete(PROJECT_ROOT + "/project");
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/project")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/project/src/index.js")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/project/src/utils/helper.js")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/project/test/unit.test.js")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/project/README.md")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/project/src")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/project/src/utils")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/project/test")).toBe(false);
      expect(mockPod.has(PROJECT_ROOT + "/other/keep.txt")).toBe(true);

      unsub();
    });
  });

  // ─── Phase 4: Pod->VFS pull (readFile + writeToVfs) ───────────────

  describe("Phase 4 — Pod->VFS pull", () => {
    it("reads file content from Pod and writes it to VFS via writeToVfs", async () => {
      await writeMockFile(mockPod, PROJECT_ROOT + "/output.txt", "generated-output");

      const content = await browserPodManager.readFile(PROJECT_ROOT + "/output.txt");
      expect(content).toBe("generated-output");

      writeToVfs(PROJECT_ROOT + "/output.txt", content!);

      expect(vfsRead(PROJECT_ROOT + "/output.txt")).toBe("generated-output");
    });

    it("returns null when reading a non-existent Pod file", async () => {
      const content = await browserPodManager.readFile(PROJECT_ROOT + "/missing.txt");
      expect(content).toBeNull();
    });

    it("pulls a directory tree from Pod into VFS preserving structure", async () => {
      const podPaths = [
        PROJECT_ROOT + "/gen/a.txt",
        PROJECT_ROOT + "/gen/sub/b.txt",
      ];
      for (const p of podPaths) await writeMockFile(mockPod, p, "x");

      for (const p of podPaths) {
        const c = await browserPodManager.readFile(p);
        writeToVfs(p, c!);
      }

      expect(vfsRead(PROJECT_ROOT + "/gen/a.txt")).toBe("x");
      expect(vfsRead(PROJECT_ROOT + "/gen/sub/b.txt")).toBe("x");
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("deleting root/home/project-root is blocked (safety)", async () => {
      expect(await browserPodManager.deleteFile("/")).toBe(false);
      expect(await browserPodManager.deleteFile("/home")).toBe(false);
      expect(await browserPodManager.deleteFile("/home/user")).toBe(false);
    });

    it("VFS changes outside PROJECT_ROOT are not propagated to Pod", async () => {
      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedWrite("/etc/passwd", "root:x:0:0");
      await flushMicrotasks();

      expect(mockPod.has("/etc/passwd")).toBe(false);
      unsub();
    });

    it("invalid package.json is NOT synced to Pod (F1/F2 guard)", async () => {
      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      trackedWrite(PROJECT_ROOT + "/package.json", "{ this is : invalid json ");
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/package.json")).toBe(false);
      unsub();
    });

    it("valid package.json IS synced to Pod", async () => {
      const unsub = browserPodManager.subscribeToVfsChanges();
      await flushMicrotasks();

      const valid = JSON.stringify({ name: "proj", version: "1.0.0" });
      trackedWrite(PROJECT_ROOT + "/package.json", valid);
      await flushMicrotasks();

      expect(mockPod.has(PROJECT_ROOT + "/package.json")).toBe(true);
      expect(await readMockFile(mockPod, PROJECT_ROOT + "/package.json")).toBe(valid);
      unsub();
    });
  });
});

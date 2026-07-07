/**
 * Tests for Virtual File System (vfs.ts)
 *
 * All VFS operations are pure (operate on in-memory Map),
 * making them ideal for isolated unit tests without mocks.
 */
import { describe, expect, it } from "vitest";
import { vfsDeleteTree, vfsExists, vfsGetAll, vfsMkdir, vfsRead, vfsRename, vfsSnapshot, vfsTree, vfsWrite, } from "./vfs.js";
// ─── Helpers ────────────────────────────────────────────────
function countEntries() {
    return vfsGetAll().length;
}
// ─── Tests ──────────────────────────────────────────────────
describe("vfsWrite / vfsRead", () => {
    it("should write and read a file", () => {
        vfsWrite("/test.txt", "hello world");
        expect(vfsRead("/test.txt")).toBe("hello world");
        vfsDeleteTree("/test.txt");
    });
    it("should overwrite an existing file", () => {
        vfsWrite("/overwrite.txt", "first");
        vfsWrite("/overwrite.txt", "second");
        expect(vfsRead("/overwrite.txt")).toBe("second");
        vfsDeleteTree("/overwrite.txt");
    });
    it("should auto-create parent directories", () => {
        vfsWrite("/a/b/c/deep.txt", "deep");
        expect(vfsRead("/a/b/c/deep.txt")).toBe("deep");
        expect(vfsExists("/a/b/c")).toBe(true);
        vfsDeleteTree("/a");
    });
    it("should handle empty content", () => {
        vfsWrite("/empty.txt", "");
        expect(vfsRead("/empty.txt")).toBe("");
        vfsDeleteTree("/empty.txt");
    });
    it("should return null for non-existent file", () => {
        expect(vfsRead("/nonexistent.txt")).toBeNull();
    });
});
describe("vfsExists", () => {
    it("should return true for existing files", () => {
        vfsWrite("/exists_test.txt", "hello");
        expect(vfsExists("/exists_test.txt")).toBe(true);
        vfsDeleteTree("/exists_test.txt");
    });
    it("should return true for existing directories", () => {
        vfsMkdir("/mydir");
        expect(vfsExists("/mydir")).toBe(true);
        vfsDeleteTree("/mydir");
    });
    it("should return false for non-existent paths", () => {
        expect(vfsExists("/does/not/exist")).toBe(false);
    });
    it("should return true for root", () => {
        expect(vfsExists("/")).toBe(true);
    });
});
describe("vfsDeleteTree", () => {
    it("should delete a single file", () => {
        vfsWrite("/delete_me.txt", "bye");
        expect(vfsDeleteTree("/delete_me.txt")).toBe(true);
        expect(vfsExists("/delete_me.txt")).toBe(false);
    });
    it("should delete a directory with children", () => {
        vfsWrite("/dir/a.txt", "a");
        vfsWrite("/dir/sub/b.txt", "b");
        expect(vfsDeleteTree("/dir")).toBe(true);
        expect(vfsExists("/dir")).toBe(false);
    });
    it("should return false for non-existent path", () => {
        expect(vfsDeleteTree("/nothing")).toBe(false);
    });
});
describe("vfsRename", () => {
    it("should rename a file", () => {
        vfsWrite("/old.txt", "content");
        expect(vfsRename("/old.txt", "/new.txt")).toBe(true);
        expect(vfsRead("/old.txt")).toBeNull();
        expect(vfsRead("/new.txt")).toBe("content");
        vfsDeleteTree("/new.txt");
    });
    it("should move a file to a subdirectory", () => {
        vfsWrite("/move_me.txt", "moving");
        vfsMkdir("/subdir");
        expect(vfsRename("/move_me.txt", "/subdir/moved.txt")).toBe(true);
        expect(vfsRead("/subdir/moved.txt")).toBe("moving");
        vfsDeleteTree("/subdir");
    });
    it("should not overwrite existing path", () => {
        vfsWrite("/existing.txt", "keep");
        expect(vfsRename("/existing.txt", "/nonexistent/nope.txt")).toBe(false);
        expect(vfsRead("/existing.txt")).toBe("keep");
        vfsDeleteTree("/existing.txt");
    });
});
describe("vfsTree", () => {
    it("should list root contents", () => {
        vfsWrite("/tree_test_a.txt", "a");
        vfsWrite("/tree_test_b.txt", "b");
        const tree = vfsTree("/");
        const names = tree.map((n) => n.name);
        expect(names).toContain("tree_test_a.txt");
        expect(names).toContain("tree_test_b.txt");
        vfsDeleteTree("/tree_test_a.txt");
        vfsDeleteTree("/tree_test_b.txt");
    });
    it("should sort directories before files", () => {
        vfsMkdir("/adir");
        vfsWrite("/zfile.txt", "z");
        vfsWrite("/afile.txt", "a");
        const tree = vfsTree("/");
        // First entry should be a directory
        expect(tree[0].type).toBe("dir");
        vfsDeleteTree("/adir");
        vfsDeleteTree("/zfile.txt");
        vfsDeleteTree("/afile.txt");
    });
    it("should show nested structure", () => {
        vfsWrite("/parent/child/grandchild.txt", "deep");
        const tree = vfsTree("/parent");
        expect(tree.length).toBe(1);
        expect(tree[0].type).toBe("dir");
        expect(tree[0].children?.length).toBe(1);
        expect(tree[0].children?.[0].name).toBe("grandchild.txt");
        vfsDeleteTree("/parent");
    });
});
describe("vfsMkdir", () => {
    it("should create a single directory", () => {
        vfsMkdir("/singledir");
        expect(vfsExists("/singledir")).toBe(true);
        vfsDeleteTree("/singledir");
    });
    it("should create nested directories", () => {
        vfsMkdir("/a/b/c");
        expect(vfsExists("/a/b/c")).toBe(true);
        vfsDeleteTree("/a");
    });
});
describe("vfsGetAll / vfsSnapshot", () => {
    it("vfsGetAll should return all entries", () => {
        vfsWrite("/gaa_a.txt", "a");
        vfsWrite("/gaa_b.txt", "b");
        expect(countEntries()).toBeGreaterThanOrEqual(2);
        vfsDeleteTree("/gaa_a.txt");
        vfsDeleteTree("/gaa_b.txt");
    });
    it("vfsSnapshot should return Record<path, content>", () => {
        vfsWrite("/snap.txt", "snap_content");
        const snap = vfsSnapshot();
        expect(snap["/snap.txt"]).toBe("snap_content");
        vfsDeleteTree("/snap.txt");
    });
});
describe("path edge cases", () => {
    it("should handle paths with spaces", () => {
        vfsWrite("/my file.txt", "spaces");
        expect(vfsRead("/my file.txt")).toBe("spaces");
        vfsDeleteTree("/my file.txt");
    });
    it("should normalize double slashes", () => {
        vfsWrite("//double//slash.txt", "normalized");
        expect(vfsExists("/double/slash.txt")).toBe(true);
        vfsDeleteTree("/double");
    });
    it("should handle root path", () => {
        expect(vfsExists("/")).toBe(true);
        expect(vfsTree("/")).toBeDefined();
    });
});

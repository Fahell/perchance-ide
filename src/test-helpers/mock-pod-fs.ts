/**
 * MockPodFs — In-memory filesystem simulating BrowserPod's pod API for tests.
 *
 * Supports the same operations the real BrowserPodManager uses:
 *   createFile, openFile, createDirectory, run, onPortal, dispose
 *
 * `run` implements a minimal set of commands: rm, mv, mkdir, find, bash -c.
 */

export interface MockFileHandle {
  write(content: string): Promise<void>;
  read(length: number): Promise<string>;
  getSize(): Promise<number>;
  close(): Promise<void>;
}

export class MockPodFs {
  private _files = new Map<string, string>();
  private _dirs = new Set<string>();
  private _portalCallbacks: Array<(event: { url: string; port: number }) => void> = [];

  constructor() {
    this._dirs.add("/");
    this._dirs.add("/home");
    this._dirs.add("/home/user");
  }

  // ─── Pod API ──────────────────────────────────────────────

  async createFile(path: string, _encoding: string): Promise<MockFileHandle> {
    const normalized = this._normalize(path);
    this._ensureParentDir(normalized);
    // Create an empty entry so has() returns true immediately
    if (!this._files.has(normalized)) {
      this._files.set(normalized, "");
    }
    this._dirs.add(normalized);
    return {
      write: async (content: string) => {
        this._files.set(normalized, content);
      },
      read: async (_length: number) => this._files.get(normalized) ?? "",
      getSize: async () => this._files.get(normalized)?.length ?? 0,
      close: async () => {},
    };
  }

  async openFile(path: string, _encoding: string): Promise<MockFileHandle> {
    const normalized = this._normalize(path);
    if (!this._files.has(normalized)) {
      throw new Error(`Failed to open file: ${path} — no such file`);
    }
    return {
      write: async (content: string) => {
        this._files.set(normalized, content);
      },
      read: async (_length: number) => this._files.get(normalized) ?? "",
      getSize: async () => this._files.get(normalized)?.length ?? 0,
      close: async () => {},
    };
  }

  async createDirectory(path: string, options?: { recursive?: boolean }): Promise<void> {
    const normalized = this._normalize(path);
    if (this._dirs.has(normalized)) return;
    if (!options?.recursive) {
      const parent = normalized.slice(0, normalized.lastIndexOf("/"));
      if (!this._dirs.has(parent)) {
        throw new Error(`EEXIST: parent ${parent} does not exist`);
      }
    }
    // Recursive: create all ancestors
    const parts = normalized.split("/").filter(Boolean);
    let acc = "";
    for (const p of parts) {
      acc += "/" + p;
      this._dirs.add(acc);
    }
  }

  async run(command: string, args: string[] = [], _options?: any): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    switch (command) {
      case "rm": {
        const idxRf = args.indexOf("-rf");
        if (idxRf >= 0 && idxRf + 1 < args.length) {
          const target = this._normalize(args[idxRf + 1]);
          // Remove the directory/file and everything under it
          for (const p of [...this._files.keys()]) {
            if (p === target || p.startsWith(target + "/")) {
              this._files.delete(p);
            }
          }
          for (const d of [...this._dirs]) {
            if (d === target || d.startsWith(target + "/")) {
              this._dirs.delete(d);
            }
          }
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      case "mv": {
        if (args.length >= 2) {
          const src = this._normalize(args[0]);
          const dst = this._normalize(args[1]);
          // Move file content
          if (this._files.has(src)) {
            this._files.set(dst, this._files.get(src)!);
            this._files.delete(src);
          }
          // Move directories (repath all files under src)
          for (const p of [...this._files.keys()]) {
            if (p.startsWith(src + "/")) {
              const rel = p.slice(src.length);
              this._files.set(dst + rel, this._files.get(p)!);
              this._files.delete(p);
            }
          }
          // Move directory entries
          for (const d of [...this._dirs]) {
            if (d === src) {
              this._dirs.delete(d);
              this._dirs.add(dst);
            } else if (d.startsWith(src + "/")) {
              const rel = d.slice(src.length);
              this._dirs.delete(d);
              this._dirs.add(dst + rel);
            }
          }
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      case "mkdir": {
        const idxP = args.indexOf("-p");
        const paths = idxP >= 0 ? args.slice(idxP + 1) : args;
        for (const p of paths) {
          await this.createDirectory(p, { recursive: idxP >= 0 });
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      }

      case "find": {
        const dirIdx = args.findIndex((a) => !a.startsWith("-"));
        const root = dirIdx >= 0 ? this._normalize(args[dirIdx]) : "/";
        const typeF = args.includes("-type") && args[args.indexOf("-type") + 1] === "f";
        const exclusions: Array<{ flag: string; glob: string }> = [];
        for (let i = 0; i < args.length - 1; i++) {
          if (args[i] === "-not" && args[i + 1] === "-path") {
            exclusions.push({ flag: args[i], glob: args[i + 2] ?? "" });
          }
        }
        const results: string[] = [];
        for (const f of [...this._files.keys()].sort()) {
          if (!f.startsWith(root)) continue;
          if (!typeF) { results.push(f); continue; }
          // Apply exclusions (simple glob match, * prefix/suffix)
          const excluded = exclusions.some((e) => {
            const g = e.glob;
            if (g.startsWith("*/") && f.includes(g.slice(1))) return true;
            if (g.endsWith("/*") && f.startsWith(g.slice(0, -1))) return true;
            return f.includes(g);
          });
          if (excluded) continue;
          results.push(f);
        }
        return { stdout: results.join("\n") + "\n", stderr: "", exitCode: 0 };
      }

      case "echo": {
        return { stdout: args.join(" ") + "\n", stderr: "", exitCode: 0 };
      }

      default: {
        return { stdout: "", stderr: `Unknown mock command: ${command}`, exitCode: 1 };
      }
    }
  }

  onPortal(callback: (event: { url: string; port: number }) => void): () => void {
    this._portalCallbacks.push(callback);
    return () => {
      const idx = this._portalCallbacks.indexOf(callback);
      if (idx >= 0) this._portalCallbacks.splice(idx, 1);
    };
  }

  async dispose(): Promise<void> {
    this._files.clear();
    this._dirs.clear();
    this._portalCallbacks = [];
  }

  // ─── Test helpers ─────────────────────────────────────────

  /** Return all file paths currently in the mock pod */
  listAllFiles(): string[] {
    return [...this._files.keys()].sort();
  }

  /** Return all directory paths currently in the mock pod */
  listAllDirs(): string[] {
    return [...this._dirs].sort();
  }

  /** Check if a path exists (file or dir) in the mock pod */
  has(path: string): boolean {
    const n = this._normalize(path);
    return this._files.has(n) || this._dirs.has(n);
  }

  /** Check if any file exists under a given directory prefix */
  hasFilesUnder(dir: string): boolean {
    const n = this._normalize(dir);
    return [...this._files.keys()].some((f) => f.startsWith(n + "/"));
  }

  // ─── Internal ─────────────────────────────────────────────

  private _normalize(path: string): string {
    const parts = path.replace(/\/+/g, "/").split("/").filter(Boolean);
    const resolved: string[] = [];
    for (const p of parts) {
      if (p === ".") continue;
      if (p === "..") { resolved.pop(); continue; }
      resolved.push(p);
    }
    return "/" + resolved.join("/");
  }

  private _ensureParentDir(path: string): void {
    const parent = path.slice(0, path.lastIndexOf("/"));
    if (parent && !this._dirs.has(parent)) {
      this._createDirRecursive(parent);
    }
  }

  private _createDirRecursive(dir: string): void {
    const parts = dir.split("/").filter(Boolean);
    let acc = "";
    for (const p of parts) {
      acc += "/" + p;
      this._dirs.add(acc);
    }
  }
}

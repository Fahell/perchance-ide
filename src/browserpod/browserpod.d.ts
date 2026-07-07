// Type declarations for @leaningtech/browserpod v2.12.1 loaded from CDN at runtime
// Matches official API docs: https://browserpod.io/docs/overview
declare module "https://cdn.jsdelivr.net/npm/@leaningtech/browserpod@2.12.1/+esm" {
  // ─── File Handles ──────────────────────────────────────────

  export interface BrowserPodFile {
    write(content: string): Promise<number>;
    read(length?: number): Promise<string>;
    getSize(): Promise<number>;
    close(): Promise<void>;
  }

  export interface BinaryFile {
    write(data: ArrayBuffer): Promise<number>;
    read(length?: number): Promise<ArrayBuffer>;
    getSize(): Promise<number>;
    close(): Promise<void>;
  }

  // ─── Process Handle ────────────────────────────────────────
  /**
   * Opaque handle to a process that ran inside a Pod.
   * Returned by run() once the process has exited.
   * The class is empty in public types — output goes to the terminal callback.
   */
  export interface Process { }

  // ─── Terminal Handle ───────────────────────────────────────
  /** Opaque terminal handle — created by createDefaultTerminal or createCustomTerminal */
  export interface Terminal { }

  // ─── Run Options ───────────────────────────────────────────
  export interface BrowserPodRunOptions {
    /** Terminal for I/O — required for run() */
    terminal: Terminal;
    /** Working directory inside the Pod */
    cwd?: string;
    /** Environment variables as "KEY=value" strings */
    env?: string[];
    /** Echo command to terminal */
    echo?: boolean;
  }

  // ─── Pod Instance ──────────────────────────────────────────
  export interface BrowserPodInstance {
    run(executable: string, args: string[], options: BrowserPodRunOptions): Promise<Process>;
    createFile(path: string, mode: "utf-8"): Promise<BrowserPodFile>;
    createFile(path: string, mode: "binary"): Promise<BinaryFile>;
    createFile(path: string, mode: "utf-8" | "binary"): Promise<BrowserPodFile | BinaryFile>;
    openFile(path: string, mode: "utf-8"): Promise<BrowserPodFile>;
    openFile(path: string, mode: "binary"): Promise<BinaryFile>;
    openFile(path: string, mode: "utf-8" | "binary"): Promise<BrowserPodFile | BinaryFile>;
    createDirectory(path: string, opts?: { recursive?: boolean }): Promise<void>;
    createDefaultTerminal(element: HTMLElement): Promise<Terminal>;
    createCustomTerminal(opts: {
      cols?: number;
      rows?: number;
      onOutput: (buffer: ArrayBuffer, vt?: unknown) => void;
    }): Promise<Terminal>;
    onPortal(callback: (event: { url: string; port: number }) => void): void;
    onOpen(callback: (path: string) => void): void;
    dispose(): Promise<void>;
  }

  // ─── Boot Config ───────────────────────────────────────────
  export interface BrowserPodBootConfig {
    /** API key from https://console.browserpod.io */
    apiKey: string;
    /** Omit → ephemeral (fresh disk each boot). Same key → resumes same disk across reloads */
    storageKey?: string;
    /** Currently only "22" is supported */
    nodeVersion?: string;
    /** URL to custom ext2 filesystem image mounted at /home */
    userImage?: string;
  }

  export interface BrowserPodClass {
    boot(config: BrowserPodBootConfig): Promise<BrowserPodInstance>;
  }

  export const BrowserPod: BrowserPodClass;
}

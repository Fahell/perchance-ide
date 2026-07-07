// Type declarations for @leaningtech/browserpod v2.12.1 loaded from CDN at runtime
// Matches official API docs: https://browserpod.io/docs/overview
declare module "https://cdn.jsdelivr.net/npm/@leaningtech/browserpod@latest/+esm" {
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

  export interface BrowserPodTerminal {
    // Opaque terminal handle — created by createDefaultTerminal or createCustomTerminal
  }

  export interface BrowserPodRunOptions {
    /** Terminal for I/O — required for run() */
    terminal: BrowserPodTerminal;
    /** Working directory inside the Pod */
    cwd?: string;
    /** Environment variables as "KEY=value" strings */
    env?: string[];
    /** Echo command to terminal */
    echo?: boolean;
  }

  export interface BrowserPodInstance {
    run(executable: string, args: string[], options: BrowserPodRunOptions): Promise<unknown>;
    createFile(path: string, mode: "utf-8"): Promise<BrowserPodFile>;
    createFile(path: string, mode: "binary"): Promise<BinaryFile>;
    createFile(path: string, mode: "utf-8" | "binary"): Promise<BrowserPodFile | BinaryFile>;
    openFile(path: string, mode: "utf-8"): Promise<BrowserPodFile>;
    openFile(path: string, mode: "binary"): Promise<BinaryFile>;
    openFile(path: string, mode: "utf-8" | "binary"): Promise<BrowserPodFile | BinaryFile>;
    createDirectory(path: string, opts?: { recursive?: boolean }): Promise<void>;
    createDefaultTerminal(element: HTMLElement): Promise<BrowserPodTerminal>;
    createCustomTerminal(config: { onOutput: (data: string | Uint8Array | number[]) => void }): Promise<BrowserPodTerminal>;
    onPortal(callback: (event: { url: string; port: number }) => void): void;
    onOpen(callback: (path: string) => void): void;
    dispose(): Promise<void>;
  }

  export interface BrowserPodBootConfig {
    /** API key from https://console.browserpod.io */
    apiKey: string;
    /** Omit → ephemeral. Same key → resumes same disk across reloads */
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

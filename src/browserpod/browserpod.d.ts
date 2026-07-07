// Type declarations for @leaningtech/browserpod loaded from CDN at runtime
declare module "https://cdn.jsdelivr.net/npm/@leaningtech/browserpod@latest/+esm" {
  export interface BrowserPodFile {
    write(content: string): Promise<void>;
    read(): Promise<string>;
    close(): Promise<void>;
  }

  export interface BrowserPodTerminal {
    // Opaque terminal handle
  }

  export interface BrowserPodInstance {
    run(command: string, args?: string[], options?: Record<string, unknown>): Promise<unknown>;
    createFile(path: string, encoding?: "utf-8" | "binary"): Promise<BrowserPodFile>;
    openFile(path: string, encoding?: "utf-8" | "binary"): Promise<BrowserPodFile>;
    createDirectory(path: string): Promise<void>;
    createDefaultTerminal(element: HTMLElement): Promise<BrowserPodTerminal>;
    createCustomTerminal(config: { onOutput: (data: string | Uint8Array | number[]) => void }): Promise<BrowserPodTerminal>;
    onPortal(callback: (event: { url: string; port: number }) => void): void;
    dispose(): Promise<void>;
  }

  export interface BrowserPodClass {
    boot(config: { apiKey: string; storageKey?: string }): Promise<BrowserPodInstance>;
  }

  export const BrowserPod: BrowserPodClass;
}

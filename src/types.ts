/**
 * Type definitions for ai-text-plugin (window.ai)
 * https://perchance.org/ai-text-plugin
 */

// ─── AiTextPlugin Types
export interface AiChunkData {
  textChunk: string;
  fullTextSoFar: string;
  isFromStartWith?: boolean;
}

export interface AiStartData {
  inputs: {
    instruction: string;
    startWith?: string;
    stopSequences?: string[];
  };
}

export interface AiFinishData {
  text: string;            // includes startWith
  generatedText: string;   // excludes startWith
  liveResponseText: string;
  stopReason?: string;
}

export interface AiRenderData {
  text: string;
  isPartial: boolean;
}

export interface AiCallOptions {
  instruction: string;
  startWith?: string;
  stopSequences?: string[];
  hideStartWith?: boolean;
  outputTo?: HTMLElement;
  style?: string;
  endButtons?: "none";
  onChunk?: (data: AiChunkData) => void;
  onStart?: (data: AiStartData) => void;
  onFinish?: (data: AiFinishData) => void;
  render?: (data: AiRenderData) => string;
  beforeFirstChunk?: () => void;
  preload?: boolean;
  getMetaObject?: boolean;
}

export interface AiCallResult extends String {
  text: string;
  generatedText: string;
  liveResponseText: string;
  id: string;
  stop(): void;
  inputs: {
    instruction: string;
    startWith?: string;
    stopSequences?: string[];
  };
  submitUserRating(data: { score: number; reason?: string }): void;
  textStream: ReadableStream;
  loadingIndicatorHtml: string;
}

// ─── Global Declaration ─────────────────────────────────────
declare global {
  interface Window {
    ai: (inputData: string | AiCallOptions, extraOpts?: Partial<AiCallOptions>) => AiCallResult;
  }
}

/**
 * Resolve window.ai across frame hierarchy.
 *
 * In Perchance, the HTML panel runs in an iframe, but ai-text-plugin
 * exposes window.ai on the parent page (where the list panel executes).
 */
let _cachedAi: ((input: any, extraOpts?: any) => any) | null = null;

function findAi(): ((input: any, extraOpts?: any) => any) | null {
  if (typeof (window as any).ai === "function") return (window as any).ai;
  try {
    if (window.parent && typeof (window.parent as any).ai === "function") return (window.parent as any).ai;
  } catch { /* cross-origin */ }
  try {
    if (window.top && typeof (window.top as any).ai === "function") return (window.top as any).ai;
  } catch { /* cross-origin */ }
  return null;
}

/** Get the ai function, caching the result after first successful lookup. */
export function getAi(): ((input: any, extraOpts?: any) => any) {
  if (_cachedAi) return _cachedAi;
  const ai = findAi();
  if (ai) {
    _cachedAi = ai;
    return ai;
  }
  throw new Error("window.ai not found in any frame — ai-text-plugin not loaded?");
}

/** Check if ai is available without throwing. */
export function isAiAvailable(): boolean {
  try {
    return getAi() !== null;
  } catch {
    return false;
  }
}

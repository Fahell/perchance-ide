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

/** Possible global names that the user might have imported the plugin as. */
const AI_GLOBAL_NAMES = ["agentAi", "generateText", "text", "ai"];

/**
 * Resolve the ai-text-plugin function across expected global names.
 *
 * In Perchance, importing `name = {import:ai-text-plugin}` in the list panel
 * makes `window.name` available as an async function. We check multiple names
 * to be flexible with whatever the user chose.
 */
let _cachedAi: ((input: any, extraOpts?: any) => any) | null = null;

function findAi(): ((input: any, extraOpts?: any) => any) | null {
  for (const name of AI_GLOBAL_NAMES) {
    const fn = (window as any)[name];
    if (typeof fn === "function") return fn;
  }
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
  throw new Error(
    "ai-text-plugin not found. Make sure your list panel has:\n" +
    '  agentAi = {import:ai-text-plugin}\n' +
    "Then reload the generator."
  );
}

/** Check if ai is available without throwing. */
export function isAiAvailable(): boolean {
  try {
    return getAi() !== null;
  } catch {
    return false;
  }
}

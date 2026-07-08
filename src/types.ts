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

/** Perchance runtime may attach `root` to window or parent frame. */
interface PerchanceWindow {
  [key: string]: unknown;
  root?: Record<string, unknown>;
}

/** Possible global names that the user might have imported the plugin as. */
const AI_GLOBAL_NAMES = ["agentAi", "generateText", "text", "ai"];

/** Narrow window to our Perchance-aware interface for global lookups. */
const pw = window as unknown as PerchanceWindow;
const parentPw = (window.parent as unknown) as PerchanceWindow | null;

/**
 * Resolve the ai-text-plugin function across expected global names.
 *
 * In Perchance, importing `name = {import:ai-text-plugin}` in the list panel:
 * - non-`ai` names (e.g. `agentAi`, `generateText`) → set as `window[name]` globally
 * - `ai` name → ONLY set as `window.root.ai` (Perchance runtime root), NOT `window.ai`
 *
 * We check in order:
 *   1. `window[name]`                         — works for non-ai names
 *   2. `window.root[name]`                    — works for all names including `ai`
 *   3. `window.parent?.root?.[name]`          — iframe fallback to parent's Perchance root
 */
let _cachedAi: ((input: unknown, extraOpts?: unknown) => unknown) | null = null;

function findAi(): ((input: unknown, extraOpts?: unknown) => unknown) | null {
  for (const name of AI_GLOBAL_NAMES) {
    // 1. Direct global (non-ai names like agentAi, generateText)
    const fn = pw[name];
    if (typeof fn === "function") return fn as (...args: unknown[]) => unknown;

    // 2. Perchance root object (all names including "ai")
    const root = pw.root;
    const rootFn = root?.[name];
    if (typeof rootFn === "function") return rootFn as (...args: unknown[]) => unknown;

    // 3. Parent frame's Perchance root (iframe in HTML panel)
    const parentRoot = parentPw?.root;
    const parentRootFn = parentRoot?.[name];
    if (typeof parentRootFn === "function") return parentRootFn as (...args: unknown[]) => unknown;
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

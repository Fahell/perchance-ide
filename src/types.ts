/**
 * Type definitions for Perchance AI Character Chat APIs (oc.*)
 * Based on: https://perchance.org/ai-character-chat-docs
 */

// ─── Message ────────────────────────────────────────────────
export interface OcMessage {
  content: string;
  author: "user" | "ai" | "system";
  name?: string;
  hiddenFrom?: ("user" | "ai")[];
  expectsReply?: boolean;
  customData?: Record<string, unknown>;
  avatar?: {
    url: string;
    size?: number;
    shape?: "circle" | "square" | "portrait";
  };
  wrapperStyle?: string;
  instruction?: string;
  scene?: {
    background?: { url: string; filter?: string };
    music?: { url: string; volume?: number };
  };
}

// ─── Thread ─────────────────────────────────────────────────
export interface OcThread {
  messages: OcMessage[];
  name?: string;
  customData?: Record<string, unknown>;
  messageWrapperStyle?: string;
  shortcutButtons?: OcShortcutButton[];
  character?: OcThreadCharacter;
  userCharacter?: OcThreadCharacter;
  systemCharacter?: OcThreadCharacter;
  on(event: "MessageAdded", handler: (data: { message: OcMessage }) => void | Promise<void>): void;
  on(event: "MessageEdited", handler: (data: { message: OcMessage }) => void | Promise<void>): void;
  on(event: "MessageInserted", handler: (data: { message: OcMessage }) => void | Promise<void>): void;
  on(event: "MessageDeleted", handler: (data: { message: OcMessage; originalIndex: number }) => void): void;
  on(event: "StreamingMessage", handler: (data: { chunks: AsyncIterable<{ text: string }> }) => void): void;
}

export interface OcThreadCharacter {
  name?: string;
  avatar?: { url?: string; size?: number; shape?: string };
  reminderMessage?: string;
  roleInstruction?: string;
}

export interface OcShortcutButton {
  autoSend: boolean;
  insertionType: "replace" | "prepend" | "append";
  message: string;
  name: string;
  clearAfterSend: boolean;
}

// ─── Character ──────────────────────────────────────────────
export interface OcCharacter {
  name: string;
  avatar: { url: string; size: number; shape: string };
  roleInstruction: string;
  reminderMessage: string;
  initialMessages: OcMessage[];
  customCode: string;
  imagePromptPrefix: string;
  imagePromptSuffix: string;
  imagePromptTriggers: string;
  shortcutButtons: OcShortcutButton[];
  streamingResponse: boolean;
  customData: Record<string, unknown> & { PUBLIC?: unknown };
  userCharacter?: OcThreadCharacter;
}

// ─── Generate Text ──────────────────────────────────────────
export interface GenerateTextOptions {
  instruction: string;
  startWith?: string;
  stopSequences?: string[];
  [key: string]: unknown;
}

export interface GenerateTextResult extends String {
  text: string;
  generatedText: string;
}

// ─── Text to Image ──────────────────────────────────────────
export interface TextToImageOptions {
  prompt: string;
  negativePrompt?: string;
  [key: string]: unknown;
}

export interface TextToImageResult {
  dataUrl: string;
}

// ─── Window ─────────────────────────────────────────────────
export interface OcWindow {
  show(): void;
  hide(): void;
}

// ─── Main OC Object ─────────────────────────────────────────
export interface Oc {
  thread: OcThread;
  character: OcCharacter;
  userCharacter?: OcThreadCharacter;
  messageRenderingPipeline: Array<(data: { message: OcMessage; reader: "user" | "ai" }) => void>;
  window: OcWindow;
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
  textToImage(options: TextToImageOptions): Promise<TextToImageResult>;
}

// ─── AiTextPlugin ────────────────────────────────────────────
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
    oc: Oc;
    ai: (inputData: string | AiCallOptions, extraOpts?: Partial<AiCallOptions>) => AiCallResult;
  }
}

/**
 * Zustand Store — vanilla state management for the IDE.
 *
 * Uses `createStore` (zustand/vanilla) for non-UI code, with
 * useSyncExternalStore bridge for Preact components.
 *
 * Runtime state only — persistence lives in db.ts / storage.ts.
 */

import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { AgentStatus, PanelMessage, ToolCallEntry } from "./ui/types.js";

// ─── Helpers ──────────────────────────────────────────────────
let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

// ─── Types ──────────────────────────────────────────────────
export type PanelMode = "chat" | "editor" | "split" | "settings";

export interface IdeSettings {
  locale: string;          // "en" | "pt" | "es" | "ja" | "zh"
  fontSize: number;
  wordWrap: boolean;
  tabSize: number;
}

export interface EditorHistoryEntry {
  past: string[];
  future: string[];
}

export interface FileTab {
  path: string;
  name: string;
  language: string;
  dirty: boolean;
}

export interface IdeState {
  // Active file / editor
  activeFile: string | null;
  files: FileTab[];

  // Editor undo/redo history per file
  editorHistory: Record<string, EditorHistoryEntry>;

  // Layout
  panelMode: PanelMode;
  sidebarVisible: boolean;

  // Settings
  settings: IdeSettings;

  // Status
  isProcessing: boolean;
  statusMessage: string | null;

  // Panel / agent state
  messages: PanelMessage[];
  agentStatus: AgentStatus;

  // ─── Actions ──────────────────────────────────────────
  setActiveFile: (path: string | null) => void;
  setFiles: (files: FileTab[]) => void;
  addFile: (file: FileTab) => void;
  removeFile: (path: string) => void;
  setFileDirty: (path: string, dirty: boolean) => void;
  openFile: (path: string, name: string, language: string) => void;
  closeFile: (path: string) => void;

  // Editor history
  pushEditorState: (path: string, content: string) => void;
  undoEditor: (path: string) => string | null;
  redoEditor: (path: string) => string | null;

  // Layout
  setPanelMode: (mode: PanelMode) => void;
  toggleSidebar: () => void;

  // Settings
  updateSettings: (partial: Partial<IdeSettings>) => void;

  // Status
  setProcessing: (processing: boolean, message?: string) => void;
  setStatusMessage: (message: string | null) => void;

  // Panel actions (replaces window.__agentPanelActions)
  addUserMessage: (content: string) => void;
  setAgentStatus: (status: AgentStatus) => void;
  addToolCall: (name: string, args: Record<string, unknown>) => string;
  updateToolCall: (id: string, updates: Partial<ToolCallEntry>) => void;
  appendAgentResponse: (response: string) => void;
}

// ─── Defaults ────────────────────────────────────────────────
const DEFAULT_SETTINGS: IdeSettings = {
  locale: "en",
  fontSize: 14,
  wordWrap: true,
  tabSize: 2,
};

// ─── Store ───────────────────────────────────────────────────
export const ideStore = createStore<IdeState>()(
  subscribeWithSelector((set, get) => ({
    // ── State ──────────────────────────────────────────
    activeFile: null,
    files: [],
    editorHistory: {},
    panelMode: "chat",
    sidebarVisible: true,
    settings: { ...DEFAULT_SETTINGS },
    isProcessing: false,
    statusMessage: null,
    messages: [],
    agentStatus: "idle" as AgentStatus,

    // ── Actions ────────────────────────────────────────

    setActiveFile: (path) => set({ activeFile: path }),

    setFiles: (files) => set({ files }),

    addFile: (file) =>
      set((s) => ({
        files: s.files.some((f) => f.path === file.path)
          ? s.files
          : [...s.files, file],
      })),

    removeFile: (path) =>
      set((s) => ({
        files: s.files.filter((f) => f.path !== path),
        activeFile: s.activeFile === path ? null : s.activeFile,
      })),

    setFileDirty: (path, dirty) =>
      set((s) => ({
        files: s.files.map((f) => (f.path === path ? { ...f, dirty } : f)),
      })),

    openFile: (path, name, language) =>
      set((s) => {
        // If already open, just set as active
        if (s.files.some((f) => f.path === path)) {
          return { activeFile: path };
        }
        return {
          files: [...s.files, { path, name, language, dirty: false }],
          activeFile: path,
        };
      }),

    closeFile: (path) =>
      set((s) => {
        const idx = s.files.findIndex((f) => f.path === path);
        if (idx === -1) return s;
        const remaining = s.files.filter((f) => f.path !== path);
        let newActive = s.activeFile;
        if (s.activeFile === path) {
          const nextIdx = Math.min(idx, remaining.length - 1);
          newActive = remaining[nextIdx]?.path ?? null;
        }
        return { files: remaining, activeFile: newActive };
      }),

    pushEditorState: (path, content) =>
      set((s) => {
        const history = s.editorHistory[path] ?? { past: [], future: [] };
        return {
          editorHistory: {
            ...s.editorHistory,
            [path]: {
              past:
                history.past.length > 50
                  ? [...history.past.slice(-49), content]
                  : [...history.past, content],
              future: [],
            },
          },
        };
      }),

    undoEditor: (path) => {
      const history = get().editorHistory[path];
      if (!history || history.past.length === 0) return null;
      const prev = history.past[history.past.length - 1];
      const newPast = history.past.slice(0, -1);
      set((s) => ({
        editorHistory: {
          ...s.editorHistory,
          [path]: { past: newPast, future: [prev, ...history.future] },
        },
      }));
      return prev;
    },

    redoEditor: (path) => {
      const history = get().editorHistory[path];
      if (!history || history.future.length === 0) return null;
      const next = history.future[0];
      const newFuture = history.future.slice(1);
      set((s) => ({
        editorHistory: {
          ...s.editorHistory,
          [path]: { past: [...history.past, next], future: newFuture },
        },
      }));
      return next;
    },

    setPanelMode: (panelMode) => set({ panelMode }),

    toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),

    updateSettings: (partial) =>
      set((s) => ({ settings: { ...s.settings, ...partial } })),

    setProcessing: (isProcessing, message) =>
      set({ isProcessing, statusMessage: message ?? null }),

    setStatusMessage: (statusMessage) => set({ statusMessage }),

    // ── Panel actions ──────────────────────────────────

    addUserMessage: (content) =>
      set((s) => ({
        messages: [
          ...s.messages,
          { id: nextId(), role: "user", content, toolCalls: [], timestamp: Date.now() },
        ],
      })),

    setAgentStatus: (agentStatus) => set({ agentStatus }),

    addToolCall: (name, args) => {
      const tcId = `tc-${++msgCounter}-${Date.now()}`;
      const entry: ToolCallEntry = { id: tcId, name, args, status: "running" };
      set((s) => {
        const last = s.messages[s.messages.length - 1];
        if (last && last.role === "agent") {
          const updated = [...s.messages];
          updated[updated.length - 1] = {
            ...last,
            toolCalls: [...last.toolCalls, entry],
          };
          return { messages: updated };
        }
        return {
          messages: [
            ...s.messages,
            { id: nextId(), role: "agent", content: "", toolCalls: [entry], timestamp: Date.now() },
          ],
        };
      });
      return tcId;
    },

    updateToolCall: (id, updates) =>
      set((s) => {
        const last = s.messages[s.messages.length - 1];
        if (last && last.role === "agent") {
          const updated = [...s.messages];
          updated[updated.length - 1] = {
            ...last,
            toolCalls: last.toolCalls.map((tc) =>
              tc.id === id ? { ...tc, ...updates } : tc
            ),
          };
          return { messages: updated };
        }
        return s;
      }),

    appendAgentResponse: (response) =>
      set((s) => {
        const last = s.messages[s.messages.length - 1];
        if (last && last.role === "agent") {
          const updated = [...s.messages];
          updated[updated.length - 1] = { ...last, content: response };
          return { messages: updated, agentStatus: "idle" };
        }
        return {
          messages: [
            ...s.messages,
            { id: nextId(), role: "agent", content: response, toolCalls: [], timestamp: Date.now() },
          ],
          agentStatus: "idle",
        };
      }),
  }))
);

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

  // ─── Actions ──────────────────────────────────────────
  setActiveFile: (path: string | null) => void;
  setFiles: (files: FileTab[]) => void;
  addFile: (file: FileTab) => void;
  removeFile: (path: string) => void;
  setFileDirty: (path: string, dirty: boolean) => void;

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
  }))
);

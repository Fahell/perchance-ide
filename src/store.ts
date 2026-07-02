/**
 * Zustand Store — vanilla state management for the IDE.
 *
 * Uses `createStore` (zustand/vanilla) for non-UI code, with
 * useSyncExternalStore bridge for Preact components.
 *
 * Runtime state only — persistence lives in db.ts / storage.ts.
 */

import type { EditorView } from "codemirror";
import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import { dbSaveVfs } from "./db.js";
import type { AgentStatus, PanelMessage, ToolCallEntry } from "./ui/types.js";
import { vfsGetAll, vfsRename } from "./vfs.js";

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
  autoSave: boolean;
  toolWebEnabled: boolean;
  toolContextEnabled: boolean;
  toolVfsEnabled: boolean;
  toolTerminalEnabled: boolean;
}

export interface OutputEntry {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: number;
}

const MAX_OUTPUTS = 20;

export interface FileTab {
  path: string;
  name: string;
  language: string;
  dirty: boolean;
  saveStatus: "idle" | "saving" | "saved";
}

export interface IdeState {
  // Active file / editor
  activeFile: string | null;
  files: FileTab[];

  // Layout
  panelMode: PanelMode;
  sidebarVisible: boolean;

  // Settings
  settings: IdeSettings;

  // Status
  isProcessing: boolean;
  statusMessage: string | null;

  // Pyodide runtime
  pyodideStatus: "idle" | "loading" | "loaded" | "error";
  pyodideError: string | null;

  // Panel / agent state
  messages: PanelMessage[];
  agentStatus: AgentStatus;

  // Right panel tab (10.1 / 11.2 / 11.3)
  rightPanelTab: "files" | "outline" | "preview" | "output";

  // Active EditorView ref (10.1)
  editorView: EditorView | null;

  // Settings version — incremented on update to trigger editor recreation (10.4)
  settingsVersion: number;

  // VFS version counter — incremented on file writes for preview reactivity (11.2)
  vfsVersion: number;

  // Output history for OutputPanel (11.3)
  outputs: OutputEntry[];

  // ─── Actions ──────────────────────────────────────────
  setActiveFile: (path: string | null) => void;
  setFiles: (files: FileTab[]) => void;
  addFile: (file: FileTab) => void;
  removeFile: (path: string) => void;
  setFileDirty: (path: string, dirty: boolean) => void;
  setFileSaveStatus: (path: string, status: "idle" | "saving" | "saved") => void;
  openFile: (path: string, name: string, language: string) => void;
  closeFile: (path: string) => void;
  setPyodideStatus: (status: "idle" | "loading" | "loaded" | "error", error?: string) => void;

  // Layout
  setPanelMode: (mode: PanelMode) => void;
  toggleSidebar: () => void;

  // Right panel tab
  setRightPanelTab: (tab: "files" | "outline" | "preview" | "output") => void;
  setEditorView: (view: EditorView | null) => void;

  // File rename (10.3)
  renameFile: (oldPath: string, newPath: string) => void;

  // Settings
  updateSettings: (partial: Partial<IdeSettings>) => void;

  // Status
  setProcessing: (processing: boolean, message?: string) => void;
  setStatusMessage: (message: string | null) => void;

  // VFS version bump (11.2)
  bumpVfsVersion: () => void;

  // Output panel (11.3)
  addOutput: (entry: Omit<OutputEntry, "id" | "timestamp">) => void;
  clearOutputs: () => void;

  // Panel actions (replaces window.__agentPanelActions)
  addUserMessage: (content: string) => void;
  setAgentStatus: (status: AgentStatus) => void;
  addToolCall: (name: string, args: Record<string, unknown>) => string;
  updateToolCall: (id: string, updates: Partial<ToolCallEntry>) => void;
  appendAgentResponse: (response: string) => void;
  clearMessages: () => void;
}

// ─── Defaults ────────────────────────────────────────────────
const DEFAULT_SETTINGS: IdeSettings = {
  locale: "en",
  fontSize: 14,
  wordWrap: true,
  tabSize: 2,
  autoSave: true,
  toolWebEnabled: true,
  toolContextEnabled: true,
  toolVfsEnabled: true,
  toolTerminalEnabled: true,
};

// ─── Store ───────────────────────────────────────────────────
export const ideStore = createStore<IdeState>()(
  subscribeWithSelector((set, get) => ({
    // ── State ──────────────────────────────────────────
    activeFile: null,
    files: [],
    panelMode: "chat",
    sidebarVisible: true,
    settings: { ...DEFAULT_SETTINGS },
    isProcessing: false,
    statusMessage: null,
    pyodideStatus: "idle" as "idle" | "loading" | "loaded" | "error",
    pyodideError: null,
    messages: [],
    agentStatus: "idle" as AgentStatus,
    rightPanelTab: "files" as "files" | "outline" | "preview" | "output",
    editorView: null as EditorView | null,
    settingsVersion: 0,
    vfsVersion: 0,
    outputs: [] as OutputEntry[],

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

    setFileSaveStatus: (path, saveStatus) =>
      set((s) => ({
        files: s.files.map((f) => (f.path === path ? { ...f, saveStatus } : f)),
      })),

    openFile: (path, name, language) =>
      set((s) => {
        // If already open, just set as active
        if (s.files.some((f) => f.path === path)) {
          return { activeFile: path };
        }
        return {
          files: [...s.files, { path, name, language, dirty: false, saveStatus: "idle" }],
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

    setPanelMode: (panelMode) => set({ panelMode }),

    toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),

    updateSettings: (partial) =>
      set((s) => ({
        settings: { ...s.settings, ...partial },
        settingsVersion: s.settingsVersion + 1,
      })),

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

    clearMessages: () => set({ messages: [], agentStatus: "idle" }),

    bumpVfsVersion: () => set((s) => ({ vfsVersion: s.vfsVersion + 1 })),

    addOutput: (entry) =>
      set((s) => {
        const id = `out-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const full: OutputEntry = {
          ...entry,
          id,
          timestamp: Date.now(),
        };
        return {
          outputs: [...s.outputs, full].slice(-MAX_OUTPUTS),
        };
      }),

    clearOutputs: () => set({ outputs: [] }),

    setPyodideStatus: (status, error) =>
      set({ pyodideStatus: status, pyodideError: error ?? null }),

    setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

    setEditorView: (view) => set({ editorView: view }),

    renameFile: (oldPath, newPath) => {
      if (!vfsRename(oldPath, newPath)) return;
      const state = get();
      const oldTab = state.files.find((f) => f.path === oldPath);
      if (oldTab) {
        const name = newPath.split("/").filter(Boolean).pop() ?? newPath;
        const ext =
          newPath.split(".").pop()?.toLowerCase() ?? "js";
        set((s) => ({
          files: s.files.map((f) =>
            f.path === oldPath
              ? { ...f, path: newPath, name, language: ext }
              : f
          ),
          activeFile:
            s.activeFile === oldPath ? newPath : s.activeFile,
        }));
      }
      // Fire-and-forget persist
      dbSaveVfs(vfsGetAll()).catch((e) =>
        console.warn("[Store] renameFile persist failed:", e)
      );
    },
  }))
);

// ─── Settings persistence ────────────────────────────────────

/**
 * Load editor settings from localStorage and apply to store.
 * Called once during bootstrap.
 */
export function loadSettings(): void {
  try {
    const raw = localStorage.getItem("agent:editor_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        ideStore.getState().updateSettings(parsed);
      }
    }
  } catch {
    // Ignore corrupt data
  }
}

// Auto-persist settings on change
ideStore.subscribe(
  (s: any) => s.settings,
  (settings: any) => {
    try {
      localStorage.setItem(
        "agent:editor_settings",
        JSON.stringify(settings)
      );
    } catch {
      // Storage full or unavailable — ignore
    }
  }
);

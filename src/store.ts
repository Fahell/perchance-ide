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
import type { AgentStatus, PanelMessage, ToolCallEntry } from "./ui/types.js";
import { getDebounceMs, scheduleVfsPersist, setDebounceMs } from "./vfs-persist.js";

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
  toolNodeEnabled: boolean;
  browserPodApiKey: string;
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

/** Represents a file where both the editor buffer and VFS have diverged since last save. */
export interface ConflictedFile {
  /** Path of the conflicted file */
  path: string;
  /** Hash of the VFS content at conflict time */
  externalHash: string;
  /** When the conflict was detected */
  timestamp: number;
  /** Whether user was shown the conflict (for dedup) */
  notified: boolean;
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

  // BrowserPod runtime
  browserPodStatus: "idle" | "loading" | "ready" | "error";
  browserPodError: string | null;

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

  // Conflict tracking — files with divergent editor buffer vs VFS content
  conflictedFiles: Record<string, ConflictedFile>;

  // Terminal panel state
  terminalOpen: boolean;
  activePortals: Array<{ url: string; port: number }>;

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
  setBrowserPodStatus: (status: "idle" | "loading" | "ready" | "error", error?: string) => void;

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

  // Terminal panel actions
  setTerminalOpen: (open: boolean) => void;
  addPortal: (portal: { url: string; port: number }) => void;
  clearPortals: () => void;

  // Output panel (11.3)
  addOutput: (entry: Omit<OutputEntry, "id" | "timestamp">) => void;
  clearOutputs: () => void;

  // Conflict resolution
  setConflictedFile: (path: string, conflict: ConflictedFile) => void;
  resolveConflict: (path: string, choice: "keep" | "accept") => void;
  clearConflict: (path: string) => void;

  // Panel actions (replaces window.__agentPanelActions)
  addUserMessage: (content: string) => void;
  setAgentStatus: (status: AgentStatus) => void;
  addToolCall: (name: string, args: Record<string, unknown>) => string;
  updateToolCall: (id: string, updates: Partial<ToolCallEntry>) => void;
  appendAgentResponse: (response: string) => void;
  appendToLastAgentResponse: (text: string) => void;
  clearMessages: () => void;
}

// ─── Defaults ────────────────────────────────────────────────
const DEFAULT_SETTINGS: IdeSettings = {
  locale: "en",
  fontSize: 14,
  wordWrap: true,
  tabSize: 2,
  autoSave: false,
  toolWebEnabled: false,
  toolContextEnabled: true,
  toolVfsEnabled: true,
  toolTerminalEnabled: true,
  toolNodeEnabled: false,
  browserPodApiKey: "",
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
    browserPodStatus: "idle" as "idle" | "loading" | "ready" | "error",
    browserPodError: null,
    messages: [],
    agentStatus: "idle" as AgentStatus,
    rightPanelTab: "files" as "files" | "outline" | "preview" | "output",
    editorView: null as EditorView | null,
    settingsVersion: 0,
    vfsVersion: 0,
    terminalOpen: false,
    activePortals: [] as Array<{ url: string; port: number }>,
    outputs: [] as OutputEntry[],
    conflictedFiles: {},

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

    appendToLastAgentResponse: (text) =>
      set((state) => {
        const msgs = [...state.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "agent") {
            msgs[i] = { ...msgs[i], content: msgs[i].content + text };
            break;
          }
        }
        return { messages: msgs };
      }),

    clearMessages: () => set({ messages: [], agentStatus: "idle" }),

    // ── Conflict resolution ─────────────────────────────

    setConflictedFile: (path, conflict) =>
      set((s) => ({
        conflictedFiles: { ...s.conflictedFiles, [path]: conflict },
      })),

    resolveConflict: (path, choice) =>
      set((s) => {
        const newConflicts = { ...s.conflictedFiles };
        delete newConflicts[path];

        if (choice === "accept") {
          // Accept external (VFS) version — editor will reload via onVfsChange
          return { conflictedFiles: newConflicts };
        }

        // "keep" — overwrite VFS with editor buffer, then persist
        const tab = s.files.find((f) => f.path === path);
        if (tab) {
          // The editor will have already written its buffer via onVfsChange
          // when the user clicks "keep", so just ensure mark clean
          s.setFileDirty(path, false);
          scheduleVfsPersist();
        }
        return { conflictedFiles: newConflicts };
      }),

    clearConflict: (path) =>
      set((s) => {
        const newConflicts = { ...s.conflictedFiles };
        delete newConflicts[path];
        return { conflictedFiles: newConflicts };
      }),

    bumpVfsVersion: () => set((s) => ({ vfsVersion: s.vfsVersion + 1 })),

    setTerminalOpen: (open) => set({ terminalOpen: open }),
    addPortal: (portal) =>
      set((s) => ({
        activePortals: [...s.activePortals.filter((p) => p.port !== portal.port), portal],
      })),
    clearPortals: () => set({ activePortals: [] }),

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
    setBrowserPodStatus: (status, error) =>
      set({ browserPodStatus: status, browserPodError: error ?? null }),

    setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

    setEditorView: (view) => set({ editorView: view }),

    /**
     * Rename a file tab in the IDE. Does NOT touch VFS — the caller must
     * call trackedRename() before invoking this action (see vfs-tools.ts
     * rename_file tool, RightPanel.tsx, CodeEditor TabBar).
     * This action only updates tab metadata and triggers a persist.
     */
    renameFile: (oldPath, newPath) => {
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
      scheduleVfsPersist();
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

    // Adjust vfs-persist debounce based on autoSave setting
    // When autoSave is on, persist faster (500ms instead of 2000ms)
    if (settings.autoSave === true && getDebounceMs() > 500) {
      setDebounceMs(500);
    } else if (settings.autoSave === false && getDebounceMs() < 2000) {
      setDebounceMs(2000);
    }
  }
);

// ─── Reactive BrowserPod Lifecycle (PR-1) ──────────────────
//
// Reacts to runtime changes in `settings.toolNodeEnabled` and
// `settings.browserPodApiKey`. Index.ts still handles the initial startup
// boot; this subscriber covers runtime toggles + key changes without
// requiring a page reload.
//
// The first subscribe fire (from loadSettings() during init) is consumed
// by the `primed` flag below — index.ts boots BrowserPod there so this
// subscriber does not double-fire during startup. All subsequent fires
// (user toggles in SettingsModal) go through full reactive logic.
let bpReactivePrimed = false;
ideStore.subscribe(
  (s: IdeState) => s.settings,
  (curr: IdeSettings, prev: IdeSettings) => {
    if (!bpReactivePrimed) {
      bpReactivePrimed = true;
      return;
    }

    const wasActive =
      prev.toolNodeEnabled && prev.browserPodApiKey.length > 0;
    const isActive =
      curr.toolNodeEnabled && curr.browserPodApiKey.length > 0;
    const keyChanged =
      prev.browserPodApiKey !== curr.browserPodApiKey;

    if (wasActive === isActive && !keyChanged) return;

    // Dynamic import — store.ts → manager.ts is safe (manager does not
    // import store) but dynamic form defers the cost past module init.
    import("./browserpod/manager.js").then(async ({ browserPodManager }) => {
      const status = browserPodManager.getStatus();

      // ── TEAR DOWN: toggle off OR key cleared ──
      if (!isActive) {
        if (
          status === "ready" ||
          status === "loading" ||
          status === "error"
        ) {
          console.log("[Store] BrowserPod: tearing down (toggle off or key cleared)");
          await browserPodManager.dispose();
          ideStore.getState().setBrowserPodStatus("idle");
        }
        return;
      }

      // ── ACTIVATE: status guards prevent re-boot during in-flight boot ──
      if (status === "loading") return;

      const cfg = browserPodManager.getConfig();
      const sameKey = cfg?.apiKey === curr.browserPodApiKey;
      const bootNeeded =
        status === "idle" ||
        status === "error" ||
        (status === "ready" && !sameKey);

      if (!bootNeeded) return;

      // Deliberately do NOT log any API key prefix — secrets never reach DevTools logs.
      console.log(
        "[Store] BrowserPod: booting —",
        status === "idle" ? "fresh initialization" :
        status === "error" ? "retry after error" :
        "API key change re-authentication"
      );

      const ok = await browserPodManager.boot({
        apiKey: curr.browserPodApiKey,
        nodeVersion: "22",
        storageKey: "agent-perchance",
      });

      if (!ok) {
        console.warn("[Store] BrowserPod boot returned false; status set by manager.");
        return;
      }

      ideStore.getState().setBrowserPodStatus("ready");

      // Real-time VFS → Pod sync (incremental).
      browserPodManager.subscribeToVfsChanges();

      // Bulk initial sync (Pod starts with empty FS).
      try {
        const { syncVfsToPod } = await import("./tools/sync-utils.js");
        await syncVfsToPod(false);
      } catch (err) {
        console.warn("[Store] Initial VFS→Pod sync failed:", err);
      }
    }).catch((err) => {
      console.error("[Store] Failed to handle BrowserPod lifecycle change:", err);
    });
  }
);

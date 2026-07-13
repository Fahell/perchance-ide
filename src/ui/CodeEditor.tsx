/**
 * CodeEditor — tabbed code editor powered by CodeMirror 6.
 *
 * Features:
 * - Multiple open tabs backed by VFS (store)
 * - Syntax highlighting via CM6 language support
 * - New tab / close tab
 * - Auto-save to VFS (debounced 500ms)
 * - Lazy-loaded — CM6 bundle only imported when component mounts
 */

import { Transaction } from "@codemirror/state";
import { useEffect, useRef, useState } from "preact/hooks";
import { getBreadcrumbs, type Breadcrumb } from "../editor/breadcrumbs.js";
import { getEmmetSyntax } from "../editor/emmet-langs.js";
import { getEmmetExtensions } from "../editor/emmet.js";
import { setCurrentView } from "../editor/view-store.js";
import { t, type Locale } from "../i18n/index.js";
import { ideStore, type IdeState } from "../store.js";
import { getHash, onVfsChange, trackedRename, trackedWrite } from "../vfs-events.js";
import { flushVfsPersist, scheduleVfsPersist } from "../vfs-persist.js";
import { vfsExists, vfsRead } from "../vfs.js";
import { BreadcrumbsBar } from "./BreadcrumbsBar.js";
import { EditorStatusBar, dispatchStatusUpdate } from "./EditorStatusBar.js";
import { colors, fonts } from "./theme.js";

// ─── Types ──────────────────────────────────────────────────
interface CodeEditorProps {
  locale?: Locale;
}

// ─── Helpers ────────────────────────────────────────────────
function getExt(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "js";
}

// ─── Component ──────────────────────────────────────────────
export function CodeEditor({ locale }: CodeEditorProps) {
  // Subscribe to Zustand store
  const [store, setStore] = useState<IdeState>(ideStore.getState());
  useEffect(() => {
    return ideStore.subscribe((s) => setStore(s));
  }, []);

  const { files, activeFile } = store;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<import("codemirror").EditorView | null>(null);
  const debounceRef = useRef<number | null>(null);
  const [pendingCloseFile, setPendingCloseFile] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [loadRetry, setLoadRetry] = useState(0);
  const lastSavedHashRef = useRef<string | null>(null);
  const saveStatusTimerRef = useRef<number | null>(null);
  const prevActiveRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const filesRef = useRef(files);
  const activeFileRef = useRef(activeFile);
  const localeRef = useRef(locale);
  const autoSaveRef = useRef(store.settings.autoSave);
  filesRef.current = files;
  activeFileRef.current = activeFile;
  localeRef.current = locale;
  autoSaveRef.current = store.settings.autoSave;

  // Auto-clear save status after a delay (replaces orphan setTimeout calls)
  function scheduleSaveStatusClear(path: string, delay = 800) {
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    saveStatusTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      ideStore.getState().setFileSaveStatus(path, "idle");
      saveStatusTimerRef.current = null;
    }, delay);
  }

  // ── Mount / remount editor when activeFile changes ─────
  useEffect(() => {
    const path = activeFile;

    // If activeFile is null (last tab closed), destroy view and clean up
    if (!path) {
      if (viewRef.current) {
        setCurrentView(null);
        viewRef.current.destroy();
        viewRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      prevActiveRef.current = null;
      setEditorError(null);
      return;
    }

    if (!containerRef.current) return;

    // Save previous file content before switching
    if (prevActiveRef.current && viewRef.current) {
      if (vfsExists(prevActiveRef.current)) {
        const content = viewRef.current.state.doc.toString();
        trackedWrite(prevActiveRef.current, content);
        ideStore.getState().setFileDirty(prevActiveRef.current, false);
        // Use flush instead of schedule — user finished editing this file
        flushVfsPersist();
      }
    }
    prevActiveRef.current = path;
    setEditorError(null);

    // Destroy old editor
    if (viewRef.current) {
      setCurrentView(null);
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // Read settings from store (10.4)
    const { fontSize, tabSize, wordWrap } = store.settings;

    // Read content from VFS
    const content = vfsRead(path) ?? "";
    lastSavedHashRef.current = getHash(path) ?? null;

    // Timeout: if CM6 doesn't load within 10s, show error
    const loadTimeout = window.setTimeout(() => {
      if (!mountedRef.current || viewRef.current) return;
      setEditorError("Editor failed to load. The CodeMirror bundle may be unavailable.");
    }, 10000);

    let cancelled = false;
    (async () => {
      try {
        const [{ createEditor }, { getLanguageSupport }] = await Promise.all([
          import("../editor/index.js"),
          import("../editor/langs.js"),
        ]);
        if (cancelled || !containerRef.current) return;
        clearTimeout(loadTimeout);

        // Lazy-load Emmet for eligible file types (11.5)
        const emmetSyntax = getEmmetSyntax(path);
        const emmetExts = emmetSyntax ? await getEmmetExtensions(emmetSyntax) : [];
        if (cancelled) return;

        viewRef.current = createEditor({
          parent: containerRef.current,
          doc: content,
          language: getLanguageSupport(path),
          filename: path,
          extraExtensions: emmetExts,
          fontSize,
          tabSize,
          wordWrap,
          onCursorChange: (info) => {
            dispatchStatusUpdate(info, path);
            // Update breadcrumbs from cursor position
            if (viewRef.current) {
              setBreadcrumbs(getBreadcrumbs(viewRef.current, viewRef.current.state.selection.main.head));
            }
          },
          onChange: (doc) => {
            if (!mountedRef.current) return;
            ideStore.getState().setFileSaveStatus(path, "saving");
            // Debounce save to VFS
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = window.setTimeout(() => {
              if (!mountedRef.current) return;
              // Skip auto-save if disabled in settings
              if (!ideStore.getState().settings.autoSave) return;
              trackedWrite(path, doc);
              lastSavedHashRef.current = getHash(path) ?? null;
              ideStore.getState().setFileDirty(path, false);
              ideStore.getState().setFileSaveStatus(path, "saved");
              ideStore.getState().bumpVfsVersion();
              scheduleVfsPersist();
              scheduleSaveStatusClear(path);
            }, 200);
            ideStore.getState().setFileDirty(path, true);
          },
        });

        // Populate breadcrumbs for initial cursor position
        // (onCursorChange callback won't fire for initial state)
        setBreadcrumbs(getBreadcrumbs(viewRef.current, viewRef.current.state.selection.main.head));

        // Share view with OutlinePanel (10.1)
        setCurrentView(viewRef.current);
      } catch (err) {
        if (cancelled) return;
        clearTimeout(loadTimeout);
        setEditorError(`Editor failed to load: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(loadTimeout);
      setCurrentView(null);
    };
  }, [activeFile, store.settingsVersion, loadRetry]);

  // ── Listen for flush-save event (from Ctrl+S shortcut) ─
  useEffect(() => {
    function handleFlushSave(e: Event) {
      const { path } = (e as CustomEvent).detail as { path: string };
      if (!viewRef.current) return;
      // Flush debounced write
      if (debounceRef.current) clearTimeout(debounceRef.current);
      trackedWrite(path, viewRef.current.state.doc.toString());
      lastSavedHashRef.current = getHash(path) ?? null;
      ideStore.getState().setFileDirty(path, false);
      ideStore.getState().setFileSaveStatus(path, "saved");
      ideStore.getState().bumpVfsVersion();
      scheduleSaveStatusClear(path);
      // Trigger immediate persist
      flushVfsPersist().catch((err: unknown) =>
        console.warn("[CodeEditor] flush-save persist failed:", err)
      );
    }
    document.addEventListener("editor:flush-save", handleFlushSave);
    return () => document.removeEventListener("editor:flush-save", handleFlushSave);
  }, []);

  // ── Listen for flush-before-rename event (from TabBar rename) ──
  useEffect(() => {
    function handleFlushBeforeRename(e: Event) {
      const { path } = (e as CustomEvent).detail as { path: string };
      if (!viewRef.current) return;
      const currentPath = ideStore.getState().activeFile;
      if (path !== currentPath) return;
      // Cancel pending debounce and flush buffer to VFS immediately
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      trackedWrite(path, viewRef.current.state.doc.toString());
      lastSavedHashRef.current = getHash(path) ?? null;
      ideStore.getState().setFileDirty(path, false);
      scheduleVfsPersist();
    }
    document.addEventListener("editor:flush-before-rename", handleFlushBeforeRename);
    return () => document.removeEventListener("editor:flush-before-rename", handleFlushBeforeRename);
  }, []);

  // ── Subscribe to VFS changes (external writes, deletes, renames) ──
  useEffect(() => {
    const unsub = onVfsChange((event) => {
      if (!mountedRef.current) return;
      const currentPath = ideStore.getState().activeFile;
      if (!currentPath || !viewRef.current) return;

      if (event.type === "deleted") {
        // Close tab if the deleted path matches any open tab
        const deletedPath = event.path;
        const state = ideStore.getState();
        for (const f of [...state.files]) {
          if (f.path === deletedPath || f.path.startsWith(deletedPath + "/")) {
            state.closeFile(f.path);
          }
        }
        return;
      }

      if (event.type === "modified" || event.type === "created") {
        // Only sync if this is the active file and hash differs from our last save
        if (event.path !== currentPath) return;
        if (event.currentHash && event.currentHash === lastSavedHashRef.current) return;
        // External change detected
        const state = ideStore.getState();
        const tab = state.files.find((f) => f.path === currentPath);

        if (tab?.dirty) {
          // Editor has unsaved changes — mark conflict instead of overwriting
          state.setConflictedFile(currentPath, {
            path: currentPath,
            externalHash: event.currentHash ?? getHash(currentPath) ?? "",
            timestamp: Date.now(),
            notified: true,
          });
          return;
        }

        // Editor buffer is clean — safe to reload from VFS
        const newContent = vfsRead(currentPath);
        if (newContent === null) return;
        const view = viewRef.current;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: newContent },
          // Don't add external reloads to undo history — prevents confusing
          // Ctrl+Z behavior where "undo" jumps past the external change.
          annotations: [Transaction.addToHistory.of(false)],
        });
        lastSavedHashRef.current = event.currentHash ?? getHash(currentPath) ?? null;
        ideStore.getState().setFileDirty(currentPath, false);
      }

      if (event.type === "renamed") {
        // If the renamed file is currently active, update refs
        if (event.fromPath === currentPath) {
          prevActiveRef.current = event.toPath ?? null;
          lastSavedHashRef.current = event.currentHash ?? null;
        }
      }
    });
    return unsub;
  }, []);
  // ── Listen for close-tab requests (from Ctrl+W) ────────
  useEffect(() => {
    function handleCloseTabRequest(e: Event) {
      const { path } = (e as CustomEvent).detail as { path: string };
      const currentFiles = filesRef.current;
      const tab = currentFiles.find((f) => f.path === path);
      if (!tab) return;
      // Always use the custom dialog — unified for both auto-save states
      if (tab.dirty) {
        setPendingCloseFile(path);
        return;
      }
      doCloseFile(path);
    }
    document.addEventListener("editor:request-close-tab", handleCloseTabRequest);
    return () => document.removeEventListener("editor:request-close-tab", handleCloseTabRequest);
  }, []);

  // ── Cleanup on unmount ──────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      setCurrentView(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      if (viewRef.current) {
        const currentFile = activeFile;
        if (currentFile) {
          trackedWrite(currentFile, viewRef.current.state.doc.toString());
        }
        viewRef.current.destroy();
        viewRef.current = null;
      }
      // Flush pending persist on unmount — use race timeout to avoid blocking
      Promise.race([
        flushVfsPersist(),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]).catch((e) =>
        console.warn("[CodeEditor] final persist failed:", e)
      );
    };
  }, []);

  // ── Actions ─────────────────────────────────────────────
  function addTab() {
    const count = files.length + 1;
    const name = `untitled-${count}.js`;
    const path = "/" + name;
    if (!vfsExists(path)) {
      trackedWrite(path, "");
      scheduleVfsPersist();
    }
    ideStore.getState().openFile(path, name, "js");
  }

  function doCloseFile(path: string) {
    if (viewRef.current && path === activeFile && vfsExists(path)) {
      trackedWrite(path, viewRef.current.state.doc.toString());
      scheduleVfsPersist();
    }
    ideStore.getState().closeFile(path);
    setPendingCloseFile(null);
  }

  function closeTab(path: string, e: MouseEvent) {
    e.stopPropagation();
    const tab = files.find((f) => f.path === path);
    // Always use the custom dialog for dirty tabs — unified for both auto-save states
    if (tab?.dirty) {
      setPendingCloseFile(path);
      return;
    }
    doCloseFile(path);
  }

  function handleSaveAndClose() {
    if (pendingCloseFile && viewRef.current && pendingCloseFile === activeFile) {
      trackedWrite(pendingCloseFile, viewRef.current.state.doc.toString());
      scheduleVfsPersist();
    }
    ideStore.getState().closeFile(pendingCloseFile!);
    setPendingCloseFile(null);
  }

  function handleCloseAnyway() {
    // Close without saving — VFS retains last saved state
    ideStore.getState().closeFile(pendingCloseFile!);
    setPendingCloseFile(null);
  }

  function selectTab(path: string) {
    if (path === activeFile) return;
    ideStore.getState().setActiveFile(path);
  }

  const activeTab = files.find((f) => f.path === activeFile);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: colors.bg, borderLeft: `1px solid ${colors.border}`,
    }}>
      <TabBar
        tabs={files}
        activeFile={activeFile ?? null}
        onSelect={selectTab}
        onClose={closeTab}
        onAdd={addTab}
        locale={locale}
      />
      {activeFile && (
        <BreadcrumbsBar path={activeFile} symbols={breadcrumbs} />
      )}
      <div ref={containerRef} style={{
        flex: 1, overflow: "hidden", position: "relative",
      }}>
        {!activeTab && (
          <div style={{
            padding: "12px", color: colors.textMuted,
            fontSize: "11px", fontFamily: fonts.mono,
          }}>
            {t("editor.noFiles", locale) || "no files open"}
          </div>
        )}
        {activeTab && !viewRef.current && !editorError && (
          <div style={{
            padding: "12px", color: colors.textMuted,
            fontSize: "11px", fontFamily: fonts.mono,
          }}>
            {t("editor.loading", locale) || "loading editor..."}
          </div>
        )}
        {editorError && (
          <div style={{
            padding: "16px", color: colors.statusError,
            fontSize: "11px", fontFamily: fonts.mono,
            display: "flex", flexDirection: "column", gap: "10px",
            alignItems: "flex-start",
          }}>
            <span>⚠ {editorError}</span>
            <button
              onClick={() => {
                setEditorError(null);
                setLoadRetry((n) => n + 1);
              }}
              style={{
                padding: "6px 12px",
                border: `1px solid ${colors.textSecondary}`,
                background: "transparent",
                color: colors.textSecondary,
                fontSize: "10px", fontFamily: fonts.mono,
                cursor: "pointer",
              }}
            >
              retry
            </button>
          </div>
        )}

        {/* Conflict banner — external edit detected while editor has unsaved changes */}
        {activeFile && store.conflictedFiles[activeFile] && (
          <div style={{
            padding: "8px 12px",
            background: "#3a2a1a",
            borderBottom: `1px solid ${colors.border}`,
            fontSize: "10px", fontFamily: fonts.mono,
            display: "flex", alignItems: "center", gap: "8px",
            flexShrink: 0,
          }}>
            <span style={{ color: "#e8a84c" }}>⚠</span>
            <span style={{ color: colors.text, flex: 1 }}>
              File modified externally while you have unsaved changes
            </span>
            <button
              onClick={() => {
                if (!viewRef.current || !activeFile) return;
                // "Keep mine" — overwrite VFS with editor content
                const content = viewRef.current.state.doc.toString();
                trackedWrite(activeFile, content);
                ideStore.getState().resolveConflict(activeFile, "keep");
              }}
              style={{
                padding: "3px 8px", border: `1px solid ${colors.text}`,
                background: "transparent", color: colors.text,
                fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
              }}
            >
              Keep mine
            </button>
            <button
              onClick={() => {
                if (!viewRef.current || !activeFile) return;
                // "Accept theirs" — reload editor buffer from VFS
                const newContent = vfsRead(activeFile);
                if (newContent === null) return;
                viewRef.current.dispatch({
                  changes: { from: 0, to: viewRef.current.state.doc.length, insert: newContent },
                  annotations: [Transaction.addToHistory.of(false)],
                });
                lastSavedHashRef.current = getHash(activeFile) ?? null;
                ideStore.getState().setFileDirty(activeFile, false);
                ideStore.getState().resolveConflict(activeFile, "accept");
              }}
              style={{
                padding: "3px 8px", border: `1px solid ${colors.borderEmphasis ?? colors.border}`,
                background: "transparent", color: colors.textMuted,
                fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
              }}
            >
              Accept theirs
            </button>
          </div>
        )}

        {/* Unsaved changes confirmation dialog */}
        {pendingCloseFile && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: colors.bg, padding: "16px", maxWidth: "300px", width: "90%",
              border: `1px solid ${colors.border}`,
            }}>
              <div style={{ color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono, marginBottom: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>
                {t("editor.unsavedConfirm", locale)}
              </div>
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={handleSaveAndClose}
                  style={{
                    padding: "6px 10px", border: `1px solid ${colors.text}`,
                    background: "transparent", color: colors.text,
                    fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
                  }}
                >
                  {t("editor.saveAndClose", locale)}
                </button>
                <button
                  onClick={handleCloseAnyway}
                  style={{
                    padding: "6px 10px", border: `1px solid ${colors.border}`,
                    background: "transparent", color: colors.textMuted,
                    fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
                  }}
                >
                  {t("editor.closeAnyway", locale)}
                </button>
                <button
                  onClick={() => setPendingCloseFile(null)}
                  style={{
                    padding: "6px 10px", border: `1px solid ${colors.border}`,
                    background: "transparent", color: colors.textMuted,
                    fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
                  }}
                >
                  {t("editor.cancel", locale)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Status bar — outside containerRef to avoid layout conflict with CM6 100% height */}
      {activeFile && <EditorStatusBar locale={locale} />}
    </div>
  );
}

// ─── Tab Bar ────────────────────────────────────────────────
function TabBar({ tabs, activeFile, onSelect, onClose, onAdd, locale }: {
  tabs: IdeState["files"];
  activeFile: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string, e: MouseEvent) => void;
  onAdd: () => void;
  locale?: Locale;
}) {
  // Context menu + inline rename state (10.3)
  const [ctxPath, setCtxPath] = useState<string | null>(null);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxPath) return;
    const handler = () => { setCtxPath(null); setCtxPos(null); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [ctxPath]);

  function handleContextMenu(tabPath: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCtxPath(tabPath);
    setCtxPos({ x: e.clientX, y: e.clientY });
  }

  function startRename(path: string) {
    const tab = tabs.find((t) => t.path === path);
    const name = tab?.name ?? "";
    setRenamingPath(path);
    setRenameValue(name);
    setCtxPath(null);
    setCtxPos(null);
    // Auto-select the name part (without extension) for easier editing
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        `input[value="${name.replace(/"/g, "&quot;")}"]`
      );
      if (input) {
        const dotIdx = name.lastIndexOf(".");
        const selEnd = dotIdx > 0 ? dotIdx : name.length;
        input.setSelectionRange(0, selEnd);
      }
    }, 0);
  }

  function commitRename() {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const parts = renamingPath.split("/").filter(Boolean);
    const oldName = parts.pop()!;
    let newName = renameValue.trim();

    // Preserve original extension if the user didn't type one
    const dotIdx = oldName.lastIndexOf(".");
    if (dotIdx > 0 && !newName.includes(".")) {
      newName += oldName.slice(dotIdx);
    }

    const newPath = "/" + [...parts, newName].join("/");
    if (newPath !== renamingPath) {
      // Flush editor buffer before rename to prevent stale content
      document.dispatchEvent(new CustomEvent("editor:flush-before-rename", {
        detail: { path: renamingPath },
      }));
      // Update VFS entries before telling the store to update tab metadata
      trackedRename(renamingPath, newPath);
      ideStore.getState().renameFile(renamingPath, newPath);
    }
    setRenamingPath(null);
  }

  return (
    <div style={{
      display: "flex", alignItems: "center",
      borderBottom: `1px solid ${colors.border}`,
      background: colors.surface1,
      flexShrink: 0, overflowX: "auto", overflowY: "hidden",
      minHeight: "30px",
    }}>
      <div style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
        {tabs.map((tab) => {
          const isActive = tab.path === activeFile;
          const ext = getExt(tab.path);
          const isRenaming = renamingPath === tab.path;
          return (
            <div key={tab.path} onClick={() => onSelect(tab.path)}
              onContextMenu={(e: MouseEvent) => handleContextMenu(tab.path, e)}
              onDblClick={(e: MouseEvent) => { e.stopPropagation(); startRename(tab.path); }}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "4px 8px", fontSize: "10px", fontFamily: fonts.mono,
                color: isActive ? colors.text : colors.textMuted,
                background: isActive ? colors.bg : "transparent",
                borderRight: `1px solid ${colors.border}`,
                cursor: "pointer", userSelect: "none",
                whiteSpace: "nowrap", minWidth: 0,
              }}
            >
              <LangLabel ext={ext} />
              {isRenaming ? (
                <input value={renameValue}
                  onInput={(e: any) => setRenameValue(e.currentTarget.value)}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingPath(null);
                  }}
                  onBlur={commitRename}
                  autoFocus
                  onClick={(e: MouseEvent) => e.stopPropagation()}
                  style={{
                    background: colors.inputBg, border: `1px solid ${colors.borderEmphasis}`,
                    color: colors.text, fontSize: "10px", fontFamily: fonts.mono,
                    outline: "none", padding: "1px 2px", width: "80px",
                  }} />
              ) : (
                <span>{tab.name}</span>
              )}
              {tab.dirty && (
                <span title="unsaved changes" style={{
                  color: "#aaa", fontSize: "8px", lineHeight: 1,
                  marginLeft: "2px",
                }}>●</span>
              )}
              {tab.saveStatus === "saving" && (
                <span style={{ color: colors.textMuted, fontSize: "8px", marginLeft: "2px" }}>
                  {t("editor.saving")}
                </span>
              )}
              {tab.saveStatus === "saved" && (
                <span style={{ color: colors.statusDone, fontSize: "8px", marginLeft: "2px" }}>
                  {t("editor.saved")}
                </span>
              )}
              <span onClick={(e: MouseEvent) => onClose(tab.path, e)}
                title={t("editor.closeTabTooltip", locale)}
                style={{
                  color: colors.textMuted, fontSize: "12px",
                  padding: "2px 6px", cursor: "pointer", lineHeight: 1,
                  borderRadius: "2px",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = colors.surface2}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                ×
              </span>
            </div>
          );
        })}
      </div>

      {/* Context menu */}
      {ctxPath && ctxPos && (
        <div style={{
          position: "fixed", left: ctxPos.x, top: ctxPos.y,
          background: colors.surface2, border: `1px solid ${colors.borderEmphasis}`,
          zIndex: 1000, minWidth: "100px", padding: "2px 0",
          fontSize: "11px", fontFamily: fonts.mono,
        }}>
          <CtxMenuItem onClick={() => { startRename(ctxPath); }}>
            {t("editor.rename", locale) || "rename"}
          </CtxMenuItem>
          <CtxMenuItem onClick={() => {
            const path = ctxPath;
            setCtxPath(null); setCtxPos(null);
            onClose(path, new MouseEvent("click"));
          }}>
            {t("editor.closeTab", locale)}
          </CtxMenuItem>
          <CtxMenuItem onClick={() => {
            const path = ctxPath;
            setCtxPath(null); setCtxPos(null);
            const currentFiles = ideStore.getState().files;
            currentFiles.forEach((t) => {
              if (t.path !== path && !t.dirty) {
                onClose(t.path, new MouseEvent("click"));
              }
            });
          }}>
            {t("editor.closeOthers", locale)}
          </CtxMenuItem>
          <CtxMenuItem onClick={() => {
            navigator.clipboard.writeText(ctxPath).catch(() => {});
            setCtxPath(null); setCtxPos(null);
          }}>
            {t("editor.copyPath", locale)}
          </CtxMenuItem>
        </div>
      )}

      <button onClick={onAdd} title={t("editor.newFile", locale)}
        style={{
          background: "none", border: "none", color: colors.textMuted,
          padding: "4px 10px", fontSize: "14px", cursor: "pointer",
          lineHeight: 1, flexShrink: 0,
        }}>
        +
      </button>
    </div>
  );
}

// ─── Language label ──────────────────────────────────────────
function LangLabel({ ext }: { ext: string }) {
  const labels: Record<string, { text: string; color: string }> = {
    js:  { text: "JS", color: "#61afef" },
    jsx: { text: "RX", color: "#61afef" },
    ts:  { text: "TS", color: "#61afef" },
    tsx: { text: "TX", color: "#61afef" },
    json:{ text: "{}", color: "#c678dd" },
    html:{ text: "<>", color: "#e5c07b" },
    htm: { text: "<>", color: "#e5c07b" },
    css: { text: "#", color: "#98c379" },
    md:  { text: "MD", color: "#c678dd" },
  };
  const info = labels[ext] ?? { text: "TX", color: "#555" };
  return <span style={{ color: info.color, fontSize: "9px", fontWeight: "600" }}>{info.text}</span>;
}

// ─── Context menu item ──────────────────────────────────────
function CtxMenuItem({ onClick, children }: { onClick: () => void; children: preact.ComponentChildren }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "5px 12px",
        cursor: "pointer",
        color: hover ? colors.text : colors.textSecondary,
        background: hover ? colors.surface1 : "transparent",
        transition: "background 0.1s, color 0.1s",
      }}
    >
      {children}
    </div>
  );
}

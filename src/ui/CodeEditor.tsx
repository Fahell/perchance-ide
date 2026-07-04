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

import { useEffect, useRef, useState } from "preact/hooks";
import { getEmmetSyntax } from "../editor/emmet-langs.js";
import { getEmmetExtensions } from "../editor/emmet.js";
import { setCurrentView } from "../editor/view-store.js";
import { t, type Locale } from "../i18n/index.js";
import { ideStore, type IdeState } from "../store.js";
import { trackedWrite } from "../vfs-events.js";
import { scheduleVfsPersist, flushVfsPersist, cancelScheduledPersist } from "../vfs-persist.js";
import { vfsExists, vfsRead } from "../vfs.js";
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
  const saveStatusTimerRef = useRef<number | null>(null);
  const prevActiveRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Auto-clear save status after a delay (replaces orphan setTimeout calls)
  function scheduleSaveStatusClear(path: string, delay = 2000) {
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
      return;
    }

    if (!containerRef.current) return;

    // Save previous file content before switching
    if (prevActiveRef.current && viewRef.current) {
      if (vfsExists(prevActiveRef.current)) {
        const content = viewRef.current.state.doc.toString();
        trackedWrite(prevActiveRef.current, content);
        ideStore.getState().setFileDirty(prevActiveRef.current, false);
        scheduleVfsPersist();
      }
    }
    prevActiveRef.current = path;

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

    let cancelled = false;
    (async () => {
      const [{ createEditor }, { getLanguageSupport }] = await Promise.all([
        import("../editor/index.js"),
        import("../editor/langs.js"),
      ]);
      if (cancelled || !containerRef.current) return;

      // Lazy-load Emmet for eligible file types (11.5)
      const emmetSyntax = getEmmetSyntax(path);
      const emmetExts = emmetSyntax ? await getEmmetExtensions(emmetSyntax) : [];

      viewRef.current = createEditor({
        parent: containerRef.current,
        doc: content,
        language: getLanguageSupport(path),
        extraExtensions: emmetExts,
        fontSize,
        tabSize,
        wordWrap,
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
            ideStore.getState().setFileDirty(path, false);
            ideStore.getState().setFileSaveStatus(path, "saved");
            ideStore.getState().bumpVfsVersion();
            scheduleVfsPersist();
            scheduleSaveStatusClear(path);
          }, 500);
          ideStore.getState().setFileDirty(path, true);
        },
      });

      // Share view with OutlinePanel (10.1)
      setCurrentView(viewRef.current);
    })();

    return () => {
      cancelled = true;
      setCurrentView(null);
    };
  }, [activeFile, store.settingsVersion]);

  // ── Listen for flush-save event (from Ctrl+S shortcut) ─
  useEffect(() => {
    function handleFlushSave(e: Event) {
      const { path } = (e as CustomEvent).detail as { path: string };
      if (!viewRef.current) return;
      // Flush debounced write
      if (debounceRef.current) clearTimeout(debounceRef.current);
      trackedWrite(path, viewRef.current.state.doc.toString());
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

  // ── Listen for close-tab requests (from Ctrl+W) ────────
  useEffect(() => {
    function handleCloseTabRequest(e: Event) {
      const { path } = (e as CustomEvent).detail as { path: string };
      const tab = files.find((f) => f.path === path);
      if (!tab) return;
      if (tab.dirty) {
        if (!store.settings.autoSave) {
          setPendingCloseFile(path);
          return;
        }
        if (!confirm(t("editor.unsavedConfirm", locale))) return;
      }
      doCloseFile(path);
    }
    document.addEventListener("editor:request-close-tab", handleCloseTabRequest);
    return () => document.removeEventListener("editor:request-close-tab", handleCloseTabRequest);
  }, [files, store.settings.autoSave, locale, activeFile]);

  // ── Cleanup on unmount ──────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      setCurrentView(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      cancelScheduledPersist();
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      if (viewRef.current) {
        const currentFile = activeFile;
        if (currentFile) {
          trackedWrite(currentFile, viewRef.current.state.doc.toString());
        }
        viewRef.current.destroy();
        viewRef.current = null;
      }
      // Flush pending persist on unmount
      flushVfsPersist().catch((e) =>
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
    if (viewRef.current && path === activeFile) {
      trackedWrite(path, viewRef.current.state.doc.toString());
      scheduleVfsPersist();
    }
    ideStore.getState().closeFile(path);
    setPendingCloseFile(null);
  }

  function closeTab(path: string, e: MouseEvent) {
    e.stopPropagation();
    const tab = files.find((f) => f.path === path);
    if (tab?.dirty) {
      if (!store.settings.autoSave) {
        // Show custom confirmation dialog when auto-save is off
        setPendingCloseFile(path);
        return;
      }
      if (!confirm(t("editor.unsavedConfirm", locale))) return;
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
        {activeTab && !viewRef.current && (
          <div style={{
            padding: "12px", color: colors.textMuted,
            fontSize: "11px", fontFamily: fonts.mono,
          }}>
            {t("editor.loading", locale) || "loading editor..."}
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
    setRenamingPath(path);
    setRenameValue(tab?.name ?? "");
    setCtxPath(null);
    setCtxPos(null);
  }

  function commitRename() {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    const parts = renamingPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + [...parts, renameValue.trim()].join("/");
    if (newPath !== renamingPath) {
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
                <span style={{
                  color: colors.textMuted, fontSize: "10px",
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "#888", display: "inline-block",
                }} />
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
                style={{
                  color: colors.textMuted, fontSize: "10px",
                  padding: "0 2px", cursor: "pointer", lineHeight: 1,
                }}>
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
          zIndex: 1000, minWidth: "80px",
          fontSize: "11px", fontFamily: fonts.mono,
        }}>
          <div onClick={(e: MouseEvent) => { e.stopPropagation(); startRename(ctxPath); }}
            style={{
              padding: "4px 10px", cursor: "pointer",
              color: colors.textSecondary,
            }}>
            {t("editor.rename", locale) || "rename"}
          </div>
        </div>
      )}

      <button onClick={onAdd} title="New file"
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
  const labels: Record<string, string> = {
    js: "JS", jsx: "RX", ts: "TS", tsx: "TX",
    json: "{}", html: "<>", htm: "<>", css: "#", md: "MD",
  };
  return <span style={{ color: "#555", fontSize: "9px" }}>{labels[ext] ?? "TX"}</span>;
}

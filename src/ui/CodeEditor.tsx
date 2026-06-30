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
import { dbSaveVfs } from "../db.js";
import { t, type Locale } from "../i18n/index.js";
import { ideStore, type IdeState } from "../store.js";
import { vfsExists, vfsGetAll, vfsRead, vfsWrite } from "../vfs.js";
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
  const persistRef = useRef<number | null>(null);
  const prevActiveRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Persist VFS to IndexedDB (debounced, not on every keystroke)
  function schedulePersist() {
    if (persistRef.current) clearTimeout(persistRef.current);
    persistRef.current = window.setTimeout(() => {
      dbSaveVfs(vfsGetAll()).catch((e) =>
        console.warn("[CodeEditor] dbSaveVfs failed:", e)
      );
    }, 2000);
  }

  // ── Mount / remount editor when activeFile changes ─────
  useEffect(() => {
    const path = activeFile;
    if (!path || !containerRef.current) return;

    // Save previous file content before switching
    if (prevActiveRef.current && viewRef.current) {
      if (vfsExists(prevActiveRef.current)) {
        const content = viewRef.current.state.doc.toString();
        vfsWrite(prevActiveRef.current, content);
        ideStore.getState().setFileDirty(prevActiveRef.current, false);
        schedulePersist();
      }
    }
    prevActiveRef.current = path;

    // Destroy old editor
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // Read content from VFS
    const content = vfsRead(path) ?? "";

    let cancelled = false;
    (async () => {
      const [{ createEditor }, { getLanguageSupport }] = await Promise.all([
        import("../editor/index.js"),
        import("../editor/langs.js"),
      ]);
      if (cancelled || !containerRef.current) return;

      viewRef.current = createEditor({
        parent: containerRef.current,
        doc: content,
        language: getLanguageSupport(path),
        fontSize: 13,
        tabSize: 2,
        wordWrap: false,
        onChange: (doc) => {
          if (!mountedRef.current) return;
          // Debounce save to VFS
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(() => {
            if (!mountedRef.current) return;
            vfsWrite(path, doc);
            ideStore.getState().setFileDirty(path, false);
            schedulePersist();
          }, 500);
          ideStore.getState().setFileDirty(path, true);
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeFile]);

  // ── Cleanup on unmount ──────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (persistRef.current) clearTimeout(persistRef.current);
      if (viewRef.current) {
        const currentFile = activeFile;
        if (currentFile) {
          vfsWrite(currentFile, viewRef.current.state.doc.toString());
        }
        viewRef.current.destroy();
        viewRef.current = null;
      }
      // Flush pending persist on unmount
      dbSaveVfs(vfsGetAll()).catch((e) =>
        console.warn("[CodeEditor] final dbSaveVfs failed:", e)
      );
    };
  }, []);

  // ── Actions ─────────────────────────────────────────────
  function addTab() {
    const count = files.length + 1;
    const name = `untitled-${count}.js`;
    const path = "/" + name;
    if (!vfsExists(path)) {
      vfsWrite(path, "");
      schedulePersist();
    }
    ideStore.getState().openFile(path, name, "js");
  }

  function closeTab(path: string, e: MouseEvent) {
    e.stopPropagation();
    if (viewRef.current && path === activeFile) {
      vfsWrite(path, viewRef.current.state.doc.toString());
      schedulePersist();
    }
    ideStore.getState().closeFile(path);
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
      </div>
    </div>
  );
}

// ─── Tab Bar ────────────────────────────────────────────────
function TabBar({ tabs, activeFile, onSelect, onClose, onAdd }: {
  tabs: IdeState["files"];
  activeFile: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string, e: MouseEvent) => void;
  onAdd: () => void;
}) {
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
          return (
            <div key={tab.path} onClick={() => onSelect(tab.path)}
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
              <span>{tab.name}</span>
              {tab.dirty && (
                <span style={{
                  color: colors.textMuted, fontSize: "10px",
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "#888", display: "inline-block",
                }} />
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

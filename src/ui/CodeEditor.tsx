/**
 * CodeEditor — tabbed code editor powered by CodeMirror 6.
 *
 * Features:
 * - Multiple open tabs with filenames
 * - Syntax highlighting via CM6 language support
 * - New tab / close tab
 * - Lazy-loaded — CM6 bundle only imported when component mounts
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { colors, fonts } from "./theme.js";

// ─── Types ──────────────────────────────────────────────────
interface CodeEditorProps {
  locale?: Locale;
}

interface TabData {
  id: string;
  name: string;
  ext: string;
  dirty: boolean;
}

// ─── Tab utilities ─────────────────────────────────────────
let tabCounter = 0;
function nextId(): string {
  return `tab-${++tabCounter}`;
}

const DEFAULT_EXT = "js";

function createDefaultTab(): TabData {
  return {
    id: nextId(),
    name: `untitled-1.${DEFAULT_EXT}`,
    ext: DEFAULT_EXT,
    dirty: false,
  };
}

// ─── Component ──────────────────────────────────────────────
export function CodeEditor({ locale }: CodeEditorProps) {
  const [tabs, setTabs] = useState<TabData[]>(() => [createDefaultTab()]);
  const [activeId, setActiveId] = useState<string>(tabs[0]!.id);
  const contentsRef = useRef<Map<string, string>>(new Map());
  const viewRef = useRef<import("codemirror").EditorView | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const prevActiveRef = useRef<string>(activeId);

  function saveCurrentContent() {
    if (viewRef.current && prevActiveRef.current) {
      contentsRef.current.set(
        prevActiveRef.current,
        viewRef.current.state.doc.toString()
      );
    }
  }

  const mountEditor = useCallback(async (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !containerRef.current) return;
    if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null; }

    const [{ createEditor }, { getLanguageSupport }] = await Promise.all([
      import("../editor/index.js"),
      import("../editor/langs.js"),
    ]);

    const content = contentsRef.current.get(tabId) ?? "";
    viewRef.current = createEditor({
      parent: containerRef.current,
      doc: content,
      language: getLanguageSupport(tab.name),
      fontSize: 13,
      tabSize: 2,
      wordWrap: false,
    });
    setEditorReady(true);
  }, [tabs]);

  useEffect(() => {
    saveCurrentContent();
    prevActiveRef.current = activeId;
    mountEditor(activeId);
  }, [activeId, mountEditor]);

  useEffect(() => {
    return () => {
      if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null; }
    };
  }, []);

  function addTab() {
    const count = tabs.length + 1;
    const newTab: TabData = {
      id: nextId(),
      name: `untitled-${count}.${DEFAULT_EXT}`,
      ext: DEFAULT_EXT,
      dirty: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveId(newTab.id);
  }

  function closeTab(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    saveCurrentContent();
    const idx = tabs.findIndex((t) => t.id === id);
    setTabs((prev) => prev.filter((t) => t.id !== id));
    if (id === activeId) {
      const remaining = tabs.filter((t) => t.id !== id);
      const nextIdx = Math.min(idx, remaining.length - 1);
      setActiveId(remaining[nextIdx]!.id);
    }
  }

  function selectTab(id: string) {
    if (id === activeId) return;
    saveCurrentContent();
    setActiveId(id);
  }

  const activeTab = tabs.find((t) => t.id === activeId);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: colors.bg, borderLeft: `1px solid ${colors.border}`,
    }}>
      <TabBar tabs={tabs} activeId={activeId}
        onSelect={selectTab} onClose={closeTab} onAdd={addTab} />
      <div ref={containerRef} style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {!editorReady && activeTab && (
          <div style={{ padding: "12px", color: colors.textMuted, fontSize: "11px", fontFamily: fonts.mono }}>
            {t("editor.loading", locale) || "loading editor..."}
          </div>
        )}
        {!activeTab && (
          <div style={{ padding: "12px", color: colors.textMuted, fontSize: "11px", fontFamily: fonts.mono }}>
            {t("editor.noFiles", locale) || "no files open"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Bar ────────────────────────────────────────────────
function TabBar({ tabs, activeId, onSelect, onClose, onAdd }: {
  tabs: TabData[]; activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string, e: MouseEvent) => void;
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
          const isActive = tab.id === activeId;
          return (
            <div key={tab.id} onClick={() => onSelect(tab.id)}
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
              <LangLabel ext={tab.ext} />
              <span>{tab.name}</span>
              <span onClick={(e: MouseEvent) => onClose(tab.id, e)}
                style={{ color: colors.textMuted, fontSize: "10px", padding: "0 2px", cursor: "pointer", lineHeight: 1 }}>
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

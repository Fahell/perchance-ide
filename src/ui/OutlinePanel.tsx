/**
 * OutlinePanel — file symbol tree extracted from the active editor's
 * Lezer syntax tree.
 *
 * Displays functions, classes, variables, and other declarations
 * grouped by type. Click a symbol to jump to its location.
 */

import { useEffect, useState } from "preact/hooks";
import { extractSymbols, type OutlineSymbol } from "../editor/outline.js";
import { getCurrentView } from "../editor/view-store.js";
import { t, type Locale } from "../i18n/index.js";
import { ideStore, type IdeState } from "../store.js";
import { colors, fonts } from "./theme.js";

// ─── Props ──────────────────────────────────────────────────
interface OutlinePanelProps {
  locale?: Locale;
}

// ─── Type icon/color map ────────────────────────────────────
const TYPE_META: Record<string, { icon: string; color: string }> = {
  function:  { icon: "ƒ", color: "#888888" },
  class:     { icon: "C", color: "#aaaaaa" },
  variable:  { icon: "v", color: "#666666" },
  interface: { icon: "I", color: "#999999" },
  type:      { icon: "T", color: "#999999" },
  enum:      { icon: "E", color: "#999999" },
  method:    { icon: "m", color: "#777777" },
  rule:      { icon: "#", color: "#e06c9e" },
  keyframes: { icon: "@", color: "#e06c9e" },
  atRule:    { icon: "@", color: "#c97e3e" },
  element:   { icon: "<>", color: "#c97e3e" },
  property:  { icon: "p", color: "#666666" },
};

// ─── Component ──────────────────────────────────────────────
export function OutlinePanel({ locale }: OutlinePanelProps) {
  const [store, setStore] = useState<IdeState>(ideStore.getState());
  useEffect(() => ideStore.subscribe((s) => setStore(s)), []);

  const [symbols, setSymbols] = useState<OutlineSymbol[]>([]);
  const { activeFile } = store;

  // Re-extract symbols when active file or editor content changes
  useEffect(() => {
    const view = getCurrentView();
    if (!view || !activeFile) {
      setSymbols([]);
      return;
    }

    // Debounced extraction on content change
    let timer: number | null = null;
    const unsubscribe = ideStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => {
        const v = getCurrentView();
        if (v) setSymbols(extractSymbols(v));
      }, 400);
    });

    // Initial extraction
    setSymbols(extractSymbols(view));

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [activeFile]);

  // ── Navigate to symbol ──────────────────────────────────
  function goToSymbol(sym: OutlineSymbol) {
    const view = getCurrentView();
    if (!view) return;
    view.dispatch({
      selection: { anchor: sym.from },
      scrollIntoView: true,
    });
    view.focus();
  }

  // ── Render ──────────────────────────────────────────────
  if (!activeFile) {
    return (
      <div style={{ padding: "12px 8px", color: colors.textMuted, fontSize: "10px", fontStyle: "italic" }}>
        {t("outline.noEditor", locale)}
      </div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div style={{ padding: "12px 8px", color: colors.textMuted, fontSize: "10px", fontStyle: "italic" }}>
        {t("outline.noSymbols", locale)}
      </div>
    );
  }

  // Group symbols by type
  const groups: { label: string; symbols: OutlineSymbol[] }[] = [];
  const typeOrder = ["function", "class", "interface", "type", "enum", "method", "variable", "rule", "keyframes", "atRule", "element", "property"];
  const typeLabels: Record<string, string> = {
    function: "Functions", class: "Classes", interface: "Interfaces",
    type: "Type Aliases", enum: "Enums", method: "Methods",
    variable: "Variables", rule: "Rules", keyframes: "Keyframes",
    atRule: "At-Rules", element: "Elements", property: "Properties",
  };
  const grouped = new Map<string, OutlineSymbol[]>();
  for (const sym of symbols) {
    const arr = grouped.get(sym.type) ?? [];
    arr.push(sym);
    grouped.set(sym.type, arr);
  }
  for (const t of typeOrder) {
    const syms = grouped.get(t);
    if (syms && syms.length > 0) {
      groups.push({ label: typeLabels[t] ?? t, symbols: syms });
    }
  }

  return (
    <div style={{ padding: "4px 0", fontSize: "10px", fontFamily: fonts.mono }}>
      {groups.map((group) => (
        <div key={group.label}>
          <div style={{
            padding: "4px 8px", fontSize: "8px", textTransform: "uppercase",
            letterSpacing: "0.5px", color: colors.textMuted,
          }}>
            {group.label}
          </div>
          {group.symbols.map((sym) => {
            const meta = TYPE_META[sym.type] ?? { icon: "?", color: colors.textMuted };
            return (
              <div key={`${sym.from}-${sym.name}`}
                onClick={() => goToSymbol(sym)}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "2px 8px 2px 16px", cursor: "pointer",
                  color: colors.text, whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surface1; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ width: "12px", textAlign: "center", flexShrink: 0, color: meta.color }}>
                  {meta.icon}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{sym.name}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * OutlinePanel — file symbol tree extracted from the active editor's
 * Lezer syntax tree.
 *
 * Displays functions, classes, variables, and other declarations
 * grouped by type. Click a symbol to jump to its location.
 *
 * Features:
 * - Search/filter symbols (shown when 10+ symbols)
 * - Sort toggle (by position / alphabetical)
 * - Grouped by type with distinct colors
 * - Hover state managed via Preact state (no DOM manipulation)
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

// ─── Type icon/color map — more distinguishable colors ──────
const TYPE_META: Record<string, { icon: string; color: string }> = {
  function:  { icon: "ƒ", color: "#e06c9e" },
  class:     { icon: "C", color: "#c97e3e" },
  variable:  { icon: "v", color: "#6b9fff" },
  interface: { icon: "I", color: "#56b6c2" },
  type:      { icon: "T", color: "#56b6c2" },
  enum:      { icon: "E", color: "#d19a66" },
  method:    { icon: "m", color: "#6b9fff" },
  rule:      { icon: "#", color: "#e06c9e" },
  keyframes: { icon: "@", color: "#d19a66" },
  atRule:    { icon: "@", color: "#c97e3e" },
  element:   { icon: "<>", color: "#c97e3e" },
  property:  { icon: "p", color: "#56b6c2" },
};

// ─── Type labels for grouping ──────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  function: "Functions", class: "Classes", interface: "Interfaces",
  type: "Type Aliases", enum: "Enums", method: "Methods",
  variable: "Variables", rule: "Rules", keyframes: "Keyframes",
  atRule: "At-Rules", element: "Elements", property: "Properties",
};

const TYPE_ORDER = [
  "function", "class", "interface", "type", "enum", "method",
  "variable", "rule", "keyframes", "atRule", "element", "property",
];

// ─── Component ──────────────────────────────────────────────
export function OutlinePanel({ locale }: OutlinePanelProps) {
  const [store, setStore] = useState<IdeState>(ideStore.getState());
  useEffect(() => ideStore.subscribe((s) => setStore(s)), []);

  const [symbols, setSymbols] = useState<OutlineSymbol[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAlpha, setSortAlpha] = useState(false);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  const { activeFile } = store;

  // Re-extract symbols when active file or editor content changes
  useEffect(() => {
    const view = getCurrentView();
    if (!view || !activeFile) {
      setSymbols([]);
      return;
    }

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

  // ── Filter and sort symbols ─────────────────────────────
  let filtered = symbols;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = symbols.filter((s) => s.name.toLowerCase().includes(q));
  }

  // Group symbols by type
  const groups: { label: string; symbols: OutlineSymbol[] }[] = [];
  const grouped = new Map<string, OutlineSymbol[]>();
  for (const sym of filtered) {
    const arr = grouped.get(sym.type) ?? [];
    arr.push(sym);
    grouped.set(sym.type, arr);
  }
  for (const type of TYPE_ORDER) {
    const syms = grouped.get(type);
    if (syms && syms.length > 0) {
      const sorted = sortAlpha ? [...syms].sort((a, b) => a.name.localeCompare(b.name)) : syms;
      groups.push({ label: TYPE_LABELS[type] ?? type, symbols: sorted });
    }
  }

  // ── Render ──────────────────────────────────────────────
  if (!activeFile) {
    return (
      <div style={{ padding: "12px 8px", color: colors.textMuted, fontSize: "10px", fontStyle: "italic" }}>
        {t("outline.noEditor", locale)}
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0", fontSize: "10px", fontFamily: fonts.mono }}>
      {/* Search input — shown when 10+ symbols */}
      {symbols.length >= 10 && (
        <div style={{
          display: "flex", alignItems: "center", gap: "4px",
          padding: "4px 8px", borderBottom: `1px solid ${colors.border}`,
        }}>
          <input
            value={searchQuery}
            onInput={(e: any) => setSearchQuery(e.currentTarget.value)}
            placeholder={t("fileSearch.placeholder", locale) || "filter symbols..."}
            style={{
              flex: 1,
              background: colors.inputBg, border: `1px solid ${colors.border}`,
              color: colors.text, fontSize: "10px", fontFamily: fonts.mono,
              outline: "none", padding: "2px 6px",
            }}
          />
          {/* Sort toggle */}
          {filtered.length > 1 && (
            <button
              onClick={() => setSortAlpha(!sortAlpha)}
              title={sortAlpha ? "Sort by position" : "Sort alphabetically"}
              style={{
                background: "none", border: `1px solid ${colors.border}`,
                color: sortAlpha ? colors.text : colors.textMuted,
                fontSize: "9px", padding: "2px 4px", cursor: "pointer",
                fontFamily: fonts.mono,
              }}
            >
              {sortAlpha ? "A–Z" : "by pos"}
            </button>
          )}
        </div>
      )}

      {/* No symbols */}
      {symbols.length === 0 && (
        <div style={{ padding: "12px 8px", color: colors.textMuted, fontSize: "10px", fontStyle: "italic" }}>
          {t("outline.noSymbols", locale)}
        </div>
      )}

      {/* No results for search */}
      {symbols.length > 0 && filtered.length === 0 && (
        <div style={{ padding: "12px 8px", color: colors.textMuted, fontSize: "10px", fontStyle: "italic" }}>
          {t("fileSearch.noResults", locale) || "no results"}
        </div>
      )}

      {/* Groups */}
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
            const symKey = `${sym.from}-${sym.name}`;
            const isHovered = hoveredSymbol === symKey;
            return (
              <div key={symKey}
                onClick={() => goToSymbol(sym)}
                onMouseEnter={() => setHoveredSymbol(symKey)}
                onMouseLeave={() => setHoveredSymbol(null)}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "2px 8px 2px 16px", cursor: "pointer",
                  color: colors.text, whiteSpace: "nowrap",
                  background: isHovered ? colors.surface1 : "transparent",
                  transition: "background 0.1s",
                }}
              >
                <span style={{ width: "12px", textAlign: "center", flexShrink: 0, color: meta.color, fontWeight: "bold" }}>
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

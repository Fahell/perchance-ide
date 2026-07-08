/**
 * BreadcrumbsBar — shows file path + symbol hierarchy for cursor position.
 *
 * Renders above the editor content (below the tab bar) like VS Code's
 * breadcrumb navigation. Each segment is clickable to navigate.
 */

import { BREADCRUMB_COLORS, type Breadcrumb } from "../editor/breadcrumbs.js";
import { getCurrentView } from "../editor/view-store.js";
import { colors, fonts } from "./theme.js";

// ─── Props ──────────────────────────────────────────────────
interface BreadcrumbsBarProps {
  /** Active file path (e.g. "/src/ui/Header.tsx") */
  path: string;
  /** Symbol hierarchy at cursor position */
  symbols: Breadcrumb[];
}

// ─── Component ──────────────────────────────────────────────
export function BreadcrumbsBar({ path, symbols }: BreadcrumbsBarProps) {
  // Split file path into segments
  const parts = path.split("/").filter(Boolean);

  function handleGoTo(from: number) {
    const view = getCurrentView();
    if (!view) return;
    view.dispatch({
      selection: { anchor: from },
      scrollIntoView: true,
    });
    view.focus();
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "22px",
        padding: "0 8px",
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface1,
        fontSize: "10px",
        fontFamily: fonts.mono,
        overflowX: "auto",
        overflowY: "hidden",
        whiteSpace: "nowrap",
        flexShrink: 0,
        userSelect: "none",
        gap: "0",
      }}
    >
      {/* ── File path segments ── */}
      {parts.map((part, i) => (
        <span key={`file-${i}`}
          style={{
            color: i === parts.length - 1 ? colors.text : colors.textMuted,
            cursor: "default",
            padding: "0 2px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>{part}</span>
          {i < parts.length - 1 && (
            <span style={{ color: colors.border, fontSize: "8px", lineHeight: 1 }}>
              ▸
            </span>
          )}
        </span>
      ))}

      {/* ── Separator between file path and symbols ── */}
      {parts.length > 0 && symbols.length > 0 && (
        <span style={{
          color: colors.border,
          margin: "0 6px",
          opacity: 0.5,
          fontSize: "10px",
        }}>
          |
        </span>
      )}

      {/* ── Symbol hierarchy ── */}
      {symbols.map((sym, i) => (
        <span key={`sym-${i}`}
          onClick={() => handleGoTo(sym.from)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = colors.surface2;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
          style={{
            color: BREADCRUMB_COLORS[sym.type] ?? colors.text,
            cursor: "pointer",
            padding: "0 2px",
            borderRadius: "2px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            transition: "background 0.1s",
          }}
        >
          {i > 0 && (
            <span style={{ color: colors.border, fontSize: "8px", lineHeight: 1 }}>
              ▸
            </span>
          )}
          <span>{sym.name}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * RightPanel — container with tabbed panels (Files, Outline, Preview, Output).
 *
 * Uses a vertical icon sidebar on the right instead of horizontal tabs,
 * saving vertical space and allowing more tabs in the future.
 *
 * The File Explorer tab has been extracted to its own FileExplorer component
 * with full keyboard navigation, confirm modal, and memoized tree.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { ideStore, type IdeState } from "../store.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { FileExplorer } from "./FileExplorer.js";
import { OutlinePanel } from "./OutlinePanel.js";
import { OutputPanel } from "./OutputPanel.js";
import { PreviewPanel } from "./PreviewPanel.js";
import { colors, fonts } from "./theme.js";

// ─── Tab Definitions ────────────────────────────────────────
const TABS = [
  { id: "files" as const,   icon: "📁", labelKey: "fileExplorer.title", defaultLabel: "files" },
  { id: "outline" as const, icon: "◎",  labelKey: "outline.title",      defaultLabel: "outline" },
  { id: "preview" as const, icon: "▶",  labelKey: "preview.title",      defaultLabel: "preview" },
  { id: "output" as const,  icon: ">_", labelKey: "output.title",       defaultLabel: "output" },
];

// ─── Types ──────────────────────────────────────────────────
interface RightPanelProps {
  locale?: Locale;
}

// ─── Component ──────────────────────────────────────────────
export function RightPanel({ locale }: RightPanelProps) {
  const [store, setStore] = useState<IdeState>(ideStore.getState());
  useEffect(() => {
    return ideStore.subscribe((s) => setStore(s));
  }, []);

  const activeTab = store.rightPanelTab;
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  function handleTabClick(tabId: string) {
    store.setRightPanelTab(tabId as any);
  }

  function handleKeyDown(e: KeyboardEvent, tabIdx: number) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      store.setRightPanelTab(TABS[tabIdx].id);
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? -1 : 1;
      const nextIdx = (tabIdx + dir + TABS.length) % TABS.length;
      store.setRightPanelTab(TABS[nextIdx].id);
      // Focus the next tab button
      const buttons = sidebarRef.current?.querySelectorAll('[role="tab"]');
      (buttons?.[nextIdx] as HTMLElement)?.focus();
    }
  }

  const SIDEBAR_W = 32;

  return (
    <div style={{
      display: "flex", height: "100%",
      background: colors.bg, borderLeft: `1px solid ${colors.border}`,
      fontFamily: fonts.mono, fontSize: "11px",
      color: colors.textSecondary, userSelect: "none",
    }}>
      {/* ── Panel Content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {activeTab === "files" ? (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <ErrorBoundary name="FileExplorer">
              <FileExplorer locale={locale} />
            </ErrorBoundary>
          </div>
        ) : activeTab === "outline" ? (
          <div style={{ height: "100%", overflow: "auto" }}>
            <ErrorBoundary name="OutlinePanel">
              <OutlinePanel locale={locale} />
            </ErrorBoundary>
          </div>
        ) : activeTab === "preview" ? (
          <div style={{ height: "100%", overflow: "auto" }}>
            <ErrorBoundary name="PreviewPanel">
              <PreviewPanel locale={locale} />
            </ErrorBoundary>
          </div>
        ) : (
          <div style={{ height: "100%", overflow: "auto" }}>
            <ErrorBoundary name="OutputPanel">
              <OutputPanel locale={locale} />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* ── Vertical Icon Sidebar (right side) ── */}
      <div ref={sidebarRef}
        role="tablist"
        aria-label="Panels"
        style={{
          width: `${SIDEBAR_W}px`,
          minWidth: `${SIDEBAR_W}px`,
          display: "flex",
          flexDirection: "column",
          borderLeft: `1px solid ${colors.border}`,
          background: colors.surface1,
          padding: "4px 0",
          flexShrink: 0,
        }}>
        {TABS.map((tab, tabIdx) => {
          const isActive = activeTab === tab.id;
          const isHovered = hoveredTab === tab.id;
          const label = t(tab.labelKey as any, locale) || tab.defaultLabel;
          return (
            <div key={tab.id} style={{ position: "relative" }}>
              <div
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleTabClick(tab.id)}
                onKeyDown={(e: KeyboardEvent) => handleKeyDown(e, tabIdx)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                title={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  margin: "2px auto",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontFamily: fonts.mono,
                  color: isActive ? colors.text : colors.textMuted,
                  background: isActive ? colors.surface2 : "transparent",
                  border: "none",
                  borderRadius: "4px",
                  transition: "background 0.12s, color 0.12s",
                  outline: "none",
                }}
                onFocus={(e) => { if (!isActive) e.currentTarget.style.background = colors.surface2; }}
                onBlur={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {tab.icon}
              </div>
              {/* Active indicator line (right side) */}
              {isActive && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: "6px",
                  width: "2px",
                  height: "20px",
                  background: colors.text,
                  borderRadius: "1px 0 0 1px",
                }} />
              )}
              {/* Tooltip on hover (left side of sidebar) */}
              {isHovered && !isActive && (
                <div style={{
                  position: "absolute",
                  right: "34px",
                  top: "4px",
                  zIndex: 100,
                  background: colors.surface2,
                  border: `1px solid ${colors.borderEmphasis}`,
                  padding: "2px 8px",
                  fontSize: "9px",
                  fontFamily: fonts.mono,
                  color: colors.textSecondary,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}>
                  {label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

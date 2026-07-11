/**
 * RightPanel — container with tabbed panels (Files, Outline, Preview, Output).
 *
 * The File Explorer tab has been extracted to its own FileExplorer component
 * with full keyboard navigation, confirm modal, and memoized tree.
 */

import { useEffect, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { ideStore, type IdeState } from "../store.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { FileExplorer } from "./FileExplorer.js";
import { OutlinePanel } from "./OutlinePanel.js";
import { OutputPanel } from "./OutputPanel.js";
import { PreviewPanel } from "./PreviewPanel.js";
import { colors, fonts } from "./theme.js";

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

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: colors.bg, borderLeft: `1px solid ${colors.border}`,
      fontFamily: fonts.mono, fontSize: "11px",
      color: colors.textSecondary, userSelect: "none",
    }}>
      {/* Tab bar: Files | Outline | Preview | Output */}
      <div role="tablist" aria-label="Panels" style={{
        display: "flex", borderBottom: `1px solid ${colors.border}`,
        flexShrink: 0,
      }}>
        {(["files", "outline", "preview", "output"] as const).map((tab, tabIdx) => {
          const label = tab === "files"
            ? (t("fileExplorer.title", locale) || "files")
            : tab === "outline"
              ? (t("outline.title", locale) || "outline")
              : tab === "preview"
                ? (t("preview.title", locale) || "preview")
                : (t("output.title", locale) || "output");
          return (
            <div key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => store.setRightPanelTab(tab)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault(); store.setRightPanelTab(tab);
                }
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const tabs = ["files", "outline", "preview", "output"] as const;
                  const dir = e.key === "ArrowLeft" ? -1 : 1;
                  const nextIdx = (tabIdx + dir + tabs.length) % tabs.length;
                  store.setRightPanelTab(tabs[nextIdx]);
                }
              }}
              style={{
                padding: "6px 10px", fontSize: "9px", textTransform: "uppercase",
                letterSpacing: "0.5px", cursor: "pointer", userSelect: "none",
                color: activeTab === tab ? colors.text : colors.textMuted,
                background: activeTab === tab ? colors.bg : "transparent",
                borderBottom: activeTab === tab ? `1px solid ${colors.text}` : "1px solid transparent",
                marginBottom: "-1px",
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = colors.textHighlight; }}
              onMouseLeave={(e) => { if (activeTab !== tab) (e.currentTarget as HTMLElement).style.color = colors.textMuted; }}>
              {label}
            </div>
          );
        })}
      </div>

      {activeTab === "files" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <ErrorBoundary name="FileExplorer">
            <FileExplorer locale={locale} />
          </ErrorBoundary>
        </div>
      ) : activeTab === "outline" ? (
        <div style={{ flex: 1, overflow: "auto" }}>
          <ErrorBoundary name="OutlinePanel">
            <OutlinePanel locale={locale} />
          </ErrorBoundary>
        </div>
      ) : activeTab === "preview" ? (
        <div style={{ flex: 1, overflow: "auto" }}>
          <ErrorBoundary name="PreviewPanel">
            <PreviewPanel locale={locale} />
          </ErrorBoundary>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto" }}>
          <ErrorBoundary name="OutputPanel">
            <OutputPanel locale={locale} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

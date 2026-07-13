/**
 * EditorStatusBar — shows cursor position, language, and file info
 * at the bottom of the code editor panel.
 */

import { useState, useEffect } from "preact/hooks";
import { getLanguageLabel } from "../editor/langs.js";
import { t, type Locale } from "../i18n/index.js";
import { colors, fonts } from "./theme.js";

// ─── Types ──────────────────────────────────────────────────
export interface StatusBarInfo {
  line: number;
  column: number;
  totalLines: number;
  selectionLength: number;
}

// ─── Custom event name ──────────────────────────────────────
export const STATUS_BAR_EVENT = "editor:status-bar";

interface StatusBarEventDetail {
  info: StatusBarInfo;
  filename: string;
}

// ─── Helper to dispatch status updates ──────────────────────
export function dispatchStatusUpdate(info: StatusBarInfo, filename: string): void {
  window.dispatchEvent(
    new CustomEvent<StatusBarEventDetail>(STATUS_BAR_EVENT, {
      detail: { info, filename },
    })
  );
}

// ─── Component ──────────────────────────────────────────────
export function EditorStatusBar({ locale }: { locale?: Locale }) {
  const [info, setInfo] = useState<StatusBarInfo>({
    line: 1,
    column: 1,
    totalLines: 1,
    selectionLength: 0,
  });
  const [language, setLanguage] = useState("Text");

  useEffect(() => {
    function handler(e: Event) {
      const { info: newInfo, filename } = (e as CustomEvent<StatusBarEventDetail>).detail;
      setInfo(newInfo);
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      setLanguage(getLanguageLabel(ext));
    }
    window.addEventListener(STATUS_BAR_EVENT, handler);
    return () => window.removeEventListener(STATUS_BAR_EVENT, handler);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "22px",
        padding: "2px 12px",
        borderTop: `1px solid ${colors.border}`,
        background: colors.surface1,
        fontSize: "10px",
        fontFamily: fonts.mono,
        color: colors.textMuted,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {/* Left side: language */}
      <span>{language}</span>

      {/* Right side: cursor position and selection info */}
      <div style={{ display: "flex", gap: "12px" }}>
        {info.selectionLength > 0 && (
          <span>
            {t("editorStatusBar.sel", locale)} {info.selectionLength}
          </span>
        )}
        <span>
          {t("editorStatusBar.ln", locale)} {info.line}, {t("editorStatusBar.col", locale)} {info.column}
        </span>
      </div>
    </div>
  );
}

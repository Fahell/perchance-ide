/**
 * CodeEditor — simple text/code editor for the middle panel.
 * Styled as a monospace textarea with a dark theme.
 */

import { h } from "preact";
import { useState } from "preact/hooks";
import { colors, fonts } from "./theme.js";
import { t, type Locale } from "../i18n/index.js";

interface CodeEditorProps {
  locale?: Locale;
  onSendToAgent?: (text: string) => void;
}

export function CodeEditor({ locale, onSendToAgent }: CodeEditorProps) {
  const [code, setCode] = useState("");

  function handleSend() {
    const trimmed = code.trim();
    if (!trimmed || !onSendToAgent) return;
    onSendToAgent(trimmed);
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: colors.bg,
      borderLeft: `1px solid ${colors.border}`,
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 8px",
        borderBottom: `1px solid ${colors.border}`,
        flexShrink: "0",
      }}>
        <span style={{ fontSize: "10px", color: colors.textMuted, fontFamily: fonts.mono }}>
          {t("editor.title", locale) || "editor"}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={() => setCode("")}
            style={{
              background: "none",
              border: `1px solid ${colors.border}`,
              color: colors.textMuted,
              padding: "2px 6px",
              fontSize: "9px",
              fontFamily: fonts.mono,
              cursor: "pointer",
              borderRadius: "2px",
            }}
          >
            {t("editor.clear", locale) || "clear"}
          </button>
          <button
            onClick={handleSend}
            disabled={!code.trim()}
            style={{
              background: code.trim() ? "#fff" : colors.border,
              border: "none",
              color: code.trim() ? "#000" : colors.textMuted,
              padding: "2px 6px",
              fontSize: "9px",
              fontFamily: fonts.mono,
              cursor: code.trim() ? "pointer" : "default",
              borderRadius: "2px",
            }}
          >
            {t("editor.send", locale) || "send →"}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <textarea
        value={code}
        onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)}
        placeholder={t("editor.placeholder", locale) || "// write code or text here..."}
        spellcheck={false}
        style={{
          flex: "1",
          background: "transparent",
          color: colors.text,
          border: "none",
          outline: "none",
          resize: "none",
          padding: "8px",
          fontFamily: fonts.mono,
          fontSize: "12px",
          lineHeight: "1.5",
          tabSize: "2",
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
        }}
      />
    </div>
  );
}

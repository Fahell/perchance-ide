import { useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { colors, fonts } from "./theme.js";

interface FooterProps {
  onSettings: () => void;
  onContext: () => void;
  onClear?: () => void;
  inputEnabled: boolean;
  onSend: (text: string) => void;
  disabled: boolean;
  onCancel?: () => void;
  locale?: Locale;
  terminalOpen?: boolean;
  onToggleTerminal?: () => void;
}

export function Footer({ onSettings, onContext, onClear, inputEnabled, onSend, disabled, onCancel, locale, terminalOpen, onToggleTerminal }: FooterProps) {
  const placeholder = t("footer.waiting", locale);
  const [text, setText] = useState("");

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${colors.border}`, flexShrink: "0" }}>
      {inputEnabled && !disabled && (
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 8px",
          gap: "6px",
        }}>
          <input
            type="text"
            value={text}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            placeholder="> _"
            style={{
              flex: "1",
              padding: "5px 8px",
              border: `1px solid ${colors.border}`,
              background: colors.surface2,
              color: colors.text,
              fontSize: "11px",
              fontFamily: fonts.mono,
              outline: "none",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            style={{
              padding: "5px 8px",
              border: `1px solid ${text.trim() ? colors.text : colors.border}`,
              background: "none",
              color: text.trim() ? colors.text : colors.textMuted,
              fontSize: "11px",
              fontFamily: fonts.mono,
              cursor: text.trim() ? "pointer" : "default",
              flexShrink: "0",
            }}
          >
            {">"}
          </button>
        </div>
      )}

      {/* Cancel button shown during processing */}
      {inputEnabled && disabled && onCancel && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4px 8px",
          gap: "6px",
        }}>
          <span style={{
            fontSize: "10px",
            color: colors.textMuted,
            fontFamily: fonts.mono,
          }}>
            Processing...
          </span>
          <button
            onClick={onCancel}
            style={{
              padding: "5px 8px",
              border: `1px solid ${colors.textSecondary}`,
              background: "none",
              color: colors.textSecondary,
              fontSize: "11px",
              fontFamily: fonts.mono,
              cursor: "pointer",
              flexShrink: "0",
            }}
          >
            [Cancel]
          </button>
        </div>
      )}

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onToggleTerminal && (
            <button
              onClick={onToggleTerminal}
              style={{
                color: terminalOpen ? colors.text : colors.textSecondary,
                cursor: "pointer",
                fontSize: "11px",
                fontFamily: fonts.mono,
                padding: "2px 4px",
                background: "none",
                border: "none",
                display: "inline",
              }}
            >
              [term]{terminalOpen ? "▼" : "▲"}
            </button>
          )}
          {onClear && (
            <button
              onClick={onClear}
              style={{ color: colors.textSecondary, cursor: "pointer", fontSize: "11px", fontFamily: fonts.mono, padding: "2px 4px", background: "none", border: "none", display: "inline" }}
            >
              [clear]
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={onSettings}
            style={{
              background: "none",
              border: "none",
              color: colors.textSecondary,
              fontSize: "11px",
              padding: "2px 6px",
              cursor: "pointer",
              fontFamily: fonts.mono,
            }}
          >
            [=]
          </button>
          <span style={{ color: colors.border, margin: "0 4px" }}>/</span>
          <button
            onClick={onContext}
            style={{
              background: "none",
              border: "none",
              color: colors.textSecondary,
              fontSize: "11px",
              padding: "2px 6px",
              cursor: "pointer",
              fontFamily: fonts.mono,
            }}
          >
            [ctx]
          </button>
        </div>
      </div>
    </div>
  );
}

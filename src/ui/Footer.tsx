import { h } from "preact";
import { useState } from "preact/hooks";
import { colors, fonts } from "./theme.js";

interface FooterProps {
  onSettings: () => void;
  inputEnabled: boolean;
  onSend: (text: string) => void;
  disabled: boolean;
}

export function Footer({ onSettings, inputEnabled, onSend, disabled }: FooterProps) {
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
      {inputEnabled && (
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
            placeholder={disabled ? "waiting..." : "> _"}
            disabled={disabled}
            style={{
              flex: "1",
              padding: "5px 8px",
              border: `1px solid ${colors.border}`,
              background: disabled ? colors.surface1 : colors.surface2,
              color: disabled ? colors.textMuted : colors.text,
              fontSize: "11px",
              fontFamily: fonts.mono,
              outline: "none",
              opacity: disabled ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            style={{
              padding: "5px 8px",
              border: `1px solid ${text.trim() && !disabled ? colors.text : colors.border}`,
              background: "none",
              color: text.trim() && !disabled ? colors.text : colors.textMuted,
              fontSize: "11px",
              fontFamily: fonts.mono,
              cursor: text.trim() && !disabled ? "pointer" : "default",
              opacity: disabled ? 0.5 : 1,
              flexShrink: "0",
            }}
          >
            {">"}
          </button>
        </div>
      )}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "4px 10px",
      }}>
        <button
          onClick={onSettings}
          style={{
            background: "none",
            border: "none",
            color: colors.textMuted,
            fontSize: "11px",
            padding: "0",
            cursor: "pointer",
            fontFamily: fonts.mono,
          }}
        >
          [=]
        </button>
      </div>
    </div>
  );
}

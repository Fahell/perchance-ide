import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { colors, fonts } from "./theme.js";

interface FooterProps {
  onSettings: () => void;
  onContext: () => void;
  onNew?: () => void;
  onHistory?: () => void;
  inputEnabled: boolean;
  onSend: (text: string) => void;
  disabled: boolean;
  onCancel?: () => void;
  locale?: Locale;
  conversationCount?: number;
}

const SUGGEST_COUNT = 4;

export function Footer({ onSettings, onContext, onNew, onHistory, inputEnabled, onSend, disabled, onCancel, locale, conversationCount = 0 }: FooterProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestIndexRef = useRef(0);
  const isFocusedRef = useRef(false);

  // Cycle placeholder suggestions
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const interval = setInterval(() => {
      if (!isFocusedRef.current) {
        suggestIndexRef.current = (suggestIndexRef.current + 1) % SUGGEST_COUNT;
        const suggestion = t(`suggests.${suggestIndexRef.current}`, locale);
        if (suggestion) input.placeholder = suggestion;
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [locale]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
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
          <textarea
            ref={inputRef}
            value={text}
            onInput={(e) => {
              setText((e.target as HTMLTextAreaElement).value);
              // Auto-grow
              const ta = e.target as HTMLTextAreaElement;
              ta.style.height = "auto";
              ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
            }}
            onFocus={() => { isFocusedRef.current = true; }}
            onBlur={() => { isFocusedRef.current = false; }}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("suggests.0", locale) || "> _"}
            rows={1}
            style={{
              flex: "1",
              padding: "5px 8px",
              border: `1px solid ${colors.border}`,
              background: colors.surface2,
              color: colors.text,
              fontSize: "11px",
              fontFamily: fonts.mono,
              outline: "none",
              resize: "none",
              lineHeight: "1.4",
              minHeight: "26px",
              maxHeight: "120px",
              overflowY: "auto",
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
          justifyContent: "space-between",
          padding: "4px 12px",
        }}>
          <span style={{
            fontSize: "10px",
            color: colors.textMuted,
            fontFamily: fonts.mono,
          }}>
            {t("footer.processing", locale)}
          </span>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              color: colors.textSecondary,
              fontSize: "11px",
              padding: "2px 6px",
              cursor: "pointer",
              fontFamily: fonts.mono,
              flexShrink: "0",
            }}
          >
            Cancel
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
          {onNew && (
            <button
              onClick={onNew}
              title="New conversation (archives current)"
              style={{ color: colors.textSecondary, cursor: "pointer", fontSize: "11px", fontFamily: fonts.mono, padding: "2px 4px", background: "none", border: "none", display: "inline" }}
            >
              new
            </button>
          )}
          {onHistory && conversationCount > 0 && (
            <button
              onClick={onHistory}
              title="Open archived conversation"
              style={{ color: colors.textSecondary, cursor: "pointer", fontSize: "11px", fontFamily: fonts.mono, padding: "2px 4px", background: "none", border: "none", display: "inline" }}
            >
              hist
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
            =
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
            ctx
          </button>
        </div>
      </div>
    </div>
  );
}

import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useState } from "preact/hooks";
import { t } from "../i18n/index.js";
import { colors, fonts } from "./theme.js";
export function Footer({ onSettings, onContext, onClear, inputEnabled, onSend, disabled, onCancel, locale, terminalOpen, onToggleTerminal }) {
    const placeholder = t("footer.waiting", locale);
    const [text, setText] = useState("");
    function handleSend() {
        const trimmed = text.trim();
        if (!trimmed || disabled)
            return;
        onSend(trimmed);
        setText("");
    }
    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }
    return (_jsxs("div", { style: { borderTop: `1px solid ${colors.border}`, flexShrink: "0" }, children: [inputEnabled && !disabled && (_jsxs("div", { style: {
                    display: "flex",
                    alignItems: "center",
                    padding: "4px 8px",
                    gap: "6px",
                }, children: [_jsx("input", { type: "text", value: text, onInput: (e) => setText(e.target.value), onKeyDown: handleKeyDown, placeholder: "> _", style: {
                            flex: "1",
                            padding: "5px 8px",
                            border: `1px solid ${colors.border}`,
                            background: colors.surface2,
                            color: colors.text,
                            fontSize: "11px",
                            fontFamily: fonts.mono,
                            outline: "none",
                        } }), _jsx("button", { onClick: handleSend, disabled: !text.trim(), style: {
                            padding: "5px 8px",
                            border: `1px solid ${text.trim() ? colors.text : colors.border}`,
                            background: "none",
                            color: text.trim() ? colors.text : colors.textMuted,
                            fontSize: "11px",
                            fontFamily: fonts.mono,
                            cursor: text.trim() ? "pointer" : "default",
                            flexShrink: "0",
                        }, children: ">" })] })), inputEnabled && disabled && onCancel && (_jsxs("div", { style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px 8px",
                    gap: "6px",
                }, children: [_jsx("span", { style: {
                            fontSize: "10px",
                            color: colors.textMuted,
                            fontFamily: fonts.mono,
                        }, children: "Processing..." }), _jsx("button", { onClick: onCancel, style: {
                            padding: "5px 8px",
                            border: `1px solid ${colors.textSecondary}`,
                            background: "none",
                            color: colors.textSecondary,
                            fontSize: "11px",
                            fontFamily: fonts.mono,
                            cursor: "pointer",
                            flexShrink: "0",
                        }, children: "[Cancel]" })] })), _jsxs("div", { style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 12px",
                }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [onToggleTerminal && (_jsxs("button", { onClick: onToggleTerminal, style: {
                                    color: terminalOpen ? colors.text : colors.textSecondary,
                                    cursor: "pointer",
                                    fontSize: "11px",
                                    fontFamily: fonts.mono,
                                    padding: "2px 4px",
                                    background: "none",
                                    border: "none",
                                    display: "inline",
                                }, children: ["[term]", terminalOpen ? "▼" : "▲"] })), onClear && (_jsx("button", { onClick: onClear, style: { color: colors.textSecondary, cursor: "pointer", fontSize: "11px", fontFamily: fonts.mono, padding: "2px 4px", background: "none", border: "none", display: "inline" }, children: "[clear]" }))] }), _jsxs("div", { style: { display: "flex", alignItems: "center" }, children: [_jsx("button", { onClick: onSettings, style: {
                                    background: "none",
                                    border: "none",
                                    color: colors.textSecondary,
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    cursor: "pointer",
                                    fontFamily: fonts.mono,
                                }, children: "[=]" }), _jsx("span", { style: { color: colors.border, margin: "0 4px" }, children: "/" }), _jsx("button", { onClick: onContext, style: {
                                    background: "none",
                                    border: "none",
                                    color: colors.textSecondary,
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    cursor: "pointer",
                                    fontFamily: fonts.mono,
                                }, children: "[ctx]" })] })] })] }));
}

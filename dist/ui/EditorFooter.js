import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
/**
 * EditorFooter — Footer bar for the code editor column.
 * Contains the terminal toggle button and file info.
 */
import { colors, fonts } from "./theme.js";
export function EditorFooter({ terminalOpen, onToggleTerminal }) {
    return (_jsxs("div", { style: {
            borderTop: `1px solid ${colors.border}`,
            flexShrink: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 12px",
            background: colors.surface1,
        }, children: [_jsx("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: _jsxs("button", { onClick: onToggleTerminal, style: {
                        color: terminalOpen ? colors.text : colors.textSecondary,
                        cursor: "pointer",
                        fontSize: "11px",
                        fontFamily: fonts.mono,
                        padding: "2px 4px",
                        background: "none",
                        border: "none",
                        display: "inline",
                    }, children: ["[term]", terminalOpen ? "▼" : "▲"] }) }), _jsx("span", { style: {
                    fontSize: "9px",
                    fontFamily: fonts.mono,
                    color: colors.textMuted,
                }, children: "editor" })] }));
}

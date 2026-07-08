import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
/**
 * EditorStatusBar — shows cursor position, language, and file info
 * at the bottom of the code editor panel.
 */
import { useState, useEffect } from "preact/hooks";
import { getLanguageLabel } from "../editor/langs.js";
import { colors, fonts } from "./theme.js";
// ─── Custom event name ──────────────────────────────────────
export const STATUS_BAR_EVENT = "editor:status-bar";
// ─── Helper to dispatch status updates ──────────────────────
export function dispatchStatusUpdate(info, filename) {
    window.dispatchEvent(new CustomEvent(STATUS_BAR_EVENT, {
        detail: { info, filename },
    }));
}
// ─── Component ──────────────────────────────────────────────
export function EditorStatusBar() {
    const [info, setInfo] = useState({
        line: 1,
        column: 1,
        totalLines: 1,
        selectionLength: 0,
    });
    const [language, setLanguage] = useState("Text");
    useEffect(() => {
        function handler(e) {
            const { info: newInfo, filename } = e.detail;
            setInfo(newInfo);
            const ext = filename.split(".").pop()?.toLowerCase() ?? "";
            setLanguage(getLanguageLabel(ext));
        }
        window.addEventListener(STATUS_BAR_EVENT, handler);
        return () => window.removeEventListener(STATUS_BAR_EVENT, handler);
    }, []);
    return (_jsxs("div", { style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "22px",
            padding: "0 12px",
            borderTop: `1px solid ${colors.border}`,
            background: colors.surface1,
            fontSize: "10px",
            fontFamily: fonts.mono,
            color: colors.textMuted,
            flexShrink: 0,
            userSelect: "none",
        }, children: [_jsx("span", { children: language }), _jsxs("div", { style: { display: "flex", gap: "12px" }, children: [info.selectionLength > 0 && (_jsxs("span", { children: ["Sel ", info.selectionLength] })), _jsxs("span", { children: ["Ln ", info.line, ", Col ", info.column] }), _jsx("span", { children: "UTF-8" })] })] }));
}

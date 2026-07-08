import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
/**
 * BreadcrumbsBar — shows file path + symbol hierarchy for cursor position.
 *
 * Renders above the editor content (below the tab bar) like VS Code's
 * breadcrumb navigation. Each segment is clickable to navigate.
 */
import { BREADCRUMB_COLORS } from "../editor/breadcrumbs.js";
import { getCurrentView } from "../editor/view-store.js";
import { colors, fonts } from "./theme.js";
// ─── Component ──────────────────────────────────────────────
export function BreadcrumbsBar({ path, symbols }) {
    // Split file path into segments
    const parts = path.split("/").filter(Boolean);
    function handleGoTo(from) {
        const view = getCurrentView();
        if (!view)
            return;
        view.dispatch({
            selection: { anchor: from },
            scrollIntoView: true,
        });
        view.focus();
    }
    return (_jsxs("div", { style: {
            display: "flex",
            alignItems: "center",
            height: "22px",
            padding: "0 8px",
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surface1,
            fontSize: "10px",
            fontFamily: fonts.mono,
            overflowX: "auto",
            overflowY: "hidden",
            whiteSpace: "nowrap",
            flexShrink: 0,
            userSelect: "none",
            gap: "0",
        }, children: [parts.map((part, i) => (_jsxs("span", { style: {
                    color: i === parts.length - 1 ? colors.text : colors.textMuted,
                    cursor: "default",
                    padding: "0 2px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                }, children: [_jsx("span", { children: part }), i < parts.length - 1 && (_jsx("span", { style: { color: colors.border, fontSize: "8px", lineHeight: 1 }, children: "\u25B8" }))] }, `file-${i}`))), parts.length > 0 && symbols.length > 0 && (_jsx("span", { style: {
                    color: colors.border,
                    margin: "0 6px",
                    opacity: 0.5,
                    fontSize: "10px",
                }, children: "|" })), symbols.map((sym, i) => (_jsxs("span", { onClick: () => handleGoTo(sym.from), onMouseEnter: (e) => {
                    e.currentTarget.style.background = colors.surface2;
                }, onMouseLeave: (e) => {
                    e.currentTarget.style.background = "transparent";
                }, style: {
                    color: BREADCRUMB_COLORS[sym.type] ?? colors.text,
                    cursor: "pointer",
                    padding: "0 2px",
                    borderRadius: "2px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "background 0.1s",
                }, children: [i > 0 && (_jsx("span", { style: { color: colors.border, fontSize: "8px", lineHeight: 1 }, children: "\u25B8" })), _jsx("span", { children: sym.name })] }, `sym-${i}`)))] }));
}

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { useEffect, useState } from "preact/hooks";
import { ideStore } from "../store.js";
import { getDiff } from "../utils/diff-cache.js";
import { DiffView } from "./DiffView.js";
import { colors, fonts } from "./theme.js";
const TOOL_LABELS = {
    web_search: "web_search",
    scrape_url: "scrape_url",
    run_python: "run_python",
};
const BRAILLE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function Spinner() {
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setFrame((f) => (f + 1) % BRAILLE.length), 80);
        return () => clearInterval(id);
    }, []);
    return _jsx("span", { children: BRAILLE[frame] });
}
export function ToolCallCard({ toolCall }) {
    const [expanded, setExpanded] = useState(false);
    // Subscribe to store for pyodide status
    const [store, setStore] = useState(ideStore.getState());
    useEffect(() => {
        return ideStore.subscribe((s) => setStore(s));
    }, []);
    const { pyodideStatus, pyodideError } = store;
    const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
    const isRunning = toolCall.status === "running";
    const borderColor = toolCall.status === "success" ? colors.statusDone :
        toolCall.status === "error" ? colors.statusError :
            colors.borderEmphasis;
    const badgeText = toolCall.status === "success" ? "[ok]" :
        toolCall.status === "error" ? "[!!]" : "";
    const query = toolCall.args.query ?? toolCall.args.url ?? "";
    const queryPreview = typeof query === "string"
        ? (query.length > 60 ? query.slice(0, 60) + "..." : query)
        : String(query);
    // Show Pyodide loading message when running Python and Pyodide is still loading
    const isPyodideLoading = isRunning && toolCall.name === "run_python" && pyodideStatus === "loading";
    const isPyodideError = !isRunning && toolCall.name === "run_python" && pyodideStatus === "error";
    const headerContent = (_jsxs("div", { style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            padding: "4px 10px",
            textAlign: "left",
            fontSize: "11px",
            fontFamily: fonts.mono,
        }, children: [_jsx("span", { style: { color: colors.textSecondary, fontWeight: "600", flexShrink: 0, maxWidth: "40%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: label }), _jsx("span", { style: {
                    flex: 1,
                    minWidth: 0,
                    fontSize: "10px",
                    color: colors.textMuted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: fonts.mono,
                }, children: isPyodideLoading
                    ? "Loading Python runtime (3.5 MB)…"
                    : isPyodideError
                        ? "Python runtime failed to load"
                        : isRunning
                            ? _jsx("span", { className: "skeleton-line", style: { display: "inline-block", width: "80px", height: "10px", margin: 0, verticalAlign: "middle" } })
                            : queryPreview }), _jsx("span", { style: {
                    fontSize: "12px",
                    color: isRunning ? colors.textSecondary : borderColor,
                    fontWeight: "bold",
                    fontFamily: fonts.mono,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                }, children: isRunning ? _jsx(Spinner, {}) : badgeText })] }));
    return (_jsxs("div", { style: {
            margin: "2px 0",
            background: colors.bg,
            borderLeft: `2px solid ${borderColor}`,
            overflow: "visible",
            animation: "agent-slide-in 0.2s ease-out",
        }, children: [isRunning ? headerContent : (_jsx("button", { onClick: () => setExpanded(!expanded), style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "4px 10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "11px",
                    fontFamily: fonts.mono,
                }, children: headerContent })), !isRunning && expanded && (_jsxs("div", { style: {
                    padding: "6px 10px 8px",
                    borderTop: `1px solid ${colors.border}`,
                    fontSize: "11px",
                    fontFamily: fonts.mono,
                }, children: [_jsxs("div", { style: { marginBottom: "4px" }, children: [_jsx("span", { style: { color: colors.textMuted }, children: "args: " }), _jsx("span", { style: { color: colors.textSecondary, fontSize: "10px" }, children: JSON.stringify(toolCall.args) })] }), toolCall.result && (_jsxs("div", { style: {
                            maxHeight: "150px",
                            overflowY: "auto",
                            padding: "6px",
                            background: colors.surface2,
                            color: colors.textSecondary,
                            lineHeight: "1.4",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: "10px",
                        }, children: [toolCall.result.slice(0, 1000), toolCall.result.length > 1000 && (_jsxs("span", { style: { color: colors.textMuted }, children: [" ...[", toolCall.result.length, " chars]"] }))] })), toolCall.name === "write_file" && toolCall.status === "success" && toolCall.args?.path && typeof toolCall.args.path === "string" && (() => {
                        const diff = getDiff(toolCall.args.path);
                        if (!diff)
                            return null;
                        return (_jsxs(_Fragment, { children: [_jsx("div", { style: { borderTop: `1px solid ${colors.border}`, margin: "6px 0", } }), _jsx("div", { style: { fontSize: "9px", color: colors.textMuted, marginBottom: "4px", }, children: "diff:" }), _jsx(DiffView, { before: diff.before, after: diff.after })] }));
                    })(), toolCall.error && (_jsx("div", { style: {
                            padding: "6px",
                            background: colors.surface2,
                            color: colors.statusError,
                            fontSize: "10px",
                        }, children: toolCall.error }))] }))] }));
}

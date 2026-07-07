import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useEffect, useState } from "preact/hooks";
import { clearChunkedSummaries, clearSummary, getChunkedSummaries, getContextState, getTotalMessageCount } from "../context-manager.js";
import { t } from "../i18n/index.js";
import { clearMemories, deleteMemory, getMemories } from "../memory.js";
import { Modal } from "./Modal.js";
import { colors, fonts } from "./theme.js";
export function ContextViewer({ isOpen, locale, onClose, onRefresh }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    // Async state
    const [state, setState] = useState(null);
    const [memories, setMemories] = useState([]);
    const [chunks, setChunks] = useState([]);
    const [totalMessages, setTotalMessages] = useState(0);
    useEffect(() => {
        if (!isOpen)
            return;
        loadData();
    }, [isOpen]);
    async function loadData() {
        try {
            const [ctx, mems, chks, total] = await Promise.all([
                getContextState(""),
                getMemories(),
                getChunkedSummaries(),
                Promise.resolve(getTotalMessageCount()),
            ]);
            setState(ctx);
            setMemories(mems);
            setChunks(chks);
            setTotalMessages(total);
        }
        catch (e) {
            console.warn("[ContextViewer] load failed:", e);
        }
    }
    const usagePercent = state ? Math.min(100, Math.round((state.totalTokens / state.maxTokens) * 100)) : 0;
    const isOverBudget = state ? state.totalTokens > state.maxTokens : false;
    const handleSearch = async () => {
        if (!searchQuery.trim())
            return;
        setIsSearching(true);
        setSearchResults(null);
        try {
            const { getTool } = await import("../tools/index.js");
            const tool = getTool("search_history");
            if (tool) {
                const result = await tool.execute({ query: searchQuery });
                setSearchResults(result);
            }
            else {
                setSearchResults("search_history tool not available");
            }
        }
        catch (err) {
            setSearchResults("Search failed: " + (err instanceof Error ? err.message : String(err)));
        }
        setIsSearching(false);
    };
    return (_jsxs(Modal, { isOpen: isOpen, onClose: onClose, title: t("context.title", locale) || "context", wide: true, children: [_jsxs("div", { style: { marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "6px" }, children: [_jsx("span", { style: { color: colors.textSecondary, fontSize: "10px" }, children: t("context.tokens", locale) || "tokens" }), _jsxs("span", { style: { color: isOverBudget ? colors.statusError : colors.textMuted, fontSize: "10px" }, children: [state ? state.totalTokens.toLocaleString() : "…", " / ", state ? state.maxTokens.toLocaleString() : "…"] })] }), _jsx("div", { role: "progressbar", "aria-valuenow": usagePercent, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `Token usage: ${usagePercent}%`, style: { width: "100%", height: "4px", background: colors.surface3, position: "relative" }, children: _jsx("div", { style: {
                                width: `${usagePercent}%`,
                                height: "100%",
                                background: isOverBudget ? colors.statusError : colors.textSecondary,
                                transition: "width 0.3s",
                            } }) }), _jsxs("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "6px" }, children: [_jsxs("span", { style: { color: colors.textMuted, fontSize: "9px" }, children: [t("context.totalHistory", locale) || "total messages", ": ", totalMessages] }), _jsxs("span", { style: { color: colors.textMuted, fontSize: "9px" }, children: [t("context.messages", locale) || "messages", ": ", state ? state.recentMessages.length : 0] })] })] }), _jsxs("div", { style: { marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }, children: [_jsxs("span", { style: { color: colors.textSecondary, fontSize: "10px" }, children: [t("context.messages", locale) || "messages", " (", state ? state.recentMessages.length : 0, ")"] }), _jsx("span", { style: { color: colors.textMuted, fontSize: "9px", padding: "2px 6px", background: colors.surface2, border: `1px solid ${colors.border}` }, children: t("context.tier.hot", locale) || "hot — in prompt" })] }), _jsxs("div", { style: { maxHeight: "120px", overflowY: "auto" }, children: [state?.recentMessages.map((msg, i) => (_jsxs("div", { style: { marginBottom: "4px", fontSize: "9px" }, children: [_jsxs("span", { style: { color: msg.role === "user" ? colors.text : colors.textSecondary }, children: [msg.role === "user" ? "You" : "Agent", ":"] }), " ", _jsx("span", { style: { color: colors.textMuted }, children: msg.content.length > 80 ? msg.content.slice(0, 80) + "..." : msg.content })] }, i))), (!state || state.recentMessages.length === 0) && (_jsx("div", { style: { color: colors.textMuted, fontSize: "9px" }, children: t("context.noMessages", locale) || "no messages yet" }))] })] }), _jsxs("div", { style: { marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }, children: [_jsxs("span", { style: { color: colors.textSecondary, fontSize: "10px" }, children: [t("context.summary", locale) || "summary", " (", state ? state.summaryTokens : 0, " ", t("context.tokens", locale) || "tokens", ")"] }), state?.summary && (_jsx("button", { onClick: async () => { await clearSummary(); loadData(); }, style: { color: colors.textMuted, cursor: "pointer", fontSize: "9px", background: "none", border: "none", fontFamily: fonts.mono, padding: "2px 4px" }, children: "[clear]" }))] }), _jsx("div", { style: { color: colors.textMuted, fontSize: "10px", lineHeight: "1.5" }, children: state?.summary
                            ? state.summary.length > 200
                                ? state.summary.slice(0, 200) + "..."
                                : state.summary
                            : t("context.noSummary", locale) || "no summary yet — will be generated when conversation exceeds token budget" })] }), chunks.length > 0 && (_jsxs("div", { style: { marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }, children: [_jsxs("span", { style: { color: colors.textSecondary, fontSize: "10px" }, children: [t("context.chunks", locale) || "chunked summaries", " (", chunks.length, ")"] }), _jsxs("div", { style: { display: "flex", gap: "8px" }, children: [_jsx("span", { style: { color: colors.textMuted, fontSize: "9px", padding: "2px 6px", background: colors.surface2, border: `1px solid ${colors.border}` }, children: t("context.tier.warm", locale) || "warm — searchable" }), _jsx("button", { onClick: async () => { await clearChunkedSummaries(); loadData(); }, style: { color: colors.textMuted, cursor: "pointer", fontSize: "9px", background: "none", border: "none", fontFamily: fonts.mono, padding: "2px 4px" }, children: "[clear]" })] })] }), _jsx("div", { style: { maxHeight: "100px", overflowY: "auto" }, children: chunks.map((chunk, i) => (_jsxs("div", { style: { marginBottom: "4px", fontSize: "9px" }, children: [_jsxs("span", { style: { color: colors.textSecondary }, children: ["#", chunk.from, "-", chunk.to, ":"] }), " ", _jsx("span", { style: { color: colors.textMuted }, children: chunk.summary.length > 100 ? chunk.summary.slice(0, 100) + "..." : chunk.summary })] }, i))) })] })), _jsxs("div", { style: { marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }, children: [_jsx("label", { style: { color: colors.textSecondary, fontSize: "10px", marginBottom: "6px", display: "block" }, children: t("context.search", locale) || "search" }), _jsxs("div", { style: { display: "flex", gap: "6px" }, children: [_jsx("input", { type: "text", value: searchQuery, onInput: (e) => setSearchQuery(e.target.value), onKeyDown: (e) => { if (e.key === "Enter")
                                    handleSearch(); }, placeholder: t("context.searchPlaceholder", locale) || "search history...", "aria-label": t("context.search", locale) || "Search conversation history", style: {
                                    flex: "1",
                                    background: colors.surface2,
                                    border: `1px solid ${colors.border}`,
                                    color: colors.text,
                                    padding: "4px 8px",
                                    fontSize: "10px",
                                    fontFamily: fonts.mono,
                                    outline: "none",
                                } }), _jsx("button", { onClick: handleSearch, disabled: isSearching || !searchQuery.trim(), style: {
                                    background: colors.surface2,
                                    border: `1px solid ${colors.border}`,
                                    color: isSearching ? colors.textMuted : colors.text,
                                    padding: "4px 8px",
                                    fontSize: "10px",
                                    fontFamily: fonts.mono,
                                    cursor: isSearching ? "default" : "pointer",
                                }, children: isSearching ? "..." : t("context.search", locale) || "search" })] }), searchResults && (_jsx("div", { style: { marginTop: "8px", color: colors.textMuted, fontSize: "9px", lineHeight: "1.5", whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto" }, children: searchResults }))] }), _jsxs("div", { style: { padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }, children: [_jsxs("span", { style: { color: colors.textSecondary, fontSize: "10px" }, children: [t("context.memories", locale) || "memories", " (", memories.length, ")"] }), memories.length > 0 && (_jsx("button", { onClick: async () => { await clearMemories(); loadData(); }, style: { color: colors.textMuted, cursor: "pointer", fontSize: "9px", background: "none", border: "none", fontFamily: fonts.mono, padding: "2px 4px" }, children: "[clear all]" }))] }), _jsxs("div", { style: { maxHeight: "120px", overflowY: "auto" }, children: [memories.map((mem, i) => (_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3px" }, children: [_jsx("span", { style: { color: colors.textMuted, fontSize: "9px", flex: "1", marginRight: "6px" }, children: mem.length > 100 ? mem.slice(0, 100) + "..." : mem }), _jsx("button", { onClick: async () => { await deleteMemory(i); loadData(); }, style: { color: colors.textMuted, cursor: "pointer", fontSize: "9px", background: "none", border: "none", fontFamily: fonts.mono, padding: "2px 4px", flexShrink: "0" }, "aria-label": `Delete memory ${i + 1}`, children: "[x]" })] }, i))), memories.length === 0 && (_jsx("div", { style: { color: colors.textMuted, fontSize: "9px" }, children: t("context.noMemories", locale) || "no memories extracted yet" }))] })] })] }));
}

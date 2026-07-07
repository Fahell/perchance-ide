import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useRef, useState } from "preact/hooks";
import { t } from "../i18n/index.js";
import { renderMarkdown } from "./markdown.js";
import { colors, fonts } from "./theme.js";
const TRUNCATE_HEIGHT = 150;
export function ResponseText({ content, loading, locale }) {
    const [expanded, setExpanded] = useState(false);
    const [showCopy, setShowCopy] = useState(false);
    const [copied, setCopied] = useState(false);
    const copyTimerRef = useRef(null);
    if (loading && !content) {
        return (_jsxs("div", { style: {
                margin: "4px 0",
                padding: "8px 12px",
                background: colors.surface1,
                borderLeft: `2px solid ${colors.borderEmphasis}`,
                animation: "agent-slide-in 0.2s ease-out",
            }, children: [_jsx("div", { style: { color: colors.textMuted, fontSize: "9px", fontWeight: "600", marginBottom: "6px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }, children: "agent" }), _jsx("div", { className: "skeleton-line", style: { width: "85%" } }), _jsx("div", { className: "skeleton-line", style: { width: "60%" } }), _jsx("div", { className: "skeleton-line", style: { width: "70%" } })] }));
    }
    const isLong = content.length > 500;
    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(content);
        }
        catch {
            // Fallback for HTTP (Perchance)
            try {
                const textarea = document.createElement("textarea");
                textarea.value = content;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            catch (e) {
                console.warn("[ResponseText] copy failed:", e);
                return;
            }
        }
        if (copyTimerRef.current)
            clearTimeout(copyTimerRef.current);
        setCopied(true);
        copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
    return (_jsxs("div", { style: {
            margin: "4px 0",
            padding: "8px 12px",
            background: colors.surface1,
            borderLeft: `2px solid ${colors.borderEmphasis}`,
            fontSize: "13px",
            lineHeight: "1.5",
            color: colors.text,
            fontFamily: fonts.mono,
            wordBreak: "break-word",
            animation: "fade-in 0.3s ease-out",
            position: "relative",
        }, onMouseEnter: () => setShowCopy(true), onMouseLeave: () => setShowCopy(false), children: [_jsx("div", { style: { color: colors.textMuted, fontSize: "9px", fontWeight: "600", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }, children: "agent" }), _jsx("button", { onClick: handleCopy, style: {
                    position: "absolute",
                    top: "4px",
                    right: "8px",
                    background: "none",
                    border: "none",
                    color: copied ? colors.text : colors.textMuted,
                    fontSize: "9px",
                    cursor: "pointer",
                    fontFamily: fonts.mono,
                    opacity: showCopy ? 1 : 0,
                    transition: "opacity 0.15s",
                    padding: "2px 4px",
                }, children: copied ? "[copied!]" : "[copy]" }), _jsxs("div", { style: {
                    maxHeight: !expanded && isLong ? `${TRUNCATE_HEIGHT}px` : undefined,
                    overflow: !expanded && isLong ? "hidden" : undefined,
                    position: !expanded && isLong ? "relative" : undefined,
                }, children: [_jsx("div", { className: "md-content", dangerouslySetInnerHTML: { __html: renderMarkdown(content) } }), !expanded && isLong && (_jsx("div", { style: {
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: "40px",
                            background: `linear-gradient(transparent, ${colors.surface1})`,
                        } }))] }), isLong && (_jsx("button", { onClick: () => setExpanded(!expanded), style: {
                    display: "block",
                    width: "100%",
                    padding: "4px 0",
                    marginTop: "4px",
                    background: "none",
                    border: "none",
                    borderTop: `1px solid ${colors.border}`,
                    color: colors.textMuted,
                    fontSize: "10px",
                    fontFamily: fonts.mono,
                    cursor: "pointer",
                    textAlign: "center",
                }, children: expanded ? `[- ${t("response.collapse", locale)}]` : `[+ ${t("response.expand", locale)}]` }))] }));
}

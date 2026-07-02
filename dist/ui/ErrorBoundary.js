import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
/**
 * ErrorBoundary — Preact error boundary wrapper.
 *
 * Catches errors thrown during rendering, lifecycle methods, and constructors
 * of its child tree. Displays a fallback UI instead of crashing the whole panel.
 *
 * Does NOT catch:
 * - Async errors (e.g., inside setTimeout, fetch, Promises)
 * - Event handler errors
 * - Errors in the ErrorBoundary itself
 *
 * Use at strategic boundaries: one wrapping the whole panel, and individual
 * boundaries around each major section (editor, explorer, chat).
 */
import { Component } from "preact";
import { colors, fonts } from "./theme.js";
// ─── Component ──────────────────────────────────────────────
export class ErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error) {
        const label = this.props.name ?? "ErrorBoundary";
        console.error(`[${label}] Caught error:`, error);
    }
    handleRetry = () => {
        this.setState({ error: null });
    };
    render() {
        if (this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.handleRetry);
            }
            return this.defaultFallback(this.state.error);
        }
        return this.props.children;
    }
    defaultFallback(error) {
        const label = this.props.name ?? "Component";
        return (_jsxs("div", { style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                margin: "4px",
                border: `1px solid ${colors.borderEmphasis}`,
                background: colors.surface1,
                color: colors.textMuted,
                fontFamily: fonts.mono,
                fontSize: "11px",
                textAlign: "center",
                gap: "8px",
                minHeight: "60px",
            }, children: [_jsxs("span", { style: { color: colors.textSecondary, fontSize: "13px" }, children: ["\u26A0\uFE0F ", label] }), _jsx("span", { style: { fontSize: "10px", color: colors.textMuted, maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: error.message || "Something went wrong" }), _jsx("button", { onClick: this.handleRetry, style: {
                        background: "none",
                        border: `1px solid ${colors.borderEmphasis}`,
                        color: colors.textSecondary,
                        fontSize: "10px",
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontFamily: fonts.mono,
                    }, children: "[Reload]" })] }));
    }
}

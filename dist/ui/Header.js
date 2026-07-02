import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { colors, fonts } from "./theme.js";
export function Header({ version, commit, onFaq }) {
    return (_jsxs("div", { style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: "0",
        }, children: [_jsx("span", { style: { color: colors.textSecondary, fontSize: "12px", fontWeight: "600", fontFamily: fonts.mono, letterSpacing: "0.5px" }, children: "agent" }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "10px" }, children: [onFaq && (_jsx("button", { onClick: onFaq, style: { color: colors.textSecondary, cursor: "pointer", fontSize: "11px", fontFamily: fonts.mono, padding: "2px 4px", background: "none", border: "none", display: "inline" }, children: "[?]" })), _jsxs("span", { style: { fontSize: "10px", color: colors.textSecondary, fontFamily: fonts.mono }, children: ["v", version, "+", commit] })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useState } from "preact/hooks";
import { colors, fonts } from "./theme.js";
import { t } from "../i18n/index.js";
export function SetupScreen({ version, locale, onSetupComplete, validateApiKey, saveApiKey }) {
    const [key, setKey] = useState("");
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");
    async function handleSave() {
        if (!key.trim()) {
            setError(t("setup.error.empty", locale));
            setStatus("error");
            return;
        }
        setStatus("validating");
        const valid = await validateApiKey(key.trim());
        if (valid) {
            saveApiKey(key.trim());
            setStatus("success");
            setTimeout(() => onSetupComplete(), 800);
        }
        else {
            setError(t("setup.error.invalid", locale));
            setStatus("error");
        }
    }
    return (_jsx("div", { style: {
            fontFamily: fonts.mono,
            padding: "24px",
            background: colors.bg,
            color: colors.text,
            height: "100vh",
            margin: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
        }, children: _jsxs("div", { style: { maxWidth: "400px", width: "100%" }, children: [_jsxs("div", { style: { textAlign: "center", marginBottom: "24px" }, children: [_jsx("h2", { style: { margin: "0", color: colors.text, fontSize: "14px", fontFamily: fonts.mono, letterSpacing: "2px", textTransform: "uppercase" }, children: "agent" }), _jsxs("span", { style: { fontSize: "9px", color: colors.textMuted, fontFamily: fonts.mono }, children: ["v", version] })] }), _jsxs("div", { style: {
                        background: colors.surface1,
                        padding: "20px",
                        border: `1px solid ${colors.border}`,
                    }, children: [_jsxs("h3", { style: { margin: "0 0 12px", color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }, children: ["[ setup ] ", t("setup.title", locale)] }), _jsx("p", { style: { color: colors.textSecondary, fontSize: "11px", margin: "0 0 12px", lineHeight: "1.6", fontFamily: fonts.mono }, children: t("setup.desc", locale) }), _jsxs("ol", { style: { color: colors.textSecondary, fontSize: "11px", margin: "0 0 16px", paddingLeft: "16px", lineHeight: "2", fontFamily: fonts.mono }, children: [_jsxs("li", { children: [t("setup.step1", locale), " ", _jsx("span", { onClick: () => window.open("https://jina.ai/?sui=apikey", "_blank"), style: { color: colors.text, textDecoration: "underline", cursor: "pointer" }, children: "jina.ai/?sui=apikey" })] }), _jsx("li", { children: t("setup.step2", locale) }), _jsx("li", { children: t("setup.step3", locale) }), _jsx("li", { children: t("setup.step4", locale) })] }), _jsx("input", { type: "password", placeholder: "jina_xxx...", value: key, onInput: (e) => setKey(e.target.value), onKeyDown: (e) => { if (e.key === "Enter")
                                handleSave(); }, style: {
                                width: "100%",
                                padding: "8px 10px",
                                border: `1px solid ${colors.border}`,
                                background: colors.surface2,
                                color: colors.text,
                                fontSize: "11px",
                                fontFamily: fonts.mono,
                                boxSizing: "border-box",
                                outline: "none",
                                marginBottom: "10px",
                            } }), status === "error" && (_jsxs("div", { style: { color: colors.statusError, fontSize: "10px", marginBottom: "8px", fontFamily: fonts.mono }, children: ["[!!] ", error] })), status === "success" && (_jsxs("div", { style: { color: colors.textSecondary, fontSize: "10px", marginBottom: "8px", fontFamily: fonts.mono }, children: ["[ok] ", t("setup.success", locale)] })), _jsx("button", { onClick: handleSave, disabled: status === "validating", style: {
                                width: "100%",
                                padding: "8px",
                                border: `1px solid ${colors.text}`,
                                background: "transparent",
                                color: status === "validating" ? colors.textMuted : colors.text,
                                fontSize: "11px",
                                fontFamily: fonts.mono,
                                cursor: "pointer",
                                letterSpacing: "0.5px",
                            }, children: status === "validating" ? t("setup.validating", locale) : t("setup.save", locale) }), _jsx("button", { onClick: onSetupComplete, style: {
                                width: "100%",
                                padding: "6px",
                                border: `1px solid ${colors.border}`,
                                background: "transparent",
                                color: colors.textMuted,
                                fontSize: "10px",
                                fontFamily: fonts.mono,
                                cursor: "pointer",
                                marginTop: "6px",
                                letterSpacing: "0.5px",
                            }, children: t("setup.skip", locale) })] }), _jsx("p", { style: { color: colors.textMuted, fontSize: "9px", textAlign: "center", marginTop: "14px", fontFamily: fonts.mono }, children: t("setup.note", locale) })] }) }));
}

import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useState } from "preact/hooks";
import { LOCALES, LOCALE_LABELS, t } from "../i18n/index.js";
import { Modal } from "./Modal.js";
import { colors, fonts } from "./theme.js";
export function SettingsModal({ isOpen, currentKey, locale, onClose, onSave, onLocaleChange }) {
    const [key, setKey] = useState(currentKey);
    const [msg, setMsg] = useState("");
    async function handleSave() {
        if (!key.trim()) {
            setMsg(t("settings.apiKey.error.empty", locale));
            return;
        }
        setMsg(t("settings.apiKey.validating", locale));
        const ok = await onSave(key.trim());
        setMsg(ok ? t("settings.apiKey.saved", locale) : t("settings.apiKey.error.invalid", locale));
        if (ok)
            setTimeout(onClose, 800);
    }
    const maskedKey = currentKey
        ? currentKey.slice(0, 8) + "..." + currentKey.slice(-4)
        : "none";
    return (_jsxs(Modal, { isOpen: isOpen, onClose: onClose, title: t("settings.title", locale), children: [_jsx("div", { style: { marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }, children: _jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [_jsx("label", { htmlFor: "settings-lang", style: { color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono }, children: t("settings.language", locale) }), _jsx("select", { id: "settings-lang", value: locale, onChange: (e) => onLocaleChange(e.target.value), style: {
                                fontFamily: fonts.mono,
                                fontSize: "10px",
                                background: colors.surface2,
                                color: colors.text,
                                border: `1px solid ${colors.border}`,
                                padding: "3px 6px",
                                outline: "none",
                                cursor: "pointer",
                            }, children: LOCALES.map((l) => (_jsx("option", { value: l, children: LOCALE_LABELS[l] }, l))) })] }) }), _jsxs("div", { style: { marginBottom: "14px" }, children: [_jsx("label", { htmlFor: "settings-api-key", style: { color: colors.textMuted, fontSize: "9px", display: "block", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }, children: t("settings.apiKey", locale) }), _jsx("input", { id: "settings-api-key", type: "password", value: key, onInput: (e) => setKey(e.target.value), placeholder: t("settings.apiKey.placeholder", locale), style: {
                            width: "100%",
                            padding: "8px 10px",
                            border: `1px solid ${colors.border}`,
                            background: colors.surface1,
                            color: colors.text,
                            fontSize: "11px",
                            fontFamily: fonts.mono,
                            boxSizing: "border-box",
                            outline: "none",
                        } }), _jsx("div", { style: { color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono }, children: t("settings.apiKey.current", locale).replace("{key}", maskedKey) })] }), msg && (_jsx("div", { style: {
                    fontSize: "10px",
                    marginBottom: "10px",
                    color: msg.startsWith("[ok]") ? colors.textSecondary : msg.startsWith("[!!]") ? colors.statusError : colors.textMuted,
                    fontFamily: fonts.mono,
                }, children: msg })), _jsxs("div", { style: { display: "flex", gap: "8px", marginTop: "8px" }, children: [_jsx("button", { onClick: handleSave, style: {
                            flex: "1",
                            padding: "8px",
                            border: `1px solid ${colors.text}`,
                            background: "transparent",
                            color: colors.text,
                            fontSize: "11px",
                            fontFamily: fonts.mono,
                            cursor: "pointer",
                            letterSpacing: "0.5px",
                        }, children: t("settings.save", locale) }), _jsx("button", { onClick: onClose, style: {
                            flex: "1",
                            padding: "8px",
                            border: `1px solid ${colors.border}`,
                            background: "transparent",
                            color: colors.textMuted,
                            fontSize: "11px",
                            fontFamily: fonts.mono,
                            cursor: "pointer",
                            letterSpacing: "0.5px",
                        }, children: t("settings.close", locale) })] })] }));
}

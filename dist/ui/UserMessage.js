import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { t } from "../i18n/index.js";
import { formatAbsoluteTime, formatRelativeTime } from "./formatRelativeTime.js";
import { colors, fonts } from "./theme.js";
export function UserMessage({ content, userName, locale, timestamp }) {
    return (_jsx("div", { style: {
            display: "flex",
            justifyContent: "flex-end",
            animation: "agent-slide-in 0.2s ease-out",
        }, children: _jsxs("div", { style: {
                maxWidth: "85%",
                padding: "8px 12px",
                background: colors.surface2,
                borderRight: `2px solid ${colors.borderEmphasis}`,
                fontSize: "13px",
                lineHeight: "1.5",
                color: colors.text,
                fontFamily: fonts.mono,
                wordBreak: "break-word",
            }, children: [_jsx("div", { style: { color: colors.textMuted, fontSize: "9px", fontWeight: "600", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }, children: userName || t("user.you", locale) }), _jsx("div", { style: { textAlign: "right" }, children: content }), timestamp && (_jsx("div", { title: formatAbsoluteTime(timestamp, locale), style: { color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono }, children: formatRelativeTime(timestamp, locale) }))] }) }));
}

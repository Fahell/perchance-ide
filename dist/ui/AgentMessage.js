import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { formatAbsoluteTime, formatRelativeTime } from "./formatRelativeTime.js";
import { ResponseText } from "./ResponseText.js";
import { colors, fonts } from "./theme.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import { ToolCallCard } from "./ToolCallCard.js";
export function AgentMessage({ message, agentStatus, compact, locale }) {
    const isActive = message.role === "agent" && agentStatus !== "idle";
    return (_jsxs("div", { style: { animation: "agent-slide-in 0.2s ease-out", maxWidth: message.toolCalls.length > 0 ? "100%" : "85%" }, children: [isActive && !message.content && message.toolCalls.length === 0 && _jsx(ThinkingIndicator, {}), message.toolCalls.map((tc) => (_jsx(ToolCallCard, { toolCall: tc }, tc.id))), !compact && _jsx(ResponseText, { content: message.content, loading: isActive && message.toolCalls.length > 0, locale: locale }), message.timestamp && (_jsx("div", { title: formatAbsoluteTime(message.timestamp, locale), style: { color: colors.textMuted, fontSize: "9px", marginTop: "2px", padding: "0 12px", fontFamily: fonts.mono }, children: formatRelativeTime(message.timestamp, locale) }))] }));
}

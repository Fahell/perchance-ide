import { jsx as _jsx, Fragment as _Fragment } from "preact/jsx-runtime";
import { AgentMessage } from "./AgentMessage.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import { UserMessage } from "./UserMessage.js";
export function ChatMessages({ messages, agentStatus, locale, userName }) {
    const isCompact = false;
    const filtered = isCompact
        ? messages.filter((msg) => {
            if (msg.role === "user")
                return false;
            if (msg.toolCalls.length > 0)
                return true;
            if (agentStatus !== "idle")
                return true;
            return false;
        })
        : messages;
    const elements = [];
    filtered.forEach((msg, i) => {
        const prev = filtered[i - 1];
        if (prev && prev.role !== msg.role) {
            elements.push(_jsx("div", { className: "msg-turn-separator" }, `sep-${i}`));
        }
        if (msg.role === "user") {
            elements.push(_jsx(UserMessage, { content: msg.content, userName: userName, locale: locale, timestamp: msg.timestamp }, msg.id));
        }
        else {
            elements.push(_jsx(AgentMessage, { message: msg, agentStatus: agentStatus, compact: isCompact, locale: locale }, msg.id));
        }
    });
    // Thinking gap after last user message
    if (agentStatus === "thinking" && messages.length > 0 && messages[messages.length - 1].role === "user") {
        elements.push(_jsx("div", { className: "msg-turn-separator" }, "thinking-sep"));
        elements.push(_jsx(ThinkingIndicator, {}, "thinking-indicator"));
    }
    return _jsx(_Fragment, { children: elements });
}

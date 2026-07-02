/**
 * Renders the filtered message list and thinking indicator.
 *
 * Extracted from AgentPanel to separate presentation logic
 * (filtering, turn separators, compact mode) from orchestration.
 */

import type { Locale } from "../i18n/index.js";
import { AgentMessage } from "./AgentMessage.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import type { AgentStatus, PanelMessage } from "./types.js";
import { UserMessage } from "./UserMessage.js";

export interface ChatMessagesProps {
  messages: PanelMessage[];
  agentStatus: AgentStatus;
  locale: Locale;
  userName?: string;
}

export function ChatMessages({ messages, agentStatus, locale, userName }: ChatMessagesProps) {
  const isCompact = false;

  const filtered = isCompact
    ? messages.filter((msg) => {
      if (msg.role === "user") return false;
      if (msg.toolCalls.length > 0) return true;
      if (agentStatus !== "idle") return true;
      return false;
    })
    : messages;

  const elements: preact.VNode[] = [];
  filtered.forEach((msg, i) => {
    const prev = filtered[i - 1];
    if (prev && prev.role !== msg.role) {
      elements.push(<div key={`sep-${i}`} className="msg-turn-separator" />);
    }
    if (msg.role === "user") {
      elements.push(<UserMessage key={msg.id} content={msg.content} userName={userName} locale={locale} timestamp={msg.timestamp} />);
    } else {
      elements.push(
        <AgentMessage
          key={msg.id}
          message={msg}
          agentStatus={agentStatus}
          compact={isCompact}
          locale={locale}
        />
      );
    }
  });

  // Thinking gap after last user message
  if (agentStatus === "thinking" && messages.length > 0 && messages[messages.length - 1].role === "user") {
    elements.push(<div key="thinking-sep" className="msg-turn-separator" />);
    elements.push(<ThinkingIndicator key="thinking-indicator" />);
  }

  return <>{elements}</>;
}

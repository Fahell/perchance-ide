/**
 * Renders the filtered message list and thinking indicator.
 *
 * Extracted from AgentPanel to separate presentation logic
 * (filtering, turn separators, compact mode) from orchestration.
 */

import type { Locale } from "../i18n/index.js";
import { t } from "../i18n/index.js";
import { AgentMessage } from "./AgentMessage.js";
import { colors, fonts } from "./theme.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import type { AgentStatus, PanelMessage, PanelMode } from "./types.js";
import { UserMessage } from "./UserMessage.js";

export interface ChatMessagesProps {
  messages: PanelMessage[];
  agentStatus: AgentStatus;
  panelMode: PanelMode;
  locale: Locale;
  userName?: string;
}

export function ChatMessages({ messages, agentStatus, panelMode, locale, userName }: ChatMessagesProps) {
  const isCompact = panelMode === "tools-only";

  const filtered = isCompact
    ? messages.filter((msg) => {
        if (msg.role === "user") return false;
        if (msg.toolCalls.length > 0) return true;
        if (agentStatus !== "idle") return true;
        return false;
      })
    : messages;

  // Compact mode empty-state when all messages are filtered out
  if (isCompact && messages.length > 0 && filtered.length === 0 && agentStatus === "idle") {
    return (
      <div style={{ padding: "12px", textAlign: "center", color: colors.textMuted, fontSize: "10px", fontFamily: fonts.mono }}>
        {t("panel.compact", locale)}
      </div>
    );
  }

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

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
  onContinue?: (content: string) => void;
}

export function ChatMessages({ messages, agentStatus, locale, onContinue }: ChatMessagesProps) {
  // Find index of last agent message to show Continue button
  const lastAgentIdx = messages
    .map((m, i) => (m.role === "agent" ? i : -1))
    .filter((i) => i !== -1)
    .pop();

  const elements: preact.VNode[] = [];
  messages.forEach((msg, i) => {
    const prev = messages[i - 1];
    if (prev && prev.role !== msg.role) {
      elements.push(<div key={`sep-${i}`} className="msg-turn-separator" />);
    }
    if (msg.role === "user") {
      elements.push(<UserMessage key={msg.id} content={msg.content} locale={locale} timestamp={msg.timestamp} />);
    } else {
      elements.push(
        <AgentMessage
          key={msg.id}
          message={msg}
          agentStatus={agentStatus}
          locale={locale}
          onContinue={onContinue}
          isLastAgentMessage={i === lastAgentIdx}
        />
      );
    }
  });

  // Thinking gap after last user message
  if (agentStatus === "thinking" && messages.length > 0 && messages[messages.length - 1].role === "user") {
    elements.push(<div key="thinking-sep" className="msg-turn-separator" />);
    elements.push(<ThinkingIndicator key="thinking-indicator" status={agentStatus} />);
  }

  return <>{elements}</>;
}

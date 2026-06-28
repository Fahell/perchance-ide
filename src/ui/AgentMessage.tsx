import { h } from "preact";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import { ToolCallCard } from "./ToolCallCard.js";
import { ResponseText } from "./ResponseText.js";
import type { PanelMessage, AgentStatus } from "./types.js";

interface AgentMessageProps {
  message: PanelMessage;
  agentStatus: AgentStatus;
  compact?: boolean;
}

export function AgentMessage({ message, agentStatus, compact }: AgentMessageProps) {
  const isActive = message.role === "agent" && agentStatus !== "idle";

  return (
    <div style={{ animation: "agent-slide-in 0.2s ease-out", maxWidth: message.toolCalls.length > 0 ? "100%" : "85%" }}>
      {/* Thinking indicator — terminal typing animation */}
      {isActive && !message.content && message.toolCalls.length === 0 && <ThinkingIndicator />}

      {/* Tool call cards */}
      {message.toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}

      {/* Final response — hidden in compact mode */}
      {!compact && <ResponseText content={message.content} loading={isActive && message.toolCalls.length > 0} />}
    </div>
  );
}

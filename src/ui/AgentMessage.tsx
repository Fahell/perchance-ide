import { h } from "preact";
import { StatusIndicator } from "./StatusIndicator.js";
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
    <div style={{ animation: "agent-slide-in 0.2s ease-out" }}>
      {/* Status indicator — only for active agent processing */}
      {isActive && !message.content && message.toolCalls.length === 0 && <StatusIndicator status={agentStatus} />}

      {/* Tool call cards */}
      {message.toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}

      {/* Thinking skeleton — when active but no tool calls and no content yet */}
      {isActive && !message.content && message.toolCalls.length === 0 && (
        <div style={{ padding: "4px 10px" }}>
          <div className="skeleton-line" style={{ width: "70%" }} />
          <div className="skeleton-line" style={{ width: "45%" }} />
        </div>
      )}

      {/* Final response — hidden in compact mode */}
      {!compact && <ResponseText content={message.content} loading={isActive && message.toolCalls.length > 0} />}
    </div>
  );
}

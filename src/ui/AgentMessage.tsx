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
  const isActive = message.role === "agent" && agentStatus !== "idle" && message.content === "";

  return (
    <div style={{ animation: "agent-slide-in 0.2s ease-out" }}>
      {/* Status indicator — only for active agent processing */}
      {isActive && <StatusIndicator status={agentStatus} />}

      {/* Tool call cards */}
      {message.toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}

      {/* Final response — hidden in compact mode */}
      {!compact && message.content && <ResponseText content={message.content} />}
    </div>
  );
}

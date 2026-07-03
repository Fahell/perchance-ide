import type { Locale } from "../i18n/index.js";
import { formatAbsoluteTime, formatRelativeTime } from "./formatRelativeTime.js";
import { ResponseText } from "./ResponseText.js";
import { colors, fonts } from "./theme.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import { ToolCallCard } from "./ToolCallCard.js";
import type { AgentStatus, PanelMessage } from "./types.js";

interface AgentMessageProps {
  message: PanelMessage;
  agentStatus: AgentStatus;
  compact?: boolean;
  locale?: Locale;
  onContinue?: (content: string) => void;
  isLastAgentMessage?: boolean;
}

export function AgentMessage({ message, agentStatus, compact, locale, onContinue, isLastAgentMessage }: AgentMessageProps) {
  const isActive = message.role === "agent" && agentStatus !== "idle";

  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div style={{ animation: "agent-slide-in 0.2s ease-out", maxWidth: message.toolCalls.length > 0 ? "100%" : "85%", textAlign: "left" }}>
        {/* Thinking indicator — terminal typing animation */}
        {isActive && !message.content && message.toolCalls.length === 0 && <ThinkingIndicator />}

        {/* Tool call cards */}
        {message.toolCalls.map((tc) => (
          <ToolCallCard key={tc.id} toolCall={tc} />
        ))}

        {/* Final response — hidden in compact mode */}
        {!compact && <ResponseText content={message.content} loading={isActive && message.toolCalls.length > 0} locale={locale} />}

        {/* Continue button — only on last agent message when idle */}
        {isLastAgentMessage && onContinue && agentStatus === "idle" && message.content && (
          <button
            onClick={() => onContinue(message.content)}
            style={{
              background: "none",
              border: `1px solid ${colors.border}`,
              color: colors.textMuted,
              fontSize: "9px",
              padding: "2px 8px",
              margin: "6px 12px 0",
              cursor: "pointer",
              fontFamily: fonts.mono,
              opacity: 0.7,
              transition: "opacity 0.15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "0.7")}
          >
            ▶ Continue
          </button>
        )}

        {/* Timestamp */}
        {message.timestamp && (
          <div
            title={formatAbsoluteTime(message.timestamp, locale)}
            style={{ color: colors.textMuted, fontSize: "9px", marginTop: "2px", padding: "0 12px", fontFamily: fonts.mono }}
          >
            {formatRelativeTime(message.timestamp, locale)}
          </div>
        )}
      </div>
    </div>
  );
}

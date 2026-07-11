import { h } from "preact";
import { colors, fonts } from "./theme.js";
import type { AgentStatus } from "./types.js";

/**
 * Status indicator — compact dot + label showing what the agent is doing.
 *
 * Replaces the old terminal-style typewriter animation.
 * Shows only the status label (thinking / searching / reading / responding)
 * with a pulsing dot. No fragments, no terminal lines.
 */

interface ThinkingIndicatorProps {
  status?: AgentStatus;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "",
  thinking: "thinking",
  searching: "searching",
  scraping: "reading",
  responding: "responding",
};

export function ThinkingIndicator({ status = "thinking" }: ThinkingIndicatorProps) {
  if (status === "idle") return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "4px 10px",
        animation: "agent-slide-in 0.2s ease-out",
      }}
    >
      {/* Pulsing dot */}
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: colors.textSecondary,
          animation: "status-dot-pulse 1.2s ease-in-out infinite",
          flexShrink: 0,
        }}
      />
      {/* Status label */}
      <span
        style={{
          color: colors.textMuted,
          fontFamily: fonts.mono,
          fontSize: "10px",
          letterSpacing: "1px",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        {STATUS_LABELS[status] || status}
      </span>
    </div>
  );
}

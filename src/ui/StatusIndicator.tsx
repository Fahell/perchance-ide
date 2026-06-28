import { h } from "preact";
import { colors, fonts } from "./theme.js";
import type { AgentStatus } from "./types.js";

interface StatusIndicatorProps {
  status: AgentStatus;
}

const STATUS_LABELS: Record<AgentStatus, string | null> = {
  idle: null,
  thinking: "thinking",
  searching: "searching",
  scraping: "reading",
  responding: "generating",
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const label = STATUS_LABELS[status];
  if (!label) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "4px 10px",
      margin: "2px 0",
      fontSize: "11px",
      fontFamily: fonts.mono,
    }}>
      <span className="shimmer-text">{label}</span>
      <span style={{
        color: colors.text,
        animation: "cursor-blink 1s step-end infinite",
        fontWeight: "bold",
      }}>|</span>
    </div>
  );
}

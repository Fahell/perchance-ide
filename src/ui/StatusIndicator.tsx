import { h } from "preact";
import { colors } from "./theme.js";
import type { AgentStatus } from "./types.js";

interface StatusIndicatorProps {
  status: AgentStatus;
}

const STATUS_CONFIG: Record<AgentStatus, { icon: string; label: string; color: string } | null> = {
  idle: null,
  thinking: { icon: "💭", label: "Pensando...", color: colors.accent },
  searching: { icon: "🔍", label: "Pesquisando na web...", color: colors.warning },
  scraping: { icon: "📄", label: "Lendo página...", color: colors.success },
  responding: { icon: "✍️", label: "Gerando resposta...", color: colors.accent },
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 10px",
      margin: "4px 0",
      fontSize: "12px",
      color: config.color,
      animation: "agent-pulse 1.5s ease-in-out infinite",
    }}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}

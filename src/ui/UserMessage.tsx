import { h } from "preact";
import { colors } from "./theme.js";

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div style={{
      margin: "6px 0",
      padding: "8px 12px",
      background: colors.card,
      borderRadius: "8px 8px 8px 2px",
      borderLeft: `3px solid ${colors.accent}`,
      fontSize: "13px",
      lineHeight: "1.5",
      color: colors.text,
      animation: "agent-slide-in 0.2s ease-out",
    }}>
      <div style={{ color: colors.accent, fontSize: "10px", fontWeight: "600", marginBottom: "2px" }}>
        👤 Você
      </div>
      <div>{content}</div>
    </div>
  );
}

import { h } from "preact";
import { colors } from "./theme.js";

interface ResponseTextProps {
  content: string;
}

export function ResponseText({ content }: ResponseTextProps) {
  return (
    <div style={{
      margin: "6px 0",
      padding: "8px 12px",
      background: colors.card,
      borderRadius: "8px 8px 2px 8px",
      borderLeft: `3px solid ${colors.success}`,
      fontSize: "13px",
      lineHeight: "1.5",
      color: colors.text,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      animation: "agent-slide-in 0.2s ease-out",
    }}>
      <div style={{ color: colors.success, fontSize: "10px", fontWeight: "600", marginBottom: "2px" }}>
        🤖 Resposta
      </div>
      <div>{content}</div>
    </div>
  );
}

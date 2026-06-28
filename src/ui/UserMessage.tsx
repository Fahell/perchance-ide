import { h } from "preact";
import { colors, fonts } from "./theme.js";

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div style={{
      margin: "4px 0",
      padding: "8px 12px",
      background: colors.surface1,
      borderLeft: `2px solid ${colors.borderEmphasis}`,
      fontSize: "13px",
      lineHeight: "1.5",
      color: colors.text,
      fontFamily: fonts.mono,
      animation: "agent-slide-in 0.2s ease-out",
    }}>
      <div style={{ color: colors.textMuted, fontSize: "9px", fontWeight: "600", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
        you
      </div>
      <div>{content}</div>
    </div>
  );
}

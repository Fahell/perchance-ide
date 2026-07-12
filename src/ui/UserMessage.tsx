import { colors, fonts } from "./theme.js";

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "flex-end",
      animation: "agent-slide-in 0.2s ease-out",
    }}>
      <div style={{
        maxWidth: "85%",
        padding: "6px 10px",
        background: colors.surface2,
        borderRight: `2px solid ${colors.borderEmphasis}`,
        fontSize: "12px",
        lineHeight: "1.5",
        color: colors.text,
        fontFamily: fonts.main,
        wordBreak: "break-word",
      }}>
        <div style={{ fontFamily: fonts.main }}>{content}</div>
      </div>
    </div>
  );
}

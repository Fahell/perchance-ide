import { h } from "preact";
import { colors, fonts } from "./theme.js";

interface ResponseTextProps {
  content: string;
  loading?: boolean;
}

export function ResponseText({ content, loading }: ResponseTextProps) {
  if (loading && !content) {
    return (
      <div style={{
        margin: "4px 0",
        padding: "8px 12px",
        background: colors.surface1,
        borderLeft: `2px solid ${colors.borderEmphasis}`,
        animation: "agent-slide-in 0.2s ease-out",
      }}>
        <div style={{ color: colors.textMuted, fontSize: "9px", fontWeight: "600", marginBottom: "6px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
          response
        </div>
        <div className="skeleton-line" style={{ width: "85%" }} />
        <div className="skeleton-line" style={{ width: "60%" }} />
        <div className="skeleton-line" style={{ width: "70%" }} />
      </div>
    );
  }

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
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      animation: "fade-in 0.3s ease-out",
    }}>
      <div style={{ color: colors.textMuted, fontSize: "9px", fontWeight: "600", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
        response
      </div>
      <div>{content}</div>
    </div>
  );
}

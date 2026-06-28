import { h } from "preact";
import { useState } from "preact/hooks";
import { colors, fonts } from "./theme.js";
import { renderMarkdown } from "./markdown.js";

interface ResponseTextProps {
  content: string;
  loading?: boolean;
}

const TRUNCATE_HEIGHT = 150;

export function ResponseText({ content, loading }: ResponseTextProps) {
  const [expanded, setExpanded] = useState(false);

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

  const isLong = content.length > 500;

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
      wordBreak: "break-word",
      animation: "fade-in 0.3s ease-out",
    }}>
      <div style={{ color: colors.textMuted, fontSize: "9px", fontWeight: "600", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
        response
      </div>
      <div style={{
        maxHeight: !expanded && isLong ? `${TRUNCATE_HEIGHT}px` : undefined,
        overflow: !expanded && isLong ? "hidden" : undefined,
        position: !expanded && isLong ? "relative" : undefined,
      }}>
        <div
          className="md-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
        {!expanded && isLong && (
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40px",
            background: `linear-gradient(transparent, ${colors.surface1})`,
          }} />
        )}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "block",
            width: "100%",
            padding: "4px 0",
            marginTop: "4px",
            background: "none",
            border: "none",
            borderTop: `1px solid ${colors.border}`,
            color: colors.textMuted,
            fontSize: "10px",
            fontFamily: fonts.mono,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          {expanded ? "[- collapse]" : "[+ expand]"}
        </button>
      )}
    </div>
  );
}

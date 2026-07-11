import { useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { renderMarkdown } from "./markdown.js";
import { colors, fonts } from "./theme.js";

interface ResponseTextProps {
  content: string;
  loading?: boolean;
  locale?: Locale;
}

const TRUNCATE_HEIGHT = 150;

export function ResponseText({ content, loading, locale }: ResponseTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  if (loading && !content) {
    return (
      <div style={{
        margin: "2px 0",
        padding: "6px 10px",
        background: colors.surface1,
        borderLeft: `2px solid ${colors.borderEmphasis}`,
        animation: "agent-slide-in 0.2s ease-out",
      }}>
        <div style={{ color: colors.textMuted, fontSize: "8px", fontWeight: "600", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
          agent
        </div>
        <div className="skeleton-line" style={{ width: "85%" }} />
        <div className="skeleton-line" style={{ width: "60%" }} />
        <div className="skeleton-line" style={{ width: "70%" }} />
      </div>
    );
  }

  const isLong = content.length > 500;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Fallback for HTTP (Perchance)
      try {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch (e) {
        console.warn("[ResponseText] copy failed:", e);
        return;
      }
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopied(true);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        margin: "2px 0",
        padding: "6px 10px",
        background: colors.surface1,
        borderLeft: `2px solid ${colors.borderEmphasis}`,
        fontSize: "12px",
        lineHeight: "1.5",
        color: colors.text,
        fontFamily: fonts.main,
        wordBreak: "break-word",
        animation: "fade-in 0.3s ease-out",
        position: "relative",
      }}
      onMouseEnter={() => setShowCopy(true)}
      onMouseLeave={() => setShowCopy(false)}
    >        <div style={{ color: colors.textMuted, fontSize: "8px", fontWeight: "600", marginBottom: "2px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
          agent
        </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        style={{
          position: "absolute",
          top: "4px",
          right: "8px",
          background: "none",
          border: "none",
          color: copied ? colors.text : colors.textMuted,
          fontSize: "9px",
          cursor: "pointer",
          fontFamily: fonts.mono,
          opacity: showCopy ? 1 : 0,
          transition: "opacity 0.15s",
          padding: "2px 4px",
        }}
      >
        {copied ? "[copied!]" : "[copy]"}
      </button>

      <div style={{
        maxHeight: !expanded && isLong ? `${TRUNCATE_HEIGHT}px` : undefined,
        overflow: !expanded && isLong ? "hidden" : undefined,
        position: !expanded && isLong ? "relative" : undefined,
      }}>          <div
            className="md-content"
            style={{ fontFamily: fonts.main }}
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
          {expanded ? `[- ${t("response.collapse", locale)}]` : `[+ ${t("response.expand", locale)}]`}
        </button>
      )}
    </div>
  );
}

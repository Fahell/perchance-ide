import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { colors, fonts } from "./theme.js";
import type { ToolCallEntry } from "./types.js";

interface ToolCallCardProps {
  toolCall: ToolCallEntry;
}

const TOOL_LABELS: Record<string, string> = {
  web_search: "web_search",
  scrape_url: "scrape_url",
};

const BRAILLE = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function Spinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % BRAILLE.length), 80);
    return () => clearInterval(id);
  }, []);
  return <span>{BRAILLE[frame]}</span>;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const isRunning = toolCall.status === "running";

  const borderColor =
    toolCall.status === "success" ? colors.statusDone :
    toolCall.status === "error" ? colors.statusError :
    colors.borderEmphasis;

  const badgeText =
    toolCall.status === "success" ? "[ok]" :
    toolCall.status === "error" ? "[!!]" : "";

  const query = toolCall.args.query ?? toolCall.args.url ?? "";
  const queryPreview = typeof query === "string"
    ? (query.length > 60 ? query.slice(0, 60) + "..." : query)
    : String(query);

  const headerContent = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        width: "100%",
        padding: "4px 10px",
        textAlign: "left",
        fontSize: "11px",
        fontFamily: fonts.mono,
      }}
    >
      <span style={{ color: colors.textSecondary, fontWeight: "600", flexShrink: 0, maxWidth: "40%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{
        flex: 1,
        minWidth: 0,
        fontSize: "10px",
        color: colors.textMuted,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontFamily: fonts.mono,
      }}>
        {isRunning
          ? <span className="skeleton-line" style={{ display: "inline-block", width: "80px", height: "10px", margin: 0, verticalAlign: "middle" }} />
          : queryPreview}
      </span>
      <span style={{
        fontSize: "12px",
        color: isRunning ? colors.textSecondary : borderColor,
        fontWeight: "bold",
        fontFamily: fonts.mono,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}>
        {isRunning ? <Spinner /> : badgeText}
      </span>
    </div>
  );

  return (
    <div style={{
      margin: "2px 0",
      background: colors.bg,
      borderLeft: `2px solid ${borderColor}`,
      overflow: "visible",
      animation: "agent-slide-in 0.2s ease-out",
    }}>
      {/* Header — button when complete, div when running */}
      {isRunning ? headerContent : (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            padding: "4px 10px",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            fontSize: "11px",
            fontFamily: fonts.mono,
          }}
        >
          {headerContent}
        </button>
      )}

      {/* Expanded content — only when complete */}
      {!isRunning && expanded && (
        <div style={{
          padding: "6px 10px 8px",
          borderTop: `1px solid ${colors.border}`,
          fontSize: "11px",
          fontFamily: fonts.mono,
        }}>
          {/* Args */}
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: colors.textMuted }}>args: </span>
            <span style={{ color: colors.textSecondary, fontSize: "10px" }}>
              {JSON.stringify(toolCall.args)}
            </span>
          </div>

          {/* Result */}
          {toolCall.result && (
            <div style={{
              maxHeight: "150px",
              overflowY: "auto",
              padding: "6px",
              background: colors.surface2,
              color: colors.textSecondary,
              lineHeight: "1.4",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "10px",
            }}>
              {toolCall.result.slice(0, 1000)}
              {toolCall.result.length > 1000 && (
                <span style={{ color: colors.textMuted }}> ...[{toolCall.result.length} chars]</span>
              )}
            </div>
          )}

          {/* Error */}
          {toolCall.error && (
            <div style={{
              padding: "6px",
              background: colors.surface2,
              color: colors.statusError,
              fontSize: "10px",
            }}>
              {toolCall.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { h } from "preact";
import { useState } from "preact/hooks";
import { colors } from "./theme.js";
import type { ToolCallEntry } from "./types.js";

interface ToolCallCardProps {
  toolCall: ToolCallEntry;
}

const TOOL_ICONS: Record<string, string> = {
  web_search: "🔍",
  scrape_url: "📄",
};

const TOOL_LABELS: Record<string, string> = {
  web_search: "Web Search",
  scrape_url: "Scrape URL",
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[toolCall.name] ?? "🔧";
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;

  const borderColor =
    toolCall.status === "success" ? colors.success :
    toolCall.status === "error" ? colors.error :
    colors.warning;

  const badgeColor =
    toolCall.status === "success" ? colors.success :
    toolCall.status === "error" ? colors.error :
    colors.warning;

  const badgeText =
    toolCall.status === "success" ? "✓" :
    toolCall.status === "error" ? "✗" :
    "⏳";

  const query = toolCall.args.query ?? toolCall.args.url ?? "";
  const queryPreview = typeof query === "string"
    ? (query.length > 60 ? query.slice(0, 60) + "..." : query)
    : String(query);

  return (
    <div style={{
      margin: "4px 0",
      background: colors.bg,
      borderRadius: "6px",
      borderLeft: `3px solid ${borderColor}`,
      overflow: "hidden",
      animation: "agent-slide-in 0.2s ease-out",
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          padding: "6px 10px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontSize: "12px",
        }}
      >
        <span>{icon}</span>
        <span style={{ color: colors.textSecondary, fontWeight: "600" }}>{label}</span>
        <span style={{
          marginLeft: "auto",
          fontSize: "10px",
          color: colors.textMuted,
          maxWidth: "200px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {queryPreview}
        </span>
        <span style={{
          fontSize: "10px",
          color: badgeColor,
          fontWeight: "bold",
        }}>
          {badgeText}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          padding: "6px 10px 8px",
          borderTop: `1px solid ${colors.border}`,
          fontSize: "11px",
        }}>
          {/* Args */}
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: colors.textMuted }}>Args: </span>
            <span style={{ color: colors.textSecondary, fontFamily: "monospace", fontSize: "10px" }}>
              {JSON.stringify(toolCall.args)}
            </span>
          </div>

          {/* Result */}
          {toolCall.result && (
            <div style={{
              maxHeight: "150px",
              overflowY: "auto",
              padding: "6px",
              background: colors.card,
              borderRadius: "4px",
              color: colors.textSecondary,
              lineHeight: "1.4",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
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
              background: "rgba(248, 113, 113, 0.1)",
              borderRadius: "4px",
              color: colors.error,
            }}>
              {toolCall.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

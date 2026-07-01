/**
 * DiffView — unified line-level diff component.
 *
 * Displays added/removed/unchanged lines with +/- prefix
 * and green/red background highlights.
 */

import { diffLines, type DiffLine } from "../utils/diff.js";
import { colors, fonts } from "./theme.js";

// ─── Props ──────────────────────────────────────────────────
interface DiffViewProps {
  before: string;
  after: string;
  maxLines?: number;
  locale?: string;
}

// ─── Component ──────────────────────────────────────────────
export function DiffView({ before, after, maxLines = 100 }: DiffViewProps) {
  const lines: DiffLine[] = diffLines(before, after, maxLines);
  const truncated = lines.length >= maxLines && before.split("\n").length + after.split("\n").length > maxLines;

  if (lines.length === 0) {
    return (
      <div style={{ padding: "6px 8px", fontSize: "9px", color: colors.textMuted, fontStyle: "italic" }}>
        no changes
      </div>
    );
  }

  return (
    <div style={{
      maxHeight: "240px", overflowY: "auto",
      fontFamily: fonts.mono, fontSize: "10px",
      lineHeight: "1.5", background: "#0d0d0d",
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{
          display: "flex",
          background: line.type === "added"
            ? "rgba(76, 175, 80, 0.10)"
            : line.type === "removed"
              ? "rgba(244, 67, 54, 0.10)"
              : "transparent",
          borderLeft: line.type === "added"
            ? `2px solid #4caf50`
            : line.type === "removed"
              ? `2px solid #f44336`
              : `2px solid transparent`,
        }}>
          <span style={{
            width: "12px", flexShrink: 0, textAlign: "center",
            color: line.type === "added"
              ? "#4caf50"
              : line.type === "removed"
                ? "#f44336"
                : colors.textMuted,
            userSelect: "none",
          }}>
            {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
          </span>
          <span style={{
            flex: 1, whiteSpace: "pre", paddingLeft: "4px",
            color: line.type === "added"
              ? "#b2dfb2"
              : line.type === "removed"
                ? "#efb2b2"
                : colors.textSecondary,
          }}>
            {line.value || " "}
          </span>
        </div>
      ))}
      {truncated && (
        <div style={{
          padding: "4px 8px", fontSize: "9px",
          color: colors.textMuted, fontStyle: "italic",
          borderTop: `1px solid ${colors.border}`,
        }}>
          ... (truncated, showing {maxLines} lines)
        </div>
      )}
    </div>
  );
}

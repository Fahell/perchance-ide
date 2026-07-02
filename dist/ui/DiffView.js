import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
/**
 * DiffView — unified line-level diff component with collapsible unchanged regions.
 *
 * Displays added/removed/unchanged lines with +/- prefix
 * and green/red background highlights. Sequences of unchanged
 * lines exceeding the collapse threshold are folded behind an
 * expandable button, keeping focus on meaningful changes.
 */
import { useState } from "preact/hooks";
import { diffLines } from "../utils/diff.js";
import { colors, fonts } from "./theme.js";
// ─── Constants ──────────────────────────────────────────────
const CONTEXT_LINES = 3;
const COLLAPSE_THRESHOLD = 2 * CONTEXT_LINES + 1; // 7
// ─── Grouping Logic ─────────────────────────────────────────
/**
 * Segments a flat DiffLine array into visible lines and collapsible
 * groups. Only runs of unchanged lines >= COLLAPSE_THRESHOLD are folded;
 * CONTEXT_LINES at each boundary remain visible for orientation.
 */
function groupDiffLines(lines) {
    const segments = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.type !== "unchanged") {
            segments.push({ kind: "line", line, index: i });
            i++;
            continue;
        }
        // Measure the contiguous unchanged run starting at i
        let runEnd = i;
        while (runEnd < lines.length && lines[runEnd].type === "unchanged") {
            runEnd++;
        }
        const runLength = runEnd - i;
        if (runLength < COLLAPSE_THRESHOLD) {
            // Too short to collapse — emit all as visible
            for (let j = i; j < runEnd; j++) {
                segments.push({ kind: "line", line: lines[j], index: j });
            }
        }
        else {
            // Emit top context
            for (let j = i; j < i + CONTEXT_LINES; j++) {
                segments.push({ kind: "line", line: lines[j], index: j });
            }
            // Emit collapsed middle portion
            const middleStart = i + CONTEXT_LINES;
            const middleEnd = runEnd - CONTEXT_LINES;
            const middleLines = lines.slice(middleStart, middleEnd);
            segments.push({ kind: "collapsed", lines: middleLines, startIndex: middleStart });
            // Emit bottom context
            for (let j = middleEnd; j < runEnd; j++) {
                segments.push({ kind: "line", line: lines[j], index: j });
            }
        }
        i = runEnd;
    }
    return segments;
}
// ─── Line Renderer ──────────────────────────────────────────
function renderDiffLine(line, key) {
    return (_jsxs("div", { style: {
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
        }, children: [_jsx("span", { style: {
                    width: "12px", flexShrink: 0, textAlign: "center",
                    color: line.type === "added"
                        ? "#4caf50"
                        : line.type === "removed"
                            ? "#f44336"
                            : colors.textMuted,
                    userSelect: "none",
                }, children: line.type === "added" ? "+" : line.type === "removed" ? "-" : " " }), _jsx("span", { style: {
                    flex: 1, whiteSpace: "pre", paddingLeft: "4px",
                    color: line.type === "added"
                        ? "#b2dfb2"
                        : line.type === "removed"
                            ? "#efb2b2"
                            : colors.textSecondary,
                }, children: line.value || " " })] }, key));
}
// ─── Component ──────────────────────────────────────────────
export function DiffView({ before, after, maxLines = 100 }) {
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const lines = diffLines(before, after, maxLines);
    const truncated = lines.length >= maxLines && before.split("\n").length + after.split("\n").length > maxLines;
    if (lines.length === 0) {
        return (_jsx("div", { style: { padding: "6px 8px", fontSize: "9px", color: colors.textMuted, fontStyle: "italic" }, children: "no changes" }));
    }
    const segments = groupDiffLines(lines);
    const toggleGroup = (startIndex) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(startIndex))
                next.delete(startIndex);
            else
                next.add(startIndex);
            return next;
        });
    };
    return (_jsxs("div", { style: {
            maxHeight: "240px", overflowY: "auto",
            fontFamily: fonts.mono, fontSize: "10px",
            lineHeight: "1.5", background: "#0d0d0d",
        }, children: [segments.map((segment) => {
                if (segment.kind === "line") {
                    return renderDiffLine(segment.line, segment.index);
                }
                // Collapsed segment
                const isExpanded = expandedGroups.has(segment.startIndex);
                if (isExpanded) {
                    return segment.lines.map((line, offset) => renderDiffLine(line, `${segment.startIndex}-${offset}`));
                }
                return (_jsxs("button", { onClick: () => toggleGroup(segment.startIndex), "aria-expanded": false, "aria-label": `Expand ${segment.lines.length} unchanged lines`, style: {
                        display: "flex", alignItems: "center", justifyContent: "center",
                        width: "100%", padding: "2px 8px",
                        background: colors.surface2, border: "none",
                        borderTop: `1px solid ${colors.border}`,
                        borderBottom: `1px solid ${colors.border}`,
                        color: colors.textMuted, fontFamily: fonts.mono,
                        fontSize: "9px", cursor: "pointer",
                        letterSpacing: "0.02em",
                    }, children: ["\u229E ", segment.lines.length, " unchanged line", segment.lines.length !== 1 ? "s" : ""] }, `collapse-${segment.startIndex}`));
            }), truncated && (_jsxs("div", { style: {
                    padding: "4px 8px", fontSize: "9px",
                    color: colors.textMuted, fontStyle: "italic",
                    borderTop: `1px solid ${colors.border}`,
                }, children: ["... (truncated, showing ", maxLines, " lines)"] }))] }));
}

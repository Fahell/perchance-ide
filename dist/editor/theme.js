/**
 * CodeMirror 6 professional dark theme.
 * Inspired by One Dark Pro and VS Code Dark+ color schemes.
 * Matches the UI color tokens from src/ui/theme.ts.
 */
import { EditorView } from "codemirror";
// ─── Color Palette ──────────────────────────────────────────
// Deep dark background — matches the app's terminal aesthetic
const bg = "#0c0e12";
const gutterBg = "#0c0e12";
const gutterBorder = "#1a1d23";
const lineActiveBg = "#101318";
const lineActiveGutterBg = "#14171c";
const cursor = "#e1e4e8";
const selection = "#264f78";
const selectionMatch = "#264f7870";
const findMatch = "#3a3f4b";
const findMatchSelected = "#4a5060";
// Syntax colors — One Dark Pro inspired
const keyword = "#c678dd"; // purple
const atom = "#d19a66"; // orange
const number = "#d19a66"; // orange
const def = "#61afef"; // blue
const variable = "#e06c75"; // red
const variable2 = "#abb2bf"; // light gray
const variable3 = "#e5c07b"; // yellow
const type = "#e5c07b"; // yellow
const comment = "#5c6370"; // gray
const string = "#98c379"; // green
const string2 = "#98c379"; // green
const meta = "#abb2bf"; // light gray
const qualifier = "#d19a66"; // orange
const builtin = "#e5c07b"; // yellow
const bracket = "#abb2bf"; // light gray
const tag = "#e06c75"; // red
const attribute = "#d19a66"; // orange
const hr = "#2c323c"; // dark gray
const link = "#61afef"; // blue
const header = "#e06c75"; // red
export const cmTheme = EditorView.theme({
    "&": {
        backgroundColor: bg,
        color: "#e1e4e8",
        height: "100%",
    },
    ".cm-scroller": {
        fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', 'JetBrains Mono', monospace",
        overflowY: "auto",
        lineHeight: "1.6",
    },
    ".cm-content": {
        caretColor: cursor,
        fontSize: "13px",
        textAlign: "left",
    },
    ".cm-cursor": {
        borderLeftColor: cursor,
        borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: cursor,
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: `${selection}40 !important`,
    },
    "&.cm-focused .cm-selectionBackground": {
        backgroundColor: `${selection}80 !important`,
    },
    ".cm-activeLine": {
        backgroundColor: lineActiveBg,
    },
    ".cm-activeLineGutter": {
        backgroundColor: lineActiveGutterBg,
    },
    ".cm-matchingBracket": {
        backgroundColor: "#2a2d35",
        outline: "1px solid #4a4f5a",
    },
    ".cm-gutters": {
        backgroundColor: gutterBg,
        color: "#4a4d55",
        border: "none",
        borderRight: `1px solid ${gutterBorder}`,
        minWidth: "40px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
        color: "#4a4d55",
        padding: "0 8px 0 4px",
        fontSize: "11px",
    },
    ".cm-lineNumbers": {
        color: "#4a4d55",
    },
    ".cm-foldGutter .cm-gutterElement": {
        color: "#4a4d55",
    },
    ".cm-foldPlaceholder": {
        backgroundColor: "#181a1f",
        border: "1px solid #2c323c",
        color: "#5c6370",
    },
    ".cm-searchMatch": {
        backgroundColor: findMatch,
        outline: "1px solid #4a5060",
    },
    ".cm-searchMatch-selected": {
        backgroundColor: findMatchSelected,
    },
    // ── Tooltips ──────────────────────────────────────────
    ".cm-tooltip": {
        backgroundColor: "#1e2128",
        border: "1px solid #2c323c",
        color: "#abb2bf",
        fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        fontSize: "12px",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "#2a2d35",
        color: "#e1e4e8",
    },
    ".cm-tooltip-autocomplete ul li": {
        padding: "2px 8px",
    },
    ".cm-completionDetail": {
        color: "#5c6370",
        fontStyle: "italic",
    },
    ".cm-completionIcon": {
        fontSize: "12px",
        opacity: "0.7",
    },
    ".cm-completionMatchedText": {
        color: "#61afef",
        fontWeight: "bold",
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
        "& > ul": {
            maxHeight: "200px",
            fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        },
    },
    // ── Hover tooltip ─────────────────────────────────────
    ".cm-hover-info": {
        maxWidth: "360px",
        padding: "8px 10px",
        lineHeight: "1.5",
    },
    ".cm-hover-header": {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "6px",
    },
    ".cm-hover-name": {
        color: "#e1e4e8",
        fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        fontSize: "13px",
        fontWeight: "600",
    },
    ".cm-hover-type": {
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: "3px",
        backgroundColor: "#2a2d35",
        color: "#61afef",
        fontSize: "9px",
        fontWeight: "500",
        letterSpacing: "0.5px",
        textTransform: "uppercase",
    },
    ".cm-hover-body": {
        color: "#abb2bf",
        fontSize: "11px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        lineHeight: "1.6",
    },
    ".cm-hover-tag": {
        display: "inline-block",
        padding: "1px 5px",
        borderRadius: "2px",
        backgroundColor: "#1a1d23",
        color: "#98c379",
        fontSize: "9px",
        fontWeight: "500",
        letterSpacing: "0.3px",
        textTransform: "uppercase",
        marginRight: "4px",
    },
    // ── Lint ──────────────────────────────────────────────
    ".cm-lintRange-error": {
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'6'%20height%3D'3'%20viewBox%3D'0%200%206%203'%3E%3Cpath%20fill%3D'%23e06c75'%20d%3D'm0%203%20l3%20-3%20l3%203%20z'%2F%3E%3C%2Fsvg%3E\")",
        backgroundPosition: "0 100%",
        backgroundRepeat: "repeat-x",
        paddingBottom: "2px",
    },
    ".cm-lintRange-warning": {
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'6'%20height%3D'3'%20viewBox%3D'0%200%206%203'%3E%3Cpath%20fill%3D'%23e5c07b'%20d%3D'm0%203%20l3%20-3%20l3%203%20z'%2F%3E%3C%2Fsvg%3E\")",
        backgroundPosition: "0 100%",
        backgroundRepeat: "repeat-x",
        paddingBottom: "2px",
    },
    ".cm-lintRange-active": {
        backgroundColor: "#2a1f1f",
    },
    ".cm-lintPoint": {
        position: "relative",
        "&:after": {
            content: '""',
            position: "absolute",
            top: "0",
            right: "2px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
        },
    },
    ".cm-lintPoint-error:after": {
        backgroundColor: "#e06c75",
    },
    ".cm-lintPoint-warning:after": {
        backgroundColor: "#e5c07b",
    },
    ".cm-lint-marker": {
        width: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    ".cm-lint-marker-error": {
        color: "#e06c75",
        "&:before": { content: '"●"' },
    },
    ".cm-lint-marker-warning": {
        color: "#e5c07b",
        "&:before": { content: '"●"' },
    },
    ".cm-lint-tooltip": {
        padding: "6px 10px",
        lineHeight: "1.5",
        maxWidth: "400px",
    },
    // ── Search panel ──────────────────────────────────────
    ".cm-panel": {
        backgroundColor: "#14171c",
        color: "#abb2bf",
        padding: "4px 8px",
        fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        fontSize: "12px",
        borderBottom: "1px solid #2c323c",
        "& input, & button": {
            fontFamily: "inherit",
            fontSize: "12px",
        },
        "& input": {
            backgroundColor: "#1e2128",
            border: "1px solid #2c323c",
            color: "#e1e4e8",
            padding: "4px 6px",
            outline: "none",
            "&:focus": {
                borderColor: "#4a5060",
            },
        },
        "& button": {
            backgroundColor: "#1e2128",
            border: "1px solid #2c323c",
            color: "#abb2bf",
            padding: "4px 8px",
            cursor: "pointer",
            "&:hover": {
                backgroundColor: "#2a2d35",
                color: "#e1e4e8",
            },
        },
        "& label": {
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "#5c6370",
        },
    },
    // ── Panels (lint diagnostics) ────────────────────────
    ".cm-panel.cm-panel-lint": {
        position: "relative",
        borderTop: "1px solid #2c323c",
        "& .cm-panel-lint ul": {
            maxHeight: "120px",
            overflowY: "auto",
            "& li": {
                padding: "2px 8px",
                fontSize: "11px",
                fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
                "&[aria-selected]": {
                    backgroundColor: "#2a2d35",
                },
                "& .cm-lintRange-error": {
                    color: "#e06c75",
                },
                "& .cm-lintRange-warning": {
                    color: "#e5c07b",
                },
            },
        },
    },
    // ── Completion panel ──────────────────────────────────
    ".cm-completionLabel": {
        fontWeight: "normal",
    },
    // ── Syntax highlighting — One Dark Pro colors ──────────
    ".ͼ1 .cm-keyword": { color: keyword, fontWeight: "500" },
    ".ͼ1 .cm-atom": { color: atom },
    ".ͼ1 .cm-number": { color: number },
    ".ͼ1 .cm-def": { color: def },
    ".ͼ1 .cm-variable": { color: variable },
    ".ͼ1 .cm-variable-2": { color: variable2 },
    ".ͼ1 .cm-variable-3": { color: variable3 },
    ".ͼ1 .cm-type": { color: type },
    ".ͼ1 .cm-comment": { color: comment, fontStyle: "italic" },
    ".ͼ1 .cm-string": { color: string },
    ".ͼ1 .cm-string-2": { color: string2 },
    ".ͼ1 .cm-meta": { color: meta },
    ".ͼ1 .cm-qualifier": { color: qualifier },
    ".ͼ1 .cm-builtin": { color: builtin },
    ".ͼ1 .cm-bracket": { color: bracket },
    ".ͼ1 .cm-tag": { color: tag },
    ".ͼ1 .cm-attribute": { color: attribute },
    ".ͼ1 .cm-hr": { color: hr },
    ".ͼ1 .cm-link": { color: link, textDecoration: "underline", cursor: "pointer" },
    ".ͼ1 .cm-strong": { color: "#e1e4e8", fontWeight: "bold" },
    ".ͼ1 .cm-em": { color: "#abb2bf", fontStyle: "italic" },
    ".ͼ1 .cm-header": { color: header },
    ".ͼ1 .cm-quote": { color: "#5c6370", fontStyle: "italic" },
    ".ͼ1 .cm-strikethrough": { textDecoration: "line-through" },
    // ── Indent guides ────────────────────────────────────
    // Vertical alignment markers at each indent level.
    // border-right is used because the mark wraps the LAST space
    // before each tab stop — the right edge of that character
    // aligns exactly with the tab stop boundary.
    ".cm-indent-guide": {
        borderRight: "1px solid #1a1d23",
    },
    // Active indent guide — cursor line's deepest level
    ".cm-indent-guide-active": {
        borderRight: "1px solid #2a2d35",
    },
}, { dark: true });

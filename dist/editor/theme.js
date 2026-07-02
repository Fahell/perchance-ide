/**
 * CodeMirror 6 monochrome dark theme.
 * Matches the UI color tokens from src/ui/theme.ts.
 */
import { EditorView } from "codemirror";
export const cmTheme = EditorView.theme({
    "&": {
        backgroundColor: "#000",
        color: "#fff",
        height: "100%",
    },
    ".cm-scroller": {
        fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        overflowY: "auto",
    },
    ".cm-content": {
        caretColor: "#fff",
        lineHeight: "1.5",
        fontSize: "13px",
        textAlign: "left",
    },
    ".cm-cursor": {
        borderLeftColor: "#fff",
        borderLeftWidth: "1px",
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "#fff",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: "#1a1a1a !important",
    },
    "&.cm-focused .cm-selectionBackground": {
        backgroundColor: "#222 !important",
    },
    ".cm-selectionMatch": {
        backgroundColor: "#111",
    },
    ".cm-activeLine": {
        backgroundColor: "#0a0a0a",
    },
    ".cm-activeLineGutter": {
        backgroundColor: "#111",
    },
    ".cm-matchingBracket": {
        backgroundColor: "#222",
        outline: "1px solid #444",
    },
    ".cm-gutters": {
        backgroundColor: "#000",
        color: "#333",
        border: "none",
        borderRight: "1px solid #111",
        minWidth: "36px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
        color: "#333",
        padding: "0 6px 0 4px",
        fontSize: "11px",
    },
    ".cm-lineNumbers": {
        color: "#333",
    },
    ".cm-foldGutter .cm-gutterElement": {
        color: "#333",
    },
    ".cm-foldPlaceholder": {
        backgroundColor: "#111",
        border: "1px solid #333",
        color: "#666",
    },
    ".cm-searchMatch": {
        backgroundColor: "#222",
        outline: "1px solid #444",
    },
    ".cm-searchMatch-selected": {
        backgroundColor: "#333",
    },
    ".cm-tooltip": {
        backgroundColor: "#111",
        border: "1px solid #333",
        color: "#ccc",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "#222",
        color: "#fff",
    },
    ".cm-panel": {
        backgroundColor: "#0a0a0a",
        color: "#aaa",
    },
    // Syntax highlighting colors — monochrome tones
    ".ͼ1 .cm-keyword": { color: "#ccc" },
    ".ͼ1 .cm-atom": { color: "#aaa" },
    ".ͼ1 .cm-number": { color: "#aaa" },
    ".ͼ1 .cm-def": { color: "#fff" },
    ".ͼ1 .cm-variable": { color: "#ddd" },
    ".ͼ1 .cm-variable-2": { color: "#ccc" },
    ".ͼ1 .cm-variable-3": { color: "#bbb" },
    ".ͼ1 .cm-type": { color: "#ccc" },
    ".ͼ1 .cm-comment": { color: "#555" },
    ".ͼ1 .cm-string": { color: "#aaa" },
    ".ͼ1 .cm-string-2": { color: "#999" },
    ".ͼ1 .cm-meta": { color: "#888" },
    ".ͼ1 .cm-qualifier": { color: "#bbb" },
    ".ͼ1 .cm-builtin": { color: "#bbb" },
    ".ͼ1 .cm-bracket": { color: "#666" },
    ".ͼ1 .cm-tag": { color: "#ccc" },
    ".ͼ1 .cm-attribute": { color: "#aaa" },
    ".ͼ1 .cm-hr": { color: "#444" },
    ".ͼ1 .cm-link": { color: "#aaa", textDecoration: "underline" },
    ".ͼ1 .cm-strong": { color: "#fff", fontWeight: "bold" },
    ".ͼ1 .cm-em": { color: "#ccc", fontStyle: "italic" },
    ".ͼ1 .cm-header": { color: "#fff" },
    ".ͼ1 .cm-quote": { color: "#888", fontStyle: "italic" },
    ".ͼ1 .cm-strikethrough": { textDecoration: "line-through" },
}, { dark: true });

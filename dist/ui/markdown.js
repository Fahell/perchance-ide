import { marked } from "marked";
/**
 * Render markdown text to safe HTML.
 * Escapes raw HTML first to prevent XSS, then parses markdown with GFM.
 *
 * Supports: tables, task lists, strikethrough, autolinks, code blocks, lists, headings.
 */
export function renderMarkdown(text) {
    // Escape HTML tags to prevent XSS — same approach as the snarkdown version
    const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    // Use sync mode — marked returns a string when no async extensions are used
    return marked.parse(escaped, { async: false });
}

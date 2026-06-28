import snarkdown from "snarkdown";

/**
 * Render markdown text to safe HTML.
 * Escapes raw HTML first to prevent XSS, then parses markdown.
 */
export function renderMarkdown(text: string): string {
  // Escape HTML tags to prevent XSS
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return snarkdown(escaped);
}

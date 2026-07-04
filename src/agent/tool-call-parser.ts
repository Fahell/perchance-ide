/**
 * Tool call XML parser — flat-tag format with CDATA support.
 *
 * Expected format:
 *   <tcOpen name="tool_name">
 *     <param1><![CDATA[value1]]></param1>
 *     <param2><![CDATA[value2]]></param2>
 *   </tcClose>
 *
 * Each tool parameter is its own XML tag wrapping a CDATA section.
 * This eliminates JSON-in-XML parsing issues entirely.
 */

import { hasTool } from "../tools/index.js";

// ─── Tag Constants (fill in manually) ───────────────────────
const tcOpen: string = "<tool_call>";
const tcClose: string = "</tool_call>";

// ─── Types ──────────────────────────────────────────────────
export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Extract the content of a CDATA section from raw text.
 * Returns the inner text if CDATA wrappers are present, otherwise the raw text trimmed.
 */
function extractCdataContent(raw: string): string {
  const cdataMatch = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdataMatch) return cdataMatch[1];
  return raw.trim();
}

/**
 * Find all top-level blocks delimited by tcOpen/tcClose using depth-aware matching.
 * Handles nested XML correctly by tracking open/close tag depth.
 */
function findToolCallBlocks(text: string): Array<{ name: string; body: string }> {
  if (!tcOpen || !tcClose) return [];

  const blocks: Array<{ name: string; body: string }> = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const openIdx = text.indexOf(tcOpen, searchFrom);
    if (openIdx === -1) break;

    // Extract the name attribute from the opening tag
    const afterOpen = text.slice(openIdx + tcOpen.length);
    const nameMatch = afterOpen.match(/^\s+name="(\w+)"/);
    if (!nameMatch) {
      searchFrom = openIdx + tcOpen.length;
      continue;
    }

    const name = nameMatch[1];

    // Find the matching closing tag using depth counting
    const bodyStart = openIdx + tcOpen.length + nameMatch[0].length;
    // Skip past the '>' that closes the opening tag
    const gtIdx = text.indexOf(">", bodyStart);
    if (gtIdx === -1) {
      searchFrom = openIdx + tcOpen.length;
      continue;
    }

    const contentStart = gtIdx + 1;
    let depth = 1;
    let pos = contentStart;

    while (pos < text.length && depth > 0) {
      const nextOpen = text.indexOf(tcOpen, pos);
      const nextClose = text.indexOf(tcClose, pos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + tcOpen.length;
      } else {
        depth--;
        if (depth === 0) {
          const body = text.slice(contentStart, nextClose);
          blocks.push({ name, body });
          searchFrom = nextClose + tcClose.length;
        } else {
          pos = nextClose + tcClose.length;
        }
      }
    }

    // If we didn't find a matching close, skip this open tag
    if (depth > 0) {
      searchFrom = openIdx + tcOpen.length;
    }
  }

  return blocks;
}

/**
 * Parse individual parameter tags from the body of a tool call block.
 * Each parameter is expected as: <paramName><![CDATA[value]]></paramName>
 * Falls back to plain text content if CDATA is absent.
 */
function parseParams(body: string): Record<string, any> {
  const params: Record<string, any> = {};
  // Match any XML tag with content (CDATA or plain)
  const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = paramRegex.exec(body)) !== null) {
    const [, paramName, rawContent] = match;
    // Skip the "name" attribute which is on the outer tag, not a param
    if (paramName === "name") continue;
    params[paramName] = extractCdataContent(rawContent);
  }

  return params;
}

// ─── extractToolCalls ───────────────────────────────────────
/**
 * Parse all complete tool call blocks from LLM response text.
 * Only includes calls for tools that exist in the registry.
 */
export function extractToolCalls(text: string): ToolCall[] {
  const blocks = findToolCallBlocks(text);
  const calls: ToolCall[] = [];

  for (const block of blocks) {
    if (!hasTool(block.name)) continue;

    const args = parseParams(block.body);
    calls.push({ name: block.name, args });
  }

  return calls;
}

// ─── cleanResponse ──────────────────────────────────────────
/**
 * Remove all complete tool call blocks from the response text,
 * leaving only the human-readable content.
 */
export function cleanResponse(text: string): string {
  if (!tcOpen || !tcClose) return text.trim();

  let cleaned = text;
  // Remove complete tool call blocks iteratively
  let previous = "";
  while (previous !== cleaned) {
    previous = cleaned;
    const blocks = findToolCallBlocks(cleaned);
    // Remove from end to start to preserve indices
    for (let i = blocks.length - 1; i >= 0; i--) {
      // Re-find positions since we're modifying the string
      const openIdx = cleaned.lastIndexOf(tcOpen);
      if (openIdx === -1) break;
      const closeIdx = cleaned.indexOf(tcClose, openIdx);
      if (closeIdx === -1) break;
      cleaned = cleaned.slice(0, openIdx) + cleaned.slice(closeIdx + tcClose.length);
    }
  }

  return cleaned.trim();
}

// ─── fixToolCallClosing ─────────────────────────────────────
/**
 * Fix an incomplete tool_call at the end of the response text.
 * Closes any unclosed parameter tags and adds the closing tcClose tag.
 *
 * Uses depth-aware tag counting instead of naive brace matching.
 */
export function fixToolCallClosing(text: string): string {
  if (!tcOpen || !tcClose) return text;
  if (text.indexOf(tcOpen) === -1) return text;

  // Count open vs close tags for the outer tool_call wrapper
  const openCount = countOccurrences(text, tcOpen);
  const closeCount = countOccurrences(text, tcClose);

  // All tool calls properly closed
  if (openCount <= closeCount) return text;

  // There are unclosed tool_call blocks — close them
  let fixed = text;

  // Close any unclosed inner parameter tags first
  const innerTagStack: string[] = [];
  const innerTagRegex = /<\/?(\w+)>/g;
  let m: RegExpExecArray | null;

  // Find the last tcOpen position and analyze what's after it
  const lastOpenIdx = fixed.lastIndexOf(tcOpen);
  const afterLastOpen = fixed.slice(lastOpenIdx);

  // Track inner tags after the last tcOpen
  while ((m = innerTagRegex.exec(afterLastOpen)) !== null) {
    const fullMatch = m[0];
    const tagName = m[1];
    if (fullMatch.startsWith("</")) {
      // Closing tag — pop from stack if matching
      if (innerTagStack.length > 0 && innerTagStack[innerTagStack.length - 1] === tagName) {
        innerTagStack.pop();
      }
    } else if (!fullMatch.endsWith("/>")) {
      // Opening tag (not self-closing)
      innerTagStack.push(tagName);
    }
  }

  // Close unclosed inner tags in reverse order
  for (let i = innerTagStack.length - 1; i >= 0; i--) {
    fixed += `</${innerTagStack[i]}>`;
  }

  // Add missing tcClose tags
  const missing = openCount - closeCount;
  for (let i = 0; i < missing; i++) {
    fixed += tcClose;
  }

  return fixed;
}

/**
 * Count non-overlapping occurrences of a substring.
 */
function countOccurrences(text: string, substr: string): number {
  if (!substr) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(substr, pos)) !== -1) {
    count++;
    pos += substr.length;
  }
  return count;
}

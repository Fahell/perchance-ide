/**
 * Tool call XML parser and response cleaner.
 */

import { hasTool } from "../tools/index.js";

// ─── Tag Constants (fill in manually) ───────────────────────
const tcOpen = "<tool_call";
const tcClose = "</tool_call>";

// ─── Regex (built from tag constants) ───────────────────────
const TOOL_CALL_REGEX = new RegExp(
  `${tcOpen}\\s+name="(\\w+)">\\s*(\\{.*?\\})\\s*${tcClose}`,
  "gs"
);

// ─── Types ──────────────────────────────────────────────────
export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

// ─── extractToolCalls ───────────────────────────────────────
/**
 * Parse all complete tool call blocks from LLM response text.
 * Only includes calls for tools that exist in the registry.
 */
export function extractToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  TOOL_CALL_REGEX.lastIndex = 0;

  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    const [, name, argsStr] = match;
    try {
      const args = JSON.parse(argsStr);
      if (hasTool(name)) {
        calls.push({ name, args });
      }
    } catch {
      console.warn(
        `[Agent] Failed to parse tool_call args for '${name}': ${argsStr.slice(0, 200)}`
      );
    }
  }

  return calls;
}

// ─── cleanResponse ──────────────────────────────────────────
/**
 * Remove all complete tool call blocks from the response text,
 * leaving only the human-readable content.
 */
export function cleanResponse(text: string): string {
  return text.replace(TOOL_CALL_REGEX, "").trim();
}

// ─── fixToolCallClosing ─────────────────────────────────────
/**
 * Fix an incomplete tool_call at the end of the response text.
 * Only activates when the closing tag is present (LLM explicitly tried to close).
 *
 * The LLM occasionally truncates the tool_call closing syntax:
 * - Missing closing tag
 * - Missing closing `}` in the JSON object
 *
 * This function ONLY balances XML tags and JSON braces — it NEVER
 * inspects or modifies the generated content inside the tool call.
 */
export function fixToolCallClosing(text: string): string {
  // Only fix when the LLM explicitly tried to close
  if (!tcClose || !text.includes(tcClose)) return text;

  const openPattern = new RegExp(`${tcOpen}\\s+name=`, "g");
  const closePattern = new RegExp((tcClose as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

  const openTags = (text.match(openPattern) || []).length;
  const closeTags = (text.match(closePattern) || []).length;

  // All tool calls are properly matched — no fix needed
  if (openTags <= closeTags) return text;

  // Find the last opening tag position
  const lastOpenIdx = text.lastIndexOf(tcOpen);
  if (lastOpenIdx === -1) return text;

  // Check if the last tool_call already has a matching close after it
  const afterLastOpen = text.slice(lastOpenIdx + tcOpen.length);
  if (afterLastOpen.includes(tcClose)) {
    // The last tool call is closed, but some earlier one isn't.
    // This is unusual — just add closing tag at the end as best-effort.
    return text + tcClose;
  }

  // The last tool call is dangling — count braces to close JSON too
  const openBraces = (afterLastOpen.match(/\{/g) || []).length;
  const closeBraces = (afterLastOpen.match(/\}/g) || []).length;

  let fixed = text;
  if (openBraces > closeBraces) {
    fixed += "}".repeat(openBraces - closeBraces);
  }
  fixed += tcClose;

  return fixed;
}

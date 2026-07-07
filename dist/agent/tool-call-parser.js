/**
 * Tool call XML parser — flat-tag format with CDATA support.
 *
 * Expected format:
 *   ${tcOpen}
 *     <name>read_file</name>
 *     <path><![CDATA[/src/example.ts]]></path>
 *   ${tcClose}
 *
 * Each tool parameter is its own XML tag wrapping a CDATA section.
 * The tag name MUST match the parameter name from the tool schema.
 * This eliminates JSON-in-XML parsing issues entirely.
 */
import { hasTool } from "../tools/index.js";
// ─── Tag Constants (fill in manually) ───────────────────────
const tcOpen = "<tool_call>";
const tcClose = "</tool_call>";
// ─── Helpers ────────────────────────────────────────────────
/**
 * Extract the content of a CDATA section from raw text.
 * Returns the inner text if CDATA wrappers are present, otherwise the raw text trimmed.
 */
export function extractCdataContent(raw) {
    const cdataMatch = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
    if (cdataMatch)
        return cdataMatch[1];
    return raw.trim();
}
/**
 * Find all top-level blocks delimited by tcOpen/tcClose.
 * Flat-tags format has no nesting, so simple pair matching suffices.
 * Extracts <name> from the body as a child tag, not an attribute.
 */
export function findToolCallBlocks(text) {
    if (!tcOpen || !tcClose)
        return [];
    const blocks = [];
    let searchFrom = 0;
    while (searchFrom < text.length) {
        const openIdx = text.indexOf(tcOpen, searchFrom);
        if (openIdx === -1)
            break;
        const closeIdx = text.indexOf(tcClose, openIdx + tcOpen.length);
        if (closeIdx === -1)
            break;
        const body = text.slice(openIdx + tcOpen.length, closeIdx);
        // Extract <name> from body as a child tag
        const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
        if (!nameMatch) {
            searchFrom = closeIdx + tcClose.length;
            continue;
        }
        const name = extractCdataContent(nameMatch[1]);
        blocks.push({ name, body });
        searchFrom = closeIdx + tcClose.length;
    }
    return blocks;
}
/**
 * Parse individual parameter tags from the body of a tool call block.
 * Each parameter is expected as: <paramName><![CDATA[value]]></paramName>
 * Falls back to plain text content if CDATA is absent.
 */
export function parseParams(body) {
    const params = {};
    const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;
    while ((match = paramRegex.exec(body)) !== null) {
        const [, paramName, rawContent] = match;
        // Skip "name" — it identifies the tool, not a parameter
        if (paramName === "name")
            continue;
        params[paramName] = extractCdataContent(rawContent);
    }
    return params;
}
// ─── extractToolCalls ───────────────────────────────────────
/**
 * Parse all complete tool call blocks from LLM response text.
 * Only includes calls for tools that exist in the registry.
 */
export function extractToolCalls(text) {
    const blocks = findToolCallBlocks(text);
    const calls = [];
    for (const block of blocks) {
        if (!hasTool(block.name))
            continue;
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
export function cleanResponse(text) {
    if (!tcOpen || !tcClose)
        return text.trim();
    let cleaned = text;
    let previous = "";
    while (previous !== cleaned) {
        previous = cleaned;
        const openIdx = cleaned.lastIndexOf(tcOpen);
        if (openIdx === -1)
            break;
        const closeIdx = cleaned.indexOf(tcClose, openIdx);
        if (closeIdx === -1)
            break;
        cleaned = cleaned.slice(0, openIdx) + cleaned.slice(closeIdx + tcClose.length);
    }
    return cleaned.trim();
}
// ─── fixToolCallClosing ─────────────────────────────────────
/**
 * Fix an incomplete tool_call at the end of the response text.
 * Closes any unclosed parameter tags and adds the closing tcClose tag.
 *
 * Uses tag-stack tracking for inner parameter tags.
 */
export function fixToolCallClosing(text) {
    if (!tcOpen || !tcClose)
        return text;
    if (text.indexOf(tcOpen) === -1)
        return text;
    const openCount = countOccurrences(text, tcOpen);
    const closeCount = countOccurrences(text, tcClose);
    // All tool calls properly closed
    if (openCount <= closeCount)
        return text;
    let fixed = text;
    // Close any unclosed inner parameter tags after the last tcOpen
    const lastOpenIdx = fixed.lastIndexOf(tcOpen);
    const afterLastOpen = fixed.slice(lastOpenIdx);
    const innerTagStack = [];
    const innerTagRegex = /<\/?(\w+)>/g;
    let m;
    while ((m = innerTagRegex.exec(afterLastOpen)) !== null) {
        const fullMatch = m[0];
        const tagName = m[1];
        if (fullMatch.startsWith("</")) {
            if (innerTagStack.length > 0 && innerTagStack[innerTagStack.length - 1] === tagName) {
                innerTagStack.pop();
            }
        }
        else if (!fullMatch.endsWith("/>")) {
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
function countOccurrences(text, substr) {
    if (!substr)
        return 0;
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(substr, pos)) !== -1) {
        count++;
        pos += substr.length;
    }
    return count;
}

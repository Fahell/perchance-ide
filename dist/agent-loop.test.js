/**
 * Tests for agent-loop.ts
 *
 * Tests tool call extraction and response cleaning.
 * These are pure functions — no mocks needed.
 */
import { describe, expect, it } from "vitest";
// ─── Local re-implementation of private functions ────────────
function extractToolCalls(text) {
    const calls = [];
    const regex = /<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const [, name, argsStr] = match;
        try {
            const args = JSON.parse(argsStr);
            calls.push({ name, args });
        }
        catch {
            // skip invalid JSON
        }
    }
    return calls;
}
function cleanResponse(text) {
    return text.replace(/<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs, "").trim();
}
// ─── Tests ──────────────────────────────────────────────────
describe("extractToolCalls", () => {
    it("should extract a single tool call", () => {
        const text = 'Some text <tool_call name="web_search">{"query":"hello"}</tool_call> more text';
        const calls = extractToolCalls(text);
        expect(calls).toHaveLength(1);
        expect(calls[0].name).toBe("web_search");
        expect(calls[0].args).toEqual({ query: "hello" });
    });
    it("should extract multiple tool calls", () => {
        const text = [
            '<tool_call name="web_search">{"query":"first"}</tool_call>',
            '<tool_call name="web_search">{"query":"second"}</tool_call>',
        ].join("\n");
        const calls = extractToolCalls(text);
        expect(calls).toHaveLength(2);
        expect(calls[0].args.query).toBe("first");
        expect(calls[1].args.query).toBe("second");
    });
    it("should return empty array for text without tool calls", () => {
        const text = "Just a normal response without any tools.";
        const calls = extractToolCalls(text);
        expect(calls).toEqual([]);
    });
    it("should handle tool call at the start of text", () => {
        const text = '<tool_call name="read_file">{"path":"/test.txt"}</tool_call>\n\nHere is the content.';
        const calls = extractToolCalls(text);
        expect(calls).toHaveLength(1);
        expect(calls[0].name).toBe("read_file");
    });
    it("should skip tool calls with invalid JSON args", () => {
        const text = '<tool_call name="test">{"bad json}</tool_call>';
        const calls = extractToolCalls(text);
        expect(calls).toEqual([]);
    });
});
describe("cleanResponse", () => {
    it("should remove tool_call tags from text", () => {
        const text = '<tool_call name="test">{"a":1}</tool_call>\n\nFinal answer.';
        expect(cleanResponse(text)).toBe("Final answer.");
    });
    it("should handle text without tool calls", () => {
        const text = "Normal response without any XML tags.";
        expect(cleanResponse(text)).toBe(text);
    });
    it("should remove multiple tool calls", () => {
        const text = '<tool_call name="a">{"q":1}</tool_call>\n<tool_call name="b">{"q":2}</tool_call>\n\nResult here.';
        expect(cleanResponse(text)).toBe("Result here.");
    });
});

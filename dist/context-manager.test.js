/**
 * Tests for context-manager.ts
 *
 * Tests the token estimation function (pure logic, no async).
 */
import { describe, expect, it } from "vitest";
import { estimateTokens } from "./context-manager.js";
describe("estimateTokens", () => {
    it("should estimate tokens for plain English text", () => {
        const text = "The quick brown fox jumps over the lazy dog.";
        const tokens = estimateTokens(text);
        // ~45 bytes / 4 ≈ 11 tokens
        expect(tokens).toBeGreaterThanOrEqual(5);
        expect(tokens).toBeLessThanOrEqual(20);
    });
    it("should estimate tokens for code as denser than text", () => {
        const code = `function add(a: number, b: number): number { return a + b; }`;
        const text = "The quick brown fox jumps over the lazy dog near the bank of the river.";
        // Both similar length but code has more operators
        expect(estimateTokens(code)).toBeLessThan(estimateTokens(text));
    });
    it("should return 1 for empty string", () => {
        expect(estimateTokens("")).toBe(1);
    });
    it("should handle JSON content (high operator density)", () => {
        const json = JSON.stringify({ users: [{ id: 1, name: "Alice" }] });
        const tokens = estimateTokens(json);
        expect(tokens).toBeGreaterThan(0);
    });
    it("should handle very long strings without error", () => {
        const long = "hello world ".repeat(1000);
        const tokens = estimateTokens(long);
        expect(tokens).toBeGreaterThan(100);
    });
    it("should be deterministic", () => {
        const text = "Same text every time";
        expect(estimateTokens(text)).toBe(estimateTokens(text));
    });
});

/**
 * Tests for truncate utility.
 */

import { describe, expect, it } from "vitest";
import { truncateOutput } from "./truncate.js";

describe("truncateOutput (chars mode)", () => {
  it("should return text unchanged if under limit", () => {
    const text = "Short text";
    expect(truncateOutput(text, 100)).toBe(text);
  });

  it("should truncate at last newline within 80% of limit", () => {
    const text = "line1\nline2\nline3\nline4\nline5\nline6";
    // Limit of 20 chars: first 20 chars is "line1\nline2\nline3\nl"
    // Last newline within 80% of 20 (16) is at position 5
    const result = truncateOutput(text, 20);
    expect(result).toContain("... (");
    expect(result).toContain("more characters");
  });

  it("should truncate at exact limit if no newline found", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const result = truncateOutput(text, 10);
    expect(result).toContain("... (");
  });

  it("should handle empty text", () => {
    expect(truncateOutput("", 100)).toBe("");
  });
});

describe("truncateOutput (lines mode)", () => {
  it("should return text unchanged if under line limit", () => {
    const text = "line1\nline2\nline3";
    expect(truncateOutput(text, 5, "lines")).toBe(text);
  });

  it("should truncate and show line count", () => {
    const text = "line1\nline2\nline3\nline4\nline5";
    const result = truncateOutput(text, 3, "lines");
    expect(result).toContain("... (2 more lines omitted)");
    expect(result).toContain("line1");
    expect(result).toContain("line3");
  });

  it("should handle single line text", () => {
    expect(truncateOutput("single line", 5, "lines")).toBe("single line");
  });
});

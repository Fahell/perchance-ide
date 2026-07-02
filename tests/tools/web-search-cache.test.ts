import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { webSearch, scrapeUrl, clearWebCache } from "../../src/tools/web-search.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock retryWithBackoff to just call the function directly (no retries in cache tests)
vi.mock("../../src/utils/retry.js", () => ({
  retryWithBackoff: (fn: () => Promise<Response>) => fn(),
}));

describe("Web Search TTL Cache", () => {
  beforeEach(() => {
    clearWebCache();
    mockFetch.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── webSearch cache ──────────────────────────────────────
  describe("webSearch", () => {
    const mockSearchResponse = {
      ok: true,
      json: async () => ({
        data: [
          { title: "Test", url: "https://example.com", description: "A test result" },
        ],
      }),
    };

    it("should return cached result on second identical call", async () => {
      mockFetch.mockResolvedValue(mockSearchResponse);

      const first = await webSearch("test query", 5);
      const second = await webSearch("test query", 5);

      expect(first).toEqual(second);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should NOT use cache for different queries", async () => {
      mockFetch.mockResolvedValue(mockSearchResponse);

      await webSearch("query A", 5);
      await webSearch("query B", 5);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should NOT use cache for different limits", async () => {
      mockFetch.mockResolvedValue(mockSearchResponse);

      await webSearch("same query", 3);
      await webSearch("same query", 5);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should expire cache after TTL (5 minutes)", async () => {
      mockFetch.mockResolvedValue(mockSearchResponse);

      await webSearch("expiring query", 5);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time by 4 min 59 sec — should still be cached
      vi.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);
      await webSearch("expiring query", 5);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance past TTL — cache should be expired
      vi.advanceTimersByTime(2000);
      await webSearch("expiring query", 5);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should NOT cache failed requests", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" });

      await expect(webSearch("fail query", 5)).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Retry should hit network again, not cache
      mockFetch.mockResolvedValue(mockSearchResponse);
      const result = await webSearch("fail query", 5);
      expect(result.results).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── scrapeUrl cache ──────────────────────────────────────
  describe("scrapeUrl", () => {
    const mockScrapeResponse = {
      ok: true,
      text: async () => "# Test Page\n\nSome content here.",
    };

    it("should return cached result on second identical call", async () => {
      mockFetch.mockResolvedValue(mockScrapeResponse);

      const first = await scrapeUrl("https://example.com/page", 3000);
      const second = await scrapeUrl("https://example.com/page", 3000);

      expect(first).toEqual(second);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should NOT use cache for different maxChars", async () => {
      mockFetch.mockResolvedValue(mockScrapeResponse);

      await scrapeUrl("https://example.com/page", 1000);
      await scrapeUrl("https://example.com/page", 3000);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should expire cache after TTL", async () => {
      mockFetch.mockResolvedValue(mockScrapeResponse);

      await scrapeUrl("https://example.com/expiring", 3000);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      await scrapeUrl("https://example.com/expiring", 3000);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should NOT cache failed scrape requests", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden" });

      await expect(scrapeUrl("https://example.com/fail", 3000)).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      mockFetch.mockResolvedValue(mockScrapeResponse);
      const result = await scrapeUrl("https://example.com/fail", 3000);
      expect(result.content).toContain("Some content");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── clearWebCache ────────────────────────────────────────
  describe("clearWebCache", () => {
    it("should invalidate all cached entries", async () => {
      const mockSearchResp = {
        ok: true,
        json: async () => ({ data: [{ title: "T", url: "u", description: "d" }] }),
      };
      mockFetch.mockResolvedValue(mockSearchResp);

      await webSearch("clear test", 5);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      clearWebCache();

      await webSearch("clear test", 5);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

/**
 * Tests for retryWithBackoff utility.
 */

import { describe, expect, it } from "vitest";
import { isRetryableError } from "./retry.js";

describe("isRetryableError", () => {
  it("should retry on TypeError (network error)", () => {
    expect(isRetryableError(new TypeError("fetch failed"))).toBe(true);
  });

  it("should NOT retry on AbortError", () => {
    const abortError = new DOMException("Aborted", "AbortError");
    expect(isRetryableError(abortError)).toBe(false);
  });

  it("should retry on HTTP 429 (rate limited)", () => {
    const error = Object.assign(new Error("Too Many Requests"), {
      response: { status: 429 },
    });
    expect(isRetryableError(error)).toBe(true);
  });

  it("should retry on HTTP 503 (server error)", () => {
    const error = Object.assign(new Error("Service Unavailable"), {
      response: { status: 503 },
    });
    expect(isRetryableError(error)).toBe(true);
  });

  it("should NOT retry on HTTP 404 (client error)", () => {
    const error = Object.assign(new Error("Not Found"), {
      response: { status: 404 },
    });
    expect(isRetryableError(error)).toBe(false);
  });

  it("should NOT retry on HTTP 401 (client error)", () => {
    const error = Object.assign(new Error("Unauthorized"), {
      response: { status: 401 },
    });
    expect(isRetryableError(error)).toBe(false);
  });

  it("should NOT retry on HTTP 403 (client error)", () => {
    const error = Object.assign(new Error("Forbidden"), {
      response: { status: 403 },
    });
    expect(isRetryableError(error)).toBe(false);
  });

  it("should handle non-Error objects", () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError("string error")).toBe(false);
  });

  it("should handle 500-level errors", () => {
    const error = Object.assign(new Error("Internal Server Error"), {
      response: { status: 500 },
    });
    expect(isRetryableError(error)).toBe(true);

    const error502 = Object.assign(new Error("Bad Gateway"), {
      response: { status: 502 },
    });
    expect(isRetryableError(error502)).toBe(true);
  });
});

describe("retryWithBackoff", () => {
  it("should return result on first success", async () => {
    const { retryWithBackoff } = await import("./retry.js");
    const result = await retryWithBackoff(async () => "success");
    expect(result).toBe("success");
  });

  it("should retry on failure and eventually succeed", async () => {
    const { retryWithBackoff } = await import("./retry.js");
    let attempts = 0;
    const result = await retryWithBackoff(async () => {
      attempts++;
      if (attempts < 3) throw new TypeError("network error");
      return "ok";
    }, { maxRetries: 3, initialDelay: 10 });
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("should throw after exhausting retries", async () => {
    const { retryWithBackoff } = await import("./retry.js");
    await expect(
      retryWithBackoff(async () => {
        throw new TypeError("persistent failure");
      }, { maxRetries: 2, initialDelay: 10 })
    ).rejects.toThrow("persistent failure");
  });

  it("should NOT retry on non-retryable error", async () => {
    const { retryWithBackoff } = await import("./retry.js");
    let attempts = 0;
    await expect(
      retryWithBackoff(async () => {
        attempts++;
        throw new Error("bad request");
      }, { maxRetries: 3, initialDelay: 10 })
    ).rejects.toThrow("bad request");
    expect(attempts).toBe(1); // Only tried once
  });

  it("should support cancellation via AbortSignal", async () => {
    const { retryWithBackoff } = await import("./retry.js");
    const controller = new AbortController();
    controller.abort();
    await expect(
      retryWithBackoff(async () => {
        throw new TypeError("network");
      }, { signal: controller.signal, initialDelay: 10 })
    ).rejects.toThrow();
  });
});

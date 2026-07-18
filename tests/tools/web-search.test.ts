/**
 * Unit tests for validateApiKey() — HTTP status classification into the
 * discriminated union `JinaValidationResult`.
 *
 * PR-3 audit fix: prior boolean-return collapsed 401/402/429/5xx into a
 * generic `false`. These tests verify the new contract carries a `code` that
 * downstream consumers (SettingsModal.testJinaKey) can map to localized
 * error messages.
 *
 * Strategy: vi.spyOn(global, 'fetch') with minimal Response stubs. The
 * validateApiKey function only reads `res.ok`, `res.status`, `res.statusText`,
 * so a partial stub is sufficient and avoids the cost of constructing real
 * Response objects (jsdom doesn't easily support `new Response(...)` with
 * arbitrary bodies).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { validateApiKey } from "../../src/tools/web-search.js";

function mockFetchResponse(status: number, statusText: string = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("validateApiKey — success path", () => {
  it("returns { ok: true } on HTTP 200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(200, "OK"));
    const result = await validateApiKey("valid_key");
    expect(result).toEqual({ ok: true });
  });
});

describe("validateApiKey — HTTP status → error code mapping", () => {
  it("returns code='invalid_key' on HTTP 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(401, "Unauthorized"));
    const result = await validateApiKey("bad_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_key");
      expect(result.message).toContain("401");
    }
  });

  it("returns code='invalid_key' on HTTP 403", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(403, "Forbidden"));
    const result = await validateApiKey("forbidden_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_key");
      expect(result.message).toContain("403");
    }
  });

  it("returns code='no_credit' on HTTP 402", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(402, "Payment Required"));
    const result = await validateApiKey("exhausted_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("no_credit");
      expect(result.message).toContain("402");
    }
  });

  it("returns code='rate_limited' on HTTP 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(429, "Too Many Requests"));
    const result = await validateApiKey("rate_limited_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("rate_limited");
      expect(result.message).toContain("429");
    }
  });

  it("returns code='invalid_key' on other 4xx (e.g., 404)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(404, "Not Found"));
    const result = await validateApiKey("any_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_key");
    }
  });

  it("returns code='network' on HTTP 500", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(500, "Internal Server Error"));
    const result = await validateApiKey("any_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("network");
      expect(result.message).toContain("500");
    }
  });

  it("returns code='network' on HTTP 503", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(503, "Service Unavailable"));
    const result = await validateApiKey("any_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("network");
    }
  });
});

describe("validateApiKey — network failure paths", () => {
  it("returns code='network' on TypeError (fetch failed)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await validateApiKey("any_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("network");
      expect(result.message).toContain("Failed to fetch");
    }
  });

  it("returns code='network' on DOMException AbortError (timeout)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const result = await validateApiKey("any_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("network");
    }
  });

  it("returns code='network' on generic non-Error throw", async () => {
    // Some libraries throw non-Error values; defensive: String(err)
    vi.spyOn(global, "fetch").mockImplementation(() => {
      throw "string error"; // eslint-disable-line @typescript-eslint/no-throw-literal
    });
    const result = await validateApiKey("any_key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("network");
      expect(typeof result.message).toBe("string");
    }
  });
});

describe("validateApiKey — fetch parameters", () => {
  it("POSTs to https://s.jina.ai/ with Bearer auth + JSON body", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(200, "OK"));

    await validateApiKey("token_xyz");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://s.jina.ai/");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer token_xyz");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ q: "test" }));
  });

  it("carries the supplied key in the Authorization header verbatim", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockFetchResponse(200));
    await validateApiKey("jina_user_42_secret");
    const headers = (fetchSpy.mock.calls[0][1]?.headers || {}) as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer jina_user_42_secret");
  });
});

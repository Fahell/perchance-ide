/**
 * Unit tests for makeValidationStorageKey() — randomized storageKey generator
 * used by validateBrowserPodKey() to avoid IndexedDB slot collisions when
 * multiple validations run in parallel (e.g., user double-clicks "test",
 * or two tabs validate concurrently).
 */

import { describe, expect, it } from "vitest";
import { makeValidationStorageKey } from "../../src/browserpod/manager.js";

describe("makeValidationStorageKey", () => {
  it("should return a non-empty string", () => {
    const key = makeValidationStorageKey();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  it("should always start with the validation prefix", () => {
    for (let i = 0; i < 10; i++) {
      const key = makeValidationStorageKey();
      expect(key.startsWith("agent-perchance-validate-")).toBe(true);
    }
  });

  it("should produce different values across consecutive calls", () => {
    const N = 1000;
    const seen = new Set<string>();
    for (let i = 0; i < N; i++) {
      seen.add(makeValidationStorageKey());
    }
    // Uniqueness: with ~36 bits of randomness per call, collision probability
    // across 1000 calls is negligible (~10^-7). Set should match count.
    expect(seen.size).toBe(N);
  });

  it("namespaces under the production storageKey prefix with -validate- suffix", () => {
    // The production singleton uses "agent-perchance" without the "-validate-" suffix.
    // Validation keys intentionally share the production prefix and add "-validate-<uuid>"
    // (e.g. "agent-perchance-validate-<random>") to scope them to a parallel bucket.
    const productionKey = "agent-perchance";
    for (let i = 0; i < 50; i++) {
      const key = makeValidationStorageKey();
      // Exact-collision check: the validation key must NOT be identical to the
      // production bucket name (which would otherwise shadow its IndexedDB slot).
      expect(key).not.toBe(productionKey);
      // Positive namespacing check: validation key DOES start with the validated
      // suffix pattern. IndexedDB keys are exact-match (no hierarchical prefix
      // resolution), so prefix-sharing with an extra suffix is the safe pattern
      // — verify it is preserved across randomized calls.
      expect(key.startsWith(`${productionKey}-validate-`)).toBe(true);
    }
  });
});

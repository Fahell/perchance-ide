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

  it("should not collide with the production storageKey", () => {
    // The production singleton uses "agent-perchance" without the "-validate-" suffix.
    // Validation keys should never collide with that.
    const productionKey = "agent-perchance";
    for (let i = 0; i < 50; i++) {
      const key = makeValidationStorageKey();
      expect(key).not.toBe(productionKey);
      // And should not be a prefix-with-suffix of it that could shadow the slot
      expect(key.startsWith(`${productionKey}-`)).toBe(false);
    }
  });
});

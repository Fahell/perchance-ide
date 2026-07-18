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
    // Validation keys should never collide with that bucket.
    const productionKey = "agent-perchance";
    for (let i = 0; i < 50; i++) {
      const key = makeValidationStorageKey();
      // Exact-collision check: never identical to the production bucket name.
      expect(key).not.toBe(productionKey);
      // The validation bucket IS intentionally namespaced under the production
      // prefix (e.g. "agent-perchance-validate-<uuid>"). IndexedDB keys are
      // exact-match (no prefix-shadowing), so prefix-sharing is allowed and
      // expected — verify the namespacing is present.
      expect(key.startsWith(`${productionKey}-validate-`)).toBe(true);
    }
  });
});

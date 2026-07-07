/**
 * Tests for storage.ts (localStorage wrapper)
 *
 * Uses jsdom environment which provides localStorage.
 */
import { afterEach, describe, expect, it } from "vitest";
import { storageClear, storageDel, storageGet, storageHas, storageKeys, storageSet, } from "./storage.js";
afterEach(() => {
    storageClear();
});
describe("storageSet / storageGet", () => {
    it("should set and get a string value", () => {
        storageSet("key1", "hello");
        expect(storageGet("key1")).toBe("hello");
    });
    it("should set and get a number", () => {
        storageSet("num", 42);
        expect(storageGet("num")).toBe(42);
    });
    it("should set and get an object", () => {
        const obj = { a: 1, b: "two" };
        storageSet("obj", obj);
        expect(storageGet("obj")).toEqual(obj);
    });
    it("should return undefined for missing key", () => {
        expect(storageGet("nonexistent")).toBeUndefined();
    });
    it("should set and get a null value", () => {
        storageSet("null_key", null);
        expect(storageGet("null_key")).toBeNull();
    });
});
describe("storageDel", () => {
    it("should delete a key", () => {
        storageSet("temp", "value");
        storageDel("temp");
        expect(storageGet("temp")).toBeUndefined();
    });
    it("should not throw when deleting non-existent key", () => {
        storageDel("impossible");
        expect(true).toBe(true); // No throw
    });
});
describe("storageHas", () => {
    it("should return true for existing keys", () => {
        storageSet("exists", "yes");
        expect(storageHas("exists")).toBe(true);
    });
    it("should return false for missing keys", () => {
        expect(storageHas("missing")).toBe(false);
    });
});
describe("storageKeys", () => {
    it("should return all keys", () => {
        storageSet("k1", 1);
        storageSet("k2", 2);
        const keys = storageKeys();
        expect(keys).toContain("k1");
        expect(keys).toContain("k2");
    });
    it("should return empty array when no keys", () => {
        storageClear();
        expect(storageKeys()).toEqual([]);
    });
});
describe("storageClear", () => {
    it("should remove all keys", () => {
        storageSet("a", 1);
        storageSet("b", 2);
        storageClear();
        expect(storageKeys()).toEqual([]);
        expect(storageGet("a")).toBeUndefined();
    });
});

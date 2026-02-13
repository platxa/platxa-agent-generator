import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LRUCache } from "@/lib/utils/lru-cache";

describe("LRUCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic operations", () => {
    it("get/set/has work correctly", () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });
      cache.set("a", 1);
      expect(cache.get("a")).toBe(1);
      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(false);
      expect(cache.get("b")).toBeUndefined();
    });

    it("delete removes entry and returns true", () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });
      cache.set("a", 1);
      expect(cache.delete("a")).toBe(true);
      expect(cache.has("a")).toBe(false);
      expect(cache.get("a")).toBeUndefined();
    });

    it("delete returns false for missing key", () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });
      expect(cache.delete("x")).toBe(false);
    });

    it("clear removes all entries", () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });
      cache.set("a", 1);
      cache.set("b", 2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has("a")).toBe(false);
    });

    it("size tracks correctly across set/delete/evict", () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });
      expect(cache.size).toBe(0);
      cache.set("a", 1);
      expect(cache.size).toBe(1);
      cache.set("b", 2);
      cache.set("c", 3);
      expect(cache.size).toBe(3);
      cache.set("d", 4); // evicts "a"
      expect(cache.size).toBe(3);
      cache.delete("b");
      expect(cache.size).toBe(2);
    });

    it("keys returns all keys", () => {
      const cache = new LRUCache<string, number>({ maxSize: 5 });
      cache.set("a", 1);
      cache.set("b", 2);
      const keys = [...cache.keys()];
      expect(keys).toContain("a");
      expect(keys).toContain("b");
    });

    it("set overwrites existing value for same key", () => {
      const cache = new LRUCache<string, number>({ maxSize: 5 });
      cache.set("a", 1);
      cache.set("a", 99);
      expect(cache.get("a")).toBe(99);
      expect(cache.size).toBe(1);
    });
  });

  describe("LRU eviction", () => {
    it("evicts least recently used entry when maxSize reached", () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      cache.set("d", 4); // should evict "a"

      expect(cache.has("a")).toBe(false);
      expect(cache.get("b")).toBe(2);
      expect(cache.get("c")).toBe(3);
      expect(cache.get("d")).toBe(4);
    });

    it("get() refreshes LRU order", () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 });
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Access "a" to refresh it
      cache.get("a");

      // Now "b" is LRU, should be evicted
      cache.set("d", 4);
      expect(cache.has("b")).toBe(false);
      expect(cache.has("a")).toBe(true);
    });

    it("works with maxSize=1", () => {
      const cache = new LRUCache<string, number>({ maxSize: 1 });
      cache.set("a", 1);
      expect(cache.get("a")).toBe(1);

      cache.set("b", 2);
      expect(cache.has("a")).toBe(false);
      expect(cache.get("b")).toBe(2);
      expect(cache.size).toBe(1);
    });
  });

  describe("TTL expiry", () => {
    it("entries expire after TTL on get()", () => {
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 1000 });
      cache.set("a", 1);

      vi.advanceTimersByTime(500);
      expect(cache.get("a")).toBe(1); // still fresh

      vi.advanceTimersByTime(501);
      expect(cache.get("a")).toBeUndefined(); // expired
    });

    it("entries expire after TTL on has()", () => {
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 500 });
      cache.set("a", 1);

      vi.advanceTimersByTime(600);
      expect(cache.has("a")).toBe(false);
    });

    it("entries without TTL never expire", () => {
      const cache = new LRUCache<string, number>({ maxSize: 10 });
      cache.set("a", 1);

      vi.advanceTimersByTime(999999);
      expect(cache.get("a")).toBe(1);
    });
  });

  describe("onEvict callback", () => {
    it("fires with 'evicted' reason when LRU eviction occurs", () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string, number>({ maxSize: 2, onEvict });

      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3); // evicts "a"

      expect(onEvict).toHaveBeenCalledWith("a", 1, "evicted");
    });

    it("fires with 'expired' reason on TTL expiry via get()", () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 100, onEvict });

      cache.set("x", 42);
      vi.advanceTimersByTime(200);
      cache.get("x"); // triggers expiry

      expect(onEvict).toHaveBeenCalledWith("x", 42, "expired");
    });

    it("fires with 'deleted' reason on manual delete", () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string, number>({ maxSize: 10, onEvict });

      cache.set("z", 99);
      cache.delete("z");

      expect(onEvict).toHaveBeenCalledWith("z", 99, "deleted");
    });
  });

  describe("Map API compatibility", () => {
    it("can be used as a drop-in for Map (compatible subset)", () => {
      const cache = new LRUCache<string, string>({ maxSize: 100 });

      // set returns this for chaining
      const result = cache.set("key", "value");
      expect(result).toBe(cache);

      // get returns the value
      expect(cache.get("key")).toBe("value");

      // has returns boolean
      expect(cache.has("key")).toBe(true);

      // delete returns boolean
      expect(cache.delete("key")).toBe(true);

      // size is a number
      expect(typeof cache.size).toBe("number");
    });
  });

  it("throws if maxSize < 1", () => {
    expect(() => new LRUCache({ maxSize: 0 })).toThrow("maxSize must be at least 1");
  });
});

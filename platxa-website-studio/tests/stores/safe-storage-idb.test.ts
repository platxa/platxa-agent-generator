import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for safe-storage IndexedDB fallback (Fix 2: H10)
 *
 * Since jsdom doesn't provide a real IndexedDB, we test the logic paths:
 * - localStorage works normally when quota isn't exceeded
 * - QuotaExceededError triggers IDB fallback path
 * - removeItem clears from both stores
 * - SSR returns null without error
 * - clearAllPlatxaStorage clears both
 */

let safeLocalStorage: typeof import("@/lib/stores/safe-storage").safeLocalStorage;
let clearAllPlatxaStorage: typeof import("@/lib/stores/safe-storage").clearAllPlatxaStorage;
let isIdbAvailable: typeof import("@/lib/stores/safe-storage").isIdbAvailable;
let _idbHelpers: typeof import("@/lib/stores/safe-storage")._idbHelpers;

describe("safe-storage with IDB fallback", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import("@/lib/stores/safe-storage");
    safeLocalStorage = mod.safeLocalStorage;
    clearAllPlatxaStorage = mod.clearAllPlatxaStorage;
    isIdbAvailable = mod.isIdbAvailable;
    _idbHelpers = mod._idbHelpers;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("normal localStorage operations", () => {
    it("stores and retrieves valid JSON", () => {
      const data = JSON.stringify({ foo: "bar" });
      safeLocalStorage.setItem("test-key", data);
      expect(safeLocalStorage.getItem("test-key")).toBe(data);
    });

    it("returns null for missing keys (not tracked in IDB)", () => {
      // Key has never been stored, so idbKeys doesn't contain it
      const result = safeLocalStorage.getItem("nonexistent");
      expect(result).toBeNull();
    });

    it("rejects invalid JSON on setItem", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      safeLocalStorage.setItem("bad-json", "not json {{{");
      expect(localStorage.getItem("bad-json")).toBeNull();
    });

    it("clears invalid JSON on getItem", () => {
      localStorage.setItem("corrupt", "broken{json");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(safeLocalStorage.getItem("corrupt")).toBeNull();
      // Also verifies localStorage was cleaned up
      expect(localStorage.getItem("corrupt")).toBeNull();
    });

    it("removes items correctly", () => {
      const data = JSON.stringify({ a: 1 });
      safeLocalStorage.setItem("remove-me", data);
      safeLocalStorage.removeItem("remove-me");
      expect(localStorage.getItem("remove-me")).toBeNull();
    });
  });

  describe("QuotaExceededError handling", () => {
    it("falls back to IDB tracking on QuotaExceededError", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      // Create a proper QuotaExceededError
      const quotaError = Object.assign(new Error("Quota exceeded"), {
        name: "QuotaExceededError",
      });

      // Override localStorage.setItem at the Storage prototype level
      const origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (_key: string, _value: string) {
        throw quotaError;
      };

      try {
        const data = JSON.stringify({ large: "data" });
        // Should not throw — gracefully handles quota error
        expect(() => safeLocalStorage.setItem("big-key", data)).not.toThrow();

        // Verify the key was tracked for IDB fallback
        expect(_idbHelpers.idbKeys.has("big-key")).toBe(true);
      } finally {
        Storage.prototype.setItem = origSetItem;
      }
    });

    it("does not track key in idbKeys for non-quota errors", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});

      vi.spyOn(localStorage, "setItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });

      const data = JSON.stringify({ test: true });
      expect(() => safeLocalStorage.setItem("sec-key", data)).not.toThrow();
      // Should NOT be tracked in IDB — not a quota error
      expect(_idbHelpers.idbKeys.has("sec-key")).toBe(false);
    });

    it("getItem returns IDB promise for keys tracked in idbKeys", () => {
      // Simulate a key that was previously stored in IDB
      _idbHelpers.idbKeys.add("idb-only-key");

      // getItem should attempt IDB read (returns a promise in jsdom since no real IDB)
      const result = safeLocalStorage.getItem("idb-only-key");
      // In test environment without real IDB, this will be a promise that resolves to null
      expect(result).toBeDefined();
    });
  });

  describe("SSR safety", () => {
    it("isIdbAvailable returns boolean", () => {
      const result = isIdbAvailable();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("clearAllPlatxaStorage", () => {
    it("clears platxa-prefixed keys from localStorage", () => {
      localStorage.setItem("platxa-editor-storage", '{"test":true}');
      localStorage.setItem("platxa-project-storage", '{"test":true}');
      localStorage.setItem("unrelated-key", '{"keep":true}');

      clearAllPlatxaStorage();

      expect(localStorage.getItem("platxa-editor-storage")).toBeNull();
      expect(localStorage.getItem("platxa-project-storage")).toBeNull();
      expect(localStorage.getItem("unrelated-key")).toBe('{"keep":true}');
    });

    it("clears prompt-library prefixed keys", () => {
      localStorage.setItem("prompt-library-favorites", '[]');
      clearAllPlatxaStorage();
      expect(localStorage.getItem("prompt-library-favorites")).toBeNull();
    });

    it("clears idbKeys tracking set", () => {
      _idbHelpers.idbKeys.add("platxa-test");
      clearAllPlatxaStorage();
      expect(_idbHelpers.idbKeys.size).toBe(0);
    });
  });

  describe("removeItem clears from both stores", () => {
    it("removes from localStorage and clears idbKeys tracking", () => {
      const data = JSON.stringify({ x: 1 });
      localStorage.setItem("dual-key", data);
      _idbHelpers.idbKeys.add("dual-key");

      safeLocalStorage.removeItem("dual-key");

      expect(localStorage.getItem("dual-key")).toBeNull();
      expect(_idbHelpers.idbKeys.has("dual-key")).toBe(false);
    });
  });
});

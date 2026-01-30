/**
 * Tests for Error Deduplication
 *
 * Feature #136: Implement error deduplication for repeated issues
 * Verification: Same error from multiple places collapsed into single issue with count
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ErrorDeduplicator,
  createErrorDeduplicator,
  DEFAULT_MAX_LOCATIONS,
  DEFAULT_MAX_GROUPS,
  DEFAULT_THRESHOLD_COUNT,
  DEFAULT_RATE_WINDOW,
  NORMALIZATION_PATTERNS,
  generateGroupId,
  normalizeMessage,
  extractErrorType,
  fingerprintByMessage,
  fingerprintByMessageAndType,
  fingerprintByMessageAndFile,
  fingerprintByMessageAndStack,
  hashString,
  createErrorLocation,
  isUniqueLocation,
  formatErrorGroup,
  formatDuration,
  sortByCount,
  sortByRecent,
  getOccurrencesInWindow,
  type ErrorInput,
  type ErrorGroup,
  type ErrorLocation,
} from "../../lib/preview/error-deduplicator";

// ============================================================================
// Constants
// ============================================================================

describe("Constants", () => {
  it("should have default max locations", () => {
    expect(DEFAULT_MAX_LOCATIONS).toBe(100);
  });

  it("should have default max groups", () => {
    expect(DEFAULT_MAX_GROUPS).toBe(500);
  });

  it("should have default threshold count", () => {
    expect(DEFAULT_THRESHOLD_COUNT).toBe(10);
  });

  it("should have default rate window", () => {
    expect(DEFAULT_RATE_WINDOW).toBe(60000);
  });

  it("should have normalization patterns", () => {
    expect(NORMALIZATION_PATTERNS.length).toBeGreaterThan(5);
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe("Utility Functions", () => {
  describe("generateGroupId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateGroupId();
      const id2 = generateGroupId();
      expect(id1).not.toBe(id2);
    });

    it("should start with grp-", () => {
      expect(generateGroupId().startsWith("grp-")).toBe(true);
    });
  });

  describe("normalizeMessage", () => {
    it("should replace numbers", () => {
      const normalized = normalizeMessage("Error at line 42");
      expect(normalized).toContain("<n>");
    });

    it("should replace UUIDs", () => {
      const normalized = normalizeMessage("Error for id 550e8400-e29b-41d4-a716-446655440000");
      expect(normalized).toContain("<uuid>");
    });

    it("should replace hex values", () => {
      const normalized = normalizeMessage("Memory at 0x7fff5fbff8c0");
      expect(normalized).toContain("<hex>");
    });

    it("should replace file paths", () => {
      const normalized = normalizeMessage("Error in /home/user/file.ts");
      expect(normalized).toContain("<path>");
    });

    it("should replace URLs", () => {
      const normalized = normalizeMessage("Failed to fetch https://example.com/api");
      expect(normalized).toContain("<url>");
    });

    it("should replace quoted strings", () => {
      const normalized = normalizeMessage('Cannot find "something"');
      expect(normalized).toContain('"<str>"');
    });

    it("should lowercase the result", () => {
      const normalized = normalizeMessage("ERROR MESSAGE");
      expect(normalized).toBe(normalized.toLowerCase());
    });
  });

  describe("extractErrorType", () => {
    it("should return provided type", () => {
      expect(extractErrorType({ message: "test", type: "CustomError" })).toBe("CustomError");
    });

    it("should extract from message", () => {
      expect(extractErrorType({ message: "TypeError: Cannot read property" })).toBe("TypeError");
    });

    it("should extract from stack", () => {
      expect(extractErrorType({ message: "error", stack: "ReferenceError: x is not defined" })).toBe("ReferenceError");
    });

    it("should default to Error", () => {
      expect(extractErrorType({ message: "Something went wrong" })).toBe("Error");
    });
  });

  describe("fingerprintByMessage", () => {
    it("should generate same fingerprint for same message", () => {
      const fp1 = fingerprintByMessage({ message: "Error occurred" });
      const fp2 = fingerprintByMessage({ message: "Error occurred" });
      expect(fp1).toBe(fp2);
    });

    it("should generate different fingerprints for different messages", () => {
      const fp1 = fingerprintByMessage({ message: "Error A" });
      const fp2 = fingerprintByMessage({ message: "Error B" });
      expect(fp1).not.toBe(fp2);
    });

    it("should normalize by default", () => {
      const fp1 = fingerprintByMessage({ message: "Error at line 10" });
      const fp2 = fingerprintByMessage({ message: "Error at line 20" });
      expect(fp1).toBe(fp2); // Numbers normalized to same value
    });

    it("should not normalize when disabled", () => {
      const fp1 = fingerprintByMessage({ message: "Error at line 10" }, false);
      const fp2 = fingerprintByMessage({ message: "Error at line 20" }, false);
      expect(fp1).not.toBe(fp2);
    });
  });

  describe("fingerprintByMessageAndType", () => {
    it("should include type in fingerprint", () => {
      const fp1 = fingerprintByMessageAndType({ message: "error", type: "TypeError" });
      const fp2 = fingerprintByMessageAndType({ message: "error", type: "ReferenceError" });
      expect(fp1).not.toBe(fp2);
    });
  });

  describe("fingerprintByMessageAndFile", () => {
    it("should include file in fingerprint", () => {
      const fp1 = fingerprintByMessageAndFile({ message: "error", file: "a.ts" });
      const fp2 = fingerprintByMessageAndFile({ message: "error", file: "b.ts" });
      expect(fp1).not.toBe(fp2);
    });
  });

  describe("fingerprintByMessageAndStack", () => {
    it("should include stack in fingerprint", () => {
      const fp1 = fingerprintByMessageAndStack({ message: "error", stack: "at foo()" });
      const fp2 = fingerprintByMessageAndStack({ message: "error", stack: "at bar()" });
      expect(fp1).not.toBe(fp2);
    });
  });

  describe("hashString", () => {
    it("should generate consistent hashes", () => {
      expect(hashString("test")).toBe(hashString("test"));
    });

    it("should generate different hashes for different strings", () => {
      expect(hashString("test1")).not.toBe(hashString("test2"));
    });

    it("should return hex string", () => {
      const hash = hashString("test");
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe("createErrorLocation", () => {
    it("should create location from error input", () => {
      const error: ErrorInput = {
        message: "error",
        file: "test.ts",
        line: 10,
        column: 5,
      };
      const location = createErrorLocation(error);
      expect(location.file).toBe("test.ts");
      expect(location.line).toBe(10);
      expect(location.column).toBe(5);
      expect(location.timestamp).toBeDefined();
    });
  });

  describe("isUniqueLocation", () => {
    const locations: ErrorLocation[] = [
      { file: "a.ts", line: 10, column: 5, timestamp: 1000 },
      { file: "b.ts", line: 20, column: 10, timestamp: 2000 },
    ];

    it("should return true for unique location", () => {
      const newLoc = { file: "c.ts", line: 30, column: 15, timestamp: 3000 };
      expect(isUniqueLocation(newLoc, locations)).toBe(true);
    });

    it("should return false for duplicate location", () => {
      const dupLoc = { file: "a.ts", line: 10, column: 5, timestamp: 3000 };
      expect(isUniqueLocation(dupLoc, locations)).toBe(false);
    });
  });

  describe("formatErrorGroup", () => {
    it("should format group for display", () => {
      const group: ErrorGroup = {
        fingerprint: "abc123",
        message: "Test error",
        type: "TypeError",
        count: 5,
        firstSeen: Date.now() - 60000,
        lastSeen: Date.now(),
        locations: [],
        uniqueFiles: new Set(["a.ts", "b.ts"]),
        muted: false,
        viewed: false,
      };

      const formatted = formatErrorGroup(group);
      expect(formatted).toContain("[5x]");
      expect(formatted).toContain("Test error");
      expect(formatted).toContain("TypeError");
      expect(formatted).toContain("a.ts");
    });
  });

  describe("formatDuration", () => {
    it("should format milliseconds", () => {
      expect(formatDuration(500)).toBe("500ms");
    });

    it("should format seconds", () => {
      expect(formatDuration(5000)).toBe("5s");
    });

    it("should format minutes", () => {
      expect(formatDuration(120000)).toBe("2m");
    });

    it("should format hours", () => {
      expect(formatDuration(7200000)).toBe("2h");
    });
  });

  describe("sortByCount", () => {
    it("should sort groups by count descending", () => {
      const groups: ErrorGroup[] = [
        { fingerprint: "a", message: "A", count: 5, firstSeen: 0, lastSeen: 0, locations: [], uniqueFiles: new Set(), muted: false, viewed: false },
        { fingerprint: "b", message: "B", count: 10, firstSeen: 0, lastSeen: 0, locations: [], uniqueFiles: new Set(), muted: false, viewed: false },
        { fingerprint: "c", message: "C", count: 3, firstSeen: 0, lastSeen: 0, locations: [], uniqueFiles: new Set(), muted: false, viewed: false },
      ];

      const sorted = sortByCount(groups);
      expect(sorted[0].count).toBe(10);
      expect(sorted[1].count).toBe(5);
      expect(sorted[2].count).toBe(3);
    });
  });

  describe("sortByRecent", () => {
    it("should sort groups by lastSeen descending", () => {
      const groups: ErrorGroup[] = [
        { fingerprint: "a", message: "A", count: 1, firstSeen: 0, lastSeen: 1000, locations: [], uniqueFiles: new Set(), muted: false, viewed: false },
        { fingerprint: "b", message: "B", count: 1, firstSeen: 0, lastSeen: 3000, locations: [], uniqueFiles: new Set(), muted: false, viewed: false },
        { fingerprint: "c", message: "C", count: 1, firstSeen: 0, lastSeen: 2000, locations: [], uniqueFiles: new Set(), muted: false, viewed: false },
      ];

      const sorted = sortByRecent(groups);
      expect(sorted[0].lastSeen).toBe(3000);
      expect(sorted[1].lastSeen).toBe(2000);
      expect(sorted[2].lastSeen).toBe(1000);
    });
  });

  describe("getOccurrencesInWindow", () => {
    it("should count occurrences in time window", () => {
      const now = Date.now();
      const group: ErrorGroup = {
        fingerprint: "a",
        message: "A",
        count: 5,
        firstSeen: now - 100000,
        lastSeen: now,
        locations: [
          { timestamp: now - 100000 }, // Outside window
          { timestamp: now - 50000 },  // Inside window
          { timestamp: now - 30000 },  // Inside window
          { timestamp: now - 10000 },  // Inside window
          { timestamp: now - 5000 },   // Inside window
        ],
        uniqueFiles: new Set(),
        muted: false,
        viewed: false,
      };

      const count = getOccurrencesInWindow(group, 60000);
      expect(count).toBe(4);
    });
  });
});

// ============================================================================
// ErrorDeduplicator Class
// ============================================================================

describe("ErrorDeduplicator", () => {
  let deduplicator: ErrorDeduplicator;

  beforeEach(() => {
    deduplicator = new ErrorDeduplicator();
  });

  afterEach(() => {
    deduplicator.dispose();
  });

  describe("constructor", () => {
    it("should create with default options", () => {
      expect(deduplicator.isDisposed()).toBe(false);
    });

    it("should accept custom strategy", () => {
      const d = new ErrorDeduplicator({ strategy: "message" });
      expect(d.isDisposed()).toBe(false);
      d.dispose();
    });

    it("should accept custom fingerprinter", () => {
      const d = new ErrorDeduplicator({
        strategy: "custom",
        customFingerprinter: (error) => `custom-${error.message}`,
      });
      const group = d.add({ message: "test" });
      expect(group.fingerprint).toBe("custom-test");
      d.dispose();
    });
  });

  describe("add", () => {
    it("should add new error and create group", () => {
      const group = deduplicator.add({ message: "Error occurred" });
      expect(group.fingerprint).toBeDefined();
      expect(group.message).toBe("Error occurred");
      expect(group.count).toBe(1);
    });

    it("should deduplicate same error", () => {
      deduplicator.add({ message: "Error occurred" });
      const group = deduplicator.add({ message: "Error occurred" });
      expect(group.count).toBe(2);
    });

    it("should not deduplicate different errors", () => {
      deduplicator.add({ message: "Error A" });
      deduplicator.add({ message: "Error B" });
      expect(deduplicator.getAll().length).toBe(2);
    });

    it("should deduplicate normalized messages", () => {
      deduplicator.add({ message: "Error at line 10" });
      const group = deduplicator.add({ message: "Error at line 20" });
      expect(group.count).toBe(2);
    });

    it("should track unique files", () => {
      deduplicator.add({ message: "Error", file: "a.ts" });
      const group = deduplicator.add({ message: "Error", file: "b.ts" });
      expect(group.uniqueFiles.size).toBe(2);
    });

    it("should trigger change callback", () => {
      const callback = vi.fn();
      deduplicator.onChange(callback);
      deduplicator.add({ message: "Test" });
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe("add");
    });

    it("should throw if disposed", () => {
      deduplicator.dispose();
      expect(() => deduplicator.add({ message: "Test" })).toThrow("disposed");
    });
  });

  describe("addBatch", () => {
    it("should add multiple errors", () => {
      const groups = deduplicator.addBatch([
        { message: "TypeError occurred" },
        { message: "NetworkError occurred" },
        { message: "TypeError occurred" }, // Duplicate
      ]);
      expect(groups.length).toBe(3);
      expect(deduplicator.getAll().length).toBe(2);
    });
  });

  describe("get", () => {
    it("should get group by fingerprint", () => {
      const added = deduplicator.add({ message: "Test" });
      const retrieved = deduplicator.get(added.fingerprint);
      expect(retrieved).toEqual(added);
    });

    it("should return undefined for unknown fingerprint", () => {
      expect(deduplicator.get("unknown")).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("should return all groups", () => {
      deduplicator.add({ message: "TypeError occurred" });
      deduplicator.add({ message: "ReferenceError occurred" });
      expect(deduplicator.getAll().length).toBe(2);
    });
  });

  describe("getMostFrequent", () => {
    beforeEach(() => {
      // Add errors with different counts
      for (let i = 0; i < 5; i++) deduplicator.add({ message: "Error A" });
      for (let i = 0; i < 10; i++) deduplicator.add({ message: "Error B" });
      for (let i = 0; i < 3; i++) deduplicator.add({ message: "Error C" });
    });

    it("should return groups sorted by count", () => {
      const frequent = deduplicator.getMostFrequent();
      expect(frequent[0].count).toBe(10);
      expect(frequent[1].count).toBe(5);
      expect(frequent[2].count).toBe(3);
    });

    it("should respect limit", () => {
      const frequent = deduplicator.getMostFrequent(2);
      expect(frequent.length).toBe(2);
    });
  });

  describe("getMostRecent", () => {
    it("should return groups sorted by last seen", async () => {
      deduplicator.add({ message: "Error A" });
      await new Promise((r) => setTimeout(r, 10));
      deduplicator.add({ message: "Error B" });

      const recent = deduplicator.getMostRecent();
      expect(recent[0].message).toBe("Error B");
    });
  });

  describe("getAboveThreshold", () => {
    it("should return groups above threshold", () => {
      const d = new ErrorDeduplicator({ thresholdCount: 5 });
      for (let i = 0; i < 6; i++) d.add({ message: "Frequent error" });
      for (let i = 0; i < 3; i++) d.add({ message: "Rare error" });

      const above = d.getAboveThreshold();
      expect(above.length).toBe(1);
      expect(above[0].count).toBe(6);

      d.dispose();
    });
  });

  describe("getUnviewed", () => {
    it("should return only unviewed groups", () => {
      const group1 = deduplicator.add({ message: "TypeError occurred" });
      deduplicator.add({ message: "SyntaxError occurred" });

      deduplicator.markViewed(group1.fingerprint);

      const unviewed = deduplicator.getUnviewed();
      expect(unviewed.length).toBe(1);
      expect(unviewed[0].message).toBe("SyntaxError occurred");
    });
  });

  describe("getUnmuted", () => {
    it("should return only unmuted groups", () => {
      const group1 = deduplicator.add({ message: "TypeError occurred" });
      deduplicator.add({ message: "RangeError occurred" });

      deduplicator.mute(group1.fingerprint);

      const unmuted = deduplicator.getUnmuted();
      expect(unmuted.length).toBe(1);
      expect(unmuted[0].message).toBe("RangeError occurred");
    });
  });

  describe("markViewed", () => {
    it("should mark group as viewed", () => {
      const group = deduplicator.add({ message: "Test" });
      expect(group.viewed).toBe(false);
      deduplicator.markViewed(group.fingerprint);
      expect(deduplicator.get(group.fingerprint)?.viewed).toBe(true);
    });

    it("should return false for unknown fingerprint", () => {
      expect(deduplicator.markViewed("unknown")).toBe(false);
    });
  });

  describe("markAllViewed", () => {
    it("should mark all groups as viewed", () => {
      deduplicator.add({ message: "TypeError occurred" });
      deduplicator.add({ message: "NetworkError occurred" });

      const count = deduplicator.markAllViewed();
      expect(count).toBe(2);
      expect(deduplicator.getUnviewed().length).toBe(0);
    });
  });

  describe("mute/unmute", () => {
    it("should mute and unmute group", () => {
      const group = deduplicator.add({ message: "Test" });

      deduplicator.mute(group.fingerprint);
      expect(deduplicator.get(group.fingerprint)?.muted).toBe(true);

      deduplicator.unmute(group.fingerprint);
      expect(deduplicator.get(group.fingerprint)?.muted).toBe(false);
    });
  });

  describe("remove", () => {
    it("should remove group", () => {
      const group = deduplicator.add({ message: "Test" });
      const result = deduplicator.remove(group.fingerprint);
      expect(result).toBe(true);
      expect(deduplicator.get(group.fingerprint)).toBeUndefined();
    });

    it("should return false for unknown fingerprint", () => {
      expect(deduplicator.remove("unknown")).toBe(false);
    });

    it("should throw if disposed", () => {
      const group = deduplicator.add({ message: "Test" });
      deduplicator.dispose();
      expect(() => deduplicator.remove(group.fingerprint)).toThrow("disposed");
    });
  });

  describe("clear", () => {
    it("should clear all groups", () => {
      deduplicator.add({ message: "TypeError occurred" });
      deduplicator.add({ message: "NetworkError occurred" });
      deduplicator.clear();
      expect(deduplicator.getAll().length).toBe(0);
    });

    it("should trigger change callback", () => {
      deduplicator.add({ message: "Test" });
      const callback = vi.fn();
      deduplicator.onChange(callback);
      deduplicator.clear();
      expect(callback.mock.calls[0][0].type).toBe("clear");
    });

    it("should throw if disposed", () => {
      deduplicator.dispose();
      expect(() => deduplicator.clear()).toThrow("disposed");
    });
  });

  describe("getStats", () => {
    it("should return statistics", () => {
      for (let i = 0; i < 5; i++) deduplicator.add({ message: "TypeError: Error", type: "TypeError" });
      for (let i = 0; i < 3; i++) deduplicator.add({ message: "ReferenceError: Error", type: "ReferenceError" });

      const stats = deduplicator.getStats();
      expect(stats.totalErrors).toBe(8);
      expect(stats.uniqueGroups).toBe(2);
      expect(stats.deduplicationRatio).toBe(0.75);
      expect(stats.mostFrequentCount).toBe(5);
      expect(stats.byType.get("TypeError")).toBe(5);
      expect(stats.byType.get("ReferenceError")).toBe(3);
    });
  });

  describe("onChange", () => {
    it("should subscribe to changes", () => {
      const callback = vi.fn();
      deduplicator.onChange(callback);
      deduplicator.add({ message: "Test" });
      expect(callback).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = deduplicator.onChange(callback);
      unsubscribe();
      deduplicator.add({ message: "Test" });
      expect(callback).not.toHaveBeenCalled();
    });

    it("should catch callback errors", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      deduplicator.onChange(() => {
        throw new Error("Callback error");
      });
      deduplicator.add({ message: "Test" });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("should throw if disposed", () => {
      deduplicator.dispose();
      expect(() => deduplicator.onChange(() => {})).toThrow("disposed");
    });
  });

  describe("onThreshold", () => {
    it("should trigger when threshold reached", () => {
      const d = new ErrorDeduplicator({ thresholdCount: 3 });
      const callback = vi.fn();
      d.onThreshold(callback);

      d.add({ message: "Error" });
      d.add({ message: "Error" });
      expect(callback).not.toHaveBeenCalled();

      d.add({ message: "Error" });
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].count).toBe(3);

      d.dispose();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = deduplicator.onThreshold(callback);
      unsubscribe();
      // Add enough to trigger threshold
      for (let i = 0; i < 15; i++) {
        deduplicator.add({ message: "Error" });
      }
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      deduplicator.dispose();
      expect(() => deduplicator.onThreshold(() => {})).toThrow("disposed");
    });
  });

  describe("max groups enforcement", () => {
    it("should remove oldest group when max reached", () => {
      const d = new ErrorDeduplicator({ maxGroups: 3 });

      d.add({ message: "TypeError occurred" });
      d.add({ message: "SyntaxError occurred" });
      d.add({ message: "RangeError occurred" });
      d.add({ message: "ReferenceError occurred" });

      expect(d.getAll().length).toBe(3);
      // TypeError should be removed (oldest)
      expect(d.getAll().some((g) => g.message === "TypeError occurred")).toBe(false);

      d.dispose();
    });
  });

  describe("isDisposed", () => {
    it("should return false when not disposed", () => {
      expect(deduplicator.isDisposed()).toBe(false);
    });

    it("should return true when disposed", () => {
      deduplicator.dispose();
      expect(deduplicator.isDisposed()).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should clear groups and callbacks", () => {
      deduplicator.add({ message: "Test" });
      deduplicator.onChange(() => {});
      deduplicator.dispose();
      expect(deduplicator.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      deduplicator.dispose();
      expect(() => deduplicator.dispose()).not.toThrow();
    });
  });
});

// ============================================================================
// Factory Function
// ============================================================================

describe("createErrorDeduplicator", () => {
  it("should create ErrorDeduplicator instance", () => {
    const d = createErrorDeduplicator();
    expect(d).toBeInstanceOf(ErrorDeduplicator);
    d.dispose();
  });

  it("should pass options to constructor", () => {
    const d = createErrorDeduplicator({ thresholdCount: 5 });
    expect(d.isDisposed()).toBe(false);
    d.dispose();
  });
});

// ============================================================================
// Integration: Same error collapsed with count
// ============================================================================

describe("Integration: Same error from multiple places collapsed with count", () => {
  it("should collapse same error from different files", () => {
    const d = createErrorDeduplicator();

    d.add({ message: "Cannot read property 'x' of undefined", file: "a.ts", line: 10 });
    d.add({ message: "Cannot read property 'x' of undefined", file: "b.ts", line: 20 });
    d.add({ message: "Cannot read property 'x' of undefined", file: "c.ts", line: 30 });

    const groups = d.getAll();
    expect(groups.length).toBe(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].uniqueFiles.size).toBe(3);
    expect(groups[0].locations.length).toBe(3);

    d.dispose();
  });

  it("should collapse errors with normalized numbers", () => {
    const d = createErrorDeduplicator();

    d.add({ message: "Error processing item 1" });
    d.add({ message: "Error processing item 2" });
    d.add({ message: "Error processing item 3" });

    expect(d.getAll().length).toBe(1);
    expect(d.getAll()[0].count).toBe(3);

    d.dispose();
  });

  it("should keep different error types separate", () => {
    const d = createErrorDeduplicator();

    d.add({ message: "Cannot read property", type: "TypeError" });
    d.add({ message: "Cannot read property", type: "ReferenceError" });

    expect(d.getAll().length).toBe(2);

    d.dispose();
  });

  it("should track first and last seen timestamps", async () => {
    const d = createErrorDeduplicator();

    d.add({ message: "Error" });
    await new Promise((r) => setTimeout(r, 50));
    d.add({ message: "Error" });

    const group = d.getAll()[0];
    expect(group.lastSeen).toBeGreaterThan(group.firstSeen);

    d.dispose();
  });

  it("should show deduplication ratio in stats", () => {
    const d = createErrorDeduplicator();

    // Add 10 errors, 5 unique
    for (let i = 0; i < 3; i++) d.add({ message: "Error A" });
    for (let i = 0; i < 4; i++) d.add({ message: "Error B" });
    d.add({ message: "Error C" });
    d.add({ message: "Error D" });
    d.add({ message: "Error E" });

    const stats = d.getStats();
    expect(stats.totalErrors).toBe(10);
    expect(stats.uniqueGroups).toBe(5);
    expect(stats.deduplicationRatio).toBe(0.5); // 5 unique out of 10 = 50% deduplication

    d.dispose();
  });
});

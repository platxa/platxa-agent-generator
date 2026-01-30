/**
 * Tests for Multi-Fix Batching for Related Errors
 *
 * Feature #150: Add multi-fix batching for related errors
 * Verification: Related errors (same file, same cause) fixed together
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MultiFixBatcher,
  createMultiFixBatcher,
  DEFAULT_MIN_CONFIDENCE,
  DEFAULT_MAX_GROUP_SIZE,
  RELATION_PRIORITY,
  isSameFile,
  isSameCause,
  isSameType,
  isCascading,
  messageSimilarity,
  detectRelation,
  detectAllRelations,
  detectFixConflict,
  sortFixesByDependency,
  groupErrors,
  createBatchedFix,
  type BatchableError,
  type BatchableFix,
  type ErrorRelation,
  type ErrorGroup,
} from "../../lib/preview/multi-fix-batcher";

// ============================================================================
// Test Utilities
// ============================================================================

function createError(overrides: Partial<BatchableError> = {}): BatchableError {
  return {
    id: `err-${Math.random().toString(36).slice(2, 9)}`,
    message: "Test error message",
    timestamp: Date.now(),
    ...overrides,
  };
}

function createFix(overrides: Partial<BatchableFix> = {}): BatchableFix {
  return {
    id: `fix-${Math.random().toString(36).slice(2, 9)}`,
    errorId: "err-1",
    description: "Test fix description",
    ...overrides,
  };
}

// ============================================================================
// Constants Tests
// ============================================================================

describe("Multi-Fix Batcher Constants", () => {
  it("should have correct default minimum confidence", () => {
    expect(DEFAULT_MIN_CONFIDENCE).toBe(0.6);
  });

  it("should have correct default max group size", () => {
    expect(DEFAULT_MAX_GROUP_SIZE).toBe(10);
  });

  it("should have relation priorities with same-cause as highest", () => {
    expect(RELATION_PRIORITY["same-cause"]).toBe(0);
    expect(RELATION_PRIORITY["cascading"]).toBe(1);
    expect(RELATION_PRIORITY["same-file"]).toBe(2);
    expect(RELATION_PRIORITY["same-type"]).toBe(3);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("isSameFile", () => {
  it("should return true for errors in same file", () => {
    const a = createError({ file: "/src/app.ts" });
    const b = createError({ file: "/src/app.ts" });
    expect(isSameFile(a, b)).toBe(true);
  });

  it("should return false for errors in different files", () => {
    const a = createError({ file: "/src/app.ts" });
    const b = createError({ file: "/src/utils.ts" });
    expect(isSameFile(a, b)).toBe(false);
  });

  it("should return false when either file is missing", () => {
    const a = createError({ file: "/src/app.ts" });
    const b = createError({});
    expect(isSameFile(a, b)).toBe(false);
    expect(isSameFile(b, a)).toBe(false);
  });

  it("should return false when both files are missing", () => {
    const a = createError({});
    const b = createError({});
    expect(isSameFile(a, b)).toBe(false);
  });
});

describe("isSameCause", () => {
  it("should return true for same causeId", () => {
    const a = createError({ causeId: "missing-import" });
    const b = createError({ causeId: "missing-import" });
    expect(isSameCause(a, b)).toBe(true);
  });

  it("should return false for different causeIds", () => {
    const a = createError({ causeId: "missing-import" });
    const b = createError({ causeId: "type-error" });
    expect(isSameCause(a, b)).toBe(false);
  });

  it("should return true for same type with similar messages", () => {
    const a = createError({
      type: "TypeError",
      message: "Cannot read property 'foo' of undefined",
    });
    const b = createError({
      type: "TypeError",
      message: "Cannot read property 'bar' of undefined",
    });
    expect(isSameCause(a, b)).toBe(true);
  });

  it("should return false for same type with different messages", () => {
    const a = createError({
      type: "TypeError",
      message: "Cannot read property of undefined",
    });
    const b = createError({
      type: "TypeError",
      message: "Network request failed with status 500",
    });
    expect(isSameCause(a, b)).toBe(false);
  });
});

describe("isSameType", () => {
  it("should return true for same error types", () => {
    const a = createError({ type: "TypeError" });
    const b = createError({ type: "TypeError" });
    expect(isSameType(a, b)).toBe(true);
  });

  it("should return false for different error types", () => {
    const a = createError({ type: "TypeError" });
    const b = createError({ type: "SyntaxError" });
    expect(isSameType(a, b)).toBe(false);
  });

  it("should return false when either type is missing", () => {
    const a = createError({ type: "TypeError" });
    const b = createError({});
    expect(isSameType(a, b)).toBe(false);
  });
});

describe("isCascading", () => {
  it("should return true for cascading errors in same file", () => {
    const now = Date.now();
    const a = createError({
      file: "/src/app.ts",
      line: 10,
      type: "TypeError",
      timestamp: now,
    });
    const b = createError({
      file: "/src/app.ts",
      line: 20,
      type: "TypeError",
      timestamp: now + 100,
    });
    expect(isCascading(a, b)).toBe(true);
  });

  it("should return false when second error occurred first", () => {
    const now = Date.now();
    const a = createError({
      file: "/src/app.ts",
      line: 10,
      timestamp: now + 100,
    });
    const b = createError({
      file: "/src/app.ts",
      line: 20,
      timestamp: now,
    });
    expect(isCascading(a, b)).toBe(false);
  });

  it("should return false for different files", () => {
    const now = Date.now();
    const a = createError({
      file: "/src/app.ts",
      line: 10,
      timestamp: now,
    });
    const b = createError({
      file: "/src/utils.ts",
      line: 20,
      timestamp: now + 100,
    });
    expect(isCascading(a, b)).toBe(false);
  });

  it("should return false when first error is on later line", () => {
    const now = Date.now();
    const a = createError({
      file: "/src/app.ts",
      line: 30,
      type: "TypeError",
      timestamp: now,
    });
    const b = createError({
      file: "/src/app.ts",
      line: 10,
      type: "TypeError",
      timestamp: now + 100,
    });
    expect(isCascading(a, b)).toBe(false);
  });
});

describe("messageSimilarity", () => {
  it("should return 1 for identical messages", () => {
    expect(messageSimilarity("Error occurred", "Error occurred")).toBe(1);
  });

  it("should return 0 for completely different messages", () => {
    expect(messageSimilarity("TypeError in module", "Network failure detected")).toBeLessThan(0.3);
  });

  it("should return high similarity for similar messages", () => {
    const similarity = messageSimilarity(
      "Cannot read property 'foo' of undefined",
      "Cannot read property 'bar' of undefined"
    );
    expect(similarity).toBeGreaterThan(0.6);
  });

  it("should return 0 for empty messages", () => {
    expect(messageSimilarity("", "")).toBe(0);
    expect(messageSimilarity("Error", "")).toBe(0);
    expect(messageSimilarity("", "Error")).toBe(0);
  });

  it("should be case insensitive", () => {
    expect(messageSimilarity("ERROR OCCURRED", "error occurred")).toBe(1);
  });
});

// ============================================================================
// Relation Detection Tests
// ============================================================================

describe("detectRelation", () => {
  it("should detect same-cause relation", () => {
    const a = createError({ causeId: "missing-import" });
    const b = createError({ causeId: "missing-import" });
    const relation = detectRelation(a, b);
    expect(relation).not.toBeNull();
    expect(relation!.type).toBe("same-cause");
    expect(relation!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("should detect cascading relation", () => {
    const now = Date.now();
    // IMPORTANT: Use DIFFERENT messages with low similarity to avoid same-cause detection
    const a = createError({
      file: "/src/app.ts",
      line: 10,
      type: "TypeError",
      message: "Variable x is undefined",
      timestamp: now,
    });
    const b = createError({
      file: "/src/app.ts",
      line: 20,
      type: "TypeError",
      message: "Function call failed due to missing argument",
      timestamp: now + 100,
    });
    const relation = detectRelation(a, b);
    expect(relation).not.toBeNull();
    expect(relation!.type).toBe("cascading");
    expect(relation!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("should detect same-file relation", () => {
    // Different types with different messages to avoid same-cause
    const a = createError({
      file: "/src/app.ts",
      type: "SyntaxError",
      message: "Unexpected token at position 42",
    });
    const b = createError({
      file: "/src/app.ts",
      type: "TypeError",
      message: "Cannot call method on null reference",
    });
    const relation = detectRelation(a, b);
    expect(relation).not.toBeNull();
    expect(relation!.type).toBe("same-file");
    expect(relation!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("should detect same-type relation", () => {
    // Same type but VERY different messages (low similarity) to avoid same-cause
    const a = createError({
      file: "/src/a.ts",
      type: "TypeError",
      message: "Cannot read property of undefined",
    });
    const b = createError({
      file: "/src/b.ts",
      type: "TypeError",
      message: "Invalid argument type passed to function",
    });
    const relation = detectRelation(a, b);
    expect(relation).not.toBeNull();
    expect(relation!.type).toBe("same-type");
    expect(relation!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("should return null for unrelated errors", () => {
    const a = createError({
      file: "/src/a.ts",
      type: "TypeError",
      message: "Type error in component",
    });
    const b = createError({
      file: "/src/b.ts",
      type: "SyntaxError",
      message: "Syntax error in stylesheet",
    });
    const relation = detectRelation(a, b);
    expect(relation).toBeNull();
  });
});

describe("detectAllRelations", () => {
  it("should detect all relations between errors", () => {
    const errors = [
      createError({ id: "e1", file: "/src/app.ts", type: "TypeError" }),
      createError({ id: "e2", file: "/src/app.ts", type: "SyntaxError" }),
      createError({ id: "e3", file: "/src/utils.ts", type: "TypeError" }),
    ];
    const relations = detectAllRelations(errors);
    // e1-e2: same-file, e1-e3: same-type
    expect(relations.length).toBeGreaterThanOrEqual(2);
  });

  it("should return empty array for single error", () => {
    const errors = [createError({ id: "e1" })];
    const relations = detectAllRelations(errors);
    expect(relations).toEqual([]);
  });

  it("should return empty array for no errors", () => {
    const relations = detectAllRelations([]);
    expect(relations).toEqual([]);
  });
});

// ============================================================================
// Fix Conflict Detection Tests
// ============================================================================

describe("detectFixConflict", () => {
  it("should detect explicit conflict", () => {
    const a = createFix({ id: "fix-a", conflictsWith: ["fix-b"] });
    const b = createFix({ id: "fix-b" });
    const result = detectFixConflict(a, b);
    expect(result.conflicts).toBe(true);
    expect(result.reason).toContain("Explicitly declared");
  });

  it("should detect overlapping line ranges", () => {
    const a = createFix({
      file: "/src/app.ts",
      startLine: 10,
      endLine: 20,
    });
    const b = createFix({
      file: "/src/app.ts",
      startLine: 15,
      endLine: 25,
    });
    const result = detectFixConflict(a, b);
    expect(result.conflicts).toBe(true);
    expect(result.reason).toContain("Overlapping");
  });

  it("should not conflict with non-overlapping ranges", () => {
    const a = createFix({
      file: "/src/app.ts",
      startLine: 10,
      endLine: 20,
    });
    const b = createFix({
      file: "/src/app.ts",
      startLine: 25,
      endLine: 30,
    });
    const result = detectFixConflict(a, b);
    expect(result.conflicts).toBe(false);
  });

  it("should not conflict with different files", () => {
    const a = createFix({
      file: "/src/app.ts",
      startLine: 10,
      endLine: 20,
    });
    const b = createFix({
      file: "/src/utils.ts",
      startLine: 10,
      endLine: 20,
    });
    const result = detectFixConflict(a, b);
    expect(result.conflicts).toBe(false);
  });
});

// ============================================================================
// Fix Sorting Tests
// ============================================================================

describe("sortFixesByDependency", () => {
  it("should sort by dependencies (topological sort)", () => {
    const fixes = [
      createFix({ id: "fix-c", dependsOn: ["fix-b"] }),
      createFix({ id: "fix-a" }),
      createFix({ id: "fix-b", dependsOn: ["fix-a"] }),
    ];
    const sorted = sortFixesByDependency(fixes);
    const ids = sorted.map((f) => f.id);
    expect(ids.indexOf("fix-a")).toBeLessThan(ids.indexOf("fix-b"));
    expect(ids.indexOf("fix-b")).toBeLessThan(ids.indexOf("fix-c"));
  });

  it("should handle fixes with no dependencies", () => {
    const fixes = [
      createFix({ id: "fix-a" }),
      createFix({ id: "fix-b" }),
      createFix({ id: "fix-c" }),
    ];
    const sorted = sortFixesByDependency(fixes);
    expect(sorted.length).toBe(3);
  });

  it("should handle circular dependencies gracefully", () => {
    const fixes = [
      createFix({ id: "fix-a", dependsOn: ["fix-c"] }),
      createFix({ id: "fix-b", dependsOn: ["fix-a"] }),
      createFix({ id: "fix-c", dependsOn: ["fix-b"] }),
    ];
    const sorted = sortFixesByDependency(fixes);
    expect(sorted.length).toBe(3);
    // All fixes should be present despite circular dependency
    expect(sorted.map((f) => f.id).sort()).toEqual(["fix-a", "fix-b", "fix-c"]);
  });

  it("should sort by priority for circular dependencies", () => {
    const fixes = [
      createFix({ id: "fix-a", dependsOn: ["fix-b"], priority: 2 }),
      createFix({ id: "fix-b", dependsOn: ["fix-a"], priority: 1 }),
    ];
    const sorted = sortFixesByDependency(fixes);
    // Lower priority should come first
    expect(sorted[0].priority).toBe(1);
  });
});

// ============================================================================
// Error Grouping Tests
// ============================================================================

describe("groupErrors", () => {
  it("should group errors by same file", () => {
    const errors = [
      createError({ id: "e1", file: "/src/app.ts" }),
      createError({ id: "e2", file: "/src/app.ts" }),
      createError({ id: "e3", file: "/src/utils.ts" }),
    ];
    const relations = detectAllRelations(errors);
    const groups = groupErrors(errors, relations);

    // e1 and e2 should be grouped together
    const groupWithApp = groups.find((g) => g.sharedFile === "/src/app.ts");
    expect(groupWithApp).toBeDefined();
    expect(groupWithApp!.errorIds).toContain("e1");
    expect(groupWithApp!.errorIds).toContain("e2");
  });

  it("should respect minimum confidence threshold", () => {
    // Use VERY different messages to get same-type relation (0.5 confidence)
    // not same-cause relation (0.9 confidence)
    const errors = [
      createError({
        id: "e1",
        type: "TypeError",
        message: "Cannot read property of undefined",
      }),
      createError({
        id: "e2",
        type: "TypeError",
        message: "Invalid function argument received",
      }),
    ];
    const relations = detectAllRelations(errors);

    // Verify we got same-type (0.5), not same-cause (0.9)
    expect(relations.length).toBe(1);
    expect(relations[0].type).toBe("same-type");
    expect(relations[0].confidence).toBe(0.5);

    // High threshold (0.8) - same-type (0.5 confidence) should be filtered out
    const groupsHigh = groupErrors(errors, relations, 0.8);
    expect(groupsHigh.length).toBe(0);

    // Low threshold (0.4) - same-type (0.5 confidence) should be included
    const groupsLow = groupErrors(errors, relations, 0.4);
    expect(groupsLow.length).toBe(1);
  });

  it("should not create single-error groups", () => {
    const errors = [
      createError({ id: "e1", file: "/src/a.ts", type: "TypeError" }),
      createError({ id: "e2", file: "/src/b.ts", type: "SyntaxError" }),
      createError({ id: "e3", file: "/src/c.ts", type: "ReferenceError" }),
    ];
    const relations = detectAllRelations(errors);
    const groups = groupErrors(errors, relations);

    // All groups should have more than one error
    groups.forEach((g) => {
      expect(g.errorIds.length).toBeGreaterThan(1);
    });
  });

  it("should use connected components for transitive grouping", () => {
    const errors = [
      createError({ id: "e1", file: "/src/app.ts", type: "TypeError" }),
      createError({ id: "e2", file: "/src/app.ts", type: "SyntaxError" }), // same file as e1
      createError({ id: "e3", file: "/src/utils.ts", type: "SyntaxError" }), // same type as e2
    ];
    const relations = detectAllRelations(errors);
    const groups = groupErrors(errors, relations);

    // All three should be in one group via transitivity
    const allInOne = groups.some((g) =>
      g.errorIds.includes("e1") &&
      g.errorIds.includes("e2") &&
      g.errorIds.includes("e3")
    );
    expect(allInOne).toBe(true);
  });
});

// ============================================================================
// Batched Fix Creation Tests
// ============================================================================

describe("createBatchedFix", () => {
  it("should create batched fix from group", () => {
    const group: ErrorGroup = {
      id: "grp-1",
      name: "Errors in /src/app.ts",
      errorIds: ["e1", "e2"],
      relationType: "same-file",
      sharedFile: "/src/app.ts",
      confidence: 0.7,
    };
    const fixes = [
      createFix({ id: "fix-1", errorId: "e1", file: "/src/app.ts" }),
      createFix({ id: "fix-2", errorId: "e2", file: "/src/app.ts" }),
    ];
    const batch = createBatchedFix(group, fixes);

    expect(batch.groupId).toBe("grp-1");
    expect(batch.fixes.length).toBe(2);
    expect(batch.files).toContain("/src/app.ts");
  });

  it("should detect conflicts in batch", () => {
    const group: ErrorGroup = {
      id: "grp-1",
      name: "Conflicting fixes",
      errorIds: ["e1", "e2"],
      relationType: "same-file",
      confidence: 0.7,
    };
    const fixes = [
      createFix({
        id: "fix-1",
        errorId: "e1",
        file: "/src/app.ts",
        startLine: 10,
        endLine: 20,
        description: "Fix type error",
      }),
      createFix({
        id: "fix-2",
        errorId: "e2",
        file: "/src/app.ts",
        startLine: 15,
        endLine: 25,
        description: "Fix syntax error",
      }),
    ];
    const batch = createBatchedFix(group, fixes, true);

    expect(batch.hasConflicts).toBe(true);
    expect(batch.conflicts.length).toBeGreaterThan(0);
  });

  it("should calculate total lines changed", () => {
    const group: ErrorGroup = {
      id: "grp-1",
      name: "Test group",
      errorIds: ["e1", "e2"],
      relationType: "same-file",
      confidence: 0.7,
    };
    const fixes = [
      createFix({
        id: "fix-1",
        errorId: "e1",
        startLine: 10,
        endLine: 15,
      }),
      createFix({
        id: "fix-2",
        errorId: "e2",
        startLine: 20,
        endLine: 25,
      }),
    ];
    const batch = createBatchedFix(group, fixes);

    // (15-10+1) + (25-20+1) = 6 + 6 = 12
    expect(batch.totalLinesChanged).toBe(12);
  });

  it("should set orderMatters when fixes have dependencies", () => {
    const group: ErrorGroup = {
      id: "grp-1",
      name: "Test group",
      errorIds: ["e1", "e2"],
      relationType: "same-cause",
      confidence: 0.9,
    };
    const fixes = [
      createFix({ id: "fix-1", errorId: "e1" }),
      createFix({ id: "fix-2", errorId: "e2", dependsOn: ["fix-1"] }),
    ];
    const batch = createBatchedFix(group, fixes);

    expect(batch.orderMatters).toBe(true);
  });
});

// ============================================================================
// MultiFixBatcher Class Tests
// ============================================================================

describe("MultiFixBatcher", () => {
  let batcher: MultiFixBatcher;

  beforeEach(() => {
    batcher = createMultiFixBatcher();
  });

  afterEach(() => {
    batcher.dispose();
  });

  describe("batch", () => {
    it("should batch related errors together", () => {
      const errors = [
        createError({ id: "e1", file: "/src/app.ts", type: "TypeError" }),
        createError({ id: "e2", file: "/src/app.ts", type: "SyntaxError" }),
        createError({ id: "e3", file: "/src/utils.ts", type: "ReferenceError" }),
      ];
      const fixes = [
        createFix({ id: "fix-1", errorId: "e1" }),
        createFix({ id: "fix-2", errorId: "e2" }),
        createFix({ id: "fix-3", errorId: "e3" }),
      ];

      const result = batcher.batch(errors, fixes);

      expect(result.groups.length).toBeGreaterThanOrEqual(1);
      expect(result.stats.totalErrors).toBe(3);
      expect(result.stats.totalFixes).toBe(3);
    });

    it("should report ungrouped errors", () => {
      const errors = [
        createError({ id: "e1", file: "/src/a.ts", type: "TypeError", message: "Type check failed" }),
        createError({ id: "e2", file: "/src/b.ts", type: "SyntaxError", message: "Unexpected token" }),
        createError({ id: "e3", file: "/src/c.ts", type: "ReferenceError", message: "Variable undefined" }),
      ];
      const fixes = [
        createFix({ id: "fix-1", errorId: "e1" }),
        createFix({ id: "fix-2", errorId: "e2" }),
        createFix({ id: "fix-3", errorId: "e3" }),
      ];

      const result = batcher.batch(errors, fixes);

      // All errors are unrelated, so all should be ungrouped
      expect(result.ungroupedErrors.length).toBe(3);
    });

    it("should calculate correct grouping ratio", () => {
      const errors = [
        createError({ id: "e1", file: "/src/app.ts" }),
        createError({ id: "e2", file: "/src/app.ts" }),
        createError({ id: "e3", file: "/src/utils.ts", type: "Unknown" }),
      ];
      const fixes: BatchableFix[] = [];

      const result = batcher.batch(errors, fixes);

      // 2 out of 3 errors should be grouped
      expect(result.stats.groupingRatio).toBeCloseTo(2 / 3, 2);
    });

    it("should throw when disposed", () => {
      batcher.dispose();
      expect(() => batcher.batch([], [])).toThrow("disposed");
    });
  });

  describe("findRelated", () => {
    it("should find related errors for a given error", () => {
      const target = createError({ id: "target", file: "/src/app.ts" });
      const allErrors = [
        target,
        createError({ id: "related1", file: "/src/app.ts" }),
        createError({ id: "related2", file: "/src/app.ts" }),
        createError({ id: "unrelated", file: "/src/utils.ts", type: "Unknown" }),
      ];

      const related = batcher.findRelated(target, allErrors);

      expect(related.length).toBe(2);
      expect(related.every((r) => r.error.file === "/src/app.ts")).toBe(true);
    });

    it("should sort by confidence", () => {
      const target = createError({
        id: "target",
        file: "/src/app.ts",
        causeId: "missing-import",
      });
      const allErrors = [
        target,
        createError({
          id: "same-cause",
          file: "/src/utils.ts",
          causeId: "missing-import",
        }),
        createError({ id: "same-file", file: "/src/app.ts" }),
      ];

      const related = batcher.findRelated(target, allErrors);

      // Same-cause has higher confidence than same-file
      expect(related[0].relation.type).toBe("same-cause");
    });
  });

  describe("groupByFile", () => {
    it("should group errors by file path", () => {
      const errors = [
        createError({ id: "e1", file: "/src/app.ts" }),
        createError({ id: "e2", file: "/src/app.ts" }),
        createError({ id: "e3", file: "/src/utils.ts" }),
        createError({ id: "e4" }), // No file
      ];

      const byFile = batcher.groupByFile(errors);

      expect(byFile.size).toBe(2);
      expect(byFile.get("/src/app.ts")?.length).toBe(2);
      expect(byFile.get("/src/utils.ts")?.length).toBe(1);
    });
  });

  describe("groupByCause", () => {
    it("should group errors by cause", () => {
      const errors = [
        createError({ id: "e1", causeId: "missing-import" }),
        createError({ id: "e2", causeId: "missing-import" }),
        createError({ id: "e3", type: "TypeError" }),
        createError({ id: "e4" }), // Unknown cause
      ];

      const byCause = batcher.groupByCause(errors);

      expect(byCause.get("missing-import")?.length).toBe(2);
      expect(byCause.get("TypeError")?.length).toBe(1);
      expect(byCause.get("unknown")?.length).toBe(1);
    });
  });

  describe("mergeBatches", () => {
    it("should merge batches with shared files", () => {
      const batches = [
        {
          id: "batch-1",
          description: "Batch 1",
          groupId: "grp-1",
          fixes: [createFix({ id: "fix-1" })],
          files: ["/src/app.ts"],
          totalLinesChanged: 5,
          hasConflicts: false,
          conflicts: [],
          orderMatters: false,
        },
        {
          id: "batch-2",
          description: "Batch 2",
          groupId: "grp-2",
          fixes: [createFix({ id: "fix-2" })],
          files: ["/src/app.ts", "/src/utils.ts"],
          totalLinesChanged: 10,
          hasConflicts: false,
          conflicts: [],
          orderMatters: false,
        },
      ];

      const merged = batcher.mergeBatches(batches);

      expect(merged.length).toBe(1);
      expect(merged[0].files).toContain("/src/app.ts");
      expect(merged[0].files).toContain("/src/utils.ts");
      expect(merged[0].totalLinesChanged).toBe(15);
    });

    it("should not merge unrelated batches", () => {
      const batches = [
        {
          id: "batch-1",
          description: "Batch 1",
          groupId: "grp-1",
          fixes: [createFix({ id: "fix-1" })],
          files: ["/src/app.ts"],
          totalLinesChanged: 5,
          hasConflicts: false,
          conflicts: [],
          orderMatters: false,
        },
        {
          id: "batch-2",
          description: "Batch 2",
          groupId: "grp-2",
          fixes: [createFix({ id: "fix-2" })],
          files: ["/src/utils.ts"],
          totalLinesChanged: 10,
          hasConflicts: false,
          conflicts: [],
          orderMatters: false,
        },
      ];

      const merged = batcher.mergeBatches(batches);

      expect(merged.length).toBe(2);
    });

    it("should return empty for empty input", () => {
      expect(batcher.mergeBatches([])).toEqual([]);
    });

    it("should return single batch unchanged", () => {
      const batch = {
        id: "batch-1",
        description: "Batch 1",
        groupId: "grp-1",
        fixes: [],
        files: ["/src/app.ts"],
        totalLinesChanged: 5,
        hasConflicts: false,
        conflicts: [],
        orderMatters: false,
      };

      expect(batcher.mergeBatches([batch])).toEqual([batch]);
    });
  });

  describe("options", () => {
    it("should respect minGroupConfidence option", () => {
      const strictBatcher = createMultiFixBatcher({ minGroupConfidence: 0.95 });

      const errors = [
        createError({ id: "e1", file: "/src/app.ts" }),
        createError({ id: "e2", file: "/src/app.ts" }),
      ];
      const result = strictBatcher.batch(errors, []);

      // Same-file has 0.7 confidence, so shouldn't group
      expect(result.groups.length).toBe(0);

      strictBatcher.dispose();
    });

    it("should respect maxGroupSize option", () => {
      const smallBatcher = createMultiFixBatcher({ maxGroupSize: 2 });

      const errors = [
        createError({ id: "e1", file: "/src/app.ts" }),
        createError({ id: "e2", file: "/src/app.ts" }),
        createError({ id: "e3", file: "/src/app.ts" }),
      ];
      const result = smallBatcher.batch(errors, []);

      // Group of 3 should be filtered out
      result.groups.forEach((g) => {
        expect(g.errorIds.length).toBeLessThanOrEqual(2);
      });

      smallBatcher.dispose();
    });
  });

  describe("dispose", () => {
    it("should mark as disposed", () => {
      expect(batcher.isDisposed()).toBe(false);
      batcher.dispose();
      expect(batcher.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      batcher.dispose();
      batcher.dispose(); // Should not throw
      expect(batcher.isDisposed()).toBe(true);
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("createMultiFixBatcher", () => {
  it("should create batcher with default options", () => {
    const batcher = createMultiFixBatcher();
    expect(batcher).toBeInstanceOf(MultiFixBatcher);
    batcher.dispose();
  });

  it("should create batcher with custom options", () => {
    const batcher = createMultiFixBatcher({
      minGroupConfidence: 0.8,
      maxGroupSize: 5,
    });
    expect(batcher).toBeInstanceOf(MultiFixBatcher);
    batcher.dispose();
  });
});

// ============================================================================
// Verification: Related errors (same file, same cause) fixed together
// ============================================================================

describe("Feature Verification: Related errors fixed together", () => {
  it("should batch same-file errors together", () => {
    const batcher = createMultiFixBatcher();

    const errors = [
      createError({ id: "e1", file: "/src/components/Button.tsx", line: 10 }),
      createError({ id: "e2", file: "/src/components/Button.tsx", line: 25 }),
      createError({ id: "e3", file: "/src/components/Button.tsx", line: 40 }),
    ];
    const fixes = [
      createFix({ id: "fix-1", errorId: "e1", file: "/src/components/Button.tsx" }),
      createFix({ id: "fix-2", errorId: "e2", file: "/src/components/Button.tsx" }),
      createFix({ id: "fix-3", errorId: "e3", file: "/src/components/Button.tsx" }),
    ];

    const result = batcher.batch(errors, fixes);

    // All three should be in one batch
    expect(result.groups.length).toBe(1);
    expect(result.batches.length).toBe(1);
    expect(result.batches[0].fixes.length).toBe(3);
    expect(result.stats.groupingRatio).toBe(1);

    batcher.dispose();
  });

  it("should batch same-cause errors together", () => {
    const batcher = createMultiFixBatcher();

    const errors = [
      createError({ id: "e1", file: "/src/a.ts", causeId: "missing-react-import" }),
      createError({ id: "e2", file: "/src/b.ts", causeId: "missing-react-import" }),
      createError({ id: "e3", file: "/src/c.ts", causeId: "missing-react-import" }),
    ];
    const fixes = [
      createFix({ id: "fix-1", errorId: "e1", description: "Add React import" }),
      createFix({ id: "fix-2", errorId: "e2", description: "Add React import" }),
      createFix({ id: "fix-3", errorId: "e3", description: "Add React import" }),
    ];

    const result = batcher.batch(errors, fixes);

    // All three should be grouped by same cause
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].sharedCause).toBe("missing-react-import");
    expect(result.batches[0].fixes.length).toBe(3);

    batcher.dispose();
  });

  it("should keep unrelated errors separate", () => {
    const batcher = createMultiFixBatcher();

    const errors = [
      createError({ id: "e1", file: "/src/app.ts", type: "TypeError", message: "Type mismatch error" }),
      createError({ id: "e2", file: "/src/utils.ts", type: "SyntaxError", message: "Parsing failed" }),
    ];
    const fixes = [
      createFix({ id: "fix-1", errorId: "e1" }),
      createFix({ id: "fix-2", errorId: "e2" }),
    ];

    const result = batcher.batch(errors, fixes);

    // Should be separate (no relation detected)
    expect(result.ungroupedErrors.length).toBe(2);
    expect(result.groups.length).toBe(0);

    batcher.dispose();
  });
});

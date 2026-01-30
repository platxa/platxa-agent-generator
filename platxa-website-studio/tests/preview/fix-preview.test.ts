/**
 * Tests for Fix Preview Before Applying
 *
 * Feature #159: Add fix preview before applying (diff view)
 * Verification: Shows unified diff of proposed fix; Apply/Cancel buttons
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FixPreview,
  createFixPreview,
  createFixPreviewFromSuggestion,
  previewSingleFileFix,
  generatePreviewId,
  getConfidenceLevel,
  createFixDiff,
  createAllDiffs,
  calculateTotalChanges,
  formatChangeSummary,
  isLargeFix,
  generateUnifiedDiff,
  generateAllUnifiedDiffs,
  mergeButtonConfig,
  getButtonConfigs,
  createPreviewState,
  DEFAULT_BUTTONS,
  DEFAULT_OPTIONS,
  STATUS_LABELS,
  STATUS_COLORS,
  CONFIDENCE_LEVELS,
  type FixChange,
  type FixMetadata,
  type FixPreviewOptions,
} from "../../lib/preview/fix-preview";

// ============================================================================
// Test Fixtures
// ============================================================================

const sampleFix: FixMetadata = {
  id: "test-fix-1",
  title: "Fix undefined variable",
  description: "Add missing variable declaration",
  errorMessage: "ReferenceError: foo is not defined",
  confidence: 0.85,
  category: "reference",
  reversible: true,
  source: "ai",
};

const sampleChange: FixChange = {
  filePath: "src/app.ts",
  originalContent: `function greet() {
  console.log(message);
}`,
  fixedContent: `function greet() {
  const message = "Hello";
  console.log(message);
}`,
  description: "Add missing variable declaration",
};

const multiFileChanges: FixChange[] = [
  {
    filePath: "src/utils.ts",
    originalContent: "export const foo = 1;",
    fixedContent: "export const foo = 1;\nexport const bar = 2;",
  },
  {
    filePath: "src/index.ts",
    originalContent: "import { foo } from './utils';",
    fixedContent: "import { foo, bar } from './utils';",
  },
];

// ============================================================================
// Constants Tests
// ============================================================================

describe("DEFAULT_BUTTONS", () => {
  it("should have all action buttons", () => {
    expect(DEFAULT_BUTTONS.apply).toBeDefined();
    expect(DEFAULT_BUTTONS.cancel).toBeDefined();
    expect(DEFAULT_BUTTONS.edit).toBeDefined();
    expect(DEFAULT_BUTTONS.skip).toBeDefined();
  });

  it("should have labels for all buttons", () => {
    expect(DEFAULT_BUTTONS.apply.label).toBe("Apply Fix");
    expect(DEFAULT_BUTTONS.cancel.label).toBe("Cancel");
  });

  it("should have shortcuts for primary actions", () => {
    expect(DEFAULT_BUTTONS.apply.shortcut).toBe("Ctrl+Enter");
    expect(DEFAULT_BUTTONS.cancel.shortcut).toBe("Escape");
  });

  it("should have correct variants", () => {
    expect(DEFAULT_BUTTONS.apply.variant).toBe("primary");
    expect(DEFAULT_BUTTONS.cancel.variant).toBe("secondary");
  });
});

describe("STATUS_LABELS", () => {
  it("should have labels for all statuses", () => {
    expect(STATUS_LABELS.pending).toBe("Pending Review");
    expect(STATUS_LABELS.applied).toBe("Applied");
    expect(STATUS_LABELS.cancelled).toBe("Cancelled");
    expect(STATUS_LABELS.skipped).toBe("Skipped");
    expect(STATUS_LABELS.modified).toBe("Modified & Applied");
  });
});

describe("STATUS_COLORS", () => {
  it("should have colors for all statuses", () => {
    expect(STATUS_COLORS.pending).toBeDefined();
    expect(STATUS_COLORS.applied).toBeDefined();
    expect(STATUS_COLORS.cancelled).toBeDefined();
    expect(STATUS_COLORS.skipped).toBeDefined();
    expect(STATUS_COLORS.modified).toBeDefined();
  });
});

describe("CONFIDENCE_LEVELS", () => {
  it("should have high, medium, low levels", () => {
    expect(CONFIDENCE_LEVELS.high.min).toBe(0.8);
    expect(CONFIDENCE_LEVELS.medium.min).toBe(0.5);
    expect(CONFIDENCE_LEVELS.low.min).toBe(0);
  });
});

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe("generatePreviewId", () => {
  it("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generatePreviewId());
    }
    expect(ids.size).toBe(100);
  });

  it("should have correct prefix", () => {
    const id = generatePreviewId();
    expect(id.startsWith("fxp-")).toBe(true);
  });
});

describe("getConfidenceLevel", () => {
  it("should return high for >= 0.8", () => {
    expect(getConfidenceLevel(0.8).level).toBe("high");
    expect(getConfidenceLevel(0.95).level).toBe("high");
    expect(getConfidenceLevel(1.0).level).toBe("high");
  });

  it("should return medium for 0.5-0.79", () => {
    expect(getConfidenceLevel(0.5).level).toBe("medium");
    expect(getConfidenceLevel(0.7).level).toBe("medium");
    expect(getConfidenceLevel(0.79).level).toBe("medium");
  });

  it("should return low for < 0.5", () => {
    expect(getConfidenceLevel(0.49).level).toBe("low");
    expect(getConfidenceLevel(0.2).level).toBe("low");
    expect(getConfidenceLevel(0).level).toBe("low");
  });

  it("should include label and color", () => {
    const info = getConfidenceLevel(0.9);
    expect(info.label).toBe("High");
    expect(info.color).toBeDefined();
  });
});

describe("createFixDiff", () => {
  it("should create diff from fix change", () => {
    const diff = createFixDiff(sampleChange);

    expect(diff.filePath).toBe("src/app.ts");
    expect(diff.additions).toBeGreaterThan(0);
  });

  it("should detect additions and deletions", () => {
    const change: FixChange = {
      filePath: "test.ts",
      originalContent: "const a = 1;",
      fixedContent: "const b = 2;",
    };

    const diff = createFixDiff(change);
    expect(diff.additions).toBeGreaterThan(0);
    expect(diff.deletions).toBeGreaterThan(0);
  });
});

describe("createAllDiffs", () => {
  it("should create diffs for all changes", () => {
    const diffs = createAllDiffs(multiFileChanges);

    expect(diffs.length).toBe(2);
    expect(diffs[0].filePath).toBe("src/utils.ts");
    expect(diffs[1].filePath).toBe("src/index.ts");
  });
});

describe("calculateTotalChanges", () => {
  it("should sum additions and deletions", () => {
    const diffs = createAllDiffs(multiFileChanges);
    const totals = calculateTotalChanges(diffs);

    expect(totals.filesChanged).toBe(2);
    expect(totals.additions).toBeGreaterThan(0);
  });

  it("should handle empty diffs", () => {
    const totals = calculateTotalChanges([]);
    expect(totals.filesChanged).toBe(0);
    expect(totals.additions).toBe(0);
    expect(totals.deletions).toBe(0);
  });
});

describe("formatChangeSummary", () => {
  it("should format single file change", () => {
    const diffs = createAllDiffs([sampleChange]);
    const summary = formatChangeSummary(diffs);

    expect(summary).toContain("1 file");
  });

  it("should format multiple file changes", () => {
    const diffs = createAllDiffs(multiFileChanges);
    const summary = formatChangeSummary(diffs);

    expect(summary).toContain("2 files");
  });

  it("should include additions count", () => {
    const diffs = createAllDiffs([sampleChange]);
    const summary = formatChangeSummary(diffs);

    expect(summary).toMatch(/\+\d+/);
  });
});

describe("isLargeFix", () => {
  it("should return false for small fixes", () => {
    const diffs = createAllDiffs([sampleChange]);
    expect(isLargeFix(diffs, 50)).toBe(false);
  });

  it("should return true for large fixes", () => {
    const largeChange: FixChange = {
      filePath: "large.ts",
      originalContent: Array(100).fill("line").join("\n"),
      fixedContent: Array(100).fill("modified line").join("\n"),
    };
    const diffs = createAllDiffs([largeChange]);
    expect(isLargeFix(diffs, 10)).toBe(true);
  });
});

describe("generateUnifiedDiff", () => {
  it("should generate unified diff format", () => {
    const diff = createFixDiff(sampleChange);
    const unified = generateUnifiedDiff(diff);

    expect(unified).toContain("---");
    expect(unified).toContain("+++");
    expect(unified).toContain("@@");
  });

  it("should include file paths", () => {
    const diff = createFixDiff(sampleChange);
    const unified = generateUnifiedDiff(diff);

    expect(unified).toContain("src/app.ts");
  });

  it("should show added lines with +", () => {
    const diff = createFixDiff(sampleChange);
    const unified = generateUnifiedDiff(diff);

    expect(unified).toContain("+");
  });
});

describe("generateAllUnifiedDiffs", () => {
  it("should combine all diffs", () => {
    const diffs = createAllDiffs(multiFileChanges);
    const unified = generateAllUnifiedDiffs(diffs);

    expect(unified).toContain("src/utils.ts");
    expect(unified).toContain("src/index.ts");
  });
});

describe("mergeButtonConfig", () => {
  it("should merge custom config with defaults", () => {
    const merged = mergeButtonConfig("apply", { label: "Apply Now" });

    expect(merged.label).toBe("Apply Now");
    expect(merged.shortcut).toBe("Ctrl+Enter"); // default
  });

  it("should use defaults when no custom config", () => {
    const merged = mergeButtonConfig("cancel");

    expect(merged.label).toBe("Cancel");
    expect(merged.variant).toBe("secondary");
  });
});

describe("getButtonConfigs", () => {
  it("should return all button configs", () => {
    const buttons = getButtonConfigs({});

    expect(buttons.apply).toBeDefined();
    expect(buttons.cancel).toBeDefined();
    expect(buttons.edit).toBeDefined();
    expect(buttons.skip).toBeDefined();
  });

  it("should apply custom button options", () => {
    const buttons = getButtonConfigs({
      buttons: {
        apply: { label: "Confirm" },
      },
    });

    expect(buttons.apply.label).toBe("Confirm");
  });
});

describe("createPreviewState", () => {
  it("should create initial state", () => {
    const state = createPreviewState(sampleFix, [sampleChange]);

    expect(state.status).toBe("pending");
    expect(state.fix).toEqual(sampleFix);
    expect(state.changes).toEqual([sampleChange]);
    expect(state.expanded).toBe(true);
    expect(state.modified).toBe(false);
    expect(state.diffs.length).toBe(1);
  });
});

// ============================================================================
// FixPreview Class Tests
// ============================================================================

describe("FixPreview", () => {
  let preview: FixPreview;

  beforeEach(() => {
    preview = createFixPreview(sampleFix, [sampleChange]);
  });

  afterEach(() => {
    preview.dispose();
  });

  describe("getState", () => {
    it("should return current state", () => {
      const state = preview.getState();

      expect(state.status).toBe("pending");
      expect(state.fix.id).toBe("test-fix-1");
    });

    it("should return a copy of state", () => {
      const state1 = preview.getState();
      const state2 = preview.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe("getDiffs", () => {
    it("should return generated diffs", () => {
      const diffs = preview.getDiffs();

      expect(diffs.length).toBe(1);
      expect(diffs[0].filePath).toBe("src/app.ts");
    });
  });

  describe("getUnifiedDiff", () => {
    it("should return unified diff string", () => {
      const unified = preview.getUnifiedDiff();

      expect(unified).toContain("---");
      expect(unified).toContain("+++");
      expect(unified).toContain("src/app.ts");
    });
  });

  describe("getSummary", () => {
    it("should return change summary", () => {
      const summary = preview.getSummary();

      expect(summary).toContain("1 file");
    });
  });

  describe("getButtons", () => {
    it("should return button configs", () => {
      const buttons = preview.getButtons();

      expect(buttons.apply.label).toBe("Apply Fix");
      expect(buttons.cancel.label).toBe("Cancel");
    });

    it("should disable edit if not allowed", () => {
      const buttons = preview.getButtons();
      expect(buttons.edit.disabled).toBe(true);
    });

    it("should enable edit if allowed", () => {
      const editablePreview = createFixPreview(sampleFix, [sampleChange], {
        allowEdit: true,
      });
      const buttons = editablePreview.getButtons();
      expect(buttons.edit.disabled).toBeFalsy();
      editablePreview.dispose();
    });
  });

  describe("toggleExpanded", () => {
    it("should toggle expanded state", () => {
      expect(preview.getState().expanded).toBe(true);

      preview.toggleExpanded();
      expect(preview.getState().expanded).toBe(false);

      preview.toggleExpanded();
      expect(preview.getState().expanded).toBe(true);
    });
  });

  describe("setExpanded", () => {
    it("should set expanded state", () => {
      preview.setExpanded(false);
      expect(preview.getState().expanded).toBe(false);

      preview.setExpanded(true);
      expect(preview.getState().expanded).toBe(true);
    });
  });

  describe("apply", () => {
    it("should change status to applied", async () => {
      await preview.apply();
      expect(preview.getState().status).toBe("applied");
    });

    it("should set actionAt timestamp", async () => {
      await preview.apply();
      expect(preview.getState().actionAt).toBeDefined();
    });

    it("should call onApply callback", async () => {
      const onApply = vi.fn();
      preview.setOnApply(onApply);

      await preview.apply();

      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
        status: "applied",
      }));
    });

    it("should throw if already applied", async () => {
      await preview.apply();
      await expect(preview.apply()).rejects.toThrow("Cannot apply");
    });

    it("should disable buttons after apply", async () => {
      await preview.apply();
      const buttons = preview.getButtons();

      expect(buttons.apply.disabled).toBe(true);
      expect(buttons.cancel.disabled).toBe(true);
    });
  });

  describe("cancel", () => {
    it("should change status to cancelled", () => {
      preview.cancel();
      expect(preview.getState().status).toBe("cancelled");
    });

    it("should call onCancel callback", () => {
      const onCancel = vi.fn();
      preview.setOnCancel(onCancel);

      preview.cancel();

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("should throw if already cancelled", () => {
      preview.cancel();
      expect(() => preview.cancel()).toThrow("Cannot cancel");
    });
  });

  describe("skip", () => {
    it("should change status to skipped", () => {
      preview.skip();
      expect(preview.getState().status).toBe("skipped");
    });

    it("should throw if already skipped", () => {
      preview.skip();
      expect(() => preview.skip()).toThrow("Cannot skip");
    });
  });

  describe("modify", () => {
    it("should require allowEdit option", () => {
      expect(() => preview.modify([sampleChange])).toThrow("not allowed");
    });

    it("should update diffs when modified", () => {
      const editablePreview = createFixPreview(sampleFix, [sampleChange], {
        allowEdit: true,
      });

      const modifiedChange: FixChange = {
        ...sampleChange,
        fixedContent: "// Modified content",
      };

      editablePreview.modify([modifiedChange]);

      expect(editablePreview.getState().modified).toBe(true);
      expect(editablePreview.getState().userModifications).toBeDefined();

      editablePreview.dispose();
    });

    it("should call onEdit callback", () => {
      const editablePreview = createFixPreview(sampleFix, [sampleChange], {
        allowEdit: true,
      });
      const onEdit = vi.fn();
      editablePreview.setOnEdit(onEdit);

      editablePreview.modify([sampleChange]);

      expect(onEdit).toHaveBeenCalled();
      editablePreview.dispose();
    });

    it("should set status to modified when applied", async () => {
      const editablePreview = createFixPreview(sampleFix, [sampleChange], {
        allowEdit: true,
      });

      editablePreview.modify([sampleChange]);
      await editablePreview.apply();

      expect(editablePreview.getState().status).toBe("modified");
      editablePreview.dispose();
    });
  });

  describe("resetModifications", () => {
    it("should reset to original diffs", () => {
      const editablePreview = createFixPreview(sampleFix, [sampleChange], {
        allowEdit: true,
      });

      const originalDiffs = editablePreview.getDiffs();

      editablePreview.modify([{
        ...sampleChange,
        fixedContent: "// Modified",
      }]);

      expect(editablePreview.getState().modified).toBe(true);

      editablePreview.resetModifications();

      expect(editablePreview.getState().modified).toBe(false);
      expect(editablePreview.getState().userModifications).toBeUndefined();

      editablePreview.dispose();
    });
  });

  describe("getConfidenceInfo", () => {
    it("should return confidence info when available", () => {
      const info = preview.getConfidenceInfo();

      expect(info).not.toBeNull();
      expect(info?.level).toBe("high"); // 0.85 confidence
    });

    it("should return null when confidence not set", () => {
      const noConfidencePreview = createFixPreview(
        { ...sampleFix, confidence: undefined },
        [sampleChange]
      );

      expect(noConfidencePreview.getConfidenceInfo()).toBeNull();
      noConfidencePreview.dispose();
    });
  });

  describe("canPerformAction", () => {
    it("should return true for allowed actions", () => {
      expect(preview.canPerformAction("apply")).toBe(true);
      expect(preview.canPerformAction("cancel")).toBe(true);
      expect(preview.canPerformAction("skip")).toBe(true);
    });

    it("should return false for edit when not allowed", () => {
      expect(preview.canPerformAction("edit")).toBe(false);
    });

    it("should return false after action taken", async () => {
      await preview.apply();
      expect(preview.canPerformAction("apply")).toBe(false);
      expect(preview.canPerformAction("cancel")).toBe(false);
    });
  });

  describe("performAction", () => {
    it("should perform apply action", async () => {
      await preview.performAction("apply");
      expect(preview.getState().status).toBe("applied");
    });

    it("should perform cancel action", async () => {
      await preview.performAction("cancel");
      expect(preview.getState().status).toBe("cancelled");
    });

    it("should perform skip action", async () => {
      await preview.performAction("skip");
      expect(preview.getState().status).toBe("skipped");
    });
  });

  describe("state change callbacks", () => {
    it("should call onStateChange on toggle", () => {
      const onStateChange = vi.fn();
      preview.setOnStateChange(onStateChange);

      preview.toggleExpanded();

      expect(onStateChange).toHaveBeenCalled();
    });

    it("should call onStateChange on apply", async () => {
      const onStateChange = vi.fn();
      preview.setOnStateChange(onStateChange);

      await preview.apply();

      expect(onStateChange).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should mark as disposed", () => {
      expect(preview.isDisposed()).toBe(false);
      preview.dispose();
      expect(preview.isDisposed()).toBe(true);
    });

    it("should be safe to dispose multiple times", () => {
      preview.dispose();
      preview.dispose();
      expect(preview.isDisposed()).toBe(true);
    });

    it("should throw on operations after dispose", () => {
      preview.dispose();
      expect(() => preview.toggleExpanded()).toThrow("disposed");
    });
  });
});

// ============================================================================
// Factory Functions Tests
// ============================================================================

describe("createFixPreview", () => {
  it("should create preview with default options", () => {
    const preview = createFixPreview(sampleFix, [sampleChange]);

    expect(preview).toBeInstanceOf(FixPreview);
    expect(preview.getState().status).toBe("pending");

    preview.dispose();
  });

  it("should accept custom options", () => {
    const preview = createFixPreview(sampleFix, [sampleChange], {
      allowEdit: true,
      showLineNumbers: false,
    });

    expect(preview.canPerformAction("edit")).toBe(true);
    preview.dispose();
  });
});

describe("createFixPreviewFromSuggestion", () => {
  it("should create preview from error and suggestion", () => {
    const preview = createFixPreviewFromSuggestion(
      "ReferenceError: foo is not defined",
      "Add variable declaration",
      "Declare foo before using it",
      [sampleChange],
      { confidence: 0.9 }
    );

    const state = preview.getState();
    expect(state.fix.errorMessage).toBe("ReferenceError: foo is not defined");
    expect(state.fix.title).toBe("Add variable declaration");
    expect(state.fix.confidence).toBe(0.9);
    expect(state.fix.source).toBe("ai");

    preview.dispose();
  });
});

describe("previewSingleFileFix", () => {
  it("should create preview for single file", () => {
    const preview = previewSingleFileFix(
      "src/test.ts",
      "const a = 1;",
      "const a = 2;",
      "Update value",
      "Change value from 1 to 2"
    );

    expect(preview.getDiffs().length).toBe(1);
    expect(preview.getDiffs()[0].filePath).toBe("src/test.ts");
    expect(preview.getState().fix.source).toBe("auto");

    preview.dispose();
  });
});

// ============================================================================
// Feature Verification: Shows unified diff; Apply/Cancel buttons
// ============================================================================

describe("Feature Verification: Unified diff and Apply/Cancel buttons", () => {
  let preview: FixPreview;

  beforeEach(() => {
    preview = createFixPreview(sampleFix, [sampleChange]);
  });

  afterEach(() => {
    preview.dispose();
  });

  it("should show unified diff of proposed fix", () => {
    const unified = preview.getUnifiedDiff();

    // Unified diff format
    expect(unified).toContain("---"); // old file header
    expect(unified).toContain("+++"); // new file header
    expect(unified).toContain("@@"); // hunk header

    // File path
    expect(unified).toContain("src/app.ts");

    // Change markers
    expect(unified).toMatch(/^\+/m); // Added lines start with +
  });

  it("should have Apply button", () => {
    const buttons = preview.getButtons();

    expect(buttons.apply).toBeDefined();
    expect(buttons.apply.label).toBe("Apply Fix");
    expect(buttons.apply.variant).toBe("primary");
    expect(buttons.apply.disabled).toBeFalsy();
  });

  it("should have Cancel button", () => {
    const buttons = preview.getButtons();

    expect(buttons.cancel).toBeDefined();
    expect(buttons.cancel.label).toBe("Cancel");
    expect(buttons.cancel.variant).toBe("secondary");
    expect(buttons.cancel.disabled).toBeFalsy();
  });

  it("should apply fix when Apply is clicked", async () => {
    const onApply = vi.fn();
    preview.setOnApply(onApply);

    // Simulate Apply button click
    await preview.apply();

    expect(preview.getState().status).toBe("applied");
    expect(onApply).toHaveBeenCalled();
  });

  it("should cancel fix when Cancel is clicked", () => {
    const onCancel = vi.fn();
    preview.setOnCancel(onCancel);

    // Simulate Cancel button click
    preview.cancel();

    expect(preview.getState().status).toBe("cancelled");
    expect(onCancel).toHaveBeenCalled();
  });

  it("should disable buttons after action", async () => {
    await preview.apply();

    const buttons = preview.getButtons();
    expect(buttons.apply.disabled).toBe(true);
    expect(buttons.cancel.disabled).toBe(true);
  });

  it("should show file changes in diff", () => {
    const diffs = preview.getDiffs();

    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs[0].hunks.length).toBeGreaterThan(0);

    // Check for actual content in diff
    const lines = diffs[0].hunks[0].lines;
    const addedLines = lines.filter(l => l.type === "added");
    expect(addedLines.length).toBeGreaterThan(0);
  });

  it("should provide change summary", () => {
    const summary = preview.getSummary();

    // Summary should contain file count and changes
    expect(summary).toMatch(/\d+ file/);
    expect(summary).toMatch(/[+-]\d+/);
  });

  it("should track additions and deletions", () => {
    const diffs = preview.getDiffs();
    const totals = calculateTotalChanges(diffs);

    expect(totals.additions).toBeGreaterThanOrEqual(0);
    expect(totals.deletions).toBeGreaterThanOrEqual(0);
    expect(totals.filesChanged).toBe(1);
  });

  it("should support keyboard shortcuts", () => {
    const buttons = preview.getButtons();

    expect(buttons.apply.shortcut).toBe("Ctrl+Enter");
    expect(buttons.cancel.shortcut).toBe("Escape");
  });
});

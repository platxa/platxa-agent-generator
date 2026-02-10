/**
 * Tests for Theme Version Manager
 *
 * Feature #14: Add theme versioning and change history tracking
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ThemeVersionManager,
  createThemeVersionManager,
  getThemeVersionManager,
  resetThemeVersionManager,
  parseVersion,
  formatVersion,
  bumpVersion,
  compareVersions,
  formatVersionHistory,
  formatVersionDiff,
  type ThemeState,
  type ThemeChange,
  type VersionEvent,
} from "../../lib/themes/theme-version-manager";

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestState(overrides: Partial<ThemeState> = {}): ThemeState {
  return {
    id: "test-theme",
    name: "Test Theme",
    colors: {
      primary: "#3b82f6",
      secondary: "#6366f1",
      background: "#ffffff",
      text: "#1f2937",
    },
    typography: {
      fontFamily: "Inter",
      fontSize: 16,
      lineHeight: 1.5,
    },
    spacing: {
      unit: "4px",
      sm: "8px",
      md: "16px",
      lg: "24px",
    },
    layout: {
      maxWidth: "1280px",
      containerPadding: "16px",
    },
    ...overrides,
  };
}

// =============================================================================
// Utility Function Tests
// =============================================================================

describe("Version Utilities", () => {
  describe("parseVersion", () => {
    it("parses standard version string", () => {
      const result = parseVersion("1.2.3");
      expect(result).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it("parses version with zeros", () => {
      const result = parseVersion("0.0.1");
      expect(result).toEqual({ major: 0, minor: 0, patch: 1 });
    });

    it("handles partial version strings", () => {
      expect(parseVersion("1")).toEqual({ major: 1, minor: 0, patch: 0 });
      expect(parseVersion("1.2")).toEqual({ major: 1, minor: 2, patch: 0 });
    });

    it("handles empty string", () => {
      expect(parseVersion("")).toEqual({ major: 0, minor: 0, patch: 0 });
    });
  });

  describe("formatVersion", () => {
    it("formats semantic version to string", () => {
      expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe("1.2.3");
      expect(formatVersion({ major: 0, minor: 0, patch: 1 })).toBe("0.0.1");
    });
  });

  describe("bumpVersion", () => {
    it("bumps major version", () => {
      expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
    });

    it("bumps minor version", () => {
      expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    });

    it("bumps patch version", () => {
      expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    });

    it("handles version 0.0.0", () => {
      expect(bumpVersion("0.0.0", "patch")).toBe("0.0.1");
      expect(bumpVersion("0.0.0", "minor")).toBe("0.1.0");
      expect(bumpVersion("0.0.0", "major")).toBe("1.0.0");
    });
  });

  describe("compareVersions", () => {
    it("returns 0 for equal versions", () => {
      expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    });

    it("compares major versions", () => {
      expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
      expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
    });

    it("compares minor versions", () => {
      expect(compareVersions("1.1.0", "1.2.0")).toBe(-1);
      expect(compareVersions("1.2.0", "1.1.0")).toBe(1);
    });

    it("compares patch versions", () => {
      expect(compareVersions("1.0.1", "1.0.2")).toBe(-1);
      expect(compareVersions("1.0.2", "1.0.1")).toBe(1);
    });
  });
});

// =============================================================================
// ThemeVersionManager Tests
// =============================================================================

describe("ThemeVersionManager", () => {
  let manager: ThemeVersionManager;

  beforeEach(() => {
    resetThemeVersionManager();
    manager = createThemeVersionManager();
  });

  // ===========================================================================
  // Version Creation
  // ===========================================================================

  describe("createVersion", () => {
    it("creates initial version", () => {
      const state = createTestState();
      const version = manager.createVersion("theme-1", state, "1.0.0", "Initial Release");

      expect(version.version).toBe("1.0.0");
      expect(version.label).toBe("Initial Release");
      expect(version.semver).toEqual({ major: 1, minor: 0, patch: 0 });
      expect(version.state).toEqual(state);
      expect(version.changes).toHaveLength(0);
      expect(version.isPublished).toBe(false);
      expect(version.tags).toHaveLength(0);
    });

    it("uses default version if not provided", () => {
      const state = createTestState();
      const version = manager.createVersion("theme-1", state);

      expect(version.version).toBe("1.0.0");
      expect(version.label).toBe("Initial Release");
    });

    it("creates version with description", () => {
      const state = createTestState();
      const version = manager.createVersion(
        "theme-1",
        state,
        "1.0.0",
        "Initial",
        "First version of the theme"
      );

      expect(version.description).toBe("First version of the theme");
    });

    it("sets current version in history", () => {
      const state = createTestState();
      manager.createVersion("theme-1", state, "1.0.0", "Initial");

      const history = manager.getHistory("theme-1");
      expect(history).not.toBeNull();
      expect(history!.currentVersion).toBe("1.0.0");
    });

    it("deep clones state to prevent mutations", () => {
      const state = createTestState();
      const version = manager.createVersion("theme-1", state, "1.0.0", "Initial");

      // Mutate original state
      state.colors.primary = "#ff0000";

      // Version state should be unchanged
      expect(version.state.colors.primary).toBe("#3b82f6");
    });
  });

  // ===========================================================================
  // Change Recording
  // ===========================================================================

  describe("recordChange", () => {
    beforeEach(() => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");
    });

    it("records a single change", () => {
      const change = manager.recordChange("theme-1", {
        category: "colors",
        description: "Changed primary color",
        path: "colors.primary",
        oldValue: "#3b82f6",
        newValue: "#7c3aed",
      });

      expect(change.id).toBeDefined();
      expect(change.timestamp).toBeInstanceOf(Date);
      expect(change.category).toBe("colors");
      expect(change.path).toBe("colors.primary");
    });

    it("records multiple changes", () => {
      const changes = manager.recordChanges("theme-1", [
        {
          category: "colors",
          description: "Changed primary",
          path: "colors.primary",
          oldValue: "#3b82f6",
          newValue: "#7c3aed",
        },
        {
          category: "typography",
          description: "Changed font size",
          path: "typography.fontSize",
          oldValue: 16,
          newValue: 18,
        },
      ]);

      expect(changes).toHaveLength(2);
      expect(changes[0].category).toBe("colors");
      expect(changes[1].category).toBe("typography");
    });
  });

  // ===========================================================================
  // Version Commit
  // ===========================================================================

  describe("commitVersion", () => {
    beforeEach(() => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");
    });

    it("commits a new version with recorded changes", () => {
      manager.recordChange("theme-1", {
        category: "colors",
        description: "Updated primary color",
        path: "colors.primary",
        oldValue: "#3b82f6",
        newValue: "#7c3aed",
      });

      const newState = createTestState({ colors: { ...createTestState().colors, primary: "#7c3aed" } });
      const version = manager.commitVersion("theme-1", "patch", "Color update", newState);

      expect(version).not.toBeNull();
      expect(version!.version).toBe("1.0.1");
      expect(version!.label).toBe("Color update");
      expect(version!.changes.length).toBeGreaterThan(0);
    });

    it("bumps version according to bump type", () => {
      const state = createTestState();

      let version = manager.commitVersion("theme-1", "patch", "Patch", state);
      expect(version!.version).toBe("1.0.1");

      version = manager.commitVersion("theme-1", "minor", "Minor", state);
      expect(version!.version).toBe("1.1.0");

      version = manager.commitVersion("theme-1", "major", "Major", state);
      expect(version!.version).toBe("2.0.0");
    });

    it("detects changes by comparing states", () => {
      const newState = createTestState();
      newState.colors.primary = "#ff0000";
      newState.typography.fontSize = 20;

      const version = manager.commitVersion("theme-1", "minor", "Auto-detected", newState);

      expect(version).not.toBeNull();
      const colorChanges = version!.changes.filter((c) => c.category === "colors");
      const typoChanges = version!.changes.filter((c) => c.category === "typography");

      expect(colorChanges.length).toBeGreaterThan(0);
      expect(typoChanges.length).toBeGreaterThan(0);
    });

    it("clears pending changes after commit", () => {
      manager.recordChange("theme-1", {
        category: "colors",
        description: "Test",
        path: "colors.primary",
        oldValue: "#3b82f6",
        newValue: "#ff0000",
      });

      manager.commitVersion("theme-1", "patch", "Commit", createTestState());

      // Record new change and commit again
      manager.recordChange("theme-1", {
        category: "spacing",
        description: "Test 2",
        path: "spacing.sm",
        oldValue: "8px",
        newValue: "12px",
      });

      const version = manager.commitVersion("theme-1", "patch", "Commit 2", createTestState());

      // Should only have the spacing change from second batch
      const colorChanges = version!.changes.filter((c) => c.path === "colors.primary");
      expect(colorChanges).toHaveLength(0);
    });

    it("returns null if no history exists", () => {
      const result = manager.commitVersion("nonexistent", "patch", "Test", createTestState());
      expect(result).toBeNull();
    });

    it("tags version as breaking when breaking changes exist", () => {
      manager.recordChange("theme-1", {
        category: "breaking",
        description: "Removed deprecated API",
        path: "config.legacyMode",
        oldValue: true,
        newValue: undefined,
      });

      const version = manager.commitVersion("theme-1", "major", "Breaking", createTestState());

      expect(version!.tags).toContain("breaking");
    });
  });

  // ===========================================================================
  // Version Retrieval
  // ===========================================================================

  describe("getVersion and getVersions", () => {
    beforeEach(() => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");
      manager.commitVersion("theme-1", "patch", "Patch 1", createTestState());
      manager.commitVersion("theme-1", "minor", "Minor 1", createTestState());
    });

    it("gets current version", () => {
      const current = manager.getCurrentVersion("theme-1");
      expect(current).not.toBeNull();
      expect(current!.version).toBe("1.1.0");
    });

    it("gets specific version", () => {
      const version = manager.getVersion("theme-1", "1.0.0");
      expect(version).not.toBeNull();
      expect(version!.label).toBe("Initial");
    });

    it("returns null for nonexistent version", () => {
      const version = manager.getVersion("theme-1", "9.9.9");
      expect(version).toBeNull();
    });

    it("gets all versions in order (newest first)", () => {
      const versions = manager.getVersions("theme-1");
      expect(versions).toHaveLength(3);
      expect(versions[0].version).toBe("1.1.0");
      expect(versions[1].version).toBe("1.0.1");
      expect(versions[2].version).toBe("1.0.0");
    });

    it("returns empty array for nonexistent theme", () => {
      const versions = manager.getVersions("nonexistent");
      expect(versions).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Diff
  // ===========================================================================

  describe("diffVersions", () => {
    beforeEach(() => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");

      manager.recordChange("theme-1", {
        category: "colors",
        description: "Changed primary",
        path: "colors.primary",
        oldValue: "#3b82f6",
        newValue: "#7c3aed",
      });
      manager.commitVersion("theme-1", "patch", "Color change", createTestState());

      manager.recordChange("theme-1", {
        category: "typography",
        description: "Changed font",
        path: "typography.fontFamily",
        oldValue: "Inter",
        newValue: "Roboto",
      });
      manager.recordChange("theme-1", {
        category: "spacing",
        description: "Changed spacing",
        path: "spacing.md",
        oldValue: "16px",
        newValue: "20px",
      });
      manager.commitVersion("theme-1", "minor", "Typography update", createTestState());
    });

    it("calculates diff between versions", () => {
      const diff = manager.diffVersions("theme-1", "1.0.0", "1.1.0");

      expect(diff).not.toBeNull();
      expect(diff!.fromVersion).toBe("1.0.0");
      expect(diff!.toVersion).toBe("1.1.0");
      expect(diff!.totalChanges).toBe(3);
    });

    it("summarizes changes by category", () => {
      const diff = manager.diffVersions("theme-1", "1.0.0", "1.1.0");

      expect(diff!.summary.colors).toBe(1);
      expect(diff!.summary.typography).toBe(1);
      expect(diff!.summary.spacing).toBe(1);
    });

    it("detects breaking changes", () => {
      manager.recordChange("theme-1", {
        category: "breaking",
        description: "API change",
        path: "config.api",
        oldValue: "v1",
        newValue: "v2",
      });
      manager.commitVersion("theme-1", "major", "Breaking", createTestState());

      const diff = manager.diffVersions("theme-1", "1.1.0", "2.0.0");
      expect(diff!.isBreaking).toBe(true);
    });

    it("returns null for nonexistent versions", () => {
      expect(manager.diffVersions("theme-1", "1.0.0", "9.9.9")).toBeNull();
      expect(manager.diffVersions("nonexistent", "1.0.0", "1.0.1")).toBeNull();
    });

    it("diffs from current version", () => {
      const diff = manager.diffFromCurrent("theme-1", "1.0.0");

      expect(diff).not.toBeNull();
      expect(diff!.fromVersion).toBe("1.1.0");
      expect(diff!.toVersion).toBe("1.0.0");
    });
  });

  // ===========================================================================
  // Rollback
  // ===========================================================================

  describe("rollback", () => {
    beforeEach(() => {
      const initialState = createTestState();
      manager.createVersion("theme-1", initialState, "1.0.0", "Initial");

      const state2 = createTestState();
      state2.colors.primary = "#ff0000";
      manager.recordChange("theme-1", {
        category: "colors",
        description: "Changed primary",
        path: "colors.primary",
        oldValue: "#3b82f6",
        newValue: "#ff0000",
      });
      manager.commitVersion("theme-1", "patch", "Red theme", state2);

      const state3 = createTestState();
      state3.colors.primary = "#00ff00";
      manager.recordChange("theme-1", {
        category: "colors",
        description: "Changed primary",
        path: "colors.primary",
        oldValue: "#ff0000",
        newValue: "#00ff00",
      });
      manager.commitVersion("theme-1", "patch", "Green theme", state3);
    });

    it("rolls back to a previous version", () => {
      const result = manager.rollback("theme-1", "1.0.0");

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.fromVersion).toBe("1.0.2");
      expect(result!.toVersion).toBe("1.0.0");
      expect(result!.state.colors.primary).toBe("#3b82f6");
    });

    it("creates a new version for the rollback", () => {
      manager.rollback("theme-1", "1.0.0");

      const current = manager.getCurrentVersion("theme-1");
      expect(current!.version).toBe("1.0.3");
      expect(current!.label).toBe("Rollback to 1.0.0");
      expect(current!.tags).toContain("rollback");
    });

    it("tracks reverted changes", () => {
      const result = manager.rollback("theme-1", "1.0.0");

      expect(result!.revertedChanges.length).toBeGreaterThan(0);
    });

    it("returns null for nonexistent theme", () => {
      const result = manager.rollback("nonexistent", "1.0.0");
      expect(result).toBeNull();
    });

    it("returns null for nonexistent version", () => {
      const result = manager.rollback("theme-1", "9.9.9");
      expect(result).toBeNull();
    });

    it("returns null when trying to rollback to current version", () => {
      const result = manager.rollback("theme-1", "1.0.2");
      expect(result).toBeNull();
    });

    it("rollbackOne rolls back to previous version", () => {
      const result = manager.rollbackOne("theme-1");

      expect(result).not.toBeNull();
      expect(result!.toVersion).toBe("1.0.1");
    });

    it("rollbackOne returns null with only one version", () => {
      const newManager = createThemeVersionManager();
      newManager.createVersion("single", createTestState(), "1.0.0", "Only version");

      const result = newManager.rollbackOne("single");
      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // Labels, Tags, and Publishing
  // ===========================================================================

  describe("labels and tags", () => {
    beforeEach(() => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");
    });

    it("updates version label", () => {
      expect(manager.updateLabel("theme-1", "1.0.0", "New Label")).toBe(true);

      const version = manager.getVersion("theme-1", "1.0.0");
      expect(version!.label).toBe("New Label");
    });

    it("adds and removes tags", () => {
      expect(manager.addTag("theme-1", "1.0.0", "stable")).toBe(true);
      expect(manager.addTag("theme-1", "1.0.0", "production")).toBe(true);

      let version = manager.getVersion("theme-1", "1.0.0");
      expect(version!.tags).toContain("stable");
      expect(version!.tags).toContain("production");

      expect(manager.removeTag("theme-1", "1.0.0", "stable")).toBe(true);

      version = manager.getVersion("theme-1", "1.0.0");
      expect(version!.tags).not.toContain("stable");
      expect(version!.tags).toContain("production");
    });

    it("does not add duplicate tags", () => {
      manager.addTag("theme-1", "1.0.0", "stable");
      manager.addTag("theme-1", "1.0.0", "stable");

      const version = manager.getVersion("theme-1", "1.0.0");
      expect(version!.tags.filter((t) => t === "stable")).toHaveLength(1);
    });

    it("publishes version", () => {
      expect(manager.publishVersion("theme-1", "1.0.0")).toBe(true);

      const version = manager.getVersion("theme-1", "1.0.0");
      expect(version!.isPublished).toBe(true);
    });

    it("returns false for nonexistent version", () => {
      expect(manager.updateLabel("theme-1", "9.9.9", "Test")).toBe(false);
      expect(manager.addTag("theme-1", "9.9.9", "test")).toBe(false);
      expect(manager.removeTag("theme-1", "9.9.9", "test")).toBe(false);
      expect(manager.publishVersion("theme-1", "9.9.9")).toBe(false);
    });
  });

  // ===========================================================================
  // Querying
  // ===========================================================================

  describe("querying", () => {
    beforeEach(() => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial Release");
      manager.addTag("theme-1", "1.0.0", "stable");
      manager.publishVersion("theme-1", "1.0.0");

      manager.commitVersion("theme-1", "patch", "Bug fix", createTestState());

      manager.commitVersion("theme-1", "minor", "Feature update", createTestState());
      manager.addTag("theme-1", "1.1.0", "stable");
    });

    it("gets versions by tag", () => {
      const stableVersions = manager.getVersionsByTag("theme-1", "stable");
      expect(stableVersions).toHaveLength(2);
    });

    it("gets published versions", () => {
      const published = manager.getPublishedVersions("theme-1");
      expect(published).toHaveLength(1);
      expect(published[0].version).toBe("1.0.0");
    });

    it("searches versions by label", () => {
      const results = manager.searchVersions("theme-1", "Release");
      expect(results).toHaveLength(1);
      expect(results[0].version).toBe("1.0.0");
    });

    it("searches versions case-insensitively", () => {
      const results = manager.searchVersions("theme-1", "feature");
      expect(results).toHaveLength(1);
      expect(results[0].version).toBe("1.1.0");
    });

    it("gets change statistics", () => {
      manager.recordChange("theme-1", {
        category: "colors",
        description: "Test",
        path: "colors.test",
        oldValue: null,
        newValue: "#fff",
      });
      manager.recordChange("theme-1", {
        category: "colors",
        description: "Test 2",
        path: "colors.test2",
        oldValue: null,
        newValue: "#000",
      });
      manager.commitVersion("theme-1", "patch", "Colors", createTestState());

      const stats = manager.getChangeStats("theme-1");
      expect(stats.colors).toBe(2);
    });
  });

  // ===========================================================================
  // Persistence
  // ===========================================================================

  describe("persistence", () => {
    it("exports and imports history", () => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");
      manager.recordChange("theme-1", {
        category: "colors",
        description: "Test",
        path: "colors.primary",
        oldValue: "#3b82f6",
        newValue: "#ff0000",
      });
      manager.commitVersion("theme-1", "patch", "Update", createTestState());

      const exported = manager.export();

      const newManager = createThemeVersionManager();
      newManager.import(exported);

      const history = newManager.getHistory("theme-1");
      expect(history).not.toBeNull();
      expect(history!.versions).toHaveLength(2);
      expect(history!.currentVersion).toBe("1.0.1");
    });

    it("converts dates correctly on import", () => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");

      const exported = manager.export();

      // Simulate JSON serialization (dates become strings)
      const serialized = JSON.parse(JSON.stringify(exported));

      const newManager = createThemeVersionManager();
      newManager.import(serialized);

      const version = newManager.getVersion("theme-1", "1.0.0");
      expect(version!.createdAt).toBeInstanceOf(Date);
    });

    it("clears history for a theme", () => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");
      manager.createVersion("theme-2", createTestState(), "1.0.0", "Initial");

      expect(manager.clearHistory("theme-1")).toBe(true);

      expect(manager.getHistory("theme-1")).toBeNull();
      expect(manager.getHistory("theme-2")).not.toBeNull();
    });

    it("clears all histories", () => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");
      manager.createVersion("theme-2", createTestState(), "1.0.0", "Initial");

      manager.clearAll();

      expect(manager.getHistory("theme-1")).toBeNull();
      expect(manager.getHistory("theme-2")).toBeNull();
    });
  });

  // ===========================================================================
  // Events
  // ===========================================================================

  describe("events", () => {
    it("emits version_created event", () => {
      const events: VersionEvent[] = [];
      manager.subscribe((e) => events.push(e));

      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("version_created");
    });

    it("emits change_recorded event", () => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");

      const events: VersionEvent[] = [];
      manager.subscribe((e) => events.push(e));

      manager.recordChange("theme-1", {
        category: "colors",
        description: "Test",
        path: "colors.primary",
        oldValue: "#3b82f6",
        newValue: "#ff0000",
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("change_recorded");
    });

    it("emits version_committed event", () => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");

      const events: VersionEvent[] = [];
      manager.subscribe((e) => events.push(e));

      manager.commitVersion("theme-1", "patch", "Update", createTestState());

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("version_committed");
    });

    it("emits rollback event", () => {
      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");
      manager.commitVersion("theme-1", "patch", "Update", createTestState());

      const events: VersionEvent[] = [];
      manager.subscribe((e) => events.push(e));

      manager.rollback("theme-1", "1.0.0");

      const rollbackEvent = events.find((e) => e.type === "rollback");
      expect(rollbackEvent).toBeDefined();
    });

    it("allows unsubscribing", () => {
      const events: VersionEvent[] = [];
      const unsubscribe = manager.subscribe((e) => events.push(e));

      manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial");
      expect(events).toHaveLength(1);

      unsubscribe();

      manager.commitVersion("theme-1", "patch", "Update", createTestState());
      expect(events).toHaveLength(1); // No new events
    });
  });

  // ===========================================================================
  // Options
  // ===========================================================================

  describe("options", () => {
    it("respects maxVersions option", () => {
      const limitedManager = createThemeVersionManager({ maxVersions: 3 });
      limitedManager.createVersion("theme-1", createTestState(), "1.0.0", "v1");

      for (let i = 0; i < 5; i++) {
        limitedManager.commitVersion("theme-1", "patch", `Patch ${i}`, createTestState());
      }

      const versions = limitedManager.getVersions("theme-1");
      expect(versions).toHaveLength(3);
      expect(versions[0].version).toBe("1.0.5"); // Newest
    });

    it("keeps all versions when maxVersions is 0", () => {
      const unlimitedManager = createThemeVersionManager({ maxVersions: 0 });
      unlimitedManager.createVersion("theme-1", createTestState(), "1.0.0", "v1");

      for (let i = 0; i < 100; i++) {
        unlimitedManager.commitVersion("theme-1", "patch", `Patch ${i}`, createTestState());
      }

      const versions = unlimitedManager.getVersions("theme-1");
      expect(versions).toHaveLength(101);
    });
  });

  // ===========================================================================
  // Singleton
  // ===========================================================================

  describe("singleton", () => {
    it("returns same instance from getThemeVersionManager", () => {
      resetThemeVersionManager();

      const instance1 = getThemeVersionManager();
      const instance2 = getThemeVersionManager();

      expect(instance1).toBe(instance2);
    });

    it("resets singleton instance", () => {
      const instance1 = getThemeVersionManager();
      instance1.createVersion("theme-1", createTestState(), "1.0.0", "Test");

      resetThemeVersionManager();

      const instance2 = getThemeVersionManager();
      expect(instance2.getHistory("theme-1")).toBeNull();
    });
  });
});

// =============================================================================
// Formatting Tests
// =============================================================================

describe("Formatting", () => {
  let manager: ThemeVersionManager;

  beforeEach(() => {
    manager = createThemeVersionManager();
    manager.createVersion("theme-1", createTestState(), "1.0.0", "Initial Release");
    manager.recordChange("theme-1", {
      category: "colors",
      description: "Changed primary color",
      path: "colors.primary",
      oldValue: "#3b82f6",
      newValue: "#7c3aed",
    });
    manager.commitVersion("theme-1", "patch", "Color update", createTestState());
  });

  describe("formatVersionHistory", () => {
    it("formats history for display", () => {
      const history = manager.getHistory("theme-1")!;
      const formatted = formatVersionHistory(history);

      expect(formatted).toContain("theme-1");
      expect(formatted).toContain("1.0.1");
      expect(formatted).toContain("Version History");
    });
  });

  describe("formatVersionDiff", () => {
    it("formats diff for display", () => {
      const diff = manager.diffVersions("theme-1", "1.0.0", "1.0.1")!;
      const formatted = formatVersionDiff(diff);

      expect(formatted).toContain("1.0.0");
      expect(formatted).toContain("1.0.1");
      expect(formatted).toContain("Changes by Category");
    });

    it("shows breaking changes warning", () => {
      manager.recordChange("theme-1", {
        category: "breaking",
        description: "Breaking change",
        path: "config.api",
        oldValue: "v1",
        newValue: "v2",
      });
      manager.commitVersion("theme-1", "major", "Major update", createTestState());

      const diff = manager.diffVersions("theme-1", "1.0.1", "2.0.0")!;
      const formatted = formatVersionDiff(diff);

      expect(formatted).toContain("BREAKING");
    });
  });
});

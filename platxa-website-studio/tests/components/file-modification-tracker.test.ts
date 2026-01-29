import { describe, it, expect } from "vitest";
import {
  MODIFICATION_STATUS,
  groupModificationsByDirectory,
  getModificationSummary,
  getFileName,
  type TrackedModification,
  type ModificationAction,
} from "@/components/chat/FileModificationTracker";

describe("FileModificationTracker", () => {
  describe("collapsible list updates with add/edit/delete status (Feature #98)", () => {
    it("defines status configuration for add action", () => {
      // Feature #98: Shows add status
      expect(MODIFICATION_STATUS.add).toBeDefined();
      expect(MODIFICATION_STATUS.add.label).toBe("Added");
      expect(MODIFICATION_STATUS.add.shortLabel).toBe("A");
    });

    it("defines status configuration for edit action", () => {
      // Feature #98: Shows edit status
      expect(MODIFICATION_STATUS.edit).toBeDefined();
      expect(MODIFICATION_STATUS.edit.label).toBe("Modified");
      expect(MODIFICATION_STATUS.edit.shortLabel).toBe("M");
    });

    it("defines status configuration for delete action", () => {
      // Feature #98: Shows delete status
      expect(MODIFICATION_STATUS.delete).toBeDefined();
      expect(MODIFICATION_STATUS.delete.label).toBe("Deleted");
      expect(MODIFICATION_STATUS.delete.shortLabel).toBe("D");
    });

    it("each status has icon, color, and bgColor for visual display", () => {
      // Feature #98: Visual status indicators
      const actions: ModificationAction[] = ["add", "edit", "delete"];
      for (const action of actions) {
        const status = MODIFICATION_STATUS[action];
        expect(status.icon).toBeDefined();
        expect(status.color).toBeTruthy();
        expect(status.bgColor).toBeTruthy();
      }
    });

    it("getModificationSummary counts files by action type", () => {
      // Feature #98: List updates as files are modified (summary counts)
      const modifications: TrackedModification[] = [
        { path: "src/new.ts", action: "add", timestamp: new Date() },
        { path: "src/edit.ts", action: "edit", timestamp: new Date() },
        { path: "src/old.ts", action: "delete", timestamp: new Date() },
        { path: "src/another.ts", action: "add", timestamp: new Date() },
      ];

      const summary = getModificationSummary(modifications);

      expect(summary.add).toBe(2);
      expect(summary.edit).toBe(1);
      expect(summary.delete).toBe(1);
    });
  });

  describe("MODIFICATION_STATUS", () => {
    it("has distinct colors for each action type", () => {
      expect(MODIFICATION_STATUS.add.color).toContain("emerald");
      expect(MODIFICATION_STATUS.edit.color).toContain("amber");
      expect(MODIFICATION_STATUS.delete.color).toContain("red");
    });

    it("has border colors for styling", () => {
      expect(MODIFICATION_STATUS.add.borderColor).toBeTruthy();
      expect(MODIFICATION_STATUS.edit.borderColor).toBeTruthy();
      expect(MODIFICATION_STATUS.delete.borderColor).toBeTruthy();
    });
  });

  describe("groupModificationsByDirectory", () => {
    it("groups files by their directory", () => {
      const modifications: TrackedModification[] = [
        { path: "src/components/Button.tsx", action: "edit", timestamp: new Date() },
        { path: "src/components/Input.tsx", action: "add", timestamp: new Date() },
        { path: "src/utils/helpers.ts", action: "edit", timestamp: new Date() },
        { path: "README.md", action: "edit", timestamp: new Date() },
      ];

      const groups = groupModificationsByDirectory(modifications);

      expect(groups.get("src/components")?.length).toBe(2);
      expect(groups.get("src/utils")?.length).toBe(1);
      expect(groups.get(".")?.length).toBe(1); // Root files
    });

    it("handles empty array", () => {
      const groups = groupModificationsByDirectory([]);
      expect(groups.size).toBe(0);
    });

    it("handles files in root directory", () => {
      const modifications: TrackedModification[] = [
        { path: "package.json", action: "edit", timestamp: new Date() },
        { path: "tsconfig.json", action: "edit", timestamp: new Date() },
      ];

      const groups = groupModificationsByDirectory(modifications);

      expect(groups.get(".")?.length).toBe(2);
    });
  });

  describe("getModificationSummary", () => {
    it("returns zero counts for empty array", () => {
      const summary = getModificationSummary([]);

      expect(summary.add).toBe(0);
      expect(summary.edit).toBe(0);
      expect(summary.delete).toBe(0);
    });

    it("correctly counts multiple modifications of same type", () => {
      const modifications: TrackedModification[] = [
        { path: "a.ts", action: "add", timestamp: new Date() },
        { path: "b.ts", action: "add", timestamp: new Date() },
        { path: "c.ts", action: "add", timestamp: new Date() },
      ];

      const summary = getModificationSummary(modifications);

      expect(summary.add).toBe(3);
      expect(summary.edit).toBe(0);
      expect(summary.delete).toBe(0);
    });

    it("counts all action types correctly", () => {
      const modifications: TrackedModification[] = [
        { path: "new1.ts", action: "add", timestamp: new Date() },
        { path: "new2.ts", action: "add", timestamp: new Date() },
        { path: "mod1.ts", action: "edit", timestamp: new Date() },
        { path: "mod2.ts", action: "edit", timestamp: new Date() },
        { path: "mod3.ts", action: "edit", timestamp: new Date() },
        { path: "del1.ts", action: "delete", timestamp: new Date() },
      ];

      const summary = getModificationSummary(modifications);

      expect(summary.add).toBe(2);
      expect(summary.edit).toBe(3);
      expect(summary.delete).toBe(1);
    });
  });

  describe("getFileName", () => {
    it("extracts filename from full path", () => {
      expect(getFileName("src/components/Button.tsx")).toBe("Button.tsx");
      expect(getFileName("lib/utils/helpers.ts")).toBe("helpers.ts");
    });

    it("handles root files", () => {
      expect(getFileName("package.json")).toBe("package.json");
      expect(getFileName("README.md")).toBe("README.md");
    });

    it("handles deeply nested paths", () => {
      expect(getFileName("a/b/c/d/e/file.ts")).toBe("file.ts");
    });

    it("handles empty string", () => {
      expect(getFileName("")).toBe("");
    });
  });

  describe("TrackedModification type", () => {
    it("supports add action with new content", () => {
      const mod: TrackedModification = {
        path: "src/new.ts",
        action: "add",
        timestamp: new Date(),
        newContent: "export const x = 1;",
      };

      expect(mod.action).toBe("add");
      expect(mod.newContent).toBeTruthy();
      expect(mod.previousContent).toBeUndefined();
    });

    it("supports edit action with both previous and new content", () => {
      const mod: TrackedModification = {
        path: "src/edit.ts",
        action: "edit",
        timestamp: new Date(),
        previousContent: "const x = 1;",
        newContent: "const x = 2;",
      };

      expect(mod.action).toBe("edit");
      expect(mod.previousContent).toBeTruthy();
      expect(mod.newContent).toBeTruthy();
    });

    it("supports delete action with previous content", () => {
      const mod: TrackedModification = {
        path: "src/old.ts",
        action: "delete",
        timestamp: new Date(),
        previousContent: "export const old = true;",
      };

      expect(mod.action).toBe("delete");
      expect(mod.previousContent).toBeTruthy();
      expect(mod.newContent).toBeUndefined();
    });
  });
});

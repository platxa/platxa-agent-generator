import { describe, it, expect } from "vitest";
import {
  getVersionHops,
  getBreakingChanges,
  generateScript,
  generateMigration,
} from "@/lib/agent-bridge/migration-generator";
import type { MigrationStep } from "@/lib/agent-bridge/migration-generator";

describe("Migration Generator", () => {
  describe("getVersionHops", () => {
    it("returns single hop for adjacent versions", () => {
      const hops = getVersionHops("16.0", "17.0");
      expect(hops).toEqual([["16.0", "17.0"]]);
    });

    it("returns two hops for 16→18", () => {
      const hops = getVersionHops("16.0", "18.0");
      expect(hops).toEqual([
        ["16.0", "17.0"],
        ["17.0", "18.0"],
      ]);
    });

    it("returns empty for same version", () => {
      expect(getVersionHops("17.0", "17.0")).toEqual([]);
    });

    it("returns empty for downgrade", () => {
      expect(getVersionHops("18.0", "16.0")).toEqual([]);
    });

    it("single hop 17→18", () => {
      expect(getVersionHops("17.0", "18.0")).toEqual([["17.0", "18.0"]]);
    });
  });

  describe("getBreakingChanges", () => {
    it("returns changes for 16→17", () => {
      const changes = getBreakingChanges("16.0", "17.0");
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.every((c) => c.fromVersion === "16.0" && c.toVersion === "17.0")).toBe(true);
    });

    it("returns changes for 17→18", () => {
      const changes = getBreakingChanges("17.0", "18.0");
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.every((c) => c.fromVersion === "17.0" && c.toVersion === "18.0")).toBe(true);
    });

    it("returns empty for non-adjacent versions", () => {
      expect(getBreakingChanges("16.0", "18.0")).toEqual([]);
    });

    it("includes asset bundle rename for 16→17", () => {
      const changes = getBreakingChanges("16.0", "17.0");
      const assetChange = changes.find((c) => c.category === "asset");
      expect(assetChange).toBeDefined();
      expect(assetChange!.preMigration).toBeDefined();
      expect(assetChange!.preMigration!.critical).toBe(true);
    });

    it("includes route backup for 17→18", () => {
      const changes = getBreakingChanges("17.0", "18.0");
      const templateChange = changes.find((c) => c.category === "template");
      expect(templateChange).toBeDefined();
      expect(templateChange!.preMigration).toBeDefined();
    });
  });

  describe("generateScript", () => {
    const steps: MigrationStep[] = [
      { description: "Do something", code: "    env.cr.execute('SELECT 1')", critical: true },
      { description: "Log info", code: "    _logger.info('done')", critical: false },
    ];

    it("generates valid Python with header", () => {
      const script = generateScript("pre", "16.0", "17.0", "theme_test", steps);
      expect(script.content).toContain("import logging");
      expect(script.content).toContain("def migrate(env, version):");
      expect(script.content).toContain("theme_test");
    });

    it("sets correct file path", () => {
      const script = generateScript("pre", "16.0", "17.0", "theme_test", steps);
      expect(script.filePath).toBe("migrations/17.0/pre-migrate.py");
    });

    it("sets post file path", () => {
      const script = generateScript("post", "17.0", "18.0", "theme_test", steps);
      expect(script.filePath).toBe("migrations/18.0/post-migrate.py");
    });

    it("wraps critical steps with raise", () => {
      const script = generateScript("pre", "16.0", "17.0", "theme_test", steps);
      expect(script.content).toContain("raise");
    });

    it("wraps non-critical steps with warning", () => {
      const script = generateScript("post", "16.0", "17.0", "theme_test", steps);
      expect(script.content).toContain("warning");
    });

    it("generates no-op script for empty steps", () => {
      const script = generateScript("pre", "16.0", "17.0", "theme_test", []);
      expect(script.content).toContain("No pre-migration steps needed");
      expect(script.steps).toHaveLength(0);
    });

    it("preserves phase and versions in metadata", () => {
      const script = generateScript("post", "17.0", "18.0", "theme_foo", steps);
      expect(script.phase).toBe("post");
      expect(script.fromVersion).toBe("17.0");
      expect(script.toVersion).toBe("18.0");
    });
  });

  describe("generateMigration", () => {
    it("generates pre and post scripts for single hop", () => {
      const result = generateMigration("theme_starter", "16.0", "17.0");
      expect(result.hops).toBe(1);
      expect(result.scripts.length).toBe(2);
      expect(result.scripts[0].phase).toBe("pre");
      expect(result.scripts[1].phase).toBe("post");
    });

    it("generates 4 scripts for two-hop upgrade", () => {
      const result = generateMigration("theme_starter", "16.0", "18.0");
      expect(result.hops).toBe(2);
      expect(result.scripts.length).toBe(4);
      // 16→17 pre, 16→17 post, 17→18 pre, 17→18 post
      expect(result.scripts[0].filePath).toBe("migrations/17.0/pre-migrate.py");
      expect(result.scripts[1].filePath).toBe("migrations/17.0/post-migrate.py");
      expect(result.scripts[2].filePath).toBe("migrations/18.0/pre-migrate.py");
      expect(result.scripts[3].filePath).toBe("migrations/18.0/post-migrate.py");
    });

    it("sets module name in result", () => {
      const result = generateMigration("theme_starter", "17.0", "18.0");
      expect(result.moduleName).toBe("theme_starter");
    });

    it("pre-migration scripts contain actual breaking change steps", () => {
      const result = generateMigration("theme_starter", "16.0", "17.0");
      const preScript = result.scripts.find((s) => s.phase === "pre")!;
      expect(preScript.steps.length).toBeGreaterThan(0);
      // Asset bundle rename is a pre-migration step for 16→17
      expect(preScript.content).toContain("assets_frontend");
    });

    it("post-migration scripts contain breaking change steps", () => {
      const result = generateMigration("theme_starter", "16.0", "17.0");
      const postScript = result.scripts.find((s) => s.phase === "post")!;
      expect(postScript.steps.length).toBeGreaterThan(0);
    });

    it("returns 0 hops for same version", () => {
      const result = generateMigration("theme_test", "17.0", "17.0");
      expect(result.hops).toBe(0);
      expect(result.scripts).toHaveLength(0);
    });

    it("all scripts contain valid Python def migrate", () => {
      const result = generateMigration("theme_starter", "16.0", "18.0");
      for (const script of result.scripts) {
        expect(script.content).toContain("def migrate(env, version):");
      }
    });

    it("module name appears in generated Python code", () => {
      const result = generateMigration("theme_custom", "17.0", "18.0");
      for (const script of result.scripts) {
        expect(script.content).toContain("theme_custom");
      }
    });
  });
});

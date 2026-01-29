// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PreDeployValidator,
  createValidator,
  createMockValidator,
  createMockFileSystem,
  parseManifest,
  validateXml,
  validateScss,
  createCheckResult,
  createPassedCheck,
  createFailedCheck,
  createIssue,
  runPreDeployChecklist,
  type ValidationResult,
  type ValidationEvent,
  type CheckResult,
  type ManifestData,
} from "@/lib/preview/pre-deploy-validator";

describe("PreDeployValidator", () => {
  describe("Pre-deploy validation checklist (Feature #178)", () => {
    it("validates manifest is correct", async () => {
      // Feature #178: Validates manifest correct
      const validator = createMockValidator({}, {
        "/module/__manifest__.py": `{
          'name': 'Test Module',
          'version': '16.0.1.0.0',
          'depends': ['base'],
          'data': [],
          'license': 'LGPL-3',
        }`,
      });

      const result = await validator.validateManifest("/module");

      expect(result.status).toBe("passed");
    });

    it("validates all files exist", async () => {
      // Feature #178: Validates all files exist
      const validator = createMockValidator({}, {
        "/module/__manifest__.py": `{
          'name': 'Test Module',
          'version': '16.0.1.0.0',
          'depends': ['base'],
          'data': ['views/template.xml'],
        }`,
        "/module/views/template.xml": "<odoo><template id='test'/></odoo>",
      });

      const result = await validator.validate("test_module", "/module");

      expect(result.success).toBe(true);
      const filesCheck = result.checks.find((c) => c.type === "files");
      expect(filesCheck?.status).toBe("passed");
    });

    it("validates QWeb is valid XML", async () => {
      // Feature #178: Validates QWeb valid
      const validator = createMockValidator({}, {
        "/module/__manifest__.py": `{
          'name': 'Test Module',
          'version': '16.0.1.0.0',
          'depends': ['base'],
          'data': ['views/template.xml'],
        }`,
        "/module/views/template.xml": `<odoo>
          <template id="test_template">
            <div t-if="condition">Content</div>
          </template>
        </odoo>`,
      });

      const result = await validator.validateQweb("/module");

      expect(result.status).toBe("passed");
    });

    it("validates SCSS compiles", async () => {
      // Feature #178: Validates SCSS compiles
      const validator = createMockValidator({}, {
        "/module/__manifest__.py": `{
          'name': 'Test Module',
          'version': '16.0.1.0.0',
          'depends': ['base'],
          'assets': {
            'web.assets_frontend': ['static/src/scss/style.scss']
          },
        }`,
        "/module/static/src/scss/style.scss": `.container {
          display: flex;
          .item {
            color: red;
          }
        }`,
      });

      const result = await validator.validateScss("/module");

      expect(result.status).toBe("passed");
    });

    it("runs full validation checklist", async () => {
      // Feature #178: Full validation checklist
      const files = {
        "/module/__manifest__.py": `{
          'name': 'Test Module',
          'version': '16.0.1.0.0',
          'depends': ['base'],
          'data': ['views/template.xml'],
          'assets': {
            'web.assets_frontend': ['static/src/scss/style.scss']
          },
          'license': 'LGPL-3',
        }`,
        "/module/views/template.xml": "<odoo><template id='test'/></odoo>",
        "/module/static/src/scss/style.scss": ".test { color: blue; }",
      };

      const result = await runPreDeployChecklist(
        "test_module",
        "/module",
        createMockFileSystem(files)
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("passed");
    });
  });

  describe("parseManifest", () => {
    it("parses valid manifest", () => {
      const content = `{
        'name': 'Test Module',
        'version': '16.0.1.0.0',
        'depends': ['base', 'web'],
        'installable': True,
        'auto_install': False,
      }`;

      const manifest = parseManifest(content);

      expect(manifest).not.toBeNull();
      expect(manifest?.name).toBe("Test Module");
      expect(manifest?.version).toBe("16.0.1.0.0");
      expect(manifest?.depends).toEqual(["base", "web"]);
      expect(manifest?.installable).toBe(true);
      expect(manifest?.auto_install).toBe(false);
    });

    it("handles None values", () => {
      const content = `{
        'name': 'Test',
        'version': '1.0.0',
        'depends': ['base'],
        'description': None,
      }`;

      const manifest = parseManifest(content);

      expect(manifest).not.toBeNull();
      expect(manifest?.description).toBeNull();
    });

    it("returns null for invalid content", () => {
      const manifest = parseManifest("not a dict");

      expect(manifest).toBeNull();
    });

    it("handles trailing commas", () => {
      const content = `{
        'name': 'Test',
        'version': '1.0.0',
        'depends': ['base',],
      }`;

      const manifest = parseManifest(content);

      expect(manifest).not.toBeNull();
    });
  });

  describe("validateXml", () => {
    it("passes valid XML", () => {
      const content = `<odoo>
        <template id="test">
          <div>Content</div>
        </template>
      </odoo>`;

      const issues = validateXml(content);

      expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    });

    it("detects unclosed tags", () => {
      const content = `<odoo>
        <template id="test">
          <div>Content
        </template>
      </odoo>`;

      const issues = validateXml(content);

      expect(issues.some((i) => i.message.includes("Unclosed tag"))).toBe(true);
    });

    it("detects mismatched tags", () => {
      const content = `<odoo>
        <template id="test">
          <div>Content</span>
        </template>
      </odoo>`;

      const issues = validateXml(content);

      expect(issues.some((i) => i.message.includes("Mismatched"))).toBe(true);
    });

    it("handles self-closing tags", () => {
      const content = `<odoo>
        <template id="test">
          <input type="text"/>
          <br/>
        </template>
      </odoo>`;

      const issues = validateXml(content);

      expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    });

    it("detects empty content", () => {
      const issues = validateXml("");

      expect(issues.some((i) => i.message.includes("Empty"))).toBe(true);
    });
  });

  describe("validateScss", () => {
    it("passes valid SCSS", () => {
      const content = `.container {
        display: flex;
        .item {
          color: red;
        }
      }`;

      const issues = validateScss(content);

      expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    });

    it("detects unclosed braces", () => {
      const content = `.container {
        display: flex;
        .item {
          color: red;
      }`;

      const issues = validateScss(content);

      expect(issues.some((i) => i.message.includes("Unclosed brace"))).toBe(true);
    });

    it("detects extra closing braces", () => {
      const content = `.container {
        display: flex;
      }}`;

      const issues = validateScss(content);

      expect(issues.some((i) => i.message.includes("Unexpected closing brace"))).toBe(true);
    });

    it("warns about possible missing semicolons", () => {
      const content = `.container {
        display: flex
        color: red;
      }`;

      const issues = validateScss(content);

      expect(issues.some((i) => i.message.includes("semicolon"))).toBe(true);
    });

    it("handles empty content", () => {
      const issues = validateScss("");

      expect(issues.some((i) => i.message.includes("Empty"))).toBe(true);
    });
  });

  describe("createCheckResult", () => {
    it("creates pending check result", () => {
      const result = createCheckResult("manifest", "Test check");

      expect(result.type).toBe("manifest");
      expect(result.name).toBe("Test check");
      expect(result.status).toBe("pending");
    });
  });

  describe("createPassedCheck", () => {
    it("creates passed check result", () => {
      const result = createPassedCheck("qweb", "QWeb check", 100, ["file.xml"]);

      expect(result.status).toBe("passed");
      expect(result.duration).toBe(100);
      expect(result.filesChecked).toContain("file.xml");
    });

    it("sets warning status when warnings present", () => {
      const result = createPassedCheck("qweb", "QWeb check", 100, [], ["Warning"]);

      expect(result.status).toBe("warning");
      expect(result.warnings).toContain("Warning");
    });
  });

  describe("createFailedCheck", () => {
    it("creates failed check result", () => {
      const issues = [createIssue("error", "Test error")];
      const result = createFailedCheck("manifest", "Manifest check", 50, "Error", issues);

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Error");
      expect(result.issues).toHaveLength(1);
    });
  });

  describe("createIssue", () => {
    it("creates validation issue", () => {
      const issue = createIssue("error", "Test error", "/path/file.xml", 10, "Fix it");

      expect(issue.severity).toBe("error");
      expect(issue.message).toBe("Test error");
      expect(issue.file).toBe("/path/file.xml");
      expect(issue.line).toBe(10);
      expect(issue.suggestion).toBe("Fix it");
    });
  });

  describe("createMockFileSystem", () => {
    it("checks file existence", async () => {
      const fs = createMockFileSystem({
        "/path/file.txt": "content",
      });

      expect(await fs.exists("/path/file.txt")).toBe(true);
      expect(await fs.exists("/path/other.txt")).toBe(false);
    });

    it("reads file content", async () => {
      const fs = createMockFileSystem({
        "/path/file.txt": "test content",
      });

      const content = await fs.readFile("/path/file.txt");

      expect(content).toBe("test content");
    });

    it("throws on missing file", async () => {
      const fs = createMockFileSystem({});

      await expect(fs.readFile("/missing.txt")).rejects.toThrow("not found");
    });

    it("lists directory contents", async () => {
      const fs = createMockFileSystem({
        "/dir/file1.txt": "a",
        "/dir/file2.txt": "b",
        "/dir/subdir/file3.txt": "c",
      });

      const files = await fs.readDir("/dir");

      expect(files).toContain("file1.txt");
      expect(files).toContain("file2.txt");
      expect(files).toContain("subdir");
    });

    it("checks if path is directory", async () => {
      const fs = createMockFileSystem({
        "/dir/file.txt": "content",
      });

      expect(await fs.isDirectory("/dir")).toBe(true);
      expect(await fs.isDirectory("/dir/file.txt")).toBe(false);
    });
  });

  describe("PreDeployValidator class", () => {
    let validator: PreDeployValidator;

    beforeEach(() => {
      validator = createMockValidator({}, {
        "/module/__manifest__.py": `{
          'name': 'Test Module',
          'version': '16.0.1.0.0',
          'depends': ['base'],
          'data': ['views/template.xml'],
          'license': 'LGPL-3',
        }`,
        "/module/views/template.xml": "<odoo><template id='test'/></odoo>",
      });
    });

    describe("validate", () => {
      it("returns successful result for valid module", async () => {
        const result = await validator.validate("test_module", "/module");

        expect(result.success).toBe(true);
        expect(result.moduleName).toBe("test_module");
        expect(result.modulePath).toBe("/module");
      });

      it("includes all check results", async () => {
        const result = await validator.validate("test_module", "/module");

        expect(result.checks.length).toBeGreaterThan(0);
        expect(result.checks.some((c) => c.type === "manifest")).toBe(true);
        expect(result.checks.some((c) => c.type === "files")).toBe(true);
        expect(result.checks.some((c) => c.type === "qweb")).toBe(true);
      });

      it("calculates summary correctly", async () => {
        const result = await validator.validate("test_module", "/module");

        expect(result.summary.total).toBe(result.checks.length);
        expect(result.summary.passed + result.summary.failed + result.summary.warnings + result.summary.skipped)
          .toBe(result.summary.total);
      });

      it("fails when manifest missing", async () => {
        validator = createMockValidator({}, {});

        const result = await validator.validate("test_module", "/module");

        expect(result.success).toBe(false);
        expect(result.checks.some((c) => c.type === "manifest" && c.status === "failed")).toBe(true);
      });

      it("fails when referenced file missing", async () => {
        validator = createMockValidator({}, {
          "/module/__manifest__.py": `{
            'name': 'Test',
            'version': '1.0.0',
            'depends': ['base'],
            'data': ['views/missing.xml'],
          }`,
        });

        const result = await validator.validate("test_module", "/module");

        expect(result.success).toBe(false);
        const filesCheck = result.checks.find((c) => c.type === "files");
        expect(filesCheck?.status).toBe("failed");
      });

      it("emits validation:start event", async () => {
        const events: ValidationEvent[] = [];
        validator.onEvent((e) => events.push(e));

        await validator.validate("test_module", "/module");

        expect(events.some((e) => e.type === "validation:start")).toBe(true);
      });

      it("emits validation:complete event", async () => {
        const events: ValidationEvent[] = [];
        validator.onEvent((e) => events.push(e));

        await validator.validate("test_module", "/module");

        expect(events.some((e) => e.type === "validation:complete")).toBe(true);
      });

      it("emits check:start and check:complete events", async () => {
        const events: ValidationEvent[] = [];
        validator.onEvent((e) => events.push(e));

        await validator.validate("test_module", "/module");

        expect(events.some((e) => e.type === "check:start")).toBe(true);
        expect(events.some((e) => e.type === "check:complete")).toBe(true);
      });
    });

    describe("manifest validation", () => {
      it("detects missing required fields", async () => {
        validator = createMockValidator({}, {
          "/module/__manifest__.py": `{
            'name': 'Test',
          }`,
        });

        const result = await validator.validateManifest("/module");

        expect(result.status).toBe("failed");
        expect(result.issues?.some((i) => i.message.includes("version"))).toBe(true);
        expect(result.issues?.some((i) => i.message.includes("depends"))).toBe(true);
      });

      it("warns about invalid version format", async () => {
        validator = createMockValidator({}, {
          "/module/__manifest__.py": `{
            'name': 'Test',
            'version': 'invalid',
            'depends': ['base'],
          }`,
        });

        const result = await validator.validateManifest("/module");

        expect(result.warnings?.some((w) => w.includes("version format"))).toBe(true);
      });

      it("warns about missing license", async () => {
        validator = createMockValidator({}, {
          "/module/__manifest__.py": `{
            'name': 'Test',
            'version': '16.0.1.0.0',
            'depends': ['base'],
          }`,
        });

        const result = await validator.validateManifest("/module");

        expect(result.warnings?.some((w) => w.includes("license"))).toBe(true);
      });
    });

    describe("QWeb validation", () => {
      it("detects invalid XML", async () => {
        validator = createMockValidator({}, {
          "/module/__manifest__.py": `{
            'name': 'Test',
            'version': '16.0.1.0.0',
            'depends': ['base'],
            'data': ['views/broken.xml'],
          }`,
          "/module/views/broken.xml": "<odoo><template>unclosed",
        });

        const result = await validator.validateQweb("/module");

        expect(result.status).toBe("failed");
      });
    });

    describe("SCSS validation", () => {
      it("detects unclosed braces", async () => {
        validator = createMockValidator({}, {
          "/module/__manifest__.py": `{
            'name': 'Test',
            'version': '16.0.1.0.0',
            'depends': ['base'],
            'assets': {
              'web.assets_frontend': ['static/src/scss/broken.scss']
            },
          }`,
          "/module/static/src/scss/broken.scss": ".test { color: red;",
        });

        const result = await validator.validateScss("/module");

        expect(result.status).toBe("failed");
      });
    });

    describe("continueOnFailure option", () => {
      it("stops on first failure when disabled", async () => {
        validator = createMockValidator({ continueOnFailure: false }, {});

        const result = await validator.validate("test_module", "/module");

        // Only manifest check should run (and fail)
        expect(result.checks.length).toBe(1);
      });

      it("continues after failure when enabled", async () => {
        validator = createMockValidator({ continueOnFailure: true }, {
          "/module/__manifest__.py": "invalid",
        });

        const result = await validator.validate("test_module", "/module");

        // All checks should run
        expect(result.checks.length).toBeGreaterThan(1);
      });
    });

    describe("failOnWarnings option", () => {
      it("succeeds with warnings when disabled", async () => {
        validator = createMockValidator({ failOnWarnings: false }, {
          "/module/__manifest__.py": `{
            'name': 'Test',
            'version': '16.0.1.0.0',
            'depends': ['base'],
          }`, // Missing license (warning)
        });

        const result = await validator.validate("test_module", "/module");

        expect(result.success).toBe(true);
        expect(result.status).toBe("warning");
      });

      it("fails with warnings when enabled", async () => {
        validator = createMockValidator({ failOnWarnings: true }, {
          "/module/__manifest__.py": `{
            'name': 'Test',
            'version': '16.0.1.0.0',
            'depends': ['base'],
          }`, // Missing license (warning)
        });

        const result = await validator.validate("test_module", "/module");

        expect(result.success).toBe(false);
      });
    });

    describe("event callbacks", () => {
      it("registers callback", async () => {
        const callback = vi.fn();
        validator.onEvent(callback);

        await validator.validate("test_module", "/module");

        expect(callback).toHaveBeenCalled();
      });

      it("removes callback", async () => {
        const callback = vi.fn();
        validator.onEvent(callback);
        validator.offEvent(callback);

        await validator.validate("test_module", "/module");

        expect(callback).not.toHaveBeenCalled();
      });

      it("handles callback errors gracefully", async () => {
        validator.onEvent(() => {
          throw new Error("Callback error");
        });

        await expect(
          validator.validate("test_module", "/module")
        ).resolves.not.toThrow();
      });
    });

    describe("config management", () => {
      it("updates configuration", () => {
        validator.updateConfig({ failOnWarnings: true });

        const config = validator.getConfig();
        expect(config.failOnWarnings).toBe(true);
      });

      it("returns config copy", () => {
        const config1 = validator.getConfig();
        const config2 = validator.getConfig();

        expect(config1).not.toBe(config2);
      });
    });
  });

  describe("factory functions", () => {
    it("createValidator creates instance", () => {
      const validator = createValidator();

      expect(validator).toBeInstanceOf(PreDeployValidator);
    });

    it("createMockValidator creates instance with mock fs", async () => {
      const validator = createMockValidator({}, {
        "/module/__manifest__.py": `{
          'name': 'Test',
          'version': '16.0.1.0.0',
          'depends': ['base'],
          'license': 'LGPL-3',
        }`,
      });

      const result = await validator.validateManifest("/module");

      expect(result.status).toBe("passed");
    });
  });

  describe("runPreDeployChecklist", () => {
    it("returns success for valid module", async () => {
      const files = {
        "/module/__manifest__.py": `{
          'name': 'Test',
          'version': '16.0.1.0.0',
          'depends': ['base'],
          'license': 'LGPL-3',
        }`,
      };

      const result = await runPreDeployChecklist(
        "test_module",
        "/module",
        createMockFileSystem(files)
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("passed");
    });

    it("returns failure for invalid module", async () => {
      const result = await runPreDeployChecklist(
        "test_module",
        "/module",
        createMockFileSystem({})
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("failed");
    });
  });
});

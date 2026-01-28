import { describe, it, expect } from "vitest";
import { packageOdooModule } from "@/lib/agent-bridge/odoo-packager";
import type { PackagerInput } from "@/lib/agent-bridge/odoo-packager";

const makeInput = (overrides?: Partial<PackagerInput>): PackagerInput => ({
  themeName: "theme_flavor",
  displayName: "Flavor Theme",
  templates: {
    "header.xml": '<template id="header"><header>Nav</header></template>',
    "footer.xml": '<template id="footer"><footer>Footer</footer></template>',
  },
  styles: {
    "primary.scss": "$o-color-1: #3B82F6;\n.s_hero { color: $o-color-1; }",
  },
  ...overrides,
});

describe("Odoo Module Packager", () => {
  describe("packageOdooModule", () => {
    it("produces __manifest__.py", () => {
      const result = packageOdooModule(makeInput());
      const manifest = result.fileMap["theme_flavor/__manifest__.py"];
      expect(manifest).toBeDefined();
      expect(manifest).toContain('"name": "Flavor Theme"');
      expect(manifest).toContain('"installable": True');
      expect(manifest).toContain('"depends": ["website"]');
    });

    it("produces __init__.py", () => {
      const result = packageOdooModule(makeInput());
      expect(result.fileMap["theme_flavor/__init__.py"]).toBeDefined();
    });

    it("places templates in views/ directory", () => {
      const result = packageOdooModule(makeInput());
      expect(result.fileMap["theme_flavor/views/header.xml"]).toContain("<header>");
      expect(result.fileMap["theme_flavor/views/footer.xml"]).toContain("<footer>");
    });

    it("places styles in static/src/scss/", () => {
      const result = packageOdooModule(makeInput());
      expect(result.fileMap["theme_flavor/static/src/scss/primary.scss"]).toContain("$o-color-1");
    });

    it("places scripts in static/src/js/", () => {
      const result = packageOdooModule(makeInput({
        scripts: { "main.js": "console.log('init');" },
      }));
      expect(result.fileMap["theme_flavor/static/src/js/main.js"]).toContain("console.log");
    });

    it("places assets in static/src/img/ as binary", () => {
      const result = packageOdooModule(makeInput({
        assets: { "logo.png": "iVBORw0KGgo=" },
      }));
      const imgFile = result.files.find((f) => f.path.includes("img/logo.png"));
      expect(imgFile).toBeDefined();
      expect(imgFile!.isBinary).toBe(true);
    });

    it("places data files in data/ directory", () => {
      const result = packageOdooModule(makeInput({
        dataFiles: { "assets.xml": '<data><record/></data>' },
      }));
      expect(result.fileMap["theme_flavor/data/assets.xml"]).toContain("<record/>");
    });

    it("creates banner placeholder in static/description/", () => {
      const result = packageOdooModule(makeInput());
      const banner = result.files.find((f) => f.path.includes("static/description/banner.png"));
      expect(banner).toBeDefined();
      expect(banner!.isBinary).toBe(true);
    });

    it("lists data paths in manifest", () => {
      const result = packageOdooModule(makeInput());
      const manifest = result.fileMap["theme_flavor/__manifest__.py"];
      expect(manifest).toContain("views/header.xml");
      expect(manifest).toContain("views/footer.xml");
    });

    it("lists asset paths in manifest", () => {
      const result = packageOdooModule(makeInput());
      const manifest = result.fileMap["theme_flavor/__manifest__.py"];
      expect(manifest).toContain("/theme_flavor/static/src/scss/primary.scss");
    });

    it("includes all expected directories", () => {
      const result = packageOdooModule(makeInput({
        scripts: { "app.js": "" },
        dataFiles: { "ir_asset.xml": "" },
      }));
      expect(result.directories).toContain("theme_flavor/views");
      expect(result.directories).toContain("theme_flavor/static/src/scss");
      expect(result.directories).toContain("theme_flavor/static/src/js");
      expect(result.directories).toContain("theme_flavor/static/description");
      expect(result.directories).toContain("theme_flavor/data");
    });

    it("warns when no templates provided", () => {
      const result = packageOdooModule(makeInput({ templates: {} }));
      expect(result.warnings.some((w) => w.includes("No template XML"))).toBe(true);
    });

    it("warns when no styles provided", () => {
      const result = packageOdooModule(makeInput({ styles: {} }));
      expect(result.warnings.some((w) => w.includes("No SCSS/CSS"))).toBe(true);
    });

    it("warns when module name doesn't start with theme_", () => {
      const result = packageOdooModule(makeInput({ themeName: "my_module" }));
      expect(result.warnings.some((w) => w.includes("theme_"))).toBe(true);
    });

    it("sanitizes filenames", () => {
      const result = packageOdooModule(makeInput({
        templates: { "path/to/my template!.xml": "<div/>" },
      }));
      const viewFiles = result.files.filter((f) => f.path.includes("views/"));
      expect(viewFiles[0].path).toMatch(/^[a-zA-Z0-9/_.-]+$/);
    });

    it("includes custom manifest fields", () => {
      const result = packageOdooModule(makeInput({
        author: "Test Author",
        version: "16.0.2.0.0",
        website: "https://example.com",
        license: "OPL-1",
        depends: ["website", "web_editor"],
      }));
      const manifest = result.fileMap["theme_flavor/__manifest__.py"];
      expect(manifest).toContain('"author": "Test Author"');
      expect(manifest).toContain('"version": "16.0.2.0.0"');
      expect(manifest).toContain('"website": "https://example.com"');
      expect(manifest).toContain('"license": "OPL-1"');
      expect(manifest).toContain('"website"');
      expect(manifest).toContain('"web_editor"');
    });

    it("returns correct moduleName", () => {
      const result = packageOdooModule(makeInput());
      expect(result.moduleName).toBe("theme_flavor");
    });
  });
});

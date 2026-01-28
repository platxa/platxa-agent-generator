import { describe, it, expect } from "vitest";
import {
  SUPPORTED_VERSIONS,
  adaptManifest,
  adaptTemplate,
  adaptScss,
  adaptForVersion,
  adaptForAllVersions,
} from "@/lib/agent-bridge/odoo-compat";
import type { ThemeDefinition, OdooVersion } from "@/lib/agent-bridge/odoo-compat";

const makeDef = (overrides?: Partial<ThemeDefinition>): ThemeDefinition => ({
  themeName: "theme_flavor",
  displayName: "Flavor Theme",
  templates: {
    "header.xml": '<template id="header"><header>Nav</header></template>',
  },
  styles: {
    "primary.scss": "$o-color-1: #3B82F6;\n.s_hero { color: $o-color-1; }",
  },
  ...overrides,
});

describe("Odoo Version Compatibility", () => {
  describe("SUPPORTED_VERSIONS", () => {
    it("includes 16.0, 17.0, and 18.0", () => {
      expect(SUPPORTED_VERSIONS).toEqual(["16.0", "17.0", "18.0"]);
    });
  });

  describe("adaptManifest", () => {
    it("sets version prefix matching Odoo version", () => {
      for (const v of SUPPORTED_VERSIONS) {
        const { manifest } = adaptManifest(makeDef(), v);
        expect(manifest).toContain(`"version": "${v}.1.0.0"`);
      }
    });

    it("includes license key for all versions", () => {
      for (const v of SUPPORTED_VERSIONS) {
        const { manifest } = adaptManifest(makeDef(), v);
        expect(manifest).toContain('"license":');
      }
    });

    it("registers assets in manifest", () => {
      const { manifest } = adaptManifest(makeDef(), "16.0");
      expect(manifest).toContain('"assets"');
      expect(manifest).toContain("web.assets_frontend");
      expect(manifest).toContain("/theme_flavor/static/src/scss/primary.scss");
    });

    it("lists template data paths", () => {
      const { manifest } = adaptManifest(makeDef(), "16.0");
      expect(manifest).toContain("views/header.xml");
    });

    it("includes depends", () => {
      const { manifest } = adaptManifest(makeDef({ depends: ["website", "web_editor"] }), "17.0");
      expect(manifest).toContain('"website"');
      expect(manifest).toContain('"web_editor"');
    });

    it("reports changes made", () => {
      const { changes } = adaptManifest(makeDef(), "16.0");
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some((c) => c.includes("16.0"))).toBe(true);
    });
  });

  describe("adaptTemplate", () => {
    it("returns content for all versions", () => {
      const xml = '<template id="test"><div>Hello</div></template>';
      for (const v of SUPPORTED_VERSIONS) {
        const { content } = adaptTemplate(xml, v);
        expect(content).toContain("<div>Hello</div>");
      }
    });

    it("notes inherit_id compatibility for 17+", () => {
      const xml = '<template inherit_id="website.layout"><xpath/></template>';
      const { changes } = adaptTemplate(xml, "17.0");
      expect(changes.some((c) => c.includes("inherit_id"))).toBe(true);
    });
  });

  describe("adaptScss", () => {
    it("returns content for all versions", () => {
      const scss = "$o-color-1: #333;\n.header { color: $o-color-1; }";
      for (const v of SUPPORTED_VERSIONS) {
        const { content } = adaptScss(scss, v);
        expect(content).toContain("$o-color-1");
      }
    });

    it("verifies $o-color-X stability for 18.0", () => {
      const scss = "$o-color-1: red;";
      const { changes } = adaptScss(scss, "18.0");
      expect(changes.some((c) => c.includes("$o-color-X"))).toBe(true);
    });

    it("warns about @import for 17+", () => {
      const scss = '@import "variables";';
      const { changes } = adaptScss(scss, "17.0");
      expect(changes.some((c) => c.includes("@import"))).toBe(true);
    });
  });

  describe("adaptForVersion", () => {
    it("produces complete file map for each version", () => {
      for (const v of SUPPORTED_VERSIONS) {
        const output = adaptForVersion(makeDef(), v);
        expect(output.version).toBe(v);
        expect(output.files["__manifest__.py"]).toBeDefined();
        expect(output.files["__init__.py"]).toBeDefined();
        expect(output.files["views/header.xml"]).toBeDefined();
        expect(output.files["static/src/scss/primary.scss"]).toBeDefined();
      }
    });

    it("includes scripts when provided", () => {
      const output = adaptForVersion(makeDef({ scripts: { "app.js": "init();" } }), "16.0");
      expect(output.files["static/src/js/app.js"]).toBe("init();");
    });

    it("includes data files when provided", () => {
      const output = adaptForVersion(makeDef({ dataFiles: { "ir_asset.xml": "<data/>" } }), "16.0");
      expect(output.files["data/ir_asset.xml"]).toBe("<data/>");
    });

    it("collects all adaptations", () => {
      const output = adaptForVersion(makeDef(), "16.0");
      expect(output.adaptations.version).toBe("16.0");
      expect(output.adaptations.changes.length).toBeGreaterThan(0);
    });
  });

  describe("adaptForAllVersions", () => {
    it("produces output for all 3 supported versions", () => {
      const outputs = adaptForAllVersions(makeDef());
      expect(outputs).toHaveLength(3);
      expect(outputs.map((o) => o.version)).toEqual(["16.0", "17.0", "18.0"]);
    });

    it("each output has valid manifest with correct version", () => {
      const outputs = adaptForAllVersions(makeDef());
      for (const output of outputs) {
        expect(output.files["__manifest__.py"]).toContain(output.version);
      }
    });

    it("same theme definition produces valid modules for all versions", () => {
      const def = makeDef({
        scripts: { "theme.js": "odoo.define('theme_flavor', function() {});" },
        dataFiles: { "assets.xml": "<data><record/></data>" },
      });
      const outputs = adaptForAllVersions(def);

      for (const output of outputs) {
        // Has all required files
        expect(output.files["__manifest__.py"]).toBeTruthy();
        expect(output.files["__init__.py"]).toBeDefined();
        expect(output.files["views/header.xml"]).toBeTruthy();
        expect(output.files["static/src/scss/primary.scss"]).toBeTruthy();
        expect(output.files["static/src/js/theme.js"]).toBeTruthy();
        expect(output.files["data/assets.xml"]).toBeTruthy();
        // Manifest has correct version
        expect(output.files["__manifest__.py"]).toContain(`"version": "${output.version}.1.0.0"`);
      }
    });
  });
});

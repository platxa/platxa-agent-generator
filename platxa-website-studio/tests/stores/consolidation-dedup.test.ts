import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { consolidateExportFiles, type ParsedFile } from "@/lib/ai/parser";
import { useEditorStore } from "@/lib/stores/editor-store";

/**
 * Consolidation deduplication tests.
 *
 * Validates that:
 *   - consolidateExportFiles() in parser.ts is the SINGLE source of truth
 *   - EditorStore.openGeneratedFiles stores files as-is (no re-consolidation)
 *   - Odoo asset-bundle-specific SCSS files are preserved separately
 *   - Duplicate XML templates are merged by template ID
 *   - Generic SCSS files are merged or normalized to theme.scss
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(path: string, content: string, language: string): ParsedFile {
  return { path, content, language, action: "create" };
}

function resetEditorStore() {
  act(() => {
    useEditorStore.setState(useEditorStore.getInitialState());
  });
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const PRIMARY_VARS_CONTENT = `$o-color-palettes: (
  1: (
    'o-color-1': #2C3E50,
    'o-color-2': #E74C3C,
    'o-color-3': #ECF0F1,
    'o-color-4': #FFFFFF,
    'o-color-5': #333333,
  ),
);`;

const BOOTSTRAP_OVERRIDDEN_CONTENT = `$font-family-base: 'Inter', sans-serif;
$headings-font-family: 'Playfair Display', serif;
$border-radius: 0.5rem;`;

const THEME_SCSS_CONTENT = `.s_hero { padding: 80px 0; }
.s_features { background: var(--o-color-3); }`;

const EXTRA_SCSS_CONTENT = `.s_footer { padding: 60px 0; }
.s_testimonials { margin-top: 40px; }`;

const TEMPLATE_A_XML = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage" inherit_id="website.homepage" name="Homepage">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
        <section class="o_cc o_cc1" data-snippet="s_hero">
          <h1>Welcome</h1>
        </section>
      </div>
    </xpath>
  </template>
</odoo>`;

const TEMPLATE_B_XML = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="s_features" name="Features Snippet">
    <section class="o_cc o_cc2" data-snippet="s_features">
      <h2>Features</h2>
    </section>
  </template>
</odoo>`;

const TEMPLATE_DUP_XML = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage" inherit_id="website.homepage" name="Homepage Duplicate">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
        <section class="o_cc o_cc1" data-snippet="s_hero">
          <h1>Duplicate welcome</h1>
        </section>
      </div>
    </xpath>
  </template>
  <template id="s_about" name="About Snippet">
    <section class="o_cc o_cc3" data-snippet="s_about">
      <h2>About us</h2>
    </section>
  </template>
</odoo>`;

// ---------------------------------------------------------------------------
// consolidateExportFiles() -- parser is single source of truth
// ---------------------------------------------------------------------------

describe("consolidateExportFiles (parser.ts)", () => {
  describe("SCSS preservation", () => {
    it("preserves primary_variables.scss separately (not merged into theme.scss)", () => {
      const input: ParsedFile[] = [
        makeFile(
          "theme_generated/static/src/scss/primary_variables.scss",
          PRIMARY_VARS_CONTENT,
          "scss"
        ),
        makeFile(
          "theme_generated/static/src/scss/theme.scss",
          THEME_SCSS_CONTENT,
          "scss"
        ),
      ];

      const result = consolidateExportFiles(input);

      const primaryVars = result.find((f) =>
        f.path.endsWith("primary_variables.scss")
      );
      const themeScss = result.find((f) => f.path.endsWith("theme.scss"));

      expect(primaryVars).toBeDefined();
      expect(themeScss).toBeDefined();
      expect(primaryVars!.path).not.toBe(themeScss!.path);
      expect(primaryVars!.content).toContain("$o-color-palettes");
      expect(themeScss!.content).toContain(".s_hero");
    });

    it("preserves bootstrap_overridden.scss separately", () => {
      const input: ParsedFile[] = [
        makeFile(
          "theme_generated/static/src/scss/bootstrap_overridden.scss",
          BOOTSTRAP_OVERRIDDEN_CONTENT,
          "scss"
        ),
        makeFile(
          "theme_generated/static/src/scss/theme.scss",
          THEME_SCSS_CONTENT,
          "scss"
        ),
      ];

      const result = consolidateExportFiles(input);

      const bootstrapFile = result.find((f) =>
        f.path.endsWith("bootstrap_overridden.scss")
      );
      const themeScss = result.find((f) => f.path.endsWith("theme.scss"));

      expect(bootstrapFile).toBeDefined();
      expect(themeScss).toBeDefined();
      expect(bootstrapFile!.path).not.toBe(themeScss!.path);
      expect(bootstrapFile!.content).toContain("$font-family-base");
      expect(themeScss!.content).toContain(".s_hero");
    });

    it("preserves both primary_variables.scss and bootstrap_overridden.scss when all three SCSS files exist", () => {
      const input: ParsedFile[] = [
        makeFile(
          "theme_generated/static/src/scss/primary_variables.scss",
          PRIMARY_VARS_CONTENT,
          "scss"
        ),
        makeFile(
          "theme_generated/static/src/scss/bootstrap_overridden.scss",
          BOOTSTRAP_OVERRIDDEN_CONTENT,
          "scss"
        ),
        makeFile(
          "theme_generated/static/src/scss/theme.scss",
          THEME_SCSS_CONTENT,
          "scss"
        ),
      ];

      const result = consolidateExportFiles(input);

      const scssFiles = result.filter(
        (f) => f.path.endsWith(".scss") || f.path.endsWith(".css")
      );
      expect(scssFiles).toHaveLength(3);

      const paths = scssFiles.map((f) => f.path.split("/").pop());
      expect(paths).toContain("primary_variables.scss");
      expect(paths).toContain("bootstrap_overridden.scss");
      expect(paths).toContain("theme.scss");
    });
  });

  describe("XML deduplication", () => {
    it("merges duplicate XML templates by template ID", () => {
      const input: ParsedFile[] = [
        makeFile("theme_generated/views/templates.xml", TEMPLATE_A_XML, "xml"),
        makeFile("theme_generated/views/pages.xml", TEMPLATE_DUP_XML, "xml"),
      ];

      const result = consolidateExportFiles(input);

      const xmlFiles = result.filter((f) => f.path.endsWith(".xml"));
      // Should merge into a single templates.xml
      expect(xmlFiles).toHaveLength(1);
      expect(xmlFiles[0].path).toBe("theme_generated/views/templates.xml");

      // The merged file should contain homepage only ONCE (first occurrence wins)
      const homepageMatches = xmlFiles[0].content.match(
        /id=["']homepage["']/g
      );
      expect(homepageMatches).toHaveLength(1);

      // But should contain the s_about template from the duplicate file
      expect(xmlFiles[0].content).toContain('id="s_about"');
    });

    it("keeps all unique template IDs when merging multiple XML files", () => {
      const input: ParsedFile[] = [
        makeFile("theme_generated/views/templates.xml", TEMPLATE_A_XML, "xml"),
        makeFile("theme_generated/views/snippets.xml", TEMPLATE_B_XML, "xml"),
        makeFile("theme_generated/views/pages.xml", TEMPLATE_DUP_XML, "xml"),
      ];

      const result = consolidateExportFiles(input);

      const xmlFiles = result.filter((f) => f.path.endsWith(".xml"));
      expect(xmlFiles).toHaveLength(1);

      const content = xmlFiles[0].content;
      // homepage from templates.xml (first), s_features from snippets.xml, s_about from pages.xml
      expect(content).toContain('id="homepage"');
      expect(content).toContain('id="s_features"');
      expect(content).toContain('id="s_about"');

      // homepage should appear exactly once (deduped)
      const homepageMatches = content.match(/id=["']homepage["']/g);
      expect(homepageMatches).toHaveLength(1);
    });

    it("does not re-wrap a single XML file", () => {
      const input: ParsedFile[] = [
        makeFile("theme_generated/views/templates.xml", TEMPLATE_A_XML, "xml"),
      ];

      const result = consolidateExportFiles(input);

      const xmlFiles = result.filter((f) => f.path.endsWith(".xml"));
      expect(xmlFiles).toHaveLength(1);
      // The single file should be returned as-is (same object reference or same content)
      expect(xmlFiles[0].content).toBe(TEMPLATE_A_XML);
      expect(xmlFiles[0].path).toBe("theme_generated/views/templates.xml");
    });
  });

  describe("generic SCSS normalization", () => {
    it("normalizes a single generic SCSS file path to theme.scss", () => {
      const input: ParsedFile[] = [
        makeFile(
          "theme_generated/static/src/scss/la_bella_cucina.scss",
          THEME_SCSS_CONTENT,
          "scss"
        ),
      ];

      const result = consolidateExportFiles(input);

      const scssFiles = result.filter((f) => f.path.endsWith(".scss"));
      expect(scssFiles).toHaveLength(1);
      expect(scssFiles[0].path).toBe(
        "theme_generated/static/src/scss/theme.scss"
      );
      expect(scssFiles[0].content).toContain(".s_hero");
    });

    it("merges multiple generic SCSS files into theme.scss", () => {
      const input: ParsedFile[] = [
        makeFile(
          "theme_generated/static/src/scss/style.scss",
          THEME_SCSS_CONTENT,
          "scss"
        ),
        makeFile(
          "theme_generated/static/src/scss/custom.scss",
          EXTRA_SCSS_CONTENT,
          "scss"
        ),
      ];

      const result = consolidateExportFiles(input);

      const genericScss = result.filter(
        (f) =>
          f.path.endsWith(".scss") &&
          !f.path.endsWith("primary_variables.scss") &&
          !f.path.endsWith("bootstrap_overridden.scss")
      );
      expect(genericScss).toHaveLength(1);
      expect(genericScss[0].path).toBe(
        "theme_generated/static/src/scss/theme.scss"
      );
      // Merged content should include content from both files
      expect(genericScss[0].content).toContain(".s_hero");
      expect(genericScss[0].content).toContain(".s_footer");
    });

    it("does not merge asset-bundle SCSS files into theme.scss when generics also exist", () => {
      const input: ParsedFile[] = [
        makeFile(
          "theme_generated/static/src/scss/primary_variables.scss",
          PRIMARY_VARS_CONTENT,
          "scss"
        ),
        makeFile(
          "theme_generated/static/src/scss/style.scss",
          THEME_SCSS_CONTENT,
          "scss"
        ),
        makeFile(
          "theme_generated/static/src/scss/custom.scss",
          EXTRA_SCSS_CONTENT,
          "scss"
        ),
      ];

      const result = consolidateExportFiles(input);

      const primaryVars = result.find((f) =>
        f.path.endsWith("primary_variables.scss")
      );
      const themeScss = result.find((f) => f.path.endsWith("theme.scss"));

      expect(primaryVars).toBeDefined();
      expect(themeScss).toBeDefined();
      // primary_variables must NOT be merged into theme.scss
      expect(themeScss!.content).not.toContain("$o-color-palettes");
      // theme.scss should have content from both generic files
      expect(themeScss!.content).toContain(".s_hero");
      expect(themeScss!.content).toContain(".s_footer");
    });
  });

  describe("non-SCSS, non-XML files pass through unchanged", () => {
    it("preserves manifest and Python files alongside consolidation", () => {
      const manifest = makeFile(
        "theme_generated/__manifest__.py",
        "{'name': 'Test Theme'}",
        "python"
      );
      const initPy = makeFile(
        "theme_generated/__init__.py",
        "# init",
        "python"
      );

      const input: ParsedFile[] = [
        manifest,
        initPy,
        makeFile(
          "theme_generated/views/templates.xml",
          TEMPLATE_A_XML,
          "xml"
        ),
        makeFile(
          "theme_generated/static/src/scss/theme.scss",
          THEME_SCSS_CONTENT,
          "scss"
        ),
      ];

      const result = consolidateExportFiles(input);

      const pyFiles = result.filter((f) => f.path.endsWith(".py"));
      expect(pyFiles).toHaveLength(2);
      expect(pyFiles.map((f) => f.path)).toContain(
        "theme_generated/__manifest__.py"
      );
      expect(pyFiles.map((f) => f.path)).toContain(
        "theme_generated/__init__.py"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// EditorStore.openGeneratedFiles -- no re-consolidation
// ---------------------------------------------------------------------------

describe("EditorStore.openGeneratedFiles (no re-consolidation)", () => {
  beforeEach(() => {
    resetEditorStore();
  });

  it("stores files exactly as provided without modifying paths", () => {
    const files = [
      {
        path: "theme_generated/static/src/scss/primary_variables.scss",
        content: PRIMARY_VARS_CONTENT,
        language: "scss",
      },
      {
        path: "theme_generated/static/src/scss/theme.scss",
        content: THEME_SCSS_CONTENT,
        language: "scss",
      },
      {
        path: "theme_generated/views/templates.xml",
        content: TEMPLATE_A_XML,
        language: "xml",
      },
    ];

    act(() => {
      useEditorStore.getState().openGeneratedFiles(files);
    });

    const state = useEditorStore.getState();

    // All three files should be stored as-is
    expect(Object.keys(state.fileContents)).toHaveLength(3);
    expect(
      state.fileContents[
        "theme_generated/static/src/scss/primary_variables.scss"
      ]
    ).toBe(PRIMARY_VARS_CONTENT);
    expect(
      state.fileContents["theme_generated/static/src/scss/theme.scss"]
    ).toBe(THEME_SCSS_CONTENT);
    expect(
      state.fileContents["theme_generated/views/templates.xml"]
    ).toBe(TEMPLATE_A_XML);
  });

  it("stores file content without merging or deduplicating", () => {
    // Simulate files that have already been consolidated upstream
    const preConsolidated = consolidateExportFiles([
      makeFile(
        "theme_generated/static/src/scss/primary_variables.scss",
        PRIMARY_VARS_CONTENT,
        "scss"
      ),
      makeFile(
        "theme_generated/static/src/scss/bootstrap_overridden.scss",
        BOOTSTRAP_OVERRIDDEN_CONTENT,
        "scss"
      ),
      makeFile(
        "theme_generated/static/src/scss/style.scss",
        THEME_SCSS_CONTENT,
        "scss"
      ),
      makeFile(
        "theme_generated/static/src/scss/custom.scss",
        EXTRA_SCSS_CONTENT,
        "scss"
      ),
    ]);

    // Feed consolidated files into the editor store
    act(() => {
      useEditorStore.getState().openGeneratedFiles(
        preConsolidated.map((f) => ({
          path: f.path,
          content: f.content,
          language: f.language,
        }))
      );
    });

    const state = useEditorStore.getState();
    const storedPaths = Object.keys(state.fileContents);

    // Editor store should have the exact files that consolidation produced
    expect(storedPaths).toHaveLength(preConsolidated.length);
    for (const file of preConsolidated) {
      expect(state.fileContents[file.path]).toBe(file.content);
    }
  });

  it("creates a tab for each file and sets the first new tab as active", () => {
    const files = [
      {
        path: "theme_generated/__manifest__.py",
        content: "{'name': 'Test'}",
        language: "python",
      },
      {
        path: "theme_generated/views/templates.xml",
        content: TEMPLATE_A_XML,
        language: "xml",
      },
    ];

    act(() => {
      useEditorStore.getState().openGeneratedFiles(files);
    });

    const state = useEditorStore.getState();
    expect(state.openTabs).toHaveLength(2);
    expect(state.openTabs[0].path).toBe("theme_generated/__manifest__.py");
    expect(state.openTabs[1].path).toBe(
      "theme_generated/views/templates.xml"
    );
    expect(state.activeTab).toBe("theme_generated/__manifest__.py");
  });

  it("does not create duplicate tabs when opening files that already have tabs", () => {
    const files = [
      {
        path: "theme_generated/views/templates.xml",
        content: TEMPLATE_A_XML,
        language: "xml",
      },
    ];

    act(() => {
      useEditorStore.getState().openGeneratedFiles(files);
    });

    // Open the same files again (simulating a re-generation)
    act(() => {
      useEditorStore.getState().openGeneratedFiles(files);
    });

    const state = useEditorStore.getState();
    // Should still be just one tab, not two
    expect(state.openTabs).toHaveLength(1);
  });

  it("updates lastFileUpdate timestamp to force React re-renders", () => {
    const before = useEditorStore.getState().lastFileUpdate;

    act(() => {
      useEditorStore.getState().openGeneratedFiles([
        {
          path: "theme_generated/views/templates.xml",
          content: TEMPLATE_A_XML,
          language: "xml",
        },
      ]);
    });

    const after = useEditorStore.getState().lastFileUpdate;
    expect(after).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------
// Upstream consolidation guarantees identical files for both stores
// ---------------------------------------------------------------------------

describe("upstream consolidation ensures store consistency", () => {
  it("files consolidated once are identical whether passed to EditorStore or ProjectStore", () => {
    // Simulate the upstream consolidation that ChatPanel performs
    const rawFiles: ParsedFile[] = [
      makeFile(
        "theme_generated/static/src/scss/primary_variables.scss",
        PRIMARY_VARS_CONTENT,
        "scss"
      ),
      makeFile(
        "theme_generated/static/src/scss/bootstrap_overridden.scss",
        BOOTSTRAP_OVERRIDDEN_CONTENT,
        "scss"
      ),
      makeFile(
        "theme_generated/static/src/scss/custom_styles.scss",
        THEME_SCSS_CONTENT,
        "scss"
      ),
      makeFile("theme_generated/views/templates.xml", TEMPLATE_A_XML, "xml"),
      makeFile("theme_generated/views/pages.xml", TEMPLATE_DUP_XML, "xml"),
    ];

    // Consolidate once upstream (this is what ChatPanel does)
    const consolidated = consolidateExportFiles(rawFiles);

    // Consolidate again (to simulate what would happen if stores re-consolidated)
    const doubleConsolidated = consolidateExportFiles(consolidated);

    // The result should be stable -- consolidating already-consolidated files
    // should produce the same output (idempotent for the parts that matter)
    expect(doubleConsolidated.length).toBe(consolidated.length);

    for (const file of consolidated) {
      const matching = doubleConsolidated.find((f) => f.path === file.path);
      expect(matching).toBeDefined();
      expect(matching!.content).toBe(file.content);
    }
  });
});

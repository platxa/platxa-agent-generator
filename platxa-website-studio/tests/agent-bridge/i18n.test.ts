import { describe, it, expect } from "vitest";
import {
  DEFAULT_I18N_CONFIG,
  createI18nState,
  wrapWithTranslationMarker,
  wrapPythonStrings,
  extractFromPython,
  extractFromXml,
  generatePoFile,
  serializePoFile,
  parsePoFile,
  processI18n,
} from "@/lib/agent-bridge/i18n";

describe("I18n", () => {
  describe("createI18nState", () => {
    it("creates empty state with defaults", () => {
      const state = createI18nState();
      expect(state.entries).toHaveLength(0);
      expect(state.config.moduleName).toBe("theme_custom");
      expect(state.config.targetLanguages).toEqual(["es_ES", "fr_FR", "de_DE"]);
    });

    it("accepts custom config", () => {
      const state = createI18nState({ moduleName: "theme_art" });
      expect(state.config.moduleName).toBe("theme_art");
      expect(state.config.sourceLanguage).toBe("en_US"); // default preserved
    });
  });

  describe("wrapWithTranslationMarker", () => {
    it("wraps string with _()", () => {
      expect(wrapWithTranslationMarker("Hello")).toBe("_('Hello')");
    });

    it("uses double quotes when string contains single quotes", () => {
      expect(wrapWithTranslationMarker("It's done")).toBe('_("It\'s done")');
    });

    it("skips already-wrapped strings", () => {
      expect(wrapWithTranslationMarker("_('Hello')")).toBe("_('Hello')");
    });
  });

  describe("wrapPythonStrings", () => {
    it("wraps field string= parameters", () => {
      const src = `name = fields.Char(string="Company Name")`;
      const result = wrapPythonStrings(src);
      expect(result).toContain(`string=_("Company Name")`);
    });

    it("wraps help= parameters", () => {
      const src = `name = fields.Char(help="Enter the name")`;
      const result = wrapPythonStrings(src);
      expect(result).toContain(`help=_("Enter the name")`);
    });

    it("wraps raise Error messages", () => {
      const src = `raise ValueError("Invalid input")`;
      const result = wrapPythonStrings(src);
      expect(result).toContain(`raise ValueError(_("Invalid input"))`);
    });

    it("preserves non-translatable code", () => {
      const src = `x = 42\ny = "technical_key"`;
      const result = wrapPythonStrings(src);
      expect(result).toContain("x = 42");
    });
  });

  describe("extractFromPython", () => {
    it("extracts _() marked strings", () => {
      const src = `label = _("Dashboard")\ntitle = _("Settings")`;
      const { state, extractedCount } = extractFromPython(
        createI18nState(),
        src,
        "models.py",
      );
      expect(extractedCount).toBe(2);
      expect(state.entries[0].msgid).toBe("Dashboard");
      expect(state.entries[1].msgid).toBe("Settings");
    });

    it("extracts string= attributes", () => {
      const src = `name = fields.Char(string="Full Name")`;
      const { state, extractedCount } = extractFromPython(
        createI18nState(),
        src,
        "models.py",
      );
      expect(extractedCount).toBe(1);
      expect(state.entries[0].msgid).toBe("Full Name");
    });

    it("deduplicates same string", () => {
      const src = `a = _("Save")\nb = _("Save")`;
      const { extractedCount } = extractFromPython(
        createI18nState(),
        src,
        "models.py",
      );
      expect(extractedCount).toBe(1);
    });

    it("includes file reference", () => {
      const src = `x = _("Hello")`;
      const { state } = extractFromPython(createI18nState(), src, "views.py");
      expect(state.entries[0].reference).toBe("views.py:1");
    });

    it("does not re-extract existing entries", () => {
      let state = createI18nState();
      ({ state } = extractFromPython(state, `_("Hello")`, "a.py"));
      const { extractedCount } = extractFromPython(state, `_("Hello")`, "b.py");
      expect(extractedCount).toBe(0);
    });

    it("does not mutate input state", () => {
      const state = createI18nState();
      extractFromPython(state, `_("Test")`, "a.py");
      expect(state.entries).toHaveLength(0);
    });
  });

  describe("extractFromXml", () => {
    it("extracts string= attributes", () => {
      const xml = `<field name="x" string="Company"/>`;
      const { state, extractedCount } = extractFromXml(
        createI18nState(),
        xml,
        "views.xml",
      );
      expect(extractedCount).toBe(1);
      expect(state.entries[0].msgid).toBe("Company");
    });

    it("extracts placeholder= attributes", () => {
      const xml = `<input placeholder="Search here..."/>`;
      const { state } = extractFromXml(createI18nState(), xml, "t.xml");
      expect(state.entries[0].msgid).toBe("Search here...");
    });

    it("deduplicates", () => {
      const xml = `<a string="Save"/>\n<b string="Save"/>`;
      const { extractedCount } = extractFromXml(createI18nState(), xml, "v.xml");
      expect(extractedCount).toBe(1);
    });
  });

  describe("generatePoFile", () => {
    it("creates PO file for target language", () => {
      let state = createI18nState({ moduleName: "theme_art" });
      ({ state } = extractFromPython(state, `_("Hello")`, "a.py"));
      const po = generatePoFile(state, "es_ES");
      expect(po.language).toBe("es_ES");
      expect(po.moduleName).toBe("theme_art");
      expect(po.entries).toHaveLength(1);
      expect(po.entries[0].msgid).toBe("Hello");
      expect(po.entries[0].msgstr).toBe("");
    });
  });

  describe("serializePoFile", () => {
    it("produces valid .po format", () => {
      let state = createI18nState();
      ({ state } = extractFromPython(state, `_("Welcome")`, "main.py"));
      const po = generatePoFile(state, "fr_FR");
      const content = serializePoFile(po);
      expect(content).toContain("Language: fr_FR");
      expect(content).toContain('msgid "Welcome"');
      expect(content).toContain('msgstr ""');
      expect(content).toContain("#: main.py:1");
    });

    it("escapes special characters", () => {
      let state = createI18nState();
      ({ state } = extractFromPython(
        state,
        `_("Line1\\nLine2")`,
        "a.py",
      ));
      const po = generatePoFile(state, "de_DE");
      const content = serializePoFile(po);
      expect(content).toContain("\\n");
    });

    it("includes header metadata", () => {
      const po = generatePoFile(createI18nState(), "es_ES");
      const content = serializePoFile(po);
      expect(content).toContain("Content-Type: text/plain; charset=UTF-8");
      expect(content).toContain("Content-Transfer-Encoding: 8bit");
    });
  });

  describe("parsePoFile", () => {
    it("round-trips through serialize/parse", () => {
      let state = createI18nState();
      ({ state } = extractFromPython(state, `_("Hello")\n_("World")`, "a.py"));
      const po = generatePoFile(state, "es_ES");
      const serialized = serializePoFile(po);
      const parsed = parsePoFile(serialized, "theme_custom");
      expect(parsed.language).toBe("es_ES");
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.entries[0].msgid).toBe("Hello");
      expect(parsed.entries[1].msgid).toBe("World");
    });

    it("preserves references", () => {
      let state = createI18nState();
      ({ state } = extractFromPython(state, `_("Test")`, "models.py"));
      const po = generatePoFile(state, "fr_FR");
      const parsed = parsePoFile(serializePoFile(po), "m");
      expect(parsed.entries[0].reference).toBe("models.py:1");
    });
  });

  describe("processI18n", () => {
    it("extracts from multiple sources and generates PO files", () => {
      const result = processI18n(
        [
          { content: `_("Dashboard")`, filename: "main.py", type: "python" },
          {
            content: `<field string="Settings"/>`,
            filename: "views.xml",
            type: "xml",
          },
        ],
        { targetLanguages: ["es_ES", "fr_FR"] },
      );
      expect(result.totalStrings).toBe(2);
      expect(result.poFiles).toHaveLength(2);
      expect(result.poFiles[0].language).toBe("es_ES");
      expect(result.poFiles[1].language).toBe("fr_FR");
      expect(result.poFiles[0].entries).toHaveLength(2);
    });

    it("respects extractPython=false", () => {
      const result = processI18n(
        [{ content: `_("Hello")`, filename: "a.py", type: "python" }],
        { extractPython: false },
      );
      expect(result.totalStrings).toBe(0);
    });

    it("respects extractXml=false", () => {
      const result = processI18n(
        [{ content: `<field string="X"/>`, filename: "v.xml", type: "xml" }],
        { extractXml: false },
      );
      expect(result.totalStrings).toBe(0);
    });

    it("deduplicates across sources", () => {
      const result = processI18n([
        { content: `_("Save")`, filename: "a.py", type: "python" },
        { content: `<field string="Save"/>`, filename: "b.xml", type: "xml" },
      ]);
      expect(result.totalStrings).toBe(1);
    });
  });

  describe("DEFAULT_I18N_CONFIG", () => {
    it("has expected defaults", () => {
      expect(DEFAULT_I18N_CONFIG.sourceLanguage).toBe("en_US");
      expect(DEFAULT_I18N_CONFIG.extractXml).toBe(true);
      expect(DEFAULT_I18N_CONFIG.extractPython).toBe(true);
    });
  });
});

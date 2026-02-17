/**
 * Deployability Fixes Tests
 *
 * Tests for all 10 root-cause fixes that ensure 100% deployable Odoo 18 themes:
 *
 * Theme Assembler (theme-assembler.ts):
 *   1. escapeXmlEntities — bare & escaping
 *   2. isValidHex + extractColorsFromScss — hex validation with fallback
 *   3. Empty template fallback — minimal homepage when no sections extracted
 *   4. isXmlWellFormed — balanced tag check
 *   5. extractBalancedBlocks — nested section extraction
 *   6. sanitizeFontName — font name injection prevention
 *   7. Empty SCSS fallback — default styles when stripping empties file
 *
 * Parser (parser.ts):
 *   8. Python string escaping in generateManifest
 *
 * Validator (validator.ts):
 *   9. o_cc5 range fix
 *
 * Export route (export/route.ts):
 *  10. Skip double processing for already-assembled files
 */

import { describe, it, expect } from "vitest";
import {
  escapeXmlEntities,
  isXmlWellFormed,
  extractSections,
  assembleTemplatesXml,
  assembleThemeFiles,
  assembleThemeScss,
  assemblePrimaryVariablesScss,
} from "@/lib/ai/theme-assembler";
import {
  generateManifest,
  type ParsedFile,
} from "@/lib/ai/parser";
import {
  validateQWebTemplate,
} from "@/lib/odoo-skills/validator";

// =============================================================================
// 1. escapeXmlEntities
// =============================================================================

describe("escapeXmlEntities", () => {
  it("escapes bare & to &amp;", () => {
    expect(escapeXmlEntities("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes multiple bare & characters", () => {
    expect(escapeXmlEntities("A & B & C")).toBe("A &amp; B &amp; C");
  });

  it("preserves already-escaped &amp;", () => {
    expect(escapeXmlEntities("Tom &amp; Jerry")).toBe("Tom &amp; Jerry");
  });

  it("preserves &lt; &gt; &quot; &apos;", () => {
    const input = "&lt;div&gt; &quot;hello&quot; &apos;world&apos;";
    expect(escapeXmlEntities(input)).toBe(input);
  });

  it("preserves numeric character references &#NNN;", () => {
    expect(escapeXmlEntities("&#169; copyright")).toBe("&#169; copyright");
  });

  it("preserves hex character references &#xHH;", () => {
    expect(escapeXmlEntities("&#x00A9; symbol")).toBe("&#x00A9; symbol");
  });

  it("handles mixed: bare & next to existing entities", () => {
    const input = "A & B &amp; C &lt; D";
    expect(escapeXmlEntities(input)).toBe("A &amp; B &amp; C &lt; D");
  });

  it("returns unchanged string with no ampersands", () => {
    const input = "<div>Hello World</div>";
    expect(escapeXmlEntities(input)).toBe(input);
  });

  it("handles empty string", () => {
    expect(escapeXmlEntities("")).toBe("");
  });

  it("handles & at end of string", () => {
    expect(escapeXmlEntities("trailing &")).toBe("trailing &amp;");
  });

  it("handles & followed by non-entity text", () => {
    expect(escapeXmlEntities("&notanentity")).toBe("&amp;notanentity");
  });
});

// =============================================================================
// 2. Hex color validation in extractColorsFromScss
// =============================================================================

describe("assemblePrimaryVariablesScss — hex color validation", () => {
  it("accepts valid #RRGGBB colors from AI SCSS", () => {
    const scss = `$o-color-palettes: map-merge($o-color-palettes, (
      'theme-custom': (
        'o-color-1': #ff0000,
        'o-color-2': #00ff00,
        'o-color-3': #0000ff,
        'o-color-4': #ffffff,
        'o-color-5': #000000,
      ),
    ));`;
    const result = assemblePrimaryVariablesScss(scss);
    expect(result).toContain("#ff0000");
    expect(result).toContain("#00ff00");
    expect(result).toContain("#0000ff");
  });

  it("accepts valid #RGB shorthand colors", () => {
    const scss = `$o-color-palettes: map-merge($o-color-palettes, (
      'theme-custom': (
        'o-color-1': #f00,
        'o-color-2': #0f0,
      ),
    ));`;
    const result = assemblePrimaryVariablesScss(scss);
    expect(result).toContain("#f00");
  });

  it("falls back to defaults for invalid 8-char hex (#RRGGBBAA)", () => {
    const scss = `$o-color-palettes: map-merge($o-color-palettes, (
      'theme-custom': (
        'o-color-1': #ff000080,
        'o-color-2': #00ff0080,
      ),
    ));`;
    const result = assemblePrimaryVariablesScss(scss);
    // 8-char hex is invalid for our validator, should fall back to defaults
    expect(result).toContain("#0d6efd"); // DEFAULT_COLORS.primary
  });

  it("falls back to defaults when primary color is missing", () => {
    const scss = `$o-color-palettes: map-merge($o-color-palettes, (
      'theme-custom': (
        'o-color-2': #00ff00,
      ),
    ));`;
    const result = assemblePrimaryVariablesScss(scss);
    // No primary = extractColorsFromScss returns null = defaults used
    expect(result).toContain("#0d6efd"); // DEFAULT_COLORS.primary
  });

  it("falls back individual colors when only some are invalid", () => {
    const scss = `$o-color-palettes: map-merge($o-color-palettes, (
      'theme-custom': (
        'o-color-1': #c9302c,
        'o-color-2': notacolor,
        'o-color-3': #d4a373,
      ),
    ));`;
    const result = assemblePrimaryVariablesScss(scss);
    expect(result).toContain("#c9302c"); // Valid primary kept
    expect(result).toContain("#6c757d"); // DEFAULT secondary fallback
    expect(result).toContain("#d4a373"); // Valid accent kept
  });

  it("uses industry defaults when no AI SCSS provided", () => {
    const result = assemblePrimaryVariablesScss(null, "restaurant");
    expect(result).toContain("#c9302c"); // restaurant primary
    expect(result).toContain("#8b4513"); // restaurant secondary
  });
});

// =============================================================================
// 3. Empty template fallback
// =============================================================================

describe("assembleThemeFiles — empty template fallback", () => {
  it("produces fallback homepage when given empty file array", () => {
    const result = assembleThemeFiles([]);
    const templates = result.find(f => f.path.endsWith("templates.xml"));
    expect(templates).toBeDefined();
    expect(templates!.content).toContain('inherit_id="website.homepage"');
    expect(templates!.content).toContain("<xpath");
    expect(templates!.content).toContain("s_cover");
    expect(templates!.content).toContain("oe_structure");
  });

  it("keeps original XML when it exists but has no extractable sections", () => {
    // When XML files exist but have no sections, the assembler preserves
    // the original XML (wrapped in <odoo> if needed) rather than discarding it.
    const files: ParsedFile[] = [{
      path: "views/templates.xml",
      content: "<odoo><data><!-- empty --></data></odoo>",
      language: "xml",
      action: "create",
    }];
    const result = assembleThemeFiles(files);
    const templates = result.find(f => f.path.endsWith("templates.xml"));
    expect(templates).toBeDefined();
    expect(templates!.content).toContain("<odoo>");
  });

  it("produces fallback when only non-XML files are provided", () => {
    // No XML files at all → fallback homepage
    const files: ParsedFile[] = [{
      path: "static/src/scss/theme.scss",
      content: ".hero { min-height: 75vh; }",
      language: "scss",
      action: "create",
    }];
    const result = assembleThemeFiles(files);
    const templates = result.find(f => f.path.endsWith("templates.xml"));
    expect(templates).toBeDefined();
    expect(templates!.content).toContain('inherit_id="website.homepage"');
    expect(templates!.content).toContain("s_cover");
  });

  it("produces fallback when all sections become empty after stripping", () => {
    const files: ParsedFile[] = [{
      path: "views/templates.xml",
      content: `<section><script>alert(1)</script></section>
<section><style>.x{color:red}</style></section>`,
      language: "xml",
      action: "create",
    }];
    const result = assembleThemeFiles(files);
    const templates = result.find(f => f.path.endsWith("templates.xml"));
    expect(templates).toBeDefined();
    expect(templates!.content).toContain('inherit_id="website.homepage"');
    expect(templates!.content).toContain("s_cover");
  });

  it("fallback homepage is well-formed XML", () => {
    const result = assembleThemeFiles([]);
    const templates = result.find(f => f.path.endsWith("templates.xml"));
    expect(templates).toBeDefined();
    expect(isXmlWellFormed(templates!.content)).toBe(true);
  });
});

// =============================================================================
// 4. isXmlWellFormed
// =============================================================================

describe("isXmlWellFormed", () => {
  it("returns true for balanced XML", () => {
    expect(isXmlWellFormed("<div><p>text</p></div>")).toBe(true);
  });

  it("returns true for deeply nested balanced XML", () => {
    expect(isXmlWellFormed("<a><b><c><d>text</d></c></b></a>")).toBe(true);
  });

  it("returns false for mismatched closing tag", () => {
    expect(isXmlWellFormed("<div><p>text</div></p>")).toBe(false);
  });

  it("returns false for unclosed tag", () => {
    expect(isXmlWellFormed("<div><p>text</p>")).toBe(false);
  });

  it("returns false for extra closing tag", () => {
    expect(isXmlWellFormed("<div>text</div></div>")).toBe(false);
  });

  it("handles self-closing tags correctly", () => {
    expect(isXmlWellFormed('<div><img src="x.jpg"/><br/></div>')).toBe(true);
  });

  it("handles void elements without self-closing slash", () => {
    expect(isXmlWellFormed('<div><br><hr><img src="x.jpg"></div>')).toBe(true);
  });

  it("handles XML processing instructions", () => {
    expect(isXmlWellFormed('<?xml version="1.0"?><odoo><div>text</div></odoo>')).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(isXmlWellFormed("")).toBe(true);
  });

  it("returns true for text with no tags", () => {
    expect(isXmlWellFormed("just text")).toBe(true);
  });

  it("handles real Odoo template XML", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage" inherit_id="website.homepage">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
        <section class="o_cc o_cc1"><div class="container"><h1>Hello</h1></div></section>
      </div>
    </xpath>
  </template>
</odoo>`;
    expect(isXmlWellFormed(xml)).toBe(true);
  });
});

// =============================================================================
// 5. Balanced section extraction (nested sections)
// =============================================================================

describe("extractSections — balanced nested extraction", () => {
  it("correctly extracts content from nested sections", () => {
    const content = `<section class="hero">
  <div class="container">
    <section class="inner-promo">
      <h2>Special inner promo offer with enough text to pass threshold</h2>
      <p>Some promotional content that is long enough for extraction threshold</p>
    </section>
    <h1>Main hero headline with enough content to pass the threshold check easily</h1>
  </div>
</section>`;
    const sections = extractSections(content);
    // Should extract the outer section with ALL its content (including inner section)
    expect(sections.length).toBeGreaterThanOrEqual(1);
    const outerSection = sections.find(s => s.innerHtml.includes("Main hero headline"));
    expect(outerSection).toBeDefined();
    // The outer section should contain the inner section content too
    expect(outerSection!.innerHtml).toContain("Special inner promo");
  });

  it("extracts flat sibling sections correctly", () => {
    const content = `<section data-snippet="s_cover"><div class="container"><h1>Hero section with enough text to easily pass threshold check</h1></div></section>
<section data-snippet="s_three_columns"><div class="container"><h2>Features section with enough text to easily pass threshold check</h2></div></section>`;
    const sections = extractSections(content);
    expect(sections.length).toBe(2);
  });

  it("handles deeply nested sections (3 levels)", () => {
    const content = `<section class="outer">
  <div class="container">
    <h1>Outer heading with enough text to pass extraction threshold check easily</h1>
    <section class="middle">
      <section class="inner">
        <p>Deep inner content here with enough text to pass threshold</p>
      </section>
    </section>
  </div>
</section>`;
    const sections = extractSections(content);
    expect(sections.length).toBeGreaterThanOrEqual(1);
    // Outer section should capture everything
    const outer = sections[0];
    expect(outer.innerHtml).toContain("Outer heading");
    expect(outer.innerHtml).toContain("Deep inner content");
  });

  it("Phase 4: correctly extracts container divs with nested divs", () => {
    const content = `<div class="container">
  <div class="row">
    <div class="col-md-6">
      <h2>Left column with enough content to pass threshold easily for extraction</h2>
    </div>
    <div class="col-md-6">
      <p>Right column with enough content to pass threshold easily for extraction</p>
    </div>
  </div>
</div>`;
    const sections = extractSections(content);
    expect(sections.length).toBeGreaterThanOrEqual(1);
    // Should capture the full container with all nested divs
    expect(sections[0].innerHtml).toContain("Left column");
    expect(sections[0].innerHtml).toContain("Right column");
  });

  it("handles unclosed section tags gracefully (no hang)", () => {
    const content = `<section><div class="container"><h1>Unclosed section with enough text to pass threshold easily</h1></div>`;
    const start = performance.now();
    const sections = extractSections(content);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
    // Unclosed tag = no balanced match, so 0 sections from Phase 1
    // Phase 4 might pick up the container div
    expect(sections.length).toBeLessThanOrEqual(1);
  });

  it("extracts footer blocks correctly", () => {
    const content = `<footer class="bg-dark text-white">
  <div class="container py-4">
    <div class="row">
      <div class="col-md-4"><h5>Company Info</h5><p>Some company footer content here that is long enough to pass threshold</p></div>
    </div>
  </div>
</footer>`;
    const sections = extractSections(content);
    expect(sections.length).toBe(1);
    expect(sections[0].isFooter).toBe(true);
    expect(sections[0].innerHtml).toContain("Company Info");
  });
});

// =============================================================================
// 6. Font name sanitization
// =============================================================================

describe("assemblePrimaryVariablesScss — font name sanitization", () => {
  it("preserves normal font names", () => {
    const scss = `$o-color-palettes: map-merge($o-color-palettes, (
      'theme-custom': ('o-color-1': #ff0000),
    ));
    $o-website-values-palettes: (('font': 'Open Sans', 'headings-font': 'Playfair Display'));`;
    const result = assemblePrimaryVariablesScss(scss);
    expect(result).toContain("Open Sans");
    expect(result).toContain("Playfair Display");
  });

  it("strips quotes from font names", () => {
    const scss = `$o-color-palettes: map-merge($o-color-palettes, (
      'theme-custom': ('o-color-1': #ff0000),
    ));
    $o-website-values-palettes: (('font': 'Evil'Font', 'headings-font': 'Good Font'));`;
    const result = assemblePrimaryVariablesScss(scss);
    // Single quote should be stripped, not break SCSS
    expect(result).not.toContain("Evil'Font");
    // Check SCSS is structurally sound (no unmatched quotes)
    const singleQuotes = (result.match(/'/g) || []).length;
    expect(singleQuotes % 2).toBe(0); // Even number of quotes
  });

  it("strips semicolons from font names (SCSS injection prevention)", () => {
    const scss = `$o-color-palettes: map-merge($o-color-palettes, (
      'theme-custom': ('o-color-1': #ff0000),
    ));
    $o-website-values-palettes: (('font': 'Evil;$danger:true', 'headings-font': 'Normal'));`;
    const result = assemblePrimaryVariablesScss(scss);
    expect(result).not.toContain(";$danger");
  });

  it("falls back to default font when name is entirely special chars", () => {
    const scss = `$o-color-palettes: map-merge($o-color-palettes, (
      'theme-custom': ('o-color-1': #ff0000),
    ));
    $o-website-values-palettes: (('font': '!!!', 'headings-font': '???'));`;
    const result = assemblePrimaryVariablesScss(scss);
    // After sanitization empty string → falls back to defaults
    expect(result).toContain("Poppins"); // DEFAULT_FONTS.heading
    expect(result).toContain("Open Sans"); // DEFAULT_FONTS.body
  });
});

// =============================================================================
// 7. Empty SCSS fallback after stripping
// =============================================================================

describe("assembleThemeScss — empty SCSS fallback", () => {
  it("returns default when input becomes empty after stripping", () => {
    // Only contains patterns that get stripped
    const input = `body { font-family: Arial; color: #333; }
:root { --primary: #c9302c; }
.container { max-width: 960px; }`;
    const result = assembleThemeScss(input);
    // Should return the default theme styles, not empty content
    expect(result).toContain("section[data-snippet");
    expect(result).toContain(".card");
  });

  it("returns default when only comments remain after stripping", () => {
    const input = `/* Theme styles */
// More comments
body { color: #333; font-family: sans-serif; }`;
    const result = assembleThemeScss(input);
    expect(result).toContain("section[data-snippet");
  });

  it("preserves valid SCSS when enough content remains", () => {
    const input = `.hero {
  min-height: 75vh;
  display: flex;
  align-items: center;
}
.card {
  border-radius: 0.5rem;
  transition: transform 0.3s;
}`;
    const result = assembleThemeScss(input);
    expect(result).toContain(".hero");
    expect(result).toContain("min-height: 75vh");
    expect(result).toContain(".card");
  });

  it("strips empty rulesets left after property removal", () => {
    const input = `.title {
  color: #c9302c;
}
.subtitle {
  font-family: Arial;
}
.card {
  border-radius: 0.5rem;
  transition: transform 0.3s;
}`;
    const result = assembleThemeScss(input);
    // .title and .subtitle become empty after stripping → removed
    expect(result).not.toMatch(/\.title\s*\{\s*\}/);
    expect(result).not.toMatch(/\.subtitle\s*\{\s*\}/);
    // .card has valid properties → kept
    expect(result).toContain(".card");
    expect(result).toContain("border-radius");
  });
});

// =============================================================================
// 8. Python string escaping in generateManifest
// =============================================================================

describe("generateManifest — Python string escaping", () => {
  function makeFiles(): ParsedFile[] {
    return [{
      path: "theme_generated/views/templates.xml",
      content: "<odoo></odoo>",
      language: "xml",
      action: "create",
    }];
  }

  it("escapes single quotes in theme name", () => {
    const result = generateManifest("La Bella's Kitchen", makeFiles(), "theme_la_bellas_kitchen");
    expect(result).toContain("La Bella\\'s Kitchen");
    expect(result).not.toMatch(/'name': 'La Bella's/); // Unescaped would break
  });

  it("escapes backslashes in theme name", () => {
    const result = generateManifest("Theme C:\\path", makeFiles(), "theme_c_path");
    expect(result).toContain("Theme C:\\\\path");
  });

  it("escapes single quotes in summary override", () => {
    const overrides = { summary: "World's best theme" };
    const result = generateManifest("Test Theme", makeFiles(), "theme_test", overrides);
    expect(result).toContain("World\\'s best theme");
  });

  it("escapes single quotes in author override", () => {
    const overrides = { author: "O'Brien Studios" };
    const result = generateManifest("Test Theme", makeFiles(), "theme_test", overrides);
    expect(result).toContain("O\\'Brien Studios");
  });

  it("escapes triple quotes in description", () => {
    const overrides = { description: "Features include: ''' some content '''" };
    const result = generateManifest("Test Theme", makeFiles(), "theme_test", overrides);
    expect(result).not.toMatch(/'''\s*some content\s*'''/); // Would break triple-quote
    expect(result).toContain("\\'''");
  });

  it("sanitizes depend names — rejects invalid module names", () => {
    const overrides = { extraDepends: ["valid_module", "bad;module", "../traversal"] };
    const result = generateManifest("Test Theme", makeFiles(), "theme_test", overrides);
    expect(result).toContain("'valid_module'");
    expect(result).not.toContain("bad;module");
    expect(result).not.toContain("../traversal");
  });

  it("handles normal theme names without modification", () => {
    const result = generateManifest("Theme Restaurant", makeFiles(), "theme_restaurant");
    expect(result).toContain("'name': 'Theme Restaurant'");
  });

  it("produces valid Python dict structure", () => {
    const result = generateManifest("Theme O'Malley's Pub & Grill", makeFiles(), "theme_omalleys_pub_grill");
    // Verify the output is balanced braces
    let depth = 0;
    for (const ch of result) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});

// =============================================================================
// 9. Validator o_cc5 range fix
// =============================================================================

describe("validateQWebTemplate — o_cc color range", () => {
  const makeXml = (ccNum: number) =>
    `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="test" name="Test">
    <section class="o_cc o_cc${ccNum}">content</section>
  </template>
</odoo>`;

  it("o_cc1 is valid (no QWEB010 error)", () => {
    const issues = validateQWebTemplate(makeXml(1), "test.xml");
    const qweb010 = issues.filter(i => i.code === "QWEB010");
    expect(qweb010).toHaveLength(0);
  });

  it("o_cc2 is valid", () => {
    const issues = validateQWebTemplate(makeXml(2), "test.xml");
    expect(issues.filter(i => i.code === "QWEB010")).toHaveLength(0);
  });

  it("o_cc3 is valid", () => {
    const issues = validateQWebTemplate(makeXml(3), "test.xml");
    expect(issues.filter(i => i.code === "QWEB010")).toHaveLength(0);
  });

  it("o_cc4 is valid", () => {
    const issues = validateQWebTemplate(makeXml(4), "test.xml");
    expect(issues.filter(i => i.code === "QWEB010")).toHaveLength(0);
  });

  it("o_cc5 is valid (Odoo 18 supports 5 color combinations)", () => {
    const issues = validateQWebTemplate(makeXml(5), "test.xml");
    const qweb010 = issues.filter(i => i.code === "QWEB010");
    expect(qweb010).toHaveLength(0);
  });

  it("o_cc0 is invalid", () => {
    const issues = validateQWebTemplate(makeXml(0), "test.xml");
    const qweb010 = issues.filter(i => i.code === "QWEB010");
    expect(qweb010).toHaveLength(1);
    expect(qweb010[0].severity).toBe("error");
  });

  it("o_cc6 is invalid", () => {
    const issues = validateQWebTemplate(makeXml(6), "test.xml");
    const qweb010 = issues.filter(i => i.code === "QWEB010");
    expect(qweb010).toHaveLength(1);
  });

  it("o_cc10 is invalid", () => {
    const issues = validateQWebTemplate(makeXml(10), "test.xml");
    expect(issues.filter(i => i.code === "QWEB010")).toHaveLength(1);
  });

  it("assembler output with 5+ sections uses o_cc5 and passes validation", () => {
    const sections = [
      { snippetType: "s_cover", innerHtml: `<div class="container"><h1>Hero heading with enough content to pass threshold</h1><p>Hero subtitle text</p></div>`, isFooter: false },
      { snippetType: "s_numbers", innerHtml: `<div class="container"><h2>Stats section content with enough text to pass threshold</h2><p>500+ clients</p></div>`, isFooter: false },
      { snippetType: "s_three_columns", innerHtml: `<div class="container"><h2>Features section content with enough text to pass threshold</h2><p>Feature cards</p></div>`, isFooter: false },
      { snippetType: "s_text_image", innerHtml: `<div class="container"><h2>About section content with enough text to pass threshold check</h2><p>Our story</p></div>`, isFooter: false },
      { snippetType: "s_call_to_action", innerHtml: `<div class="container"><h2>Call to action section with enough text to pass threshold</h2><p>Get started</p></div>`, isFooter: false },
      { snippetType: "s_footer", innerHtml: `<div class="container"><h5>Company Name</h5><p>Footer content with links and contact info</p></div>`, isFooter: true },
    ];
    const xml = assembleTemplatesXml(sections);
    expect(xml).toContain("o_cc5"); // footer section gets o_cc5
    // Validate the output — no o_cc range errors
    const issues = validateQWebTemplate(xml, "templates.xml");
    const qweb010 = issues.filter(i => i.code === "QWEB010");
    expect(qweb010).toHaveLength(0);
  });
});

// =============================================================================
// 10. Export double-processing skip
// =============================================================================

describe("assembleThemeFiles — already-assembled detection", () => {
  it("preserves already-assembled XML structure when re-assembled", () => {
    // Simulate files that already went through the assembler
    const alreadyAssembled: ParsedFile[] = [
      {
        path: "theme_generated/views/templates.xml",
        content: `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage_content" name="Homepage" inherit_id="website.homepage" customize_show="True">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
        <section class="o_cc o_cc1 pt96 pb96" data-snippet="s_cover">
          <div class="container text-center">
            <h1 class="display-3 fw-bold">Welcome to Our Restaurant with Amazing Food and Drinks</h1>
            <p class="lead">Fine dining experience like no other place in town</p>
          </div>
        </section>
        <section class="o_cc o_cc2 pt48 pb48" data-snippet="s_three_columns">
          <div class="container">
            <h2>Our Professional Services and Expert Consulting Options</h2>
            <div class="row"><div class="col-md-4">Card content here for the first column</div></div>
          </div>
        </section>
      </div>
    </xpath>
  </template>
</odoo>`,
        language: "xml",
        action: "create",
      },
      {
        path: "theme_generated/static/src/scss/primary_variables.scss",
        content: `$o-color-palettes: map-merge($o-color-palettes, ('theme-custom': ('o-color-1': #c9302c)));`,
        language: "scss",
        action: "create",
      },
      {
        path: "theme_generated/static/src/scss/theme.scss",
        content: `.hero { min-height: 75vh; display: flex; }`,
        language: "scss",
        action: "create",
      },
    ];

    const result = assembleThemeFiles(alreadyAssembled);
    const templates = result.find(f => f.path.endsWith("templates.xml"));
    expect(templates).toBeDefined();
    // Structure should still be correct after re-assembly
    expect(templates!.content).toContain('inherit_id="website.homepage"');
    expect(templates!.content).toContain("<xpath");
    expect(templates!.content).toContain("o_cc");
    expect(templates!.content).toContain("data-snippet");
    // Content should be preserved
    expect(templates!.content).toContain("Welcome to Our Restaurant");
  });
});

// =============================================================================
// Integration: all fixes work together in full pipeline
// =============================================================================

describe("Deployability — all fixes integration", () => {
  it("handles AI output with every known problem pattern", () => {
    const problemXml: ParsedFile = {
      path: "views/templates.xml",
      content: `<section data-snippet="s_cover">
  <div class="container text-center">
    <h1>Tom & Jerry's Restaurant — Fine Dining & More!</h1>
    <p>Come taste our world-famous pasta &amp; pizza selection today</p>
    <form method="POST"><input type="text"><button>Submit</button></form>
    <script>document.title = "Hacked"</script>
    <style>.evil { display: none }</style>
    <img src="images/hero.jpg">
    <section class="inner-promo">
      <h3>Special promotion this week only with great prices and deals</h3>
    </section>
  </div>
</section>
<section data-snippet="s_three_columns">
  <div class="container">
    <h2>Our Services and Professional Consulting Options Available</h2>
    <div class="row"><div class="col-md-4"><p>Card content with enough text to pass the threshold</p></div></div>
  </div>
</section>
<section data-snippet="s_text_block">
  <script>trackPage()</script>
  <style>.hidden{display:none}</style>
</section>`,
      language: "xml",
      action: "create",
    };

    const problemScss: ParsedFile = {
      path: "static/src/scss/theme.scss",
      content: `body { font-family: Arial; color: #333; }
:root { --primary: red; }
.hero { min-height: 75vh; display: flex; color: #c9302c; }
.empty-after-strip { color: #aaa; background-color: #bbb; }`,
      language: "scss",
      action: "create",
    };

    const result = assembleThemeFiles([problemXml, problemScss], "Theme Tom & Jerry's", "restaurant");

    // Templates check
    const templates = result.find(f => f.path.endsWith("templates.xml"));
    expect(templates).toBeDefined();

    // Fix 1: & escaped in content
    expect(templates!.content).not.toMatch(/&(?!(?:amp|lt|gt|quot|apos|#))/);

    // Fix 4: XML is well-formed
    expect(isXmlWellFormed(templates!.content)).toBe(true);

    // Fix 5: Nested section content preserved (not truncated)
    expect(templates!.content).toContain("Special promotion");

    // Content fixes: no forms, scripts, styles
    expect(templates!.content).not.toContain("<form");
    expect(templates!.content).not.toContain("<script");
    expect(templates!.content).not.toContain("<style");

    // Empty section (only script+style) filtered out.
    // Count is 3: hero wrapper + nested <section class="inner-promo"> in hero content + services wrapper
    const sectionCount = (templates!.content.match(/<section\b/g) || []).length;
    expect(sectionCount).toBe(3);

    // Correct Odoo 18 structure
    expect(templates!.content).toContain('inherit_id="website.homepage"');
    expect(templates!.content).toContain("oe_structure");

    // SCSS check
    const themeScss = result.find(f => f.path.endsWith("theme.scss"));
    expect(themeScss).toBeDefined();
    // Fix 7: No empty rulesets, still has valid content
    expect(themeScss!.content).toContain("min-height: 75vh");
    expect(themeScss!.content).not.toMatch(/^body\s*\{/m);

    // Primary variables present
    const primaryVars = result.find(f => f.path.endsWith("primary_variables.scss"));
    expect(primaryVars).toBeDefined();

    // Icon present
    const icon = result.find(f => f.path.endsWith("icon.svg"));
    expect(icon).toBeDefined();
  });
});

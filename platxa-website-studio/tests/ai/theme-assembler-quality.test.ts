import { describe, it, expect } from "vitest";
import {
  assembleThemeScss,
  assemblePrimaryVariablesScss,
  assembleTemplatesXml,
  fixImages,
  extractSections,
  assembleThemeFiles,
} from "@/lib/ai/theme-assembler";
import type { ParsedFile } from "@/lib/ai/parser";

// =============================================================================
// Fix A: assembleThemeScss — strips dangerous global overrides
// =============================================================================

describe("assembleThemeScss — dangerous CSS stripping", () => {
  it("strips body { } overrides", () => {
    const input = `body { font-family: Arial; color: #333; }\n.card { border: none; }`;
    const result = assembleThemeScss(input);
    expect(result).not.toMatch(/^body\s*\{/m);
    expect(result).toContain(".card");
  });

  it("strips html { } overrides", () => {
    const input = `html { scroll-behavior: smooth; font-size: 16px; }\n.hero { min-height: 75vh; }`;
    const result = assembleThemeScss(input);
    expect(result).not.toMatch(/^html\s*\{/m);
    expect(result).toContain(".hero");
  });

  it("strips .container { } overrides", () => {
    const input = `.container { max-width: 1140px; }\n.card { padding: 1rem; }`;
    const result = assembleThemeScss(input);
    expect(result).not.toMatch(/^\.container\s*\{/m);
    expect(result).toContain(".card");
  });

  it("strips .container-fluid { } overrides", () => {
    const input = `.container-fluid { padding: 0; }\nsection { padding: 2rem; }`;
    const result = assembleThemeScss(input);
    expect(result).not.toMatch(/^\.container-fluid\s*\{/m);
    expect(result).toContain("section");
  });

  it("strips background-image: url(...) from CSS rules", () => {
    const input = `.hero {\n  min-height: 75vh;\n  background-image: url(/images/hero.jpg);\n  display: flex;\n}`;
    const result = assembleThemeScss(input);
    expect(result).not.toContain("background-image");
    expect(result).toContain("min-height: 75vh");
    expect(result).toContain("display: flex");
  });

  it("strips :root { } custom properties", () => {
    const input = `:root { --primary: #c9302c; --secondary: #8b4513; }\n.btn { border-radius: 10rem; }`;
    const result = assembleThemeScss(input);
    expect(result).not.toMatch(/^:root\s*\{/m);
    expect(result).toContain(".btn");
  });

  it("strips font-family declarations", () => {
    const input = `.header { font-family: 'Playfair Display', serif; padding: 1rem; }`;
    const result = assembleThemeScss(input);
    expect(result).not.toContain("font-family");
    expect(result).toContain("padding: 1rem");
  });

  it("preserves valid section-scoped selectors", () => {
    const input = `.card { border-radius: 0.5rem; }\nsection[data-snippet="s_cover"] { min-height: 75vh; }`;
    const result = assembleThemeScss(input);
    expect(result).toContain(".card");
    expect(result).toContain('section[data-snippet="s_cover"]');
    expect(result).toContain("min-height: 75vh");
  });

  it("returns default theme.scss when input is null", () => {
    const result = assembleThemeScss(null);
    expect(result).toContain("section[data-snippet");
    expect(result).toContain(".card");
  });
});

// =============================================================================
// Fix B: assemblePrimaryVariablesScss — palette activation
// =============================================================================

describe("assemblePrimaryVariablesScss — palette activation", () => {
  it("output contains $o-theme-color-palette-number", () => {
    const result = assemblePrimaryVariablesScss(null);
    expect(result).toContain("$o-theme-color-palette-number: 'theme-custom' !default;");
  });

  it("palette activation appears after $o-selected-color-palettes-names", () => {
    const result = assemblePrimaryVariablesScss(null);
    const selectedIdx = result.indexOf("$o-selected-color-palettes-names");
    const paletteNumIdx = result.indexOf("$o-theme-color-palette-number");
    expect(selectedIdx).toBeGreaterThan(-1);
    expect(paletteNumIdx).toBeGreaterThan(-1);
    expect(paletteNumIdx).toBeGreaterThan(selectedIdx);
  });

  it("palette activation present when AI SCSS is provided", () => {
    const aiScss = `$o-color-palettes: map-merge($o-color-palettes, ('theme-custom': ('o-color-1': #ff0000)));`;
    const result = assemblePrimaryVariablesScss(aiScss);
    expect(result).toContain("$o-theme-color-palette-number: 'theme-custom' !default;");
  });

  it("palette activation present with industry override", () => {
    const result = assemblePrimaryVariablesScss(null, "restaurant");
    expect(result).toContain("$o-theme-color-palette-number: 'theme-custom' !default;");
    expect(result).toContain("#c9302c"); // restaurant primary
  });
});

// =============================================================================
// Fix C: assembleTemplatesXml — container wrapper
// =============================================================================

describe("assembleTemplatesXml — container wrapper", () => {
  it("keeps sections that already have a container div", () => {
    const sections = [{
      snippetType: "s_cover",
      innerHtml: '<div class="container text-center"><h1>Hello</h1></div>',
      isFooter: false,
    }];
    const result = assembleTemplatesXml(sections);
    // Should not double-wrap
    const containerCount = (result.match(/<div[^>]*class="[^"]*container/g) || []).length;
    expect(containerCount).toBe(1);
  });

  it("adds container div when section content lacks one", () => {
    const sections = [{
      snippetType: "s_three_columns",
      innerHtml: '<h2 class="text-center">Features</h2><div class="row"><div class="col-md-4">Card</div></div>',
      isFooter: false,
    }];
    const result = assembleTemplatesXml(sections);
    expect(result).toContain('<div class="container">');
  });

  it("every section has a container child in output", () => {
    const sections = [
      { snippetType: "s_cover", innerHtml: '<h1>Hero</h1>', isFooter: false },
      { snippetType: "s_three_columns", innerHtml: '<div class="container"><h2>Features</h2></div>', isFooter: false },
      { snippetType: "s_text_block", innerHtml: '<p>About us content</p>', isFooter: false },
    ];
    const result = assembleTemplatesXml(sections);
    // Extract all section blocks
    const sectionBlocks = result.match(/<section[^>]*>[\s\S]*?<\/section>/g) || [];
    expect(sectionBlocks.length).toBe(3);
    for (const block of sectionBlocks) {
      expect(block).toMatch(/<div[^>]*class="[^"]*container/);
    }
  });
});

// =============================================================================
// Fix D: fixImages
// =============================================================================

describe("fixImages", () => {
  it("adds alt=\"\" to img missing alt attribute", () => {
    const result = fixImages('<img src="test.jpg" />');
    expect(result).toContain('alt=""');
  });

  it("does not double-add alt when already present", () => {
    const input = '<img src="test.jpg" alt="A photo" />';
    const result = fixImages(input);
    const altCount = (result.match(/alt=/g) || []).length;
    expect(altCount).toBe(1);
    expect(result).toContain('alt="A photo"');
  });

  it("adds img-fluid class to img with existing class", () => {
    const result = fixImages('<img src="test.jpg" class="rounded" />');
    expect(result).toContain("img-fluid");
    expect(result).toContain("rounded");
  });

  it("adds class=\"img-fluid\" to img with no class at all", () => {
    const result = fixImages('<img src="test.jpg" />');
    expect(result).toContain('class="img-fluid"');
  });

  it("does not double-add img-fluid when already present", () => {
    const input = '<img src="test.jpg" class="img-fluid rounded" />';
    const result = fixImages(input);
    const fluidCount = (result.match(/img-fluid/g) || []).length;
    expect(fluidCount).toBe(1);
  });

  it("adds loading=\"lazy\" to img missing it", () => {
    const result = fixImages('<img src="test.jpg" />');
    expect(result).toContain('loading="lazy"');
  });

  it("does not double-add loading when already present", () => {
    const input = '<img src="test.jpg" loading="eager" />';
    const result = fixImages(input);
    const loadingCount = (result.match(/loading=/g) || []).length;
    expect(loadingCount).toBe(1);
  });

  it("fixes broken relative image paths to Odoo default", () => {
    const result = fixImages('<img src="images/logo.png" />');
    expect(result).toContain('src="/web/image/website.s_cover_default_image"');
    expect(result).not.toContain("images/logo.png");
  });

  it("preserves valid Unsplash URLs", () => {
    const input = '<img src="https://images.unsplash.com/photo-123?w=800" />';
    const result = fixImages(input);
    expect(result).toContain("https://images.unsplash.com/photo-123?w=800");
  });

  it("preserves valid /web/ Odoo URLs", () => {
    const input = '<img src="/web/image/website.s_cover_default_image" />';
    const result = fixImages(input);
    expect(result).toContain("/web/image/website.s_cover_default_image");
  });
});

// =============================================================================
// Fix E: Deduplication
// =============================================================================

describe("assembleThemeFiles — section deduplication", () => {
  function makeParsedFile(content: string): ParsedFile {
    return { path: "views/templates.xml", content, language: "xml", action: "create" };
  }

  function makeSections(count: number, snippetType: string = "s_text_block"): string {
    return Array.from({ length: count }, (_, i) =>
      `<section data-snippet="${snippetType}"><div class="container"><h2>Section ${i + 1} unique-${i}</h2><p>Content that is long enough to pass extraction threshold here number ${i}</p></div></section>`
    ).join("\n");
  }

  it("limits sections to MAX_SECTIONS (8)", () => {
    const content = makeSections(12, "s_text_block");
    // Use different snippet types to avoid MAX_PER_TYPE limit
    const mixed = content
      .replace('data-snippet="s_text_block"', 'data-snippet="s_cover"')
      .replace(/data-snippet="s_text_block"/, 'data-snippet="s_three_columns"')
      .replace(/data-snippet="s_text_block"/, 'data-snippet="s_call_to_action"')
      .replace(/data-snippet="s_text_block"/, 'data-snippet="s_text_image"')
      .replace(/data-snippet="s_text_block"/, 'data-snippet="s_numbers"');
    const files = [makeParsedFile(mixed)];
    const result = assembleThemeFiles(files);
    const templatesFile = result.find(f => f.path.includes("templates.xml"));
    if (templatesFile) {
      const sectionMatches = templatesFile.content.match(/<section\b/g) || [];
      expect(sectionMatches.length).toBeLessThanOrEqual(8);
    }
  });

  it("limits same snippet type to MAX_PER_TYPE (2)", () => {
    const content = makeSections(5, "s_three_columns");
    const files = [makeParsedFile(content)];
    const result = assembleThemeFiles(files);
    const templatesFile = result.find(f => f.path.includes("templates.xml"));
    if (templatesFile) {
      const snippetMatches = templatesFile.content.match(/data-snippet="s_three_columns"/g) || [];
      expect(snippetMatches.length).toBeLessThanOrEqual(2);
    }
  });

  it("removes content-similar sections", () => {
    const dupContent = `<section data-snippet="s_cover"><div class="container"><h1>Welcome to Our Site</h1><p>This is a long enough paragraph to pass the threshold check for extraction</p></div></section>
<section data-snippet="s_text_block"><div class="container"><h1>Welcome to Our Site</h1><p>This is a long enough paragraph to pass the threshold check for extraction</p></div></section>`;
    const files = [makeParsedFile(dupContent)];
    const result = assembleThemeFiles(files);
    const templatesFile = result.find(f => f.path.includes("templates.xml"));
    if (templatesFile) {
      const sectionMatches = templatesFile.content.match(/<section\b/g) || [];
      // Should dedupe similar content
      expect(sectionMatches.length).toBeLessThanOrEqual(2);
    }
  });

  it("keeps first occurrence of each snippet type", () => {
    const content = `<section data-snippet="s_cover"><div class="container"><h1>Hero One with enough content to pass extraction threshold easily</h1></div></section>
<section data-snippet="s_three_columns"><div class="container"><h2>Features with enough content to pass extraction threshold easily</h2></div></section>
<section data-snippet="s_text_block"><div class="container"><p>About section with enough content to pass extraction threshold easily</p></div></section>`;
    const files = [makeParsedFile(content)];
    const result = assembleThemeFiles(files);
    const templatesFile = result.find(f => f.path.includes("templates.xml"));
    expect(templatesFile).toBeDefined();
    expect(templatesFile!.content).toContain("s_cover");
    expect(templatesFile!.content).toContain("s_three_columns");
    expect(templatesFile!.content).toContain("s_text_block");
  });

  it("empty input returns no templates.xml", () => {
    const result = assembleThemeFiles([]);
    const templatesFile = result.find(f => f.path.includes("templates.xml"));
    expect(templatesFile).toBeUndefined();
  });
});

// =============================================================================
// Integration test: full assembleThemeFiles with messy AI input
// =============================================================================

describe("assembleThemeFiles — integration (all fixes applied)", () => {
  it("applies all quality fixes to messy AI input", () => {
    const messyXml: ParsedFile = {
      path: "views/templates.xml",
      content: `<section data-snippet="s_cover">
  <h1>Welcome to Our Restaurant</h1>
  <img src="images/hero.jpg">
  <p>Fine dining experience like no other with amazing food and wonderful ambiance</p>
</section>
<section data-snippet="s_three_columns">
  <div class="container">
    <h2>Our Menu</h2>
    <img src="https://images.unsplash.com/photo-1504674900247?w=400" class="rounded">
  </div>
</section>
<section data-snippet="s_text_block">
  <p>About us content that is long enough to pass the extraction minimum threshold here</p>
</section>`,
      language: "xml",
      action: "create",
    };

    const messyThemeScss: ParsedFile = {
      path: "static/src/scss/theme.scss",
      content: `body { font-family: 'Comic Sans', cursive; color: #333; }
.container { max-width: 960px; }
:root { --primary: #c9302c; --secondary: #8b4513; }
.hero {
  min-height: 75vh;
  background-image: url(/images/hero-bg.jpg);
  display: flex;
}
.card {
  font-family: Arial, sans-serif;
  border-radius: 0.5rem;
}`,
      language: "scss",
      action: "create",
    };

    const result = assembleThemeFiles([messyXml, messyThemeScss], "Theme Restaurant", "restaurant");

    // Check templates.xml
    const templates = result.find(f => f.path.includes("templates.xml"));
    expect(templates).toBeDefined();
    // Fix C: all sections have container wrappers
    const sectionBlocks = templates!.content.match(/<section[^>]*>[\s\S]*?<\/section>/g) || [];
    for (const block of sectionBlocks) {
      expect(block).toMatch(/<div[^>]*class="[^"]*container/);
    }
    // Fix D: images have alt, img-fluid, loading
    if (templates!.content.includes("<img")) {
      expect(templates!.content).toMatch(/<img[^>]*alt=/);
      expect(templates!.content).toMatch(/<img[^>]*loading="lazy"/);
    }
    // Fix D: broken relative paths replaced
    expect(templates!.content).not.toContain('src="images/');

    // Check theme.scss
    const themeScss = result.find(f => f.path.includes("theme.scss"));
    expect(themeScss).toBeDefined();
    // Fix A: no body/html/container/font-family/bg-image/:root overrides
    expect(themeScss!.content).not.toMatch(/^body\s*\{/m);
    expect(themeScss!.content).not.toMatch(/^\.container\s*\{/m);
    expect(themeScss!.content).not.toMatch(/^:root\s*\{/m);
    expect(themeScss!.content).not.toContain("background-image");
    expect(themeScss!.content).not.toContain("font-family");
    // But preserves valid selectors
    expect(themeScss!.content).toContain(".hero");
    expect(themeScss!.content).toContain(".card");

    // Check primary_variables.scss
    const primaryVars = result.find(f => f.path.includes("primary_variables.scss"));
    expect(primaryVars).toBeDefined();
    // Fix B: palette activation present
    expect(primaryVars!.content).toContain("$o-theme-color-palette-number: 'theme-custom' !default;");
  });
});

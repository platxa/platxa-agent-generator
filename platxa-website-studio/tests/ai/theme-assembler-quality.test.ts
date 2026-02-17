import { describe, it, expect } from "vitest";
import {
  assembleThemeScss,
  assemblePrimaryVariablesScss,
  assembleTemplatesXml,
  fixImages,
  fixForms,
  stripInlineTags,
  extractSections,
  assembleThemeFiles,
  THEME_ICON_SVG,
} from "@/lib/ai/theme-assembler";
import { parseGeneratedFiles, ensureRequiredFiles } from "@/lib/ai/parser";
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

  it("preserves background-image: url(...) in CSS rules (needed for section styling)", () => {
    const input = `.hero {\n  min-height: 75vh;\n  background-image: url(/images/hero.jpg);\n  display: flex;\n}`;
    const result = assembleThemeScss(input);
    expect(result).toContain("background-image");
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
      innerHtml: '<div class="container text-center"><h1>Welcome to Our Amazing Restaurant Experience</h1></div>',
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
      innerHtml: '<h2 class="text-center">Our Professional Services and Features</h2><div class="row"><div class="col-md-4">Consulting Card</div></div>',
      isFooter: false,
    }];
    const result = assembleTemplatesXml(sections);
    expect(result).toContain('<div class="container">');
  });

  it("every section has a container child in output", () => {
    const sections = [
      { snippetType: "s_cover", innerHtml: '<h1>Welcome to Our Fine Dining Restaurant Experience</h1>', isFooter: false },
      { snippetType: "s_three_columns", innerHtml: '<div class="container"><h2>Our Professional Services and Features</h2></div>', isFooter: false },
      { snippetType: "s_text_block", innerHtml: '<p>About us content with a detailed description of our company and what we do</p>', isFooter: false },
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
    expect(result).toMatch(/src="\/web\/image\/website\.s_/);
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
      expect(sectionMatches.length).toBeLessThanOrEqual(10);
    }
  });

  it("limits same snippet type to MAX_PER_TYPE (3)", () => {
    const content = makeSections(5, "s_three_columns");
    const files = [makeParsedFile(content)];
    const result = assembleThemeFiles(files);
    const templatesFile = result.find(f => f.path.includes("templates.xml"));
    if (templatesFile) {
      const snippetMatches = templatesFile.content.match(/data-snippet="s_three_columns"/g) || [];
      expect(snippetMatches.length).toBeLessThanOrEqual(3);
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

  it("empty input returns fallback minimal homepage", () => {
    const result = assembleThemeFiles([]);
    const templatesFile = result.find(f => f.path.includes("templates.xml"));
    expect(templatesFile).toBeDefined();
    expect(templatesFile!.content).toContain('inherit_id="website.homepage"');
    expect(templatesFile!.content).toContain('<xpath');
    expect(templatesFile!.content).toContain('s_cover');
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
    // background-image is preserved (needed for section styling in theme.scss)
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

// =============================================================================
// Fix G: fixForms — strip raw <form> tags
// =============================================================================

describe("fixForms — raw form stripping", () => {
  it("replaces <form>...</form> with CTA button", () => {
    const input = `<form method="POST" action="/submit"><input type="text" name="email"><button type="submit">Send</button></form>`;
    const result = fixForms(input);
    expect(result).not.toContain("<form");
    expect(result).not.toContain("</form>");
    expect(result).toContain('href="/contactus"');
    expect(result).toContain("btn btn-primary");
  });

  it("preserves non-form content around the form", () => {
    const input = `<h2>Contact Us</h2><form method="POST"><input type="text"></form><p>We will respond within 24 hours.</p>`;
    const result = fixForms(input);
    expect(result).toContain("<h2>Contact Us</h2>");
    expect(result).toContain("<p>We will respond within 24 hours.</p>");
    expect(result).not.toContain("<form");
  });

  it("handles multiple forms in one block", () => {
    const input = `<form action="/a"><input></form><p>Break</p><form action="/b"><input></form>`;
    const result = fixForms(input);
    expect(result).not.toContain("<form");
    // Both replaced with CTA
    const ctaCount = (result.match(/btn btn-primary/g) || []).length;
    expect(ctaCount).toBe(2);
  });
});

// =============================================================================
// Fix H: stripInlineTags — strip <script> and <style>
// =============================================================================

describe("stripInlineTags — script/style stripping", () => {
  it("strips <script> tags", () => {
    const input = `<div>Hello</div><script>alert('xss')</script><p>World</p>`;
    const result = stripInlineTags(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<div>Hello</div>");
    expect(result).toContain("<p>World</p>");
  });

  it("strips <style> tags", () => {
    const input = `<div>Hello</div><style>body { color: red; }</style><p>World</p>`;
    const result = stripInlineTags(input);
    expect(result).not.toContain("<style");
    expect(result).not.toContain("color: red");
    expect(result).toContain("<div>Hello</div>");
    expect(result).toContain("<p>World</p>");
  });

  it("preserves surrounding content intact", () => {
    const input = `<h1>Title</h1><script src="evil.js"></script><style>.x{}</style><h2>Subtitle</h2>`;
    const result = stripInlineTags(input);
    expect(result).toBe("<h1>Title</h1><h2>Subtitle</h2>");
  });
});

// =============================================================================
// Fix I: icon.svg in assembleThemeFiles
// =============================================================================

describe("assembleThemeFiles — icon.svg (Fix I)", () => {
  it("includes static/description/icon.svg in output", () => {
    const xmlFile: ParsedFile = {
      path: "views/templates.xml",
      content: `<section data-snippet="s_cover"><div class="container"><h1>Hero headline with enough content to pass threshold checks</h1><p>And some paragraph text</p></div></section>`,
      language: "xml",
      action: "create",
    };
    const result = assembleThemeFiles([xmlFile]);
    const iconFile = result.find(f => f.path.includes("icon.svg"));
    expect(iconFile).toBeDefined();
    expect(iconFile!.path).toBe("theme_generated/static/description/icon.svg");
  });

  it("icon.svg contains valid SVG content", () => {
    expect(THEME_ICON_SVG).toContain("<svg");
    expect(THEME_ICON_SVG).toContain("</svg>");
    expect(THEME_ICON_SVG).toContain("xmlns=");
  });
});

// =============================================================================
// Fix K: empty sections filtered after content fixes
// =============================================================================

describe("assembleTemplatesXml — empty section filtering (Fix K)", () => {
  it("filters out sections with < 30 chars of text content", () => {
    const sections = [
      {
        snippetType: "s_cover",
        innerHtml: '<div class="container"><h1>Welcome to Our Amazing Restaurant Experience</h1><p>Fine dining in the heart of the city with incredible service</p></div>',
        isFooter: false,
      },
      {
        // After stripInlineTags this section has only empty divs
        snippetType: "s_text_block",
        innerHtml: '<script>alert("hi")</script><style>.x{}</style>',
        isFooter: false,
      },
    ];
    const result = assembleTemplatesXml(sections);
    const sectionMatches = result.match(/<section\b/g) || [];
    expect(sectionMatches.length).toBe(1);
    expect(result).toContain("s_cover");
  });

  it("preserves non-empty sections", () => {
    const sections = [
      {
        snippetType: "s_three_columns",
        innerHtml: '<div class="container"><h2>Our Services</h2><p>We offer a wide range of professional services to meet your needs</p></div>',
        isFooter: false,
      },
    ];
    const result = assembleTemplatesXml(sections);
    expect(result).toContain("s_three_columns");
    expect(result).toContain("Our Services");
  });

  it("returns empty string when all sections become empty", () => {
    const sections = [
      {
        snippetType: "s_text_block",
        innerHtml: '<script>alert(1)</script>',
        isFooter: false,
      },
    ];
    const result = assembleTemplatesXml(sections);
    expect(result).toBe("");
  });
});

// =============================================================================
// Fix M: hex color stripping in assembleThemeScss
// =============================================================================

describe("assembleThemeScss — hex color handling (Fix M)", () => {
  it("preserves color: #hex declarations (needed for visual quality)", () => {
    const input = `.title {\n  color: #c9302c;\n  font-size: 2rem;\n}`;
    const result = assembleThemeScss(input);
    expect(result).toMatch(/color:\s*#c9302c/);
    expect(result).toContain("font-size: 2rem");
  });

  it("preserves background-color: #hex declarations (needed for visual quality)", () => {
    const input = `.hero {\n  background-color: #f5f0e8;\n  padding: 2rem;\n}`;
    const result = assembleThemeScss(input);
    expect(result).toMatch(/background-color:\s*#f5f0e8/);
    expect(result).toContain("padding: 2rem");
  });

  it("preserves rgba() color values", () => {
    const input = `.card {\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);\n  color: #333;\n}`;
    const result = assembleThemeScss(input);
    expect(result).toContain("rgba(0, 0, 0, 0.1)");
  });

  it("preserves valid non-color selectors containing hex-like strings", () => {
    const input = `section[data-snippet="s_cover"] {\n  min-height: 75vh;\n}`;
    const result = assembleThemeScss(input);
    expect(result).toContain('section[data-snippet="s_cover"]');
    expect(result).toContain("min-height: 75vh");
  });
});

// =============================================================================
// Sprint 7 Integration: full pipeline with all fixes
// =============================================================================

describe("Sprint 7 Integration — forms + scripts + styles + empty sections + hex colors", () => {
  it("cleans all problematic patterns in a single pipeline run", () => {
    const messyXml: ParsedFile = {
      path: "views/templates.xml",
      content: `<section data-snippet="s_cover">
  <div class="container text-center">
    <h1 class="display-3 fw-bold">Welcome to Our Restaurant with Amazing Food</h1>
    <p class="lead">Fine dining experience like no other with amazing food</p>
    <form method="POST" action="/reserve"><input type="text" name="name"><button>Reserve</button></form>
    <script>document.querySelector('form').addEventListener('submit', e => e.preventDefault())</script>
    <style>.hero { color: red; }</style>
  </div>
</section>
<section data-snippet="s_three_columns">
  <div class="container">
    <h2 class="text-center fw-bold mb-5">Our Menu Specials for This Season</h2>
    <div class="row g-4">
      <div class="col-md-4"><div class="card"><div class="card-body"><h5>Pasta Primavera</h5><p>Fresh seasonal vegetables tossed in a light sauce</p></div></div></div>
      <div class="col-md-4"><div class="card"><div class="card-body"><h5>Grilled Salmon</h5><p>Atlantic salmon with herbs and lemon butter</p></div></div></div>
      <div class="col-md-4"><div class="card"><div class="card-body"><h5>Tiramisu</h5><p>Classic Italian dessert with espresso and mascarpone</p></div></div></div>
    </div>
  </div>
</section>
<section data-snippet="s_text_block">
  <script>trackPageView()</script>
  <style>.hidden{display:none}</style>
</section>`,
      language: "xml",
      action: "create",
    };

    const messyScss: ParsedFile = {
      path: "static/src/scss/theme.scss",
      content: `.hero {\n  color: #c9302c;\n  min-height: 75vh;\n}\n.card {\n  background-color: #f5f0e8;\n  border-radius: 0.5rem;\n}`,
      language: "scss",
      action: "create",
    };

    const result = assembleThemeFiles([messyXml, messyScss], "Theme Restaurant", "restaurant");

    // Templates: no forms, scripts, styles
    const templates = result.find(f => f.path.includes("templates.xml"));
    expect(templates).toBeDefined();
    expect(templates!.content).not.toContain("<form");
    expect(templates!.content).not.toContain("<script");
    expect(templates!.content).not.toContain("<style");
    // Forms replaced with CTA
    expect(templates!.content).toContain("/contactus");

    // Empty section (only had script+style) should be filtered
    const sectionBlocks = templates!.content.match(/<section\b/g) || [];
    expect(sectionBlocks.length).toBe(2); // hero + menu, NOT the empty one

    // theme.scss: hex colors preserved (stripping was killing visual quality)
    const themeScss = result.find(f => f.path.includes("theme.scss"));
    expect(themeScss).toBeDefined();
    expect(themeScss!.content).toContain("min-height: 75vh");
    expect(themeScss!.content).toContain("border-radius: 0.5rem");

    // Icon present
    const iconFile = result.find(f => f.path.includes("icon.svg"));
    expect(iconFile).toBeDefined();
  });
});

// =============================================================================
// E2E Pipeline Validation: realistic AI response → parseGeneratedFiles → ensureRequiredFiles
// Simulates actual production path with intentionally bad patterns
// =============================================================================

describe("E2E Pipeline — parseGeneratedFiles → ensureRequiredFiles (production path)", () => {
  // Simulate realistic AI output with ALL known bad patterns
  const REALISTIC_AI_RESPONSE = `Here's a complete Odoo 18 restaurant theme:

\`\`\`xml file:views/templates.xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="theme_restaurant_homepage" inherit_id="website.homepage" name="Restaurant Homepage">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap">
        <section class="o_cc o_cc1" data-snippet="s_cover">
          <div class="container text-center py-5">
            <h1 class="display-3 fw-bold">Welcome to La Bella Cucina Italian Restaurant</h1>
            <p class="lead mt-3">Experience authentic Italian dining with fresh ingredients and traditional recipes passed down through generations</p>
            <form method="POST" action="/reserve">
              <input type="text" name="name" placeholder="Your Name">
              <input type="email" name="email" placeholder="Email">
              <button type="submit" class="btn btn-primary">Make Reservation</button>
            </form>
            <script>
              document.querySelector('form').addEventListener('submit', function(e) {
                e.preventDefault();
                alert('Reserved!');
              });
            </script>
            <style>
              .hero-section { background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)); }
            </style>
          </div>
        </section>
        <section class="o_cc o_cc2" data-snippet="s_three_columns">
          <div class="container py-5">
            <h2 class="text-center fw-bold mb-5">Our Signature Dishes and Specialties</h2>
            <div class="row g-4">
              <div class="col-md-4">
                <div class="card h-100 shadow-sm">
                  <img src="images/pasta.jpg" class="card-img-top">
                  <div class="card-body">
                    <h5 class="card-title fw-bold">Pasta Carbonara</h5>
                    <p class="card-text">Traditional Roman pasta with guanciale, eggs, and pecorino cheese</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card h-100 shadow-sm">
                  <img src="https://images.unsplash.com/photo-1504674900247?w=400" class="card-img-top">
                  <div class="card-body">
                    <h5 class="card-title fw-bold">Osso Buco</h5>
                    <p class="card-text">Braised veal shanks with gremolata, served over saffron risotto</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card h-100 shadow-sm">
                  <img src="/static/images/tiramisu.jpg" class="card-img-top">
                  <div class="card-body">
                    <h5 class="card-title fw-bold">Tiramisu</h5>
                    <p class="card-text">Classic Italian dessert with layers of espresso-soaked ladyfingers and mascarpone</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section class="o_cc o_cc3" data-snippet="s_text_block">
          <script>trackPageView('restaurant-home')</script>
          <style>.analytics-hidden { display: none; }</style>
        </section>
        <section class="o_cc o_cc4" data-snippet="s_text_image">
          <div class="container py-5">
            <div class="row align-items-center">
              <div class="col-md-6">
                <h2 class="fw-bold">Our Story and Heritage of Excellence</h2>
                <p>Founded in 1985, La Bella Cucina has been serving authentic Italian cuisine for over four decades. Our recipes are inspired by the rich culinary traditions of Tuscany and Rome.</p>
                <p>Every dish is prepared with the freshest locally-sourced ingredients and traditional cooking methods passed down through generations of Italian chefs.</p>
              </div>
              <div class="col-md-6">
                <img src="images/restaurant.jpg" class="img-fluid rounded shadow">
              </div>
            </div>
          </div>
        </section>
        <section class="o_cc o_cc5" data-snippet="s_call_to_action">
          <div class="container text-center py-5">
            <h2 class="fw-bold">Ready to Experience La Bella Cucina?</h2>
            <p class="lead">Book your table today and enjoy an unforgettable dining experience</p>
            <form method="POST" action="/book">
              <input type="tel" name="phone" placeholder="Phone Number">
              <textarea name="notes" placeholder="Special requests"></textarea>
              <button class="btn btn-lg btn-primary">Book Now</button>
            </form>
          </div>
        </section>
      </div>
    </xpath>
  </template>
</odoo>
\`\`\`

\`\`\`scss file:static/src/scss/primary_variables.scss
$o-color-palettes: (
  'theme-custom': (
    'o-color-1': #c9302c,
    'o-color-2': #8b4513,
    'o-color-3': #d4a373,
    'o-color-4': #fefae0,
    'o-color-5': #1a1a1a,
  ),
);
$o-theme-color-palette-number: 'theme-custom' !default;
\`\`\`

\`\`\`scss file:static/src/scss/theme.scss
body {
  font-family: 'Playfair Display', serif;
  color: #1a1a1a;
}

.container {
  max-width: 1140px;
}

:root {
  --primary: #c9302c;
  --secondary: #8b4513;
}

.hero-section {
  min-height: 80vh;
  color: #c9302c;
  background-image: url(/images/hero-bg.jpg);
  display: flex;
  align-items: center;
}

.card {
  font-family: 'Open Sans', sans-serif;
  border-radius: 0.75rem;
  background-color: #f5f0e8;
  transition: transform 0.3s ease;
}

.card:hover {
  transform: translateY(-5px);
}

section {
  padding: 4rem 0;
}
\`\`\`

\`\`\`python file:__manifest__.py
{
    'name': 'Theme La Bella Cucina',
    'version': '18.0.1.0.0',
    'category': 'Theme/Creative',
    'summary': 'Elegant Italian restaurant theme',
    'depends': ['website'],
    'data': [
        'views/templates.xml',
        'views/snippets.xml',
        'views/pages/menu.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'theme_la_bella_cucina/static/src/scss/primary_variables.scss',
            'theme_la_bella_cucina/static/src/scss/theme.scss',
        ],
    },
}
\`\`\`

This theme provides an elegant Italian restaurant experience with proper Odoo 18 structure.`;

  it("full pipeline produces installable Odoo 18 module from messy AI output", () => {
    // Step 1: Parse AI response (production parser)
    const parsed = parseGeneratedFiles(REALISTIC_AI_RESPONSE);

    // Verify parser extracted files
    expect(parsed.length).toBeGreaterThanOrEqual(3);
    const hasXml = parsed.some(f => f.path.endsWith(".xml"));
    const hasScss = parsed.some(f => f.path.endsWith(".scss"));
    expect(hasXml).toBe(true);
    expect(hasScss).toBe(true);

    // Step 2: Run through ensureRequiredFiles (production pipeline)
    const result = ensureRequiredFiles(parsed, "Theme La Bella Cucina");

    // =========================================================================
    // SPRINT 7 QUALITY CHECKS
    // =========================================================================

    // --- Fix G: No raw <form> tags ---
    const templates = result.find(f => f.path.includes("templates.xml"));
    expect(templates).toBeDefined();
    expect(templates!.content).not.toContain("<form");
    expect(templates!.content).not.toContain("</form>");
    // Forms should be replaced with CTA buttons
    expect(templates!.content).toContain("/contactus");

    // --- Fix H: No <script> or <style> tags ---
    expect(templates!.content).not.toContain("<script");
    expect(templates!.content).not.toContain("</script>");
    expect(templates!.content).not.toContain("<style");
    expect(templates!.content).not.toContain("</style>");

    // --- Fix I: icon.svg present ---
    const iconFile = result.find(f => f.path.includes("icon.svg"));
    expect(iconFile).toBeDefined();
    expect(iconFile!.content).toContain("<svg");

    // --- Fix J: Manifest only references existing files ---
    const manifest = result.find(f => f.path.includes("__manifest__"));
    expect(manifest).toBeDefined();
    // AI originally referenced views/snippets.xml and views/pages/menu.xml which don't exist
    expect(manifest!.content).not.toContain("snippets.xml");
    expect(manifest!.content).not.toContain("pages/menu.xml");
    // But templates.xml should be referenced (it exists)
    expect(manifest!.content).toContain("templates.xml");

    // --- Fix J: Category is Website/Theme (not Theme/Creative from AI) ---
    expect(manifest!.content).toContain("'category': 'Website/Theme'");

    // --- Fix K: Empty sections filtered ---
    // The section with only <script> + <style> should have been removed
    // Count sections in output
    const sectionMatches = templates!.content.match(/<section\b/g) || [];
    // Original had 5 sections, one was empty (only script+style) = 4 should remain
    expect(sectionMatches.length).toBeLessThan(5);
    expect(sectionMatches.length).toBeGreaterThanOrEqual(2);

    // --- Fix M: Hex colors preserved in theme.scss (stripping was #1 visual quality killer) ---
    const themeScss = result.find(f => f.path.includes("theme.scss"));
    expect(themeScss).toBeDefined();
    // Valid non-color properties should survive
    expect(themeScss!.content).toContain("border-radius");

    // =========================================================================
    // EXISTING QUALITY CHECKS (Sprints 1-6)
    // =========================================================================

    // Fix A: No dangerous global CSS overrides
    expect(themeScss!.content).not.toMatch(/^body\s*\{/m);
    expect(themeScss!.content).not.toMatch(/^\.container\s*\{/m);
    expect(themeScss!.content).not.toMatch(/^:root\s*\{/m);
    // background-image preserved (needed for section styling in theme.scss)
    expect(themeScss!.content).not.toContain("font-family");

    // Fix B: Palette activation present
    const primaryVars = result.find(f => f.path.includes("primary_variables.scss"));
    expect(primaryVars).toBeDefined();
    expect(primaryVars!.content).toContain("$o-color-palettes");
    expect(primaryVars!.content).toContain("$o-theme-color-palette-number");

    // Fix C: All sections have container wrappers
    const sectionBlocks = templates!.content.match(/<section[^>]*>[\s\S]*?<\/section>/g) || [];
    for (const block of sectionBlocks) {
      expect(block).toMatch(/<div[^>]*class="[^"]*container/);
    }

    // Fix D: Images have proper attributes (alt, loading)
    if (templates!.content.includes("<img")) {
      expect(templates!.content).toMatch(/<img[^>]*alt=/);
      expect(templates!.content).toMatch(/<img[^>]*loading="lazy"/);
    }
    // Broken relative image paths replaced with Odoo defaults
    expect(templates!.content).not.toContain('src="images/');

    // Structural: correct Odoo 18 structure
    expect(templates!.content).toContain("inherit_id");
    expect(templates!.content).toContain("website.homepage");
    expect(templates!.content).toContain("xpath");
    expect(templates!.content).toContain("o_cc");
    expect(templates!.content).toContain("data-snippet");

    // Manifest: correct asset bundle routing
    expect(manifest!.content).toContain("web._assets_primary_variables");
    expect(manifest!.content).toContain("prepend");
    expect(manifest!.content).toContain("primary_variables.scss");

    // __init__.py present
    const initPy = result.find(f => f.path.includes("__init__.py"));
    expect(initPy).toBeDefined();
  });

  it("no file in output contains XSS vectors", () => {
    const parsed = parseGeneratedFiles(REALISTIC_AI_RESPONSE);
    const result = ensureRequiredFiles(parsed, "Theme La Bella Cucina");

    for (const file of result) {
      if (file.path.endsWith(".xml")) {
        expect(file.content).not.toContain("<script");
        expect(file.content).not.toContain("javascript:");
        expect(file.content).not.toContain("onerror=");
        expect(file.content).not.toContain("onload=");
      }
    }
  });

  it("manifest data[] entries all correspond to actual files", () => {
    const parsed = parseGeneratedFiles(REALISTIC_AI_RESPONSE);
    const result = ensureRequiredFiles(parsed, "Theme La Bella Cucina");

    const manifest = result.find(f => f.path.includes("__manifest__"));
    expect(manifest).toBeDefined();

    // Extract all data entries from manifest
    const dataMatch = manifest!.content.match(/'data'\s*:\s*\[([\s\S]*?)\]/);
    if (dataMatch) {
      const entries = dataMatch[1].match(/'([^']+)'/g)?.map(e => e.replace(/'/g, '')) || [];

      // Every data entry must correspond to a file in the result
      const filePaths = new Set(result.map(f =>
        f.path
          .replace(/^theme_generated\//, "")
          .replace(/^theme_[a-z0-9_]+\//i, "")
      ));

      for (const entry of entries) {
        expect(filePaths.has(entry)).toBe(true);
      }
    }
  });
});

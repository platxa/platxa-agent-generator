import { describe, it, expect, beforeEach } from "vitest";
import {
  SnippetAttributor,
  attributeSnippetIds,
  detectSnippets,
  ensureSnippetIds,
  createTypedIdGenerator,
  createUuidIdGenerator,
  validateSnippetIds,
  extractSnippetId,
  extractSnippetType,
} from "@/lib/preview/snippet-attribution";

describe("SnippetAttributor", () => {
  let attributor: SnippetAttributor;

  beforeEach(() => {
    attributor = new SnippetAttributor();
  });

  describe("attribute", () => {
    it("adds data-snippet-id to elements with data-snippet attribute", () => {
      const html = `<section data-snippet="s_banner">content</section>`;
      const { html: result, totalSnippets } = attributor.attribute(html);

      expect(result).toContain('data-snippet-id="snippet-0"');
      expect(result).toContain('data-snippet="s_banner"');
      expect(totalSnippets).toBe(1);
    });

    it("adds data-snippet-id to elements with s_xxx class pattern", () => {
      const html = `<section class="s_features pt-5">content</section>`;
      const { html: result, totalSnippets } = attributor.attribute(html);

      expect(result).toContain('data-snippet-id="snippet-0"');
      expect(result).toContain('data-snippet="s_features"');
      expect(totalSnippets).toBe(1);
    });

    it("generates unique IDs for multiple snippets", () => {
      const html = `
        <section data-snippet="s_banner">banner</section>
        <section data-snippet="s_features">features</section>
        <section data-snippet="s_footer">footer</section>
      `;
      const { html: result, totalSnippets, snippetMap } = attributor.attribute(html);

      expect(result).toContain('data-snippet-id="snippet-0"');
      expect(result).toContain('data-snippet-id="snippet-1"');
      expect(result).toContain('data-snippet-id="snippet-2"');
      expect(totalSnippets).toBe(3);
      expect(snippetMap.get("snippet-0")).toBe("s_banner");
      expect(snippetMap.get("snippet-1")).toBe("s_features");
      expect(snippetMap.get("snippet-2")).toBe("s_footer");
    });

    it("handles multiple instances of the same snippet type", () => {
      const html = `
        <section data-snippet="s_banner">banner 1</section>
        <section data-snippet="s_banner">banner 2</section>
      `;
      const { html: result, snippetMap } = attributor.attribute(html);

      expect(result).toContain('data-snippet-id="snippet-0"');
      expect(result).toContain('data-snippet-id="snippet-1"');
      expect(snippetMap.get("snippet-0")).toBe("s_banner");
      expect(snippetMap.get("snippet-1")).toBe("s_banner");
    });

    it("preserves existing attributes on snippet elements", () => {
      const html = `<section data-snippet="s_banner" class="pt-5 pb-5" style="background: red;">content</section>`;
      const { html: result } = attributor.attribute(html);

      expect(result).toContain('class="pt-5 pb-5"');
      expect(result).toContain('style="background: red;"');
      expect(result).toContain('data-snippet-id="snippet-0"');
    });

    it("handles various element types", () => {
      const html = `
        <div data-snippet="s_card">card</div>
        <footer data-snippet="s_footer">footer</footer>
        <header data-snippet="s_header">header</header>
        <article data-snippet="s_article">article</article>
        <aside data-snippet="s_sidebar">sidebar</aside>
        <nav data-snippet="s_nav">nav</nav>
      `;
      const { totalSnippets } = attributor.attribute(html);

      expect(totalSnippets).toBe(6);
    });

    it("does not modify non-snippet elements", () => {
      const html = `<div class="container"><p>Regular content</p></div>`;
      const { html: result, totalSnippets } = attributor.attribute(html);

      expect(result).toBe(html);
      expect(totalSnippets).toBe(0);
    });

    it("handles nested snippets", () => {
      const html = `
        <section data-snippet="s_banner">
          <div data-snippet="s_card">nested card</div>
        </section>
      `;
      const { html: result, totalSnippets } = attributor.attribute(html);

      expect(result).toContain('data-snippet-id="snippet-0"');
      expect(result).toContain('data-snippet-id="snippet-1"');
      expect(totalSnippets).toBe(2);
    });

    it("handles empty HTML", () => {
      const { html: result, totalSnippets } = attributor.attribute("");

      expect(result).toBe("");
      expect(totalSnippets).toBe(0);
    });

    it("handles HTML with no snippets", () => {
      const html = `<div><p>No snippets here</p></div>`;
      const { html: result, totalSnippets } = attributor.attribute(html);

      expect(result).toBe(html);
      expect(totalSnippets).toBe(0);
    });
  });

  describe("options", () => {
    it("uses custom ID prefix", () => {
      const customAttributor = new SnippetAttributor({ idPrefix: "block" });
      const { html: result } = customAttributor.attribute(`<section data-snippet="s_banner">content</section>`);

      expect(result).toContain('data-snippet-id="block-0"');
    });

    it("uses custom start counter", () => {
      const customAttributor = new SnippetAttributor({ startCounter: 100 });
      const { html: result } = customAttributor.attribute(`<section data-snippet="s_banner">content</section>`);

      expect(result).toContain('data-snippet-id="snippet-100"');
    });

    it("preserves existing IDs when preserveExisting is true", () => {
      const customAttributor = new SnippetAttributor({ preserveExisting: true });
      const html = `<section data-snippet="s_banner" data-snippet-id="existing-id">content</section>`;
      const { html: result, preservedIds } = customAttributor.attribute(html);

      expect(result).toContain('data-snippet-id="existing-id"');
      expect(result).not.toContain('data-snippet-id="snippet-0"');
      expect(preservedIds).toContain("existing-id");
    });

    it("uses custom ID generator", () => {
      const customAttributor = new SnippetAttributor({
        idGenerator: (index, type) => `custom-${type}-${index}`,
      });
      const { html: result } = customAttributor.attribute(`<section data-snippet="s_banner">content</section>`);

      expect(result).toContain('data-snippet-id="custom-s_banner-0"');
    });
  });

  describe("detect", () => {
    it("detects snippets without modifying HTML", () => {
      const html = `
        <section data-snippet="s_banner">banner</section>
        <section data-snippet="s_features">features</section>
      `;
      const snippets = attributor.detect(html);

      expect(snippets).toHaveLength(2);
      expect(snippets[0].type).toBe("s_banner");
      expect(snippets[1].type).toBe("s_features");
    });

    it("returns correct indices", () => {
      const html = `
        <section data-snippet="s_banner">banner</section>
        <section data-snippet="s_features">features</section>
        <section data-snippet="s_footer">footer</section>
      `;
      const snippets = attributor.detect(html);

      expect(snippets[0].index).toBe(0);
      expect(snippets[1].index).toBe(1);
      expect(snippets[2].index).toBe(2);
    });

    it("identifies existing vs new IDs", () => {
      const html = `
        <section data-snippet="s_banner" data-snippet-id="existing">banner</section>
        <section data-snippet="s_features">features</section>
      `;
      const snippets = attributor.detect(html);

      expect(snippets[0].isNew).toBe(false);
      expect(snippets[0].id).toBe("existing");
      expect(snippets[1].isNew).toBe(true);
    });
  });

  describe("getSnippetType", () => {
    it("returns snippet type for attributed ID", () => {
      attributor.attribute(`<section data-snippet="s_banner">content</section>`);

      expect(attributor.getSnippetType("snippet-0")).toBe("s_banner");
    });

    it("returns undefined for unknown ID", () => {
      expect(attributor.getSnippetType("unknown")).toBeUndefined();
    });
  });

  describe("getAllIds", () => {
    it("returns all attributed IDs", () => {
      attributor.attribute(`
        <section data-snippet="s_banner">banner</section>
        <section data-snippet="s_features">features</section>
      `);

      const ids = attributor.getAllIds();
      expect(ids).toContain("snippet-0");
      expect(ids).toContain("snippet-1");
      expect(ids).toHaveLength(2);
    });
  });

  describe("getIdsByType", () => {
    it("returns IDs for specific snippet type", () => {
      attributor.attribute(`
        <section data-snippet="s_banner">banner 1</section>
        <section data-snippet="s_features">features</section>
        <section data-snippet="s_banner">banner 2</section>
      `);

      const bannerIds = attributor.getIdsByType("s_banner");
      expect(bannerIds).toContain("snippet-0");
      expect(bannerIds).toContain("snippet-2");
      expect(bannerIds).toHaveLength(2);
    });
  });

  describe("reset", () => {
    it("resets counter and clears map", () => {
      attributor.attribute(`<section data-snippet="s_banner">content</section>`);
      expect(attributor.currentCounter).toBe(1);

      attributor.reset();

      expect(attributor.currentCounter).toBe(0);
      expect(attributor.getAllIds()).toHaveLength(0);
    });
  });
});

describe("attributeSnippetIds", () => {
  it("attributes IDs in one function call", () => {
    const { html, totalSnippets } = attributeSnippetIds(
      `<section data-snippet="s_banner">content</section>`,
    );

    expect(html).toContain('data-snippet-id="snippet-0"');
    expect(totalSnippets).toBe(1);
  });

  it("accepts options", () => {
    const { html } = attributeSnippetIds(
      `<section data-snippet="s_banner">content</section>`,
      { idPrefix: "custom" },
    );

    expect(html).toContain('data-snippet-id="custom-0"');
  });
});

describe("detectSnippets", () => {
  it("detects snippets without modification", () => {
    const snippets = detectSnippets(`
      <section data-snippet="s_banner">banner</section>
      <section class="s_features">features</section>
    `);

    expect(snippets.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ensureSnippetIds", () => {
  it("preserves existing IDs and generates for missing", () => {
    const html = `
      <section data-snippet="s_banner" data-snippet-id="keep-me">banner</section>
      <section data-snippet="s_features">needs id</section>
    `;
    const { html: result, preservedIds } = ensureSnippetIds(html);

    expect(result).toContain('data-snippet-id="keep-me"');
    expect(result).toContain('data-snippet-id="snippet-0"');
    expect(preservedIds).toContain("keep-me");
  });
});

describe("createTypedIdGenerator", () => {
  it("generates IDs that include snippet type", () => {
    const generator = createTypedIdGenerator("block");

    expect(generator(0, "s_banner")).toBe("block-banner-0");
    expect(generator(1, "s_features")).toBe("block-features-1");
  });
});

describe("createUuidIdGenerator", () => {
  it("generates UUID-format IDs", () => {
    const generator = createUuidIdGenerator();
    const id = generator(0, "s_banner");

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("generates unique IDs", () => {
    const generator = createUuidIdGenerator();
    const ids = new Set([
      generator(0, "s_banner"),
      generator(1, "s_banner"),
      generator(2, "s_banner"),
    ]);

    expect(ids.size).toBe(3);
  });
});

describe("validateSnippetIds", () => {
  it("returns valid for properly attributed HTML", () => {
    const html = `
      <section data-snippet="s_banner" data-snippet-id="snippet-0">banner</section>
      <section data-snippet="s_features" data-snippet-id="snippet-1">features</section>
    `;
    const { valid, duplicates, missing } = validateSnippetIds(html);

    expect(valid).toBe(true);
    expect(duplicates).toHaveLength(0);
    expect(missing).toBe(0);
  });

  it("detects duplicate IDs", () => {
    const html = `
      <section data-snippet="s_banner" data-snippet-id="same-id">banner</section>
      <section data-snippet="s_features" data-snippet-id="same-id">features</section>
    `;
    const { valid, duplicates } = validateSnippetIds(html);

    expect(valid).toBe(false);
    expect(duplicates).toContain("same-id");
  });

  it("detects missing IDs", () => {
    const html = `
      <section data-snippet="s_banner" data-snippet-id="snippet-0">banner</section>
      <section data-snippet="s_features">no id</section>
    `;
    const { valid, missing } = validateSnippetIds(html);

    expect(valid).toBe(false);
    expect(missing).toBe(1);
  });
});

describe("extractSnippetId", () => {
  it("extracts snippet ID from element HTML", () => {
    const elementHtml = `<section data-snippet="s_banner" data-snippet-id="snippet-5" class="pt-5">`;

    expect(extractSnippetId(elementHtml)).toBe("snippet-5");
  });

  it("returns null when no ID present", () => {
    const elementHtml = `<section data-snippet="s_banner" class="pt-5">`;

    expect(extractSnippetId(elementHtml)).toBeNull();
  });
});

describe("extractSnippetType", () => {
  it("extracts type from data-snippet attribute", () => {
    const elementHtml = `<section data-snippet="s_banner" class="pt-5">`;

    expect(extractSnippetType(elementHtml)).toBe("s_banner");
  });

  it("extracts type from class pattern", () => {
    const elementHtml = `<section class="s_features pt-5 pb-5">`;

    expect(extractSnippetType(elementHtml)).toBe("s_features");
  });

  it("prefers data-snippet over class", () => {
    const elementHtml = `<section data-snippet="s_banner" class="s_features pt-5">`;

    expect(extractSnippetType(elementHtml)).toBe("s_banner");
  });

  it("returns null when no snippet type found", () => {
    const elementHtml = `<div class="container">`;

    expect(extractSnippetType(elementHtml)).toBeNull();
  });
});

describe("verification: every snippet wrapper has data-snippet-id", () => {
  it("attributes all snippets in a full page", () => {
    const fullPage = `
      <!DOCTYPE html>
      <html>
      <body>
        <header data-snippet="s_header">Header</header>
        <section data-snippet="s_banner" class="pt-5">
          <div class="container">Banner content</div>
        </section>
        <section data-snippet="s_features">
          <div class="row">Features</div>
        </section>
        <section class="s_testimonials">Testimonials</section>
        <section data-snippet="s_cta">Call to action</section>
        <footer data-snippet="s_footer">Footer</footer>
      </body>
      </html>
    `;

    const { html, totalSnippets } = attributeSnippetIds(fullPage);
    const validation = validateSnippetIds(html);

    expect(totalSnippets).toBe(6);
    expect(validation.valid).toBe(true);
    expect(validation.duplicates).toHaveLength(0);
    expect(validation.missing).toBe(0);

    // Verify each snippet has unique ID
    expect(html).toContain('data-snippet-id="snippet-0"');
    expect(html).toContain('data-snippet-id="snippet-1"');
    expect(html).toContain('data-snippet-id="snippet-2"');
    expect(html).toContain('data-snippet-id="snippet-3"');
    expect(html).toContain('data-snippet-id="snippet-4"');
    expect(html).toContain('data-snippet-id="snippet-5"');
  });

  it("handles real Odoo snippet patterns", () => {
    const odooPage = `
      <section class="s_banner pt96 pb96 o_cc o_cc1" data-snippet="s_banner">
        <div class="container">
          <h1>Welcome</h1>
        </div>
      </section>
      <section class="s_three_columns pt64 pb64" data-snippet="s_three_columns">
        <div class="container">
          <div class="row">Columns</div>
        </div>
      </section>
      <section class="s_cta pt64 pb64 bg-primary" data-snippet="s_cta">
        <div class="container">CTA</div>
      </section>
    `;

    const { html, totalSnippets } = attributeSnippetIds(odooPage);

    expect(totalSnippets).toBe(3);
    expect(validateSnippetIds(html).valid).toBe(true);
  });
});

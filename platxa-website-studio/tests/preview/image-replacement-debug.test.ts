/**
 * Diagnostic test to find root cause of preview image replacement failure.
 * Tests each stage of the preview pipeline to locate where /web/image/ URLs
 * survive despite replaceImagesWithPlaceholders being called.
 */
import { describe, it, expect } from "vitest";
import { replaceImagesWithPlaceholders, generatePlaceholderDataURL } from "@/lib/preview/placeholder-images";

// Sample assembled templates.xml (matches real assembler output format)
const ASSEMBLED_XML = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage_content" name="Homepage" inherit_id="website.homepage" customize_show="True">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
        <section class="o_cc o_cc1 pt96 pb96" data-snippet="s_cover" style="background-image: url('/web/image/website.s_cover_default_image'); background-size: cover; min-height: 70vh;">
          <div class="container">
            <div class="row">
              <div class="col-lg-7">
                <h1>Welcome to Our Restaurant</h1>
                <p class="lead">Experience authentic Italian cuisine</p>
                <a href="/contactus" class="btn btn-primary btn-lg">Reserve a Table</a>
              </div>
            </div>
          </div>
        </section>
        <section class="o_cc o_cc2 pt64 pb64" data-snippet="s_text_image">
          <div class="container">
            <div class="row align-items-center">
              <div class="col-lg-6">
                <h2>Our Story</h2>
                <p>Founded in 1985, we bring traditional flavors to your table.</p>
              </div>
              <div class="col-lg-6">
                <img class="img-fluid" alt="About us" loading="lazy" src="/web/image/website.s_text_image_default_image" />
              </div>
            </div>
          </div>
        </section>
        <section class="o_cc o_cc3 pt64 pb64" data-snippet="s_three_columns">
          <div class="container">
            <h2 class="text-center">Our Menu</h2>
            <div class="row">
              <div class="col-md-4">
                <img class="img-fluid" alt="Appetizers" loading="lazy" src="/web/image/website.s_text_image_default_image" />
                <h3>Appetizers</h3>
              </div>
              <div class="col-md-4">
                <img class="img-fluid" alt="Main Course" loading="lazy" src="/web/image/website.s_text_image_default_image" />
                <h3>Main Course</h3>
              </div>
              <div class="col-md-4">
                <img class="img-fluid" alt="Desserts" loading="lazy" src="/web/image/website.s_text_image_default_image" />
                <h3>Desserts</h3>
              </div>
            </div>
          </div>
        </section>
      </div>
    </xpath>
  </template>
</odoo>`;

// HTML extracted after stripOdooTags (what replaceImagesWithPlaceholders actually receives)
const EXTRACTED_HTML = `<div id="wrap" class="oe_structure">
        <section class="o_cc o_cc1 pt96 pb96" data-snippet="s_cover" style="background-image: url('/web/image/website.s_cover_default_image'); background-size: cover; min-height: 70vh;">
          <div class="container">
            <div class="row">
              <div class="col-lg-7">
                <h1>Welcome to Our Restaurant</h1>
                <p class="lead">Experience authentic Italian cuisine</p>
                <a href="/contactus" class="btn btn-primary btn-lg">Reserve a Table</a>
              </div>
            </div>
          </div>
        </section>
        <section class="o_cc o_cc2 pt64 pb64" data-snippet="s_text_image">
          <div class="container">
            <div class="row align-items-center">
              <div class="col-lg-6">
                <h2>Our Story</h2>
                <p>Founded in 1985, we bring traditional flavors to your table.</p>
              </div>
              <div class="col-lg-6">
                <img class="img-fluid" alt="About us" loading="lazy" src="/web/image/website.s_text_image_default_image" />
              </div>
            </div>
          </div>
        </section>
        <section class="o_cc o_cc3 pt64 pb64" data-snippet="s_three_columns">
          <div class="container">
            <h2 class="text-center">Our Menu</h2>
            <div class="row">
              <div class="col-md-4">
                <img class="img-fluid" alt="Appetizers" loading="lazy" src="/web/image/website.s_text_image_default_image" />
                <h3>Appetizers</h3>
              </div>
              <div class="col-md-4">
                <img class="img-fluid" alt="Main Course" loading="lazy" src="/web/image/website.s_text_image_default_image" />
                <h3>Main Course</h3>
              </div>
              <div class="col-md-4">
                <img class="img-fluid" alt="Desserts" loading="lazy" src="/web/image/website.s_text_image_default_image" />
                <h3>Desserts</h3>
              </div>
            </div>
          </div>
        </section>
      </div>`;

describe("replaceImagesWithPlaceholders - Root Cause Diagnosis", () => {
  it("should replace img src with /web/image/ paths", () => {
    const html = `<img class="img-fluid" alt="About us" loading="lazy" src="/web/image/website.s_text_image_default_image" />`;
    const result = replaceImagesWithPlaceholders(html);
    expect(result).not.toContain("/web/image/");
    expect(result).toContain("data:image/svg+xml;base64,");
  });

  it("should replace background url() with /web/image/ paths", () => {
    const html = `<section style="background-image: url('/web/image/website.s_cover_default_image'); background-size: cover;">Content</section>`;
    const result = replaceImagesWithPlaceholders(html);
    expect(result).not.toContain("/web/image/");
    expect(result).toContain("data:image/svg+xml;base64,");
  });

  it("should handle self-closing img tags (XML format)", () => {
    const html = `<img class="img-fluid" alt="" loading="lazy" src="/web/image/website.s_text_image_default_image" />`;
    const result = replaceImagesWithPlaceholders(html);
    expect(result).not.toContain("/web/image/");
  });

  it("should replace ALL /web/image/ URLs in full extracted HTML", () => {
    const result = replaceImagesWithPlaceholders(EXTRACTED_HTML);
    // Count remaining /web/image/ occurrences
    const remaining = (result.match(/\/web\/image\//g) || []).length;
    expect(remaining).toBe(0);
    // Should contain data URIs
    const dataUriCount = (result.match(/data:image\/svg\+xml;base64,/g) || []).length;
    // Original has: 1 background url + 4 img srcs = 5 URLs
    expect(dataUriCount).toBeGreaterThanOrEqual(5);
  });

  it("should handle url() with double quotes", () => {
    const html = `<section style='background-image: url("/web/image/website.s_cover_default_image")'></section>`;
    const result = replaceImagesWithPlaceholders(html);
    expect(result).not.toContain("/web/image/");
  });

  it("should handle url() without quotes", () => {
    const html = `<section style="background-image: url(/web/image/website.s_cover_default_image)"></section>`;
    const result = replaceImagesWithPlaceholders(html);
    expect(result).not.toContain("/web/image/");
  });

  it("should handle multiple different URLs", () => {
    const html = `
      <img src="/web/image/website.s_cover_default_image" />
      <img src="/web/image/website.s_text_image_default_image" />
      <img src="/web/image/website.s_text_image_default_image" />
    `;
    const result = replaceImagesWithPlaceholders(html);
    expect(result).not.toContain("/web/image/");
  });

  it("should handle img tags with src BEFORE other attributes", () => {
    const html = `<img src="/web/image/website.s_cover_default_image" class="img-fluid" alt="test" />`;
    const result = replaceImagesWithPlaceholders(html);
    expect(result).not.toContain("/web/image/");
  });

  it("should handle single-quoted src attributes", () => {
    const html = `<img src='/web/image/website.s_cover_default_image' class='img-fluid' />`;
    const result = replaceImagesWithPlaceholders(html);
    // Check if single-quoted src is handled
    const hasWebImage = result.includes("/web/image/");
    if (hasWebImage) {
      console.error("BUG FOUND: replaceImagesWithPlaceholders does NOT handle single-quoted src attributes!");
    }
    // This might fail — revealing a bug
    expect(result).not.toContain("/web/image/");
  });

  it("should handle img with NO closing slash (HTML style, not XML)", () => {
    const html = `<img src="/web/image/website.s_cover_default_image" class="img-fluid" alt="test">`;
    const result = replaceImagesWithPlaceholders(html);
    expect(result).not.toContain("/web/image/");
  });

  it("should handle url() with escaped entities", () => {
    // After XML entity escaping, apostrophes might be &apos;
    const html = `<section style="background-image: url(&apos;/web/image/website.s_cover_default_image&apos;)"></section>`;
    const result = replaceImagesWithPlaceholders(html);
    const hasWebImage = result.includes("/web/image/");
    if (hasWebImage) {
      console.error("BUG FOUND: replaceImagesWithPlaceholders does NOT handle XML entity-escaped quotes in url()!");
    }
    expect(result).not.toContain("/web/image/");
  });

  it("should handle url() with &#39; entities", () => {
    const html = `<section style="background-image: url(&#39;/web/image/website.s_cover_default_image&#39;)"></section>`;
    const result = replaceImagesWithPlaceholders(html);
    const hasWebImage = result.includes("/web/image/");
    if (hasWebImage) {
      console.error("BUG FOUND: replaceImagesWithPlaceholders does NOT handle &#39; entities in url()!");
    }
    expect(result).not.toContain("/web/image/");
  });
});

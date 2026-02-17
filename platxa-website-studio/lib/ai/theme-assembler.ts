/**
 * Template-based Odoo 18 theme assembler
 *
 * ROOT CAUSE FIX: Instead of trying to patch broken AI-generated XML with regex,
 * we extract the CONTENT from whatever the AI generates and rebuild the files
 * from correct Odoo 18 templates. This guarantees:
 *   - Correct inherit_id="website.homepage"
 *   - Correct xpath expr="//div[@id='wrap']" position="replace"
 *   - Correct o_cc color combination classes on every section
 *   - Correct data-snippet attributes for Website Builder
 *   - Properly closed tags (xpath, template, section, div)
 *   - oe_structure wrapper for drag-and-drop support
 *
 * The AI's job is reduced to generating CONTENT (headlines, descriptions, cards).
 * Structure is handled deterministically by this assembler.
 */

import type { ParsedFile } from "./parser";
import { getBasename } from "./parser";
import { convertTailwindToBootstrap } from "./tailwind-bootstrap-map";

// =============================================================================
// SECTION EXTRACTION
// =============================================================================

interface ExtractedSection {
  snippetType: string;    // Odoo snippet type: s_cover, s_three_columns, etc.
  innerHtml: string;      // Content inside the section (container div, etc.)
  isFooter: boolean;      // Footer sections get special treatment
  sectionStyle?: string;  // Preserved inline style from original section tag (bg images, colors)
  sectionClass?: string;  // Preserved class from original section tag
  sectionDataAttrs?: Record<string, string>; // Preserved data-* attributes
}

/**
 * Map of data-snippet values used by Odoo 18 Website Builder
 */
const SNIPPET_TYPES = {
  hero: "s_cover",
  features: "s_three_columns",
  services: "s_three_columns",
  about: "s_text_image",
  testimonials: "s_three_columns",
  pricing: "s_three_columns",
  cta: "s_call_to_action",
  contact: "s_text_block",
  stats: "s_numbers",
  team: "s_three_columns",
  gallery: "s_images_wall",
  faq: "s_faq_collapse",
  newsletter: "s_newsletter_block",
  footer: "s_footer",
  generic: "s_text_block",
} as const;

/**
 * Detect the Odoo snippet type from section content
 */
function detectSnippetType(html: string): string {
  const lower = html.toLowerCase();

  // Check for existing data-snippet attribute first
  const snippetMatch = html.match(/data-snippet=["']([^"']+)["']/);
  if (snippetMatch) return snippetMatch[1];

  // Infer from content keywords and patterns
  if (lower.includes("display-") || lower.includes("hero") || lower.includes("banner") ||
      lower.includes("min-vh-") || lower.includes("jumbotron")) return SNIPPET_TYPES.hero;
  if (lower.includes("footer") || lower.includes("copyright") || lower.includes("©")) return SNIPPET_TYPES.footer;
  if (lower.includes("testimonial") || lower.includes("review") || lower.includes("what people say") ||
      lower.includes("what our") || lower.includes("client say")) return SNIPPET_TYPES.testimonials;
  if (lower.includes("pricing") || lower.includes("plan") || lower.includes("/month") ||
      lower.includes("per month")) return SNIPPET_TYPES.pricing;
  if (lower.includes("about us") || lower.includes("who we are") || lower.includes("our story") ||
      lower.includes("our mission")) return SNIPPET_TYPES.about;
  if (lower.includes("contact") || lower.includes("get in touch") || lower.includes("reach us") ||
      lower.includes("appointment") || lower.includes("reservation") || lower.includes("book")) return SNIPPET_TYPES.cta;
  if (lower.includes("feature") || lower.includes("service") || lower.includes("what we offer") ||
      lower.includes("our service") || lower.includes("practice area")) return SNIPPET_TYPES.features;
  if (lower.includes("team") || lower.includes("attorney") || lower.includes("doctor") ||
      lower.includes("chef") || lower.includes("staff")) return SNIPPET_TYPES.team;
  if (lower.includes("newsletter") || lower.includes("subscribe") || lower.includes("sign up for")) return SNIPPET_TYPES.newsletter;
  if (lower.includes("faq") || lower.includes("frequently asked")) return SNIPPET_TYPES.faq;

  // Check for grid patterns (col-md-4, col-md-3, col-lg-4)
  if (/col-(?:md|lg)-[34]/.test(lower)) return SNIPPET_TYPES.features;

  return SNIPPET_TYPES.generic;
}

/**
 * Extract balanced blocks of a given tag from HTML content.
 * Handles nested tags correctly by counting depth.
 * Returns array of { outerHtml, innerHtml, startIndex }.
 */
function extractBalancedBlocks(content: string, tagName: string): Array<{ outerHtml: string; innerHtml: string; openTag: string }> {
  const results: Array<{ outerHtml: string; innerHtml: string; openTag: string }> = [];
  const openPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let openMatch;

  while ((openMatch = openPattern.exec(content)) !== null) {
    const openTag = openMatch[0];
    const innerStart = openMatch.index + openTag.length;
    let depth = 1;
    let i = innerStart;
    const closeTag = `</${tagName}>`;
    const openTag2 = `<${tagName}`;

    while (i < content.length && depth > 0) {
      const closeIdx = content.indexOf(closeTag, i);
      const nextOpenIdx = content.toLowerCase().indexOf(openTag2.toLowerCase(), i);

      if (closeIdx === -1) break; // Unclosed tag, bail

      if (nextOpenIdx !== -1 && nextOpenIdx < closeIdx) {
        // Found a nested open tag before the next close
        depth++;
        i = nextOpenIdx + openTag2.length;
      } else {
        // Found a close tag
        depth--;
        if (depth === 0) {
          const innerHtml = content.substring(innerStart, closeIdx);
          const outerEnd = closeIdx + closeTag.length;
          const outerHtml = content.substring(openMatch.index, outerEnd);
          results.push({ outerHtml, innerHtml, openTag });
          // Advance regex past this entire block so nested tags aren't
          // re-extracted as standalone blocks (prevents duplicate content)
          openPattern.lastIndex = outerEnd;
        }
        i = closeIdx + closeTag.length;
      }
    }
  }

  return results;
}

/**
 * Extract inline style attribute from an HTML opening tag
 */
function extractStyleFromTag(openTag: string): string | undefined {
  const match = openTag.match(/style=["']([^"']+)["']/i);
  return match?.[1] || undefined;
}

/**
 * Extract class attribute from an HTML opening tag
 */
function extractClassFromTag(openTag: string): string | undefined {
  const match = openTag.match(/class=["']([^"']+)["']/i);
  return match?.[1] || undefined;
}

/**
 * Extract all data-* attributes from an HTML opening tag
 */
function extractDataAttrsFromTag(openTag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /data-([\w-]+)=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(openTag)) !== null) {
    attrs[`data-${match[1]}`] = match[2];
  }
  return attrs;
}

/**
 * Extract sections from AI-generated content (XML, HTML, or mixed)
 *
 * Handles all formats:
 * 1. Full Odoo XML: <odoo><template><xpath><div id="wrap"><section>...
 * 2. Partial XML: <template><section>...
 * 3. Raw sections: <section>...<section>...
 * 4. Footer/header blocks: <footer>..., <header>...
 * 5. Plain div content: <div class="container">...
 *
 * Uses balanced tag extraction to correctly handle nested sections.
 */
export function extractSections(content: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const seenContent = new Set<string>();

  // Phase 1: Extract <section> blocks (balanced, handles nesting)
  const sectionBlocks = extractBalancedBlocks(content, 'section');
  for (const block of sectionBlocks) {
    const innerHtml = block.innerHtml.trim();
    if (!innerHtml || innerHtml.length < 20) continue;

    const contentKey = innerHtml.substring(0, 80);
    if (seenContent.has(contentKey)) continue;
    seenContent.add(contentKey);

    const snippetType = detectSnippetType(block.outerHtml);
    sections.push({
      snippetType,
      innerHtml,
      isFooter: snippetType === SNIPPET_TYPES.footer,
      sectionStyle: extractStyleFromTag(block.openTag),
      sectionClass: extractClassFromTag(block.openTag),
      sectionDataAttrs: extractDataAttrsFromTag(block.openTag),
    });
  }

  // Phase 2: Extract <footer> blocks (if not already found as sections)
  const footerBlocks = extractBalancedBlocks(content, 'footer');
  for (const block of footerBlocks) {
    const innerHtml = block.innerHtml.trim();
    if (!innerHtml || innerHtml.length < 20) continue;

    const contentKey = innerHtml.substring(0, 80);
    if (seenContent.has(contentKey)) continue;
    seenContent.add(contentKey);

    sections.push({
      snippetType: SNIPPET_TYPES.footer,
      innerHtml,
      isFooter: true,
    });
  }

  // Phase 3: Extract <header>/<nav> blocks (if no hero section found)
  if (!sections.some(s => s.snippetType === SNIPPET_TYPES.hero)) {
    for (const tag of ['header', 'nav'] as const) {
      const headerBlocks = extractBalancedBlocks(content, tag);
      for (const block of headerBlocks) {
        const innerHtml = block.innerHtml.trim();
        if (!innerHtml || innerHtml.length < 20) continue;

        const contentKey = innerHtml.substring(0, 80);
        if (seenContent.has(contentKey)) continue;
        seenContent.add(contentKey);

        sections.push({
          snippetType: SNIPPET_TYPES.hero,
          innerHtml,
          isFooter: false,
        });
      }
    }
  }

  // Phase 4: If no sections found, try to extract standalone <div class="container"> blocks
  if (sections.length === 0) {
    const divBlocks = extractBalancedBlocks(content, 'div');
    let idx = 0;
    for (const block of divBlocks) {
      // Only keep divs with a container class
      if (!/class="[^"]*container[^"]*"/.test(block.outerHtml)) continue;

      const innerHtml = block.outerHtml.trim(); // Keep the whole container div
      if (!innerHtml || innerHtml.length < 30) continue;

      const contentKey = innerHtml.substring(0, 80);
      if (seenContent.has(contentKey)) continue;
      seenContent.add(contentKey);

      const snippetType = idx === 0 ? SNIPPET_TYPES.hero : detectSnippetType(innerHtml);
      sections.push({
        snippetType,
        innerHtml,
        isFooter: false,
      });
      idx++;
    }
  }

  return sections;
}

// =============================================================================
// CONTENT-LEVEL FIXES (kept from parser.ts — these fix actual content, not structure)
// =============================================================================

/**
 * Convert Tailwind CSS classes to Bootstrap 5 equivalents
 */
export function fixTailwindClasses(html: string): string {
  return convertTailwindToBootstrap(html);
}

/**
 * Replace placeholder image URLs with Odoo defaults
 */
export function fixPlaceholderUrls(html: string): string {
  const placeholderPattern = /(?:https?:\/\/)?(?:www\.)?(?:example\.com|placeholder\.com|placehold\.co|via\.placeholder\.com)[^\s"')]*\.(?:jpg|jpeg|png|gif|webp|svg)/gi;
  return html.replace(placeholderPattern, '/web/image/website.s_cover_default_image');
}

/**
 * Fix image tags: add missing alt, img-fluid, loading="lazy", fix broken paths
 */
export function fixImages(html: string): string {
  let fixed = html;
  // Add alt="" to img tags missing alt attribute
  fixed = fixed.replace(/<img(?![^>]*\balt\b)([^>]*?)(\s*\/?>)/gi, '<img alt=""$1$2');
  // Add img-fluid class to img tags that have a class but missing img-fluid
  fixed = fixed.replace(/<img(?![^>]*class="[^"]*img-fluid)([^>]*?)class="([^"]*)"([^>]*?)(\s*\/?>)/gi,
    '<img$1class="$2 img-fluid"$3$4');
  // Add class="img-fluid" to img tags with no class at all
  fixed = fixed.replace(/<img(?![^>]*\bclass\b)([^>]*?)(\s*\/?>)/gi, '<img class="img-fluid"$1$2');
  // Add loading="lazy" to img tags missing it
  fixed = fixed.replace(/<img(?![^>]*\bloading\b)([^>]*?)(\s*\/?>)/gi, '<img loading="lazy"$1$2');
  // Fix broken relative paths (images/foo.png → /web/image/website.s_cover_default_image)
  fixed = fixed.replace(/src="(?!https?:\/\/|\/web\/|\/)[^"]*\.(?:jpg|jpeg|png|gif|webp|svg)"/gi,
    'src="/web/image/website.s_cover_default_image"');
  return fixed;
}

/**
 * Strip raw <form> tags — Odoo 18 requires website.form widget for CSRF protection.
 * Raw forms bypass security and won't submit correctly in Odoo.
 * Replaces with a safe CTA button linking to /contactus.
 */
export function fixForms(html: string): string {
  return html.replace(/<form\b[\s\S]*?<\/form>/gi,
    '<div class="text-center py-3"><a href="/contactus" class="btn btn-primary btn-lg rounded-pill px-4">Contact Us</a></div>');
}

/**
 * Strip inline <script> and <style> tags — XSS vector, breaks Odoo asset pipeline.
 * JS belongs in web.assets_frontend bundle, CSS belongs in theme.scss.
 */
export function stripInlineTags(html: string): string {
  let fixed = html;
  fixed = fixed.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  fixed = fixed.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  return fixed;
}

/**
 * Escape bare & characters in HTML content so the XML is well-formed.
 * Preserves existing entities (&amp; &lt; &gt; &quot; &apos; &#NNN; &#xHHH;).
 */
export function escapeXmlEntities(html: string): string {
  return html.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/gi, '&amp;');
}

/**
 * Self-close XML void tags — required for strict XML parsing in Odoo's QWeb engine.
 * HTML allows <img>, <br>, <hr> etc. without closing, but XML requires <img />.
 */
export function selfCloseVoidTags(html: string): string {
  const voidTags = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
  const pattern = new RegExp(`<(${voidTags.join('|')})\\b([^>]*?)\\s*(?<!/)>`, 'gi');
  return html.replace(pattern, '<$1$2 />');
}

/**
 * Apply all content-level fixes to HTML
 */
function fixSectionContent(html: string): string {
  let fixed = html;
  // Security: strip dangerous tags first
  fixed = stripInlineTags(fixed);
  fixed = fixForms(fixed);
  // Content fixes
  fixed = fixTailwindClasses(fixed);
  fixed = fixPlaceholderUrls(fixed);
  fixed = fixImages(fixed);
  // XML well-formedness: escape bare & characters
  fixed = escapeXmlEntities(fixed);
  // XML compliance: self-close void tags (<img>, <br>, <hr>, etc.)
  fixed = selfCloseVoidTags(fixed);
  return fixed;
}

// =============================================================================
// THEME ICON (for Odoo Apps list)
// =============================================================================

/**
 * Default SVG icon for theme module — prevents broken image in Odoo Apps list.
 * Simple paint-palette design that works at any size.
 */
export const THEME_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="16" fill="#714B67"/>
  <circle cx="64" cy="58" r="30" fill="none" stroke="#fff" stroke-width="4"/>
  <circle cx="52" cy="48" r="5" fill="#E8C872"/>
  <circle cx="68" cy="42" r="5" fill="#E86B6B"/>
  <circle cx="78" cy="54" r="5" fill="#6BC8E8"/>
  <circle cx="72" cy="68" r="5" fill="#6BE878"/>
  <path d="M50 70 Q44 82 54 88 Q64 94 60 78Z" fill="#fff"/>
</svg>`;

// =============================================================================
// TEMPLATES.XML ASSEMBLY
// =============================================================================

/**
 * Assemble a correct Odoo 18 templates.xml from extracted sections
 *
 * Guarantees:
 * - inherit_id="website.homepage" on template
 * - xpath expr="//div[@id='wrap']" position="replace"
 * - o_cc color combination classes on every section
 * - data-snippet attributes for Website Builder compatibility
 * - oe_structure wrapper for drag-and-drop
 * - All tags properly closed
 */
export function assembleTemplatesXml(sections: ExtractedSection[]): string {
  if (sections.length === 0) {
    return "";
  }

  // Fix K: Apply content fixes once per section, then filter out empty shells.
  // Root cause: stripInlineTags + fixForms can reduce a section to empty markup.
  // We compute fixedContent once and reuse it for both filtering and rendering.
  const processedSections = sections.map(section => ({
    ...section,
    fixedContent: fixSectionContent(section.innerHtml),
  }));

  const nonEmptySections = processedSections.filter(section => {
    const textOnly = section.fixedContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    // Lower threshold: CTA sections, image galleries, and icon-heavy sections
    // may have minimal text (e.g. "Shop Now" = 8 chars) but are visually critical.
    // Also keep sections with images or background styles even if text is sparse.
    const hasImages = /<img\b/i.test(section.fixedContent);
    const hasBackgroundStyle = !!section.sectionStyle;
    if (hasImages || hasBackgroundStyle) return textOnly.length >= 5;
    return textOnly.length >= 15;
  });

  if (nonEmptySections.length === 0) {
    return "";
  }

  const sectionBlocks = nonEmptySections.map((section, i) => {
    const ccNum = (i % 5) + 1;
    const defaultPadding = section.snippetType === "s_cover" ? "pt96 pb96" :
      section.snippetType === "s_footer" ? "pt48 pb32" : "pt64 pb64";
    const fixedContent = section.fixedContent;

    // Ensure content has a container wrapper
    let wrappedContent = fixedContent;
    if (!/<div[^>]*class="[^"]*container[^"]*"/.test(fixedContent)) {
      wrappedContent = `<div class="container">\n${fixedContent}\n</div>`;
    }

    // Indent inner content properly (8 spaces for section children)
    const indentedContent = wrappedContent
      .split('\n')
      .map(line => line.trim() ? `          ${line}` : '')
      .filter(Boolean)
      .join('\n');

    // Preserve original padding classes from AI if present, otherwise use defaults
    const originalPtPb = section.sectionClass
      ? section.sectionClass.split(/\s+/).filter(c => /^p[tb]\d+$/.test(c))
      : [];
    const padding = originalPtPb.length > 0 ? originalPtPb.join(' ') : defaultPadding;

    // Build class list: ensure o_cc + o_ccN + padding, preserve original non-padding classes
    const requiredClasses = [`o_cc`, `o_cc${ccNum}`, padding];
    const originalClasses = section.sectionClass
      ? section.sectionClass.split(/\s+/).filter(c =>
          c && !c.startsWith('o_cc') &&
          !c.match(/^p[tb]\d+$/)
        )
      : [];
    const mergedClass = [...requiredClasses, ...originalClasses].join(' ');

    // Build data-snippet, preserving any additional data-* attrs from AI
    const dataAttrs = section.sectionDataAttrs || {};
    // Ensure data-snippet is always set to the detected type
    dataAttrs['data-snippet'] = section.snippetType;
    const dataAttrStr = Object.entries(dataAttrs)
      .map(([key, val]) => `${key}="${val}"`)
      .join(' ');

    // Preserve inline style from original section (background images, colors, min-height)
    const styleAttr = section.sectionStyle ? ` style="${section.sectionStyle}"` : '';

    return `        <section class="${mergedClass}" ${dataAttrStr}${styleAttr}>
${indentedContent}
        </section>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage_content" name="Homepage" inherit_id="website.homepage" customize_show="True">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
${sectionBlocks}
      </div>
    </xpath>
  </template>
</odoo>`;
}

/**
 * Quick XML well-formedness check: verify all non-void tags are balanced.
 * Returns true if well-formed, false if mismatched tags detected.
 */
export function isXmlWellFormed(xml: string): boolean {
  const voidTags = new Set(["br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "param", "source", "track", "wbr"]);
  const stack: string[] = [];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/?>/g;
  let match;

  while ((match = tagRegex.exec(xml)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();

    // Skip self-closing, comments, processing instructions
    if (full.endsWith("/>") || full.startsWith("<!") || full.startsWith("<?")) continue;
    if (voidTags.has(tag)) continue;

    if (full.startsWith("</")) {
      if (stack.length === 0 || stack[stack.length - 1] !== tag) return false;
      stack.pop();
    } else {
      stack.push(tag);
    }
  }

  return stack.length === 0;
}

// =============================================================================
// PRIMARY_VARIABLES.SCSS ASSEMBLY
// =============================================================================

interface OdooColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  light: string;
  dark: string;
}

interface OdooFonts {
  heading: string;
  headingFallback: string;
  body: string;
  bodyFallback: string;
}

/**
 * Industry default color palettes (Odoo o-color format)
 */
const INDUSTRY_COLORS: Record<string, OdooColorPalette> = {
  restaurant:   { primary: "#c9302c", secondary: "#8b4513", accent: "#d4a373", light: "#fefae0", dark: "#2d2d2d" },
  technology:   { primary: "#2563eb", secondary: "#7c3aed", accent: "#06b6d4", light: "#f8fafc", dark: "#0f172a" },
  legal:        { primary: "#1e3a5f", secondary: "#c9a227", accent: "#2d4a6f", light: "#f7f7f7", dark: "#1a1a1a" },
  healthcare:   { primary: "#0d9488", secondary: "#0284c7", accent: "#14b8a6", light: "#f0fdfa", dark: "#134e4a" },
  ecommerce:    { primary: "#7c3aed", secondary: "#ec4899", accent: "#f59e0b", light: "#faf5ff", dark: "#1e1b4b" },
  education:    { primary: "#4f46e5", secondary: "#0891b2", accent: "#f97316", light: "#f5f5ff", dark: "#1e1b4b" },
  realestate:   { primary: "#0f766e", secondary: "#b45309", accent: "#14b8a6", light: "#f7f9f9", dark: "#134e4a" },
  fitness:      { primary: "#dc2626", secondary: "#1f2937", accent: "#f59e0b", light: "#fafafa", dark: "#111827" },
  creative:     { primary: "#be185d", secondary: "#7c3aed", accent: "#06b6d4", light: "#fdf4ff", dark: "#1f2937" },
  nonprofit:    { primary: "#0891b2", secondary: "#059669", accent: "#f97316", light: "#ecfeff", dark: "#164e63" },
  beauty:       { primary: "#be185d", secondary: "#a21caf", accent: "#e879a4", light: "#fdf2f8", dark: "#1f2937" },
  automotive:   { primary: "#1e3a8a", secondary: "#dc2626", accent: "#f59e0b", light: "#f8fafc", dark: "#0f172a" },
  finance:      { primary: "#0c4a6e", secondary: "#115e59", accent: "#0284c7", light: "#f0f9ff", dark: "#0c4a6e" },
  construction: { primary: "#d97706", secondary: "#374151", accent: "#f59e0b", light: "#fafaf9", dark: "#1c1917" },
  travel:       { primary: "#0369a1", secondary: "#059669", accent: "#f97316", light: "#f0f9ff", dark: "#0c4a6e" },
  photography:  { primary: "#18181b", secondary: "#a1a1aa", accent: "#e4e4e7", light: "#fafafa", dark: "#18181b" },
  generic:      { primary: "#2563eb", secondary: "#64748b", accent: "#10b981", light: "#f8fafc", dark: "#1e293b" },
};

const INDUSTRY_FONTS: Record<string, OdooFonts> = {
  restaurant:   { heading: "Playfair Display", headingFallback: "serif", body: "Lato", bodyFallback: "sans-serif" },
  technology:   { heading: "Inter", headingFallback: "sans-serif", body: "Inter", bodyFallback: "sans-serif" },
  legal:        { heading: "Merriweather", headingFallback: "serif", body: "Source Sans Pro", bodyFallback: "sans-serif" },
  healthcare:   { heading: "Nunito", headingFallback: "sans-serif", body: "Open Sans", bodyFallback: "sans-serif" },
  ecommerce:    { heading: "Poppins", headingFallback: "sans-serif", body: "Poppins", bodyFallback: "sans-serif" },
  education:    { heading: "Nunito", headingFallback: "sans-serif", body: "Nunito", bodyFallback: "sans-serif" },
  realestate:   { heading: "Cormorant Garamond", headingFallback: "serif", body: "Montserrat", bodyFallback: "sans-serif" },
  fitness:      { heading: "Oswald", headingFallback: "sans-serif", body: "Roboto", bodyFallback: "sans-serif" },
  creative:     { heading: "Space Grotesk", headingFallback: "sans-serif", body: "DM Sans", bodyFallback: "sans-serif" },
  nonprofit:    { heading: "Nunito", headingFallback: "sans-serif", body: "Open Sans", bodyFallback: "sans-serif" },
  beauty:       { heading: "Cormorant Garamond", headingFallback: "serif", body: "Lato", bodyFallback: "sans-serif" },
  automotive:   { heading: "Rajdhani", headingFallback: "sans-serif", body: "Roboto", bodyFallback: "sans-serif" },
  finance:      { heading: "IBM Plex Sans", headingFallback: "sans-serif", body: "IBM Plex Sans", bodyFallback: "sans-serif" },
  construction: { heading: "Oswald", headingFallback: "sans-serif", body: "Open Sans", bodyFallback: "sans-serif" },
  travel:       { heading: "Montserrat", headingFallback: "sans-serif", body: "Open Sans", bodyFallback: "sans-serif" },
  photography:  { heading: "Libre Baskerville", headingFallback: "serif", body: "Karla", bodyFallback: "sans-serif" },
  generic:      { heading: "Inter", headingFallback: "sans-serif", body: "Inter", bodyFallback: "sans-serif" },
};

const DEFAULT_COLORS: OdooColorPalette = { primary: "#0d6efd", secondary: "#6c757d", accent: "#198754", light: "#f8f9fa", dark: "#212529" };
const DEFAULT_FONTS: OdooFonts = { heading: "Poppins", headingFallback: "sans-serif", body: "Open Sans", bodyFallback: "sans-serif" };

/**
 * Validate a CSS hex color string (#RGB or #RRGGBB)
 */
function isValidHex(color: string | null): color is string {
  return color !== null && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
}

/**
 * Extract color values from AI-generated SCSS (if it has $o-color-palettes)
 */
function extractColorsFromScss(scss: string): OdooColorPalette | null {
  const colorMatch = scss.match(/o-color-palettes[\s\S]*?\(/);
  if (!colorMatch) return null;

  const extract = (key: string): string | null => {
    const regex = new RegExp(`['"]${key}['"]\\s*:\\s*(#[0-9a-fA-F]{3,8})`, 'i');
    const m = scss.match(regex);
    return m ? m[1] : null;
  };

  const primary = extract("o-color-1");
  if (!isValidHex(primary)) return null; // Need at least a valid primary color

  const secondary = extract("o-color-2");
  const accent = extract("o-color-3");
  const light = extract("o-color-4");
  const dark = extract("o-color-5");

  return {
    primary,
    secondary: isValidHex(secondary) ? secondary : DEFAULT_COLORS.secondary,
    accent: isValidHex(accent) ? accent : DEFAULT_COLORS.accent,
    light: isValidHex(light) ? light : DEFAULT_COLORS.light,
    dark: isValidHex(dark) ? dark : DEFAULT_COLORS.dark,
  };
}

/**
 * Sanitize a font name for safe SCSS injection.
 * Only allows alphanumeric, spaces, hyphens, periods, and commas.
 */
function sanitizeFontName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 \-.,]/g, '').trim();
}

/**
 * Detect if a font name is a serif font.
 * Checks both the name (contains "serif") and a list of known serif families.
 */
function isSerifFont(fontName: string): boolean {
  const lower = fontName.toLowerCase();
  if (lower.includes("serif")) return true;
  const knownSerif = [
    "playfair display", "eb garamond", "merriweather", "cormorant garamond",
    "libre baskerville", "lora", "crimson text", "georgia", "times",
    "bodoni", "didot", "garamond", "palatino",
  ];
  return knownSerif.some(s => lower.includes(s));
}

/**
 * Extract font names from AI-generated SCSS
 */
function extractFontsFromScss(scss: string): OdooFonts | null {
  const headingMatch = scss.match(/['"]headings-font['"]\s*:\s*['"]([^'"]+)['"]/);
  const bodyMatch = scss.match(/['"]font['"]\s*:\s*['"]([^'"]+)['"]/);
  if (!headingMatch && !bodyMatch) return null;

  const heading = sanitizeFontName(headingMatch?.[1] || DEFAULT_FONTS.heading);
  const body = sanitizeFontName(bodyMatch?.[1] || DEFAULT_FONTS.body);

  return {
    heading: heading || DEFAULT_FONTS.heading,
    headingFallback: isSerifFont(heading) ? "serif" : "sans-serif",
    body: body || DEFAULT_FONTS.body,
    bodyFallback: isSerifFont(body) ? "serif" : "sans-serif",
  };
}

/**
 * Assemble a correct primary_variables.scss
 *
 * Guarantees:
 * - Correct $o-color-palettes map-merge syntax
 * - 5 colors: o-color-1 through o-color-5
 * - $o-selected-color-palettes-names registration
 * - $o-website-values-palettes with font configuration
 * - $o-theme-font-configs with Google Font URLs
 */
export function assemblePrimaryVariablesScss(
  existingScss: string | null,
  industry?: string
): string {
  // Try to extract colors/fonts from AI-generated SCSS first
  const aiColors = existingScss ? extractColorsFromScss(existingScss) : null;
  const aiFonts = existingScss ? extractFontsFromScss(existingScss) : null;

  // Priority: AI-extracted > industry defaults > generic defaults
  const industryKey = industry?.toLowerCase() || "";
  const colors = aiColors || INDUSTRY_COLORS[industryKey] || DEFAULT_COLORS;
  const fonts = aiFonts || INDUSTRY_FONTS[industryKey] || DEFAULT_FONTS;

  // Generate Google Font URL (replace spaces with +)
  const headingUrl = fonts.heading.replace(/\s+/g, '+');
  const bodyUrl = fonts.body.replace(/\s+/g, '+');

  return `// Odoo 18 color palette — integrates with Website Builder color picker
$o-color-palettes: map-merge($o-color-palettes,
  (
    'theme-custom': (
      'o-color-1': ${colors.primary},
      'o-color-2': ${colors.secondary},
      'o-color-3': ${colors.accent},
      'o-color-4': ${colors.light},
      'o-color-5': ${colors.dark},
    ),
  )
);
$o-selected-color-palettes-names: append($o-selected-color-palettes-names, 'theme-custom');
$o-theme-color-palette-number: 'theme-custom' !default;

$o-website-values-palettes: (
  (
    'color-palettes-name': 'theme-custom',
    'font': '${fonts.body}',
    'headings-font': '${fonts.heading}',
    'header-font-size': 1rem,
    'btn-border-radius': 10rem,
  ),
);

$o-theme-font-configs: (
  '${fonts.heading}': (
    'family': ('${fonts.heading}', ${fonts.headingFallback}),
    'url': '${headingUrl}:400,700',
  ),
  '${fonts.body}': (
    'family': ('${fonts.body}', ${fonts.bodyFallback}),
    'url': '${bodyUrl}:300,400,700',
  ),
);
`;
}

// =============================================================================
// BOOTSTRAP OVERRIDDEN SCSS
// =============================================================================

/**
 * Assemble bootstrap_overridden.scss (mostly static)
 * Extracts Bootstrap variable overrides from AI SCSS if present
 */
export function assembleBootstrapOverriddenScss(existingScss: string | null): string {
  // Extract any Bootstrap variable overrides from AI-generated SCSS
  const overrides: string[] = [];
  if (existingScss) {
    const varRegex = /^\$(?!o-)[\w-]+:\s*[^;]+\s*!default\s*;/gm;
    let match;
    while ((match = varRegex.exec(existingScss)) !== null) {
      overrides.push(match[0]);
    }
  }

  if (overrides.length > 0) {
    return `// Bootstrap variable overrides — ONLY variables, no custom rules
${overrides.join('\n')}
`;
  }

  // Default Bootstrap overrides for a modern look
  return `// Bootstrap variable overrides — ONLY variables, no custom rules
$border-radius: 0.5rem !default;
$border-radius-lg: 0.75rem !default;
$card-border-width: 0 !default;
$box-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08) !default;
$box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1) !default;
`;
}

// =============================================================================
// THEME.SCSS ASSEMBLY
// =============================================================================

/**
 * Assemble theme.scss — keeps AI-generated custom styles but fixes blue shadows
 */
export function assembleThemeScss(existingScss: string | null): string {
  if (existingScss && existingScss.trim().length > 20) {
    let fixed = existingScss;

    // Fix blue shadows: rgba(0, 128, 255, ...) → rgba(0, 0, 0, ...)
    fixed = fixed.replace(
      /box-shadow:\s*([^;]*?)rgba\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)([^;]*);/gi,
      (match, before, r, g, b, alpha, after) => {
        const red = parseInt(r);
        const green = parseInt(g);
        const blue = parseInt(b);
        if (red < 80 && green > 60 && green < 200 && blue > 180) {
          const neutralAlpha = Math.min(parseFloat(alpha), 0.2).toFixed(2);
          return `box-shadow:${before}rgba(0, 0, 0, ${neutralAlpha})${after};`;
        }
        return match;
      }
    );

    // Remove any $o-color-palettes that accidentally ended up in theme.scss
    fixed = fixed.replace(/\$o-color-palettes[\s\S]*?;/g, '');
    fixed = fixed.replace(/\$o-selected-color-palettes-names[\s\S]*?;/g, '');
    fixed = fixed.replace(/\$o-website-values-palettes[\s\S]*?;/g, '');
    fixed = fixed.replace(/\$o-theme-font-configs[\s\S]*?;/g, '');

    // Strip dangerous global overrides that break Odoo
    fixed = fixed.replace(/^body\s*\{[^}]*\}/gm, '');
    fixed = fixed.replace(/^html\s*\{[^}]*\}/gm, '');
    fixed = fixed.replace(/^\*\s*\{[^}]*\}/gm, ''); // Universal reset (*, *::before, etc.)
    fixed = fixed.replace(/^\.container\s*\{[^}]*\}/gm, '');
    fixed = fixed.replace(/^\.container-fluid\s*\{[^}]*\}/gm, '');
    // Keep background-image — section inline styles are now preserved (RC#1),
    // and CSS background-image is valid for snippet-level styling in theme.scss
    // Strip :root custom properties (Odoo doesn't use them)
    fixed = fixed.replace(/^:root\s*\{[^}]*\}/gm, '');
    // Strip font-family declarations (fonts come from primary_variables.scss)
    fixed = fixed.replace(/\s*font-family\s*:[^;]+;/gi, '');

    // Fix M: Keep hex colors in AI-generated theme.scss
    // Rationale: stripping ALL hex colors emptied theme.scss to nothing,
    // causing every theme to fall back to the same 5-line generic default.
    // The AI generates intentional color choices that add visual identity.
    // Odoo's o-color() function is only available in SCSS compilation, not
    // in the generated CSS output. Keeping hex values preserves the theme look.
    // Blue shadow fix above already handles the main color problem.

    // Strip empty rulesets left behind after stripping (e.g. `.card { }`)
    fixed = fixed.replace(/[^{};\n]+\s*\{\s*\}/g, '');

    // Clean up excessive blank lines
    fixed = fixed.replace(/\n{3,}/g, '\n\n');

    // If stripping left only whitespace/comments, fall through to default
    const meaningful = fixed.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (meaningful.length > 20) {
      return fixed.trim() + '\n';
    }
  }

  // Default theme.scss — production-grade fallback with visual polish
  return `// Custom theme styles — production-grade defaults

// Hero section
section[data-snippet="s_cover"] {
  min-height: 75vh;
  display: flex;
  align-items: center;
  background-size: cover;
  background-position: center;
}

// Cards with layered shadows and smooth hover
.card {
  border: none;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
}

// Section spacing rhythm
section {
  position: relative;
}

// Badge / pill labels
.badge.rounded-pill {
  font-weight: 600;
  letter-spacing: 0.025em;
}

// Smooth button transitions
.btn {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary:hover,
.btn-lg:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

// Rounded pill buttons for CTAs
.rounded-pill {
  border-radius: 50rem;
}

// Image styling
img.rounded-3 {
  border-radius: 0.75rem;
}

// Font Awesome icon circles
.bg-opacity-10.rounded-circle {
  width: 64px;
  height: 64px;
}

// Star ratings
.text-warning {
  font-size: 1.1rem;
  letter-spacing: 0.1em;
}

// Testimonial avatar circles
.rounded-circle[style*="width:48px"] {
  font-size: 0.875rem;
}

// Footer
section[data-snippet="s_footer"] a {
  transition: color 0.2s ease;
  &:hover {
    opacity: 0.8;
  }
}
`;
}

// =============================================================================
// MAIN ASSEMBLER — Assembles complete theme from parsed AI output
// =============================================================================

/**
 * Assemble a complete, correct Odoo 18 theme from parsed AI files.
 *
 * This is the root cause fix: instead of patching broken AI output,
 * we extract content and rebuild from correct templates.
 *
 * @param parsedFiles - Files extracted by the parser (may have structural issues)
 * @param themeName - Theme name (from AI or user)
 * @param industry - Industry for color/font defaults
 * @returns Array of correctly structured Odoo 18 theme files
 */
export function assembleThemeFiles(
  parsedFiles: ParsedFile[],
  themeName: string = "Theme Generated",
  industry?: string
): ParsedFile[] {
  const result: ParsedFile[] = [];

  // === Step 1: Extract sections from ALL XML/HTML files ===
  const xmlFiles = parsedFiles.filter(f =>
    f.path.endsWith('.xml') || f.language === 'xml' || f.language === 'html'
  );

  let allSections: ExtractedSection[] = [];
  for (const xmlFile of xmlFiles) {
    const sections = extractSections(xmlFile.content);
    allSections.push(...sections);
  }

  // Dedupe sections: prefer first of each snippet type, max 8 total
  const uniqueSections: ExtractedSection[] = [];
  const seenSnippetTypes = new Map<string, number>();
  const MAX_SECTIONS = 10;
  const MAX_PER_TYPE = 3; // s_three_columns maps to features, services, testimonials, pricing, team

  for (const section of allSections) {
    if (uniqueSections.length >= MAX_SECTIONS) break;

    // Content similarity check FIRST — duplicates should not consume a type slot.
    // Root cause: when AI generates "Products" and "Products Menu" with identical cards,
    // the duplicate was consuming a s_three_columns slot before being caught, which then
    // prevented unique sections like "Testimonials" from fitting within MAX_PER_TYPE.
    const contentKey = section.innerHtml.replace(/\s+/g, ' ').trim().substring(0, 150);
    const isDuplicate = uniqueSections.some(existing => {
      const existingKey = existing.innerHtml.replace(/\s+/g, ' ').trim().substring(0, 150);
      return existingKey === contentKey;
    });
    if (isDuplicate) continue;

    const typeCount = seenSnippetTypes.get(section.snippetType) || 0;
    if (typeCount >= MAX_PER_TYPE) continue;

    seenSnippetTypes.set(section.snippetType, typeCount + 1);
    uniqueSections.push(section);
  }

  // Assemble templates.xml (only if we have sections)
  if (uniqueSections.length > 0) {
    const templatesXml = assembleTemplatesXml(uniqueSections);
    if (templatesXml && isXmlWellFormed(templatesXml)) {
      result.push({
        path: "theme_generated/views/templates.xml",
        content: templatesXml,
        language: "xml",
        action: "create",
      });
    } else if (templatesXml) {
      // XML assembled but failed well-formedness — log and let fallback handle it
      console.warn("[Assembler] Assembled XML failed well-formedness check, falling back");
    }
  } else if (xmlFiles.length > 0) {
    // Fallback: keep the first XML file with minimal fixes
    const firstXml = xmlFiles[0];
    let content = firstXml.content;
    // Ensure it has odoo wrapper
    if (!content.includes('<odoo>')) {
      content = `<?xml version="1.0" encoding="utf-8"?>\n<odoo>\n${content}\n</odoo>`;
    }
    result.push({
      path: "theme_generated/views/templates.xml",
      content,
      language: "xml",
      action: "create",
    });
  }

  // Fallback: if no templates.xml was produced, generate a minimal valid homepage
  if (!result.some(f => f.path.endsWith('templates.xml'))) {
    result.push({
      path: "theme_generated/views/templates.xml",
      content: `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage_content" name="Homepage" inherit_id="website.homepage" customize_show="True">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
        <section class="o_cc o_cc1 pt96 pb96" data-snippet="s_cover">
          <div class="container text-center">
            <h1 class="display-3 fw-bold">Welcome</h1>
            <p class="lead">Your new website is ready to customize.</p>
            <a href="/contactus" class="btn btn-primary btn-lg rounded-pill mt-3">Get Started</a>
          </div>
        </section>
      </div>
    </xpath>
  </template>
</odoo>`,
      language: "xml",
      action: "create",
    });
  }

  // === Step 2: Assemble SCSS files ===
  const scssFiles = parsedFiles.filter(f =>
    f.path.endsWith('.scss') || f.path.endsWith('.css') || f.language === 'scss' || f.language === 'css'
  );

  // Find existing primary_variables content (AI may have generated correct format)
  // Use exact basename matching to avoid misrouting e.g. my_primary_variables_helper.scss
  const primaryVarsFile = scssFiles.find(f => getBasename(f.path) === 'primary_variables.scss');
  // Find any SCSS that has $o-color-palettes (might be in wrong file)
  const scssWithOdooVars = scssFiles.find(f => f.content.includes('$o-color-palettes'));
  // Find other SCSS (theme styles)
  const themeScssFile = scssFiles.find(f =>
    getBasename(f.path) !== 'primary_variables.scss' &&
    getBasename(f.path) !== 'bootstrap_overridden.scss' &&
    !f.content.includes('$o-color-palettes')
  );
  const bootstrapFile = scssFiles.find(f => getBasename(f.path) === 'bootstrap_overridden.scss');

  // Assemble primary_variables.scss — always from template
  const primaryVarsSource = primaryVarsFile?.content || scssWithOdooVars?.content || null;
  result.push({
    path: "theme_generated/static/src/scss/primary_variables.scss",
    content: assemblePrimaryVariablesScss(primaryVarsSource, industry),
    language: "scss",
    action: "create",
  });

  // Assemble bootstrap_overridden.scss
  result.push({
    path: "theme_generated/static/src/scss/bootstrap_overridden.scss",
    content: assembleBootstrapOverriddenScss(bootstrapFile?.content || null),
    language: "scss",
    action: "create",
  });

  // Assemble theme.scss — keep AI styles but fix issues
  result.push({
    path: "theme_generated/static/src/scss/theme.scss",
    content: assembleThemeScss(themeScssFile?.content || null),
    language: "scss",
    action: "create",
  });

  // === Step 3: Keep other files (JS, etc.) ===
  const otherFiles = parsedFiles.filter(f =>
    !f.path.endsWith('.xml') && !f.path.endsWith('.scss') && !f.path.endsWith('.css') &&
    !f.path.includes('__manifest__') && !f.path.includes('__init__') &&
    f.language !== 'xml' && f.language !== 'html'
  );
  // Skip JS/TS files — Odoo 18 website themes use SCSS for styling and
  // XML QWeb templates for structure. AI-generated JS often contains
  // unsafe patterns (innerHTML, eval) that fail security scans and are
  // unnecessary for theme functionality.
  // If JS is truly needed, it should go through the asset bundle system
  // and be registered in __manifest__.py, not generated ad-hoc.

  // === Step 4: Add module icon (prevents broken image in Odoo Apps list) ===
  result.push({
    path: "theme_generated/static/description/icon.svg",
    content: THEME_ICON_SVG,
    language: "xml",
    action: "create",
  });

  return result;
}

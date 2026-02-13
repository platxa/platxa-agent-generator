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
import { convertTailwindToBootstrap } from "./tailwind-bootstrap-map";

// =============================================================================
// SECTION EXTRACTION
// =============================================================================

interface ExtractedSection {
  snippetType: string;    // Odoo snippet type: s_cover, s_three_columns, etc.
  innerHtml: string;      // Content inside the section (container div, etc.)
  isFooter: boolean;      // Footer sections get special treatment
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
 * Extract sections from AI-generated content (XML, HTML, or mixed)
 *
 * Handles all formats:
 * 1. Full Odoo XML: <odoo><template><xpath><div id="wrap"><section>...
 * 2. Partial XML: <template><section>...
 * 3. Raw sections: <section>...<section>...
 * 4. Footer/header blocks: <footer>..., <header>...
 * 5. Plain div content: <div class="container">...
 */
export function extractSections(content: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const seenContent = new Set<string>();

  // Phase 1: Extract <section> blocks
  const sectionRegex = /<section\b[^>]*>([\s\S]*?)<\/section>/gi;
  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    const innerHtml = match[1].trim();
    if (!innerHtml || innerHtml.length < 20) continue;

    const contentKey = innerHtml.substring(0, 80);
    if (seenContent.has(contentKey)) continue;
    seenContent.add(contentKey);

    const snippetType = detectSnippetType(match[0]);
    sections.push({
      snippetType,
      innerHtml,
      isFooter: snippetType === SNIPPET_TYPES.footer,
    });
  }

  // Phase 2: Extract <footer> blocks (if not already found as sections)
  const footerRegex = /<footer\b[^>]*>([\s\S]*?)<\/footer>/gi;
  while ((match = footerRegex.exec(content)) !== null) {
    const innerHtml = match[1].trim();
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
    const headerRegex = /<(?:header|nav)\b[^>]*>([\s\S]*?)<\/(?:header|nav)>/gi;
    while ((match = headerRegex.exec(content)) !== null) {
      const innerHtml = match[1].trim();
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

  // Phase 4: If no sections found, try to extract standalone <div class="container"> blocks
  if (sections.length === 0) {
    const containerRegex = /<div\b[^>]*class="[^"]*container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let idx = 0;
    while ((match = containerRegex.exec(content)) !== null) {
      const innerHtml = match[0].trim(); // Keep the whole container div
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
 * Apply all content-level fixes to HTML
 */
function fixSectionContent(html: string): string {
  let fixed = html;
  fixed = fixTailwindClasses(fixed);
  fixed = fixPlaceholderUrls(fixed);
  return fixed;
}

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

  const sectionBlocks = sections.map((section, i) => {
    const ccNum = (i % 5) + 1;
    const padding = section.snippetType === "s_cover" ? "pt96 pb96" : "pt48 pb48";
    const fixedContent = fixSectionContent(section.innerHtml);

    // Indent inner content properly (8 spaces for section children)
    const indentedContent = fixedContent
      .split('\n')
      .map(line => line.trim() ? `          ${line}` : '')
      .filter(Boolean)
      .join('\n');

    return `        <section class="o_cc o_cc${ccNum} ${padding}" data-snippet="${section.snippetType}">
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
  restaurant: { primary: "#c9302c", secondary: "#8b4513", accent: "#d4a373", light: "#fefae0", dark: "#2d2d2d" },
  technology: { primary: "#2563eb", secondary: "#7c3aed", accent: "#06b6d4", light: "#f8fafc", dark: "#0f172a" },
  legal:      { primary: "#1a365d", secondary: "#c9a227", accent: "#4a5568", light: "#f7f7f7", dark: "#1a202c" },
  healthcare: { primary: "#0d9488", secondary: "#0284c7", accent: "#06b6d4", light: "#f0fdfa", dark: "#134e4a" },
  ecommerce:  { primary: "#7c3aed", secondary: "#ec4899", accent: "#f59e0b", light: "#faf5ff", dark: "#1e1b4b" },
};

const INDUSTRY_FONTS: Record<string, OdooFonts> = {
  restaurant: { heading: "Playfair Display", headingFallback: "serif", body: "Lato", bodyFallback: "sans-serif" },
  technology: { heading: "Inter", headingFallback: "sans-serif", body: "Inter", bodyFallback: "sans-serif" },
  legal:      { heading: "EB Garamond", headingFallback: "serif", body: "Source Sans Pro", bodyFallback: "sans-serif" },
  healthcare: { heading: "Poppins", headingFallback: "sans-serif", body: "Open Sans", bodyFallback: "sans-serif" },
  ecommerce:  { heading: "Poppins", headingFallback: "sans-serif", body: "Inter", bodyFallback: "sans-serif" },
};

const DEFAULT_COLORS: OdooColorPalette = { primary: "#0d6efd", secondary: "#6c757d", accent: "#198754", light: "#f8f9fa", dark: "#212529" };
const DEFAULT_FONTS: OdooFonts = { heading: "Poppins", headingFallback: "sans-serif", body: "Open Sans", bodyFallback: "sans-serif" };

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
  const secondary = extract("o-color-2");
  if (!primary) return null; // Need at least primary color

  return {
    primary,
    secondary: secondary || DEFAULT_COLORS.secondary,
    accent: extract("o-color-3") || DEFAULT_COLORS.accent,
    light: extract("o-color-4") || DEFAULT_COLORS.light,
    dark: extract("o-color-5") || DEFAULT_COLORS.dark,
  };
}

/**
 * Extract font names from AI-generated SCSS
 */
function extractFontsFromScss(scss: string): OdooFonts | null {
  const headingMatch = scss.match(/['"]headings-font['"]\s*:\s*['"]([^'"]+)['"]/);
  const bodyMatch = scss.match(/['"]font['"]\s*:\s*['"]([^'"]+)['"]/);
  if (!headingMatch && !bodyMatch) return null;

  return {
    heading: headingMatch?.[1] || DEFAULT_FONTS.heading,
    headingFallback: headingMatch?.[1]?.toLowerCase().includes("serif") ? "serif" : "sans-serif",
    body: bodyMatch?.[1] || DEFAULT_FONTS.body,
    bodyFallback: "sans-serif",
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

    return fixed.trim() + '\n';
  }

  // Default theme.scss
  return `// Custom theme styles
section[data-snippet="s_cover"] {
  min-height: 75vh;
  display: flex;
  align-items: center;
}
.card {
  border-radius: 0.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
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

  // Dedupe sections by content similarity
  const uniqueSections: ExtractedSection[] = [];
  const seenKeys = new Set<string>();
  for (const section of allSections) {
    const key = section.innerHtml.replace(/\s+/g, ' ').substring(0, 100);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueSections.push(section);
    }
  }

  // Assemble templates.xml (only if we have sections)
  if (uniqueSections.length > 0) {
    const templatesXml = assembleTemplatesXml(uniqueSections);
    result.push({
      path: "theme_generated/views/templates.xml",
      content: templatesXml,
      language: "xml",
      action: "create",
    });
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

  // === Step 2: Assemble SCSS files ===
  const scssFiles = parsedFiles.filter(f =>
    f.path.endsWith('.scss') || f.path.endsWith('.css') || f.language === 'scss' || f.language === 'css'
  );

  // Find existing primary_variables content (AI may have generated correct format)
  const primaryVarsFile = scssFiles.find(f => f.path.includes('primary_variables'));
  // Find any SCSS that has $o-color-palettes (might be in wrong file)
  const scssWithOdooVars = scssFiles.find(f => f.content.includes('$o-color-palettes'));
  // Find other SCSS (theme styles)
  const themeScssFile = scssFiles.find(f =>
    !f.path.includes('primary_variables') &&
    !f.path.includes('bootstrap_overridden') &&
    !f.content.includes('$o-color-palettes')
  );
  const bootstrapFile = scssFiles.find(f => f.path.includes('bootstrap_overridden'));

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
  for (const file of otherFiles) {
    if (file.path.endsWith('.js')) {
      result.push(file);
    }
  }

  return result;
}

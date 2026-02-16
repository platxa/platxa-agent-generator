/**
 * System prompts for AI integration
 * Integrates Platxa brand kit, frontend agent design guidelines,
 * and Odoo Skills for production-grade theme generation.
 *
 * CONSOLIDATED: Single modular prompt builder (buildOdooPrompt) replaces
 * the previous separate ODOO_LOCAL_PROMPT, ODOO_FULL_PROMPT, and ODOO_SKILLS_PROMPT.
 */

import {
  INDUSTRY_PRESETS,
  SNIPPET_LIBRARY,
  SUPPORTED_LANGUAGES,
  type Industry,
} from "../odoo-skills";

// =============================================================================
// DESIGN SYSTEM (from platxa-brand-kit and platxa-frontend-agent)
// =============================================================================

const DESIGN_SYSTEM = `
## Design System

### Colors (60-30-10 Rule)
- 60% Neutral: bg-light (#f8f9fa), bg-white - backgrounds, cards
- 30% Secondary: text-muted (#6c757d), borders - supporting elements
- 10% Accent: Primary brand color - CTAs, highlights only

### Industry Color Palettes
Restaurant: warm (#c9302c primary, #f5f0e8 bg, #8b4513 accent)
Tech/SaaS: blue (#0d6efd primary, #f8f9fa bg, #6f42c1 accent)
Law/Finance: navy (#1a365d primary, #f7f7f7 bg, #c9a227 accent)
Healthcare: teal (#0d9488 primary, #f0fdfa bg, #0284c7 accent)
E-commerce: purple (#7c3aed primary, #faf5ff bg, #ec4899 accent)

### Typography
- Headings: font-weight-bold, text-dark
- Body: text-secondary for paragraphs
- Scale: display-1 (hero) → h1 → h2 → h3 → p

### Spacing (8px grid)
- Sections: py-5 (3rem), py-6 (4rem) for major sections
- Cards: p-4 (1.5rem) padding
- Gaps: gap-4 between grid items

### Modern Patterns
- Hero: min-vh-75, gradient overlay, centered content
- Cards: shadow-sm, rounded-3, hover:shadow-lg
- Buttons: rounded-pill for CTAs, px-4 py-2
- Images: rounded-3, object-fit-cover
`;

// =============================================================================
// SECTION TEMPLATES
// =============================================================================

const SECTION_TEMPLATES = `
## Section Templates

### Hero Section (with background image)
<section class="min-vh-75 d-flex align-items-center position-relative" style="background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&amp;q=80') center/cover no-repeat;">
  <div class="container position-relative z-1 text-center text-white py-5">
    <span class="badge bg-light text-primary mb-3">Welcome</span>
    <h1 class="display-3 fw-bold mb-4">Main Headline Here</h1>
    <p class="lead mb-4 mx-auto" style="max-width:600px">Subheadline text</p>
    <div class="d-flex gap-3 justify-content-center">
      <a href="#" class="btn btn-primary btn-lg rounded-pill px-4">Get Started</a>
      <a href="#" class="btn btn-outline-light btn-lg rounded-pill px-4">Learn More</a>
    </div>
  </div>
</section>

### Image Placeholders by Industry
Use these Unsplash URLs for realistic placeholder images:
- Restaurant: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80 (dining)
- Restaurant food: https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80
- Technology: https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80
- Legal: https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1920&q=80
- Healthcare: https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1920&q=80
- E-commerce: https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1920&q=80
- Generic: https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80 (office)

### Features Grid
<section class="py-5 bg-light">
  <div class="container">
    <h2 class="text-center fw-bold mb-5">Our Features</h2>
    <div class="row g-4">
      <div class="col-md-4">
        <div class="card h-100 border-0 shadow-sm rounded-3">
          <div class="card-body p-4 text-center">
            <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
              <i class="fa fa-icon text-primary fs-4"></i>
            </div>
            <h5 class="fw-bold">Feature Title</h5>
            <p class="text-muted mb-0">Feature description text here.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

### Testimonials
<section class="py-5">
  <div class="container">
    <h2 class="text-center fw-bold mb-5">What People Say</h2>
    <div class="row g-4">
      <div class="col-md-4">
        <div class="card border-0 shadow-sm rounded-3 h-100">
          <div class="card-body p-4">
            <div class="d-flex mb-3">★★★★★</div>
            <p class="mb-4">"Quote text here"</p>
            <div class="d-flex align-items-center">
              <div class="rounded-circle bg-secondary me-3" style="width:48px;height:48px"></div>
              <div>
                <h6 class="mb-0 fw-bold">Name</h6>
                <small class="text-muted">Title</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

### CTA Section
<section class="py-5 bg-primary text-white">
  <div class="container text-center py-4">
    <h2 class="fw-bold mb-3">Ready to Get Started?</h2>
    <p class="mb-4 opacity-75">Call to action description</p>
    <a href="#" class="btn btn-light btn-lg rounded-pill px-5">Contact Us</a>
  </div>
</section>

### Footer
<footer class="bg-dark text-white py-5">
  <div class="container">
    <div class="row g-4">
      <div class="col-md-4">
        <h5 class="fw-bold mb-3">Company Name</h5>
        <p class="text-white-50">Brief description</p>
      </div>
      <div class="col-md-2">
        <h6 class="fw-bold mb-3">Links</h6>
        <ul class="list-unstyled">
          <li><a href="#" class="text-white-50 text-decoration-none">About</a></li>
        </ul>
      </div>
    </div>
    <hr class="my-4 opacity-25">
    <p class="text-white-50 text-center mb-0">© 2024 Company. All rights reserved.</p>
  </div>
</footer>
`;

// =============================================================================
// SHARED PROMPT SECTIONS (single source of truth)
// =============================================================================

/** Manifest code example */
const MANIFEST_CODE = `{
    'name': 'Theme Name',
    'version': '18.0.1.0.0',
    'category': 'Website/Theme',
    'summary': 'Theme description',
    'depends': ['website'],
    'data': ['views/templates.xml'],
    'assets': {
        'web._assets_primary_variables': [
            ('prepend', 'theme_generated/static/src/scss/primary_variables.scss'),
        ],
        'web._assets_frontend_helpers': [
            ('prepend', 'theme_generated/static/src/scss/bootstrap_overridden.scss'),
        ],
        'web.assets_frontend': [
            'theme_generated/static/src/scss/theme.scss',
        ],
    },
    'license': 'LGPL-3',
}`;

/** Inline template for compact mode - small LLMs copy this literally */
const TEMPLATE_INLINE_CODE = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage_content" name="Homepage" inherit_id="website.homepage" customize_show="True">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
        <section class="o_cc o_cc1 pt48 pb48" data-snippet="s_cover">
          <div class="container text-center">
            <h1 class="display-4 fw-bold">Headline</h1>
            <p class="lead">Description text here</p>
            <a href="/contactus" class="btn btn-primary btn-lg rounded-pill px-4">Contact Us</a>
          </div>
        </section>
        <section class="o_cc o_cc2 pt40 pb40" data-snippet="s_three_columns">
          <div class="container">
            <h2 class="text-center fw-bold mb-5">Our Services</h2>
            <div class="row g-4">
              <div class="col-md-4"><div class="card border-0 shadow-sm h-100"><div class="card-body p-4 text-center"><h5 class="fw-bold">Service 1</h5><p class="text-muted">Description</p></div></div></div>
              <div class="col-md-4"><div class="card border-0 shadow-sm h-100"><div class="card-body p-4 text-center"><h5 class="fw-bold">Service 2</h5><p class="text-muted">Description</p></div></div></div>
              <div class="col-md-4"><div class="card border-0 shadow-sm h-100"><div class="card-body p-4 text-center"><h5 class="fw-bold">Service 3</h5><p class="text-muted">Description</p></div></div></div>
            </div>
          </div>
        </section>
      </div>
    </xpath>
  </template>
</odoo>`;

/** Template pattern for full mode - structural guidance */
const TEMPLATE_PATTERN_CODE = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage_content" name="Homepage Content" inherit_id="website.homepage" customize_show="True">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
        <!-- Hero section with Odoo color combination class -->
        <section class="o_cc o_cc1 pt96 pb96" data-snippet="s_cover"
                 style="background-image: url('...'); background-size: cover; background-position: center;">
          <div class="container text-center">
            <h1 class="display-3 fw-bold">Main Headline</h1>
            <p class="lead mb-4">Subheadline text</p>
            <a href="/contactus" class="btn btn-primary btn-lg rounded-pill px-4">Get Started</a>
          </div>
        </section>
        <!-- Features section -->
        <section class="o_cc o_cc2 pt48 pb48" data-snippet="s_three_columns">
          <div class="container">
            <h2 class="text-center fw-bold mb-5">Section Title</h2>
            <div class="row g-4">
              <!-- 3 cards with real content -->
            </div>
          </div>
        </section>
        <!-- More sections: testimonials, CTA, about, etc. -->
      </div>
    </xpath>
  </template>
</odoo>`;

/** Primary variables SCSS - contains hardcoded colors/fonts that buildSystemPrompt replaces for compact mode */
const PRIMARY_VARIABLES_CODE = `$o-color-palettes: map-merge($o-color-palettes,
  (
    'theme-custom': (
      'o-color-1': #c9302c,
      'o-color-2': #8b4513,
      'o-color-3': #d4a373,
      'o-color-4': #fefae0,
      'o-color-5': #2d2d2d,
    ),
  )
);
$o-selected-color-palettes-names: append($o-selected-color-palettes-names, 'theme-custom');
$o-theme-color-palette-number: 'theme-custom' !default;

$o-website-values-palettes: (
  (
    'color-palettes-name': 'theme-custom',
    'font': 'Lato',
    'headings-font': 'Playfair Display',
    'header-font-size': 1rem,
    'btn-border-radius': 10rem,
  ),
);

$o-theme-font-configs: (
  'Playfair Display': (
    'family': ('Playfair Display', serif),
    'url': 'Playfair+Display:400,700',
  ),
  'Lato': (
    'family': ('Lato', sans-serif),
    'url': 'Lato:300,400,700',
  ),
);`;

const BOOTSTRAP_OVERRIDDEN_CODE = `// Bootstrap variable overrides (loaded before Bootstrap compiles)
$border-radius: 0.5rem !default;
$border-radius-lg: 0.75rem !default;
$btn-border-radius: 10rem !default;
$box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !default;
$box-shadow-lg: 0 8px 25px rgba(0, 0, 0, 0.12) !default;`;

const THEME_SCSS_CODE = `// Custom theme styles
section[data-snippet="s_cover"] {
  min-height: 75vh;
  display: flex;
  align-items: center;
}
.card {
  border-radius: 0.5rem;
  transition: transform 0.2s;
  &:hover { transform: translateY(-4px); }
}`;

/** Output contract - shared between modes */
const OUTPUT_CONTRACT = `## OUTPUT CONTRACT (STRICT)
You MUST output EXACTLY 5 files with these exact names, sizes, and required patterns:

| # | File Path | Size Range | Required Patterns |
|---|-----------|-----------|-------------------|
| 1 | __manifest__.py | 400-800 chars | 'category': 'Website/Theme', 'version': '18.0., 'depends': ['website'] |
| 2 | views/templates.xml | 2000-8000 chars | <?xml, <odoo>, inherit_id="website.homepage", <xpath, </xpath>, </template>, </odoo> |
| 3 | static/src/scss/primary_variables.scss | 400-1500 chars | $o-color-palettes, o-color-1 through o-color-5, $o-selected-color-palettes-names |
| 4 | static/src/scss/bootstrap_overridden.scss | 100-600 chars | !default on every declaration |
| 5 | static/src/scss/theme.scss | 100-2000 chars | NO body{}, NO :root{}, NO font-family |

VIOLATION = REJECT. Missing files, wrong names, or missing patterns trigger self-correction.`;

/** Generation rules - consolidated from all previous prompts */
const GENERATION_RULES = `## Rules

### Color System
- Define 5 colors in $o-color-palettes: o-color-1 (primary) through o-color-5 (dark)
- Register with $o-selected-color-palettes-names
- Activate with $o-theme-color-palette-number: 'theme-custom' !default
- In templates, use o_cc o_cc1/o_cc2/o_cc3 classes on sections
- In SCSS, use o-color('o-color-1') to access colors
- NEVER use CSS custom properties (:root { --primary })

### Asset Bundles
- web._assets_primary_variables: $o-color-palettes, $o-theme-font-configs (prepend)
- web._assets_frontend_helpers: Bootstrap variable overrides (prepend)
- web.assets_frontend: Custom SCSS rules (theme.scss)

### Template Structure
- Template MUST use inherit_id="website.homepage" with xpath position="replace"
- Replace <div id="wrap"> with <div id="wrap" class="oe_structure"> containing sections
- Each section needs data-snippet attribute + o_cc color class
- Every <section> MUST contain a <div class="container"> as first child
- ALWAYS close </xpath>, </template>, </div>, </section> tags
- Use t-out instead of deprecated t-raw
- Use Bootstrap 5 classes: container, row, col-md-4, card, btn, py-5, fw-bold
- NEVER use Tailwind classes or CSS custom properties (--primary)

### Content
- Write REAL content for the requested industry. NO generic placeholders
- Include at least 4-5 complete sections with real industry content
- At least 3 cards/items in grid sections (col-md-4 x3)
- Images: MUST have alt="", class="img-fluid", loading="lazy"
- Use Unsplash URLs for images, NEVER relative paths like images/foo.png

### SCSS
- Colors go in primary_variables.scss using $o-color-palettes, NOT :root vars
- Bootstrap variable overrides go in bootstrap_overridden.scss with !default flag
- Use neutral shadows: rgba(0,0,0,0.1). NEVER blue shadows
- NO hardcoded hex colors in theme.scss (use o-color('o-color-1'))`;

/** Forbidden patterns - shared between modes */
const FORBIDDEN_PATTERNS = `## FORBIDDEN

### In templates.xml:
- NO raw <form> tags (Odoo uses website.form widget for CSRF protection)
- NO <script> tags (JS goes in web.assets_frontend bundle)
- NO <style> tags (CSS goes in theme.scss)
- NO Tailwind classes (no "flex", "p-4", "bg-blue-500", "text-center" etc.)
- NO CSS custom properties in inline styles (no style="color: var(--primary)")
- NO t-raw (use t-out instead)

### In theme.scss:
- NO body { } or html { } overrides
- NO .container { } or .container-fluid { } overrides
- NO font-family declarations (fonts come from primary_variables.scss)
- NO background-image in CSS (use inline style on HTML elements)
- NO :root { } or CSS custom properties
- NO hardcoded hex colors (use o-color('o-color-1') in SCSS)

### WRONG → RIGHT Examples
  WRONG: <div class="flex items-center p-4 bg-blue-500">  ← Tailwind
  RIGHT: <div class="d-flex align-items-center p-3 bg-primary">  ← Bootstrap 5
  WRONG: <section class="hero-section">  ← Missing o_cc and data-snippet
  RIGHT: <section class="o_cc o_cc1" data-snippet="s_cover">
  WRONG: 'category': 'Theme/Creative'  ← Wrong category
  RIGHT: 'category': 'Website/Theme'
  WRONG: <template id="homepage" inherit_id="website.layout">  ← Wrong target
  RIGHT: <template id="homepage" inherit_id="website.homepage">
  WRONG: t-raw="variable"  ← Deprecated
  RIGHT: t-out="variable"
  WRONG: :root { --primary: #c9302c; }  ← CSS custom properties
  RIGHT: (use $o-color-palettes SCSS map in primary_variables.scss)
  WRONG: body { font-family: 'Lato', sans-serif; }  ← Font in theme.scss
  RIGHT: (fonts go in primary_variables.scss via $o-theme-font variables)
  WRONG: .hero { background-color: #c9302c; }  ← Hardcoded hex
  RIGHT: .hero { background-color: o-color('o-color-1'); }`;

/** Quality standards - shared between modes */
const QUALITY_STANDARDS = `## Quality Standards
1. Generate 5-7 complete sections with real industry-specific content
2. All sections must have data-snippet attributes and o_cc color classes
3. Use proper Bootstrap grid (row, col-md-4) with at least 3 items per grid
4. Include hero, features/services, about, testimonials, CTA, footer sections
5. Use Unsplash image URLs for realistic backgrounds
6. Responsive design with mobile breakpoints
7. Generate ALL files with COMPLETE content. No placeholders.`;

// =============================================================================
// ODOO SKILLS INTEGRATION
// =============================================================================

/**
 * Generate industry presets documentation for AI context
 */
function getIndustryPresetsDoc(): string {
  const industries = Object.entries(INDUSTRY_PRESETS).map(([id, preset]) => {
    return `- ${id}: ${preset.name} (${preset.colors.primary} primary, ${preset.typography.headingFamily} headings)`;
  });
  return `## Available Industry Presets\n${industries.join("\n")}`;
}

/**
 * Generate snippet library documentation for AI context
 */
function getSnippetLibraryDoc(): string {
  const snippetsByCategory: Record<string, string[]> = {};

  Object.values(SNIPPET_LIBRARY).forEach((snippet) => {
    if (!snippetsByCategory[snippet.category]) {
      snippetsByCategory[snippet.category] = [];
    }
    snippetsByCategory[snippet.category].push(`${snippet.id}: ${snippet.name}`);
  });

  const lines: string[] = ["## Available Snippets"];
  Object.entries(snippetsByCategory).forEach(([category, snippets]) => {
    lines.push(`\n### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
    snippets.forEach((s) => lines.push(`- ${s}`));
  });

  return lines.join("\n");
}

/**
 * Generate i18n languages documentation
 */
function getLanguagesDoc(): string {
  const rtlLangs = Object.values(SUPPORTED_LANGUAGES)
    .filter((l) => l.rtl)
    .map((l) => l.code);

  return `## Supported Languages
- Total: ${Object.keys(SUPPORTED_LANGUAGES).length} languages
- RTL Support: ${rtlLangs.join(", ")}
- Default translations: es_ES, fr_FR, de_DE`;
}

// =============================================================================
// MODULAR PROMPT BUILDER
// =============================================================================

/**
 * Build Odoo 18 theme generation prompt.
 * Single source of truth for both compact (Ollama) and full (Claude) modes.
 *
 * @param compact - true for smaller LLMs (Ollama), false for Claude/GPT-4.
 *   Compact: includes full inline examples (small LLMs copy these literally).
 *   Full: adds design system, section templates, industry presets, snippet library.
 */
export function buildOdooPrompt(compact: boolean): string {
  const parts: string[] = [];

  // ---- INTRO ----
  if (compact) {
    parts.push(`You generate Odoo 18 website themes. Output EXACTLY 5 files.`);
  } else {
    parts.push(`You are an expert Odoo 18 website theme developer powered by Platxa Odoo Skills.
Follow the EXACT Odoo 18 theme conventions from the official tutorial.

## Output Format
For each file, output with header then code fence:
**theme_generated/path/to/file.ext:**
\`\`\`language
[complete file content]
\`\`\`

## Required Files (5 files)
\`\`\`
theme_generated/
\u251C\u2500\u2500 __manifest__.py                              # Module manifest
\u251C\u2500\u2500 views/
\u2502   \u2514\u2500\u2500 templates.xml                            # ALL QWeb templates (single file)
\u2514\u2500\u2500 static/
    \u2514\u2500\u2500 src/
        \u2514\u2500\u2500 scss/
            \u251C\u2500\u2500 primary_variables.scss            # Odoo color palettes & fonts
            \u251C\u2500\u2500 bootstrap_overridden.scss          # Bootstrap variable overrides
            \u2514\u2500\u2500 theme.scss                         # Custom CSS rules
\`\`\``);
  }

  // ---- FILE EXAMPLES ----
  // Manifest example (always - critical for all LLMs)
  parts.push(`**__manifest__.py:**
\`\`\`python
${MANIFEST_CODE}
\`\`\``);

  // Template example (compact: full inline for copy, full: structural pattern)
  if (compact) {
    parts.push(`**views/templates.xml:**
\`\`\`xml
${TEMPLATE_INLINE_CODE}
\`\`\``);
  } else {
    parts.push(`**theme_generated/views/templates.xml:**
\`\`\`xml
${TEMPLATE_PATTERN_CODE}
\`\`\``);
  }

  // SCSS examples (always - both modes need these)
  parts.push(`**static/src/scss/primary_variables.scss:**
\`\`\`scss
${PRIMARY_VARIABLES_CODE}
\`\`\``);

  parts.push(`**static/src/scss/bootstrap_overridden.scss:**
\`\`\`scss
${BOOTSTRAP_OVERRIDDEN_CODE}
\`\`\``);

  parts.push(`**static/src/scss/theme.scss:**
\`\`\`scss
${THEME_SCSS_CODE}
\`\`\``);

  // ---- RULES & CONTRACTS ----
  parts.push(OUTPUT_CONTRACT);
  parts.push(GENERATION_RULES);
  parts.push(FORBIDDEN_PATTERNS);

  // ---- FULL MODE EXTRAS ----
  if (!compact) {
    parts.push(getIndustryPresetsDoc());
    parts.push(getSnippetLibraryDoc());
    parts.push(DESIGN_SYSTEM);
    parts.push(SECTION_TEMPLATES);
  }

  // ---- QUALITY ----
  parts.push(QUALITY_STANDARDS);

  return parts.join("\n\n");
}

// =============================================================================
// LEGACY EXPORTS (backward compatibility)
// =============================================================================

/** @deprecated Use buildOdooPrompt(true) instead */
export const ODOO_LOCAL_PROMPT = buildOdooPrompt(true);
/** @deprecated Use buildOdooPrompt(false) instead */
export const ODOO_FULL_PROMPT = buildOdooPrompt(false);
/** @deprecated Use buildOdooPrompt(false) instead */
export const ODOO_SKILLS_PROMPT = buildOdooPrompt(false);
export const ODOO_WEBSITE_SYSTEM_PROMPT = ODOO_SKILLS_PROMPT;
export const DESIGN_ANALYZER_PROMPT = `Analyze designs for color harmony, typography, spacing, and accessibility.`;
export const CODE_REVIEWER_PROMPT = `Review Odoo code for best practices, security, and performance.`;

// =============================================================================
// INTERFACES
// =============================================================================

export interface ColorPalette {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

export interface ProjectContext {
  projectName?: string;
  industry?: string;
  colorPalette?: ColorPalette;
  existingFiles?: string[];
  designStyle?: string;
  useCompactPrompt?: boolean;
}

// =============================================================================
// ENHANCED SYSTEM PROMPT (with Agent Bridge integration)
// =============================================================================

import { injectBrandTokens } from "@/lib/agent-bridge/brand-token-injector";
import type { BrandTokenContext } from "@/lib/agent-bridge/types";

/**
 * Build an enhanced system prompt with brand token injection.
 * Calls the base buildSystemPrompt() then appends brand tokens
 * from the agent bridge pre-generation pipeline.
 *
 * @param options - Project context for base prompt
 * @param brandTokens - Brand tokens from pre-generation (optional)
 * @param promptFragment - Pre-built prompt fragment from design analysis (optional)
 * @param preferencePrompt - User preference fragment from cross-session memory (optional)
 * @returns Enhanced system prompt with brand tokens and preferences appended
 */
export function buildEnhancedSystemPrompt(
  options: ProjectContext,
  brandTokens?: BrandTokenContext,
  promptFragment?: string,
  preferencePrompt?: string,
): string {
  let basePrompt = buildSystemPrompt(options);

  // Inject user preferences if available (from cross-session memory)
  if (preferencePrompt && preferencePrompt.trim()) {
    basePrompt = basePrompt + "\n" + preferencePrompt;
  }

  if (!brandTokens) return basePrompt;

  return injectBrandTokens(basePrompt, brandTokens, promptFragment);
}

// =============================================================================
// INDUSTRY-SPECIFIC ENHANCEMENTS
// =============================================================================

const INDUSTRY_GUIDANCE: Record<string, string> = {
  restaurant: `
Restaurant Theme - REQUIRED sections: hero, menu, about, testimonials, reservation, footer
Odoo Color Palette (use EXACTLY these in primary_variables.scss):
  o-color-1: #c9302c (burgundy red), o-color-2: #8b4513 (brown), o-color-3: #d4a373 (tan), o-color-4: #fefae0 (cream), o-color-5: #2d2d2d (dark)
Fonts: headings 'Playfair Display' (serif), body 'Lato' (sans-serif)
Hero image: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80
Food image: https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80
MUST include: Menu cards with dish names/prices, Reservation CTA, Hours/location in footer`,

  technology: `
Tech/SaaS Theme - REQUIRED sections: hero, features, pricing, integrations, testimonials, CTA
Odoo Color Palette:
  o-color-1: #2563eb (blue), o-color-2: #7c3aed (purple), o-color-3: #06b6d4 (cyan), o-color-4: #f8fafc (light), o-color-5: #0f172a (dark)
Fonts: headings 'Inter' (sans-serif), body 'Inter' (sans-serif)
Hero image: https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80
MUST include: Feature grid with icons, Pricing table, Stats/metrics section`,

  legal: `
Law Firm Theme - REQUIRED sections: hero, practice-areas, attorneys, testimonials, contact, footer
Odoo Color Palette:
  o-color-1: #1a365d (navy), o-color-2: #c9a227 (gold), o-color-3: #4a5568 (gray), o-color-4: #f7f7f7 (light), o-color-5: #1a202c (dark)
Fonts: headings 'EB Garamond' (serif), body 'Source Sans Pro' (sans-serif)
Hero image: https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1920&q=80
MUST include: Practice areas grid, Attorney profiles, Trust badges`,

  healthcare: `
Healthcare Theme - REQUIRED sections: hero, services, doctors, testimonials, appointment, footer
Odoo Color Palette:
  o-color-1: #0d9488 (teal), o-color-2: #0284c7 (blue), o-color-3: #06b6d4 (cyan), o-color-4: #f0fdfa (mint), o-color-5: #134e4a (dark)
Fonts: headings 'Poppins' (sans-serif), body 'Open Sans' (sans-serif)
Hero image: https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1920&q=80
MUST include: Services with icons, Doctor profiles, Appointment CTA`,

  ecommerce: `
E-commerce Theme - REQUIRED sections: hero, featured-products, categories, deals, testimonials, newsletter, footer
Odoo Color Palette:
  o-color-1: #7c3aed (purple), o-color-2: #ec4899 (pink), o-color-3: #f59e0b (amber), o-color-4: #faf5ff (light), o-color-5: #1e1b4b (dark)
Fonts: headings 'Poppins' (sans-serif), body 'Inter' (sans-serif)
Hero image: https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1920&q=80
MUST include: Product showcase grid (3-4 cards with price, image, CTA), Category cards, Trust/payment badges, Newsletter signup
Odoo E-commerce Integration:
  - Add 'website_sale' to depends in __manifest__.py for shop functionality
  - Product grid: use <section data-snippet="s_three_columns"> with product-style cards
  - Each product card: image, name, price badge, "Add to Cart" button styled with btn-primary
  - Categories section: icon + name cards linking to /shop?category=X
  - Trust section: payment icons (Visa, Mastercard, PayPal), SSL badge, money-back guarantee
  - Include "Shop Now" CTA buttons linking to /shop
  - Deals/promotions: highlight with o_cc3 accent color background`,
};

// =============================================================================
// BUILD SYSTEM PROMPT
// =============================================================================

/**
 * Build context-aware system prompt with design guidelines
 */
export function buildSystemPrompt(options: ProjectContext): string {
  const useCompact = options.useCompactPrompt ?? true;
  let prompt = buildOdooPrompt(useCompact);

  // Add project context
  const context: string[] = [];
  if (options.projectName) {
    context.push(`Theme Name: ${options.projectName}`);
  }

  // Add industry-specific guidance with Odoo color format
  if (options.industry) {
    const industryKey = options.industry.toLowerCase() as Industry;

    // Prefer INDUSTRY_GUIDANCE (Odoo-specific with o-color-1 format) over generic INDUSTRY_PRESETS
    const guidance = INDUSTRY_GUIDANCE[industryKey];
    if (guidance) {
      context.push(guidance);
    } else {
      // Fallback: convert INDUSTRY_PRESETS to Odoo color format
      const preset = INDUSTRY_PRESETS[industryKey];
      if (preset) {
        context.push(`
Industry: ${preset.name}
Description: ${preset.description}

Odoo Color Palette (use EXACTLY these in primary_variables.scss $o-color-palettes):
  o-color-1: ${preset.colors.primary} (primary), o-color-2: ${preset.colors.secondary} (secondary), o-color-3: ${preset.colors.accent} (accent), o-color-4: ${preset.colors.background} (light/whitish), o-color-5: ${preset.colors.text} (dark/blackish)

Fonts: headings '${preset.typography.headingFamily}', body '${preset.typography.bodyFamily}'
REQUIRED sections: ${preset.suggestedSections.join(", ")}`);
      } else {
        context.push(`Industry: ${options.industry}`);
      }
    }
  }

  // Add custom color palette as Odoo color overrides
  if (options.colorPalette) {
    const colors = options.colorPalette;
    context.push(`
Custom Odoo Color Overrides (use in $o-color-palettes):
  o-color-1: ${colors.primary || "(use industry default)"} (primary)
  o-color-2: ${colors.secondary || "(use industry default)"} (secondary)
  o-color-3: ${colors.accent || "(use industry default)"} (accent)
  o-color-4: ${colors.background || "(use industry default)"} (whitish)
  o-color-5: ${colors.text || "(use industry default)"} (blackish)`);
  }

  // Add design style preference
  if (options.designStyle) {
    context.push(`Design Style: ${options.designStyle}`);
  }

  // Add existing files context
  if (options.existingFiles && options.existingFiles.length > 0) {
    context.push(`Existing Files: ${options.existingFiles.join(", ")}`);
  }

  // Append context to prompt
  if (context.length > 0) {
    prompt += `\n\n## Project Context\n${context.join("\n")}`;
  }

  // For compact prompt (Ollama): replace example colors/fonts in the template
  // so the model copies correct values instead of hardcoded examples.
  // Small models tend to copy example values literally.
  if (useCompact) {
    const industryKey = options.industry?.toLowerCase() as Industry;
    const preset = industryKey ? INDUSTRY_PRESETS[industryKey] : undefined;
    const colors = options.colorPalette || (preset ? {
      primary: preset.colors.primary,
      secondary: preset.colors.secondary,
      accent: preset.colors.accent,
      background: preset.colors.background,
      text: preset.colors.text,
    } : undefined);

    if (colors?.primary) {
      // Replace hardcoded example colors in the template
      prompt = prompt.replace("#c9302c", colors.primary);
      prompt = prompt.replace("#8b4513", colors.secondary || "#8b4513");
      prompt = prompt.replace("#d4a373", colors.accent || "#d4a373");
      prompt = prompt.replace("#fefae0", colors.background || "#fefae0");
      prompt = prompt.replace("#2d2d2d", colors.text || "#2d2d2d");
    }

    if (preset) {
      // Replace hardcoded example fonts
      prompt = prompt.replace(/Playfair Display/g, preset.typography.headingFamily);
      prompt = prompt.replace(/Lato/g, preset.typography.bodyFamily);
    }
  }

  return prompt;
}

/**
 * Get available industries for UI dropdown
 */
export function getAvailableIndustries(): Array<{ id: string; name: string; description: string }> {
  return Object.entries(INDUSTRY_PRESETS).map(([id, preset]) => ({
    id,
    name: preset.name,
    description: preset.description,
  }));
}

/**
 * Get industry preset colors for preview
 */
export function getIndustryColors(industry: string): ColorPalette | undefined {
  const preset = INDUSTRY_PRESETS[industry as Industry];
  if (!preset) return undefined;

  return {
    primary: preset.colors.primary,
    secondary: preset.colors.secondary,
    accent: preset.colors.accent,
    background: preset.colors.background,
    text: preset.colors.text,
  };
}

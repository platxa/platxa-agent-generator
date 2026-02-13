/**
 * System prompts for AI integration
 * Integrates Platxa brand kit, frontend agent design guidelines,
 * and Odoo Skills for production-grade theme generation.
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
// SYSTEM PROMPTS
// =============================================================================

/**
 * Compact prompt for local LLMs (llama3.2, mistral, etc.)
 * CRITICAL: Must be SHORT - small models have limited context windows.
 * Industry-specific content is injected via buildSystemPrompt().
 *
 * Based on the official Odoo 18 theme tutorial (website_airproof):
 * https://www.odoo.com/documentation/18.0/developer/tutorials/website_theme.html
 */
export const ODOO_LOCAL_PROMPT = `You generate Odoo 18 website themes. Output EXACTLY 5 files.

**__manifest__.py:**
\`\`\`python
{
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
}
\`\`\`

**views/templates.xml:**
\`\`\`xml
<?xml version="1.0" encoding="utf-8"?>
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
</odoo>
\`\`\`

**static/src/scss/primary_variables.scss:**
\`\`\`scss
$o-color-palettes: map-merge($o-color-palettes,
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
);
\`\`\`

**static/src/scss/bootstrap_overridden.scss:**
\`\`\`scss
// Bootstrap variable overrides (loaded before Bootstrap compiles)
$border-radius: 0.5rem !default;
$border-radius-lg: 0.75rem !default;
$btn-border-radius: 10rem !default;
$box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !default;
$box-shadow-lg: 0 8px 25px rgba(0, 0, 0, 0.12) !default;
\`\`\`

**static/src/scss/theme.scss:**
\`\`\`scss
// Custom theme styles
section[data-snippet="s_cover"] {
  min-height: 75vh;
  display: flex;
  align-items: center;
}
.card {
  border-radius: 0.5rem;
  transition: transform 0.2s;
  &:hover { transform: translateY(-4px); }
}
\`\`\`

RULES:
- Output EXACTLY 5 files: __manifest__.py, views/templates.xml, primary_variables.scss, bootstrap_overridden.scss, theme.scss
- Template MUST use inherit_id="website.homepage" with xpath position="replace"
- Replace <div id="wrap"> with <div id="wrap" class="oe_structure"> containing sections
- Use Odoo color classes: o_cc o_cc1, o_cc2, etc. on sections
- Add data-snippet attribute on sections for Website Builder compatibility
- ALWAYS close </xpath>, </template>, </div>, </section> tags
- Use Bootstrap 5 classes: container, row, col-md-4, card, btn, py-5, fw-bold
- NEVER use Tailwind classes or CSS custom properties (--primary)
- Colors go in primary_variables.scss using $o-color-palettes, NOT :root vars
- Bootstrap variable overrides go in bootstrap_overridden.scss with !default flag
- Use neutral shadows: rgba(0,0,0,0.1). NEVER blue shadows.
- Write REAL content for the requested industry. NO generic placeholders.
- Include at least 3 cards/items in grid sections (col-md-4 x3).
- Sections MUST have at least 4-5 complete sections with real industry content.`;

/**
 * Full prompt for cloud APIs (Claude, GPT-4)
 * Based on the official Odoo 18 theme tutorial (website_airproof):
 * https://www.odoo.com/documentation/18.0/developer/tutorials/website_theme.html
 * And the official design-themes repo:
 * https://github.com/odoo/design-themes/tree/18.0
 */
export const ODOO_FULL_PROMPT = `You are an expert Odoo 18 website theme developer.
Create production-ready themes following the EXACT Odoo 18 conventions (website_airproof tutorial pattern).

## OUTPUT FORMAT
For each file, output with a header followed by a code fence:

**theme_generated/__manifest__.py:**
\`\`\`python
{
    'name': 'Theme Name',
    'version': '18.0.0',
    'category': 'Website/Theme',
    'summary': 'A beautiful theme for ...',
    'depends': ['website'],
    'data': [
        'views/templates.xml',
    ],
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
}
\`\`\`

**theme_generated/views/templates.xml:**
\`\`\`xml
<?xml version="1.0" encoding="utf-8"?>
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
</odoo>
\`\`\`

**theme_generated/static/src/scss/primary_variables.scss:**
\`\`\`scss
// Odoo color palette - integrates with Website Builder color picker
$o-color-palettes: map-merge($o-color-palettes,
  (
    'theme-custom': (
      'o-color-1': #PRIMARY_HEX,     // Primary brand color
      'o-color-2': #SECONDARY_HEX,   // Secondary color
      'o-color-3': #ACCENT_HEX,      // Extra/accent color
      'o-color-4': #LIGHT_BG_HEX,    // Light background (whitish)
      'o-color-5': #DARK_TEXT_HEX,    // Dark text (blackish)
    ),
  )
);
$o-selected-color-palettes-names: append($o-selected-color-palettes-names, 'theme-custom');

$o-website-values-palettes: (
  (
    'color-palettes-name': 'theme-custom',
    'font': 'Body Font Name',
    'headings-font': 'Heading Font Name',
    'header-font-size': 1rem,
    'btn-border-radius': 10rem,
  ),
);

// Google Fonts configuration
$o-theme-font-configs: (
  'Heading Font': (
    'family': ('Heading Font', serif),
    'url': 'Heading+Font:400,700',
  ),
  'Body Font': (
    'family': ('Body Font', sans-serif),
    'url': 'Body+Font:300,400,700',
  ),
);
\`\`\`

**theme_generated/static/src/scss/bootstrap_overridden.scss:**
\`\`\`scss
// Bootstrap variable overrides - ONLY variables, no custom rules
$border-radius: 0.5rem !default;
$border-radius-lg: 0.75rem !default;
$card-border-width: 0 !default;
$box-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.08) !default;
$box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1) !default;
\`\`\`

**theme_generated/static/src/scss/theme.scss:**
\`\`\`scss
// Custom theme styles - use Odoo color helpers
section[data-snippet="s_cover"] {
  min-height: 75vh;
  display: flex;
  align-items: center;
}
.card {
  transition: transform 0.2s, box-shadow 0.2s;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
}
\`\`\`

## Odoo 18 Color System (CRITICAL)
- Colors are defined as 5-color palettes in primary_variables.scss using $o-color-palettes
- o-color-1 = Primary, o-color-2 = Secondary, o-color-3 = Extra, o-color-4 = Light, o-color-5 = Dark
- In templates, use classes: o_cc o_cc1 (color combo 1), o_cc2, o_cc3 on sections
- In SCSS, use o-color('o-color-1') to access colors
- NEVER use CSS custom properties (:root { --primary }) - Odoo does NOT use them
- NEVER use hardcoded blue shadows. Use rgba(0,0,0,0.1) for neutral shadows.

## Odoo 18 Asset Bundles (CRITICAL)
- web._assets_primary_variables: Odoo variables ($o-color-palettes, $o-theme-font-configs)
- web._assets_frontend_helpers: Bootstrap overrides (prepend, variables only)
- web.assets_frontend: Custom SCSS rules (theme.scss)

## Template Structure (CRITICAL)
- Inherit website.homepage with xpath position="replace" on //div[@id='wrap']
- Replace with <div id="wrap" class="oe_structure"> containing sections
- Each section should have data-snippet="s_xxx" for Website Builder compatibility
- Use o_cc o_cc1/o_cc2 classes for Odoo color integration
- Use Bootstrap 5.3 classes (included by default)
- NEVER use Tailwind classes

${DESIGN_SYSTEM}

${SECTION_TEMPLATES}

## Quality Standards
1. Generate 5-7 complete sections with real industry-specific content
2. All sections must have data-snippet attributes and o_cc color classes
3. Use proper Bootstrap grid (row, col-md-4) with at least 3 items per grid
4. Include hero, features/services, about, testimonials, CTA, footer sections
5. Use Unsplash image URLs for realistic backgrounds
6. Responsive design with mobile breakpoints

IMPORTANT: Generate ALL files with COMPLETE content. No placeholders, no "add content here" comments.`;

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

/**
 * Enhanced prompt with Odoo Skills integration
 * Uses the same correct Odoo 18 conventions as ODOO_FULL_PROMPT
 * but adds industry presets, snippet library, and i18n support.
 */
export const ODOO_SKILLS_PROMPT = `You are an expert Odoo 18 website theme developer powered by Platxa Odoo Skills.
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
├── __manifest__.py                              # Module manifest
├── views/
│   └── templates.xml                            # ALL QWeb templates (single file)
└── static/
    └── src/
        └── scss/
            ├── primary_variables.scss            # Odoo color palettes & fonts
            ├── bootstrap_overridden.scss          # Bootstrap variable overrides
            └── theme.scss                         # Custom CSS rules
\`\`\`

## Manifest Format
\`\`\`python
{
    'name': 'Theme Name',
    'version': '18.0.0',
    'category': 'Website/Theme',
    'summary': '...',
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
}
\`\`\`

## Template Pattern (CRITICAL)
- Inherit website.homepage with xpath position="replace" on //div[@id='wrap']
- Replace empty wrap with <div id="wrap" class="oe_structure"> containing sections
- Each section: <section class="o_cc o_cc1 pt48 pb48" data-snippet="s_xxx">
- Use o_cc o_cc1/o_cc2/o_cc3 for Odoo color combinations on sections

## Odoo 18 Color System (CRITICAL)
- Define 5 colors in $o-color-palettes: o-color-1 (primary) through o-color-5 (dark)
- Register with $o-selected-color-palettes-names
- Configure fonts in $o-theme-font-configs with Google Font URLs
- Set palette name in $o-website-values-palettes
- In SCSS, use o-color('o-color-1') to access colors
- NEVER use CSS custom properties (:root { --primary })

${getIndustryPresetsDoc()}

${getSnippetLibraryDoc()}

## Odoo 18 Technical Requirements
- ALL templates in <odoo> tags with XML declaration
- Use t-out instead of deprecated t-raw
- data-snippet attributes: s_cover, s_three_columns, s_text_image, s_call_to_action, etc.
- Bootstrap 5.3 is included by default
- NEVER use Tailwind classes
- Neutral shadows only: rgba(0,0,0,0.1). NEVER blue shadows.

## Quality Standards
1. Generate 5-7 sections with REAL industry-specific content (no placeholders)
2. All sections with data-snippet and o_cc color classes
3. Bootstrap grid with 3+ items per row
4. Proper heading hierarchy (h1 → h2 → h3)
5. Responsive design with mobile breakpoints
6. Include: hero, services, about, testimonials, CTA sections

Generate complete, production-ready Odoo 18 themes NOW.`;

// Legacy exports
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
E-commerce Theme - REQUIRED sections: hero, featured-products, categories, testimonials, newsletter, footer
Odoo Color Palette:
  o-color-1: #7c3aed (purple), o-color-2: #ec4899 (pink), o-color-3: #f59e0b (amber), o-color-4: #faf5ff (light), o-color-5: #1e1b4b (dark)
Fonts: headings 'Poppins' (sans-serif), body 'Inter' (sans-serif)
Hero image: https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1920&q=80
MUST include: Product showcase grid, Category cards, Trust badges, Newsletter signup`,
};

// =============================================================================
// BUILD SYSTEM PROMPT
// =============================================================================

/**
 * Build context-aware system prompt with design guidelines
 */
export function buildSystemPrompt(options: ProjectContext): string {
  const useCompact = options.useCompactPrompt ?? true;
  // Compact = ODOO_LOCAL_PROMPT (for smaller context LLMs like Ollama)
  // Full = ODOO_SKILLS_PROMPT (for Claude API with larger context)
  let prompt = useCompact ? ODOO_LOCAL_PROMPT : ODOO_SKILLS_PROMPT;

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

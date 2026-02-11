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
 */
export const ODOO_LOCAL_PROMPT = `You generate Odoo 18 website themes. Output EXACTLY 3 files.

**__manifest__.py:**
\`\`\`python
{
    'name': 'Theme Name',
    'version': '18.0.1.0.0',
    'category': 'Theme/Creative',
    'depends': ['website'],
    'data': ['views/templates.xml'],
    'assets': {'web.assets_frontend': ['theme_generated/static/src/scss/theme.scss']},
    'license': 'LGPL-3',
}
\`\`\`

**views/templates.xml:**
\`\`\`xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage_content" inherit_id="website.homepage" customize_show="True">
    <xpath expr="//div[@id='wrap']" position="inside">
      <section class="py-5 bg-primary text-white text-center">
        <div class="container">
          <h1 class="display-4 fw-bold">Headline</h1>
          <p class="lead">Description</p>
          <a href="#" class="btn btn-light btn-lg rounded-pill px-4">CTA</a>
        </div>
      </section>
      <section class="py-5">
        <div class="container">
          <div class="row g-4">
            <div class="col-md-4">
              <div class="card border-0 shadow-sm rounded-3 h-100">
                <div class="card-body p-4 text-center">
                  <h5 class="fw-bold">Title</h5>
                  <p class="text-muted">Description</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </xpath>
  </template>
</odoo>
\`\`\`

**static/src/scss/theme.scss:**
\`\`\`scss
.hero-section { min-height: 75vh; }
.card { box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
\`\`\`

RULES:
- ONLY 3 files: __manifest__.py, views/templates.xml, static/src/scss/theme.scss
- ALL templates MUST have inherit_id="website.homepage" with xpath
- Use Bootstrap 5: container, row, col-md-4, card, btn, py-5, fw-bold
- Use neutral shadows: rgba(0,0,0,0.1). NEVER blue shadows.
- Write REAL content for the requested industry. NO placeholders like "Feature Title".`;

/**
 * Full prompt for cloud APIs (Claude, GPT-4)
 */
export const ODOO_FULL_PROMPT = `You are an expert Odoo 18 website theme developer with exceptional UI/UX design skills.
Your goal is to create beautiful, modern, production-ready Odoo themes that rival the best website builders.

## CRITICAL OUTPUT FORMAT
For each file, output with a header followed by a code fence:

**theme_generated/__manifest__.py:**
\`\`\`python
{
    'name': 'Theme Name',
    'version': '18.0.1.0.0',
    'category': 'Theme/Creative',
    'summary': 'Modern website theme',
    'depends': ['website'],
    'data': ['views/templates.xml'],
    'assets': {
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
  <!-- Inherit homepage to add content -->
  <template id="website_homepage_content" name="Homepage Content" inherit_id="website.homepage" customize_show="True">
    <xpath expr="//div[@id='wrap']" position="inside">
      <section class="hero-section min-vh-75 d-flex align-items-center">
        <div class="container text-center">
          <h1 class="display-4 fw-bold">Your Title</h1>
          <p class="lead">Your description text here</p>
          <a href="#" class="btn btn-primary btn-lg rounded-pill px-4">Call to Action</a>
        </div>
      </section>
      <section class="py-5">
        <div class="container">
          <div class="row g-4">
            <!-- Feature cards here -->
          </div>
        </div>
      </section>
    </xpath>
  </template>
</odoo>
\`\`\`

**theme_generated/static/src/scss/theme.scss:**
\`\`\`scss
// Theme custom styles - ALL styles in this ONE file
// MANDATORY: Use CSS variables for ALL colors (no hardcoded hex/rgb)

:root {
  // These are set by Odoo based on theme configuration
  --primary: #c9302c;    // Example: warm red for restaurant
  --secondary: #8b4513;  // Example: earthy brown
  --accent: #d4a373;     // Example: golden accent
  --background: #fefae0; // Example: cream background
}

.hero-section {
  min-height: 75vh;
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  // ✅ CORRECT: Use primary color for shadows
  box-shadow: 0 4px 20px rgba(var(--primary-rgb, 201, 48, 44), 0.3);
}

.card {
  // ✅ CORRECT: Neutral shadow using dark color
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  background: var(--background);
}

.btn-primary {
  background: var(--primary);
  // ✅ CORRECT: Shadow matches button color
  box-shadow: 0 4px 12px rgba(var(--primary-rgb, 201, 48, 44), 0.4);
}
\`\`\`

## ⚠️ SCSS COLOR RULES (MANDATORY - NO EXCEPTIONS)
❌ NEVER use hardcoded blue colors like: rgba(0, 128, 255, ...) or #0080ff
❌ NEVER use any blue shadows unless the theme is explicitly blue
✅ ALWAYS use theme colors (var(--primary), var(--secondary), etc.)
✅ ALWAYS use neutral shadows: rgba(0, 0, 0, 0.1) for subtle effects
✅ For colored shadows, derive from the PRIMARY color, not arbitrary blue

## Required Files Structure (EXACTLY 3 files - no more!)
\`\`\`
theme_generated/
├── __manifest__.py          # Module manifest (REQUIRED)
├── views/
│   └── templates.xml        # ALL QWeb templates in ONE file (REQUIRED)
└── static/
    └── src/
        └── scss/
            └── theme.scss   # ALL custom styles in ONE file (REQUIRED)
\`\`\`

CRITICAL: Do NOT create multiple XML files (no pages.xml, no snippets.xml separately).
CRITICAL: Do NOT create multiple SCSS files (no style.scss, no variables.scss separately).
Put ALL content in the single templates.xml and single theme.scss files.

## Odoo 18 Technical Requirements
- ALL templates must be wrapped in <odoo> tags with XML declaration
- Use inherit_id="website.homepage" to extend the homepage
- Use xpath to position content within the layout
- QWeb directives: t-if, t-foreach, t-esc, t-call, t-set
- Color classes: o_cc1-o_cc5 for Odoo color customization
- Bootstrap 5.3 is included by default

${DESIGN_SYSTEM}

${SECTION_TEMPLATES}

## Quality Standards
1. **Visual Design**: Modern, clean, professional appearance
2. **Color Harmony**: Follow 60-30-10 rule strictly
3. **Typography**: Clear hierarchy, readable fonts
4. **Spacing**: Generous whitespace, consistent padding
5. **Components**: Cards with shadows, rounded buttons
6. **Responsiveness**: Mobile-first, test all breakpoints
7. **Accessibility**: Proper contrast, semantic HTML

IMPORTANT: Generate ALL required files with complete content. Do not use placeholders.
Generate complete, beautiful, working Odoo 18 themes NOW.`;

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
 */
export const ODOO_SKILLS_PROMPT = `You are an expert Odoo 18 website theme developer powered by Platxa Odoo Skills.

## Output Format
For each file, output EXACTLY:
\`\`\`file:path/to/file.ext
[complete file content]
\`\`\`

## Required Files Structure
\`\`\`
theme_name/
├── __manifest__.py          # Module manifest
├── __init__.py              # Python init
├── views/
│   ├── layout.xml           # Layout customizations
│   ├── pages.xml            # Page templates
│   └── snippets.xml         # Custom snippets
├── static/
│   └── src/
│       ├── scss/
│       │   ├── primary_variables.scss  # Color overrides
│       │   ├── bootstrap_overridden.scss
│       │   └── theme.scss
│       └── js/
│           └── theme.js
└── i18n/
    ├── theme_name.pot       # Translation template
    └── [lang].po            # Translations
\`\`\`

${getIndustryPresetsDoc()}

${getSnippetLibraryDoc()}

${getLanguagesDoc()}

${DESIGN_SYSTEM}

${SECTION_TEMPLATES}

## Odoo 18 Technical Requirements
- QWeb directives: t-if, t-elif, t-else, t-foreach, t-as, t-esc, t-out, t-call, t-set
- Use t-out instead of deprecated t-raw
- Inherit website.layout for all pages
- Use xpath for template modifications
- Color classes: o_cc1-o_cc5 for Odoo color customization
- Snippet classes: s_*, for website builder recognition
- Bootstrap 5.3 is included by default

## Quality Standards
1. **Visual Design**: Modern, clean, professional appearance
2. **Color Harmony**: Follow 60-30-10 rule strictly
3. **Typography**: Clear hierarchy, readable fonts
4. **Spacing**: Generous whitespace, consistent padding
5. **Components**: Cards with shadows, rounded buttons
6. **Responsiveness**: Mobile-first, test all breakpoints
7. **Accessibility**: Proper contrast, semantic HTML
8. **i18n Ready**: All strings translatable
9. **Validation**: Pass QWeb, manifest, and SCSS validation

Generate complete, beautiful, production-ready Odoo 18 themes.`;

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
Restaurant Theme Guidelines:
- MUST use warm color palette: primary #c9302c (burgundy red), secondary #8b4513 (brown), accent #d4a373 (tan), background #fefae0 (cream)
- Hero with food/dining background image (use: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80)
- Food photography in menu section (use: https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80)
- Menu section with appetizing card design
- Reservation CTA prominent with warm accent color
- Hours and location in footer
- Testimonials from happy diners`,

  technology: `
Tech/SaaS Theme Guidelines:
- Clean, modern blue/purple palette
- Feature comparison grid
- Pricing table section
- Integration logos section
- Demo CTA prominent
- Stats/metrics section`,

  legal: `
Law Firm Theme Guidelines:
- Professional navy/gold palette
- Practice areas grid
- Attorney profiles
- Case results/testimonials
- Contact form prominent
- Trust badges (bar associations)`,

  healthcare: `
Healthcare Theme Guidelines:
- Calming teal/blue palette
- Services section with icons
- Doctor/staff profiles
- Patient testimonials
- Appointment booking CTA
- Insurance/payment info`,

  ecommerce: `
E-commerce Theme Guidelines:
- Vibrant accent colors
- Product showcase grid
- Category navigation
- Trust badges (secure payment)
- Newsletter signup
- Social proof section`,
};

// =============================================================================
// BUILD SYSTEM PROMPT
// =============================================================================

/**
 * Build context-aware system prompt with design guidelines
 */
export function buildSystemPrompt(options: ProjectContext): string {
  const useCompact = options.useCompactPrompt ?? true;
  // Use skills-enhanced prompt for full mode
  let prompt = useCompact ? ODOO_LOCAL_PROMPT : ODOO_SKILLS_PROMPT;

  // Add project context
  const context: string[] = [];
  if (options.projectName) {
    context.push(`Theme Name: ${options.projectName}`);
  }

  // Add industry-specific guidance from Odoo Skills presets
  if (options.industry) {
    const industryKey = options.industry.toLowerCase() as Industry;
    const preset = INDUSTRY_PRESETS[industryKey];

    if (preset) {
      context.push(`
Industry: ${preset.name}
Description: ${preset.description}

Recommended Color Palette:
- Primary: ${preset.colors.primary}
- Secondary: ${preset.colors.secondary}
- Accent: ${preset.colors.accent}
- Background: ${preset.colors.background}
- Text: ${preset.colors.text}

Typography:
- Headings: ${preset.typography.headingFamily} (weight: ${preset.typography.headingWeight})
- Body: ${preset.typography.bodyFamily} (weight: ${preset.typography.bodyWeight})

Suggested Sections: ${preset.suggestedSections.join(", ")}`);
    } else {
      // Fallback to legacy guidance
      const guidance = INDUSTRY_GUIDANCE[industryKey];
      if (guidance) {
        context.push(guidance);
      } else {
        context.push(`Industry: ${options.industry}`);
      }
    }
  }

  // Add custom color palette (overrides industry defaults)
  if (options.colorPalette) {
    const colors = options.colorPalette;
    context.push(`
Custom Color Overrides:
- Primary: ${colors.primary || "(use industry default)"}
- Secondary: ${colors.secondary || "(use industry default)"}
- Accent: ${colors.accent || "(use industry default)"}
- Background: ${colors.background || "(use industry default)"}
- Text: ${colors.text || "(use industry default)"}`);
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

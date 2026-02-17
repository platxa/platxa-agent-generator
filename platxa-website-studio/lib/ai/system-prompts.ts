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
## Design System (STRICT — follow exactly)

### Colors (60-30-10 Rule)
- 60% Dominant: White (#ffffff) and off-white (#f8f9fa) backgrounds
- 30% Supporting: Dark text (#2d2d2d), muted text (#6c757d), subtle borders rgba(0,0,0,0.08)
- 10% Accent: Primary brand color ONLY on buttons, badges, icon circles, links
- NEVER use primary color as a section background (except CTA section)
- NEVER place two consecutive sections with the same background color

### Industry Color Palettes (o-color-1 through o-color-5)
Restaurant: warm (#c9302c primary, #8b4513 secondary, #d4a373 tertiary, #fefae0 light, #2d2d2d dark)
Tech/SaaS: blue (#2563eb primary, #7c3aed secondary, #06b6d4 tertiary, #f8fafc light, #0f172a dark)
Law/Finance: navy (#1a365d primary, #c9a227 secondary, #4a5568 tertiary, #f7f7f7 light, #1a202c dark)
Healthcare: teal (#0d9488 primary, #0284c7 secondary, #4ade80 tertiary, #f0fdfa light, #1e293b dark)
E-commerce: purple (#7c3aed primary, #ec4899 secondary, #f59e0b tertiary, #faf5ff light, #1e1b4b dark)

### Typography Scale (Exact — do not deviate)
- Hero headline: display-3 (3rem), fw-bold, line-height: 1.1, letter-spacing: -0.01em
- Section headings: h2 (2rem), fw-bold, line-height: 1.2, text-center
- Section subtitles: p, text-muted, max-width 600px, mx-auto, mb-5, line-height: 1.6
- Card titles: h5 (1.25rem), fw-bold, line-height: 1.3
- Body text: 1rem (16px), text-muted, line-height: 1.6
- Small labels/eyebrows: 0.75rem, text-uppercase, letter-spacing: 0.05em, fw-semibold
- Badges: rounded-pill, px-3 py-2, bg-primary bg-opacity-10 text-primary, small text
- NEVER skip heading levels (no h1 then h4)
- Font weights: use at least 3 levels (300 for subtitles, 400 for body, 700 for headings)

### Spacing Rhythm (8px grid — STRICT)
- Hero section: pt96 pb96 (6rem) — generous opening
- Content sections: pt64 pb64 (4rem) — breathing room
- CTA section: pt64 pb64 — tight, urgent
- Footer: pt48 pb32 — compact, utilitarian
- Section heading to content: mb-5 (3rem gap)
- Card padding: p-4 (24px) minimum
- Grid gaps: g-4 (24px) between all grid items
- Between badge/eyebrow and heading: mb-3
- Between heading and subtitle: mb-2
- NEVER use less than pt48 pb48 on any section

### Section Heading Composition (3-part pattern)
Every section heading MUST follow this structure:
1. Optional: Small badge or eyebrow text above heading
2. Section heading: h2 fw-bold text-center mb-2
3. Section subtitle: p text-muted text-center mb-5 mx-auto style="max-width: 600px;"
Then the content (cards, images, etc.) below.

### Card Design
- Background: white, border: 0 (use shadow for separation)
- Border-radius: rounded-3 (0.5rem)
- Shadow: shadow-sm at rest
- Padding: p-4 minimum
- Icon: inside bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3
- Equal height: h-100 on ALL cards in a row
- Grid: 3-column (col-md-4) with g-4 gap
- Hover effect handled by theme.scss

### Modern Patterns
- Hero: min-vh-75, gradient overlay rgba(0,0,0,0.55), centered content, display-3 heading
- Buttons: rounded-pill for ALL CTAs, px-4 py-2, btn-lg for hero
- Images: rounded-3, shadow, object-fit-cover, loading="lazy", meaningful alt text
`;

// =============================================================================
// SECTION TEMPLATES
// =============================================================================

const SECTION_TEMPLATES = `
## Image Placeholders by Industry
Use these Unsplash URLs for realistic placeholder images:
- Restaurant: https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80 (dining)
- Restaurant food: https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80
- Technology: https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80
- Legal: https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1920&q=80
- Healthcare: https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1920&q=80
- E-commerce: https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1920&q=80
- Generic: https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80 (office)

## Section Order (MUST follow — 7 sections minimum)
1. Hero (s_cover) — full-width background image with overlay, headline, dual CTA buttons
2. Stats/Trust Bar (s_numbers) — 3-4 metrics, overlapping hero by margin-top: -40px, bg-white shadow rounded-3
3. Features/Services (s_three_columns) — 3-column card grid with icon circles
4. About (s_image_text) — image + text side by side (row align-items-center g-5)
5. Testimonials (s_quotes_carousel) — 3 review cards with star ratings, initials circles, named reviewers
6. CTA (s_call_to_action) — dark or primary background, centered headline, single button
7. Footer (s_footer) — ALWAYS LAST — 4-column with brand, links, hours/info, contact

OPTIONAL additional sections (for 8+ section themes):
- How It Works (s_three_columns) — 3 numbered steps
- Gallery/Portfolio (s_images_wall) — image grid
- Team (s_three_columns) — 3 team member cards
- Pricing (s_three_columns) — 3 pricing tier cards
- FAQ (s_faq_collapse) — accordion with 4-6 questions

## Section Background Rhythm (MUST alternate)
Hero (o_cc1): dark overlay on image
Stats Bar (o_cc2): white, shadow-sm, elevated
Features (o_cc3): off-white (#f8f9fa) background
About (o_cc2): white
Testimonials (o_cc4): very light brand tint
CTA (o_cc1): dark or primary-colored background
Footer (o_cc5): dark (#0f172a or #2d2d2d)
RULE: NEVER two consecutive sections with the same background color

IMPORTANT: Every <section> MUST have class="o_cc o_ccN" and data-snippet="s_xxx".
The complete example in templates.xml above shows the exact pattern. Adapt content for the requested industry.
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

/** Template pattern for full mode - complete example Claude can follow */
const TEMPLATE_PATTERN_CODE = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="homepage_content" name="Homepage Content" inherit_id="website.homepage" customize_show="True">
    <xpath expr="//div[@id='wrap']" position="replace">
      <div id="wrap" class="oe_structure">
        <!-- HERO: Full-width with background image and overlay -->
        <section class="o_cc o_cc1 pt96 pb96" data-snippet="s_cover"
                 style="background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&amp;q=80') center/cover no-repeat; min-height: 75vh; display: flex; align-items: center;">
          <div class="container text-center text-white">
            <span class="badge bg-light text-primary mb-3 px-3 py-2 rounded-pill">Welcome to La Bella Cucina</span>
            <h1 class="display-3 fw-bold mb-4">Authentic Italian Dining Experience</h1>
            <p class="lead mb-4 mx-auto" style="max-width: 600px;">Handcrafted pasta, wood-fired pizzas, and the finest wines in a warm, inviting atmosphere.</p>
            <div class="d-flex gap-3 justify-content-center">
              <a href="/contactus" class="btn btn-primary btn-lg rounded-pill px-4">Reserve a Table</a>
              <a href="#menu" class="btn btn-outline-light btn-lg rounded-pill px-4">View Menu</a>
            </div>
          </div>
        </section>

        <!-- STATS/TRUST BAR: overlapping hero, creates visual depth -->
        <section class="o_cc o_cc2 py-4" data-snippet="s_numbers"
                 style="margin-top: -40px; position: relative; z-index: 10;">
          <div class="container">
            <div class="bg-white rounded-3 shadow p-4">
              <div class="row text-center g-4">
                <div class="col-md-3">
                  <h3 class="fw-bold mb-0 text-primary">537+</h3>
                  <small class="text-muted text-uppercase" style="letter-spacing: 0.1em; font-size: 0.7rem;">Happy Customers</small>
                </div>
                <div class="col-md-3">
                  <h3 class="fw-bold mb-0 text-primary">15</h3>
                  <small class="text-muted text-uppercase" style="letter-spacing: 0.1em; font-size: 0.7rem;">Years Experience</small>
                </div>
                <div class="col-md-3">
                  <h3 class="fw-bold mb-0 text-primary">4.9/5</h3>
                  <small class="text-muted text-uppercase" style="letter-spacing: 0.1em; font-size: 0.7rem;">Average Rating</small>
                </div>
                <div class="col-md-3">
                  <h3 class="fw-bold mb-0 text-primary">24/7</h3>
                  <small class="text-muted text-uppercase" style="letter-spacing: 0.1em; font-size: 0.7rem;">Support Available</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- FEATURES/SERVICES: 3-column card grid -->
        <section class="o_cc o_cc3 pt64 pb64" data-snippet="s_three_columns">
          <div class="container">
            <h2 class="text-center fw-bold mb-2">Why Choose Us</h2>
            <p class="text-center text-muted mb-5 mx-auto" style="max-width: 600px;">Three generations of culinary excellence</p>
            <div class="row g-4">
              <div class="col-md-4">
                <div class="card border-0 shadow-sm h-100 rounded-3">
                  <div class="card-body p-4 text-center">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
                      <i class="fa fa-leaf text-primary fs-4"></i>
                    </div>
                    <h5 class="fw-bold">Fresh Ingredients</h5>
                    <p class="text-muted mb-0">Locally sourced produce and imported Italian specialties, delivered fresh daily.</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border-0 shadow-sm h-100 rounded-3">
                  <div class="card-body p-4 text-center">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
                      <i class="fa fa-utensils text-primary fs-4"></i>
                    </div>
                    <h5 class="fw-bold">Master Chefs</h5>
                    <p class="text-muted mb-0">Our chefs trained in Italy bring authentic recipes passed down through generations.</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border-0 shadow-sm h-100 rounded-3">
                  <div class="card-body p-4 text-center">
                    <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
                      <i class="fa fa-wine-glass text-primary fs-4"></i>
                    </div>
                    <h5 class="fw-bold">Fine Wine Selection</h5>
                    <p class="text-muted mb-0">Over 200 wines curated from the best vineyards across Italy and the world.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ABOUT / IMAGE + TEXT -->
        <section class="o_cc o_cc3 pt64 pb64" data-snippet="s_image_text">
          <div class="container">
            <div class="row align-items-center g-5">
              <div class="col-md-6">
                <img loading="lazy" class="img-fluid rounded-3 shadow" src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&amp;q=80" alt="Signature dish" />
              </div>
              <div class="col-md-6">
                <span class="badge bg-primary bg-opacity-10 text-primary mb-3 px-3 py-2 rounded-pill">Our Story</span>
                <h2 class="fw-bold mb-3">A Taste of Italy Since 1985</h2>
                <p class="text-muted mb-4">Founded by the Rossi family, La Bella Cucina brings the warmth and flavors of Tuscany to your table. Every dish tells a story of tradition, passion, and the finest ingredients.</p>
                <a href="/about" class="btn btn-primary rounded-pill px-4">Learn More</a>
              </div>
            </div>
          </div>
        </section>

        <!-- TESTIMONIALS -->
        <section class="o_cc o_cc4 pt64 pb64" data-snippet="s_quotes_carousel">
          <div class="container">
            <h2 class="text-center fw-bold mb-5">What Our Guests Say</h2>
            <div class="row g-4">
              <div class="col-md-4">
                <div class="card border-0 shadow-sm h-100 rounded-3">
                  <div class="card-body p-4">
                    <div class="text-warning mb-3">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                    <p class="mb-4">"The best Italian food outside of Rome. The homemade pasta is absolutely divine!"</p>
                    <div class="d-flex align-items-center">
                      <div class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center me-3" style="width:48px;height:48px;"><span class="fw-bold text-primary">SM</span></div>
                      <div><h6 class="mb-0 fw-bold">Sarah M.</h6><small class="text-muted">Regular Guest</small></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border-0 shadow-sm h-100 rounded-3">
                  <div class="card-body p-4">
                    <div class="text-warning mb-3">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                    <p class="mb-4">"Perfect for date night. The ambiance, wine selection, and tiramisu are unforgettable."</p>
                    <div class="d-flex align-items-center">
                      <div class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center me-3" style="width:48px;height:48px;"><span class="fw-bold text-primary">JR</span></div>
                      <div><h6 class="mb-0 fw-bold">James R.</h6><small class="text-muted">Food Blogger</small></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border-0 shadow-sm h-100 rounded-3">
                  <div class="card-body p-4">
                    <div class="text-warning mb-3">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                    <p class="mb-4">"We hosted our anniversary here. Exceptional service and the chef's tasting menu was incredible."</p>
                    <div class="d-flex align-items-center">
                      <div class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center me-3" style="width:48px;height:48px;"><span class="fw-bold text-primary">EL</span></div>
                      <div><h6 class="mb-0 fw-bold">Elena L.</h6><small class="text-muted">Anniversary Dinner</small></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- CTA -->
        <section class="o_cc o_cc5 pt64 pb64" data-snippet="s_call_to_action" style="background-color: var(--primary, #c9302c);">
          <div class="container text-center text-white py-4">
            <h2 class="fw-bold mb-3">Ready for an Unforgettable Evening?</h2>
            <p class="mb-4 opacity-75 mx-auto" style="max-width: 500px;">Reserve your table today and experience the magic of authentic Italian cuisine.</p>
            <a href="/contactus" class="btn btn-light btn-lg rounded-pill px-5">Make a Reservation</a>
          </div>
        </section>

        <!-- FOOTER: Always last section -->
        <section class="o_cc o_cc5 pt48 pb32" data-snippet="s_footer" style="background-color: #2d2d2d;">
          <div class="container text-white">
            <div class="row g-4">
              <div class="col-md-4">
                <h5 class="fw-bold mb-3">La Bella Cucina</h5>
                <p class="opacity-75 mb-0">Authentic Italian dining since 1985. Handcrafted pasta, wood-fired pizzas, and the finest wines.</p>
              </div>
              <div class="col-md-2">
                <h6 class="fw-bold mb-3">Quick Links</h6>
                <ul class="list-unstyled">
                  <li class="mb-2"><a href="/" class="text-white-50 text-decoration-none">Home</a></li>
                  <li class="mb-2"><a href="/menu" class="text-white-50 text-decoration-none">Menu</a></li>
                  <li class="mb-2"><a href="/about" class="text-white-50 text-decoration-none">About</a></li>
                  <li class="mb-2"><a href="/contactus" class="text-white-50 text-decoration-none">Contact</a></li>
                </ul>
              </div>
              <div class="col-md-3">
                <h6 class="fw-bold mb-3">Hours</h6>
                <ul class="list-unstyled opacity-75">
                  <li class="mb-1">Mon-Thu: 11am - 10pm</li>
                  <li class="mb-1">Fri-Sat: 11am - 11pm</li>
                  <li class="mb-1">Sunday: 12pm - 9pm</li>
                </ul>
              </div>
              <div class="col-md-3">
                <h6 class="fw-bold mb-3">Contact</h6>
                <ul class="list-unstyled opacity-75">
                  <li class="mb-1">123 Main Street, Anytown</li>
                  <li class="mb-1">+1 (555) 123-4567</li>
                  <li class="mb-1">info@labellacucina.com</li>
                </ul>
              </div>
            </div>
            <hr class="my-4 opacity-25" />
            <p class="text-white-50 text-center mb-0">© 2024 La Bella Cucina. All rights reserved.</p>
          </div>
        </section>
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

const BOOTSTRAP_OVERRIDDEN_CODE = `// Bootstrap variable overrides
// Loaded BEFORE Bootstrap compiles (web._assets_frontend_helpers, prepend)
// Every declaration MUST have !default flag

// Border radius scale
$border-radius-sm: 0.25rem !default;
$border-radius: 0.5rem !default;
$border-radius-lg: 0.75rem !default;
$border-radius-xl: 1rem !default;

// Button radius (pill by default for CTAs)
$btn-border-radius: 10rem !default;
$btn-border-radius-sm: 10rem !default;
$btn-border-radius-lg: 10rem !default;

// Card styling
$card-border-width: 0 !default;
$card-border-radius: 0.75rem !default;

// Layered shadow system (2-layer for realistic depth)
$box-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.1) !default;
$box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1) !default;
$box-shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !default;

// Focus ring
$focus-ring-width: 0.2rem !default;
$focus-ring-opacity: 0.25 !default;`;

const THEME_SCSS_CODE = `// Custom theme styles (web.assets_frontend)
// NO body{}, NO :root{}, NO font-family, NO .container{}

// --- Hero Section ---
section[data-snippet="s_cover"] {
  min-height: 75vh;
  display: flex;
  align-items: center;
  background-size: cover;
  background-position: center;
}

// --- Card Elevation System ---
.card {
  border-radius: 0.75rem;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
                0 8px 10px -6px rgba(0, 0, 0, 0.1);
  }
}

// --- Button Polish ---
.btn {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  &:hover { transform: translateY(-1px); }
  &:active { transform: translateY(0); }
}

// --- Image Hover Zoom ---
.img-hover-zoom {
  overflow: hidden;
  border-radius: 0.5rem;
  img { transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
  &:hover img { transform: scale(1.05); }
}

// --- Accent Line ---
.accent-line {
  display: block;
  width: 48px;
  height: 3px;
  border-radius: 2px;
  background-color: var(--o-color-1, currentColor);
  margin-bottom: 1rem;
  &.accent-line-center { margin-left: auto; margin-right: auto; }
}

// --- Font Smoothing (scoped to sections, not body) ---
.o_cc {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

// --- Focus Ring ---
*:focus-visible {
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.25);
  border-radius: inherit;
}

// --- Reduced Motion Support ---
@media (prefers-reduced-motion: reduce) {
  .card, .btn, .img-hover-zoom img {
    transition: none !important;
  }
  .card:hover { transform: none !important; }
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
- NO Tailwind-only classes (no "flex", "items-center", "bg-blue-500", "w-full", "gap-2", "rounded-lg" etc.)
- USE Bootstrap 5 equivalents: d-flex, align-items-center, bg-primary, w-100, gap-2, rounded-3
- Bootstrap classes like text-center, p-4, py-5, fw-bold, mb-3 ARE correct — use them
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
  WRONG: <div class="flex items-center gap-2 bg-blue-500 rounded-lg">  ← Tailwind
  RIGHT: <div class="d-flex align-items-center gap-2 bg-primary rounded-3">  ← Bootstrap 5
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

/** Visual quality rubric — what separates amateur from professional */
const VISUAL_QUALITY_RUBRIC = `## VISUAL QUALITY RUBRIC (CRITICAL — follow every point)

### Hero Section (MOST IMPORTANT — first impression)
- MUST have a full-width background image with dark gradient overlay:
  style="background: linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('UNSPLASH_URL') center/cover no-repeat; min-height: 75vh; display: flex; align-items: center;"
- White text on the overlay: text-white, display-3 fw-bold heading
- Badge/label above headline: <span class="badge bg-light text-primary mb-3 px-3 py-2 rounded-pill">
- Two CTA buttons side by side: d-flex gap-3 justify-content-center
- NEVER a plain white/blank hero — always has a background image

### Cards & Grids
- Every card MUST have: class="card border-0 shadow-sm h-100 rounded-3"
- Card hover: transform translateY(-4px) + shadow increase (handled by theme.scss)
- Icon circles above card titles: <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3"><i class="fa fa-icon text-primary fs-4"></i></div>
- Grid: <div class="row g-4"> with <div class="col-md-4"> (3 items minimum)

### Typography Hierarchy
- Hero: display-3 fw-bold (3rem, line-height 1.1)
- Section headings: fw-bold text-center mb-2 (2.25rem)
- Section subtitles: text-center text-muted mb-5 mx-auto style="max-width: 600px;"
- Card titles: h5 fw-bold
- Body text: text-muted mb-0

### Section Rhythm & Spacing
- Alternate section backgrounds: white → off-white (o_cc1 → o_cc2 → o_cc1 → ...)
- Hero padding: pt96 pb96 (6rem)
- Content sections: pt64 pb64 (4rem)
- CTA/Footer: pt48 pb32 or pt64 pb64
- Every section heading MUST have a subtitle paragraph beneath it

### Color & Contrast
- 60% white/light backgrounds (o_cc1, o_cc2)
- 30% subtle tints (o_cc3, o_cc4)
- 10% bold accent (primary buttons, icon circles, CTA background)
- Dark section (o_cc5) for footer with white text

### Testimonials
- Star ratings: <div class="text-warning mb-3">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
- Avatar circles: <div class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center me-3" style="width:48px;height:48px;"><span class="fw-bold text-primary">SM</span></div>
- Named reviewers with role: <h6 class="mb-0 fw-bold">Sarah M.</h6><small class="text-muted">Regular Guest</small>`;

/** Content quality rules — anti-generic content */
const CONTENT_QUALITY_RULES = `## CONTENT QUALITY (ZERO TOLERANCE for generic content)

### FORBIDDEN generic text (will be rejected):
- NEVER use: "Welcome to our website", "Lorem ipsum", "Your Company"
- NEVER use: "Service 1", "Service 2", "Feature Title", "Product Name"
- NEVER use: "Learn More" on every button (vary: "Get Started", "Book Now", "View Menu", etc.)
- NEVER use: "Description text here", "Some text about...", "[placeholder]"

### REQUIRED content quality:
- Headlines must be SPECIFIC to the industry: "Authentic Italian Dining Since 1985" not "Welcome"
- Services/features must have REAL names: "Family Law", "Tax Planning", "Pasta Fresca" not "Service 1"
- Stats must use BELIEVABLE specific numbers: "537 cases won", "28 years", "4.9/5 rating" not "500+"
- Testimonials must have NAMED people with roles: "Sarah M., Regular Guest" not "Customer 1"
- CTA verbs must match the industry: "Reserve a Table", "Schedule Consultation", "Start Free Trial"
- Footer must have: business name, address, phone, email, hours (for local businesses)
- Each section must have 3-5 COMPLETE sentences of real industry content, not 1-line placeholders`;

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
You build STUNNING, eye-catching, production-grade website themes that look like they were designed by a top agency.
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

  // ---- VISUAL QUALITY FIRST (high salience = AI prioritizes these) ----
  if (!compact) {
    parts.push(DESIGN_SYSTEM);
    parts.push(SECTION_TEMPLATES);
    parts.push(VISUAL_QUALITY_RUBRIC);
    parts.push(CONTENT_QUALITY_RULES);
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

  // For compact prompt (Ollama): replace example colors/fonts in the BASE template
  // BEFORE appending project context, so user's actual colors don't get corrupted
  // when they overlap with example colors (e.g., user primary=#8b4513 = example secondary).
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
      // Replace ALL example colors simultaneously to avoid cascade corruption.
      const colorMap: Record<string, string> = {
        '#c9302c': colors.primary,
        '#8b4513': colors.secondary || '#8b4513',
        '#d4a373': colors.accent || '#d4a373',
        '#fefae0': colors.background || '#fefae0',
        '#2d2d2d': colors.text || '#2d2d2d',
      };
      const colorPattern = new RegExp(
        Object.keys(colorMap).map(k => k.replace('#', '\\#')).join('|'),
        'gi'
      );
      prompt = prompt.replace(colorPattern, (match) => colorMap[match.toLowerCase()] || match);
    }

    if (preset) {
      // Replace hardcoded example fonts
      prompt = prompt.replace(/Playfair Display/g, preset.typography.headingFamily);
      prompt = prompt.replace(/Lato/g, preset.typography.bodyFamily);
    }
  }

  // Append context AFTER template replacement so user's actual colors aren't corrupted
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

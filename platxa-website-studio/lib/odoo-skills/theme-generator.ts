/**
 * Odoo Theme Generator
 *
 * Production-grade theme generation with complete file structure,
 * proper Odoo 18 conventions, and industry-specific presets.
 */

import type {
  ThemeConfig,
  ColorPalette,
  Typography,
  ThemeFeatures,
  PageConfig,
  GeneratedFile,
  ThemeGenerationResult,
  Industry,
  DesignStyle,
  IndustryPreset,
} from "./types";

// Re-export types that consumers need
export type { ThemeConfig, Industry, IndustryPreset, ColorPalette, Typography };

// =============================================================================
// INDUSTRY PRESETS
// =============================================================================

export const INDUSTRY_PRESETS: Record<Industry, IndustryPreset> = {
  restaurant: {
    industry: "restaurant",
    name: "Restaurant & Food",
    description: "Warm, inviting design for restaurants and cafes",
    colors: {
      primary: "#c9302c",
      secondary: "#8b4513",
      accent: "#d4a373",
      background: "#fefae0",
      surface: "#ffffff",
      text: "#1a1a1a",
      textMuted: "#6b7280",
      border: "#e5e7eb",
      success: "#059669",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFamily: "Playfair Display",
      bodyFamily: "Lato",
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.25,
    },
    suggestedSections: ["hero", "menu", "about", "gallery", "testimonials", "reservation", "location", "footer"],
    features: { stickyHeader: true, smoothScroll: true, animations: true },
  },

  technology: {
    industry: "technology",
    name: "Technology & SaaS",
    description: "Clean, modern design for tech companies",
    colors: {
      primary: "#2563eb",
      secondary: "#7c3aed",
      accent: "#06b6d4",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#0f172a",
      textMuted: "#64748b",
      border: "#e2e8f0",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFamily: "Inter",
      bodyFamily: "Inter",
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.2,
    },
    suggestedSections: ["hero", "features", "pricing", "testimonials", "integrations", "faq", "cta", "footer"],
    features: { stickyHeader: true, darkMode: true, animations: true, smoothScroll: true },
  },

  legal: {
    industry: "legal",
    name: "Law & Legal Services",
    description: "Professional, trustworthy design for law firms",
    colors: {
      primary: "#1e3a5f",
      secondary: "#c9a227",
      accent: "#2d4a6f",
      background: "#f7f7f7",
      surface: "#ffffff",
      text: "#1a1a1a",
      textMuted: "#6b7280",
      border: "#d1d5db",
      success: "#059669",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFamily: "Merriweather",
      bodyFamily: "Source Sans Pro",
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.25,
    },
    suggestedSections: ["hero", "practice-areas", "attorneys", "case-results", "testimonials", "contact", "footer"],
    features: { stickyHeader: true, smoothScroll: true },
  },

  healthcare: {
    industry: "healthcare",
    name: "Healthcare & Medical",
    description: "Calming, professional design for healthcare providers",
    colors: {
      primary: "#0d9488",
      secondary: "#0284c7",
      accent: "#14b8a6",
      background: "#f0fdfa",
      surface: "#ffffff",
      text: "#134e4a",
      textMuted: "#64748b",
      border: "#ccfbf1",
      success: "#059669",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFamily: "Nunito",
      bodyFamily: "Open Sans",
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.2,
    },
    suggestedSections: ["hero", "services", "doctors", "testimonials", "appointment", "insurance", "footer"],
    features: { stickyHeader: true, smoothScroll: true, cookieConsent: true },
  },

  ecommerce: {
    industry: "ecommerce",
    name: "E-commerce & Retail",
    description: "Conversion-focused design for online stores",
    colors: {
      primary: "#7c3aed",
      secondary: "#ec4899",
      accent: "#f59e0b",
      background: "#faf5ff",
      surface: "#ffffff",
      text: "#1f2937",
      textMuted: "#6b7280",
      border: "#e5e7eb",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFamily: "Poppins",
      bodyFamily: "Poppins",
      headingWeight: 600,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.2,
    },
    suggestedSections: ["hero", "categories", "featured-products", "deals", "testimonials", "newsletter", "footer"],
    features: { stickyHeader: true, animations: true, lazyLoading: true },
  },

  education: {
    industry: "education",
    name: "Education & Learning",
    description: "Friendly, accessible design for educational institutions",
    colors: {
      primary: "#4f46e5",
      secondary: "#0891b2",
      accent: "#f97316",
      background: "#f5f5ff",
      surface: "#ffffff",
      text: "#1e1b4b",
      textMuted: "#64748b",
      border: "#e0e7ff",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFamily: "Nunito",
      bodyFamily: "Nunito",
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.2,
    },
    suggestedSections: ["hero", "programs", "features", "instructors", "testimonials", "enrollment", "footer"],
    features: { stickyHeader: true, smoothScroll: true, animations: true },
  },

  realestate: {
    industry: "realestate",
    name: "Real Estate & Property",
    description: "Elegant design for real estate agencies",
    colors: {
      primary: "#0f766e",
      secondary: "#b45309",
      accent: "#14b8a6",
      background: "#f7f9f9",
      surface: "#ffffff",
      text: "#134e4a",
      textMuted: "#64748b",
      border: "#d1d5db",
      success: "#059669",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFamily: "Cormorant Garamond",
      bodyFamily: "Montserrat",
      headingWeight: 600,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.25,
    },
    suggestedSections: ["hero", "search", "featured-properties", "services", "agents", "testimonials", "footer"],
    features: { stickyHeader: true, smoothScroll: true, lazyLoading: true },
  },

  fitness: {
    industry: "fitness",
    name: "Fitness & Wellness",
    description: "Energetic design for gyms and fitness studios",
    colors: {
      primary: "#dc2626",
      secondary: "#1f2937",
      accent: "#f59e0b",
      background: "#fafafa",
      surface: "#ffffff",
      text: "#111827",
      textMuted: "#6b7280",
      border: "#e5e7eb",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#dc2626",
    },
    typography: {
      headingFamily: "Oswald",
      bodyFamily: "Roboto",
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.25,
    },
    suggestedSections: ["hero", "classes", "trainers", "schedule", "pricing", "testimonials", "contact", "footer"],
    features: { stickyHeader: true, animations: true, smoothScroll: true },
  },

  creative: {
    industry: "creative",
    name: "Creative & Portfolio",
    description: "Bold, artistic design for creative professionals",
    colors: {
      primary: "#be185d",
      secondary: "#7c3aed",
      accent: "#06b6d4",
      background: "#fdf4ff",
      surface: "#ffffff",
      text: "#1f2937",
      textMuted: "#6b7280",
      border: "#f3e8ff",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFamily: "Space Grotesk",
      bodyFamily: "DM Sans",
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.333,
    },
    suggestedSections: ["hero", "portfolio", "services", "about", "process", "testimonials", "contact", "footer"],
    features: { animations: true, smoothScroll: true, lazyLoading: true },
  },

  nonprofit: {
    industry: "nonprofit",
    name: "Nonprofit & Charity",
    description: "Compassionate design for charitable organizations",
    colors: {
      primary: "#0891b2",
      secondary: "#059669",
      accent: "#f97316",
      background: "#ecfeff",
      surface: "#ffffff",
      text: "#164e63",
      textMuted: "#64748b",
      border: "#cffafe",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFamily: "Nunito",
      bodyFamily: "Open Sans",
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.2,
    },
    suggestedSections: ["hero", "mission", "impact", "programs", "stories", "donate", "volunteer", "footer"],
    features: { stickyHeader: true, smoothScroll: true, socialLinks: true },
  },

  generic: {
    industry: "generic",
    name: "Generic Business",
    description: "Versatile design for any business type",
    colors: {
      primary: "#2563eb",
      secondary: "#64748b",
      accent: "#10b981",
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#e2e8f0",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFamily: "Inter",
      bodyFamily: "Inter",
      headingWeight: 700,
      bodyWeight: 400,
      baseSize: "16px",
      scale: 1.2,
    },
    suggestedSections: ["hero", "features", "about", "services", "testimonials", "cta", "footer"],
    features: { stickyHeader: true, smoothScroll: true },
  },
};

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_FEATURES: ThemeFeatures = {
  stickyHeader: true,
  promoBar: false,
  megaMenu: false,
  darkMode: false,
  animations: true,
  lazyLoading: true,
  smoothScroll: true,
  backToTop: true,
  cookieConsent: false,
  socialLinks: true,
};

export function getDefaultThemeConfig(name: string, industry: Industry = "generic"): ThemeConfig {
  const preset = INDUSTRY_PRESETS[industry];
  const themeName = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

  return {
    name: `theme_${themeName}`,
    displayName: name,
    description: `${preset.description} - Generated by Platxa`,
    version: "18.0.1.0.0",
    author: "Platxa",
    website: "https://platxa.com",
    license: "LGPL-3",
    industry,
    designStyle: "modern",
    colors: preset.colors,
    typography: preset.typography,
    features: { ...DEFAULT_FEATURES, ...preset.features },
    pages: [],
    snippets: [],
  };
}

// =============================================================================
// FILE GENERATORS
// =============================================================================

/**
 * Generate __manifest__.py
 */
function generateManifest(config: ThemeConfig): string {
  const dataFiles = [
    "views/layout.xml",
    "views/pages.xml",
    "views/snippets.xml",
  ];

  if (config.features.cookieConsent) {
    dataFiles.push("views/cookie_consent.xml");
  }

  return `# -*- coding: utf-8 -*-
{
    'name': '${config.displayName}',
    'version': '${config.version}',
    'category': 'Website/Theme',
    'summary': '${config.description}',
    'description': """
${config.displayName}
${"=".repeat(config.displayName.length)}

${config.description}

Features:
- Industry: ${config.industry}
- Design Style: ${config.designStyle}
- Responsive design
- Bootstrap 5.3 compatible
- Odoo 18 ready

Generated by Platxa Website Studio
    """,
    'author': '${config.author}',
    'website': '${config.website}',
    'license': '${config.license}',
    'depends': [
        'website',
    ],
    'data': [
${dataFiles.map((f) => `        '${f}',`).join("\n")}
    ],
    'assets': {
        'web._assets_primary_variables': [
            ('prepend', '${config.name}/static/src/scss/primary_variables.scss'),
        ],
        'web._assets_frontend_helpers': [
            ('prepend', '${config.name}/static/src/scss/bootstrap_overridden.scss'),
        ],
        'web.assets_frontend': [
            '${config.name}/static/src/scss/theme.scss',
            '${config.name}/static/src/js/theme.js',
        ],
    },
    'images': [
        'static/description/banner.png',
        'static/description/icon.png',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}
`;
}

/**
 * Generate primary_variables.scss
 */
function generatePrimaryVariables(config: ThemeConfig): string {
  const { colors, typography } = config;

  return `// =============================================================================
// ${config.displayName} - Primary Variables
// Odoo 18 Theme Variables
// =============================================================================

// -----------------------------------------------------------------------------
// Color Palette Definition
// -----------------------------------------------------------------------------

$o-color-palettes: map-merge($o-color-palettes, (
    '${config.name}': (
        'o-color-1': ${colors.primary},      // Primary brand color
        'o-color-2': ${colors.secondary},    // Secondary color
        'o-color-3': ${colors.background},   // Light background
        'o-color-4': ${colors.surface},      // Surface/card background
        'o-color-5': ${colors.text},         // Dark text
    ),
));

// Set as default palette
$o-selected-color-palettes-names: append($o-selected-color-palettes-names, '${config.name}');

// -----------------------------------------------------------------------------
// Extended Color Variables
// -----------------------------------------------------------------------------

$theme-colors: (
    "primary": ${colors.primary},
    "secondary": ${colors.secondary},
    "accent": ${colors.accent},
    "success": ${colors.success},
    "warning": ${colors.warning},
    "danger": ${colors.error},
    "light": ${colors.background},
    "dark": ${colors.text},
);

// -----------------------------------------------------------------------------
// Typography Configuration
// -----------------------------------------------------------------------------

$o-theme-font-configs: (
    'heading': (
        'family': '${typography.headingFamily}',
        'url': 'https://fonts.googleapis.com/css2?family=${typography.headingFamily.replace(/ /g, "+")}:wght@400;500;600;700&display=swap',
    ),
    'body': (
        'family': '${typography.bodyFamily}',
        'url': 'https://fonts.googleapis.com/css2?family=${typography.bodyFamily.replace(/ /g, "+")}:wght@300;400;500;600&display=swap',
    ),
);

// Typography scale
$font-size-base: ${typography.baseSize};
$h1-font-size: $font-size-base * ${Math.pow(typography.scale, 4).toFixed(3)};
$h2-font-size: $font-size-base * ${Math.pow(typography.scale, 3).toFixed(3)};
$h3-font-size: $font-size-base * ${Math.pow(typography.scale, 2).toFixed(3)};
$h4-font-size: $font-size-base * ${typography.scale.toFixed(3)};
$h5-font-size: $font-size-base;
$h6-font-size: $font-size-base * 0.875;

// Heading weights
$headings-font-weight: ${typography.headingWeight};
`;
}

/**
 * Generate bootstrap_overridden.scss
 */
function generateBootstrapOverrides(config: ThemeConfig): string {
  return `// =============================================================================
// ${config.displayName} - Bootstrap Overrides
// =============================================================================

// -----------------------------------------------------------------------------
// Border Radius
// -----------------------------------------------------------------------------
$border-radius: 0.5rem;
$border-radius-sm: 0.375rem;
$border-radius-lg: 0.75rem;
$border-radius-xl: 1rem;
$border-radius-pill: 50rem;

// -----------------------------------------------------------------------------
// Shadows
// -----------------------------------------------------------------------------
$box-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
$box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
$box-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);

// -----------------------------------------------------------------------------
// Transitions
// -----------------------------------------------------------------------------
$transition-base: all 0.2s ease-in-out;
$transition-fade: opacity 0.15s linear;
$transition-collapse: height 0.35s ease;

// -----------------------------------------------------------------------------
// Spacing
// -----------------------------------------------------------------------------
$spacer: 1rem;
$spacers: (
    0: 0,
    1: $spacer * 0.25,
    2: $spacer * 0.5,
    3: $spacer,
    4: $spacer * 1.5,
    5: $spacer * 3,
    6: $spacer * 4,
    7: $spacer * 5,
);

// -----------------------------------------------------------------------------
// Container
// -----------------------------------------------------------------------------
$container-max-widths: (
    sm: 540px,
    md: 720px,
    lg: 960px,
    xl: 1140px,
    xxl: 1320px,
);

// -----------------------------------------------------------------------------
// Buttons
// -----------------------------------------------------------------------------
$btn-padding-y: 0.625rem;
$btn-padding-x: 1.25rem;
$btn-font-weight: 500;
$btn-border-radius: $border-radius;
$btn-border-radius-lg: $border-radius-lg;

// -----------------------------------------------------------------------------
// Cards
// -----------------------------------------------------------------------------
$card-border-radius: $border-radius-lg;
$card-border-width: 0;
$card-box-shadow: $box-shadow;

// -----------------------------------------------------------------------------
// Navbar
// -----------------------------------------------------------------------------
$navbar-padding-y: 1rem;
$navbar-nav-link-padding-x: 1rem;
`;
}

/**
 * Generate theme.scss
 */
function generateThemeScss(config: ThemeConfig): string {
  const { colors, features } = config;

  return `// =============================================================================
// ${config.displayName} - Theme Styles
// =============================================================================

// -----------------------------------------------------------------------------
// Base Styles
// -----------------------------------------------------------------------------

html {
    ${features.smoothScroll ? "scroll-behavior: smooth;" : ""}
}

body {
    color: ${colors.text};
    background-color: ${colors.background};
}

// Section scroll offset for sticky header
section {
    scroll-margin-top: ${features.stickyHeader ? "80px" : "0"};
}

// -----------------------------------------------------------------------------
// Typography Enhancements
// -----------------------------------------------------------------------------

h1, h2, h3, h4, h5, h6 {
    color: ${colors.text};
}

.text-muted {
    color: ${colors.textMuted} !important;
}

a {
    color: ${colors.primary};
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
        color: darken(${colors.primary}, 10%);
    }
}

// -----------------------------------------------------------------------------
// Button Styles
// -----------------------------------------------------------------------------

.btn {
    transition: all 0.2s ease;
    font-weight: 500;

    &:hover {
        transform: translateY(-1px);
    }

    &:active {
        transform: translateY(0);
    }
}

.btn-primary {
    background-color: ${colors.primary};
    border-color: ${colors.primary};

    &:hover {
        background-color: darken(${colors.primary}, 8%);
        border-color: darken(${colors.primary}, 8%);
    }
}

.btn-outline-primary {
    color: ${colors.primary};
    border-color: ${colors.primary};

    &:hover {
        background-color: ${colors.primary};
        border-color: ${colors.primary};
    }
}

// -----------------------------------------------------------------------------
// Card Styles
// -----------------------------------------------------------------------------

.card {
    border: none;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    background-color: ${colors.surface};

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
}

// -----------------------------------------------------------------------------
// Section Styles
// -----------------------------------------------------------------------------

.section-padding {
    padding-top: 5rem;
    padding-bottom: 5rem;

    @media (max-width: 768px) {
        padding-top: 3rem;
        padding-bottom: 3rem;
    }
}

.section-title {
    margin-bottom: 3rem;
    text-align: center;

    h2 {
        font-weight: 700;
        margin-bottom: 1rem;
    }

    p {
        color: ${colors.textMuted};
        max-width: 600px;
        margin: 0 auto;
    }
}

// -----------------------------------------------------------------------------
// Header Styles
// -----------------------------------------------------------------------------

#wrapwrap > header {
    ${features.stickyHeader ? `
    position: sticky;
    top: 0;
    z-index: 1030;
    background-color: ${colors.surface};
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    ` : ""}
}

// -----------------------------------------------------------------------------
// Footer Styles
// -----------------------------------------------------------------------------

footer {
    background-color: ${colors.text};
    color: rgba(255, 255, 255, 0.8);

    h5, h6 {
        color: #ffffff;
    }

    a {
        color: rgba(255, 255, 255, 0.7);

        &:hover {
            color: #ffffff;
        }
    }
}

// -----------------------------------------------------------------------------
// Utility Classes
// -----------------------------------------------------------------------------

.hover-lift {
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
    }
}

.img-hover-zoom {
    overflow: hidden;

    img {
        transition: transform 0.5s ease;
    }

    &:hover img {
        transform: scale(1.05);
    }
}

${features.animations ? `
// -----------------------------------------------------------------------------
// Animations
// -----------------------------------------------------------------------------

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.animate-fade-in-up {
    animation: fadeInUp 0.6s ease forwards;
}
` : ""}

${features.backToTop ? `
// -----------------------------------------------------------------------------
// Back to Top Button
// -----------------------------------------------------------------------------

.back-to-top {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 48px;
    height: 48px;
    background-color: ${colors.primary};
    color: #ffffff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
    z-index: 1000;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

    &.visible {
        opacity: 1;
        visibility: visible;
    }

    &:hover {
        background-color: darken(${colors.primary}, 10%);
        transform: translateY(-2px);
    }
}
` : ""}
`;
}

/**
 * Generate theme.js
 */
function generateThemeJs(config: ThemeConfig): string {
  const { features } = config;

  return `/** @odoo-module **/
/**
 * ${config.displayName} - Theme JavaScript
 */

import publicWidget from "@web/legacy/js/public/public_widget";

${features.backToTop ? `
// =============================================================================
// Back to Top Button
// =============================================================================

publicWidget.registry.BackToTop = publicWidget.Widget.extend({
    selector: '.back-to-top',
    events: {
        'click': '_onClick',
    },

    start() {
        this._super(...arguments);
        this._setupScrollListener();
        return Promise.resolve();
    },

    _setupScrollListener() {
        const threshold = 300;
        window.addEventListener('scroll', () => {
            if (window.scrollY > threshold) {
                this.el.classList.add('visible');
            } else {
                this.el.classList.remove('visible');
            }
        });
    },

    _onClick(ev) {
        ev.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    },
});
` : ""}

${features.animations ? `
// =============================================================================
// Scroll Animations
// =============================================================================

publicWidget.registry.ScrollAnimations = publicWidget.Widget.extend({
    selector: '#wrapwrap',

    start() {
        this._super(...arguments);
        this._setupIntersectionObserver();
        return Promise.resolve();
    },

    _setupIntersectionObserver() {
        const elements = document.querySelectorAll('.animate-on-scroll');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in-up');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px',
        });

        elements.forEach((el) => observer.observe(el));
    },
});
` : ""}

${features.stickyHeader ? `
// =============================================================================
// Sticky Header Enhancement
// =============================================================================

publicWidget.registry.StickyHeader = publicWidget.Widget.extend({
    selector: '#wrapwrap > header',

    start() {
        this._super(...arguments);
        this._setupScrollEffect();
        return Promise.resolve();
    },

    _setupScrollEffect() {
        let lastScroll = 0;

        window.addEventListener('scroll', () => {
            const currentScroll = window.scrollY;

            if (currentScroll > 100) {
                this.el.classList.add('header-scrolled');
            } else {
                this.el.classList.remove('header-scrolled');
            }

            lastScroll = currentScroll;
        });
    },
});
` : ""}

export default {};
`;
}

/**
 * Generate layout.xml
 */
function generateLayoutXml(config: ThemeConfig): string {
  const { features } = config;

  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- =====================================================================
         ${config.displayName} - Layout Customization
         ===================================================================== -->

    <!-- Inherit website layout -->
    <template id="layout" inherit_id="website.layout" name="${config.displayName} Layout">
        <!-- Add theme class to body -->
        <xpath expr="//body" position="attributes">
            <attribute name="class" add="theme-${config.name.replace("theme_", "")}" separator=" "/>
        </xpath>

        ${features.stickyHeader ? `
        <!-- Sticky header support -->
        <xpath expr="//header" position="attributes">
            <attribute name="class" add="sticky-header" separator=" "/>
        </xpath>
        ` : ""}

        ${features.backToTop ? `
        <!-- Back to top button -->
        <xpath expr="//div[@id='wrapwrap']" position="inside">
            <div class="back-to-top">
                <i class="fa fa-chevron-up"></i>
            </div>
        </xpath>
        ` : ""}
    </template>

    ${features.promoBar ? `
    <!-- Promo bar template -->
    <template id="promo_bar" name="Promo Bar">
        <div class="promo-bar bg-primary text-white text-center py-2">
            <div class="container">
                <span class="promo-text">Special offer: Use code WELCOME for 10% off!</span>
                <button type="button" class="btn-close btn-close-white ms-3" aria-label="Close"/>
            </div>
        </div>
    </template>
    ` : ""}

    <!-- Custom header style -->
    <template id="header" inherit_id="website.layout" name="${config.displayName} Header">
        <xpath expr="//header//nav" position="attributes">
            <attribute name="class" add="navbar-light" separator=" "/>
        </xpath>
    </template>

    <!-- Custom footer -->
    <template id="footer" inherit_id="website.footer_default" name="${config.displayName} Footer">
        <xpath expr="//footer" position="attributes">
            <attribute name="class" add="theme-footer" separator=" "/>
        </xpath>
    </template>

</odoo>
`;
}

/**
 * Generate pages.xml
 */
function generatePagesXml(config: ThemeConfig): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- =====================================================================
         ${config.displayName} - Page Templates
         ===================================================================== -->

    <!-- Homepage template -->
    <template id="homepage" name="${config.displayName} Homepage">
        <t t-call="website.layout">
            <div id="wrap" class="oe_structure oe_empty">
                <!-- Hero Section -->
                <section class="s_banner pt160 pb160 o_cc o_cc1" data-snippet="s_banner">
                    <div class="container">
                        <div class="row align-items-center">
                            <div class="col-lg-6">
                                <h1 class="display-4 fw-bold mb-4">Welcome to ${config.displayName}</h1>
                                <p class="lead text-muted mb-4">
                                    Create beautiful, modern websites with our premium Odoo theme.
                                    Designed for ${config.industry} businesses.
                                </p>
                                <div class="d-flex gap-3">
                                    <a href="/contactus" class="btn btn-primary btn-lg rounded-pill px-4">
                                        Get Started
                                    </a>
                                    <a href="/page/about" class="btn btn-outline-primary btn-lg rounded-pill px-4">
                                        Learn More
                                    </a>
                                </div>
                            </div>
                            <div class="col-lg-6">
                                <div class="hero-image">
                                    <img src="/web/image/website/hero" class="img-fluid rounded-3 shadow-lg" alt="Hero"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Features Section -->
                <section class="s_features section-padding o_cc o_cc3" data-snippet="s_features">
                    <div class="container">
                        <div class="section-title">
                            <h2>Why Choose Us</h2>
                            <p>Discover what makes us different</p>
                        </div>
                        <div class="row g-4">
                            <div class="col-md-4">
                                <div class="card h-100 text-center p-4 hover-lift">
                                    <div class="card-body">
                                        <div class="feature-icon bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
                                            <i class="fa fa-rocket fa-2x text-primary"></i>
                                        </div>
                                        <h5 class="fw-bold">Fast Performance</h5>
                                        <p class="text-muted mb-0">Optimized for speed and efficiency</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card h-100 text-center p-4 hover-lift">
                                    <div class="card-body">
                                        <div class="feature-icon bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
                                            <i class="fa fa-shield fa-2x text-primary"></i>
                                        </div>
                                        <h5 class="fw-bold">Secure</h5>
                                        <p class="text-muted mb-0">Enterprise-grade security built-in</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card h-100 text-center p-4 hover-lift">
                                    <div class="card-body">
                                        <div class="feature-icon bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-3">
                                            <i class="fa fa-expand-arrows-alt fa-2x text-primary"></i>
                                        </div>
                                        <h5 class="fw-bold">Scalable</h5>
                                        <p class="text-muted mb-0">Grows with your business needs</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- CTA Section -->
                <section class="s_cta section-padding bg-primary text-white text-center" data-snippet="s_cta">
                    <div class="container">
                        <h2 class="fw-bold mb-3">Ready to Get Started?</h2>
                        <p class="lead mb-4 opacity-75">Join thousands of satisfied customers today</p>
                        <a href="/contactus" class="btn btn-light btn-lg rounded-pill px-5">
                            Contact Us
                        </a>
                    </div>
                </section>
            </div>
        </t>
    </template>

    <!-- About page template -->
    <template id="about_page" name="${config.displayName} About Page">
        <t t-call="website.layout">
            <div id="wrap" class="oe_structure">
                <section class="s_text_block section-padding">
                    <div class="container">
                        <div class="row">
                            <div class="col-lg-8 mx-auto text-center">
                                <h1 class="display-5 fw-bold mb-4">About Us</h1>
                                <p class="lead text-muted">
                                    Learn more about our story and mission.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </t>
    </template>

</odoo>
`;
}

/**
 * Generate snippets.xml
 */
function generateSnippetsXml(config: ThemeConfig): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- =====================================================================
         ${config.displayName} - Custom Snippets
         ===================================================================== -->

    <!-- Register custom snippets in website builder -->
    <template id="snippets" inherit_id="website.snippets" name="${config.displayName} Snippets">
        <xpath expr="//div[@id='snippet_structure']//t[@t-snippet][last()]" position="after">
            <t t-snippet="${config.name}.s_hero_split" t-thumbnail="/web/image/${config.name}/static/src/img/snippets/s_hero_split.svg"/>
        </xpath>
    </template>

    <!-- Hero Split Snippet -->
    <template id="s_hero_split" name="Hero Split">
        <section class="s_hero_split pt96 pb96 o_cc o_cc1">
            <div class="container">
                <div class="row align-items-center g-5">
                    <div class="col-lg-6 order-lg-1 order-2">
                        <span class="badge bg-primary mb-3">Welcome</span>
                        <h1 class="display-4 fw-bold mb-4 o_default_snippet_text">
                            Your Headline Here
                        </h1>
                        <p class="lead text-muted mb-4 o_default_snippet_text">
                            A compelling description that captures your value proposition
                            and encourages visitors to take action.
                        </p>
                        <div class="d-flex flex-wrap gap-3">
                            <a href="#" class="btn btn-primary btn-lg rounded-pill px-4">
                                Primary Action
                            </a>
                            <a href="#" class="btn btn-outline-secondary btn-lg rounded-pill px-4">
                                Secondary Action
                            </a>
                        </div>
                    </div>
                    <div class="col-lg-6 order-lg-2 order-1">
                        <div class="position-relative">
                            <img src="/web/image/website/hero_image"
                                 class="img-fluid rounded-3 shadow-lg"
                                 alt="Hero Image"/>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </template>

    <!-- Feature Cards Snippet -->
    <template id="s_feature_cards" name="Feature Cards">
        <section class="s_feature_cards section-padding o_cc o_cc3">
            <div class="container">
                <div class="section-title text-center mb-5">
                    <h2 class="fw-bold o_default_snippet_text">Our Features</h2>
                    <p class="text-muted o_default_snippet_text">Discover what makes us special</p>
                </div>
                <div class="row g-4">
                    <div class="col-md-6 col-lg-4" t-foreach="[1,2,3]" t-as="i">
                        <div class="card h-100 border-0 shadow-sm hover-lift">
                            <div class="card-body p-4 text-center">
                                <div class="feature-icon bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width:64px;height:64px;">
                                    <i class="fa fa-star fa-2x text-primary"></i>
                                </div>
                                <h5 class="fw-bold o_default_snippet_text">Feature Title</h5>
                                <p class="text-muted mb-0 o_default_snippet_text">
                                    Brief description of this amazing feature.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </template>

    <!-- Testimonials Snippet -->
    <template id="s_testimonials_cards" name="Testimonials Cards">
        <section class="s_testimonials_cards section-padding o_cc o_cc1">
            <div class="container">
                <div class="section-title text-center mb-5">
                    <h2 class="fw-bold o_default_snippet_text">What Our Clients Say</h2>
                    <p class="text-muted o_default_snippet_text">Trusted by businesses worldwide</p>
                </div>
                <div class="row g-4">
                    <div class="col-lg-4" t-foreach="[1,2,3]" t-as="i">
                        <div class="card h-100 border-0 shadow-sm">
                            <div class="card-body p-4">
                                <div class="mb-3 text-warning">
                                    <i class="fa fa-star"></i>
                                    <i class="fa fa-star"></i>
                                    <i class="fa fa-star"></i>
                                    <i class="fa fa-star"></i>
                                    <i class="fa fa-star"></i>
                                </div>
                                <p class="mb-4 o_default_snippet_text">
                                    "Exceptional service and outstanding results.
                                    Highly recommended for anyone looking for quality."
                                </p>
                                <div class="d-flex align-items-center">
                                    <div class="rounded-circle bg-secondary me-3" style="width:48px;height:48px;"></div>
                                    <div>
                                        <h6 class="mb-0 fw-bold o_default_snippet_text">Client Name</h6>
                                        <small class="text-muted o_default_snippet_text">Position, Company</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </template>

</odoo>
`;
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Generate a complete Odoo theme
 */
export function generateTheme(config: ThemeConfig): ThemeGenerationResult {
  const startTime = Date.now();
  const files: GeneratedFile[] = [];

  // Generate core files
  files.push({
    path: `${config.name}/__manifest__.py`,
    content: generateManifest(config),
    type: "py",
  });

  files.push({
    path: `${config.name}/__init__.py`,
    content: "# -*- coding: utf-8 -*-\n# Theme module\n",
    type: "py",
  });

  // Generate SCSS files
  files.push({
    path: `${config.name}/static/src/scss/primary_variables.scss`,
    content: generatePrimaryVariables(config),
    type: "scss",
  });

  files.push({
    path: `${config.name}/static/src/scss/bootstrap_overridden.scss`,
    content: generateBootstrapOverrides(config),
    type: "scss",
  });

  files.push({
    path: `${config.name}/static/src/scss/theme.scss`,
    content: generateThemeScss(config),
    type: "scss",
  });

  // Generate JS
  files.push({
    path: `${config.name}/static/src/js/theme.js`,
    content: generateThemeJs(config),
    type: "js",
  });

  // Generate XML views
  files.push({
    path: `${config.name}/views/layout.xml`,
    content: generateLayoutXml(config),
    type: "xml",
  });

  files.push({
    path: `${config.name}/views/pages.xml`,
    content: generatePagesXml(config),
    type: "xml",
  });

  files.push({
    path: `${config.name}/views/snippets.xml`,
    content: generateSnippetsXml(config),
    type: "xml",
  });

  // Calculate stats
  const linesOfCode = files.reduce((acc, f) => acc + f.content.split("\n").length, 0);
  const generationTime = Date.now() - startTime;

  return {
    success: true,
    files,
    validation: {
      valid: true,
      issues: [],
      stats: { errors: 0, warnings: 0, info: 0 },
    },
    stats: {
      totalFiles: files.length,
      linesOfCode,
      generationTime,
    },
  };
}

/**
 * Quick theme generation from minimal input
 */
export function quickGenerateTheme(
  name: string,
  industry: Industry = "generic",
  customColors?: Partial<ColorPalette>
): ThemeGenerationResult {
  const config = getDefaultThemeConfig(name, industry);

  if (customColors) {
    config.colors = { ...config.colors, ...customColors };
  }

  return generateTheme(config);
}

/**
 * Get industry preset by ID
 */
export function getIndustryPreset(industry: Industry): IndustryPreset | undefined {
  return INDUSTRY_PRESETS[industry];
}

/**
 * Get all available industry IDs
 */
export function getAvailableIndustries(): Industry[] {
  return Object.keys(INDUSTRY_PRESETS) as Industry[];
}

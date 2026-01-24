/**
 * Template rendering engine using Handlebars
 * Generates Odoo theme files from templates
 */

import Handlebars from "handlebars";

// Register Handlebars helpers
Handlebars.registerHelper("lowercase", (str: string) => str?.toLowerCase());
Handlebars.registerHelper("uppercase", (str: string) => str?.toUpperCase());
Handlebars.registerHelper("capitalize", (str: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : ""
);
Handlebars.registerHelper("slugify", (str: string) =>
  str
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
);
Handlebars.registerHelper("eq", (a: any, b: any) => a === b);
Handlebars.registerHelper("ne", (a: any, b: any) => a !== b);
Handlebars.registerHelper("or", (...args: any[]) => {
  args.pop(); // Remove Handlebars options object
  return args.some(Boolean);
});
Handlebars.registerHelper("and", (...args: any[]) => {
  args.pop(); // Remove Handlebars options object
  return args.every(Boolean);
});
Handlebars.registerHelper("json", (context: any) => JSON.stringify(context, null, 2));
Handlebars.registerHelper("year", () => new Date().getFullYear());

/**
 * Theme context for template rendering
 */
export interface ThemeContext {
  theme_name: string;
  theme_display_name: string;
  description?: string;
  version?: string;
  author?: string;
  website?: string;

  // Colors
  color_primary: string;
  color_secondary: string;
  color_accent?: string;
  color_background?: string;
  color_text?: string;

  // Typography
  font_heading: string;
  font_body: string;

  // Features
  has_promo_bar?: boolean;
  has_custom_footer?: boolean;
  has_sticky_header?: boolean;
}

/**
 * Page context for template rendering
 */
export interface PageContext {
  theme_name: string;
  page_id: string;
  page_name: string;
  page_title: string;
  page_url: string;
  sections: SectionContext[];
}

/**
 * Section context for pages
 */
export interface SectionContext {
  type: string;
  snippet_id: string;
  data?: Record<string, any>;
}

/**
 * Snippet context for template rendering
 */
export interface SnippetContext {
  theme_name: string;
  snippet_id: string;
  snippet_name: string;
  color_class?: number;
  has_options?: boolean;
  [key: string]: any;
}

/**
 * Render a Handlebars template with the given context
 */
export function renderTemplate(template: string, context: Record<string, any>): string {
  const compiled = Handlebars.compile(template);
  return compiled(context);
}

/**
 * Built-in templates for common Odoo files
 */
export const TEMPLATES = {
  manifest: `{
    'name': '{{theme_display_name}}',
    'version': '{{version}}',
    'category': 'Website/Theme',
    'summary': '{{description}}',
    'description': """
        {{theme_display_name}}
        ========================
        {{description}}
    """,
    'author': '{{author}}',
    'website': '{{website}}',
    'license': 'LGPL-3',
    'depends': [
        'website',
    ],
    'data': [
        'views/layout.xml',
        'views/snippets.xml',
        'data/menus.xml',
    ],
    'assets': {
        'web._assets_primary_variables': [
            ('prepend', '{{theme_name}}/static/src/scss/primary_variables.scss'),
        ],
        'web._assets_frontend_helpers': [
            ('prepend', '{{theme_name}}/static/src/scss/bootstrap_overridden.scss'),
        ],
        'web.assets_frontend': [
            '{{theme_name}}/static/src/scss/custom.scss',
        ],
    },
    'images': [
        'static/description/banner.png',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}`,

  primary_variables: `// =============================================================================
// {{theme_display_name}} - Primary Variables
// =============================================================================

// Color Palette
$o-color-palettes: map-merge($o-color-palettes, (
    '{{theme_name}}': (
        'o-color-1': {{color_primary}},      // Primary
        'o-color-2': {{color_secondary}},    // Secondary
        'o-color-3': {{color_background}},   // Light Background
        'o-color-4': #ffffff,                // White
        'o-color-5': {{color_text}},         // Dark Text
    ),
));

// Set as default palette
$o-selected-color-palettes-names: append($o-selected-color-palettes-names, '{{theme_name}}');

// Typography
$o-theme-font-configs: (
    'heading': (
        'family': '{{font_heading}}',
        'url': 'https://fonts.googleapis.com/css2?family={{font_heading_encoded}}:wght@400;500;600;700&display=swap',
    ),
    'body': (
        'family': '{{font_body}}',
        'url': 'https://fonts.googleapis.com/css2?family={{font_body_encoded}}:wght@300;400;500;600&display=swap',
    ),
);
`,

  bootstrap_overridden: `// =============================================================================
// {{theme_display_name}} - Bootstrap Overrides
// =============================================================================

// Border radius
$border-radius: 0.5rem;
$border-radius-sm: 0.375rem;
$border-radius-lg: 0.75rem;

// Shadows
$box-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
$box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
$box-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

// Transitions
$transition-base: all 0.3s ease;
`,

  custom_scss: `// =============================================================================
// {{theme_display_name}} - Custom Styles
// =============================================================================

// Smooth scroll
html {
    scroll-behavior: smooth;
}

// Section spacing
section {
    scroll-margin-top: 80px;
}

// Hover animations
.hover-lift {
    transition: transform 0.3s ease, box-shadow 0.3s ease;

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
    }
}

// Custom button styles
.btn {
    transition: all 0.3s ease;
}

// Card hover effects
.card {
    transition: transform 0.3s ease, box-shadow 0.3s ease;

    &:hover {
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
    }
}

// Image hover zoom
.img-hover-zoom {
    overflow: hidden;

    img {
        transition: transform 0.5s ease;
    }

    &:hover img {
        transform: scale(1.05);
    }
}
`,
};

/**
 * Generate a complete theme structure
 */
export function generateThemeFiles(context: ThemeContext): Map<string, string> {
  const files = new Map<string, string>();

  // Add encoded font names for Google Fonts URL
  const extendedContext = {
    ...context,
    font_heading_encoded: context.font_heading.replace(/ /g, "+"),
    font_body_encoded: context.font_body.replace(/ /g, "+"),
    version: context.version || "18.0.1.0.0",
    author: context.author || "Platxa",
    website: context.website || "https://platxa.com",
    color_background: context.color_background || "#f8f9fa",
    color_text: context.color_text || "#212529",
  };

  // Generate files
  files.set(
    `${context.theme_name}/__manifest__.py`,
    renderTemplate(TEMPLATES.manifest, extendedContext)
  );

  files.set(
    `${context.theme_name}/static/src/scss/primary_variables.scss`,
    renderTemplate(TEMPLATES.primary_variables, extendedContext)
  );

  files.set(
    `${context.theme_name}/static/src/scss/bootstrap_overridden.scss`,
    renderTemplate(TEMPLATES.bootstrap_overridden, extendedContext)
  );

  files.set(
    `${context.theme_name}/static/src/scss/custom.scss`,
    renderTemplate(TEMPLATES.custom_scss, extendedContext)
  );

  // Create __init__.py (empty for themes)
  files.set(`${context.theme_name}/__init__.py`, "# Theme module\n");

  return files;
}

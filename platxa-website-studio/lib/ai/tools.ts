import { z } from "zod";

/**
 * Tool definitions for Claude AI
 * These tools allow the AI to generate specific types of Odoo code
 */

/**
 * Theme generation tool schema
 */
export const generateThemeSchema = z.object({
  themeName: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .describe("Technical name for the theme (lowercase, underscores)"),
  displayName: z.string().describe("Human-readable theme name"),
  description: z.string().describe("Theme description for the manifest"),
  industry: z
    .enum([
      "technology",
      "healthcare",
      "finance",
      "restaurant",
      "ecommerce",
      "education",
      "creative",
      "professional",
      "nonprofit",
      "other",
    ])
    .describe("Industry category for design suggestions"),
  colorPalette: z
    .object({
      primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      text: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    })
    .describe("Color palette with hex values"),
  fonts: z
    .object({
      heading: z.string().describe("Google Font name for headings"),
      body: z.string().describe("Google Font name for body text"),
    })
    .describe("Typography configuration"),
});

/**
 * Page generation tool schema
 */
export const generatePageSchema = z.object({
  pageType: z
    .enum([
      "landing",
      "about",
      "services",
      "contact",
      "blog",
      "portfolio",
      "pricing",
      "faq",
      "team",
      "custom",
    ])
    .describe("Type of page to generate"),
  pageName: z.string().describe("Technical name for the page"),
  pageTitle: z.string().describe("Page title for SEO"),
  sections: z
    .array(
      z.enum([
        "hero",
        "features",
        "services",
        "about",
        "team",
        "testimonials",
        "portfolio",
        "pricing",
        "cta",
        "contact",
        "faq",
        "stats",
        "partners",
        "blog",
      ])
    )
    .describe("Sections to include on the page"),
  layout: z
    .enum(["full-width", "contained", "sidebar-left", "sidebar-right"])
    .default("full-width")
    .describe("Page layout style"),
});

/**
 * Snippet generation tool schema
 */
export const generateSnippetSchema = z.object({
  snippetType: z
    .enum([
      "hero",
      "features",
      "testimonials",
      "cta",
      "team",
      "pricing",
      "gallery",
      "stats",
      "contact",
      "faq",
      "partners",
      "timeline",
      "comparison",
      "custom",
    ])
    .describe("Type of snippet to generate"),
  snippetId: z
    .string()
    .regex(/^s_[a-z][a-z0-9_]*$/)
    .describe("Technical ID (must start with s_)"),
  snippetName: z.string().describe("Display name in the editor"),
  options: z
    .object({
      columns: z.number().min(1).max(6).optional(),
      showImages: z.boolean().optional(),
      hasAnimation: z.boolean().optional(),
      colorScheme: z.enum(["light", "dark", "primary", "gradient"]).optional(),
    })
    .optional()
    .describe("Snippet customization options"),
});

/**
 * Style modification tool schema
 */
export const modifyStylesSchema = z.object({
  targetFile: z.string().describe("Path to the SCSS file to modify"),
  changes: z
    .array(
      z.object({
        selector: z.string().describe("CSS selector to target"),
        properties: z.record(z.string()).describe("CSS properties to set"),
      })
    )
    .describe("Style changes to apply"),
});

/**
 * Menu generation tool schema
 */
export const generateMenuSchema = z.object({
  menuItems: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        sequence: z.number(),
        isMegaMenu: z.boolean().optional(),
        children: z
          .array(
            z.object({
              name: z.string(),
              url: z.string(),
              sequence: z.number(),
            })
          )
          .optional(),
      })
    )
    .describe("Menu structure"),
});

/**
 * All available tools for the AI
 */
export const aiTools = {
  generate_theme: {
    description:
      "Generate a complete Odoo theme module with manifest, SCSS variables, and base styles",
    parameters: generateThemeSchema,
  },
  generate_page: {
    description:
      "Generate a QWeb page template with specified sections and layout",
    parameters: generatePageSchema,
  },
  generate_snippet: {
    description:
      "Generate a custom snippet/building block for the website builder",
    parameters: generateSnippetSchema,
  },
  modify_styles: {
    description: "Modify SCSS styles in an existing file",
    parameters: modifyStylesSchema,
  },
  generate_menu: {
    description: "Generate navigation menu configuration",
    parameters: generateMenuSchema,
  },
};

export type ThemeConfig = z.infer<typeof generateThemeSchema>;
export type PageConfig = z.infer<typeof generatePageSchema>;
export type SnippetConfig = z.infer<typeof generateSnippetSchema>;
export type StyleChanges = z.infer<typeof modifyStylesSchema>;
export type MenuConfig = z.infer<typeof generateMenuSchema>;

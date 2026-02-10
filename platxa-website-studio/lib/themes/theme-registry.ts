/**
 * ThemeTemplateRegistry - Pre-built Odoo-compatible themes
 *
 * Provides a collection of 10+ ready-to-use themes with:
 * - Preview images and descriptions
 * - One-click apply functionality
 * - Odoo-compatible structure
 * - Customizable color schemes and layouts
 *
 * Feature #60: Theme System - ThemeTemplateRegistry
 */

// =============================================================================
// Types
// =============================================================================

/** Theme category */
export type ThemeCategory =
  | "business"
  | "portfolio"
  | "ecommerce"
  | "blog"
  | "landing"
  | "corporate"
  | "creative"
  | "minimal";

/** Theme color scheme */
export interface ColorScheme {
  /** Primary brand color */
  primary: string;
  /** Secondary accent color */
  secondary: string;
  /** Background color */
  background: string;
  /** Surface/card color */
  surface: string;
  /** Text color */
  text: string;
  /** Muted text color */
  textMuted: string;
  /** Border color */
  border: string;
  /** Success color */
  success: string;
  /** Warning color */
  warning: string;
  /** Error color */
  error: string;
}

/** Theme typography */
export interface Typography {
  /** Heading font family */
  headingFont: string;
  /** Body font family */
  bodyFont: string;
  /** Base font size */
  baseFontSize: string;
  /** Line height */
  lineHeight: string;
  /** Heading weights */
  headingWeight: string;
}

/** Theme spacing */
export interface Spacing {
  /** Section padding */
  sectionPadding: string;
  /** Container max width */
  containerWidth: string;
  /** Component gap */
  gap: string;
  /** Border radius */
  borderRadius: string;
}

/** Theme layout options */
export interface LayoutOptions {
  /** Header style */
  headerStyle: "fixed" | "static" | "sticky" | "floating";
  /** Navigation style */
  navStyle: "horizontal" | "vertical" | "hamburger";
  /** Footer columns */
  footerColumns: number;
  /** Sidebar position */
  sidebarPosition?: "left" | "right" | "none";
}

/** Theme template definition */
export interface ThemeTemplate {
  /** Unique theme ID */
  id: string;
  /** Theme name */
  name: string;
  /** Theme description */
  description: string;
  /** Theme category */
  category: ThemeCategory;
  /** Theme tags for search */
  tags: string[];
  /** Preview image URL */
  previewImage: string;
  /** Thumbnail URL */
  thumbnail: string;
  /** Color scheme */
  colors: ColorScheme;
  /** Typography settings */
  typography: Typography;
  /** Spacing settings */
  spacing: Spacing;
  /** Layout options */
  layout: LayoutOptions;
  /** Is premium theme */
  isPremium: boolean;
  /** Theme version */
  version: string;
  /** Author */
  author: string;
  /** Last updated */
  updatedAt: Date;
  /** Odoo compatibility version */
  odooVersion: string;
  /** Demo URL */
  demoUrl?: string;
}

/** Theme filter options */
export interface ThemeFilterOptions {
  /** Filter by category */
  category?: ThemeCategory;
  /** Filter by tags */
  tags?: string[];
  /** Include premium themes */
  includePremium?: boolean;
  /** Search query */
  search?: string;
}

/** Applied theme result */
export interface AppliedTheme {
  /** Theme ID */
  themeId: string;
  /** Generated SCSS content */
  scss: string;
  /** Generated CSS variables */
  cssVariables: string;
  /** Odoo manifest data */
  manifest: Record<string, unknown>;
  /** Applied at timestamp */
  appliedAt: Date;
}

// =============================================================================
// Pre-built Theme Templates
// =============================================================================

const THEME_TEMPLATES: ThemeTemplate[] = [
  // 1. Modern Business
  {
    id: "modern-business",
    name: "Modern Business",
    description: "Clean and professional theme for corporate websites with bold typography and subtle animations.",
    category: "business",
    tags: ["corporate", "professional", "clean", "modern"],
    previewImage: "/themes/modern-business/preview.png",
    thumbnail: "/themes/modern-business/thumb.png",
    colors: {
      primary: "#2563eb",
      secondary: "#7c3aed",
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#1e293b",
      textMuted: "#64748b",
      border: "#e2e8f0",
      success: "#22c55e",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Inter, sans-serif",
      bodyFont: "Inter, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.6",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1280px",
      gap: "24px",
      borderRadius: "8px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    isPremium: false,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-01-15"),
    odooVersion: "17.0",
  },

  // 2. Creative Portfolio
  {
    id: "creative-portfolio",
    name: "Creative Portfolio",
    description: "Bold and artistic theme perfect for designers, photographers, and creative professionals.",
    category: "portfolio",
    tags: ["creative", "artistic", "portfolio", "gallery"],
    previewImage: "/themes/creative-portfolio/preview.png",
    thumbnail: "/themes/creative-portfolio/thumb.png",
    colors: {
      primary: "#ec4899",
      secondary: "#8b5cf6",
      background: "#0f0f0f",
      surface: "#1a1a1a",
      text: "#ffffff",
      textMuted: "#a3a3a3",
      border: "#2a2a2a",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#f43f5e",
    },
    typography: {
      headingFont: "Space Grotesk, sans-serif",
      bodyFont: "DM Sans, sans-serif",
      baseFontSize: "17px",
      lineHeight: "1.7",
      headingWeight: "600",
    },
    spacing: {
      sectionPadding: "100px",
      containerWidth: "1400px",
      gap: "32px",
      borderRadius: "12px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 3,
    },
    isPremium: false,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-01-20"),
    odooVersion: "17.0",
  },

  // 3. E-commerce Pro
  {
    id: "ecommerce-pro",
    name: "E-commerce Pro",
    description: "Conversion-optimized theme for online stores with product showcases and shopping features.",
    category: "ecommerce",
    tags: ["shop", "store", "products", "cart", "checkout"],
    previewImage: "/themes/ecommerce-pro/preview.png",
    thumbnail: "/themes/ecommerce-pro/thumb.png",
    colors: {
      primary: "#059669",
      secondary: "#0891b2",
      background: "#ffffff",
      surface: "#f9fafb",
      text: "#111827",
      textMuted: "#6b7280",
      border: "#e5e7eb",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#dc2626",
    },
    typography: {
      headingFont: "Plus Jakarta Sans, sans-serif",
      bodyFont: "Plus Jakarta Sans, sans-serif",
      baseFontSize: "15px",
      lineHeight: "1.5",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "60px",
      containerWidth: "1320px",
      gap: "20px",
      borderRadius: "6px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
      sidebarPosition: "left",
    },
    isPremium: true,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-02-01"),
    odooVersion: "17.0",
  },

  // 4. Minimal Blog
  {
    id: "minimal-blog",
    name: "Minimal Blog",
    description: "Clean and readable theme for bloggers and content creators with focus on typography.",
    category: "blog",
    tags: ["blog", "minimal", "content", "reading", "articles"],
    previewImage: "/themes/minimal-blog/preview.png",
    thumbnail: "/themes/minimal-blog/thumb.png",
    colors: {
      primary: "#18181b",
      secondary: "#71717a",
      background: "#fafafa",
      surface: "#ffffff",
      text: "#27272a",
      textMuted: "#71717a",
      border: "#e4e4e7",
      success: "#22c55e",
      warning: "#eab308",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Playfair Display, serif",
      bodyFont: "Source Sans 3, sans-serif",
      baseFontSize: "18px",
      lineHeight: "1.8",
      headingWeight: "600",
    },
    spacing: {
      sectionPadding: "64px",
      containerWidth: "720px",
      gap: "24px",
      borderRadius: "4px",
    },
    layout: {
      headerStyle: "static",
      navStyle: "horizontal",
      footerColumns: 2,
    },
    isPremium: false,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-01-25"),
    odooVersion: "17.0",
  },

  // 5. Startup Landing
  {
    id: "startup-landing",
    name: "Startup Landing",
    description: "High-converting landing page theme for startups and SaaS products with modern gradients.",
    category: "landing",
    tags: ["startup", "saas", "landing", "conversion", "gradient"],
    previewImage: "/themes/startup-landing/preview.png",
    thumbnail: "/themes/startup-landing/thumb.png",
    colors: {
      primary: "#6366f1",
      secondary: "#a855f7",
      background: "#020617",
      surface: "#0f172a",
      text: "#f1f5f9",
      textMuted: "#94a3b8",
      border: "#1e293b",
      success: "#34d399",
      warning: "#fbbf24",
      error: "#f87171",
    },
    typography: {
      headingFont: "Cal Sans, sans-serif",
      bodyFont: "Inter, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.6",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "96px",
      containerWidth: "1200px",
      gap: "28px",
      borderRadius: "16px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    isPremium: false,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-02-05"),
    odooVersion: "17.0",
  },

  // 6. Corporate Classic
  {
    id: "corporate-classic",
    name: "Corporate Classic",
    description: "Timeless and trustworthy theme for established businesses and institutions.",
    category: "corporate",
    tags: ["corporate", "classic", "traditional", "trust", "enterprise"],
    previewImage: "/themes/corporate-classic/preview.png",
    thumbnail: "/themes/corporate-classic/thumb.png",
    colors: {
      primary: "#1e40af",
      secondary: "#0369a1",
      background: "#ffffff",
      surface: "#f1f5f9",
      text: "#0f172a",
      textMuted: "#475569",
      border: "#cbd5e1",
      success: "#15803d",
      warning: "#ca8a04",
      error: "#b91c1c",
    },
    typography: {
      headingFont: "Merriweather, serif",
      bodyFont: "Open Sans, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.65",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "72px",
      containerWidth: "1140px",
      gap: "24px",
      borderRadius: "4px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    isPremium: false,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-01-10"),
    odooVersion: "17.0",
  },

  // 7. Agency Bold
  {
    id: "agency-bold",
    name: "Agency Bold",
    description: "Eye-catching theme for creative agencies with bold colors and dynamic layouts.",
    category: "creative",
    tags: ["agency", "bold", "creative", "dynamic", "colorful"],
    previewImage: "/themes/agency-bold/preview.png",
    thumbnail: "/themes/agency-bold/thumb.png",
    colors: {
      primary: "#f97316",
      secondary: "#14b8a6",
      background: "#18181b",
      surface: "#27272a",
      text: "#fafafa",
      textMuted: "#a1a1aa",
      border: "#3f3f46",
      success: "#22c55e",
      warning: "#eab308",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Bebas Neue, sans-serif",
      bodyFont: "Roboto, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.6",
      headingWeight: "400",
    },
    spacing: {
      sectionPadding: "88px",
      containerWidth: "1440px",
      gap: "32px",
      borderRadius: "0px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "hamburger",
      footerColumns: 3,
    },
    isPremium: true,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-02-10"),
    odooVersion: "17.0",
  },

  // 8. Nature Organic
  {
    id: "nature-organic",
    name: "Nature Organic",
    description: "Earthy and natural theme perfect for organic brands, wellness, and eco-friendly businesses.",
    category: "business",
    tags: ["organic", "nature", "eco", "wellness", "green"],
    previewImage: "/themes/nature-organic/preview.png",
    thumbnail: "/themes/nature-organic/thumb.png",
    colors: {
      primary: "#65a30d",
      secondary: "#84cc16",
      background: "#fefce8",
      surface: "#ffffff",
      text: "#365314",
      textMuted: "#4d7c0f",
      border: "#d9f99d",
      success: "#22c55e",
      warning: "#eab308",
      error: "#dc2626",
    },
    typography: {
      headingFont: "Fraunces, serif",
      bodyFont: "Nunito, sans-serif",
      baseFontSize: "17px",
      lineHeight: "1.7",
      headingWeight: "600",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1200px",
      gap: "24px",
      borderRadius: "24px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 3,
    },
    isPremium: false,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-01-28"),
    odooVersion: "17.0",
  },

  // 9. Tech Minimal
  {
    id: "tech-minimal",
    name: "Tech Minimal",
    description: "Sleek and minimal theme for tech companies and software products.",
    category: "minimal",
    tags: ["tech", "minimal", "software", "clean", "modern"],
    previewImage: "/themes/tech-minimal/preview.png",
    thumbnail: "/themes/tech-minimal/thumb.png",
    colors: {
      primary: "#3b82f6",
      secondary: "#6366f1",
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#0f172a",
      textMuted: "#64748b",
      border: "#e2e8f0",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Geist, sans-serif",
      bodyFont: "Geist, sans-serif",
      baseFontSize: "15px",
      lineHeight: "1.6",
      headingWeight: "600",
    },
    spacing: {
      sectionPadding: "64px",
      containerWidth: "1100px",
      gap: "20px",
      borderRadius: "8px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    isPremium: false,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-02-08"),
    odooVersion: "17.0",
  },

  // 10. Luxury Premium
  {
    id: "luxury-premium",
    name: "Luxury Premium",
    description: "Elegant and sophisticated theme for luxury brands, hotels, and premium services.",
    category: "business",
    tags: ["luxury", "premium", "elegant", "sophisticated", "gold"],
    previewImage: "/themes/luxury-premium/preview.png",
    thumbnail: "/themes/luxury-premium/thumb.png",
    colors: {
      primary: "#b8860b",
      secondary: "#d4af37",
      background: "#0a0a0a",
      surface: "#141414",
      text: "#fafafa",
      textMuted: "#a3a3a3",
      border: "#262626",
      success: "#16a34a",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFont: "Cormorant Garamond, serif",
      bodyFont: "Montserrat, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.7",
      headingWeight: "500",
    },
    spacing: {
      sectionPadding: "100px",
      containerWidth: "1200px",
      gap: "32px",
      borderRadius: "0px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    isPremium: true,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-02-12"),
    odooVersion: "17.0",
  },

  // 11. Education Hub
  {
    id: "education-hub",
    name: "Education Hub",
    description: "Friendly and accessible theme for educational institutions, courses, and learning platforms.",
    category: "business",
    tags: ["education", "learning", "courses", "school", "university"],
    previewImage: "/themes/education-hub/preview.png",
    thumbnail: "/themes/education-hub/thumb.png",
    colors: {
      primary: "#0ea5e9",
      secondary: "#8b5cf6",
      background: "#ffffff",
      surface: "#f0f9ff",
      text: "#0c4a6e",
      textMuted: "#0369a1",
      border: "#bae6fd",
      success: "#22c55e",
      warning: "#f59e0b",
      error: "#ef4444",
    },
    typography: {
      headingFont: "Poppins, sans-serif",
      bodyFont: "Lato, sans-serif",
      baseFontSize: "16px",
      lineHeight: "1.65",
      headingWeight: "600",
    },
    spacing: {
      sectionPadding: "72px",
      containerWidth: "1240px",
      gap: "24px",
      borderRadius: "12px",
    },
    layout: {
      headerStyle: "sticky",
      navStyle: "horizontal",
      footerColumns: 4,
    },
    isPremium: false,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-02-15"),
    odooVersion: "17.0",
  },

  // 12. Restaurant Deluxe
  {
    id: "restaurant-deluxe",
    name: "Restaurant Deluxe",
    description: "Appetizing theme for restaurants, cafes, and food businesses with menu showcases.",
    category: "business",
    tags: ["restaurant", "food", "cafe", "menu", "dining"],
    previewImage: "/themes/restaurant-deluxe/preview.png",
    thumbnail: "/themes/restaurant-deluxe/thumb.png",
    colors: {
      primary: "#b91c1c",
      secondary: "#f59e0b",
      background: "#fffbeb",
      surface: "#ffffff",
      text: "#1c1917",
      textMuted: "#57534e",
      border: "#e7e5e4",
      success: "#16a34a",
      warning: "#d97706",
      error: "#dc2626",
    },
    typography: {
      headingFont: "Playfair Display, serif",
      bodyFont: "Lora, serif",
      baseFontSize: "17px",
      lineHeight: "1.7",
      headingWeight: "700",
    },
    spacing: {
      sectionPadding: "80px",
      containerWidth: "1180px",
      gap: "28px",
      borderRadius: "8px",
    },
    layout: {
      headerStyle: "fixed",
      navStyle: "horizontal",
      footerColumns: 3,
    },
    isPremium: true,
    version: "1.0.0",
    author: "Platxa Studio",
    updatedAt: new Date("2024-02-18"),
    odooVersion: "17.0",
  },
];

// =============================================================================
// ThemeTemplateRegistry Class
// =============================================================================

/**
 * ThemeTemplateRegistry provides access to pre-built Odoo-compatible themes.
 *
 * @example
 * ```typescript
 * const registry = new ThemeTemplateRegistry();
 *
 * // Get all themes
 * const themes = registry.getAll();
 *
 * // Filter by category
 * const businessThemes = registry.filter({ category: "business" });
 *
 * // Apply a theme
 * const applied = registry.applyTheme("modern-business");
 * ```
 */
export class ThemeTemplateRegistry {
  private themes: Map<string, ThemeTemplate> = new Map();
  private customThemes: Map<string, ThemeTemplate> = new Map();

  constructor() {
    // Load built-in themes
    for (const theme of THEME_TEMPLATES) {
      this.themes.set(theme.id, theme);
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get all available themes
   */
  getAll(): ThemeTemplate[] {
    return [...this.themes.values(), ...this.customThemes.values()];
  }

  /**
   * Get theme by ID
   */
  getById(id: string): ThemeTemplate | undefined {
    return this.themes.get(id) || this.customThemes.get(id);
  }

  /**
   * Filter themes by options
   */
  filter(options: ThemeFilterOptions): ThemeTemplate[] {
    let results = this.getAll();

    if (options.category) {
      results = results.filter((t) => t.category === options.category);
    }

    if (options.tags?.length) {
      results = results.filter((t) =>
        options.tags!.some((tag) => t.tags.includes(tag))
      );
    }

    if (options.includePremium === false) {
      results = results.filter((t) => !t.isPremium);
    }

    if (options.search) {
      const search = options.search.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search) ||
          t.tags.some((tag) => tag.includes(search))
      );
    }

    return results;
  }

  /**
   * Get themes by category
   */
  getByCategory(category: ThemeCategory): ThemeTemplate[] {
    return this.filter({ category });
  }

  /**
   * Search themes
   */
  search(query: string): ThemeTemplate[] {
    return this.filter({ search: query });
  }

  /**
   * Apply a theme and generate output
   */
  applyTheme(themeId: string): AppliedTheme | null {
    const theme = this.getById(themeId);
    if (!theme) return null;

    const scss = this.generateSCSS(theme);
    const cssVariables = this.generateCSSVariables(theme);
    const manifest = this.generateManifest(theme);

    return {
      themeId,
      scss,
      cssVariables,
      manifest,
      appliedAt: new Date(),
    };
  }

  /**
   * Register a custom theme
   */
  registerCustomTheme(theme: ThemeTemplate): void {
    this.customThemes.set(theme.id, theme);
  }

  /**
   * Remove a custom theme
   */
  removeCustomTheme(id: string): boolean {
    return this.customThemes.delete(id);
  }

  /**
   * Get theme count
   */
  getCount(): number {
    return this.themes.size + this.customThemes.size;
  }

  /**
   * Get categories with counts
   */
  getCategoryCounts(): Record<ThemeCategory, number> {
    const counts: Record<ThemeCategory, number> = {
      business: 0,
      portfolio: 0,
      ecommerce: 0,
      blog: 0,
      landing: 0,
      corporate: 0,
      creative: 0,
      minimal: 0,
    };

    for (const theme of this.getAll()) {
      counts[theme.category]++;
    }

    return counts;
  }

  // ==========================================================================
  // Generation Methods
  // ==========================================================================

  /**
   * Generate SCSS from theme
   */
  private generateSCSS(theme: ThemeTemplate): string {
    return `
// Theme: ${theme.name}
// Generated by Platxa Studio
// Odoo Version: ${theme.odooVersion}

// =============================================================================
// Color Variables
// =============================================================================

$o-theme-primary: ${theme.colors.primary};
$o-theme-secondary: ${theme.colors.secondary};
$o-theme-background: ${theme.colors.background};
$o-theme-surface: ${theme.colors.surface};
$o-theme-text: ${theme.colors.text};
$o-theme-text-muted: ${theme.colors.textMuted};
$o-theme-border: ${theme.colors.border};
$o-theme-success: ${theme.colors.success};
$o-theme-warning: ${theme.colors.warning};
$o-theme-error: ${theme.colors.error};

// =============================================================================
// Typography Variables
// =============================================================================

$o-theme-font-heading: ${theme.typography.headingFont};
$o-theme-font-body: ${theme.typography.bodyFont};
$o-theme-font-size-base: ${theme.typography.baseFontSize};
$o-theme-line-height: ${theme.typography.lineHeight};
$o-theme-heading-weight: ${theme.typography.headingWeight};

// =============================================================================
// Spacing Variables
// =============================================================================

$o-theme-section-padding: ${theme.spacing.sectionPadding};
$o-theme-container-width: ${theme.spacing.containerWidth};
$o-theme-gap: ${theme.spacing.gap};
$o-theme-border-radius: ${theme.spacing.borderRadius};

// =============================================================================
// Base Styles
// =============================================================================

:root {
  --o-theme-primary: #{$o-theme-primary};
  --o-theme-secondary: #{$o-theme-secondary};
  --o-theme-background: #{$o-theme-background};
  --o-theme-surface: #{$o-theme-surface};
  --o-theme-text: #{$o-theme-text};
  --o-theme-text-muted: #{$o-theme-text-muted};
  --o-theme-border: #{$o-theme-border};
}

body {
  font-family: $o-theme-font-body;
  font-size: $o-theme-font-size-base;
  line-height: $o-theme-line-height;
  color: $o-theme-text;
  background-color: $o-theme-background;
}

h1, h2, h3, h4, h5, h6 {
  font-family: $o-theme-font-heading;
  font-weight: $o-theme-heading-weight;
}

.container {
  max-width: $o-theme-container-width;
  margin: 0 auto;
  padding: 0 1rem;
}

section {
  padding: $o-theme-section-padding 0;
}

.btn-primary {
  background-color: $o-theme-primary;
  border-color: $o-theme-primary;
  border-radius: $o-theme-border-radius;

  &:hover {
    background-color: darken($o-theme-primary, 10%);
    border-color: darken($o-theme-primary, 10%);
  }
}

.btn-secondary {
  background-color: $o-theme-secondary;
  border-color: $o-theme-secondary;
  border-radius: $o-theme-border-radius;

  &:hover {
    background-color: darken($o-theme-secondary, 10%);
    border-color: darken($o-theme-secondary, 10%);
  }
}
`.trim();
  }

  /**
   * Generate CSS variables from theme
   */
  private generateCSSVariables(theme: ThemeTemplate): string {
    return `
:root {
  /* Colors */
  --theme-primary: ${theme.colors.primary};
  --theme-secondary: ${theme.colors.secondary};
  --theme-background: ${theme.colors.background};
  --theme-surface: ${theme.colors.surface};
  --theme-text: ${theme.colors.text};
  --theme-text-muted: ${theme.colors.textMuted};
  --theme-border: ${theme.colors.border};
  --theme-success: ${theme.colors.success};
  --theme-warning: ${theme.colors.warning};
  --theme-error: ${theme.colors.error};

  /* Typography */
  --theme-font-heading: ${theme.typography.headingFont};
  --theme-font-body: ${theme.typography.bodyFont};
  --theme-font-size-base: ${theme.typography.baseFontSize};
  --theme-line-height: ${theme.typography.lineHeight};
  --theme-heading-weight: ${theme.typography.headingWeight};

  /* Spacing */
  --theme-section-padding: ${theme.spacing.sectionPadding};
  --theme-container-width: ${theme.spacing.containerWidth};
  --theme-gap: ${theme.spacing.gap};
  --theme-border-radius: ${theme.spacing.borderRadius};
}
`.trim();
  }

  /**
   * Generate Odoo manifest from theme
   */
  private generateManifest(theme: ThemeTemplate): Record<string, unknown> {
    return {
      name: theme.name,
      summary: theme.description,
      description: theme.description,
      category: "Theme/Website",
      version: theme.version,
      author: theme.author,
      website: "https://platxa.com",
      license: "LGPL-3",
      depends: ["website"],
      data: [
        "views/templates.xml",
        "views/snippets.xml",
      ],
      assets: {
        "web.assets_frontend": [
          `/theme_${theme.id}/static/src/scss/theme.scss`,
        ],
      },
      images: [theme.previewImage],
      application: false,
      installable: true,
      auto_install: false,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a ThemeTemplateRegistry instance
 */
export function createThemeRegistry(): ThemeTemplateRegistry {
  return new ThemeTemplateRegistry();
}

/** Singleton instance */
let registryInstance: ThemeTemplateRegistry | null = null;

/**
 * Get the shared ThemeTemplateRegistry instance
 */
export function getThemeRegistry(): ThemeTemplateRegistry {
  if (!registryInstance) {
    registryInstance = new ThemeTemplateRegistry();
  }
  return registryInstance;
}

export default ThemeTemplateRegistry;

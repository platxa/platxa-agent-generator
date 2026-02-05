/**
 * Multi-Website Support for Odoo
 *
 * Manages per-website theme configuration, styles, and assets
 * for Odoo multi-website deployments.
 */

// ============================================================================
// Types
// ============================================================================

export interface Website {
  id: number;
  name: string;
  domain?: string;
  companyId: number;
  defaultLangId: number;
  languages: Language[];
  isDefault: boolean;
  themeId?: number;
  favicon?: string;
  logo?: string;
  socialLinks?: SocialLinks;
  metadata?: WebsiteMetadata;
}

export interface Language {
  id: number;
  code: string;
  name: string;
  isDefault: boolean;
  direction: 'ltr' | 'rtl';
}

export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  pinterest?: string;
}

export interface WebsiteMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  customHeadCode?: string;
  customBodyCode?: string;
}

export interface WebsiteTheme {
  id: string;
  websiteId: number;
  name: string;
  version: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  layout: ThemeLayout;
  components: ThemeComponents;
  customCss?: string;
  customScss?: string;
  customJs?: string;
  assets: ThemeAssets;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  light: string;
  dark: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  customColors?: Record<string, string>;
}

export interface ThemeTypography {
  fontFamily: string;
  fontFamilyHeadings?: string;
  fontFamilyMonospace?: string;
  baseFontSize: string;
  lineHeight: number;
  headingLineHeight: number;
  fontWeightNormal: number;
  fontWeightBold: number;
  h1Size: string;
  h2Size: string;
  h3Size: string;
  h4Size: string;
  h5Size: string;
  h6Size: string;
}

export interface ThemeLayout {
  containerMaxWidth: string;
  containerPadding: string;
  gridGutter: string;
  sectionSpacing: string;
  borderRadius: string;
  borderRadiusLarge: string;
  borderRadiusSmall: string;
  boxShadow: string;
  boxShadowLarge: string;
  headerHeight: string;
  footerStyle: 'minimal' | 'standard' | 'extended';
}

export interface ThemeComponents {
  buttons: ButtonStyles;
  cards: CardStyles;
  forms: FormStyles;
  navbar: NavbarStyles;
}

export interface ButtonStyles {
  borderRadius: string;
  padding: string;
  fontWeight: number;
  textTransform: 'none' | 'uppercase' | 'capitalize';
  transition: string;
}

export interface CardStyles {
  borderRadius: string;
  boxShadow: string;
  padding: string;
  borderWidth: string;
  borderColor: string;
}

export interface FormStyles {
  inputBorderRadius: string;
  inputPadding: string;
  inputBorderWidth: string;
  inputFocusColor: string;
  labelFontWeight: number;
}

export interface NavbarStyles {
  height: string;
  background: string;
  position: 'static' | 'sticky' | 'fixed';
  shadow: boolean;
  logoMaxHeight: string;
}

export interface ThemeAssets {
  fonts: FontAsset[];
  icons: string;
  images: ImageAsset[];
}

export interface FontAsset {
  family: string;
  weights: number[];
  source: 'google' | 'local' | 'custom';
  url?: string;
}

export interface ImageAsset {
  id: string;
  name: string;
  url: string;
  type: 'logo' | 'favicon' | 'background' | 'pattern' | 'other';
}

export interface MultiWebsiteConfig {
  websites: Website[];
  themes: Map<number, WebsiteTheme>;
  sharedAssets: string[];
  defaultThemeId?: string;
}

// ============================================================================
// Multi-Website Manager
// ============================================================================

export class MultiWebsiteManager {
  private websites: Map<number, Website> = new Map();
  private themes: Map<number, WebsiteTheme> = new Map();
  private activeWebsiteId: number | null = null;

  constructor(config?: Partial<MultiWebsiteConfig>) {
    if (config?.websites) {
      config.websites.forEach((w) => this.websites.set(w.id, w));
    }
    if (config?.themes) {
      config.themes.forEach((theme, websiteId) => this.themes.set(websiteId, theme));
    }
  }

  /**
   * Register a website
   */
  registerWebsite(website: Website): void {
    this.websites.set(website.id, website);
  }

  /**
   * Get website by ID
   */
  getWebsite(websiteId: number): Website | undefined {
    return this.websites.get(websiteId);
  }

  /**
   * Get all websites
   */
  getAllWebsites(): Website[] {
    return Array.from(this.websites.values());
  }

  /**
   * Get website by domain
   */
  getWebsiteByDomain(domain: string): Website | undefined {
    return Array.from(this.websites.values()).find(
      (w) => w.domain === domain || w.domain === domain.replace('www.', '')
    );
  }

  /**
   * Set active website
   */
  setActiveWebsite(websiteId: number): void {
    if (!this.websites.has(websiteId)) {
      throw new Error(`Website ${websiteId} not found`);
    }
    this.activeWebsiteId = websiteId;
  }

  /**
   * Get active website
   */
  getActiveWebsite(): Website | undefined {
    return this.activeWebsiteId ? this.websites.get(this.activeWebsiteId) : undefined;
  }

  /**
   * Set theme for website
   */
  setTheme(websiteId: number, theme: WebsiteTheme): void {
    this.themes.set(websiteId, { ...theme, websiteId, updatedAt: new Date() });
  }

  /**
   * Get theme for website
   */
  getTheme(websiteId: number): WebsiteTheme | undefined {
    return this.themes.get(websiteId);
  }

  /**
   * Generate theme SCSS for a website
   */
  generateThemeScss(websiteId: number): string {
    const theme = this.themes.get(websiteId);
    if (!theme) {
      throw new Error(`Theme not found for website ${websiteId}`);
    }

    return generateThemeScss(theme);
  }

  /**
   * Generate all assets for a website
   */
  generateWebsiteAssets(websiteId: number): WebsiteAssetBundle {
    const website = this.websites.get(websiteId);
    const theme = this.themes.get(websiteId);

    if (!website) {
      throw new Error(`Website ${websiteId} not found`);
    }

    return {
      scss: theme ? this.generateThemeScss(websiteId) : '',
      css: theme ? generateThemeCss(theme) : '',
      js: theme?.customJs || '',
      fonts: theme?.assets.fonts || [],
      metadata: generateMetadataTags(website),
    };
  }

  /**
   * Clone theme from one website to another
   */
  cloneTheme(sourceWebsiteId: number, targetWebsiteId: number): WebsiteTheme {
    const sourceTheme = this.themes.get(sourceWebsiteId);
    if (!sourceTheme) {
      throw new Error(`Source theme not found for website ${sourceWebsiteId}`);
    }

    const clonedTheme: WebsiteTheme = {
      ...JSON.parse(JSON.stringify(sourceTheme)),
      id: `theme_${targetWebsiteId}_${Date.now()}`,
      websiteId: targetWebsiteId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.themes.set(targetWebsiteId, clonedTheme);
    return clonedTheme;
  }

  /**
   * Export configuration for Odoo
   */
  exportOdooConfig(): OdooMultiWebsiteConfig {
    const websites: OdooWebsiteRecord[] = [];
    const themes: OdooThemeRecord[] = [];
    const assets: OdooAssetRecord[] = [];

    this.websites.forEach((website) => {
      websites.push({
        id: website.id,
        name: website.name,
        domain: website.domain || false,
        company_id: website.companyId,
        default_lang_id: website.defaultLangId,
        language_ids: website.languages.map((l) => l.id),
        social_facebook: website.socialLinks?.facebook || false,
        social_twitter: website.socialLinks?.twitter || false,
        social_instagram: website.socialLinks?.instagram || false,
        social_linkedin: website.socialLinks?.linkedin || false,
        social_youtube: website.socialLinks?.youtube || false,
        google_analytics_key: website.metadata?.googleAnalyticsId || false,
        google_management_client_id: website.metadata?.googleTagManagerId || false,
      });

      const theme = this.themes.get(website.id);
      if (theme) {
        themes.push({
          website_id: website.id,
          name: theme.name,
          primary_color: theme.colors.primary,
          secondary_color: theme.colors.secondary,
          font_family: theme.typography.fontFamily,
          custom_scss: theme.customScss || false,
          custom_js: theme.customJs || false,
        });

        // Generate asset records
        assets.push({
          website_id: website.id,
          name: `${website.name} Theme Styles`,
          bundle: 'web.assets_frontend',
          path: `/website_${website.id}/static/src/scss/theme.scss`,
          content: this.generateThemeScss(website.id),
        });
      }
    });

    return { websites, themes, assets };
  }
}

// ============================================================================
// Theme Generator Functions
// ============================================================================

/**
 * Generate SCSS variables from theme
 */
export function generateThemeScss(theme: WebsiteTheme): string {
  const { colors, typography, layout, components } = theme;

  return `// Auto-generated theme for website ${theme.websiteId}
// Theme: ${theme.name} v${theme.version}
// Generated: ${new Date().toISOString()}

// ============================================================================
// Color Variables
// ============================================================================

$o-color-primary: ${colors.primary};
$o-color-secondary: ${colors.secondary};
$o-color-accent: ${colors.accent};
$o-color-success: ${colors.success};
$o-color-warning: ${colors.warning};
$o-color-danger: ${colors.danger};
$o-color-info: ${colors.info};
$o-color-light: ${colors.light};
$o-color-dark: ${colors.dark};

$o-bg-color: ${colors.background};
$o-surface-color: ${colors.surface};
$o-text-color: ${colors.text};
$o-text-muted: ${colors.textMuted};
$o-border-color: ${colors.border};

${colors.customColors ? Object.entries(colors.customColors).map(
  ([name, value]) => `$o-color-${name}: ${value};`
).join('\n') : ''}

// Color map for utilities
$o-theme-colors: (
  "primary": $o-color-primary,
  "secondary": $o-color-secondary,
  "accent": $o-color-accent,
  "success": $o-color-success,
  "warning": $o-color-warning,
  "danger": $o-color-danger,
  "info": $o-color-info,
  "light": $o-color-light,
  "dark": $o-color-dark,
);

// ============================================================================
// Typography
// ============================================================================

$o-font-family-base: ${typography.fontFamily};
$o-font-family-headings: ${typography.fontFamilyHeadings || typography.fontFamily};
$o-font-family-monospace: ${typography.fontFamilyMonospace || 'monospace'};

$o-font-size-base: ${typography.baseFontSize};
$o-line-height-base: ${typography.lineHeight};
$o-line-height-headings: ${typography.headingLineHeight};

$o-font-weight-normal: ${typography.fontWeightNormal};
$o-font-weight-bold: ${typography.fontWeightBold};

$o-h1-font-size: ${typography.h1Size};
$o-h2-font-size: ${typography.h2Size};
$o-h3-font-size: ${typography.h3Size};
$o-h4-font-size: ${typography.h4Size};
$o-h5-font-size: ${typography.h5Size};
$o-h6-font-size: ${typography.h6Size};

// ============================================================================
// Layout
// ============================================================================

$o-container-max-width: ${layout.containerMaxWidth};
$o-container-padding: ${layout.containerPadding};
$o-grid-gutter: ${layout.gridGutter};
$o-section-spacing: ${layout.sectionSpacing};

$o-border-radius: ${layout.borderRadius};
$o-border-radius-lg: ${layout.borderRadiusLarge};
$o-border-radius-sm: ${layout.borderRadiusSmall};

$o-box-shadow: ${layout.boxShadow};
$o-box-shadow-lg: ${layout.boxShadowLarge};

$o-header-height: ${layout.headerHeight};

// ============================================================================
// Components
// ============================================================================

// Buttons
$o-btn-border-radius: ${components.buttons.borderRadius};
$o-btn-padding: ${components.buttons.padding};
$o-btn-font-weight: ${components.buttons.fontWeight};
$o-btn-text-transform: ${components.buttons.textTransform};
$o-btn-transition: ${components.buttons.transition};

// Cards
$o-card-border-radius: ${components.cards.borderRadius};
$o-card-box-shadow: ${components.cards.boxShadow};
$o-card-padding: ${components.cards.padding};
$o-card-border-width: ${components.cards.borderWidth};
$o-card-border-color: ${components.cards.borderColor};

// Forms
$o-input-border-radius: ${components.forms.inputBorderRadius};
$o-input-padding: ${components.forms.inputPadding};
$o-input-border-width: ${components.forms.inputBorderWidth};
$o-input-focus-color: ${components.forms.inputFocusColor};
$o-label-font-weight: ${components.forms.labelFontWeight};

// Navbar
$o-navbar-height: ${components.navbar.height};
$o-navbar-bg: ${components.navbar.background};
$o-navbar-shadow: ${components.navbar.shadow ? '$o-box-shadow' : 'none'};
$o-navbar-logo-max-height: ${components.navbar.logoMaxHeight};

// ============================================================================
// Base Styles
// ============================================================================

:root {
  --o-primary: #{$o-color-primary};
  --o-secondary: #{$o-color-secondary};
  --o-accent: #{$o-color-accent};
  --o-success: #{$o-color-success};
  --o-warning: #{$o-color-warning};
  --o-danger: #{$o-color-danger};
  --o-info: #{$o-color-info};
  --o-bg: #{$o-bg-color};
  --o-surface: #{$o-surface-color};
  --o-text: #{$o-text-color};
  --o-text-muted: #{$o-text-muted};
  --o-border: #{$o-border-color};
}

body {
  font-family: $o-font-family-base;
  font-size: $o-font-size-base;
  line-height: $o-line-height-base;
  color: $o-text-color;
  background-color: $o-bg-color;
}

h1, h2, h3, h4, h5, h6 {
  font-family: $o-font-family-headings;
  line-height: $o-line-height-headings;
  font-weight: $o-font-weight-bold;
}

h1 { font-size: $o-h1-font-size; }
h2 { font-size: $o-h2-font-size; }
h3 { font-size: $o-h3-font-size; }
h4 { font-size: $o-h4-font-size; }
h5 { font-size: $o-h5-font-size; }
h6 { font-size: $o-h6-font-size; }

// Container
.container, .container-fluid {
  max-width: $o-container-max-width;
  padding-left: $o-container-padding;
  padding-right: $o-container-padding;
}

// Sections
section, .o_section {
  padding-top: $o-section-spacing;
  padding-bottom: $o-section-spacing;
}

// Buttons
.btn {
  border-radius: $o-btn-border-radius;
  padding: $o-btn-padding;
  font-weight: $o-btn-font-weight;
  text-transform: $o-btn-text-transform;
  transition: $o-btn-transition;
}

.btn-primary {
  background-color: $o-color-primary;
  border-color: $o-color-primary;

  &:hover, &:focus {
    background-color: darken($o-color-primary, 10%);
    border-color: darken($o-color-primary, 10%);
  }
}

.btn-secondary {
  background-color: $o-color-secondary;
  border-color: $o-color-secondary;

  &:hover, &:focus {
    background-color: darken($o-color-secondary, 10%);
    border-color: darken($o-color-secondary, 10%);
  }
}

// Cards
.card {
  border-radius: $o-card-border-radius;
  box-shadow: $o-card-box-shadow;
  border-width: $o-card-border-width;
  border-color: $o-card-border-color;

  .card-body {
    padding: $o-card-padding;
  }
}

// Forms
.form-control {
  border-radius: $o-input-border-radius;
  padding: $o-input-padding;
  border-width: $o-input-border-width;

  &:focus {
    border-color: $o-input-focus-color;
    box-shadow: 0 0 0 3px rgba($o-input-focus-color, 0.2);
  }
}

.form-label {
  font-weight: $o-label-font-weight;
}

// Navbar
.o_navbar, .navbar {
  min-height: $o-navbar-height;
  background: $o-navbar-bg;
  box-shadow: $o-navbar-shadow;

  .navbar-brand img {
    max-height: $o-navbar-logo-max-height;
    width: auto;
  }
}

${theme.customScss || ''}
`;
}

/**
 * Generate CSS from theme (compiled version)
 */
export function generateThemeCss(theme: WebsiteTheme): string {
  const { colors, typography, layout, components } = theme;

  return `/* Auto-generated theme CSS for website ${theme.websiteId} */
/* Theme: ${theme.name} v${theme.version} */

:root {
  --o-primary: ${colors.primary};
  --o-secondary: ${colors.secondary};
  --o-accent: ${colors.accent};
  --o-success: ${colors.success};
  --o-warning: ${colors.warning};
  --o-danger: ${colors.danger};
  --o-info: ${colors.info};
  --o-bg: ${colors.background};
  --o-surface: ${colors.surface};
  --o-text: ${colors.text};
  --o-text-muted: ${colors.textMuted};
  --o-border: ${colors.border};
  --o-font-family: ${typography.fontFamily};
  --o-font-size: ${typography.baseFontSize};
  --o-line-height: ${typography.lineHeight};
  --o-border-radius: ${layout.borderRadius};
  --o-box-shadow: ${layout.boxShadow};
}

body {
  font-family: var(--o-font-family);
  font-size: var(--o-font-size);
  line-height: var(--o-line-height);
  color: var(--o-text);
  background-color: var(--o-bg);
}

.btn-primary {
  background-color: var(--o-primary);
  border-color: var(--o-primary);
}

.btn-secondary {
  background-color: var(--o-secondary);
  border-color: var(--o-secondary);
}

.card {
  border-radius: ${components.cards.borderRadius};
  box-shadow: ${components.cards.boxShadow};
}

${theme.customCss || ''}
`;
}

/**
 * Generate metadata tags for website
 */
export function generateMetadataTags(website: Website): string {
  const meta = website.metadata || {};
  const tags: string[] = [];

  if (meta.title) {
    tags.push(`<title>${escapeHtml(meta.title)}</title>`);
    tags.push(`<meta property="og:title" content="${escapeHtml(meta.title)}">`);
  }

  if (meta.description) {
    tags.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
    tags.push(`<meta property="og:description" content="${escapeHtml(meta.description)}">`);
  }

  if (meta.keywords?.length) {
    tags.push(`<meta name="keywords" content="${escapeHtml(meta.keywords.join(', '))}">`);
  }

  if (meta.ogImage) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.ogImage)}">`);
  }

  if (website.favicon) {
    tags.push(`<link rel="icon" href="${escapeHtml(website.favicon)}" type="image/x-icon">`);
  }

  if (meta.googleAnalyticsId) {
    tags.push(`<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(meta.googleAnalyticsId)}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${escapeHtml(meta.googleAnalyticsId)}');
</script>`);
  }

  if (meta.googleTagManagerId) {
    tags.push(`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${escapeHtml(meta.googleTagManagerId)}');</script>`);
  }

  if (meta.customHeadCode) {
    tags.push(meta.customHeadCode);
  }

  return tags.join('\n');
}

// ============================================================================
// Asset Bundle Types
// ============================================================================

export interface WebsiteAssetBundle {
  scss: string;
  css: string;
  js: string;
  fonts: FontAsset[];
  metadata: string;
}

export interface OdooMultiWebsiteConfig {
  websites: OdooWebsiteRecord[];
  themes: OdooThemeRecord[];
  assets: OdooAssetRecord[];
}

export interface OdooWebsiteRecord {
  id: number;
  name: string;
  domain: string | false;
  company_id: number;
  default_lang_id: number;
  language_ids: number[];
  social_facebook: string | false;
  social_twitter: string | false;
  social_instagram: string | false;
  social_linkedin: string | false;
  social_youtube: string | false;
  google_analytics_key: string | false;
  google_management_client_id: string | false;
}

export interface OdooThemeRecord {
  website_id: number;
  name: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  custom_scss: string | false;
  custom_js: string | false;
}

export interface OdooAssetRecord {
  website_id: number;
  name: string;
  bundle: string;
  path: string;
  content: string;
}

// ============================================================================
// Default Theme Factory
// ============================================================================

/**
 * Create a default theme for a website
 */
export function createDefaultTheme(websiteId: number, name: string = 'Default Theme'): WebsiteTheme {
  return {
    id: `theme_${websiteId}_${Date.now()}`,
    websiteId,
    name,
    version: '1.0.0',
    colors: {
      primary: '#4f46e5',
      secondary: '#6b7280',
      accent: '#06b6d4',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      light: '#f3f4f6',
      dark: '#1f2937',
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#111827',
      textMuted: '#6b7280',
      border: '#e5e7eb',
    },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontFamilyHeadings: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontFamilyMonospace: "'JetBrains Mono', 'Fira Code', monospace",
      baseFontSize: '16px',
      lineHeight: 1.6,
      headingLineHeight: 1.3,
      fontWeightNormal: 400,
      fontWeightBold: 700,
      h1Size: '2.5rem',
      h2Size: '2rem',
      h3Size: '1.75rem',
      h4Size: '1.5rem',
      h5Size: '1.25rem',
      h6Size: '1rem',
    },
    layout: {
      containerMaxWidth: '1280px',
      containerPadding: '1.5rem',
      gridGutter: '1.5rem',
      sectionSpacing: '4rem',
      borderRadius: '0.5rem',
      borderRadiusLarge: '1rem',
      borderRadiusSmall: '0.25rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      boxShadowLarge: '0 10px 40px rgba(0, 0, 0, 0.1)',
      headerHeight: '72px',
      footerStyle: 'standard',
    },
    components: {
      buttons: {
        borderRadius: '0.5rem',
        padding: '0.625rem 1.25rem',
        fontWeight: 500,
        textTransform: 'none',
        transition: 'all 0.2s ease',
      },
      cards: {
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '1.5rem',
        borderWidth: '1px',
        borderColor: '#e5e7eb',
      },
      forms: {
        inputBorderRadius: '0.5rem',
        inputPadding: '0.625rem 0.875rem',
        inputBorderWidth: '1px',
        inputFocusColor: '#4f46e5',
        labelFontWeight: 500,
      },
      navbar: {
        height: '72px',
        background: '#ffffff',
        position: 'sticky',
        shadow: true,
        logoMaxHeight: '48px',
      },
    },
    assets: {
      fonts: [
        {
          family: 'Inter',
          weights: [400, 500, 600, 700],
          source: 'google',
        },
      ],
      icons: 'fontawesome',
      images: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create a dark theme variant
 */
export function createDarkTheme(websiteId: number, name: string = 'Dark Theme'): WebsiteTheme {
  const baseTheme = createDefaultTheme(websiteId, name);

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: '#6366f1',
      secondary: '#9ca3af',
      background: '#111827',
      surface: '#1f2937',
      text: '#f9fafb',
      textMuted: '#9ca3af',
      border: '#374151',
      light: '#374151',
      dark: '#f9fafb',
    },
    components: {
      ...baseTheme.components,
      navbar: {
        ...baseTheme.components.navbar,
        background: '#1f2937',
      },
      cards: {
        ...baseTheme.components.cards,
        borderColor: '#374151',
      },
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default MultiWebsiteManager;

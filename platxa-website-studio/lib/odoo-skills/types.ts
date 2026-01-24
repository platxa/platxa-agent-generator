/**
 * Odoo Skills Type Definitions
 *
 * Core types for Odoo theme generation, validation, and i18n.
 */

// =============================================================================
// THEME TYPES
// =============================================================================

/**
 * Industry type for industry-specific theme generation
 */
export type Industry =
  | "restaurant"
  | "technology"
  | "legal"
  | "healthcare"
  | "ecommerce"
  | "education"
  | "realestate"
  | "fitness"
  | "creative"
  | "nonprofit"
  | "generic";

/**
 * Design style for theme aesthetics
 */
export type DesignStyle =
  | "modern"
  | "classic"
  | "minimal"
  | "bold"
  | "elegant"
  | "playful"
  | "corporate";

/**
 * Color palette configuration
 */
export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

/**
 * Typography configuration
 */
export interface Typography {
  headingFamily: string;
  bodyFamily: string;
  headingWeight: number;
  bodyWeight: number;
  baseSize: string;
  scale: number;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: string;
  website: string;
  license: string;

  industry: Industry;
  designStyle: DesignStyle;

  colors: ColorPalette;
  typography: Typography;

  features: ThemeFeatures;
  pages: PageConfig[];
  snippets: SnippetConfig[];
}

/**
 * Theme features toggles
 */
export interface ThemeFeatures {
  stickyHeader: boolean;
  promoBar: boolean;
  megaMenu: boolean;
  darkMode: boolean;
  animations: boolean;
  lazyLoading: boolean;
  smoothScroll: boolean;
  backToTop: boolean;
  cookieConsent: boolean;
  socialLinks: boolean;
}

/**
 * Page configuration
 */
export interface PageConfig {
  id: string;
  name: string;
  title: string;
  url: string;
  template: string;
  sections: SectionConfig[];
  meta: PageMeta;
}

/**
 * Section configuration for pages
 */
export interface SectionConfig {
  id: string;
  type: string;
  snippetId: string;
  colorClass: number;
  options: Record<string, unknown>;
}

/**
 * Page metadata for SEO
 */
export interface PageMeta {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
}

// =============================================================================
// SNIPPET TYPES
// =============================================================================

/**
 * Snippet category
 */
export type SnippetCategory =
  | "structure"
  | "content"
  | "features"
  | "dynamic"
  | "ecommerce"
  | "social";

/**
 * Snippet option type
 */
export type OptionType = "select" | "colorpicker" | "toggle" | "range" | "text";

/**
 * Snippet option definition
 */
export interface SnippetOption {
  name: string;
  label: string;
  type: OptionType;
  default: unknown;
  choices?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Snippet configuration
 */
export interface SnippetConfig {
  id: string;
  name: string;
  category: SnippetCategory;
  description: string;
  thumbnail?: string;
  template: string;
  scss?: string;
  js?: string;
  options: SnippetOption[];
  dependencies?: string[];
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Validation severity level
 */
export type ValidationSeverity = "error" | "warning" | "info";

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  file: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    errors: number;
    warnings: number;
    info: number;
  };
}

// =============================================================================
// I18N TYPES
// =============================================================================

/**
 * Translation entry
 */
export interface TranslationEntry {
  key: string;
  source: string;
  translation: string;
  context?: string;
  file?: string;
  line?: number;
}

/**
 * Language configuration
 */
export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  dateFormat: string;
  numberFormat: {
    decimal: string;
    thousand: string;
  };
}

/**
 * Translation file (PO format data)
 */
export interface TranslationFile {
  language: LanguageConfig;
  entries: TranslationEntry[];
  metadata: {
    lastTranslator?: string;
    languageTeam?: string;
    creationDate: string;
    revisionDate: string;
  };
}

// =============================================================================
// GENERATION TYPES
// =============================================================================

/**
 * Generated file
 */
export interface GeneratedFile {
  path: string;
  content: string;
  type: "xml" | "py" | "scss" | "css" | "js" | "po" | "pot" | "png" | "svg";
}

/**
 * Theme generation result
 */
export interface ThemeGenerationResult {
  success: boolean;
  files: GeneratedFile[];
  validation: ValidationResult;
  stats: {
    totalFiles: number;
    linesOfCode: number;
    generationTime: number;
  };
}

// =============================================================================
// PRESET TYPES
// =============================================================================

/**
 * Industry preset with colors and sections
 */
export interface IndustryPreset {
  industry: Industry;
  name: string;
  description: string;
  colors: ColorPalette;
  typography: Typography;
  suggestedSections: string[];
  features: Partial<ThemeFeatures>;
}

/**
 * Design style preset
 */
export interface DesignStylePreset {
  style: DesignStyle;
  name: string;
  borderRadius: string;
  shadowIntensity: "none" | "light" | "medium" | "heavy";
  animations: boolean;
  spacing: "compact" | "normal" | "spacious";
}

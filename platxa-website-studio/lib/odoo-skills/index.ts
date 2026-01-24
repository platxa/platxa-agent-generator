/**
 * Platxa Odoo Skills
 *
 * Production-grade skills for AI-powered Odoo website theme generation.
 * These skills encode Odoo domain expertise for:
 * - Theme generation with industry presets
 * - Snippet building with options system
 * - QWeb/manifest/SCSS validation
 * - Multi-language (i18n) support
 *
 * @module @platxa/odoo-skills
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Theme types
  Industry,
  DesignStyle,
  ColorPalette,
  Typography,
  ThemeConfig,
  ThemeFeatures,
  PageConfig,
  SectionConfig,
  PageMeta,
  // Snippet types
  SnippetCategory,
  OptionType,
  SnippetOption,
  SnippetConfig,
  // Validation types
  ValidationSeverity,
  ValidationIssue,
  ValidationResult,
  // i18n types
  TranslationEntry,
  LanguageConfig,
  TranslationFile,
  // Generation types
  GeneratedFile,
  ThemeGenerationResult,
  // Preset types
  IndustryPreset,
  DesignStylePreset,
} from "./types";

// =============================================================================
// THEME GENERATOR EXPORTS
// =============================================================================

export {
  // Presets
  INDUSTRY_PRESETS,
  DEFAULT_FEATURES,
  // Generation functions
  generateTheme,
  quickGenerateTheme,
  getDefaultThemeConfig,
  // Preset lookup
  getIndustryPreset,
} from "./theme-generator";

// =============================================================================
// SNIPPET BUILDER EXPORTS
// =============================================================================

export {
  // Snippet library
  SNIPPET_LIBRARY,
  SNIPPET_TEMPLATES,
  // Snippet functions
  getSnippetById,
  getSnippetsByCategory,
  getAllSnippets,
  buildSnippet,
  // File generation
  generateSnippetXml,
  generateSnippetOptionsXml,
  generateSnippetsFile,
  // Builder class
  SnippetBuilder,
} from "./snippet-builder";

// =============================================================================
// VALIDATOR EXPORTS
// =============================================================================

export {
  // Individual validators
  validateQWebTemplate,
  validateManifest,
  validateScss,
  validateJavaScript,
  validateFileStructure,
  // Main validation
  validateTheme,
  quickValidate,
  // Formatting
  formatValidationResult,
} from "./validator";

// =============================================================================
// I18N EXPORTS
// =============================================================================

export {
  // Language configurations
  SUPPORTED_LANGUAGES,
  // String extraction
  extractStrings,
  extractThemeStrings,
  extractStringsFromQWeb,
  // PO/POT generation
  generatePotFile,
  generatePoFile,
  generatePOFile,
  generateI18nFiles,
  // PO parsing
  parsePoFile,
  parsePOFile,
  // RTL support
  isRtlLanguage,
  getRtlLanguages,
  generateRtlScss,
  // Helpers
  getLanguageName,
  getLanguageOptions,
  formatNumber,
  getTranslationStats,
  mergeTranslations,
  // Manager class
  I18nManager,
} from "./i18n";

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

import { generateTheme, quickGenerateTheme } from "./theme-generator";
import { validateTheme, formatValidationResult } from "./validator";
import { generateI18nFiles, SUPPORTED_LANGUAGES } from "./i18n";
import type { Industry, ThemeConfig, GeneratedFile } from "./types";

/**
 * Complete theme generation pipeline
 *
 * Generates a complete Odoo theme with:
 * - All required files (manifest, SCSS, XML, JS)
 * - Validation of generated files
 * - i18n files for specified languages
 *
 * @param name - Theme module name
 * @param industry - Industry type for preset selection
 * @param options - Optional customization overrides
 * @returns Complete theme generation result with all files
 */
export async function generateCompleteTheme(
  name: string,
  industry: Industry = "generic",
  options?: { languages?: string[]; customColors?: Partial<import("./types").ColorPalette> }
): Promise<{
  files: GeneratedFile[];
  validation: ReturnType<typeof validateTheme>;
  i18nFiles: GeneratedFile[];
  summary: string;
}> {
  // Generate base theme
  const themeResult = quickGenerateTheme(name, industry, options?.customColors);

  // Validate generated files
  const validation = validateTheme(themeResult.files);

  // Generate i18n files
  const languages = options?.languages || ["es_ES", "fr_FR", "de_DE"];
  const themeName = themeResult.files[0]?.path.split("/")[0] || "theme_custom";
  const i18nFiles = generateI18nFiles(themeName, themeResult.files, languages);

  // Build summary
  const summary = buildGenerationSummary(themeResult, validation, i18nFiles);

  return {
    files: themeResult.files,
    validation,
    i18nFiles,
    summary,
  };
}

/**
 * Build a human-readable summary of generation results
 */
function buildGenerationSummary(
  themeResult: ReturnType<typeof quickGenerateTheme>,
  validation: ReturnType<typeof validateTheme>,
  i18nFiles: GeneratedFile[]
): string {
  const lines: string[] = [];

  lines.push("# Theme Generation Summary");
  lines.push("");
  lines.push(`## Files Generated: ${themeResult.files.length + i18nFiles.length}`);
  lines.push("");

  // File breakdown by type
  const filesByType: Record<string, number> = {};
  [...themeResult.files, ...i18nFiles].forEach((f) => {
    filesByType[f.type] = (filesByType[f.type] || 0) + 1;
  });

  Object.entries(filesByType).forEach(([type, count]) => {
    lines.push(`- ${type.toUpperCase()}: ${count} files`);
  });

  lines.push("");
  lines.push("## Validation");
  lines.push("");
  lines.push(validation.valid ? "- Status: PASSED" : "- Status: FAILED");
  lines.push(`- Errors: ${validation.stats.errors}`);
  lines.push(`- Warnings: ${validation.stats.warnings}`);
  lines.push(`- Info: ${validation.stats.info}`);

  if (validation.issues.length > 0) {
    lines.push("");
    lines.push("### Issues");
    validation.issues.slice(0, 10).forEach((issue) => {
      const icon = issue.severity === "error" ? "X" : issue.severity === "warning" ? "!" : "i";
      lines.push(`- [${icon}] ${issue.message}`);
    });
    if (validation.issues.length > 10) {
      lines.push(`- ... and ${validation.issues.length - 10} more`);
    }
  }

  lines.push("");
  lines.push("## i18n Support");
  lines.push("");
  lines.push(`- Languages: ${i18nFiles.length - 1} (+ POT template)`);
  i18nFiles
    .filter((f) => f.type === "po")
    .forEach((f) => {
      const langCode = f.path.split("/").pop()?.replace(".po", "") || "";
      const langName = SUPPORTED_LANGUAGES[langCode]?.name || langCode;
      lines.push(`  - ${langName}`);
    });

  lines.push("");
  lines.push(`## Stats`);
  lines.push(`- Total lines of code: ${themeResult.stats.linesOfCode}`);
  lines.push(`- Generation time: ${themeResult.stats.generationTime}ms`);

  return lines.join("\n");
}

/**
 * Get available industries for theme generation
 */
export function getAvailableIndustries(): Array<{
  id: Industry;
  name: string;
  description: string;
}> {
  const { INDUSTRY_PRESETS } = require("./theme-generator");

  return Object.entries(INDUSTRY_PRESETS).map(([id, preset]: [string, any]) => ({
    id: id as Industry,
    name: preset.name,
    description: preset.description,
  }));
}

/**
 * Get available languages for i18n
 */
export function getAvailableLanguages(): Array<{
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
}> {
  return Object.values(SUPPORTED_LANGUAGES).map((lang) => ({
    code: lang.code,
    name: lang.name,
    nativeName: lang.nativeName,
    rtl: lang.rtl,
  }));
}

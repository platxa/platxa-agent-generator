/**
 * Brand Guidelines Generator Module
 *
 * AI-powered generation of brand usage guidelines from brand kit configurations.
 *
 * @module react-agent/guidelines
 *
 * @example
 * ```typescript
 * import { generateBrandGuidelines, guidelinesToMarkdown } from "@platxa/frontend-agent/guidelines"
 *
 * const guidelines = generateBrandGuidelines(brandKit, {
 *   includeCodeExamples: true,
 *   verbosity: "detailed",
 * })
 *
 * // Convert to Markdown for documentation
 * const markdown = guidelinesToMarkdown(guidelines)
 * ```
 */

export {
  generateBrandGuidelines,
  guidelinesToMarkdown,
  isLightColor,
  getColorCategory,
  default,
  // Types
  type BrandGuidelines,
  type GuidelinesOverview,
  type ColorGuidelines,
  type ColorUsage,
  type BackgroundUsage,
  type SemanticColorUsage,
  type TypographyGuidelines,
  type FontFamilyUsage,
  type SizeScaleUsage,
  type WeightUsage,
  type SpacingGuidelines,
  type SpacingScaleUsage,
  type SpacingPattern,
  type ComponentGuidelines,
  type ComponentRule,
  type DosAndDonts,
  type GuidelineItem,
  type ExampleApplication,
  type AccessibilityGuidelines,
  type GuidelinesGeneratorOptions,
} from "./brand-guidelines-generator"

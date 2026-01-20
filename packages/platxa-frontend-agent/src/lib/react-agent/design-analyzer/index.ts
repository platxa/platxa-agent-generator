/**
 * Design Analyzer Module
 *
 * Extracts visual requirements from natural language descriptions
 * and maps them to component specifications for code generation.
 *
 * @example
 * ```typescript
 * import {
 *   analyzeDescription,
 *   quickAnalyze,
 *   detectComponentType,
 * } from "@/lib/react-agent/design-analyzer"
 *
 * // Full analysis
 * const result = analyzeDescription(
 *   "Create a large primary button with a hover lift effect and icon on the left"
 * )
 * console.log(result.primary.componentType) // "button"
 * console.log(result.primary.size) // "lg"
 * console.log(result.primary.variant) // "primary"
 *
 * // Quick analysis
 * const quick = quickAnalyze("small outline badge")
 * console.log(quick) // { type: "badge", variant: "outline", size: "sm" }
 * ```
 *
 * @module react-agent/design-analyzer
 */

// Main analyzer functions
export {
  // Component detection
  detectComponentType,
  getComponentCategory,
  // Style detection
  detectStyleVariant,
  detectSizeVariant,
  detectShapeVariant,
  // Intent extraction
  extractColorIntent,
  extractSpacingIntent,
  extractTypographyIntent,
  extractInteractionIntent,
  extractAnimationIntent,
  extractLayoutIntent,
  extractContentIntent,
  extractAccessibilityIntent,
  // Utilities
  extractKeywords,
  // Main functions
  analyzeDescription,
  quickAnalyze,
  validateRequirements,
} from "./design-analyzer"

// Type exports
export type {
  ComponentType,
  ComponentCategory,
  StyleVariant,
  SizeVariant,
  ShapeVariant,
  ColorIntent,
  SpacingIntent,
  TypographyIntent,
  InteractionIntent,
  AnimationIntent,
  LayoutIntent,
  ContentIntent,
  AccessibilityIntent,
  DesignRequirements,
  PatternMatch,
  AnalysisResult,
  KeywordPattern,
  AnalyzerConfig,
} from "./types"

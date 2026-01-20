/**
 * Quality Module
 *
 * Component quality scoring, design system consistency,
 * TypeScript validation, and documentation generation.
 */

// Types
export type {
  QualityCategory,
  CheckSeverity,
  QualityCheck,
  QualityScoreBreakdown,
  QualityReport,
  QualityScoringConfig,
  TokenType,
  TokenUsage,
  ConsistencyResult,
  DesignSystemRules,
  TypeScriptCheckType,
  TypeScriptIssue,
  TypeScriptValidation,
  PropDoc,
  ComponentDoc,
  DocFormat,
  DocGenerationOptions,
} from "./types"

// Quality Scoring (#78)
export {
  DEFAULT_QUALITY_WEIGHTS,
  createCheck,
  generateQualityReport,
} from "./quality"

// Design Consistency (#79)
export {
  DEFAULT_DESIGN_RULES,
  checkDesignConsistency,
} from "./quality"

// TypeScript Validation (#80)
export { validateTypeScript } from "./quality"

// Documentation (#81)
export {
  generateComponentDoc,
  formatDocAsMarkdown,
} from "./quality"

// Factory
export { createQualitySystem } from "./quality"

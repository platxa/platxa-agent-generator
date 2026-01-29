/**
 * Quality Module Types
 *
 * Types for component quality scoring, design system consistency,
 * TypeScript validation, and documentation generation.
 */

// =============================================================================
// Quality Scoring (#78)
// =============================================================================

/**
 * Quality check category
 */
export type QualityCategory =
  | "accessibility"
  | "design"
  | "code"
  | "typescript"
  | "performance"
  | "documentation"

/**
 * Quality check severity
 */
export type CheckSeverity = "error" | "warning" | "info"

/**
 * Individual quality check result
 */
export interface QualityCheck {
  /** Check identifier */
  id: string
  /** Check category */
  category: QualityCategory
  /** Check name */
  name: string
  /** Whether check passed */
  passed: boolean
  /** Severity if failed */
  severity: CheckSeverity
  /** Detailed message */
  message: string
  /** Line number if applicable */
  line?: number
  /** Suggested fix */
  suggestion?: string
}

/**
 * Quality score breakdown
 */
export interface QualityScoreBreakdown {
  /** Accessibility score (0-10) */
  accessibility: number
  /** Design consistency score (0-10) */
  design: number
  /** Code quality score (0-10) */
  code: number
  /** TypeScript score (0-10) */
  typescript: number
  /** Performance score (0-10) */
  performance: number
  /** Documentation score (0-10) */
  documentation: number
}

/**
 * Complete quality report
 */
export interface QualityReport {
  /** Overall score (0-10) */
  score: number
  /** Score breakdown by category */
  breakdown: QualityScoreBreakdown
  /** All checks performed */
  checks: QualityCheck[]
  /** Errors (must fix) */
  errors: QualityCheck[]
  /** Warnings (should fix) */
  warnings: QualityCheck[]
  /** Info (nice to fix) */
  info: QualityCheck[]
  /** Summary message */
  summary: string
  /** Pass/fail status */
  passed: boolean
  /** Minimum score threshold used */
  threshold: number
}

/**
 * Quality scoring configuration
 */
export interface QualityScoringConfig {
  /** Minimum passing score (default: 7.0) */
  minScore?: number
  /** Category weights (must sum to 1.0) */
  weights?: Partial<QualityScoreBreakdown>
  /** Checks to skip */
  skipChecks?: string[]
  /** Strict mode (warnings become errors) */
  strict?: boolean
}

// =============================================================================
// Design System Consistency (#79)
// =============================================================================

/**
 * Design token type
 */
export type TokenType =
  | "color"
  | "spacing"
  | "fontSize"
  | "fontWeight"
  | "borderRadius"
  | "shadow"
  | "zIndex"
  | "animation"

/**
 * Design token usage
 */
export interface TokenUsage {
  /** Token type */
  type: TokenType
  /** Raw value found */
  rawValue: string
  /** Suggested token */
  suggestedToken?: string
  /** Line number */
  line: number
  /** Column number */
  column?: number
}

/**
 * Consistency check result
 */
export interface ConsistencyResult {
  /** Whether fully consistent */
  isConsistent: boolean
  /** Consistency score (0-100%) */
  score: number
  /** Token usage issues */
  issues: TokenUsage[]
  /** Token usage by type */
  usageByType: Record<TokenType, {
    tokenized: number
    raw: number
    total: number
  }>
  /** Recommendations */
  recommendations: string[]
}

/**
 * Design system rules
 */
export interface DesignSystemRules {
  /** Valid spacing values */
  spacing?: string[]
  /** Valid color tokens */
  colors?: string[]
  /** Valid font sizes */
  fontSizes?: string[]
  /** Valid border radii */
  borderRadii?: string[]
  /** Custom patterns to check */
  customPatterns?: Array<{
    name: string
    pattern: RegExp
    message: string
  }>
}

// =============================================================================
// TypeScript Validation (#80)
// =============================================================================

/**
 * TypeScript check type
 */
export type TypeScriptCheckType =
  | "no-any"
  | "no-implicit-any"
  | "strict-null-checks"
  | "no-unused-vars"
  | "explicit-return-types"
  | "proper-generics"
  | "no-type-assertions"

/**
 * TypeScript issue
 */
export interface TypeScriptIssue {
  /** Check type */
  type: TypeScriptCheckType
  /** Issue message */
  message: string
  /** Line number */
  line: number
  /** Code snippet */
  snippet?: string
  /** Suggested fix */
  fix?: string
}

/**
 * TypeScript validation result
 */
export interface TypeScriptValidation {
  /** Whether passes strict mode */
  isStrict: boolean
  /** Overall TypeScript score */
  score: number
  /** Issues found */
  issues: TypeScriptIssue[]
  /** Checks passed */
  passed: TypeScriptCheckType[]
  /** Checks failed */
  failed: TypeScriptCheckType[]
}

// =============================================================================
// Documentation Generation (#81)
// =============================================================================

/**
 * Prop documentation
 */
export interface PropDoc {
  /** Prop name */
  name: string
  /** TypeScript type */
  type: string
  /** Whether required */
  required: boolean
  /** Default value */
  defaultValue?: string
  /** Description */
  description: string
}

/**
 * Component documentation
 */
export interface ComponentDoc {
  /** Component name */
  name: string
  /** Component description */
  description: string
  /** Props documentation */
  props: PropDoc[]
  /** Usage examples */
  examples: Array<{
    title: string
    code: string
    description?: string
  }>
  /** Related components */
  relatedComponents?: string[]
  /** Accessibility notes */
  a11yNotes?: string[]
  /** Version added */
  since?: string
}

/**
 * Documentation output format
 */
export type DocFormat = "markdown" | "json" | "jsdoc"

/**
 * Documentation generation options
 */
export interface DocGenerationOptions {
  /** Output format */
  format?: DocFormat
  /** Include examples */
  includeExamples?: boolean
  /** Include accessibility notes */
  includeA11y?: boolean
  /** Include TypeScript types */
  includeTypes?: boolean
  /** Template for markdown output */
  template?: string
}

/**
 * Accessibility Auditor Module
 *
 * WCAG 2.2 compliance checking for React components including
 * contrast ratio validation, ARIA auditing, and keyboard accessibility.
 *
 * @example
 * ```typescript
 * import {
 *   checkContrast,
 *   audit,
 *   getComponentRequirements,
 * } from "@/lib/react-agent/accessibility"
 *
 * // Check color contrast
 * const result = checkContrast("#333333", "#ffffff")
 * console.log(result?.passesAA) // true
 *
 * // Full audit
 * const auditResult = audit({
 *   contrast: [
 *     { foreground: "#666", background: "#fff", element: "body text" }
 *   ],
 *   aria: [
 *     { role: "button", attributes: {}, element: "submit button" }
 *   ],
 * })
 * console.log(auditResult.passed, auditResult.score)
 * ```
 *
 * @module react-agent/accessibility
 */

// Core auditor functions
export {
  // Color parsing
  hexToRgb,
  parseRgbString,
  hslToRgb,
  parseColor,
  // Contrast checking
  getRelativeLuminance,
  getContrastRatio,
  checkContrast,
  suggestAccessibleColor,
  // ARIA validation
  ariaRoleRequirements,
  getRoleRequirements,
  validateAriaForRole,
  // Component requirements
  componentA11yRequirements,
  getComponentRequirements,
  // Focus and target size
  focusIndicatorRequirements,
  targetSizeRequirements,
  checkTargetSize,
  // Keyboard patterns
  keyboardPatterns,
  getKeyboardPattern,
  validateKeyboardAccessibility,
  // Screen reader
  validateScreenReader,
  // Audit functions
  createIssue,
  auditContrast,
  auditAria,
  calculateScore,
  audit,
} from "./a11y-auditor"

// Type exports
export type {
  WcagLevel,
  WcagVersion,
  IssueSeverity,
  WcagCategory,
  WcagCriterion,
  RgbColor,
  ContrastResult,
  AriaRoleCategory,
  AriaRole,
  AriaRoleRequirements,
  AccessibilityIssue,
  AuditResult,
  ComponentA11yRequirements,
  FocusIndicatorRequirements,
  TargetSizeRequirements,
  AuditConfig,
  ColorBlindnessType,
  KeyboardCheckResult,
  ScreenReaderCheck,
} from "./types"

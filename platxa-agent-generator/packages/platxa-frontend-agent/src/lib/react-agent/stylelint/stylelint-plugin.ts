/**
 * Stylelint Plugin for Platxa Brand CSS
 *
 * Provides rules to enforce consistent use of brand design tokens,
 * validate color formats, and enforce naming conventions in CSS.
 *
 * @example Configuration in stylelint.config.js
 * ```javascript
 * import platxaStylelint from "@platxa/frontend-agent/stylelint"
 *
 * export default {
 *   plugins: [platxaStylelint],
 *   rules: {
 *     "platxa/enforce-css-variables": true,
 *     "platxa/color-format": ["oklch", { severity: "warning" }],
 *     "platxa/naming-convention": [true, { pattern: "^--brand-" }],
 *   },
 * }
 * ```
 *
 * @module react-agent/stylelint
 */

// =============================================================================
// TYPES (defined locally - Stylelint types not imported to avoid dependency)
// =============================================================================

/**
 * Stylelint Rule function type
 * @see https://stylelint.io/developer-guide/plugins
 */
export interface StylelintRule {
  (
    primaryOption: unknown,
    secondaryOptions?: unknown
  ): (root: CSSNode, result: StylelintResult) => void
  ruleName?: string
  messages?: Record<string, (...args: string[]) => string>
}

/**
 * Stylelint Plugin interface
 * @see https://stylelint.io/developer-guide/plugins
 */
export interface StylelintPlugin {
  ruleName: string
  rule: StylelintRule
}

/**
 * Stylelint result object for reporting
 */
export interface StylelintResult {
  warn: (message: string, options: StylelintWarnOptions) => void
}

/**
 * Warning options for Stylelint
 */
export interface StylelintWarnOptions {
  node: CSSNode
  word?: string
  index?: number
  endIndex?: number
  line?: number
  column?: number
  severity?: "error" | "warning"
}

/**
 * CSS AST Node (PostCSS compatible)
 */
export interface CSSNode {
  type: string
  prop?: string
  value?: string
  selector?: string
  name?: string
  params?: string
  source?: {
    start?: { line: number; column: number }
    end?: { line: number; column: number }
  }
  nodes?: CSSNode[]
  walkDecls?: (callback: (decl: CSSNode) => void) => void
  walkRules?: (callback: (rule: CSSNode) => void) => void
  walkAtRules?: (callback: (atRule: CSSNode) => void) => void
}

/**
 * Options for enforce-css-variables rule
 */
export interface EnforceCSSVariablesOptions {
  /**
   * Required variable prefix
   * @default "--"
   */
  variablePrefix?: string

  /**
   * CSS properties that must use variables
   * @default ["color", "background-color", "border-color", ...]
   */
  enforceOn?: string[]

  /**
   * Allowed literal values (won't trigger warning)
   * @default ["transparent", "inherit", "currentColor", "none"]
   */
  allowedValues?: string[]

  /**
   * Severity level
   * @default "warning"
   */
  severity?: "error" | "warning"
}

/**
 * Options for color-format rule
 */
export interface ColorFormatOptions {
  /**
   * Preferred color format
   * @default "oklch"
   */
  preferredFormat?: "hex" | "rgb" | "hsl" | "oklch" | "lch" | "lab"

  /**
   * Allow CSS variables (var(--...))
   * @default true
   */
  allowVariables?: boolean

  /**
   * Allow currentColor keyword
   * @default true
   */
  allowCurrentColor?: boolean

  /**
   * Severity level
   * @default "warning"
   */
  severity?: "error" | "warning"
}

/**
 * Options for naming-convention rule
 */
export interface NamingConventionOptions {
  /**
   * Pattern for CSS custom property names
   * @default "^--[a-z][a-z0-9-]*$"
   */
  customPropertyPattern?: string

  /**
   * Pattern for CSS class selectors
   * @default "^[a-z][a-z0-9-]*$"
   */
  classPattern?: string

  /**
   * Pattern for CSS ID selectors
   * @default "^[a-z][a-z0-9-]*$"
   */
  idPattern?: string

  /**
   * Required prefix for custom properties
   * @default null
   */
  customPropertyPrefix?: string | null

  /**
   * Severity level
   * @default "warning"
   */
  severity?: "error" | "warning"
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Plugin namespace
 */
const NAMESPACE = "platxa"

/**
 * Default allowed literal values
 */
const DEFAULT_ALLOWED_VALUES = [
  "transparent",
  "inherit",
  "currentColor",
  "currentcolor",
  "none",
  "initial",
  "unset",
  "revert",
  "auto",
]

/**
 * CSS properties that should use design tokens
 */
const TOKEN_PROPERTIES = [
  // Colors
  "color",
  "background-color",
  "background",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-block-color",
  "border-inline-color",
  "outline-color",
  "text-decoration-color",
  "caret-color",
  "accent-color",
  "fill",
  "stroke",
  "stop-color",
  "flood-color",
  // Shadows
  "box-shadow",
  "text-shadow",
]

/**
 * Color format patterns
 */
const COLOR_FORMAT_PATTERNS = {
  hex: /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  rgb: /^rgba?\s*\(/i,
  hsl: /^hsla?\s*\(/i,
  oklch: /^oklch\s*\(/i,
  lch: /^lch\s*\(/i,
  lab: /^lab\s*\(/i,
  hwb: /^hwb\s*\(/i,
}

/**
 * Named CSS colors
 */
const NAMED_COLORS = new Set([
  "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "gray", "grey", "brown", "cyan", "magenta", "lime", "navy",
  "teal", "aqua", "silver", "maroon", "olive", "fuchsia", "transparent",
])

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a value is a CSS variable reference
 */
function isCSSVariable(value: string): boolean {
  return /var\s*\(/.test(value)
}

/**
 * Check if a value is a hardcoded color
 */
function isHardcodedColor(value: string): boolean {
  const trimmed = value.trim().toLowerCase()

  // Check hex
  if (COLOR_FORMAT_PATTERNS.hex.test(trimmed)) return true

  // Check functional notations
  if (COLOR_FORMAT_PATTERNS.rgb.test(trimmed)) return true
  if (COLOR_FORMAT_PATTERNS.hsl.test(trimmed)) return true
  if (COLOR_FORMAT_PATTERNS.oklch.test(trimmed)) return true
  if (COLOR_FORMAT_PATTERNS.lch.test(trimmed)) return true
  if (COLOR_FORMAT_PATTERNS.lab.test(trimmed)) return true
  if (COLOR_FORMAT_PATTERNS.hwb.test(trimmed)) return true

  // Check named colors
  if (NAMED_COLORS.has(trimmed)) return true

  return false
}

/**
 * Detect the color format of a value
 */
function detectColorFormat(
  value: string
): "hex" | "rgb" | "hsl" | "oklch" | "lch" | "lab" | "hwb" | "named" | "variable" | "unknown" {
  const trimmed = value.trim().toLowerCase()

  if (isCSSVariable(trimmed)) return "variable"
  if (COLOR_FORMAT_PATTERNS.hex.test(trimmed)) return "hex"
  if (COLOR_FORMAT_PATTERNS.rgb.test(trimmed)) return "rgb"
  if (COLOR_FORMAT_PATTERNS.hsl.test(trimmed)) return "hsl"
  if (COLOR_FORMAT_PATTERNS.oklch.test(trimmed)) return "oklch"
  if (COLOR_FORMAT_PATTERNS.lch.test(trimmed)) return "lch"
  if (COLOR_FORMAT_PATTERNS.lab.test(trimmed)) return "lab"
  if (COLOR_FORMAT_PATTERNS.hwb.test(trimmed)) return "hwb"
  if (NAMED_COLORS.has(trimmed)) return "named"

  return "unknown"
}

/**
 * Check if a property is a color-related property
 */
function isColorProperty(property: string): boolean {
  return TOKEN_PROPERTIES.includes(property)
}

/**
 * Extract colors from a CSS value (handles multiple colors in shorthand)
 */
function extractColors(value: string): string[] {
  const colors: string[] = []

  // Match hex colors
  const hexMatches = value.match(/#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi)
  if (hexMatches) colors.push(...hexMatches)

  // Match functional colors
  const funcMatches = value.match(/(?:rgba?|hsla?|oklch|lch|lab|hwb)\s*\([^)]+\)/gi)
  if (funcMatches) colors.push(...funcMatches)

  // Match named colors
  const words = value.split(/[\s,/()]+/)
  for (const word of words) {
    if (NAMED_COLORS.has(word.toLowerCase())) {
      colors.push(word)
    }
  }

  return [...new Set(colors)]
}

/**
 * Validate custom property name against pattern
 */
function validateCustomPropertyName(name: string, pattern: string, prefix?: string | null): boolean {
  // Check prefix requirement
  if (prefix && !name.startsWith(prefix)) {
    return false
  }

  // Check pattern
  const regex = new RegExp(pattern)
  return regex.test(name)
}

/**
 * Validate selector name against pattern
 */
function validateSelectorName(selector: string, pattern: string): boolean {
  const regex = new RegExp(pattern)
  return regex.test(selector)
}

// =============================================================================
// STYLELINT RULES
// =============================================================================

/**
 * Rule: enforce-css-variables
 *
 * Enforces use of CSS variables for color and design token properties.
 */
export function createEnforceCSSVariablesRule(): StylelintRule {
  const ruleName = `${NAMESPACE}/enforce-css-variables`

  const ruleFunction: StylelintRule = (
    primaryOption: unknown,
    secondaryOptions?: unknown
  ) => {
    return (root: CSSNode, result: StylelintResult) => {
      // Validate primary option - rule is disabled if false
      if (primaryOption === false) return

      // Type narrowing for options
      const options: EnforceCSSVariablesOptions =
        typeof primaryOption === "object" && primaryOption !== null
          ? (primaryOption as EnforceCSSVariablesOptions)
          : typeof secondaryOptions === "object" && secondaryOptions !== null
            ? (secondaryOptions as EnforceCSSVariablesOptions)
            : {}

      const enforceOn = options.enforceOn || TOKEN_PROPERTIES
      const allowedValues = [...DEFAULT_ALLOWED_VALUES, ...(options.allowedValues || [])]
      const severity = options.severity || "warning"

      // Walk through all declarations
      root.walkDecls?.((decl: CSSNode) => {
        const prop = decl.prop?.toLowerCase()
        if (!prop || !enforceOn.includes(prop)) return

        const value = decl.value
        if (!value) return

        // Check if value uses CSS variable
        if (isCSSVariable(value)) return

        // Check if value is in allowed list
        const trimmedValue = value.trim().toLowerCase()
        if (allowedValues.includes(trimmedValue)) return

        // Check for hardcoded colors
        if (isHardcodedColor(value)) {
          result.warn(
            `Expected CSS variable for "${prop}". Found hardcoded value "${value}". Use var(--brand-*) instead.`,
            {
              node: decl,
              word: value,
              severity,
            }
          )
        }
      })
    }
  }

  // Add rule metadata
  ruleFunction.ruleName = ruleName
  ruleFunction.messages = {
    expected: (prop: string, value: string) =>
      `Expected CSS variable for "${prop}". Found hardcoded value "${value}". Use var(--brand-*) instead.`,
  }

  return ruleFunction
}

/**
 * Rule: color-format
 *
 * Validates and enforces preferred color format.
 */
export function createColorFormatRule(): StylelintRule {
  const ruleName = `${NAMESPACE}/color-format`

  const ruleFunction: StylelintRule = (
    primaryOption: unknown,
    secondaryOptions?: unknown
  ) => {
    return (root: CSSNode, result: StylelintResult) => {
      // Type narrowing for preferred format
      const preferredFormat =
        typeof primaryOption === "string"
          ? primaryOption
          : typeof primaryOption === "object" && primaryOption !== null
            ? ((primaryOption as ColorFormatOptions).preferredFormat || "oklch")
            : "oklch"

      // Type narrowing for options
      const options: ColorFormatOptions =
        typeof primaryOption === "object" && primaryOption !== null
          ? (primaryOption as ColorFormatOptions)
          : typeof secondaryOptions === "object" && secondaryOptions !== null
            ? (secondaryOptions as ColorFormatOptions)
            : {}

      const allowVariables = options.allowVariables !== false
      const allowCurrentColor = options.allowCurrentColor !== false
      const severity = options.severity || "warning"

      root.walkDecls?.((decl: CSSNode) => {
        const prop = decl.prop?.toLowerCase()
        if (!prop || !isColorProperty(prop)) return

        const value = decl.value
        if (!value) return

        // Skip CSS variables if allowed
        if (allowVariables && isCSSVariable(value)) return

        // Skip currentColor if allowed
        if (allowCurrentColor && value.toLowerCase().includes("currentcolor")) return

        // Extract colors from value
        const colors = extractColors(value)

        for (const color of colors) {
          const format = detectColorFormat(color)

          if (format === "variable" || format === "unknown") continue

          if (format !== preferredFormat) {
            result.warn(
              `Color "${color}" uses ${format} format. Preferred format is ${preferredFormat}.`,
              {
                node: decl,
                word: color,
                severity,
              }
            )
          }
        }
      })
    }
  }

  ruleFunction.ruleName = ruleName
  ruleFunction.messages = {
    unexpected: (color: string, format: string, preferred: string) =>
      `Color "${color}" uses ${format} format. Preferred format is ${preferred}.`,
  }

  return ruleFunction
}

/**
 * Rule: naming-convention
 *
 * Enforces naming conventions for CSS custom properties and selectors.
 */
export function createNamingConventionRule(): StylelintRule {
  const ruleName = `${NAMESPACE}/naming-convention`

  const ruleFunction: StylelintRule = (
    primaryOption: unknown,
    secondaryOptions?: unknown
  ) => {
    return (root: CSSNode, result: StylelintResult) => {
      // Rule is disabled if false
      if (primaryOption === false) return

      // Type narrowing for options
      const options: NamingConventionOptions =
        typeof primaryOption === "object" && primaryOption !== null
          ? (primaryOption as NamingConventionOptions)
          : typeof secondaryOptions === "object" && secondaryOptions !== null
            ? (secondaryOptions as NamingConventionOptions)
            : {}

      const customPropertyPattern = options.customPropertyPattern || "^--[a-z][a-z0-9-]*$"
      const classPattern = options.classPattern || "^[a-z][a-z0-9-]*$"
      const idPattern = options.idPattern || "^[a-z][a-z0-9-]*$"
      const customPropertyPrefix = options.customPropertyPrefix
      const severity = options.severity || "warning"

      // Check custom property declarations
      root.walkDecls?.((decl: CSSNode) => {
        const prop = decl.prop
        if (!prop || !prop.startsWith("--")) return

        // Validate prefix
        if (customPropertyPrefix && !prop.startsWith(customPropertyPrefix)) {
          result.warn(
            `Custom property "${prop}" must start with "${customPropertyPrefix}".`,
            {
              node: decl,
              word: prop,
              severity,
            }
          )
          return
        }

        // Validate pattern
        if (!validateCustomPropertyName(prop, customPropertyPattern, customPropertyPrefix)) {
          result.warn(
            `Custom property "${prop}" does not match naming convention pattern: ${customPropertyPattern}`,
            {
              node: decl,
              word: prop,
              severity,
            }
          )
        }
      })

      // Check var() references
      root.walkDecls?.((decl: CSSNode) => {
        const value = decl.value
        if (!value) return

        const varMatches = value.match(/var\(\s*(--[^,)]+)/g)
        if (!varMatches) return

        for (const match of varMatches) {
          const varName = match.replace(/var\(\s*/, "").trim()

          // Validate prefix
          if (customPropertyPrefix && !varName.startsWith(customPropertyPrefix)) {
            result.warn(
              `CSS variable reference "${varName}" must start with "${customPropertyPrefix}".`,
              {
                node: decl,
                word: varName,
                severity,
              }
            )
          }
        }
      })

      // Check selectors
      root.walkRules?.((rule: CSSNode) => {
        const selector = rule.selector
        if (!selector) return

        // Extract class names
        const classMatches = selector.match(/\.[a-z_-][a-z0-9_-]*/gi)
        if (classMatches) {
          for (const className of classMatches) {
            const name = className.slice(1) // Remove leading dot
            if (!validateSelectorName(name, classPattern)) {
              result.warn(
                `Class selector ".${name}" does not match naming convention pattern: ${classPattern}`,
                {
                  node: rule,
                  word: className,
                  severity,
                }
              )
            }
          }
        }

        // Extract ID selectors
        const idMatches = selector.match(/#[a-z_-][a-z0-9_-]*/gi)
        if (idMatches) {
          for (const idSelector of idMatches) {
            const name = idSelector.slice(1) // Remove leading hash
            if (!validateSelectorName(name, idPattern)) {
              result.warn(
                `ID selector "#${name}" does not match naming convention pattern: ${idPattern}`,
                {
                  node: rule,
                  word: idSelector,
                  severity,
                }
              )
            }
          }
        }
      })
    }
  }

  ruleFunction.ruleName = ruleName
  ruleFunction.messages = {
    expectedPrefix: (prop: string, prefix: string) =>
      `Custom property "${prop}" must start with "${prefix}".`,
    expectedPattern: (prop: string, pattern: string) =>
      `Custom property "${prop}" does not match naming convention pattern: ${pattern}`,
    expectedClassPattern: (name: string, pattern: string) =>
      `Class selector ".${name}" does not match naming convention pattern: ${pattern}`,
    expectedIdPattern: (name: string, pattern: string) =>
      `ID selector "#${name}" does not match naming convention pattern: ${pattern}`,
  }

  return ruleFunction
}

// =============================================================================
// PLUGIN CREATION
// =============================================================================

/**
 * Create the Stylelint plugin
 */
export function createStylelintPlugin(): StylelintPlugin {
  return {
    ruleName: NAMESPACE,
    rule: createEnforceCSSVariablesRule(),
    // Stylelint plugins can bundle multiple rules
  }
}

/**
 * All plugin rules
 */
export const rules = {
  "enforce-css-variables": createEnforceCSSVariablesRule(),
  "color-format": createColorFormatRule(),
  "naming-convention": createNamingConventionRule(),
}

/**
 * Plugin configuration presets
 */
export const configs = {
  recommended: {
    plugins: ["@platxa/frontend-agent/stylelint"],
    rules: {
      [`${NAMESPACE}/enforce-css-variables`]: "warning",
      [`${NAMESPACE}/color-format`]: ["oklch", { severity: "warning" }],
      [`${NAMESPACE}/naming-convention`]: false,
    },
  },
  strict: {
    plugins: ["@platxa/frontend-agent/stylelint"],
    rules: {
      [`${NAMESPACE}/enforce-css-variables`]: "error",
      [`${NAMESPACE}/color-format`]: ["oklch", { severity: "error" }],
      [`${NAMESPACE}/naming-convention`]: [true, { customPropertyPrefix: "--brand-" }],
    },
  },
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export {
  isCSSVariable,
  isHardcodedColor,
  detectColorFormat,
  isColorProperty,
  extractColors,
  validateCustomPropertyName,
  validateSelectorName,
  COLOR_FORMAT_PATTERNS,
  TOKEN_PROPERTIES,
  NAMED_COLORS,
  DEFAULT_ALLOWED_VALUES,
  NAMESPACE,
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

const plugin: StylelintPlugin & { rules: typeof rules; configs: typeof configs } = {
  ...createStylelintPlugin(),
  rules,
  configs,
}

export default plugin

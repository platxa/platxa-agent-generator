/**
 * ESLint Plugin for Platxa Brand Token Usage
 *
 * Provides rules to enforce consistent use of design tokens instead of
 * hardcoded color values in React/TypeScript codebases.
 *
 * @example Configuration in eslint.config.js (flat config)
 * ```javascript
 * import platxaPlugin from "@platxa/frontend-agent/eslint"
 *
 * export default [
 *   {
 *     plugins: { platxa: platxaPlugin },
 *     rules: {
 *       "platxa/no-hardcoded-colors": "warn",
 *       "platxa/prefer-brand-token": "warn",
 *     },
 *   },
 * ]
 * ```
 *
 * @example Configuration in .eslintrc (legacy)
 * ```json
 * {
 *   "plugins": ["@platxa/frontend-agent"],
 *   "rules": {
 *     "@platxa/frontend-agent/no-hardcoded-colors": "warn",
 *     "@platxa/frontend-agent/prefer-brand-token": "warn"
 *   }
 * }
 * ```
 *
 * @module react-agent/eslint
 */

import type { Rule, Linter } from "eslint"

// =============================================================================
// TYPES
// =============================================================================

/**
 * ESLint Plugin interface
 * ESLint does not export a Plugin type, so we define it based on the spec.
 * @see https://eslint.org/docs/latest/extend/plugins
 */
interface ESLintPlugin {
  meta?: {
    name: string
    version: string
  }
  rules?: Record<string, Rule.RuleModule>
  configs?: Record<string, LegacyConfig>
  processors?: Record<string, Linter.Processor>
}

/**
 * Legacy ESLint config format (.eslintrc)
 * Different from flat config - plugins is a string array
 */
interface LegacyConfig {
  plugins?: string[]
  rules?: Record<string, Linter.RuleSeverity | [Linter.RuleSeverity, ...unknown[]]>
  extends?: string | string[]
  env?: Record<string, boolean>
  parserOptions?: Record<string, unknown>
}

/**
 * Flat config preset type
 */
interface FlatConfigPreset {
  plugins: Record<string, ESLintPlugin>
  rules: Record<string, Linter.RuleSeverity>
}

/**
 * Options for the no-hardcoded-colors rule
 */
export interface NoHardcodedColorsOptions {
  /**
   * Colors that are allowed without using tokens
   * @default ["transparent", "inherit", "currentColor", "none"]
   */
  allowedColors?: string[]

  /**
   * Whether to check style attributes in JSX
   * @default true
   */
  checkStyleAttributes?: boolean

  /**
   * Whether to check CSS-in-JS template literals
   * @default true
   */
  checkTemplateLiterals?: boolean

  /**
   * Whether to check object style properties
   * @default true
   */
  checkObjectStyles?: boolean

  /**
   * CSS properties to check for color values
   * @default ["color", "backgroundColor", "borderColor", "fill", "stroke", ...]
   */
  colorProperties?: string[]

  /**
   * Severity level for the rule
   * @default "warn"
   */
  severity?: "error" | "warn" | "off"
}

/**
 * Options for the prefer-brand-token rule
 */
export interface PreferBrandTokenOptions {
  /**
   * Preferred token function name
   * @default "brand"
   */
  tokenFunction?: "brand" | "token" | "platxa"

  /**
   * Whether to provide auto-fix suggestions
   * @default true
   */
  suggestFix?: boolean

  /**
   * Map of color values to suggested token names
   */
  colorTokenMap?: Record<string, string>
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default allowed colors that don't require tokens
 */
const DEFAULT_ALLOWED_COLORS = [
  "transparent",
  "inherit",
  "currentColor",
  "currentcolor",
  "none",
  "initial",
  "unset",
  "revert",
]

/**
 * CSS properties that typically contain color values
 */
const COLOR_PROPERTIES = [
  // Text colors
  "color",
  "caretColor",
  "textDecorationColor",
  "textEmphasisColor",
  // Background colors
  "backgroundColor",
  "background",
  // Border colors
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderBlockColor",
  "borderBlockStartColor",
  "borderBlockEndColor",
  "borderInlineColor",
  "borderInlineStartColor",
  "borderInlineEndColor",
  // Outline colors
  "outlineColor",
  // Shadow colors (in box-shadow, text-shadow)
  "boxShadow",
  "textShadow",
  // SVG colors
  "fill",
  "stroke",
  "stopColor",
  "floodColor",
  "lightingColor",
  // Misc
  "accentColor",
  "columnRuleColor",
  "scrollbarColor",
]

/**
 * Named CSS colors (subset of common ones)
 */
const NAMED_COLORS = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "gray",
  "grey",
  "brown",
  "cyan",
  "magenta",
  "lime",
  "navy",
  "teal",
  "aqua",
  "silver",
  "maroon",
  "olive",
  "fuchsia",
  // Extended named colors
  "aliceblue",
  "antiquewhite",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "blanchedalmond",
  "blueviolet",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "greenyellow",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightsteelblue",
  "lightyellow",
  "limegreen",
  "linen",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "oldlace",
  "olivedrab",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "plum",
  "powderblue",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "skyblue",
  "slateblue",
  "slategray",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "whitesmoke",
  "yellowgreen",
])

// =============================================================================
// COLOR DETECTION UTILITIES
// =============================================================================

/**
 * Regular expressions for detecting color values
 */
const COLOR_PATTERNS = {
  // Hex colors: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  hex: /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,

  // RGB/RGBA: rgb(r, g, b), rgba(r, g, b, a), rgb(r g b), rgb(r g b / a)
  rgb: /^rgba?\(\s*[\d.]+%?\s*[,\s]\s*[\d.]+%?\s*[,\s]\s*[\d.]+%?(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i,

  // HSL/HSLA: hsl(h, s%, l%), hsla(h, s%, l%, a), hsl(h s% l%), hsl(h s% l% / a)
  hsl: /^hsla?\(\s*[\d.]+(?:deg|rad|grad|turn)?\s*[,\s]\s*[\d.]+%\s*[,\s]\s*[\d.]+%(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i,

  // OKLCH: oklch(L C H), oklch(L C H / a)
  oklch: /^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(?:\s*\/\s*[\d.]+%?)?\s*\)$/i,

  // HWB: hwb(h w% b%), hwb(h w% b% / a)
  hwb: /^hwb\(\s*[\d.]+(?:deg|rad|grad|turn)?\s+[\d.]+%\s+[\d.]+%(?:\s*\/\s*[\d.]+%?)?\s*\)$/i,

  // LAB: lab(L a b), lab(L a b / alpha)
  lab: /^lab\(\s*[\d.]+%?\s+[\d.-]+\s+[\d.-]+(?:\s*\/\s*[\d.]+%?)?\s*\)$/i,

  // LCH: lch(L C H), lch(L C H / a)
  lch: /^lch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(?:\s*\/\s*[\d.]+%?)?\s*\)$/i,
}

/**
 * Check if a string value is a color
 */
function isColorValue(value: string, allowedColors: string[]): boolean {
  const trimmed = value.trim().toLowerCase()

  // Check if it's an allowed color
  if (allowedColors.some((c) => c.toLowerCase() === trimmed)) {
    return false
  }

  // Check if it's already using a token function
  if (/^(?:brand|token|platxa|var)\(/.test(trimmed)) {
    return false
  }

  // Check hex color
  if (COLOR_PATTERNS.hex.test(trimmed)) {
    return true
  }

  // Check functional color notations
  if (
    COLOR_PATTERNS.rgb.test(trimmed) ||
    COLOR_PATTERNS.hsl.test(trimmed) ||
    COLOR_PATTERNS.oklch.test(trimmed) ||
    COLOR_PATTERNS.hwb.test(trimmed) ||
    COLOR_PATTERNS.lab.test(trimmed) ||
    COLOR_PATTERNS.lch.test(trimmed)
  ) {
    return true
  }

  // Check named colors
  if (NAMED_COLORS.has(trimmed)) {
    return true
  }

  return false
}

/**
 * Check if a CSS property is a color property
 */
function isColorProperty(property: string): boolean {
  // Convert camelCase to kebab-case for comparison
  const kebab = property.replace(/([A-Z])/g, "-$1").toLowerCase()
  const camel = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

  return (
    COLOR_PROPERTIES.includes(property) ||
    COLOR_PROPERTIES.includes(kebab) ||
    COLOR_PROPERTIES.includes(camel)
  )
}

/**
 * Extract color values from a CSS property value string
 */
function extractColorsFromValue(value: string): string[] {
  const colors: string[] = []

  // Check if the whole value is a color
  if (COLOR_PATTERNS.hex.test(value.trim())) {
    colors.push(value.trim())
    return colors
  }

  // Check for functional color notations
  const functionalMatch = value.match(
    /(?:rgba?|hsla?|oklch|hwb|lab|lch)\([^)]+\)/gi
  )
  if (functionalMatch) {
    colors.push(...functionalMatch)
  }

  // Check for hex colors in the value
  const hexMatch = value.match(/#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi)
  if (hexMatch) {
    colors.push(...hexMatch)
  }

  // Check for named colors (word boundaries)
  const words = value.split(/[\s,/()]+/)
  for (const word of words) {
    if (NAMED_COLORS.has(word.toLowerCase())) {
      colors.push(word)
    }
  }

  return [...new Set(colors)]
}

/**
 * Suggest a token name for a color value
 */
function suggestTokenForColor(
  color: string,
  colorTokenMap?: Record<string, string>
): string | null {
  const normalized = color.toLowerCase().trim()

  // Check custom map first
  if (colorTokenMap && colorTokenMap[normalized]) {
    return colorTokenMap[normalized]
  }

  // Provide generic suggestions based on color type
  if (normalized === "#fff" || normalized === "#ffffff" || normalized === "white") {
    return "background"
  }
  if (normalized === "#000" || normalized === "#000000" || normalized === "black") {
    return "foreground"
  }

  // For other colors, suggest primary as a starting point
  return "primary"
}

// =============================================================================
// ESLINT RULES
// =============================================================================

/**
 * Rule: no-hardcoded-colors
 *
 * Detects hardcoded color values in styles and suggests using design tokens.
 */
const noHardcodedColorsRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow hardcoded color values in styles",
      recommended: true,
    },
    fixable: undefined,
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: {
          allowedColors: {
            type: "array",
            items: { type: "string" },
          },
          checkStyleAttributes: { type: "boolean" },
          checkTemplateLiterals: { type: "boolean" },
          checkObjectStyles: { type: "boolean" },
          colorProperties: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hardcodedColor:
        "Avoid hardcoded color '{{color}}'. Use a design token instead (e.g., brand(primary), var(--primary)).",
      suggestToken: "Replace with brand({{token}})",
      suggestVar: "Replace with var(--{{token}})",
    },
  },

  create(context): Rule.RuleListener {
    const options: NoHardcodedColorsOptions = context.options[0] || {}
    const allowedColors = [
      ...DEFAULT_ALLOWED_COLORS,
      ...(options.allowedColors || []),
    ]
    const checkStyleAttributes = options.checkStyleAttributes !== false
    const checkObjectStyles = options.checkObjectStyles !== false
    const checkTemplateLiterals = options.checkTemplateLiterals !== false

    /**
     * Report a hardcoded color with auto-fix suggestions
     */
    function reportHardcodedColor(
      node: Rule.Node,
      color: string,
      property?: string
    ): void {
      const suggestedToken = suggestTokenForColor(color)

      context.report({
        node,
        messageId: "hardcodedColor",
        data: { color, property: property || "style" },
        suggest: suggestedToken
          ? [
              {
                messageId: "suggestToken",
                data: { token: suggestedToken },
                fix(fixer) {
                  // Replace the color value with brand(token)
                  return fixer.replaceText(node, `"brand(${suggestedToken})"`)
                },
              },
              {
                messageId: "suggestVar",
                data: { token: suggestedToken },
                fix(fixer) {
                  // Replace the color value with var(--token)
                  return fixer.replaceText(node, `"var(--${suggestedToken})"`)
                },
              },
            ]
          : undefined,
      })
    }

    /**
     * Check a literal value for hardcoded colors
     */
    function checkLiteralValue(
      node: Rule.Node,
      value: string,
      property?: string
    ): void {
      // If property is specified, only check color properties
      if (property && !isColorProperty(property)) {
        return
      }

      const colors = extractColorsFromValue(value)
      for (const color of colors) {
        if (isColorValue(color, allowedColors)) {
          reportHardcodedColor(node, color, property)
        }
      }
    }

    /**
     * Handle JSX style attributes: style={{ color: "#fff" }}
     * JSX nodes come from parser extensions, not base ESTree.
     * We use type assertions since ESLint's types don't include JSX.
     */
    function handleJSXAttribute(node: Rule.Node): void {
      if (!checkStyleAttributes) return

      // Type-safe access to JSX node properties
      const jsxNode = node as Rule.Node & {
        name?: { type?: string; name?: string }
        value?: {
          type?: string
          expression?: {
            type?: string
            properties?: Array<{
              type?: string
              key?: { type?: string; name?: string }
              value?: { type?: string; value?: unknown }
            }>
          }
        }
      }

      if (
        jsxNode.name?.type !== "JSXIdentifier" ||
        jsxNode.name?.name !== "style"
      ) {
        return
      }

      // style={{ ... }}
      if (
        jsxNode.value?.type === "JSXExpressionContainer" &&
        jsxNode.value?.expression?.type === "ObjectExpression"
      ) {
        const props = jsxNode.value.expression.properties || []
        for (const prop of props) {
          if (prop.type !== "Property") continue
          if (prop.key?.type !== "Identifier" || !prop.key?.name) continue

          const propertyName = prop.key.name
          if (!isColorProperty(propertyName)) continue

          if (prop.value?.type === "Literal" && typeof prop.value?.value === "string") {
            // Create a minimal node for reporting
            checkLiteralValue(prop.value as unknown as Rule.Node, prop.value.value, propertyName)
          }
        }
      }
    }

    // Build the listener object with proper typing
    const listeners: Rule.RuleListener = {
      // Check object properties in style objects
      Property(node) {
        if (!checkObjectStyles) return
        if (node.key.type !== "Identifier") return

        const propertyName = node.key.name
        if (!isColorProperty(propertyName)) return

        if (node.value.type === "Literal" && typeof node.value.value === "string") {
          checkLiteralValue(node.value as Rule.Node, node.value.value, propertyName)
        }
      },

      // Check template literals for color values (CSS-in-JS)
      TemplateLiteral(node) {
        if (!checkTemplateLiterals) return

        // Check quasi (string parts) for color values
        for (const quasi of node.quasis) {
          const value = quasi.value.raw
          const colors = extractColorsFromValue(value)
          for (const color of colors) {
            if (isColorValue(color, allowedColors)) {
              reportHardcodedColor(quasi as unknown as Rule.Node, color)
            }
          }
        }
      },
    }

    // Add JSX handler using selector string (for JSX parser support)
    // This is the standard ESLint pattern for JSX-aware rules
    ;(listeners as Record<string, (node: Rule.Node) => void>)["JSXAttribute"] = handleJSXAttribute

    return listeners
  },
}

/**
 * Rule: prefer-brand-token
 *
 * Suggests using brand() or token() functions for color values.
 */
const preferBrandTokenRule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer using brand tokens over CSS variables directly",
      recommended: false,
    },
    fixable: undefined,
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: {
          tokenFunction: {
            type: "string",
            enum: ["brand", "token", "platxa"],
          },
          suggestFix: { type: "boolean" },
          colorTokenMap: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      preferToken:
        "Consider using {{fn}}({{suggestion}}) instead of var(--{{variable}}).",
      useToken: "Replace with {{fn}}({{token}})",
    },
  },

  create(context): Rule.RuleListener {
    const options: PreferBrandTokenOptions = context.options[0] || {}
    const tokenFunction = options.tokenFunction || "brand"

    /**
     * Check for var(--...) that could be replaced with brand()
     */
    function checkForVarUsage(node: Rule.Node, value: string): void {
      const varMatch = value.match(/var\(--([a-z-]+)\)/gi)
      if (!varMatch) return

      for (const match of varMatch) {
        const varName = match.match(/var\(--([a-z-]+)\)/i)?.[1]
        if (!varName) continue

        // Check if it's a semantic color variable
        const semanticColors = [
          "primary",
          "secondary",
          "accent",
          "background",
          "foreground",
          "muted",
          "border",
          "ring",
          "destructive",
          "card",
          "popover",
          "input",
        ]

        const isSemanticColor = semanticColors.some(
          (c) => varName === c || varName.startsWith(`${c}-`)
        )

        if (isSemanticColor) {
          context.report({
            node,
            messageId: "preferToken",
            data: {
              fn: tokenFunction,
              suggestion: varName,
              variable: varName,
            },
            suggest: [
              {
                messageId: "useToken",
                data: { fn: tokenFunction, token: varName },
                fix(fixer) {
                  // Replace var(--token) with brand(token)
                  const sourceCode = context.sourceCode || context.getSourceCode()
                  const text = sourceCode.getText(node)
                  const newText = text.replace(
                    new RegExp(`var\\(--${varName}\\)`, "gi"),
                    `${tokenFunction}(${varName})`
                  )
                  return fixer.replaceText(node, newText)
                },
              },
            ],
          })
        }
      }
    }

    return {
      // Check string literals
      Literal(node) {
        if (typeof node.value !== "string") return
        checkForVarUsage(node as Rule.Node, node.value)
      },

      // Check template literals
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkForVarUsage(quasi as unknown as Rule.Node, quasi.value.raw)
        }
      },
    }
  },
}

// =============================================================================
// PLUGIN EXPORT
// =============================================================================

/**
 * ESLint plugin for Platxa brand token enforcement
 */
export const plugin: ESLintPlugin = {
  meta: {
    name: "@platxa/eslint-plugin",
    version: "1.0.0",
  },
  rules: {
    "no-hardcoded-colors": noHardcodedColorsRule,
    "prefer-brand-token": preferBrandTokenRule,
  },
  configs: {
    recommended: {
      plugins: ["@platxa/frontend-agent"],
      rules: {
        "@platxa/frontend-agent/no-hardcoded-colors": "warn",
        "@platxa/frontend-agent/prefer-brand-token": "off",
      },
    },
    strict: {
      plugins: ["@platxa/frontend-agent"],
      rules: {
        "@platxa/frontend-agent/no-hardcoded-colors": "error",
        "@platxa/frontend-agent/prefer-brand-token": "warn",
      },
    },
  },
}

/**
 * Flat config preset for recommended rules
 */
export const flatConfigRecommended: FlatConfigPreset = {
  plugins: {
    platxa: plugin,
  },
  rules: {
    "platxa/no-hardcoded-colors": "warn",
    "platxa/prefer-brand-token": "off",
  },
}

/**
 * Flat config preset for strict rules
 */
export const flatConfigStrict: FlatConfigPreset = {
  plugins: {
    platxa: plugin,
  },
  rules: {
    "platxa/no-hardcoded-colors": "error",
    "platxa/prefer-brand-token": "warn",
  },
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export {
  isColorValue,
  isColorProperty,
  extractColorsFromValue,
  suggestTokenForColor,
  COLOR_PATTERNS,
  COLOR_PROPERTIES,
  NAMED_COLORS,
  DEFAULT_ALLOWED_COLORS,
}

export default plugin

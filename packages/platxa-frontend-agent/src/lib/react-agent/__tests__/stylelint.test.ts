/**
 * Tests for Stylelint Plugin
 *
 * @module react-agent/stylelint.test
 */

import { describe, it, expect } from "vitest"
import {
  // Plugin
  createStylelintPlugin,
  rules,
  configs,
  // Rules
  createEnforceCSSVariablesRule,
  createColorFormatRule,
  createNamingConventionRule,
  // Utilities
  isCSSVariable,
  isHardcodedColor,
  detectColorFormat,
  isColorProperty,
  extractColors,
  validateCustomPropertyName,
  validateSelectorName,
  // Constants
  COLOR_FORMAT_PATTERNS,
  TOKEN_PROPERTIES,
  NAMED_COLORS,
  DEFAULT_ALLOWED_VALUES,
  NAMESPACE,
  // Types
  type CSSNode,
  type StylelintResult,
} from "../stylelint"

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe("Stylelint Plugin Utilities", () => {
  describe("isCSSVariable", () => {
    it("should detect var() syntax", () => {
      expect(isCSSVariable("var(--primary)")).toBe(true)
      expect(isCSSVariable("var( --primary )")).toBe(true)
      expect(isCSSVariable("var(--brand-primary)")).toBe(true)
    })

    it("should return false for non-variable values", () => {
      expect(isCSSVariable("#ff0000")).toBe(false)
      expect(isCSSVariable("red")).toBe(false)
      expect(isCSSVariable("rgb(255, 0, 0)")).toBe(false)
    })
  })

  describe("isHardcodedColor", () => {
    it("should detect hex colors", () => {
      expect(isHardcodedColor("#fff")).toBe(true)
      expect(isHardcodedColor("#ffffff")).toBe(true)
      expect(isHardcodedColor("#ff0000ff")).toBe(true)
    })

    it("should detect rgb/rgba colors", () => {
      expect(isHardcodedColor("rgb(255, 0, 0)")).toBe(true)
      expect(isHardcodedColor("rgba(255, 0, 0, 0.5)")).toBe(true)
    })

    it("should detect hsl/hsla colors", () => {
      expect(isHardcodedColor("hsl(0, 100%, 50%)")).toBe(true)
      expect(isHardcodedColor("hsla(0, 100%, 50%, 0.5)")).toBe(true)
    })

    it("should detect oklch colors", () => {
      expect(isHardcodedColor("oklch(70% 0.15 30)")).toBe(true)
    })

    it("should detect named colors", () => {
      expect(isHardcodedColor("red")).toBe(true)
      expect(isHardcodedColor("blue")).toBe(true)
      expect(isHardcodedColor("transparent")).toBe(true)
    })

    it("should return false for CSS variables", () => {
      expect(isHardcodedColor("var(--primary)")).toBe(false)
    })
  })

  describe("detectColorFormat", () => {
    it("should detect hex format", () => {
      expect(detectColorFormat("#fff")).toBe("hex")
      expect(detectColorFormat("#ffffff")).toBe("hex")
    })

    it("should detect rgb format", () => {
      expect(detectColorFormat("rgb(255, 0, 0)")).toBe("rgb")
      expect(detectColorFormat("rgba(255, 0, 0, 0.5)")).toBe("rgb")
    })

    it("should detect hsl format", () => {
      expect(detectColorFormat("hsl(0, 100%, 50%)")).toBe("hsl")
      expect(detectColorFormat("hsla(0, 100%, 50%, 0.5)")).toBe("hsl")
    })

    it("should detect oklch format", () => {
      expect(detectColorFormat("oklch(70% 0.15 30)")).toBe("oklch")
    })

    it("should detect lch format", () => {
      expect(detectColorFormat("lch(50% 50 180)")).toBe("lch")
    })

    it("should detect lab format", () => {
      expect(detectColorFormat("lab(50% 50 -50)")).toBe("lab")
    })

    it("should detect named colors", () => {
      expect(detectColorFormat("red")).toBe("named")
      expect(detectColorFormat("blue")).toBe("named")
    })

    it("should detect CSS variables", () => {
      expect(detectColorFormat("var(--primary)")).toBe("variable")
    })

    it("should return unknown for unrecognized formats", () => {
      expect(detectColorFormat("not-a-color")).toBe("unknown")
    })
  })

  describe("isColorProperty", () => {
    it("should recognize color properties", () => {
      expect(isColorProperty("color")).toBe(true)
      expect(isColorProperty("background-color")).toBe(true)
      expect(isColorProperty("border-color")).toBe(true)
      expect(isColorProperty("fill")).toBe(true)
      expect(isColorProperty("stroke")).toBe(true)
    })

    it("should return false for non-color properties", () => {
      expect(isColorProperty("width")).toBe(false)
      expect(isColorProperty("height")).toBe(false)
      expect(isColorProperty("margin")).toBe(false)
    })
  })

  describe("extractColors", () => {
    it("should extract hex colors", () => {
      const colors = extractColors("#ff0000")
      expect(colors).toContain("#ff0000")
    })

    it("should extract multiple colors from shorthand", () => {
      const colors = extractColors("1px solid #ff0000")
      expect(colors).toContain("#ff0000")
    })

    it("should extract functional colors", () => {
      const colors = extractColors("rgb(255, 0, 0)")
      expect(colors).toContain("rgb(255, 0, 0)")
    })

    it("should extract named colors", () => {
      const colors = extractColors("red")
      expect(colors).toContain("red")
    })

    it("should extract multiple colors", () => {
      const colors = extractColors("linear-gradient(#fff, #000)")
      expect(colors).toContain("#fff")
      expect(colors).toContain("#000")
    })
  })

  describe("validateCustomPropertyName", () => {
    it("should validate names matching pattern", () => {
      expect(validateCustomPropertyName("--brand-primary", "^--[a-z][a-z0-9-]*$")).toBe(true)
      expect(validateCustomPropertyName("--color-blue-500", "^--[a-z][a-z0-9-]*$")).toBe(true)
    })

    it("should reject names not matching pattern", () => {
      expect(validateCustomPropertyName("--BrandPrimary", "^--[a-z][a-z0-9-]*$")).toBe(false)
      expect(validateCustomPropertyName("--123-invalid", "^--[a-z][a-z0-9-]*$")).toBe(false)
    })

    it("should validate prefix requirement", () => {
      expect(validateCustomPropertyName("--brand-primary", "^--", "--brand-")).toBe(true)
      expect(validateCustomPropertyName("--other-color", "^--", "--brand-")).toBe(false)
    })
  })

  describe("validateSelectorName", () => {
    it("should validate names matching pattern", () => {
      expect(validateSelectorName("button", "^[a-z][a-z0-9-]*$")).toBe(true)
      expect(validateSelectorName("my-component", "^[a-z][a-z0-9-]*$")).toBe(true)
    })

    it("should reject names not matching pattern", () => {
      expect(validateSelectorName("Button", "^[a-z][a-z0-9-]*$")).toBe(false)
      expect(validateSelectorName("123-invalid", "^[a-z][a-z0-9-]*$")).toBe(false)
    })
  })
})

// =============================================================================
// CONSTANTS TESTS
// =============================================================================

describe("Stylelint Plugin Constants", () => {
  it("should have correct namespace", () => {
    expect(NAMESPACE).toBe("platxa")
  })

  it("should have color format patterns", () => {
    expect(COLOR_FORMAT_PATTERNS.hex).toBeInstanceOf(RegExp)
    expect(COLOR_FORMAT_PATTERNS.rgb).toBeInstanceOf(RegExp)
    expect(COLOR_FORMAT_PATTERNS.hsl).toBeInstanceOf(RegExp)
    expect(COLOR_FORMAT_PATTERNS.oklch).toBeInstanceOf(RegExp)
  })

  it("should have token properties list", () => {
    expect(TOKEN_PROPERTIES).toContain("color")
    expect(TOKEN_PROPERTIES).toContain("background-color")
    expect(TOKEN_PROPERTIES).toContain("border-color")
  })

  it("should have named colors set", () => {
    expect(NAMED_COLORS.has("red")).toBe(true)
    expect(NAMED_COLORS.has("blue")).toBe(true)
    expect(NAMED_COLORS.has("transparent")).toBe(true)
  })

  it("should have default allowed values", () => {
    expect(DEFAULT_ALLOWED_VALUES).toContain("transparent")
    expect(DEFAULT_ALLOWED_VALUES).toContain("inherit")
    expect(DEFAULT_ALLOWED_VALUES).toContain("currentColor")
  })
})

// =============================================================================
// RULE CREATION TESTS
// =============================================================================

describe("Stylelint Rule Creation", () => {
  describe("createEnforceCSSVariablesRule", () => {
    it("should create a valid rule function", () => {
      const rule = createEnforceCSSVariablesRule()
      expect(typeof rule).toBe("function")
      expect(rule.ruleName).toBe("platxa/enforce-css-variables")
    })

    it("should have messages defined", () => {
      const rule = createEnforceCSSVariablesRule()
      expect(rule.messages).toBeDefined()
    })
  })

  describe("createColorFormatRule", () => {
    it("should create a valid rule function", () => {
      const rule = createColorFormatRule()
      expect(typeof rule).toBe("function")
      expect(rule.ruleName).toBe("platxa/color-format")
    })

    it("should have messages defined", () => {
      const rule = createColorFormatRule()
      expect(rule.messages).toBeDefined()
    })
  })

  describe("createNamingConventionRule", () => {
    it("should create a valid rule function", () => {
      const rule = createNamingConventionRule()
      expect(typeof rule).toBe("function")
      expect(rule.ruleName).toBe("platxa/naming-convention")
    })

    it("should have messages defined", () => {
      const rule = createNamingConventionRule()
      expect(rule.messages).toBeDefined()
    })
  })
})

// =============================================================================
// RULE BEHAVIOR TESTS
// =============================================================================

describe("Stylelint Rule Behavior", () => {
  // Helper to create mock CSS node
  function createMockRoot(declarations: Array<{ prop: string; value: string }>): CSSNode {
    const nodes: CSSNode[] = declarations.map((d) => ({
      type: "decl",
      prop: d.prop,
      value: d.value,
    }))

    return {
      type: "root",
      nodes,
      walkDecls: (callback) => {
        for (const node of nodes) {
          callback(node)
        }
      },
      walkRules: () => {},
      walkAtRules: () => {},
    }
  }

  // Helper to create mock result
  function createMockResult(): { result: StylelintResult; warnings: string[] } {
    const warnings: string[] = []
    return {
      warnings,
      result: {
        warn: (message: string) => {
          warnings.push(message)
        },
      },
    }
  }

  describe("enforce-css-variables rule", () => {
    it("should warn on hardcoded hex colors", () => {
      const rule = createEnforceCSSVariablesRule()
      const ruleExecutor = rule(true)
      const root = createMockRoot([{ prop: "color", value: "#ff0000" }])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(1)
      expect(warnings[0]).toContain("Expected CSS variable")
    })

    it("should not warn on CSS variables", () => {
      const rule = createEnforceCSSVariablesRule()
      const ruleExecutor = rule(true)
      const root = createMockRoot([{ prop: "color", value: "var(--primary)" }])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })

    it("should not warn on allowed values", () => {
      const rule = createEnforceCSSVariablesRule()
      const ruleExecutor = rule(true)
      const root = createMockRoot([{ prop: "color", value: "inherit" }])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })

    it("should be disabled when primaryOption is false", () => {
      const rule = createEnforceCSSVariablesRule()
      const ruleExecutor = rule(false)
      const root = createMockRoot([{ prop: "color", value: "#ff0000" }])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })

    it("should respect custom allowed values", () => {
      const rule = createEnforceCSSVariablesRule()
      const ruleExecutor = rule({ allowedValues: ["#ff0000"] })
      const root = createMockRoot([{ prop: "color", value: "#ff0000" }])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })
  })

  describe("color-format rule", () => {
    it("should warn when color format does not match preferred", () => {
      const rule = createColorFormatRule()
      const ruleExecutor = rule("oklch")
      const root = createMockRoot([{ prop: "color", value: "#ff0000" }])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(1)
      expect(warnings[0]).toContain("hex format")
      expect(warnings[0]).toContain("oklch")
    })

    it("should not warn when color format matches preferred", () => {
      const rule = createColorFormatRule()
      const ruleExecutor = rule("hex")
      const root = createMockRoot([{ prop: "color", value: "#ff0000" }])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })

    it("should allow CSS variables by default", () => {
      const rule = createColorFormatRule()
      const ruleExecutor = rule("oklch")
      const root = createMockRoot([{ prop: "color", value: "var(--primary)" }])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })

    it("should accept options object", () => {
      const rule = createColorFormatRule()
      const ruleExecutor = rule({ preferredFormat: "hex" })
      const root = createMockRoot([{ prop: "color", value: "#ff0000" }])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })
  })

  describe("naming-convention rule", () => {
    // Helper for rules with selectors
    function createMockRootWithRules(selectors: string[]): CSSNode {
      const rules: CSSNode[] = selectors.map((s) => ({
        type: "rule",
        selector: s,
      }))

      return {
        type: "root",
        nodes: rules,
        walkDecls: () => {},
        walkRules: (callback) => {
          for (const rule of rules) {
            callback(rule)
          }
        },
        walkAtRules: () => {},
      }
    }

    // Helper for custom property declarations
    function createMockRootWithDecls(props: string[]): CSSNode {
      const decls: CSSNode[] = props.map((p) => ({
        type: "decl",
        prop: p,
        value: "value",
      }))

      return {
        type: "root",
        nodes: decls,
        walkDecls: (callback) => {
          for (const decl of decls) {
            callback(decl)
          }
        },
        walkRules: () => {},
        walkAtRules: () => {},
      }
    }

    it("should warn on invalid custom property names", () => {
      const rule = createNamingConventionRule()
      const ruleExecutor = rule(true)
      const root = createMockRootWithDecls(["--InvalidName"])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(1)
      expect(warnings[0]).toContain("naming convention")
    })

    it("should not warn on valid custom property names", () => {
      const rule = createNamingConventionRule()
      const ruleExecutor = rule(true)
      const root = createMockRootWithDecls(["--valid-name"])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })

    it("should enforce prefix when specified", () => {
      const rule = createNamingConventionRule()
      const ruleExecutor = rule({ customPropertyPrefix: "--brand-" })
      const root = createMockRootWithDecls(["--other-color"])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(1)
      expect(warnings[0]).toContain("--brand-")
    })

    it("should be disabled when primaryOption is false", () => {
      const rule = createNamingConventionRule()
      const ruleExecutor = rule(false)
      const root = createMockRootWithDecls(["--InvalidName"])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })

    it("should warn on invalid class selectors", () => {
      const rule = createNamingConventionRule()
      const ruleExecutor = rule(true)
      const root = createMockRootWithRules([".InvalidClass"])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(1)
      expect(warnings[0]).toContain("Class selector")
    })

    it("should not warn on valid class selectors", () => {
      const rule = createNamingConventionRule()
      const ruleExecutor = rule(true)
      const root = createMockRootWithRules([".valid-class"])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(0)
    })

    it("should warn on invalid ID selectors", () => {
      const rule = createNamingConventionRule()
      const ruleExecutor = rule(true)
      const root = createMockRootWithRules(["#InvalidId"])
      const { result, warnings } = createMockResult()

      ruleExecutor(root, result)

      expect(warnings.length).toBe(1)
      expect(warnings[0]).toContain("ID selector")
    })
  })
})

// =============================================================================
// PLUGIN STRUCTURE TESTS
// =============================================================================

describe("Stylelint Plugin Structure", () => {
  it("should create a valid plugin", () => {
    const plugin = createStylelintPlugin()
    expect(plugin.ruleName).toBe("platxa")
    expect(typeof plugin.rule).toBe("function")
  })

  it("should export all rules", () => {
    expect(rules["enforce-css-variables"]).toBeDefined()
    expect(rules["color-format"]).toBeDefined()
    expect(rules["naming-convention"]).toBeDefined()
  })

  it("should have recommended config", () => {
    expect(configs.recommended).toBeDefined()
    expect(configs.recommended.plugins).toContain("@platxa/frontend-agent/stylelint")
    expect(configs.recommended.rules).toBeDefined()
  })

  it("should have strict config", () => {
    expect(configs.strict).toBeDefined()
    expect(configs.strict.plugins).toContain("@platxa/frontend-agent/stylelint")
    expect(configs.strict.rules).toBeDefined()
  })

  it("recommended config should have warning severity", () => {
    expect(configs.recommended.rules["platxa/enforce-css-variables"]).toBe("warning")
  })

  it("strict config should have error severity", () => {
    expect(configs.strict.rules["platxa/enforce-css-variables"]).toBe("error")
  })
})

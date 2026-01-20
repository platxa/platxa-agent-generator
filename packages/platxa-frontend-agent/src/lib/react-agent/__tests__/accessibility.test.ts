/**
 * Accessibility Auditor Tests
 *
 * Tests for WCAG 2.2 compliance checking including contrast ratios,
 * ARIA validation, and keyboard accessibility.
 */

import { describe, it, expect } from "vitest"
import {
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
} from "../accessibility"

import type {
  AriaRole,
  AccessibilityIssue,
} from "../accessibility"

// ============================================================================
// Color Parsing Tests
// ============================================================================

describe("Color Parsing", () => {
  describe("hexToRgb", () => {
    it("parses 6-digit hex colors", () => {
      expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 })
      expect(hexToRgb("#ff5733")).toEqual({ r: 255, g: 87, b: 51 })
    })

    it("parses hex colors without hash", () => {
      expect(hexToRgb("ffffff")).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb("000000")).toEqual({ r: 0, g: 0, b: 0 })
    })

    it("parses 3-digit hex colors", () => {
      expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 })
      expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 })
    })

    it("is case insensitive", () => {
      expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb("#FfFfFf")).toEqual({ r: 255, g: 255, b: 255 })
    })

    it("returns null for invalid hex", () => {
      expect(hexToRgb("invalid")).toBeNull()
      expect(hexToRgb("#gggggg")).toBeNull()
      expect(hexToRgb("#12345")).toBeNull()
    })
  })

  describe("parseRgbString", () => {
    it("parses rgb() format", () => {
      expect(parseRgbString("rgb(255, 255, 255)")).toEqual({ r: 255, g: 255, b: 255 })
      expect(parseRgbString("rgb(0, 0, 0)")).toEqual({ r: 0, g: 0, b: 0 })
      expect(parseRgbString("rgb(128, 64, 32)")).toEqual({ r: 128, g: 64, b: 32 })
    })

    it("parses rgba() format", () => {
      expect(parseRgbString("rgba(255, 255, 255, 1)")).toEqual({ r: 255, g: 255, b: 255 })
      expect(parseRgbString("rgba(0, 0, 0, 0.5)")).toEqual({ r: 0, g: 0, b: 0 })
    })

    it("returns null for invalid format", () => {
      expect(parseRgbString("invalid")).toBeNull()
      expect(parseRgbString("hsl(0, 0%, 100%)")).toBeNull()
    })
  })

  describe("hslToRgb", () => {
    it("converts white (no saturation)", () => {
      expect(hslToRgb("hsl(0 0% 100%)")).toEqual({ r: 255, g: 255, b: 255 })
    })

    it("converts black (no saturation)", () => {
      expect(hslToRgb("hsl(0 0% 0%)")).toEqual({ r: 0, g: 0, b: 0 })
    })

    it("converts gray (no saturation)", () => {
      const result = hslToRgb("hsl(0 0% 50%)")
      expect(result).toEqual({ r: 128, g: 128, b: 128 })
    })

    it("converts primary colors", () => {
      // Red
      const red = hslToRgb("hsl(0 100% 50%)")
      expect(red?.r).toBe(255)
      expect(red?.g).toBe(0)
      expect(red?.b).toBe(0)

      // Green (120 degrees)
      const green = hslToRgb("hsl(120 100% 50%)")
      expect(green?.r).toBe(0)
      expect(green?.g).toBe(255)
      expect(green?.b).toBe(0)

      // Blue (240 degrees)
      const blue = hslToRgb("hsl(240 100% 50%)")
      expect(blue?.r).toBe(0)
      expect(blue?.g).toBe(0)
      expect(blue?.b).toBe(255)
    })

    it("returns null for invalid format", () => {
      expect(hslToRgb("invalid")).toBeNull()
      expect(hslToRgb("rgb(0, 0, 0)")).toBeNull()
    })
  })

  describe("parseColor", () => {
    it("parses hex colors", () => {
      expect(parseColor("#ffffff")).toEqual({ r: 255, g: 255, b: 255 })
      expect(parseColor("#000")).toEqual({ r: 0, g: 0, b: 0 })
    })

    it("parses rgb colors", () => {
      expect(parseColor("rgb(255, 128, 64)")).toEqual({ r: 255, g: 128, b: 64 })
    })

    it("parses hsl colors", () => {
      const result = parseColor("hsl(0 0% 100%)")
      expect(result).toEqual({ r: 255, g: 255, b: 255 })
    })

    it("parses named colors", () => {
      expect(parseColor("white")).toEqual({ r: 255, g: 255, b: 255 })
      expect(parseColor("black")).toEqual({ r: 0, g: 0, b: 0 })
      expect(parseColor("red")).toEqual({ r: 255, g: 0, b: 0 })
      expect(parseColor("blue")).toEqual({ r: 0, g: 0, b: 255 })
    })

    it("is case insensitive for named colors", () => {
      expect(parseColor("WHITE")).toEqual({ r: 255, g: 255, b: 255 })
      expect(parseColor("Black")).toEqual({ r: 0, g: 0, b: 0 })
    })

    it("parses hex without hash", () => {
      expect(parseColor("ffffff")).toEqual({ r: 255, g: 255, b: 255 })
    })

    it("returns null for invalid colors", () => {
      expect(parseColor("notacolor")).toBeNull()
      expect(parseColor("")).toBeNull()
    })
  })
})

// ============================================================================
// Contrast Ratio Tests
// ============================================================================

describe("Contrast Ratio Calculation", () => {
  describe("getRelativeLuminance", () => {
    it("calculates luminance for white", () => {
      const luminance = getRelativeLuminance({ r: 255, g: 255, b: 255 })
      expect(luminance).toBeCloseTo(1.0, 2)
    })

    it("calculates luminance for black", () => {
      const luminance = getRelativeLuminance({ r: 0, g: 0, b: 0 })
      expect(luminance).toBeCloseTo(0.0, 2)
    })

    it("calculates luminance for gray", () => {
      const luminance = getRelativeLuminance({ r: 128, g: 128, b: 128 })
      expect(luminance).toBeGreaterThan(0)
      expect(luminance).toBeLessThan(1)
    })

    it("weights RGB channels correctly (green highest)", () => {
      const redLum = getRelativeLuminance({ r: 255, g: 0, b: 0 })
      const greenLum = getRelativeLuminance({ r: 0, g: 255, b: 0 })
      const blueLum = getRelativeLuminance({ r: 0, g: 0, b: 255 })

      // Green should have highest luminance contribution
      expect(greenLum).toBeGreaterThan(redLum)
      expect(greenLum).toBeGreaterThan(blueLum)
      expect(redLum).toBeGreaterThan(blueLum)
    })
  })

  describe("getContrastRatio", () => {
    it("returns 21:1 for black on white", () => {
      const ratio = getContrastRatio(
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 }
      )
      expect(ratio).toBeCloseTo(21, 0)
    })

    it("returns 21:1 for white on black", () => {
      const ratio = getContrastRatio(
        { r: 255, g: 255, b: 255 },
        { r: 0, g: 0, b: 0 }
      )
      expect(ratio).toBeCloseTo(21, 0)
    })

    it("returns 1:1 for same colors", () => {
      const ratio = getContrastRatio(
        { r: 128, g: 128, b: 128 },
        { r: 128, g: 128, b: 128 }
      )
      expect(ratio).toBeCloseTo(1, 2)
    })

    it("calculates intermediate contrast ratios", () => {
      // Dark gray on white should be high contrast but not maximum
      const ratio = getContrastRatio(
        { r: 64, g: 64, b: 64 },
        { r: 255, g: 255, b: 255 }
      )
      expect(ratio).toBeGreaterThan(7) // Should pass AAA
      expect(ratio).toBeLessThan(21)
    })
  })

  describe("checkContrast", () => {
    it("checks black on white (passes all)", () => {
      const result = checkContrast("#000000", "#ffffff")

      expect(result).not.toBeNull()
      expect(result!.ratio).toBeCloseTo(21, 0)
      expect(result!.passesAA).toBe(true)
      expect(result!.passesAALarge).toBe(true)
      expect(result!.passesAAA).toBe(true)
      expect(result!.passesAAALarge).toBe(true)
    })

    it("checks gray on white (may fail some levels)", () => {
      // Light gray (#767676) is the minimum for AA at 4.5:1
      const result = checkContrast("#767676", "#ffffff")

      expect(result).not.toBeNull()
      expect(result!.ratio).toBeGreaterThanOrEqual(4.5)
      expect(result!.passesAA).toBe(true)
      expect(result!.passesAALarge).toBe(true)
    })

    it("fails for low contrast colors", () => {
      // Very light gray on white
      const result = checkContrast("#cccccc", "#ffffff")

      expect(result).not.toBeNull()
      expect(result!.passesAA).toBe(false)
    })

    it("returns formatted ratio string", () => {
      const result = checkContrast("#000000", "#ffffff")
      expect(result!.ratioString).toMatch(/^\d+\.\d+:1$/)
    })

    it("stores original colors in result", () => {
      const result = checkContrast("#333333", "#ffffff")
      expect(result!.foreground).toBe("#333333")
      expect(result!.background).toBe("#ffffff")
    })

    it("returns null for invalid colors", () => {
      expect(checkContrast("invalid", "#ffffff")).toBeNull()
      expect(checkContrast("#000000", "invalid")).toBeNull()
    })

    it("works with hsl colors", () => {
      const result = checkContrast("hsl(0 0% 0%)", "hsl(0 0% 100%)")
      expect(result).not.toBeNull()
      expect(result!.ratio).toBeCloseTo(21, 0)
    })

    it("works with rgb colors", () => {
      const result = checkContrast("rgb(0, 0, 0)", "rgb(255, 255, 255)")
      expect(result).not.toBeNull()
      expect(result!.ratio).toBeCloseTo(21, 0)
    })

    it("works with named colors", () => {
      const result = checkContrast("black", "white")
      expect(result).not.toBeNull()
      expect(result!.ratio).toBeCloseTo(21, 0)
    })
  })

  describe("suggestAccessibleColor", () => {
    it("suggests darker color for light background", () => {
      const suggestion = suggestAccessibleColor("#cccccc", "#ffffff", "AA")

      expect(suggestion).not.toBeNull()
      const result = checkContrast(suggestion!, "#ffffff")
      expect(result!.passesAA).toBe(true)
    })

    it("suggests lighter color for dark background", () => {
      const suggestion = suggestAccessibleColor("#333333", "#000000", "AA")

      expect(suggestion).not.toBeNull()
      const result = checkContrast(suggestion!, "#000000")
      expect(result!.passesAA).toBe(true)
    })

    it("suggests AAA-compliant color when requested", () => {
      const suggestion = suggestAccessibleColor("#888888", "#ffffff", "AAA")

      expect(suggestion).not.toBeNull()
      const result = checkContrast(suggestion!, "#ffffff")
      expect(result!.passesAAA).toBe(true)
    })

    it("returns null for invalid colors", () => {
      expect(suggestAccessibleColor("invalid", "#ffffff")).toBeNull()
    })
  })
})

// ============================================================================
// ARIA Validation Tests
// ============================================================================

describe("ARIA Validation", () => {
  describe("ariaRoleRequirements", () => {
    it("defines requirements for common roles", () => {
      expect(ariaRoleRequirements.button).toBeDefined()
      expect(ariaRoleRequirements.checkbox).toBeDefined()
      expect(ariaRoleRequirements.dialog).toBeDefined()
      expect(ariaRoleRequirements.slider).toBeDefined()
    })

    it("specifies required attributes", () => {
      expect(ariaRoleRequirements.checkbox.required).toContain("aria-checked")
      expect(ariaRoleRequirements.slider.required).toContain("aria-valuenow")
    })

    it("specifies supported attributes", () => {
      expect(ariaRoleRequirements.button.supported).toContain("aria-pressed")
      expect(ariaRoleRequirements.button.supported).toContain("aria-expanded")
    })
  })

  describe("getRoleRequirements", () => {
    it("returns requirements for valid roles", () => {
      const req = getRoleRequirements("button")
      expect(req).not.toBeNull()
      expect(req!.role).toBe("button")
    })

    it("returns null for unknown roles", () => {
      expect(getRoleRequirements("unknownrole" as AriaRole)).toBeNull()
    })
  })

  describe("validateAriaForRole", () => {
    it("returns no issues for valid button", () => {
      const issues = validateAriaForRole("button", {})
      expect(issues).toHaveLength(0)
    })

    it("returns error for checkbox without aria-checked", () => {
      const issues = validateAriaForRole("checkbox", {})

      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].severity).toBe("error")
      expect(issues[0].message).toContain("aria-checked")
    })

    it("returns no issues for checkbox with aria-checked", () => {
      const issues = validateAriaForRole("checkbox", { "aria-checked": "false" })
      expect(issues).toHaveLength(0)
    })

    it("returns error for slider without aria-valuenow", () => {
      const issues = validateAriaForRole("slider", {})

      expect(issues.length).toBeGreaterThan(0)
      expect(issues.some((i) => i.message.includes("aria-valuenow"))).toBe(true)
    })

    it("returns warning for unsupported attributes", () => {
      const issues = validateAriaForRole("button", { "aria-valuenow": "50" })

      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].severity).toBe("warning")
    })

    it("includes WCAG criterion in issues", () => {
      const issues = validateAriaForRole("checkbox", {})

      expect(issues[0].criterion).toBe("4.1.2")
    })

    it("provides suggestions for missing attributes", () => {
      const issues = validateAriaForRole("checkbox", {})

      expect(issues[0].suggestion).toBeDefined()
      expect(issues[0].suggestion).toContain("aria-checked")
    })
  })
})

// ============================================================================
// Component Requirements Tests
// ============================================================================

describe("Component A11y Requirements", () => {
  describe("componentA11yRequirements", () => {
    it("defines requirements for common components", () => {
      expect(componentA11yRequirements.button).toBeDefined()
      expect(componentA11yRequirements.dialog).toBeDefined()
      expect(componentA11yRequirements.tabs).toBeDefined()
      expect(componentA11yRequirements.menu).toBeDefined()
    })

    it("specifies keyboard interactions", () => {
      const button = componentA11yRequirements.button
      expect(button.keyboardInteractions).toContain("Enter to activate")
      expect(button.keyboardInteractions).toContain("Space to activate")
    })

    it("specifies focus management requirements", () => {
      const dialog = componentA11yRequirements.dialog
      expect(dialog.focusManagement).toContain("Focus trap within dialog")
      expect(dialog.focusManagement).toContain("Return focus on close")
    })
  })

  describe("getComponentRequirements", () => {
    it("returns requirements for valid component", () => {
      const req = getComponentRequirements("button")
      expect(req).not.toBeNull()
      expect(req!.component).toBe("button")
    })

    it("is case insensitive", () => {
      const req = getComponentRequirements("DIALOG")
      expect(req).not.toBeNull()
      expect(req!.component).toBe("dialog")
    })

    it("returns null for unknown components", () => {
      expect(getComponentRequirements("unknowncomponent")).toBeNull()
    })
  })
})

// ============================================================================
// Focus and Target Size Tests
// ============================================================================

describe("Focus and Target Size", () => {
  describe("focusIndicatorRequirements", () => {
    it("defines minimum contrast ratio", () => {
      expect(focusIndicatorRequirements.minContrast).toBe(3.0)
    })

    it("requires focus not be obscured", () => {
      expect(focusIndicatorRequirements.notObscured).toBe(true)
    })
  })

  describe("targetSizeRequirements", () => {
    it("defines AA minimum size (24px)", () => {
      expect(targetSizeRequirements.minSizeAA).toBe(24)
    })

    it("defines AAA minimum size (44px)", () => {
      expect(targetSizeRequirements.minSizeAAA).toBe(44)
    })
  })

  describe("checkTargetSize", () => {
    it("passes for AA with 24x24 target", () => {
      const result = checkTargetSize(24, 24, "AA")
      expect(result.passes).toBe(true)
    })

    it("fails for AA with 23x23 target", () => {
      const result = checkTargetSize(23, 23, "AA")
      expect(result.passes).toBe(false)
    })

    it("passes for AAA with 44x44 target", () => {
      const result = checkTargetSize(44, 44, "AAA")
      expect(result.passes).toBe(true)
    })

    it("fails for AAA with 43x43 target", () => {
      const result = checkTargetSize(43, 43, "AAA")
      expect(result.passes).toBe(false)
    })

    it("uses smallest dimension", () => {
      const result = checkTargetSize(100, 20, "AA")
      expect(result.passes).toBe(false)
      expect(result.actual).toBe(20)
    })

    it("returns required and actual sizes", () => {
      const result = checkTargetSize(30, 30, "AA")
      expect(result.required).toBe(24)
      expect(result.actual).toBe(30)
    })

    it("defaults to AA level", () => {
      const result = checkTargetSize(24, 24)
      expect(result.passes).toBe(true)
      expect(result.required).toBe(24)
    })
  })
})

// ============================================================================
// Keyboard Accessibility Tests
// ============================================================================

describe("Keyboard Accessibility", () => {
  describe("keyboardPatterns", () => {
    it("defines patterns for common roles", () => {
      expect(keyboardPatterns.button).toBeDefined()
      expect(keyboardPatterns.menu).toBeDefined()
      expect(keyboardPatterns.dialog).toBeDefined()
    })

    it("includes expected keys for button", () => {
      const buttonKeys = keyboardPatterns.button.flatMap((p) => p.keys)
      expect(buttonKeys).toContain("Enter")
      expect(buttonKeys).toContain("Space")
    })

    it("includes arrow keys for menu", () => {
      const menuKeys = keyboardPatterns.menu.flatMap((p) => p.keys)
      expect(menuKeys).toContain("ArrowUp")
      expect(menuKeys).toContain("ArrowDown")
    })

    it("includes Escape for dialog", () => {
      const dialogKeys = keyboardPatterns.dialog.flatMap((p) => p.keys)
      expect(dialogKeys).toContain("Escape")
    })
  })

  describe("getKeyboardPattern", () => {
    it("returns patterns for valid role", () => {
      const pattern = getKeyboardPattern("button")
      expect(pattern.length).toBeGreaterThan(0)
    })

    it("returns empty array for unknown role", () => {
      const pattern = getKeyboardPattern("unknownrole")
      expect(pattern).toHaveLength(0)
    })
  })

  describe("validateKeyboardAccessibility", () => {
    it("passes for button with Enter and Space", () => {
      const result = validateKeyboardAccessibility("button", ["Enter", "Space"])
      expect(result.keyboardInteractions).toBe(true)
    })

    it("fails for button without Enter", () => {
      const result = validateKeyboardAccessibility("button", ["Space"])
      expect(result.keyboardInteractions).toBe(false)
    })

    it("passes for unknown role (no requirements)", () => {
      const result = validateKeyboardAccessibility(
        "unknownrole" as AriaRole,
        []
      )
      expect(result.keyboardInteractions).toBe(true)
    })

    it("indicates dialog should trap focus", () => {
      const result = validateKeyboardAccessibility("dialog", ["Escape", "Tab"])
      expect(result.noTrap).toBe(false) // Dialogs should trap
    })

    it("indicates non-dialog should not trap focus", () => {
      const result = validateKeyboardAccessibility("button", ["Enter", "Space"])
      expect(result.noTrap).toBe(true)
    })
  })
})

// ============================================================================
// Screen Reader Tests
// ============================================================================

describe("Screen Reader Validation", () => {
  describe("validateScreenReader", () => {
    it("passes for element with aria-label", () => {
      const result = validateScreenReader({
        role: "button",
        ariaLabel: "Submit form",
      })

      expect(result.hasAccessibleName).toBe(true)
      expect(result.accessibleName).toBe("Submit form")
    })

    it("passes for element with text content", () => {
      const result = validateScreenReader({
        role: "button",
        textContent: "Submit",
      })

      expect(result.hasAccessibleName).toBe(true)
      expect(result.accessibleName).toBe("Submit")
    })

    it("fails for element without accessible name", () => {
      const result = validateScreenReader({
        role: "button",
      })

      expect(result.hasAccessibleName).toBe(false)
    })

    it("detects missing required ARIA attributes", () => {
      const result = validateScreenReader(
        {
          role: "checkbox",
          ariaLabel: "Toggle feature",
          ariaAttributes: {},
        },
        "checkbox"
      )

      expect(result.hasRequiredAria).toBe(false)
      expect(result.missingAttributes).toContain("aria-checked")
    })

    it("passes when all required ARIA present", () => {
      const result = validateScreenReader(
        {
          role: "checkbox",
          ariaLabel: "Toggle feature",
          ariaAttributes: { "aria-checked": "false" },
        },
        "checkbox"
      )

      expect(result.hasRequiredAria).toBe(true)
    })

    it("verifies role matches expected", () => {
      const result = validateScreenReader(
        { role: "button", textContent: "Click" },
        "button"
      )
      expect(result.hasRole).toBe(true)

      const mismatch = validateScreenReader(
        { role: "link", textContent: "Click" },
        "button"
      )
      expect(mismatch.hasRole).toBe(false)
    })
  })
})

// ============================================================================
// Audit Function Tests
// ============================================================================

describe("Audit Functions", () => {
  describe("createIssue", () => {
    it("creates a complete issue object", () => {
      const issue = createIssue(
        "contrast-fail",
        "1.4.3",
        "AA",
        "error",
        "Contrast too low",
        {
          element: "body text",
          suggestion: "Use darker color",
          context: { ratio: 3.5 },
        }
      )

      expect(issue.id).toBe("contrast-fail")
      expect(issue.criterion).toBe("1.4.3")
      expect(issue.level).toBe("AA")
      expect(issue.severity).toBe("error")
      expect(issue.message).toBe("Contrast too low")
      expect(issue.element).toBe("body text")
      expect(issue.suggestion).toBe("Use darker color")
      expect(issue.context).toEqual({ ratio: 3.5 })
    })

    it("creates minimal issue without options", () => {
      const issue = createIssue("test", "1.1.1", "A", "warning", "Test message")

      expect(issue.id).toBe("test")
      expect(issue.element).toBeUndefined()
    })
  })

  describe("auditContrast", () => {
    it("returns no issues for good contrast", () => {
      const issues = auditContrast([
        { foreground: "#000000", background: "#ffffff" },
      ])

      expect(issues).toHaveLength(0)
    })

    it("returns issue for poor contrast", () => {
      const issues = auditContrast([
        { foreground: "#cccccc", background: "#ffffff", element: "light text" },
      ])

      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].element).toBe("light text")
    })

    it("checks AAA level when configured", () => {
      // #707070 on white has ~5:1 contrast - passes AA (4.5:1) but fails AAA (7:1)
      const issues = auditContrast(
        [{ foreground: "#707070", background: "#ffffff" }],
        { level: "AAA" }
      )

      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].criterion).toBe("1.4.6")
    })

    it("returns warning for unparseable colors", () => {
      const issues = auditContrast([
        { foreground: "invalid", background: "#ffffff" },
      ])

      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].severity).toBe("warning")
    })
  })

  describe("auditAria", () => {
    it("returns no issues for valid ARIA usage", () => {
      const issues = auditAria([
        { role: "button", attributes: {} },
        { role: "checkbox", attributes: { "aria-checked": "false" } },
      ])

      expect(issues).toHaveLength(0)
    })

    it("returns issues for missing required attributes", () => {
      const issues = auditAria([
        { role: "checkbox", attributes: {}, element: "checkbox1" },
      ])

      expect(issues.length).toBeGreaterThan(0)
      expect(issues[0].element).toBe("checkbox1")
    })
  })

  describe("calculateScore", () => {
    it("returns 100 for no issues", () => {
      expect(calculateScore([])).toBe(100)
    })

    it("deducts more for Level A errors", () => {
      const issueA: AccessibilityIssue = {
        id: "test",
        criterion: "1.1.1",
        level: "A",
        severity: "error",
        message: "Test",
      }

      const issueAA: AccessibilityIssue = {
        id: "test",
        criterion: "1.4.3",
        level: "AA",
        severity: "error",
        message: "Test",
      }

      const scoreA = calculateScore([issueA])
      const scoreAA = calculateScore([issueAA])

      expect(scoreA).toBeLessThan(scoreAA)
    })

    it("deducts less for warnings than errors", () => {
      const error: AccessibilityIssue = {
        id: "test",
        criterion: "1.4.3",
        level: "AA",
        severity: "error",
        message: "Test",
      }

      const warning: AccessibilityIssue = {
        id: "test",
        criterion: "1.4.3",
        level: "AA",
        severity: "warning",
        message: "Test",
      }

      const scoreError = calculateScore([error])
      const scoreWarning = calculateScore([warning])

      expect(scoreWarning).toBeGreaterThan(scoreError)
    })

    it("never goes below 0", () => {
      const manyErrors: AccessibilityIssue[] = Array(20).fill({
        id: "test",
        criterion: "1.1.1",
        level: "A",
        severity: "error",
        message: "Test",
      })

      expect(calculateScore(manyErrors)).toBe(0)
    })
  })

  describe("audit (full)", () => {
    it("combines contrast and ARIA audits", () => {
      const result = audit({
        contrast: [
          { foreground: "#cccccc", background: "#ffffff" },
        ],
        aria: [
          { role: "checkbox", attributes: {} },
        ],
      })

      expect(result.totalIssues).toBeGreaterThanOrEqual(2)
    })

    it("returns passed=true when no errors", () => {
      const result = audit({
        contrast: [
          { foreground: "#000000", background: "#ffffff" },
        ],
        aria: [
          { role: "button", attributes: {} },
        ],
      })

      expect(result.passed).toBe(true)
    })

    it("returns passed=false when errors exist", () => {
      const result = audit({
        contrast: [
          { foreground: "#cccccc", background: "#ffffff" },
        ],
      })

      expect(result.passed).toBe(false)
    })

    it("includes custom issues", () => {
      const customIssue: AccessibilityIssue = {
        id: "custom",
        criterion: "2.4.7",
        level: "AA",
        severity: "error",
        message: "No visible focus indicator",
      }

      const result = audit({
        customIssues: [customIssue],
      })

      expect(result.issues).toContainEqual(customIssue)
    })

    it("filters by skipCriteria", () => {
      const result = audit(
        {
          contrast: [
            { foreground: "#cccccc", background: "#ffffff" },
          ],
        },
        { skipCriteria: ["1.4.3"] }
      )

      expect(result.issues.every((i) => i.criterion !== "1.4.3")).toBe(true)
    })

    it("calculates issues by severity", () => {
      const result = audit({
        contrast: [
          { foreground: "#cccccc", background: "#ffffff" },
        ],
      })

      expect(result.bySeverity.errors).toBeGreaterThan(0)
      expect(result.bySeverity.warnings).toBeDefined()
      expect(result.bySeverity.info).toBeDefined()
    })

    it("calculates issues by WCAG level", () => {
      const result = audit({
        contrast: [
          { foreground: "#cccccc", background: "#ffffff" },
        ],
      })

      expect(result.byLevel.A).toBeDefined()
      expect(result.byLevel.AA).toBeGreaterThan(0)
      expect(result.byLevel.AAA).toBeDefined()
    })

    it("includes timestamp", () => {
      const result = audit({})
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    it("calculates accessibility score", () => {
      const goodResult = audit({
        contrast: [{ foreground: "#000000", background: "#ffffff" }],
      })

      const badResult = audit({
        contrast: [{ foreground: "#eeeeee", background: "#ffffff" }],
      })

      expect(goodResult.score).toBe(100)
      expect(badResult.score).toBeLessThan(100)
    })
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration Tests", () => {
  it("audits a complete button component", () => {
    const result = audit({
      contrast: [
        { foreground: "#ffffff", background: "#2563eb", element: "button text" },
      ],
      aria: [
        { role: "button", attributes: { "aria-pressed": "false" }, element: "toggle" },
      ],
    })

    expect(result.passed).toBe(true)
    expect(result.score).toBe(100)
  })

  it("audits a form with multiple elements", () => {
    const result = audit({
      contrast: [
        { foreground: "#374151", background: "#ffffff", element: "label" },
        // Dark red on white for error text has good contrast
        { foreground: "#b91c1c", background: "#ffffff", element: "error text" },
      ],
      aria: [
        { role: "textbox", attributes: { "aria-invalid": "true" }, element: "email input" },
        { role: "button", attributes: {}, element: "submit button" },
      ],
    })

    // Should pass - all colors have sufficient contrast
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0)
  })

  it("generates component requirements and validates", () => {
    const dialogReqs = getComponentRequirements("dialog")
    expect(dialogReqs).not.toBeNull()

    // Validate a dialog implementation
    const screenReaderCheck = validateScreenReader({
      role: "dialog",
      ariaLabel: "Settings",
      ariaAttributes: {
        "aria-modal": "true",
      },
    })

    expect(screenReaderCheck.hasAccessibleName).toBe(true)
    expect(screenReaderCheck.hasRole).toBe(true)
  })

  it("end-to-end: suggests fixes for failing contrast", () => {
    const fg = "#999999"
    const bg = "#ffffff"

    // Check original fails
    const original = checkContrast(fg, bg)
    expect(original!.passesAA).toBe(false)

    // Get suggestion
    const suggestion = suggestAccessibleColor(fg, bg, "AA")
    expect(suggestion).not.toBeNull()

    // Verify suggestion passes
    const fixed = checkContrast(suggestion!, bg)
    expect(fixed!.passesAA).toBe(true)
  })
})

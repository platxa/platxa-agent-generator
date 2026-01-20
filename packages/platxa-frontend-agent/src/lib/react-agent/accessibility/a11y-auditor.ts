/**
 * Accessibility Auditor
 *
 * WCAG 2.2 compliance checking including contrast ratio calculation,
 * ARIA validation, keyboard navigation checks, and screen reader compatibility.
 */

import type {
  WcagLevel,
  WcagCriterion,
  IssueSeverity,
  RgbColor,
  ContrastResult,
  AriaRole,
  AriaRoleRequirements,
  AccessibilityIssue,
  AuditResult,
  ComponentA11yRequirements,
  FocusIndicatorRequirements,
  TargetSizeRequirements,
  AuditConfig,
  KeyboardCheckResult,
  ScreenReaderCheck,
} from "./types"

// ============================================================================
// Color Parsing and Conversion
// ============================================================================

/**
 * Parses a hex color to RGB
 */
export function hexToRgb(hex: string): RgbColor | null {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!match) {
    // Try short hex format
    const shortMatch = hex.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i)
    if (!shortMatch) return null
    return {
      r: parseInt(shortMatch[1] + shortMatch[1], 16),
      g: parseInt(shortMatch[2] + shortMatch[2], 16),
      b: parseInt(shortMatch[3] + shortMatch[3], 16),
    }
  }
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  }
}

/**
 * Parses an RGB/RGBA string to components
 */
export function parseRgbString(rgb: string): RgbColor | null {
  const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!match) return null
  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
  }
}

/**
 * Parses an HSL string to RGB
 */
export function hslToRgb(hsl: string): RgbColor | null {
  const match = hsl.match(/hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%/)
  if (!match) return null

  const h = parseInt(match[1], 10) / 360
  const s = parseInt(match[2], 10) / 100
  const l = parseInt(match[3], 10) / 100

  if (s === 0) {
    const gray = Math.round(l * 255)
    return { r: gray, g: gray, b: gray }
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

/**
 * Parses any color format to RGB
 */
export function parseColor(color: string): RgbColor | null {
  const trimmed = color.trim().toLowerCase()

  // Named colors (common subset)
  const namedColors: Record<string, RgbColor> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    orange: { r: 255, g: 165, b: 0 },
    purple: { r: 128, g: 0, b: 128 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
  }

  if (namedColors[trimmed]) {
    return namedColors[trimmed]
  }

  if (trimmed.startsWith("#")) {
    return hexToRgb(trimmed)
  }

  if (trimmed.startsWith("rgb")) {
    return parseRgbString(trimmed)
  }

  if (trimmed.startsWith("hsl")) {
    return hslToRgb(trimmed)
  }

  // Try hex without #
  if (/^[a-f0-9]{3,6}$/i.test(trimmed)) {
    return hexToRgb(trimmed)
  }

  return null
}

// ============================================================================
// Contrast Ratio Calculation (WCAG 2.1)
// ============================================================================

/**
 * Calculates relative luminance of an RGB color
 * Per WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(rgb: RgbColor): number {
  const sRGB = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
}

/**
 * Calculates contrast ratio between two colors
 * Per WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function getContrastRatio(
  foreground: RgbColor,
  background: RgbColor
): number {
  const l1 = getRelativeLuminance(foreground)
  const l2 = getRelativeLuminance(background)

  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Checks contrast ratio between two colors
 * Returns detailed result with pass/fail for all WCAG levels
 */
export function checkContrast(
  foreground: string,
  background: string
): ContrastResult | null {
  const fg = parseColor(foreground)
  const bg = parseColor(background)

  if (!fg || !bg) return null

  const ratio = getContrastRatio(fg, bg)
  const roundedRatio = Math.round(ratio * 100) / 100

  return {
    ratio: roundedRatio,
    ratioString: `${roundedRatio.toFixed(2)}:1`,
    passesAA: ratio >= 4.5, // Normal text
    passesAALarge: ratio >= 3.0, // Large text (18pt+ or 14pt+ bold)
    passesAAA: ratio >= 7.0, // Enhanced normal text
    passesAAALarge: ratio >= 4.5, // Enhanced large text
    foreground,
    background,
  }
}

/**
 * Suggests an accessible alternative color with sufficient contrast
 */
export function suggestAccessibleColor(
  foreground: string,
  background: string,
  targetLevel: WcagLevel = "AA"
): string | null {
  const bg = parseColor(background)
  const fg = parseColor(foreground)

  if (!bg || !fg) return null

  const targetRatio = targetLevel === "AAA" ? 7.0 : 4.5
  const bgLuminance = getRelativeLuminance(bg)

  // Determine if we should go lighter or darker
  const goLighter = bgLuminance < 0.5

  // Binary search for the right lightness adjustment
  let color = { ...fg }
  let step = 128
  let attempts = 0
  const maxAttempts = 20

  while (attempts < maxAttempts) {
    const ratio = getContrastRatio(color, bg)

    if (ratio >= targetRatio && ratio < targetRatio + 0.5) {
      // Good enough
      break
    }

    if (ratio < targetRatio) {
      // Need more contrast
      if (goLighter) {
        color = {
          r: Math.min(255, color.r + step),
          g: Math.min(255, color.g + step),
          b: Math.min(255, color.b + step),
        }
      } else {
        color = {
          r: Math.max(0, color.r - step),
          g: Math.max(0, color.g - step),
          b: Math.max(0, color.b - step),
        }
      }
    } else {
      // Too much contrast, back off a bit (optional refinement)
      step = Math.max(1, Math.floor(step / 2))
    }

    step = Math.max(1, Math.floor(step / 2))
    attempts++
  }

  const toHex = (n: number) => n.toString(16).padStart(2, "0")
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

// ============================================================================
// ARIA Role Requirements
// ============================================================================

/**
 * Required attributes for common ARIA roles
 */
export const ariaRoleRequirements: Record<string, AriaRoleRequirements> = {
  button: {
    role: "button",
    required: [],
    supported: [
      "aria-pressed",
      "aria-expanded",
      "aria-disabled",
      "aria-label",
      "aria-describedby",
    ],
  },
  checkbox: {
    role: "checkbox",
    required: ["aria-checked"],
    supported: ["aria-disabled", "aria-required", "aria-invalid"],
  },
  combobox: {
    role: "combobox",
    required: ["aria-controls", "aria-expanded"],
    supported: [
      "aria-autocomplete",
      "aria-activedescendant",
      "aria-required",
      "aria-invalid",
    ],
  },
  dialog: {
    role: "dialog",
    required: [],
    supported: ["aria-labelledby", "aria-describedby", "aria-modal"],
  },
  alertdialog: {
    role: "alertdialog",
    required: [],
    supported: ["aria-labelledby", "aria-describedby", "aria-modal"],
  },
  grid: {
    role: "grid",
    required: [],
    supported: ["aria-multiselectable", "aria-readonly", "aria-activedescendant"],
    allowedChildren: ["row", "rowgroup"],
  },
  gridcell: {
    role: "gridcell",
    required: [],
    supported: ["aria-selected", "aria-readonly", "aria-required"],
    requiredParent: ["row"],
  },
  link: {
    role: "link",
    required: [],
    supported: ["aria-current", "aria-disabled", "aria-expanded"],
  },
  listbox: {
    role: "listbox",
    required: [],
    supported: [
      "aria-multiselectable",
      "aria-required",
      "aria-activedescendant",
      "aria-orientation",
    ],
    allowedChildren: ["option"],
  },
  menu: {
    role: "menu",
    required: [],
    supported: ["aria-activedescendant", "aria-orientation"],
    allowedChildren: ["menuitem", "menuitemcheckbox", "menuitemradio"],
  },
  menuitem: {
    role: "menuitem",
    required: [],
    supported: ["aria-disabled", "aria-expanded", "aria-haspopup"],
    requiredParent: ["menu", "menubar"],
  },
  option: {
    role: "option",
    required: [],
    supported: ["aria-selected", "aria-disabled", "aria-checked"],
    requiredParent: ["listbox"],
  },
  progressbar: {
    role: "progressbar",
    required: [],
    supported: ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-valuetext"],
  },
  radio: {
    role: "radio",
    required: ["aria-checked"],
    supported: ["aria-disabled", "aria-required"],
    requiredParent: ["radiogroup"],
  },
  radiogroup: {
    role: "radiogroup",
    required: [],
    supported: ["aria-required", "aria-readonly", "aria-orientation"],
    allowedChildren: ["radio"],
  },
  slider: {
    role: "slider",
    required: ["aria-valuenow"],
    supported: ["aria-valuemin", "aria-valuemax", "aria-valuetext", "aria-orientation"],
  },
  spinbutton: {
    role: "spinbutton",
    required: ["aria-valuenow"],
    supported: ["aria-valuemin", "aria-valuemax", "aria-valuetext", "aria-required"],
  },
  switch: {
    role: "switch",
    required: ["aria-checked"],
    supported: ["aria-disabled", "aria-readonly"],
  },
  tab: {
    role: "tab",
    required: [],
    supported: ["aria-selected", "aria-controls", "aria-disabled"],
    requiredParent: ["tablist"],
  },
  tablist: {
    role: "tablist",
    required: [],
    supported: ["aria-orientation", "aria-multiselectable", "aria-activedescendant"],
    allowedChildren: ["tab"],
  },
  tabpanel: {
    role: "tabpanel",
    required: [],
    supported: ["aria-labelledby"],
  },
  textbox: {
    role: "textbox",
    required: [],
    supported: [
      "aria-multiline",
      "aria-readonly",
      "aria-required",
      "aria-invalid",
      "aria-autocomplete",
      "aria-activedescendant",
    ],
  },
  tree: {
    role: "tree",
    required: [],
    supported: ["aria-multiselectable", "aria-orientation", "aria-activedescendant"],
    allowedChildren: ["treeitem"],
  },
  treeitem: {
    role: "treeitem",
    required: [],
    supported: ["aria-expanded", "aria-selected", "aria-level", "aria-posinset", "aria-setsize"],
    requiredParent: ["tree", "treeitem"],
  },
}

/**
 * Gets role requirements for a given role
 */
export function getRoleRequirements(role: AriaRole): AriaRoleRequirements | null {
  return ariaRoleRequirements[role] || null
}

/**
 * Validates ARIA attributes for a given role
 */
export function validateAriaForRole(
  role: AriaRole,
  attributes: Record<string, string | undefined>
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const requirements = getRoleRequirements(role)

  if (!requirements) {
    return issues
  }

  // Check required attributes
  for (const attr of requirements.required) {
    if (attributes[attr] === undefined) {
      issues.push({
        id: `aria-required-${attr}`,
        criterion: "4.1.2",
        level: "A",
        severity: "error",
        message: `Role "${role}" requires the "${attr}" attribute`,
        suggestion: `Add ${attr}="${getDefaultAriaValue(attr)}" to the element`,
        context: { role, missingAttribute: attr },
      })
    }
  }

  // Check for unsupported attributes
  const allSupported = [...requirements.required, ...requirements.supported]
  for (const attr of Object.keys(attributes)) {
    if (attr.startsWith("aria-") && !allSupported.includes(attr)) {
      issues.push({
        id: `aria-unsupported-${attr}`,
        criterion: "4.1.2",
        level: "AA",
        severity: "warning",
        message: `Attribute "${attr}" is not supported on role "${role}"`,
        suggestion: `Consider removing "${attr}" or verify it's appropriate for this role`,
        context: { role, unsupportedAttribute: attr },
      })
    }
  }

  return issues
}

/**
 * Gets a reasonable default value for an ARIA attribute
 */
function getDefaultAriaValue(attr: string): string {
  const defaults: Record<string, string> = {
    "aria-checked": "false",
    "aria-expanded": "false",
    "aria-hidden": "false",
    "aria-selected": "false",
    "aria-disabled": "false",
    "aria-valuenow": "0",
    "aria-valuemin": "0",
    "aria-valuemax": "100",
    "aria-controls": "[ID of controlled element]",
  }
  return defaults[attr] || "[value]"
}

// ============================================================================
// Component A11y Requirements
// ============================================================================

/**
 * Accessibility requirements for common UI components
 */
export const componentA11yRequirements: Record<string, ComponentA11yRequirements> = {
  button: {
    component: "button",
    role: "button",
    requiredAttributes: ["aria-label or text content"],
    keyboardInteractions: ["Enter to activate", "Space to activate"],
    focusManagement: ["Must be focusable", "Visible focus indicator"],
    announcements: ["Button name", "Button state if applicable"],
  },
  checkbox: {
    component: "checkbox",
    role: "checkbox",
    requiredAttributes: ["aria-checked"],
    keyboardInteractions: ["Space to toggle"],
    focusManagement: ["Must be focusable", "Visible focus indicator"],
    announcements: ["Checkbox name", "Checked state"],
  },
  dialog: {
    component: "dialog",
    role: "dialog",
    requiredAttributes: ["aria-labelledby or aria-label", "aria-modal"],
    keyboardInteractions: ["Escape to close", "Tab to navigate within"],
    focusManagement: ["Focus trap within dialog", "Return focus on close"],
    announcements: ["Dialog title", "Dialog content"],
  },
  dropdown: {
    component: "dropdown",
    role: "combobox",
    requiredAttributes: ["aria-expanded", "aria-controls", "aria-haspopup"],
    keyboardInteractions: [
      "Enter/Space to open",
      "Arrow keys to navigate",
      "Escape to close",
    ],
    focusManagement: ["Focus on trigger when closed", "Focus on first item when open"],
    announcements: ["Current selection", "Expanded state"],
  },
  tabs: {
    component: "tabs",
    role: "tablist",
    requiredAttributes: ["role on tabs", "aria-selected on active tab"],
    keyboardInteractions: [
      "Arrow keys to switch tabs",
      "Home/End for first/last",
      "Tab to enter/exit",
    ],
    focusManagement: ["Only active tab in tab order"],
    announcements: ["Tab name", "Selected state", "Position in set"],
  },
  menu: {
    component: "menu",
    role: "menu",
    requiredAttributes: ["aria-orientation"],
    keyboardInteractions: [
      "Arrow keys to navigate",
      "Enter to select",
      "Escape to close",
    ],
    focusManagement: ["Focus on first item when opened"],
    announcements: ["Menu item names", "Submenus if present"],
  },
  slider: {
    component: "slider",
    role: "slider",
    requiredAttributes: ["aria-valuenow", "aria-valuemin", "aria-valuemax"],
    keyboardInteractions: [
      "Arrow keys to adjust",
      "Home/End for min/max",
      "Page Up/Down for large steps",
    ],
    focusManagement: ["Must be focusable"],
    announcements: ["Current value", "Min/max values"],
  },
  toast: {
    component: "toast",
    role: "status",
    requiredAttributes: ["role=status or role=alert"],
    keyboardInteractions: ["May have dismiss action"],
    focusManagement: ["Should not steal focus"],
    announcements: ["Toast message (polite for status, assertive for alert)"],
  },
  tooltip: {
    component: "tooltip",
    role: "tooltip",
    requiredAttributes: ["aria-describedby on trigger"],
    keyboardInteractions: ["Escape to dismiss", "Show on focus"],
    focusManagement: ["Trigger must be focusable"],
    announcements: ["Tooltip content when shown"],
  },
}

/**
 * Gets accessibility requirements for a component type
 */
export function getComponentRequirements(
  component: string
): ComponentA11yRequirements | null {
  return componentA11yRequirements[component.toLowerCase()] || null
}

// ============================================================================
// Focus and Target Size Requirements
// ============================================================================

/**
 * WCAG 2.2 focus indicator requirements
 */
export const focusIndicatorRequirements: FocusIndicatorRequirements = {
  minArea: 1, // At least 1px perimeter (2.4.11 simplified)
  minContrast: 3.0, // 3:1 against adjacent colors
  notObscured: true, // Must be visible
  twoColorIndicator: true, // Recommended for visibility on any background
}

/**
 * WCAG 2.2 target size requirements
 */
export const targetSizeRequirements: TargetSizeRequirements = {
  minSizeAA: 24, // 24x24 CSS pixels for AA (2.5.8)
  minSizeAAA: 44, // 44x44 CSS pixels for AAA (2.5.5)
  minSpacing: 0, // No minimum if size is met
}

/**
 * Checks if a target meets WCAG size requirements
 */
export function checkTargetSize(
  width: number,
  height: number,
  level: WcagLevel = "AA"
): { passes: boolean; required: number; actual: number } {
  const minSize =
    level === "AAA"
      ? targetSizeRequirements.minSizeAAA
      : targetSizeRequirements.minSizeAA

  const actual = Math.min(width, height)
  return {
    passes: actual >= minSize,
    required: minSize,
    actual,
  }
}

// ============================================================================
// Keyboard Navigation Checks
// ============================================================================

/**
 * Expected keyboard interactions for components
 */
export const keyboardPatterns: Record<
  string,
  { keys: string[]; description: string }[]
> = {
  button: [
    { keys: ["Enter", "Space"], description: "Activate button" },
  ],
  link: [
    { keys: ["Enter"], description: "Follow link" },
  ],
  checkbox: [
    { keys: ["Space"], description: "Toggle checked state" },
  ],
  radio: [
    { keys: ["ArrowUp", "ArrowLeft"], description: "Select previous option" },
    { keys: ["ArrowDown", "ArrowRight"], description: "Select next option" },
  ],
  tablist: [
    { keys: ["ArrowLeft", "ArrowRight"], description: "Navigate tabs (horizontal)" },
    { keys: ["ArrowUp", "ArrowDown"], description: "Navigate tabs (vertical)" },
    { keys: ["Home"], description: "First tab" },
    { keys: ["End"], description: "Last tab" },
  ],
  menu: [
    { keys: ["ArrowUp"], description: "Previous item" },
    { keys: ["ArrowDown"], description: "Next item" },
    { keys: ["Enter", "Space"], description: "Select item" },
    { keys: ["Escape"], description: "Close menu" },
  ],
  dialog: [
    { keys: ["Escape"], description: "Close dialog" },
    { keys: ["Tab"], description: "Navigate within (trapped)" },
  ],
  slider: [
    { keys: ["ArrowRight", "ArrowUp"], description: "Increase value" },
    { keys: ["ArrowLeft", "ArrowDown"], description: "Decrease value" },
    { keys: ["Home"], description: "Minimum value" },
    { keys: ["End"], description: "Maximum value" },
  ],
  listbox: [
    { keys: ["ArrowUp"], description: "Previous option" },
    { keys: ["ArrowDown"], description: "Next option" },
    { keys: ["Home"], description: "First option" },
    { keys: ["End"], description: "Last option" },
    { keys: ["Space"], description: "Select option" },
  ],
}

/**
 * Gets expected keyboard interactions for a role
 */
export function getKeyboardPattern(
  role: string
): { keys: string[]; description: string }[] {
  return keyboardPatterns[role] || []
}

/**
 * Validates keyboard accessibility for a component spec
 */
export function validateKeyboardAccessibility(
  role: AriaRole,
  implementedKeys: string[]
): KeyboardCheckResult {
  const pattern = keyboardPatterns[role]

  if (!pattern) {
    return {
      focusable: true,
      visibleFocus: true, // Assumed for now
      noTrap: true,
      logicalOrder: true,
      keyboardInteractions: true, // No specific requirements
    }
  }

  const requiredKeys = new Set(pattern.flatMap((p) => p.keys))
  const implemented = new Set(implementedKeys)

  const hasAllRequired = [...requiredKeys].every((k) => implemented.has(k))

  return {
    focusable: true,
    visibleFocus: true,
    noTrap: role !== "dialog", // Dialogs should trap focus
    logicalOrder: true,
    keyboardInteractions: hasAllRequired,
  }
}

// ============================================================================
// Screen Reader Checks
// ============================================================================

/**
 * Validates screen reader compatibility
 */
export function validateScreenReader(
  element: {
    role?: string
    ariaLabel?: string
    ariaLabelledBy?: string
    textContent?: string
    ariaAttributes?: Record<string, string>
  },
  expectedRole?: AriaRole
): ScreenReaderCheck {
  const hasAccessibleName = Boolean(
    element.ariaLabel || element.ariaLabelledBy || element.textContent
  )

  const accessibleName =
    element.ariaLabel || element.ariaLabelledBy || element.textContent

  const hasRole = Boolean(element.role)
  const roleMatches = expectedRole ? element.role === expectedRole : hasRole

  // Check ARIA attributes if role is specified
  let hasRequiredAria = true
  const missingAttributes: string[] = []

  if (element.role && ariaRoleRequirements[element.role]) {
    const requirements = ariaRoleRequirements[element.role]
    for (const attr of requirements.required) {
      if (!element.ariaAttributes?.[attr]) {
        hasRequiredAria = false
        missingAttributes.push(attr)
      }
    }
  }

  return {
    hasAccessibleName,
    accessibleName: accessibleName || undefined,
    hasRole: roleMatches,
    role: element.role,
    hasRequiredAria,
    missingAttributes: missingAttributes.length > 0 ? missingAttributes : undefined,
  }
}

// ============================================================================
// Audit Functions
// ============================================================================

/**
 * Creates an accessibility issue
 */
export function createIssue(
  id: string,
  criterion: WcagCriterion,
  level: WcagLevel,
  severity: IssueSeverity,
  message: string,
  options?: {
    element?: string
    suggestion?: string
    context?: Record<string, unknown>
  }
): AccessibilityIssue {
  return {
    id,
    criterion,
    level,
    severity,
    message,
    ...options,
  }
}

/**
 * Audits color contrast in a component
 */
export function auditContrast(
  colors: Array<{ foreground: string; background: string; element?: string }>,
  config: AuditConfig = {}
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []
  const targetLevel = config.level || "AA"

  for (const { foreground, background, element } of colors) {
    const result = checkContrast(foreground, background)

    if (!result) {
      issues.push(
        createIssue(
          "contrast-parse-error",
          "1.4.3",
          "AA",
          "warning",
          `Could not parse colors: ${foreground} on ${background}`,
          { element }
        )
      )
      continue
    }

    if (targetLevel === "AAA" && !result.passesAAA) {
      issues.push(
        createIssue(
          "contrast-aaa-fail",
          "1.4.6",
          "AAA",
          "error",
          `Contrast ratio ${result.ratioString} does not meet AAA (7:1 required)`,
          {
            element,
            suggestion: `Consider using a color with higher contrast`,
            context: { ratio: result.ratio, required: 7.0 },
          }
        )
      )
    } else if (!result.passesAA) {
      issues.push(
        createIssue(
          "contrast-aa-fail",
          "1.4.3",
          "AA",
          "error",
          `Contrast ratio ${result.ratioString} does not meet AA (4.5:1 required)`,
          {
            element,
            suggestion: `Use a color with at least 4.5:1 contrast ratio`,
            context: { ratio: result.ratio, required: 4.5 },
          }
        )
      )
    }
  }

  return issues
}

/**
 * Audits ARIA usage in a component
 */
export function auditAria(
  elements: Array<{
    role: AriaRole
    attributes: Record<string, string | undefined>
    element?: string
  }>
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = []

  for (const { role, attributes, element } of elements) {
    const roleIssues = validateAriaForRole(role, attributes)
    for (const issue of roleIssues) {
      issues.push({
        ...issue,
        element: element || issue.element,
      })
    }
  }

  return issues
}

/**
 * Calculates accessibility score based on issues
 */
export function calculateScore(issues: AccessibilityIssue[]): number {
  if (issues.length === 0) return 100

  let deductions = 0

  for (const issue of issues) {
    switch (issue.severity) {
      case "error":
        deductions += issue.level === "A" ? 15 : issue.level === "AA" ? 10 : 5
        break
      case "warning":
        deductions += 3
        break
      case "info":
        deductions += 1
        break
    }
  }

  return Math.max(0, 100 - deductions)
}

/**
 * Performs a complete accessibility audit
 */
export function audit(
  checks: {
    contrast?: Array<{ foreground: string; background: string; element?: string }>
    aria?: Array<{
      role: AriaRole
      attributes: Record<string, string | undefined>
      element?: string
    }>
    customIssues?: AccessibilityIssue[]
  },
  config: AuditConfig = {}
): AuditResult {
  const allIssues: AccessibilityIssue[] = []

  // Run contrast checks
  if (checks.contrast) {
    allIssues.push(...auditContrast(checks.contrast, config))
  }

  // Run ARIA checks
  if (checks.aria) {
    allIssues.push(...auditAria(checks.aria))
  }

  // Add custom issues
  if (checks.customIssues) {
    allIssues.push(...checks.customIssues)
  }

  // Filter by config
  let filteredIssues = allIssues

  if (!config.includeWarnings) {
    filteredIssues = filteredIssues.filter(
      (i) => i.severity !== "warning" || config.includeWarnings
    )
  }

  if (!config.includeInfo) {
    filteredIssues = filteredIssues.filter(
      (i) => i.severity !== "info" || config.includeInfo
    )
  }

  if (config.skipCriteria?.length) {
    filteredIssues = filteredIssues.filter(
      (i) => !config.skipCriteria!.includes(i.criterion)
    )
  }

  // Calculate summary
  const bySeverity = {
    errors: filteredIssues.filter((i) => i.severity === "error").length,
    warnings: filteredIssues.filter((i) => i.severity === "warning").length,
    info: filteredIssues.filter((i) => i.severity === "info").length,
  }

  const byLevel = {
    A: filteredIssues.filter((i) => i.level === "A").length,
    AA: filteredIssues.filter((i) => i.level === "AA").length,
    AAA: filteredIssues.filter((i) => i.level === "AAA").length,
  }

  return {
    passed: bySeverity.errors === 0,
    totalIssues: filteredIssues.length,
    bySeverity,
    byLevel,
    issues: filteredIssues,
    score: calculateScore(filteredIssues),
    timestamp: new Date(),
  }
}

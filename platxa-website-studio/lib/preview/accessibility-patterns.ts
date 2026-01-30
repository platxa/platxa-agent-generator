/**
 * Accessibility Error Patterns
 *
 * Feature #143: Add accessibility error patterns (contrast, labels, focus)
 * Verification: Patterns for: low contrast, missing alt, no focus visible, missing ARIA
 */

// ============================================================================
// Types
// ============================================================================

/** Accessibility error category */
export type A11yErrorCategory =
  | "contrast"
  | "alt-text"
  | "focus"
  | "aria"
  | "keyboard"
  | "semantics"
  | "forms"
  | "headings"
  | "landmarks"
  | "other";

/** Accessibility error severity */
export type A11ySeverity = "critical" | "serious" | "moderate" | "minor";

/** WCAG conformance level */
export type WCAGLevel = "A" | "AA" | "AAA";

/** Accessibility error pattern */
export interface A11yPattern {
  /** Unique pattern ID */
  id: string;
  /** Pattern name */
  name: string;
  /** Error category */
  category: A11yErrorCategory;
  /** Severity level */
  severity: A11ySeverity;
  /** WCAG success criterion */
  wcag?: string;
  /** WCAG conformance level */
  level?: WCAGLevel;
  /** Regex patterns to match error messages */
  messagePatterns: RegExp[];
  /** Description of the issue */
  description: string;
  /** How to fix the issue */
  remediation: string;
  /** Impact on users */
  impact: string;
  /** Affected user groups */
  affectedGroups: string[];
}

/** Matched accessibility error */
export interface A11yError {
  /** Pattern that matched */
  pattern: A11yPattern;
  /** Original error message */
  message: string;
  /** Element selector if available */
  selector?: string;
  /** Source file */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/** Detection result */
export interface A11yDetectionResult {
  /** Whether an accessibility error was detected */
  isA11yError: boolean;
  /** Matched error if detected */
  error?: A11yError;
  /** Confidence level (0-1) */
  confidence: number;
}

/** Detection statistics */
export interface A11yDetectionStats {
  /** Total errors detected */
  totalErrors: number;
  /** Errors by category */
  byCategory: Map<A11yErrorCategory, number>;
  /** Errors by severity */
  bySeverity: Map<A11ySeverity, number>;
  /** Errors by WCAG level */
  byLevel: Map<WCAGLevel, number>;
  /** Most common patterns */
  topPatterns: Array<{ patternId: string; count: number }>;
}

/** Detector change callback */
export type A11yChangeCallback = (error: A11yError) => void;

/** Detector options */
export interface A11yDetectorOptions {
  /** Minimum severity to report */
  minSeverity?: A11ySeverity;
  /** Categories to include (all if not specified) */
  categories?: A11yErrorCategory[];
  /** Custom patterns to add */
  customPatterns?: A11yPattern[];
  /** Whether to include remediation in output */
  includeRemediation?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Severity priority (lower = more severe) */
export const SEVERITY_PRIORITY: Record<A11ySeverity, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

/** All accessibility categories */
export const ALL_CATEGORIES: A11yErrorCategory[] = [
  "contrast",
  "alt-text",
  "focus",
  "aria",
  "keyboard",
  "semantics",
  "forms",
  "headings",
  "landmarks",
  "other",
];

// ============================================================================
// Built-in Patterns
// ============================================================================

/** Low contrast patterns */
export const CONTRAST_PATTERNS: A11yPattern[] = [
  {
    id: "contrast-ratio-fail",
    name: "Insufficient Color Contrast",
    category: "contrast",
    severity: "serious",
    wcag: "1.4.3",
    level: "AA",
    messagePatterns: [
      /contrast ratio/i,
      /color contrast/i,
      /insufficient contrast/i,
      /low contrast/i,
      /contrast.*fails/i,
      /text.*contrast.*\d+(\.\d+)?:\d+/i,
      /foreground.*background.*contrast/i,
    ],
    description: "Text color does not have sufficient contrast with background",
    remediation: "Increase the contrast ratio to at least 4.5:1 for normal text or 3:1 for large text",
    impact: "Users with low vision or color blindness may not be able to read the text",
    affectedGroups: ["low-vision", "color-blindness"],
  },
  {
    id: "contrast-ratio-aaa",
    name: "Enhanced Contrast Not Met",
    category: "contrast",
    severity: "minor",
    wcag: "1.4.6",
    level: "AAA",
    messagePatterns: [
      /enhanced contrast/i,
      /aaa.*contrast/i,
      /contrast.*7:1/i,
    ],
    description: "Text does not meet enhanced contrast requirements (AAA)",
    remediation: "Increase contrast ratio to 7:1 for normal text or 4.5:1 for large text",
    impact: "Users with significant vision impairment may have difficulty reading",
    affectedGroups: ["low-vision"],
  },
  {
    id: "non-text-contrast",
    name: "Non-Text Contrast Issue",
    category: "contrast",
    severity: "moderate",
    wcag: "1.4.11",
    level: "AA",
    messagePatterns: [
      /non-text contrast/i,
      /graphical.*contrast/i,
      /ui component.*contrast/i,
      /icon.*contrast/i,
      /border.*contrast/i,
    ],
    description: "UI component or graphical object does not have sufficient contrast",
    remediation: "Ensure UI components and graphics have at least 3:1 contrast ratio",
    impact: "Users may not perceive interactive elements or important graphics",
    affectedGroups: ["low-vision", "color-blindness"],
  },
];

/** Missing alt text patterns */
export const ALT_TEXT_PATTERNS: A11yPattern[] = [
  {
    id: "missing-alt",
    name: "Missing Alt Text",
    category: "alt-text",
    severity: "critical",
    wcag: "1.1.1",
    level: "A",
    messagePatterns: [
      /missing alt/i,
      /alt attribute.*missing/i,
      /image.*alt/i,
      /img.*alt/i,
      /no alt text/i,
      /alt.*required/i,
      /alternative text.*missing/i,
    ],
    description: "Image is missing alternative text",
    remediation: "Add descriptive alt attribute to the image element",
    impact: "Screen reader users will not know what the image represents",
    affectedGroups: ["blind", "low-vision", "cognitive"],
  },
  {
    id: "empty-alt",
    name: "Empty Alt Text on Informative Image",
    category: "alt-text",
    severity: "serious",
    wcag: "1.1.1",
    level: "A",
    messagePatterns: [
      /empty alt/i,
      /alt="".*informative/i,
      /blank alt/i,
      /alt.*empty.*not decorative/i,
    ],
    description: "Informative image has empty alt text",
    remediation: "Provide meaningful alt text that describes the image content",
    impact: "Users will miss important visual information",
    affectedGroups: ["blind", "low-vision"],
  },
  {
    id: "decorative-alt",
    name: "Decorative Image with Non-Empty Alt",
    category: "alt-text",
    severity: "minor",
    wcag: "1.1.1",
    level: "A",
    messagePatterns: [
      /decorative.*alt/i,
      /alt.*decorative/i,
      /role="presentation".*alt/i,
    ],
    description: "Decorative image should have empty alt text",
    remediation: 'Use alt="" or role="presentation" for decorative images',
    impact: "Screen reader users may be confused by unnecessary alt text",
    affectedGroups: ["blind"],
  },
  {
    id: "redundant-alt",
    name: "Redundant Alt Text",
    category: "alt-text",
    severity: "minor",
    wcag: "1.1.1",
    level: "A",
    messagePatterns: [
      /redundant.*alt/i,
      /alt.*redundant/i,
      /image of.*image/i,
      /photo of.*photo/i,
      /picture of.*picture/i,
    ],
    description: "Alt text contains redundant phrases like 'image of'",
    remediation: "Remove redundant phrases; describe the image content directly",
    impact: "Screen reader users hear unnecessary repetition",
    affectedGroups: ["blind"],
  },
];

/** Focus visibility patterns */
export const FOCUS_PATTERNS: A11yPattern[] = [
  {
    id: "focus-not-visible",
    name: "Focus Not Visible",
    category: "focus",
    severity: "serious",
    wcag: "2.4.7",
    level: "AA",
    messagePatterns: [
      /focus.*not visible/i,
      /focus.*indicator.*missing/i,
      /no focus.*indicator/i,
      /no.*visible.*focus/i,
      /no.*focus.*style/i,
      /focus.*style.*none/i,
      /outline.*none/i,
      /focus.*hidden/i,
      /missing.*focus/i,
      /focus ring.*removed/i,
    ],
    description: "Focused element does not have a visible focus indicator",
    remediation: "Ensure all focusable elements have a visible focus style",
    impact: "Keyboard users cannot see which element is currently focused",
    affectedGroups: ["motor-disabilities", "low-vision", "cognitive"],
  },
  {
    id: "focus-order",
    name: "Illogical Focus Order",
    category: "focus",
    severity: "moderate",
    wcag: "2.4.3",
    level: "A",
    messagePatterns: [
      /focus order/i,
      /tab order/i,
      /tabindex.*positive/i,
      /focus.*sequence/i,
      /illogical.*focus/i,
    ],
    description: "Focus order does not follow a logical sequence",
    remediation: "Ensure focus order follows the visual reading order; avoid positive tabindex",
    impact: "Keyboard users may become confused by unexpected focus movement",
    affectedGroups: ["motor-disabilities", "cognitive"],
  },
  {
    id: "focus-trap",
    name: "Focus Trap",
    category: "focus",
    severity: "critical",
    wcag: "2.1.2",
    level: "A",
    messagePatterns: [
      /focus trap/i,
      /keyboard trap/i,
      /trapped.*focus/i,
      /cannot.*escape/i,
      /focus.*stuck/i,
    ],
    description: "User cannot move focus away from an element using keyboard",
    remediation: "Ensure users can always navigate away from any element using keyboard",
    impact: "Keyboard users become trapped and cannot use the page",
    affectedGroups: ["motor-disabilities", "blind"],
  },
  {
    id: "focus-moved",
    name: "Focus Moved Unexpectedly",
    category: "focus",
    severity: "moderate",
    wcag: "3.2.1",
    level: "A",
    messagePatterns: [
      /focus.*moved/i,
      /focus.*changed/i,
      /unexpected.*focus/i,
      /focus.*redirect/i,
    ],
    description: "Focus is moved without user action",
    remediation: "Only move focus in response to user-initiated actions",
    impact: "Users may lose their place on the page",
    affectedGroups: ["motor-disabilities", "cognitive", "blind"],
  },
];

/** ARIA patterns */
export const ARIA_PATTERNS: A11yPattern[] = [
  {
    id: "missing-aria-label",
    name: "Missing ARIA Label",
    category: "aria",
    severity: "serious",
    wcag: "4.1.2",
    level: "A",
    messagePatterns: [
      /missing.*aria-label/i,
      /aria-label.*required/i,
      /no.*aria-label/i,
      /accessible name.*missing/i,
      /label.*missing/i,
      /unlabeled/i,
    ],
    description: "Interactive element is missing an accessible name",
    remediation: "Add aria-label, aria-labelledby, or visible label text",
    impact: "Screen reader users will not know the purpose of the element",
    affectedGroups: ["blind", "low-vision"],
  },
  {
    id: "invalid-aria-role",
    name: "Invalid ARIA Role",
    category: "aria",
    severity: "serious",
    wcag: "4.1.2",
    level: "A",
    messagePatterns: [
      /invalid.*role/i,
      /role.*invalid/i,
      /unknown role/i,
      /unsupported.*role/i,
      /aria role.*not valid/i,
    ],
    description: "Element has an invalid or unsupported ARIA role",
    remediation: "Use a valid ARIA role from the WAI-ARIA specification",
    impact: "Assistive technologies may not interpret the element correctly",
    affectedGroups: ["blind", "low-vision"],
  },
  {
    id: "missing-required-aria",
    name: "Missing Required ARIA Attribute",
    category: "aria",
    severity: "serious",
    wcag: "4.1.2",
    level: "A",
    messagePatterns: [
      /required.*aria/i,
      /aria.*required/i,
      /missing.*aria-/i,
      /aria-.*missing/i,
      /must have.*aria/i,
    ],
    description: "Element is missing a required ARIA attribute for its role",
    remediation: "Add the required ARIA attributes for the element's role",
    impact: "Assistive technologies cannot fully convey element state/properties",
    affectedGroups: ["blind", "low-vision"],
  },
  {
    id: "aria-hidden-focusable",
    name: "Hidden Element is Focusable",
    category: "aria",
    severity: "serious",
    wcag: "4.1.2",
    level: "A",
    messagePatterns: [
      /aria-hidden.*focusable/i,
      /focusable.*aria-hidden/i,
      /hidden.*can receive focus/i,
      /aria-hidden="true".*tabindex/i,
    ],
    description: "Element with aria-hidden can still receive keyboard focus",
    remediation: 'Add tabindex="-1" to elements with aria-hidden="true"',
    impact: "Keyboard users may focus on invisible elements",
    affectedGroups: ["motor-disabilities", "blind"],
  },
  {
    id: "invalid-aria-value",
    name: "Invalid ARIA Attribute Value",
    category: "aria",
    severity: "moderate",
    wcag: "4.1.2",
    level: "A",
    messagePatterns: [
      /invalid.*aria.*value/i,
      /aria.*invalid value/i,
      /aria-.*out of range/i,
      /aria-.*must be/i,
    ],
    description: "ARIA attribute has an invalid value",
    remediation: "Use valid values as defined in the WAI-ARIA specification",
    impact: "Assistive technologies may misinterpret the element",
    affectedGroups: ["blind", "low-vision"],
  },
  {
    id: "duplicate-id",
    name: "Duplicate ID Referenced by ARIA",
    category: "aria",
    severity: "serious",
    wcag: "4.1.1",
    level: "A",
    messagePatterns: [
      /duplicate id/i,
      /id.*duplicate/i,
      /aria-labelledby.*not found/i,
      /aria-describedby.*not found/i,
      /referenced.*id.*missing/i,
    ],
    description: "ARIA attribute references an ID that is duplicated or missing",
    remediation: "Ensure all IDs are unique and exist in the document",
    impact: "Assistive technologies may reference wrong or missing content",
    affectedGroups: ["blind", "low-vision"],
  },
];

/** Keyboard accessibility patterns */
export const KEYBOARD_PATTERNS: A11yPattern[] = [
  {
    id: "not-keyboard-accessible",
    name: "Element Not Keyboard Accessible",
    category: "keyboard",
    severity: "critical",
    wcag: "2.1.1",
    level: "A",
    messagePatterns: [
      /keyboard.*accessible/i,
      /not.*keyboard/i,
      /keyboard.*only/i,
      /no keyboard/i,
      /mouse only/i,
      /click.*only/i,
    ],
    description: "Interactive element cannot be operated with keyboard alone",
    remediation: "Add keyboard event handlers or use native interactive elements",
    impact: "Keyboard-only users cannot interact with the element",
    affectedGroups: ["motor-disabilities", "blind"],
  },
  {
    id: "missing-keyboard-handler",
    name: "Missing Keyboard Event Handler",
    category: "keyboard",
    severity: "serious",
    wcag: "2.1.1",
    level: "A",
    messagePatterns: [
      /onkeydown.*missing/i,
      /onkeyup.*missing/i,
      /onkeypress.*missing/i,
      /keyboard.*handler/i,
      /no.*key.*event/i,
    ],
    description: "Element has click handler but no keyboard handler",
    remediation: "Add onKeyDown handler to respond to Enter/Space key presses",
    impact: "Keyboard users cannot activate the element",
    affectedGroups: ["motor-disabilities", "blind"],
  },
];

/** Semantic patterns */
export const SEMANTIC_PATTERNS: A11yPattern[] = [
  {
    id: "missing-lang",
    name: "Missing Language Attribute",
    category: "semantics",
    severity: "serious",
    wcag: "3.1.1",
    level: "A",
    messagePatterns: [
      /lang.*attribute.*missing/i,
      /missing.*lang/i,
      /no.*language/i,
      /html.*lang/i,
    ],
    description: "Document is missing the lang attribute",
    remediation: "Add lang attribute to the html element",
    impact: "Screen readers may use wrong pronunciation",
    affectedGroups: ["blind", "low-vision"],
  },
  {
    id: "empty-link",
    name: "Empty Link",
    category: "semantics",
    severity: "serious",
    wcag: "2.4.4",
    level: "A",
    messagePatterns: [
      /empty link/i,
      /link.*empty/i,
      /link.*no text/i,
      /no.*link text/i,
    ],
    description: "Link has no accessible text content",
    remediation: "Add text content or aria-label to the link",
    impact: "Users will not know where the link leads",
    affectedGroups: ["blind", "low-vision", "cognitive"],
  },
  {
    id: "empty-button",
    name: "Empty Button",
    category: "semantics",
    severity: "serious",
    wcag: "4.1.2",
    level: "A",
    messagePatterns: [
      /empty button/i,
      /button.*empty/i,
      /button.*no text/i,
      /no.*button text/i,
    ],
    description: "Button has no accessible text content",
    remediation: "Add text content or aria-label to the button",
    impact: "Users will not know what the button does",
    affectedGroups: ["blind", "low-vision", "cognitive"],
  },
];

/** Form patterns */
export const FORM_PATTERNS: A11yPattern[] = [
  {
    id: "missing-form-label",
    name: "Missing Form Label",
    category: "forms",
    severity: "critical",
    wcag: "1.3.1",
    level: "A",
    messagePatterns: [
      /form.*label.*missing/i,
      /input.*label/i,
      /missing.*label/i,
      /no.*label/i,
      /label.*required/i,
      /unlabeled.*input/i,
      /unlabeled.*field/i,
    ],
    description: "Form input is missing an associated label",
    remediation: "Add a label element with matching for/id attributes",
    impact: "Users will not know what information to enter",
    affectedGroups: ["blind", "low-vision", "cognitive"],
  },
  {
    id: "missing-error-message",
    name: "Missing Error Message",
    category: "forms",
    severity: "moderate",
    wcag: "3.3.1",
    level: "A",
    messagePatterns: [
      /error.*message.*missing/i,
      /no.*error.*message/i,
      /validation.*message/i,
    ],
    description: "Form validation error is not communicated to users",
    remediation: "Provide clear error messages associated with form fields",
    impact: "Users may not understand what went wrong",
    affectedGroups: ["blind", "cognitive"],
  },
  {
    id: "autocomplete-missing",
    name: "Missing Autocomplete Attribute",
    category: "forms",
    severity: "moderate",
    wcag: "1.3.5",
    level: "AA",
    messagePatterns: [
      /autocomplete.*missing/i,
      /missing.*autocomplete/i,
      /no.*autocomplete/i,
    ],
    description: "Form field is missing autocomplete attribute",
    remediation: "Add appropriate autocomplete attribute for personal data fields",
    impact: "Users with cognitive disabilities may have difficulty filling forms",
    affectedGroups: ["cognitive", "motor-disabilities"],
  },
];

/** Heading patterns */
export const HEADING_PATTERNS: A11yPattern[] = [
  {
    id: "skipped-heading",
    name: "Skipped Heading Level",
    category: "headings",
    severity: "moderate",
    wcag: "1.3.1",
    level: "A",
    messagePatterns: [
      /heading.*level.*skip/i,
      /skip.*heading/i,
      /h[1-6].*h[1-6]/i,
      /heading.*hierarchy/i,
      /heading.*order/i,
    ],
    description: "Heading levels are not in proper hierarchical order",
    remediation: "Use heading levels in order without skipping (h1, h2, h3, etc.)",
    impact: "Users navigating by headings may become confused",
    affectedGroups: ["blind", "cognitive"],
  },
  {
    id: "missing-h1",
    name: "Missing H1 Heading",
    category: "headings",
    severity: "moderate",
    wcag: "1.3.1",
    level: "A",
    messagePatterns: [
      /missing.*h1/i,
      /no.*h1/i,
      /h1.*missing/i,
      /page.*heading/i,
    ],
    description: "Page is missing an h1 heading",
    remediation: "Add an h1 element that describes the main content",
    impact: "Users may not understand the page purpose",
    affectedGroups: ["blind", "cognitive"],
  },
  {
    id: "empty-heading",
    name: "Empty Heading",
    category: "headings",
    severity: "serious",
    wcag: "1.3.1",
    level: "A",
    messagePatterns: [
      /empty.*heading/i,
      /heading.*empty/i,
      /heading.*no text/i,
    ],
    description: "Heading element has no text content",
    remediation: "Add text content to the heading or remove the heading element",
    impact: "Users navigating by headings will encounter empty entries",
    affectedGroups: ["blind", "cognitive"],
  },
];

/** Landmark patterns */
export const LANDMARK_PATTERNS: A11yPattern[] = [
  {
    id: "missing-main",
    name: "Missing Main Landmark",
    category: "landmarks",
    severity: "moderate",
    wcag: "1.3.1",
    level: "A",
    messagePatterns: [
      /missing.*main/i,
      /no.*main.*landmark/i,
      /main.*region/i,
    ],
    description: "Page is missing a main landmark region",
    remediation: "Add a main element or role='main' to the primary content area",
    impact: "Users cannot quickly navigate to main content",
    affectedGroups: ["blind", "motor-disabilities"],
  },
  {
    id: "duplicate-landmark",
    name: "Duplicate Landmark Without Label",
    category: "landmarks",
    severity: "minor",
    wcag: "1.3.1",
    level: "A",
    messagePatterns: [
      /duplicate.*landmark/i,
      /multiple.*nav/i,
      /multiple.*region/i,
      /landmark.*label/i,
    ],
    description: "Multiple landmarks of same type lack distinguishing labels",
    remediation: "Add aria-label or aria-labelledby to distinguish landmarks",
    impact: "Users may be confused by multiple similar landmarks",
    affectedGroups: ["blind"],
  },
];

/** All built-in patterns */
export const ALL_PATTERNS: A11yPattern[] = [
  ...CONTRAST_PATTERNS,
  ...ALT_TEXT_PATTERNS,
  ...FOCUS_PATTERNS,
  ...ARIA_PATTERNS,
  ...KEYBOARD_PATTERNS,
  ...SEMANTIC_PATTERNS,
  ...FORM_PATTERNS,
  ...HEADING_PATTERNS,
  ...LANDMARK_PATTERNS,
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category: A11yErrorCategory): A11yPattern[] {
  return ALL_PATTERNS.filter((p) => p.category === category);
}

/**
 * Get patterns by severity
 */
export function getPatternsBySeverity(severity: A11ySeverity): A11yPattern[] {
  return ALL_PATTERNS.filter((p) => p.severity === severity);
}

/**
 * Get patterns by WCAG level
 */
export function getPatternsByLevel(level: WCAGLevel): A11yPattern[] {
  return ALL_PATTERNS.filter((p) => p.level === level);
}

/**
 * Get pattern by ID
 */
export function getPatternById(id: string): A11yPattern | undefined {
  return ALL_PATTERNS.find((p) => p.id === id);
}

/**
 * Match message against a pattern
 */
export function matchPattern(message: string, pattern: A11yPattern): boolean {
  return pattern.messagePatterns.some((regex) => regex.test(message));
}

/**
 * Find first matching pattern for a message
 */
export function findMatchingPattern(message: string): A11yPattern | undefined {
  return ALL_PATTERNS.find((pattern) => matchPattern(message, pattern));
}

/**
 * Find all matching patterns for a message
 */
export function findAllMatchingPatterns(message: string): A11yPattern[] {
  return ALL_PATTERNS.filter((pattern) => matchPattern(message, pattern));
}

/**
 * Check if message is an accessibility error
 */
export function isA11yError(message: string): boolean {
  return findMatchingPattern(message) !== undefined;
}

/**
 * Sort patterns by severity
 */
export function sortPatternsBySeverity(patterns: A11yPattern[]): A11yPattern[] {
  return [...patterns].sort(
    (a, b) => SEVERITY_PRIORITY[a.severity] - SEVERITY_PRIORITY[b.severity]
  );
}

/**
 * Format pattern for display
 */
export function formatPattern(pattern: A11yPattern): string {
  const wcagInfo = pattern.wcag ? ` [WCAG ${pattern.wcag} ${pattern.level}]` : "";
  return `[${pattern.severity.toUpperCase()}] ${pattern.name}${wcagInfo}\n` +
    `  Category: ${pattern.category}\n` +
    `  Description: ${pattern.description}\n` +
    `  Fix: ${pattern.remediation}`;
}

/**
 * Format error for display
 */
export function formatA11yError(error: A11yError): string {
  const location = error.file
    ? ` at ${error.file}${error.line ? `:${error.line}` : ""}`
    : "";
  return `${formatPattern(error.pattern)}\n  Message: ${error.message}${location}`;
}

/**
 * Get severity from pattern
 */
export function getSeverityPriority(severity: A11ySeverity): number {
  return SEVERITY_PRIORITY[severity];
}

/**
 * Compare severities (returns negative if a is more severe)
 */
export function compareSeverity(a: A11ySeverity, b: A11ySeverity): number {
  return SEVERITY_PRIORITY[a] - SEVERITY_PRIORITY[b];
}

// ============================================================================
// AccessibilityErrorDetector Class
// ============================================================================

/**
 * Accessibility error detector for identifying a11y issues
 */
export class AccessibilityErrorDetector {
  private patterns: A11yPattern[];
  private minSeverity: A11ySeverity;
  private categories: Set<A11yErrorCategory>;
  private includeRemediation: boolean;
  private errors: A11yError[] = [];

  private changeCallbacks: Set<A11yChangeCallback> = new Set();
  private disposed = false;

  constructor(options: A11yDetectorOptions = {}) {
    this.patterns = [...ALL_PATTERNS, ...(options.customPatterns ?? [])];
    this.minSeverity = options.minSeverity ?? "minor";
    this.categories = new Set(options.categories ?? ALL_CATEGORIES);
    this.includeRemediation = options.includeRemediation ?? true;
  }

  /**
   * Detect accessibility error in message
   */
  detect(
    message: string,
    context?: { selector?: string; file?: string; line?: number; column?: number }
  ): A11yDetectionResult {
    if (this.disposed) {
      throw new Error("AccessibilityErrorDetector is disposed");
    }

    const pattern = this.patterns.find((p) => {
      // Check category filter
      if (!this.categories.has(p.category)) return false;
      // Check severity filter
      if (SEVERITY_PRIORITY[p.severity] > SEVERITY_PRIORITY[this.minSeverity]) return false;
      // Check message match
      return matchPattern(message, p);
    });

    if (!pattern) {
      return { isA11yError: false, confidence: 0 };
    }

    const error: A11yError = {
      pattern,
      message,
      selector: context?.selector,
      file: context?.file,
      line: context?.line,
      column: context?.column,
      timestamp: Date.now(),
    };

    this.errors.push(error);
    this.notifyChange(error);

    // Calculate confidence based on pattern specificity
    const matchCount = pattern.messagePatterns.filter((r) => r.test(message)).length;
    const confidence = Math.min(1, 0.5 + (matchCount * 0.1));

    return { isA11yError: true, error, confidence };
  }

  /**
   * Detect multiple messages
   */
  detectBatch(
    messages: Array<{ message: string; context?: { selector?: string; file?: string; line?: number; column?: number } }>
  ): A11yDetectionResult[] {
    return messages.map(({ message, context }) => this.detect(message, context));
  }

  /**
   * Get all detected errors
   */
  getErrors(): A11yError[] {
    return [...this.errors];
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: A11yErrorCategory): A11yError[] {
    return this.errors.filter((e) => e.pattern.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: A11ySeverity): A11yError[] {
    return this.errors.filter((e) => e.pattern.severity === severity);
  }

  /**
   * Get critical and serious errors
   */
  getCriticalErrors(): A11yError[] {
    return this.errors.filter(
      (e) => e.pattern.severity === "critical" || e.pattern.severity === "serious"
    );
  }

  /**
   * Get statistics
   */
  getStats(): A11yDetectionStats {
    const byCategory = new Map<A11yErrorCategory, number>();
    const bySeverity = new Map<A11ySeverity, number>();
    const byLevel = new Map<WCAGLevel, number>();
    const patternCounts = new Map<string, number>();

    for (const error of this.errors) {
      const { pattern } = error;

      // Count by category
      byCategory.set(pattern.category, (byCategory.get(pattern.category) ?? 0) + 1);

      // Count by severity
      bySeverity.set(pattern.severity, (bySeverity.get(pattern.severity) ?? 0) + 1);

      // Count by level
      if (pattern.level) {
        byLevel.set(pattern.level, (byLevel.get(pattern.level) ?? 0) + 1);
      }

      // Count by pattern
      patternCounts.set(pattern.id, (patternCounts.get(pattern.id) ?? 0) + 1);
    }

    // Get top patterns
    const topPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([patternId, count]) => ({ patternId, count }));

    return {
      totalErrors: this.errors.length,
      byCategory,
      bySeverity,
      byLevel,
      topPatterns,
    };
  }

  /**
   * Clear all detected errors
   */
  clear(): void {
    if (this.disposed) {
      throw new Error("AccessibilityErrorDetector is disposed");
    }
    this.errors = [];
  }

  /**
   * Subscribe to error detection
   */
  onChange(callback: A11yChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("AccessibilityErrorDetector is disposed");
    }

    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: A11yPattern): void {
    if (this.disposed) {
      throw new Error("AccessibilityErrorDetector is disposed");
    }
    this.patterns.push(pattern);
  }

  /**
   * Remove pattern by ID
   */
  removePattern(patternId: string): boolean {
    const index = this.patterns.findIndex((p) => p.id === patternId);
    if (index === -1) return false;
    this.patterns.splice(index, 1);
    return true;
  }

  /**
   * Get all patterns
   */
  getPatterns(): A11yPattern[] {
    return [...this.patterns];
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.errors = [];
    this.patterns = [];
    this.changeCallbacks.clear();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private notifyChange(error: A11yError): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(error);
      } catch (err) {
        console.error("AccessibilityErrorDetector callback error:", err);
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new AccessibilityErrorDetector instance
 */
export function createAccessibilityErrorDetector(
  options?: A11yDetectorOptions
): AccessibilityErrorDetector {
  return new AccessibilityErrorDetector(options);
}

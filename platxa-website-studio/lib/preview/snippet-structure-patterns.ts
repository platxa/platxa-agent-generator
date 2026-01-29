/**
 * Snippet Structure Error Patterns
 *
 * Patterns for detecting structural errors in Odoo website snippets:
 * - Missing oe_structure class
 * - Invalid s_ prefix (snippet naming)
 * - Bad data attributes
 */

// =============================================================================
// Types
// =============================================================================

/** Snippet error types */
export type SnippetErrorType =
  | "missing_oe_structure"
  | "invalid_s_prefix"
  | "bad_data_attribute"
  | "invalid_snippet_id"
  | "missing_data_snippet"
  | "invalid_structure"
  | "unknown";

/** Severity levels */
export type SnippetErrorSeverity = "error" | "warning" | "info";

/** Snippet error pattern definition */
export interface SnippetErrorPattern {
  /** Pattern to match */
  pattern: RegExp;
  /** Error type */
  type: SnippetErrorType;
  /** Severity */
  severity: SnippetErrorSeverity;
  /** Extract details from match */
  extract?: (match: RegExpMatchArray) => SnippetErrorDetails;
  /** Description template */
  description: string;
  /** Suggested fix template */
  fixTemplate: string;
}

/** Extracted error details */
export interface SnippetErrorDetails {
  /** Element or class name */
  element?: string;
  /** Attribute name */
  attribute?: string;
  /** Problematic value */
  value?: string;
  /** Expected format */
  expected?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Detected snippet error */
export interface SnippetError {
  /** Error type */
  type: SnippetErrorType;
  /** Severity */
  severity: SnippetErrorSeverity;
  /** Error message */
  message: string;
  /** Suggested fix */
  suggestedFix: string;
  /** Extracted details */
  details: SnippetErrorDetails;
  /** Original matched text */
  matchedText: string;
  /** Confidence score (0-1) */
  confidence: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Valid snippet prefixes */
export const VALID_SNIPPET_PREFIXES = ["s_", "o_", "oe_"];

/** Required data attributes for snippets */
export const REQUIRED_DATA_ATTRIBUTES = [
  "data-snippet",
  "data-name",
];

/** Common data attributes for snippets */
export const COMMON_DATA_ATTRIBUTES = [
  "data-snippet",
  "data-name",
  "data-selector",
  "data-drop-in",
  "data-drop-near",
  "data-js",
  "data-oe-id",
  "data-oe-model",
  "data-oe-field",
];

/** Structure class requirements */
export const STRUCTURE_CLASSES = [
  "oe_structure",
  "oe_structure_solo",
  "oe_empty",
];

// =============================================================================
// Missing oe_structure Patterns
// =============================================================================

/** Patterns for missing oe_structure errors */
export const MISSING_OE_STRUCTURE_PATTERNS: SnippetErrorPattern[] = [
  {
    pattern: /(?:missing|no)\s+(?:class\s+)?['"]?oe_structure['"]?\s+(?:on|in|for)\s+(?:element|section|container)/i,
    type: "missing_oe_structure",
    severity: "error",
    extract: () => ({ element: "container" }),
    description: "Missing oe_structure class on container element",
    fixTemplate: "Add class='oe_structure' to the container element",
  },
  {
    // Matches: "missing oe_structure", "oe_structure is missing", "oe_structure missing"
    pattern: /(?:(?:missing|no)\s+oe_structure|oe_structure\s+(?:class\s+)?(?:is\s+)?(?:missing|required|not\s+found))/i,
    type: "missing_oe_structure",
    severity: "error",
    extract: () => ({}),
    description: "Required oe_structure class is missing",
    fixTemplate: "Add oe_structure class to enable snippet dropping",
  },
  {
    pattern: /(?:cannot|can't)\s+(?:drop|place)\s+snippet.*(?:without|missing)\s+oe_structure/i,
    type: "missing_oe_structure",
    severity: "error",
    extract: () => ({}),
    description: "Cannot drop snippets without oe_structure class",
    fixTemplate: "Add class='oe_structure' to the drop zone container",
  },
  {
    pattern: /(?:snippet\s+)?drop\s*(?:zone|area)\s+(?:requires|needs)\s+oe_structure/i,
    type: "missing_oe_structure",
    severity: "error",
    extract: () => ({}),
    description: "Snippet drop zone requires oe_structure class",
    fixTemplate: "Ensure the drop zone has class='oe_structure oe_empty'",
  },
  {
    pattern: /element\s+['"]([^'"]+)['"]\s+(?:is\s+)?missing\s+oe_structure/i,
    type: "missing_oe_structure",
    severity: "error",
    extract: (m) => ({ element: m[1] }),
    description: "Element '{element}' is missing oe_structure class",
    fixTemplate: "Add oe_structure class to element '{element}'",
  },
];

// =============================================================================
// Invalid s_ Prefix Patterns
// =============================================================================

/** Patterns for invalid s_ prefix errors */
export const INVALID_S_PREFIX_PATTERNS: SnippetErrorPattern[] = [
  {
    // Matches: "invalid snippet prefix: 'x'", "invalid prefix: 'x'", "wrong prefix: 'test'"
    pattern: /(?:invalid|incorrect|wrong)\s+(?:snippet\s+)?prefix:\s*['"]?([^'"]+)['"]?/i,
    type: "invalid_s_prefix",
    severity: "error",
    extract: (m) => ({ value: m[1], expected: "s_*" }),
    description: "Invalid snippet prefix: '{value}'",
    fixTemplate: "Snippet IDs should start with 's_' prefix (e.g., s_my_snippet)",
  },
  {
    pattern: /snippet\s+(?:id|class)\s+['"]([^'"]+)['"]\s+(?:must|should)\s+start\s+with\s+['"]?s_['"]?/i,
    type: "invalid_s_prefix",
    severity: "error",
    extract: (m) => ({ value: m[1], expected: "s_" }),
    description: "Snippet '{value}' must start with s_ prefix",
    fixTemplate: "Rename snippet to start with 's_' (e.g., s_{value})",
  },
  {
    pattern: /(?:missing|no)\s+s_\s*prefix\s+(?:on|for|in)\s+(?:snippet|element)\s*['"]?([^'"]+)?['"]?/i,
    type: "invalid_s_prefix",
    severity: "error",
    extract: (m) => ({ element: m[1] }),
    description: "Missing s_ prefix on snippet",
    fixTemplate: "Add s_ prefix to snippet ID (e.g., s_snippet_name)",
  },
  {
    pattern: /snippet\s+['"]([^'"]+)['"]\s+(?:has\s+)?(?:invalid|bad|wrong)\s+(?:naming|format)/i,
    type: "invalid_s_prefix",
    severity: "warning",
    extract: (m) => ({ value: m[1] }),
    description: "Snippet '{value}' has invalid naming format",
    fixTemplate: "Use format: s_category_name (e.g., s_banner_hero)",
  },
  {
    pattern: /expected\s+snippet\s+(?:id|name)\s+(?:to\s+)?(?:start|begin)\s+with\s+['"]?s_['"]?\s+(?:but\s+)?(?:got|found)\s+['"]([^'"]+)['"]/i,
    type: "invalid_s_prefix",
    severity: "error",
    extract: (m) => ({ value: m[1], expected: "s_" }),
    description: "Expected snippet ID starting with s_, got '{value}'",
    fixTemplate: "Rename to s_{value} or use proper s_ prefix",
  },
];

// =============================================================================
// Bad Data Attribute Patterns
// =============================================================================

/** Patterns for bad data attribute errors */
export const BAD_DATA_ATTRIBUTE_PATTERNS: SnippetErrorPattern[] = [
  {
    pattern: /(?:missing|no)\s+(?:required\s+)?data-snippet\s+attribute/i,
    type: "bad_data_attribute",
    severity: "error",
    extract: () => ({ attribute: "data-snippet" }),
    description: "Missing required data-snippet attribute",
    fixTemplate: "Add data-snippet='snippet_id' to the snippet element",
  },
  {
    // Matches: "invalid data-name attribute value:", "invalid data-name attribute", "bad data-x value:"
    pattern: /(?:invalid|malformed|bad)\s+data-([a-z-]+)\s+(?:attribute(?:\s+value)?|value)(?:[:\s]|$)/i,
    type: "bad_data_attribute",
    severity: "error",
    extract: (m) => ({ attribute: `data-${m[1]}` }),
    description: "Invalid data-{attribute} attribute",
    fixTemplate: "Check the format of data-{attribute} attribute",
  },
  {
    pattern: /data-([a-z-]+)\s*=\s*['"]?['"]?\s+(?:is\s+)?(?:empty|missing|invalid)/i,
    type: "bad_data_attribute",
    severity: "error",
    extract: (m) => ({ attribute: `data-${m[1]}` }),
    description: "Empty or invalid data-{attribute} value",
    fixTemplate: "Provide a valid value for data-{attribute}",
  },
  {
    pattern: /(?:unknown|unrecognized)\s+data\s+attribute:\s*['"]?(data-[a-z-]+)['"]?/i,
    type: "bad_data_attribute",
    severity: "warning",
    extract: (m) => ({ attribute: m[1] }),
    description: "Unknown data attribute: {attribute}",
    fixTemplate: "Verify {attribute} is a valid Odoo snippet attribute",
  },
  {
    pattern: /data-name\s+(?:attribute\s+)?(?:is\s+)?(?:missing|required|not\s+set)/i,
    type: "bad_data_attribute",
    severity: "warning",
    extract: () => ({ attribute: "data-name" }),
    description: "Missing data-name attribute for snippet",
    fixTemplate: "Add data-name='Snippet Display Name' for editor visibility",
  },
  {
    pattern: /data-selector\s+['"]([^'"]+)['"]\s+(?:does\s+not|doesn't)\s+match/i,
    type: "bad_data_attribute",
    severity: "error",
    extract: (m) => ({ attribute: "data-selector", value: m[1] }),
    description: "data-selector '{value}' does not match any elements",
    fixTemplate: "Update data-selector to match existing CSS selector",
  },
  {
    pattern: /(?:invalid|bad)\s+data-oe-(?:id|model|field):\s*['"]?([^'"]+)['"]?/i,
    type: "bad_data_attribute",
    severity: "error",
    extract: (m) => ({ value: m[1] }),
    description: "Invalid Odoo data attribute value: '{value}'",
    fixTemplate: "Ensure data-oe-* attributes reference valid Odoo records",
  },
];

// =============================================================================
// Additional Structure Patterns
// =============================================================================

/** Patterns for invalid snippet structure */
export const INVALID_STRUCTURE_PATTERNS: SnippetErrorPattern[] = [
  {
    pattern: /snippet\s+(?:must|should)\s+(?:be\s+)?(?:wrapped|inside)\s+(?:a\s+)?section/i,
    type: "invalid_structure",
    severity: "error",
    extract: () => ({}),
    description: "Snippet must be wrapped in a section element",
    fixTemplate: "Wrap snippet content in <section class='s_snippet'>",
  },
  {
    pattern: /(?:invalid|incorrect)\s+snippet\s+(?:structure|hierarchy|nesting)/i,
    type: "invalid_structure",
    severity: "error",
    extract: () => ({}),
    description: "Invalid snippet structure",
    fixTemplate: "Follow Odoo snippet structure: section > container > row > col",
  },
  {
    pattern: /snippet\s+(?:container|wrapper)\s+(?:is\s+)?(?:missing|not\s+found)/i,
    type: "invalid_structure",
    severity: "error",
    extract: () => ({}),
    description: "Snippet container is missing",
    fixTemplate: "Add container div inside the section element",
  },
];

// =============================================================================
// All Patterns Combined
// =============================================================================

/** All snippet error patterns */
export const ALL_SNIPPET_PATTERNS: SnippetErrorPattern[] = [
  ...MISSING_OE_STRUCTURE_PATTERNS,
  ...INVALID_S_PREFIX_PATTERNS,
  ...BAD_DATA_ATTRIBUTE_PATTERNS,
  ...INVALID_STRUCTURE_PATTERNS,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Detects snippet errors from an error message.
 */
export function detectSnippetError(message: string): SnippetError | null {
  for (const pattern of ALL_SNIPPET_PATTERNS) {
    const match = message.match(pattern.pattern);
    if (match) {
      const details = pattern.extract ? pattern.extract(match) : {};
      const description = interpolateTemplate(pattern.description, details);
      const fix = interpolateTemplate(pattern.fixTemplate, details);

      return {
        type: pattern.type,
        severity: pattern.severity,
        message: description,
        suggestedFix: fix,
        details,
        matchedText: match[0],
        confidence: 0.9,
      };
    }
  }

  return null;
}

/**
 * Detects all snippet errors from an error message.
 */
export function detectAllSnippetErrors(message: string): SnippetError[] {
  const errors: SnippetError[] = [];

  for (const pattern of ALL_SNIPPET_PATTERNS) {
    const match = message.match(pattern.pattern);
    if (match) {
      const details = pattern.extract ? pattern.extract(match) : {};
      const description = interpolateTemplate(pattern.description, details);
      const fix = interpolateTemplate(pattern.fixTemplate, details);

      errors.push({
        type: pattern.type,
        severity: pattern.severity,
        message: description,
        suggestedFix: fix,
        details,
        matchedText: match[0],
        confidence: 0.9,
      });
    }
  }

  return errors;
}

/**
 * Interpolates template with details.
 */
export function interpolateTemplate(
  template: string,
  details: SnippetErrorDetails
): string {
  let result = template;
  if (details.element) result = result.replace(/\{element\}/g, details.element);
  if (details.attribute) result = result.replace(/\{attribute\}/g, details.attribute);
  if (details.value) result = result.replace(/\{value\}/g, details.value);
  if (details.expected) result = result.replace(/\{expected\}/g, details.expected);
  return result;
}

/**
 * Checks if an error is a missing oe_structure error.
 */
export function isMissingOeStructureError(message: string): boolean {
  return MISSING_OE_STRUCTURE_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is an invalid s_ prefix error.
 */
export function isInvalidSPrefixError(message: string): boolean {
  return INVALID_S_PREFIX_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is a bad data attribute error.
 */
export function isBadDataAttributeError(message: string): boolean {
  return BAD_DATA_ATTRIBUTE_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Validates a snippet ID format.
 */
export function isValidSnippetId(id: string): boolean {
  return VALID_SNIPPET_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/**
 * Validates that an element has oe_structure class.
 */
export function hasOeStructureClass(classNames: string): boolean {
  const classes = classNames.split(/\s+/);
  return STRUCTURE_CLASSES.some((sc) => classes.includes(sc));
}

/**
 * Checks for required data attributes.
 */
export function findMissingDataAttributes(
  attributes: string[]
): string[] {
  return REQUIRED_DATA_ATTRIBUTES.filter(
    (attr) => !attributes.includes(attr)
  );
}

/**
 * Gets error type statistics.
 */
export function getSnippetErrorStats(
  errors: SnippetError[]
): Record<SnippetErrorType, number> {
  const stats: Record<SnippetErrorType, number> = {
    missing_oe_structure: 0,
    invalid_s_prefix: 0,
    bad_data_attribute: 0,
    invalid_snippet_id: 0,
    missing_data_snippet: 0,
    invalid_structure: 0,
    unknown: 0,
  };

  for (const error of errors) {
    stats[error.type]++;
  }

  return stats;
}

/**
 * Formats a snippet error for display.
 */
export function formatSnippetError(error: SnippetError): string {
  const severityLabel = error.severity.toUpperCase();
  const typeLabel = error.type.replace(/_/g, " ").toUpperCase();

  const parts = [
    `[${severityLabel}] ${typeLabel}`,
    `Message: ${error.message}`,
    `Fix: ${error.suggestedFix}`,
  ];

  return parts.join("\n");
}

// =============================================================================
// SnippetErrorDetector Class
// =============================================================================

/**
 * Service for detecting snippet structure errors.
 */
export class SnippetErrorDetector {
  private patterns: SnippetErrorPattern[];
  private cache: Map<string, SnippetError[]> = new Map();

  constructor(customPatterns: SnippetErrorPattern[] = []) {
    this.patterns = [...ALL_SNIPPET_PATTERNS, ...customPatterns];
  }

  /**
   * Detects errors in an error message.
   */
  detect(message: string): SnippetError[] {
    if (this.cache.has(message)) {
      return this.cache.get(message)!;
    }

    const errors: SnippetError[] = [];

    for (const pattern of this.patterns) {
      const match = message.match(pattern.pattern);
      if (match) {
        const details = pattern.extract ? pattern.extract(match) : {};
        const description = interpolateTemplate(pattern.description, details);
        const fix = interpolateTemplate(pattern.fixTemplate, details);

        errors.push({
          type: pattern.type,
          severity: pattern.severity,
          message: description,
          suggestedFix: fix,
          details,
          matchedText: match[0],
          confidence: 0.9,
        });
      }
    }

    this.cache.set(message, errors);
    return errors;
  }

  /**
   * Detects the first error only.
   */
  detectFirst(message: string): SnippetError | null {
    const errors = this.detect(message);
    return errors.length > 0 ? errors[0] : null;
  }

  /**
   * Checks if message contains any snippet error.
   */
  hasError(message: string): boolean {
    return this.patterns.some((p) => p.pattern.test(message));
  }

  /**
   * Clears the cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Adds custom patterns.
   */
  addPatterns(patterns: SnippetErrorPattern[]): void {
    this.patterns.push(...patterns);
    this.clearCache();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a SnippetErrorDetector instance.
 */
export function createSnippetErrorDetector(
  customPatterns?: SnippetErrorPattern[]
): SnippetErrorDetector {
  return new SnippetErrorDetector(customPatterns);
}

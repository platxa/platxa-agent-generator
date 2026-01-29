/**
 * Odoo Manifest Error Patterns
 *
 * Patterns for detecting and analyzing errors in Odoo __manifest__.py files:
 * - Missing key errors
 * - Invalid syntax errors
 * - Bad dependency errors
 * - Wrong version errors
 */

// =============================================================================
// Types
// =============================================================================

/** Manifest error types */
export type ManifestErrorType =
  | "missing_key"
  | "invalid_syntax"
  | "bad_dependency"
  | "wrong_version"
  | "invalid_value"
  | "unknown";

/** Severity levels */
export type ManifestErrorSeverity = "error" | "warning" | "info";

/** Required manifest keys */
export type RequiredManifestKey =
  | "name"
  | "version"
  | "depends"
  | "author"
  | "category"
  | "summary"
  | "description"
  | "license";

/** Manifest error pattern definition */
export interface ManifestErrorPattern {
  /** Pattern to match */
  pattern: RegExp;
  /** Error type */
  type: ManifestErrorType;
  /** Severity */
  severity: ManifestErrorSeverity;
  /** Extract details from match */
  extract?: (match: RegExpMatchArray) => ManifestErrorDetails;
  /** Description template */
  description: string;
  /** Suggested fix template */
  fixTemplate: string;
}

/** Extracted error details */
export interface ManifestErrorDetails {
  /** The specific key involved */
  key?: string;
  /** The problematic value */
  value?: string;
  /** Expected value or format */
  expected?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Detected manifest error */
export interface ManifestError {
  /** Error type */
  type: ManifestErrorType;
  /** Severity */
  severity: ManifestErrorSeverity;
  /** Error message */
  message: string;
  /** Suggested fix */
  suggestedFix: string;
  /** Extracted details */
  details: ManifestErrorDetails;
  /** Original matched text */
  matchedText: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/** Manifest validation result */
export interface ManifestValidationResult {
  /** Whether manifest is valid */
  isValid: boolean;
  /** Detected errors */
  errors: ManifestError[];
  /** Warnings (non-blocking) */
  warnings: ManifestError[];
  /** Missing required keys */
  missingKeys: RequiredManifestKey[];
}

// =============================================================================
// Constants
// =============================================================================

/** Required keys for a valid Odoo manifest */
export const REQUIRED_MANIFEST_KEYS: RequiredManifestKey[] = [
  "name",
  "version",
  "depends",
];

/** Recommended keys (warnings if missing) */
export const RECOMMENDED_MANIFEST_KEYS: RequiredManifestKey[] = [
  "author",
  "category",
  "summary",
  "license",
];

/** Valid Odoo version formats */
export const VALID_VERSION_PATTERNS = [
  /^\d+\.\d+\.\d+\.\d+\.\d+$/, // Odoo format: 16.0.1.0.0
  /^\d+\.\d+\.\d+$/, // Semantic: 1.0.0
  /^\d+\.\d+$/, // Simple: 1.0
];

/** Valid license values */
export const VALID_LICENSES = [
  "LGPL-3",
  "AGPL-3",
  "GPL-3",
  "GPL-2",
  "OEEL-1",
  "OPL-1",
  "Other proprietary",
];

// =============================================================================
// Missing Key Patterns
// =============================================================================

/** Patterns for missing key errors */
export const MISSING_KEY_PATTERNS: ManifestErrorPattern[] = [
  {
    pattern: /(?:manifest|__manifest__)\s*(?:is\s+)?missing\s+(?:required\s+)?(?:key|field)\s*['"]?(\w+)['"]?/i,
    type: "missing_key",
    severity: "error",
    extract: (m) => ({ key: m[1] }),
    description: "Required manifest key '{key}' is missing",
    fixTemplate: "Add '{key}' to __manifest__.py",
  },
  {
    pattern: /KeyError:\s*['"](\w+)['"]/i,
    type: "missing_key",
    severity: "error",
    extract: (m) => ({ key: m[1] }),
    description: "Manifest key '{key}' not found",
    fixTemplate: "Define '{key}' in __manifest__.py",
  },
  {
    pattern: /required\s+(?:key|field)\s+['"](\w+)['"]\s+(?:is\s+)?(?:missing|not\s+found|undefined)/i,
    type: "missing_key",
    severity: "error",
    extract: (m) => ({ key: m[1] }),
    description: "Required key '{key}' is missing from manifest",
    fixTemplate: "Add the required key '{key}' to your __manifest__.py",
  },
  {
    pattern: /(?:no|missing)\s+['"]?(name|version|depends)['"]?\s+(?:in|found\s+in)\s+manifest/i,
    type: "missing_key",
    severity: "error",
    extract: (m) => ({ key: m[1] }),
    description: "Essential manifest key '{key}' is missing",
    fixTemplate: "The '{key}' key is required in __manifest__.py",
  },
];

// =============================================================================
// Invalid Syntax Patterns
// =============================================================================

/** Patterns for invalid syntax errors */
export const INVALID_SYNTAX_PATTERNS: ManifestErrorPattern[] = [
  {
    pattern: /SyntaxError.*__manifest__\.py/i,
    type: "invalid_syntax",
    severity: "error",
    extract: () => ({}),
    description: "Syntax error in __manifest__.py",
    fixTemplate: "Check __manifest__.py for Python syntax errors",
  },
  {
    pattern: /(?:invalid|malformed)\s+(?:manifest|__manifest__)\s*(?:syntax|format)?/i,
    type: "invalid_syntax",
    severity: "error",
    extract: () => ({}),
    description: "Invalid manifest format",
    fixTemplate: "Ensure __manifest__.py contains a valid Python dictionary",
  },
  {
    pattern: /(?:manifest|__manifest__)\s*(?:is\s+)?not\s+(?:a\s+)?(?:valid\s+)?(?:dict|dictionary)/i,
    type: "invalid_syntax",
    severity: "error",
    extract: () => ({}),
    description: "Manifest must be a Python dictionary",
    fixTemplate: "Wrap manifest content in curly braces: { ... }",
  },
  {
    pattern: /(?:unexpected|invalid)\s+(?:token|character)\s+in\s+(?:manifest|__manifest__)/i,
    type: "invalid_syntax",
    severity: "error",
    extract: () => ({}),
    description: "Unexpected character in manifest",
    fixTemplate: "Remove invalid characters from __manifest__.py",
  },
  {
    pattern: /(?:json|eval)\s+(?:decode|parse)\s+error.*(?:manifest|__manifest__)/i,
    type: "invalid_syntax",
    severity: "error",
    extract: () => ({}),
    description: "Failed to parse manifest file",
    fixTemplate: "Verify manifest contains valid Python dictionary syntax",
  },
];

// =============================================================================
// Bad Dependency Patterns
// =============================================================================

/** Patterns for bad dependency errors */
export const BAD_DEPENDENCY_PATTERNS: ManifestErrorPattern[] = [
  {
    pattern: /(?:module|dependency)\s+['"]([^'"]+)['"]\s+(?:not\s+found|missing|does\s+not\s+exist)/i,
    type: "bad_dependency",
    severity: "error",
    extract: (m) => ({ key: "depends", value: m[1] }),
    description: "Dependency module '{value}' not found",
    fixTemplate: "Install module '{value}' or remove from depends list",
  },
  {
    pattern: /(?:cannot|could\s+not)\s+(?:find|resolve|load)\s+(?:module|dependency)\s+['"]([^'"]+)['"]/i,
    type: "bad_dependency",
    severity: "error",
    extract: (m) => ({ key: "depends", value: m[1] }),
    description: "Cannot resolve dependency '{value}'",
    fixTemplate: "Check if module '{value}' is installed and spelled correctly",
  },
  {
    pattern: /circular\s+dependency.*['"]([^'"]+)['"]/i,
    type: "bad_dependency",
    severity: "error",
    extract: (m) => ({ key: "depends", value: m[1] }),
    description: "Circular dependency detected involving '{value}'",
    fixTemplate: "Refactor modules to eliminate circular dependency with '{value}'",
  },
  {
    pattern: /(?:unmet|unsatisfied)\s+dependency:\s*['"]?([^'"]+)['"]?/i,
    type: "bad_dependency",
    severity: "error",
    extract: (m) => ({ key: "depends", value: m[1] }),
    description: "Unmet dependency: '{value}'",
    fixTemplate: "Install missing dependency '{value}'",
  },
  {
    pattern: /depends\s+(?:on\s+)?(?:invalid|unknown)\s+module\s+['"]([^'"]+)['"]/i,
    type: "bad_dependency",
    severity: "error",
    extract: (m) => ({ key: "depends", value: m[1] }),
    description: "Invalid module in depends: '{value}'",
    fixTemplate: "Verify module name '{value}' is correct",
  },
];

// =============================================================================
// Wrong Version Patterns
// =============================================================================

/** Patterns for wrong version errors */
export const WRONG_VERSION_PATTERNS: ManifestErrorPattern[] = [
  {
    pattern: /(?:invalid|malformed)\s+version\s*(?:format|string)?:\s*['"]?([^'"]+)['"]?/i,
    type: "wrong_version",
    severity: "error",
    extract: (m) => ({ key: "version", value: m[1], expected: "X.Y.Z.A.B format" }),
    description: "Invalid version format: '{value}'",
    fixTemplate: "Use Odoo version format: 16.0.1.0.0",
  },
  {
    pattern: /version\s+['"]([^'"]+)['"]\s+(?:is\s+)?(?:not\s+compatible|incompatible)/i,
    type: "wrong_version",
    severity: "error",
    extract: (m) => ({ key: "version", value: m[1] }),
    description: "Version '{value}' is incompatible",
    fixTemplate: "Update version to be compatible with your Odoo installation",
  },
  {
    pattern: /(?:module|manifest)\s+version\s+['"]([^'"]+)['"]\s+(?:doesn't|does\s+not)\s+match/i,
    type: "wrong_version",
    severity: "warning",
    extract: (m) => ({ key: "version", value: m[1] }),
    description: "Version mismatch: '{value}'",
    fixTemplate: "Align module version with Odoo version",
  },
  {
    pattern: /expected\s+(?:odoo\s+)?version\s+['"]?(\d+\.\d+)['"]?\s+(?:but\s+)?(?:got|found)\s+['"]?([^'"]+)['"]?/i,
    type: "wrong_version",
    severity: "error",
    extract: (m) => ({ key: "version", value: m[2], expected: m[1] }),
    description: "Expected version {expected}, got '{value}'",
    fixTemplate: "Update version to match Odoo {expected}",
  },
  {
    pattern: /version\s+must\s+(?:be|start\s+with)\s+['"]?(\d+\.\d+)['"]?/i,
    type: "wrong_version",
    severity: "error",
    extract: (m) => ({ key: "version", expected: m[1] }),
    description: "Version must start with {expected}",
    fixTemplate: "Set version to {expected}.X.X.X format",
  },
];

// =============================================================================
// All Patterns Combined
// =============================================================================

/** All manifest error patterns */
export const ALL_MANIFEST_PATTERNS: ManifestErrorPattern[] = [
  ...MISSING_KEY_PATTERNS,
  ...INVALID_SYNTAX_PATTERNS,
  ...BAD_DEPENDENCY_PATTERNS,
  ...WRONG_VERSION_PATTERNS,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Detects manifest errors from an error message.
 */
export function detectManifestError(message: string): ManifestError | null {
  for (const pattern of ALL_MANIFEST_PATTERNS) {
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
 * Detects all manifest errors from an error message.
 */
export function detectAllManifestErrors(message: string): ManifestError[] {
  const errors: ManifestError[] = [];

  for (const pattern of ALL_MANIFEST_PATTERNS) {
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
  details: ManifestErrorDetails
): string {
  let result = template;
  if (details.key) result = result.replace(/\{key\}/g, details.key);
  if (details.value) result = result.replace(/\{value\}/g, details.value);
  if (details.expected) result = result.replace(/\{expected\}/g, details.expected);
  return result;
}

/**
 * Checks if an error is a missing key error.
 */
export function isMissingKeyError(message: string): boolean {
  return MISSING_KEY_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is an invalid syntax error.
 */
export function isInvalidSyntaxError(message: string): boolean {
  return INVALID_SYNTAX_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is a bad dependency error.
 */
export function isBadDependencyError(message: string): boolean {
  return BAD_DEPENDENCY_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Checks if an error is a wrong version error.
 */
export function isWrongVersionError(message: string): boolean {
  return WRONG_VERSION_PATTERNS.some((p) => p.pattern.test(message));
}

/**
 * Validates a version string against Odoo format.
 */
export function isValidOdooVersion(version: string): boolean {
  return VALID_VERSION_PATTERNS.some((p) => p.test(version));
}

/**
 * Validates a license value.
 */
export function isValidLicense(license: string): boolean {
  return VALID_LICENSES.includes(license);
}

/**
 * Checks for missing required keys in manifest content.
 */
export function findMissingKeys(
  manifestKeys: string[]
): RequiredManifestKey[] {
  return REQUIRED_MANIFEST_KEYS.filter(
    (key) => !manifestKeys.includes(key)
  );
}

/**
 * Checks for missing recommended keys in manifest content.
 */
export function findMissingRecommendedKeys(
  manifestKeys: string[]
): RequiredManifestKey[] {
  return RECOMMENDED_MANIFEST_KEYS.filter(
    (key) => !manifestKeys.includes(key)
  );
}

/**
 * Gets error type statistics.
 */
export function getManifestErrorStats(
  errors: ManifestError[]
): Record<ManifestErrorType, number> {
  const stats: Record<ManifestErrorType, number> = {
    missing_key: 0,
    invalid_syntax: 0,
    bad_dependency: 0,
    wrong_version: 0,
    invalid_value: 0,
    unknown: 0,
  };

  for (const error of errors) {
    stats[error.type]++;
  }

  return stats;
}

/**
 * Formats a manifest error for display.
 */
export function formatManifestError(error: ManifestError): string {
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
// ManifestErrorDetector Class
// =============================================================================

/**
 * Service for detecting manifest errors.
 */
export class ManifestErrorDetector {
  private patterns: ManifestErrorPattern[];
  private cache: Map<string, ManifestError[]> = new Map();

  constructor(customPatterns: ManifestErrorPattern[] = []) {
    this.patterns = [...ALL_MANIFEST_PATTERNS, ...customPatterns];
  }

  /**
   * Detects errors in an error message.
   */
  detect(message: string): ManifestError[] {
    if (this.cache.has(message)) {
      return this.cache.get(message)!;
    }

    const errors: ManifestError[] = [];

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
  detectFirst(message: string): ManifestError | null {
    const errors = this.detect(message);
    return errors.length > 0 ? errors[0] : null;
  }

  /**
   * Checks if message contains any manifest error.
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
  addPatterns(patterns: ManifestErrorPattern[]): void {
    this.patterns.push(...patterns);
    this.clearCache();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a ManifestErrorDetector instance.
 */
export function createManifestErrorDetector(
  customPatterns?: ManifestErrorPattern[]
): ManifestErrorDetector {
  return new ManifestErrorDetector(customPatterns);
}

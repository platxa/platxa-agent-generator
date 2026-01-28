/**
 * Odoo App Store Submission Validator
 *
 * Checks all marketplace requirements: license, icon, description,
 * screenshots, version format, and dependency correctness.
 */

// =============================================================================
// Types
// =============================================================================

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  /** Rule that was violated */
  rule: string;
  /** Severity level */
  severity: ValidationSeverity;
  /** Human-readable message */
  message: string;
  /** Field or file that caused the issue */
  field?: string;
}

export interface ManifestData {
  name?: string;
  version?: string;
  license?: string;
  author?: string;
  website?: string;
  category?: string;
  summary?: string;
  description?: string;
  depends?: string[];
  data?: string[];
  assets?: Record<string, string[]>;
  images?: string[];
  installable?: boolean;
  application?: boolean;
  price?: number;
  currency?: string;
}

export interface SubmissionAssets {
  /** Whether icon file exists */
  hasIcon: boolean;
  /** Icon dimensions [width, height] */
  iconSize?: [number, number];
  /** Number of screenshot files */
  screenshotCount: number;
  /** Screenshot file paths */
  screenshotPaths: string[];
  /** Whether README/description file exists */
  hasDescription: boolean;
  /** Description character count */
  descriptionLength: number;
  /** List of files in the module */
  moduleFiles: string[];
}

export interface ValidationResult {
  /** Whether submission passes all required checks */
  valid: boolean;
  /** Total issues found */
  issueCount: number;
  /** Error count (blockers) */
  errorCount: number;
  /** Warning count */
  warningCount: number;
  /** All issues */
  issues: ValidationIssue[];
  /** Checks that passed */
  passed: string[];
}

// =============================================================================
// Constants
// =============================================================================

export const VALID_LICENSES = [
  "LGPL-3",
  "OEEL-1",
  "GPL-2",
  "GPL-2 or later",
  "GPL-3",
  "GPL-3 or later",
  "AGPL-3",
] as const;

export const VALID_CATEGORIES = [
  "Accounting",
  "Discuss",
  "Document Management",
  "eCommerce",
  "Human Resources",
  "Industries",
  "Inventory",
  "Manufacturing",
  "Marketing",
  "Point of Sale",
  "Productivity",
  "Project",
  "Purchases",
  "Sales",
  "Services",
  "Technical",
  "Website",
  "Hidden",
] as const;

const FORBIDDEN_DEPENDS = [
  "base_setup",
  "web_editor",
] as const;

const MIN_DESCRIPTION_LENGTH = 150;
const MIN_SCREENSHOTS = 3;
const REQUIRED_ICON_SIZE: [number, number] = [100, 100];
const VERSION_REGEX = /^\d+\.\d+\.\d+\.\d+\.\d+$/;

// =============================================================================
// Individual Validators
// =============================================================================

export function validateLicense(manifest: ManifestData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!manifest.license) {
    issues.push({
      rule: "license-required",
      severity: "error",
      message: "Manifest must include a 'license' field",
      field: "license",
    });
  } else if (!VALID_LICENSES.includes(manifest.license as typeof VALID_LICENSES[number])) {
    issues.push({
      rule: "license-valid",
      severity: "error",
      message: `Invalid license '${manifest.license}'. Must be one of: ${VALID_LICENSES.join(", ")}`,
      field: "license",
    });
  }
  return issues;
}

export function validateVersion(manifest: ManifestData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!manifest.version) {
    issues.push({
      rule: "version-required",
      severity: "error",
      message: "Manifest must include a 'version' field",
      field: "version",
    });
  } else if (!VERSION_REGEX.test(manifest.version)) {
    issues.push({
      rule: "version-format",
      severity: "error",
      message: `Version '${manifest.version}' must follow Odoo format: MAJOR.MINOR.PATCH.PATCH.PATCH (e.g. 17.0.1.0.0)`,
      field: "version",
    });
  }
  return issues;
}

export function validateMetadata(manifest: ManifestData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!manifest.name) {
    issues.push({
      rule: "name-required",
      severity: "error",
      message: "Manifest must include a 'name' field",
      field: "name",
    });
  }

  if (!manifest.author) {
    issues.push({
      rule: "author-required",
      severity: "error",
      message: "Manifest must include an 'author' field",
      field: "author",
    });
  }

  if (!manifest.summary) {
    issues.push({
      rule: "summary-required",
      severity: "warning",
      message: "Manifest should include a 'summary' field for store listing",
      field: "summary",
    });
  } else if (manifest.summary.length > 150) {
    issues.push({
      rule: "summary-length",
      severity: "warning",
      message: "Summary should be 150 characters or less",
      field: "summary",
    });
  }

  if (!manifest.category) {
    issues.push({
      rule: "category-required",
      severity: "warning",
      message: "Manifest should include a 'category' field",
      field: "category",
    });
  } else if (!VALID_CATEGORIES.includes(manifest.category as typeof VALID_CATEGORIES[number])) {
    issues.push({
      rule: "category-valid",
      severity: "warning",
      message: `Category '${manifest.category}' is not a standard Odoo category`,
      field: "category",
    });
  }

  if (!manifest.website) {
    issues.push({
      rule: "website-recommended",
      severity: "info",
      message: "Including a 'website' field improves credibility",
      field: "website",
    });
  }

  if (manifest.installable === false) {
    issues.push({
      rule: "installable-true",
      severity: "error",
      message: "Module must be installable (installable: True)",
      field: "installable",
    });
  }

  return issues;
}

export function validateDependencies(manifest: ManifestData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!manifest.depends || manifest.depends.length === 0) {
    issues.push({
      rule: "depends-required",
      severity: "error",
      message: "Manifest must include at least one dependency (typically 'website')",
      field: "depends",
    });
  } else {
    for (const dep of manifest.depends) {
      if (FORBIDDEN_DEPENDS.includes(dep as typeof FORBIDDEN_DEPENDS[number])) {
        issues.push({
          rule: "depends-forbidden",
          severity: "warning",
          message: `Dependency '${dep}' is discouraged for App Store modules`,
          field: "depends",
        });
      }
    }
  }

  return issues;
}

export function validateIcon(assets: SubmissionAssets): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!assets.hasIcon) {
    issues.push({
      rule: "icon-required",
      severity: "error",
      message: "Module must include an icon (static/description/icon.png)",
    });
  } else if (assets.iconSize) {
    const [w, h] = assets.iconSize;
    if (w < REQUIRED_ICON_SIZE[0] || h < REQUIRED_ICON_SIZE[1]) {
      issues.push({
        rule: "icon-size",
        severity: "error",
        message: `Icon must be at least ${REQUIRED_ICON_SIZE[0]}x${REQUIRED_ICON_SIZE[1]}px (got ${w}x${h})`,
      });
    }
  }

  return issues;
}

export function validateScreenshots(assets: SubmissionAssets): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (assets.screenshotCount < MIN_SCREENSHOTS) {
    issues.push({
      rule: "screenshots-minimum",
      severity: "error",
      message: `At least ${MIN_SCREENSHOTS} screenshots required (found ${assets.screenshotCount})`,
    });
  }

  return issues;
}

export function validateDescription(assets: SubmissionAssets): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!assets.hasDescription) {
    issues.push({
      rule: "description-required",
      severity: "error",
      message: "Module must include a description (static/description/index.html or README)",
    });
  } else if (assets.descriptionLength < MIN_DESCRIPTION_LENGTH) {
    issues.push({
      rule: "description-length",
      severity: "error",
      message: `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters (found ${assets.descriptionLength})`,
    });
  }

  return issues;
}

export function validatePricing(manifest: ManifestData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (manifest.price != null && manifest.price > 0) {
    if (!manifest.currency) {
      issues.push({
        rule: "currency-required",
        severity: "error",
        message: "Currency is required when price is set",
        field: "currency",
      });
    } else if (manifest.currency !== "EUR") {
      issues.push({
        rule: "currency-eur",
        severity: "warning",
        message: "Odoo App Store prices should be in EUR",
        field: "currency",
      });
    }
  }

  return issues;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Validates a module for Odoo App Store submission.
 */
export function validateSubmission(
  manifest: ManifestData,
  assets: SubmissionAssets,
): ValidationResult {
  const allIssues: ValidationIssue[] = [];
  const passed: string[] = [];

  const checks: Array<{ name: string; fn: () => ValidationIssue[] }> = [
    { name: "license", fn: () => validateLicense(manifest) },
    { name: "version", fn: () => validateVersion(manifest) },
    { name: "metadata", fn: () => validateMetadata(manifest) },
    { name: "dependencies", fn: () => validateDependencies(manifest) },
    { name: "icon", fn: () => validateIcon(assets) },
    { name: "screenshots", fn: () => validateScreenshots(assets) },
    { name: "description", fn: () => validateDescription(assets) },
    { name: "pricing", fn: () => validatePricing(manifest) },
  ];

  for (const check of checks) {
    const issues = check.fn();
    if (issues.length === 0) {
      passed.push(check.name);
    } else {
      allIssues.push(...issues);
    }
  }

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;

  return {
    valid: errorCount === 0,
    issueCount: allIssues.length,
    errorCount,
    warningCount,
    issues: allIssues,
    passed,
  };
}

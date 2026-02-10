/**
 * Asset Path Validator - Path Traversal Detection for Asset URLs
 *
 * Detects and blocks path traversal attempts in static asset references.
 * Prevents directory traversal attacks like ../../../etc/passwd
 *
 * Feature #21: Add path traversal detection for asset URLs
 */

// =============================================================================
// Types
// =============================================================================

export type ValidationSeverity = 'blocked' | 'warning' | 'safe';

export interface PathValidationResult {
  /** Whether the path is safe to use */
  valid: boolean;
  /** Severity of the issue */
  severity: ValidationSeverity;
  /** Original path input */
  originalPath: string;
  /** Sanitized path (if applicable) */
  sanitizedPath?: string;
  /** Detected issues */
  issues: PathTraversalIssue[];
  /** Recommendation for fixing */
  recommendation?: string;
}

export interface PathTraversalIssue {
  /** Issue type identifier */
  type: PathTraversalType;
  /** Human-readable description */
  description: string;
  /** Position in path where issue was found */
  position?: number;
  /** The matched pattern */
  match?: string;
}

export type PathTraversalType =
  | 'dot-dot-slash'        // ../
  | 'dot-dot-backslash'    // ..\
  | 'encoded-traversal'    // %2e%2e%2f
  | 'double-encoded'       // %252e%252e%252f
  | 'null-byte'            // %00
  | 'absolute-path'        // /etc/passwd or C:\
  | 'protocol-handler'     // file:// or data:
  | 'unicode-traversal'    // ..%c0%af or ..%c1%9c
  | 'overlong-utf8'        // Overlong UTF-8 encoding
  | 'backslash-evasion';   // Mixed slashes

// =============================================================================
// Detection Patterns
// =============================================================================

interface DetectionPattern {
  type: PathTraversalType;
  pattern: RegExp;
  description: string;
}

const DETECTION_PATTERNS: DetectionPattern[] = [
  // Standard path traversal
  {
    type: 'dot-dot-slash',
    pattern: /\.\.\//g,
    description: 'Directory traversal using ../',
  },
  {
    type: 'dot-dot-backslash',
    pattern: /\.\.\\/g,
    description: 'Directory traversal using ..\\',
  },

  // URL-encoded traversal
  {
    type: 'encoded-traversal',
    pattern: /%2e%2e[%2f%5c]/gi,
    description: 'URL-encoded directory traversal',
  },
  {
    type: 'encoded-traversal',
    pattern: /\.\.%2f/gi,
    description: 'Partially encoded traversal (..%2f)',
  },
  {
    type: 'encoded-traversal',
    pattern: /%2e\.\//gi,
    description: 'Partially encoded traversal (%2e./)',
  },
  {
    type: 'encoded-traversal',
    pattern: /\.%2e\//gi,
    description: 'Partially encoded traversal (.%2e/)',
  },

  // Double-encoded traversal
  {
    type: 'double-encoded',
    pattern: /%252e%252e%252f/gi,
    description: 'Double URL-encoded directory traversal',
  },
  {
    type: 'double-encoded',
    pattern: /%252e%252e[\/\\]/gi,
    description: 'Double-encoded with literal slash',
  },

  // Null byte injection
  {
    type: 'null-byte',
    pattern: /%00/gi,
    description: 'Null byte injection attempt',
  },
  {
    type: 'null-byte',
    pattern: /\x00/g,
    description: 'Literal null byte',
  },

  // Absolute path references
  {
    type: 'absolute-path',
    pattern: /^\/(?:etc|var|tmp|proc|sys|dev|home|root|usr|bin|sbin)\//i,
    description: 'Absolute Unix path to sensitive directory',
  },
  {
    type: 'absolute-path',
    pattern: /^[a-zA-Z]:[\\\/]/,
    description: 'Windows absolute path',
  },

  // Protocol handlers
  {
    type: 'protocol-handler',
    pattern: /^(?:file|php|data|expect|glob|phar|ssh2|rar|ogg|zlib):/i,
    description: 'Dangerous protocol handler',
  },

  // Unicode/UTF-8 evasion techniques
  {
    type: 'unicode-traversal',
    pattern: /%c0%ae/gi,
    description: 'Overlong UTF-8 encoded dot',
  },
  {
    type: 'unicode-traversal',
    pattern: /%c0%af/gi,
    description: 'Overlong UTF-8 encoded slash',
  },
  {
    type: 'unicode-traversal',
    pattern: /%c1%9c/gi,
    description: 'Unicode backslash variant',
  },
  {
    type: 'overlong-utf8',
    pattern: /%e0%80%ae/gi,
    description: 'Three-byte overlong dot encoding',
  },

  // Mixed slash evasion
  {
    type: 'backslash-evasion',
    pattern: /\.\.[\/\\]+\.\./g,
    description: 'Chained traversal with mixed slashes',
  },
  {
    type: 'backslash-evasion',
    pattern: /[\/\\]\.\.[\/\\]/g,
    description: 'Path segment with directory traversal',
  },
];

// =============================================================================
// Core Validation Functions
// =============================================================================

/**
 * Validate an asset path for path traversal attacks
 */
export function validateAssetPath(path: string): PathValidationResult {
  if (!path || typeof path !== 'string') {
    return {
      valid: false,
      severity: 'blocked',
      originalPath: path ?? '',
      issues: [{
        type: 'dot-dot-slash',
        description: 'Invalid or empty path provided',
      }],
      recommendation: 'Provide a valid path string',
    };
  }

  const issues: PathTraversalIssue[] = [];

  // Run all detection patterns
  for (const detection of DETECTION_PATTERNS) {
    // Ensure global flag is set for matchAll
    const flags = detection.pattern.flags.includes('g')
      ? detection.pattern.flags
      : detection.pattern.flags + 'g';
    const regex = new RegExp(detection.pattern.source, flags);
    const matches = path.matchAll(regex);

    for (const match of matches) {
      issues.push({
        type: detection.type,
        description: detection.description,
        position: match.index,
        match: match[0],
      });
    }
  }

  // Check for normalized traversal after decoding
  const decoded = decodePathSafely(path);
  if (decoded !== path) {
    const decodedMatches = decoded.match(/\.\.[\/\\]/g);
    if (decodedMatches) {
      issues.push({
        type: 'encoded-traversal',
        description: 'Path contains encoded traversal that decodes to ../',
        match: decodedMatches[0],
      });
    }
  }

  // Determine severity and validity
  const hasCritical = issues.some(i =>
    ['dot-dot-slash', 'dot-dot-backslash', 'encoded-traversal',
     'double-encoded', 'null-byte', 'absolute-path'].includes(i.type)
  );

  const hasWarning = issues.some(i =>
    ['protocol-handler', 'unicode-traversal', 'overlong-utf8', 'backslash-evasion'].includes(i.type)
  );

  const severity: ValidationSeverity = hasCritical ? 'blocked' : hasWarning ? 'warning' : 'safe';
  const valid = severity === 'safe';

  const result: PathValidationResult = {
    valid,
    severity,
    originalPath: path,
    issues,
  };

  // Add sanitized path if there are issues
  if (!valid) {
    result.sanitizedPath = sanitizePath(path);
    result.recommendation = getRecommendation(issues);
  }

  return result;
}

/**
 * Validate multiple asset paths
 */
export function validateAssetPaths(paths: string[]): Map<string, PathValidationResult> {
  const results = new Map<string, PathValidationResult>();

  for (const path of paths) {
    results.set(path, validateAssetPath(path));
  }

  return results;
}

/**
 * Check if a path contains any traversal attempts (quick check)
 */
export function hasPathTraversal(path: string): boolean {
  if (!path) return false;

  // Quick checks for common patterns
  if (path.includes('../') || path.includes('..\\')) {
    return true;
  }

  // Check encoded variants
  const lower = path.toLowerCase();
  if (lower.includes('%2e%2e') || lower.includes('%252e')) {
    return true;
  }

  // Full validation for edge cases
  const result = validateAssetPath(path);
  return !result.valid;
}

/**
 * Extract all asset URLs from HTML/XML content and validate them
 */
export function validateAssetUrlsInContent(content: string): PathValidationResult[] {
  const results: PathValidationResult[] = [];

  // Match various asset URL patterns
  const patterns = [
    // src attributes
    /src\s*=\s*["']([^"']+)["']/gi,
    // href for stylesheets and links
    /href\s*=\s*["']([^"']+\.(?:css|js|png|jpg|jpeg|gif|svg|woff2?|ttf|eot))["']/gi,
    // url() in inline styles
    /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi,
    // data-src for lazy loading
    /data-src\s*=\s*["']([^"']+)["']/gi,
    // Odoo-specific: t-att-src (handles inner quotes like t-att-src="'path'")
    /t-att-src\s*=\s*["']'([^']+)'["']/gi,
    /t-att-src\s*=\s*["']"([^"]+)"["']/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let url = match[1];
      // Strip surrounding quotes if present (for QWeb expressions)
      url = url.replace(/^['"]|['"]$/g, '');
      const validation = validateAssetPath(url);
      if (!validation.valid) {
        results.push(validation);
      }
    }
  }

  return results;
}

// =============================================================================
// Sanitization Functions
// =============================================================================

/**
 * Sanitize a path by removing traversal sequences
 */
export function sanitizePath(path: string): string {
  if (!path) return '';

  let sanitized = path;

  // Decode any URL encoding first
  sanitized = decodePathSafely(sanitized);

  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, '');
  sanitized = sanitized.replace(/%00/gi, '');

  // Normalize slashes
  sanitized = sanitized.replace(/\\/g, '/');

  // Remove traversal sequences repeatedly until none remain
  let previous = '';
  while (previous !== sanitized) {
    previous = sanitized;
    sanitized = sanitized.replace(/\.\.\//g, '');
    sanitized = sanitized.replace(/\.\.\\/g, '');
  }

  // Remove protocol handlers first (before removing leading slashes)
  sanitized = sanitized.replace(/^[a-z]+:\/\//i, '');

  // Remove leading slashes for relative paths (after protocol removal)
  sanitized = sanitized.replace(/^\/+/, '');

  // Collapse multiple slashes
  sanitized = sanitized.replace(/\/+/g, '/');

  return sanitized;
}

/**
 * Resolve a path to its canonical form within a base directory
 */
export function resolveAssetPath(basePath: string, relativePath: string): string | null {
  // Validate first
  const validation = validateAssetPath(relativePath);
  if (!validation.valid) {
    return null;
  }

  // Normalize paths
  const base = basePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const relative = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');

  // Combine and normalize
  const combined = `${base}/${relative}`;
  const parts = combined.split('/');
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      // Should not happen after validation, but double-check
      if (resolved.length === 0 || resolved.join('/').length < base.length) {
        return null; // Would escape base directory
      }
      resolved.pop();
    } else if (part !== '.' && part !== '') {
      resolved.push(part);
    }
  }

  const result = resolved.join('/');

  // Ensure result is within base directory
  if (!result.startsWith(base.replace(/^\/+/, ''))) {
    return null;
  }

  return result;
}

// =============================================================================
// Odoo-Specific Validation
// =============================================================================

/**
 * Validate Odoo static asset path format
 *
 * Valid Odoo asset paths:
 * - /module_name/static/src/...
 * - /web/static/lib/...
 * - /website/static/src/...
 */
export function validateOdooAssetPath(path: string): PathValidationResult {
  const baseResult = validateAssetPath(path);

  if (!baseResult.valid) {
    return baseResult;
  }

  // Additional Odoo-specific checks
  const issues = [...baseResult.issues];

  // Check for valid Odoo static path format
  const odooStaticPattern = /^\/?\w+\/static\/(src|lib|description)\//;
  const webStaticPattern = /^\/?(web|website)\/static\/(src|lib)\//;

  const isValidOdooPath = odooStaticPattern.test(path) ||
                          webStaticPattern.test(path) ||
                          path.startsWith('/web/image/') ||
                          path.startsWith('/web/content/');

  if (!isValidOdooPath && !path.startsWith('data:') && !path.startsWith('http')) {
    issues.push({
      type: 'absolute-path',
      description: 'Path does not follow Odoo static asset conventions',
    });
  }

  return {
    ...baseResult,
    valid: baseResult.valid && (isValidOdooPath || path.startsWith('http') || path.startsWith('data:')),
    issues,
    recommendation: !isValidOdooPath
      ? 'Use format: /module_name/static/src/path/to/asset'
      : baseResult.recommendation,
  };
}

/**
 * Validate t-att-src expressions in QWeb templates
 */
export function validateQWebAssetExpression(expression: string): PathValidationResult {
  const issues: PathTraversalIssue[] = [];

  // Check for direct path injection risks
  if (expression.includes('+') || expression.includes('format') || expression.includes('%')) {
    // Dynamic path construction - check for user input inclusion
    const userInputPatterns = /request\.|params\.|user_input|form\./i;
    if (userInputPatterns.test(expression)) {
      issues.push({
        type: 'encoded-traversal',
        description: 'Dynamic asset path with potential user input',
        match: expression,
      });
    }
  }

  // Extract any literal path segments and validate them
  const literalPaths = expression.match(/['"]([^'"]+)['"]/g);
  if (literalPaths) {
    for (const literal of literalPaths) {
      const path = literal.replace(/['"]/g, '');
      const pathResult = validateAssetPath(path);
      issues.push(...pathResult.issues);
    }
  }

  return {
    valid: issues.length === 0,
    severity: issues.length > 0 ? 'warning' : 'safe',
    originalPath: expression,
    issues,
    recommendation: issues.length > 0
      ? 'Avoid dynamic path construction; use whitelisted asset paths'
      : undefined,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely decode a URL-encoded path
 */
function decodePathSafely(path: string): string {
  try {
    // Decode up to 3 levels of encoding
    let decoded = path;
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    return decoded;
  } catch {
    // Invalid encoding - return original
    return path;
  }
}

/**
 * Get recommendation based on detected issues
 */
function getRecommendation(issues: PathTraversalIssue[]): string {
  const types = new Set(issues.map(i => i.type));

  if (types.has('dot-dot-slash') || types.has('dot-dot-backslash')) {
    return 'Remove ../ sequences; use absolute paths from module root';
  }

  if (types.has('encoded-traversal') || types.has('double-encoded')) {
    return 'Do not use URL-encoded path segments; validate and sanitize all user input';
  }

  if (types.has('null-byte')) {
    return 'Remove null bytes; these are often used in path truncation attacks';
  }

  if (types.has('absolute-path')) {
    return 'Use relative paths within the module static directory';
  }

  if (types.has('protocol-handler')) {
    return 'Only use http://, https://, or relative paths for assets';
  }

  return 'Sanitize the path to remove potentially dangerous sequences';
}

// =============================================================================
// Batch Validation for Theme Generation
// =============================================================================

export interface AssetValidationReport {
  totalPaths: number;
  validPaths: number;
  blockedPaths: number;
  warningPaths: number;
  issues: Array<{
    path: string;
    result: PathValidationResult;
  }>;
  passed: boolean;
}

/**
 * Validate all asset paths in a theme module
 */
export function validateThemeAssets(
  assetPaths: string[]
): AssetValidationReport {
  const report: AssetValidationReport = {
    totalPaths: assetPaths.length,
    validPaths: 0,
    blockedPaths: 0,
    warningPaths: 0,
    issues: [],
    passed: true,
  };

  for (const path of assetPaths) {
    const result = validateAssetPath(path);

    if (result.valid) {
      report.validPaths++;
    } else if (result.severity === 'blocked') {
      report.blockedPaths++;
      report.passed = false;
      report.issues.push({ path, result });
    } else {
      report.warningPaths++;
      report.issues.push({ path, result });
    }
  }

  return report;
}

/**
 * Format validation report for display
 */
export function formatValidationReport(report: AssetValidationReport): string {
  const lines = [
    '=== Asset Path Validation Report ===',
    `Total paths: ${report.totalPaths}`,
    `Valid: ${report.validPaths}`,
    `Blocked: ${report.blockedPaths}`,
    `Warnings: ${report.warningPaths}`,
    `Status: ${report.passed ? 'PASSED' : 'FAILED'}`,
  ];

  if (report.issues.length > 0) {
    lines.push('', 'Issues:');
    for (const { path, result } of report.issues) {
      lines.push(`  [${result.severity.toUpperCase()}] ${path}`);
      for (const issue of result.issues) {
        lines.push(`    - ${issue.description}`);
      }
      if (result.recommendation) {
        lines.push(`    Fix: ${result.recommendation}`);
      }
    }
  }

  return lines.join('\n');
}

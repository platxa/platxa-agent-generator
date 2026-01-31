/**
 * JSDoc Coverage Checker
 *
 * Verifies that all public functions in a module have JSDoc comments.
 * This ensures inline documentation coverage for complex functions.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Types of exports that should have JSDoc.
 */
export type ExportType = 'function' | 'const' | 'class' | 'type' | 'interface';

/**
 * Represents a detected export in a file.
 */
export interface DetectedExport {
  /** Export name */
  name: string;
  /** Export type */
  type: ExportType;
  /** Line number where export appears */
  line: number;
  /** Whether it has a JSDoc comment */
  hasJsDoc: boolean;
  /** The JSDoc comment if present */
  jsDoc?: string;
}

/**
 * Coverage result for a single file.
 */
export interface FileCoverage {
  /** File path */
  filePath: string;
  /** Total exports found */
  totalExports: number;
  /** Exports with JSDoc */
  documentedExports: number;
  /** Coverage percentage (0-100) */
  coveragePercent: number;
  /** List of detected exports */
  exports: DetectedExport[];
  /** Exports missing JSDoc */
  undocumented: string[];
}

/**
 * Overall coverage summary.
 */
export interface CoverageSummary {
  /** Total files analyzed */
  totalFiles: number;
  /** Total exports across all files */
  totalExports: number;
  /** Total documented exports */
  documentedExports: number;
  /** Overall coverage percentage */
  coveragePercent: number;
  /** Files with 100% coverage */
  fullyDocumented: number;
  /** Files below threshold */
  belowThreshold: number;
  /** Per-file coverage */
  files: FileCoverage[];
  /** Pass/fail based on threshold */
  passed: boolean;
  /** Threshold used */
  threshold: number;
}

/**
 * Configuration for coverage checking.
 */
export interface CoverageConfig {
  /** Minimum coverage percentage required (0-100) */
  threshold: number;
  /** Export types to check */
  exportTypes: ExportType[];
  /** Whether to include private exports (starting with _) */
  includePrivate: boolean;
}

/**
 * Default coverage configuration.
 */
export const DEFAULT_COVERAGE_CONFIG: CoverageConfig = {
  threshold: 100,
  exportTypes: ['function', 'const', 'class'],
  includePrivate: false,
};

// =============================================================================
// Parsing Functions
// =============================================================================

/**
 * Regex patterns for detecting exports.
 */
const EXPORT_PATTERNS: Record<ExportType, RegExp> = {
  function: /^export\s+function\s+(\w+)/,
  const: /^export\s+const\s+(\w+)/,
  class: /^export\s+class\s+(\w+)/,
  type: /^export\s+type\s+(\w+)/,
  interface: /^export\s+interface\s+(\w+)/,
};

/**
 * Detects if a line is a JSDoc comment start.
 */
export function isJsDocStart(line: string): boolean {
  return /^\s*\/\*\*/.test(line);
}

/**
 * Detects if a line is a JSDoc comment end.
 */
export function isJsDocEnd(line: string): boolean {
  return /\*\/\s*$/.test(line);
}

/**
 * Detects if a line is an export statement.
 */
export function isExportLine(line: string, types: ExportType[]): { isExport: boolean; type?: ExportType; name?: string } {
  for (const type of types) {
    const pattern = EXPORT_PATTERNS[type];
    const match = line.match(pattern);
    if (match) {
      return { isExport: true, type, name: match[1] };
    }
  }
  return { isExport: false };
}

/**
 * Extracts exports with their JSDoc status from source code.
 */
export function extractExports(
  source: string,
  config: CoverageConfig = DEFAULT_COVERAGE_CONFIG,
): DetectedExport[] {
  const lines = source.split('\n');
  const exports: DetectedExport[] = [];

  let currentJsDoc: string[] = [];
  let inJsDoc = false;
  let jsDocStartLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track JSDoc comments
    if (isJsDocStart(line)) {
      inJsDoc = true;
      jsDocStartLine = lineNum;
      currentJsDoc = [line];
    } else if (inJsDoc) {
      currentJsDoc.push(line);
      if (isJsDocEnd(line)) {
        inJsDoc = false;
      }
    }

    // Check for export
    const exportInfo = isExportLine(line, config.exportTypes);
    if (exportInfo.isExport && exportInfo.name && exportInfo.type) {
      // Skip private exports if configured
      if (!config.includePrivate && exportInfo.name.startsWith('_')) {
        currentJsDoc = [];
        continue;
      }

      // Check if JSDoc was immediately before this line
      const hasJsDoc = currentJsDoc.length > 0 &&
        jsDocStartLine >= 0 &&
        (lineNum - jsDocStartLine - currentJsDoc.length) <= 1;

      exports.push({
        name: exportInfo.name,
        type: exportInfo.type,
        line: lineNum,
        hasJsDoc,
        jsDoc: hasJsDoc ? currentJsDoc.join('\n') : undefined,
      });

      // Reset JSDoc tracking
      currentJsDoc = [];
      jsDocStartLine = -1;
    }

    // Reset JSDoc if we hit a non-JSDoc, non-export line
    // Don't reset on JSDoc end line (*/), empty lines, or single-line comments
    if (!inJsDoc && !isJsDocStart(line) && !isJsDocEnd(line) && !exportInfo.isExport) {
      const trimmed = line.trim();
      if (trimmed !== '' && !trimmed.startsWith('//')) {
        currentJsDoc = [];
        jsDocStartLine = -1;
      }
    }
  }

  return exports;
}

// =============================================================================
// Coverage Computation
// =============================================================================

/**
 * Computes coverage for a single file.
 */
export function computeFileCoverage(
  filePath: string,
  source: string,
  config: CoverageConfig = DEFAULT_COVERAGE_CONFIG,
): FileCoverage {
  const exports = extractExports(source, config);
  const documented = exports.filter((e) => e.hasJsDoc);
  const undocumented = exports.filter((e) => !e.hasJsDoc).map((e) => e.name);

  return {
    filePath,
    totalExports: exports.length,
    documentedExports: documented.length,
    coveragePercent: exports.length > 0
      ? Math.round((documented.length / exports.length) * 100)
      : 100,
    exports,
    undocumented,
  };
}

/**
 * Computes overall coverage summary from multiple files.
 */
export function computeCoverageSummary(
  files: FileCoverage[],
  threshold: number = 100,
): CoverageSummary {
  const totalExports = files.reduce((sum, f) => sum + f.totalExports, 0);
  const documentedExports = files.reduce((sum, f) => sum + f.documentedExports, 0);
  const coveragePercent = totalExports > 0
    ? Math.round((documentedExports / totalExports) * 100)
    : 100;

  return {
    totalFiles: files.length,
    totalExports,
    documentedExports,
    coveragePercent,
    fullyDocumented: files.filter((f) => f.coveragePercent === 100).length,
    belowThreshold: files.filter((f) => f.coveragePercent < threshold).length,
    files,
    passed: coveragePercent >= threshold,
    threshold,
  };
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Formats coverage result as a string report.
 */
export function formatCoverageReport(summary: CoverageSummary): string {
  const lines: string[] = [];
  const status = summary.passed ? 'PASSED' : 'FAILED';
  const statusIcon = summary.passed ? '✓' : '✗';

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push(`  JSDOC COVERAGE REPORT  ${statusIcon} ${status}`);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('SUMMARY');
  lines.push(`  Files analyzed:     ${summary.totalFiles}`);
  lines.push(`  Total exports:      ${summary.totalExports}`);
  lines.push(`  Documented:         ${summary.documentedExports}`);
  lines.push(`  Coverage:           ${summary.coveragePercent}%`);
  lines.push(`  Threshold:          ${summary.threshold}%`);
  lines.push(`  Fully documented:   ${summary.fullyDocumented}`);
  lines.push('');

  // Show files below threshold
  const belowThreshold = summary.files.filter((f) => f.coveragePercent < summary.threshold);
  if (belowThreshold.length > 0) {
    lines.push('FILES BELOW THRESHOLD');
    for (const file of belowThreshold) {
      lines.push(`  ${file.filePath}: ${file.coveragePercent}%`);
      for (const name of file.undocumented) {
        lines.push(`    - ${name} (missing JSDoc)`);
      }
    }
    lines.push('');
  }

  // Show all files
  lines.push('ALL FILES');
  for (const file of summary.files) {
    const icon = file.coveragePercent === 100 ? '✓' : '○';
    lines.push(`  ${icon} ${file.filePath}: ${file.coveragePercent}% (${file.documentedExports}/${file.totalExports})`);
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Formats a single file's coverage as a compact string.
 */
export function formatFileCoverage(coverage: FileCoverage): string {
  const icon = coverage.coveragePercent === 100 ? '✓' : '○';
  return `${icon} ${coverage.filePath}: ${coverage.coveragePercent}% (${coverage.documentedExports}/${coverage.totalExports})`;
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates that a file meets the coverage threshold.
 */
export function validateFileCoverage(
  coverage: FileCoverage,
  threshold: number = 100,
): { valid: boolean; message: string } {
  if (coverage.coveragePercent >= threshold) {
    return {
      valid: true,
      message: `${coverage.filePath}: Coverage ${coverage.coveragePercent}% meets threshold ${threshold}%`,
    };
  }

  return {
    valid: false,
    message: `${coverage.filePath}: Coverage ${coverage.coveragePercent}% below threshold ${threshold}%. Missing JSDoc: ${coverage.undocumented.join(', ')}`,
  };
}

/**
 * Validates overall coverage meets threshold.
 */
export function validateCoverage(
  summary: CoverageSummary,
): { valid: boolean; message: string; issues: string[] } {
  const issues: string[] = [];

  for (const file of summary.files) {
    if (file.coveragePercent < summary.threshold) {
      issues.push(`${file.filePath}: ${file.undocumented.join(', ')}`);
    }
  }

  if (summary.passed) {
    return {
      valid: true,
      message: `JSDoc coverage ${summary.coveragePercent}% meets threshold ${summary.threshold}%`,
      issues: [],
    };
  }

  return {
    valid: false,
    message: `JSDoc coverage ${summary.coveragePercent}% below threshold ${summary.threshold}%`,
    issues,
  };
}

// =============================================================================
// JSDoc Generation Helpers
// =============================================================================

/**
 * Generates a basic JSDoc template for a function.
 */
export function generateJsDocTemplate(
  name: string,
  params: string[] = [],
  returnType?: string,
): string {
  const lines: string[] = ['/**'];
  lines.push(` * ${name} - Description needed`);

  for (const param of params) {
    lines.push(` * @param ${param} - Parameter description`);
  }

  if (returnType) {
    lines.push(` * @returns ${returnType}`);
  }

  lines.push(' */');
  return lines.join('\n');
}

/**
 * Suggests JSDoc for an undocumented export.
 */
export function suggestJsDoc(exp: DetectedExport): string {
  return generateJsDocTemplate(exp.name);
}

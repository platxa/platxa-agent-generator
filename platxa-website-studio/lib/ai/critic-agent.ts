/**
 * Critic Agent - Evaluates AI-generated Odoo themes
 *
 * Implements the Generator-Critic pattern for improved code quality:
 * 1. Generator creates initial output
 * 2. Critic evaluates and grades the output
 * 3. If quality insufficient, feeds back to Generator for correction
 *
 * This ensures high-quality Odoo theme code before export.
 */

import type { ParsedFile } from './parser';
import { scanFiles, type ScanResult } from '@/lib/security/code-scanner';

// =============================================================================
// TYPES
// =============================================================================

export type CriticGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface CriticIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  file?: string;
  line?: number;
  suggestedFix?: string;
  autoFixable: boolean;
}

export interface ValidatorResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CriticReport {
  grade: CriticGrade;
  qualityScore: number; // 0-100
  errorCount: number;
  warningCount: number;
  infoCount: number;

  issues: CriticIssue[];
  recommendations: string[];

  canBeAutoCorrected: boolean;
  shouldIterateAgain: boolean;
  iterationNumber: number;

  validationSummary: {
    qweb: ValidatorResult;
    scss: ValidatorResult;
    structure: ValidatorResult;
    security: ScanResult;
  };

  timestamp: number;
  duration: number;
}

export interface CriticOptions {
  maxIterations?: number;
  qualityThreshold?: number;
  strictMode?: boolean;
  categories?: string[];
}

const DEFAULT_OPTIONS: Required<CriticOptions> = {
  maxIterations: 3,
  qualityThreshold: 70,
  strictMode: false,
  categories: ['syntax', 'structure', 'security', 'style', 'accessibility'],
};

// =============================================================================
// VALIDATORS
// =============================================================================

/**
 * Validate QWeb/XML template syntax
 */
function validateQWebSyntax(files: ParsedFile[]): ValidatorResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    if (!file.path.endsWith('.xml')) continue;

    const content = file.content;

    // Check for unclosed tags
    const openTags = content.match(/<(\w+)(?:\s[^>]*)?(?<!\/)\s*>/g) || [];
    const closeTags = content.match(/<\/(\w+)\s*>/g) || [];

    // Check for proper odoo root element
    if (!content.includes('<odoo>') && !content.includes('<odoo ')) {
      errors.push(`${file.path}: Missing <odoo> root element`);
    }

    // Check for template IDs
    const templateMatches = content.matchAll(/<template\s+([^>]*)>/gi);
    for (const match of templateMatches) {
      const attrs = match[1];
      if (!attrs.includes('id=')) {
        errors.push(`${file.path}: Template missing id attribute`);
      }
    }

    // Check for t-esc vs t-raw usage
    const rawUsages = (content.match(/t-raw\s*=/g) || []).length;
    if (rawUsages > 0) {
      warnings.push(`${file.path}: ${rawUsages} uses of t-raw (consider t-esc for safety)`);
    }

    // Check for proper t-foreach syntax
    const foreachMatches = content.matchAll(/t-foreach\s*=\s*["']([^"']*)["']/gi);
    for (const match of foreachMatches) {
      // Check if t-as is present nearby
      const startPos = match.index || 0;
      const contextSnippet = content.slice(startPos, startPos + 200);
      if (!contextSnippet.includes('t-as=')) {
        errors.push(`${file.path}: t-foreach without t-as attribute`);
      }
    }

    // Check for Flask/Jinja syntax that should be QWeb
    if (content.includes('{{ ') || content.includes('{% ')) {
      errors.push(`${file.path}: Jinja/Flask syntax detected (should use QWeb t-* directives)`);
    }

    // Check for JavaScript template syntax
    if (content.includes('${') && !content.includes('t-esc')) {
      warnings.push(`${file.path}: JavaScript template syntax detected (use t-esc instead)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate SCSS/CSS syntax
 */
function validateScssSyntax(files: ParsedFile[]): ValidatorResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    if (!file.path.endsWith('.scss') && !file.path.endsWith('.css')) continue;

    const content = file.content;

    // Check for balanced braces
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`${file.path}: Unbalanced braces (${openBraces} open, ${closeBraces} close)`);
    }

    // Check for empty rules
    const emptyRules = content.match(/\{[\s\n]*\}/g) || [];
    if (emptyRules.length > 0) {
      warnings.push(`${file.path}: ${emptyRules.length} empty CSS rules`);
    }

    // Check for !important overuse
    const importantCount = (content.match(/!important/gi) || []).length;
    if (importantCount > 5) {
      warnings.push(`${file.path}: Excessive use of !important (${importantCount} times)`);
    }

    // Check for invalid selectors (common AI mistakes)
    if (content.includes('..') || content.includes('##')) {
      errors.push(`${file.path}: Invalid selector syntax detected`);
    }

    // Check for placeholder values
    if (content.includes('YOUR_') || content.includes('PLACEHOLDER')) {
      errors.push(`${file.path}: Placeholder value detected in styles`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Odoo module structure
 */
function validateModuleStructure(files: ParsedFile[]): ValidatorResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const filePaths = files.map(f => f.path);

  // Check for required files
  const hasManifest = filePaths.some(p => p.endsWith('__manifest__.py'));
  const hasInit = filePaths.some(p => p.endsWith('__init__.py'));
  const hasViews = filePaths.some(p => p.includes('/views/') && p.endsWith('.xml'));
  const hasAssets = filePaths.some(p => p.includes('/static/'));

  if (!hasManifest) {
    errors.push('Missing __manifest__.py file');
  }

  if (!hasInit) {
    warnings.push('Missing __init__.py file (may be auto-generated)');
  }

  if (!hasViews) {
    warnings.push('No view XML files found in /views/ directory');
  }

  // Check manifest content if present
  const manifestFile = files.find(f => f.path.endsWith('__manifest__.py'));
  if (manifestFile) {
    const content = manifestFile.content;

    if (!content.includes("'name'") && !content.includes('"name"')) {
      errors.push('Manifest missing required "name" field');
    }

    if (!content.includes("'version'") && !content.includes('"version"')) {
      warnings.push('Manifest missing "version" field');
    }

    if (!content.includes("'website'") && !content.includes('"website"')) {
      errors.push('Theme manifest must depend on "website" module');
    }

    // Check for proper asset paths
    if (content.includes('theme_generated/') && !content.includes('%(')) {
      warnings.push('Manifest uses hardcoded theme_generated/ paths');
    }
  }

  // Check for duplicate template IDs across files
  const templateIds = new Set<string>();
  const duplicates: string[] = [];

  for (const file of files) {
    if (!file.path.endsWith('.xml')) continue;

    const idMatches = file.content.matchAll(/id\s*=\s*["']([^"']+)["']/gi);
    for (const match of idMatches) {
      const id = match[1];
      if (templateIds.has(id)) {
        duplicates.push(id);
      }
      templateIds.add(id);
    }
  }

  if (duplicates.length > 0) {
    errors.push(`Duplicate template IDs found: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// VISUAL QUALITY VALIDATION
// =============================================================================

/**
 * Check visual quality: section variety, background alternation, heading hierarchy
 */
function validateVisualQuality(files: ParsedFile[]): ValidatorResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const xmlFiles = files.filter(f => f.path.endsWith('.xml'));
  for (const file of xmlFiles) {
    const content = file.content;

    // Check section variety: at least 3 different data-snippet types
    const snippetMatches = content.match(/data-snippet="([^"]+)"/g) || [];
    const snippetTypes = new Set(snippetMatches.map(m => m.replace(/data-snippet="([^"]+)"/, '$1')));
    if (snippetMatches.length >= 3 && snippetTypes.size < 3) {
      warnings.push(`Low section variety: only ${snippetTypes.size} unique snippet types (${[...snippetTypes].join(', ')}). Use at least 3 different types.`);
    }

    // Check background alternation: no two consecutive o_cc with same number
    const ccMatches = [...content.matchAll(/o_cc(\d)/g)].map(m => m[1]);
    for (let i = 1; i < ccMatches.length; i++) {
      if (ccMatches[i] === ccMatches[i - 1]) {
        warnings.push(`Consecutive sections ${i} and ${i + 1} share the same background (o_cc${ccMatches[i]}). Alternate backgrounds for visual rhythm.`);
        break; // Only warn once
      }
    }

    // Check heading hierarchy: should have h1 or display-* and h2s, not just h2s
    const hasH1 = /class="[^"]*display-[1-4]|<h1[\s>]/.test(content);
    const h2Count = (content.match(/<h2[\s>]/g) || []).length;
    if (h2Count >= 2 && !hasH1) {
      warnings.push('Missing hero headline (h1 or display class). Themes should have a prominent hero heading.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// SCORING
// =============================================================================

/**
 * Calculate quality score from issues
 */
function calculateQualityScore(issues: CriticIssue[]): number {
  let score = 100;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        score -= 15;
        break;
      case 'warning':
        score -= 5;
        break;
      case 'info':
        score -= 1;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Determine grade from score
 */
function scoreToGrade(score: number): CriticGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Convert validator result to critic issues
 */
function validatorToIssues(
  result: ValidatorResult,
  category: string,
  filePrefix?: string
): CriticIssue[] {
  const issues: CriticIssue[] = [];

  for (const error of result.errors) {
    issues.push({
      id: `${category.toUpperCase()}-ERR-${issues.length + 1}`,
      severity: 'error',
      category,
      message: error,
      file: filePrefix,
      autoFixable: false,
    });
  }

  for (const warning of result.warnings) {
    issues.push({
      id: `${category.toUpperCase()}-WARN-${issues.length + 1}`,
      severity: 'warning',
      category,
      message: warning,
      file: filePrefix,
      autoFixable: true,
    });
  }

  return issues;
}

/**
 * Generate recommendations based on issues
 */
function generateRecommendations(issues: CriticIssue[], grade: CriticGrade): string[] {
  const recommendations: string[] = [];

  const errorsByCategory = new Map<string, number>();
  for (const issue of issues) {
    if (issue.severity === 'error') {
      errorsByCategory.set(
        issue.category,
        (errorsByCategory.get(issue.category) || 0) + 1
      );
    }
  }

  // Category-specific recommendations
  if (errorsByCategory.has('qweb')) {
    recommendations.push('Fix QWeb template syntax errors before export');
  }

  if (errorsByCategory.has('scss')) {
    recommendations.push('Review SCSS for syntax issues and balanced braces');
  }

  if (errorsByCategory.has('structure')) {
    recommendations.push('Ensure Odoo module structure is complete (__manifest__.py, views/)');
  }

  if (errorsByCategory.has('security')) {
    recommendations.push('Address security vulnerabilities before deployment');
  }

  // Grade-based recommendations
  if (grade === 'F') {
    recommendations.push('Consider regenerating with more specific requirements');
  } else if (grade === 'D') {
    recommendations.push('Several issues found - review and correct before export');
  } else if (grade === 'C') {
    recommendations.push('Minor issues found - auto-fixes will be applied during export');
  }

  return recommendations;
}

// =============================================================================
// MAIN CRITIC FUNCTION
// =============================================================================

/**
 * Evaluate generated files with the Critic Agent
 */
export function evaluateWithCritic(
  files: ParsedFile[],
  iterationNumber: number = 1,
  options: CriticOptions = {}
): CriticReport {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Run all validators
  const qwebResult = validateQWebSyntax(files);
  const scssResult = validateScssSyntax(files);
  const structureResult = validateModuleStructure(files);
  const visualResult = validateVisualQuality(files);

  // Run security scan
  const securityResult = scanFiles(
    files.map(f => ({ path: f.path, content: f.content }))
  );

  // Aggregate all issues
  const allIssues: CriticIssue[] = [
    ...validatorToIssues(qwebResult, 'qweb'),
    ...validatorToIssues(scssResult, 'scss'),
    ...validatorToIssues(structureResult, 'structure'),
    ...validatorToIssues(visualResult, 'visual'),
    ...securityResult.issues.map(si => ({
      id: si.id,
      severity: si.severity === 'critical' ? 'error' as const :
               si.severity === 'high' ? 'error' as const :
               si.severity === 'medium' ? 'warning' as const : 'info' as const,
      category: 'security',
      message: si.message,
      file: si.file,
      line: si.line,
      suggestedFix: si.recommendation,
      autoFixable: false,
    })),
  ];

  // Calculate score and grade
  const qualityScore = calculateQualityScore(allIssues);
  const grade = scoreToGrade(qualityScore);

  // Count by severity
  const errorCount = allIssues.filter(i => i.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  const infoCount = allIssues.filter(i => i.severity === 'info').length;

  // Determine if auto-correction is possible
  const autoFixableCount = allIssues.filter(i => i.autoFixable).length;
  const canBeAutoCorrected = autoFixableCount > errorCount * 0.5;

  // Determine if should iterate again
  const shouldIterateAgain =
    iterationNumber < opts.maxIterations &&
    qualityScore < opts.qualityThreshold &&
    errorCount > 0;

  // Generate recommendations
  const recommendations = generateRecommendations(allIssues, grade);

  return {
    grade,
    qualityScore,
    errorCount,
    warningCount,
    infoCount,
    issues: allIssues,
    recommendations,
    canBeAutoCorrected,
    shouldIterateAgain,
    iterationNumber,
    validationSummary: {
      qweb: qwebResult,
      scss: scssResult,
      structure: structureResult,
      security: securityResult,
    },
    timestamp: Date.now(),
    duration: Date.now() - startTime,
  };
}

/**
 * Build a correction prompt based on critic feedback
 */
export function buildCorrectionPromptFromCritic(
  originalPrompt: string,
  generatedContent: string,
  criticReport: CriticReport
): string {
  const errorSummary = criticReport.issues
    .filter(i => i.severity === 'error')
    .slice(0, 5)
    .map(i => `- ${i.category}: ${i.message}`)
    .join('\n');

  return `
The following code was generated but has quality issues that need to be fixed.

Original request: ${originalPrompt}

## Quality Report
Grade: ${criticReport.grade} (${criticReport.qualityScore}/100)
Errors: ${criticReport.errorCount}
Warnings: ${criticReport.warningCount}

## Issues to Fix
${errorSummary}

## Recommendations
${criticReport.recommendations.map(r => `- ${r}`).join('\n')}

## Generated Code (to be corrected)
${generatedContent.substring(0, 2000)}${generatedContent.length > 2000 ? '...[truncated]' : ''}

Please regenerate the code fixing all the errors listed above. Maintain the same structure but ensure:
1. All QWeb templates have proper id attributes
2. All SCSS has balanced braces
3. No placeholder values remain
4. Security best practices are followed
`.trim();
}

/**
 * Format critic report for display
 */
export function formatCriticReport(report: CriticReport): string {
  const lines: string[] = [
    `=== Critic Report ===`,
    `Grade: ${report.grade} (${report.qualityScore}/100)`,
    `Errors: ${report.errorCount} | Warnings: ${report.warningCount} | Info: ${report.infoCount}`,
    `Duration: ${report.duration}ms`,
    ``,
  ];

  if (report.issues.length > 0) {
    lines.push('Issues:');
    for (const issue of report.issues.slice(0, 10)) {
      const prefix = issue.severity === 'error' ? '❌' :
                    issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`  ${prefix} [${issue.category}] ${issue.message}`);
    }
    if (report.issues.length > 10) {
      lines.push(`  ... and ${report.issues.length - 10} more`);
    }
    lines.push('');
  }

  if (report.recommendations.length > 0) {
    lines.push('Recommendations:');
    for (const rec of report.recommendations) {
      lines.push(`  → ${rec}`);
    }
  }

  return lines.join('\n');
}

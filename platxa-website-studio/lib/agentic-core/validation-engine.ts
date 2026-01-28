/**
 * Validation Engine - Aggregates multiple validators for quality checks
 *
 * Runs validators in parallel and aggregates results:
 * - QWeb template validation
 * - SCSS compilation validation
 * - Accessibility (a11y) checks
 * - Odoo structure validation
 *
 * @module agentic-core/validation-engine
 */

import type { ValidationResult, AgentContext } from './agent-engine';

// ============================================================================
// Types
// ============================================================================

/** Individual validator result */
export interface ValidatorResult {
  name: string;
  passed: boolean;
  score: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  duration: number;
}

/** Validation error with details */
export interface ValidationError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: 'error' | 'critical';
  suggestion?: string;
}

/** Validation warning */
export interface ValidationWarning {
  code: string;
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

/** Validator function signature */
export type ValidatorFunction = (
  context: AgentContext,
  options?: ValidatorOptions
) => Promise<ValidatorResult>;

/** Options passed to validators */
export interface ValidatorOptions {
  /** Files to validate (glob patterns or paths) */
  files?: string[];
  /** Strict mode - treat warnings as errors */
  strict?: boolean;
  /** Skip specific rules */
  skipRules?: string[];
  /** Additional validator-specific options */
  [key: string]: unknown;
}

/** Validation engine configuration */
export interface ValidationEngineConfig {
  /** Run validators in parallel (default: true) */
  parallel?: boolean;
  /** Timeout per validator in ms (default: 10000) */
  validatorTimeout?: number;
  /** Minimum passing score (default: 80) */
  passingScore?: number;
  /** Weight for each validator type */
  weights?: Partial<Record<ValidatorType, number>>;
}

/** Built-in validator types */
export type ValidatorType = 'qweb' | 'scss' | 'accessibility' | 'odoo_structure';

// ============================================================================
// Default Validators
// ============================================================================

/**
 * QWeb template validator
 * Checks t-directives, template syntax, and Odoo conventions
 */
async function validateQWeb(
  context: AgentContext,
  options?: ValidatorOptions
): Promise<ValidatorResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check files in context
  for (const [path, content] of context.filesRead) {
    if (!path.endsWith('.xml')) continue;

    // Check for common QWeb issues
    if (content.includes('t-if=') && !content.includes('t-if="')) {
      warnings.push({
        code: 'QWEB_ATTR_QUOTE',
        message: 't-if attribute should use double quotes',
        file: path,
        suggestion: 'Use t-if="condition" instead of t-if=\'condition\'',
      });
    }

    // Check for t-esc without proper escaping context
    const tEscMatches = content.match(/t-esc="[^"]*"/g) || [];
    for (const match of tEscMatches) {
      if (match.includes('raw') || match.includes('html')) {
        warnings.push({
          code: 'QWEB_ESC_RAW',
          message: 't-esc used with raw/html content - consider t-raw if intentional',
          file: path,
          suggestion: 'Use t-raw for HTML content or sanitize the value',
        });
      }
    }

    // Check for missing template inheritance
    if (content.includes('<template') && !content.includes('t-name=') && !content.includes('inherit_id=')) {
      errors.push({
        code: 'QWEB_NO_NAME',
        message: 'Template missing t-name or inherit_id attribute',
        file: path,
        severity: 'error',
        suggestion: 'Add t-name="module.template_name" to the template',
      });
    }
  }

  const score = errors.length === 0 ? 100 : Math.max(0, 100 - errors.length * 20);

  return {
    name: 'qweb',
    passed: errors.length === 0,
    score,
    errors,
    warnings,
    duration: Date.now() - startTime,
  };
}

/**
 * SCSS validator
 * Checks SCSS syntax, Odoo variables, and Bootstrap compatibility
 */
async function validateScss(
  context: AgentContext,
  options?: ValidatorOptions
): Promise<ValidatorResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const [path, content] of context.filesRead) {
    if (!path.endsWith('.scss') && !path.endsWith('.css')) continue;

    // Check for hardcoded colors (should use variables)
    const hexColors = content.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    if (hexColors.length > 5) {
      warnings.push({
        code: 'SCSS_HARDCODED_COLORS',
        message: `Found ${hexColors.length} hardcoded colors - consider using SCSS variables`,
        file: path,
        suggestion: 'Use $primary, $secondary, etc. from Odoo/Bootstrap variables',
      });
    }

    // Check for !important abuse
    const importantCount = (content.match(/!important/g) || []).length;
    if (importantCount > 3) {
      warnings.push({
        code: 'SCSS_IMPORTANT_ABUSE',
        message: `Found ${importantCount} !important declarations`,
        file: path,
        suggestion: 'Use more specific selectors instead of !important',
      });
    }

    // Check for missing Odoo imports
    if (content.includes('$o-') && !content.includes('@import') && !content.includes('@use')) {
      errors.push({
        code: 'SCSS_MISSING_IMPORT',
        message: 'Using Odoo variables without importing them',
        file: path,
        severity: 'error',
        suggestion: 'Add @import "odoo/variables" at the top of the file',
      });
    }

    // Basic syntax check - unbalanced braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        code: 'SCSS_UNBALANCED_BRACES',
        message: `Unbalanced braces: ${openBraces} opening, ${closeBraces} closing`,
        file: path,
        severity: 'critical',
      });
    }
  }

  const score = errors.length === 0 ? 100 : Math.max(0, 100 - errors.length * 25);

  return {
    name: 'scss',
    passed: errors.filter(e => e.severity === 'critical').length === 0,
    score,
    errors,
    warnings,
    duration: Date.now() - startTime,
  };
}

/**
 * Accessibility validator
 * Checks WCAG compliance, ARIA usage, and semantic HTML
 */
async function validateAccessibility(
  context: AgentContext,
  options?: ValidatorOptions
): Promise<ValidatorResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const [path, content] of context.filesRead) {
    if (!path.endsWith('.xml') && !path.endsWith('.html')) continue;

    // Check for images without alt text
    const imgWithoutAlt = content.match(/<img(?![^>]*alt=)[^>]*>/gi) || [];
    for (const img of imgWithoutAlt) {
      errors.push({
        code: 'A11Y_IMG_NO_ALT',
        message: 'Image missing alt attribute',
        file: path,
        severity: 'error',
        suggestion: 'Add alt="description" or alt="" for decorative images',
      });
    }

    // Check for form inputs without labels
    const inputsWithoutId = content.match(/<input(?![^>]*id=)[^>]*>/gi) || [];
    if (inputsWithoutId.length > 0) {
      warnings.push({
        code: 'A11Y_INPUT_NO_ID',
        message: `Found ${inputsWithoutId.length} inputs without id (needed for label association)`,
        file: path,
        suggestion: 'Add id attribute and associate with <label for="id">',
      });
    }

    // Check for missing landmarks
    if (content.includes('<div') && !content.includes('role=') &&
        !content.includes('<main') && !content.includes('<nav') &&
        !content.includes('<header') && !content.includes('<footer')) {
      warnings.push({
        code: 'A11Y_NO_LANDMARKS',
        message: 'No ARIA landmarks or semantic HTML elements found',
        file: path,
        suggestion: 'Use <main>, <nav>, <header>, <footer> or role attributes',
      });
    }

    // Check for low contrast indicators (limited static analysis)
    if (content.includes('color: #999') || content.includes('color: #ccc') ||
        content.includes('color: lightgray')) {
      warnings.push({
        code: 'A11Y_LOW_CONTRAST',
        message: 'Potential low contrast text color detected',
        file: path,
        suggestion: 'Ensure text has at least 4.5:1 contrast ratio',
      });
    }

    // Check for missing skip links
    if (content.includes('<body') && !content.includes('skip-link') &&
        !content.includes('skip-to-content')) {
      warnings.push({
        code: 'A11Y_NO_SKIP_LINK',
        message: 'No skip-to-content link found',
        file: path,
        suggestion: 'Add a skip link for keyboard navigation',
      });
    }
  }

  const score = errors.length === 0 ? 100 : Math.max(0, 100 - errors.length * 15);

  return {
    name: 'accessibility',
    passed: errors.length === 0,
    score,
    errors,
    warnings,
    duration: Date.now() - startTime,
  };
}

/**
 * Odoo structure validator
 * Checks module structure, manifest, and naming conventions
 */
async function validateOdooStructure(
  context: AgentContext,
  options?: ValidatorOptions
): Promise<ValidatorResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const files = Array.from(context.filesRead.keys());

  // Check for __manifest__.py
  const hasManifest = files.some(f => f.includes('__manifest__.py'));
  if (!hasManifest && files.length > 0) {
    warnings.push({
      code: 'ODOO_NO_MANIFEST',
      message: 'No __manifest__.py found in module',
      suggestion: 'Create __manifest__.py with module metadata',
    });
  }

  // Check for __init__.py
  const hasInit = files.some(f => f.includes('__init__.py'));
  if (!hasInit && files.some(f => f.endsWith('.py'))) {
    errors.push({
      code: 'ODOO_NO_INIT',
      message: 'Python files without __init__.py',
      severity: 'error',
      suggestion: 'Create __init__.py to make it a proper Python package',
    });
  }

  // Check static folder structure
  const staticFiles = files.filter(f => f.includes('/static/'));
  if (staticFiles.length > 0) {
    const hasSrc = staticFiles.some(f => f.includes('/static/src/'));
    if (!hasSrc) {
      warnings.push({
        code: 'ODOO_STATIC_STRUCTURE',
        message: 'Static files should be in static/src/ subdirectory',
        suggestion: 'Move files to static/src/js/, static/src/scss/, etc.',
      });
    }
  }

  // Check views folder
  const viewFiles = files.filter(f => f.includes('/views/'));
  if (viewFiles.length > 0) {
    for (const viewFile of viewFiles) {
      const content = context.filesRead.get(viewFile) || '';
      if (content.includes('<record') && !content.includes('<odoo>')) {
        errors.push({
          code: 'ODOO_VIEW_NO_ROOT',
          message: 'View file missing <odoo> root element',
          file: viewFile,
          severity: 'error',
          suggestion: 'Wrap content in <odoo> tags',
        });
      }
    }
  }

  // Check naming conventions
  for (const file of files) {
    const fileName = file.split('/').pop() || '';
    if (fileName.includes(' ')) {
      errors.push({
        code: 'ODOO_FILENAME_SPACE',
        message: `File name contains spaces: ${fileName}`,
        file: file,
        severity: 'error',
        suggestion: 'Use underscores instead of spaces',
      });
    }
    if (fileName !== fileName.toLowerCase() && !fileName.endsWith('.py')) {
      warnings.push({
        code: 'ODOO_FILENAME_CASE',
        message: `File name should be lowercase: ${fileName}`,
        file: file,
        suggestion: 'Rename to lowercase with underscores',
      });
    }
  }

  const score = errors.length === 0 ? 100 : Math.max(0, 100 - errors.length * 20);

  return {
    name: 'odoo_structure',
    passed: errors.length === 0,
    score,
    errors,
    warnings,
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Validator Registry
// ============================================================================

const DEFAULT_VALIDATORS: Record<ValidatorType, ValidatorFunction> = {
  qweb: validateQWeb,
  scss: validateScss,
  accessibility: validateAccessibility,
  odoo_structure: validateOdooStructure,
};

const DEFAULT_WEIGHTS: Record<ValidatorType, number> = {
  qweb: 30,
  scss: 25,
  accessibility: 25,
  odoo_structure: 20,
};

// ============================================================================
// ValidationEngine Class
// ============================================================================

/**
 * ValidationEngine - Orchestrates multiple validators
 *
 * Runs validators in parallel and aggregates results into a single
 * ValidationResult compatible with AgentEngine.
 */
export class ValidationEngine {
  private config: Required<ValidationEngineConfig>;
  private validators: Map<ValidatorType, ValidatorFunction>;
  private customValidators: Map<string, ValidatorFunction>;

  constructor(config: ValidationEngineConfig = {}) {
    this.config = {
      parallel: config.parallel ?? true,
      validatorTimeout: config.validatorTimeout ?? 10000,
      passingScore: config.passingScore ?? 80,
      weights: { ...DEFAULT_WEIGHTS, ...config.weights },
    };

    this.validators = new Map(Object.entries(DEFAULT_VALIDATORS) as [ValidatorType, ValidatorFunction][]);
    this.customValidators = new Map();
  }

  /**
   * Run all validators and aggregate results
   * Returns ValidationResult compatible with AgentEngine
   */
  async validate(
    context: AgentContext,
    options?: ValidatorOptions
  ): Promise<ValidationResult> {
    const validatorEntries = [
      ...Array.from(this.validators.entries()),
      ...Array.from(this.customValidators.entries()).map(([name, fn]) => [name, fn] as const),
    ];

    let results: ValidatorResult[];

    if (this.config.parallel) {
      // Run all validators in parallel
      const promises = validatorEntries.map(([name, validator]) =>
        this.runWithTimeout(validator, context, options, name as string)
      );
      results = await Promise.all(promises);
    } else {
      // Run validators sequentially
      results = [];
      for (const [name, validator] of validatorEntries) {
        const result = await this.runWithTimeout(validator, context, options, name as string);
        results.push(result);
      }
    }

    return this.aggregateResults(results);
  }

  /**
   * Run a specific validator
   */
  async runValidator(
    type: ValidatorType | string,
    context: AgentContext,
    options?: ValidatorOptions
  ): Promise<ValidatorResult> {
    const validator = this.validators.get(type as ValidatorType) || this.customValidators.get(type);

    if (!validator) {
      throw new Error(`Validator not found: ${type}`);
    }

    return this.runWithTimeout(validator, context, options, type);
  }

  /**
   * Register a custom validator
   */
  registerValidator(name: string, validator: ValidatorFunction): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Override a built-in validator
   */
  setValidator(type: ValidatorType, validator: ValidatorFunction): void {
    this.validators.set(type, validator);
  }

  /**
   * Get list of available validators
   */
  getValidators(): string[] {
    return [
      ...Array.from(this.validators.keys()),
      ...Array.from(this.customValidators.keys()),
    ];
  }

  /**
   * Set weight for a validator type
   */
  setWeight(type: ValidatorType, weight: number): void {
    this.config.weights[type] = weight;
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private async runWithTimeout(
    validator: ValidatorFunction,
    context: AgentContext,
    options: ValidatorOptions | undefined,
    name: string
  ): Promise<ValidatorResult> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          name,
          passed: false,
          score: 0,
          errors: [{
            code: 'VALIDATOR_TIMEOUT',
            message: `Validator ${name} timed out after ${this.config.validatorTimeout}ms`,
            severity: 'error',
          }],
          warnings: [],
          duration: this.config.validatorTimeout,
        });
      }, this.config.validatorTimeout);

      validator(context, options)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          resolve({
            name,
            passed: false,
            score: 0,
            errors: [{
              code: 'VALIDATOR_ERROR',
              message: `Validator ${name} failed: ${(error as Error).message}`,
              severity: 'error',
            }],
            warnings: [],
            duration: 0,
          });
        });
    });
  }

  private aggregateResults(results: ValidatorResult[]): ValidationResult {
    // Calculate weighted score
    let totalWeight = 0;
    let weightedScore = 0;

    for (const result of results) {
      const weight = this.config.weights[result.name as ValidatorType] ?? 10;
      totalWeight += weight;
      weightedScore += result.score * weight;
    }

    const qualityScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    // Aggregate errors and warnings
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const result of results) {
      for (const error of result.errors) {
        const location = error.file ? ` (${error.file}${error.line ? `:${error.line}` : ''})` : '';
        allErrors.push(`[${result.name}] ${error.message}${location}`);
      }
      for (const warning of result.warnings) {
        const location = warning.file ? ` (${warning.file}${warning.line ? `:${warning.line}` : ''})` : '';
        allWarnings.push(`[${result.name}] ${warning.message}${location}`);
      }
    }

    // Determine if passed
    const passed = qualityScore >= this.config.passingScore &&
                   results.every(r => r.passed || r.errors.filter(e => e.severity === 'critical').length === 0);

    // Build checks array for ValidationResult
    const checks = results.map(r => ({
      name: r.name,
      passed: r.passed,
      score: r.score,
      errors: r.errors.map(e => e.message),
      warnings: r.warnings.map(w => w.message),
    }));

    return {
      passed,
      qualityScore,
      checks,
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a validation engine with default or custom configuration
 */
export function createValidationEngine(config?: ValidationEngineConfig): ValidationEngine {
  return new ValidationEngine(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default ValidationEngine;

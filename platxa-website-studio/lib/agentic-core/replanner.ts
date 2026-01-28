/**
 * Replanner - Generates corrective plan steps from error context
 *
 * Incorporates validation errors to generate targeted fix steps
 * that address specific files and line numbers.
 *
 * @module agentic-core/replanner
 */

import type {
  AgentPlan,
  AgentPlanStep,
  AgentContext,
  AgentError,
  ValidationResult,
  LLMProvider,
} from './agent-engine';
import type { ErrorContext, InjectedError } from './error-injector';
import { ErrorInjector, createErrorInjector } from './error-injector';
import type { ValidatorResult } from './validation-engine';

// ============================================================================
// Types
// ============================================================================

/** Replanner configuration */
export interface ReplannerConfig {
  /** Maximum fix steps to generate */
  maxFixSteps?: number;
  /** Include re-validation step after fixes */
  includeRevalidation?: boolean;
  /** Group fixes by file */
  groupByFile?: boolean;
  /** LLM provider for intelligent replanning */
  llmProvider?: LLMProvider;
  /** Error injector for context building */
  errorInjector?: ErrorInjector;
}

/** Replan result */
export interface ReplanResult {
  /** New plan steps targeting errors */
  fixSteps: AgentPlanStep[];
  /** Error context used for planning */
  errorContext: ErrorContext;
  /** Files targeted for fixes */
  targetedFiles: string[];
  /** Summary of replan strategy */
  strategy: string;
}

/** Fix strategy for a specific error type */
export interface FixStrategy {
  /** Error type this strategy handles */
  errorType: AgentError['type'];
  /** Pattern to match in error message */
  messagePattern?: RegExp;
  /** Action to take */
  action: AgentPlanStep['action'];
  /** How to determine target file */
  targetResolver: (error: InjectedError) => string;
  /** Rationale template */
  rationaleTemplate: string;
}

// ============================================================================
// Default Fix Strategies
// ============================================================================

const DEFAULT_FIX_STRATEGIES: FixStrategy[] = [
  // QWeb fixes
  {
    errorType: 'qweb',
    messagePattern: /t-name|template.*name/i,
    action: 'edit',
    targetResolver: (e) => e.filePath || 'views/templates.xml',
    rationaleTemplate: 'Add missing t-name attribute to template',
  },
  {
    errorType: 'qweb',
    messagePattern: /t-if|t-else|condition/i,
    action: 'edit',
    targetResolver: (e) => e.filePath || 'views/templates.xml',
    rationaleTemplate: 'Fix t-if/t-else directive syntax',
  },
  {
    errorType: 'qweb',
    action: 'edit',
    targetResolver: (e) => e.filePath || 'views/templates.xml',
    rationaleTemplate: 'Fix QWeb template error',
  },

  // SCSS fixes
  {
    errorType: 'scss',
    messagePattern: /brace|bracket|\{|\}/i,
    action: 'edit',
    targetResolver: (e) => e.filePath || 'static/src/scss/styles.scss',
    rationaleTemplate: 'Fix unbalanced braces in SCSS',
  },
  {
    errorType: 'scss',
    messagePattern: /import|@use|variable/i,
    action: 'edit',
    targetResolver: (e) => e.filePath || 'static/src/scss/styles.scss',
    rationaleTemplate: 'Add missing SCSS import or define variable',
  },
  {
    errorType: 'scss',
    action: 'edit',
    targetResolver: (e) => e.filePath || 'static/src/scss/styles.scss',
    rationaleTemplate: 'Fix SCSS syntax error',
  },

  // Accessibility fixes
  {
    errorType: 'validation',
    messagePattern: /alt.*attribute|image.*alt/i,
    action: 'edit',
    targetResolver: (e) => e.filePath || 'views/templates.xml',
    rationaleTemplate: 'Add alt attribute to image for accessibility',
  },
  {
    errorType: 'validation',
    messagePattern: /label|input.*id/i,
    action: 'edit',
    targetResolver: (e) => e.filePath || 'views/templates.xml',
    rationaleTemplate: 'Associate form input with label',
  },
  {
    errorType: 'validation',
    action: 'edit',
    targetResolver: (e) => e.filePath || 'views/templates.xml',
    rationaleTemplate: 'Fix accessibility issue',
  },

  // Odoo structure fixes
  {
    errorType: 'odoo',
    messagePattern: /manifest|__manifest__/i,
    action: 'write',
    targetResolver: () => '__manifest__.py',
    rationaleTemplate: 'Create module manifest file',
  },
  {
    errorType: 'odoo',
    messagePattern: /__init__|init\.py/i,
    action: 'write',
    targetResolver: (e) => {
      const dir = e.filePath?.split('/').slice(0, -1).join('/') || '';
      return `${dir}/__init__.py`;
    },
    rationaleTemplate: 'Create __init__.py for Python package',
  },
  {
    errorType: 'odoo',
    messagePattern: /filename|space|case/i,
    action: 'edit',
    targetResolver: (e) => e.filePath || '',
    rationaleTemplate: 'Fix file naming convention',
  },
  {
    errorType: 'odoo',
    action: 'edit',
    targetResolver: (e) => e.filePath || 'views/templates.xml',
    rationaleTemplate: 'Fix Odoo structure issue',
  },

  // Generic fallback
  {
    errorType: 'unknown',
    action: 'edit',
    targetResolver: (e) => e.filePath || 'unknown',
    rationaleTemplate: 'Fix error',
  },
];

// ============================================================================
// Replanner Class
// ============================================================================

/**
 * Replanner - Generates corrective plans from validation errors
 *
 * Takes validation results and generates targeted fix steps that
 * address specific files and line numbers.
 */
export class Replanner {
  private config: Required<ReplannerConfig>;
  private strategies: FixStrategy[];
  private errorInjector: ErrorInjector;

  constructor(config: ReplannerConfig = {}) {
    this.config = {
      maxFixSteps: config.maxFixSteps ?? 20,
      includeRevalidation: config.includeRevalidation ?? true,
      groupByFile: config.groupByFile ?? true,
      llmProvider: config.llmProvider as LLMProvider,
      errorInjector: config.errorInjector as ErrorInjector,
    };

    this.strategies = [...DEFAULT_FIX_STRATEGIES];
    this.errorInjector = config.errorInjector || createErrorInjector();
  }

  /**
   * Generate corrective plan steps from validation result
   */
  async replanWithErrors(
    validation: ValidationResult,
    context: AgentContext,
    existingPlan: AgentPlan | null,
    iteration: number
  ): Promise<ReplanResult> {
    // Convert validation checks to ValidatorResult format
    const validatorResults: ValidatorResult[] = validation.checks.map(check => ({
      name: check.name,
      passed: check.passed,
      score: check.score,
      errors: check.errors.map((msg, i) => ({
        code: `${check.name.toUpperCase()}_ERR_${i}`,
        message: msg,
        severity: 'error' as const,
      })),
      warnings: check.warnings.map((msg, i) => ({
        code: `${check.name.toUpperCase()}_WARN_${i}`,
        message: msg,
      })),
      duration: 0,
    }));

    // Build error context
    const errorContext = this.errorInjector.injectErrors(validatorResults, context, iteration);

    // Generate fix steps
    let fixSteps: AgentPlanStep[];

    if (this.config.llmProvider) {
      // Use LLM for intelligent replanning
      fixSteps = await this.generateLLMFixSteps(errorContext, context);
    } else {
      // Use strategy-based replanning
      fixSteps = this.generateStrategyFixSteps(errorContext);
    }

    // Group by file if enabled
    if (this.config.groupByFile) {
      fixSteps = this.groupFixesByFile(fixSteps);
    }

    // Limit steps
    fixSteps = fixSteps.slice(0, this.config.maxFixSteps);

    // Add revalidation step
    if (this.config.includeRevalidation && fixSteps.length > 0) {
      fixSteps.push({
        id: `revalidate-${iteration}-${Date.now()}`,
        action: 'validate',
        target: 'all',
        rationale: 'Re-validate after applying fixes to verify corrections',
        status: 'pending',
      });
    }

    // Build strategy summary
    const strategy = this.buildStrategySummary(errorContext, fixSteps);

    return {
      fixSteps,
      errorContext,
      targetedFiles: errorContext.affectedFiles,
      strategy,
    };
  }

  /**
   * Generate fix steps from AgentError array
   */
  async replanFromAgentErrors(
    errors: AgentError[],
    context: AgentContext,
    iteration: number
  ): Promise<ReplanResult> {
    const errorContext = this.errorInjector.fromAgentErrors(errors, context);

    let fixSteps: AgentPlanStep[];

    if (this.config.llmProvider) {
      fixSteps = await this.generateLLMFixSteps(errorContext, context);
    } else {
      fixSteps = this.generateStrategyFixSteps(errorContext);
    }

    if (this.config.groupByFile) {
      fixSteps = this.groupFixesByFile(fixSteps);
    }

    fixSteps = fixSteps.slice(0, this.config.maxFixSteps);

    if (this.config.includeRevalidation && fixSteps.length > 0) {
      fixSteps.push({
        id: `revalidate-${iteration}-${Date.now()}`,
        action: 'validate',
        target: 'all',
        rationale: 'Re-validate after applying fixes',
        status: 'pending',
      });
    }

    return {
      fixSteps,
      errorContext,
      targetedFiles: errorContext.affectedFiles,
      strategy: this.buildStrategySummary(errorContext, fixSteps),
    };
  }

  /**
   * Register a custom fix strategy
   */
  registerStrategy(strategy: FixStrategy): void {
    // Insert before fallback strategies
    this.strategies.unshift(strategy);
  }

  /**
   * Get LLM prompt for replanning
   */
  getReplanPrompt(errorContext: ErrorContext): string {
    return this.errorInjector.formatForPrompt(errorContext);
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private async generateLLMFixSteps(
    errorContext: ErrorContext,
    context: AgentContext
  ): Promise<AgentPlanStep[]> {
    if (!this.config.llmProvider) {
      return this.generateStrategyFixSteps(errorContext);
    }

    try {
      // Convert error context to AgentError format for LLM
      const agentErrors: AgentError[] = [
        ...errorContext.criticalErrors,
        ...errorContext.errors,
      ].map(e => ({
        id: e.id,
        type: e.type,
        message: e.message,
        file: e.filePath || undefined,
        line: e.lineNumber || undefined,
        column: e.columnNumber || undefined,
        severity: e.severity === 'critical' ? 'error' : e.severity,
        suggestion: e.suggestedFix || undefined,
        iteration: e.iteration,
        timestamp: new Date(),
      }));

      return this.config.llmProvider.generateFix(agentErrors, context);
    } catch (error) {
      console.error('LLM replanning failed, using strategy fallback:', error);
      return this.generateStrategyFixSteps(errorContext);
    }
  }

  private generateStrategyFixSteps(errorContext: ErrorContext): AgentPlanStep[] {
    const fixSteps: AgentPlanStep[] = [];
    const processedFiles = new Set<string>();

    // Process critical errors first
    for (const error of errorContext.criticalErrors) {
      const step = this.createFixStep(error, processedFiles);
      if (step) {
        fixSteps.push(step);
      }
    }

    // Then regular errors
    for (const error of errorContext.errors) {
      const step = this.createFixStep(error, processedFiles);
      if (step) {
        fixSteps.push(step);
      }
    }

    return fixSteps;
  }

  private createFixStep(
    error: InjectedError,
    processedFiles: Set<string>
  ): AgentPlanStep | null {
    // Find matching strategy
    const strategy = this.findStrategy(error);

    // Determine target
    const target = strategy.targetResolver(error);

    // Skip if we already have a fix for this file (when not grouping)
    if (!this.config.groupByFile && target && processedFiles.has(target)) {
      return null;
    }

    if (target) {
      processedFiles.add(target);
    }

    // Build rationale with specific error info
    let rationale = strategy.rationaleTemplate;
    if (error.filePath && error.lineNumber) {
      rationale += ` at ${error.filePath}:${error.lineNumber}`;
    }
    if (error.suggestedFix) {
      rationale += `. Suggestion: ${error.suggestedFix}`;
    }

    return {
      id: `fix-${error.id}`,
      action: strategy.action,
      target,
      rationale,
      status: 'pending',
    };
  }

  private findStrategy(error: InjectedError): FixStrategy {
    // First try to match by type and message pattern
    for (const strategy of this.strategies) {
      if (strategy.errorType === error.type) {
        if (strategy.messagePattern) {
          if (strategy.messagePattern.test(error.message)) {
            return strategy;
          }
        }
      }
    }

    // Then just match by type
    for (const strategy of this.strategies) {
      if (strategy.errorType === error.type && !strategy.messagePattern) {
        return strategy;
      }
    }

    // Fallback to unknown strategy
    return this.strategies.find(s => s.errorType === 'unknown')!;
  }

  private groupFixesByFile(steps: AgentPlanStep[]): AgentPlanStep[] {
    const byFile = new Map<string, AgentPlanStep[]>();
    const noFile: AgentPlanStep[] = [];

    for (const step of steps) {
      if (step.target && step.target !== 'all' && step.target !== 'unknown') {
        const existing = byFile.get(step.target) || [];
        existing.push(step);
        byFile.set(step.target, existing);
      } else {
        noFile.push(step);
      }
    }

    // Merge steps targeting same file
    const merged: AgentPlanStep[] = [];

    for (const [file, fileSteps] of byFile) {
      if (fileSteps.length === 1) {
        merged.push(fileSteps[0]);
      } else {
        // Combine rationales
        const combinedRationale = fileSteps
          .map(s => s.rationale)
          .join('; ');

        merged.push({
          id: `fix-grouped-${file.replace(/[^a-z0-9]/gi, '_')}`,
          action: 'edit',
          target: file,
          rationale: `Multiple fixes: ${combinedRationale}`,
          status: 'pending',
        });
      }
    }

    return [...merged, ...noFile];
  }

  private buildStrategySummary(errorContext: ErrorContext, fixSteps: AgentPlanStep[]): string {
    const parts: string[] = [];

    parts.push(`Replan strategy for ${errorContext.totalErrors} error(s):`);

    if (errorContext.criticalErrors.length > 0) {
      parts.push(`- ${errorContext.criticalErrors.length} critical fix(es) prioritized`);
    }

    parts.push(`- ${fixSteps.length} fix step(s) generated`);
    parts.push(`- ${errorContext.affectedFiles.length} file(s) targeted`);

    if (errorContext.fixPriority.length > 0) {
      parts.push(`- Fix order: ${errorContext.fixPriority.slice(0, 3).join(' → ')}${errorContext.fixPriority.length > 3 ? '...' : ''}`);
    }

    return parts.join('\n');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a replanner with default or custom configuration
 */
export function createReplanner(config?: ReplannerConfig): Replanner {
  return new Replanner(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default Replanner;

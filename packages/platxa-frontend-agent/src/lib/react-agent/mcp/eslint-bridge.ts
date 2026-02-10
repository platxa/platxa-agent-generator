/**
 * ESLint Bridge
 *
 * Provides programmatic access to ESLint for MCP integration.
 * Handles configuration loading, linting execution, and result normalization.
 *
 * @module react-agent/mcp/eslint-bridge
 */

import { ESLint, Linter } from 'eslint';
import type {
  LintResults,
  LintFileResult,
  LintMessage,
  LintSeverity,
  LintToolParams,
  ESLintMCPConfig,
  RuleInfo,
  RuleCategory,
} from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default rule category mappings
 */
const DEFAULT_RULE_CATEGORY_MAP: Record<string, RuleCategory> = {
  // Design token rules
  'platxa/no-hardcoded-colors': 'design-tokens',
  'platxa/prefer-brand-token': 'design-tokens',

  // Accessibility rules
  'jsx-a11y/alt-text': 'accessibility',
  'jsx-a11y/anchor-has-content': 'accessibility',
  'jsx-a11y/aria-props': 'accessibility',
  'jsx-a11y/aria-role': 'accessibility',
  'jsx-a11y/click-events-have-key-events': 'accessibility',
  'jsx-a11y/heading-has-content': 'accessibility',
  'jsx-a11y/label-has-associated-control': 'accessibility',
  'jsx-a11y/no-autofocus': 'accessibility',
  'jsx-a11y/no-noninteractive-element-interactions': 'accessibility',
  'jsx-a11y/role-has-required-aria-props': 'accessibility',
  'jsx-a11y/tabindex-no-positive': 'accessibility',

  // React rules
  'react/jsx-key': 'react',
  'react/jsx-no-duplicate-props': 'react',
  'react/jsx-no-undef': 'react',
  'react/no-children-prop': 'react',
  'react/no-danger': 'react',
  'react/no-deprecated': 'react',
  'react/no-direct-mutation-state': 'react',
  'react/no-unescaped-entities': 'react',
  'react/prop-types': 'react',
  'react-hooks/rules-of-hooks': 'react',
  'react-hooks/exhaustive-deps': 'react',

  // TypeScript rules
  '@typescript-eslint/no-unused-vars': 'typescript',
  '@typescript-eslint/no-explicit-any': 'typescript',
  '@typescript-eslint/explicit-function-return-type': 'typescript',
  '@typescript-eslint/no-non-null-assertion': 'typescript',
  '@typescript-eslint/strict-boolean-expressions': 'typescript',
  '@typescript-eslint/no-floating-promises': 'typescript',

  // Performance rules
  'react/jsx-no-bind': 'performance',
  'react/no-array-index-key': 'performance',

  // Security rules
  'no-eval': 'security',
  'no-implied-eval': 'security',
  'no-new-func': 'security',
  'react/no-danger-with-children': 'security',

  // Code quality rules
  'no-console': 'code-quality',
  'no-debugger': 'code-quality',
  'no-unused-vars': 'code-quality',
  'prefer-const': 'code-quality',
  'eqeqeq': 'code-quality',
  'no-var': 'code-quality',

  // Style rules
  'semi': 'style',
  'quotes': 'style',
  'indent': 'style',
  'comma-dangle': 'style',
};

// =============================================================================
// ESLINT BRIDGE CLASS
// =============================================================================

/**
 * Bridge class for programmatic ESLint access
 */
export class ESLintBridge {
  private config: ESLintMCPConfig;
  private eslint: ESLint | null = null;
  private ruleCategoryMap: Record<string, RuleCategory>;

  constructor(config: ESLintMCPConfig) {
    this.config = {
      cache: true,
      cacheLocation: '.eslintcache',
      aiAware: true,
      ...config,
    };
    this.ruleCategoryMap = {
      ...DEFAULT_RULE_CATEGORY_MAP,
      ...config.ruleCategoryMap,
    };
  }

  /**
   * Initialize ESLint instance
   */
  private async getESLint(options?: Partial<ESLint.Options>): Promise<ESLint> {
    if (this.eslint && !options) {
      return this.eslint;
    }

    const eslintOptions: ESLint.Options = {
      cwd: this.config.cwd,
      cache: this.config.cache,
      cacheLocation: this.config.cacheLocation,
      ...options,
    };

    if (this.config.configPath) {
      eslintOptions.overrideConfigFile = this.config.configPath;
    }

    const eslint = new ESLint(eslintOptions);

    if (!options) {
      this.eslint = eslint;
    }

    return eslint;
  }

  /**
   * Lint files and return normalized results
   */
  async lint(params: LintToolParams): Promise<LintResults> {
    const startTime = Date.now();

    const eslintOptions: Partial<ESLint.Options> = {
      fix: params.fix ?? false,
    };

    if (params.configPath) {
      eslintOptions.overrideConfigFile = params.configPath;
    }

    if (params.rules) {
      eslintOptions.overrideConfig = {
        rules: params.rules,
      };
    }

    const eslint = await this.getESLint(eslintOptions);
    const rawResults = await eslint.lintFiles(params.files);

    // Apply fixes if requested
    if (params.fix) {
      await ESLint.outputFixes(rawResults);
    }

    // Normalize results
    const results = this.normalizeResults(rawResults, params.includeSource);

    // Check max warnings
    if (params.maxWarnings !== undefined && results.warningCount > params.maxWarnings) {
      // Mark as having errors if warnings exceed threshold
      results.errorCount += 1;
    }

    return {
      ...results,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Lint source code string directly
   */
  async lintText(
    code: string,
    filePath?: string,
    options?: Partial<LintToolParams>
  ): Promise<LintFileResult> {
    const eslint = await this.getESLint({
      fix: options?.fix ?? false,
    });

    const rawResults = await eslint.lintText(code, {
      filePath: filePath ?? 'inline.tsx',
    });

    const results = this.normalizeResults(rawResults, options?.includeSource);
    return results.results[0] ?? this.createEmptyFileResult(filePath ?? 'inline.tsx');
  }

  /**
   * Check if files have any errors
   */
  async hasErrors(files: string[]): Promise<boolean> {
    const results = await this.lint({ files });
    return results.errorCount > 0;
  }

  /**
   * Get all available rules with metadata
   */
  async getRules(): Promise<RuleInfo[]> {
    const eslint = await this.getESLint();
    const config = await eslint.calculateConfigForFile('dummy.tsx');
    const rules: RuleInfo[] = [];

    // Get rule metadata from ESLint
    const rulesMeta = eslint.getRulesMetaForResults([]);

    for (const [ruleId, meta] of Object.entries(rulesMeta)) {
      if (!meta) continue;

      rules.push({
        id: ruleId,
        category: this.getRuleCategory(ruleId),
        description: meta.docs?.description ?? '',
        fixable: meta.fixable !== undefined,
        hasSuggestions: meta.hasSuggestions ?? false,
        recommended: this.getRecommendedSeverity(config, ruleId),
      });
    }

    return rules;
  }

  /**
   * Get the category for a rule
   */
  getRuleCategory(ruleId: string): RuleCategory {
    // Check exact match
    if (this.ruleCategoryMap[ruleId]) {
      return this.ruleCategoryMap[ruleId];
    }

    // Check prefix matches
    if (ruleId.startsWith('platxa/')) return 'design-tokens';
    if (ruleId.startsWith('jsx-a11y/')) return 'accessibility';
    if (ruleId.startsWith('react-hooks/')) return 'react';
    if (ruleId.startsWith('react/')) return 'react';
    if (ruleId.startsWith('@typescript-eslint/')) return 'typescript';

    return 'code-quality';
  }

  /**
   * Normalize ESLint results to our format
   */
  private normalizeResults(
    rawResults: ESLint.LintResult[],
    includeSource?: boolean
  ): Omit<LintResults, 'durationMs'> {
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalFixableErrors = 0;
    let totalFixableWarnings = 0;

    const results: LintFileResult[] = rawResults.map((result) => {
      const messages = result.messages.map((msg) =>
        this.normalizeMessage(msg)
      );

      const errorCount = messages.filter((m) => m.severity === 'error').length;
      const warningCount = messages.filter((m) => m.severity === 'warning').length;
      const fixableErrorCount = messages.filter(
        (m) => m.severity === 'error' && m.fixable
      ).length;
      const fixableWarningCount = messages.filter(
        (m) => m.severity === 'warning' && m.fixable
      ).length;

      totalErrors += errorCount;
      totalWarnings += warningCount;
      totalFixableErrors += fixableErrorCount;
      totalFixableWarnings += fixableWarningCount;

      const fileResult: LintFileResult = {
        filePath: result.filePath,
        messages,
        errorCount,
        warningCount,
        fixableErrorCount,
        fixableWarningCount,
      };

      if (includeSource && result.source) {
        fileResult.source = result.source;
      }

      if (result.output) {
        fileResult.output = result.output;
      }

      return fileResult;
    });

    return {
      results,
      errorCount: totalErrors,
      warningCount: totalWarnings,
      fixableErrorCount: totalFixableErrors,
      fixableWarningCount: totalFixableWarnings,
    };
  }

  /**
   * Normalize a single ESLint message
   */
  private normalizeMessage(msg: Linter.LintMessage): LintMessage {
    const severity: LintSeverity =
      msg.severity === 2 ? 'error' : msg.severity === 1 ? 'warning' : 'info';

    return {
      ruleId: msg.ruleId,
      severity,
      message: msg.message,
      line: msg.line,
      column: msg.column,
      endLine: msg.endLine,
      endColumn: msg.endColumn,
      nodeType: msg.nodeType ?? undefined,
      fixable: msg.fix !== undefined,
      suggestions: msg.suggestions?.map((s: Linter.LintSuggestion) => ({
        desc: s.desc,
        fix: {
          range: s.fix.range,
          text: s.fix.text,
        },
      })),
    };
  }

  /**
   * Create an empty file result
   */
  private createEmptyFileResult(filePath: string): LintFileResult {
    return {
      filePath,
      messages: [],
      errorCount: 0,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
    };
  }

  /**
   * Get recommended severity for a rule from config
   */
  private getRecommendedSeverity(
    config: Record<string, unknown>,
    ruleId: string
  ): 'off' | 'warn' | 'error' | undefined {
    const rules = config.rules as Record<string, unknown> | undefined;
    if (!rules || !rules[ruleId]) return undefined;

    const ruleConfig = rules[ruleId];
    const severity = Array.isArray(ruleConfig) ? ruleConfig[0] : ruleConfig;

    if (severity === 0 || severity === 'off') return 'off';
    if (severity === 1 || severity === 'warn') return 'warn';
    if (severity === 2 || severity === 'error') return 'error';

    return undefined;
  }
}

/**
 * Create an ESLint bridge instance
 */
export function createESLintBridge(config: ESLintMCPConfig): ESLintBridge {
  return new ESLintBridge(config);
}

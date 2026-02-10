/**
 * ESLint MCP Integration
 *
 * Provides MCP (Model Context Protocol) tools for AI-aware linting.
 * Enables AI agents to get lint results, analyze code quality,
 * and receive contextual recommendations during code generation.
 *
 * @module react-agent/mcp/eslint-mcp
 */

import { ESLintBridge, createESLintBridge } from './eslint-bridge.js';
import type {
  LintResults,
  LintFileResult,
  LintMessage,
  LintAnalysis,
  LintToolParams,
  AnalyzeToolParams,
  ReportToolParams,
  ESLintMCPConfig,
  ESLintMCPTool,
  RuleInfo,
  RuleCategory,
  DetectedPattern,
  AILintContext,
} from './types.js';

// =============================================================================
// ANALYZER
// =============================================================================

/**
 * Analyze lint results and generate AI-relevant insights
 */
function analyzeLintResults(
  results: LintResults,
  bridge: ESLintBridge,
  options?: Partial<AnalyzeToolParams>
): LintAnalysis {
  const focusCategories = options?.focusCategories;
  const topN = options?.topN ?? 10;

  // Group issues by category
  const issuesByCategory: Record<RuleCategory, LintMessage[]> = {
    'design-tokens': [],
    accessibility: [],
    performance: [],
    'code-quality': [],
    typescript: [],
    react: [],
    security: [],
    style: [],
  };

  const allMessages: LintMessage[] = [];

  for (const file of results.results) {
    for (const msg of file.messages) {
      const category = msg.ruleId
        ? bridge.getRuleCategory(msg.ruleId)
        : 'code-quality';

      // Filter by focus categories if specified
      if (!focusCategories || focusCategories.includes(category)) {
        issuesByCategory[category].push(msg);
        allMessages.push(msg);
      }
    }
  }

  // Calculate quality score (0-100)
  const qualityScore = calculateQualityScore(results, issuesByCategory);

  // Get top issues sorted by severity and frequency
  const topIssues = getTopIssues(allMessages, topN);

  // Detect patterns
  const patterns = detectPatterns(allMessages, bridge);

  // Generate recommendations
  const recommendations = options?.includeRecommendations !== false
    ? generateRecommendations(issuesByCategory, patterns)
    : [];

  // Generate summary
  const summary = generateSummary(results, qualityScore, patterns);

  return {
    qualityScore,
    issuesByCategory,
    topIssues,
    patterns,
    recommendations,
    summary,
  };
}

/**
 * Calculate quality score based on lint results
 */
function calculateQualityScore(
  results: LintResults,
  issuesByCategory: Record<RuleCategory, LintMessage[]>
): number {
  const totalFiles = results.results.length;
  if (totalFiles === 0) return 100;

  // Base score starts at 100
  let score = 100;

  // Deduct points for errors (more severe)
  score -= Math.min(50, results.errorCount * 5);

  // Deduct points for warnings (less severe)
  score -= Math.min(30, results.warningCount * 2);

  // Bonus for fixable issues (they're easier to address)
  const fixableRatio =
    (results.fixableErrorCount + results.fixableWarningCount) /
    Math.max(1, results.errorCount + results.warningCount);
  score += fixableRatio * 5;

  // Category-specific adjustments
  const criticalCategories: RuleCategory[] = ['security', 'accessibility'];
  for (const category of criticalCategories) {
    const categoryErrors = issuesByCategory[category].filter(
      (m) => m.severity === 'error'
    ).length;
    score -= categoryErrors * 3; // Extra penalty for critical category errors
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get top issues sorted by importance
 */
function getTopIssues(messages: LintMessage[], topN: number): LintMessage[] {
  // Count occurrences of each rule
  const ruleCounts = new Map<string, number>();
  for (const msg of messages) {
    if (msg.ruleId) {
      ruleCounts.set(msg.ruleId, (ruleCounts.get(msg.ruleId) ?? 0) + 1);
    }
  }

  // Sort by severity (errors first), then by frequency
  return [...messages]
    .sort((a, b) => {
      // Errors before warnings
      if (a.severity !== b.severity) {
        return a.severity === 'error' ? -1 : 1;
      }
      // More frequent rules first
      const aCount = a.ruleId ? ruleCounts.get(a.ruleId) ?? 0 : 0;
      const bCount = b.ruleId ? ruleCounts.get(b.ruleId) ?? 0 : 0;
      return bCount - aCount;
    })
    .slice(0, topN);
}

/**
 * Detect patterns in lint issues
 */
function detectPatterns(
  messages: LintMessage[],
  bridge: ESLintBridge
): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const ruleCounts = new Map<string, number>();
  const categoryRules = new Map<RuleCategory, Set<string>>();

  // Count rules and group by category
  for (const msg of messages) {
    if (!msg.ruleId) continue;

    ruleCounts.set(msg.ruleId, (ruleCounts.get(msg.ruleId) ?? 0) + 1);

    const category = bridge.getRuleCategory(msg.ruleId);
    if (!categoryRules.has(category)) {
      categoryRules.set(category, new Set());
    }
    categoryRules.get(category)!.add(msg.ruleId);
  }

  // Detect repeated rule violations
  for (const [ruleId, count] of ruleCounts) {
    if (count >= 3) {
      patterns.push({
        type: 'repeated-violation',
        count,
        ruleIds: [ruleId],
        description: `Rule "${ruleId}" violated ${count} times`,
        action: `Review and fix all ${count} occurrences of ${ruleId} violations`,
      });
    }
  }

  // Detect category-wide issues
  for (const [category, rules] of categoryRules) {
    if (rules.size >= 3) {
      const ruleIds = [...rules];
      const totalCount = ruleIds.reduce(
        (sum, id) => sum + (ruleCounts.get(id) ?? 0),
        0
      );
      patterns.push({
        type: 'category-issue',
        count: totalCount,
        ruleIds,
        description: `Multiple ${category} issues detected (${rules.size} different rules)`,
        action: `Focus on improving ${category} compliance across the codebase`,
      });
    }
  }

  // Detect design token issues specifically
  const designTokenRules = categoryRules.get('design-tokens');
  if (designTokenRules && designTokenRules.size > 0) {
    const tokenCount = [...designTokenRules].reduce(
      (sum, id) => sum + (ruleCounts.get(id) ?? 0),
      0
    );
    if (tokenCount >= 5) {
      patterns.push({
        type: 'design-system-violation',
        count: tokenCount,
        ruleIds: [...designTokenRules],
        description: `${tokenCount} hardcoded values instead of design tokens`,
        action: 'Replace hardcoded colors/values with brand() tokens or CSS variables',
      });
    }
  }

  return patterns;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  issuesByCategory: Record<RuleCategory, LintMessage[]>,
  patterns: DetectedPattern[]
): string[] {
  const recommendations: string[] = [];

  // Category-specific recommendations
  if (issuesByCategory['design-tokens'].length > 0) {
    recommendations.push(
      'Use brand() function or CSS variables for colors instead of hardcoded values'
    );
  }

  if (issuesByCategory.accessibility.length > 0) {
    recommendations.push(
      'Add missing ARIA attributes and ensure all interactive elements are keyboard accessible'
    );
  }

  if (issuesByCategory.react.length > 0) {
    const hookIssues = issuesByCategory.react.filter((m) =>
      m.ruleId?.includes('hooks')
    );
    if (hookIssues.length > 0) {
      recommendations.push(
        'Review React hooks usage - ensure dependencies are complete and hooks are called consistently'
      );
    }
  }

  if (issuesByCategory.typescript.length > 0) {
    const anyIssues = issuesByCategory.typescript.filter((m) =>
      m.ruleId?.includes('explicit-any')
    );
    if (anyIssues.length > 0) {
      recommendations.push(
        'Replace `any` types with proper TypeScript types for better type safety'
      );
    }
  }

  if (issuesByCategory.security.length > 0) {
    recommendations.push(
      'Address security issues immediately - avoid eval(), dangerouslySetInnerHTML without sanitization'
    );
  }

  // Pattern-based recommendations
  for (const pattern of patterns) {
    if (pattern.type === 'design-system-violation') {
      recommendations.push(
        'Consider creating a codemod to automatically migrate hardcoded colors to tokens'
      );
    }
  }

  return recommendations;
}

/**
 * Generate a summary for AI context
 */
function generateSummary(
  results: LintResults,
  qualityScore: number,
  patterns: DetectedPattern[]
): string {
  const parts: string[] = [];

  parts.push(`Quality Score: ${qualityScore}/100`);

  if (results.errorCount > 0) {
    parts.push(`${results.errorCount} error(s)`);
  }

  if (results.warningCount > 0) {
    parts.push(`${results.warningCount} warning(s)`);
  }

  if (results.fixableErrorCount + results.fixableWarningCount > 0) {
    parts.push(
      `${results.fixableErrorCount + results.fixableWarningCount} auto-fixable`
    );
  }

  if (patterns.length > 0) {
    const topPattern = patterns[0];
    parts.push(`Main pattern: ${topPattern.description}`);
  }

  return parts.join(' | ');
}

// =============================================================================
// REPORT GENERATOR
// =============================================================================

/**
 * Generate formatted report from lint results
 */
function generateReport(
  results: LintResults,
  params: ReportToolParams
): string {
  switch (params.format) {
    case 'json':
      return JSON.stringify(results, null, 2);
    case 'markdown':
      return generateMarkdownReport(results, params);
    case 'detailed':
      return generateDetailedReport(results, params);
    case 'summary':
    default:
      return generateSummaryReport(results);
  }
}

/**
 * Generate summary report
 */
function generateSummaryReport(results: LintResults): string {
  const lines: string[] = [];

  lines.push('=== ESLint Results ===');
  lines.push(`Files: ${results.results.length}`);
  lines.push(`Errors: ${results.errorCount}`);
  lines.push(`Warnings: ${results.warningCount}`);
  lines.push(`Fixable: ${results.fixableErrorCount + results.fixableWarningCount}`);
  lines.push(`Duration: ${results.durationMs}ms`);

  if (results.errorCount === 0 && results.warningCount === 0) {
    lines.push('\n✓ No issues found!');
  }

  return lines.join('\n');
}

/**
 * Generate detailed report
 */
function generateDetailedReport(
  results: LintResults,
  params: ReportToolParams
): string {
  const lines: string[] = [];

  lines.push('=== ESLint Detailed Report ===\n');

  const groupedResults = groupResults(results, params.groupBy ?? 'file');

  for (const [key, items] of Object.entries(groupedResults)) {
    lines.push(`--- ${key} ---`);

    for (const item of items) {
      const severity = item.severity.toUpperCase().padEnd(7);
      const location = `${item.line}:${item.column}`;
      lines.push(`  ${severity} ${location.padEnd(8)} ${item.message}`);

      if (params.includeFixes && item.fixable) {
        lines.push(`           ↳ Auto-fixable`);
      }

      if (params.includeFixes && item.suggestions?.length) {
        for (const suggestion of item.suggestions) {
          lines.push(`           ↳ Suggestion: ${suggestion.desc}`);
        }
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(
  results: LintResults,
  params: ReportToolParams
): string {
  const lines: string[] = [];

  lines.push('# ESLint Report\n');

  // Summary table
  lines.push('## Summary\n');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Files | ${results.results.length} |`);
  lines.push(`| Errors | ${results.errorCount} |`);
  lines.push(`| Warnings | ${results.warningCount} |`);
  lines.push(`| Fixable | ${results.fixableErrorCount + results.fixableWarningCount} |`);
  lines.push('');

  // Issues by file
  if (results.errorCount > 0 || results.warningCount > 0) {
    lines.push('## Issues\n');

    const groupedResults = groupResults(results, params.groupBy ?? 'file');

    for (const [key, items] of Object.entries(groupedResults)) {
      lines.push(`### ${key}\n`);

      for (const item of items) {
        const icon = item.severity === 'error' ? '❌' : '⚠️';
        const fix = item.fixable ? ' 🔧' : '';
        lines.push(
          `- ${icon} **${item.line}:${item.column}** ${item.message}${fix}`
        );

        if (params.includeFixes && item.suggestions?.length) {
          for (const suggestion of item.suggestions) {
            lines.push(`  - 💡 ${suggestion.desc}`);
          }
        }
      }

      lines.push('');
    }
  } else {
    lines.push('## ✅ No issues found!\n');
  }

  return lines.join('\n');
}

/**
 * Group results by file, rule, or severity
 */
function groupResults(
  results: LintResults,
  groupBy: 'file' | 'rule' | 'severity'
): Record<string, LintMessage[]> {
  const grouped: Record<string, LintMessage[]> = {};

  for (const file of results.results) {
    for (const msg of file.messages) {
      let key: string;

      switch (groupBy) {
        case 'rule':
          key = msg.ruleId ?? 'unknown';
          break;
        case 'severity':
          key = msg.severity;
          break;
        case 'file':
        default:
          key = file.filePath;
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(msg);
    }
  }

  return grouped;
}

// =============================================================================
// MCP TOOL FACTORY
// =============================================================================

/**
 * Create ESLint MCP tool instance
 */
export function createESLintMCPTool(config: ESLintMCPConfig): ESLintMCPTool {
  const bridge = createESLintBridge(config);

  return {
    async lint(params: LintToolParams): Promise<LintResults> {
      return bridge.lint(params);
    },

    async analyze(params: AnalyzeToolParams): Promise<LintAnalysis> {
      let results: LintResults;

      if (Array.isArray(params.input)) {
        // Input is file paths - lint them first
        results = await bridge.lint({ files: params.input });
      } else {
        // Input is already lint results
        results = params.input;
      }

      return analyzeLintResults(results, bridge, params);
    },

    async report(params: ReportToolParams): Promise<string> {
      return generateReport(params.results, params);
    },

    async getRules(): Promise<RuleInfo[]> {
      return bridge.getRules();
    },

    async hasErrors(files: string[]): Promise<boolean> {
      return bridge.hasErrors(files);
    },
  };
}

/**
 * Create AI lint context from files
 */
export async function createAILintContext(
  tool: ESLintMCPTool,
  files: string[]
): Promise<AILintContext> {
  const results = await tool.lint({ files });
  const analysis = await tool.analyze({ input: results });
  const rules = await tool.getRules();

  return {
    qualityScore: analysis.qualityScore,
    activeIssues: analysis.topIssues,
    patternsToAvoid: analysis.patterns.map((p) => p.description),
    improvements: analysis.recommendations,
    relevantRules: rules.filter((r) =>
      analysis.topIssues.some((i) => i.ruleId === r.id)
    ),
  };
}

// Re-export types
export type {
  LintResults,
  LintFileResult,
  LintMessage,
  LintAnalysis,
  LintToolParams,
  AnalyzeToolParams,
  ReportToolParams,
  ESLintMCPConfig,
  ESLintMCPTool,
  RuleInfo,
  RuleCategory,
  AILintContext,
};

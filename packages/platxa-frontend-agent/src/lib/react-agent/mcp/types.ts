/**
 * ESLint MCP Integration Types
 *
 * Type definitions for the ESLint MCP server integration,
 * enabling AI-aware linting during code generation.
 *
 * @module react-agent/mcp/types
 */

// =============================================================================
// LINT RESULT TYPES
// =============================================================================

/**
 * ESLint message severity levels
 */
export type LintSeverity = 'error' | 'warning' | 'info';

/**
 * Individual lint message from ESLint
 */
export interface LintMessage {
  /** Rule ID that generated this message */
  ruleId: string | null;
  /** Message severity */
  severity: LintSeverity;
  /** Human-readable message */
  message: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** End line number */
  endLine?: number;
  /** End column number */
  endColumn?: number;
  /** Node type that triggered the rule */
  nodeType?: string;
  /** Whether this issue can be auto-fixed */
  fixable: boolean;
  /** Suggested fixes */
  suggestions?: LintSuggestion[];
}

/**
 * A suggested fix for a lint issue
 */
export interface LintSuggestion {
  /** Suggestion description */
  desc: string;
  /** The fix to apply */
  fix: LintFix;
}

/**
 * A fix that can be applied to source code
 */
export interface LintFix {
  /** Start offset in source */
  range: [number, number];
  /** Replacement text */
  text: string;
}

/**
 * Lint results for a single file
 */
export interface LintFileResult {
  /** Absolute file path */
  filePath: string;
  /** Lint messages for this file */
  messages: LintMessage[];
  /** Number of errors */
  errorCount: number;
  /** Number of warnings */
  warningCount: number;
  /** Number of fixable errors */
  fixableErrorCount: number;
  /** Number of fixable warnings */
  fixableWarningCount: number;
  /** Source code (if requested) */
  source?: string;
  /** Fixed source code (if fix was applied) */
  output?: string;
}

/**
 * Aggregated lint results
 */
export interface LintResults {
  /** Results per file */
  results: LintFileResult[];
  /** Total error count */
  errorCount: number;
  /** Total warning count */
  warningCount: number;
  /** Total fixable error count */
  fixableErrorCount: number;
  /** Total fixable warning count */
  fixableWarningCount: number;
  /** Linting duration in milliseconds */
  durationMs: number;
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

/**
 * Rule category for grouping related issues
 */
export type RuleCategory =
  | 'design-tokens'
  | 'accessibility'
  | 'performance'
  | 'code-quality'
  | 'typescript'
  | 'react'
  | 'security'
  | 'style';

/**
 * Analysis of lint results with AI-relevant insights
 */
export interface LintAnalysis {
  /** Quality score (0-100) */
  qualityScore: number;
  /** Issues grouped by category */
  issuesByCategory: Record<RuleCategory, LintMessage[]>;
  /** Top issues to address */
  topIssues: LintMessage[];
  /** Common patterns detected */
  patterns: DetectedPattern[];
  /** Recommendations for improvement */
  recommendations: string[];
  /** Summary for AI context */
  summary: string;
}

/**
 * A pattern detected across multiple lint issues
 */
export interface DetectedPattern {
  /** Pattern type */
  type: string;
  /** Number of occurrences */
  count: number;
  /** Rule IDs involved */
  ruleIds: string[];
  /** Description of the pattern */
  description: string;
  /** Suggested action */
  action: string;
}

// =============================================================================
// MCP TOOL TYPES
// =============================================================================

/**
 * Parameters for the lint tool
 */
export interface LintToolParams {
  /** File paths or glob patterns to lint */
  files: string[];
  /** Whether to attempt auto-fixing */
  fix?: boolean;
  /** Specific rules to enable/disable */
  rules?: Record<string, 'off' | 'warn' | 'error'>;
  /** ESLint config file path */
  configPath?: string;
  /** Include source in results */
  includeSource?: boolean;
  /** Maximum number of warnings before failing */
  maxWarnings?: number;
}

/**
 * Parameters for the analyze tool
 */
export interface AnalyzeToolParams {
  /** Lint results to analyze (or paths to lint first) */
  input: LintResults | string[];
  /** Focus categories */
  focusCategories?: RuleCategory[];
  /** Number of top issues to return */
  topN?: number;
  /** Whether to include recommendations */
  includeRecommendations?: boolean;
}

/**
 * Parameters for the report tool
 */
export interface ReportToolParams {
  /** Lint results to report */
  results: LintResults;
  /** Report format */
  format: 'summary' | 'detailed' | 'json' | 'markdown';
  /** Include fix suggestions */
  includeFixes?: boolean;
  /** Group by file or rule */
  groupBy?: 'file' | 'rule' | 'severity';
}

// =============================================================================
// MCP SERVER TYPES
// =============================================================================

/**
 * ESLint MCP server configuration
 */
export interface ESLintMCPConfig {
  /** Working directory for ESLint */
  cwd: string;
  /** Default ESLint config path */
  configPath?: string;
  /** Cache ESLint results */
  cache?: boolean;
  /** Cache location */
  cacheLocation?: string;
  /** Custom rule mappings to categories */
  ruleCategoryMap?: Record<string, RuleCategory>;
  /** Enable AI-aware rule suggestions */
  aiAware?: boolean;
}

/**
 * ESLint MCP tool interface
 */
export interface ESLintMCPTool {
  /** Lint files and return results */
  lint: (params: LintToolParams) => Promise<LintResults>;
  /** Analyze lint results for AI context */
  analyze: (params: AnalyzeToolParams) => Promise<LintAnalysis>;
  /** Generate formatted report */
  report: (params: ReportToolParams) => Promise<string>;
  /** Get available rules */
  getRules: () => Promise<RuleInfo[]>;
  /** Check if files have lint errors */
  hasErrors: (files: string[]) => Promise<boolean>;
}

/**
 * Information about an ESLint rule
 */
export interface RuleInfo {
  /** Rule ID */
  id: string;
  /** Rule category */
  category: RuleCategory;
  /** Rule description */
  description: string;
  /** Whether the rule is fixable */
  fixable: boolean;
  /** Whether the rule has suggestions */
  hasSuggestions: boolean;
  /** Recommended severity */
  recommended?: 'off' | 'warn' | 'error';
}

// =============================================================================
// AI CONTEXT TYPES
// =============================================================================

/**
 * Lint context for AI code generation
 */
export interface AILintContext {
  /** Current quality score */
  qualityScore: number;
  /** Active issues to address */
  activeIssues: LintMessage[];
  /** Patterns to avoid based on past issues */
  patternsToAvoid: string[];
  /** Suggested improvements */
  improvements: string[];
  /** Rules the AI should be aware of */
  relevantRules: RuleInfo[];
}

/**
 * Create AI-friendly lint context from analysis
 */
export function createAIContext(analysis: LintAnalysis, rules: RuleInfo[]): AILintContext {
  return {
    qualityScore: analysis.qualityScore,
    activeIssues: analysis.topIssues,
    patternsToAvoid: analysis.patterns.map(p => p.description),
    improvements: analysis.recommendations,
    relevantRules: rules.filter(r =>
      analysis.topIssues.some(i => i.ruleId === r.id)
    ),
  };
}

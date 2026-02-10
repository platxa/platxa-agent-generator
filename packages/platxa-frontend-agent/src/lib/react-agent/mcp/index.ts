/**
 * ESLint MCP Integration
 *
 * Provides MCP (Model Context Protocol) tools for AI-aware linting.
 * This module enables AI agents to receive lint feedback during code generation,
 * helping them produce code that follows project standards and best practices.
 *
 * @example Basic usage
 * ```typescript
 * import { createESLintMCPTool } from 'platxa-frontend-agent/mcp';
 *
 * const tool = createESLintMCPTool({
 *   cwd: process.cwd(),
 *   aiAware: true,
 * });
 *
 * // Lint files
 * const results = await tool.lint({ files: ['src/**\/*.tsx'] });
 *
 * // Analyze for AI context
 * const analysis = await tool.analyze({ input: results });
 * console.log(`Quality Score: ${analysis.qualityScore}/100`);
 *
 * // Generate report
 * const report = await tool.report({
 *   results,
 *   format: 'markdown',
 *   includeFixes: true,
 * });
 * ```
 *
 * @example Creating AI context for code generation
 * ```typescript
 * import { createESLintMCPTool, createAILintContext } from 'platxa-frontend-agent/mcp';
 *
 * const tool = createESLintMCPTool({ cwd: process.cwd() });
 *
 * // Get context for AI to understand current code quality
 * const context = await createAILintContext(tool, ['src/components/**\/*.tsx']);
 *
 * // Use context in AI prompts
 * const prompt = `
 *   Current quality score: ${context.qualityScore}/100
 *   Issues to address: ${context.activeIssues.map(i => i.message).join(', ')}
 *   Patterns to avoid: ${context.patternsToAvoid.join(', ')}
 * `;
 * ```
 *
 * @module react-agent/mcp
 */

// Main exports
export {
  createESLintMCPTool,
  createAILintContext,
} from './eslint-mcp.js';

// Bridge exports (for advanced usage)
export {
  ESLintBridge,
  createESLintBridge,
} from './eslint-bridge.js';

// Type exports
export type {
  // Lint result types
  LintSeverity,
  LintMessage,
  LintSuggestion,
  LintFix,
  LintFileResult,
  LintResults,

  // Analysis types
  RuleCategory,
  LintAnalysis,
  DetectedPattern,

  // Tool parameter types
  LintToolParams,
  AnalyzeToolParams,
  ReportToolParams,

  // Configuration types
  ESLintMCPConfig,
  ESLintMCPTool,
  RuleInfo,

  // AI context types
  AILintContext,
} from './types.js';

// Utility re-export
export { createAIContext } from './types.js';

/**
 * ESLint MCP Integration Tests
 *
 * Tests for the ESLint MCP tools including linting, analysis, and reporting.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type {
  LintResults,
  LintMessage,
  ESLintMCPConfig,
} from '../types.js';

// Mock ESLint module
vi.mock('eslint', () => ({
  ESLint: vi.fn().mockImplementation(() => ({
    lintFiles: vi.fn().mockResolvedValue([]),
    lintText: vi.fn().mockResolvedValue([]),
    calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
    getRulesMetaForResults: vi.fn().mockReturnValue({}),
  })),
  Linter: vi.fn(),
}));

// Import after mocking
import { createESLintMCPTool, createAILintContext } from '../eslint-mcp.js';
import { ESLintBridge, createESLintBridge } from '../eslint-bridge.js';
import { ESLint } from 'eslint';

describe('ESLint MCP Integration', () => {
  const mockConfig: ESLintMCPConfig = {
    cwd: '/test/project',
    cache: false,
    aiAware: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createESLintMCPTool', () => {
    it('should create a tool with all required methods', () => {
      const tool = createESLintMCPTool(mockConfig);

      expect(tool).toHaveProperty('lint');
      expect(tool).toHaveProperty('analyze');
      expect(tool).toHaveProperty('report');
      expect(tool).toHaveProperty('getRules');
      expect(tool).toHaveProperty('hasErrors');

      expect(typeof tool.lint).toBe('function');
      expect(typeof tool.analyze).toBe('function');
      expect(typeof tool.report).toBe('function');
      expect(typeof tool.getRules).toBe('function');
      expect(typeof tool.hasErrors).toBe('function');
    });
  });

  describe('ESLintBridge', () => {
    it('should create a bridge with default config', () => {
      const bridge = createESLintBridge(mockConfig);
      expect(bridge).toBeInstanceOf(ESLintBridge);
    });

    it('should merge custom rule category mappings', () => {
      const customConfig: ESLintMCPConfig = {
        ...mockConfig,
        ruleCategoryMap: {
          'custom/my-rule': 'security',
        },
      };

      const bridge = createESLintBridge(customConfig);
      expect(bridge.getRuleCategory('custom/my-rule')).toBe('security');
    });

    it('should categorize rules by prefix', () => {
      const bridge = createESLintBridge(mockConfig);

      expect(bridge.getRuleCategory('platxa/no-hardcoded-colors')).toBe('design-tokens');
      expect(bridge.getRuleCategory('jsx-a11y/alt-text')).toBe('accessibility');
      expect(bridge.getRuleCategory('react/jsx-key')).toBe('react');
      expect(bridge.getRuleCategory('react-hooks/rules-of-hooks')).toBe('react');
      expect(bridge.getRuleCategory('@typescript-eslint/no-unused-vars')).toBe('typescript');
      expect(bridge.getRuleCategory('unknown-rule')).toBe('code-quality');
    });
  });

  describe('Lint Results Processing', () => {
    it('should handle empty lint results', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);
      const results = await tool.lint({ files: ['src/**/*.tsx'] });

      expect(results.errorCount).toBe(0);
      expect(results.warningCount).toBe(0);
      expect(results.results).toEqual([]);
    });

    it('should normalize ESLint messages correctly', async () => {
      const mockMessages = [
        {
          ruleId: 'no-unused-vars',
          severity: 2, // error
          message: 'Variable is not used',
          line: 10,
          column: 5,
          endLine: 10,
          endColumn: 15,
          nodeType: 'Identifier',
          fix: { range: [100, 110], text: '' },
        },
        {
          ruleId: 'semi',
          severity: 1, // warning
          message: 'Missing semicolon',
          line: 20,
          column: 30,
        },
      ];

      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([
          {
            filePath: '/test/file.tsx',
            messages: mockMessages,
            errorCount: 1,
            warningCount: 1,
          },
        ]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);
      const results = await tool.lint({ files: ['test.tsx'] });

      expect(results.errorCount).toBe(1);
      expect(results.warningCount).toBe(1);
      expect(results.results[0].messages[0].severity).toBe('error');
      expect(results.results[0].messages[0].fixable).toBe(true);
      expect(results.results[0].messages[1].severity).toBe('warning');
      expect(results.results[0].messages[1].fixable).toBe(false);
    });
  });

  describe('Analysis', () => {
    const createMockResults = (messages: Partial<LintMessage>[]): LintResults => ({
      results: [
        {
          filePath: '/test/file.tsx',
          messages: messages.map((m) => ({
            ruleId: m.ruleId ?? null,
            severity: m.severity ?? 'warning',
            message: m.message ?? 'Test message',
            line: m.line ?? 1,
            column: m.column ?? 1,
            fixable: m.fixable ?? false,
          })) as LintMessage[],
          errorCount: messages.filter((m) => m.severity === 'error').length,
          warningCount: messages.filter((m) => m.severity === 'warning').length,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ],
      errorCount: messages.filter((m) => m.severity === 'error').length,
      warningCount: messages.filter((m) => m.severity === 'warning').length,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      durationMs: 100,
    });

    it('should calculate quality score correctly', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);

      // Perfect score for no issues
      const perfectResults = createMockResults([]);
      const perfectAnalysis = await tool.analyze({ input: perfectResults });
      expect(perfectAnalysis.qualityScore).toBe(100);

      // Lower score for errors
      const errorResults = createMockResults([
        { severity: 'error', ruleId: 'no-unused-vars' },
        { severity: 'error', ruleId: 'no-console' },
      ]);
      const errorAnalysis = await tool.analyze({ input: errorResults });
      expect(errorAnalysis.qualityScore).toBeLessThan(100);
    });

    it('should group issues by category', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);

      const results = createMockResults([
        { severity: 'error', ruleId: 'platxa/no-hardcoded-colors' },
        { severity: 'warning', ruleId: 'jsx-a11y/alt-text' },
        { severity: 'warning', ruleId: 'react/jsx-key' },
      ]);

      const analysis = await tool.analyze({ input: results });

      expect(analysis.issuesByCategory['design-tokens'].length).toBe(1);
      expect(analysis.issuesByCategory.accessibility.length).toBe(1);
      expect(analysis.issuesByCategory.react.length).toBe(1);
    });

    it('should detect patterns in repeated violations', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);

      const results = createMockResults([
        { severity: 'warning', ruleId: 'no-console', line: 10 },
        { severity: 'warning', ruleId: 'no-console', line: 20 },
        { severity: 'warning', ruleId: 'no-console', line: 30 },
        { severity: 'warning', ruleId: 'no-console', line: 40 },
      ]);

      const analysis = await tool.analyze({ input: results });

      expect(analysis.patterns.length).toBeGreaterThan(0);
      const repeatPattern = analysis.patterns.find(
        (p) => p.type === 'repeated-violation'
      );
      expect(repeatPattern).toBeDefined();
      expect(repeatPattern?.count).toBe(4);
    });

    it('should generate recommendations for design token issues', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);

      const results = createMockResults([
        { severity: 'warning', ruleId: 'platxa/no-hardcoded-colors' },
      ]);

      const analysis = await tool.analyze({
        input: results,
        includeRecommendations: true,
      });

      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(
        analysis.recommendations.some((r) =>
          r.toLowerCase().includes('brand')
        )
      ).toBe(true);
    });
  });

  describe('Report Generation', () => {
    const mockResults: LintResults = {
      results: [
        {
          filePath: '/test/component.tsx',
          messages: [
            {
              ruleId: 'no-unused-vars',
              severity: 'error',
              message: 'Variable x is not used',
              line: 10,
              column: 5,
              fixable: true,
            },
          ],
          errorCount: 1,
          warningCount: 0,
          fixableErrorCount: 1,
          fixableWarningCount: 0,
        },
      ],
      errorCount: 1,
      warningCount: 0,
      fixableErrorCount: 1,
      fixableWarningCount: 0,
      durationMs: 50,
    };

    it('should generate summary report', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);
      const report = await tool.report({
        results: mockResults,
        format: 'summary',
      });

      expect(report).toContain('ESLint Results');
      expect(report).toContain('Errors: 1');
      expect(report).toContain('Fixable: 1');
    });

    it('should generate JSON report', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);
      const report = await tool.report({
        results: mockResults,
        format: 'json',
      });

      const parsed = JSON.parse(report);
      expect(parsed.errorCount).toBe(1);
      expect(parsed.results).toHaveLength(1);
    });

    it('should generate markdown report', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);
      const report = await tool.report({
        results: mockResults,
        format: 'markdown',
        includeFixes: true,
      });

      expect(report).toContain('# ESLint Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('| Errors | 1 |');
      expect(report).toContain('❌');
    });

    it('should generate detailed report grouped by file', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);
      const report = await tool.report({
        results: mockResults,
        format: 'detailed',
        groupBy: 'file',
      });

      expect(report).toContain('/test/component.tsx');
      expect(report).toContain('ERROR');
    });
  });

  describe('AI Context', () => {
    it('should create AI-friendly lint context', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([
          {
            filePath: '/test/file.tsx',
            messages: [
              {
                ruleId: 'no-console',
                severity: 1,
                message: 'Unexpected console statement',
                line: 5,
                column: 1,
              },
            ],
          },
        ]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({
          'no-console': {
            docs: { description: 'Disallow console' },
            fixable: false,
          },
        }),
      }));

      const tool = createESLintMCPTool(mockConfig);
      const context = await createAILintContext(tool, ['test.tsx']);

      expect(context).toHaveProperty('qualityScore');
      expect(context).toHaveProperty('activeIssues');
      expect(context).toHaveProperty('patternsToAvoid');
      expect(context).toHaveProperty('improvements');
      expect(context).toHaveProperty('relevantRules');

      expect(typeof context.qualityScore).toBe('number');
      expect(Array.isArray(context.activeIssues)).toBe(true);
    });
  });

  describe('hasErrors', () => {
    it('should return true when there are errors', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([
          {
            filePath: '/test/file.tsx',
            messages: [
              {
                ruleId: 'no-unused-vars',
                severity: 2,
                message: 'Error',
                line: 1,
                column: 1,
              },
            ],
          },
        ]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);
      const hasErrors = await tool.hasErrors(['test.tsx']);
      expect(hasErrors).toBe(true);
    });

    it('should return false when there are only warnings', async () => {
      const MockESLint = ESLint as unknown as Mock;
      MockESLint.mockImplementation(() => ({
        lintFiles: vi.fn().mockResolvedValue([
          {
            filePath: '/test/file.tsx',
            messages: [
              {
                ruleId: 'no-console',
                severity: 1,
                message: 'Warning',
                line: 1,
                column: 1,
              },
            ],
          },
        ]),
        lintText: vi.fn().mockResolvedValue([]),
        calculateConfigForFile: vi.fn().mockResolvedValue({ rules: {} }),
        getRulesMetaForResults: vi.fn().mockReturnValue({}),
      }));

      const tool = createESLintMCPTool(mockConfig);
      const hasErrors = await tool.hasErrors(['test.tsx']);
      expect(hasErrors).toBe(false);
    });
  });
});

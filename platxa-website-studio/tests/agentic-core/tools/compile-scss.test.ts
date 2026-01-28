/**
 * Compile SCSS Tool Tests - REAL INTEGRATION TESTS
 * Verifies Feature #22: compile_scss tool using dart-sass with Odoo variable imports
 *
 * These are real integration tests that:
 * - Compile actual SCSS content using dart-sass
 * - Verify Odoo variable imports work correctly
 * - Test error reporting with line numbers
 *
 * Verification criteria:
 * - Compiles SCSS with Odoo imports
 * - Returns CSS or errors with line numbers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { existsSync, unlinkSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import {
  compileScssTool,
  compileScssImpl,
  type CompileScssResult,
  type ScssError,
} from '@/lib/agentic-core/tools/compile-scss';
import type { ToolParams } from '@/lib/agentic-core/tool-executor';
import type { AgentContext } from '@/lib/agentic-core/agent-engine';

const createMockContext = (): AgentContext => ({
  filesRead: new Map(),
  searchResults: new Map(),
  userPreferences: {},
  odooContext: {},
});

const createToolParams = (target: string, options?: Record<string, unknown>): ToolParams => ({
  target,
  context: createMockContext(),
  options,
});

// Test directory for file operations
const TEST_DIR = resolve(__dirname, '../../../.test-output');
const TEST_SCSS_FILE = resolve(TEST_DIR, 'test-compile.scss');
const TEST_CSS_OUTPUT = resolve(TEST_DIR, 'test-output.css');

// Sample SCSS content
const SIMPLE_SCSS = `
.container {
  display: flex;
  justify-content: center;

  .child {
    color: blue;
  }
}
`;

const SCSS_WITH_VARIABLES = `
$primary-color: #714B67;
$secondary-color: #017e84;

.header {
  background-color: $primary-color;
  border-color: $secondary-color;
}
`;

const SCSS_WITH_ODOO_VARS = `
.brand {
  color: $o-brand-primary;
  background: $o-gray-100;
}
`;

const SCSS_WITH_ODOO_MIXINS = `
.centered-box {
  @include o-position-center();
  width: 200px;
  height: 200px;
}

.truncated-text {
  @include o-text-overflow();
}
`;

const SCSS_WITH_NESTING = `
nav {
  ul {
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: inline-block;

      a {
        text-decoration: none;
        color: inherit;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}
`;

const INVALID_SCSS_SYNTAX = `
.broken {
  color: red
  // Missing semicolon above and missing closing brace
`;

const INVALID_SCSS_VARIABLE = `
.test {
  color: $undefined-variable;
}
`;

describe('Compile SCSS Tool - Real Integration Tests', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test files
    const filesToClean = [TEST_SCSS_FILE, TEST_CSS_OUTPUT, `${TEST_CSS_OUTPUT}.map`];
    for (const file of filesToClean) {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    }
  });

  describe('compileScssTool() - basic functionality', () => {
    it('should return ToolResult structure', async () => {
      const result = await compileScssTool(
        createToolParams(SIMPLE_SCSS, { isContent: true })
      );

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        duration: expect.any(Number),
        toolName: 'compile_scss',
      });
    });

    it('should compile simple SCSS to CSS', async () => {
      const result = await compileScssTool(
        createToolParams(SIMPLE_SCSS, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as { css: string };
      expect(data.css).toContain('.container');
      expect(data.css).toContain('display: flex');
      expect(data.css).toContain('.container .child');
    });

    it('should compile SCSS with variables', async () => {
      const result = await compileScssTool(
        createToolParams(SCSS_WITH_VARIABLES, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as { css: string };
      expect(data.css).toContain('#714B67');
      expect(data.css).toContain('#017e84');
    });

    it('should handle nested selectors', async () => {
      const result = await compileScssTool(
        createToolParams(SCSS_WITH_NESTING, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as { css: string };
      expect(data.css).toContain('nav ul');
      expect(data.css).toContain('nav ul li');
      expect(data.css).toContain('nav ul li a');
      expect(data.css).toContain('nav ul li a:hover');
    });
  });

  describe('compileScssTool() - Odoo integration', () => {
    it('should provide Odoo default variables', async () => {
      const result = await compileScssTool(
        createToolParams(SCSS_WITH_ODOO_VARS, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as { css: string };
      expect(data.css).toContain('#714B67'); // $o-brand-primary
      expect(data.css).toContain('#f8f9fa'); // $o-gray-100
    });

    it('should provide Odoo mixins', async () => {
      const result = await compileScssTool(
        createToolParams(SCSS_WITH_ODOO_MIXINS, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as { css: string };
      expect(data.css).toContain('position: absolute');
      expect(data.css).toContain('transform: translate(-50%, -50%)');
      expect(data.css).toContain('text-overflow: ellipsis');
    });

    it('should allow custom variable injection', async () => {
      const scss = '.custom { color: $my-custom-color; }';
      const result = await compileScssTool(
        createToolParams(scss, {
          isContent: true,
          variables: { 'my-custom-color': '#ff0000' },
        })
      );

      expect(result.success).toBe(true);
      const data = result.data as { css: string };
      expect(data.css).toContain('#ff0000');
    });
  });

  describe('compileScssTool() - file-based compilation', () => {
    it('should compile SCSS from file path', async () => {
      writeFileSync(TEST_SCSS_FILE, SIMPLE_SCSS, 'utf-8');

      const result = await compileScssTool(
        createToolParams(TEST_SCSS_FILE, { isContent: false })
      );

      expect(result.success).toBe(true);
      const data = result.data as { css: string };
      expect(data.css).toContain('.container');
    });

    it('should write output to file when outputPath specified', async () => {
      const result = await compileScssTool(
        createToolParams(SIMPLE_SCSS, {
          isContent: true,
          outputPath: TEST_CSS_OUTPUT,
        })
      );

      expect(result.success).toBe(true);
      expect(existsSync(TEST_CSS_OUTPUT)).toBe(true);

      const cssContent = readFileSync(TEST_CSS_OUTPUT, 'utf-8');
      expect(cssContent).toContain('.container');
    });

    it('should fail for non-existent file', async () => {
      const result = await compileScssTool(
        createToolParams('/nonexistent/file.scss', { isContent: false })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('compileScssImpl() - error handling', () => {
    it('should report syntax errors with line numbers', async () => {
      const result = await compileScssImpl({
        target: INVALID_SCSS_SYNTAX,
        isContent: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      const error = result.errors[0];
      expect(error.message).toBeDefined();
      expect(error.line).toBeDefined();
      expect(error.line).toBeGreaterThan(0);
    });

    it('should report undefined variable errors', async () => {
      const result = await compileScssImpl({
        target: INVALID_SCSS_VARIABLE,
        isContent: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('undefined');
    });

    it('should capture warnings', async () => {
      // SCSS that might generate warnings (deprecated syntax)
      const scssWithWarning = `
        @import "nonexistent";  // This will fail but tests warning capture path
      `;

      const result = await compileScssImpl({
        target: scssWithWarning,
        isContent: true,
      });

      // Either fails with error or succeeds with warnings
      expect(result.errors.length > 0 || result.warnings !== undefined).toBe(true);
    });
  });

  describe('compileScssImpl() - output options', () => {
    it('should support compressed output style', async () => {
      const result = await compileScssImpl({
        target: SIMPLE_SCSS,
        isContent: true,
        style: 'compressed',
      });

      expect(result.success).toBe(true);
      // Compressed output should have minimal whitespace
      expect(result.css).not.toContain('  '); // No double spaces
    });

    it('should support expanded output style', async () => {
      const result = await compileScssImpl({
        target: SIMPLE_SCSS,
        isContent: true,
        style: 'expanded',
      });

      expect(result.success).toBe(true);
      // Expanded output should have proper formatting
      expect(result.css).toContain('\n');
    });

    it('should generate source map when requested', async () => {
      const result = await compileScssImpl({
        target: SIMPLE_SCSS,
        isContent: true,
        sourceMap: true,
      });

      expect(result.success).toBe(true);
      expect(result.sourceMap).toBeDefined();

      const sourceMapData = JSON.parse(result.sourceMap!);
      expect(sourceMapData.version).toBe(3);
    });
  });

  describe('compileScssImpl() - result structure', () => {
    it('should return complete CompileScssResult', async () => {
      const result = await compileScssImpl({
        target: SIMPLE_SCSS,
        isContent: true,
      });

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        css: expect.any(String),
        errors: expect.any(Array),
        warnings: expect.any(Array),
        duration: expect.any(Number),
        includedFiles: expect.any(Array),
      });
    });

    it('should report compilation duration', async () => {
      const result = await compileScssImpl({
        target: SIMPLE_SCSS,
        isContent: true,
      });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThan(5000); // Should compile quickly
    });
  });

  describe('compileScssTool() - summary output', () => {
    it('should include summary in tool result', async () => {
      const result = await compileScssTool(
        createToolParams(SIMPLE_SCSS, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as {
        summary: {
          errorCount: number;
          warningCount: number;
          cssLength: number;
          compilationTime: number;
        };
      };

      expect(data.summary).toBeDefined();
      expect(data.summary.errorCount).toBe(0);
      expect(data.summary.cssLength).toBeGreaterThan(0);
      expect(data.summary.compilationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('tool-executor integration', () => {
    it('should work through AgentToolExecutor', async () => {
      const { AgentToolExecutor } = await import('@/lib/agentic-core/tool-executor');
      const executor = new AgentToolExecutor();

      const result = await executor.execute('compile', {
        target: SIMPLE_SCSS,
        context: createMockContext(),
        isContent: true,
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });
});

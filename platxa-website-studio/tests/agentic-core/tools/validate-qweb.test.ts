/**
 * Validate QWeb Tool Tests - REAL INTEGRATION TESTS
 * Verifies Feature #21: validate_qweb tool checking XML syntax, t-directive validity, and template references
 *
 * These are real integration tests that:
 * - Validate actual QWeb XML content
 * - Check t-directive validity (t-if, t-foreach, t-call, etc.)
 * - Verify template inheritance patterns
 *
 * Verification criteria:
 * - Validates t-if, t-foreach, t-call directives
 * - Checks template inheritance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';
import {
  validateQwebTool,
  validateQwebImpl,
  type ValidateQwebResult,
  type ValidationIssue,
} from '@/lib/agentic-core/tools/validate-qweb';
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
const TEST_FILE = resolve(TEST_DIR, 'test-qweb.xml');

// Sample QWeb templates
const VALID_QWEB_SIMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.test_template">
    <div class="container">
      <h1 t-esc="title"/>
      <p t-raw="content"/>
    </div>
  </t>
</templates>`;

const VALID_QWEB_WITH_CONDITIONALS = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.conditional_template">
    <div t-if="show_header" class="header">
      <span t-esc="header_text"/>
    </div>
    <div t-elif="show_subheader" class="subheader">
      <span t-esc="subheader_text"/>
    </div>
    <div t-else="" class="default">
      Default content
    </div>
  </t>
</templates>`;

const VALID_QWEB_WITH_FOREACH = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.list_template">
    <ul>
      <li t-foreach="items" t-as="item">
        <span t-esc="item.name"/>
      </li>
    </ul>
  </t>
</templates>`;

const VALID_QWEB_WITH_TCALL = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.parent_template">
    <div class="wrapper">
      <t t-call="website.child_template"/>
    </div>
  </t>
  <t t-name="website.child_template">
    <span>Child content</span>
  </t>
</templates>`;

const INVALID_QWEB_FOREACH_NO_AS = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.broken_foreach">
    <ul>
      <li t-foreach="items">
        <span t-esc="item.name"/>
      </li>
    </ul>
  </t>
</templates>`;

const INVALID_QWEB_ELIF_NO_IF = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.broken_elif">
    <div t-elif="condition">Content</div>
  </t>
</templates>`;

const INVALID_QWEB_ELSE_NO_IF = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.broken_else">
    <div t-else="">Default</div>
  </t>
</templates>`;

const INVALID_QWEB_EMPTY_DIRECTIVE = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.empty_directive">
    <div t-if="">Empty condition</div>
  </t>
</templates>`;

const INVALID_XML_UNCLOSED = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.unclosed">
    <div>
      <span>Unclosed
    </div>
  </t>
</templates>`;

const QWEB_WITH_UNKNOWN_DIRECTIVE = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.unknown_directive">
    <div t-unknown="value">Content</div>
  </t>
</templates>`;

const QWEB_WITH_ATTRIBUTES = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.dynamic_attrs">
    <a t-att-href="url" t-att-class="css_class">
      <img t-att-src="image_url" t-attf-alt="Image: #{name}"/>
    </a>
  </t>
</templates>`;

const QWEB_WITH_INHERIT = `<?xml version="1.0" encoding="UTF-8"?>
<templates>
  <t t-name="website.extended_template" t-inherit="website.base_template" t-inherit-mode="extension">
    <xpath expr="//div[@class='content']" position="inside">
      <p>Extended content</p>
    </xpath>
  </t>
</templates>`;

describe('Validate QWeb Tool - Real Integration Tests', () => {
  beforeEach(() => {
    // Create test directory
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test files
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
  });

  describe('validateQwebTool() - basic functionality', () => {
    it('should return ToolResult structure', async () => {
      const result = await validateQwebTool(
        createToolParams(VALID_QWEB_SIMPLE, { isContent: true })
      );

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        duration: expect.any(Number),
        toolName: 'validate_qweb',
      });
    });

    it('should validate simple QWeb template', async () => {
      const result = await validateQwebTool(
        createToolParams(VALID_QWEB_SIMPLE, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as ValidateQwebResult;
      expect(data.valid).toBe(true);
      expect(data.errors).toHaveLength(0);
    });

    it('should extract template IDs', async () => {
      const result = await validateQwebTool(
        createToolParams(VALID_QWEB_SIMPLE, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as ValidateQwebResult;
      expect(data.templateIds).toContain('website.test_template');
    });

    it('should track directives used', async () => {
      const result = await validateQwebTool(
        createToolParams(VALID_QWEB_SIMPLE, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as ValidateQwebResult;
      expect(data.directivesUsed).toContain('t-name');
      expect(data.directivesUsed).toContain('t-esc');
      expect(data.directivesUsed).toContain('t-raw');
    });
  });

  describe('validateQwebTool() - file-based validation', () => {
    it('should validate QWeb from file path', async () => {
      writeFileSync(TEST_FILE, VALID_QWEB_SIMPLE, 'utf-8');

      const result = await validateQwebTool(
        createToolParams(TEST_FILE, { isContent: false })
      );

      expect(result.success).toBe(true);
      const data = result.data as ValidateQwebResult;
      expect(data.valid).toBe(true);
    });

    it('should fail for non-existent file', async () => {
      const result = await validateQwebTool(
        createToolParams('/nonexistent/file.xml', { isContent: false })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('validateQwebImpl() - t-if/t-elif/t-else validation', () => {
    it('should validate proper conditional chain', async () => {
      const result = await validateQwebImpl({
        target: VALID_QWEB_WITH_CONDITIONALS,
        isContent: true,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.directivesUsed).toContain('t-if');
      expect(result.directivesUsed).toContain('t-elif');
      expect(result.directivesUsed).toContain('t-else');
    });

    it('should error on t-elif without preceding t-if', async () => {
      const result = await validateQwebImpl({
        target: INVALID_QWEB_ELIF_NO_IF,
        isContent: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('t-elif'))).toBe(true);
    });

    it('should error on t-else without preceding t-if', async () => {
      const result = await validateQwebImpl({
        target: INVALID_QWEB_ELSE_NO_IF,
        isContent: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('t-else'))).toBe(true);
    });

    it('should error on empty t-if value', async () => {
      const result = await validateQwebImpl({
        target: INVALID_QWEB_EMPTY_DIRECTIVE,
        isContent: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.directive === 't-if')).toBe(true);
    });
  });

  describe('validateQwebImpl() - t-foreach validation', () => {
    it('should validate t-foreach with t-as', async () => {
      const result = await validateQwebImpl({
        target: VALID_QWEB_WITH_FOREACH,
        isContent: true,
      });

      expect(result.valid).toBe(true);
      expect(result.directivesUsed).toContain('t-foreach');
      expect(result.directivesUsed).toContain('t-as');
    });

    it('should error on t-foreach without t-as', async () => {
      const result = await validateQwebImpl({
        target: INVALID_QWEB_FOREACH_NO_AS,
        isContent: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('t-as'))).toBe(true);
    });
  });

  describe('validateQwebImpl() - t-call validation', () => {
    it('should extract template references from t-call', async () => {
      const result = await validateQwebImpl({
        target: VALID_QWEB_WITH_TCALL,
        isContent: true,
      });

      expect(result.valid).toBe(true);
      expect(result.templateRefs).toContain('website.child_template');
    });

    it('should validate t-call with known templates', async () => {
      const result = await validateQwebImpl({
        target: VALID_QWEB_WITH_TCALL,
        isContent: true,
        knownTemplates: ['website.child_template'],
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('validateQwebImpl() - t-att attribute directives', () => {
    it('should validate t-att-* directives', async () => {
      const result = await validateQwebImpl({
        target: QWEB_WITH_ATTRIBUTES,
        isContent: true,
      });

      expect(result.valid).toBe(true);
      expect(result.directivesUsed.some(d => d.startsWith('t-att'))).toBe(true);
    });
  });

  describe('validateQwebImpl() - template inheritance', () => {
    it('should extract t-inherit references', async () => {
      const result = await validateQwebImpl({
        target: QWEB_WITH_INHERIT,
        isContent: true,
      });

      expect(result.valid).toBe(true);
      expect(result.templateRefs).toContain('website.base_template');
      expect(result.directivesUsed).toContain('t-inherit');
    });
  });

  describe('validateQwebImpl() - XML syntax validation', () => {
    it('should error on unclosed tags', async () => {
      const result = await validateQwebImpl({
        target: INVALID_XML_UNCLOSED,
        isContent: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e =>
        e.message.includes('Unclosed') || e.message.includes('Unexpected')
      )).toBe(true);
    });

    it('should error on empty content', async () => {
      const result = await validateQwebImpl({
        target: '',
        isContent: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Empty'))).toBe(true);
    });
  });

  describe('validateQwebImpl() - warnings vs errors', () => {
    it('should warn on unknown directives', async () => {
      const result = await validateQwebImpl({
        target: QWEB_WITH_UNKNOWN_DIRECTIVE,
        isContent: true,
      });

      expect(result.valid).toBe(true); // Warnings don't make it invalid
      expect(result.warnings.some(w => w.message.includes('Unknown directive'))).toBe(true);
    });

    it('should convert warnings to errors in strict mode', async () => {
      const result = await validateQwebImpl({
        target: QWEB_WITH_UNKNOWN_DIRECTIVE,
        isContent: true,
        strict: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unknown directive'))).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('validateQwebImpl() - result structure', () => {
    it('should return complete ValidateQwebResult', async () => {
      const result = await validateQwebImpl({
        target: VALID_QWEB_WITH_TCALL,
        isContent: true,
      });

      expect(result).toMatchObject({
        valid: expect.any(Boolean),
        errors: expect.any(Array),
        warnings: expect.any(Array),
        templateIds: expect.any(Array),
        templateRefs: expect.any(Array),
        directivesUsed: expect.any(Array),
      });
    });

    it('should include line numbers in validation issues', async () => {
      const result = await validateQwebImpl({
        target: INVALID_QWEB_FOREACH_NO_AS,
        isContent: true,
      });

      expect(result.errors.length).toBeGreaterThan(0);
      const errorWithLine = result.errors.find(e => e.line !== undefined);
      expect(errorWithLine).toBeDefined();
      expect(errorWithLine!.line).toBeGreaterThan(0);
    });
  });

  describe('validateQwebTool() - summary output', () => {
    it('should include summary in tool result', async () => {
      const result = await validateQwebTool(
        createToolParams(VALID_QWEB_WITH_TCALL, { isContent: true })
      );

      expect(result.success).toBe(true);
      const data = result.data as { summary: { errorCount: number; warningCount: number; templateCount: number } };
      expect(data.summary).toBeDefined();
      expect(data.summary.errorCount).toBe(0);
      expect(data.summary.templateCount).toBe(2);
    });
  });

  describe('tool-executor integration', () => {
    it('should work through AgentToolExecutor', async () => {
      const { AgentToolExecutor } = await import('@/lib/agentic-core/tool-executor');
      const executor = new AgentToolExecutor();

      // Write test file
      writeFileSync(TEST_FILE, VALID_QWEB_SIMPLE, 'utf-8');

      const step = {
        id: 'step-1',
        action: 'validate' as const,
        target: TEST_FILE,
        rationale: 'Validate QWeb template',
        status: 'pending' as const,
      };

      const result = await executor.executeStep(step, createMockContext());

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('validate_qweb');
    });
  });
});

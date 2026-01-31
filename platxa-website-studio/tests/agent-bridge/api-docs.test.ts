import { describe, it, expect } from 'vitest';
import {
  ALL_TOOL_DOCS,
  getToolDoc,
  getToolsByCategory,
  getToolsByModule,
  searchTools,
  getCategories,
  getModules,
  formatToolAsMarkdown,
  formatAllDocsAsMarkdown,
  formatToolAsJsonSchema,
  computeDocsSummary,
  colorMapperDocs,
  colorHarmonyDocs,
  pipelineDocs,
  accessibilityDocs,
  odooDocs,
  editorDocs,
  streamingDocs,
  telemetryDocs,
  type ToolDoc,
  type ToolCategory,
} from '@/lib/agent-bridge/api-docs';

describe('API Documentation', () => {
  // ===========================================================================
  // Verification Test: Each tool documented with purpose, parameters, return, examples
  // ===========================================================================

  describe('Verification: Complete Documentation', () => {
    it('each tool has purpose', () => {
      for (const doc of ALL_TOOL_DOCS) {
        expect(doc.purpose, `${doc.name} missing purpose`).toBeTruthy();
        expect(doc.purpose.length, `${doc.name} purpose too short`).toBeGreaterThan(10);
      }
    });

    it('each tool has parameters array', () => {
      for (const doc of ALL_TOOL_DOCS) {
        expect(Array.isArray(doc.parameters), `${doc.name} parameters not array`).toBe(true);
      }
    });

    it('each parameter has name, type, description', () => {
      for (const doc of ALL_TOOL_DOCS) {
        for (const param of doc.parameters) {
          expect(param.name, `${doc.name} param missing name`).toBeTruthy();
          expect(param.type, `${doc.name}.${param.name} missing type`).toBeTruthy();
          expect(param.description, `${doc.name}.${param.name} missing description`).toBeTruthy();
        }
      }
    });

    it('each tool has return value', () => {
      for (const doc of ALL_TOOL_DOCS) {
        expect(doc.returns, `${doc.name} missing returns`).toBeTruthy();
        expect(doc.returns.type, `${doc.name} returns missing type`).toBeTruthy();
        expect(doc.returns.description, `${doc.name} returns missing description`).toBeTruthy();
      }
    });

    it('each tool has at least one example', () => {
      for (const doc of ALL_TOOL_DOCS) {
        expect(doc.examples.length, `${doc.name} has no examples`).toBeGreaterThan(0);
      }
    });

    it('each example has title and code', () => {
      for (const doc of ALL_TOOL_DOCS) {
        for (const example of doc.examples) {
          expect(example.title, `${doc.name} example missing title`).toBeTruthy();
          expect(example.code, `${doc.name} example missing code`).toBeTruthy();
        }
      }
    });
  });

  // ===========================================================================
  // Documentation Coverage
  // ===========================================================================

  describe('Documentation Coverage', () => {
    it('has documentation for color tools', () => {
      expect(colorMapperDocs.length).toBeGreaterThan(0);
      expect(colorHarmonyDocs.length).toBeGreaterThan(0);
    });

    it('has documentation for pipeline tools', () => {
      expect(pipelineDocs.length).toBeGreaterThan(0);
    });

    it('has documentation for accessibility tools', () => {
      expect(accessibilityDocs.length).toBeGreaterThan(0);
    });

    it('has documentation for Odoo tools', () => {
      expect(odooDocs.length).toBeGreaterThan(0);
    });

    it('has documentation for editor tools', () => {
      expect(editorDocs.length).toBeGreaterThan(0);
    });

    it('has documentation for streaming tools', () => {
      expect(streamingDocs.length).toBeGreaterThan(0);
    });

    it('has documentation for telemetry tools', () => {
      expect(telemetryDocs.length).toBeGreaterThan(0);
    });

    it('has at least 50 documented tools', () => {
      expect(ALL_TOOL_DOCS.length).toBeGreaterThanOrEqual(50);
    });
  });

  // ===========================================================================
  // Query Functions
  // ===========================================================================

  describe('getToolDoc', () => {
    it('finds tool by name', () => {
      const doc = getToolDoc('hexToOklch');
      expect(doc).toBeDefined();
      expect(doc?.name).toBe('hexToOklch');
    });

    it('returns undefined for unknown tool', () => {
      const doc = getToolDoc('nonexistentTool');
      expect(doc).toBeUndefined();
    });
  });

  describe('getToolsByCategory', () => {
    it('returns tools for color category', () => {
      const tools = getToolsByCategory('color');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every((t) => t.category === 'color')).toBe(true);
    });

    it('returns tools for pipeline category', () => {
      const tools = getToolsByCategory('pipeline');
      expect(tools.length).toBeGreaterThan(0);
    });

    it('returns empty array for invalid category', () => {
      const tools = getToolsByCategory('nonexistent' as ToolCategory);
      expect(tools).toHaveLength(0);
    });
  });

  describe('getToolsByModule', () => {
    it('returns tools for color-mapper module', () => {
      const tools = getToolsByModule('color-mapper');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every((t) => t.module === 'color-mapper')).toBe(true);
    });

    it('returns empty array for unknown module', () => {
      const tools = getToolsByModule('unknown-module');
      expect(tools).toHaveLength(0);
    });
  });

  describe('searchTools', () => {
    it('searches by name', () => {
      const results = searchTools('hex');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((t) => t.name.toLowerCase().includes('hex'))).toBe(true);
    });

    it('searches by purpose', () => {
      const results = searchTools('contrast');
      expect(results.length).toBeGreaterThan(0);
    });

    it('is case insensitive', () => {
      const lower = searchTools('color');
      const upper = searchTools('COLOR');
      expect(lower.length).toBe(upper.length);
    });

    it('returns empty for no matches', () => {
      const results = searchTools('xyznonexistent123');
      expect(results).toHaveLength(0);
    });
  });

  describe('getCategories', () => {
    it('returns unique categories', () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(new Set(categories).size).toBe(categories.length);
    });

    it('includes expected categories', () => {
      const categories = getCategories();
      expect(categories).toContain('color');
      expect(categories).toContain('pipeline');
      expect(categories).toContain('validation');
    });
  });

  describe('getModules', () => {
    it('returns unique modules', () => {
      const modules = getModules();
      expect(modules.length).toBeGreaterThan(0);
      expect(new Set(modules).size).toBe(modules.length);
    });

    it('includes expected modules', () => {
      const modules = getModules();
      expect(modules).toContain('color-mapper');
      expect(modules).toContain('pre-generation');
    });
  });

  // ===========================================================================
  // Formatting Functions
  // ===========================================================================

  describe('formatToolAsMarkdown', () => {
    it('includes tool name as heading', () => {
      const doc = getToolDoc('hexToOklch')!;
      const md = formatToolAsMarkdown(doc);
      expect(md).toContain('## hexToOklch');
    });

    it('includes module and category', () => {
      const doc = getToolDoc('hexToOklch')!;
      const md = formatToolAsMarkdown(doc);
      expect(md).toContain('color-mapper');
      expect(md).toContain('color');
    });

    it('includes purpose section', () => {
      const doc = getToolDoc('hexToOklch')!;
      const md = formatToolAsMarkdown(doc);
      expect(md).toContain('### Purpose');
      expect(md).toContain(doc.purpose);
    });

    it('includes parameters table', () => {
      const doc = getToolDoc('hexToOklch')!;
      const md = formatToolAsMarkdown(doc);
      expect(md).toContain('### Parameters');
      expect(md).toContain('| Name | Type | Description |');
    });

    it('includes returns section', () => {
      const doc = getToolDoc('hexToOklch')!;
      const md = formatToolAsMarkdown(doc);
      expect(md).toContain('### Returns');
      expect(md).toContain('OklchColor');
    });

    it('includes examples with code blocks', () => {
      const doc = getToolDoc('hexToOklch')!;
      const md = formatToolAsMarkdown(doc);
      expect(md).toContain('### Examples');
      expect(md).toContain('```typescript');
    });

    it('includes related tools if present', () => {
      const doc = getToolDoc('hexToOklch')!;
      const md = formatToolAsMarkdown(doc);
      expect(md).toContain('### Related Tools');
      expect(md).toContain('oklchToHex');
    });
  });

  describe('formatAllDocsAsMarkdown', () => {
    it('includes title', () => {
      const md = formatAllDocsAsMarkdown();
      expect(md).toContain('# Agent Bridge API Documentation');
    });

    it('includes table of contents', () => {
      const md = formatAllDocsAsMarkdown();
      expect(md).toContain('## Table of Contents');
    });

    it('includes all documented tools', () => {
      const md = formatAllDocsAsMarkdown();
      for (const doc of ALL_TOOL_DOCS) {
        expect(md).toContain(`## ${doc.name}`);
      }
    });

    it('generates substantial documentation', () => {
      const md = formatAllDocsAsMarkdown();
      // Should be at least 10KB of documentation
      expect(md.length).toBeGreaterThan(10000);
    });
  });

  describe('formatToolAsJsonSchema', () => {
    it('includes name and description', () => {
      const doc = getToolDoc('hexToOklch')!;
      const schema = formatToolAsJsonSchema(doc);
      expect(schema).toHaveProperty('name', 'hexToOklch');
      expect(schema).toHaveProperty('description');
    });

    it('includes parameters object', () => {
      const doc = getToolDoc('hexToOklch')!;
      const schema = formatToolAsJsonSchema(doc) as any;
      expect(schema.parameters).toHaveProperty('type', 'object');
      expect(schema.parameters).toHaveProperty('properties');
    });

    it('marks required parameters', () => {
      const doc = getToolDoc('hexToOklch')!;
      const schema = formatToolAsJsonSchema(doc) as any;
      expect(schema.parameters.required).toContain('hex');
    });

    it('handles optional parameters', () => {
      const doc = getToolDoc('generateLightnessScale')!;
      const schema = formatToolAsJsonSchema(doc) as any;
      // steps is optional, should not be in required
      expect(schema.parameters.required).not.toContain('steps');
    });

    it('infers JSON types from TypeScript types', () => {
      const doc = getToolDoc('hexToOklch')!;
      const schema = formatToolAsJsonSchema(doc) as any;
      expect(schema.parameters.properties.hex.type).toBe('string');
    });
  });

  // ===========================================================================
  // Summary Statistics
  // ===========================================================================

  describe('computeDocsSummary', () => {
    it('returns total tools count', () => {
      const summary = computeDocsSummary();
      expect(summary.totalTools).toBe(ALL_TOOL_DOCS.length);
    });

    it('returns count by category', () => {
      const summary = computeDocsSummary();
      expect(summary.byCategory).toHaveProperty('color');
      expect(summary.byCategory.color).toBeGreaterThan(0);
    });

    it('returns count by module', () => {
      const summary = computeDocsSummary();
      expect(summary.byModule).toHaveProperty('color-mapper');
      expect(summary.byModule['color-mapper']).toBeGreaterThan(0);
    });

    it('returns total examples count', () => {
      const summary = computeDocsSummary();
      expect(summary.totalExamples).toBeGreaterThan(0);
      // Should have at least as many examples as tools
      expect(summary.totalExamples).toBeGreaterThanOrEqual(summary.totalTools);
    });

    it('category counts sum to total', () => {
      const summary = computeDocsSummary();
      const categorySum = Object.values(summary.byCategory).reduce((a, b) => a + b, 0);
      expect(categorySum).toBe(summary.totalTools);
    });

    it('module counts sum to total', () => {
      const summary = computeDocsSummary();
      const moduleSum = Object.values(summary.byModule).reduce((a, b) => a + b, 0);
      expect(moduleSum).toBe(summary.totalTools);
    });
  });

  // ===========================================================================
  // Documentation Quality
  // ===========================================================================

  describe('Documentation Quality', () => {
    it('tool names are unique', () => {
      const names = ALL_TOOL_DOCS.map((d) => d.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('no empty purposes', () => {
      const empty = ALL_TOOL_DOCS.filter((d) => !d.purpose || d.purpose.trim() === '');
      expect(empty).toHaveLength(0);
    });

    it('no empty return descriptions', () => {
      const empty = ALL_TOOL_DOCS.filter(
        (d) => !d.returns.description || d.returns.description.trim() === '',
      );
      expect(empty).toHaveLength(0);
    });

    it('examples contain actual code', () => {
      for (const doc of ALL_TOOL_DOCS) {
        for (const example of doc.examples) {
          // Code should contain function call or assignment
          expect(
            example.code.includes('(') || example.code.includes('='),
            `${doc.name} example has no code: ${example.code}`,
          ).toBe(true);
        }
      }
    });

    it('parameter types are valid TypeScript', () => {
      // Basic check - types should not be empty
      for (const doc of ALL_TOOL_DOCS) {
        for (const param of doc.parameters) {
          expect(param.type.length).toBeGreaterThan(0);
        }
      }
    });

    it('related tools reference existing tools', () => {
      const allNames = new Set(ALL_TOOL_DOCS.map((d) => d.name));
      for (const doc of ALL_TOOL_DOCS) {
        if (doc.relatedTools) {
          for (const related of doc.relatedTools) {
            // Related tools should exist (or be constants like DEFAULT_*)
            const exists = allNames.has(related) || related.startsWith('DEFAULT_');
            expect(exists, `${doc.name} references unknown tool: ${related}`).toBe(true);
          }
        }
      }
    });
  });

  // ===========================================================================
  // Specific Tool Documentation Tests
  // ===========================================================================

  describe('Color Mapper Documentation', () => {
    it('hexToOklch is fully documented', () => {
      const doc = getToolDoc('hexToOklch');
      expect(doc).toBeDefined();
      expect(doc?.parameters).toHaveLength(1);
      expect(doc?.parameters[0].name).toBe('hex');
      expect(doc?.returns.type).toBe('OklchColor');
    });

    it('meetsContrastAA is documented', () => {
      const doc = getToolDoc('meetsContrastAA');
      expect(doc).toBeDefined();
      expect(doc?.parameters).toHaveLength(2);
      expect(doc?.returns.type).toBe('boolean');
    });
  });

  describe('Pipeline Documentation', () => {
    it('runPreGeneration is documented', () => {
      const doc = getToolDoc('runPreGeneration');
      expect(doc).toBeDefined();
      expect(doc?.category).toBe('pipeline');
    });

    it('runPostGeneration is documented', () => {
      const doc = getToolDoc('runPostGeneration');
      expect(doc).toBeDefined();
    });

    it('AgentPipeline is documented', () => {
      const doc = getToolDoc('AgentPipeline');
      expect(doc).toBeDefined();
    });
  });

  describe('Odoo Documentation', () => {
    it('deployToOdoo is documented', () => {
      const doc = getToolDoc('deployToOdoo');
      expect(doc).toBeDefined();
      expect(doc?.category).toBe('odoo');
    });

    it('packageOdooModule is documented', () => {
      const doc = getToolDoc('packageOdooModule');
      expect(doc).toBeDefined();
    });

    it('validateSubmission is documented', () => {
      const doc = getToolDoc('validateSubmission');
      expect(doc).toBeDefined();
    });
  });

  describe('Editor Documentation', () => {
    it('createTimeline is documented', () => {
      const doc = getToolDoc('createTimeline');
      expect(doc).toBeDefined();
      expect(doc?.category).toBe('editor');
    });

    it('undo is documented', () => {
      const doc = getToolDoc('undo');
      expect(doc).toBeDefined();
    });
  });

  describe('Telemetry Documentation', () => {
    it('createTelemetryState is documented', () => {
      const doc = getToolDoc('createTelemetryState');
      expect(doc).toBeDefined();
      expect(doc?.category).toBe('telemetry');
    });

    it('computeMetrics is documented', () => {
      const doc = getToolDoc('computeMetrics');
      expect(doc).toBeDefined();
    });
  });
});

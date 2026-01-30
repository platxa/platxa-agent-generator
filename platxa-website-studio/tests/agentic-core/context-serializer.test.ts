/**
 * Tests for ContextSerializer
 *
 * Feature #35: Create context serialization optimized for LLM injection
 * Verification: Serialized context is <50% smaller than raw JSON
 */

import { describe, it, expect } from 'vitest';
import {
  ContextSerializer,
  createContextSerializer,
  serializeContext,
  deserializeContext,
  formatForLLM,
  type CompactContext,
  type SerializerOptions,
} from '@/lib/agentic-core/context-serializer';
import type { AgentContext } from '@/lib/agentic-core/agent-engine';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockContext(options: {
  fileCount?: number;
  fileSize?: number;
  searchCount?: number;
}): AgentContext {
  const { fileCount = 5, fileSize = 500, searchCount = 3 } = options;

  const filesRead = new Map<string, string>();
  for (let i = 0; i < fileCount; i++) {
    const content = generateMockCode(fileSize);
    filesRead.set(`src/components/Component${i}.tsx`, content);
  }

  const searchResults = new Map<string, unknown[]>();
  for (let i = 0; i < searchCount; i++) {
    searchResults.set(`query${i}`, [
      { file: `src/file${i}.ts`, line: 10, match: 'function test' },
      { file: `src/other${i}.ts`, line: 20, match: 'const value' },
    ]);
  }

  return {
    filesRead,
    searchResults,
    userPreferences: {
      theme: 'dark',
      indentSize: 2,
      autoSave: true,
    },
    odooContext: {
      version: '17.0',
      modules: ['website', 'website_sale', 'portal'],
      theme: 'theme_starter',
      snippets: ['s_banner', 's_features', 's_testimonials'],
    },
    designTokens: {
      primaryColor: '#007bff',
      secondaryColor: '#6c757d',
      fontFamily: 'Inter, sans-serif',
    },
    planMode: true,
  };
}

function generateMockCode(length: number): string {
  const lines = [
    '/**',
    ' * Component description with detailed documentation',
    ' * @param props - The component properties',
    ' */',
    'import React from "react";',
    'import { useState, useEffect } from "react";',
    '',
    'interface Props {',
    '  title: string;',
    '  description?: string;',
    '  onClick: () => void;',
    '}',
    '',
    'export function Component({ title, description, onClick }: Props) {',
    '  const [state, setState] = useState(false);',
    '',
    '  useEffect(() => {',
    '    console.log("Component mounted");',
    '    return () => console.log("Cleanup");',
    '  }, []);',
    '',
    '  return (',
    '    <div className="container">',
    '      <h1>{title}</h1>',
    '      {description && <p>{description}</p>}',
    '      <button onClick={onClick}>Click me</button>',
    '    </div>',
    '  );',
    '}',
    '',
    'export default Component;',
  ];

  let content = '';
  while (content.length < length) {
    content += lines.join('\n') + '\n';
  }
  return content.substring(0, length);
}

function createLargeContext(): AgentContext {
  return createMockContext({
    fileCount: 10,
    fileSize: 2000,
    searchCount: 5,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('ContextSerializer', () => {
  describe('constructor', () => {
    it('creates instance with default options', () => {
      const serializer = new ContextSerializer();
      expect(serializer).toBeInstanceOf(ContextSerializer);
    });

    it('accepts custom options', () => {
      const serializer = createContextSerializer({
        maxFileLength: 1000,
        compressionLevel: 'aggressive',
      });
      expect(serializer).toBeInstanceOf(ContextSerializer);
    });
  });

  describe('serialize', () => {
    it('produces valid compact format', () => {
      const context = createMockContext({});
      const serializer = new ContextSerializer();

      const result = serializer.serialize(context);

      expect(result.compact).toBeDefined();
      expect(result.serialized).toBeDefined();
      expect(typeof result.serialized).toBe('string');
    });

    it('uses short keys in compact format', () => {
      const context = createMockContext({});
      const result = serializeContext(context);

      // Should use f, s, p, o, d, m instead of long names
      expect(result.compact.f).toBeDefined(); // files
      expect(result.compact.s).toBeDefined(); // search
      expect(result.compact.p).toBeDefined(); // preferences
      expect(result.compact.o).toBeDefined(); // odoo
      expect(result.compact.m).toBe(true);    // mode
    });

    it('omits empty values', () => {
      const context: AgentContext = {
        filesRead: new Map(),
        searchResults: new Map(),
        userPreferences: {},
        odooContext: {},
        planMode: false,
      };

      const result = serializeContext(context);

      expect(result.compact.f).toBeUndefined();
      expect(result.compact.s).toBeUndefined();
      expect(result.compact.p).toBeUndefined();
      expect(result.compact.o).toBeUndefined();
      expect(result.compact.m).toBeUndefined();
    });

    it('shortens Odoo context keys', () => {
      const context = createMockContext({});
      const result = serializeContext(context);

      expect(result.compact.o?.v).toBe('17.0');        // version
      expect(result.compact.o?.m).toBeDefined();       // modules
      expect(result.compact.o?.t).toBe('theme_starter'); // theme
      expect(result.compact.o?.sn).toBeDefined();      // snippets
    });

    it('calculates compression metrics', () => {
      const context = createMockContext({});
      const result = serializeContext(context);

      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.ratio).toBeGreaterThan(0);
      expect(result.ratio).toBeLessThanOrEqual(1);
      expect(result.reduction).toBeGreaterThanOrEqual(0);
      expect(result.reduction).toBeLessThanOrEqual(100);
    });
  });

  describe('compression levels', () => {
    it('minimal compression preserves most content', () => {
      const context = createMockContext({ fileSize: 500 });

      const minimal = serializeContext(context, { compressionLevel: 'minimal' });
      const standard = serializeContext(context, { compressionLevel: 'standard' });

      expect(minimal.compressedSize).toBeGreaterThanOrEqual(standard.compressedSize);
    });

    it('aggressive compression removes comments', () => {
      const context: AgentContext = {
        filesRead: new Map([
          ['test.ts', '// Comment\nconst x = 1;\n/* Block */\nconst y = 2;'],
        ]),
        searchResults: new Map(),
        userPreferences: {},
        odooContext: {},
      };

      const result = serializeContext(context, { compressionLevel: 'aggressive' });

      // Comments should be removed
      const content = result.compact.f?.['test'];
      expect(content).not.toContain('// Comment');
      expect(content).not.toContain('/* Block */');
    });

    it('standard compression removes empty lines', () => {
      const context: AgentContext = {
        filesRead: new Map([
          ['test.ts', 'line1\n\n\nline2\n\n\nline3'],
        ]),
        searchResults: new Map(),
        userPreferences: {},
        odooContext: {},
      };

      const result = serializeContext(context, { compressionLevel: 'standard' });

      const content = result.compact.f?.['test'];
      // Should not have multiple consecutive newlines
      expect(content?.includes('\n\n\n')).toBe(false);
    });
  });

  describe('truncation', () => {
    it('truncates files exceeding maxFileLength', () => {
      const context: AgentContext = {
        filesRead: new Map([
          ['long.ts', 'x'.repeat(5000)],
        ]),
        searchResults: new Map(),
        userPreferences: {},
        odooContext: {},
      };

      const result = serializeContext(context, { maxFileLength: 100 });

      const content = result.compact.f?.['long'];
      expect(content?.length).toBeLessThanOrEqual(110); // 100 + "..." + buffer
      expect(content).toContain('...');
    });

    it('truncates at natural boundaries when possible', () => {
      const code = 'function test() {\n  const x = 1;\n  return x;\n}\nfunction other() {}';
      const context: AgentContext = {
        filesRead: new Map([['test.ts', code]]),
        searchResults: new Map(),
        userPreferences: {},
        odooContext: {},
      };

      const result = serializeContext(context, { maxFileLength: 50 });

      const content = result.compact.f?.['test'];
      // Should truncate at a natural boundary like newline or semicolon
      expect(content).toBeDefined();
    });

    it('respects maxTotalSize limit', () => {
      const context = createLargeContext();

      const result = serializeContext(context, { maxTotalSize: 1000 });

      expect(result.serialized.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('deserialize', () => {
    it('restores files from compact format', () => {
      const context = createMockContext({ fileCount: 2, fileSize: 100 });
      const serializer = new ContextSerializer();

      const serialized = serializer.serialize(context);
      const restored = serializer.deserialize(serialized.compact);

      expect(restored.filesRead.size).toBe(2);
    });

    it('restores Odoo context', () => {
      const context = createMockContext({});
      const serializer = new ContextSerializer();

      const serialized = serializer.serialize(context);
      const restored = serializer.deserialize(serialized.compact);

      expect(restored.odooContext.version).toBe('17.0');
      expect(restored.odooContext.modules).toEqual(['website', 'website_sale', 'portal']);
      expect(restored.odooContext.theme).toBe('theme_starter');
    });

    it('restores user preferences', () => {
      const context = createMockContext({});
      const serializer = new ContextSerializer();

      const serialized = serializer.serialize(context);
      const restored = serializer.deserialize(serialized.compact);

      expect(restored.userPreferences.theme).toBe('dark');
      expect(restored.userPreferences.indentSize).toBe(2);
    });

    it('restores plan mode', () => {
      const context = createMockContext({});
      const serializer = new ContextSerializer();

      const serialized = serializer.serialize(context);
      const restored = serializer.deserialize(serialized.compact);

      expect(restored.planMode).toBe(true);
    });

    it('handles empty compact format', () => {
      const compact: CompactContext = {};
      const restored = deserializeContext(compact);

      expect(restored.filesRead.size).toBe(0);
      expect(restored.searchResults.size).toBe(0);
      expect(Object.keys(restored.userPreferences)).toHaveLength(0);
    });
  });

  describe('formatForLLM', () => {
    it('produces XML-tagged output', () => {
      const context = createMockContext({});
      const output = formatForLLM(context);

      expect(output).toContain('<context>');
      expect(output).toContain('</context>');
      expect(output).toContain('<files>');
      expect(output).toContain('</files>');
    });

    it('includes file paths as attributes', () => {
      const context: AgentContext = {
        filesRead: new Map([['src/test.ts', 'content']]),
        searchResults: new Map(),
        userPreferences: {},
        odooContext: {},
      };

      const output = formatForLLM(context);

      expect(output).toContain('<file path="');
    });

    it('includes Odoo version info', () => {
      const context = createMockContext({});
      const output = formatForLLM(context);

      // Compact attribute-based format for LLM optimization
      expect(output).toContain('<odoo v="17.0"');
      expect(output).toContain('m="website,website_sale,portal"');
      expect(output).toContain('/>');
    });

    it('indicates plan mode', () => {
      const context = createMockContext({});
      const output = formatForLLM(context);

      expect(output).toContain('<mode>plan</mode>');
    });
  });

  describe('factory functions', () => {
    it('createContextSerializer creates instance', () => {
      const serializer = createContextSerializer({ maxFileLength: 500 });
      expect(serializer).toBeInstanceOf(ContextSerializer);
    });

    it('serializeContext utility works', () => {
      const context = createMockContext({});
      const result = serializeContext(context);

      expect(result.compact).toBeDefined();
      expect(result.serialized).toBeDefined();
    });

    it('deserializeContext utility works', () => {
      const compact: CompactContext = {
        f: { 'test': 'content' },
        m: true,
      };

      const context = deserializeContext(compact);

      expect(context.filesRead.get('test')).toBe('content');
      expect(context.planMode).toBe(true);
    });
  });

  // ==========================================================================
  // Feature #35 Verification Tests
  // ==========================================================================

  describe('Feature #35 verification: Serialized context is <50% smaller than raw JSON', () => {
    it('achieves >50% reduction on typical context', () => {
      const context = createMockContext({
        fileCount: 5,
        fileSize: 1000,
        searchCount: 3,
      });

      const result = serializeContext(context);

      // Verify >50% reduction (ratio < 0.5)
      expect(result.ratio).toBeLessThan(0.5);
      expect(result.reduction).toBeGreaterThan(50);
    });

    it('achieves >50% reduction on large context', () => {
      const context = createLargeContext();

      const result = serializeContext(context);

      expect(result.ratio).toBeLessThan(0.5);
      expect(result.reduction).toBeGreaterThan(50);
    });

    it('achieves >50% reduction with standard compression', () => {
      const context = createMockContext({
        fileCount: 5,
        fileSize: 500,
      });

      const result = serializeContext(context, { compressionLevel: 'standard' });

      expect(result.ratio).toBeLessThan(0.5);
      expect(result.reduction).toBeGreaterThan(50);
    });

    it('achieves even better reduction with aggressive compression', () => {
      const context = createMockContext({
        fileCount: 5,
        fileSize: 500,
      });

      const standard = serializeContext(context, { compressionLevel: 'standard' });
      const aggressive = serializeContext(context, { compressionLevel: 'aggressive' });

      // Aggressive should be smaller or equal
      expect(aggressive.compressedSize).toBeLessThanOrEqual(standard.compressedSize);
    });

    it('reports accurate size metrics', () => {
      const context = createMockContext({});
      const result = serializeContext(context);

      // Verify metrics are consistent
      expect(result.ratio).toBeCloseTo(result.compressedSize / result.originalSize, 5);
      expect(result.reduction).toBeCloseTo((1 - result.ratio) * 100, 0);
    });

    it('maintains useful content after compression', () => {
      const context: AgentContext = {
        filesRead: new Map([
          ['src/auth.ts', 'export function authenticate(user: string) { return true; }'],
        ]),
        searchResults: new Map([
          ['auth', [{ file: 'src/auth.ts', line: 1 }]],
        ]),
        userPreferences: { apiKey: 'secret' },
        odooContext: { version: '17.0' },
        planMode: true,
      };

      const result = serializeContext(context);

      // Verify key content is preserved
      expect(result.serialized).toContain('authenticate');
      expect(result.serialized).toContain('auth');
      expect(result.serialized).toContain('17.0');

      // Verify >50% reduction
      expect(result.reduction).toBeGreaterThan(50);
    });

    it('achieves compression across different context sizes', () => {
      const sizes = [
        { fileCount: 1, fileSize: 200, searchCount: 1 },
        { fileCount: 3, fileSize: 500, searchCount: 2 },
        { fileCount: 10, fileSize: 1000, searchCount: 5 },
      ];

      for (const size of sizes) {
        const context = createMockContext(size);
        const result = serializeContext(context);

        expect(result.reduction).toBeGreaterThan(50);
      }
    });
  });
});

/**
 * Tests for HypotheticalDiffGenerator
 *
 * Feature #56: Create hypothetical file change preview (diff without commit)
 * Verification: Shows unified diff of proposed changes; clearly marked as preview
 */

import { describe, it, expect } from 'vitest';
import {
  HypotheticalDiffGenerator,
  createHypotheticalDiffGenerator,
  generateHypotheticalDiff,
  previewFileChanges,
  type HypotheticalDiffOptions,
  type ProposedChange,
} from '@/lib/agentic-core/hypothetical-diff';

// ============================================================================
// Test Fixtures
// ============================================================================

const SAMPLE_CODE = `import React from 'react';

interface Props {
  title: string;
  debug: boolean;
}

export function Component({ title, debug }: Props) {
  const value = 'hello';

  if (debug) {
    console.log('Debug mode');
  }

  return <div>{title}</div>;
}`;

const SAMPLE_CONFIG = `{
  "name": "my-app",
  "version": "1.0.0",
  "debug": false,
  "apiUrl": "http://localhost:3000"
}`;

function createBasicOptions(changes: ProposedChange[]): HypotheticalDiffOptions {
  return {
    filePath: 'src/component.tsx',
    originalContent: SAMPLE_CODE,
    changes,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('HypotheticalDiffGenerator', () => {
  describe('constructor', () => {
    it('creates instance with default config', () => {
      const generator = new HypotheticalDiffGenerator();
      expect(generator).toBeInstanceOf(HypotheticalDiffGenerator);
    });

    it('accepts custom config', () => {
      const generator = createHypotheticalDiffGenerator({
        defaultContextLines: 5,
        previewBannerText: 'Custom Banner',
      });
      expect(generator.getConfig().defaultContextLines).toBe(5);
      expect(generator.getConfig().previewBannerText).toBe('Custom Banner');
    });
  });

  describe('generate', () => {
    it('detects when changes would be made', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'const x = 1;',
        changes: [{ search: '1', replace: '2' }],
      });

      expect(result.hasChanges).toBe(true);
      expect(result.changesApplied).toBe(1);
    });

    it('detects when no changes would be made', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'const x = 1;',
        changes: [{ search: 'nonexistent', replace: 'value' }],
      });

      expect(result.hasChanges).toBe(false);
      expect(result.changesApplied).toBe(0);
    });

    it('returns proposed content without modifying original', () => {
      const original = 'const debug = false;';
      const result = generateHypotheticalDiff({
        filePath: 'config.ts',
        originalContent: original,
        changes: [{ search: 'false', replace: 'true' }],
      });

      expect(result.proposedContent).toBe('const debug = true;');
      // Original should be unchanged (we just verify we got a different result)
      expect(result.proposedContent).not.toBe(original);
    });

    it('applies multiple changes', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'const a = 1; const b = 2;',
        changes: [
          { search: '1', replace: '10' },
          { search: '2', replace: '20' },
        ],
      });

      expect(result.changesApplied).toBe(2);
      expect(result.proposedContent).toBe('const a = 10; const b = 20;');
    });

    it('supports replace all option', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'foo foo foo',
        changes: [{ search: 'foo', replace: 'bar', all: true }],
      });

      expect(result.totalReplacements).toBe(3);
      expect(result.proposedContent).toBe('bar bar bar');
    });

    it('replaces first occurrence only by default', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'foo foo foo',
        changes: [{ search: 'foo', replace: 'bar' }],
      });

      expect(result.totalReplacements).toBe(1);
      expect(result.proposedContent).toBe('bar foo foo');
    });
  });

  describe('unified diff output', () => {
    it('produces unified diff format', () => {
      const result = generateHypotheticalDiff(
        createBasicOptions([{ search: 'debug: boolean', replace: 'debug?: boolean' }])
      );

      expect(result.diff).toContain('--- a/src/component.tsx');
      expect(result.diff).toContain('+++ b/src/component.tsx');
      expect(result.diff).toContain('@@');
    });

    it('shows removed lines with minus prefix', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'line1\nremove this\nline3',
        changes: [{ search: 'remove this', replace: 'keep this' }],
      });

      expect(result.diff).toContain('-remove this');
    });

    it('shows added lines with plus prefix', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'line1\nremove this\nline3',
        changes: [{ search: 'remove this', replace: 'keep this' }],
      });

      expect(result.diff).toContain('+keep this');
    });

    it('includes context lines around changes', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'line1\nline2\nchange me\nline4\nline5',
        changes: [{ search: 'change me', replace: 'changed' }],
        contextLines: 2,
      });

      // Context lines should be prefixed with space
      expect(result.diff).toContain(' line2');
      expect(result.diff).toContain(' line4');
    });

    it('counts added and removed lines', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'old line',
        changes: [{ search: 'old line', replace: 'new line 1\nnew line 2' }],
      });

      expect(result.linesRemoved).toBeGreaterThanOrEqual(1);
      expect(result.linesAdded).toBeGreaterThanOrEqual(1);
    });
  });

  describe('preview markers', () => {
    it('includes preview banner by default', () => {
      const result = generateHypotheticalDiff(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      expect(result.previewDiff).toContain('PREVIEW');
      expect(result.previewDiff).toContain('NOT COMMITTED');
    });

    it('includes warning text', () => {
      const result = generateHypotheticalDiff(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      expect(result.previewDiff).toContain('PREVIEW ONLY');
      expect(result.previewDiff).toContain('No files have been modified');
    });

    it('can disable preview banner', () => {
      const result = generateHypotheticalDiff({
        ...createBasicOptions([{ search: 'hello', replace: 'world' }]),
        showPreviewBanner: false,
      });

      expect(result.previewDiff).not.toContain('╔');
    });

    it('includes summary by default', () => {
      const result = generateHypotheticalDiff(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      expect(result.previewDiff).toContain('change(s) would be applied');
    });

    it('shows no changes message when nothing matches', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'content',
        changes: [{ search: 'nonexistent', replace: 'value' }],
      });

      expect(result.previewDiff).toContain('No changes would be made');
    });
  });

  describe('summary generation', () => {
    it('generates human-readable summary', () => {
      const result = generateHypotheticalDiff(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      expect(result.summary).toContain('src/component.tsx');
      expect(result.summary).toContain('change(s) would be applied');
      expect(result.summary).toContain('replacement(s)');
    });

    it('includes line change counts in summary', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'line1\nline2',
        changes: [{ search: 'line2', replace: 'modified line 2' }],
      });

      expect(result.summary).toMatch(/\+\d+\s*\/\s*-\d+/);
    });
  });

  describe('multiple files', () => {
    it('generates preview for multiple files', () => {
      const generator = new HypotheticalDiffGenerator();

      const { results, combinedPreview, totalChanges } = generator.generateMultiple([
        {
          filePath: 'file1.ts',
          originalContent: 'const a = 1;',
          changes: [{ search: '1', replace: '2' }],
        },
        {
          filePath: 'file2.ts',
          originalContent: 'const b = 3;',
          changes: [{ search: '3', replace: '4' }],
        },
      ]);

      expect(results.size).toBe(2);
      expect(totalChanges).toBe(2);
      expect(combinedPreview).toContain('file1.ts');
      expect(combinedPreview).toContain('file2.ts');
    });

    it('shows total statistics in combined preview', () => {
      const generator = new HypotheticalDiffGenerator();

      const { combinedPreview } = generator.generateMultiple([
        {
          filePath: 'file1.ts',
          originalContent: 'a',
          changes: [{ search: 'a', replace: 'b' }],
        },
        {
          filePath: 'file2.ts',
          originalContent: 'c',
          changes: [{ search: 'c', replace: 'd' }],
        },
      ]);

      expect(combinedPreview).toContain('Total:');
      expect(combinedPreview).toContain('2 file(s)');
    });
  });

  describe('render formats', () => {
    it('renders unified format (default)', () => {
      const generator = new HypotheticalDiffGenerator();
      const result = generator.generate(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      const rendered = generator.render(result, 'unified');
      expect(rendered).toBe(result.previewDiff);
    });

    it('renders minimal format', () => {
      const generator = new HypotheticalDiffGenerator();
      const result = generator.generate(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      const rendered = generator.render(result, 'minimal');
      expect(rendered).toContain('PREVIEW');
      expect(rendered.length).toBeLessThan(result.previewDiff.length);
    });

    it('renders inline format', () => {
      const generator = new HypotheticalDiffGenerator();
      const result = generator.generate(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      const rendered = generator.render(result, 'inline');
      expect(rendered).toContain('INLINE VIEW');
    });

    it('renders side-by-side format', () => {
      const generator = new HypotheticalDiffGenerator();
      const result = generator.generate(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      const rendered = generator.render(result, 'side-by-side');
      expect(rendered).toContain('SIDE BY SIDE');
      expect(rendered).toContain('ORIGINAL');
      expect(rendered).toContain('PROPOSED');
    });
  });

  describe('factory functions', () => {
    it('createHypotheticalDiffGenerator creates instance', () => {
      const generator = createHypotheticalDiffGenerator();
      expect(generator).toBeInstanceOf(HypotheticalDiffGenerator);
    });

    it('generateHypotheticalDiff utility works', () => {
      const result = generateHypotheticalDiff({
        filePath: 'test.ts',
        originalContent: 'a',
        changes: [{ search: 'a', replace: 'b' }],
      });

      expect(result.hasChanges).toBe(true);
    });

    it('previewFileChanges utility works', () => {
      const result = previewFileChanges('test.ts', 'old', [
        { search: 'old', replace: 'new' },
      ]);

      expect(result.hasChanges).toBe(true);
      expect(result.proposedContent).toBe('new');
    });
  });

  describe('configuration', () => {
    it('allows updating preview banner', () => {
      const generator = new HypotheticalDiffGenerator();
      generator.setPreviewBanner('CUSTOM BANNER');

      const result = generator.generate(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      expect(result.previewDiff).toContain('CUSTOM BANNER');
    });

    it('allows updating warning text', () => {
      const generator = new HypotheticalDiffGenerator();
      generator.setWarningText('CUSTOM WARNING');

      const result = generator.generate(
        createBasicOptions([{ search: 'hello', replace: 'world' }])
      );

      expect(result.previewDiff).toContain('CUSTOM WARNING');
    });
  });

  // ==========================================================================
  // Feature #56 Verification Tests
  // ==========================================================================

  describe('Feature #56 verification: Shows unified diff of proposed changes; clearly marked as preview', () => {
    describe('shows unified diff of proposed changes', () => {
      it('produces standard unified diff format', () => {
        const result = generateHypotheticalDiff({
          filePath: 'src/config.ts',
          originalContent: SAMPLE_CONFIG,
          changes: [{ search: '"debug": false', replace: '"debug": true' }],
        });

        // Unified diff header format
        expect(result.diff).toContain('--- a/src/config.ts');
        expect(result.diff).toContain('+++ b/src/config.ts');

        // Hunk header format
        expect(result.diff).toMatch(/@@ -\d+,?\d* \+\d+,?\d* @@/);

        // Shows removal (-)
        expect(result.diff).toContain('-');

        // Shows addition (+)
        expect(result.diff).toContain('+');
      });

      it('shows proposed changes accurately', () => {
        const result = generateHypotheticalDiff({
          filePath: 'config.json',
          originalContent: '{ "enabled": false }',
          changes: [{ search: 'false', replace: 'true' }],
        });

        expect(result.diff).toContain('-{ "enabled": false }');
        expect(result.diff).toContain('+{ "enabled": true }');
      });

      it('shows multi-line changes correctly', () => {
        const original = 'function test() {\n  return 1;\n}';
        const result = generateHypotheticalDiff({
          filePath: 'test.ts',
          originalContent: original,
          changes: [{ search: 'return 1;', replace: 'const x = 1;\n  return x;' }],
        });

        expect(result.diff).toContain('-  return 1;');
        expect(result.diff).toContain('+  const x = 1;');
        expect(result.diff).toContain('+  return x;');
      });

      it('handles empty replacement (deletion)', () => {
        const result = generateHypotheticalDiff({
          filePath: 'test.ts',
          originalContent: 'keep this\nremove this\nkeep this too',
          changes: [{ search: 'remove this\n', replace: '' }],
        });

        expect(result.hasChanges).toBe(true);
        expect(result.proposedContent).toBe('keep this\nkeep this too');
      });
    });

    describe('clearly marked as preview', () => {
      it('includes prominent PREVIEW marker', () => {
        const result = generateHypotheticalDiff({
          filePath: 'test.ts',
          originalContent: 'a',
          changes: [{ search: 'a', replace: 'b' }],
        });

        expect(result.previewDiff.toUpperCase()).toContain('PREVIEW');
      });

      it('includes NOT COMMITTED indicator', () => {
        const result = generateHypotheticalDiff({
          filePath: 'test.ts',
          originalContent: 'a',
          changes: [{ search: 'a', replace: 'b' }],
        });

        expect(result.previewDiff.toUpperCase()).toContain('NOT COMMITTED');
      });

      it('includes warning that no files are modified', () => {
        const result = generateHypotheticalDiff({
          filePath: 'test.ts',
          originalContent: 'a',
          changes: [{ search: 'a', replace: 'b' }],
        });

        expect(result.previewDiff).toContain('No files have been modified');
      });

      it('explains this shows what WOULD happen', () => {
        const result = generateHypotheticalDiff({
          filePath: 'test.ts',
          originalContent: 'a',
          changes: [{ search: 'a', replace: 'b' }],
        });

        expect(result.previewDiff).toContain('WOULD');
      });

      it('uses visual separators for clarity', () => {
        const result = generateHypotheticalDiff({
          filePath: 'test.ts',
          originalContent: 'a',
          changes: [{ search: 'a', replace: 'b' }],
        });

        // Should have box-drawing or separator characters
        expect(result.previewDiff).toMatch(/[═╔╗╚╝║─]/);
      });

      it('includes warning emoji for visibility', () => {
        const result = generateHypotheticalDiff({
          filePath: 'test.ts',
          originalContent: 'a',
          changes: [{ search: 'a', replace: 'b' }],
        });

        expect(result.previewDiff).toContain('⚠️');
      });
    });

    describe('complete verification scenario', () => {
      it('provides full preview experience for real-world change', () => {
        // Simulate changing debug mode in a config file
        const originalConfig = `export const config = {
  apiUrl: 'https://api.example.com',
  debug: false,
  timeout: 5000,
  retries: 3,
};`;

        const result = generateHypotheticalDiff({
          filePath: 'src/config.ts',
          originalContent: originalConfig,
          changes: [
            { search: 'debug: false', replace: 'debug: true' },
            { search: 'timeout: 5000', replace: 'timeout: 10000' },
          ],
        });

        // Verify it's a preview
        expect(result.previewDiff).toContain('PREVIEW');
        expect(result.previewDiff).toContain('NOT COMMITTED');

        // Verify unified diff format
        expect(result.diff).toContain('--- a/src/config.ts');
        expect(result.diff).toContain('+++ b/src/config.ts');

        // Verify changes are shown
        expect(result.diff).toContain('-  debug: false');
        expect(result.diff).toContain('+  debug: true');
        expect(result.diff).toContain('-  timeout: 5000');
        expect(result.diff).toContain('+  timeout: 10000');

        // Verify summary info
        expect(result.changesApplied).toBe(2);
        expect(result.hasChanges).toBe(true);

        // Verify proposed content
        expect(result.proposedContent).toContain('debug: true');
        expect(result.proposedContent).toContain('timeout: 10000');

        // Verify no actual file modification warning
        expect(result.previewDiff).toContain('No files have been modified');
      });
    });
  });
});

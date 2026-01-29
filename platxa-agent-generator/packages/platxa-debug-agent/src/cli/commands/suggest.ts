/**
 * Suggest command - Generate ranked fix suggestions for an error
 *
 * Uses fix generation and presentation to provide
 * prioritized fix suggestions with detailed explanations.
 */

import { readFileSync, existsSync } from 'node:fs';
import { LanguageDetector } from '../../core/language-detector.js';
import { createErrorParser } from '../../core/error-parser.js';
import { createFixGenerator } from '../../core/fix-generator.js';
import { createFixPresenter } from '../../core/fix-presenter.js';
import type { PresentationFormat } from '../../core/fix-presenter.js';

export interface SuggestOptions {
  top?: string;
  format?: 'terminal' | 'json' | 'markdown' | 'html';
  verbose?: boolean;
}

export async function suggestCommand(
  error: string,
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as SuggestOptions;

  // Get error text
  const errorText = existsSync(error) ? readFileSync(error, 'utf-8') : error;

  // Detect language and parse error
  const detector = new LanguageDetector();
  const detection = detector.detect({ errorText });

  const parser = createErrorParser();
  const errors = parser.parse(errorText, { language: detection.language });

  if (errors.length === 0) {
    console.log('No errors detected in the input.');
    return;
  }

  const normalized = errors[0]!;

  // Configure components
  const topCount = parseInt(opts.top ?? '5', 10);
  const generator = createFixGenerator();
  const format: PresentationFormat = opts.format ?? 'terminal';
  const presenter = createFixPresenter({ format });

  console.log(`\n=== Fix Suggestions ===\n`);
  console.log(`Error: ${normalized.type} - ${normalized.message}`);
  console.log(`Language: ${detection.language}`);

  if (normalized.location) {
    console.log(`Location: ${normalized.location.file}:${normalized.location.line}`);
  }

  // Generate fixes
  const generatedFixes = generator.generateFixes(normalized);

  if (generatedFixes.length === 0) {
    console.log(`\nNo automated fix suggestions available for this error type.`);
    console.log(`\nManual investigation steps:`);
    console.log(`  1. Review the error message and location`);
    console.log(`  2. Check related code for common issues`);
    console.log(`  3. Use 'platxa-debug rca' for root cause analysis`);
    console.log(`  4. Use 'platxa-debug localize' for fault localization`);
    return;
  }

  // Sort by confidence (highest first) and take top N
  const sortedFixes = generatedFixes
    .sort((a, b) => b.fix.confidence - a.fix.confidence)
    .slice(0, topCount);

  console.log(`\n--- Top ${sortedFixes.length} Fix Suggestions ---\n`);

  // Present fixes using the presenter
  const presentation = presenter.present(sortedFixes.map(gf => gf.fix));

  if (format === 'json') {
    console.log(JSON.stringify({
      error: {
        type: normalized.type,
        message: normalized.message,
        location: normalized.location,
      },
      suggestions: sortedFixes.map((gf, index) => ({
        rank: index + 1,
        description: gf.fix.description,
        confidence: Math.round(gf.fix.confidence * 100),
        changes: gf.fix.changes.map(c => ({
          file: c.file,
          type: c.type,
          startLine: c.start.line,
          startColumn: c.start.column,
        })),
      })),
    }, null, 2));
  } else {
    // Use presenter output for terminal/markdown/html
    console.log(presentation.output);
  }

  // Show summary
  console.log(`\n--- Summary ---`);
  console.log(`Total suggestions generated: ${generatedFixes.length}`);
  console.log(`Showing top: ${sortedFixes.length}`);
  console.log(`Highest confidence: ${Math.round((sortedFixes[0]?.fix.confidence ?? 0) * 100)}%`);

  if (!opts.verbose) {
    console.log(`\nUse --verbose for detailed explanations.`);
  }
}

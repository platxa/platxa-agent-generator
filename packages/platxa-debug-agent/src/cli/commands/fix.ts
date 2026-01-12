/**
 * Fix command - Generate fix suggestions for an error
 */

import { readFileSync, existsSync } from 'node:fs';
import { LanguageDetector } from '../../core/language-detector.js';
import { createErrorParser } from '../../core/error-parser.js';
import { createFixGenerator } from '../../core/fix-generator.js';

export interface FixOptions {
  auto?: boolean;
  interactive?: boolean;
  dryRun?: boolean;
  validate?: boolean;
}

export async function fixCommand(
  error: string,
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as FixOptions;

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

  // Use the first error (we know it exists due to length check above)
  const normalized = errors[0]!;

  // Generate fixes
  const generator = createFixGenerator();
  const generatedFixes = generator.generateFixes(normalized);

  console.log(`\n=== Fix Suggestions ===\n`);
  console.log(`Error: ${normalized.type} - ${normalized.message}`);
  console.log(`Language: ${detection.language}`);

  if (generatedFixes.length === 0) {
    console.log(`\nNo automated fixes available for this error type.`);
    console.log(`Consider using 'platxa-debug rca' for root cause analysis.`);
    return;
  }

  console.log(`\n--- Available Fixes (${generatedFixes.length}) ---\n`);

  for (const [index, generated] of generatedFixes.entries()) {
    const fix = generated.fix;
    console.log(`[${index + 1}] ${fix.description}`);
    console.log(`    Confidence: ${Math.round(fix.confidence * 100)}%`);
    if (fix.changes.length > 0) {
      console.log(`    Changes:`);
      for (const change of fix.changes) {
        console.log(`      - ${change.file}: ${change.type}`);
      }
    }
    console.log();
  }

  if (opts.dryRun) {
    console.log(`[Dry run] No changes applied.`);
  } else if (opts.auto) {
    console.log(`[Auto mode] Would apply fix #1 (highest confidence).`);
    console.log(`Note: Auto-apply is not yet implemented. Use --dry-run to preview.`);
  } else if (opts.interactive) {
    console.log(`[Interactive mode] Not yet implemented.`);
    console.log(`Use 'platxa-debug fix <error> --auto' for automatic fix selection.`);
  }
}

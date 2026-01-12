/**
 * Validate command - Validate a fix suggestion against the codebase
 *
 * Uses the fix validator to check syntax, semantics, and run tests
 * to ensure a proposed fix is correct and safe to apply.
 */

import { readFileSync, existsSync } from 'node:fs';
import { LanguageDetector } from '../../core/language-detector.js';
import { createErrorParser } from '../../core/error-parser.js';
import { createFixGenerator } from '../../core/fix-generator.js';
import { createFixValidator } from '../../core/fix-validator.js';
import type { Language } from '../../core/types.js';

export interface ValidateOptions {
  fix?: string;
  file?: string;
  runTests?: boolean;
  strict?: boolean;
  output?: 'json' | 'text';
}

export async function validateCommand(
  error: string,
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as ValidateOptions;

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

  console.log(`\n=== Fix Validation ===\n`);
  console.log(`Error: ${normalized.type} - ${normalized.message}`);
  console.log(`Language: ${detection.language}`);

  // Generate fixes
  const generator = createFixGenerator();
  const generatedFixes = generator.generateFixes(normalized);

  if (generatedFixes.length === 0) {
    console.log(`\nNo fixes available to validate.`);
    return;
  }

  // Get the fix to validate (first one by default, or specified by --fix)
  const fixIndex = opts.fix ? parseInt(opts.fix, 10) - 1 : 0;
  if (fixIndex < 0 || fixIndex >= generatedFixes.length) {
    console.error(`Invalid fix index: ${opts.fix}. Available: 1-${generatedFixes.length}`);
    return;
  }

  const fixToValidate = generatedFixes[fixIndex]!;
  console.log(`\nValidating fix #${fixIndex + 1}: ${fixToValidate.fix.description}`);

  // Get original code from file if specified
  let originalCode = '';
  if (opts.file && existsSync(opts.file)) {
    originalCode = readFileSync(opts.file, 'utf-8');
  } else if (normalized.location?.file && existsSync(normalized.location.file)) {
    originalCode = readFileSync(normalized.location.file, 'utf-8');
  }

  // Create validator and validate
  const validator = createFixValidator();
  const language = detection.language as Language;

  console.log(`\n--- Running Validation ---\n`);

  try {
    const result = await validator.validateFix(
      fixToValidate.fix,
      language,
      originalCode,
      {
        skipTypeCheck: false,
        skipLint: !opts.strict,
        skipSyntax: false,
      }
    );

    const isValid = result.status === 'valid';
    const syntaxOk = result.syntaxCheck?.success ?? true;
    const typeOk = result.typeCheck?.success ?? true;
    const lintOk = result.lintCheck?.success ?? true;

    // Collect all errors
    const allErrors = [
      ...(result.syntaxCheck?.errors ?? []),
      ...(result.typeCheck?.errors ?? []),
      ...(result.lintCheck?.errors ?? []),
    ];

    if (opts.output === 'json') {
      console.log(JSON.stringify({
        fix: {
          description: fixToValidate.fix.description,
          confidence: Math.round(fixToValidate.fix.confidence * 100),
        },
        validation: {
          status: result.status,
          syntaxValid: syntaxOk,
          typeCheckValid: typeOk,
          lintValid: lintOk,
          durationMs: result.totalDurationMs,
        },
        errors: allErrors.map(e => ({
          message: e.message,
          file: e.file,
          line: e.line,
          severity: e.severity,
        })),
        summary: result.summary,
      }, null, 2));
    } else {
      // Text output
      console.log(`Validation Result: ${isValid ? 'PASSED' : 'FAILED'}`);
      console.log(`Status: ${result.status}`);
      console.log(`Duration: ${result.totalDurationMs}ms`);
      console.log();
      console.log(`Checks:`);
      console.log(`  Syntax:     ${syntaxOk ? '✓ Valid' : '✗ Invalid'}`);
      console.log(`  Type Check: ${typeOk ? '✓ Valid' : '✗ Invalid'}`);
      console.log(`  Lint:       ${result.lintCheck ? (lintOk ? '✓ Valid' : '✗ Invalid') : '- Skipped'}`);

      if (allErrors.length > 0) {
        console.log(`\nErrors Found (${allErrors.length}):`);
        for (const error of allErrors.slice(0, 10)) {
          const severity = error.severity === 'error' ? '✗' : error.severity === 'warning' ? '⚠' : 'ℹ';
          console.log(`  ${severity} [${error.severity}] ${error.message}`);
          console.log(`    at ${error.file}:${error.line}`);
        }
        if (allErrors.length > 10) {
          console.log(`  ... and ${allErrors.length - 10} more`);
        }
      }

      console.log(`\nSummary: ${result.summary}`);

      if (isValid) {
        console.log(`\n✓ Fix is safe to apply.`);
      } else {
        console.log(`\n✗ Fix has issues that should be addressed before applying.`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Validation error: ${message}`);
    process.exit(1);
  }
}

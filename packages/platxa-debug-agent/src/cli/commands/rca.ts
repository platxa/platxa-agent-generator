/**
 * RCA command - Perform root cause analysis on an error
 */

import { readFileSync, existsSync } from 'node:fs';
import { LanguageDetector } from '../../core/language-detector.js';
import { createErrorParser } from '../../core/error-parser.js';
import { createRCAEngine } from '../../core/rca-engine.js';
import type { AnalysisContext } from '../../core/types.js';

export interface RCAOptions {
  depth?: string;
  context?: string[];
  hypothesisCount?: string;
}

export async function rcaCommand(
  error: string,
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as RCAOptions;

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

  // Create RCA engine and generate hypotheses
  const rcaEngine = createRCAEngine();
  const depth = parseInt(opts.depth ?? '3', 10);
  const hypothesisCount = parseInt(opts.hypothesisCount ?? '5', 10);

  // Build analysis context
  const analysisContext: AnalysisContext = {
    workingDir: process.cwd(),
    relevantFiles: [],
    fileContents: new Map(),
  };

  const result = await rcaEngine.generateHypotheses(errors, analysisContext);

  // Use the first error for display (we know it exists due to length check above)
  const normalized = errors[0]!;

  console.log(`\n=== Root Cause Analysis ===\n`);
  console.log(`Error: ${normalized.type} - ${normalized.message}`);
  console.log(`Language: ${detection.language}`);
  console.log(`Analysis Depth: ${depth}`);
  console.log(`\n--- Hypotheses (${Math.min(result.hypotheses.length, hypothesisCount)}) ---\n`);

  const hypothesesToShow = result.hypotheses.slice(0, hypothesisCount);
  for (const hypothesis of hypothesesToShow) {
    console.log(`[${Math.round(hypothesis.confidence * 100)}%] ${hypothesis.description}`);
    if (hypothesis.suggestedFixes && hypothesis.suggestedFixes.length > 0) {
      console.log(`  Suggested fixes:`);
      for (const fix of hypothesis.suggestedFixes) {
        console.log(`    - ${fix.description}`);
      }
    }
    console.log();
  }

  if (result.notes && result.notes.length > 0) {
    console.log(`--- Analysis Notes ---\n`);
    for (const note of result.notes) {
      console.log(`- ${note}`);
    }
  }
}

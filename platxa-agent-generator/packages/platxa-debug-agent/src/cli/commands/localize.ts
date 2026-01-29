/**
 * Localize command - Perform fault localization to identify suspicious code locations
 *
 * Uses Spectrum-Based Fault Localization (SBFL) and causal chain analysis
 * to identify the most likely locations of bugs in the codebase.
 */

import { readFileSync, existsSync } from 'node:fs';
import { LanguageDetector } from '../../core/language-detector.js';
import { createErrorParser } from '../../core/error-parser.js';
import { createSBFLAnalyzer } from '../../core/sbfl-analyzer.js';
import { createCausalChainReconstructor } from '../../core/causal-chain.js';
import type { SBFLFormula, CodeElement, TestExecution } from '../../core/sbfl-analyzer.js';

export interface LocalizeOptions {
  formula?: string;
  top?: string;
  files?: string[];
  verbose?: boolean;
  output?: 'json' | 'text' | 'markdown';
}

export async function localizeCommand(
  error: string,
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as LocalizeOptions;

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

  // Configure SBFL analyzer
  const formula = (opts.formula ?? 'ochiai') as SBFLFormula;
  const topCount = parseInt(opts.top ?? '10', 10);

  const sbflAnalyzer = createSBFLAnalyzer({ formula });
  const causalReconstructor = createCausalChainReconstructor();

  console.log(`\n=== Fault Localization ===\n`);
  console.log(`Error: ${normalized.type} - ${normalized.message}`);
  console.log(`Language: ${detection.language}`);
  console.log(`Formula: ${formula}`);
  console.log(`Top results: ${topCount}`);

  // Reconstruct causal chain if we have stack trace
  if (normalized.stackTrace && normalized.stackTrace.length > 0) {
    console.log(`\n--- Causal Chain Analysis ---`);

    const chain = causalReconstructor.reconstruct(normalized, {
      stackTrace: normalized.stackTrace,
    });

    console.log(`Chain nodes: ${chain.nodes.length}`);
    console.log(`Chain edges: ${chain.edges.length}`);

    if (chain.nodes.length > 0) {
      console.log(`\nSuspicious locations from causal chain:`);
      for (const node of chain.nodes.slice(0, topCount)) {
        const loc = node.location;
        if (loc) {
          console.log(`  - ${loc.file}:${loc.line} (${node.type})`);
        }
      }
    }
  }

  // SBFL analysis demonstration (would require real coverage data in practice)
  console.log(`\n--- SBFL Analysis ---`);

  // If we have stack trace, we can create a simple spectrum from it
  if (normalized.stackTrace && normalized.stackTrace.length > 0) {
    // Create code elements from stack trace for demonstration
    const elements: CodeElement[] = normalized.stackTrace.map((frame, idx) => ({
      id: `element-${idx}`,
      type: 'line' as const,
      location: {
        file: frame.location.file,
        line: frame.location.line,
      },
    }));

    if (elements.length > 0) {
      // Create test execution from the failing scenario
      const tests: TestExecution[] = [{
        testId: 'failing-test',
        testName: 'Error execution',
        passed: false,
        coveredElements: elements.map(e => e.id),
      }];

      // Create spectrum and analyze
      const spectrum = sbflAnalyzer.createSpectrum(elements, tests);
      const result = sbflAnalyzer.analyze(spectrum);

      console.log(`\nSuspicious elements (from stack trace analysis):`);
      for (const score of result.topSuspicious.slice(0, topCount)) {
        const loc = score.element.location;
        console.log(`  [${(score.score * 100).toFixed(1)}%] ${loc.file}:${loc.line}`);
      }
    }
  } else {
    console.log(`Note: Full SBFL analysis requires test coverage data.`);
    console.log(`Provide coverage via: platxa-debug localize <error> --coverage <file>`);
  }

  // Show primary location from error
  if (normalized.location) {
    console.log(`\n--- Primary Suspicious Location ---`);
    console.log(`File: ${normalized.location.file}`);
    console.log(`Line: ${normalized.location.line}`);
    if (normalized.location.column) {
      console.log(`Column: ${normalized.location.column}`);
    }
  }

  // Show stack trace locations
  if (normalized.stackTrace && normalized.stackTrace.length > 0) {
    console.log(`\n--- Stack Trace Locations (Top ${Math.min(topCount, normalized.stackTrace.length)}) ---`);
    for (const frame of normalized.stackTrace.slice(0, topCount)) {
      const funcName = frame.functionName ?? '<anonymous>';
      console.log(`  ${funcName} at ${frame.location.file}:${frame.location.line}`);
    }
  }

  if (opts.output === 'json') {
    console.log(`\n--- JSON Output ---`);
    console.log(JSON.stringify({
      error: {
        type: normalized.type,
        message: normalized.message,
        location: normalized.location,
      },
      formula,
      language: detection.language,
      stackTraceLocations: normalized.stackTrace?.map(f => ({
        function: f.functionName,
        file: f.location.file,
        line: f.location.line,
      })),
    }, null, 2));
  }
}

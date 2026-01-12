/**
 * Analyze command - Analyze an error message or log file
 */

import { readFileSync, existsSync } from 'node:fs';
import { LanguageDetector } from '../../core/language-detector.js';
import { createErrorParser } from '../../core/error-parser.js';
import { getSharedConfigLoader } from '../config-loader.js';
import type { Language } from '../../core/types.js';
import type { CLIFlags } from '../config-loader.js';

export interface AnalyzeOptions {
  language?: string;
  file?: string;
  output?: 'json' | 'text' | 'markdown';
  verbose?: boolean;
  color?: boolean;
}

export async function analyzeCommand(
  input: string | undefined,
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as AnalyzeOptions;

  // Load config with CLI flags merged
  const configLoader = getSharedConfigLoader();
  const cliFlags: CLIFlags = {};
  if (opts.language) cliFlags.language = opts.language;
  if (opts.output) cliFlags.output = opts.output;
  if (opts.verbose !== undefined) cliFlags.verbose = opts.verbose;
  if (opts.color !== undefined) cliFlags.color = opts.color;
  const config = configLoader.load(cliFlags);

  // Use config values as defaults when CLI flags not provided
  const outputFormat = opts.output ?? config.output.format;
  const verbose = opts.verbose ?? config.output.verbose;

  let errorText: string;

  // Get error text from input, file, or stdin
  if (opts.file && existsSync(opts.file)) {
    errorText = readFileSync(opts.file, 'utf-8');
  } else if (input) {
    errorText = input;
  } else {
    // Read from stdin if available
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    errorText = Buffer.concat(chunks).toString('utf-8');
  }

  if (!errorText.trim()) {
    console.error('Error: No input provided. Use --file, provide input directly, or pipe to stdin.');
    process.exit(1);
  }

  // Detect language
  const detector = new LanguageDetector();
  const detection = opts.language
    ? { language: opts.language as Language, confidence: 'high' as const, score: 1.0, detectionMethod: 'extension' as const }
    : detector.detect({ errorText });

  // Parse error
  const parser = createErrorParser();
  const errors = parser.parse(errorText, { language: detection.language });

  // Output results - use CLI flag, then config, then default
  const output = outputFormat;

  if (errors.length === 0) {
    console.log('No errors detected in the input.');
    return;
  }

  // Use the first error for primary display (we know it exists due to length check above)
  const normalized = errors[0]!;

  if (output === 'json') {
    console.log(JSON.stringify({
      language: detection,
      errors: errors,
    }, null, 2));
  } else if (output === 'markdown') {
    console.log(`# Error Analysis\n`);
    console.log(`**Language:** ${detection.language} (${Math.round(detection.score * 100)}% confidence)\n`);
    console.log(`**Type:** ${normalized.type}\n`);
    console.log(`**Message:** ${normalized.message}\n`);
    if (normalized.location) {
      console.log(`**Location:** ${normalized.location.file}:${normalized.location.line}\n`);
    }
    if (normalized.stackTrace && normalized.stackTrace.length > 0) {
      console.log(`\n## Stack Trace\n`);
      for (const frame of normalized.stackTrace) {
        console.log(`- ${frame.functionName ?? '<anonymous>'} at ${frame.location.file}:${frame.location.line}`);
      }
    }
  } else {
    console.log(`Language: ${detection.language} (${Math.round(detection.score * 100)}% confidence)`);
    console.log(`Type: ${normalized.type}`);
    console.log(`Message: ${normalized.message}`);
    if (normalized.location) {
      console.log(`Location: ${normalized.location.file}:${normalized.location.line}`);
    }
    if (verbose && normalized.stackTrace && normalized.stackTrace.length > 0) {
      console.log(`\nStack Trace:`);
      for (const frame of normalized.stackTrace) {
        console.log(`  ${frame.functionName ?? '<anonymous>'} at ${frame.location.file}:${frame.location.line}`);
      }
    }
  }
}

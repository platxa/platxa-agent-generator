#!/usr/bin/env node
/**
 * Platxa Debug Agent CLI
 *
 * Production-grade multi-language AI debugging agent for Claude Code.
 * Analyzes errors, identifies root causes, and suggests fixes.
 */

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ES module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version (navigate from dist/cli to package root)
const packageJsonPath = join(__dirname, '..', '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };

const program = new Command();

program
  .name('platxa-debug')
  .description('Production-grade multi-language AI debugging agent for Claude Code')
  .version(packageJson.version);

program
  .command('analyze')
  .description('Analyze an error message or log file')
  .argument('[input]', 'Error message, log file path, or stdin')
  .option('-l, --language <lang>', 'Force language detection (python, javascript, typescript, css, html)')
  .option('-f, --file <path>', 'Read error from file')
  .option('-o, --output <format>', 'Output format (json, text, markdown)', 'text')
  .option('-v, --verbose', 'Verbose output with detailed analysis')
  .option('--no-color', 'Disable colored output')
  .action(async (input: string | undefined, options: Record<string, unknown>) => {
    const { analyzeCommand } = await import('./commands/analyze.js');
    await analyzeCommand(input, options);
  });

program
  .command('rca')
  .description('Perform root cause analysis on an error')
  .argument('<error>', 'Error message or file path')
  .option('-d, --depth <number>', 'Analysis depth (1-5)', '3')
  .option('-c, --context <files...>', 'Additional context files')
  .option('--hypothesis-count <number>', 'Number of hypotheses to generate', '5')
  .action(async (error: string, options: Record<string, unknown>) => {
    const { rcaCommand } = await import('./commands/rca.js');
    await rcaCommand(error, options);
  });

program
  .command('fix')
  .description('Generate fix suggestions for an error')
  .argument('<error>', 'Error message or file path')
  .option('-a, --auto', 'Automatically apply the best fix')
  .option('-i, --interactive', 'Interactive fix selection')
  .option('--dry-run', 'Show changes without applying')
  .option('--validate', 'Run validation after applying fix')
  .action(async (error: string, options: Record<string, unknown>) => {
    const { fixCommand } = await import('./commands/fix.js');
    await fixCommand(error, options);
  });

program
  .command('watch')
  .description('Watch log files for errors in real-time')
  .argument('<path>', 'Log file or directory to watch')
  .option('-p, --pattern <glob>', 'File pattern to watch', '**/*.log')
  .option('--debounce <ms>', 'Debounce interval in milliseconds', '500')
  .option('-q, --quiet', 'Only show errors, no status messages')
  .action(async (watchPath: string, options: Record<string, unknown>) => {
    const { watchCommand } = await import('./commands/watch.js');
    await watchCommand(watchPath, options);
  });

program
  .command('report')
  .description('Generate a debugging report')
  .option('-f, --format <type>', 'Report format (html, markdown, json, sarif)', 'markdown')
  .option('-o, --output <path>', 'Output file path')
  .option('--session <id>', 'Include specific debug session')
  .option('--all', 'Include all sessions from today')
  .action(async (options: Record<string, unknown>) => {
    const { reportCommand } = await import('./commands/report.js');
    await reportCommand(options);
  });

program
  .command('init')
  .description('Initialize debug configuration for the project')
  .option('--force', 'Overwrite existing configuration')
  .option('--template <name>', 'Use a specific template (minimal, standard, comprehensive)', 'standard')
  .action(async (options: Record<string, unknown>) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand(options);
  });

program
  .command('status')
  .description('Show current debugging session status')
  .option('--metrics', 'Show detailed metrics')
  .option('--history', 'Show session history')
  .action(async (options: Record<string, unknown>) => {
    const { statusCommand } = await import('./commands/status.js');
    await statusCommand(options);
  });

program
  .command('config')
  .description('Manage debug agent configuration')
  .argument('[key]', 'Configuration key to get/set')
  .argument('[value]', 'Value to set')
  .option('--list', 'List all configuration options')
  .option('--reset', 'Reset to default configuration')
  .action(async (key: string | undefined, value: string | undefined, options: Record<string, unknown>) => {
    const { configCommand } = await import('./commands/config.js');
    await configCommand(key, value, options);
  });

program
  .command('localize')
  .description('Perform fault localization to identify suspicious code locations')
  .argument('<error>', 'Error message or file path')
  .option('-f, --formula <name>', 'SBFL formula (ochiai, tarantula, dstar, barinel)', 'ochiai')
  .option('-t, --top <count>', 'Number of top suspicious locations', '10')
  .option('--files <paths...>', 'Additional source files for analysis')
  .option('-v, --verbose', 'Verbose output')
  .option('-o, --output <format>', 'Output format (json, text, markdown)', 'text')
  .action(async (error: string, options: Record<string, unknown>) => {
    const { localizeCommand } = await import('./commands/localize.js');
    await localizeCommand(error, options);
  });

program
  .command('suggest')
  .description('Generate ranked fix suggestions for an error')
  .argument('<error>', 'Error message or file path')
  .option('-t, --top <count>', 'Number of top suggestions', '5')
  .option('-f, --format <type>', 'Output format (terminal, json, markdown, html)', 'terminal')
  .option('-v, --verbose', 'Include detailed explanations')
  .action(async (error: string, options: Record<string, unknown>) => {
    const { suggestCommand } = await import('./commands/suggest.js');
    await suggestCommand(error, options);
  });

program
  .command('validate')
  .description('Validate a fix suggestion against the codebase')
  .argument('<error>', 'Error message or file path')
  .option('--fix <number>', 'Fix number to validate (default: 1)')
  .option('--file <path>', 'Source file for validation context')
  .option('--strict', 'Enable strict validation with linting')
  .option('-o, --output <format>', 'Output format (json, text)', 'text')
  .action(async (error: string, options: Record<string, unknown>) => {
    const { validateCommand } = await import('./commands/validate.js');
    await validateCommand(error, options);
  });

program
  .command('patterns')
  .description('Manage error patterns and fix templates')
  .option('-a, --action <type>', 'Action to perform (list, export, clear, stats)', 'list')
  .option('-f, --format <type>', 'Output format (json, text, csv)', 'text')
  .option('-o, --output <path>', 'Output file path')
  .option('-p, --period <type>', 'Time period (hour, day, week, all)', 'day')
  .action(async (options: Record<string, unknown>) => {
    const { patternsCommand } = await import('./commands/patterns.js');
    await patternsCommand(options);
  });

// Parse and execute
program.parse();

#!/usr/bin/env node
/**
 * Platxa Debug Agent CLI
 *
 * Production-grade multi-language AI debugging agent for Claude Code.
 * Analyzes errors, identifies root causes, and suggests fixes.
 *
 * This is the CLI entry point. For development, use tsx:
 *   npx tsx bin/cli.ts --help
 *
 * For production (after build), use the compiled version:
 *   node dist/cli/cli.js --help
 *   npx platxa-debug --help
 */

// Re-export from the main CLI implementation
// This file serves as the bin entry point with shebang
import '../dist/cli/cli.js';

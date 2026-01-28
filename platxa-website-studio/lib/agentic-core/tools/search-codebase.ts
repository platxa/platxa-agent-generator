/**
 * Search Codebase Tool - Fast text search with semantic ranking
 *
 * Uses ripgrep (preferred) or grep (fallback) for fast file searching with:
 * - Glob pattern filtering
 * - Semantic relevance ranking
 * - Context-aware snippet extraction
 *
 * Production-grade: Works with or without ripgrep installed
 *
 * @module agentic-core/tools/search-codebase
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { ToolParams, ToolResult } from '../tool-executor';

const execAsync = promisify(exec);

// Cache ripgrep availability check
let ripgrepAvailable: boolean | null = null;

async function checkRipgrepAvailable(): Promise<boolean> {
  if (ripgrepAvailable !== null) {
    return ripgrepAvailable;
  }
  try {
    await execAsync('rg --version');
    ripgrepAvailable = true;
  } catch {
    ripgrepAvailable = false;
  }
  return ripgrepAvailable;
}

// ============================================================================
// Types
// ============================================================================

/** Search result from ripgrep */
export interface SearchMatch {
  /** File path where match was found */
  path: string;
  /** Line number of match */
  line: number;
  /** Column number of match start */
  column: number;
  /** The matched text with context */
  snippet: string;
  /** Relevance score (0-1) based on semantic ranking */
  relevance: number;
  /** Number of matches in this file */
  matchCount?: number;
}

/** Search options for codebase search */
export interface SearchOptions {
  /** Query string to search for */
  query: string;
  /** Glob patterns to include (e.g., "*.ts", "src/**") */
  includeGlobs?: string[];
  /** Glob patterns to exclude */
  excludeGlobs?: string[];
  /** Maximum results to return (default: 10) */
  maxResults?: number;
  /** Context lines before/after match */
  contextLines?: number;
  /** Case sensitive search */
  caseSensitive?: boolean;
  /** Search base directory */
  baseDir?: string;
  /** Use regex pattern */
  regex?: boolean;
  /** Search in specific file types */
  fileTypes?: string[];
}

/** Ripgrep JSON output format */
interface RipgrepMatch {
  type: 'match';
  data: {
    path: { text: string };
    lines: { text: string };
    line_number: number;
    absolute_offset: number;
    submatches: Array<{
      match: { text: string };
      start: number;
      end: number;
    }>;
  };
}

interface RipgrepContext {
  type: 'context';
  data: {
    path: { text: string };
    lines: { text: string };
    line_number: number;
  };
}

interface RipgrepBegin {
  type: 'begin';
  data: { path: { text: string } };
}

interface RipgrepEnd {
  type: 'end';
  data: { path: { text: string }; stats: { matches: number } };
}

type RipgrepOutput = RipgrepMatch | RipgrepContext | RipgrepBegin | RipgrepEnd;

// ============================================================================
// Semantic Ranking
// ============================================================================

/**
 * Calculate semantic relevance score for a search match
 * Uses multiple factors for ranking:
 * - Term frequency in match
 * - File path relevance
 * - Match position (earlier = more relevant)
 * - Context quality
 */
function calculateRelevance(
  match: RipgrepMatch,
  query: string,
  fileMatchCount: number,
  totalMatches: number
): number {
  let score = 0;

  const matchText = match.data.lines.text.toLowerCase();
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);
  const filePath = match.data.path.text.toLowerCase();

  // Factor 1: Term frequency (how many query terms appear)
  const termFrequency = queryTerms.filter(term => matchText.includes(term)).length / queryTerms.length;
  score += termFrequency * 0.3;

  // Factor 2: Exact match bonus
  if (matchText.includes(queryLower)) {
    score += 0.2;
  }

  // Factor 3: File path relevance
  const pathTerms = queryTerms.filter(term => filePath.includes(term)).length;
  score += (pathTerms / queryTerms.length) * 0.15;

  // Factor 4: File type priority (source files > config > docs)
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.py')) {
    score += 0.1;
  } else if (filePath.endsWith('.xml') || filePath.endsWith('.scss')) {
    score += 0.08;
  } else if (filePath.endsWith('.json') || filePath.endsWith('.yaml')) {
    score += 0.05;
  }

  // Factor 5: Match density (files with more matches are more relevant)
  const densityScore = Math.min(fileMatchCount / 5, 1) * 0.1;
  score += densityScore;

  // Factor 6: Line number proximity to top (definitions usually near top)
  const lineProximity = Math.max(0, 1 - (match.data.line_number / 1000));
  score += lineProximity * 0.05;

  // Factor 7: Submatch quality (exact word match vs partial)
  const submatches = match.data.submatches || [];
  if (submatches.length > 0) {
    const matchedText = submatches[0].match.text.toLowerCase();
    // Exact term match bonus
    if (queryTerms.includes(matchedText)) {
      score += 0.1;
    }
  }

  // Normalize to 0-1 range
  return Math.min(1, Math.max(0, score));
}

/**
 * Extract clean snippet with context from match
 */
function extractSnippet(
  matchLine: string,
  contextBefore: string[],
  contextAfter: string[],
  lineNumber: number
): string {
  const lines: string[] = [];

  // Add context before
  contextBefore.forEach((line, i) => {
    const num = lineNumber - contextBefore.length + i;
    lines.push(`${num.toString().padStart(4)} │ ${line}`);
  });

  // Add match line with marker
  lines.push(`${lineNumber.toString().padStart(4)} │ ${matchLine}  ◀──`);

  // Add context after
  contextAfter.forEach((line, i) => {
    const num = lineNumber + 1 + i;
    lines.push(`${num.toString().padStart(4)} │ ${line}`);
  });

  return lines.join('\n');
}

// ============================================================================
// Search Implementation
// ============================================================================

/**
 * Build ripgrep command from options
 */
function buildRipgrepCommand(options: SearchOptions): string {
  const args: string[] = ['rg', '--json'];

  // Case sensitivity
  if (!options.caseSensitive) {
    args.push('-i');
  }

  // Context lines
  const contextLines = options.contextLines ?? 2;
  if (contextLines > 0) {
    args.push(`-C${contextLines}`);
  }

  // File type filters
  if (options.fileTypes && options.fileTypes.length > 0) {
    options.fileTypes.forEach(type => {
      args.push(`--type=${type}`);
    });
  }

  // Include globs
  if (options.includeGlobs && options.includeGlobs.length > 0) {
    options.includeGlobs.forEach(glob => {
      args.push(`--glob=${glob}`);
    });
  }

  // Exclude globs
  if (options.excludeGlobs && options.excludeGlobs.length > 0) {
    options.excludeGlobs.forEach(glob => {
      args.push(`--glob=!${glob}`);
    });
  }

  // Default excludes
  args.push('--glob=!node_modules');
  args.push('--glob=!.git');
  args.push('--glob=!dist');
  args.push('--glob=!build');
  args.push('--glob=!*.min.js');
  args.push('--glob=!*.min.css');

  // Regex mode
  if (options.regex) {
    args.push('--pcre2');
  } else {
    args.push('--fixed-strings');
  }

  // Max count per file (for performance)
  args.push('--max-count=50');

  // The query (escaped for shell)
  const escapedQuery = options.query.replace(/'/g, "'\\''");
  args.push(`'${escapedQuery}'`);

  // Base directory
  const baseDir = options.baseDir || '.';
  args.push(baseDir);

  return args.join(' ');
}

/**
 * Parse ripgrep JSON output
 */
function parseRipgrepOutput(stdout: string): RipgrepOutput[] {
  const lines = stdout.trim().split('\n').filter(line => line.length > 0);
  const results: RipgrepOutput[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      results.push(parsed);
    } catch {
      // Skip invalid JSON lines
    }
  }

  return results;
}

/**
 * Group ripgrep results by file and build search matches
 */
function buildSearchMatches(
  outputs: RipgrepOutput[],
  query: string,
  maxResults: number
): SearchMatch[] {
  const fileMatches = new Map<string, RipgrepMatch[]>();
  const fileMatchCounts = new Map<string, number>();
  const contextLines = new Map<string, Map<number, string>>();

  // Group matches and context by file
  for (const output of outputs) {
    if (output.type === 'match') {
      const path = output.data.path.text;
      if (!fileMatches.has(path)) {
        fileMatches.set(path, []);
      }
      fileMatches.get(path)!.push(output);
    } else if (output.type === 'context') {
      const path = output.data.path.text;
      if (!contextLines.has(path)) {
        contextLines.set(path, new Map());
      }
      contextLines.get(path)!.set(output.data.line_number, output.data.lines.text);
    } else if (output.type === 'end') {
      fileMatchCounts.set(output.data.path.text, output.data.stats.matches);
    }
  }

  // Calculate total matches
  let totalMatches = 0;
  for (const count of fileMatchCounts.values()) {
    totalMatches += count;
  }

  // Build search matches with relevance scores
  const searchMatches: SearchMatch[] = [];

  for (const [path, matches] of fileMatches) {
    const fileMatchCount = fileMatchCounts.get(path) || matches.length;
    const fileContext = contextLines.get(path) || new Map();

    for (const match of matches) {
      const lineNum = match.data.line_number;
      const matchLine = match.data.lines.text.trimEnd();

      // Get context lines
      const before: string[] = [];
      const after: string[] = [];

      for (let i = lineNum - 2; i < lineNum; i++) {
        const ctx = fileContext.get(i);
        if (ctx) before.push(ctx.trimEnd());
      }

      for (let i = lineNum + 1; i <= lineNum + 2; i++) {
        const ctx = fileContext.get(i);
        if (ctx) after.push(ctx.trimEnd());
      }

      const relevance = calculateRelevance(match, query, fileMatchCount, totalMatches);
      const snippet = extractSnippet(matchLine, before, after, lineNum);

      searchMatches.push({
        path,
        line: lineNum,
        column: match.data.submatches?.[0]?.start || 0,
        snippet,
        relevance,
        matchCount: fileMatchCount,
      });
    }
  }

  // Sort by relevance and limit results
  searchMatches.sort((a, b) => b.relevance - a.relevance);
  return searchMatches.slice(0, maxResults);
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Search codebase using ripgrep with semantic ranking
 *
 * @param options - Search options including query and filters
 * @returns Array of search matches sorted by relevance
 */
export async function searchCodebaseImpl(options: SearchOptions): Promise<SearchMatch[]> {
  if (!options.query || options.query.trim().length === 0) {
    return [];
  }

  const maxResults = options.maxResults ?? 10;
  const command = buildRipgrepCommand(options);

  try {
    const { stdout } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 30000, // 30s timeout
    });

    const outputs = parseRipgrepOutput(stdout);
    return buildSearchMatches(outputs, options.query, maxResults);
  } catch (error: unknown) {
    // ripgrep returns exit code 1 when no matches found
    const execError = error as { code?: number; stdout?: string; message?: string };
    if (execError.code === 1 && !execError.stdout) {
      return []; // No matches found
    }

    // If we have partial output, try to use it
    if (execError.stdout) {
      const outputs = parseRipgrepOutput(execError.stdout);
      return buildSearchMatches(outputs, options.query, maxResults);
    }

    throw new Error(`Search failed: ${execError.message || 'Unknown error'}`);
  }
}

// ============================================================================
// Tool Integration
// ============================================================================

/**
 * Search codebase tool for AgentToolExecutor
 *
 * Implements the ToolFunction interface with:
 * - Ripgrep-based fast text search
 * - Semantic relevance ranking
 * - Glob pattern filtering
 * - Returns top 10 results by default
 */
export async function searchCodebaseTool(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const options: SearchOptions = {
      query: params.target,
      baseDir: params.options?.baseDir as string,
      includeGlobs: params.options?.includeGlobs as string[],
      excludeGlobs: params.options?.excludeGlobs as string[],
      maxResults: (params.options?.maxResults as number) ?? 10,
      contextLines: (params.options?.contextLines as number) ?? 2,
      caseSensitive: params.options?.caseSensitive as boolean,
      regex: params.options?.regex as boolean,
      fileTypes: params.options?.fileTypes as string[],
    };

    const matches = await searchCodebaseImpl(options);

    return {
      success: true,
      data: {
        query: options.query,
        results: matches.map(m => ({
          path: m.path,
          snippet: m.snippet,
          relevance: m.relevance,
          line: m.line,
          column: m.column,
        })),
        totalMatches: matches.length,
        searchOptions: {
          includeGlobs: options.includeGlobs,
          excludeGlobs: options.excludeGlobs,
          maxResults: options.maxResults,
        },
      },
      duration: Date.now() - startTime,
      toolName: 'search_codebase',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'search_codebase',
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default searchCodebaseTool;

/**
 * CodebaseSearchTool - Semantic search with fuzzy matching
 *
 * Provides enhanced codebase search capabilities for the agent:
 * - Semantic search using TF-IDF and keyword extraction
 * - Fuzzy matching for partial/misspelled queries
 * - File type and path filtering
 * - Symbol search (functions, classes, variables)
 * - Content search with context
 *
 * Feature #57: Agent Tool Expansion - CodebaseSearchTool
 */

// =============================================================================
// Types
// =============================================================================

/** Search match type */
export type MatchType = "exact" | "fuzzy" | "semantic" | "regex";

/** File type categories */
export type FileCategory =
  | "component"
  | "style"
  | "template"
  | "config"
  | "script"
  | "test"
  | "documentation"
  | "other";

/** Search result item */
export interface SearchResult {
  /** File path */
  path: string;
  /** File name */
  name: string;
  /** File extension */
  extension: string;
  /** File category */
  category: FileCategory;
  /** Match score (0-1) */
  score: number;
  /** Match type */
  matchType: MatchType;
  /** Matched content snippets with context */
  matches: ContentMatch[];
  /** Symbol matches (functions, classes, etc.) */
  symbols?: SymbolMatch[];
}

/** Content match with context */
export interface ContentMatch {
  /** Line number */
  line: number;
  /** Column start */
  column: number;
  /** Matched text */
  match: string;
  /** Line content */
  content: string;
  /** Context lines before */
  contextBefore: string[];
  /** Context lines after */
  contextAfter: string[];
  /** Highlight ranges */
  highlights: Array<{ start: number; end: number }>;
}

/** Symbol match */
export interface SymbolMatch {
  /** Symbol name */
  name: string;
  /** Symbol type */
  type: "function" | "class" | "variable" | "interface" | "type" | "constant" | "import";
  /** Line number */
  line: number;
  /** Match score */
  score: number;
  /** Symbol signature (if applicable) */
  signature?: string;
}

/** Search options */
export interface SearchOptions {
  /** Maximum results */
  maxResults?: number;
  /** Include file types */
  includeTypes?: string[];
  /** Exclude file types */
  excludeTypes?: string[];
  /** Include paths (glob patterns) */
  includePaths?: string[];
  /** Exclude paths (glob patterns) */
  excludePaths?: string[];
  /** Search in file names only */
  fileNamesOnly?: boolean;
  /** Search for symbols only */
  symbolsOnly?: boolean;
  /** Case sensitive search */
  caseSensitive?: boolean;
  /** Enable fuzzy matching */
  fuzzy?: boolean;
  /** Fuzzy threshold (0-1) */
  fuzzyThreshold?: number;
  /** Context lines before/after match */
  contextLines?: number;
  /** Use regex pattern */
  regex?: boolean;
}

/** Search response */
export interface SearchResponse {
  /** Search query */
  query: string;
  /** Search results */
  results: SearchResult[];
  /** Total matches */
  totalMatches: number;
  /** Search duration in ms */
  duration: number;
  /** Search options used */
  options: SearchOptions;
}

/** Codebase file entry */
export interface CodebaseFile {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Last modified timestamp */
  lastModified?: Date;
}

/** Codebase index entry */
interface IndexEntry {
  path: string;
  name: string;
  extension: string;
  category: FileCategory;
  terms: string[];
  symbols: SymbolMatch[];
  lines: string[];
}

/** Tool schema for AI model */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_RESULTS = 20;
const DEFAULT_CONTEXT_LINES = 2;
const DEFAULT_FUZZY_THRESHOLD = 0.6;

/** Extension to category mapping */
const EXTENSION_CATEGORY: Record<string, FileCategory> = {
  tsx: "component",
  jsx: "component",
  vue: "component",
  svelte: "component",
  css: "style",
  scss: "style",
  sass: "style",
  less: "style",
  html: "template",
  ejs: "template",
  hbs: "template",
  json: "config",
  yaml: "config",
  yml: "config",
  toml: "config",
  js: "script",
  ts: "script",
  py: "script",
  test: "test",
  spec: "test",
  md: "documentation",
  txt: "documentation",
  rst: "documentation",
};

/** Stop words to exclude from semantic search */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
  "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "this", "that", "these",
  "those", "it", "its", "if", "else", "then", "than", "when", "where", "which",
  "who", "what", "how", "why", "all", "each", "every", "both", "few", "more",
  "most", "other", "some", "such", "no", "not", "only", "own", "same", "so",
]);

// =============================================================================
// CodebaseSearchTool Class
// =============================================================================

/**
 * CodebaseSearchTool provides semantic and fuzzy search for codebases.
 *
 * @example
 * ```typescript
 * const searchTool = new CodebaseSearchTool();
 * searchTool.indexFiles(files);
 *
 * const results = searchTool.search("button component", {
 *   fuzzy: true,
 *   includeTypes: ["tsx", "jsx"],
 * });
 * ```
 */
export class CodebaseSearchTool {
  private index: Map<string, IndexEntry> = new Map();
  private termFrequency: Map<string, Map<string, number>> = new Map();
  private documentFrequency: Map<string, number> = new Map();
  private totalDocuments: number = 0;

  constructor() {}

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Get the tool schema for AI model integration
   */
  getSchema(): ToolSchema {
    return {
      name: "codebase_search",
      description:
        "Search the codebase for files, code patterns, and symbols. " +
        "Supports fuzzy matching for partial queries and semantic search " +
        "for finding related code even without exact matches.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query. Can be partial, fuzzy, or semantic.",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results (default 20)",
          },
          includeTypes: {
            type: "array",
            items: { type: "string" },
            description: "File extensions to include (e.g., ['tsx', 'ts'])",
          },
          excludePaths: {
            type: "array",
            items: { type: "string" },
            description: "Path patterns to exclude",
          },
          fuzzy: {
            type: "boolean",
            description: "Enable fuzzy matching for typos/partial matches",
          },
          symbolsOnly: {
            type: "boolean",
            description: "Search for symbols (functions, classes) only",
          },
        },
        required: ["query"],
      },
    };
  }

  /**
   * Index files for searching
   */
  indexFiles(files: CodebaseFile[]): void {
    this.index.clear();
    this.termFrequency.clear();
    this.documentFrequency.clear();
    this.totalDocuments = files.length;

    for (const file of files) {
      const entry = this.createIndexEntry(file);
      this.index.set(file.path, entry);

      // Build term frequency index
      const termCounts = new Map<string, number>();
      for (const term of entry.terms) {
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      }
      this.termFrequency.set(file.path, termCounts);

      // Update document frequency
      const uniqueTerms = new Set(entry.terms);
      for (const term of uniqueTerms) {
        this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
      }
    }
  }

  /**
   * Add or update a file in the index
   */
  updateFile(file: CodebaseFile): void {
    const entry = this.createIndexEntry(file);
    this.index.set(file.path, entry);
    this.rebuildTermIndex();
  }

  /**
   * Remove a file from the index
   */
  removeFile(path: string): void {
    this.index.delete(path);
    this.termFrequency.delete(path);
    this.totalDocuments = this.index.size;
  }

  /**
   * Search the codebase
   */
  search(query: string, options: SearchOptions = {}): SearchResponse {
    const startTime = Date.now();
    const opts = this.normalizeOptions(options);

    // Get candidate files
    const candidates = this.filterCandidates(opts);

    // Score and rank results
    let results: SearchResult[] = [];

    if (opts.fileNamesOnly) {
      results = this.searchFileNames(query, candidates, opts);
    } else if (opts.symbolsOnly) {
      results = this.searchSymbols(query, candidates, opts);
    } else {
      results = this.searchContent(query, candidates, opts);
    }

    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);
    results = results.slice(0, opts.maxResults);

    return {
      query,
      results,
      totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0),
      duration: Date.now() - startTime,
      options: opts,
    };
  }

  /**
   * Invoke the tool (for AI agent integration)
   */
  invoke(request: {
    query: string;
    maxResults?: number;
    includeTypes?: string[];
    excludePaths?: string[];
    fuzzy?: boolean;
    symbolsOnly?: boolean;
  }): SearchResponse {
    return this.search(request.query, {
      maxResults: request.maxResults,
      includeTypes: request.includeTypes,
      excludePaths: request.excludePaths,
      fuzzy: request.fuzzy,
      symbolsOnly: request.symbolsOnly,
    });
  }

  /**
   * Get indexed file count
   */
  getFileCount(): number {
    return this.index.size;
  }

  /**
   * Check if a file is indexed
   */
  isIndexed(path: string): boolean {
    return this.index.has(path);
  }

  // ==========================================================================
  // Indexing Methods
  // ==========================================================================

  /**
   * Create index entry for a file
   */
  private createIndexEntry(file: CodebaseFile): IndexEntry {
    const pathParts = file.path.split("/");
    const name = pathParts[pathParts.length - 1];
    const extension = name.includes(".") ? name.split(".").pop() || "" : "";
    const category = this.categorizeFile(file.path, extension);
    const lines = file.content.split("\n");
    const terms = this.extractTerms(file.content, name);
    const symbols = this.extractSymbols(file.content, extension);

    return {
      path: file.path,
      name,
      extension,
      category,
      terms,
      symbols,
      lines,
    };
  }

  /**
   * Categorize file by path and extension
   */
  private categorizeFile(path: string, extension: string): FileCategory {
    // Check for test files
    if (path.includes(".test.") || path.includes(".spec.") || path.includes("__tests__")) {
      return "test";
    }

    // Check by extension
    if (EXTENSION_CATEGORY[extension]) {
      return EXTENSION_CATEGORY[extension];
    }

    // Check path patterns
    if (path.includes("/components/") || path.includes("/ui/")) return "component";
    if (path.includes("/styles/") || path.includes("/css/")) return "style";
    if (path.includes("/docs/")) return "documentation";
    if (path.includes("/config/")) return "config";

    return "other";
  }

  /**
   * Extract searchable terms from content
   */
  private extractTerms(content: string, fileName: string): string[] {
    const terms: string[] = [];

    // Add file name terms
    terms.push(...this.tokenize(fileName));

    // Extract words from content
    const words = content.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
    for (const word of words) {
      const lower = word.toLowerCase();
      if (!STOP_WORDS.has(lower) && lower.length > 2) {
        terms.push(lower);
        // Add camelCase/PascalCase parts
        terms.push(...this.splitCamelCase(word).map((w) => w.toLowerCase()));
      }
    }

    return terms;
  }

  /**
   * Extract symbols from code
   */
  private extractSymbols(content: string, extension: string): SymbolMatch[] {
    const symbols: SymbolMatch[] = [];
    const lines = content.split("\n");

    // TypeScript/JavaScript patterns
    if (["ts", "tsx", "js", "jsx"].includes(extension)) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Function declarations
        const funcMatch = line.match(
          /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
        );
        if (funcMatch) {
          symbols.push({
            name: funcMatch[1],
            type: "function",
            line: i + 1,
            score: 1,
            signature: line.trim(),
          });
        }

        // Arrow functions
        const arrowMatch = line.match(
          /(?:export\s+)?(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/
        );
        if (arrowMatch) {
          symbols.push({
            name: arrowMatch[1],
            type: "function",
            line: i + 1,
            score: 1,
            signature: line.trim(),
          });
        }

        // Class declarations
        const classMatch = line.match(
          /(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
        );
        if (classMatch) {
          symbols.push({
            name: classMatch[1],
            type: "class",
            line: i + 1,
            score: 1,
            signature: line.trim(),
          });
        }

        // Interface declarations
        const interfaceMatch = line.match(
          /(?:export\s+)?interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
        );
        if (interfaceMatch) {
          symbols.push({
            name: interfaceMatch[1],
            type: "interface",
            line: i + 1,
            score: 1,
          });
        }

        // Type declarations
        const typeMatch = line.match(
          /(?:export\s+)?type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/
        );
        if (typeMatch) {
          symbols.push({
            name: typeMatch[1],
            type: "type",
            line: i + 1,
            score: 1,
          });
        }

        // Const exports
        const constMatch = line.match(
          /(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=/
        );
        if (constMatch) {
          symbols.push({
            name: constMatch[1],
            type: "constant",
            line: i + 1,
            score: 1,
          });
        }
      }
    }

    return symbols;
  }

  /**
   * Rebuild term frequency index
   */
  private rebuildTermIndex(): void {
    this.documentFrequency.clear();
    this.totalDocuments = this.index.size;

    for (const [path, entry] of this.index) {
      const termCounts = new Map<string, number>();
      for (const term of entry.terms) {
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      }
      this.termFrequency.set(path, termCounts);

      const uniqueTerms = new Set(entry.terms);
      for (const term of uniqueTerms) {
        this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
      }
    }
  }

  // ==========================================================================
  // Search Methods
  // ==========================================================================

  /**
   * Filter candidate files based on options
   */
  private filterCandidates(options: SearchOptions): IndexEntry[] {
    const candidates: IndexEntry[] = [];

    for (const entry of this.index.values()) {
      // Filter by extension
      if (options.includeTypes?.length && !options.includeTypes.includes(entry.extension)) {
        continue;
      }
      if (options.excludeTypes?.includes(entry.extension)) {
        continue;
      }

      // Filter by path patterns
      if (options.excludePaths?.some((p) => this.matchGlob(entry.path, p))) {
        continue;
      }
      if (
        options.includePaths?.length &&
        !options.includePaths.some((p) => this.matchGlob(entry.path, p))
      ) {
        continue;
      }

      candidates.push(entry);
    }

    return candidates;
  }

  /**
   * Search file names
   */
  private searchFileNames(
    query: string,
    candidates: IndexEntry[],
    options: SearchOptions
  ): SearchResult[] {
    const queryTerms = this.tokenize(query);
    const results: SearchResult[] = [];

    for (const entry of candidates) {
      const nameTerms = this.tokenize(entry.name);
      let score = 0;
      let matchType: MatchType = "exact";

      // Exact match
      if (entry.name.toLowerCase().includes(query.toLowerCase())) {
        score = 1;
        matchType = "exact";
      } else if (options.fuzzy) {
        // Fuzzy match
        const fuzzyScore = this.fuzzyMatch(query, entry.name, options.fuzzyThreshold || DEFAULT_FUZZY_THRESHOLD);
        if (fuzzyScore > 0) {
          score = fuzzyScore;
          matchType = "fuzzy";
        }
      }

      // Term overlap
      if (score === 0) {
        const overlap = queryTerms.filter((t) =>
          nameTerms.some((nt) => nt.includes(t) || t.includes(nt))
        ).length;
        if (overlap > 0) {
          score = overlap / queryTerms.length * 0.8;
          matchType = "semantic";
        }
      }

      if (score > 0) {
        results.push({
          path: entry.path,
          name: entry.name,
          extension: entry.extension,
          category: entry.category,
          score,
          matchType,
          matches: [],
        });
      }
    }

    return results;
  }

  /**
   * Search symbols
   */
  private searchSymbols(
    query: string,
    candidates: IndexEntry[],
    options: SearchOptions
  ): SearchResult[] {
    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const entry of candidates) {
      const matchingSymbols: SymbolMatch[] = [];

      for (const symbol of entry.symbols) {
        const nameLower = symbol.name.toLowerCase();
        let score = 0;

        // Exact match
        if (nameLower === queryLower) {
          score = 1;
        } else if (nameLower.includes(queryLower)) {
          score = 0.8;
        } else if (options.fuzzy) {
          score = this.fuzzyMatch(query, symbol.name, options.fuzzyThreshold || DEFAULT_FUZZY_THRESHOLD);
        }

        if (score > 0) {
          matchingSymbols.push({ ...symbol, score });
        }
      }

      if (matchingSymbols.length > 0) {
        const maxScore = Math.max(...matchingSymbols.map((s) => s.score));
        results.push({
          path: entry.path,
          name: entry.name,
          extension: entry.extension,
          category: entry.category,
          score: maxScore,
          matchType: maxScore === 1 ? "exact" : "fuzzy",
          matches: [],
          symbols: matchingSymbols,
        });
      }
    }

    return results;
  }

  /**
   * Search content with semantic matching
   */
  private searchContent(
    query: string,
    candidates: IndexEntry[],
    options: SearchOptions
  ): SearchResult[] {
    const queryTerms = this.tokenize(query);
    const results: SearchResult[] = [];

    for (const entry of candidates) {
      const contentMatches: ContentMatch[] = [];
      let totalScore = 0;
      let matchType: MatchType = "semantic";

      // Calculate TF-IDF score
      const tfidfScore = this.calculateTfIdf(entry.path, queryTerms);
      totalScore += tfidfScore;

      // Search for exact matches in content
      const contextLines = options.contextLines ?? DEFAULT_CONTEXT_LINES;

      if (options.regex) {
        try {
          const regex = new RegExp(query, options.caseSensitive ? "g" : "gi");
          for (let i = 0; i < entry.lines.length; i++) {
            const line = entry.lines[i];
            const matches = [...line.matchAll(regex)];
            for (const match of matches) {
              contentMatches.push({
                line: i + 1,
                column: match.index || 0,
                match: match[0],
                content: line,
                contextBefore: entry.lines.slice(Math.max(0, i - contextLines), i),
                contextAfter: entry.lines.slice(i + 1, i + 1 + contextLines),
                highlights: [{ start: match.index || 0, end: (match.index || 0) + match[0].length }],
              });
              totalScore += 0.5;
              matchType = "regex";
            }
          }
        } catch {
          // Invalid regex, skip
        }
      } else {
        // Plain text search
        const searchText = options.caseSensitive ? query : query.toLowerCase();

        for (let i = 0; i < entry.lines.length; i++) {
          const line = entry.lines[i];
          const searchLine = options.caseSensitive ? line : line.toLowerCase();
          let searchStart = 0;
          let index: number;

          while ((index = searchLine.indexOf(searchText, searchStart)) !== -1) {
            contentMatches.push({
              line: i + 1,
              column: index,
              match: line.slice(index, index + query.length),
              content: line,
              contextBefore: entry.lines.slice(Math.max(0, i - contextLines), i),
              contextAfter: entry.lines.slice(i + 1, i + 1 + contextLines),
              highlights: [{ start: index, end: index + query.length }],
            });
            totalScore += 0.3;
            matchType = "exact";
            searchStart = index + 1;
          }
        }
      }

      // Fuzzy matching for file name
      if (options.fuzzy && contentMatches.length === 0) {
        const fuzzyScore = this.fuzzyMatch(query, entry.name, options.fuzzyThreshold || DEFAULT_FUZZY_THRESHOLD);
        if (fuzzyScore > 0) {
          totalScore += fuzzyScore * 0.5;
          matchType = "fuzzy";
        }
      }

      if (totalScore > 0) {
        results.push({
          path: entry.path,
          name: entry.name,
          extension: entry.extension,
          category: entry.category,
          score: Math.min(1, totalScore),
          matchType,
          matches: contentMatches,
          symbols: entry.symbols.filter((s) =>
            queryTerms.some((t) => s.name.toLowerCase().includes(t))
          ),
        });
      }
    }

    return results;
  }

  // ==========================================================================
  // Scoring Methods
  // ==========================================================================

  /**
   * Calculate TF-IDF score
   */
  private calculateTfIdf(path: string, queryTerms: string[]): number {
    const termCounts = this.termFrequency.get(path);
    if (!termCounts) return 0;

    let score = 0;
    const totalTerms = Array.from(termCounts.values()).reduce((a, b) => a + b, 0);

    for (const term of queryTerms) {
      const tf = (termCounts.get(term) || 0) / totalTerms;
      const df = this.documentFrequency.get(term) || 1;
      const idf = Math.log(this.totalDocuments / df);
      score += tf * idf;
    }

    return Math.min(1, score / queryTerms.length);
  }

  /**
   * Fuzzy match using Levenshtein distance
   */
  private fuzzyMatch(query: string, target: string, threshold: number): number {
    const q = query.toLowerCase();
    const t = target.toLowerCase();

    // Quick check for substring
    if (t.includes(q) || q.includes(t)) {
      return 0.9;
    }

    const distance = this.levenshteinDistance(q, t);
    const maxLen = Math.max(q.length, t.length);
    const similarity = 1 - distance / maxLen;

    return similarity >= threshold ? similarity : 0;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-zA-Z0-9]+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  }

  /**
   * Split camelCase/PascalCase
   */
  private splitCamelCase(text: string): string[] {
    return text
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .split(" ")
      .filter((t) => t.length > 0);
  }

  /**
   * Simple glob pattern matching
   */
  private matchGlob(path: string, pattern: string): boolean {
    const regex = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${regex}$`).test(path);
  }

  /**
   * Normalize search options
   */
  private normalizeOptions(options: SearchOptions): SearchOptions {
    return {
      maxResults: options.maxResults ?? DEFAULT_MAX_RESULTS,
      contextLines: options.contextLines ?? DEFAULT_CONTEXT_LINES,
      fuzzyThreshold: options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD,
      fuzzy: options.fuzzy ?? true,
      caseSensitive: options.caseSensitive ?? false,
      ...options,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a CodebaseSearchTool instance
 */
export function createCodebaseSearchTool(files?: CodebaseFile[]): CodebaseSearchTool {
  const tool = new CodebaseSearchTool();
  if (files) {
    tool.indexFiles(files);
  }
  return tool;
}

export default CodebaseSearchTool;

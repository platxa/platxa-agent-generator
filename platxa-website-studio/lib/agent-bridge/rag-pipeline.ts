/**
 * RAG Pipeline — Retrieval-Augmented Generation for Codebase Understanding
 *
 * Indexes project files into searchable chunks with TF-IDF ranking.
 * Queries retrieve relevant code snippets from existing theme files
 * to provide context for AI generation.
 */

// =============================================================================
// Types
// =============================================================================

/** A chunk of indexed source code */
export interface CodeChunk {
  /** Source file path */
  file: string;
  /** Start line (1-based) */
  startLine: number;
  /** End line (1-based) */
  endLine: number;
  /** Raw content */
  content: string;
  /** Detected language */
  language: string;
  /** Odoo snippet ID if detected */
  snippetId?: string;
  /** Normalized tokens for search */
  tokens: string[];
}

/** A search result with relevance score */
export interface RetrievalResult {
  chunk: CodeChunk;
  /** Relevance score (0-1, higher is better) */
  score: number;
  /** Matching tokens that contributed to the score */
  matchedTokens: string[];
}

/** Query result from the RAG pipeline */
export interface RAGQueryResult {
  query: string;
  results: RetrievalResult[];
  totalChunksSearched: number;
  durationMs: number;
}

/** Options for indexing */
export interface IndexOptions {
  /** Max lines per chunk (default 30) */
  chunkSize?: number;
  /** Overlap lines between chunks (default 5) */
  chunkOverlap?: number;
  /** File extensions to index (default: xml, scss, css, py, js, html) */
  extensions?: string[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_EXTENSIONS = ["xml", "scss", "css", "py", "js", "html"];
const DEFAULT_CHUNK_SIZE = 30;
const DEFAULT_CHUNK_OVERLAP = 5;

/** Common stop words to exclude from tokenization */
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "this", "that", "it", "in", "on", "at", "to", "for", "of",
  "and", "or", "not", "with", "from", "by", "as", "if", "else",
  "div", "span", "class", "style", "var", "let", "const", "function",
  "import", "export", "return", "true", "false", "null", "undefined",
]);

// =============================================================================
// Tokenization
// =============================================================================

/**
 * Tokenizes source code into normalized search tokens.
 * Extracts identifiers, CSS classes, snippet IDs, and keywords.
 */
export function tokenize(text: string): string[] {
  // Split camelCase BEFORE lowercasing to preserve boundaries
  const preSplit = text.replace(/([a-z])([A-Z])/g, "$1 $2");

  // Split on non-alphanumeric (keep underscores and hyphens)
  const raw = preSplit
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 1);

  // Also split snake_case/kebab-case
  const expanded: string[] = [];
  for (const token of raw) {
    expanded.push(token);
    const parts = token.split(/[_-]/).filter((s) => s.length > 1);
    if (parts.length > 1) expanded.push(...parts);
  }

  return [...new Set(expanded)].filter((t) => !STOP_WORDS.has(t));
}

/**
 * Detects the language from a file extension.
 */
function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    xml: "xml", html: "html", scss: "scss", css: "css",
    py: "python", js: "javascript", ts: "typescript",
  };
  return map[ext] || "text";
}

/**
 * Detects Odoo snippet ID from content.
 */
function detectSnippetId(content: string): string | undefined {
  const match = content.match(/(?:data-snippet=["']([^"']+)["']|class="[^"]*\b(s_[a-z][a-z0-9_]*)\b)/);
  return match?.[1] || match?.[2];
}

// =============================================================================
// Indexing
// =============================================================================

/**
 * Splits a file into overlapping chunks for indexing.
 */
export function chunkFile(
  content: string,
  file: string,
  options: IndexOptions = {},
): CodeChunk[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    chunkOverlap = DEFAULT_CHUNK_OVERLAP,
  } = options;

  const lines = content.split("\n");
  const language = detectLanguage(file);
  const chunks: CodeChunk[] = [];

  const step = Math.max(1, chunkSize - chunkOverlap);

  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(start + chunkSize, lines.length);
    const chunkContent = lines.slice(start, end).join("\n");

    chunks.push({
      file,
      startLine: start + 1,
      endLine: end,
      content: chunkContent,
      language,
      snippetId: detectSnippetId(chunkContent),
      tokens: tokenize(chunkContent),
    });

    if (end >= lines.length) break;
  }

  return chunks;
}

/**
 * Indexes all project files into searchable chunks.
 */
export function indexProject(
  fileContents: Record<string, string>,
  options: IndexOptions = {},
): CodeChunk[] {
  const extensions = options.extensions || DEFAULT_EXTENSIONS;
  const chunks: CodeChunk[] = [];

  for (const [path, content] of Object.entries(fileContents)) {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    if (!extensions.includes(ext)) continue;
    if (!content.trim()) continue;

    chunks.push(...chunkFile(content, path, options));
  }

  return chunks;
}

// =============================================================================
// Retrieval (TF-IDF inspired scoring)
// =============================================================================

/**
 * Computes relevance score between query tokens and chunk tokens.
 * Uses a simplified TF-IDF approach:
 * - Term frequency: count of matching tokens in chunk / total chunk tokens
 * - Inverse document frequency: penalize very common tokens
 * - Bonus for snippet ID matches and file path matches
 */
function scoreChunk(
  queryTokens: string[],
  chunk: CodeChunk,
  totalChunks: number,
  tokenDocFreq: Map<string, number>,
): { score: number; matchedTokens: string[] } {
  const chunkTokenSet = new Set(chunk.tokens);
  const matchedTokens: string[] = [];
  let score = 0;

  for (const qt of queryTokens) {
    if (chunkTokenSet.has(qt)) {
      matchedTokens.push(qt);

      // TF: how many times in this chunk
      const tf = chunk.tokens.filter((t) => t === qt).length / chunk.tokens.length;

      // IDF: rarer tokens score higher
      const docFreq = tokenDocFreq.get(qt) || 1;
      const idf = Math.log(totalChunks / docFreq);

      score += tf * idf;
    }

    // Partial match bonus (prefix matching)
    for (const ct of chunk.tokens) {
      if (ct !== qt && (ct.startsWith(qt) || qt.startsWith(ct)) && ct.length > 2) {
        score += 0.1;
        if (!matchedTokens.includes(ct)) matchedTokens.push(ct);
      }
    }
  }

  // Snippet ID exact match bonus
  if (chunk.snippetId) {
    for (const qt of queryTokens) {
      if (chunk.snippetId.includes(qt) || qt.includes(chunk.snippetId)) {
        score += 2.0;
      }
    }
  }

  // File path relevance bonus
  const pathTokens = tokenize(chunk.file);
  for (const qt of queryTokens) {
    if (pathTokens.includes(qt)) {
      score += 0.5;
    }
  }

  return { score, matchedTokens };
}

/**
 * Queries the indexed chunks for relevant code.
 * Returns top-K results ranked by relevance score.
 */
export function queryIndex(
  query: string,
  chunks: CodeChunk[],
  topK = 5,
): RAGQueryResult {
  const start = performance.now();
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0 || chunks.length === 0) {
    return {
      query,
      results: [],
      totalChunksSearched: chunks.length,
      durationMs: Math.round(performance.now() - start),
    };
  }

  // Build document frequency map
  const tokenDocFreq = new Map<string, number>();
  for (const chunk of chunks) {
    const unique = new Set(chunk.tokens);
    for (const t of unique) {
      tokenDocFreq.set(t, (tokenDocFreq.get(t) || 0) + 1);
    }
  }

  // Score all chunks
  const scored: RetrievalResult[] = chunks
    .map((chunk) => {
      const { score, matchedTokens } = scoreChunk(
        queryTokens, chunk, chunks.length, tokenDocFreq,
      );
      return { chunk, score, matchedTokens };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    query,
    results: scored,
    totalChunksSearched: chunks.length,
    durationMs: Math.round((performance.now() - start) * 100) / 100,
  };
}

// =============================================================================
// High-level API
// =============================================================================

/**
 * Creates a RAG pipeline instance that can be queried multiple times
 * against the same indexed project.
 */
export function createRAGPipeline(
  fileContents: Record<string, string>,
  options: IndexOptions = {},
) {
  const chunks = indexProject(fileContents, options);

  return {
    /** Number of indexed chunks */
    chunkCount: chunks.length,

    /** Query the index */
    query(queryText: string, topK = 5): RAGQueryResult {
      return queryIndex(queryText, chunks, topK);
    },

    /** Re-index with updated files */
    reindex(newFileContents: Record<string, string>): void {
      const newChunks = indexProject(newFileContents, options);
      chunks.length = 0;
      chunks.push(...newChunks);
    },
  };
}

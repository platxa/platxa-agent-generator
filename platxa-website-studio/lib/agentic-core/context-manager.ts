/**
 * Context Manager - Accumulated knowledge tracking across agent steps
 *
 * Manages agent context that grows with each tool result and persists
 * across iterations. Tracks:
 * - Files read and their contents
 * - Search results from codebase exploration
 * - Tool execution results and metadata
 * - Iteration history for debugging/analysis
 *
 * @module agentic-core/context-manager
 */

import type { AgentContext, AgentPlanStep, ValidationResult } from './agent-engine';
import type { ToolResult } from './tool-executor';

// ============================================================================
// Types
// ============================================================================

/** Knowledge entry from a tool execution */
export interface KnowledgeEntry {
  /** Unique identifier */
  id: string;
  /** Type of knowledge */
  type: 'file' | 'search' | 'validation' | 'tool_output' | 'error' | 'user_input';
  /** Key for retrieval */
  key: string;
  /** The actual data */
  data: unknown;
  /** Source tool that produced this knowledge */
  source: string;
  /** Iteration when this was added */
  iteration: number;
  /** Timestamp of creation */
  createdAt: Date;
  /** Relevance score (0-1) for filtering */
  relevance?: number;
  /** Tags for categorization */
  tags?: string[];
}

/** Iteration snapshot for history tracking */
export interface IterationSnapshot {
  /** Iteration number */
  iteration: number;
  /** Steps executed in this iteration */
  steps: AgentPlanStep[];
  /** Knowledge added during this iteration */
  knowledgeAdded: string[];
  /** Errors encountered */
  errors: string[];
  /** Validation results */
  validationResult?: ValidationResult;
  /** Timestamp */
  timestamp: Date;
}

/** Context statistics */
export interface ContextStats {
  /** Total knowledge entries */
  totalEntries: number;
  /** Entries by type */
  entriesByType: Record<string, number>;
  /** Total files tracked */
  filesCount: number;
  /** Total search results */
  searchResultsCount: number;
  /** Memory usage estimate (bytes) */
  estimatedMemory: number;
  /** Current iteration */
  currentIteration: number;
  /** Total iterations */
  totalIterations: number;
}

/** Options for context manager */
export interface ContextManagerOptions {
  /** Maximum entries to keep (for memory management) */
  maxEntries?: number;
  /** Maximum file content size to store */
  maxFileSize?: number;
  /** Enable iteration history tracking */
  trackHistory?: boolean;
  /** Workspace root for relative path resolution */
  workspaceRoot?: string;
  /** Weight for recency in relevance scoring (0-1, default 0.4) */
  recencyWeight?: number;
  /** Weight for semantic similarity in relevance scoring (0-1, default 0.6) */
  semanticWeight?: number;
  /** Half-life for recency decay in milliseconds (default 5 minutes) */
  recencyHalfLife?: number;
}

/** Options for relevance-based retrieval */
export interface RelevanceQueryOptions {
  /** Query string for semantic similarity matching */
  query?: string;
  /** Filter by knowledge type */
  type?: KnowledgeEntry['type'];
  /** Maximum number of results */
  limit?: number;
  /** Minimum relevance score (0-1) */
  minRelevance?: number;
  /** Filter by tags */
  tags?: string[];
  /** Boost recency over semantic similarity (0-1, default uses manager settings) */
  recencyBoost?: number;
}

/** Result of relevance ranking */
export interface RankedKnowledgeEntry extends KnowledgeEntry {
  /** Computed relevance score (0-1) */
  relevanceScore: number;
  /** Breakdown of score components */
  scoreBreakdown: {
    recency: number;
    semantic: number;
    combined: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Common stop words to filter from tokenization */
const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for',
  'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but',
  'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an',
  'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so',
  'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'is',
  'are', 'was', 'were', 'been', 'being', 'has', 'had', 'does', 'did',
  'can', 'could', 'should', 'may', 'might', 'must', 'shall', 'will',
]);

// ============================================================================
// Context Manager Class
// ============================================================================

/**
 * ContextManager - Tracks accumulated knowledge across agent steps
 *
 * @example
 * ```typescript
 * const manager = new ContextManager({ workspaceRoot: '/project' });
 *
 * // Initialize from existing context
 * manager.initializeFrom(existingAgentContext);
 *
 * // Add knowledge from tool results
 * manager.addToolResult('read', toolResult, iteration);
 * manager.addFileContent('src/main.ts', content, iteration);
 * manager.addSearchResults('query', results, iteration);
 *
 * // Context grows with each addition
 * const stats = manager.getStats();
 * console.log(`Total entries: ${stats.totalEntries}`);
 *
 * // Export to AgentContext for agent execution
 * const context = manager.toAgentContext();
 * ```
 */
export class ContextManager {
  private knowledge: Map<string, KnowledgeEntry>;
  private filesRead: Map<string, string>;
  private searchResults: Map<string, unknown[]>;
  private iterationHistory: IterationSnapshot[];
  private currentIteration: number;
  private options: Required<ContextManagerOptions>;
  /** Cache for tokenized content (for semantic similarity) */
  private tokenCache: Map<string, string[]>;
  private userPreferences: Record<string, unknown>;
  private odooContext: AgentContext['odooContext'];
  private designTokens: Record<string, unknown>;
  private planMode: boolean;

  constructor(options: ContextManagerOptions = {}) {
    this.options = {
      maxEntries: options.maxEntries ?? 1000,
      maxFileSize: options.maxFileSize ?? 1024 * 1024, // 1MB default
      trackHistory: options.trackHistory ?? true,
      workspaceRoot: options.workspaceRoot ?? process.cwd(),
      recencyWeight: options.recencyWeight ?? 0.4,
      semanticWeight: options.semanticWeight ?? 0.6,
      recencyHalfLife: options.recencyHalfLife ?? 5 * 60 * 1000, // 5 minutes
    };

    this.knowledge = new Map();
    this.filesRead = new Map();
    this.searchResults = new Map();
    this.iterationHistory = [];
    this.currentIteration = 0;
    this.userPreferences = {};
    this.odooContext = {};
    this.designTokens = {};
    this.planMode = false;
    this.tokenCache = new Map();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize from an existing AgentContext
   */
  initializeFrom(context: Partial<AgentContext>): void {
    if (context.filesRead) {
      for (const [path, content] of context.filesRead) {
        this.filesRead.set(path, content);
        this.addKnowledgeEntry({
          type: 'file',
          key: path,
          data: content,
          source: 'initialization',
        });
      }
    }

    if (context.searchResults) {
      for (const [query, results] of context.searchResults) {
        this.searchResults.set(query, results);
        this.addKnowledgeEntry({
          type: 'search',
          key: query,
          data: results,
          source: 'initialization',
        });
      }
    }

    if (context.userPreferences) {
      this.userPreferences = { ...context.userPreferences };
    }

    if (context.odooContext) {
      this.odooContext = { ...context.odooContext };
    }

    if (context.designTokens) {
      this.designTokens = { ...context.designTokens };
    }

    if (context.planMode !== undefined) {
      this.planMode = context.planMode;
    }
  }

  /**
   * Reset context to initial state
   */
  reset(): void {
    this.knowledge.clear();
    this.filesRead.clear();
    this.searchResults.clear();
    this.iterationHistory = [];
    this.currentIteration = 0;
    this.userPreferences = {};
    this.odooContext = {};
    this.designTokens = {};
    this.tokenCache.clear();
  }

  // ==========================================================================
  // Knowledge Management
  // ==========================================================================

  /**
   * Add a tool result to the knowledge base
   */
  addToolResult(
    action: string,
    result: ToolResult,
    iteration?: number
  ): string {
    const iter = iteration ?? this.currentIteration;
    const entryId = this.generateId();

    // Handle specific tool types
    if (action === 'read' && result.success && result.data) {
      const data = result.data as { path?: string; content?: string };
      if (data.path && data.content) {
        this.addFileContent(data.path, data.content, iter);
      }
    }

    if (action === 'search' && result.success && result.data) {
      const data = result.data as { query?: string; results?: unknown[] };
      if (data.query && data.results) {
        this.addSearchResults(data.query, data.results, iter);
      }
    }

    // Add general tool output
    this.addKnowledgeEntry({
      type: 'tool_output',
      key: `${action}_${entryId}`,
      data: result,
      source: action,
      tags: [action, result.success ? 'success' : 'failure'],
    }, iter);

    return entryId;
  }

  /**
   * Add file content to the context
   */
  addFileContent(
    path: string,
    content: string,
    iteration?: number
  ): void {
    const iter = iteration ?? this.currentIteration;

    // Truncate if too large
    const truncatedContent = content.length > this.options.maxFileSize
      ? content.substring(0, this.options.maxFileSize) + '\n... [truncated]'
      : content;

    this.filesRead.set(path, truncatedContent);

    this.addKnowledgeEntry({
      type: 'file',
      key: path,
      data: truncatedContent,
      source: 'read_file',
      tags: ['file', this.getFileExtension(path)],
    }, iter);
  }

  /**
   * Add search results to the context
   */
  addSearchResults(
    query: string,
    results: unknown[],
    iteration?: number
  ): void {
    const iter = iteration ?? this.currentIteration;

    // Merge with existing results for same query
    const existing = this.searchResults.get(query) || [];
    const merged = [...existing, ...results];
    this.searchResults.set(query, merged);

    this.addKnowledgeEntry({
      type: 'search',
      key: query,
      data: results,
      source: 'search_codebase',
      tags: ['search'],
    }, iter);
  }

  /**
   * Add validation results
   */
  addValidationResult(
    result: ValidationResult,
    iteration?: number
  ): void {
    const iter = iteration ?? this.currentIteration;

    this.addKnowledgeEntry({
      type: 'validation',
      key: `validation_${iter}`,
      data: result,
      source: 'validation_engine',
      tags: ['validation', result.passed ? 'passed' : 'failed'],
    }, iter);
  }

  /**
   * Add error information
   */
  addError(
    errorMessage: string,
    source: string,
    iteration?: number
  ): void {
    const iter = iteration ?? this.currentIteration;

    this.addKnowledgeEntry({
      type: 'error',
      key: `error_${this.generateId()}`,
      data: { message: errorMessage, source },
      source,
      tags: ['error'],
    }, iter);
  }

  /**
   * Add user input/preference
   */
  addUserInput(
    key: string,
    value: unknown,
    iteration?: number
  ): void {
    const iter = iteration ?? this.currentIteration;
    this.userPreferences[key] = value;

    this.addKnowledgeEntry({
      type: 'user_input',
      key,
      data: value,
      source: 'user',
      tags: ['user_input'],
    }, iter);
  }

  /**
   * Internal method to add knowledge entry
   */
  private addKnowledgeEntry(
    entry: Omit<KnowledgeEntry, 'id' | 'iteration' | 'createdAt'>,
    iteration?: number
  ): string {
    const id = this.generateId();
    const iter = iteration ?? this.currentIteration;

    const fullEntry: KnowledgeEntry = {
      ...entry,
      id,
      iteration: iter,
      createdAt: new Date(),
    };

    // Enforce max entries limit
    if (this.knowledge.size >= this.options.maxEntries) {
      this.pruneOldEntries();
    }

    this.knowledge.set(id, fullEntry);
    return id;
  }

  // ==========================================================================
  // Iteration Management
  // ==========================================================================

  /**
   * Start a new iteration
   */
  startIteration(): number {
    this.currentIteration++;
    return this.currentIteration;
  }

  /**
   * Complete the current iteration with a snapshot
   */
  completeIteration(
    steps: AgentPlanStep[],
    errors: string[] = [],
    validationResult?: ValidationResult
  ): void {
    if (!this.options.trackHistory) return;

    const knowledgeAdded = Array.from(this.knowledge.values())
      .filter(e => e.iteration === this.currentIteration)
      .map(e => e.id);

    const snapshot: IterationSnapshot = {
      iteration: this.currentIteration,
      steps: [...steps],
      knowledgeAdded,
      errors,
      validationResult,
      timestamp: new Date(),
    };

    this.iterationHistory.push(snapshot);
  }

  /**
   * Get current iteration number
   */
  getCurrentIteration(): number {
    return this.currentIteration;
  }

  /**
   * Get iteration history
   */
  getIterationHistory(): IterationSnapshot[] {
    return [...this.iterationHistory];
  }

  // ==========================================================================
  // Knowledge Retrieval
  // ==========================================================================

  /**
   * Get file content by path
   */
  getFileContent(path: string): string | undefined {
    return this.filesRead.get(path);
  }

  /**
   * Get search results by query
   */
  getSearchResults(query: string): unknown[] | undefined {
    return this.searchResults.get(query);
  }

  /**
   * Get all knowledge entries of a specific type
   */
  getKnowledgeByType(type: KnowledgeEntry['type']): KnowledgeEntry[] {
    return Array.from(this.knowledge.values()).filter(e => e.type === type);
  }

  /**
   * Get knowledge entries from a specific iteration
   */
  getKnowledgeByIteration(iteration: number): KnowledgeEntry[] {
    return Array.from(this.knowledge.values()).filter(e => e.iteration === iteration);
  }

  /**
   * Get all knowledge entries
   */
  getAllKnowledge(): KnowledgeEntry[] {
    return Array.from(this.knowledge.values());
  }

  /**
   * Check if a file has been read
   */
  hasFile(path: string): boolean {
    return this.filesRead.has(path);
  }

  /**
   * Get all read file paths
   */
  getReadFilePaths(): string[] {
    return Array.from(this.filesRead.keys());
  }

  // ==========================================================================
  // Relevance Ranking
  // ==========================================================================

  /**
   * Get knowledge entries ranked by relevance
   *
   * Relevance scoring combines:
   * - Recency: More recent items score higher (exponential decay)
   * - Semantic similarity: Items matching the query score higher
   *
   * @example
   * ```typescript
   * // Get most relevant files for a query
   * const ranked = manager.getByRelevance({
   *   query: 'authentication login',
   *   type: 'file',
   *   limit: 10,
   * });
   *
   * // Get recent items with high relevance
   * const recent = manager.getByRelevance({
   *   minRelevance: 0.5,
   *   recencyBoost: 0.8,
   * });
   * ```
   */
  getByRelevance(options: RelevanceQueryOptions = {}): RankedKnowledgeEntry[] {
    const {
      query,
      type,
      limit,
      minRelevance = 0,
      tags,
      recencyBoost,
    } = options;

    const now = Date.now();
    const queryTokens = query ? this.tokenize(query) : [];

    // Calculate effective weights
    const recencyWeight = recencyBoost ?? this.options.recencyWeight;
    const semanticWeight = 1 - recencyWeight;

    // Score and rank all entries
    const ranked: RankedKnowledgeEntry[] = [];

    for (const entry of this.knowledge.values()) {
      // Apply type filter
      if (type && entry.type !== type) continue;

      // Apply tag filter
      if (tags && tags.length > 0) {
        const entryTags = entry.tags || [];
        if (!tags.some(t => entryTags.includes(t))) continue;
      }

      // Calculate recency score (exponential decay)
      const recencyScore = this.calculateRecencyScore(entry.createdAt, now);

      // Calculate semantic similarity score
      const semanticScore = queryTokens.length > 0
        ? this.calculateSemanticSimilarity(entry, queryTokens)
        : 0.5; // Neutral score if no query

      // Combined weighted score
      const combined = (recencyWeight * recencyScore) + (semanticWeight * semanticScore);

      // Apply minimum relevance filter
      if (combined < minRelevance) continue;

      ranked.push({
        ...entry,
        relevanceScore: combined,
        scoreBreakdown: {
          recency: recencyScore,
          semantic: semanticScore,
          combined,
        },
      });
    }

    // Sort by relevance (highest first)
    ranked.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply limit
    if (limit && limit > 0) {
      return ranked.slice(0, limit);
    }

    return ranked;
  }

  /**
   * Calculate recency score using exponential decay
   *
   * Score = 2^(-age / halfLife)
   * - At age 0: score = 1.0
   * - At age = halfLife: score = 0.5
   * - At age = 2*halfLife: score = 0.25
   */
  private calculateRecencyScore(createdAt: Date, now: number): number {
    const age = now - createdAt.getTime();
    const halfLife = this.options.recencyHalfLife;
    return Math.pow(2, -age / halfLife);
  }

  /**
   * Calculate semantic similarity between entry and query tokens
   *
   * Uses a combination of:
   * - Jaccard similarity on tokens
   * - Prefix/substring matching for partial matches
   */
  private calculateSemanticSimilarity(
    entry: KnowledgeEntry,
    queryTokens: string[]
  ): number {
    // Get or compute tokens for this entry
    const entryTokens = this.getEntryTokens(entry);

    if (entryTokens.length === 0 || queryTokens.length === 0) {
      return 0;
    }

    // Calculate Jaccard-like similarity with partial matching
    let matchScore = 0;
    const querySet = new Set(queryTokens);
    const entrySet = new Set(entryTokens);

    for (const queryToken of querySet) {
      // Exact match
      if (entrySet.has(queryToken)) {
        matchScore += 1.0;
        continue;
      }

      // Partial match (prefix or substring)
      let bestPartialScore = 0;
      for (const entryToken of entrySet) {
        if (entryToken.startsWith(queryToken) || queryToken.startsWith(entryToken)) {
          // Prefix match: score based on overlap ratio
          const shorter = Math.min(queryToken.length, entryToken.length);
          const longer = Math.max(queryToken.length, entryToken.length);
          bestPartialScore = Math.max(bestPartialScore, shorter / longer * 0.8);
        } else if (entryToken.includes(queryToken) || queryToken.includes(entryToken)) {
          // Substring match: lower score
          bestPartialScore = Math.max(bestPartialScore, 0.5);
        }
      }
      matchScore += bestPartialScore;
    }

    // Normalize by query size and apply diminishing returns
    const normalizedScore = matchScore / queryTokens.length;

    // Apply sigmoid-like transformation for smoother scoring
    return Math.min(1, normalizedScore);
  }

  /**
   * Get tokens for an entry (cached)
   */
  private getEntryTokens(entry: KnowledgeEntry): string[] {
    const cached = this.tokenCache.get(entry.id);
    if (cached) return cached;

    // Build text to tokenize from entry
    const textParts: string[] = [entry.key];

    if (entry.tags) {
      textParts.push(...entry.tags);
    }

    // Add data content for certain types
    if (entry.type === 'file' && typeof entry.data === 'string') {
      // For files, tokenize a portion of content
      textParts.push(entry.data.substring(0, 1000));
    } else if (entry.type === 'search' && typeof entry.key === 'string') {
      // Search queries are already the key
    } else if (entry.data && typeof entry.data === 'object') {
      // Extract string values from object data
      const dataStr = JSON.stringify(entry.data);
      textParts.push(dataStr.substring(0, 500));
    }

    const tokens = this.tokenize(textParts.join(' '));
    this.tokenCache.set(entry.id, tokens);
    return tokens;
  }

  /**
   * Tokenize text into normalized tokens
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      // Split on non-alphanumeric characters
      .split(/[^a-z0-9]+/)
      // Filter empty and very short tokens
      .filter(t => t.length >= 2)
      // Remove common stop words
      .filter(t => !STOP_WORDS.has(t));
  }

  /**
   * Update relevance score for an entry manually
   */
  setRelevance(entryId: string, relevance: number): boolean {
    const entry = this.knowledge.get(entryId);
    if (!entry) return false;

    entry.relevance = Math.max(0, Math.min(1, relevance));
    return true;
  }

  /**
   * Get the most relevant entry for a query
   */
  getMostRelevant(query: string, type?: KnowledgeEntry['type']): RankedKnowledgeEntry | undefined {
    const results = this.getByRelevance({ query, type, limit: 1 });
    return results[0];
  }

  /**
   * Get recent entries (convenience method using recency-heavy ranking)
   */
  getRecent(limit: number = 10, type?: KnowledgeEntry['type']): RankedKnowledgeEntry[] {
    return this.getByRelevance({
      type,
      limit,
      recencyBoost: 0.95, // Almost purely recency-based
    });
  }

  // ==========================================================================
  // Context Export
  // ==========================================================================

  /**
   * Export to AgentContext for agent execution
   */
  toAgentContext(): AgentContext {
    return {
      filesRead: new Map(this.filesRead),
      searchResults: new Map(this.searchResults),
      userPreferences: { ...this.userPreferences },
      odooContext: { ...this.odooContext },
      designTokens: { ...this.designTokens },
      planMode: this.planMode,
    };
  }

  /**
   * Set plan mode
   */
  setPlanMode(enabled: boolean): void {
    this.planMode = enabled;
  }

  /**
   * Get plan mode status
   */
  getPlanMode(): boolean {
    return this.planMode;
  }

  /**
   * Update Odoo context
   */
  updateOdooContext(update: Partial<AgentContext['odooContext']>): void {
    this.odooContext = { ...this.odooContext, ...update };
  }

  /**
   * Update design tokens
   */
  updateDesignTokens(tokens: Record<string, unknown>): void {
    this.designTokens = { ...this.designTokens, ...tokens };
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get context statistics
   */
  getStats(): ContextStats {
    const entriesByType: Record<string, number> = {};

    for (const entry of this.knowledge.values()) {
      entriesByType[entry.type] = (entriesByType[entry.type] || 0) + 1;
    }

    // Estimate memory usage
    let estimatedMemory = 0;
    for (const content of this.filesRead.values()) {
      estimatedMemory += content.length * 2; // UTF-16
    }
    estimatedMemory += JSON.stringify(Array.from(this.searchResults.values())).length;

    return {
      totalEntries: this.knowledge.size,
      entriesByType,
      filesCount: this.filesRead.size,
      searchResultsCount: this.searchResults.size,
      estimatedMemory,
      currentIteration: this.currentIteration,
      totalIterations: this.iterationHistory.length,
    };
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get file extension from path
   */
  private getFileExtension(path: string): string {
    const match = path.match(/\.([^.]+)$/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Prune old entries when limit is reached
   */
  private pruneOldEntries(): void {
    const entries = Array.from(this.knowledge.entries())
      .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());

    // Remove oldest 10%
    const toRemove = Math.floor(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.knowledge.delete(entries[i][0]);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ContextManager instance
 */
export function createContextManager(options?: ContextManagerOptions): ContextManager {
  return new ContextManager(options);
}

/**
 * Create ContextManager from existing AgentContext
 */
export function createContextManagerFrom(
  context: Partial<AgentContext>,
  options?: ContextManagerOptions
): ContextManager {
  const manager = new ContextManager(options);
  manager.initializeFrom(context);
  return manager;
}

// ============================================================================
// Exports
// ============================================================================

export default ContextManager;

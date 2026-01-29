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
}

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

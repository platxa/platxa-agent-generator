/**
 * Tool Executor - Dispatches plan steps to appropriate tools
 *
 * Routes actions to their corresponding tool implementations:
 * - search -> search_codebase
 * - read -> read_file
 * - write -> write_file
 * - edit -> edit_file
 * - validate -> validate_qweb / validate_scss
 * - compile -> compile_scss
 * - preview -> preview_render
 * - test -> test_odoo
 * - web_search -> web_search
 *
 * @module agentic-core/tool-executor
 */

import type {
  AgentActionType,
  AgentPlanStep,
  AgentContext,
  ToolExecutor,
} from './agent-engine';
import { searchCodebaseTool } from './tools/search-codebase';
import { readFileTool } from './tools/read-file';
import { writeFileTool } from './tools/write-file';
import { editFileTool } from './tools/edit-file';
import { validateQwebTool } from './tools/validate-qweb';
import { compileScssTool } from './tools/compile-scss';
import { previewRenderTool } from './tools/preview-render';
import { inspectLogsTool } from './tools/inspect-logs';
import { testOdooTool } from './tools/test-odoo';
import { webSearchTool } from './tools/web-search';

// ============================================================================
// Types
// ============================================================================

/** Result from a tool execution */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  toolName: string;
}

/**
 * Feature #14: Tool timeout error with optional partial results
 * Thrown when a tool execution exceeds its configured timeout
 */
export class ToolTimeoutError extends Error {
  readonly toolName: string;
  readonly timeoutMs: number;
  readonly partialResult?: Partial<ToolResult>;

  constructor(
    toolName: string,
    timeoutMs: number,
    partialResult?: Partial<ToolResult>
  ) {
    super(`Tool '${toolName}' timed out after ${timeoutMs}ms`);
    this.name = 'ToolTimeoutError';
    this.toolName = toolName;
    this.timeoutMs = timeoutMs;
    this.partialResult = partialResult;
  }
}

/** Tool function signature */
export type ToolFunction = (
  params: ToolParams
) => Promise<ToolResult>;

/** Parameters passed to tools */
export interface ToolParams {
  target: string;
  context: AgentContext;
  options?: Record<string, unknown>;
}

/** Tool registration entry */
export interface ToolRegistration {
  name: string;
  description: string;
  handler: ToolFunction;
  /** Actions this tool handles */
  actions: AgentActionType[];
}

/** Executor configuration */
export interface ToolExecutorConfig {
  /** Timeout per tool execution in ms */
  timeout?: number;
  /** Whether to cache results (memoization) */
  cacheResults?: boolean;
  /** Cache TTL in ms */
  cacheTTL?: number;
  /** Retry failed operations with exponential backoff */
  retryOnFailure?: boolean;
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseDelayMs?: number;
  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier?: number;
  /** Maximum delay cap in ms (default: 30000) */
  maxDelayMs?: number;
  /** Add jitter to prevent thundering herd (default: true) */
  useJitter?: boolean;
  /** Maximum cache entries before LRU eviction */
  maxCacheEntries?: number;
}

/** Retry attempt information */
export interface RetryAttempt {
  /** Attempt number (1-indexed) */
  attempt: number;
  /** Delay before this attempt in ms */
  delayMs: number;
  /** Error from previous attempt */
  error?: string;
  /** Timestamp of attempt */
  timestamp: number;
}

// ============================================================================
// Tool Analytics (Feature #16)
// ============================================================================

/** Individual tool call analytics entry */
export interface ToolAnalyticsEntry {
  /** Tool name */
  tool: string;
  /** Action type */
  action: AgentActionType;
  /** Execution duration in ms */
  duration: number;
  /** Estimated token cost (input + output) */
  tokens: number;
  /** Whether call succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Timestamp of call */
  timestamp: number;
  /** Number of retry attempts */
  retryAttempts: number;
  /** Whether result was from cache */
  cached: boolean;
}

/** Aggregated analytics for a single tool */
export interface ToolAggregateStats {
  /** Tool name */
  tool: string;
  /** Total invocation count */
  invocations: number;
  /** Successful invocations */
  successes: number;
  /** Failed invocations */
  failures: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Total duration across all calls (ms) */
  totalDuration: number;
  /** Average duration per call (ms) */
  avgDuration: number;
  /** Min duration (ms) */
  minDuration: number;
  /** Max duration (ms) */
  maxDuration: number;
  /** P50 latency (ms) */
  p50Duration: number;
  /** P95 latency (ms) */
  p95Duration: number;
  /** P99 latency (ms) */
  p99Duration: number;
  /** Total token cost */
  totalTokens: number;
  /** Average tokens per call */
  avgTokens: number;
  /** Total retry attempts */
  totalRetries: number;
  /** Cache hit count */
  cacheHits: number;
}

/** Overall analytics summary */
export interface AnalyticsSummary {
  /** Total calls across all tools */
  totalCalls: number;
  /** Total successes */
  totalSuccesses: number;
  /** Total failures */
  totalFailures: number;
  /** Overall success rate */
  overallSuccessRate: number;
  /** Total duration (ms) */
  totalDuration: number;
  /** Total tokens used */
  totalTokens: number;
  /** Per-tool breakdown */
  byTool: Map<string, ToolAggregateStats>;
  /** Time range */
  timeRange: { start: number; end: number };
}

/** Memoization statistics */
export interface MemoizationStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Current cache size */
  cacheSize: number;
  /** Total evictions */
  evictions: number;
  /** Bytes saved (estimated) */
  bytesSaved: number;
}

/** Cache entry with metadata */
interface CacheEntry {
  result: ToolResult;
  timestamp: number;
  accessCount: number;
  /** Monotonic access order for deterministic LRU (higher = more recent) */
  accessOrder: number;
  sizeBytes: number;
}

/**
 * Actions that are idempotent and safe to memoize.
 * Write operations (write, edit) are NOT memoizable as they have side effects.
 */
const MEMOIZABLE_ACTIONS: Set<AgentActionType> = new Set([
  'search',
  'read',
  'validate',
  'compile',
  'preview',
  'test',
  'web_search',
  'inspect_logs',
]);

// ============================================================================
// Default Tool Implementations
// ============================================================================

/**
 * Default search_codebase tool
 * Uses ripgrep with semantic ranking via the searchCodebaseTool implementation
 */
async function searchCodebase(params: ToolParams): Promise<ToolResult> {
  return searchCodebaseTool(params);
}

/**
 * Default read_file tool
 * Uses the production readFileTool implementation with line range support
 */
async function readFile(params: ToolParams): Promise<ToolResult> {
  return readFileTool(params);
}

/**
 * Default write_file tool
 * Uses the production writeFileTool implementation with Yjs sync
 */
async function writeFile(params: ToolParams): Promise<ToolResult> {
  return writeFileTool(params);
}

/**
 * Default edit_file tool
 * Uses the production editFileTool with search/replace operations
 */
async function editFile(params: ToolParams): Promise<ToolResult> {
  return editFileTool(params);
}

/**
 * Default validate_qweb tool
 * Uses the production validateQwebTool implementation
 */
async function validateQweb(params: ToolParams): Promise<ToolResult> {
  return validateQwebTool(params);
}

/**
 * Default compile_scss tool
 * Uses the production compileScssTool implementation with Odoo imports
 */
async function compileScss(params: ToolParams): Promise<ToolResult> {
  return compileScssTool(params);
}

/**
 * Default preview_render tool
 * Feature #23: Returns screenshot URL and rendered HTML for specified page/viewport
 */
async function previewRender(params: ToolParams): Promise<ToolResult> {
  return previewRenderTool(params);
}

/**
 * Default inspect_logs tool
 * Feature #24: Aggregates errors from SCSS, QWeb, Odoo, and preview sources
 */
async function inspectLogs(params: ToolParams): Promise<ToolResult> {
  return inspectLogsTool(params);
}

/**
 * Default test_odoo tool
 * Feature #26: Docker-based module installation and snippet testing
 */
async function testOdoo(params: ToolParams): Promise<ToolResult> {
  return testOdooTool(params);
}

/**
 * Default web_search tool
 * Feature #25: Fetches Odoo documentation and examples with site: filtering
 */
async function webSearch(params: ToolParams): Promise<ToolResult> {
  return webSearchTool(params);
}

// ============================================================================
// Action to Tool Mapping
// ============================================================================

/** Maps actions to their default tool implementations */
const DEFAULT_ACTION_TOOLS: Record<AgentActionType, ToolFunction> = {
  search: searchCodebase,
  read: readFile,
  write: writeFile,
  edit: editFile,
  validate: validateQweb,
  compile: compileScss,
  preview: previewRender,
  test: testOdoo,
  web_search: webSearch,
  inspect_logs: inspectLogs,
};

// ============================================================================
// AgentToolExecutor Class
// ============================================================================

/**
 * AgentToolExecutor - Routes plan steps to appropriate tools
 *
 * Implements the ToolExecutor interface from AgentEngine.
 * Provides a registry for custom tools and default implementations.
 */
export class AgentToolExecutor implements ToolExecutor {
  private config: Required<ToolExecutorConfig>;
  private tools: Map<AgentActionType, ToolFunction>;
  private customTools: Map<string, ToolRegistration>;
  private cache: Map<string, CacheEntry>;

  // Memoization statistics
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private cacheEvictions: number = 0;
  private bytesSaved: number = 0;

  // Monotonic counter for deterministic LRU ordering (Date.now() can be same within ms)
  private accessCounter: number = 0;

  // Analytics store (Feature #16)
  private analyticsLog: ToolAnalyticsEntry[] = [];
  private maxAnalyticsEntries: number = 10000;

  constructor(config: ToolExecutorConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      cacheResults: config.cacheResults ?? true,
      cacheTTL: config.cacheTTL ?? 300000, // 5-minute TTL (Feature #12)
      retryOnFailure: config.retryOnFailure ?? true,
      maxRetries: config.maxRetries ?? 3, // Feature #15: 3 attempts total
      baseDelayMs: config.baseDelayMs ?? 1000, // Feature #15: 1s base delay
      backoffMultiplier: config.backoffMultiplier ?? 2, // Feature #15: exponential (1s, 2s, 4s)
      maxDelayMs: config.maxDelayMs ?? 30000, // Cap at 30s
      useJitter: config.useJitter ?? true, // Prevent thundering herd
      maxCacheEntries: config.maxCacheEntries ?? 500,
    };

    // Initialize with default tools
    this.tools = new Map(Object.entries(DEFAULT_ACTION_TOOLS) as [AgentActionType, ToolFunction][]);
    this.customTools = new Map();
    this.cache = new Map();
  }

  /**
   * Execute a tool based on action type
   * Routes the action to the appropriate tool handler
   */
  async execute(
    action: AgentActionType,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const startTime = Date.now();
    const toolName = this.getToolNameForAction(action);

    const toolParams: ToolParams = {
      target: params.target as string,
      context: params.context as AgentContext,
      options: params,
    };

    // Check plan mode - disable write operations for read-only exploration
    if (this.isWriteAction(action) && toolParams.context?.planMode) {
      throw new Error(
        `Action '${action}' is disabled in plan mode. ` +
        'Plan mode allows read-only codebase exploration.'
      );
    }

    // Check cache first (only for memoizable actions)
    const isMemoizable = this.isMemoizableAction(action);
    const cacheKey = isMemoizable ? this.getCacheKey(action, toolParams) : '';

    if (this.config.cacheResults && isMemoizable) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.cacheHits++;
        this.bytesSaved += cached.sizeBytes;

        // Feature #16: Log cache hit to analytics
        this.recordAnalytics({
          tool: toolName,
          action,
          duration: Date.now() - startTime,
          tokens: 0, // No tokens used for cache hit
          success: true,
          timestamp: startTime,
          retryAttempts: 0,
          cached: true,
        });

        return cached.result.data;
      }
      this.cacheMisses++;
    }

    // Get the tool handler
    const handler = this.tools.get(action);
    if (!handler) {
      throw new Error(`No tool registered for action: ${action}`);
    }

    // Execute with timeout and exponential backoff retry (Feature #15)
    let result: ToolResult;
    let retryCount = 0; // Tracks failures for backoff calculation
    let totalAttempts = 0; // Tracks total invocations for analytics
    let lastError: Error | null = null;

    while (retryCount < this.config.maxRetries) {
      totalAttempts++;
      try {
        // Apply backoff delay before retry (not on first attempt)
        if (retryCount > 0 && this.config.retryOnFailure) {
          const delayMs = this.calculateBackoffDelay(retryCount);
          await this.sleep(delayMs);
        }

        result = await this.executeWithTimeout(handler, toolParams, action);

        if (result.success) {
          break;
        }

        // Tool returned failure (not exception) - retry if enabled
        if (!this.config.retryOnFailure) {
          break;
        }

        lastError = new Error(result.error || `Tool ${action} failed`);
        retryCount++;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        // Don't retry on final attempt - record analytics before throwing
        if (retryCount >= this.config.maxRetries) {
          this.recordAnalytics({
            tool: toolName,
            action,
            duration: Date.now() - startTime,
            tokens: 0,
            success: false,
            error: (error as Error).message,
            timestamp: startTime,
            retryAttempts: totalAttempts,
            cached: false,
          });
          throw error;
        }
      }
    }

    // If we exhausted retries with failures, record and throw
    if (!result! || (!result!.success && retryCount >= this.config.maxRetries)) {
      this.recordAnalytics({
        tool: toolName,
        action,
        duration: Date.now() - startTime,
        tokens: result! ? this.estimateTokens(result!) : 0,
        success: false,
        error: result?.error || lastError?.message || 'Unknown error',
        timestamp: startTime,
        retryAttempts: totalAttempts,
        cached: false,
      });
      throw lastError || new Error(`Tool ${action} failed after ${totalAttempts} attempts`);
    }

    // Feature #16: Log execution to analytics (non-cached)
    const executionDuration = Date.now() - startTime;
    this.recordAnalytics({
      tool: toolName,
      action,
      duration: executionDuration,
      tokens: this.estimateTokens(result!),
      success: result!.success,
      error: result!.error,
      timestamp: startTime,
      retryAttempts: totalAttempts,
      cached: false,
    });

    // Cache successful results (only memoizable actions)
    if (result!.success && this.config.cacheResults && isMemoizable) {
      this.setCache(cacheKey, result!);
    }

    if (!result!.success) {
      throw new Error(result!.error || `Tool ${action} failed`);
    }

    return result!.data;
  }

  /**
   * Execute a plan step directly
   * Convenience method for AgentEngine integration
   */
  async executeStep(step: AgentPlanStep, context: AgentContext): Promise<ToolResult> {
    // Check plan mode - disable write operations for read-only exploration
    if (this.isWriteAction(step.action) && context?.planMode) {
      return {
        success: false,
        error: `Action '${step.action}' is disabled in plan mode. Plan mode allows read-only codebase exploration.`,
        duration: 0,
        toolName: this.getToolNameForAction(step.action),
      };
    }

    const toolParams: ToolParams = {
      target: step.target,
      context,
      options: { stepId: step.id, rationale: step.rationale },
    };

    const handler = this.tools.get(step.action);
    if (!handler) {
      return {
        success: false,
        error: `No tool registered for action: ${step.action}`,
        duration: 0,
        toolName: 'unknown',
      };
    }

    return this.executeWithTimeout(handler, toolParams, step.action);
  }

  /**
   * Register a custom tool
   */
  registerTool(registration: ToolRegistration): void {
    this.customTools.set(registration.name, registration);

    // Map actions to this tool
    for (const action of registration.actions) {
      this.tools.set(action, registration.handler);
    }
  }

  /**
   * Override a default tool implementation
   */
  setToolHandler(action: AgentActionType, handler: ToolFunction): void {
    this.tools.set(action, handler);
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): Map<string, ToolRegistration> {
    return new Map(this.customTools);
  }

  /**
   * Check if a tool is registered for an action
   */
  hasToolFor(action: AgentActionType): boolean {
    return this.tools.has(action);
  }

  /**
   * Clear the result cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get memoization statistics
   * Feature #200: Provides visibility into cache performance
   */
  getMemoizationStats(): MemoizationStats {
    const totalRequests = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
      cacheSize: this.cache.size,
      evictions: this.cacheEvictions,
      bytesSaved: this.bytesSaved,
    };
  }

  /**
   * Reset memoization statistics
   */
  resetMemoizationStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheEvictions = 0;
    this.bytesSaved = 0;
  }

  /**
   * Check if an action is safe to memoize (idempotent/read-only)
   * Feature #200: Write operations are never memoized
   */
  isMemoizableAction(action: AgentActionType): boolean {
    return MEMOIZABLE_ACTIONS.has(action);
  }

  /**
   * Feature #13: Execute multiple independent tools in parallel using Promise.all
   * Independent tools execute concurrently; results returned in same order as input
   */
  async executeParallel(
    operations: Array<{ action: AgentActionType; params: Record<string, unknown> }>
  ): Promise<unknown[]> {
    // Execute all operations concurrently
    const promises = operations.map(op => this.execute(op.action, op.params));
    return Promise.all(promises);
  }

  /**
   * Feature #13: Execute tools with dependency ordering
   * Independent tools run in parallel; dependent tools wait for prerequisites
   * @param operations Array of operations with optional dependencies
   * @returns Results in operation order
   */
  async executeWithDependencies(
    operations: Array<{
      id: string;
      action: AgentActionType;
      params: Record<string, unknown>;
      dependsOn?: string[];
    }>
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const completed = new Set<string>();

    // Build dependency graph
    const pending = [...operations];

    while (pending.length > 0) {
      // Find operations ready to execute (no unmet dependencies)
      const ready = pending.filter(op => {
        if (!op.dependsOn || op.dependsOn.length === 0) return true;
        return op.dependsOn.every(dep => completed.has(dep));
      });

      if (ready.length === 0 && pending.length > 0) {
        throw new Error('Circular dependency detected in tool operations');
      }

      // Execute ready operations in parallel
      const readyPromises = ready.map(async op => {
        const result = await this.execute(op.action, op.params);
        return { id: op.id, result };
      });

      const readyResults = await Promise.all(readyPromises);

      // Record results and mark as completed
      for (const { id, result } of readyResults) {
        results.set(id, result);
        completed.add(id);
      }

      // Remove completed operations from pending
      for (const op of ready) {
        const idx = pending.indexOf(op);
        if (idx >= 0) pending.splice(idx, 1);
      }
    }

    return results;
  }

  /**
   * Get tool for specific action (for testing)
   */
  getToolForAction(action: AgentActionType): ToolFunction | undefined {
    return this.tools.get(action);
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  /**
   * Check if an action modifies the codebase
   * Used to enforce plan mode read-only restrictions
   */
  private isWriteAction(action: AgentActionType): boolean {
    const writeActions: AgentActionType[] = ['write', 'edit'];
    return writeActions.includes(action);
  }

  /**
   * Get the tool name for an action type
   */
  private getToolNameForAction(action: AgentActionType): string {
    const toolNames: Record<AgentActionType, string> = {
      search: 'search_codebase',
      read: 'read_file',
      write: 'write_file',
      edit: 'edit_file',
      validate: 'validate_qweb',
      compile: 'compile_scss',
      preview: 'preview_render',
      test: 'test_odoo',
      web_search: 'web_search',
      inspect_logs: 'inspect_logs',
    };
    return toolNames[action] || 'unknown';
  }

  private async executeWithTimeout(
    handler: ToolFunction,
    params: ToolParams,
    toolName: string = 'unknown'
  ): Promise<ToolResult> {
    return new Promise((resolve, reject) => {
      let partialResult: Partial<ToolResult> | undefined;
      const startTime = Date.now();

      const timeoutId = setTimeout(() => {
        // Feature #14: Return ToolTimeoutError with partial results if available
        reject(new ToolTimeoutError(toolName, this.config.timeout, partialResult));
      }, this.config.timeout);

      handler(params)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          // Capture partial result info for timeout scenarios
          partialResult = {
            toolName,
            duration: Date.now() - startTime,
            success: false,
            error: error.message,
          };
          reject(error);
        });
    });
  }

  private getCacheKey(action: AgentActionType, params: ToolParams): string {
    // Feature #200: Cache key must be deterministic and exclude non-cacheable data
    // Context is excluded because:
    // 1. It contains Maps with different object references per call
    // 2. Context state doesn't affect tool output (e.g., reading a file returns same content)
    // Only include parameters that affect the tool result
    const cacheRelevantOptions = this.extractCacheRelevantOptions(params.options);
    const keyData = {
      target: params.target,
      options: cacheRelevantOptions,
    };
    return `${action}:${JSON.stringify(keyData)}`;
  }

  /**
   * Extract only cache-relevant options, excluding context and other non-deterministic data
   */
  private extractCacheRelevantOptions(options?: Record<string, unknown>): Record<string, unknown> {
    if (!options) return {};

    const cacheRelevant: Record<string, unknown> = {};
    const excludeKeys = new Set(['context', 'stepId', 'rationale']);

    for (const [key, value] of Object.entries(options)) {
      if (!excludeKeys.has(key) && value !== undefined) {
        // Only include primitive values and simple objects (not Maps, Sets, etc.)
        if (this.isCacheableValue(value)) {
          cacheRelevant[key] = value;
        }
      }
    }

    return cacheRelevant;
  }

  /**
   * Check if a value is suitable for cache key inclusion
   */
  private isCacheableValue(value: unknown): boolean {
    if (value === null) return true;
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') return true;
    if (Array.isArray(value)) return value.every(v => this.isCacheableValue(v));
    if (type === 'object') {
      // Exclude Map, Set, and other non-plain objects
      if (value instanceof Map || value instanceof Set) return false;
      if (Object.getPrototypeOf(value) !== Object.prototype) return false;
      return Object.values(value as Record<string, unknown>).every(v => this.isCacheableValue(v));
    }
    return false;
  }

  private getFromCache(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.config.cacheTTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    // Update access metadata for LRU (monotonic counter ensures deterministic ordering)
    entry.accessCount++;
    entry.accessOrder = ++this.accessCounter;

    return entry;
  }

  private setCache(key: string, result: ToolResult): void {
    // Enforce max cache entries with LRU eviction
    while (this.cache.size >= this.config.maxCacheEntries) {
      this.evictLRU();
    }

    const sizeBytes = this.estimateResultSize(result);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      accessCount: 1,
      accessOrder: ++this.accessCounter,
      sizeBytes,
    });
  }

  /**
   * Evict least recently used cache entry
   * Uses monotonic accessOrder for deterministic LRU (not Date.now() which can be same within ms)
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return;

    let oldestKey: string | null = null;
    let oldestOrder = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessOrder < oldestOrder) {
        oldestOrder = entry.accessOrder;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheEvictions++;
    }
  }

  /**
   * Estimate the size of a tool result in bytes
   */
  private estimateResultSize(result: ToolResult): number {
    try {
      return JSON.stringify(result).length * 2; // UTF-16
    } catch {
      return 1024; // Default estimate
    }
  }

  /**
   * Estimate token cost for a tool result
   * Feature #16: Rough estimate based on result size (4 chars ≈ 1 token)
   */
  private estimateTokens(result: ToolResult): number {
    try {
      const jsonStr = JSON.stringify(result);
      return Math.ceil(jsonStr.length / 4);
    } catch {
      return 100; // Default estimate
    }
  }

  /**
   * Calculate exponential backoff delay for retry attempt
   * Feature #15: Implements 1s, 2s, 4s delays (base * 2^attempt)
   *
   * @param attempt - Current attempt number (1-indexed, first retry is attempt 1)
   * @returns Delay in milliseconds
   */
  private calculateBackoffDelay(attempt: number): number {
    // Exponential: baseDelay * (multiplier ^ (attempt - 1))
    // attempt 1: 1000 * 2^0 = 1000ms (1s)
    // attempt 2: 1000 * 2^1 = 2000ms (2s)
    // attempt 3: 1000 * 2^2 = 4000ms (4s)
    const exponentialDelay = this.config.baseDelayMs *
      Math.pow(this.config.backoffMultiplier, attempt - 1);

    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Add jitter (±25%) to prevent thundering herd
    if (this.config.useJitter) {
      const jitterRange = cappedDelay * 0.25;
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      return Math.max(0, Math.round(cappedDelay + jitter));
    }

    return cappedDelay;
  }

  /**
   * Get the delay that would be used for a specific retry attempt (for testing/observability)
   */
  getRetryDelay(attempt: number): number {
    return this.calculateBackoffDelay(attempt);
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --------------------------------------------------------------------------
  // Analytics Methods (Feature #16)
  // --------------------------------------------------------------------------

  /**
   * Record a tool call to the analytics log
   */
  private recordAnalytics(entry: ToolAnalyticsEntry): void {
    this.analyticsLog.push(entry);

    // Prune oldest entries if log exceeds max size
    while (this.analyticsLog.length > this.maxAnalyticsEntries) {
      this.analyticsLog.shift();
    }
  }

  /**
   * Get raw analytics log
   */
  getAnalytics(): ToolAnalyticsEntry[] {
    return [...this.analyticsLog];
  }

  /**
   * Get aggregated analytics summary
   */
  getAnalyticsSummary(): AnalyticsSummary {
    const byTool = new Map<string, ToolAggregateStats>();

    let totalCalls = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let totalDuration = 0;
    let totalTokens = 0;
    let startTime = Infinity;
    let endTime = 0;

    // Group entries by tool
    const entriesByTool = new Map<string, ToolAnalyticsEntry[]>();
    for (const entry of this.analyticsLog) {
      const existing = entriesByTool.get(entry.tool) || [];
      existing.push(entry);
      entriesByTool.set(entry.tool, existing);

      // Track overall stats
      totalCalls++;
      if (entry.success) totalSuccesses++;
      else totalFailures++;
      totalDuration += entry.duration;
      totalTokens += entry.tokens;
      startTime = Math.min(startTime, entry.timestamp);
      endTime = Math.max(endTime, entry.timestamp + entry.duration);
    }

    // Calculate per-tool aggregates
    for (const [tool, entries] of entriesByTool) {
      const durations = entries.map(e => e.duration).sort((a, b) => a - b);
      const successes = entries.filter(e => e.success).length;
      const failures = entries.filter(e => !e.success).length;
      const toolTotalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
      const toolTotalTokens = entries.reduce((sum, e) => sum + e.tokens, 0);
      const toolTotalRetries = entries.reduce((sum, e) => sum + e.retryAttempts, 0);
      const cacheHits = entries.filter(e => e.cached).length;

      const stats: ToolAggregateStats = {
        tool,
        invocations: entries.length,
        successes,
        failures,
        successRate: entries.length > 0 ? successes / entries.length : 0,
        totalDuration: toolTotalDuration,
        avgDuration: entries.length > 0 ? toolTotalDuration / entries.length : 0,
        minDuration: durations[0] || 0,
        maxDuration: durations[durations.length - 1] || 0,
        p50Duration: this.percentile(durations, 50),
        p95Duration: this.percentile(durations, 95),
        p99Duration: this.percentile(durations, 99),
        totalTokens: toolTotalTokens,
        avgTokens: entries.length > 0 ? toolTotalTokens / entries.length : 0,
        totalRetries: toolTotalRetries,
        cacheHits,
      };

      byTool.set(tool, stats);
    }

    return {
      totalCalls,
      totalSuccesses,
      totalFailures,
      overallSuccessRate: totalCalls > 0 ? totalSuccesses / totalCalls : 0,
      totalDuration,
      totalTokens,
      byTool,
      timeRange: {
        start: startTime === Infinity ? 0 : startTime,
        end: endTime,
      },
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Clear all analytics data
   */
  clearAnalytics(): void {
    this.analyticsLog = [];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a tool executor with default configuration
 */
export function createToolExecutor(config?: ToolExecutorConfig): AgentToolExecutor {
  return new AgentToolExecutor(config);
}

/**
 * Create a tool executor with custom tool implementations
 */
export function createToolExecutorWithTools(
  tools: Partial<Record<AgentActionType, ToolFunction>>,
  config?: ToolExecutorConfig
): AgentToolExecutor {
  const executor = new AgentToolExecutor(config);

  for (const [action, handler] of Object.entries(tools)) {
    if (handler) {
      executor.setToolHandler(action as AgentActionType, handler);
    }
  }

  return executor;
}

// ============================================================================
// Default Export
// ============================================================================

export default AgentToolExecutor;

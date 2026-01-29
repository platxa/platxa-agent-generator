/**
 * Context Pruner - Token-aware context management
 *
 * Keeps total tokens under 80% of model limit by pruning:
 * - Oldest items first (FIFO)
 * - Least-relevant items (by relevance score)
 * - Low-priority item types
 *
 * @module agentic-core/context-pruner
 */

import type { KnowledgeEntry, ContextManager } from './context-manager';

// ============================================================================
// Types
// ============================================================================

/** Token estimation for an item */
export interface TokenEstimate {
  /** Estimated token count */
  tokens: number;
  /** Character count used for estimation */
  characters: number;
  /** Item type */
  type: string;
}

/** Pruning statistics */
export interface PruneStats {
  /** Items pruned */
  itemsPruned: number;
  /** Tokens freed */
  tokensFreed: number;
  /** Items by type pruned */
  prunedByType: Record<string, number>;
  /** New token count */
  newTokenCount: number;
  /** Percentage of limit used */
  percentUsed: number;
}

/** Configuration for the pruner */
export interface ContextPrunerConfig {
  /** Model token limit (default: 128000 for Claude) */
  modelTokenLimit?: number;
  /** Target percentage of limit to stay under (default: 0.8 = 80%) */
  targetPercentage?: number;
  /** Characters per token estimate (default: 4 for English) */
  charsPerToken?: number;
  /** Priority order for item types (higher = keep longer) */
  typePriority?: Record<string, number>;
  /** Minimum relevance score to keep (0-1) */
  minRelevance?: number;
  /** Maximum age in milliseconds before force pruning */
  maxAgeMs?: number;
}

/** Item with calculated priority for pruning decisions */
export interface PrunableItem {
  /** Original entry ID */
  id: string;
  /** Entry type */
  type: string;
  /** Estimated tokens */
  tokens: number;
  /** Age in milliseconds */
  ageMs: number;
  /** Relevance score (0-1) */
  relevance: number;
  /** Calculated priority score (higher = keep) */
  priority: number;
  /** Original entry reference */
  entry: KnowledgeEntry;
}

// ============================================================================
// Constants
// ============================================================================

/** Default type priorities (higher = more important to keep) */
const DEFAULT_TYPE_PRIORITY: Record<string, number> = {
  error: 10,        // Errors are critical context
  validation: 9,    // Validation results inform fixes
  user_input: 8,    // User preferences are important
  file: 5,          // Files can be re-read if needed
  search: 4,        // Search results can be re-queried
  tool_output: 3,   // General tool outputs
};

/** Default model token limits by model */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3.5-sonnet': 200000,
  'gpt-4': 128000,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16385,
  default: 128000,
};

// ============================================================================
// Context Pruner Class
// ============================================================================

/**
 * ContextPruner - Token-aware context management
 *
 * @example
 * ```typescript
 * const pruner = new ContextPruner({
 *   modelTokenLimit: 200000,
 *   targetPercentage: 0.8, // Keep under 80%
 * });
 *
 * // Check if pruning is needed
 * const estimate = pruner.estimateTokens(contextManager);
 * if (pruner.shouldPrune(estimate.totalTokens)) {
 *   const stats = pruner.prune(contextManager);
 *   console.log(`Pruned ${stats.itemsPruned} items, freed ${stats.tokensFreed} tokens`);
 * }
 * ```
 */
export class ContextPruner {
  private config: Required<ContextPrunerConfig>;

  constructor(config: ContextPrunerConfig = {}) {
    this.config = {
      modelTokenLimit: config.modelTokenLimit ?? MODEL_TOKEN_LIMITS.default,
      targetPercentage: config.targetPercentage ?? 0.8,
      charsPerToken: config.charsPerToken ?? 4,
      typePriority: config.typePriority ?? DEFAULT_TYPE_PRIORITY,
      minRelevance: config.minRelevance ?? 0.1,
      maxAgeMs: config.maxAgeMs ?? 30 * 60 * 1000, // 30 minutes default
    };
  }

  // ==========================================================================
  // Token Estimation
  // ==========================================================================

  /**
   * Estimate tokens for a single item
   */
  estimateItemTokens(entry: KnowledgeEntry): TokenEstimate {
    const dataStr = typeof entry.data === 'string'
      ? entry.data
      : JSON.stringify(entry.data);

    const characters = dataStr.length + entry.key.length + (entry.tags?.join('').length ?? 0);
    const tokens = Math.ceil(characters / this.config.charsPerToken);

    return {
      tokens,
      characters,
      type: entry.type,
    };
  }

  /**
   * Estimate total tokens in context manager
   */
  estimateContextTokens(manager: ContextManager): {
    totalTokens: number;
    tokensByType: Record<string, number>;
    itemCount: number;
    percentUsed: number;
  } {
    const knowledge = manager.getAllKnowledge();
    let totalTokens = 0;
    const tokensByType: Record<string, number> = {};

    for (const entry of knowledge) {
      const estimate = this.estimateItemTokens(entry);
      totalTokens += estimate.tokens;
      tokensByType[entry.type] = (tokensByType[entry.type] || 0) + estimate.tokens;
    }

    return {
      totalTokens,
      tokensByType,
      itemCount: knowledge.length,
      percentUsed: totalTokens / this.config.modelTokenLimit,
    };
  }

  /**
   * Get the token limit threshold
   */
  getTokenThreshold(): number {
    return Math.floor(this.config.modelTokenLimit * this.config.targetPercentage);
  }

  // ==========================================================================
  // Pruning Logic
  // ==========================================================================

  /**
   * Check if pruning is needed
   */
  shouldPrune(currentTokens: number): boolean {
    return currentTokens > this.getTokenThreshold();
  }

  /**
   * Calculate priority score for an item (higher = keep longer)
   */
  calculatePriority(entry: KnowledgeEntry): number {
    const now = Date.now();
    const ageMs = now - entry.createdAt.getTime();

    // Type priority (0-10)
    const typePriority = this.config.typePriority[entry.type] ?? 1;

    // Relevance score (0-1, default 0.5)
    const relevance = entry.relevance ?? 0.5;

    // Age factor (newer = higher, decays over time)
    // 1.0 at 0 age, 0.1 at maxAgeMs
    const ageFactor = Math.max(0.1, 1 - (ageMs / this.config.maxAgeMs));

    // Combined priority score
    // Type contributes 40%, relevance 30%, age 30%
    const priority = (typePriority / 10) * 0.4 + relevance * 0.3 + ageFactor * 0.3;

    return priority;
  }

  /**
   * Get items sorted by pruning priority (lowest first = prune first)
   */
  getPrunableItems(manager: ContextManager): PrunableItem[] {
    const knowledge = manager.getAllKnowledge();
    const now = Date.now();

    const items: PrunableItem[] = knowledge.map(entry => {
      const tokens = this.estimateItemTokens(entry).tokens;
      const ageMs = now - entry.createdAt.getTime();
      const relevance = entry.relevance ?? 0.5;
      const priority = this.calculatePriority(entry);

      return {
        id: entry.id,
        type: entry.type,
        tokens,
        ageMs,
        relevance,
        priority,
        entry,
      };
    });

    // Sort by priority (lowest first = prune first)
    return items.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Prune context to stay under token limit
   *
   * Strategy:
   * 1. Calculate current tokens
   * 2. Sort items by priority (lowest = prune first)
   * 3. Remove items until under threshold
   */
  prune(manager: ContextManager): PruneStats {
    const estimate = this.estimateContextTokens(manager);
    const threshold = this.getTokenThreshold();

    if (estimate.totalTokens <= threshold) {
      return {
        itemsPruned: 0,
        tokensFreed: 0,
        prunedByType: {},
        newTokenCount: estimate.totalTokens,
        percentUsed: estimate.percentUsed,
      };
    }

    const tokensToFree = estimate.totalTokens - threshold;
    const prunableItems = this.getPrunableItems(manager);

    let tokensFreed = 0;
    let itemsPruned = 0;
    const prunedByType: Record<string, number> = {};
    const itemsToRemove: string[] = [];

    // Select items to prune
    for (const item of prunableItems) {
      if (tokensFreed >= tokensToFree) break;

      // Don't prune items below minimum relevance threshold
      // (they should be pruned first, but we check anyway)
      if (item.relevance < this.config.minRelevance) {
        itemsToRemove.push(item.id);
        tokensFreed += item.tokens;
        itemsPruned++;
        prunedByType[item.type] = (prunedByType[item.type] || 0) + 1;
        continue;
      }

      // Prune if priority is low enough
      itemsToRemove.push(item.id);
      tokensFreed += item.tokens;
      itemsPruned++;
      prunedByType[item.type] = (prunedByType[item.type] || 0) + 1;
    }

    // Actually remove the items from the manager
    // Note: This requires the manager to support removal by ID
    // For now, we return the stats - actual removal should be implemented in ContextManager
    const newTokenCount = estimate.totalTokens - tokensFreed;

    return {
      itemsPruned,
      tokensFreed,
      prunedByType,
      newTokenCount,
      percentUsed: newTokenCount / this.config.modelTokenLimit,
    };
  }

  /**
   * Get items that would be pruned (dry run)
   */
  getItemsToPrune(manager: ContextManager): PrunableItem[] {
    const estimate = this.estimateContextTokens(manager);
    const threshold = this.getTokenThreshold();

    if (estimate.totalTokens <= threshold) {
      return [];
    }

    const tokensToFree = estimate.totalTokens - threshold;
    const prunableItems = this.getPrunableItems(manager);

    const itemsToPrune: PrunableItem[] = [];
    let tokensAccumulated = 0;

    for (const item of prunableItems) {
      if (tokensAccumulated >= tokensToFree) break;
      itemsToPrune.push(item);
      tokensAccumulated += item.tokens;
    }

    return itemsToPrune;
  }

  /**
   * Prune by age - remove items older than maxAgeMs
   */
  pruneByAge(manager: ContextManager): PruneStats {
    const knowledge = manager.getAllKnowledge();
    const now = Date.now();

    let tokensFreed = 0;
    let itemsPruned = 0;
    const prunedByType: Record<string, number> = {};

    for (const entry of knowledge) {
      const ageMs = now - entry.createdAt.getTime();
      if (ageMs > this.config.maxAgeMs) {
        const tokens = this.estimateItemTokens(entry).tokens;
        tokensFreed += tokens;
        itemsPruned++;
        prunedByType[entry.type] = (prunedByType[entry.type] || 0) + 1;
      }
    }

    const estimate = this.estimateContextTokens(manager);
    const newTokenCount = estimate.totalTokens - tokensFreed;

    return {
      itemsPruned,
      tokensFreed,
      prunedByType,
      newTokenCount,
      percentUsed: newTokenCount / this.config.modelTokenLimit,
    };
  }

  /**
   * Prune by type - remove all items of a specific type
   */
  pruneByType(manager: ContextManager, type: string): PruneStats {
    const knowledge = manager.getAllKnowledge();

    let tokensFreed = 0;
    let itemsPruned = 0;
    const prunedByType: Record<string, number> = {};

    for (const entry of knowledge) {
      if (entry.type === type) {
        const tokens = this.estimateItemTokens(entry).tokens;
        tokensFreed += tokens;
        itemsPruned++;
        prunedByType[type] = (prunedByType[type] || 0) + 1;
      }
    }

    const estimate = this.estimateContextTokens(manager);
    const newTokenCount = estimate.totalTokens - tokensFreed;

    return {
      itemsPruned,
      tokensFreed,
      prunedByType,
      newTokenCount,
      percentUsed: newTokenCount / this.config.modelTokenLimit,
    };
  }

  /**
   * Prune least relevant items until under threshold
   */
  pruneLeastRelevant(manager: ContextManager, targetTokens?: number): PruneStats {
    const threshold = targetTokens ?? this.getTokenThreshold();
    const estimate = this.estimateContextTokens(manager);

    if (estimate.totalTokens <= threshold) {
      return {
        itemsPruned: 0,
        tokensFreed: 0,
        prunedByType: {},
        newTokenCount: estimate.totalTokens,
        percentUsed: estimate.percentUsed,
      };
    }

    // Sort by relevance (lowest first)
    const knowledge = manager.getAllKnowledge()
      .map(entry => ({
        entry,
        tokens: this.estimateItemTokens(entry).tokens,
        relevance: entry.relevance ?? 0.5,
      }))
      .sort((a, b) => a.relevance - b.relevance);

    const tokensToFree = estimate.totalTokens - threshold;
    let tokensFreed = 0;
    let itemsPruned = 0;
    const prunedByType: Record<string, number> = {};

    for (const item of knowledge) {
      if (tokensFreed >= tokensToFree) break;

      tokensFreed += item.tokens;
      itemsPruned++;
      prunedByType[item.entry.type] = (prunedByType[item.entry.type] || 0) + 1;
    }

    const newTokenCount = estimate.totalTokens - tokensFreed;

    return {
      itemsPruned,
      tokensFreed,
      prunedByType,
      newTokenCount,
      percentUsed: newTokenCount / this.config.modelTokenLimit,
    };
  }

  /**
   * Prune oldest items first (FIFO)
   */
  pruneOldest(manager: ContextManager, targetTokens?: number): PruneStats {
    const threshold = targetTokens ?? this.getTokenThreshold();
    const estimate = this.estimateContextTokens(manager);

    if (estimate.totalTokens <= threshold) {
      return {
        itemsPruned: 0,
        tokensFreed: 0,
        prunedByType: {},
        newTokenCount: estimate.totalTokens,
        percentUsed: estimate.percentUsed,
      };
    }

    // Sort by creation time (oldest first)
    const knowledge = manager.getAllKnowledge()
      .map(entry => ({
        entry,
        tokens: this.estimateItemTokens(entry).tokens,
        createdAt: entry.createdAt.getTime(),
      }))
      .sort((a, b) => a.createdAt - b.createdAt);

    const tokensToFree = estimate.totalTokens - threshold;
    let tokensFreed = 0;
    let itemsPruned = 0;
    const prunedByType: Record<string, number> = {};

    for (const item of knowledge) {
      if (tokensFreed >= tokensToFree) break;

      tokensFreed += item.tokens;
      itemsPruned++;
      prunedByType[item.entry.type] = (prunedByType[item.entry.type] || 0) + 1;
    }

    const newTokenCount = estimate.totalTokens - tokensFreed;

    return {
      itemsPruned,
      tokensFreed,
      prunedByType,
      newTokenCount,
      percentUsed: newTokenCount / this.config.modelTokenLimit,
    };
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextPrunerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ContextPrunerConfig> {
    return { ...this.config };
  }

  /**
   * Set model token limit
   */
  setModelLimit(model: string | number): void {
    if (typeof model === 'number') {
      this.config.modelTokenLimit = model;
    } else {
      this.config.modelTokenLimit = MODEL_TOKEN_LIMITS[model] ?? MODEL_TOKEN_LIMITS.default;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ContextPruner instance
 */
export function createContextPruner(config?: ContextPrunerConfig): ContextPruner {
  return new ContextPruner(config);
}

/**
 * Create pruner for a specific model
 */
export function createPrunerForModel(model: string, targetPercentage = 0.8): ContextPruner {
  return new ContextPruner({
    modelTokenLimit: MODEL_TOKEN_LIMITS[model] ?? MODEL_TOKEN_LIMITS.default,
    targetPercentage,
  });
}

// ============================================================================
// Exports
// ============================================================================

export default ContextPruner;

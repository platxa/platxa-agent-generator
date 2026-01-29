/**
 * Context Manager
 *
 * Manages debugging context and provides automatic /clear trigger suggestions
 * to prevent context pollution and maintain peak performance during
 * long debugging sessions.
 *
 * @module context-manager
 */

import type {
  Language,
  NormalizedError,
  RootCauseHypothesis,
  FixSuggestion,
  DebugSession,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Context item type
 */
export type ContextItemType =
  | 'error'
  | 'hypothesis'
  | 'fix'
  | 'file'
  | 'analysis'
  | 'session'
  | 'user_input';

/**
 * Context item
 */
export interface ContextItem {
  /** Unique identifier */
  id: string;
  /** Item type */
  type: ContextItemType;
  /** Estimated token count */
  tokens: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last accessed timestamp */
  lastAccessedAt: Date;
  /** Reference count */
  references: number;
  /** Language associated with this item */
  language?: Language;
  /** Session ID this item belongs to */
  sessionId?: string;
  /** Item data */
  data: unknown;
}

/**
 * Clear trigger reason
 */
export type ClearTriggerReason =
  | 'token_limit'
  | 'session_complete'
  | 'context_pollution'
  | 'language_switch'
  | 'stale_context'
  | 'manual';

/**
 * Clear trigger
 */
export interface ClearTrigger {
  /** Trigger reason */
  reason: ClearTriggerReason;
  /** Human-readable message */
  message: string;
  /** Urgency level */
  urgency: 'low' | 'medium' | 'high';
  /** Suggested action */
  suggestedAction: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Context statistics
 */
export interface ContextStats {
  /** Total items */
  totalItems: number;
  /** Total estimated tokens */
  totalTokens: number;
  /** Items by type */
  itemsByType: Record<ContextItemType, number>;
  /** Tokens by type */
  tokensByType: Record<ContextItemType, number>;
  /** Active sessions */
  activeSessions: number;
  /** Oldest item age (ms) */
  oldestItemAgeMs: number;
  /** Context health score (0-100) */
  healthScore: number;
}

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  /** Maximum tokens before suggesting clear */
  maxTokens: number;
  /** Maximum items before suggesting clear */
  maxItems: number;
  /** Maximum session age before suggesting clear (ms) */
  maxSessionAgeMs: number;
  /** Maximum item age before considering stale (ms) */
  maxItemAgeMs: number;
  /** Token estimation multiplier */
  tokenEstimationMultiplier: number;
  /** Auto-suggest clear triggers */
  autoSuggestClear: boolean;
  /** Verbose logging */
  verbose: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: ContextManagerConfig = {
  maxTokens: 50000,
  maxItems: 500,
  maxSessionAgeMs: 30 * 60 * 1000, // 30 minutes
  maxItemAgeMs: 15 * 60 * 1000, // 15 minutes
  tokenEstimationMultiplier: 1.3,
  autoSuggestClear: true,
  verbose: false,
};

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count from string
 * Simple estimation: ~4 characters per token
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for an object
 */
function estimateObjectTokens(obj: unknown): number {
  return estimateTokens(JSON.stringify(obj));
}

// =============================================================================
// Context Manager Class
// =============================================================================

/**
 * Context Manager
 *
 * Tracks debugging context and suggests when to clear context
 * for optimal performance.
 */
export class ContextManager {
  private config: ContextManagerConfig;
  private items: Map<string, ContextItem>;
  private sessions: Map<string, DebugSession>;
  private triggers: ClearTrigger[];
  private lastLanguage: Language | null;

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.items = new Map();
    this.sessions = new Map();
    this.triggers = [];
    this.lastLanguage = null;
  }

  /**
   * Add an error to context
   */
  addError(error: NormalizedError): ContextItem {
    const item = this.createItem('error', error, error.language);
    this.checkTriggers();
    return item;
  }

  /**
   * Add a hypothesis to context
   */
  addHypothesis(hypothesis: RootCauseHypothesis, language?: Language): ContextItem {
    const item = this.createItem('hypothesis', hypothesis, language);
    this.checkTriggers();
    return item;
  }

  /**
   * Add a fix suggestion to context
   */
  addFix(fix: FixSuggestion, language?: Language): ContextItem {
    const item = this.createItem('fix', fix, language);
    this.checkTriggers();
    return item;
  }

  /**
   * Add file content to context
   */
  addFile(filePath: string, content: string, language?: Language): ContextItem {
    const item = this.createItem(
      'file',
      { path: filePath, content },
      language
    );
    this.checkTriggers();
    return item;
  }

  /**
   * Add analysis result to context
   */
  addAnalysis(analysis: unknown, language?: Language): ContextItem {
    const item = this.createItem('analysis', analysis, language);
    this.checkTriggers();
    return item;
  }

  /**
   * Add user input to context
   */
  addUserInput(input: string): ContextItem {
    const item = this.createItem('user_input', { input }, undefined);
    this.checkTriggers();
    return item;
  }

  /**
   * Start a debug session
   */
  startSession(session: DebugSession): void {
    this.sessions.set(session.id, session);
    this.createItem('session', session, session.language, session.id);

    // Check for language switch
    if (this.lastLanguage && this.lastLanguage !== session.language) {
      this.addTrigger({
        reason: 'language_switch',
        message: `Switching from ${this.lastLanguage} to ${session.language}`,
        urgency: 'medium',
        suggestedAction: `/clear to reset context for ${session.language} debugging`,
        timestamp: new Date(),
      });
    }
    this.lastLanguage = session.language;

    this.checkTriggers();
  }

  /**
   * End a debug session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);

      // Clean up session items
      for (const [id, item] of this.items) {
        if (item.sessionId === sessionId) {
          this.items.delete(id);
        }
      }

      this.addTrigger({
        reason: 'session_complete',
        message: `Debug session ${sessionId} completed`,
        urgency: 'low',
        suggestedAction: '/clear to free context for next task',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Access an item (updates lastAccessedAt)
   */
  accessItem(itemId: string): ContextItem | undefined {
    const item = this.items.get(itemId);
    if (item) {
      item.lastAccessedAt = new Date();
      item.references++;
    }
    return item;
  }

  /**
   * Remove an item
   */
  removeItem(itemId: string): boolean {
    return this.items.delete(itemId);
  }

  /**
   * Get items by type
   */
  getItemsByType(type: ContextItemType): ContextItem[] {
    return Array.from(this.items.values()).filter((item) => item.type === type);
  }

  /**
   * Get items by session
   */
  getItemsBySession(sessionId: string): ContextItem[] {
    return Array.from(this.items.values()).filter(
      (item) => item.sessionId === sessionId
    );
  }

  /**
   * Get items by language
   */
  getItemsByLanguage(language: Language): ContextItem[] {
    return Array.from(this.items.values()).filter(
      (item) => item.language === language
    );
  }

  /**
   * Get stale items
   */
  getStaleItems(): ContextItem[] {
    const now = Date.now();
    return Array.from(this.items.values()).filter(
      (item) => now - item.lastAccessedAt.getTime() > this.config.maxItemAgeMs
    );
  }

  /**
   * Clear all context
   */
  clear(): void {
    this.items.clear();
    this.sessions.clear();
    this.triggers = [];
    this.lastLanguage = null;
  }

  /**
   * Clear stale items only
   */
  clearStale(): number {
    const staleItems = this.getStaleItems();
    for (const item of staleItems) {
      this.items.delete(item.id);
    }
    return staleItems.length;
  }

  /**
   * Clear items by type
   */
  clearByType(type: ContextItemType): number {
    const items = this.getItemsByType(type);
    for (const item of items) {
      this.items.delete(item.id);
    }
    return items.length;
  }

  /**
   * Get context statistics
   */
  getStats(): ContextStats {
    const now = Date.now();
    const itemsByType: Record<ContextItemType, number> = {
      error: 0,
      hypothesis: 0,
      fix: 0,
      file: 0,
      analysis: 0,
      session: 0,
      user_input: 0,
    };
    const tokensByType: Record<ContextItemType, number> = {
      error: 0,
      hypothesis: 0,
      fix: 0,
      file: 0,
      analysis: 0,
      session: 0,
      user_input: 0,
    };

    let totalTokens = 0;
    let oldestItemAgeMs = 0;

    for (const item of this.items.values()) {
      itemsByType[item.type]++;
      tokensByType[item.type] += item.tokens;
      totalTokens += item.tokens;

      const age = now - item.createdAt.getTime();
      if (age > oldestItemAgeMs) {
        oldestItemAgeMs = age;
      }
    }

    const healthScore = this.calculateHealthScore(
      totalTokens,
      this.items.size,
      oldestItemAgeMs
    );

    return {
      totalItems: this.items.size,
      totalTokens,
      itemsByType,
      tokensByType,
      activeSessions: this.sessions.size,
      oldestItemAgeMs,
      healthScore,
    };
  }

  /**
   * Get pending clear triggers
   */
  getTriggers(): ClearTrigger[] {
    return [...this.triggers];
  }

  /**
   * Clear all triggers
   */
  clearTriggers(): void {
    this.triggers = [];
  }

  /**
   * Check if clear is recommended
   */
  shouldClear(): { recommended: boolean; urgency: 'low' | 'medium' | 'high'; reasons: string[] } {
    const reasons: string[] = [];
    let highestUrgency: 'low' | 'medium' | 'high' = 'low';

    for (const trigger of this.triggers) {
      reasons.push(trigger.message);
      if (
        trigger.urgency === 'high' ||
        (trigger.urgency === 'medium' && highestUrgency === 'low')
      ) {
        highestUrgency = trigger.urgency;
      }
    }

    return {
      recommended: this.triggers.length > 0,
      urgency: highestUrgency,
      reasons,
    };
  }

  /**
   * Get clear command suggestion
   */
  getClearSuggestion(): string | null {
    const { recommended, urgency, reasons } = this.shouldClear();

    if (!recommended) {
      return null;
    }

    const urgencyPrefix =
      urgency === 'high'
        ? 'RECOMMENDED: '
        : urgency === 'medium'
          ? 'Suggested: '
          : 'Consider: ';

    return `${urgencyPrefix}/clear - ${reasons.join('; ')}`;
  }

  /**
   * Create a context item
   */
  private createItem(
    type: ContextItemType,
    data: unknown,
    language?: Language,
    sessionId?: string
  ): ContextItem {
    const id = `ctx-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tokens = Math.ceil(
      estimateObjectTokens(data) * this.config.tokenEstimationMultiplier
    );
    const now = new Date();

    const item: ContextItem = {
      id,
      type,
      tokens,
      createdAt: now,
      lastAccessedAt: now,
      references: 0,
      data,
    };

    if (language) {
      item.language = language;
    }
    if (sessionId) {
      item.sessionId = sessionId;
    }

    this.items.set(id, item);
    return item;
  }

  /**
   * Add a clear trigger
   */
  private addTrigger(trigger: ClearTrigger): void {
    if (this.config.autoSuggestClear) {
      this.triggers.push(trigger);
    }
  }

  /**
   * Check for automatic triggers
   */
  private checkTriggers(): void {
    if (!this.config.autoSuggestClear) {
      return;
    }

    const stats = this.getStats();

    // Check token limit
    if (stats.totalTokens > this.config.maxTokens) {
      this.addTrigger({
        reason: 'token_limit',
        message: `Context token count (${stats.totalTokens}) exceeds limit (${this.config.maxTokens})`,
        urgency: 'high',
        suggestedAction: '/clear to prevent context overflow',
        timestamp: new Date(),
      });
    }

    // Check item limit
    if (stats.totalItems > this.config.maxItems) {
      this.addTrigger({
        reason: 'context_pollution',
        message: `Context item count (${stats.totalItems}) exceeds limit (${this.config.maxItems})`,
        urgency: 'medium',
        suggestedAction: '/clear to reduce context pollution',
        timestamp: new Date(),
      });
    }

    // Check for stale context
    if (stats.oldestItemAgeMs > this.config.maxItemAgeMs) {
      const staleCount = this.getStaleItems().length;
      if (staleCount > stats.totalItems * 0.3) {
        this.addTrigger({
          reason: 'stale_context',
          message: `${staleCount} stale items detected (${Math.round((staleCount / stats.totalItems) * 100)}% of context)`,
          urgency: 'low',
          suggestedAction: '/clear to remove stale debugging context',
          timestamp: new Date(),
        });
      }
    }

    // Check session age
    for (const [sessionId, session] of this.sessions) {
      const sessionAge = Date.now() - session.startedAt.getTime();
      if (sessionAge > this.config.maxSessionAgeMs) {
        this.addTrigger({
          reason: 'stale_context',
          message: `Session ${sessionId} has been running for ${Math.round(sessionAge / 60000)} minutes`,
          urgency: 'medium',
          suggestedAction: '/clear to start fresh debugging session',
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Calculate context health score
   */
  private calculateHealthScore(
    totalTokens: number,
    totalItems: number,
    oldestItemAgeMs: number
  ): number {
    let score = 100;

    // Penalize for high token count
    const tokenRatio = totalTokens / this.config.maxTokens;
    if (tokenRatio > 1) {
      score -= 30;
    } else if (tokenRatio > 0.8) {
      score -= 20;
    } else if (tokenRatio > 0.5) {
      score -= 10;
    }

    // Penalize for high item count
    const itemRatio = totalItems / this.config.maxItems;
    if (itemRatio > 1) {
      score -= 20;
    } else if (itemRatio > 0.8) {
      score -= 15;
    } else if (itemRatio > 0.5) {
      score -= 5;
    }

    // Penalize for old items
    const ageRatio = oldestItemAgeMs / this.config.maxItemAgeMs;
    if (ageRatio > 2) {
      score -= 15;
    } else if (ageRatio > 1) {
      score -= 10;
    } else if (ageRatio > 0.5) {
      score -= 5;
    }

    // Penalize for multiple active sessions
    if (this.sessions.size > 3) {
      score -= 10;
    } else if (this.sessions.size > 1) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Export context summary for debugging
   */
  exportSummary(): {
    stats: ContextStats;
    triggers: ClearTrigger[];
    recommendation: { recommended: boolean; urgency: string; reasons: string[] };
    sessions: string[];
  } {
    return {
      stats: this.getStats(),
      triggers: this.getTriggers(),
      recommendation: this.shouldClear(),
      sessions: Array.from(this.sessions.keys()),
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a context manager
 */
export function createContextManager(
  config?: Partial<ContextManagerConfig>
): ContextManager {
  return new ContextManager(config);
}

/**
 * Context Window Manager — LLM Input Prioritization
 *
 * Manages context window budget for LLM calls by prioritizing
 * relevant code sections and staying under token limits.
 */

// =============================================================================
// Types
// =============================================================================

/** Priority level for context items */
export type ContextPriority = "critical" | "high" | "medium" | "low";

/** A single item that can be included in context */
export interface ContextItem {
  /** Unique identifier */
  id: string;
  /** Source file path or label */
  source: string;
  /** Content text */
  content: string;
  /** Estimated token count */
  tokenCount: number;
  /** Priority */
  priority: ContextPriority;
  /** Relevance score 0-1 (higher = more relevant) */
  relevance: number;
  /** Category (e.g. "code", "docs", "config", "prompt") */
  category: string;
}

/** Context window budget */
export interface ContextBudget {
  /** Model's maximum token limit */
  modelLimit: number;
  /** Maximum usage ratio (e.g. 0.8 for 80%) */
  maxUsageRatio: number;
  /** Effective token budget (modelLimit * maxUsageRatio) */
  effectiveBudget: number;
  /** Tokens reserved for system prompt */
  systemPromptReserve: number;
  /** Tokens reserved for output generation */
  outputReserve: number;
  /** Available tokens for context items */
  availableForContext: number;
}

/** Result of context assembly */
export interface ContextAssembly {
  /** Items included in context (in order) */
  included: ContextItem[];
  /** Items excluded due to budget */
  excluded: ContextItem[];
  /** Total tokens used */
  totalTokens: number;
  /** Budget utilization 0-1 */
  utilization: number;
  /** Whether within budget */
  withinBudget: boolean;
  /** Budget details */
  budget: ContextBudget;
}

/** Context window state */
export interface ContextWindowState {
  /** All available items */
  items: ContextItem[];
  /** Current budget */
  budget: ContextBudget;
}

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimates token count from text using a character-based heuristic.
 * Approximation: ~4 characters per token for English/code.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  // Code tends to have shorter tokens due to punctuation and operators
  return Math.ceil(text.length / 3.5);
}

// =============================================================================
// Budget Management
// =============================================================================

/**
 * Creates a context budget from model parameters.
 */
export function createBudget(
  modelLimit: number,
  maxUsageRatio: number = 0.8,
  systemPromptReserve: number = 500,
  outputReserve: number = 2000,
): ContextBudget {
  const effectiveBudget = Math.floor(modelLimit * maxUsageRatio);
  const availableForContext = Math.max(0, effectiveBudget - systemPromptReserve - outputReserve);
  return {
    modelLimit,
    maxUsageRatio,
    effectiveBudget,
    systemPromptReserve,
    outputReserve,
    availableForContext,
  };
}

// =============================================================================
// Priority & Relevance Scoring
// =============================================================================

const PRIORITY_WEIGHTS: Record<ContextPriority, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
};

/**
 * Computes a composite score for sorting context items.
 * Combines priority weight and relevance score.
 */
export function computeScore(item: ContextItem): number {
  return PRIORITY_WEIGHTS[item.priority] * 0.4 + item.relevance * 0.6;
}

/**
 * Sorts context items by composite score (descending).
 */
export function sortByRelevance(items: ContextItem[]): ContextItem[] {
  return [...items].sort((a, b) => computeScore(b) - computeScore(a));
}

// =============================================================================
// Context Assembly
// =============================================================================

/**
 * Assembles context by greedily including highest-scored items
 * that fit within the token budget.
 */
export function assembleContext(
  items: ContextItem[],
  budget: ContextBudget,
): ContextAssembly {
  const sorted = sortByRelevance(items);
  const included: ContextItem[] = [];
  const excluded: ContextItem[] = [];
  let totalTokens = 0;

  for (const item of sorted) {
    if (totalTokens + item.tokenCount <= budget.availableForContext) {
      included.push(item);
      totalTokens += item.tokenCount;
    } else {
      excluded.push(item);
    }
  }

  return {
    included,
    excluded,
    totalTokens,
    utilization: budget.availableForContext > 0
      ? totalTokens / budget.availableForContext
      : 0,
    withinBudget: totalTokens <= budget.availableForContext,
    budget,
  };
}

/**
 * Creates a context item from a file's content.
 */
export function createContextItem(
  id: string,
  source: string,
  content: string,
  priority: ContextPriority,
  relevance: number,
  category: string = "code",
): ContextItem {
  return {
    id,
    source,
    content,
    tokenCount: estimateTokens(content),
    priority,
    relevance,
    category,
  };
}

// =============================================================================
// State Management
// =============================================================================

/** Creates a new context window state. */
export function createContextWindow(
  modelLimit: number,
  maxUsageRatio: number = 0.8,
): ContextWindowState {
  return {
    items: [],
    budget: createBudget(modelLimit, maxUsageRatio),
  };
}

/** Adds an item to the context window. */
export function addItem(
  state: ContextWindowState,
  item: ContextItem,
): ContextWindowState {
  return { ...state, items: [...state.items, item] };
}

/** Removes an item by ID. */
export function removeItem(
  state: ContextWindowState,
  itemId: string,
): ContextWindowState {
  return { ...state, items: state.items.filter((i) => i.id !== itemId) };
}

/** Updates the relevance score of an item. */
export function updateRelevance(
  state: ContextWindowState,
  itemId: string,
  relevance: number,
): ContextWindowState {
  return {
    ...state,
    items: state.items.map((i) =>
      i.id === itemId ? { ...i, relevance } : i,
    ),
  };
}

/** Assembles the current context from state. */
export function assembleFromState(state: ContextWindowState): ContextAssembly {
  return assembleContext(state.items, state.budget);
}

/** Returns items grouped by category. */
export function getItemsByCategory(
  state: ContextWindowState,
): Map<string, ContextItem[]> {
  const groups = new Map<string, ContextItem[]>();
  for (const item of state.items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category)!.push(item);
  }
  return groups;
}

/** Returns total token count of all items. */
export function getTotalTokens(state: ContextWindowState): number {
  return state.items.reduce((sum, i) => sum + i.tokenCount, 0);
}

/** Checks if total items exceed budget. */
export function isOverBudget(state: ContextWindowState): boolean {
  return getTotalTokens(state) > state.budget.availableForContext;
}

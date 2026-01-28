/**
 * Multi-Model Router
 *
 * Routes tasks to different LLMs based on task type:
 * planning → reasoning model, code generation → code model, review → evaluation model.
 */

// =============================================================================
// Types
// =============================================================================

export type TaskType =
  | "planning"
  | "code_generation"
  | "review"
  | "content_writing"
  | "translation"
  | "summarization"
  | "debugging";

export interface ModelSpec {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Provider (e.g. "anthropic", "openai") */
  provider: string;
  /** Cost per 1K prompt tokens */
  promptCostPer1K: number;
  /** Cost per 1K completion tokens */
  completionCostPer1K: number;
  /** Max context window tokens */
  maxContextTokens: number;
  /** Strengths/capabilities */
  capabilities: TaskType[];
}

export interface RoutingRule {
  /** Task type to match */
  taskType: TaskType;
  /** Preferred model ID */
  modelId: string;
  /** Fallback model ID */
  fallbackModelId: string;
  /** Priority (higher = checked first) */
  priority: number;
}

export interface ModelRouterConfig {
  /** Available models */
  models: ModelSpec[];
  /** Routing rules */
  rules: RoutingRule[];
  /** Default model ID (when no rule matches) */
  defaultModelId: string;
}

// =============================================================================
// Default Models
// =============================================================================

export const REASONING_MODEL: ModelSpec = {
  id: "claude-opus",
  name: "Claude Opus (Reasoning)",
  provider: "anthropic",
  promptCostPer1K: 0.015,
  completionCostPer1K: 0.075,
  maxContextTokens: 200000,
  capabilities: ["planning", "review", "debugging"],
};

export const CODE_MODEL: ModelSpec = {
  id: "claude-sonnet",
  name: "Claude Sonnet (Code)",
  provider: "anthropic",
  promptCostPer1K: 0.003,
  completionCostPer1K: 0.015,
  maxContextTokens: 200000,
  capabilities: ["code_generation", "debugging", "review"],
};

export const FAST_MODEL: ModelSpec = {
  id: "claude-haiku",
  name: "Claude Haiku (Fast)",
  provider: "anthropic",
  promptCostPer1K: 0.00025,
  completionCostPer1K: 0.00125,
  maxContextTokens: 200000,
  capabilities: ["content_writing", "translation", "summarization"],
};

export const DEFAULT_MODELS: ModelSpec[] = [REASONING_MODEL, CODE_MODEL, FAST_MODEL];

export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  { taskType: "planning", modelId: "claude-opus", fallbackModelId: "claude-sonnet", priority: 10 },
  { taskType: "code_generation", modelId: "claude-sonnet", fallbackModelId: "claude-opus", priority: 10 },
  { taskType: "review", modelId: "claude-opus", fallbackModelId: "claude-sonnet", priority: 10 },
  { taskType: "debugging", modelId: "claude-sonnet", fallbackModelId: "claude-opus", priority: 8 },
  { taskType: "content_writing", modelId: "claude-haiku", fallbackModelId: "claude-sonnet", priority: 5 },
  { taskType: "translation", modelId: "claude-haiku", fallbackModelId: "claude-sonnet", priority: 5 },
  { taskType: "summarization", modelId: "claude-haiku", fallbackModelId: "claude-sonnet", priority: 5 },
];

export const DEFAULT_ROUTER_CONFIG: ModelRouterConfig = {
  models: DEFAULT_MODELS,
  rules: DEFAULT_ROUTING_RULES,
  defaultModelId: "claude-sonnet",
};

// =============================================================================
// Routing Decision
// =============================================================================

export interface RoutingDecision {
  /** Selected model */
  model: ModelSpec;
  /** Why this model was selected */
  reason: string;
  /** Whether fallback was used */
  isFallback: boolean;
  /** Estimated cost for given token count */
  estimatedCost: number;
}

export interface RoutingRequest {
  /** Task type */
  taskType: TaskType;
  /** Estimated prompt tokens */
  estimatedPromptTokens: number;
  /** Estimated completion tokens */
  estimatedCompletionTokens: number;
  /** Whether to prefer cost over quality */
  preferCost?: boolean;
}

// =============================================================================
// State
// =============================================================================

export interface ModelRouterState {
  config: ModelRouterConfig;
  /** Routing history */
  history: Array<{ request: RoutingRequest; decision: RoutingDecision; timestamp: number }>;
}

export function createRouterState(
  config: Partial<ModelRouterConfig> = {},
): ModelRouterState {
  return {
    config: { ...DEFAULT_ROUTER_CONFIG, ...config },
    history: [],
  };
}

// =============================================================================
// Core Routing
// =============================================================================

/** Finds a model by ID. */
export function getModel(
  config: ModelRouterConfig,
  modelId: string,
): ModelSpec | undefined {
  return config.models.find((m) => m.id === modelId);
}

/** Estimates cost for a model given token counts. */
export function estimateCost(
  model: ModelSpec,
  promptTokens: number,
  completionTokens: number,
): number {
  return (
    (promptTokens / 1000) * model.promptCostPer1K +
    (completionTokens / 1000) * model.completionCostPer1K
  );
}

/** Routes a task to the appropriate model. */
export function routeTask(
  config: ModelRouterConfig,
  request: RoutingRequest,
): RoutingDecision {
  // Find matching rule
  const matchingRules = config.rules
    .filter((r) => r.taskType === request.taskType)
    .sort((a, b) => b.priority - a.priority);

  if (request.preferCost) {
    // Pick cheapest capable model
    const capable = config.models
      .filter((m) => m.capabilities.includes(request.taskType))
      .sort((a, b) => a.promptCostPer1K - b.promptCostPer1K);
    if (capable.length > 0) {
      const model = capable[0];
      return {
        model,
        reason: `Cost-optimized: cheapest model for ${request.taskType}`,
        isFallback: false,
        estimatedCost: estimateCost(model, request.estimatedPromptTokens, request.estimatedCompletionTokens),
      };
    }
  }

  for (const rule of matchingRules) {
    const primary = getModel(config, rule.modelId);
    if (primary) {
      return {
        model: primary,
        reason: `Rule match: ${request.taskType} → ${primary.name}`,
        isFallback: false,
        estimatedCost: estimateCost(primary, request.estimatedPromptTokens, request.estimatedCompletionTokens),
      };
    }
    const fallback = getModel(config, rule.fallbackModelId);
    if (fallback) {
      return {
        model: fallback,
        reason: `Fallback: ${rule.modelId} unavailable, using ${fallback.name}`,
        isFallback: true,
        estimatedCost: estimateCost(fallback, request.estimatedPromptTokens, request.estimatedCompletionTokens),
      };
    }
  }

  // Default model
  const defaultModel = getModel(config, config.defaultModelId) ?? config.models[0];
  return {
    model: defaultModel,
    reason: `Default model: no rule matched for ${request.taskType}`,
    isFallback: false,
    estimatedCost: estimateCost(defaultModel, request.estimatedPromptTokens, request.estimatedCompletionTokens),
  };
}

/** Routes a task and records it in state history. */
export function routeAndRecord(
  state: ModelRouterState,
  request: RoutingRequest,
  timestamp: number = Date.now(),
): { state: ModelRouterState; decision: RoutingDecision } {
  const decision = routeTask(state.config, request);
  return {
    state: {
      ...state,
      history: [...state.history, { request, decision, timestamp }],
    },
    decision,
  };
}

// =============================================================================
// Queries
// =============================================================================

/** Returns routing history for a task type. */
export function getHistoryByType(
  state: ModelRouterState,
  taskType: TaskType,
): ModelRouterState["history"] {
  return state.history.filter((h) => h.request.taskType === taskType);
}

/** Computes total estimated cost across all routed tasks. */
export function getTotalEstimatedCost(state: ModelRouterState): number {
  return state.history.reduce((sum, h) => sum + h.decision.estimatedCost, 0);
}

/** Returns model usage distribution as counts. */
export function getModelUsage(state: ModelRouterState): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const h of state.history) {
    const id = h.decision.model.id;
    usage[id] = (usage[id] ?? 0) + 1;
  }
  return usage;
}

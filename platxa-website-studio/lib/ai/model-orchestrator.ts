/**
 * ModelOrchestrator - Routes tasks to optimal AI models based on task type
 *
 * This orchestrator intelligently selects the best AI model for each task type,
 * considering factors like:
 * - Task complexity and requirements
 * - Model strengths (planning, coding, creative, etc.)
 * - Cost optimization
 * - Latency requirements
 *
 * Feature #36: Multi-Model Orchestration
 */

// =============================================================================
// Types
// =============================================================================

/** Supported AI model providers */
export type ModelProvider = "anthropic" | "openai" | "google" | "local";

/** Specific model identifiers */
export type ModelId =
  // Anthropic
  | "claude-3-opus"
  | "claude-3-sonnet"
  | "claude-3-haiku"
  | "claude-3.5-sonnet"
  // OpenAI
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4-turbo"
  | "o1-preview"
  | "o1-mini"
  // Google
  | "gemini-pro"
  | "gemini-pro-vision"
  | "gemini-ultra"
  // Local/Custom
  | "local-llama"
  | "local-codellama"
  | "custom";

/** Task types that the orchestrator handles */
export type TaskType =
  | "planning"
  | "code_generation"
  | "code_editing"
  | "code_review"
  | "design_analysis"
  | "content_writing"
  | "translation"
  | "summarization"
  | "chat"
  | "image_analysis"
  | "structured_output"
  | "reasoning"
  | "fast_response";

/** Priority levels for task execution */
export type TaskPriority = "low" | "medium" | "high" | "critical";

/** Model capability scores (0-100) */
export interface ModelCapabilities {
  planning: number;
  coding: number;
  creativity: number;
  reasoning: number;
  speed: number;
  costEfficiency: number;
  contextWindow: number;
  structuredOutput: number;
  vision: number;
}

/** Model configuration */
export interface ModelConfig {
  id: ModelId;
  provider: ModelProvider;
  displayName: string;
  capabilities: ModelCapabilities;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  /** Average latency in ms for first token */
  avgLatency: number;
}

/** Task routing request */
export interface TaskRequest {
  type: TaskType;
  priority?: TaskPriority;
  /** Estimated input tokens */
  estimatedTokens?: number;
  /** Whether streaming is required */
  requiresStreaming?: boolean;
  /** Whether tool use is required */
  requiresTools?: boolean;
  /** Whether vision is required */
  requiresVision?: boolean;
  /** Maximum acceptable latency in ms */
  maxLatency?: number;
  /** Maximum acceptable cost per request */
  maxCost?: number;
  /** Preferred provider (optional override) */
  preferredProvider?: ModelProvider;
  /** Preferred model (optional override) */
  preferredModel?: ModelId;
  /** Custom context for routing decisions */
  context?: Record<string, unknown>;
}

/** Routing decision result */
export interface RoutingDecision {
  model: ModelConfig;
  reason: string;
  confidence: number;
  alternatives: ModelConfig[];
  estimatedCost: number;
  estimatedLatency: number;
}

/** Orchestrator configuration */
export interface OrchestratorConfig {
  /** Available models to route to */
  availableModels: ModelId[];
  /** Default model for unknown task types */
  defaultModel: ModelId;
  /** Enable cost optimization */
  optimizeForCost: boolean;
  /** Enable latency optimization */
  optimizeForLatency: boolean;
  /** Custom routing rules */
  customRoutes?: Partial<Record<TaskType, ModelId>>;
  /** API keys for providers */
  apiKeys?: Partial<Record<ModelProvider, string>>;
}

// =============================================================================
// Model Definitions
// =============================================================================

const MODEL_CONFIGS: Record<ModelId, ModelConfig> = {
  // Anthropic Models
  "claude-3-opus": {
    id: "claude-3-opus",
    provider: "anthropic",
    displayName: "Claude 3 Opus",
    capabilities: {
      planning: 95,
      coding: 90,
      creativity: 95,
      reasoning: 98,
      speed: 40,
      costEfficiency: 30,
      contextWindow: 95,
      structuredOutput: 85,
      vision: 90,
    },
    maxTokens: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    avgLatency: 2000,
  },
  "claude-3-sonnet": {
    id: "claude-3-sonnet",
    provider: "anthropic",
    displayName: "Claude 3 Sonnet",
    capabilities: {
      planning: 85,
      coding: 85,
      creativity: 85,
      reasoning: 88,
      speed: 70,
      costEfficiency: 60,
      contextWindow: 95,
      structuredOutput: 85,
      vision: 85,
    },
    maxTokens: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    avgLatency: 1000,
  },
  "claude-3.5-sonnet": {
    id: "claude-3.5-sonnet",
    provider: "anthropic",
    displayName: "Claude 3.5 Sonnet",
    capabilities: {
      planning: 92,
      coding: 95,
      creativity: 90,
      reasoning: 94,
      speed: 75,
      costEfficiency: 70,
      contextWindow: 95,
      structuredOutput: 90,
      vision: 90,
    },
    maxTokens: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    avgLatency: 800,
  },
  "claude-3-haiku": {
    id: "claude-3-haiku",
    provider: "anthropic",
    displayName: "Claude 3 Haiku",
    capabilities: {
      planning: 70,
      coding: 75,
      creativity: 70,
      reasoning: 75,
      speed: 95,
      costEfficiency: 95,
      contextWindow: 95,
      structuredOutput: 80,
      vision: 75,
    },
    maxTokens: 200000,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    avgLatency: 300,
  },

  // OpenAI Models
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    capabilities: {
      planning: 88,
      coding: 92,
      creativity: 85,
      reasoning: 90,
      speed: 80,
      costEfficiency: 65,
      contextWindow: 85,
      structuredOutput: 95,
      vision: 92,
    },
    maxTokens: 128000,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    avgLatency: 600,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    displayName: "GPT-4o Mini",
    capabilities: {
      planning: 75,
      coding: 82,
      creativity: 75,
      reasoning: 78,
      speed: 90,
      costEfficiency: 90,
      contextWindow: 85,
      structuredOutput: 92,
      vision: 85,
    },
    maxTokens: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    avgLatency: 400,
  },
  "gpt-4-turbo": {
    id: "gpt-4-turbo",
    provider: "openai",
    displayName: "GPT-4 Turbo",
    capabilities: {
      planning: 85,
      coding: 90,
      creativity: 85,
      reasoning: 88,
      speed: 70,
      costEfficiency: 55,
      contextWindow: 85,
      structuredOutput: 90,
      vision: 88,
    },
    maxTokens: 128000,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    avgLatency: 800,
  },
  "o1-preview": {
    id: "o1-preview",
    provider: "openai",
    displayName: "o1 Preview",
    capabilities: {
      planning: 98,
      coding: 95,
      creativity: 80,
      reasoning: 99,
      speed: 20,
      costEfficiency: 20,
      contextWindow: 85,
      structuredOutput: 75,
      vision: 0,
    },
    maxTokens: 128000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.06,
    supportsStreaming: false,
    supportsTools: false,
    supportsVision: false,
    avgLatency: 15000,
  },
  "o1-mini": {
    id: "o1-mini",
    provider: "openai",
    displayName: "o1 Mini",
    capabilities: {
      planning: 90,
      coding: 92,
      creativity: 70,
      reasoning: 95,
      speed: 40,
      costEfficiency: 40,
      contextWindow: 85,
      structuredOutput: 75,
      vision: 0,
    },
    maxTokens: 128000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.012,
    supportsStreaming: false,
    supportsTools: false,
    supportsVision: false,
    avgLatency: 8000,
  },

  // Google Models
  "gemini-pro": {
    id: "gemini-pro",
    provider: "google",
    displayName: "Gemini Pro",
    capabilities: {
      planning: 80,
      coding: 82,
      creativity: 80,
      reasoning: 82,
      speed: 85,
      costEfficiency: 85,
      contextWindow: 80,
      structuredOutput: 80,
      vision: 0,
    },
    maxTokens: 32000,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.0005,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    avgLatency: 500,
  },
  "gemini-pro-vision": {
    id: "gemini-pro-vision",
    provider: "google",
    displayName: "Gemini Pro Vision",
    capabilities: {
      planning: 78,
      coding: 75,
      creativity: 80,
      reasoning: 80,
      speed: 80,
      costEfficiency: 80,
      contextWindow: 70,
      structuredOutput: 75,
      vision: 88,
    },
    maxTokens: 16000,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.0005,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: true,
    avgLatency: 600,
  },
  "gemini-ultra": {
    id: "gemini-ultra",
    provider: "google",
    displayName: "Gemini Ultra",
    capabilities: {
      planning: 90,
      coding: 88,
      creativity: 88,
      reasoning: 92,
      speed: 60,
      costEfficiency: 50,
      contextWindow: 80,
      structuredOutput: 85,
      vision: 90,
    },
    maxTokens: 32000,
    costPer1kInput: 0.007,
    costPer1kOutput: 0.021,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    avgLatency: 1200,
  },

  // Local Models
  "local-llama": {
    id: "local-llama",
    provider: "local",
    displayName: "Local LLaMA",
    capabilities: {
      planning: 70,
      coding: 75,
      creativity: 70,
      reasoning: 72,
      speed: 60,
      costEfficiency: 100,
      contextWindow: 60,
      structuredOutput: 65,
      vision: 0,
    },
    maxTokens: 8192,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    avgLatency: 2000,
  },
  "local-codellama": {
    id: "local-codellama",
    provider: "local",
    displayName: "Local CodeLLaMA",
    capabilities: {
      planning: 60,
      coding: 85,
      creativity: 50,
      reasoning: 65,
      speed: 55,
      costEfficiency: 100,
      contextWindow: 60,
      structuredOutput: 70,
      vision: 0,
    },
    maxTokens: 16384,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    avgLatency: 2500,
  },
  custom: {
    id: "custom",
    provider: "local",
    displayName: "Custom Model",
    capabilities: {
      planning: 50,
      coding: 50,
      creativity: 50,
      reasoning: 50,
      speed: 50,
      costEfficiency: 50,
      contextWindow: 50,
      structuredOutput: 50,
      vision: 0,
    },
    maxTokens: 4096,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    avgLatency: 1000,
  },
};

/** Default routing rules: task type -> preferred model */
const DEFAULT_ROUTES: Record<TaskType, ModelId> = {
  planning: "claude-3.5-sonnet", // Claude excels at planning and reasoning
  code_generation: "claude-3.5-sonnet", // Claude for high-quality theme generation
  code_editing: "claude-3.5-sonnet", // Claude for precise, context-aware edits
  code_review: "claude-3.5-sonnet", // Claude for thorough analysis
  design_analysis: "claude-3.5-sonnet", // Claude for creative analysis
  content_writing: "claude-3.5-sonnet", // Claude for natural writing
  translation: "gpt-4o", // GPT-4o for language tasks
  summarization: "claude-3-haiku", // Fast and cost-effective
  chat: "gpt-4o-mini", // Fast, cheap for conversational
  image_analysis: "gpt-4o", // Best vision capabilities
  structured_output: "gpt-4o", // Best at following schemas
  reasoning: "o1-preview", // Best reasoning capabilities
  fast_response: "claude-3-haiku", // Fastest response time
};

// =============================================================================
// ModelOrchestrator Class
// =============================================================================

/**
 * ModelOrchestrator routes tasks to the optimal AI model based on task type,
 * requirements, and constraints.
 *
 * @example
 * ```typescript
 * const orchestrator = new ModelOrchestrator({
 *   availableModels: ["claude-3.5-sonnet", "gpt-4o", "claude-3-haiku"],
 *   defaultModel: "claude-3.5-sonnet",
 *   optimizeForCost: true,
 * });
 *
 * const decision = orchestrator.route({
 *   type: "code_generation",
 *   requiresStreaming: true,
 * });
 *
 * console.log(decision.model.id); // "gpt-4o"
 * console.log(decision.reason); // "GPT-4o selected for code generation..."
 * ```
 */
export class ModelOrchestrator {
  private config: OrchestratorConfig;
  private routes: Record<TaskType, ModelId>;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      availableModels: config.availableModels || [
        "claude-3.5-sonnet",
        "gpt-4o",
        "gpt-4o-mini",
        "claude-3-haiku",
      ],
      defaultModel: config.defaultModel || "claude-3.5-sonnet",
      optimizeForCost: config.optimizeForCost ?? false,
      optimizeForLatency: config.optimizeForLatency ?? false,
      customRoutes: config.customRoutes,
      apiKeys: config.apiKeys,
    };

    // Merge custom routes with defaults
    this.routes = { ...DEFAULT_ROUTES, ...this.config.customRoutes };
  }

  /**
   * Route a task to the optimal model
   */
  route(request: TaskRequest): RoutingDecision {
    // Handle explicit model override
    if (request.preferredModel && this.isModelAvailable(request.preferredModel)) {
      const model = MODEL_CONFIGS[request.preferredModel];
      return {
        model,
        reason: `Using preferred model: ${model.displayName}`,
        confidence: 100,
        alternatives: [],
        estimatedCost: this.estimateCost(model, request.estimatedTokens),
        estimatedLatency: model.avgLatency,
      };
    }

    // Get candidates based on task type
    const candidates = this.getCandidates(request);

    if (candidates.length === 0) {
      // Fallback to default
      const defaultModel = MODEL_CONFIGS[this.config.defaultModel];
      return {
        model: defaultModel,
        reason: `No suitable models found, using default: ${defaultModel.displayName}`,
        confidence: 50,
        alternatives: [],
        estimatedCost: this.estimateCost(defaultModel, request.estimatedTokens),
        estimatedLatency: defaultModel.avgLatency,
      };
    }

    // Score and rank candidates
    const scored = candidates.map((model) => ({
      model,
      score: this.scoreModel(model, request),
    }));

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const alternatives = scored.slice(1, 4).map((s) => s.model);

    return {
      model: best.model,
      reason: this.buildReason(best.model, request),
      confidence: Math.min(100, Math.round(best.score)),
      alternatives,
      estimatedCost: this.estimateCost(best.model, request.estimatedTokens),
      estimatedLatency: best.model.avgLatency,
    };
  }

  /**
   * Get the recommended model for a specific task type
   */
  getModelForTask(taskType: TaskType): ModelConfig {
    const modelId = this.routes[taskType];
    if (this.isModelAvailable(modelId)) {
      return MODEL_CONFIGS[modelId];
    }
    return MODEL_CONFIGS[this.config.defaultModel];
  }

  /**
   * Check if a model is available
   */
  isModelAvailable(modelId: ModelId): boolean {
    return this.config.availableModels.includes(modelId);
  }

  /**
   * Get all available models
   */
  getAvailableModels(): ModelConfig[] {
    return this.config.availableModels.map((id) => MODEL_CONFIGS[id]);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.customRoutes) {
      this.routes = { ...DEFAULT_ROUTES, ...updates.customRoutes };
    }
  }

  /**
   * Get model configuration by ID
   */
  getModelConfig(modelId: ModelId): ModelConfig | undefined {
    return MODEL_CONFIGS[modelId];
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private getCandidates(request: TaskRequest): ModelConfig[] {
    return this.config.availableModels
      .map((id) => MODEL_CONFIGS[id])
      .filter((model) => this.meetsRequirements(model, request));
  }

  private meetsRequirements(model: ModelConfig, request: TaskRequest): boolean {
    // Check streaming requirement
    if (request.requiresStreaming && !model.supportsStreaming) {
      return false;
    }

    // Check tools requirement
    if (request.requiresTools && !model.supportsTools) {
      return false;
    }

    // Check vision requirement
    if (request.requiresVision && !model.supportsVision) {
      return false;
    }

    // Check latency constraint
    if (request.maxLatency && model.avgLatency > request.maxLatency) {
      return false;
    }

    // Check cost constraint
    if (request.maxCost) {
      const estimatedCost = this.estimateCost(model, request.estimatedTokens);
      if (estimatedCost > request.maxCost) {
        return false;
      }
    }

    // Check provider preference
    if (request.preferredProvider && model.provider !== request.preferredProvider) {
      return false;
    }

    return true;
  }

  private scoreModel(model: ModelConfig, request: TaskRequest): number {
    let score = 0;

    // Base score from task-specific capability
    const taskCapability = this.getTaskCapability(model, request.type);
    score += taskCapability * 0.5;

    // Cost optimization
    if (this.config.optimizeForCost) {
      score += model.capabilities.costEfficiency * 0.25;
    }

    // Latency optimization
    if (this.config.optimizeForLatency) {
      score += model.capabilities.speed * 0.25;
    }

    // Priority boost
    if (request.priority === "critical") {
      // Prefer more capable models for critical tasks
      score += (model.capabilities.reasoning + model.capabilities.coding) / 4;
    } else if (request.priority === "low") {
      // Prefer cost-effective models for low priority
      score += model.capabilities.costEfficiency * 0.15;
    }

    // Bonus for being the default route for this task type
    if (this.routes[request.type] === model.id) {
      score += 10;
    }

    return score;
  }

  private getTaskCapability(model: ModelConfig, taskType: TaskType): number {
    const caps = model.capabilities;

    switch (taskType) {
      case "planning":
        return (caps.planning * 2 + caps.reasoning) / 3;
      case "code_generation":
        return (caps.coding * 2 + caps.structuredOutput) / 3;
      case "code_review":
        return (caps.coding + caps.reasoning + caps.planning) / 3;
      case "design_analysis":
        return (caps.creativity + caps.reasoning + caps.vision) / 3;
      case "content_writing":
        return (caps.creativity * 2 + caps.reasoning) / 3;
      case "translation":
        return (caps.reasoning + caps.creativity) / 2;
      case "summarization":
        return (caps.reasoning + caps.speed) / 2;
      case "chat":
        return (caps.speed * 2 + caps.reasoning) / 3;
      case "image_analysis":
        return caps.vision;
      case "structured_output":
        return (caps.structuredOutput * 2 + caps.coding) / 3;
      case "reasoning":
        return caps.reasoning;
      case "fast_response":
        return caps.speed;
      default:
        return (caps.reasoning + caps.coding) / 2;
    }
  }

  private estimateCost(model: ModelConfig, estimatedTokens?: number): number {
    const tokens = estimatedTokens || 1000;
    const inputTokens = tokens * 0.7; // Assume 70% input
    const outputTokens = tokens * 0.3; // Assume 30% output

    return (
      (inputTokens / 1000) * model.costPer1kInput +
      (outputTokens / 1000) * model.costPer1kOutput
    );
  }

  private buildReason(model: ModelConfig, request: TaskRequest): string {
    const parts: string[] = [];

    parts.push(`${model.displayName} selected for ${request.type.replace("_", " ")}`);

    const capability = this.getTaskCapability(model, request.type);
    if (capability >= 90) {
      parts.push("(excellent capability)");
    } else if (capability >= 80) {
      parts.push("(strong capability)");
    }

    if (this.config.optimizeForCost && model.capabilities.costEfficiency >= 80) {
      parts.push("- cost optimized");
    }

    if (this.config.optimizeForLatency && model.capabilities.speed >= 80) {
      parts.push("- latency optimized");
    }

    return parts.join(" ");
  }
}

// =============================================================================
// Singleton instance
// =============================================================================

let _orchestrator: ModelOrchestrator | null = null;

/**
 * Get the global ModelOrchestrator instance
 */
export function getOrchestrator(config?: Partial<OrchestratorConfig>): ModelOrchestrator {
  if (!_orchestrator || config) {
    _orchestrator = new ModelOrchestrator(config);
  }
  return _orchestrator;
}

/**
 * Reset the global orchestrator instance
 */
export function resetOrchestrator(): void {
  _orchestrator = null;
}

// =============================================================================
// Convenience functions
// =============================================================================

/**
 * Quick route a task to the best model
 */
export function routeTask(request: TaskRequest): RoutingDecision {
  return getOrchestrator().route(request);
}

/**
 * Get the best model for a task type
 */
export function getModelForTask(taskType: TaskType): ModelConfig {
  return getOrchestrator().getModelForTask(taskType);
}

export default ModelOrchestrator;

/**
 * Agent Engine Integration
 *
 * Wires FrontendOrchestrator into Agent Engine generation step:
 * - Agent Engine calls FrontendOrchestrator.process() for generation
 * - Handles generation lifecycle events
 * - Manages state synchronization
 */

// =============================================================================
// Types
// =============================================================================

/** Generation step type */
export type GenerationStepType =
  | "frontend"      // Frontend component generation
  | "backend"       // Backend code generation
  | "style"         // Style/CSS generation
  | "template"      // Template/QWeb generation
  | "integration";  // Integration code generation

/** Generation step status */
export type GenerationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

/** Generation step definition */
export interface GenerationStep {
  /** Unique step ID */
  id: string;
  /** Step type */
  type: GenerationStepType;
  /** Step status */
  status: GenerationStatus;
  /** Input for generation */
  input: GenerationInput;
  /** Output from generation */
  output?: GenerationOutput;
  /** Error if failed */
  error?: string;
  /** Start timestamp */
  startTime?: number;
  /** End timestamp */
  endTime?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/** Generation input */
export interface GenerationInput {
  /** Prompt or instruction */
  prompt: string;
  /** Context information */
  context?: GenerationContext;
  /** Target file path */
  targetPath?: string;
  /** Options */
  options?: GenerationOptions;
}

/** Generation context */
export interface GenerationContext {
  /** Current file content */
  currentContent?: string;
  /** Related files */
  relatedFiles?: string[];
  /** Project structure */
  projectStructure?: string;
  /** Additional context */
  additionalContext?: Record<string, unknown>;
}

/** Generation options */
export interface GenerationOptions {
  /** Stream output */
  streaming?: boolean;
  /** Temperature */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Model to use */
  model?: string;
}

/** Generation output */
export interface GenerationOutput {
  /** Generated content */
  content: string;
  /** Content type */
  contentType: string;
  /** Files created/modified */
  files?: GeneratedFile[];
  /** Tokens used */
  tokensUsed?: number;
}

/** Generated file */
export interface GeneratedFile {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Operation type */
  operation: "create" | "update" | "delete";
}

/** Frontend Orchestrator interface */
export interface FrontendOrchestrator {
  /** Process a generation step */
  process(input: GenerationInput): Promise<GenerationOutput>;
  /** Check if orchestrator is ready */
  isReady(): boolean;
  /** Get orchestrator status */
  getStatus(): OrchestratorStatus;
  /** Cancel current processing */
  cancel(): void;
}

/** Orchestrator status */
export interface OrchestratorStatus {
  /** Whether processing */
  isProcessing: boolean;
  /** Current step being processed */
  currentStep?: string;
  /** Queue length */
  queueLength: number;
  /** Last error */
  lastError?: string;
}

/** Agent Engine interface */
export interface AgentEngine {
  /** Execute a generation step */
  executeStep(step: GenerationStep): Promise<GenerationStep>;
  /** Register step handler */
  registerHandler(type: GenerationStepType, handler: StepHandler): void;
  /** Get engine status */
  getStatus(): EngineStatus;
}

/** Step handler function */
export type StepHandler = (step: GenerationStep) => Promise<GenerationStep>;

/** Engine status */
export interface EngineStatus {
  /** Whether engine is running */
  isRunning: boolean;
  /** Active steps */
  activeSteps: number;
  /** Completed steps */
  completedSteps: number;
  /** Failed steps */
  failedSteps: number;
}

/** Integration event types */
export type IntegrationEventType =
  | "step:started"
  | "step:completed"
  | "step:failed"
  | "step:cancelled"
  | "orchestrator:connected"
  | "orchestrator:disconnected"
  | "engine:ready"
  | "engine:error";

/** Integration event */
export interface IntegrationEvent {
  /** Event type */
  type: IntegrationEventType;
  /** Event timestamp */
  timestamp: number;
  /** Associated step */
  step?: GenerationStep;
  /** Error if any */
  error?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/** Event listener */
export type IntegrationEventListener = (event: IntegrationEvent) => void;

/** Integration configuration */
export interface IntegrationConfig {
  /** Auto-retry failed steps */
  autoRetry: boolean;
  /** Max retry attempts */
  maxRetries: number;
  /** Retry delay (ms) */
  retryDelay: number;
  /** Step timeout (ms) */
  stepTimeout: number;
  /** Enable logging */
  enableLogging: boolean;
}

// =============================================================================
// ID Generation
// =============================================================================

let stepCounter = 0;

function generateStepId(): string {
  stepCounter++;
  return `step-${Date.now()}-${stepCounter}`;
}

/**
 * Creates a snapshot of a step for event emission.
 * This prevents events from containing mutable references.
 */
function snapshotStep(step: GenerationStep): GenerationStep {
  return {
    ...step,
    input: { ...step.input },
    output: step.output ? { ...step.output } : undefined,
    metadata: step.metadata ? { ...step.metadata } : undefined,
  };
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: IntegrationConfig = {
  autoRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  stepTimeout: 60000,
  enableLogging: false,
};

// =============================================================================
// Mock Implementations (for testing)
// =============================================================================

/**
 * Creates a mock FrontendOrchestrator for testing.
 */
export function createMockOrchestrator(
  options: {
    isReady?: boolean;
    failProcess?: boolean;
    processDelay?: number;
  } = {}
): FrontendOrchestrator {
  let isProcessing = false;
  let cancelled = false;

  return {
    async process(input: GenerationInput): Promise<GenerationOutput> {
      if (options.failProcess) {
        throw new Error("Process failed");
      }

      isProcessing = true;
      cancelled = false;

      if (options.processDelay) {
        await new Promise((resolve) => setTimeout(resolve, options.processDelay));
      }

      if (cancelled) {
        throw new Error("Processing cancelled");
      }

      isProcessing = false;

      return {
        content: `Generated content for: ${input.prompt}`,
        contentType: "text/typescript",
        files: input.targetPath
          ? [{ path: input.targetPath, content: "// Generated", operation: "create" }]
          : undefined,
      };
    },

    isReady(): boolean {
      return options.isReady ?? true;
    },

    getStatus(): OrchestratorStatus {
      return {
        isProcessing,
        queueLength: 0,
      };
    },

    cancel(): void {
      cancelled = true;
      isProcessing = false;
    },
  };
}

// =============================================================================
// AgentEngineIntegration Class
// =============================================================================

/**
 * Integrates FrontendOrchestrator with Agent Engine.
 */
export class AgentEngineIntegration {
  private config: IntegrationConfig;
  private orchestrator: FrontendOrchestrator | null = null;
  private handlers: Map<GenerationStepType, StepHandler> = new Map();
  private eventListeners: IntegrationEventListener[] = [];
  private steps: Map<string, GenerationStep> = new Map();
  private isRunning = false;

  constructor(config: Partial<IntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connects FrontendOrchestrator to the integration.
   */
  connect(orchestrator: FrontendOrchestrator): void {
    this.orchestrator = orchestrator;
    this.isRunning = true;
    this.emit({
      type: "orchestrator:connected",
      timestamp: Date.now(),
    });
  }

  /**
   * Disconnects the orchestrator.
   */
  disconnect(): void {
    this.orchestrator?.cancel();
    this.orchestrator = null;
    this.isRunning = false;
    this.emit({
      type: "orchestrator:disconnected",
      timestamp: Date.now(),
    });
  }

  /**
   * Checks if orchestrator is connected and ready.
   */
  isReady(): boolean {
    return this.orchestrator !== null && this.orchestrator.isReady();
  }

  /**
   * Registers a step handler for a generation type.
   */
  registerHandler(type: GenerationStepType, handler: StepHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Adds an event listener.
   */
  addEventListener(listener: IntegrationEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Removes an event listener.
   */
  removeEventListener(listener: IntegrationEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Creates a new generation step.
   */
  createStep(
    type: GenerationStepType,
    input: GenerationInput,
    metadata?: Record<string, unknown>
  ): GenerationStep {
    const step: GenerationStep = {
      id: generateStepId(),
      type,
      status: "pending",
      input,
      metadata,
    };
    this.steps.set(step.id, step);
    return step;
  }

  /**
   * Executes a generation step using FrontendOrchestrator.
   */
  async executeStep(step: GenerationStep): Promise<GenerationStep> {
    if (!this.orchestrator) {
      step.status = "failed";
      step.error = "No orchestrator connected";
      return step;
    }

    if (!this.orchestrator.isReady()) {
      step.status = "failed";
      step.error = "Orchestrator not ready";
      return step;
    }

    // Update step status
    step.status = "processing";
    step.startTime = Date.now();
    this.steps.set(step.id, step);

    this.emit({
      type: "step:started",
      timestamp: Date.now(),
      step: snapshotStep(step),
    });

    let attempts = 0;
    const maxAttempts = this.config.autoRetry ? this.config.maxRetries : 1;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        // Call FrontendOrchestrator.process() - THE KEY INTEGRATION POINT
        const output = await this.processWithTimeout(step.input);

        step.output = output;
        step.status = "completed";
        step.endTime = Date.now();
        this.steps.set(step.id, step);

        this.emit({
          type: "step:completed",
          timestamp: Date.now(),
          step: snapshotStep(step),
        });

        return step;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (attempts >= maxAttempts) {
          step.status = "failed";
          step.error = errorMessage;
          step.endTime = Date.now();
          this.steps.set(step.id, step);

          this.emit({
            type: "step:failed",
            timestamp: Date.now(),
            step: snapshotStep(step),
            error: errorMessage,
          });

          return step;
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
      }
    }

    return step;
  }

  /**
   * Processes input with timeout.
   */
  private async processWithTimeout(input: GenerationInput): Promise<GenerationOutput> {
    if (!this.orchestrator) {
      throw new Error("No orchestrator");
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Step timeout")), this.config.stepTimeout);
    });

    return Promise.race([
      this.orchestrator.process(input),
      timeoutPromise,
    ]);
  }

  /**
   * Executes a frontend generation step.
   * This is the main method Agent Engine should call.
   */
  async processFrontendGeneration(
    prompt: string,
    context?: GenerationContext,
    options?: GenerationOptions
  ): Promise<GenerationStep> {
    const step = this.createStep("frontend", {
      prompt,
      context,
      options,
    });

    return this.executeStep(step);
  }

  /**
   * Cancels a step.
   */
  cancelStep(stepId: string): boolean {
    const step = this.steps.get(stepId);
    if (!step || step.status !== "processing") {
      return false;
    }

    this.orchestrator?.cancel();
    step.status = "cancelled";
    step.endTime = Date.now();
    this.steps.set(stepId, step);

    this.emit({
      type: "step:cancelled",
      timestamp: Date.now(),
      step: snapshotStep(step),
    });

    return true;
  }

  /**
   * Gets a step by ID.
   */
  getStep(stepId: string): GenerationStep | undefined {
    return this.steps.get(stepId);
  }

  /**
   * Gets all steps.
   */
  getAllSteps(): GenerationStep[] {
    return Array.from(this.steps.values());
  }

  /**
   * Gets steps by status.
   */
  getStepsByStatus(status: GenerationStatus): GenerationStep[] {
    return this.getAllSteps().filter((s) => s.status === status);
  }

  /**
   * Gets engine status.
   */
  getStatus(): EngineStatus {
    const steps = this.getAllSteps();
    return {
      isRunning: this.isRunning,
      activeSteps: steps.filter((s) => s.status === "processing").length,
      completedSteps: steps.filter((s) => s.status === "completed").length,
      failedSteps: steps.filter((s) => s.status === "failed").length,
    };
  }

  /**
   * Gets orchestrator status.
   */
  getOrchestratorStatus(): OrchestratorStatus | null {
    return this.orchestrator?.getStatus() ?? null;
  }

  /**
   * Clears all steps.
   */
  clearSteps(): void {
    this.steps.clear();
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<IntegrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): IntegrationConfig {
    return { ...this.config };
  }

  // Private methods

  private emit(event: IntegrationEvent): void {
    if (this.config.enableLogging) {
      console.log(`[Integration] ${event.type}`, event);
    }

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an AgentEngineIntegration instance.
 */
export function createAgentEngineIntegration(
  config?: Partial<IntegrationConfig>
): AgentEngineIntegration {
  return new AgentEngineIntegration(config);
}

/**
 * Creates an integration with orchestrator connected.
 */
export function createIntegrationWithOrchestrator(
  orchestrator: FrontendOrchestrator,
  config?: Partial<IntegrationConfig>
): AgentEngineIntegration {
  const integration = new AgentEngineIntegration(config);
  integration.connect(orchestrator);
  return integration;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculates step duration.
 */
export function getStepDuration(step: GenerationStep): number | null {
  if (!step.startTime || !step.endTime) {
    return null;
  }
  return step.endTime - step.startTime;
}

/**
 * Checks if step is terminal (completed, failed, or cancelled).
 */
export function isTerminalStatus(status: GenerationStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

/**
 * Creates a generation input from prompt.
 */
export function createGenerationInput(
  prompt: string,
  options?: Partial<GenerationInput>
): GenerationInput {
  return {
    prompt,
    ...options,
  };
}

/**
 * Formats step for logging.
 */
export function formatStep(step: GenerationStep): string {
  const duration = getStepDuration(step);
  return `[${step.id}] ${step.type} - ${step.status}${duration ? ` (${duration}ms)` : ""}`;
}

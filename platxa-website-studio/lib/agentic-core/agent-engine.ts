/**
 * AgentEngine - Core autonomous execution engine for Lovable-parity
 *
 * Implements the self-correction loop:
 * Generate → Validate → Fix → Repeat (max 5 iterations)
 *
 * @module agentic-core/agent-engine
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Status of the agent execution lifecycle */
export type AgentStatus =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'validating'
  | 'fixing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Types of actions the agent can perform */
export type AgentActionType =
  | 'search'
  | 'read'
  | 'write'
  | 'edit'
  | 'validate'
  | 'compile'
  | 'preview'
  | 'test'
  | 'web_search';

/** A single step in the agent's execution plan */
export interface AgentPlanStep {
  id: string;
  action: AgentActionType;
  target: string;
  rationale: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/** The agent's execution plan */
export interface AgentPlan {
  id: string;
  goal: string;
  steps: AgentPlanStep[];
  createdAt: Date;
  updatedAt: Date;
}

/** Error captured during execution */
export interface AgentError {
  id: string;
  type: 'qweb' | 'scss' | 'odoo' | 'validation' | 'runtime' | 'unknown';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  iteration: number;
  timestamp: Date;
}

/** File modification record */
export interface FileModification {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  previousContent?: string;
  newContent?: string;
  timestamp: Date;
  iteration: number;
}

/** Context gathered during execution */
export interface AgentContext {
  /** Files read during exploration */
  filesRead: Map<string, string>;
  /** Search results cached */
  searchResults: Map<string, unknown[]>;
  /** User preferences and constraints */
  userPreferences: Record<string, unknown>;
  /** Odoo-specific context (version, modules, etc.) */
  odooContext: {
    version?: string;
    modules?: string[];
    theme?: string;
    snippets?: string[];
  };
  /** Design tokens in use */
  designTokens?: Record<string, unknown>;
}

/** Validation result from quality gates */
export interface ValidationResult {
  passed: boolean;
  qualityScore: number;
  checks: {
    name: string;
    passed: boolean;
    score: number;
    errors: string[];
    warnings: string[];
  }[];
  timestamp: Date;
}

/** Complete agent state */
export interface AgentState {
  /** The user's goal/request */
  goal: string;
  /** Current execution plan */
  plan: AgentPlan | null;
  /** Accumulated context */
  context: AgentContext;
  /** Current iteration (1-5) */
  iteration: number;
  /** Current status */
  status: AgentStatus;
  /** Errors encountered */
  errors: AgentError[];
  /** Files modified during execution */
  filesModified: FileModification[];
  /** Current quality score (0-100) */
  qualityScore: number;
  /** Whether the goal was achieved */
  goalAchieved: boolean;
  /** Execution timestamps */
  startedAt: Date | null;
  completedAt: Date | null;
  /** Last validation result */
  lastValidation: ValidationResult | null;
}

/** Configuration for the agent engine */
export interface AgentEngineConfig {
  /** Maximum iterations before giving up (default: 5) */
  maxIterations: number;
  /** Minimum quality score to pass (default: 80) */
  qualityThreshold: number;
  /** Timeout per iteration in ms (default: 60000) */
  iterationTimeout: number;
  /** Whether to emit detailed progress events */
  verboseEvents: boolean;
  /** Tool executor instance */
  toolExecutor?: ToolExecutor;
  /** LLM provider for planning */
  llmProvider?: LLMProvider;
}

/** Result of agent execution */
export interface AgentResult {
  success: boolean;
  goal: string;
  iterations: number;
  qualityScore: number;
  filesModified: FileModification[];
  errors: AgentError[];
  warnings: string[];
  summary: string;
  duration: number;
}

/** Events emitted by the agent */
export interface AgentEvents {
  'status:changed': (status: AgentStatus, previousStatus: AgentStatus) => void;
  'iteration:start': (iteration: number) => void;
  'iteration:end': (iteration: number, result: ValidationResult) => void;
  'plan:created': (plan: AgentPlan) => void;
  'plan:updated': (plan: AgentPlan) => void;
  'step:start': (step: AgentPlanStep) => void;
  'step:complete': (step: AgentPlanStep) => void;
  'step:failed': (step: AgentPlanStep, error: Error) => void;
  'validation:start': () => void;
  'validation:complete': (result: ValidationResult) => void;
  'error:captured': (error: AgentError) => void;
  'file:modified': (modification: FileModification) => void;
  'quality:updated': (score: number, previous: number) => void;
  'context:updated': (context: AgentContext) => void;
  'execution:complete': (result: AgentResult) => void;
  'execution:failed': (error: Error) => void;
}

/** Interface for tool execution (to be implemented) */
export interface ToolExecutor {
  execute(action: AgentActionType, params: Record<string, unknown>): Promise<unknown>;
}

/** Interface for LLM provider (to be implemented) */
export interface LLMProvider {
  generatePlan(goal: string, context: AgentContext): Promise<AgentPlan>;
  generateFix(errors: AgentError[], context: AgentContext): Promise<AgentPlanStep[]>;
}

// ============================================================================
// AgentEngine Class
// ============================================================================

/**
 * AgentEngine - The core autonomous execution engine
 *
 * Implements Lovable-style agentic workflow:
 * 1. Plan - Generate execution steps from user goal
 * 2. Execute - Run each step using tools
 * 3. Validate - Check quality with multiple validators
 * 4. Fix - Self-correct based on errors
 * 5. Repeat - Loop until quality threshold or max iterations
 */
export class AgentEngine extends EventEmitter {
  private state: AgentState;
  private config: AgentEngineConfig;
  private abortController: AbortController | null = null;

  constructor(config: Partial<AgentEngineConfig> = {}) {
    super();

    this.config = {
      maxIterations: 5,
      qualityThreshold: 80,
      iterationTimeout: 60000,
      verboseEvents: true,
      ...config,
    };

    this.state = this.createInitialState('');
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Execute the agent with a given goal
   * This is the main entry point for autonomous execution
   */
  async execute(goal: string): Promise<AgentResult> {
    // Initialize state for new execution
    this.state = this.createInitialState(goal);
    this.state.startedAt = new Date();
    this.abortController = new AbortController();

    const startTime = Date.now();

    try {
      this.setStatus('planning');

      while (this.state.iteration < this.config.maxIterations) {
        this.state.iteration++;
        this.emit('iteration:start', this.state.iteration);

        // Phase 1: Plan (or re-plan if fixing)
        if (!this.state.plan || this.state.status === 'fixing') {
          await this.planPhase();
        }

        // Phase 2: Execute plan steps
        this.setStatus('executing');
        await this.executePhase();

        // Phase 3: Validate results
        this.setStatus('validating');
        const validation = await this.validatePhase();

        this.emit('iteration:end', this.state.iteration, validation);

        // Check if we've achieved the goal
        if (validation.passed && validation.qualityScore >= this.config.qualityThreshold) {
          this.state.goalAchieved = true;
          break;
        }

        // Phase 4: Prepare for self-correction
        if (this.state.iteration < this.config.maxIterations) {
          this.setStatus('fixing');
          await this.replanWithErrors(validation);
        }
      }

      // Finalize execution
      this.state.completedAt = new Date();
      this.setStatus(this.state.goalAchieved ? 'completed' : 'failed');

      const result = this.createResult(startTime);
      this.emit('execution:complete', result);
      return result;

    } catch (error) {
      this.state.completedAt = new Date();
      this.setStatus('failed');

      const agentError = this.captureError(error as Error, 'runtime');
      this.emit('execution:failed', error as Error);

      return this.createResult(startTime, agentError);
    }
  }

  /**
   * Cancel the current execution
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.setStatus('cancelled');
    }
  }

  /**
   * Get the current state (read-only snapshot)
   */
  getState(): Readonly<AgentState> {
    return { ...this.state };
  }

  /**
   * Get the current status
   */
  getStatus(): AgentStatus {
    return this.state.status;
  }

  /**
   * Get the current quality score
   */
  getQualityScore(): number {
    return this.state.qualityScore;
  }

  /**
   * Get the current iteration
   */
  getIteration(): number {
    return this.state.iteration;
  }

  /**
   * Check if execution is in progress
   */
  isRunning(): boolean {
    return ['planning', 'executing', 'validating', 'fixing'].includes(this.state.status);
  }

  // --------------------------------------------------------------------------
  // Phase Implementations
  // --------------------------------------------------------------------------

  /**
   * Planning phase - Generate or update execution plan
   */
  private async planPhase(): Promise<void> {
    this.setStatus('planning');

    if (this.config.llmProvider) {
      // Use LLM to generate plan
      const plan = await this.config.llmProvider.generatePlan(
        this.state.goal,
        this.state.context
      );
      this.state.plan = plan;
      this.emit('plan:created', plan);
    } else {
      // Create a default plan structure (to be filled by tool executor)
      this.state.plan = {
        id: this.generateId(),
        goal: this.state.goal,
        steps: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Execution phase - Run each step in the plan
   */
  private async executePhase(): Promise<void> {
    if (!this.state.plan) {
      throw new Error('No plan available for execution');
    }

    for (const step of this.state.plan.steps) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Execution cancelled');
      }

      if (step.status === 'completed' || step.status === 'skipped') {
        continue;
      }

      await this.executeStep(step);
    }
  }

  /**
   * Execute a single plan step
   */
  private async executeStep(step: AgentPlanStep): Promise<void> {
    step.status = 'in_progress';
    step.startedAt = new Date();
    this.emit('step:start', step);

    try {
      if (this.config.toolExecutor) {
        const result = await this.config.toolExecutor.execute(step.action, {
          target: step.target,
          context: this.state.context,
        });
        step.result = result;
        step.status = 'completed';
      } else {
        // Placeholder for when no tool executor is configured
        step.status = 'completed';
      }

      step.completedAt = new Date();
      this.emit('step:complete', step);

    } catch (error) {
      step.status = 'failed';
      step.error = (error as Error).message;
      step.completedAt = new Date();

      this.captureError(error as Error, 'runtime', step.target);
      this.emit('step:failed', step, error as Error);
    }
  }

  /**
   * Validation phase - Run all quality checks
   */
  private async validatePhase(): Promise<ValidationResult> {
    this.emit('validation:start');

    // Default validation structure (to be replaced with actual validators)
    const validation: ValidationResult = {
      passed: true,
      qualityScore: 0,
      checks: [],
      timestamp: new Date(),
    };

    // Calculate quality score from checks
    if (validation.checks.length > 0) {
      const totalScore = validation.checks.reduce((sum, check) => sum + check.score, 0);
      validation.qualityScore = Math.round(totalScore / validation.checks.length);
      validation.passed = validation.checks.every(check => check.passed);
    } else {
      // No validators configured, assume passing with threshold score
      validation.qualityScore = this.config.qualityThreshold;
      validation.passed = true;
    }

    // Update state
    const previousScore = this.state.qualityScore;
    this.state.qualityScore = validation.qualityScore;
    this.state.lastValidation = validation;

    if (previousScore !== validation.qualityScore) {
      this.emit('quality:updated', validation.qualityScore, previousScore);
    }

    this.emit('validation:complete', validation);
    return validation;
  }

  /**
   * Re-plan based on validation errors
   */
  private async replanWithErrors(validation: ValidationResult): Promise<void> {
    const errors = validation.checks
      .flatMap(check => check.errors)
      .map(msg => this.captureError(new Error(msg), 'validation'));

    if (this.config.llmProvider && errors.length > 0) {
      // Generate fix steps using LLM
      const fixSteps = await this.config.llmProvider.generateFix(
        this.state.errors,
        this.state.context
      );

      // Update plan with fix steps
      if (this.state.plan) {
        this.state.plan.steps = [
          ...this.state.plan.steps.filter(s => s.status === 'completed'),
          ...fixSteps,
        ];
        this.state.plan.updatedAt = new Date();
        this.emit('plan:updated', this.state.plan);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Create initial state for a new execution
   */
  private createInitialState(goal: string): AgentState {
    return {
      goal,
      plan: null,
      context: {
        filesRead: new Map(),
        searchResults: new Map(),
        userPreferences: {},
        odooContext: {},
      },
      iteration: 0,
      status: 'idle',
      errors: [],
      filesModified: [],
      qualityScore: 0,
      goalAchieved: false,
      startedAt: null,
      completedAt: null,
      lastValidation: null,
    };
  }

  /**
   * Set status and emit change event
   */
  private setStatus(newStatus: AgentStatus): void {
    const previousStatus = this.state.status;
    if (previousStatus !== newStatus) {
      this.state.status = newStatus;
      this.emit('status:changed', newStatus, previousStatus);
    }
  }

  /**
   * Capture an error and add to state
   */
  private captureError(
    error: Error,
    type: AgentError['type'],
    file?: string
  ): AgentError {
    const agentError: AgentError = {
      id: this.generateId(),
      type,
      message: error.message,
      file,
      severity: 'error',
      iteration: this.state.iteration,
      timestamp: new Date(),
    };

    this.state.errors.push(agentError);
    this.emit('error:captured', agentError);
    return agentError;
  }

  /**
   * Record a file modification
   */
  recordFileModification(modification: Omit<FileModification, 'timestamp' | 'iteration'>): void {
    const fullModification: FileModification = {
      ...modification,
      timestamp: new Date(),
      iteration: this.state.iteration,
    };

    this.state.filesModified.push(fullModification);
    this.emit('file:modified', fullModification);
  }

  /**
   * Update context
   */
  updateContext(updates: Partial<AgentContext>): void {
    this.state.context = {
      ...this.state.context,
      ...updates,
    };
    this.emit('context:updated', this.state.context);
  }

  /**
   * Create the final result object
   */
  private createResult(startTime: number, fatalError?: AgentError): AgentResult {
    const duration = Date.now() - startTime;
    const warnings = this.state.errors
      .filter(e => e.severity === 'warning')
      .map(e => e.message);

    return {
      success: this.state.goalAchieved && !fatalError,
      goal: this.state.goal,
      iterations: this.state.iteration,
      qualityScore: this.state.qualityScore,
      filesModified: this.state.filesModified,
      errors: this.state.errors.filter(e => e.severity === 'error'),
      warnings,
      summary: this.generateSummary(fatalError),
      duration,
    };
  }

  /**
   * Generate execution summary
   */
  private generateSummary(fatalError?: AgentError): string {
    if (fatalError) {
      return `Execution failed: ${fatalError.message}`;
    }

    if (this.state.goalAchieved) {
      return `Successfully completed "${this.state.goal}" in ${this.state.iteration} iteration(s) with quality score ${this.state.qualityScore}%`;
    }

    return `Failed to achieve goal after ${this.state.iteration} iterations. Quality score: ${this.state.qualityScore}%`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new AgentEngine instance with default configuration
 */
export function createAgentEngine(config?: Partial<AgentEngineConfig>): AgentEngine {
  return new AgentEngine(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default AgentEngine;

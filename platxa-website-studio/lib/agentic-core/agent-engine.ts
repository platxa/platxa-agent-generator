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

/** Final execution status for detailed result classification */
export type AgentResultStatus = 'success' | 'warning' | 'failure';

/** Result of agent execution */
export interface AgentResult {
  /** Overall success flag (true if status is 'success' or 'warning') */
  success: boolean;
  /** Detailed result status: success, warning, or failure */
  status: AgentResultStatus;
  goal: string;
  iterations: number;
  qualityScore: number;
  filesModified: FileModification[];
  errors: AgentError[];
  warnings: string[];
  summary: string;
  duration: number;
  /** Whether execution stopped early due to diminishing returns */
  stoppedEarly: boolean;
  /** Quality trend over iterations */
  qualityTrend: { improving: boolean; delta: number; history: number[] };
}

/** SSE-style progress event for real-time streaming */
export interface ProgressEvent {
  /** Current execution phase */
  phase: 'planning' | 'executing' | 'validating' | 'fixing' | 'completed' | 'failed';
  /** Current step description */
  step: string;
  /** Overall progress percentage (0-100) */
  percentage: number;
  /** Current iteration number */
  iteration: number;
  /** Current step index within plan */
  stepIndex: number;
  /** Total steps in current plan */
  totalSteps: number;
  /** Timestamp of this progress update */
  timestamp: Date;
  /** Optional additional details */
  details?: Record<string, unknown>;
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
  /** SSE-style progress streaming event */
  'progress': (event: ProgressEvent) => void;
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
  /** Track quality scores for diminishing returns detection */
  private qualityHistory: number[] = [];
  /** Current step index for progress tracking */
  private currentStepIndex: number = 0;

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
    this.qualityHistory = [];
    this.currentStepIndex = 0;

    const startTime = Date.now();

    try {
      this.setStatus('planning');
      this.emitProgress('planning', 'Initializing execution');

      while (this.state.iteration < this.config.maxIterations) {
        this.state.iteration++;
        this.emit('iteration:start', this.state.iteration);
        this.emitProgress('planning', `Starting iteration ${this.state.iteration}`, {
          iteration: this.state.iteration,
          maxIterations: this.config.maxIterations,
        });

        // Phase 1: Plan (or re-plan if fixing)
        if (!this.state.plan || this.state.status === 'fixing') {
          this.emitProgress('planning', 'Generating execution plan');
          await this.planPhase();
          this.emitProgress('planning', 'Plan generated', {
            stepCount: this.state.plan?.steps.length || 0,
          });
        }

        // Phase 2: Execute plan steps
        this.setStatus('executing');
        this.emitProgress('executing', 'Executing plan steps');
        await this.executePhase();

        // Phase 3: Validate results
        this.setStatus('validating');
        this.emitProgress('validating', 'Running quality validators');
        const validation = await this.validatePhase();

        // Record quality for diminishing returns tracking
        this.recordQualityScore(validation.qualityScore);

        this.emit('iteration:end', this.state.iteration, validation);
        this.emitProgress('validating', 'Validation complete', {
          passed: validation.passed,
          qualityScore: validation.qualityScore,
        });

        // Check if we've achieved the goal
        if (validation.passed && validation.qualityScore >= this.config.qualityThreshold) {
          this.state.goalAchieved = true;
          break;
        }

        // Feature #9: Check for diminishing returns - stop early if quality not improving
        if (this.shouldStopEarly()) {
          this.emitProgress('fixing', 'Stopping early: diminishing returns detected', {
            qualityHistory: this.qualityHistory,
          });
          break;
        }

        // Phase 4: Prepare for self-correction
        if (this.state.iteration < this.config.maxIterations) {
          this.setStatus('fixing');
          this.emitProgress('fixing', 'Generating corrective plan');
          await this.replanWithErrors(validation);
        }
      }

      // Feature #10: Finalize execution with proper state
      this.state.completedAt = new Date();
      const finalStatus = this.determineFinalStatus();
      this.setStatus(finalStatus);

      const result = this.createResult(startTime);
      this.emitProgress(
        finalStatus === 'completed' ? 'completed' : 'failed',
        result.summary,
        { finalResult: result }
      );
      this.emit('execution:complete', result);
      return result;

    } catch (error) {
      this.state.completedAt = new Date();
      this.setStatus('failed');

      const agentError = this.captureError(error as Error, 'runtime');
      this.emitProgress('failed', `Execution failed: ${(error as Error).message}`);
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
   * Feature #8: Enhanced with progress streaming
   */
  private async executeStep(step: AgentPlanStep): Promise<void> {
    step.status = 'in_progress';
    step.startedAt = new Date();
    this.emit('step:start', step);

    // Feature #8: Emit progress with step details
    this.emitProgress('executing', `Executing: ${step.action} on ${step.target}`, {
      stepId: step.id,
      action: step.action,
      target: step.target,
    });

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
      this.currentStepIndex++;
      this.emit('step:complete', step);

      // Feature #8: Emit progress after step completion
      this.emitProgress('executing', `Completed: ${step.action} on ${step.target}`, {
        stepId: step.id,
        completed: true,
      });

    } catch (error) {
      step.status = 'failed';
      step.error = (error as Error).message;
      step.completedAt = new Date();
      this.currentStepIndex++;

      this.captureError(error as Error, 'runtime', step.target);
      this.emit('step:failed', step, error as Error);

      // Feature #8: Emit progress for failed step
      this.emitProgress('executing', `Failed: ${step.action} on ${step.target}`, {
        stepId: step.id,
        error: (error as Error).message,
      });
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
   * Feature #10: Includes success/warning/failure status classification
   */
  private createResult(startTime: number, fatalError?: AgentError): AgentResult {
    const duration = Date.now() - startTime;
    const warnings = this.state.errors
      .filter(e => e.severity === 'warning')
      .map(e => e.message);

    const resultStatus = this.classifyResultStatus(fatalError);
    const stoppedEarly = this.shouldStopEarly() && !this.state.goalAchieved;

    return {
      success: resultStatus !== 'failure',
      status: resultStatus,
      goal: this.state.goal,
      iterations: this.state.iteration,
      qualityScore: this.state.qualityScore,
      filesModified: this.state.filesModified,
      errors: this.state.errors.filter(e => e.severity === 'error'),
      warnings,
      summary: this.generateSummary(fatalError, resultStatus, stoppedEarly),
      duration,
      stoppedEarly,
      qualityTrend: this.getQualityTrend(),
    };
  }

  /**
   * Feature #10: Classify result as success, warning, or failure
   */
  private classifyResultStatus(fatalError?: AgentError): AgentResultStatus {
    // Fatal error = failure
    if (fatalError) {
      return 'failure';
    }

    // Goal achieved with high quality = success
    if (this.state.goalAchieved && this.state.qualityScore >= this.config.qualityThreshold) {
      return 'success';
    }

    // Goal achieved but with warnings or below-optimal quality = warning
    if (this.state.goalAchieved) {
      const hasWarnings = this.state.errors.some(e => e.severity === 'warning');
      const nearThreshold = this.state.qualityScore >= this.config.qualityThreshold - 10;
      if (hasWarnings || nearThreshold) {
        return 'warning';
      }
    }

    // Quality above 60% but goal not fully achieved = warning
    if (this.state.qualityScore >= 60 && this.state.filesModified.length > 0) {
      return 'warning';
    }

    // Otherwise = failure
    return 'failure';
  }

  /**
   * Feature #10: Determine final agent status based on result classification
   */
  private determineFinalStatus(): AgentStatus {
    const resultStatus = this.classifyResultStatus();
    if (resultStatus === 'success') {
      return 'completed';
    }
    // Warning status still counts as completed (partial success)
    if (resultStatus === 'warning') {
      return 'completed';
    }
    return 'failed';
  }

  /**
   * Generate execution summary
   * Feature #10: Enhanced summary with status classification
   */
  private generateSummary(
    fatalError?: AgentError,
    status?: AgentResultStatus,
    stoppedEarly?: boolean
  ): string {
    if (fatalError) {
      return `Execution failed: ${fatalError.message}`;
    }

    const earlyStopNote = stoppedEarly ? ' (stopped early: diminishing returns)' : '';

    if (status === 'success') {
      return `Successfully completed "${this.state.goal}" in ${this.state.iteration} iteration(s) with quality score ${this.state.qualityScore}%`;
    }

    if (status === 'warning') {
      const warningCount = this.state.errors.filter(e => e.severity === 'warning').length;
      const warningNote = warningCount > 0 ? ` with ${warningCount} warning(s)` : '';
      return `Completed "${this.state.goal}" in ${this.state.iteration} iteration(s)${warningNote}. Quality score: ${this.state.qualityScore}%${earlyStopNote}`;
    }

    return `Failed to achieve goal after ${this.state.iteration} iteration(s). Quality score: ${this.state.qualityScore}%${earlyStopNote}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // --------------------------------------------------------------------------
  // Feature #8: Progress Streaming (SSE-style)
  // --------------------------------------------------------------------------

  /**
   * Emit a progress event for SSE-style streaming
   * Provides real-time updates on phase, step, and percentage
   */
  private emitProgress(
    phase: ProgressEvent['phase'],
    step: string,
    details?: Record<string, unknown>
  ): void {
    const totalSteps = this.state.plan?.steps.length || 1;
    const completedSteps = this.state.plan?.steps.filter(
      s => s.status === 'completed' || s.status === 'skipped'
    ).length || 0;

    // Calculate percentage based on phase weights:
    // Planning: 0-10%, Executing: 10-70%, Validating: 70-90%, Fixing: 90-95%, Complete: 100%
    let percentage: number;
    switch (phase) {
      case 'planning':
        percentage = 5 + (this.state.iteration - 1) * 2;
        break;
      case 'executing':
        percentage = 10 + Math.round((completedSteps / totalSteps) * 60);
        break;
      case 'validating':
        percentage = 75 + (this.state.iteration - 1) * 3;
        break;
      case 'fixing':
        percentage = 90 + (this.state.iteration - 1);
        break;
      case 'completed':
        percentage = 100;
        break;
      case 'failed':
        percentage = Math.max(this.calculateOverallProgress(), 0);
        break;
      default:
        percentage = this.calculateOverallProgress();
    }

    const progressEvent: ProgressEvent = {
      phase,
      step,
      percentage: Math.min(100, Math.max(0, percentage)),
      iteration: this.state.iteration,
      stepIndex: this.currentStepIndex,
      totalSteps,
      timestamp: new Date(),
      details,
    };

    this.emit('progress', progressEvent);
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateOverallProgress(): number {
    const iterationWeight = ((this.state.iteration - 1) / this.config.maxIterations) * 100;
    const stepProgress = this.state.plan?.steps.length
      ? (this.currentStepIndex / this.state.plan.steps.length) * 20
      : 0;
    return Math.round(iterationWeight * 0.8 + stepProgress);
  }

  // --------------------------------------------------------------------------
  // Feature #9: Diminishing Returns Detection
  // --------------------------------------------------------------------------

  /**
   * Check if quality improvements have stagnated
   * Returns true if we should stop early due to diminishing returns
   */
  private shouldStopEarly(): boolean {
    // Need at least 2 iterations to compare
    if (this.qualityHistory.length < 2) {
      return false;
    }

    // Check last 3 iterations (or all if fewer)
    const recentHistory = this.qualityHistory.slice(-3);

    // If quality hasn't improved by more than 1% in recent iterations, stop
    const minScore = Math.min(...recentHistory);
    const maxScore = Math.max(...recentHistory);
    const improvement = maxScore - minScore;

    // Diminishing returns: less than 2% improvement over recent iterations
    if (improvement < 2 && this.state.iteration >= 2) {
      return true;
    }

    // Quality actually decreased - stop to prevent thrashing
    if (recentHistory.length >= 2) {
      const lastTwo = recentHistory.slice(-2);
      if (lastTwo[1] < lastTwo[0] - 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Record quality score for diminishing returns tracking
   */
  private recordQualityScore(score: number): void {
    this.qualityHistory.push(score);
  }

  /**
   * Get quality improvement trend
   */
  getQualityTrend(): { improving: boolean; delta: number; history: number[] } {
    const history = [...this.qualityHistory];
    if (history.length < 2) {
      return { improving: true, delta: 0, history };
    }
    const delta = history[history.length - 1] - history[history.length - 2];
    return { improving: delta > 0, delta, history };
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

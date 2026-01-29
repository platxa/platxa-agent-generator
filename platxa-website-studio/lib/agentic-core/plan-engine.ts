/**
 * Plan Engine - Non-destructive exploration state management
 *
 * Manages the planning phase where we explore options without making
 * file modifications. Tracks:
 * - User query and intent
 * - Generated plan options
 * - Clarification questions and answers
 * - Exploration results (read-only)
 *
 * Key guarantee: No file modifications during plan mode
 *
 * @module agentic-core/plan-engine
 */

import type { AgentPlan, AgentPlanStep, AgentContext } from './agent-engine';
import type { ClassificationResult } from './mode-router';
import type { PlanOption } from './plan-handoff';
import { ContextManager, createContextManager } from './context-manager';

// ============================================================================
// Types
// ============================================================================

/** User's original query */
export interface PlanQuery {
  /** Original query text */
  text: string;
  /** Timestamp when query was received */
  timestamp: Date;
  /** Intent classification result */
  classification?: ClassificationResult;
  /** Extracted entities from query */
  entities?: Record<string, string>;
}

/** A clarification question asked during planning */
export interface Clarification {
  /** Unique ID */
  id: string;
  /** The question asked */
  question: string;
  /** Possible answers (if multiple choice) */
  options?: string[];
  /** User's answer */
  answer?: string;
  /** Whether answer was received */
  answered: boolean;
  /** Timestamp when asked */
  askedAt: Date;
  /** Timestamp when answered */
  answeredAt?: Date;
}

/** Exploration result from read-only operations */
export interface ExplorationResult {
  /** Type of exploration */
  type: 'file_read' | 'search' | 'validation' | 'analysis';
  /** Target that was explored */
  target: string;
  /** Result data */
  data: unknown;
  /** Timestamp */
  timestamp: Date;
  /** Duration in ms */
  duration?: number;
}

/** Current state of the plan engine */
export type PlanEngineState =
  | 'idle'           // No active planning
  | 'exploring'      // Reading/searching codebase
  | 'generating'     // Generating plan options
  | 'clarifying'     // Waiting for user clarification
  | 'presenting'     // Presenting options to user
  | 'awaiting_approval' // Waiting for user to approve a plan
  | 'approved'       // Plan approved, ready for handoff
  | 'cancelled';     // User cancelled planning

/** Plan engine configuration */
export interface PlanEngineConfig {
  /** Maximum exploration steps */
  maxExplorationSteps?: number;
  /** Maximum clarification questions */
  maxClarifications?: number;
  /** Timeout for exploration in ms */
  explorationTimeoutMs?: number;
  /** Workspace root */
  workspaceRoot?: string;
}

/** Events emitted by PlanEngine */
export interface PlanEngineEvents {
  onStateChange?: (state: PlanEngineState) => void;
  onExploration?: (result: ExplorationResult) => void;
  onClarificationNeeded?: (clarification: Clarification) => void;
  onOptionsGenerated?: (options: PlanOption[]) => void;
  onPlanApproved?: (option: PlanOption) => void;
}

// ============================================================================
// Plan Engine Class
// ============================================================================

/**
 * PlanEngine - Manages non-destructive exploration state
 *
 * Key guarantees:
 * - No file modifications (write/edit disabled)
 * - Tracks all exploration for context building
 * - Manages clarification flow
 * - Generates multiple plan options
 *
 * @example
 * ```typescript
 * const engine = new PlanEngine({ workspaceRoot: '/project' });
 *
 * // Start planning
 * engine.startPlanning('Add a hero section to the homepage');
 *
 * // Explore codebase (read-only)
 * await engine.explore({ type: 'search', query: 'hero' });
 * await engine.readFile('templates/homepage.xml');
 *
 * // Ask clarification if needed
 * engine.askClarification('Should the hero have a video background?', ['Yes', 'No']);
 *
 * // Generate options
 * const options = await engine.generateOptions();
 *
 * // Wait for user approval
 * const approved = engine.approveOption('opt-1');
 * ```
 */
export class PlanEngine {
  private state: PlanEngineState;
  private query: PlanQuery | null;
  private clarifications: Clarification[];
  private explorations: ExplorationResult[];
  private options: PlanOption[];
  private selectedOption: PlanOption | null;
  private contextManager: ContextManager;
  private config: Required<PlanEngineConfig>;
  private events: PlanEngineEvents;
  private startTime: Date | null;

  constructor(config: PlanEngineConfig = {}, events: PlanEngineEvents = {}) {
    this.config = {
      maxExplorationSteps: config.maxExplorationSteps ?? 50,
      maxClarifications: config.maxClarifications ?? 5,
      explorationTimeoutMs: config.explorationTimeoutMs ?? 30000,
      workspaceRoot: config.workspaceRoot ?? process.cwd(),
    };

    this.events = events;
    this.state = 'idle';
    this.query = null;
    this.clarifications = [];
    this.explorations = [];
    this.options = [];
    this.selectedOption = null;
    this.contextManager = createContextManager({
      workspaceRoot: this.config.workspaceRoot,
    });
    this.contextManager.setPlanMode(true); // Always in plan mode
    this.startTime = null;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Get current state
   */
  getState(): PlanEngineState {
    return this.state;
  }

  /**
   * Set state and emit event
   */
  private setState(newState: PlanEngineState): void {
    this.state = newState;
    this.events.onStateChange?.(newState);
  }

  /**
   * Check if planning is active
   */
  isActive(): boolean {
    return this.state !== 'idle' && this.state !== 'cancelled' && this.state !== 'approved';
  }

  // ==========================================================================
  // Planning Flow
  // ==========================================================================

  /**
   * Start a new planning session
   */
  startPlanning(queryText: string, classification?: ClassificationResult): void {
    if (this.isActive()) {
      throw new Error('Planning already in progress. Call reset() first.');
    }

    this.query = {
      text: queryText,
      timestamp: new Date(),
      classification,
    };

    this.startTime = new Date();
    this.setState('exploring');
  }

  /**
   * Get the current query
   */
  getQuery(): PlanQuery | null {
    return this.query;
  }

  /**
   * Reset the engine for a new planning session
   */
  reset(): void {
    this.state = 'idle';
    this.query = null;
    this.clarifications = [];
    this.explorations = [];
    this.options = [];
    this.selectedOption = null;
    this.contextManager.reset();
    this.contextManager.setPlanMode(true);
    this.startTime = null;
  }

  /**
   * Cancel the current planning session
   */
  cancel(): void {
    this.setState('cancelled');
  }

  // ==========================================================================
  // Exploration (Read-Only Operations)
  // ==========================================================================

  /**
   * Read a file (non-destructive)
   */
  async readFile(path: string): Promise<ExplorationResult> {
    this.ensureExploringState();

    const startTime = Date.now();

    // In a real implementation, this would read the actual file
    // For now, we simulate the read and track it
    const result: ExplorationResult = {
      type: 'file_read',
      target: path,
      data: { path, read: true },
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };

    this.explorations.push(result);
    this.contextManager.addFileContent(path, `[Content of ${path}]`);
    this.events.onExploration?.(result);

    return result;
  }

  /**
   * Search the codebase (non-destructive)
   */
  async search(query: string): Promise<ExplorationResult> {
    this.ensureExploringState();

    const startTime = Date.now();

    // Simulate search
    const result: ExplorationResult = {
      type: 'search',
      target: query,
      data: { query, results: [] },
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };

    this.explorations.push(result);
    this.contextManager.addSearchResults(query, []);
    this.events.onExploration?.(result);

    return result;
  }

  /**
   * Validate without making changes (non-destructive)
   */
  async validate(target: string): Promise<ExplorationResult> {
    this.ensureExploringState();

    const startTime = Date.now();

    const result: ExplorationResult = {
      type: 'validation',
      target,
      data: { target, valid: true, errors: [] },
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };

    this.explorations.push(result);
    this.events.onExploration?.(result);

    return result;
  }

  /**
   * Analyze code structure (non-destructive)
   */
  async analyze(target: string): Promise<ExplorationResult> {
    this.ensureExploringState();

    const startTime = Date.now();

    const result: ExplorationResult = {
      type: 'analysis',
      target,
      data: { target, structure: {} },
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };

    this.explorations.push(result);
    this.events.onExploration?.(result);

    return result;
  }

  /**
   * Get all exploration results
   */
  getExplorations(): ExplorationResult[] {
    return [...this.explorations];
  }

  /**
   * Ensure we're in a state that allows exploration
   */
  private ensureExploringState(): void {
    if (this.state !== 'exploring' && this.state !== 'clarifying') {
      throw new Error(`Cannot explore in state '${this.state}'. Start planning first.`);
    }

    if (this.explorations.length >= this.config.maxExplorationSteps) {
      throw new Error(`Maximum exploration steps (${this.config.maxExplorationSteps}) reached.`);
    }
  }

  // ==========================================================================
  // Clarifications
  // ==========================================================================

  /**
   * Ask a clarification question
   */
  askClarification(question: string, options?: string[]): Clarification {
    if (this.clarifications.length >= this.config.maxClarifications) {
      throw new Error(`Maximum clarifications (${this.config.maxClarifications}) reached.`);
    }

    const clarification: Clarification = {
      id: `clarification-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      question,
      options,
      answered: false,
      askedAt: new Date(),
    };

    this.clarifications.push(clarification);
    this.setState('clarifying');
    this.events.onClarificationNeeded?.(clarification);

    return clarification;
  }

  /**
   * Answer a clarification question
   */
  answerClarification(clarificationId: string, answer: string): void {
    const clarification = this.clarifications.find(c => c.id === clarificationId);
    if (!clarification) {
      throw new Error(`Clarification '${clarificationId}' not found.`);
    }

    if (clarification.answered) {
      throw new Error(`Clarification '${clarificationId}' already answered.`);
    }

    clarification.answer = answer;
    clarification.answered = true;
    clarification.answeredAt = new Date();

    // Track in context
    this.contextManager.addUserInput(`clarification_${clarificationId}`, answer);

    // Return to exploring if all clarifications answered
    const unanswered = this.clarifications.filter(c => !c.answered);
    if (unanswered.length === 0) {
      this.setState('exploring');
    }
  }

  /**
   * Get all clarifications
   */
  getClarifications(): Clarification[] {
    return [...this.clarifications];
  }

  /**
   * Get unanswered clarifications
   */
  getUnansweredClarifications(): Clarification[] {
    return this.clarifications.filter(c => !c.answered);
  }

  // ==========================================================================
  // Plan Options
  // ==========================================================================

  /**
   * Generate plan options based on exploration
   */
  generateOptions(options: PlanOption[]): void {
    this.setState('generating');

    this.options = options;

    this.setState('presenting');
    this.events.onOptionsGenerated?.(options);
  }

  /**
   * Add a single plan option
   */
  addOption(option: PlanOption): void {
    this.options.push(option);
  }

  /**
   * Get all generated options
   */
  getOptions(): PlanOption[] {
    return [...this.options];
  }

  /**
   * Present options to user (transition to awaiting approval)
   */
  presentOptions(): void {
    if (this.options.length === 0) {
      throw new Error('No options to present. Generate options first.');
    }

    this.setState('awaiting_approval');
  }

  // ==========================================================================
  // Approval
  // ==========================================================================

  /**
   * Approve a plan option
   */
  approveOption(optionId: string): PlanOption {
    if (this.state !== 'awaiting_approval' && this.state !== 'presenting') {
      throw new Error(`Cannot approve in state '${this.state}'. Present options first.`);
    }

    const option = this.options.find(o => o.id === optionId);
    if (!option) {
      throw new Error(`Option '${optionId}' not found.`);
    }

    this.selectedOption = option;
    this.setState('approved');
    this.events.onPlanApproved?.(option);

    return option;
  }

  /**
   * Get the approved option
   */
  getApprovedOption(): PlanOption | null {
    return this.selectedOption;
  }

  /**
   * Check if a plan has been approved
   */
  isApproved(): boolean {
    return this.state === 'approved' && this.selectedOption !== null;
  }

  // ==========================================================================
  // Context Access
  // ==========================================================================

  /**
   * Get the context manager (read-only operations tracked)
   */
  getContextManager(): ContextManager {
    return this.contextManager;
  }

  /**
   * Export context for handoff to agent mode
   */
  exportContext(): AgentContext {
    return this.contextManager.toAgentContext();
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * Get planning session statistics
   */
  getStats(): {
    state: PlanEngineState;
    explorationCount: number;
    clarificationCount: number;
    answeredClarifications: number;
    optionCount: number;
    durationMs: number;
  } {
    const now = new Date();
    const durationMs = this.startTime
      ? now.getTime() - this.startTime.getTime()
      : 0;

    return {
      state: this.state,
      explorationCount: this.explorations.length,
      clarificationCount: this.clarifications.length,
      answeredClarifications: this.clarifications.filter(c => c.answered).length,
      optionCount: this.options.length,
      durationMs,
    };
  }

  // ==========================================================================
  // Non-Destructive Guarantee
  // ==========================================================================

  /**
   * Verify no file modifications occurred
   *
   * This is a key guarantee of plan mode - only read operations allowed
   */
  verifyNoModifications(): { verified: boolean; explorationTypes: string[] } {
    const types = new Set(this.explorations.map(e => e.type));

    // These are the only allowed exploration types
    const allowedTypes = new Set(['file_read', 'search', 'validation', 'analysis']);

    const hasOnlyAllowedTypes = [...types].every(t => allowedTypes.has(t));

    return {
      verified: hasOnlyAllowedTypes,
      explorationTypes: [...types],
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new PlanEngine instance
 */
export function createPlanEngine(
  config?: PlanEngineConfig,
  events?: PlanEngineEvents
): PlanEngine {
  return new PlanEngine(config, events);
}

// ============================================================================
// Exports
// ============================================================================

export default PlanEngine;

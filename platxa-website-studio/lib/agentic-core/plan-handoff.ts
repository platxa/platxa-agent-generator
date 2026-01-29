/**
 * Plan Handoff - Seamless transition from plan mode to agent mode
 *
 * Handles the handoff when a plan is approved in plan mode:
 * - Preserves full context gathered during planning
 * - Transfers selected plan option for execution
 * - Transitions from read-only (planMode=true) to full execution (planMode=false)
 *
 * @module agentic-core/plan-handoff
 */

import type { AgentContext, AgentPlan, AgentPlanStep } from './agent-engine';
import type { ClassificationResult } from './mode-router';
import type { ContextBuildResult } from './context-builder';
import { AGENT_MODE_TOOLS, ALL_TOOLS } from './context-builder';

// ============================================================================
// Types
// ============================================================================

/** A plan option presented to the user during plan mode */
export interface PlanOption {
  /** Unique identifier for this option */
  id: string;
  /** Display label for the option */
  label: string;
  /** Description of what this option does */
  description: string;
  /** The execution plan for this option */
  plan: AgentPlan;
  /** Estimated complexity (1-5) */
  complexity?: number;
  /** Risk level assessment */
  riskLevel?: 'low' | 'medium' | 'high';
  /** Files that will be modified */
  affectedFiles?: string[];
}

/** User's selection when approving a plan */
export interface PlanApproval {
  /** The selected option ID */
  selectedOptionId: string;
  /** User's confirmation message (optional) */
  confirmationMessage?: string;
  /** Any user modifications to the plan */
  modifications?: Partial<AgentPlan>;
  /** Timestamp of approval */
  approvedAt: Date;
}

/** Context from planning phase to preserve */
export interface PlanningContext {
  /** Files read during exploration */
  filesRead: Map<string, string>;
  /** Search results cached */
  searchResults: Map<string, unknown[]>;
  /** Classification result from intent detection */
  classification?: ClassificationResult;
  /** Original user goal */
  goal: string;
  /** Workspace root */
  workspaceRoot: string;
  /** Any user preferences gathered */
  userPreferences?: Record<string, unknown>;
  /** Odoo-specific context discovered */
  odooContext?: {
    version?: string;
    modules?: string[];
    theme?: string;
    snippets?: string[];
  };
}

/** Result of the handoff operation */
export interface HandoffResult {
  /** Agent context ready for execution */
  context: AgentContext;
  /** The approved plan to execute */
  plan: AgentPlan;
  /** The selected option (if multiple were presented) */
  selectedOption?: PlanOption;
  /** Handoff metadata */
  metadata: {
    /** Time the handoff occurred */
    handoffAt: Date;
    /** Original mode before handoff */
    fromMode: 'plan';
    /** Target mode after handoff */
    toMode: 'agent';
    /** Context items preserved */
    preservedContextKeys: string[];
  };
  /** Tools enabled after handoff */
  enabledTools: string[];
}

/** Options for configuring handoff behavior */
export interface HandoffOptions {
  /** Maximum iterations for agent execution */
  maxIterations?: number;
  /** Whether to deep copy context (default: true) */
  deepCopyContext?: boolean;
  /** Additional context to merge */
  additionalContext?: Partial<AgentContext>;
}

// ============================================================================
// Plan Handoff Class
// ============================================================================

/**
 * PlanHandoff - Manages seamless transition from plan mode to agent mode
 *
 * @example
 * ```typescript
 * const handoff = new PlanHandoff();
 *
 * // During planning, present options to user
 * const options = [
 *   { id: 'opt-1', label: 'Quick Fix', plan: quickPlan, ... },
 *   { id: 'opt-2', label: 'Full Refactor', plan: refactorPlan, ... },
 * ];
 *
 * // User approves an option
 * const approval = { selectedOptionId: 'opt-1', approvedAt: new Date() };
 *
 * // Handoff to agent mode
 * const result = handoff.execute({
 *   planningContext,
 *   options,
 *   approval,
 * });
 *
 * // result.context has planMode=false, all tools enabled
 * // result.plan is the approved plan ready for execution
 * ```
 */
export class PlanHandoff {
  private defaultOptions: HandoffOptions;

  constructor(options: HandoffOptions = {}) {
    this.defaultOptions = {
      maxIterations: 10,
      deepCopyContext: true,
      ...options,
    };
  }

  /**
   * Execute handoff from plan mode to agent mode
   *
   * @param params - Handoff parameters
   * @returns HandoffResult with agent context and approved plan
   */
  execute(params: {
    planningContext: PlanningContext;
    options: PlanOption[];
    approval: PlanApproval;
    handoffOptions?: HandoffOptions;
  }): HandoffResult {
    const { planningContext, options, approval, handoffOptions } = params;
    const mergedOptions = { ...this.defaultOptions, ...handoffOptions };

    // Find the selected option
    const selectedOption = options.find(opt => opt.id === approval.selectedOptionId);
    if (!selectedOption) {
      throw new Error(
        `Selected option '${approval.selectedOptionId}' not found. ` +
        `Available options: ${options.map(o => o.id).join(', ')}`
      );
    }

    // Apply any user modifications to the plan
    let approvedPlan = selectedOption.plan;
    if (approval.modifications) {
      approvedPlan = this.applyModifications(approvedPlan, approval.modifications);
    }

    // Build agent context from planning context
    const context = this.buildAgentContext(planningContext, mergedOptions);

    // Track what context was preserved
    const preservedContextKeys: string[] = [];
    if (planningContext.filesRead.size > 0) preservedContextKeys.push('filesRead');
    if (planningContext.searchResults.size > 0) preservedContextKeys.push('searchResults');
    if (planningContext.userPreferences) preservedContextKeys.push('userPreferences');
    if (planningContext.odooContext) preservedContextKeys.push('odooContext');
    if (planningContext.classification) preservedContextKeys.push('classification');

    return {
      context,
      plan: approvedPlan,
      selectedOption,
      metadata: {
        handoffAt: new Date(),
        fromMode: 'plan',
        toMode: 'agent',
        preservedContextKeys,
      },
      enabledTools: AGENT_MODE_TOOLS,
    };
  }

  /**
   * Quick handoff with a single plan (no options selection)
   *
   * @param planningContext - Context from planning phase
   * @param plan - The plan to execute
   * @param options - Optional handoff configuration
   */
  executeWithSinglePlan(
    planningContext: PlanningContext,
    plan: AgentPlan,
    options?: HandoffOptions
  ): HandoffResult {
    const singleOption: PlanOption = {
      id: 'single',
      label: 'Approved Plan',
      description: plan.goal,
      plan,
    };

    const approval: PlanApproval = {
      selectedOptionId: 'single',
      approvedAt: new Date(),
    };

    return this.execute({
      planningContext,
      options: [singleOption],
      approval,
      handoffOptions: options,
    });
  }

  /**
   * Build agent context from planning context
   */
  private buildAgentContext(
    planningContext: PlanningContext,
    options: HandoffOptions
  ): AgentContext {
    // Deep copy if requested (default)
    const filesRead = options.deepCopyContext
      ? new Map(planningContext.filesRead)
      : planningContext.filesRead;

    const searchResults = options.deepCopyContext
      ? new Map(planningContext.searchResults)
      : planningContext.searchResults;

    const context: AgentContext = {
      filesRead,
      searchResults,
      userPreferences: planningContext.userPreferences
        ? { ...planningContext.userPreferences }
        : {},
      odooContext: planningContext.odooContext
        ? { ...planningContext.odooContext }
        : {},
      planMode: false, // Key transition: plan mode OFF for execution
    };

    // Merge any additional context
    if (options.additionalContext) {
      Object.assign(context, options.additionalContext);
    }

    return context;
  }

  /**
   * Apply user modifications to a plan
   */
  private applyModifications(
    plan: AgentPlan,
    modifications: Partial<AgentPlan>
  ): AgentPlan {
    const modified: AgentPlan = {
      ...plan,
      ...modifications,
      updatedAt: new Date(),
    };

    // If steps are modified, ensure IDs are preserved
    if (modifications.steps) {
      modified.steps = modifications.steps.map((step, index) => ({
        ...plan.steps[index],
        ...step,
      }));
    }

    return modified;
  }

  /**
   * Validate that a handoff is safe to execute
   */
  validateHandoff(params: {
    planningContext: PlanningContext;
    options: PlanOption[];
    approval: PlanApproval;
  }): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check option exists
    const selectedOption = params.options.find(
      opt => opt.id === params.approval.selectedOptionId
    );
    if (!selectedOption) {
      errors.push(`Selected option '${params.approval.selectedOptionId}' not found`);
    }

    // Check plan has steps
    if (selectedOption && selectedOption.plan.steps.length === 0) {
      warnings.push('Selected plan has no steps to execute');
    }

    // Check for high-risk operations
    if (selectedOption?.riskLevel === 'high') {
      warnings.push('Selected option is marked as high risk');
    }

    // Check context completeness
    if (params.planningContext.filesRead.size === 0) {
      warnings.push('No files were read during planning phase');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create a planning context from a ContextBuildResult
   */
  static fromContextBuildResult(
    result: ContextBuildResult,
    goal: string,
    workspaceRoot: string
  ): PlanningContext {
    return {
      filesRead: result.context.filesRead || new Map(),
      searchResults: result.context.searchResults || new Map(),
      classification: result.classification,
      goal,
      workspaceRoot,
      userPreferences: result.context.userPreferences,
      odooContext: result.context.odooContext,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new PlanHandoff instance
 */
export function createPlanHandoff(options?: HandoffOptions): PlanHandoff {
  return new PlanHandoff(options);
}

/**
 * Quick handoff with single plan (convenience function)
 */
export function handoffPlanToAgent(
  planningContext: PlanningContext,
  plan: AgentPlan,
  options?: HandoffOptions
): HandoffResult {
  return new PlanHandoff(options).executeWithSinglePlan(planningContext, plan, options);
}

/**
 * Full handoff with options selection
 */
export function handoffWithOptions(
  planningContext: PlanningContext,
  options: PlanOption[],
  selectedOptionId: string,
  handoffOptions?: HandoffOptions
): HandoffResult {
  const approval: PlanApproval = {
    selectedOptionId,
    approvedAt: new Date(),
  };

  return new PlanHandoff(handoffOptions).execute({
    planningContext,
    options,
    approval,
    handoffOptions,
  });
}

// ============================================================================
// Exports
// ============================================================================

export default PlanHandoff;

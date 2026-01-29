/**
 * Approval Workflow - Plan approval with approve/modify/cancel actions
 *
 * Manages the plan approval flow with three clear actions:
 * - Approve: Accept the plan and proceed to execution
 * - Modify: Open refinement mode to adjust the plan
 * - Cancel: Abort the planning process
 *
 * @module agentic-core/approval-workflow
 */

import type { AgentPlan } from './agent-engine';
import type { PlanOption, PlanApproval } from './plan-handoff';
import type { DesignOption } from './option-generator';

// ============================================================================
// Types
// ============================================================================

/** Approval action types */
export type ApprovalAction = 'approve' | 'modify' | 'cancel';

/** Workflow state */
export type WorkflowState =
  | 'idle'           // No active workflow
  | 'presenting'     // Showing options to user
  | 'awaiting'       // Waiting for user decision
  | 'modifying'      // User is refining the plan
  | 'approved'       // Plan approved
  | 'cancelled';     // User cancelled

/** An action button definition */
export interface ActionButton {
  /** Action identifier */
  action: ApprovalAction;
  /** Display label */
  label: string;
  /** Button description/tooltip */
  description: string;
  /** Whether this is the primary action */
  primary: boolean;
  /** Whether this action is currently enabled */
  enabled: boolean;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Visual style hint */
  style: 'primary' | 'secondary' | 'danger';
}

/** Modification request from user */
export interface ModificationRequest {
  /** Modification ID */
  id: string;
  /** Type of modification */
  type: 'step_change' | 'step_add' | 'step_remove' | 'reorder' | 'option_switch' | 'custom';
  /** Description of the change */
  description: string;
  /** Target (step ID, option ID, etc.) */
  target?: string;
  /** New value/data */
  value?: unknown;
  /** Timestamp */
  timestamp: Date;
}

/** Refinement session for modify action */
export interface RefinementSession {
  /** Session ID */
  id: string;
  /** Original option being modified */
  originalOptionId: string;
  /** Modifications made */
  modifications: ModificationRequest[];
  /** Current modified plan */
  modifiedPlan: AgentPlan;
  /** Session start time */
  startedAt: Date;
  /** Whether changes have been made */
  hasChanges: boolean;
}

/** Workflow result after completion */
export interface WorkflowResult {
  /** Final state */
  state: 'approved' | 'cancelled';
  /** Action that led to this result */
  action: ApprovalAction;
  /** Selected option (if approved) */
  selectedOption?: PlanOption | DesignOption;
  /** Approval details (if approved) */
  approval?: PlanApproval;
  /** Refinement session (if modified) */
  refinement?: RefinementSession;
  /** Cancellation reason (if cancelled) */
  cancelReason?: string;
  /** Timestamp */
  completedAt: Date;
}

/** Workflow events */
export interface WorkflowEvents {
  onStateChange?: (state: WorkflowState) => void;
  onActionTriggered?: (action: ApprovalAction) => void;
  onModificationStart?: (session: RefinementSession) => void;
  onModificationApplied?: (modification: ModificationRequest) => void;
  onApproved?: (result: WorkflowResult) => void;
  onCancelled?: (result: WorkflowResult) => void;
}

/** Workflow configuration */
export interface ApprovalWorkflowConfig {
  /** Custom button labels */
  buttonLabels?: Partial<Record<ApprovalAction, string>>;
  /** Allow modifications */
  allowModify?: boolean;
  /** Require confirmation for cancel */
  confirmCancel?: boolean;
  /** Auto-approve timeout (ms, 0 = disabled) */
  autoApproveTimeout?: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/** Default button configurations */
const DEFAULT_BUTTONS: Record<ApprovalAction, Omit<ActionButton, 'enabled'>> = {
  approve: {
    action: 'approve',
    label: 'Approve',
    description: 'Accept this plan and proceed to execution',
    primary: true,
    shortcut: 'Enter',
    style: 'primary',
  },
  modify: {
    action: 'modify',
    label: 'Modify',
    description: 'Open refinement mode to adjust the plan',
    primary: false,
    shortcut: 'M',
    style: 'secondary',
  },
  cancel: {
    action: 'cancel',
    label: 'Cancel',
    description: 'Abort the planning process',
    primary: false,
    shortcut: 'Esc',
    style: 'danger',
  },
};

// ============================================================================
// Approval Workflow Class
// ============================================================================

/**
 * ApprovalWorkflow - Manages plan approval with three actions
 *
 * Key features:
 * - Three clear action buttons (approve, modify, cancel)
 * - Modify opens refinement session for plan adjustments
 * - Cancel aborts the workflow
 * - Event-driven state management
 *
 * @example
 * ```typescript
 * const workflow = new ApprovalWorkflow();
 *
 * // Start with options
 * workflow.start(planOptions);
 *
 * // Get buttons to display
 * const buttons = workflow.getButtons();
 * // [{ action: 'approve', label: 'Approve', ... }, ...]
 *
 * // Handle user action
 * workflow.handleAction('approve', selectedOptionId);
 *
 * // Or modify
 * workflow.handleAction('modify', selectedOptionId);
 * workflow.applyModification({ type: 'step_change', ... });
 * workflow.finishModification();
 *
 * // Or cancel
 * workflow.handleAction('cancel');
 * ```
 */
export class ApprovalWorkflow {
  private state: WorkflowState;
  private options: (PlanOption | DesignOption)[];
  private selectedOptionId: string | null;
  private refinementSession: RefinementSession | null;
  private result: WorkflowResult | null;
  private events: WorkflowEvents;
  private config: Required<ApprovalWorkflowConfig>;
  private autoApproveTimer: ReturnType<typeof setTimeout> | null;

  constructor(config: ApprovalWorkflowConfig = {}, events: WorkflowEvents = {}) {
    this.config = {
      buttonLabels: config.buttonLabels ?? {},
      allowModify: config.allowModify ?? true,
      confirmCancel: config.confirmCancel ?? false,
      autoApproveTimeout: config.autoApproveTimeout ?? 0,
    };
    this.events = events;
    this.state = 'idle';
    this.options = [];
    this.selectedOptionId = null;
    this.refinementSession = null;
    this.result = null;
    this.autoApproveTimer = null;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Get current workflow state
   */
  getState(): WorkflowState {
    return this.state;
  }

  /**
   * Set state and emit event
   */
  private setState(newState: WorkflowState): void {
    this.state = newState;
    this.events.onStateChange?.(newState);
  }

  /**
   * Check if workflow is active
   */
  isActive(): boolean {
    return this.state !== 'idle' && this.state !== 'approved' && this.state !== 'cancelled';
  }

  /**
   * Check if workflow is complete
   */
  isComplete(): boolean {
    return this.state === 'approved' || this.state === 'cancelled';
  }

  // ==========================================================================
  // Workflow Control
  // ==========================================================================

  /**
   * Start the approval workflow with options
   */
  start(options: (PlanOption | DesignOption)[]): void {
    if (this.isActive()) {
      throw new Error('Workflow already active. Call reset() first.');
    }

    this.options = options;
    this.selectedOptionId = null;
    this.refinementSession = null;
    this.result = null;

    this.setState('presenting');

    // Start auto-approve timer if configured
    if (this.config.autoApproveTimeout > 0 && options.length > 0) {
      this.startAutoApproveTimer();
    }
  }

  /**
   * Present options and await user decision
   */
  awaitDecision(): void {
    if (this.state !== 'presenting') {
      throw new Error(`Cannot await decision in state '${this.state}'`);
    }

    this.setState('awaiting');
  }

  /**
   * Reset the workflow
   */
  reset(): void {
    this.cancelAutoApproveTimer();
    this.state = 'idle';
    this.options = [];
    this.selectedOptionId = null;
    this.refinementSession = null;
    this.result = null;
  }

  // ==========================================================================
  // Button Management
  // ==========================================================================

  /**
   * Get the three action buttons
   */
  getButtons(): ActionButton[] {
    const buttons: ActionButton[] = [];

    // Approve button
    buttons.push({
      ...DEFAULT_BUTTONS.approve,
      label: this.config.buttonLabels.approve ?? DEFAULT_BUTTONS.approve.label,
      enabled: this.canApprove(),
    });

    // Modify button (if allowed)
    if (this.config.allowModify) {
      buttons.push({
        ...DEFAULT_BUTTONS.modify,
        label: this.config.buttonLabels.modify ?? DEFAULT_BUTTONS.modify.label,
        enabled: this.canModify(),
      });
    }

    // Cancel button
    buttons.push({
      ...DEFAULT_BUTTONS.cancel,
      label: this.config.buttonLabels.cancel ?? DEFAULT_BUTTONS.cancel.label,
      enabled: this.canCancel(),
    });

    return buttons;
  }

  /**
   * Get a specific button
   */
  getButton(action: ApprovalAction): ActionButton | undefined {
    return this.getButtons().find(b => b.action === action);
  }

  /**
   * Check if approve action is available
   */
  canApprove(): boolean {
    return (
      (this.state === 'awaiting' || this.state === 'presenting' || this.state === 'modifying') &&
      this.options.length > 0
    );
  }

  /**
   * Check if modify action is available
   */
  canModify(): boolean {
    return (
      this.config.allowModify &&
      (this.state === 'awaiting' || this.state === 'presenting') &&
      this.options.length > 0
    );
  }

  /**
   * Check if cancel action is available
   */
  canCancel(): boolean {
    return this.state !== 'idle' && this.state !== 'cancelled' && this.state !== 'approved';
  }

  // ==========================================================================
  // Action Handlers
  // ==========================================================================

  /**
   * Handle a user action
   */
  handleAction(action: ApprovalAction, optionId?: string, data?: unknown): WorkflowResult | void {
    this.events.onActionTriggered?.(action);
    this.cancelAutoApproveTimer();

    switch (action) {
      case 'approve':
        return this.handleApprove(optionId);
      case 'modify':
        return this.handleModify(optionId);
      case 'cancel':
        return this.handleCancel(data as string | undefined);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Handle approve action
   */
  private handleApprove(optionId?: string): WorkflowResult {
    if (!this.canApprove()) {
      throw new Error(`Cannot approve in state '${this.state}'`);
    }

    // Use provided optionId or first option
    const selectedId = optionId ?? this.options[0]?.id;
    if (!selectedId) {
      throw new Error('No option to approve');
    }

    const selectedOption = this.options.find(o => o.id === selectedId);
    if (!selectedOption) {
      throw new Error(`Option '${selectedId}' not found`);
    }

    this.selectedOptionId = selectedId;

    // Create approval
    const approval: PlanApproval = {
      selectedOptionId: selectedId,
      approvedAt: new Date(),
    };

    // If we were modifying, include modifications
    if (this.refinementSession?.hasChanges) {
      approval.modifications = {
        steps: this.refinementSession.modifiedPlan.steps,
      };
    }

    // Create result
    this.result = {
      state: 'approved',
      action: 'approve',
      selectedOption,
      approval,
      refinement: this.refinementSession ?? undefined,
      completedAt: new Date(),
    };

    this.setState('approved');
    this.events.onApproved?.(this.result);

    return this.result;
  }

  /**
   * Handle modify action - opens refinement session
   */
  private handleModify(optionId?: string): void {
    if (!this.canModify()) {
      throw new Error(`Cannot modify in state '${this.state}'`);
    }

    // Use provided optionId or first option
    const selectedId = optionId ?? this.options[0]?.id;
    if (!selectedId) {
      throw new Error('No option to modify');
    }

    const selectedOption = this.options.find(o => o.id === selectedId);
    if (!selectedOption) {
      throw new Error(`Option '${selectedId}' not found`);
    }

    this.selectedOptionId = selectedId;

    // Get the plan from the option
    const plan = this.getPlanFromOption(selectedOption);

    // Create refinement session
    this.refinementSession = {
      id: `refine-${Date.now()}`,
      originalOptionId: selectedId,
      modifications: [],
      modifiedPlan: { ...plan, steps: [...plan.steps] },
      startedAt: new Date(),
      hasChanges: false,
    };

    this.setState('modifying');
    this.events.onModificationStart?.(this.refinementSession);
  }

  /**
   * Handle cancel action
   */
  private handleCancel(reason?: string): WorkflowResult {
    if (!this.canCancel()) {
      throw new Error(`Cannot cancel in state '${this.state}'`);
    }

    this.result = {
      state: 'cancelled',
      action: 'cancel',
      cancelReason: reason ?? 'User cancelled',
      completedAt: new Date(),
    };

    this.setState('cancelled');
    this.events.onCancelled?.(this.result);

    return this.result;
  }

  // ==========================================================================
  // Modification/Refinement
  // ==========================================================================

  /**
   * Apply a modification to the plan
   */
  applyModification(modification: Omit<ModificationRequest, 'id' | 'timestamp'>): void {
    if (this.state !== 'modifying' || !this.refinementSession) {
      throw new Error('Not in modification mode');
    }

    const fullModification: ModificationRequest = {
      ...modification,
      id: `mod-${Date.now()}-${this.refinementSession.modifications.length}`,
      timestamp: new Date(),
    };

    this.refinementSession.modifications.push(fullModification);
    this.refinementSession.hasChanges = true;

    // Apply to modified plan
    this.applyModificationToPlan(fullModification);

    this.events.onModificationApplied?.(fullModification);
  }

  /**
   * Apply modification to the plan object
   */
  private applyModificationToPlan(modification: ModificationRequest): void {
    if (!this.refinementSession) return;

    const plan = this.refinementSession.modifiedPlan;

    switch (modification.type) {
      case 'step_change':
        if (modification.target) {
          const stepIndex = plan.steps.findIndex(s => s.id === modification.target);
          if (stepIndex !== -1 && modification.value) {
            plan.steps[stepIndex] = {
              ...plan.steps[stepIndex],
              ...(modification.value as Partial<typeof plan.steps[0]>),
            };
          }
        }
        break;

      case 'step_add':
        if (modification.value) {
          plan.steps.push(modification.value as typeof plan.steps[0]);
        }
        break;

      case 'step_remove':
        if (modification.target) {
          const removeIndex = plan.steps.findIndex(s => s.id === modification.target);
          if (removeIndex !== -1) {
            plan.steps.splice(removeIndex, 1);
          }
        }
        break;

      case 'reorder':
        if (modification.value && Array.isArray(modification.value)) {
          const newOrder = modification.value as string[];
          const reordered = newOrder
            .map(id => plan.steps.find(s => s.id === id))
            .filter(Boolean) as typeof plan.steps;
          plan.steps = reordered;
        }
        break;

      case 'custom':
        // Custom modifications are recorded but not auto-applied
        break;
    }
  }

  /**
   * Finish modification and return to awaiting
   */
  finishModification(): void {
    if (this.state !== 'modifying') {
      throw new Error('Not in modification mode');
    }

    this.setState('awaiting');
  }

  /**
   * Cancel modification and discard changes
   */
  cancelModification(): void {
    if (this.state !== 'modifying') {
      throw new Error('Not in modification mode');
    }

    // Discard the refinement session
    this.refinementSession = null;
    this.setState('awaiting');
  }

  /**
   * Get current refinement session
   */
  getRefinementSession(): RefinementSession | null {
    return this.refinementSession;
  }

  /**
   * Check if there are unsaved modifications
   */
  hasUnsavedModifications(): boolean {
    return this.refinementSession?.hasChanges ?? false;
  }

  // ==========================================================================
  // Results
  // ==========================================================================

  /**
   * Get the workflow result
   */
  getResult(): WorkflowResult | null {
    return this.result;
  }

  /**
   * Get selected option
   */
  getSelectedOption(): PlanOption | DesignOption | null {
    if (!this.selectedOptionId) return null;
    return this.options.find(o => o.id === this.selectedOptionId) ?? null;
  }

  /**
   * Get all options
   */
  getOptions(): (PlanOption | DesignOption)[] {
    return [...this.options];
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Extract plan from option (works with both PlanOption and DesignOption)
   */
  private getPlanFromOption(option: PlanOption | DesignOption): AgentPlan {
    if ('plan' in option) {
      return option.plan;
    }
    throw new Error('Option does not contain a plan');
  }

  /**
   * Start auto-approve timer
   */
  private startAutoApproveTimer(): void {
    if (this.config.autoApproveTimeout <= 0) return;

    this.autoApproveTimer = setTimeout(() => {
      if (this.canApprove()) {
        // Auto-approve with recommended/first option
        const recommended = this.options.find(o => 'recommended' in o && o.recommended);
        this.handleApprove(recommended?.id ?? this.options[0]?.id);
      }
    }, this.config.autoApproveTimeout);
  }

  /**
   * Cancel auto-approve timer
   */
  private cancelAutoApproveTimer(): void {
    if (this.autoApproveTimer) {
      clearTimeout(this.autoApproveTimer);
      this.autoApproveTimer = null;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }

  /**
   * Check if confirmation is needed for cancel
   */
  needsCancelConfirmation(): boolean {
    return this.config.confirmCancel && this.hasUnsavedModifications();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ApprovalWorkflow instance
 */
export function createApprovalWorkflow(
  config?: ApprovalWorkflowConfig,
  events?: WorkflowEvents
): ApprovalWorkflow {
  return new ApprovalWorkflow(config, events);
}

/**
 * Create workflow and start with options
 */
export function startApprovalWorkflow(
  options: (PlanOption | DesignOption)[],
  config?: ApprovalWorkflowConfig,
  events?: WorkflowEvents
): ApprovalWorkflow {
  const workflow = new ApprovalWorkflow(config, events);
  workflow.start(options);
  return workflow;
}

// ============================================================================
// Exports
// ============================================================================

export default ApprovalWorkflow;

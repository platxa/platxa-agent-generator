/**
 * Tests for ApprovalWorkflow
 *
 * Verifies:
 * - Three clear buttons (approve, modify, cancel)
 * - Modify opens refinement
 * - Cancel aborts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ApprovalWorkflow,
  createApprovalWorkflow,
  startApprovalWorkflow,
  type ApprovalAction,
  type WorkflowState,
  type ActionButton,
  type WorkflowResult,
  type RefinementSession,
} from '../../lib/agentic-core/approval-workflow';
import type { PlanOption } from '../../lib/agentic-core/plan-handoff';
import type { DesignOption } from '../../lib/agentic-core/option-generator';

describe('ApprovalWorkflow', () => {
  let workflow: ApprovalWorkflow;

  // Helper to create test options
  function createTestOptions(): PlanOption[] {
    return [
      {
        id: 'opt-1',
        label: 'Option 1',
        description: 'First option',
        plan: {
          id: 'plan-1',
          goal: 'Test goal',
          steps: [
            { id: 'step-1', action: 'read_file', target: 'test.xml', rationale: 'Read', status: 'pending' },
            { id: 'step-2', action: 'edit_file', target: 'test.xml', rationale: 'Edit', status: 'pending' },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        id: 'opt-2',
        label: 'Option 2',
        description: 'Second option',
        plan: {
          id: 'plan-2',
          goal: 'Test goal 2',
          steps: [
            { id: 'step-1', action: 'write_file', target: 'new.xml', rationale: 'Create', status: 'pending' },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];
  }

  beforeEach(() => {
    workflow = new ApprovalWorkflow();
  });

  // ==========================================================================
  // Three Clear Buttons (Verification Requirement)
  // ==========================================================================

  describe('three clear buttons', () => {
    it('provides exactly three action buttons by default', () => {
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();

      expect(buttons.length).toBe(3);
    });

    it('has approve button', () => {
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();
      const approveButton = buttons.find(b => b.action === 'approve');

      expect(approveButton).toBeDefined();
      expect(approveButton?.label).toBe('Approve');
      expect(approveButton?.style).toBe('primary');
    });

    it('has modify button', () => {
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();
      const modifyButton = buttons.find(b => b.action === 'modify');

      expect(modifyButton).toBeDefined();
      expect(modifyButton?.label).toBe('Modify');
      expect(modifyButton?.style).toBe('secondary');
    });

    it('has cancel button', () => {
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();
      const cancelButton = buttons.find(b => b.action === 'cancel');

      expect(cancelButton).toBeDefined();
      expect(cancelButton?.label).toBe('Cancel');
      expect(cancelButton?.style).toBe('danger');
    });

    it('each button has description', () => {
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();

      for (const button of buttons) {
        expect(button.description).toBeDefined();
        expect(button.description.length).toBeGreaterThan(0);
      }
    });

    it('approve is the primary button', () => {
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();
      const primaryButtons = buttons.filter(b => b.primary);

      expect(primaryButtons.length).toBe(1);
      expect(primaryButtons[0].action).toBe('approve');
    });

    it('buttons have keyboard shortcuts', () => {
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();

      const approveButton = buttons.find(b => b.action === 'approve');
      const modifyButton = buttons.find(b => b.action === 'modify');
      const cancelButton = buttons.find(b => b.action === 'cancel');

      expect(approveButton?.shortcut).toBe('Enter');
      expect(modifyButton?.shortcut).toBe('M');
      expect(cancelButton?.shortcut).toBe('Esc');
    });

    it('can get individual button by action', () => {
      workflow.start(createTestOptions());

      const approveButton = workflow.getButton('approve');
      const modifyButton = workflow.getButton('modify');
      const cancelButton = workflow.getButton('cancel');

      expect(approveButton?.action).toBe('approve');
      expect(modifyButton?.action).toBe('modify');
      expect(cancelButton?.action).toBe('cancel');
    });
  });

  // ==========================================================================
  // Approve Action
  // ==========================================================================

  describe('approve action', () => {
    it('handleAction with approve completes workflow', () => {
      workflow.start(createTestOptions());

      const result = workflow.handleAction('approve', 'opt-1');

      expect(result).toBeDefined();
      expect(result?.state).toBe('approved');
      expect(workflow.getState()).toBe('approved');
    });

    it('approve returns selected option', () => {
      workflow.start(createTestOptions());

      const result = workflow.handleAction('approve', 'opt-2');

      expect(result?.selectedOption).toBeDefined();
      expect(result?.selectedOption?.id).toBe('opt-2');
    });

    it('approve creates PlanApproval', () => {
      workflow.start(createTestOptions());

      const result = workflow.handleAction('approve', 'opt-1');

      expect(result?.approval).toBeDefined();
      expect(result?.approval?.selectedOptionId).toBe('opt-1');
      expect(result?.approval?.approvedAt).toBeInstanceOf(Date);
    });

    it('approve with no optionId uses first option', () => {
      workflow.start(createTestOptions());

      const result = workflow.handleAction('approve');

      expect(result?.selectedOption?.id).toBe('opt-1');
    });

    it('approve fires onApproved event', () => {
      const onApproved = vi.fn();
      workflow = new ApprovalWorkflow({}, { onApproved });
      workflow.start(createTestOptions());

      workflow.handleAction('approve', 'opt-1');

      expect(onApproved).toHaveBeenCalledTimes(1);
      expect(onApproved).toHaveBeenCalledWith(expect.objectContaining({
        state: 'approved',
      }));
    });

    it('cannot approve without options', () => {
      workflow.start([]);

      expect(() => workflow.handleAction('approve')).toThrow();
    });

    it('cannot approve invalid option', () => {
      workflow.start(createTestOptions());

      expect(() => workflow.handleAction('approve', 'invalid-id')).toThrow();
    });
  });

  // ==========================================================================
  // Modify Opens Refinement (Verification Requirement)
  // ==========================================================================

  describe('modify opens refinement', () => {
    it('handleAction with modify enters modifying state', () => {
      workflow.start(createTestOptions());

      workflow.handleAction('modify', 'opt-1');

      expect(workflow.getState()).toBe('modifying');
    });

    it('modify creates refinement session', () => {
      workflow.start(createTestOptions());

      workflow.handleAction('modify', 'opt-1');

      const session = workflow.getRefinementSession();
      expect(session).not.toBeNull();
      expect(session?.originalOptionId).toBe('opt-1');
    });

    it('refinement session has unique ID', () => {
      workflow.start(createTestOptions());

      workflow.handleAction('modify', 'opt-1');

      const session = workflow.getRefinementSession();
      expect(session?.id).toBeDefined();
      expect(session?.id.length).toBeGreaterThan(0);
    });

    it('refinement session contains copy of plan', () => {
      workflow.start(createTestOptions());

      workflow.handleAction('modify', 'opt-1');

      const session = workflow.getRefinementSession();
      expect(session?.modifiedPlan).toBeDefined();
      expect(session?.modifiedPlan.steps.length).toBe(2);
    });

    it('refinement session tracks modifications', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      expect(workflow.getRefinementSession()?.modifications).toEqual([]);
      expect(workflow.getRefinementSession()?.hasChanges).toBe(false);
    });

    it('modify fires onModificationStart event', () => {
      const onModificationStart = vi.fn();
      workflow = new ApprovalWorkflow({}, { onModificationStart });
      workflow.start(createTestOptions());

      workflow.handleAction('modify', 'opt-1');

      expect(onModificationStart).toHaveBeenCalledTimes(1);
      expect(onModificationStart).toHaveBeenCalledWith(expect.objectContaining({
        originalOptionId: 'opt-1',
      }));
    });

    it('can apply modifications during refinement', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      workflow.applyModification({
        type: 'step_change',
        description: 'Update target',
        target: 'step-1',
        value: { target: 'new-target.xml' },
      });

      const session = workflow.getRefinementSession();
      expect(session?.modifications.length).toBe(1);
      expect(session?.hasChanges).toBe(true);
    });

    it('modifications are applied to plan', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      workflow.applyModification({
        type: 'step_change',
        description: 'Update target',
        target: 'step-1',
        value: { target: 'changed.xml' },
      });

      const session = workflow.getRefinementSession();
      const step = session?.modifiedPlan.steps.find(s => s.id === 'step-1');
      expect(step?.target).toBe('changed.xml');
    });

    it('can add steps during refinement', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      workflow.applyModification({
        type: 'step_add',
        description: 'Add validation step',
        value: { id: 'step-3', action: 'validate', target: 'test.xml', rationale: 'Validate', status: 'pending' },
      });

      const session = workflow.getRefinementSession();
      expect(session?.modifiedPlan.steps.length).toBe(3);
    });

    it('can remove steps during refinement', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      workflow.applyModification({
        type: 'step_remove',
        description: 'Remove step',
        target: 'step-2',
      });

      const session = workflow.getRefinementSession();
      expect(session?.modifiedPlan.steps.length).toBe(1);
    });

    it('can finish modification and return to awaiting', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      workflow.finishModification();

      expect(workflow.getState()).toBe('awaiting');
    });

    it('can cancel modification and discard changes', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');
      workflow.applyModification({ type: 'step_remove', description: 'Remove', target: 'step-1' });

      workflow.cancelModification();

      expect(workflow.getState()).toBe('awaiting');
      expect(workflow.getRefinementSession()).toBeNull();
    });

    it('approve after modify includes modifications', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');
      workflow.applyModification({
        type: 'step_change',
        description: 'Change',
        target: 'step-1',
        value: { rationale: 'Modified rationale' },
      });
      workflow.finishModification();

      const result = workflow.handleAction('approve', 'opt-1');

      expect(result?.refinement).toBeDefined();
      expect(result?.refinement?.hasChanges).toBe(true);
      expect(result?.approval?.modifications).toBeDefined();
    });
  });

  // ==========================================================================
  // Cancel Aborts (Verification Requirement)
  // ==========================================================================

  describe('cancel aborts', () => {
    it('handleAction with cancel sets cancelled state', () => {
      workflow.start(createTestOptions());

      workflow.handleAction('cancel');

      expect(workflow.getState()).toBe('cancelled');
    });

    it('cancel returns result with cancelled state', () => {
      workflow.start(createTestOptions());

      const result = workflow.handleAction('cancel');

      expect(result).toBeDefined();
      expect(result?.state).toBe('cancelled');
      expect(result?.action).toBe('cancel');
    });

    it('cancel includes reason if provided', () => {
      workflow.start(createTestOptions());

      const result = workflow.handleAction('cancel', undefined, 'User changed mind');

      expect(result?.cancelReason).toBe('User changed mind');
    });

    it('cancel fires onCancelled event', () => {
      const onCancelled = vi.fn();
      workflow = new ApprovalWorkflow({}, { onCancelled });
      workflow.start(createTestOptions());

      workflow.handleAction('cancel');

      expect(onCancelled).toHaveBeenCalledTimes(1);
      expect(onCancelled).toHaveBeenCalledWith(expect.objectContaining({
        state: 'cancelled',
      }));
    });

    it('cancel aborts from modifying state', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      const result = workflow.handleAction('cancel');

      expect(result?.state).toBe('cancelled');
      expect(workflow.getState()).toBe('cancelled');
    });

    it('cannot cancel when not active', () => {
      // Workflow is idle
      expect(workflow.canCancel()).toBe(false);
    });

    it('cannot perform actions after cancel', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('cancel');

      expect(() => workflow.handleAction('approve')).toThrow();
    });

    it('isComplete returns true after cancel', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('cancel');

      expect(workflow.isComplete()).toBe(true);
    });
  });

  // ==========================================================================
  // State Management
  // ==========================================================================

  describe('state management', () => {
    it('starts in idle state', () => {
      expect(workflow.getState()).toBe('idle');
    });

    it('transitions to presenting on start', () => {
      workflow.start(createTestOptions());

      expect(workflow.getState()).toBe('presenting');
    });

    it('transitions to awaiting on awaitDecision', () => {
      workflow.start(createTestOptions());
      workflow.awaitDecision();

      expect(workflow.getState()).toBe('awaiting');
    });

    it('isActive returns true during workflow', () => {
      workflow.start(createTestOptions());

      expect(workflow.isActive()).toBe(true);
    });

    it('isActive returns false after completion', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('approve', 'opt-1');

      expect(workflow.isActive()).toBe(false);
    });

    it('fires onStateChange event', () => {
      const onStateChange = vi.fn();
      workflow = new ApprovalWorkflow({}, { onStateChange });

      workflow.start(createTestOptions());

      expect(onStateChange).toHaveBeenCalledWith('presenting');
    });

    it('fires onActionTriggered event', () => {
      const onActionTriggered = vi.fn();
      workflow = new ApprovalWorkflow({}, { onActionTriggered });
      workflow.start(createTestOptions());

      workflow.handleAction('approve', 'opt-1');

      expect(onActionTriggered).toHaveBeenCalledWith('approve');
    });

    it('cannot start while active', () => {
      workflow.start(createTestOptions());

      expect(() => workflow.start(createTestOptions())).toThrow();
    });

    it('reset clears state', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      workflow.reset();

      expect(workflow.getState()).toBe('idle');
      expect(workflow.getRefinementSession()).toBeNull();
      expect(workflow.getResult()).toBeNull();
    });
  });

  // ==========================================================================
  // Button Enablement
  // ==========================================================================

  describe('button enablement', () => {
    it('buttons are enabled when workflow is active', () => {
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();

      expect(buttons.find(b => b.action === 'approve')?.enabled).toBe(true);
      expect(buttons.find(b => b.action === 'modify')?.enabled).toBe(true);
      expect(buttons.find(b => b.action === 'cancel')?.enabled).toBe(true);
    });

    it('approve disabled without options', () => {
      workflow.start([]);

      expect(workflow.canApprove()).toBe(false);
    });

    it('modify disabled in modifying state', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      expect(workflow.canModify()).toBe(false);
    });

    it('can still approve while modifying', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      expect(workflow.canApprove()).toBe(true);
    });
  });

  // ==========================================================================
  // Configuration
  // ==========================================================================

  describe('configuration', () => {
    it('accepts custom button labels', () => {
      workflow = new ApprovalWorkflow({
        buttonLabels: {
          approve: 'Accept Plan',
          modify: 'Edit Plan',
          cancel: 'Abort',
        },
      });
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();

      expect(buttons.find(b => b.action === 'approve')?.label).toBe('Accept Plan');
      expect(buttons.find(b => b.action === 'modify')?.label).toBe('Edit Plan');
      expect(buttons.find(b => b.action === 'cancel')?.label).toBe('Abort');
    });

    it('allowModify=false hides modify button', () => {
      workflow = new ApprovalWorkflow({ allowModify: false });
      workflow.start(createTestOptions());

      const buttons = workflow.getButtons();

      expect(buttons.length).toBe(2);
      expect(buttons.find(b => b.action === 'modify')).toBeUndefined();
    });

    it('getConfig returns configuration', () => {
      workflow = new ApprovalWorkflow({ allowModify: false });

      expect(workflow.getConfig().allowModify).toBe(false);
    });
  });

  // ==========================================================================
  // Options Management
  // ==========================================================================

  describe('options management', () => {
    it('getOptions returns all options', () => {
      const options = createTestOptions();
      workflow.start(options);

      expect(workflow.getOptions()).toHaveLength(2);
    });

    it('getSelectedOption returns null before selection', () => {
      workflow.start(createTestOptions());

      expect(workflow.getSelectedOption()).toBeNull();
    });

    it('getSelectedOption returns selected after approval', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('approve', 'opt-2');

      expect(workflow.getSelectedOption()?.id).toBe('opt-2');
    });
  });

  // ==========================================================================
  // DesignOption Support
  // ==========================================================================

  describe('DesignOption support', () => {
    it('works with DesignOption', () => {
      const designOptions: DesignOption[] = [
        {
          id: 'design-1',
          name: 'Design Option 1',
          description: 'A design option',
          category: 'standard',
          pros: [],
          cons: [],
          effort: { level: 'medium', fileCount: 2 },
          filesAffected: [],
          plan: {
            id: 'plan-1',
            goal: 'Goal',
            steps: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          riskLevel: 'low',
        },
      ];

      workflow.start(designOptions);
      const result = workflow.handleAction('approve', 'design-1');

      expect(result?.selectedOption?.id).toBe('design-1');
    });
  });

  // ==========================================================================
  // Factory Functions
  // ==========================================================================

  describe('factory functions', () => {
    it('createApprovalWorkflow creates instance', () => {
      const instance = createApprovalWorkflow();
      expect(instance).toBeInstanceOf(ApprovalWorkflow);
    });

    it('createApprovalWorkflow accepts config and events', () => {
      const onApproved = vi.fn();
      const instance = createApprovalWorkflow(
        { allowModify: false },
        { onApproved }
      );

      expect(instance.getConfig().allowModify).toBe(false);
    });

    it('startApprovalWorkflow creates and starts workflow', () => {
      const instance = startApprovalWorkflow(createTestOptions());

      expect(instance.getState()).toBe('presenting');
      expect(instance.getOptions()).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Modification Events
  // ==========================================================================

  describe('modification events', () => {
    it('fires onModificationApplied event', () => {
      const onModificationApplied = vi.fn();
      workflow = new ApprovalWorkflow({}, { onModificationApplied });
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      workflow.applyModification({
        type: 'step_change',
        description: 'Change',
        target: 'step-1',
        value: { rationale: 'New' },
      });

      expect(onModificationApplied).toHaveBeenCalledTimes(1);
    });

    it('hasUnsavedModifications tracks changes', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('modify', 'opt-1');

      expect(workflow.hasUnsavedModifications()).toBe(false);

      workflow.applyModification({
        type: 'step_change',
        description: 'Change',
        target: 'step-1',
        value: {},
      });

      expect(workflow.hasUnsavedModifications()).toBe(true);
    });
  });

  // ==========================================================================
  // Result Access
  // ==========================================================================

  describe('result access', () => {
    it('getResult returns null before completion', () => {
      workflow.start(createTestOptions());

      expect(workflow.getResult()).toBeNull();
    });

    it('getResult returns result after approval', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('approve', 'opt-1');

      const result = workflow.getResult();
      expect(result).not.toBeNull();
      expect(result?.state).toBe('approved');
    });

    it('getResult returns result after cancel', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('cancel');

      const result = workflow.getResult();
      expect(result).not.toBeNull();
      expect(result?.state).toBe('cancelled');
    });

    it('result includes completedAt timestamp', () => {
      workflow.start(createTestOptions());
      workflow.handleAction('approve', 'opt-1');

      expect(workflow.getResult()?.completedAt).toBeInstanceOf(Date);
    });
  });
});

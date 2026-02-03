/**
 * Tests for PlanHandoff
 * Feature #31: Seamless handoff from plan mode approval to agent mode execution
 *
 * Verification: Approved plan transfers to agent with selected option and full context
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlanHandoff,
  createPlanHandoff,
  handoffPlanToAgent,
  handoffWithOptions,
  type PlanOption,
  type PlanApproval,
  type PlanningContext,
  type HandoffResult,
} from '@/lib/agentic-core/plan-handoff';
import { AGENT_MODE_TOOLS } from '@/lib/agentic-core/context-builder';
import type { AgentPlan } from '@/lib/agentic-core/agent-engine';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestPlan(id: string, goal: string): AgentPlan {
  return {
    id,
    goal,
    steps: [
      {
        id: `${id}-step-1`,
        action: 'search',
        target: 'templates/',
        rationale: 'Find relevant templates',
        status: 'pending',
      },
      {
        id: `${id}-step-2`,
        action: 'edit',
        target: 'templates/main.xml',
        rationale: 'Modify the template',
        status: 'pending',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createTestPlanningContext(): PlanningContext {
  const filesRead = new Map<string, string>();
  filesRead.set('templates/main.xml', '<template>content</template>');
  filesRead.set('static/scss/theme.scss', '$primary: #007bff;');

  const searchResults = new Map<string, unknown[]>();
  searchResults.set('template search', [{ file: 'templates/main.xml', matches: 3 }]);

  return {
    filesRead,
    searchResults,
    classification: {
      mode: 'plan',
      confidence: 'high',
      score: 0.95,
      matchedPatterns: ['what if'],
      message: 'Add a hero section to the homepage',
    },
    goal: 'Add a hero section to the homepage',
    workspaceRoot: '/project/theme',
    userPreferences: { preferDarkMode: true },
    odooContext: {
      version: '17.0',
      modules: ['website', 'website_sale'],
      theme: 'theme_starter',
    },
  };
}

function createTestOptions(): PlanOption[] {
  return [
    {
      id: 'opt-quick',
      label: 'Quick Implementation',
      description: 'Add hero section with minimal changes',
      plan: createTestPlan('quick-plan', 'Quick hero implementation'),
      complexity: 2,
      riskLevel: 'low',
      affectedFiles: ['templates/homepage.xml'],
    },
    {
      id: 'opt-full',
      label: 'Full Feature',
      description: 'Add hero with animations and variants',
      plan: createTestPlan('full-plan', 'Full hero with features'),
      complexity: 4,
      riskLevel: 'medium',
      affectedFiles: ['templates/homepage.xml', 'static/scss/hero.scss', 'static/js/hero.js'],
    },
    {
      id: 'opt-refactor',
      label: 'Refactor First',
      description: 'Clean up existing code then add hero',
      plan: createTestPlan('refactor-plan', 'Refactor and add hero'),
      complexity: 5,
      riskLevel: 'high',
      affectedFiles: ['templates/*.xml', 'static/scss/*.scss'],
    },
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe('PlanHandoff', () => {
  describe('constructor', () => {
    it('creates instance with default options', () => {
      const handoff = new PlanHandoff();
      expect(handoff).toBeInstanceOf(PlanHandoff);
    });

    it('accepts custom options', () => {
      const handoff = createPlanHandoff({ maxIterations: 20 });
      expect(handoff).toBeInstanceOf(PlanHandoff);
    });
  });

  describe('execute', () => {
    let handoff: PlanHandoff;
    let planningContext: PlanningContext;
    let options: PlanOption[];

    beforeEach(() => {
      handoff = new PlanHandoff();
      planningContext = createTestPlanningContext();
      options = createTestOptions();
    });

    it('transfers approved plan to agent mode', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.plan).toBeDefined();
      expect(result.plan.id).toBe('quick-plan');
      expect(result.plan.goal).toBe('Quick hero implementation');
    });

    it('preserves selected option metadata', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-full',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.selectedOption).toBeDefined();
      expect(result.selectedOption!.id).toBe('opt-full');
      expect(result.selectedOption!.label).toBe('Full Feature');
      expect(result.selectedOption!.complexity).toBe(4);
      expect(result.selectedOption!.riskLevel).toBe('medium');
    });

    it('sets planMode to false in agent context', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.context.planMode).toBe(false);
    });

    it('enables all tools after handoff', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.enabledTools).toEqual(AGENT_MODE_TOOLS);
      expect(result.enabledTools).toContain('write_file');
      expect(result.enabledTools).toContain('edit_file');
    });

    it('preserves filesRead from planning context', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.context.filesRead.size).toBe(2);
      expect(result.context.filesRead.get('templates/main.xml')).toBe('<template>content</template>');
      expect(result.context.filesRead.get('static/scss/theme.scss')).toBe('$primary: #007bff;');
    });

    it('preserves searchResults from planning context', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.context.searchResults.size).toBe(1);
      expect(result.context.searchResults.get('template search')).toEqual([
        { file: 'templates/main.xml', matches: 3 },
      ]);
    });

    it('preserves userPreferences from planning context', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.context.userPreferences).toEqual({ preferDarkMode: true });
    });

    it('preserves odooContext from planning context', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.context.odooContext).toEqual({
        version: '17.0',
        modules: ['website', 'website_sale'],
        theme: 'theme_starter',
      });
    });

    it('records handoff metadata', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.metadata.fromMode).toBe('plan');
      expect(result.metadata.toMode).toBe('agent');
      expect(result.metadata.handoffAt).toBeInstanceOf(Date);
      expect(result.metadata.preservedContextKeys).toContain('filesRead');
      expect(result.metadata.preservedContextKeys).toContain('searchResults');
      expect(result.metadata.preservedContextKeys).toContain('classification');
    });

    it('throws error for invalid option selection', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-nonexistent',
        approvedAt: new Date(),
      };

      expect(() => handoff.execute({ planningContext, options, approval }))
        .toThrow(/Selected option 'opt-nonexistent' not found/);
    });

    it('applies user modifications to the plan', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
        modifications: {
          goal: 'Modified goal: Add hero with custom styling',
        },
      };

      const result = handoff.execute({ planningContext, options, approval });

      expect(result.plan.goal).toBe('Modified goal: Add hero with custom styling');
    });

    it('deep copies context by default', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      // Modify original context
      planningContext.filesRead.set('new-file.xml', 'new content');

      // Result should not be affected
      expect(result.context.filesRead.has('new-file.xml')).toBe(false);
    });

    it('can disable deep copy for performance', () => {
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({
        planningContext,
        options,
        approval,
        handoffOptions: { deepCopyContext: false },
      });

      // Modify original context
      planningContext.filesRead.set('new-file.xml', 'new content');

      // Result should be affected (same reference)
      expect(result.context.filesRead.has('new-file.xml')).toBe(true);
    });
  });

  describe('executeWithSinglePlan', () => {
    it('handles single plan without options selection', () => {
      const handoff = new PlanHandoff();
      const planningContext = createTestPlanningContext();
      const plan = createTestPlan('single-plan', 'Single plan execution');

      const result = handoff.executeWithSinglePlan(planningContext, plan);

      expect(result.plan.id).toBe('single-plan');
      expect(result.selectedOption!.id).toBe('single');
      expect(result.context.planMode).toBe(false);
    });
  });

  describe('validateHandoff', () => {
    let handoff: PlanHandoff;

    beforeEach(() => {
      handoff = new PlanHandoff();
    });

    it('returns valid for correct handoff', () => {
      const planningContext = createTestPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const validation = handoff.validateHandoff({ planningContext, options, approval });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('returns error for missing option', () => {
      const planningContext = createTestPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-missing',
        approvedAt: new Date(),
      };

      const validation = handoff.validateHandoff({ planningContext, options, approval });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Selected option 'opt-missing' not found");
    });

    it('warns for high-risk option', () => {
      const planningContext = createTestPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-refactor',
        approvedAt: new Date(),
      };

      const validation = handoff.validateHandoff({ planningContext, options, approval });

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Selected option is marked as high risk');
    });

    it('warns for empty planning context', () => {
      const planningContext: PlanningContext = {
        filesRead: new Map(),
        searchResults: new Map(),
        goal: 'Test',
        workspaceRoot: '/project',
      };
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const validation = handoff.validateHandoff({ planningContext, options, approval });

      expect(validation.warnings).toContain('No files were read during planning phase');
    });

    it('warns for empty plan steps', () => {
      const planningContext = createTestPlanningContext();
      const emptyPlanOption: PlanOption = {
        id: 'opt-empty',
        label: 'Empty Plan',
        description: 'Plan with no steps',
        plan: {
          id: 'empty',
          goal: 'Empty',
          steps: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      const approval: PlanApproval = {
        selectedOptionId: 'opt-empty',
        approvedAt: new Date(),
      };

      const validation = handoff.validateHandoff({
        planningContext,
        options: [emptyPlanOption],
        approval,
      });

      expect(validation.warnings).toContain('Selected plan has no steps to execute');
    });
  });

  describe('fromContextBuildResult', () => {
    it('creates PlanningContext from ContextBuildResult', () => {
      const contextBuildResult = {
        context: {
          filesRead: new Map([['test.xml', '<test/>']]),
          searchResults: new Map(),
          userPreferences: { pref: 'value' },
          odooContext: { version: '17.0' },
          planMode: true,
        },
        mode: 'plan' as const,
        classification: {
          mode: 'plan' as const,
          confidence: 'high' as const,
          score: 0.9,
          matchedPatterns: ['explore'],
          message: 'Test goal',
        },
        disabledTools: ['write_file', 'edit_file'],
        enabledTools: ['read_file', 'search_codebase'],
      };

      const planningContext = PlanHandoff.fromContextBuildResult(
        contextBuildResult,
        'Test goal',
        '/workspace'
      );

      expect(planningContext.goal).toBe('Test goal');
      expect(planningContext.workspaceRoot).toBe('/workspace');
      expect(planningContext.filesRead.get('test.xml')).toBe('<test/>');
      expect(planningContext.classification).toBeDefined();
      expect(planningContext.classification!.mode).toBe('plan');
    });
  });

  describe('factory functions', () => {
    it('createPlanHandoff creates instance', () => {
      const handoff = createPlanHandoff({ maxIterations: 15 });
      expect(handoff).toBeInstanceOf(PlanHandoff);
    });

    it('handoffPlanToAgent performs quick handoff', () => {
      const planningContext = createTestPlanningContext();
      const plan = createTestPlan('factory-plan', 'Factory test');

      const result = handoffPlanToAgent(planningContext, plan);

      expect(result.plan.id).toBe('factory-plan');
      expect(result.context.planMode).toBe(false);
      expect(result.enabledTools).toEqual(AGENT_MODE_TOOLS);
    });

    it('handoffWithOptions performs full handoff', () => {
      const planningContext = createTestPlanningContext();
      const options = createTestOptions();

      const result = handoffWithOptions(planningContext, options, 'opt-full');

      expect(result.selectedOption!.id).toBe('opt-full');
      expect(result.plan.id).toBe('full-plan');
      expect(result.context.planMode).toBe(false);
    });
  });

  // ==========================================================================
  // Feature #31 Verification Tests
  // ==========================================================================

  describe('Feature #31 verification: Approved plan transfers to agent with selected option and full context', () => {
    it('approved plan is transferred correctly', () => {
      const handoff = new PlanHandoff();
      const planningContext = createTestPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-full',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      // Plan is transferred
      expect(result.plan).toBeDefined();
      expect(result.plan.steps.length).toBeGreaterThan(0);
      expect(result.plan.goal).toBe('Full hero with features');
    });

    it('selected option metadata is preserved', () => {
      const handoff = new PlanHandoff();
      const planningContext = createTestPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-full',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      // Selected option is preserved
      expect(result.selectedOption).toBeDefined();
      expect(result.selectedOption!.id).toBe('opt-full');
      expect(result.selectedOption!.label).toBe('Full Feature');
      expect(result.selectedOption!.description).toBe('Add hero with animations and variants');
      expect(result.selectedOption!.affectedFiles).toContain('templates/homepage.xml');
    });

    it('full context is transferred from plan mode to agent mode', () => {
      const handoff = new PlanHandoff();
      const planningContext = createTestPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      // Full context is preserved
      expect(result.context.filesRead.size).toBe(planningContext.filesRead.size);
      expect(result.context.searchResults.size).toBe(planningContext.searchResults.size);
      expect(result.context.userPreferences).toEqual(planningContext.userPreferences);
      expect(result.context.odooContext).toEqual(planningContext.odooContext);

      // Mode transition happened
      expect(result.context.planMode).toBe(false);
      expect(result.metadata.fromMode).toBe('plan');
      expect(result.metadata.toMode).toBe('agent');
    });

    it('all tools are enabled after handoff (agent mode)', () => {
      const handoff = new PlanHandoff();
      const planningContext = createTestPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      // Agent mode has all tools enabled
      expect(result.enabledTools).toEqual(AGENT_MODE_TOOLS);
      expect(result.enabledTools).toContain('write_file');
      expect(result.enabledTools).toContain('edit_file');
      expect(result.enabledTools).toContain('read_file');
      expect(result.enabledTools).toContain('search_codebase');
    });

    it('handoff metadata tracks the transition', () => {
      const handoff = new PlanHandoff();
      const planningContext = createTestPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-quick',
        approvedAt: new Date(),
      };

      const result = handoff.execute({ planningContext, options, approval });

      // Metadata correctly tracks the transition
      expect(result.metadata.fromMode).toBe('plan');
      expect(result.metadata.toMode).toBe('agent');
      expect(result.metadata.handoffAt).toBeInstanceOf(Date);
      expect(result.metadata.preservedContextKeys).toContain('filesRead');
      expect(result.metadata.preservedContextKeys).toContain('searchResults');
      expect(result.metadata.preservedContextKeys).toContain('odooContext');
      expect(result.metadata.preservedContextKeys).toContain('classification');
    });
  });

  // ==========================================================================
  // Feature #43: Full Plan Context and Step Execution
  // ==========================================================================

  describe('Feature #43: Agent receives full plan context and executes selected option steps', () => {
    describe('full plan context preservation', () => {
      it('agent receives all files read during planning', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const result = handoff.execute({ planningContext, options, approval });

        // Agent context should have all files from planning
        expect(result.context.filesRead).toBeDefined();
        expect(result.context.filesRead.size).toBe(planningContext.filesRead.size);
        for (const [path, content] of planningContext.filesRead) {
          expect(result.context.filesRead.get(path)).toBe(content);
        }
      });

      it('agent receives all search results from planning', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const result = handoff.execute({ planningContext, options, approval });

        // Agent context should have all search results
        expect(result.context.searchResults).toBeDefined();
        expect(result.context.searchResults.size).toBe(planningContext.searchResults.size);
      });

      it('agent receives user preferences from planning', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const result = handoff.execute({ planningContext, options, approval });

        expect(result.context.userPreferences).toBeDefined();
        expect(result.context.userPreferences).toEqual(planningContext.userPreferences);
      });

      it('agent receives odoo context from planning', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const result = handoff.execute({ planningContext, options, approval });

        expect(result.context.odooContext).toBeDefined();
        expect(result.context.odooContext?.version).toBe('17.0');
        expect(result.context.odooContext?.modules).toContain('website');
      });

      it('verifyContextPreservation confirms all context is preserved', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const result = handoff.execute({ planningContext, options, approval });
        const verification = handoff.verifyContextPreservation(planningContext, result);

        expect(verification.preserved).toBe(true);
        expect(verification.missing).toHaveLength(0);
      });

      it('getFullPlanContext extracts all context for agent', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();

        const fullContext = handoff.getFullPlanContext(planningContext);

        expect(fullContext.filesRead.length).toBe(2);
        expect(fullContext.searchResults.length).toBe(1);
        expect(fullContext.goal).toBe('Add a hero section to the homepage');
        expect(fullContext.classification?.mode).toBe('plan');
        expect(fullContext.odooContext?.version).toBe('17.0');
      });
    });

    describe('selected option step execution', () => {
      it('selected option steps are included in result', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const result = handoff.execute({ planningContext, options, approval });

        expect(result.plan.steps).toBeDefined();
        expect(result.plan.steps.length).toBeGreaterThan(0);
      });

      it('prepareStepsForExecution resets step status to pending', () => {
        const handoff = new PlanHandoff();
        const steps = [
          { id: 's1', action: 'read_file' as const, target: 'a.xml', rationale: 'r', status: 'completed' as const, result: 'done' },
          { id: 's2', action: 'edit_file' as const, target: 'b.xml', rationale: 'r', status: 'failed' as const, error: 'err' },
        ];

        const prepared = handoff.prepareStepsForExecution(steps);

        expect(prepared[0].status).toBe('pending');
        expect(prepared[1].status).toBe('pending');
        expect(prepared[0].result).toBeUndefined();
        expect(prepared[1].error).toBeUndefined();
      });

      it('createExecutionBundle provides everything for agent execution', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-full',
          approvedAt: new Date(),
        };

        const bundle = handoff.createExecutionBundle({ planningContext, options, approval });

        // Context is preserved
        expect(bundle.context.filesRead.size).toBe(planningContext.filesRead.size);
        expect(bundle.context.planMode).toBe(false);

        // Steps are ready for execution
        expect(bundle.steps.length).toBeGreaterThan(0);
        expect(bundle.steps.every(s => s.status === 'pending')).toBe(true);

        // Execution metadata is complete
        expect(bundle.execution.optionId).toBe('opt-full');
        expect(bundle.execution.totalSteps).toBe(bundle.steps.length);
        expect(bundle.execution.riskLevel).toBe('medium');
        expect(bundle.execution.affectedFiles).toContain('templates/homepage.xml');
      });

      it('execution bundle includes files from planning', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const bundle = handoff.createExecutionBundle({ planningContext, options, approval });

        expect(bundle.filesFromPlanning).toBeDefined();
        expect(bundle.filesFromPlanning.size).toBe(planningContext.filesRead.size);
        expect(bundle.filesFromPlanning.get('templates/main.xml')).toBe('<template>content</template>');
      });

      it('plan in execution bundle has steps prepared for execution', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const bundle = handoff.createExecutionBundle({ planningContext, options, approval });

        // Plan steps should all be pending
        for (const step of bundle.plan.steps) {
          expect(step.status).toBe('pending');
        }
      });
    });

    describe('step execution readiness', () => {
      it('steps have correct structure for execution', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const bundle = handoff.createExecutionBundle({ planningContext, options, approval });

        for (const step of bundle.steps) {
          expect(step.id).toBeDefined();
          expect(step.action).toBeDefined();
          expect(step.target).toBeDefined();
          expect(step.rationale).toBeDefined();
          expect(step.status).toBe('pending');
        }
      });

      it('total steps matches plan steps', () => {
        const handoff = new PlanHandoff();
        const planningContext = createTestPlanningContext();
        const options = createTestOptions();
        const approval: PlanApproval = {
          selectedOptionId: 'opt-quick',
          approvedAt: new Date(),
        };

        const bundle = handoff.createExecutionBundle({ planningContext, options, approval });

        expect(bundle.execution.totalSteps).toBe(bundle.plan.steps.length);
        expect(bundle.execution.totalSteps).toBe(bundle.steps.length);
      });
    });
  });
});

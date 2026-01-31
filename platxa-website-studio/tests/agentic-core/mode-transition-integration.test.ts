/**
 * Integration Tests for Mode Transitions (Feature #185)
 *
 * Tests the full flow of mode transitions including:
 * - Plan → Agent handoff (end-to-end)
 * - Mode switching via ModeRouter + ContextBuilder
 * - Context preservation across transitions
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mode Router
import {
  ModeRouter,
  createModeRouter,
  type ClassificationResult,
} from '@/lib/agentic-core/mode-router';

// Context Builder
import {
  ContextBuilder,
  createContextBuilder,
  PLAN_MODE_TOOLS,
  AGENT_MODE_TOOLS,
  PLAN_MODE_DISABLED_TOOLS,
  type ContextBuildResult,
} from '@/lib/agentic-core/context-builder';

// Plan Handoff
import {
  PlanHandoff,
  createPlanHandoff,
  handoffPlanToAgent,
  handoffWithOptions,
  type PlanningContext,
  type PlanOption,
  type PlanApproval,
  type HandoffResult,
} from '@/lib/agentic-core/plan-handoff';

// Agent types
import type { AgentPlan, AgentContext } from '@/lib/agentic-core/agent-engine';

// =============================================================================
// Test Fixtures
// =============================================================================

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

function createRichPlanningContext(): PlanningContext {
  const filesRead = new Map<string, string>();
  filesRead.set('templates/header.xml', '<header t-name="website.header">...</header>');
  filesRead.set('templates/footer.xml', '<footer t-name="website.footer">...</footer>');
  filesRead.set('static/scss/theme.scss', '$primary: #007bff;\n$secondary: #6c757d;');
  filesRead.set('views/snippets.xml', '<template id="s_hero">...</template>');

  const searchResults = new Map<string, unknown[]>();
  searchResults.set('header template search', [
    { file: 'templates/header.xml', line: 1, match: 't-name="website.header"' },
  ]);
  searchResults.set('scss variables search', [
    { file: 'static/scss/theme.scss', line: 1, match: '$primary' },
    { file: 'static/scss/theme.scss', line: 2, match: '$secondary' },
  ]);

  return {
    filesRead,
    searchResults,
    classification: {
      mode: 'plan',
      confidence: 'high',
      score: 0.95,
      matchedPatterns: ['what if'],
      message: 'What if we redesigned the header?',
    },
    goal: 'Redesign the header with a modern look',
    workspaceRoot: '/project/theme',
    userPreferences: {
      preferDarkMode: true,
      animationsEnabled: true,
      colorScheme: 'blue',
    },
    odooContext: {
      version: '17.0',
      modules: ['website', 'website_sale', 'website_blog'],
      theme: 'theme_starter',
      snippets: ['s_hero', 's_features', 's_cta'],
    },
  };
}

function createTestOptions(): PlanOption[] {
  return [
    {
      id: 'opt-minimal',
      label: 'Minimal Changes',
      description: 'Update header colors and font only',
      plan: createTestPlan('minimal-plan', 'Minimal header update'),
      complexity: 1,
      riskLevel: 'low',
      affectedFiles: ['static/scss/theme.scss'],
    },
    {
      id: 'opt-moderate',
      label: 'Moderate Redesign',
      description: 'New layout with improved navigation',
      plan: createTestPlan('moderate-plan', 'Moderate header redesign'),
      complexity: 3,
      riskLevel: 'medium',
      affectedFiles: ['templates/header.xml', 'static/scss/header.scss'],
    },
    {
      id: 'opt-full',
      label: 'Full Redesign',
      description: 'Complete header overhaul with new structure',
      plan: createTestPlan('full-plan', 'Full header overhaul'),
      complexity: 5,
      riskLevel: 'high',
      affectedFiles: ['templates/header.xml', 'static/scss/header.scss', 'static/js/header.js'],
    },
  ];
}

// =============================================================================
// Integration Test: Plan → Agent Handoff
// =============================================================================

describe('Mode Transition Integration Tests (Feature #185)', () => {
  describe('Plan → Agent Handoff (End-to-End)', () => {
    let modeRouter: ModeRouter;
    let contextBuilder: ContextBuilder;
    let planHandoff: PlanHandoff;

    beforeEach(() => {
      modeRouter = createModeRouter();
      contextBuilder = createContextBuilder();
      planHandoff = createPlanHandoff();
    });

    it('completes full flow: classify → build plan context → handoff → agent context', () => {
      // Step 1: User message triggers plan mode
      const userMessage = 'What if we added a hero section to the homepage?';
      const classification = modeRouter.classify(userMessage);

      expect(classification.mode).toBe('plan');
      expect(classification.confidence).toBe('high');

      // Step 2: Build plan mode context
      const planContext = contextBuilder.buildFromMessage({
        workspaceRoot: '/project',
        goal: userMessage,
      });

      expect(planContext.mode).toBe('plan');
      expect(planContext.context.planMode).toBe(true);
      expect(planContext.disabledTools).toContain('write_file');
      expect(planContext.disabledTools).toContain('edit_file');

      // Step 3: Simulate planning phase (gather context)
      const planningContext = createRichPlanningContext();
      planningContext.goal = userMessage;
      planningContext.classification = classification;

      // Step 4: User approves a plan option
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-moderate',
        approvedAt: new Date(),
      };

      // Step 5: Handoff to agent mode
      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      // Verify handoff result
      expect(handoffResult.context.planMode).toBe(false);
      expect(handoffResult.enabledTools).toEqual(AGENT_MODE_TOOLS);
      expect(handoffResult.enabledTools).toContain('write_file');
      expect(handoffResult.enabledTools).toContain('edit_file');
      expect(handoffResult.metadata.fromMode).toBe('plan');
      expect(handoffResult.metadata.toMode).toBe('agent');
    });

    it('preserves all context through the full transition', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-moderate',
        approvedAt: new Date(),
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      // Verify filesRead preserved
      expect(handoffResult.context.filesRead.size).toBe(planningContext.filesRead.size);
      for (const [path, content] of planningContext.filesRead) {
        expect(handoffResult.context.filesRead.get(path)).toBe(content);
      }

      // Verify searchResults preserved
      expect(handoffResult.context.searchResults.size).toBe(planningContext.searchResults.size);

      // Verify userPreferences preserved
      expect(handoffResult.context.userPreferences).toEqual(planningContext.userPreferences);

      // Verify odooContext preserved
      expect(handoffResult.context.odooContext).toEqual(planningContext.odooContext);
    });

    it('execution bundle provides everything needed for agent', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-moderate',
        approvedAt: new Date(),
      };

      const bundle = planHandoff.createExecutionBundle({
        planningContext,
        options,
        approval,
      });

      // Context is ready for agent execution
      expect(bundle.context.planMode).toBe(false);
      expect(bundle.context.filesRead.size).toBeGreaterThan(0);

      // Steps are prepared
      expect(bundle.steps.length).toBeGreaterThan(0);
      expect(bundle.steps.every(s => s.status === 'pending')).toBe(true);

      // Files from planning are available
      expect(bundle.filesFromPlanning.size).toBe(planningContext.filesRead.size);

      // Execution metadata is complete
      expect(bundle.execution.optionId).toBe('opt-moderate');
      expect(bundle.execution.totalSteps).toBe(bundle.steps.length);
      expect(bundle.execution.riskLevel).toBe('medium');
    });
  });

  // ===========================================================================
  // Integration Test: Mode Switching
  // ===========================================================================

  describe('Mode Switching (ModeRouter + ContextBuilder Integration)', () => {
    let modeRouter: ModeRouter;
    let contextBuilder: ContextBuilder;

    beforeEach(() => {
      modeRouter = createModeRouter();
      contextBuilder = createContextBuilder();
    });

    it('classifies and builds plan mode context correctly', () => {
      const planMessages = [
        'What if we refactored the authentication module?',
        'Explain how the template inheritance works',
        'Analyze the current SCSS structure',
        'Compare the two layout options',
        'How would we approach adding dark mode?',
      ];

      for (const message of planMessages) {
        const classification = modeRouter.classify(message);
        const context = contextBuilder.buildFromMessage({
          workspaceRoot: '/project',
          goal: message,
        });

        expect(classification.mode).toBe('plan');
        expect(context.mode).toBe('plan');
        expect(context.context.planMode).toBe(true);
        expect(context.disabledTools).toContain('write_file');
        expect(context.disabledTools).toContain('edit_file');
        expect(context.enabledTools).not.toContain('write_file');
        expect(context.enabledTools).not.toContain('edit_file');
      }
    });

    it('classifies and builds agent mode context correctly', () => {
      const agentMessages = [
        'Create a new hero section component',
        'Build the contact form with validation',
        'Fix the header alignment issue',
        'Add a newsletter signup to the footer',
        'Update the color scheme to use brand colors',
        'Implement the shopping cart feature',
        'Refactor the template structure',
      ];

      for (const message of agentMessages) {
        const classification = modeRouter.classify(message);
        const context = contextBuilder.buildFromMessage({
          workspaceRoot: '/project',
          goal: message,
        });

        expect(classification.mode).toBe('agent');
        expect(context.mode).toBe('agent');
        expect(context.context.planMode).toBe(false);
        expect(context.enabledTools).toEqual(AGENT_MODE_TOOLS);
        expect(context.enabledTools).toContain('write_file');
        expect(context.enabledTools).toContain('edit_file');
      }
    });

    it('handles mode switching within a session', () => {
      // Start with plan mode
      const planMessage = 'What if we redesigned the navigation?';
      const planClassification = modeRouter.classify(planMessage);
      const planContext = contextBuilder.buildFromMessage({
        workspaceRoot: '/project',
        goal: planMessage,
      });

      expect(planClassification.mode).toBe('plan');
      expect(planContext.context.planMode).toBe(true);

      // Switch to agent mode
      const agentMessage = 'Create the new navigation component';
      const agentClassification = modeRouter.classify(agentMessage);
      const agentContext = contextBuilder.buildFromMessage({
        workspaceRoot: '/project',
        goal: agentMessage,
      });

      expect(agentClassification.mode).toBe('agent');
      expect(agentContext.context.planMode).toBe(false);

      // Switch back to plan mode
      const planMessage2 = 'Analyze the impact of these changes';
      const planClassification2 = modeRouter.classify(planMessage2);
      const planContext2 = contextBuilder.buildFromMessage({
        workspaceRoot: '/project',
        goal: planMessage2,
      });

      expect(planClassification2.mode).toBe('plan');
      expect(planContext2.context.planMode).toBe(true);
    });

    it('force mode bypasses classification', () => {
      // Message that would classify as agent mode
      const agentMessage = 'Create a new component';

      // Force plan mode
      const forcedPlanContext = contextBuilder.buildFromMessage({
        workspaceRoot: '/project',
        goal: agentMessage,
        forceMode: 'plan',
      });

      expect(forcedPlanContext.mode).toBe('plan');
      expect(forcedPlanContext.context.planMode).toBe(true);

      // Force agent mode on plan message
      const planMessage = 'What if we changed the colors?';
      const forcedAgentContext = contextBuilder.buildFromMessage({
        workspaceRoot: '/project',
        goal: planMessage,
        forceMode: 'agent',
      });

      expect(forcedAgentContext.mode).toBe('agent');
      expect(forcedAgentContext.context.planMode).toBe(false);
    });
  });

  // ===========================================================================
  // Integration Test: Context Preservation
  // ===========================================================================

  describe('Context Preservation Across Transitions', () => {
    let planHandoff: PlanHandoff;

    beforeEach(() => {
      planHandoff = createPlanHandoff();
    });

    it('deep copies context by default (isolation)', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-minimal',
        approvedAt: new Date(),
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      // Modify original context after handoff
      planningContext.filesRead.set('new-file.xml', 'new content');
      planningContext.searchResults.set('new search', [{ result: 'new' }]);

      // Handoff result should NOT be affected
      expect(handoffResult.context.filesRead.has('new-file.xml')).toBe(false);
      expect(handoffResult.context.searchResults.has('new search')).toBe(false);
    });

    it('verifies context preservation completeness', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-minimal',
        approvedAt: new Date(),
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      const verification = planHandoff.verifyContextPreservation(
        planningContext,
        handoffResult
      );

      expect(verification.preserved).toBe(true);
      expect(verification.missing).toHaveLength(0);
    });

    it('tracks preserved context keys in metadata', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-minimal',
        approvedAt: new Date(),
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      expect(handoffResult.metadata.preservedContextKeys).toContain('filesRead');
      expect(handoffResult.metadata.preservedContextKeys).toContain('searchResults');
      expect(handoffResult.metadata.preservedContextKeys).toContain('userPreferences');
      expect(handoffResult.metadata.preservedContextKeys).toContain('odooContext');
      expect(handoffResult.metadata.preservedContextKeys).toContain('classification');
    });

    it('preserves Odoo-specific context through transition', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-minimal',
        approvedAt: new Date(),
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      // Odoo context is critical for correct agent execution
      expect(handoffResult.context.odooContext?.version).toBe('17.0');
      expect(handoffResult.context.odooContext?.modules).toContain('website');
      expect(handoffResult.context.odooContext?.modules).toContain('website_sale');
      expect(handoffResult.context.odooContext?.theme).toBe('theme_starter');
      expect(handoffResult.context.odooContext?.snippets).toContain('s_hero');
    });

    it('preserves user preferences through transition', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-minimal',
        approvedAt: new Date(),
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      expect(handoffResult.context.userPreferences?.preferDarkMode).toBe(true);
      expect(handoffResult.context.userPreferences?.animationsEnabled).toBe(true);
      expect(handoffResult.context.userPreferences?.colorScheme).toBe('blue');
    });

    it('preserves file contents exactly through transition', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-minimal',
        approvedAt: new Date(),
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      // File contents must be exactly preserved for agent to work correctly
      for (const [path, originalContent] of planningContext.filesRead) {
        const preservedContent = handoffResult.context.filesRead.get(path);
        expect(preservedContent).toBe(originalContent);
      }
    });

    it('preserves search results through transition', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-minimal',
        approvedAt: new Date(),
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      // Search results help agent understand what was found during planning
      expect(handoffResult.context.searchResults.size).toBe(
        planningContext.searchResults.size
      );

      for (const [query, results] of planningContext.searchResults) {
        expect(handoffResult.context.searchResults.get(query)).toEqual(results);
      }
    });
  });

  // ===========================================================================
  // Integration Test: Tool Restriction Enforcement
  // ===========================================================================

  describe('Tool Restriction Enforcement', () => {
    let contextBuilder: ContextBuilder;

    beforeEach(() => {
      contextBuilder = createContextBuilder();
    });

    it('plan mode has correct tool restrictions', () => {
      const planContext = contextBuilder.buildFromMessage({
        workspaceRoot: '/project',
        goal: 'What if we reorganized the templates?',
      });

      // Verify disabled tools
      expect(planContext.disabledTools).toEqual(PLAN_MODE_DISABLED_TOOLS);
      expect(planContext.disabledTools).toContain('write_file');
      expect(planContext.disabledTools).toContain('edit_file');

      // Verify enabled tools
      expect(planContext.enabledTools).toEqual(PLAN_MODE_TOOLS);
      expect(planContext.enabledTools).toContain('search_codebase');
      expect(planContext.enabledTools).toContain('read_file');
      expect(planContext.enabledTools).toContain('validate_qweb');
      expect(planContext.enabledTools).not.toContain('write_file');
      expect(planContext.enabledTools).not.toContain('edit_file');
    });

    it('agent mode has all tools enabled', () => {
      const agentContext = contextBuilder.buildFromMessage({
        workspaceRoot: '/project',
        goal: 'Create a new landing page',
      });

      // Verify all tools enabled
      expect(agentContext.enabledTools).toEqual(AGENT_MODE_TOOLS);
      expect(agentContext.disabledTools).toHaveLength(0);

      // All tools should be available
      for (const tool of AGENT_MODE_TOOLS) {
        expect(agentContext.enabledTools).toContain(tool);
      }
    });

    it('handoff enables all tools after transition', () => {
      const planHandoff = createPlanHandoff();
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-minimal',
        approvedAt: new Date(),
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      // After handoff, all tools should be enabled
      expect(handoffResult.enabledTools).toEqual(AGENT_MODE_TOOLS);
      expect(handoffResult.enabledTools).toContain('write_file');
      expect(handoffResult.enabledTools).toContain('edit_file');
    });
  });

  // ===========================================================================
  // Integration Test: Error Handling
  // ===========================================================================

  describe('Error Handling in Transitions', () => {
    let planHandoff: PlanHandoff;

    beforeEach(() => {
      planHandoff = createPlanHandoff();
    });

    it('throws error for invalid option selection', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'invalid-option',
        approvedAt: new Date(),
      };

      expect(() =>
        planHandoff.execute({
          planningContext,
          options,
          approval,
        })
      ).toThrow(/Selected option 'invalid-option' not found/);
    });

    it('validates handoff before execution', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const invalidApproval: PlanApproval = {
        selectedOptionId: 'nonexistent',
        approvedAt: new Date(),
      };

      const validation = planHandoff.validateHandoff({
        planningContext,
        options,
        approval: invalidApproval,
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Selected option 'nonexistent' not found");
    });

    it('warns for high-risk option selection', () => {
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();
      const highRiskApproval: PlanApproval = {
        selectedOptionId: 'opt-full', // High risk option
        approvedAt: new Date(),
      };

      const validation = planHandoff.validateHandoff({
        planningContext,
        options,
        approval: highRiskApproval,
      });

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Selected option is marked as high risk');
    });

    it('warns for empty planning context', () => {
      const emptyPlanningContext: PlanningContext = {
        filesRead: new Map(),
        searchResults: new Map(),
        goal: 'Test',
        workspaceRoot: '/project',
      };
      const options = createTestOptions();
      const approval: PlanApproval = {
        selectedOptionId: 'opt-minimal',
        approvedAt: new Date(),
      };

      const validation = planHandoff.validateHandoff({
        planningContext: emptyPlanningContext,
        options,
        approval,
      });

      expect(validation.warnings).toContain('No files were read during planning phase');
    });
  });

  // ===========================================================================
  // Integration Test: End-to-End Scenarios
  // ===========================================================================

  describe('End-to-End Scenarios', () => {
    it('scenario: user explores, plans, and executes a feature', () => {
      const modeRouter = createModeRouter();
      const contextBuilder = createContextBuilder();
      const planHandoff = createPlanHandoff();

      // Phase 1: User asks hypothetical question (plan mode)
      const explorationMessage = 'What if we added a dark mode toggle to the header?';
      const explorationClassification = modeRouter.classify(explorationMessage);
      const explorationContext = contextBuilder.buildFromMessage({
        workspaceRoot: '/project',
        goal: explorationMessage,
      });

      expect(explorationClassification.mode).toBe('plan');
      expect(explorationContext.context.planMode).toBe(true);

      // Phase 2: Simulate exploration results
      const planningContext: PlanningContext = {
        filesRead: new Map([
          ['templates/header.xml', '<header>...</header>'],
          ['static/scss/variables.scss', '$light-bg: #ffffff;'],
        ]),
        searchResults: new Map([
          ['dark mode search', [{ file: 'static/scss/variables.scss', match: '$light-bg' }]],
        ]),
        classification: explorationClassification,
        goal: explorationMessage,
        workspaceRoot: '/project',
        userPreferences: { preferDarkMode: true },
        odooContext: { version: '17.0', modules: ['website'] },
      };

      // Phase 3: Present options and user selects one
      const options: PlanOption[] = [
        {
          id: 'simple-toggle',
          label: 'Simple Toggle',
          description: 'Add basic dark mode toggle',
          plan: createTestPlan('simple', 'Add simple dark mode toggle'),
          complexity: 2,
          riskLevel: 'low',
          affectedFiles: ['templates/header.xml', 'static/scss/variables.scss'],
        },
      ];

      const approval: PlanApproval = {
        selectedOptionId: 'simple-toggle',
        approvedAt: new Date(),
      };

      // Phase 4: Handoff to agent mode
      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      // Phase 5: Verify agent is ready to execute
      expect(handoffResult.context.planMode).toBe(false);
      expect(handoffResult.enabledTools).toContain('write_file');
      expect(handoffResult.enabledTools).toContain('edit_file');
      expect(handoffResult.plan.steps.length).toBeGreaterThan(0);
      expect(handoffResult.context.filesRead.size).toBe(2);
      expect(handoffResult.context.userPreferences?.preferDarkMode).toBe(true);
    });

    it('scenario: user modifies plan before approval', () => {
      const planHandoff = createPlanHandoff();
      const planningContext = createRichPlanningContext();
      const options = createTestOptions();

      const approval: PlanApproval = {
        selectedOptionId: 'opt-moderate',
        approvedAt: new Date(),
        modifications: {
          goal: 'Custom modified goal: Redesign header with accessibility focus',
        },
      };

      const handoffResult = planHandoff.execute({
        planningContext,
        options,
        approval,
      });

      // User modifications are applied
      expect(handoffResult.plan.goal).toBe(
        'Custom modified goal: Redesign header with accessibility focus'
      );
    });

    it('scenario: quick handoff with single plan (no options)', () => {
      const planningContext = createRichPlanningContext();
      const singlePlan = createTestPlan('quick-plan', 'Quick execution');

      const handoffResult = handoffPlanToAgent(planningContext, singlePlan);

      expect(handoffResult.plan.id).toBe('quick-plan');
      expect(handoffResult.selectedOption?.id).toBe('single');
      expect(handoffResult.context.planMode).toBe(false);
      expect(handoffResult.enabledTools).toEqual(AGENT_MODE_TOOLS);
    });
  });
});

/**
 * Tests for PlanEngine
 * Feature #36: Create PlanEngine class managing non-destructive exploration state
 *
 * Verification: PlanEngine tracks query, options, clarifications; no file modifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PlanEngine,
  createPlanEngine,
  type PlanQuery,
  type Clarification,
  type ExplorationResult,
  type PlanEngineState,
  type PlanEngineEvents,
} from '@/lib/agentic-core/plan-engine';
import type { PlanOption } from '@/lib/agentic-core/plan-handoff';
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
        rationale: 'Find templates',
        status: 'pending',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createTestOptions(): PlanOption[] {
  return [
    {
      id: 'opt-1',
      label: 'Option 1',
      description: 'First option',
      plan: createTestPlan('plan-1', 'Option 1 plan'),
      complexity: 2,
      riskLevel: 'low',
    },
    {
      id: 'opt-2',
      label: 'Option 2',
      description: 'Second option',
      plan: createTestPlan('plan-2', 'Option 2 plan'),
      complexity: 4,
      riskLevel: 'medium',
    },
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe('PlanEngine', () => {
  describe('constructor', () => {
    it('creates instance with default config', () => {
      const engine = new PlanEngine();
      expect(engine).toBeInstanceOf(PlanEngine);
      expect(engine.getState()).toBe('idle');
    });

    it('accepts custom config', () => {
      const engine = createPlanEngine({
        maxExplorationSteps: 100,
        maxClarifications: 10,
        workspaceRoot: '/custom/path',
      });
      expect(engine).toBeInstanceOf(PlanEngine);
    });

    it('accepts event handlers', () => {
      const onStateChange = vi.fn();
      const engine = new PlanEngine({}, { onStateChange });

      engine.startPlanning('test query');

      expect(onStateChange).toHaveBeenCalledWith('exploring');
    });
  });

  describe('state management', () => {
    let engine: PlanEngine;

    beforeEach(() => {
      engine = new PlanEngine();
    });

    it('starts in idle state', () => {
      expect(engine.getState()).toBe('idle');
      expect(engine.isActive()).toBe(false);
    });

    it('transitions to exploring on startPlanning', () => {
      engine.startPlanning('Add a hero section');

      expect(engine.getState()).toBe('exploring');
      expect(engine.isActive()).toBe(true);
    });

    it('cannot start planning when already active', () => {
      engine.startPlanning('First query');

      expect(() => engine.startPlanning('Second query'))
        .toThrow(/Planning already in progress/);
    });

    it('reset returns to idle', () => {
      engine.startPlanning('Test query');
      engine.reset();

      expect(engine.getState()).toBe('idle');
      expect(engine.isActive()).toBe(false);
    });

    it('cancel sets cancelled state', () => {
      engine.startPlanning('Test query');
      engine.cancel();

      expect(engine.getState()).toBe('cancelled');
      expect(engine.isActive()).toBe(false);
    });
  });

  describe('query tracking', () => {
    let engine: PlanEngine;

    beforeEach(() => {
      engine = new PlanEngine();
    });

    it('stores query on startPlanning', () => {
      engine.startPlanning('Add a hero section to the homepage');

      const query = engine.getQuery();
      expect(query).not.toBeNull();
      expect(query!.text).toBe('Add a hero section to the homepage');
      expect(query!.timestamp).toBeInstanceOf(Date);
    });

    it('stores classification with query', () => {
      const classification = {
        mode: 'plan' as const,
        confidence: 'high' as const,
        score: 0.95,
        matchedPatterns: ['what if'],
        message: 'What if we added a hero?',
      };

      engine.startPlanning('What if we added a hero?', classification);

      const query = engine.getQuery();
      expect(query!.classification).toEqual(classification);
    });

    it('query is null before planning starts', () => {
      expect(engine.getQuery()).toBeNull();
    });

    it('query is cleared on reset', () => {
      engine.startPlanning('Test query');
      engine.reset();

      expect(engine.getQuery()).toBeNull();
    });
  });

  describe('exploration (read-only)', () => {
    let engine: PlanEngine;

    beforeEach(() => {
      engine = new PlanEngine();
      engine.startPlanning('Test exploration');
    });

    it('readFile adds exploration result', async () => {
      const result = await engine.readFile('templates/main.xml');

      expect(result.type).toBe('file_read');
      expect(result.target).toBe('templates/main.xml');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('search adds exploration result', async () => {
      const result = await engine.search('hero section');

      expect(result.type).toBe('search');
      expect(result.target).toBe('hero section');
    });

    it('validate adds exploration result', async () => {
      const result = await engine.validate('templates/test.xml');

      expect(result.type).toBe('validation');
      expect(result.target).toBe('templates/test.xml');
    });

    it('analyze adds exploration result', async () => {
      const result = await engine.analyze('src/components');

      expect(result.type).toBe('analysis');
      expect(result.target).toBe('src/components');
    });

    it('tracks all explorations', async () => {
      await engine.readFile('file1.ts');
      await engine.search('query');
      await engine.validate('file2.xml');

      const explorations = engine.getExplorations();
      expect(explorations).toHaveLength(3);
    });

    it('cannot explore in idle state', async () => {
      const idleEngine = new PlanEngine();

      await expect(idleEngine.readFile('test.ts'))
        .rejects.toThrow(/Cannot explore in state/);
    });

    it('respects max exploration steps', async () => {
      const limitedEngine = new PlanEngine({ maxExplorationSteps: 2 });
      limitedEngine.startPlanning('Test');

      await limitedEngine.readFile('file1.ts');
      await limitedEngine.readFile('file2.ts');

      await expect(limitedEngine.readFile('file3.ts'))
        .rejects.toThrow(/Maximum exploration steps/);
    });

    it('emits exploration events', async () => {
      const onExploration = vi.fn();
      const eventEngine = new PlanEngine({}, { onExploration });
      eventEngine.startPlanning('Test');

      await eventEngine.readFile('test.ts');

      expect(onExploration).toHaveBeenCalled();
      expect(onExploration.mock.calls[0][0].type).toBe('file_read');
    });
  });

  describe('clarifications', () => {
    let engine: PlanEngine;

    beforeEach(() => {
      engine = new PlanEngine();
      engine.startPlanning('Test clarifications');
    });

    it('askClarification creates clarification', () => {
      const clarification = engine.askClarification(
        'Should the hero have a video background?',
        ['Yes', 'No', 'Maybe']
      );

      expect(clarification.question).toBe('Should the hero have a video background?');
      expect(clarification.options).toEqual(['Yes', 'No', 'Maybe']);
      expect(clarification.answered).toBe(false);
    });

    it('transitions to clarifying state', () => {
      engine.askClarification('Test question?');

      expect(engine.getState()).toBe('clarifying');
    });

    it('answerClarification records answer', () => {
      const clarification = engine.askClarification('Test question?');
      engine.answerClarification(clarification.id, 'Test answer');

      const clarifications = engine.getClarifications();
      expect(clarifications[0].answered).toBe(true);
      expect(clarifications[0].answer).toBe('Test answer');
      expect(clarifications[0].answeredAt).toBeInstanceOf(Date);
    });

    it('returns to exploring when all clarifications answered', () => {
      const c1 = engine.askClarification('Question 1?');
      engine.answerClarification(c1.id, 'Answer 1');

      expect(engine.getState()).toBe('exploring');
    });

    it('getUnansweredClarifications filters correctly', () => {
      const c1 = engine.askClarification('Question 1?');
      const c2 = engine.askClarification('Question 2?');
      engine.answerClarification(c1.id, 'Answer 1');

      const unanswered = engine.getUnansweredClarifications();
      expect(unanswered).toHaveLength(1);
      expect(unanswered[0].id).toBe(c2.id);
    });

    it('cannot answer non-existent clarification', () => {
      expect(() => engine.answerClarification('invalid-id', 'answer'))
        .toThrow(/not found/);
    });

    it('cannot answer already answered clarification', () => {
      const clarification = engine.askClarification('Question?');
      engine.answerClarification(clarification.id, 'First answer');

      expect(() => engine.answerClarification(clarification.id, 'Second answer'))
        .toThrow(/already answered/);
    });

    it('respects max clarifications', () => {
      const limitedEngine = new PlanEngine({ maxClarifications: 2 });
      limitedEngine.startPlanning('Test');

      limitedEngine.askClarification('Q1?');
      limitedEngine.askClarification('Q2?');

      expect(() => limitedEngine.askClarification('Q3?'))
        .toThrow(/Maximum clarifications/);
    });

    it('emits clarification events', () => {
      const onClarificationNeeded = vi.fn();
      const eventEngine = new PlanEngine({}, { onClarificationNeeded });
      eventEngine.startPlanning('Test');

      eventEngine.askClarification('Test question?');

      expect(onClarificationNeeded).toHaveBeenCalled();
    });
  });

  describe('options management', () => {
    let engine: PlanEngine;

    beforeEach(() => {
      engine = new PlanEngine();
      engine.startPlanning('Test options');
    });

    it('generateOptions stores options', () => {
      const options = createTestOptions();
      engine.generateOptions(options);

      expect(engine.getOptions()).toHaveLength(2);
      expect(engine.getOptions()[0].id).toBe('opt-1');
    });

    it('transitions through generating to presenting', () => {
      const onStateChange = vi.fn();
      const eventEngine = new PlanEngine({}, { onStateChange });
      eventEngine.startPlanning('Test');

      eventEngine.generateOptions(createTestOptions());

      expect(onStateChange).toHaveBeenCalledWith('generating');
      expect(onStateChange).toHaveBeenCalledWith('presenting');
    });

    it('addOption adds single option', () => {
      engine.addOption(createTestOptions()[0]);
      engine.addOption(createTestOptions()[1]);

      expect(engine.getOptions()).toHaveLength(2);
    });

    it('presentOptions transitions to awaiting_approval', () => {
      engine.generateOptions(createTestOptions());
      engine.presentOptions();

      expect(engine.getState()).toBe('awaiting_approval');
    });

    it('cannot present empty options', () => {
      expect(() => engine.presentOptions())
        .toThrow(/No options to present/);
    });

    it('emits options generated event', () => {
      const onOptionsGenerated = vi.fn();
      const eventEngine = new PlanEngine({}, { onOptionsGenerated });
      eventEngine.startPlanning('Test');

      const options = createTestOptions();
      eventEngine.generateOptions(options);

      expect(onOptionsGenerated).toHaveBeenCalledWith(options);
    });
  });

  describe('approval', () => {
    let engine: PlanEngine;

    beforeEach(() => {
      engine = new PlanEngine();
      engine.startPlanning('Test approval');
      engine.generateOptions(createTestOptions());
    });

    it('approveOption selects option', () => {
      const approved = engine.approveOption('opt-1');

      expect(approved.id).toBe('opt-1');
      expect(engine.getApprovedOption()!.id).toBe('opt-1');
    });

    it('transitions to approved state', () => {
      engine.approveOption('opt-1');

      expect(engine.getState()).toBe('approved');
      expect(engine.isApproved()).toBe(true);
    });

    it('cannot approve non-existent option', () => {
      expect(() => engine.approveOption('invalid-id'))
        .toThrow(/not found/);
    });

    it('cannot approve in wrong state', () => {
      const freshEngine = new PlanEngine();
      freshEngine.startPlanning('Test');

      expect(() => freshEngine.approveOption('opt-1'))
        .toThrow(/Cannot approve in state/);
    });

    it('emits plan approved event', () => {
      const onPlanApproved = vi.fn();
      const eventEngine = new PlanEngine({}, { onPlanApproved });
      eventEngine.startPlanning('Test');
      eventEngine.generateOptions(createTestOptions());

      eventEngine.approveOption('opt-1');

      expect(onPlanApproved).toHaveBeenCalled();
      expect(onPlanApproved.mock.calls[0][0].id).toBe('opt-1');
    });
  });

  describe('context management', () => {
    let engine: PlanEngine;

    beforeEach(() => {
      engine = new PlanEngine();
      engine.startPlanning('Test context');
    });

    it('provides access to context manager', () => {
      const contextManager = engine.getContextManager();
      expect(contextManager).toBeDefined();
    });

    it('context manager is in plan mode', () => {
      const context = engine.exportContext();
      expect(context.planMode).toBe(true);
    });

    it('exportContext returns agent context', () => {
      const context = engine.exportContext();

      expect(context.filesRead).toBeInstanceOf(Map);
      expect(context.searchResults).toBeInstanceOf(Map);
    });

    it('exploration results are tracked in context', async () => {
      await engine.readFile('test.ts');
      await engine.search('query');

      const context = engine.exportContext();
      expect(context.filesRead.size).toBe(1);
    });

    it('clarification answers are tracked in context', () => {
      const c = engine.askClarification('Question?');
      engine.answerClarification(c.id, 'Answer');

      const context = engine.exportContext();
      expect(context.userPreferences[`clarification_${c.id}`]).toBe('Answer');
    });
  });

  describe('statistics', () => {
    let engine: PlanEngine;

    beforeEach(() => {
      engine = new PlanEngine();
    });

    it('tracks exploration count', async () => {
      engine.startPlanning('Test');
      await engine.readFile('file1.ts');
      await engine.readFile('file2.ts');

      const stats = engine.getStats();
      expect(stats.explorationCount).toBe(2);
    });

    it('tracks clarification counts', () => {
      engine.startPlanning('Test');
      const c1 = engine.askClarification('Q1?');
      engine.askClarification('Q2?');
      engine.answerClarification(c1.id, 'A1');

      const stats = engine.getStats();
      expect(stats.clarificationCount).toBe(2);
      expect(stats.answeredClarifications).toBe(1);
    });

    it('tracks option count', () => {
      engine.startPlanning('Test');
      engine.generateOptions(createTestOptions());

      const stats = engine.getStats();
      expect(stats.optionCount).toBe(2);
    });

    it('tracks duration', async () => {
      engine.startPlanning('Test');
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = engine.getStats();
      expect(stats.durationMs).toBeGreaterThan(0);
    });
  });

  describe('factory functions', () => {
    it('createPlanEngine creates instance', () => {
      const engine = createPlanEngine({ maxExplorationSteps: 100 });
      expect(engine).toBeInstanceOf(PlanEngine);
    });

    it('createPlanEngine accepts events', () => {
      const onStateChange = vi.fn();
      const engine = createPlanEngine({}, { onStateChange });

      engine.startPlanning('Test');
      expect(onStateChange).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Feature #36 Verification Tests
  // ==========================================================================

  describe('Feature #36 verification: PlanEngine tracks query, options, clarifications; no file modifications', () => {
    it('tracks query throughout planning', () => {
      const engine = new PlanEngine();
      const queryText = 'Add a hero section with video background';

      engine.startPlanning(queryText);

      const query = engine.getQuery();
      expect(query).not.toBeNull();
      expect(query!.text).toBe(queryText);
      expect(query!.timestamp).toBeInstanceOf(Date);
    });

    it('tracks multiple options for user selection', () => {
      const engine = new PlanEngine();
      engine.startPlanning('Test query');

      const options = createTestOptions();
      engine.generateOptions(options);

      const trackedOptions = engine.getOptions();
      expect(trackedOptions).toHaveLength(2);
      expect(trackedOptions[0].id).toBe('opt-1');
      expect(trackedOptions[1].id).toBe('opt-2');
      expect(trackedOptions[0].plan).toBeDefined();
    });

    it('tracks clarification questions and answers', () => {
      const engine = new PlanEngine();
      engine.startPlanning('Test query');

      // Ask multiple clarifications
      const c1 = engine.askClarification('Video or image background?', ['Video', 'Image']);
      const c2 = engine.askClarification('Include CTA button?', ['Yes', 'No']);

      // Answer them
      engine.answerClarification(c1.id, 'Video');
      engine.answerClarification(c2.id, 'Yes');

      const clarifications = engine.getClarifications();
      expect(clarifications).toHaveLength(2);
      expect(clarifications[0].question).toBe('Video or image background?');
      expect(clarifications[0].answer).toBe('Video');
      expect(clarifications[1].question).toBe('Include CTA button?');
      expect(clarifications[1].answer).toBe('Yes');
    });

    it('verifies no file modifications occurred', async () => {
      const engine = new PlanEngine();
      engine.startPlanning('Test query');

      // Perform only read operations
      await engine.readFile('templates/main.xml');
      await engine.search('hero section');
      await engine.validate('templates/test.xml');
      await engine.analyze('src/components');

      const verification = engine.verifyNoModifications();

      expect(verification.verified).toBe(true);
      expect(verification.explorationTypes).toContain('file_read');
      expect(verification.explorationTypes).toContain('search');
      expect(verification.explorationTypes).toContain('validation');
      expect(verification.explorationTypes).toContain('analysis');
      // Should NOT contain write or edit
      expect(verification.explorationTypes).not.toContain('write');
      expect(verification.explorationTypes).not.toContain('edit');
    });

    it('context remains in plan mode (read-only) throughout', async () => {
      const engine = new PlanEngine();
      engine.startPlanning('Test query');

      // Explore
      await engine.readFile('test.ts');
      expect(engine.exportContext().planMode).toBe(true);

      // Clarify
      const c = engine.askClarification('Question?');
      engine.answerClarification(c.id, 'Answer');
      expect(engine.exportContext().planMode).toBe(true);

      // Generate options
      engine.generateOptions(createTestOptions());
      expect(engine.exportContext().planMode).toBe(true);

      // Approve
      engine.approveOption('opt-1');
      expect(engine.exportContext().planMode).toBe(true);
    });

    it('exploration results are all read-only types', async () => {
      const engine = new PlanEngine();
      engine.startPlanning('Test query');

      await engine.readFile('file.ts');
      await engine.search('query');
      await engine.validate('target');
      await engine.analyze('path');

      const explorations = engine.getExplorations();

      // All exploration types should be read-only
      const readOnlyTypes = ['file_read', 'search', 'validation', 'analysis'];
      for (const exploration of explorations) {
        expect(readOnlyTypes).toContain(exploration.type);
      }
    });

    it('full planning workflow maintains state integrity', async () => {
      const engine = new PlanEngine();

      // Start
      engine.startPlanning('Create a hero section with animations');
      expect(engine.getState()).toBe('exploring');

      // Explore
      await engine.readFile('templates/homepage.xml');
      await engine.search('hero animation');
      expect(engine.getExplorations()).toHaveLength(2);

      // Clarify
      const c = engine.askClarification('Animate on scroll?');
      expect(engine.getState()).toBe('clarifying');
      engine.answerClarification(c.id, 'Yes');
      expect(engine.getState()).toBe('exploring');

      // Generate options
      engine.generateOptions(createTestOptions());
      expect(engine.getState()).toBe('presenting');
      expect(engine.getOptions()).toHaveLength(2);

      // Present and approve
      engine.presentOptions();
      expect(engine.getState()).toBe('awaiting_approval');

      const approved = engine.approveOption('opt-2');
      expect(engine.getState()).toBe('approved');
      expect(approved.id).toBe('opt-2');
      expect(engine.isApproved()).toBe(true);

      // Verify no modifications
      const verification = engine.verifyNoModifications();
      expect(verification.verified).toBe(true);
    });
  });
});

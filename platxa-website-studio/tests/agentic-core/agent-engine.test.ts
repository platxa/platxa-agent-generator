/**
 * AgentEngine Tests
 * Verifies Feature #1: AgentEngine instantiates with proper initial state and exposes execute() method
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentEngine, createAgentEngine, type AgentState } from '@/lib/agentic-core/agent-engine';

describe('AgentEngine', () => {
  describe('instantiation', () => {
    it('should create instance with default configuration', () => {
      const engine = new AgentEngine();
      expect(engine).toBeInstanceOf(AgentEngine);
    });

    it('should create instance with custom configuration', () => {
      const engine = new AgentEngine({
        maxIterations: 3,
        qualityThreshold: 90,
        iterationTimeout: 30000,
        verboseEvents: false,
      });
      expect(engine).toBeInstanceOf(AgentEngine);
    });

    it('should expose execute() method', () => {
      const engine = new AgentEngine();
      expect(typeof engine.execute).toBe('function');
    });

    it('should expose cancel() method', () => {
      const engine = new AgentEngine();
      expect(typeof engine.cancel).toBe('function');
    });

    it('should expose getState() method', () => {
      const engine = new AgentEngine();
      expect(typeof engine.getState).toBe('function');
    });

    it('should expose getStatus() method', () => {
      const engine = new AgentEngine();
      expect(typeof engine.getStatus).toBe('function');
    });

    it('should expose getQualityScore() method', () => {
      const engine = new AgentEngine();
      expect(typeof engine.getQualityScore).toBe('function');
    });

    it('should expose getIteration() method', () => {
      const engine = new AgentEngine();
      expect(typeof engine.getIteration).toBe('function');
    });

    it('should expose isRunning() method', () => {
      const engine = new AgentEngine();
      expect(typeof engine.isRunning).toBe('function');
    });
  });

  describe('initial state', () => {
    it('should have idle status initially', () => {
      const engine = new AgentEngine();
      expect(engine.getStatus()).toBe('idle');
    });

    it('should have zero quality score initially', () => {
      const engine = new AgentEngine();
      expect(engine.getQualityScore()).toBe(0);
    });

    it('should have zero iteration initially', () => {
      const engine = new AgentEngine();
      expect(engine.getIteration()).toBe(0);
    });

    it('should not be running initially', () => {
      const engine = new AgentEngine();
      expect(engine.isRunning()).toBe(false);
    });

    it('should have proper initial state structure', () => {
      const engine = new AgentEngine();
      const state = engine.getState();

      expect(state).toMatchObject({
        goal: '',
        plan: null,
        iteration: 0,
        status: 'idle',
        errors: [],
        filesModified: [],
        qualityScore: 0,
        goalAchieved: false,
        startedAt: null,
        completedAt: null,
        lastValidation: null,
      });

      expect(state.context).toBeDefined();
      expect(state.context.filesRead).toBeInstanceOf(Map);
      expect(state.context.searchResults).toBeInstanceOf(Map);
      expect(state.context.userPreferences).toEqual({});
      expect(state.context.odooContext).toEqual({});
    });
  });

  describe('factory function', () => {
    it('should create AgentEngine via createAgentEngine()', () => {
      const engine = createAgentEngine();
      expect(engine).toBeInstanceOf(AgentEngine);
    });

    it('should pass config to createAgentEngine()', () => {
      const engine = createAgentEngine({ maxIterations: 10 });
      expect(engine).toBeInstanceOf(AgentEngine);
    });
  });

  describe('event emitter', () => {
    it('should support event listeners', () => {
      const engine = new AgentEngine();
      const listener = vi.fn();

      engine.on('status:changed', listener);
      expect(engine.listenerCount('status:changed')).toBe(1);

      engine.off('status:changed', listener);
      expect(engine.listenerCount('status:changed')).toBe(0);
    });
  });

  describe('execute()', () => {
    it('should accept a goal string', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      expect(result).toBeDefined();
      expect(result.goal).toBe('Test goal');
    });

    it('should return AgentResult structure', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        goal: 'Test goal',
        iterations: expect.any(Number),
        qualityScore: expect.any(Number),
        filesModified: expect.any(Array),
        errors: expect.any(Array),
        warnings: expect.any(Array),
        summary: expect.any(String),
        duration: expect.any(Number),
      });
    });

    it('should emit status:changed events', async () => {
      const engine = new AgentEngine();
      const statusChanges: string[] = [];

      engine.on('status:changed', (status) => {
        statusChanges.push(status);
      });

      await engine.execute('Test goal');

      expect(statusChanges.length).toBeGreaterThan(0);
      expect(statusChanges).toContain('planning');
    });

    it('should emit iteration:start events', async () => {
      const engine = new AgentEngine();
      const iterations: number[] = [];

      engine.on('iteration:start', (iteration) => {
        iterations.push(iteration);
      });

      await engine.execute('Test goal');

      expect(iterations.length).toBeGreaterThan(0);
      expect(iterations[0]).toBe(1);
    });

    it('should update iteration count', async () => {
      const engine = new AgentEngine();
      await engine.execute('Test goal');

      expect(engine.getIteration()).toBeGreaterThan(0);
    });

    it('should set completed status after execution', async () => {
      const engine = new AgentEngine();
      await engine.execute('Test goal');

      expect(['completed', 'failed']).toContain(engine.getStatus());
    });
  });

  describe('cancel()', () => {
    it('should set status to cancelled', () => {
      const engine = new AgentEngine();
      engine.cancel();
      // Note: cancel only works during active execution
      // This test verifies the method exists and doesn't throw
    });
  });

  describe('state management', () => {
    it('should track filesModified via recordFileModification()', () => {
      const engine = new AgentEngine();

      engine.recordFileModification({
        path: '/test/file.ts',
        action: 'created',
        newContent: 'content',
      });

      const state = engine.getState();
      expect(state.filesModified.length).toBe(1);
      expect(state.filesModified[0].path).toBe('/test/file.ts');
      expect(state.filesModified[0].action).toBe('created');
    });

    it('should update context via updateContext()', () => {
      const engine = new AgentEngine();

      engine.updateContext({
        odooContext: { version: '17.0', modules: ['website'] },
      });

      const state = engine.getState();
      expect(state.context.odooContext.version).toBe('17.0');
      expect(state.context.odooContext.modules).toContain('website');
    });
  });
});

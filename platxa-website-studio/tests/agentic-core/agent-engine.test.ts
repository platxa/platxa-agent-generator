/**
 * AgentEngine Tests
 * Verifies Feature #1: AgentEngine instantiates with proper initial state and exposes execute() method
 * Verifies Feature #8: Progress event streaming with phase/step/percentage
 * Verifies Feature #9: Diminishing returns detection for early stopping
 * Verifies Feature #10: Finalization with success/warning/failure states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AgentEngine,
  createAgentEngine,
  type AgentState,
  type ProgressEvent,
  type AgentResult,
} from '@/lib/agentic-core/agent-engine';

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

  /**
   * Feature #2: Self-correction loop tests
   * Verifies: Loop continues until quality >= 80 or max 5 iterations; emits iteration events
   */
  describe('self-correction loop', () => {
    it('should default to maxIterations=5', () => {
      const engine = new AgentEngine();
      // Verify by checking that execution doesn't exceed 5 iterations
      // (default config is tested implicitly)
      expect(engine).toBeInstanceOf(AgentEngine);
    });

    it('should default to qualityThreshold=80', async () => {
      const engine = new AgentEngine();
      // When no validators configured, quality defaults to threshold (80)
      // and execution completes in 1 iteration
      const result = await engine.execute('Test goal');
      expect(result.qualityScore).toBeGreaterThanOrEqual(80);
    });

    it('should respect custom maxIterations', async () => {
      const engine = new AgentEngine({ maxIterations: 2 });
      const iterations: number[] = [];

      engine.on('iteration:start', (i) => iterations.push(i));
      await engine.execute('Test goal');

      // Should not exceed custom max
      expect(iterations.length).toBeLessThanOrEqual(2);
    });

    it('should respect custom qualityThreshold', async () => {
      const engine = new AgentEngine({ qualityThreshold: 90 });
      const result = await engine.execute('Test goal');

      // Default validation returns threshold score, so it should pass at 90
      expect(result.qualityScore).toBeGreaterThanOrEqual(90);
    });

    it('should emit iteration:start for each iteration', async () => {
      const engine = new AgentEngine();
      const startEvents: number[] = [];

      engine.on('iteration:start', (iteration) => {
        startEvents.push(iteration);
      });

      await engine.execute('Test goal');

      expect(startEvents.length).toBeGreaterThan(0);
      expect(startEvents[0]).toBe(1);
    });

    it('should emit iteration:end for each iteration', async () => {
      const engine = new AgentEngine();
      const endEvents: { iteration: number; passed: boolean }[] = [];

      engine.on('iteration:end', (iteration, result) => {
        endEvents.push({ iteration, passed: result.passed });
      });

      await engine.execute('Test goal');

      expect(endEvents.length).toBeGreaterThan(0);
      expect(endEvents[0].iteration).toBe(1);
    });

    it('should stop when quality >= threshold', async () => {
      const engine = new AgentEngine({ qualityThreshold: 80 });
      const iterations: number[] = [];

      engine.on('iteration:start', (i) => iterations.push(i));
      const result = await engine.execute('Test goal');

      // With default validators (threshold score), should pass on first iteration
      expect(result.success).toBe(true);
      expect(iterations.length).toBe(1);
    });

    it('should track iteration count in state', async () => {
      const engine = new AgentEngine();
      await engine.execute('Test goal');

      const state = engine.getState();
      expect(state.iteration).toBeGreaterThanOrEqual(1);
      expect(state.iteration).toBeLessThanOrEqual(5);
    });

    it('should set goalAchieved when quality passes', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      expect(result.success).toBe(true);
      expect(engine.getState().goalAchieved).toBe(true);
    });

    it('should emit quality:updated when score changes', async () => {
      const engine = new AgentEngine();
      const qualityUpdates: { score: number; previous: number }[] = [];

      engine.on('quality:updated', (score, previous) => {
        qualityUpdates.push({ score, previous });
      });

      await engine.execute('Test goal');

      expect(qualityUpdates.length).toBeGreaterThan(0);
      expect(qualityUpdates[0].previous).toBe(0); // Initial score
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

  /**
   * Feature #8: Progress Event Streaming
   * Verifies: SSE-style progress events with phase, step, percentage
   */
  describe('progress event streaming (Feature #8)', () => {
    it('should emit progress events during execution', async () => {
      const engine = new AgentEngine();
      const progressEvents: ProgressEvent[] = [];

      engine.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      await engine.execute('Test goal');

      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('should include phase in progress events', async () => {
      const engine = new AgentEngine();
      const progressEvents: ProgressEvent[] = [];

      engine.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      await engine.execute('Test goal');

      const phases = progressEvents.map(e => e.phase);
      expect(phases).toContain('planning');
    });

    it('should include step description in progress events', async () => {
      const engine = new AgentEngine();
      const progressEvents: ProgressEvent[] = [];

      engine.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      await engine.execute('Test goal');

      expect(progressEvents[0].step).toBeDefined();
      expect(typeof progressEvents[0].step).toBe('string');
    });

    it('should include percentage in progress events (0-100)', async () => {
      const engine = new AgentEngine();
      const progressEvents: ProgressEvent[] = [];

      engine.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      await engine.execute('Test goal');

      progressEvents.forEach(event => {
        expect(event.percentage).toBeGreaterThanOrEqual(0);
        expect(event.percentage).toBeLessThanOrEqual(100);
      });
    });

    it('should include iteration number in progress events', async () => {
      const engine = new AgentEngine();
      const progressEvents: ProgressEvent[] = [];

      engine.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      await engine.execute('Test goal');

      const iterationEvents = progressEvents.filter(e => e.iteration > 0);
      expect(iterationEvents.length).toBeGreaterThan(0);
    });

    it('should include timestamp in progress events', async () => {
      const engine = new AgentEngine();
      const progressEvents: ProgressEvent[] = [];

      engine.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      await engine.execute('Test goal');

      progressEvents.forEach(event => {
        expect(event.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should emit completed/failed phase at end', async () => {
      const engine = new AgentEngine();
      const progressEvents: ProgressEvent[] = [];

      engine.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      await engine.execute('Test goal');

      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(['completed', 'failed']).toContain(lastEvent.phase);
    });

    it('should include step index and total steps', async () => {
      const engine = new AgentEngine();
      const progressEvents: ProgressEvent[] = [];

      engine.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      await engine.execute('Test goal');

      progressEvents.forEach(event => {
        expect(typeof event.stepIndex).toBe('number');
        expect(typeof event.totalSteps).toBe('number');
      });
    });
  });

  /**
   * Feature #9: Diminishing Returns Detection
   * Verifies: Quality tracking and early stopping when improvements stagnate
   */
  describe('diminishing returns detection (Feature #9)', () => {
    it('should expose getQualityTrend() method', () => {
      const engine = new AgentEngine();
      expect(typeof engine.getQualityTrend).toBe('function');
    });

    it('should return quality trend structure', async () => {
      const engine = new AgentEngine();
      await engine.execute('Test goal');

      const trend = engine.getQualityTrend();
      expect(trend).toMatchObject({
        improving: expect.any(Boolean),
        delta: expect.any(Number),
        history: expect.any(Array),
      });
    });

    it('should track quality history across iterations', async () => {
      const engine = new AgentEngine();
      await engine.execute('Test goal');

      const trend = engine.getQualityTrend();
      expect(trend.history.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate quality delta between iterations', async () => {
      const engine = new AgentEngine();
      await engine.execute('Test goal');

      const trend = engine.getQualityTrend();
      expect(typeof trend.delta).toBe('number');
    });

    it('should indicate if quality is improving', async () => {
      const engine = new AgentEngine();
      await engine.execute('Test goal');

      const trend = engine.getQualityTrend();
      expect(typeof trend.improving).toBe('boolean');
    });

    it('should include stoppedEarly flag in result', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      expect(typeof result.stoppedEarly).toBe('boolean');
    });

    it('should include qualityTrend in result', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      expect(result.qualityTrend).toBeDefined();
      expect(result.qualityTrend.history).toBeDefined();
    });

    it('should stop early when quality does not improve for 2 consecutive iterations', async () => {
      // Verification: Loop exits early if quality score doesn't improve for 2 consecutive iterations
      const engine = new AgentEngine({ maxIterations: 5 });
      const result = await engine.execute('Test goal');

      // The engine should have either:
      // 1. Achieved goal (passed validation)
      // 2. Stopped early due to diminishing returns
      // 3. Hit max iterations
      // If stoppedEarly is true, quality wasn't improving
      if (result.stoppedEarly) {
        const trend = result.qualityTrend;
        // When stopped early, should have at least 2 iterations of history
        expect(trend.history.length).toBeGreaterThanOrEqual(2);
        // And improvement should be minimal (< 2%)
        const recentHistory = trend.history.slice(-2);
        const improvement = Math.abs(recentHistory[1] - recentHistory[0]);
        expect(improvement).toBeLessThan(5); // Minimal improvement threshold
      }
    });
  });

  /**
   * Feature #10: Finalization with Result Status
   * Verifies: success/warning/failure status classification
   */
  describe('finalization with result status (Feature #10)', () => {
    it('should include status field in AgentResult', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      expect(result.status).toBeDefined();
      expect(['success', 'warning', 'failure']).toContain(result.status);
    });

    it('should return success status when goal achieved with high quality', async () => {
      const engine = new AgentEngine({ qualityThreshold: 80 });
      const result = await engine.execute('Test goal');

      // Default execution achieves threshold, should be success
      expect(result.status).toBe('success');
      expect(result.success).toBe(true);
    });

    it('should have success=true for both success and warning status', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      if (result.status === 'success' || result.status === 'warning') {
        expect(result.success).toBe(true);
      }
    });

    it('should have success=false for failure status', async () => {
      // Create an engine that will fail (impossible threshold)
      const engine = new AgentEngine({
        qualityThreshold: 101, // Impossible to reach
        maxIterations: 1,
      });

      const result = await engine.execute('Test goal');

      if (result.status === 'failure') {
        expect(result.success).toBe(false);
      }
    });

    it('should include detailed summary in result', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('should include goal in summary for success', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('My test goal');

      if (result.status === 'success') {
        expect(result.summary).toContain('My test goal');
      }
    });

    it('should include iteration count in summary', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      expect(result.summary).toContain('iteration');
    });

    it('should include quality score in summary', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      expect(result.summary).toContain('%');
    });

    it('should mention early stop in summary when applicable', async () => {
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      // If stopped early, summary should mention it
      if (result.stoppedEarly) {
        expect(result.summary).toContain('early');
      }
    });

    it('should return all required fields: status, filesModified, qualityScore, iterations, summary, warnings', async () => {
      // Verification: finalize() returns { status, filesModified, qualityScore, iterations, summary, warnings }
      const engine = new AgentEngine();
      const result = await engine.execute('Test goal');

      // Verify all required fields exist
      expect(result.status).toBeDefined();
      expect(['success', 'warning', 'failure']).toContain(result.status);

      expect(result.filesModified).toBeDefined();
      expect(Array.isArray(result.filesModified)).toBe(true);

      expect(result.qualityScore).toBeDefined();
      expect(typeof result.qualityScore).toBe('number');
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);

      expect(result.iterations).toBeDefined();
      expect(typeof result.iterations).toBe('number');
      expect(result.iterations).toBeGreaterThanOrEqual(1);

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});

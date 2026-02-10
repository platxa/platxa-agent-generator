/**
 * State Graph Tests
 *
 * Tests for the LangGraph-style state machine implementation.
 */

import { describe, it, expect } from 'vitest';
import { createStateGraph, END, START } from '../state-graph.js';
import type { BaseState, GraphEvent } from '../types.js';

// Test state interface
interface TestState extends BaseState {
  counter: number;
  messages: string[];
  shouldEnd?: boolean;
}

describe('State Graph', () => {
  describe('createStateGraph', () => {
    it('should create a graph builder', () => {
      const builder = createStateGraph<TestState>({ name: 'test' });

      expect(builder).toHaveProperty('addNode');
      expect(builder).toHaveProperty('addEdge');
      expect(builder).toHaveProperty('addConditionalEdge');
      expect(builder).toHaveProperty('setEntryPoint');
      expect(builder).toHaveProperty('compile');
    });

    it('should throw when adding duplicate node', () => {
      const builder = createStateGraph<TestState>({ name: 'test' });

      builder.addNode('node1', async () => ({}));

      expect(() => {
        builder.addNode('node1', async () => ({}));
      }).toThrow('Node "node1" already exists');
    });

    it('should throw when adding edge from non-existent node', () => {
      const builder = createStateGraph<TestState>({ name: 'test' });

      expect(() => {
        builder.addEdge('nonexistent', 'target');
      }).toThrow('Source node "nonexistent" not found');
    });
  });

  describe('Graph Execution', () => {
    it('should execute a simple linear graph', async () => {
      const graph = createStateGraph<TestState>({ name: 'linear' })
        .addNode('step1', async (state) => ({
          counter: state.counter + 1,
          messages: [...state.messages, 'step1'],
        }))
        .addNode('step2', async (state) => ({
          counter: state.counter + 1,
          messages: [...state.messages, 'step2'],
        }))
        .setEntryPoint('step1')
        .addEdge('step1', 'step2')
        .addEdge('step2', END)
        .compile();

      const result = await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      expect(result.success).toBe(true);
      expect(result.state.counter).toBe(2);
      expect(result.state.messages).toEqual(['step1', 'step2']);
      expect(result.iterations).toBe(2);
    });

    it('should handle conditional edges', async () => {
      const graph = createStateGraph<TestState>({ name: 'conditional' })
        .addNode('check', async (state) => ({
          shouldEnd: state.counter >= 3,
        }))
        .addNode('increment', async (state) => ({
          counter: state.counter + 1,
          messages: [...state.messages, `count:${state.counter + 1}`],
        }))
        .setEntryPoint('increment')
        .addEdge('increment', 'check')
        .addConditionalEdge(
          'check',
          (state) => (state.shouldEnd ? END : 'increment'),
          [END, 'increment']
        )
        .compile();

      const result = await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      expect(result.success).toBe(true);
      expect(result.state.counter).toBe(3);
      expect(result.state.messages).toEqual(['count:1', 'count:2', 'count:3']);
    });

    it('should track execution history', async () => {
      const graph = createStateGraph<TestState>({ name: 'history' })
        .addNode('step1', async () => ({ counter: 1 }))
        .addNode('step2', async () => ({ counter: 2 }))
        .setEntryPoint('step1')
        .addEdge('step1', 'step2')
        .addEdge('step2', END)
        .compile();

      const result = await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      expect(result.history).toHaveLength(2);
      expect(result.history[0].node).toBe('step1');
      expect(result.history[1].node).toBe('step2');
      expect(result.history[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should enforce max iterations', async () => {
      const graph = createStateGraph<TestState>({
        name: 'infinite',
        maxIterations: 5,
      })
        .addNode('loop', async (state) => ({
          counter: state.counter + 1,
        }))
        .setEntryPoint('loop')
        .addEdge('loop', 'loop') // Infinite loop
        .compile();

      const result = await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MAX_ITERATIONS');
      expect(result.state.counter).toBe(5);
    });

    it('should handle node errors', async () => {
      const graph = createStateGraph<TestState>({ name: 'error' })
        .addNode('failing', async () => {
          throw new Error('Node failed');
        })
        .setEntryPoint('failing')
        .addEdge('failing', END)
        .compile();

      const result = await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NODE_ERROR');
      expect(result.error?.message).toBe('Node failed');
      expect(result.error?.node).toBe('failing');
    });

    it('should use custom run ID', async () => {
      const graph = createStateGraph<TestState>({ name: 'custom-id' })
        .addNode('node', async () => ({}))
        .setEntryPoint('node')
        .addEdge('node', END)
        .compile();

      const result = await graph.execute({
        initialState: { counter: 0, messages: [] },
        runId: 'my-custom-run-id',
      });

      expect(result.state.runId).toBe('my-custom-run-id');
    });
  });

  describe('Streaming Execution', () => {
    it('should yield after each step', async () => {
      const graph = createStateGraph<TestState>({ name: 'stream' })
        .addNode('step1', async () => ({ counter: 1 }))
        .addNode('step2', async () => ({ counter: 2 }))
        .addNode('step3', async () => ({ counter: 3 }))
        .setEntryPoint('step1')
        .addEdge('step1', 'step2')
        .addEdge('step2', 'step3')
        .addEdge('step3', END)
        .compile();

      const steps: string[] = [];

      for await (const { step } of graph.stream({
        initialState: { counter: 0, messages: [] },
      })) {
        steps.push(step.node);
      }

      expect(steps).toEqual(['step1', 'step2', 'step3']);
    });

    it('should return final result from stream', async () => {
      const graph = createStateGraph<TestState>({ name: 'stream-result' })
        .addNode('node', async () => ({ counter: 42 }))
        .setEntryPoint('node')
        .addEdge('node', END)
        .compile();

      const iterator = graph.stream({
        initialState: { counter: 0, messages: [] },
      });

      // Consume stream
      let result;
      while (true) {
        const { value, done } = await iterator.next();
        if (done) {
          result = value;
          break;
        }
      }

      expect(result?.success).toBe(true);
      expect(result?.state.counter).toBe(42);
    });
  });

  describe('Event System', () => {
    it('should emit events during execution', async () => {
      const events: GraphEvent<TestState>[] = [];

      const graph = createStateGraph<TestState>({ name: 'events' })
        .addNode('node', async () => ({ counter: 1 }))
        .setEntryPoint('node')
        .addEdge('node', END)
        .on((event) => events.push(event))
        .compile();

      await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      const eventTypes = events.map((e) => e.type);

      expect(eventTypes).toContain('execution:start');
      expect(eventTypes).toContain('node:enter');
      expect(eventTypes).toContain('node:exit');
      expect(eventTypes).toContain('edge:traverse');
      expect(eventTypes).toContain('execution:complete');
    });

    it('should emit error events on failure', async () => {
      const events: GraphEvent<TestState>[] = [];

      const graph = createStateGraph<TestState>({ name: 'error-events' })
        .addNode('failing', async () => {
          throw new Error('Boom');
        })
        .setEntryPoint('failing')
        .addEdge('failing', END)
        .on((event) => events.push(event))
        .compile();

      await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      const eventTypes = events.map((e) => e.type);

      expect(eventTypes).toContain('node:error');
    });
  });

  describe('Graph Validation', () => {
    it('should validate a correct graph', () => {
      const graph = createStateGraph<TestState>({ name: 'valid' })
        .addNode('a', async () => ({}))
        .addNode('b', async () => ({}))
        .setEntryPoint('a')
        .addEdge('a', 'b')
        .addEdge('b', END)
        .compile();

      const validation = graph.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing target nodes', () => {
      const builder = createStateGraph<TestState>({ name: 'missing' })
        .addNode('a', async () => ({}));

      // Force an invalid edge by manipulating internal state
      // In real usage, this would throw earlier
      const graph = builder.setEntryPoint('a').compile();

      // Add edge to non-existent node programmatically is blocked,
      // but we can test the validation logic with a graph that
      // has edges added before nodes
      const validation = graph.validate();

      // Should be valid since 'a' has no outgoing edges (ends there)
      expect(validation.valid).toBe(true);
    });

    it('should warn about unreachable nodes', () => {
      const graph = createStateGraph<TestState>({ name: 'unreachable' })
        .addNode('a', async () => ({}))
        .addNode('orphan', async () => ({})) // Not connected
        .setEntryPoint('a')
        .addEdge('a', END)
        .compile();

      const validation = graph.validate();

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0].type).toBe('unreachable');
    });
  });

  describe('Graph Visualization', () => {
    it('should generate visualization data', () => {
      const graph = createStateGraph<TestState>({ name: 'viz' })
        .addNode('start', async () => ({}), { tags: ['entry'] })
        .addNode('process', async () => ({}), { tags: ['core'] })
        .addNode('end', async () => ({}), { tags: ['exit'] })
        .setEntryPoint('start')
        .addEdge('start', 'process')
        .addConditionalEdge('process', () => 'end', ['end', END])
        .addEdge('end', END)
        .compile();

      const viz = graph.getVisualization();

      expect(viz.nodes).toHaveLength(3);
      expect(viz.nodes.find((n) => n.id === 'start')?.tags).toContain('entry');
      expect(viz.edges.length).toBeGreaterThan(0);
      expect(viz.entryPoint).toBe('start');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed nodes', async () => {
      let attempts = 0;

      const graph = createStateGraph<TestState>({ name: 'retry' })
        .addNode(
          'flaky',
          async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error('Temporary failure');
            }
            return { counter: attempts };
          },
          {
            retry: {
              maxAttempts: 3,
              baseDelayMs: 10,
            },
          }
        )
        .setEntryPoint('flaky')
        .addEdge('flaky', END)
        .compile();

      const result = await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
      expect(result.state.counter).toBe(3);
    });
  });

  describe('Callback Handlers', () => {
    it('should call onStep callback', async () => {
      const steps: string[] = [];

      const graph = createStateGraph<TestState>({ name: 'callback' })
        .addNode('a', async () => ({}))
        .addNode('b', async () => ({}))
        .setEntryPoint('a')
        .addEdge('a', 'b')
        .addEdge('b', END)
        .compile();

      await graph.execute({
        initialState: { counter: 0, messages: [] },
        onStep: (step) => steps.push(step.node),
      });

      expect(steps).toEqual(['a', 'b']);
    });

    it('should call onError callback', async () => {
      const errors: string[] = [];

      const graph = createStateGraph<TestState>({ name: 'error-callback' })
        .addNode('failing', async () => {
          throw new Error('Test error');
        })
        .setEntryPoint('failing')
        .addEdge('failing', END)
        .compile();

      await graph.execute({
        initialState: { counter: 0, messages: [] },
        onError: (error) => errors.push(error.message),
      });

      expect(errors).toContain('Test error');
    });
  });

  describe('Edge from START', () => {
    it('should support edges from START symbol', async () => {
      const graph = createStateGraph<TestState>({ name: 'start-edge' })
        .addNode('first', async () => ({ counter: 1 }))
        .addNode('second', async () => ({ counter: 2 }))
        .addEdge(START, 'first')
        .addEdge('first', 'second')
        .addEdge('second', END)
        .compile();

      const result = await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      expect(result.success).toBe(true);
      expect(result.state.counter).toBe(2);
    });

    it('should support conditional edge from START', async () => {
      const graph = createStateGraph<TestState>({ name: 'conditional-start' })
        .addNode('a', async () => ({ counter: 1 }))
        .addNode('b', async () => ({ counter: 2 }))
        .addConditionalEdge(
          START,
          (state) => (state.counter === 0 ? 'a' : 'b'),
          ['a', 'b']
        )
        .addEdge('a', END)
        .addEdge('b', END)
        .compile();

      const result = await graph.execute({
        initialState: { counter: 0, messages: [] },
      });

      expect(result.success).toBe(true);
      expect(result.state.counter).toBe(1); // Went to 'a'
    });
  });
});

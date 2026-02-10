/**
 * LangGraph-Style State Machine
 *
 * Provides a directed graph abstraction for agent orchestration,
 * replacing freeform loops with structured state transitions.
 *
 * @example Basic usage
 * ```typescript
 * import { createStateGraph, END } from 'platxa-frontend-agent/state-graph';
 *
 * interface MyState extends BaseState {
 *   input: string;
 *   result?: string;
 * }
 *
 * const graph = createStateGraph<MyState>({ name: 'my-workflow' })
 *   .addNode('process', async (state) => ({
 *     result: state.input.toUpperCase(),
 *   }))
 *   .addNode('validate', async (state) => ({
 *     isValid: state.result?.length > 0,
 *   }))
 *   .setEntryPoint('process')
 *   .addEdge('process', 'validate')
 *   .addConditionalEdge('validate', (state) =>
 *     state.isValid ? END : 'process',
 *     [END, 'process']
 *   )
 *   .compile();
 *
 * const result = await graph.execute({
 *   initialState: { input: 'hello' },
 * });
 * ```
 *
 * @example Streaming execution
 * ```typescript
 * for await (const { step, state } of graph.stream()) {
 *   console.log(`Completed: ${step.node}`);
 * }
 * ```
 *
 * @module react-agent/state-graph
 */

// Main exports
export { createStateGraph, END, START } from './state-graph.js';

// Type exports
export type {
  // State types
  BaseState,
  StateMetadata,
  ExecutionStep,
  GraphError,
  // Node types
  NodeFunction,
  NodeConfig,
  GraphNode,
  RetryConfig,
  // Edge types
  EdgeType,
  DirectEdge,
  ConditionalEdge,
  Edge,
  EdgeRouter,
  // Graph types
  GraphConfig,
  CheckpointConfig,
  CheckpointHandler,
  ExecuteOptions,
  ExecuteResult,
  CompiledGraph,
  GraphVisualization,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  // Event types
  GraphEvent,
  GraphEventListener,
  // Builder types
  StateGraphBuilder,
} from './types.js';

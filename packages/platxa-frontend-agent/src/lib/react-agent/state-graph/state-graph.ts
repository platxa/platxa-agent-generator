/**
 * LangGraph-Style State Machine
 *
 * Implements a directed graph for agent orchestration with:
 * - Nodes: Computation units that transform state
 * - Edges: Direct or conditional transitions
 * - State channels: Typed state management
 * - Streaming: Step-by-step execution
 *
 * @module react-agent/state-graph/state-graph
 */

import type {
  BaseState,
  StateMetadata,
  ExecutionStep,
  GraphError,
  GraphNode,
  Edge,
  DirectEdge,
  ConditionalEdge,
  GraphConfig,
  ExecuteOptions,
  ExecuteResult,
  CompiledGraph,
  GraphVisualization,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  GraphEvent,
  GraphEventListener,
  StateGraphBuilder,
} from './types.js';

import { END, START } from './types.js';
export { END, START } from './types.js';

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Generate a unique run ID
 */
function generateRunId(): string {
  // Use crypto.randomUUID if available (Node 19+, modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create initial state metadata
 */
function createMetadata(): StateMetadata {
  const now = Date.now();
  return {
    startedAt: now,
    updatedAt: now,
    iterations: 0,
    visitCounts: {},
  };
}

/**
 * Create an execution step record
 */
function createStep(
  node: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  durationMs: number
): ExecutionStep {
  return {
    node,
    input,
    output,
    durationMs,
    timestamp: Date.now(),
  };
}

/**
 * Create a graph error
 */
function createError(
  code: string,
  message: string,
  node: string,
  recoverable = false,
  stack?: string
): GraphError {
  return { code, message, node, recoverable, stack };
}

// =============================================================================
// STATE GRAPH IMPLEMENTATION
// =============================================================================

/**
 * Create a new state graph builder
 */
export function createStateGraph<S extends BaseState>(
  config: GraphConfig
): StateGraphBuilder<S> {
  const nodes = new Map<string, GraphNode<S>>();
  const entryEdges: Edge<S>[] = [];
  let entryPoint: string | null = null;
  const listeners: GraphEventListener<S>[] = [];

  const emit = (event: GraphEvent<S>): void => {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  };

  const builder: StateGraphBuilder<S> = {
    addNode(id, fn, nodeConfig = {}) {
      if (nodes.has(id)) {
        throw new Error(`Node "${id}" already exists`);
      }

      nodes.set(id, {
        config: {
          id,
          fn,
          name: nodeConfig.name ?? id,
          description: nodeConfig.description,
          retry: nodeConfig.retry,
          timeoutMs: nodeConfig.timeoutMs,
          tags: nodeConfig.tags ?? [],
        },
        edges: [],
      });

      return builder;
    },

    addEdge(from, to) {
      const edge: DirectEdge = {
        type: 'direct',
        target: to === END ? '__END__' : to,
      };

      if (from === START) {
        entryEdges.push(edge);
      } else {
        const node = nodes.get(from);
        if (!node) {
          throw new Error(`Source node "${from}" not found`);
        }
        node.edges.push(edge);
      }

      return builder;
    },

    addConditionalEdge(from, router, targets) {
      const edge: ConditionalEdge<S> = {
        type: 'conditional',
        router,
        targets: targets.map((t) => (t === END ? '__END__' : t)),
      };

      if (from === START) {
        entryEdges.push(edge);
      } else {
        const node = nodes.get(from);
        if (!node) {
          throw new Error(`Source node "${from}" not found`);
        }
        node.edges.push(edge);
      }

      return builder;
    },

    setEntryPoint(nodeId) {
      if (!nodes.has(nodeId)) {
        throw new Error(`Entry node "${nodeId}" not found`);
      }
      entryPoint = nodeId;
      return builder;
    },

    on(listener) {
      listeners.push(listener);
      return builder;
    },

    compile() {
      // Validate entry point
      if (!entryPoint && entryEdges.length === 0) {
        throw new Error('Graph must have an entry point');
      }

      // If entry point is set but no entry edges, create direct edge
      if (entryPoint && entryEdges.length === 0) {
        entryEdges.push({ type: 'direct', target: entryPoint });
      }

      return compileGraph(config, nodes, entryEdges, emit);
    },
  };

  return builder;
}

/**
 * Compile the graph into an executable form
 */
function compileGraph<S extends BaseState>(
  config: GraphConfig,
  nodes: Map<string, GraphNode<S>>,
  entryEdges: Edge<S>[],
  emit: (event: GraphEvent<S>) => void
): CompiledGraph<S> {
  const maxIterations = config.maxIterations ?? 100;
  const globalTimeout = config.timeoutMs ?? 300000; // 5 minutes

  /**
   * Resolve the next node from edges
   */
  async function resolveNextNode(
    edges: Edge<S>[],
    state: S
  ): Promise<string | null> {
    if (edges.length === 0) {
      return null;
    }

    for (const edge of edges) {
      if (edge.type === 'direct') {
        return edge.target === '__END__' ? null : edge.target;
      }

      if (edge.type === 'conditional') {
        const result = await edge.router(state);
        if (result === END) {
          return null;
        }
        return result;
      }
    }

    return null;
  }

  /**
   * Execute a single node
   */
  async function executeNode(
    node: GraphNode<S>,
    state: S
  ): Promise<{ output: Partial<S>; durationMs: number }> {
    const startTime = Date.now();
    const nodeConfig = node.config;

    // Apply timeout if configured
    const timeout = nodeConfig.timeoutMs ?? globalTimeout;

    try {
      const output = await Promise.race([
        Promise.resolve(nodeConfig.fn(state)),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Node "${nodeConfig.id}" timed out`)),
            timeout
          )
        ),
      ]);

      return {
        output,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      // Handle retry logic
      if (nodeConfig.retry) {
        const { maxAttempts, baseDelayMs, backoffMultiplier = 2, maxDelayMs = 30000 } = nodeConfig.retry;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const delay = Math.min(
            baseDelayMs * Math.pow(backoffMultiplier, attempt - 1),
            maxDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));

          try {
            const output = await Promise.resolve(nodeConfig.fn(state));
            return {
              output,
              durationMs: Date.now() - startTime,
            };
          } catch {
            if (attempt === maxAttempts) {
              throw error;
            }
          }
        }
      }

      throw error;
    }
  }

  /**
   * Create initial state
   */
  function createInitialState(
    options: ExecuteOptions<S>,
    firstNode: string
  ): S {
    const runId = options.runId ?? generateRunId();

    const baseState: BaseState = {
      runId,
      currentNode: firstNode,
      history: [],
      isComplete: false,
      metadata: createMetadata(),
    };

    return {
      ...baseState,
      ...options.initialState,
      runId, // Ensure runId is not overwritten
      currentNode: firstNode,
      history: [],
      isComplete: false,
      metadata: createMetadata(),
    } as unknown as S;
  }

  return {
    config,

    async execute(options = {}): Promise<ExecuteResult<S>> {
      const startTime = Date.now();

      // Create temp state with initial values for entry routing
      const tempState = {
        currentNode: '__START__',
        ...options.initialState,
      } as S;
      const firstNode = await resolveNextNode(entryEdges, tempState);

      if (!firstNode) {
        throw new Error('Could not resolve entry node');
      }

      let state = createInitialState(options, firstNode);
      const maxIter = options.maxIterations ?? maxIterations;

      emit({ type: 'execution:start', runId: state.runId, state });

      try {
        let iterations = 0;

        while (!state.isComplete && iterations < maxIter) {
          iterations++;
          state.metadata.iterations = iterations;
          state.metadata.updatedAt = Date.now();

          const currentNodeId = state.currentNode;
          const node = nodes.get(currentNodeId);

          if (!node) {
            const error = createError(
              'NODE_NOT_FOUND',
              `Node "${currentNodeId}" not found`,
              currentNodeId
            );
            state.error = error;
            state.isComplete = true;
            emit({ type: 'execution:error', runId: state.runId, error });
            break;
          }

          // Track visit count
          state.metadata.visitCounts[currentNodeId] =
            (state.metadata.visitCounts[currentNodeId] ?? 0) + 1;

          emit({ type: 'node:enter', runId: state.runId, node: currentNodeId, state });

          try {
            // Capture input snapshot
            const inputSnapshot = { ...state } as Record<string, unknown>;

            // Execute node
            const { output, durationMs } = await executeNode(node, state);

            // Create step record
            const step = createStep(
              currentNodeId,
              inputSnapshot,
              output as Record<string, unknown>,
              durationMs
            );
            state.history.push(step);

            // Merge output into state
            state = { ...state, ...output };

            emit({
              type: 'node:exit',
              runId: state.runId,
              node: currentNodeId,
              output,
              durationMs,
            });

            options.onStep?.(step, state);

            // Resolve next node
            const nextNode = await resolveNextNode(node.edges, state);

            if (nextNode === null) {
              state.isComplete = true;
              emit({
                type: 'edge:traverse',
                runId: state.runId,
                from: currentNodeId,
                to: 'END',
              });
            } else {
              emit({
                type: 'edge:traverse',
                runId: state.runId,
                from: currentNodeId,
                to: nextNode,
              });
              state.currentNode = nextNode;
            }

            // Checkpointing
            if (
              config.checkpointing?.enabled &&
              config.checkpointing.handler &&
              iterations % (config.checkpointing.interval ?? 1) === 0
            ) {
              await config.checkpointing.handler.save(state.runId, state);
              emit({ type: 'checkpoint:save', runId: state.runId, step: iterations });
            }
          } catch (error) {
            const graphError = createError(
              'NODE_ERROR',
              error instanceof Error ? error.message : 'Unknown error',
              currentNodeId,
              false,
              error instanceof Error ? error.stack : undefined
            );
            state.error = graphError;
            state.isComplete = true;

            emit({ type: 'node:error', runId: state.runId, node: currentNodeId, error: graphError });
            options.onError?.(graphError, state);
          }
        }

        // Check for max iterations
        if (iterations >= maxIter && !state.isComplete) {
          const error = createError(
            'MAX_ITERATIONS',
            `Exceeded maximum iterations (${maxIter})`,
            state.currentNode
          );
          state.error = error;
          state.isComplete = true;
        }

        const result: ExecuteResult<S> = {
          state,
          success: !state.error,
          error: state.error,
          history: state.history,
          durationMs: Date.now() - startTime,
          iterations,
        };

        emit({ type: 'execution:complete', runId: state.runId, result });

        return result;
      } catch (error) {
        const graphError = createError(
          'EXECUTION_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
          state.currentNode,
          false,
          error instanceof Error ? error.stack : undefined
        );

        emit({ type: 'execution:error', runId: state.runId, error: graphError });

        return {
          state: { ...state, error: graphError, isComplete: true },
          success: false,
          error: graphError,
          history: state.history,
          durationMs: Date.now() - startTime,
          iterations: state.metadata.iterations,
        };
      }
    },

    async *stream(options = {}): AsyncGenerator<
      { step: ExecutionStep; state: S },
      ExecuteResult<S>
    > {
      const startTime = Date.now();

      // Create temp state with initial values for entry routing
      const tempState = {
        currentNode: '__START__',
        ...options.initialState,
      } as S;
      const firstNode = await resolveNextNode(entryEdges, tempState);

      if (!firstNode) {
        throw new Error('Could not resolve entry node');
      }

      let state = createInitialState(options, firstNode);
      const maxIter = options.maxIterations ?? maxIterations;

      emit({ type: 'execution:start', runId: state.runId, state });

      let iterations = 0;

      while (!state.isComplete && iterations < maxIter) {
        iterations++;
        state.metadata.iterations = iterations;
        state.metadata.updatedAt = Date.now();

        const currentNodeId = state.currentNode;
        const node = nodes.get(currentNodeId);

        if (!node) {
          const error = createError(
            'NODE_NOT_FOUND',
            `Node "${currentNodeId}" not found`,
            currentNodeId
          );
          state.error = error;
          state.isComplete = true;
          break;
        }

        state.metadata.visitCounts[currentNodeId] =
          (state.metadata.visitCounts[currentNodeId] ?? 0) + 1;

        emit({ type: 'node:enter', runId: state.runId, node: currentNodeId, state });

        try {
          const inputSnapshot = { ...state } as Record<string, unknown>;
          const { output, durationMs } = await executeNode(node, state);

          const step = createStep(
            currentNodeId,
            inputSnapshot,
            output as Record<string, unknown>,
            durationMs
          );
          state.history.push(step);
          state = { ...state, ...output };

          emit({
            type: 'node:exit',
            runId: state.runId,
            node: currentNodeId,
            output,
            durationMs,
          });

          // Yield step result
          yield { step, state };

          // Resolve next node
          const nextNode = await resolveNextNode(node.edges, state);

          if (nextNode === null) {
            state.isComplete = true;
            emit({
              type: 'edge:traverse',
              runId: state.runId,
              from: currentNodeId,
              to: 'END',
            });
          } else {
            emit({
              type: 'edge:traverse',
              runId: state.runId,
              from: currentNodeId,
              to: nextNode,
            });
            state.currentNode = nextNode;
          }
        } catch (error) {
          const graphError = createError(
            'NODE_ERROR',
            error instanceof Error ? error.message : 'Unknown error',
            currentNodeId,
            false,
            error instanceof Error ? error.stack : undefined
          );
          state.error = graphError;
          state.isComplete = true;

          emit({ type: 'node:error', runId: state.runId, node: currentNodeId, error: graphError });
        }
      }

      if (iterations >= maxIter && !state.isComplete) {
        const error = createError(
          'MAX_ITERATIONS',
          `Exceeded maximum iterations (${maxIter})`,
          state.currentNode
        );
        state.error = error;
        state.isComplete = true;
      }

      const result: ExecuteResult<S> = {
        state,
        success: !state.error,
        error: state.error,
        history: state.history,
        durationMs: Date.now() - startTime,
        iterations,
      };

      emit({ type: 'execution:complete', runId: state.runId, result });

      return result;
    },

    getVisualization(): GraphVisualization {
      const vizNodes = Array.from(nodes.values()).map((n) => ({
        id: n.config.id,
        name: n.config.name ?? n.config.id,
        tags: n.config.tags ?? [],
      }));

      const vizEdges: GraphVisualization['edges'] = [];

      // Add entry edges
      for (const edge of entryEdges) {
        if (edge.type === 'direct') {
          vizEdges.push({
            source: 'START',
            target: edge.target === '__END__' ? 'END' : edge.target,
            type: 'direct',
          });
        } else {
          for (const target of edge.targets) {
            vizEdges.push({
              source: 'START',
              target: target === '__END__' ? 'END' : target,
              type: 'conditional',
              label: 'conditional',
            });
          }
        }
      }

      // Add node edges
      for (const node of nodes.values()) {
        for (const edge of node.edges) {
          if (edge.type === 'direct') {
            vizEdges.push({
              source: node.config.id,
              target: edge.target === '__END__' ? 'END' : edge.target,
              type: 'direct',
            });
          } else {
            for (const target of edge.targets) {
              vizEdges.push({
                source: node.config.id,
                target: target === '__END__' ? 'END' : target,
                type: 'conditional',
                label: 'conditional',
              });
            }
          }
        }
      }

      const firstEntry = entryEdges[0];
      const entryPointId =
        firstEntry?.type === 'direct'
          ? firstEntry.target === '__END__'
            ? 'END'
            : firstEntry.target
          : vizNodes[0]?.id ?? 'START';

      return {
        nodes: vizNodes,
        edges: vizEdges,
        entryPoint: entryPointId,
      };
    },

    validate(): ValidationResult {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const reachable = new Set<string>();

      // Check entry point
      if (entryEdges.length === 0) {
        errors.push({
          type: 'invalid_entry',
          message: 'Graph has no entry point',
        });
      }

      // Find all reachable nodes
      function traverse(nodeId: string): void {
        if (reachable.has(nodeId) || nodeId === '__END__') return;
        reachable.add(nodeId);

        const node = nodes.get(nodeId);
        if (!node) return;

        for (const edge of node.edges) {
          if (edge.type === 'direct') {
            if (edge.target !== '__END__') {
              traverse(edge.target);
            }
          } else {
            for (const target of edge.targets) {
              if (target !== '__END__') {
                traverse(target);
              }
            }
          }
        }
      }

      // Start traversal from entry edges
      for (const edge of entryEdges) {
        if (edge.type === 'direct' && edge.target !== '__END__') {
          traverse(edge.target);
        } else if (edge.type === 'conditional') {
          for (const target of edge.targets) {
            if (target !== '__END__') {
              traverse(target);
            }
          }
        }
      }

      // Check for unreachable nodes
      for (const nodeId of nodes.keys()) {
        if (!reachable.has(nodeId)) {
          warnings.push({
            type: 'unreachable',
            message: `Node "${nodeId}" is unreachable`,
            nodes: [nodeId],
          });
        }
      }

      // Check for missing target nodes
      for (const node of nodes.values()) {
        for (const edge of node.edges) {
          if (edge.type === 'direct') {
            if (edge.target !== '__END__' && !nodes.has(edge.target)) {
              errors.push({
                type: 'missing_node',
                message: `Edge from "${node.config.id}" targets non-existent node "${edge.target}"`,
                nodes: [node.config.id, edge.target],
              });
            }
          } else {
            for (const target of edge.targets) {
              if (target !== '__END__' && !nodes.has(target)) {
                errors.push({
                  type: 'missing_node',
                  message: `Conditional edge from "${node.config.id}" includes non-existent node "${target}"`,
                  nodes: [node.config.id, target],
                });
              }
            }
          }
        }
      }

      // Check for nodes with no outgoing edges (orphans)
      for (const node of nodes.values()) {
        if (node.edges.length === 0 && !reachable.has(node.config.id)) {
          warnings.push({
            type: 'no_end_path',
            message: `Node "${node.config.id}" has no outgoing edges`,
            nodes: [node.config.id],
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },
  };
}

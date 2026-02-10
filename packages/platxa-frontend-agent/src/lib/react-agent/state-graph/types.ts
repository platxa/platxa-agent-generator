/**
 * LangGraph-Style State Machine Types
 *
 * Type definitions for directed graph-based agent orchestration.
 * Provides a structured alternative to freeform loops.
 *
 * @module react-agent/state-graph/types
 */

// =============================================================================
// STATE TYPES
// =============================================================================

/**
 * Base state that all graph states must extend
 */
export interface BaseState {
  /** Unique identifier for this execution */
  readonly runId: string;
  /** Current node in the graph */
  currentNode: string;
  /** Execution history */
  history: ExecutionStep[];
  /** Error if execution failed */
  error?: GraphError;
  /** Whether execution is complete */
  isComplete: boolean;
  /** Execution metadata */
  metadata: StateMetadata;
}

/**
 * State metadata for tracking execution
 */
export interface StateMetadata {
  /** Execution start time */
  startedAt: number;
  /** Last update time */
  updatedAt: number;
  /** Total iterations */
  iterations: number;
  /** Node visit counts */
  visitCounts: Record<string, number>;
}

/**
 * A single execution step in history
 */
export interface ExecutionStep {
  /** Node that was executed */
  node: string;
  /** Input state snapshot */
  input: Record<string, unknown>;
  /** Output state changes */
  output: Record<string, unknown>;
  /** Step duration in ms */
  durationMs: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Graph execution error
 */
export interface GraphError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Node where error occurred */
  node: string;
  /** Stack trace if available */
  stack?: string;
  /** Whether error is recoverable */
  recoverable: boolean;
}

// =============================================================================
// NODE TYPES
// =============================================================================

/**
 * Node function that processes state
 */
export type NodeFunction<S extends BaseState> = (
  state: S
) => Promise<Partial<S>> | Partial<S>;

/**
 * Node configuration
 */
export interface NodeConfig<S extends BaseState> {
  /** Unique node identifier */
  id: string;
  /** Human-readable name */
  name?: string;
  /** Node description */
  description?: string;
  /** The node function */
  fn: NodeFunction<S>;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Timeout in ms */
  timeoutMs?: number;
  /** Tags for filtering/querying */
  tags?: string[];
}

/**
 * Retry configuration for nodes
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Base delay between retries in ms */
  baseDelayMs: number;
  /** Exponential backoff multiplier */
  backoffMultiplier?: number;
  /** Maximum delay in ms */
  maxDelayMs?: number;
  /** Errors to retry on */
  retryOn?: string[];
}

/**
 * Registered node in the graph
 */
export interface GraphNode<S extends BaseState> {
  /** Node configuration */
  config: NodeConfig<S>;
  /** Outgoing edges */
  edges: Edge<S>[];
}

// =============================================================================
// EDGE TYPES
// =============================================================================

/**
 * Edge types
 */
export type EdgeType = 'direct' | 'conditional';

/**
 * Direct edge to a specific node
 */
export interface DirectEdge {
  type: 'direct';
  /** Target node ID */
  target: string;
}

/**
 * Conditional edge with routing function
 */
export interface ConditionalEdge<S extends BaseState> {
  type: 'conditional';
  /** Function to determine next node */
  router: EdgeRouter<S>;
  /** Possible target nodes (for validation) */
  targets: string[];
}

/**
 * Edge union type
 */
export type Edge<S extends BaseState> = DirectEdge | ConditionalEdge<S>;

/**
 * Edge router function
 */
export type EdgeRouter<S extends BaseState> = (
  state: S
) => string | typeof END | Promise<string | typeof END>;

/**
 * Special END constant to signal graph completion
 */
export const END = Symbol('END');
export type END = typeof END;

/**
 * Special START constant for entry point
 */
export const START = Symbol('START');
export type START = typeof START;

// =============================================================================
// GRAPH TYPES
// =============================================================================

/**
 * Graph configuration
 */
export interface GraphConfig {
  /** Graph name */
  name: string;
  /** Graph description */
  description?: string;
  /** Maximum iterations before timeout */
  maxIterations?: number;
  /** Global timeout in ms */
  timeoutMs?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Checkpoint configuration */
  checkpointing?: CheckpointConfig;
}

/**
 * Checkpoint configuration for resumable execution
 */
export interface CheckpointConfig {
  /** Enable checkpointing */
  enabled: boolean;
  /** Checkpoint every N steps */
  interval?: number;
  /** Custom checkpoint handler */
  handler?: CheckpointHandler;
}

/**
 * Checkpoint handler interface
 */
export interface CheckpointHandler {
  /** Save checkpoint */
  save: (runId: string, state: BaseState) => Promise<void>;
  /** Load checkpoint */
  load: (runId: string) => Promise<BaseState | null>;
  /** Delete checkpoint */
  delete: (runId: string) => Promise<void>;
}

/**
 * Graph execution options
 */
export interface ExecuteOptions<S extends BaseState> {
  /** Initial state (partial, will be merged with defaults) */
  initialState?: Partial<S>;
  /** Run ID for this execution */
  runId?: string;
  /** Resume from checkpoint */
  resumeFrom?: string;
  /** Maximum iterations override */
  maxIterations?: number;
  /** Timeout override */
  timeoutMs?: number;
  /** Callback for each step */
  onStep?: (step: ExecutionStep, state: S) => void;
  /** Callback for errors */
  onError?: (error: GraphError, state: S) => void;
}

/**
 * Graph execution result
 */
export interface ExecuteResult<S extends BaseState> {
  /** Final state */
  state: S;
  /** Whether execution completed successfully */
  success: boolean;
  /** Error if failed */
  error?: GraphError;
  /** Execution history */
  history: ExecutionStep[];
  /** Total duration in ms */
  durationMs: number;
  /** Total iterations */
  iterations: number;
}

// =============================================================================
// COMPILED GRAPH TYPES
// =============================================================================

/**
 * Compiled graph ready for execution
 */
export interface CompiledGraph<S extends BaseState> {
  /** Graph configuration */
  config: GraphConfig;
  /** Execute the graph */
  execute: (options?: ExecuteOptions<S>) => Promise<ExecuteResult<S>>;
  /** Stream execution (yields after each step) */
  stream: (
    options?: ExecuteOptions<S>
  ) => AsyncGenerator<{ step: ExecutionStep; state: S }, ExecuteResult<S>>;
  /** Get graph visualization data */
  getVisualization: () => GraphVisualization;
  /** Validate the graph structure */
  validate: () => ValidationResult;
}

/**
 * Graph visualization data
 */
export interface GraphVisualization {
  /** All nodes */
  nodes: Array<{
    id: string;
    name: string;
    tags: string[];
  }>;
  /** All edges */
  edges: Array<{
    source: string;
    target: string | 'END';
    type: EdgeType;
    label?: string;
  }>;
  /** Entry point */
  entryPoint: string;
}

/**
 * Graph validation result
 */
export interface ValidationResult {
  /** Whether graph is valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error type */
  type: 'missing_node' | 'orphan_node' | 'cycle' | 'invalid_entry';
  /** Error message */
  message: string;
  /** Related nodes */
  nodes?: string[];
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning type */
  type: 'unreachable' | 'no_end_path' | 'duplicate_edge';
  /** Warning message */
  message: string;
  /** Related nodes */
  nodes?: string[];
}

// =============================================================================
// EVENT TYPES
// =============================================================================

/**
 * Graph execution events
 */
export type GraphEvent<S extends BaseState> =
  | { type: 'execution:start'; runId: string; state: S }
  | { type: 'node:enter'; runId: string; node: string; state: S }
  | { type: 'node:exit'; runId: string; node: string; output: Partial<S>; durationMs: number }
  | { type: 'node:error'; runId: string; node: string; error: GraphError }
  | { type: 'edge:traverse'; runId: string; from: string; to: string | 'END' }
  | { type: 'checkpoint:save'; runId: string; step: number }
  | { type: 'execution:complete'; runId: string; result: ExecuteResult<S> }
  | { type: 'execution:error'; runId: string; error: GraphError };

/**
 * Event listener type
 */
export type GraphEventListener<S extends BaseState> = (
  event: GraphEvent<S>
) => void;

// =============================================================================
// BUILDER TYPES
// =============================================================================

/**
 * State graph builder interface
 */
export interface StateGraphBuilder<S extends BaseState> {
  /** Add a node to the graph */
  addNode: (
    id: string,
    fn: NodeFunction<S>,
    config?: Partial<Omit<NodeConfig<S>, 'id' | 'fn'>>
  ) => StateGraphBuilder<S>;

  /** Add a direct edge between nodes */
  addEdge: (from: string | START, to: string | END) => StateGraphBuilder<S>;

  /** Add a conditional edge with router */
  addConditionalEdge: (
    from: string | START,
    router: EdgeRouter<S>,
    targets: (string | END)[]
  ) => StateGraphBuilder<S>;

  /** Set the entry point */
  setEntryPoint: (nodeId: string) => StateGraphBuilder<S>;

  /** Add event listener */
  on: (listener: GraphEventListener<S>) => StateGraphBuilder<S>;

  /** Compile the graph */
  compile: () => CompiledGraph<S>;
}

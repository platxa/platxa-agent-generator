/**
 * Causal Chain Reconstructor
 *
 * Reconstructs the chain of causes and effects that lead to a bug,
 * tracing data flow, function calls, and event sequences.
 *
 * Feature #35: Causal chain reconstructor for debugging
 *
 * @module causal-chain
 */

import type { SourceLocation, NormalizedError, StackFrame, Evidence } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Type of causal relationship
 */
export type CausalRelationType =
  | 'data-flow'        // Data passed from one location to another
  | 'control-flow'     // Control flow dependency
  | 'call'             // Function/method call
  | 'callback'         // Asynchronous callback
  | 'event'            // Event trigger
  | 'exception'        // Exception propagation
  | 'state-mutation'   // State change causing effect
  | 'temporal'         // Temporal ordering (happened-before)
  | 'resource'         // Resource dependency (file, network, etc.)
  | 'configuration';   // Configuration-based dependency

/**
 * A node in the causal chain
 */
export interface CausalNode {
  /** Unique identifier */
  id: string;
  /** Node type */
  type: CausalNodeType;
  /** Description of what happened at this node */
  description: string;
  /** Source location */
  location?: SourceLocation;
  /** Timestamp (if available) */
  timestamp?: Date;
  /** Associated value or data */
  value?: unknown;
  /** Variable or symbol name */
  symbolName?: string;
  /** Function name (if applicable) */
  functionName?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Confidence in this node's role (0-1) */
  confidence: number;
}

/**
 * Type of causal node
 */
export type CausalNodeType =
  | 'error'            // The error/symptom
  | 'root-cause'       // Identified root cause
  | 'intermediate'     // Intermediate step in the chain
  | 'data-source'      // Source of problematic data
  | 'function-call'    // Function call
  | 'assignment'       // Variable assignment
  | 'condition'        // Conditional branch
  | 'loop'             // Loop iteration
  | 'event-handler'    // Event handler
  | 'api-call'         // External API call
  | 'state-change'     // State mutation
  | 'input'            // User or external input
  | 'configuration';   // Configuration value

/**
 * An edge representing a causal relationship
 */
export interface CausalEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Type of causal relationship */
  type: CausalRelationType;
  /** Description of the relationship */
  description: string;
  /** Strength of the causal link (0-1) */
  strength: number;
  /** Evidence supporting this link */
  evidence?: Evidence[];
  /** Whether this is a direct or indirect cause */
  isDirect: boolean;
}

/**
 * A complete causal chain
 */
export interface CausalChain {
  /** All nodes in the chain */
  nodes: CausalNode[];
  /** All edges in the chain */
  edges: CausalEdge[];
  /** The error node (starting point) */
  errorNode: CausalNode;
  /** Identified root cause node(s) */
  rootCauses: CausalNode[];
  /** Critical path from root cause to error */
  criticalPath: CausalNode[];
  /** Overall confidence in the reconstruction (0-1) */
  confidence: number;
  /** Analysis notes */
  notes: string[];
}

/**
 * Hypothesis about a potential cause
 */
export interface CausalHypothesis {
  /** Hypothesis ID */
  id: string;
  /** Description of the hypothesis */
  description: string;
  /** Proposed root cause node */
  proposedCause: CausalNode;
  /** Supporting evidence */
  evidence: Evidence[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Alternative explanations */
  alternatives: string[];
  /** Suggested validation steps */
  validationSteps: string[];
}

/**
 * Data flow information
 */
export interface DataFlowInfo {
  /** Variable or value being tracked */
  variable: string;
  /** Type of the value */
  valueType?: string;
  /** Value at this point (if known) */
  value?: unknown;
  /** Transformations applied */
  transformations: DataTransformation[];
  /** Taint status */
  isTainted: boolean;
  /** Source of the data */
  source?: CausalNode;
}

/**
 * A data transformation
 */
export interface DataTransformation {
  /** Location where transformation occurred */
  location: SourceLocation;
  /** Type of transformation */
  type: 'assign' | 'compute' | 'cast' | 'parse' | 'format' | 'sanitize' | 'validate';
  /** Description of what happened */
  description: string;
  /** Value before transformation */
  beforeValue?: unknown;
  /** Value after transformation */
  afterValue?: unknown;
}

/**
 * Configuration for the causal chain reconstructor
 */
export interface CausalChainConfig {
  /** Maximum depth to trace backwards */
  maxDepth: number;
  /** Maximum number of nodes to include */
  maxNodes: number;
  /** Minimum confidence threshold for including a node */
  minConfidence: number;
  /** Whether to include data flow analysis */
  includeDataFlow: boolean;
  /** Whether to include control flow analysis */
  includeControlFlow: boolean;
  /** Whether to track tainted data */
  trackTaintedData: boolean;
  /** Whether to generate hypotheses */
  generateHypotheses: boolean;
  /** Maximum hypotheses to generate */
  maxHypotheses: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: CausalChainConfig = {
  maxDepth: 20,
  maxNodes: 100,
  minConfidence: 0.3,
  includeDataFlow: true,
  includeControlFlow: true,
  trackTaintedData: true,
  generateHypotheses: true,
  maxHypotheses: 5,
};

// =============================================================================
// Causal Chain Reconstructor Implementation
// =============================================================================

/**
 * Causal Chain Reconstructor
 *
 * Reconstructs the chain of events and data flow that led to an error,
 * helping identify root causes and understand bug propagation.
 */
export class CausalChainReconstructor {
  private config: CausalChainConfig;
  private nodeCounter = 0;

  constructor(config: Partial<CausalChainConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Chain Reconstruction
  // ===========================================================================

  /**
   * Reconstruct causal chain from an error and its context
   */
  reconstruct(
    error: NormalizedError,
    context: {
      sourceCode?: Map<string, string>;
      stackTrace?: StackFrame[];
      relatedErrors?: NormalizedError[];
      dataFlowHints?: DataFlowInfo[];
      eventLog?: Array<{ timestamp: Date; event: string; data?: unknown }>;
    } = {}
  ): CausalChain {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];
    const notes: string[] = [];

    // Create error node (the symptom)
    const errorNode = this.createErrorNode(error);
    nodes.push(errorNode);

    // Process stack trace if available
    if (context.stackTrace && context.stackTrace.length > 0) {
      this.processStackTrace(context.stackTrace, errorNode, nodes, edges, notes);
    } else if (error.stackTrace && error.stackTrace.length > 0) {
      this.processStackTrace(error.stackTrace, errorNode, nodes, edges, notes);
    }

    // Process data flow hints
    if (context.dataFlowHints && context.dataFlowHints.length > 0) {
      this.processDataFlow(context.dataFlowHints, errorNode, nodes, edges, notes);
    }

    // Process event log for temporal causality
    if (context.eventLog && context.eventLog.length > 0) {
      this.processEventLog(context.eventLog, errorNode, nodes, edges, notes);
    }

    // Process related errors
    if (context.relatedErrors && context.relatedErrors.length > 0) {
      this.processRelatedErrors(context.relatedErrors, errorNode, nodes, edges, notes);
    }

    // Identify root causes
    const rootCauses = this.identifyRootCauses(nodes, edges);

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(errorNode, rootCauses, nodes, edges);

    // Calculate overall confidence
    const confidence = this.calculateChainConfidence(nodes, edges, rootCauses);

    return {
      nodes,
      edges,
      errorNode,
      rootCauses,
      criticalPath,
      confidence,
      notes,
    };
  }

  /**
   * Create an error node from a normalized error
   */
  private createErrorNode(error: NormalizedError): CausalNode {
    const node: CausalNode = {
      id: this.generateNodeId(),
      type: 'error',
      description: `${error.type}: ${error.message}`,
      confidence: 1.0,
      metadata: {
        errorType: error.type,
        severity: error.severity,
      },
    };
    if (error.location) {
      node.location = error.location;
    }
    if (error.code) {
      node.metadata = { ...node.metadata, errorCode: error.code };
    }
    return node;
  }

  /**
   * Process stack trace to build call chain
   */
  private processStackTrace(
    stackTrace: StackFrame[],
    errorNode: CausalNode,
    nodes: CausalNode[],
    edges: CausalEdge[],
    notes: string[]
  ): void {
    let previousNode = errorNode;

    for (let i = 0; i < Math.min(stackTrace.length, this.config.maxDepth); i++) {
      const frame = stackTrace[i];
      if (!frame) continue;

      // Skip non-user code if we have enough frames
      if (frame.isUserCode === false && i > 3) {
        continue;
      }

      const node: CausalNode = {
        id: this.generateNodeId(),
        type: 'function-call',
        description: `Call to ${frame.functionName ?? 'anonymous'}`,
        location: frame.location,
        confidence: this.calculateFrameConfidence(frame, i, stackTrace.length),
        metadata: {
          frameIndex: i,
        },
      };
      if (frame.functionName) {
        node.functionName = frame.functionName;
      }
      if (frame.isUserCode !== undefined) {
        node.metadata = { ...node.metadata, isUserCode: frame.isUserCode };
      }

      nodes.push(node);

      // Create edge from this frame to the previous
      edges.push({
        from: node.id,
        to: previousNode.id,
        type: 'call',
        description: `${frame.functionName ?? 'anonymous'} called`,
        strength: 1.0 - i * 0.1,
        isDirect: i === 0,
      });

      previousNode = node;
    }

    if (stackTrace.length > 0) {
      notes.push(`Analyzed ${Math.min(stackTrace.length, this.config.maxDepth)} stack frames`);
    }
  }

  /**
   * Calculate confidence for a stack frame
   */
  private calculateFrameConfidence(
    frame: StackFrame,
    index: number,
    totalFrames: number
  ): number {
    let confidence = 1.0;

    // Closer to error = higher confidence
    confidence *= 1.0 - (index / totalFrames) * 0.3;

    // User code = higher confidence
    if (frame.isUserCode === false) {
      confidence *= 0.7;
    }

    // Has function name = higher confidence
    if (!frame.functionName) {
      confidence *= 0.8;
    }

    return Math.max(this.config.minConfidence, confidence);
  }

  /**
   * Process data flow information
   */
  private processDataFlow(
    dataFlowInfos: DataFlowInfo[],
    errorNode: CausalNode,
    nodes: CausalNode[],
    edges: CausalEdge[],
    notes: string[]
  ): void {
    for (const dataFlow of dataFlowInfos) {
      // Create node for the data source
      if (dataFlow.source) {
        if (!nodes.find((n) => n.id === dataFlow.source!.id)) {
          nodes.push(dataFlow.source);
        }
      }

      // Create nodes for transformations
      let previousNodeId = dataFlow.source?.id;
      for (const transform of dataFlow.transformations) {
        const transformNode: CausalNode = {
          id: this.generateNodeId(),
          type: 'assignment',
          description: `${transform.type}: ${transform.description}`,
          location: transform.location,
          symbolName: dataFlow.variable,
          value: transform.afterValue,
          confidence: 0.8,
          metadata: {
            transformType: transform.type,
            beforeValue: transform.beforeValue,
            afterValue: transform.afterValue,
          },
        };

        nodes.push(transformNode);

        if (previousNodeId) {
          edges.push({
            from: previousNodeId,
            to: transformNode.id,
            type: 'data-flow',
            description: `Data flows through ${transform.type}`,
            strength: 0.9,
            isDirect: true,
          });
        }

        previousNodeId = transformNode.id;
      }

      // Connect final transformation to error if tainted
      if (previousNodeId && dataFlow.isTainted) {
        edges.push({
          from: previousNodeId,
          to: errorNode.id,
          type: 'data-flow',
          description: `Tainted data "${dataFlow.variable}" reaches error location`,
          strength: 0.95,
          isDirect: true,
        });
      }
    }

    const taintedCount = dataFlowInfos.filter((d) => d.isTainted).length;
    if (taintedCount > 0) {
      notes.push(`Tracked ${taintedCount} tainted data flows`);
    }
  }

  /**
   * Process event log for temporal causality
   */
  private processEventLog(
    eventLog: Array<{ timestamp: Date; event: string; data?: unknown }>,
    errorNode: CausalNode,
    nodes: CausalNode[],
    edges: CausalEdge[],
    notes: string[]
  ): void {
    // Sort events by timestamp
    const sortedEvents = [...eventLog].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    let previousNode: CausalNode | null = null;

    for (const event of sortedEvents) {
      const eventNode: CausalNode = {
        id: this.generateNodeId(),
        type: 'event-handler',
        description: event.event,
        timestamp: event.timestamp,
        value: event.data,
        confidence: 0.7,
        metadata: {
          eventData: event.data,
        },
      };

      nodes.push(eventNode);

      // Create temporal edge to previous event
      if (previousNode) {
        edges.push({
          from: previousNode.id,
          to: eventNode.id,
          type: 'temporal',
          description: 'Happened before',
          strength: 0.6,
          isDirect: false,
        });
      }

      previousNode = eventNode;
    }

    // Connect last event to error
    if (previousNode) {
      edges.push({
        from: previousNode.id,
        to: errorNode.id,
        type: 'temporal',
        description: 'Last event before error',
        strength: 0.8,
        isDirect: false,
      });
    }

    if (sortedEvents.length > 0) {
      notes.push(`Analyzed ${sortedEvents.length} events in temporal sequence`);
    }
  }

  /**
   * Process related errors
   */
  private processRelatedErrors(
    relatedErrors: NormalizedError[],
    errorNode: CausalNode,
    nodes: CausalNode[],
    edges: CausalEdge[],
    notes: string[]
  ): void {
    for (const relatedError of relatedErrors) {
      const relatedNode: CausalNode = {
        id: this.generateNodeId(),
        type: 'error',
        description: `Related: ${relatedError.type}: ${relatedError.message}`,
        timestamp: relatedError.timestamp,
        confidence: 0.6,
        metadata: {
          errorId: relatedError.id,
          errorType: relatedError.type,
        },
      };
      if (relatedError.location) {
        relatedNode.location = relatedError.location;
      }

      nodes.push(relatedNode);

      // Determine relationship type
      const errorNodeTimestamp = errorNode.timestamp;
      const isChainedException =
        (errorNodeTimestamp && relatedError.timestamp < errorNodeTimestamp) ||
        (relatedError.relatedErrors?.includes(errorNode.id) ?? false);

      edges.push({
        from: relatedNode.id,
        to: errorNode.id,
        type: 'exception',
        description: isChainedException ? 'Caused exception' : 'Related error',
        strength: isChainedException ? 0.9 : 0.5,
        isDirect: isChainedException,
      });
    }

    if (relatedErrors.length > 0) {
      notes.push(`Found ${relatedErrors.length} related errors`);
    }
  }

  // ===========================================================================
  // Root Cause Identification
  // ===========================================================================

  /**
   * Identify potential root causes from the causal graph
   */
  private identifyRootCauses(
    nodes: CausalNode[],
    edges: CausalEdge[]
  ): CausalNode[] {
    const rootCauses: CausalNode[] = [];

    // Build incoming edge counts
    const incomingCount = new Map<string, number>();
    for (const node of nodes) {
      incomingCount.set(node.id, 0);
    }
    for (const edge of edges) {
      const current = incomingCount.get(edge.to) ?? 0;
      incomingCount.set(edge.to, current + 1);
    }

    // Root causes are nodes with no incoming edges (sources)
    // or nodes with high confidence and strong outgoing edges
    for (const node of nodes) {
      if (node.type === 'error') continue; // Skip the error itself

      const incoming = incomingCount.get(node.id) ?? 0;
      const outgoing = edges.filter((e) => e.from === node.id);

      // No incoming edges = potential root cause
      if (incoming === 0 && outgoing.length > 0) {
        const enhancedNode: CausalNode = {
          ...node,
          type: 'root-cause',
        };
        rootCauses.push(enhancedNode);
        continue;
      }

      // High confidence node with strong outgoing edges
      const maxOutgoingStrength = Math.max(...outgoing.map((e) => e.strength), 0);
      if (node.confidence >= 0.8 && maxOutgoingStrength >= 0.9) {
        const isDataSource = node.type === 'data-source' || node.type === 'input';
        if (isDataSource) {
          rootCauses.push({ ...node, type: 'root-cause' });
        }
      }
    }

    // If no root causes found, use the deepest node(s)
    if (rootCauses.length === 0) {
      const depths = this.calculateNodeDepths(nodes, edges);
      const maxDepth = Math.max(...depths.values());
      for (const [nodeId, depth] of depths) {
        if (depth === maxDepth) {
          const node = nodes.find((n) => n.id === nodeId);
          if (node && node.type !== 'error') {
            rootCauses.push({ ...node, type: 'root-cause' });
          }
        }
      }
    }

    // Sort by confidence
    rootCauses.sort((a, b) => b.confidence - a.confidence);

    return rootCauses.slice(0, this.config.maxHypotheses);
  }

  /**
   * Calculate depth of each node from the error
   */
  private calculateNodeDepths(
    nodes: CausalNode[],
    edges: CausalEdge[]
  ): Map<string, number> {
    const depths = new Map<string, number>();

    // Find error node (depth 0)
    const errorNode = nodes.find((n) => n.type === 'error');
    if (!errorNode) return depths;

    depths.set(errorNode.id, 0);

    // BFS from error node
    const queue: string[] = [errorNode.id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentDepth = depths.get(currentId) ?? 0;

      // Find nodes that point to current
      for (const edge of edges) {
        if (edge.to === currentId && !depths.has(edge.from)) {
          depths.set(edge.from, currentDepth + 1);
          queue.push(edge.from);
        }
      }
    }

    return depths;
  }

  /**
   * Calculate critical path from root cause to error
   */
  private calculateCriticalPath(
    errorNode: CausalNode,
    rootCauses: CausalNode[],
    nodes: CausalNode[],
    edges: CausalEdge[]
  ): CausalNode[] {
    if (rootCauses.length === 0) {
      return [errorNode];
    }

    // Find path from first root cause to error
    const rootCause = rootCauses[0];
    if (!rootCause) return [errorNode];

    const path = this.findPath(rootCause.id, errorNode.id, nodes, edges);
    return path;
  }

  /**
   * Find path between two nodes using BFS
   */
  private findPath(
    startId: string,
    endId: string,
    nodes: CausalNode[],
    edges: CausalEdge[]
  ): CausalNode[] {
    const parent = new Map<string, string>();
    const visited = new Set<string>();
    const queue: string[] = [startId];

    visited.add(startId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (currentId === endId) {
        // Reconstruct path
        const path: CausalNode[] = [];
        let nodeId: string | undefined = endId;
        while (nodeId) {
          const node = nodes.find((n) => n.id === nodeId);
          if (node) {
            path.unshift(node);
          }
          nodeId = parent.get(nodeId);
        }
        return path;
      }

      // Find edges from current node
      for (const edge of edges) {
        if (edge.from === currentId && !visited.has(edge.to)) {
          visited.add(edge.to);
          parent.set(edge.to, currentId);
          queue.push(edge.to);
        }
      }
    }

    // No path found
    const startNode = nodes.find((n) => n.id === startId);
    const endNode = nodes.find((n) => n.id === endId);
    return [startNode, endNode].filter((n): n is CausalNode => n !== undefined);
  }

  /**
   * Calculate overall confidence in the causal chain
   */
  private calculateChainConfidence(
    nodes: CausalNode[],
    edges: CausalEdge[],
    rootCauses: CausalNode[]
  ): number {
    if (nodes.length === 0) return 0;

    // Factors:
    // 1. Average node confidence
    const avgNodeConfidence =
      nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length;

    // 2. Average edge strength
    const avgEdgeStrength =
      edges.length > 0
        ? edges.reduce((sum, e) => sum + e.strength, 0) / edges.length
        : 0.5;

    // 3. Chain completeness (has root causes)
    const hasRootCauses = rootCauses.length > 0 ? 1 : 0.5;

    // 4. Chain connectivity
    const connectivity = this.calculateConnectivity(nodes, edges);

    return (
      avgNodeConfidence * 0.3 +
      avgEdgeStrength * 0.3 +
      hasRootCauses * 0.2 +
      connectivity * 0.2
    );
  }

  /**
   * Calculate how well-connected the graph is
   */
  private calculateConnectivity(
    nodes: CausalNode[],
    edges: CausalEdge[]
  ): number {
    if (nodes.length <= 1) return 1;

    // Calculate the ratio of edges to maximum possible edges
    const maxEdges = nodes.length * (nodes.length - 1);
    const actualEdges = edges.length;

    // We want moderate connectivity, not too sparse or too dense
    const ratio = actualEdges / maxEdges;
    const idealRatio = 0.2; // Roughly 20% connectivity is ideal for a causal chain

    return 1 - Math.abs(ratio - idealRatio);
  }

  // ===========================================================================
  // Hypothesis Generation
  // ===========================================================================

  /**
   * Generate hypotheses about potential root causes
   */
  generateHypotheses(chain: CausalChain): CausalHypothesis[] {
    if (!this.config.generateHypotheses) return [];

    const hypotheses: CausalHypothesis[] = [];

    for (const rootCause of chain.rootCauses) {
      const hypothesis = this.createHypothesis(rootCause, chain);
      hypotheses.push(hypothesis);
    }

    // Generate alternative hypotheses from high-confidence non-root nodes
    const alternatives = chain.nodes
      .filter(
        (n) =>
          n.type !== 'error' &&
          n.type !== 'root-cause' &&
          n.confidence >= 0.7
      )
      .slice(0, this.config.maxHypotheses - hypotheses.length);

    for (const node of alternatives) {
      hypotheses.push(this.createHypothesis(node, chain));
    }

    // Sort by confidence
    hypotheses.sort((a, b) => b.confidence - a.confidence);

    return hypotheses.slice(0, this.config.maxHypotheses);
  }

  /**
   * Create a hypothesis from a potential cause node
   */
  private createHypothesis(
    node: CausalNode,
    chain: CausalChain
  ): CausalHypothesis {
    // Find edges from this node
    const outgoingEdges = chain.edges.filter((e) => e.from === node.id);
    const evidence: Evidence[] = outgoingEdges.flatMap((e) => e.evidence ?? []);

    // Generate description based on node type
    let description: string;
    switch (node.type) {
      case 'data-source':
      case 'input':
        description = `The error may be caused by invalid or unexpected data: ${node.description}`;
        break;
      case 'function-call':
        description = `The error may originate from the function call: ${node.functionName ?? node.description}`;
        break;
      case 'assignment':
        description = `The error may be caused by an incorrect assignment to ${node.symbolName ?? 'a variable'}`;
        break;
      case 'condition':
        description = `The error may be caused by an incorrect conditional evaluation`;
        break;
      case 'configuration':
        description = `The error may be caused by a configuration issue: ${node.description}`;
        break;
      default:
        description = `Potential cause: ${node.description}`;
    }

    // Generate validation steps
    const validationSteps: string[] = [];
    if (node.location) {
      validationSteps.push(
        `Review code at ${node.location.file}:${node.location.line}`
      );
    }
    if (node.symbolName) {
      validationSteps.push(`Check the value of ${node.symbolName}`);
    }
    if (node.type === 'function-call' && node.functionName) {
      validationSteps.push(`Add logging to ${node.functionName}`);
    }
    validationSteps.push('Set a breakpoint and step through the code');

    // Find alternative explanations
    const alternatives = chain.rootCauses
      .filter((rc) => rc.id !== node.id)
      .map((rc) => rc.description);

    return {
      id: `hypothesis-${node.id}`,
      description,
      proposedCause: node,
      evidence,
      confidence: node.confidence,
      alternatives,
      validationSteps,
    };
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Generate a unique node ID
   */
  private generateNodeId(): string {
    return `node-${++this.nodeCounter}`;
  }

  /**
   * Visualize the causal chain as text
   */
  visualize(chain: CausalChain): string {
    const lines: string[] = [];

    lines.push('=== Causal Chain Analysis ===');
    lines.push('');

    // Show critical path
    lines.push('Critical Path:');
    for (let i = 0; i < chain.criticalPath.length; i++) {
      const node = chain.criticalPath[i];
      if (!node) continue;

      const prefix = i === 0 ? '┌──' : i === chain.criticalPath.length - 1 ? '└──' : '├──';
      const location = node.location
        ? ` (${node.location.file}:${node.location.line})`
        : '';
      lines.push(`${prefix} [${node.type}] ${node.description}${location}`);

      if (i < chain.criticalPath.length - 1) {
        const nextNode = chain.criticalPath[i + 1];
        if (nextNode) {
          const edge = chain.edges.find(
            (e) => e.from === node.id && e.to === nextNode.id
          );
          if (edge) {
            lines.push(`│   └─ ${edge.type}: ${edge.description}`);
          }
        }
      }
    }

    lines.push('');

    // Show root causes
    lines.push('Identified Root Causes:');
    for (const rootCause of chain.rootCauses) {
      const location = rootCause.location
        ? ` at ${rootCause.location.file}:${rootCause.location.line}`
        : '';
      lines.push(
        `  • ${rootCause.description}${location} (confidence: ${(rootCause.confidence * 100).toFixed(0)}%)`
      );
    }

    lines.push('');
    lines.push(`Overall Confidence: ${(chain.confidence * 100).toFixed(0)}%`);
    lines.push(`Total Nodes: ${chain.nodes.length}`);
    lines.push(`Total Edges: ${chain.edges.length}`);

    if (chain.notes.length > 0) {
      lines.push('');
      lines.push('Notes:');
      for (const note of chain.notes) {
        lines.push(`  - ${note}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export chain as JSON
   */
  exportAsJSON(chain: CausalChain): string {
    return JSON.stringify(chain, null, 2);
  }

  /**
   * Get summary of the causal chain
   */
  getSummary(chain: CausalChain): string {
    const rootCauseDescriptions = chain.rootCauses
      .slice(0, 3)
      .map((rc) => rc.description)
      .join('; ');

    const pathLength = chain.criticalPath.length;

    return (
      `Traced ${pathLength} steps from error to root cause. ` +
      `Identified ${chain.rootCauses.length} potential cause(s): ${rootCauseDescriptions}. ` +
      `Confidence: ${(chain.confidence * 100).toFixed(0)}%.`
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a CausalChainReconstructor with optional configuration
 */
export function createCausalChainReconstructor(
  config: Partial<CausalChainConfig> = {}
): CausalChainReconstructor {
  return new CausalChainReconstructor(config);
}

/**
 * Quick function to reconstruct causal chain from an error
 */
export function reconstructCausalChain(
  error: NormalizedError,
  context?: {
    sourceCode?: Map<string, string>;
    stackTrace?: StackFrame[];
    relatedErrors?: NormalizedError[];
  },
  config: Partial<CausalChainConfig> = {}
): CausalChain {
  const reconstructor = createCausalChainReconstructor(config);
  return reconstructor.reconstruct(error, context);
}

/**
 * Quick function to generate hypotheses from a causal chain
 */
export function generateCausalHypotheses(
  chain: CausalChain,
  config: Partial<CausalChainConfig> = {}
): CausalHypothesis[] {
  const reconstructor = createCausalChainReconstructor(config);
  return reconstructor.generateHypotheses(chain);
}

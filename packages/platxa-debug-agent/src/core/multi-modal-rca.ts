/**
 * Multi-Modal Root Cause Analysis
 *
 * Features #32-36: Multi-modal RCA that combines metrics, traces, and logs
 * to construct causal graphs and identify root causes with confidence scores.
 *
 * Research basis:
 * - RCACopilot: Multi-modal incident RCA
 * - Causal inference for root cause identification
 * - Domain knowledge constraints for graph pruning
 *
 * @packageDocumentation
 */

import type { SourceLocation } from './types.js';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Feature #32: RCAInput interface
 *
 * Multi-modal input combining metrics, traces, logs, and domain constraints.
 */
export interface RCAInput {
  /** Time-series metrics (CPU, memory, latency, etc.) */
  metrics: TimeSeries[];

  /** Execution traces from distributed systems */
  traces: ExecutionTraceData[];

  /** Log entries with timestamps and severity */
  logs: LogEntry[];

  /** Domain constraints in YAML format or parsed */
  constraints?: DomainConstraints;

  /** Incident/error being investigated */
  incident: IncidentDescription;

  /** Time window for analysis */
  timeWindow: TimeWindow;
}

/**
 * Time series data point
 */
export interface TimeSeries {
  /** Metric name (e.g., "cpu_usage", "request_latency") */
  name: string;

  /** Service or component this metric belongs to */
  source: string;

  /** Data points with timestamps */
  points: TimeSeriesPoint[];

  /** Unit of measurement */
  unit?: string;

  /** Metric type */
  type: MetricType;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export type MetricType = 'gauge' | 'counter' | 'histogram' | 'summary';

/**
 * Execution trace data
 */
export interface ExecutionTraceData {
  /** Unique trace ID */
  traceId: string;

  /** Spans within this trace */
  spans: TraceSpan[];

  /** Service that initiated the trace */
  rootService: string;

  /** Overall duration in milliseconds */
  duration: number;

  /** Whether the trace indicates an error */
  hasError: boolean;
}

export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  duration: number;
  tags: Record<string, string>;
  logs: SpanLog[];
  status: SpanStatus;
}

export interface SpanLog {
  timestamp: number;
  message: string;
  level: LogLevel;
}

export type SpanStatus = 'ok' | 'error' | 'timeout' | 'cancelled';

/**
 * Log entry
 */
export interface LogEntry {
  /** Log timestamp */
  timestamp: number;

  /** Log level/severity */
  level: LogLevel;

  /** Log message */
  message: string;

  /** Source service/component */
  source: string;

  /** Structured fields */
  fields?: Record<string, unknown>;

  /** Stack trace if error */
  stackTrace?: string;

  /** Correlation ID for request tracking */
  correlationId?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Domain constraints for causal graph pruning
 */
export interface DomainConstraints {
  /** Known causal relationships */
  knownCauses: CausalRelationship[];

  /** Impossible causal relationships */
  impossibleCauses: CausalRelationship[];

  /** Service dependencies */
  serviceDependencies: ServiceDependency[];

  /** Temporal constraints (A must happen before B) */
  temporalConstraints: TemporalConstraint[];

  /** Custom rules */
  rules?: ConstraintRule[];
}

export interface CausalRelationship {
  cause: string;
  effect: string;
  strength?: number;
  evidence?: string;
}

export interface ServiceDependency {
  upstream: string;
  downstream: string;
  type: DependencyType;
}

export type DependencyType = 'sync' | 'async' | 'database' | 'cache' | 'queue';

export interface TemporalConstraint {
  before: string;
  after: string;
  maxDelay?: number;
}

export interface ConstraintRule {
  name: string;
  condition: string;
  action: 'include' | 'exclude' | 'boost' | 'penalize';
  weight?: number;
}

/**
 * Incident description
 */
export interface IncidentDescription {
  /** Incident ID */
  id: string;

  /** Short title */
  title: string;

  /** Detailed description */
  description: string;

  /** Symptoms observed */
  symptoms: string[];

  /** Affected services/components */
  affectedServices: string[];

  /** Severity level */
  severity: IncidentSeverity;

  /** When the incident was detected */
  detectedAt: number;
}

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Time window for analysis
 */
export interface TimeWindow {
  start: number;
  end: number;
}

/**
 * Feature #33: CausalGraph interface
 *
 * Directed graph representing cause-effect relationships.
 */
export interface CausalGraph {
  /** Graph nodes (events, services, metrics) */
  nodes: CausalNode[];

  /** Directed edges representing causal relationships */
  edges: CausalEdge[];

  /** Graph metadata */
  metadata: GraphMetadata;

  /** Root cause candidates ranked by probability */
  rootCauses: RootCause[];
}

/**
 * Node in the causal graph
 */
export interface CausalNode {
  /** Unique node identifier */
  id: string;

  /** Node type */
  type: CausalNodeType;

  /** Human-readable label */
  label: string;

  /** Source of this node (service, metric, log) */
  source: string;

  /** Timestamp when this event occurred */
  timestamp: number;

  /** Probability this node is the root cause */
  rootCauseProbability: number;

  /** Evidence supporting this node */
  evidence: NodeEvidence[];

  /** Additional properties */
  properties: Record<string, unknown>;
}

export type CausalNodeType =
  | 'event'     // Discrete event (error, timeout)
  | 'metric'    // Metric anomaly
  | 'service'   // Service state change
  | 'resource'  // Resource constraint
  | 'external'  // External dependency
  | 'config'    // Configuration change
  | 'user';     // User action

export interface NodeEvidence {
  type: EvidenceType;
  description: string;
  confidence: number;
  source: string;
}

export type EvidenceType =
  | 'log'
  | 'metric'
  | 'trace'
  | 'domain'
  | 'temporal'
  | 'statistical';

/**
 * Edge in the causal graph
 */
export interface CausalEdge {
  /** Source node ID */
  from: string;

  /** Target node ID */
  to: string;

  /** Causal relationship type */
  type: CausalEdgeType;

  /** Strength of the causal relationship (0-1) */
  strength: number;

  /** Time delay between cause and effect */
  delay?: number;

  /** Evidence for this edge */
  evidence: EdgeEvidence[];
}

export type CausalEdgeType =
  | 'causes'        // Direct causation
  | 'correlates'    // Statistical correlation
  | 'precedes'      // Temporal precedence
  | 'depends'       // Service dependency
  | 'triggers';     // Event trigger

export interface EdgeEvidence {
  type: EvidenceType;
  description: string;
  confidence: number;
}

/**
 * Graph metadata
 */
export interface GraphMetadata {
  /** When the graph was constructed */
  constructedAt: number;

  /** Analysis time window */
  timeWindow: TimeWindow;

  /** Number of data sources used */
  sourcesUsed: number;

  /** Confidence in the overall analysis */
  overallConfidence: number;

  /** Nodes that were pruned by constraints */
  prunedNodes: string[];

  /** Edges that were pruned by constraints */
  prunedEdges: string[];
}

/**
 * Root cause candidate
 */
export interface RootCause {
  /** Node ID of the root cause */
  nodeId: string;

  /** Probability this is the root cause (0-1) */
  probability: number;

  /** Explanation of why this might be the root cause */
  explanation: string;

  /** Evidence supporting this hypothesis */
  evidence: RootCauseEvidence[];

  /** Recommended actions to remediate */
  remediations: Remediation[];

  /** Location in code if applicable */
  location?: SourceLocation;
}

export interface RootCauseEvidence {
  type: EvidenceType;
  description: string;
  confidence: number;
  source: string;
}

export interface Remediation {
  action: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  estimatedImpact: string;
}

/**
 * Configuration for MultiModalRCA
 */
export interface MultiModalRCAConfig {
  /** Minimum confidence for including edges */
  minEdgeConfidence: number;

  /** Minimum probability for root cause candidates */
  minRootCauseProbability: number;

  /** Maximum number of root causes to return */
  maxRootCauses: number;

  /** Whether to apply domain constraints */
  applyConstraints: boolean;

  /** Weight for metric anomalies */
  metricWeight: number;

  /** Weight for trace errors */
  traceWeight: number;

  /** Weight for log errors */
  logWeight: number;

  /** Anomaly detection threshold (standard deviations) */
  anomalyThreshold: number;
}

/**
 * Hypothesis test result
 */
export interface HypothesisTestResult {
  nodeId: string;
  hypothesis: string;
  supported: boolean;
  confidence: number;
  evidence: RootCauseEvidence[];
}

// =============================================================================
// Multi-Modal RCA Class
// =============================================================================

/**
 * Multi-Modal Root Cause Analyzer
 *
 * Combines metrics, traces, and logs to identify root causes.
 */
export class MultiModalRCA {
  private config: MultiModalRCAConfig;
  private nodeCounter: number = 0;

  constructor(config: Partial<MultiModalRCAConfig> = {}) {
    this.config = {
      minEdgeConfidence: config.minEdgeConfidence ?? 0.3,
      minRootCauseProbability: config.minRootCauseProbability ?? 0.1,
      maxRootCauses: config.maxRootCauses ?? 5,
      applyConstraints: config.applyConstraints ?? true,
      metricWeight: config.metricWeight ?? 0.3,
      traceWeight: config.traceWeight ?? 0.4,
      logWeight: config.logWeight ?? 0.3,
      anomalyThreshold: config.anomalyThreshold ?? 2.0,
    };
  }

  /**
   * Feature #34: Construct causal graph from multi-modal input
   *
   * Combines metrics, traces, and logs into a unified causal graph.
   */
  constructCausalGraph(input: RCAInput): CausalGraph {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    // Extract nodes from metrics
    const metricNodes = this.extractMetricNodes(input.metrics, input.timeWindow);
    nodes.push(...metricNodes);

    // Extract nodes from traces
    const traceNodes = this.extractTraceNodes(input.traces);
    nodes.push(...traceNodes);

    // Extract nodes from logs
    const logNodes = this.extractLogNodes(input.logs);
    nodes.push(...logNodes);

    // Build edges based on temporal and dependency relationships
    const temporalEdges = this.buildTemporalEdges(nodes);
    edges.push(...temporalEdges);

    // Build edges from trace dependencies
    const traceEdges = this.buildTraceEdges(input.traces, nodes);
    edges.push(...traceEdges);

    // Build edges from correlation analysis
    const correlationEdges = this.buildCorrelationEdges(nodes, input.metrics);
    edges.push(...correlationEdges);

    // Apply domain constraints if provided
    let prunedNodes: string[] = [];
    let prunedEdges: string[] = [];

    if (this.config.applyConstraints && input.constraints) {
      const pruneResult = this.applyConstraints(nodes, edges, input.constraints);
      prunedNodes = pruneResult.prunedNodes;
      prunedEdges = pruneResult.prunedEdges;
    }

    // Filter edges by confidence
    const filteredEdges = edges.filter(e => e.strength >= this.config.minEdgeConfidence);

    // Calculate root cause probabilities
    this.calculateRootCauseProbabilities(nodes, filteredEdges, input.incident);

    // Generate root cause candidates
    const rootCauses = this.generateRootCauses(nodes, filteredEdges, input.incident);

    const metadata: GraphMetadata = {
      constructedAt: Date.now(),
      timeWindow: input.timeWindow,
      sourcesUsed: 3, // metrics, traces, logs
      overallConfidence: this.calculateOverallConfidence(nodes, filteredEdges),
      prunedNodes,
      prunedEdges,
    };

    return {
      nodes,
      edges: filteredEdges,
      metadata,
      rootCauses,
    };
  }

  /**
   * Extract nodes from metric anomalies
   */
  private extractMetricNodes(metrics: TimeSeries[], timeWindow: TimeWindow): CausalNode[] {
    const nodes: CausalNode[] = [];

    for (const metric of metrics) {
      const anomalies = this.detectAnomalies(metric, timeWindow);

      for (const anomaly of anomalies) {
        nodes.push({
          id: `metric-${++this.nodeCounter}`,
          type: 'metric',
          label: `${metric.name} anomaly on ${metric.source}`,
          source: metric.source,
          timestamp: anomaly.timestamp,
          rootCauseProbability: 0,
          evidence: [{
            type: 'metric',
            description: `Value ${anomaly.value} deviates ${anomaly.deviation.toFixed(2)} std from mean`,
            confidence: Math.min(1, anomaly.deviation / this.config.anomalyThreshold),
            source: metric.name,
          }],
          properties: {
            metricName: metric.name,
            value: anomaly.value,
            deviation: anomaly.deviation,
          },
        });
      }
    }

    return nodes;
  }

  /**
   * Detect anomalies in time series data
   */
  private detectAnomalies(
    metric: TimeSeries,
    timeWindow: TimeWindow,
  ): Array<{ timestamp: number; value: number; deviation: number }> {
    const anomalies: Array<{ timestamp: number; value: number; deviation: number }> = [];

    // Filter points within time window
    const points = metric.points.filter(
      p => p.timestamp >= timeWindow.start && p.timestamp <= timeWindow.end,
    );

    if (points.length < 3) return anomalies;

    // Calculate mean and standard deviation
    const values = points.map(p => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return anomalies;

    // Find anomalies (points beyond threshold standard deviations)
    for (const point of points) {
      const deviation = Math.abs(point.value - mean) / stdDev;
      if (deviation > this.config.anomalyThreshold) {
        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          deviation,
        });
      }
    }

    return anomalies;
  }

  /**
   * Extract nodes from trace errors
   */
  private extractTraceNodes(traces: ExecutionTraceData[]): CausalNode[] {
    const nodes: CausalNode[] = [];

    for (const trace of traces) {
      if (!trace.hasError) continue;

      // Find error spans
      const errorSpans = trace.spans.filter(s => s.status === 'error' || s.status === 'timeout');

      for (const span of errorSpans) {
        nodes.push({
          id: `trace-${++this.nodeCounter}`,
          type: 'event',
          label: `${span.status} in ${span.operationName} (${span.serviceName})`,
          source: span.serviceName,
          timestamp: span.startTime,
          rootCauseProbability: 0,
          evidence: [{
            type: 'trace',
            description: `Span ${span.operationName} ended with ${span.status}`,
            confidence: span.status === 'error' ? 0.8 : 0.6,
            source: trace.traceId,
          }],
          properties: {
            traceId: trace.traceId,
            spanId: span.spanId,
            operationName: span.operationName,
            duration: span.duration,
            status: span.status,
          },
        });
      }
    }

    return nodes;
  }

  /**
   * Extract nodes from error logs
   */
  private extractLogNodes(logs: LogEntry[]): CausalNode[] {
    const nodes: CausalNode[] = [];

    // Filter to error and fatal logs
    const errorLogs = logs.filter(l => l.level === 'error' || l.level === 'fatal');

    for (const log of errorLogs) {
      nodes.push({
        id: `log-${++this.nodeCounter}`,
        type: 'event',
        label: `${log.level.toUpperCase()}: ${this.truncate(log.message, 50)}`,
        source: log.source,
        timestamp: log.timestamp,
        rootCauseProbability: 0,
        evidence: [{
          type: 'log',
          description: log.message,
          confidence: log.level === 'fatal' ? 0.9 : 0.7,
          source: log.source,
        }],
        properties: {
          message: log.message,
          level: log.level,
          stackTrace: log.stackTrace,
          fields: log.fields,
        },
      });
    }

    return nodes;
  }

  /**
   * Truncate string to max length
   */
  private truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
  }

  /**
   * Build edges based on temporal relationships
   */
  private buildTemporalEdges(nodes: CausalNode[]): CausalEdge[] {
    const edges: CausalEdge[] = [];

    // Sort nodes by timestamp
    const sortedNodes = [...nodes].sort((a, b) => a.timestamp - b.timestamp);

    // Connect temporally adjacent nodes from same source
    for (let i = 0; i < sortedNodes.length - 1; i++) {
      const current = sortedNodes[i]!;
      const next = sortedNodes[i + 1]!;

      // Only connect nodes from same source or related services
      if (current.source === next.source) {
        const delay = next.timestamp - current.timestamp;

        edges.push({
          from: current.id,
          to: next.id,
          type: 'precedes',
          strength: this.calculateTemporalStrength(delay),
          delay,
          evidence: [{
            type: 'temporal',
            description: `${current.label} precedes ${next.label} by ${delay}ms`,
            confidence: this.calculateTemporalStrength(delay),
          }],
        });
      }
    }

    return edges;
  }

  /**
   * Calculate strength based on temporal proximity
   */
  private calculateTemporalStrength(delayMs: number): number {
    // Closer in time = stronger relationship
    // 0ms = 1.0, 1s = 0.5, 10s = 0.1
    return Math.max(0.1, 1 / (1 + delayMs / 1000));
  }

  /**
   * Build edges from trace span relationships
   */
  private buildTraceEdges(traces: ExecutionTraceData[], nodes: CausalNode[]): CausalEdge[] {
    const edges: CausalEdge[] = [];

    for (const trace of traces) {
      // Build span parent-child relationships
      const spanMap = new Map(trace.spans.map(s => [s.spanId, s]));

      for (const span of trace.spans) {
        if (!span.parentSpanId) continue;

        const parentSpan = spanMap.get(span.parentSpanId);
        if (!parentSpan) continue;

        // Find corresponding nodes
        const parentNode = nodes.find(n =>
          n.properties?.spanId === parentSpan.spanId,
        );
        const childNode = nodes.find(n =>
          n.properties?.spanId === span.spanId,
        );

        if (parentNode && childNode) {
          edges.push({
            from: parentNode.id,
            to: childNode.id,
            type: 'triggers',
            strength: 0.8,
            delay: span.startTime - parentSpan.startTime,
            evidence: [{
              type: 'trace',
              description: `${parentSpan.operationName} triggered ${span.operationName}`,
              confidence: 0.9,
            }],
          });
        }
      }
    }

    return edges;
  }

  /**
   * Build edges from metric correlations
   */
  private buildCorrelationEdges(nodes: CausalNode[], _metrics: TimeSeries[]): CausalEdge[] {
    const edges: CausalEdge[] = [];

    // Find metric nodes and correlate with event nodes
    const metricNodes = nodes.filter(n => n.type === 'metric');
    const eventNodes = nodes.filter(n => n.type === 'event');

    for (const metricNode of metricNodes) {
      for (const eventNode of eventNodes) {
        // Check temporal proximity
        const timeDiff = Math.abs(metricNode.timestamp - eventNode.timestamp);

        if (timeDiff < 60000) { // Within 1 minute
          // Check if same or related service
          if (metricNode.source === eventNode.source) {
            edges.push({
              from: metricNode.id,
              to: eventNode.id,
              type: 'correlates',
              strength: this.calculateTemporalStrength(timeDiff),
              delay: eventNode.timestamp - metricNode.timestamp,
              evidence: [{
                type: 'statistical',
                description: `Metric anomaly correlates with event (${timeDiff}ms apart)`,
                confidence: this.calculateTemporalStrength(timeDiff),
              }],
            });
          }
        }
      }
    }

    return edges;
  }

  /**
   * Feature #36: Apply domain knowledge constraints
   *
   * Prunes the graph based on domain constraints.
   */
  private applyConstraints(
    nodes: CausalNode[],
    edges: CausalEdge[],
    constraints: DomainConstraints,
  ): { prunedNodes: string[]; prunedEdges: string[] } {
    const prunedNodes: string[] = [];
    const prunedEdges: string[] = [];

    // Apply impossible cause constraints
    for (const impossible of constraints.impossibleCauses) {
      const edgesToRemove = edges.filter(e => {
        const fromNode = nodes.find(n => n.id === e.from);
        const toNode = nodes.find(n => n.id === e.to);
        return fromNode?.source === impossible.cause && toNode?.source === impossible.effect;
      });

      for (const edge of edgesToRemove) {
        const idx = edges.indexOf(edge);
        if (idx !== -1) {
          edges.splice(idx, 1);
          prunedEdges.push(`${edge.from}->${edge.to}`);
        }
      }
    }

    // Boost known cause relationships
    for (const known of constraints.knownCauses) {
      const matchingEdges = edges.filter(e => {
        const fromNode = nodes.find(n => n.id === e.from);
        const toNode = nodes.find(n => n.id === e.to);
        return fromNode?.source === known.cause && toNode?.source === known.effect;
      });

      for (const edge of matchingEdges) {
        edge.strength = Math.min(1, edge.strength + (known.strength ?? 0.2));
        edge.evidence.push({
          type: 'domain',
          description: known.evidence ?? 'Known causal relationship',
          confidence: known.strength ?? 0.8,
        });
      }
    }

    // Apply temporal constraints
    for (const temporal of constraints.temporalConstraints) {
      // Find edges that violate temporal constraints
      const violatingEdges = edges.filter(e => {
        const fromNode = nodes.find(n => n.id === e.from);
        const toNode = nodes.find(n => n.id === e.to);

        if (!fromNode || !toNode) return false;

        // Check if edge direction matches temporal constraint
        const matchesBefore = fromNode.source === temporal.before;
        const matchesAfter = toNode.source === temporal.after;

        if (matchesBefore && matchesAfter) {
          // Check if temporal order is correct
          if (fromNode.timestamp > toNode.timestamp) {
            return true; // Violates temporal constraint
          }

          // Check max delay if specified
          if (temporal.maxDelay) {
            const delay = toNode.timestamp - fromNode.timestamp;
            if (delay > temporal.maxDelay) {
              return true; // Exceeds max delay
            }
          }
        }

        return false;
      });

      for (const edge of violatingEdges) {
        const idx = edges.indexOf(edge);
        if (idx !== -1) {
          edges.splice(idx, 1);
          prunedEdges.push(`${edge.from}->${edge.to}`);
        }
      }
    }

    return { prunedNodes, prunedEdges };
  }

  /**
   * Calculate root cause probabilities for all nodes
   */
  private calculateRootCauseProbabilities(
    nodes: CausalNode[],
    edges: CausalEdge[],
    incident: IncidentDescription,
  ): void {
    for (const node of nodes) {
      let probability = 0;

      // Base probability from evidence confidence
      const avgEvidence = node.evidence.length > 0
        ? node.evidence.reduce((sum, e) => sum + e.confidence, 0) / node.evidence.length
        : 0;
      probability += avgEvidence * 0.3;

      // Boost for nodes matching incident symptoms
      const symptomMatch = incident.symptoms.some(s =>
        node.label.toLowerCase().includes(s.toLowerCase()) ||
        (node.properties?.message as string)?.toLowerCase().includes(s.toLowerCase()),
      );
      if (symptomMatch) {
        probability += 0.2;
      }

      // Boost for affected services
      if (incident.affectedServices.includes(node.source)) {
        probability += 0.15;
      }

      // Boost for nodes with many outgoing edges (causes other issues)
      const outgoingEdges = edges.filter(e => e.from === node.id);
      probability += Math.min(0.2, outgoingEdges.length * 0.05);

      // Penalize nodes with many incoming edges (likely effects, not causes)
      const incomingEdges = edges.filter(e => e.to === node.id);
      probability -= Math.min(0.15, incomingEdges.length * 0.03);

      // Temporal: earlier events more likely to be root cause
      const nodeTimestamp = node.timestamp;
      const earliestTimestamp = Math.min(...nodes.map(n => n.timestamp));
      const latestTimestamp = Math.max(...nodes.map(n => n.timestamp));
      const timeRange = latestTimestamp - earliestTimestamp;

      if (timeRange > 0) {
        const timePosition = (nodeTimestamp - earliestTimestamp) / timeRange;
        probability += (1 - timePosition) * 0.15; // Earlier = higher probability
      }

      node.rootCauseProbability = Math.max(0, Math.min(1, probability));
    }
  }

  /**
   * Feature #35: Run hypothesis tests for root cause candidates
   */
  runHypothesisTests(
    graph: CausalGraph,
    incident: IncidentDescription,
  ): HypothesisTestResult[] {
    const results: HypothesisTestResult[] = [];

    // Get candidate nodes above threshold
    const candidates = graph.nodes
      .filter(n => n.rootCauseProbability >= this.config.minRootCauseProbability)
      .sort((a, b) => b.rootCauseProbability - a.rootCauseProbability);

    for (const candidate of candidates) {
      const hypothesis = `${candidate.label} caused the incident`;
      const evidence: RootCauseEvidence[] = [];
      let totalSupport = 0;
      let totalTests = 0;

      // Test 1: Temporal precedence - did this happen before symptoms?
      const symptomNodes = graph.nodes.filter(n =>
        incident.symptoms.some(s => n.label.toLowerCase().includes(s.toLowerCase())),
      );
      const precedesSymptoms = symptomNodes.every(s => candidate.timestamp <= s.timestamp);
      if (precedesSymptoms) {
        totalSupport++;
        evidence.push({
          type: 'temporal',
          description: 'Event precedes all observed symptoms',
          confidence: 0.8,
          source: 'temporal analysis',
        });
      }
      totalTests++;

      // Test 2: Causal path exists to affected services
      const hasPathToAffected = incident.affectedServices.some(service => {
        return this.hasPath(graph, candidate.id, service);
      });
      if (hasPathToAffected) {
        totalSupport++;
        evidence.push({
          type: 'trace',
          description: 'Causal path exists to affected services',
          confidence: 0.7,
          source: 'graph traversal',
        });
      }
      totalTests++;

      // Test 3: Evidence strength
      const avgEvidenceStrength = candidate.evidence.length > 0
        ? candidate.evidence.reduce((sum, e) => sum + e.confidence, 0) / candidate.evidence.length
        : 0;
      if (avgEvidenceStrength > 0.6) {
        totalSupport++;
        evidence.push({
          type: 'statistical',
          description: `Strong evidence support (${(avgEvidenceStrength * 100).toFixed(0)}%)`,
          confidence: avgEvidenceStrength,
          source: 'evidence aggregation',
        });
      }
      totalTests++;

      // Test 4: Not likely an effect (few incoming edges)
      const incomingCount = graph.edges.filter(e => e.to === candidate.id).length;
      if (incomingCount <= 1) {
        totalSupport++;
        evidence.push({
          type: 'statistical',
          description: 'Node has few incoming edges (likely a cause, not effect)',
          confidence: 0.6,
          source: 'graph structure',
        });
      }
      totalTests++;

      results.push({
        nodeId: candidate.id,
        hypothesis,
        supported: totalSupport > totalTests / 2,
        confidence: totalSupport / totalTests,
        evidence,
      });
    }

    return results;
  }

  /**
   * Check if a path exists from source node to a target service
   */
  private hasPath(graph: CausalGraph, sourceId: string, targetService: string): boolean {
    const visited = new Set<string>();
    const queue = [sourceId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = graph.nodes.find(n => n.id === current);
      if (node?.source === targetService) return true;

      const outgoing = graph.edges.filter(e => e.from === current);
      for (const edge of outgoing) {
        if (!visited.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }

    return false;
  }

  /**
   * Generate root cause candidates
   */
  private generateRootCauses(
    nodes: CausalNode[],
    edges: CausalEdge[],
    incident: IncidentDescription,
  ): RootCause[] {
    // Sort by probability
    const candidates = [...nodes]
      .filter(n => n.rootCauseProbability >= this.config.minRootCauseProbability)
      .sort((a, b) => b.rootCauseProbability - a.rootCauseProbability)
      .slice(0, this.config.maxRootCauses);

    return candidates.map(node => ({
      nodeId: node.id,
      probability: node.rootCauseProbability,
      explanation: this.generateExplanation(node, edges, incident),
      evidence: node.evidence.map(e => ({
        type: e.type,
        description: e.description,
        confidence: e.confidence,
        source: e.source,
      })),
      remediations: this.generateRemediations(node),
    }));
  }

  /**
   * Generate explanation for root cause
   */
  private generateExplanation(
    node: CausalNode,
    edges: CausalEdge[],
    incident: IncidentDescription,
  ): string {
    const outgoing = edges.filter(e => e.from === node.id);
    const affectedCount = outgoing.length;

    let explanation = `${node.label} is a likely root cause. `;
    explanation += `It occurred at ${new Date(node.timestamp).toISOString()} `;
    explanation += `and triggered ${affectedCount} downstream event(s). `;

    if (incident.affectedServices.includes(node.source)) {
      explanation += `This occurred in an affected service (${node.source}). `;
    }

    return explanation;
  }

  /**
   * Generate remediation suggestions
   */
  private generateRemediations(node: CausalNode): Remediation[] {
    const remediations: Remediation[] = [];

    switch (node.type) {
      case 'metric':
        remediations.push({
          action: `Investigate resource constraints on ${node.source}`,
          priority: 'high',
          estimatedImpact: 'May resolve resource-related issues',
        });
        break;

      case 'event':
        remediations.push({
          action: `Review error handling in ${node.source}`,
          priority: 'immediate',
          estimatedImpact: 'May prevent cascading failures',
        });
        break;

      case 'resource':
        remediations.push({
          action: `Scale or optimize resource allocation`,
          priority: 'high',
          estimatedImpact: 'Should improve availability',
        });
        break;

      default:
        remediations.push({
          action: `Investigate ${node.label}`,
          priority: 'medium',
          estimatedImpact: 'May reveal underlying issue',
        });
    }

    return remediations;
  }

  /**
   * Calculate overall confidence in the analysis
   */
  private calculateOverallConfidence(nodes: CausalNode[], edges: CausalEdge[]): number {
    if (nodes.length === 0) return 0;

    // Average node evidence confidence
    const nodeConfidence = nodes.reduce((sum, n) => {
      const avgEvidence = n.evidence.length > 0
        ? n.evidence.reduce((s, e) => s + e.confidence, 0) / n.evidence.length
        : 0;
      return sum + avgEvidence;
    }, 0) / nodes.length;

    // Average edge strength
    const edgeStrength = edges.length > 0
      ? edges.reduce((sum, e) => sum + e.strength, 0) / edges.length
      : 0;

    // Combined confidence
    return (nodeConfidence * 0.6 + edgeStrength * 0.4);
  }

  /**
   * Feature #36: Incorporate domain knowledge from YAML
   */
  incorporateDomainKnowledge(
    graph: CausalGraph,
    constraintsYaml: string,
  ): CausalGraph {
    // Parse YAML constraints (simplified parser)
    const constraints = this.parseConstraintsYaml(constraintsYaml);

    // Apply constraints
    const pruneResult = this.applyConstraints(
      graph.nodes,
      graph.edges,
      constraints,
    );

    // Update metadata
    graph.metadata.prunedNodes.push(...pruneResult.prunedNodes);
    graph.metadata.prunedEdges.push(...pruneResult.prunedEdges);

    // Recalculate overall confidence
    graph.metadata.overallConfidence = this.calculateOverallConfidence(
      graph.nodes,
      graph.edges,
    );

    return graph;
  }

  /**
   * Parse YAML constraints (simplified)
   */
  private parseConstraintsYaml(yaml: string): DomainConstraints {
    const constraints: DomainConstraints = {
      knownCauses: [],
      impossibleCauses: [],
      serviceDependencies: [],
      temporalConstraints: [],
    };

    // Simple line-by-line parsing
    const lines = yaml.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('known_causes:')) {
        currentSection = 'known';
      } else if (trimmed.startsWith('impossible_causes:')) {
        currentSection = 'impossible';
      } else if (trimmed.startsWith('dependencies:')) {
        currentSection = 'dependencies';
      } else if (trimmed.startsWith('- cause:')) {
        const cause = trimmed.match(/cause:\s*(\w+)/)?.[1] ?? '';
        const nextLine = lines[lines.indexOf(line) + 1]?.trim() ?? '';
        const effect = nextLine.match(/effect:\s*(\w+)/)?.[1] ?? '';

        if (cause && effect) {
          if (currentSection === 'known') {
            constraints.knownCauses.push({ cause, effect });
          } else if (currentSection === 'impossible') {
            constraints.impossibleCauses.push({ cause, effect });
          }
        }
      }
    }

    return constraints;
  }

  /**
   * Main analysis method
   */
  async analyze(input: RCAInput): Promise<CausalGraph> {
    // Construct the causal graph
    const graph = this.constructCausalGraph(input);

    // Run hypothesis tests
    const hypothesisResults = this.runHypothesisTests(graph, input.incident);

    // Update root cause probabilities based on hypothesis tests
    for (const result of hypothesisResults) {
      const node = graph.nodes.find(n => n.id === result.nodeId);
      if (node && result.supported) {
        node.rootCauseProbability = Math.min(1, node.rootCauseProbability + result.confidence * 0.2);
      }
    }

    // Regenerate root causes with updated probabilities
    graph.rootCauses = this.generateRootCauses(
      graph.nodes,
      graph.edges,
      input.incident,
    );

    return graph;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new MultiModalRCA instance
 */
export function createMultiModalRCA(
  config?: Partial<MultiModalRCAConfig>,
): MultiModalRCA {
  return new MultiModalRCA(config);
}

/**
 * Quick function to analyze an incident
 */
export async function analyzeIncident(
  input: RCAInput,
  config?: Partial<MultiModalRCAConfig>,
): Promise<CausalGraph> {
  const rca = createMultiModalRCA(config);
  return rca.analyze(input);
}

/**
 * Construct causal graph without full analysis
 */
export function constructCausalGraph(
  input: RCAInput,
  config?: Partial<MultiModalRCAConfig>,
): CausalGraph {
  const rca = createMultiModalRCA(config);
  return rca.constructCausalGraph(input);
}

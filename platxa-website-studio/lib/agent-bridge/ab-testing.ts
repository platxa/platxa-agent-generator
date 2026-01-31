/**
 * A/B Testing Infrastructure for Agent Improvements
 *
 * Enables splitting users between agent versions and tracking
 * metrics per variant to measure and improve agent performance.
 */

// ============================================================================
// Types
// ============================================================================

export interface Experiment {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly variants: readonly Variant[];
  readonly status: ExperimentStatus;
  readonly trafficAllocation: number;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly createdAt: number;
  readonly targetingRules: readonly TargetingRule[];
  readonly metadata: Record<string, unknown>;
}

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

export interface Variant {
  readonly id: string;
  readonly name: string;
  readonly weight: number;
  readonly isControl: boolean;
  readonly config: Record<string, unknown>;
}

export interface TargetingRule {
  readonly field: string;
  readonly operator: RuleOperator;
  readonly value: string | number | boolean | readonly string[];
}

export type RuleOperator = 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in' | 'greater_than' | 'less_than';

export interface UserAssignment {
  readonly odatabaseId: string;
  readonly experimentId: string;
  readonly variantId: string;
  readonly assignedAt: number;
  readonly context: Record<string, unknown>;
}

export interface ExperimentMetrics {
  readonly experimentId: string;
  readonly variantId: string;
  readonly impressions: number;
  readonly conversions: number;
  readonly conversionRate: number;
  readonly totalResponseTime: number;
  readonly averageResponseTime: number;
  readonly satisfactionScore: number;
  readonly errorCount: number;
  readonly errorRate: number;
}

export interface MetricEvent {
  readonly id: string;
  readonly experimentId: string;
  readonly variantId: string;
  readonly userId: string;
  readonly eventType: MetricEventType;
  readonly value: number;
  readonly timestamp: number;
  readonly metadata: Record<string, unknown>;
}

export type MetricEventType = 'impression' | 'conversion' | 'response_time' | 'satisfaction' | 'error';

export interface ABTestingState {
  readonly experiments: Map<string, Experiment>;
  readonly assignments: Map<string, UserAssignment>;
  readonly metrics: Map<string, MetricEvent[]>;
  readonly creationCounter: number;
}

export interface UserContext {
  readonly userId: string;
  readonly attributes: Record<string, string | number | boolean>;
}

// ============================================================================
// State
// ============================================================================

let state: ABTestingState = {
  experiments: new Map(),
  assignments: new Map(),
  metrics: new Map(),
  creationCounter: 0,
};

// ============================================================================
// Experiment Management
// ============================================================================

export function createExperiment(
  name: string,
  variants: readonly Omit<Variant, 'id'>[],
  options: {
    description?: string;
    trafficAllocation?: number;
    targetingRules?: readonly TargetingRule[];
    metadata?: Record<string, unknown>;
  } = {}
): Experiment {
  const id = generateId();
  const now = Date.now();

  const fullVariants: Variant[] = variants.map((v, index) => ({
    ...v,
    id: `${id}_variant_${index}`,
  }));

  const experiment: Experiment = {
    id,
    name,
    description: options.description ?? '',
    variants: fullVariants,
    status: 'draft',
    trafficAllocation: options.trafficAllocation ?? 100,
    startedAt: null,
    endedAt: null,
    createdAt: now,
    targetingRules: options.targetingRules ?? [],
    metadata: options.metadata ?? {},
  };

  const newExperiments = new Map(state.experiments);
  newExperiments.set(id, experiment);

  state = {
    ...state,
    experiments: newExperiments,
  };

  return experiment;
}

export function getExperiment(id: string): Experiment | null {
  return state.experiments.get(id) ?? null;
}

export function getAllExperiments(): readonly Experiment[] {
  return Array.from(state.experiments.values())
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getExperimentsByStatus(status: ExperimentStatus): readonly Experiment[] {
  return getAllExperiments().filter(e => e.status === status);
}

export function getRunningExperiments(): readonly Experiment[] {
  return getExperimentsByStatus('running');
}

// ============================================================================
// Experiment Lifecycle
// ============================================================================

export function startExperiment(id: string): Experiment | null {
  const experiment = state.experiments.get(id);
  if (!experiment || experiment.status !== 'draft') {
    return null;
  }

  const updated: Experiment = {
    ...experiment,
    status: 'running',
    startedAt: Date.now(),
  };

  const newExperiments = new Map(state.experiments);
  newExperiments.set(id, updated);

  state = {
    ...state,
    experiments: newExperiments,
  };

  return updated;
}

export function pauseExperiment(id: string): Experiment | null {
  const experiment = state.experiments.get(id);
  if (!experiment || experiment.status !== 'running') {
    return null;
  }

  const updated: Experiment = {
    ...experiment,
    status: 'paused',
  };

  const newExperiments = new Map(state.experiments);
  newExperiments.set(id, updated);

  state = {
    ...state,
    experiments: newExperiments,
  };

  return updated;
}

export function resumeExperiment(id: string): Experiment | null {
  const experiment = state.experiments.get(id);
  if (!experiment || experiment.status !== 'paused') {
    return null;
  }

  const updated: Experiment = {
    ...experiment,
    status: 'running',
  };

  const newExperiments = new Map(state.experiments);
  newExperiments.set(id, updated);

  state = {
    ...state,
    experiments: newExperiments,
  };

  return updated;
}

export function completeExperiment(id: string): Experiment | null {
  const experiment = state.experiments.get(id);
  if (!experiment || (experiment.status !== 'running' && experiment.status !== 'paused')) {
    return null;
  }

  const updated: Experiment = {
    ...experiment,
    status: 'completed',
    endedAt: Date.now(),
  };

  const newExperiments = new Map(state.experiments);
  newExperiments.set(id, updated);

  state = {
    ...state,
    experiments: newExperiments,
  };

  return updated;
}

export function archiveExperiment(id: string): Experiment | null {
  const experiment = state.experiments.get(id);
  if (!experiment || experiment.status !== 'completed') {
    return null;
  }

  const updated: Experiment = {
    ...experiment,
    status: 'archived',
  };

  const newExperiments = new Map(state.experiments);
  newExperiments.set(id, updated);

  state = {
    ...state,
    experiments: newExperiments,
  };

  return updated;
}

// ============================================================================
// User Assignment
// ============================================================================

export function assignUser(
  userId: string,
  experimentId: string,
  context: Record<string, unknown> = {}
): UserAssignment | null {
  const experiment = state.experiments.get(experimentId);
  if (!experiment || experiment.status !== 'running') {
    return null;
  }

  // Check if user is already assigned
  const assignmentKey = `${userId}_${experimentId}`;
  const existing = state.assignments.get(assignmentKey);
  if (existing) {
    return existing;
  }

  // Check traffic allocation
  const hash = hashString(`${userId}_${experimentId}`);
  const bucket = hash % 100;
  if (bucket >= experiment.trafficAllocation) {
    return null; // User not in experiment traffic
  }

  // Select variant based on weights
  const variant = selectVariant(experiment.variants, hash);
  if (!variant) {
    return null;
  }

  const assignment: UserAssignment = {
    odatabaseId: userId,
    experimentId,
    variantId: variant.id,
    assignedAt: Date.now(),
    context,
  };

  const newAssignments = new Map(state.assignments);
  newAssignments.set(assignmentKey, assignment);

  state = {
    ...state,
    assignments: newAssignments,
  };

  return assignment;
}

export function getAssignment(userId: string, experimentId: string): UserAssignment | null {
  const key = `${userId}_${experimentId}`;
  return state.assignments.get(key) ?? null;
}

export function getUserAssignments(userId: string): readonly UserAssignment[] {
  const assignments: UserAssignment[] = [];
  for (const assignment of state.assignments.values()) {
    if (assignment.odatabaseId === userId) {
      assignments.push(assignment);
    }
  }
  return assignments;
}

export function getExperimentAssignments(experimentId: string): readonly UserAssignment[] {
  const assignments: UserAssignment[] = [];
  for (const assignment of state.assignments.values()) {
    if (assignment.experimentId === experimentId) {
      assignments.push(assignment);
    }
  }
  return assignments;
}

function selectVariant(variants: readonly Variant[], hash: number): Variant | null {
  if (variants.length === 0) {
    return null;
  }

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight === 0) {
    return variants[0];
  }

  const normalizedHash = hash % totalWeight;
  let cumulative = 0;

  for (const variant of variants) {
    cumulative += variant.weight;
    if (normalizedHash < cumulative) {
      return variant;
    }
  }

  return variants[variants.length - 1];
}

// ============================================================================
// Variant Access
// ============================================================================

export function getVariant(experimentId: string, variantId: string): Variant | null {
  const experiment = state.experiments.get(experimentId);
  if (!experiment) {
    return null;
  }

  return experiment.variants.find(v => v.id === variantId) ?? null;
}

export function getVariantForUser(userId: string, experimentId: string): Variant | null {
  const assignment = getAssignment(userId, experimentId);
  if (!assignment) {
    return null;
  }

  return getVariant(experimentId, assignment.variantId);
}

export function getVariantConfig<T = unknown>(
  userId: string,
  experimentId: string,
  defaultConfig: T
): T {
  const variant = getVariantForUser(userId, experimentId);
  if (!variant) {
    return defaultConfig;
  }

  return { ...defaultConfig, ...variant.config } as T;
}

// ============================================================================
// Metrics Tracking
// ============================================================================

export function trackMetric(
  experimentId: string,
  variantId: string,
  userId: string,
  eventType: MetricEventType,
  value: number = 1,
  metadata: Record<string, unknown> = {}
): MetricEvent | null {
  const experiment = state.experiments.get(experimentId);
  if (!experiment) {
    return null;
  }

  const event: MetricEvent = {
    id: generateId(),
    experimentId,
    variantId,
    userId,
    eventType,
    value,
    timestamp: Date.now(),
    metadata,
  };

  const key = `${experimentId}_${variantId}`;
  const existingEvents = state.metrics.get(key) ?? [];

  const newMetrics = new Map(state.metrics);
  newMetrics.set(key, [...existingEvents, event]);

  state = {
    ...state,
    metrics: newMetrics,
  };

  return event;
}

export function trackImpression(
  experimentId: string,
  variantId: string,
  userId: string
): MetricEvent | null {
  return trackMetric(experimentId, variantId, userId, 'impression');
}

export function trackConversion(
  experimentId: string,
  variantId: string,
  userId: string,
  value: number = 1
): MetricEvent | null {
  return trackMetric(experimentId, variantId, userId, 'conversion', value);
}

export function trackResponseTime(
  experimentId: string,
  variantId: string,
  userId: string,
  responseTimeMs: number
): MetricEvent | null {
  return trackMetric(experimentId, variantId, userId, 'response_time', responseTimeMs);
}

export function trackSatisfaction(
  experimentId: string,
  variantId: string,
  userId: string,
  score: number
): MetricEvent | null {
  return trackMetric(experimentId, variantId, userId, 'satisfaction', score);
}

export function trackError(
  experimentId: string,
  variantId: string,
  userId: string,
  metadata?: Record<string, unknown>
): MetricEvent | null {
  return trackMetric(experimentId, variantId, userId, 'error', 1, metadata);
}

// ============================================================================
// Metrics Aggregation
// ============================================================================

export function getMetrics(experimentId: string, variantId: string): ExperimentMetrics {
  const key = `${experimentId}_${variantId}`;
  const events = state.metrics.get(key) ?? [];

  const impressions = events.filter(e => e.eventType === 'impression').length;
  const conversions = events.filter(e => e.eventType === 'conversion');
  const responseTimes = events.filter(e => e.eventType === 'response_time');
  const satisfactionEvents = events.filter(e => e.eventType === 'satisfaction');
  const errors = events.filter(e => e.eventType === 'error');

  const totalConversions = conversions.reduce((sum, e) => sum + e.value, 0);
  const totalResponseTime = responseTimes.reduce((sum, e) => sum + e.value, 0);
  const totalSatisfaction = satisfactionEvents.reduce((sum, e) => sum + e.value, 0);

  return {
    experimentId,
    variantId,
    impressions,
    conversions: totalConversions,
    conversionRate: impressions > 0 ? totalConversions / impressions : 0,
    totalResponseTime,
    averageResponseTime: responseTimes.length > 0 ? totalResponseTime / responseTimes.length : 0,
    satisfactionScore: satisfactionEvents.length > 0 ? totalSatisfaction / satisfactionEvents.length : 0,
    errorCount: errors.length,
    errorRate: impressions > 0 ? errors.length / impressions : 0,
  };
}

export function getExperimentMetrics(experimentId: string): readonly ExperimentMetrics[] {
  const experiment = state.experiments.get(experimentId);
  if (!experiment) {
    return [];
  }

  return experiment.variants.map(v => getMetrics(experimentId, v.id));
}

export function compareVariants(experimentId: string): VariantComparison | null {
  const experiment = state.experiments.get(experimentId);
  if (!experiment) {
    return null;
  }

  const metrics = getExperimentMetrics(experimentId);
  const control = metrics.find(m => {
    const variant = experiment.variants.find(v => v.id === m.variantId);
    return variant?.isControl;
  });

  if (!control) {
    return null;
  }

  const comparisons: VariantComparisonResult[] = metrics
    .filter(m => m.variantId !== control.variantId)
    .map(m => {
      const conversionLift = control.conversionRate > 0
        ? ((m.conversionRate - control.conversionRate) / control.conversionRate) * 100
        : 0;

      const responseTimeDiff = m.averageResponseTime - control.averageResponseTime;

      return {
        variantId: m.variantId,
        metrics: m,
        conversionLift,
        responseTimeDiff,
        isWinner: m.conversionRate > control.conversionRate && m.errorRate <= control.errorRate,
      };
    });

  return {
    experimentId,
    controlMetrics: control,
    variantComparisons: comparisons,
  };
}

export interface VariantComparison {
  readonly experimentId: string;
  readonly controlMetrics: ExperimentMetrics;
  readonly variantComparisons: readonly VariantComparisonResult[];
}

export interface VariantComparisonResult {
  readonly variantId: string;
  readonly metrics: ExperimentMetrics;
  readonly conversionLift: number;
  readonly responseTimeDiff: number;
  readonly isWinner: boolean;
}

// ============================================================================
// Targeting
// ============================================================================

export function evaluateTargeting(
  experiment: Experiment,
  context: UserContext
): boolean {
  if (experiment.targetingRules.length === 0) {
    return true;
  }

  return experiment.targetingRules.every(rule =>
    evaluateRule(rule, context.attributes)
  );
}

function evaluateRule(
  rule: TargetingRule,
  attributes: Record<string, string | number | boolean>
): boolean {
  const value = attributes[rule.field];
  if (value === undefined) {
    return false;
  }

  switch (rule.operator) {
    case 'equals':
      return value === rule.value;

    case 'not_equals':
      return value !== rule.value;

    case 'contains':
      return typeof value === 'string' && value.includes(String(rule.value));

    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(value as string);

    case 'not_in':
      return Array.isArray(rule.value) && !rule.value.includes(value as string);

    case 'greater_than':
      return typeof value === 'number' && value > (rule.value as number);

    case 'less_than':
      return typeof value === 'number' && value < (rule.value as number);

    default:
      return false;
  }
}

// ============================================================================
// State Access
// ============================================================================

export function getState(): ABTestingState {
  return {
    ...state,
    experiments: new Map(state.experiments),
    assignments: new Map(state.assignments),
    metrics: new Map(state.metrics),
  };
}

export function getExperimentCount(): number {
  return state.experiments.size;
}

export function getAssignmentCount(): number {
  return state.assignments.size;
}

// ============================================================================
// Remove and Clear
// ============================================================================

export function removeExperiment(id: string): boolean {
  if (!state.experiments.has(id)) {
    return false;
  }

  const newExperiments = new Map(state.experiments);
  newExperiments.delete(id);

  // Remove related assignments and metrics
  const newAssignments = new Map(state.assignments);
  for (const [key, assignment] of newAssignments) {
    if (assignment.experimentId === id) {
      newAssignments.delete(key);
    }
  }

  const newMetrics = new Map(state.metrics);
  for (const key of newMetrics.keys()) {
    if (key.startsWith(`${id}_`)) {
      newMetrics.delete(key);
    }
  }

  state = {
    ...state,
    experiments: newExperiments,
    assignments: newAssignments,
    metrics: newMetrics,
  };

  return true;
}

export function clearAssignments(experimentId: string): number {
  let cleared = 0;
  const newAssignments = new Map(state.assignments);

  for (const [key, assignment] of newAssignments) {
    if (assignment.experimentId === experimentId) {
      newAssignments.delete(key);
      cleared++;
    }
  }

  state = {
    ...state,
    assignments: newAssignments,
  };

  return cleared;
}

export function clearMetrics(experimentId: string): number {
  let cleared = 0;
  const newMetrics = new Map(state.metrics);

  for (const key of newMetrics.keys()) {
    if (key.startsWith(`${experimentId}_`)) {
      newMetrics.delete(key);
      cleared++;
    }
  }

  state = {
    ...state,
    metrics: newMetrics,
  };

  return cleared;
}

// ============================================================================
// Reset
// ============================================================================

export function resetABTesting(): void {
  state = {
    experiments: new Map(),
    assignments: new Map(),
    metrics: new Map(),
    creationCounter: 0,
  };
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function formatMetrics(metrics: ExperimentMetrics): string {
  return [
    `Variant: ${metrics.variantId}`,
    `Impressions: ${metrics.impressions}`,
    `Conversions: ${metrics.conversions} (${(metrics.conversionRate * 100).toFixed(1)}%)`,
    `Avg Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`,
    `Satisfaction: ${metrics.satisfactionScore.toFixed(2)}`,
    `Errors: ${metrics.errorCount} (${(metrics.errorRate * 100).toFixed(1)}%)`,
  ].join('\n');
}

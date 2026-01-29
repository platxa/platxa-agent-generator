/**
 * Multi-Step Agent Cycle: Plan → Search → Read → Edit → Test
 *
 * Orchestrates complex AI requests through a structured 5-phase pipeline.
 * Each phase produces artifacts consumed by subsequent phases.
 * The cycle can short-circuit early if the request is simple enough.
 */

// =============================================================================
// Types
// =============================================================================

/** The five phases of the agent cycle */
export type CyclePhase = "plan" | "search" | "read" | "edit" | "test";

/** All phases in execution order */
export const CYCLE_PHASES: readonly CyclePhase[] = [
  "plan",
  "search",
  "read",
  "edit",
  "test",
] as const;

/** Status of a single phase */
export type PhaseStatus = "pending" | "running" | "completed" | "skipped" | "failed";

/** Result of a single phase execution */
export interface PhaseResult<T = unknown> {
  phase: CyclePhase;
  status: PhaseStatus;
  /** Phase output data */
  data: T | null;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message if failed */
  error?: string;
}

/** Plan phase output */
export interface PlanOutput {
  /** High-level steps to accomplish the request */
  steps: string[];
  /** Files likely to be involved */
  targetFiles: string[];
  /** Estimated complexity (1-5) */
  complexity: number;
  /** Whether the request needs all 5 phases */
  requiresFullCycle: boolean;
}

/** Search phase output */
export interface SearchOutput {
  /** Files found matching the plan's criteria */
  matchedFiles: string[];
  /** Search queries used */
  queries: string[];
  /** Relevance-ranked results */
  results: Array<{ file: string; relevance: number }>;
}

/** Read phase output */
export interface ReadOutput {
  /** File contents keyed by path */
  fileContents: Record<string, string>;
  /** Key patterns/structures discovered */
  patterns: string[];
  /** Total lines read */
  totalLinesRead: number;
}

/** Edit phase output */
export interface EditOutput {
  /** Files modified with change descriptions */
  modifications: Array<{
    file: string;
    changeType: "create" | "modify" | "delete";
    description: string;
    linesChanged: number;
  }>;
  /** Total files changed */
  totalFilesChanged: number;
}

/** Test phase output */
export interface TestOutput {
  /** Whether all tests passed */
  passed: boolean;
  /** Total tests run */
  totalTests: number;
  /** Tests that passed */
  passedTests: number;
  /** Tests that failed */
  failedTests: number;
  /** Failure details */
  failures: Array<{ test: string; error: string }>;
}

/** Phase output type map */
export interface PhaseOutputMap {
  plan: PlanOutput;
  search: SearchOutput;
  read: ReadOutput;
  edit: EditOutput;
  test: TestOutput;
}

/** Handler function for a single phase */
export type PhaseHandler<P extends CyclePhase> = (
  input: CycleContext,
) => Promise<PhaseOutputMap[P]>;

/** Configuration for the agent cycle */
export interface AgentCycleConfig {
  /** Phase handlers — each implements the logic for one phase */
  handlers: {
    [P in CyclePhase]: PhaseHandler<P>;
  };
  /** Called when a phase starts */
  onPhaseStart?: (phase: CyclePhase, index: number) => void;
  /** Called when a phase completes */
  onPhaseComplete?: (result: PhaseResult) => void;
  /** If true, skip phases the planner deems unnecessary */
  allowShortCircuit?: boolean;
}

/** Context passed through the cycle, accumulating results */
export interface CycleContext {
  /** The original user request */
  request: string;
  /** Results from completed phases */
  phaseResults: Partial<Record<CyclePhase, PhaseResult>>;
  /** Typed accessors for completed phase data */
  plan: PlanOutput | null;
  search: SearchOutput | null;
  read: ReadOutput | null;
  edit: EditOutput | null;
  test: TestOutput | null;
}

/** Complete result of the agent cycle */
export interface AgentCycleResult {
  /** Original request */
  request: string;
  /** Whether the full cycle completed successfully */
  success: boolean;
  /** Phases that were executed */
  phasesExecuted: CyclePhase[];
  /** Phases that were skipped */
  phasesSkipped: CyclePhase[];
  /** All phase results */
  results: Record<string, PhaseResult>;
  /** Total duration across all phases */
  totalDurationMs: number;
  /** The cycle context with all accumulated data */
  context: CycleContext;
}

// =============================================================================
// Context Builder
// =============================================================================

/** Creates a fresh cycle context for a request */
export function createCycleContext(request: string): CycleContext {
  return {
    request,
    phaseResults: {},
    plan: null,
    search: null,
    read: null,
    edit: null,
    test: null,
  };
}

// =============================================================================
// Complexity Detection
// =============================================================================

/** Keywords that suggest a complex multi-phase request */
const COMPLEX_KEYWORDS = [
  "refactor", "implement", "create", "build", "add feature",
  "redesign", "migrate", "optimize", "restructure", "integrate",
  "generate page", "generate section", "full theme",
];

/**
 * Determines if a request is complex enough to need all 5 phases.
 * Simple requests (e.g. "change color to blue") can short-circuit.
 */
export function isComplexRequest(request: string): boolean {
  const lower = request.toLowerCase();
  return COMPLEX_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Determines which phases to skip based on plan output.
 * Non-complex requests may skip search/read if targets are known.
 */
export function determinePhasesToSkip(
  plan: PlanOutput,
  allowShortCircuit: boolean,
): Set<CyclePhase> {
  const skip = new Set<CyclePhase>();
  if (!allowShortCircuit) return skip;
  if (!plan.requiresFullCycle) {
    if (plan.targetFiles.length === 0) skip.add("search");
    if (plan.complexity <= 1) skip.add("read");
  }
  return skip;
}

// =============================================================================
// Agent Cycle Runner
// =============================================================================

/**
 * Runs the full multi-step agent cycle: Plan → Search → Read → Edit → Test.
 *
 * Each phase handler receives the accumulated context from prior phases.
 * If allowShortCircuit is true and the plan phase determines the request
 * is simple, intermediate phases may be skipped.
 */
export async function runAgentCycle(
  request: string,
  config: AgentCycleConfig,
): Promise<AgentCycleResult> {
  const context = createCycleContext(request);
  const results: Record<string, PhaseResult> = {};
  const phasesExecuted: CyclePhase[] = [];
  const phasesSkipped: CyclePhase[] = [];
  let skipSet = new Set<CyclePhase>();

  for (let i = 0; i < CYCLE_PHASES.length; i++) {
    const phase = CYCLE_PHASES[i];

    // Check if this phase should be skipped
    if (skipSet.has(phase)) {
      const skipped: PhaseResult = {
        phase,
        status: "skipped",
        data: null,
        durationMs: 0,
      };
      results[phase] = skipped;
      context.phaseResults[phase] = skipped;
      phasesSkipped.push(phase);
      config.onPhaseComplete?.(skipped);
      continue;
    }

    config.onPhaseStart?.(phase, i);
    const start = performance.now();

    try {
      const handler = config.handlers[phase] as (ctx: CycleContext) => Promise<unknown>;
      const data = await handler(context);
      const durationMs = Math.round(performance.now() - start);

      const result: PhaseResult = {
        phase,
        status: "completed",
        data,
        durationMs,
      };

      results[phase] = result;
      context.phaseResults[phase] = result;
      (context as unknown as Record<string, unknown>)[phase] = data;
      phasesExecuted.push(phase);
      config.onPhaseComplete?.(result);

      // After plan phase, determine which phases to skip
      if (phase === "plan" && config.allowShortCircuit) {
        skipSet = determinePhasesToSkip(
          data as PlanOutput,
          true,
        );
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      const result: PhaseResult = {
        phase,
        status: "failed",
        data: null,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      };

      results[phase] = result;
      context.phaseResults[phase] = result;
      phasesExecuted.push(phase);
      config.onPhaseComplete?.(result);

      // On failure, skip remaining phases
      break;
    }
  }

  const totalDurationMs = Object.values(results).reduce(
    (sum, r) => sum + r.durationMs,
    0,
  );

  const allCompleted = phasesExecuted.every(
    (p) => results[p].status === "completed",
  );

  return {
    request,
    success: allCompleted && phasesExecuted.includes("edit"),
    phasesExecuted,
    phasesSkipped,
    results,
    totalDurationMs,
    context,
  };
}

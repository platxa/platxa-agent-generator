/**
 * Orchestrator-Workers Pattern
 *
 * Decomposes a multi-section page generation request into individual
 * section tasks. Workers execute in parallel (with concurrency limit),
 * and the orchestrator assembles the final page result.
 */

import type {
  OdooSectionType,
  PageSectionResult,
  PageGenerationResult,
  BrandTokenContext,
} from "./types";

// =============================================================================
// Types
// =============================================================================

/** A single section task to be executed by a worker */
export interface SectionTask {
  id: string;
  sectionType: OdooSectionType;
  priority: number;
  brandTokens?: BrandTokenContext;
  /** Additional context for this section (e.g. "above the fold") */
  context?: string;
}

/** Status of a worker task */
export type TaskStatus = "pending" | "running" | "completed" | "failed";

/** Worker result for a single section */
export interface WorkerResult {
  taskId: string;
  status: TaskStatus;
  section: PageSectionResult | null;
  error: string | null;
  durationMs: number;
}

/** Orchestrator execution summary */
export interface OrchestrationResult {
  page: PageGenerationResult;
  workerResults: WorkerResult[];
  totalDurationMs: number;
  parallelism: number;
}

/** Worker function signature */
export type SectionWorkerFn = (task: SectionTask) => Promise<PageSectionResult>;

/** Options for the orchestrator */
export interface OrchestratorOptions {
  /** Max concurrent workers (default 3) */
  maxConcurrency?: number;
  /** Timeout per section in ms (default 30000) */
  timeoutMs?: number;
  /** Called when a task starts */
  onTaskStart?: (task: SectionTask) => void;
  /** Called when a task completes */
  onTaskComplete?: (result: WorkerResult) => void;
}

// =============================================================================
// Task Decomposition
// =============================================================================

/** Default section ordering by visual priority (top to bottom) */
const SECTION_PRIORITY: Record<OdooSectionType, number> = {
  hero: 0,
  features: 1,
  about: 2,
  services: 3,
  testimonials: 4,
  pricing: 5,
  team: 6,
  gallery: 7,
  faq: 8,
  contact: 9,
  cta: 10,
  footer: 11,
};

/**
 * Decomposes a page request into individual section tasks.
 * Tasks are ordered by visual priority (hero first, footer last).
 */
export function decomposePage(
  sections: OdooSectionType[],
  brandTokens?: BrandTokenContext,
): SectionTask[] {
  return sections
    .map((sectionType, index) => ({
      id: `task-${sectionType}-${index}`,
      sectionType,
      priority: SECTION_PRIORITY[sectionType] ?? index,
      brandTokens,
      context: index === 0 ? "above the fold" : undefined,
    }))
    .sort((a, b) => a.priority - b.priority);
}

// =============================================================================
// Parallel Worker Execution
// =============================================================================

/**
 * Executes a single section task with timeout handling.
 */
async function executeTask(
  task: SectionTask,
  workerFn: SectionWorkerFn,
  timeoutMs: number,
): Promise<WorkerResult> {
  const start = performance.now();

  try {
    const section = await Promise.race([
      workerFn(task),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);

    return {
      taskId: task.id,
      status: "completed",
      section,
      error: null,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      taskId: task.id,
      status: "failed",
      section: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - start),
    };
  }
}

/**
 * Runs tasks in parallel with a concurrency limit.
 * Returns results in the original task order.
 */
export async function runWorkers(
  tasks: SectionTask[],
  workerFn: SectionWorkerFn,
  options: OrchestratorOptions = {},
): Promise<WorkerResult[]> {
  const {
    maxConcurrency = 3,
    timeoutMs = 30000,
    onTaskStart,
    onTaskComplete,
  } = options;

  const results: WorkerResult[] = new Array(tasks.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      const task = tasks[index];

      onTaskStart?.(task);
      const result = await executeTask(task, workerFn, timeoutMs);
      results[index] = result;
      onTaskComplete?.(result);
    }
  }

  // Launch concurrent workers
  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    () => runNext(),
  );

  await Promise.all(workers);
  return results;
}

// =============================================================================
// Orchestrator
// =============================================================================

/**
 * Full orchestrator: decomposes, executes workers in parallel, assembles result.
 */
export async function orchestratePage(
  sections: OdooSectionType[],
  workerFn: SectionWorkerFn,
  brandTokens?: BrandTokenContext,
  options: OrchestratorOptions = {},
): Promise<OrchestrationResult> {
  const start = performance.now();
  const concurrency = options.maxConcurrency ?? 3;

  // 1. Decompose
  const tasks = decomposePage(sections, brandTokens);

  // 2. Execute in parallel
  const workerResults = await runWorkers(tasks, workerFn, options);

  // 3. Assemble — collect successful sections in priority order
  const completedSections: PageSectionResult[] = workerResults
    .filter((r): r is WorkerResult & { section: PageSectionResult } =>
      r.status === "completed" && r.section !== null,
    )
    .map((r) => r.section);

  const allSucceeded = workerResults.every((r) => r.status === "completed");

  const page: PageGenerationResult = {
    sections: completedSections,
    combinedHtml: completedSections.map((s) => s.html).join("\n\n"),
    combinedScss: completedSections
      .map((s) => s.scss)
      .filter(Boolean)
      .join("\n\n"),
    isComplete: allSucceeded,
  };

  return {
    page,
    workerResults,
    totalDurationMs: Math.round(performance.now() - start),
    parallelism: concurrency,
  };
}

/**
 * Parallel Generator — Concurrent Section Generation
 *
 * Executes multiple section generation tasks in parallel with
 * configurable concurrency, progress tracking, and error isolation.
 */

// =============================================================================
// Types
// =============================================================================

/** A section generation task */
export interface GenerationTask {
  /** Section ID */
  sectionId: string;
  /** Section type (e.g. "hero", "features", "cta") */
  sectionType: string;
  /** Generation prompt or context */
  prompt: string;
  /** Priority (lower = higher priority) */
  priority: number;
}

/** Status of an individual task */
export type TaskExecutionStatus = "pending" | "running" | "completed" | "failed";

/** Result of a single section generation */
export interface TaskResult {
  /** Section ID */
  sectionId: string;
  /** Execution status */
  status: TaskExecutionStatus;
  /** Generated HTML (if completed) */
  html?: string;
  /** Generated SCSS (if completed) */
  scss?: string;
  /** Error message (if failed) */
  error?: string;
  /** Execution duration in ms */
  durationMs: number;
  /** Start timestamp */
  startedAt: string;
  /** End timestamp */
  completedAt: string;
}

/** Progress event emitted during parallel execution */
export interface ProgressEvent {
  /** Total tasks */
  total: number;
  /** Completed tasks (success + failed) */
  completed: number;
  /** Failed tasks */
  failed: number;
  /** Currently running tasks */
  running: number;
  /** Pending tasks */
  pending: number;
  /** Most recently completed section ID */
  lastCompletedId?: string;
  /** Overall progress 0-1 */
  progress: number;
}

/** Configuration for parallel execution */
export interface ParallelConfig {
  /** Max concurrent tasks (default: 5) */
  concurrency: number;
  /** Per-task timeout in ms (default: 30000) */
  taskTimeoutMs: number;
  /** Whether to continue on individual task failure (default: true) */
  continueOnError: boolean;
}

/** Full result of parallel generation */
export interface ParallelResult {
  /** All task results */
  results: TaskResult[];
  /** Total wall-clock duration in ms */
  totalDurationMs: number;
  /** Sum of all individual task durations */
  sumTaskDurationMs: number;
  /** Parallelism efficiency ratio (sum / total) */
  parallelismRatio: number;
  /** Number of successful tasks */
  successCount: number;
  /** Number of failed tasks */
  failCount: number;
}

/** Generator function type — produces HTML+SCSS for a section */
export type SectionGeneratorFn = (
  task: GenerationTask,
) => Promise<{ html: string; scss: string }>;

/** Progress callback */
export type ProgressCallback = (event: ProgressEvent) => void;

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_PARALLEL_CONFIG: ParallelConfig = {
  concurrency: 5,
  taskTimeoutMs: 30000,
  continueOnError: true,
};

// =============================================================================
// Parallel Execution Engine
// =============================================================================

/**
 * Sorts tasks by priority (lower number = higher priority).
 */
export function sortByPriority(tasks: GenerationTask[]): GenerationTask[] {
  return [...tasks].sort((a, b) => a.priority - b.priority);
}

/**
 * Creates a timeout-wrapped promise that rejects after the specified ms.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, sectionId: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Task ${sectionId} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Executes section generation tasks in parallel with bounded concurrency.
 */
export async function runParallel(
  tasks: GenerationTask[],
  generator: SectionGeneratorFn,
  config: ParallelConfig = DEFAULT_PARALLEL_CONFIG,
  onProgress?: ProgressCallback,
): Promise<ParallelResult> {
  const sorted = sortByPriority(tasks);
  const results: TaskResult[] = [];
  const totalStart = Date.now();

  let completedCount = 0;
  let failedCount = 0;
  let runningCount = 0;

  const emitProgress = (lastId?: string) => {
    if (!onProgress) return;
    onProgress({
      total: sorted.length,
      completed: completedCount,
      failed: failedCount,
      running: runningCount,
      pending: sorted.length - completedCount - runningCount,
      lastCompletedId: lastId,
      progress: sorted.length > 0 ? completedCount / sorted.length : 1,
    });
  };

  // Semaphore-based concurrency control
  const queue = [...sorted];
  const executing = new Set<Promise<void>>();

  const runTask = async (task: GenerationTask): Promise<void> => {
    runningCount++;
    emitProgress();
    const start = Date.now();
    const startIso = new Date(start).toISOString();

    try {
      const { html, scss } = await withTimeout(
        generator(task),
        config.taskTimeoutMs,
        task.sectionId,
      );
      const end = Date.now();
      results.push({
        sectionId: task.sectionId,
        status: "completed",
        html,
        scss,
        durationMs: end - start,
        startedAt: startIso,
        completedAt: new Date(end).toISOString(),
      });
      completedCount++;
      runningCount--;
      emitProgress(task.sectionId);
    } catch (err) {
      const end = Date.now();
      results.push({
        sectionId: task.sectionId,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        durationMs: end - start,
        startedAt: startIso,
        completedAt: new Date(end).toISOString(),
      });
      completedCount++;
      failedCount++;
      runningCount--;
      emitProgress(task.sectionId);

      if (!config.continueOnError) {
        throw err;
      }
    }
  };

  for (const task of queue) {
    const p = runTask(task).then(() => {
      executing.delete(p);
    });
    executing.add(p);

    if (executing.size >= config.concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);

  const totalEnd = Date.now();
  const totalDurationMs = totalEnd - totalStart;
  const sumTaskDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    results,
    totalDurationMs,
    sumTaskDurationMs,
    parallelismRatio: totalDurationMs > 0 ? sumTaskDurationMs / totalDurationMs : 1,
    successCount: results.filter((r) => r.status === "completed").length,
    failCount: failedCount,
  };
}

/**
 * Creates generation tasks from a section list.
 */
export function createTasks(
  sections: Array<{ id: string; type: string; prompt?: string }>,
): GenerationTask[] {
  return sections.map((s, i) => ({
    sectionId: s.id,
    sectionType: s.type,
    prompt: s.prompt ?? `Generate ${s.type} section`,
    priority: i,
  }));
}

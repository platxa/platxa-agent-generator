/**
 * Parallel Analyzer
 *
 * Runs analysis tasks in parallel across multiple language modules
 * for multi-language projects. Provides efficient concurrent processing
 * with configurable concurrency limits and task prioritization.
 *
 * @module parallel-analyzer
 */

import type {
  Language,
  NormalizedError,
  ModuleAnalysisResult,
  AnalysisContext,
  LanguageModule,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Analysis task status
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Analysis task priority
 */
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Analysis task
 */
export interface AnalysisTask {
  /** Unique task ID */
  id: string;
  /** Language to analyze */
  language: Language;
  /** Errors to analyze */
  errors: NormalizedError[];
  /** Task priority */
  priority: TaskPriority;
  /** Task status */
  status: TaskStatus;
  /** Creation timestamp */
  createdAt: Date;
  /** Start timestamp */
  startedAt?: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Result if completed */
  result?: ModuleAnalysisResult;
  /** Error if failed */
  error?: string;
  /** Execution time in ms */
  executionTimeMs?: number;
}

/**
 * Batch analysis request
 */
export interface BatchAnalysisRequest {
  /** Errors grouped by language */
  errorsByLanguage: Map<Language, NormalizedError[]>;
  /** Analysis context */
  context: AnalysisContext;
  /** Priority override per language */
  priorities?: Map<Language, TaskPriority>;
  /** Timeout per task (ms) */
  taskTimeoutMs?: number;
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  /** Results by language */
  resultsByLanguage: Map<Language, ModuleAnalysisResult>;
  /** Failed languages */
  failedLanguages: Map<Language, string>;
  /** Total errors analyzed */
  totalErrors: number;
  /** Total hypotheses generated */
  totalHypotheses: number;
  /** Total fixes suggested */
  totalFixes: number;
  /** Total execution time (ms) */
  totalTimeMs: number;
  /** Tasks summary */
  tasksSummary: {
    total: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

/**
 * Progress callback
 */
export type ProgressCallback = (task: AnalysisTask, progress: number) => void;

/**
 * Parallel analyzer configuration
 */
export interface ParallelAnalyzerConfig {
  /** Maximum concurrent tasks */
  maxConcurrency: number;
  /** Default task timeout (ms) */
  defaultTimeoutMs: number;
  /** Enable task prioritization */
  enablePrioritization: boolean;
  /** Retry failed tasks */
  retryOnFailure: boolean;
  /** Maximum retries per task */
  maxRetries: number;
  /** Verbose logging */
  verbose: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: ParallelAnalyzerConfig = {
  maxConcurrency: 4,
  defaultTimeoutMs: 30000, // 30 seconds
  enablePrioritization: true,
  retryOnFailure: true,
  maxRetries: 2,
  verbose: false,
};

// =============================================================================
// Priority Ordering
// =============================================================================

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// =============================================================================
// Parallel Analyzer Class
// =============================================================================

/**
 * Parallel Analyzer
 *
 * Efficiently analyzes errors across multiple languages in parallel.
 */
export class ParallelAnalyzer {
  private config: ParallelAnalyzerConfig;
  private modules: Map<Language, LanguageModule>;
  private tasks: Map<string, AnalysisTask>;
  private runningTasks: Set<string>;
  private progressCallbacks: Set<ProgressCallback>;

  constructor(config: Partial<ParallelAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modules = new Map();
    this.tasks = new Map();
    this.runningTasks = new Set();
    this.progressCallbacks = new Set();
  }

  /**
   * Register a language module
   */
  registerModule(module: LanguageModule): void {
    this.modules.set(module.language, module);
  }

  /**
   * Register multiple modules
   */
  registerModules(modules: LanguageModule[]): void {
    for (const module of modules) {
      this.registerModule(module);
    }
  }

  /**
   * Get registered modules
   */
  getRegisteredLanguages(): Language[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Add progress callback
   */
  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  /**
   * Analyze errors in parallel across languages
   */
  async analyze(request: BatchAnalysisRequest): Promise<BatchAnalysisResult> {
    const startTime = Date.now();

    // Create tasks for each language
    const tasks = this.createTasks(request);

    // Run tasks with concurrency control
    await this.runTasks(tasks, request.context, request.taskTimeoutMs);

    // Collect results
    return this.collectResults(tasks, startTime);
  }

  /**
   * Analyze a single language
   */
  async analyzeSingle(
    language: Language,
    errors: NormalizedError[],
    context: AnalysisContext,
    priority: TaskPriority = 'normal'
  ): Promise<ModuleAnalysisResult> {
    const module = this.modules.get(language);
    if (!module) {
      throw new Error(`No module registered for language: ${language}`);
    }

    const task = this.createTask(language, errors, priority);
    await this.executeTask(task, module, context);

    if (task.status === 'failed') {
      throw new Error(task.error ?? 'Analysis failed');
    }

    return task.result!;
  }

  /**
   * Create tasks from batch request
   */
  private createTasks(request: BatchAnalysisRequest): AnalysisTask[] {
    const tasks: AnalysisTask[] = [];

    for (const [language, errors] of request.errorsByLanguage) {
      if (!this.modules.has(language)) {
        continue; // Skip languages without modules
      }

      const priority = request.priorities?.get(language) ?? this.inferPriority(errors);
      const task = this.createTask(language, errors, priority);
      tasks.push(task);
    }

    // Sort by priority if enabled
    if (this.config.enablePrioritization) {
      tasks.sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      );
    }

    return tasks;
  }

  /**
   * Create a single task
   */
  private createTask(
    language: Language,
    errors: NormalizedError[],
    priority: TaskPriority
  ): AnalysisTask {
    const id = `task-${language}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const task: AnalysisTask = {
      id,
      language,
      errors,
      priority,
      status: 'pending',
      createdAt: new Date(),
    };

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Infer priority from errors
   */
  private inferPriority(errors: NormalizedError[]): TaskPriority {
    // Check for critical errors
    const hasCritical = errors.some(
      (e) =>
        e.severity === 'error' &&
        (e.type.includes('Syntax') ||
          e.type.includes('Fatal') ||
          e.type.includes('Security'))
    );
    if (hasCritical) {
      return 'critical';
    }

    // Check for high-severity errors
    const errorCount = errors.filter((e) => e.severity === 'error').length;
    if (errorCount > 5) {
      return 'high';
    }

    // Check for warnings only
    if (errors.every((e) => e.severity === 'warning' || e.severity === 'hint')) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * Run tasks with concurrency control
   */
  private async runTasks(
    tasks: AnalysisTask[],
    context: AnalysisContext,
    timeoutMs?: number
  ): Promise<void> {
    const taskQueue = [...tasks];
    const activePromises: Promise<void>[] = [];

    while (taskQueue.length > 0 || activePromises.length > 0) {
      // Start new tasks up to concurrency limit
      while (
        taskQueue.length > 0 &&
        this.runningTasks.size < this.config.maxConcurrency
      ) {
        const task = taskQueue.shift()!;
        const module = this.modules.get(task.language)!;

        const promise = this.executeTaskWithRetry(
          task,
          module,
          context,
          timeoutMs
        ).finally(() => {
          const index = activePromises.indexOf(promise);
          if (index !== -1) {
            activePromises.splice(index, 1);
          }
        });

        activePromises.push(promise);
      }

      // Wait for at least one task to complete
      if (activePromises.length > 0) {
        await Promise.race(activePromises);
      }
    }
  }

  /**
   * Execute task with retry logic
   */
  private async executeTaskWithRetry(
    task: AnalysisTask,
    module: LanguageModule,
    context: AnalysisContext,
    timeoutMs?: number
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = this.config.retryOnFailure
      ? this.config.maxRetries + 1
      : 1;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        await this.executeTask(task, module, context, timeoutMs);

        if (task.status === 'completed') {
          return;
        }
      } catch {
        // Task failed, will retry if configured
      }

      if (attempts < maxAttempts && task.status === 'failed') {
        // Reset for retry
        task.status = 'pending';
        delete task.error;
      }
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: AnalysisTask,
    module: LanguageModule,
    context: AnalysisContext,
    timeoutMs?: number
  ): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date();
    this.runningTasks.add(task.id);
    this.notifyProgress(task, 0);

    const timeout = timeoutMs ?? this.config.defaultTimeoutMs;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), timeout);
      });

      // Run analysis with timeout
      const result = await Promise.race([
        module.analyze(task.errors, context),
        timeoutPromise,
      ]);

      task.result = result;
      task.status = 'completed';
      this.notifyProgress(task, 100);
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
    } finally {
      task.completedAt = new Date();
      task.executionTimeMs =
        task.completedAt.getTime() - task.startedAt!.getTime();
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Collect results from completed tasks
   */
  private collectResults(
    tasks: AnalysisTask[],
    startTime: number
  ): BatchAnalysisResult {
    const resultsByLanguage = new Map<Language, ModuleAnalysisResult>();
    const failedLanguages = new Map<Language, string>();

    let totalErrors = 0;
    let totalHypotheses = 0;
    let totalFixes = 0;

    let completed = 0;
    let failed = 0;
    let cancelled = 0;

    for (const task of tasks) {
      if (task.status === 'completed' && task.result) {
        resultsByLanguage.set(task.language, task.result);
        totalErrors += task.result.errors.length;
        totalHypotheses += task.result.hypotheses.length;
        totalFixes += task.result.fixes.length;
        completed++;
      } else if (task.status === 'failed') {
        failedLanguages.set(task.language, task.error ?? 'Unknown error');
        failed++;
      } else if (task.status === 'cancelled') {
        cancelled++;
      }
    }

    return {
      resultsByLanguage,
      failedLanguages,
      totalErrors,
      totalHypotheses,
      totalFixes,
      totalTimeMs: Date.now() - startTime,
      tasksSummary: {
        total: tasks.length,
        completed,
        failed,
        cancelled,
      },
    };
  }

  /**
   * Notify progress callbacks
   */
  private notifyProgress(task: AnalysisTask, progress: number): void {
    for (const callback of this.progressCallbacks) {
      try {
        callback(task, progress);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Cancel all pending tasks
   */
  cancelAll(): void {
    for (const task of this.tasks.values()) {
      if (task.status === 'pending' || task.status === 'running') {
        task.status = 'cancelled';
        task.completedAt = new Date();
      }
    }
    this.runningTasks.clear();
  }

  /**
   * Cancel task by ID
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task && (task.status === 'pending' || task.status === 'running')) {
      task.status = 'cancelled';
      task.completedAt = new Date();
      this.runningTasks.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): AnalysisTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): AnalysisTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): AnalysisTask[] {
    return Array.from(this.tasks.values()).filter(
      (task) => task.status === 'running'
    );
  }

  /**
   * Clear completed tasks
   */
  clearCompletedTasks(): number {
    let count = 0;
    for (const [id, task] of this.tasks) {
      if (
        task.status === 'completed' ||
        task.status === 'failed' ||
        task.status === 'cancelled'
      ) {
        this.tasks.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    registeredModules: number;
    totalTasks: number;
    runningTasks: number;
    pendingTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgExecutionTimeMs: number;
  } {
    let pending = 0;
    let completed = 0;
    let failed = 0;
    let totalExecutionTime = 0;
    let executionCount = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'pending':
          pending++;
          break;
        case 'completed':
          completed++;
          if (task.executionTimeMs !== undefined) {
            totalExecutionTime += task.executionTimeMs;
            executionCount++;
          }
          break;
        case 'failed':
          failed++;
          break;
      }
    }

    return {
      registeredModules: this.modules.size,
      totalTasks: this.tasks.size,
      runningTasks: this.runningTasks.size,
      pendingTasks: pending,
      completedTasks: completed,
      failedTasks: failed,
      avgExecutionTimeMs:
        executionCount > 0 ? totalExecutionTime / executionCount : 0,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a parallel analyzer
 */
export function createParallelAnalyzer(
  config?: Partial<ParallelAnalyzerConfig>,
  modules?: LanguageModule[]
): ParallelAnalyzer {
  const analyzer = new ParallelAnalyzer(config);
  if (modules) {
    analyzer.registerModules(modules);
  }
  return analyzer;
}

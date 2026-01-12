/**
 * Subagent Spawner
 *
 * Spawns specialized subagents for verification tasks using
 * Claude Code's Task tool architecture.
 *
 * @module subagent-spawner
 */

import type { Language, FixSuggestion, ValidationResult, ValidationStep } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Subagent type identifiers
 */
export type SubagentType =
  | 'type-checker'
  | 'linter'
  | 'test-runner'
  | 'regression-tester'
  | 'security-scanner'
  | 'performance-analyzer'
  | 'code-reviewer'
  | 'documentation-checker';

/**
 * Subagent execution status
 */
export type SubagentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

/**
 * Subagent priority level
 */
export type SubagentPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Subagent definition
 */
export interface SubagentDefinition {
  /** Subagent type */
  type: SubagentType;
  /** Human-readable name */
  name: string;
  /** Description of what the subagent does */
  description: string;
  /** Languages this subagent supports */
  supportedLanguages: Language[];
  /** Tools the subagent needs access to */
  requiredTools: string[];
  /** Default timeout in milliseconds */
  defaultTimeoutMs: number;
  /** Priority level */
  priority: SubagentPriority;
  /** Whether this subagent can run in parallel with others */
  parallelizable: boolean;
}

/**
 * Subagent task to execute
 */
export interface SubagentTask {
  /** Unique task identifier */
  id: string;
  /** Subagent type to use */
  subagentType: SubagentType;
  /** Task description for the subagent */
  prompt: string;
  /** Files to analyze */
  targetFiles: string[];
  /** Fix suggestion being verified (if applicable) */
  fixSuggestion?: FixSuggestion;
  /** Language context */
  language: Language;
  /** Working directory */
  workingDirectory: string;
  /** Custom timeout override */
  timeoutMs?: number;
  /** Additional context */
  context: Record<string, unknown>;
}

/**
 * Subagent execution result
 */
export interface SubagentResult {
  /** Task ID */
  taskId: string;
  /** Subagent type */
  subagentType: SubagentType;
  /** Execution status */
  status: SubagentStatus;
  /** Whether verification passed */
  passed: boolean;
  /** Detailed output from subagent */
  output: string;
  /** Structured findings */
  findings: SubagentFinding[];
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Error message if failed */
  errorMessage?: string;
  /** Timestamp */
  completedAt: Date;
}

/**
 * Individual finding from subagent analysis
 */
export interface SubagentFinding {
  /** Finding type */
  type: 'error' | 'warning' | 'info' | 'suggestion';
  /** Finding message */
  message: string;
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Suggested fix */
  suggestedFix?: string;
  /** Finding code/rule */
  code?: string;
}

/**
 * Verification plan with ordered subagent tasks
 */
export interface VerificationPlan {
  /** Plan identifier */
  id: string;
  /** Fix being verified */
  fixSuggestion: FixSuggestion;
  /** Ordered list of tasks to execute */
  tasks: SubagentTask[];
  /** Tasks that can run in parallel */
  parallelGroups: SubagentTask[][];
  /** Total estimated duration */
  estimatedDurationMs: number;
  /** Created timestamp */
  createdAt: Date;
}

/**
 * Verification execution result
 */
export interface VerificationResult {
  /** Plan that was executed */
  planId: string;
  /** Overall pass/fail */
  passed: boolean;
  /** Individual task results */
  taskResults: SubagentResult[];
  /** Summary of all findings */
  findings: SubagentFinding[];
  /** Total execution time */
  totalDurationMs: number;
  /** Validation result compatible with existing types */
  validationResult: ValidationResult;
}

/**
 * Spawner configuration
 */
export interface SubagentSpawnerConfig {
  /** Maximum parallel subagents */
  maxParallelSubagents: number;
  /** Default timeout for all subagents */
  defaultTimeoutMs: number;
  /** Whether to continue on failure */
  continueOnFailure: boolean;
  /** Retry failed tasks */
  retryOnFailure: boolean;
  /** Maximum retries */
  maxRetries: number;
  /** Custom subagent definitions */
  customSubagents: SubagentDefinition[];
}

// =============================================================================
// Default Subagent Definitions
// =============================================================================

const DEFAULT_SUBAGENTS: SubagentDefinition[] = [
  {
    type: 'type-checker',
    name: 'Type Checker',
    description: 'Verifies type correctness using language-specific type checkers',
    supportedLanguages: ['python', 'typescript', 'javascript'],
    requiredTools: ['Bash', 'Read'],
    defaultTimeoutMs: 60000,
    priority: 'critical',
    parallelizable: true,
  },
  {
    type: 'linter',
    name: 'Linter',
    description: 'Runs linting tools to check code style and potential issues',
    supportedLanguages: ['python', 'typescript', 'javascript', 'css', 'scss'],
    requiredTools: ['Bash', 'Read'],
    defaultTimeoutMs: 30000,
    priority: 'high',
    parallelizable: true,
  },
  {
    type: 'test-runner',
    name: 'Test Runner',
    description: 'Executes test suites to verify functionality',
    supportedLanguages: ['python', 'typescript', 'javascript'],
    requiredTools: ['Bash', 'Read'],
    defaultTimeoutMs: 120000,
    priority: 'critical',
    parallelizable: false,
  },
  {
    type: 'regression-tester',
    name: 'Regression Tester',
    description: 'Checks for regressions in existing functionality',
    supportedLanguages: ['python', 'typescript', 'javascript'],
    requiredTools: ['Bash', 'Read', 'Grep'],
    defaultTimeoutMs: 180000,
    priority: 'high',
    parallelizable: false,
  },
  {
    type: 'security-scanner',
    name: 'Security Scanner',
    description: 'Scans for security vulnerabilities in code',
    supportedLanguages: ['python', 'typescript', 'javascript'],
    requiredTools: ['Bash', 'Read', 'Grep'],
    defaultTimeoutMs: 60000,
    priority: 'high',
    parallelizable: true,
  },
  {
    type: 'performance-analyzer',
    name: 'Performance Analyzer',
    description: 'Analyzes performance implications of changes',
    supportedLanguages: ['python', 'typescript', 'javascript'],
    requiredTools: ['Bash', 'Read'],
    defaultTimeoutMs: 90000,
    priority: 'medium',
    parallelizable: true,
  },
  {
    type: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Reviews code for best practices and patterns',
    supportedLanguages: ['python', 'typescript', 'javascript', 'css', 'scss', 'html'],
    requiredTools: ['Read', 'Grep', 'Glob'],
    defaultTimeoutMs: 60000,
    priority: 'medium',
    parallelizable: true,
  },
  {
    type: 'documentation-checker',
    name: 'Documentation Checker',
    description: 'Verifies documentation is accurate and complete',
    supportedLanguages: ['python', 'typescript', 'javascript'],
    requiredTools: ['Read', 'Grep'],
    defaultTimeoutMs: 30000,
    priority: 'low',
    parallelizable: true,
  },
];

// =============================================================================
// Prompt Templates
// =============================================================================

const PROMPT_TEMPLATES: Record<SubagentType, string> = {
  'type-checker': `You are a type checking verification agent.

Your task is to verify type correctness for the following files:
{files}

Language: {language}
Working Directory: {workingDirectory}

{context}

Run the appropriate type checker for this language:
- Python: pyright or mypy
- TypeScript/JavaScript: tsc --noEmit

Report all type errors found. For each error, provide:
1. File path
2. Line number
3. Error message
4. Suggested fix if applicable

Return your findings in a structured format.`,

  linter: `You are a code linting verification agent.

Your task is to run linting on the following files:
{files}

Language: {language}
Working Directory: {workingDirectory}

{context}

Run the appropriate linter for this language:
- Python: ruff check or pylint
- TypeScript/JavaScript: eslint
- CSS/SCSS: stylelint

Report all linting issues found. For each issue, provide:
1. File path
2. Line number
3. Rule violated
4. Issue description
5. Suggested fix if applicable

Return your findings in a structured format.`,

  'test-runner': `You are a test execution verification agent.

Your task is to run tests that cover the following files:
{files}

Language: {language}
Working Directory: {workingDirectory}

{context}

Run the appropriate test framework:
- Python: pytest
- TypeScript/JavaScript: jest, vitest, or mocha

Report test results including:
1. Total tests run
2. Tests passed
3. Tests failed
4. Test coverage if available
5. Details of any failures

Return your findings in a structured format.`,

  'regression-tester': `You are a regression testing verification agent.

Your task is to check for regressions in behavior after changes to:
{files}

Language: {language}
Working Directory: {workingDirectory}

{context}

Check for:
1. Changed function signatures that might break callers
2. Modified return values or types
3. Altered side effects
4. Changed error handling behavior
5. Performance regressions

Report any potential regressions found with impact assessment.

Return your findings in a structured format.`,

  'security-scanner': `You are a security scanning verification agent.

Your task is to scan for security vulnerabilities in:
{files}

Language: {language}
Working Directory: {workingDirectory}

{context}

Check for:
1. Injection vulnerabilities (SQL, command, XSS)
2. Hardcoded secrets or credentials
3. Insecure cryptographic usage
4. Path traversal vulnerabilities
5. Unsafe deserialization
6. OWASP Top 10 issues

Report all security findings with severity levels.

Return your findings in a structured format.`,

  'performance-analyzer': `You are a performance analysis verification agent.

Your task is to analyze performance implications of changes to:
{files}

Language: {language}
Working Directory: {workingDirectory}

{context}

Check for:
1. Algorithm complexity changes
2. Memory allocation patterns
3. Unnecessary iterations or copies
4. Database query efficiency
5. Caching opportunities
6. Async/await patterns

Report any performance concerns with recommendations.

Return your findings in a structured format.`,

  'code-reviewer': `You are a code review verification agent.

Your task is to review code quality and best practices in:
{files}

Language: {language}
Working Directory: {workingDirectory}

{context}

Check for:
1. Code readability and clarity
2. DRY principle violations
3. SOLID principle adherence
4. Error handling completeness
5. Naming conventions
6. Code organization

Report findings with improvement suggestions.

Return your findings in a structured format.`,

  'documentation-checker': `You are a documentation verification agent.

Your task is to verify documentation accuracy for:
{files}

Language: {language}
Working Directory: {workingDirectory}

{context}

Check for:
1. Missing docstrings/JSDoc
2. Outdated documentation
3. Incorrect parameter descriptions
4. Missing return type documentation
5. Example code accuracy
6. README updates needed

Report documentation issues found.

Return your findings in a structured format.`,
};

// =============================================================================
// Subagent Spawner Class
// =============================================================================

/**
 * Spawns and manages subagents for verification tasks
 */
export class SubagentSpawner {
  private config: SubagentSpawnerConfig;
  private subagentDefinitions: Map<SubagentType, SubagentDefinition>;
  private runningTasks: Map<string, SubagentTask>;
  private taskCounter: number;

  constructor(config: Partial<SubagentSpawnerConfig> = {}) {
    this.config = {
      maxParallelSubagents: config.maxParallelSubagents ?? 3,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 60000,
      continueOnFailure: config.continueOnFailure ?? true,
      retryOnFailure: config.retryOnFailure ?? false,
      maxRetries: config.maxRetries ?? 1,
      customSubagents: config.customSubagents ?? [],
    };

    // Initialize subagent definitions
    this.subagentDefinitions = new Map();
    for (const def of DEFAULT_SUBAGENTS) {
      this.subagentDefinitions.set(def.type, def);
    }
    for (const def of this.config.customSubagents) {
      this.subagentDefinitions.set(def.type, def);
    }

    this.runningTasks = new Map();
    this.taskCounter = 0;
  }

  /**
   * Create a verification plan for a fix suggestion
   */
  createVerificationPlan(
    fixSuggestion: FixSuggestion,
    language: Language,
    workingDirectory: string,
    options: {
      includeTypes?: SubagentType[];
      excludeTypes?: SubagentType[];
      customContext?: Record<string, unknown>;
    } = {}
  ): VerificationPlan {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tasks: SubagentTask[] = [];
    const parallelGroups: SubagentTask[][] = [];

    // Get files from fix suggestion
    const targetFiles = fixSuggestion.changes.map((c) => c.file);

    // Determine which subagents to use
    let subagentsToUse = Array.from(this.subagentDefinitions.values()).filter(
      (def) =>
        def.supportedLanguages.includes(language) ||
        def.supportedLanguages.includes('unknown')
    );

    if (options.includeTypes && options.includeTypes.length > 0) {
      subagentsToUse = subagentsToUse.filter((def) =>
        options.includeTypes?.includes(def.type)
      );
    }

    if (options.excludeTypes && options.excludeTypes.length > 0) {
      subagentsToUse = subagentsToUse.filter(
        (def) => !options.excludeTypes?.includes(def.type)
      );
    }

    // Sort by priority
    subagentsToUse.sort((a, b) => {
      const priorityOrder: Record<SubagentPriority, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Create tasks
    for (const def of subagentsToUse) {
      const task = this.createTask(
        def.type,
        targetFiles,
        fixSuggestion,
        language,
        workingDirectory,
        options.customContext || {}
      );
      tasks.push(task);
    }

    // Group parallelizable tasks
    const parallelizable: SubagentTask[] = [];
    const sequential: SubagentTask[] = [];

    for (const task of tasks) {
      const def = this.subagentDefinitions.get(task.subagentType);
      if (def?.parallelizable) {
        parallelizable.push(task);
      } else {
        sequential.push(task);
      }
    }

    // Create parallel groups (respecting max parallel limit)
    for (let i = 0; i < parallelizable.length; i += this.config.maxParallelSubagents) {
      parallelGroups.push(parallelizable.slice(i, i + this.config.maxParallelSubagents));
    }

    // Add sequential tasks as individual groups
    for (const task of sequential) {
      parallelGroups.push([task]);
    }

    // Calculate estimated duration
    const estimatedDurationMs = this.estimateDuration(tasks);

    return {
      id: planId,
      fixSuggestion,
      tasks,
      parallelGroups,
      estimatedDurationMs,
      createdAt: new Date(),
    };
  }

  /**
   * Execute a verification plan
   */
  async executeVerificationPlan(
    plan: VerificationPlan,
    executor: SubagentExecutor
  ): Promise<VerificationResult> {
    const taskResults: SubagentResult[] = [];
    const allFindings: SubagentFinding[] = [];
    const startTime = Date.now();
    let overallPassed = true;

    // Execute parallel groups in sequence
    for (const group of plan.parallelGroups) {
      const groupResults = await Promise.all(
        group.map((task) => this.executeTask(task, executor))
      );

      for (const result of groupResults) {
        taskResults.push(result);
        allFindings.push(...result.findings);

        if (!result.passed) {
          overallPassed = false;
          if (!this.config.continueOnFailure) {
            break;
          }
        }
      }

      if (!overallPassed && !this.config.continueOnFailure) {
        break;
      }
    }

    const totalDurationMs = Date.now() - startTime;

    // Convert to ValidationResult format
    const errorNotes = allFindings
      .filter((f) => f.type === 'error')
      .map((f) => `${f.file ?? 'unknown'}:${f.line ?? 0}: ${f.message}`);
    const warningNotes = allFindings
      .filter((f) => f.type === 'warning')
      .map((f) => `${f.file ?? 'unknown'}:${f.line ?? 0}: ${f.message}`);

    const validationResult: ValidationResult = {
      passed: overallPassed,
      steps: taskResults.map((r) => {
        const stepType = this.mapSubagentToStepType(r.subagentType);
        const stepResult: {
          step: ValidationStep;
          passed: boolean;
          output?: string;
          error?: string;
        } = {
          step: {
            type: stepType,
            description: `${r.subagentType} verification`,
            command: r.subagentType,
            expectedOutcome: 'No errors',
          },
          passed: r.passed,
        };
        if (r.output) {
          stepResult.output = r.output;
        }
        if (r.errorMessage !== undefined) {
          stepResult.error = r.errorMessage;
        }
        return stepResult;
      }),
      notes: [...errorNotes, ...warningNotes],
    };

    return {
      planId: plan.id,
      passed: overallPassed,
      taskResults,
      findings: allFindings,
      totalDurationMs,
      validationResult,
    };
  }

  /**
   * Execute a single subagent task
   */
  private async executeTask(
    task: SubagentTask,
    executor: SubagentExecutor
  ): Promise<SubagentResult> {
    const def = this.subagentDefinitions.get(task.subagentType);
    const timeoutMs = task.timeoutMs ?? def?.defaultTimeoutMs ?? this.config.defaultTimeoutMs;
    const startTime = Date.now();

    this.runningTasks.set(task.id, task);

    try {
      // Generate the prompt
      const prompt = this.generatePrompt(task);

      // Execute via the executor
      const output = await Promise.race([
        executor.execute(task.subagentType, prompt, task.targetFiles),
        this.timeout(timeoutMs),
      ]);

      // Parse findings from output
      const findings = this.parseFindings(output as string);
      const passed = !findings.some((f) => f.type === 'error');

      return {
        taskId: task.id,
        subagentType: task.subagentType,
        status: 'completed',
        passed,
        output: output as string,
        findings,
        durationMs: Date.now() - startTime,
        completedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage === 'TIMEOUT';

      return {
        taskId: task.id,
        subagentType: task.subagentType,
        status: isTimeout ? 'timeout' : 'failed',
        passed: false,
        output: '',
        findings: [],
        durationMs: Date.now() - startTime,
        errorMessage,
        completedAt: new Date(),
      };
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Create a subagent task
   */
  private createTask(
    subagentType: SubagentType,
    targetFiles: string[],
    fixSuggestion: FixSuggestion,
    language: Language,
    workingDirectory: string,
    context: Record<string, unknown>
  ): SubagentTask {
    this.taskCounter++;
    return {
      id: `task-${this.taskCounter}-${subagentType}`,
      subagentType,
      prompt: '', // Will be generated at execution time
      targetFiles,
      fixSuggestion,
      language,
      workingDirectory,
      context,
    };
  }

  /**
   * Generate prompt for a task
   */
  private generatePrompt(task: SubagentTask): string {
    const template = PROMPT_TEMPLATES[task.subagentType];
    if (!template) {
      return `Verify the following files: ${task.targetFiles.join(', ')}`;
    }

    let prompt = template
      .replace('{files}', task.targetFiles.map((f) => `- ${f}`).join('\n'))
      .replace('{language}', task.language)
      .replace('{workingDirectory}', task.workingDirectory);

    // Add context
    const contextStr = Object.entries(task.context)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n');
    prompt = prompt.replace('{context}', contextStr || 'No additional context.');

    return prompt;
  }

  /**
   * Map subagent type to validation step type
   */
  private mapSubagentToStepType(
    subagentType: SubagentType
  ): 'typecheck' | 'lint' | 'test' | 'build' | 'manual' {
    switch (subagentType) {
      case 'type-checker':
        return 'typecheck';
      case 'linter':
        return 'lint';
      case 'test-runner':
      case 'regression-tester':
        return 'test';
      default:
        return 'manual';
    }
  }

  /**
   * Parse findings from subagent output
   */
  private parseFindings(output: string): SubagentFinding[] {
    const findings: SubagentFinding[] = [];

    // Try to parse structured output
    const lines = output.split('\n');
    for (const line of lines) {
      // Match common error formats
      const errorMatch = line.match(/^(.+?):(\d+):(\d+):\s*(error|warning|info):\s*(.+)$/i);
      if (errorMatch) {
        const typeStr = errorMatch[4];
        const messageStr = errorMatch[5];
        const fileStr = errorMatch[1];
        const lineStr = errorMatch[2];
        const colStr = errorMatch[3];
        if (typeStr && messageStr && fileStr && lineStr && colStr) {
          findings.push({
            type: typeStr.toLowerCase() as 'error' | 'warning' | 'info',
            message: messageStr,
            file: fileStr,
            line: parseInt(lineStr, 10),
            column: parseInt(colStr, 10),
          });
        }
        continue;
      }

      // Match simpler format
      const simpleMatch = line.match(/^(ERROR|WARNING|INFO):\s*(.+)$/i);
      if (simpleMatch) {
        const typeStr = simpleMatch[1];
        const messageStr = simpleMatch[2];
        if (typeStr && messageStr) {
          findings.push({
            type: typeStr.toLowerCase() as 'error' | 'warning' | 'info',
            message: messageStr,
          });
        }
      }
    }

    return findings;
  }

  /**
   * Estimate total duration for tasks
   */
  private estimateDuration(tasks: SubagentTask[]): number {
    let total = 0;
    for (const task of tasks) {
      const def = this.subagentDefinitions.get(task.subagentType);
      total += task.timeoutMs ?? def?.defaultTimeoutMs ?? this.config.defaultTimeoutMs;
    }
    // Account for parallelization
    return Math.ceil(total / this.config.maxParallelSubagents);
  }

  /**
   * Create a timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), ms);
    });
  }

  /**
   * Get available subagent types for a language
   */
  getAvailableSubagents(language: Language): SubagentDefinition[] {
    return Array.from(this.subagentDefinitions.values()).filter(
      (def) =>
        def.supportedLanguages.includes(language) ||
        def.supportedLanguages.includes('unknown')
    );
  }

  /**
   * Get subagent definition
   */
  getSubagentDefinition(type: SubagentType): SubagentDefinition | undefined {
    return this.subagentDefinitions.get(type);
  }

  /**
   * Register a custom subagent
   */
  registerSubagent(definition: SubagentDefinition): void {
    this.subagentDefinitions.set(definition.type, definition);
  }

  /**
   * Get currently running tasks
   */
  getRunningTasks(): SubagentTask[] {
    return Array.from(this.runningTasks.values());
  }
}

// =============================================================================
// Executor Interface
// =============================================================================

/**
 * Interface for subagent execution (to be implemented by Claude Code integration)
 */
export interface SubagentExecutor {
  /**
   * Execute a subagent with the given prompt
   */
  execute(type: SubagentType, prompt: string, files: string[]): Promise<string>;
}

/**
 * Mock executor for testing
 */
export class MockSubagentExecutor implements SubagentExecutor {
  private responses: Map<SubagentType, string>;

  constructor() {
    this.responses = new Map();
  }

  setResponse(type: SubagentType, response: string): void {
    this.responses.set(type, response);
  }

  async execute(type: SubagentType, _prompt: string, _files: string[]): Promise<string> {
    return this.responses.get(type) ?? 'No issues found.';
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a subagent spawner
 */
export function createSubagentSpawner(
  config?: Partial<SubagentSpawnerConfig>
): SubagentSpawner {
  return new SubagentSpawner(config);
}

/**
 * Create a mock executor for testing
 */
export function createMockExecutor(): MockSubagentExecutor {
  return new MockSubagentExecutor();
}

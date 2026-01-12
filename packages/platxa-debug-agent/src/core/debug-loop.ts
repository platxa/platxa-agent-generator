/**
 * Debug Loop
 *
 * Implements an interactive debugging loop with logging injection
 * for gathering runtime context and iterative hypothesis refinement.
 *
 * @module debug-loop
 */

import type {
  Language,
  NormalizedError,
  RootCauseHypothesis,
  FixSuggestion,
  DebugSession,
  DebugEvent,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Debug loop state
 */
export type DebugLoopState =
  | 'idle'
  | 'analyzing'
  | 'gathering_context'
  | 'generating_hypothesis'
  | 'suggesting_fix'
  | 'validating_fix'
  | 'awaiting_input'
  | 'injecting_logging'
  | 'completed'
  | 'failed';

/**
 * User action types
 */
export type UserAction =
  | 'provide_error'
  | 'confirm_hypothesis'
  | 'reject_hypothesis'
  | 'apply_fix'
  | 'reject_fix'
  | 'provide_context'
  | 'inject_logging'
  | 'run_code'
  | 'abort';

/**
 * Logging injection point
 */
export interface LoggingInjection {
  /** Unique identifier */
  id: string;
  /** File to inject into */
  file: string;
  /** Line number to inject at */
  line: number;
  /** Type of injection */
  type: 'before' | 'after' | 'wrap' | 'replace';
  /** Logging code to inject */
  code: string;
  /** Variables to log */
  variables: string[];
  /** Language-specific format */
  language: Language;
  /** Whether injection is active */
  active: boolean;
  /** Original code (if type is 'replace' or 'wrap') */
  originalCode?: string;
}

/**
 * Debug loop iteration
 */
export interface DebugIteration {
  /** Iteration number */
  iteration: number;
  /** State at start of iteration */
  state: DebugLoopState;
  /** Error being debugged */
  error: NormalizedError;
  /** Current hypotheses */
  hypotheses: RootCauseHypothesis[];
  /** Current fix suggestions */
  fixes: FixSuggestion[];
  /** Active logging injections */
  injections: LoggingInjection[];
  /** User actions in this iteration */
  actions: UserActionRecord[];
  /** Gathered context */
  context: GatheredContext;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Recorded user action
 */
export interface UserActionRecord {
  /** Action type */
  action: UserAction;
  /** Action data */
  data: unknown;
  /** Timestamp */
  timestamp: Date;
  /** Result of action */
  result?: string;
}

/**
 * Context gathered during debugging
 */
export interface GatheredContext {
  /** Variable values */
  variables: Map<string, unknown>;
  /** Stack traces */
  stackTraces: string[];
  /** Log outputs */
  logOutputs: string[];
  /** File contents */
  fileContents: Map<string, string>;
  /** Runtime information */
  runtimeInfo: Record<string, unknown>;
}

/**
 * Debug loop callback handlers
 */
export interface DebugLoopHandlers {
  /** Called when user input is needed */
  onAwaitInput: (prompt: string, options: string[]) => Promise<UserAction>;
  /** Called to display message to user */
  onMessage: (message: string, type: 'info' | 'warning' | 'error' | 'success') => void;
  /** Called when hypothesis is generated */
  onHypothesis: (hypothesis: RootCauseHypothesis) => void;
  /** Called when fix is suggested */
  onFix: (fix: FixSuggestion) => void;
  /** Called to inject logging */
  onInjectLogging: (injection: LoggingInjection) => Promise<boolean>;
  /** Called to run code with injections */
  onRunCode: (command: string) => Promise<string>;
  /** Called on state change */
  onStateChange: (oldState: DebugLoopState, newState: DebugLoopState) => void;
  /** Called on completion */
  onComplete: (result: DebugLoopResult) => void;
}

/**
 * Debug loop result
 */
export interface DebugLoopResult {
  /** Whether debugging was successful */
  success: boolean;
  /** Final state */
  state: DebugLoopState;
  /** Root cause identified */
  rootCause?: RootCauseHypothesis;
  /** Applied fix */
  appliedFix?: FixSuggestion;
  /** Number of iterations */
  iterations: number;
  /** Total duration */
  durationMs: number;
  /** All iterations */
  history: DebugIteration[];
  /** Session ID */
  sessionId: string;
}

/**
 * Debug loop configuration
 */
export interface DebugLoopConfig {
  /** Maximum iterations before giving up */
  maxIterations: number;
  /** Auto-accept high-confidence fixes */
  autoAcceptThreshold: number;
  /** Enable automatic logging injection */
  autoInjectLogging: boolean;
  /** Maximum logging injections per iteration */
  maxInjectionsPerIteration: number;
  /** Timeout for user input (ms) */
  inputTimeoutMs: number;
  /** Timeout for code execution (ms) */
  executionTimeoutMs: number;
  /** Verbose logging */
  verbose: boolean;
}

/**
 * Self-debugging loop configuration
 *
 * Based on Self-Debug (ICLR 2024), CodeAct, and RECODE (2025) research.
 * Configures iterative self-debugging with rubber duck explanation
 * and diminishing returns detection.
 */
export interface SelfDebugConfig {
  /** Maximum iterations before stopping (research shows diminishing returns after 5) */
  maxIterations: number;
  /** Enable rubber duck debugging mode (explain code to identify mistakes) */
  enableExplanation: boolean;
  /** Stop if improvement falls below this threshold (0-1 range) */
  earlyTerminationThreshold: number;
}

/**
 * Self-debugging iteration result
 *
 * Tracks the progress and measurements for a single iteration
 * of the self-debugging loop.
 */
export interface SelfDebugIteration {
  /** Iteration number (1-based) */
  iteration: number;
  /** Hypothesis being tested in this iteration */
  hypothesis: string;
  /** Fix attempt code or description */
  fixAttempt: string;
  /** Improvement delta from previous iteration (0-1 range, negative if regression) */
  improvementDelta: number;
  /** Explanation generated (if enableExplanation is true) */
  explanation?: string;
  /** Whether this iteration's fix was successful */
  success: boolean;
  /** Error message if fix failed */
  errorMessage?: string;
  /** Duration of this iteration in milliseconds */
  durationMs: number;
  /** Timestamp when iteration started */
  timestamp: Date;
}

// =============================================================================
// Logging Injection Templates
// =============================================================================

const LOGGING_TEMPLATES: Record<Language, {
  before: (vars: string[], line: number) => string;
  after: (vars: string[], line: number) => string;
  wrap: (code: string, vars: string[], line: number) => string;
}> = {
  python: {
    before: (vars, line) =>
      `print(f"[DEBUG L${line}] ${vars.map(v => `${v}={${v}!r}`).join(', ')}")`,
    after: (vars, line) =>
      `print(f"[DEBUG L${line} AFTER] ${vars.map(v => `${v}={${v}!r}`).join(', ')}")`,
    wrap: (code, vars, line) =>
      `try:\n    _result_${line} = ${code}\n    print(f"[DEBUG L${line}] result={_result_${line}!r}, ${vars.map(v => `${v}={${v}!r}`).join(', ')}")\nexcept Exception as _e_${line}:\n    print(f"[DEBUG L${line}] ERROR: {_e_${line}}")\n    raise`,
  },
  javascript: {
    before: (vars, line) =>
      `console.log('[DEBUG L${line}]', ${vars.map(v => `'${v}=', ${v}`).join(', ')});`,
    after: (vars, line) =>
      `console.log('[DEBUG L${line} AFTER]', ${vars.map(v => `'${v}=', ${v}`).join(', ')});`,
    wrap: (code, vars, line) =>
      `(() => { try { const _result = ${code}; console.log('[DEBUG L${line}] result=', _result, ${vars.map(v => `'${v}=', ${v}`).join(', ')}); return _result; } catch (_e) { console.error('[DEBUG L${line}] ERROR:', _e); throw _e; } })()`,
  },
  typescript: {
    before: (vars, line) =>
      `console.log('[DEBUG L${line}]', ${vars.map(v => `'${v}=', ${v}`).join(', ')});`,
    after: (vars, line) =>
      `console.log('[DEBUG L${line} AFTER]', ${vars.map(v => `'${v}=', ${v}`).join(', ')});`,
    wrap: (code, vars, line) =>
      `(() => { try { const _result = ${code}; console.log('[DEBUG L${line}] result=', _result, ${vars.map(v => `'${v}=', ${v}`).join(', ')}); return _result; } catch (_e) { console.error('[DEBUG L${line}] ERROR:', _e); throw _e; } })()`,
  },
  css: {
    before: () => '/* DEBUG: CSS does not support logging */',
    after: () => '/* DEBUG: CSS does not support logging */',
    wrap: (code) => code,
  },
  scss: {
    before: (vars, line) => `@debug "L${line}: ${vars.join(', ')}";`,
    after: (vars, line) => `@debug "L${line} AFTER: ${vars.join(', ')}";`,
    wrap: (code) => code,
  },
  tailwind: {
    before: () => '/* DEBUG: Tailwind does not support logging */',
    after: () => '/* DEBUG: Tailwind does not support logging */',
    wrap: (code) => code,
  },
  html: {
    before: (vars, line) =>
      `<script>console.log('[DEBUG L${line}]', ${vars.map(v => `'${v}'`).join(', ')});</script>`,
    after: (vars, line) =>
      `<script>console.log('[DEBUG L${line} AFTER]', ${vars.map(v => `'${v}'`).join(', ')});</script>`,
    wrap: (code) => code,
  },
  json: {
    before: () => '',
    after: () => '',
    wrap: (code) => code,
  },
  yaml: {
    before: () => '# DEBUG: YAML does not support logging',
    after: () => '# DEBUG: YAML does not support logging',
    wrap: (code) => code,
  },
  markdown: {
    before: () => '<!-- DEBUG -->',
    after: () => '<!-- DEBUG AFTER -->',
    wrap: (code) => code,
  },
  unknown: {
    before: (vars, line) => `// DEBUG L${line}: ${vars.join(', ')}`,
    after: (vars, line) => `// DEBUG L${line} AFTER: ${vars.join(', ')}`,
    wrap: (code) => code,
  },
};

// =============================================================================
// Debug Loop Class
// =============================================================================

/**
 * Interactive Debug Loop
 *
 * Manages an iterative debugging process with user interaction
 * and automatic logging injection.
 */
export class DebugLoop {
  private config: DebugLoopConfig;
  private handlers: DebugLoopHandlers;
  private state: DebugLoopState;
  private currentSession: DebugSession | null;
  private iterations: DebugIteration[];
  private injections: Map<string, LoggingInjection>;
  private context: GatheredContext;
  private startTime: number;
  private events: DebugEvent[];

  constructor(config: Partial<DebugLoopConfig>, handlers: DebugLoopHandlers) {
    this.config = {
      maxIterations: config.maxIterations ?? 10,
      autoAcceptThreshold: config.autoAcceptThreshold ?? 0.95,
      autoInjectLogging: config.autoInjectLogging ?? true,
      maxInjectionsPerIteration: config.maxInjectionsPerIteration ?? 5,
      inputTimeoutMs: config.inputTimeoutMs ?? 300000, // 5 minutes
      executionTimeoutMs: config.executionTimeoutMs ?? 60000, // 1 minute
      verbose: config.verbose ?? false,
    };
    this.handlers = handlers;
    this.state = 'idle';
    this.currentSession = null;
    this.iterations = [];
    this.injections = new Map();
    this.context = this.createEmptyContext();
    this.startTime = 0;
    this.events = [];
  }

  /**
   * Start a debug loop for an error
   */
  async start(error: NormalizedError, session?: DebugSession): Promise<DebugLoopResult> {
    this.startTime = Date.now();
    this.currentSession = session ?? this.createSession(error);
    this.iterations = [];
    this.injections.clear();
    this.context = this.createEmptyContext();

    this.transition('analyzing');
    this.handlers.onMessage(`Starting debug session for: ${error.message}`, 'info');

    let iteration = 0;
    let completed = false;
    let rootCause: RootCauseHypothesis | undefined;
    let appliedFix: FixSuggestion | undefined;

    while (!completed && iteration < this.config.maxIterations) {
      iteration++;
      const iterationResult = await this.runIteration(error, iteration);

      if (iterationResult.completed) {
        completed = true;
        rootCause = iterationResult.rootCause;
        appliedFix = iterationResult.appliedFix;
      }

      if (this.state === 'failed' || this.state === 'completed') {
        completed = true;
      }
    }

    if (!completed) {
      this.transition('failed');
      this.handlers.onMessage(
        `Debug loop reached maximum iterations (${this.config.maxIterations})`,
        'warning'
      );
    }

    const result: DebugLoopResult = {
      success: this.state === 'completed',
      state: this.state,
      iterations: iteration,
      durationMs: Date.now() - this.startTime,
      history: this.iterations,
      sessionId: this.currentSession.id,
    };
    if (rootCause) {
      result.rootCause = rootCause;
    }
    if (appliedFix) {
      result.appliedFix = appliedFix;
    }

    this.handlers.onComplete(result);
    return result;
  }

  /**
   * Run self-debugging loop with iteration tracking
   *
   * Implements the Self-Debug pattern from research (ICLR 2024).
   * Returns detailed iteration results for analysis and improvement tracking.
   *
   * @param code - The code to debug
   * @param error - The error to fix
   * @param config - Self-debug configuration (defaults to research-recommended values)
   * @returns Array of iteration results with improvement deltas
   */
  async iterate(
    code: string,
    error: NormalizedError,
    config: Partial<SelfDebugConfig> = {}
  ): Promise<SelfDebugIteration[]> {
    const selfDebugConfig: SelfDebugConfig = {
      maxIterations: config.maxIterations ?? 5, // Research shows diminishing returns after 5
      enableExplanation: config.enableExplanation ?? true,
      earlyTerminationThreshold: config.earlyTerminationThreshold ?? 0.05,
    };

    const iterations: SelfDebugIteration[] = [];
    let currentCode = code;
    let previousScore = 0;
    let iterationNum = 0;

    while (iterationNum < selfDebugConfig.maxIterations) {
      iterationNum++;
      const startTime = Date.now();

      // Generate explanation if enabled (rubber duck debugging)
      let explanation: string | undefined;
      if (selfDebugConfig.enableExplanation) {
        explanation = this.explainCode(currentCode, error);
      }

      // Generate hypothesis for this iteration
      const hypothesis = this.generateIterationHypothesis(currentCode, error, explanation);

      // Attempt to generate a fix
      const fixAttempt = this.generateIterationFix(currentCode, error, hypothesis);

      // Evaluate the fix
      const evaluationResult = this.evaluateIterationFix(fixAttempt, error);
      const currentScore = evaluationResult.score;
      const improvementDelta = currentScore - previousScore;

      const iteration: SelfDebugIteration = {
        iteration: iterationNum,
        hypothesis,
        fixAttempt,
        improvementDelta,
        success: evaluationResult.success,
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };

      if (explanation) {
        iteration.explanation = explanation;
      }

      if (!evaluationResult.success && evaluationResult.errorMessage) {
        iteration.errorMessage = evaluationResult.errorMessage;
      }

      iterations.push(iteration);

      // Check for early termination due to diminishing returns
      if (this.detectDiminishingReturns(iterations, selfDebugConfig.earlyTerminationThreshold)) {
        this.handlers.onMessage(
          `Early termination: improvement delta (${improvementDelta.toFixed(3)}) below threshold`,
          'info'
        );
        break;
      }

      // Check for success
      if (evaluationResult.success) {
        this.handlers.onMessage(
          `Fix successful after ${iterationNum} iteration(s)`,
          'success'
        );
        break;
      }

      // Update for next iteration
      previousScore = currentScore;
      if (evaluationResult.updatedCode) {
        currentCode = evaluationResult.updatedCode;
      }
    }

    return iterations;
  }

  /**
   * Generate hypothesis for a self-debug iteration
   */
  private generateIterationHypothesis(
    _code: string,
    error: NormalizedError,
    explanation?: string
  ): string {
    // Build hypothesis from error and explanation
    const parts: string[] = [];
    parts.push(`Error type: ${error.type ?? 'unknown'}`);
    parts.push(`Message: ${error.message}`);

    if (error.location) {
      parts.push(`Location: ${error.location.file}:${error.location.line}`);
    }

    if (explanation) {
      parts.push(`Analysis: ${explanation}`);
    }

    return parts.join('. ');
  }

  /**
   * Generate fix attempt for a self-debug iteration
   */
  private generateIterationFix(
    code: string,
    _error: NormalizedError,
    _hypothesis: string
  ): string {
    // In a full implementation, this would use LLM to generate fix
    // For now, return the original code as placeholder
    return code;
  }

  /**
   * Evaluate a fix attempt
   */
  private evaluateIterationFix(
    _fixAttempt: string,
    _error: NormalizedError
  ): {
    success: boolean;
    score: number;
    errorMessage?: string;
    updatedCode?: string;
  } {
    // In a full implementation, this would run tests and evaluate
    // For now, return placeholder evaluation
    return {
      success: false,
      score: 0,
      errorMessage: 'Evaluation not implemented - placeholder',
    };
  }

  /**
   * Explain code to identify potential issues (rubber duck debugging)
   *
   * Feature #4: Generates an explanation of the code to help identify mistakes.
   * Based on Self-Debug research showing explanation improves fix quality.
   *
   * @param code - The code to explain
   * @param error - The error context
   * @returns Explanation string identifying potential issues
   */
  explainCode(code: string, error: NormalizedError): string {
    // Placeholder implementation - will be enhanced in Feature #4
    const lines = code.split('\n');
    const errorLine = error.location?.line ?? 1;
    const relevantLines = lines.slice(
      Math.max(0, errorLine - 3),
      Math.min(lines.length, errorLine + 2)
    );

    return `Analyzing code around line ${errorLine}:\n${relevantLines.join('\n')}\n\nError: ${error.message}`;
  }

  /**
   * Detect diminishing returns in iteration improvements
   *
   * Feature #5: Analyzes iteration history to detect when improvements
   * fall below threshold, indicating further iterations are unlikely to help.
   *
   * @param iterations - History of iterations
   * @param threshold - Minimum improvement threshold (0-1)
   * @returns true if diminishing returns detected
   */
  detectDiminishingReturns(
    iterations: SelfDebugIteration[],
    threshold: number
  ): boolean {
    // Placeholder implementation - will be enhanced in Feature #5
    if (iterations.length < 2) {
      return false;
    }

    // Check last two iterations for improvement below threshold
    const recent = iterations.slice(-2);
    return recent.every((iter) => Math.abs(iter.improvementDelta) < threshold);
  }

  /**
   * Run a single debug iteration
   */
  private async runIteration(
    error: NormalizedError,
    iteration: number
  ): Promise<{
    completed: boolean;
    rootCause?: RootCauseHypothesis;
    appliedFix?: FixSuggestion;
  }> {
    const iterationRecord: DebugIteration = {
      iteration,
      state: this.state,
      error,
      hypotheses: [],
      fixes: [],
      injections: Array.from(this.injections.values()),
      actions: [],
      context: this.context,
      timestamp: new Date(),
    };

    this.iterations.push(iterationRecord);

    // Step 1: Generate hypotheses
    this.transition('generating_hypothesis');
    const hypotheses = await this.generateHypotheses(error);
    iterationRecord.hypotheses = hypotheses;

    if (hypotheses.length === 0) {
      this.handlers.onMessage('No hypotheses generated. Need more context.', 'warning');
      return await this.gatherMoreContext(error, iterationRecord);
    }

    // Step 2: Present hypotheses and get user feedback
    const selectedHypothesis = await this.selectHypothesis(hypotheses, iterationRecord);
    if (!selectedHypothesis) {
      return { completed: false };
    }

    // Step 3: Generate fixes
    this.transition('suggesting_fix');
    const fixes = await this.generateFixes(selectedHypothesis, error);
    iterationRecord.fixes = fixes;

    if (fixes.length === 0) {
      this.handlers.onMessage('No fixes generated for hypothesis.', 'warning');
      return { completed: false };
    }

    // Step 4: Select and apply fix
    const selectedFix = await this.selectFix(fixes, iterationRecord);
    if (!selectedFix) {
      return { completed: false };
    }

    // Step 5: Validate fix
    this.transition('validating_fix');
    const validationResult = await this.validateFix(selectedFix, iterationRecord);

    if (validationResult.success) {
      this.transition('completed');
      return {
        completed: true,
        rootCause: selectedHypothesis,
        appliedFix: selectedFix,
      };
    }

    // Fix validation failed, continue loop
    this.handlers.onMessage('Fix validation failed. Continuing analysis.', 'warning');
    return { completed: false };
  }

  /**
   * Generate hypotheses for the error
   */
  private async generateHypotheses(_error: NormalizedError): Promise<RootCauseHypothesis[]> {
    // In a real implementation, this would call the RCA engine
    // For now, return placeholder
    return [];
  }

  /**
   * Generate fixes for a hypothesis
   */
  private async generateFixes(
    _hypothesis: RootCauseHypothesis,
    _error: NormalizedError
  ): Promise<FixSuggestion[]> {
    // In a real implementation, this would call the fix generator
    // For now, return placeholder
    return [];
  }

  /**
   * Present hypotheses and get user selection
   */
  private async selectHypothesis(
    hypotheses: RootCauseHypothesis[],
    iterationRecord: DebugIteration
  ): Promise<RootCauseHypothesis | undefined> {
    // Auto-accept high-confidence hypothesis
    const highConfidence = hypotheses.find(
      (h) => h.confidence >= this.config.autoAcceptThreshold
    );
    if (highConfidence) {
      this.handlers.onHypothesis(highConfidence);
      iterationRecord.actions.push({
        action: 'confirm_hypothesis',
        data: { hypothesis: highConfidence, auto: true },
        timestamp: new Date(),
        result: 'auto-accepted',
      });
      return highConfidence;
    }

    // Present hypotheses to user
    for (const hypothesis of hypotheses) {
      this.handlers.onHypothesis(hypothesis);
    }

    this.transition('awaiting_input');
    const action = await this.handlers.onAwaitInput(
      'Select a hypothesis or request more context',
      ['confirm_hypothesis', 'reject_hypothesis', 'inject_logging', 'abort']
    );

    iterationRecord.actions.push({
      action,
      data: { hypotheses },
      timestamp: new Date(),
    });

    if (action === 'abort') {
      this.transition('failed');
      return undefined;
    }

    if (action === 'confirm_hypothesis') {
      return hypotheses[0];
    }

    if (action === 'inject_logging') {
      await this.injectLoggingForHypotheses(hypotheses, iterationRecord);
      return undefined;
    }

    return undefined;
  }

  /**
   * Present fixes and get user selection
   */
  private async selectFix(
    fixes: FixSuggestion[],
    iterationRecord: DebugIteration
  ): Promise<FixSuggestion | undefined> {
    // Auto-accept high-confidence fix
    const highConfidence = fixes.find(
      (f) => f.confidence >= this.config.autoAcceptThreshold
    );
    if (highConfidence) {
      this.handlers.onFix(highConfidence);
      iterationRecord.actions.push({
        action: 'apply_fix',
        data: { fix: highConfidence, auto: true },
        timestamp: new Date(),
        result: 'auto-accepted',
      });
      return highConfidence;
    }

    // Present fixes to user
    for (const fix of fixes) {
      this.handlers.onFix(fix);
    }

    this.transition('awaiting_input');
    const action = await this.handlers.onAwaitInput(
      'Select a fix to apply or reject',
      ['apply_fix', 'reject_fix', 'inject_logging', 'abort']
    );

    iterationRecord.actions.push({
      action,
      data: { fixes },
      timestamp: new Date(),
    });

    if (action === 'abort') {
      this.transition('failed');
      return undefined;
    }

    if (action === 'apply_fix') {
      return fixes[0];
    }

    return undefined;
  }

  /**
   * Validate an applied fix
   */
  private async validateFix(
    fix: FixSuggestion,
    iterationRecord: DebugIteration
  ): Promise<{ success: boolean; output: string }> {
    this.handlers.onMessage(`Validating fix: ${fix.description}`, 'info');

    // Run code with fix applied
    try {
      const output = await this.handlers.onRunCode('npm test');
      const success = !output.includes('FAIL') && !output.includes('Error');

      iterationRecord.actions.push({
        action: 'run_code',
        data: { fix, command: 'npm test' },
        timestamp: new Date(),
        result: success ? 'passed' : 'failed',
      });

      if (success) {
        this.handlers.onMessage('Fix validation passed!', 'success');
      } else {
        this.handlers.onMessage('Fix validation failed.', 'error');
      }

      return { success, output };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      iterationRecord.actions.push({
        action: 'run_code',
        data: { fix, command: 'npm test', error: errorMsg },
        timestamp: new Date(),
        result: 'error',
      });
      return { success: false, output: errorMsg };
    }
  }

  /**
   * Gather more context when hypotheses are insufficient
   */
  private async gatherMoreContext(
    error: NormalizedError,
    iterationRecord: DebugIteration
  ): Promise<{ completed: boolean }> {
    this.transition('gathering_context');

    if (this.config.autoInjectLogging && error.location) {
      // Auto-inject logging around error location
      const injection = this.createLoggingInjection(
        error.location.file,
        error.location.line,
        'before',
        error.language,
        ['this', 'arguments']
      );

      const success = await this.handlers.onInjectLogging(injection);
      if (success) {
        this.injections.set(injection.id, injection);
        iterationRecord.injections.push(injection);

        this.handlers.onMessage(
          `Injected logging at ${error.location.file}:${error.location.line}`,
          'info'
        );

        // Run code to gather context
        this.transition('injecting_logging');
        const output = await this.handlers.onRunCode('npm start');
        this.context.logOutputs.push(output);
        this.parseLogOutput(output);
      }
    }

    return { completed: false };
  }

  /**
   * Inject logging to gather context for hypotheses
   */
  private async injectLoggingForHypotheses(
    hypotheses: RootCauseHypothesis[],
    iterationRecord: DebugIteration
  ): Promise<void> {
    this.transition('injecting_logging');

    let injectionCount = 0;
    for (const hypothesis of hypotheses) {
      if (injectionCount >= this.config.maxInjectionsPerIteration) break;

      for (const evidence of hypothesis.evidence) {
        if (injectionCount >= this.config.maxInjectionsPerIteration) break;
        if (!evidence.location) continue;

        const injection = this.createLoggingInjection(
          evidence.location.file,
          evidence.location.line,
          'before',
          this.currentSession?.language ?? 'unknown',
          ['this', 'arguments', 'result']
        );

        const success = await this.handlers.onInjectLogging(injection);
        if (success) {
          this.injections.set(injection.id, injection);
          iterationRecord.injections.push(injection);
          injectionCount++;

          this.handlers.onMessage(
            `Injected logging at ${evidence.location.file}:${evidence.location.line}`,
            'info'
          );
        }
      }
    }

    if (injectionCount > 0) {
      // Run code to gather context
      const output = await this.handlers.onRunCode('npm start');
      this.context.logOutputs.push(output);
      this.parseLogOutput(output);
    }
  }

  /**
   * Create a logging injection
   */
  createLoggingInjection(
    file: string,
    line: number,
    type: LoggingInjection['type'],
    language: Language,
    variables: string[]
  ): LoggingInjection {
    const template = LOGGING_TEMPLATES[language] ?? LOGGING_TEMPLATES.unknown;
    let code: string;

    switch (type) {
      case 'before':
        code = template.before(variables, line);
        break;
      case 'after':
        code = template.after(variables, line);
        break;
      case 'wrap':
        code = template.wrap('/* original code */', variables, line);
        break;
      default:
        code = template.before(variables, line);
    }

    return {
      id: `inj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      line,
      type,
      code,
      variables,
      language,
      active: true,
    };
  }

  /**
   * Remove all logging injections
   */
  async removeAllInjections(): Promise<void> {
    for (const injection of this.injections.values()) {
      injection.active = false;
      // In a real implementation, this would restore original code
    }
    this.injections.clear();
  }

  /**
   * Parse log output for variable values
   */
  private parseLogOutput(output: string): void {
    const debugPattern = /\[DEBUG L(\d+)\]\s*(.+)/g;
    let match;

    while ((match = debugPattern.exec(output)) !== null) {
      const lineNum = match[1];
      const values = match[2];

      // Parse variable assignments
      const varPattern = /(\w+)=([^,]+)/g;
      let varMatch;
      while ((varMatch = varPattern.exec(values ?? '')) !== null) {
        const varName = varMatch[1];
        const varValue = varMatch[2];
        if (varName && varValue) {
          this.context.variables.set(`L${lineNum}:${varName}`, varValue.trim());
        }
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transition(newState: DebugLoopState): void {
    const oldState = this.state;
    this.state = newState;
    this.handlers.onStateChange(oldState, newState);

    if (this.config.verbose) {
      this.handlers.onMessage(`State: ${oldState} -> ${newState}`, 'info');
    }
  }

  /**
   * Create an empty context
   */
  private createEmptyContext(): GatheredContext {
    return {
      variables: new Map(),
      stackTraces: [],
      logOutputs: [],
      fileContents: new Map(),
      runtimeInfo: {},
    };
  }

  /**
   * Create a debug session
   */
  private createSession(error: NormalizedError): DebugSession {
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: new Date(),
      input: error.raw,
      language: error.language,
      errors: [error],
      status: 'analyzing',
    };
  }

  /**
   * Get current state
   */
  getState(): DebugLoopState {
    return this.state;
  }

  /**
   * Get current session
   */
  getSession(): DebugSession | null {
    return this.currentSession;
  }

  /**
   * Get gathered context
   */
  getContext(): GatheredContext {
    return this.context;
  }

  /**
   * Get all injections
   */
  getInjections(): LoggingInjection[] {
    return Array.from(this.injections.values());
  }

  /**
   * Add event to session
   */
  addEvent(event: DebugEvent): void {
    this.events.push(event);
  }

  /**
   * Get all events
   */
  getEvents(): DebugEvent[] {
    return this.events;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a debug loop
 */
export function createDebugLoop(
  config: Partial<DebugLoopConfig>,
  handlers: DebugLoopHandlers
): DebugLoop {
  return new DebugLoop(config, handlers);
}

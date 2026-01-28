/**
 * Prompt Optimizer
 *
 * Improves prompts based on output quality feedback. Low-quality output
 * triggers prompt reformulation for measurable quality improvement.
 */

// =============================================================================
// Types
// =============================================================================

export interface QualityFeedback {
  /** Quality score 0-100 */
  score: number;
  /** Specific issues found */
  issues: QualityIssue[];
  /** Whether output was acceptable */
  acceptable: boolean;
}

export type QualityIssueType =
  | "too_short"
  | "too_long"
  | "missing_sections"
  | "poor_structure"
  | "wrong_tone"
  | "missing_brand"
  | "accessibility_issues"
  | "invalid_html"
  | "low_specificity"
  | "repetitive";

export interface QualityIssue {
  type: QualityIssueType;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface PromptAttempt {
  /** Attempt number (1-based) */
  attempt: number;
  /** The prompt used */
  prompt: string;
  /** Quality feedback received */
  feedback: QualityFeedback;
  /** Optimizations applied to generate this prompt */
  optimizations: string[];
  /** Timestamp */
  timestamp: number;
}

export interface OptimizationRule {
  /** Issue type this rule addresses */
  issueType: QualityIssueType;
  /** Instruction to prepend/append to prompt */
  instruction: string;
  /** Where to inject (prepend or append) */
  position: "prepend" | "append";
  /** Priority (higher = applied first) */
  priority: number;
}

export interface PromptOptimizerConfig {
  /** Quality threshold below which optimization triggers */
  qualityThreshold: number;
  /** Max optimization attempts */
  maxAttempts: number;
  /** Optimization rules */
  rules: OptimizationRule[];
}

export const DEFAULT_OPTIMIZATION_RULES: OptimizationRule[] = [
  {
    issueType: "too_short",
    instruction: "Provide detailed, comprehensive content for each section. Minimum 3 paragraphs per section.",
    position: "append",
    priority: 10,
  },
  {
    issueType: "too_long",
    instruction: "Be concise. Each section should be focused and scannable. Maximum 2 short paragraphs per section.",
    position: "append",
    priority: 10,
  },
  {
    issueType: "missing_sections",
    instruction: "Ensure ALL requested sections are included in the output. Do not skip any section.",
    position: "prepend",
    priority: 20,
  },
  {
    issueType: "poor_structure",
    instruction: "Use proper semantic HTML structure: header, main, sections with headings, footer. Each section must have a clear heading.",
    position: "prepend",
    priority: 15,
  },
  {
    issueType: "wrong_tone",
    instruction: "Match the specified brand tone exactly. Re-read the tone requirements before generating.",
    position: "append",
    priority: 8,
  },
  {
    issueType: "missing_brand",
    instruction: "Apply brand colors, fonts, and styling consistently throughout. Reference the brand guide for every element.",
    position: "prepend",
    priority: 18,
  },
  {
    issueType: "accessibility_issues",
    instruction: "Ensure WCAG 2.1 AA compliance: alt text on images, proper heading hierarchy, sufficient color contrast, ARIA labels where needed.",
    position: "append",
    priority: 12,
  },
  {
    issueType: "invalid_html",
    instruction: "Output must be valid, well-formed HTML/QWeb. Close all tags, use proper nesting, no orphaned elements.",
    position: "prepend",
    priority: 25,
  },
  {
    issueType: "low_specificity",
    instruction: "Replace generic placeholder text with specific, industry-relevant content. No lorem ipsum.",
    position: "append",
    priority: 14,
  },
  {
    issueType: "repetitive",
    instruction: "Vary language, structure, and layout across sections. Each section should feel distinct.",
    position: "append",
    priority: 9,
  },
];

export const DEFAULT_OPTIMIZER_CONFIG: PromptOptimizerConfig = {
  qualityThreshold: 70,
  maxAttempts: 3,
  rules: DEFAULT_OPTIMIZATION_RULES,
};

export interface PromptOptimizerState {
  /** Original prompt */
  originalPrompt: string;
  /** Current optimized prompt */
  currentPrompt: string;
  /** All attempts */
  attempts: PromptAttempt[];
  /** Config */
  config: PromptOptimizerConfig;
  /** Whether optimization is complete */
  complete: boolean;
}

// =============================================================================
// State
// =============================================================================

export function createOptimizerState(
  prompt: string,
  config: Partial<PromptOptimizerConfig> = {},
): PromptOptimizerState {
  return {
    originalPrompt: prompt,
    currentPrompt: prompt,
    attempts: [],
    config: { ...DEFAULT_OPTIMIZER_CONFIG, ...config },
    complete: false,
  };
}

// =============================================================================
// Quality Assessment
// =============================================================================

/** Determines if quality is below threshold and optimization needed. */
export function needsOptimization(
  state: PromptOptimizerState,
  feedback: QualityFeedback,
): boolean {
  if (state.complete) return false;
  if (state.attempts.length >= state.config.maxAttempts) return false;
  return feedback.score < state.config.qualityThreshold;
}

/** Selects applicable optimization rules for given issues. */
export function selectRules(
  config: PromptOptimizerConfig,
  issues: QualityIssue[],
): OptimizationRule[] {
  const issueTypes = new Set(issues.map((i) => i.type));
  return config.rules
    .filter((r) => issueTypes.has(r.issueType))
    .sort((a, b) => b.priority - a.priority);
}

/** Applies optimization rules to a prompt. */
export function applyRules(
  prompt: string,
  rules: OptimizationRule[],
): { optimizedPrompt: string; appliedNames: string[] } {
  const prepends: string[] = [];
  const appends: string[] = [];
  const appliedNames: string[] = [];

  for (const rule of rules) {
    if (rule.position === "prepend") {
      prepends.push(rule.instruction);
    } else {
      appends.push(rule.instruction);
    }
    appliedNames.push(rule.issueType);
  }

  const parts: string[] = [];
  if (prepends.length > 0) {
    parts.push("IMPORTANT REQUIREMENTS:\n" + prepends.map((p) => `- ${p}`).join("\n"));
    parts.push("");
  }
  parts.push(prompt);
  if (appends.length > 0) {
    parts.push("");
    parts.push("ADDITIONAL GUIDELINES:\n" + appends.map((a) => `- ${a}`).join("\n"));
  }

  return {
    optimizedPrompt: parts.join("\n"),
    appliedNames,
  };
}

// =============================================================================
// Optimization Pipeline
// =============================================================================

/**
 * Records a quality feedback and optimizes the prompt if needed.
 * Returns updated state with the new/optimized prompt.
 */
export function recordFeedback(
  state: PromptOptimizerState,
  feedback: QualityFeedback,
  timestamp: number = Date.now(),
): PromptOptimizerState {
  const attemptNum = state.attempts.length + 1;

  const attempt: PromptAttempt = {
    attempt: attemptNum,
    prompt: state.currentPrompt,
    feedback,
    optimizations: [],
    timestamp,
  };

  const attempts = [...state.attempts, attempt];

  // Check if optimization is needed
  if (!needsOptimization(state, feedback)) {
    return {
      ...state,
      attempts,
      complete: true,
    };
  }

  // Select and apply rules
  const rules = selectRules(state.config, feedback.issues);
  if (rules.length === 0) {
    return { ...state, attempts, complete: true };
  }

  const { optimizedPrompt, appliedNames } = applyRules(
    state.originalPrompt,
    rules,
  );

  // Update the attempt with applied optimizations
  const updatedAttempts = [...attempts];
  updatedAttempts[updatedAttempts.length - 1] = {
    ...attempt,
    optimizations: appliedNames,
  };

  return {
    ...state,
    currentPrompt: optimizedPrompt,
    attempts: updatedAttempts,
    complete: false,
  };
}

// =============================================================================
// Queries
// =============================================================================

/** Returns the latest quality score, or 0. */
export function getLatestScore(state: PromptOptimizerState): number {
  if (state.attempts.length === 0) return 0;
  return state.attempts[state.attempts.length - 1].feedback.score;
}

/** Returns quality improvement from first to last attempt. */
export function getImprovement(state: PromptOptimizerState): number {
  if (state.attempts.length < 2) return 0;
  const first = state.attempts[0].feedback.score;
  const last = state.attempts[state.attempts.length - 1].feedback.score;
  return last - first;
}

/** Returns the number of attempts made. */
export function getAttemptCount(state: PromptOptimizerState): number {
  return state.attempts.length;
}

/** Returns all unique optimizations applied across attempts. */
export function getAllOptimizations(state: PromptOptimizerState): string[] {
  const all = new Set<string>();
  for (const a of state.attempts) {
    for (const o of a.optimizations) all.add(o);
  }
  return Array.from(all);
}

/** Returns whether the optimizer improved quality above threshold. */
export function wasSuccessful(state: PromptOptimizerState): boolean {
  if (state.attempts.length === 0) return false;
  return state.attempts[state.attempts.length - 1].feedback.score >= state.config.qualityThreshold;
}

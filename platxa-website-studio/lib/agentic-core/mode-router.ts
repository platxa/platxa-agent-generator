/**
 * ModeRouter - Detects plan vs agent intent from user messages
 *
 * Classifies user input to determine whether to:
 * - Plan mode: Explore, explain, analyze (read-only operations)
 * - Agent mode: Create, build, modify (write operations)
 *
 * Key classification rules:
 * - "what if" → plan mode (hypothetical exploration)
 * - "create X" → agent mode (action to build something)
 * - "explain", "analyze", "how would" → plan mode
 * - "build", "fix", "add", "update" → agent mode
 *
 * @module agentic-core/mode-router
 */

// ============================================================================
// Types
// ============================================================================

/** Mode classification result */
export type IntentMode = 'plan' | 'agent';

/** Confidence level of classification */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Classification result with confidence */
export interface ClassificationResult {
  /** Detected intent mode */
  mode: IntentMode;
  /** Confidence level */
  confidence: ConfidenceLevel;
  /** Confidence score (0-1) */
  score: number;
  /** Matched patterns that led to this classification */
  matchedPatterns: string[];
  /** Original message */
  message: string;
}

/** LLM provider for fallback classification */
export interface LLMClassifier {
  /**
   * Classify intent using LLM when keyword matching has low confidence
   * @param message - User message to classify
   * @returns Classification result or null if LLM unavailable
   */
  classifyIntent(message: string): Promise<{ mode: IntentMode; confidence: number } | null>;
}

/** Configuration for ModeRouter */
export interface ModeRouterConfig {
  /** Default mode when confidence is low */
  defaultMode?: IntentMode;
  /** Minimum confidence score to use classification (0-1) */
  confidenceThreshold?: number;
  /** Threshold below which LLM fallback is triggered (0-1) */
  llmFallbackThreshold?: number;
  /** Custom plan patterns to add */
  customPlanPatterns?: RegExp[];
  /** Custom agent patterns to add */
  customAgentPatterns?: RegExp[];
  /** Optional LLM classifier for fallback */
  llmClassifier?: LLMClassifier;
}

// ============================================================================
// Pattern Definitions
// ============================================================================

/**
 * Patterns that indicate plan/exploration intent
 * These suggest the user wants to understand, analyze, or explore options
 *
 * Key patterns: "what if" triggers plan mode for hypothetical exploration
 */
const PLAN_PATTERNS: Array<{ pattern: RegExp; weight: number; name: string }> = [
  // Hypothetical/exploratory - "what if" is the canonical plan mode trigger
  { pattern: /\bwhat if\b/i, weight: 0.95, name: 'what_if' },
  { pattern: /\bhow would\b/i, weight: 0.9, name: 'how_would' },
  { pattern: /\bwhat would happen\b/i, weight: 0.95, name: 'what_would_happen' },
  { pattern: /\bcould we\b/i, weight: 0.7, name: 'could_we' },
  { pattern: /\bshould we\b/i, weight: 0.7, name: 'should_we' },
  { pattern: /\bwould it be\b/i, weight: 0.75, name: 'would_it_be' },

  // Analysis/understanding
  { pattern: /\bexplain\b/i, weight: 0.9, name: 'explain' },
  { pattern: /\banalyze\b/i, weight: 0.9, name: 'analyze' },
  { pattern: /\banalyse\b/i, weight: 0.9, name: 'analyse' },
  { pattern: /\bdescribe\b/i, weight: 0.8, name: 'describe' },
  { pattern: /\bunderstand\b/i, weight: 0.85, name: 'understand' },
  { pattern: /\bwhy does\b/i, weight: 0.85, name: 'why_does' },
  { pattern: /\bhow does\b/i, weight: 0.85, name: 'how_does' },
  { pattern: /\bwhat does\b/i, weight: 0.8, name: 'what_does' },

  // Planning/strategy
  { pattern: /\bplan\b/i, weight: 0.75, name: 'plan' },
  { pattern: /\bstrategy\b/i, weight: 0.8, name: 'strategy' },
  { pattern: /\bapproach\b/i, weight: 0.7, name: 'approach' },
  { pattern: /\boptions?\b/i, weight: 0.65, name: 'options' },
  { pattern: /\balternatives?\b/i, weight: 0.75, name: 'alternatives' },
  { pattern: /\bcompare\b/i, weight: 0.8, name: 'compare' },
  { pattern: /\bevaluate\b/i, weight: 0.8, name: 'evaluate' },

  // Exploration
  { pattern: /\bexplore\b/i, weight: 0.85, name: 'explore' },
  { pattern: /\binvestigate\b/i, weight: 0.85, name: 'investigate' },
  { pattern: /\breview\b/i, weight: 0.7, name: 'review' },
  { pattern: /\bstudy\b/i, weight: 0.75, name: 'study' },
  { pattern: /\bresearch\b/i, weight: 0.8, name: 'research' },

  // Questions about state
  { pattern: /\bwhere is\b/i, weight: 0.7, name: 'where_is' },
  { pattern: /\bwhat is\b/i, weight: 0.65, name: 'what_is' },
  { pattern: /\bwhich\b.*\bbetter\b/i, weight: 0.8, name: 'which_better' },
  { pattern: /\bpros and cons\b/i, weight: 0.9, name: 'pros_cons' },
  { pattern: /\btradeoffs?\b/i, weight: 0.85, name: 'tradeoffs' },

  // Thinking/consideration
  { pattern: /\bthink about\b/i, weight: 0.75, name: 'think_about' },
  { pattern: /\bconsider\b/i, weight: 0.7, name: 'consider' },
  { pattern: /\bbrainstorm\b/i, weight: 0.85, name: 'brainstorm' },
];

/**
 * Patterns that indicate agent/action intent
 * These suggest the user wants to create, modify, or build something
 *
 * Key patterns: "create X" triggers agent mode for building/creating
 */
const AGENT_PATTERNS: Array<{ pattern: RegExp; weight: number; name: string }> = [
  // Creation - "create X" is the canonical agent mode trigger
  { pattern: /\bcreate\b/i, weight: 0.9, name: 'create' },
  { pattern: /\bbuild\b/i, weight: 0.9, name: 'build' },
  { pattern: /\bmake\b/i, weight: 0.85, name: 'make' },
  { pattern: /\bgenerate\b/i, weight: 0.85, name: 'generate' },
  { pattern: /\bwrite\b/i, weight: 0.8, name: 'write' },
  { pattern: /\bimplement\b/i, weight: 0.95, name: 'implement' },
  { pattern: /\bdevelop\b/i, weight: 0.85, name: 'develop' },
  { pattern: /\bdesign\b/i, weight: 0.75, name: 'design' },

  // Modification
  { pattern: /\badd\b/i, weight: 0.85, name: 'add' },
  { pattern: /\bupdate\b/i, weight: 0.9, name: 'update' },
  { pattern: /\bmodify\b/i, weight: 0.9, name: 'modify' },
  { pattern: /\bchange\b/i, weight: 0.8, name: 'change' },
  { pattern: /\bedit\b/i, weight: 0.85, name: 'edit' },
  { pattern: /\brefactor\b/i, weight: 0.95, name: 'refactor' },
  { pattern: /\brewrite\b/i, weight: 0.9, name: 'rewrite' },

  // Fixing
  { pattern: /\bfix\b/i, weight: 0.9, name: 'fix' },
  { pattern: /\brepair\b/i, weight: 0.9, name: 'repair' },
  { pattern: /\bresolve\b/i, weight: 0.85, name: 'resolve' },
  { pattern: /\bdebug\b/i, weight: 0.85, name: 'debug' },
  { pattern: /\bcorrect\b/i, weight: 0.8, name: 'correct' },

  // Removal
  { pattern: /\bremove\b/i, weight: 0.85, name: 'remove' },
  { pattern: /\bdelete\b/i, weight: 0.9, name: 'delete' },
  { pattern: /\bclean up\b/i, weight: 0.8, name: 'clean_up' },

  // Installation/setup
  { pattern: /\binstall\b/i, weight: 0.85, name: 'install' },
  { pattern: /\bsetup\b/i, weight: 0.85, name: 'setup' },
  { pattern: /\bset up\b/i, weight: 0.85, name: 'set_up' },
  { pattern: /\bconfigure\b/i, weight: 0.8, name: 'configure' },
  { pattern: /\binitialize\b/i, weight: 0.85, name: 'initialize' },

  // Execution
  { pattern: /\brun\b/i, weight: 0.75, name: 'run' },
  { pattern: /\bexecute\b/i, weight: 0.8, name: 'execute' },
  { pattern: /\bdeploy\b/i, weight: 0.9, name: 'deploy' },
  { pattern: /\blaunch\b/i, weight: 0.85, name: 'launch' },

  // Imperative forms
  { pattern: /^please\s+(create|build|make|add|fix|update)/i, weight: 0.95, name: 'please_action' },
  { pattern: /^can you\s+(create|build|make|add|fix|update)/i, weight: 0.9, name: 'can_you_action' },
  { pattern: /^i need\s+(a|an|to)\b/i, weight: 0.85, name: 'i_need' },
  { pattern: /^i want\s+(a|an|to)\b/i, weight: 0.85, name: 'i_want' },
];

// ============================================================================
// ModeRouter Class
// ============================================================================

/**
 * ModeRouter - Classifies user messages as plan or agent intent
 *
 * @example
 * ```typescript
 * const router = new ModeRouter();
 *
 * // Plan mode detection
 * router.classify('What if we used a different approach?');
 * // { mode: 'plan', confidence: 'high', score: 0.95, ... }
 *
 * // Agent mode detection
 * router.classify('Create a new login page');
 * // { mode: 'agent', confidence: 'high', score: 0.9, ... }
 * ```
 */
export class ModeRouter {
  private config: Required<Omit<ModeRouterConfig, 'llmClassifier'>> & { llmClassifier?: LLMClassifier };
  private planPatterns: Array<{ pattern: RegExp; weight: number; name: string }>;
  private agentPatterns: Array<{ pattern: RegExp; weight: number; name: string }>;
  private llmClassifier?: LLMClassifier;

  constructor(config: ModeRouterConfig = {}) {
    this.config = {
      defaultMode: config.defaultMode ?? 'agent',
      confidenceThreshold: config.confidenceThreshold ?? 0.5,
      llmFallbackThreshold: config.llmFallbackThreshold ?? 0.6,
      customPlanPatterns: config.customPlanPatterns ?? [],
      customAgentPatterns: config.customAgentPatterns ?? [],
    };
    this.llmClassifier = config.llmClassifier;

    // Combine default patterns with custom patterns
    this.planPatterns = [
      ...PLAN_PATTERNS,
      ...this.config.customPlanPatterns.map((p, i) => ({
        pattern: p,
        weight: 0.8,
        name: `custom_plan_${i}`,
      })),
    ];

    this.agentPatterns = [
      ...AGENT_PATTERNS,
      ...this.config.customAgentPatterns.map((p, i) => ({
        pattern: p,
        weight: 0.8,
        name: `custom_agent_${i}`,
      })),
    ];
  }

  /**
   * Classify a user message as plan or agent intent
   */
  classify(message: string): ClassificationResult {
    const normalizedMessage = this.normalizeMessage(message);

    // Find matching patterns for each mode
    const planMatches = this.findMatches(normalizedMessage, this.planPatterns);
    const agentMatches = this.findMatches(normalizedMessage, this.agentPatterns);

    // Calculate scores
    const planScore = this.calculateScore(planMatches);
    const agentScore = this.calculateScore(agentMatches);

    // Determine mode based on scores
    let mode: IntentMode;
    let score: number;
    let matchedPatterns: string[];

    if (planScore > agentScore) {
      mode = 'plan';
      score = planScore;
      matchedPatterns = planMatches.map(m => m.name);
    } else if (agentScore > planScore) {
      mode = 'agent';
      score = agentScore;
      matchedPatterns = agentMatches.map(m => m.name);
    } else {
      // Equal or no matches - use default
      mode = this.config.defaultMode;
      score = Math.max(planScore, agentScore, 0.3); // Minimum score for default
      matchedPatterns = [];
    }

    // Apply confidence threshold
    if (score < this.config.confidenceThreshold) {
      mode = this.config.defaultMode;
    }

    const confidence = this.scoreToConfidence(score);

    return {
      mode,
      confidence,
      score,
      matchedPatterns,
      message,
    };
  }

  /**
   * Classify with LLM fallback for low-confidence results
   *
   * Uses keyword matching first, then falls back to LLM if:
   * - Score is below llmFallbackThreshold
   * - LLM classifier is configured
   *
   * Keywords: explore/options/what-if → plan; create/build/add → agent
   */
  async classifyWithFallback(message: string): Promise<ClassificationResult> {
    // First try keyword matching
    const keywordResult = this.classify(message);

    // If confidence is high enough or no LLM available, return keyword result
    if (keywordResult.score >= this.config.llmFallbackThreshold || !this.llmClassifier) {
      return keywordResult;
    }

    // Try LLM fallback for low-confidence classifications
    try {
      const llmResult = await this.llmClassifier.classifyIntent(message);

      if (llmResult && llmResult.confidence > keywordResult.score) {
        return {
          mode: llmResult.mode,
          confidence: this.scoreToConfidence(llmResult.confidence),
          score: llmResult.confidence,
          matchedPatterns: [...keywordResult.matchedPatterns, 'llm_fallback'],
          message,
        };
      }
    } catch {
      // LLM failed, use keyword result
    }

    return keywordResult;
  }

  /**
   * Set or update the LLM classifier
   */
  setLLMClassifier(classifier: LLMClassifier): void {
    this.llmClassifier = classifier;
  }

  /**
   * Check if LLM fallback is available
   */
  hasLLMFallback(): boolean {
    return this.llmClassifier !== undefined;
  }

  /**
   * Quick check if message is plan mode
   */
  isPlanMode(message: string): boolean {
    return this.classify(message).mode === 'plan';
  }

  /**
   * Quick check if message is agent mode
   */
  isAgentMode(message: string): boolean {
    return this.classify(message).mode === 'agent';
  }

  /**
   * Get the mode with a simple boolean for plan mode
   */
  getMode(message: string): { mode: IntentMode; planMode: boolean } {
    const result = this.classify(message);
    return {
      mode: result.mode,
      planMode: result.mode === 'plan',
    };
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private normalizeMessage(message: string): string {
    return message
      .trim()
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove punctuation
      .replace(/\s+/g, ' ');     // Normalize whitespace
  }

  private findMatches(
    message: string,
    patterns: Array<{ pattern: RegExp; weight: number; name: string }>
  ): Array<{ pattern: RegExp; weight: number; name: string }> {
    return patterns.filter(p => p.pattern.test(message));
  }

  private calculateScore(
    matches: Array<{ pattern: RegExp; weight: number; name: string }>
  ): number {
    if (matches.length === 0) return 0;

    // Use highest weight match as base, add diminishing returns for additional matches
    const sortedWeights = matches.map(m => m.weight).sort((a, b) => b - a);
    let score = sortedWeights[0];

    // Add diminishing bonus for additional matches
    for (let i = 1; i < sortedWeights.length; i++) {
      score += sortedWeights[i] * 0.1 * (1 / (i + 1));
    }

    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  private scoreToConfidence(score: number): ConfidenceLevel {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ModeRouter instance
 */
export function createModeRouter(config?: ModeRouterConfig): ModeRouter {
  return new ModeRouter(config);
}

/**
 * Quick classification without creating an instance
 */
export function classifyIntent(message: string): ClassificationResult {
  const router = new ModeRouter();
  return router.classify(message);
}

// ============================================================================
// Exports
// ============================================================================

export default ModeRouter;
export type { LLMClassifier };

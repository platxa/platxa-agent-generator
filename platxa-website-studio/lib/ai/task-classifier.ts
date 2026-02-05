/**
 * TaskClassifier - Analyzes user requests to determine task type
 *
 * Uses pattern matching and keyword analysis to classify natural language
 * requests into task types for optimal model routing.
 *
 * Feature #37: Multi-Model Orchestration - Task Classification
 */

import type { TaskType } from "./model-orchestrator";

// =============================================================================
// Types
// =============================================================================

/** Classification result with confidence scores */
export interface ClassificationResult {
  /** Primary detected task type */
  primaryType: TaskType;
  /** Confidence score (0-100) */
  confidence: number;
  /** Secondary task types that might also apply */
  secondaryTypes: Array<{ type: TaskType; confidence: number }>;
  /** Detected keywords that influenced classification */
  detectedKeywords: string[];
  /** Whether the request is ambiguous */
  isAmbiguous: boolean;
  /** Suggested clarification if ambiguous */
  clarificationHint?: string;
}

/** Classification patterns for each task type */
interface TaskPattern {
  /** Keywords that strongly indicate this task type */
  keywords: string[];
  /** Regex patterns for more complex matching */
  patterns: RegExp[];
  /** Negative keywords that decrease likelihood */
  negativeKeywords?: string[];
  /** Base weight for this task type */
  baseWeight: number;
}

// =============================================================================
// Classification Patterns
// =============================================================================

const TASK_PATTERNS: Record<TaskType, TaskPattern> = {
  planning: {
    keywords: [
      "plan",
      "design",
      "architect",
      "structure",
      "organize",
      "outline",
      "strategy",
      "approach",
      "roadmap",
      "breakdown",
      "steps",
      "phases",
      "milestones",
      "requirements",
      "spec",
      "specification",
      "proposal",
      "rfc",
      "adr",
      "think through",
      "figure out",
      "how should",
      "what's the best way",
      "help me decide",
    ],
    patterns: [
      /how (?:should|would|can) (?:i|we) (?:approach|structure|organize|design)/i,
      /(?:create|write|draft) (?:a )?(?:plan|spec|proposal|outline)/i,
      /break(?:ing)? (?:down|this down|it down)/i,
      /what(?:'s| is) the (?:best|right|optimal) (?:way|approach|strategy)/i,
      /help (?:me )?(?:plan|design|architect)/i,
    ],
    baseWeight: 1.0,
  },

  code_generation: {
    keywords: [
      "write",
      "create",
      "generate",
      "implement",
      "build",
      "code",
      "function",
      "class",
      "component",
      "module",
      "api",
      "endpoint",
      "script",
      "program",
      "add",
      "make",
      "develop",
    ],
    patterns: [
      /(?:write|create|generate|implement|build) (?:a |the |an )?(?:function|class|component|module|api|script)/i,
      /(?:add|create|implement) (?:a |an )?(?:new )?(?:feature|endpoint|route|handler)/i,
      /(?:can you |please )?(?:code|write|create) (?:this|that|a|the)/i,
      /implement(?:ing)? (?:the |a )?/i,
    ],
    negativeKeywords: ["review", "fix", "debug", "test", "explain"],
    baseWeight: 1.0,
  },

  code_review: {
    keywords: [
      "review",
      "check",
      "audit",
      "analyze",
      "inspect",
      "evaluate",
      "assess",
      "critique",
      "feedback",
      "improve",
      "optimize",
      "refactor",
      "clean up",
      "best practices",
      "suggestions",
      "issues",
      "problems",
    ],
    patterns: [
      /(?:review|check|audit|analyze|inspect) (?:this |my |the )?(?:code|implementation|function|component)/i,
      /(?:what|any) (?:issues|problems|improvements)/i,
      /(?:can you |please )?(?:review|check|look at|analyze)/i,
      /(?:is this |does this |am i) (?:correct|right|good|okay|ok)/i,
      /how (?:can|could|should) (?:i|we) improve/i,
    ],
    baseWeight: 1.0,
  },

  design_analysis: {
    keywords: [
      "design",
      "ui",
      "ux",
      "layout",
      "visual",
      "color",
      "typography",
      "spacing",
      "style",
      "aesthetic",
      "look",
      "feel",
      "appearance",
      "mockup",
      "wireframe",
      "prototype",
      "brand",
      "theme",
    ],
    patterns: [
      /(?:analyze|review|check|improve) (?:the |this |my )?(?:design|ui|ux|layout|style)/i,
      /(?:what|how) (?:should|could|would) (?:it|this|the) (?:look|appear|be styled)/i,
      /(?:design|create|make) (?:a |the )?(?:ui|interface|layout|page|component)/i,
      /(?:color|typography|spacing|style) (?:suggestions|recommendations|advice)/i,
    ],
    baseWeight: 0.9,
  },

  content_writing: {
    keywords: [
      "write",
      "content",
      "copy",
      "text",
      "description",
      "headline",
      "tagline",
      "bio",
      "about",
      "blog",
      "article",
      "post",
      "email",
      "message",
      "documentation",
      "docs",
      "readme",
      "guide",
      "tutorial",
      "instructions",
    ],
    patterns: [
      /(?:write|create|draft|compose) (?:a |the |an )?(?:description|headline|tagline|bio|about|blog|article|post|email)/i,
      /(?:help (?:me )?)?(?:write|create|draft) (?:content|copy|text|documentation)/i,
      /(?:what should|how should) (?:i|we) (?:write|say|describe)/i,
    ],
    negativeKeywords: ["code", "function", "component", "api"],
    baseWeight: 0.9,
  },

  translation: {
    keywords: [
      "translate",
      "translation",
      "convert",
      "localize",
      "localization",
      "i18n",
      "internationalization",
      "language",
      "spanish",
      "french",
      "german",
      "chinese",
      "japanese",
      "portuguese",
      "italian",
      "korean",
      "arabic",
      "russian",
    ],
    patterns: [
      /translate (?:this |the |to |into )/i,
      /(?:convert|change) (?:to|into) (?:spanish|french|german|chinese|japanese)/i,
      /(?:in |to )(?:spanish|french|german|chinese|japanese|portuguese|italian|korean|arabic|russian)/i,
    ],
    baseWeight: 1.2,
  },

  summarization: {
    keywords: [
      "summarize",
      "summary",
      "tldr",
      "brief",
      "condense",
      "shorten",
      "key points",
      "main points",
      "highlights",
      "overview",
      "gist",
      "essence",
    ],
    patterns: [
      /(?:summarize|give (?:me )?(?:a )?summary|tldr)/i,
      /(?:what are|give me) (?:the )?(?:key|main|important) (?:points|takeaways)/i,
      /(?:condense|shorten|brief) (?:this|the)/i,
    ],
    baseWeight: 1.1,
  },

  chat: {
    keywords: [
      "hi",
      "hello",
      "hey",
      "thanks",
      "thank you",
      "please",
      "help",
      "question",
      "wondering",
      "curious",
      "what",
      "why",
      "how",
      "when",
      "where",
      "who",
      "explain",
      "tell me",
      "show me",
    ],
    patterns: [
      /^(?:hi|hello|hey|thanks|thank you)(?:\s|!|,|\.)?/i,
      /(?:can you |could you |would you )?(?:help|explain|tell me|show me)/i,
      /(?:what|why|how|when|where|who) (?:is|are|was|were|do|does|did|can|could|would|should)/i,
      /^(?:i |we |my |our )?(?:have a |got a )?question/i,
    ],
    baseWeight: 0.7,
  },

  image_analysis: {
    keywords: [
      "image",
      "picture",
      "photo",
      "screenshot",
      "visual",
      "see",
      "look at",
      "analyze image",
      "describe image",
      "what's in",
      "ocr",
      "read text",
      "extract",
    ],
    patterns: [
      /(?:analyze|describe|explain|look at) (?:this |the )?(?:image|picture|photo|screenshot)/i,
      /what(?:'s| is) (?:in |on )?(?:this |the )?(?:image|picture|photo|screenshot)/i,
      /(?:can you |please )?(?:see|read|extract|ocr)/i,
    ],
    baseWeight: 1.3,
  },

  structured_output: {
    keywords: [
      "json",
      "yaml",
      "xml",
      "csv",
      "schema",
      "format",
      "structure",
      "parse",
      "extract",
      "convert to",
      "output as",
      "return as",
      "give me",
      "data",
      "table",
      "list",
    ],
    patterns: [
      /(?:return|output|format|convert|give) (?:it |this |the result )?(?:as |in )?(?:json|yaml|xml|csv)/i,
      /(?:create|generate|make) (?:a )?(?:json|yaml|xml|csv|schema)/i,
      /(?:extract|parse) (?:the )?(?:data|information|fields)/i,
      /(?:structured|formatted) (?:output|response|data)/i,
    ],
    baseWeight: 1.1,
  },

  reasoning: {
    keywords: [
      "think",
      "reason",
      "analyze",
      "logic",
      "deduce",
      "infer",
      "conclude",
      "prove",
      "verify",
      "validate",
      "math",
      "calculate",
      "solve",
      "complex",
      "difficult",
      "challenging",
      "puzzle",
      "problem",
    ],
    patterns: [
      /(?:think|reason) (?:through|about|carefully)/i,
      /(?:solve|calculate|compute|work out) (?:this |the )?(?:problem|equation|puzzle)/i,
      /(?:prove|verify|validate|confirm) (?:that|this|whether)/i,
      /(?:what|why) (?:would|should|could) (?:happen|be|result)/i,
      /step[- ]by[- ]step/i,
    ],
    baseWeight: 1.0,
  },

  fast_response: {
    keywords: [
      "quick",
      "fast",
      "brief",
      "short",
      "simple",
      "easy",
      "basic",
      "just",
      "only",
      "quickly",
      "asap",
      "urgent",
    ],
    patterns: [
      /(?:quick|fast|brief|short|simple) (?:question|answer|response)/i,
      /(?:just|only) (?:tell me|give me|need)/i,
      /(?:asap|urgent|quickly)/i,
    ],
    negativeKeywords: ["complex", "detailed", "thorough", "comprehensive"],
    baseWeight: 0.8,
  },
};

// =============================================================================
// TaskClassifier Class
// =============================================================================

/**
 * TaskClassifier analyzes natural language requests and determines the
 * appropriate task type for optimal model routing.
 *
 * @example
 * ```typescript
 * const classifier = new TaskClassifier();
 *
 * const result = classifier.classify("Write a function that calculates fibonacci");
 * console.log(result.primaryType); // "code_generation"
 * console.log(result.confidence); // 85
 *
 * const result2 = classifier.classify("Review my code for best practices");
 * console.log(result2.primaryType); // "code_review"
 * ```
 */
export class TaskClassifier {
  private patterns: Record<TaskType, TaskPattern>;
  private ambiguityThreshold: number;
  private confidenceThreshold: number;

  constructor(options: {
    ambiguityThreshold?: number;
    confidenceThreshold?: number;
    customPatterns?: Partial<Record<TaskType, Partial<TaskPattern>>>;
  } = {}) {
    this.ambiguityThreshold = options.ambiguityThreshold ?? 15;
    this.confidenceThreshold = options.confidenceThreshold ?? 30;

    // Merge custom patterns with defaults
    this.patterns = { ...TASK_PATTERNS };
    if (options.customPatterns) {
      for (const [type, customPattern] of Object.entries(options.customPatterns)) {
        const taskType = type as TaskType;
        if (this.patterns[taskType] && customPattern) {
          this.patterns[taskType] = {
            ...this.patterns[taskType],
            ...customPattern,
            keywords: [
              ...this.patterns[taskType].keywords,
              ...(customPattern.keywords || []),
            ],
            patterns: [
              ...this.patterns[taskType].patterns,
              ...(customPattern.patterns || []),
            ],
          };
        }
      }
    }
  }

  /**
   * Classify a user request into a task type
   */
  classify(request: string): ClassificationResult {
    const normalizedRequest = this.normalizeText(request);
    const scores = this.calculateScores(normalizedRequest);

    // Sort by score descending
    const sortedScores = Object.entries(scores)
      .map(([type, data]) => ({ type: type as TaskType, ...data }))
      .sort((a, b) => b.score - a.score);

    const primary = sortedScores[0];
    const secondary = sortedScores.slice(1, 4).filter((s) => s.score > this.confidenceThreshold);

    // Check for ambiguity
    const isAmbiguous =
      sortedScores.length > 1 &&
      primary.score - sortedScores[1].score < this.ambiguityThreshold &&
      sortedScores[1].score > this.confidenceThreshold;

    // Normalize confidence to 0-100
    const maxPossibleScore = 100;
    const confidence = Math.min(100, Math.round((primary.score / maxPossibleScore) * 100));

    const result: ClassificationResult = {
      primaryType: primary.type,
      confidence,
      secondaryTypes: secondary.map((s) => ({
        type: s.type,
        confidence: Math.min(100, Math.round((s.score / maxPossibleScore) * 100)),
      })),
      detectedKeywords: primary.matchedKeywords,
      isAmbiguous,
    };

    if (isAmbiguous) {
      result.clarificationHint = this.generateClarificationHint(
        primary.type,
        sortedScores[1].type
      );
    }

    return result;
  }

  /**
   * Quick classification that returns just the task type
   */
  quickClassify(request: string): TaskType {
    return this.classify(request).primaryType;
  }

  /**
   * Check if a request matches a specific task type
   */
  isTaskType(request: string, taskType: TaskType): boolean {
    const result = this.classify(request);
    return result.primaryType === taskType && result.confidence >= this.confidenceThreshold;
  }

  /**
   * Get all detected keywords for debugging
   */
  getDetectedKeywords(request: string): Record<TaskType, string[]> {
    const normalizedRequest = this.normalizeText(request);
    const result: Record<TaskType, string[]> = {} as Record<TaskType, string[]>;

    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matched = this.findMatchedKeywords(normalizedRequest, pattern);
      result[type as TaskType] = matched;
    }

    return result;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private calculateScores(
    request: string
  ): Record<TaskType, { score: number; matchedKeywords: string[] }> {
    const scores = {} as Record<TaskType, { score: number; matchedKeywords: string[] }>;

    for (const [type, pattern] of Object.entries(this.patterns)) {
      const taskType = type as TaskType;
      const matchedKeywords = this.findMatchedKeywords(request, pattern);
      let score = 0;

      // Keyword matching
      score += matchedKeywords.length * 15;

      // Pattern matching (higher weight)
      for (const regex of pattern.patterns) {
        if (regex.test(request)) {
          score += 25;
        }
      }

      // Negative keywords (reduce score)
      if (pattern.negativeKeywords) {
        for (const negKeyword of pattern.negativeKeywords) {
          if (request.includes(negKeyword)) {
            score -= 10;
          }
        }
      }

      // Apply base weight
      score *= pattern.baseWeight;

      // Ensure non-negative
      score = Math.max(0, score);

      scores[taskType] = { score, matchedKeywords };
    }

    return scores;
  }

  private findMatchedKeywords(request: string, pattern: TaskPattern): string[] {
    const matched: string[] = [];

    for (const keyword of pattern.keywords) {
      // Check for whole word match or phrase match
      const keywordRegex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, "i");
      if (keywordRegex.test(request)) {
        matched.push(keyword);
      }
    }

    return matched;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private generateClarificationHint(type1: TaskType, type2: TaskType): string {
    const hints: Record<string, string> = {
      "planning-code_generation":
        "Are you looking to plan/design the solution, or should I write the code directly?",
      "code_generation-code_review":
        "Should I write new code or review existing code?",
      "design_analysis-content_writing":
        "Are you asking about visual design or written content?",
      "chat-reasoning":
        "Is this a quick question or do you need detailed analysis?",
      "summarization-content_writing":
        "Should I summarize existing content or create new content?",
    };

    const key = `${type1}-${type2}`;
    const reverseKey = `${type2}-${type1}`;

    return (
      hints[key] ||
      hints[reverseKey] ||
      `This could be ${type1.replace("_", " ")} or ${type2.replace("_", " ")}. Could you clarify?`
    );
  }
}

// =============================================================================
// Singleton and Convenience Functions
// =============================================================================

let _classifier: TaskClassifier | null = null;

/**
 * Get the global TaskClassifier instance
 */
export function getClassifier(): TaskClassifier {
  if (!_classifier) {
    _classifier = new TaskClassifier();
  }
  return _classifier;
}

/**
 * Reset the global classifier instance
 */
export function resetClassifier(): void {
  _classifier = null;
}

/**
 * Quick classify a request
 */
export function classifyTask(request: string): ClassificationResult {
  return getClassifier().classify(request);
}

/**
 * Get just the task type
 */
export function getTaskType(request: string): TaskType {
  return getClassifier().quickClassify(request);
}

export default TaskClassifier;

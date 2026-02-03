/**
 * Fix Confidence Scoring
 *
 * Feature #149: Implement fix confidence scoring based on pattern match quality
 * Verification: Score 0-100 based on: pattern match (40), context clarity (30), fix simplicity (30)
 */

// ============================================================================
// Types
// ============================================================================

/** Confidence score category */
export type ScoreCategory = "pattern-match" | "context-clarity" | "fix-simplicity";

/** Score weight configuration */
export interface ScoreWeights {
  /** Pattern match weight (default 40) */
  patternMatch: number;
  /** Context clarity weight (default 30) */
  contextClarity: number;
  /** Fix simplicity weight (default 30) */
  fixSimplicity: number;
}

/** Pattern match factors */
export interface PatternMatchFactors {
  /** Index signature for Record compatibility */
  [key: string]: number;
  /** Regex match specificity (0-1) */
  matchSpecificity: number;
  /** Number of patterns matched (0-1) */
  patternCoverage: number;
  /** Message similarity to known patterns (0-1) */
  messageSimilarity: number;
  /** Error type recognition (0-1) */
  typeRecognition: number;
}

/** Context clarity factors */
export interface ContextClarityFactors {
  /** Index signature for Record compatibility */
  [key: string]: number;
  /** File location available (0-1) */
  hasFileLocation: number;
  /** Line number available (0-1) */
  hasLineNumber: number;
  /** Stack trace available (0-1) */
  hasStackTrace: number;
  /** Surrounding code context (0-1) */
  hasCodeContext: number;
  /** Error message clarity (0-1) */
  messageClarity: number;
}

/** Fix simplicity factors */
export interface FixSimplicityFactors {
  /** Index signature for Record compatibility */
  [key: string]: number;
  /** Single file change (0-1) */
  isSingleFile: number;
  /** Few lines to change (0-1) */
  fewLinesChanged: number;
  /** No external dependencies (0-1) */
  noExternalDeps: number;
  /** Clear fix instructions (0-1) */
  clearInstructions: number;
  /** Reversible fix (0-1) */
  isReversible: number;
}

/** Complete scoring factors */
export interface ScoringFactors {
  /** Pattern match factors */
  patternMatch: PatternMatchFactors;
  /** Context clarity factors */
  contextClarity: ContextClarityFactors;
  /** Fix simplicity factors */
  fixSimplicity: FixSimplicityFactors;
}

/** Category score breakdown */
export interface CategoryScore {
  /** Category name */
  category: ScoreCategory;
  /** Raw score (0-1) */
  rawScore: number;
  /** Weight applied */
  weight: number;
  /** Weighted score (rawScore * weight) */
  weightedScore: number;
  /** Individual factor scores */
  factors: Record<string, number>;
}

/** Complete confidence score */
export interface ConfidenceScore {
  /** Total score (0-100) */
  total: number;
  /** Score grade */
  grade: ScoreGrade;
  /** Category breakdown */
  categories: CategoryScore[];
  /** Confidence level description */
  level: ConfidenceLevel;
  /** Human-readable summary */
  summary: string;
  /** Timestamp */
  timestamp: number;
}

/** Score grade */
export type ScoreGrade = "A" | "B" | "C" | "D" | "F";

/** Confidence level */
export type ConfidenceLevel = "very-high" | "high" | "medium" | "low" | "very-low";

/** Error input for scoring */
export interface ErrorForScoring {
  /** Error message */
  message: string;
  /** Error type */
  type?: string;
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Stack trace */
  stack?: string;
  /** Surrounding code */
  codeContext?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/** Fix suggestion for scoring */
export interface FixForScoring {
  /** Fix description */
  description: string;
  /** Files to modify */
  files?: string[];
  /** Estimated lines changed */
  linesChanged?: number;
  /** Fix code/instructions */
  code?: string;
  /** External dependencies required */
  dependencies?: string[];
  /** Is the fix reversible */
  reversible?: boolean;
  /** Fix complexity (1-5) */
  complexity?: number;
}

/** Scorer options */
export interface FixConfidenceScorerOptions {
  /** Custom weights */
  weights?: Partial<ScoreWeights>;
  /** Known error patterns for matching */
  knownPatterns?: RegExp[];
  /** Minimum score for "confident" */
  confidenceThreshold?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default score weights */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  patternMatch: 40,
  contextClarity: 30,
  fixSimplicity: 30,
};

/** Grade thresholds */
export const GRADE_THRESHOLDS: Record<ScoreGrade, number> = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
  F: 0,
};

/** Confidence level thresholds */
export const CONFIDENCE_THRESHOLDS: Record<ConfidenceLevel, number> = {
  "very-high": 90,
  "high": 75,
  "medium": 50,
  "low": 25,
  "very-low": 0,
};

/** Common error patterns for recognition */
export const COMMON_ERROR_PATTERNS: RegExp[] = [
  // JavaScript/TypeScript
  /TypeError:/i,
  /ReferenceError:/i,
  /SyntaxError:/i,
  /RangeError:/i,
  /undefined is not/i,
  /null is not/i,
  /Cannot read propert/i,
  /is not a function/i,
  /is not defined/i,
  // CSS/SCSS
  /Invalid CSS/i,
  /Unknown property/i,
  /Unexpected token/i,
  /Invalid selector/i,
  // QWeb/Template
  /QWeb.*error/i,
  /template.*not found/i,
  /directive.*invalid/i,
  /t-foreach.*requires/i,
  // Network
  /Failed to fetch/i,
  /Network error/i,
  /CORS/i,
  /timeout/i,
  // Build
  /Module not found/i,
  /Cannot resolve/i,
  /Compilation error/i,
];

/** Lines changed thresholds */
export const LINES_CHANGED_THRESHOLDS = {
  few: 10,
  moderate: 50,
  many: 100,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate string similarity (0-1)
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Count regex matches in text
 */
export function countPatternMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

/**
 * Get match specificity (0-1) based on pattern complexity
 */
export function getMatchSpecificity(pattern: RegExp, text: string): number {
  const match = text.match(pattern);
  if (!match) return 0;

  // More specific patterns have longer matches relative to text
  const matchRatio = match[0].length / text.length;
  // Patterns with more characters are more specific
  const patternComplexity = Math.min(1, pattern.source.length / 50);

  return (matchRatio + patternComplexity) / 2;
}

/**
 * Calculate message clarity (0-1)
 */
export function calculateMessageClarity(message: string): number {
  let score = 0;

  // Has specific error type
  if (/\w+Error:/.test(message)) score += 0.2;

  // Has file/location info
  if (/at\s+\S+:\d+/.test(message) || /\.\w+:\d+/.test(message)) score += 0.2;

  // Has actionable keywords
  if (/missing|undefined|invalid|cannot|failed|unexpected/i.test(message)) score += 0.2;

  // Has specific values (quoted strings, numbers)
  if (/"[^"]+"|'[^']+'|\d+/.test(message)) score += 0.2;

  // Reasonable length (not too short, not too long)
  if (message.length >= 20 && message.length <= 500) score += 0.2;

  return score;
}

/**
 * Get grade from score
 */
export function getGrade(score: number): ScoreGrade {
  if (score >= GRADE_THRESHOLDS.A) return "A";
  if (score >= GRADE_THRESHOLDS.B) return "B";
  if (score >= GRADE_THRESHOLDS.C) return "C";
  if (score >= GRADE_THRESHOLDS.D) return "D";
  return "F";
}

/**
 * Get confidence level from score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS["very-high"]) return "very-high";
  if (score >= CONFIDENCE_THRESHOLDS["high"]) return "high";
  if (score >= CONFIDENCE_THRESHOLDS["medium"]) return "medium";
  if (score >= CONFIDENCE_THRESHOLDS["low"]) return "low";
  return "very-low";
}

/**
 * Generate summary from score
 */
export function generateSummary(score: number, categories: CategoryScore[]): string {
  const level = getConfidenceLevel(score);
  const grade = getGrade(score);

  const weakest = categories.reduce((min, cat) =>
    cat.rawScore < min.rawScore ? cat : min
  );

  const strongest = categories.reduce((max, cat) =>
    cat.rawScore > max.rawScore ? cat : max
  );

  let summary = `Confidence: ${Math.round(score)}% (Grade ${grade}, ${level.replace("-", " ")}). `;

  if (level === "very-high" || level === "high") {
    summary += `Strong ${strongest.category.replace("-", " ")} score.`;
  } else if (level === "medium") {
    summary += `Consider improving ${weakest.category.replace("-", " ")}.`;
  } else {
    summary += `Low confidence due to weak ${weakest.category.replace("-", " ")}.`;
  }

  return summary;
}

/**
 * Normalize weights to sum to 100
 */
export function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const sum = weights.patternMatch + weights.contextClarity + weights.fixSimplicity;
  if (sum === 0) return DEFAULT_WEIGHTS;

  const factor = 100 / sum;
  return {
    patternMatch: weights.patternMatch * factor,
    contextClarity: weights.contextClarity * factor,
    fixSimplicity: weights.fixSimplicity * factor,
  };
}

/**
 * Clamp value between 0 and 1
 */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Average of factors
 */
export function averageFactors(factors: Record<string, number>): number {
  const values = Object.values(factors);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ============================================================================
// FixConfidenceScorer Class
// ============================================================================

/**
 * Confidence scorer for fix suggestions
 */
export class FixConfidenceScorer {
  private weights: ScoreWeights;
  private knownPatterns: RegExp[];
  private confidenceThreshold: number;
  private disposed = false;

  constructor(options: FixConfidenceScorerOptions = {}) {
    this.weights = normalizeWeights({
      ...DEFAULT_WEIGHTS,
      ...options.weights,
    });
    this.knownPatterns = options.knownPatterns ?? COMMON_ERROR_PATTERNS;
    this.confidenceThreshold = options.confidenceThreshold ?? 70;
  }

  /**
   * Score a fix suggestion
   */
  score(error: ErrorForScoring, fix: FixForScoring): ConfidenceScore {
    if (this.disposed) {
      throw new Error("FixConfidenceScorer is disposed");
    }

    const patternMatchScore = this.scorePatternMatch(error);
    const contextClarityScore = this.scoreContextClarity(error);
    const fixSimplicityScore = this.scoreFixSimplicity(fix);

    const categories: CategoryScore[] = [
      {
        category: "pattern-match",
        rawScore: patternMatchScore.raw,
        weight: this.weights.patternMatch,
        weightedScore: patternMatchScore.raw * this.weights.patternMatch,
        factors: patternMatchScore.factors,
      },
      {
        category: "context-clarity",
        rawScore: contextClarityScore.raw,
        weight: this.weights.contextClarity,
        weightedScore: contextClarityScore.raw * this.weights.contextClarity,
        factors: contextClarityScore.factors,
      },
      {
        category: "fix-simplicity",
        rawScore: fixSimplicityScore.raw,
        weight: this.weights.fixSimplicity,
        weightedScore: fixSimplicityScore.raw * this.weights.fixSimplicity,
        factors: fixSimplicityScore.factors,
      },
    ];

    const total = categories.reduce((sum, cat) => sum + cat.weightedScore, 0);

    return {
      total,
      grade: getGrade(total),
      categories,
      level: getConfidenceLevel(total),
      summary: generateSummary(total, categories),
      timestamp: Date.now(),
    };
  }

  /**
   * Score multiple fixes and rank them
   */
  scoreAndRank(
    error: ErrorForScoring,
    fixes: FixForScoring[]
  ): Array<{ fix: FixForScoring; score: ConfidenceScore }> {
    const scored = fixes.map((fix) => ({
      fix,
      score: this.score(error, fix),
    }));

    return scored.sort((a, b) => b.score.total - a.score.total);
  }

  /**
   * Check if fix meets confidence threshold
   */
  isConfident(score: ConfidenceScore): boolean {
    return score.total >= this.confidenceThreshold;
  }

  /**
   * Get best fix from list
   */
  getBestFix(
    error: ErrorForScoring,
    fixes: FixForScoring[]
  ): { fix: FixForScoring; score: ConfidenceScore } | null {
    if (fixes.length === 0) return null;

    const ranked = this.scoreAndRank(error, fixes);
    return ranked[0];
  }

  /**
   * Get confident fixes only
   */
  getConfidentFixes(
    error: ErrorForScoring,
    fixes: FixForScoring[]
  ): Array<{ fix: FixForScoring; score: ConfidenceScore }> {
    return this.scoreAndRank(error, fixes).filter((r) =>
      this.isConfident(r.score)
    );
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: RegExp): void {
    if (this.disposed) {
      throw new Error("FixConfidenceScorer is disposed");
    }
    this.knownPatterns.push(pattern);
  }

  /**
   * Set confidence threshold
   */
  setThreshold(threshold: number): void {
    this.confidenceThreshold = clamp01(threshold / 100) * 100;
  }

  /**
   * Get current weights
   */
  getWeights(): ScoreWeights {
    return { ...this.weights };
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.knownPatterns = [];
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private scorePatternMatch(error: ErrorForScoring): {
    raw: number;
    factors: Record<string, number>;
  } {
    const factors: PatternMatchFactors = {
      matchSpecificity: 0,
      patternCoverage: 0,
      messageSimilarity: 0,
      typeRecognition: 0,
    };

    // Match specificity - how well do patterns match
    const matchingPatterns = this.knownPatterns.filter((p) =>
      p.test(error.message)
    );
    if (matchingPatterns.length > 0) {
      factors.matchSpecificity = Math.max(
        ...matchingPatterns.map((p) => getMatchSpecificity(p, error.message))
      );
    }

    // Pattern coverage - what fraction of known patterns match
    factors.patternCoverage = Math.min(
      1,
      matchingPatterns.length / Math.max(1, this.knownPatterns.length / 10)
    );

    // Message similarity to error type patterns
    if (error.type) {
      const typePattern = new RegExp(error.type, "i");
      factors.messageSimilarity = typePattern.test(error.message) ? 1 : 0.5;
    } else {
      factors.messageSimilarity = /\w+Error:/.test(error.message) ? 0.8 : 0.3;
    }

    // Type recognition
    factors.typeRecognition = error.type ? 1 : (/\w+Error/.test(error.message) ? 0.7 : 0.3);

    return {
      raw: clamp01(averageFactors(factors)),
      factors: factors as unknown as Record<string, number>,
    };
  }

  private scoreContextClarity(error: ErrorForScoring): {
    raw: number;
    factors: Record<string, number>;
  } {
    const factors: ContextClarityFactors = {
      hasFileLocation: error.file ? 1 : 0,
      hasLineNumber: error.line !== undefined ? 1 : 0,
      hasStackTrace: error.stack ? 1 : 0,
      hasCodeContext: error.codeContext ? 1 : 0,
      messageClarity: calculateMessageClarity(error.message),
    };

    return {
      raw: clamp01(averageFactors(factors)),
      factors: factors as unknown as Record<string, number>,
    };
  }

  private scoreFixSimplicity(fix: FixForScoring): {
    raw: number;
    factors: Record<string, number>;
  } {
    const factors: FixSimplicityFactors = {
      isSingleFile: 0,
      fewLinesChanged: 0,
      noExternalDeps: 0,
      clearInstructions: 0,
      isReversible: 0,
    };

    // Single file change
    if (fix.files) {
      factors.isSingleFile = fix.files.length === 1 ? 1 : Math.max(0, 1 - (fix.files.length - 1) * 0.2);
    } else {
      factors.isSingleFile = 0.5; // Unknown
    }

    // Few lines changed
    if (fix.linesChanged !== undefined) {
      if (fix.linesChanged <= LINES_CHANGED_THRESHOLDS.few) {
        factors.fewLinesChanged = 1;
      } else if (fix.linesChanged <= LINES_CHANGED_THRESHOLDS.moderate) {
        factors.fewLinesChanged = 0.7;
      } else if (fix.linesChanged <= LINES_CHANGED_THRESHOLDS.many) {
        factors.fewLinesChanged = 0.4;
      } else {
        factors.fewLinesChanged = 0.2;
      }
    } else {
      factors.fewLinesChanged = 0.5; // Unknown
    }

    // No external dependencies
    if (fix.dependencies) {
      factors.noExternalDeps = fix.dependencies.length === 0 ? 1 : Math.max(0, 1 - fix.dependencies.length * 0.3);
    } else {
      factors.noExternalDeps = 0.8; // Assume no deps if not specified
    }

    // Clear instructions
    if (fix.description) {
      factors.clearInstructions = fix.description.length >= 10 ? 1 : 0.5;
      if (fix.code) {
        factors.clearInstructions = 1; // Has code example
      }
    } else {
      factors.clearInstructions = 0;
    }

    // Reversible
    factors.isReversible = fix.reversible === true ? 1 : (fix.reversible === false ? 0 : 0.5);

    // Adjust based on complexity
    if (fix.complexity !== undefined) {
      const complexityPenalty = (fix.complexity - 1) / 4; // 0 for complexity 1, 1 for complexity 5
      const rawScore = averageFactors(factors);
      return {
        raw: clamp01(rawScore * (1 - complexityPenalty * 0.3)),
        factors: factors as unknown as Record<string, number>,
      };
    }

    return {
      raw: clamp01(averageFactors(factors)),
      factors: factors as unknown as Record<string, number>,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new FixConfidenceScorer instance
 */
export function createFixConfidenceScorer(
  options?: FixConfidenceScorerOptions
): FixConfidenceScorer {
  return new FixConfidenceScorer(options);
}

/**
 * Quality Score Display for generation completion
 *
 * Feature #112: Create quality score display after generation completion
 * Verification: Shows 'Quality: 85/100' with breakdown (syntax, a11y, structure)
 */

// ============================================================================
// Types
// ============================================================================

/** Quality check categories */
export type QualityCategory = "syntax" | "a11y" | "structure" | "performance" | "seo" | "security";

/** Individual quality check result */
export interface QualityCheck {
  /** Category of the check */
  category: QualityCategory;
  /** Check identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Score from 0-100 */
  score: number;
  /** Weight for this check (0-1) */
  weight: number;
  /** Pass/fail status */
  passed: boolean;
  /** Optional message */
  message?: string;
  /** Specific issues found */
  issues?: QualityIssue[];
}

/** Quality issue details */
export interface QualityIssue {
  /** Issue severity */
  severity: "error" | "warning" | "info";
  /** Issue message */
  message: string;
  /** Location in code (if applicable) */
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  /** Suggested fix */
  suggestion?: string;
}

/** Category score summary */
export interface CategoryScore {
  /** Category name */
  category: QualityCategory;
  /** Display label */
  label: string;
  /** Weighted score for this category (0-100) */
  score: number;
  /** Number of checks in this category */
  checkCount: number;
  /** Number of passed checks */
  passedCount: number;
  /** Number of failed checks */
  failedCount: number;
  /** Total issues in this category */
  issueCount: number;
  /** Category weight in overall score */
  weight: number;
}

/** Overall quality score */
export interface QualityScore {
  /** Overall score (0-100) */
  overall: number;
  /** Grade letter (A, B, C, D, F) */
  grade: QualityGrade;
  /** Per-category breakdown */
  categories: CategoryScore[];
  /** All individual checks */
  checks: QualityCheck[];
  /** Total checks run */
  totalChecks: number;
  /** Passed checks count */
  passedChecks: number;
  /** Failed checks count */
  failedChecks: number;
  /** Total issues found */
  totalIssues: number;
  /** Timestamp of score calculation */
  timestamp: number;
}

/** Quality grade */
export type QualityGrade = "A+" | "A" | "B" | "C" | "D" | "F";

/** Display format options */
export interface DisplayOptions {
  /** Show category breakdown */
  showBreakdown?: boolean;
  /** Show grade letter */
  showGrade?: boolean;
  /** Show issue count */
  showIssues?: boolean;
  /** Compact format */
  compact?: boolean;
  /** Categories to show in breakdown */
  breakdownCategories?: QualityCategory[];
}

/** Display result */
export interface QualityDisplay {
  /** Main display text (e.g., 'Quality: 85/100') */
  text: string;
  /** Overall score */
  score: number;
  /** Grade */
  grade: QualityGrade;
  /** Breakdown strings (e.g., ['syntax: 90', 'a11y: 80']) */
  breakdown: string[];
  /** Full formatted breakdown */
  breakdownText: string;
  /** Color for the score */
  color: ScoreColor;
  /** Status text */
  status: "excellent" | "good" | "fair" | "poor" | "failing";
}

/** Score color */
export type ScoreColor = "green" | "lime" | "yellow" | "orange" | "red";

/** Score change callback */
export type ScoreChangeCallback = (score: QualityScore) => void;

/** Quality score display options */
export interface QualityScoreDisplayOptions {
  /** Default category weights */
  categoryWeights?: Partial<Record<QualityCategory, number>>;
  /** Minimum score to pass */
  passingScore?: number;
  /** Enable auto-update on check changes */
  autoUpdate?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Category labels */
export const CATEGORY_LABELS: Record<QualityCategory, string> = {
  syntax: "Syntax",
  a11y: "Accessibility",
  structure: "Structure",
  performance: "Performance",
  seo: "SEO",
  security: "Security",
};

/** Short category labels for compact display */
export const CATEGORY_SHORT_LABELS: Record<QualityCategory, string> = {
  syntax: "syntax",
  a11y: "a11y",
  structure: "structure",
  performance: "perf",
  seo: "seo",
  security: "sec",
};

/** Default category weights */
export const DEFAULT_CATEGORY_WEIGHTS: Record<QualityCategory, number> = {
  syntax: 0.25,
  a11y: 0.25,
  structure: 0.25,
  performance: 0.10,
  seo: 0.10,
  security: 0.05,
};

/** Grade thresholds */
export const GRADE_THRESHOLDS: { min: number; grade: QualityGrade }[] = [
  { min: 95, grade: "A+" },
  { min: 85, grade: "A" },
  { min: 70, grade: "B" },
  { min: 55, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" },
];

/** Score colors */
export const SCORE_COLORS: { min: number; color: ScoreColor }[] = [
  { min: 85, color: "green" },
  { min: 70, color: "lime" },
  { min: 55, color: "yellow" },
  { min: 40, color: "orange" },
  { min: 0, color: "red" },
];

/** Default display options */
const DEFAULT_DISPLAY_OPTIONS: Required<DisplayOptions> = {
  showBreakdown: true,
  showGrade: true,
  showIssues: false,
  compact: false,
  breakdownCategories: ["syntax", "a11y", "structure"],
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get grade for a score
 */
export function getGrade(score: number): QualityGrade {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) {
      return threshold.grade;
    }
  }
  return "F";
}

/**
 * Get color for a score
 */
export function getScoreColor(score: number): ScoreColor {
  for (const threshold of SCORE_COLORS) {
    if (score >= threshold.min) {
      return threshold.color;
    }
  }
  return "red";
}

/**
 * Get status text for a score
 */
export function getScoreStatus(score: number): "excellent" | "good" | "fair" | "poor" | "failing" {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  if (score >= 30) return "poor";
  return "failing";
}

/**
 * Format score as percentage
 */
export function formatScore(score: number): string {
  return Math.round(score).toString();
}

/**
 * Format category score for display
 */
export function formatCategoryScore(category: QualityCategory, score: number): string {
  const label = CATEGORY_SHORT_LABELS[category];
  return `${label}: ${formatScore(score)}`;
}

/**
 * Calculate weighted average
 */
export function calculateWeightedAverage(
  scores: { score: number; weight: number }[]
): number {
  if (scores.length === 0) return 0;

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = scores.reduce((sum, s) => sum + s.score * s.weight, 0);
  return weightedSum / totalWeight;
}

/**
 * Normalize weights to sum to 1
 */
export function normalizeWeights(
  weights: Partial<Record<QualityCategory, number>>
): Record<QualityCategory, number> {
  const result = { ...DEFAULT_CATEGORY_WEIGHTS, ...weights };
  const total = Object.values(result).reduce((sum, w) => sum + w, 0);

  if (total === 0) return DEFAULT_CATEGORY_WEIGHTS;

  for (const key of Object.keys(result) as QualityCategory[]) {
    result[key] = result[key] / total;
  }

  return result;
}

// ============================================================================
// QualityScoreDisplay Class
// ============================================================================

/**
 * Quality score display manager
 */
export class QualityScoreDisplay {
  private checks: Map<string, QualityCheck> = new Map();
  private categoryWeights: Record<QualityCategory, number>;
  private passingScore: number;
  private autoUpdate: boolean;
  private callbacks: Set<ScoreChangeCallback> = new Set();
  private disposed = false;
  private cachedScore: QualityScore | null = null;

  constructor(options: QualityScoreDisplayOptions = {}) {
    this.categoryWeights = normalizeWeights(options.categoryWeights ?? {});
    this.passingScore = options.passingScore ?? 70;
    this.autoUpdate = options.autoUpdate ?? true;
  }

  /**
   * Add a quality check result
   */
  addCheck(check: QualityCheck): void {
    if (this.disposed) {
      throw new Error("QualityScoreDisplay is disposed");
    }

    this.checks.set(check.id, check);
    this.invalidateCache();

    if (this.autoUpdate) {
      this.notifyChange();
    }
  }

  /**
   * Add multiple checks at once
   */
  addChecks(checks: QualityCheck[]): void {
    if (this.disposed) {
      throw new Error("QualityScoreDisplay is disposed");
    }

    for (const check of checks) {
      this.checks.set(check.id, check);
    }
    this.invalidateCache();

    if (this.autoUpdate) {
      this.notifyChange();
    }
  }

  /**
   * Remove a check
   */
  removeCheck(id: string): boolean {
    const removed = this.checks.delete(id);
    if (removed) {
      this.invalidateCache();
      if (this.autoUpdate) {
        this.notifyChange();
      }
    }
    return removed;
  }

  /**
   * Clear all checks
   */
  clearChecks(): void {
    this.checks.clear();
    this.invalidateCache();
    if (this.autoUpdate) {
      this.notifyChange();
    }
  }

  /**
   * Get a specific check
   */
  getCheck(id: string): QualityCheck | undefined {
    return this.checks.get(id);
  }

  /**
   * Get all checks
   */
  getAllChecks(): QualityCheck[] {
    return Array.from(this.checks.values());
  }

  /**
   * Get checks by category
   */
  getChecksByCategory(category: QualityCategory): QualityCheck[] {
    return Array.from(this.checks.values()).filter(
      (check) => check.category === category
    );
  }

  /**
   * Invalidate cached score
   */
  private invalidateCache(): void {
    this.cachedScore = null;
  }

  /**
   * Calculate the overall quality score
   */
  calculateScore(): QualityScore {
    if (this.cachedScore) {
      return this.cachedScore;
    }

    const checks = Array.from(this.checks.values());
    const categories: CategoryScore[] = [];
    const categoriesWithChecks: CategoryScore[] = [];

    // Calculate per-category scores
    for (const category of Object.keys(CATEGORY_LABELS) as QualityCategory[]) {
      const categoryChecks = checks.filter((c) => c.category === category);

      if (categoryChecks.length === 0) {
        // No checks in this category - include in list but NOT in overall calculation
        categories.push({
          category,
          label: CATEGORY_LABELS[category],
          score: 100, // Display as perfect but won't affect overall
          checkCount: 0,
          passedCount: 0,
          failedCount: 0,
          issueCount: 0,
          weight: this.categoryWeights[category],
        });
        continue;
      }

      const categoryScore = calculateWeightedAverage(
        categoryChecks.map((c) => ({ score: c.score, weight: c.weight }))
      );

      const passedCount = categoryChecks.filter((c) => c.passed).length;
      const issueCount = categoryChecks.reduce(
        (sum, c) => sum + (c.issues?.length ?? 0),
        0
      );

      const catScore: CategoryScore = {
        category,
        label: CATEGORY_LABELS[category],
        score: categoryScore,
        checkCount: categoryChecks.length,
        passedCount,
        failedCount: categoryChecks.length - passedCount,
        issueCount,
        weight: this.categoryWeights[category],
      };

      categories.push(catScore);
      categoriesWithChecks.push(catScore);
    }

    // Calculate overall score ONLY from categories with checks
    // This prevents empty categories from inflating the score
    let overall: number;
    if (categoriesWithChecks.length === 0) {
      overall = 100; // No checks at all = perfect
    } else {
      overall = calculateWeightedAverage(
        categoriesWithChecks.map((c) => ({ score: c.score, weight: c.weight }))
      );
    }

    const passedChecks = checks.filter((c) => c.passed).length;
    const totalIssues = checks.reduce(
      (sum, c) => sum + (c.issues?.length ?? 0),
      0
    );

    this.cachedScore = {
      overall,
      grade: getGrade(overall),
      categories,
      checks,
      totalChecks: checks.length,
      passedChecks,
      failedChecks: checks.length - passedChecks,
      totalIssues,
      timestamp: Date.now(),
    };

    return this.cachedScore;
  }

  /**
   * Get display representation
   */
  getDisplay(options: DisplayOptions = {}): QualityDisplay {
    const opts = { ...DEFAULT_DISPLAY_OPTIONS, ...options };
    const score = this.calculateScore();

    // Build breakdown strings
    const breakdown: string[] = [];
    for (const category of opts.breakdownCategories) {
      const catScore = score.categories.find((c) => c.category === category);
      if (catScore) {
        breakdown.push(formatCategoryScore(category, catScore.score));
      }
    }

    // Build main text
    let text = `Quality: ${formatScore(score.overall)}/100`;
    if (opts.showGrade) {
      text += ` (${score.grade})`;
    }

    // Build breakdown text
    let breakdownText = "";
    if (opts.showBreakdown && breakdown.length > 0) {
      breakdownText = breakdown.join(", ");
    }

    return {
      text,
      score: score.overall,
      grade: score.grade,
      breakdown,
      breakdownText,
      color: getScoreColor(score.overall),
      status: getScoreStatus(score.overall),
    };
  }

  /**
   * Get formatted header display
   * @example 'Quality: 85/100' with breakdown (syntax, a11y, structure)
   */
  getHeaderDisplay(): { text: string; breakdown: string } {
    const score = this.calculateScore();
    const text = `Quality: ${formatScore(score.overall)}/100`;

    const breakdownParts: string[] = [];
    for (const category of ["syntax", "a11y", "structure"] as QualityCategory[]) {
      const catScore = score.categories.find((c) => c.category === category);
      if (catScore) {
        breakdownParts.push(
          `${CATEGORY_SHORT_LABELS[category]}: ${formatScore(catScore.score)}`
        );
      }
    }

    return {
      text,
      breakdown: breakdownParts.join(", "),
    };
  }

  /**
   * Check if score passes threshold
   */
  isPassing(): boolean {
    const score = this.calculateScore();
    return score.overall >= this.passingScore;
  }

  /**
   * Get passing score threshold
   */
  getPassingScore(): number {
    return this.passingScore;
  }

  /**
   * Set passing score threshold
   */
  setPassingScore(score: number): void {
    if (this.disposed) {
      throw new Error("QualityScoreDisplay is disposed");
    }
    this.passingScore = Math.max(0, Math.min(100, score));
  }

  /**
   * Set category weight
   */
  setCategoryWeight(category: QualityCategory, weight: number): void {
    if (this.disposed) {
      throw new Error("QualityScoreDisplay is disposed");
    }

    this.categoryWeights[category] = weight;
    this.categoryWeights = normalizeWeights(this.categoryWeights);
    this.invalidateCache();

    if (this.autoUpdate) {
      this.notifyChange();
    }
  }

  /**
   * Get category weights
   */
  getCategoryWeights(): Record<QualityCategory, number> {
    return { ...this.categoryWeights };
  }

  /**
   * Subscribe to score changes
   */
  subscribe(callback: ScoreChangeCallback): () => void {
    if (this.disposed) {
      throw new Error("QualityScoreDisplay is disposed");
    }

    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify callbacks of changes
   */
  private notifyChange(): void {
    const score = this.calculateScore();
    for (const callback of this.callbacks) {
      try {
        callback(score);
      } catch (err) {
        console.error("QualityScoreDisplay callback error:", err);
      }
    }
  }

  /**
   * Force recalculation and notify
   */
  refresh(): void {
    if (this.disposed) {
      throw new Error("QualityScoreDisplay is disposed");
    }

    this.invalidateCache();
    this.notifyChange();
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose the display
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.callbacks.clear();
    this.checks.clear();
    this.cachedScore = null;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new QualityScoreDisplay instance
 */
export function createQualityScoreDisplay(
  options?: QualityScoreDisplayOptions
): QualityScoreDisplay {
  return new QualityScoreDisplay(options);
}

// ============================================================================
// Check Builders
// ============================================================================

/**
 * Create a syntax check
 */
export function createSyntaxCheck(
  id: string,
  name: string,
  score: number,
  options: { weight?: number; message?: string; issues?: QualityIssue[] } = {}
): QualityCheck {
  return {
    category: "syntax",
    id,
    name,
    score: Math.max(0, Math.min(100, score)),
    weight: options.weight ?? 1,
    passed: score >= 70,
    message: options.message,
    issues: options.issues,
  };
}

/**
 * Create an accessibility check
 */
export function createA11yCheck(
  id: string,
  name: string,
  score: number,
  options: { weight?: number; message?: string; issues?: QualityIssue[] } = {}
): QualityCheck {
  return {
    category: "a11y",
    id,
    name,
    score: Math.max(0, Math.min(100, score)),
    weight: options.weight ?? 1,
    passed: score >= 70,
    message: options.message,
    issues: options.issues,
  };
}

/**
 * Create a structure check
 */
export function createStructureCheck(
  id: string,
  name: string,
  score: number,
  options: { weight?: number; message?: string; issues?: QualityIssue[] } = {}
): QualityCheck {
  return {
    category: "structure",
    id,
    name,
    score: Math.max(0, Math.min(100, score)),
    weight: options.weight ?? 1,
    passed: score >= 70,
    message: options.message,
    issues: options.issues,
  };
}

/**
 * Create a performance check
 */
export function createPerformanceCheck(
  id: string,
  name: string,
  score: number,
  options: { weight?: number; message?: string; issues?: QualityIssue[] } = {}
): QualityCheck {
  return {
    category: "performance",
    id,
    name,
    score: Math.max(0, Math.min(100, score)),
    weight: options.weight ?? 1,
    passed: score >= 70,
    message: options.message,
    issues: options.issues,
  };
}

/**
 * Create a generic quality check
 */
export function createQualityCheck(
  category: QualityCategory,
  id: string,
  name: string,
  score: number,
  options: { weight?: number; message?: string; issues?: QualityIssue[]; passingThreshold?: number } = {}
): QualityCheck {
  const threshold = options.passingThreshold ?? 70;
  return {
    category,
    id,
    name,
    score: Math.max(0, Math.min(100, score)),
    weight: options.weight ?? 1,
    passed: score >= threshold,
    message: options.message,
    issues: options.issues,
  };
}

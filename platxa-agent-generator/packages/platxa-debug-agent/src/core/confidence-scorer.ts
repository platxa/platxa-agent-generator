/**
 * Confidence Scoring System
 *
 * Provides comprehensive confidence scoring for hypotheses based on
 * evidence strength, type weights, correlation, and conflict detection.
 *
 * @module confidence-scorer
 */

import type { Evidence, RootCauseHypothesis } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Scoring strategy for combining evidence
 */
export type ScoringStrategy =
  | 'weighted_average'    // Weighted average of evidence strengths
  | 'bayesian'            // Bayesian probability combination
  | 'max_evidence'        // Maximum evidence strength
  | 'min_evidence'        // Minimum evidence strength (conservative)
  | 'geometric_mean';     // Geometric mean of evidence strengths

/**
 * Weights for different evidence types
 */
export interface EvidenceTypeWeights {
  code: number;
  error: number;
  test: number;
  history: number;
  pattern: number;
  static_analysis: number;
}

/**
 * Configuration for the confidence scorer
 */
export interface ConfidenceScorerConfig {
  /** Primary scoring strategy */
  strategy?: ScoringStrategy;
  /** Evidence type weights */
  typeWeights?: Partial<EvidenceTypeWeights>;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Maximum confidence cap */
  maxConfidence?: number;
  /** Penalty for conflicting evidence */
  conflictPenalty?: number;
  /** Boost for correlated evidence */
  correlationBoost?: number;
  /** Minimum evidence count for reliable score */
  minEvidenceCount?: number;
  /** Decay factor for older evidence */
  evidenceDecay?: number;
}

/**
 * Detailed breakdown of a confidence score
 */
export interface ScoreBreakdown {
  /** Final confidence score (0-1) */
  finalScore: number;
  /** Raw score before adjustments */
  rawScore: number;
  /** Individual evidence contributions */
  evidenceContributions: EvidenceContribution[];
  /** Applied adjustments */
  adjustments: ScoreAdjustment[];
  /** Detected conflicts */
  conflicts: EvidenceConflict[];
  /** Detected correlations */
  correlations: EvidenceCorrelation[];
  /** Scoring strategy used */
  strategy: ScoringStrategy;
  /** Quality assessment */
  quality: ScoreQuality;
}

/**
 * Individual evidence contribution to the score
 */
export interface EvidenceContribution {
  /** Evidence description */
  description: string;
  /** Evidence type */
  type: Evidence['type'];
  /** Raw strength */
  rawStrength: number;
  /** Weight applied */
  weight: number;
  /** Weighted contribution */
  contribution: number;
}

/**
 * Score adjustment applied
 */
export interface ScoreAdjustment {
  /** Adjustment type */
  type: 'conflict_penalty' | 'correlation_boost' | 'evidence_count' | 'diversity_bonus' | 'cap';
  /** Adjustment value */
  value: number;
  /** Reason for adjustment */
  reason: string;
}

/**
 * Detected conflict between evidence
 */
export interface EvidenceConflict {
  /** First conflicting evidence */
  evidence1: string;
  /** Second conflicting evidence */
  evidence2: string;
  /** Conflict severity (0-1) */
  severity: number;
  /** Description of conflict */
  description: string;
}

/**
 * Detected correlation between evidence
 */
export interface EvidenceCorrelation {
  /** Correlated evidence descriptions */
  evidenceDescriptions: string[];
  /** Correlation strength (0-1) */
  strength: number;
  /** Type of correlation */
  correlationType: 'supporting' | 'independent' | 'redundant';
}

/**
 * Quality assessment of the score
 */
export interface ScoreQuality {
  /** Overall quality level */
  level: 'high' | 'medium' | 'low' | 'insufficient';
  /** Evidence count */
  evidenceCount: number;
  /** Evidence type diversity */
  typeDiversity: number;
  /** Has conflicting evidence */
  hasConflicts: boolean;
  /** Reliability assessment */
  reliability: number;
  /** Recommendations for improving score */
  recommendations: string[];
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_TYPE_WEIGHTS: EvidenceTypeWeights = {
  code: 0.9,            // Direct code evidence is highly reliable
  error: 0.85,          // Error messages are strong indicators
  test: 0.95,           // Test results are very reliable
  history: 0.6,         // Historical patterns are moderately reliable
  pattern: 0.7,         // Pattern matches are fairly reliable
  static_analysis: 0.8, // Static analysis is reliable
};

const DEFAULT_CONFIG: Required<ConfidenceScorerConfig> = {
  strategy: 'weighted_average',
  typeWeights: DEFAULT_TYPE_WEIGHTS,
  minConfidence: 0.0,
  maxConfidence: 1.0,
  conflictPenalty: 0.15,
  correlationBoost: 0.05,
  minEvidenceCount: 2,
  evidenceDecay: 0.0,
};

// =============================================================================
// Confidence Scorer Implementation
// =============================================================================

/**
 * Confidence Scoring System for hypotheses.
 *
 * Provides multiple scoring strategies and detailed breakdowns
 * for understanding confidence calculations.
 */
export class ConfidenceScorer {
  /** Scorer configuration */
  private readonly config: Required<ConfidenceScorerConfig>;

  /** Evidence type weights */
  private readonly typeWeights: EvidenceTypeWeights;

  constructor(config: ConfidenceScorerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      typeWeights: { ...DEFAULT_TYPE_WEIGHTS, ...config.typeWeights },
    };
    this.typeWeights = this.config.typeWeights as EvidenceTypeWeights;
  }

  // ===========================================================================
  // Main Scoring Methods
  // ===========================================================================

  /**
   * Calculate confidence score for a hypothesis.
   *
   * @param hypothesis - The hypothesis to score
   * @returns Confidence score (0-1)
   */
  score(hypothesis: RootCauseHypothesis): number {
    return this.scoreEvidence(hypothesis.evidence);
  }

  /**
   * Calculate confidence score from evidence array.
   *
   * @param evidence - Array of evidence
   * @returns Confidence score (0-1)
   */
  scoreEvidence(evidence: Evidence[]): number {
    if (evidence.length === 0) {
      return 0;
    }

    const breakdown = this.calculateBreakdown(evidence);
    return breakdown.finalScore;
  }

  /**
   * Calculate detailed score breakdown.
   *
   * @param evidence - Array of evidence
   * @returns Detailed score breakdown
   */
  calculateBreakdown(evidence: Evidence[]): ScoreBreakdown {
    // Calculate individual contributions
    const contributions = this.calculateContributions(evidence);

    // Calculate raw score using selected strategy
    const rawScore = this.calculateRawScore(contributions);

    // Detect conflicts and correlations
    const conflicts = this.detectConflicts(evidence);
    const correlations = this.detectCorrelations(evidence);

    // Calculate adjustments
    const adjustments = this.calculateAdjustments(
      rawScore,
      evidence,
      conflicts,
      correlations
    );

    // Apply adjustments
    let finalScore = rawScore;
    for (const adj of adjustments) {
      finalScore += adj.value;
    }

    // Apply bounds
    finalScore = Math.max(this.config.minConfidence, Math.min(this.config.maxConfidence, finalScore));

    // Assess quality
    const quality = this.assessQuality(evidence, conflicts, finalScore);

    return {
      finalScore: Math.round(finalScore * 1000) / 1000,
      rawScore: Math.round(rawScore * 1000) / 1000,
      evidenceContributions: contributions,
      adjustments,
      conflicts,
      correlations,
      strategy: this.config.strategy,
      quality,
    };
  }

  /**
   * Score multiple hypotheses and rank them.
   *
   * @param hypotheses - Array of hypotheses
   * @returns Scored and ranked hypotheses with breakdowns
   */
  rankHypotheses(
    hypotheses: RootCauseHypothesis[]
  ): Array<{ hypothesis: RootCauseHypothesis; breakdown: ScoreBreakdown }> {
    const scored = hypotheses.map((hypothesis) => ({
      hypothesis,
      breakdown: this.calculateBreakdown(hypothesis.evidence),
    }));

    // Sort by final score descending
    scored.sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);

    return scored;
  }

  // ===========================================================================
  // Contribution Calculation
  // ===========================================================================

  /**
   * Calculate individual evidence contributions.
   */
  private calculateContributions(evidence: Evidence[]): EvidenceContribution[] {
    return evidence.map((e) => {
      const weight = this.typeWeights[e.type];
      const contribution = e.strength * weight;

      return {
        description: e.description,
        type: e.type,
        rawStrength: e.strength,
        weight,
        contribution,
      };
    });
  }

  /**
   * Calculate raw score using the configured strategy.
   */
  private calculateRawScore(contributions: EvidenceContribution[]): number {
    if (contributions.length === 0) {
      return 0;
    }

    switch (this.config.strategy) {
      case 'weighted_average':
        return this.weightedAverageScore(contributions);
      case 'bayesian':
        return this.bayesianScore(contributions);
      case 'max_evidence':
        return this.maxEvidenceScore(contributions);
      case 'min_evidence':
        return this.minEvidenceScore(contributions);
      case 'geometric_mean':
        return this.geometricMeanScore(contributions);
      default:
        return this.weightedAverageScore(contributions);
    }
  }

  /**
   * Weighted average scoring strategy.
   */
  private weightedAverageScore(contributions: EvidenceContribution[]): number {
    const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = contributions.reduce((sum, c) => sum + c.contribution, 0);
    return weightedSum / totalWeight;
  }

  /**
   * Bayesian probability combination.
   * Treats each evidence as an independent probability and combines them.
   */
  private bayesianScore(contributions: EvidenceContribution[]): number {
    // P(H|E1,E2,...) using independent evidence assumption
    // Combined using: P = 1 - Π(1 - Pi)
    let complementProduct = 1;

    for (const c of contributions) {
      // Normalize contribution to [0,1] range
      const prob = Math.min(1, Math.max(0, c.contribution));
      complementProduct *= (1 - prob);
    }

    return 1 - complementProduct;
  }

  /**
   * Maximum evidence scoring (optimistic).
   */
  private maxEvidenceScore(contributions: EvidenceContribution[]): number {
    return Math.max(...contributions.map((c) => c.contribution));
  }

  /**
   * Minimum evidence scoring (conservative).
   */
  private minEvidenceScore(contributions: EvidenceContribution[]): number {
    return Math.min(...contributions.map((c) => c.contribution));
  }

  /**
   * Geometric mean scoring.
   */
  private geometricMeanScore(contributions: EvidenceContribution[]): number {
    if (contributions.length === 0) return 0;

    // Add small epsilon to avoid zero
    const epsilon = 0.001;
    const product = contributions.reduce(
      (prod, c) => prod * Math.max(epsilon, c.contribution),
      1
    );

    return Math.pow(product, 1 / contributions.length);
  }

  // ===========================================================================
  // Conflict Detection
  // ===========================================================================

  /**
   * Detect conflicts between evidence.
   */
  private detectConflicts(evidence: Evidence[]): EvidenceConflict[] {
    const conflicts: EvidenceConflict[] = [];

    // Check for opposing evidence patterns
    for (let i = 0; i < evidence.length; i++) {
      for (let j = i + 1; j < evidence.length; j++) {
        const e1 = evidence[i];
        const e2 = evidence[j];

        if (e1 === undefined || e2 === undefined) continue;

        const conflict = this.checkConflict(e1, e2);
        if (conflict !== null) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two pieces of evidence conflict.
   */
  private checkConflict(e1: Evidence, e2: Evidence): EvidenceConflict | null {
    // Check for contradictory keywords
    const contradictions: Array<[string, string]> = [
      ['success', 'failure'],
      ['pass', 'fail'],
      ['found', 'not found'],
      ['exists', 'missing'],
      ['defined', 'undefined'],
      ['valid', 'invalid'],
      ['correct', 'incorrect'],
    ];

    const desc1Lower = e1.description.toLowerCase();
    const desc2Lower = e2.description.toLowerCase();

    for (const [term1, term2] of contradictions) {
      if (
        (desc1Lower.includes(term1) && desc2Lower.includes(term2)) ||
        (desc1Lower.includes(term2) && desc2Lower.includes(term1))
      ) {
        return {
          evidence1: e1.description,
          evidence2: e2.description,
          severity: Math.abs(e1.strength - e2.strength) > 0.3 ? 0.8 : 0.5,
          description: `Contradictory terms: "${term1}" vs "${term2}"`,
        };
      }
    }

    // Check for same type with very different strengths at same location
    if (
      e1.type === e2.type &&
      e1.location !== undefined &&
      e2.location !== undefined &&
      e1.location.file === e2.location.file &&
      e1.location.line === e2.location.line &&
      Math.abs(e1.strength - e2.strength) > 0.5
    ) {
      return {
        evidence1: e1.description,
        evidence2: e2.description,
        severity: 0.6,
        description: 'Same location with conflicting strength assessments',
      };
    }

    return null;
  }

  // ===========================================================================
  // Correlation Detection
  // ===========================================================================

  /**
   * Detect correlations between evidence.
   */
  private detectCorrelations(evidence: Evidence[]): EvidenceCorrelation[] {
    const correlations: EvidenceCorrelation[] = [];

    // Group evidence by type
    const byType = new Map<Evidence['type'], Evidence[]>();
    for (const e of evidence) {
      const existing = byType.get(e.type) ?? [];
      existing.push(e);
      byType.set(e.type, existing);
    }

    // Check for supporting correlations (same type, similar strength)
    for (const [_type, typeEvidence] of byType) {
      if (typeEvidence.length >= 2) {
        const avgStrength = typeEvidence.reduce((sum, e) => sum + e.strength, 0) / typeEvidence.length;
        const variance = typeEvidence.reduce((sum, e) => sum + Math.pow(e.strength - avgStrength, 2), 0) / typeEvidence.length;

        if (variance < 0.1) {
          // Low variance means consistent evidence
          correlations.push({
            evidenceDescriptions: typeEvidence.map((e) => e.description),
            strength: 1 - variance,
            correlationType: 'supporting',
          });
        } else if (variance < 0.05) {
          // Very low variance might be redundant
          correlations.push({
            evidenceDescriptions: typeEvidence.map((e) => e.description),
            strength: 0.8,
            correlationType: 'redundant',
          });
        }
      }
    }

    // Check for cross-type correlations (same location)
    const byLocation = new Map<string, Evidence[]>();
    for (const e of evidence) {
      if (e.location !== undefined) {
        const key = `${e.location.file}:${e.location.line}`;
        const existing = byLocation.get(key) ?? [];
        existing.push(e);
        byLocation.set(key, existing);
      }
    }

    for (const [_location, locEvidence] of byLocation) {
      if (locEvidence.length >= 2) {
        const types = new Set(locEvidence.map((e) => e.type));
        if (types.size > 1) {
          // Multiple evidence types at same location
          correlations.push({
            evidenceDescriptions: locEvidence.map((e) => e.description),
            strength: 0.7,
            correlationType: 'supporting',
          });
        }
      }
    }

    return correlations;
  }

  // ===========================================================================
  // Score Adjustments
  // ===========================================================================

  /**
   * Calculate score adjustments.
   */
  private calculateAdjustments(
    rawScore: number,
    evidence: Evidence[],
    conflicts: EvidenceConflict[],
    correlations: EvidenceCorrelation[]
  ): ScoreAdjustment[] {
    const adjustments: ScoreAdjustment[] = [];

    // Conflict penalty
    if (conflicts.length > 0) {
      const totalSeverity = conflicts.reduce((sum, c) => sum + c.severity, 0);
      const penalty = -this.config.conflictPenalty * Math.min(1, totalSeverity);
      adjustments.push({
        type: 'conflict_penalty',
        value: penalty,
        reason: `${conflicts.length} conflict(s) detected`,
      });
    }

    // Correlation boost
    const supportingCorrelations = correlations.filter((c) => c.correlationType === 'supporting');
    if (supportingCorrelations.length > 0) {
      const boost = this.config.correlationBoost * Math.min(supportingCorrelations.length, 3);
      adjustments.push({
        type: 'correlation_boost',
        value: boost,
        reason: `${supportingCorrelations.length} supporting correlation(s)`,
      });
    }

    // Evidence count adjustment
    if (evidence.length < this.config.minEvidenceCount) {
      const penalty = -0.1 * (this.config.minEvidenceCount - evidence.length);
      adjustments.push({
        type: 'evidence_count',
        value: penalty,
        reason: `Only ${evidence.length} evidence (min: ${this.config.minEvidenceCount})`,
      });
    }

    // Diversity bonus
    const uniqueTypes = new Set(evidence.map((e) => e.type));
    if (uniqueTypes.size >= 3) {
      const bonus = 0.05 * (uniqueTypes.size - 2);
      adjustments.push({
        type: 'diversity_bonus',
        value: bonus,
        reason: `${uniqueTypes.size} different evidence types`,
      });
    }

    // Cap adjustment if needed
    const projectedScore = rawScore + adjustments.reduce((sum, a) => sum + a.value, 0);
    if (projectedScore > this.config.maxConfidence) {
      adjustments.push({
        type: 'cap',
        value: this.config.maxConfidence - projectedScore,
        reason: `Capped at maximum confidence ${this.config.maxConfidence}`,
      });
    } else if (projectedScore < this.config.minConfidence) {
      adjustments.push({
        type: 'cap',
        value: this.config.minConfidence - projectedScore,
        reason: `Raised to minimum confidence ${this.config.minConfidence}`,
      });
    }

    return adjustments;
  }

  // ===========================================================================
  // Quality Assessment
  // ===========================================================================

  /**
   * Assess the quality of the confidence score.
   */
  private assessQuality(
    evidence: Evidence[],
    conflicts: EvidenceConflict[],
    finalScore: number
  ): ScoreQuality {
    const recommendations: string[] = [];

    // Evidence count
    const evidenceCount = evidence.length;
    if (evidenceCount < 2) {
      recommendations.push('Gather more evidence to improve reliability');
    }

    // Type diversity
    const uniqueTypes = new Set(evidence.map((e) => e.type));
    const typeDiversity = uniqueTypes.size / 6; // 6 possible types
    if (typeDiversity < 0.33) {
      recommendations.push('Add different types of evidence (code, test, static analysis)');
    }

    // Conflicts
    const hasConflicts = conflicts.length > 0;
    if (hasConflicts) {
      recommendations.push('Resolve conflicting evidence before relying on this score');
    }

    // Calculate reliability
    let reliability = 0.5;
    reliability += Math.min(0.3, evidenceCount * 0.1);
    reliability += typeDiversity * 0.2;
    if (hasConflicts) {
      reliability -= 0.2;
    }
    if (finalScore > 0.8 && evidenceCount >= 3) {
      reliability += 0.1;
    }
    reliability = Math.max(0, Math.min(1, reliability));

    // Determine quality level
    let level: ScoreQuality['level'];
    if (evidenceCount < 1) {
      level = 'insufficient';
    } else if (reliability >= 0.7 && !hasConflicts && evidenceCount >= 3) {
      level = 'high';
    } else if (reliability >= 0.4) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return {
      level,
      evidenceCount,
      typeDiversity: Math.round(typeDiversity * 100) / 100,
      hasConflicts,
      reliability: Math.round(reliability * 100) / 100,
      recommendations,
    };
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get the current configuration.
   */
  getConfig(): Required<ConfidenceScorerConfig> {
    return { ...this.config };
  }

  /**
   * Get evidence type weights.
   */
  getTypeWeights(): EvidenceTypeWeights {
    return { ...this.typeWeights };
  }

  /**
   * Update configuration.
   */
  updateConfig(updates: Partial<ConfidenceScorerConfig>): void {
    Object.assign(this.config, updates);
    if (updates.typeWeights !== undefined) {
      Object.assign(this.typeWeights, updates.typeWeights);
    }
  }

  /**
   * Create a custom scorer for specific use case.
   */
  static createConservative(): ConfidenceScorer {
    return new ConfidenceScorer({
      strategy: 'min_evidence',
      conflictPenalty: 0.25,
      minEvidenceCount: 3,
    });
  }

  /**
   * Create an optimistic scorer.
   */
  static createOptimistic(): ConfidenceScorer {
    return new ConfidenceScorer({
      strategy: 'max_evidence',
      conflictPenalty: 0.05,
      correlationBoost: 0.1,
      minEvidenceCount: 1,
    });
  }

  /**
   * Create a Bayesian scorer.
   */
  static createBayesian(): ConfidenceScorer {
    return new ConfidenceScorer({
      strategy: 'bayesian',
      conflictPenalty: 0.1,
      correlationBoost: 0.03,
    });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new ConfidenceScorer instance.
 *
 * @param config - Scorer configuration
 * @returns ConfidenceScorer instance
 */
export function createConfidenceScorer(config?: ConfidenceScorerConfig): ConfidenceScorer {
  return new ConfidenceScorer(config);
}

/**
 * Quick score calculation without creating a scorer instance.
 *
 * @param evidence - Evidence array
 * @param strategy - Optional scoring strategy
 * @returns Confidence score (0-1)
 */
export function quickScore(
  evidence: Evidence[],
  strategy: ScoringStrategy = 'weighted_average'
): number {
  const scorer = new ConfidenceScorer({ strategy });
  return scorer.scoreEvidence(evidence);
}

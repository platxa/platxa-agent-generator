/**
 * Fix Ranker (Feature #39)
 *
 * Multi-candidate fix ranker using entropy scoring to rank fix candidates
 * by likelihood of correctness. Helps reduce patch overfitting by evaluating
 * multiple factors including code naturalness, syntactic entropy, and semantic
 * similarity.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto';
import type { FixSuggestion, SourceLocation } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Ranking strategy for fix candidates.
 */
export type RankingStrategy =
  | 'entropy'          // Entropy-based ranking (default)
  | 'weighted'         // Weighted multi-factor ranking
  | 'bayesian'         // Bayesian probability ranking
  | 'ensemble';        // Ensemble of multiple strategies

/**
 * Factor contributing to fix ranking.
 */
export type RankingFactor =
  | 'syntactic_entropy'    // How natural the syntax looks
  | 'semantic_similarity'  // Similarity to original code
  | 'code_naturalness'     // Based on n-gram language models
  | 'test_pass_rate'       // Percentage of tests passed
  | 'change_size'          // Smaller changes preferred
  | 'pattern_match'        // Matches known fix patterns
  | 'type_consistency'     // Type system consistency
  | 'historical_success';  // Success rate of similar fixes

/**
 * A fix candidate with metadata.
 */
export interface FixCandidate {
  /** Unique identifier */
  id: string;
  /** The fix suggestion */
  fix: FixSuggestion;
  /** Source code before fix */
  originalCode: string;
  /** Source code after fix */
  fixedCode: string;
  /** File being fixed */
  file: string;
  /** Location of the fix */
  location: SourceLocation;
  /** Origin of this candidate */
  source: 'template' | 'llm' | 'pattern' | 'historical' | 'user';
  /** Generation timestamp */
  generatedAt: number;
}

/**
 * Score breakdown for a single factor.
 */
export interface FactorScore {
  /** Factor type */
  factor: RankingFactor;
  /** Raw score (0-1) */
  rawScore: number;
  /** Weight applied */
  weight: number;
  /** Weighted score */
  weightedScore: number;
  /** Explanation */
  explanation: string;
}

/**
 * Entropy calculation result.
 */
export interface EntropyScore {
  /** Total entropy (lower is better) */
  totalEntropy: number;
  /** Syntactic entropy */
  syntacticEntropy: number;
  /** Semantic entropy */
  semanticEntropy: number;
  /** Token-level entropy */
  tokenEntropy: number;
  /** Normalized score (0-1, higher is better) */
  normalizedScore: number;
}

/**
 * Ranked fix result.
 */
export interface RankedFix {
  /** Original candidate */
  candidate: FixCandidate;
  /** Overall rank (1 = best) */
  rank: number;
  /** Overall score (0-1) */
  score: number;
  /** Entropy score details */
  entropyScore: EntropyScore;
  /** Individual factor scores */
  factorScores: FactorScore[];
  /** Confidence in the ranking */
  confidence: number;
  /** Risk assessment */
  risk: 'low' | 'medium' | 'high';
  /** Explanation of ranking */
  explanation: string;
}

/**
 * Ranking result for a batch of candidates.
 */
export interface RankingResult {
  /** Ranked fixes (best first) */
  rankedFixes: RankedFix[];
  /** Total candidates evaluated */
  totalCandidates: number;
  /** Candidates filtered out */
  filteredCount: number;
  /** Strategy used */
  strategy: RankingStrategy;
  /** Ranking duration in ms */
  durationMs: number;
  /** Summary of ranking */
  summary: string;
}

/**
 * Test result for a fix candidate.
 */
export interface FixTestResult {
  /** Candidate ID */
  candidateId: string;
  /** Tests passed */
  passed: number;
  /** Tests failed */
  failed: number;
  /** Tests skipped */
  skipped: number;
  /** Total tests */
  total: number;
  /** Pass rate (0-1) */
  passRate: number;
  /** Test duration in ms */
  durationMs: number;
}

/**
 * Historical fix data for learning.
 */
export interface HistoricalFix {
  /** Fix pattern hash */
  patternHash: string;
  /** Times this pattern was used */
  usageCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average confidence */
  avgConfidence: number;
  /** Error types this pattern fixes */
  errorTypes: string[];
}

/**
 * Configuration for the fix ranker.
 */
export interface FixRankerConfig {
  /** Ranking strategy */
  strategy?: RankingStrategy;
  /** Factor weights (override defaults) */
  factorWeights?: Partial<Record<RankingFactor, number>>;
  /** Minimum score threshold */
  minScore?: number;
  /** Maximum candidates to return */
  maxCandidates?: number;
  /** Whether to include entropy details */
  includeEntropyDetails?: boolean;
  /** Custom n-gram model for naturalness */
  ngramModel?: NGramModel;
  /** Historical fix data for learning */
  historicalData?: HistoricalFix[];
}

/**
 * N-gram model for code naturalness.
 */
export interface NGramModel {
  /** N-gram size */
  n: number;
  /** Token frequencies */
  frequencies: Map<string, number>;
  /** Total token count */
  totalTokens: number;
}

// =============================================================================
// Fix Ranker Implementation
// =============================================================================

/**
 * Default factor weights.
 */
const DEFAULT_WEIGHTS: Record<RankingFactor, number> = {
  syntactic_entropy: 0.20,
  semantic_similarity: 0.15,
  code_naturalness: 0.15,
  test_pass_rate: 0.20,
  change_size: 0.10,
  pattern_match: 0.10,
  type_consistency: 0.05,
  historical_success: 0.05,
};

/**
 * Multi-candidate fix ranker using entropy scoring.
 *
 * @example
 * ```typescript
 * const ranker = createFixRanker();
 *
 * const result = ranker.rankCandidates(candidates, {
 *   testResults: testResultsMap,
 * });
 *
 * console.log(`Best fix: ${result.rankedFixes[0].candidate.fix.description}`);
 * console.log(`Score: ${result.rankedFixes[0].score}`);
 * ```
 */
export class FixRanker {
  /** Configuration */
  private readonly config: Required<Omit<FixRankerConfig, 'ngramModel' | 'historicalData'>> & {
    ngramModel?: NGramModel;
    historicalData: HistoricalFix[];
  };

  /** Factor weights */
  private readonly weights: Record<RankingFactor, number>;

  constructor(config: FixRankerConfig = {}) {
    const baseConfig = {
      strategy: config.strategy ?? 'entropy',
      factorWeights: config.factorWeights ?? {},
      minScore: config.minScore ?? 0.1,
      maxCandidates: config.maxCandidates ?? 10,
      includeEntropyDetails: config.includeEntropyDetails ?? true,
      historicalData: config.historicalData ?? [],
    };
    if (config.ngramModel !== undefined) {
      this.config = { ...baseConfig, ngramModel: config.ngramModel };
    } else {
      this.config = baseConfig;
    }

    // Merge custom weights with defaults
    this.weights = { ...DEFAULT_WEIGHTS };
    for (const [factor, weight] of Object.entries(this.config.factorWeights)) {
      this.weights[factor as RankingFactor] = weight;
    }

    // Normalize weights to sum to 1
    const totalWeight = Object.values(this.weights).reduce((a, b) => a + b, 0);
    for (const factor of Object.keys(this.weights) as RankingFactor[]) {
      this.weights[factor] /= totalWeight;
    }
  }

  /**
   * Rank a list of fix candidates.
   */
  rankCandidates(
    candidates: FixCandidate[],
    context: RankingContext = {}
  ): RankingResult {
    const startTime = Date.now();

    if (candidates.length === 0) {
      return {
        rankedFixes: [],
        totalCandidates: 0,
        filteredCount: 0,
        strategy: this.config.strategy,
        durationMs: 0,
        summary: 'No candidates to rank',
      };
    }

    // Score all candidates
    const scored: RankedFix[] = candidates.map((candidate) =>
      this.scoreCandidate(candidate, context)
    );

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    // Filter by minimum score
    const filtered = scored.filter((s) => s.score >= this.config.minScore);
    const filteredCount = scored.length - filtered.length;

    // Limit candidates
    const limited = filtered.slice(0, this.config.maxCandidates);

    // Assign ranks
    limited.forEach((fix, index) => {
      fix.rank = index + 1;
    });

    const durationMs = Date.now() - startTime;

    return {
      rankedFixes: limited,
      totalCandidates: candidates.length,
      filteredCount,
      strategy: this.config.strategy,
      durationMs,
      summary: this.generateSummary(limited, candidates.length),
    };
  }

  /**
   * Score a single candidate.
   */
  private scoreCandidate(
    candidate: FixCandidate,
    context: RankingContext
  ): RankedFix {
    const factorScores: FactorScore[] = [];

    // Calculate entropy score
    const entropyScore = this.calculateEntropyScore(candidate);

    // Syntactic entropy factor
    factorScores.push({
      factor: 'syntactic_entropy',
      rawScore: entropyScore.normalizedScore,
      weight: this.weights.syntactic_entropy,
      weightedScore: entropyScore.normalizedScore * this.weights.syntactic_entropy,
      explanation: `Syntactic entropy: ${entropyScore.syntacticEntropy.toFixed(3)}`,
    });

    // Semantic similarity factor
    const semanticScore = this.calculateSemanticSimilarity(candidate);
    factorScores.push({
      factor: 'semantic_similarity',
      rawScore: semanticScore,
      weight: this.weights.semantic_similarity,
      weightedScore: semanticScore * this.weights.semantic_similarity,
      explanation: `Semantic similarity to original: ${(semanticScore * 100).toFixed(1)}%`,
    });

    // Code naturalness factor
    const naturalnessScore = this.calculateCodeNaturalness(candidate);
    factorScores.push({
      factor: 'code_naturalness',
      rawScore: naturalnessScore,
      weight: this.weights.code_naturalness,
      weightedScore: naturalnessScore * this.weights.code_naturalness,
      explanation: `Code naturalness score: ${(naturalnessScore * 100).toFixed(1)}%`,
    });

    // Test pass rate factor
    const testScore = this.calculateTestScore(candidate, context);
    factorScores.push({
      factor: 'test_pass_rate',
      rawScore: testScore,
      weight: this.weights.test_pass_rate,
      weightedScore: testScore * this.weights.test_pass_rate,
      explanation: `Test pass rate: ${(testScore * 100).toFixed(1)}%`,
    });

    // Change size factor (smaller is better)
    const changeSizeScore = this.calculateChangeSizeScore(candidate);
    factorScores.push({
      factor: 'change_size',
      rawScore: changeSizeScore,
      weight: this.weights.change_size,
      weightedScore: changeSizeScore * this.weights.change_size,
      explanation: `Change size score: ${(changeSizeScore * 100).toFixed(1)}%`,
    });

    // Pattern match factor
    const patternScore = this.calculatePatternMatchScore(candidate);
    factorScores.push({
      factor: 'pattern_match',
      rawScore: patternScore,
      weight: this.weights.pattern_match,
      weightedScore: patternScore * this.weights.pattern_match,
      explanation: `Pattern match score: ${(patternScore * 100).toFixed(1)}%`,
    });

    // Type consistency factor
    const typeScore = this.calculateTypeConsistencyScore(candidate);
    factorScores.push({
      factor: 'type_consistency',
      rawScore: typeScore,
      weight: this.weights.type_consistency,
      weightedScore: typeScore * this.weights.type_consistency,
      explanation: `Type consistency: ${(typeScore * 100).toFixed(1)}%`,
    });

    // Historical success factor
    const historicalScore = this.calculateHistoricalSuccessScore(candidate);
    factorScores.push({
      factor: 'historical_success',
      rawScore: historicalScore,
      weight: this.weights.historical_success,
      weightedScore: historicalScore * this.weights.historical_success,
      explanation: `Historical success rate: ${(historicalScore * 100).toFixed(1)}%`,
    });

    // Calculate overall score
    const score = factorScores.reduce((sum, fs) => sum + fs.weightedScore, 0);

    // Calculate confidence
    const confidence = this.calculateConfidence(factorScores, entropyScore);

    // Assess risk
    const risk = this.assessRisk(score, factorScores, candidate);

    return {
      candidate,
      rank: 0, // Will be set after sorting
      score,
      entropyScore,
      factorScores,
      confidence,
      risk,
      explanation: this.generateExplanation(factorScores, score, risk),
    };
  }

  /**
   * Calculate entropy score for a candidate.
   */
  private calculateEntropyScore(candidate: FixCandidate): EntropyScore {
    const { originalCode, fixedCode } = candidate;

    // Tokenize code
    const originalTokens = tokenize(originalCode);
    const fixedTokens = tokenize(fixedCode);

    // Calculate token-level entropy
    const tokenEntropy = calculateTokenEntropy(fixedTokens);

    // Calculate syntactic entropy (based on AST-like structure)
    const syntacticEntropy = calculateSyntacticEntropy(fixedCode);

    // Calculate semantic entropy (difference from original)
    const semanticEntropy = calculateSemanticEntropy(originalTokens, fixedTokens);

    // Total entropy
    const totalEntropy =
      tokenEntropy * 0.4 + syntacticEntropy * 0.3 + semanticEntropy * 0.3;

    // Normalize to 0-1 scale (lower entropy = higher score)
    // Use sigmoid-like transformation
    const normalizedScore = 1 / (1 + totalEntropy / 2);

    return {
      totalEntropy,
      syntacticEntropy,
      semanticEntropy,
      tokenEntropy,
      normalizedScore,
    };
  }

  /**
   * Calculate semantic similarity between original and fixed code.
   */
  private calculateSemanticSimilarity(candidate: FixCandidate): number {
    const { originalCode, fixedCode } = candidate;

    // Simple token-based similarity
    const originalTokens = new Set(tokenize(originalCode));
    const fixedTokens = new Set(tokenize(fixedCode));

    const intersection = new Set(
      [...originalTokens].filter((t) => fixedTokens.has(t))
    );
    const union = new Set([...originalTokens, ...fixedTokens]);

    if (union.size === 0) return 1;

    // Jaccard similarity
    return intersection.size / union.size;
  }

  /**
   * Calculate code naturalness using n-gram model.
   */
  private calculateCodeNaturalness(candidate: FixCandidate): number {
    const { fixedCode } = candidate;
    const tokens = tokenize(fixedCode);

    if (this.config.ngramModel !== undefined) {
      return calculateNgramProbability(tokens, this.config.ngramModel);
    }

    // Use built-in heuristics for naturalness
    return calculateHeuristicNaturalness(fixedCode);
  }

  /**
   * Calculate test pass rate score.
   */
  private calculateTestScore(
    candidate: FixCandidate,
    context: RankingContext
  ): number {
    if (context.testResults === undefined) {
      // No test data, use neutral score
      return 0.5;
    }

    const result = context.testResults.get(candidate.id);
    if (result === undefined) {
      return 0.5;
    }

    return result.passRate;
  }

  /**
   * Calculate change size score (smaller changes preferred).
   */
  private calculateChangeSizeScore(candidate: FixCandidate): number {
    const { originalCode, fixedCode } = candidate;

    // Calculate edit distance ratio
    const editDistance = levenshteinDistance(originalCode, fixedCode);
    const maxLength = Math.max(originalCode.length, fixedCode.length);

    if (maxLength === 0) return 1;

    const changeRatio = editDistance / maxLength;

    // Smaller changes get higher scores
    // Use exponential decay: score decreases as change size increases
    return Math.exp(-changeRatio * 3);
  }

  /**
   * Calculate pattern match score.
   */
  private calculatePatternMatchScore(candidate: FixCandidate): number {
    const { fix, fixedCode } = candidate;

    // Check if fix matches common patterns
    const patterns = [
      // Null check patterns
      { regex: /!==?\s*null|!==?\s*undefined|\?\?|\.?\?/g, boost: 0.1 },
      // Try-catch patterns
      { regex: /try\s*{[\s\S]*?}\s*catch/g, boost: 0.15 },
      // Type casting patterns
      { regex: /as\s+\w+|<\w+>/g, boost: 0.05 },
      // Validation patterns
      { regex: /if\s*\([^)]*(?:length|size|count|typeof)/g, boost: 0.1 },
      // Default value patterns
      { regex: /\|\||\?\?|\?\./g, boost: 0.1 },
    ];

    let score = 0.5; // Base score

    for (const { regex, boost } of patterns) {
      if (regex.test(fixedCode)) {
        score += boost;
      }
    }

    // Check fix description for known patterns
    const description = fix.description.toLowerCase();
    const knownPatterns = [
      'null check',
      'type check',
      'validation',
      'boundary',
      'initialization',
    ];

    for (const pattern of knownPatterns) {
      if (description.includes(pattern)) {
        score += 0.05;
      }
    }

    return Math.min(score, 1);
  }

  /**
   * Calculate type consistency score.
   */
  private calculateTypeConsistencyScore(candidate: FixCandidate): number {
    const { fixedCode } = candidate;

    // Heuristic checks for type consistency
    let score = 0.7; // Base score

    // Check for type annotations
    if (/:\s*\w+/.test(fixedCode)) {
      score += 0.1;
    }

    // Check for explicit type casts
    if (/as\s+\w+|<\w+>/.test(fixedCode)) {
      score += 0.05;
    }

    // Penalize 'any' type usage
    if (/:\s*any\b/.test(fixedCode)) {
      score -= 0.2;
    }

    // Penalize type assertions without checks
    if (/as\s+\w+/.test(fixedCode) && !/typeof|instanceof/.test(fixedCode)) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(score, 1));
  }

  /**
   * Calculate historical success score.
   */
  private calculateHistoricalSuccessScore(candidate: FixCandidate): number {
    if (this.config.historicalData.length === 0) {
      return 0.5; // Neutral score when no history
    }

    // Generate pattern hash for this fix
    const patternHash = generatePatternHash(candidate);

    // Look up historical data
    const historical = this.config.historicalData.find(
      (h) => h.patternHash === patternHash
    );

    if (historical === undefined) {
      return 0.5;
    }

    // Weighted average of success rate and confidence
    const confidenceWeight = Math.min(historical.usageCount / 10, 1);
    return historical.successRate * confidenceWeight + 0.5 * (1 - confidenceWeight);
  }

  /**
   * Calculate confidence in the ranking.
   */
  private calculateConfidence(
    factorScores: FactorScore[],
    entropyScore: EntropyScore
  ): number {
    // Confidence based on:
    // 1. Variance in factor scores (lower variance = higher confidence)
    // 2. Entropy score (lower entropy = higher confidence)
    // 3. Number of high-scoring factors

    const scores = factorScores.map((fs) => fs.rawScore);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;

    const varianceConfidence = 1 - Math.min(variance * 4, 1);
    const entropyConfidence = entropyScore.normalizedScore;
    const highScoreCount = scores.filter((s) => s > 0.7).length;
    const highScoreConfidence = highScoreCount / scores.length;

    return (
      varianceConfidence * 0.3 +
      entropyConfidence * 0.4 +
      highScoreConfidence * 0.3
    );
  }

  /**
   * Assess risk level of a fix.
   */
  private assessRisk(
    score: number,
    factorScores: FactorScore[],
    candidate: FixCandidate
  ): 'low' | 'medium' | 'high' {
    // Risk factors:
    // 1. Low overall score
    // 2. Low test pass rate
    // 3. Large change size
    // 4. Low type consistency

    const testScore =
      factorScores.find((fs) => fs.factor === 'test_pass_rate')?.rawScore ?? 0.5;
    const changeSizeScore =
      factorScores.find((fs) => fs.factor === 'change_size')?.rawScore ?? 0.5;
    const typeScore =
      factorScores.find((fs) => fs.factor === 'type_consistency')?.rawScore ?? 0.5;

    let riskScore = 0;

    if (score < 0.4) riskScore += 2;
    else if (score < 0.6) riskScore += 1;

    if (testScore < 0.5) riskScore += 2;
    else if (testScore < 0.8) riskScore += 1;

    if (changeSizeScore < 0.3) riskScore += 1;

    if (typeScore < 0.5) riskScore += 1;

    // Check for risky patterns
    const riskyPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /innerHTML\s*=/,
      /dangerouslySetInnerHTML/,
    ];

    for (const pattern of riskyPatterns) {
      if (pattern.test(candidate.fixedCode)) {
        riskScore += 2;
      }
    }

    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Generate explanation for a ranking.
   */
  private generateExplanation(
    factorScores: FactorScore[],
    score: number,
    risk: 'low' | 'medium' | 'high'
  ): string {
    const topFactors = [...factorScores]
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3);

    const strengths = topFactors
      .filter((fs) => fs.rawScore > 0.6)
      .map((fs) => fs.explanation);

    const weaknesses = factorScores
      .filter((fs) => fs.rawScore < 0.4)
      .map((fs) => fs.explanation);

    const parts: string[] = [`Overall score: ${(score * 100).toFixed(1)}%`];

    if (strengths.length > 0) {
      parts.push(`Strengths: ${strengths.join(', ')}`);
    }

    if (weaknesses.length > 0) {
      parts.push(`Weaknesses: ${weaknesses.join(', ')}`);
    }

    parts.push(`Risk level: ${risk}`);

    return parts.join('. ');
  }

  /**
   * Generate summary for ranking result.
   */
  private generateSummary(rankedFixes: RankedFix[], totalCandidates: number): string {
    if (rankedFixes.length === 0) {
      return `No fixes passed the minimum score threshold (${this.config.minScore})`;
    }

    const best = rankedFixes[0];
    if (best === undefined) {
      return `No fixes passed the minimum score threshold`;
    }

    const avgScore =
      rankedFixes.reduce((sum, rf) => sum + rf.score, 0) / rankedFixes.length;

    return (
      `Ranked ${rankedFixes.length}/${totalCandidates} candidates. ` +
      `Best: "${best.candidate.fix.description.slice(0, 50)}" ` +
      `(score: ${(best.score * 100).toFixed(1)}%, ` +
      `risk: ${best.risk}). ` +
      `Average score: ${(avgScore * 100).toFixed(1)}%`
    );
  }

  /**
   * Add test results for candidates.
   */
  addTestResults(
    candidates: FixCandidate[],
    testResults: Map<string, FixTestResult>
  ): RankingResult {
    return this.rankCandidates(candidates, { testResults });
  }

  /**
   * Create a fix candidate from a suggestion.
   */
  createCandidate(
    fix: FixSuggestion,
    originalCode: string,
    fixedCode: string,
    file: string,
    location: SourceLocation,
    source: FixCandidate['source'] = 'template'
  ): FixCandidate {
    return {
      id: randomUUID(),
      fix,
      originalCode,
      fixedCode,
      file,
      location,
      source,
      generatedAt: Date.now(),
    };
  }
}

/**
 * Context for ranking operations.
 */
export interface RankingContext {
  /** Test results per candidate */
  testResults?: Map<string, FixTestResult>;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Tokenize code into tokens.
 */
function tokenize(code: string): string[] {
  // Split on whitespace and punctuation, keeping meaningful tokens
  return code
    .split(/(\s+|[{}()\[\];,.<>:=+\-*/%&|^!?@#$~`'"\\])/g)
    .filter((t) => t.trim().length > 0);
}

/**
 * Calculate token-level entropy.
 */
function calculateTokenEntropy(tokens: string[]): number {
  if (tokens.length === 0) return 0;

  // Count token frequencies
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  // Calculate entropy: H = -sum(p * log2(p))
  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / tokens.length;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Calculate syntactic entropy based on code structure.
 */
function calculateSyntacticEntropy(code: string): number {
  // Measure structural complexity
  let entropy = 0;

  // Nesting depth contributes to entropy
  let maxDepth = 0;
  let currentDepth = 0;
  for (const char of code) {
    if (char === '{' || char === '(' || char === '[') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === '}' || char === ')' || char === ']') {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }
  entropy += maxDepth * 0.2;

  // Control flow statements add entropy
  const controlFlowCount = (
    code.match(/\b(if|else|for|while|switch|case|try|catch|throw)\b/g) ?? []
  ).length;
  entropy += controlFlowCount * 0.15;

  // Operators add entropy
  const operatorCount = (code.match(/[+\-*/%&|^!<>=?:]+/g) ?? []).length;
  entropy += operatorCount * 0.05;

  return entropy;
}

/**
 * Calculate semantic entropy between original and fixed tokens.
 */
function calculateSemanticEntropy(
  originalTokens: string[],
  fixedTokens: string[]
): number {
  // Calculate how different the token distributions are
  const originalSet = new Set(originalTokens);
  const fixedSet = new Set(fixedTokens);

  // Tokens only in original (removed)
  const removed = [...originalSet].filter((t) => !fixedSet.has(t));

  // Tokens only in fixed (added)
  const added = [...fixedSet].filter((t) => !originalSet.has(t));

  // Entropy based on change
  const totalUnique = new Set([...originalSet, ...fixedSet]).size;
  if (totalUnique === 0) return 0;

  const changeRatio = (removed.length + added.length) / totalUnique;
  return changeRatio * 2; // Scale up
}

/**
 * Calculate n-gram probability.
 */
function calculateNgramProbability(tokens: string[], model: NGramModel): number {
  if (tokens.length < model.n || model.totalTokens === 0) {
    return 0.5;
  }

  let logProb = 0;
  let count = 0;

  for (let i = model.n - 1; i < tokens.length; i++) {
    const ngram = tokens.slice(i - model.n + 1, i + 1).join(' ');
    const freq = model.frequencies.get(ngram) ?? 1; // Laplace smoothing
    const prob = freq / model.totalTokens;
    logProb += Math.log(prob);
    count++;
  }

  if (count === 0) return 0.5;

  // Convert log probability to score (higher is better)
  const avgLogProb = logProb / count;
  return 1 / (1 + Math.exp(-avgLogProb - 10)); // Sigmoid normalization
}

/**
 * Calculate heuristic naturalness score.
 */
function calculateHeuristicNaturalness(code: string): number {
  let score = 0.5;

  // Consistent indentation
  const lines = code.split('\n');
  const indentations = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      const match = l.match(/^(\s*)/);
      return match?.[1]?.length ?? 0;
    });

  if (indentations.length > 1) {
    const uniqueIndents = new Set(indentations);
    // Check if indentation follows a pattern (multiples of 2 or 4)
    const consistentIndent = [...uniqueIndents].every(
      (i) => i % 2 === 0 || i % 4 === 0
    );
    if (consistentIndent) score += 0.1;
  }

  // Balanced brackets
  const brackets = { '{': 0, '(': 0, '[': 0 };
  for (const char of code) {
    if (char === '{') brackets['{']++;
    if (char === '}') brackets['{']--;
    if (char === '(') brackets['(']++;
    if (char === ')') brackets['(']--;
    if (char === '[') brackets['[']++;
    if (char === ']') brackets['[']--;
  }
  if (Object.values(brackets).every((b) => b === 0)) {
    score += 0.15;
  }

  // Reasonable line length
  const longLines = lines.filter((l) => l.length > 120).length;
  if (longLines === 0) score += 0.1;

  // Has comments (indicates well-documented code)
  if (/\/\/|\/\*|\*\/|#/.test(code)) {
    score += 0.05;
  }

  // Uses common idioms
  if (/===|!==/.test(code)) score += 0.05; // Strict equality
  if (/const\s|let\s/.test(code)) score += 0.05; // Modern variable declarations

  return Math.min(score, 1);
}

/**
 * Calculate Levenshtein edit distance.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create matrix with proper dimensions
  const rows = b.length + 1;
  const cols = a.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i]![0] = i;
  }
  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const row = matrix[i]!;
      const prevRow = matrix[i - 1]!;
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        row[j] = prevRow[j - 1]!;
      } else {
        row[j] = Math.min(
          prevRow[j - 1]! + 1, // Substitution
          row[j - 1]! + 1, // Insertion
          prevRow[j]! + 1 // Deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Generate pattern hash for a fix.
 */
function generatePatternHash(candidate: FixCandidate): string {
  // Create a simplified representation of the fix pattern
  const { originalCode, fixedCode } = candidate;

  // Normalize code for pattern matching
  const normalizedOriginal = normalizeForPattern(originalCode);
  const normalizedFixed = normalizeForPattern(fixedCode);

  // Simple hash based on transformation type
  const diff = `${normalizedOriginal}|${normalizedFixed}`;
  return simpleHash(diff);
}

/**
 * Normalize code for pattern matching.
 */
function normalizeForPattern(code: string): string {
  return code
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/['"][^'"]*['"]/g, 'STR') // Replace strings
    .replace(/\d+/g, 'NUM') // Replace numbers
    .replace(/\b[a-z_][a-z0-9_]*\b/gi, 'ID') // Replace identifiers
    .trim();
}

/**
 * Simple string hash function.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a fix ranker with default configuration.
 */
export function createFixRanker(config?: FixRankerConfig): FixRanker {
  return new FixRanker(config);
}

/**
 * Convenience function to rank fix candidates.
 */
export function rankFixes(
  candidates: FixCandidate[],
  context?: RankingContext,
  config?: FixRankerConfig
): RankingResult {
  const ranker = createFixRanker(config);
  return ranker.rankCandidates(candidates, context);
}

/**
 * Create a fix candidate.
 */
export function createFixCandidate(
  fix: FixSuggestion,
  originalCode: string,
  fixedCode: string,
  file: string,
  location: SourceLocation,
  source?: FixCandidate['source']
): FixCandidate {
  return {
    id: randomUUID(),
    fix,
    originalCode,
    fixedCode,
    file,
    location,
    source: source ?? 'template',
    generatedAt: Date.now(),
  };
}

/**
 * Build an n-gram model from code samples.
 */
export function buildNGramModel(codeSamples: string[], n: number = 3): NGramModel {
  const frequencies = new Map<string, number>();
  let totalTokens = 0;

  for (const code of codeSamples) {
    const tokens = tokenize(code);
    for (let i = n - 1; i < tokens.length; i++) {
      const ngram = tokens.slice(i - n + 1, i + 1).join(' ');
      frequencies.set(ngram, (frequencies.get(ngram) ?? 0) + 1);
      totalTokens++;
    }
  }

  return { n, frequencies, totalTokens };
}

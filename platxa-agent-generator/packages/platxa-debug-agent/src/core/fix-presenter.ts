/**
 * Fix Presenter
 *
 * Presents alternative fix suggestions with trade-off analysis,
 * helping developers choose the best approach for their situation.
 *
 * @module fix-presenter
 */

import type { FixSuggestion } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Presentation output format
 */
export type PresentationFormat = 'terminal' | 'markdown' | 'html' | 'json';

/**
 * Fix selection criteria
 */
export type SelectionCriteria =
  | 'confidence'
  | 'simplicity'
  | 'safety'
  | 'coverage'
  | 'minimal_changes';

/**
 * Trade-off category
 */
export type TradeoffCategory =
  | 'complexity'
  | 'risk'
  | 'coverage'
  | 'maintainability'
  | 'performance';

/**
 * Trade-off analysis for a fix
 */
export interface TradeoffAnalysis {
  /** Category of trade-off */
  category: TradeoffCategory;
  /** Score (0-1, higher is better) */
  score: number;
  /** Description of trade-off */
  description: string;
  /** Pros for this category */
  pros: string[];
  /** Cons for this category */
  cons: string[];
}

/**
 * Fix comparison result
 */
export interface FixComparison {
  /** Fix being compared */
  fix: FixSuggestion;
  /** Overall rank */
  rank: number;
  /** Overall score */
  overallScore: number;
  /** Trade-off analyses */
  tradeoffs: TradeoffAnalysis[];
  /** Summary of pros */
  pros: string[];
  /** Summary of cons */
  cons: string[];
  /** Recommendation */
  recommendation: string;
  /** When to use this fix */
  whenToUse: string[];
  /** When to avoid this fix */
  whenToAvoid: string[];
}

/**
 * Presentation result
 */
export interface FixPresentationResult {
  /** Compared fixes */
  comparisons: FixComparison[];
  /** Recommended fix (top ranked) */
  recommended: FixComparison;
  /** Summary of all options */
  summary: string;
  /** Formatted output */
  output: string;
  /** Decision guidance */
  guidance: string;
}

/**
 * Fix presenter configuration
 */
export interface FixPresenterConfig {
  /** Output format */
  format?: PresentationFormat;
  /** Maximum fixes to present */
  maxFixes?: number;
  /** Selection criteria weights */
  criteriaWeights?: Partial<Record<SelectionCriteria, number>>;
  /** Show trade-off details */
  showTradeoffs?: boolean;
  /** Show code previews */
  showCodePreviews?: boolean;
  /** Colorize output (for terminal) */
  colorize?: boolean;
}

// =============================================================================
// Fix Presenter Implementation
// =============================================================================

/**
 * Presents alternative fix suggestions with trade-off analysis.
 */
export class FixPresenter {
  private readonly config: Required<FixPresenterConfig>;

  constructor(config: Partial<FixPresenterConfig> = {}) {
    this.config = {
      format: config.format ?? 'terminal',
      maxFixes: config.maxFixes ?? 3,
      criteriaWeights: {
        confidence: config.criteriaWeights?.confidence ?? 0.3,
        simplicity: config.criteriaWeights?.simplicity ?? 0.2,
        safety: config.criteriaWeights?.safety ?? 0.25,
        coverage: config.criteriaWeights?.coverage ?? 0.15,
        minimal_changes: config.criteriaWeights?.minimal_changes ?? 0.1,
      },
      showTradeoffs: config.showTradeoffs ?? true,
      showCodePreviews: config.showCodePreviews ?? true,
      colorize: config.colorize ?? true,
    };
  }

  /**
   * Present alternative fixes for comparison.
   */
  present(fixes: FixSuggestion[]): FixPresentationResult {
    // Analyze and rank fixes
    const comparisons = fixes
      .slice(0, this.config.maxFixes)
      .map((fix, index) => this.analyzeFix(fix, index + 1));

    // Sort by overall score
    comparisons.sort((a, b) => b.overallScore - a.overallScore);

    // Update ranks after sorting
    comparisons.forEach((c, i) => {
      c.rank = i + 1;
    });

    const recommended = comparisons[0]!;
    const summary = this.generateSummary(comparisons);
    const guidance = this.generateGuidance(comparisons);
    const output = this.formatOutput(comparisons, recommended, summary, guidance);

    return {
      comparisons,
      recommended,
      summary,
      output,
      guidance,
    };
  }

  /**
   * Compare two specific fixes.
   */
  compareTwoFixes(
    fix1: FixSuggestion,
    fix2: FixSuggestion
  ): {
    comparison: string;
    winner: FixSuggestion;
    reasoning: string[];
  } {
    const analysis1 = this.analyzeFix(fix1, 1);
    const analysis2 = this.analyzeFix(fix2, 2);

    const winner = analysis1.overallScore >= analysis2.overallScore ? fix1 : fix2;
    const winnerAnalysis = winner === fix1 ? analysis1 : analysis2;
    const loserAnalysis = winner === fix1 ? analysis2 : analysis1;

    const reasoning: string[] = [];

    // Compare each category
    for (const category of ['complexity', 'risk', 'coverage', 'maintainability'] as TradeoffCategory[]) {
      const winnerTradeoff = winnerAnalysis.tradeoffs.find(t => t.category === category);
      const loserTradeoff = loserAnalysis.tradeoffs.find(t => t.category === category);

      if (winnerTradeoff !== undefined && loserTradeoff !== undefined) {
        if (winnerTradeoff.score > loserTradeoff.score) {
          reasoning.push(`Better ${category}: ${winnerTradeoff.description}`);
        }
      }
    }

    const comparison = this.formatComparison(analysis1, analysis2);

    return { comparison, winner, reasoning };
  }

  /**
   * Get fix recommendation based on specific criteria.
   */
  recommendByCriteria(
    fixes: FixSuggestion[],
    criteria: SelectionCriteria
  ): FixSuggestion {
    const scored = fixes.map(fix => ({
      fix,
      score: this.scoreByCriteria(fix, criteria),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0]!.fix;
  }

  // ===========================================================================
  // Analysis
  // ===========================================================================

  /**
   * Analyze a fix and generate comparison data.
   */
  private analyzeFix(fix: FixSuggestion, rank: number): FixComparison {
    const tradeoffs = this.analyzeTradeoffs(fix);
    const overallScore = this.calculateOverallScore(fix, tradeoffs);
    const pros = this.identifyPros(fix, tradeoffs);
    const cons = this.identifyCons(fix, tradeoffs);
    const recommendation = this.generateFixRecommendation(fix, tradeoffs);
    const whenToUse = this.identifyWhenToUse(fix, tradeoffs);
    const whenToAvoid = this.identifyWhenToAvoid(fix, tradeoffs);

    return {
      fix,
      rank,
      overallScore,
      tradeoffs,
      pros,
      cons,
      recommendation,
      whenToUse,
      whenToAvoid,
    };
  }

  /**
   * Analyze trade-offs for a fix.
   */
  private analyzeTradeoffs(fix: FixSuggestion): TradeoffAnalysis[] {
    const tradeoffs: TradeoffAnalysis[] = [];

    // Complexity analysis
    tradeoffs.push(this.analyzeComplexity(fix));

    // Risk analysis
    tradeoffs.push(this.analyzeRisk(fix));

    // Coverage analysis
    tradeoffs.push(this.analyzeCoverage(fix));

    // Maintainability analysis
    tradeoffs.push(this.analyzeMaintainability(fix));

    // Performance analysis
    tradeoffs.push(this.analyzePerformance(fix));

    return tradeoffs;
  }

  /**
   * Analyze complexity trade-off.
   */
  private analyzeComplexity(fix: FixSuggestion): TradeoffAnalysis {
    const changeCount = fix.changes.length;
    const totalLines = fix.changes.reduce((sum, c) => {
      const newLines = (c.newContent ?? '').split('\n').length;
      return sum + newLines;
    }, 0);

    let score: number;
    let description: string;
    const pros: string[] = [];
    const cons: string[] = [];

    if (changeCount === 1 && totalLines <= 5) {
      score = 0.95;
      description = 'Very simple, single-location fix';
      pros.push('Minimal code changes');
      pros.push('Easy to review');
    } else if (changeCount <= 2 && totalLines <= 15) {
      score = 0.8;
      description = 'Simple fix with limited scope';
      pros.push('Relatively straightforward');
    } else if (changeCount <= 4 && totalLines <= 30) {
      score = 0.6;
      description = 'Moderate complexity';
      cons.push('Multiple files affected');
    } else {
      score = 0.3;
      description = 'Complex fix with multiple changes';
      cons.push('High complexity');
      cons.push('Careful review required');
    }

    return {
      category: 'complexity',
      score,
      description,
      pros,
      cons,
    };
  }

  /**
   * Analyze risk trade-off.
   */
  private analyzeRisk(fix: FixSuggestion): TradeoffAnalysis {
    const hasTests = fix.validationSteps.some(s => s.type === 'test');
    const hasTypeCheck = fix.validationSteps.some(s => s.type === 'typecheck');
    const hasDeletes = fix.changes.some(c => c.type === 'delete');
    const confidence = fix.confidence;

    let score = confidence;
    const pros: string[] = [];
    const cons: string[] = [];

    if (hasTests) {
      score = Math.min(1, score + 0.1);
      pros.push('Test verification included');
    } else {
      cons.push('No test verification');
    }

    if (hasTypeCheck) {
      score = Math.min(1, score + 0.05);
      pros.push('Type checking included');
    }

    if (hasDeletes) {
      score = Math.max(0, score - 0.1);
      cons.push('Involves code deletion');
    }

    let description: string;
    if (score >= 0.8) {
      description = 'Low risk fix with good validation';
    } else if (score >= 0.6) {
      description = 'Moderate risk, review recommended';
    } else if (score >= 0.4) {
      description = 'Higher risk, careful testing needed';
    } else {
      description = 'High risk, thorough review required';
    }

    return {
      category: 'risk',
      score,
      description,
      pros,
      cons,
    };
  }

  /**
   * Analyze coverage trade-off.
   */
  private analyzeCoverage(fix: FixSuggestion): TradeoffAnalysis {
    const changeCount = fix.changes.length;
    const hasValidation = fix.validationSteps.length > 0;
    const fixType = fix.type;

    let score: number;
    let description: string;
    const pros: string[] = [];
    const cons: string[] = [];

    // Template fixes typically have better coverage
    if (fixType === 'template') {
      score = 0.85;
      description = 'Pattern-based fix with proven coverage';
      pros.push('Addresses common edge cases');
    } else if (fixType === 'retrieved') {
      score = 0.75;
      description = 'Based on similar past fixes';
      pros.push('Learned from historical issues');
    } else {
      score = 0.6;
      description = 'Generated fix - verify edge cases';
      cons.push('May miss edge cases');
    }

    if (hasValidation) {
      score = Math.min(1, score + 0.1);
      pros.push('Includes validation steps');
    }

    if (changeCount > 3) {
      score = Math.min(1, score + 0.05);
      pros.push('Comprehensive fix');
    }

    return {
      category: 'coverage',
      score,
      description,
      pros,
      cons,
    };
  }

  /**
   * Analyze maintainability trade-off.
   */
  private analyzeMaintainability(fix: FixSuggestion): TradeoffAnalysis {
    const changes = fix.changes;
    const pros: string[] = [];
    const cons: string[] = [];

    // Analyze code patterns
    let score = 0.7;
    let description = 'Standard maintainability';

    // Check for good practices in changes
    for (const change of changes) {
      const content = change.newContent ?? '';

      // Positive patterns
      if (content.includes('// ') || content.includes('# ')) {
        score = Math.min(1, score + 0.05);
        if (!pros.includes('Includes comments')) {
          pros.push('Includes comments');
        }
      }

      // Check for error handling
      if (content.includes('try') || content.includes('catch') || content.includes('except')) {
        score = Math.min(1, score + 0.05);
        if (!pros.includes('Includes error handling')) {
          pros.push('Includes error handling');
        }
      }

      // Negative patterns
      if (content.includes('TODO') || content.includes('FIXME')) {
        score = Math.max(0, score - 0.1);
        cons.push('Contains TODO/FIXME markers');
      }

      // Very long lines suggest poor formatting
      const hasLongLines = content.split('\n').some(line => line.length > 120);
      if (hasLongLines) {
        score = Math.max(0, score - 0.05);
        cons.push('Contains long lines');
      }
    }

    if (score >= 0.8) {
      description = 'Good maintainability practices';
    } else if (score >= 0.6) {
      description = 'Acceptable maintainability';
    } else {
      description = 'Maintainability concerns';
    }

    return {
      category: 'maintainability',
      score,
      description,
      pros,
      cons,
    };
  }

  /**
   * Analyze performance trade-off.
   */
  private analyzePerformance(fix: FixSuggestion): TradeoffAnalysis {
    const changes = fix.changes;
    const pros: string[] = [];
    const cons: string[] = [];
    let score = 0.8; // Default to neutral

    for (const change of changes) {
      const content = change.newContent ?? '';

      // Check for potential performance issues
      if (content.includes('while (true)') || content.includes('while True')) {
        score = Math.max(0, score - 0.2);
        cons.push('Contains infinite loop pattern');
      }

      // Nested loops
      const loopCount = (content.match(/for|while/g) ?? []).length;
      if (loopCount > 2) {
        score = Math.max(0, score - 0.1);
        cons.push('Multiple nested loops');
      }

      // Positive patterns
      if (content.includes('cache') || content.includes('memoize')) {
        score = Math.min(1, score + 0.1);
        pros.push('Uses caching');
      }
    }

    let description: string;
    if (score >= 0.8) {
      description = 'No performance concerns';
    } else if (score >= 0.6) {
      description = 'Minor performance considerations';
    } else {
      description = 'Potential performance impact';
    }

    return {
      category: 'performance',
      score,
      description,
      pros,
      cons,
    };
  }

  /**
   * Calculate overall score for a fix.
   */
  private calculateOverallScore(
    fix: FixSuggestion,
    tradeoffs: TradeoffAnalysis[]
  ): number {
    const weights = this.config.criteriaWeights;

    // Map tradeoff categories to criteria
    const categoryToCriteria: Record<TradeoffCategory, SelectionCriteria> = {
      complexity: 'simplicity',
      risk: 'safety',
      coverage: 'coverage',
      maintainability: 'minimal_changes',
      performance: 'minimal_changes',
    };

    let weightedSum = 0;
    let totalWeight = 0;

    // Include base confidence
    weightedSum += fix.confidence * (weights.confidence ?? 0.3);
    totalWeight += weights.confidence ?? 0.3;

    // Include tradeoff scores
    for (const tradeoff of tradeoffs) {
      const criteria = categoryToCriteria[tradeoff.category];
      const weight = weights[criteria] ?? 0.1;
      weightedSum += tradeoff.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Score a fix by specific criteria.
   */
  private scoreByCriteria(fix: FixSuggestion, criteria: SelectionCriteria): number {
    switch (criteria) {
      case 'confidence':
        return fix.confidence;

      case 'simplicity': {
        const changes = fix.changes.length;
        return changes <= 1 ? 1 : changes <= 3 ? 0.7 : changes <= 5 ? 0.4 : 0.2;
      }

      case 'safety': {
        const hasValidation = fix.validationSteps.length > 0;
        return fix.confidence * (hasValidation ? 1.2 : 0.8);
      }

      case 'coverage':
        return fix.type === 'template' ? 0.9 : fix.type === 'retrieved' ? 0.7 : 0.5;

      case 'minimal_changes': {
        const totalLines = fix.changes.reduce((sum, c) => sum + ((c.newContent ?? '').split('\n').length), 0);
        return totalLines <= 5 ? 1 : totalLines <= 15 ? 0.7 : totalLines <= 30 ? 0.4 : 0.2;
      }

      default:
        return fix.confidence;
    }
  }

  // ===========================================================================
  // Identification Helpers
  // ===========================================================================

  /**
   * Identify pros for a fix.
   */
  private identifyPros(fix: FixSuggestion, tradeoffs: TradeoffAnalysis[]): string[] {
    const pros: string[] = [];

    // From fix properties
    if (fix.confidence >= 0.8) {
      pros.push('High confidence fix');
    }

    if (fix.type === 'template') {
      pros.push('Based on proven pattern');
    }

    if (fix.changes.length === 1) {
      pros.push('Single file change');
    }

    // From tradeoffs
    for (const tradeoff of tradeoffs) {
      if (tradeoff.score >= 0.7) {
        pros.push(...tradeoff.pros);
      }
    }

    return [...new Set(pros)].slice(0, 5);
  }

  /**
   * Identify cons for a fix.
   */
  private identifyCons(fix: FixSuggestion, tradeoffs: TradeoffAnalysis[]): string[] {
    const cons: string[] = [];

    // From fix properties
    if (fix.confidence < 0.5) {
      cons.push('Lower confidence');
    }

    if (fix.changes.length > 3) {
      cons.push('Multiple files affected');
    }

    if (fix.validationSteps.length === 0) {
      cons.push('No validation steps defined');
    }

    // From tradeoffs
    for (const tradeoff of tradeoffs) {
      if (tradeoff.score < 0.5) {
        cons.push(...tradeoff.cons);
      }
    }

    return [...new Set(cons)].slice(0, 5);
  }

  /**
   * Generate recommendation for a fix.
   */
  private generateFixRecommendation(
    fix: FixSuggestion,
    tradeoffs: TradeoffAnalysis[]
  ): string {
    const avgScore = tradeoffs.reduce((sum, t) => sum + t.score, 0) / tradeoffs.length;

    if (fix.confidence >= 0.8 && avgScore >= 0.7) {
      return 'Highly recommended - safe to apply with standard review';
    } else if (fix.confidence >= 0.6 && avgScore >= 0.5) {
      return 'Recommended with careful review';
    } else if (fix.confidence >= 0.4) {
      return 'Consider with thorough testing';
    } else {
      return 'Use with caution - manual review required';
    }
  }

  /**
   * Identify when to use a fix.
   */
  private identifyWhenToUse(fix: FixSuggestion, tradeoffs: TradeoffAnalysis[]): string[] {
    const whenToUse: string[] = [];

    if (fix.confidence >= 0.8) {
      whenToUse.push('When you need a reliable fix quickly');
    }

    const complexity = tradeoffs.find(t => t.category === 'complexity');
    if (complexity !== undefined && complexity.score >= 0.8) {
      whenToUse.push('When simplicity is important');
    }

    if (fix.type === 'template') {
      whenToUse.push('When following established patterns');
    }

    const risk = tradeoffs.find(t => t.category === 'risk');
    if (risk !== undefined && risk.score >= 0.8) {
      whenToUse.push('When risk must be minimized');
    }

    return whenToUse;
  }

  /**
   * Identify when to avoid a fix.
   */
  private identifyWhenToAvoid(fix: FixSuggestion, tradeoffs: TradeoffAnalysis[]): string[] {
    const whenToAvoid: string[] = [];

    if (fix.confidence < 0.5) {
      whenToAvoid.push('When high certainty is required');
    }

    const complexity = tradeoffs.find(t => t.category === 'complexity');
    if (complexity !== undefined && complexity.score < 0.4) {
      whenToAvoid.push('When minimal changes are preferred');
    }

    const risk = tradeoffs.find(t => t.category === 'risk');
    if (risk !== undefined && risk.score < 0.5) {
      whenToAvoid.push('In production-critical code without thorough testing');
    }

    if (fix.changes.some(c => c.type === 'delete')) {
      whenToAvoid.push('When code deletion is risky');
    }

    return whenToAvoid;
  }

  // ===========================================================================
  // Summary Generation
  // ===========================================================================

  /**
   * Generate summary of all fixes.
   */
  private generateSummary(comparisons: FixComparison[]): string {
    if (comparisons.length === 0) {
      return 'No fix suggestions available.';
    }

    const best = comparisons[0]!;
    const parts: string[] = [];

    parts.push(`Analyzed ${comparisons.length} fix option(s).`);
    parts.push(`Recommended: "${best.fix.description}" with ${Math.round(best.overallScore * 100)}% overall score.`);

    if (comparisons.length > 1) {
      const others = comparisons.slice(1);
      parts.push(`Alternative(s): ${others.map(c => `"${c.fix.description}" (${Math.round(c.overallScore * 100)}%)`).join(', ')}`);
    }

    return parts.join(' ');
  }

  /**
   * Generate decision guidance.
   */
  private generateGuidance(comparisons: FixComparison[]): string {
    if (comparisons.length === 0) {
      return 'No fixes to compare.';
    }

    const parts: string[] = [];

    const best = comparisons[0]!;
    const scoreDiff = comparisons.length > 1
      ? best.overallScore - comparisons[1]!.overallScore
      : 0;

    if (scoreDiff > 0.2) {
      parts.push('The top recommendation is significantly better than alternatives.');
    } else if (scoreDiff > 0.1) {
      parts.push('The top recommendation has a moderate advantage.');
    } else if (comparisons.length > 1) {
      parts.push('The top options are similar - consider your specific priorities.');
    }

    // Add specific guidance based on tradeoffs
    const topTradeoffs = best.tradeoffs.filter(t => t.score >= 0.8);
    if (topTradeoffs.length > 0) {
      parts.push(`Strengths: ${topTradeoffs.map(t => t.category).join(', ')}.`);
    }

    const weakTradeoffs = best.tradeoffs.filter(t => t.score < 0.5);
    if (weakTradeoffs.length > 0) {
      parts.push(`Areas of caution: ${weakTradeoffs.map(t => t.category).join(', ')}.`);
    }

    return parts.join(' ');
  }

  // ===========================================================================
  // Output Formatting
  // ===========================================================================

  /**
   * Format output based on configuration.
   */
  private formatOutput(
    comparisons: FixComparison[],
    recommended: FixComparison,
    summary: string,
    guidance: string
  ): string {
    switch (this.config.format) {
      case 'terminal':
        return this.formatTerminal(comparisons, recommended, summary, guidance);
      case 'markdown':
        return this.formatMarkdown(comparisons, recommended, summary, guidance);
      case 'html':
        return this.formatHtml(comparisons, recommended, summary, guidance);
      case 'json':
        return this.formatJson(comparisons, recommended, summary, guidance);
      default:
        return this.formatTerminal(comparisons, recommended, summary, guidance);
    }
  }

  /**
   * Format for terminal.
   */
  private formatTerminal(
    comparisons: FixComparison[],
    _recommended: FixComparison,
    summary: string,
    guidance: string
  ): string {
    const lines: string[] = [];

    lines.push(this.colorize('═'.repeat(60), 'cyan'));
    lines.push(this.colorize('  FIX ALTERNATIVES COMPARISON', 'cyan'));
    lines.push(this.colorize('═'.repeat(60), 'cyan'));
    lines.push('');
    lines.push(summary);
    lines.push('');

    for (const comparison of comparisons) {
      const rankColor = comparison.rank === 1 ? 'green' : 'yellow';
      const scoreBar = this.generateScoreBar(comparison.overallScore);

      lines.push(this.colorize(`━━━ Option ${comparison.rank} ━━━`, rankColor));
      lines.push(`  ${comparison.fix.description}`);
      lines.push(`  Score: ${scoreBar} ${Math.round(comparison.overallScore * 100)}%`);
      lines.push(`  Confidence: ${Math.round(comparison.fix.confidence * 100)}%`);
      lines.push('');

      if (this.config.showTradeoffs) {
        lines.push('  Trade-offs:');
        for (const tradeoff of comparison.tradeoffs) {
          const icon = tradeoff.score >= 0.7 ? '✓' : tradeoff.score >= 0.4 ? '○' : '✗';
          lines.push(`    ${icon} ${tradeoff.category}: ${tradeoff.description}`);
        }
        lines.push('');
      }

      if (comparison.pros.length > 0) {
        lines.push(this.colorize('  Pros:', 'green'));
        for (const pro of comparison.pros.slice(0, 3)) {
          lines.push(`    + ${pro}`);
        }
      }

      if (comparison.cons.length > 0) {
        lines.push(this.colorize('  Cons:', 'red'));
        for (const con of comparison.cons.slice(0, 3)) {
          lines.push(`    - ${con}`);
        }
      }

      lines.push('');
      lines.push(`  ${comparison.recommendation}`);
      lines.push('');
    }

    lines.push(this.colorize('─'.repeat(60), 'cyan'));
    lines.push(this.colorize('Guidance:', 'cyan'));
    lines.push(guidance);
    lines.push(this.colorize('═'.repeat(60), 'cyan'));

    return lines.join('\n');
  }

  /**
   * Format as markdown.
   */
  private formatMarkdown(
    comparisons: FixComparison[],
    _recommended: FixComparison,
    summary: string,
    guidance: string
  ): string {
    const lines: string[] = [];

    lines.push('## Fix Alternatives Comparison\n');
    lines.push(summary);
    lines.push('');

    for (const comparison of comparisons) {
      const badge = comparison.rank === 1 ? ' 🏆 Recommended' : '';
      lines.push(`### Option ${comparison.rank}${badge}\n`);
      lines.push(`**${comparison.fix.description}**\n`);
      lines.push(`- **Overall Score:** ${Math.round(comparison.overallScore * 100)}%`);
      lines.push(`- **Confidence:** ${Math.round(comparison.fix.confidence * 100)}%`);
      lines.push('');

      if (this.config.showTradeoffs) {
        lines.push('#### Trade-offs\n');
        lines.push('| Category | Score | Assessment |');
        lines.push('|----------|-------|------------|');
        for (const tradeoff of comparison.tradeoffs) {
          lines.push(`| ${tradeoff.category} | ${Math.round(tradeoff.score * 100)}% | ${tradeoff.description} |`);
        }
        lines.push('');
      }

      if (comparison.pros.length > 0) {
        lines.push('**Pros:**');
        for (const pro of comparison.pros) {
          lines.push(`- ✅ ${pro}`);
        }
        lines.push('');
      }

      if (comparison.cons.length > 0) {
        lines.push('**Cons:**');
        for (const con of comparison.cons) {
          lines.push(`- ⚠️ ${con}`);
        }
        lines.push('');
      }

      lines.push(`> ${comparison.recommendation}\n`);
    }

    lines.push('---\n');
    lines.push('### Guidance\n');
    lines.push(guidance);

    return lines.join('\n');
  }

  /**
   * Format as HTML.
   */
  private formatHtml(
    comparisons: FixComparison[],
    _recommended: FixComparison,
    summary: string,
    guidance: string
  ): string {
    const lines: string[] = [];

    lines.push('<div class="fix-comparison">');
    lines.push('<h2>Fix Alternatives Comparison</h2>');
    lines.push(`<p class="summary">${summary}</p>`);

    for (const comparison of comparisons) {
      const rankClass = comparison.rank === 1 ? 'recommended' : '';
      lines.push(`<div class="fix-option ${rankClass}">`);
      lines.push(`<h3>Option ${comparison.rank}${comparison.rank === 1 ? ' <span class="badge">Recommended</span>' : ''}</h3>`);
      lines.push(`<p class="description">${comparison.fix.description}</p>`);
      lines.push(`<div class="scores">`);
      lines.push(`<span>Overall: ${Math.round(comparison.overallScore * 100)}%</span>`);
      lines.push(`<span>Confidence: ${Math.round(comparison.fix.confidence * 100)}%</span>`);
      lines.push('</div>');
      lines.push(`<p class="recommendation">${comparison.recommendation}</p>`);
      lines.push('</div>');
    }

    lines.push(`<div class="guidance"><h3>Guidance</h3><p>${guidance}</p></div>`);
    lines.push('</div>');

    return lines.join('\n');
  }

  /**
   * Format as JSON.
   */
  private formatJson(
    comparisons: FixComparison[],
    recommended: FixComparison,
    summary: string,
    guidance: string
  ): string {
    return JSON.stringify({
      summary,
      guidance,
      recommended: {
        description: recommended.fix.description,
        score: recommended.overallScore,
        confidence: recommended.fix.confidence,
      },
      alternatives: comparisons.map(c => ({
        rank: c.rank,
        description: c.fix.description,
        overallScore: c.overallScore,
        confidence: c.fix.confidence,
        pros: c.pros,
        cons: c.cons,
        recommendation: c.recommendation,
      })),
    }, null, 2);
  }

  /**
   * Format comparison between two fixes.
   */
  private formatComparison(fix1: FixComparison, fix2: FixComparison): string {
    const lines: string[] = [];

    lines.push('Fix Comparison:');
    lines.push('');
    lines.push(`Option 1: ${fix1.fix.description}`);
    lines.push(`  Score: ${Math.round(fix1.overallScore * 100)}%`);
    lines.push('');
    lines.push(`Option 2: ${fix2.fix.description}`);
    lines.push(`  Score: ${Math.round(fix2.overallScore * 100)}%`);
    lines.push('');

    const winner = fix1.overallScore >= fix2.overallScore ? 'Option 1' : 'Option 2';
    lines.push(`Winner: ${winner}`);

    return lines.join('\n');
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  private generateScoreBar(score: number): string {
    const width = 10;
    const filled = Math.round(score * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  private colorize(text: string, color: string): string {
    if (!this.config.colorize || this.config.format !== 'terminal') {
      return text;
    }

    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      cyan: '\x1b[36m',
      default: '\x1b[0m',
    };

    const colorCode = colors[color] ?? colors['default'];
    return `${colorCode}${text}\x1b[0m`;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a fix presenter with default configuration.
 */
export function createFixPresenter(
  config?: Partial<FixPresenterConfig>
): FixPresenter {
  return new FixPresenter(config);
}

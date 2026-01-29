/**
 * Confidence Display
 *
 * Displays confidence levels and evidence summaries in various formats.
 * Helps developers understand how confident the debugging agent is
 * in its analysis and suggestions.
 *
 * @module confidence-display
 */

import type { Evidence, RootCauseHypothesis, FixSuggestion } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Confidence level category
 */
export type ConfidenceCategory = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

/**
 * Display output format
 */
export type DisplayFormat = 'terminal' | 'markdown' | 'html' | 'json' | 'plain';

/**
 * Evidence category for grouping
 */
export type EvidenceCategory = 'code' | 'error' | 'test' | 'history' | 'pattern' | 'static_analysis';

/**
 * Confidence indicator style
 */
export type IndicatorStyle = 'bar' | 'emoji' | 'percentage' | 'stars' | 'gauge';

/**
 * Confidence breakdown by category
 */
export interface ConfidenceBreakdown {
  /** Category name */
  category: string;
  /** Confidence score (0-1) */
  score: number;
  /** Weight in overall calculation */
  weight: number;
  /** Contributing factors */
  factors: string[];
}

/**
 * Evidence summary for display
 */
export interface EvidenceSummary {
  /** Evidence category */
  category: EvidenceCategory;
  /** Number of evidence items */
  count: number;
  /** Average strength */
  averageStrength: number;
  /** Key findings */
  keyFindings: string[];
  /** Overall contribution to confidence */
  contribution: number;
}

/**
 * Confidence display result
 */
export interface ConfidenceDisplayResult {
  /** Overall confidence score (0-1) */
  score: number;
  /** Confidence category */
  category: ConfidenceCategory;
  /** Visual indicator */
  indicator: string;
  /** Human-readable description */
  description: string;
  /** Breakdown by category */
  breakdown: ConfidenceBreakdown[];
  /** Evidence summaries */
  evidenceSummaries: EvidenceSummary[];
  /** Formatted output */
  output: string;
  /** Recommendations based on confidence */
  recommendations: string[];
}

/**
 * Confidence display configuration
 */
export interface ConfidenceDisplayConfig {
  /** Output format */
  format?: DisplayFormat;
  /** Indicator style */
  indicatorStyle?: IndicatorStyle;
  /** Show breakdown */
  showBreakdown?: boolean;
  /** Show evidence details */
  showEvidence?: boolean;
  /** Show recommendations */
  showRecommendations?: boolean;
  /** Color output (for terminal) */
  colorize?: boolean;
  /** Bar width for bar indicator */
  barWidth?: number;
}

// =============================================================================
// Confidence Display Implementation
// =============================================================================

/**
 * Displays confidence levels and evidence summaries.
 */
export class ConfidenceDisplay {
  private readonly config: Required<ConfidenceDisplayConfig>;

  constructor(config: Partial<ConfidenceDisplayConfig> = {}) {
    this.config = {
      format: config.format ?? 'terminal',
      indicatorStyle: config.indicatorStyle ?? 'bar',
      showBreakdown: config.showBreakdown ?? true,
      showEvidence: config.showEvidence ?? true,
      showRecommendations: config.showRecommendations ?? true,
      colorize: config.colorize ?? true,
      barWidth: config.barWidth ?? 20,
    };
  }

  /**
   * Display confidence for a hypothesis.
   */
  displayHypothesisConfidence(
    hypothesis: RootCauseHypothesis
  ): ConfidenceDisplayResult {
    const score = hypothesis.confidence;
    const category = this.categorizeConfidence(score);
    const indicator = this.generateIndicator(score);
    const description = this.generateDescription(score, category);
    const breakdown = this.generateBreakdown(hypothesis);
    const evidenceSummaries = this.summarizeEvidence(hypothesis.evidence);
    const recommendations = this.generateRecommendations(score, category, hypothesis);

    const output = this.formatOutput({
      score,
      category,
      indicator,
      description,
      breakdown,
      evidenceSummaries,
      recommendations,
      output: '',
    });

    return {
      score,
      category,
      indicator,
      description,
      breakdown,
      evidenceSummaries,
      output,
      recommendations,
    };
  }

  /**
   * Display confidence for a fix suggestion.
   */
  displayFixConfidence(fix: FixSuggestion): ConfidenceDisplayResult {
    const score = fix.confidence;
    const category = this.categorizeConfidence(score);
    const indicator = this.generateIndicator(score);
    const description = this.generateFixDescription(score, category, fix);
    const breakdown = this.generateFixBreakdown(fix);
    const recommendations = this.generateFixRecommendations(score, category, fix);

    const output = this.formatOutput({
      score,
      category,
      indicator,
      description,
      breakdown,
      evidenceSummaries: [],
      recommendations,
      output: '',
    });

    return {
      score,
      category,
      indicator,
      description,
      breakdown,
      evidenceSummaries: [],
      output,
      recommendations,
    };
  }

  /**
   * Generate a simple confidence indicator.
   */
  generateIndicator(score: number): string {
    switch (this.config.indicatorStyle) {
      case 'bar':
        return this.generateBarIndicator(score);
      case 'emoji':
        return this.generateEmojiIndicator(score);
      case 'percentage':
        return this.generatePercentageIndicator(score);
      case 'stars':
        return this.generateStarsIndicator(score);
      case 'gauge':
        return this.generateGaugeIndicator(score);
      default:
        return this.generateBarIndicator(score);
    }
  }

  /**
   * Compare confidence levels of multiple hypotheses.
   */
  compareConfidences(
    items: Array<{ name: string; confidence: number }>
  ): string {
    const sorted = [...items].sort((a, b) => b.confidence - a.confidence);
    const lines: string[] = [];

    lines.push('Confidence Comparison:');
    lines.push('');

    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i]!;
      const indicator = this.generateIndicator(item.confidence);
      const rank = i + 1;
      lines.push(`${rank}. ${item.name}`);
      lines.push(`   ${indicator} ${Math.round(item.confidence * 100)}%`);
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Confidence Categorization
  // ===========================================================================

  /**
   * Categorize confidence score.
   */
  private categorizeConfidence(score: number): ConfidenceCategory {
    if (score >= 0.9) return 'very_high';
    if (score >= 0.75) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.25) return 'low';
    return 'very_low';
  }

  /**
   * Generate human-readable description.
   */
  private generateDescription(score: number, category: ConfidenceCategory): string {
    const percentage = Math.round(score * 100);

    const descriptions: Record<ConfidenceCategory, string> = {
      very_high: `Very high confidence (${percentage}%). The analysis is strongly supported by multiple evidence sources.`,
      high: `High confidence (${percentage}%). The analysis is well-supported with consistent evidence.`,
      medium: `Medium confidence (${percentage}%). The analysis is reasonably supported but some uncertainty remains.`,
      low: `Low confidence (${percentage}%). The analysis is tentative and should be verified.`,
      very_low: `Very low confidence (${percentage}%). This is a preliminary hypothesis that requires further investigation.`,
    };

    return descriptions[category];
  }

  /**
   * Generate fix-specific description.
   */
  private generateFixDescription(
    score: number,
    category: ConfidenceCategory,
    fix: FixSuggestion
  ): string {
    const percentage = Math.round(score * 100);
    const fixType = fix.type;

    const typeDescriptions: Record<string, string> = {
      template: 'based on a proven fix pattern',
      generated: 'generated from error analysis',
      retrieved: 'retrieved from similar past issues',
    };

    const typeDesc = typeDescriptions[fixType] ?? 'suggested';

    const confidenceDescriptions: Record<ConfidenceCategory, string> = {
      very_high: `Very high confidence (${percentage}%) fix ${typeDesc}. Safe to apply with standard testing.`,
      high: `High confidence (${percentage}%) fix ${typeDesc}. Review recommended before applying.`,
      medium: `Medium confidence (${percentage}%) fix ${typeDesc}. Careful review and testing recommended.`,
      low: `Low confidence (${percentage}%) fix ${typeDesc}. Consider alternative approaches.`,
      very_low: `Experimental fix (${percentage}%) ${typeDesc}. Manual review required before applying.`,
    };

    return confidenceDescriptions[category];
  }

  // ===========================================================================
  // Indicator Generation
  // ===========================================================================

  /**
   * Generate bar indicator.
   */
  private generateBarIndicator(score: number): string {
    const width = this.config.barWidth;
    const filled = Math.round(score * width);
    const empty = width - filled;

    const filledChar = this.config.colorize ? this.colorize('█', this.getConfidenceColor(score)) : '█';
    const emptyChar = '░';

    return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}]`;
  }

  /**
   * Generate emoji indicator.
   */
  private generateEmojiIndicator(score: number): string {
    if (score >= 0.9) return '🟢🟢🟢🟢🟢';
    if (score >= 0.75) return '🟢🟢🟢🟢⚪';
    if (score >= 0.5) return '🟡🟡🟡⚪⚪';
    if (score >= 0.25) return '🟠🟠⚪⚪⚪';
    return '🔴⚪⚪⚪⚪';
  }

  /**
   * Generate percentage indicator.
   */
  private generatePercentageIndicator(score: number): string {
    const percentage = Math.round(score * 100);
    const color = this.getConfidenceColor(score);

    if (this.config.colorize) {
      return this.colorize(`${percentage}%`, color);
    }

    return `${percentage}%`;
  }

  /**
   * Generate stars indicator.
   */
  private generateStarsIndicator(score: number): string {
    const stars = Math.round(score * 5);
    const filled = '★'.repeat(stars);
    const empty = '☆'.repeat(5 - stars);

    if (this.config.colorize) {
      return this.colorize(filled, this.getConfidenceColor(score)) + empty;
    }

    return filled + empty;
  }

  /**
   * Generate gauge indicator.
   */
  private generateGaugeIndicator(score: number): string {
    const percentage = Math.round(score * 100);
    const position = Math.round(score * 10);
    const gauge = '─'.repeat(position) + '●' + '─'.repeat(10 - position);

    return `[${gauge}] ${percentage}%`;
  }

  // ===========================================================================
  // Breakdown Generation
  // ===========================================================================

  /**
   * Generate confidence breakdown for hypothesis.
   */
  private generateBreakdown(hypothesis: RootCauseHypothesis): ConfidenceBreakdown[] {
    const breakdown: ConfidenceBreakdown[] = [];

    // Group evidence by type
    const evidenceByType = this.groupEvidenceByType(hypothesis.evidence);

    // Calculate contribution of each evidence type
    const totalStrength = hypothesis.evidence.reduce((sum, e) => sum + e.strength, 0);

    for (const [type, evidence] of evidenceByType) {
      const typeStrength = evidence.reduce((sum, e) => sum + e.strength, 0);
      const contribution = totalStrength > 0 ? typeStrength / totalStrength : 0;

      breakdown.push({
        category: this.getEvidenceTypeName(type),
        score: evidence.reduce((sum, e) => sum + e.strength, 0) / evidence.length,
        weight: contribution,
        factors: evidence.map(e => e.description),
      });
    }

    // Sort by contribution
    breakdown.sort((a, b) => b.weight - a.weight);

    return breakdown;
  }

  /**
   * Generate confidence breakdown for fix.
   */
  private generateFixBreakdown(fix: FixSuggestion): ConfidenceBreakdown[] {
    const breakdown: ConfidenceBreakdown[] = [];

    // Fix type contribution
    const typeScores: Record<string, number> = {
      template: 0.9,
      retrieved: 0.7,
      generated: 0.5,
    };

    breakdown.push({
      category: 'Fix Pattern',
      score: typeScores[fix.type] ?? 0.5,
      weight: 0.4,
      factors: [`Fix type: ${fix.type}`],
    });

    // Validation steps contribution
    const hasTypeCheck = fix.validationSteps.some(s => s.type === 'typecheck');
    const hasTest = fix.validationSteps.some(s => s.type === 'test');
    const hasLint = fix.validationSteps.some(s => s.type === 'lint');

    const validationScore = (hasTypeCheck ? 0.3 : 0) + (hasTest ? 0.5 : 0) + (hasLint ? 0.2 : 0);

    breakdown.push({
      category: 'Validation',
      score: validationScore,
      weight: 0.3,
      factors: [
        hasTypeCheck ? 'Type checking included' : 'No type checking',
        hasTest ? 'Tests included' : 'No tests',
        hasLint ? 'Linting included' : 'No linting',
      ].filter(f => !f.startsWith('No')),
    });

    // Change complexity contribution
    const changeCount = fix.changes.length;
    const complexityScore = changeCount <= 2 ? 0.9 : changeCount <= 5 ? 0.7 : 0.5;

    breakdown.push({
      category: 'Complexity',
      score: complexityScore,
      weight: 0.3,
      factors: [`${changeCount} file(s) modified`],
    });

    return breakdown;
  }

  // ===========================================================================
  // Evidence Summary
  // ===========================================================================

  /**
   * Summarize evidence by category.
   */
  private summarizeEvidence(evidence: Evidence[]): EvidenceSummary[] {
    const summaries: EvidenceSummary[] = [];
    const byCategory = this.groupEvidenceByType(evidence);

    const totalStrength = evidence.reduce((sum, e) => sum + e.strength, 0);

    for (const [category, items] of byCategory) {
      const categoryStrength = items.reduce((sum, e) => sum + e.strength, 0);

      summaries.push({
        category: category as EvidenceCategory,
        count: items.length,
        averageStrength: categoryStrength / items.length,
        keyFindings: items.slice(0, 3).map(e => e.description),
        contribution: totalStrength > 0 ? categoryStrength / totalStrength : 0,
      });
    }

    // Sort by contribution
    summaries.sort((a, b) => b.contribution - a.contribution);

    return summaries;
  }

  /**
   * Group evidence by type.
   */
  private groupEvidenceByType(evidence: Evidence[]): Map<string, Evidence[]> {
    const groups = new Map<string, Evidence[]>();

    for (const e of evidence) {
      const existing = groups.get(e.type) ?? [];
      existing.push(e);
      groups.set(e.type, existing);
    }

    return groups;
  }

  // ===========================================================================
  // Recommendations
  // ===========================================================================

  /**
   * Generate recommendations based on confidence.
   */
  private generateRecommendations(
    _score: number,
    category: ConfidenceCategory,
    _hypothesis: RootCauseHypothesis
  ): string[] {
    const recommendations: string[] = [];

    switch (category) {
      case 'very_high':
        recommendations.push('The analysis is reliable - proceed with suggested fix');
        recommendations.push('Run standard test suite to verify');
        break;

      case 'high':
        recommendations.push('Review the evidence before applying fix');
        recommendations.push('Run tests and type checking');
        break;

      case 'medium':
        recommendations.push('Gather additional evidence if possible');
        recommendations.push('Consider manual verification of root cause');
        recommendations.push('Test thoroughly after applying fix');
        break;

      case 'low':
        recommendations.push('Investigate alternative hypotheses');
        recommendations.push('Collect more evidence through debugging');
        recommendations.push('Consider consulting documentation or colleagues');
        break;

      case 'very_low':
        recommendations.push('This hypothesis needs more investigation');
        recommendations.push('Use debugger to trace execution flow');
        recommendations.push('Add logging to gather more evidence');
        recommendations.push('Consider breaking down the problem');
        break;
    }

    return recommendations;
  }

  /**
   * Generate fix-specific recommendations.
   */
  private generateFixRecommendations(
    _score: number,
    category: ConfidenceCategory,
    fix: FixSuggestion
  ): string[] {
    const recommendations: string[] = [];

    // Base recommendations on confidence
    if (fix.confidence < 0.5) {
      recommendations.push('Consider manual review before applying this fix');
    }

    // Recommendations based on fix type
    if (fix.type === 'generated') {
      recommendations.push('Generated fix should be reviewed for edge cases');
    }

    // Recommendations based on validation steps
    if (!fix.validationSteps.some(s => s.type === 'test')) {
      recommendations.push('Add tests to verify the fix');
    }

    // Recommendations based on complexity
    if (fix.changes.length > 3) {
      recommendations.push('Multiple files affected - review each change carefully');
    }

    // Category-based
    if (category === 'very_high' || category === 'high') {
      recommendations.push('Safe to apply with standard review process');
    }

    return recommendations;
  }

  // ===========================================================================
  // Output Formatting
  // ===========================================================================

  /**
   * Format the display output.
   */
  private formatOutput(result: ConfidenceDisplayResult): string {
    switch (this.config.format) {
      case 'terminal':
        return this.formatTerminal(result);
      case 'markdown':
        return this.formatMarkdown(result);
      case 'html':
        return this.formatHtml(result);
      case 'json':
        return this.formatJson(result);
      case 'plain':
        return this.formatPlain(result);
      default:
        return this.formatTerminal(result);
    }
  }

  /**
   * Format for terminal output.
   */
  private formatTerminal(result: ConfidenceDisplayResult): string {
    const lines: string[] = [];

    // Header
    const headerColor = this.getConfidenceColor(result.score);
    lines.push(this.colorize('═'.repeat(50), headerColor));
    lines.push(this.colorize('  CONFIDENCE ANALYSIS', headerColor));
    lines.push(this.colorize('═'.repeat(50), headerColor));
    lines.push('');

    // Main indicator
    lines.push(`  ${result.indicator}  ${Math.round(result.score * 100)}%`);
    lines.push(`  ${result.description}`);
    lines.push('');

    // Breakdown
    if (this.config.showBreakdown && result.breakdown.length > 0) {
      lines.push(this.colorize('  Breakdown:', 'cyan'));
      for (const item of result.breakdown) {
        const bar = this.generateBarIndicator(item.score);
        lines.push(`    ${item.category}: ${bar} ${Math.round(item.weight * 100)}%`);
      }
      lines.push('');
    }

    // Evidence
    if (this.config.showEvidence && result.evidenceSummaries.length > 0) {
      lines.push(this.colorize('  Evidence Summary:', 'cyan'));
      for (const summary of result.evidenceSummaries) {
        lines.push(`    ${this.getEvidenceTypeName(summary.category)}: ${summary.count} item(s), ${Math.round(summary.averageStrength * 100)}% strength`);
        for (const finding of summary.keyFindings.slice(0, 2)) {
          lines.push(`      • ${finding}`);
        }
      }
      lines.push('');
    }

    // Recommendations
    if (this.config.showRecommendations && result.recommendations.length > 0) {
      lines.push(this.colorize('  Recommendations:', 'yellow'));
      for (const rec of result.recommendations) {
        lines.push(`    → ${rec}`);
      }
    }

    lines.push('');
    lines.push(this.colorize('═'.repeat(50), headerColor));

    return lines.join('\n');
  }

  /**
   * Format as markdown.
   */
  private formatMarkdown(result: ConfidenceDisplayResult): string {
    const lines: string[] = [];

    lines.push('## Confidence Analysis\n');
    lines.push(`**Score:** ${Math.round(result.score * 100)}% (${result.category.replace('_', ' ')})\n`);
    lines.push(`${result.description}\n`);

    if (this.config.showBreakdown && result.breakdown.length > 0) {
      lines.push('### Breakdown\n');
      lines.push('| Category | Score | Weight |');
      lines.push('|----------|-------|--------|');
      for (const item of result.breakdown) {
        lines.push(`| ${item.category} | ${Math.round(item.score * 100)}% | ${Math.round(item.weight * 100)}% |`);
      }
      lines.push('');
    }

    if (this.config.showEvidence && result.evidenceSummaries.length > 0) {
      lines.push('### Evidence Summary\n');
      for (const summary of result.evidenceSummaries) {
        lines.push(`**${this.getEvidenceTypeName(summary.category)}** (${summary.count} items):\n`);
        for (const finding of summary.keyFindings) {
          lines.push(`- ${finding}`);
        }
        lines.push('');
      }
    }

    if (this.config.showRecommendations && result.recommendations.length > 0) {
      lines.push('### Recommendations\n');
      for (const rec of result.recommendations) {
        lines.push(`- ${rec}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format as HTML.
   */
  private formatHtml(result: ConfidenceDisplayResult): string {
    const colorClass = this.getCssColorClass(result.score);

    const lines: string[] = [];
    lines.push('<div class="confidence-display">');
    lines.push(`<h2>Confidence Analysis</h2>`);
    lines.push(`<div class="confidence-score ${colorClass}">`);
    lines.push(`<span class="score">${Math.round(result.score * 100)}%</span>`);
    lines.push(`<span class="category">${result.category.replace('_', ' ')}</span>`);
    lines.push('</div>');
    lines.push(`<p class="description">${result.description}</p>`);

    if (this.config.showBreakdown && result.breakdown.length > 0) {
      lines.push('<div class="breakdown">');
      lines.push('<h3>Breakdown</h3>');
      lines.push('<ul>');
      for (const item of result.breakdown) {
        lines.push(`<li><strong>${item.category}:</strong> ${Math.round(item.score * 100)}% (weight: ${Math.round(item.weight * 100)}%)</li>`);
      }
      lines.push('</ul>');
      lines.push('</div>');
    }

    if (this.config.showRecommendations && result.recommendations.length > 0) {
      lines.push('<div class="recommendations">');
      lines.push('<h3>Recommendations</h3>');
      lines.push('<ul>');
      for (const rec of result.recommendations) {
        lines.push(`<li>${rec}</li>`);
      }
      lines.push('</ul>');
      lines.push('</div>');
    }

    lines.push('</div>');

    return lines.join('\n');
  }

  /**
   * Format as JSON.
   */
  private formatJson(result: ConfidenceDisplayResult): string {
    return JSON.stringify({
      score: result.score,
      percentage: Math.round(result.score * 100),
      category: result.category,
      description: result.description,
      breakdown: result.breakdown,
      evidenceSummaries: result.evidenceSummaries,
      recommendations: result.recommendations,
    }, null, 2);
  }

  /**
   * Format as plain text.
   */
  private formatPlain(result: ConfidenceDisplayResult): string {
    const lines: string[] = [];

    lines.push('CONFIDENCE ANALYSIS');
    lines.push('='.repeat(40));
    lines.push(`Score: ${Math.round(result.score * 100)}% (${result.category.replace('_', ' ')})`);
    lines.push(result.description);
    lines.push('');

    if (this.config.showBreakdown && result.breakdown.length > 0) {
      lines.push('Breakdown:');
      for (const item of result.breakdown) {
        lines.push(`  - ${item.category}: ${Math.round(item.score * 100)}%`);
      }
      lines.push('');
    }

    if (this.config.showRecommendations && result.recommendations.length > 0) {
      lines.push('Recommendations:');
      for (const rec of result.recommendations) {
        lines.push(`  - ${rec}`);
      }
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  private getConfidenceColor(score: number): string {
    if (score >= 0.75) return 'green';
    if (score >= 0.5) return 'yellow';
    if (score >= 0.25) return 'orange';
    return 'red';
  }

  private getCssColorClass(score: number): string {
    if (score >= 0.75) return 'confidence-high';
    if (score >= 0.5) return 'confidence-medium';
    if (score >= 0.25) return 'confidence-low';
    return 'confidence-very-low';
  }

  private colorize(text: string, color: string): string {
    if (!this.config.colorize || this.config.format !== 'terminal') {
      return text;
    }

    const colors: Record<string, string> = {
      red: '\x1b[31m',
      orange: '\x1b[33m',
      yellow: '\x1b[33m',
      green: '\x1b[32m',
      cyan: '\x1b[36m',
      default: '\x1b[0m',
    };

    const colorCode = colors[color] ?? colors['default'];
    return `${colorCode}${text}\x1b[0m`;
  }

  private getEvidenceTypeName(type: string): string {
    const names: Record<string, string> = {
      code: 'Code Analysis',
      error: 'Error Patterns',
      test: 'Test Results',
      history: 'Historical Data',
      pattern: 'Pattern Matching',
      static_analysis: 'Static Analysis',
    };
    return names[type] ?? type;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a confidence display with default configuration.
 */
export function createConfidenceDisplay(
  config?: Partial<ConfidenceDisplayConfig>
): ConfidenceDisplay {
  return new ConfidenceDisplay(config);
}

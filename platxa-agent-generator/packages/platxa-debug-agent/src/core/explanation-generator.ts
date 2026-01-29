/**
 * Explanation Generator
 *
 * Generates human-readable explanations for bugs, root causes, and fixes.
 * Helps developers understand debugging results before applying changes.
 *
 * @module explanation-generator
 */

import type {
  NormalizedError,
  RootCauseHypothesis,
  FixSuggestion,
  Evidence,
  CodeChange,
  Language,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Verbosity level for explanations
 */
export type VerbosityLevel = 'minimal' | 'standard' | 'detailed' | 'verbose';

/**
 * Explanation section
 */
export interface ExplanationSection {
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Code snippets in this section */
  codeSnippets?: CodeSnippet[];
  /** Subsections */
  subsections?: ExplanationSection[];
  /** Priority for ordering */
  priority: number;
}

/**
 * Code snippet for explanation
 */
export interface CodeSnippet {
  /** Programming language */
  language: Language;
  /** Code content */
  code: string;
  /** Optional caption */
  caption?: string;
  /** File path if applicable */
  filePath?: string;
  /** Line numbers (start-end) */
  lineRange?: { start: number; end: number };
  /** Highlight specific lines */
  highlightLines?: number[];
}

/**
 * Bug explanation
 */
export interface BugExplanation {
  /** One-line summary */
  summary: string;
  /** What happened */
  whatHappened: string;
  /** Why it happened */
  whyItHappened: string;
  /** Impact/consequences */
  impact: string;
  /** Related code locations */
  codeLocations: CodeSnippet[];
  /** Sections for detailed view */
  sections: ExplanationSection[];
  /** Technical details (for verbose mode) */
  technicalDetails?: string;
}

/**
 * Root cause explanation
 */
export interface RootCauseExplanation {
  /** One-line summary */
  summary: string;
  /** Detailed explanation */
  explanation: string;
  /** Evidence summary */
  evidenceSummary: string;
  /** Confidence explanation */
  confidenceRationale: string;
  /** Alternative causes considered */
  alternativeCauses?: string[];
  /** Sections */
  sections: ExplanationSection[];
}

/**
 * Fix explanation
 */
export interface FixExplanation {
  /** One-line summary */
  summary: string;
  /** What the fix does */
  whatItDoes: string;
  /** Why this approach was chosen */
  whyThisApproach: string;
  /** Potential risks/side effects */
  potentialRisks: string[];
  /** Validation steps in plain language */
  validationSteps: string[];
  /** Before/after comparison */
  beforeAfter?: {
    before: CodeSnippet;
    after: CodeSnippet;
  };
  /** Sections */
  sections: ExplanationSection[];
}

/**
 * Complete debugging explanation
 */
export interface DebuggingExplanation {
  /** Executive summary */
  executiveSummary: string;
  /** Bug explanation */
  bug: BugExplanation;
  /** Root cause explanation */
  rootCause: RootCauseExplanation;
  /** Fix explanation */
  fix: FixExplanation;
  /** Recommendations */
  recommendations: string[];
  /** Full markdown output */
  markdown: string;
  /** Plain text output */
  plainText: string;
}

/**
 * Explanation generator configuration
 */
export interface ExplanationGeneratorConfig {
  /** Default verbosity level */
  verbosity?: VerbosityLevel;
  /** Include code snippets */
  includeCode?: boolean;
  /** Include technical details */
  includeTechnicalDetails?: boolean;
  /** Maximum snippet lines */
  maxSnippetLines?: number;
  /** Include confidence scores */
  includeConfidence?: boolean;
  /** Include evidence details */
  includeEvidence?: boolean;
}

// =============================================================================
// Explanation Generator Implementation
// =============================================================================

/**
 * Generates human-readable explanations for debugging results.
 */
export class ExplanationGenerator {
  private readonly config: Required<ExplanationGeneratorConfig>;

  constructor(config: Partial<ExplanationGeneratorConfig> = {}) {
    this.config = {
      verbosity: config.verbosity ?? 'standard',
      includeCode: config.includeCode ?? true,
      includeTechnicalDetails: config.includeTechnicalDetails ?? false,
      maxSnippetLines: config.maxSnippetLines ?? 15,
      includeConfidence: config.includeConfidence ?? true,
      includeEvidence: config.includeEvidence ?? true,
    };
  }

  /**
   * Generate a complete debugging explanation.
   */
  generateExplanation(
    error: NormalizedError,
    hypothesis: RootCauseHypothesis,
    fix: FixSuggestion,
    verbosity?: VerbosityLevel
  ): DebuggingExplanation {
    const level = verbosity ?? this.config.verbosity;

    const bugExplanation = this.explainBug(error, level);
    const rootCauseExplanation = this.explainRootCause(hypothesis, level);
    const fixExplanation = this.explainFix(fix, error, level);

    const executiveSummary = this.generateExecutiveSummary(
      error,
      hypothesis,
      fix
    );

    const recommendations = this.generateRecommendations(
      error,
      hypothesis,
      fix
    );

    const markdown = this.formatAsMarkdown(
      executiveSummary,
      bugExplanation,
      rootCauseExplanation,
      fixExplanation,
      recommendations
    );

    const plainText = this.formatAsPlainText(
      executiveSummary,
      bugExplanation,
      rootCauseExplanation,
      fixExplanation,
      recommendations
    );

    return {
      executiveSummary,
      bug: bugExplanation,
      rootCause: rootCauseExplanation,
      fix: fixExplanation,
      recommendations,
      markdown,
      plainText,
    };
  }

  /**
   * Generate bug explanation only.
   */
  explainBug(
    error: NormalizedError,
    verbosity?: VerbosityLevel
  ): BugExplanation {
    const level = verbosity ?? this.config.verbosity;

    const summary = this.generateBugSummary(error);
    const whatHappened = this.generateWhatHappened(error, level);
    const whyItHappened = this.generateWhyItHappened(error, level);
    const impact = this.generateImpact(error, level);
    const codeLocations = this.extractCodeLocations(error);
    const sections = this.generateBugSections(error, level);

    const explanation: BugExplanation = {
      summary,
      whatHappened,
      whyItHappened,
      impact,
      codeLocations,
      sections,
    };

    if (level === 'verbose' || this.config.includeTechnicalDetails) {
      explanation.technicalDetails = this.generateTechnicalDetails(error);
    }

    return explanation;
  }

  /**
   * Generate root cause explanation only.
   */
  explainRootCause(
    hypothesis: RootCauseHypothesis,
    verbosity?: VerbosityLevel
  ): RootCauseExplanation {
    const level = verbosity ?? this.config.verbosity;

    const summary = hypothesis.description;
    const explanation = this.generateRootCauseExplanation(hypothesis, level);
    const evidenceSummary = this.generateEvidenceSummary(hypothesis.evidence, level);
    const confidenceRationale = this.generateConfidenceRationale(hypothesis);
    const sections = this.generateRootCauseSections(hypothesis, level);

    const result: RootCauseExplanation = {
      summary,
      explanation,
      evidenceSummary,
      confidenceRationale,
      sections,
    };

    if (level === 'detailed' || level === 'verbose') {
      result.alternativeCauses = this.generateAlternativeCauses(hypothesis);
    }

    return result;
  }

  /**
   * Generate fix explanation only.
   */
  explainFix(
    fix: FixSuggestion,
    error: NormalizedError,
    verbosity?: VerbosityLevel
  ): FixExplanation {
    const level = verbosity ?? this.config.verbosity;

    const summary = fix.description;
    const whatItDoes = this.generateWhatFixDoes(fix, level);
    const whyThisApproach = this.generateWhyThisApproach(fix, error, level);
    const potentialRisks = this.generatePotentialRisks(fix);
    const validationSteps = this.generateValidationSteps(fix);
    const sections = this.generateFixSections(fix, level);

    const explanation: FixExplanation = {
      summary,
      whatItDoes,
      whyThisApproach,
      potentialRisks,
      validationSteps,
      sections,
    };

    if (this.config.includeCode && fix.changes.length > 0) {
      explanation.beforeAfter = this.generateBeforeAfter(fix.changes[0]!, error.language);
    }

    return explanation;
  }

  // ===========================================================================
  // Bug Explanation Helpers
  // ===========================================================================

  private generateBugSummary(error: NormalizedError): string {
    const location = error.location
      ? ` in ${error.location.file}:${error.location.line}`
      : '';

    return `${error.type}: ${error.message}${location}`;
  }

  private generateWhatHappened(error: NormalizedError, level: VerbosityLevel): string {
    const parts: string[] = [];

    // Basic description
    parts.push(`A ${error.type} occurred during ${this.getSourceDescription(error.source)}.`);

    // Error message
    parts.push(`The error message is: "${error.message}"`);

    // Location info
    if (error.location !== undefined) {
      parts.push(
        `This happened at line ${error.location.line} in file "${error.location.file}".`
      );
    }

    // Stack trace summary (for detailed/verbose)
    if ((level === 'detailed' || level === 'verbose') && error.stackTrace !== undefined && error.stackTrace.length > 0) {
      const userFrames = error.stackTrace.filter(f => f.isUserCode !== false);
      if (userFrames.length > 0) {
        const topFrame = userFrames[0];
        if (topFrame !== undefined) {
          parts.push(
            `The error originated in function "${topFrame.functionName ?? 'anonymous'}" ` +
            `and propagated through ${userFrames.length} function call(s).`
          );
        }
      }
    }

    return parts.join(' ');
  }

  private generateWhyItHappened(error: NormalizedError, level: VerbosityLevel): string {
    // Generate explanation based on error type
    const explanations: Record<string, string> = {
      TypeError: 'This typically occurs when an operation is performed on a value of an inappropriate type, such as calling a method on undefined or null.',
      ReferenceError: 'This happens when trying to use a variable that has not been declared or is not accessible in the current scope.',
      SyntaxError: 'This indicates a problem with the code structure that prevents it from being parsed correctly.',
      ValueError: 'This occurs when a function receives an argument of the correct type but an inappropriate value.',
      KeyError: 'This happens when trying to access a dictionary key that does not exist.',
      IndexError: 'This occurs when trying to access a list or array index that is out of range.',
      AttributeError: 'This happens when trying to access an attribute that does not exist on an object.',
      ImportError: 'This occurs when Python cannot find or load a module.',
      NameError: 'This happens when trying to use a variable name that has not been defined.',
      ZeroDivisionError: 'This occurs when attempting to divide by zero.',
    };

    const baseExplanation = explanations[error.type] ??
      `This is a ${error.type} which indicates an issue with the code execution.`;

    if (level === 'minimal') {
      return baseExplanation;
    }

    // Add context-specific details
    const contextHints = this.analyzeErrorContext(error);
    if (contextHints.length > 0) {
      return `${baseExplanation} ${contextHints.join(' ')}`;
    }

    return baseExplanation;
  }

  private generateImpact(error: NormalizedError, level: VerbosityLevel): string {
    const severityDescriptions: Record<string, string> = {
      error: 'This error prevents normal program execution and must be fixed.',
      warning: 'This warning indicates potential issues that should be addressed.',
      info: 'This is informational and may not require immediate action.',
      hint: 'This is a suggestion for improvement.',
    };

    const base = severityDescriptions[error.severity] ?? 'This issue should be reviewed.';

    if (level === 'minimal') {
      return base;
    }

    // Add source-specific impact
    const sourceImpact = this.getSourceImpact(error.source);
    return `${base} ${sourceImpact}`;
  }

  private extractCodeLocations(error: NormalizedError): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];

    if (error.location !== undefined) {
      snippets.push({
        language: error.language,
        code: error.raw,
        filePath: error.location.file,
        lineRange: {
          start: error.location.line,
          end: error.location.endLine ?? error.location.line,
        },
      });
    }

    return snippets;
  }

  private generateBugSections(error: NormalizedError, level: VerbosityLevel): ExplanationSection[] {
    const sections: ExplanationSection[] = [];

    // Error details section
    sections.push({
      title: 'Error Details',
      content: `Type: ${error.type}\nSeverity: ${error.severity}\nSource: ${error.source}`,
      priority: 1,
    });

    // Stack trace section (for detailed/verbose)
    if ((level === 'detailed' || level === 'verbose') && error.stackTrace !== undefined && error.stackTrace.length > 0) {
      const stackContent = error.stackTrace
        .slice(0, level === 'verbose' ? undefined : 5)
        .map(frame => {
          const loc = `${frame.location.file}:${frame.location.line}`;
          return `  at ${frame.functionName ?? 'anonymous'} (${loc})`;
        })
        .join('\n');

      sections.push({
        title: 'Stack Trace',
        content: stackContent,
        priority: 2,
      });
    }

    return sections;
  }

  private generateTechnicalDetails(error: NormalizedError): string {
    const details: string[] = [];

    details.push(`Error ID: ${error.id}`);
    details.push(`Timestamp: ${error.timestamp.toISOString()}`);

    if (error.code !== undefined) {
      details.push(`Error Code: ${error.code}`);
    }

    if (error.context !== undefined) {
      details.push(`Context: ${JSON.stringify(error.context, null, 2)}`);
    }

    return details.join('\n');
  }

  // ===========================================================================
  // Root Cause Explanation Helpers
  // ===========================================================================

  private generateRootCauseExplanation(
    hypothesis: RootCauseHypothesis,
    level: VerbosityLevel
  ): string {
    const parts: string[] = [];

    parts.push(hypothesis.description);

    if (level !== 'minimal' && this.config.includeConfidence) {
      const confidencePercent = Math.round(hypothesis.confidence * 100);
      parts.push(`We are ${confidencePercent}% confident in this analysis.`);
    }

    if ((level === 'detailed' || level === 'verbose') && hypothesis.evidence.length > 0) {
      parts.push(`This conclusion is based on ${hypothesis.evidence.length} piece(s) of evidence.`);
    }

    return parts.join(' ');
  }

  private generateEvidenceSummary(evidence: Evidence[], level: VerbosityLevel): string {
    if (evidence.length === 0) {
      return 'No specific evidence was collected.';
    }

    if (level === 'minimal') {
      return `Based on ${evidence.length} piece(s) of evidence.`;
    }

    const byType = new Map<string, Evidence[]>();
    for (const e of evidence) {
      const existing = byType.get(e.type) ?? [];
      existing.push(e);
      byType.set(e.type, existing);
    }

    const parts: string[] = [];
    for (const [type, items] of byType) {
      const typeDesc = this.getEvidenceTypeDescription(type);
      parts.push(`${items.length} ${typeDesc}`);
    }

    return `Evidence collected: ${parts.join(', ')}.`;
  }

  private generateConfidenceRationale(hypothesis: RootCauseHypothesis): string {
    const confidence = hypothesis.confidence;
    const evidenceCount = hypothesis.evidence.length;

    if (confidence >= 0.9) {
      return `High confidence (${Math.round(confidence * 100)}%) based on strong evidence including direct code analysis and error patterns.`;
    } else if (confidence >= 0.7) {
      return `Moderate confidence (${Math.round(confidence * 100)}%) based on ${evidenceCount} supporting evidence point(s).`;
    } else if (confidence >= 0.5) {
      return `Some uncertainty (${Math.round(confidence * 100)}%) - additional investigation may be helpful.`;
    } else {
      return `Low confidence (${Math.round(confidence * 100)}%) - this is a tentative hypothesis that requires verification.`;
    }
  }

  private generateAlternativeCauses(_hypothesis: RootCauseHypothesis): string[] {
    // Generate common alternative causes based on the hypothesis
    return [
      'Race condition or timing issue',
      'Configuration or environment mismatch',
      'Incomplete data or missing validation',
      'Third-party dependency issue',
    ];
  }

  private generateRootCauseSections(
    hypothesis: RootCauseHypothesis,
    level: VerbosityLevel
  ): ExplanationSection[] {
    const sections: ExplanationSection[] = [];

    // Evidence section
    if (this.config.includeEvidence && hypothesis.evidence.length > 0) {
      const evidenceContent = hypothesis.evidence
        .map((e, i) => `${i + 1}. [${e.type}] ${e.description} (strength: ${Math.round(e.strength * 100)}%)`)
        .join('\n');

      sections.push({
        title: 'Supporting Evidence',
        content: evidenceContent,
        priority: 1,
      });
    }

    // Related locations
    if (level !== 'minimal' && hypothesis.relatedLocations.length > 0) {
      const locContent = hypothesis.relatedLocations
        .map(loc => `${loc.file}:${loc.line}`)
        .join('\n');

      sections.push({
        title: 'Related Code Locations',
        content: locContent,
        priority: 2,
      });
    }

    return sections;
  }

  // ===========================================================================
  // Fix Explanation Helpers
  // ===========================================================================

  private generateWhatFixDoes(fix: FixSuggestion, level: VerbosityLevel): string {
    const parts: string[] = [];

    parts.push(fix.description);

    if (level !== 'minimal' && fix.changes.length > 0) {
      const changeDescriptions = fix.changes.map(c => this.describeChange(c));
      parts.push(`This involves: ${changeDescriptions.join('; ')}.`);
    }

    return parts.join(' ');
  }

  private generateWhyThisApproach(
    fix: FixSuggestion,
    _error: NormalizedError,
    level: VerbosityLevel
  ): string {
    const reasons: string[] = [];

    // Based on fix type
    switch (fix.type) {
      case 'template':
        reasons.push('This is a well-established fix pattern that has been proven effective for this type of error.');
        break;
      case 'generated':
        reasons.push('This fix was generated based on analysis of the specific error context.');
        break;
      case 'retrieved':
        reasons.push('This fix was retrieved from a database of similar past issues.');
        break;
    }

    // Add confidence rationale
    if (this.config.includeConfidence) {
      const confidencePercent = Math.round(fix.confidence * 100);
      if (fix.confidence >= 0.8) {
        reasons.push(`The fix has ${confidencePercent}% confidence based on strong pattern matching.`);
      } else if (fix.confidence >= 0.5) {
        reasons.push(`The fix has ${confidencePercent}% confidence - review recommended before applying.`);
      }
    }

    if (level === 'minimal') {
      return reasons[0] ?? 'This approach addresses the root cause directly.';
    }

    return reasons.join(' ');
  }

  private generatePotentialRisks(fix: FixSuggestion): string[] {
    const risks: string[] = [];

    // Analyze changes for potential risks
    for (const change of fix.changes) {
      if (change.type === 'delete') {
        risks.push('Removing code may affect other parts of the application that depend on it.');
      }

      if (change.type === 'replace' && change.originalContent !== undefined) {
        const originalLines = change.originalContent.split('\n').length;
        const newLines = (change.newContent ?? '').split('\n').length;
        if (newLines > originalLines * 2) {
          risks.push('The fix significantly increases code complexity.');
        }
      }
    }

    // Add generic risks if confidence is lower
    if (fix.confidence < 0.7) {
      risks.push('Lower confidence suggests thorough testing is recommended.');
    }

    if (risks.length === 0) {
      risks.push('No significant risks identified, but testing is always recommended.');
    }

    return risks;
  }

  private generateValidationSteps(fix: FixSuggestion): string[] {
    const steps: string[] = [];

    for (const step of fix.validationSteps) {
      switch (step.type) {
        case 'typecheck':
          steps.push('Run type checker to verify type safety');
          break;
        case 'lint':
          steps.push('Run linter to check code quality');
          break;
        case 'test':
          steps.push('Run test suite to verify functionality');
          break;
        case 'build':
          steps.push('Build the project to verify compilation');
          break;
        case 'manual':
          steps.push(step.description ?? 'Perform manual verification');
          break;
      }
    }

    if (steps.length === 0) {
      steps.push('Review the changes manually');
      steps.push('Run relevant tests');
      steps.push('Verify the original error is resolved');
    }

    return steps;
  }

  private generateBeforeAfter(
    change: CodeChange,
    language: Language
  ): { before: CodeSnippet; after: CodeSnippet } {
    return {
      before: {
        language,
        code: change.originalContent ?? '// Original code not available',
        filePath: change.file,
        caption: 'Before',
      },
      after: {
        language,
        code: change.newContent ?? '// New code not available',
        filePath: change.file,
        caption: 'After',
      },
    };
  }

  private generateFixSections(fix: FixSuggestion, level: VerbosityLevel): ExplanationSection[] {
    const sections: ExplanationSection[] = [];

    // Changes section
    if (fix.changes.length > 0) {
      const changesContent = fix.changes
        .map((c, i) => `${i + 1}. ${this.describeChange(c)}`)
        .join('\n');

      sections.push({
        title: 'Changes',
        content: changesContent,
        priority: 1,
      });
    }

    // Validation section
    if (level !== 'minimal' && fix.validationSteps.length > 0) {
      const validationContent = fix.validationSteps
        .map((s, i) => `${i + 1}. ${s.description ?? s.type}: ${s.expectedOutcome}`)
        .join('\n');

      sections.push({
        title: 'Validation Steps',
        content: validationContent,
        priority: 2,
      });
    }

    return sections;
  }

  // ===========================================================================
  // Summary and Recommendations
  // ===========================================================================

  private generateExecutiveSummary(
    error: NormalizedError,
    hypothesis: RootCauseHypothesis,
    fix: FixSuggestion
  ): string {
    const parts: string[] = [];

    parts.push(`**Problem**: ${error.type} - ${error.message}`);
    parts.push(`**Root Cause**: ${hypothesis.description}`);
    parts.push(`**Solution**: ${fix.description}`);
    parts.push(`**Confidence**: ${Math.round(fix.confidence * 100)}%`);

    return parts.join('\n');
  }

  private generateRecommendations(
    error: NormalizedError,
    _hypothesis: RootCauseHypothesis,
    fix: FixSuggestion
  ): string[] {
    const recommendations: string[] = [];

    // Always recommend reviewing the fix
    recommendations.push('Review the proposed changes before applying them');

    // Test recommendation
    recommendations.push('Run the test suite after applying the fix');

    // Error-specific recommendations
    if (error.type === 'TypeError' || error.type === 'AttributeError') {
      recommendations.push('Consider adding type hints to prevent similar issues');
    }

    if (error.source === 'test') {
      recommendations.push('Verify the fix does not break other tests');
    }

    // Confidence-based recommendations
    if (fix.confidence < 0.7) {
      recommendations.push('Lower confidence fix - consider manual review');
    }

    return recommendations;
  }

  // ===========================================================================
  // Formatting
  // ===========================================================================

  private formatAsMarkdown(
    summary: string,
    bug: BugExplanation,
    rootCause: RootCauseExplanation,
    fix: FixExplanation,
    recommendations: string[]
  ): string {
    const parts: string[] = [];

    // Executive summary
    parts.push('# Debugging Report\n');
    parts.push('## Summary\n');
    parts.push(summary);
    parts.push('');

    // Bug explanation
    parts.push('## Bug Analysis\n');
    parts.push(`**What happened**: ${bug.whatHappened}\n`);
    parts.push(`**Why it happened**: ${bug.whyItHappened}\n`);
    parts.push(`**Impact**: ${bug.impact}\n`);

    // Root cause
    parts.push('## Root Cause\n');
    parts.push(`${rootCause.explanation}\n`);
    parts.push(`**Confidence**: ${rootCause.confidenceRationale}\n`);

    // Fix
    parts.push('## Proposed Fix\n');
    parts.push(`**What it does**: ${fix.whatItDoes}\n`);
    parts.push(`**Why this approach**: ${fix.whyThisApproach}\n`);

    if (fix.potentialRisks.length > 0) {
      parts.push('**Potential risks**:');
      for (const risk of fix.potentialRisks) {
        parts.push(`- ${risk}`);
      }
      parts.push('');
    }

    // Before/after code
    if (fix.beforeAfter !== undefined) {
      parts.push('### Code Changes\n');
      parts.push('**Before**:');
      parts.push(`\`\`\`${fix.beforeAfter.before.language}`);
      parts.push(fix.beforeAfter.before.code);
      parts.push('```\n');
      parts.push('**After**:');
      parts.push(`\`\`\`${fix.beforeAfter.after.language}`);
      parts.push(fix.beforeAfter.after.code);
      parts.push('```\n');
    }

    // Validation
    if (fix.validationSteps.length > 0) {
      parts.push('### Validation Steps\n');
      for (const step of fix.validationSteps) {
        parts.push(`- [ ] ${step}`);
      }
      parts.push('');
    }

    // Recommendations
    parts.push('## Recommendations\n');
    for (const rec of recommendations) {
      parts.push(`- ${rec}`);
    }

    return parts.join('\n');
  }

  private formatAsPlainText(
    summary: string,
    bug: BugExplanation,
    rootCause: RootCauseExplanation,
    fix: FixExplanation,
    recommendations: string[]
  ): string {
    const parts: string[] = [];

    // Summary
    parts.push('=== DEBUGGING REPORT ===\n');
    parts.push(summary.replace(/\*\*/g, ''));
    parts.push('\n--- Bug Analysis ---');
    parts.push(`What happened: ${bug.whatHappened}`);
    parts.push(`Why: ${bug.whyItHappened}`);
    parts.push(`Impact: ${bug.impact}`);

    parts.push('\n--- Root Cause ---');
    parts.push(rootCause.explanation);
    parts.push(`Confidence: ${rootCause.confidenceRationale}`);

    parts.push('\n--- Proposed Fix ---');
    parts.push(`What it does: ${fix.whatItDoes}`);
    parts.push(`Why: ${fix.whyThisApproach}`);

    if (fix.potentialRisks.length > 0) {
      parts.push('Risks:');
      for (const risk of fix.potentialRisks) {
        parts.push(`  - ${risk}`);
      }
    }

    parts.push('\n--- Recommendations ---');
    for (const rec of recommendations) {
      parts.push(`  - ${rec}`);
    }

    return parts.join('\n');
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  private getSourceDescription(source: string): string {
    const descriptions: Record<string, string> = {
      exception: 'program execution',
      static: 'static analysis',
      runtime: 'runtime operation',
      build: 'build process',
      test: 'test execution',
      log: 'application logging',
      console: 'console output',
    };
    return descriptions[source] ?? 'code execution';
  }

  private getSourceImpact(source: string): string {
    const impacts: Record<string, string> = {
      exception: 'The program likely crashed or stopped executing.',
      static: 'This was detected during code analysis, not runtime.',
      runtime: 'This affected the running program.',
      build: 'The application cannot be built until this is fixed.',
      test: 'Tests are failing, which may indicate a regression.',
      log: 'This was recorded in application logs.',
      console: 'This was output to the console during execution.',
    };
    return impacts[source] ?? '';
  }

  private analyzeErrorContext(error: NormalizedError): string[] {
    const hints: string[] = [];

    // Analyze message for common patterns
    if (error.message.includes('undefined')) {
      hints.push('A value that was expected to exist is undefined.');
    }
    if (error.message.includes('null')) {
      hints.push('A null value was encountered where one was not expected.');
    }
    if (error.message.includes('not a function')) {
      hints.push('Something that is not a function was called as if it were one.');
    }
    if (error.message.includes('not defined')) {
      hints.push('A variable or identifier is being used before it was defined.');
    }

    return hints;
  }

  private getEvidenceTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      code: 'code analysis finding(s)',
      error: 'error pattern match(es)',
      test: 'test result(s)',
      history: 'historical pattern(s)',
      pattern: 'pattern match(es)',
      static_analysis: 'static analysis result(s)',
    };
    return descriptions[type] ?? `${type} evidence`;
  }

  private describeChange(change: CodeChange): string {
    switch (change.type) {
      case 'replace':
        return `Replace code at line ${change.start.line} in ${change.file}`;
      case 'insert':
        return `Insert code at line ${change.start.line} in ${change.file}`;
      case 'delete':
        return `Remove code at line ${change.start.line} in ${change.file}`;
      default:
        return `Modify ${change.file} at line ${change.start.line}`;
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an explanation generator with default configuration.
 */
export function createExplanationGenerator(
  config?: Partial<ExplanationGeneratorConfig>
): ExplanationGenerator {
  return new ExplanationGenerator(config);
}

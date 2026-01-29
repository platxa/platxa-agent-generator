/**
 * Clarifying Question Generator - Creates focused questions for ambiguous requests
 *
 * Takes RequestAnalyzer output and generates 1-3 focused, actionable questions
 * that avoid yes/no formats and focus on gathering specific information.
 *
 * @module agentic-core/question-generator
 */

import type { AnalysisResult, RequestIssue, IssueType, IssueSeverity } from './request-analyzer';

// ============================================================================
// Types
// ============================================================================

/** Generated clarifying question */
export interface ClarifyingQuestion {
  /** Unique ID */
  id: string;
  /** The question text */
  text: string;
  /** Why this question is needed */
  rationale: string;
  /** Priority (1 = highest) */
  priority: number;
  /** Issue types this addresses */
  addressedIssues: IssueType[];
  /** Expected answer type */
  expectedAnswerType: 'text' | 'choice' | 'list' | 'example';
  /** Suggested answer options (if applicable) */
  suggestedOptions?: string[];
  /** Context from original request */
  context?: string;
}

/** Question generation result */
export interface QuestionGenerationResult {
  /** Generated questions (1-3) */
  questions: ClarifyingQuestion[];
  /** Original analysis reference */
  analysisRef: {
    request: string;
    clarityScore: number;
    issueCount: number;
  };
  /** Whether questions were generated */
  hasQuestions: boolean;
  /** Total issues addressed by questions */
  issuesAddressed: number;
  /** Generation timestamp */
  timestamp: Date;
}

/** Question template for generating actionable questions */
export interface QuestionTemplate {
  /** Issue type this template handles */
  issueType: IssueType;
  /** Template patterns (use {trigger} and {context} placeholders) */
  patterns: string[];
  /** Expected answer type */
  answerType: 'text' | 'choice' | 'list' | 'example';
  /** Priority boost for this template */
  priorityBoost?: number;
}

/** Generator configuration */
export interface QuestionGeneratorConfig {
  /** Maximum questions to generate (1-3) */
  maxQuestions?: number;
  /** Minimum clarity score to skip generation */
  skipThreshold?: number;
  /** Custom question templates */
  customTemplates?: QuestionTemplate[];
  /** Whether to consolidate related issues */
  consolidateRelated?: boolean;
}

// ============================================================================
// Default Templates
// ============================================================================

/** Default question templates that avoid yes/no questions */
const DEFAULT_TEMPLATES: QuestionTemplate[] = [
  // Vague term templates
  {
    issueType: 'vague_term',
    patterns: [
      'What specific characteristics should "{trigger}" include?',
      'How would you describe "{trigger}" in measurable terms?',
      'Which aspects of "{trigger}" are most important to you?',
      'What examples best represent "{trigger}" for this project?',
    ],
    answerType: 'text',
    priorityBoost: 0,
  },
  // Missing detail templates
  {
    issueType: 'missing_detail',
    patterns: [
      'What {trigger} specifications should be used?',
      'Which {trigger} values or options do you prefer?',
      'How should {trigger} be configured for this project?',
      'What are the {trigger} requirements?',
    ],
    answerType: 'text',
    priorityBoost: 1,
  },
  // Conflict templates
  {
    issueType: 'conflict',
    patterns: [
      'Between {trigger}, which takes priority for this project?',
      'How should we balance {trigger}?',
      'What trade-offs are acceptable between {trigger}?',
      'Which approach do you prefer: {trigger}?',
    ],
    answerType: 'choice',
    priorityBoost: 2,
  },
  // Unclear scope templates
  {
    issueType: 'unclear_scope',
    patterns: [
      'What specific areas or components should this cover?',
      'Which parts of the system should be included?',
      'What are the boundaries of this request?',
      'Which features or sections are in scope?',
    ],
    answerType: 'list',
    priorityBoost: 1,
  },
];

/** Words that indicate yes/no questions - to be avoided */
const YES_NO_INDICATORS = [
  /^(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\s/i,
  /^(shall|may|might)\s/i,
];

// ============================================================================
// Question Generator Class
// ============================================================================

/**
 * ClarifyingQuestionGenerator - Creates focused, actionable questions
 *
 * Key features:
 * - Generates 1-3 focused questions (not overwhelming)
 * - Avoids yes/no questions (uses what, which, how)
 * - Consolidates related issues into comprehensive questions
 * - Prioritizes by severity and actionability
 *
 * @example
 * ```typescript
 * const generator = new ClarifyingQuestionGenerator();
 * const analyzer = new RequestAnalyzer();
 *
 * const analysis = analyzer.analyze('Make it look nice');
 * const result = generator.generate(analysis);
 *
 * console.log(result.questions);
 * // [
 * //   {
 * //     text: 'What specific characteristics should "nice" include?',
 * //     rationale: 'Subjective aesthetic term needs definition',
 * //     priority: 1,
 * //     ...
 * //   }
 * // ]
 * ```
 */
export class ClarifyingQuestionGenerator {
  private templates: QuestionTemplate[];
  private config: Required<Omit<QuestionGeneratorConfig, 'customTemplates'>>;

  constructor(config: QuestionGeneratorConfig = {}) {
    this.templates = [
      ...DEFAULT_TEMPLATES,
      ...(config.customTemplates ?? []),
    ];
    this.config = {
      maxQuestions: Math.min(3, Math.max(1, config.maxQuestions ?? 3)),
      skipThreshold: config.skipThreshold ?? 0.9,
      consolidateRelated: config.consolidateRelated ?? true,
    };
  }

  // ==========================================================================
  // Main Generation
  // ==========================================================================

  /**
   * Generate clarifying questions from analysis result
   */
  generate(analysis: AnalysisResult): QuestionGenerationResult {
    // Skip if clarity is high enough
    if (analysis.clarityScore >= this.config.skipThreshold) {
      return this.createEmptyResult(analysis);
    }

    // Skip if no issues
    if (analysis.issues.length === 0) {
      return this.createEmptyResult(analysis);
    }

    // Group and prioritize issues
    const prioritizedIssues = this.prioritizeIssues(analysis.issues);

    // Generate candidate questions
    const candidates = this.generateCandidates(prioritizedIssues, analysis.request);

    // Consolidate related questions if enabled
    const consolidated = this.config.consolidateRelated
      ? this.consolidateQuestions(candidates)
      : candidates;

    // Select top questions
    const selected = this.selectTopQuestions(consolidated);

    // Validate questions (no yes/no)
    const validated = this.validateQuestions(selected);

    return {
      questions: validated,
      analysisRef: {
        request: analysis.request,
        clarityScore: analysis.clarityScore,
        issueCount: analysis.issues.length,
      },
      hasQuestions: validated.length > 0,
      issuesAddressed: this.countAddressedIssues(validated),
      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // Prioritization
  // ==========================================================================

  /**
   * Prioritize issues by severity and type
   */
  private prioritizeIssues(issues: RequestIssue[]): RequestIssue[] {
    const severityOrder: Record<IssueSeverity, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    const typeOrder: Record<IssueType, number> = {
      conflict: 0,      // Conflicts are critical - can't proceed without resolution
      missing_detail: 1, // Missing details block implementation
      unclear_scope: 2,  // Scope issues need early clarification
      vague_term: 3,     // Vague terms can sometimes be inferred
    };

    return [...issues].sort((a, b) => {
      // First by severity
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by type
      return typeOrder[a.type] - typeOrder[b.type];
    });
  }

  // ==========================================================================
  // Question Generation
  // ==========================================================================

  /**
   * Generate candidate questions from issues
   */
  private generateCandidates(
    issues: RequestIssue[],
    originalRequest: string
  ): ClarifyingQuestion[] {
    const questions: ClarifyingQuestion[] = [];
    let priority = 1;

    for (const issue of issues) {
      const template = this.findTemplate(issue.type);
      if (!template) continue;

      // Select a pattern (cycle through for variety)
      const patternIndex = questions.length % template.patterns.length;
      const pattern = template.patterns[patternIndex];

      // Generate question text
      const text = this.applyTemplate(pattern, issue);

      // Skip if it's a yes/no question
      if (this.isYesNoQuestion(text)) {
        continue;
      }

      questions.push({
        id: `q-${Date.now()}-${questions.length}`,
        text,
        rationale: issue.description,
        priority: priority + (template.priorityBoost ?? 0),
        addressedIssues: [issue.type],
        expectedAnswerType: template.answerType,
        context: this.extractContext(originalRequest, issue),
      });

      priority++;
    }

    return questions;
  }

  /**
   * Find template for issue type
   */
  private findTemplate(issueType: IssueType): QuestionTemplate | undefined {
    return this.templates.find(t => t.issueType === issueType);
  }

  /**
   * Apply template with issue data
   */
  private applyTemplate(pattern: string, issue: RequestIssue): string {
    return pattern
      .replace('{trigger}', issue.trigger)
      .replace('{context}', issue.description);
  }

  /**
   * Extract relevant context from original request
   */
  private extractContext(request: string, issue: RequestIssue): string {
    // If we have a position, extract surrounding context
    if (issue.position !== undefined) {
      const start = Math.max(0, issue.position - 20);
      const end = Math.min(request.length, issue.position + issue.trigger.length + 20);
      return request.substring(start, end).trim();
    }
    return request.length > 50 ? request.substring(0, 50) + '...' : request;
  }

  // ==========================================================================
  // Consolidation
  // ==========================================================================

  /**
   * Consolidate related questions into comprehensive ones
   */
  private consolidateQuestions(questions: ClarifyingQuestion[]): ClarifyingQuestion[] {
    if (questions.length <= this.config.maxQuestions) {
      return questions;
    }

    const consolidated: ClarifyingQuestion[] = [];
    const used = new Set<number>();

    // Group by issue type
    const byType = new Map<IssueType, ClarifyingQuestion[]>();
    for (const q of questions) {
      const type = q.addressedIssues[0];
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(q);
    }

    // Create consolidated questions for types with multiple issues
    for (const [type, typeQuestions] of byType) {
      if (typeQuestions.length > 1) {
        // Combine into one comprehensive question
        const combined = this.combineQuestions(typeQuestions, type);
        consolidated.push(combined);
      } else {
        consolidated.push(typeQuestions[0]);
      }
    }

    return consolidated;
  }

  /**
   * Combine multiple questions of same type
   */
  private combineQuestions(questions: ClarifyingQuestion[], type: IssueType): ClarifyingQuestion {
    const triggers = questions.map(q => {
      // Extract trigger from question context or rationale
      return q.context?.match(/"([^"]+)"/)?.[1] || q.rationale.split(' ').slice(-1)[0];
    }).filter(Boolean);

    const combinedText = this.createCombinedQuestion(type, triggers);

    return {
      id: `q-combined-${Date.now()}`,
      text: combinedText,
      rationale: `Addresses ${questions.length} related ${type} issues`,
      priority: Math.min(...questions.map(q => q.priority)),
      addressedIssues: questions.flatMap(q => q.addressedIssues),
      expectedAnswerType: questions[0].expectedAnswerType,
      context: questions.map(q => q.context).join('; '),
    };
  }

  /**
   * Create a combined question for multiple triggers
   */
  private createCombinedQuestion(type: IssueType, triggers: string[]): string {
    const triggerList = triggers.slice(0, 3).join(', ');

    switch (type) {
      case 'vague_term':
        return `What specific requirements do you have for: ${triggerList}?`;
      case 'missing_detail':
        return `What are the specifications for: ${triggerList}?`;
      case 'conflict':
        return `How should we resolve the trade-offs between: ${triggerList}?`;
      case 'unclear_scope':
        return `What specific areas should be included in the scope?`;
      default:
        return `Can you clarify the following: ${triggerList}?`;
    }
  }

  // ==========================================================================
  // Selection and Validation
  // ==========================================================================

  /**
   * Select top questions up to max limit
   */
  private selectTopQuestions(questions: ClarifyingQuestion[]): ClarifyingQuestion[] {
    // Sort by priority (lower is better)
    const sorted = [...questions].sort((a, b) => a.priority - b.priority);

    // Take top N
    return sorted.slice(0, this.config.maxQuestions);
  }

  /**
   * Validate questions don't use yes/no format
   */
  private validateQuestions(questions: ClarifyingQuestion[]): ClarifyingQuestion[] {
    return questions.map(q => {
      if (this.isYesNoQuestion(q.text)) {
        // Transform to open-ended
        return {
          ...q,
          text: this.transformToOpenEnded(q.text),
        };
      }
      return q;
    });
  }

  /**
   * Check if question is yes/no format
   */
  private isYesNoQuestion(question: string): boolean {
    return YES_NO_INDICATORS.some(pattern => pattern.test(question.trim()));
  }

  /**
   * Transform yes/no question to open-ended
   */
  private transformToOpenEnded(question: string): string {
    // Common transformations
    const transformations: [RegExp, string][] = [
      [/^Is there\s+/i, 'What '],
      [/^Are there\s+/i, 'What '],
      [/^Do you want\s+/i, 'What kind of '],
      [/^Do you need\s+/i, 'What '],
      [/^Should (it|we|this)\s+/i, 'How should '],
      [/^Can (it|we|this)\s+/i, 'How can '],
      [/^Will (it|we|this)\s+/i, 'How will '],
      [/^Would you like\s+/i, 'What '],
      [/^Does (it|this)\s+/i, 'How does '],
    ];

    for (const [pattern, replacement] of transformations) {
      if (pattern.test(question)) {
        return question.replace(pattern, replacement);
      }
    }

    // Fallback: prepend "What are your requirements for"
    return `What are your requirements for: ${question.replace(/\?$/, '')}?`;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Count total issues addressed by questions
   */
  private countAddressedIssues(questions: ClarifyingQuestion[]): number {
    const types = new Set<IssueType>();
    for (const q of questions) {
      for (const type of q.addressedIssues) {
        types.add(type);
      }
    }
    return types.size;
  }

  /**
   * Create empty result when no questions needed
   */
  private createEmptyResult(analysis: AnalysisResult): QuestionGenerationResult {
    return {
      questions: [],
      analysisRef: {
        request: analysis.request,
        clarityScore: analysis.clarityScore,
        issueCount: analysis.issues.length,
      },
      hasQuestions: false,
      issuesAddressed: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Get configuration
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }

  /**
   * Add custom template
   */
  addTemplate(template: QuestionTemplate): void {
    this.templates.push(template);
  }

  /**
   * Generate a single question for a specific issue
   */
  generateForIssue(issue: RequestIssue): ClarifyingQuestion | null {
    const template = this.findTemplate(issue.type);
    if (!template) return null;

    const pattern = template.patterns[0];
    const text = this.applyTemplate(pattern, issue);

    if (this.isYesNoQuestion(text)) {
      return {
        id: `q-${Date.now()}`,
        text: this.transformToOpenEnded(text),
        rationale: issue.description,
        priority: 1,
        addressedIssues: [issue.type],
        expectedAnswerType: template.answerType,
      };
    }

    return {
      id: `q-${Date.now()}`,
      text,
      rationale: issue.description,
      priority: 1,
      addressedIssues: [issue.type],
      expectedAnswerType: template.answerType,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ClarifyingQuestionGenerator instance
 */
export function createQuestionGenerator(
  config?: QuestionGeneratorConfig
): ClarifyingQuestionGenerator {
  return new ClarifyingQuestionGenerator(config);
}

/**
 * Quick generate function
 */
export function generateQuestions(
  analysis: AnalysisResult,
  config?: QuestionGeneratorConfig
): QuestionGenerationResult {
  return new ClarifyingQuestionGenerator(config).generate(analysis);
}

// ============================================================================
// Exports
// ============================================================================

export default ClarifyingQuestionGenerator;

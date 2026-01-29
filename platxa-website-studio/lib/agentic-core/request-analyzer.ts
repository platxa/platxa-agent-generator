/**
 * Request Analyzer - Detects ambiguity and missing information in user requests
 *
 * Analyzes requests to identify:
 * - Vague terms that need clarification
 * - Missing details required for implementation
 * - Conflicting requirements that need resolution
 *
 * @module agentic-core/request-analyzer
 */

// ============================================================================
// Types
// ============================================================================

/** Severity of an issue */
export type IssueSeverity = 'low' | 'medium' | 'high';

/** Type of detected issue */
export type IssueType = 'vague_term' | 'missing_detail' | 'conflict' | 'unclear_scope';

/** A detected issue in the request */
export interface RequestIssue {
  /** Issue type */
  type: IssueType;
  /** Severity level */
  severity: IssueSeverity;
  /** Description of the issue */
  description: string;
  /** The specific text that triggered this issue */
  trigger: string;
  /** Suggested clarification questions */
  clarificationQuestions: string[];
  /** Position in original text (character index) */
  position?: number;
}

/** Vague term pattern */
export interface VagueTermPattern {
  /** Pattern to match */
  pattern: RegExp;
  /** Severity of vagueness */
  severity: IssueSeverity;
  /** Description of why it's vague */
  reason: string;
  /** Suggested clarification questions */
  clarifications: string[];
}

/** Required detail for a domain */
export interface RequiredDetail {
  /** Name of the required detail */
  name: string;
  /** Keywords that suggest this detail is needed */
  keywords: string[];
  /** Pattern to check if detail is present */
  presencePattern?: RegExp;
  /** Clarification question if missing */
  clarification: string;
  /** Severity if missing */
  severity: IssueSeverity;
}

/** Conflict pattern */
export interface ConflictPattern {
  /** First conflicting term/concept */
  termA: string[];
  /** Second conflicting term/concept */
  termB: string[];
  /** Why these conflict */
  reason: string;
  /** How to resolve */
  resolution: string;
  /** Severity of conflict */
  severity: IssueSeverity;
}

/** Analysis result */
export interface AnalysisResult {
  /** Original request text */
  request: string;
  /** All detected issues */
  issues: RequestIssue[];
  /** Issues grouped by type */
  issuesByType: Record<IssueType, RequestIssue[]>;
  /** Overall clarity score (0-1) */
  clarityScore: number;
  /** Whether the request needs clarification */
  needsClarification: boolean;
  /** Suggested clarification questions (prioritized) */
  suggestedQuestions: string[];
  /** Analysis timestamp */
  timestamp: Date;
}

/** Analyzer configuration */
export interface RequestAnalyzerConfig {
  /** Additional vague term patterns */
  vagueTermPatterns?: VagueTermPattern[];
  /** Additional required details */
  requiredDetails?: RequiredDetail[];
  /** Additional conflict patterns */
  conflictPatterns?: ConflictPattern[];
  /** Minimum clarity score before needing clarification (0-1) */
  clarityThreshold?: number;
  /** Domain-specific context (e.g., 'odoo', 'website', 'design') */
  domain?: string;
}

// ============================================================================
// Default Patterns
// ============================================================================

/** Default vague term patterns */
const DEFAULT_VAGUE_PATTERNS: VagueTermPattern[] = [
  {
    pattern: /\b(better|improve|enhance|optimize)\b/gi,
    severity: 'medium',
    reason: 'Vague improvement request without specific criteria',
    clarifications: [
      'What specific aspect should be improved?',
      'How would you measure "better"?',
      'What is the current issue you want to address?',
    ],
  },
  {
    pattern: /\b(nice|good|great|beautiful|pretty|cool)\b/gi,
    severity: 'high',
    reason: 'Subjective aesthetic term without specific requirements',
    clarifications: [
      'Can you describe the visual style you prefer?',
      'Are there examples of designs you like?',
      'What colors, fonts, or styles do you prefer?',
    ],
  },
  {
    pattern: /\b(fast|quick|slow|performance)\b/gi,
    severity: 'medium',
    reason: 'Performance requirement without specific metrics',
    clarifications: [
      'What is the target load time or response time?',
      'What is the current performance issue?',
      'Are there specific pages or operations that need optimization?',
    ],
  },
  {
    pattern: /\b(modern|clean|minimalist|professional)\b/gi,
    severity: 'medium',
    reason: 'Design style term that can be interpreted many ways',
    clarifications: [
      'Can you share examples of designs you consider modern/clean?',
      'What specific visual elements represent this style to you?',
      'Are there any design constraints or brand guidelines?',
    ],
  },
  {
    pattern: /\b(some|a few|several|many|various)\b/gi,
    severity: 'low',
    reason: 'Imprecise quantity',
    clarifications: [
      'How many exactly do you need?',
      'Is there a minimum or maximum number?',
    ],
  },
  {
    pattern: /\b(soon|later|eventually|sometime)\b/gi,
    severity: 'low',
    reason: 'Vague timeline',
    clarifications: [
      'What is the specific deadline?',
      'What is the priority of this task?',
    ],
  },
  {
    pattern: /\b(etc|and so on|and more|stuff like that)\b/gi,
    severity: 'medium',
    reason: 'Incomplete list of requirements',
    clarifications: [
      'Can you list all the items/features you need?',
      'What other items should be included?',
    ],
  },
  {
    pattern: /\b(maybe|perhaps|possibly|might|could)\b/gi,
    severity: 'low',
    reason: 'Uncertain requirement',
    clarifications: [
      'Is this feature definitely needed?',
      'What conditions would make this necessary?',
    ],
  },
  {
    pattern: /\b(something like|kind of|sort of)\b/gi,
    severity: 'medium',
    reason: 'Approximate description without specifics',
    clarifications: [
      'Can you describe exactly what you need?',
      'Are there specific examples you can reference?',
    ],
  },
  {
    pattern: /\b(simple|easy|straightforward|basic)\b/gi,
    severity: 'low',
    reason: 'Complexity assumption that may not match expectations',
    clarifications: [
      'What specific features should this include?',
      'Are there any features you explicitly do NOT want?',
    ],
  },
];

/** Default required details for web/Odoo domain */
const DEFAULT_REQUIRED_DETAILS: RequiredDetail[] = [
  {
    name: 'color',
    keywords: ['color', 'theme', 'design', 'style', 'brand', 'ui', 'interface'],
    // Match hex colors, rgb/hsl, color names, or explicit color mentions
    presencePattern: /#[0-9a-f]{3,6}|rgb|hsl|color:|primary|secondary|accent|blue|red|green|yellow|orange|purple|pink|black|white|gray|grey|dark|light/i,
    clarification: 'What color scheme or brand colors should be used?',
    severity: 'medium',
  },
  {
    name: 'target_audience',
    keywords: ['landing', 'page', 'website', 'marketing', 'conversion'],
    presencePattern: /audience|users?|customers?|visitors?|target|demographic/i,
    clarification: 'Who is the target audience for this?',
    severity: 'low',
  },
  {
    name: 'responsive',
    keywords: ['layout', 'design', 'page', 'template', 'section'],
    presencePattern: /responsive|mobile|tablet|desktop|breakpoint|media query/i,
    clarification: 'Should this be responsive for mobile and tablet?',
    severity: 'medium',
  },
  {
    name: 'content',
    keywords: ['section', 'hero', 'banner', 'header', 'about'],
    // Match content specifications - with or without colons, quoted text, or explicit mentions
    presencePattern: /text[:\s]|content[:\s]|copy[:\s]|heading[:\s"]|title[:\s"]|subtitle[:\s"]|"[^"]+"|'[^']+'/i,
    clarification: 'What content/text should be displayed?',
    severity: 'high',
  },
  {
    name: 'images',
    keywords: ['hero', 'banner', 'gallery', 'portfolio', 'carousel'],
    // Match visual elements - images, backgrounds, gradients, videos, etc.
    presencePattern: /image|photo|picture|graphic|visual|media|background|gradient|video|illustration|icon/i,
    clarification: 'What images should be included? Do you have them ready?',
    severity: 'medium',
  },
  {
    name: 'cta',
    keywords: ['hero', 'banner', 'landing', 'marketing', 'conversion'],
    presencePattern: /button|cta|call.to.action|link|click/i,
    clarification: 'Should there be a call-to-action button? What should it say?',
    severity: 'medium',
  },
  {
    name: 'odoo_module',
    keywords: ['odoo', 'module', 'install', 'website', 'theme'],
    presencePattern: /module_name|depends|__manifest__|addons/i,
    clarification: 'Which Odoo module(s) should this integrate with?',
    severity: 'medium',
  },
];

/** Default conflict patterns */
const DEFAULT_CONFLICT_PATTERNS: ConflictPattern[] = [
  {
    termA: ['simple', 'minimal', 'basic'],
    termB: ['feature-rich', 'comprehensive', 'full-featured', 'all features'],
    reason: 'Simplicity conflicts with feature richness',
    resolution: 'Prioritize either simplicity or features, or define specific features needed',
    severity: 'high',
  },
  {
    termA: ['fast', 'quick', 'performance'],
    termB: ['animation', 'effects', 'transitions', 'heavy graphics'],
    reason: 'Heavy animations can impact performance',
    resolution: 'Specify acceptable performance thresholds with animation requirements',
    severity: 'medium',
  },
  {
    termA: ['unique', 'custom', 'original'],
    termB: ['standard', 'template', 'bootstrap', 'existing'],
    reason: 'Custom design conflicts with using templates',
    resolution: 'Clarify how much customization is needed vs using existing components',
    severity: 'medium',
  },
  {
    termA: ['asap', 'urgent', 'immediately', 'today'],
    termB: ['perfect', 'polished', 'production-ready', 'thoroughly tested'],
    reason: 'Urgent timeline conflicts with high quality expectations',
    resolution: 'Define minimum viable requirements for urgent delivery',
    severity: 'high',
  },
  {
    termA: ['mobile-first', 'mobile'],
    termB: ['desktop-first', 'desktop-focused'],
    reason: 'Conflicting device priority',
    resolution: 'Clarify primary target device and adaptation strategy',
    severity: 'medium',
  },
];

// ============================================================================
// Request Analyzer Class
// ============================================================================

/**
 * RequestAnalyzer - Detects ambiguity and missing information
 *
 * @example
 * ```typescript
 * const analyzer = new RequestAnalyzer();
 *
 * const result = analyzer.analyze('Make the website look nice and modern');
 *
 * console.log(result.issues);
 * // [
 * //   { type: 'vague_term', trigger: 'nice', ... },
 * //   { type: 'vague_term', trigger: 'modern', ... }
 * // ]
 *
 * console.log(result.suggestedQuestions);
 * // ['Can you describe the visual style you prefer?', ...]
 * ```
 */
export class RequestAnalyzer {
  private vaguePatterns: VagueTermPattern[];
  private requiredDetails: RequiredDetail[];
  private conflictPatterns: ConflictPattern[];
  private config: Required<Pick<RequestAnalyzerConfig, 'clarityThreshold' | 'domain'>>;

  constructor(config: RequestAnalyzerConfig = {}) {
    this.vaguePatterns = [
      ...DEFAULT_VAGUE_PATTERNS,
      ...(config.vagueTermPatterns ?? []),
    ];
    this.requiredDetails = [
      ...DEFAULT_REQUIRED_DETAILS,
      ...(config.requiredDetails ?? []),
    ];
    this.conflictPatterns = [
      ...DEFAULT_CONFLICT_PATTERNS,
      ...(config.conflictPatterns ?? []),
    ];
    this.config = {
      clarityThreshold: config.clarityThreshold ?? 0.7,
      domain: config.domain ?? 'web',
    };
  }

  // ==========================================================================
  // Main Analysis
  // ==========================================================================

  /**
   * Analyze a request for ambiguity and missing information
   */
  analyze(request: string): AnalysisResult {
    const issues: RequestIssue[] = [];

    // Detect vague terms
    const vagueIssues = this.detectVagueTerms(request);
    issues.push(...vagueIssues);

    // Detect missing details
    const missingIssues = this.detectMissingDetails(request);
    issues.push(...missingIssues);

    // Detect conflicts
    const conflictIssues = this.detectConflicts(request);
    issues.push(...conflictIssues);

    // Detect unclear scope
    const scopeIssues = this.detectUnclearScope(request);
    issues.push(...scopeIssues);

    // Group by type
    const issuesByType: Record<IssueType, RequestIssue[]> = {
      vague_term: issues.filter(i => i.type === 'vague_term'),
      missing_detail: issues.filter(i => i.type === 'missing_detail'),
      conflict: issues.filter(i => i.type === 'conflict'),
      unclear_scope: issues.filter(i => i.type === 'unclear_scope'),
    };

    // Calculate clarity score
    const clarityScore = this.calculateClarityScore(issues, request);

    // Collect and prioritize questions
    const suggestedQuestions = this.prioritizeQuestions(issues);

    return {
      request,
      issues,
      issuesByType,
      clarityScore,
      needsClarification: clarityScore < this.config.clarityThreshold,
      suggestedQuestions,
      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // Detection Methods
  // ==========================================================================

  /**
   * Detect vague terms in the request
   */
  detectVagueTerms(request: string): RequestIssue[] {
    const issues: RequestIssue[] = [];
    const lowerRequest = request.toLowerCase();

    for (const pattern of this.vaguePatterns) {
      const matches = request.matchAll(pattern.pattern);

      for (const match of matches) {
        issues.push({
          type: 'vague_term',
          severity: pattern.severity,
          description: pattern.reason,
          trigger: match[0],
          clarificationQuestions: pattern.clarifications,
          position: match.index,
        });
      }
    }

    return issues;
  }

  /**
   * Detect missing required details
   */
  detectMissingDetails(request: string): RequestIssue[] {
    const issues: RequestIssue[] = [];
    const lowerRequest = request.toLowerCase();

    for (const detail of this.requiredDetails) {
      // Check if any keyword suggests this detail is relevant
      const isRelevant = detail.keywords.some(kw =>
        lowerRequest.includes(kw.toLowerCase())
      );

      if (!isRelevant) continue;

      // Check if the detail is already present
      const isPresent = detail.presencePattern
        ? detail.presencePattern.test(request)
        : false;

      if (!isPresent) {
        issues.push({
          type: 'missing_detail',
          severity: detail.severity,
          description: `Missing ${detail.name} specification`,
          trigger: detail.keywords.find(kw =>
            lowerRequest.includes(kw.toLowerCase())
          ) || detail.name,
          clarificationQuestions: [detail.clarification],
        });
      }
    }

    return issues;
  }

  /**
   * Detect conflicting requirements
   */
  detectConflicts(request: string): RequestIssue[] {
    const issues: RequestIssue[] = [];
    const lowerRequest = request.toLowerCase();

    for (const conflict of this.conflictPatterns) {
      const hasTermA = conflict.termA.some(term =>
        lowerRequest.includes(term.toLowerCase())
      );
      const hasTermB = conflict.termB.some(term =>
        lowerRequest.includes(term.toLowerCase())
      );

      if (hasTermA && hasTermB) {
        const foundA = conflict.termA.find(t =>
          lowerRequest.includes(t.toLowerCase())
        );
        const foundB = conflict.termB.find(t =>
          lowerRequest.includes(t.toLowerCase())
        );

        issues.push({
          type: 'conflict',
          severity: conflict.severity,
          description: conflict.reason,
          trigger: `"${foundA}" vs "${foundB}"`,
          clarificationQuestions: [conflict.resolution],
        });
      }
    }

    return issues;
  }

  /**
   * Detect unclear scope
   */
  detectUnclearScope(request: string): RequestIssue[] {
    const issues: RequestIssue[] = [];

    // Very short requests often lack scope
    if (request.length < 20) {
      issues.push({
        type: 'unclear_scope',
        severity: 'high',
        description: 'Request is too brief to understand scope',
        trigger: request,
        clarificationQuestions: [
          'Can you provide more details about what you need?',
          'What is the context for this request?',
        ],
      });
    }

    // Check for scope-related vagueness
    const scopeIndicators = /\b(everything|all|entire|whole|complete)\b/gi;
    const matches = request.matchAll(scopeIndicators);

    for (const match of matches) {
      issues.push({
        type: 'unclear_scope',
        severity: 'medium',
        description: 'Broad scope indicator needs clarification',
        trigger: match[0],
        clarificationQuestions: [
          'Can you list the specific items/areas this includes?',
          'Are there any exceptions or exclusions?',
        ],
        position: match.index,
      });
    }

    return issues;
  }

  // ==========================================================================
  // Scoring and Prioritization
  // ==========================================================================

  /**
   * Calculate clarity score (0-1)
   *
   * Scoring factors:
   * - Issue severity (high issues penalize more)
   * - Request length (very short requests are penalized)
   * - Issue density (issues per character)
   */
  private calculateClarityScore(issues: RequestIssue[], request: string): number {
    if (issues.length === 0) return 1.0;

    // Weight by severity
    const severityWeights: Record<IssueSeverity, number> = {
      high: 0.25,
      medium: 0.15,
      low: 0.05,
    };

    let totalPenalty = 0;
    for (const issue of issues) {
      totalPenalty += severityWeights[issue.severity];
    }

    // Short requests should be penalized MORE, not less
    // Very short requests (<30 chars) get additional penalty
    const shortnessPenalty = request.length < 30
      ? 0.3 * (1 - request.length / 30)  // Up to 0.3 extra penalty for very short
      : 0;

    // Issue density penalty - more issues per character = worse
    const issueDensity = issues.length / Math.max(request.length, 1);
    const densityPenalty = Math.min(0.2, issueDensity * 10);

    // Combined penalty
    const combinedPenalty = totalPenalty + shortnessPenalty + densityPenalty;

    return Math.max(0, Math.min(1, 1 - combinedPenalty));
  }

  /**
   * Prioritize clarification questions by severity
   */
  private prioritizeQuestions(issues: RequestIssue[]): string[] {
    // Sort issues by severity (high first)
    const severityOrder: Record<IssueSeverity, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    const sortedIssues = [...issues].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );

    // Collect unique questions
    const seen = new Set<string>();
    const questions: string[] = [];

    for (const issue of sortedIssues) {
      for (const question of issue.clarificationQuestions) {
        if (!seen.has(question)) {
          seen.add(question);
          questions.push(question);
        }
      }
    }

    return questions;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if a specific issue type exists
   */
  hasIssueType(result: AnalysisResult, type: IssueType): boolean {
    return result.issuesByType[type].length > 0;
  }

  /**
   * Get issues above a severity threshold
   */
  getHighSeverityIssues(result: AnalysisResult): RequestIssue[] {
    return result.issues.filter(i => i.severity === 'high');
  }

  /**
   * Add custom vague term pattern
   */
  addVaguePattern(pattern: VagueTermPattern): void {
    this.vaguePatterns.push(pattern);
  }

  /**
   * Add custom required detail
   */
  addRequiredDetail(detail: RequiredDetail): void {
    this.requiredDetails.push(detail);
  }

  /**
   * Add custom conflict pattern
   */
  addConflictPattern(conflict: ConflictPattern): void {
    this.conflictPatterns.push(conflict);
  }

  /**
   * Get configuration
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new RequestAnalyzer instance
 */
export function createRequestAnalyzer(config?: RequestAnalyzerConfig): RequestAnalyzer {
  return new RequestAnalyzer(config);
}

/**
 * Quick analyze function
 */
export function analyzeRequest(request: string, config?: RequestAnalyzerConfig): AnalysisResult {
  return new RequestAnalyzer(config).analyze(request);
}

// ============================================================================
// Exports
// ============================================================================

export default RequestAnalyzer;

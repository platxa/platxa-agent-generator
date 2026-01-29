/**
 * False Positive Filter
 *
 * Features #37-41: Filter false positive alerts from static analysis tools.
 * Uses context extraction and classification to reduce alert fatigue.
 *
 * Research basis:
 * - LLM-based false positive filtering for static analysis
 * - Context-aware alert triaging
 *
 * @packageDocumentation
 */

import type { SourceLocation } from './types.js';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Feature #37: AlertContext interface
 *
 * Context information for an alert to enable accurate classification.
 */
export interface AlertContext {
  /** The alert being analyzed */
  alert: StaticAnalysisAlert;

  /** Code surrounding the alert location (±N lines) */
  surroundingCode: SurroundingCode;

  /** Data flow path leading to/from the alert location */
  dataFlowPath: DataFlowPath;

  /** Project-level context */
  projectContext: ProjectContext;

  /** Additional contextual information */
  metadata?: Record<string, unknown>;
}

/**
 * Static analysis alert from tools like ESLint, CodeQL, Semgrep
 */
export interface StaticAnalysisAlert {
  /** Unique alert identifier */
  id: string;

  /** Alert rule/check ID */
  ruleId: string;

  /** Alert message */
  message: string;

  /** Severity level */
  severity: AlertSeverity;

  /** Alert category */
  category: AlertCategory;

  /** Location in source code */
  location: SourceLocation;

  /** Tool that generated the alert */
  tool: AnalysisTool;

  /** CWE ID if security-related */
  cweId?: string;

  /** Confidence from the analysis tool */
  toolConfidence?: number;
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertCategory =
  | 'security'
  | 'performance'
  | 'reliability'
  | 'maintainability'
  | 'style'
  | 'correctness'
  | 'deprecated'
  | 'best-practice';

export type AnalysisTool =
  | 'eslint'
  | 'codeql'
  | 'semgrep'
  | 'sonarqube'
  | 'bandit'
  | 'pylint'
  | 'mypy'
  | 'typescript'
  | 'custom';

/**
 * Surrounding code context
 */
export interface SurroundingCode {
  /** Lines before the alert */
  before: CodeLine[];

  /** The line containing the alert */
  alertLine: CodeLine;

  /** Lines after the alert */
  after: CodeLine[];

  /** Full snippet as string */
  snippet: string;

  /** Function/method containing the alert */
  containingFunction?: FunctionInfo;

  /** Class containing the alert */
  containingClass?: ClassInfo;
}

export interface CodeLine {
  lineNumber: number;
  content: string;
  isAlertLine: boolean;
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType?: string;
  isAsync: boolean;
  startLine: number;
  endLine: number;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements?: string[];
  startLine: number;
  endLine: number;
}

/**
 * Data flow path information
 */
export interface DataFlowPath {
  /** Source of the data (if taint tracking) */
  source?: DataFlowNode;

  /** Sink of the data (if taint tracking) */
  sink?: DataFlowNode;

  /** Intermediate nodes in the flow */
  path: DataFlowNode[];

  /** Whether the path has sanitization */
  hasSanitization: boolean;

  /** Sanitizers found in the path */
  sanitizers: string[];
}

export interface DataFlowNode {
  location: SourceLocation;
  expression: string;
  type: DataFlowNodeType;
}

export type DataFlowNodeType = 'source' | 'sink' | 'propagator' | 'sanitizer' | 'intermediate';

/**
 * Project-level context
 */
export interface ProjectContext {
  /** Project name */
  name: string;

  /** Project type (web, api, library, etc.) */
  type: ProjectType;

  /** Framework being used */
  framework?: string;

  /** Security configuration presence */
  hasSecurityConfig: boolean;

  /** Testing framework presence */
  hasTests: boolean;

  /** CI/CD presence */
  hasCICD: boolean;

  /** Known safe patterns in the project */
  safePatterns: string[];

  /** Custom suppressions configured */
  suppressions: SuppressionRule[];
}

export type ProjectType = 'web' | 'api' | 'library' | 'cli' | 'mobile' | 'desktop' | 'unknown';

export interface SuppressionRule {
  ruleId: string;
  pattern?: string;
  reason: string;
  expires?: number;
}

/**
 * Classification result
 */
export interface ClassificationResult {
  /** Alert ID */
  alertId: string;

  /** Whether this is a true positive */
  isTruePositive: boolean;

  /** Confidence in the classification (0-1) */
  confidence: number;

  /** Reasoning for the classification */
  reasoning: string;

  /** Evidence supporting the classification */
  evidence: ClassificationEvidence[];

  /** Suggested action */
  suggestedAction: SuggestedAction;

  /** Risk if ignored (for true positives) */
  riskIfIgnored?: RiskAssessment;
}

export interface ClassificationEvidence {
  type: EvidenceType;
  description: string;
  weight: number;
}

export type EvidenceType =
  | 'code_pattern'
  | 'data_flow'
  | 'context'
  | 'historical'
  | 'tool_confidence'
  | 'sanitization'
  | 'suppression';

export type SuggestedAction =
  | 'fix_immediately'
  | 'fix_soon'
  | 'investigate'
  | 'suppress'
  | 'ignore';

export interface RiskAssessment {
  level: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  likelihood: string;
}

/**
 * Configuration for FalsePositiveFilter
 */
export interface FalsePositiveFilterConfig {
  /** Number of lines to extract before alert */
  linesBefore: number;

  /** Number of lines to extract after alert */
  linesAfter: number;

  /** Minimum confidence to classify as true positive */
  truePositiveThreshold: number;

  /** Minimum confidence to classify as false positive */
  falsePositiveThreshold: number;

  /** Whether to use data flow analysis */
  useDataFlow: boolean;

  /** Whether to check for sanitization */
  checkSanitization: boolean;

  /** Custom safe patterns */
  safePatterns: SafePattern[];

  /** Batch size for processing */
  batchSize: number;
}

export interface SafePattern {
  ruleId: string;
  pattern: RegExp;
  reason: string;
}

/**
 * Batch filter result
 */
export interface BatchFilterResult {
  /** All alerts processed */
  total: number;

  /** Alerts classified as true positives */
  truePositives: ClassificationResult[];

  /** Alerts classified as false positives */
  falsePositives: ClassificationResult[];

  /** Alerts that couldn't be confidently classified */
  uncertain: ClassificationResult[];

  /** Processing statistics */
  stats: FilterStats;
}

export interface FilterStats {
  processingTimeMs: number;
  truePositiveRate: number;
  falsePositiveRate: number;
  uncertainRate: number;
  avgConfidence: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Known safe patterns by rule category
 */
const DEFAULT_SAFE_PATTERNS: SafePattern[] = [
  // XSS patterns with proper encoding
  {
    ruleId: 'no-dangerouslySetInnerHTML',
    pattern: /DOMPurify\.sanitize|xss\.filterXSS|escapeHtml/,
    reason: 'Content is sanitized before use',
  },
  // SQL injection with parameterized queries
  {
    ruleId: 'sql-injection',
    pattern: /\$\d+|\?|:[\w]+|@[\w]+|preparedStatement|parameterized/i,
    reason: 'Uses parameterized query',
  },
  // Path traversal with validation
  {
    ruleId: 'path-traversal',
    pattern: /path\.normalize|path\.resolve|realpath|isAbsolute/,
    reason: 'Path is validated',
  },
  // Command injection with allow lists
  {
    ruleId: 'command-injection',
    pattern: /execFileSync|spawnSync.*shell:\s*false|allowedCommands|whitelist/i,
    reason: 'Command execution is restricted',
  },
  // Hardcoded credentials in tests
  {
    ruleId: 'hardcoded-credentials',
    pattern: /\.test\.|\.spec\.|__tests__|__mocks__|fixtures|mock/i,
    reason: 'Test file - credentials are not real',
  },
];

/**
 * Severity weights for risk calculation
 */
const SEVERITY_WEIGHTS: Record<AlertSeverity, number> = {
  critical: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.3,
  info: 0.1,
};

/**
 * Category weights for true positive likelihood
 */
const CATEGORY_WEIGHTS: Record<AlertCategory, number> = {
  security: 0.9,
  correctness: 0.8,
  reliability: 0.7,
  performance: 0.5,
  maintainability: 0.4,
  deprecated: 0.3,
  'best-practice': 0.3,
  style: 0.2,
};

// =============================================================================
// False Positive Filter Class
// =============================================================================

/**
 * Feature #38: FalsePositiveFilter class
 *
 * Filters false positive alerts from static analysis tools.
 */
export class FalsePositiveFilter {
  private config: FalsePositiveFilterConfig;

  constructor(config: Partial<FalsePositiveFilterConfig> = {}) {
    this.config = {
      linesBefore: config.linesBefore ?? 5,
      linesAfter: config.linesAfter ?? 5,
      truePositiveThreshold: config.truePositiveThreshold ?? 0.7,
      falsePositiveThreshold: config.falsePositiveThreshold ?? 0.3,
      useDataFlow: config.useDataFlow ?? true,
      checkSanitization: config.checkSanitization ?? true,
      safePatterns: [...DEFAULT_SAFE_PATTERNS, ...(config.safePatterns ?? [])],
      batchSize: config.batchSize ?? 20,
    };
  }

  /**
   * Feature #39: Extract context around alert location
   *
   * Gathers ±N lines around the alert location plus metadata.
   */
  extractContext(
    alert: StaticAnalysisAlert,
    fileContent: string,
    projectContext: ProjectContext,
  ): AlertContext {
    const lines = fileContent.split('\n');
    const alertLineIndex = alert.location.line - 1;

    // Extract surrounding lines
    const beforeStart = Math.max(0, alertLineIndex - this.config.linesBefore);
    const afterEnd = Math.min(lines.length - 1, alertLineIndex + this.config.linesAfter);

    const before: CodeLine[] = [];
    for (let i = beforeStart; i < alertLineIndex; i++) {
      before.push({
        lineNumber: i + 1,
        content: lines[i] ?? '',
        isAlertLine: false,
      });
    }

    const alertLine: CodeLine = {
      lineNumber: alert.location.line,
      content: lines[alertLineIndex] ?? '',
      isAlertLine: true,
    };

    const after: CodeLine[] = [];
    for (let i = alertLineIndex + 1; i <= afterEnd; i++) {
      after.push({
        lineNumber: i + 1,
        content: lines[i] ?? '',
        isAlertLine: false,
      });
    }

    // Build snippet
    const snippet = [
      ...before.map(l => l.content),
      alertLine.content,
      ...after.map(l => l.content),
    ].join('\n');

    // Find containing function/class
    const containingFunction = this.findContainingFunction(lines, alertLineIndex);
    const containingClass = this.findContainingClass(lines, alertLineIndex);

    const surroundingCode: SurroundingCode = {
      before,
      alertLine,
      after,
      snippet,
      ...(containingFunction && { containingFunction }),
      ...(containingClass && { containingClass }),
    };

    // Extract data flow path
    const dataFlowPath = this.extractDataFlowPath(lines, alert);

    return {
      alert,
      surroundingCode,
      dataFlowPath,
      projectContext,
    };
  }

  /**
   * Find the function containing the alert line
   */
  private findContainingFunction(lines: string[], alertLineIndex: number): FunctionInfo | undefined {
    // Simple heuristic: look for function declaration before alert line
    const functionPatterns = [
      /(?:async\s+)?function\s+(\w+)\s*\((.*?)\)/,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>/,
      /(?:async\s+)?(\w+)\s*\((.*?)\)\s*\{/,
    ];

    for (let i = alertLineIndex; i >= 0; i--) {
      const line = lines[i] ?? '';

      for (const pattern of functionPatterns) {
        const match = line.match(pattern);
        if (match) {
          // Find function end (simple brace counting)
          let braceCount = 0;
          let endLine = i;
          for (let j = i; j < lines.length; j++) {
            const l = lines[j] ?? '';
            braceCount += (l.match(/\{/g) || []).length;
            braceCount -= (l.match(/\}/g) || []).length;
            if (braceCount === 0 && j > i) {
              endLine = j;
              break;
            }
          }

          return {
            name: match[1] ?? 'anonymous',
            parameters: (match[2] ?? '').split(',').map(p => p.trim()).filter(Boolean),
            isAsync: line.includes('async'),
            startLine: i + 1,
            endLine: endLine + 1,
          };
        }
      }
    }

    return undefined;
  }

  /**
   * Find the class containing the alert line
   */
  private findContainingClass(lines: string[], alertLineIndex: number): ClassInfo | undefined {
    const classPattern = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/;

    for (let i = alertLineIndex; i >= 0; i--) {
      const line = lines[i] ?? '';
      const match = line.match(classPattern);

      if (match) {
        // Find class end
        let braceCount = 0;
        let endLine = i;
        for (let j = i; j < lines.length; j++) {
          const l = lines[j] ?? '';
          braceCount += (l.match(/\{/g) || []).length;
          braceCount -= (l.match(/\}/g) || []).length;
          if (braceCount === 0 && j > i) {
            endLine = j;
            break;
          }
        }

        const implementsList = match[3]?.split(',').map(s => s.trim());
        return {
          name: match[1] ?? '',
          ...(match[2] && { extends: match[2] }),
          ...(implementsList && { implements: implementsList }),
          startLine: i + 1,
          endLine: endLine + 1,
        };
      }
    }

    return undefined;
  }

  /**
   * Extract data flow path for the alert
   */
  private extractDataFlowPath(lines: string[], alert: StaticAnalysisAlert): DataFlowPath {
    const path: DataFlowNode[] = [];
    let hasSanitization = false;
    const sanitizers: string[] = [];

    // Simple data flow analysis based on variable tracking
    const alertLineIndex = alert.location.line - 1;
    const alertLine = lines[alertLineIndex] ?? '';

    // Extract variable from alert location
    const varMatch = alertLine.match(/\b(\w+)\b/);
    const targetVar = varMatch?.[1];

    if (targetVar) {
      // Look backwards for assignments to this variable
      for (let i = alertLineIndex - 1; i >= Math.max(0, alertLineIndex - 20); i--) {
        const line = lines[i] ?? '';

        // Check for assignment
        if (line.includes(`${targetVar} =`) || line.includes(`${targetVar}:`)) {
          path.push({
            location: { file: alert.location.file, line: i + 1 },
            expression: line.trim(),
            type: 'intermediate',
          });
        }

        // Check for sanitization
        if (this.checkForSanitization(line)) {
          hasSanitization = true;
          const sanitizerMatch = line.match(/(\w+Sanitize|\w+Escape|\w+Encode|DOMPurify|xss\.\w+)/);
          if (sanitizerMatch) {
            sanitizers.push(sanitizerMatch[1] ?? 'unknown');
          }
        }
      }
    }

    // Add the alert location as sink
    path.push({
      location: alert.location,
      expression: alertLine.trim(),
      type: 'sink',
    });

    return {
      path,
      hasSanitization,
      sanitizers,
    };
  }

  /**
   * Check if a line contains sanitization
   */
  private checkForSanitization(line: string): boolean {
    const sanitizationPatterns = [
      /sanitize/i,
      /escape/i,
      /encode/i,
      /DOMPurify/,
      /xss\./,
      /validator\./,
      /htmlEntities/,
      /encodeURI/,
      /encodeURIComponent/,
    ];

    return sanitizationPatterns.some(p => p.test(line));
  }

  /**
   * Feature #40: Classify an alert as true or false positive
   */
  classifyAlert(context: AlertContext): ClassificationResult {
    const evidence: ClassificationEvidence[] = [];
    let truePositiveScore = 0;

    // Factor 1: Alert severity and category
    const severityWeight = SEVERITY_WEIGHTS[context.alert.severity];
    const categoryWeight = CATEGORY_WEIGHTS[context.alert.category];
    truePositiveScore += severityWeight * 0.2;
    truePositiveScore += categoryWeight * 0.2;

    evidence.push({
      type: 'tool_confidence',
      description: `Alert severity: ${context.alert.severity}, category: ${context.alert.category}`,
      weight: (severityWeight + categoryWeight) / 2,
    });

    // Factor 2: Tool confidence
    if (context.alert.toolConfidence !== undefined) {
      truePositiveScore += context.alert.toolConfidence * 0.15;
      evidence.push({
        type: 'tool_confidence',
        description: `Tool confidence: ${(context.alert.toolConfidence * 100).toFixed(0)}%`,
        weight: context.alert.toolConfidence,
      });
    }

    // Factor 3: Safe pattern matching
    const safePatternMatch = this.matchSafePattern(context);
    if (safePatternMatch) {
      truePositiveScore -= 0.4; // Significantly reduce score
      evidence.push({
        type: 'code_pattern',
        description: `Matches safe pattern: ${safePatternMatch.reason}`,
        weight: -0.4,
      });
    }

    // Factor 4: Data flow sanitization
    if (this.config.checkSanitization && context.dataFlowPath.hasSanitization) {
      truePositiveScore -= 0.3;
      evidence.push({
        type: 'sanitization',
        description: `Sanitization found: ${context.dataFlowPath.sanitizers.join(', ')}`,
        weight: -0.3,
      });
    }

    // Factor 5: Suppression rules
    const suppression = context.projectContext.suppressions.find(
      s => s.ruleId === context.alert.ruleId,
    );
    if (suppression) {
      truePositiveScore -= 0.25;
      evidence.push({
        type: 'suppression',
        description: `Suppressed: ${suppression.reason}`,
        weight: -0.25,
      });
    }

    // Factor 6: Test file detection
    if (this.isTestFile(context.alert.location.file)) {
      truePositiveScore -= 0.2;
      evidence.push({
        type: 'context',
        description: 'Alert is in a test file',
        weight: -0.2,
      });
    }

    // Factor 7: Code patterns suggesting intentional behavior
    const intentionalPattern = this.detectIntentionalPattern(context);
    if (intentionalPattern) {
      truePositiveScore -= 0.15;
      evidence.push({
        type: 'code_pattern',
        description: intentionalPattern,
        weight: -0.15,
      });
    }

    // Normalize score to 0-1
    const confidence = Math.max(0, Math.min(1, truePositiveScore));

    // Determine classification
    const isTruePositive = confidence >= this.config.truePositiveThreshold;

    // Generate reasoning
    const reasoning = this.generateReasoning(context, evidence, isTruePositive);

    // Determine suggested action
    const suggestedAction = this.determineSuggestedAction(
      isTruePositive,
      confidence,
      context.alert.severity,
    );

    // Risk assessment for true positives
    const riskIfIgnored = isTruePositive
      ? this.assessRisk(context.alert)
      : null;

    return {
      alertId: context.alert.id,
      isTruePositive,
      confidence,
      reasoning,
      evidence,
      suggestedAction,
      ...(riskIfIgnored && { riskIfIgnored }),
    };
  }

  /**
   * Match against safe patterns
   */
  private matchSafePattern(context: AlertContext): SafePattern | null {
    const codeToCheck = context.surroundingCode.snippet;

    for (const pattern of this.config.safePatterns) {
      if (pattern.ruleId === context.alert.ruleId || pattern.ruleId === '*') {
        if (pattern.pattern.test(codeToCheck)) {
          return pattern;
        }
      }
    }

    return null;
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /__tests__/,
      /__mocks__/,
      /test\//,
      /tests\//,
      /fixtures\//,
    ];

    return testPatterns.some(p => p.test(filePath));
  }

  /**
   * Detect patterns suggesting intentional behavior
   */
  private detectIntentionalPattern(context: AlertContext): string | null {
    const snippet = context.surroundingCode.snippet.toLowerCase();

    // Check for comments indicating intentional behavior
    if (snippet.includes('// intentional') || snippet.includes('// expected')) {
      return 'Comment indicates intentional behavior';
    }

    // Check for explicit disable comments
    if (
      snippet.includes('eslint-disable') ||
      snippet.includes('@ts-ignore') ||
      snippet.includes('// nosec') ||
      snippet.includes('// noqa')
    ) {
      return 'Explicit disable comment present';
    }

    // Check for debug/development context
    if (
      snippet.includes('if (process.env.node_env') ||
      snippet.includes('if (debug)')
    ) {
      return 'Development/debug conditional context';
    }

    return null;
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    context: AlertContext,
    evidence: ClassificationEvidence[],
    isTruePositive: boolean,
  ): string {
    const parts: string[] = [];

    if (isTruePositive) {
      parts.push(`This ${context.alert.category} alert is likely a true positive.`);

      // Add supporting evidence
      const supporting = evidence.filter(e => e.weight > 0);
      if (supporting.length > 0) {
        parts.push('Supporting factors:');
        supporting.forEach(e => parts.push(`- ${e.description}`));
      }
    } else {
      parts.push('This alert is likely a false positive.');

      // Add mitigating evidence
      const mitigating = evidence.filter(e => e.weight < 0);
      if (mitigating.length > 0) {
        parts.push('Reasons:');
        mitigating.forEach(e => parts.push(`- ${e.description}`));
      }
    }

    return parts.join('\n');
  }

  /**
   * Determine suggested action
   */
  private determineSuggestedAction(
    isTruePositive: boolean,
    confidence: number,
    severity: AlertSeverity,
  ): SuggestedAction {
    if (!isTruePositive) {
      return confidence < 0.2 ? 'ignore' : 'suppress';
    }

    if (severity === 'critical' || (severity === 'high' && confidence > 0.8)) {
      return 'fix_immediately';
    }

    if (severity === 'high' || (severity === 'medium' && confidence > 0.7)) {
      return 'fix_soon';
    }

    if (confidence > 0.5) {
      return 'investigate';
    }

    return 'investigate';
  }

  /**
   * Assess risk of ignoring a true positive
   */
  private assessRisk(alert: StaticAnalysisAlert): RiskAssessment {
    const severityToRisk: Record<AlertSeverity, RiskAssessment['level']> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
      info: 'low',
    };

    const categoryImpacts: Record<AlertCategory, string> = {
      security: 'Potential security vulnerability',
      correctness: 'Incorrect program behavior',
      reliability: 'Reduced system reliability',
      performance: 'Performance degradation',
      maintainability: 'Increased maintenance burden',
      deprecated: 'Future compatibility issues',
      'best-practice': 'Code quality reduction',
      style: 'Inconsistent code style',
    };

    return {
      level: severityToRisk[alert.severity],
      impact: categoryImpacts[alert.category],
      likelihood: alert.severity === 'critical' || alert.severity === 'high'
        ? 'High if exploited/triggered'
        : 'Moderate under normal conditions',
    };
  }

  /**
   * Feature #41: Batch filter multiple alerts
   */
  async batchFilter(
    alerts: StaticAnalysisAlert[],
    fileContents: Map<string, string>,
    projectContext: ProjectContext,
  ): Promise<BatchFilterResult> {
    const startTime = Date.now();

    const truePositives: ClassificationResult[] = [];
    const falsePositives: ClassificationResult[] = [];
    const uncertain: ClassificationResult[] = [];

    // Process in batches
    for (let i = 0; i < alerts.length; i += this.config.batchSize) {
      const batch = alerts.slice(i, i + this.config.batchSize);

      for (const alert of batch) {
        const fileContent = fileContents.get(alert.location.file);
        if (!fileContent) {
          // Can't analyze without file content
          uncertain.push({
            alertId: alert.id,
            isTruePositive: true, // Assume true positive if we can't analyze
            confidence: 0.5,
            reasoning: 'Could not analyze: file content not available',
            evidence: [],
            suggestedAction: 'investigate',
          });
          continue;
        }

        const context = this.extractContext(alert, fileContent, projectContext);
        const result = this.classifyAlert(context);

        // Categorize by confidence
        if (result.confidence >= this.config.truePositiveThreshold) {
          truePositives.push(result);
        } else if (result.confidence <= this.config.falsePositiveThreshold) {
          falsePositives.push(result);
        } else {
          uncertain.push(result);
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const total = alerts.length;

    const stats: FilterStats = {
      processingTimeMs,
      truePositiveRate: total > 0 ? truePositives.length / total : 0,
      falsePositiveRate: total > 0 ? falsePositives.length / total : 0,
      uncertainRate: total > 0 ? uncertain.length / total : 0,
      avgConfidence: this.calculateAvgConfidence([...truePositives, ...falsePositives, ...uncertain]),
    };

    return {
      total,
      truePositives,
      falsePositives,
      uncertain,
      stats,
    };
  }

  /**
   * Calculate average confidence across results
   */
  private calculateAvgConfidence(results: ClassificationResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  }

  /**
   * Filter alerts and return only likely true positives
   */
  async filter(
    alerts: StaticAnalysisAlert[],
    fileContents: Map<string, string>,
    projectContext: ProjectContext,
  ): Promise<StaticAnalysisAlert[]> {
    const result = await this.batchFilter(alerts, fileContents, projectContext);

    // Return alerts that are likely true positives
    const truePositiveIds = new Set(result.truePositives.map(r => r.alertId));
    const uncertainIds = new Set(result.uncertain.map(r => r.alertId));

    return alerts.filter(a =>
      truePositiveIds.has(a.id) || uncertainIds.has(a.id),
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new FalsePositiveFilter instance
 */
export function createFalsePositiveFilter(
  config?: Partial<FalsePositiveFilterConfig>,
): FalsePositiveFilter {
  return new FalsePositiveFilter(config);
}

/**
 * Quick function to filter alerts
 */
export async function filterFalsePositives(
  alerts: StaticAnalysisAlert[],
  fileContents: Map<string, string>,
  projectContext: ProjectContext,
  config?: Partial<FalsePositiveFilterConfig>,
): Promise<BatchFilterResult> {
  const filter = createFalsePositiveFilter(config);
  return filter.batchFilter(alerts, fileContents, projectContext);
}

/**
 * Classify a single alert
 */
export function classifyAlert(
  alert: StaticAnalysisAlert,
  fileContent: string,
  projectContext: ProjectContext,
  config?: Partial<FalsePositiveFilterConfig>,
): ClassificationResult {
  const filter = createFalsePositiveFilter(config);
  const context = filter.extractContext(alert, fileContent, projectContext);
  return filter.classifyAlert(context);
}

/**
 * Accessibility Auditor
 *
 * Integrates accessibility checking into validation phase:
 * - Runs WCAG compliance checks
 * - Reports accessibility violations
 * - Triggers fix loop on failures
 */

// =============================================================================
// Types
// =============================================================================

/** WCAG conformance level */
export type WCAGLevel = "A" | "AA" | "AAA";

/** Violation severity */
export type ViolationSeverity = "critical" | "serious" | "moderate" | "minor";

/** Accessibility rule category */
export type RuleCategory =
  | "aria"           // ARIA attributes
  | "color"          // Color contrast
  | "forms"          // Form accessibility
  | "keyboard"       // Keyboard navigation
  | "language"       // Language attributes
  | "name-role"      // Names and roles
  | "parsing"        // HTML parsing
  | "semantics"      // Semantic HTML
  | "sensory"        // Sensory characteristics
  | "structure"      // Document structure
  | "tables"         // Table accessibility
  | "text"           // Text alternatives
  | "timing";        // Time limits

/** Accessibility rule */
export interface AccessibilityRule {
  /** Rule ID */
  id: string;
  /** Rule description */
  description: string;
  /** WCAG criteria */
  wcagCriteria: string[];
  /** Conformance level */
  level: WCAGLevel;
  /** Category */
  category: RuleCategory;
  /** Severity */
  severity: ViolationSeverity;
  /** Help URL */
  helpUrl?: string;
}

/** Accessibility violation */
export interface AccessibilityViolation {
  /** Unique violation ID */
  id: string;
  /** Rule that was violated */
  rule: AccessibilityRule;
  /** HTML element selector */
  selector: string;
  /** Element HTML */
  html?: string;
  /** Violation message */
  message: string;
  /** Suggested fix */
  suggestedFix?: string;
  /** Impact description */
  impact: string;
  /** File path if known */
  filePath?: string;
  /** Line number if known */
  lineNumber?: number;
}

/** Audit result */
export interface AuditResult {
  /** Whether audit passed */
  passed: boolean;
  /** All violations found */
  violations: AccessibilityViolation[];
  /** Violations by severity */
  bySeverity: Record<ViolationSeverity, AccessibilityViolation[]>;
  /** Total elements checked */
  elementsChecked: number;
  /** Rules applied */
  rulesApplied: number;
  /** Audit duration (ms) */
  duration: number;
  /** Timestamp */
  timestamp: number;
  /** WCAG level tested */
  wcagLevel: WCAGLevel;
}

/** Fix attempt for violation */
export interface FixAttempt {
  /** Violation being fixed */
  violation: AccessibilityViolation;
  /** Fix applied */
  fixApplied: string;
  /** Whether fix succeeded */
  success: boolean;
  /** Error if failed */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

/** Fix loop result */
export interface FixLoopResult {
  /** Initial violations */
  initialViolations: number;
  /** Remaining violations */
  remainingViolations: number;
  /** Fix attempts made */
  attempts: FixAttempt[];
  /** Whether all violations fixed */
  allFixed: boolean;
  /** Total duration (ms) */
  duration: number;
}

/** Auditor configuration */
export interface AuditorConfig {
  /** WCAG conformance level */
  wcagLevel: WCAGLevel;
  /** Run as part of validation */
  runInValidation: boolean;
  /** Auto-trigger fix loop */
  autoFix: boolean;
  /** Max fix attempts per violation */
  maxFixAttempts: number;
  /** Severities that block validation */
  blockingSeverities: ViolationSeverity[];
  /** Categories to check */
  categories: RuleCategory[];
  /** Custom rules */
  customRules: AccessibilityRule[];
}

/** Validation phase hook */
export type ValidationHook = (result: AuditResult) => void;

/** Fix function */
export type FixFunction = (violation: AccessibilityViolation) => Promise<FixAttempt>;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: AuditorConfig = {
  wcagLevel: "AA",
  runInValidation: true,
  autoFix: true,
  maxFixAttempts: 3,
  blockingSeverities: ["critical", "serious"],
  categories: [
    "aria",
    "color",
    "forms",
    "keyboard",
    "name-role",
    "semantics",
    "structure",
    "text",
  ],
  customRules: [],
};

// =============================================================================
// Built-in Rules
// =============================================================================

/** Built-in accessibility rules */
export const BUILT_IN_RULES: AccessibilityRule[] = [
  {
    id: "img-alt",
    description: "Images must have alternate text",
    wcagCriteria: ["1.1.1"],
    level: "A",
    category: "text",
    severity: "critical",
    helpUrl: "https://www.w3.org/WAI/WCAG21/Understanding/non-text-content",
  },
  {
    id: "button-name",
    description: "Buttons must have discernible text",
    wcagCriteria: ["4.1.2"],
    level: "A",
    category: "name-role",
    severity: "critical",
  },
  {
    id: "link-name",
    description: "Links must have discernible text",
    wcagCriteria: ["4.1.2", "2.4.4"],
    level: "A",
    category: "name-role",
    severity: "serious",
  },
  {
    id: "color-contrast",
    description: "Text must have sufficient color contrast",
    wcagCriteria: ["1.4.3"],
    level: "AA",
    category: "color",
    severity: "serious",
  },
  {
    id: "form-label",
    description: "Form inputs must have labels",
    wcagCriteria: ["1.3.1", "4.1.2"],
    level: "A",
    category: "forms",
    severity: "critical",
  },
  {
    id: "html-lang",
    description: "HTML element must have lang attribute",
    wcagCriteria: ["3.1.1"],
    level: "A",
    category: "language",
    severity: "serious",
  },
  {
    id: "heading-order",
    description: "Heading levels should only increase by one",
    wcagCriteria: ["1.3.1"],
    level: "A",
    category: "structure",
    severity: "moderate",
  },
  {
    id: "aria-valid",
    description: "ARIA attributes must be valid",
    wcagCriteria: ["4.1.2"],
    level: "A",
    category: "aria",
    severity: "critical",
  },
  {
    id: "focus-visible",
    description: "Focus must be visible",
    wcagCriteria: ["2.4.7"],
    level: "AA",
    category: "keyboard",
    severity: "serious",
  },
  {
    id: "skip-link",
    description: "Page should have skip navigation link",
    wcagCriteria: ["2.4.1"],
    level: "A",
    category: "keyboard",
    severity: "moderate",
  },
];

// =============================================================================
// ID Generation
// =============================================================================

let violationCounter = 0;

function generateViolationId(): string {
  violationCounter++;
  return `a11y-${Date.now()}-${violationCounter}`;
}

// =============================================================================
// Rule Utilities
// =============================================================================

/**
 * Gets rules for a WCAG level.
 */
export function getRulesForLevel(
  rules: AccessibilityRule[],
  level: WCAGLevel
): AccessibilityRule[] {
  const levels: WCAGLevel[] = ["A", "AA", "AAA"];
  const maxIndex = levels.indexOf(level);
  return rules.filter((r) => levels.indexOf(r.level) <= maxIndex);
}

/**
 * Gets rules by category.
 */
export function getRulesByCategory(
  rules: AccessibilityRule[],
  category: RuleCategory
): AccessibilityRule[] {
  return rules.filter((r) => r.category === category);
}

/**
 * Gets rules by severity.
 */
export function getRulesBySeverity(
  rules: AccessibilityRule[],
  severity: ViolationSeverity
): AccessibilityRule[] {
  return rules.filter((r) => r.severity === severity);
}

// =============================================================================
// Mock HTML Checker (for testing without DOM)
// =============================================================================

/**
 * Mock HTML accessibility checker.
 */
export function checkHtmlAccessibility(
  html: string,
  rules: AccessibilityRule[]
): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];

  // Check for images without alt
  const imgRule = rules.find((r) => r.id === "img-alt");
  if (imgRule) {
    const imgMatches = html.match(/<img[^>]*>/gi) || [];
    for (const img of imgMatches) {
      if (!img.includes("alt=")) {
        violations.push({
          id: generateViolationId(),
          rule: imgRule,
          selector: "img",
          html: img,
          message: "Image is missing alt attribute",
          suggestedFix: 'Add alt="" for decorative images or descriptive alt text',
          impact: "Screen readers cannot describe this image",
        });
      }
    }
  }

  // Check for buttons without text
  const buttonRule = rules.find((r) => r.id === "button-name");
  if (buttonRule) {
    const buttonMatches = html.match(/<button[^>]*>[\s]*<\/button>/gi) || [];
    for (const button of buttonMatches) {
      violations.push({
        id: generateViolationId(),
        rule: buttonRule,
        selector: "button",
        html: button,
        message: "Button has no discernible text",
        suggestedFix: "Add text content or aria-label to button",
        impact: "Screen readers cannot describe this button",
      });
    }
  }

  // Check for inputs without labels
  const formRule = rules.find((r) => r.id === "form-label");
  if (formRule) {
    const inputMatches = html.match(/<input[^>]*>/gi) || [];
    for (const input of inputMatches) {
      if (!input.includes("aria-label") && !input.includes("id=")) {
        violations.push({
          id: generateViolationId(),
          rule: formRule,
          selector: "input",
          html: input,
          message: "Form input is missing label",
          suggestedFix: "Add a <label> element or aria-label attribute",
          impact: "Users cannot understand what this input is for",
        });
      }
    }
  }

  // Check for html lang
  const langRule = rules.find((r) => r.id === "html-lang");
  if (langRule && html.includes("<html") && !html.includes('lang="')) {
    violations.push({
      id: generateViolationId(),
      rule: langRule,
      selector: "html",
      message: "HTML element is missing lang attribute",
      suggestedFix: 'Add lang="en" or appropriate language code',
      impact: "Screen readers may not use correct pronunciation",
    });
  }

  return violations;
}

// =============================================================================
// AccessibilityAuditor Class
// =============================================================================

/**
 * Audits content for accessibility violations.
 */
export class AccessibilityAuditor {
  private config: AuditorConfig;
  private rules: AccessibilityRule[];
  private validationHooks: ValidationHook[] = [];
  private fixFunction: FixFunction | null = null;

  constructor(config: Partial<AuditorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = [...BUILT_IN_RULES, ...this.config.customRules];
  }

  /**
   * Registers a validation hook.
   */
  onValidation(hook: ValidationHook): void {
    this.validationHooks.push(hook);
  }

  /**
   * Sets the fix function.
   */
  setFixFunction(fn: FixFunction): void {
    this.fixFunction = fn;
  }

  /**
   * Gets active rules based on config.
   */
  getActiveRules(): AccessibilityRule[] {
    let rules = getRulesForLevel(this.rules, this.config.wcagLevel);
    rules = rules.filter((r) => this.config.categories.includes(r.category));
    return rules;
  }

  /**
   * Audits HTML content.
   */
  audit(html: string): AuditResult {
    const startTime = Date.now();
    const activeRules = this.getActiveRules();

    const violations = checkHtmlAccessibility(html, activeRules);

    const bySeverity: Record<ViolationSeverity, AccessibilityViolation[]> = {
      critical: [],
      serious: [],
      moderate: [],
      minor: [],
    };

    for (const v of violations) {
      bySeverity[v.rule.severity].push(v);
    }

    const hasBlockingViolations = this.config.blockingSeverities.some(
      (severity) => bySeverity[severity].length > 0
    );

    const result: AuditResult = {
      passed: !hasBlockingViolations,
      violations,
      bySeverity,
      elementsChecked: (html.match(/<[a-z]/gi) || []).length,
      rulesApplied: activeRules.length,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
      wcagLevel: this.config.wcagLevel,
    };

    // Notify hooks
    for (const hook of this.validationHooks) {
      try {
        hook(result);
      } catch {
        // Ignore hook errors
      }
    }

    return result;
  }

  /**
   * Runs audit as part of validation phase.
   */
  runValidation(html: string): AuditResult {
    if (!this.config.runInValidation) {
      return {
        passed: true,
        violations: [],
        bySeverity: { critical: [], serious: [], moderate: [], minor: [] },
        elementsChecked: 0,
        rulesApplied: 0,
        duration: 0,
        timestamp: Date.now(),
        wcagLevel: this.config.wcagLevel,
      };
    }

    return this.audit(html);
  }

  /**
   * Triggers fix loop for violations.
   */
  async triggerFixLoop(violations: AccessibilityViolation[]): Promise<FixLoopResult> {
    const startTime = Date.now();
    const attempts: FixAttempt[] = [];
    let remaining = [...violations];

    if (!this.fixFunction || !this.config.autoFix) {
      return {
        initialViolations: violations.length,
        remainingViolations: violations.length,
        attempts: [],
        allFixed: false,
        duration: Date.now() - startTime,
      };
    }

    for (const violation of violations) {
      let attemptCount = 0;

      while (attemptCount < this.config.maxFixAttempts) {
        attemptCount++;

        try {
          const attempt = await this.fixFunction(violation);
          attempts.push(attempt);

          if (attempt.success) {
            remaining = remaining.filter((v) => v.id !== violation.id);
            break;
          }
        } catch (e) {
          attempts.push({
            violation,
            fixApplied: "",
            success: false,
            error: e instanceof Error ? e.message : String(e),
            timestamp: Date.now(),
          });
        }
      }
    }

    return {
      initialViolations: violations.length,
      remainingViolations: remaining.length,
      attempts,
      allFixed: remaining.length === 0,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Runs full validation with fix loop.
   */
  async validateAndFix(html: string): Promise<{
    audit: AuditResult;
    fixLoop?: FixLoopResult;
  }> {
    const audit = this.runValidation(html);

    if (!audit.passed && this.config.autoFix && this.fixFunction) {
      const blockingViolations = this.config.blockingSeverities.flatMap(
        (severity) => audit.bySeverity[severity]
      );

      const fixLoop = await this.triggerFixLoop(blockingViolations);
      return { audit, fixLoop };
    }

    return { audit };
  }

  /**
   * Gets violation summary.
   */
  getViolationSummary(result: AuditResult): string {
    const lines: string[] = [];

    lines.push(`Accessibility Audit: ${result.passed ? "PASSED" : "FAILED"}`);
    lines.push(`WCAG Level: ${result.wcagLevel}`);
    lines.push(`Elements checked: ${result.elementsChecked}`);
    lines.push(`Rules applied: ${result.rulesApplied}`);
    lines.push(`Duration: ${result.duration}ms`);

    if (result.violations.length > 0) {
      lines.push("");
      lines.push(`Violations (${result.violations.length}):`);
      lines.push(`  Critical: ${result.bySeverity.critical.length}`);
      lines.push(`  Serious: ${result.bySeverity.serious.length}`);
      lines.push(`  Moderate: ${result.bySeverity.moderate.length}`);
      lines.push(`  Minor: ${result.bySeverity.minor.length}`);
    }

    return lines.join("\n");
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<AuditorConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.customRules) {
      this.rules = [...BUILT_IN_RULES, ...this.config.customRules];
    }
  }

  /**
   * Gets current configuration.
   */
  getConfig(): AuditorConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates an AccessibilityAuditor instance.
 */
export function createAccessibilityAuditor(
  config?: Partial<AuditorConfig>
): AccessibilityAuditor {
  return new AccessibilityAuditor(config);
}

/**
 * Creates an auditor with fix function.
 */
export function createAuditorWithFixer(
  fixFn: FixFunction,
  config?: Partial<AuditorConfig>
): AccessibilityAuditor {
  const auditor = new AccessibilityAuditor(config);
  auditor.setFixFunction(fixFn);
  return auditor;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates a mock fix function for testing.
 */
export function createMockFixFunction(
  successOnAttempt: number = 1
): FixFunction {
  const attemptCounts = new Map<string, number>();

  return async (violation) => {
    const count = (attemptCounts.get(violation.id) ?? 0) + 1;
    attemptCounts.set(violation.id, count);

    const success = count >= successOnAttempt;

    return {
      violation,
      fixApplied: success ? `Fixed: ${violation.message}` : "",
      success,
      error: success ? undefined : `Attempt ${count} failed`,
      timestamp: Date.now(),
    };
  };
}

/**
 * Checks if audit result has blocking violations.
 */
export function hasBlockingViolations(
  result: AuditResult,
  blockingSeverities: ViolationSeverity[] = ["critical", "serious"]
): boolean {
  return blockingSeverities.some(
    (severity) => result.bySeverity[severity].length > 0
  );
}

/**
 * Gets blocking violations from audit result.
 */
export function getBlockingViolations(
  result: AuditResult,
  blockingSeverities: ViolationSeverity[] = ["critical", "serious"]
): AccessibilityViolation[] {
  return blockingSeverities.flatMap((severity) => result.bySeverity[severity]);
}

/**
 * Formats violation for display.
 */
export function formatViolation(violation: AccessibilityViolation): string {
  const lines: string[] = [];
  lines.push(`[${violation.rule.severity.toUpperCase()}] ${violation.message}`);
  lines.push(`  Rule: ${violation.rule.id} (${violation.rule.description})`);
  lines.push(`  Selector: ${violation.selector}`);
  if (violation.suggestedFix) {
    lines.push(`  Fix: ${violation.suggestedFix}`);
  }
  return lines.join("\n");
}

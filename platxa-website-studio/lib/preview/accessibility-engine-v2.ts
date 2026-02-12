/**
 * Accessibility Engine V2 - axe-core powered accessibility testing
 *
 * Replaces heuristic-based pattern matching with actual DOM analysis
 * using axe-core, the industry-standard accessibility testing library.
 *
 * Features:
 * - WCAG 2.1 Level A, AA, AAA compliance checking
 * - Real DOM analysis (not string pattern matching)
 * - Detailed violation reports with fix suggestions
 * - Impact severity classification
 * - Best practices checking
 *
 * Phase 2: Production-grade accessibility support
 */

// axe-core runtime interface - axe-core has inconsistent default/named exports
interface AxeRunnable {
  run(context: Document | Element, options?: Record<string, unknown>): Promise<AxeResults>;
}

// axe-core types - using inline definitions for better compatibility
interface AxeNodeResult {
  html: string;
  target: (string | string[])[];
  failureSummary?: string;
  any?: Array<{ message: string }>;
  all?: Array<{ message: string }>;
  none?: Array<{ message: string }>;
}

interface AxeResult {
  id: string;
  description: string;
  help: string;
  helpUrl: string;
  impact?: "critical" | "serious" | "moderate" | "minor";
  tags: string[];
  nodes: AxeNodeResult[];
}

interface AxeResults {
  violations: AxeResult[];
  passes: AxeResult[];
  incomplete: AxeResult[];
  inapplicable: AxeResult[];
}

// =============================================================================
// Types
// =============================================================================

/** WCAG conformance levels */
export type WCAGLevel = "A" | "AA" | "AAA";

/** Accessibility impact severity */
export type A11yImpact = "critical" | "serious" | "moderate" | "minor";

/** Accessibility issue category */
export type A11yCategory =
  | "aria"
  | "color"
  | "forms"
  | "keyboard"
  | "language"
  | "name-role-value"
  | "parsing"
  | "semantics"
  | "sensory-and-visual-cues"
  | "structure"
  | "tables"
  | "text-alternatives"
  | "time-and-media";

/** A single accessibility violation */
export interface A11yViolation {
  /** Unique rule ID */
  id: string;
  /** Human-readable description */
  description: string;
  /** Impact level */
  impact: A11yImpact;
  /** Help text explaining the issue */
  help: string;
  /** URL to more information */
  helpUrl: string;
  /** WCAG tags (e.g., "wcag2a", "wcag21aa") */
  tags: string[];
  /** Affected DOM nodes */
  nodes: A11yNode[];
  /** Category for grouping */
  category: A11yCategory;
}

/** A DOM node affected by a violation */
export interface A11yNode {
  /** HTML snippet of the element */
  html: string;
  /** CSS selector to locate the element */
  target: string[];
  /** Failure summary */
  failureSummary: string;
  /** Suggested fix */
  fix?: string;
}

/** Audit result summary */
export interface A11yAuditResult {
  /** Whether audit passed (no critical/serious violations) */
  passed: boolean;
  /** Overall accessibility score (0-100) */
  score: number;
  /** WCAG level achieved */
  wcagLevel: WCAGLevel | null;
  /** All violations found */
  violations: A11yViolation[];
  /** Passed rules */
  passes: number;
  /** Incomplete checks (need manual review) */
  incomplete: number;
  /** Inapplicable rules */
  inapplicable: number;
  /** Audit duration in ms */
  duration: number;
  /** Timestamp */
  timestamp: Date;
}

/** Audit options */
export interface A11yAuditOptions {
  /** WCAG level to test against (default: "AA") */
  wcagLevel?: WCAGLevel;
  /** Include best practices (default: true) */
  includeBestPractices?: boolean;
  /** Rules to skip */
  disableRules?: string[];
  /** Run only specific rules */
  enableRules?: string[];
  /** Element to scope the audit (default: document) */
  context?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Map axe-core impact to our impact type */
const IMPACT_MAP: Record<string, A11yImpact> = {
  critical: "critical",
  serious: "serious",
  moderate: "moderate",
  minor: "minor",
};

/** Category mapping from axe-core tags */
const CATEGORY_MAP: Record<string, A11yCategory> = {
  "cat.aria": "aria",
  "cat.color": "color",
  "cat.forms": "forms",
  "cat.keyboard": "keyboard",
  "cat.language": "language",
  "cat.name-role-value": "name-role-value",
  "cat.parsing": "parsing",
  "cat.semantics": "semantics",
  "cat.sensory-and-visual-cues": "sensory-and-visual-cues",
  "cat.structure": "structure",
  "cat.tables": "tables",
  "cat.text-alternatives": "text-alternatives",
  "cat.time-and-media": "time-and-media",
};

/** WCAG level tags */
const WCAG_LEVEL_TAGS: Record<WCAGLevel, string[]> = {
  A: ["wcag2a", "wcag21a"],
  AA: ["wcag2a", "wcag21a", "wcag2aa", "wcag21aa"],
  AAA: ["wcag2a", "wcag21a", "wcag2aa", "wcag21aa", "wcag2aaa", "wcag21aaa"],
};

// =============================================================================
// HTML to DOM Conversion (for server-side analysis)
// =============================================================================

/**
 * Creates a minimal DOM from HTML string for axe-core analysis
 * Used when running in Node.js environment
 */
function createDOMFromHTML(html: string): Document {
  // Check if we're in a browser environment
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  }

  // For Node.js, we need jsdom or similar
  // For now, throw an error indicating server-side isn't supported directly
  throw new Error(
    "Server-side DOM parsing requires jsdom. Use runA11yAuditInIframe for browser-based testing."
  );
}

// =============================================================================
// Violation Processing
// =============================================================================

/**
 * Convert axe-core result to our violation format
 */
function processViolation(result: AxeResult): A11yViolation {
  const category = detectCategory(result.tags);

  return {
    id: result.id,
    description: result.description,
    impact: IMPACT_MAP[result.impact ?? "minor"] ?? "minor",
    help: result.help,
    helpUrl: result.helpUrl,
    tags: result.tags,
    category,
    nodes: result.nodes.map(processNode),
  };
}

/**
 * Process a single node result
 */
function processNode(node: AxeNodeResult): A11yNode {
  return {
    html: node.html,
    target: node.target as string[],
    failureSummary: node.failureSummary ?? "",
    fix: generateFixSuggestion(node),
  };
}

/**
 * Detect category from axe-core tags
 */
function detectCategory(tags: string[]): A11yCategory {
  for (const tag of tags) {
    if (CATEGORY_MAP[tag]) {
      return CATEGORY_MAP[tag];
    }
  }
  return "semantics"; // Default category
}

/**
 * Generate a fix suggestion from node data
 */
function generateFixSuggestion(node: AxeNodeResult): string | undefined {
  // Extract fix from any/all/none arrays
  const suggestions: string[] = [];

  if (node.any && node.any.length > 0) {
    for (const check of node.any) {
      if (check.message) {
        suggestions.push(check.message);
      }
    }
  }

  if (node.all && node.all.length > 0) {
    for (const check of node.all) {
      if (check.message) {
        suggestions.push(check.message);
      }
    }
  }

  if (node.none && node.none.length > 0) {
    for (const check of node.none) {
      if (check.message) {
        suggestions.push(`Remove: ${check.message}`);
      }
    }
  }

  return suggestions.length > 0 ? suggestions.join("; ") : undefined;
}

// =============================================================================
// Score Calculation
// =============================================================================

/**
 * Calculate accessibility score based on violations
 */
function calculateScore(results: AxeResults): number {
  const totalRules = results.violations.length + results.passes.length;
  if (totalRules === 0) return 100;

  // Weight violations by impact
  let penaltyPoints = 0;
  for (const violation of results.violations) {
    const nodeCount = violation.nodes.length;
    switch (violation.impact) {
      case "critical":
        penaltyPoints += nodeCount * 25;
        break;
      case "serious":
        penaltyPoints += nodeCount * 15;
        break;
      case "moderate":
        penaltyPoints += nodeCount * 8;
        break;
      case "minor":
        penaltyPoints += nodeCount * 3;
        break;
    }
  }

  // Calculate score (capped at 0-100)
  const maxPenalty = 100;
  const score = Math.max(0, 100 - Math.min(penaltyPoints, maxPenalty));

  return Math.round(score);
}

/**
 * Determine achieved WCAG level
 */
function determineWCAGLevel(violations: A11yViolation[]): WCAGLevel | null {
  const hasLevelAViolation = violations.some((v) =>
    v.tags.some((t) => t === "wcag2a" || t === "wcag21a")
  );

  const hasLevelAAViolation = violations.some((v) =>
    v.tags.some((t) => t === "wcag2aa" || t === "wcag21aa")
  );

  const hasLevelAAAViolation = violations.some((v) =>
    v.tags.some((t) => t === "wcag2aaa" || t === "wcag21aaa")
  );

  if (hasLevelAViolation) return null;
  if (hasLevelAAViolation) return "A";
  if (hasLevelAAAViolation) return "AA";
  return "AAA";
}

// =============================================================================
// Main Audit Functions
// =============================================================================

/**
 * Run accessibility audit on HTML content in an iframe
 * This is the recommended approach for browser-based testing
 */
export async function runA11yAuditInIframe(
  iframe: HTMLIFrameElement,
  options: A11yAuditOptions = {}
): Promise<A11yAuditResult> {
  const startTime = Date.now();

  // Dynamically import axe-core
  const axeModule = await import("axe-core");
  const axe = ((axeModule as Record<string, unknown>).default || axeModule) as AxeRunnable;

  // Get iframe document
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    throw new Error("Cannot access iframe document");
  }

  // Configure axe-core
  const axeOptions = buildAxeOptions(options);

  // Run axe-core - axe.run returns a Promise<AxeResults>
  const context = options.context ? iframeDoc.querySelector(options.context) ?? iframeDoc : iframeDoc;
  const results: AxeResults = await axe.run(context, axeOptions);

  return processResults(results, startTime);
}

/**
 * Run accessibility audit on an HTML string
 * Creates a hidden iframe for testing
 */
export async function runA11yAudit(
  html: string,
  options: A11yAuditOptions = {}
): Promise<A11yAuditResult> {
  // Create hidden iframe
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;";
  document.body.appendChild(iframe);

  try {
    // Write HTML to iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("Cannot create iframe document");
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Wait for content to load
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Run audit
    return await runA11yAuditInIframe(iframe, options);
  } finally {
    // Cleanup
    document.body.removeChild(iframe);
  }
}

/**
 * Static analysis for server-side or quick checks
 * Less accurate than DOM-based testing but doesn't require a browser
 */
export function runStaticA11yAudit(
  html: string,
  options: A11yAuditOptions = {}
): A11yAuditResult {
  const startTime = Date.now();
  const violations: A11yViolation[] = [];

  // Run heuristic checks (fallback for server-side)
  violations.push(...checkImagesForAlt(html));
  violations.push(...checkFormsForLabels(html));
  violations.push(...checkLinksForText(html));
  violations.push(...checkHeadingStructure(html));
  violations.push(...checkColorContrast(html));
  violations.push(...checkAriaAttributes(html));
  violations.push(...checkLandmarks(html));
  violations.push(...checkTabindex(html));

  const score = Math.max(0, 100 - violations.length * 10);
  const wcagLevel = violations.length === 0 ? "AA" : violations.some(v => v.impact === "critical") ? null : "A";

  return {
    passed: violations.filter(v => v.impact === "critical" || v.impact === "serious").length === 0,
    score,
    wcagLevel,
    violations,
    passes: 0, // Static analysis doesn't track passes
    incomplete: 0,
    inapplicable: 0,
    duration: Date.now() - startTime,
    timestamp: new Date(),
  };
}

// =============================================================================
// Static Analysis Helpers (Fallback)
// =============================================================================

function checkImagesForAlt(html: string): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const imgRegex = /<img(?![^>]*alt=)[^>]*>/gi;
  const matches = html.match(imgRegex) || [];

  if (matches.length > 0) {
    violations.push({
      id: "image-alt",
      description: "Images must have alternate text",
      impact: "critical",
      help: "Ensure every image has an alt attribute",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.4/image-alt",
      tags: ["wcag2a", "wcag111", "cat.text-alternatives"],
      category: "text-alternatives",
      nodes: matches.map((html) => ({
        html,
        target: ["img"],
        failureSummary: "Image missing alt attribute",
        fix: "Add alt=\"description\" or alt=\"\" for decorative images",
      })),
    });
  }

  return violations;
}

function checkFormsForLabels(html: string): A11yViolation[] {
  const violations: A11yViolation[] = [];

  // Check for inputs without associated labels
  const inputRegex = /<input(?![^>]*(?:aria-label|aria-labelledby))[^>]*type=["'](?:text|email|password|tel|number|search)[^>]*>/gi;
  const matches = html.match(inputRegex) || [];

  // Filter out those that have id with matching label
  const inputsWithoutLabels = matches.filter((input) => {
    const idMatch = input.match(/id=["']([^"']+)["']/);
    if (!idMatch) return true;
    const labelRegex = new RegExp(`<label[^>]*for=["']${idMatch[1]}["']`, "i");
    return !labelRegex.test(html);
  });

  if (inputsWithoutLabels.length > 0) {
    violations.push({
      id: "label",
      description: "Form inputs must have labels",
      impact: "serious",
      help: "Ensure every form input has an associated label",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.4/label",
      tags: ["wcag2a", "wcag412", "cat.forms"],
      category: "forms",
      nodes: inputsWithoutLabels.map((html) => ({
        html,
        target: ["input"],
        failureSummary: "Input missing associated label",
        fix: "Add a <label for=\"inputId\"> or aria-label attribute",
      })),
    });
  }

  return violations;
}

function checkLinksForText(html: string): A11yViolation[] {
  const violations: A11yViolation[] = [];

  // Empty links or links with only whitespace/images
  const emptyLinkRegex = /<a[^>]*>(\s*(<img[^>]*>)?\s*)<\/a>/gi;
  const matches = html.match(emptyLinkRegex) || [];

  if (matches.length > 0) {
    violations.push({
      id: "link-name",
      description: "Links must have discernible text",
      impact: "serious",
      help: "Ensure links have text that describes the destination",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.4/link-name",
      tags: ["wcag2a", "wcag244", "cat.name-role-value"],
      category: "name-role-value",
      nodes: matches.map((html) => ({
        html,
        target: ["a"],
        failureSummary: "Link has no discernible text",
        fix: "Add text content or aria-label to the link",
      })),
    });
  }

  return violations;
}

function checkHeadingStructure(html: string): A11yViolation[] {
  const violations: A11yViolation[] = [];

  // Check for skipped heading levels
  const headingRegex = /<h([1-6])[^>]*>/gi;
  const headings: number[] = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    headings.push(parseInt(match[1], 10));
  }

  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i - 1] > 1) {
      violations.push({
        id: "heading-order",
        description: "Heading levels should not be skipped",
        impact: "moderate",
        help: "Ensure headings follow a logical order (h1 → h2 → h3)",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.4/heading-order",
        tags: ["wcag2a", "wcag131", "cat.semantics"],
        category: "semantics",
        nodes: [{
          html: `<h${headings[i]}>`,
          target: [`h${headings[i]}`],
          failureSummary: `Heading level skipped from h${headings[i - 1]} to h${headings[i]}`,
          fix: `Use h${headings[i - 1] + 1} instead of h${headings[i]}`,
        }],
      });
      break; // Report only first skip
    }
  }

  return violations;
}

function checkColorContrast(html: string): A11yViolation[] {
  const violations: A11yViolation[] = [];

  // Check for potentially low contrast colors in inline styles
  const lowContrastPatterns = [
    /color:\s*#(?:999|aaa|bbb|ccc|ddd|eee)/gi,
    /color:\s*(?:lightgray|lightgrey|silver)/gi,
    /color:\s*rgb\s*\(\s*(?:1[5-9]\d|2\d{2})\s*,\s*(?:1[5-9]\d|2\d{2})\s*,\s*(?:1[5-9]\d|2\d{2})\s*\)/gi,
  ];

  for (const pattern of lowContrastPatterns) {
    if (pattern.test(html)) {
      violations.push({
        id: "color-contrast",
        description: "Elements must have sufficient color contrast",
        impact: "serious",
        help: "Ensure text has at least 4.5:1 contrast ratio",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.4/color-contrast",
        tags: ["wcag2aa", "wcag143", "cat.color"],
        category: "color",
        nodes: [{
          html: "Inline style with potential low contrast",
          target: ["[style]"],
          failureSummary: "Low contrast color detected in inline styles",
          fix: "Use colors with at least 4.5:1 contrast ratio for normal text",
        }],
      });
      break;
    }
  }

  return violations;
}

function checkAriaAttributes(html: string): A11yViolation[] {
  const violations: A11yViolation[] = [];

  // Check for invalid ARIA attributes
  const invalidAriaPattern = /aria-(?!atomic|busy|controls|current|describedby|details|disabled|dropeffect|errormessage|expanded|flowto|grabbed|haspopup|hidden|invalid|keyshortcuts|label|labelledby|level|live|modal|multiline|multiselectable|orientation|owns|placeholder|posinset|pressed|readonly|relevant|required|roledescription|rowcount|rowindex|rowspan|selected|setsize|sort|valuemax|valuemin|valuenow|valuetext)[a-z]+/gi;

  const matches = html.match(invalidAriaPattern);
  if (matches && matches.length > 0) {
    violations.push({
      id: "aria-valid-attr",
      description: "ARIA attributes must be valid",
      impact: "critical",
      help: "Ensure ARIA attributes are spelled correctly",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.4/aria-valid-attr",
      tags: ["wcag2a", "wcag412", "cat.aria"],
      category: "aria",
      nodes: matches.map((attr) => ({
        html: `[${attr}]`,
        target: [`[${attr}]`],
        failureSummary: `Invalid ARIA attribute: ${attr}`,
        fix: "Check spelling or use a valid ARIA attribute",
      })),
    });
  }

  return violations;
}

function checkLandmarks(html: string): A11yViolation[] {
  const violations: A11yViolation[] = [];

  // Check for missing main landmark
  if (!/<main/i.test(html) && !/role=["']main["']/i.test(html)) {
    // Only warn if there's substantial content
    if (html.length > 500) {
      violations.push({
        id: "landmark-main-is-top-level",
        description: "Document should have a main landmark",
        impact: "moderate",
        help: "Use <main> element to identify the main content",
        helpUrl: "https://dequeuniversity.com/rules/axe/4.4/landmark-main-is-top-level",
        tags: ["wcag2a", "wcag131", "cat.semantics"],
        category: "semantics",
        nodes: [{
          html: "<body>",
          target: ["body"],
          failureSummary: "Page missing main landmark",
          fix: "Add <main> element around the main content",
        }],
      });
    }
  }

  return violations;
}

function checkTabindex(html: string): A11yViolation[] {
  const violations: A11yViolation[] = [];

  // Check for positive tabindex (bad practice)
  const positiveTabindexPattern = /tabindex=["']([1-9]\d*)["']/gi;
  const matches = [...html.matchAll(positiveTabindexPattern)];

  if (matches.length > 0) {
    violations.push({
      id: "tabindex",
      description: "Avoid positive tabindex values",
      impact: "serious",
      help: "Tabindex values greater than 0 disrupt natural tab order",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.4/tabindex",
      tags: ["wcag2a", "wcag243", "cat.keyboard"],
      category: "keyboard",
      nodes: matches.map((match) => ({
        html: `tabindex="${match[1]}"`,
        target: [`[tabindex="${match[1]}"]`],
        failureSummary: `Positive tabindex value: ${match[1]}`,
        fix: "Use tabindex=\"0\" or tabindex=\"-1\" instead",
      })),
    });
  }

  return violations;
}

// =============================================================================
// Axe Options Builder
// =============================================================================

function buildAxeOptions(options: A11yAuditOptions): Record<string, unknown> {
  const tags: string[] = [];

  // Add WCAG level tags
  if (options.wcagLevel) {
    tags.push(...WCAG_LEVEL_TAGS[options.wcagLevel]);
  } else {
    tags.push(...WCAG_LEVEL_TAGS.AA); // Default to AA
  }

  // Add best practices
  if (options.includeBestPractices !== false) {
    tags.push("best-practice");
  }

  const axeOptions: Record<string, unknown> = {
    runOnly: {
      type: "tag",
      values: tags,
    },
  };

  // Handle disabled rules
  if (options.disableRules && options.disableRules.length > 0) {
    axeOptions.rules = {};
    for (const rule of options.disableRules) {
      (axeOptions.rules as Record<string, unknown>)[rule] = { enabled: false };
    }
  }

  return axeOptions;
}

/**
 * Process axe-core results into our format
 */
function processResults(results: AxeResults, startTime: number): A11yAuditResult {
  const violations = results.violations.map(processViolation);
  const score = calculateScore(results);
  const wcagLevel = determineWCAGLevel(violations);

  const hasCritical = violations.some(v => v.impact === "critical" || v.impact === "serious");

  return {
    passed: !hasCritical,
    score,
    wcagLevel,
    violations,
    passes: results.passes.length,
    incomplete: results.incomplete.length,
    inapplicable: results.inapplicable.length,
    duration: Date.now() - startTime,
    timestamp: new Date(),
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format violation for display
 */
export function formatViolation(violation: A11yViolation): string {
  const impactEmoji = {
    critical: "🔴",
    serious: "🟠",
    moderate: "🟡",
    minor: "🔵",
  };

  const lines = [
    `${impactEmoji[violation.impact]} [${violation.impact.toUpperCase()}] ${violation.help}`,
    `   Rule: ${violation.id}`,
    `   WCAG: ${violation.tags.filter(t => t.startsWith("wcag")).join(", ")}`,
    `   Affected: ${violation.nodes.length} element(s)`,
  ];

  for (const node of violation.nodes.slice(0, 3)) {
    lines.push(`   - ${node.failureSummary}`);
    if (node.fix) {
      lines.push(`     Fix: ${node.fix}`);
    }
  }

  if (violation.nodes.length > 3) {
    lines.push(`   ... and ${violation.nodes.length - 3} more`);
  }

  return lines.join("\n");
}

/**
 * Format full audit result
 */
export function formatAuditResult(result: A11yAuditResult): string {
  const lines = [
    `Accessibility Audit Results`,
    `══════════════════════════`,
    `Score: ${result.score}/100`,
    `WCAG Level: ${result.wcagLevel ?? "Not compliant"}`,
    `Status: ${result.passed ? "✅ PASSED" : "❌ FAILED"}`,
    ``,
    `Summary:`,
    `  Violations: ${result.violations.length}`,
    `  Passes: ${result.passes}`,
    `  Needs Review: ${result.incomplete}`,
    `  Duration: ${result.duration}ms`,
    ``,
  ];

  if (result.violations.length > 0) {
    lines.push(`Violations:`);
    lines.push(`──────────`);
    for (const violation of result.violations) {
      lines.push(formatViolation(violation));
      lines.push(``);
    }
  }

  return lines.join("\n");
}

/**
 * Get violations by impact level
 */
export function getViolationsByImpact(
  violations: A11yViolation[],
  impact: A11yImpact
): A11yViolation[] {
  return violations.filter(v => v.impact === impact);
}

/**
 * Get violations by category
 */
export function getViolationsByCategory(
  violations: A11yViolation[],
  category: A11yCategory
): A11yViolation[] {
  return violations.filter(v => v.category === category);
}

// =============================================================================
// Exports
// =============================================================================

const accessibilityEngine = {
  runA11yAudit,
  runA11yAuditInIframe,
  runStaticA11yAudit,
  formatViolation,
  formatAuditResult,
  getViolationsByImpact,
  getViolationsByCategory,
};

export default accessibilityEngine;

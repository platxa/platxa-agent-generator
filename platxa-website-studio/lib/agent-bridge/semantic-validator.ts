/**
 * Semantic Validator — HTML Structure Quality Checks
 *
 * Validates heading hierarchy (h1-h6 with no skips), ARIA landmark roles
 * (banner, main, contentinfo, navigation), and nav structure.
 */

// =============================================================================
// Types
// =============================================================================

/** Severity of a semantic issue */
export type SemanticSeverity = "error" | "warning" | "info";

/** A single semantic validation issue */
export interface SemanticIssue {
  /** Rule that was violated */
  rule: string;
  /** Human-readable message */
  message: string;
  /** Severity */
  severity: SemanticSeverity;
  /** HTML element or context where issue was found */
  element: string;
  /** Line number estimate (1-based, or 0 if unknown) */
  line: number;
}

/** Result of semantic validation */
export interface SemanticValidationResult {
  /** Whether the HTML passes all checks */
  isValid: boolean;
  /** All issues found */
  issues: SemanticIssue[];
  /** Issues grouped by rule */
  byRule: Record<string, SemanticIssue[]>;
  /** Summary counts */
  counts: { errors: number; warnings: number; infos: number };
}

// =============================================================================
// Regex-based Tag Extraction
// =============================================================================

interface TagMatch {
  tag: string;
  attrs: string;
  line: number;
}

function extractTags(html: string, tagPattern: RegExp): TagMatch[] {
  const results: TagMatch[] = [];
  const lines = html.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    const re = new RegExp(tagPattern.source, tagPattern.flags.includes("g") ? tagPattern.flags : tagPattern.flags + "g");
    while ((match = re.exec(lines[i])) !== null) {
      results.push({ tag: match[1] || match[0], attrs: match[2] || "", line: i + 1 });
    }
  }
  return results;
}

// =============================================================================
// Heading Hierarchy Validation
// =============================================================================

function validateHeadings(html: string): SemanticIssue[] {
  const issues: SemanticIssue[] = [];
  const headingRe = /<(h[1-6])(\s[^>]*)?>/gi;
  const headings = extractTags(html, headingRe);

  if (headings.length === 0) {
    issues.push({
      rule: "heading-present",
      message: "No headings found — pages should have at least one heading for accessibility",
      severity: "warning",
      element: "document",
      line: 0,
    });
    return issues;
  }

  // Check h1 presence
  const h1s = headings.filter((h) => h.tag.toLowerCase() === "h1");
  if (h1s.length === 0) {
    issues.push({
      rule: "h1-present",
      message: "No <h1> found — each page should have exactly one <h1>",
      severity: "error",
      element: "document",
      line: 0,
    });
  } else if (h1s.length > 1) {
    issues.push({
      rule: "h1-unique",
      message: `Multiple <h1> elements found (${h1s.length}) — use only one per page`,
      severity: "warning",
      element: "h1",
      line: h1s[1].line,
    });
  }

  // Check hierarchy — no skips (e.g., h2 → h4 skips h3)
  let prevLevel = 0;
  for (const h of headings) {
    const level = parseInt(h.tag.charAt(1), 10);
    if (prevLevel > 0 && level > prevLevel + 1) {
      issues.push({
        rule: "heading-order",
        message: `Heading level skipped: <h${prevLevel}> to <${h.tag}> — expected <h${prevLevel + 1}>`,
        severity: "error",
        element: h.tag,
        line: h.line,
      });
    }
    prevLevel = level;
  }

  // First heading should be h1 (or at minimum h2)
  const firstLevel = parseInt(headings[0].tag.charAt(1), 10);
  if (firstLevel > 2) {
    issues.push({
      rule: "heading-start",
      message: `First heading is <${headings[0].tag}> — page should start with <h1> or <h2>`,
      severity: "warning",
      element: headings[0].tag,
      line: headings[0].line,
    });
  }

  return issues;
}

// =============================================================================
// ARIA Landmark Validation
// =============================================================================

function validateLandmarks(html: string): SemanticIssue[] {
  const issues: SemanticIssue[] = [];

  // Check for <main> or role="main"
  const hasMain = /<main[\s>]/i.test(html) || /role\s*=\s*["']main["']/i.test(html);
  if (!hasMain) {
    issues.push({
      rule: "landmark-main",
      message: "No <main> element or role=\"main\" found — pages should have a main landmark",
      severity: "error",
      element: "document",
      line: 0,
    });
  }

  // Check for <header> or role="banner"
  const hasBanner = /<header[\s>]/i.test(html) || /role\s*=\s*["']banner["']/i.test(html);
  if (!hasBanner) {
    issues.push({
      rule: "landmark-banner",
      message: "No <header> element or role=\"banner\" found",
      severity: "warning",
      element: "document",
      line: 0,
    });
  }

  // Check for <footer> or role="contentinfo"
  const hasContentinfo = /<footer[\s>]/i.test(html) || /role\s*=\s*["']contentinfo["']/i.test(html);
  if (!hasContentinfo) {
    issues.push({
      rule: "landmark-contentinfo",
      message: "No <footer> element or role=\"contentinfo\" found",
      severity: "warning",
      element: "document",
      line: 0,
    });
  }

  // Multiple <main> elements
  const mainCount = (html.match(/<main[\s>]/gi) || []).length;
  if (mainCount > 1) {
    issues.push({
      rule: "landmark-main-unique",
      message: `Multiple <main> elements found (${mainCount}) — use only one per page`,
      severity: "error",
      element: "main",
      line: 0,
    });
  }

  return issues;
}

// =============================================================================
// Navigation Validation
// =============================================================================

function validateNavigation(html: string): SemanticIssue[] {
  const issues: SemanticIssue[] = [];

  // Check <nav> elements have aria-label when multiple exist
  const navMatches = html.match(/<nav(\s[^>]*)?\s*>/gi) || [];
  if (navMatches.length > 1) {
    let unlabeled = 0;
    for (const nav of navMatches) {
      if (!/aria-label\s*=/i.test(nav) && !/aria-labelledby\s*=/i.test(nav)) {
        unlabeled++;
      }
    }
    if (unlabeled > 0) {
      issues.push({
        rule: "nav-label",
        message: `${unlabeled} of ${navMatches.length} <nav> elements lack aria-label — label them to distinguish navigation regions`,
        severity: "warning",
        element: "nav",
        line: 0,
      });
    }
  }

  // Check that nav contains links or list of links
  const navBlockRe = /<nav[^>]*>([\s\S]*?)<\/nav>/gi;
  let navBlock: RegExpExecArray | null;
  while ((navBlock = navBlockRe.exec(html)) !== null) {
    const content = navBlock[1];
    const hasLinks = /<a\s/i.test(content);
    if (!hasLinks) {
      issues.push({
        rule: "nav-links",
        message: "A <nav> element contains no links — navigation should contain anchor elements",
        severity: "info",
        element: "nav",
        line: 0,
      });
    }
  }

  return issues;
}

// =============================================================================
// Additional Semantic Checks
// =============================================================================

function validateSemanticElements(html: string): SemanticIssue[] {
  const issues: SemanticIssue[] = [];

  // Check images have alt attributes
  const imgRe = /<img(\s[^>]*)?\s*\/?>/gi;
  let imgMatch: RegExpExecArray | null;
  let imgsWithoutAlt = 0;
  while ((imgMatch = imgRe.exec(html)) !== null) {
    if (!/alt\s*=/i.test(imgMatch[0])) {
      imgsWithoutAlt++;
    }
  }
  if (imgsWithoutAlt > 0) {
    issues.push({
      rule: "img-alt",
      message: `${imgsWithoutAlt} <img> element(s) missing alt attribute`,
      severity: "error",
      element: "img",
      line: 0,
    });
  }

  // Check buttons have accessible text
  const buttonRe = /<button(\s[^>]*)?\s*>([\s\S]*?)<\/button>/gi;
  let btnMatch: RegExpExecArray | null;
  while ((btnMatch = buttonRe.exec(html)) !== null) {
    const content = btnMatch[2].trim();
    const hasAriaLabel = /aria-label\s*=/i.test(btnMatch[1] || "");
    if (!content && !hasAriaLabel) {
      issues.push({
        rule: "button-text",
        message: "A <button> has no visible text or aria-label",
        severity: "error",
        element: "button",
        line: 0,
      });
    }
  }

  return issues;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Validates HTML for semantic structure including heading hierarchy,
 * ARIA landmarks, navigation, and basic accessibility checks.
 */
export function validateSemantics(html: string): SemanticValidationResult {
  const issues: SemanticIssue[] = [
    ...validateHeadings(html),
    ...validateLandmarks(html),
    ...validateNavigation(html),
    ...validateSemanticElements(html),
  ];

  const byRule: Record<string, SemanticIssue[]> = {};
  for (const issue of issues) {
    if (!byRule[issue.rule]) byRule[issue.rule] = [];
    byRule[issue.rule].push(issue);
  }

  const counts = {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    infos: issues.filter((i) => i.severity === "info").length,
  };

  return {
    isValid: counts.errors === 0,
    issues,
    byRule,
    counts,
  };
}

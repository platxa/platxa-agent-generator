/**
 * Keyboard Navigation Validator
 *
 * Validates that interactive HTML snippets support keyboard navigation:
 * - Natively focusable elements (button, a, input, select, textarea)
 * - Custom interactive elements need tabindex
 * - onclick handlers without keyboard equivalents
 * - Focus style coverage in CSS
 * - Positive tabindex anti-pattern detection
 */

// =============================================================================
// Types
// =============================================================================

export type KbNavRule =
  | "onclick-no-keyboard"
  | "div-interactive-no-tabindex"
  | "positive-tabindex"
  | "missing-focus-styles"
  | "missing-keyboard-handler"
  | "tabindex-no-role";

export type KbNavSeverity = "error" | "warning" | "info";

export interface KbNavIssue {
  rule: KbNavRule;
  message: string;
  severity: KbNavSeverity;
  element: string;
  line: number;
  wcag: string;
}

export interface KbNavResult {
  isNavigable: boolean;
  issues: KbNavIssue[];
  counts: {
    nativeInteractive: number;
    customInteractive: number;
    totalIssues: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

/** Elements that are natively keyboard-focusable */
const NATIVE_FOCUSABLE = new Set(["a", "button", "input", "select", "textarea", "details", "summary"]);

/** Non-interactive elements that sometimes get onclick handlers */
const NON_INTERACTIVE_TAGS = new Set(["div", "span", "li", "p", "section", "article", "img", "td", "tr"]);

// =============================================================================
// Validation Functions
// =============================================================================

interface LineTag {
  fullMatch: string;
  tag: string;
  attrs: string;
  line: number;
}

function extractOpenTags(html: string): LineTag[] {
  const results: LineTag[] = [];
  const lines = html.split("\n");
  const re = /<([a-zA-Z][\w-]*)(\s[^>]*)?\s*\/?>/g;
  for (let i = 0; i < lines.length; i++) {
    let m: RegExpExecArray | null;
    const lineRe = new RegExp(re.source, re.flags);
    while ((m = lineRe.exec(lines[i])) !== null) {
      results.push({
        fullMatch: m[0],
        tag: m[1].toLowerCase(),
        attrs: m[2] || "",
        line: i + 1,
      });
    }
  }
  return results;
}

function hasAttr(attrs: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*=`, "i").test(attrs);
}

function getAttrValue(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : null;
}

/**
 * Check: onclick on non-interactive elements without keyboard handler
 */
function checkOnclickWithoutKeyboard(tags: LineTag[]): KbNavIssue[] {
  const issues: KbNavIssue[] = [];
  for (const t of tags) {
    if (!NON_INTERACTIVE_TAGS.has(t.tag)) continue;
    if (!hasAttr(t.attrs, "onclick")) continue;

    const hasKeyHandler = hasAttr(t.attrs, "onkeydown") || hasAttr(t.attrs, "onkeyup") || hasAttr(t.attrs, "onkeypress");
    if (!hasKeyHandler) {
      issues.push({
        rule: "onclick-no-keyboard",
        message: `<${t.tag}> has onclick but no keyboard event handler — add onkeydown for keyboard users`,
        severity: "error",
        element: t.fullMatch.substring(0, 80),
        line: t.line,
        wcag: "2.1.1",
      });
    }
  }
  return issues;
}

/**
 * Check: non-interactive elements with click handlers but no tabindex
 */
function checkCustomInteractive(tags: LineTag[]): KbNavIssue[] {
  const issues: KbNavIssue[] = [];
  for (const t of tags) {
    if (!NON_INTERACTIVE_TAGS.has(t.tag)) continue;
    if (!hasAttr(t.attrs, "onclick")) continue;

    if (!hasAttr(t.attrs, "tabindex")) {
      issues.push({
        rule: "div-interactive-no-tabindex",
        message: `<${t.tag}> has onclick but no tabindex — add tabindex="0" so it can receive keyboard focus`,
        severity: "error",
        element: t.fullMatch.substring(0, 80),
        line: t.line,
        wcag: "2.1.1",
      });
    }
  }
  return issues;
}

/**
 * Check: positive tabindex values (anti-pattern)
 */
function checkPositiveTabindex(tags: LineTag[]): KbNavIssue[] {
  const issues: KbNavIssue[] = [];
  for (const t of tags) {
    if (!hasAttr(t.attrs, "tabindex")) continue;
    const val = getAttrValue(t.attrs, "tabindex");
    if (val !== null) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) {
        issues.push({
          rule: "positive-tabindex",
          message: `tabindex="${num}" creates unpredictable tab order — use tabindex="0" or restructure DOM order`,
          severity: "warning",
          element: t.fullMatch.substring(0, 80),
          line: t.line,
          wcag: "2.4.3",
        });
      }
    }
  }
  return issues;
}

/**
 * Check: tabindex on non-interactive elements without role
 */
function checkTabindexWithoutRole(tags: LineTag[]): KbNavIssue[] {
  const issues: KbNavIssue[] = [];
  for (const t of tags) {
    if (NATIVE_FOCUSABLE.has(t.tag)) continue;
    if (!hasAttr(t.attrs, "tabindex")) continue;
    const val = getAttrValue(t.attrs, "tabindex");
    if (val === "-1") continue; // tabindex="-1" is fine without role

    if (!hasAttr(t.attrs, "role")) {
      issues.push({
        rule: "tabindex-no-role",
        message: `<${t.tag}> has tabindex but no role — add role="button" or appropriate ARIA role`,
        severity: "warning",
        element: t.fullMatch.substring(0, 80),
        line: t.line,
        wcag: "4.1.2",
      });
    }
  }
  return issues;
}

/**
 * Check: CSS for focus styles
 */
function checkFocusStyles(css: string): KbNavIssue[] {
  const issues: KbNavIssue[] = [];
  if (!css) return issues;

  // Check for outline:none or outline:0 without a replacement focus style
  const hasOutlineNone = /outline\s*:\s*(none|0)\b/i.test(css);
  const hasFocusVisible = /:focus-visible/i.test(css);
  const hasFocusStyles = /:focus\b/i.test(css);

  if (hasOutlineNone && !hasFocusVisible && !hasFocusStyles) {
    issues.push({
      rule: "missing-focus-styles",
      message: "outline:none/0 found without :focus or :focus-visible styles — keyboard users lose focus indication",
      severity: "error",
      element: "css",
      line: 0,
      wcag: "2.4.7",
    });
  }

  return issues;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Validates HTML (and optionally CSS) for keyboard navigation support.
 */
export function validateKeyboardNav(html: string, css?: string): KbNavResult {
  const tags = extractOpenTags(html);
  const issues: KbNavIssue[] = [
    ...checkOnclickWithoutKeyboard(tags),
    ...checkCustomInteractive(tags),
    ...checkPositiveTabindex(tags),
    ...checkTabindexWithoutRole(tags),
    ...checkFocusStyles(css || ""),
  ];

  const nativeInteractive = tags.filter((t) => NATIVE_FOCUSABLE.has(t.tag)).length;
  const customInteractive = tags.filter((t) => NON_INTERACTIVE_TAGS.has(t.tag) && hasAttr(t.attrs, "onclick")).length;

  return {
    isNavigable: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    counts: {
      nativeInteractive,
      customInteractive,
      totalIssues: issues.length,
    },
  };
}

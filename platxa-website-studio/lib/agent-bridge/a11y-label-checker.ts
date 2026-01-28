/**
 * Accessibility Label Checker
 *
 * Validates that all images have alt attributes and all interactive
 * elements (buttons, links, inputs, selects, textareas) have accessible
 * labels via aria-label, aria-labelledby, title, or visible text content.
 */

// =============================================================================
// Types
// =============================================================================

/** Type of accessibility issue */
export type A11yIssueType =
  | "img-alt-missing"
  | "img-alt-empty"
  | "button-label-missing"
  | "link-label-missing"
  | "input-label-missing"
  | "select-label-missing"
  | "textarea-label-missing";

/** A single accessibility issue */
export interface A11yIssue {
  /** Issue type */
  type: A11yIssueType;
  /** Human-readable message */
  message: string;
  /** The HTML snippet that triggered the issue */
  element: string;
  /** Line number (1-based) */
  line: number;
  /** Severity */
  severity: "error" | "warning";
  /** WCAG criterion reference */
  wcag: string;
}

/** Result of the accessibility label check */
export interface A11yLabelResult {
  /** Whether all checks pass */
  isAccessible: boolean;
  /** All issues found */
  issues: A11yIssue[];
  /** Summary counts */
  counts: {
    images: number;
    imagesWithAlt: number;
    interactiveElements: number;
    labeledElements: number;
  };
}

// =============================================================================
// Helpers
// =============================================================================

function hasAttr(tag: string, attr: string): boolean {
  return new RegExp(`\\b${attr}\\s*=`, "i").test(tag);
}

function getAttrValue(tag: string, attr: string): string | null {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? match[1] : null;
}

function getInnerText(fullMatch: string, innerContent: string): string {
  // Strip nested tags and get text content
  return innerContent.replace(/<[^>]*>/g, "").trim();
}

interface TagOccurrence {
  fullMatch: string;
  openTag: string;
  innerContent: string;
  line: number;
}

function findSelfClosingTags(html: string, tagName: string): TagOccurrence[] {
  const results: TagOccurrence[] = [];
  const re = new RegExp(`<${tagName}(\\s[^>]*)?\\/?>`, "gi");
  const lines = html.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let match: RegExpExecArray | null;
    const lineRe = new RegExp(re.source, re.flags);
    while ((match = lineRe.exec(lines[i])) !== null) {
      results.push({ fullMatch: match[0], openTag: match[0], innerContent: "", line: i + 1 });
    }
  }
  return results;
}

function findPairedTags(html: string, tagName: string): TagOccurrence[] {
  const results: TagOccurrence[] = [];
  const re = new RegExp(`<${tagName}(\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const beforeMatch = html.substring(0, match.index);
    const line = beforeMatch.split("\n").length;
    const openTag = match[0].substring(0, match[0].indexOf(">") + 1);
    results.push({
      fullMatch: match[0],
      openTag,
      innerContent: match[2] || "",
      line,
    });
  }
  return results;
}

// =============================================================================
// Checkers
// =============================================================================

function checkImages(html: string): { issues: A11yIssue[]; total: number; withAlt: number } {
  const issues: A11yIssue[] = [];
  const imgs = findSelfClosingTags(html, "img");
  let withAlt = 0;

  for (const img of imgs) {
    if (!hasAttr(img.openTag, "alt")) {
      issues.push({
        type: "img-alt-missing",
        message: "Image missing alt attribute",
        element: img.fullMatch.substring(0, 80),
        line: img.line,
        severity: "error",
        wcag: "1.1.1",
      });
    } else {
      const val = getAttrValue(img.openTag, "alt");
      if (val !== null && val === "" && !hasAttr(img.openTag, "role")) {
        // Empty alt is valid for decorative images (role="presentation")
        // but warn if no role is set
        issues.push({
          type: "img-alt-empty",
          message: "Image has empty alt — add role=\"presentation\" if decorative, otherwise provide alt text",
          element: img.fullMatch.substring(0, 80),
          line: img.line,
          severity: "warning",
          wcag: "1.1.1",
        });
      }
      withAlt++;
    }
  }

  return { issues, total: imgs.length, withAlt };
}

// Tags whose inner text content counts as an accessible label (e.g. <button>OK</button>).
// For <select> and <textarea>, inner content is data, not a label.
const TEXT_IS_LABEL_TAGS = new Set(["button", "a"]);

function checkInteractive(
  html: string,
  tagName: string,
  issueType: A11yIssueType,
  isPaired: boolean,
): { issues: A11yIssue[]; total: number; labeled: number } {
  const issues: A11yIssue[] = [];
  const elements = isPaired ? findPairedTags(html, tagName) : findSelfClosingTags(html, tagName);
  let labeled = 0;

  for (const el of elements) {
    const hasAriaLabel = hasAttr(el.openTag, "aria-label");
    const hasAriaLabelledby = hasAttr(el.openTag, "aria-labelledby");
    const hasTitle = hasAttr(el.openTag, "title");
    const visibleText = isPaired ? getInnerText(el.fullMatch, el.innerContent) : "";

    // For inputs, also check for associated label via id
    const hasPlaceholder = hasAttr(el.openTag, "placeholder");
    const inputType = getAttrValue(el.openTag, "type");
    const isHidden = inputType === "hidden";

    if (isHidden) {
      labeled++;
      continue;
    }

    const textCountsAsLabel = isPaired && TEXT_IS_LABEL_TAGS.has(tagName) && visibleText.length > 0;
    const isLabeled = hasAriaLabel || hasAriaLabelledby || hasTitle ||
      textCountsAsLabel ||
      (tagName === "input" && hasPlaceholder);

    if (isLabeled) {
      labeled++;
    } else {
      issues.push({
        type: issueType,
        message: `<${tagName}> element has no accessible label — add aria-label, aria-labelledby, or visible text`,
        element: el.fullMatch.substring(0, 80),
        line: el.line,
        severity: "error",
        wcag: "4.1.2",
      });
    }
  }

  return { issues, total: elements.length, labeled };
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Checks all images and interactive elements for accessible labels.
 */
export function checkA11yLabels(html: string): A11yLabelResult {
  const imgResult = checkImages(html);

  const btnResult = checkInteractive(html, "button", "button-label-missing", true);
  const linkResult = checkInteractive(html, "a", "link-label-missing", true);
  const inputResult = checkInteractive(html, "input", "input-label-missing", false);
  const selectResult = checkInteractive(html, "select", "select-label-missing", true);
  const textareaResult = checkInteractive(html, "textarea", "textarea-label-missing", true);

  const allIssues = [
    ...imgResult.issues,
    ...btnResult.issues,
    ...linkResult.issues,
    ...inputResult.issues,
    ...selectResult.issues,
    ...textareaResult.issues,
  ];

  const interactiveTotal = btnResult.total + linkResult.total + inputResult.total +
    selectResult.total + textareaResult.total;
  const interactiveLabeled = btnResult.labeled + linkResult.labeled + inputResult.labeled +
    selectResult.labeled + textareaResult.labeled;

  return {
    isAccessible: allIssues.filter((i) => i.severity === "error").length === 0,
    issues: allIssues,
    counts: {
      images: imgResult.total,
      imagesWithAlt: imgResult.withAlt,
      interactiveElements: interactiveTotal,
      labeledElements: interactiveLabeled,
    },
  };
}

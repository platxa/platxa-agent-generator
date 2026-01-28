/**
 * CSS Specificity Analyzer
 *
 * Parses CSS/SCSS selectors to compute specificity (a, b, c) values,
 * flags overly complex selectors (>0,3,0), and warns on deep nesting (>3).
 */

// =============================================================================
// Types
// =============================================================================

/** CSS specificity tuple: [id, class, element] */
export type Specificity = [number, number, number];

/** A single specificity issue */
export interface SpecificityIssue {
  /** The selector text */
  selector: string;
  /** Computed specificity */
  specificity: Specificity;
  /** Rule violated */
  rule: string;
  /** Human-readable message */
  message: string;
  /** Severity */
  severity: "warning" | "error";
  /** Line number (1-based, 0 if unknown) */
  line: number;
}

/** Result of specificity analysis */
export interface SpecificityResult {
  /** All selectors analyzed */
  selectors: Array<{ selector: string; specificity: Specificity; line: number }>;
  /** Issues found */
  issues: SpecificityIssue[];
  /** Whether all selectors pass */
  isClean: boolean;
  /** Max specificity found */
  maxSpecificity: Specificity;
}

/** Thresholds for flagging */
export interface SpecificityThresholds {
  /** Max class-level specificity (b) before flagging. Default: 3 */
  maxClassSpecificity: number;
  /** Max nesting depth before warning. Default: 3 */
  maxNestingDepth: number;
  /** Max ID selectors before flagging. Default: 0 */
  maxIdSpecificity: number;
}

export const DEFAULT_THRESHOLDS: SpecificityThresholds = {
  maxClassSpecificity: 3,
  maxNestingDepth: 3,
  maxIdSpecificity: 0,
};

// =============================================================================
// Specificity Calculation
// =============================================================================

/**
 * Calculates CSS specificity for a single selector string.
 * Returns [id, class, element] counts.
 */
export function calculateSpecificity(selector: string): Specificity {
  let ids = 0;
  let classes = 0;
  let elements = 0;

  // Work on a cleaned copy
  let s = selector.trim();

  // Remove :not() wrapper but count its contents
  s = s.replace(/:not\(([^)]*)\)/g, (_, inner) => {
    const innerSpec = calculateSpecificity(inner);
    ids += innerSpec[0];
    classes += innerSpec[1];
    elements += innerSpec[2];
    return "";
  });

  // Remove attribute selectors and count as class-level
  s = s.replace(/\[[^\]]*\]/g, () => {
    classes++;
    return "";
  });

  // Count ID selectors (#foo)
  s = s.replace(/#[a-zA-Z_][\w-]*/g, () => {
    ids++;
    return "";
  });

  // Count pseudo-elements (::before, ::after, ::placeholder) as element-level
  s = s.replace(/::[a-zA-Z-]+/g, () => {
    elements++;
    return "";
  });

  // Count pseudo-classes (:hover, :focus, :nth-child(...)) as class-level
  s = s.replace(/:[a-zA-Z-]+(\([^)]*\))?/g, () => {
    classes++;
    return "";
  });

  // Count class selectors (.foo)
  s = s.replace(/\.[a-zA-Z_][\w-]*/g, () => {
    classes++;
    return "";
  });

  // Count element selectors (div, span, h1) — remaining word tokens
  // Exclude combinators and universal selector
  const remaining = s.replace(/[>+~*\s]+/g, " ").trim();
  if (remaining) {
    const tags = remaining.split(/\s+/).filter((t) => /^[a-zA-Z][\w-]*$/.test(t));
    elements += tags.length;
  }

  return [ids, classes, elements];
}

/**
 * Compares two specificity values. Returns >0 if a > b, <0 if a < b, 0 if equal.
 */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

/**
 * Formats specificity as string "(a,b,c)".
 */
export function formatSpecificity(s: Specificity): string {
  return `(${s[0]},${s[1]},${s[2]})`;
}

// =============================================================================
// SCSS Nesting Depth
// =============================================================================

/**
 * Calculates the maximum nesting depth in SCSS/CSS content.
 */
export function maxNestingDepth(scss: string): number {
  let max = 0;
  let current = 0;
  for (const ch of scss) {
    if (ch === "{") {
      current++;
      if (current > max) max = current;
    } else if (ch === "}") {
      current = Math.max(0, current - 1);
    }
  }
  return max;
}

// =============================================================================
// Selector Extraction
// =============================================================================

interface ExtractedSelector {
  selector: string;
  line: number;
}

/**
 * Extracts top-level CSS selectors from CSS/SCSS text.
 */
function extractSelectors(css: string): ExtractedSelector[] {
  const results: ExtractedSelector[] = [];
  const lines = css.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip comments, empty lines, at-rules, closing braces, properties
    if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")
      || line.startsWith("@") || line === "}" || line.includes(":") && !line.includes("{")
      && !line.startsWith(".") && !line.startsWith("#") && !line.startsWith("&")) {
      // Check if line has a selector followed by {
      if (line.includes("{")) {
        const sel = line.split("{")[0].trim();
        if (sel && !sel.startsWith("@") && !sel.startsWith("//")) {
          // May be multiple selectors separated by comma
          for (const s of sel.split(",")) {
            const trimmed = s.trim();
            if (trimmed) results.push({ selector: trimmed, line: i + 1 });
          }
        }
      }
      continue;
    }

    if (line.includes("{")) {
      const sel = line.split("{")[0].trim();
      if (sel) {
        for (const s of sel.split(",")) {
          const trimmed = s.trim();
          if (trimmed) results.push({ selector: trimmed, line: i + 1 });
        }
      }
    }
  }

  return results;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Analyzes CSS/SCSS for specificity issues.
 */
export function analyzeSpecificity(
  css: string,
  thresholds: Partial<SpecificityThresholds> = {},
): SpecificityResult {
  const t: SpecificityThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const extracted = extractSelectors(css);
  const issues: SpecificityIssue[] = [];
  let maxSpec: Specificity = [0, 0, 0];

  const selectors = extracted.map(({ selector, line }) => {
    const specificity = calculateSpecificity(selector);
    if (compareSpecificity(specificity, maxSpec) > 0) maxSpec = specificity;
    return { selector, specificity, line };
  });

  // Check each selector against thresholds
  for (const { selector, specificity, line } of selectors) {
    if (specificity[0] > t.maxIdSpecificity) {
      issues.push({
        selector,
        specificity,
        rule: "no-id-selectors",
        message: `Selector uses ${specificity[0]} ID selector(s) — prefer class selectors for maintainability`,
        severity: "warning",
        line,
      });
    }

    if (specificity[1] > t.maxClassSpecificity) {
      issues.push({
        selector,
        specificity,
        rule: "max-class-specificity",
        message: `Selector specificity ${formatSpecificity(specificity)} exceeds threshold (0,${t.maxClassSpecificity},0)`,
        severity: "error",
        line,
      });
    }
  }

  // Check nesting depth
  const depth = maxNestingDepth(css);
  if (depth > t.maxNestingDepth) {
    issues.push({
      selector: "(nesting)",
      specificity: [0, 0, 0],
      rule: "max-nesting-depth",
      message: `Nesting depth ${depth} exceeds maximum ${t.maxNestingDepth} — flatten selectors for readability`,
      severity: "warning",
      line: 0,
    });
  }

  return {
    selectors,
    issues,
    isClean: issues.length === 0,
    maxSpecificity: maxSpec,
  };
}

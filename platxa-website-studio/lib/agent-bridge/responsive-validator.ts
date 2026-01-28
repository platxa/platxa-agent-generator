/**
 * Responsive Layout Validator
 *
 * Static analysis of HTML and CSS to detect patterns that cause
 * horizontal overflow on mobile viewports (375px, 768px, 1024px).
 * Checks for fixed widths, missing viewport meta, overflow-prone patterns.
 */

// =============================================================================
// Types
// =============================================================================

export interface Viewport {
  name: string;
  width: number;
}

export const DEFAULT_VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 375 },
  { name: "tablet", width: 768 },
  { name: "desktop", width: 1024 },
];

export type ResponsiveRule =
  | "fixed-width-overflow"
  | "no-viewport-meta"
  | "missing-responsive-meta"
  | "no-media-queries"
  | "fixed-position-width"
  | "horizontal-scroll-element"
  | "table-no-responsive"
  | "image-no-max-width";

export type ResponsiveSeverity = "error" | "warning" | "info";

export interface ResponsiveIssue {
  rule: ResponsiveRule;
  message: string;
  severity: ResponsiveSeverity;
  viewport: string;
  element: string;
  line: number;
}

export interface ResponsiveResult {
  isResponsive: boolean;
  issues: ResponsiveIssue[];
  viewportsChecked: string[];
  counts: { errors: number; warnings: number };
}

// =============================================================================
// HTML Checks
// =============================================================================

function checkViewportMeta(html: string): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];

  const hasViewportMeta = /<meta\s[^>]*name\s*=\s*["']viewport["'][^>]*>/i.test(html);
  if (!hasViewportMeta) {
    issues.push({
      rule: "no-viewport-meta",
      message: "No <meta name=\"viewport\"> found — mobile browsers won't scale correctly",
      severity: "error",
      viewport: "all",
      element: "head",
      line: 0,
    });
    return issues;
  }

  // Check viewport content includes width=device-width
  const metaMatch = html.match(/<meta\s[^>]*name\s*=\s*["']viewport["'][^>]*content\s*=\s*["']([^"']*)["']/i);
  if (metaMatch) {
    const content = metaMatch[1];
    if (!content.includes("width=device-width")) {
      issues.push({
        rule: "missing-responsive-meta",
        message: "Viewport meta missing width=device-width — add it for proper mobile scaling",
        severity: "warning",
        viewport: "all",
        element: "meta",
        line: 0,
      });
    }
  }

  return issues;
}

function checkTablesResponsive(html: string): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  const tableRe = /<table(\s[^>]*)?\s*>/gi;
  const lines = html.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (tableRe.test(lines[i])) {
      // Check if table is wrapped in a responsive container
      const surroundingContext = lines.slice(Math.max(0, i - 2), i + 1).join("\n");
      const hasWrapper = /overflow-x\s*:\s*auto|table-responsive|overflow\s*:\s*auto/i.test(surroundingContext);
      if (!hasWrapper) {
        issues.push({
          rule: "table-no-responsive",
          message: "Table without responsive wrapper — wrap in a container with overflow-x:auto for mobile",
          severity: "warning",
          viewport: "mobile",
          element: "table",
          line: i + 1,
        });
      }
    }
    tableRe.lastIndex = 0; // reset for next line
  }

  return issues;
}

// =============================================================================
// CSS Checks
// =============================================================================

interface CssDeclaration {
  property: string;
  value: string;
  selector: string;
  line: number;
}

function extractDeclarations(css: string): CssDeclaration[] {
  const results: CssDeclaration[] = [];
  const lines = css.split("\n");
  let currentSelector = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes("{") && !line.startsWith("@")) {
      currentSelector = line.split("{")[0].trim();
    }
    // Extract all property:value pairs from the line (handles inline rules)
    const declRe = /([\w-]+)\s*:\s*([^;{}]+)/g;
    let declMatch: RegExpExecArray | null;
    while ((declMatch = declRe.exec(line)) !== null) {
      const prop = declMatch[1];
      const val = declMatch[2].trim();
      // Skip selectors (e.g. "name" in meta name="viewport") and pseudo-selectors
      if (/^[a-z][\w-]*$/i.test(prop) && !prop.startsWith("--")) {
        results.push({
          property: prop,
          value: val,
          selector: currentSelector,
          line: i + 1,
        });
      }
    }
  }
  return results;
}

function checkFixedWidths(css: string, viewports: Viewport[]): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  const decls = extractDeclarations(css);
  const mobileWidth = viewports.find((v) => v.name === "mobile")?.width ?? 375;

  for (const decl of decls) {
    if (decl.property !== "width" && decl.property !== "min-width") continue;

    const pxMatch = decl.value.match(/^(\d+)px$/);
    if (pxMatch) {
      const px = parseInt(pxMatch[1], 10);
      if (px > mobileWidth) {
        issues.push({
          rule: "fixed-width-overflow",
          message: `${decl.selector} has ${decl.property}: ${decl.value} which exceeds mobile viewport (${mobileWidth}px)`,
          severity: "error",
          viewport: "mobile",
          element: decl.selector,
          line: decl.line,
        });
      }
    }
  }

  return issues;
}

function checkMediaQueries(css: string): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  const hasMediaQuery = /@media\s/i.test(css);

  if (!hasMediaQuery && css.length > 100) {
    issues.push({
      rule: "no-media-queries",
      message: "No @media queries found — add responsive breakpoints for different screen sizes",
      severity: "info",
      viewport: "all",
      element: "stylesheet",
      line: 0,
    });
  }

  return issues;
}

function checkImageMaxWidth(css: string, html: string): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  const hasImages = /<img\s/i.test(html);
  if (!hasImages) return issues;

  const hasImgMaxWidth = /img\s*\{[^}]*max-width/i.test(css) ||
    /img[^{]*\{[^}]*max-width/i.test(css) ||
    /max-width\s*:\s*100%/i.test(css);

  if (!hasImgMaxWidth) {
    issues.push({
      rule: "image-no-max-width",
      message: "Images found without max-width:100% rule — images may overflow on small screens",
      severity: "warning",
      viewport: "mobile",
      element: "img",
      line: 0,
    });
  }

  return issues;
}

function checkHorizontalScrollElements(css: string): ResponsiveIssue[] {
  const issues: ResponsiveIssue[] = [];
  const decls = extractDeclarations(css);

  for (const decl of decls) {
    if (decl.property === "overflow-x" && decl.value === "scroll") {
      issues.push({
        rule: "horizontal-scroll-element",
        message: `${decl.selector} uses overflow-x:scroll — ensure content doesn't require horizontal scrolling`,
        severity: "info",
        viewport: "mobile",
        element: decl.selector,
        line: decl.line,
      });
    }
  }

  return issues;
}

// =============================================================================
// Main API
// =============================================================================

/**
 * Validates HTML and CSS for responsive layout issues across viewports.
 */
export function validateResponsive(
  html: string,
  css: string,
  viewports: Viewport[] = DEFAULT_VIEWPORTS,
): ResponsiveResult {
  const issues: ResponsiveIssue[] = [
    ...checkViewportMeta(html),
    ...checkTablesResponsive(html),
    ...checkFixedWidths(css, viewports),
    ...checkMediaQueries(css),
    ...checkImageMaxWidth(css, html),
    ...checkHorizontalScrollElements(css),
  ];

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return {
    isResponsive: errors === 0,
    issues,
    viewportsChecked: viewports.map((v) => v.name),
    counts: { errors, warnings },
  };
}

/**
 * Performance Budget Checker
 *
 * Validates CSS size, selector count, font asset count, and total
 * asset size against configurable budgets.
 */

// =============================================================================
// Types
// =============================================================================

export interface PerformanceBudget {
  /** Max CSS size in bytes */
  maxCssBytes: number;
  /** Max CSS selector count */
  maxSelectors: number;
  /** Max font file count */
  maxFontFiles: number;
  /** Max total asset size in bytes */
  maxTotalAssetBytes: number;
}

export const DEFAULT_BUDGET: PerformanceBudget = {
  maxCssBytes: 100 * 1024,       // 100KB
  maxSelectors: 2000,
  maxFontFiles: 5,
  maxTotalAssetBytes: 500 * 1024, // 500KB
};

export type BudgetMetric = "cssSize" | "selectorCount" | "fontFiles" | "totalAssets";

export interface BudgetViolation {
  /** Which metric is violated */
  metric: BudgetMetric;
  /** Human-readable label */
  label: string;
  /** Actual value */
  actual: number;
  /** Budget limit */
  limit: number;
  /** Utilization ratio (actual/limit) */
  ratio: number;
  /** Severity: warning (>80%), error (>100%) */
  severity: "warning" | "error";
}

export interface AssetEntry {
  /** File path or name */
  path: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Asset type */
  type: "css" | "font" | "image" | "js" | "other";
}

export interface BudgetCheckResult {
  /** Whether all budgets pass */
  pass: boolean;
  /** Violations found */
  violations: BudgetViolation[];
  /** Per-metric measurements */
  metrics: {
    cssBytes: number;
    selectorCount: number;
    fontFileCount: number;
    totalAssetBytes: number;
  };
  /** Per-metric utilization (0-1+) */
  utilization: {
    cssBytes: number;
    selectorCount: number;
    fontFileCount: number;
    totalAssetBytes: number;
  };
}

// =============================================================================
// Metric Extraction
// =============================================================================

/**
 * Counts CSS selectors in a stylesheet string.
 * Counts opening braces not inside comments or strings.
 */
export function countSelectors(css: string): number {
  // Remove comments
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove @-rule blocks that aren't selectors (media queries contain selectors inside)
  // Count lines with { that aren't @-rules
  let count = 0;
  const lines = noComments.split("{");
  for (let i = 0; i < lines.length - 1; i++) {
    const before = lines[i].trim();
    // Skip @-rules that don't have selectors (e.g. @media, @keyframes open)
    const lastLine = before.split("\n").pop()?.trim() || "";
    if (lastLine.startsWith("@media") || lastLine.startsWith("@keyframes") ||
        lastLine.startsWith("@font-face") || lastLine.startsWith("@supports") ||
        lastLine.startsWith("@layer") || lastLine === "") {
      continue;
    }
    // Count comma-separated selectors
    const selectorBlock = lastLine;
    const selectors = selectorBlock.split(",").filter((s) => s.trim().length > 0);
    count += selectors.length;
  }
  return count;
}

/**
 * Computes total CSS size from asset entries.
 */
export function getCssSize(assets: AssetEntry[]): number {
  return assets
    .filter((a) => a.type === "css")
    .reduce((sum, a) => sum + a.sizeBytes, 0);
}

/**
 * Counts font files from asset entries.
 */
export function getFontFileCount(assets: AssetEntry[]): number {
  return assets.filter((a) => a.type === "font").length;
}

/**
 * Computes total asset size.
 */
export function getTotalAssetSize(assets: AssetEntry[]): number {
  return assets.reduce((sum, a) => sum + a.sizeBytes, 0);
}

// =============================================================================
// Budget Checking
// =============================================================================

function checkMetric(
  metric: BudgetMetric,
  label: string,
  actual: number,
  limit: number,
): BudgetViolation | null {
  const ratio = limit > 0 ? actual / limit : 0;
  if (ratio >= 1.0) {
    return { metric, label, actual, limit, ratio, severity: "error" };
  }
  if (ratio > 0.8) {
    return { metric, label, actual, limit, ratio, severity: "warning" };
  }
  return null;
}

/**
 * Checks all performance budgets against provided assets and CSS content.
 */
export function checkBudget(
  assets: AssetEntry[],
  cssContent: string,
  budget: Partial<PerformanceBudget> = {},
): BudgetCheckResult {
  const b = { ...DEFAULT_BUDGET, ...budget };

  const cssBytes = getCssSize(assets);
  const selectorCount = countSelectors(cssContent);
  const fontFileCount = getFontFileCount(assets);
  const totalAssetBytes = getTotalAssetSize(assets);

  const violations: BudgetViolation[] = [];

  const v1 = checkMetric("cssSize", "CSS Size", cssBytes, b.maxCssBytes);
  if (v1) violations.push(v1);

  const v2 = checkMetric("selectorCount", "Selector Count", selectorCount, b.maxSelectors);
  if (v2) violations.push(v2);

  const v3 = checkMetric("fontFiles", "Font Files", fontFileCount, b.maxFontFiles);
  if (v3) violations.push(v3);

  const v4 = checkMetric("totalAssets", "Total Assets", totalAssetBytes, b.maxTotalAssetBytes);
  if (v4) violations.push(v4);

  const hasError = violations.some((v) => v.severity === "error");

  return {
    pass: !hasError,
    violations,
    metrics: { cssBytes, selectorCount, fontFileCount, totalAssetBytes },
    utilization: {
      cssBytes: b.maxCssBytes > 0 ? cssBytes / b.maxCssBytes : 0,
      selectorCount: b.maxSelectors > 0 ? selectorCount / b.maxSelectors : 0,
      fontFileCount: b.maxFontFiles > 0 ? fontFileCount / b.maxFontFiles : 0,
      totalAssetBytes: b.maxTotalAssetBytes > 0 ? totalAssetBytes / b.maxTotalAssetBytes : 0,
    },
  };
}

/**
 * Formats a budget check result as a human-readable report.
 */
export function formatBudgetReport(result: BudgetCheckResult): string {
  const lines: string[] = [];
  lines.push(result.pass ? "✓ Performance budget: PASS" : "✗ Performance budget: FAIL");
  lines.push("");

  const fmt = (label: string, actual: number, limit: number, unit: string): string => {
    const pct = limit > 0 ? Math.round((actual / limit) * 100) : 0;
    return `  ${label}: ${formatSize(actual, unit)} / ${formatSize(limit, unit)} (${pct}%)`;
  };

  lines.push(fmt("CSS Size", result.metrics.cssBytes, DEFAULT_BUDGET.maxCssBytes, "bytes"));
  lines.push(fmt("Selectors", result.metrics.selectorCount, DEFAULT_BUDGET.maxSelectors, "count"));
  lines.push(fmt("Font Files", result.metrics.fontFileCount, DEFAULT_BUDGET.maxFontFiles, "count"));
  lines.push(fmt("Total Assets", result.metrics.totalAssetBytes, DEFAULT_BUDGET.maxTotalAssetBytes, "bytes"));

  if (result.violations.length > 0) {
    lines.push("");
    lines.push("Violations:");
    for (const v of result.violations) {
      const icon = v.severity === "error" ? "✗" : "⚠";
      lines.push(`  ${icon} ${v.label}: ${v.actual} exceeds ${v.severity === "error" ? "limit" : "80% of"} ${v.limit}`);
    }
  }

  return lines.join("\n");
}

function formatSize(value: number, unit: string): string {
  if (unit === "bytes") {
    if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
    return `${value}B`;
  }
  return `${value}`;
}

/**
 * Post-Generation Hook
 *
 * Runs after LLM streaming completes to produce:
 * 1. Accessibility audit (contrast checking against brand colors)
 * 2. Brand consistency score (color compliance in generated output)
 * 3. Quality report with actionable suggestions
 */

import type {
  BrandTokenContext,
  AccessibilityIssue,
  AccessibilityReport,
  QualityReport,
  PostGenerationResult,
} from "./types";
import { meetsContrastAA } from "./color-mapper";

// =============================================================================
// Color Extraction from Generated Code
// =============================================================================

/**
 * Extracts hex colors from generated code (SCSS, HTML, CSS).
 * Finds colors in style attributes, SCSS variables, and CSS properties.
 */
function extractColorsFromCode(code: string): string[] {
  const hexPattern = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
  const matches = code.match(hexPattern) || [];
  return [...new Set(matches)];
}

/**
 * Extracts foreground/background color pairs from inline styles and CSS.
 * Looks for common patterns like `color: X; background: Y`.
 */
function extractColorPairs(
  code: string,
): Array<{ foreground: string; background: string; element: string }> {
  const pairs: Array<{ foreground: string; background: string; element: string }> = [];

  // Pattern: style="...color: #hex...background(-color)?: #hex..."
  const styleBlockPattern = /style="([^"]+)"/g;
  let match;

  while ((match = styleBlockPattern.exec(code)) !== null) {
    const style = match[1];
    const colorMatch = style.match(/(?:^|;\s*)color\s*:\s*(#[0-9a-fA-F]{3,6})/i);
    const bgMatch = style.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/i);

    if (colorMatch && bgMatch) {
      pairs.push({
        foreground: colorMatch[1],
        background: bgMatch[1],
        element: "inline-style",
      });
    }
  }

  return pairs;
}

// =============================================================================
// Brand Consistency Checking
// =============================================================================

/**
 * Checks how many colors in the generated code match the brand palette.
 * Returns a 0-100 score where 100 means all colors are on-brand.
 *
 * When DTCG tokens are available, the full 50-950 color scale is used,
 * giving the LLM more room to use lighter/darker shades while staying on-brand.
 */
function checkBrandConsistency(
  code: string,
  brandTokens: BrandTokenContext,
): { score: number; offBrandColors: string[] } {
  const extractedColors = extractColorsFromCode(code);
  if (extractedColors.length === 0) return { score: 100, offBrandColors: [] };

  const brandColors = new Set<string>();

  // When DTCG tokens exist, use the full scale for wider tolerance
  if (brandTokens.designTokens) {
    const dt = brandTokens.designTokens;
    for (const role of ["primary", "secondary", "accent", "error", "warning", "success", "info"] as const) {
      const scale = dt.color[role];
      if (!scale) continue;
      for (const step of Object.keys(scale)) {
        if (step.startsWith("$")) continue;
        const token = scale[step as keyof typeof scale];
        if (token && typeof token === "object" && "$value" in token) {
          brandColors.add((token as { $value: { hex: string } }).$value.hex.toLowerCase());
        }
      }
    }
    brandColors.add(dt.color.background.$value.hex.toLowerCase());
    brandColors.add(dt.color.text.$value.hex.toLowerCase());
  } else {
    // Legacy path: only 9 base colors
    for (const c of [
      brandTokens.colors.primary,
      brandTokens.colors.secondary,
      brandTokens.colors.accent,
      brandTokens.colors.background,
      brandTokens.colors.text,
      brandTokens.colors.error,
      brandTokens.colors.warning,
      brandTokens.colors.success,
      brandTokens.colors.info,
    ]) {
      brandColors.add(c.toLowerCase());
    }
  }

  // Also allow common neutrals that are always acceptable
  const allowedNeutrals = new Set([
    "#ffffff", "#fff", "#000000", "#000",
    "#f8f9fa", "#e9ecef", "#dee2e6", "#ced4da",
    "#adb5bd", "#6c757d", "#495057", "#343a40", "#212529",
    // Bootstrap text/bg classes resolve to these
    "#f7f7f7", "#333333", "#666666", "#999999",
  ]);

  const offBrandColors: string[] = [];

  for (const color of extractedColors) {
    const normalized = color.toLowerCase();
    if (!brandColors.has(normalized) && !allowedNeutrals.has(normalized)) {
      offBrandColors.push(color);
    }
  }

  const onBrandCount = extractedColors.length - offBrandColors.length;
  const score = Math.round((onBrandCount / extractedColors.length) * 100);

  return { score, offBrandColors };
}

// =============================================================================
// Accessibility Audit
// =============================================================================

/**
 * Runs contrast checks on brand color combinations that are likely
 * to appear in the generated output.
 */
function auditBrandContrast(brandTokens: BrandTokenContext): AccessibilityReport {
  const issues: AccessibilityIssue[] = [];
  const { colors } = brandTokens;

  // Check the most critical color pairs for Odoo themes
  const criticalPairs: Array<{
    fg: string;
    bg: string;
    element: string;
  }> = [
    { fg: colors.text, bg: colors.background, element: "body-text" },
    { fg: "#ffffff", bg: colors.primary, element: "primary-button" },
    { fg: "#ffffff", bg: colors.accent, element: "accent-button" },
    { fg: colors.primary, bg: colors.background, element: "heading-on-bg" },
    { fg: colors.text, bg: "#ffffff", element: "text-on-white" },
    { fg: "#ffffff", bg: colors.error, element: "error-badge" },
    { fg: "#ffffff", bg: colors.success, element: "success-badge" },
  ];

  for (const pair of criticalPairs) {
    if (!meetsContrastAA(pair.fg, pair.bg)) {
      issues.push({
        id: `contrast-${pair.element}`,
        criterion: "1.4.3",
        level: "AA",
        severity: "error",
        message: `${pair.element}: ${pair.fg} on ${pair.bg} fails WCAG AA contrast (4.5:1)`,
        element: pair.element,
        suggestion: `Adjust ${pair.fg} or ${pair.bg} to achieve 4.5:1 contrast ratio`,
      });
    }
  }

  const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 15);

  return {
    passed: issues.filter((i) => i.severity === "error").length === 0,
    totalIssues: issues.length,
    score,
    issues,
  };
}

/**
 * Runs contrast checks on colors extracted from generated code.
 */
function auditGeneratedContrast(
  code: string,
  brandTokens: BrandTokenContext,
): AccessibilityIssue[] {
  const pairs = extractColorPairs(code);
  const issues: AccessibilityIssue[] = [];

  for (const pair of pairs) {
    if (!meetsContrastAA(pair.foreground, pair.background)) {
      issues.push({
        id: `generated-contrast-${pair.element}`,
        criterion: "1.4.3",
        level: "AA",
        severity: "warning",
        message: `Generated code: ${pair.foreground} on ${pair.background} may fail WCAG AA`,
        element: pair.element,
        suggestion: "Consider adjusting colors for accessibility compliance",
      });
    }
  }

  return issues;
}

// =============================================================================
// Public API
// =============================================================================

export interface PostGenerationInput {
  generatedCode: string;
  brandTokens: BrandTokenContext;
}

/**
 * Runs the post-generation pipeline:
 * 1. Audit brand color contrast (WCAG AA)
 * 2. Check brand consistency in generated code
 * 3. Audit colors found in generated output
 * 4. Compute overall quality score
 */
export function runPostGeneration(input: PostGenerationInput): PostGenerationResult {
  const { generatedCode, brandTokens } = input;

  // 1. Audit brand palette contrast
  const brandA11y = auditBrandContrast(brandTokens);

  // 2. Check brand consistency
  const { score: brandScore, offBrandColors } = checkBrandConsistency(
    generatedCode,
    brandTokens,
  );

  // 3. Audit generated code colors
  const generatedIssues = auditGeneratedContrast(generatedCode, brandTokens);

  // 4. Merge all issues
  const allIssues = [...brandA11y.issues, ...generatedIssues];
  const totalScore = allIssues.length === 0
    ? 100
    : Math.max(0, 100 - allIssues.length * 10);

  const accessibilityReport: AccessibilityReport = {
    passed: allIssues.filter((i) => i.severity === "error").length === 0,
    totalIssues: allIssues.length,
    score: totalScore,
    issues: allIssues,
  };

  // 5. Build suggestions
  const suggestions: string[] = [];

  if (offBrandColors.length > 0) {
    suggestions.push(
      `Off-brand colors found: ${offBrandColors.slice(0, 3).join(", ")}. Replace with brand palette colors.`,
    );
  }

  if (!brandA11y.passed) {
    const failCount = brandA11y.issues.filter((i) => i.severity === "error").length;
    suggestions.push(
      `${failCount} brand color pair(s) fail WCAG AA contrast. Adjust palette for accessibility.`,
    );
  }

  if (generatedIssues.length > 0) {
    suggestions.push(
      `${generatedIssues.length} inline color pair(s) in generated code may have contrast issues.`,
    );
  }

  // 6. Typography consistency check (when DTCG tokens available)
  let typographyScore = 100;
  if (brandTokens.designTokens?.typography?.fontFamily) {
    const dt = brandTokens.designTokens;
    const headingFont = dt.typography.fontFamily.heading.$value.toLowerCase();
    const bodyFont = dt.typography.fontFamily.body.$value.toLowerCase();
    const codeLower = generatedCode.toLowerCase();

    const hasHeading = codeLower.includes(headingFont);
    const hasBody = codeLower.includes(bodyFont);

    if (!hasHeading && !hasBody) {
      typographyScore = 30;
      suggestions.push(`Brand fonts not found in output. Expected "${dt.typography.fontFamily.heading.$value}" and/or "${dt.typography.fontFamily.body.$value}".`);
    } else if (!hasHeading || !hasBody) {
      typographyScore = 65;
      const missing = !hasHeading ? dt.typography.fontFamily.heading.$value : dt.typography.fontFamily.body.$value;
      suggestions.push(`Brand font "${missing}" not found in generated code.`);
    }
  }

  // 7. Compute overall quality
  // When DTCG tokens exist: 40% a11y + 30% color + 20% typography + 10% baseline
  // Legacy: 40% a11y + 60% color
  const hasDtcg = !!brandTokens.designTokens;
  const overallScore = hasDtcg
    ? Math.round(
        accessibilityReport.score * 0.4
        + brandScore * 0.3
        + typographyScore * 0.2
        + 10, // baseline for spacing/structure (not yet checked)
      )
    : Math.round(accessibilityReport.score * 0.4 + brandScore * 0.6);

  return {
    quality: {
      overallScore,
      accessibility: accessibilityReport,
      brandConsistency: brandScore,
      suggestions,
    },
    timestamp: new Date().toISOString(),
  };
}

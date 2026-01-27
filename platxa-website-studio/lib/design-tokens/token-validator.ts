/**
 * Token Validator
 *
 * Validates DesignTokenSet for completeness, value ranges, and WCAG contrast.
 * Also provides semver versioning for token sets.
 */

import { meetsContrastAA } from "../agent-bridge/color-mapper";
import type { AccessibilityIssue } from "../agent-bridge/types";
import type {
  DesignTokenSet,
  DesignTokenSetMetadata,
  ColorScaleStepKey,
} from "./types";
import { COLOR_SCALE_STEPS } from "./types";

// =============================================================================
// Validation Result
// =============================================================================

export interface TokenValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// Token Set Validation
// =============================================================================

/**
 * Validates a DesignTokenSet for completeness and value correctness.
 *
 * Checks:
 * - All required token groups present
 * - Color scales have all 11 steps
 * - Background/text tokens exist
 * - Typography has required families and sizes
 * - Spacing scale has key entries
 * - Border radius has all levels
 * - Shadows have all elevation levels
 * - Metadata is well-formed
 */
export function validateTokenSet(tokens: DesignTokenSet): TokenValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Metadata
  if (!tokens.metadata) {
    errors.push("Missing metadata");
  } else {
    if (!tokens.metadata.name) errors.push("Missing metadata.name");
    if (!tokens.metadata.version) errors.push("Missing metadata.version");
    if (!isValidSemver(tokens.metadata.version)) {
      warnings.push(`Invalid semver: "${tokens.metadata.version}"`);
    }
  }

  // Color group
  if (!tokens.color) {
    errors.push("Missing color token group");
  } else {
    validateColorGroup(tokens, errors, warnings);
  }

  // Typography group
  if (!tokens.typography) {
    errors.push("Missing typography token group");
  } else {
    validateTypographyGroup(tokens, errors, warnings);
  }

  // Spacing
  if (!tokens.spacing) {
    errors.push("Missing spacing token group");
  } else {
    const spacingKeys = Object.keys(tokens.spacing).filter((k) => !k.startsWith("$"));
    if (spacingKeys.length < 10) {
      warnings.push(`Spacing scale has only ${spacingKeys.length} entries (expected 20+)`);
    }
  }

  // Border radius
  if (!tokens.borderRadius) {
    errors.push("Missing borderRadius token group");
  } else {
    for (const key of ["none", "sm", "md", "lg", "xl", "full"] as const) {
      if (!tokens.borderRadius[key]) {
        errors.push(`Missing borderRadius.${key}`);
      }
    }
  }

  // Shadow
  if (!tokens.shadow) {
    errors.push("Missing shadow token group");
  } else {
    for (const key of ["xs", "sm", "md", "lg", "xl"] as const) {
      if (!tokens.shadow[key]) {
        errors.push(`Missing shadow.${key}`);
      }
    }
  }

  // Animation
  if (!tokens.animation) {
    errors.push("Missing animation token group");
  }

  // Breakpoint
  if (!tokens.breakpoint) {
    errors.push("Missing breakpoint token group");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Color Group Validation
// =============================================================================

function validateColorGroup(
  tokens: DesignTokenSet,
  errors: string[],
  warnings: string[],
): void {
  const { color } = tokens;

  // Check palette scales
  for (const role of ["primary", "secondary", "accent", "error", "warning", "success", "info"] as const) {
    const scale = color[role];
    if (!scale) {
      errors.push(`Missing color.${role} scale`);
      continue;
    }
    for (const step of COLOR_SCALE_STEPS) {
      if (!scale[step]) {
        errors.push(`Missing color.${role}.${step}`);
      } else if (!isValidHex(scale[step].$value.hex)) {
        errors.push(`Invalid hex in color.${role}.${step}: "${scale[step].$value.hex}"`);
      }
    }
  }

  // Check background/text
  if (!color.background) {
    errors.push("Missing color.background");
  }
  if (!color.text) {
    errors.push("Missing color.text");
  }

  // Lightness ordering: step 50 should be lighter than step 950
  for (const role of ["primary", "secondary", "accent"] as const) {
    const scale = color[role];
    if (!scale?.["50"] || !scale?.["950"]) continue;
    const l50 = scale["50"].$value.oklch.l;
    const l950 = scale["950"].$value.oklch.l;
    if (l50 <= l950) {
      warnings.push(
        `color.${role}: step 50 (L=${l50}) should be lighter than step 950 (L=${l950})`,
      );
    }
  }
}

// =============================================================================
// Typography Validation
// =============================================================================

function validateTypographyGroup(
  tokens: DesignTokenSet,
  errors: string[],
  _warnings: string[],
): void {
  const { typography } = tokens;

  if (!typography.fontFamily?.heading?.$value) {
    errors.push("Missing typography.fontFamily.heading");
  }
  if (!typography.fontFamily?.body?.$value) {
    errors.push("Missing typography.fontFamily.body");
  }

  const requiredSizes = ["sm", "base", "lg", "xl"] as const;
  for (const level of requiredSizes) {
    if (!typography.fontSize?.[level]) {
      errors.push(`Missing typography.fontSize.${level}`);
    }
  }
}

// =============================================================================
// Contrast Validation (WCAG)
// =============================================================================

/**
 * Validates WCAG AA contrast for key color pairings in the token set.
 * Returns accessibility issues for failing pairs.
 */
export function validateContrast(tokens: DesignTokenSet): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const { color } = tokens;

  if (!color.background || !color.text) return issues;

  const bg = color.background.$value.hex;
  const text = color.text.$value.hex;

  // Critical pairs to check
  const pairs: Array<{
    fg: string;
    bg: string;
    element: string;
  }> = [
    { fg: text, bg, element: "body-text-on-background" },
    { fg: "#ffffff", bg: color.primary?.["500"]?.$value.hex || "#000", element: "white-on-primary" },
    { fg: "#ffffff", bg: color.accent?.["500"]?.$value.hex || "#000", element: "white-on-accent" },
    { fg: color.primary?.["700"]?.$value.hex || "#000", bg, element: "primary-heading-on-bg" },
    { fg: text, bg: "#ffffff", element: "text-on-white" },
    { fg: "#ffffff", bg: color.error?.["500"]?.$value.hex || "#dc2626", element: "white-on-error" },
    { fg: "#ffffff", bg: color.success?.["500"]?.$value.hex || "#059669", element: "white-on-success" },
  ];

  for (const pair of pairs) {
    if (!meetsContrastAA(pair.fg, pair.bg)) {
      issues.push({
        id: `contrast-${pair.element}`,
        criterion: "1.4.3",
        level: "AA",
        severity: "error",
        message: `${pair.element}: ${pair.fg} on ${pair.bg} fails WCAG AA (4.5:1)`,
        element: pair.element,
        suggestion: `Adjust ${pair.fg} or ${pair.bg} to achieve 4.5:1 contrast ratio`,
      });
    }
  }

  return issues;
}

// =============================================================================
// Token Versioning
// =============================================================================

/**
 * Bumps the semver version of a token set's metadata.
 *
 * @param metadata - Current metadata
 * @param bump - Version bump type
 * @returns New metadata with bumped version
 */
export function bumpVersion(
  metadata: DesignTokenSetMetadata,
  bump: "major" | "minor" | "patch",
): DesignTokenSetMetadata {
  const parts = (metadata.version || "1.0.0").split(".").map(Number);
  const [major = 1, minor = 0, patch = 0] = parts;

  let newVersion: string;
  switch (bump) {
    case "major":
      newVersion = `${major + 1}.0.0`;
      break;
    case "minor":
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case "patch":
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  return {
    ...metadata,
    version: newVersion,
    createdAt: new Date().toISOString(),
  };
}

// =============================================================================
// Helpers
// =============================================================================

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

function isValidSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

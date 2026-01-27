/**
 * Token Assembler
 *
 * Assembles all token generators into a complete DesignTokenSet.
 * This is the main entry point for producing a canonical token set
 * from user inputs (palette, typography config, design style).
 */

import type { OdooColorPalette } from "../agent-bridge/types";
import type { DesignTokenSet, TypographyConfig } from "./types";
import { generatePaletteScales, deriveDarkMode } from "./color-scale-generator";
import { generateTypographyTokens } from "./typography-generator";
import {
  generateSpacingScale,
  generateBorderRadiusTokens,
  generateShadowTokens,
  generateAnimationTokens,
  generateBreakpointTokens,
} from "./spacing-generator";

// =============================================================================
// Assembly Input
// =============================================================================

export interface AssembleTokenSetInput {
  palette?: OdooColorPalette;
  typography?: Partial<TypographyConfig>;
  designStyle?: string;
  industry?: string;
  name?: string;
  version?: string;
}

// =============================================================================
// Assemble Token Set
// =============================================================================

/**
 * Assembles a complete DesignTokenSet from user inputs.
 * Calls all token generators and combines their output into
 * the canonical DTCG structure.
 *
 * @param input - User-provided palette, typography, style preferences
 * @returns Complete DesignTokenSet ready for transformation or serialization
 */
export function assembleTokenSet(input: AssembleTokenSetInput = {}): DesignTokenSet {
  const {
    palette,
    typography,
    designStyle = "modern",
    industry,
    name = "platxa-tokens",
    version = "1.0.0",
  } = input;

  return {
    $description: `Design tokens for ${industry || "generic"} (${designStyle} style)`,
    metadata: {
      name,
      version,
      createdAt: new Date().toISOString(),
      industry,
      designStyle,
    },
    color: generatePaletteScales(palette),
    typography: generateTypographyTokens(typography),
    spacing: generateSpacingScale(),
    borderRadius: generateBorderRadiusTokens(designStyle),
    shadow: generateShadowTokens(),
    animation: generateAnimationTokens(),
    breakpoint: generateBreakpointTokens(),
  };
}

// =============================================================================
// Assemble with Dark Mode
// =============================================================================

export interface TokenSetWithDarkMode {
  light: DesignTokenSet;
  dark: DesignTokenSet;
}

/**
 * Assembles both light and dark mode token sets.
 * Dark mode is automatically derived from light mode via OKLCH inversion.
 *
 * @param input - Same input as assembleTokenSet
 * @returns Object with `light` and `dark` DesignTokenSets
 */
export function assembleTokenSetWithDarkMode(
  input: AssembleTokenSetInput = {},
): TokenSetWithDarkMode {
  const light = assembleTokenSet(input);
  const dark = deriveDarkMode(light);
  return { light, dark };
}

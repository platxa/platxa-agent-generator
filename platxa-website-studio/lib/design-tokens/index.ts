/**
 * Design Tokens Module
 *
 * W3C DTCG design token pipeline for Platxa.
 * Generates, transforms, and enforces brand tokens across AI generation.
 */

// Types
export type {
  DesignToken,
  TokenGroup,
  ColorValue,
  ColorTokenValue,
  ColorScaleStep,
  ColorScaleToken,
  ColorScaleStepKey,
  ColorTokenGroup,
  FluidTypeValue,
  FontFamilyToken,
  FontWeightToken,
  LineHeightToken,
  LetterSpacingToken,
  FluidFontSizeToken,
  TypographyTokenGroup,
  DimensionToken,
  SpacingTokenGroup,
  BorderRadiusTokenGroup,
  ShadowLayerValue,
  ShadowToken,
  ShadowTokenGroup,
  DurationToken,
  CubicBezierToken,
  AnimationTokenGroup,
  BreakpointTokenGroup,
  DesignTokenSetMetadata,
  DesignTokenSet,
  TypographyConfig,
  TypeScaleRatio,
} from "./types";

export { COLOR_SCALE_STEPS, TYPE_SCALE_RATIOS } from "./types";

// Generators (Phase 2)
export {
  generateColorScale,
  generatePaletteScales,
  deriveDarkMode,
} from "./color-scale-generator";

export {
  generateFluidTypeScale,
  generateTypographyTokens,
} from "./typography-generator";

export {
  generateSpacingScale,
  generateBorderRadiusTokens,
  generateShadowTokens,
  generateAnimationTokens,
  generateBreakpointTokens,
} from "./spacing-generator";

// Assembly + Formatting (Phase 3)
export {
  assembleTokenSet,
  assembleTokenSetWithDarkMode,
} from "./token-assembler";

export {
  toDtcgJson,
  fromDtcgJson,
  toDtcgJsonString,
} from "./dtcg-formatter";

// Transformers (Phase 4)
export {
  tokensToCssVariables,
  tokensToCssVariablesWithDarkMode,
} from "./css-transformer";

export {
  tokensToTailwindTheme,
  tokensToTailwindCss,
} from "./tailwind-transformer";

// Presets + Validation (Phase 5)
export {
  getPresetTokens,
  listPresets,
} from "./industry-presets";

export {
  validateTokenSet,
  validateContrast,
  bumpVersion,
} from "./token-validator";

// Figma Integration (Phase 6)
export {
  extractTokensFromFigmaFile,
  extractTokensFromFigmaVariables,
  fetchAndExtractTokens,
  exportToTokensJson,
  parseTokensJson,
} from "./figma-extractor";

export type {
  FigmaColor,
  FigmaPaint,
  FigmaEffect,
  FigmaTextStyle,
  FigmaNode,
  FigmaFile,
  FigmaVariable,
  FigmaVariableCollection,
  FigmaVariablesResponse,
  FigmaExtractionOptions,
  FigmaExtractionResult,
} from "./figma-extractor";

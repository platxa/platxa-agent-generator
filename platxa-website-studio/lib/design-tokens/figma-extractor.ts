/**
 * Figma Plugin - DTCG Token Extraction
 *
 * Extracts design tokens from Figma files and exports them as W3C DTCG
 * compliant .tokens.json files. Supports:
 * - Color styles → color tokens with scales
 * - Text styles → typography tokens
 * - Effect styles → shadow tokens
 * - Spacing from components → spacing tokens
 *
 * Feature #6: Add Figma plugin for DTCG token extraction
 */

import type {
  DesignTokenSet,
  DesignTokenSetMetadata,
  ColorTokenGroup,
  ColorScaleToken,
  ColorScaleStep,
  ColorTokenValue,
  TypographyTokenGroup,
  SpacingTokenGroup,
  BorderRadiusTokenGroup,
  ShadowTokenGroup,
  ShadowToken,
  ShadowLayerValue,
  AnimationTokenGroup,
  BreakpointTokenGroup,
  DimensionToken,
  DesignToken,
  FluidFontSizeToken,
  FluidTypeValue,
} from "./types";
import { hexToOklch } from "../agent-bridge/color-mapper";
import { toDtcgJsonString, fromDtcgJson } from "./dtcg-formatter";

// =============================================================================
// Figma API Types
// =============================================================================

/** Figma file response structure */
export interface FigmaFile {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaNode;
  styles: Record<string, FigmaStyle>;
}

/** Figma node */
export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  effects?: FigmaEffect[];
  style?: FigmaTextStyle;
  absoluteBoundingBox?: { width: number; height: number };
  cornerRadius?: number;
  rectangleCornerRadii?: [number, number, number, number];
}

/** Figma style definition */
export interface FigmaStyle {
  key: string;
  name: string;
  styleType: "FILL" | "TEXT" | "EFFECT" | "GRID";
  description?: string;
}

/** Figma color value (RGBA 0-1) */
export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Figma paint (fill/stroke) */
export interface FigmaPaint {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE";
  color?: FigmaColor;
  opacity?: number;
  visible?: boolean;
}

/** Figma effect (shadow, blur) */
export interface FigmaEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  visible?: boolean;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

/** Figma text style */
export interface FigmaTextStyle {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  letterSpacing?: number;
  textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
}

/** Figma Variables API types */
export interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";
  valuesByMode: Record<string, FigmaVariableValue>;
  scopes: string[];
}

export interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variableIds: string[];
}

export type FigmaVariableValue =
  | { type: "BOOLEAN"; value: boolean }
  | { type: "FLOAT"; value: number }
  | { type: "STRING"; value: string }
  | { type: "COLOR"; value: FigmaColor }
  | { type: "VARIABLE_ALIAS"; id: string };

// =============================================================================
// Extraction Options
// =============================================================================

export interface FigmaExtractorOptions {
  /** Figma Personal Access Token */
  accessToken?: string;
  /** Include color tokens */
  extractColors?: boolean;
  /** Include typography tokens */
  extractTypography?: boolean;
  /** Include spacing tokens */
  extractSpacing?: boolean;
  /** Include shadow tokens */
  extractShadows?: boolean;
  /** Include border radius tokens */
  extractBorderRadius?: boolean;
  /** Color naming pattern to detect scales (e.g., "primary/500") */
  colorScalePattern?: RegExp;
  /** Spacing component naming pattern */
  spacingPattern?: RegExp;
  /** Generate fluid typography */
  fluidTypography?: boolean;
  /** Minimum viewport for fluid type */
  minViewport?: number;
  /** Maximum viewport for fluid type */
  maxViewport?: number;
}

const DEFAULT_OPTIONS: Required<FigmaExtractorOptions> = {
  accessToken: "",
  extractColors: true,
  extractTypography: true,
  extractSpacing: true,
  extractShadows: true,
  extractBorderRadius: true,
  colorScalePattern: /^(primary|secondary|accent|error|warning|success|info|neutral)[\/\-]?(\d+)?$/i,
  spacingPattern: /^spacing[\/\-]?(\d+|xs|sm|md|lg|xl|2xl|3xl|4xl)$/i,
  fluidTypography: true,
  minViewport: 320,
  maxViewport: 1280,
};

// =============================================================================
// Extraction Result
// =============================================================================

export interface FigmaExtractionResult {
  success: boolean;
  tokenSet?: DesignTokenSet;
  tokensJson?: string;
  errors: string[];
  stats: {
    colorsExtracted: number;
    typographyExtracted: number;
    spacingExtracted: number;
    shadowsExtracted: number;
  };
}

// =============================================================================
// Main Extraction Functions
// =============================================================================

/**
 * Extract design tokens from a Figma file
 */
export function extractTokensFromFigmaFile(
  figmaFile: FigmaFile,
  options: FigmaExtractorOptions = {}
): FigmaExtractionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  const stats = {
    colorsExtracted: 0,
    typographyExtracted: 0,
    spacingExtracted: 0,
    shadowsExtracted: 0,
  };

  try {
    // Extract colors from styles
    const colorTokens = opts.extractColors
      ? extractColorTokens(figmaFile, opts, errors, stats)
      : createDefaultColorGroup();

    // Extract typography from text styles
    const typographyTokens = opts.extractTypography
      ? extractTypographyTokens(figmaFile, opts, errors, stats)
      : createDefaultTypographyGroup();

    // Extract spacing from components
    const spacingTokens = opts.extractSpacing
      ? extractSpacingTokens(figmaFile, opts, errors, stats)
      : createDefaultSpacingGroup();

    // Extract shadows from effect styles
    const shadowTokens = opts.extractShadows
      ? extractShadowTokens(figmaFile, opts, errors, stats)
      : createDefaultShadowGroup();

    // Extract border radius from components
    const borderRadiusTokens = opts.extractBorderRadius
      ? extractBorderRadiusTokens(figmaFile, opts, errors)
      : createDefaultBorderRadiusGroup();

    // Assemble token set
    const metadata: DesignTokenSetMetadata = {
      name: figmaFile.name || "Figma Import",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      designStyle: "figma-import",
    };

    const tokenSet: DesignTokenSet = {
      $description: `Design tokens extracted from Figma file: ${figmaFile.name}`,
      metadata,
      color: colorTokens,
      typography: typographyTokens,
      spacing: spacingTokens,
      borderRadius: borderRadiusTokens,
      shadow: shadowTokens,
      animation: createDefaultAnimationGroup(),
      breakpoint: createDefaultBreakpointGroup(),
    };

    return {
      success: errors.length === 0,
      tokenSet,
      tokensJson: toDtcgJsonString(tokenSet),
      errors,
      stats,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
      stats,
    };
  }
}

/**
 * Extract tokens from Figma Variables API response
 */
export function extractTokensFromFigmaVariables(
  collections: FigmaVariableCollection[],
  variables: Record<string, FigmaVariable>,
  options: FigmaExtractorOptions = {}
): FigmaExtractionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];
  const stats = {
    colorsExtracted: 0,
    typographyExtracted: 0,
    spacingExtracted: 0,
    shadowsExtracted: 0,
  };

  try {
    const colorTokens = createDefaultColorGroup();
    const spacingTokens = createDefaultSpacingGroup();

    // Process each variable
    for (const variable of Object.values(variables)) {
      const name = variable.name.toLowerCase();
      const firstModeValue = Object.values(variable.valuesByMode)[0];

      if (!firstModeValue) continue;

      // Color variables
      if (variable.resolvedType === "COLOR" && firstModeValue.type === "COLOR") {
        const hex = figmaColorToHex(firstModeValue.value);
        const colorValue = createColorTokenValue(hex);

        // Match to scale pattern
        const match = name.match(opts.colorScalePattern);
        if (match) {
          const [, colorName, step] = match;
          assignColorToScale(colorTokens, colorName, step || "500", colorValue);
          stats.colorsExtracted++;
        }
      }

      // Spacing variables
      if (variable.resolvedType === "FLOAT" && firstModeValue.type === "FLOAT") {
        const match = name.match(opts.spacingPattern);
        if (match) {
          const [, size] = match;
          spacingTokens[size] = {
            $value: `${firstModeValue.value}px`,
            $type: "dimension",
          };
          stats.spacingExtracted++;
        }
      }
    }

    const metadata: DesignTokenSetMetadata = {
      name: collections[0]?.name || "Figma Variables Import",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      designStyle: "figma-variables",
    };

    const tokenSet: DesignTokenSet = {
      $description: "Design tokens extracted from Figma Variables",
      metadata,
      color: colorTokens,
      typography: createDefaultTypographyGroup(),
      spacing: spacingTokens,
      borderRadius: createDefaultBorderRadiusGroup(),
      shadow: createDefaultShadowGroup(),
      animation: createDefaultAnimationGroup(),
      breakpoint: createDefaultBreakpointGroup(),
    };

    return {
      success: errors.length === 0,
      tokenSet,
      tokensJson: toDtcgJsonString(tokenSet),
      errors,
      stats,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
      stats,
    };
  }
}

/**
 * Fetch and extract tokens from Figma API
 */
export async function fetchAndExtractTokens(
  fileKey: string,
  options: FigmaExtractorOptions
): Promise<FigmaExtractionResult> {
  if (!options.accessToken) {
    return {
      success: false,
      errors: ["Figma access token is required"],
      stats: { colorsExtracted: 0, typographyExtracted: 0, spacingExtracted: 0, shadowsExtracted: 0 },
    };
  }

  try {
    // Fetch file from Figma API
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: {
        "X-Figma-Token": options.accessToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }

    const figmaFile = (await response.json()) as FigmaFile;
    return extractTokensFromFigmaFile(figmaFile, options);
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Failed to fetch Figma file"],
      stats: { colorsExtracted: 0, typographyExtracted: 0, spacingExtracted: 0, shadowsExtracted: 0 },
    };
  }
}

// =============================================================================
// Color Extraction
// =============================================================================

function extractColorTokens(
  figmaFile: FigmaFile,
  opts: Required<FigmaExtractorOptions>,
  errors: string[],
  stats: { colorsExtracted: number }
): ColorTokenGroup {
  const colorGroup = createDefaultColorGroup();
  const extractedColors: Map<string, string> = new Map();

  // Extract from styles
  for (const [styleId, style] of Object.entries(figmaFile.styles)) {
    if (style.styleType !== "FILL") continue;

    // Find nodes using this style
    const nodesWithStyle = findNodesWithStyle(figmaFile.document, styleId);

    for (const node of nodesWithStyle) {
      if (!node.fills?.[0]) continue;

      const fill = node.fills[0];
      if (fill.type !== "SOLID" || !fill.color) continue;

      const hex = figmaColorToHex(fill.color, fill.opacity);
      extractedColors.set(style.name, hex);
    }
  }

  // Also scan for color nodes directly
  scanNodeForColors(figmaFile.document, extractedColors, opts.colorScalePattern);

  // Map extracted colors to token structure
  for (const [name, hex] of extractedColors) {
    const colorValue = createColorTokenValue(hex);
    const match = name.match(opts.colorScalePattern);

    if (match) {
      const [, colorName, step] = match;
      assignColorToScale(colorGroup, colorName, step || "500", colorValue);
      stats.colorsExtracted++;
    }
  }

  return colorGroup;
}

function scanNodeForColors(
  node: FigmaNode,
  colors: Map<string, string>,
  pattern: RegExp
): void {
  // Check node name matches color pattern
  if (pattern.test(node.name) && node.fills?.[0]?.type === "SOLID" && node.fills[0].color) {
    const hex = figmaColorToHex(node.fills[0].color, node.fills[0].opacity);
    colors.set(node.name, hex);
  }

  // Recurse into children
  if (node.children) {
    for (const child of node.children) {
      scanNodeForColors(child, colors, pattern);
    }
  }
}

function assignColorToScale(
  colorGroup: ColorTokenGroup,
  colorName: string,
  step: string,
  colorValue: ColorTokenValue
): void {
  const normalizedName = colorName.toLowerCase() as keyof ColorTokenGroup;
  const normalizedStep = step || "500";

  // Map to scale property
  const scaleKeys = ["primary", "secondary", "accent", "error", "warning", "success", "info"] as const;

  if (scaleKeys.includes(normalizedName as typeof scaleKeys[number])) {
    const scale = colorGroup[normalizedName] as ColorScaleToken;
    const stepKey = normalizedStep as keyof ColorScaleToken;

    if (stepKey in scale && typeof scale[stepKey] === "object") {
      (scale[stepKey] as ColorScaleStep).$value = colorValue;
    }
  }
}

// =============================================================================
// Typography Extraction
// =============================================================================

function extractTypographyTokens(
  figmaFile: FigmaFile,
  opts: Required<FigmaExtractorOptions>,
  errors: string[],
  stats: { typographyExtracted: number }
): TypographyTokenGroup {
  const typoGroup = createDefaultTypographyGroup();
  const textStyles: Map<string, FigmaTextStyle> = new Map();

  // Extract from text styles
  for (const [styleId, style] of Object.entries(figmaFile.styles)) {
    if (style.styleType !== "TEXT") continue;

    const nodesWithStyle = findNodesWithStyle(figmaFile.document, styleId);

    for (const node of nodesWithStyle) {
      if (node.style) {
        textStyles.set(style.name, node.style);
        break;
      }
    }
  }

  // Also scan for text nodes directly
  scanNodeForTextStyles(figmaFile.document, textStyles);

  // Map to typography tokens
  const fontFamilies = new Set<string>();
  const fontSizes = new Map<string, number>();

  for (const [name, style] of textStyles) {
    fontFamilies.add(style.fontFamily);
    stats.typographyExtracted++;

    // Try to map to size keys
    const sizeName = name.toLowerCase();
    if (sizeName.includes("heading") || sizeName.includes("h1")) {
      fontSizes.set("4xl", style.fontSize);
    } else if (sizeName.includes("h2")) {
      fontSizes.set("3xl", style.fontSize);
    } else if (sizeName.includes("h3")) {
      fontSizes.set("2xl", style.fontSize);
    } else if (sizeName.includes("h4")) {
      fontSizes.set("xl", style.fontSize);
    } else if (sizeName.includes("body") || sizeName.includes("paragraph")) {
      fontSizes.set("base", style.fontSize);
    } else if (sizeName.includes("small") || sizeName.includes("caption")) {
      fontSizes.set("sm", style.fontSize);
    }
  }

  // Set font families
  const families = Array.from(fontFamilies);
  if (families[0]) {
    typoGroup.fontFamily.heading.$value = families[0];
    typoGroup.fontFamily.body.$value = families[1] || families[0];
  }

  // Set font sizes with fluid values
  for (const [key, size] of fontSizes) {
    const sizeKey = key as keyof typeof typoGroup.fontSize;
    if (sizeKey in typoGroup.fontSize && sizeKey !== "$type") {
      typoGroup.fontSize[sizeKey] = createFluidFontSize(size, opts.minViewport, opts.maxViewport);
    }
  }

  return typoGroup;
}

function scanNodeForTextStyles(node: FigmaNode, styles: Map<string, FigmaTextStyle>): void {
  if (node.type === "TEXT" && node.style) {
    styles.set(node.name, node.style);
  }

  if (node.children) {
    for (const child of node.children) {
      scanNodeForTextStyles(child, styles);
    }
  }
}

function createFluidFontSize(
  basePx: number,
  minVp: number,
  maxVp: number
): FluidFontSizeToken {
  const minRem = (basePx * 0.875) / 16;
  const maxRem = basePx / 16;
  const vwSlope = ((maxRem - minRem) / (maxVp - minVp)) * 100;
  const intercept = minRem - (vwSlope * minVp) / 100;

  const value: FluidTypeValue = {
    min: `${minRem.toFixed(3)}rem`,
    max: `${maxRem.toFixed(3)}rem`,
    clamp: `clamp(${minRem.toFixed(3)}rem, ${intercept.toFixed(3)}rem + ${vwSlope.toFixed(3)}vw, ${maxRem.toFixed(3)}rem)`,
  };

  return { $value: value, $type: "fontSize" };
}

// =============================================================================
// Spacing Extraction
// =============================================================================

function extractSpacingTokens(
  figmaFile: FigmaFile,
  opts: Required<FigmaExtractorOptions>,
  errors: string[],
  stats: { spacingExtracted: number }
): SpacingTokenGroup {
  const spacingGroup = createDefaultSpacingGroup();
  const spacings: Map<string, number> = new Map();

  // Scan for spacing components/frames
  scanNodeForSpacing(figmaFile.document, spacings, opts.spacingPattern);

  // Map to tokens
  for (const [name, value] of spacings) {
    const match = name.match(opts.spacingPattern);
    if (match) {
      const [, size] = match;
      spacingGroup[size] = { $value: `${value}px`, $type: "dimension" };
      stats.spacingExtracted++;
    }
  }

  return spacingGroup;
}

function scanNodeForSpacing(
  node: FigmaNode,
  spacings: Map<string, number>,
  pattern: RegExp
): void {
  if (pattern.test(node.name) && node.absoluteBoundingBox) {
    // Use width as the spacing value
    spacings.set(node.name, node.absoluteBoundingBox.width);
  }

  if (node.children) {
    for (const child of node.children) {
      scanNodeForSpacing(child, spacings, pattern);
    }
  }
}

// =============================================================================
// Shadow Extraction
// =============================================================================

function extractShadowTokens(
  figmaFile: FigmaFile,
  opts: Required<FigmaExtractorOptions>,
  errors: string[],
  stats: { shadowsExtracted: number }
): ShadowTokenGroup {
  const shadowGroup = createDefaultShadowGroup();
  const shadows: Map<string, ShadowLayerValue[]> = new Map();

  // Extract from effect styles
  for (const [styleId, style] of Object.entries(figmaFile.styles)) {
    if (style.styleType !== "EFFECT") continue;

    const nodesWithStyle = findNodesWithStyle(figmaFile.document, styleId);

    for (const node of nodesWithStyle) {
      if (!node.effects?.length) continue;

      const layers: ShadowLayerValue[] = [];

      for (const effect of node.effects) {
        if ((effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") && effect.visible !== false) {
          layers.push({
            offsetX: `${effect.offset?.x || 0}px`,
            offsetY: `${effect.offset?.y || 0}px`,
            blur: `${effect.radius || 0}px`,
            spread: `${effect.spread || 0}px`,
            color: effect.color ? figmaColorToRgba(effect.color) : "rgba(0,0,0,0.1)",
          });
        }
      }

      if (layers.length > 0) {
        shadows.set(style.name, layers);
        stats.shadowsExtracted++;
      }
    }
  }

  // Map to shadow tokens by name pattern
  for (const [name, layers] of shadows) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("xs") || lowerName.includes("extra-small")) {
      shadowGroup.xs.$value = layers;
    } else if (lowerName.includes("sm") || lowerName.includes("small")) {
      shadowGroup.sm.$value = layers;
    } else if (lowerName.includes("lg") || lowerName.includes("large")) {
      shadowGroup.lg.$value = layers;
    } else if (lowerName.includes("xl") || lowerName.includes("extra-large")) {
      shadowGroup.xl.$value = layers;
    } else {
      shadowGroup.md.$value = layers;
    }
  }

  return shadowGroup;
}

// =============================================================================
// Border Radius Extraction
// =============================================================================

function extractBorderRadiusTokens(
  figmaFile: FigmaFile,
  opts: Required<FigmaExtractorOptions>,
  errors: string[]
): BorderRadiusTokenGroup {
  const brGroup = createDefaultBorderRadiusGroup();
  const radii: Map<string, number> = new Map();

  // Scan for components with border radius
  scanNodeForBorderRadius(figmaFile.document, radii);

  // Map to tokens
  const sortedRadii = Array.from(radii.values()).sort((a, b) => a - b);

  if (sortedRadii.length >= 1) brGroup.sm.$value = `${sortedRadii[0]}px`;
  if (sortedRadii.length >= 2) brGroup.md.$value = `${sortedRadii[1]}px`;
  if (sortedRadii.length >= 3) brGroup.lg.$value = `${sortedRadii[2]}px`;
  if (sortedRadii.length >= 4) brGroup.xl.$value = `${sortedRadii[3]}px`;

  return brGroup;
}

function scanNodeForBorderRadius(node: FigmaNode, radii: Map<string, number>): void {
  if (node.cornerRadius && node.cornerRadius > 0) {
    radii.set(node.name, node.cornerRadius);
  }

  if (node.children) {
    for (const child of node.children) {
      scanNodeForBorderRadius(child, radii);
    }
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function findNodesWithStyle(root: FigmaNode, styleId: string): FigmaNode[] {
  const results: FigmaNode[] = [];

  function traverse(node: FigmaNode): void {
    // Check if node has the style
    const nodeStyles = (node as { styles?: Record<string, string> }).styles;
    if (nodeStyles && Object.values(nodeStyles).includes(styleId)) {
      results.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(root);
  return results;
}

function figmaColorToHex(color: FigmaColor, opacity?: number): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = opacity ?? color.a;

  if (a < 1) {
    const alpha = Math.round(a * 255);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${alpha.toString(16).padStart(2, "0")}`;
  }

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function figmaColorToRgba(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r},${g},${b},${color.a.toFixed(2)})`;
}

function createColorTokenValue(hex: string): ColorTokenValue {
  return {
    hex,
    oklch: hexToOklch(hex) || { l: 0, c: 0, h: 0 },
  };
}

// =============================================================================
// Default Token Group Factories
// =============================================================================

function createDefaultColorScale(baseHex: string): ColorScaleToken {
  const value = createColorTokenValue(baseHex);
  const step = (): ColorScaleStep => ({ $value: value, $type: "color" });

  return {
    $type: "color",
    "50": step(),
    "100": step(),
    "200": step(),
    "300": step(),
    "400": step(),
    "500": step(),
    "600": step(),
    "700": step(),
    "800": step(),
    "900": step(),
    "950": step(),
  };
}

function createDefaultColorGroup(): ColorTokenGroup {
  return {
    $type: "color",
    primary: createDefaultColorScale("#6366f1"),
    secondary: createDefaultColorScale("#8b5cf6"),
    accent: createDefaultColorScale("#ec4899"),
    background: { $value: createColorTokenValue("#ffffff"), $type: "color" },
    text: { $value: createColorTokenValue("#1f2937"), $type: "color" },
    error: createDefaultColorScale("#ef4444"),
    warning: createDefaultColorScale("#f59e0b"),
    success: createDefaultColorScale("#22c55e"),
    info: createDefaultColorScale("#3b82f6"),
  };
}

function createDefaultTypographyGroup(): TypographyTokenGroup {
  const fluidSize = (base: number): FluidFontSizeToken => createFluidFontSize(base, 320, 1280);

  return {
    $type: "typography",
    fontFamily: {
      $type: "fontFamily",
      heading: { $value: "Inter, sans-serif", $type: "fontFamily" },
      body: { $value: "Inter, sans-serif", $type: "fontFamily" },
      mono: { $value: "JetBrains Mono, monospace", $type: "fontFamily" },
    },
    fontWeight: {
      $type: "fontWeight",
      light: { $value: 300, $type: "fontWeight" },
      normal: { $value: 400, $type: "fontWeight" },
      medium: { $value: 500, $type: "fontWeight" },
      semibold: { $value: 600, $type: "fontWeight" },
      bold: { $value: 700, $type: "fontWeight" },
      extrabold: { $value: 800, $type: "fontWeight" },
    },
    fontSize: {
      $type: "fontSize",
      xs: fluidSize(12),
      sm: fluidSize(14),
      base: fluidSize(16),
      lg: fluidSize(18),
      xl: fluidSize(20),
      "2xl": fluidSize(24),
      "3xl": fluidSize(30),
      "4xl": fluidSize(36),
    },
    lineHeight: {
      $type: "lineHeight",
      tight: { $value: 1.25, $type: "lineHeight" },
      snug: { $value: 1.375, $type: "lineHeight" },
      normal: { $value: 1.5, $type: "lineHeight" },
      relaxed: { $value: 1.625, $type: "lineHeight" },
      loose: { $value: 2, $type: "lineHeight" },
    },
    letterSpacing: {
      $type: "letterSpacing",
      tighter: { $value: "-0.05em", $type: "letterSpacing" },
      tight: { $value: "-0.025em", $type: "letterSpacing" },
      normal: { $value: "0em", $type: "letterSpacing" },
      wide: { $value: "0.025em", $type: "letterSpacing" },
      wider: { $value: "0.05em", $type: "letterSpacing" },
    },
  };
}

function createDefaultSpacingGroup(): SpacingTokenGroup {
  return {
    $type: "dimension",
    "0": { $value: "0px", $type: "dimension" },
    "1": { $value: "4px", $type: "dimension" },
    "2": { $value: "8px", $type: "dimension" },
    "3": { $value: "12px", $type: "dimension" },
    "4": { $value: "16px", $type: "dimension" },
    "5": { $value: "20px", $type: "dimension" },
    "6": { $value: "24px", $type: "dimension" },
    "8": { $value: "32px", $type: "dimension" },
    "10": { $value: "40px", $type: "dimension" },
    "12": { $value: "48px", $type: "dimension" },
    "16": { $value: "64px", $type: "dimension" },
    "20": { $value: "80px", $type: "dimension" },
    "24": { $value: "96px", $type: "dimension" },
  };
}

function createDefaultBorderRadiusGroup(): BorderRadiusTokenGroup {
  return {
    $type: "dimension",
    none: { $value: "0px", $type: "dimension" },
    sm: { $value: "4px", $type: "dimension" },
    md: { $value: "8px", $type: "dimension" },
    lg: { $value: "12px", $type: "dimension" },
    xl: { $value: "16px", $type: "dimension" },
    "2xl": { $value: "24px", $type: "dimension" },
    full: { $value: "9999px", $type: "dimension" },
  };
}

function createDefaultShadowGroup(): ShadowTokenGroup {
  const defaultLayer: ShadowLayerValue[] = [
    { offsetX: "0px", offsetY: "1px", blur: "2px", spread: "0px", color: "rgba(0,0,0,0.05)" },
  ];

  return {
    $type: "shadow",
    xs: { $value: [{ offsetX: "0px", offsetY: "1px", blur: "2px", spread: "0px", color: "rgba(0,0,0,0.05)" }], $type: "shadow" },
    sm: { $value: [{ offsetX: "0px", offsetY: "1px", blur: "3px", spread: "0px", color: "rgba(0,0,0,0.1)" }], $type: "shadow" },
    md: { $value: [{ offsetX: "0px", offsetY: "4px", blur: "6px", spread: "-1px", color: "rgba(0,0,0,0.1)" }], $type: "shadow" },
    lg: { $value: [{ offsetX: "0px", offsetY: "10px", blur: "15px", spread: "-3px", color: "rgba(0,0,0,0.1)" }], $type: "shadow" },
    xl: { $value: [{ offsetX: "0px", offsetY: "20px", blur: "25px", spread: "-5px", color: "rgba(0,0,0,0.1)" }], $type: "shadow" },
  };
}

function createDefaultAnimationGroup(): AnimationTokenGroup {
  return {
    duration: {
      $type: "duration",
      fast: { $value: "150ms", $type: "duration" },
      normal: { $value: "300ms", $type: "duration" },
      slow: { $value: "500ms", $type: "duration" },
    },
    easing: {
      $type: "cubicBezier",
      easeIn: { $value: [0.4, 0, 1, 1], $type: "cubicBezier" },
      easeOut: { $value: [0, 0, 0.2, 1], $type: "cubicBezier" },
      easeInOut: { $value: [0.4, 0, 0.2, 1], $type: "cubicBezier" },
      spring: { $value: [0.175, 0.885, 0.32, 1.275], $type: "cubicBezier" },
    },
  };
}

function createDefaultBreakpointGroup(): BreakpointTokenGroup {
  return {
    $type: "dimension",
    sm: { $value: "640px", $type: "dimension" },
    md: { $value: "768px", $type: "dimension" },
    lg: { $value: "1024px", $type: "dimension" },
    xl: { $value: "1280px", $type: "dimension" },
    "2xl": { $value: "1536px", $type: "dimension" },
  };
}

// =============================================================================
// Export to .tokens.json
// =============================================================================

/**
 * Export tokens to DTCG .tokens.json format
 */
export function exportToTokensJson(tokenSet: DesignTokenSet): string {
  return toDtcgJsonString(tokenSet);
}

/**
 * Parse a .tokens.json file
 */
export function parseTokensJson(json: string): DesignTokenSet | null {
  try {
    const parsed = JSON.parse(json);
    return fromDtcgJson(parsed);
  } catch {
    return null;
  }
}

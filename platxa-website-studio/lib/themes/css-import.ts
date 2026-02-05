/**
 * CSS Import Functionality
 *
 * Parses CSS/SCSS files and extracts colors, fonts, spacing, and other
 * design tokens into a ThemeTemplate structure.
 *
 * Feature #67: Theme System - CSS import functionality
 */

import type {
  ThemeTemplate,
  ThemeCategory,
  ColorScheme,
  Typography,
  Spacing,
  LayoutOptions,
} from "./theme-registry";

// =============================================================================
// Types
// =============================================================================

/** Extracted color from CSS */
export interface ExtractedColor {
  /** Original CSS property name */
  property: string;
  /** Color value (hex, rgb, hsl, etc.) */
  value: string;
  /** Normalized hex value */
  hex: string;
  /** Selector where color was found */
  selector: string;
  /** Semantic role inference */
  role?: "primary" | "secondary" | "background" | "text" | "border" | "accent";
}

/** Extracted font from CSS */
export interface ExtractedFont {
  /** Font family string */
  family: string;
  /** Parsed font names */
  names: string[];
  /** Usage context */
  context: "heading" | "body" | "code" | "unknown";
  /** Associated selectors */
  selectors: string[];
}

/** Extracted spacing value */
export interface ExtractedSpacing {
  /** CSS property */
  property: string;
  /** Value with unit */
  value: string;
  /** Numeric value in pixels */
  pixels: number;
  /** Selector where found */
  selector: string;
}

/** CSS import result */
export interface CSSImportResult {
  /** Successfully parsed */
  success: boolean;
  /** Generated theme template */
  theme: Partial<ThemeTemplate>;
  /** Extracted colors */
  colors: ExtractedColor[];
  /** Extracted fonts */
  fonts: ExtractedFont[];
  /** Extracted spacing values */
  spacing: ExtractedSpacing[];
  /** CSS variables found */
  cssVariables: Map<string, string>;
  /** Warnings during parsing */
  warnings: string[];
  /** Parsing statistics */
  stats: {
    totalRules: number;
    colorsFound: number;
    fontsFound: number;
    variablesFound: number;
  };
}

/** CSS import options */
export interface CSSImportOptions {
  /** Theme name (will be inferred if not provided) */
  name?: string;
  /** Theme category */
  category?: ThemeCategory;
  /** Prefer CSS variables over inline values */
  preferVariables?: boolean;
  /** Include media queries */
  includeMediaQueries?: boolean;
  /** Custom color mapping */
  colorMapping?: Record<string, keyof ColorScheme>;
}

// =============================================================================
// Color Parsing Utilities
// =============================================================================

/** Color formats regex patterns */
const COLOR_PATTERNS = {
  hex6: /^#([0-9a-f]{6})$/i,
  hex3: /^#([0-9a-f]{3})$/i,
  hex8: /^#([0-9a-f]{8})$/i,
  rgb: /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i,
  rgba: /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9.]+)\s*\)$/i,
  hsl: /^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/i,
  hsla: /^hsla\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*([0-9.]+)\s*\)$/i,
  oklch: /^oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/i,
};

/**
 * Parse any color format to hex
 */
function parseColorToHex(value: string): string | null {
  const trimmed = value.trim().toLowerCase();

  // Named colors mapping (common ones)
  const namedColors: Record<string, string> = {
    white: "#ffffff",
    black: "#000000",
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    transparent: "#00000000",
  };

  if (namedColors[trimmed]) {
    return namedColors[trimmed];
  }

  // Hex (6 digits)
  const hex6Match = trimmed.match(COLOR_PATTERNS.hex6);
  if (hex6Match) {
    return `#${hex6Match[1]}`;
  }

  // Hex (3 digits) -> expand to 6
  const hex3Match = trimmed.match(COLOR_PATTERNS.hex3);
  if (hex3Match) {
    const [, hex] = hex3Match;
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }

  // Hex (8 digits with alpha) -> strip alpha
  const hex8Match = trimmed.match(COLOR_PATTERNS.hex8);
  if (hex8Match) {
    return `#${hex8Match[1].slice(0, 6)}`;
  }

  // RGB
  const rgbMatch = trimmed.match(COLOR_PATTERNS.rgb);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // RGBA -> strip alpha
  const rgbaMatch = trimmed.match(COLOR_PATTERNS.rgba);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // HSL
  const hslMatch = trimmed.match(COLOR_PATTERNS.hsl);
  if (hslMatch) {
    return hslToHex(
      parseInt(hslMatch[1], 10),
      parseInt(hslMatch[2], 10),
      parseInt(hslMatch[3], 10)
    );
  }

  // HSLA -> strip alpha
  const hslaMatch = trimmed.match(COLOR_PATTERNS.hsla);
  if (hslaMatch) {
    return hslToHex(
      parseInt(hslaMatch[1], 10),
      parseInt(hslaMatch[2], 10),
      parseInt(hslaMatch[3], 10)
    );
  }

  return null;
}

/**
 * Convert HSL to hex
 */
function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Get color luminance (0-1)
 */
function getColorLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;

  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/**
 * Infer color role from property name and selector
 */
function inferColorRole(
  property: string,
  selector: string,
  hex: string
): ExtractedColor["role"] {
  const propLower = property.toLowerCase();
  const selectorLower = selector.toLowerCase();

  // Background colors
  if (propLower.includes("background")) {
    const luminance = getColorLuminance(hex);
    if (luminance > 0.9 || luminance < 0.1) {
      return "background";
    }
  }

  // Text colors
  if (propLower === "color") {
    if (
      selectorLower.includes("body") ||
      selectorLower === ":root" ||
      selectorLower === "html"
    ) {
      return "text";
    }
  }

  // Border colors
  if (propLower.includes("border")) {
    return "border";
  }

  // Primary indicators
  if (
    selectorLower.includes("primary") ||
    selectorLower.includes("btn-primary") ||
    selectorLower.includes(".primary") ||
    propLower.includes("primary")
  ) {
    return "primary";
  }

  // Secondary indicators
  if (
    selectorLower.includes("secondary") ||
    selectorLower.includes("btn-secondary") ||
    selectorLower.includes(".secondary") ||
    propLower.includes("secondary")
  ) {
    return "secondary";
  }

  // Accent indicators
  if (
    selectorLower.includes("accent") ||
    selectorLower.includes("highlight") ||
    propLower.includes("accent")
  ) {
    return "accent";
  }

  return undefined;
}

// =============================================================================
// CSS Parsing Utilities
// =============================================================================

/** CSS rule representation */
interface CSSRule {
  selector: string;
  properties: Map<string, string>;
}

/**
 * Parse CSS text into rules
 */
function parseCSSRules(css: string): CSSRule[] {
  const rules: CSSRule[] = [];

  // Remove comments
  let cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove SCSS-specific syntax for basic parsing
  cleaned = cleaned.replace(/@import\s+[^;]+;/g, "");
  cleaned = cleaned.replace(/@mixin\s+[\w-]+\s*\{[^}]*\}/g, "");
  cleaned = cleaned.replace(/@include\s+[^;]+;/g, "");
  cleaned = cleaned.replace(/\$[\w-]+\s*:\s*[^;]+;/g, "");

  // Parse rule blocks
  const ruleRegex = /([^{]+)\{([^}]*)\}/g;
  let match;

  while ((match = ruleRegex.exec(cleaned)) !== null) {
    const selector = match[1].trim();
    const body = match[2].trim();

    // Skip at-rules (except :root)
    if (selector.startsWith("@") && !selector.includes(":root")) {
      continue;
    }

    const properties = new Map<string, string>();

    // Parse properties
    const propRegex = /([\w-]+)\s*:\s*([^;]+);?/g;
    let propMatch;

    while ((propMatch = propRegex.exec(body)) !== null) {
      const prop = propMatch[1].trim();
      const value = propMatch[2].trim();
      properties.set(prop, value);
    }

    if (properties.size > 0) {
      rules.push({ selector, properties });
    }
  }

  return rules;
}

/**
 * Extract CSS custom properties (variables)
 */
function extractCSSVariables(css: string): Map<string, string> {
  const variables = new Map<string, string>();

  // Match :root or html selector with CSS variables
  const rootRegex = /(?::root|html)\s*\{([^}]+)\}/g;
  let match;

  while ((match = rootRegex.exec(css)) !== null) {
    const body = match[1];
    const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
    let varMatch;

    while ((varMatch = varRegex.exec(body)) !== null) {
      variables.set(`--${varMatch[1]}`, varMatch[2].trim());
    }
  }

  return variables;
}

/**
 * Resolve CSS variable reference
 */
function resolveVariable(
  value: string,
  variables: Map<string, string>
): string {
  const varMatch = value.match(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\s*\)/);
  if (!varMatch) return value;

  const varName = varMatch[1];
  const fallback = varMatch[2];

  const resolved = variables.get(varName);
  if (resolved) {
    // Recursively resolve nested variables
    return resolveVariable(resolved, variables);
  }

  return fallback || value;
}

// =============================================================================
// Extraction Functions
// =============================================================================

/**
 * Extract colors from CSS rules
 */
function extractColors(
  rules: CSSRule[],
  variables: Map<string, string>
): ExtractedColor[] {
  const colors: ExtractedColor[] = [];
  const colorProperties = [
    "color",
    "background-color",
    "background",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "fill",
    "stroke",
    "caret-color",
    "accent-color",
  ];

  for (const rule of rules) {
    for (const [prop, rawValue] of rule.properties) {
      if (!colorProperties.includes(prop)) continue;

      // Resolve variables
      const value = resolveVariable(rawValue, variables);

      // Parse color
      const hex = parseColorToHex(value);
      if (!hex) continue;

      const role = inferColorRole(prop, rule.selector, hex);

      colors.push({
        property: prop,
        value: rawValue,
        hex,
        selector: rule.selector,
        role,
      });
    }
  }

  // Also extract colors from CSS variables
  for (const [name, value] of variables) {
    if (
      name.includes("color") ||
      name.includes("bg") ||
      name.includes("text") ||
      name.includes("border")
    ) {
      const hex = parseColorToHex(value);
      if (hex) {
        const role = inferColorRole(name, ":root", hex);
        colors.push({
          property: name,
          value,
          hex,
          selector: ":root",
          role,
        });
      }
    }
  }

  return colors;
}

/**
 * Extract fonts from CSS rules
 */
function extractFonts(
  rules: CSSRule[],
  variables: Map<string, string>
): ExtractedFont[] {
  const fontMap = new Map<string, ExtractedFont>();

  for (const rule of rules) {
    const fontFamily =
      rule.properties.get("font-family") || rule.properties.get("font");

    if (!fontFamily) continue;

    // Resolve variables
    const resolved = resolveVariable(fontFamily, variables);

    // Parse font family
    const families = resolved
      .split(",")
      .map((f) => f.trim().replace(/['"]/g, ""))
      .filter((f) => f && !["sans-serif", "serif", "monospace", "inherit", "initial"].includes(f.toLowerCase()));

    if (families.length === 0) continue;

    const key = families.join(",");
    const existing = fontMap.get(key);

    // Determine context
    let context: ExtractedFont["context"] = "unknown";
    const selectorLower = rule.selector.toLowerCase();

    if (
      selectorLower.match(/^h[1-6]/) ||
      selectorLower.includes("heading") ||
      selectorLower.includes("title")
    ) {
      context = "heading";
    } else if (
      selectorLower.includes("body") ||
      selectorLower === "html" ||
      selectorLower === ":root" ||
      selectorLower.includes("p") ||
      selectorLower.includes("text")
    ) {
      context = "body";
    } else if (
      selectorLower.includes("code") ||
      selectorLower.includes("pre") ||
      selectorLower.includes("mono")
    ) {
      context = "code";
    }

    if (existing) {
      existing.selectors.push(rule.selector);
      // Upgrade context if more specific
      if (existing.context === "unknown" && context !== "unknown") {
        existing.context = context;
      }
    } else {
      fontMap.set(key, {
        family: resolved,
        names: families,
        context,
        selectors: [rule.selector],
      });
    }
  }

  return Array.from(fontMap.values());
}

/**
 * Extract spacing values from CSS rules
 */
function extractSpacing(
  rules: CSSRule[],
  variables: Map<string, string>
): ExtractedSpacing[] {
  const spacing: ExtractedSpacing[] = [];
  const spacingProperties = [
    "padding",
    "padding-top",
    "padding-bottom",
    "margin",
    "margin-top",
    "margin-bottom",
    "gap",
    "row-gap",
    "column-gap",
    "border-radius",
    "max-width",
  ];

  for (const rule of rules) {
    for (const [prop, rawValue] of rule.properties) {
      if (!spacingProperties.includes(prop)) continue;

      const value = resolveVariable(rawValue, variables);

      // Parse to pixels (approximate for rem/em)
      let pixels = 0;
      const pxMatch = value.match(/^(\d+(?:\.\d+)?)\s*px/);
      const remMatch = value.match(/^(\d+(?:\.\d+)?)\s*rem/);
      const emMatch = value.match(/^(\d+(?:\.\d+)?)\s*em/);

      if (pxMatch) {
        pixels = parseFloat(pxMatch[1]);
      } else if (remMatch) {
        pixels = parseFloat(remMatch[1]) * 16; // Assume 16px base
      } else if (emMatch) {
        pixels = parseFloat(emMatch[1]) * 16;
      }

      if (pixels > 0) {
        spacing.push({
          property: prop,
          value: rawValue,
          pixels,
          selector: rule.selector,
        });
      }
    }
  }

  return spacing;
}

// =============================================================================
// Theme Building
// =============================================================================

/**
 * Build ColorScheme from extracted colors
 */
function buildColorScheme(colors: ExtractedColor[]): ColorScheme {
  const scheme: ColorScheme = {
    primary: "#3b82f6",
    secondary: "#6366f1",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#1e293b",
    textMuted: "#64748b",
    border: "#e2e8f0",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
  };

  // Group by role
  const byRole = new Map<string, ExtractedColor[]>();
  for (const color of colors) {
    if (color.role) {
      const existing = byRole.get(color.role) || [];
      existing.push(color);
      byRole.set(color.role, existing);
    }
  }

  // Assign colors by role (prefer first found)
  const primary = byRole.get("primary")?.[0];
  if (primary) scheme.primary = primary.hex;

  const secondary = byRole.get("secondary")?.[0];
  if (secondary) scheme.secondary = secondary.hex;

  const background = byRole.get("background")?.[0];
  if (background) scheme.background = background.hex;

  const text = byRole.get("text")?.[0];
  if (text) scheme.text = text.hex;

  const border = byRole.get("border")?.[0];
  if (border) scheme.border = border.hex;

  // Infer surface from background
  if (background) {
    const lum = getColorLuminance(background.hex);
    if (lum > 0.5) {
      // Light theme - surface slightly darker
      scheme.surface = adjustLightness(background.hex, -5);
    } else {
      // Dark theme - surface slightly lighter
      scheme.surface = adjustLightness(background.hex, 5);
    }
  }

  // Infer text muted from text
  if (text) {
    scheme.textMuted = adjustLightness(text.hex, 30);
  }

  // Look for success/warning/error by variable name
  for (const color of colors) {
    const name = color.property.toLowerCase();
    if (name.includes("success") || name.includes("green")) {
      scheme.success = color.hex;
    } else if (name.includes("warning") || name.includes("yellow") || name.includes("orange")) {
      scheme.warning = color.hex;
    } else if (name.includes("error") || name.includes("danger") || name.includes("red")) {
      scheme.error = color.hex;
    }
  }

  return scheme;
}

/**
 * Adjust color lightness
 */
function adjustLightness(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const adjust = (v: number) => Math.max(0, Math.min(255, v + amount * 2.55));

  const r = adjust(rgb.r);
  const g = adjust(rgb.g);
  const b = adjust(rgb.b);

  return `#${Math.round(r).toString(16).padStart(2, "0")}${Math.round(g).toString(16).padStart(2, "0")}${Math.round(b).toString(16).padStart(2, "0")}`;
}

/**
 * Build Typography from extracted fonts
 */
function buildTypography(
  fonts: ExtractedFont[],
  rules: CSSRule[],
  variables: Map<string, string>
): Typography {
  const typography: Typography = {
    headingFont: "Inter, sans-serif",
    bodyFont: "Inter, sans-serif",
    baseFontSize: "16px",
    lineHeight: "1.6",
    headingWeight: "700",
  };

  // Find heading and body fonts
  const headingFont = fonts.find((f) => f.context === "heading");
  const bodyFont = fonts.find((f) => f.context === "body");

  if (headingFont) {
    typography.headingFont = headingFont.family;
  }

  if (bodyFont) {
    typography.bodyFont = bodyFont.family;
  } else if (fonts.length > 0) {
    // Use first font as body if no explicit body font
    typography.bodyFont = fonts[0].family;
  }

  // Extract font-size and line-height from body/html/root
  for (const rule of rules) {
    const selectorLower = rule.selector.toLowerCase();
    if (
      selectorLower.includes("body") ||
      selectorLower === "html" ||
      selectorLower === ":root"
    ) {
      const fontSize = rule.properties.get("font-size");
      if (fontSize) {
        typography.baseFontSize = resolveVariable(fontSize, variables);
      }

      const lineHeight = rule.properties.get("line-height");
      if (lineHeight) {
        typography.lineHeight = resolveVariable(lineHeight, variables);
      }
    }

    // Extract heading weight
    if (selectorLower.match(/^h[1-6]/)) {
      const fontWeight = rule.properties.get("font-weight");
      if (fontWeight) {
        typography.headingWeight = resolveVariable(fontWeight, variables);
      }
    }
  }

  return typography;
}

/**
 * Build Spacing from extracted values
 */
function buildSpacing(spacingValues: ExtractedSpacing[]): Spacing {
  const spacing: Spacing = {
    sectionPadding: "80px",
    containerWidth: "1280px",
    gap: "24px",
    borderRadius: "8px",
  };

  // Find section padding (large padding values)
  const largePadding = spacingValues
    .filter((s) => s.property.includes("padding") && s.pixels >= 40)
    .sort((a, b) => b.pixels - a.pixels)[0];

  if (largePadding) {
    spacing.sectionPadding = largePadding.value;
  }

  // Find container width
  const maxWidth = spacingValues.find((s) => s.property === "max-width");
  if (maxWidth) {
    spacing.containerWidth = maxWidth.value;
  }

  // Find gap
  const gap = spacingValues.find((s) => s.property === "gap");
  if (gap) {
    spacing.gap = gap.value;
  }

  // Find border radius
  const borderRadius = spacingValues.find((s) =>
    s.property.includes("border-radius")
  );
  if (borderRadius) {
    spacing.borderRadius = borderRadius.value;
  }

  return spacing;
}

/**
 * Build LayoutOptions from CSS rules
 */
function buildLayoutOptions(rules: CSSRule[]): LayoutOptions {
  const layout: LayoutOptions = {
    headerStyle: "sticky",
    navStyle: "horizontal",
    footerColumns: 4,
  };

  for (const rule of rules) {
    const selectorLower = rule.selector.toLowerCase();

    // Detect header style
    if (selectorLower.includes("header") || selectorLower.includes("nav")) {
      const position = rule.properties.get("position");
      if (position === "fixed") {
        layout.headerStyle = "fixed";
      } else if (position === "sticky") {
        layout.headerStyle = "sticky";
      } else if (position === "static" || position === "relative") {
        layout.headerStyle = "static";
      }
    }

    // Detect nav style
    if (selectorLower.includes("nav")) {
      const flexDirection = rule.properties.get("flex-direction");
      if (flexDirection === "column") {
        layout.navStyle = "vertical";
      }
    }
  }

  return layout;
}

// =============================================================================
// Main Import Function
// =============================================================================

/**
 * Import CSS file and extract theme
 *
 * @example
 * ```typescript
 * const css = await fs.readFile("styles.css", "utf-8");
 * const result = importCSSTheme(css, { name: "My Theme" });
 *
 * if (result.success) {
 *   console.log("Colors found:", result.colors.length);
 *   console.log("Theme:", result.theme);
 * }
 * ```
 */
export function importCSSTheme(
  css: string,
  options: CSSImportOptions = {}
): CSSImportResult {
  const warnings: string[] = [];

  try {
    // Extract CSS variables first
    const cssVariables = extractCSSVariables(css);

    // Parse CSS rules
    const rules = parseCSSRules(css);

    if (rules.length === 0) {
      warnings.push("No CSS rules found in the input");
    }

    // Extract design tokens
    const colors = extractColors(rules, cssVariables);
    const fonts = extractFonts(rules, cssVariables);
    const spacingValues = extractSpacing(rules, cssVariables);

    // Build theme components
    const colorScheme = buildColorScheme(colors);
    const typography = buildTypography(fonts, rules, cssVariables);
    const spacing = buildSpacing(spacingValues);
    const layout = buildLayoutOptions(rules);

    // Infer theme name from CSS if not provided
    let name = options.name || "Imported Theme";

    // Look for theme name in comments
    const nameMatch = css.match(/\/\*\s*Theme:\s*([^\n*]+)/i);
    if (nameMatch && !options.name) {
      name = nameMatch[1].trim();
    }

    // Build partial theme template
    const theme: Partial<ThemeTemplate> = {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      description: `Imported from CSS stylesheet`,
      category: options.category || "minimal",
      tags: ["imported", "custom"],
      colors: colorScheme,
      typography,
      spacing,
      layout,
      isPremium: false,
      version: "1.0.0",
      author: "Imported",
      updatedAt: new Date(),
      odooVersion: "17.0",
      previewImage: "",
      thumbnail: "",
    };

    return {
      success: true,
      theme,
      colors,
      fonts,
      spacing: spacingValues,
      cssVariables,
      warnings,
      stats: {
        totalRules: rules.length,
        colorsFound: colors.length,
        fontsFound: fonts.length,
        variablesFound: cssVariables.size,
      },
    };
  } catch (error) {
    warnings.push(
      `Parsing error: ${error instanceof Error ? error.message : "Unknown error"}`
    );

    return {
      success: false,
      theme: {},
      colors: [],
      fonts: [],
      spacing: [],
      cssVariables: new Map(),
      warnings,
      stats: {
        totalRules: 0,
        colorsFound: 0,
        fontsFound: 0,
        variablesFound: 0,
      },
    };
  }
}

/**
 * Import CSS from file content (for browser upload)
 */
export async function importCSSFromFile(
  file: File,
  options?: CSSImportOptions
): Promise<CSSImportResult> {
  const text = await file.text();
  return importCSSTheme(text, {
    ...options,
    name: options?.name || file.name.replace(/\.(css|scss)$/, ""),
  });
}

/**
 * Merge imported theme with existing theme
 */
export function mergeWithExistingTheme(
  existing: ThemeTemplate,
  imported: Partial<ThemeTemplate>
): ThemeTemplate {
  return {
    ...existing,
    colors: {
      ...existing.colors,
      ...imported.colors,
    },
    typography: {
      ...existing.typography,
      ...imported.typography,
    },
    spacing: {
      ...existing.spacing,
      ...imported.spacing,
    },
    layout: {
      ...existing.layout,
      ...imported.layout,
    },
    updatedAt: new Date(),
  };
}

// =============================================================================
// Export
// =============================================================================

export default {
  importCSSTheme,
  importCSSFromFile,
  mergeWithExistingTheme,
  parseColorToHex,
};

/**
 * Live Font Preview — Dynamic Google Font Loading and Preview
 *
 * Manages loading Google Fonts via link tags and applying font
 * changes to preview elements with minimal latency.
 */

// =============================================================================
// Types
// =============================================================================

/** A font token representing a design system font assignment */
export interface FontToken {
  /** Token name (e.g. "heading", "body") */
  name: string;
  /** Google Font family name */
  family: string;
  /** Font weights to load */
  weights: number[];
  /** CSS variable name (e.g. "--font-heading") */
  cssVariable: string;
}

/** State of a font load operation */
export type FontLoadStatus = "idle" | "loading" | "loaded" | "error";

/** Tracked font load entry */
export interface FontLoadEntry {
  /** Font family name */
  family: string;
  /** Current load status */
  status: FontLoadStatus;
  /** Generated link tag href */
  href: string;
  /** ISO timestamp of status change */
  updatedAt: string;
  /** Error message if status is error */
  error?: string;
}

/** Font preview manager state */
export interface FontPreviewState {
  /** Currently tracked font loads */
  fonts: Map<string, FontLoadEntry>;
  /** Applied CSS variable overrides */
  cssOverrides: Map<string, string>;
}

/** Result of applying a font change */
export interface FontChangeResult {
  /** Updated state */
  state: FontPreviewState;
  /** The link tag href to inject */
  linkHref: string;
  /** CSS variable assignments to apply */
  cssVariables: Record<string, string>;
  /** Whether the font was already loaded */
  alreadyLoaded: boolean;
}

// =============================================================================
// Google Fonts URL Builder
// =============================================================================

const GOOGLE_FONTS_BASE = "https://fonts.googleapis.com/css2";

/**
 * Builds a Google Fonts CSS2 URL for a font family with specified weights.
 * Uses the display=swap strategy for performance.
 */
export function buildGoogleFontsUrl(family: string, weights: number[] = [400, 700]): string {
  const encoded = family.replace(/\s+/g, "+");
  const sortedWeights = [...weights].sort((a, b) => a - b);
  const weightList = sortedWeights.join(";");
  return `${GOOGLE_FONTS_BASE}?family=${encoded}:wght@${weightList}&display=swap`;
}

/**
 * Builds a Google Fonts URL for multiple families.
 */
export function buildMultiFontUrl(fonts: Array<{ family: string; weights: number[] }>): string {
  const families = fonts.map((f) => {
    const encoded = f.family.replace(/\s+/g, "+");
    const sortedWeights = [...f.weights].sort((a, b) => a - b);
    return `family=${encoded}:wght@${sortedWeights.join(";")}`;
  });
  return `${GOOGLE_FONTS_BASE}?${families.join("&")}&display=swap`;
}

/**
 * Generates a <link> tag string for a Google Fonts URL.
 */
export function buildLinkTag(href: string, id?: string): string {
  const idAttr = id ? ` id="${id}"` : "";
  return `<link${idAttr} rel="stylesheet" href="${href}">`;
}

// =============================================================================
// State Management
// =============================================================================

/** Creates a new font preview state. */
export function createFontPreviewState(): FontPreviewState {
  return { fonts: new Map(), cssOverrides: new Map() };
}

/**
 * Applies a font token change, producing the link href and CSS variables needed.
 */
export function applyFontToken(
  state: FontPreviewState,
  token: FontToken,
): FontChangeResult {
  const href = buildGoogleFontsUrl(token.family, token.weights);
  const alreadyLoaded = state.fonts.has(token.family) &&
    state.fonts.get(token.family)!.status === "loaded";

  const fonts = new Map(state.fonts);
  if (!alreadyLoaded) {
    fonts.set(token.family, {
      family: token.family,
      status: "loading",
      href,
      updatedAt: new Date().toISOString(),
    });
  }

  const cssOverrides = new Map(state.cssOverrides);
  const cssValue = `"${token.family}", sans-serif`;
  cssOverrides.set(token.cssVariable, cssValue);

  return {
    state: { fonts, cssOverrides },
    linkHref: href,
    cssVariables: { [token.cssVariable]: cssValue },
    alreadyLoaded,
  };
}

/** Marks a font as successfully loaded. */
export function markFontLoaded(
  state: FontPreviewState,
  family: string,
): FontPreviewState {
  const fonts = new Map(state.fonts);
  const entry = fonts.get(family);
  if (entry) {
    fonts.set(family, { ...entry, status: "loaded", updatedAt: new Date().toISOString() });
  }
  return { ...state, fonts };
}

/** Marks a font load as failed. */
export function markFontError(
  state: FontPreviewState,
  family: string,
  error: string,
): FontPreviewState {
  const fonts = new Map(state.fonts);
  const entry = fonts.get(family);
  if (entry) {
    fonts.set(family, { ...entry, status: "error", error, updatedAt: new Date().toISOString() });
  }
  return { ...state, fonts };
}

// =============================================================================
// Queries
// =============================================================================

/** Returns all fonts currently loading. */
export function getLoadingFonts(state: FontPreviewState): FontLoadEntry[] {
  return Array.from(state.fonts.values()).filter((f) => f.status === "loading");
}

/** Returns all successfully loaded fonts. */
export function getLoadedFonts(state: FontPreviewState): FontLoadEntry[] {
  return Array.from(state.fonts.values()).filter((f) => f.status === "loaded");
}

/** Returns all CSS variable overrides as a style string. */
export function getCssOverrideString(state: FontPreviewState): string {
  const entries = Array.from(state.cssOverrides.entries());
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${v};`).join("\n");
}

/** Returns all currently tracked font families. */
export function getTrackedFamilies(state: FontPreviewState): string[] {
  return Array.from(state.fonts.keys());
}

/** Checks if a specific font family is loaded. */
export function isFontLoaded(state: FontPreviewState, family: string): boolean {
  const entry = state.fonts.get(family);
  return entry != null && entry.status === "loaded";
}

/**
 * Font Validator — Google Fonts Validation & Fallback Chain Generation
 *
 * Validates font names against a known Google Fonts catalog and generates
 * proper CSS fallback chains including generic family keywords.
 */

// =============================================================================
// Types
// =============================================================================

/** Font classification */
export type FontCategory = "serif" | "sans-serif" | "display" | "handwriting" | "monospace";

/** A validated font entry */
export interface ValidatedFont {
  /** Original requested name */
  requested: string;
  /** Resolved name (may differ in casing) */
  resolved: string;
  /** Whether the font was found in the catalog */
  isValid: boolean;
  /** Font category */
  category: FontCategory;
  /** Full CSS fallback chain */
  fallbackChain: string;
  /** Google Fonts import URL (null if invalid) */
  importUrl: string | null;
}

/** Result of validating a typography token set */
export interface FontValidationResult {
  /** Heading font validation */
  heading: ValidatedFont;
  /** Body font validation */
  body: ValidatedFont;
  /** Combined Google Fonts import URL */
  combinedImportUrl: string;
  /** All fonts are valid */
  allValid: boolean;
}

/** Font fetcher function (injectable for testing) */
export type FontFetcher = (fontName: string) => Promise<boolean>;

// =============================================================================
// Google Fonts Catalog (commonly used subset)
// =============================================================================

interface CatalogEntry {
  category: FontCategory;
  variants: number[];
}

const GOOGLE_FONTS_CATALOG: Record<string, CatalogEntry> = {
  "Inter": { category: "sans-serif", variants: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  "Roboto": { category: "sans-serif", variants: [100, 300, 400, 500, 700, 900] },
  "Open Sans": { category: "sans-serif", variants: [300, 400, 500, 600, 700, 800] },
  "Lato": { category: "sans-serif", variants: [100, 300, 400, 700, 900] },
  "Montserrat": { category: "sans-serif", variants: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  "Poppins": { category: "sans-serif", variants: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  "Nunito": { category: "sans-serif", variants: [200, 300, 400, 500, 600, 700, 800, 900] },
  "Raleway": { category: "sans-serif", variants: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  "Ubuntu": { category: "sans-serif", variants: [300, 400, 500, 700] },
  "PT Sans": { category: "sans-serif", variants: [400, 700] },
  "Work Sans": { category: "sans-serif", variants: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  "DM Sans": { category: "sans-serif", variants: [400, 500, 700] },
  "Source Sans Pro": { category: "sans-serif", variants: [200, 300, 400, 600, 700, 900] },
  "Manrope": { category: "sans-serif", variants: [200, 300, 400, 500, 600, 700, 800] },
  "Plus Jakarta Sans": { category: "sans-serif", variants: [200, 300, 400, 500, 600, 700, 800] },
  "Outfit": { category: "sans-serif", variants: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  "Space Grotesk": { category: "sans-serif", variants: [300, 400, 500, 600, 700] },
  "Playfair Display": { category: "serif", variants: [400, 500, 600, 700, 800, 900] },
  "Merriweather": { category: "serif", variants: [300, 400, 700, 900] },
  "Lora": { category: "serif", variants: [400, 500, 600, 700] },
  "PT Serif": { category: "serif", variants: [400, 700] },
  "Libre Baskerville": { category: "serif", variants: [400, 700] },
  "Cormorant Garamond": { category: "serif", variants: [300, 400, 500, 600, 700] },
  "EB Garamond": { category: "serif", variants: [400, 500, 600, 700, 800] },
  "Bitter": { category: "serif", variants: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  "Source Serif Pro": { category: "serif", variants: [200, 300, 400, 600, 700, 900] },
  "Fira Code": { category: "monospace", variants: [300, 400, 500, 600, 700] },
  "JetBrains Mono": { category: "monospace", variants: [100, 200, 300, 400, 500, 600, 700, 800] },
  "Source Code Pro": { category: "monospace", variants: [200, 300, 400, 500, 600, 700, 900] },
  "Pacifico": { category: "handwriting", variants: [400] },
  "Dancing Script": { category: "handwriting", variants: [400, 500, 600, 700] },
  "Caveat": { category: "handwriting", variants: [400, 500, 600, 700] },
  "Lobster": { category: "display", variants: [400] },
  "Bebas Neue": { category: "display", variants: [400] },
  "Anton": { category: "display", variants: [400] },
  "Abril Fatface": { category: "display", variants: [400] },
};

// Build case-insensitive lookup
const CATALOG_LOOKUP = new Map<string, [string, CatalogEntry]>();
for (const [name, entry] of Object.entries(GOOGLE_FONTS_CATALOG)) {
  CATALOG_LOOKUP.set(name.toLowerCase(), [name, entry]);
}

// =============================================================================
// Fallback Chains
// =============================================================================

const GENERIC_FALLBACKS: Record<FontCategory, string[]> = {
  "sans-serif": ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
  "serif": ["Georgia", "Cambria", "Times New Roman", "Times", "serif"],
  "monospace": ["SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
  "handwriting": ["cursive"],
  "display": ["sans-serif"],
};

/**
 * Builds a CSS font-family fallback chain.
 */
function buildFallbackChain(fontName: string, category: FontCategory): string {
  const primary = fontName.includes(" ") ? `"${fontName}"` : fontName;
  const fallbacks = GENERIC_FALLBACKS[category];
  const quoted = fallbacks.map((f) =>
    f.includes(" ") && !["sans-serif", "serif", "monospace", "cursive"].includes(f)
      ? `"${f}"` : f
  );
  return [primary, ...quoted].join(", ");
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Looks up a font in the local catalog.
 */
function lookupFont(name: string): [string, CatalogEntry] | null {
  return CATALOG_LOOKUP.get(name.toLowerCase()) ?? null;
}

/**
 * Validates a single font name and produces a ValidatedFont result.
 */
export function validateFont(fontName: string): ValidatedFont {
  const entry = lookupFont(fontName);

  if (entry) {
    const [resolved, catalog] = entry;
    return {
      requested: fontName,
      resolved,
      isValid: true,
      category: catalog.category,
      fallbackChain: buildFallbackChain(resolved, catalog.category),
      importUrl: buildImportUrl(resolved),
    };
  }

  // Unknown font: guess category from name heuristics, mark invalid
  const guessedCategory = guessCategory(fontName);
  return {
    requested: fontName,
    resolved: fontName,
    isValid: false,
    category: guessedCategory,
    fallbackChain: buildFallbackChain(fontName, guessedCategory),
    importUrl: null,
  };
}

/**
 * Validates a heading/body font pair and produces a combined result.
 */
export function validateFontPair(heading: string, body: string): FontValidationResult {
  const h = validateFont(heading);
  const b = validateFont(body);

  const urls: string[] = [];
  if (h.importUrl) urls.push(h.importUrl);
  if (b.importUrl && b.importUrl !== h.importUrl) urls.push(b.importUrl);

  const families = urls.map((u) => {
    const match = u.match(/family=([^&]+)/);
    return match ? match[1] : "";
  }).filter(Boolean);

  const combinedImportUrl = families.length > 0
    ? `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`
    : "";

  return {
    heading: h,
    body: b,
    combinedImportUrl,
    allValid: h.isValid && b.isValid,
  };
}

/**
 * Returns the list of known font names in the catalog.
 */
export function getAvailableFonts(): string[] {
  return Object.keys(GOOGLE_FONTS_CATALOG);
}

/**
 * Returns fonts filtered by category.
 */
export function getFontsByCategory(category: FontCategory): string[] {
  return Object.entries(GOOGLE_FONTS_CATALOG)
    .filter(([, entry]) => entry.category === category)
    .map(([name]) => name);
}

// =============================================================================
// Helpers
// =============================================================================

function buildImportUrl(fontName: string): string {
  const encoded = fontName.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700&display=swap`;
}

function guessCategory(name: string): FontCategory {
  const lower = name.toLowerCase();
  if (/serif/i.test(lower) && !/sans/i.test(lower)) return "serif";
  if (/mono|code/i.test(lower)) return "monospace";
  if (/script|hand|cursive/i.test(lower)) return "handwriting";
  if (/display|decorative/i.test(lower)) return "display";
  return "sans-serif";
}

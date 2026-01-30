/**
 * GoogleFontsSelector — Font selector with live Google Fonts preview.
 *
 * Feature #80: Add font selector with live Google Fonts preview
 * Verification: Dropdown lists available fonts; selection updates typography instantly
 *
 * Provides a curated list of Google Fonts organized by category, with instant
 * preview updates when a font is selected. Integrates with the preview iframe
 * to apply font changes in real-time.
 *
 * @module lib/preview/google-fonts-selector
 */

// =============================================================================
// Types
// =============================================================================

/** Font category classification */
export type FontCategory = "sans-serif" | "serif" | "display" | "handwriting" | "monospace";

/** Font weight variants */
export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** A Google Font entry */
export interface GoogleFont {
  /** Font family name */
  family: string;
  /** Font category */
  category: FontCategory;
  /** Available weight variants */
  weights: FontWeight[];
  /** Sample text preview */
  sampleText?: string;
  /** Whether this is a popular/recommended font */
  popular?: boolean;
}

/** Font selection for a typography role */
export interface FontSelection {
  /** Selected font family */
  family: string;
  /** Selected weights to load */
  weights: FontWeight[];
  /** Typography role (e.g., "heading", "body") */
  role: "heading" | "body" | "accent" | "mono";
}

/** Options for the font selector */
export interface FontSelectorOptions {
  /** Initial heading font */
  headingFont?: string;
  /** Initial body font */
  bodyFont?: string;
  /** Whether to preload popular fonts (default: false) */
  preloadPopular?: boolean;
  /** Custom font list (overrides default catalog) */
  customFonts?: GoogleFont[];
  /** Filter to specific categories */
  categories?: FontCategory[];
}

/** State of the font selector */
export interface FontSelectorState {
  /** Currently selected heading font */
  headingFont: FontSelection;
  /** Currently selected body font */
  bodyFont: FontSelection;
  /** Fonts currently loading */
  loadingFonts: Set<string>;
  /** Fonts successfully loaded */
  loadedFonts: Set<string>;
  /** Load errors by font family */
  loadErrors: Map<string, string>;
}

/** Result of applying a font selection */
export interface FontApplyResult {
  /** Whether the apply succeeded */
  success: boolean;
  /** Google Fonts CSS URL to inject */
  cssUrl: string;
  /** CSS variable assignments */
  cssVariables: Record<string, string>;
  /** Whether font was already loaded */
  cached: boolean;
}

/** Callback for font selection changes */
export type FontSelectionCallback = (selection: FontSelection, state: FontSelectorState) => void;

/** Callback for font load events */
export type FontLoadCallback = (family: string, success: boolean, error?: string) => void;

// =============================================================================
// Google Fonts Catalog
// =============================================================================

/** Curated catalog of popular Google Fonts */
export const GOOGLE_FONTS_CATALOG: GoogleFont[] = [
  // Sans-serif (popular)
  { family: "Inter", category: "sans-serif", weights: [300, 400, 500, 600, 700], popular: true },
  { family: "Roboto", category: "sans-serif", weights: [300, 400, 500, 700], popular: true },
  { family: "Open Sans", category: "sans-serif", weights: [300, 400, 600, 700], popular: true },
  { family: "Lato", category: "sans-serif", weights: [300, 400, 700], popular: true },
  { family: "Montserrat", category: "sans-serif", weights: [300, 400, 500, 600, 700], popular: true },
  { family: "Poppins", category: "sans-serif", weights: [300, 400, 500, 600, 700], popular: true },
  { family: "Nunito", category: "sans-serif", weights: [300, 400, 600, 700] },
  { family: "Raleway", category: "sans-serif", weights: [300, 400, 500, 600, 700] },
  { family: "Ubuntu", category: "sans-serif", weights: [300, 400, 500, 700] },
  { family: "Work Sans", category: "sans-serif", weights: [300, 400, 500, 600, 700] },
  { family: "DM Sans", category: "sans-serif", weights: [400, 500, 700] },
  { family: "Manrope", category: "sans-serif", weights: [300, 400, 500, 600, 700] },
  { family: "Plus Jakarta Sans", category: "sans-serif", weights: [300, 400, 500, 600, 700] },
  { family: "Outfit", category: "sans-serif", weights: [300, 400, 500, 600, 700] },
  { family: "Space Grotesk", category: "sans-serif", weights: [300, 400, 500, 600, 700] },

  // Serif
  { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700], popular: true },
  { family: "Merriweather", category: "serif", weights: [300, 400, 700], popular: true },
  { family: "Lora", category: "serif", weights: [400, 500, 600, 700] },
  { family: "PT Serif", category: "serif", weights: [400, 700] },
  { family: "Libre Baskerville", category: "serif", weights: [400, 700] },
  { family: "Cormorant Garamond", category: "serif", weights: [300, 400, 500, 600, 700] },
  { family: "EB Garamond", category: "serif", weights: [400, 500, 600, 700] },
  { family: "Bitter", category: "serif", weights: [300, 400, 500, 600, 700] },
  { family: "Source Serif Pro", category: "serif", weights: [300, 400, 600, 700] },

  // Display
  { family: "Bebas Neue", category: "display", weights: [400], popular: true },
  { family: "Anton", category: "display", weights: [400] },
  { family: "Abril Fatface", category: "display", weights: [400] },
  { family: "Lobster", category: "display", weights: [400] },
  { family: "Righteous", category: "display", weights: [400] },

  // Handwriting
  { family: "Pacifico", category: "handwriting", weights: [400] },
  { family: "Dancing Script", category: "handwriting", weights: [400, 500, 600, 700] },
  { family: "Caveat", category: "handwriting", weights: [400, 500, 600, 700] },
  { family: "Satisfy", category: "handwriting", weights: [400] },

  // Monospace
  { family: "Fira Code", category: "monospace", weights: [300, 400, 500, 600, 700], popular: true },
  { family: "JetBrains Mono", category: "monospace", weights: [300, 400, 500, 600, 700] },
  { family: "Source Code Pro", category: "monospace", weights: [300, 400, 500, 600, 700] },
  { family: "Roboto Mono", category: "monospace", weights: [300, 400, 500, 700] },
];

/** Get fonts by category */
export function getFontsByCategory(category: FontCategory): GoogleFont[] {
  return GOOGLE_FONTS_CATALOG.filter((f) => f.category === category);
}

/** Get popular fonts */
export function getPopularFonts(): GoogleFont[] {
  return GOOGLE_FONTS_CATALOG.filter((f) => f.popular);
}

/** Find a font by family name (case-insensitive) */
export function findFont(family: string): GoogleFont | undefined {
  const lower = family.toLowerCase();
  return GOOGLE_FONTS_CATALOG.find((f) => f.family.toLowerCase() === lower);
}

/** Get all available font families */
export function getAllFontFamilies(): string[] {
  return GOOGLE_FONTS_CATALOG.map((f) => f.family);
}

// =============================================================================
// Google Fonts URL Builder
// =============================================================================

const GOOGLE_FONTS_API = "https://fonts.googleapis.com/css2";

/**
 * Builds a Google Fonts CSS URL for loading fonts.
 */
export function buildFontUrl(family: string, weights: FontWeight[] = [400, 700]): string {
  const encoded = family.replace(/\s+/g, "+");
  const sortedWeights = [...weights].sort((a, b) => a - b);
  return `${GOOGLE_FONTS_API}?family=${encoded}:wght@${sortedWeights.join(";")}&display=swap`;
}

/**
 * Builds a combined URL for multiple font families.
 */
export function buildCombinedFontUrl(
  fonts: Array<{ family: string; weights: FontWeight[] }>
): string {
  const families = fonts.map((f) => {
    const encoded = f.family.replace(/\s+/g, "+");
    const sortedWeights = [...f.weights].sort((a, b) => a - b);
    return `family=${encoded}:wght@${sortedWeights.join(";")}`;
  });
  return `${GOOGLE_FONTS_API}?${families.join("&")}&display=swap`;
}

// =============================================================================
// GoogleFontsSelector Class
// =============================================================================

/**
 * Manages font selection with live preview updates.
 *
 * @example
 * ```typescript
 * const selector = new GoogleFontsSelector({
 *   headingFont: "Playfair Display",
 *   bodyFont: "Inter",
 * });
 *
 * // Connect to preview iframe
 * selector.connect(iframe);
 *
 * // Select a new heading font
 * await selector.selectHeadingFont("Montserrat");
 *
 * // Listen for changes
 * selector.onSelectionChange((selection, state) => {
 *   console.log(`Selected ${selection.family} for ${selection.role}`);
 * });
 * ```
 */
export class GoogleFontsSelector {
  private options: Required<FontSelectorOptions>;
  private state: FontSelectorState;
  private iframe: HTMLIFrameElement | null = null;
  private selectionCallbacks = new Set<FontSelectionCallback>();
  private loadCallbacks = new Set<FontLoadCallback>();
  private disposed = false;

  constructor(options: FontSelectorOptions = {}) {
    this.options = {
      headingFont: options.headingFont ?? "Playfair Display",
      bodyFont: options.bodyFont ?? "Inter",
      preloadPopular: options.preloadPopular ?? false,
      customFonts: options.customFonts ?? [],
      categories: options.categories ?? [],
    };

    this.state = {
      headingFont: {
        family: this.options.headingFont,
        weights: this.getDefaultWeights(this.options.headingFont),
        role: "heading",
      },
      bodyFont: {
        family: this.options.bodyFont,
        weights: this.getDefaultWeights(this.options.bodyFont),
        role: "body",
      },
      loadingFonts: new Set(),
      loadedFonts: new Set(),
      loadErrors: new Map(),
    };
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /**
   * Connects to a preview iframe for live updates.
   */
  connect(iframe: HTMLIFrameElement): void {
    if (this.disposed) {
      throw new Error("GoogleFontsSelector has been disposed");
    }
    this.iframe = iframe;

    // Apply current selection to iframe
    this.applyCurrentSelection();
  }

  /**
   * Disconnects from the iframe.
   */
  disconnect(): void {
    this.iframe = null;
  }

  /**
   * Checks if connected.
   */
  isConnected(): boolean {
    return this.iframe !== null;
  }

  // ---------------------------------------------------------------------------
  // Font Selection
  // ---------------------------------------------------------------------------

  /**
   * Selects a heading font and updates the preview.
   */
  async selectHeadingFont(family: string, weights?: FontWeight[]): Promise<FontApplyResult> {
    const font = findFont(family);
    const selectedWeights = weights ?? font?.weights ?? [400, 700];

    this.state.headingFont = {
      family,
      weights: selectedWeights,
      role: "heading",
    };

    const result = await this.loadAndApplyFont(family, selectedWeights, "--font-heading");

    this.notifySelectionChange(this.state.headingFont);

    return result;
  }

  /**
   * Selects a body font and updates the preview.
   */
  async selectBodyFont(family: string, weights?: FontWeight[]): Promise<FontApplyResult> {
    const font = findFont(family);
    const selectedWeights = weights ?? font?.weights ?? [400, 700];

    this.state.bodyFont = {
      family,
      weights: selectedWeights,
      role: "body",
    };

    const result = await this.loadAndApplyFont(family, selectedWeights, "--font-body");

    this.notifySelectionChange(this.state.bodyFont);

    return result;
  }

  /**
   * Gets the current heading font selection.
   */
  getHeadingFont(): FontSelection {
    return { ...this.state.headingFont };
  }

  /**
   * Gets the current body font selection.
   */
  getBodyFont(): FontSelection {
    return { ...this.state.bodyFont };
  }

  // ---------------------------------------------------------------------------
  // Font Loading
  // ---------------------------------------------------------------------------

  private async loadAndApplyFont(
    family: string,
    weights: FontWeight[],
    cssVariable: string
  ): Promise<FontApplyResult> {
    const cssUrl = buildFontUrl(family, weights);
    const cached = this.state.loadedFonts.has(family);

    if (!cached) {
      this.state.loadingFonts.add(family);

      try {
        await this.loadFontInIframe(cssUrl, family);
        this.state.loadedFonts.add(family);
        this.state.loadErrors.delete(family);
        this.notifyFontLoad(family, true);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        this.state.loadErrors.set(family, errorMsg);
        this.notifyFontLoad(family, false, errorMsg);

        return {
          success: false,
          cssUrl,
          cssVariables: {},
          cached: false,
        };
      } finally {
        this.state.loadingFonts.delete(family);
      }
    }

    // Apply CSS variable
    const cssVariables = {
      [cssVariable]: `"${family}", ${this.getFallback(family)}`,
    };

    this.applyCssVariables(cssVariables);

    return {
      success: true,
      cssUrl,
      cssVariables,
      cached,
    };
  }

  private async loadFontInIframe(cssUrl: string, family: string): Promise<void> {
    if (!this.iframe?.contentWindow) {
      // No iframe, just track as loaded
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Font load timeout: ${family}`));
      }, 10000);

      const handler = (e: MessageEvent) => {
        if (e.data?.type === "platxa:font-loaded" && e.data.family === family) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve();
        }
        if (e.data?.type === "platxa:font-error" && e.data.family === family) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          reject(new Error(e.data.error || "Font load failed"));
        }
      };

      window.addEventListener("message", handler);

      this.iframe!.contentWindow!.postMessage(
        {
          type: "platxa:load-font",
          family,
          cssUrl,
        },
        "*"
      );
    });
  }

  private applyCssVariables(variables: Record<string, string>): void {
    if (!this.iframe?.contentWindow) return;

    this.iframe.contentWindow.postMessage(
      {
        type: "platxa:apply-font-variables",
        variables,
      },
      "*"
    );
  }

  private applyCurrentSelection(): void {
    // Apply both heading and body fonts
    const headingVar = `"${this.state.headingFont.family}", ${this.getFallback(this.state.headingFont.family)}`;
    const bodyVar = `"${this.state.bodyFont.family}", ${this.getFallback(this.state.bodyFont.family)}`;

    // Load fonts
    this.loadAndApplyFont(
      this.state.headingFont.family,
      this.state.headingFont.weights,
      "--font-heading"
    );
    this.loadAndApplyFont(
      this.state.bodyFont.family,
      this.state.bodyFont.weights,
      "--font-body"
    );
  }

  // ---------------------------------------------------------------------------
  // Font List
  // ---------------------------------------------------------------------------

  /**
   * Gets the full font list.
   */
  getFontList(): GoogleFont[] {
    const base = this.options.customFonts.length > 0
      ? this.options.customFonts
      : GOOGLE_FONTS_CATALOG;

    if (this.options.categories.length > 0) {
      return base.filter((f) => this.options.categories.includes(f.category));
    }

    return base;
  }

  /**
   * Gets fonts grouped by category.
   */
  getFontsByCategory(): Record<FontCategory, GoogleFont[]> {
    const fonts = this.getFontList();
    const grouped: Record<FontCategory, GoogleFont[]> = {
      "sans-serif": [],
      serif: [],
      display: [],
      handwriting: [],
      monospace: [],
    };

    for (const font of fonts) {
      grouped[font.category].push(font);
    }

    return grouped;
  }

  /**
   * Searches fonts by name.
   */
  searchFonts(query: string): GoogleFont[] {
    const lower = query.toLowerCase();
    return this.getFontList().filter((f) =>
      f.family.toLowerCase().includes(lower)
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getDefaultWeights(family: string): FontWeight[] {
    const font = findFont(family);
    return font?.weights ?? [400, 700];
  }

  private getFallback(family: string): string {
    const font = findFont(family);
    const category = font?.category ?? "sans-serif";

    switch (category) {
      case "serif":
        return "Georgia, serif";
      case "monospace":
        return "Monaco, Consolas, monospace";
      case "handwriting":
        return "cursive";
      case "display":
        return "Impact, sans-serif";
      default:
        return "system-ui, sans-serif";
    }
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /**
   * Gets the current selector state.
   */
  getState(): FontSelectorState {
    return {
      ...this.state,
      loadingFonts: new Set(this.state.loadingFonts),
      loadedFonts: new Set(this.state.loadedFonts),
      loadErrors: new Map(this.state.loadErrors),
    };
  }

  /**
   * Checks if a font is currently loading.
   */
  isLoading(family: string): boolean {
    return this.state.loadingFonts.has(family);
  }

  /**
   * Checks if a font is loaded.
   */
  isLoaded(family: string): boolean {
    return this.state.loadedFonts.has(family);
  }

  /**
   * Gets the load error for a font (if any).
   */
  getLoadError(family: string): string | undefined {
    return this.state.loadErrors.get(family);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback for font selection changes.
   */
  onSelectionChange(callback: FontSelectionCallback): () => void {
    this.selectionCallbacks.add(callback);
    return () => this.selectionCallbacks.delete(callback);
  }

  /**
   * Registers a callback for font load events.
   */
  onFontLoad(callback: FontLoadCallback): () => void {
    this.loadCallbacks.add(callback);
    return () => this.loadCallbacks.delete(callback);
  }

  private notifySelectionChange(selection: FontSelection): void {
    const state = this.getState();
    for (const callback of this.selectionCallbacks) {
      try {
        callback(selection, state);
      } catch (e) {
        console.error("GoogleFontsSelector callback error:", e);
      }
    }
  }

  private notifyFontLoad(family: string, success: boolean, error?: string): void {
    for (const callback of this.loadCallbacks) {
      try {
        callback(family, success, error);
      } catch (e) {
        console.error("GoogleFontsSelector load callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes and cleans up resources.
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.iframe = null;
    this.selectionCallbacks.clear();
    this.loadCallbacks.clear();
  }
}

// =============================================================================
// Iframe Script
// =============================================================================

/**
 * Script to inject into the preview iframe for font loading and application.
 */
export const GOOGLE_FONTS_SCRIPT = `
<script>
(function() {
  var loadedFonts = new Set();
  var loadingFonts = new Map();

  function loadFont(family, cssUrl) {
    if (loadedFonts.has(family)) {
      window.parent.postMessage({ type: 'platxa:font-loaded', family: family }, '*');
      return;
    }

    if (loadingFonts.has(family)) {
      return; // Already loading
    }

    var linkId = 'platxa-font-' + family.replace(/\\s+/g, '-').toLowerCase();
    var existing = document.getElementById(linkId);
    if (existing) {
      loadedFonts.add(family);
      window.parent.postMessage({ type: 'platxa:font-loaded', family: family }, '*');
      return;
    }

    loadingFonts.set(family, true);

    var link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = cssUrl;

    link.onload = function() {
      loadedFonts.add(family);
      loadingFonts.delete(family);
      window.parent.postMessage({ type: 'platxa:font-loaded', family: family }, '*');
    };

    link.onerror = function() {
      loadingFonts.delete(family);
      window.parent.postMessage({
        type: 'platxa:font-error',
        family: family,
        error: 'Failed to load font stylesheet'
      }, '*');
    };

    document.head.appendChild(link);
  }

  function applyFontVariables(variables) {
    var root = document.documentElement;
    for (var name in variables) {
      root.style.setProperty(name, variables[name]);
    }
    window.parent.postMessage({ type: 'platxa:font-variables-applied', variables: variables }, '*');
  }

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;

    switch (e.data.type) {
      case 'platxa:load-font':
        loadFont(e.data.family, e.data.cssUrl);
        break;

      case 'platxa:apply-font-variables':
        applyFontVariables(e.data.variables);
        break;
    }
  });

  // Notify parent that font script is ready
  window.parent.postMessage({ type: 'platxa:font-script-ready' }, '*');
})();
</script>`;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a GoogleFontsSelector instance.
 */
export function createFontSelector(
  options?: FontSelectorOptions
): GoogleFontsSelector {
  return new GoogleFontsSelector(options);
}

// =============================================================================
// Exports
// =============================================================================

export default GoogleFontsSelector;

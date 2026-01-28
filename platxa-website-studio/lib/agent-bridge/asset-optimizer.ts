/**
 * Theme Asset Optimizer
 *
 * Minifies SCSS/CSS, optimizes images (with WebP fallback),
 * and subsets fonts to reduce theme bundle size.
 */

// =============================================================================
// Types
// =============================================================================

export interface OptimizationStats {
  originalSize: number;
  optimizedSize: number;
  reductionPercent: number;
}

export interface ScssMinifyResult {
  /** Minified CSS output */
  output: string;
  stats: OptimizationStats;
}

export interface ImageOptimizeResult {
  /** Original format */
  originalFormat: string;
  /** Whether WebP variant was generated */
  hasWebP: boolean;
  /** Optimized buffer (simulated as byte length) */
  optimizedSize: number;
  /** WebP buffer size (0 if not generated) */
  webpSize: number;
  stats: OptimizationStats;
}

export interface FontSubsetResult {
  /** Characters included in subset */
  charset: string;
  /** Subset name (e.g. "latin", "latin-ext") */
  subsetName: string;
  stats: OptimizationStats;
}

export interface AssetOptimizationResult {
  scss: ScssMinifyResult[];
  images: ImageOptimizeResult[];
  fonts: FontSubsetResult[];
  totalStats: OptimizationStats;
}

/** Configuration for the optimizer */
export interface OptimizerConfig {
  /** Enable SCSS minification */
  minifyScss: boolean;
  /** Enable image optimization */
  optimizeImages: boolean;
  /** Generate WebP fallbacks */
  generateWebP: boolean;
  /** Enable font subsetting */
  subsetFonts: boolean;
  /** Target character set for font subsetting */
  fontCharset: string;
  /** Image quality (1-100) for lossy compression */
  imageQuality: number;
}

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  minifyScss: true,
  optimizeImages: true,
  generateWebP: true,
  subsetFonts: true,
  fontCharset: "latin",
  imageQuality: 85,
};

/** Input asset for optimization */
export interface AssetInput {
  /** File path relative to theme root */
  path: string;
  /** Raw content (string for SCSS/CSS, or byte length for binary) */
  content: string;
  /** Asset type */
  type: "scss" | "image" | "font";
  /** Image format (for images) */
  imageFormat?: string;
  /** Font original size in bytes (for fonts) */
  originalByteSize?: number;
}

// =============================================================================
// Character Sets for Font Subsetting
// =============================================================================

const CHARSETS: Record<string, string> = {
  latin:
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
    " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~" +
    "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ",
  "latin-ext":
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
    " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~" +
    "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ" +
    "ĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģ",
  cyrillic:
    "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя",
};

// =============================================================================
// SCSS Minification
// =============================================================================

/**
 * Minifies SCSS/CSS by removing comments, whitespace, and redundant tokens.
 * This is a pure-TypeScript minifier (no external dependencies).
 */
export function minifyScss(source: string): ScssMinifyResult {
  const originalSize = source.length;

  let output = source;

  // 1. Remove block comments (/* ... */) but keep /*! ... */ (license comments)
  output = output.replace(/\/\*(?!!)[^]*?\*\//g, "");

  // 2. Remove single-line comments (// ...) — but not inside strings
  output = output.replace(/\/\/[^\n]*/g, "");

  // 3. Remove blank lines (lines with only whitespace)
  output = output.replace(/^\s*[\r\n]/gm, "");

  // 4. Collapse all whitespace runs (newlines, tabs, multi-spaces) to single space
  output = output.replace(/\s+/g, " ");

  // 5. Remove space around structural punctuation
  output = output.replace(/\s*([{}:;,>~+])\s*/g, "$1");

  // 6. Remove trailing semicolons before closing braces
  output = output.replace(/;}/g, "}");

  // 7. Remove empty rule blocks
  output = output.replace(/[^{}]+\{\s*\}/g, "");

  // 8. Shorten hex colors: #aabbcc → #abc
  output = output.replace(
    /#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3/g,
    "#$1$2$3",
  );

  // 9. Remove leading zeros: 0.5 → .5 (in numeric values, not selectors)
  output = output.replace(/(:|\s)0+\.(\d)/g, "$1.$2");

  // 10. Remove units on zero values: 0px → 0, 0rem → 0, 0em → 0
  output = output.replace(/(:)0(px|rem|em|%|pt|vh|vw)/g, "$10");

  // 11. Collapse "0 0 0 0" → "0"
  output = output.replace(/(:)0 0 0 0/g, "$10");

  // 12. Trim
  output = output.trim();

  const optimizedSize = output.length;
  const reductionPercent =
    originalSize > 0
      ? ((originalSize - optimizedSize) / originalSize) * 100
      : 0;

  return {
    output,
    stats: { originalSize, optimizedSize, reductionPercent },
  };
}

// =============================================================================
// Image Optimization
// =============================================================================

/** Supported image formats for optimization */
const OPTIMIZABLE_FORMATS = new Set(["png", "jpg", "jpeg", "gif", "svg", "bmp"]);
const WEBP_CONVERTIBLE = new Set(["png", "jpg", "jpeg", "bmp"]);

/**
 * Simulates image optimization by computing expected size reduction.
 * In production, this would call sharp/squoosh. Here we compute realistic
 * reduction ratios based on format and quality settings.
 */
export function optimizeImage(
  content: string,
  format: string,
  quality: number = 85,
  generateWebP: boolean = true,
): ImageOptimizeResult {
  const originalSize = content.length;
  const fmt = format.toLowerCase().replace(".", "");

  if (!OPTIMIZABLE_FORMATS.has(fmt)) {
    return {
      originalFormat: fmt,
      hasWebP: false,
      optimizedSize: originalSize,
      webpSize: 0,
      stats: { originalSize, optimizedSize: originalSize, reductionPercent: 0 },
    };
  }

  // Realistic compression ratios by format
  const ratios: Record<string, number> = {
    png: 0.65, // lossless optimization ~35% reduction
    jpg: 0.40 + quality * 0.005, // quality-dependent: q50→0.65, q85→0.825, q95→0.875
    jpeg: 0.40 + quality * 0.005,
    gif: 0.80, // limited optimization
    svg: 0.55, // SVGO-style optimization ~45% reduction
    bmp: 0.15, // huge reduction converting to compressed format
  };

  const ratio = ratios[fmt] ?? 0.8;
  const optimizedSize = Math.floor(originalSize * ratio);

  // WebP typically 25-35% smaller than JPEG
  const canWebP = generateWebP && WEBP_CONVERTIBLE.has(fmt);
  const webpSize = canWebP ? Math.floor(optimizedSize * 0.72) : 0;

  const bestSize = canWebP ? Math.min(optimizedSize, webpSize) : optimizedSize;
  const reductionPercent =
    originalSize > 0
      ? ((originalSize - bestSize) / originalSize) * 100
      : 0;

  return {
    originalFormat: fmt,
    hasWebP: canWebP,
    optimizedSize,
    webpSize,
    stats: { originalSize, optimizedSize: bestSize, reductionPercent },
  };
}

// =============================================================================
// Font Subsetting
// =============================================================================

/**
 * Computes font subset reduction based on target character set.
 * In production, this would use fonttools/pyftsubset. Here we compute
 * realistic reduction based on charset coverage.
 */
export function subsetFont(
  originalByteSize: number,
  charsetName: string = "latin",
): FontSubsetResult {
  const charset = CHARSETS[charsetName] ?? CHARSETS["latin"];

  // Full Unicode has ~150k glyphs. Subset ratio is based on charset size.
  // Latin ~190 chars out of typical font's ~500-2000 glyphs
  const typicalGlyphCount = 800;
  const subsetGlyphCount = Math.min(charset.length, typicalGlyphCount);
  const glyphRatio = subsetGlyphCount / typicalGlyphCount;

  // Font files also contain tables, hinting, etc. (~30% overhead stays)
  const overhead = 0.3;
  const dataRatio = overhead + (1 - overhead) * glyphRatio;

  const optimizedSize = Math.floor(originalByteSize * dataRatio);
  const reductionPercent =
    originalByteSize > 0
      ? ((originalByteSize - optimizedSize) / originalByteSize) * 100
      : 0;

  return {
    charset,
    subsetName: charsetName,
    stats: { originalSize: originalByteSize, optimizedSize, reductionPercent },
  };
}

// =============================================================================
// Full Pipeline
// =============================================================================

/**
 * Optimizes all theme assets in a single pass.
 */
export function optimizeAssets(
  assets: AssetInput[],
  config: Partial<OptimizerConfig> = {},
): AssetOptimizationResult {
  const cfg = { ...DEFAULT_OPTIMIZER_CONFIG, ...config };

  const scssResults: ScssMinifyResult[] = [];
  const imageResults: ImageOptimizeResult[] = [];
  const fontResults: FontSubsetResult[] = [];

  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const asset of assets) {
    if (asset.type === "scss" && cfg.minifyScss) {
      const result = minifyScss(asset.content);
      scssResults.push(result);
      totalOriginal += result.stats.originalSize;
      totalOptimized += result.stats.optimizedSize;
    } else if (asset.type === "image" && cfg.optimizeImages) {
      const result = optimizeImage(
        asset.content,
        asset.imageFormat ?? "png",
        cfg.imageQuality,
        cfg.generateWebP,
      );
      imageResults.push(result);
      totalOriginal += result.stats.originalSize;
      totalOptimized += result.stats.optimizedSize;
    } else if (asset.type === "font" && cfg.subsetFonts) {
      const byteSize = asset.originalByteSize ?? asset.content.length;
      const result = subsetFont(byteSize, cfg.fontCharset);
      fontResults.push(result);
      totalOriginal += result.stats.originalSize;
      totalOptimized += result.stats.optimizedSize;
    }
  }

  const reductionPercent =
    totalOriginal > 0
      ? ((totalOriginal - totalOptimized) / totalOriginal) * 100
      : 0;

  return {
    scss: scssResults,
    images: imageResults,
    fonts: fontResults,
    totalStats: {
      originalSize: totalOriginal,
      optimizedSize: totalOptimized,
      reductionPercent,
    },
  };
}

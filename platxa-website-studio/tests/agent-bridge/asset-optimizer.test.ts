import { describe, it, expect } from "vitest";
import {
  minifyScss,
  optimizeImage,
  subsetFont,
  optimizeAssets,
  DEFAULT_OPTIMIZER_CONFIG,
} from "@/lib/agent-bridge/asset-optimizer";
import type { AssetInput } from "@/lib/agent-bridge/asset-optimizer";

describe("Asset Optimizer", () => {
  describe("minifyScss", () => {
    it("removes block comments", () => {
      const result = minifyScss("/* comment */ .foo { color: red; }");
      expect(result.output).not.toContain("comment");
      expect(result.output).toContain(".foo");
    });

    it("removes single-line comments", () => {
      const result = minifyScss("// comment\n.foo { color: red; }");
      expect(result.output).not.toContain("// comment");
    });

    it("preserves license comments (/*! ... */)", () => {
      const result = minifyScss("/*! License */ .foo { color: red; }");
      expect(result.output).toContain("License");
    });

    it("collapses whitespace", () => {
      const result = minifyScss(".foo  {  color:  red;  }");
      expect(result.output).not.toContain("  ");
    });

    it("removes space around punctuation", () => {
      const result = minifyScss(".foo { color : red ; }");
      expect(result.output).toBe(".foo{color:red}");
    });

    it("removes trailing semicolons before close brace", () => {
      const result = minifyScss(".foo { color: red; }");
      expect(result.output).toBe(".foo{color:red}");
    });

    it("removes empty rule blocks", () => {
      const result = minifyScss(".empty { } .foo { color: red; }");
      expect(result.output).toContain(".foo");
      expect(result.output).not.toContain("empty");
    });

    it("achieves >50% reduction on realistic themed SCSS", () => {
      // Real Odoo theme SCSS files are heavily commented and indented.
      // This mirrors actual theme_starter SCSS structure.
      const verbose = `
/**
 * Theme Primary Variables
 * =======================
 * Override Bootstrap and Odoo default variables
 * to match the brand identity.
 */

// ─── Brand Colors ───────────────────────────────
// These map to the Odoo color palette (o-color-1..5)
$o-color-1:         #1a73e8;       // Primary brand blue
$o-color-2:         #fbbc04;       // Accent yellow
$o-color-3:         #333333;       // Dark text
$o-color-4:         #ffffff;       // Light background
$o-color-5:         #eeeeee;       // Border gray

// ─── Typography ─────────────────────────────────
$font-family-base:  'Inter', sans-serif;
$headings-font:     'Playfair Display', serif;
$font-size-base:    1rem;
$line-height-base:  1.6;

// ─── Spacing ────────────────────────────────────
$spacer:            1rem;
$section-padding:   4rem 0px;

/**
 * Hero Section
 * ============
 * Full-width banner with background image overlay
 * and centered call-to-action content.
 */
.s_hero {
  /* Layout */
  position:           relative;
  min-height:         80vh;
  display:            flex;
  align-items:        center;
  justify-content:    center;
  padding:            $section-padding;

  /* Visual */
  background-color:   $o-color-1;
  background-size:    cover;
  background-position: center center;
  color:              $o-color-4;

  /* Overlay */
  &::before {
    content:          '';
    position:         absolute;
    top:              0px;
    left:             0px;
    right:            0px;
    bottom:           0px;
    background:       rgba(0, 0, 0, 0.4);
    z-index:          1;
  }

  /* Content wrapper */
  .s_hero_content {
    position:         relative;
    z-index:          2;
    text-align:       center;
    max-width:        800px;
    margin:           0px auto;

    h1 {
      font-family:    $headings-font;
      font-size:      3.5rem;
      margin-bottom:  1.5rem;
      text-shadow:    0 2px 4px rgba(0, 0, 0, 0.3);
    }

    p {
      font-size:      1.25rem;
      margin-bottom:  2rem;
      opacity:        0.9;
    }
  }
}

/**
 * Card Grid Section
 * =================
 * Responsive grid of feature/service cards
 */
.s_card_grid {
  padding:            $section-padding;
  background-color:   $o-color-4;

  .card {
    /* Card styling */
    border:           1px solid $o-color-5;
    border-radius:    8px;
    padding:          1.5rem;
    margin-bottom:    1rem;
    transition:       box-shadow 0.3s ease;
    box-shadow:       0 2px 4px rgba(0, 0, 0, 0.1);

    &:hover {
      box-shadow:     0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .card-title {
      font-family:    $headings-font;
      color:          $o-color-3;
      margin-bottom:  0.75rem;
    }

    .card-text {
      color:          lighten($o-color-3, 20%);
      line-height:    $line-height-base;
    }
  }
}

/* ===================================================
   Footer
   =================================================== */
.o_footer {
  background-color:   $o-color-3;
  color:              $o-color-4;
  padding:            3rem 0px;

  a {
    color:            $o-color-2;
    text-decoration:  none;

    &:hover {
      text-decoration: underline;
    }
  }

  .o_footer_copyright {
    border-top:       1px solid rgba(255, 255, 255, 0.2);
    padding-top:      1.5rem;
    margin-top:       2rem;
    font-size:        0.875rem;
    opacity:          0.7;
  }
}
`;
      const result = minifyScss(verbose);
      // A real theme SCSS file with proper comments, spacing, and
      // documentation should minify well over 50%
      expect(result.stats.reductionPercent).toBeGreaterThan(50);
    });

    it("returns 0 reduction for empty input", () => {
      const result = minifyScss("");
      expect(result.stats.reductionPercent).toBe(0);
      expect(result.output).toBe("");
    });
  });

  describe("optimizeImage", () => {
    const fakeImage = "x".repeat(10000);

    it("optimizes PNG with ~35% reduction", () => {
      const result = optimizeImage(fakeImage, "png");
      expect(result.stats.reductionPercent).toBeGreaterThan(25);
      expect(result.originalFormat).toBe("png");
    });

    it("generates WebP for PNG", () => {
      const result = optimizeImage(fakeImage, "png", 85, true);
      expect(result.hasWebP).toBe(true);
      expect(result.webpSize).toBeGreaterThan(0);
      expect(result.webpSize).toBeLessThan(result.optimizedSize);
    });

    it("does not generate WebP when disabled", () => {
      const result = optimizeImage(fakeImage, "png", 85, false);
      expect(result.hasWebP).toBe(false);
      expect(result.webpSize).toBe(0);
    });

    it("does not generate WebP for SVG", () => {
      const result = optimizeImage(fakeImage, "svg", 85, true);
      expect(result.hasWebP).toBe(false);
    });

    it("handles JPEG format", () => {
      const result = optimizeImage(fakeImage, "jpeg");
      expect(result.originalFormat).toBe("jpeg");
      expect(result.stats.reductionPercent).toBeGreaterThan(0);
    });

    it("handles unknown format with no optimization", () => {
      const result = optimizeImage(fakeImage, "tiff");
      expect(result.stats.reductionPercent).toBe(0);
      expect(result.optimizedSize).toBe(10000);
    });

    it("BMP gets largest reduction", () => {
      const result = optimizeImage(fakeImage, "bmp");
      expect(result.stats.reductionPercent).toBeGreaterThan(70);
    });

    it("higher quality means less compression for JPEG", () => {
      const hq = optimizeImage(fakeImage, "jpg", 95);
      const lq = optimizeImage(fakeImage, "jpg", 50);
      expect(lq.optimizedSize).toBeLessThan(hq.optimizedSize);
    });
  });

  describe("subsetFont", () => {
    it("reduces font size for latin subset", () => {
      const result = subsetFont(100000, "latin");
      expect(result.stats.reductionPercent).toBeGreaterThan(0);
      expect(result.subsetName).toBe("latin");
    });

    it("latin-ext is larger than latin", () => {
      const latin = subsetFont(100000, "latin");
      const ext = subsetFont(100000, "latin-ext");
      expect(ext.stats.optimizedSize).toBeGreaterThan(latin.stats.optimizedSize);
    });

    it("cyrillic subset works", () => {
      const result = subsetFont(100000, "cyrillic");
      expect(result.subsetName).toBe("cyrillic");
      expect(result.stats.reductionPercent).toBeGreaterThan(0);
    });

    it("unknown charset falls back to latin", () => {
      const result = subsetFont(100000, "unknown");
      const latin = subsetFont(100000, "latin");
      expect(result.stats.optimizedSize).toBe(latin.stats.optimizedSize);
    });

    it("returns 0 reduction for 0-size font", () => {
      const result = subsetFont(0);
      expect(result.stats.reductionPercent).toBe(0);
    });
  });

  describe("optimizeAssets", () => {
    const assets: AssetInput[] = [
      {
        path: "static/src/scss/theme.scss",
        content: "/* big comment */\n.foo { color: red; }\n/* another */\n.bar { padding: 1rem; }",
        type: "scss",
      },
      {
        path: "static/src/img/hero.png",
        content: "x".repeat(50000),
        type: "image",
        imageFormat: "png",
      },
      {
        path: "static/src/fonts/main.woff2",
        content: "",
        type: "font",
        originalByteSize: 80000,
      },
    ];

    it("processes all asset types", () => {
      const result = optimizeAssets(assets);
      expect(result.scss).toHaveLength(1);
      expect(result.images).toHaveLength(1);
      expect(result.fonts).toHaveLength(1);
    });

    it("computes total stats", () => {
      const result = optimizeAssets(assets);
      expect(result.totalStats.originalSize).toBeGreaterThan(0);
      expect(result.totalStats.optimizedSize).toBeLessThan(result.totalStats.originalSize);
      expect(result.totalStats.reductionPercent).toBeGreaterThan(0);
    });

    it("respects config to disable scss", () => {
      const result = optimizeAssets(assets, { minifyScss: false });
      expect(result.scss).toHaveLength(0);
    });

    it("respects config to disable images", () => {
      const result = optimizeAssets(assets, { optimizeImages: false });
      expect(result.images).toHaveLength(0);
    });

    it("respects config to disable fonts", () => {
      const result = optimizeAssets(assets, { subsetFonts: false });
      expect(result.fonts).toHaveLength(0);
    });

    it("handles empty assets", () => {
      const result = optimizeAssets([]);
      expect(result.totalStats.reductionPercent).toBe(0);
    });
  });

  describe("DEFAULT_OPTIMIZER_CONFIG", () => {
    it("has all optimizations enabled", () => {
      expect(DEFAULT_OPTIMIZER_CONFIG.minifyScss).toBe(true);
      expect(DEFAULT_OPTIMIZER_CONFIG.optimizeImages).toBe(true);
      expect(DEFAULT_OPTIMIZER_CONFIG.generateWebP).toBe(true);
      expect(DEFAULT_OPTIMIZER_CONFIG.subsetFonts).toBe(true);
    });

    it("defaults to latin charset", () => {
      expect(DEFAULT_OPTIMIZER_CONFIG.fontCharset).toBe("latin");
    });

    it("defaults to quality 85", () => {
      expect(DEFAULT_OPTIMIZER_CONFIG.imageQuality).toBe(85);
    });
  });
});

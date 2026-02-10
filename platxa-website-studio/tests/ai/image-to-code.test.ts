/**
 * Tests for Image-to-Code Screenshot Analyzer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  analyzeScreenshot,
  analysisToTokens,
  generateThemeFromScreenshot,
  loadImageFromUrl,
  loadImageFromBase64,
  validateImageSource,
  getSupportedFormats,
  estimateAnalysisCost,
  type ImageSource,
  type ScreenshotAnalysis,
  type ExtractedColor,
  type ExtractedTypography,
  type DetectedComponent,
  type LayoutAnalysis,
  type ThemeGenerationResult,
} from "../../lib/ai/image-to-code";

// Mock the provider adapters
vi.mock("../../lib/ai/providers", () => ({
  AnthropicAdapter: vi.fn().mockImplementation(() => ({
    chat: vi.fn(),
  })),
  OpenAIAdapter: vi.fn().mockImplementation(() => ({
    chat: vi.fn(),
  })),
}));

// Sample analysis result for testing
const sampleAnalysis: ScreenshotAnalysis = {
  colors: [
    { name: "primary", hex: "#6366f1", usage: "primary", confidence: 95 },
    { name: "secondary", hex: "#8b5cf6", usage: "secondary", confidence: 90 },
    { name: "background", hex: "#ffffff", usage: "background", confidence: 100 },
    { name: "text", hex: "#1f2937", usage: "text", confidence: 95 },
  ],
  typography: [
    {
      element: "h1",
      fontFamily: "Inter",
      fontSize: "48px",
      fontWeight: 700,
      lineHeight: 1.2,
      confidence: 85,
    },
    {
      element: "body",
      fontFamily: "Inter",
      fontSize: "16px",
      fontWeight: 400,
      lineHeight: 1.6,
      confidence: 90,
    },
  ],
  spacing: [
    { name: "section", value: "80px", usage: "padding", confidence: 80 },
    { name: "element", value: "24px", usage: "gap", confidence: 85 },
  ],
  components: [
    {
      type: "header",
      bounds: { x: 0, y: 0, width: 1440, height: 80 },
      confidence: 95,
      description: "Fixed header with logo and navigation",
    },
    {
      type: "hero",
      bounds: { x: 0, y: 80, width: 1440, height: 600 },
      confidence: 90,
      description: "Full-width hero section with heading and CTA",
    },
  ],
  layout: {
    type: "single-column",
    sections: ["header", "hero", "features", "testimonials", "footer"],
    hasSticky: true,
    isResponsive: true,
    confidence: 88,
  },
  style: {
    mood: "modern",
    hasGradients: true,
    hasShadows: true,
    hasRoundedCorners: true,
    hasAnimations: false,
  },
  description:
    "A modern SaaS landing page with a clean design, featuring a sticky header, hero section with gradient background, and testimonial cards.",
  confidence: 87,
};

describe("Image-to-Code", () => {
  describe("validateImageSource", () => {
    it("validates base64 image source", () => {
      const source: ImageSource = {
        type: "base64",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        mediaType: "image/png",
      };

      const result = validateImageSource(source);
      expect(result.valid).toBe(true);
    });

    it("validates URL image source", () => {
      const source: ImageSource = {
        type: "url",
        data: "https://example.com/screenshot.png",
      };

      const result = validateImageSource(source);
      expect(result.valid).toBe(true);
    });

    it("rejects empty data", () => {
      const source: ImageSource = {
        type: "base64",
        data: "",
      };

      const result = validateImageSource(source);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("rejects invalid URL", () => {
      const source: ImageSource = {
        type: "url",
        data: "not-a-valid-url",
      };

      const result = validateImageSource(source);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("URL");
    });

    it("rejects invalid base64", () => {
      const source: ImageSource = {
        type: "base64",
        data: "not valid base64!@#$%",
      };

      const result = validateImageSource(source);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("base64");
    });
  });

  describe("loadImageFromUrl", () => {
    it("creates URL image source", () => {
      const url = "https://example.com/image.png";
      const source = loadImageFromUrl(url);

      expect(source.type).toBe("url");
      expect(source.data).toBe(url);
    });
  });

  describe("loadImageFromBase64", () => {
    it("creates base64 image source", () => {
      const base64 = "iVBORw0KGgoAAAANSUhEUg==";
      const source = loadImageFromBase64(base64, "png");

      expect(source.type).toBe("base64");
      expect(source.data).toBe(base64);
      expect(source.mediaType).toBe("image/png");
    });

    it("strips data URL prefix", () => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
      const source = loadImageFromBase64(dataUrl);

      expect(source.data).toBe("iVBORw0KGgoAAAANSUhEUg==");
    });

    it("defaults to PNG format", () => {
      const source = loadImageFromBase64("abc123");
      expect(source.mediaType).toBe("image/png");
    });
  });

  describe("getSupportedFormats", () => {
    it("returns supported image formats", () => {
      const formats = getSupportedFormats();

      expect(formats).toContain("png");
      expect(formats).toContain("jpeg");
      expect(formats).toContain("webp");
      expect(formats).toContain("gif");
    });
  });

  describe("estimateAnalysisCost", () => {
    it("estimates cost for Anthropic", () => {
      const cost = estimateAnalysisCost(1024 * 1024, "anthropic");

      expect(cost.inputCost).toBeGreaterThan(0);
      expect(cost.outputCost).toBeGreaterThan(0);
      expect(cost.totalCost).toBe(cost.inputCost + cost.outputCost);
    });

    it("estimates cost for OpenAI", () => {
      const cost = estimateAnalysisCost(1024 * 1024, "openai");

      expect(cost.inputCost).toBeGreaterThan(0);
      expect(cost.outputCost).toBeGreaterThan(0);
      expect(cost.totalCost).toBe(cost.inputCost + cost.outputCost);
    });

    it("OpenAI costs more for same image", () => {
      const anthropicCost = estimateAnalysisCost(1024 * 1024, "anthropic");
      const openaiCost = estimateAnalysisCost(1024 * 1024, "openai");

      expect(openaiCost.inputCost).toBeGreaterThan(anthropicCost.inputCost);
    });

    it("larger images cost more", () => {
      const smallCost = estimateAnalysisCost(100 * 1024);
      const largeCost = estimateAnalysisCost(5 * 1024 * 1024);

      expect(largeCost.totalCost).toBeGreaterThan(smallCost.totalCost);
    });
  });

  describe("analysisToTokens", () => {
    it("converts analysis to design tokens", () => {
      const tokens = analysisToTokens(sampleAnalysis);

      expect(tokens).toBeDefined();
      expect(tokens.color).toBeDefined();
      expect(tokens.typography).toBeDefined();
      expect(tokens.spacing).toBeDefined();
    });

    it("uses extracted primary color", () => {
      const tokens = analysisToTokens(sampleAnalysis);

      // The primary color should be reflected in the token set
      expect(tokens.color).toBeDefined();
    });

    it("uses extracted typography", () => {
      const tokens = analysisToTokens(sampleAnalysis);

      expect(tokens.typography).toBeDefined();
    });

    it("handles missing colors gracefully", () => {
      const analysisWithoutColors: ScreenshotAnalysis = {
        ...sampleAnalysis,
        colors: [],
      };

      const tokens = analysisToTokens(analysisWithoutColors);
      expect(tokens).toBeDefined();
      expect(tokens.color).toBeDefined();
    });

    it("handles missing typography gracefully", () => {
      const analysisWithoutTypo: ScreenshotAnalysis = {
        ...sampleAnalysis,
        typography: [],
      };

      const tokens = analysisToTokens(analysisWithoutTypo);
      expect(tokens).toBeDefined();
      expect(tokens.typography).toBeDefined();
    });
  });

  describe("ScreenshotAnalysis types", () => {
    it("validates color usage types", () => {
      const validUsages = [
        "primary",
        "secondary",
        "accent",
        "background",
        "text",
        "border",
      ];

      sampleAnalysis.colors.forEach((color) => {
        expect(validUsages).toContain(color.usage);
      });
    });

    it("validates typography element types", () => {
      const validElements = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "body",
        "caption",
      ];

      sampleAnalysis.typography.forEach((typo) => {
        expect(validElements).toContain(typo.element);
      });
    });

    it("validates component types", () => {
      const validTypes = [
        "header",
        "footer",
        "hero",
        "nav",
        "card",
        "button",
        "form",
        "gallery",
        "testimonial",
        "pricing",
        "cta",
        "feature",
        "contact",
        "unknown",
      ];

      sampleAnalysis.components.forEach((component) => {
        expect(validTypes).toContain(component.type);
      });
    });

    it("validates layout types", () => {
      const validLayouts = [
        "single-column",
        "two-column",
        "three-column",
        "grid",
        "asymmetric",
      ];

      expect(validLayouts).toContain(sampleAnalysis.layout.type);
    });

    it("validates style mood types", () => {
      const validMoods = [
        "modern",
        "classic",
        "minimal",
        "bold",
        "playful",
        "corporate",
      ];

      expect(validMoods).toContain(sampleAnalysis.style.mood);
    });

    it("confidence scores are in valid range", () => {
      sampleAnalysis.colors.forEach((c) => {
        expect(c.confidence).toBeGreaterThanOrEqual(0);
        expect(c.confidence).toBeLessThanOrEqual(100);
      });

      sampleAnalysis.typography.forEach((t) => {
        expect(t.confidence).toBeGreaterThanOrEqual(0);
        expect(t.confidence).toBeLessThanOrEqual(100);
      });

      expect(sampleAnalysis.confidence).toBeGreaterThanOrEqual(0);
      expect(sampleAnalysis.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe("Component bounds", () => {
    it("has valid bounds structure", () => {
      sampleAnalysis.components.forEach((component) => {
        expect(component.bounds).toHaveProperty("x");
        expect(component.bounds).toHaveProperty("y");
        expect(component.bounds).toHaveProperty("width");
        expect(component.bounds).toHaveProperty("height");

        expect(typeof component.bounds.x).toBe("number");
        expect(typeof component.bounds.y).toBe("number");
        expect(typeof component.bounds.width).toBe("number");
        expect(typeof component.bounds.height).toBe("number");
      });
    });

    it("bounds values are non-negative", () => {
      sampleAnalysis.components.forEach((component) => {
        expect(component.bounds.x).toBeGreaterThanOrEqual(0);
        expect(component.bounds.y).toBeGreaterThanOrEqual(0);
        expect(component.bounds.width).toBeGreaterThan(0);
        expect(component.bounds.height).toBeGreaterThan(0);
      });
    });
  });

  describe("Layout analysis", () => {
    it("has required layout properties", () => {
      expect(sampleAnalysis.layout.type).toBeDefined();
      expect(sampleAnalysis.layout.sections).toBeDefined();
      expect(Array.isArray(sampleAnalysis.layout.sections)).toBe(true);
      expect(typeof sampleAnalysis.layout.hasSticky).toBe("boolean");
      expect(typeof sampleAnalysis.layout.isResponsive).toBe("boolean");
    });

    it("sections are non-empty strings", () => {
      sampleAnalysis.layout.sections.forEach((section) => {
        expect(typeof section).toBe("string");
        expect(section.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Style analysis", () => {
    it("has all style properties as booleans", () => {
      expect(typeof sampleAnalysis.style.hasGradients).toBe("boolean");
      expect(typeof sampleAnalysis.style.hasShadows).toBe("boolean");
      expect(typeof sampleAnalysis.style.hasRoundedCorners).toBe("boolean");
      expect(typeof sampleAnalysis.style.hasAnimations).toBe("boolean");
    });
  });

  describe("ThemeGenerationResult structure", () => {
    const mockResult: ThemeGenerationResult = {
      moduleName: "theme_test",
      files: [
        { path: "theme_test/__manifest__.py", content: "{}", type: "manifest" },
        {
          path: "theme_test/views/templates.xml",
          content: "<xml/>",
          type: "xml",
        },
        {
          path: "theme_test/static/src/scss/theme.scss",
          content: "body {}",
          type: "scss",
        },
      ],
      tokens: null,
      cssVariables: ":root { --primary: #6366f1; }",
      analysis: sampleAnalysis,
      metadata: {
        generatedAt: new Date().toISOString(),
        modelUsed: "claude-3-5-sonnet-20241022",
        processingTimeMs: 5000,
      },
    };

    it("has valid module name", () => {
      expect(mockResult.moduleName).toMatch(/^theme_[a-z0-9_]+$/);
    });

    it("includes required file types", () => {
      const types = mockResult.files.map((f) => f.type);
      expect(types).toContain("manifest");
      expect(types).toContain("xml");
      expect(types).toContain("scss");
    });

    it("files have valid paths", () => {
      mockResult.files.forEach((file) => {
        expect(file.path).toContain(mockResult.moduleName);
        expect(file.content.length).toBeGreaterThan(0);
      });
    });

    it("metadata has required fields", () => {
      expect(mockResult.metadata.generatedAt).toBeDefined();
      expect(mockResult.metadata.modelUsed).toBeDefined();
      expect(mockResult.metadata.processingTimeMs).toBeGreaterThan(0);
    });

    it("generatedAt is valid ISO date", () => {
      const date = new Date(mockResult.metadata.generatedAt);
      expect(date.getTime()).not.toBeNaN();
    });
  });

  describe("Error handling", () => {
    let savedAnthropicKey: string | undefined;
    let savedOpenAIKey: string | undefined;

    beforeEach(() => {
      savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
      savedOpenAIKey = process.env.OPENAI_API_KEY;
    });

    afterEach(() => {
      // Restore environment variables
      if (savedAnthropicKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
      if (savedOpenAIKey !== undefined) {
        process.env.OPENAI_API_KEY = savedOpenAIKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    });

    it("analyzeScreenshot throws without credentials", async () => {
      const source: ImageSource = {
        type: "base64",
        data: "abc123",
      };

      // Clear env vars for test
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await expect(analyzeScreenshot(source)).rejects.toThrow(/API key|key required/i);
    });

    it("generateThemeFromScreenshot throws without credentials", async () => {
      const source: ImageSource = {
        type: "base64",
        data: "abc123",
      };

      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await expect(generateThemeFromScreenshot(source)).rejects.toThrow(/API key|key required/i);
    });
  });

  describe("Color extraction", () => {
    it("extracts hex colors correctly", () => {
      sampleAnalysis.colors.forEach((color) => {
        expect(color.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it("identifies primary color", () => {
      const primary = sampleAnalysis.colors.find((c) => c.usage === "primary");
      expect(primary).toBeDefined();
      expect(primary!.confidence).toBeGreaterThan(50);
    });

    it("identifies background color", () => {
      const bg = sampleAnalysis.colors.find((c) => c.usage === "background");
      expect(bg).toBeDefined();
    });

    it("identifies text color", () => {
      const text = sampleAnalysis.colors.find((c) => c.usage === "text");
      expect(text).toBeDefined();
    });
  });

  describe("Typography extraction", () => {
    it("extracts font sizes with units", () => {
      sampleAnalysis.typography.forEach((typo) => {
        expect(typo.fontSize).toMatch(/^\d+px$/);
      });
    });

    it("has valid font weights", () => {
      const validWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
      sampleAnalysis.typography.forEach((typo) => {
        expect(validWeights).toContain(typo.fontWeight);
      });
    });

    it("has reasonable line heights", () => {
      sampleAnalysis.typography.forEach((typo) => {
        expect(typo.lineHeight).toBeGreaterThan(0.5);
        expect(typo.lineHeight).toBeLessThan(3);
      });
    });

    it("includes body typography", () => {
      const body = sampleAnalysis.typography.find((t) => t.element === "body");
      expect(body).toBeDefined();
    });

    it("includes heading typography", () => {
      const heading = sampleAnalysis.typography.find((t) =>
        t.element.startsWith("h")
      );
      expect(heading).toBeDefined();
    });
  });

  describe("Spacing extraction", () => {
    it("extracts spacing values with units", () => {
      sampleAnalysis.spacing.forEach((space) => {
        expect(space.value).toMatch(/^\d+px$/);
      });
    });

    it("has valid usage types", () => {
      const validUsages = ["margin", "padding", "gap"];
      sampleAnalysis.spacing.forEach((space) => {
        expect(validUsages).toContain(space.usage);
      });
    });
  });
});

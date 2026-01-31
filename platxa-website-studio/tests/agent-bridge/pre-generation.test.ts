import { describe, it, expect } from "vitest";
import { runPreGeneration } from "@/lib/agent-bridge/pre-generation";

describe("Pre-Generation Pipeline", () => {
  describe("runPreGeneration", () => {
    describe("design-analyzer integration", () => {
      it("populates designContext from design-analyzer", () => {
        const result = runPreGeneration({
          userMessage: "Create a bold blue hero with grid layout",
        });

        expect(result.designContext).not.toBeNull();
        expect(result.designContext?.prompt).toBe("Create a bold blue hero with grid layout");
      });

      it("extracts colors from user prompt via design-analyzer", () => {
        // Test with only warm colors to get warm mood (mixed warm+cool = null mood)
        const warmResult = runPreGeneration({
          userMessage: "Use coral and orange colors for a warm feel",
        });
        expect(warmResult.designContext?.colors.namedColors).toContain("coral");
        expect(warmResult.designContext?.colors.namedColors).toContain("orange");
        expect(warmResult.designContext?.colors.mood).toBe("warm");

        // Test with only cool colors to get cool mood
        const coolResult = runPreGeneration({
          userMessage: "Use navy and teal colors",
        });
        expect(coolResult.designContext?.colors.namedColors).toContain("navy");
        expect(coolResult.designContext?.colors.namedColors).toContain("teal");
        expect(coolResult.designContext?.colors.mood).toBe("cool");
      });

      it("extracts layout from user prompt via design-analyzer", () => {
        const result = runPreGeneration({
          userMessage: "Build a 3 column grid with full-width hero",
        });

        expect(result.designContext?.layout.style).toContain("grid");
        expect(result.designContext?.layout.columns).toBe(3);
        expect(result.designContext?.layout.fullWidth).toBe(true);
      });

      it("extracts mood from user prompt via design-analyzer", () => {
        const result = runPreGeneration({
          userMessage: "Professional and elegant corporate website",
        });

        expect(result.designContext?.mood.keywords).toContain("professional");
        expect(result.designContext?.mood.keywords).toContain("elegant");
        expect(result.designContext?.mood.formality).toBeGreaterThanOrEqual(4);
      });

      it("extracts typography from user prompt via design-analyzer", () => {
        const result = runPreGeneration({
          userMessage: "Use Playfair Display serif font with large text",
        });

        expect(result.designContext?.typography.fontNames).toContain("Playfair Display");
        expect(result.designContext?.typography.style).toContain("serif");
        expect(result.designContext?.typography.sizePreference).toBe("large");
      });

      it("extracts spacing from user prompt via design-analyzer", () => {
        const result = runPreGeneration({
          userMessage: "Keep it spacious and airy with generous padding",
        });

        expect(result.designContext?.spacing.density).toBe("spacious");
        expect(result.designContext?.spacing.hasSpecifics).toBe(true);
      });

      it("suggests sections from user prompt", () => {
        const result = runPreGeneration({
          userMessage: "Landing page with hero, features, testimonials, and pricing",
        });

        expect(result.designContext?.suggestedSections).toContain("hero");
        expect(result.designContext?.suggestedSections).toContain("features");
        expect(result.designContext?.suggestedSections).toContain("testimonials");
        expect(result.designContext?.suggestedSections).toContain("pricing");
      });

      it("computes confidence score", () => {
        const detailed = runPreGeneration({
          userMessage:
            "Create a professional blue hero landing page with Montserrat font, spacious layout, grid features",
        });
        const vague = runPreGeneration({
          userMessage: "make a website",
        });

        expect(detailed.designContext?.confidence).toBeGreaterThan(
          vague.designContext?.confidence ?? 0
        );
      });
    });

    describe("designAnalysis backward compatibility", () => {
      it("populates designAnalysis with basic info", () => {
        const result = runPreGeneration({
          userMessage: "Create a hero section with blue colors",
        });

        expect(result.designAnalysis).not.toBeNull();
        expect(result.designAnalysis?.componentType).toBe("hero");
      });

      it("merges color mood from design-analyzer to designAnalysis", () => {
        const result = runPreGeneration({
          userMessage: "Use warm red and orange tones",
        });

        expect(result.designAnalysis?.colorIntent?.mood).toBe("warm");
        expect(result.designAnalysis?.colorIntent?.temperature).toBe("warm");
      });

      it("merges layout from design-analyzer to designAnalysis", () => {
        const result = runPreGeneration({
          userMessage: "Use a centered grid layout",
        });

        expect(result.designAnalysis?.layoutIntent?.alignment).toBe("center");
        expect(result.designAnalysis?.layoutIntent?.distribution).toBe("grid");
      });
    });

    describe("enhancedPromptFragment", () => {
      it("includes design context in prompt fragment", () => {
        const result = runPreGeneration({
          userMessage: "Create a bold blue hero with grid layout and spacious feel",
        });

        // Check that rich design context is included
        expect(result.enhancedPromptFragment).toContain("## Design Hints");
        // "bold" triggers "vibrant" mood (high saturation), blue alone gives "cool"
        expect(result.enhancedPromptFragment).toMatch(/Color mood: (vibrant|cool)/);
        expect(result.enhancedPromptFragment).toContain("Layout style:");
        expect(result.enhancedPromptFragment).toContain("grid");
        expect(result.enhancedPromptFragment).toContain("Aesthetic: bold");
        expect(result.enhancedPromptFragment).toContain("Spacing: spacious");
      });

      it("includes requested colors in prompt fragment", () => {
        const result = runPreGeneration({
          userMessage: "Use navy and coral colors",
        });

        // Color order depends on detection order (alphabetical from NAMED_COLORS keys)
        expect(result.enhancedPromptFragment).toContain("Requested colors:");
        expect(result.enhancedPromptFragment).toContain("navy");
        expect(result.enhancedPromptFragment).toContain("coral");
      });

      it("includes typography hints in prompt fragment", () => {
        const result = runPreGeneration({
          userMessage: "Use Inter font with large text",
        });

        expect(result.enhancedPromptFragment).toContain("Requested fonts: Inter");
        expect(result.enhancedPromptFragment).toContain("Text size: large");
      });

      it("includes formality and energy scores", () => {
        const result = runPreGeneration({
          userMessage: "Professional corporate website",
        });

        expect(result.enhancedPromptFragment).toMatch(/Formality: \d\/5/);
        expect(result.enhancedPromptFragment).toMatch(/Energy: \d\/5/);
      });

      it("includes analysis confidence", () => {
        const result = runPreGeneration({
          userMessage: "Create a bold blue hero with Inter font",
        });

        expect(result.enhancedPromptFragment).toMatch(/Analysis confidence: \d+%/);
      });

      it("includes suggested sections", () => {
        const result = runPreGeneration({
          userMessage: "Landing page with hero, features, and pricing",
        });

        expect(result.enhancedPromptFragment).toContain("Suggested sections:");
      });

      it("indicates dark mode when requested", () => {
        const result = runPreGeneration({
          userMessage: "Create a dark theme website",
        });

        expect(result.enhancedPromptFragment).toContain("Dark mode: requested");
      });
    });

    describe("dark mode token generation", () => {
      it("generates dark mode tokens when dark mode requested", () => {
        const result = runPreGeneration({
          userMessage: "Create a dark theme landing page",
          colorPalette: {
            primary: "#3B82F6",
            secondary: "#6B7280",
            accent: "#F59E0B",
            background: "#FFFFFF",
            text: "#1F2937",
          },
        });

        expect(result.brandTokens.darkModeTokens).not.toBeUndefined();
      });

      it("does not generate dark mode tokens for light theme", () => {
        const result = runPreGeneration({
          userMessage: "Create a bright colorful landing page",
          colorPalette: {
            primary: "#3B82F6",
            secondary: "#6B7280",
            accent: "#F59E0B",
            background: "#FFFFFF",
            text: "#1F2937",
          },
        });

        expect(result.brandTokens.darkModeTokens).toBeUndefined();
      });
    });

    describe("comprehensive integration test", () => {
      it("analyzes complex real-world prompt before generation", () => {
        const result = runPreGeneration({
          userMessage:
            "Create a bold, energetic landing page for a SaaS startup with navy and coral colors, " +
            "full-width hero banner, 3 column feature grid, testimonials section, " +
            "and a call-to-action with Inter font. Keep spacing generous.",
          colorPalette: {
            primary: "#1E3A5F",
            secondary: "#FF6B6B",
            accent: "#F59E0B",
            background: "#FFFFFF",
            text: "#1F2937",
          },
          industry: "technology",
          designStyle: "modern",
        });

        // Verify designContext is populated
        expect(result.designContext).not.toBeNull();
        expect(result.designContext?.colors.namedColors).toContain("navy");
        expect(result.designContext?.colors.namedColors).toContain("coral");
        expect(result.designContext?.layout.fullWidth).toBe(true);
        expect(result.designContext?.layout.columns).toBe(3);
        expect(result.designContext?.mood.keywords).toContain("bold");
        expect(result.designContext?.mood.keywords).toContain("energetic");
        expect(result.designContext?.typography.fontNames).toContain("Inter");
        expect(result.designContext?.spacing.density).toBe("spacious");
        expect(result.designContext?.suggestedSections).toContain("hero");
        expect(result.designContext?.suggestedSections).toContain("testimonials");
        expect(result.designContext?.confidence).toBeGreaterThanOrEqual(0.5);

        // Verify prompt fragment includes comprehensive info
        expect(result.enhancedPromptFragment).toContain("## Brand Tokens");
        expect(result.enhancedPromptFragment).toContain("## Design Hints");
        expect(result.enhancedPromptFragment).toContain("Industry: technology");
        expect(result.enhancedPromptFragment).toContain("Style: modern");

        // Verify design tokens generated
        expect(result.brandTokens.designTokens).not.toBeUndefined();

        // Verify timestamp
        expect(result.timestamp).toBeDefined();
        expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
      });
    });
  });
});

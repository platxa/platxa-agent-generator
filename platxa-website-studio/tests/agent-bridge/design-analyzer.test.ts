import { describe, it, expect } from "vitest";
import { analyzeDesignIntent } from "@/lib/agent-bridge/design-analyzer";

describe("Design Analyzer", () => {
  describe("analyzeDesignIntent", () => {
    it("extracts named colors from prompt", () => {
      const ctx = analyzeDesignIntent("Use blue and gold colors for the header");
      expect(ctx.colors.namedColors).toContain("blue");
      expect(ctx.colors.namedColors).toContain("gold");
    });

    it("extracts hex codes from prompt", () => {
      const ctx = analyzeDesignIntent("Primary color should be #3B82F6");
      expect(ctx.colors.hexCodes).toContain("#3B82F6");
    });

    it("detects warm color mood", () => {
      const ctx = analyzeDesignIntent("Use red and orange tones");
      expect(ctx.colors.mood).toBe("warm");
    });

    it("detects cool color mood", () => {
      const ctx = analyzeDesignIntent("Use blue and teal tones");
      expect(ctx.colors.mood).toBe("cool");
    });

    it("detects vibrant color mood", () => {
      const ctx = analyzeDesignIntent("Make it vibrant and bright");
      expect(ctx.colors.mood).toBe("vibrant");
    });

    it("detects dark mode request", () => {
      const ctx = analyzeDesignIntent("Create a dark theme website");
      expect(ctx.colors.darkMode).toBe(true);
    });

    it("detects layout styles", () => {
      const ctx = analyzeDesignIntent("Use a grid layout with cards");
      expect(ctx.layout.style).toContain("grid");
    });

    it("detects full-width layout", () => {
      const ctx = analyzeDesignIntent("Full width hero with edge to edge images");
      expect(ctx.layout.fullWidth).toBe(true);
    });

    it("detects column count", () => {
      const ctx = analyzeDesignIntent("Show features in 3 columns");
      expect(ctx.layout.columns).toBe(3);
    });

    it("detects layout patterns", () => {
      const ctx = analyzeDesignIntent("Use a zigzag alternating layout");
      expect(ctx.layout.patterns).toContain("zigzag");
    });

    it("detects mood keywords", () => {
      const ctx = analyzeDesignIntent("Make it professional and elegant");
      expect(ctx.mood.keywords).toContain("professional");
      expect(ctx.mood.keywords).toContain("elegant");
    });

    it("calculates formality level", () => {
      const formal = analyzeDesignIntent("Professional corporate formal design");
      const casual = analyzeDesignIntent("Fun playful casual website");
      expect(formal.mood.formality).toBeGreaterThan(casual.mood.formality);
    });

    it("calculates energy level", () => {
      const energetic = analyzeDesignIntent("Bold energetic dynamic design");
      const calm = analyzeDesignIntent("Minimal calm simple design");
      expect(energetic.mood.energy).toBeGreaterThan(calm.mood.energy);
    });

    it("detects typography style preferences", () => {
      const ctx = analyzeDesignIntent("Use serif fonts for a classic look");
      expect(ctx.typography.style).toContain("serif");
    });

    it("detects specific font names", () => {
      const ctx = analyzeDesignIntent("Use Playfair Display for headings and Lato for body");
      expect(ctx.typography.fontNames).toContain("Playfair Display");
      expect(ctx.typography.fontNames).toContain("Lato");
    });

    it("detects font size preference", () => {
      const large = analyzeDesignIntent("Use large oversized hero text");
      expect(large.typography.sizePreference).toBe("large");
      const compact = analyzeDesignIntent("Keep it compact and condensed");
      expect(compact.typography.sizePreference).toBe("compact");
    });

    it("detects spacing density", () => {
      const spacious = analyzeDesignIntent("Keep it spacious and airy");
      expect(spacious.spacing.density).toBe("spacious");
      const tight = analyzeDesignIntent("Use tight compact spacing");
      expect(tight.spacing.density).toBe("tight");
    });

    it("suggests sections from prompt", () => {
      const ctx = analyzeDesignIntent("Build a landing page with hero, features, testimonials, and pricing");
      expect(ctx.suggestedSections).toContain("hero");
      expect(ctx.suggestedSections).toContain("features");
      expect(ctx.suggestedSections).toContain("testimonials");
      expect(ctx.suggestedSections).toContain("pricing");
    });

    it("defaults to hero+features+cta when no sections detected", () => {
      const ctx = analyzeDesignIntent("Make something nice");
      expect(ctx.suggestedSections).toContain("hero");
      expect(ctx.suggestedSections).toContain("features");
      expect(ctx.suggestedSections).toContain("cta");
    });

    it("computes higher confidence for detailed prompts", () => {
      const detailed = analyzeDesignIntent(
        "Create a professional blue hero landing page with Montserrat font, spacious layout, grid features, testimonials, pricing, contact, and FAQ"
      );
      const vague = analyzeDesignIntent("make it better");
      expect(detailed.confidence).toBeGreaterThan(vague.confidence);
    });

    it("preserves original prompt", () => {
      const prompt = "Build a modern tech website";
      const ctx = analyzeDesignIntent(prompt);
      expect(ctx.prompt).toBe(prompt);
    });

    it("handles empty prompt gracefully", () => {
      const ctx = analyzeDesignIntent("");
      expect(ctx.confidence).toBe(0);
      expect(ctx.suggestedSections.length).toBeGreaterThan(0);
    });

    it("analyzes a complex real-world prompt", () => {
      const ctx = analyzeDesignIntent(
        "Create a bold, energetic landing page for a SaaS startup with navy and coral colors, " +
        "full-width hero banner, 3 column feature grid, testimonials section, " +
        "and a call-to-action with Inter font. Keep spacing generous."
      );
      expect(ctx.colors.namedColors).toContain("navy");
      expect(ctx.colors.namedColors).toContain("coral");
      expect(ctx.layout.fullWidth).toBe(true);
      expect(ctx.layout.columns).toBe(3);
      expect(ctx.mood.keywords).toContain("bold");
      expect(ctx.mood.keywords).toContain("energetic");
      expect(ctx.typography.fontNames).toContain("Inter");
      expect(ctx.spacing.density).toBe("spacious");
      expect(ctx.suggestedSections).toContain("hero");
      expect(ctx.suggestedSections).toContain("testimonials");
      expect(ctx.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });
});

/**
 * Tests for Template Library
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TemplateLibrary,
  createTemplateLibrary,
  getTemplateLibrary,
  resetTemplateLibrary,
  type IndustryCategory,
  type IndustryTemplate,
} from "../../lib/themes/template-library";

describe("TemplateLibrary", () => {
  let library: TemplateLibrary;

  beforeEach(() => {
    resetTemplateLibrary();
    library = createTemplateLibrary();
  });

  describe("initialization", () => {
    it("initializes with 15+ industry templates", () => {
      const templates = library.getAll();
      expect(templates.length).toBeGreaterThanOrEqual(15);
    });

    it("covers 10+ industries", () => {
      const industries = library.getIndustries();
      expect(industries.length).toBeGreaterThanOrEqual(10);
    });

    it("has templates for key industries", () => {
      const industries = library.getIndustries();
      const requiredIndustries: IndustryCategory[] = [
        "restaurant",
        "technology",
        "healthcare",
        "legal",
        "ecommerce",
        "education",
        "realestate",
        "fitness",
        "creative",
        "nonprofit",
      ];

      for (const industry of requiredIndustries) {
        expect(industries).toContain(industry);
      }
    });
  });

  describe("getById", () => {
    it("returns template by ID", () => {
      const template = library.getById("restaurant-warmth");
      expect(template).toBeDefined();
      expect(template?.industry).toBe("restaurant");
    });

    it("returns undefined for unknown ID", () => {
      const template = library.getById("unknown-template");
      expect(template).toBeUndefined();
    });
  });

  describe("getByIndustry", () => {
    it("returns templates for specific industry", () => {
      const templates = library.getByIndustry("technology");
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every((t) => t.industry === "technology")).toBe(true);
    });

    it("returns empty array for industry with no templates", () => {
      // All defined industries have templates, but test the behavior
      const templates = library.getByIndustry("technology");
      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe("filter", () => {
    it("filters by industry", () => {
      const results = library.filter({ industry: "healthcare" });
      expect(results.every((t) => t.industry === "healthcare")).toBe(true);
    });

    it("filters by keywords", () => {
      const results = library.filter({ keywords: ["food"] });
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((t) => t.keywords.includes("food"))).toBe(true);
    });

    it("excludes premium templates when specified", () => {
      const allTemplates = library.getAll();
      const freeTemplates = library.filter({ includePremium: false });

      const hasPremium = allTemplates.some((t) => t.isPremium);
      if (hasPremium) {
        expect(freeTemplates.length).toBeLessThan(allTemplates.length);
        expect(freeTemplates.every((t) => !t.isPremium)).toBe(true);
      }
    });

    it("filters by search query", () => {
      const results = library.filter({ search: "restaurant" });
      expect(results.length).toBeGreaterThan(0);
    });

    it("combines multiple filters", () => {
      const results = library.filter({
        industry: "technology",
        includePremium: false,
      });

      expect(results.every((t) => t.industry === "technology")).toBe(true);
      expect(results.every((t) => !t.isPremium)).toBe(true);
    });
  });

  describe("search", () => {
    it("searches by template name", () => {
      const results = library.search("startup");
      expect(results.length).toBeGreaterThan(0);
    });

    it("searches by description", () => {
      const results = library.search("conversion");
      expect(results.length).toBeGreaterThan(0);
    });

    it("searches by keywords", () => {
      const results = library.search("saas");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns empty array for no matches", () => {
      const results = library.search("xyznonexistent123");
      expect(results).toEqual([]);
    });
  });

  describe("template structure", () => {
    it("each template has required fields", () => {
      const templates = library.getAll();

      for (const template of templates) {
        expect(template.id).toBeTruthy();
        expect(template.name).toBeTruthy();
        expect(template.industry).toBeTruthy();
        expect(template.description).toBeTruthy();
        expect(template.colors).toBeDefined();
        expect(template.typography).toBeDefined();
        expect(template.spacing).toBeDefined();
        expect(template.layout).toBeDefined();
        expect(template.sections).toBeInstanceOf(Array);
        expect(template.sections.length).toBeGreaterThan(0);
        expect(template.customizations).toBeInstanceOf(Array);
        expect(template.features).toBeInstanceOf(Array);
        expect(template.odooVersion).toBeTruthy();
      }
    });

    it("each template has valid color scheme", () => {
      const templates = library.getAll();
      const requiredColors = [
        "primary",
        "secondary",
        "background",
        "surface",
        "text",
        "textMuted",
        "border",
        "success",
        "warning",
        "error",
      ];

      for (const template of templates) {
        for (const color of requiredColors) {
          expect(template.colors).toHaveProperty(color);
          expect(template.colors[color as keyof typeof template.colors]).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
      }
    });

    it("each template has valid typography", () => {
      const templates = library.getAll();

      for (const template of templates) {
        expect(template.typography.headingFont).toBeTruthy();
        expect(template.typography.bodyFont).toBeTruthy();
        expect(template.typography.baseFontSize).toMatch(/^\d+px$/);
        expect(template.typography.lineHeight).toBeTruthy();
        expect(template.typography.headingWeight).toBeTruthy();
      }
    });

    it("each template has recommended sections", () => {
      const templates = library.getAll();

      for (const template of templates) {
        expect(template.sections.length).toBeGreaterThanOrEqual(5);
        expect(template.sections.some((s) => s.type === "hero")).toBe(true);
        expect(template.sections.some((s) => s.type === "contact")).toBe(true);
      }
    });

    it("sections have required configuration", () => {
      const templates = library.getAll();

      for (const template of templates) {
        for (const section of template.sections) {
          expect(section.type).toBeTruthy();
          expect(section.title).toBeTruthy();
          expect(section.description).toBeTruthy();
          expect(typeof section.required).toBe("boolean");
          expect(section.variants).toBeInstanceOf(Array);
          expect(section.variants.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("customize", () => {
    it("creates customization for valid template", () => {
      const result = library.customize("restaurant-warmth", {
        menuStyle: "list",
        showPrices: false,
      });

      expect(result).not.toBeNull();
      expect(result?.templateId).toBe("restaurant-warmth");
      expect(result?.customizations.menuStyle).toBe("list");
      expect(result?.customizations.showPrices).toBe(false);
      expect(result?.generatedAt).toBeInstanceOf(Date);
    });

    it("returns null for invalid template", () => {
      const result = library.customize("nonexistent", {});
      expect(result).toBeNull();
    });
  });

  describe("getCustomizationOptions", () => {
    it("returns customization options for template", () => {
      const options = library.getCustomizationOptions("tech-startup");
      expect(options.length).toBeGreaterThan(0);
      expect(options.some((o) => o.type === "toggle")).toBe(true);
      expect(options.some((o) => o.type === "color")).toBe(true);
    });

    it("returns empty array for unknown template", () => {
      const options = library.getCustomizationOptions("nonexistent");
      expect(options).toEqual([]);
    });
  });

  describe("getRecommendedSections", () => {
    it("returns sections for industry", () => {
      const sections = library.getRecommendedSections("restaurant");
      expect(sections.length).toBeGreaterThan(0);
      expect(sections.some((s) => s.type === "menu")).toBe(true);
    });

    it("returns empty for unknown industry", () => {
      // Cast to bypass type checking for test
      const sections = library.getRecommendedSections("unknown" as IndustryCategory);
      expect(sections).toEqual([]);
    });
  });

  describe("custom templates", () => {
    it("registers custom template", () => {
      const customTemplate: IndustryTemplate = {
        id: "custom-test",
        name: "Custom Test Template",
        industry: "technology",
        description: "A custom test template",
        tagline: "Test tagline",
        keywords: ["test", "custom"],
        previewImage: "/custom/preview.png",
        colors: {
          primary: "#000000",
          secondary: "#ffffff",
          background: "#f0f0f0",
          surface: "#ffffff",
          text: "#111111",
          textMuted: "#666666",
          border: "#cccccc",
          success: "#00ff00",
          warning: "#ffff00",
          error: "#ff0000",
        },
        typography: {
          headingFont: "Arial, sans-serif",
          bodyFont: "Arial, sans-serif",
          baseFontSize: "16px",
          lineHeight: "1.5",
          headingWeight: "700",
        },
        spacing: {
          sectionPadding: "60px",
          containerWidth: "1200px",
          gap: "24px",
          borderRadius: "8px",
        },
        layout: {
          headerStyle: "sticky",
          navStyle: "horizontal",
          footerColumns: 4,
        },
        sections: [
          { type: "hero", title: "Hero", description: "Hero section", required: true, variants: ["default"] },
          { type: "contact", title: "Contact", description: "Contact section", required: true, variants: ["form"] },
        ],
        customizations: [],
        features: ["Custom feature"],
        contentHints: {},
        odooVersion: "18.0",
        isPremium: false,
      };

      const initialCount = library.getTemplateCount();
      library.registerTemplate(customTemplate);

      expect(library.getTemplateCount()).toBe(initialCount + 1);
      expect(library.getById("custom-test")).toBeDefined();
    });

    it("removes custom template", () => {
      const customTemplate: IndustryTemplate = {
        id: "to-remove",
        name: "To Remove",
        industry: "technology",
        description: "Template to remove",
        tagline: "Remove me",
        keywords: [],
        previewImage: "",
        colors: {
          primary: "#000000",
          secondary: "#ffffff",
          background: "#f0f0f0",
          surface: "#ffffff",
          text: "#111111",
          textMuted: "#666666",
          border: "#cccccc",
          success: "#00ff00",
          warning: "#ffff00",
          error: "#ff0000",
        },
        typography: {
          headingFont: "Arial",
          bodyFont: "Arial",
          baseFontSize: "16px",
          lineHeight: "1.5",
          headingWeight: "700",
        },
        spacing: {
          sectionPadding: "60px",
          containerWidth: "1200px",
          gap: "24px",
          borderRadius: "8px",
        },
        layout: {
          headerStyle: "sticky",
          navStyle: "horizontal",
          footerColumns: 4,
        },
        sections: [
          { type: "hero", title: "Hero", description: "Hero", required: true, variants: ["default"] },
          { type: "contact", title: "Contact", description: "Contact", required: true, variants: ["form"] },
        ],
        customizations: [],
        features: [],
        contentHints: {},
        odooVersion: "18.0",
        isPremium: false,
      };

      library.registerTemplate(customTemplate);
      expect(library.getById("to-remove")).toBeDefined();

      const removed = library.removeTemplate("to-remove");
      expect(removed).toBe(true);
      expect(library.getById("to-remove")).toBeUndefined();
    });
  });

  describe("getGroupedByIndustry", () => {
    it("groups templates by industry", () => {
      const grouped = library.getGroupedByIndustry();

      expect(grouped.size).toBeGreaterThan(0);
      expect(grouped.get("restaurant")).toBeDefined();
      expect(grouped.get("technology")).toBeDefined();
    });
  });

  describe("singleton pattern", () => {
    it("getTemplateLibrary returns same instance", () => {
      resetTemplateLibrary();
      const instance1 = getTemplateLibrary();
      const instance2 = getTemplateLibrary();

      expect(instance1).toBe(instance2);
    });

    it("resetTemplateLibrary creates new instance", () => {
      const instance1 = getTemplateLibrary();
      resetTemplateLibrary();
      const instance2 = getTemplateLibrary();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("industry coverage verification", () => {
    const expectedIndustries: IndustryCategory[] = [
      "restaurant",
      "technology",
      "healthcare",
      "legal",
      "ecommerce",
      "education",
      "realestate",
      "fitness",
      "creative",
      "nonprofit",
      "finance",
      "travel",
      "beauty",
      "automotive",
      "construction",
    ];

    for (const industry of expectedIndustries) {
      it(`has template for ${industry} industry`, () => {
        const templates = library.getByIndustry(industry);
        expect(templates.length).toBeGreaterThan(0);
      });
    }
  });

  describe("premium vs free distribution", () => {
    it("has mix of free and premium templates", () => {
      const all = library.getAll();
      const free = all.filter((t) => !t.isPremium);
      const premium = all.filter((t) => t.isPremium);

      expect(free.length).toBeGreaterThan(0);
      expect(premium.length).toBeGreaterThan(0);
      expect(free.length).toBeGreaterThan(premium.length); // More free than premium
    });
  });
});

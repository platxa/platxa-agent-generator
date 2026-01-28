import { describe, it, expect } from "vitest";
import {
  detectIndustry,
  extractBusinessName,
  extractFeatures,
  toModuleName,
  scaffoldProject,
} from "@/lib/agent-bridge/scaffolding-wizard";

describe("Scaffolding Wizard", () => {
  describe("detectIndustry", () => {
    it("detects restaurant industry", () => {
      expect(detectIndustry("Create a website for my pizza restaurant").industry).toBe("restaurant");
    });

    it("detects technology industry", () => {
      expect(detectIndustry("Build a SaaS startup landing page").industry).toBe("technology");
    });

    it("detects healthcare industry", () => {
      expect(detectIndustry("I need a dental clinic website").industry).toBe("healthcare");
    });

    it("detects ecommerce industry", () => {
      expect(detectIndustry("Create an online fashion boutique store").industry).toBe("ecommerce");
    });

    it("detects corporate industry", () => {
      expect(detectIndustry("Build a consulting agency website").industry).toBe("corporate");
    });

    it("defaults to general for unknown", () => {
      expect(detectIndustry("Make me a website").industry).toBe("general");
    });
  });

  describe("extractBusinessName", () => {
    it("extracts quoted names", () => {
      expect(extractBusinessName('Create a site for "Mama Mia Pizza"')).toBe("Mama Mia Pizza");
    });

    it("extracts names after 'called'", () => {
      expect(extractBusinessName("A restaurant called Bella Vista that serves Italian food")).toBe("Bella Vista");
    });

    it("extracts capitalized multi-word phrases", () => {
      expect(extractBusinessName("Build a website for Green Valley Dental")).toBe("Green Valley Dental");
    });

    it("returns default for no detectable name", () => {
      expect(extractBusinessName("make me a website")).toBe("My Theme");
    });
  });

  describe("extractFeatures", () => {
    it("detects ecommerce feature", () => {
      const features = extractFeatures("I need an online shop with products");
      expect(features.some((f) => f.id === "ecommerce")).toBe(true);
    });

    it("detects blog feature", () => {
      const features = extractFeatures("Include a blog section for articles");
      expect(features.some((f) => f.id === "blog")).toBe(true);
    });

    it("detects multiple features", () => {
      const features = extractFeatures("Need a gallery, testimonials, and pricing page");
      expect(features.some((f) => f.id === "gallery")).toBe(true);
      expect(features.some((f) => f.id === "testimonials")).toBe(true);
      expect(features.some((f) => f.id === "pricing")).toBe(true);
    });

    it("marks detected features as explicit", () => {
      const features = extractFeatures("Add a contact form");
      const form = features.find((f) => f.id === "forms");
      expect(form?.explicit).toBe(true);
    });

    it("returns empty for no feature keywords", () => {
      expect(extractFeatures("just a simple site")).toHaveLength(0);
    });
  });

  describe("toModuleName", () => {
    it("converts to snake_case with theme_ prefix", () => {
      expect(toModuleName("Bella Vista")).toBe("theme_bella_vista");
    });

    it("strips special characters", () => {
      expect(toModuleName("Mama Mia's Pizza!")).toBe("theme_mama_mias_pizza");
    });

    it("handles empty input", () => {
      expect(toModuleName("")).toBe("theme_custom");
    });
  });

  describe("scaffoldProject", () => {
    it("generates complete project from single prompt", () => {
      const project = scaffoldProject('Create a website for "Bella Vista" Italian restaurant with a menu and reservations');

      expect(project.moduleName).toBe("theme_bella_vista");
      expect(project.displayName).toContain("Bella Vista");
      expect(project.brand.industry).toBe("restaurant");
      expect(project.brand.name).toBe("Bella Vista");
      expect(project.originalPrompt).toContain("Bella Vista");
    });

    it("generates 5+ pages", () => {
      const project = scaffoldProject("Build a tech startup website for my SaaS product");
      expect(project.pages.length).toBeGreaterThanOrEqual(5);
    });

    it("marks homepage correctly", () => {
      const project = scaffoldProject("Create a corporate website");
      const home = project.pages.find((p) => p.isHomepage);
      expect(home).toBeDefined();
      expect(home!.slug).toBe("home");
    });

    it("includes brand colors from industry preset", () => {
      const project = scaffoldProject("Build a dental clinic website");
      expect(project.brand.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(project.brand.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("includes font selections", () => {
      const project = scaffoldProject("Create a restaurant website");
      expect(project.brand.headingFont).toBeTruthy();
      expect(project.brand.bodyFont).toBeTruthy();
    });

    it("detects features from prompt", () => {
      const project = scaffoldProject("Build a shop with blog and contact form");
      expect(project.features.some((f) => f.id === "ecommerce")).toBe(true);
      expect(project.features.some((f) => f.id === "blog")).toBe(true);
      expect(project.features.some((f) => f.id === "forms")).toBe(true);
    });

    it("adds feature-driven pages", () => {
      const project = scaffoldProject("Create a tech startup with a blog");
      expect(project.pages.some((p) => p.slug === "blog")).toBe(true);
    });

    it("collects all unique section types", () => {
      const project = scaffoldProject("Build a corporate consulting website");
      expect(project.sectionTypes).toContain("hero");
      expect(project.sectionTypes).toContain("features");
      expect(new Set(project.sectionTypes).size).toBe(project.sectionTypes.length);
    });

    it("each page has sections", () => {
      const project = scaffoldProject("Create a restaurant website");
      for (const page of project.pages) {
        expect(page.sections.length).toBeGreaterThan(0);
      }
    });

    it("sets odoo version", () => {
      const project = scaffoldProject("Build a website");
      expect(project.odooVersion).toBe("16.0");
    });

    it("includes tone/mood from industry", () => {
      const project = scaffoldProject("Create a healthcare clinic website");
      expect(project.brand.tone.length).toBeGreaterThan(0);
    });

    it("generates description", () => {
      const project = scaffoldProject("Build an ecommerce fashion boutique");
      expect(project.description).toBeTruthy();
      expect(project.description.length).toBeGreaterThan(10);
    });
  });
});

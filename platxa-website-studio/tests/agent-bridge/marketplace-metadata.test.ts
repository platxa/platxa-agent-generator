import { describe, it, expect } from "vitest";
import { generateMarketplaceMetadata } from "@/lib/agent-bridge/marketplace-metadata";
import type { MetadataInput } from "@/lib/agent-bridge/marketplace-metadata";

const makeInput = (overrides?: Partial<MetadataInput>): MetadataInput => ({
  themeName: "theme_flavor",
  displayName: "Flavor Theme",
  primaryColor: "#3B82F6",
  secondaryColor: "#FFFFFF",
  sections: ["hero", "features", "about", "testimonials", "cta", "footer"],
  ...overrides,
});

describe("Marketplace Metadata Generator", () => {
  describe("generateMarketplaceMetadata", () => {
    it("generates a 256x256 icon spec", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      expect(meta.icon.width).toBe(256);
      expect(meta.icon.height).toBe(256);
      expect(meta.icon.backgroundColor).toBe("#3B82F6");
      expect(meta.icon.label).toBe("FT");
      expect(meta.icon.path).toContain("icon.png");
    });

    it("generates 3+ screenshots", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      expect(meta.screenshots.length).toBeGreaterThanOrEqual(3);
    });

    it("includes desktop and mobile screenshots", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      const titles = meta.screenshots.map((s) => s.title);
      expect(titles).toContain("Desktop Full Page");
      expect(titles).toContain("Mobile Responsive");
    });

    it("generates screenshot paths in static/description/", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      expect(meta.screenshots.every((s) => s.path.startsWith("static/description/"))).toBe(true);
    });

    it("generates HTML description with oe_container sections", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      expect(meta.htmlDescription).toContain("oe_container");
      expect(meta.htmlDescription).toContain("Key Features");
      expect(meta.htmlDescription).toContain("Included Sections");
      expect(meta.htmlDescription).toContain("Compatibility");
    });

    it("includes display name in HTML description", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      expect(meta.htmlDescription).toContain("Flavor Theme");
    });

    it("generates feature list with core features", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      expect(meta.features.some((f) => f.includes("responsive"))).toBe(true);
      expect(meta.features.some((f) => f.includes("accessibility") || f.includes("WCAG"))).toBe(true);
    });

    it("includes section count in features", () => {
      const meta = generateMarketplaceMetadata(makeInput({ sections: ["hero", "features", "footer"] }));
      expect(meta.features.some((f) => f.includes("3"))).toBe(true);
    });

    it("adds eCommerce features when enabled", () => {
      const meta = generateMarketplaceMetadata(makeInput({ hasEcommerce: true }));
      expect(meta.features.some((f) => f.toLowerCase().includes("ecommerce") || f.toLowerCase().includes("commerce"))).toBe(true);
      expect(meta.categories).toContain("eCommerce");
    });

    it("adds blog features when enabled", () => {
      const meta = generateMarketplaceMetadata(makeInput({ hasBlog: true }));
      expect(meta.features.some((f) => f.toLowerCase().includes("blog"))).toBe(true);
      expect(meta.categories).toContain("Blog");
    });

    it("always includes Theme and Website categories", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      expect(meta.categories).toContain("Theme");
      expect(meta.categories).toContain("Website");
    });

    it("generates search keywords", () => {
      const meta = generateMarketplaceMetadata(makeInput({ industry: "Restaurant" }));
      expect(meta.keywords).toContain("odoo theme");
      expect(meta.keywords).toContain("restaurant");
    });

    it("generates summary under 150 chars", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      expect(meta.summary.length).toBeLessThanOrEqual(150);
    });

    it("truncates long descriptions in summary", () => {
      const meta = generateMarketplaceMetadata(makeInput({
        description: "A".repeat(200),
      }));
      expect(meta.summary.length).toBeLessThanOrEqual(150);
      expect(meta.summary).toMatch(/\.\.\.$/);
    });

    it("includes additional features", () => {
      const meta = generateMarketplaceMetadata(makeInput({
        additionalFeatures: ["Custom animation effects"],
      }));
      expect(meta.features).toContain("Custom animation effects");
    });

    it("sets price tier to professional for eCommerce", () => {
      const meta = generateMarketplaceMetadata(makeInput({ hasEcommerce: true }));
      expect(meta.priceTier).toBe("professional");
    });

    it("sets price tier to starter for basic themes", () => {
      const meta = generateMarketplaceMetadata(makeInput());
      expect(meta.priceTier).toBe("starter");
    });

    it("escapes HTML in description", () => {
      const meta = generateMarketplaceMetadata(makeInput({
        displayName: "Theme <script>alert(1)</script>",
      }));
      expect(meta.htmlDescription).not.toContain("<script>");
      expect(meta.htmlDescription).toContain("&lt;script&gt;");
    });

    it("includes Odoo version", () => {
      const meta = generateMarketplaceMetadata(makeInput({ odooVersion: "17.0" }));
      expect(meta.odooVersions).toContain("17.0");
      expect(meta.htmlDescription).toContain("17.0");
    });
  });
});

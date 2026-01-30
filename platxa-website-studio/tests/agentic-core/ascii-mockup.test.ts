/**
 * Tests for ASCII Mockup Generator
 *
 * Feature #47: Create ASCII mockup generator for quick option visualization
 * Verification: Generates simple ASCII layout showing section arrangement
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AsciiMockup,
  createAsciiMockup,
  renderPreset,
  quickMockup,
  compareLayouts,
  LAYOUT_PRESETS,
  type MockupLayout,
  type MockupSection,
  type SectionType,
} from "../../lib/agentic-core/ascii-mockup";

describe("AsciiMockup", () => {
  let mockup: AsciiMockup;

  beforeEach(() => {
    mockup = new AsciiMockup();
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      const instance = new AsciiMockup();
      const options = instance.getOptions();

      expect(options.width).toBe(60);
      expect(options.useBoxChars).toBe(true);
      expect(options.showLabels).toBe(true);
      expect(options.padding).toBe(1);
      expect(options.showGrid).toBe(true);
    });

    it("should accept custom options", () => {
      const instance = new AsciiMockup({
        width: 80,
        useBoxChars: false,
        showLabels: false,
      });
      const options = instance.getOptions();

      expect(options.width).toBe(80);
      expect(options.useBoxChars).toBe(false);
      expect(options.showLabels).toBe(false);
    });
  });

  describe("render", () => {
    it("should render a simple vertical layout", () => {
      const layout: MockupLayout = {
        name: "Simple",
        sections: [
          { type: "header" },
          { type: "content" },
          { type: "footer" },
        ],
      };

      const result = mockup.render(layout);

      expect(result.ascii).toContain("Simple");
      expect(result.ascii).toContain("HEADER");
      expect(result.ascii).toContain("CONTENT");
      expect(result.ascii).toContain("FOOTER");
      expect(result.layout).toBe(layout);
    });

    it("should render with box drawing characters by default", () => {
      const layout: MockupLayout = {
        name: "Box Test",
        sections: [{ type: "header" }],
      };

      const result = mockup.render(layout);

      expect(result.ascii).toContain("┌");
      expect(result.ascii).toContain("┐");
      expect(result.ascii).toContain("└");
      expect(result.ascii).toContain("┘");
      expect(result.ascii).toContain("│");
      expect(result.ascii).toContain("─");
    });

    it("should render with ASCII characters when useBoxChars is false", () => {
      const layout: MockupLayout = {
        name: "ASCII Test",
        sections: [{ type: "header" }],
      };

      const result = mockup.render(layout, { useBoxChars: false });

      expect(result.ascii).toContain("+");
      expect(result.ascii).toContain("-");
      expect(result.ascii).toContain("|");
      expect(result.ascii).not.toContain("┌");
    });

    it("should hide labels when showLabels is false", () => {
      const layout: MockupLayout = {
        name: "No Labels",
        sections: [{ type: "header" }, { type: "hero" }],
      };

      const result = mockup.render(layout, { showLabels: false });

      expect(result.ascii).not.toContain("HEADER");
      expect(result.ascii).not.toContain("HERO");
    });

    it("should use custom labels when provided", () => {
      const layout: MockupLayout = {
        name: "Custom Labels",
        sections: [
          { type: "header", label: "MY HEADER" },
          { type: "content", label: "MAIN AREA" },
        ],
      };

      const result = mockup.render(layout);

      expect(result.ascii).toContain("MY HEADER");
      expect(result.ascii).toContain("MAIN AREA");
    });

    it("should respect custom width", () => {
      const layout: MockupLayout = {
        name: "Wide",
        width: 80,
        sections: [{ type: "header" }],
      };

      const result = mockup.render(layout);
      const lines = result.ascii.split("\n");
      const contentLines = lines.filter((l) => l.includes("─") || l.includes("-"));

      // At least one line should be close to 80 chars
      expect(contentLines.some((l) => l.length >= 78)).toBe(true);
    });

    it("should respect custom height for sections", () => {
      const layout: MockupLayout = {
        name: "Tall Hero",
        sections: [
          { type: "header" },
          { type: "hero", height: 8 },
          { type: "footer" },
        ],
      };

      const result = mockup.render(layout);
      const lines = result.ascii.split("\n");

      // Layout should be taller due to hero height
      expect(lines.length).toBeGreaterThan(15);
    });
  });

  describe("horizontal layouts", () => {
    it("should render horizontal child sections", () => {
      const layout: MockupLayout = {
        name: "Two Columns",
        sections: [
          { type: "header" },
          {
            type: "content",
            children: [
              { type: "content", width: 8 },
              { type: "sidebar", width: 4 },
            ],
            childDirection: "horizontal",
          },
          { type: "footer" },
        ],
      };

      const result = mockup.render(layout);

      expect(result.ascii).toContain("CONTENT");
      expect(result.ascii).toContain("SIDEBAR");
    });

    it("should distribute width based on column spans", () => {
      const layout: MockupLayout = {
        name: "Columns",
        sections: [
          {
            type: "content",
            children: [
              { type: "content", width: 6 },
              { type: "sidebar", width: 6 },
            ],
            childDirection: "horizontal",
          },
        ],
      };

      const result = mockup.render(layout);

      // Both sections should be present
      expect(result.ascii).toContain("CONTENT");
      expect(result.ascii).toContain("SIDEBAR");
    });
  });

  describe("quick", () => {
    it("should create mockup from section types", () => {
      const result = mockup.quick("Quick Page", "header", "hero", "footer");

      expect(result.ascii).toContain("Quick Page");
      expect(result.ascii).toContain("HEADER");
      expect(result.ascii).toContain("HERO");
      expect(result.ascii).toContain("FOOTER");
    });

    it("should handle single section", () => {
      const result = mockup.quick("Single", "hero");

      expect(result.ascii).toContain("Single");
      expect(result.ascii).toContain("HERO");
    });
  });

  describe("setOptions / getOptions", () => {
    it("should update options", () => {
      mockup.setOptions({ width: 100, showLabels: false });
      const options = mockup.getOptions();

      expect(options.width).toBe(100);
      expect(options.showLabels).toBe(false);
      expect(options.useBoxChars).toBe(true); // unchanged
    });
  });
});

describe("createAsciiMockup", () => {
  it("should create instance with factory function", () => {
    const instance = createAsciiMockup({ width: 70 });

    expect(instance).toBeInstanceOf(AsciiMockup);
    expect(instance.getOptions().width).toBe(70);
  });
});

describe("renderPreset", () => {
  it("should render landing preset", () => {
    const result = renderPreset("landing");

    expect(result.ascii).toContain("Landing Page");
    expect(result.ascii).toContain("HEADER");
    expect(result.ascii).toContain("HERO");
    expect(result.ascii).toContain("FEATURES");
    expect(result.ascii).toContain("FOOTER");
  });

  it("should render blog preset", () => {
    const result = renderPreset("blog");

    expect(result.ascii).toContain("Blog Layout");
    expect(result.ascii).toContain("POSTS");
    expect(result.ascii).toContain("SIDEBAR");
  });

  it("should render ecommerce preset", () => {
    const result = renderPreset("ecommerce");

    expect(result.ascii).toContain("E-commerce");
    expect(result.ascii).toContain("PRODUCTS");
  });

  it("should render portfolio preset", () => {
    const result = renderPreset("portfolio");

    expect(result.ascii).toContain("Portfolio");
    expect(result.ascii).toContain("WORK");
  });

  it("should render documentation preset", () => {
    const result = renderPreset("documentation");

    expect(result.ascii).toContain("Documentation");
    expect(result.ascii).toContain("TOC");
    expect(result.ascii).toContain("DOCS");
  });

  it("should render pricing preset", () => {
    const result = renderPreset("pricing");

    expect(result.ascii).toContain("Pricing Page");
    expect(result.ascii).toContain("PRICING");
  });

  it("should throw for unknown preset", () => {
    expect(() => renderPreset("unknown" as any)).toThrow("Unknown preset");
  });

  it("should accept custom options", () => {
    const result = renderPreset("landing", { useBoxChars: false });

    expect(result.ascii).toContain("+");
    expect(result.ascii).not.toContain("┌");
  });
});

describe("quickMockup", () => {
  it("should create quick mockup from types array", () => {
    const result = quickMockup("Test", ["header", "content", "footer"]);

    expect(result.ascii).toContain("Test");
    expect(result.ascii).toContain("HEADER");
    expect(result.ascii).toContain("CONTENT");
    expect(result.ascii).toContain("FOOTER");
  });

  it("should accept options", () => {
    const result = quickMockup("Test", ["header"], { width: 40 });

    expect(result.options.width).toBe(40);
  });
});

describe("compareLayouts", () => {
  it("should render multiple layouts side by side", () => {
    const layouts: MockupLayout[] = [
      { name: "Option A", sections: [{ type: "header" }, { type: "footer" }] },
      { name: "Option B", sections: [{ type: "header" }, { type: "hero" }, { type: "footer" }] },
    ];

    const result = compareLayouts(layouts);

    expect(result).toContain("Option A");
    expect(result).toContain("Option B");
  });

  it("should handle single layout", () => {
    const layouts: MockupLayout[] = [
      { name: "Solo", sections: [{ type: "header" }] },
    ];

    const result = compareLayouts(layouts);

    expect(result).toContain("Solo");
  });
});

describe("LAYOUT_PRESETS", () => {
  it("should have all expected presets", () => {
    expect(LAYOUT_PRESETS).toHaveProperty("landing");
    expect(LAYOUT_PRESETS).toHaveProperty("blog");
    expect(LAYOUT_PRESETS).toHaveProperty("ecommerce");
    expect(LAYOUT_PRESETS).toHaveProperty("portfolio");
    expect(LAYOUT_PRESETS).toHaveProperty("documentation");
    expect(LAYOUT_PRESETS).toHaveProperty("pricing");
  });

  it("should have valid structure for all presets", () => {
    for (const [name, preset] of Object.entries(LAYOUT_PRESETS)) {
      expect(preset.name).toBeTruthy();
      expect(Array.isArray(preset.sections)).toBe(true);
      expect(preset.sections.length).toBeGreaterThan(0);

      for (const section of preset.sections) {
        expect(section.type).toBeTruthy();
      }
    }
  });
});

describe("section types", () => {
  const allTypes: SectionType[] = [
    "header",
    "hero",
    "nav",
    "content",
    "sidebar",
    "footer",
    "image",
    "text",
    "cta",
    "features",
    "gallery",
    "testimonials",
    "pricing",
    "contact",
    "form",
    "cards",
    "video",
    "banner",
    "breadcrumb",
    "search",
    "custom",
  ];

  it("should render all section types", () => {
    for (const type of allTypes) {
      const result = quickMockup(`Test ${type}`, [type]);
      expect(result.ascii).toBeTruthy();
      expect(result.ascii.split("\n").length).toBeGreaterThan(2);
    }
  });
});

describe("edge cases", () => {
  let mockup: AsciiMockup;

  beforeEach(() => {
    mockup = new AsciiMockup();
  });

  it("should handle empty sections array", () => {
    const layout: MockupLayout = {
      name: "Empty",
      sections: [],
    };

    const result = mockup.render(layout);

    expect(result.ascii).toContain("Empty");
  });

  it("should handle deeply nested sections", () => {
    const layout: MockupLayout = {
      name: "Nested",
      sections: [
        {
          type: "content",
          children: [
            {
              type: "content",
              width: 6,
              children: [
                { type: "nav" },
                { type: "content" },
              ],
              childDirection: "vertical",
            },
            { type: "sidebar", width: 6 },
          ],
          childDirection: "horizontal",
        },
      ],
    };

    const result = mockup.render(layout);

    expect(result.ascii).toContain("NAV");
    expect(result.ascii).toContain("CONTENT");
    expect(result.ascii).toContain("SIDEBAR");
  });

  it("should handle very narrow width", () => {
    const result = mockup.render(
      { name: "Narrow", sections: [{ type: "header" }] },
      { width: 20 }
    );

    expect(result.ascii).toBeTruthy();
  });

  it("should handle layout without name", () => {
    const layout: MockupLayout = {
      name: "",
      sections: [{ type: "header" }],
    };

    const result = mockup.render(layout);

    expect(result.ascii).toContain("HEADER");
  });
});

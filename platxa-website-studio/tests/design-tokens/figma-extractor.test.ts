/**
 * Tests for Figma Token Extractor
 */

import { describe, it, expect } from "vitest";
import {
  extractTokensFromFigmaFile,
  extractTokensFromFigmaVariables,
  exportToTokensJson,
  parseTokensJson,
  type FigmaFile,
  type FigmaVariable,
  type FigmaVariableCollection,
} from "../../lib/design-tokens/figma-extractor";

// =============================================================================
// Mock Figma Data
// =============================================================================

function createMockFigmaFile(): FigmaFile {
  return {
    name: "Design System",
    lastModified: "2024-01-15T10:00:00Z",
    version: "1.0.0",
    document: {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [
        {
          id: "1:1",
          name: "Colors",
          type: "FRAME",
          children: [
            {
              id: "1:2",
              name: "primary/500",
              type: "RECTANGLE",
              fills: [{ type: "SOLID", color: { r: 0.39, g: 0.4, b: 0.95, a: 1 } }],
            },
            {
              id: "1:3",
              name: "secondary/500",
              type: "RECTANGLE",
              fills: [{ type: "SOLID", color: { r: 0.55, g: 0.36, b: 0.96, a: 1 } }],
            },
            {
              id: "1:4",
              name: "accent/500",
              type: "RECTANGLE",
              fills: [{ type: "SOLID", color: { r: 0.93, g: 0.29, b: 0.6, a: 1 } }],
            },
          ],
        },
        {
          id: "2:1",
          name: "Typography",
          type: "FRAME",
          children: [
            {
              id: "2:2",
              name: "Heading 1",
              type: "TEXT",
              style: {
                fontFamily: "Inter",
                fontWeight: 700,
                fontSize: 36,
                lineHeightPx: 44,
              },
            },
            {
              id: "2:3",
              name: "Body",
              type: "TEXT",
              style: {
                fontFamily: "Inter",
                fontWeight: 400,
                fontSize: 16,
                lineHeightPx: 24,
              },
            },
          ],
        },
        {
          id: "3:1",
          name: "Spacing",
          type: "FRAME",
          children: [
            {
              id: "3:2",
              name: "spacing/4",
              type: "RECTANGLE",
              absoluteBoundingBox: { width: 16, height: 16 },
            },
            {
              id: "3:3",
              name: "spacing/8",
              type: "RECTANGLE",
              absoluteBoundingBox: { width: 32, height: 32 },
            },
          ],
        },
        {
          id: "4:1",
          name: "Components",
          type: "FRAME",
          children: [
            {
              id: "4:2",
              name: "Button",
              type: "COMPONENT",
              cornerRadius: 8,
              effects: [
                {
                  type: "DROP_SHADOW",
                  visible: true,
                  color: { r: 0, g: 0, b: 0, a: 0.1 },
                  offset: { x: 0, y: 4 },
                  radius: 6,
                  spread: 0,
                },
              ],
            },
            {
              id: "4:3",
              name: "Card",
              type: "COMPONENT",
              cornerRadius: 12,
            },
          ],
        },
      ],
    },
    styles: {
      "S:1": { key: "S:1", name: "primary/500", styleType: "FILL" },
      "S:2": { key: "S:2", name: "Shadow/Medium", styleType: "EFFECT" },
      "S:3": { key: "S:3", name: "Heading", styleType: "TEXT" },
    },
  };
}

function createMockFigmaVariables(): {
  collections: FigmaVariableCollection[];
  variables: Record<string, FigmaVariable>;
} {
  return {
    collections: [
      {
        id: "VC:1",
        name: "Brand Colors",
        modes: [{ modeId: "M:1", name: "Default" }],
        variableIds: ["V:1", "V:2", "V:3"],
      },
    ],
    variables: {
      "V:1": {
        id: "V:1",
        name: "primary/500",
        resolvedType: "COLOR",
        valuesByMode: {
          "M:1": { type: "COLOR", value: { r: 0.39, g: 0.4, b: 0.95, a: 1 } },
        },
        scopes: ["ALL_FILLS"],
      },
      "V:2": {
        id: "V:2",
        name: "secondary/500",
        resolvedType: "COLOR",
        valuesByMode: {
          "M:1": { type: "COLOR", value: { r: 0.55, g: 0.36, b: 0.96, a: 1 } },
        },
        scopes: ["ALL_FILLS"],
      },
      "V:3": {
        id: "V:3",
        name: "spacing/4",
        resolvedType: "FLOAT",
        valuesByMode: {
          "M:1": { type: "FLOAT", value: 16 },
        },
        scopes: ["GAP"],
      },
    },
  };
}

// =============================================================================
// Tests: extractTokensFromFigmaFile
// =============================================================================

describe("extractTokensFromFigmaFile", () => {
  it("extracts tokens from Figma file successfully", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    expect(result.success).toBe(true);
    expect(result.tokenSet).toBeDefined();
    expect(result.tokensJson).toBeDefined();
  });

  it("extracts color tokens from nodes", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    expect(result.tokenSet?.color).toBeDefined();
    expect(result.tokenSet?.color.primary).toBeDefined();
    expect(result.stats.colorsExtracted).toBeGreaterThan(0);
  });

  it("extracts typography tokens from text nodes", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    expect(result.tokenSet?.typography).toBeDefined();
    expect(result.tokenSet?.typography.fontFamily).toBeDefined();
    expect(result.stats.typographyExtracted).toBeGreaterThan(0);
  });

  it("extracts spacing tokens from components", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    expect(result.tokenSet?.spacing).toBeDefined();
    expect(result.stats.spacingExtracted).toBeGreaterThan(0);
  });

  it("extracts border radius from components", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    expect(result.tokenSet?.borderRadius).toBeDefined();
    expect(result.tokenSet?.borderRadius.md).toBeDefined();
  });

  it("respects extraction options", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile, {
      extractColors: true,
      extractTypography: false,
      extractSpacing: false,
      extractShadows: false,
    });

    expect(result.success).toBe(true);
    expect(result.stats.colorsExtracted).toBeGreaterThan(0);
    // Typography still has defaults but no extraction happened
    expect(result.tokenSet?.typography).toBeDefined();
  });

  it("generates DTCG-compliant JSON", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    expect(result.tokensJson).toBeDefined();
    const parsed = JSON.parse(result.tokensJson!);

    // Check DTCG structure
    expect(parsed.color).toBeDefined();
    expect(parsed.color.$type).toBe("color");
    expect(parsed.typography).toBeDefined();
    expect(parsed.typography.$type).toBe("typography");
  });

  it("includes metadata in token set", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    expect(result.tokenSet?.metadata).toBeDefined();
    expect(result.tokenSet?.metadata.name).toBe("Design System");
    expect(result.tokenSet?.metadata.version).toBe("1.0.0");
    expect(result.tokenSet?.metadata.createdAt).toBeDefined();
  });

  it("handles empty Figma file gracefully", () => {
    const emptyFile: FigmaFile = {
      name: "Empty",
      lastModified: "",
      version: "1",
      document: { id: "0", name: "Doc", type: "DOCUMENT", children: [] },
      styles: {},
    };

    const result = extractTokensFromFigmaFile(emptyFile);

    expect(result.success).toBe(true);
    expect(result.tokenSet).toBeDefined();
    // Should have defaults
    expect(result.tokenSet?.color.primary).toBeDefined();
  });
});

// =============================================================================
// Tests: extractTokensFromFigmaVariables
// =============================================================================

describe("extractTokensFromFigmaVariables", () => {
  it("extracts tokens from Figma Variables", () => {
    const { collections, variables } = createMockFigmaVariables();
    const result = extractTokensFromFigmaVariables(collections, variables);

    expect(result.success).toBe(true);
    expect(result.tokenSet).toBeDefined();
  });

  it("extracts color variables", () => {
    const { collections, variables } = createMockFigmaVariables();
    const result = extractTokensFromFigmaVariables(collections, variables);

    expect(result.stats.colorsExtracted).toBeGreaterThan(0);
  });

  it("extracts spacing variables", () => {
    const { collections, variables } = createMockFigmaVariables();
    const result = extractTokensFromFigmaVariables(collections, variables);

    expect(result.stats.spacingExtracted).toBeGreaterThan(0);
  });

  it("uses collection name for metadata", () => {
    const { collections, variables } = createMockFigmaVariables();
    const result = extractTokensFromFigmaVariables(collections, variables);

    expect(result.tokenSet?.metadata.name).toBe("Brand Colors");
  });
});

// =============================================================================
// Tests: DTCG JSON Export/Parse
// =============================================================================

describe("exportToTokensJson", () => {
  it("exports token set to JSON string", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    const json = exportToTokensJson(result.tokenSet!);

    expect(json).toBeDefined();
    expect(typeof json).toBe("string");

    const parsed = JSON.parse(json);
    expect(parsed.color).toBeDefined();
    expect(parsed.typography).toBeDefined();
  });

  it("produces valid JSON with proper formatting", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    const json = exportToTokensJson(result.tokenSet!);

    // Should be pretty-printed
    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });
});

describe("parseTokensJson", () => {
  it("parses valid tokens JSON", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);
    const json = exportToTokensJson(result.tokenSet!);

    const parsed = parseTokensJson(json);

    expect(parsed).not.toBeNull();
    expect(parsed?.color).toBeDefined();
    expect(parsed?.typography).toBeDefined();
  });

  it("returns null for invalid JSON", () => {
    const result = parseTokensJson("{ invalid json }");
    expect(result).toBeNull();
  });

  it("roundtrips tokens correctly", () => {
    const figmaFile = createMockFigmaFile();
    const original = extractTokensFromFigmaFile(figmaFile);
    const json = exportToTokensJson(original.tokenSet!);
    const parsed = parseTokensJson(json);

    expect(parsed?.metadata.name).toBe(original.tokenSet?.metadata.name);
    expect(parsed?.color.$type).toBe("color");
    expect(parsed?.typography.$type).toBe("typography");
  });
});

// =============================================================================
// Tests: Color Scale Pattern Matching
// =============================================================================

describe("color scale pattern matching", () => {
  it("matches primary/500 pattern", () => {
    const figmaFile: FigmaFile = {
      name: "Test",
      lastModified: "",
      version: "1",
      document: {
        id: "0",
        name: "Doc",
        type: "DOCUMENT",
        children: [
          {
            id: "1",
            name: "primary/500",
            type: "RECTANGLE",
            fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
      styles: {},
    };

    const result = extractTokensFromFigmaFile(figmaFile);
    expect(result.stats.colorsExtracted).toBe(1);
  });

  it("matches error-500 pattern (hyphen variant)", () => {
    const figmaFile: FigmaFile = {
      name: "Test",
      lastModified: "",
      version: "1",
      document: {
        id: "0",
        name: "Doc",
        type: "DOCUMENT",
        children: [
          {
            id: "1",
            name: "error-500",
            type: "RECTANGLE",
            fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
      styles: {},
    };

    const result = extractTokensFromFigmaFile(figmaFile);
    expect(result.stats.colorsExtracted).toBe(1);
  });

  it("matches success without step number", () => {
    const figmaFile: FigmaFile = {
      name: "Test",
      lastModified: "",
      version: "1",
      document: {
        id: "0",
        name: "Doc",
        type: "DOCUMENT",
        children: [
          {
            id: "1",
            name: "success",
            type: "RECTANGLE",
            fills: [{ type: "SOLID", color: { r: 0, g: 1, b: 0, a: 1 } }],
          },
        ],
      },
      styles: {},
    };

    const result = extractTokensFromFigmaFile(figmaFile);
    expect(result.stats.colorsExtracted).toBe(1);
  });
});

// =============================================================================
// Tests: Typography Extraction
// =============================================================================

describe("typography extraction", () => {
  it("extracts font family from text styles", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    expect(result.tokenSet?.typography.fontFamily.heading.$value).toContain("Inter");
  });

  it("generates fluid font sizes", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    const baseSize = result.tokenSet?.typography.fontSize.base;
    expect(baseSize?.$value.clamp).toContain("clamp(");
    expect(baseSize?.$value.min).toContain("rem");
    expect(baseSize?.$value.max).toContain("rem");
  });

  it("maps heading text styles to larger sizes", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    // H1 should map to 4xl
    expect(result.tokenSet?.typography.fontSize["4xl"]).toBeDefined();
  });
});

// =============================================================================
// Tests: Shadow Extraction
// =============================================================================

describe("shadow extraction", () => {
  it("extracts shadow from effect styles", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    expect(result.tokenSet?.shadow).toBeDefined();
    expect(result.tokenSet?.shadow.md).toBeDefined();
  });

  it("shadow tokens have correct structure", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile);

    const shadow = result.tokenSet?.shadow.md;
    expect(shadow?.$type).toBe("shadow");
    expect(Array.isArray(shadow?.$value)).toBe(true);

    if (shadow?.$value.length) {
      const layer = shadow.$value[0];
      expect(layer.offsetX).toBeDefined();
      expect(layer.offsetY).toBeDefined();
      expect(layer.blur).toBeDefined();
      expect(layer.color).toBeDefined();
    }
  });
});

// =============================================================================
// Tests: Error Handling
// =============================================================================

describe("error handling", () => {
  it("handles missing document gracefully", () => {
    const figmaFile = {
      name: "Test",
      lastModified: "",
      version: "1",
      document: null as unknown as FigmaFile["document"],
      styles: {},
    };

    // Should not throw
    expect(() => extractTokensFromFigmaFile(figmaFile)).not.toThrow();
  });

  it("handles missing fills gracefully", () => {
    const figmaFile: FigmaFile = {
      name: "Test",
      lastModified: "",
      version: "1",
      document: {
        id: "0",
        name: "Doc",
        type: "DOCUMENT",
        children: [
          {
            id: "1",
            name: "primary/500",
            type: "RECTANGLE",
            // No fills
          },
        ],
      },
      styles: {},
    };

    const result = extractTokensFromFigmaFile(figmaFile);
    expect(result.success).toBe(true);
  });

  it("handles gradient fills (non-solid) gracefully", () => {
    const figmaFile: FigmaFile = {
      name: "Test",
      lastModified: "",
      version: "1",
      document: {
        id: "0",
        name: "Doc",
        type: "DOCUMENT",
        children: [
          {
            id: "1",
            name: "primary/500",
            type: "RECTANGLE",
            fills: [{ type: "GRADIENT_LINEAR" }],
          },
        ],
      },
      styles: {},
    };

    const result = extractTokensFromFigmaFile(figmaFile);
    expect(result.success).toBe(true);
    // Should not extract gradient as color
    expect(result.stats.colorsExtracted).toBe(0);
  });
});

// =============================================================================
// Tests: Custom Options
// =============================================================================

describe("custom extraction options", () => {
  it("uses custom color scale pattern", () => {
    const figmaFile: FigmaFile = {
      name: "Test",
      lastModified: "",
      version: "1",
      document: {
        id: "0",
        name: "Doc",
        type: "DOCUMENT",
        children: [
          {
            id: "1",
            name: "primary/500",
            type: "RECTANGLE",
            fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
      styles: {},
    };

    // Custom pattern that does NOT match "primary/500"
    const result = extractTokensFromFigmaFile(figmaFile, {
      colorScalePattern: /^brand-main[\/\-]?(\d+)?$/i,
    });

    // Custom pattern doesn't match "primary", so no colors extracted
    expect(result.stats.colorsExtracted).toBe(0);
  });

  it("uses custom spacing pattern", () => {
    const figmaFile: FigmaFile = {
      name: "Test",
      lastModified: "",
      version: "1",
      document: {
        id: "0",
        name: "Doc",
        type: "DOCUMENT",
        children: [
          {
            id: "1",
            name: "space-4",
            type: "RECTANGLE",
            absoluteBoundingBox: { width: 16, height: 16 },
          },
        ],
      },
      styles: {},
    };

    const result = extractTokensFromFigmaFile(figmaFile, {
      spacingPattern: /^space[\/\-]?(\d+)$/i,
    });

    expect(result.stats.spacingExtracted).toBe(1);
  });

  it("respects fluid typography viewport options", () => {
    const figmaFile = createMockFigmaFile();
    const result = extractTokensFromFigmaFile(figmaFile, {
      fluidTypography: true,
      minViewport: 400,
      maxViewport: 1600,
    });

    const baseSize = result.tokenSet?.typography.fontSize.base;
    expect(baseSize?.$value.clamp).toContain("clamp(");
  });
});

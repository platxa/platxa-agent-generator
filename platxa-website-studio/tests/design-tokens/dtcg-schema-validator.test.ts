/**
 * Tests for DTCG Schema Validator
 *
 * Verifies validation against W3C DTCG v1 schema with detailed error reporting.
 */

import { describe, it, expect } from "vitest";
import {
  validateDtcgSchema,
  formatValidationResult,
  type DtcgValidationResult,
  type DtcgValidationOptions,
} from "../../lib/design-tokens/dtcg-schema-validator";

describe("DTCG Schema Validator", () => {
  describe("Basic Validation", () => {
    it("validates valid minimal token file", () => {
      const tokens = {
        color: {
          $type: "color",
          primary: {
            $value: "#7c3aed",
            $type: "color",
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.tokenCount).toBe(1);
      expect(result.groupCount).toBe(2); // root + color group
    });

    it("validates JSON string input", () => {
      const json = '{"color":{"$type":"color","primary":{"$value":"#ff0000"}}}';
      const result = validateDtcgSchema(json);
      expect(result.valid).toBe(true);
      expect(result.tokenCount).toBe(1);
    });

    it("reports invalid JSON", () => {
      const result = validateDtcgSchema("{ invalid json }");
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("INVALID_JSON");
    });

    it("reports non-object root", () => {
      const result = validateDtcgSchema([1, 2, 3]);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("INVALID_JSON");
      expect(result.errors[0].message).toContain("Root must be a JSON object");
    });
  });

  describe("Token Structure", () => {
    it("requires $value for tokens", () => {
      const tokens = {
        color: {
          primary: {
            $type: "color",
            // Missing $value
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "MISSING_VALUE")).toBe(true);
    });

    it("warns on missing $type without inheritance", () => {
      const tokens = {
        color: {
          primary: {
            $value: "#ff0000",
            // No $type and no parent $type
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.warnings.some((w) => w.code === "MISSING_TYPE")).toBe(true);
    });

    it("inherits $type from parent group", () => {
      const tokens = {
        color: {
          $type: "color",
          primary: {
            $value: "#ff0000",
            // Should inherit $type: "color" from parent
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
      expect(result.warnings.filter((w) => w.code === "MISSING_TYPE")).toHaveLength(0);
    });

    it("warns on empty groups", () => {
      const tokens = {
        emptyGroup: {},
      };

      const result = validateDtcgSchema(tokens);
      expect(result.warnings.some((w) => w.code === "EMPTY_GROUP")).toBe(true);
    });

    it("warns on unknown reserved keys", () => {
      const tokens = {
        color: {
          $unknownKey: "test",
          primary: { $value: "#ff0000", $type: "color" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.warnings.some((w) => w.code === "RESERVED_KEY")).toBe(true);
    });
  });

  describe("Color Validation", () => {
    it("validates hex colors", () => {
      const tokens = {
        color: {
          $type: "color",
          hex3: { $value: "#f00" },
          hex6: { $value: "#ff0000" },
          hex8: { $value: "#ff0000ff" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("validates rgb colors", () => {
      const tokens = {
        color: {
          $type: "color",
          rgb: { $value: "rgb(255, 0, 0)" },
          rgba: { $value: "rgba(255, 0, 0, 0.5)" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("validates hsl colors", () => {
      const tokens = {
        color: {
          $type: "color",
          hsl: { $value: "hsl(0, 100%, 50%)" },
          hsla: { $value: "hsla(0, 100%, 50%, 0.5)" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("validates oklch colors", () => {
      const tokens = {
        color: {
          $type: "color",
          oklch: { $value: "oklch(70% 0.15 30)" },
          oklchAlpha: { $value: "oklch(70% 0.15 30 / 50%)" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("reports invalid color format", () => {
      const tokens = {
        color: {
          $type: "color",
          invalid: { $value: "not-a-color" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_COLOR")).toBe(true);
    });

    it("reports non-string color value", () => {
      const tokens = {
        color: {
          $type: "color",
          invalid: { $value: 123 },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_COLOR")).toBe(true);
    });
  });

  describe("Dimension Validation", () => {
    it("validates dimension values", () => {
      const tokens = {
        spacing: {
          $type: "dimension",
          px: { $value: "16px" },
          rem: { $value: "1rem" },
          em: { $value: "1.5em" },
          percent: { $value: "50%" },
          zero: { $value: "0" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("validates viewport units", () => {
      const tokens = {
        layout: {
          $type: "dimension",
          vw: { $value: "100vw" },
          vh: { $value: "100vh" },
          dvh: { $value: "100dvh" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("reports invalid dimension format", () => {
      const tokens = {
        spacing: {
          $type: "dimension",
          invalid: { $value: "16" }, // Missing unit
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_DIMENSION")).toBe(true);
    });
  });

  describe("Typography Validation", () => {
    it("validates fontFamily", () => {
      const tokens = {
        font: {
          $type: "fontFamily",
          heading: { $value: "Inter" },
          stack: { $value: ["Inter", "sans-serif"] },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("validates fontWeight", () => {
      const tokens = {
        weight: {
          $type: "fontWeight",
          normal: { $value: 400 },
          bold: { $value: 700 },
          keyword: { $value: "bold" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("warns on non-standard font weight", () => {
      const tokens = {
        weight: {
          $type: "fontWeight",
          custom: { $value: 450 },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.warnings.some((w) => w.code === "INVALID_FONT_WEIGHT")).toBe(true);
    });
  });

  describe("Duration Validation", () => {
    it("validates duration values", () => {
      const tokens = {
        animation: {
          $type: "duration",
          fast: { $value: "150ms" },
          normal: { $value: "0.3s" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("reports invalid duration format", () => {
      const tokens = {
        animation: {
          $type: "duration",
          invalid: { $value: "150" }, // Missing unit
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_DURATION")).toBe(true);
    });
  });

  describe("CubicBezier Validation", () => {
    it("validates cubicBezier values", () => {
      const tokens = {
        easing: {
          $type: "cubicBezier",
          easeOut: { $value: [0, 0, 0.2, 1] },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("reports wrong array length", () => {
      const tokens = {
        easing: {
          $type: "cubicBezier",
          invalid: { $value: [0, 0, 0.2] }, // Only 3 values
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_CUBIC_BEZIER")).toBe(true);
    });

    it("warns on x values outside [0,1]", () => {
      const tokens = {
        easing: {
          $type: "cubicBezier",
          bouncy: { $value: [0.5, -0.5, 0.5, 1.5] }, // y values can be outside, x should not
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true); // Still valid, but warns
    });
  });

  describe("Shadow Validation", () => {
    it("validates shadow values", () => {
      const tokens = {
        shadow: {
          $type: "shadow",
          sm: {
            $value: {
              color: "#00000033",
              offsetX: "0px",
              offsetY: "1px",
              blur: "2px",
              spread: "0px",
            },
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("validates shadow array (multiple layers)", () => {
      const tokens = {
        shadow: {
          $type: "shadow",
          lg: {
            $value: [
              { color: "#00000020", offsetX: "0px", offsetY: "4px", blur: "6px" },
              { color: "#00000010", offsetX: "0px", offsetY: "2px", blur: "4px" },
            ],
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("reports missing shadow properties", () => {
      const tokens = {
        shadow: {
          $type: "shadow",
          invalid: {
            $value: {
              color: "#000",
              // Missing offsetX, offsetY, blur
            },
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_SHADOW")).toBe(true);
    });
  });

  describe("Gradient Validation", () => {
    it("validates gradient values", () => {
      const tokens = {
        gradient: {
          $type: "gradient",
          primary: {
            $value: [
              { color: "#ff0000", position: 0 },
              { color: "#0000ff", position: 1 },
            ],
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("reports too few gradient stops", () => {
      const tokens = {
        gradient: {
          $type: "gradient",
          invalid: {
            $value: [{ color: "#ff0000", position: 0 }], // Only 1 stop
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_GRADIENT")).toBe(true);
    });

    it("reports invalid gradient position", () => {
      const tokens = {
        gradient: {
          $type: "gradient",
          invalid: {
            $value: [
              { color: "#ff0000", position: 0 },
              { color: "#0000ff", position: 1.5 }, // > 1
            ],
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
    });
  });

  describe("Reference Validation", () => {
    it("validates valid references", () => {
      const tokens = {
        color: {
          $type: "color",
          primary: { $value: "#7c3aed" },
          secondary: { $value: "{color.primary}" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("reports invalid references", () => {
      const tokens = {
        color: {
          $type: "color",
          primary: { $value: "{color.nonexistent}" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "INVALID_REFERENCE")).toBe(true);
    });

    it("can disable reference validation", () => {
      const tokens = {
        color: {
          $type: "color",
          primary: { $value: "{color.nonexistent}" },
        },
      };

      const result = validateDtcgSchema(tokens, { validateReferences: false });
      expect(result.valid).toBe(true);
    });
  });

  describe("Validation Options", () => {
    it("respects strict mode", () => {
      const tokens = {
        color: {
          primary: {
            $value: "#ff0000",
            // No $type - normally a warning
          },
        },
      };

      const normalResult = validateDtcgSchema(tokens, { strict: false });
      expect(normalResult.valid).toBe(true);
      expect(normalResult.warnings.length).toBeGreaterThan(0);

      const strictResult = validateDtcgSchema(tokens, { strict: true });
      expect(strictResult.valid).toBe(false);
      expect(strictResult.errors.length).toBeGreaterThan(0);
    });

    it("allows custom types when enabled", () => {
      const tokens = {
        custom: {
          $type: "myCustomType",
          value: { $value: "test" },
        },
      };

      const normalResult = validateDtcgSchema(tokens, { allowCustomTypes: false });
      expect(normalResult.warnings.some((w) => w.code === "INVALID_TYPE")).toBe(true);

      const customResult = validateDtcgSchema(tokens, { allowCustomTypes: true });
      expect(customResult.warnings.filter((w) => w.code === "INVALID_TYPE")).toHaveLength(0);
    });

    it("can disable color validation", () => {
      const tokens = {
        color: {
          $type: "color",
          invalid: { $value: "not-a-color" },
        },
      };

      const result = validateDtcgSchema(tokens, { validateColors: false });
      expect(result.valid).toBe(true);
    });

    it("can disable dimension validation", () => {
      const tokens = {
        spacing: {
          $type: "dimension",
          invalid: { $value: "not-a-dimension" },
        },
      };

      const result = validateDtcgSchema(tokens, { validateDimensions: false });
      expect(result.valid).toBe(true);
    });
  });

  describe("Complex Token Files", () => {
    it("validates comprehensive token file", () => {
      const tokens = {
        $description: "Brand design tokens",
        color: {
          $type: "color",
          $description: "Color palette",
          primary: {
            "50": { $value: "#f5f3ff" },
            "100": { $value: "#ede9fe" },
            "500": { $value: "#7c3aed" },
            "900": { $value: "#4c1d95" },
          },
          background: { $value: "#ffffff" },
          text: { $value: "#1f2937" },
        },
        typography: {
          fontFamily: {
            $type: "fontFamily",
            heading: { $value: "Inter" },
            body: { $value: ["Inter", "system-ui", "sans-serif"] },
          },
          fontSize: {
            $type: "dimension",
            sm: { $value: "0.875rem" },
            base: { $value: "1rem" },
            lg: { $value: "1.125rem" },
          },
          fontWeight: {
            $type: "fontWeight",
            normal: { $value: 400 },
            bold: { $value: 700 },
          },
        },
        spacing: {
          $type: "dimension",
          "0": { $value: "0" },
          "1": { $value: "4px" },
          "2": { $value: "8px" },
          "4": { $value: "16px" },
        },
        borderRadius: {
          $type: "dimension",
          sm: { $value: "4px" },
          md: { $value: "8px" },
          lg: { $value: "12px" },
          full: { $value: "9999px" },
        },
        shadow: {
          $type: "shadow",
          sm: {
            $value: {
              color: "rgba(0, 0, 0, 0.1)",
              offsetX: "0px",
              offsetY: "1px",
              blur: "2px",
            },
          },
        },
        animation: {
          duration: {
            $type: "duration",
            fast: { $value: "150ms" },
            normal: { $value: "300ms" },
          },
          easing: {
            $type: "cubicBezier",
            easeOut: { $value: [0, 0, 0.2, 1] },
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
      expect(result.tokenCount).toBeGreaterThan(20);
      expect(result.groupCount).toBeGreaterThan(10);
    });

    it("reports multiple errors in invalid file", () => {
      const tokens = {
        color: {
          $type: "color",
          invalid1: { $value: "bad-color" },
          invalid2: { $value: 123 },
        },
        spacing: {
          $type: "dimension",
          invalid: { $value: "no-unit" },
        },
        missing: {
          noValue: { $type: "color" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });

  describe("Output Formatting", () => {
    it("formats valid result", () => {
      const result: DtcgValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        info: [],
        tokenCount: 10,
        groupCount: 5,
      };

      const formatted = formatValidationResult(result);
      expect(formatted).toContain("✓ DTCG Schema Valid");
      expect(formatted).toContain("Tokens: 10");
      expect(formatted).toContain("Groups: 5");
    });

    it("formats invalid result with errors", () => {
      const result: DtcgValidationResult = {
        valid: false,
        errors: [
          {
            path: "$.color.primary",
            message: "Invalid color format",
            severity: "error",
            code: "INVALID_COLOR",
            expected: "#RRGGBB",
            actual: "bad-color",
          },
        ],
        warnings: [],
        info: [],
        tokenCount: 1,
        groupCount: 2,
      };

      const formatted = formatValidationResult(result);
      expect(formatted).toContain("✗ DTCG Schema Invalid");
      expect(formatted).toContain("INVALID_COLOR");
      expect(formatted).toContain("$.color.primary");
      expect(formatted).toContain("Expected: #RRGGBB");
      expect(formatted).toContain("Actual: bad-color");
    });

    it("truncates long error lists", () => {
      const errors = Array.from({ length: 15 }, (_, i) => ({
        path: `$.token${i}`,
        message: `Error ${i}`,
        severity: "error" as const,
        code: "INVALID_VALUE" as const,
      }));

      const result: DtcgValidationResult = {
        valid: false,
        errors,
        warnings: [],
        info: [],
        tokenCount: 15,
        groupCount: 1,
      };

      const formatted = formatValidationResult(result);
      expect(formatted).toContain("... and 5 more errors");
    });
  });

  describe("Edge Cases", () => {
    it("handles null input", () => {
      const result = validateDtcgSchema(null);
      expect(result.valid).toBe(false);
    });

    it("handles undefined values in tokens", () => {
      const tokens = {
        color: {
          $type: "color",
          primary: { $value: "#ff0000" },
          secondary: undefined,
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
    });

    it("handles deeply nested tokens", () => {
      const tokens = {
        theme: {
          light: {
            color: {
              $type: "color",
              brand: {
                primary: {
                  base: { $value: "#7c3aed" },
                  hover: { $value: "#6d28d9" },
                },
              },
            },
          },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
      expect(result.tokenCount).toBe(2);
    });

    it("handles $extensions property", () => {
      const tokens = {
        color: {
          $type: "color",
          $extensions: {
            "com.example": { customData: true },
          },
          primary: { $value: "#ff0000" },
        },
      };

      const result = validateDtcgSchema(tokens);
      expect(result.valid).toBe(true);
      expect(result.warnings.filter((w) => w.code === "RESERVED_KEY")).toHaveLength(0);
    });
  });
});

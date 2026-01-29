import { describe, it, expect } from "vitest";
import {
  clampSize,
  calculateResizedSizes,
  distributeEvenSizes,
  isPanelCollapsed,
  getResizeCursor,
  DEFAULT_CONSTRAINTS,
  HANDLE_SIZE,
  COLLAPSE_THRESHOLD,
  type PanelConstraints,
} from "@/components/ui/resizable-panels";

describe("ResizablePanels", () => {
  describe("drag handles between panels resize them; constraints prevent collapse (Feature #120)", () => {
    it("calculateResizedSizes applies delta to adjacent panels", () => {
      // Feature #120: Drag handles resize panels
      const sizes = [50, 50];
      const constraints: PanelConstraints[] = [
        { minSize: 10, maxSize: 90 },
        { minSize: 10, maxSize: 90 },
      ];

      const newSizes = calculateResizedSizes(sizes, 0, 10, constraints);

      expect(newSizes[0]).toBe(60); // Left panel grew
      expect(newSizes[1]).toBe(40); // Right panel shrunk
    });

    it("constraints prevent collapse below minimum", () => {
      // Feature #120: Constraints prevent collapse
      const sizes = [50, 50];
      const constraints: PanelConstraints[] = [
        { minSize: 20, maxSize: 90 },
        { minSize: 20, maxSize: 90 },
      ];

      // Try to resize left panel to 10% (below min of 20%)
      const newSizes = calculateResizedSizes(sizes, 0, -40, constraints);

      expect(newSizes[0]).toBeGreaterThanOrEqual(20);
      expect(newSizes[1]).toBeLessThanOrEqual(80);
    });

    it("constraints prevent expansion beyond maximum", () => {
      // Feature #120: Constraints prevent collapse
      const sizes = [50, 50];
      const constraints: PanelConstraints[] = [
        { minSize: 10, maxSize: 70 },
        { minSize: 10, maxSize: 90 },
      ];

      // Try to resize left panel to 90% (above max of 70%)
      const newSizes = calculateResizedSizes(sizes, 0, 40, constraints);

      expect(newSizes[0]).toBeLessThanOrEqual(70);
      expect(newSizes[1]).toBeGreaterThanOrEqual(30);
    });

    it("isPanelCollapsed detects collapsed panels", () => {
      // Feature #120: Collapse detection
      expect(isPanelCollapsed(3)).toBe(true); // Below threshold
      expect(isPanelCollapsed(COLLAPSE_THRESHOLD)).toBe(false); // At threshold
      expect(isPanelCollapsed(20)).toBe(false); // Above threshold
    });
  });

  describe("clampSize", () => {
    it("clamps value to minimum", () => {
      expect(clampSize(5, 10, 90)).toBe(10);
    });

    it("clamps value to maximum", () => {
      expect(clampSize(95, 10, 90)).toBe(90);
    });

    it("returns value when within range", () => {
      expect(clampSize(50, 10, 90)).toBe(50);
    });

    it("handles edge cases", () => {
      expect(clampSize(10, 10, 90)).toBe(10);
      expect(clampSize(90, 10, 90)).toBe(90);
    });
  });

  describe("calculateResizedSizes", () => {
    it("handles positive delta (left expands, right shrinks)", () => {
      const sizes = [30, 70];
      const constraints: PanelConstraints[] = [
        { minSize: 10, maxSize: 90 },
        { minSize: 10, maxSize: 90 },
      ];

      const result = calculateResizedSizes(sizes, 0, 20, constraints);

      expect(result[0]).toBe(50);
      expect(result[1]).toBe(50);
    });

    it("handles negative delta (left shrinks, right expands)", () => {
      const sizes = [50, 50];
      const constraints: PanelConstraints[] = [
        { minSize: 10, maxSize: 90 },
        { minSize: 10, maxSize: 90 },
      ];

      const result = calculateResizedSizes(sizes, 0, -20, constraints);

      expect(result[0]).toBe(30);
      expect(result[1]).toBe(70);
    });

    it("uses default constraints when not provided", () => {
      const sizes = [50, 50];
      const constraints: PanelConstraints[] = [{}, {}];

      const result = calculateResizedSizes(sizes, 0, 10, constraints);

      expect(result[0]).toBe(60);
      expect(result[1]).toBe(40);
    });

    it("returns original sizes for invalid handle index", () => {
      const sizes = [50, 50];
      const constraints: PanelConstraints[] = [
        { minSize: 10, maxSize: 90 },
        { minSize: 10, maxSize: 90 },
      ];

      const result = calculateResizedSizes(sizes, -1, 10, constraints);
      expect(result).toEqual(sizes);

      const result2 = calculateResizedSizes(sizes, 5, 10, constraints);
      expect(result2).toEqual(sizes);
    });

    it("handles three panels correctly", () => {
      const sizes = [33.33, 33.33, 33.34];
      const constraints: PanelConstraints[] = [
        { minSize: 10, maxSize: 70 },
        { minSize: 10, maxSize: 70 },
        { minSize: 10, maxSize: 70 },
      ];

      // Resize between first and second panel
      const result = calculateResizedSizes(sizes, 0, 10, constraints);

      expect(result[0]).toBeCloseTo(43.33, 1);
      expect(result[1]).toBeCloseTo(23.33, 1);
      expect(result[2]).toBeCloseTo(33.34, 1); // Third panel unchanged
    });

    it("respects minimum constraint when shrinking", () => {
      const sizes = [20, 80];
      const constraints: PanelConstraints[] = [
        { minSize: 15, maxSize: 90 },
        { minSize: 10, maxSize: 90 },
      ];

      // Try to shrink left panel below minimum
      const result = calculateResizedSizes(sizes, 0, -10, constraints);

      expect(result[0]).toBe(15); // Clamped to minimum
      expect(result[1]).toBe(85);
    });

    it("respects maximum constraint when expanding", () => {
      const sizes = [60, 40];
      const constraints: PanelConstraints[] = [
        { minSize: 10, maxSize: 70 },
        { minSize: 10, maxSize: 90 },
      ];

      // Try to expand left panel beyond maximum
      const result = calculateResizedSizes(sizes, 0, 20, constraints);

      expect(result[0]).toBe(70); // Clamped to maximum
      expect(result[1]).toBe(30);
    });
  });

  describe("distributeEvenSizes", () => {
    it("distributes sizes evenly for 2 panels", () => {
      const sizes = distributeEvenSizes(2);

      expect(sizes).toEqual([50, 50]);
    });

    it("distributes sizes evenly for 3 panels", () => {
      const sizes = distributeEvenSizes(3);

      expect(sizes[0]).toBeCloseTo(33.33, 1);
      expect(sizes[1]).toBeCloseTo(33.33, 1);
      expect(sizes[2]).toBeCloseTo(33.33, 1);
    });

    it("distributes sizes evenly for 4 panels", () => {
      const sizes = distributeEvenSizes(4);

      expect(sizes).toEqual([25, 25, 25, 25]);
    });

    it("handles single panel", () => {
      const sizes = distributeEvenSizes(1);

      expect(sizes).toEqual([100]);
    });
  });

  describe("isPanelCollapsed", () => {
    it("returns true for size below threshold", () => {
      expect(isPanelCollapsed(0)).toBe(true);
      expect(isPanelCollapsed(1)).toBe(true);
      expect(isPanelCollapsed(4)).toBe(true);
    });

    it("returns false for size at or above threshold", () => {
      expect(isPanelCollapsed(COLLAPSE_THRESHOLD)).toBe(false);
      expect(isPanelCollapsed(10)).toBe(false);
      expect(isPanelCollapsed(50)).toBe(false);
    });
  });

  describe("getResizeCursor", () => {
    it("returns col-resize for horizontal direction", () => {
      expect(getResizeCursor("horizontal")).toBe("col-resize");
    });

    it("returns row-resize for vertical direction", () => {
      expect(getResizeCursor("vertical")).toBe("row-resize");
    });
  });

  describe("DEFAULT_CONSTRAINTS", () => {
    it("has sensible default values", () => {
      expect(DEFAULT_CONSTRAINTS.minSize).toBe(10);
      expect(DEFAULT_CONSTRAINTS.maxSize).toBe(90);
      expect(DEFAULT_CONSTRAINTS.defaultSize).toBe(50);
      expect(DEFAULT_CONSTRAINTS.isPercentage).toBe(true);
    });
  });

  describe("HANDLE_SIZE", () => {
    it("is a reasonable pixel value", () => {
      expect(HANDLE_SIZE).toBe(8);
      expect(HANDLE_SIZE).toBeGreaterThan(0);
      expect(HANDLE_SIZE).toBeLessThan(20);
    });
  });

  describe("COLLAPSE_THRESHOLD", () => {
    it("is a reasonable percentage value", () => {
      expect(COLLAPSE_THRESHOLD).toBe(5);
      expect(COLLAPSE_THRESHOLD).toBeGreaterThan(0);
      expect(COLLAPSE_THRESHOLD).toBeLessThan(DEFAULT_CONSTRAINTS.minSize);
    });
  });

  describe("edge cases", () => {
    it("handles zero delta", () => {
      const sizes = [50, 50];
      const constraints: PanelConstraints[] = [
        { minSize: 10, maxSize: 90 },
        { minSize: 10, maxSize: 90 },
      ];

      const result = calculateResizedSizes(sizes, 0, 0, constraints);

      expect(result).toEqual([50, 50]);
    });

    it("handles very small panels", () => {
      const sizes = [10, 90];
      const constraints: PanelConstraints[] = [
        { minSize: 5, maxSize: 95 },
        { minSize: 5, maxSize: 95 },
      ];

      const result = calculateResizedSizes(sizes, 0, -5, constraints);

      expect(result[0]).toBe(5);
      expect(result[1]).toBe(95);
    });

    it("handles conflicting constraints gracefully", () => {
      const sizes = [50, 50];
      const constraints: PanelConstraints[] = [
        { minSize: 60, maxSize: 90 }, // Left wants min 60
        { minSize: 60, maxSize: 90 }, // Right wants min 60 (impossible!)
      ];

      // Should not crash, but behavior may be imperfect
      const result = calculateResizedSizes(sizes, 0, 10, constraints);

      expect(result.length).toBe(2);
      expect(result[0] + result[1]).toBeCloseTo(100, 0);
    });
  });
});

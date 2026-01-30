/**
 * Tests for SpacingControls — Box model controls for margin and padding.
 *
 * Feature #81: Create spacing controls for margin and padding adjustments
 * Verification: Box model control with drag handles or input fields
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SpacingControls,
  createSpacingControls,
  SPACING_PRESETS,
  SPACING_CONTROLS_SCRIPT,
  DEFAULT_BOX_SPACING,
  DEFAULT_ELEMENT_SPACING,
  SIDES_ORDER,
  formatSpacingValue,
  parseSpacingValue,
  formatBoxSpacing,
  parseBoxSpacing,
  getPresetByValue,
  getClosestPreset,
  toPixels,
  cloneElementSpacing,
  type SpacingValue,
  type BoxSpacing,
  type ElementSpacing,
} from "../../lib/preview/spacing-controls";

// =============================================================================
// Helper: Mock iframe
// =============================================================================

interface MockIframe extends HTMLIFrameElement {
  messages: unknown[];
}

function createMockIframe(): MockIframe {
  const messages: unknown[] = [];

  const iframe = {
    messages,
    contentWindow: {
      postMessage: vi.fn((message: unknown) => {
        messages.push(message);
      }),
    },
  } as unknown as MockIframe;

  return iframe;
}

// =============================================================================
// Test: Utility Functions
// =============================================================================

describe("SpacingControls — Utilities", () => {
  describe("formatSpacingValue", () => {
    it("formats pixel values", () => {
      expect(formatSpacingValue({ value: 16, unit: "px" })).toBe("16px");
    });

    it("formats rem values", () => {
      expect(formatSpacingValue({ value: 1.5, unit: "rem" })).toBe("1.5rem");
    });

    it("formats auto", () => {
      expect(formatSpacingValue({ unit: "auto" })).toBe("auto");
    });

    it("handles zero", () => {
      expect(formatSpacingValue({ value: 0, unit: "px" })).toBe("0px");
    });

    it("handles undefined value as zero", () => {
      expect(formatSpacingValue({ unit: "px" })).toBe("0px");
    });
  });

  describe("parseSpacingValue", () => {
    it("parses pixel values", () => {
      expect(parseSpacingValue("16px")).toEqual({ value: 16, unit: "px" });
    });

    it("parses rem values", () => {
      expect(parseSpacingValue("1.5rem")).toEqual({ value: 1.5, unit: "rem" });
    });

    it("parses percentage", () => {
      expect(parseSpacingValue("50%")).toEqual({ value: 50, unit: "%" });
    });

    it("parses auto", () => {
      expect(parseSpacingValue("auto")).toEqual({ unit: "auto" });
    });

    it("parses negative values", () => {
      expect(parseSpacingValue("-10px")).toEqual({ value: -10, unit: "px" });
    });

    it("handles invalid input", () => {
      expect(parseSpacingValue("invalid")).toEqual({ value: 0, unit: "px" });
    });

    it("trims whitespace", () => {
      expect(parseSpacingValue("  16px  ")).toEqual({ value: 16, unit: "px" });
    });
  });

  describe("formatBoxSpacing", () => {
    it("formats all same values", () => {
      const spacing: BoxSpacing = {
        top: { value: 10, unit: "px" },
        right: { value: 10, unit: "px" },
        bottom: { value: 10, unit: "px" },
        left: { value: 10, unit: "px" },
      };
      expect(formatBoxSpacing(spacing)).toBe("10px");
    });

    it("formats top/bottom and left/right pairs", () => {
      const spacing: BoxSpacing = {
        top: { value: 10, unit: "px" },
        right: { value: 20, unit: "px" },
        bottom: { value: 10, unit: "px" },
        left: { value: 20, unit: "px" },
      };
      expect(formatBoxSpacing(spacing)).toBe("10px 20px");
    });

    it("formats three-value shorthand", () => {
      const spacing: BoxSpacing = {
        top: { value: 10, unit: "px" },
        right: { value: 20, unit: "px" },
        bottom: { value: 30, unit: "px" },
        left: { value: 20, unit: "px" },
      };
      expect(formatBoxSpacing(spacing)).toBe("10px 20px 30px");
    });

    it("formats all different values", () => {
      const spacing: BoxSpacing = {
        top: { value: 10, unit: "px" },
        right: { value: 20, unit: "px" },
        bottom: { value: 30, unit: "px" },
        left: { value: 40, unit: "px" },
      };
      expect(formatBoxSpacing(spacing)).toBe("10px 20px 30px 40px");
    });
  });

  describe("parseBoxSpacing", () => {
    it("parses single value", () => {
      const result = parseBoxSpacing("10px");
      expect(result.top).toEqual({ value: 10, unit: "px" });
      expect(result.right).toEqual({ value: 10, unit: "px" });
      expect(result.bottom).toEqual({ value: 10, unit: "px" });
      expect(result.left).toEqual({ value: 10, unit: "px" });
    });

    it("parses two values", () => {
      const result = parseBoxSpacing("10px 20px");
      expect(result.top).toEqual({ value: 10, unit: "px" });
      expect(result.right).toEqual({ value: 20, unit: "px" });
      expect(result.bottom).toEqual({ value: 10, unit: "px" });
      expect(result.left).toEqual({ value: 20, unit: "px" });
    });

    it("parses three values", () => {
      const result = parseBoxSpacing("10px 20px 30px");
      expect(result.top).toEqual({ value: 10, unit: "px" });
      expect(result.right).toEqual({ value: 20, unit: "px" });
      expect(result.bottom).toEqual({ value: 30, unit: "px" });
      expect(result.left).toEqual({ value: 20, unit: "px" });
    });

    it("parses four values", () => {
      const result = parseBoxSpacing("10px 20px 30px 40px");
      expect(result.top).toEqual({ value: 10, unit: "px" });
      expect(result.right).toEqual({ value: 20, unit: "px" });
      expect(result.bottom).toEqual({ value: 30, unit: "px" });
      expect(result.left).toEqual({ value: 40, unit: "px" });
    });
  });

  describe("getPresetByValue", () => {
    it("finds preset by exact value", () => {
      const preset = getPresetByValue(16);
      expect(preset?.id).toBe("md");
      expect(preset?.name).toBe("Medium");
    });

    it("returns undefined for non-preset value", () => {
      expect(getPresetByValue(17)).toBeUndefined();
    });
  });

  describe("getClosestPreset", () => {
    it("finds exact match", () => {
      expect(getClosestPreset(16).id).toBe("md");
    });

    it("finds closest preset", () => {
      expect(getClosestPreset(15).id).toBe("md"); // 16 is closer than 8
      expect(getClosestPreset(10).id).toBe("sm"); // 8 is closer than 16
    });
  });

  describe("toPixels", () => {
    it("converts px to pixels", () => {
      expect(toPixels({ value: 16, unit: "px" })).toBe(16);
    });

    it("converts rem to pixels", () => {
      expect(toPixels({ value: 1, unit: "rem" })).toBe(16);
      expect(toPixels({ value: 2, unit: "rem" })).toBe(32);
    });

    it("converts em to pixels", () => {
      expect(toPixels({ value: 1.5, unit: "em" })).toBe(24);
    });

    it("handles auto as 0", () => {
      expect(toPixels({ unit: "auto" })).toBe(0);
    });

    it("uses custom base font size", () => {
      expect(toPixels({ value: 1, unit: "rem" }, 20)).toBe(20);
    });
  });

  describe("cloneElementSpacing", () => {
    it("creates a deep copy", () => {
      const original: ElementSpacing = {
        margin: {
          top: { value: 10, unit: "px" },
          right: { value: 20, unit: "px" },
          bottom: { value: 30, unit: "px" },
          left: { value: 40, unit: "px" },
        },
        padding: {
          top: { value: 5, unit: "px" },
          right: { value: 10, unit: "px" },
          bottom: { value: 15, unit: "px" },
          left: { value: 20, unit: "px" },
        },
      };

      const clone = cloneElementSpacing(original);

      // Modify clone
      clone.margin.top.value = 100;

      // Original unchanged
      expect(original.margin.top.value).toBe(10);
      expect(clone.margin.top.value).toBe(100);
    });
  });
});

// =============================================================================
// Test: Constants
// =============================================================================

describe("SpacingControls — Constants", () => {
  describe("SPACING_PRESETS", () => {
    it("has standard presets", () => {
      expect(SPACING_PRESETS.length).toBeGreaterThan(5);
      expect(SPACING_PRESETS.find((p) => p.id === "0")).toBeDefined();
      expect(SPACING_PRESETS.find((p) => p.id === "md")).toBeDefined();
    });

    it("presets have increasing values", () => {
      for (let i = 1; i < SPACING_PRESETS.length; i++) {
        expect(SPACING_PRESETS[i].value).toBeGreaterThan(
          SPACING_PRESETS[i - 1].value
        );
      }
    });
  });

  describe("DEFAULT_BOX_SPACING", () => {
    it("has all sides at zero", () => {
      expect(DEFAULT_BOX_SPACING.top).toEqual({ value: 0, unit: "px" });
      expect(DEFAULT_BOX_SPACING.right).toEqual({ value: 0, unit: "px" });
      expect(DEFAULT_BOX_SPACING.bottom).toEqual({ value: 0, unit: "px" });
      expect(DEFAULT_BOX_SPACING.left).toEqual({ value: 0, unit: "px" });
    });
  });

  describe("SIDES_ORDER", () => {
    it("has correct CSS shorthand order", () => {
      expect(SIDES_ORDER).toEqual(["top", "right", "bottom", "left"]);
    });
  });
});

// =============================================================================
// Test: SpacingControls Class
// =============================================================================

describe("SpacingControls — Class", () => {
  let controls: SpacingControls;
  let iframe: MockIframe;

  beforeEach(() => {
    controls = new SpacingControls();
    iframe = createMockIframe();
  });

  afterEach(() => {
    controls.dispose();
  });

  describe("constructor", () => {
    it("creates with default options", () => {
      const c = new SpacingControls();
      expect(c.getPresets().length).toBeGreaterThan(0);
      c.dispose();
    });

    it("creates with custom options", () => {
      const customPresets = [{ id: "custom", name: "Custom", value: 100 }];
      const c = new SpacingControls({ presets: customPresets });
      expect(c.getPresets()).toEqual(customPresets);
      c.dispose();
    });
  });

  describe("connect/disconnect", () => {
    it("connects to iframe", () => {
      controls.connect(iframe);
      expect(controls.isConnected()).toBe(true);
    });

    it("disconnects from iframe", () => {
      controls.connect(iframe);
      controls.disconnect();
      expect(controls.isConnected()).toBe(false);
    });

    it("throws if disposed", () => {
      controls.dispose();
      expect(() => controls.connect(iframe)).toThrow("has been disposed");
    });
  });

  describe("element selection", () => {
    it("selects element", () => {
      controls.selectElement("element-1");
      expect(controls.getSelectedElementId()).toBe("element-1");
    });

    it("clears selection", () => {
      controls.selectElement("element-1");
      controls.clearSelection();
      expect(controls.getSelectedElementId()).toBeNull();
    });

    it("accepts initial spacing", () => {
      const initialSpacing: ElementSpacing = {
        margin: {
          top: { value: 10, unit: "px" },
          right: { value: 10, unit: "px" },
          bottom: { value: 10, unit: "px" },
          left: { value: 10, unit: "px" },
        },
        padding: {
          top: { value: 20, unit: "px" },
          right: { value: 20, unit: "px" },
          bottom: { value: 20, unit: "px" },
          left: { value: 20, unit: "px" },
        },
      };

      controls.selectElement("element-1", initialSpacing);

      expect(controls.getMargin("top")).toEqual({ value: 10, unit: "px" });
      expect(controls.getPadding("top")).toEqual({ value: 20, unit: "px" });
    });
  });

  describe("margin controls", () => {
    beforeEach(() => {
      controls.selectElement("element-1");
    });

    it("sets margin for a side", () => {
      controls.setMargin("top", { value: 16, unit: "px" });
      expect(controls.getMargin("top")).toEqual({ value: 16, unit: "px" });
    });

    it("gets all margins", () => {
      controls.setMargin("top", { value: 10, unit: "px" });
      controls.setMargin("right", { value: 20, unit: "px" });

      const all = controls.getAllMargin();
      expect(all.top).toEqual({ value: 10, unit: "px" });
      expect(all.right).toEqual({ value: 20, unit: "px" });
    });

    it("sets all margins at once", () => {
      const spacing: BoxSpacing = {
        top: { value: 10, unit: "px" },
        right: { value: 20, unit: "px" },
        bottom: { value: 30, unit: "px" },
        left: { value: 40, unit: "px" },
      };

      controls.setMarginAll(spacing);

      expect(controls.getMargin("top")).toEqual({ value: 10, unit: "px" });
      expect(controls.getMargin("left")).toEqual({ value: 40, unit: "px" });
    });

    it("links margin sides", () => {
      controls.setMarginLinked(true);
      controls.setMargin("top", { value: 16, unit: "px" });

      // All sides should be updated
      expect(controls.getMargin("top")).toEqual({ value: 16, unit: "px" });
      expect(controls.getMargin("right")).toEqual({ value: 16, unit: "px" });
      expect(controls.getMargin("bottom")).toEqual({ value: 16, unit: "px" });
      expect(controls.getMargin("left")).toEqual({ value: 16, unit: "px" });
    });
  });

  describe("padding controls", () => {
    beforeEach(() => {
      controls.selectElement("element-1");
    });

    it("sets padding for a side", () => {
      controls.setPadding("bottom", { value: 24, unit: "px" });
      expect(controls.getPadding("bottom")).toEqual({ value: 24, unit: "px" });
    });

    it("gets all padding", () => {
      controls.setPadding("top", { value: 8, unit: "px" });
      controls.setPadding("bottom", { value: 16, unit: "px" });

      const all = controls.getAllPadding();
      expect(all.top).toEqual({ value: 8, unit: "px" });
      expect(all.bottom).toEqual({ value: 16, unit: "px" });
    });

    it("links padding sides", () => {
      controls.setPaddingLinked(true);
      controls.setPadding("left", { value: 32, unit: "px" });

      expect(controls.getPadding("top")).toEqual({ value: 32, unit: "px" });
      expect(controls.getPadding("right")).toEqual({ value: 32, unit: "px" });
      expect(controls.getPadding("bottom")).toEqual({ value: 32, unit: "px" });
      expect(controls.getPadding("left")).toEqual({ value: 32, unit: "px" });
    });
  });

  describe("drag handling", () => {
    beforeEach(() => {
      controls.selectElement("element-1");
      controls.setMargin("top", { value: 10, unit: "px" });
    });

    it("starts drag operation", () => {
      controls.startDrag("margin", "top");
      expect(controls.isDragging()).toBe(true);
    });

    it("updates during drag", () => {
      controls.startDrag("margin", "top");
      controls.updateDrag("margin", "top", 5);

      expect(controls.getMargin("top").value).toBe(15);
    });

    it("ends drag operation", () => {
      controls.startDrag("margin", "top");
      controls.endDrag();
      expect(controls.isDragging()).toBe(false);
    });

    it("clamps values to allowed range", () => {
      controls.startDrag("padding", "top");
      controls.updateDrag("padding", "top", -1000); // Try to go negative

      expect(controls.getPadding("top").value).toBeGreaterThanOrEqual(0);
    });
  });

  describe("presets", () => {
    beforeEach(() => {
      controls.selectElement("element-1");
    });

    it("applies margin preset", () => {
      controls.applyMarginPreset("md");

      expect(controls.getMargin("top")).toEqual({ value: 16, unit: "px" });
      expect(controls.getMargin("right")).toEqual({ value: 16, unit: "px" });
    });

    it("applies margin preset to single side", () => {
      controls.applyMarginPreset("lg", "top");

      expect(controls.getMargin("top")).toEqual({ value: 24, unit: "px" });
      expect(controls.getMargin("bottom").value).toBe(0); // Unchanged
    });

    it("applies padding preset", () => {
      controls.applyPaddingPreset("sm");

      expect(controls.getPadding("top")).toEqual({ value: 8, unit: "px" });
    });
  });

  describe("callbacks", () => {
    beforeEach(() => {
      controls.selectElement("element-1");
    });

    it("calls change callback on margin update", () => {
      const callback = vi.fn();
      controls.onChange(callback);

      controls.setMargin("top", { value: 16, unit: "px" });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe("margin");
      expect(callback.mock.calls[0][0].side).toBe("top");
    });

    it("calls change callback on padding update", () => {
      const callback = vi.fn();
      controls.onChange(callback);

      controls.setPadding("bottom", { value: 24, unit: "px" });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].type).toBe("padding");
    });

    it("unsubscribes from callback", () => {
      const callback = vi.fn();
      const unsubscribe = controls.onChange(callback);

      unsubscribe();
      controls.setMargin("top", { value: 16, unit: "px" });

      expect(callback).not.toHaveBeenCalled();
    });

    it("calls drag callback", () => {
      const callback = vi.fn();
      controls.onDrag(callback);

      controls.startDrag("margin", "top");
      controls.updateDrag("margin", "top", 5);

      expect(callback).toHaveBeenCalledWith("margin", "top", 5, false);
    });

    it("calls drag callback on end", () => {
      const callback = vi.fn();
      controls.onDrag(callback);

      controls.startDrag("padding", "left");
      controls.endDrag();

      expect(callback).toHaveBeenCalledWith("padding", "left", 0, true);
    });
  });

  describe("iframe communication", () => {
    beforeEach(() => {
      controls.connect(iframe);
      controls.selectElement("element-1");
    });

    it("sends spacing to iframe on update", () => {
      controls.setMargin("top", { value: 16, unit: "px" });

      const msg = iframe.messages.find(
        (m: any) => m.type === "platxa:apply-element-spacing"
      );
      expect(msg).toBeDefined();
      expect((msg as any).elementId).toBe("element-1");
    });

    it("includes formatted margin and padding", () => {
      controls.setMargin("top", { value: 10, unit: "px" });
      controls.setPadding("bottom", { value: 20, unit: "px" });

      const msgs = iframe.messages.filter(
        (m: any) => m.type === "platxa:apply-element-spacing"
      );
      const lastMsg = msgs[msgs.length - 1] as any;

      expect(lastMsg.margin).toBeDefined();
      expect(lastMsg.padding).toBeDefined();
    });
  });

  describe("state", () => {
    it("returns full spacing", () => {
      controls.selectElement("element-1");
      controls.setMargin("top", { value: 10, unit: "px" });
      controls.setPadding("bottom", { value: 20, unit: "px" });

      const spacing = controls.getSpacing();

      expect(spacing.margin.top).toEqual({ value: 10, unit: "px" });
      expect(spacing.padding.bottom).toEqual({ value: 20, unit: "px" });
    });

    it("returns full state", () => {
      controls.selectElement("element-1");
      controls.setMarginLinked(true);

      const state = controls.getState();

      expect(state.selectedElementId).toBe("element-1");
      expect(state.marginLinked).toBe(true);
    });
  });

  describe("dispose", () => {
    it("disposes cleanly", () => {
      controls.connect(iframe);
      controls.dispose();

      expect(controls.isConnected()).toBe(false);
    });

    it("is idempotent", () => {
      controls.dispose();
      controls.dispose(); // Should not throw
    });
  });
});

// =============================================================================
// Test: Factory Function
// =============================================================================

describe("SpacingControls — Factory", () => {
  it("creates instance with createSpacingControls", () => {
    const controls = createSpacingControls();
    expect(controls).toBeInstanceOf(SpacingControls);
    controls.dispose();
  });

  it("passes options to constructor", () => {
    const controls = createSpacingControls({
      defaultUnit: "rem",
      step: 4,
    });
    expect(controls.getPresets().length).toBeGreaterThan(0);
    controls.dispose();
  });
});

// =============================================================================
// Test: Iframe Script
// =============================================================================

describe("SpacingControls — Iframe Script", () => {
  it("contains script tag", () => {
    expect(SPACING_CONTROLS_SCRIPT).toContain("<script>");
    expect(SPACING_CONTROLS_SCRIPT).toContain("</script>");
  });

  it("handles get-element-spacing message", () => {
    expect(SPACING_CONTROLS_SCRIPT).toContain("platxa:get-element-spacing");
  });

  it("handles apply-element-spacing message", () => {
    expect(SPACING_CONTROLS_SCRIPT).toContain("platxa:apply-element-spacing");
  });

  it("sends element-spacing response", () => {
    expect(SPACING_CONTROLS_SCRIPT).toContain("platxa:element-spacing");
  });

  it("sends spacing-applied response", () => {
    expect(SPACING_CONTROLS_SCRIPT).toContain("platxa:spacing-applied");
  });

  it("queries elements by data attributes", () => {
    expect(SPACING_CONTROLS_SCRIPT).toContain("data-snippet-id");
    expect(SPACING_CONTROLS_SCRIPT).toContain("data-element-id");
  });

  it("uses getComputedStyle for reading spacing", () => {
    expect(SPACING_CONTROLS_SCRIPT).toContain("getComputedStyle");
  });
});

// =============================================================================
// Test: Integration Scenarios
// =============================================================================

describe("SpacingControls — Integration", () => {
  it("box model control with input fields", () => {
    const controls = createSpacingControls();

    // Select element
    controls.selectElement("snippet-1");

    // Verify: Box model control with input fields
    // Set individual values for each side
    controls.setMargin("top", { value: 10, unit: "px" });
    controls.setMargin("right", { value: 20, unit: "px" });
    controls.setMargin("bottom", { value: 30, unit: "px" });
    controls.setMargin("left", { value: 40, unit: "px" });

    controls.setPadding("top", { value: 5, unit: "px" });
    controls.setPadding("right", { value: 10, unit: "px" });
    controls.setPadding("bottom", { value: 15, unit: "px" });
    controls.setPadding("left", { value: 20, unit: "px" });

    // Verify values
    expect(controls.getMargin("top")).toEqual({ value: 10, unit: "px" });
    expect(controls.getMargin("right")).toEqual({ value: 20, unit: "px" });
    expect(controls.getPadding("bottom")).toEqual({ value: 15, unit: "px" });

    controls.dispose();
  });

  it("box model control with drag handles", () => {
    const controls = createSpacingControls();
    const iframe = createMockIframe();

    controls.connect(iframe);
    controls.selectElement("snippet-1");

    // Set initial value
    controls.setPadding("top", { value: 16, unit: "px" });

    // Verification: Drag handles
    // Start drag on top padding
    controls.startDrag("padding", "top");
    expect(controls.isDragging()).toBe(true);

    // Drag to increase by 8px
    controls.updateDrag("padding", "top", 8);
    expect(controls.getPadding("top").value).toBe(24);

    // End drag
    controls.endDrag();
    expect(controls.isDragging()).toBe(false);

    // Verify message sent to iframe
    const applyMsg = iframe.messages.find(
      (m: any) =>
        m.type === "platxa:apply-element-spacing" &&
        m.padding?.includes("24px")
    );
    expect(applyMsg).toBeDefined();

    controls.dispose();
  });

  it("supports full spacing workflow", () => {
    const controls = createSpacingControls();
    const iframe = createMockIframe();
    const changeHandler = vi.fn();

    // 1. Connect and setup
    controls.connect(iframe);
    controls.onChange(changeHandler);

    // 2. Select element with initial spacing
    controls.selectElement("section-hero", {
      margin: parseBoxSpacing("0"),
      padding: parseBoxSpacing("32px 16px"),
    });

    // 3. Verify initial state
    expect(controls.getPadding("top")).toEqual({ value: 32, unit: "px" });
    expect(controls.getPadding("left")).toEqual({ value: 16, unit: "px" });

    // 4. Apply preset
    controls.applyPaddingPreset("xl"); // 32px

    // 5. Link and update all sides
    controls.setMarginLinked(true);
    controls.setMargin("top", { value: 8, unit: "px" });

    // 6. Verify all margins are linked
    expect(controls.getMargin("bottom")).toEqual({ value: 8, unit: "px" });

    // 7. Check callbacks were called
    expect(changeHandler).toHaveBeenCalled();

    controls.dispose();
  });
});

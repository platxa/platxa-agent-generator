/**
 * Tests for Panel Layout Presets
 *
 * Feature #122: Add panel layout presets (code-focused, preview-focused, balanced)
 * Verification: Preset buttons instantly resize panels to predefined ratios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PanelLayoutPresets,
  createPanelLayoutPresets,
  LAYOUT_PRESETS,
  PRESET_SHORTCUTS,
  DEFAULT_MIN_SIZES,
  DEFAULT_MAX_SIZES,
  DEFAULT_TRANSITION,
  SMOOTH_TRANSITION,
  SPRING_TRANSITION,
  STORAGE_KEY,
  getPreset,
  getAllPresetNames,
  getAllPresets,
  findPresetByShortcut,
  getPanelRatio,
  isPanelVisible,
  validateRatios,
  normalizeRatios,
  calculatePixelSizes,
  generatePanelCSS,
  createTransitionCSS,
  loadPersistedPreset,
  persistPreset,
  clearPersistedPreset,
  generatePresetButtons,
  generatePresetButtonsHTML,
  type PresetName,
  type PanelConfig,
  type LayoutPreset,
} from "../../lib/preview/panel-layout-presets";

// ============================================================================
// Type Exports
// ============================================================================

describe("Type exports", () => {
  it("should export PresetName type", () => {
    const name: PresetName = "balanced";
    expect(name).toBe("balanced");
  });

  it("should support all preset names", () => {
    const names: PresetName[] = [
      "code-focused",
      "preview-focused",
      "balanced",
      "code-only",
      "preview-only",
      "minimal-code",
      "minimal-preview",
    ];
    expect(names.length).toBe(7);
  });
});

// ============================================================================
// Constants
// ============================================================================

describe("Constants", () => {
  describe("LAYOUT_PRESETS", () => {
    it("should have all 7 built-in presets", () => {
      expect(Object.keys(LAYOUT_PRESETS).length).toBe(7);
    });

    it("should have code-focused preset with 70/30 ratio", () => {
      const preset = LAYOUT_PRESETS["code-focused"];
      expect(preset.label).toBe("Code Focused");
      const codePanel = preset.panels.find((p) => p.id === "code");
      const previewPanel = preset.panels.find((p) => p.id === "preview");
      expect(codePanel?.ratio).toBe(0.7);
      expect(previewPanel?.ratio).toBe(0.3);
    });

    it("should have preview-focused preset with 30/70 ratio", () => {
      const preset = LAYOUT_PRESETS["preview-focused"];
      const codePanel = preset.panels.find((p) => p.id === "code");
      const previewPanel = preset.panels.find((p) => p.id === "preview");
      expect(codePanel?.ratio).toBe(0.3);
      expect(previewPanel?.ratio).toBe(0.7);
    });

    it("should have balanced preset with 50/50 ratio", () => {
      const preset = LAYOUT_PRESETS["balanced"];
      const codePanel = preset.panels.find((p) => p.id === "code");
      const previewPanel = preset.panels.find((p) => p.id === "preview");
      expect(codePanel?.ratio).toBe(0.5);
      expect(previewPanel?.ratio).toBe(0.5);
    });

    it("should have code-only preset with hidden preview", () => {
      const preset = LAYOUT_PRESETS["code-only"];
      const codePanel = preset.panels.find((p) => p.id === "code");
      const previewPanel = preset.panels.find((p) => p.id === "preview");
      expect(codePanel?.ratio).toBe(1.0);
      expect(previewPanel?.visibility).toBe("hidden");
    });

    it("should have preview-only preset with hidden code", () => {
      const preset = LAYOUT_PRESETS["preview-only"];
      const codePanel = preset.panels.find((p) => p.id === "code");
      const previewPanel = preset.panels.find((p) => p.id === "preview");
      expect(previewPanel?.ratio).toBe(1.0);
      expect(codePanel?.visibility).toBe("hidden");
    });
  });

  describe("PRESET_SHORTCUTS", () => {
    it("should have shortcuts for all presets", () => {
      expect(PRESET_SHORTCUTS["code-focused"]).toBe("Ctrl+1");
      expect(PRESET_SHORTCUTS["preview-focused"]).toBe("Ctrl+2");
      expect(PRESET_SHORTCUTS["balanced"]).toBe("Ctrl+3");
      expect(PRESET_SHORTCUTS["code-only"]).toBe("Ctrl+4");
      expect(PRESET_SHORTCUTS["preview-only"]).toBe("Ctrl+5");
    });
  });

  describe("DEFAULT_MIN_SIZES", () => {
    it("should have minimum sizes for all panel types", () => {
      expect(DEFAULT_MIN_SIZES.code).toBe(200);
      expect(DEFAULT_MIN_SIZES.preview).toBe(200);
      expect(DEFAULT_MIN_SIZES.sidebar).toBe(150);
    });
  });

  describe("DEFAULT_MAX_SIZES", () => {
    it("should have maximum sizes for all panel types", () => {
      expect(DEFAULT_MAX_SIZES.code).toBe(2000);
      expect(DEFAULT_MAX_SIZES.preview).toBe(2000);
    });
  });

  describe("Transition constants", () => {
    it("should have instant transition with 0 duration", () => {
      expect(DEFAULT_TRANSITION.style).toBe("instant");
      expect(DEFAULT_TRANSITION.duration).toBe(0);
    });

    it("should have smooth transition with 300ms duration", () => {
      expect(SMOOTH_TRANSITION.style).toBe("smooth");
      expect(SMOOTH_TRANSITION.duration).toBe(300);
    });

    it("should have spring transition with 400ms duration", () => {
      expect(SPRING_TRANSITION.style).toBe("spring");
      expect(SPRING_TRANSITION.duration).toBe(400);
    });
  });

  describe("STORAGE_KEY", () => {
    it("should have expected storage key", () => {
      expect(STORAGE_KEY).toBe("platxa-panel-layout-preset");
    });
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe("Utility Functions", () => {
  describe("getPreset", () => {
    it("should return preset by name", () => {
      const preset = getPreset("balanced");
      expect(preset.name).toBe("balanced");
      expect(preset.label).toBe("Balanced");
    });
  });

  describe("getAllPresetNames", () => {
    it("should return all preset names", () => {
      const names = getAllPresetNames();
      expect(names).toContain("code-focused");
      expect(names).toContain("preview-focused");
      expect(names).toContain("balanced");
      expect(names.length).toBe(7);
    });
  });

  describe("getAllPresets", () => {
    it("should return all presets as array", () => {
      const presets = getAllPresets();
      expect(presets.length).toBe(7);
      expect(presets[0]).toHaveProperty("name");
      expect(presets[0]).toHaveProperty("panels");
    });
  });

  describe("findPresetByShortcut", () => {
    it("should find preset by keyboard shortcut", () => {
      const preset = findPresetByShortcut("Ctrl+1");
      expect(preset?.name).toBe("code-focused");
    });

    it("should return undefined for unknown shortcut", () => {
      const preset = findPresetByShortcut("Ctrl+9");
      expect(preset).toBeUndefined();
    });
  });

  describe("getPanelRatio", () => {
    it("should get panel ratio from preset", () => {
      const preset = LAYOUT_PRESETS["code-focused"];
      expect(getPanelRatio(preset, "code")).toBe(0.7);
      expect(getPanelRatio(preset, "preview")).toBe(0.3);
    });

    it("should return 0 for non-existent panel", () => {
      const preset = LAYOUT_PRESETS["balanced"];
      expect(getPanelRatio(preset, "sidebar")).toBe(0);
    });
  });

  describe("isPanelVisible", () => {
    it("should return true for visible panels", () => {
      const preset = LAYOUT_PRESETS["balanced"];
      expect(isPanelVisible(preset, "code")).toBe(true);
      expect(isPanelVisible(preset, "preview")).toBe(true);
    });

    it("should return false for hidden panels", () => {
      const preset = LAYOUT_PRESETS["code-only"];
      expect(isPanelVisible(preset, "preview")).toBe(false);
    });
  });

  describe("validateRatios", () => {
    it("should return true for valid ratios summing to 1", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 0.5, visibility: "visible" },
        { id: "preview", ratio: 0.5, visibility: "visible" },
      ];
      expect(validateRatios(panels)).toBe(true);
    });

    it("should return false for invalid ratios", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 0.5, visibility: "visible" },
        { id: "preview", ratio: 0.3, visibility: "visible" },
      ];
      expect(validateRatios(panels)).toBe(false);
    });

    it("should ignore hidden panels", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 1.0, visibility: "visible" },
        { id: "preview", ratio: 0.5, visibility: "hidden" },
      ];
      expect(validateRatios(panels)).toBe(true);
    });
  });

  describe("normalizeRatios", () => {
    it("should normalize ratios to sum to 1", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 2, visibility: "visible" },
        { id: "preview", ratio: 2, visibility: "visible" },
      ];
      const normalized = normalizeRatios(panels);
      expect(normalized[0].ratio).toBe(0.5);
      expect(normalized[1].ratio).toBe(0.5);
    });

    it("should handle zero sum", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 0, visibility: "visible" },
        { id: "preview", ratio: 0, visibility: "visible" },
      ];
      const normalized = normalizeRatios(panels);
      expect(normalized[0].ratio).toBe(0);
    });
  });

  describe("calculatePixelSizes", () => {
    it("should calculate pixel sizes from ratios", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 0.5, visibility: "visible" },
        { id: "preview", ratio: 0.5, visibility: "visible" },
      ];
      const sizes = calculatePixelSizes(panels, 1000);
      expect(sizes.get("code")).toBe(500);
      expect(sizes.get("preview")).toBe(500);
    });

    it("should apply min size constraints", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 0.1, visibility: "visible", minSize: 200 },
        { id: "preview", ratio: 0.9, visibility: "visible" },
      ];
      const sizes = calculatePixelSizes(panels, 1000);
      expect(sizes.get("code")).toBe(200);
    });

    it("should return 0 for hidden panels", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 1.0, visibility: "visible" },
        { id: "preview", ratio: 0, visibility: "hidden" },
      ];
      const sizes = calculatePixelSizes(panels, 1000);
      expect(sizes.get("preview")).toBe(0);
    });
  });

  describe("generatePanelCSS", () => {
    it("should generate width CSS for horizontal orientation", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 0.5, visibility: "visible" },
        { id: "preview", ratio: 0.5, visibility: "visible" },
      ];
      const css = generatePanelCSS(panels, "horizontal");
      expect(css.get("code")).toBe("width: 50.00%");
      expect(css.get("preview")).toBe("width: 50.00%");
    });

    it("should generate height CSS for vertical orientation", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 0.5, visibility: "visible" },
        { id: "preview", ratio: 0.5, visibility: "visible" },
      ];
      const css = generatePanelCSS(panels, "vertical");
      expect(css.get("code")).toBe("height: 50.00%");
    });

    it("should hide hidden panels", () => {
      const panels: PanelConfig[] = [
        { id: "code", ratio: 1.0, visibility: "visible" },
        { id: "preview", ratio: 0, visibility: "hidden" },
      ];
      const css = generatePanelCSS(panels, "horizontal");
      expect(css.get("preview")).toContain("display: none");
    });
  });

  describe("createTransitionCSS", () => {
    it("should return none for instant transition", () => {
      expect(createTransitionCSS(DEFAULT_TRANSITION, "horizontal")).toBe("none");
    });

    it("should generate smooth transition CSS", () => {
      const css = createTransitionCSS(SMOOTH_TRANSITION, "horizontal");
      expect(css).toBe("width 300ms ease-out");
    });

    it("should generate spring transition CSS", () => {
      const css = createTransitionCSS(SPRING_TRANSITION, "horizontal");
      expect(css).toContain("width 400ms cubic-bezier");
    });

    it("should use height for vertical orientation", () => {
      const css = createTransitionCSS(SMOOTH_TRANSITION, "vertical");
      expect(css).toBe("height 300ms ease-out");
    });
  });
});

// ============================================================================
// Storage Functions
// ============================================================================

describe("Storage Functions", () => {
  beforeEach(() => {
    // Mock localStorage
    const storage: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("persistPreset", () => {
    it("should save preset to localStorage", () => {
      const result = persistPreset("code-focused");
      expect(result).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "code-focused");
    });
  });

  describe("loadPersistedPreset", () => {
    it("should load preset from localStorage", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("balanced");
      const preset = loadPersistedPreset();
      expect(preset).toBe("balanced");
    });

    it("should return null for invalid preset", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue("invalid");
      const preset = loadPersistedPreset();
      expect(preset).toBeNull();
    });
  });

  describe("clearPersistedPreset", () => {
    it("should remove preset from localStorage", () => {
      const result = clearPersistedPreset();
      expect(result).toBe(true);
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });
});

// ============================================================================
// PanelLayoutPresets Class
// ============================================================================

describe("PanelLayoutPresets", () => {
  let presets: PanelLayoutPresets;

  beforeEach(() => {
    presets = new PanelLayoutPresets();
  });

  afterEach(() => {
    presets.dispose();
  });

  describe("constructor", () => {
    it("should create with default balanced preset", () => {
      expect(presets.getActivePreset()).toBe("balanced");
    });

    it("should use initial preset from options", () => {
      const p = new PanelLayoutPresets({ initialPreset: "code-focused" });
      expect(p.getActivePreset()).toBe("code-focused");
      p.dispose();
    });

    it("should add custom presets", () => {
      const customPreset: LayoutPreset = {
        name: "custom" as PresetName,
        label: "Custom",
        description: "Custom preset",
        orientation: "horizontal",
        panels: [
          { id: "code", ratio: 0.6, visibility: "visible" },
          { id: "preview", ratio: 0.4, visibility: "visible" },
        ],
      };
      const p = new PanelLayoutPresets({ customPresets: [customPreset] });
      expect(p.getPreset("custom" as PresetName)).toBeDefined();
      p.dispose();
    });
  });

  describe("getState", () => {
    it("should return current layout state", () => {
      const state = presets.getState();
      expect(state.activePreset).toBe("balanced");
      expect(state.orientation).toBe("horizontal");
      expect(state.isTransitioning).toBe(false);
    });

    it("should return a copy of panels map", () => {
      const state = presets.getState();
      state.panels.clear();
      expect(presets.getState().panels.size).toBeGreaterThan(0);
    });
  });

  describe("getActivePreset", () => {
    it("should return current preset name", () => {
      expect(presets.getActivePreset()).toBe("balanced");
    });
  });

  describe("getPreset", () => {
    it("should return preset definition", () => {
      const preset = presets.getPreset("code-focused");
      expect(preset?.name).toBe("code-focused");
    });

    it("should return undefined for unknown preset", () => {
      expect(presets.getPreset("unknown" as PresetName)).toBeUndefined();
    });
  });

  describe("getAllPresets", () => {
    it("should return all available presets", () => {
      const allPresets = presets.getAllPresets();
      expect(allPresets.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe("getPanel", () => {
    it("should return panel configuration", () => {
      const panel = presets.getPanel("code");
      expect(panel?.id).toBe("code");
      expect(panel?.ratio).toBe(0.5);
    });

    it("should return undefined for unknown panel", () => {
      expect(presets.getPanel("unknown" as any)).toBeUndefined();
    });
  });

  describe("getAllPanels", () => {
    it("should return all panel configurations", () => {
      const panels = presets.getAllPanels();
      expect(panels.length).toBe(2);
    });
  });

  describe("applyPreset", () => {
    it("should apply preset and update state", () => {
      const result = presets.applyPreset("code-focused");
      expect(result).toBe(true);
      expect(presets.getActivePreset()).toBe("code-focused");
      expect(presets.getPanel("code")?.ratio).toBe(0.7);
    });

    it("should return false for unknown preset", () => {
      const result = presets.applyPreset("unknown" as PresetName);
      expect(result).toBe(false);
    });

    it("should store previous preset", () => {
      presets.applyPreset("code-focused");
      const state = presets.getState();
      expect(state.previousPreset).toBe("balanced");
    });

    it("should trigger preset change callback", () => {
      const callback = vi.fn();
      presets.onPresetChange(callback);
      presets.applyPreset("code-focused");
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].from).toBe("balanced");
      expect(callback.mock.calls[0][0].to).toBe("code-focused");
    });

    it("should trigger resize callbacks for changed panels", () => {
      const callback = vi.fn();
      presets.onResize(callback);
      presets.applyPreset("code-focused");
      expect(callback).toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      presets.dispose();
      expect(() => presets.applyPreset("code-focused")).toThrow("disposed");
    });
  });

  describe("revertToPrevious", () => {
    it("should revert to previous preset", () => {
      presets.applyPreset("code-focused");
      const result = presets.revertToPrevious();
      expect(result).toBe(true);
      expect(presets.getActivePreset()).toBe("balanced");
    });

    it("should return false if no previous preset", () => {
      expect(presets.revertToPrevious()).toBe(false);
    });
  });

  describe("resizePanel", () => {
    it("should resize panel and mark as custom layout", () => {
      const result = presets.resizePanel("code", 0.6);
      expect(result).toBe(true);
      expect(presets.getPanel("code")?.ratio).toBe(0.6);
      expect(presets.getActivePreset()).toBeNull();
    });

    it("should clamp ratio to valid range", () => {
      presets.resizePanel("code", 1.5);
      expect(presets.getPanel("code")?.ratio).toBe(1);
      presets.resizePanel("code", -0.5);
      expect(presets.getPanel("code")?.ratio).toBe(0);
    });

    it("should return false for same ratio", () => {
      expect(presets.resizePanel("code", 0.5)).toBe(false);
    });

    it("should return false for unknown panel", () => {
      expect(presets.resizePanel("unknown" as any, 0.5)).toBe(false);
    });

    it("should trigger resize callback", () => {
      const callback = vi.fn();
      presets.onResize(callback);
      presets.resizePanel("code", 0.6);
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].source).toBe("manual");
    });

    it("should throw if disposed", () => {
      presets.dispose();
      expect(() => presets.resizePanel("code", 0.6)).toThrow("disposed");
    });
  });

  describe("togglePanel", () => {
    it("should toggle panel visibility", () => {
      const result = presets.togglePanel("code");
      expect(result).toBe(true);
      expect(presets.getPanel("code")?.visibility).toBe("hidden");
    });

    it("should mark as custom layout", () => {
      presets.togglePanel("code");
      expect(presets.getActivePreset()).toBeNull();
    });

    it("should return false for unknown panel", () => {
      expect(presets.togglePanel("unknown" as any)).toBe(false);
    });

    it("should throw if disposed", () => {
      presets.dispose();
      expect(() => presets.togglePanel("code")).toThrow("disposed");
    });
  });

  describe("setPanelVisibility", () => {
    it("should set panel visibility", () => {
      const result = presets.setPanelVisibility("code", "hidden");
      expect(result).toBe(true);
      expect(presets.getPanel("code")?.visibility).toBe("hidden");
    });

    it("should return false for same visibility", () => {
      expect(presets.setPanelVisibility("code", "visible")).toBe(false);
    });

    it("should throw if disposed", () => {
      presets.dispose();
      expect(() => presets.setPanelVisibility("code", "hidden")).toThrow("disposed");
    });
  });

  describe("addPreset", () => {
    it("should add custom preset", () => {
      const customPreset: LayoutPreset = {
        name: "custom" as PresetName,
        label: "Custom",
        description: "Custom preset",
        orientation: "horizontal",
        panels: [
          { id: "code", ratio: 0.6, visibility: "visible" },
          { id: "preview", ratio: 0.4, visibility: "visible" },
        ],
      };
      const result = presets.addPreset(customPreset);
      expect(result).toBe(true);
      expect(presets.getPreset("custom" as PresetName)).toBeDefined();
    });

    it("should normalize invalid ratios", () => {
      const customPreset: LayoutPreset = {
        name: "custom" as PresetName,
        label: "Custom",
        description: "Custom preset",
        orientation: "horizontal",
        panels: [
          { id: "code", ratio: 3, visibility: "visible" },
          { id: "preview", ratio: 1, visibility: "visible" },
        ],
      };
      presets.addPreset(customPreset);
      const preset = presets.getPreset("custom" as PresetName);
      expect(preset?.panels[0].ratio).toBe(0.75);
    });

    it("should throw if disposed", () => {
      presets.dispose();
      expect(() =>
        presets.addPreset({
          name: "test" as PresetName,
          label: "Test",
          description: "Test",
          orientation: "horizontal",
          panels: [],
        })
      ).toThrow("disposed");
    });
  });

  describe("removePreset", () => {
    it("should not remove built-in presets", () => {
      const result = presets.removePreset("balanced");
      expect(result).toBe(false);
    });

    it("should remove custom presets", () => {
      const customPreset: LayoutPreset = {
        name: "custom" as PresetName,
        label: "Custom",
        description: "Custom preset",
        orientation: "horizontal",
        panels: [],
      };
      presets.addPreset(customPreset);
      const result = presets.removePreset("custom" as PresetName);
      expect(result).toBe(true);
    });
  });

  describe("getLayoutCSS", () => {
    it("should return CSS for current layout", () => {
      const css = presets.getLayoutCSS();
      expect(css.get("code")).toBe("width: 50.00%");
      expect(css.get("preview")).toBe("width: 50.00%");
    });
  });

  describe("getTransitionCSS", () => {
    it("should return transition CSS", () => {
      const css = presets.getTransitionCSS();
      expect(css).toBe("none");
    });

    it("should accept options override", () => {
      const css = presets.getTransitionCSS({ style: "smooth", duration: 300 });
      expect(css).toBe("width 300ms ease-out");
    });
  });

  describe("matchesPreset", () => {
    it("should return true for matching preset", () => {
      expect(presets.matchesPreset("balanced")).toBe(true);
    });

    it("should return false for non-matching preset", () => {
      expect(presets.matchesPreset("code-focused")).toBe(false);
    });
  });

  describe("findMatchingPreset", () => {
    it("should find matching preset", () => {
      expect(presets.findMatchingPreset()).toBe("balanced");
    });

    it("should return null for custom layout", () => {
      presets.resizePanel("code", 0.6);
      expect(presets.findMatchingPreset()).toBeNull();
    });
  });

  describe("onPresetChange", () => {
    it("should subscribe to preset changes", () => {
      const callback = vi.fn();
      presets.onPresetChange(callback);
      presets.applyPreset("code-focused");
      expect(callback).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = presets.onPresetChange(callback);
      unsubscribe();
      presets.applyPreset("code-focused");
      expect(callback).not.toHaveBeenCalled();
    });

    it("should catch callback errors", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      presets.onPresetChange(() => {
        throw new Error("Callback error");
      });
      presets.applyPreset("code-focused");
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("should throw if disposed", () => {
      presets.dispose();
      expect(() => presets.onPresetChange(() => {})).toThrow("disposed");
    });
  });

  describe("onResize", () => {
    it("should subscribe to resize events", () => {
      const callback = vi.fn();
      presets.onResize(callback);
      presets.resizePanel("code", 0.6);
      expect(callback).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = presets.onResize(callback);
      unsubscribe();
      presets.resizePanel("code", 0.6);
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      presets.dispose();
      expect(() => presets.onResize(() => {})).toThrow("disposed");
    });
  });

  describe("onStateChange", () => {
    it("should subscribe to state changes", () => {
      const callback = vi.fn();
      presets.onStateChange(callback);
      presets.applyPreset("code-focused");
      expect(callback).toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = presets.onStateChange(callback);
      unsubscribe();
      presets.applyPreset("code-focused");
      expect(callback).not.toHaveBeenCalled();
    });

    it("should throw if disposed", () => {
      presets.dispose();
      expect(() => presets.onStateChange(() => {})).toThrow("disposed");
    });
  });

  describe("isDisposed", () => {
    it("should return false when not disposed", () => {
      expect(presets.isDisposed()).toBe(false);
    });

    it("should return true when disposed", () => {
      presets.dispose();
      expect(presets.isDisposed()).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should clear all callbacks", () => {
      const callback = vi.fn();
      presets.onPresetChange(callback);
      presets.onResize(callback);
      presets.onStateChange(callback);
      presets.dispose();
      expect(presets.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      presets.dispose();
      expect(() => presets.dispose()).not.toThrow();
    });
  });
});

// ============================================================================
// Factory Function
// ============================================================================

describe("createPanelLayoutPresets", () => {
  it("should create PanelLayoutPresets instance", () => {
    const p = createPanelLayoutPresets();
    expect(p).toBeInstanceOf(PanelLayoutPresets);
    p.dispose();
  });

  it("should pass options to constructor", () => {
    const p = createPanelLayoutPresets({ initialPreset: "code-focused" });
    expect(p.getActivePreset()).toBe("code-focused");
    p.dispose();
  });
});

// ============================================================================
// Preset Button Helpers
// ============================================================================

describe("Preset Button Helpers", () => {
  describe("generatePresetButtons", () => {
    it("should generate button configs for all presets", () => {
      const buttons = generatePresetButtons("balanced");
      expect(buttons.length).toBe(7);
    });

    it("should mark active preset", () => {
      const buttons = generatePresetButtons("code-focused");
      const active = buttons.find((b) => b.name === "code-focused");
      expect(active?.isActive).toBe(true);
    });

    it("should not mark inactive presets", () => {
      const buttons = generatePresetButtons("balanced");
      const inactive = buttons.find((b) => b.name === "code-focused");
      expect(inactive?.isActive).toBe(false);
    });
  });

  describe("generatePresetButtonsHTML", () => {
    it("should generate HTML for preset buttons", () => {
      const html = generatePresetButtonsHTML("balanced");
      expect(html).toContain('data-preset="code-focused"');
      expect(html).toContain('data-preset="balanced"');
      expect(html).toContain("active");
    });

    it("should use custom class name", () => {
      const html = generatePresetButtonsHTML("balanced", "my-btn");
      expect(html).toContain('class="my-btn');
    });

    it("should include accessibility attributes", () => {
      const html = generatePresetButtonsHTML("balanced");
      expect(html).toContain("aria-pressed");
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration", () => {
  it("should handle rapid preset switching", () => {
    const p = createPanelLayoutPresets();
    const callback = vi.fn();
    p.onPresetChange(callback);

    p.applyPreset("code-focused");
    p.applyPreset("preview-focused");
    p.applyPreset("balanced");
    p.applyPreset("code-only");

    expect(callback).toHaveBeenCalledTimes(4);
    expect(p.getActivePreset()).toBe("code-only");
    p.dispose();
  });

  it("should handle preset application with transitions", () => {
    vi.useFakeTimers();
    const p = createPanelLayoutPresets({ defaultTransition: "smooth", defaultDuration: 300 });
    const onComplete = vi.fn();

    p.applyPreset("code-focused", { onComplete });

    expect(p.getState().isTransitioning).toBe(true);

    vi.advanceTimersByTime(300);

    expect(p.getState().isTransitioning).toBe(false);
    expect(onComplete).toHaveBeenCalled();

    p.dispose();
    vi.useRealTimers();
  });

  it("should properly track state through multiple operations", () => {
    const p = createPanelLayoutPresets();

    // Start balanced
    expect(p.getActivePreset()).toBe("balanced");

    // Apply preset
    p.applyPreset("code-focused");
    expect(p.getPanel("code")?.ratio).toBe(0.7);

    // Manual resize
    p.resizePanel("code", 0.6);
    expect(p.getActivePreset()).toBeNull();

    // Apply another preset
    p.applyPreset("preview-focused");
    expect(p.getPanel("code")?.ratio).toBe(0.3);
    expect(p.getActivePreset()).toBe("preview-focused");

    p.dispose();
  });
});

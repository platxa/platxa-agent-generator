import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SelectModeController,
  createSelectMode,
  extractElementInfo,
  generateSelector,
  findSelectableAncestor,
  SELECT_MODE_SCRIPT,
  type SelectedElement,
  type SelectionEvent,
} from "@/lib/preview/select-mode";

describe("SelectModeController", () => {
  let controller: SelectModeController;

  beforeEach(() => {
    controller = new SelectModeController();
  });

  describe("state management", () => {
    it("starts in disabled state", () => {
      expect(controller.getState()).toBe("disabled");
      expect(controller.isEnabled()).toBe(false);
    });

    it("enables selection mode", () => {
      controller.enable();
      expect(controller.getState()).toBe("enabled");
      expect(controller.isEnabled()).toBe(true);
    });

    it("disables selection mode", () => {
      controller.enable();
      controller.disable();
      expect(controller.getState()).toBe("disabled");
      expect(controller.isEnabled()).toBe(false);
    });

    it("toggles selection mode on", () => {
      const result = controller.toggle();
      expect(result).toBe(true);
      expect(controller.isEnabled()).toBe(true);
    });

    it("toggles selection mode off", () => {
      controller.enable();
      const result = controller.toggle();
      expect(result).toBe(false);
      expect(controller.isEnabled()).toBe(false);
    });

    it("does not re-enable when already enabled", () => {
      controller.enable();
      controller.enable();
      expect(controller.getState()).toBe("enabled");
    });

    it("does not re-disable when already disabled", () => {
      controller.disable();
      expect(controller.getState()).toBe("disabled");
    });
  });

  describe("selection management", () => {
    const mockElement: SelectedElement = {
      snippetId: "snippet-0",
      elementId: "el-0",
      tagName: "section",
      classes: ["s_banner", "pt-5"],
      bounds: new DOMRect(0, 0, 100, 200),
      selector: '[data-snippet-id="snippet-0"]',
    };

    it("returns null when no element selected", () => {
      expect(controller.getSelected()).toBeNull();
    });

    it("selects an element when enabled", () => {
      controller.enable();
      controller.select(mockElement);

      expect(controller.getSelected()).toBe(mockElement);
      expect(controller.getState()).toBe("selecting");
    });

    it("does not select when disabled", () => {
      controller.select(mockElement);
      expect(controller.getSelected()).toBeNull();
    });

    it("clears selection", () => {
      controller.enable();
      controller.select(mockElement);
      controller.clearSelection();

      expect(controller.getSelected()).toBeNull();
      expect(controller.getState()).toBe("enabled");
    });

    it("clears selection when disabling", () => {
      controller.enable();
      controller.select(mockElement);
      controller.disable();

      expect(controller.getSelected()).toBeNull();
    });
  });

  describe("hover management", () => {
    const mockElement: SelectedElement = {
      snippetId: "snippet-1",
      elementId: null,
      tagName: "div",
      classes: ["container"],
      bounds: new DOMRect(10, 20, 300, 400),
      selector: '[data-snippet-id="snippet-1"]',
    };

    it("returns null when no element hovered", () => {
      expect(controller.getHovered()).toBeNull();
    });

    it("sets hovered element when enabled", () => {
      controller.enable();
      controller.setHover(mockElement);

      expect(controller.getHovered()).toBe(mockElement);
    });

    it("does not set hover when disabled", () => {
      controller.setHover(mockElement);
      expect(controller.getHovered()).toBeNull();
    });

    it("clears hover state", () => {
      controller.enable();
      controller.setHover(mockElement);
      controller.clearHover();

      expect(controller.getHovered()).toBeNull();
    });

    it("does not re-emit hover for same element", () => {
      const callback = vi.fn();
      controller.onSelection(callback);
      controller.enable();

      controller.setHover(mockElement);
      controller.setHover(mockElement); // Same element

      // Should only emit once
      const hoverEvents = callback.mock.calls.filter(
        (call) => call[0].type === "hover"
      );
      expect(hoverEvents).toHaveLength(1);
    });

    it("clears hover when disabling", () => {
      controller.enable();
      controller.setHover(mockElement);
      controller.disable();

      expect(controller.getHovered()).toBeNull();
    });
  });

  describe("event callbacks", () => {
    const mockElement: SelectedElement = {
      snippetId: "snippet-2",
      elementId: "el-2",
      tagName: "section",
      classes: ["s_features"],
      bounds: new DOMRect(0, 100, 500, 300),
      selector: '[data-snippet-id="snippet-2"]',
    };

    it("calls callback on select", () => {
      const callback = vi.fn();
      controller.onSelection(callback);
      controller.enable();
      controller.select(mockElement);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "select",
          element: mockElement,
          timestamp: expect.any(Number),
        })
      );
    });

    it("calls callback on deselect", () => {
      const callback = vi.fn();
      controller.onSelection(callback);
      controller.enable();
      controller.select(mockElement);
      controller.clearSelection();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "deselect",
          element: mockElement,
        })
      );
    });

    it("calls callback on hover", () => {
      const callback = vi.fn();
      controller.onSelection(callback);
      controller.enable();
      controller.setHover(mockElement);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "hover",
          element: mockElement,
        })
      );
    });

    it("calls callback on unhover", () => {
      const callback = vi.fn();
      controller.onSelection(callback);
      controller.enable();
      controller.setHover(mockElement);
      controller.clearHover();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "unhover",
          element: mockElement,
        })
      );
    });

    it("allows unsubscribing from callbacks", () => {
      const callback = vi.fn();
      const unsubscribe = controller.onSelection(callback);
      controller.enable();

      unsubscribe();
      controller.select(mockElement);

      expect(callback).not.toHaveBeenCalled();
    });

    it("handles callback errors gracefully", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCallback = vi.fn();

      controller.onSelection(errorCallback);
      controller.onSelection(normalCallback);
      controller.enable();

      // Should not throw
      expect(() => controller.select(mockElement)).not.toThrow();

      // Other callbacks should still be called
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe("configuration", () => {
    it("uses default options", () => {
      expect(controller.getSelectableSelector()).toBe(
        "[data-snippet-id], [data-element-id], section, [data-snippet]"
      );
      expect(controller.getHighlightColor()).toBe("#3b82f6");
      expect(controller.getSelectedColor()).toBe("#10b981");
      expect(controller.shouldPreventDefault()).toBe(true);
      expect(controller.shouldEscapeDisable()).toBe(true);
    });

    it("accepts custom options", () => {
      const custom = new SelectModeController({
        selectableSelector: ".custom-selectable",
        highlightColor: "#ff0000",
        selectedColor: "#00ff00",
        preventDefault: false,
        escapeToDisable: false,
      });

      expect(custom.getSelectableSelector()).toBe(".custom-selectable");
      expect(custom.getHighlightColor()).toBe("#ff0000");
      expect(custom.getSelectedColor()).toBe("#00ff00");
      expect(custom.shouldPreventDefault()).toBe(false);
      expect(custom.shouldEscapeDisable()).toBe(false);
    });
  });
});

describe("createSelectMode", () => {
  it("creates a controller with default options", () => {
    const controller = createSelectMode();
    expect(controller.isEnabled()).toBe(false);
  });

  it("creates an initially enabled controller", () => {
    const controller = createSelectMode({ initiallyEnabled: true });
    expect(controller.isEnabled()).toBe(true);
  });

  it("accepts custom options", () => {
    const controller = createSelectMode({
      highlightColor: "#custom",
      initiallyEnabled: true,
    });

    expect(controller.getHighlightColor()).toBe("#custom");
    expect(controller.isEnabled()).toBe(true);
  });
});

describe("generateSelector", () => {
  it("prefers data-snippet-id", () => {
    const el = document.createElement("section");
    el.setAttribute("data-snippet-id", "snippet-5");
    el.setAttribute("data-element-id", "el-5");
    el.id = "my-id";

    expect(generateSelector(el)).toBe('[data-snippet-id="snippet-5"]');
  });

  it("falls back to data-element-id", () => {
    const el = document.createElement("div");
    el.setAttribute("data-element-id", "el-10");
    el.id = "my-id";

    expect(generateSelector(el)).toBe('[data-element-id="el-10"]');
  });

  it("falls back to id", () => {
    const el = document.createElement("div");
    el.id = "unique-id";

    expect(generateSelector(el)).toBe("#unique-id");
  });

  it("generates path-based selector as last resort", () => {
    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.appendChild(child);
    document.body.appendChild(parent);

    const selector = generateSelector(child);
    expect(selector).toContain("span");

    document.body.removeChild(parent);
  });
});

describe("extractElementInfo", () => {
  it("extracts all element information", () => {
    const el = document.createElement("section");
    el.setAttribute("data-snippet-id", "snippet-3");
    el.setAttribute("data-element-id", "el-3");
    el.className = "s_banner pt-5 pb-5";
    document.body.appendChild(el);

    const info = extractElementInfo(el);

    expect(info.snippetId).toBe("snippet-3");
    expect(info.elementId).toBe("el-3");
    expect(info.tagName).toBe("section");
    expect(info.classes).toContain("s_banner");
    expect(info.classes).toContain("pt-5");
    // Verify bounds has DOMRect shape (JSDOM returns plain object, browsers return DOMRect)
    expect(info.bounds).toHaveProperty("x");
    expect(info.bounds).toHaveProperty("y");
    expect(info.bounds).toHaveProperty("width");
    expect(info.bounds).toHaveProperty("height");
    expect(info.bounds).toHaveProperty("top");
    expect(info.bounds).toHaveProperty("left");
    expect(info.bounds).toHaveProperty("right");
    expect(info.bounds).toHaveProperty("bottom");
    expect(info.selector).toBe('[data-snippet-id="snippet-3"]');

    document.body.removeChild(el);
  });

  it("handles elements without data attributes", () => {
    const el = document.createElement("div");
    el.className = "container";
    document.body.appendChild(el);

    const info = extractElementInfo(el);

    expect(info.snippetId).toBeNull();
    expect(info.elementId).toBeNull();
    expect(info.tagName).toBe("div");

    document.body.removeChild(el);
  });
});

describe("findSelectableAncestor", () => {
  it("finds ancestor matching selector", () => {
    const parent = document.createElement("section");
    parent.setAttribute("data-snippet-id", "snippet-4");
    const child = document.createElement("div");
    const grandchild = document.createElement("span");

    parent.appendChild(child);
    child.appendChild(grandchild);
    document.body.appendChild(parent);

    const found = findSelectableAncestor(grandchild, "[data-snippet-id]");
    expect(found).toBe(parent);

    document.body.removeChild(parent);
  });

  it("returns element itself if it matches", () => {
    const el = document.createElement("section");
    el.setAttribute("data-snippet-id", "snippet-5");
    document.body.appendChild(el);

    const found = findSelectableAncestor(el, "[data-snippet-id]");
    expect(found).toBe(el);

    document.body.removeChild(el);
  });

  it("returns null if no ancestor matches", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const found = findSelectableAncestor(el, "[data-nonexistent]");
    expect(found).toBeNull();

    document.body.removeChild(el);
  });
});

describe("SELECT_MODE_SCRIPT", () => {
  it("contains required script elements", () => {
    expect(SELECT_MODE_SCRIPT).toContain("<script>");
    expect(SELECT_MODE_SCRIPT).toContain("</script>");
  });

  it("includes cursor style for select mode", () => {
    expect(SELECT_MODE_SCRIPT).toContain("crosshair");
  });

  it("includes hover highlight styles", () => {
    expect(SELECT_MODE_SCRIPT).toContain("platxa-select-hover");
    expect(SELECT_MODE_SCRIPT).toContain("outline");
  });

  it("shows dashed outline on hover over snippet containers (Feature #73)", () => {
    // Feature #73 verification: Dashed outline appears on hover
    expect(SELECT_MODE_SCRIPT).toContain("dashed");
    expect(SELECT_MODE_SCRIPT).toContain("platxa-select-hover");
    // Verify the hover style applies dashed outline
    expect(SELECT_MODE_SCRIPT).toMatch(/\.platxa-select-hover\s*\{[^}]*dashed/);
  });

  it("includes selected highlight styles", () => {
    expect(SELECT_MODE_SCRIPT).toContain("platxa-select-selected");
  });

  it("handles postMessage communication", () => {
    expect(SELECT_MODE_SCRIPT).toContain("postMessage");
    expect(SELECT_MODE_SCRIPT).toContain("platxa:select-mode-enable");
    expect(SELECT_MODE_SCRIPT).toContain("platxa:select-mode-disable");
    expect(SELECT_MODE_SCRIPT).toContain("platxa:select-mode-toggle");
  });

  it("handles escape key", () => {
    expect(SELECT_MODE_SCRIPT).toContain("Escape");
    expect(SELECT_MODE_SCRIPT).toContain("platxa:select-escape");
  });

  it("sends ready message", () => {
    expect(SELECT_MODE_SCRIPT).toContain("platxa:select-mode-ready");
  });
});

describe("verification: toggle enables/disables selection mode", () => {
  it("toggle changes state correctly", () => {
    const controller = createSelectMode();

    // Initially disabled
    expect(controller.isEnabled()).toBe(false);

    // First toggle enables
    controller.toggle();
    expect(controller.isEnabled()).toBe(true);
    expect(controller.getState()).toBe("enabled");

    // Second toggle disables
    controller.toggle();
    expect(controller.isEnabled()).toBe(false);
    expect(controller.getState()).toBe("disabled");
  });

  it("cursor change is indicated in script styles", () => {
    // The script contains crosshair cursor style
    expect(SELECT_MODE_SCRIPT).toContain("cursor: crosshair");

    // Applied via platxa-select-mode class
    expect(SELECT_MODE_SCRIPT).toContain(".platxa-select-mode");
    expect(SELECT_MODE_SCRIPT).toContain("document.body.classList.add('platxa-select-mode')");
    expect(SELECT_MODE_SCRIPT).toContain("document.body.classList.remove('platxa-select-mode')");
  });

  it("full selection workflow works", () => {
    const events: SelectionEvent[] = [];
    const controller = createSelectMode();

    controller.onSelection((e) => events.push(e));

    // Enable select mode
    controller.toggle();
    expect(controller.isEnabled()).toBe(true);

    // Hover over element
    const hoverElement: SelectedElement = {
      snippetId: "snippet-test",
      elementId: null,
      tagName: "section",
      classes: ["s_banner"],
      bounds: new DOMRect(0, 0, 100, 100),
      selector: '[data-snippet-id="snippet-test"]',
    };
    controller.setHover(hoverElement);
    expect(events.some((e) => e.type === "hover")).toBe(true);

    // Select element
    controller.select(hoverElement);
    expect(events.some((e) => e.type === "select")).toBe(true);
    expect(controller.getSelected()).toBe(hoverElement);

    // Disable select mode (clears selection)
    controller.toggle();
    expect(controller.isEnabled()).toBe(false);
    expect(controller.getSelected()).toBeNull();
    expect(events.some((e) => e.type === "deselect")).toBe(true);
  });
});

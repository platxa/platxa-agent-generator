import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ClickToSourceController,
  createClickToSource,
  findSourceElement,
  extractClickEvent,
  checkModifierKey,
  CLICK_TO_SOURCE_SCRIPT,
  type ClickToSourceEvent,
} from "@/lib/preview/click-to-source";

describe("ClickToSourceController", () => {
  let controller: ClickToSourceController;

  beforeEach(() => {
    controller = new ClickToSourceController();
  });

  describe("state management", () => {
    it("starts enabled by default", () => {
      expect(controller.isEnabled()).toBe(true);
    });

    it("disables click-to-source", () => {
      controller.disable();
      expect(controller.isEnabled()).toBe(false);
    });

    it("enables click-to-source", () => {
      controller.disable();
      controller.enable();
      expect(controller.isEnabled()).toBe(true);
    });

    it("toggles state on", () => {
      controller.disable();
      const result = controller.toggle();
      expect(result).toBe(true);
      expect(controller.isEnabled()).toBe(true);
    });

    it("toggles state off", () => {
      const result = controller.toggle();
      expect(result).toBe(false);
      expect(controller.isEnabled()).toBe(false);
    });
  });

  describe("event handling", () => {
    const mockEvent: ClickToSourceEvent = {
      elementId: "el-0",
      snippetId: "snippet-0",
      bounds: {
        top: 100,
        left: 50,
        width: 200,
        height: 150,
        right: 250,
        bottom: 250,
      },
      tagName: "section",
      clickPosition: { x: 150, y: 175 },
    };

    it("calls callback on handleEvent", () => {
      const callback = vi.fn();
      controller.onClickToSource(callback);
      controller.handleEvent(mockEvent);

      expect(callback).toHaveBeenCalledWith(mockEvent);
    });

    it("does not call callback when disabled", () => {
      const callback = vi.fn();
      controller.onClickToSource(callback);
      controller.disable();
      controller.handleEvent(mockEvent);

      expect(callback).not.toHaveBeenCalled();
    });

    it("allows unsubscribing from callbacks", () => {
      const callback = vi.fn();
      const unsubscribe = controller.onClickToSource(callback);

      unsubscribe();
      controller.handleEvent(mockEvent);

      expect(callback).not.toHaveBeenCalled();
    });

    it("handles callback errors gracefully", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCallback = vi.fn();

      controller.onClickToSource(errorCallback);
      controller.onClickToSource(normalCallback);

      expect(() => controller.handleEvent(mockEvent)).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });

    it("calls multiple callbacks", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      controller.onClickToSource(callback1);
      controller.onClickToSource(callback2);
      controller.handleEvent(mockEvent);

      expect(callback1).toHaveBeenCalledWith(mockEvent);
      expect(callback2).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe("configuration", () => {
    it("uses default options", () => {
      expect(controller.getSourceSelector()).toBe(
        "[data-element-id], [data-snippet-id]"
      );
      expect(controller.getMessageType()).toBe("platxa:click-to-source");
      expect(controller.getModifierKey()).toBeNull();
      expect(controller.shouldPreventDefault()).toBe(false);
      expect(controller.shouldStopPropagation()).toBe(false);
    });

    it("accepts custom options", () => {
      const custom = new ClickToSourceController({
        sourceSelector: ".source-mapped",
        messageType: "custom:source-click",
        modifierKey: "ctrl",
        preventDefault: true,
        stopPropagation: true,
      });

      expect(custom.getSourceSelector()).toBe(".source-mapped");
      expect(custom.getMessageType()).toBe("custom:source-click");
      expect(custom.getModifierKey()).toBe("ctrl");
      expect(custom.shouldPreventDefault()).toBe(true);
      expect(custom.shouldStopPropagation()).toBe(true);
    });
  });
});

describe("createClickToSource", () => {
  it("creates a controller with default options", () => {
    const controller = createClickToSource();
    expect(controller.isEnabled()).toBe(true);
  });

  it("creates a disabled controller when specified", () => {
    const controller = createClickToSource({ initiallyEnabled: false });
    expect(controller.isEnabled()).toBe(false);
  });

  it("accepts custom options", () => {
    const controller = createClickToSource({
      modifierKey: "meta",
      initiallyEnabled: true,
    });

    expect(controller.getModifierKey()).toBe("meta");
    expect(controller.isEnabled()).toBe(true);
  });
});

describe("findSourceElement", () => {
  it("finds element with data-element-id", () => {
    const parent = document.createElement("div");
    parent.setAttribute("data-element-id", "el-5");
    const child = document.createElement("span");
    parent.appendChild(child);
    document.body.appendChild(parent);

    const found = findSourceElement(child, "[data-element-id]");
    expect(found).toBe(parent);

    document.body.removeChild(parent);
  });

  it("finds element with data-snippet-id", () => {
    const section = document.createElement("section");
    section.setAttribute("data-snippet-id", "snippet-3");
    const inner = document.createElement("div");
    section.appendChild(inner);
    document.body.appendChild(section);

    const found = findSourceElement(inner, "[data-snippet-id]");
    expect(found).toBe(section);

    document.body.removeChild(section);
  });

  it("returns element itself if it matches", () => {
    const el = document.createElement("div");
    el.setAttribute("data-element-id", "el-10");
    document.body.appendChild(el);

    const found = findSourceElement(el, "[data-element-id]");
    expect(found).toBe(el);

    document.body.removeChild(el);
  });

  it("returns null if no ancestor matches", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const found = findSourceElement(el, "[data-element-id]");
    expect(found).toBeNull();

    document.body.removeChild(el);
  });

  it("handles combined selector", () => {
    const el = document.createElement("section");
    el.setAttribute("data-snippet-id", "snippet-1");
    document.body.appendChild(el);

    const found = findSourceElement(el, "[data-element-id], [data-snippet-id]");
    expect(found).toBe(el);

    document.body.removeChild(el);
  });
});

describe("extractClickEvent", () => {
  it("extracts all event data from element", () => {
    const el = document.createElement("section");
    el.setAttribute("data-element-id", "el-7");
    el.setAttribute("data-snippet-id", "snippet-7");
    document.body.appendChild(el);

    const event = extractClickEvent(el, 100, 200);

    expect(event.elementId).toBe("el-7");
    expect(event.snippetId).toBe("snippet-7");
    expect(event.tagName).toBe("section");
    expect(event.clickPosition).toEqual({ x: 100, y: 200 });
    expect(event.bounds).toHaveProperty("top");
    expect(event.bounds).toHaveProperty("left");
    expect(event.bounds).toHaveProperty("width");
    expect(event.bounds).toHaveProperty("height");
    expect(event.bounds).toHaveProperty("right");
    expect(event.bounds).toHaveProperty("bottom");

    document.body.removeChild(el);
  });

  it("handles elements without IDs", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const event = extractClickEvent(el, 50, 75);

    expect(event.elementId).toBeNull();
    expect(event.snippetId).toBeNull();
    expect(event.tagName).toBe("div");

    document.body.removeChild(el);
  });
});

describe("checkModifierKey", () => {
  const createMouseEvent = (modifiers: Partial<MouseEvent> = {}): MouseEvent => {
    return {
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      ...modifiers,
    } as MouseEvent;
  };

  it("returns true when no modifier required", () => {
    const event = createMouseEvent();
    expect(checkModifierKey(event, null)).toBe(true);
  });

  it("checks ctrl key", () => {
    expect(checkModifierKey(createMouseEvent({ ctrlKey: true }), "ctrl")).toBe(true);
    expect(checkModifierKey(createMouseEvent({ ctrlKey: false }), "ctrl")).toBe(false);
  });

  it("checks meta key", () => {
    expect(checkModifierKey(createMouseEvent({ metaKey: true }), "meta")).toBe(true);
    expect(checkModifierKey(createMouseEvent({ metaKey: false }), "meta")).toBe(false);
  });

  it("checks alt key", () => {
    expect(checkModifierKey(createMouseEvent({ altKey: true }), "alt")).toBe(true);
    expect(checkModifierKey(createMouseEvent({ altKey: false }), "alt")).toBe(false);
  });

  it("checks shift key", () => {
    expect(checkModifierKey(createMouseEvent({ shiftKey: true }), "shift")).toBe(true);
    expect(checkModifierKey(createMouseEvent({ shiftKey: false }), "shift")).toBe(false);
  });

  it("returns true for unknown modifier", () => {
    const event = createMouseEvent();
    expect(checkModifierKey(event, "unknown" as "ctrl")).toBe(true);
  });
});

describe("CLICK_TO_SOURCE_SCRIPT", () => {
  it("contains script tags", () => {
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("<script>");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("</script>");
  });

  it("posts message to parent with elementId", () => {
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("elementId");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("postMessage");
  });

  it("includes bounding rect in message", () => {
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("bounds");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("getBoundingClientRect");
  });

  it("handles enable/disable messages", () => {
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("platxa:click-to-source-enable");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("platxa:click-to-source-disable");
  });

  it("handles configuration messages", () => {
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("platxa:click-to-source-config");
  });

  it("sends ready message", () => {
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("platxa:click-to-source-ready");
  });

  it("supports modifier key checking", () => {
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("modifierKey");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("ctrlKey");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("metaKey");
  });

  it("includes click position", () => {
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("clickPosition");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("clientX");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("clientY");
  });
});

describe("verification: click posts message with elementId and bounding rect", () => {
  it("extractClickEvent provides elementId and bounds", () => {
    const el = document.createElement("section");
    el.setAttribute("data-element-id", "test-el");
    document.body.appendChild(el);

    const event = extractClickEvent(el, 100, 200);

    // Verification: elementId is present
    expect(event.elementId).toBe("test-el");

    // Verification: bounding rect is present with all properties
    expect(event.bounds).toBeDefined();
    expect(typeof event.bounds.top).toBe("number");
    expect(typeof event.bounds.left).toBe("number");
    expect(typeof event.bounds.width).toBe("number");
    expect(typeof event.bounds.height).toBe("number");

    document.body.removeChild(el);
  });

  it("script contains postMessage with required data", () => {
    // Verification: script posts message with elementId
    expect(CLICK_TO_SOURCE_SCRIPT).toContain(
      "elementId: target.getAttribute('data-element-id')"
    );

    // Verification: script posts message with bounds
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("bounds: {");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("top: rect.top");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("left: rect.left");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("width: rect.width");
    expect(CLICK_TO_SOURCE_SCRIPT).toContain("height: rect.height");
  });

  it("controller receives and dispatches click events", () => {
    const controller = createClickToSource();
    const receivedEvents: ClickToSourceEvent[] = [];

    controller.onClickToSource((e) => receivedEvents.push(e));

    const mockEvent: ClickToSourceEvent = {
      elementId: "el-verify",
      snippetId: null,
      bounds: { top: 10, left: 20, width: 100, height: 50, right: 120, bottom: 60 },
      tagName: "div",
      clickPosition: { x: 70, y: 35 },
    };

    controller.handleEvent(mockEvent);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].elementId).toBe("el-verify");
    expect(receivedEvents[0].bounds).toEqual(mockEvent.bounds);
  });
});

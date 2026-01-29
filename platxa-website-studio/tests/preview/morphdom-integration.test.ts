import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MorphdomIntegration,
  createMorphdom,
  quickMorph,
  morphWithDefaults,
  createDefaultBeforeElUpdated,
  createAttributePreservingHook,
  combineBeforeElUpdatedHooks,
  morphdom,
  type MorphdomConfig,
  type MorphResult,
} from "@/lib/preview/morphdom-integration";

describe("MorphdomIntegration", () => {
  let integration: MorphdomIntegration;
  let container: HTMLElement;

  beforeEach(() => {
    integration = new MorphdomIntegration();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("morph", () => {
    it("morphs element to match new HTML", () => {
      container.innerHTML = "<div><p>Old content</p></div>";
      const target = container.firstElementChild!;

      const result = integration.morph(target, "<div><p>New content</p></div>");

      expect(result.success).toBe(true);
      expect(container.textContent).toContain("New content");
    });

    it("morphs element from Element instance", () => {
      container.innerHTML = "<div><p>Old</p></div>";
      const target = container.firstElementChild!;

      const newEl = document.createElement("div");
      newEl.innerHTML = "<p>New</p>";

      const result = integration.morph(target, newEl);

      expect(result.success).toBe(true);
      expect(container.textContent).toContain("New");
    });

    it("returns error for invalid HTML", () => {
      container.innerHTML = "<div></div>";
      const target = container.firstElementChild!;

      const result = integration.morph(target, "   ");

      expect(result.success).toBe(false);
      expect(result.error).toContain("no root element");
    });

    it("tracks updated elements count", () => {
      container.innerHTML = "<div><p>A</p><p>B</p></div>";
      const target = container.firstElementChild!;

      const result = integration.morph(target, "<div><p>A2</p><p>B2</p></div>");

      expect(result.success).toBe(true);
      expect(result.elementsUpdated).toBeGreaterThan(0);
    });

    it("tracks duration", () => {
      container.innerHTML = "<div></div>";
      const target = container.firstElementChild!;

      const result = integration.morph(target, "<div><p>New</p></div>");

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("calls callback with result", () => {
      const callback = vi.fn();
      container.innerHTML = "<div></div>";
      const target = container.firstElementChild!;

      integration.morph(target, "<div><p>New</p></div>", callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe("morphChildren", () => {
    it("morphs only children of target", () => {
      container.innerHTML = '<div id="parent" class="keep-me"><p>Old</p></div>';
      const target = container.firstElementChild!;

      integration.morphChildren(target, '<div id="different"><p>New</p></div>');

      // Parent attributes should be preserved
      expect(target.id).toBe("parent");
      expect(target.className).toBe("keep-me");
      // Children should be updated
      expect(target.textContent).toContain("New");
    });
  });

  describe("configuration", () => {
    it("uses default config", () => {
      const config = integration.getConfig();

      expect(config.preserveFocus).toBe(true);
      expect(config.skipTransitions).toBe(true);
      expect(config.preserveFormValues).toBe(true);
    });

    it("accepts custom config", () => {
      const custom = new MorphdomIntegration({
        preserveFocus: false,
        skipTransitions: false,
      });

      const config = custom.getConfig();

      expect(config.preserveFocus).toBe(false);
      expect(config.skipTransitions).toBe(false);
    });

    it("updates config", () => {
      integration.updateConfig({ preserveFocus: false });

      expect(integration.getConfig().preserveFocus).toBe(false);
    });
  });

  describe("custom hooks", () => {
    it("calls onBeforeElUpdated hook", () => {
      const hook = vi.fn().mockReturnValue(true);
      const customIntegration = new MorphdomIntegration({
        onBeforeElUpdated: hook,
      });

      container.innerHTML = "<div><p>Old</p></div>";
      const target = container.firstElementChild!;

      customIntegration.morph(target, "<div><p>New</p></div>");

      expect(hook).toHaveBeenCalled();
    });

    it("skips update when hook returns false", () => {
      const customIntegration = new MorphdomIntegration({
        onBeforeElUpdated: () => false,
      });

      container.innerHTML = "<div><p>Old</p></div>";
      const target = container.firstElementChild!;

      customIntegration.morph(target, "<div><p>New</p></div>");

      // Content should not change when hook returns false
      expect(container.textContent).toContain("Old");
    });

    it("calls onNodeAdded for new elements", () => {
      const hook = vi.fn();
      const customIntegration = new MorphdomIntegration({
        onNodeAdded: hook,
      });

      container.innerHTML = "<div></div>";
      const target = container.firstElementChild!;

      // morphdom calls onNodeAdded when new child nodes are added
      customIntegration.morph(target, "<div><p>New element</p></div>");

      expect(hook).toHaveBeenCalled();
      expect(container.textContent).toContain("New element");
    });
  });
});

describe("createMorphdom", () => {
  it("creates MorphdomIntegration instance", () => {
    const integration = createMorphdom();
    expect(integration).toBeInstanceOf(MorphdomIntegration);
  });

  it("accepts custom config", () => {
    const integration = createMorphdom({ preserveFocus: false });
    expect(integration.getConfig().preserveFocus).toBe(false);
  });
});

describe("quickMorph", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("performs one-off morph", () => {
    container.innerHTML = "<div><p>Old</p></div>";
    const target = container.firstElementChild!;

    const result = quickMorph(target, "<div><p>New</p></div>");

    expect(result.success).toBe(true);
    expect(container.textContent).toContain("New");
  });

  it("accepts custom config", () => {
    container.innerHTML = "<div><p>Old</p></div>";
    const target = container.firstElementChild!;

    const result = quickMorph(target, "<div><p>New</p></div>", {
      preserveFocus: false,
    });

    expect(result.success).toBe(true);
  });
});

describe("morphWithDefaults", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("morphs with default HMR options", () => {
    container.innerHTML = "<div><p>Old</p></div>";
    const target = container.firstElementChild!;

    morphWithDefaults(target, "<div><p>New</p></div>");

    expect(container.textContent).toContain("New");
  });

  it("accepts HTML string", () => {
    container.innerHTML = "<div><p>Old</p></div>";
    const target = container.firstElementChild!;

    morphWithDefaults(target, "<div><p>String content</p></div>");

    expect(container.textContent).toContain("String content");
  });

  it("accepts Element instance", () => {
    container.innerHTML = "<div><p>Old</p></div>";
    const target = container.firstElementChild!;

    const newEl = document.createElement("div");
    newEl.innerHTML = "<p>Element content</p>";

    morphWithDefaults(target, newEl);

    expect(container.textContent).toContain("Element content");
  });

  it("allows additional options", () => {
    const customHook = vi.fn().mockReturnValue(true);
    container.innerHTML = "<div><p>Old</p></div>";
    const target = container.firstElementChild!;

    morphWithDefaults(target, "<div><p>New</p></div>", {
      onBeforeElUpdated: customHook,
    });

    expect(customHook).toHaveBeenCalled();
  });
});

describe("createDefaultBeforeElUpdated", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("preserves focus by default", () => {
    const hook = createDefaultBeforeElUpdated({ preserveFocus: true });

    container.innerHTML = '<input type="text" />';
    const input = container.querySelector("input")!;
    input.focus();

    const newInput = document.createElement("input");
    newInput.type = "text";

    // Should return false to skip update on focused element
    expect(hook(input, newInput)).toBe(false);
  });

  it("allows update when preserveFocus is false", () => {
    const hook = createDefaultBeforeElUpdated({ preserveFocus: false });

    container.innerHTML = '<input type="text" />';
    const input = container.querySelector("input")!;
    input.focus();

    const newInput = document.createElement("input");
    newInput.type = "text";

    expect(hook(input, newInput)).toBe(true);
  });

  it("skips elements matching skipSelector", () => {
    const hook = createDefaultBeforeElUpdated({ skipSelector: ".no-update" });

    const el = document.createElement("div");
    el.className = "no-update";
    const newEl = document.createElement("div");

    expect(hook(el, newEl)).toBe(false);
  });

  it("preserves checkbox checked state", () => {
    const hook = createDefaultBeforeElUpdated({ preserveFormValues: true });

    const fromInput = document.createElement("input");
    fromInput.type = "checkbox";
    fromInput.checked = true;

    const toInput = document.createElement("input");
    toInput.type = "checkbox";
    toInput.checked = false;

    hook(fromInput, toInput);

    expect(toInput.checked).toBe(true);
  });

  it("preserves text input value", () => {
    const hook = createDefaultBeforeElUpdated({ preserveFormValues: true });

    const fromInput = document.createElement("input");
    fromInput.type = "text";
    fromInput.value = "user input";

    const toInput = document.createElement("input");
    toInput.type = "text";
    toInput.value = "";

    hook(fromInput, toInput);

    expect(toInput.value).toBe("user input");
  });

  it("preserves textarea value", () => {
    const hook = createDefaultBeforeElUpdated({ preserveFormValues: true });

    const fromTextarea = document.createElement("textarea");
    fromTextarea.value = "user text";

    const toTextarea = document.createElement("textarea");
    toTextarea.value = "";

    hook(fromTextarea, toTextarea);

    expect(toTextarea.value).toBe("user text");
  });

  it("preserves select value", () => {
    const hook = createDefaultBeforeElUpdated({ preserveFormValues: true });

    const fromSelect = document.createElement("select");
    fromSelect.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    fromSelect.value = "b";

    const toSelect = document.createElement("select");
    toSelect.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    toSelect.value = "a";

    hook(fromSelect, toSelect);

    expect(toSelect.value).toBe("b");
  });
});

describe("createAttributePreservingHook", () => {
  it("preserves specified attributes", () => {
    const hook = createAttributePreservingHook(["data-custom", "data-id"]);

    const fromEl = document.createElement("div");
    fromEl.setAttribute("data-custom", "value1");
    fromEl.setAttribute("data-id", "123");

    const toEl = document.createElement("div");

    hook(fromEl, toEl);

    expect(toEl.getAttribute("data-custom")).toBe("value1");
    expect(toEl.getAttribute("data-id")).toBe("123");
  });

  it("does not fail for missing attributes", () => {
    const hook = createAttributePreservingHook(["data-missing"]);

    const fromEl = document.createElement("div");
    const toEl = document.createElement("div");

    expect(() => hook(fromEl, toEl)).not.toThrow();
  });
});

describe("combineBeforeElUpdatedHooks", () => {
  it("combines multiple hooks", () => {
    const hook1 = vi.fn().mockReturnValue(true);
    const hook2 = vi.fn().mockReturnValue(true);

    const combined = combineBeforeElUpdatedHooks(hook1, hook2);

    const fromEl = document.createElement("div");
    const toEl = document.createElement("div");

    const result = combined(fromEl, toEl);

    expect(hook1).toHaveBeenCalled();
    expect(hook2).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("short-circuits on false", () => {
    const hook1 = vi.fn().mockReturnValue(false);
    const hook2 = vi.fn().mockReturnValue(true);

    const combined = combineBeforeElUpdatedHooks(hook1, hook2);

    const fromEl = document.createElement("div");
    const toEl = document.createElement("div");

    const result = combined(fromEl, toEl);

    expect(hook1).toHaveBeenCalled();
    expect(hook2).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});

describe("morphdom export", () => {
  it("exports morphdom directly", () => {
    expect(typeof morphdom).toBe("function");
  });
});

describe("verification: morphdom imported and configured with onBeforeElUpdated hook", () => {
  it("morphdom is imported and functional", () => {
    const container = document.createElement("div");
    container.innerHTML = "<div><p>Test</p></div>";
    document.body.appendChild(container);

    const target = container.firstElementChild!;

    // Direct morphdom usage
    morphdom(target, "<div><p>Updated</p></div>");

    expect(container.textContent).toContain("Updated");

    document.body.removeChild(container);
  });

  it("onBeforeElUpdated hook is configured and called", () => {
    const hook = vi.fn().mockReturnValue(true);
    const integration = createMorphdom({
      onBeforeElUpdated: hook,
    });

    const container = document.createElement("div");
    container.innerHTML = "<div><p>Before</p></div>";
    document.body.appendChild(container);

    const target = container.firstElementChild!;
    integration.morph(target, "<div><p>After</p></div>");

    expect(hook).toHaveBeenCalled();
    expect(hook).toHaveBeenCalledWith(
      expect.any(Element),
      expect.any(Element)
    );

    document.body.removeChild(container);
  });

  it("default onBeforeElUpdated hook preserves focus", () => {
    const integration = createMorphdom({
      preserveFocus: true,
    });

    const container = document.createElement("div");
    container.innerHTML = '<div><input type="text" value="test" /></div>';
    document.body.appendChild(container);

    const input = container.querySelector("input")!;
    input.focus();
    input.value = "user typed this";

    const target = container.firstElementChild!;
    integration.morph(target, '<div><input type="text" value="original" /></div>');

    // Focus should be preserved, so the input should keep user's value
    const updatedInput = container.querySelector("input")!;
    expect(updatedInput.value).toBe("user typed this");

    document.body.removeChild(container);
  });
});

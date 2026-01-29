import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateHMRRuntimeScript,
  HMR_RUNTIME_SCRIPT,
  HMRRuntimeController,
  createHMRRuntime,
  createHMRRuntimeScript,
  type HMRRuntimeConfig,
  type PlatxaHMRRuntime,
} from "@/lib/preview/hmr-runtime";

describe("generateHMRRuntimeScript", () => {
  it("generates script with default config", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("<script>");
    expect(script).toContain("</script>");
    expect(script).toContain("__PLATXA_HMR__");
  });

  it("includes injectCss function", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("function injectCss");
    expect(script).toContain("injectCss: injectCss");
  });

  it("includes updateSnippet function", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("function updateSnippet");
    expect(script).toContain("updateSnippet: updateSnippet");
  });

  it("includes enableSelectMode function", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("function enableSelectMode");
    expect(script).toContain("enableSelectMode: enableSelectMode");
  });

  it("includes disableSelectMode function", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("function disableSelectMode");
    expect(script).toContain("disableSelectMode: disableSelectMode");
  });

  it("includes toggleSelectMode function", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("function toggleSelectMode");
    expect(script).toContain("toggleSelectMode: toggleSelectMode");
  });

  it("includes isSelectModeEnabled function", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("function isSelectModeEnabled");
    expect(script).toContain("isSelectModeEnabled: isSelectModeEnabled");
  });

  it("exposes version and ready properties", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("version: '1.0.0'");
    expect(script).toContain("ready: true");
  });

  it("posts ready message on initialization", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("platxa:hmr-ready");
    expect(script).toContain("postMessage");
  });

  describe("configuration", () => {
    it("accepts debug config", () => {
      const script = generateHMRRuntimeScript({ debug: true });
      expect(script).toContain("debug: true");

      const scriptNoDebug = generateHMRRuntimeScript({ debug: false });
      expect(scriptNoDebug).toContain("debug: false");
    });

    it("accepts useMorphdom config", () => {
      const script = generateHMRRuntimeScript({ useMorphdom: false });
      expect(script).toContain("useMorphdom: false");
    });

    it("accepts styleIdPrefix config", () => {
      const script = generateHMRRuntimeScript({ styleIdPrefix: "custom-style" });
      expect(script).toContain("styleIdPrefix: 'custom-style'");
    });

    it("accepts selectHighlightColor config", () => {
      const script = generateHMRRuntimeScript({ selectHighlightColor: "#ff0000" });
      expect(script).toContain("selectHighlightColor: '#ff0000'");
    });

    it("accepts selectedColor config", () => {
      const script = generateHMRRuntimeScript({ selectedColor: "#00ff00" });
      expect(script).toContain("selectedColor: '#00ff00'");
    });
  });

  describe("CSS injection", () => {
    it("creates style elements", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("document.createElement('style')");
      expect(script).toContain("document.head.appendChild");
    });

    it("updates existing style elements", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("document.getElementById(styleId)");
      expect(script).toContain(".textContent = css");
    });

    it("posts css-injected message", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-css-injected");
    });
  });

  describe("snippet updates", () => {
    it("queries snippets by data-snippet-id", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain('[data-snippet-id="');
      expect(script).toContain("document.querySelector(selector)");
    });

    it("supports morphdom for diffing", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("typeof morphdom");
      expect(script).toContain("morphdom(element, newElement");
    });

    it("falls back to outerHTML", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("element.outerHTML = html");
    });

    it("posts snippet-updated message", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-snippet-updated");
    });

    it("posts error message on failure", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-error");
    });
  });

  describe("select mode", () => {
    it("injects select mode styles", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa-select-mode-styles");
      expect(script).toContain("cursor: crosshair");
    });

    it("adds/removes body class for select mode", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("document.body.classList.add('platxa-select-mode')");
      expect(script).toContain("document.body.classList.remove('platxa-select-mode')");
    });

    it("handles hover highlighting", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa-select-hover");
      expect(script).toContain("handleMouseMove");
    });

    it("handles click selection", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa-select-selected");
      expect(script).toContain("handleClick");
    });

    it("handles escape key to disable", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("e.key === 'Escape'");
      expect(script).toContain("handleKeyDown");
    });

    it("posts element-selected message", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-element-selected");
    });

    it("posts element-hovered message", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-element-hovered");
    });

    it("posts select-mode-changed message", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-select-mode-changed");
    });
  });

  describe("message handling", () => {
    it("listens for inject-css messages", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-inject-css");
    });

    it("listens for update-snippet messages", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-update-snippet");
    });

    it("listens for enable-select messages", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-enable-select");
    });

    it("listens for disable-select messages", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-disable-select");
    });

    it("listens for toggle-select messages", () => {
      const script = generateHMRRuntimeScript();

      expect(script).toContain("platxa:hmr-toggle-select");
    });
  });
});

describe("HMR_RUNTIME_SCRIPT", () => {
  it("is a pre-generated script with defaults", () => {
    expect(HMR_RUNTIME_SCRIPT).toContain("<script>");
    expect(HMR_RUNTIME_SCRIPT).toContain("__PLATXA_HMR__");
    expect(HMR_RUNTIME_SCRIPT).toContain("debug: false");
  });
});

describe("HMRRuntimeController", () => {
  let controller: HMRRuntimeController;

  beforeEach(() => {
    controller = new HMRRuntimeController();
  });

  describe("connection", () => {
    it("starts not ready", () => {
      expect(controller.isReady()).toBe(false);
    });

    it("connects to iframe", () => {
      const iframe = document.createElement("iframe");
      controller.connect(iframe);
      // No error thrown
    });

    it("disconnects from iframe", () => {
      const iframe = document.createElement("iframe");
      controller.connect(iframe);
      controller.disconnect();
      expect(controller.isReady()).toBe(false);
    });
  });

  describe("methods", () => {
    it("has injectCss method", () => {
      expect(typeof controller.injectCss).toBe("function");
    });

    it("has updateSnippet method", () => {
      expect(typeof controller.updateSnippet).toBe("function");
    });

    it("has enableSelectMode method", () => {
      expect(typeof controller.enableSelectMode).toBe("function");
    });

    it("has disableSelectMode method", () => {
      expect(typeof controller.disableSelectMode).toBe("function");
    });

    it("has toggleSelectMode method", () => {
      expect(typeof controller.toggleSelectMode).toBe("function");
    });
  });

  describe("event subscription", () => {
    it("allows subscribing to messages", () => {
      const callback = vi.fn();
      const unsubscribe = controller.on("platxa:hmr-ready", callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("allows unsubscribing from messages", () => {
      const callback = vi.fn();
      const unsubscribe = controller.on("platxa:hmr-ready", callback);
      unsubscribe();
      // No error thrown
    });
  });

  describe("waitForReady", () => {
    it("resolves immediately if already ready", async () => {
      // Simulate ready state by triggering the message
      const iframe = document.createElement("iframe");
      controller.connect(iframe);

      // Manually trigger ready
      const event = new MessageEvent("message", {
        data: { type: "platxa:hmr-ready", payload: { version: "1.0.0" } },
      });
      window.dispatchEvent(event);

      await expect(controller.waitForReady(100)).resolves.toBeUndefined();
    });

    it("rejects on timeout if not ready", async () => {
      await expect(controller.waitForReady(50)).rejects.toThrow(
        "HMR runtime did not become ready within timeout"
      );
    });
  });
});

describe("createHMRRuntime", () => {
  it("creates a controller", () => {
    const controller = createHMRRuntime();
    expect(controller).toBeInstanceOf(HMRRuntimeController);
  });
});

describe("createHMRRuntimeScript", () => {
  it("creates script with default config", () => {
    const script = createHMRRuntimeScript();
    expect(script).toContain("__PLATXA_HMR__");
  });

  it("creates script with custom config", () => {
    const script = createHMRRuntimeScript({ debug: true });
    expect(script).toContain("debug: true");
  });
});

describe("verification: __PLATXA_HMR__ global with injectCss, updateSnippet, enableSelectMode", () => {
  it("script exposes __PLATXA_HMR__ global", () => {
    const script = generateHMRRuntimeScript();

    expect(script).toContain("window.__PLATXA_HMR__");
  });

  it("__PLATXA_HMR__ has injectCss method", () => {
    const script = generateHMRRuntimeScript();

    // Verify the global object includes injectCss
    expect(script).toMatch(/window\.__PLATXA_HMR__\s*=\s*\{[\s\S]*injectCss:/);
  });

  it("__PLATXA_HMR__ has updateSnippet method", () => {
    const script = generateHMRRuntimeScript();

    // Verify the global object includes updateSnippet
    expect(script).toMatch(/window\.__PLATXA_HMR__\s*=\s*\{[\s\S]*updateSnippet:/);
  });

  it("__PLATXA_HMR__ has enableSelectMode method", () => {
    const script = generateHMRRuntimeScript();

    // Verify the global object includes enableSelectMode
    expect(script).toMatch(/window\.__PLATXA_HMR__\s*=\s*\{[\s\S]*enableSelectMode:/);
  });

  it("all required methods are exposed in the global object", () => {
    const script = generateHMRRuntimeScript();

    // Extract the __PLATXA_HMR__ object definition
    const globalDef = script.match(/window\.__PLATXA_HMR__\s*=\s*\{([^}]+)\}/);
    expect(globalDef).not.toBeNull();

    const objectBody = globalDef![1];

    // Verify all required methods
    expect(objectBody).toContain("injectCss:");
    expect(objectBody).toContain("updateSnippet:");
    expect(objectBody).toContain("enableSelectMode:");
    expect(objectBody).toContain("disableSelectMode:");
    expect(objectBody).toContain("toggleSelectMode:");
    expect(objectBody).toContain("isSelectModeEnabled:");
    expect(objectBody).toContain("version:");
    expect(objectBody).toContain("ready:");
  });
});

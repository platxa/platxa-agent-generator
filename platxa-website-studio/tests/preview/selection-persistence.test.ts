/**
 * Tests for SelectionPersistence
 *
 * Feature #77: Add selection persistence across HMR updates
 * Verification: Selection restored by ID after DOM morph
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SelectionPersistence,
  createSelectionPersistence,
  createMorphdomSelectionHooks,
  type SelectionIdentifier,
  type RestoreResult,
} from "@/lib/preview/selection-persistence";
import { SelectModeController } from "@/lib/preview/select-mode";

// =============================================================================
// Mock Setup
// =============================================================================

function createMockIframe(): HTMLIFrameElement {
  const postMessage = vi.fn();
  return {
    contentWindow: {
      postMessage,
    },
  } as unknown as HTMLIFrameElement;
}

function createMockSelectedElement(snippetId: string, elementId?: string) {
  return {
    snippetId,
    elementId: elementId ?? null,
    tagName: "section",
    classes: ["s_hero"],
    bounds: { top: 0, left: 0, width: 800, height: 400 } as DOMRect,
    selector: `[data-snippet-id="${snippetId}"]`,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe("SelectionPersistence", () => {
  let selectController: SelectModeController;
  let persistence: SelectionPersistence;
  let iframe: HTMLIFrameElement;

  beforeEach(() => {
    vi.useFakeTimers();
    selectController = new SelectModeController();
    selectController.enable();
    persistence = new SelectionPersistence(selectController, {
      restoreTimeout: 50,
      maxAge: 5000,
    });
    iframe = createMockIframe();
  });

  afterEach(() => {
    persistence.dispose();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Feature #77: Selection restored by ID after DOM morph
  // ---------------------------------------------------------------------------

  describe("Feature #77: Selection persistence across HMR updates", () => {
    it("saves selection before HMR update", () => {
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);

      const saved = persistence.save();

      expect(saved).not.toBeNull();
      expect(saved?.snippetId).toBe("s_hero");
      expect(saved?.selector).toBe('[data-snippet-id="s_hero"]');
    });

    it("restores selection by snippetId after morph", async () => {
      persistence.connect(iframe);

      const element = createMockSelectedElement("s_hero");
      selectController.select(element);

      // Save selection
      persistence.save();

      // Clear selection (simulating morph clearing DOM)
      selectController.clearSelection();
      expect(selectController.getSelected()).toBeNull();

      // Setup mock response for restore
      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockImplementation((msg) => {
        if (msg.type === "platxa:selection-restore-find") {
          // Simulate iframe finding the element
          setTimeout(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  type: "platxa:selection-restore-result",
                  element: createMockSelectedElement("s_hero"),
                },
              })
            );
          }, 10);
        }
      });

      // Start restore
      const restorePromise = persistence.restore();

      // Advance past restore timeout
      await vi.advanceTimersByTimeAsync(50);
      // Advance for mock response
      await vi.advanceTimersByTimeAsync(20);

      const result = await restorePromise;

      expect(result.success).toBe(true);
      expect(result.method).toBe("snippetId");
      expect(selectController.getSelected()?.snippetId).toBe("s_hero");
    });

    it("restores selection by elementId when snippetId is null", async () => {
      persistence.connect(iframe);

      // Create element with ONLY elementId (no snippetId)
      const element = {
        snippetId: null,
        elementId: "el-42",
        tagName: "section",
        classes: ["s_feature"],
        bounds: { top: 0, left: 0, width: 800, height: 400 } as DOMRect,
        selector: '[data-element-id="el-42"]',
      };
      selectController.select(element);

      persistence.save();
      selectController.clearSelection();

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockImplementation((msg) => {
        if (msg.type === "platxa:selection-restore-find") {
          // Since snippetId is null, implementation skips to elementId
          // This IS the first and only call - for elementId
          expect(msg.idType).toBe("elementId");
          expect(msg.id).toBe("el-42");

          setTimeout(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  type: "platxa:selection-restore-result",
                  element: { ...element },
                },
              })
            );
          }, 10);
        }
      });

      const restorePromise = persistence.restore();
      await vi.advanceTimersByTimeAsync(100);

      const result = await restorePromise;

      expect(result.success).toBe(true);
      expect(result.method).toBe("elementId");
    });

    it("tracks restore success count", async () => {
      persistence.connect(iframe);

      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();
      selectController.clearSelection();

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockImplementation((msg) => {
        if (msg.type === "platxa:selection-restore-find") {
          setTimeout(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  type: "platxa:selection-restore-result",
                  element: createMockSelectedElement("s_hero"),
                },
              })
            );
          }, 10);
        }
      });

      expect(persistence.getState().restoreCount).toBe(0);

      const restorePromise = persistence.restore();
      await vi.advanceTimersByTimeAsync(100);
      await restorePromise;

      expect(persistence.getState().restoreCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  describe("connection management", () => {
    it("connects to iframe", () => {
      expect(persistence.isConnected()).toBe(false);
      persistence.connect(iframe);
      expect(persistence.isConnected()).toBe(true);
    });

    it("disconnects from iframe", () => {
      persistence.connect(iframe);
      persistence.disconnect();
      expect(persistence.isConnected()).toBe(false);
    });

    it("throws when connecting after dispose", () => {
      persistence.dispose();
      expect(() => persistence.connect(iframe)).toThrow("disposed");
    });
  });

  // ---------------------------------------------------------------------------
  // Save Selection
  // ---------------------------------------------------------------------------

  describe("save selection", () => {
    it("saves selection with all identifiers", () => {
      const element = createMockSelectedElement("s_hero", "el-1");
      selectController.select(element);

      const saved = persistence.save();

      expect(saved).toMatchObject({
        snippetId: "s_hero",
        elementId: "el-1",
        tagName: "section",
        selector: '[data-snippet-id="s_hero"]',
      });
      expect(saved?.savedAt).toBeDefined();
    });

    it("returns null when no selection", () => {
      const saved = persistence.save();
      expect(saved).toBeNull();
    });

    it("returns null when disabled", () => {
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.disable();

      const saved = persistence.save();
      expect(saved).toBeNull();
    });

    it("getSaved returns current saved selection", () => {
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();

      const saved = persistence.getSaved();
      expect(saved?.snippetId).toBe("s_hero");
    });

    it("clearSaved removes saved selection", () => {
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();

      persistence.clearSaved();

      expect(persistence.getSaved()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Restore Selection
  // ---------------------------------------------------------------------------

  describe("restore selection", () => {
    it("fails when no saved selection", async () => {
      persistence.connect(iframe);

      const result = await persistence.restore();

      expect(result.success).toBe(false);
      expect(result.method).toBe("none");
      expect(result.error).toContain("No saved selection");
    });

    it("fails when disabled", async () => {
      persistence.connect(iframe);
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();
      persistence.disable();

      const result = await persistence.restore();

      expect(result.success).toBe(false);
    });

    it("fails when saved selection is too old", async () => {
      persistence.connect(iframe);
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();

      // Advance time beyond maxAge
      vi.advanceTimersByTime(6000);

      const result = await persistence.restore();

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("increments fail count on restore failure", async () => {
      persistence.connect(iframe);
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();
      selectController.clearSelection();

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockImplementation((msg) => {
        if (msg.type === "platxa:selection-restore-find") {
          setTimeout(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  type: "platxa:selection-restore-result",
                  element: null, // Not found
                },
              })
            );
          }, 10);
        }
      });

      expect(persistence.getState().failCount).toBe(0);

      const restorePromise = persistence.restore();
      await vi.advanceTimersByTimeAsync(100);
      await restorePromise;

      expect(persistence.getState().failCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  describe("state management", () => {
    it("enables and disables correctly", () => {
      expect(persistence.isEnabled()).toBe(true);

      persistence.disable();
      expect(persistence.isEnabled()).toBe(false);

      persistence.enable();
      expect(persistence.isEnabled()).toBe(true);
    });

    it("toggle switches enabled state", () => {
      expect(persistence.toggle()).toBe(false);
      expect(persistence.toggle()).toBe(true);
    });

    it("disable clears saved selection", () => {
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();

      persistence.disable();

      expect(persistence.getSaved()).toBeNull();
    });

    it("getState returns current state", () => {
      const state = persistence.getState();

      expect(state).toMatchObject({
        enabled: true,
        savedSelection: null,
        restorePending: false,
        restoreCount: 0,
        failCount: 0,
      });
    });

    it("resetStats clears counters", async () => {
      persistence.connect(iframe);
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockImplementation((msg) => {
        if (msg.type === "platxa:selection-restore-find") {
          setTimeout(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  type: "platxa:selection-restore-result",
                  element: createMockSelectedElement("s_hero"),
                },
              })
            );
          }, 10);
        }
      });

      const restorePromise = persistence.restore();
      await vi.advanceTimersByTimeAsync(100);
      await restorePromise;

      expect(persistence.getState().restoreCount).toBe(1);

      persistence.resetStats();

      expect(persistence.getState().restoreCount).toBe(0);
      expect(persistence.getState().failCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  describe("restore events", () => {
    it("emits restore event on successful restore", async () => {
      const callback = vi.fn();
      persistence.onRestore(callback);
      persistence.connect(iframe);

      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();
      selectController.clearSelection();

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockImplementation((msg) => {
        if (msg.type === "platxa:selection-restore-find") {
          setTimeout(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  type: "platxa:selection-restore-result",
                  element: createMockSelectedElement("s_hero"),
                },
              })
            );
          }, 10);
        }
      });

      const restorePromise = persistence.restore();
      await vi.advanceTimersByTimeAsync(100);
      await restorePromise;

      expect(callback).toHaveBeenCalled();
      const result: RestoreResult = callback.mock.calls[0][0];
      expect(result.success).toBe(true);
    });

    it("onRestore returns unsubscribe function", async () => {
      const callback = vi.fn();
      const unsubscribe = persistence.onRestore(callback);

      unsubscribe();

      persistence.connect(iframe);
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockImplementation((msg) => {
        if (msg.type === "platxa:selection-restore-find") {
          setTimeout(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  type: "platxa:selection-restore-result",
                  element: createMockSelectedElement("s_hero"),
                },
              })
            );
          }, 10);
        }
      });

      const restorePromise = persistence.restore();
      await vi.advanceTimersByTimeAsync(100);
      await restorePromise;

      expect(callback).not.toHaveBeenCalled();
    });

    it("handles callback errors gracefully", async () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCallback = vi.fn();

      persistence.onRestore(errorCallback);
      persistence.onRestore(normalCallback);
      persistence.connect(iframe);

      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockImplementation((msg) => {
        if (msg.type === "platxa:selection-restore-find") {
          setTimeout(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  type: "platxa:selection-restore-result",
                  element: createMockSelectedElement("s_hero"),
                },
              })
            );
          }, 10);
        }
      });

      const restorePromise = persistence.restore();
      await vi.advanceTimersByTimeAsync(100);

      // Should not throw
      await expect(restorePromise).resolves.toBeDefined();

      expect(normalCallback).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-Save/Restore on Morph Events
  // ---------------------------------------------------------------------------

  describe("auto-save/restore on morph events", () => {
    it("auto-saves on morph-before event", () => {
      persistence.connect(iframe);

      const element = createMockSelectedElement("s_hero");
      selectController.select(element);

      // Simulate morph-before event from iframe
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "platxa:morph-before" },
        })
      );

      expect(persistence.getSaved()?.snippetId).toBe("s_hero");
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe("cleanup", () => {
    it("dispose clears resources", () => {
      persistence.connect(iframe);
      const element = createMockSelectedElement("s_hero");
      selectController.select(element);
      persistence.save();

      persistence.dispose();

      expect(persistence.getSaved()).toBeNull();
      expect(persistence.isConnected()).toBe(false);
    });

    it("dispose can be called multiple times", () => {
      expect(() => {
        persistence.dispose();
        persistence.dispose();
      }).not.toThrow();
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe("createSelectionPersistence", () => {
  it("creates persistence with select controller", () => {
    const selectController = new SelectModeController();
    const persistence = createSelectionPersistence(selectController);

    expect(persistence).toBeInstanceOf(SelectionPersistence);
    expect(persistence.isEnabled()).toBe(true);

    persistence.dispose();
  });

  it("accepts custom options", () => {
    const selectController = new SelectModeController();
    const persistence = createSelectionPersistence(selectController, {
      restoreTimeout: 200,
      flashOnRestore: false,
    });

    expect(persistence.isEnabled()).toBe(true);

    persistence.dispose();
  });
});

describe("createMorphdomSelectionHooks", () => {
  it("creates hooks for morphdom integration", () => {
    const selectController = new SelectModeController();
    const persistence = createSelectionPersistence(selectController);
    const hooks = createMorphdomSelectionHooks(persistence);

    expect(hooks.onBeforeMorph).toBeInstanceOf(Function);
    expect(hooks.onAfterMorph).toBeInstanceOf(Function);

    persistence.dispose();
  });

  it("onBeforeMorph saves selection", () => {
    const selectController = new SelectModeController();
    selectController.enable();
    selectController.select(createMockSelectedElement("s_hero"));

    const persistence = createSelectionPersistence(selectController);
    const hooks = createMorphdomSelectionHooks(persistence);

    hooks.onBeforeMorph();

    expect(persistence.getSaved()?.snippetId).toBe("s_hero");

    persistence.dispose();
  });
});

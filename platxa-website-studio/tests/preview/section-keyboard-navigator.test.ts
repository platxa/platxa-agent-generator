/**
 * Tests for SectionKeyboardNavigator
 *
 * Feature #76: Implement keyboard navigation between sections (arrow keys)
 * Verification: Up/down arrows move selection between sibling sections
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SectionKeyboardNavigator,
  createSectionNavigator,
  type NavigationDirection,
  type NavigationEvent,
} from "@/lib/preview/section-keyboard-navigator";
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

function createMockSelectedElement(id: string, index: number) {
  return {
    snippetId: id,
    elementId: null,
    tagName: "section",
    classes: [`s_section_${index}`],
    bounds: { top: index * 100, left: 0, width: 800, height: 100 } as DOMRect,
    selector: `[data-snippet-id="${id}"]`,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe("SectionKeyboardNavigator", () => {
  let selectController: SelectModeController;
  let navigator: SectionKeyboardNavigator;
  let iframe: HTMLIFrameElement;

  beforeEach(() => {
    selectController = new SelectModeController();
    selectController.enable();
    navigator = new SectionKeyboardNavigator(selectController, {
      wrapAround: false,
    });
    iframe = createMockIframe();
  });

  afterEach(() => {
    navigator.dispose();
  });

  // ---------------------------------------------------------------------------
  // Feature #76: Up/down arrows move selection between sibling sections
  // ---------------------------------------------------------------------------

  describe("Feature #76: Arrow key navigation between sections", () => {
    it("sends navigation command on arrow down", () => {
      navigator.connect(iframe);

      // Simulate section list from iframe
      const sectionListEvent = new MessageEvent("message", {
        data: {
          type: "platxa:section-list",
          sections: ["s_hero", "s_features", "s_contact"],
          currentIndex: 0,
        },
      });
      window.dispatchEvent(sectionListEvent);

      // Select first section
      selectController.select(createMockSelectedElement("s_hero", 0));

      // Navigate down
      navigator.navigate("down");

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:section-navigate",
          index: 1,
          direction: "down",
          sectionId: "s_features",
        }),
        "*"
      );
    });

    it("sends navigation command on arrow up", () => {
      navigator.connect(iframe);

      // Simulate section list
      const sectionListEvent = new MessageEvent("message", {
        data: {
          type: "platxa:section-list",
          sections: ["s_hero", "s_features", "s_contact"],
          currentIndex: 1,
        },
      });
      window.dispatchEvent(sectionListEvent);

      // Select middle section
      selectController.select(createMockSelectedElement("s_features", 1));

      // Navigate up
      navigator.navigate("up");

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:section-navigate",
          index: 0,
          direction: "up",
          sectionId: "s_hero",
        }),
        "*"
      );
    });

    it("handles keyboard events for navigation", () => {
      navigator.connect(iframe);

      // Setup section list
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_hero", "s_features"],
            currentIndex: 0,
          },
        })
      );

      selectController.select(createMockSelectedElement("s_hero", 0));

      // Simulate arrow down keypress
      const keyEvent = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
      });
      window.dispatchEvent(keyEvent);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      // Should have called postMessage for navigation
      const navCalls = postMessage.mock.calls.filter(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCalls.length).toBeGreaterThan(0);
    });

    it("updates selection after navigation response", () => {
      navigator.connect(iframe);

      // Setup
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_hero", "s_features"],
          },
        })
      );

      selectController.select(createMockSelectedElement("s_hero", 0));

      // Simulate navigation response from iframe
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-navigated",
            direction: "down",
            from: createMockSelectedElement("s_hero", 0),
            to: createMockSelectedElement("s_features", 1),
            index: 1,
          },
        })
      );

      // Selection should be updated
      const selected = selectController.getSelected();
      expect(selected?.snippetId).toBe("s_features");
    });
  });

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  describe("connection management", () => {
    it("connects to iframe", () => {
      expect(navigator.isConnected()).toBe(false);
      navigator.connect(iframe);
      expect(navigator.isConnected()).toBe(true);
    });

    it("requests section list on connect", () => {
      navigator.connect(iframe);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:section-list-request",
        }),
        "*"
      );
    });

    it("disconnects from iframe", () => {
      navigator.connect(iframe);
      navigator.disconnect();
      expect(navigator.isConnected()).toBe(false);
    });

    it("throws when connecting after dispose", () => {
      navigator.dispose();
      expect(() => navigator.connect(iframe)).toThrow("disposed");
    });
  });

  // ---------------------------------------------------------------------------
  // Navigation Directions
  // ---------------------------------------------------------------------------

  describe("navigation directions", () => {
    beforeEach(() => {
      navigator.connect(iframe);
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2", "s_3", "s_4"],
          },
        })
      );
      selectController.select(createMockSelectedElement("s_2", 1));
    });

    it("navigates to first section", () => {
      navigator.navigate("first");

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      const navCall = postMessage.mock.calls.find(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCall?.[0].index).toBe(0);
    });

    it("navigates to last section", () => {
      navigator.navigate("last");

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      const navCall = postMessage.mock.calls.find(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCall?.[0].index).toBe(3);
    });

    it("navigateToIndex goes to specific index", () => {
      navigator.navigateToIndex(2);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      const navCall = postMessage.mock.calls.find(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCall?.[0].index).toBe(2);
    });

    it("navigateToId finds section by ID", () => {
      navigator.navigateToId("s_3");

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      const navCall = postMessage.mock.calls.find(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCall?.[0].index).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Wrap Around Behavior
  // ---------------------------------------------------------------------------

  describe("wrap around", () => {
    it("does not wrap when wrapAround is false", () => {
      navigator.connect(iframe);
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2"],
          },
        })
      );

      // Select first section
      selectController.select(createMockSelectedElement("s_1", 0));

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockClear();

      // Try to navigate up (at boundary)
      navigator.navigate("up");

      // Should not navigate since at boundary and not wrapping
      const navCalls = postMessage.mock.calls.filter(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCalls.length).toBe(0);
    });

    it("wraps around when wrapAround is true", () => {
      const wrapNavigator = new SectionKeyboardNavigator(selectController, {
        wrapAround: true,
      });
      wrapNavigator.connect(iframe);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2", "s_3"],
          },
        })
      );

      // Select first section
      selectController.select(createMockSelectedElement("s_1", 0));

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockClear();

      // Navigate up (should wrap to last)
      wrapNavigator.navigate("up");

      const navCall = postMessage.mock.calls.find(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCall?.[0].index).toBe(2); // Last index

      wrapNavigator.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  describe("state management", () => {
    it("enables and disables correctly", () => {
      expect(navigator.isEnabled()).toBe(true);

      navigator.disable();
      expect(navigator.isEnabled()).toBe(false);

      navigator.enable();
      expect(navigator.isEnabled()).toBe(true);
    });

    it("toggle switches enabled state", () => {
      expect(navigator.toggle()).toBe(false);
      expect(navigator.toggle()).toBe(true);
    });

    it("getState returns current state", () => {
      navigator.connect(iframe);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2"],
            currentIndex: 0,
          },
        })
      );

      const state = navigator.getState();
      expect(state.enabled).toBe(true);
      expect(state.totalSections).toBe(2);
      expect(state.sectionIds).toEqual(["s_1", "s_2"]);
    });

    it("does not navigate when disabled", () => {
      navigator.connect(iframe);
      navigator.disable();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2"],
          },
        })
      );

      selectController.select(createMockSelectedElement("s_1", 0));

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockClear();

      navigator.navigate("down");

      const navCalls = postMessage.mock.calls.filter(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCalls.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  describe("navigation events", () => {
    it("emits navigation event on successful navigation", () => {
      const callback = vi.fn();
      navigator.onNavigation(callback);
      navigator.connect(iframe);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2"],
          },
        })
      );

      // Simulate navigation response
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-navigated",
            direction: "down",
            from: createMockSelectedElement("s_1", 0),
            to: createMockSelectedElement("s_2", 1),
            index: 1,
          },
        })
      );

      expect(callback).toHaveBeenCalled();
      const event: NavigationEvent = callback.mock.calls[0][0];
      expect(event.direction).toBe("down");
      expect(event.to?.snippetId).toBe("s_2");
      expect(event.index).toBe(1);
    });

    it("onNavigation returns unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = navigator.onNavigation(callback);

      unsubscribe();

      navigator.connect(iframe);
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-navigated",
            direction: "down",
            from: null,
            to: createMockSelectedElement("s_1", 0),
            index: 0,
          },
        })
      );

      expect(callback).not.toHaveBeenCalled();
    });

    it("handles callback errors gracefully", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCallback = vi.fn();

      navigator.onNavigation(errorCallback);
      navigator.onNavigation(normalCallback);
      navigator.connect(iframe);

      // Should not throw
      expect(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "platxa:section-navigated",
              direction: "down",
              from: null,
              to: createMockSelectedElement("s_1", 0),
              index: 0,
            },
          })
        );
      }).not.toThrow();

      expect(normalCallback).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Keyboard Event Handling
  // ---------------------------------------------------------------------------

  describe("keyboard event handling", () => {
    it("ignores keyboard events when select mode is disabled", () => {
      navigator.connect(iframe);
      selectController.disable();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2"],
          },
        })
      );

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockClear();

      const keyEvent = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
      });
      window.dispatchEvent(keyEvent);

      const navCalls = postMessage.mock.calls.filter(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCalls.length).toBe(0);
    });

    it("ignores keyboard events without selection", () => {
      navigator.connect(iframe);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2"],
          },
        })
      );

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockClear();

      // No selection made
      const keyEvent = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
      });
      window.dispatchEvent(keyEvent);

      const navCalls = postMessage.mock.calls.filter(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCalls.length).toBe(0);
    });

    it("supports Home key for first section", () => {
      navigator.connect(iframe);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2", "s_3"],
          },
        })
      );

      selectController.select(createMockSelectedElement("s_2", 1));

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockClear();

      const keyEvent = new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
      });
      window.dispatchEvent(keyEvent);

      const navCall = postMessage.mock.calls.find(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCall?.[0].index).toBe(0);
    });

    it("supports End key for last section", () => {
      navigator.connect(iframe);

      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "platxa:section-list",
            sections: ["s_1", "s_2", "s_3"],
          },
        })
      );

      selectController.select(createMockSelectedElement("s_1", 0));

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockClear();

      const keyEvent = new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
      });
      window.dispatchEvent(keyEvent);

      const navCall = postMessage.mock.calls.find(
        (call) => call[0]?.type === "platxa:section-navigate"
      );
      expect(navCall?.[0].index).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------

  describe("refresh", () => {
    it("refresh requests updated section list", () => {
      navigator.connect(iframe);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockClear();

      navigator.refresh();

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:section-list-request",
        }),
        "*"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe("cleanup", () => {
    it("dispose cleans up listeners", () => {
      navigator.connect(iframe);
      navigator.dispose();

      // Shouldn't throw when events fire
      expect(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "platxa:section-list", sections: [] },
          })
        );
      }).not.toThrow();
    });

    it("dispose can be called multiple times", () => {
      expect(() => {
        navigator.dispose();
        navigator.dispose();
      }).not.toThrow();
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe("createSectionNavigator", () => {
  it("creates a navigator with select controller", () => {
    const selectController = new SelectModeController();
    const navigator = createSectionNavigator(selectController);

    expect(navigator).toBeInstanceOf(SectionKeyboardNavigator);
    expect(navigator.isEnabled()).toBe(true);

    navigator.dispose();
  });

  it("accepts custom options", () => {
    const selectController = new SelectModeController();
    const navigator = createSectionNavigator(selectController, {
      wrapAround: true,
      enabled: false,
    });

    expect(navigator.isEnabled()).toBe(false);

    navigator.dispose();
  });
});

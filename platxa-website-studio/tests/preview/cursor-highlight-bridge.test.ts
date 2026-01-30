/**
 * Tests for CursorHighlightBridge
 *
 * Feature #71: Add preview highlight from editor cursor position
 * Verification: Cursor in snippet code highlights corresponding preview section
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CursorHighlightBridge,
  createCursorHighlightBridge,
  type CursorPosition,
  type CursorHighlightState,
} from "@/lib/preview/cursor-highlight-bridge";
import { SourceMapper } from "@/lib/preview/source-mapper";

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

function createSourceMapperWithData(): SourceMapper {
  const mapper = new SourceMapper();
  const template = `<section class="s_hero">
  <div class="container">
    <h1>Title</h1>
    <p>Description</p>
  </div>
</section>
<section class="s_features">
  <div class="row">
    <div class="col">Feature 1</div>
  </div>
</section>`;
  mapper.annotate(template, "hero.xml");
  return mapper;
}

// =============================================================================
// Test Suite
// =============================================================================

describe("CursorHighlightBridge", () => {
  let mapper: SourceMapper;
  let bridge: CursorHighlightBridge;
  let iframe: HTMLIFrameElement;

  beforeEach(() => {
    vi.useFakeTimers();
    mapper = createSourceMapperWithData();
    bridge = new CursorHighlightBridge(mapper, {
      filePath: "hero.xml",
      debounceMs: 50,
    });
    iframe = createMockIframe();
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Feature #71: Cursor in snippet code highlights corresponding preview section
  // ---------------------------------------------------------------------------

  describe("Feature #71: Cursor position to preview highlight", () => {
    it("highlights preview section when cursor is in snippet code", () => {
      bridge.connect(iframe);

      // Move cursor to line 1 (section.s_hero)
      bridge.updateCursor({ line: 1, column: 1 });
      vi.advanceTimersByTime(50);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      expect(postMessage).toHaveBeenCalled();

      const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({
        type: "platxa:highlight-element",
        scrollIntoView: true,
      });
      expect(lastCall[0].sourceId).toBeTruthy();
    });

    it("highlights different sections as cursor moves between snippets", () => {
      bridge.connect(iframe);

      // Move to first section (line 1)
      bridge.updateCursor({ line: 1, column: 1 });
      vi.advanceTimersByTime(50);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      const firstHighlight = postMessage.mock.calls[postMessage.mock.calls.length - 1][0].sourceId;

      // Move to second section (line 7)
      bridge.updateCursor({ line: 7, column: 1 });
      vi.advanceTimersByTime(50);

      const secondHighlight = postMessage.mock.calls[postMessage.mock.calls.length - 1][0].sourceId;

      // Different sections should have different element IDs
      expect(firstHighlight).not.toBe(secondHighlight);
    });

    it("tracks cursor position state correctly", () => {
      bridge.connect(iframe);

      bridge.updateCursor({ line: 3, column: 5 });
      vi.advanceTimersByTime(50);

      const state = bridge.getState();
      expect(state.lastPosition).toEqual({ line: 3, column: 5 });
      expect(state.currentFile).toBe("hero.xml");
    });

    it("finds elements spanning cursor line", () => {
      bridge.connect(iframe);

      // Line 3 is inside the first section (h1 element)
      bridge.updateCursor({ line: 3, column: 1 });
      vi.advanceTimersByTime(50);

      const state = bridge.getState();
      expect(state.highlightedIds.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  describe("connection management", () => {
    it("connects to iframe", () => {
      expect(bridge.isConnected()).toBe(false);
      bridge.connect(iframe);
      expect(bridge.isConnected()).toBe(true);
    });

    it("disconnects from iframe", () => {
      bridge.connect(iframe);
      bridge.disconnect();
      expect(bridge.isConnected()).toBe(false);
    });

    it("clears highlight on disconnect", () => {
      bridge.connect(iframe);
      bridge.updateCursor({ line: 1, column: 1 });
      vi.advanceTimersByTime(50);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      postMessage.mockClear();

      bridge.disconnect();

      // Should have sent a clear message before disconnecting
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:highlight-element",
          sourceId: null,
        }),
        "*"
      );
    });

    it("throws when connecting after dispose", () => {
      bridge.dispose();
      expect(() => bridge.connect(iframe)).toThrow("disposed");
    });
  });

  // ---------------------------------------------------------------------------
  // Cursor Update
  // ---------------------------------------------------------------------------

  describe("cursor update", () => {
    it("debounces rapid cursor movements", () => {
      bridge.connect(iframe);

      // Rapid cursor movements
      bridge.updateCursor({ line: 1, column: 1 });
      bridge.updateCursor({ line: 2, column: 1 });
      bridge.updateCursor({ line: 3, column: 1 });

      // No messages sent yet (debouncing)
      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      expect(postMessage).not.toHaveBeenCalled();

      // After debounce delay
      vi.advanceTimersByTime(50);

      // Only one message sent (last position)
      expect(postMessage).toHaveBeenCalledTimes(1);
    });

    it("updateCursorImmediate bypasses debounce", () => {
      bridge.connect(iframe);

      bridge.updateCursorImmediate({ line: 1, column: 1 });

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      expect(postMessage).toHaveBeenCalledTimes(1);
    });

    it("allows overriding file path per call", () => {
      bridge.connect(iframe);

      bridge.updateCursor({ line: 1, column: 1 }, "other.xml");
      vi.advanceTimersByTime(50);

      const state = bridge.getState();
      expect(state.currentFile).toBe("other.xml");
    });

    it("does not update when disabled", () => {
      bridge.connect(iframe);
      bridge.disable();

      bridge.updateCursor({ line: 1, column: 1 });
      vi.advanceTimersByTime(50);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      // Only the clear message from disable()
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ sourceId: null }),
        "*"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Element Lookup
  // ---------------------------------------------------------------------------

  describe("element lookup", () => {
    it("getElementsAtLine returns elements at cursor line", () => {
      const elements = bridge.getElementsAtLine(1, "hero.xml");
      expect(elements.length).toBeGreaterThan(0);
    });

    it("getElementsAtLine returns empty array for unmapped lines", () => {
      const elements = bridge.getElementsAtLine(100, "hero.xml");
      expect(elements).toEqual([]);
    });

    it("getElementsAtLine returns empty for unknown file", () => {
      const elements = bridge.getElementsAtLine(1, "unknown.xml");
      expect(elements).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Highlight Control
  // ---------------------------------------------------------------------------

  describe("highlight control", () => {
    it("clearHighlight sends null sourceId", () => {
      bridge.connect(iframe);
      bridge.clearHighlight();

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "platxa:highlight-element",
          sourceId: null,
          scrollIntoView: false,
        }),
        "*"
      );
    });

    it("highlightElements manually highlights specific elements", () => {
      bridge.connect(iframe);
      bridge.highlightElements(["el-0", "el-1"]);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: "el-0",
        }),
        "*"
      );

      const state = bridge.getState();
      expect(state.highlightedIds).toEqual(["el-0", "el-1"]);
    });
  });

  // ---------------------------------------------------------------------------
  // State Management
  // ---------------------------------------------------------------------------

  describe("state management", () => {
    it("enables and disables correctly", () => {
      expect(bridge.isEnabled()).toBe(true);

      bridge.disable();
      expect(bridge.isEnabled()).toBe(false);

      bridge.enable();
      expect(bridge.isEnabled()).toBe(true);
    });

    it("toggle switches enabled state", () => {
      expect(bridge.toggle()).toBe(false);
      expect(bridge.toggle()).toBe(true);
    });

    it("getState returns current state", () => {
      const state = bridge.getState();

      expect(state).toMatchObject({
        enabled: true,
        highlightedIds: [],
        lastPosition: null,
        currentFile: "hero.xml",
      });
    });

    it("onStateChange notifies callbacks", () => {
      const callback = vi.fn();
      bridge.onStateChange(callback);
      bridge.connect(iframe);

      bridge.updateCursor({ line: 1, column: 1 });
      vi.advanceTimersByTime(50);

      expect(callback).toHaveBeenCalled();
      const state = callback.mock.calls[0][0] as CursorHighlightState;
      expect(state.highlightedIds.length).toBeGreaterThan(0);
    });

    it("onStateChange returns unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = bridge.onStateChange(callback);

      unsubscribe();

      bridge.connect(iframe);
      bridge.updateCursor({ line: 1, column: 1 });
      vi.advanceTimersByTime(50);

      expect(callback).not.toHaveBeenCalled();
    });

    it("handles callback errors gracefully", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCallback = vi.fn();

      bridge.onStateChange(errorCallback);
      bridge.onStateChange(normalCallback);
      bridge.connect(iframe);

      // Should not throw
      expect(() => {
        bridge.updateCursor({ line: 1, column: 1 });
        vi.advanceTimersByTime(50);
      }).not.toThrow();

      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  describe("configuration", () => {
    it("setSourceMapper updates the mapper", () => {
      bridge.connect(iframe);

      const newMapper = new SourceMapper();
      newMapper.annotate("<div>New content</div>", "new.xml");

      bridge.setSourceMapper(newMapper);
      bridge.setFilePath("new.xml");
      bridge.updateCursor({ line: 1, column: 1 });
      vi.advanceTimersByTime(50);

      const state = bridge.getState();
      expect(state.currentFile).toBe("new.xml");
    });

    it("setFilePath updates current file", () => {
      bridge.setFilePath("new-file.xml");
      expect(bridge.getState().currentFile).toBe("new-file.xml");
    });

    it("setOptions updates bridge options", () => {
      bridge.setOptions({
        debounceMs: 100,
        scrollIntoView: false,
      });

      bridge.connect(iframe);
      bridge.updateCursor({ line: 1, column: 1 });

      // With 100ms debounce, 50ms should not trigger
      vi.advanceTimersByTime(50);
      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      expect(postMessage).not.toHaveBeenCalled();

      // After full 100ms
      vi.advanceTimersByTime(50);
      expect(postMessage).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple Highlights
  // ---------------------------------------------------------------------------

  describe("multiple highlights", () => {
    it("highlightMultiple option sends multiple sourceIds", () => {
      const multiBridge = new CursorHighlightBridge(mapper, {
        filePath: "hero.xml",
        debounceMs: 50,
        highlightMultiple: true,
      });

      multiBridge.connect(iframe);
      multiBridge.updateCursor({ line: 3, column: 1 }); // Inside nested elements
      vi.advanceTimersByTime(50);

      const postMessage = iframe.contentWindow!.postMessage as ReturnType<typeof vi.fn>;
      const lastCall = postMessage.mock.calls[postMessage.mock.calls.length - 1];

      expect(lastCall[0].sourceIds).toBeDefined();
      expect(lastCall[0].sourceIds.length).toBeGreaterThan(0);

      multiBridge.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  describe("cleanup", () => {
    it("dispose clears timers and state", () => {
      bridge.connect(iframe);
      bridge.updateCursor({ line: 1, column: 1 });

      bridge.dispose();

      // Advancing time should not cause errors
      expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    });

    it("dispose prevents further operations", () => {
      bridge.dispose();

      // These should not throw but also should not work
      expect(() => bridge.updateCursor({ line: 1, column: 1 })).not.toThrow();
      expect(() => bridge.highlightElements(["el-0"])).not.toThrow();
    });

    it("dispose can be called multiple times safely", () => {
      expect(() => {
        bridge.dispose();
        bridge.dispose();
      }).not.toThrow();
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe("createCursorHighlightBridge", () => {
  it("creates a bridge with default options", () => {
    const mapper = new SourceMapper();
    const bridge = createCursorHighlightBridge(mapper);

    expect(bridge).toBeInstanceOf(CursorHighlightBridge);
    expect(bridge.isEnabled()).toBe(true);

    bridge.dispose();
  });

  it("creates a bridge with custom options", () => {
    const mapper = new SourceMapper();
    const bridge = createCursorHighlightBridge(mapper, {
      debounceMs: 100,
      filePath: "test.xml",
      scrollIntoView: false,
    });

    expect(bridge.getState().currentFile).toBe("test.xml");

    bridge.dispose();
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("CursorHighlightBridge integration", () => {
  it("full workflow: connect, cursor move, highlight, disconnect", () => {
    vi.useFakeTimers();

    const mapper = createSourceMapperWithData();
    const bridge = createCursorHighlightBridge(mapper, {
      filePath: "hero.xml",
      debounceMs: 50,
    });
    const iframe = createMockIframe();

    // Connect
    bridge.connect(iframe);
    expect(bridge.isConnected()).toBe(true);

    // Move cursor
    bridge.updateCursor({ line: 1, column: 1 });
    vi.advanceTimersByTime(50);

    // Verify highlight
    const state = bridge.getState();
    expect(state.highlightedIds.length).toBeGreaterThan(0);
    expect(state.lastPosition).toEqual({ line: 1, column: 1 });

    // Clear and disconnect
    bridge.clearHighlight();
    expect(bridge.getState().highlightedIds).toEqual([]);

    bridge.disconnect();
    expect(bridge.isConnected()).toBe(false);

    bridge.dispose();
    vi.useRealTimers();
  });

  it("works with re-annotation of source", () => {
    vi.useFakeTimers();

    const mapper = new SourceMapper();
    mapper.annotate("<div>Initial</div>", "test.xml");

    const bridge = createCursorHighlightBridge(mapper, {
      filePath: "test.xml",
    });
    const iframe = createMockIframe();

    bridge.connect(iframe);
    bridge.updateCursorImmediate({ line: 1, column: 1 });

    const firstHighlight = bridge.getState().highlightedIds;
    expect(firstHighlight.length).toBeGreaterThan(0);

    // Re-annotate with new content (use a new mapper to get different IDs)
    const newMapper = new SourceMapper({ idPrefix: "new" });
    newMapper.annotate("<section>New content</section>", "test.xml");

    bridge.setSourceMapper(newMapper);
    bridge.updateCursorImmediate({ line: 1, column: 1 });

    const secondHighlight = bridge.getState().highlightedIds;

    // IDs should be different with the new mapper (different prefix)
    expect(secondHighlight.length).toBeGreaterThan(0);
    expect(firstHighlight[0]).not.toBe(secondHighlight[0]);

    bridge.dispose();
    vi.useRealTimers();
  });
});

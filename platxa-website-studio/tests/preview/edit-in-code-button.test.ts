/**
 * Tests for EditInCodeButton — 'Edit in Code' button jumping to source.
 *
 * Feature #84: Create 'Edit in Code' button jumping to source in editor
 * Verification: Button opens file in editor at selected element's source line
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EditInCodeButton,
  createEditInCodeButton,
  EDIT_IN_CODE_SCRIPT,
  DEFAULT_LABEL,
  DEFAULT_TOOLTIP,
  DEFAULT_SHORTCUT,
  type SourceLocation,
  type SelectedElementSource,
  type EditInCodeButtonOptions,
} from "../../lib/preview/edit-in-code-button";
import type { EditorIntegration } from "../../lib/preview/preview-source-navigator";

// =============================================================================
// Helper: Mock Editor Integration
// =============================================================================

function createMockEditor(): EditorIntegration & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {
    openFile: [],
    setCursorPosition: [],
    setSelection: [],
    revealLine: [],
  };

  return {
    calls,
    openFile: vi.fn((path: string) => {
      calls.openFile.push([path]);
    }),
    setCursorPosition: vi.fn((line: number, column?: number) => {
      calls.setCursorPosition.push([line, column]);
    }),
    setSelection: vi.fn((startLine: number, endLine: number, startCol?: number, endCol?: number) => {
      calls.setSelection.push([startLine, endLine, startCol, endCol]);
    }),
    revealLine: vi.fn((line: number) => {
      calls.revealLine.push([line]);
    }),
  };
}

// =============================================================================
// Test: Constants
// =============================================================================

describe("EditInCodeButton — Constants", () => {
  it("has default label", () => {
    expect(DEFAULT_LABEL).toBe("Edit in Code");
  });

  it("has default tooltip", () => {
    expect(DEFAULT_TOOLTIP).toBe("Open source file in editor");
  });

  it("has default shortcut", () => {
    expect(DEFAULT_SHORTCUT).toBe("Ctrl+E");
  });
});

// =============================================================================
// Test: EditInCodeButton Class
// =============================================================================

describe("EditInCodeButton — Class", () => {
  let button: EditInCodeButton;
  let editor: EditorIntegration & { calls: Record<string, unknown[][]> };

  beforeEach(() => {
    editor = createMockEditor();
    button = new EditInCodeButton({ editor });
  });

  afterEach(() => {
    button.dispose();
  });

  describe("constructor", () => {
    it("creates with default options", () => {
      const b = new EditInCodeButton();
      expect(b.getLabel()).toBe(DEFAULT_LABEL);
      expect(b.getShortcut()).toBe(DEFAULT_SHORTCUT);
      b.dispose();
    });

    it("creates with custom options", () => {
      const b = new EditInCodeButton({
        label: "Open Source",
        tooltip: "Custom tooltip",
        shortcut: "Ctrl+O",
      });
      expect(b.getLabel()).toBe("Open Source");
      expect(b.getShortcut()).toBe("Ctrl+O");
      b.dispose();
    });
  });

  describe("editor integration", () => {
    it("sets editor", () => {
      const b = new EditInCodeButton();
      expect(b.hasEditor()).toBe(false);

      b.setEditor(editor);
      expect(b.hasEditor()).toBe(true);

      b.dispose();
    });

    it("sets source resolver", () => {
      const resolver = vi.fn().mockReturnValue({
        path: "test.xml",
        startLine: 5,
        endLine: 10,
      });

      button.setSourceResolver(resolver);

      // Select element without source - should call resolver
      button.setSelectedElement({
        elementId: "test-1",
        source: null,
      });

      expect(resolver).toHaveBeenCalledWith("test-1");
    });
  });

  describe("element selection", () => {
    it("sets selected element", () => {
      const element: SelectedElementSource = {
        elementId: "snippet-1",
        source: { path: "template.xml", startLine: 10, endLine: 20 },
      };

      button.setSelectedElement(element);

      expect(button.getSelectedElement()).toEqual(element);
    });

    it("clears selection", () => {
      button.setSelectedElement({
        elementId: "snippet-1",
        source: { path: "template.xml", startLine: 10, endLine: 20 },
      });

      button.clearSelection();

      expect(button.getSelectedElement()).toBeNull();
    });

    it("enables button when element has source", () => {
      expect(button.isEnabled()).toBe(false);

      button.setSelectedElement({
        elementId: "snippet-1",
        source: { path: "template.xml", startLine: 10, endLine: 20 },
      });

      expect(button.isEnabled()).toBe(true);
    });

    it("disables button when element has no source", () => {
      button.setSelectedElement({
        elementId: "snippet-1",
        source: null,
      });

      expect(button.isEnabled()).toBe(false);
    });

    it("resolves source using resolver", () => {
      const resolver = vi.fn().mockReturnValue({
        path: "resolved.xml",
        startLine: 15,
        endLine: 25,
      });

      button.setSourceResolver(resolver);
      button.setSelectedElement({
        elementId: "element-1",
        source: null,
      });

      const selected = button.getSelectedElement();
      expect(selected?.source?.path).toBe("resolved.xml");
      expect(selected?.source?.startLine).toBe(15);
    });
  });

  describe("click action", () => {
    const testElement: SelectedElementSource = {
      elementId: "snippet-1",
      source: { path: "template.xml", startLine: 10, endLine: 20 },
    };

    beforeEach(() => {
      button.setSelectedElement(testElement);
    });

    it("opens file in editor on click", () => {
      button.click();

      expect(editor.openFile).toHaveBeenCalledWith("template.xml");
    });

    it("sets cursor position", () => {
      button.click();

      expect(editor.setCursorPosition).toHaveBeenCalledWith(10, 1);
    });

    it("sets selection range", () => {
      button.click();

      expect(editor.setSelection).toHaveBeenCalledWith(10, 20, 1, 1);
    });

    it("reveals line", () => {
      button.click();

      expect(editor.revealLine).toHaveBeenCalledWith(10);
    });

    it("returns navigation result", () => {
      const result = button.click();

      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.path).toBe("template.xml");
      expect(result?.startLine).toBe(10);
      expect(result?.endLine).toBe(20);
    });

    it("returns null when disabled", () => {
      button.clearSelection();

      const result = button.click();

      expect(result).toBeNull();
    });

    it("returns null when no editor", () => {
      const b = new EditInCodeButton();
      b.setSelectedElement(testElement);

      const result = b.click();

      expect(result).toBeNull();
      b.dispose();
    });
  });

  describe("button state", () => {
    it("starts in idle state", () => {
      const b = new EditInCodeButton({ editor });
      expect(b.getButtonState()).toBe("idle");
      b.dispose();
    });

    it("changes to ready when element selected", () => {
      button.setSelectedElement({
        elementId: "snippet-1",
        source: { path: "test.xml", startLine: 1, endLine: 5 },
      });

      expect(button.getButtonState()).toBe("ready");
    });

    it("returns to ready after successful navigation", () => {
      button.setSelectedElement({
        elementId: "snippet-1",
        source: { path: "test.xml", startLine: 1, endLine: 5 },
      });

      button.click();

      expect(button.getButtonState()).toBe("ready");
    });

    it("changes to error on navigation failure", () => {
      const failingEditor: EditorIntegration = {
        openFile: () => {
          throw new Error("File not found");
        },
        setCursorPosition: vi.fn(),
        setSelection: vi.fn(),
        revealLine: vi.fn(),
      };

      const b = new EditInCodeButton({ editor: failingEditor });
      b.setSelectedElement({
        elementId: "snippet-1",
        source: { path: "missing.xml", startLine: 1, endLine: 5 },
      });

      b.click();

      expect(b.getButtonState()).toBe("error");
      b.dispose();
    });

    it("disabled state when no editor", () => {
      const b = new EditInCodeButton();
      expect(b.getButtonState()).toBe("disabled");
      b.dispose();
    });
  });

  describe("UI properties", () => {
    it("returns label", () => {
      expect(button.getLabel()).toBe("Edit in Code");
    });

    it("returns tooltip with file info when element selected", () => {
      button.setSelectedElement({
        elementId: "snippet-1",
        source: { path: "views/template.xml", startLine: 42, endLine: 50 },
      });

      const tooltip = button.getTooltip();

      expect(tooltip).toContain("template.xml");
      expect(tooltip).toContain("42");
    });

    it("returns default tooltip when no element", () => {
      expect(button.getTooltip()).toBe(DEFAULT_TOOLTIP);
    });

    it("returns shortcut", () => {
      expect(button.getShortcut()).toBe("Ctrl+E");
    });
  });

  describe("callbacks", () => {
    const testElement: SelectedElementSource = {
      elementId: "snippet-1",
      source: { path: "template.xml", startLine: 10, endLine: 20 },
    };

    it("calls click callback", () => {
      const callback = vi.fn();
      button.onClick(callback);
      button.setSelectedElement(testElement);

      button.click();

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].element).toEqual(testElement);
      expect(callback.mock.calls[0][0].source).toEqual(testElement.source);
    });

    it("calls navigation callback", () => {
      const callback = vi.fn();
      button.onNavigate(callback);
      button.setSelectedElement(testElement);

      button.click();

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].success).toBe(true);
      expect(callback.mock.calls[0][0].path).toBe("template.xml");
    });

    it("calls state change callback", () => {
      const callback = vi.fn();
      button.onStateChange(callback);

      button.setSelectedElement(testElement);

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].state).toBe("ready");
    });

    it("unsubscribes from callbacks", () => {
      const callback = vi.fn();
      const unsubscribe = button.onClick(callback);

      unsubscribe();
      button.setSelectedElement(testElement);
      button.click();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("state object", () => {
    it("returns full state", () => {
      button.setSelectedElement({
        elementId: "snippet-1",
        source: { path: "test.xml", startLine: 5, endLine: 10 },
      });

      const state = button.getState();

      expect(state.state).toBe("ready");
      expect(state.selectedElement).not.toBeNull();
      expect(state.enabled).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe("dispose", () => {
    it("disposes cleanly", () => {
      button.dispose();

      // Click should return null after dispose
      button.setSelectedElement({
        elementId: "snippet-1",
        source: { path: "test.xml", startLine: 1, endLine: 5 },
      });

      const result = button.click();
      expect(result).toBeNull();
    });

    it("is idempotent", () => {
      button.dispose();
      button.dispose(); // Should not throw
    });
  });
});

// =============================================================================
// Test: Factory Function
// =============================================================================

describe("EditInCodeButton — Factory", () => {
  it("creates instance with createEditInCodeButton", () => {
    const button = createEditInCodeButton();
    expect(button).toBeInstanceOf(EditInCodeButton);
    button.dispose();
  });

  it("passes options to constructor", () => {
    const button = createEditInCodeButton({
      label: "Jump to Source",
      shortcut: "F12",
    });
    expect(button.getLabel()).toBe("Jump to Source");
    expect(button.getShortcut()).toBe("F12");
    button.dispose();
  });
});

// =============================================================================
// Test: Iframe Script
// =============================================================================

describe("EditInCodeButton — Iframe Script", () => {
  it("contains script tag", () => {
    expect(EDIT_IN_CODE_SCRIPT).toContain("<script>");
    expect(EDIT_IN_CODE_SCRIPT).toContain("</script>");
  });

  it("creates button element", () => {
    expect(EDIT_IN_CODE_SCRIPT).toContain("createElement('button')");
    expect(EDIT_IN_CODE_SCRIPT).toContain("platxa-edit-in-code-btn");
  });

  it("handles show-edit-button message", () => {
    expect(EDIT_IN_CODE_SCRIPT).toContain("platxa:show-edit-button");
  });

  it("handles hide-edit-button message", () => {
    expect(EDIT_IN_CODE_SCRIPT).toContain("platxa:hide-edit-button");
  });

  it("sends edit-in-code message on click", () => {
    expect(EDIT_IN_CODE_SCRIPT).toContain("platxa:edit-in-code");
  });

  it("reads data-source-id attribute", () => {
    expect(EDIT_IN_CODE_SCRIPT).toContain("data-source-id");
  });

  it("reads data-snippet-id attribute", () => {
    expect(EDIT_IN_CODE_SCRIPT).toContain("data-snippet-id");
  });

  it("sends ready message", () => {
    expect(EDIT_IN_CODE_SCRIPT).toContain("platxa:edit-in-code-ready");
  });

  it("styles button appropriately", () => {
    expect(EDIT_IN_CODE_SCRIPT).toContain("position: fixed");
    expect(EDIT_IN_CODE_SCRIPT).toContain("z-index: 999999");
  });
});

// =============================================================================
// Test: Integration Scenarios
// =============================================================================

describe("EditInCodeButton — Integration", () => {
  it("button opens file in editor at selected element's source line", () => {
    // Verification: Button opens file in editor at selected element's source line
    const editor = createMockEditor();
    const button = createEditInCodeButton({ editor });

    // Select an element with source location
    button.setSelectedElement({
      elementId: "s_banner_1",
      source: {
        path: "views/snippets/banner.xml",
        startLine: 42,
        endLine: 68,
      },
      snippetType: "s_banner",
    });

    // Button should be enabled
    expect(button.isEnabled()).toBe(true);
    expect(button.getButtonState()).toBe("ready");

    // Click the button
    const result = button.click();

    // Verify file was opened at correct line
    expect(result?.success).toBe(true);
    expect(editor.openFile).toHaveBeenCalledWith("views/snippets/banner.xml");
    expect(editor.setCursorPosition).toHaveBeenCalledWith(42, 1);
    expect(editor.setSelection).toHaveBeenCalledWith(42, 68, 1, 1);
    expect(editor.revealLine).toHaveBeenCalledWith(42);

    button.dispose();
  });

  it("full edit-in-code workflow", () => {
    const editor = createMockEditor();
    const clickHandler = vi.fn();
    const navHandler = vi.fn();
    const stateHandler = vi.fn();

    const button = createEditInCodeButton({ editor });

    // Set up callbacks
    button.onClick(clickHandler);
    button.onNavigate(navHandler);
    button.onStateChange(stateHandler);

    // 1. Initially disabled (no element selected)
    expect(button.isEnabled()).toBe(false);

    // 2. Select element
    button.setSelectedElement({
      elementId: "feature-section",
      source: {
        path: "templates/features.xml",
        startLine: 100,
        endLine: 150,
        startColumn: 5,
      },
    });

    // 3. Button becomes enabled
    expect(button.isEnabled()).toBe(true);
    expect(stateHandler).toHaveBeenCalled();

    // 4. Tooltip shows file info
    expect(button.getTooltip()).toContain("features.xml");
    expect(button.getTooltip()).toContain("100");

    // 5. Click button
    button.click();

    // 6. Verify all editor calls
    expect(editor.openFile).toHaveBeenCalledWith("templates/features.xml");
    expect(editor.setCursorPosition).toHaveBeenCalledWith(100, 5);

    // 7. Verify callbacks
    expect(clickHandler).toHaveBeenCalled();
    expect(navHandler).toHaveBeenCalled();
    expect(navHandler.mock.calls[0][0].success).toBe(true);

    // 8. Clear selection
    button.clearSelection();
    expect(button.isEnabled()).toBe(false);

    button.dispose();
  });

  it("handles source resolution", () => {
    const editor = createMockEditor();
    const sourceMap = new Map<string, SourceLocation>([
      ["snippet-abc", { path: "views/s_banner.xml", startLine: 10, endLine: 30 }],
      ["snippet-xyz", { path: "views/s_features.xml", startLine: 50, endLine: 80 }],
    ]);

    const button = createEditInCodeButton({
      editor,
      resolveSource: (id) => sourceMap.get(id) || null,
    });

    // Select element without source - should be resolved
    button.setSelectedElement({
      elementId: "snippet-abc",
      source: null,
    });

    // Source should be resolved
    expect(button.getSelectedElement()?.source?.path).toBe("views/s_banner.xml");
    expect(button.isEnabled()).toBe(true);

    // Click should work
    const result = button.click();
    expect(result?.success).toBe(true);
    expect(editor.openFile).toHaveBeenCalledWith("views/s_banner.xml");

    button.dispose();
  });
});

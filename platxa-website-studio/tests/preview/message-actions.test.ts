/**
 * Tests for Message Actions
 *
 * Feature #118: Implement message actions (copy, regenerate, edit)
 * Verification: Hover shows action buttons; copy copies text; regenerate re-runs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MessageActions,
  createMessageActions,
  ACTION_LABELS,
  ACTION_ICONS,
  ACTION_TOOLTIPS,
  ACTION_SHORTCUTS,
  DEFAULT_USER_ACTIONS,
  DEFAULT_ASSISTANT_ACTIONS,
  copyToClipboard,
  formatForCopy,
  generateButtonHtml,
  getActionsForRole,
  createActionButton,
  type MessageContext,
  type ActionButton,
} from "../../lib/preview/message-actions";

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

Object.defineProperty(navigator, "clipboard", {
  value: mockClipboard,
  writable: true,
});

describe("MessageActions", () => {
  let actions: MessageActions;

  beforeEach(() => {
    actions = createMessageActions();
    mockClipboard.writeText.mockClear();
  });

  afterEach(() => {
    actions.dispose();
  });

  const createTestMessage = (
    overrides: Partial<MessageContext> = {}
  ): MessageContext => ({
    id: `msg-${Date.now()}`,
    role: "assistant",
    content: "Test message content",
    index: 0,
    timestamp: Date.now(),
    ...overrides,
  });

  describe("utility functions", () => {
    describe("formatForCopy", () => {
      it("should return content as-is by default", () => {
        const content = "Hello **world**";
        expect(formatForCopy(content)).toBe("Hello **world**");
      });

      it("should strip markdown formatting with plainText option", () => {
        const content = "Hello **world** and *italic*";
        expect(formatForCopy(content, { plainText: true })).toBe(
          "Hello world and italic"
        );
      });

      it("should remove code blocks when includeCode is false", () => {
        const content = "Text\n```js\ncode\n```\nMore text";
        expect(formatForCopy(content, { includeCode: false })).toBe(
          "Text\n[code block removed]\nMore text"
        );
      });

      it("should extract code from code blocks with plainText", () => {
        const content = "```js\nconst x = 1;\n```";
        expect(formatForCopy(content, { plainText: true })).toBe("const x = 1;");
      });
    });

    describe("generateButtonHtml", () => {
      it("should generate button HTML", () => {
        const button: ActionButton = {
          type: "copy",
          label: "Copy",
          icon: "📋",
          tooltip: "Copy to clipboard",
          enabled: true,
          state: "idle",
          visible: true,
        };

        const html = generateButtonHtml(button);

        expect(html).toContain("action-btn");
        expect(html).toContain("action-copy");
        expect(html).toContain("📋");
        expect(html).toContain("Copy");
      });

      it("should add disabled attribute when not enabled", () => {
        const button: ActionButton = {
          type: "copy",
          label: "Copy",
          icon: "📋",
          tooltip: "Copy",
          enabled: false,
          state: "idle",
          visible: true,
        };

        const html = generateButtonHtml(button);
        expect(html).toContain("disabled");
      });

      it("should show spinner for loading state", () => {
        const button: ActionButton = {
          type: "copy",
          label: "Copy",
          icon: "📋",
          tooltip: "Copy",
          enabled: true,
          state: "loading",
          visible: true,
        };

        const html = generateButtonHtml(button);
        expect(html).toContain("action-spinner");
        expect(html).toContain("⏳");
      });

      it("should show check for success state", () => {
        const button: ActionButton = {
          type: "copy",
          label: "Copy",
          icon: "📋",
          tooltip: "Copy",
          enabled: true,
          state: "success",
          visible: true,
        };

        const html = generateButtonHtml(button);
        expect(html).toContain("action-check");
        expect(html).toContain("✓");
      });
    });

    describe("getActionsForRole", () => {
      it("should return user actions for user role", () => {
        const userActions = getActionsForRole("user", {});
        expect(userActions).toEqual(DEFAULT_USER_ACTIONS);
      });

      it("should return assistant actions for assistant role", () => {
        const assistantActions = getActionsForRole("assistant", {});
        expect(assistantActions).toEqual(DEFAULT_ASSISTANT_ACTIONS);
      });

      it("should return only copy for system role", () => {
        const systemActions = getActionsForRole("system", {});
        expect(systemActions).toEqual(["copy"]);
      });

      it("should respect custom options", () => {
        const customActions = getActionsForRole("user", {
          userActions: ["copy", "delete"],
        });
        expect(customActions).toEqual(["copy", "delete"]);
      });
    });

    describe("createActionButton", () => {
      it("should create button with defaults", () => {
        const button = createActionButton("copy");

        expect(button.type).toBe("copy");
        expect(button.label).toBe(ACTION_LABELS.copy);
        expect(button.icon).toBe(ACTION_ICONS.copy);
        expect(button.enabled).toBe(true);
        expect(button.state).toBe("idle");
      });

      it("should use custom labels", () => {
        const button = createActionButton("copy", {
          labels: { copy: "Copy Text" },
        });

        expect(button.label).toBe("Copy Text");
      });

      it("should use custom icons", () => {
        const button = createActionButton("copy", {
          icons: { copy: "📄" },
        });

        expect(button.icon).toBe("📄");
      });
    });
  });

  describe("registerMessage", () => {
    it("should register a message", () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      expect(actions.getMessage("msg-1")).toEqual(msg);
    });

    it("should initialize buttons for message", () => {
      const msg = createTestMessage({ id: "msg-1", role: "assistant" });
      actions.registerMessage(msg);

      const buttons = actions.getButtons("msg-1");
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.some((b) => b.type === "copy")).toBe(true);
      expect(buttons.some((b) => b.type === "regenerate")).toBe(true);
    });

    it("should throw if disposed", () => {
      actions.dispose();
      expect(() => actions.registerMessage(createTestMessage())).toThrow(
        "MessageActions is disposed"
      );
    });
  });

  describe("unregisterMessage", () => {
    it("should unregister a message", () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      expect(actions.unregisterMessage("msg-1")).toBe(true);
      expect(actions.getMessage("msg-1")).toBeUndefined();
    });

    it("should return false for non-existent message", () => {
      expect(actions.unregisterMessage("non-existent")).toBe(false);
    });

    it("should hide actions if hovering removed message", () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);
      actions.showActions("msg-1");

      actions.unregisterMessage("msg-1");

      expect(actions.isActionsVisible("msg-1")).toBe(false);
    });
  });

  describe("hover behavior", () => {
    it("should show actions on hover", () => {
      vi.useFakeTimers();

      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      actions.handleMouseEnter("msg-1");

      // Actions not visible yet
      expect(actions.isActionsVisible("msg-1")).toBe(false);

      // Fast forward past hover delay
      vi.advanceTimersByTime(350);

      expect(actions.isActionsVisible("msg-1")).toBe(true);

      vi.useRealTimers();
    });

    it("should hide actions on mouse leave", () => {
      vi.useFakeTimers();

      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      actions.showActions("msg-1");
      expect(actions.isActionsVisible("msg-1")).toBe(true);

      actions.handleMouseLeave();

      // Still visible
      expect(actions.isActionsVisible("msg-1")).toBe(true);

      // Fast forward past hide delay
      vi.advanceTimersByTime(250);

      expect(actions.isActionsVisible("msg-1")).toBe(false);

      vi.useRealTimers();
    });

    it("should cancel hide when re-entering", () => {
      vi.useFakeTimers();

      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      actions.showActions("msg-1");
      actions.handleMouseLeave();

      // Re-enter before hide completes
      vi.advanceTimersByTime(100);
      actions.handleMouseEnter("msg-1");

      vi.advanceTimersByTime(400);

      expect(actions.isActionsVisible("msg-1")).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("executeCopy", () => {
    it("should copy message content to clipboard", async () => {
      const msg = createTestMessage({
        id: "msg-1",
        content: "Copy this text",
      });
      actions.registerMessage(msg);

      const result = await actions.executeCopy("msg-1");

      expect(result.success).toBe(true);
      expect(result.action).toBe("copy");
      expect(mockClipboard.writeText).toHaveBeenCalledWith("Copy this text");
    });

    it("should return error for non-existent message", async () => {
      const result = await actions.executeCopy("non-existent");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Message not found");
    });

    it("should use rawContent when available", async () => {
      const msg = createTestMessage({
        id: "msg-1",
        content: "Display content",
        rawContent: "Raw **markdown** content",
      });
      actions.registerMessage(msg);

      await actions.executeCopy("msg-1");

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        "Raw **markdown** content"
      );
    });

    it("should notify copy callbacks", async () => {
      const callback = vi.fn();
      actions.onCopy(callback);

      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      await actions.executeCopy("msg-1");

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ id: "msg-1" }),
        expect.objectContaining({ success: true, action: "copy" })
      );
    });
  });

  describe("executeRegenerate", () => {
    it("should call regenerate callback", async () => {
      const regenerateCallback = vi.fn().mockResolvedValue(undefined);
      actions.onRegenerate(regenerateCallback);

      const msg = createTestMessage({ id: "msg-1", role: "assistant" });
      actions.registerMessage(msg);

      const result = await actions.executeRegenerate("msg-1");

      expect(result.success).toBe(true);
      expect(result.action).toBe("regenerate");
      expect(regenerateCallback).toHaveBeenCalled();
    });

    it("should pass options to callback", async () => {
      const regenerateCallback = vi.fn().mockResolvedValue(undefined);
      actions.onRegenerate(regenerateCallback);

      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      await actions.executeRegenerate("msg-1", { temperature: 0.8 });

      expect(regenerateCallback).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ temperature: 0.8 })
      );
    });

    it("should return error when no callback registered", async () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      const result = await actions.executeRegenerate("msg-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No regenerate handler registered");
    });

    it("should handle callback errors", async () => {
      const regenerateCallback = vi
        .fn()
        .mockRejectedValue(new Error("Regeneration failed"));
      actions.onRegenerate(regenerateCallback);

      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      const result = await actions.executeRegenerate("msg-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Regeneration failed");
    });
  });

  describe("executeEdit", () => {
    it("should call edit callback", async () => {
      const editCallback = vi.fn().mockResolvedValue(undefined);
      actions.onEdit(editCallback);

      const msg = createTestMessage({ id: "msg-1", role: "user" });
      actions.registerMessage(msg);

      const result = await actions.executeEdit("msg-1", {
        mode: "replace",
        newContent: "Edited content",
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("edit");
      expect(editCallback).toHaveBeenCalled();
    });

    it("should return error when no callback registered", async () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      const result = await actions.executeEdit("msg-1", {
        mode: "replace",
        newContent: "New content",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No edit handler registered");
    });
  });

  describe("button management", () => {
    it("should get button for message", () => {
      const msg = createTestMessage({ id: "msg-1", role: "assistant" });
      actions.registerMessage(msg);

      const button = actions.getButton("msg-1", "copy");

      expect(button).toBeDefined();
      expect(button?.type).toBe("copy");
    });

    it("should enable/disable button", () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      actions.setButtonEnabled("msg-1", "copy", false);

      const button = actions.getButton("msg-1", "copy");
      expect(button?.enabled).toBe(false);
    });

    it("should show/hide button", () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      actions.setButtonVisible("msg-1", "copy", false);

      const button = actions.getButton("msg-1", "copy");
      expect(button?.visible).toBe(false);
    });
  });

  describe("renderActionPanel", () => {
    it("should render action panel", () => {
      const msg = createTestMessage({ id: "msg-1", role: "assistant" });
      actions.registerMessage(msg);

      const panel = actions.renderActionPanel("msg-1");

      expect(panel).not.toBeNull();
      expect(panel!.html).toContain("message-actions-panel");
      expect(panel!.html).toContain("action-btn");
      expect(panel!.buttons.length).toBeGreaterThan(0);
    });

    it("should show visible state", () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      actions.showActions("msg-1");
      const panel = actions.renderActionPanel("msg-1");

      expect(panel!.visible).toBe(true);
      expect(panel!.html).toContain("visible");
    });

    it("should filter hidden buttons", () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      actions.setButtonVisible("msg-1", "copy", false);
      const panel = actions.renderActionPanel("msg-1");

      expect(panel!.buttons.some((b) => b.type === "copy")).toBe(false);
    });
  });

  describe("callbacks", () => {
    it("should allow unsubscribing from copy events", async () => {
      const callback = vi.fn();
      const unsubscribe = actions.onCopy(callback);

      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      await actions.executeCopy("msg-1");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      await actions.executeCopy("msg-1");
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should notify action callbacks", async () => {
      const callback = vi.fn();
      actions.onAction(callback);

      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      await actions.executeCopy("msg-1");

      expect(callback).toHaveBeenCalledWith(
        expect.anything(),
        "copy",
        expect.objectContaining({ success: true })
      );
    });

    it("should handle callback errors gracefully", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      actions.onCopy(errorCallback);

      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);

      await expect(actions.executeCopy("msg-1")).resolves.not.toThrow();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("dispose", () => {
    it("should mark as disposed", () => {
      expect(actions.isDisposed()).toBe(false);
      actions.dispose();
      expect(actions.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      actions.dispose();
      expect(() => actions.dispose()).not.toThrow();
    });

    it("should clear all data", () => {
      const msg = createTestMessage({ id: "msg-1" });
      actions.registerMessage(msg);
      actions.dispose();

      expect(actions.getAllMessages()).toHaveLength(0);
    });
  });
});

describe("constants", () => {
  it("should have labels for all action types", () => {
    expect(ACTION_LABELS.copy).toBe("Copy");
    expect(ACTION_LABELS.regenerate).toBe("Regenerate");
    expect(ACTION_LABELS.edit).toBe("Edit");
    expect(ACTION_LABELS.delete).toBe("Delete");
  });

  it("should have icons for all action types", () => {
    expect(ACTION_ICONS.copy).toBeDefined();
    expect(ACTION_ICONS.regenerate).toBeDefined();
    expect(ACTION_ICONS.edit).toBeDefined();
  });

  it("should have tooltips for all action types", () => {
    expect(ACTION_TOOLTIPS.copy).toContain("clipboard");
    expect(ACTION_TOOLTIPS.regenerate).toContain("Regenerate");
  });

  it("should have shortcuts for all action types", () => {
    expect(ACTION_SHORTCUTS.copy).toBe("Ctrl+C");
    expect(ACTION_SHORTCUTS.regenerate).toContain("Ctrl");
  });

  it("should have default user actions", () => {
    expect(DEFAULT_USER_ACTIONS).toContain("copy");
    expect(DEFAULT_USER_ACTIONS).toContain("edit");
  });

  it("should have default assistant actions", () => {
    expect(DEFAULT_ASSISTANT_ACTIONS).toContain("copy");
    expect(DEFAULT_ASSISTANT_ACTIONS).toContain("regenerate");
  });
});

describe("verification tests", () => {
  it("should show action buttons on hover", () => {
    vi.useFakeTimers();

    const actions = createMessageActions();
    const msg: MessageContext = {
      id: "msg-1",
      role: "assistant",
      content: "Hello!",
      index: 0,
      timestamp: Date.now(),
    };
    actions.registerMessage(msg);

    // Hover shows action buttons
    actions.handleMouseEnter("msg-1");
    vi.advanceTimersByTime(350);

    expect(actions.isActionsVisible("msg-1")).toBe(true);

    const panel = actions.renderActionPanel("msg-1");
    expect(panel!.buttons.length).toBeGreaterThan(0);
    expect(panel!.html).toContain("action-btn");

    actions.dispose();
    vi.useRealTimers();
  });

  it("should copy text with copy action", async () => {
    const actions = createMessageActions();
    const msg: MessageContext = {
      id: "msg-1",
      role: "assistant",
      content: "Copy me!",
      index: 0,
      timestamp: Date.now(),
    };
    actions.registerMessage(msg);

    const result = await actions.executeCopy("msg-1");

    expect(result.success).toBe(true);
    expect(result.action).toBe("copy");
    expect(mockClipboard.writeText).toHaveBeenCalledWith("Copy me!");

    actions.dispose();
  });

  it("should regenerate with regenerate action", async () => {
    const actions = createMessageActions();
    const regenerateHandler = vi.fn().mockResolvedValue(undefined);
    actions.onRegenerate(regenerateHandler);

    const msg: MessageContext = {
      id: "msg-1",
      role: "assistant",
      content: "Original response",
      index: 0,
      timestamp: Date.now(),
    };
    actions.registerMessage(msg);

    const result = await actions.executeRegenerate("msg-1");

    expect(result.success).toBe(true);
    expect(result.action).toBe("regenerate");
    expect(regenerateHandler).toHaveBeenCalledWith(
      expect.objectContaining({ id: "msg-1" }),
      expect.anything()
    );

    actions.dispose();
  });
});

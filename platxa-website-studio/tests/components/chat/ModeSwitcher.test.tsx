/**
 * ModeSwitcher Tests
 *
 * Tests for Feature #29: Mode switching UI with clear visual indicators
 * Verification: Mode badge shows current mode; click toggles between plan/agent
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ModeSwitcher,
  ModeBadge,
  useModeConfig,
  useAgentMode,
  type AgentMode,
} from "@/components/chat/ModeSwitcher";
import { renderHook, act } from "@testing-library/react";

describe("ModeSwitcher", () => {
  describe("Feature #29 verification: Mode badge shows current mode", () => {
    it("displays plan mode with brain icon by default", () => {
      render(<ModeSwitcher defaultMode="plan" />);

      expect(screen.getByText("Plan")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    it("displays agent mode with robot icon when set", () => {
      render(<ModeSwitcher defaultMode="agent" />);

      expect(screen.getByText("Agent")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("shows correct description in title for plan mode", () => {
      render(<ModeSwitcher defaultMode="plan" />);

      const button = screen.getByRole("switch");
      expect(button).toHaveAttribute("title", "Explore and plan approach before executing");
    });

    it("shows correct description in title for agent mode", () => {
      render(<ModeSwitcher defaultMode="agent" />);

      const button = screen.getByRole("switch");
      expect(button).toHaveAttribute("title", "Execute tasks with full tool access");
    });
  });

  describe("Feature #29 verification: Click toggles between plan/agent", () => {
    it("toggles from plan to agent on click", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher defaultMode="plan" onModeChange={onModeChange} />);

      const button = screen.getByRole("switch");
      fireEvent.click(button);

      expect(onModeChange).toHaveBeenCalledWith("agent");
      expect(screen.getByText("Agent")).toBeInTheDocument();
    });

    it("toggles from agent to plan on click", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher defaultMode="agent" onModeChange={onModeChange} />);

      const button = screen.getByRole("switch");
      fireEvent.click(button);

      expect(onModeChange).toHaveBeenCalledWith("plan");
      expect(screen.getByText("Plan")).toBeInTheDocument();
    });

    it("toggles with keyboard Enter", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher defaultMode="plan" onModeChange={onModeChange} />);

      const button = screen.getByRole("switch");
      fireEvent.keyDown(button, { key: "Enter" });

      expect(onModeChange).toHaveBeenCalledWith("agent");
    });

    it("toggles with keyboard Space", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher defaultMode="plan" onModeChange={onModeChange} />);

      const button = screen.getByRole("switch");
      fireEvent.keyDown(button, { key: " " });

      expect(onModeChange).toHaveBeenCalledWith("agent");
    });

    it("cycles through modes on multiple clicks", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher defaultMode="plan" onModeChange={onModeChange} />);

      const button = screen.getByRole("switch");

      // First click: plan -> agent
      fireEvent.click(button);
      expect(screen.getByText("Agent")).toBeInTheDocument();

      // Second click: agent -> plan
      fireEvent.click(button);
      expect(screen.getByText("Plan")).toBeInTheDocument();

      expect(onModeChange).toHaveBeenCalledTimes(2);
    });
  });

  describe("controlled mode", () => {
    it("respects controlled mode prop", () => {
      const { rerender } = render(<ModeSwitcher mode="plan" />);

      expect(screen.getByText("Plan")).toBeInTheDocument();

      rerender(<ModeSwitcher mode="agent" />);
      expect(screen.getByText("Agent")).toBeInTheDocument();
    });

    it("calls onModeChange but does not update internally when controlled", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher mode="plan" onModeChange={onModeChange} />);

      const button = screen.getByRole("switch");
      fireEvent.click(button);

      // Callback should be called
      expect(onModeChange).toHaveBeenCalledWith("agent");

      // But mode should still show "plan" (controlled by parent)
      expect(screen.getByText("Plan")).toBeInTheDocument();
    });
  });

  describe("disabled state", () => {
    it("does not toggle when disabled", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher defaultMode="plan" disabled onModeChange={onModeChange} />);

      const button = screen.getByRole("switch");
      fireEvent.click(button);

      expect(onModeChange).not.toHaveBeenCalled();
      expect(screen.getByText("Plan")).toBeInTheDocument();
    });

    it("has disabled styling", () => {
      render(<ModeSwitcher defaultMode="plan" disabled />);

      const button = screen.getByRole("switch");
      expect(button).toBeDisabled();
      expect(button).toHaveClass("opacity-50");
    });
  });

  describe("size variants", () => {
    it("renders small size correctly", () => {
      render(<ModeSwitcher defaultMode="plan" size="sm" />);

      const button = screen.getByRole("switch");
      expect(button).toHaveClass("h-8");
      expect(button).toHaveClass("text-xs");
    });

    it("renders medium size correctly", () => {
      render(<ModeSwitcher defaultMode="plan" size="md" />);

      const button = screen.getByRole("switch");
      expect(button).toHaveClass("h-9");
      expect(button).toHaveClass("text-sm");
    });

    it("renders large size correctly", () => {
      render(<ModeSwitcher defaultMode="plan" size="lg" />);

      const button = screen.getByRole("switch");
      expect(button).toHaveClass("h-10");
      expect(button).toHaveClass("text-base");
    });
  });

  describe("compact mode", () => {
    it("shows only icon in compact mode", () => {
      render(<ModeSwitcher defaultMode="plan" compact />);

      const button = screen.getByRole("switch");
      expect(button).not.toHaveTextContent("Plan");
      expect(button).toHaveAttribute("aria-label");
    });

    it("toggles correctly in compact mode", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher defaultMode="plan" compact onModeChange={onModeChange} />);

      const button = screen.getByRole("switch");
      fireEvent.click(button);

      expect(onModeChange).toHaveBeenCalledWith("agent");
    });

    it("has appropriate aria-label in compact mode", () => {
      render(<ModeSwitcher defaultMode="plan" compact />);

      const button = screen.getByRole("switch");
      expect(button.getAttribute("aria-label")).toContain("Plan");
      expect(button.getAttribute("aria-label")).toContain("Agent");
    });
  });

  describe("styling", () => {
    it("applies plan mode colors", () => {
      render(<ModeSwitcher defaultMode="plan" />);

      const button = screen.getByRole("switch");
      expect(button).toHaveClass("bg-violet-50");
      expect(button).toHaveClass("border-violet-200");
    });

    it("applies agent mode colors", () => {
      render(<ModeSwitcher defaultMode="agent" />);

      const button = screen.getByRole("switch");
      expect(button).toHaveClass("bg-blue-50");
      expect(button).toHaveClass("border-blue-200");
    });

    it("applies custom className", () => {
      render(<ModeSwitcher defaultMode="plan" className="custom-class" />);

      const button = screen.getByRole("switch");
      expect(button).toHaveClass("custom-class");
    });
  });

  describe("accessibility", () => {
    it("has role=switch", () => {
      render(<ModeSwitcher defaultMode="plan" />);

      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("has aria-checked reflecting agent mode", () => {
      // Use controlled mode prop to test aria-checked updates correctly
      const { rerender } = render(<ModeSwitcher mode="plan" />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

      rerender(<ModeSwitcher mode="agent" />);
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("is keyboard focusable", () => {
      render(<ModeSwitcher defaultMode="plan" />);

      const button = screen.getByRole("switch");
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it("has focus-visible ring styles", () => {
      render(<ModeSwitcher defaultMode="plan" />);

      const button = screen.getByRole("switch");
      expect(button).toHaveClass("focus-visible:ring-2");
    });
  });

  describe("dropdown indicator", () => {
    it("shows dropdown indicator when enabled", () => {
      render(<ModeSwitcher defaultMode="plan" showDropdown />);

      // Should have an extra chevron icon
      const button = screen.getByRole("switch");
      // The ChevronDown is added when showDropdown is true
      expect(button.querySelectorAll("svg").length).toBeGreaterThan(1);
    });

    it("hides dropdown indicator by default", () => {
      render(<ModeSwitcher defaultMode="plan" />);

      const button = screen.getByRole("switch");
      // Should have mode icon + indicator dot = 1 svg
      expect(button.querySelectorAll("svg").length).toBe(1);
    });
  });
});

describe("ModeBadge", () => {
  it("displays plan mode badge", () => {
    render(<ModeBadge mode="plan" />);

    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Current mode: Plan Mode");
  });

  it("displays agent mode badge", () => {
    render(<ModeBadge mode="agent" />);

    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Current mode: Agent Mode");
  });

  it("is non-interactive", () => {
    render(<ModeBadge mode="plan" />);

    const badge = screen.getByRole("status");
    expect(badge.tagName).toBe("SPAN");
  });

  it("applies size variants", () => {
    const { rerender } = render(<ModeBadge mode="plan" size="sm" />);
    expect(screen.getByRole("status")).toHaveClass("px-2");

    rerender(<ModeBadge mode="plan" size="lg" />);
    expect(screen.getByRole("status")).toHaveClass("px-4");
  });
});

describe("useModeConfig hook", () => {
  it("returns correct config for plan mode", () => {
    const { result } = renderHook(() => useModeConfig("plan"));

    expect(result.current.label).toBe("Plan Mode");
    expect(result.current.shortLabel).toBe("Plan");
    expect(result.current.description).toContain("plan");
  });

  it("returns correct config for agent mode", () => {
    const { result } = renderHook(() => useModeConfig("agent"));

    expect(result.current.label).toBe("Agent Mode");
    expect(result.current.shortLabel).toBe("Agent");
    expect(result.current.description).toContain("Execute");
  });
});

describe("useAgentMode hook", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it("returns initial mode", () => {
    const { result } = renderHook(() => useAgentMode("plan"));

    expect(result.current.mode).toBe("plan");
    expect(result.current.isPlanMode).toBe(true);
    expect(result.current.isAgentMode).toBe(false);
  });

  it("toggles mode correctly", () => {
    const { result } = renderHook(() => useAgentMode("plan"));

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.mode).toBe("agent");
    expect(result.current.isPlanMode).toBe(false);
    expect(result.current.isAgentMode).toBe(true);
  });

  it("sets mode directly", () => {
    const { result } = renderHook(() => useAgentMode("plan"));

    act(() => {
      result.current.setMode("agent");
    });

    expect(result.current.mode).toBe("agent");
  });

  it("persists mode to localStorage", () => {
    const { result } = renderHook(() => useAgentMode("plan"));

    act(() => {
      result.current.setMode("agent");
    });

    expect(localStorage.getItem("platxa-agent-mode")).toBe("agent");
  });

  it("restores mode from localStorage", () => {
    localStorage.setItem("platxa-agent-mode", "agent");

    const { result } = renderHook(() => useAgentMode("plan"));

    expect(result.current.mode).toBe("agent");
  });

  it("uses initial mode if localStorage is invalid", () => {
    localStorage.setItem("platxa-agent-mode", "invalid");

    const { result } = renderHook(() => useAgentMode("plan"));

    expect(result.current.mode).toBe("plan");
  });
});

// =============================================================================
// Feature #53 Verification Tests
// =============================================================================

describe("Feature #53 verification: Toggle button switches between plan/agent; persists until changed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("toggle button switches between plan/agent", () => {
    it("switches from plan to agent on single click", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher defaultMode="plan" onModeChange={onModeChange} />);

      const toggle = screen.getByRole("switch");
      expect(screen.getByText("Plan")).toBeInTheDocument();

      fireEvent.click(toggle);

      expect(screen.getByText("Agent")).toBeInTheDocument();
      expect(onModeChange).toHaveBeenCalledWith("agent");
    });

    it("switches from agent to plan on single click", () => {
      const onModeChange = vi.fn();
      render(<ModeSwitcher defaultMode="agent" onModeChange={onModeChange} />);

      const toggle = screen.getByRole("switch");
      expect(screen.getByText("Agent")).toBeInTheDocument();

      fireEvent.click(toggle);

      expect(screen.getByText("Plan")).toBeInTheDocument();
      expect(onModeChange).toHaveBeenCalledWith("plan");
    });

    it("alternates correctly on repeated clicks", () => {
      render(<ModeSwitcher defaultMode="plan" />);

      const toggle = screen.getByRole("switch");

      // plan -> agent
      fireEvent.click(toggle);
      expect(screen.getByText("Agent")).toBeInTheDocument();

      // agent -> plan
      fireEvent.click(toggle);
      expect(screen.getByText("Plan")).toBeInTheDocument();

      // plan -> agent
      fireEvent.click(toggle);
      expect(screen.getByText("Agent")).toBeInTheDocument();
    });
  });

  describe("persists until changed", () => {
    it("persists mode change to localStorage immediately", () => {
      const { result } = renderHook(() => useAgentMode("plan"));

      expect(localStorage.getItem("platxa-agent-mode")).toBeNull();

      act(() => {
        result.current.setMode("agent");
      });

      expect(localStorage.getItem("platxa-agent-mode")).toBe("agent");
    });

    it("restored mode persists across hook re-initialization", () => {
      // First hook instance sets mode
      const { result: result1, unmount } = renderHook(() => useAgentMode("plan"));

      act(() => {
        result1.current.setMode("agent");
      });

      unmount();

      // Second hook instance should restore the persisted mode
      const { result: result2 } = renderHook(() => useAgentMode("plan"));

      expect(result2.current.mode).toBe("agent");
      expect(result2.current.isAgentMode).toBe(true);
    });

    it("persisted mode remains until explicitly changed", () => {
      localStorage.setItem("platxa-agent-mode", "agent");

      const { result } = renderHook(() => useAgentMode("plan"));

      // Mode persists from storage
      expect(result.current.mode).toBe("agent");

      // Toggle changes it
      act(() => {
        result.current.toggleMode();
      });

      expect(result.current.mode).toBe("plan");
      expect(localStorage.getItem("platxa-agent-mode")).toBe("plan");

      // New value persists
      const { result: result2 } = renderHook(() => useAgentMode("agent"));
      expect(result2.current.mode).toBe("plan");
    });

    it("toggle via hook persists to localStorage", () => {
      const { result } = renderHook(() => useAgentMode("plan"));

      act(() => {
        result.current.toggleMode();
      });

      expect(localStorage.getItem("platxa-agent-mode")).toBe("agent");

      act(() => {
        result.current.toggleMode();
      });

      expect(localStorage.getItem("platxa-agent-mode")).toBe("plan");
    });
  });
});

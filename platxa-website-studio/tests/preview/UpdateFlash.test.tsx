/**
 * Tests for UpdateFlash component
 *
 * Feature #65: Create update flash animation for visual feedback on changed sections
 * Verification: Updated sections flash with subtle highlight for 300ms
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useRef } from "react";
import {
  UpdateFlash,
  useUpdateFlash,
  FlashPresets,
  createFlashConfig,
  getFlashColor,
  type UpdateFlashHandle,
} from "@/components/preview/UpdateFlash";

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

// ============================================================================
// Component Tests
// ============================================================================

describe("UpdateFlash", () => {
  describe("rendering", () => {
    it("renders children correctly", () => {
      render(
        <UpdateFlash>
          <span data-testid="child">Content</span>
        </UpdateFlash>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("applies className prop", () => {
      render(
        <UpdateFlash className="custom-class">
          <span>Content</span>
        </UpdateFlash>
      );

      const wrapper = screen.getByText("Content").parentElement;
      expect(wrapper).toHaveClass("update-flash");
      expect(wrapper).toHaveClass("custom-class");
    });

    it("applies style prop", () => {
      render(
        <UpdateFlash style={{ padding: "10px" }}>
          <span>Content</span>
        </UpdateFlash>
      );

      const wrapper = screen.getByText("Content").parentElement;
      expect(wrapper).toHaveStyle({ padding: "10px" });
    });

    it("renders as different elements with as prop", () => {
      render(
        <UpdateFlash as="section">
          <span>Content</span>
        </UpdateFlash>
      );

      const wrapper = screen.getByText("Content").parentElement;
      expect(wrapper?.tagName).toBe("SECTION");
    });

    it("has idle state by default", () => {
      render(
        <UpdateFlash>
          <span>Content</span>
        </UpdateFlash>
      );

      const wrapper = screen.getByText("Content").parentElement;
      expect(wrapper).toHaveAttribute("data-flash-state", "idle");
    });
  });

  describe("flash animation", () => {
    it("flashes when isUpdated becomes true", () => {
      const { rerender } = render(
        <UpdateFlash isUpdated={false}>
          <span>Content</span>
        </UpdateFlash>
      );

      const wrapper = screen.getByText("Content").parentElement;

      // Trigger update
      act(() => {
        rerender(
          <UpdateFlash isUpdated={true}>
            <span>Content</span>
          </UpdateFlash>
        );
      });

      // Should be flashing
      expect(wrapper).toHaveClass("update-flash--active");
      expect(wrapper).toHaveAttribute("data-flash-state", "flashing");
    });

    it("flashes when updateKey changes", () => {
      const { rerender } = render(
        <UpdateFlash updateKey="v1">
          <span>Content</span>
        </UpdateFlash>
      );

      const wrapper = screen.getByText("Content").parentElement;

      // Change key
      act(() => {
        rerender(
          <UpdateFlash updateKey="v2">
            <span>Content</span>
          </UpdateFlash>
        );
      });

      expect(wrapper).toHaveClass("update-flash--active");
      expect(wrapper).toHaveAttribute("data-flash-state", "flashing");
    });

    it("transitions through flash states correctly", () => {
      const { rerender } = render(
        <UpdateFlash updateKey="v1">
          <span>Content</span>
        </UpdateFlash>
      );

      const wrapper = screen.getByText("Content").parentElement;

      // Trigger flash
      act(() => {
        rerender(
          <UpdateFlash updateKey="v2">
            <span>Content</span>
          </UpdateFlash>
        );
      });

      // Should be in flashing state
      expect(wrapper).toHaveAttribute("data-flash-state", "flashing");

      // Advance past peak hold (50ms)
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Should enter fading state
      expect(wrapper).toHaveAttribute("data-flash-state", "fading");

      // Advance past fade duration (300ms default)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should return to idle
      expect(wrapper).toHaveAttribute("data-flash-state", "idle");
      expect(wrapper).not.toHaveClass("update-flash--active");
    });

    it("uses 300ms duration by default", () => {
      const onFlashEnd = vi.fn();

      const { rerender } = render(
        <UpdateFlash updateKey="v1" onFlashEnd={onFlashEnd}>
          <span>Content</span>
        </UpdateFlash>
      );

      // Trigger flash
      act(() => {
        rerender(
          <UpdateFlash updateKey="v2" onFlashEnd={onFlashEnd}>
            <span>Content</span>
          </UpdateFlash>
        );
      });

      // Not ended yet at 300ms
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onFlashEnd).not.toHaveBeenCalled();

      // Should end at 350ms (50ms peak + 300ms fade)
      act(() => {
        vi.advanceTimersByTime(50);
      });

      expect(onFlashEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe("configuration", () => {
    it("accepts custom duration", () => {
      const onFlashEnd = vi.fn();

      const { rerender } = render(
        <UpdateFlash
          updateKey="v1"
          config={{ duration: 500 }}
          onFlashEnd={onFlashEnd}
        >
          <span>Content</span>
        </UpdateFlash>
      );

      act(() => {
        rerender(
          <UpdateFlash
            updateKey="v2"
            config={{ duration: 500 }}
            onFlashEnd={onFlashEnd}
          >
            <span>Content</span>
          </UpdateFlash>
        );
      });

      // Advance 350ms - should not be done yet (50ms peak + 500ms fade)
      act(() => {
        vi.advanceTimersByTime(350);
      });
      expect(onFlashEnd).not.toHaveBeenCalled();

      // Advance remaining time
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(onFlashEnd).toHaveBeenCalledTimes(1);
    });

    it("accepts custom color", () => {
      const customColor = "rgba(255, 0, 0, 0.5)";

      const { rerender } = render(
        <UpdateFlash updateKey="v1" config={{ color: customColor }}>
          <span>Content</span>
        </UpdateFlash>
      );

      act(() => {
        rerender(
          <UpdateFlash updateKey="v2" config={{ color: customColor }}>
            <span>Content</span>
          </UpdateFlash>
        );
      });

      const wrapper = screen.getByText("Content").parentElement;
      expect(wrapper?.style.boxShadow).toContain(customColor);
    });

    it("respects delay option", () => {
      const onFlashStart = vi.fn();

      const { rerender } = render(
        <UpdateFlash
          updateKey="v1"
          config={{ delay: 100 }}
          onFlashStart={onFlashStart}
        >
          <span>Content</span>
        </UpdateFlash>
      );

      act(() => {
        rerender(
          <UpdateFlash
            updateKey="v2"
            config={{ delay: 100 }}
            onFlashStart={onFlashStart}
          >
            <span>Content</span>
          </UpdateFlash>
        );
      });

      // Should not start yet
      expect(onFlashStart).not.toHaveBeenCalled();

      // Advance past delay
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onFlashStart).toHaveBeenCalledTimes(1);
    });

    it("flashes on mount when flashOnMount is true", () => {
      render(
        <UpdateFlash config={{ flashOnMount: true }}>
          <span>Content</span>
        </UpdateFlash>
      );

      const wrapper = screen.getByText("Content").parentElement;
      expect(wrapper).toHaveClass("update-flash--active");
    });
  });

  describe("disabled state", () => {
    it("does not flash when disabled", () => {
      const onFlashStart = vi.fn();

      const { rerender } = render(
        <UpdateFlash updateKey="v1" disabled onFlashStart={onFlashStart}>
          <span>Content</span>
        </UpdateFlash>
      );

      act(() => {
        rerender(
          <UpdateFlash updateKey="v2" disabled onFlashStart={onFlashStart}>
            <span>Content</span>
          </UpdateFlash>
        );
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(onFlashStart).not.toHaveBeenCalled();
    });
  });

  describe("callbacks", () => {
    it("calls onFlashStart when flash begins", () => {
      const onFlashStart = vi.fn();

      const { rerender } = render(
        <UpdateFlash updateKey="v1" onFlashStart={onFlashStart}>
          <span>Content</span>
        </UpdateFlash>
      );

      act(() => {
        rerender(
          <UpdateFlash updateKey="v2" onFlashStart={onFlashStart}>
            <span>Content</span>
          </UpdateFlash>
        );
      });

      expect(onFlashStart).toHaveBeenCalledTimes(1);
    });

    it("calls onFlashEnd when flash completes", () => {
      const onFlashEnd = vi.fn();

      const { rerender } = render(
        <UpdateFlash updateKey="v1" onFlashEnd={onFlashEnd}>
          <span>Content</span>
        </UpdateFlash>
      );

      act(() => {
        rerender(
          <UpdateFlash updateKey="v2" onFlashEnd={onFlashEnd}>
            <span>Content</span>
          </UpdateFlash>
        );
      });

      // Advance through full animation (50ms peak + 300ms fade)
      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(onFlashEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe("imperative handle", () => {
    it("exposes flash method via ref", () => {
      let flashRef: React.RefObject<UpdateFlashHandle> = { current: null };

      const TestComponent = () => {
        flashRef = useRef<UpdateFlashHandle>(null);

        return (
          <UpdateFlash ref={flashRef}>
            <span>Content</span>
          </UpdateFlash>
        );
      };

      render(<TestComponent />);

      const wrapper = screen.getByText("Content").parentElement;

      // Trigger flash via ref
      act(() => {
        flashRef.current?.flash();
      });

      expect(wrapper).toHaveClass("update-flash--active");
    });

    it("exposes getState method via ref", () => {
      let flashRef: React.RefObject<UpdateFlashHandle> = { current: null };

      const TestComponent = () => {
        flashRef = useRef<UpdateFlashHandle>(null);

        return (
          <UpdateFlash ref={flashRef}>
            <span>Content</span>
          </UpdateFlash>
        );
      };

      render(<TestComponent />);

      expect(flashRef.current?.getState()).toBe("idle");

      act(() => {
        flashRef.current?.flash();
      });

      expect(flashRef.current?.getState()).toBe("flashing");
    });

    it("exposes cancel method via ref", () => {
      let flashRef: React.RefObject<UpdateFlashHandle> = { current: null };

      const TestComponent = () => {
        flashRef = useRef<UpdateFlashHandle>(null);

        return (
          <UpdateFlash ref={flashRef}>
            <span>Content</span>
          </UpdateFlash>
        );
      };

      render(<TestComponent />);

      const wrapper = screen.getByText("Content").parentElement;

      // Start flash
      act(() => {
        flashRef.current?.flash();
      });

      expect(wrapper).toHaveClass("update-flash--active");

      // Cancel it
      act(() => {
        flashRef.current?.cancel();
      });

      // Should immediately return to idle
      expect(wrapper).toHaveAttribute("data-flash-state", "idle");
      expect(wrapper).not.toHaveClass("update-flash--active");
    });
  });
});

// ============================================================================
// Hook Tests
// ============================================================================

describe("useUpdateFlash", () => {
  it("returns initial idle state", () => {
    const TestComponent = () => {
      const { state, isFlashing } = useUpdateFlash();
      return (
        <div>
          <span data-testid="state">{state}</span>
          <span data-testid="flashing">{isFlashing.toString()}</span>
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    expect(screen.getByTestId("flashing")).toHaveTextContent("false");
  });

  it("flash() triggers animation", () => {
    const TestComponent = () => {
      const { flash, state } = useUpdateFlash();
      return (
        <div>
          <button onClick={flash}>Flash</button>
          <span data-testid="state">{state}</span>
        </div>
      );
    };

    render(<TestComponent />);

    act(() => {
      screen.getByText("Flash").click();
    });

    expect(screen.getByTestId("state")).toHaveTextContent("flashing");
  });

  it("returns flashProps for spreading", () => {
    const TestComponent = () => {
      const { flashProps } = useUpdateFlash();
      return (
        <div data-testid="target" {...flashProps}>
          Target
        </div>
      );
    };

    render(<TestComponent />);

    const target = screen.getByTestId("target");
    expect(target).toHaveClass("update-flash");
    expect(target).toHaveAttribute("data-flash-state", "idle");
  });

  it("accepts custom config", () => {
    const TestComponent = () => {
      const { flash, flashProps } = useUpdateFlash({
        color: "rgba(255, 0, 0, 0.5)",
      });
      return (
        <div>
          <button onClick={flash}>Flash</button>
          <div data-testid="target" {...flashProps}>
            Target
          </div>
        </div>
      );
    };

    render(<TestComponent />);

    act(() => {
      screen.getByText("Flash").click();
    });

    const target = screen.getByTestId("target");
    expect(target.style.boxShadow).toContain("rgba(255, 0, 0, 0.5)");
  });
});

// ============================================================================
// Preset Tests
// ============================================================================

describe("FlashPresets", () => {
  it("has default preset with 300ms duration", () => {
    expect(FlashPresets.default.duration).toBe(300);
  });

  it("has success preset with green color", () => {
    expect(FlashPresets.success.color).toContain("34, 197, 94");
  });

  it("has warning preset with amber color", () => {
    expect(FlashPresets.warning.color).toContain("245, 158, 11");
  });

  it("has error preset with red color", () => {
    expect(FlashPresets.error.color).toContain("239, 68, 68");
  });

  it("has quick preset with shorter duration", () => {
    expect(FlashPresets.quick.duration).toBe(150);
  });

  it("has attention preset with longer duration", () => {
    expect(FlashPresets.attention.duration).toBe(500);
  });
});

// ============================================================================
// Utility Tests
// ============================================================================

describe("utility functions", () => {
  describe("createFlashConfig", () => {
    it("merges with defaults", () => {
      const config = createFlashConfig({ duration: 500 });

      expect(config.duration).toBe(500);
      expect(config.color).toBeDefined();
      expect(config.easing).toBeDefined();
    });
  });

  describe("getFlashColor", () => {
    it("returns correct color for variant", () => {
      expect(getFlashColor("success")).toContain("34, 197, 94");
      expect(getFlashColor("error")).toContain("239, 68, 68");
    });
  });
});

// ============================================================================
// Feature #65 Verification Tests
// ============================================================================

describe("Feature #65 verification: Updated sections flash with subtle highlight for 300ms", () => {
  describe("flash with subtle highlight", () => {
    it("applies box-shadow for highlight effect", () => {
      const { rerender } = render(
        <UpdateFlash updateKey="v1">
          <span>Content</span>
        </UpdateFlash>
      );

      act(() => {
        rerender(
          <UpdateFlash updateKey="v2">
            <span>Content</span>
          </UpdateFlash>
        );
      });

      const wrapper = screen.getByText("Content").parentElement;
      expect(wrapper?.style.boxShadow).toContain("inset");
      expect(wrapper?.style.boxShadow).toContain("rgba");
    });

    it("uses subtle opacity (around 0.3)", () => {
      const defaultColor = FlashPresets.default.color;
      expect(defaultColor).toContain("0.3");
    });

    it("highlight is non-intrusive (uses cool blue by default)", () => {
      const defaultColor = FlashPresets.default.color;
      // Blue RGB values (59, 130, 246)
      expect(defaultColor).toContain("59, 130, 246");
    });
  });

  describe("300ms duration", () => {
    it("default duration is exactly 300ms", () => {
      expect(FlashPresets.default.duration).toBe(300);
    });

    it("animation completes in approximately 350ms (50ms peak + 300ms fade)", () => {
      const onFlashEnd = vi.fn();

      const { rerender } = render(
        <UpdateFlash updateKey="v1" onFlashEnd={onFlashEnd}>
          <span>Content</span>
        </UpdateFlash>
      );

      act(() => {
        rerender(
          <UpdateFlash updateKey="v2" onFlashEnd={onFlashEnd}>
            <span>Content</span>
          </UpdateFlash>
        );
      });

      // At 300ms, should not be done yet
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onFlashEnd).not.toHaveBeenCalled();

      // At 350ms, should be done
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(onFlashEnd).toHaveBeenCalledTimes(1);
    });

    it("transitions smoothly with ease-out easing", () => {
      expect(FlashPresets.default.easing).toBe("ease-out");
    });
  });

  describe("complete verification scenario", () => {
    it("provides visual feedback when content updates", () => {
      const onFlashStart = vi.fn();
      const onFlashEnd = vi.fn();

      // Simulate a component that updates
      const { rerender } = render(
        <UpdateFlash
          updateKey="content-v1"
          onFlashStart={onFlashStart}
          onFlashEnd={onFlashEnd}
        >
          <div data-testid="section">
            <h2>Section Title</h2>
            <p>Original content</p>
          </div>
        </UpdateFlash>
      );

      const section = screen.getByTestId("section").parentElement;

      // Initially idle
      expect(section).toHaveAttribute("data-flash-state", "idle");
      expect(section).not.toHaveClass("update-flash--active");

      // Simulate HMR update (content version changes)
      act(() => {
        rerender(
          <UpdateFlash
            updateKey="content-v2"
            onFlashStart={onFlashStart}
            onFlashEnd={onFlashEnd}
          >
            <div data-testid="section">
              <h2>Section Title</h2>
              <p>Updated content</p>
            </div>
          </UpdateFlash>
        );
      });

      // Flash should start
      expect(onFlashStart).toHaveBeenCalledTimes(1);
      expect(section).toHaveClass("update-flash--active");
      expect(section?.style.boxShadow).toBeTruthy();

      // Complete animation (50ms peak + 300ms fade)
      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Flash should end
      expect(onFlashEnd).toHaveBeenCalledTimes(1);
      expect(section).toHaveAttribute("data-flash-state", "idle");
    });

    it("supports multiple sections flashing independently", () => {
      const { rerender } = render(
        <>
          <UpdateFlash updateKey="section1-v1">
            <div data-testid="section1">Section 1</div>
          </UpdateFlash>
          <UpdateFlash updateKey="section2-v1">
            <div data-testid="section2">Section 2</div>
          </UpdateFlash>
        </>
      );

      const section1 = screen.getByTestId("section1").parentElement;
      const section2 = screen.getByTestId("section2").parentElement;

      // Update only section 1
      act(() => {
        rerender(
          <>
            <UpdateFlash updateKey="section1-v2">
              <div data-testid="section1">Section 1 Updated</div>
            </UpdateFlash>
            <UpdateFlash updateKey="section2-v1">
              <div data-testid="section2">Section 2</div>
            </UpdateFlash>
          </>
        );
      });

      // Only section 1 should flash
      expect(section1).toHaveClass("update-flash--active");
      expect(section2).not.toHaveClass("update-flash--active");
    });
  });
});

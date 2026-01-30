/**
 * Tests for ETA Calculator
 *
 * Feature #99: Implement estimated time remaining calculation
 * Verification: Shows 'Estimated: ~30s remaining' based on steps completed vs total
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ETACalculator,
  createETACalculator,
  formatDuration,
  formatTime,
  roundForDisplay,
  type StepTiming,
  type ETAState,
  type ETADisplay,
} from "../../lib/preview/eta-calculator";

describe("ETACalculator", () => {
  let calculator: ETACalculator;

  beforeEach(() => {
    vi.useFakeTimers();
    calculator = new ETACalculator(10);
  });

  afterEach(() => {
    calculator.dispose();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      expect(calculator.getTotalSteps()).toBe(10);
      expect(calculator.getCompletedSteps()).toBe(0);
      expect(calculator.isActive()).toBe(false);
    });

    it("should enforce minimum of 1 step", () => {
      const calc = new ETACalculator(0);
      expect(calc.getTotalSteps()).toBe(1);
      calc.dispose();
    });

    it("should accept custom options", () => {
      const calc = new ETACalculator(5, {
        smoothingFactor: 0.5,
        minSamples: 2,
        defaultStepDuration: 10000,
      });
      expect(calc.getTotalSteps()).toBe(5);
      calc.dispose();
    });
  });

  describe("start", () => {
    it("should start the calculation", () => {
      calculator.start();

      expect(calculator.isActive()).toBe(true);
      expect(calculator.getCompletedSteps()).toBe(0);
    });

    it("should reset state when started", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");
      calculator.completeStep(0);

      calculator.start();

      expect(calculator.getCompletedSteps()).toBe(0);
      expect(calculator.getCurrentStepIndex()).toBe(-1);
    });

    it("should notify callbacks", () => {
      const callback = vi.fn();
      calculator.onUpdate(callback);

      calculator.start();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("should reset to initial state", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");
      calculator.completeStep(0);

      calculator.reset();

      expect(calculator.isActive()).toBe(false);
      expect(calculator.getCompletedSteps()).toBe(0);
      expect(calculator.getCurrentStepIndex()).toBe(-1);
    });
  });

  describe("startStep", () => {
    it("should start a step", () => {
      calculator.start();
      calculator.startStep(0, "Reading files");

      expect(calculator.getCurrentStepIndex()).toBe(0);

      const timing = calculator.getStepTiming(0);
      expect(timing?.name).toBe("Reading files");
      expect(timing?.startedAt).toBeDefined();
    });

    it("should auto-complete previous step when starting new one", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");

      vi.advanceTimersByTime(1000);

      calculator.startStep(1, "Step 2");

      expect(calculator.getCompletedSteps()).toBe(1);
      expect(calculator.getCurrentStepIndex()).toBe(1);

      const timing0 = calculator.getStepTiming(0);
      expect(timing0?.completedAt).toBeDefined();
      expect(timing0?.duration).toBe(1000);
    });

    it("should accept custom weight", () => {
      calculator.start();
      calculator.startStep(0, "Heavy step", 2);

      const timing = calculator.getStepTiming(0);
      expect(timing?.weight).toBe(2);
    });

    it("should ignore invalid step indices", () => {
      calculator.start();
      calculator.startStep(-1, "Invalid");
      calculator.startStep(100, "Also invalid");

      expect(calculator.getCurrentStepIndex()).toBe(-1);
    });

    it("should not start steps after disposal", () => {
      calculator.dispose();
      calculator.start();
      calculator.startStep(0, "Step 1");

      expect(calculator.getCurrentStepIndex()).toBe(-1);
    });
  });

  describe("completeStep", () => {
    it("should complete a step", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");

      vi.advanceTimersByTime(2000);

      calculator.completeStep(0);

      expect(calculator.getCompletedSteps()).toBe(1);

      const timing = calculator.getStepTiming(0);
      expect(timing?.completedAt).toBeDefined();
      expect(timing?.duration).toBe(2000);
    });

    it("should update moving average", () => {
      calculator.start();

      // Complete first step in 2 seconds
      calculator.startStep(0, "Step 1");
      vi.advanceTimersByTime(2000);
      calculator.completeStep(0);

      // Complete second step in 4 seconds
      calculator.startStep(1, "Step 2");
      vi.advanceTimersByTime(4000);
      calculator.completeStep(1);

      const state = calculator.getState();
      // Moving average should reflect completed steps
      expect(state.averageStepDuration).toBeGreaterThan(0);
    });

    it("should not complete non-existent step", () => {
      calculator.start();
      calculator.completeStep(0);

      expect(calculator.getCompletedSteps()).toBe(0);
    });

    it("should not complete already completed step", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");
      calculator.completeStep(0);
      calculator.completeStep(0);

      expect(calculator.getCompletedSteps()).toBe(1);
    });
  });

  describe("setStepWeights", () => {
    it("should set weights for existing steps", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");
      calculator.startStep(1, "Step 2");
      calculator.startStep(2, "Step 3");

      calculator.setStepWeights([1, 2, 3]);

      expect(calculator.getStepTiming(0)?.weight).toBe(1);
      expect(calculator.getStepTiming(1)?.weight).toBe(2);
      expect(calculator.getStepTiming(2)?.weight).toBe(3);
    });
  });

  describe("getState", () => {
    it("should return initial state when not active", () => {
      const state = calculator.getState();

      expect(state.totalSteps).toBe(10);
      expect(state.completedSteps).toBe(0);
      expect(state.currentStep).toBe(-1);
      expect(state.progress).toBe(0);
      expect(state.elapsedTime).toBe(0);
      expect(state.isActive).toBe(false);
      expect(state.isComplete).toBe(false);
    });

    it("should return active state with progress", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");

      vi.advanceTimersByTime(1000);
      calculator.completeStep(0);

      calculator.startStep(1, "Step 2");
      vi.advanceTimersByTime(500);

      const state = calculator.getState();

      expect(state.isActive).toBe(true);
      expect(state.completedSteps).toBe(1);
      expect(state.currentStep).toBe(1);
      expect(state.progress).toBe(10);
      expect(state.elapsedTime).toBe(1500);
    });

    it("should calculate remaining time", () => {
      calculator.start();

      // Complete 3 steps at 1 second each
      for (let i = 0; i < 3; i++) {
        calculator.startStep(i, `Step ${i + 1}`);
        vi.advanceTimersByTime(1000);
        calculator.completeStep(i);
      }

      const state = calculator.getState();

      // 7 remaining steps, average ~1s each = ~7s remaining
      expect(state.remainingTime).toBeGreaterThan(0);
      expect(state.estimatedTotalTime).toBeGreaterThan(state.elapsedTime);
    });

    it("should return zero remaining time when complete", () => {
      const smallCalc = new ETACalculator(2);
      smallCalc.start();

      smallCalc.startStep(0, "Step 1");
      vi.advanceTimersByTime(1000);
      smallCalc.completeStep(0);

      smallCalc.startStep(1, "Step 2");
      vi.advanceTimersByTime(1000);
      smallCalc.completeStep(1);

      const state = smallCalc.getState();

      expect(state.isComplete).toBe(true);
      expect(state.remainingTime).toBe(0);
      expect(state.progress).toBe(100);

      smallCalc.dispose();
    });
  });

  describe("getDisplay", () => {
    it("should show calculating when not enough data", () => {
      calculator = new ETACalculator(10, { minSamples: 2 });
      calculator.start();

      const display = calculator.getDisplay();

      expect(display.available).toBe(false);
      expect(display.medium).toBe("Calculating...");
    });

    it("should show formatted ETA after completing steps", () => {
      calculator.start();

      // Complete one step in 5 seconds
      calculator.startStep(0, "Step 1");
      vi.advanceTimersByTime(5000);
      calculator.completeStep(0);

      calculator.startStep(1, "Step 2");

      const display = calculator.getDisplay();

      expect(display.available).toBe(true);
      expect(display.short).toMatch(/^~\d+s$/);
      expect(display.medium).toContain("remaining");
      expect(display.long).toContain("Estimated:");
    });

    it("should show progress format", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");
      vi.advanceTimersByTime(1000);
      calculator.completeStep(0);

      const display = calculator.getDisplay();

      expect(display.progress).toBe("1/10 steps (10%)");
    });

    it("should show completion time", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");
      vi.advanceTimersByTime(1000);
      calculator.completeStep(0);

      calculator.startStep(1, "Step 2");

      const display = calculator.getDisplay();

      expect(display.completionTime).toContain("Complete at");
    });

    it("should show Complete when finished", () => {
      const smallCalc = new ETACalculator(1);
      smallCalc.start();
      smallCalc.startStep(0, "Step 1");
      vi.advanceTimersByTime(1000);
      smallCalc.completeStep(0);

      const display = smallCalc.getDisplay();

      expect(display.long).toBe("Complete");

      smallCalc.dispose();
    });
  });

  describe("complete", () => {
    it("should stop the update timer", () => {
      calculator.start();
      calculator.complete();

      expect(calculator.isActive()).toBe(true); // Still has start time
    });
  });

  describe("getAllTimings", () => {
    it("should return all step timings", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");
      calculator.startStep(1, "Step 2");
      calculator.startStep(2, "Step 3");

      const timings = calculator.getAllTimings();

      expect(timings).toHaveLength(3);
      expect(timings.map((t) => t.name)).toEqual([
        "Step 1",
        "Step 2",
        "Step 3",
      ]);
    });
  });

  describe("isComplete", () => {
    it("should return true when all steps completed", () => {
      const smallCalc = new ETACalculator(2);
      smallCalc.start();

      expect(smallCalc.isComplete()).toBe(false);

      smallCalc.startStep(0, "Step 1");
      smallCalc.completeStep(0);

      expect(smallCalc.isComplete()).toBe(false);

      smallCalc.startStep(1, "Step 2");
      smallCalc.completeStep(1);

      expect(smallCalc.isComplete()).toBe(true);

      smallCalc.dispose();
    });
  });

  describe("onUpdate", () => {
    it("should register callback", () => {
      const callback = vi.fn();
      calculator.onUpdate(callback);

      calculator.start();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
        expect.objectContaining({ progress: expect.any(String) })
      );
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = calculator.onUpdate(callback);

      calculator.start();
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      calculator.startStep(0, "Step 1");
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle callback errors gracefully", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });
      const normalCallback = vi.fn();

      calculator.onUpdate(errorCallback);
      calculator.onUpdate(normalCallback);

      expect(() => calculator.start()).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });

    it("should call callbacks on step events", () => {
      const callback = vi.fn();
      calculator.onUpdate(callback);

      calculator.start();
      callback.mockClear();

      calculator.startStep(0, "Step 1");
      expect(callback).toHaveBeenCalled();

      callback.mockClear();
      calculator.completeStep(0);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe("periodic updates", () => {
    it("should trigger updates at interval", () => {
      calculator = new ETACalculator(10, { updateInterval: 500 });
      const callback = vi.fn();
      calculator.onUpdate(callback);

      calculator.start();
      expect(callback).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(500);
      expect(callback).toHaveBeenCalledTimes(3);

      calculator.dispose();
    });

    it("should stop updates after reset", () => {
      calculator = new ETACalculator(10, { updateInterval: 500 });
      const callback = vi.fn();
      calculator.onUpdate(callback);

      calculator.start();
      callback.mockClear();

      calculator.reset();

      vi.advanceTimersByTime(1000);
      // Only reset notification, no periodic updates
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("dispose", () => {
    it("should prevent further updates", () => {
      const callback = vi.fn();
      calculator.onUpdate(callback);

      calculator.dispose();
      calculator.start();

      expect(callback).not.toHaveBeenCalled();
    });

    it("should be idempotent", () => {
      expect(() => {
        calculator.dispose();
        calculator.dispose();
      }).not.toThrow();
    });

    it("should clear all state", () => {
      calculator.start();
      calculator.startStep(0, "Step 1");

      calculator.dispose();

      expect(calculator.getAllTimings()).toHaveLength(0);
    });
  });
});

describe("createETACalculator", () => {
  it("should create instance with factory function", () => {
    const calc = createETACalculator(5, { smoothingFactor: 0.5 });

    expect(calc).toBeInstanceOf(ETACalculator);
    expect(calc.getTotalSteps()).toBe(5);

    calc.dispose();
  });
});

describe("formatDuration", () => {
  it("should format seconds", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(1000)).toBe("1s");
    expect(formatDuration(30000)).toBe("30s");
    expect(formatDuration(59000)).toBe("59s");
  });

  it("should format minutes", () => {
    expect(formatDuration(60000)).toBe("1m");
    expect(formatDuration(90000)).toBe("1m 30s");
    expect(formatDuration(120000)).toBe("2m");
    expect(formatDuration(3599000)).toBe("59m 59s");
  });

  it("should format hours", () => {
    expect(formatDuration(3600000)).toBe("1h");
    expect(formatDuration(5400000)).toBe("1h 30m");
    expect(formatDuration(7200000)).toBe("2h");
  });

  it("should handle negative values", () => {
    expect(formatDuration(-1000)).toBe("0s");
  });
});

describe("formatTime", () => {
  it("should format timestamp to locale time", () => {
    const timestamp = new Date("2024-01-15T14:30:00").getTime();
    const result = formatTime(timestamp);

    // Should contain hour and minute
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("roundForDisplay", () => {
  it("should round to nearest second for small values", () => {
    expect(roundForDisplay(1234)).toBe(1000);
    expect(roundForDisplay(4567)).toBe(5000);
  });

  it("should round to nearest 5 seconds for medium values", () => {
    expect(roundForDisplay(12000)).toBe(10000);
    expect(roundForDisplay(18000)).toBe(20000);
  });

  it("should round to nearest 15 seconds for larger values", () => {
    expect(roundForDisplay(67000)).toBe(60000);
    expect(roundForDisplay(82000)).toBe(75000);
  });

  it("should round to nearest minute for large values", () => {
    expect(roundForDisplay(350000)).toBe(360000);
    expect(roundForDisplay(500000)).toBe(480000);
  });
});

describe("weighted average calculation", () => {
  it("should use weighted average for remaining time", () => {
    vi.useFakeTimers();

    const calc = new ETACalculator(4, { useWeightedAverage: true });
    calc.start();

    // Complete step with weight 1 in 1 second
    calc.startStep(0, "Light step", 1);
    vi.advanceTimersByTime(1000);
    calc.completeStep(0);

    // Complete step with weight 2 in 2 seconds
    calc.startStep(1, "Heavy step", 2);
    vi.advanceTimersByTime(2000);
    calc.completeStep(1);

    // Start next step
    calc.startStep(2, "Next step");

    const state = calc.getState();
    expect(state.remainingTime).toBeGreaterThan(0);

    calc.dispose();
    vi.useRealTimers();
  });

  it("should use simple average when weighted disabled", () => {
    vi.useFakeTimers();

    const calc = new ETACalculator(4, { useWeightedAverage: false });
    calc.start();

    calc.startStep(0, "Step 1");
    vi.advanceTimersByTime(2000);
    calc.completeStep(0);

    calc.startStep(1, "Step 2");

    const state = calc.getState();
    // Should use moving average * remaining steps
    expect(state.remainingTime).toBeGreaterThan(0);

    calc.dispose();
    vi.useRealTimers();
  });
});

describe("ETA display verification", () => {
  it("should show 'Estimated: ~30s remaining' format", () => {
    vi.useFakeTimers();

    // Create calculator with 10 steps
    const calc = new ETACalculator(10, { defaultStepDuration: 5000 });
    calc.start();

    // Complete 4 steps at 5 seconds each
    for (let i = 0; i < 4; i++) {
      calc.startStep(i, `Step ${i + 1}`);
      vi.advanceTimersByTime(5000);
      calc.completeStep(i);
    }

    // Start step 5
    calc.startStep(4, "Step 5");

    const display = calc.getDisplay();

    // Should show format matching feature requirement
    expect(display.long).toMatch(/^Estimated: ~\d+s remaining$/);
    expect(display.available).toBe(true);

    // 6 remaining steps at ~5s each = ~30s
    expect(display.remainingMs).toBeGreaterThanOrEqual(25000);
    expect(display.remainingMs).toBeLessThanOrEqual(35000);

    calc.dispose();
    vi.useRealTimers();
  });

  it("should show progress as 'X/Y steps (Z%)'", () => {
    vi.useFakeTimers();

    const calc = new ETACalculator(10);
    calc.start();

    calc.startStep(0, "Step 1");
    vi.advanceTimersByTime(1000);
    calc.completeStep(0);

    calc.startStep(1, "Step 2");
    vi.advanceTimersByTime(1000);
    calc.completeStep(1);

    calc.startStep(2, "Step 3");
    vi.advanceTimersByTime(1000);
    calc.completeStep(2);

    const display = calc.getDisplay();

    expect(display.progress).toBe("3/10 steps (30%)");

    calc.dispose();
    vi.useRealTimers();
  });
});

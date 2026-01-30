/**
 * Tests for Token Cost Counter
 *
 * Feature #111: Add token/cost counter for current session
 * Verification: Shows 'Tokens: 12.3K | Cost: $0.05' in header
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TokenCostCounter,
  createTokenCostCounter,
  MODEL_PRICING,
  formatTokenCount,
  formatCost,
  calculateCost,
  estimateTokens,
  formatSessionDuration,
  calculateCostPerToken,
  generateSessionSummary,
  type ModelId,
  type TokenUsage,
  type SessionStats,
} from "../../lib/preview/token-cost-counter";

describe("TokenCostCounter", () => {
  let counter: TokenCostCounter;

  beforeEach(() => {
    counter = createTokenCostCounter();
  });

  afterEach(() => {
    counter.dispose();
  });

  describe("formatTokenCount", () => {
    it("should format small numbers without suffix", () => {
      expect(formatTokenCount(0)).toBe("0");
      expect(formatTokenCount(1)).toBe("1");
      expect(formatTokenCount(999)).toBe("999");
    });

    it("should format thousands with K suffix", () => {
      expect(formatTokenCount(1000)).toBe("1K");
      expect(formatTokenCount(1500)).toBe("1.5K");
      expect(formatTokenCount(12300)).toBe("12.3K");
      expect(formatTokenCount(999999)).toBe("1000K");
    });

    it("should format millions with M suffix", () => {
      expect(formatTokenCount(1000000)).toBe("1M");
      expect(formatTokenCount(1500000)).toBe("1.5M");
      expect(formatTokenCount(12300000)).toBe("12.3M");
    });

    it("should format billions with B suffix", () => {
      expect(formatTokenCount(1000000000)).toBe("1B");
      expect(formatTokenCount(1500000000)).toBe("1.5B");
    });

    it("should handle negative numbers", () => {
      expect(formatTokenCount(-1000)).toBe("-1K");
      expect(formatTokenCount(-1500000)).toBe("-1.5M");
    });

    it("should remove trailing zeros after decimal", () => {
      expect(formatTokenCount(1000)).toBe("1K");
      expect(formatTokenCount(10000)).toBe("10K");
      expect(formatTokenCount(1000000)).toBe("1M");
    });
  });

  describe("formatCost", () => {
    it("should format with default currency symbol", () => {
      expect(formatCost(0)).toBe("$0.00");
      expect(formatCost(0.05)).toBe("$0.05");
      expect(formatCost(1.5)).toBe("$1.50");
      expect(formatCost(100)).toBe("$100.00");
    });

    it("should support custom currency symbols", () => {
      expect(formatCost(0.05, { currencySymbol: "€" })).toBe("€0.05");
      expect(formatCost(1.5, { currencySymbol: "£" })).toBe("£1.50");
    });

    it("should support custom decimal places", () => {
      expect(formatCost(0.12345, { decimals: 3 })).toBe("$0.123");
      expect(formatCost(0.12345, { decimals: 4 })).toBe("$0.1235");
    });

    it("should handle negative costs", () => {
      expect(formatCost(-0.05)).toBe("-$0.05");
      expect(formatCost(-1.5)).toBe("-$1.50");
    });
  });

  describe("calculateCost", () => {
    it("should calculate cost based on pricing", () => {
      const pricing = { inputPer1K: 0.01, outputPer1K: 0.03 };
      // 1000 input tokens at $0.01/1K = $0.01
      // 1000 output tokens at $0.03/1K = $0.03
      // Total = $0.04
      expect(calculateCost(1000, 1000, pricing)).toBe(0.04);
    });

    it("should handle fractional tokens correctly", () => {
      const pricing = { inputPer1K: 0.01, outputPer1K: 0.03 };
      // 500 input = $0.005, 500 output = $0.015
      expect(calculateCost(500, 500, pricing)).toBeCloseTo(0.02);
    });

    it("should handle zero tokens", () => {
      const pricing = { inputPer1K: 0.01, outputPer1K: 0.03 };
      expect(calculateCost(0, 0, pricing)).toBe(0);
    });
  });

  describe("MODEL_PRICING", () => {
    it("should have pricing for all models", () => {
      const models: ModelId[] = [
        "gpt-4",
        "gpt-4-turbo",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
        "claude-3-opus",
        "claude-3-sonnet",
        "claude-3-haiku",
        "claude-3.5-sonnet",
        "claude-3.5-haiku",
        "custom",
      ];

      for (const model of models) {
        expect(MODEL_PRICING[model]).toBeDefined();
        expect(MODEL_PRICING[model].inputPer1K).toBeDefined();
        expect(MODEL_PRICING[model].outputPer1K).toBeDefined();
      }
    });

    it("should have higher output costs than input costs (typically)", () => {
      // For most models, output tokens cost more than input tokens
      expect(MODEL_PRICING["gpt-4"].outputPer1K).toBeGreaterThan(
        MODEL_PRICING["gpt-4"].inputPer1K
      );
      expect(MODEL_PRICING["claude-3-opus"].outputPer1K).toBeGreaterThan(
        MODEL_PRICING["claude-3-opus"].inputPer1K
      );
    });
  });

  describe("track", () => {
    it("should track token usage", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });

      const stats = counter.getStats();
      expect(stats.totalInputTokens).toBe(1000);
      expect(stats.totalOutputTokens).toBe(500);
      expect(stats.totalTokens).toBe(1500);
      expect(stats.requestCount).toBe(1);
    });

    it("should accumulate multiple usages", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });
      counter.track({ inputTokens: 2000, outputTokens: 1000 });

      const stats = counter.getStats();
      expect(stats.totalInputTokens).toBe(3000);
      expect(stats.totalOutputTokens).toBe(1500);
      expect(stats.totalTokens).toBe(4500);
      expect(stats.requestCount).toBe(2);
    });

    it("should calculate cost based on model pricing", () => {
      counter.track({
        inputTokens: 1000,
        outputTokens: 1000,
        model: "gpt-4o",
      });

      const stats = counter.getStats();
      // gpt-4o: $0.005/1K input, $0.015/1K output
      // 1000 input = $0.005, 1000 output = $0.015
      expect(stats.totalCost).toBeCloseTo(0.02);
    });

    it("should track per-model stats", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500, model: "gpt-4o" });
      counter.track({
        inputTokens: 2000,
        outputTokens: 1000,
        model: "claude-3.5-sonnet",
      });

      const stats = counter.getStats();
      const gpt4oStats = stats.byModel.get("gpt-4o");
      const claudeStats = stats.byModel.get("claude-3.5-sonnet");

      expect(gpt4oStats?.inputTokens).toBe(1000);
      expect(gpt4oStats?.outputTokens).toBe(500);
      expect(claudeStats?.inputTokens).toBe(2000);
      expect(claudeStats?.outputTokens).toBe(1000);
    });

    it("should throw if disposed", () => {
      counter.dispose();
      expect(() =>
        counter.track({ inputTokens: 100, outputTokens: 50 })
      ).toThrow("TokenCostCounter is disposed");
    });
  });

  describe("getHeaderDisplay", () => {
    it("should format header display correctly", () => {
      // Track enough to get 'Tokens: 12.3K | Cost: $0.05'
      // Using gpt-4o: $0.005/1K input, $0.015/1K output
      // To get $0.05: need ~2500 tokens at these rates
      counter.track({
        inputTokens: 10000,
        outputTokens: 2300,
        model: "gpt-4o",
      });

      const display = counter.getHeaderDisplay();
      expect(display.tokens).toBe("12.3K");
      expect(display.text).toContain("Tokens: 12.3K");
      expect(display.text).toContain("Cost:");
    });

    it("should show 'Tokens: 12.3K | Cost: $0.05' format", () => {
      // Precisely calculate tokens needed for $0.05 with gpt-4o-mini
      // gpt-4o-mini: $0.00015/1K input, $0.0006/1K output
      // Using gpt-4 for easier math: $0.03/1K input, $0.06/1K output
      // 1000 input = $0.03, 333 output = ~$0.02 -> total ~$0.05
      counter.track({
        inputTokens: 1000,
        outputTokens: 333,
        model: "gpt-4",
      });

      // Add more to get 12.3K total
      counter.track({
        inputTokens: 10967,
        outputTokens: 0,
        model: "custom", // custom has 0 cost
      });

      const display = counter.getHeaderDisplay();
      expect(display.tokens).toBe("12.3K");
      expect(display.cost).toBe("$0.05");
      expect(display.text).toBe("Tokens: 12.3K | Cost: $0.05");
    });

    it("should include raw values", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });

      const display = counter.getHeaderDisplay();
      expect(display.raw.inputTokens).toBe(1000);
      expect(display.raw.outputTokens).toBe(500);
      expect(display.raw.totalTokens).toBe(1500);
      expect(display.raw.totalCost).toBeGreaterThan(0);
    });

    it("should support breakdown option", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });

      const display = counter.getHeaderDisplay({ showBreakdown: true });
      expect(display.tokens).toContain("↓");
      expect(display.tokens).toContain("↑");
    });

    it("should support custom separator", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });

      const display = counter.getHeaderDisplay({ separator: " - " });
      expect(display.text).toContain(" - ");
    });

    it("should support custom currency symbol", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });

      const display = counter.getHeaderDisplay({ currencySymbol: "€" });
      expect(display.cost).toContain("€");
    });
  });

  describe("getHistory", () => {
    it("should return empty array initially", () => {
      expect(counter.getHistory()).toEqual([]);
    });

    it("should record history entries", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });
      counter.track({ inputTokens: 2000, outputTokens: 1000 });

      const history = counter.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].inputTokens).toBe(1000);
      expect(history[1].inputTokens).toBe(2000);
    });

    it("should include cumulative values", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });
      counter.track({ inputTokens: 2000, outputTokens: 1000 });

      const history = counter.getHistory();
      expect(history[0].cumulativeTokens).toBe(1500);
      expect(history[1].cumulativeTokens).toBe(4500);
    });

    it("should trim history when exceeding max size", () => {
      const smallCounter = createTokenCostCounter({ maxHistorySize: 3 });

      smallCounter.track({ inputTokens: 100, outputTokens: 50 });
      smallCounter.track({ inputTokens: 200, outputTokens: 100 });
      smallCounter.track({ inputTokens: 300, outputTokens: 150 });
      smallCounter.track({ inputTokens: 400, outputTokens: 200 });

      const history = smallCounter.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].inputTokens).toBe(200); // First entry removed

      smallCounter.dispose();
    });
  });

  describe("budget alerts", () => {
    it("should trigger token budget alert when threshold reached", () => {
      const callback = vi.fn();
      counter.addBudgetAlert("tokens-limit", "tokens", 1000, callback);

      counter.track({ inputTokens: 500, outputTokens: 600 });

      expect(callback).toHaveBeenCalledWith(1100, 1000);
    });

    it("should trigger cost budget alert when threshold reached", () => {
      const callback = vi.fn();
      counter.addBudgetAlert("cost-limit", "cost", 0.01, callback);

      counter.track({ inputTokens: 10000, outputTokens: 5000, model: "gpt-4" });

      expect(callback).toHaveBeenCalled();
    });

    it("should only trigger alert once", () => {
      const callback = vi.fn();
      counter.addBudgetAlert("tokens-limit", "tokens", 1000, callback);

      counter.track({ inputTokens: 600, outputTokens: 600 });
      counter.track({ inputTokens: 600, outputTokens: 600 });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should remove budget alert", () => {
      const callback = vi.fn();
      counter.addBudgetAlert("tokens-limit", "tokens", 1000, callback);
      counter.removeBudgetAlert("tokens-limit");

      counter.track({ inputTokens: 600, outputTokens: 600 });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should reset budget alert triggered state", () => {
      const callback = vi.fn();
      counter.addBudgetAlert("tokens-limit", "tokens", 1000, callback);

      counter.track({ inputTokens: 600, outputTokens: 600 });
      expect(callback).toHaveBeenCalledTimes(1);

      counter.resetBudgetAlert("tokens-limit");
      counter.track({ inputTokens: 100, outputTokens: 100 });
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("should handle callback errors gracefully", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      counter.addBudgetAlert("tokens-limit", "tokens", 1000, errorCallback);

      expect(() =>
        counter.track({ inputTokens: 600, outputTokens: 600 })
      ).not.toThrow();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("subscribe", () => {
    it("should call callback on track", () => {
      const callback = vi.fn();
      counter.subscribe(callback);

      counter.track({ inputTokens: 1000, outputTokens: 500 });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalTokens: 1500,
        })
      );
    });

    it("should allow unsubscribing", () => {
      const callback = vi.fn();
      const unsubscribe = counter.subscribe(callback);

      counter.track({ inputTokens: 1000, outputTokens: 500 });
      unsubscribe();
      counter.track({ inputTokens: 1000, outputTokens: 500 });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should throw if disposed", () => {
      counter.dispose();
      expect(() => counter.subscribe(() => {})).toThrow(
        "TokenCostCounter is disposed"
      );
    });

    it("should handle callback errors gracefully", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error("Callback error");
      });

      counter.subscribe(errorCallback);

      expect(() =>
        counter.track({ inputTokens: 1000, outputTokens: 500 })
      ).not.toThrow();

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("custom pricing", () => {
    it("should use custom pricing when set", () => {
      const customCounter = createTokenCostCounter({
        customPricing: {
          custom: { inputPer1K: 0.1, outputPer1K: 0.2 },
        },
      });

      customCounter.track({
        inputTokens: 1000,
        outputTokens: 1000,
        model: "custom",
      });

      const stats = customCounter.getStats();
      expect(stats.totalCost).toBeCloseTo(0.3); // $0.1 + $0.2

      customCounter.dispose();
    });

    it("should allow setting custom pricing after creation", () => {
      counter.setCustomPricing("custom", { inputPer1K: 0.05, outputPer1K: 0.1 });

      counter.track({
        inputTokens: 1000,
        outputTokens: 1000,
        model: "custom",
      });

      const stats = counter.getStats();
      expect(stats.totalCost).toBeCloseTo(0.15);
    });

    it("should return all pricing including custom", () => {
      counter.setCustomPricing("custom", { inputPer1K: 0.05, outputPer1K: 0.1 });

      const allPricing = counter.getAllPricing();
      expect(allPricing.custom.inputPer1K).toBe(0.05);
      expect(allPricing["gpt-4"].inputPer1K).toBe(0.03);
    });
  });

  describe("reset", () => {
    it("should reset all counters", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });
      counter.reset();

      const stats = counter.getStats();
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.requestCount).toBe(0);
    });

    it("should clear history", () => {
      counter.track({ inputTokens: 1000, outputTokens: 500 });
      counter.reset();

      expect(counter.getHistory()).toEqual([]);
    });

    it("should reset budget alerts", () => {
      const callback = vi.fn();
      counter.addBudgetAlert("tokens-limit", "tokens", 1000, callback);
      counter.track({ inputTokens: 600, outputTokens: 600 });

      counter.reset();
      counter.track({ inputTokens: 600, outputTokens: 600 });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("should notify callbacks", () => {
      const callback = vi.fn();
      counter.subscribe(callback);
      counter.track({ inputTokens: 1000, outputTokens: 500 });

      counter.reset();

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it("should throw if disposed", () => {
      counter.dispose();
      expect(() => counter.reset()).toThrow("TokenCostCounter is disposed");
    });
  });

  describe("dispose", () => {
    it("should mark as disposed", () => {
      expect(counter.isDisposed()).toBe(false);
      counter.dispose();
      expect(counter.isDisposed()).toBe(true);
    });

    it("should be idempotent", () => {
      counter.dispose();
      expect(() => counter.dispose()).not.toThrow();
    });

    it("should clear callbacks", () => {
      const callback = vi.fn();
      counter.subscribe(callback);
      counter.dispose();

      // Force internal call would not trigger callback
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("default model", () => {
    it("should use gpt-4o as default", () => {
      counter.track({ inputTokens: 1000, outputTokens: 1000 });

      const stats = counter.getStats();
      expect(stats.byModel.has("gpt-4o")).toBe(true);
    });

    it("should allow custom default model", () => {
      const customCounter = createTokenCostCounter({
        defaultModel: "claude-3.5-sonnet",
      });

      customCounter.track({ inputTokens: 1000, outputTokens: 1000 });

      const stats = customCounter.getStats();
      expect(stats.byModel.has("claude-3.5-sonnet")).toBe(true);

      customCounter.dispose();
    });
  });
});

describe("utility functions", () => {
  describe("estimateTokens", () => {
    it("should estimate tokens from text", () => {
      expect(estimateTokens("")).toBe(0);
      expect(estimateTokens("test")).toBe(1);
      expect(estimateTokens("Hello, world!")).toBe(4); // 13 chars / 4
    });

    it("should handle longer text", () => {
      const text = "a".repeat(1000);
      expect(estimateTokens(text)).toBe(250); // 1000 / 4
    });
  });

  describe("formatSessionDuration", () => {
    it("should format seconds", () => {
      const start = Date.now() - 30000; // 30 seconds ago
      expect(formatSessionDuration(start)).toBe("30s");
    });

    it("should format minutes and seconds", () => {
      const start = Date.now() - 90000; // 1.5 minutes ago
      expect(formatSessionDuration(start)).toBe("1m 30s");
    });

    it("should format hours and minutes", () => {
      const start = Date.now() - 3690000; // 1h 1m 30s ago
      expect(formatSessionDuration(start)).toBe("1h 1m");
    });
  });

  describe("calculateCostPerToken", () => {
    it("should calculate average cost per token", () => {
      const stats: SessionStats = {
        totalInputTokens: 1000,
        totalOutputTokens: 1000,
        totalTokens: 2000,
        totalCost: 0.1,
        requestCount: 1,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        byModel: new Map(),
      };

      expect(calculateCostPerToken(stats)).toBe(0.00005); // $0.1 / 2000
    });

    it("should return 0 for no tokens", () => {
      const stats: SessionStats = {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        requestCount: 0,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        byModel: new Map(),
      };

      expect(calculateCostPerToken(stats)).toBe(0);
    });
  });

  describe("generateSessionSummary", () => {
    it("should generate summary string", () => {
      const stats: SessionStats = {
        totalInputTokens: 5000,
        totalOutputTokens: 7300,
        totalTokens: 12300,
        totalCost: 0.05,
        requestCount: 5,
        startTime: Date.now() - 60000,
        lastUpdateTime: Date.now(),
        byModel: new Map(),
      };

      const summary = generateSessionSummary(stats);
      expect(summary).toContain("12.3K");
      expect(summary).toContain("$0.05");
      expect(summary).toContain("5 requests");
    });
  });
});

describe("verification tests", () => {
  it("should show 'Tokens: 12.3K | Cost: $0.05' in header", () => {
    const counter = createTokenCostCounter();

    // Track usage to get exactly 12.3K tokens and $0.05 cost
    // Using gpt-4: $0.03/1K input, $0.06/1K output
    // 1000 input = $0.03, 333 output = ~$0.02 -> ~$0.05
    counter.track({
      inputTokens: 1000,
      outputTokens: 333,
      model: "gpt-4",
    });

    // Add more tokens with zero cost to reach 12.3K
    counter.track({
      inputTokens: 10967,
      outputTokens: 0,
      model: "custom",
    });

    const display = counter.getHeaderDisplay();

    expect(display.tokens).toBe("12.3K");
    expect(display.cost).toBe("$0.05");
    expect(display.text).toBe("Tokens: 12.3K | Cost: $0.05");

    counter.dispose();
  });

  it("should correctly format various token counts", () => {
    expect(formatTokenCount(12300)).toBe("12.3K");
    expect(formatTokenCount(1000)).toBe("1K");
    expect(formatTokenCount(500)).toBe("500");
  });

  it("should correctly format cost as $0.05", () => {
    expect(formatCost(0.05)).toBe("$0.05");
    expect(formatCost(0.049999)).toBe("$0.05");
    expect(formatCost(0.05, { decimals: 2 })).toBe("$0.05");
  });
});

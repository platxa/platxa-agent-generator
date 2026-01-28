import { describe, it, expect, vi } from "vitest";
import {
  evaluate,
  runFeedbackLoop,
  DEFAULT_QUALITY_GATE,
} from "@/lib/agent-bridge/evaluator-optimizer";
import type {
  EvaluatorFn,
  OptimizerFn,
  QualityGate,
} from "@/lib/agent-bridge/evaluator-optimizer";
import type { QualityReport, PageSectionResult } from "@/lib/agent-bridge/types";

const makeSection = (id = "s_hero"): PageSectionResult => ({
  sectionType: "hero",
  snippetId: id,
  html: `<section class="${id}">content</section>`,
  scss: `.${id} { padding: 2rem; }`,
  isValid: true,
});

const makeQuality = (
  overall: number,
  a11y: number,
  brand: number,
): QualityReport => ({
  overallScore: overall,
  accessibility: { passed: a11y >= 80, totalIssues: 0, score: a11y, issues: [] },
  brandConsistency: brand,
  suggestions: [],
});

describe("Evaluator-Optimizer", () => {
  describe("evaluate", () => {
    it("passes when all scores meet thresholds", () => {
      const result = evaluate(makeQuality(80, 90, 70));
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it("fails when overall score is below threshold", () => {
      const result = evaluate(makeQuality(50, 90, 70));
      expect(result.passed).toBe(false);
      expect(result.failures[0]).toContain("Overall score");
    });

    it("fails when accessibility score is below threshold", () => {
      const result = evaluate(makeQuality(80, 60, 70));
      expect(result.passed).toBe(false);
      expect(result.failures[0]).toContain("Accessibility");
    });

    it("fails when brand consistency is below threshold", () => {
      const result = evaluate(makeQuality(80, 90, 40));
      expect(result.passed).toBe(false);
      expect(result.failures[0]).toContain("Brand consistency");
    });

    it("reports multiple failures", () => {
      const result = evaluate(makeQuality(30, 30, 30));
      expect(result.passed).toBe(false);
      expect(result.failures).toHaveLength(3);
    });

    it("respects custom gate thresholds", () => {
      const gate: QualityGate = {
        minOverallScore: 50,
        minAccessibilityScore: 50,
        minBrandConsistency: 50,
      };
      const result = evaluate(makeQuality(55, 55, 55), gate);
      expect(result.passed).toBe(true);
    });
  });

  describe("DEFAULT_QUALITY_GATE", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_QUALITY_GATE.minOverallScore).toBe(70);
      expect(DEFAULT_QUALITY_GATE.minAccessibilityScore).toBe(80);
      expect(DEFAULT_QUALITY_GATE.minBrandConsistency).toBe(60);
    });
  });

  describe("runFeedbackLoop", () => {
    it("returns immediately if first evaluation passes", async () => {
      const evaluator: EvaluatorFn = async () => makeQuality(90, 95, 85);
      const optimizer: OptimizerFn = vi.fn();

      const result = await runFeedbackLoop(makeSection(), evaluator, optimizer);

      expect(result.passed).toBe(true);
      expect(result.totalIterations).toBe(1);
      expect(optimizer).not.toHaveBeenCalled();
    });

    it("triggers optimizer on failed quality gate", async () => {
      let callCount = 0;
      const evaluator: EvaluatorFn = async () => {
        callCount++;
        // Pass on second evaluation
        return callCount >= 2 ? makeQuality(90, 95, 85) : makeQuality(40, 50, 30);
      };
      const optimizer: OptimizerFn = async (section, failures) => {
        expect(failures.length).toBeGreaterThan(0);
        return makeSection("s_hero_v2");
      };

      const result = await runFeedbackLoop(makeSection(), evaluator, optimizer);

      expect(result.passed).toBe(true);
      expect(result.totalIterations).toBe(2);
    });

    it("stops after maxIterations (default 3)", async () => {
      const evaluator: EvaluatorFn = async () => makeQuality(40, 50, 30);
      const optimizer: OptimizerFn = async (section) => section;

      const result = await runFeedbackLoop(makeSection(), evaluator, optimizer);

      expect(result.passed).toBe(false);
      expect(result.totalIterations).toBe(3);
    });

    it("respects custom maxIterations", async () => {
      const evaluator: EvaluatorFn = async () => makeQuality(40, 50, 30);
      const optimizer: OptimizerFn = async (section) => section;

      const result = await runFeedbackLoop(makeSection(), evaluator, optimizer, {
        maxIterations: 1,
      });

      expect(result.totalIterations).toBe(1);
    });

    it("returns best result when gate never passes", async () => {
      let iteration = 0;
      const evaluator: EvaluatorFn = async () => {
        iteration++;
        // Second iteration has best score
        return iteration === 2 ? makeQuality(65, 75, 55) : makeQuality(40, 50, 30);
      };
      const optimizer: OptimizerFn = async (section, _, i) =>
        makeSection(`s_hero_v${i + 2}`);

      const result = await runFeedbackLoop(makeSection(), evaluator, optimizer, {
        maxIterations: 3,
      });

      expect(result.passed).toBe(false);
      expect(result.finalSection.snippetId).toBe("s_hero_v2"); // best score was iteration 2
    });

    it("calls onIteration callback for each loop", async () => {
      const onIteration = vi.fn();
      const evaluator: EvaluatorFn = async () => makeQuality(90, 95, 85);

      await runFeedbackLoop(makeSection(), evaluator, vi.fn(), { onIteration });

      expect(onIteration).toHaveBeenCalledTimes(1);
      expect(onIteration.mock.calls[0][0].iteration).toBe(0);
    });

    it("tracks total duration across iterations", async () => {
      const evaluator: EvaluatorFn = async () => makeQuality(90, 95, 85);

      const result = await runFeedbackLoop(makeSection(), evaluator, vi.fn());

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("passes iteration index to optimizer", async () => {
      let evalCount = 0;
      const evaluator: EvaluatorFn = async () => {
        evalCount++;
        return evalCount >= 3 ? makeQuality(90, 95, 85) : makeQuality(40, 50, 30);
      };
      const indices: number[] = [];
      const optimizer: OptimizerFn = async (section, _, iteration) => {
        indices.push(iteration);
        return section;
      };

      await runFeedbackLoop(makeSection(), evaluator, optimizer, { maxIterations: 3 });

      expect(indices).toEqual([0, 1]);
    });
  });
});

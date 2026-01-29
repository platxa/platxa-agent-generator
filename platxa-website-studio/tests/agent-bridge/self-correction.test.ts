import { describe, it, expect, vi } from "vitest";
import {
  extractCorrections,
  formatCorrectionsForPrompt,
  runSelfCorrection,
} from "@/lib/agent-bridge/self-correction";
import type { QualityReport, PageSectionResult } from "@/lib/agent-bridge/types";
import type { RegenerateFn } from "@/lib/agent-bridge/self-correction";

const makeSection = (id = "s_hero"): PageSectionResult => ({
  sectionType: "hero",
  snippetId: id,
  html: `<section class="${id}">content</section>`,
  scss: `.${id} { padding: 2rem; }`,
  isValid: true,
  designAnalysis: null,
  themeCss: null,
  accessibilityScore: 100,
  accessibilityIssues: [],
  success: true,
  durationMs: 100,
});

const makeReport = (
  overall: number,
  a11y: number,
  brand: number,
  opts?: { issues?: QualityReport["accessibility"]["issues"]; suggestions?: string[] },
): QualityReport => ({
  overallScore: overall,
  accessibility: {
    passed: a11y >= 80,
    totalIssues: opts?.issues?.length ?? 0,
    score: a11y,
    issues: opts?.issues ?? [],
  },
  brandConsistency: brand,
  suggestions: opts?.suggestions ?? [],
});

describe("Self-Correction", () => {
  describe("extractCorrections", () => {
    it("returns empty for passing scores", () => {
      const corrections = extractCorrections(makeReport(90, 95, 80));
      expect(corrections).toHaveLength(0);
    });

    it("extracts accessibility corrections from issues", () => {
      const corrections = extractCorrections(makeReport(90, 60, 80, {
        issues: [
          { id: "a11y-1", criterion: "1.4.3", level: "AA", rule: "color-contrast", message: "Low contrast ratio", severity: "error", element: "h1" },
        ],
      }));
      expect(corrections.length).toBeGreaterThan(0);
      expect(corrections[0].category).toBe("accessibility");
      expect(corrections[0].severity).toBe("critical");
    });

    it("adds generic a11y correction when no issues but score low", () => {
      const corrections = extractCorrections(makeReport(90, 50, 80));
      expect(corrections.some((c) => c.category === "accessibility")).toBe(true);
    });

    it("extracts brand consistency correction", () => {
      const corrections = extractCorrections(makeReport(90, 95, 30));
      expect(corrections.some((c) => c.category === "brand")).toBe(true);
      expect(corrections.find((c) => c.category === "brand")!.severity).toBe("critical");
    });

    it("marks brand as major when moderately low", () => {
      const corrections = extractCorrections(makeReport(90, 95, 50));
      expect(corrections.find((c) => c.category === "brand")!.severity).toBe("major");
    });

    it("extracts content corrections from suggestions", () => {
      const corrections = extractCorrections(makeReport(50, 95, 80, {
        suggestions: ["Improve heading hierarchy"],
      }));
      expect(corrections.some((c) => c.category === "content")).toBe(true);
    });

    it("sorts by severity: critical first", () => {
      const corrections = extractCorrections(makeReport(50, 50, 30, {
        issues: [
          { id: "a11y-2", criterion: "1.1.1", level: "A", rule: "alt-text", message: "Missing alt", severity: "warning", element: "img" },
          { id: "a11y-3", criterion: "1.4.3", level: "AA", rule: "contrast", message: "Low contrast", severity: "error", element: "p" },
        ],
      }));
      expect(corrections[0].severity).toBe("critical");
    });

    it("respects custom thresholds", () => {
      const corrections = extractCorrections(makeReport(60, 70, 50), {
        minOverallScore: 50,
        minAccessibilityScore: 60,
        minBrandConsistency: 40,
      });
      expect(corrections).toHaveLength(0);
    });
  });

  describe("formatCorrectionsForPrompt", () => {
    it("returns empty string for no corrections", () => {
      expect(formatCorrectionsForPrompt([])).toBe("");
    });

    it("formats corrections as numbered list", () => {
      const formatted = formatCorrectionsForPrompt([
        { category: "accessibility", severity: "critical", description: "Low contrast", suggestion: "Increase contrast ratio" },
        { category: "brand", severity: "major", description: "Wrong colors", suggestion: "Use brand palette" },
      ]);
      expect(formatted).toContain("Quality gate failed");
      expect(formatted).toContain("1. [CRITICAL]");
      expect(formatted).toContain("2. [MAJOR]");
      expect(formatted).toContain("Low contrast");
      expect(formatted).toContain("Fix: Use brand palette");
    });
  });

  describe("runSelfCorrection", () => {
    it("passes immediately if quality gate passes on first evaluation", async () => {
      const result = await runSelfCorrection(
        makeSection(),
        async () => makeReport(90, 95, 80),
        vi.fn(),
      );

      expect(result.passed).toBe(true);
      expect(result.totalAttempts).toBe(1);
      expect(result.unresolvedCorrections).toHaveLength(0);
    });

    it("retries with corrections on failure", async () => {
      let evalCount = 0;
      const evaluateFn = async () => {
        evalCount++;
        return evalCount >= 2 ? makeReport(90, 95, 80) : makeReport(40, 50, 30);
      };
      const regenerateFn: RegenerateFn = async (input) => {
        expect(input.corrections.length).toBeGreaterThan(0);
        expect(input.attempt).toBe(0);
        return makeSection("s_hero_v2");
      };

      const result = await runSelfCorrection(makeSection(), evaluateFn, regenerateFn);

      expect(result.passed).toBe(true);
      expect(result.totalAttempts).toBe(2);
    });

    it("stops after maxAttempts", async () => {
      const result = await runSelfCorrection(
        makeSection(),
        async () => makeReport(40, 50, 30),
        async (input) => makeSection(`v${input.attempt}`),
        { maxAttempts: 2 },
      );

      expect(result.passed).toBe(false);
      expect(result.totalAttempts).toBe(2);
    });

    it("returns best section when gate never passes", async () => {
      let evalCount = 0;
      const result = await runSelfCorrection(
        makeSection(),
        async () => {
          evalCount++;
          return evalCount === 2 ? makeReport(65, 75, 55) : makeReport(40, 50, 30);
        },
        async (input) => makeSection(`s_hero_v${input.attempt + 2}`),
        { maxAttempts: 3 },
      );

      expect(result.passed).toBe(false);
      expect(result.finalSection.snippetId).toBe("s_hero_v2");
    });

    it("reports unresolved corrections on failure", async () => {
      const result = await runSelfCorrection(
        makeSection(),
        async () => makeReport(40, 50, 30),
        async (input) => input.section,
        { maxAttempts: 1 },
      );

      expect(result.unresolvedCorrections.length).toBeGreaterThan(0);
    });

    it("calls onAttempt callback", async () => {
      const onAttempt = vi.fn();
      await runSelfCorrection(
        makeSection(),
        async () => makeReport(90, 95, 80),
        vi.fn(),
        { onAttempt },
      );

      expect(onAttempt).toHaveBeenCalledTimes(1);
      expect(onAttempt.mock.calls[0][0].attempt).toBe(0);
    });

    it("tracks duration per attempt", async () => {
      const result = await runSelfCorrection(
        makeSection(),
        async () => makeReport(90, 95, 80),
        vi.fn(),
      );

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.attempts[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it("feeds quality report to regeneration function", async () => {
      let evalCount = 0;
      const regenerateFn: RegenerateFn = vi.fn(async (input) => {
        expect(input.qualityReport.overallScore).toBe(40);
        expect(input.qualityReport.accessibility.score).toBe(50);
        return makeSection("fixed");
      });

      await runSelfCorrection(
        makeSection(),
        async () => {
          evalCount++;
          return evalCount >= 2 ? makeReport(90, 95, 80) : makeReport(40, 50, 30);
        },
        regenerateFn,
      );

      expect(regenerateFn).toHaveBeenCalledTimes(1);
    });
  });
});

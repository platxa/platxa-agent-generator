import { describe, it, expect, vi } from "vitest";
import {
  decomposePage,
  runWorkers,
  orchestratePage,
} from "@/lib/agent-bridge/orchestrator-workers";
import type {
  SectionTask,
  SectionWorkerFn,
  WorkerResult,
} from "@/lib/agent-bridge/orchestrator-workers";
import type { OdooSectionType, PageSectionResult } from "@/lib/agent-bridge/types";

/** Stub worker that returns a section result after a short delay */
const createStubWorker = (delayMs = 5): SectionWorkerFn => async (task) => {
  await new Promise((r) => setTimeout(r, delayMs));
  return {
    sectionType: task.sectionType,
    snippetId: `s_${task.sectionType}`,
    html: `<section class="s_${task.sectionType}">content</section>`,
    scss: `.s_${task.sectionType} { padding: 2rem; }`,
    isValid: true,
    designAnalysis: null,
    themeCss: null,
    accessibilityScore: 100,
    accessibilityIssues: [],
    success: true,
    durationMs: delayMs,
  };
};

/** Worker that always fails */
const failingWorker: SectionWorkerFn = async () => {
  throw new Error("Worker failure");
};

describe("Orchestrator-Workers", () => {
  describe("decomposePage", () => {
    it("decomposes sections into ordered tasks", () => {
      const tasks = decomposePage(["features", "hero", "footer"]);
      expect(tasks).toHaveLength(3);
      // hero should sort first (priority 0)
      expect(tasks[0].sectionType).toBe("hero");
      expect(tasks[1].sectionType).toBe("features");
      expect(tasks[2].sectionType).toBe("footer");
    });

    it("assigns unique task IDs", () => {
      const tasks = decomposePage(["hero", "features", "cta"]);
      const ids = tasks.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("passes brand tokens to all tasks", () => {
      const tokens = { colors: { primary: "#ff0000" } } as any;
      const tasks = decomposePage(["hero", "footer"], tokens);
      expect(tasks[0].brandTokens).toBe(tokens);
      expect(tasks[1].brandTokens).toBe(tokens);
    });

    it("marks first visual section as above the fold", () => {
      const tasks = decomposePage(["hero", "features"]);
      // hero is priority 0, sorted first
      expect(tasks[0].context).toBe("above the fold");
      expect(tasks[1].context).toBeUndefined();
    });

    it("handles empty sections list", () => {
      expect(decomposePage([])).toEqual([]);
    });
  });

  describe("runWorkers", () => {
    it("executes all tasks and returns results in order", async () => {
      const tasks = decomposePage(["hero", "features", "footer"]);
      const results = await runWorkers(tasks, createStubWorker(1));

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe("completed");
      expect(results[0].section?.sectionType).toBe("hero");
      expect(results[2].section?.sectionType).toBe("footer");
    });

    it("respects concurrency limit", async () => {
      let maxConcurrent = 0;
      let running = 0;

      const trackingWorker: SectionWorkerFn = async (task) => {
        running++;
        maxConcurrent = Math.max(maxConcurrent, running);
        await new Promise((r) => setTimeout(r, 10));
        running--;
        return {
          sectionType: task.sectionType,
          snippetId: `s_${task.sectionType}`,
          html: "<div/>",
          scss: "",
          isValid: true,
          designAnalysis: null,
          themeCss: null,
          accessibilityScore: 100,
          accessibilityIssues: [],
          success: true,
          durationMs: 10,
        };
      };

      const tasks = decomposePage(["hero", "features", "about", "cta", "footer"]);
      await runWorkers(tasks, trackingWorker, { maxConcurrency: 2 });

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it("handles worker failures without crashing", async () => {
      const tasks = decomposePage(["hero", "features"]);
      const results = await runWorkers(tasks, failingWorker);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("failed");
      expect(results[0].error).toContain("Worker failure");
      expect(results[0].section).toBeNull();
    });

    it("calls onTaskStart and onTaskComplete callbacks", async () => {
      const onStart = vi.fn();
      const onComplete = vi.fn();

      const tasks = decomposePage(["hero"]);
      await runWorkers(tasks, createStubWorker(1), {
        onTaskStart: onStart,
        onTaskComplete: onComplete,
      });

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete.mock.calls[0][0].status).toBe("completed");
    });

    it("records duration per task", async () => {
      const tasks = decomposePage(["hero"]);
      const results = await runWorkers(tasks, createStubWorker(5));

      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("orchestratePage", () => {
    it("decomposes, executes, and assembles a full page", async () => {
      const sections: OdooSectionType[] = ["hero", "features", "footer"];
      const result = await orchestratePage(sections, createStubWorker(1));

      expect(result.page.sections).toHaveLength(3);
      expect(result.page.isComplete).toBe(true);
      expect(result.page.combinedHtml).toContain("s_hero");
      expect(result.page.combinedHtml).toContain("s_features");
      expect(result.page.combinedHtml).toContain("s_footer");
      expect(result.page.combinedScss).toContain("s_hero");
      expect(result.workerResults).toHaveLength(3);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("marks page incomplete when workers fail", async () => {
      const result = await orchestratePage(["hero", "features"], failingWorker);

      expect(result.page.isComplete).toBe(false);
      expect(result.page.sections).toHaveLength(0);
      expect(result.workerResults.every((r) => r.status === "failed")).toBe(true);
    });

    it("assembles partial results when some workers fail", async () => {
      let callCount = 0;
      const mixedWorker: SectionWorkerFn = async (task) => {
        callCount++;
        if (callCount === 2) throw new Error("fail");
        return {
          sectionType: task.sectionType,
          snippetId: `s_${task.sectionType}`,
          html: `<section class="s_${task.sectionType}"/>`,
          scss: "",
          isValid: true,
          designAnalysis: null,
          themeCss: null,
          accessibilityScore: 100,
          accessibilityIssues: [],
          success: true,
          durationMs: 5,
        };
      };

      const result = await orchestratePage(
        ["hero", "features", "footer"],
        mixedWorker,
        undefined,
        { maxConcurrency: 1 },
      );

      expect(result.page.isComplete).toBe(false);
      expect(result.page.sections.length).toBe(2); // 2 succeeded
      expect(result.workerResults.filter((r) => r.status === "failed")).toHaveLength(1);
    });

    it("reports parallelism level", async () => {
      const result = await orchestratePage(
        ["hero"],
        createStubWorker(1),
        undefined,
        { maxConcurrency: 5 },
      );
      expect(result.parallelism).toBe(5);
    });
  });
});

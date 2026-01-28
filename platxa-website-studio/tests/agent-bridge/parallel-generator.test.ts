import { describe, it, expect, vi } from "vitest";
import {
  sortByPriority,
  runParallel,
  createTasks,
  DEFAULT_PARALLEL_CONFIG,
} from "@/lib/agent-bridge/parallel-generator";
import type { GenerationTask, SectionGeneratorFn, ProgressEvent } from "@/lib/agent-bridge/parallel-generator";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function makeTasks(n: number): GenerationTask[] {
  return Array.from({ length: n }, (_, i) => ({
    sectionId: `s_${i}`,
    sectionType: `type_${i}`,
    prompt: `Generate section ${i}`,
    priority: i,
  }));
}

const fastGenerator: SectionGeneratorFn = async (task) => {
  await delay(10);
  return { html: `<section>${task.sectionId}</section>`, scss: `.${task.sectionId}{}` };
};

describe("Parallel Generator", () => {
  describe("sortByPriority", () => {
    it("sorts by priority ascending", () => {
      const tasks: GenerationTask[] = [
        { sectionId: "c", sectionType: "cta", prompt: "", priority: 3 },
        { sectionId: "a", sectionType: "hero", prompt: "", priority: 1 },
        { sectionId: "b", sectionType: "feat", prompt: "", priority: 2 },
      ];
      const sorted = sortByPriority(tasks);
      expect(sorted.map((t) => t.sectionId)).toEqual(["a", "b", "c"]);
    });

    it("does not mutate original", () => {
      const tasks = makeTasks(3);
      tasks[0].priority = 9;
      const sorted = sortByPriority(tasks);
      expect(tasks[0].priority).toBe(9);
      expect(sorted[0].priority).not.toBe(9);
    });
  });

  describe("createTasks", () => {
    it("creates tasks from section list", () => {
      const tasks = createTasks([
        { id: "s_hero", type: "hero" },
        { id: "s_feat", type: "features", prompt: "Custom prompt" },
      ]);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].sectionId).toBe("s_hero");
      expect(tasks[0].prompt).toBe("Generate hero section");
      expect(tasks[1].prompt).toBe("Custom prompt");
      expect(tasks[0].priority).toBe(0);
      expect(tasks[1].priority).toBe(1);
    });
  });

  describe("DEFAULT_PARALLEL_CONFIG", () => {
    it("has concurrency of 5", () => {
      expect(DEFAULT_PARALLEL_CONFIG.concurrency).toBe(5);
    });

    it("continues on error by default", () => {
      expect(DEFAULT_PARALLEL_CONFIG.continueOnError).toBe(true);
    });
  });

  describe("runParallel", () => {
    it("generates all sections successfully", async () => {
      const tasks = makeTasks(3);
      const result = await runParallel(tasks, fastGenerator);
      expect(result.successCount).toBe(3);
      expect(result.failCount).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(result.results.every((r) => r.status === "completed")).toBe(true);
    });

    it("returns HTML and SCSS for each section", async () => {
      const tasks = makeTasks(2);
      const result = await runParallel(tasks, fastGenerator);
      expect(result.results[0].html).toContain("<section>");
      expect(result.results[0].scss).toBeDefined();
    });

    it("executes in parallel (5 sections faster than 5x single)", async () => {
      const tasks = makeTasks(5);
      const gen: SectionGeneratorFn = async (task) => {
        await delay(50);
        return { html: task.sectionId, scss: "" };
      };
      const result = await runParallel(tasks, gen, { concurrency: 5, taskTimeoutMs: 5000, continueOnError: true });
      // 5 tasks × 50ms each = 250ms sequential. Parallel should be ~50-100ms.
      expect(result.totalDurationMs).toBeLessThan(200);
      expect(result.parallelismRatio).toBeGreaterThan(1);
    });

    it("respects concurrency limit", async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const trackingGen: SectionGeneratorFn = async (task) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await delay(30);
        currentConcurrent--;
        return { html: task.sectionId, scss: "" };
      };

      const tasks = makeTasks(6);
      await runParallel(tasks, trackingGen, { concurrency: 2, taskTimeoutMs: 5000, continueOnError: true });
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it("isolates failures when continueOnError=true", async () => {
      const failGen: SectionGeneratorFn = async (task) => {
        if (task.sectionId === "s_1") throw new Error("Generation failed");
        await delay(10);
        return { html: task.sectionId, scss: "" };
      };

      const tasks = makeTasks(3);
      const result = await runParallel(tasks, failGen);
      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(1);
      const failed = result.results.find((r) => r.sectionId === "s_1");
      expect(failed!.status).toBe("failed");
      expect(failed!.error).toBe("Generation failed");
    });

    it("records duration per task", async () => {
      const tasks = makeTasks(1);
      const result = await runParallel(tasks, fastGenerator);
      expect(result.results[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(result.results[0].startedAt).toBeTruthy();
      expect(result.results[0].completedAt).toBeTruthy();
    });

    it("emits progress events", async () => {
      const events: ProgressEvent[] = [];
      const tasks = makeTasks(3);
      await runParallel(tasks, fastGenerator, DEFAULT_PARALLEL_CONFIG, (e) => events.push(e));
      // Should have progress events (at least one per task start + complete)
      expect(events.length).toBeGreaterThanOrEqual(3);
      const last = events[events.length - 1];
      expect(last.completed).toBe(3);
      expect(last.progress).toBe(1);
    });

    it("handles empty task list", async () => {
      const result = await runParallel([], fastGenerator);
      expect(result.results).toHaveLength(0);
      expect(result.successCount).toBe(0);
    });

    it("computes parallelism ratio", async () => {
      const tasks = makeTasks(3);
      const gen: SectionGeneratorFn = async (task) => {
        await delay(30);
        return { html: task.sectionId, scss: "" };
      };
      const result = await runParallel(tasks, gen, { concurrency: 3, taskTimeoutMs: 5000, continueOnError: true });
      // sumTaskDurationMs ≈ 90ms, totalDurationMs ≈ 30-60ms → ratio > 1
      expect(result.parallelismRatio).toBeGreaterThan(1);
    });

    it("times out slow tasks", async () => {
      const slowGen: SectionGeneratorFn = async () => {
        await delay(500);
        return { html: "", scss: "" };
      };
      const tasks = makeTasks(1);
      const result = await runParallel(tasks, slowGen, { concurrency: 1, taskTimeoutMs: 50, continueOnError: true });
      expect(result.failCount).toBe(1);
      expect(result.results[0].error).toContain("timed out");
    });
  });
});

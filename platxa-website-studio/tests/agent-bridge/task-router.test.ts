import { describe, it, expect } from "vitest";
import {
  scoreWorker,
  routeTask,
  routeBatch,
  LAYOUT_WORKER,
  CONTENT_WORKER,
  STYLE_WORKER,
  INTERACTION_WORKER,
  DEFAULT_ROUTER_CONFIG,
} from "@/lib/agent-bridge/task-router";
import type { RoutableTask } from "@/lib/agent-bridge/task-router";

describe("Task Router", () => {
  describe("scoreWorker", () => {
    it("scores layout keywords high for layout worker", () => {
      const task: RoutableTask = {
        id: "t1",
        description: "Adjust the grid layout and column spacing",
      };
      const score = scoreWorker(task, LAYOUT_WORKER);
      expect(score).toBeGreaterThan(0.3);
    });

    it("scores content keywords high for content worker", () => {
      const task: RoutableTask = {
        id: "t2",
        description: "Write heading text and feature descriptions",
      };
      const score = scoreWorker(task, CONTENT_WORKER);
      expect(score).toBeGreaterThan(0.3);
    });

    it("scores section type match", () => {
      const task: RoutableTask = {
        id: "t3",
        description: "Generate section",
        sectionType: "hero",
      };
      const score = scoreWorker(task, LAYOUT_WORKER);
      expect(score).toBeGreaterThanOrEqual(0.4);
    });

    it("scores zero for unrelated task", () => {
      const task: RoutableTask = {
        id: "t4",
        description: "Deploy to production",
      };
      expect(scoreWorker(task, LAYOUT_WORKER)).toBe(0);
      expect(scoreWorker(task, CONTENT_WORKER)).toBe(0);
    });

    it("uses tags for scoring", () => {
      const task: RoutableTask = {
        id: "t5",
        description: "Update section",
        tags: ["color", "theme", "palette"],
      };
      const score = scoreWorker(task, STYLE_WORKER);
      expect(score).toBeGreaterThan(0.3);
    });
  });

  describe("routeTask", () => {
    it("routes layout task to layout worker", () => {
      const task: RoutableTask = {
        id: "t1",
        description: "Fix the grid layout and responsive breakpoints",
        sectionType: "hero",
      };
      const decision = routeTask(task);
      expect(decision.worker).toBe("layout");
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.wasOverridden).toBe(false);
    });

    it("routes content task to content worker", () => {
      const task: RoutableTask = {
        id: "t2",
        description: "Write testimonial cards with review text",
        sectionType: "testimonials",
      };
      const decision = routeTask(task);
      expect(decision.worker).toBe("content");
    });

    it("routes style task to style worker", () => {
      const task: RoutableTask = {
        id: "t3",
        description: "Update the color palette and typography theme",
      };
      const decision = routeTask(task);
      expect(decision.worker).toBe("style");
    });

    it("routes interaction task to interaction worker", () => {
      const task: RoutableTask = {
        id: "t4",
        description: "Add carousel slider with swipe animation",
        sectionType: "carousel",
      };
      const decision = routeTask(task);
      expect(decision.worker).toBe("interaction");
    });

    it("respects explicit worker override", () => {
      const task: RoutableTask = {
        id: "t5",
        description: "Some ambiguous task",
        workerOverride: "style",
      };
      const decision = routeTask(task);
      expect(decision.worker).toBe("style");
      expect(decision.confidence).toBe(1);
      expect(decision.wasOverridden).toBe(true);
    });

    it("falls back to default for unrecognized tasks", () => {
      const task: RoutableTask = {
        id: "t6",
        description: "Do something completely unrelated xyz123",
      };
      const decision = routeTask(task);
      expect(decision.worker).toBe("general");
    });

    it("includes reason in decision", () => {
      const task: RoutableTask = {
        id: "t7",
        description: "Update grid layout",
      };
      const decision = routeTask(task);
      expect(decision.reason).toBeTruthy();
      expect(decision.reason.length).toBeGreaterThan(0);
    });
  });

  describe("routeBatch", () => {
    it("routes multiple tasks and groups by worker", () => {
      const tasks: RoutableTask[] = [
        { id: "t1", description: "Fix grid layout", sectionType: "hero" },
        { id: "t2", description: "Write feature descriptions", sectionType: "features" },
        { id: "t3", description: "Update color palette and font theme" },
        { id: "t4", description: "Add carousel animation", sectionType: "carousel" },
      ];
      const result = routeBatch(tasks);
      expect(result.decisions).toHaveLength(4);
      expect(result.groups.size).toBeGreaterThan(0);

      // Layout task should go to layout
      expect(result.decisions[0].worker).toBe("layout");
      // Content task should go to content
      expect(result.decisions[1].worker).toBe("content");
    });

    it("provides distribution summary", () => {
      const tasks: RoutableTask[] = [
        { id: "t1", description: "Fix grid layout", sectionType: "hero" },
        { id: "t2", description: "Fix column spacing responsive" },
        { id: "t3", description: "Write heading text and copy", sectionType: "features" },
      ];
      const result = routeBatch(tasks);
      const total = Object.values(result.distribution).reduce((s, n) => s + n, 0);
      expect(total).toBe(3);
    });

    it("handles empty task list", () => {
      const result = routeBatch([]);
      expect(result.decisions).toHaveLength(0);
      expect(result.groups.size).toBe(0);
    });

    it("groups tasks correctly", () => {
      const tasks: RoutableTask[] = [
        { id: "t1", description: "Layout grid", sectionType: "hero", workerOverride: "layout" },
        { id: "t2", description: "Layout flex", workerOverride: "layout" },
        { id: "t3", description: "Write text", workerOverride: "content" },
      ];
      const result = routeBatch(tasks);
      expect(result.groups.get("layout")).toHaveLength(2);
      expect(result.groups.get("content")).toHaveLength(1);
    });
  });

  describe("worker definitions", () => {
    it("layout worker has structural keywords", () => {
      expect(LAYOUT_WORKER.keywords).toContain("grid");
      expect(LAYOUT_WORKER.keywords).toContain("responsive");
      expect(LAYOUT_WORKER.sectionTypes).toContain("hero");
    });

    it("content worker has text keywords", () => {
      expect(CONTENT_WORKER.keywords).toContain("text");
      expect(CONTENT_WORKER.keywords).toContain("heading");
      expect(CONTENT_WORKER.sectionTypes).toContain("features");
    });

    it("style worker has visual keywords", () => {
      expect(STYLE_WORKER.keywords).toContain("color");
      expect(STYLE_WORKER.keywords).toContain("font");
    });

    it("interaction worker has animation keywords", () => {
      expect(INTERACTION_WORKER.keywords).toContain("animation");
      expect(INTERACTION_WORKER.keywords).toContain("carousel");
    });

    it("default config has all 4 workers", () => {
      expect(DEFAULT_ROUTER_CONFIG.workers).toHaveLength(4);
      expect(DEFAULT_ROUTER_CONFIG.defaultWorker).toBe("general");
    });
  });
});

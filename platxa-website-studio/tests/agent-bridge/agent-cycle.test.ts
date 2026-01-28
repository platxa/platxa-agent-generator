import { describe, it, expect, vi } from "vitest";
import {
  CYCLE_PHASES,
  createCycleContext,
  isComplexRequest,
  determinePhasesToSkip,
  runAgentCycle,
} from "@/lib/agent-bridge/agent-cycle";
import type {
  CyclePhase,
  AgentCycleConfig,
  PlanOutput,
  SearchOutput,
  ReadOutput,
  EditOutput,
  TestOutput,
} from "@/lib/agent-bridge/agent-cycle";

// =============================================================================
// Helpers
// =============================================================================

const makePlan = (overrides?: Partial<PlanOutput>): PlanOutput => ({
  steps: ["step1"],
  targetFiles: ["file.xml"],
  complexity: 3,
  requiresFullCycle: true,
  ...overrides,
});

const makeHandlers = (overrides?: Partial<AgentCycleConfig["handlers"]>): AgentCycleConfig["handlers"] => ({
  plan: async () => makePlan(),
  search: async () => ({
    matchedFiles: ["file.xml"],
    queries: ["find file"],
    results: [{ file: "file.xml", relevance: 0.9 }],
  } satisfies SearchOutput),
  read: async () => ({
    fileContents: { "file.xml": "<div/>" },
    patterns: ["xml-template"],
    totalLinesRead: 1,
  } satisfies ReadOutput),
  edit: async () => ({
    modifications: [{ file: "file.xml", changeType: "modify", description: "updated", linesChanged: 5 }],
    totalFilesChanged: 1,
  } satisfies EditOutput),
  test: async () => ({
    passed: true,
    totalTests: 3,
    passedTests: 3,
    failedTests: 0,
    failures: [],
  } satisfies TestOutput),
  ...overrides,
});

const makeConfig = (overrides?: Partial<AgentCycleConfig>): AgentCycleConfig => ({
  handlers: makeHandlers(),
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe("Agent Cycle", () => {
  describe("CYCLE_PHASES", () => {
    it("defines all 5 phases in order", () => {
      expect(CYCLE_PHASES).toEqual(["plan", "search", "read", "edit", "test"]);
    });
  });

  describe("createCycleContext", () => {
    it("creates context with request and null phase data", () => {
      const ctx = createCycleContext("build a hero section");
      expect(ctx.request).toBe("build a hero section");
      expect(ctx.plan).toBeNull();
      expect(ctx.search).toBeNull();
      expect(ctx.read).toBeNull();
      expect(ctx.edit).toBeNull();
      expect(ctx.test).toBeNull();
    });
  });

  describe("isComplexRequest", () => {
    it("detects complex requests", () => {
      expect(isComplexRequest("refactor the header component")).toBe(true);
      expect(isComplexRequest("implement dark mode")).toBe(true);
      expect(isComplexRequest("create a new page layout")).toBe(true);
      expect(isComplexRequest("generate page for about us")).toBe(true);
    });

    it("detects simple requests", () => {
      expect(isComplexRequest("change color to blue")).toBe(false);
      expect(isComplexRequest("fix typo")).toBe(false);
    });
  });

  describe("determinePhasesToSkip", () => {
    it("skips nothing when full cycle required", () => {
      const plan = makePlan({ requiresFullCycle: true });
      const skipped = determinePhasesToSkip(plan, true);
      expect(skipped.size).toBe(0);
    });

    it("skips search when no target files", () => {
      const plan = makePlan({ requiresFullCycle: false, targetFiles: [] });
      const skipped = determinePhasesToSkip(plan, true);
      expect(skipped.has("search")).toBe(true);
    });

    it("skips read for trivial complexity", () => {
      const plan = makePlan({ requiresFullCycle: false, complexity: 1, targetFiles: ["a.xml"] });
      const skipped = determinePhasesToSkip(plan, true);
      expect(skipped.has("read")).toBe(true);
    });

    it("skips nothing when short-circuit disabled", () => {
      const plan = makePlan({ requiresFullCycle: false, targetFiles: [], complexity: 1 });
      const skipped = determinePhasesToSkip(plan, false);
      expect(skipped.size).toBe(0);
    });
  });

  describe("runAgentCycle", () => {
    it("executes all 5 phases for a complex request", async () => {
      const result = await runAgentCycle("implement new feature", makeConfig());

      expect(result.success).toBe(true);
      expect(result.phasesExecuted).toEqual(["plan", "search", "read", "edit", "test"]);
      expect(result.phasesSkipped).toHaveLength(0);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("populates context with phase data", async () => {
      const result = await runAgentCycle("implement feature", makeConfig());

      expect(result.context.plan).not.toBeNull();
      expect(result.context.search).not.toBeNull();
      expect(result.context.read).not.toBeNull();
      expect(result.context.edit).not.toBeNull();
      expect(result.context.test).not.toBeNull();
    });

    it("calls onPhaseStart and onPhaseComplete callbacks", async () => {
      const onStart = vi.fn();
      const onComplete = vi.fn();

      await runAgentCycle("implement feature", makeConfig({
        onPhaseStart: onStart,
        onPhaseComplete: onComplete,
      }));

      expect(onStart).toHaveBeenCalledTimes(5);
      expect(onComplete).toHaveBeenCalledTimes(5);
      expect(onStart.mock.calls[0]).toEqual(["plan", 0]);
      expect(onStart.mock.calls[4]).toEqual(["test", 4]);
    });

    it("stops on phase failure and marks unsuccessful", async () => {
      const config = makeConfig({
        handlers: makeHandlers({
          search: async () => { throw new Error("search failed"); },
        }),
      });

      const result = await runAgentCycle("implement feature", config);

      expect(result.success).toBe(false);
      expect(result.phasesExecuted).toEqual(["plan", "search"]);
      expect(result.results["search"].status).toBe("failed");
      expect(result.results["search"].error).toBe("search failed");
    });

    it("skips phases when allowShortCircuit and plan says not full cycle", async () => {
      const config = makeConfig({
        allowShortCircuit: true,
        handlers: makeHandlers({
          plan: async () => makePlan({
            requiresFullCycle: false,
            targetFiles: [],
            complexity: 1,
          }),
        }),
      });

      const result = await runAgentCycle("simple change", config);

      expect(result.phasesSkipped).toContain("search");
      expect(result.phasesSkipped).toContain("read");
      expect(result.results["search"].status).toBe("skipped");
      expect(result.results["read"].status).toBe("skipped");
    });

    it("records duration per phase", async () => {
      const result = await runAgentCycle("implement feature", makeConfig());

      for (const phase of CYCLE_PHASES) {
        expect(result.results[phase].durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it("passes accumulated context to later phases", async () => {
      const readHandler = vi.fn(async (ctx) => {
        // By the time read runs, plan and search should be populated
        expect(ctx.plan).not.toBeNull();
        expect(ctx.search).not.toBeNull();
        return {
          fileContents: {},
          patterns: [],
          totalLinesRead: 0,
        } satisfies ReadOutput;
      });

      await runAgentCycle("implement feature", makeConfig({
        handlers: makeHandlers({ read: readHandler }),
      }));

      expect(readHandler).toHaveBeenCalledTimes(1);
    });
  });
});

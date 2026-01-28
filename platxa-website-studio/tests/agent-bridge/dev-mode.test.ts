import { describe, it, expect } from "vitest";
import {
  WEBSITE_STUDIO,
  EDITOR_SYNC,
  FRONTEND_AGENT,
  DEFAULT_SYSTEMS,
  DEFAULT_DEV_CONFIG,
  classifyReload,
  createReloadAction,
  getCrossDependencies,
  expandReloads,
  createDevState,
  startDevMode,
  markRunning,
  recordChange,
  completeReload,
  stopDevMode,
  getDevSummary,
  getErrorSystems,
  allRunning,
} from "@/lib/agent-bridge/dev-mode";
import type { FileChangeEvent } from "@/lib/agent-bridge/dev-mode";

function makeEvent(path: string, systemId: string = "website-studio"): FileChangeEvent {
  return { path, type: "change", timestamp: Date.now(), systemId };
}

describe("Dev Mode", () => {
  describe("DEFAULT_SYSTEMS", () => {
    it("has 3 systems", () => {
      expect(DEFAULT_SYSTEMS).toHaveLength(3);
    });

    it("includes all three systems", () => {
      const ids = DEFAULT_SYSTEMS.map((s) => s.id);
      expect(ids).toContain("website-studio");
      expect(ids).toContain("editor-sync");
      expect(ids).toContain("frontend-agent");
    });

    it("each system has watch patterns", () => {
      for (const sys of DEFAULT_SYSTEMS) {
        expect(sys.watchPatterns.length).toBeGreaterThan(0);
      }
    });

    it("each system has ignore patterns", () => {
      for (const sys of DEFAULT_SYSTEMS) {
        expect(sys.ignorePatterns.length).toBeGreaterThan(0);
      }
    });
  });

  describe("classifyReload", () => {
    it("returns hot for .ts files", () => {
      expect(classifyReload(makeEvent("lib/foo.ts"))).toBe("hot");
    });

    it("returns hot for .tsx files", () => {
      expect(classifyReload(makeEvent("app/page.tsx"))).toBe("hot");
    });

    it("returns hot for .scss files", () => {
      expect(classifyReload(makeEvent("styles/main.scss"))).toBe("hot");
    });

    it("returns full for .json files", () => {
      expect(classifyReload(makeEvent("data.json"))).toBe("full");
    });

    it("returns full for .py files", () => {
      expect(classifyReload(makeEvent("models/theme.py"))).toBe("full");
    });

    it("returns build for .md files", () => {
      expect(classifyReload(makeEvent("prompts/system.md"))).toBe("build");
    });

    it("returns full for config files", () => {
      expect(classifyReload(makeEvent("tsconfig.json"))).toBe("full");
      expect(classifyReload(makeEvent("package.json"))).toBe("full");
    });

    it("returns full for unknown extensions", () => {
      expect(classifyReload(makeEvent("Makefile"))).toBe("full");
    });
  });

  describe("createReloadAction", () => {
    it("creates action from single event", () => {
      const action = createReloadAction("website-studio", [makeEvent("lib/foo.ts")]);
      expect(action.systemId).toBe("website-studio");
      expect(action.type).toBe("hot");
      expect(action.triggerFiles).toHaveLength(1);
    });

    it("escalates to full when any file needs full reload", () => {
      const events = [makeEvent("lib/foo.ts"), makeEvent("package.json")];
      const action = createReloadAction("website-studio", events);
      expect(action.type).toBe("full");
    });

    it("escalates to build over hot", () => {
      const events = [makeEvent("lib/foo.ts"), makeEvent("README.md")];
      const action = createReloadAction("website-studio", events);
      expect(action.type).toBe("build");
    });
  });

  describe("getCrossDependencies", () => {
    it("editor-sync triggers website-studio reload", () => {
      expect(getCrossDependencies("editor-sync")).toContain("website-studio");
    });

    it("frontend-agent triggers website-studio reload", () => {
      expect(getCrossDependencies("frontend-agent")).toContain("website-studio");
    });

    it("website-studio has no cross deps", () => {
      expect(getCrossDependencies("website-studio")).toHaveLength(0);
    });
  });

  describe("expandReloads", () => {
    it("returns original action for system with no deps", () => {
      const action = createReloadAction("website-studio", [makeEvent("lib/x.ts")]);
      expect(expandReloads(action)).toHaveLength(1);
    });

    it("adds dependent system for editor-sync change", () => {
      const action = createReloadAction("editor-sync", [makeEvent("src/y.ts", "editor-sync")]);
      const expanded = expandReloads(action);
      expect(expanded).toHaveLength(2);
      expect(expanded[1].systemId).toBe("website-studio");
    });

    it("dependent reload is hot type", () => {
      const action = createReloadAction("frontend-agent", [makeEvent("src/z.py", "frontend-agent")]);
      const expanded = expandReloads(action);
      expect(expanded[1].type).toBe("hot");
    });
  });

  describe("state management", () => {
    it("creates state with all systems stopped", () => {
      const state = createDevState(DEFAULT_DEV_CONFIG);
      expect(state.systems.size).toBe(3);
      expect(state.active).toBe(false);
      for (const sys of state.systems.values()) {
        expect(sys.status).toBe("stopped");
      }
    });

    it("startDevMode sets all to starting", () => {
      const state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      expect(state.active).toBe(true);
      for (const sys of state.systems.values()) {
        expect(sys.status).toBe("starting");
      }
    });

    it("markRunning sets specific system", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = markRunning(state, "website-studio");
      expect(state.systems.get("website-studio")!.status).toBe("running");
      expect(state.systems.get("editor-sync")!.status).toBe("starting");
    });

    it("recordChange sets system to rebuilding and increments counter", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = markRunning(state, "website-studio");
      state = recordChange(state, makeEvent("lib/foo.ts"));
      expect(state.systems.get("website-studio")!.status).toBe("rebuilding");
      expect(state.totalChanges).toBe(1);
      expect(state.pendingReloads.length).toBeGreaterThan(0);
    });

    it("recordChange triggers cross-system reload", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = markRunning(state, "editor-sync");
      state = markRunning(state, "website-studio");
      state = recordChange(state, makeEvent("src/foo.ts", "editor-sync"));
      expect(state.systems.get("website-studio")!.status).toBe("rebuilding");
    });

    it("completeReload sets system back to running", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = recordChange(state, makeEvent("lib/foo.ts"));
      state = completeReload(state, "website-studio", true);
      expect(state.systems.get("website-studio")!.status).toBe("running");
      expect(state.systems.get("website-studio")!.buildCount).toBe(1);
    });

    it("completeReload records error on failure", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = recordChange(state, makeEvent("lib/foo.ts"));
      state = completeReload(state, "website-studio", false, "Build failed");
      expect(state.systems.get("website-studio")!.status).toBe("error");
      expect(state.systems.get("website-studio")!.errors).toContain("Build failed");
    });

    it("completeReload removes pending reloads for system", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = recordChange(state, makeEvent("lib/foo.ts"));
      const before = state.pendingReloads.length;
      state = completeReload(state, "website-studio", true);
      expect(state.pendingReloads.length).toBeLessThan(before);
    });

    it("stopDevMode sets all to stopped", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = markRunning(state, "website-studio");
      state = stopDevMode(state);
      expect(state.active).toBe(false);
      for (const sys of state.systems.values()) {
        expect(sys.status).toBe("stopped");
      }
    });

    it("does not mutate on startDevMode", () => {
      const state = createDevState(DEFAULT_DEV_CONFIG);
      startDevMode(state);
      expect(state.active).toBe(false);
    });
  });

  describe("getDevSummary", () => {
    it("returns status for all systems", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = markRunning(state, "website-studio");
      const summary = getDevSummary(state);
      expect(summary["website-studio"]).toBe("running");
      expect(summary["editor-sync"]).toBe("starting");
    });
  });

  describe("getErrorSystems", () => {
    it("returns empty when no errors", () => {
      const state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      expect(getErrorSystems(state)).toHaveLength(0);
    });

    it("returns systems with errors", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = completeReload(state, "editor-sync", false, "fail");
      expect(getErrorSystems(state)).toHaveLength(1);
      expect(getErrorSystems(state)[0].system.id).toBe("editor-sync");
    });
  });

  describe("allRunning", () => {
    it("returns false when not all running", () => {
      const state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      expect(allRunning(state)).toBe(false);
    });

    it("returns true when all running", () => {
      let state = startDevMode(createDevState(DEFAULT_DEV_CONFIG));
      state = markRunning(state, "website-studio");
      state = markRunning(state, "editor-sync");
      state = markRunning(state, "frontend-agent");
      expect(allRunning(state)).toBe(true);
    });
  });
});

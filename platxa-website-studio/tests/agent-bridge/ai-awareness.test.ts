// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import {
  AiAwarenessManager,
  generateAgentSessionId,
  isAgentSessionId,
  isAgentAwarenessState,
  isHumanAwarenessState,
  type AiAwarenessState,
  type HumanAwarenessState,
  type AiEditingPhase,
} from "@/lib/agent-bridge/ai-awareness";

describe("AI Awareness - Agent Session Isolation (Feature #171)", () => {
  let doc: Y.Doc;
  let awareness: Awareness;

  beforeEach(() => {
    doc = new Y.Doc();
    awareness = new Awareness(doc);
  });

  describe("generateAgentSessionId", () => {
    it("generates unique session IDs", () => {
      const id1 = generateAgentSessionId();
      const id2 = generateAgentSessionId();

      expect(id1).not.toBe(id2);
    });

    it("generates IDs with agent prefix", () => {
      const id = generateAgentSessionId();

      expect(id.startsWith("agent_")).toBe(true);
    });

    it("generates IDs with timestamp and random components", () => {
      const id = generateAgentSessionId();
      const parts = id.split("_");

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe("agent");
      expect(parts[1].length).toBeGreaterThan(0); // timestamp
      expect(parts[2].length).toBeGreaterThan(0); // random
    });
  });

  describe("isAgentSessionId", () => {
    it("returns true for agent session IDs", () => {
      expect(isAgentSessionId("agent_123abc_xyz789")).toBe(true);
      expect(isAgentSessionId("agent_0_0")).toBe(true);
    });

    it("returns false for non-agent session IDs", () => {
      expect(isAgentSessionId("user_123")).toBe(false);
      expect(isAgentSessionId("human_abc")).toBe(false);
      expect(isAgentSessionId("")).toBe(false);
    });
  });

  describe("isAgentAwarenessState", () => {
    it("returns true for valid agent awareness state", () => {
      const state: AiAwarenessState = {
        isAi: true,
        userType: "agent",
        sessionId: "agent_123_abc",
        name: "Platxa AI",
        color: "#7c3aed",
        phase: "idle",
        message: "",
        filePath: null,
        cursorPosition: null,
        selectionRange: null,
        lastActivity: new Date().toISOString(),
      };

      expect(isAgentAwarenessState(state)).toBe(true);
    });

    it("returns false for human user state", () => {
      const state: HumanAwarenessState = {
        userType: "human",
        name: "John",
        color: "#ff0000",
      };

      expect(isAgentAwarenessState(state)).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(isAgentAwarenessState(null)).toBe(false);
      expect(isAgentAwarenessState(undefined)).toBe(false);
    });

    it("returns false for objects missing required fields", () => {
      expect(isAgentAwarenessState({ isAi: true })).toBe(false);
      expect(isAgentAwarenessState({ userType: "agent" })).toBe(false);
      expect(isAgentAwarenessState({ sessionId: "agent_123" })).toBe(false);
    });
  });

  describe("isHumanAwarenessState", () => {
    it("returns true for explicitly marked human state", () => {
      const state: HumanAwarenessState = {
        userType: "human",
        name: "John",
        color: "#ff0000",
      };

      expect(isHumanAwarenessState(state)).toBe(true);
    });

    it("returns true for state without isAi flag (legacy)", () => {
      const state = {
        name: "John",
        color: "#ff0000",
      };

      expect(isHumanAwarenessState(state)).toBe(true);
    });

    it("returns true for state with isAi: false", () => {
      const state = {
        isAi: false,
        name: "John",
        color: "#ff0000",
      };

      expect(isHumanAwarenessState(state)).toBe(true);
    });

    it("returns false for agent state", () => {
      const state: AiAwarenessState = {
        isAi: true,
        userType: "agent",
        sessionId: "agent_123_abc",
        name: "Platxa AI",
        color: "#7c3aed",
        phase: "idle",
        message: "",
        filePath: null,
        cursorPosition: null,
        selectionRange: null,
        lastActivity: new Date().toISOString(),
      };

      expect(isHumanAwarenessState(state)).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(isHumanAwarenessState(null)).toBe(false);
      expect(isHumanAwarenessState(undefined)).toBe(false);
    });
  });

  describe("AiAwarenessManager", () => {
    describe("session isolation", () => {
      it("generates unique session ID on creation", () => {
        const manager = new AiAwarenessManager(awareness);
        const sessionId = manager.getSessionId();

        expect(sessionId).toBeTruthy();
        expect(isAgentSessionId(sessionId)).toBe(true);
      });

      it("uses custom session ID when provided", () => {
        const customId = "agent_custom_session";
        const manager = new AiAwarenessManager(awareness, { sessionId: customId });

        expect(manager.getSessionId()).toBe(customId);
      });

      it("different managers have different session IDs", () => {
        const doc1 = new Y.Doc();
        const doc2 = new Y.Doc();
        const awareness1 = new Awareness(doc1);
        const awareness2 = new Awareness(doc2);

        const manager1 = new AiAwarenessManager(awareness1);
        const manager2 = new AiAwarenessManager(awareness2);

        expect(manager1.getSessionId()).not.toBe(manager2.getSessionId());
      });

      it("includes session ID in awareness state", () => {
        const manager = new AiAwarenessManager(awareness);
        const sessionId = manager.getSessionId();

        const state = manager.getState();
        expect(state).not.toBeNull();
        expect(state!.sessionId).toBe(sessionId);
      });

      it("includes userType: agent in awareness state", () => {
        const manager = new AiAwarenessManager(awareness);

        const state = manager.getState();
        expect(state).not.toBeNull();
        expect(state!.userType).toBe("agent");
      });
    });

    describe("getClientId", () => {
      it("returns Yjs client ID", () => {
        const manager = new AiAwarenessManager(awareness);

        const clientId = manager.getClientId();
        expect(typeof clientId).toBe("number");
        expect(clientId).toBe(awareness.clientID);
      });
    });

    describe("isOwnState", () => {
      it("returns true for own state", () => {
        const manager = new AiAwarenessManager(awareness);
        const state = manager.getState();

        expect(manager.isOwnState(state)).toBe(true);
      });

      it("returns false for different agent state", () => {
        const manager = new AiAwarenessManager(awareness);
        const otherState: AiAwarenessState = {
          isAi: true,
          userType: "agent",
          sessionId: "agent_different_session",
          name: "Other AI",
          color: "#ff0000",
          phase: "idle",
          message: "",
          filePath: null,
          cursorPosition: null,
          selectionRange: null,
          lastActivity: new Date().toISOString(),
        };

        expect(manager.isOwnState(otherState)).toBe(false);
      });

      it("returns false for human state", () => {
        const manager = new AiAwarenessManager(awareness);
        const humanState: HumanAwarenessState = {
          userType: "human",
          name: "John",
          color: "#ff0000",
        };

        expect(manager.isOwnState(humanState)).toBe(false);
      });
    });

    describe("state transitions with session ID", () => {
      it("maintains session ID when setting editing", () => {
        const manager = new AiAwarenessManager(awareness);
        const sessionId = manager.getSessionId();

        manager.setEditing("/test.xml", "generating", "Working...");

        const state = manager.getState();
        expect(state!.sessionId).toBe(sessionId);
        expect(state!.phase).toBe("generating");
      });

      it("maintains session ID when setting complete", () => {
        const manager = new AiAwarenessManager(awareness);
        const sessionId = manager.getSessionId();

        manager.setComplete("/test.xml", "Done");

        const state = manager.getState();
        expect(state!.sessionId).toBe(sessionId);
        expect(state!.phase).toBe("complete");
      });

      it("maintains session ID when setting idle", () => {
        const manager = new AiAwarenessManager(awareness);
        const sessionId = manager.getSessionId();

        manager.setEditing("/test.xml", "generating", "Working...");
        manager.setIdle();

        const state = manager.getState();
        expect(state!.sessionId).toBe(sessionId);
        expect(state!.phase).toBe("idle");
      });
    });

    describe("distinguishing agents from humans", () => {
      it("agent state is distinguishable from human state", () => {
        const manager = new AiAwarenessManager(awareness);
        const agentState = manager.getState();

        // Verify agent state has all required markers
        expect(agentState!.isAi).toBe(true);
        expect(agentState!.userType).toBe("agent");
        expect(agentState!.sessionId).toBeTruthy();
        expect(isAgentAwarenessState(agentState)).toBe(true);
        expect(isHumanAwarenessState(agentState)).toBe(false);
      });

      it("getAgentStates filters to only agent states", () => {
        const manager = new AiAwarenessManager(awareness);

        const agentStates = manager.getAgentStates();
        expect(agentStates.size).toBe(1);

        const entry = agentStates.entries().next().value;
        expect(entry).toBeDefined();
        const [clientId, state] = entry!;
        expect(clientId).toBe(manager.getClientId());
        expect(state.sessionId).toBe(manager.getSessionId());
      });

      it("getHumanStates excludes agent states", () => {
        const manager = new AiAwarenessManager(awareness);

        const humanStates = manager.getHumanStates();
        expect(humanStates.size).toBe(0);
      });
    });

    describe("existing functionality preserved", () => {
      it("sets editing state with cursor position", () => {
        const manager = new AiAwarenessManager(awareness);

        manager.setEditing("/test.xml", "writing", "Writing content...", 100);

        const state = manager.getState();
        expect(state!.phase).toBe("writing");
        expect(state!.cursorPosition).toBe(100);
        expect(state!.filePath).toBe("/test.xml");
      });

      it("sets editing state with selection range", () => {
        const manager = new AiAwarenessManager(awareness);

        manager.setEditing("/test.xml", "generating", "Selecting...", 0, { start: 10, end: 50 });

        const state = manager.getState();
        expect(state!.selectionRange).toEqual({ start: 10, end: 50 });
      });

      it("getAllStates returns all awareness states", () => {
        const manager = new AiAwarenessManager(awareness);

        const allStates = manager.getAllStates();
        expect(allStates.size).toBe(1);
      });

      it("dispose clears timer and sets idle", () => {
        vi.useFakeTimers();
        const manager = new AiAwarenessManager(awareness);

        manager.setComplete("/test.xml");
        manager.dispose();

        const state = manager.getState();
        expect(state!.phase).toBe("idle");

        vi.useRealTimers();
      });
    });

    describe("configuration", () => {
      it("uses custom name", () => {
        const manager = new AiAwarenessManager(awareness, { name: "Custom AI" });

        const state = manager.getState();
        expect(state!.name).toBe("Custom AI");
      });

      it("uses custom color", () => {
        const manager = new AiAwarenessManager(awareness, { color: "#ff0000" });

        const state = manager.getState();
        expect(state!.color).toBe("#ff0000");
      });

      it("uses custom idle timeout", () => {
        vi.useFakeTimers();
        const manager = new AiAwarenessManager(awareness, { idleTimeoutMs: 5000 });

        manager.setComplete("/test.xml");
        vi.advanceTimersByTime(4000);

        let state = manager.getState();
        expect(state!.phase).toBe("complete");

        vi.advanceTimersByTime(2000);

        state = manager.getState();
        expect(state!.phase).toBe("idle");

        vi.useRealTimers();
      });
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  WORKFLOW_PHASES,
  PHASE_LABELS,
  getPhaseStatus,
  type AgentWorkflowPhase,
  type PhaseStatus,
} from "@/components/chat/AgentProgress";

describe("AgentProgress", () => {
  describe("shows phases: Planning ✓ → Generating ⏳ → Validating → Complete (Feature #95)", () => {
    it("defines all four workflow phases in correct order", () => {
      // Feature #95: Shows phases Planning → Generating → Validating → Complete
      expect(WORKFLOW_PHASES).toEqual([
        "planning",
        "generating",
        "validating",
        "complete",
      ]);
    });

    it("marks completed phases with checkmark status", () => {
      // Feature #95: Planning ✓ (completed) when on generating
      const status = getPhaseStatus("planning", "generating");
      expect(status).toBe("complete");
    });

    it("marks current phase as active (spinner)", () => {
      // Feature #95: Generating ⏳ (active/in-progress)
      const status = getPhaseStatus("generating", "generating");
      expect(status).toBe("active");
    });

    it("marks future phases as pending", () => {
      // Feature #95: Validating (pending) when on generating
      const validateStatus = getPhaseStatus("validating", "generating");
      const completeStatus = getPhaseStatus("complete", "generating");
      expect(validateStatus).toBe("pending");
      expect(completeStatus).toBe("pending");
    });

    it("full progression example: Planning ✓ → Generating ⏳ → Validating → Complete", () => {
      // Feature #95 verification: Full phase progression scenario
      const currentPhase: AgentWorkflowPhase = "generating";

      const statuses: Record<AgentWorkflowPhase, PhaseStatus> = {
        planning: getPhaseStatus("planning", currentPhase),
        generating: getPhaseStatus("generating", currentPhase),
        validating: getPhaseStatus("validating", currentPhase),
        complete: getPhaseStatus("complete", currentPhase),
      };

      // Planning ✓ (complete)
      expect(statuses.planning).toBe("complete");
      // Generating ⏳ (active)
      expect(statuses.generating).toBe("active");
      // Validating (pending)
      expect(statuses.validating).toBe("pending");
      // Complete (pending)
      expect(statuses.complete).toBe("pending");
    });
  });

  describe("WORKFLOW_PHASES", () => {
    it("contains exactly 4 phases", () => {
      expect(WORKFLOW_PHASES).toHaveLength(4);
    });

    it("starts with planning", () => {
      expect(WORKFLOW_PHASES[0]).toBe("planning");
    });

    it("ends with complete", () => {
      expect(WORKFLOW_PHASES[WORKFLOW_PHASES.length - 1]).toBe("complete");
    });
  });

  describe("PHASE_LABELS", () => {
    it("provides labels for all phases", () => {
      for (const phase of WORKFLOW_PHASES) {
        expect(PHASE_LABELS[phase]).toBeDefined();
        expect(PHASE_LABELS[phase].label).toBeTruthy();
        expect(PHASE_LABELS[phase].shortLabel).toBeTruthy();
      }
    });

    it("has human-readable labels", () => {
      expect(PHASE_LABELS.planning.label).toBe("Planning");
      expect(PHASE_LABELS.generating.label).toBe("Generating");
      expect(PHASE_LABELS.validating.label).toBe("Validating");
      expect(PHASE_LABELS.complete.label).toBe("Complete");
    });

    it("has short labels for compact display", () => {
      expect(PHASE_LABELS.planning.shortLabel).toBe("Plan");
      expect(PHASE_LABELS.generating.shortLabel).toBe("Gen");
      expect(PHASE_LABELS.validating.shortLabel).toBe("Val");
      expect(PHASE_LABELS.complete.shortLabel).toBe("Done");
    });
  });

  describe("getPhaseStatus", () => {
    it("returns 'pending' for phases after current", () => {
      expect(getPhaseStatus("validating", "planning")).toBe("pending");
      expect(getPhaseStatus("complete", "generating")).toBe("pending");
    });

    it("returns 'active' for the current phase", () => {
      expect(getPhaseStatus("planning", "planning")).toBe("active");
      expect(getPhaseStatus("validating", "validating")).toBe("active");
      expect(getPhaseStatus("complete", "complete")).toBe("active");
    });

    it("returns 'complete' for phases before current", () => {
      expect(getPhaseStatus("planning", "generating")).toBe("complete");
      expect(getPhaseStatus("generating", "validating")).toBe("complete");
      expect(getPhaseStatus("validating", "complete")).toBe("complete");
    });

    it("all phases complete when on complete phase", () => {
      expect(getPhaseStatus("planning", "complete")).toBe("complete");
      expect(getPhaseStatus("generating", "complete")).toBe("complete");
      expect(getPhaseStatus("validating", "complete")).toBe("complete");
      expect(getPhaseStatus("complete", "complete")).toBe("active");
    });

    it("all phases pending when on planning phase", () => {
      expect(getPhaseStatus("planning", "planning")).toBe("active");
      expect(getPhaseStatus("generating", "planning")).toBe("pending");
      expect(getPhaseStatus("validating", "planning")).toBe("pending");
      expect(getPhaseStatus("complete", "planning")).toBe("pending");
    });
  });
});

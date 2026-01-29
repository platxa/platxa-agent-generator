import { describe, it, expect } from "vitest";
import {
  MODE_CONFIG,
  SIZE_VARIANTS,
  getModeConfig,
  isActiveMode,
  getModeLabel,
  type AgentMode,
} from "@/components/chat/AgentStatusBadge";

describe("AgentStatusBadge", () => {
  describe("badge shows mode name with appropriate icon (Feature #109)", () => {
    it("plan mode has label and icon configured", () => {
      // Feature #109: Badge shows mode name with appropriate icon
      const config = getModeConfig("plan");

      expect(config.label).toBe("Plan");
      expect(config.icon).toBeDefined();
      expect(config.color).toBeTruthy();
    });

    it("agent mode has label and icon configured", () => {
      // Feature #109: Badge shows mode name with appropriate icon
      const config = getModeConfig("agent");

      expect(config.label).toBe("Agent");
      expect(config.icon).toBeDefined();
      expect(config.color).toBeTruthy();
    });

    it("all modes have distinct visual styles", () => {
      // Feature #109: Appropriate styling per mode
      const modes: AgentMode[] = ["plan", "agent", "idle", "error"];

      for (const mode of modes) {
        const config = MODE_CONFIG[mode];
        expect(config.label).toBeTruthy();
        expect(config.icon).toBeDefined();
        expect(config.color).toBeTruthy();
        expect(config.bgColor).toBeTruthy();
        expect(config.borderColor).toBeTruthy();
      }
    });
  });

  describe("MODE_CONFIG", () => {
    it("plan mode uses violet colors", () => {
      expect(MODE_CONFIG.plan.color).toContain("violet");
      expect(MODE_CONFIG.plan.bgColor).toContain("violet");
    });

    it("agent mode uses blue colors", () => {
      expect(MODE_CONFIG.agent.color).toContain("blue");
      expect(MODE_CONFIG.agent.bgColor).toContain("blue");
    });

    it("idle mode uses muted colors", () => {
      expect(MODE_CONFIG.idle.color).toContain("muted");
      expect(MODE_CONFIG.idle.bgColor).toContain("muted");
    });

    it("error mode uses red colors", () => {
      expect(MODE_CONFIG.error.color).toContain("red");
      expect(MODE_CONFIG.error.bgColor).toContain("red");
    });

    it("all modes have descriptions", () => {
      const modes: AgentMode[] = ["plan", "agent", "idle", "error"];

      for (const mode of modes) {
        expect(MODE_CONFIG[mode].description).toBeTruthy();
      }
    });
  });

  describe("SIZE_VARIANTS", () => {
    it("provides sm, md, lg sizes", () => {
      expect(SIZE_VARIANTS.sm).toBeDefined();
      expect(SIZE_VARIANTS.md).toBeDefined();
      expect(SIZE_VARIANTS.lg).toBeDefined();
    });

    it("sm is smallest", () => {
      expect(SIZE_VARIANTS.sm.badge).toContain("text-xs");
      expect(SIZE_VARIANTS.sm.icon).toContain("w-3");
    });

    it("md is medium", () => {
      expect(SIZE_VARIANTS.md.badge).toContain("text-sm");
      expect(SIZE_VARIANTS.md.icon).toContain("w-4");
    });

    it("lg is largest", () => {
      expect(SIZE_VARIANTS.lg.badge).toContain("text-base");
      expect(SIZE_VARIANTS.lg.icon).toContain("w-5");
    });
  });

  describe("getModeConfig", () => {
    it("returns config for valid mode", () => {
      const config = getModeConfig("plan");

      expect(config).toBe(MODE_CONFIG.plan);
      expect(config.label).toBe("Plan");
    });

    it("returns config for all modes", () => {
      const modes: AgentMode[] = ["plan", "agent", "idle", "error"];

      for (const mode of modes) {
        const config = getModeConfig(mode);
        expect(config).toBe(MODE_CONFIG[mode]);
      }
    });
  });

  describe("isActiveMode", () => {
    it("returns true for plan mode", () => {
      expect(isActiveMode("plan")).toBe(true);
    });

    it("returns true for agent mode", () => {
      expect(isActiveMode("agent")).toBe(true);
    });

    it("returns false for idle mode", () => {
      expect(isActiveMode("idle")).toBe(false);
    });

    it("returns false for error mode", () => {
      expect(isActiveMode("error")).toBe(false);
    });
  });

  describe("getModeLabel", () => {
    it("returns default label when no custom label", () => {
      expect(getModeLabel("plan")).toBe("Plan");
      expect(getModeLabel("agent")).toBe("Agent");
      expect(getModeLabel("idle")).toBe("Idle");
      expect(getModeLabel("error")).toBe("Error");
    });

    it("returns custom label when provided", () => {
      expect(getModeLabel("plan", "Planning...")).toBe("Planning...");
      expect(getModeLabel("agent", "Working")).toBe("Working");
    });

    it("prefers custom label over default", () => {
      const customLabel = "Custom Mode";
      expect(getModeLabel("plan", customLabel)).toBe(customLabel);
    });
  });
});

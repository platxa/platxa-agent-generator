/**
 * AgentBridge Integration Tests
 *
 * Real end-to-end tests — no mocks. The AgentBridge instantiates a real
 * FrontendOrchestrator and processes real theme generation requests through
 * the full 5-step pipeline (analyze → generate → animate → theme → a11y).
 */

import { describe, it, expect, beforeEach } from "vitest";

import { AgentBridge } from "@/lib/agent-bridge/agent-bridge";
import type {
  AgentBridgeInput,
  AgentBridgeResult,
} from "@/lib/agent-bridge/agent-bridge";
import type { AgentStatus, BrandTokenContext } from "@/lib/agent-bridge/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BRAND_TOKENS: BrandTokenContext = {
  colors: {
    primary: "#7c3aed",
    primaryOklch: { l: 0.5, c: 0.2, h: 280 },
    secondary: "#6c757d",
    secondaryOklch: { l: 0.5, c: 0.05, h: 250 },
    accent: "#ec4899",
    accentOklch: { l: 0.6, c: 0.2, h: 350 },
    background: "#f8f9fa",
    text: "#212529",
    error: "#dc3545",
    warning: "#ffc107",
    success: "#198754",
    info: "#0dcaf0",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentBridge (real integration)", () => {
  // =========================================================================
  // Instantiation
  // =========================================================================

  describe("constructor", () => {
    it("instantiates FrontendOrchestrator without error", () => {
      const bridge = new AgentBridge();
      expect(bridge).toBeInstanceOf(AgentBridge);
      expect(bridge.getOrchestrator()).toBeDefined();
    });

    it("accepts orchestrator config overrides", () => {
      const bridge = new AgentBridge({
        orchestratorConfig: { verbose: false, stepTimeout: 5000 },
      });
      expect(bridge.getOrchestrator()).toBeDefined();
    });
  });

  // =========================================================================
  // End-to-End Theme Generation
  // =========================================================================

  describe("processRequest — theme generation end-to-end", () => {
    let bridge: AgentBridge;

    beforeEach(() => {
      bridge = new AgentBridge({
        orchestratorConfig: { verbose: false, failOnA11yErrors: false },
      });
    });

    it("processes a theme generation request end-to-end", async () => {
      const input: AgentBridgeInput = {
        description: "Create a modern hero section with dark theme",
        generateTheme: true,
        auditAccessibility: true,
        brandTokens: BRAND_TOKENS,
      };

      const result = await bridge.processRequest(input);

      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.rawResult).not.toBeNull();
      // Theme CSS generated from real orchestrator
      expect(result.themeCss).toBeTruthy();
      expect(typeof result.themeCss).toBe("string");
      // Accessibility audit ran
      expect(result.accessibilityScore).toBeTypeOf("number");
      expect(result.accessibilityScore).toBeGreaterThanOrEqual(0);
      expect(result.accessibilityScore).toBeLessThanOrEqual(100);
    });

    it("extracts real design analysis from NLP analyzer", async () => {
      const input: AgentBridgeInput = {
        description: "A large primary button with hover effect",
        generateTheme: true,
        auditAccessibility: true,
      };

      const result = await bridge.processRequest(input);

      expect(result.success).toBe(true);
      expect(result.designAnalysis).not.toBeNull();
      expect(result.designAnalysis!.componentType).toBeTruthy();
      expect(result.designAnalysis!.confidence).toBeGreaterThan(0);
      expect(result.designAnalysis!.keywords).toBeInstanceOf(Array);
      expect(result.designAnalysis!.keywords.length).toBeGreaterThan(0);
    });

    it("maps React component types to Odoo section types", async () => {
      const result = await bridge.processRequest({
        description: "A contact form with email and message fields",
        generateTheme: false,
        auditAccessibility: false,
      });

      expect(result.success).toBe(true);
      expect(result.designAnalysis).not.toBeNull();
      // "form" or "input" → "contact" in the Odoo mapping
      expect(["contact", "form", "input"]).toContain(
        result.designAnalysis!.componentType,
      );
    });

    it("generates theme CSS with brand token overrides", async () => {
      const result = await bridge.processRequest({
        description: "A card component",
        generateTheme: true,
        brandTokens: BRAND_TOKENS,
      });

      expect(result.success).toBe(true);
      expect(result.themeCss).toBeTruthy();
      // The theme CSS should contain CSS custom properties
      expect(result.themeCss).toContain("--");
    });

    it("generates theme CSS with default preset when no brand tokens", async () => {
      const result = await bridge.processRequest({
        description: "A simple card",
        generateTheme: true,
      });

      expect(result.success).toBe(true);
      expect(result.themeCss).toBeTruthy();
    });

    it("runs accessibility audit and returns real scores", async () => {
      const result = await bridge.processRequest({
        description: "A navigation bar with dropdown menus",
        auditAccessibility: true,
      });

      expect(result.success).toBe(true);
      expect(result.accessibilityScore).toBeTypeOf("number");
      expect(Array.isArray(result.accessibilityIssues)).toBe(true);
    });

    it("skips theme when generateTheme=false", async () => {
      const result = await bridge.processRequest({
        description: "A badge component",
        generateTheme: false,
        auditAccessibility: true,
      });

      expect(result.success).toBe(true);
      expect(result.themeCss).toBeNull();
    });

    it("skips a11y audit when auditAccessibility=false", async () => {
      const result = await bridge.processRequest({
        description: "A tooltip",
        auditAccessibility: false,
      });

      expect(result.success).toBe(true);
      expect(result.accessibilityScore).toBeNull();
      expect(result.accessibilityIssues).toEqual([]);
    });

    it("includes raw orchestrator result for debugging", async () => {
      const result = await bridge.processRequest({
        description: "A modal dialog",
        generateTheme: true,
        auditAccessibility: true,
      });

      expect(result.success).toBe(true);
      expect(result.rawResult).not.toBeNull();
      expect(result.rawResult!.workflow).toBeDefined();
      expect(result.rawResult!.component).toBeDefined();
      expect(result.rawResult!.files).toBeInstanceOf(Array);
      expect(result.rawResult!.files.length).toBeGreaterThan(0);
    });

    it("passes through orchestrator warnings", async () => {
      const result = await bridge.processRequest({
        description: "A grid layout",
        generateTheme: true,
        auditAccessibility: true,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  // =========================================================================
  // Event Bridge
  // =========================================================================

  describe("event bridging", () => {
    it("emits real status updates during processing", async () => {
      const statuses: AgentStatus[] = [];
      const bridge = new AgentBridge({
        orchestratorConfig: { verbose: false },
        onStatusChange: (s) => statuses.push(s),
      });

      await bridge.processRequest({
        description: "A card with image and title",
        generateTheme: true,
        auditAccessibility: true,
      });

      // Should have received multiple status updates from real orchestrator steps
      expect(statuses.length).toBeGreaterThan(0);
      // Each status should have required fields
      for (const status of statuses) {
        expect(status.phase).toBeTruthy();
        expect(status.message).toBeTruthy();
        expect(status.startedAt).toBeTruthy();
      }
    });
  });

  // =========================================================================
  // Lifecycle
  // =========================================================================

  describe("lifecycle", () => {
    it("getOrchestrator returns real FrontendOrchestrator instance", () => {
      const bridge = new AgentBridge();
      const orch = bridge.getOrchestrator();
      expect(orch).toBeDefined();
      // Real orchestrator has a generate method
      expect(typeof orch.generate).toBe("function");
      // Real orchestrator has an on method
      expect(typeof orch.on).toBe("function");
    });

    it("dispose is safe to call", () => {
      const bridge = new AgentBridge({ onStatusChange: () => {} });
      expect(() => bridge.dispose()).not.toThrow();
    });

    it("dispose is safe to call multiple times", () => {
      const bridge = new AgentBridge({ onStatusChange: () => {} });
      bridge.dispose();
      expect(() => bridge.dispose()).not.toThrow();
    });

    it("dispose without event bridge is safe", () => {
      const bridge = new AgentBridge();
      expect(() => bridge.dispose()).not.toThrow();
    });
  });

  // =========================================================================
  // Pipeline Integration
  // =========================================================================

  describe("pipeline integration", () => {
    it("AgentPipeline uses AgentBridge for end-to-end processing", async () => {
      // Import real pipeline
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      const statuses: AgentStatus[] = [];
      const pipeline = new AgentPipeline({
        enablePreGeneration: true,
        enablePostGeneration: true,
        enableSidecarWrite: false,
        enableFrontendAgent: true,
        onStatusChange: (s) => statuses.push(s),
      });

      const preResult = await pipeline.runPreGeneration({
        userMessage: "Create a modern pricing table with three tiers",
        colorPalette: {
          primary: "#7c3aed",
          secondary: "#6c757d",
          accent: "#ec4899",
          background: "#f8f9fa",
          text: "#212529",
        },
      });

      expect(preResult).toBeDefined();
      expect(preResult.brandTokens).toBeDefined();
      expect(preResult.brandTokens.colors.primary).toBe("#7c3aed");

      // The frontend agent result should be populated
      const bridgeResult = pipeline.getFrontendAgentResult();
      expect(bridgeResult).not.toBeNull();
      expect(bridgeResult!.success).toBe(true);

      // Run post-generation with real code
      const postResult = await pipeline.runPostGeneration(
        '<section class="pricing"><div style="color: #212529; background: #f8f9fa;">Content</div></section>',
      );
      expect(postResult).not.toBeNull();
      expect(postResult!.quality.overallScore).toBeGreaterThanOrEqual(0);

      // Finalize
      const finalResult = pipeline.finalize();
      expect(finalResult.preGeneration).toBeDefined();
      expect(finalResult.frontendAgentResult).not.toBeNull();
      expect(finalResult.totalDurationMs).toBeGreaterThanOrEqual(0);

      // Status updates should have flowed through the event bridge
      expect(statuses.length).toBeGreaterThan(0);

      pipeline.dispose();
    });

    it("runPageGeneration processes each section through the orchestrator", async () => {
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      const statuses: AgentStatus[] = [];
      const pipeline = new AgentPipeline({
        enablePreGeneration: true,
        enablePostGeneration: true,
        enableSidecarWrite: false,
        enableFrontendAgent: true,
        onStatusChange: (s) => statuses.push(s),
      });

      const pageResult = await pipeline.runPageGeneration(
        ["hero", "features", "cta"],
        BRAND_TOKENS,
      );

      // All three sections processed
      expect(pageResult.sections).toHaveLength(3);
      expect(pageResult.totalDurationMs).toBeGreaterThanOrEqual(0);

      // Each section has correct snippet IDs
      expect(pageResult.sections[0].snippetId).toBe("s_hero");
      expect(pageResult.sections[1].snippetId).toBe("s_features");
      expect(pageResult.sections[2].snippetId).toBe("s_cta");

      // Each section succeeded with real orchestrator output
      for (const section of pageResult.sections) {
        expect(section.success).toBe(true);
        expect(section.sectionType).toBeTruthy();
        expect(section.durationMs).toBeGreaterThanOrEqual(0);
      }

      // Combined theme CSS aggregates all sections
      expect(pageResult.combinedThemeCss).toContain("s_hero");
      expect(pageResult.combinedThemeCss).toContain("s_features");
      expect(pageResult.combinedThemeCss).toContain("s_cta");

      // Average accessibility score computed
      expect(pageResult.averageAccessibilityScore).toBeTypeOf("number");
      expect(pageResult.averageAccessibilityScore).toBeGreaterThanOrEqual(0);
      expect(pageResult.averageAccessibilityScore).toBeLessThanOrEqual(100);

      // Status events emitted for each section
      const sectionStatuses = statuses.filter((s) =>
        s.message.includes("Processing section"),
      );
      expect(sectionStatuses).toHaveLength(3);

      pipeline.dispose();
    });

    it("runPageGeneration returns empty result without frontend agent", async () => {
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      const pipeline = new AgentPipeline({
        enableFrontendAgent: false,
      });

      const result = await pipeline.runPageGeneration(["hero", "features"]);

      expect(result.sections).toHaveLength(0);
      expect(result.combinedThemeCss).toBe("");
      expect(result.averageAccessibilityScore).toBeNull();

      pipeline.dispose();
    });

    it("runSnippetGeneration processes snippet with design token constraints", async () => {
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      const pipeline = new AgentPipeline({
        enableFrontendAgent: true,
      });

      const result = await pipeline.runSnippetGeneration(
        "s_hero",
        "hero",
        BRAND_TOKENS,
      );

      expect(result.success).toBe(true);
      expect(result.snippetId).toBe("s_hero");
      expect(result.snippetType).toBe("hero");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Design token constraints map hex values to CSS variables
      const vars = result.tokenConstraints.colorVariables;
      expect(vars["#7c3aed"]).toBe("var(--o-color-1)");
      expect(vars["#6c757d"]).toBe("var(--o-color-2)");
      expect(vars["#ec4899"]).toBe("var(--o-color-3)");
      expect(vars["#f8f9fa"]).toBe("var(--o-color-4)");
      expect(vars["#212529"]).toBe("var(--o-color-5)");

      // Bootstrap semantic variables for non-overlapping colors
      expect(vars["#198754"]).toBe("var(--bs-success)");
      expect(vars["#0dcaf0"]).toBe("var(--bs-info)");
      expect(vars["#ffc107"]).toBe("var(--bs-warning)");
      expect(vars["#dc3545"]).toBe("var(--bs-danger)");

      pipeline.dispose();
    });

    it("runSnippetGeneration returns empty constraints without frontend agent", async () => {
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      const pipeline = new AgentPipeline({ enableFrontendAgent: false });

      const result = await pipeline.runSnippetGeneration("s_cta", "cta");

      expect(result.success).toBe(false);
      expect(Object.keys(result.tokenConstraints.colorVariables)).toHaveLength(0);
      expect(result.tokenConstraints.scopedThemeCss).toBeNull();

      pipeline.dispose();
    });

    it("runStyleModification validates hardcoded colors against design tokens", async () => {
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      const pipeline = new AgentPipeline({
        enableFrontendAgent: true,
      });

      const result = await pipeline.runStyleModification(
        [
          {
            selector: ".s_hero h1",
            properties: { color: "#7c3aed", "background-color": "#f8f9fa" },
          },
          {
            selector: ".s_cta",
            properties: { "border-color": "#ec4899", padding: "16px" },
          },
        ],
        BRAND_TOKENS,
      );

      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Validation issues flagged for hardcoded brand colors
      expect(result.valid).toBe(false);
      expect(result.validationIssues.length).toBeGreaterThan(0);

      const primaryIssue = result.validationIssues.find(
        (i) => i.value === "#7c3aed",
      );
      expect(primaryIssue).toBeDefined();
      expect(primaryIssue!.suggestedVariable).toBe("var(--o-color-1)");

      // Resolved changes have token variables substituted
      const heroChange = result.resolvedChanges.find(
        (c) => c.selector === ".s_hero h1",
      );
      expect(heroChange).toBeDefined();
      expect(heroChange!.properties["color"]).toBe("var(--o-color-1)");
      expect(heroChange!.properties["background-color"]).toBe("var(--o-color-4)");

      // Non-color properties pass through unchanged
      const ctaChange = result.resolvedChanges.find(
        (c) => c.selector === ".s_cta",
      );
      expect(ctaChange).toBeDefined();
      expect(ctaChange!.properties["padding"]).toBe("16px");
      expect(ctaChange!.properties["border-color"]).toBe("var(--o-color-3)");

      pipeline.dispose();
    });

    it("runStyleModification passes validation when no hardcoded tokens used", async () => {
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      const pipeline = new AgentPipeline({
        enableFrontendAgent: true,
      });

      const result = await pipeline.runStyleModification(
        [
          {
            selector: ".my-class",
            properties: { padding: "8px", margin: "0 auto" },
          },
        ],
        BRAND_TOKENS,
      );

      expect(result.success).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.validationIssues).toHaveLength(0);
      expect(result.resolvedChanges[0].properties["padding"]).toBe("8px");

      pipeline.dispose();
    });

    it("runPageGeneration returns empty result for empty sections array", async () => {
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      const pipeline = new AgentPipeline({
        enableFrontendAgent: true,
      });

      const result = await pipeline.runPageGeneration([]);

      expect(result.sections).toHaveLength(0);
      expect(result.combinedThemeCss).toBe("");

      pipeline.dispose();
    });
  });
});

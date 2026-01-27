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

  // =========================================================================
  // Project Config Bridge
  // =========================================================================

  describe("project config bridge", () => {
    it("deriveAgentContext returns current project state", async () => {
      const { deriveAgentContext } = await import(
        "@/lib/agent-bridge/project-config-bridge"
      );
      const { useProjectStore } = await import("@/lib/stores/project-store");

      // Set project config
      useProjectStore.getState().setProject("test-1", "Test Project");
      useProjectStore.getState().setProjectConfig({
        themeName: "theme_test",
        displayName: "Test Project",
        industry: "technology",
        colorPalette: {
          primary: "#7c3aed",
          secondary: "#6c757d",
          accent: "#ec4899",
          background: "#f8f9fa",
          text: "#212529",
        },
      });

      const context = deriveAgentContext();

      expect(context.projectId).toBe("test-1");
      expect(context.projectName).toBe("Test Project");
      expect(context.industry).toBe("technology");
      expect(context.colorPalette).not.toBeNull();
      expect(context.colorPalette!.primary).toBe("#7c3aed");
      expect(context.brandTokens).not.toBeNull();
      expect(context.brandTokens!.colors.primary).toBe("#7c3aed");

      useProjectStore.getState().resetProject();
    });

    it("deriveAgentContext returns null brand tokens when no palette", async () => {
      const { deriveAgentContext } = await import(
        "@/lib/agent-bridge/project-config-bridge"
      );
      const { useProjectStore } = await import("@/lib/stores/project-store");

      useProjectStore.getState().resetProject();

      const context = deriveAgentContext();

      expect(context.brandTokens).toBeNull();
      expect(context.colorPalette).toBeNull();
      expect(context.industry).toBeNull();
    });

    it("subscribeProjectConfigBridge fires on config changes", async () => {
      const { subscribeProjectConfigBridge } = await import(
        "@/lib/agent-bridge/project-config-bridge"
      );
      const { useProjectStore } = await import("@/lib/stores/project-store");

      useProjectStore.getState().resetProject();

      const contexts: Array<{ projectName: string; industry: string | null }> = [];

      const unsub = subscribeProjectConfigBridge((ctx) => {
        contexts.push({ projectName: ctx.projectName, industry: ctx.industry });
      });

      // Initial sync fires immediately
      expect(contexts.length).toBeGreaterThanOrEqual(1);

      // Change project config
      useProjectStore.getState().setProjectConfig({
        themeName: "theme_new",
        displayName: "New Project",
        industry: "restaurant",
        colorPalette: {
          primary: "#dc3545",
          secondary: "#6c757d",
          accent: "#ffc107",
          background: "#ffffff",
          text: "#000000",
        },
      });

      // Should have fired again
      expect(contexts.length).toBeGreaterThanOrEqual(2);
      const latest = contexts[contexts.length - 1];
      expect(latest.projectName).toBe("New Project");
      expect(latest.industry).toBe("restaurant");

      unsub();
      useProjectStore.getState().resetProject();
    });

    it("subscribeProjectConfigBridge syncs brand tokens to agent store", async () => {
      const { subscribeProjectConfigBridge } = await import(
        "@/lib/agent-bridge/project-config-bridge"
      );
      const { useProjectStore } = await import("@/lib/stores/project-store");
      const { useAgentStore } = await import("@/lib/stores/agent-store");

      useProjectStore.getState().resetProject();
      useAgentStore.getState().reset();

      useProjectStore.getState().setProjectConfig({
        themeName: "theme_sync",
        displayName: "Sync Test",
        colorPalette: {
          primary: "#7c3aed",
          secondary: "#6c757d",
          accent: "#ec4899",
          background: "#f8f9fa",
          text: "#212529",
        },
      });

      const unsub = subscribeProjectConfigBridge();

      // Agent store should now have brand tokens
      const brandContext = useAgentStore.getState().brandContext;
      expect(brandContext).not.toBeNull();
      expect(brandContext!.colors.primary).toBe("#7c3aed");

      unsub();
      useProjectStore.getState().resetProject();
      useAgentStore.getState().reset();
    });

    it("collectFilePaths extracts paths from file tree", async () => {
      const { deriveAgentContext } = await import(
        "@/lib/agent-bridge/project-config-bridge"
      );
      const { useProjectStore } = await import("@/lib/stores/project-store");

      useProjectStore.getState().resetProject();
      useProjectStore.getState().setFiles([
        { id: "1", name: "style.scss", path: "static/src/scss/style.scss", type: "file" },
        {
          id: "2",
          name: "views",
          path: "views",
          type: "directory",
          children: [
            { id: "3", name: "pages.xml", path: "views/pages.xml", type: "file" },
          ],
        },
      ]);

      const context = deriveAgentContext();

      expect(context.existingFiles).toContain("static/src/scss/style.scss");
      expect(context.existingFiles).toContain("views/pages.xml");
      expect(context.existingFiles).toHaveLength(2);

      useProjectStore.getState().resetProject();
    });
  });

  // =========================================================================
  // AI Awareness Protocol
  // =========================================================================

  describe("AI awareness protocol", () => {
    it("creates awareness manager with default state (idle)", async () => {
      const Y = await import("yjs");
      const { Awareness } = await import("y-protocols/awareness");
      const { AiAwarenessManager } = await import(
        "@/lib/agent-bridge/ai-awareness"
      );

      const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      const manager = new AiAwarenessManager(awareness);

      const state = manager.getState();
      expect(state).not.toBeNull();
      expect(state!.isAi).toBe(true);
      expect(state!.name).toBe("Platxa AI");
      expect(state!.color).toBe("#7c3aed");
      expect(state!.phase).toBe("idle");
      expect(state!.filePath).toBeNull();
      expect(state!.cursorPosition).toBeNull();

      manager.dispose();
      doc.destroy();
    });

    it("sets editing state with cursor position", async () => {
      const Y = await import("yjs");
      const { Awareness } = await import("y-protocols/awareness");
      const { AiAwarenessManager } = await import(
        "@/lib/agent-bridge/ai-awareness"
      );

      const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      const manager = new AiAwarenessManager(awareness);

      manager.setEditing(
        "views/pages.xml",
        "generating",
        "Generating hero section...",
        42,
        { start: 40, end: 80 },
      );

      const state = manager.getState();
      expect(state!.phase).toBe("generating");
      expect(state!.filePath).toBe("views/pages.xml");
      expect(state!.message).toBe("Generating hero section...");
      expect(state!.cursorPosition).toBe(42);
      expect(state!.selectionRange).toEqual({ start: 40, end: 80 });
      expect(state!.lastActivity).toBeTruthy();

      manager.dispose();
      doc.destroy();
    });

    it("transitions through editing lifecycle", async () => {
      const Y = await import("yjs");
      const { Awareness } = await import("y-protocols/awareness");
      const { AiAwarenessManager } = await import(
        "@/lib/agent-bridge/ai-awareness"
      );

      const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      const manager = new AiAwarenessManager(awareness);

      // Start editing
      manager.setEditing("style.scss", "analyzing", "Analyzing styles...");
      expect(manager.getState()!.phase).toBe("analyzing");

      // Progress to writing
      manager.setEditing("style.scss", "writing", "Writing SCSS...", 100);
      expect(manager.getState()!.phase).toBe("writing");

      // Complete
      manager.setComplete("style.scss");
      expect(manager.getState()!.phase).toBe("complete");
      expect(manager.getState()!.cursorPosition).toBeNull();

      // Back to idle via dispose
      manager.dispose();
      expect(manager.getState()!.phase).toBe("idle");

      doc.destroy();
    });

    it("accepts custom config", async () => {
      const Y = await import("yjs");
      const { Awareness } = await import("y-protocols/awareness");
      const { AiAwarenessManager } = await import(
        "@/lib/agent-bridge/ai-awareness"
      );

      const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      const manager = new AiAwarenessManager(awareness, {
        name: "Custom AI",
        color: "#ec4899",
        idleTimeoutMs: 5000,
      });

      const state = manager.getState();
      expect(state!.name).toBe("Custom AI");
      expect(state!.color).toBe("#ec4899");

      manager.dispose();
      doc.destroy();
    });

    it("getAwareness returns underlying Awareness instance", async () => {
      const Y = await import("yjs");
      const { Awareness } = await import("y-protocols/awareness");
      const { AiAwarenessManager } = await import(
        "@/lib/agent-bridge/ai-awareness"
      );

      const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      const manager = new AiAwarenessManager(awareness);

      expect(manager.getAwareness()).toBe(awareness);

      manager.dispose();
      doc.destroy();
    });
  });

  // =========================================================================
  // WebSocket File Writer
  // =========================================================================

  describe("WebSocket file writer", () => {
    it("writeThroughWebSocket is exported and callable", async () => {
      const { writeThroughWebSocket } = await import(
        "@/lib/agent-bridge/ws-file-writer"
      );
      expect(typeof writeThroughWebSocket).toBe("function");
    });

    it("writeThroughWebSocket returns empty result for no files", async () => {
      const { writeThroughWebSocket } = await import(
        "@/lib/agent-bridge/ws-file-writer"
      );

      const result = await writeThroughWebSocket([], {
        wsBaseUrl: "ws://localhost:8765",
      });

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(0);
      expect(result.totalFiles).toBe(0);
    });

    it("writeThroughWebSocket returns empty result for missing wsBaseUrl", async () => {
      const { writeThroughWebSocket } = await import(
        "@/lib/agent-bridge/ws-file-writer"
      );

      const result = await writeThroughWebSocket(
        [{ path: "test.txt", content: "hello" }],
        { wsBaseUrl: "" },
      );

      expect(result.success).toBe(false);
      expect(result.usedSidecar).toBe(false);
    });

    it("writeFilesRealtime returns null when no wsBaseUrl configured", async () => {
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      const pipeline = new AgentPipeline({
        enableSidecarWrite: false,
      });

      const result = await pipeline.writeFilesRealtime([
        { path: "test.scss", content: "body { color: red; }" },
      ]);

      expect(result).toBeNull();

      pipeline.dispose();
    });

    it("writeFilesRealtime derives ws URL from sidecar http URL", async () => {
      const { AgentPipeline } = await import("@/lib/agent-bridge/pipeline");

      // Pipeline with HTTP sidecar URL — writeFilesRealtime should derive ws://
      const pipeline = new AgentPipeline({
        enableSidecarWrite: true,
        sidecarBaseUrl: "http://localhost:8765",
      });

      // Will fail to connect (no server running) but should attempt with ws:// URL
      const result = await pipeline.writeFilesRealtime([
        { path: "test.scss", content: ".test { color: red; }" },
      ]);

      // Connection fails gracefully
      expect(result).not.toBeNull();
      expect(result!.usedSidecar).toBe(true);
      expect(result!.filesWritten[0].success).toBe(false);
      expect(result!.filesWritten[0].error).toBeTruthy();

      pipeline.dispose();
    });
  });
});

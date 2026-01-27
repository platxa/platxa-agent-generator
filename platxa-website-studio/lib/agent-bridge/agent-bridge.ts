/**
 * Agent Bridge
 *
 * Connects the platxa-frontend-agent's FrontendOrchestrator to the
 * website-studio's AgentPipeline. This is the core integration layer
 * that wires the two disconnected systems together.
 *
 * The bridge adapts the orchestrator's 5-step pipeline (analyze → generate →
 * animate → theme → accessibility) for Odoo context, extracting the useful
 * outputs (design analysis, theme CSS, a11y audit) while discarding the
 * React-specific component generation.
 */

import {
  FrontendOrchestrator,
  type GenerationRequest,
  type GenerationResult,
  type OrchestratorConfig,
  type OrchestratorEvent,
} from "@platxa/frontend-agent/lib/react-agent/orchestrator";

import {
  getThemePreset,
} from "@platxa/frontend-agent/lib/react-agent/theme";

import type { ColorIntent, LayoutIntent } from "@platxa/frontend-agent/lib/react-agent/design-analyzer";

import type {
  AgentStatus,
  AgentPhase,
  BrandTokenContext,
  DesignAnalysis,
} from "./types";

// =============================================================================
// Configuration
// =============================================================================

export interface AgentBridgeConfig {
  /** FrontendOrchestrator configuration */
  orchestratorConfig?: OrchestratorConfig;
  /** Map orchestrator events to pipeline status updates */
  onStatusChange?: (status: AgentStatus) => void;
}

// =============================================================================
// Input / Output
// =============================================================================

export interface AgentBridgeInput {
  /** User's natural language description */
  description: string;
  /** Brand tokens from pre-generation (used to configure theme) */
  brandTokens?: BrandTokenContext;
  /** Request theme generation through the orchestrator */
  generateTheme?: boolean;
  /** Run accessibility audit through the orchestrator */
  auditAccessibility?: boolean;
}

export interface AgentBridgeResult {
  /** Whether the orchestrator pipeline succeeded */
  success: boolean;
  /** Enhanced design analysis from the frontend-agent's NLP analyzer */
  designAnalysis: DesignAnalysis | null;
  /** Generated theme CSS from the orchestrator's theme step */
  themeCss: string | null;
  /** Accessibility audit score (0-100) */
  accessibilityScore: number | null;
  /** Accessibility issues found */
  accessibilityIssues: string[];
  /** Warnings and suggestions from the orchestrator */
  warnings: string[];
  /** Raw orchestrator result (for debugging/extension) */
  rawResult: GenerationResult | null;
  /** Processing duration in ms */
  durationMs: number;
}

// =============================================================================
// Agent Bridge
// =============================================================================

/**
 * AgentBridge connects the FrontendOrchestrator from platxa-frontend-agent
 * to the website-studio's AgentPipeline.
 *
 * Usage:
 * ```typescript
 * const bridge = new AgentBridge({ orchestratorConfig: { verbose: true } });
 * const result = await bridge.processRequest({
 *   description: "Create a modern hero section with dark theme",
 *   generateTheme: true,
 *   auditAccessibility: true,
 * });
 * ```
 */
export class AgentBridge {
  private orchestrator: FrontendOrchestrator;
  private unsubscribe: (() => void) | null = null;

  constructor(config?: AgentBridgeConfig) {
    this.orchestrator = new FrontendOrchestrator({
      verbose: false,
      failOnA11yErrors: false,
      ...config?.orchestratorConfig,
    });

    if (config?.onStatusChange) {
      this.setupEventBridge(config.onStatusChange);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Processes a generation request through the FrontendOrchestrator's
   * 5-step pipeline and extracts the Odoo-relevant outputs.
   *
   * Steps used:
   * - Step 1 (analyze): Always runs — enhanced NLP design analysis
   * - Step 2 (generate): Runs but output is discarded (React-specific)
   * - Step 3 (animate): Runs but output is discarded (React-specific)
   * - Step 4 (theme): Runs when generateTheme=true — CSS theme output
   * - Step 5 (accessibility): Runs when auditAccessibility=true — a11y audit
   */
  async processRequest(input: AgentBridgeInput): Promise<AgentBridgeResult> {
    const startTime = Date.now();

    try {
      const request = this.buildGenerationRequest(input);
      const result = await this.orchestrator.generate(request);
      const durationMs = Date.now() - startTime;

      return this.mapResult(result, durationMs);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        designAnalysis: null,
        themeCss: null,
        accessibilityScore: null,
        accessibilityIssues: [],
        warnings: [`AgentBridge error: ${message}`],
        rawResult: null,
        durationMs,
      };
    }
  }

  /**
   * Returns the underlying FrontendOrchestrator instance.
   * Useful for direct access when the bridge abstraction is insufficient.
   */
  getOrchestrator(): FrontendOrchestrator {
    return this.orchestrator;
  }

  /**
   * Cleans up event listeners.
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Request Building
  // ---------------------------------------------------------------------------

  /**
   * Builds a FrontendOrchestrator GenerationRequest from AgentBridgeInput.
   * Maps brand tokens to theme config when available.
   */
  private buildGenerationRequest(input: AgentBridgeInput): GenerationRequest {
    const request: GenerationRequest = {
      description: input.description,
      framework: "react", // Orchestrator requires this; we discard component output
      styling: "tailwind",
      typescript: true,
    };

    // Configure theme step
    if (input.generateTheme && input.brandTokens) {
      const baseTheme = getThemePreset("default");
      request.theme = {
        ...baseTheme,
        name: "brand-override",
        light: {
          ...baseTheme.light,
          colors: {
            ...baseTheme.light.colors,
            primary: input.brandTokens.colors.primary,
            background: input.brandTokens.colors.background,
            foreground: input.brandTokens.colors.text,
          },
        },
      };
    } else if (input.generateTheme) {
      request.theme = getThemePreset("default");
    }

    // Configure accessibility step
    if (input.auditAccessibility !== false) {
      request.accessibility = {
        audit: true,
        level: "AA",
      };
    } else {
      request.accessibility = {
        audit: false,
      };
    }

    return request;
  }

  /**
   * Parses a hex color to HSL object for the theme config.
   * Returns a simple HSL approximation since the orchestrator accepts HSL colors.
   */
  private parseHsl(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 50 };

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  // ---------------------------------------------------------------------------
  // Result Mapping
  // ---------------------------------------------------------------------------

  /**
   * Maps the orchestrator's GenerationResult to AgentBridgeResult.
   * Extracts Odoo-relevant outputs and discards React-specific parts.
   */
  private mapResult(result: GenerationResult, durationMs: number): AgentBridgeResult {
    return {
      success: result.success,
      designAnalysis: this.mapDesignAnalysis(result),
      themeCss: result.theme?.css ?? null,
      accessibilityScore: result.audit?.score ?? null,
      accessibilityIssues: this.mapAccessibilityIssues(result),
      warnings: result.warnings,
      rawResult: result,
      durationMs,
    };
  }

  /**
   * Maps the orchestrator's DesignRequirements to the pipeline's DesignAnalysis.
   * The orchestrator's analysis is more granular (React component types),
   * so we map them to Odoo section types where possible.
   */
  private mapDesignAnalysis(result: GenerationResult): DesignAnalysis | null {
    if (!result.requirements) return null;

    const req = result.requirements;

    return {
      componentType: this.mapComponentToOdooSection(req.componentType),
      category: req.category || "generation",
      confidence: req.confidence,
      keywords: req.keywords,
      colorIntent: req.colors
        ? {
            mood: this.inferMoodFromColors(req.colors),
            temperature: this.inferTemperature(req.colors),
          }
        : undefined,
      layoutIntent: req.layout
        ? {
            direction: req.layout.direction,
            alignment: req.layout.align,
          }
        : undefined,
    };
  }

  /**
   * Maps React component types to Odoo section types.
   * The orchestrator detects component types like "button", "card", "modal".
   * We map these to Odoo snippet section types.
   */
  private mapComponentToOdooSection(componentType: string): string {
    const mapping: Record<string, string> = {
      // Direct mappings
      card: "features",
      modal: "cta",
      dialog: "cta",
      alert: "cta",
      // Navigation
      tabs: "features",
      navbar: "header",
      sidebar: "features",
      menu: "header",
      // Content
      list: "features",
      table: "pricing",
      grid: "gallery",
      // Form
      input: "contact",
      form: "contact",
      // Display
      badge: "features",
      avatar: "team",
      tooltip: "features",
      toast: "cta",
      // Generic
      button: "cta",
    };

    return mapping[componentType] || componentType;
  }

  /**
   * Infers a color mood from the orchestrator's color analysis.
   */
  private inferMoodFromColors(colors: ColorIntent): string | undefined {
    const primary = colors.primary;
    if (!primary) return undefined;

    // Basic hue-based mood inference
    const hsl = typeof primary === "string" ? this.parseHsl(primary) : null;
    if (!hsl) return undefined;

    if (hsl.s < 10) return "minimal";
    if (hsl.l < 30) return "dark";
    if (hsl.l > 80) return "light";
    if (hsl.h >= 0 && hsl.h < 30) return "warm";
    if (hsl.h >= 30 && hsl.h < 90) return "warm";
    if (hsl.h >= 200 && hsl.h < 280) return "cool";
    return "professional";
  }

  /**
   * Infers color temperature from the orchestrator's color analysis.
   */
  private inferTemperature(colors: ColorIntent): string | undefined {
    const primary = colors.primary;
    if (!primary) return undefined;

    const hsl = this.parseHsl(primary);
    if (hsl.h >= 0 && hsl.h < 90) return "warm";
    if (hsl.h >= 90 && hsl.h < 200) return "neutral";
    return "cool";
  }

  /**
   * Extracts accessibility issue messages from the audit result.
   */
  private mapAccessibilityIssues(result: GenerationResult): string[] {
    if (!result.audit) return [];

    const issues: string[] = [];

    if (result.audit.issues) {
      for (const issue of result.audit.issues) {
        const severity = issue.severity || "warning";
        const message = issue.message || String(issue);
        issues.push(`[${severity}] ${message}`);
      }
    }

    return issues;
  }

  // ---------------------------------------------------------------------------
  // Event Bridge
  // ---------------------------------------------------------------------------

  /**
   * Maps FrontendOrchestrator events to AgentPipeline status updates.
   * This allows the pipeline's onStatusChange callback to receive
   * real-time updates from the orchestrator.
   */
  private setupEventBridge(onStatusChange: (status: AgentStatus) => void): void {
    this.unsubscribe = this.orchestrator.on((event: OrchestratorEvent) => {
      const status = this.mapOrchestratorEvent(event);
      if (status) {
        onStatusChange(status);
      }
    });
  }

  /**
   * Maps an orchestrator event to an AgentStatus.
   */
  private mapOrchestratorEvent(event: OrchestratorEvent): AgentStatus | null {
    const phaseMap: Record<string, AgentPhase> = {
      "workflow:start": "analyzing",
      "workflow:complete": "complete",
      "workflow:error": "error",
      "step:start": "analyzing",
      "step:complete": "analyzing",
      "step:error": "error",
    };

    // Map step names to more specific phases
    const stepPhaseMap: Record<string, AgentPhase> = {
      analyze: "analyzing",
      generate: "generating_theme",
      animate: "generating_theme",
      theme: "generating_theme",
      accessibility: "auditing_a11y",
    };

    const phase = phaseMap[event.type] || "analyzing";
    let message = "";
    let progress: number | undefined;

    switch (event.type) {
      case "workflow:start":
        message = "Frontend agent: starting analysis...";
        progress = 30;
        break;
      case "workflow:complete":
        message = "Frontend agent: analysis complete";
        progress = 70;
        break;
      case "workflow:error":
        message = `Frontend agent error: ${event.error}`;
        break;
      case "step:start": {
        const stepPhase = stepPhaseMap[event.step];
        message = `Frontend agent: ${event.step}...`;
        progress = this.stepProgress(event.step);
        return {
          phase: stepPhase || phase,
          message,
          progress,
          startedAt: new Date().toISOString(),
        };
      }
      case "step:complete":
        message = `Frontend agent: ${event.step} done (${event.duration}ms)`;
        progress = this.stepProgress(event.step) + 5;
        break;
      case "step:error":
        message = `Frontend agent: ${event.step} failed — ${event.error}`;
        break;
    }

    return {
      phase,
      message,
      progress,
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns a progress percentage for a given orchestrator step.
   */
  private stepProgress(step: string): number {
    const progressMap: Record<string, number> = {
      analyze: 35,
      generate: 45,
      animate: 50,
      theme: 55,
      accessibility: 65,
    };
    return progressMap[step] ?? 40;
  }
}

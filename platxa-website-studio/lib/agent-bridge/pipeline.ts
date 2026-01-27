/**
 * Agent Pipeline
 *
 * Orchestrates the full agent bridge flow:
 *   PRE-GEN → SYSTEM PROMPT → (Ollama streams externally) → POST-GEN → SIDECAR WRITE
 *
 * The pipeline is called from the chat API route. It does NOT own the Ollama
 * streaming — that remains in route.ts. Instead, the pipeline provides:
 *   1. runPreGeneration() — called before Ollama streaming
 *   2. enhanceSystemPrompt() — builds the prompt with brand tokens
 *   3. runPostGeneration() — called after streaming completes
 *   4. writeFiles() — writes files through the sidecar (optional)
 */

import type {
  AgentPipelineConfig,
  AgentPipelineResult,
  AgentStatus,
  PreGenerationResult,
  PostGenerationResult,
  WriteResult,
  BrandTokenContext,
  OdooSectionType,
  PageSectionResult,
  PageGenerationResult,
} from "./types";
import { DEFAULT_PIPELINE_CONFIG, SECTION_SNIPPET_IDS } from "./types";
import { runPreGeneration as execPreGen } from "./pre-generation";
import type { PreGenerationInput } from "./pre-generation";
import { runPostGeneration as execPostGen } from "./post-generation";
import { injectBrandTokens } from "./brand-token-injector";
import { writeThroughSidecar } from "./sidecar-writer";
import { AgentBridge } from "./agent-bridge";
import type { AgentBridgeResult } from "./agent-bridge";

// =============================================================================
// Pipeline Class
// =============================================================================

export class AgentPipeline {
  private config: AgentPipelineConfig;
  private preResult: PreGenerationResult | null = null;
  private postResult: PostGenerationResult | null = null;
  private writeResult: WriteResult | null = null;
  private bridge: AgentBridge | null = null;
  private bridgeResult: AgentBridgeResult | null = null;
  private startTime: number = 0;

  constructor(config?: Partial<AgentPipelineConfig>) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };

    if (this.config.enableFrontendAgent) {
      this.bridge = new AgentBridge({
        ...this.config.frontendAgentConfig,
        onStatusChange: this.config.onStatusChange,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Status reporting
  // ---------------------------------------------------------------------------

  private emitStatus(phase: AgentStatus["phase"], message: string, progress?: number) {
    const status: AgentStatus = {
      phase,
      message,
      progress,
      startedAt: new Date().toISOString(),
    };
    this.config.onStatusChange?.(status);
  }

  // ---------------------------------------------------------------------------
  // Phase 1: Pre-Generation
  // ---------------------------------------------------------------------------

  /**
   * Run pre-generation analysis and brand token mapping.
   * Call this BEFORE starting the Ollama stream.
   */
  async runPreGeneration(input: PreGenerationInput): Promise<PreGenerationResult> {
    this.startTime = Date.now();

    if (!this.config.enablePreGeneration) {
      // Return minimal result with default brand tokens
      const { mapOdooPaletteToBrandTokens } = await import("./color-mapper");
      const brandTokens = mapOdooPaletteToBrandTokens(input.colorPalette);
      this.preResult = {
        designAnalysis: null,
        brandTokens,
        enhancedPromptFragment: "",
        timestamp: new Date().toISOString(),
      };
      return this.preResult;
    }

    this.emitStatus("analyzing", "Analyzing design intent...", 10);

    this.preResult = execPreGen(input);

    this.emitStatus("generating_palette", "Brand tokens ready", 25);

    // Run frontend-agent orchestrator if enabled
    if (this.bridge) {
      this.emitStatus("generating_theme", "Running frontend agent analysis...", 30);

      this.bridgeResult = await this.bridge.processRequest({
        description: input.userMessage,
        brandTokens: this.preResult.brandTokens,
        generateTheme: true,
        auditAccessibility: true,
      });

      // Merge enhanced design analysis if the orchestrator succeeded
      if (this.bridgeResult.success && this.bridgeResult.designAnalysis) {
        this.preResult.designAnalysis = {
          ...this.preResult.designAnalysis,
          ...this.bridgeResult.designAnalysis,
        };
      }
    }

    return this.preResult;
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Enhance System Prompt
  // ---------------------------------------------------------------------------

  /**
   * Builds the enhanced system prompt with brand token injection.
   * Call this after runPreGeneration() to get the prompt for Ollama.
   */
  enhanceSystemPrompt(baseSystemPrompt: string): string {
    if (!this.preResult) return baseSystemPrompt;

    return injectBrandTokens(
      baseSystemPrompt,
      this.preResult.brandTokens,
      this.preResult.enhancedPromptFragment || undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // Page-Level Section Generation
  // ---------------------------------------------------------------------------

  /**
   * Processes each page section through the FrontendOrchestrator individually.
   * Each section gets its own design analysis, theme CSS, and a11y audit.
   *
   * Call this during pre-generation when the user message describes a full page
   * with multiple sections (i.e. generate_page tool invocation).
   */
  async runPageGeneration(
    sections: OdooSectionType[],
    brandTokens?: BrandTokenContext,
  ): Promise<PageGenerationResult> {
    const startTime = Date.now();

    if (!this.bridge || sections.length === 0) {
      return {
        sections: [],
        combinedThemeCss: "",
        averageAccessibilityScore: null,
        totalDurationMs: Date.now() - startTime,
      };
    }

    const tokens = brandTokens ?? this.preResult?.brandTokens;
    const sectionResults: PageSectionResult[] = [];

    for (let i = 0; i < sections.length; i++) {
      const sectionType = sections[i];
      const snippetId = SECTION_SNIPPET_IDS[sectionType];
      const progress = 30 + Math.round((i / sections.length) * 40);

      this.emitStatus(
        "generating_theme",
        `Processing section ${i + 1}/${sections.length}: ${sectionType}`,
        progress,
      );

      const result = await this.bridge.processRequest({
        description: `A ${sectionType} section for an Odoo website page`,
        brandTokens: tokens ?? undefined,
        generateTheme: true,
        auditAccessibility: true,
      });

      sectionResults.push({
        sectionType,
        snippetId,
        designAnalysis: result.designAnalysis,
        themeCss: result.themeCss,
        accessibilityScore: result.accessibilityScore,
        accessibilityIssues: result.accessibilityIssues,
        success: result.success,
        durationMs: result.durationMs,
      });
    }

    // Combine theme CSS from all sections
    const combinedThemeCss = sectionResults
      .filter((s) => s.themeCss)
      .map((s) => `/* ${s.snippetId} */\n${s.themeCss}`)
      .join("\n\n");

    // Average accessibility score
    const scores = sectionResults
      .map((s) => s.accessibilityScore)
      .filter((s): s is number => s !== null);
    const averageAccessibilityScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

    this.emitStatus("generating_theme", "All sections processed", 70);

    return {
      sections: sectionResults,
      combinedThemeCss,
      averageAccessibilityScore,
      totalDurationMs: Date.now() - startTime,
    };
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Post-Generation
  // ---------------------------------------------------------------------------

  /**
   * Run post-generation analysis (accessibility audit, brand consistency).
   * Call this AFTER the Ollama stream completes.
   */
  async runPostGeneration(generatedCode: string): Promise<PostGenerationResult | null> {
    if (!this.config.enablePostGeneration || !this.preResult) {
      return null;
    }

    this.emitStatus("auditing_a11y", "Checking accessibility...", 75);

    this.postResult = execPostGen({
      generatedCode,
      brandTokens: this.preResult.brandTokens,
    });

    this.emitStatus("computing_quality", `Quality score: ${this.postResult.quality.overallScore}/100`, 85);

    return this.postResult;
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Write Files Through Sidecar
  // ---------------------------------------------------------------------------

  /**
   * Writes generated files through the editor-sync sidecar.
   * Call this after post-generation to persist files.
   */
  async writeFiles(
    files: Array<{ path: string; content: string }>,
  ): Promise<WriteResult | null> {
    if (!this.config.enableSidecarWrite || !this.config.sidecarBaseUrl) {
      return null;
    }

    this.emitStatus("writing_files", `Writing ${files.length} files...`, 90);

    this.writeResult = await writeThroughSidecar(files, {
      sidecarBaseUrl: this.config.sidecarBaseUrl,
    });

    return this.writeResult;
  }

  // ---------------------------------------------------------------------------
  // Finalize
  // ---------------------------------------------------------------------------

  /**
   * Returns the complete pipeline result.
   * Call this after all phases complete.
   */
  finalize(): AgentPipelineResult {
    const totalDurationMs = Date.now() - this.startTime;

    this.emitStatus("complete", "Generation complete", 100);

    const preGeneration = this.preResult || {
      designAnalysis: null,
      brandTokens: {
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
      },
      enhancedPromptFragment: "",
      timestamp: new Date().toISOString(),
    };

    return {
      preGeneration,
      postGeneration: this.postResult,
      filesWritten: this.writeResult,
      designTokens: preGeneration.brandTokens.designTokens ?? null,
      frontendAgentResult: this.bridgeResult,
      totalDurationMs,
    };
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  /** Get the brand tokens from pre-generation (for UI display) */
  getBrandTokens(): BrandTokenContext | null {
    return this.preResult?.brandTokens ?? null;
  }

  /** Get the DTCG design tokens (when available) */
  getDesignTokens(): import("../design-tokens/types").DesignTokenSet | null {
    return this.preResult?.brandTokens.designTokens ?? null;
  }

  /** Get the quality report from post-generation */
  getQualityScore(): number | null {
    return this.postResult?.quality.overallScore ?? null;
  }

  /** Get the frontend-agent bridge result (when enableFrontendAgent=true) */
  getFrontendAgentResult(): AgentBridgeResult | null {
    return this.bridgeResult;
  }

  /** Clean up resources (event listeners, etc.) */
  dispose(): void {
    this.bridge?.dispose();
  }
}

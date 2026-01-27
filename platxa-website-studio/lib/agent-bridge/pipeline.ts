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
} from "./types";
import { DEFAULT_PIPELINE_CONFIG } from "./types";
import { runPreGeneration as execPreGen } from "./pre-generation";
import type { PreGenerationInput } from "./pre-generation";
import { runPostGeneration as execPostGen } from "./post-generation";
import { injectBrandTokens } from "./brand-token-injector";
import { writeThroughSidecar } from "./sidecar-writer";

// =============================================================================
// Pipeline Class
// =============================================================================

export class AgentPipeline {
  private config: AgentPipelineConfig;
  private preResult: PreGenerationResult | null = null;
  private postResult: PostGenerationResult | null = null;
  private writeResult: WriteResult | null = null;
  private startTime: number = 0;

  constructor(config?: Partial<AgentPipelineConfig>) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
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

    return {
      preGeneration: this.preResult || {
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
      },
      postGeneration: this.postResult,
      filesWritten: this.writeResult,
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

  /** Get the quality report from post-generation */
  getQualityScore(): number | null {
    return this.postResult?.quality.overallScore ?? null;
  }
}

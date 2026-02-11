import { buildSystemPrompt } from "@/lib/ai/system-prompts";
import { AgentPipeline } from "@/lib/agent-bridge/pipeline";
import { Agent } from "undici";
import Anthropic from "@anthropic-ai/sdk";
import {
  createRateLimitState,
  checkRateLimit,
  recordApiCall,
  type RateLimitState,
} from "@/lib/agent-bridge/rate-limiter";

// Credit System Integration
import { auth } from "@/lib/auth";
import {
  getCreditBalance,
  deductForThemeGeneration,
  deductForIteration,
  CREDIT_COSTS,
} from "@/lib/services/credit-service";

// Phase 1: Production-Grade Integrations
import { createRAGPipeline, type RAGQueryResult } from "@/lib/agent-bridge/rag-pipeline";
import { classifyTask, type ClassificationResult } from "@/lib/ai/task-classifier";
import {
  routeTask,
  getOrchestrator,
  type RoutingDecision,
  type TaskType,
  type ModelId,
  type ModelConfig,
} from "@/lib/ai/model-orchestrator";
import {
  validateGeneratedCode,
  buildCorrectionPrompt,
  calculateQualityScore,
  shouldAttemptCorrection,
  formatValidationSummary,
  type ValidationSummary,
  type SelfCorrectionOptions,
} from "@/lib/ai/self-correction-loop";
import {
  evaluateWithCritic,
  buildCorrectionPromptFromCritic,
  formatCriticReport,
  type CriticReport,
} from "@/lib/ai/critic-agent";
import { parseGeneratedFiles, type ParsedFile } from "@/lib/ai/parser";

// Generation Recovery (Feature #7)
import {
  createGenerationState,
  prepareForGeneration,
  handleGenerationFailure,
  completeGeneration,
  resetAfterFailure,
  type GenerationState,
} from "@/lib/agent-bridge/generation-recovery";

// =============================================================================
// Self-Correction Configuration
// =============================================================================

/** Maximum correction iterations before giving up */
const MAX_CORRECTION_ITERATIONS = 3;

/** Minimum quality score to accept (0-100) */
const MIN_QUALITY_SCORE = 80;

/** Self-correction options */
const SELF_CORRECTION_OPTIONS: SelfCorrectionOptions = {
  maxIterations: MAX_CORRECTION_ITERATIONS,
  minQualityScore: MIN_QUALITY_SCORE,
  includeWarnings: false,
};

// Sidecar configuration (optional - for writing files through editor-sync)
const SIDECAR_BASE_URL = process.env.SIDECAR_BASE_URL || "";
const ENABLE_AGENT_BRIDGE = process.env.ENABLE_AGENT_BRIDGE !== "false";

// Rate limiting state (global for now - in production use per-user/session)
let rateLimitState: RateLimitState = createRateLimitState({
  maxRequestsPerMinute: 20,
  maxTokensPerMinute: 50000,
  sessionTokenBudget: 500000,
});

// Generation recovery state (global for now - in production use per-session)
let generationState: GenerationState = createGenerationState({ maxRetries: 3 });

// Increase timeout for local LLM (10 minutes max)
export const maxDuration = 600;

// AI Provider Configuration - reads from environment variables (secure)
// Priority: 1. Claude API (fast, production quality) if ANTHROPIC_API_KEY env var is set
//           2. Ollama (local, free, slower) as fallback
const CLAUDE_MODEL_DEFAULT = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

// Model ID mapping: Orchestrator model IDs -> Provider model IDs
const ANTHROPIC_MODEL_MAP: Partial<Record<ModelId, string>> = {
  "claude-3-opus": "claude-3-opus-20240229",
  "claude-3-sonnet": "claude-3-sonnet-20240229",
  "claude-3.5-sonnet": "claude-sonnet-4-20250514",
  "claude-3-haiku": "claude-3-haiku-20240307",
};

const OPENAI_MODEL_MAP: Partial<Record<ModelId, string>> = {
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4-turbo": "gpt-4-turbo",
  "o1-preview": "o1-preview",
  "o1-mini": "o1-mini",
};

/**
 * Resolves orchestrator model config to actual provider model ID
 */
function resolveModelId(modelConfig: ModelConfig): { provider: "anthropic" | "openai" | "ollama"; modelId: string } {
  if (modelConfig.provider === "anthropic") {
    const modelId = ANTHROPIC_MODEL_MAP[modelConfig.id] || CLAUDE_MODEL_DEFAULT;
    return { provider: "anthropic", modelId };
  }
  if (modelConfig.provider === "openai") {
    const modelId = OPENAI_MODEL_MAP[modelConfig.id] || "gpt-4o";
    return { provider: "openai", modelId };
  }
  // Fallback to Ollama for local/other providers
  return { provider: "ollama", modelId: OLLAMA_MODEL };
}

// Ollama configuration (fallback or primary if no Claude API key)
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes for generation (local LLMs are slow)

// Initialize Anthropic client - uses ANTHROPIC_API_KEY from environment automatically
// Returns null if env var not set, allowing graceful fallback to Ollama
function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic();
}

// Custom HTTP agent with extended timeouts for local LLM
// Default undici headersTimeout is 300s which may be exceeded when Ollama loads model
const ollamaAgent = new Agent({
  headersTimeout: REQUEST_TIMEOUT_MS,
  bodyTimeout: REQUEST_TIMEOUT_MS,
  keepAliveTimeout: 60000,
  connect: {
    timeout: 30000, // 30s connection timeout
  },
});

interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatMessage {
  role: string;
  content: string;
}

interface ProjectContext {
  projectName?: string;
  industry?: string;
  colorPalette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  existingFiles?: string[];
  designStyle?: string;
  /** File contents for RAG indexing */
  fileContents?: Record<string, string>;
}

// =============================================================================
// RAG Pipeline Cache (per-project)
// =============================================================================

interface RAGCacheEntry {
  pipeline: ReturnType<typeof createRAGPipeline>;
  lastUpdated: number;
  fileCount: number;
}

const ragCache = new Map<string, RAGCacheEntry>();
const RAG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Gets or creates a RAG pipeline for the project
 */
function getRAGPipeline(
  projectId: string,
  fileContents?: Record<string, string>
): ReturnType<typeof createRAGPipeline> | null {
  if (!fileContents || Object.keys(fileContents).length === 0) {
    return null;
  }

  const cached = ragCache.get(projectId);
  const now = Date.now();

  // Use cached if fresh and same file count
  if (cached && now - cached.lastUpdated < RAG_CACHE_TTL) {
    const newFileCount = Object.keys(fileContents).length;
    if (cached.fileCount === newFileCount) {
      return cached.pipeline;
    }
    // File count changed, reindex
    cached.pipeline.reindex(fileContents);
    cached.lastUpdated = now;
    cached.fileCount = newFileCount;
    return cached.pipeline;
  }

  // Create new pipeline
  const pipeline = createRAGPipeline(fileContents, {
    chunkSize: 40,
    chunkOverlap: 8,
    extensions: ["xml", "scss", "css", "py", "js", "ts", "html"],
  });

  ragCache.set(projectId, {
    pipeline,
    lastUpdated: now,
    fileCount: Object.keys(fileContents).length,
  });

  console.log(`[RAG] Indexed ${pipeline.chunkCount} chunks for project ${projectId}`);
  return pipeline;
}

/**
 * Builds RAG context from user message
 */
function buildRAGContext(
  ragPipeline: ReturnType<typeof createRAGPipeline>,
  userMessage: string,
  maxTokens = 3000
): string {
  const result: RAGQueryResult = ragPipeline.query(userMessage, 5);

  if (result.results.length === 0) {
    return "";
  }

  const contextParts: string[] = [
    "## Relevant Code Context from Project",
    "",
  ];

  let currentTokens = 0;
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);

  for (const r of result.results) {
    const chunk = r.chunk;
    const chunkText = `### ${chunk.file} (lines ${chunk.startLine}-${chunk.endLine})\n\`\`\`${chunk.language}\n${chunk.content}\n\`\`\`\n`;
    const chunkTokens = estimateTokens(chunkText);

    if (currentTokens + chunkTokens > maxTokens) {
      break;
    }

    contextParts.push(chunkText);
    currentTokens += chunkTokens;
  }

  console.log(`[RAG] Retrieved ${result.results.length} chunks (${result.durationMs}ms)`);
  return contextParts.join("\n");
}

/**
 * Maps task classification to model orchestrator task type
 */
function mapToOrchestratorTaskType(classification: ClassificationResult): TaskType {
  // Direct mapping for most types
  return classification.primaryType;
}

/**
 * Enhances system prompt with RAG context
 */
function enhancePromptWithRAG(basePrompt: string, ragContext: string): string {
  if (!ragContext) {
    return basePrompt;
  }

  return `${basePrompt}

<codebase_context>
${ragContext}
</codebase_context>

Use the codebase context above to understand existing patterns, naming conventions, and code structure.
When generating code, follow the same patterns and styles shown in the context.`;
}

// =============================================================================
// RAG Pattern Extraction for Validation
// =============================================================================

interface ExtractedPatterns {
  namingConventions: string[];
  filePatterns: string[];
  directivesUsed: string[];
  scssVariables: string[];
}

/**
 * Extracts patterns from RAG context for validation
 */
function extractPatternsFromRAG(ragContext: string): ExtractedPatterns {
  const patterns: ExtractedPatterns = {
    namingConventions: [],
    filePatterns: [],
    directivesUsed: [],
    scssVariables: [],
  };

  if (!ragContext) return patterns;

  // Extract QWeb directive patterns
  const directiveMatches = ragContext.match(/t-(?:if|foreach|esc|raw|set|call|name|attf?-\w+)(?==|>|\s)/g);
  if (directiveMatches) {
    patterns.directivesUsed = Array.from(new Set(directiveMatches));
  }

  // Extract SCSS variable patterns
  const scssVarMatches = ragContext.match(/\$[\w-]+/g);
  if (scssVarMatches) {
    patterns.scssVariables = Array.from(new Set(scssVarMatches));
  }

  // Extract template naming patterns (e.g., website.template_name)
  const templateMatches = ragContext.match(/t-name=["']([^"']+)["']/g);
  if (templateMatches) {
    patterns.namingConventions = templateMatches.map(m => {
      const match = m.match(/t-name=["']([^"']+)["']/);
      return match ? match[1].split('.')[0] : '';
    }).filter(Boolean);
    patterns.namingConventions = Array.from(new Set(patterns.namingConventions));
  }

  return patterns;
}

/**
 * Validates generated code against RAG-extracted patterns
 */
function validateAgainstRAGPatterns(
  generatedCode: string,
  patterns: ExtractedPatterns
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check if generated code uses unknown SCSS variables not in codebase
  const generatedScssVars = generatedCode.match(/\$[\w-]+/g) || [];
  const unknownVars = generatedScssVars.filter(v =>
    !patterns.scssVariables.includes(v) &&
    !v.startsWith('$o-') && // Odoo variables
    !v.startsWith('$bs-')   // Bootstrap variables
  );

  if (unknownVars.length > 3 && patterns.scssVariables.length > 0) {
    // Only flag if codebase has established patterns and many unknowns
    issues.push(`Generated code uses ${unknownVars.length} SCSS variables not found in codebase. Consider using existing variables: ${patterns.scssVariables.slice(0, 5).join(', ')}`);
  }

  // Check template naming consistency
  const generatedTemplates = generatedCode.match(/t-name=["']([^"']+)["']/g) || [];
  if (generatedTemplates.length > 0 && patterns.namingConventions.length > 0) {
    const expectedPrefix = patterns.namingConventions[0];
    const wrongPrefix = generatedTemplates.filter(t => {
      const match = t.match(/t-name=["']([^"']+)["']/);
      return match && !match[1].startsWith(expectedPrefix) && !match[1].startsWith('website.');
    });

    if (wrongPrefix.length > 0) {
      issues.push(`Template names should follow existing convention (prefix: ${expectedPrefix}). Found: ${wrongPrefix.slice(0, 2).join(', ')}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// =============================================================================
// Self-Correction Loop Implementation
// =============================================================================

interface CorrectionAttempt {
  iteration: number;
  validation: ValidationSummary;
  qualityScore: number;
  corrected: boolean;
}

/**
 * Runs self-correction loop on generated code
 * Returns corrected content or original if max iterations reached
 */
async function runSelfCorrectionLoop(
  originalPrompt: string,
  generatedCode: string,
  systemPrompt: string,
  modelId: string,
  ragPatterns: ExtractedPatterns
): Promise<{
  finalContent: string;
  attempts: CorrectionAttempt[];
  wasCorrrected: boolean;
  criticReport?: CriticReport;
}> {
  const attempts: CorrectionAttempt[] = [];
  let currentContent = generatedCode;
  let wasCorrrected = false;
  let latestCriticReport: CriticReport | undefined;

  for (let iteration = 1; iteration <= MAX_CORRECTION_ITERATIONS; iteration++) {
    // CRITIC AGENT: Parse and evaluate generated files
    let parsedFiles: ParsedFile[] = [];
    try {
      parsedFiles = parseGeneratedFiles(currentContent);
    } catch {
      console.log(`[SelfCorrection] Could not parse content for critic evaluation`);
    }

    // Run Critic Agent evaluation if we have parsed files
    if (parsedFiles.length > 0) {
      latestCriticReport = evaluateWithCritic(parsedFiles, iteration);
      console.log(`[Critic] ${formatCriticReport(latestCriticReport).split('\n').slice(0, 3).join(' | ')}`);

      // If critic says quality is acceptable, we can stop early
      if (latestCriticReport.grade === 'A' || latestCriticReport.grade === 'B') {
        console.log(`[Critic] Grade ${latestCriticReport.grade} - quality acceptable, skipping further iterations`);
        break;
      }
    }

    // Validate current content (existing validation)
    const validation = validateGeneratedCode(currentContent);
    const qualityScore = calculateQualityScore(validation);

    // Also validate against RAG patterns
    const ragValidation = validateAgainstRAGPatterns(currentContent, ragPatterns);

    // Merge RAG issues into validation
    if (!ragValidation.valid) {
      for (const issue of ragValidation.issues) {
        validation.results.push({
          file: "rag-pattern-check",
          type: "unknown",
          valid: false,
          errors: [{ message: issue }],
          warnings: [],
        });
        validation.totalErrors += 1;
        validation.allValid = false;
      }
      // Rebuild error prompt with RAG issues
      if (validation.errorPrompt) {
        validation.errorPrompt += `\n### RAG Pattern Violations\n${ragValidation.issues.map(i => `- ${i}`).join('\n')}\n`;
      }
    }

    attempts.push({
      iteration,
      validation,
      qualityScore,
      corrected: false,
    });

    console.log(`[SelfCorrection] Iteration ${iteration}: ${formatValidationSummary(validation)}`);

    // Check if we should stop
    if (!shouldAttemptCorrection(validation, SELF_CORRECTION_OPTIONS)) {
      console.log(`[SelfCorrection] Quality acceptable (score: ${qualityScore}), stopping loop`);
      break;
    }

    // Don't attempt correction on last iteration
    if (iteration === MAX_CORRECTION_ITERATIONS) {
      console.log(`[SelfCorrection] Max iterations reached, returning best effort`);
      break;
    }

    // Build correction prompt with critic feedback if available
    let correctionPrompt: string;
    if (latestCriticReport && latestCriticReport.errorCount > 0) {
      // Use critic-enhanced prompt for better feedback
      correctionPrompt = buildCorrectionPromptFromCritic(originalPrompt, currentContent, latestCriticReport);
      console.log(`[SelfCorrection] Using critic-enhanced correction prompt`);
    } else {
      correctionPrompt = buildCorrectionPrompt(originalPrompt, currentContent, validation);
    }

    console.log(`[SelfCorrection] Attempting correction with ${validation.totalErrors} errors...`);

    try {
      // Make synchronous correction call (non-streaming for simplicity)
      const correctedContent = await callAIForCorrection(
        systemPrompt,
        correctionPrompt,
        modelId
      );

      if (correctedContent && correctedContent.trim() !== currentContent.trim()) {
        currentContent = correctedContent;
        wasCorrrected = true;
        attempts[attempts.length - 1].corrected = true;
        console.log(`[SelfCorrection] Correction applied, re-validating...`);
      } else {
        console.log(`[SelfCorrection] No meaningful correction returned`);
        break;
      }
    } catch (error) {
      console.error(`[SelfCorrection] Correction call failed:`, error);
      break;
    }
  }

  return { finalContent: currentContent, attempts, wasCorrrected, criticReport: latestCriticReport };
}

/**
 * Makes a non-streaming AI call for correction
 */
async function callAIForCorrection(
  systemPrompt: string,
  correctionPrompt: string,
  modelId: string
): Promise<string> {
  const client = getAnthropicClient();

  if (client) {
    // Use Claude API for correction
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: correctionPrompt }],
    });

    // Extract text content
    const textBlock = response.content.find(block => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : "";
  }

  // Fallback to Ollama for correction
  const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: correctionPrompt },
      ],
      stream: false,
      options: {
        temperature: 0.3, // Lower temperature for corrections
        num_predict: 4096,
      },
    }),
  });

  if (!ollamaResponse.ok) {
    throw new Error(`Ollama correction call failed: ${ollamaResponse.statusText}`);
  }

  const data = await ollamaResponse.json();
  return data.message?.content || "";
}

/**
 * Stream response from Claude API
 * Returns a ReadableStream compatible with AI SDK format
 */
async function streamClaudeResponse(
  systemPrompt: string,
  messages: ChatMessage[],
  pipeline: AgentPipeline | null,
  modelId: string,
  originalUserMessage: string,
  ragPatterns: ExtractedPatterns,
  creditContext?: { userId: string; projectId: string; isGeneration: boolean }
): Promise<Response> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error("Claude API not configured");
  }

  const encoder = new TextEncoder();
  let fullResponseText = "";
  let lastUsageStats = { promptTokens: 0, completionTokens: 0 };

  // Progress emission helper - emits phase updates via 2: data format
  type AgentPhase = "analyzing" | "streaming" | "post_processing" | "computing_quality" | "complete" | "error";
  const emitProgress = (
    safeEnqueue: (chunk: Uint8Array) => boolean,
    phase: AgentPhase,
    progress: number,
    message: string
  ) => {
    const progressData = {
      agentProgress: {
        phase,
        progress: Math.min(100, Math.max(0, progress)),
        message,
        timestamp: Date.now(),
      },
    };
    const progressChunk = `2:${JSON.stringify([progressData])}\n`;
    safeEnqueue(encoder.encode(progressChunk));
  };

  // Convert messages to Anthropic format
  const anthropicMessages = messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  const stream = await client.messages.stream({
    model: modelId,
    max_tokens: 4096,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const transformedStream = new ReadableStream({
    async start(controller) {
      let isStreamClosed = false;

      const safeEnqueue = (chunk: Uint8Array): boolean => {
        if (isStreamClosed) return false;
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          isStreamClosed = true;
          return false;
        }
      };

      const safeClose = () => {
        if (isStreamClosed) return;
        isStreamClosed = true;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      try {
        // Emit initial streaming phase
        emitProgress(safeEnqueue, "streaming", 10, "Generating content...");

        for await (const event of stream) {
          if (event.type === "content_block_delta") {
            const delta = event.delta;
            if ("text" in delta) {
              fullResponseText += delta.text;
              const aiChunk = `0:${JSON.stringify(delta.text)}\n`;
              if (!safeEnqueue(encoder.encode(aiChunk))) break;
            }
          } else if (event.type === "message_delta") {
            // Capture usage from final message
            if ("usage" in event) {
              lastUsageStats.completionTokens = event.usage?.output_tokens || 0;
            }
          } else if (event.type === "message_start") {
            if (event.message?.usage) {
              lastUsageStats.promptTokens = event.message.usage.input_tokens || 0;
            }
          }
        }

        // Run post-generation pipeline if available
        if (pipeline && fullResponseText && !isStreamClosed) {
          try {
            // Emit post-processing phase
            emitProgress(safeEnqueue, "post_processing", 60, "Processing generated content...");

            const postResult = await pipeline.runPostGeneration(fullResponseText);
            if (postResult && !isStreamClosed) {
              // Emit quality computation phase
              emitProgress(safeEnqueue, "computing_quality", 80, "Computing quality score...");

              const qualityData = {
                agentQuality: {
                  score: postResult.quality.overallScore,
                  accessibility: postResult.quality.accessibility.score,
                  brandConsistency: postResult.quality.brandConsistency,
                  issueCount: postResult.quality.accessibility.issues.length,
                },
              };
              const qualityChunk = `2:${JSON.stringify([qualityData])}\n`;
              safeEnqueue(encoder.encode(qualityChunk));
            }
            pipeline.finalize();
          } catch (err) {
            console.warn("Agent post-generation warning:", err);
          }
        }

        // =====================================================================
        // PHASE 1: Self-Correction Loop (ACTUALLY RUNS NOW!)
        // =====================================================================
        if (fullResponseText && !isStreamClosed) {
          try {
            // Run the full self-correction loop
            const correctionResult = await runSelfCorrectionLoop(
              originalUserMessage,
              fullResponseText,
              systemPrompt,
              modelId,
              ragPatterns
            );

            const finalValidation = validateGeneratedCode(correctionResult.finalContent);
            const finalQualityScore = calculateQualityScore(finalValidation);

            console.log(`[SelfCorrection] Final: ${formatValidationSummary(finalValidation)} (corrected: ${correctionResult.wasCorrrected})`);

            // If content was corrected, stream the corrected version
            if (correctionResult.wasCorrrected && !isStreamClosed) {
              // Send correction marker
              const correctionMarker = `2:${JSON.stringify([{ selfCorrectionApplied: true, iterations: correctionResult.attempts.length }])}\n`;
              safeEnqueue(encoder.encode(correctionMarker));

              // Stream the corrected content (replace previous content)
              const correctedChunk = `0:${JSON.stringify("\n\n---\n**[Auto-Corrected Version]**\n\n" + correctionResult.finalContent)}\n`;
              safeEnqueue(encoder.encode(correctedChunk));
            }

            // Send validation metadata to client
            if (!isStreamClosed) {
              const validationData = {
                codeValidation: {
                  valid: finalValidation.allValid,
                  qualityScore: finalQualityScore,
                  errorCount: finalValidation.totalErrors,
                  warningCount: finalValidation.totalWarnings,
                  needsCorrection: shouldAttemptCorrection(finalValidation),
                  correctionAttempts: correctionResult.attempts.length,
                  wasCorrected: correctionResult.wasCorrrected,
                },
              };
              const validationChunk = `2:${JSON.stringify([validationData])}\n`;
              safeEnqueue(encoder.encode(validationChunk));
            }
          } catch (err) {
            console.warn("Self-correction loop warning:", err);
          }
        }

        // Record API call for rate limiting
        if (lastUsageStats.promptTokens > 0 || lastUsageStats.completionTokens > 0) {
          const { state: newState, newAlerts } = recordApiCall(
            rateLimitState,
            lastUsageStats.promptTokens,
            lastUsageStats.completionTokens,
            modelId
          );
          rateLimitState = newState;
          for (const alert of newAlerts) {
            console.warn(`[RateLimit] Budget alert: ${alert.label} (${alert.currentUsage}/${alert.budgetLimit})`);
          }
        }

        // Deduct credits after successful generation
        if (creditContext?.userId) {
          try {
            const deductFn = creditContext.isGeneration
              ? deductForThemeGeneration
              : deductForIteration;
            const result = await deductFn(
              creditContext.userId,
              creditContext.projectId,
              lastUsageStats.promptTokens + lastUsageStats.completionTokens
            );
            if (result.success) {
              console.log(`[Credits] Deducted credits for ${creditContext.isGeneration ? 'generation' : 'iteration'}. New balance: ${result.newBalance}`);
            } else {
              console.warn(`[Credits] Failed to deduct credits: ${result.error}`);
            }
          } catch (creditError) {
            console.error("[Credits] Error deducting credits:", creditError);
          }
        }

        // Send finish message - AI SDK v3 uses `d:` for finish_message
        // (verified from @ai-sdk/ui-utils source: finishMessageStreamPart.code = "d")
        // Emit completion phase
        emitProgress(safeEnqueue, "complete", 100, "Generation complete");

        // NOTE: `e:` is for finish_STEP (multi-step), `d:` is for finish_MESSAGE (end stream)
        if (!isStreamClosed) {
          const finishData = {
            finishReason: "stop",
            usage: {
              promptTokens: lastUsageStats.promptTokens,
              completionTokens: lastUsageStats.completionTokens,
            },
          };
          const finishChunk = `d:${JSON.stringify(finishData)}\n`;
          console.log("[Claude API] Sending finish_message (d:) signal");
          safeEnqueue(encoder.encode(finishChunk));
        }
      } catch (error) {
        console.error("Claude stream error:", error);

        // Feature #7: Handle generation failure with recovery
        const errorMessage = error instanceof Error ? error.message : "Stream processing failed";
        const failureResult = handleGenerationFailure(
          generationState,
          errorMessage,
          "streaming",
          [], // affectedSections - determined by client
          fullResponseText.length > 0, // hasPartialOutput
          {
            onRecoveryStart: (plan) => {
              console.log(`[Recovery] Starting ${plan.strategy} recovery...`);
            },
            onRecoveryComplete: (result) => {
              console.log(`[Recovery] ${result.success ? "Success" : "Failed"}: ${result.message}`);
            },
          }
        );
        generationState = failureResult.state;

        if (!isStreamClosed) {
          // Emit recovery metadata to client
          const recoveryData = {
            generationRecovery: {
              strategy: failureResult.plan.strategy,
              success: failureResult.result.success,
              message: failureResult.result.message,
              shouldRetry: failureResult.shouldRetry,
              retryCount: failureResult.state.retryCount,
            },
          };
          const recoveryChunk = `2:${JSON.stringify([recoveryData])}\n`;
          safeEnqueue(encoder.encode(recoveryChunk));

          const errorChunk = `3:${JSON.stringify({ error: errorMessage })}\n`;
          safeEnqueue(encoder.encode(errorChunk));
        }
      } finally {
        safeClose();
      }
    },
  });

  return new Response(transformedStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

/**
 * Check if Ollama is available
 */
async function checkOllamaHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { ok: false, error: "Ollama API returned an error" };
    }

    const data = await response.json();
    const models = data.models || [];
    const hasModel = models.some((m: { name: string }) =>
      m.name === OLLAMA_MODEL || m.name.startsWith(OLLAMA_MODEL.split(":")[0])
    );

    if (!hasModel) {
      return {
        ok: false,
        error: `Model ${OLLAMA_MODEL} not found. Available: ${models.map((m: { name: string }) => m.name).join(", ")}`
      };
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Ollama connection timeout" };
    }
    return { ok: false, error: "Cannot connect to Ollama" };
  }
}

/**
 * POST /api/chat
 * Handles chat messages and streams AI responses via Ollama
 */
export async function POST(req: Request) {
  try {
    // Parse request body
    let body: unknown;
    try {
      const text = await req.text();
      if (!text || text.trim() === "") {
        return errorResponse("Request body is empty", 400);
      }
      body = JSON.parse(text);
    } catch {
      return errorResponse("Invalid JSON in request body", 400);
    }

    if (!body || typeof body !== "object") {
      return errorResponse("Request body must be an object", 400);
    }

    const { messages, projectContext, projectId, preferencePrompt } = body as {
      messages?: unknown;
      projectContext?: ProjectContext;
      projectId?: string;
      preferencePrompt?: string; // User preferences from cross-session memory
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return errorResponse("Messages array is required and cannot be empty", 400);
    }

    // =========================================================================
    // PHASE 1: Task Classification & Model Routing
    // =========================================================================
    const lastUserMessage = [...(messages as ChatMessage[])]
      .reverse()
      .find((m) => m.role === "user");
    const userMessageContent = lastUserMessage?.content || "";

    // Classify the task to determine optimal model and approach
    const taskClassification = classifyTask(userMessageContent);
    const taskType = mapToOrchestratorTaskType(taskClassification);

    // Route to optimal model based on task type
    const routingDecision = routeTask({
      type: taskType,
      requiresStreaming: true,
      estimatedTokens: 2000,
    });

    console.log(`[TaskClassifier] Type: ${taskClassification.primaryType} (${taskClassification.confidence}% confidence)`);
    console.log(`[ModelOrchestrator] Selected: ${routingDecision.model.displayName} - ${routingDecision.reason}`);

    // Resolve the actual model ID to use based on routing decision
    const resolvedModel = resolveModelId(routingDecision.model);
    console.log(`[ModelRouting] Using ${resolvedModel.provider}/${resolvedModel.modelId}`);

    // =========================================================================
    // PHASE 1: RAG Context Retrieval
    // =========================================================================
    let ragContext = "";
    const effectiveProjectId = projectId || projectContext?.projectName || "default";

    // Build RAG pipeline from project files
    const ragPipeline = getRAGPipeline(
      effectiveProjectId,
      projectContext?.fileContents
    );

    if (ragPipeline) {
      ragContext = buildRAGContext(ragPipeline, userMessageContent, 3000);
      if (ragContext) {
        console.log(`[RAG] Added ${Math.ceil(ragContext.length / 4)} tokens of context`);
      }
    }

    // Extract patterns from RAG context for validation
    const ragPatterns = extractPatternsFromRAG(ragContext);
    if (ragPatterns.directivesUsed.length > 0 || ragPatterns.scssVariables.length > 0) {
      console.log(`[RAG] Extracted ${ragPatterns.directivesUsed.length} directive patterns, ${ragPatterns.scssVariables.length} SCSS variables`);
    }

    // Check rate limit before proceeding
    const estimatedTokens = 2000 + Math.ceil(ragContext.length / 4); // Include RAG context
    const rateLimitCheck = checkRateLimit(rateLimitState, estimatedTokens);
    if (!rateLimitCheck.allowed) {
      return errorResponse(
        rateLimitCheck.reason || "Rate limit exceeded",
        429,
        "RATE_LIMITED"
      );
    }

    // =========================================================================
    // CREDIT CHECK - Verify user has sufficient credits
    // =========================================================================
    let userId: string | null = null;
    let creditBalance: Awaited<ReturnType<typeof getCreditBalance>> | null = null;
    const isGenerationTask = taskClassification.primaryType === "code_generation" ||
                             taskClassification.primaryType === "code_editing";

    try {
      const session = await auth();
      if (session?.user?.id) {
        userId = session.user.id;
        creditBalance = await getCreditBalance(userId);

        // Determine credit cost based on task type
        const creditCost = isGenerationTask
          ? CREDIT_COSTS.THEME_GENERATION
          : CREDIT_COSTS.THEME_ITERATION;

        if (creditBalance.available < creditCost) {
          return errorResponse(
            `Insufficient credits. You have ${creditBalance.available} credits, but this operation requires ${creditCost} credits.`,
            402,
            "INSUFFICIENT_CREDITS"
          );
        }

        console.log(`[Credits] User ${userId} has ${creditBalance.available} credits (needs ${creditCost})`);
      }
    } catch (creditError) {
      // Log but don't block - credits are optional for unauthenticated users
      console.warn("[Credits] Could not check credit balance:", creditError);
    }

    // Determine which AI provider to use
    // Priority: Claude API (if configured) > Ollama (local fallback)
    const claudeClient = getAnthropicClient();
    const useClaudeApi = !!claudeClient;

    // If no Claude API, check Ollama health
    if (!useClaudeApi) {
      const health = await checkOllamaHealth();
      if (!health.ok) {
        return errorResponse(
          health.error || "Ollama is not available. Set ANTHROPIC_API_KEY for Claude API fallback.",
          503,
          health.error?.includes("not found") ? "MODEL_NOT_FOUND" : "OLLAMA_NOT_RUNNING"
        );
      }
    }

    console.log(`[Chat API] Using ${useClaudeApi ? "Claude API" : "Ollama"} for generation`);

    // --- Agent Bridge: Pre-Generation (runs before LLM) ---
    let pipeline: AgentPipeline | null = null;

    if (ENABLE_AGENT_BRIDGE) {
      pipeline = new AgentPipeline({
        enablePreGeneration: true,
        enablePostGeneration: true,
        enableSidecarWrite: !!SIDECAR_BASE_URL,
        sidecarBaseUrl: SIDECAR_BASE_URL || undefined,
        enableFrontendAgent: true,
      });

      try {
        const lastUserMessage = [...messages]
          .reverse()
          .find((m: ChatMessage) => m.role === "user");

        await pipeline.runPreGeneration({
          userMessage: lastUserMessage?.content || "",
          colorPalette: projectContext?.colorPalette,
          industry: projectContext?.industry,
          designStyle: projectContext?.designStyle,
        });
      } catch (err) {
        console.warn("Agent pre-generation failed, continuing without enhancement:", err);
        pipeline = null;
      }
    }

    // Build system prompt with context (enhanced with brand tokens if pipeline ran)
    let basePrompt = buildSystemPrompt({
      projectName: projectContext?.projectName,
      industry: projectContext?.industry,
      colorPalette: projectContext?.colorPalette,
      existingFiles: projectContext?.existingFiles,
      designStyle: projectContext?.designStyle,
      useCompactPrompt: true,
    });

    // Inject user preferences from cross-session memory (Feature #6)
    if (preferencePrompt && preferencePrompt.trim()) {
      basePrompt = basePrompt + "\n" + preferencePrompt;
      console.log("[Chat] Injected user preferences from cross-session memory");
    }

    // Enhance with RAG context for codebase awareness
    const ragEnhancedPrompt = enhancePromptWithRAG(basePrompt, ragContext);

    // Further enhance with brand tokens from agent pipeline
    const systemPrompt = pipeline
      ? pipeline.enhanceSystemPrompt(ragEnhancedPrompt)
      : ragEnhancedPrompt;

    // =====================================================================
    // CLAUDE API PATH - Fast, production-quality generation
    // Uses model routing decision from orchestrator
    // =====================================================================
    if (useClaudeApi && resolvedModel.provider === "anthropic") {
      try {
        return await streamClaudeResponse(
          systemPrompt,
          messages as ChatMessage[],
          pipeline,
          resolvedModel.modelId,
          userMessageContent,
          ragPatterns,
          userId ? {
            userId,
            projectId: effectiveProjectId,
            isGeneration: isGenerationTask,
          } : undefined
        );
      } catch (error) {
        console.error("Claude API error:", error);
        // Don't fallback to Ollama on Claude error - return proper error
        return errorResponse(
          error instanceof Error ? error.message : "Claude API failed",
          500,
          "CLAUDE_ERROR"
        );
      }
    }

    // =====================================================================
    // OLLAMA PATH - Local LLM fallback (slower but free)
    // =====================================================================

    // Build Ollama messages array
    const ollamaMessages: OllamaMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg: ChatMessage) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      // Call Ollama API with streaming
      // Use custom agent with extended timeouts for slow local LLM responses
      const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 4096, // Increased for complete theme generation
            num_ctx: 8192,     // Larger context for system prompt + response
          },
        }),
        signal: controller.signal,
        // @ts-expect-error - dispatcher is valid for Node.js fetch with undici
        dispatcher: ollamaAgent,
      });

      clearTimeout(timeoutId);

      if (!ollamaResponse.ok) {
        const errorText = await ollamaResponse.text();
        console.error("Ollama API error:", errorText);

        if (ollamaResponse.status === 404) {
          return errorResponse(
            `Model ${OLLAMA_MODEL} not found. Run: ollama pull ${OLLAMA_MODEL}`,
            503,
            "MODEL_NOT_FOUND"
          );
        }

        return errorResponse("Ollama API error: " + errorText, 500, "OLLAMA_ERROR");
      }

      // Transform Ollama streaming response to AI SDK format
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Progress emission helper for Ollama stream
      type OllamaAgentPhase = "analyzing" | "streaming" | "post_processing" | "computing_quality" | "complete" | "error";
      const emitOllamaProgress = (
        safeEnqueue: (chunk: Uint8Array) => boolean,
        phase: OllamaAgentPhase,
        progress: number,
        message: string
      ) => {
        const progressData = {
          agentProgress: {
            phase,
            progress: Math.min(100, Math.max(0, progress)),
            message,
            timestamp: Date.now(),
          },
        };
        const progressChunk = `2:${JSON.stringify([progressData])}\n`;
        safeEnqueue(encoder.encode(progressChunk));
      };

      // Capture references for use inside the stream closure
      const activePipeline = pipeline;
      const capturedUserMessage = userMessageContent;
      const capturedRagPatterns = ragPatterns;
      const capturedSystemPrompt = systemPrompt;

      const transformedStream = new ReadableStream({
        async start(streamController) {
          const reader = ollamaResponse.body?.getReader();
          if (!reader) {
            streamController.close();
            return;
          }

          // Track stream state to prevent enqueueing after close
          let isStreamClosed = false;

          const safeEnqueue = (chunk: Uint8Array): boolean => {
            if (isStreamClosed) return false;
            try {
              streamController.enqueue(chunk);
              return true;
            } catch (err) {
              // Controller might be closed due to client disconnect
              if (err instanceof Error && err.message.includes("Controller is already closed")) {
                isStreamClosed = true;
                return false;
              }
              throw err;
            }
          };

          const safeClose = () => {
            if (isStreamClosed) return;
            isStreamClosed = true;
            try {
              streamController.close();
            } catch {
              // Already closed, ignore
            }
          };

          // Declare outside try block so it's accessible in catch for recovery
          let fullResponseText = "";

          try {
            let buffer = "";
            let lastUsageStats = { promptTokens: 0, completionTokens: 0 };
            let chunkCount = 0;

            console.log("[Ollama Stream] Starting to read chunks...");

            // Emit initial streaming phase
            emitOllamaProgress(safeEnqueue, "streaming", 10, "Generating content...");

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log("[Ollama Stream] Reader done - total chunks:", chunkCount, "content length:", fullResponseText.length);
                break;
              }
              chunkCount++;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || ""; // Keep incomplete line in buffer

              for (const line of lines) {
                if (!line.trim()) continue;

                try {
                  const data = JSON.parse(line);
                  if (data.message?.content) {
                    fullResponseText += data.message.content;
                    // AI SDK v3 data stream format
                    const aiChunk = `0:${JSON.stringify(data.message.content)}\n`;
                    if (!safeEnqueue(encoder.encode(aiChunk))) {
                      // Client disconnected - stop reading from Ollama to save resources
                      console.log("[Ollama Stream] Client disconnected, stopping stream read");
                      reader.cancel();
                      return;
                    }
                  }
                  if (data.done) {
                    // Capture usage stats for final message
                    lastUsageStats = {
                      promptTokens: data.prompt_eval_count || 0,
                      completionTokens: data.eval_count || 0,
                    };
                  }
                } catch {
                  // Skip invalid JSON lines
                }
              }
            }

            // Process any remaining buffer
            if (buffer.trim()) {
              try {
                const data = JSON.parse(buffer);
                if (data.message?.content) {
                  fullResponseText += data.message.content;
                  const aiChunk = `0:${JSON.stringify(data.message.content)}\n`;
                  safeEnqueue(encoder.encode(aiChunk));
                }
                if (data.done) {
                  lastUsageStats = {
                    promptTokens: data.prompt_eval_count || 0,
                    completionTokens: data.eval_count || 0,
                  };
                }
              } catch {
                // Ignore
              }
            }

            // --- Agent Bridge: Post-Generation (runs after LLM stream completes) ---
            if (activePipeline && fullResponseText && !isStreamClosed) {
              try {
                // Emit post-processing phase
                emitOllamaProgress(safeEnqueue, "post_processing", 60, "Processing generated content...");

                const postResult = await activePipeline.runPostGeneration(fullResponseText);
                if (postResult && !isStreamClosed) {
                  // Emit quality computation phase
                  emitOllamaProgress(safeEnqueue, "computing_quality", 80, "Computing quality score...");

                  const qualityData = {
                    agentQuality: {
                      score: postResult.quality.overallScore,
                      accessibility: postResult.quality.accessibility.score,
                      brandConsistency: postResult.quality.brandConsistency,
                      issueCount: postResult.quality.accessibility.issues.length,
                    },
                  };
                  const qualityChunk = `2:${JSON.stringify([qualityData])}\n`;
                  safeEnqueue(encoder.encode(qualityChunk));
                }
                activePipeline.finalize();
              } catch (err) {
                // Log but don't fail - post-generation is optional enhancement
                console.warn("Agent post-generation warning:", err instanceof Error ? err.message : err);
              }
            }

            // --- Self-Correction Loop (ACTUALLY RUNS NOW!) ---
            if (fullResponseText && !isStreamClosed) {
              try {
                // Run the full self-correction loop
                const correctionResult = await runSelfCorrectionLoop(
                  capturedUserMessage,
                  fullResponseText,
                  capturedSystemPrompt,
                  OLLAMA_MODEL,
                  capturedRagPatterns
                );

                const finalValidation = validateGeneratedCode(correctionResult.finalContent);
                const finalQualityScore = calculateQualityScore(finalValidation);

                console.log(`[SelfCorrection] Final: ${formatValidationSummary(finalValidation)} (corrected: ${correctionResult.wasCorrrected})`);

                // If content was corrected, stream the corrected version
                if (correctionResult.wasCorrrected && !isStreamClosed) {
                  // Send correction marker
                  const correctionMarker = `2:${JSON.stringify([{ selfCorrectionApplied: true, iterations: correctionResult.attempts.length }])}\n`;
                  safeEnqueue(encoder.encode(correctionMarker));

                  // Stream the corrected content
                  const correctedChunk = `0:${JSON.stringify("\n\n---\n**[Auto-Corrected Version]**\n\n" + correctionResult.finalContent)}\n`;
                  safeEnqueue(encoder.encode(correctedChunk));
                }

                // Send validation metadata to client
                if (!isStreamClosed) {
                  const validationData = {
                    codeValidation: {
                      valid: finalValidation.allValid,
                      qualityScore: finalQualityScore,
                      errorCount: finalValidation.totalErrors,
                      warningCount: finalValidation.totalWarnings,
                      needsCorrection: shouldAttemptCorrection(finalValidation),
                      correctionAttempts: correctionResult.attempts.length,
                      wasCorrected: correctionResult.wasCorrrected,
                    },
                  };
                  const validationChunk = `2:${JSON.stringify([validationData])}\n`;
                  safeEnqueue(encoder.encode(validationChunk));
                }
              } catch (err) {
                console.warn("Self-correction loop warning:", err instanceof Error ? err.message : err);
              }
            }

            // Record API call for rate limiting
            if (lastUsageStats.promptTokens > 0 || lastUsageStats.completionTokens > 0) {
              const { state: newState, newAlerts } = recordApiCall(
                rateLimitState,
                lastUsageStats.promptTokens,
                lastUsageStats.completionTokens,
                OLLAMA_MODEL
              );
              rateLimitState = newState;

              // Log budget alerts if any
              for (const alert of newAlerts) {
                console.warn(`[RateLimit] Budget alert: ${alert.label} threshold reached (${alert.currentUsage}/${alert.budgetLimit} tokens)`);
              }
            }

            // CRITICAL: Send finish message with usage stats (must be last before close)
            // AI SDK v3 uses `d:` for finish_message (verified from @ai-sdk/ui-utils source)
            // NOTE: `e:` is for finish_STEP (multi-step), `d:` is for finish_MESSAGE (ends stream!)
            // Emit completion phase
            emitOllamaProgress(safeEnqueue, "complete", 100, "Generation complete");

            console.log("[Ollama Stream] About to send finish_message - isStreamClosed:", isStreamClosed, "content length:", fullResponseText.length);
            if (!isStreamClosed) {
              const finishData = {
                finishReason: "stop",
                usage: {
                  promptTokens: lastUsageStats.promptTokens,
                  completionTokens: lastUsageStats.completionTokens,
                },
              };
              const finishChunk = `d:${JSON.stringify(finishData)}\n`;
              console.log("[Ollama Stream] SENDING finish_message (d:):", finishChunk.trim());
              const enqueueResult = safeEnqueue(encoder.encode(finishChunk));
              console.log("[Ollama Stream] Finish signal enqueued:", enqueueResult);
            } else {
              console.log("[Ollama Stream] Stream already closed, cannot send finish signal");
            }
          } catch (error) {
            console.error("[Ollama Stream] ERROR in stream processing:", error);

            // Feature #7: Handle generation failure with recovery
            const errorMessage = error instanceof Error ? error.message : "Stream processing failed";
            const failureResult = handleGenerationFailure(
              generationState,
              errorMessage,
              "streaming",
              [],
              fullResponseText.length > 0,
              {
                onRecoveryStart: (plan) => {
                  console.log(`[Recovery] Starting ${plan.strategy} recovery...`);
                },
                onRecoveryComplete: (result) => {
                  console.log(`[Recovery] ${result.success ? "Success" : "Failed"}: ${result.message}`);
                },
              }
            );
            generationState = failureResult.state;

            // Even on error, try to send finish signal so client knows stream ended
            // This is critical for the AI SDK useChat hook to set isLoading=false
            if (!isStreamClosed) {
              try {
                // Emit recovery metadata to client
                const recoveryData = {
                  generationRecovery: {
                    strategy: failureResult.plan.strategy,
                    success: failureResult.result.success,
                    message: failureResult.result.message,
                    shouldRetry: failureResult.shouldRetry,
                    retryCount: failureResult.state.retryCount,
                  },
                };
                const recoveryChunk = `2:${JSON.stringify([recoveryData])}\n`;
                safeEnqueue(encoder.encode(recoveryChunk));

                const finishData = {
                  finishReason: "error",
                  usage: { promptTokens: 0, completionTokens: 0 },
                };
                const finishChunk = `d:${JSON.stringify(finishData)}\n`;
                console.log("[Ollama Stream] Sending finish_message on error:", finishChunk.trim());
                safeEnqueue(encoder.encode(finishChunk));
              } catch {
                // Ignore errors sending finish on error path
              }
            }
          } finally {
            console.log("[Ollama Stream] Entering finally block - releasing reader and closing stream");
            reader.releaseLock();
            safeClose();
            console.log("[Ollama Stream] Stream closed successfully");
          }
        },
      });

      return new Response(transformedStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Vercel-AI-Data-Stream": "v1",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return errorResponse(
          "Request timeout - the AI is taking too long. Try a simpler request.",
          504,
          "TIMEOUT"
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed")) {
        return errorResponse(
          "Ollama is not running. Start with: ollama serve",
          503,
          "OLLAMA_NOT_RUNNING"
        );
      }
      if (error.message.includes("ETIMEDOUT") || error.message.includes("timeout")) {
        return errorResponse(
          "Connection to Ollama timed out. Make sure Ollama is running.",
          504,
          "TIMEOUT"
        );
      }
    }

    return errorResponse("AI processing failed", 500, "AI_ERROR");
  }
}

/**
 * GET /api/chat - Health check with rate limit status
 */
export async function GET() {
  const health = await checkOllamaHealth();
  const totalTokens = rateLimitState.calls.reduce(
    (sum, c) => sum + c.promptTokens + c.completionTokens, 0
  );
  const budgetUsed = rateLimitState.config.sessionTokenBudget > 0
    ? (totalTokens / rateLimitState.config.sessionTokenBudget * 100).toFixed(1)
    : "0";

  return new Response(
    JSON.stringify({
      status: health.ok ? "healthy" : "unhealthy",
      model: OLLAMA_MODEL,
      ollamaUrl: OLLAMA_BASE_URL,
      error: health.error,
      rateLimit: {
        requestsThisMinute: rateLimitState.calls.filter(
          c => c.timestamp > Date.now() - 60000
        ).length,
        maxRequestsPerMinute: rateLimitState.config.maxRequestsPerMinute,
        tokensUsed: totalTokens,
        tokenBudget: rateLimitState.config.sessionTokenBudget,
        budgetUsedPercent: budgetUsed,
      },
    }),
    {
      status: health.ok ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Helper to create error responses
 */
function errorResponse(message: string, status: number, code?: string) {
  return new Response(
    JSON.stringify({
      error: message,
      code: code || "ERROR",
      details: code === "OLLAMA_NOT_RUNNING"
        ? "Run 'ollama serve' in your terminal to start Ollama"
        : code === "MODEL_NOT_FOUND"
        ? `Run 'ollama pull ${OLLAMA_MODEL}' to download the model`
        : undefined,
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

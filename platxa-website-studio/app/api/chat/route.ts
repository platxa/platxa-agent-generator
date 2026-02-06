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

// Phase 1: Production-Grade Integrations
import { createRAGPipeline, type RAGQueryResult } from "@/lib/agent-bridge/rag-pipeline";
import { classifyTask, type ClassificationResult } from "@/lib/ai/task-classifier";
import { routeTask, type RoutingDecision, type TaskType } from "@/lib/ai/model-orchestrator";
import {
  validateGeneratedCode,
  buildCorrectionPrompt,
  calculateQualityScore,
  shouldAttemptCorrection,
  formatValidationSummary,
  type ValidationSummary,
} from "@/lib/ai/self-correction-loop";

// Sidecar configuration (optional - for writing files through editor-sync)
const SIDECAR_BASE_URL = process.env.SIDECAR_BASE_URL || "";
const ENABLE_AGENT_BRIDGE = process.env.ENABLE_AGENT_BRIDGE !== "false";

// Rate limiting state (global for now - in production use per-user/session)
let rateLimitState: RateLimitState = createRateLimitState({
  maxRequestsPerMinute: 20,
  maxTokensPerMinute: 50000,
  sessionTokenBudget: 500000,
});

// Increase timeout for local LLM (10 minutes max)
export const maxDuration = 600;

// AI Provider Configuration - reads from environment variables (secure)
// Priority: 1. Claude API (fast, production quality) if ANTHROPIC_API_KEY env var is set
//           2. Ollama (local, free, slower) as fallback
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

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

/**
 * Stream response from Claude API
 * Returns a ReadableStream compatible with AI SDK format
 */
async function streamClaudeResponse(
  systemPrompt: string,
  messages: ChatMessage[],
  pipeline: AgentPipeline | null
): Promise<Response> {
  const client = getAnthropicClient();
  if (!client) {
    throw new Error("Claude API not configured");
  }

  const encoder = new TextEncoder();
  let fullResponseText = "";
  let lastUsageStats = { promptTokens: 0, completionTokens: 0 };

  // Convert messages to Anthropic format
  const anthropicMessages = messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  const stream = await client.messages.stream({
    model: CLAUDE_MODEL,
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
            const postResult = await pipeline.runPostGeneration(fullResponseText);
            if (postResult && !isStreamClosed) {
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
        // PHASE 1: Self-Correction Validation
        // =====================================================================
        if (fullResponseText && !isStreamClosed) {
          try {
            const validation: ValidationSummary = validateGeneratedCode(fullResponseText);
            const qualityScore = calculateQualityScore(validation);

            console.log(`[SelfCorrection] ${formatValidationSummary(validation)}`);

            // Send validation metadata to client
            if (!isStreamClosed) {
              const validationData = {
                codeValidation: {
                  valid: validation.allValid,
                  qualityScore,
                  errorCount: validation.totalErrors,
                  warningCount: validation.totalWarnings,
                  needsCorrection: shouldAttemptCorrection(validation),
                },
              };
              const validationChunk = `2:${JSON.stringify([validationData])}\n`;
              safeEnqueue(encoder.encode(validationChunk));
            }
          } catch (err) {
            console.warn("Self-correction validation warning:", err);
          }
        }

        // Record API call for rate limiting
        if (lastUsageStats.promptTokens > 0 || lastUsageStats.completionTokens > 0) {
          const { state: newState, newAlerts } = recordApiCall(
            rateLimitState,
            lastUsageStats.promptTokens,
            lastUsageStats.completionTokens,
            CLAUDE_MODEL
          );
          rateLimitState = newState;
          for (const alert of newAlerts) {
            console.warn(`[RateLimit] Budget alert: ${alert.label} (${alert.currentUsage}/${alert.budgetLimit})`);
          }
        }

        // Send finish message - AI SDK v3 uses `d:` for finish_message
        // (verified from @ai-sdk/ui-utils source: finishMessageStreamPart.code = "d")
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
        if (!isStreamClosed) {
          const errorChunk = `3:${JSON.stringify({ error: "Stream processing failed" })}\n`;
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

    const { messages, projectContext, projectId } = body as {
      messages?: unknown;
      projectContext?: ProjectContext;
      projectId?: string;
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
    const basePrompt = buildSystemPrompt({
      projectName: projectContext?.projectName,
      industry: projectContext?.industry,
      colorPalette: projectContext?.colorPalette,
      existingFiles: projectContext?.existingFiles,
      designStyle: projectContext?.designStyle,
      useCompactPrompt: true,
    });

    // Enhance with RAG context for codebase awareness
    const ragEnhancedPrompt = enhancePromptWithRAG(basePrompt, ragContext);

    // Further enhance with brand tokens from agent pipeline
    const systemPrompt = pipeline
      ? pipeline.enhanceSystemPrompt(ragEnhancedPrompt)
      : ragEnhancedPrompt;

    // =====================================================================
    // CLAUDE API PATH - Fast, production-quality generation
    // =====================================================================
    if (useClaudeApi) {
      try {
        return await streamClaudeResponse(
          systemPrompt,
          messages as ChatMessage[],
          pipeline
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

      // Capture pipeline reference for use inside the stream closure
      const activePipeline = pipeline;

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

          try {
            let buffer = "";
            let fullResponseText = ""; // Accumulate for post-generation
            let lastUsageStats = { promptTokens: 0, completionTokens: 0 };
            let chunkCount = 0;

            console.log("[Ollama Stream] Starting to read chunks...");

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
                      // Client disconnected - but we still need to finish cleanly
                      // Log and continue to send finish signal before closing
                      console.log("[Ollama Stream] Client disconnected during streaming, will send finish signal anyway");
                      // Don't return early - let the loop finish naturally
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
                const postResult = await activePipeline.runPostGeneration(fullResponseText);
                if (postResult && !isStreamClosed) {
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

            // --- Self-Correction Validation (runs after LLM stream completes) ---
            if (fullResponseText && !isStreamClosed) {
              try {
                const validation: ValidationSummary = validateGeneratedCode(fullResponseText);
                const qualityScore = calculateQualityScore(validation);

                console.log(`[SelfCorrection] ${formatValidationSummary(validation)}`);

                // Send validation metadata to client
                if (!isStreamClosed) {
                  const validationData = {
                    codeValidation: {
                      valid: validation.allValid,
                      qualityScore,
                      errorCount: validation.totalErrors,
                      warningCount: validation.totalWarnings,
                      needsCorrection: shouldAttemptCorrection(validation),
                    },
                  };
                  const validationChunk = `2:${JSON.stringify([validationData])}\n`;
                  safeEnqueue(encoder.encode(validationChunk));
                }
              } catch (err) {
                console.warn("Self-correction validation warning:", err instanceof Error ? err.message : err);
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

            // Even on error, try to send finish signal so client knows stream ended
            // This is critical for the AI SDK useChat hook to set isLoading=false
            if (!isStreamClosed) {
              try {
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

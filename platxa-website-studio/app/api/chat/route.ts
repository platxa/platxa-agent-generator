import { buildSystemPrompt } from "@/lib/ai/system-prompts";
import { AgentPipeline } from "@/lib/agent-bridge/pipeline";
import { Agent } from "undici";
import {
  createRateLimitState,
  checkRateLimit,
  recordApiCall,
  type RateLimitState,
} from "@/lib/agent-bridge/rate-limiter";

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

// Configuration
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes for generation (local LLMs are slow)

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

    const { messages, projectContext } = body as {
      messages?: unknown;
      projectContext?: ProjectContext;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return errorResponse("Messages array is required and cannot be empty", 400);
    }

    // Check rate limit before proceeding
    const estimatedTokens = 2000; // Estimate for typical request
    const rateLimitCheck = checkRateLimit(rateLimitState, estimatedTokens);
    if (!rateLimitCheck.allowed) {
      return errorResponse(
        rateLimitCheck.reason || "Rate limit exceeded",
        429,
        "RATE_LIMITED"
      );
    }

    // Check Ollama health before proceeding
    const health = await checkOllamaHealth();
    if (!health.ok) {
      return errorResponse(
        health.error || "Ollama is not available",
        503,
        health.error?.includes("not found") ? "MODEL_NOT_FOUND" : "OLLAMA_NOT_RUNNING"
      );
    }

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

    const systemPrompt = pipeline
      ? pipeline.enhanceSystemPrompt(basePrompt)
      : basePrompt;

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
            num_predict: 2048, // Reduced for faster generation
            num_ctx: 4096,     // Context window
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

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

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
                      // Client disconnected, stop processing
                      reader.releaseLock();
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

            // Send finish message with usage stats (must be last before close)
            if (!isStreamClosed) {
              const finishData = {
                finishReason: "stop",
                usage: lastUsageStats,
              };
              const finishChunk = `d:${JSON.stringify(finishData)}\n`;
              safeEnqueue(encoder.encode(finishChunk));
            }
          } catch (error) {
            console.error("Stream processing error:", error);
            // Send error to client if stream still open
            if (!isStreamClosed) {
              const errorChunk = `3:${JSON.stringify({ error: "Stream processing failed" })}\n`;
              safeEnqueue(encoder.encode(errorChunk));
            }
          } finally {
            reader.releaseLock();
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

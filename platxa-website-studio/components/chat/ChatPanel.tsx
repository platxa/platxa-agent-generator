"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useChat } from "ai/react";
import { AlertCircle, RefreshCw, CheckCircle2, AlertTriangle, Sparkles, Wand2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { StreamingIndicator } from "./StreamingIndicator";
import { AgentPhaseIndicator } from "./AgentPhaseIndicator";
import { DesignSuggestions } from "./DesignSuggestions";
import { useChatStore, useProjectStore, useEditorStore, useEditorStoreHydration, useAgentStore, usePreferenceStore, selectIsRecovering, selectLastRecoveryResult } from "@/lib/stores";
import { createRecoveryPlan, type FailureContext } from "@/lib/agent-bridge/rollback-recovery";
import { useStreamingPreviewSafe } from "@/lib/preview/client";
import { parseGeneratedFiles, validateOdooTheme, formatFilesForDisplay, generateManifest, consolidateExportFiles, type ParsedFile } from "@/lib/ai/parser";
import { cn } from "@/lib/utils/cn";

interface ChatPanelProps {
  projectId: string;
  initialPrompt?: string;
}

interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

const QUICK_PROMPTS = [
  { icon: "🏠", text: "Create a modern homepage" },
  { icon: "🍕", text: "Restaurant with warm colors" },
  { icon: "💼", text: "Professional business site" },
  { icon: "🛒", text: "E-commerce product page" },
];

export function ChatPanel({ projectId, initialPrompt }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { projectName, projectConfig, setFiles } = useProjectStore();
  const { suggestions, setSuggestions } = useChatStore();
  const { openGeneratedFiles, fileContents } = useEditorStore();
  const { startPipeline, setAgentStatus, markComplete, reset: resetAgentStore, failPipeline, startRecovery, completeRecovery } = useAgentStore();
  const isRecovering = useAgentStore(selectIsRecovering);
  const lastRecoveryResult = useAgentStore(selectLastRecoveryResult);
  const { buildPreferencePrompt } = usePreferenceStore();
  const streamingPreview = useStreamingPreviewSafe();

  // Ensure editor store is hydrated for SSR compatibility
  useEditorStoreHydration();
  const [streamStartTime, setStreamStartTime] = useState<number | undefined>();
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{
    files: number;
    isValid: boolean;
    warnings: string[];
  } | null>(null);

  // Track previous loading state for detecting completion (use ref for reliability)
  const prevIsLoadingRef = useRef(false);
  const hasProcessedRef = useRef<string | null>(null); // Track processed message IDs

  // Get existing file paths for context
  const existingFilePaths = Object.keys(fileContents);

  // Use AI SDK v6 useChat hook
  const {
    messages,
    input,
    setInput,
    handleSubmit: originalHandleSubmit,
    isLoading,
    error,
    append,
    reload,
    data: streamData, // Streamed metadata from 2: chunks
  } = useChat({
    id: `chat-${projectId}`, // Scope messages to this project - fixes localStorage cross-contamination
    api: "/api/chat",
    body: {
      projectContext: {
        projectName,
        industry: projectConfig?.industry,
        colorPalette: projectConfig?.colorPalette,
        existingFiles: existingFilePaths.length > 0 ? existingFilePaths : undefined,
        // Wire RAG pipeline: send actual file contents so the AI can reference existing code
        fileContents: existingFilePaths.length > 0 ? fileContents : undefined,
      },
      // Include user preferences from cross-session memory (Feature #6)
      preferencePrompt: buildPreferencePrompt(),
    },
    onResponse: () => {
      setApiError(null);
      // Start streaming preview when response begins
      streamingPreview?.startStreaming();
      // Start agent pipeline tracking
      startPipeline();
    },
    onFinish: () => {
      setStreamStartTime(undefined);
      // End streaming preview when generation completes
      streamingPreview?.endStreaming();
      // Mark agent as complete using the proper action
      markComplete();

      // If we were recovering (auto-retry), mark recovery as complete
      const recoveryState = useAgentStore.getState().recoveryState;
      if (recoveryState.isRecovering) {
        completeRecovery({
          success: true,
          strategyUsed: recoveryState.lastPlan?.strategy ?? "retry",
          usedFallback: false,
          recoveredSections: [],
          unrecoveredSections: [],
          durationMs: 0,
          message: "Generation succeeded after retry",
        });
      }
      // Note: File parsing is handled by useEffect watching messages for reliability
    },
    onError: (error: Error) => {
      setStreamStartTime(undefined);
      console.error("Chat error:", error);

      // Set pipeline to error state (not full reset — preserves recovery context)
      const errorMsg = error.message || "An unexpected error occurred";
      failPipeline(errorMsg);

      // If a retry was in progress, mark recovery as failed
      const wasRecovering = useAgentStore.getState().recoveryState.isRecovering;
      if (wasRecovering) {
        completeRecovery({
          success: false,
          strategyUsed: useAgentStore.getState().recoveryState.lastPlan?.strategy ?? "retry",
          usedFallback: false,
          recoveredSections: [],
          unrecoveredSections: [],
          durationMs: 0,
          message: `Retry failed: ${errorMsg}`,
        });
      }

      // Read actual attempt count from store to prevent infinite retries
      const currentAttempts = useAgentStore.getState().recoveryState.attemptCount;
      const maxRetries = 3;

      // Build failure context for recovery strategy selection
      const failureContext: FailureContext = {
        error: errorMsg,
        phase: "streaming",
        affectedSections: [],
        hasPartialOutput: messages.length > 0 && messages[messages.length - 1]?.role === "assistant",
        hasSnapshot: false,
        hasGitHistory: false,
        hasYjsHistory: false,
        retryCount: currentAttempts,
        maxRetries,
      };

      // Select and potentially auto-execute recovery
      const plan = createRecoveryPlan(failureContext);
      if (plan.autoExecute && plan.strategy === "retry" && currentAttempts < maxRetries) {
        startRecovery(plan);
        // Auto-retry: reload the last message after delay
        // Note: completeRecovery is NOT called here — the next onFinish/onError
        // cycle will handle the outcome of the retry
        setTimeout(() => {
          reload();
        }, 1000);
      }

      try {
        if (error.message) {
          const parsed = JSON.parse(error.message);
          setApiError(parsed as ApiError);
        }
      } catch {
        setApiError({
          error: errorMsg,
          code: "UNKNOWN"
        });
      }
    },
  });

  // CRITICAL: Parse files when generation completes
  // We watch for isLoading to transition from true to false
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    // Detect when loading finishes (was loading, now not)
    if (wasLoading && !isLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      // Prevent duplicate processing
      const messageId = lastMessage.id || `${messages.length}-${lastMessage.content?.length || 0}`;
      if (hasProcessedRef.current === messageId) {
        console.log("[ChatPanel] Already processed this message, skipping");
        return;
      }

      if (lastMessage.role === "assistant" && lastMessage.content) {
        hasProcessedRef.current = messageId;
        console.log("[ChatPanel] ===== Generation complete, parsing files =====");
        console.log("[ChatPanel] Message ID:", messageId);

        // If self-correction ran, use the corrected content instead of raw stream text
        let contentToParse = lastMessage.content;
        if (streamData && Array.isArray(streamData)) {
          for (let i = streamData.length - 1; i >= 0; i--) {
            const item = streamData[i] as Record<string, unknown> | null;
            if (item && typeof item === "object" && "correctedContent" in item && typeof item.correctedContent === "string") {
              console.log("[ChatPanel] Using self-corrected content for parsing");
              contentToParse = item.correctedContent;
              break;
            }
          }
        }

        console.log("[ChatPanel] Content length:", contentToParse.length);
        console.log("[ChatPanel] First 500 chars:", contentToParse.substring(0, 500));

        // Parse generated files from the AI response (or corrected version)
        let files = parseGeneratedFiles(contentToParse);
        console.log("[ChatPanel] Parsed files count:", files.length);

        if (files.length > 0) {
          console.log("[ChatPanel] Generated files:", formatFilesForDisplay(files));

          // Validate Odoo theme structure
          const validation = validateOdooTheme(files);

          // Auto-recovery: Generate missing manifest if we have XML files
          if (!validation.isValid && validation.missing.some(m => m.includes("__manifest__"))) {
            const hasXmlFiles = files.some(f => f.path.endsWith(".xml"));
            if (hasXmlFiles) {
              console.log("[ChatPanel] Auto-generating missing __manifest__.py");
              const manifestContent = generateManifest(
                projectName || "Theme Generated",
                files
              );
              const manifestFile: ParsedFile = {
                path: "theme_generated/__manifest__.py",
                content: manifestContent,
                language: "python",
                action: "create",
              };
              files = [manifestFile, ...files];
            }
          }

          // Single consolidation point: consolidate ONCE via parser.ts
          // MUST happen BEFORE validation/status/stores/DB — everything downstream uses this
          const consolidatedFiles = consolidateExportFiles(files);
          console.log("[ChatPanel] Consolidated to", consolidatedFiles.length, "files");

          // Re-validate after consolidation + auto-recovery
          const finalValidation = validateOdooTheme(consolidatedFiles);

          setGenerationStatus({
            files: consolidatedFiles.length,
            isValid: finalValidation.isValid,
            warnings: [
              ...finalValidation.warnings,
              ...(finalValidation.missing.length > 0
                ? [`Missing: ${finalValidation.missing.join(", ")}`]
                : []),
            ],
          });

          // Open consolidated files in editor (no re-consolidation)
          console.log("[ChatPanel] Opening files in editor...");
          const filesToOpen = consolidatedFiles.map((f) => ({
            path: f.path,
            content: f.content,
            language: f.language,
          }));
          openGeneratedFiles(filesToOpen);

          // Sync same consolidated files to ProjectStore
          const fileNodes = consolidatedFiles.map((file) => ({
            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: file.path.split("/").pop() || file.path,
            path: file.path,
            type: "file" as const,
            content: file.content,
            isModified: true,
          }));
          setFiles(fileNodes);

          // Save files to database (if authenticated)
          fetch(`/api/projects/${projectId}/files`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              files: consolidatedFiles.map((f) => ({
                path: f.path,
                name: f.path.split("/").pop() || f.path,
                content: f.content,
                language: f.language,
              })),
            }),
          }).then((res) => {
            if (!res.ok && res.status !== 401 && res.status !== 403) {
              console.error("[ChatPanel] Failed to save files to DB:", res.status, res.statusText);
            }
          }).catch((err) => {
            // Network errors or demo mode (no auth) - log but don't crash
            console.warn("[ChatPanel] DB save unavailable:", err.message || "network error");
          });

          // Clear status after 15 seconds
          setTimeout(() => setGenerationStatus(null), 15000);
        } else {
          // No files parsed - check if AI response contains any code-like content
          const hasCodeContent = lastMessage.content.includes("<") ||
                                lastMessage.content.includes("{") ||
                                lastMessage.content.includes("def ") ||
                                lastMessage.content.includes("class ");

          if (hasCodeContent) {
            // AI generated something but parser couldn't extract files
            console.warn("[ChatPanel] AI response contained code but no files were parsed");
            console.log("[ChatPanel] Attempting fallback extraction...");

            // FALLBACK: Try to extract any HTML/XML content and wrap it as a template
            const htmlMatch = lastMessage.content.match(/<(?:section|div|header|footer|nav|main|article)[^>]*>[\s\S]*?<\/(?:section|div|header|footer|nav|main|article)>/i);
            if (htmlMatch) {
              console.log("[ChatPanel] Fallback: Found raw HTML section, wrapping as Odoo template");
              const fallbackContent = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <template id="ai_generated_section" name="AI Generated Section">
    ${htmlMatch[0]}
  </template>
</odoo>`;
              const fallbackFile: ParsedFile = {
                path: "theme_generated/views/ai_generated.xml",
                content: fallbackContent,
                language: "xml",
                action: "create",
              };

              // Open the fallback file
              openGeneratedFiles([{
                path: fallbackFile.path,
                content: fallbackFile.content,
                language: fallbackFile.language,
              }]);

              setFiles([{
                id: `file-${Date.now()}-fallback`,
                name: "ai_generated.xml",
                path: fallbackFile.path,
                type: "file" as const,
                content: fallbackFile.content,
                isModified: true,
              }]);

              setGenerationStatus({
                files: 1,
                isValid: false,
                warnings: [
                  "AI output was reformatted (model may need upgrading)",
                  "Consider using llama3.2:3b for better code generation",
                ],
              });
              setTimeout(() => setGenerationStatus(null), 15000);
              return;
            }

            setGenerationStatus({
              files: 0,
              isValid: false,
              warnings: [
                "AI generated code but file format was not recognized",
                "Try: 'Create a simple hero section with Welcome text'",
                "Or upgrade model: ollama pull llama3.2:3b",
              ],
            });
            setTimeout(() => setGenerationStatus(null), 10000);
          } else {
            // AI response was purely conversational
            setGenerationStatus(null);
          }
        }
      }
    }
  }, [isLoading, messages, streamData, projectId, projectName, openGeneratedFiles, setFiles]);

  // Custom submit handler with tracking
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setStreamStartTime(Date.now());
    setApiError(null);
    originalHandleSubmit(e);
  }, [input, isLoading, originalHandleSubmit]);

  // Send initial prompt if provided (only once)
  useEffect(() => {
    if (initialPrompt && !hasInitialized && messages.length === 0) {
      setHasInitialized(true);
      setStreamStartTime(Date.now());
      append({
        role: "user",
        content: initialPrompt,
      });
    }
  }, [initialPrompt, hasInitialized, messages.length, append]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Stream content to preview during generation
  useEffect(() => {
    if (isLoading && messages.length > 0 && streamingPreview) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant" && lastMessage.content) {
        // Send streaming content to preview
        streamingPreview.updateContent(lastMessage.content);
      }
    }
  }, [messages, isLoading, streamingPreview]);

  // Parse progress metadata from stream and update agent store
  useEffect(() => {
    if (!streamData || !Array.isArray(streamData)) return;

    // Find the latest agentProgress data in the stream
    for (let i = streamData.length - 1; i >= 0; i--) {
      const item = streamData[i];
      if (item && typeof item === "object" && "agentProgress" in item) {
        const progress = item.agentProgress as {
          phase: string;
          progress: number;
          message: string;
          timestamp: number;
        };

        // Map stream phase to AgentPhase type
        const phaseMap: Record<string, string> = {
          analyzing: "analyzing",
          streaming: "streaming",
          post_processing: "post_processing",
          computing_quality: "computing_quality",
          complete: "complete",
          error: "error",
        };

        const mappedPhase = phaseMap[progress.phase] || "streaming";

        setAgentStatus({
          phase: mappedPhase as "analyzing" | "streaming" | "post_processing" | "computing_quality" | "complete" | "error",
          message: progress.message,
          progress: progress.progress,
          startedAt: new Date().toISOString(),
        });
        break;
      }
    }
  }, [streamData, setAgentStatus]);

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleRetry = () => {
    setApiError(null);
    setStreamStartTime(Date.now());
    reload();
  };

  const handleQuickPrompt = (text: string) => {
    setInput(text);
  };

  // Get user-friendly error message
  const getErrorDisplay = () => {
    if (!apiError && !error) return null;

    const err: ApiError = apiError || { error: error?.message || "An error occurred" };

    return (
      <div className="mx-4 mb-4 p-4 rounded-2xl bg-red-500/5 border border-red-500/20 scale-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-medium text-red-600 dark:text-red-400">{err.error}</p>
            {err.details && (
              <p className="text-sm text-muted-foreground">{err.details}</p>
            )}
            {err.code === "OLLAMA_NOT_RUNNING" && (
              <div className="mt-3 p-3 bg-muted/50 rounded-xl text-xs font-mono">
                $ ollama serve
              </div>
            )}
            {err.code === "MODEL_NOT_FOUND" && (
              <div className="mt-3 p-3 bg-muted/50 rounded-xl text-xs font-mono">
                $ ollama pull llama3.2:3b
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="flex-shrink-0 rounded-xl"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header - Modern glassmorphism style */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">AI Assistant</h2>
            <p className="text-xs text-muted-foreground">
              Powered by local AI
            </p>
          </div>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-xs text-primary">
            <div className="status-dot loading" />
            Generating...
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} data-testid="chat-messages" className="flex-1 p-4">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center fade-in">
            <div className="max-w-md space-y-6">
              {/* Hero icon */}
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6">
                <Wand2 className="w-10 h-10 text-primary" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  What would you like to build?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Describe your website and I&apos;ll generate a complete Odoo theme
                  with pages, snippets, and styles.
                </p>
              </div>

              {/* Quick prompts */}
              <div className="grid grid-cols-2 gap-2 pt-4">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickPrompt(prompt.text)}
                    className="suggestion-chip text-left flex items-center gap-2"
                  >
                    <span className="text-lg">{prompt.icon}</span>
                    <span className="text-xs">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <MessageList messages={messages} isLoading={false} />
            <AgentPhaseIndicator />
            {isLoading && (
              <StreamingIndicator
                isStreaming={isLoading}
                startTime={streamStartTime}
              />
            )}
          </div>
        )}
      </ScrollArea>

      {/* Design Suggestions */}
      {suggestions.length > 0 && (
        <div className="px-4 pb-2 slide-in-left">
          <DesignSuggestions
            suggestions={suggestions}
            onSelect={(action) => {
              setInput(action);
              setSuggestions([]);
            }}
            onDismiss={() => setSuggestions([])}
          />
        </div>
      )}

      {/* Generation Status */}
      {generationStatus && (
        <div className={cn(
          "mx-4 mb-4 p-4 rounded-2xl border scale-in",
          generationStatus.isValid
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-amber-500/5 border-amber-500/20"
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              generationStatus.isValid ? "bg-emerald-500/10" : "bg-amber-500/10"
            )}>
              {generationStatus.isValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium">
                Generated {generationStatus.files} file(s)
              </p>
              {generationStatus.warnings.length > 0 && (
                <ul className="mt-1 text-sm text-muted-foreground">
                  {generationStatus.warnings.map((w, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Files opened in editor. Check Preview to see results.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Status */}
      {isRecovering && (
        <div className="mx-4 mb-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 scale-in">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            <div>
              <p className="font-medium text-blue-600 dark:text-blue-400">Recovering...</p>
              <p className="text-sm text-muted-foreground">Attempting automatic recovery</p>
            </div>
          </div>
        </div>
      )}

      {/* Recovery Result */}
      {lastRecoveryResult && !isRecovering && (
        <div className={cn(
          "mx-4 mb-4 p-4 rounded-2xl border scale-in",
          lastRecoveryResult.success
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-amber-500/5 border-amber-500/20"
        )}>
          <div className="flex items-center gap-3">
            {lastRecoveryResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            )}
            <div>
              <p className="font-medium text-sm">
                {lastRecoveryResult.success ? "Recovery succeeded" : "Recovery failed"}
              </p>
              <p className="text-xs text-muted-foreground">{lastRecoveryResult.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {getErrorDisplay()}

      {/* Input */}
      <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Describe your website or ask for changes..."
        />
      </div>
    </div>
  );
}

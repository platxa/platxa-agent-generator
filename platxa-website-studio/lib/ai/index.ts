export {
  ODOO_WEBSITE_SYSTEM_PROMPT,
  DESIGN_ANALYZER_PROMPT,
  CODE_REVIEWER_PROMPT,
  buildSystemPrompt,
} from "./system-prompts";

export {
  aiTools,
  generateThemeSchema,
  generatePageSchema,
  generateSnippetSchema,
  modifyStylesSchema,
  generateMenuSchema,
  type ThemeConfig,
  type PageConfig,
  type SnippetConfig,
  type StyleChanges,
  type MenuConfig,
} from "./tools";

export { parseGeneratedFiles, type ParsedFile } from "./parser";

export {
  ModelOrchestrator,
  getOrchestrator,
  resetOrchestrator,
  routeTask,
  getModelForTask,
  type ModelProvider,
  type ModelId,
  type TaskType,
  type TaskPriority,
  type ModelCapabilities,
  type ModelConfig,
  type TaskRequest,
  type RoutingDecision,
  type OrchestratorConfig,
} from "./model-orchestrator";

export {
  TaskClassifier,
  getClassifier,
  resetClassifier,
  classifyTask,
  getTaskType,
  type ClassificationResult,
} from "./task-classifier";

// Provider adapters
export {
  AnthropicAdapter,
  OpenAIAdapter,
  ProviderError,
  type ProviderAdapter,
  type ImageProviderAdapter,
  type ProviderRequestOptions,
  type ProviderResponse,
  type StreamChunk,
  type Message,
  type ContentBlock,
  type Tool,
  type ImageGenerationRequest,
  type ImageGenerationResponse,
} from "./providers";

// Image-to-Code (Screenshot Analysis)
export {
  analyzeScreenshot,
  analysisToTokens,
  generateThemeFromScreenshot,
  loadImageFromFile,
  loadImageFromUrl,
  loadImageFromBase64,
  writeThemeToDirectory,
  validateImageSource,
  getSupportedFormats,
  estimateAnalysisCost,
  type ImageFormat,
  type ImageSource,
  type ExtractedColor,
  type ExtractedTypography,
  type ExtractedSpacing,
  type DetectedComponent,
  type LayoutAnalysis,
  type ScreenshotAnalysis,
  type GeneratedFile,
  type ThemeGenerationResult,
  type ImageToCodeOptions,
} from "./image-to-code";

// Critic Agent
export {
  evaluateWithCritic,
  buildCorrectionPromptFromCritic,
  formatCriticReport,
  type CriticGrade,
  type CriticIssue,
  type CriticReport,
  type CriticOptions,
  type ValidatorResult,
} from "./critic-agent";

// Generator-Critic-Refinement Pattern
export {
  GeneratorAgent,
  RefinementAgent,
  GCROrchestrator,
  createGCROrchestrator,
  runGCRCycle,
  evaluateQuality,
  formatGCRResult,
  type AgentRole,
  type IterationStatus,
  type GeneratorConfig,
  type RefinementConfig,
  type GCRConfig,
  type GCRIteration,
  type GCRResult,
} from "./gcr-agent";

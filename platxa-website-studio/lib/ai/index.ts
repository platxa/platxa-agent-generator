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

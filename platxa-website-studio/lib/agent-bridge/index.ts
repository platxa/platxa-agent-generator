/**
 * Agent Bridge
 *
 * Integration layer connecting platxa-website-studio, platxa-frontend-agent,
 * and platxa-editor-sync into a unified AI generation pipeline.
 */

// Types
export type {
  OklchColor,
  OdooColorPalette,
  BrandTokenContext,
  AgentPhase,
  AgentStatus,
  DesignAnalysis,
  PreGenerationResult,
  AccessibilityIssue,
  AccessibilityReport,
  QualityReport,
  PostGenerationResult,
  AgentPipelineResult,
  FileWriteStatus,
  WriteResult,
  AgentPipelineConfig,
} from "./types";

export { DEFAULT_PIPELINE_CONFIG } from "./types";

// Color mapper
export {
  hexToOklch,
  oklchToHex,
  mapOdooPaletteToBrandTokens,
  generateLightnessScale,
  meetsContrastAA,
} from "./color-mapper";

// Pre-generation hook
export { runPreGeneration } from "./pre-generation";
export type { PreGenerationInput } from "./pre-generation";

// Post-generation hook
export { runPostGeneration } from "./post-generation";
export type { PostGenerationInput } from "./post-generation";

// Brand token injector
export { injectBrandTokens } from "./brand-token-injector";

// SCSS transformer
export {
  generateOdooColorVariables,
  generateBootstrapOverrides,
  transformToOdooScss,
} from "./scss-transformer";
export type { OdooScssOutput } from "./scss-transformer";

// Sidecar writer
export { writeThroughSidecar } from "./sidecar-writer";
export type { SidecarWriteOptions } from "./sidecar-writer";

// Activity listener
export { subscribeToActivity } from "./activity-listener";
export type {
  ActivityEventType,
  ActivityEvent,
  ActivityListenerOptions,
} from "./activity-listener";

// Pipeline
export { AgentPipeline } from "./pipeline";

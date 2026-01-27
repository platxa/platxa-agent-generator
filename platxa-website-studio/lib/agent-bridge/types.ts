/**
 * Agent Bridge Types
 *
 * Shared type definitions for the integration layer between
 * platxa-website-studio, platxa-frontend-agent, and platxa-editor-sync.
 */

// =============================================================================
// OKLCH Color Types (subset of frontend-agent, kept local for independence)
// =============================================================================

export interface OklchColor {
  l: number; // Lightness: 0-1
  c: number; // Chroma: 0-0.4+
  h: number; // Hue: 0-360
  alpha?: number;
}

// =============================================================================
// Odoo Color Palette (from system-prompts.ts)
// =============================================================================

export interface OdooColorPalette {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

// =============================================================================
// Brand Token Context (injected into LLM system prompt)
// =============================================================================

export interface BrandTokenContext {
  colors: {
    primary: string;
    primaryOklch: OklchColor;
    secondary: string;
    secondaryOklch: OklchColor;
    accent: string;
    accentOklch: OklchColor;
    background: string;
    text: string;
    /** Derived semantic colors for the full palette */
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  typography?: {
    headingFamily: string;
    bodyFamily: string;
    scale: string; // e.g. "1.25" for major third
  };
  spacing?: {
    unit: number; // base unit in px (default 8)
    scale: string; // e.g. "4,8,12,16,24,32,48,64"
  };
}

// =============================================================================
// Pipeline Status
// =============================================================================

export type AgentPhase =
  | "idle"
  | "analyzing"
  | "generating_palette"
  | "generating_theme"
  | "injecting_tokens"
  | "streaming"
  | "post_processing"
  | "auditing_a11y"
  | "computing_quality"
  | "writing_files"
  | "complete"
  | "error";

export interface AgentStatus {
  phase: AgentPhase;
  message: string;
  progress?: number; // 0-100
  startedAt: string; // ISO timestamp
}

// =============================================================================
// Pre-Generation Result
// =============================================================================

export interface DesignAnalysis {
  componentType: string;
  category: string;
  confidence: number;
  keywords: string[];
  colorIntent?: {
    mood?: string;
    temperature?: string;
    suggestedHues?: number[];
  };
  layoutIntent?: {
    direction?: string;
    alignment?: string;
    distribution?: string;
  };
}

export interface PreGenerationResult {
  designAnalysis: DesignAnalysis | null;
  brandTokens: BrandTokenContext;
  enhancedPromptFragment: string;
  timestamp: string;
}

// =============================================================================
// Post-Generation Result
// =============================================================================

export interface AccessibilityIssue {
  id: string;
  criterion: string;
  level: "A" | "AA" | "AAA";
  severity: "error" | "warning" | "info";
  message: string;
  element?: string;
  suggestion?: string;
}

export interface AccessibilityReport {
  passed: boolean;
  totalIssues: number;
  score: number; // 0-100
  issues: AccessibilityIssue[];
}

export interface QualityReport {
  overallScore: number; // 0-100
  accessibility: AccessibilityReport;
  brandConsistency: number; // 0-100
  suggestions: string[];
}

export interface PostGenerationResult {
  quality: QualityReport;
  timestamp: string;
}

// =============================================================================
// Pipeline Result
// =============================================================================

export interface AgentPipelineResult {
  preGeneration: PreGenerationResult;
  postGeneration: PostGenerationResult | null;
  filesWritten: WriteResult | null;
  totalDurationMs: number;
}

// =============================================================================
// Sidecar Write Result
// =============================================================================

export interface FileWriteStatus {
  path: string;
  success: boolean;
  error?: string;
}

export interface WriteResult {
  success: boolean;
  filesWritten: FileWriteStatus[];
  totalFiles: number;
  failedFiles: number;
  usedSidecar: boolean;
}

// =============================================================================
// Pipeline Configuration
// =============================================================================

export interface AgentPipelineConfig {
  /** Enable pre-generation design analysis */
  enablePreGeneration: boolean;
  /** Enable post-generation accessibility audit */
  enablePostGeneration: boolean;
  /** Enable writing files through editor-sync sidecar */
  enableSidecarWrite: boolean;
  /** Editor-sync sidecar base URL */
  sidecarBaseUrl?: string;
  /** Status callback for UI updates */
  onStatusChange?: (status: AgentStatus) => void;
}

export const DEFAULT_PIPELINE_CONFIG: AgentPipelineConfig = {
  enablePreGeneration: true,
  enablePostGeneration: true,
  enableSidecarWrite: false,
  sidecarBaseUrl: undefined,
  onStatusChange: undefined,
};

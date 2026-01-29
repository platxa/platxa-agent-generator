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
  /** Full DTCG design token set (canonical, generated in pre-generation) */
  designTokens?: import("../design-tokens/types").DesignTokenSet;
  /** Dark mode variant of design tokens */
  darkModeTokens?: import("../design-tokens/types").DesignTokenSet;
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
  /** WCAG rule identifier */
  rule?: string;
  /** Suggested fix for this issue */
  fix?: string;
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
// Page Section Generation
// =============================================================================

/** Odoo section types supported by generate_page */
export type OdooSectionType =
  | "hero"
  | "features"
  | "services"
  | "about"
  | "team"
  | "testimonials"
  | "portfolio"
  | "pricing"
  | "cta"
  | "contact"
  | "faq"
  | "stats"
  | "partners"
  | "blog"
  | "footer"
  | "gallery";

/** Maps Odoo section types to Odoo snippet IDs (s_section_name) */
export const SECTION_SNIPPET_IDS: Record<OdooSectionType, string> = {
  hero: "s_hero",
  features: "s_features",
  services: "s_services",
  about: "s_about",
  team: "s_team",
  testimonials: "s_testimonials",
  portfolio: "s_portfolio",
  pricing: "s_pricing",
  cta: "s_cta",
  contact: "s_contact",
  faq: "s_faq",
  stats: "s_stats",
  partners: "s_partners",
  blog: "s_blog",
  footer: "s_footer",
  gallery: "s_gallery",
};

/** Result of processing a single page section through the orchestrator */
export interface PageSectionResult {
  /** Odoo section type */
  sectionType: OdooSectionType;
  /** Odoo snippet ID (e.g. "s_hero") */
  snippetId: string;
  /** Generated HTML content */
  html: string;
  /** Generated SCSS styles */
  scss: string;
  /** Whether the section is valid */
  isValid: boolean;
  /** Design analysis from FrontendOrchestrator */
  designAnalysis: DesignAnalysis | null;
  /** Theme CSS scoped to this section */
  themeCss: string | null;
  /** Accessibility score for this section */
  accessibilityScore: number | null;
  /** Accessibility issues for this section */
  accessibilityIssues: string[];
  /** Whether orchestrator processing succeeded */
  success: boolean;
  /** Processing duration in ms */
  durationMs: number;
}

/** Result of processing an entire page's sections */
export interface PageGenerationResult {
  /** Per-section results in page order */
  sections: PageSectionResult[];
  /** Combined HTML for all sections */
  combinedHtml: string;
  /** Combined SCSS for all sections */
  combinedScss: string;
  /** Combined theme CSS for all sections */
  combinedThemeCss: string;
  /** Whether page generation is complete */
  isComplete: boolean;
  /** Average accessibility score across sections */
  averageAccessibilityScore: number | null;
  /** Total processing duration in ms */
  totalDurationMs: number;
}

// =============================================================================
// Snippet Generation (with design token constraints)
// =============================================================================

/** Maps hardcoded values to design token CSS variable references */
export interface DesignTokenConstraints {
  /** CSS variable map: hex value → var(--o-color-N) or var(--bs-*) */
  colorVariables: Record<string, string>;
  /** Snippet-scoped theme CSS using design token variables */
  scopedThemeCss: string | null;
}

/** Result of processing a snippet through the orchestrator */
export interface SnippetGenerationResult {
  /** Snippet technical ID (e.g. "s_hero") */
  snippetId: string;
  /** Snippet type */
  snippetType: string;
  /** Design analysis from FrontendOrchestrator */
  designAnalysis: DesignAnalysis | null;
  /** Design token constraints — variable references to use instead of hardcoded values */
  tokenConstraints: DesignTokenConstraints;
  /** Theme CSS from orchestrator */
  themeCss: string | null;
  /** Accessibility score */
  accessibilityScore: number | null;
  /** Accessibility issues */
  accessibilityIssues: string[];
  /** Whether orchestrator processing succeeded */
  success: boolean;
  /** Processing duration in ms */
  durationMs: number;
}

// =============================================================================
// Style Modification (with design token validation)
// =============================================================================

/** A single CSS property change to validate */
export interface StyleChange {
  selector: string;
  properties: Record<string, string>;
}

/** Validation result for a single property value */
export interface TokenValidationIssue {
  selector: string;
  property: string;
  /** The hardcoded value found */
  value: string;
  /** The design token variable that should be used instead */
  suggestedVariable: string;
  severity: "error" | "warning";
}

/** Result of validating and processing style modifications */
export interface StyleModificationResult {
  /** Whether all changes passed design token validation */
  valid: boolean;
  /** Style changes with hardcoded values replaced by token variables */
  resolvedChanges: StyleChange[];
  /** Validation issues found (hardcoded values that should use tokens) */
  validationIssues: TokenValidationIssue[];
  /** Design analysis from FrontendOrchestrator (if available) */
  designAnalysis: DesignAnalysis | null;
  /** Accessibility score for the modified styles */
  accessibilityScore: number | null;
  /** Whether orchestrator processing succeeded */
  success: boolean;
  /** Processing duration in ms */
  durationMs: number;
}

// =============================================================================
// Pipeline Result
// =============================================================================

export interface AgentPipelineResult {
  preGeneration: PreGenerationResult;
  postGeneration: PostGenerationResult | null;
  filesWritten: WriteResult | null;
  /** Full DTCG design tokens generated during pre-generation (when available) */
  designTokens: import("../design-tokens/types").DesignTokenSet | null;
  /** Result from the platxa-frontend-agent orchestrator (when enableFrontendAgent=true) */
  frontendAgentResult: import("./agent-bridge").AgentBridgeResult | null;
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
  /** Enable platxa-frontend-agent orchestrator integration */
  enableFrontendAgent: boolean;
  /** Configuration forwarded to AgentBridge (only used when enableFrontendAgent=true) */
  frontendAgentConfig?: import("./agent-bridge").AgentBridgeConfig;
  /** Status callback for UI updates */
  onStatusChange?: (status: AgentStatus) => void;
}

export const DEFAULT_PIPELINE_CONFIG: AgentPipelineConfig = {
  enablePreGeneration: true,
  enablePostGeneration: true,
  enableSidecarWrite: false,
  enableFrontendAgent: false,
  sidecarBaseUrl: undefined,
  onStatusChange: undefined,
};

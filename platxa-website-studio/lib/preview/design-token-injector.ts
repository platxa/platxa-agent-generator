/**
 * Design Token Injector
 *
 * Injects design tokens into agent context on project load:
 * - Serializes brand tokens compactly (under 500 tokens)
 * - Auto-injects on project load
 * - Provides context for AI-assisted styling
 */

// =============================================================================
// Types
// =============================================================================

/** Color token */
export interface ColorToken {
  /** Token name */
  name: string;
  /** Color value (hex, rgb, hsl) */
  value: string;
  /** Semantic meaning */
  semantic?: string;
}

/** Typography token */
export interface TypographyToken {
  /** Token name */
  name: string;
  /** Font family */
  fontFamily?: string;
  /** Font size */
  fontSize?: string;
  /** Font weight */
  fontWeight?: string | number;
  /** Line height */
  lineHeight?: string | number;
  /** Letter spacing */
  letterSpacing?: string;
}

/** Spacing token */
export interface SpacingToken {
  /** Token name */
  name: string;
  /** Spacing value */
  value: string;
}

/** Border radius token */
export interface RadiusToken {
  /** Token name */
  name: string;
  /** Radius value */
  value: string;
}

/** Shadow token */
export interface ShadowToken {
  /** Token name */
  name: string;
  /** Shadow value */
  value: string;
}

/** Complete design tokens */
export interface DesignTokens {
  /** Brand colors */
  colors: ColorToken[];
  /** Typography styles */
  typography: TypographyToken[];
  /** Spacing scale */
  spacing: SpacingToken[];
  /** Border radii */
  radii: RadiusToken[];
  /** Shadows */
  shadows: ShadowToken[];
  /** Custom tokens */
  custom?: Record<string, string>;
}

/** Serialized context for injection */
export interface TokenContext {
  /** Serialized token string */
  content: string;
  /** Estimated token count */
  tokenCount: number;
  /** Token categories included */
  categories: string[];
  /** Whether tokens were truncated */
  truncated: boolean;
}

/** Injection configuration */
export interface InjectorConfig {
  /** Max tokens allowed */
  maxTokens: number;
  /** Include colors */
  includeColors: boolean;
  /** Include typography */
  includeTypography: boolean;
  /** Include spacing */
  includeSpacing: boolean;
  /** Include radii */
  includeRadii: boolean;
  /** Include shadows */
  includeShadows: boolean;
  /** Include custom */
  includeCustom: boolean;
  /** Compact mode (shorter output) */
  compactMode: boolean;
}

/** Project load event */
export interface ProjectLoadEvent {
  /** Project ID */
  projectId: string;
  /** Project name */
  projectName: string;
  /** Timestamp */
  timestamp: number;
}

/** Injection callback */
export type InjectionCallback = (context: TokenContext, event: ProjectLoadEvent) => void;

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: InjectorConfig = {
  maxTokens: 500,
  includeColors: true,
  includeTypography: true,
  includeSpacing: true,
  includeRadii: true,
  includeShadows: true,
  includeCustom: true,
  compactMode: true,
};

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimates token count for a string.
 * Approximation: ~4 characters per token for English text.
 */
export function estimateTokenCount(text: string): number {
  // Simple approximation: split on whitespace and punctuation
  // Average ~4 chars per token is a reasonable estimate
  return Math.ceil(text.length / 4);
}

/**
 * Checks if content is within token limit.
 */
export function isWithinTokenLimit(content: string, maxTokens: number): boolean {
  return estimateTokenCount(content) <= maxTokens;
}

// =============================================================================
// Token Serialization
// =============================================================================

/**
 * Serializes colors to compact format.
 */
export function serializeColors(colors: ColorToken[], compact: boolean): string {
  if (colors.length === 0) return "";

  if (compact) {
    // Format: primary:#1a73e8,secondary:#34a853
    return colors.map((c) => `${c.name}:${c.value}`).join(",");
  }

  return colors
    .map((c) => `${c.name}: ${c.value}${c.semantic ? ` (${c.semantic})` : ""}`)
    .join("\n");
}

/**
 * Serializes typography to compact format.
 */
export function serializeTypography(typography: TypographyToken[], compact: boolean): string {
  if (typography.length === 0) return "";

  if (compact) {
    // Format: h1:32px/1.2/700,body:16px/1.5/400
    return typography
      .map((t) => {
        const parts = [t.name];
        if (t.fontSize) parts.push(t.fontSize);
        if (t.lineHeight) parts.push(String(t.lineHeight));
        if (t.fontWeight) parts.push(String(t.fontWeight));
        return parts.join(":");
      })
      .join(",");
  }

  return typography
    .map((t) => {
      const props: string[] = [];
      if (t.fontFamily) props.push(`family: ${t.fontFamily}`);
      if (t.fontSize) props.push(`size: ${t.fontSize}`);
      if (t.fontWeight) props.push(`weight: ${t.fontWeight}`);
      if (t.lineHeight) props.push(`line-height: ${t.lineHeight}`);
      return `${t.name}: ${props.join(", ")}`;
    })
    .join("\n");
}

/**
 * Serializes spacing to compact format.
 */
export function serializeSpacing(spacing: SpacingToken[], compact: boolean): string {
  if (spacing.length === 0) return "";

  if (compact) {
    // Format: xs:4px,sm:8px,md:16px
    return spacing.map((s) => `${s.name}:${s.value}`).join(",");
  }

  return spacing.map((s) => `${s.name}: ${s.value}`).join("\n");
}

/**
 * Serializes radii to compact format.
 */
export function serializeRadii(radii: RadiusToken[], compact: boolean): string {
  if (radii.length === 0) return "";

  if (compact) {
    return radii.map((r) => `${r.name}:${r.value}`).join(",");
  }

  return radii.map((r) => `${r.name}: ${r.value}`).join("\n");
}

/**
 * Serializes shadows to compact format.
 */
export function serializeShadows(shadows: ShadowToken[], compact: boolean): string {
  if (shadows.length === 0) return "";

  if (compact) {
    // Shadows are longer, use abbreviated format
    return shadows.map((s) => `${s.name}:${s.value.slice(0, 30)}...`).join(",");
  }

  return shadows.map((s) => `${s.name}: ${s.value}`).join("\n");
}

/**
 * Serializes custom tokens.
 */
export function serializeCustom(custom: Record<string, string>, compact: boolean): string {
  const entries = Object.entries(custom);
  if (entries.length === 0) return "";

  if (compact) {
    return entries.map(([k, v]) => `${k}:${v}`).join(",");
  }

  return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
}

// =============================================================================
// Main Serialization
// =============================================================================

/**
 * Serializes design tokens to context string.
 */
export function serializeTokens(
  tokens: DesignTokens,
  config: InjectorConfig
): TokenContext {
  const sections: string[] = [];
  const categories: string[] = [];
  const compact = config.compactMode;

  // Build sections based on config
  if (config.includeColors && tokens.colors.length > 0) {
    const colorStr = serializeColors(tokens.colors, compact);
    sections.push(compact ? `C:${colorStr}` : `Colors:\n${colorStr}`);
    categories.push("colors");
  }

  if (config.includeTypography && tokens.typography.length > 0) {
    const typoStr = serializeTypography(tokens.typography, compact);
    sections.push(compact ? `T:${typoStr}` : `Typography:\n${typoStr}`);
    categories.push("typography");
  }

  if (config.includeSpacing && tokens.spacing.length > 0) {
    const spaceStr = serializeSpacing(tokens.spacing, compact);
    sections.push(compact ? `S:${spaceStr}` : `Spacing:\n${spaceStr}`);
    categories.push("spacing");
  }

  if (config.includeRadii && tokens.radii.length > 0) {
    const radiiStr = serializeRadii(tokens.radii, compact);
    sections.push(compact ? `R:${radiiStr}` : `Radii:\n${radiiStr}`);
    categories.push("radii");
  }

  if (config.includeShadows && tokens.shadows.length > 0) {
    const shadowStr = serializeShadows(tokens.shadows, compact);
    sections.push(compact ? `X:${shadowStr}` : `Shadows:\n${shadowStr}`);
    categories.push("shadows");
  }

  if (config.includeCustom && tokens.custom && Object.keys(tokens.custom).length > 0) {
    const customStr = serializeCustom(tokens.custom, compact);
    sections.push(compact ? `K:${customStr}` : `Custom:\n${customStr}`);
    categories.push("custom");
  }

  // Join sections
  let content = compact ? sections.join("|") : sections.join("\n\n");
  let truncated = false;

  // Check token limit and truncate if needed
  while (!isWithinTokenLimit(content, config.maxTokens) && sections.length > 1) {
    sections.pop();
    categories.pop();
    content = compact ? sections.join("|") : sections.join("\n\n");
    truncated = true;
  }

  // Final truncation if still over limit
  if (!isWithinTokenLimit(content, config.maxTokens)) {
    const maxChars = config.maxTokens * 4;
    content = content.slice(0, maxChars - 3) + "...";
    truncated = true;
  }

  return {
    content,
    tokenCount: estimateTokenCount(content),
    categories,
    truncated,
  };
}

// =============================================================================
// DesignTokenInjector Class
// =============================================================================

/**
 * Manages design token injection into agent context.
 */
export class DesignTokenInjector {
  private config: InjectorConfig;
  private tokens: DesignTokens | null = null;
  private cachedContext: TokenContext | null = null;
  private callbacks: InjectionCallback[] = [];

  constructor(config: Partial<InjectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Loads design tokens.
   */
  loadTokens(tokens: DesignTokens): void {
    this.tokens = tokens;
    this.cachedContext = null; // Invalidate cache
  }

  /**
   * Gets current tokens.
   */
  getTokens(): DesignTokens | null {
    return this.tokens;
  }

  /**
   * Clears loaded tokens.
   */
  clearTokens(): void {
    this.tokens = null;
    this.cachedContext = null;
  }

  /**
   * Registers an injection callback.
   */
  onInjection(callback: InjectionCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes an injection callback.
   */
  offInjection(callback: InjectionCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Gets serialized token context.
   */
  getContext(): TokenContext | null {
    if (!this.tokens) {
      return null;
    }

    // Use cache if available
    if (this.cachedContext) {
      return this.cachedContext;
    }

    // Serialize tokens
    this.cachedContext = serializeTokens(this.tokens, this.config);
    return this.cachedContext;
  }

  /**
   * Injects tokens into agent context on project load.
   */
  injectOnProjectLoad(event: ProjectLoadEvent): TokenContext | null {
    const context = this.getContext();

    if (context) {
      // Notify callbacks
      for (const callback of this.callbacks) {
        try {
          callback(context, event);
        } catch {
          // Ignore callback errors
        }
      }
    }

    return context;
  }

  /**
   * Creates agent context string with tokens.
   */
  createAgentContext(baseContext?: string): string {
    const tokenContext = this.getContext();

    if (!tokenContext) {
      return baseContext ?? "";
    }

    const tokenSection = `[Design Tokens]\n${tokenContext.content}`;

    if (baseContext) {
      return `${baseContext}\n\n${tokenSection}`;
    }

    return tokenSection;
  }

  /**
   * Checks if tokens are within limit.
   */
  isWithinLimit(): boolean {
    const context = this.getContext();
    return context !== null && context.tokenCount <= this.config.maxTokens;
  }

  /**
   * Gets token count.
   */
  getTokenCount(): number {
    const context = this.getContext();
    return context?.tokenCount ?? 0;
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<InjectorConfig>): void {
    this.config = { ...this.config, ...config };
    this.cachedContext = null; // Invalidate cache
  }

  /**
   * Gets current configuration.
   */
  getConfig(): InjectorConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a DesignTokenInjector instance.
 */
export function createTokenInjector(
  config?: Partial<InjectorConfig>
): DesignTokenInjector {
  return new DesignTokenInjector(config);
}

/**
 * Creates an injector with tokens loaded.
 */
export function createTokenInjectorWithTokens(
  tokens: DesignTokens,
  config?: Partial<InjectorConfig>
): DesignTokenInjector {
  const injector = new DesignTokenInjector(config);
  injector.loadTokens(tokens);
  return injector;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates empty design tokens.
 */
export function createEmptyTokens(): DesignTokens {
  return {
    colors: [],
    typography: [],
    spacing: [],
    radii: [],
    shadows: [],
  };
}

/**
 * Creates sample brand tokens for testing.
 */
export function createSampleBrandTokens(): DesignTokens {
  return {
    colors: [
      { name: "primary", value: "#1a73e8", semantic: "brand" },
      { name: "secondary", value: "#34a853", semantic: "success" },
      { name: "accent", value: "#fbbc04", semantic: "warning" },
      { name: "error", value: "#ea4335", semantic: "error" },
      { name: "text", value: "#202124" },
      { name: "bg", value: "#ffffff" },
    ],
    typography: [
      { name: "h1", fontSize: "32px", fontWeight: 700, lineHeight: 1.2 },
      { name: "h2", fontSize: "24px", fontWeight: 600, lineHeight: 1.3 },
      { name: "body", fontSize: "16px", fontWeight: 400, lineHeight: 1.5 },
      { name: "small", fontSize: "14px", fontWeight: 400, lineHeight: 1.4 },
    ],
    spacing: [
      { name: "xs", value: "4px" },
      { name: "sm", value: "8px" },
      { name: "md", value: "16px" },
      { name: "lg", value: "24px" },
      { name: "xl", value: "32px" },
    ],
    radii: [
      { name: "sm", value: "4px" },
      { name: "md", value: "8px" },
      { name: "lg", value: "16px" },
      { name: "full", value: "9999px" },
    ],
    shadows: [
      { name: "sm", value: "0 1px 2px rgba(0,0,0,0.1)" },
      { name: "md", value: "0 4px 6px rgba(0,0,0,0.1)" },
    ],
  };
}

/**
 * Merges two token sets.
 */
export function mergeTokens(base: DesignTokens, override: Partial<DesignTokens>): DesignTokens {
  return {
    colors: override.colors ?? base.colors,
    typography: override.typography ?? base.typography,
    spacing: override.spacing ?? base.spacing,
    radii: override.radii ?? base.radii,
    shadows: override.shadows ?? base.shadows,
    custom: { ...base.custom, ...override.custom },
  };
}

/**
 * Validates token count is under limit.
 */
export function validateTokenCount(context: TokenContext, maxTokens: number): boolean {
  return context.tokenCount <= maxTokens;
}

/**
 * KnowledgeInjector — Prepends project knowledge to AI prompts
 *
 * Feature #29: Custom Knowledge - Knowledge injection
 *
 * Automatically injects relevant project knowledge into prompts:
 * - Prepends knowledge context before user messages
 * - Filters knowledge by relevance (category, file patterns)
 * - Maintains structured format for AI understanding
 * - Tracks token usage for budget management
 */

import {
  KnowledgeManager,
  getKnowledgeManager,
  type KnowledgeCategory,
  type KnowledgeEntry,
} from "./knowledge-manager";

// =============================================================================
// Types
// =============================================================================

/** Injection mode */
export type InjectionMode =
  | "prepend"   // Add before user message
  | "system"    // Add to system prompt
  | "context";  // Add as separate context block

/** Injection format */
export type InjectionFormat =
  | "markdown"  // Markdown with headers
  | "xml"       // XML tags for structure
  | "plain";    // Plain text

/** Injection result */
export interface InjectionResult {
  /** Original prompt */
  original: string;
  /** Injected prompt */
  injected: string;
  /** Knowledge entries included */
  includedEntries: string[];
  /** Estimated token count of injection */
  tokenEstimate: number;
  /** Whether injection was applied */
  applied: boolean;
}

/** Injection context for filtering */
export interface InjectionContext {
  /** Current file being edited */
  currentFile?: string;
  /** Task type */
  taskType?: "generate" | "edit" | "review" | "explain" | "other";
  /** Specific categories to include */
  categories?: KnowledgeCategory[];
  /** Tags to filter by */
  tags?: string[];
  /** Maximum tokens for knowledge context */
  maxTokens?: number;
}

/** Injector configuration */
export interface KnowledgeInjectorConfig {
  /** Injection mode */
  mode: InjectionMode;
  /** Format for injected content */
  format: InjectionFormat;
  /** Whether injection is enabled */
  enabled: boolean;
  /** Maximum tokens for knowledge context */
  maxKnowledgeTokens: number;
  /** Include knowledge section header */
  includeHeader: boolean;
  /** Header text */
  headerText: string;
  /** Categories to always include */
  alwaysIncludeCategories: KnowledgeCategory[];
  /** Separator between knowledge and prompt */
  separator: string;
}

/** Prompt with metadata */
export interface EnrichedPrompt {
  /** The prompt text */
  text: string;
  /** System prompt (if applicable) */
  systemPrompt?: string;
  /** Knowledge context (separate) */
  knowledgeContext?: string;
  /** Metadata */
  metadata: {
    knowledgeEntryIds: string[];
    estimatedTokens: number;
    injectionApplied: boolean;
  };
}

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_INJECTOR_CONFIG: KnowledgeInjectorConfig = {
  mode: "prepend",
  format: "markdown",
  enabled: true,
  maxKnowledgeTokens: 2000,
  includeHeader: true,
  headerText: "Project Knowledge",
  alwaysIncludeCategories: ["brand", "constraint"],
  separator: "\n\n---\n\n",
};

/** Token estimation constants */
const CHARS_PER_TOKEN = 4; // Rough estimate

// =============================================================================
// Helpers
// =============================================================================

/** Estimate token count from text */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Format knowledge as markdown */
function formatMarkdown(
  entries: KnowledgeEntry[],
  config: KnowledgeInjectorConfig
): string {
  const sections: string[] = [];

  if (config.includeHeader) {
    sections.push(`# ${config.headerText}\n`);
  }

  // Group by category
  const byCategory = new Map<KnowledgeCategory, KnowledgeEntry[]>();
  for (const entry of entries) {
    const list = byCategory.get(entry.category) || [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  // Format each category
  byCategory.forEach((catEntries, category) => {
    const categoryLabel = getCategoryLabel(category);
    sections.push(`## ${categoryLabel}\n`);

    for (const entry of catEntries) {
      sections.push(`### ${entry.title}\n${entry.content}\n`);
    }
  });

  return sections.join("\n");
}

/** Format knowledge as XML */
function formatXml(
  entries: KnowledgeEntry[],
  config: KnowledgeInjectorConfig
): string {
  const lines: string[] = [];

  lines.push(`<${config.headerText.toLowerCase().replace(/\s+/g, "-")}>`);

  for (const entry of entries) {
    lines.push(`  <knowledge category="${entry.category}" priority="${entry.priority}">`);
    lines.push(`    <title>${escapeXml(entry.title)}</title>`);
    lines.push(`    <content>${escapeXml(entry.content)}</content>`);
    if (entry.tags.length > 0) {
      lines.push(`    <tags>${entry.tags.join(", ")}</tags>`);
    }
    lines.push(`  </knowledge>`);
  }

  lines.push(`</${config.headerText.toLowerCase().replace(/\s+/g, "-")}>`);

  return lines.join("\n");
}

/** Format knowledge as plain text */
function formatPlain(
  entries: KnowledgeEntry[],
  config: KnowledgeInjectorConfig
): string {
  const lines: string[] = [];

  if (config.includeHeader) {
    lines.push(`=== ${config.headerText} ===\n`);
  }

  for (const entry of entries) {
    lines.push(`[${entry.category.toUpperCase()}] ${entry.title}`);
    lines.push(entry.content);
    lines.push("");
  }

  return lines.join("\n");
}

/** Escape XML special characters */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Get category label */
function getCategoryLabel(category: KnowledgeCategory): string {
  const labels: Record<KnowledgeCategory, string> = {
    brand: "Brand Guidelines",
    tone: "Tone & Voice",
    code: "Code Patterns",
    domain: "Domain Knowledge",
    constraint: "Constraints",
    example: "Examples",
    custom: "Additional Context",
  };
  return labels[category];
}

// =============================================================================
// KnowledgeInjector Class
// =============================================================================

/**
 * KnowledgeInjector prepends project knowledge to AI prompts.
 *
 * Usage:
 * ```ts
 * const injector = new KnowledgeInjector();
 *
 * // Inject knowledge into a prompt
 * const result = injector.inject("Create a hero section", {
 *   currentFile: "views/home.xml",
 *   taskType: "generate",
 * });
 *
 * // Use injected prompt
 * sendToAI(result.injected);
 *
 * // Or get enriched prompt with separate components
 * const enriched = injector.enrichPrompt("Create a hero section");
 * ```
 */
export class KnowledgeInjector {
  private config: KnowledgeInjectorConfig;
  private manager: KnowledgeManager;

  constructor(
    config: Partial<KnowledgeInjectorConfig> = {},
    manager?: KnowledgeManager
  ) {
    this.config = { ...DEFAULT_INJECTOR_CONFIG, ...config };
    this.manager = manager || getKnowledgeManager();
  }

  // ---------------------------------------------------------------------------
  // Main Injection
  // ---------------------------------------------------------------------------

  /**
   * Inject knowledge into a prompt.
   */
  inject(prompt: string, context: InjectionContext = {}): InjectionResult {
    if (!this.config.enabled) {
      return {
        original: prompt,
        injected: prompt,
        includedEntries: [],
        tokenEstimate: 0,
        applied: false,
      };
    }

    // Get relevant entries
    const entries = this.selectEntries(context);

    if (entries.length === 0) {
      return {
        original: prompt,
        injected: prompt,
        includedEntries: [],
        tokenEstimate: 0,
        applied: false,
      };
    }

    // Format knowledge
    const knowledge = this.formatKnowledge(entries);

    // Check token budget
    const tokenEstimate = estimateTokens(knowledge);
    const maxTokens = context.maxTokens || this.config.maxKnowledgeTokens;

    let finalKnowledge = knowledge;
    let finalEntries = entries;

    if (tokenEstimate > maxTokens) {
      // Trim to fit budget
      const { trimmedKnowledge, trimmedEntries } = this.trimToFit(
        entries,
        maxTokens
      );
      finalKnowledge = trimmedKnowledge;
      finalEntries = trimmedEntries;
    }

    // Build injected prompt
    const injected = this.buildInjectedPrompt(prompt, finalKnowledge);

    return {
      original: prompt,
      injected,
      includedEntries: finalEntries.map((e) => e.id),
      tokenEstimate: estimateTokens(finalKnowledge),
      applied: true,
    };
  }

  /**
   * Get an enriched prompt with separate components.
   */
  enrichPrompt(prompt: string, context: InjectionContext = {}): EnrichedPrompt {
    if (!this.config.enabled) {
      return {
        text: prompt,
        metadata: {
          knowledgeEntryIds: [],
          estimatedTokens: 0,
          injectionApplied: false,
        },
      };
    }

    const entries = this.selectEntries(context);
    const knowledge = entries.length > 0 ? this.formatKnowledge(entries) : undefined;

    const result: EnrichedPrompt = {
      text: prompt,
      metadata: {
        knowledgeEntryIds: entries.map((e) => e.id),
        estimatedTokens: knowledge ? estimateTokens(knowledge) : 0,
        injectionApplied: entries.length > 0,
      },
    };

    if (knowledge) {
      switch (this.config.mode) {
        case "system":
          result.systemPrompt = knowledge;
          break;
        case "context":
          result.knowledgeContext = knowledge;
          break;
        case "prepend":
        default:
          result.text = this.buildInjectedPrompt(prompt, knowledge);
          break;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Entry Selection
  // ---------------------------------------------------------------------------

  /**
   * Select relevant knowledge entries based on context.
   */
  private selectEntries(context: InjectionContext): KnowledgeEntry[] {
    // Start with always-include categories
    const categories = new Set<KnowledgeCategory>(
      this.config.alwaysIncludeCategories
    );

    // Add context-specific categories
    if (context.categories) {
      for (const cat of context.categories) {
        categories.add(cat);
      }
    }

    // Add task-type specific categories
    if (context.taskType) {
      switch (context.taskType) {
        case "generate":
          categories.add("brand");
          categories.add("tone");
          categories.add("example");
          break;
        case "edit":
          categories.add("code");
          break;
        case "review":
          categories.add("code");
          categories.add("constraint");
          break;
      }
    }

    // Get active entries
    let entries = this.manager.list({ active: true });

    // Filter by categories
    const categoryArray: KnowledgeCategory[] = [];
    categories.forEach((c) => categoryArray.push(c));
    entries = entries.filter((e) => categoryArray.includes(e.category));

    // Filter by file patterns if specified
    if (context.currentFile) {
      entries = entries.filter((e) => {
        if (!e.filePatterns || e.filePatterns.length === 0) return true;
        return e.filePatterns.some((pattern) => {
          try {
            const regex = new RegExp(pattern.replace(/\*/g, ".*"));
            return regex.test(context.currentFile!);
          } catch {
            return false;
          }
        });
      });
    }

    // Filter by tags if specified
    if (context.tags && context.tags.length > 0) {
      entries = entries.filter((e) =>
        context.tags!.some((tag) => e.tags.includes(tag))
      );
    }

    // Sort by priority
    entries.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  /**
   * Format knowledge entries according to config.
   */
  private formatKnowledge(entries: KnowledgeEntry[]): string {
    switch (this.config.format) {
      case "xml":
        return formatXml(entries, this.config);
      case "plain":
        return formatPlain(entries, this.config);
      case "markdown":
      default:
        return formatMarkdown(entries, this.config);
    }
  }

  /**
   * Build the final injected prompt.
   */
  private buildInjectedPrompt(prompt: string, knowledge: string): string {
    switch (this.config.mode) {
      case "system":
        // System mode - knowledge goes elsewhere
        return prompt;
      case "context":
        // Context mode - wrapped in special tags
        return `<knowledge-context>\n${knowledge}\n</knowledge-context>\n\n${prompt}`;
      case "prepend":
      default:
        return `${knowledge}${this.config.separator}${prompt}`;
    }
  }

  /**
   * Trim entries to fit within token budget.
   */
  private trimToFit(
    entries: KnowledgeEntry[],
    maxTokens: number
  ): { trimmedKnowledge: string; trimmedEntries: KnowledgeEntry[] } {
    const trimmedEntries: KnowledgeEntry[] = [];
    let currentTokens = 0;

    // Add entries until we hit the budget
    for (const entry of entries) {
      const entryText = `${entry.title}\n${entry.content}\n`;
      const entryTokens = estimateTokens(entryText);

      if (currentTokens + entryTokens > maxTokens) {
        break;
      }

      trimmedEntries.push(entry);
      currentTokens += entryTokens;
    }

    return {
      trimmedKnowledge: this.formatKnowledge(trimmedEntries),
      trimmedEntries,
    };
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Enable injection */
  enable(): void {
    this.config.enabled = true;
  }

  /** Disable injection */
  disable(): void {
    this.config.enabled = false;
  }

  /** Check if enabled */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Get configuration */
  getConfig(): KnowledgeInjectorConfig {
    return { ...this.config };
  }

  /** Update configuration */
  setConfig(config: Partial<KnowledgeInjectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Set injection mode */
  setMode(mode: InjectionMode): void {
    this.config.mode = mode;
  }

  /** Set format */
  setFormat(format: InjectionFormat): void {
    this.config.format = format;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: KnowledgeInjector | null = null;

/** Get the global KnowledgeInjector instance */
export function getKnowledgeInjector(): KnowledgeInjector {
  if (!_instance) {
    _instance = new KnowledgeInjector();
  }
  return _instance;
}

/** Reset the global KnowledgeInjector instance */
export function resetKnowledgeInjector(): void {
  _instance = null;
}

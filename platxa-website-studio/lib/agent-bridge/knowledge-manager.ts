/**
 * KnowledgeManager — CRUD for Project Knowledge Entries
 *
 * Feature #28: Custom Knowledge - Knowledge management
 *
 * Manages custom knowledge entries that inform AI generation:
 * - Brand guidelines and tone
 * - Code patterns and conventions
 * - Domain-specific terminology
 * - Project requirements and constraints
 *
 * Supports persistence to localStorage and export/import.
 */

// =============================================================================
// Types
// =============================================================================

/** Knowledge entry categories */
export type KnowledgeCategory =
  | "brand"       // Brand guidelines, colors, fonts
  | "tone"        // Writing style, voice
  | "code"        // Code patterns, conventions
  | "domain"      // Domain terminology, concepts
  | "constraint"  // Requirements, limitations
  | "example"     // Example content, templates
  | "custom";     // User-defined category

/** Knowledge entry priority */
export type KnowledgePriority = "high" | "medium" | "low";

/** A knowledge entry */
export interface KnowledgeEntry {
  /** Unique entry ID */
  id: string;
  /** Entry title */
  title: string;
  /** Entry content (markdown supported) */
  content: string;
  /** Category */
  category: KnowledgeCategory;
  /** Priority for context inclusion */
  priority: KnowledgePriority;
  /** Tags for filtering */
  tags: string[];
  /** Whether entry is active (included in context) */
  active: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Source of knowledge (user, imported, generated) */
  source: "user" | "imported" | "generated";
  /** Associated file patterns (for code knowledge) */
  filePatterns?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/** Knowledge creation input */
export interface CreateKnowledgeInput {
  title: string;
  content: string;
  category: KnowledgeCategory;
  priority?: KnowledgePriority;
  tags?: string[];
  active?: boolean;
  source?: "user" | "imported" | "generated";
  filePatterns?: string[];
  metadata?: Record<string, unknown>;
}

/** Knowledge update input */
export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  category?: KnowledgeCategory;
  priority?: KnowledgePriority;
  tags?: string[];
  active?: boolean;
  filePatterns?: string[];
  metadata?: Record<string, unknown>;
}

/** Query options for listing knowledge */
export interface KnowledgeQuery {
  category?: KnowledgeCategory;
  priority?: KnowledgePriority;
  tags?: string[];
  active?: boolean;
  source?: "user" | "imported" | "generated";
  search?: string;
  limit?: number;
  offset?: number;
}

/** Knowledge manager state */
export interface KnowledgeManagerState {
  entries: KnowledgeEntry[];
  lastSync: number;
  version: number;
}

/** Event types */
export type KnowledgeEventType =
  | "entry_created"
  | "entry_updated"
  | "entry_deleted"
  | "bulk_import"
  | "state_loaded"
  | "state_cleared";

/** Event data */
export interface KnowledgeEvent {
  type: KnowledgeEventType;
  entryId?: string;
  count?: number;
  timestamp: number;
}

/** Event listener */
export type KnowledgeEventListener = (event: KnowledgeEvent) => void;

/** Manager configuration */
export interface KnowledgeManagerConfig {
  /** Storage key for persistence */
  storageKey: string;
  /** Maximum entries allowed */
  maxEntries: number;
  /** Maximum content length per entry */
  maxContentLength: number;
  /** Auto-persist on changes */
  autoPersist: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeManagerConfig = {
  storageKey: "platxa-knowledge-manager",
  maxEntries: 500,
  maxContentLength: 50000,
  autoPersist: true,
};

/** Category display info */
export const CATEGORY_INFO: Record<KnowledgeCategory, { label: string; icon: string }> = {
  brand: { label: "Brand", icon: "🎨" },
  tone: { label: "Tone & Voice", icon: "💬" },
  code: { label: "Code Patterns", icon: "💻" },
  domain: { label: "Domain Knowledge", icon: "📚" },
  constraint: { label: "Constraints", icon: "⚠️" },
  example: { label: "Examples", icon: "📝" },
  custom: { label: "Custom", icon: "📌" },
};

/** State version for migrations */
const STATE_VERSION = 1;

// =============================================================================
// Helpers
// =============================================================================

let _entryCounter = 0;

/** Reset counters (for testing) */
export function resetKnowledgeCounters(): void {
  _entryCounter = 0;
}

/** Generate entry ID */
function generateEntryId(): string {
  return `kb-${Date.now()}-${_entryCounter++}`;
}

/** Create initial state */
function createInitialState(): KnowledgeManagerState {
  return {
    entries: [],
    lastSync: 0,
    version: STATE_VERSION,
  };
}

/** Validate entry content */
function validateEntry(
  input: CreateKnowledgeInput,
  config: KnowledgeManagerConfig
): string | null {
  if (!input.title || input.title.trim().length === 0) {
    return "Title is required";
  }
  if (!input.content || input.content.trim().length === 0) {
    return "Content is required";
  }
  if (input.content.length > config.maxContentLength) {
    return `Content exceeds maximum length of ${config.maxContentLength}`;
  }
  return null;
}

/** Match entry against query */
function matchesQuery(entry: KnowledgeEntry, query: KnowledgeQuery): boolean {
  if (query.category && entry.category !== query.category) return false;
  if (query.priority && entry.priority !== query.priority) return false;
  if (query.active !== undefined && entry.active !== query.active) return false;
  if (query.source && entry.source !== query.source) return false;

  if (query.tags && query.tags.length > 0) {
    const hasTag = query.tags.some((tag) => entry.tags.includes(tag));
    if (!hasTag) return false;
  }

  if (query.search) {
    const search = query.search.toLowerCase();
    const inTitle = entry.title.toLowerCase().includes(search);
    const inContent = entry.content.toLowerCase().includes(search);
    const inTags = entry.tags.some((t) => t.toLowerCase().includes(search));
    if (!inTitle && !inContent && !inTags) return false;
  }

  return true;
}

// =============================================================================
// KnowledgeManager Class
// =============================================================================

/**
 * KnowledgeManager handles CRUD operations for project knowledge entries.
 *
 * Usage:
 * ```ts
 * const manager = new KnowledgeManager();
 *
 * // Create entry
 * const entry = manager.create({
 *   title: "Brand Colors",
 *   content: "Primary: #3b82f6, Secondary: #10b981",
 *   category: "brand",
 * });
 *
 * // Query entries
 * const brandEntries = manager.list({ category: "brand", active: true });
 *
 * // Get context for AI
 * const context = manager.getContextString();
 * ```
 */
export class KnowledgeManager {
  private config: KnowledgeManagerConfig;
  private state: KnowledgeManagerState;
  private listeners: Set<KnowledgeEventListener> = new Set();
  private storage: Storage | null = null;

  constructor(config: Partial<KnowledgeManagerConfig> = {}) {
    this.config = { ...DEFAULT_KNOWLEDGE_CONFIG, ...config };
    this.state = createInitialState();

    // Initialize storage
    if (typeof window !== "undefined") {
      this.storage = window.localStorage;
      this.load();
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a new knowledge entry.
   */
  create(input: CreateKnowledgeInput): KnowledgeEntry {
    const error = validateEntry(input, this.config);
    if (error) {
      throw new Error(error);
    }

    if (this.state.entries.length >= this.config.maxEntries) {
      throw new Error(`Maximum entries (${this.config.maxEntries}) reached`);
    }

    const now = Date.now();
    const entry: KnowledgeEntry = {
      id: generateEntryId(),
      title: input.title.trim(),
      content: input.content,
      category: input.category,
      priority: input.priority || "medium",
      tags: input.tags || [],
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
      source: input.source || "user",
      filePatterns: input.filePatterns,
      metadata: input.metadata,
    };

    this.state.entries.push(entry);
    this.emit({ type: "entry_created", entryId: entry.id, timestamp: now });

    if (this.config.autoPersist) {
      this.persist();
    }

    return entry;
  }

  /**
   * Read a knowledge entry by ID.
   */
  read(id: string): KnowledgeEntry | null {
    return this.state.entries.find((e) => e.id === id) || null;
  }

  /**
   * Update an existing knowledge entry.
   */
  update(id: string, input: UpdateKnowledgeInput): KnowledgeEntry | null {
    const index = this.state.entries.findIndex((e) => e.id === id);
    if (index === -1) return null;

    const entry = this.state.entries[index];
    const now = Date.now();

    // Validate content length if provided
    if (input.content && input.content.length > this.config.maxContentLength) {
      throw new Error(`Content exceeds maximum length of ${this.config.maxContentLength}`);
    }

    const updated: KnowledgeEntry = {
      ...entry,
      title: input.title !== undefined ? input.title.trim() : entry.title,
      content: input.content !== undefined ? input.content : entry.content,
      category: input.category !== undefined ? input.category : entry.category,
      priority: input.priority !== undefined ? input.priority : entry.priority,
      tags: input.tags !== undefined ? input.tags : entry.tags,
      active: input.active !== undefined ? input.active : entry.active,
      filePatterns: input.filePatterns !== undefined ? input.filePatterns : entry.filePatterns,
      metadata: input.metadata !== undefined ? input.metadata : entry.metadata,
      updatedAt: now,
    };

    this.state.entries[index] = updated;
    this.emit({ type: "entry_updated", entryId: id, timestamp: now });

    if (this.config.autoPersist) {
      this.persist();
    }

    return updated;
  }

  /**
   * Delete a knowledge entry.
   */
  delete(id: string): boolean {
    const index = this.state.entries.findIndex((e) => e.id === id);
    if (index === -1) return false;

    this.state.entries.splice(index, 1);
    this.emit({ type: "entry_deleted", entryId: id, timestamp: Date.now() });

    if (this.config.autoPersist) {
      this.persist();
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Query Operations
  // ---------------------------------------------------------------------------

  /**
   * List knowledge entries with optional filtering.
   */
  list(query: KnowledgeQuery = {}): KnowledgeEntry[] {
    let results = this.state.entries.filter((e) => matchesQuery(e, query));

    // Sort by priority (high first) then by updated date
    results.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.updatedAt - a.updatedAt;
    });

    // Apply pagination
    if (query.offset) {
      results = results.slice(query.offset);
    }
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get all unique tags.
   */
  getTags(): string[] {
    const tagSet = new Set<string>();
    for (const entry of this.state.entries) {
      for (const tag of entry.tags) {
        tagSet.add(tag);
      }
    }
    const result: string[] = [];
    tagSet.forEach((t) => result.push(t));
    return result.sort();
  }

  /**
   * Count entries by category.
   */
  countByCategory(): Record<KnowledgeCategory, number> {
    const counts: Record<KnowledgeCategory, number> = {
      brand: 0,
      tone: 0,
      code: 0,
      domain: 0,
      constraint: 0,
      example: 0,
      custom: 0,
    };

    for (const entry of this.state.entries) {
      counts[entry.category]++;
    }

    return counts;
  }

  // ---------------------------------------------------------------------------
  // Context Generation
  // ---------------------------------------------------------------------------

  /**
   * Get active knowledge as a context string for AI prompts.
   */
  getContextString(options: {
    categories?: KnowledgeCategory[];
    maxLength?: number;
    filePattern?: string;
  } = {}): string {
    const activeEntries = this.list({ active: true });

    let filtered = activeEntries;

    // Filter by categories if specified
    if (options.categories) {
      filtered = filtered.filter((e) => options.categories!.includes(e.category));
    }

    // Filter by file pattern if specified
    if (options.filePattern) {
      filtered = filtered.filter((e) => {
        if (!e.filePatterns || e.filePatterns.length === 0) return true;
        return e.filePatterns.some((pattern) => {
          const regex = new RegExp(pattern.replace(/\*/g, ".*"));
          return regex.test(options.filePattern!);
        });
      });
    }

    // Build context string
    const sections: string[] = [];

    // Group by category
    const byCategory = new Map<KnowledgeCategory, KnowledgeEntry[]>();
    for (const entry of filtered) {
      const list = byCategory.get(entry.category) || [];
      list.push(entry);
      byCategory.set(entry.category, list);
    }

    byCategory.forEach((entries, category) => {
      const info = CATEGORY_INFO[category];
      sections.push(`## ${info.label}\n`);
      for (const entry of entries) {
        sections.push(`### ${entry.title}\n${entry.content}\n`);
      }
    });

    let result = sections.join("\n");

    // Truncate if needed
    if (options.maxLength && result.length > options.maxLength) {
      result = result.slice(0, options.maxLength) + "\n...(truncated)";
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Bulk Operations
  // ---------------------------------------------------------------------------

  /**
   * Import multiple entries.
   */
  importEntries(entries: CreateKnowledgeInput[]): KnowledgeEntry[] {
    const created: KnowledgeEntry[] = [];

    for (const input of entries) {
      try {
        const entry = this.create({ ...input, source: "imported" });
        created.push(entry);
      } catch {
        // Skip invalid entries
      }
    }

    this.emit({
      type: "bulk_import",
      count: created.length,
      timestamp: Date.now(),
    });

    return created;
  }

  /**
   * Export all entries.
   */
  exportEntries(): KnowledgeEntry[] {
    return [...this.state.entries];
  }

  /**
   * Toggle active state for multiple entries.
   */
  toggleActive(ids: string[], active: boolean): number {
    let count = 0;
    for (const id of ids) {
      if (this.update(id, { active })) {
        count++;
      }
    }
    return count;
  }

  /**
   * Delete multiple entries.
   */
  deleteMultiple(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      if (this.delete(id)) {
        count++;
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Persist state to storage.
   */
  persist(): void {
    if (!this.storage) return;

    try {
      this.state.lastSync = Date.now();
      this.storage.setItem(this.config.storageKey, JSON.stringify(this.state));
    } catch (error) {
      console.error("[KnowledgeManager] Failed to persist:", error);
    }
  }

  /**
   * Load state from storage.
   */
  load(): void {
    if (!this.storage) return;

    try {
      const raw = this.storage.getItem(this.config.storageKey);
      if (!raw) return;

      const loaded = JSON.parse(raw) as KnowledgeManagerState;

      // Validate structure
      if (Array.isArray(loaded.entries)) {
        this.state = {
          entries: loaded.entries,
          lastSync: loaded.lastSync || 0,
          version: loaded.version || STATE_VERSION,
        };
        this.emit({ type: "state_loaded", timestamp: Date.now() });
      }
    } catch (error) {
      console.warn("[KnowledgeManager] Failed to load:", error);
    }
  }

  /**
   * Clear all data.
   */
  clear(): void {
    this.state = createInitialState();

    if (this.storage) {
      this.storage.removeItem(this.config.storageKey);
    }

    this.emit({ type: "state_cleared", timestamp: Date.now() });
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  /** Subscribe to events */
  on(listener: KnowledgeEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Unsubscribe from events */
  off(listener: KnowledgeEventListener): void {
    this.listeners.delete(listener);
  }

  private emit(event: KnowledgeEvent): void {
    const listenersArray: KnowledgeEventListener[] = [];
    this.listeners.forEach((l) => listenersArray.push(l));

    for (const listener of listenersArray) {
      try {
        listener(event);
      } catch (error) {
        console.error("[KnowledgeManager] Listener error:", error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // State Access
  // ---------------------------------------------------------------------------

  /** Get entry count */
  getCount(): number {
    return this.state.entries.length;
  }

  /** Get last sync time */
  getLastSync(): number {
    return this.state.lastSync;
  }

  /** Get configuration */
  getConfig(): KnowledgeManagerConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: KnowledgeManager | null = null;

/** Get the global KnowledgeManager instance */
export function getKnowledgeManager(): KnowledgeManager {
  if (!_instance) {
    _instance = new KnowledgeManager();
  }
  return _instance;
}

/** Reset the global KnowledgeManager instance */
export function resetKnowledgeManager(): void {
  if (_instance) {
    _instance.clear();
    _instance = null;
  }
  resetKnowledgeCounters();
}

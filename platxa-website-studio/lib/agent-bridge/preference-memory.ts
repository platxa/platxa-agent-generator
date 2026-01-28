/**
 * Preference Memory — Cross-Session User Style Preferences
 *
 * Stores and retrieves user style preferences, rejected options,
 * and favorite patterns to personalize AI generation across sessions.
 */

// =============================================================================
// Types
// =============================================================================

/** Categories of preferences the agent tracks */
export type PreferenceCategory =
  | "color"
  | "font"
  | "layout"
  | "spacing"
  | "style"
  | "component"
  | "pattern"
  | "animation"
  | "imagery";

/** A single preference entry */
export interface PreferenceEntry {
  /** Unique preference ID */
  id: string;
  /** Category of this preference */
  category: PreferenceCategory;
  /** The preference key (e.g. "primary-color", "heading-font") */
  key: string;
  /** The preferred value */
  value: string;
  /** Confidence score 0-1 (higher = more certain) */
  confidence: number;
  /** How many times this preference was reinforced */
  reinforcementCount: number;
  /** ISO timestamp of first observation */
  firstSeen: string;
  /** ISO timestamp of last reinforcement */
  lastSeen: string;
  /** Source of the preference (explicit user choice, inferred from behavior) */
  source: "explicit" | "inferred";
}

/** A rejected option the user explicitly declined */
export interface RejectedOption {
  /** Category */
  category: PreferenceCategory;
  /** What was rejected */
  key: string;
  /** The rejected value */
  value: string;
  /** Reason if provided */
  reason?: string;
  /** ISO timestamp */
  rejectedAt: string;
}

/** A favorite pattern the user approved or reused */
export interface FavoritePattern {
  /** Pattern identifier */
  id: string;
  /** Pattern name (e.g. "hero-split-layout", "card-grid-3col") */
  name: string;
  /** Category */
  category: PreferenceCategory;
  /** Times this pattern was used */
  useCount: number;
  /** ISO timestamp of last use */
  lastUsed: string;
  /** Optional tags for search */
  tags: string[];
}

/** Full preference memory state */
export interface PreferenceMemory {
  /** Active preferences */
  preferences: Map<string, PreferenceEntry>;
  /** Rejected options */
  rejections: RejectedOption[];
  /** Favorite patterns */
  favorites: Map<string, FavoritePattern>;
  /** Session ID for tracking */
  sessionId: string;
}

/** Serializable form for persistence */
export interface SerializedMemory {
  preferences: PreferenceEntry[];
  rejections: RejectedOption[];
  favorites: FavoritePattern[];
  sessionId: string;
  version: number;
  exportedAt: string;
}

// =============================================================================
// Memory Management
// =============================================================================

let entryCounter = 0;

/** Reset counter (for testing). */
export function resetEntryCounter(): void {
  entryCounter = 0;
}

/** Creates a new empty preference memory. */
export function createMemory(sessionId: string = "default"): PreferenceMemory {
  return {
    preferences: new Map(),
    rejections: [],
    favorites: new Map(),
    sessionId,
  };
}

/** Records or reinforces a preference. */
export function recordPreference(
  memory: PreferenceMemory,
  category: PreferenceCategory,
  key: string,
  value: string,
  source: "explicit" | "inferred" = "explicit",
): PreferenceMemory {
  const prefKey = `${category}:${key}`;
  const existing = memory.preferences.get(prefKey);
  const now = new Date().toISOString();

  const preferences = new Map(memory.preferences);

  if (existing && existing.value === value) {
    // Reinforce existing preference
    const newConfidence = Math.min(1, existing.confidence + 0.1);
    preferences.set(prefKey, {
      ...existing,
      confidence: newConfidence,
      reinforcementCount: existing.reinforcementCount + 1,
      lastSeen: now,
      source: source === "explicit" ? "explicit" : existing.source,
    });
  } else {
    // New or changed preference
    entryCounter++;
    preferences.set(prefKey, {
      id: `pref_${entryCounter}`,
      category,
      key,
      value,
      confidence: source === "explicit" ? 0.8 : 0.4,
      reinforcementCount: 1,
      firstSeen: now,
      lastSeen: now,
      source,
    });
  }

  return { ...memory, preferences };
}

/** Records a rejected option. */
export function recordRejection(
  memory: PreferenceMemory,
  category: PreferenceCategory,
  key: string,
  value: string,
  reason?: string,
): PreferenceMemory {
  const rejection: RejectedOption = {
    category,
    key,
    value,
    reason,
    rejectedAt: new Date().toISOString(),
  };
  return { ...memory, rejections: [...memory.rejections, rejection] };
}

/** Records or reinforces a favorite pattern. */
export function recordFavorite(
  memory: PreferenceMemory,
  name: string,
  category: PreferenceCategory,
  tags: string[] = [],
): PreferenceMemory {
  const existing = memory.favorites.get(name);
  const now = new Date().toISOString();
  const favorites = new Map(memory.favorites);

  if (existing) {
    favorites.set(name, {
      ...existing,
      useCount: existing.useCount + 1,
      lastUsed: now,
      tags: [...new Set([...existing.tags, ...tags])],
    });
  } else {
    entryCounter++;
    favorites.set(name, {
      id: `fav_${entryCounter}`,
      name,
      category,
      useCount: 1,
      lastUsed: now,
      tags,
    });
  }

  return { ...memory, favorites };
}

// =============================================================================
// Queries
// =============================================================================

/** Gets a preference value by category and key. */
export function getPreference(
  memory: PreferenceMemory,
  category: PreferenceCategory,
  key: string,
): PreferenceEntry | null {
  return memory.preferences.get(`${category}:${key}`) ?? null;
}

/** Gets all preferences for a category. */
export function getPreferencesByCategory(
  memory: PreferenceMemory,
  category: PreferenceCategory,
): PreferenceEntry[] {
  return Array.from(memory.preferences.values()).filter((p) => p.category === category);
}

/** Checks if a value was previously rejected. */
export function wasRejected(
  memory: PreferenceMemory,
  category: PreferenceCategory,
  key: string,
  value: string,
): boolean {
  return memory.rejections.some(
    (r) => r.category === category && r.key === key && r.value === value,
  );
}

/** Gets rejections for a category. */
export function getRejections(
  memory: PreferenceMemory,
  category: PreferenceCategory,
): RejectedOption[] {
  return memory.rejections.filter((r) => r.category === category);
}

/** Gets top N favorites by use count. */
export function getTopFavorites(
  memory: PreferenceMemory,
  n: number = 5,
  category?: PreferenceCategory,
): FavoritePattern[] {
  let favs = Array.from(memory.favorites.values());
  if (category) favs = favs.filter((f) => f.category === category);
  return favs.sort((a, b) => b.useCount - a.useCount).slice(0, n);
}

/** Gets high-confidence preferences (confidence >= threshold). */
export function getStrongPreferences(
  memory: PreferenceMemory,
  threshold: number = 0.7,
): PreferenceEntry[] {
  return Array.from(memory.preferences.values()).filter((p) => p.confidence >= threshold);
}

// =============================================================================
// Serialization
// =============================================================================

/** Serializes memory for persistence. */
export function serializeMemory(memory: PreferenceMemory): SerializedMemory {
  return {
    preferences: Array.from(memory.preferences.values()),
    rejections: memory.rejections,
    favorites: Array.from(memory.favorites.values()),
    sessionId: memory.sessionId,
    version: 1,
    exportedAt: new Date().toISOString(),
  };
}

/** Deserializes memory from stored data. */
export function deserializeMemory(data: SerializedMemory): PreferenceMemory {
  const preferences = new Map<string, PreferenceEntry>();
  for (const p of data.preferences) {
    preferences.set(`${p.category}:${p.key}`, p);
  }
  const favorites = new Map<string, FavoritePattern>();
  for (const f of data.favorites) {
    favorites.set(f.name, f);
  }
  return {
    preferences,
    rejections: data.rejections,
    favorites,
    sessionId: data.sessionId,
  };
}

/** Merges two memories (e.g. from different sessions). Later entries win on conflict. */
export function mergeMemories(
  base: PreferenceMemory,
  incoming: PreferenceMemory,
): PreferenceMemory {
  const preferences = new Map(base.preferences);
  for (const [key, entry] of incoming.preferences) {
    const existing = preferences.get(key);
    if (!existing || new Date(entry.lastSeen) >= new Date(existing.lastSeen)) {
      preferences.set(key, entry);
    }
  }

  const favorites = new Map(base.favorites);
  for (const [name, fav] of incoming.favorites) {
    const existing = favorites.get(name);
    if (existing) {
      favorites.set(name, {
        ...fav,
        useCount: existing.useCount + fav.useCount,
        tags: [...new Set([...existing.tags, ...fav.tags])],
      });
    } else {
      favorites.set(name, fav);
    }
  }

  // Deduplicate rejections by category+key+value
  const rejSet = new Set(
    base.rejections.map((r) => `${r.category}:${r.key}:${r.value}`),
  );
  const mergedRejections = [...base.rejections];
  for (const r of incoming.rejections) {
    const rk = `${r.category}:${r.key}:${r.value}`;
    if (!rejSet.has(rk)) {
      mergedRejections.push(r);
      rejSet.add(rk);
    }
  }

  return {
    preferences,
    rejections: mergedRejections,
    favorites,
    sessionId: base.sessionId,
  };
}

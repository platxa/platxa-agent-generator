/**
 * Theme Version Manager
 *
 * Provides versioning and change history tracking for themes with:
 * - Semantic versioning (major.minor.patch)
 * - Change history with categorized modifications
 * - Diff between versions
 * - Rollback to previous versions
 * - Persistence support
 *
 * Feature #14: Add theme versioning and change history tracking
 */

// =============================================================================
// Types
// =============================================================================

/** Semantic version */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

/** Version bump type */
export type VersionBump = "major" | "minor" | "patch";

/** Change category */
export type ChangeCategory =
  | "colors"
  | "typography"
  | "spacing"
  | "layout"
  | "components"
  | "assets"
  | "config"
  | "breaking";

/** A single change entry */
export interface ThemeChange {
  /** Change ID */
  id: string;
  /** Category of change */
  category: ChangeCategory;
  /** Human-readable description */
  description: string;
  /** Property path that changed (e.g., "colors.primary") */
  path: string;
  /** Old value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
  /** Timestamp */
  timestamp: Date;
}

/** A theme version snapshot */
export interface ThemeVersion {
  /** Version string (e.g., "1.2.3") */
  version: string;
  /** Semantic version parts */
  semver: SemanticVersion;
  /** Version label (e.g., "Initial Release", "Color Update") */
  label: string;
  /** Description of changes in this version */
  description?: string;
  /** Changes from previous version */
  changes: ThemeChange[];
  /** Full theme state at this version */
  state: ThemeState;
  /** Creation timestamp */
  createdAt: Date;
  /** Author (if applicable) */
  author?: string;
  /** Is this version published/released */
  isPublished: boolean;
  /** Tags for this version */
  tags: string[];
}

/** Theme state (the actual theme data) */
export interface ThemeState {
  /** Theme ID */
  id: string;
  /** Theme name */
  name: string;
  /** Color configuration */
  colors: Record<string, string>;
  /** Typography configuration */
  typography: Record<string, string | number>;
  /** Spacing configuration */
  spacing: Record<string, string>;
  /** Layout configuration */
  layout: Record<string, unknown>;
  /** Component styles */
  components?: Record<string, unknown>;
  /** Asset references */
  assets?: string[];
  /** Custom configuration */
  config?: Record<string, unknown>;
}

/** Diff between two versions */
export interface VersionDiff {
  /** From version */
  fromVersion: string;
  /** To version */
  toVersion: string;
  /** All changes between versions */
  changes: ThemeChange[];
  /** Summary by category */
  summary: Record<ChangeCategory, number>;
  /** Total changes */
  totalChanges: number;
  /** Is this a breaking change */
  isBreaking: boolean;
}

/** Version history for a theme */
export interface ThemeVersionHistory {
  /** Theme ID */
  themeId: string;
  /** Current version */
  currentVersion: string;
  /** All versions (newest first) */
  versions: ThemeVersion[];
  /** Creation date */
  createdAt: Date;
  /** Last modified date */
  updatedAt: Date;
}

/** Rollback result */
export interface RollbackResult {
  /** Success status */
  success: boolean;
  /** Previous version before rollback */
  fromVersion: string;
  /** Version rolled back to */
  toVersion: string;
  /** Rolled back state */
  state: ThemeState;
  /** Changes that were reverted */
  revertedChanges: ThemeChange[];
}

/** Manager options */
export interface ThemeVersionManagerOptions {
  /** Maximum versions to keep (0 = unlimited) */
  maxVersions?: number;
  /** Auto-bump type for changes */
  autoBump?: VersionBump;
  /** Enable persistence */
  persist?: boolean;
}

// =============================================================================
// Theme Version Manager
// =============================================================================

/**
 * ThemeVersionManager handles versioning and change tracking for themes.
 *
 * @example
 * ```typescript
 * const manager = new ThemeVersionManager();
 *
 * // Create initial version
 * manager.createVersion("my-theme", initialState, "1.0.0", "Initial Release");
 *
 * // Make changes and create new version
 * manager.recordChange("my-theme", {
 *   category: "colors",
 *   description: "Updated primary color",
 *   path: "colors.primary",
 *   oldValue: "#3b82f6",
 *   newValue: "#7c3aed"
 * });
 * manager.commitVersion("my-theme", "patch", "Color tweak");
 *
 * // Diff between versions
 * const diff = manager.diffVersions("my-theme", "1.0.0", "1.0.1");
 *
 * // Rollback
 * const result = manager.rollback("my-theme", "1.0.0");
 * ```
 */
export class ThemeVersionManager {
  private histories: Map<string, ThemeVersionHistory> = new Map();
  private pendingChanges: Map<string, ThemeChange[]> = new Map();
  private options: Required<ThemeVersionManagerOptions>;
  private listeners: Set<(event: VersionEvent) => void> = new Set();

  constructor(options: ThemeVersionManagerOptions = {}) {
    this.options = {
      maxVersions: options.maxVersions ?? 50,
      autoBump: options.autoBump ?? "patch",
      persist: options.persist ?? false,
    };
  }

  // ===========================================================================
  // Version Management
  // ===========================================================================

  /**
   * Create the initial version for a theme
   */
  createVersion(
    themeId: string,
    state: ThemeState,
    version: string = "1.0.0",
    label: string = "Initial Release",
    description?: string
  ): ThemeVersion {
    const semver = parseVersion(version);
    const themeVersion: ThemeVersion = {
      version,
      semver,
      label,
      description,
      changes: [],
      state: deepClone(state),
      createdAt: new Date(),
      isPublished: false,
      tags: [],
    };

    // Create history if doesn't exist
    if (!this.histories.has(themeId)) {
      this.histories.set(themeId, {
        themeId,
        currentVersion: version,
        versions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const history = this.histories.get(themeId)!;
    history.versions.unshift(themeVersion);
    history.currentVersion = version;
    history.updatedAt = new Date();

    this.enforceMaxVersions(themeId);
    this.emit({ type: "version_created", themeId, version: themeVersion });

    return themeVersion;
  }

  /**
   * Record a change (before committing a new version)
   */
  recordChange(
    themeId: string,
    change: Omit<ThemeChange, "id" | "timestamp">
  ): ThemeChange {
    const fullChange: ThemeChange = {
      ...change,
      id: generateId(),
      timestamp: new Date(),
    };

    if (!this.pendingChanges.has(themeId)) {
      this.pendingChanges.set(themeId, []);
    }
    this.pendingChanges.get(themeId)!.push(fullChange);

    this.emit({ type: "change_recorded", themeId, change: fullChange });

    return fullChange;
  }

  /**
   * Record multiple changes at once
   */
  recordChanges(
    themeId: string,
    changes: Array<Omit<ThemeChange, "id" | "timestamp">>
  ): ThemeChange[] {
    return changes.map((c) => this.recordChange(themeId, c));
  }

  /**
   * Commit pending changes as a new version
   */
  commitVersion(
    themeId: string,
    bumpType: VersionBump,
    label: string,
    newState: ThemeState,
    description?: string
  ): ThemeVersion | null {
    const history = this.histories.get(themeId);
    if (!history || history.versions.length === 0) {
      return null;
    }

    const currentVersion = history.versions[0];
    const newVersionString = bumpVersion(currentVersion.version, bumpType);
    const pendingChanges = this.pendingChanges.get(themeId) || [];

    // Detect additional changes by diffing states
    const detectedChanges = this.detectChanges(currentVersion.state, newState);
    const allChanges = [...pendingChanges, ...detectedChanges];

    // Check for breaking changes
    const hasBreaking = allChanges.some((c) => c.category === "breaking");

    const themeVersion: ThemeVersion = {
      version: newVersionString,
      semver: parseVersion(newVersionString),
      label,
      description,
      changes: allChanges,
      state: deepClone(newState),
      createdAt: new Date(),
      isPublished: false,
      tags: hasBreaking ? ["breaking"] : [],
    };

    history.versions.unshift(themeVersion);
    history.currentVersion = newVersionString;
    history.updatedAt = new Date();

    // Clear pending changes
    this.pendingChanges.delete(themeId);

    this.enforceMaxVersions(themeId);
    this.emit({ type: "version_committed", themeId, version: themeVersion });

    return themeVersion;
  }

  /**
   * Get the current version for a theme
   */
  getCurrentVersion(themeId: string): ThemeVersion | null {
    const history = this.histories.get(themeId);
    if (!history || history.versions.length === 0) return null;
    return history.versions[0];
  }

  /**
   * Get a specific version
   */
  getVersion(themeId: string, version: string): ThemeVersion | null {
    const history = this.histories.get(themeId);
    if (!history) return null;
    return history.versions.find((v) => v.version === version) || null;
  }

  /**
   * Get all versions for a theme
   */
  getVersions(themeId: string): ThemeVersion[] {
    const history = this.histories.get(themeId);
    return history?.versions || [];
  }

  /**
   * Get version history
   */
  getHistory(themeId: string): ThemeVersionHistory | null {
    return this.histories.get(themeId) || null;
  }

  // ===========================================================================
  // Diff
  // ===========================================================================

  /**
   * Get diff between two versions
   */
  diffVersions(
    themeId: string,
    fromVersion: string,
    toVersion: string
  ): VersionDiff | null {
    const history = this.histories.get(themeId);
    if (!history) return null;

    const fromIdx = history.versions.findIndex((v) => v.version === fromVersion);
    const toIdx = history.versions.findIndex((v) => v.version === toVersion);

    if (fromIdx === -1 || toIdx === -1) return null;

    // Collect all changes between versions
    const changes: ThemeChange[] = [];
    const startIdx = Math.min(fromIdx, toIdx);
    const endIdx = Math.max(fromIdx, toIdx);

    for (let i = startIdx; i < endIdx; i++) {
      changes.push(...history.versions[i].changes);
    }

    // Build summary
    const summary: Record<ChangeCategory, number> = {
      colors: 0,
      typography: 0,
      spacing: 0,
      layout: 0,
      components: 0,
      assets: 0,
      config: 0,
      breaking: 0,
    };

    for (const change of changes) {
      summary[change.category]++;
    }

    return {
      fromVersion,
      toVersion,
      changes,
      summary,
      totalChanges: changes.length,
      isBreaking: summary.breaking > 0,
    };
  }

  /**
   * Get diff between current version and a previous version
   */
  diffFromCurrent(themeId: string, toVersion: string): VersionDiff | null {
    const current = this.getCurrentVersion(themeId);
    if (!current) return null;
    return this.diffVersions(themeId, current.version, toVersion);
  }

  /**
   * Detect changes between two states
   */
  private detectChanges(oldState: ThemeState, newState: ThemeState): ThemeChange[] {
    const changes: ThemeChange[] = [];

    // Compare colors
    for (const [key, newValue] of Object.entries(newState.colors || {})) {
      const oldValue = oldState.colors?.[key];
      if (oldValue !== newValue) {
        changes.push({
          id: generateId(),
          category: "colors",
          description: `Changed ${key}`,
          path: `colors.${key}`,
          oldValue,
          newValue,
          timestamp: new Date(),
        });
      }
    }

    // Compare typography
    for (const [key, newValue] of Object.entries(newState.typography || {})) {
      const oldValue = oldState.typography?.[key];
      if (oldValue !== newValue) {
        changes.push({
          id: generateId(),
          category: "typography",
          description: `Changed ${key}`,
          path: `typography.${key}`,
          oldValue,
          newValue,
          timestamp: new Date(),
        });
      }
    }

    // Compare spacing
    for (const [key, newValue] of Object.entries(newState.spacing || {})) {
      const oldValue = oldState.spacing?.[key];
      if (oldValue !== newValue) {
        changes.push({
          id: generateId(),
          category: "spacing",
          description: `Changed ${key}`,
          path: `spacing.${key}`,
          oldValue,
          newValue,
          timestamp: new Date(),
        });
      }
    }

    // Compare layout
    const oldLayout = JSON.stringify(oldState.layout);
    const newLayout = JSON.stringify(newState.layout);
    if (oldLayout !== newLayout) {
      changes.push({
        id: generateId(),
        category: "layout",
        description: "Layout configuration changed",
        path: "layout",
        oldValue: oldState.layout,
        newValue: newState.layout,
        timestamp: new Date(),
      });
    }

    return changes;
  }

  // ===========================================================================
  // Rollback
  // ===========================================================================

  /**
   * Rollback to a previous version
   */
  rollback(themeId: string, targetVersion: string): RollbackResult | null {
    const history = this.histories.get(themeId);
    if (!history) return null;

    const currentVersion = history.versions[0];
    const targetIdx = history.versions.findIndex((v) => v.version === targetVersion);

    if (targetIdx === -1 || targetIdx === 0) return null;

    const targetVersionData = history.versions[targetIdx];

    // Calculate reverted changes
    const revertedChanges: ThemeChange[] = [];
    for (let i = 0; i < targetIdx; i++) {
      revertedChanges.push(...history.versions[i].changes);
    }

    // Create a new version for the rollback
    const rollbackVersion: ThemeVersion = {
      version: bumpVersion(currentVersion.version, "patch"),
      semver: parseVersion(bumpVersion(currentVersion.version, "patch")),
      label: `Rollback to ${targetVersion}`,
      description: `Reverted to version ${targetVersion}`,
      changes: [{
        id: generateId(),
        category: "config",
        description: `Rolled back from ${currentVersion.version} to ${targetVersion}`,
        path: "*",
        oldValue: currentVersion.state,
        newValue: targetVersionData.state,
        timestamp: new Date(),
      }],
      state: deepClone(targetVersionData.state),
      createdAt: new Date(),
      isPublished: false,
      tags: ["rollback"],
    };

    history.versions.unshift(rollbackVersion);
    history.currentVersion = rollbackVersion.version;
    history.updatedAt = new Date();

    this.enforceMaxVersions(themeId);
    this.emit({
      type: "rollback",
      themeId,
      fromVersion: currentVersion.version,
      toVersion: targetVersion,
    });

    return {
      success: true,
      fromVersion: currentVersion.version,
      toVersion: targetVersion,
      state: deepClone(targetVersionData.state),
      revertedChanges,
    };
  }

  /**
   * Rollback to the previous version
   */
  rollbackOne(themeId: string): RollbackResult | null {
    const history = this.histories.get(themeId);
    if (!history || history.versions.length < 2) return null;
    return this.rollback(themeId, history.versions[1].version);
  }

  // ===========================================================================
  // Version Labels & Tags
  // ===========================================================================

  /**
   * Update a version's label
   */
  updateLabel(themeId: string, version: string, label: string): boolean {
    const v = this.getVersion(themeId, version);
    if (!v) return false;
    v.label = label;
    return true;
  }

  /**
   * Add a tag to a version
   */
  addTag(themeId: string, version: string, tag: string): boolean {
    const v = this.getVersion(themeId, version);
    if (!v) return false;
    if (!v.tags.includes(tag)) {
      v.tags.push(tag);
    }
    return true;
  }

  /**
   * Remove a tag from a version
   */
  removeTag(themeId: string, version: string, tag: string): boolean {
    const v = this.getVersion(themeId, version);
    if (!v) return false;
    v.tags = v.tags.filter((t) => t !== tag);
    return true;
  }

  /**
   * Mark a version as published
   */
  publishVersion(themeId: string, version: string): boolean {
    const v = this.getVersion(themeId, version);
    if (!v) return false;
    v.isPublished = true;
    this.emit({ type: "version_published", themeId, version: v });
    return true;
  }

  // ===========================================================================
  // Querying
  // ===========================================================================

  /**
   * Get versions by tag
   */
  getVersionsByTag(themeId: string, tag: string): ThemeVersion[] {
    const versions = this.getVersions(themeId);
    return versions.filter((v) => v.tags.includes(tag));
  }

  /**
   * Get published versions
   */
  getPublishedVersions(themeId: string): ThemeVersion[] {
    const versions = this.getVersions(themeId);
    return versions.filter((v) => v.isPublished);
  }

  /**
   * Search versions by label or description
   */
  searchVersions(themeId: string, query: string): ThemeVersion[] {
    const versions = this.getVersions(themeId);
    const q = query.toLowerCase();
    return versions.filter(
      (v) =>
        v.label.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q)
    );
  }

  /**
   * Get change statistics
   */
  getChangeStats(themeId: string): Record<ChangeCategory, number> {
    const versions = this.getVersions(themeId);
    const stats: Record<ChangeCategory, number> = {
      colors: 0,
      typography: 0,
      spacing: 0,
      layout: 0,
      components: 0,
      assets: 0,
      config: 0,
      breaking: 0,
    };

    for (const version of versions) {
      for (const change of version.changes) {
        stats[change.category]++;
      }
    }

    return stats;
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  /**
   * Export all history for persistence
   */
  export(): Record<string, ThemeVersionHistory> {
    const result: Record<string, ThemeVersionHistory> = {};
    for (const [id, history] of this.histories) {
      result[id] = {
        ...history,
        versions: history.versions.map((v) => ({
          ...v,
          changes: v.changes.map((c) => ({ ...c })),
          state: deepClone(v.state),
        })),
      };
    }
    return result;
  }

  /**
   * Import history from persistence
   */
  import(data: Record<string, ThemeVersionHistory>): void {
    for (const [id, history] of Object.entries(data)) {
      this.histories.set(id, {
        ...history,
        createdAt: new Date(history.createdAt),
        updatedAt: new Date(history.updatedAt),
        versions: history.versions.map((v) => ({
          ...v,
          createdAt: new Date(v.createdAt),
          changes: v.changes.map((c) => ({
            ...c,
            timestamp: new Date(c.timestamp),
          })),
        })),
      });
    }
  }

  /**
   * Clear all history for a theme
   */
  clearHistory(themeId: string): boolean {
    return this.histories.delete(themeId);
  }

  /**
   * Clear all histories
   */
  clearAll(): void {
    this.histories.clear();
    this.pendingChanges.clear();
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Subscribe to version events
   */
  subscribe(listener: (event: VersionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: VersionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error("Version event listener error:", e);
      }
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private enforceMaxVersions(themeId: string): void {
    if (this.options.maxVersions <= 0) return;

    const history = this.histories.get(themeId);
    if (!history) return;

    while (history.versions.length > this.options.maxVersions) {
      history.versions.pop();
    }
  }
}

// =============================================================================
// Event Types
// =============================================================================

export type VersionEvent =
  | { type: "version_created"; themeId: string; version: ThemeVersion }
  | { type: "version_committed"; themeId: string; version: ThemeVersion }
  | { type: "version_published"; themeId: string; version: ThemeVersion }
  | { type: "change_recorded"; themeId: string; change: ThemeChange }
  | { type: "rollback"; themeId: string; fromVersion: string; toVersion: string };

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse a version string to semantic version
 */
export function parseVersion(version: string): SemanticVersion {
  const parts = version.split(".").map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * Format semantic version to string
 */
export function formatVersion(semver: SemanticVersion): string {
  return `${semver.major}.${semver.minor}.${semver.patch}`;
}

/**
 * Bump a version
 */
export function bumpVersion(version: string, type: VersionBump): string {
  const semver = parseVersion(version);

  switch (type) {
    case "major":
      return `${semver.major + 1}.0.0`;
    case "minor":
      return `${semver.major}.${semver.minor + 1}.0`;
    case "patch":
      return `${semver.major}.${semver.minor}.${semver.patch + 1}`;
  }
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const semverA = parseVersion(a);
  const semverB = parseVersion(b);

  if (semverA.major !== semverB.major) {
    return semverA.major < semverB.major ? -1 : 1;
  }
  if (semverA.minor !== semverB.minor) {
    return semverA.minor < semverB.minor ? -1 : 1;
  }
  if (semverA.patch !== semverB.patch) {
    return semverA.patch < semverB.patch ? -1 : 1;
  }
  return 0;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Deep clone an object
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// =============================================================================
// Factory Functions
// =============================================================================

/** Singleton instance */
let managerInstance: ThemeVersionManager | null = null;

/**
 * Get the shared ThemeVersionManager instance
 */
export function getThemeVersionManager(): ThemeVersionManager {
  if (!managerInstance) {
    managerInstance = new ThemeVersionManager();
  }
  return managerInstance;
}

/**
 * Reset the manager instance (for testing)
 */
export function resetThemeVersionManager(): void {
  managerInstance = null;
}

/**
 * Create a new ThemeVersionManager instance
 */
export function createThemeVersionManager(
  options?: ThemeVersionManagerOptions
): ThemeVersionManager {
  return new ThemeVersionManager(options);
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format a version history for display
 */
export function formatVersionHistory(history: ThemeVersionHistory): string {
  const lines: string[] = [
    `Theme: ${history.themeId}`,
    `Current Version: ${history.currentVersion}`,
    `Total Versions: ${history.versions.length}`,
    "",
    "Version History:",
    "─".repeat(60),
  ];

  for (const version of history.versions.slice(0, 10)) {
    const tags = version.tags.length > 0 ? ` [${version.tags.join(", ")}]` : "";
    const published = version.isPublished ? " ✓" : "";
    lines.push(`  ${version.version}${published}${tags}`);
    lines.push(`    ${version.label}`);
    lines.push(`    ${version.createdAt.toLocaleDateString()} - ${version.changes.length} changes`);
  }

  if (history.versions.length > 10) {
    lines.push(`  ... and ${history.versions.length - 10} more versions`);
  }

  return lines.join("\n");
}

/**
 * Format a diff for display
 */
export function formatVersionDiff(diff: VersionDiff): string {
  const lines: string[] = [
    `Diff: ${diff.fromVersion} → ${diff.toVersion}`,
    `Total Changes: ${diff.totalChanges}`,
    diff.isBreaking ? "⚠️  BREAKING CHANGES" : "",
    "",
    "Changes by Category:",
    "─".repeat(40),
  ];

  for (const [category, count] of Object.entries(diff.summary)) {
    if (count > 0) {
      lines.push(`  ${category}: ${count}`);
    }
  }

  if (diff.changes.length > 0) {
    lines.push("");
    lines.push("Details:");
    lines.push("─".repeat(40));
    for (const change of diff.changes.slice(0, 20)) {
      lines.push(`  [${change.category}] ${change.path}`);
      lines.push(`    ${change.description}`);
    }
    if (diff.changes.length > 20) {
      lines.push(`  ... and ${diff.changes.length - 20} more changes`);
    }
  }

  return lines.join("\n");
}

/**
 * Plan History
 *
 * Manages history of previous exploration sessions in plan mode.
 * Shows past plans with query and timestamp; supports click to restore.
 */

// ============================================================================
// Types
// ============================================================================

export interface PlanHistoryEntry {
  readonly id: string;
  readonly query: string;
  readonly timestamp: number;
  readonly creationOrder: number; // Monotonic sequence for stable sorting
  readonly title: string;
  readonly description: string;
  readonly status: PlanStatus;
  readonly explorationSteps: readonly ExplorationStep[];
  readonly conclusions: readonly string[];
  readonly relatedFiles: readonly string[];
  readonly tags: readonly string[];
}

export type PlanStatus =
  | 'exploring'
  | 'completed'
  | 'abandoned'
  | 'paused';

export interface ExplorationStep {
  readonly id: string;
  readonly type: ExplorationStepType;
  readonly description: string;
  readonly timestamp: number;
  readonly result: string | null;
  readonly duration: number;
}

export type ExplorationStepType =
  | 'file-read'
  | 'search'
  | 'analysis'
  | 'hypothesis'
  | 'validation'
  | 'conclusion';

export interface PlanHistorySidebar {
  readonly entries: readonly PlanHistoryEntry[];
  readonly selectedId: string | null;
  readonly filterStatus: PlanStatus | 'all';
  readonly sortOrder: SortOrder;
  readonly searchQuery: string;
}

export type SortOrder = 'newest' | 'oldest' | 'alphabetical';

export interface RestoreResult {
  readonly success: boolean;
  readonly entry: PlanHistoryEntry | null;
  readonly restoredContext: RestoredContext | null;
  readonly error: string | null;
}

export interface RestoredContext {
  readonly query: string;
  readonly explorationSteps: readonly ExplorationStep[];
  readonly relatedFiles: readonly string[];
  readonly conclusions: readonly string[];
}

export interface PlanHistoryStats {
  readonly totalPlans: number;
  readonly completedPlans: number;
  readonly abandonedPlans: number;
  readonly averageStepsPerPlan: number;
  readonly mostUsedTags: readonly { tag: string; count: number }[];
  readonly recentActivity: readonly { date: string; count: number }[];
}

// ============================================================================
// State
// ============================================================================

interface PlanHistoryState {
  readonly entries: Map<string, PlanHistoryEntry>;
  readonly sidebar: PlanHistorySidebar;
  readonly currentPlanId: string | null;
  readonly maxEntries: number;
  readonly nextCreationOrder: number; // Monotonic counter for stable sorting
}

let state: PlanHistoryState = {
  entries: new Map(),
  sidebar: {
    entries: [],
    selectedId: null,
    filterStatus: 'all',
    sortOrder: 'newest',
    searchQuery: '',
  },
  currentPlanId: null,
  maxEntries: 100,
  nextCreationOrder: 1,
};

// ============================================================================
// Plan Management
// ============================================================================

export function createPlan(query: string, title?: string): PlanHistoryEntry {
  const id = generateId();
  const timestamp = Date.now();
  const creationOrder = state.nextCreationOrder;

  const entry: PlanHistoryEntry = {
    id,
    query,
    timestamp,
    creationOrder,
    title: title ?? generateTitle(query),
    description: '',
    status: 'exploring',
    explorationSteps: [],
    conclusions: [],
    relatedFiles: [],
    tags: extractTags(query),
  };

  const newEntries = new Map(state.entries);
  newEntries.set(id, entry);

  // Enforce max entries limit
  if (newEntries.size > state.maxEntries) {
    const oldestId = findOldestEntryId(newEntries);
    if (oldestId) {
      newEntries.delete(oldestId);
    }
  }

  state = {
    ...state,
    entries: newEntries,
    currentPlanId: id,
    nextCreationOrder: creationOrder + 1,
    sidebar: {
      ...state.sidebar,
      entries: getFilteredEntries(newEntries, state.sidebar),
    },
  };

  return entry;
}

export function getPlan(id: string): PlanHistoryEntry | null {
  return state.entries.get(id) ?? null;
}

export function getCurrentPlan(): PlanHistoryEntry | null {
  if (!state.currentPlanId) {
    return null;
  }
  return state.entries.get(state.currentPlanId) ?? null;
}

export function updatePlan(
  id: string,
  updates: Partial<Pick<PlanHistoryEntry, 'title' | 'description' | 'status' | 'conclusions' | 'tags'>>
): PlanHistoryEntry | null {
  const entry = state.entries.get(id);
  if (!entry) {
    return null;
  }

  const updated: PlanHistoryEntry = {
    ...entry,
    ...updates,
    // Preserve readonly arrays properly
    conclusions: updates.conclusions ?? entry.conclusions,
    tags: updates.tags ?? entry.tags,
  };

  const newEntries = new Map(state.entries);
  newEntries.set(id, updated);

  state = {
    ...state,
    entries: newEntries,
    sidebar: {
      ...state.sidebar,
      entries: getFilteredEntries(newEntries, state.sidebar),
    },
  };

  return updated;
}

export function deletePlan(id: string): boolean {
  if (!state.entries.has(id)) {
    return false;
  }

  const newEntries = new Map(state.entries);
  newEntries.delete(id);

  state = {
    ...state,
    entries: newEntries,
    currentPlanId: state.currentPlanId === id ? null : state.currentPlanId,
    sidebar: {
      ...state.sidebar,
      entries: getFilteredEntries(newEntries, state.sidebar),
      selectedId: state.sidebar.selectedId === id ? null : state.sidebar.selectedId,
    },
  };

  return true;
}

// ============================================================================
// Exploration Steps
// ============================================================================

export function addExplorationStep(
  planId: string,
  type: ExplorationStepType,
  description: string,
  result: string | null = null
): ExplorationStep | null {
  const entry = state.entries.get(planId);
  if (!entry) {
    return null;
  }

  const step: ExplorationStep = {
    id: generateId(),
    type,
    description,
    timestamp: Date.now(),
    result,
    duration: 0,
  };

  const updated: PlanHistoryEntry = {
    ...entry,
    explorationSteps: [...entry.explorationSteps, step],
  };

  const newEntries = new Map(state.entries);
  newEntries.set(planId, updated);

  state = {
    ...state,
    entries: newEntries,
  };

  return step;
}

export function completeExplorationStep(
  planId: string,
  stepId: string,
  result: string,
  duration: number
): boolean {
  const entry = state.entries.get(planId);
  if (!entry) {
    return false;
  }

  const stepIndex = entry.explorationSteps.findIndex(s => s.id === stepId);
  if (stepIndex === -1) {
    return false;
  }

  const updatedSteps = [...entry.explorationSteps];
  updatedSteps[stepIndex] = {
    ...updatedSteps[stepIndex],
    result,
    duration,
  };

  const updated: PlanHistoryEntry = {
    ...entry,
    explorationSteps: updatedSteps,
  };

  const newEntries = new Map(state.entries);
  newEntries.set(planId, updated);

  state = {
    ...state,
    entries: newEntries,
  };

  return true;
}

export function addRelatedFile(planId: string, filePath: string): boolean {
  const entry = state.entries.get(planId);
  if (!entry) {
    return false;
  }

  if (entry.relatedFiles.includes(filePath)) {
    return true;
  }

  const updated: PlanHistoryEntry = {
    ...entry,
    relatedFiles: [...entry.relatedFiles, filePath],
  };

  const newEntries = new Map(state.entries);
  newEntries.set(planId, updated);

  state = {
    ...state,
    entries: newEntries,
  };

  return true;
}

// ============================================================================
// Sidebar Management
// ============================================================================

export function getSidebar(): PlanHistorySidebar {
  return state.sidebar;
}

export function selectPlan(id: string | null): boolean {
  if (id !== null && !state.entries.has(id)) {
    return false;
  }

  state = {
    ...state,
    sidebar: {
      ...state.sidebar,
      selectedId: id,
    },
  };

  return true;
}

export function setFilterStatus(status: PlanStatus | 'all'): void {
  state = {
    ...state,
    sidebar: {
      ...state.sidebar,
      filterStatus: status,
      entries: getFilteredEntries(state.entries, {
        ...state.sidebar,
        filterStatus: status,
      }),
    },
  };
}

export function setSortOrder(order: SortOrder): void {
  state = {
    ...state,
    sidebar: {
      ...state.sidebar,
      sortOrder: order,
      entries: getFilteredEntries(state.entries, {
        ...state.sidebar,
        sortOrder: order,
      }),
    },
  };
}

export function setSearchQuery(query: string): void {
  state = {
    ...state,
    sidebar: {
      ...state.sidebar,
      searchQuery: query,
      entries: getFilteredEntries(state.entries, {
        ...state.sidebar,
        searchQuery: query,
      }),
    },
  };
}

// ============================================================================
// Restore Functionality
// ============================================================================

export function restorePlan(id: string): RestoreResult {
  const entry = state.entries.get(id);
  if (!entry) {
    return {
      success: false,
      entry: null,
      restoredContext: null,
      error: `Plan with id "${id}" not found`,
    };
  }

  // Update current plan
  state = {
    ...state,
    currentPlanId: id,
    sidebar: {
      ...state.sidebar,
      selectedId: id,
    },
  };

  // If plan was paused, resume it
  if (entry.status === 'paused') {
    updatePlan(id, { status: 'exploring' });
  }

  const restoredContext: RestoredContext = {
    query: entry.query,
    explorationSteps: entry.explorationSteps,
    relatedFiles: entry.relatedFiles,
    conclusions: entry.conclusions,
  };

  return {
    success: true,
    entry,
    restoredContext,
    error: null,
  };
}

export function duplicatePlan(id: string): PlanHistoryEntry | null {
  const entry = state.entries.get(id);
  if (!entry) {
    return null;
  }

  const newEntry = createPlan(entry.query, `${entry.title} (copy)`);

  // Copy over relevant data
  updatePlan(newEntry.id, {
    description: entry.description,
    tags: [...entry.tags],
  });

  return getPlan(newEntry.id);
}

// ============================================================================
// Statistics
// ============================================================================

export function getStats(): PlanHistoryStats {
  const entries = Array.from(state.entries.values());

  const completedPlans = entries.filter(e => e.status === 'completed').length;
  const abandonedPlans = entries.filter(e => e.status === 'abandoned').length;

  const totalSteps = entries.reduce((sum, e) => sum + e.explorationSteps.length, 0);
  const averageStepsPerPlan = entries.length > 0
    ? Math.round(totalSteps / entries.length * 10) / 10
    : 0;

  // Count tag usage
  const tagCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const mostUsedTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Recent activity (last 7 days)
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recentActivity: { date: string; count: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i * dayMs);
    const dayEnd = dayStart + dayMs;
    const date = new Date(dayStart).toISOString().split('T')[0];
    const count = entries.filter(e => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
    recentActivity.push({ date, count });
  }

  return {
    totalPlans: entries.length,
    completedPlans,
    abandonedPlans,
    averageStepsPerPlan,
    mostUsedTags,
    recentActivity,
  };
}

// ============================================================================
// Import/Export
// ============================================================================

export interface ExportedHistory {
  readonly version: number;
  readonly exportedAt: number;
  readonly entries: readonly PlanHistoryEntry[];
}

export function exportHistory(): ExportedHistory {
  return {
    version: 1,
    exportedAt: Date.now(),
    entries: Array.from(state.entries.values()),
  };
}

export function importHistory(data: ExportedHistory, merge: boolean = true): number {
  let imported = 0;

  const newEntries = merge ? new Map(state.entries) : new Map<string, PlanHistoryEntry>();

  for (const entry of data.entries) {
    if (!merge || !newEntries.has(entry.id)) {
      newEntries.set(entry.id, entry);
      imported++;
    }
  }

  state = {
    ...state,
    entries: newEntries,
    sidebar: {
      ...state.sidebar,
      entries: getFilteredEntries(newEntries, state.sidebar),
    },
  };

  return imported;
}

// ============================================================================
// Configuration
// ============================================================================

export function setMaxEntries(max: number): void {
  state = {
    ...state,
    maxEntries: Math.max(1, max),
  };
}

export function getMaxEntries(): number {
  return state.maxEntries;
}

// ============================================================================
// Reset
// ============================================================================

export function resetPlanHistory(): void {
  state = {
    entries: new Map(),
    sidebar: {
      entries: [],
      selectedId: null,
      filterStatus: 'all',
      sortOrder: 'newest',
      searchQuery: '',
    },
    currentPlanId: null,
    maxEntries: 100,
    nextCreationOrder: 1,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateTitle(query: string): string {
  // Extract first meaningful part of query
  const cleaned = query.trim();
  if (cleaned.length <= 50) {
    return cleaned;
  }
  return cleaned.substring(0, 47) + '...';
}

function extractTags(query: string): readonly string[] {
  const tags: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Common exploration keywords
  const keywords = [
    'component', 'api', 'database', 'style', 'layout',
    'bug', 'feature', 'refactor', 'performance', 'security',
    'test', 'documentation', 'integration', 'migration',
  ];

  for (const keyword of keywords) {
    if (lowerQuery.includes(keyword)) {
      tags.push(keyword);
    }
  }

  return tags;
}

function findOldestEntryId(entries: Map<string, PlanHistoryEntry>): string | null {
  let oldestId: string | null = null;
  let oldestTimestamp = Infinity;

  for (const [id, entry] of entries) {
    // Don't delete currently active or paused plans
    if (entry.status === 'exploring' || entry.status === 'paused') {
      continue;
    }
    if (entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
      oldestId = id;
    }
  }

  return oldestId;
}

function getFilteredEntries(
  entries: Map<string, PlanHistoryEntry>,
  sidebar: PlanHistorySidebar
): readonly PlanHistoryEntry[] {
  let result = Array.from(entries.values());

  // Filter by status
  if (sidebar.filterStatus !== 'all') {
    result = result.filter(e => e.status === sidebar.filterStatus);
  }

  // Filter by search query
  if (sidebar.searchQuery.trim()) {
    const query = sidebar.searchQuery.toLowerCase();
    result = result.filter(e =>
      e.query.toLowerCase().includes(query) ||
      e.title.toLowerCase().includes(query) ||
      e.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  // Sort with stable secondary key (creationOrder) for deterministic ordering
  switch (sidebar.sortOrder) {
    case 'newest':
      result.sort((a, b) => {
        const timeDiff = b.timestamp - a.timestamp;
        return timeDiff !== 0 ? timeDiff : b.creationOrder - a.creationOrder;
      });
      break;
    case 'oldest':
      result.sort((a, b) => {
        const timeDiff = a.timestamp - b.timestamp;
        return timeDiff !== 0 ? timeDiff : a.creationOrder - b.creationOrder;
      });
      break;
    case 'alphabetical':
      result.sort((a, b) => {
        const titleDiff = a.title.localeCompare(b.title);
        return titleDiff !== 0 ? titleDiff : a.creationOrder - b.creationOrder;
      });
      break;
  }

  return result;
}

// ============================================================================
// Formatted Display
// ============================================================================

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export interface FormattedPlanEntry {
  readonly id: string;
  readonly title: string;
  readonly query: string;
  readonly formattedTimestamp: string;
  readonly status: PlanStatus;
  readonly stepCount: number;
  readonly fileCount: number;
  readonly tags: readonly string[];
}

export function getFormattedSidebarEntries(): readonly FormattedPlanEntry[] {
  // Compute fresh filtered entries from source of truth (state.entries)
  // to ensure we have the latest data (steps, files, etc.)
  const freshEntries = getFilteredEntries(state.entries, state.sidebar);

  return freshEntries.map(entry => ({
    id: entry.id,
    title: entry.title,
    query: entry.query,
    formattedTimestamp: formatTimestamp(entry.timestamp),
    status: entry.status,
    stepCount: entry.explorationSteps.length,
    fileCount: entry.relatedFiles.length,
    tags: entry.tags,
  }));
}

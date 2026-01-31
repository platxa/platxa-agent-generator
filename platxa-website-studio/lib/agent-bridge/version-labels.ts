/**
 * Version Labeling and Notes
 *
 * Provides version labeling and notes for user organization.
 * Supports click to add/edit label with optional notes field.
 */

// ============================================================================
// Types
// ============================================================================

export interface Version {
  readonly id: string;
  readonly number: string;
  readonly label: string;
  readonly notes: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly creationOrder: number; // Monotonic sequence for stable sorting when timestamps collide
  readonly tags: readonly string[];
  readonly isStarred: boolean;
  readonly color: LabelColor | null;
}

export type LabelColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'gray';

export interface VersionLabelState {
  readonly versions: Map<string, Version>;
  readonly selectedVersionId: string | null;
  readonly editingVersionId: string | null;
  readonly filterTags: readonly string[];
  readonly searchQuery: string;
  readonly sortOrder: SortOrder;
}

export type SortOrder = 'newest' | 'oldest' | 'alphabetical' | 'starred';

export interface LabelChangeEvent {
  readonly versionId: string;
  readonly previousLabel: string;
  readonly newLabel: string;
  readonly field: 'label' | 'notes' | 'tags' | 'color' | 'starred';
}

export type LabelChangeHandler = (event: LabelChangeEvent) => void;

export interface VersionSummary {
  readonly id: string;
  readonly number: string;
  readonly label: string;
  readonly hasNotes: boolean;
  readonly tagCount: number;
  readonly isStarred: boolean;
  readonly color: LabelColor | null;
  readonly formattedDate: string;
}

// ============================================================================
// Constants
// ============================================================================

const LABEL_COLORS: Record<LabelColor, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  gray: '#6b7280',
};

const DEFAULT_TAGS = [
  'release',
  'beta',
  'alpha',
  'stable',
  'draft',
  'review',
  'approved',
  'archived',
];

// ============================================================================
// State
// ============================================================================

let state: VersionLabelState = {
  versions: new Map(),
  selectedVersionId: null,
  editingVersionId: null,
  filterTags: [],
  searchQuery: '',
  sortOrder: 'newest',
};

let changeHandlers: LabelChangeHandler[] = [];

// Monotonic counter for stable sorting when timestamps collide
let creationOrderCounter = 0;

// ============================================================================
// Version Management
// ============================================================================

export function createVersion(number: string, label?: string): Version {
  const id = generateId();
  const now = Date.now();

  const version: Version = {
    id,
    number,
    label: label ?? `Version ${number}`,
    notes: '',
    createdAt: now,
    updatedAt: now,
    creationOrder: creationOrderCounter++,
    tags: [],
    isStarred: false,
    color: null,
  };

  const newVersions = new Map(state.versions);
  newVersions.set(id, version);

  state = {
    ...state,
    versions: newVersions,
  };

  return version;
}

export function getVersion(id: string): Version | null {
  return state.versions.get(id) ?? null;
}

export function getAllVersions(): readonly Version[] {
  return Array.from(state.versions.values());
}

export function deleteVersion(id: string): boolean {
  if (!state.versions.has(id)) {
    return false;
  }

  const newVersions = new Map(state.versions);
  newVersions.delete(id);

  state = {
    ...state,
    versions: newVersions,
    selectedVersionId: state.selectedVersionId === id ? null : state.selectedVersionId,
    editingVersionId: state.editingVersionId === id ? null : state.editingVersionId,
  };

  return true;
}

// ============================================================================
// Label Management
// ============================================================================

export function setLabel(id: string, label: string): Version | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  const previousLabel = version.label;
  const updated: Version = {
    ...version,
    label,
    updatedAt: Date.now(),
  };

  const newVersions = new Map(state.versions);
  newVersions.set(id, updated);

  state = {
    ...state,
    versions: newVersions,
  };

  notifyChange({
    versionId: id,
    previousLabel,
    newLabel: label,
    field: 'label',
  });

  return updated;
}

export function getLabel(id: string): string | null {
  const version = state.versions.get(id);
  return version?.label ?? null;
}

export function clearLabel(id: string): Version | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  return setLabel(id, `Version ${version.number}`);
}

// ============================================================================
// Notes Management
// ============================================================================

export function setNotes(id: string, notes: string): Version | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  const updated: Version = {
    ...version,
    notes,
    updatedAt: Date.now(),
  };

  const newVersions = new Map(state.versions);
  newVersions.set(id, updated);

  state = {
    ...state,
    versions: newVersions,
  };

  notifyChange({
    versionId: id,
    previousLabel: version.notes,
    newLabel: notes,
    field: 'notes',
  });

  return updated;
}

export function getNotes(id: string): string | null {
  const version = state.versions.get(id);
  return version?.notes ?? null;
}

export function appendNotes(id: string, text: string): Version | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  const newNotes = version.notes ? `${version.notes}\n${text}` : text;
  return setNotes(id, newNotes);
}

export function clearNotes(id: string): Version | null {
  return setNotes(id, '');
}

// ============================================================================
// Tags Management
// ============================================================================

export function addTag(id: string, tag: string): Version | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  const normalizedTag = tag.toLowerCase().trim();
  if (version.tags.includes(normalizedTag)) {
    return version;
  }

  const updated: Version = {
    ...version,
    tags: [...version.tags, normalizedTag],
    updatedAt: Date.now(),
  };

  const newVersions = new Map(state.versions);
  newVersions.set(id, updated);

  state = {
    ...state,
    versions: newVersions,
  };

  notifyChange({
    versionId: id,
    previousLabel: version.tags.join(','),
    newLabel: updated.tags.join(','),
    field: 'tags',
  });

  return updated;
}

export function removeTag(id: string, tag: string): Version | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  const normalizedTag = tag.toLowerCase().trim();
  if (!version.tags.includes(normalizedTag)) {
    return version;
  }

  const updated: Version = {
    ...version,
    tags: version.tags.filter(t => t !== normalizedTag),
    updatedAt: Date.now(),
  };

  const newVersions = new Map(state.versions);
  newVersions.set(id, updated);

  state = {
    ...state,
    versions: newVersions,
  };

  return updated;
}

export function getTags(id: string): readonly string[] {
  const version = state.versions.get(id);
  return version?.tags ?? [];
}

export function getAvailableTags(): readonly string[] {
  const usedTags = new Set<string>();
  for (const version of state.versions.values()) {
    for (const tag of version.tags) {
      usedTags.add(tag);
    }
  }

  // Combine default tags with used tags
  const allTags = new Set([...DEFAULT_TAGS, ...usedTags]);
  return Array.from(allTags).sort();
}

// ============================================================================
// Color Management
// ============================================================================

export function setColor(id: string, color: LabelColor | null): Version | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  const updated: Version = {
    ...version,
    color,
    updatedAt: Date.now(),
  };

  const newVersions = new Map(state.versions);
  newVersions.set(id, updated);

  state = {
    ...state,
    versions: newVersions,
  };

  notifyChange({
    versionId: id,
    previousLabel: version.color ?? '',
    newLabel: color ?? '',
    field: 'color',
  });

  return updated;
}

export function getColor(id: string): LabelColor | null {
  const version = state.versions.get(id);
  return version?.color ?? null;
}

export function getColorHex(color: LabelColor): string {
  return LABEL_COLORS[color];
}

export function getAvailableColors(): readonly LabelColor[] {
  return Object.keys(LABEL_COLORS) as LabelColor[];
}

// ============================================================================
// Starred Management
// ============================================================================

export function toggleStarred(id: string): Version | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  const updated: Version = {
    ...version,
    isStarred: !version.isStarred,
    updatedAt: Date.now(),
  };

  const newVersions = new Map(state.versions);
  newVersions.set(id, updated);

  state = {
    ...state,
    versions: newVersions,
  };

  notifyChange({
    versionId: id,
    previousLabel: String(version.isStarred),
    newLabel: String(updated.isStarred),
    field: 'starred',
  });

  return updated;
}

export function isStarred(id: string): boolean {
  const version = state.versions.get(id);
  return version?.isStarred ?? false;
}

export function getStarredVersions(): readonly Version[] {
  return Array.from(state.versions.values()).filter(v => v.isStarred);
}

// ============================================================================
// Selection and Editing
// ============================================================================

export function selectVersion(id: string | null): boolean {
  if (id !== null && !state.versions.has(id)) {
    return false;
  }

  state = {
    ...state,
    selectedVersionId: id,
  };

  return true;
}

export function getSelectedVersion(): Version | null {
  if (!state.selectedVersionId) {
    return null;
  }
  return state.versions.get(state.selectedVersionId) ?? null;
}

export function startEditing(id: string): boolean {
  if (!state.versions.has(id)) {
    return false;
  }

  state = {
    ...state,
    editingVersionId: id,
  };

  return true;
}

export function stopEditing(): void {
  state = {
    ...state,
    editingVersionId: null,
  };
}

export function isEditing(id: string): boolean {
  return state.editingVersionId === id;
}

export function getEditingVersion(): Version | null {
  if (!state.editingVersionId) {
    return null;
  }
  return state.versions.get(state.editingVersionId) ?? null;
}

// ============================================================================
// Filtering and Sorting
// ============================================================================

export function setFilterTags(tags: readonly string[]): void {
  state = {
    ...state,
    filterTags: tags,
  };
}

export function setSearchQuery(query: string): void {
  state = {
    ...state,
    searchQuery: query,
  };
}

export function setSortOrder(order: SortOrder): void {
  state = {
    ...state,
    sortOrder: order,
  };
}

export function getFilteredVersions(): readonly Version[] {
  let versions = Array.from(state.versions.values());

  // Filter by tags
  if (state.filterTags.length > 0) {
    versions = versions.filter(v =>
      state.filterTags.every(tag => v.tags.includes(tag))
    );
  }

  // Filter by search query
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase();
    versions = versions.filter(v =>
      v.label.toLowerCase().includes(query) ||
      v.notes.toLowerCase().includes(query) ||
      v.number.toLowerCase().includes(query) ||
      v.tags.some(t => t.includes(query))
    );
  }

  // Sort - use creationOrder as secondary key for stable sorting when timestamps collide
  switch (state.sortOrder) {
    case 'newest':
      versions.sort((a, b) => {
        const timeDiff = b.createdAt - a.createdAt;
        return timeDiff !== 0 ? timeDiff : b.creationOrder - a.creationOrder;
      });
      break;
    case 'oldest':
      versions.sort((a, b) => {
        const timeDiff = a.createdAt - b.createdAt;
        return timeDiff !== 0 ? timeDiff : a.creationOrder - b.creationOrder;
      });
      break;
    case 'alphabetical':
      versions.sort((a, b) => {
        const labelDiff = a.label.localeCompare(b.label);
        return labelDiff !== 0 ? labelDiff : a.creationOrder - b.creationOrder;
      });
      break;
    case 'starred':
      versions.sort((a, b) => {
        if (a.isStarred === b.isStarred) {
          const timeDiff = b.createdAt - a.createdAt;
          return timeDiff !== 0 ? timeDiff : b.creationOrder - a.creationOrder;
        }
        return a.isStarred ? -1 : 1;
      });
      break;
  }

  return versions;
}

// ============================================================================
// Version Summary
// ============================================================================

export function getVersionSummary(id: string): VersionSummary | null {
  const version = state.versions.get(id);
  if (!version) {
    return null;
  }

  return {
    id: version.id,
    number: version.number,
    label: version.label,
    hasNotes: version.notes.length > 0,
    tagCount: version.tags.length,
    isStarred: version.isStarred,
    color: version.color,
    formattedDate: formatDate(version.createdAt),
  };
}

export function getVersionSummaries(): readonly VersionSummary[] {
  return getFilteredVersions().map(v => ({
    id: v.id,
    number: v.number,
    label: v.label,
    hasNotes: v.notes.length > 0,
    tagCount: v.tags.length,
    isStarred: v.isStarred,
    color: v.color,
    formattedDate: formatDate(v.createdAt),
  }));
}

// ============================================================================
// Change Handlers
// ============================================================================

export function onChange(handler: LabelChangeHandler): () => void {
  changeHandlers.push(handler);

  return () => {
    changeHandlers = changeHandlers.filter(h => h !== handler);
  };
}

function notifyChange(event: LabelChangeEvent): void {
  for (const handler of changeHandlers) {
    handler(event);
  }
}

// ============================================================================
// Import/Export
// ============================================================================

export interface ExportedVersions {
  readonly version: number;
  readonly exportedAt: number;
  readonly versions: readonly Version[];
}

export function exportVersions(): ExportedVersions {
  return {
    version: 1,
    exportedAt: Date.now(),
    versions: Array.from(state.versions.values()),
  };
}

export function importVersions(data: ExportedVersions, merge: boolean = true): number {
  let imported = 0;

  const newVersions = merge ? new Map(state.versions) : new Map<string, Version>();

  for (const version of data.versions) {
    if (!merge || !newVersions.has(version.id)) {
      newVersions.set(version.id, version);
      imported++;
    }
  }

  state = {
    ...state,
    versions: newVersions,
  };

  return imported;
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// Reset
// ============================================================================

export function resetVersionLabels(): void {
  state = {
    versions: new Map(),
    selectedVersionId: null,
    editingVersionId: null,
    filterTags: [],
    searchQuery: '',
    sortOrder: 'newest',
  };
  changeHandlers = [];
  creationOrderCounter = 0;
}

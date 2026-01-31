/**
 * Error Filtering and Search
 *
 * Provides filtering by severity, category, file and search by message
 * to help users quickly find relevant errors in the debugging interface.
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorSeverity = 'error' | 'warning' | 'info' | 'hint';

export type ErrorCategory =
  | 'syntax'
  | 'type'
  | 'runtime'
  | 'validation'
  | 'network'
  | 'security'
  | 'performance'
  | 'deprecation'
  | 'other';

export interface FilterableError {
  readonly id: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly category: ErrorCategory;
  readonly file: string | null;
  readonly line: number | null;
  readonly column: number | null;
  readonly timestamp: number;
  readonly code: string | null;
  readonly source: string | null;
}

export interface ErrorFilter {
  readonly severities: readonly ErrorSeverity[];
  readonly categories: readonly ErrorCategory[];
  readonly files: readonly string[];
  readonly searchQuery: string;
  readonly fromTimestamp: number | null;
  readonly toTimestamp: number | null;
  readonly codes: readonly string[];
  readonly sources: readonly string[];
}

export interface FilterState {
  readonly filter: ErrorFilter;
  readonly errors: Map<string, FilterableError>;
  readonly filteredIds: readonly string[];
  readonly searchIndex: Map<string, Set<string>>;
}

export interface FilterResult {
  readonly errors: readonly FilterableError[];
  readonly totalCount: number;
  readonly filteredCount: number;
  readonly appliedFilters: readonly string[];
}

export interface FilterSummary {
  readonly severityCounts: Record<ErrorSeverity, number>;
  readonly categoryCounts: Record<ErrorCategory, number>;
  readonly fileCounts: Record<string, number>;
  readonly codeCounts: Record<string, number>;
}

// ============================================================================
// Constants
// ============================================================================

const ALL_SEVERITIES: readonly ErrorSeverity[] = ['error', 'warning', 'info', 'hint'];
const ALL_CATEGORIES: readonly ErrorCategory[] = [
  'syntax', 'type', 'runtime', 'validation',
  'network', 'security', 'performance', 'deprecation', 'other'
];

const DEFAULT_FILTER: ErrorFilter = {
  severities: [],
  categories: [],
  files: [],
  searchQuery: '',
  fromTimestamp: null,
  toTimestamp: null,
  codes: [],
  sources: [],
};

// ============================================================================
// State
// ============================================================================

let state: FilterState = {
  filter: DEFAULT_FILTER,
  errors: new Map(),
  filteredIds: [],
  searchIndex: new Map(),
};

// ============================================================================
// Error Management
// ============================================================================

export function addError(error: FilterableError): void {
  const newErrors = new Map(state.errors);
  newErrors.set(error.id, error);

  state = {
    ...state,
    errors: newErrors,
  };

  indexError(error);
  applyFilter();
}

export function addErrors(errors: readonly FilterableError[]): void {
  const newErrors = new Map(state.errors);
  for (const error of errors) {
    newErrors.set(error.id, error);
    indexError(error);
  }

  state = {
    ...state,
    errors: newErrors,
  };

  applyFilter();
}

export function removeError(id: string): boolean {
  if (!state.errors.has(id)) {
    return false;
  }

  const newErrors = new Map(state.errors);
  newErrors.delete(id);

  const newIndex = new Map(state.searchIndex);
  for (const [, ids] of newIndex) {
    ids.delete(id);
  }

  state = {
    ...state,
    errors: newErrors,
    searchIndex: newIndex,
  };

  applyFilter();
  return true;
}

export function clearErrors(): void {
  state = {
    ...state,
    errors: new Map(),
    filteredIds: [],
    searchIndex: new Map(),
  };
}

export function getError(id: string): FilterableError | null {
  return state.errors.get(id) ?? null;
}

export function getAllErrors(): readonly FilterableError[] {
  return Array.from(state.errors.values())
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function getErrorCount(): number {
  return state.errors.size;
}

// ============================================================================
// Search Indexing
// ============================================================================

function indexError(error: FilterableError): void {
  const tokens = tokenize(error.message);
  const newIndex = new Map(state.searchIndex);

  for (const token of tokens) {
    if (!newIndex.has(token)) {
      newIndex.set(token, new Set());
    }
    newIndex.get(token)!.add(error.id);
  }

  // Index file path tokens
  if (error.file) {
    const fileTokens = tokenize(error.file);
    for (const token of fileTokens) {
      if (!newIndex.has(token)) {
        newIndex.set(token, new Set());
      }
      newIndex.get(token)!.add(error.id);
    }
  }

  // Index error code
  if (error.code) {
    const codeToken = error.code.toLowerCase();
    if (!newIndex.has(codeToken)) {
      newIndex.set(codeToken, new Set());
    }
    newIndex.get(codeToken)!.add(error.id);
  }

  state = {
    ...state,
    searchIndex: newIndex,
  };
}

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_./\\:,;()[\]{}'"]+/)
    .filter(token => token.length >= 2);
}

// ============================================================================
// Filter Management
// ============================================================================

export function setFilter(filter: Partial<ErrorFilter>): void {
  state = {
    ...state,
    filter: {
      ...state.filter,
      ...filter,
    },
  };

  applyFilter();
}

export function getFilter(): ErrorFilter {
  return state.filter;
}

export function resetFilter(): void {
  state = {
    ...state,
    filter: DEFAULT_FILTER,
  };

  applyFilter();
}

export function clearFilterField(field: keyof ErrorFilter): void {
  const updates: Partial<ErrorFilter> = {};

  switch (field) {
    case 'severities':
    case 'categories':
    case 'files':
    case 'codes':
    case 'sources':
      updates[field] = [];
      break;
    case 'searchQuery':
      updates.searchQuery = '';
      break;
    case 'fromTimestamp':
    case 'toTimestamp':
      updates[field] = null;
      break;
  }

  setFilter(updates);
}

// ============================================================================
// Severity Filtering
// ============================================================================

export function filterBySeverity(severity: ErrorSeverity): void {
  setFilter({ severities: [severity] });
}

export function filterBySeverities(severities: readonly ErrorSeverity[]): void {
  setFilter({ severities });
}

export function addSeverityFilter(severity: ErrorSeverity): void {
  if (state.filter.severities.includes(severity)) {
    return;
  }
  setFilter({ severities: [...state.filter.severities, severity] });
}

export function removeSeverityFilter(severity: ErrorSeverity): void {
  setFilter({
    severities: state.filter.severities.filter(s => s !== severity)
  });
}

export function toggleSeverityFilter(severity: ErrorSeverity): void {
  if (state.filter.severities.includes(severity)) {
    removeSeverityFilter(severity);
  } else {
    addSeverityFilter(severity);
  }
}

// ============================================================================
// Category Filtering
// ============================================================================

export function filterByCategory(category: ErrorCategory): void {
  setFilter({ categories: [category] });
}

export function filterByCategories(categories: readonly ErrorCategory[]): void {
  setFilter({ categories });
}

export function addCategoryFilter(category: ErrorCategory): void {
  if (state.filter.categories.includes(category)) {
    return;
  }
  setFilter({ categories: [...state.filter.categories, category] });
}

export function removeCategoryFilter(category: ErrorCategory): void {
  setFilter({
    categories: state.filter.categories.filter(c => c !== category)
  });
}

export function toggleCategoryFilter(category: ErrorCategory): void {
  if (state.filter.categories.includes(category)) {
    removeCategoryFilter(category);
  } else {
    addCategoryFilter(category);
  }
}

// ============================================================================
// File Filtering
// ============================================================================

export function filterByFile(file: string): void {
  setFilter({ files: [file] });
}

export function filterByFiles(files: readonly string[]): void {
  setFilter({ files });
}

export function addFileFilter(file: string): void {
  if (state.filter.files.includes(file)) {
    return;
  }
  setFilter({ files: [...state.filter.files, file] });
}

export function removeFileFilter(file: string): void {
  setFilter({
    files: state.filter.files.filter(f => f !== file)
  });
}

// ============================================================================
// Search
// ============================================================================

export function search(query: string): void {
  setFilter({ searchQuery: query });
}

export function clearSearch(): void {
  setFilter({ searchQuery: '' });
}

export function getSearchQuery(): string {
  return state.filter.searchQuery;
}

function searchErrors(query: string): Set<string> {
  if (!query.trim()) {
    return new Set(state.errors.keys());
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return new Set(state.errors.keys());
  }

  // Find errors matching all query tokens
  let matchingIds: Set<string> | null = null;

  for (const token of queryTokens) {
    const tokenMatches = new Set<string>();

    // Check for exact token match
    if (state.searchIndex.has(token)) {
      for (const id of state.searchIndex.get(token)!) {
        tokenMatches.add(id);
      }
    }

    // Check for partial matches
    for (const [indexedToken, ids] of state.searchIndex) {
      if (indexedToken.includes(token) || token.includes(indexedToken)) {
        for (const id of ids) {
          tokenMatches.add(id);
        }
      }
    }

    if (matchingIds === null) {
      matchingIds = tokenMatches;
    } else {
      // Intersect with previous matches
      matchingIds = new Set(
        [...matchingIds].filter(id => tokenMatches.has(id))
      );
    }
  }

  return matchingIds ?? new Set();
}

// ============================================================================
// Timestamp Filtering
// ============================================================================

export function filterByTimeRange(from: number | null, to: number | null): void {
  setFilter({ fromTimestamp: from, toTimestamp: to });
}

export function filterFromTimestamp(from: number): void {
  setFilter({ fromTimestamp: from });
}

export function filterToTimestamp(to: number): void {
  setFilter({ toTimestamp: to });
}

export function clearTimeFilter(): void {
  setFilter({ fromTimestamp: null, toTimestamp: null });
}

// ============================================================================
// Code Filtering
// ============================================================================

export function filterByCode(code: string): void {
  setFilter({ codes: [code] });
}

export function filterByCodes(codes: readonly string[]): void {
  setFilter({ codes });
}

export function addCodeFilter(code: string): void {
  if (state.filter.codes.includes(code)) {
    return;
  }
  setFilter({ codes: [...state.filter.codes, code] });
}

export function removeCodeFilter(code: string): void {
  setFilter({
    codes: state.filter.codes.filter(c => c !== code)
  });
}

// ============================================================================
// Filter Application
// ============================================================================

function applyFilter(): void {
  const filter = state.filter;
  let matchingIds = searchErrors(filter.searchQuery);

  // Apply severity filter
  if (filter.severities.length > 0) {
    matchingIds = new Set(
      [...matchingIds].filter(id => {
        const error = state.errors.get(id);
        return error && filter.severities.includes(error.severity);
      })
    );
  }

  // Apply category filter
  if (filter.categories.length > 0) {
    matchingIds = new Set(
      [...matchingIds].filter(id => {
        const error = state.errors.get(id);
        return error && filter.categories.includes(error.category);
      })
    );
  }

  // Apply file filter
  if (filter.files.length > 0) {
    matchingIds = new Set(
      [...matchingIds].filter(id => {
        const error = state.errors.get(id);
        return error && error.file && filter.files.includes(error.file);
      })
    );
  }

  // Apply timestamp filter
  if (filter.fromTimestamp !== null) {
    matchingIds = new Set(
      [...matchingIds].filter(id => {
        const error = state.errors.get(id);
        return error && error.timestamp >= filter.fromTimestamp!;
      })
    );
  }

  if (filter.toTimestamp !== null) {
    matchingIds = new Set(
      [...matchingIds].filter(id => {
        const error = state.errors.get(id);
        return error && error.timestamp <= filter.toTimestamp!;
      })
    );
  }

  // Apply code filter
  if (filter.codes.length > 0) {
    matchingIds = new Set(
      [...matchingIds].filter(id => {
        const error = state.errors.get(id);
        return error && error.code && filter.codes.includes(error.code);
      })
    );
  }

  // Apply source filter
  if (filter.sources.length > 0) {
    matchingIds = new Set(
      [...matchingIds].filter(id => {
        const error = state.errors.get(id);
        return error && error.source && filter.sources.includes(error.source);
      })
    );
  }

  // Sort by timestamp descending
  const sortedIds = [...matchingIds].sort((a, b) => {
    const errorA = state.errors.get(a);
    const errorB = state.errors.get(b);
    if (!errorA || !errorB) return 0;
    return errorB.timestamp - errorA.timestamp;
  });

  state = {
    ...state,
    filteredIds: sortedIds,
  };
}

// ============================================================================
// Results
// ============================================================================

export function getFilteredErrors(): readonly FilterableError[] {
  return state.filteredIds
    .map(id => state.errors.get(id))
    .filter((e): e is FilterableError => e !== undefined);
}

export function getFilteredCount(): number {
  return state.filteredIds.length;
}

export function getFilterResult(): FilterResult {
  const appliedFilters: string[] = [];

  if (state.filter.severities.length > 0) {
    appliedFilters.push(`severity: ${state.filter.severities.join(', ')}`);
  }
  if (state.filter.categories.length > 0) {
    appliedFilters.push(`category: ${state.filter.categories.join(', ')}`);
  }
  if (state.filter.files.length > 0) {
    appliedFilters.push(`file: ${state.filter.files.join(', ')}`);
  }
  if (state.filter.searchQuery) {
    appliedFilters.push(`search: "${state.filter.searchQuery}"`);
  }
  if (state.filter.fromTimestamp !== null || state.filter.toTimestamp !== null) {
    appliedFilters.push('time range');
  }
  if (state.filter.codes.length > 0) {
    appliedFilters.push(`code: ${state.filter.codes.join(', ')}`);
  }

  return {
    errors: getFilteredErrors(),
    totalCount: state.errors.size,
    filteredCount: state.filteredIds.length,
    appliedFilters,
  };
}

export function hasActiveFilter(): boolean {
  const filter = state.filter;
  return (
    filter.severities.length > 0 ||
    filter.categories.length > 0 ||
    filter.files.length > 0 ||
    filter.searchQuery !== '' ||
    filter.fromTimestamp !== null ||
    filter.toTimestamp !== null ||
    filter.codes.length > 0 ||
    filter.sources.length > 0
  );
}

// ============================================================================
// Summary and Statistics
// ============================================================================

export function getFilterSummary(): FilterSummary {
  const severityCounts: Record<ErrorSeverity, number> = {
    error: 0,
    warning: 0,
    info: 0,
    hint: 0,
  };

  const categoryCounts: Record<ErrorCategory, number> = {
    syntax: 0,
    type: 0,
    runtime: 0,
    validation: 0,
    network: 0,
    security: 0,
    performance: 0,
    deprecation: 0,
    other: 0,
  };

  const fileCounts: Record<string, number> = {};
  const codeCounts: Record<string, number> = {};

  for (const error of state.errors.values()) {
    severityCounts[error.severity]++;
    categoryCounts[error.category]++;

    if (error.file) {
      fileCounts[error.file] = (fileCounts[error.file] ?? 0) + 1;
    }

    if (error.code) {
      codeCounts[error.code] = (codeCounts[error.code] ?? 0) + 1;
    }
  }

  return {
    severityCounts,
    categoryCounts,
    fileCounts,
    codeCounts,
  };
}

export function getUniqueFiles(): readonly string[] {
  const files = new Set<string>();
  for (const error of state.errors.values()) {
    if (error.file) {
      files.add(error.file);
    }
  }
  return Array.from(files).sort();
}

export function getUniqueCodes(): readonly string[] {
  const codes = new Set<string>();
  for (const error of state.errors.values()) {
    if (error.code) {
      codes.add(error.code);
    }
  }
  return Array.from(codes).sort();
}

export function getUniqueSources(): readonly string[] {
  const sources = new Set<string>();
  for (const error of state.errors.values()) {
    if (error.source) {
      sources.add(error.source);
    }
  }
  return Array.from(sources).sort();
}

// ============================================================================
// Quick Filters
// ============================================================================

export function showErrorsOnly(): void {
  filterBySeverity('error');
}

export function showWarningsOnly(): void {
  filterBySeverity('warning');
}

export function showErrorsAndWarnings(): void {
  filterBySeverities(['error', 'warning']);
}

export function showAll(): void {
  resetFilter();
}

// ============================================================================
// State Access
// ============================================================================

export function getState(): FilterState {
  return {
    ...state,
    errors: new Map(state.errors),
    searchIndex: new Map(state.searchIndex),
  };
}

// ============================================================================
// Reset
// ============================================================================

export function resetErrorFilter(): void {
  state = {
    filter: DEFAULT_FILTER,
    errors: new Map(),
    filteredIds: [],
    searchIndex: new Map(),
  };
}

// ============================================================================
// Utilities
// ============================================================================

export function getAllSeverities(): readonly ErrorSeverity[] {
  return ALL_SEVERITIES;
}

export function getAllCategories(): readonly ErrorCategory[] {
  return ALL_CATEGORIES;
}

export function createError(
  id: string,
  message: string,
  options: Partial<Omit<FilterableError, 'id' | 'message'>> = {}
): FilterableError {
  return {
    id,
    message,
    severity: options.severity ?? 'error',
    category: options.category ?? 'other',
    file: options.file ?? null,
    line: options.line ?? null,
    column: options.column ?? null,
    timestamp: options.timestamp ?? Date.now(),
    code: options.code ?? null,
    source: options.source ?? null,
  };
}

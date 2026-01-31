/**
 * Suggestion Chips for Common Follow-up Actions
 *
 * Provides suggestion chips like 'Add another page', 'Change colors', 'Deploy'
 * that appear after generation to guide users to common next actions.
 */

// ============================================================================
// Types
// ============================================================================

export interface SuggestionChip {
  readonly id: string;
  readonly label: string;
  readonly action: string;
  readonly icon: string | null;
  readonly category: ChipCategory;
  readonly priority: number;
  readonly enabled: boolean;
  readonly tooltip: string | null;
  readonly shortcut: string | null;
}

export type ChipCategory = 'content' | 'design' | 'deploy' | 'iterate' | 'export' | 'custom';

export interface ChipContext {
  readonly generationType: GenerationType;
  readonly hasPages: boolean;
  readonly hasStyles: boolean;
  readonly hasDeployment: boolean;
  readonly iterationCount: number;
  readonly customContext: Record<string, unknown>;
}

export type GenerationType = 'page' | 'component' | 'style' | 'full_site' | 'modification';

export interface SuggestionChipsState {
  readonly chips: Map<string, SuggestionChip>;
  readonly visibleChips: readonly string[];
  readonly selectedChipId: string | null;
  readonly context: ChipContext | null;
  readonly maxVisible: number;
  readonly enabled: boolean;
}

export interface ChipClickEvent {
  readonly chipId: string;
  readonly action: string;
  readonly timestamp: number;
}

export type ChipClickHandler = (event: ChipClickEvent) => void;

export interface ChipDisplayState {
  readonly chips: readonly SuggestionChip[];
  readonly hasMore: boolean;
  readonly totalCount: number;
  readonly visibleCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_VISIBLE = 5;

const DEFAULT_CHIPS: readonly SuggestionChip[] = [
  {
    id: 'add-page',
    label: 'Add another page',
    action: 'add_page',
    icon: 'plus',
    category: 'content',
    priority: 100,
    enabled: true,
    tooltip: 'Create a new page for your site',
    shortcut: null,
  },
  {
    id: 'change-colors',
    label: 'Change colors',
    action: 'change_colors',
    icon: 'palette',
    category: 'design',
    priority: 90,
    enabled: true,
    tooltip: 'Modify the color scheme',
    shortcut: null,
  },
  {
    id: 'deploy',
    label: 'Deploy',
    action: 'deploy',
    icon: 'rocket',
    category: 'deploy',
    priority: 92, // High priority to appear in default top 5
    enabled: true,
    tooltip: 'Deploy your site to production',
    shortcut: null,
  },
  {
    id: 'add-component',
    label: 'Add component',
    action: 'add_component',
    icon: 'cube',
    category: 'content',
    priority: 85,
    enabled: true,
    tooltip: 'Add a new component',
    shortcut: null,
  },
  {
    id: 'change-fonts',
    label: 'Change fonts',
    action: 'change_fonts',
    icon: 'type',
    category: 'design',
    priority: 75,
    enabled: true,
    tooltip: 'Modify typography settings',
    shortcut: null,
  },
  {
    id: 'preview',
    label: 'Preview',
    action: 'preview',
    icon: 'eye',
    category: 'iterate',
    priority: 95,
    enabled: true,
    tooltip: 'Preview your changes',
    shortcut: 'P',
  },
  {
    id: 'undo',
    label: 'Undo changes',
    action: 'undo',
    icon: 'undo',
    category: 'iterate',
    priority: 70,
    enabled: true,
    tooltip: 'Revert last change',
    shortcut: 'Z',
  },
  {
    id: 'export-code',
    label: 'Export code',
    action: 'export_code',
    icon: 'download',
    category: 'export',
    priority: 60,
    enabled: true,
    tooltip: 'Download the generated code',
    shortcut: null,
  },
  {
    id: 'share',
    label: 'Share',
    action: 'share',
    icon: 'share',
    category: 'export',
    priority: 55,
    enabled: true,
    tooltip: 'Share your project',
    shortcut: null,
  },
  {
    id: 'iterate',
    label: 'Make changes',
    action: 'iterate',
    icon: 'edit',
    category: 'iterate',
    priority: 88,
    enabled: true,
    tooltip: 'Describe changes to make',
    shortcut: null,
  },
];

// ============================================================================
// State
// ============================================================================

let state: SuggestionChipsState = {
  chips: new Map(DEFAULT_CHIPS.map(c => [c.id, c])),
  visibleChips: [],
  selectedChipId: null,
  context: null,
  maxVisible: DEFAULT_MAX_VISIBLE,
  enabled: true,
};

let clickHandlers: ChipClickHandler[] = [];

// ============================================================================
// Core Functions
// ============================================================================

export function getChip(id: string): SuggestionChip | null {
  return state.chips.get(id) ?? null;
}

export function getAllChips(): readonly SuggestionChip[] {
  return Array.from(state.chips.values());
}

export function getEnabledChips(): readonly SuggestionChip[] {
  return Array.from(state.chips.values()).filter(c => c.enabled);
}

export function getChipsByCategory(category: ChipCategory): readonly SuggestionChip[] {
  return Array.from(state.chips.values())
    .filter(c => c.category === category && c.enabled)
    .sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// Context-Aware Suggestions
// ============================================================================

export function setContext(context: ChipContext): void {
  state = {
    ...state,
    context,
  };

  updateVisibleChips();
}

export function getContext(): ChipContext | null {
  return state.context;
}

export function clearContext(): void {
  state = {
    ...state,
    context: null,
    visibleChips: [],
  };
}

export function updateVisibleChips(): void {
  if (!state.context || !state.enabled) {
    state = {
      ...state,
      visibleChips: [],
    };
    return;
  }

  const enabledChips = getEnabledChips();
  const relevantChips = enabledChips.filter(chip => isChipRelevant(chip, state.context!));

  // Sort by priority and take top N
  const sorted = relevantChips.sort((a, b) => b.priority - a.priority);
  const visible = sorted.slice(0, state.maxVisible).map(c => c.id);

  state = {
    ...state,
    visibleChips: visible,
  };
}

function isChipRelevant(chip: SuggestionChip, context: ChipContext): boolean {
  switch (chip.id) {
    case 'add-page':
      return context.generationType === 'page' || context.generationType === 'full_site';

    case 'add-component':
      return context.generationType === 'component' || context.generationType === 'page';

    case 'change-colors':
    case 'change-fonts':
      return context.hasStyles || context.generationType === 'style';

    case 'deploy':
      return context.hasPages && !context.hasDeployment;

    case 'preview':
      return true; // Always relevant

    case 'undo':
      return context.iterationCount > 0;

    case 'iterate':
      return true; // Always relevant

    case 'export-code':
      return context.hasPages;

    case 'share':
      return context.hasPages;

    default:
      return true;
  }
}

// ============================================================================
// Visibility Control
// ============================================================================

export function getVisibleChips(): readonly SuggestionChip[] {
  return state.visibleChips
    .map(id => state.chips.get(id))
    .filter((c): c is SuggestionChip => c !== undefined);
}

export function getDisplayState(): ChipDisplayState {
  const visible = getVisibleChips();
  const total = getEnabledChips().filter(c =>
    state.context ? isChipRelevant(c, state.context) : true
  ).length;

  return {
    chips: visible,
    hasMore: total > visible.length,
    totalCount: total,
    visibleCount: visible.length,
  };
}

export function setMaxVisible(max: number): void {
  state = {
    ...state,
    maxVisible: Math.max(1, max),
  };

  updateVisibleChips();
}

export function getMaxVisible(): number {
  return state.maxVisible;
}

export function showAllChips(): readonly SuggestionChip[] {
  const oldMax = state.maxVisible;
  state = {
    ...state,
    maxVisible: 999,
  };

  updateVisibleChips();

  const visible = getVisibleChips();

  state = {
    ...state,
    maxVisible: oldMax,
  };

  return visible;
}

// ============================================================================
// Enable/Disable
// ============================================================================

export function enable(): void {
  state = {
    ...state,
    enabled: true,
  };

  updateVisibleChips();
}

export function disable(): void {
  state = {
    ...state,
    enabled: false,
    visibleChips: [],
  };
}

export function isEnabled(): boolean {
  return state.enabled;
}

export function enableChip(id: string): SuggestionChip | null {
  const chip = state.chips.get(id);
  if (!chip) {
    return null;
  }

  const updated: SuggestionChip = {
    ...chip,
    enabled: true,
  };

  const newChips = new Map(state.chips);
  newChips.set(id, updated);

  state = {
    ...state,
    chips: newChips,
  };

  updateVisibleChips();
  return updated;
}

export function disableChip(id: string): SuggestionChip | null {
  const chip = state.chips.get(id);
  if (!chip) {
    return null;
  }

  const updated: SuggestionChip = {
    ...chip,
    enabled: false,
  };

  const newChips = new Map(state.chips);
  newChips.set(id, updated);

  state = {
    ...state,
    chips: newChips,
  };

  updateVisibleChips();
  return updated;
}

// ============================================================================
// Selection
// ============================================================================

export function selectChip(id: string): boolean {
  if (!state.chips.has(id)) {
    return false;
  }

  state = {
    ...state,
    selectedChipId: id,
  };

  return true;
}

export function clearSelection(): void {
  state = {
    ...state,
    selectedChipId: null,
  };
}

export function getSelectedChip(): SuggestionChip | null {
  if (!state.selectedChipId) {
    return null;
  }
  return state.chips.get(state.selectedChipId) ?? null;
}

// ============================================================================
// Click Handling
// ============================================================================

export function clickChip(id: string): ChipClickEvent | null {
  const chip = state.chips.get(id);
  if (!chip || !chip.enabled) {
    return null;
  }

  const event: ChipClickEvent = {
    chipId: id,
    action: chip.action,
    timestamp: Date.now(),
  };

  notifyClick(event);
  return event;
}

export function onClick(handler: ChipClickHandler): () => void {
  clickHandlers.push(handler);

  return () => {
    clickHandlers = clickHandlers.filter(h => h !== handler);
  };
}

function notifyClick(event: ChipClickEvent): void {
  for (const handler of clickHandlers) {
    handler(event);
  }
}

// ============================================================================
// Custom Chips
// ============================================================================

export function addChip(chip: Omit<SuggestionChip, 'id'>): SuggestionChip {
  const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const newChip: SuggestionChip = {
    ...chip,
    id,
  };

  const newChips = new Map(state.chips);
  newChips.set(id, newChip);

  state = {
    ...state,
    chips: newChips,
  };

  updateVisibleChips();
  return newChip;
}

export function removeChip(id: string): boolean {
  if (!state.chips.has(id)) {
    return false;
  }

  const newChips = new Map(state.chips);
  newChips.delete(id);

  state = {
    ...state,
    chips: newChips,
    visibleChips: state.visibleChips.filter(cid => cid !== id),
    selectedChipId: state.selectedChipId === id ? null : state.selectedChipId,
  };

  return true;
}

export function updateChip(id: string, updates: Partial<SuggestionChip>): SuggestionChip | null {
  const chip = state.chips.get(id);
  if (!chip) {
    return null;
  }

  const updated: SuggestionChip = {
    ...chip,
    ...updates,
    id, // Ensure ID cannot be changed
  };

  const newChips = new Map(state.chips);
  newChips.set(id, updated);

  state = {
    ...state,
    chips: newChips,
  };

  updateVisibleChips();
  return updated;
}

// ============================================================================
// Chip Styling
// ============================================================================

export interface ChipStyle {
  readonly backgroundColor: string;
  readonly textColor: string;
  readonly borderColor: string;
  readonly hoverBackgroundColor: string;
}

const CATEGORY_STYLES: Record<ChipCategory, ChipStyle> = {
  content: {
    backgroundColor: '#e0f2fe',
    textColor: '#0369a1',
    borderColor: '#7dd3fc',
    hoverBackgroundColor: '#bae6fd',
  },
  design: {
    backgroundColor: '#fce7f3',
    textColor: '#be185d',
    borderColor: '#f9a8d4',
    hoverBackgroundColor: '#fbcfe8',
  },
  deploy: {
    backgroundColor: '#dcfce7',
    textColor: '#15803d',
    borderColor: '#86efac',
    hoverBackgroundColor: '#bbf7d0',
  },
  iterate: {
    backgroundColor: '#fef3c7',
    textColor: '#b45309',
    borderColor: '#fcd34d',
    hoverBackgroundColor: '#fde68a',
  },
  export: {
    backgroundColor: '#e0e7ff',
    textColor: '#4338ca',
    borderColor: '#a5b4fc',
    hoverBackgroundColor: '#c7d2fe',
  },
  custom: {
    backgroundColor: '#f3f4f6',
    textColor: '#374151',
    borderColor: '#d1d5db',
    hoverBackgroundColor: '#e5e7eb',
  },
};

export function getChipStyle(id: string): ChipStyle | null {
  const chip = state.chips.get(id);
  if (!chip) {
    return null;
  }

  return CATEGORY_STYLES[chip.category];
}

export function getCategoryStyle(category: ChipCategory): ChipStyle {
  return CATEGORY_STYLES[category];
}

// ============================================================================
// Presets for Common Scenarios
// ============================================================================

export function showAfterPageGeneration(): void {
  setContext({
    generationType: 'page',
    hasPages: true,
    hasStyles: true,
    hasDeployment: false,
    iterationCount: 0,
    customContext: {},
  });
}

export function showAfterComponentGeneration(): void {
  setContext({
    generationType: 'component',
    hasPages: true,
    hasStyles: true,
    hasDeployment: false,
    iterationCount: 0,
    customContext: {},
  });
}

export function showAfterStyleChange(): void {
  setContext({
    generationType: 'style',
    hasPages: true,
    hasStyles: true,
    hasDeployment: false,
    iterationCount: 1,
    customContext: {},
  });
}

export function showAfterFullSiteGeneration(): void {
  setContext({
    generationType: 'full_site',
    hasPages: true,
    hasStyles: true,
    hasDeployment: false,
    iterationCount: 0,
    customContext: {},
  });
}

// ============================================================================
// State Inspection
// ============================================================================

export function getState(): SuggestionChipsState {
  return {
    ...state,
    chips: new Map(state.chips),
  };
}

export function hasVisibleChips(): boolean {
  return state.visibleChips.length > 0;
}

export function getChipCount(): number {
  return state.chips.size;
}

// ============================================================================
// Reset
// ============================================================================

export function resetSuggestionChips(): void {
  state = {
    chips: new Map(DEFAULT_CHIPS.map(c => [c.id, c])),
    visibleChips: [],
    selectedChipId: null,
    context: null,
    maxVisible: DEFAULT_MAX_VISIBLE,
    enabled: true,
  };
  clickHandlers = [];
}

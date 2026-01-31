/**
 * Architecture Decision Records (ADRs)
 *
 * Manages architectural decision records for major design decisions
 * including agentic loop design, tool selection, and HMR approach.
 */

// ============================================================================
// Types
// ============================================================================

export interface ADR {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly status: ADRStatus;
  readonly context: string;
  readonly decision: string;
  readonly consequences: readonly string[];
  readonly alternatives: readonly Alternative[];
  readonly category: ADRCategory;
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly supersededBy: string | null;
  readonly relatedADRs: readonly string[];
  readonly metadata: Record<string, unknown>;
}

export type ADRStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded' | 'rejected';

export type ADRCategory =
  | 'architecture'
  | 'agentic-loop'
  | 'tool-selection'
  | 'hmr'
  | 'performance'
  | 'security'
  | 'integration'
  | 'other';

export interface Alternative {
  readonly name: string;
  readonly description: string;
  readonly pros: readonly string[];
  readonly cons: readonly string[];
  readonly rejected: boolean;
  readonly rejectionReason: string | null;
}

export interface ADRState {
  readonly adrs: Map<string, ADR>;
  readonly nextNumber: number;
}

export interface ADRQuery {
  readonly status?: ADRStatus;
  readonly category?: ADRCategory;
  readonly tags?: readonly string[];
  readonly fromDate?: number;
  readonly toDate?: number;
  readonly searchText?: string;
}

export interface ADRSummary {
  readonly total: number;
  readonly byStatus: Record<ADRStatus, number>;
  readonly byCategory: Record<ADRCategory, number>;
  readonly recentlyUpdated: readonly ADR[];
}

// ============================================================================
// State
// ============================================================================

let state: ADRState = {
  adrs: new Map(),
  nextNumber: 1,
};

// Monotonic timestamp counter to ensure updatedAt > createdAt even within same millisecond
let lastTimestamp = 0;

// ============================================================================
// Core Functions
// ============================================================================

export function createADR(
  title: string,
  context: string,
  decision: string,
  options: {
    consequences?: readonly string[];
    alternatives?: readonly Alternative[];
    category?: ADRCategory;
    tags?: readonly string[];
    relatedADRs?: readonly string[];
    metadata?: Record<string, unknown>;
  } = {}
): ADR {
  const id = generateId();
  const now = Date.now();
  const number = state.nextNumber;

  const adr: ADR = {
    id,
    number,
    title,
    status: 'proposed',
    context,
    decision,
    consequences: options.consequences ?? [],
    alternatives: options.alternatives ?? [],
    category: options.category ?? 'architecture',
    tags: options.tags ?? [],
    createdAt: now,
    updatedAt: now,
    supersededBy: null,
    relatedADRs: options.relatedADRs ?? [],
    metadata: options.metadata ?? {},
  };

  const newADRs = new Map(state.adrs);
  newADRs.set(id, adr);

  state = {
    ...state,
    adrs: newADRs,
    nextNumber: number + 1,
  };

  return adr;
}

export function getADR(id: string): ADR | null {
  return state.adrs.get(id) ?? null;
}

export function getADRByNumber(number: number): ADR | null {
  for (const adr of state.adrs.values()) {
    if (adr.number === number) {
      return adr;
    }
  }
  return null;
}

export function getAllADRs(): readonly ADR[] {
  return Array.from(state.adrs.values())
    .sort((a, b) => a.number - b.number);
}

export function getADRCount(): number {
  return state.adrs.size;
}

// ============================================================================
// Status Management
// ============================================================================

export function acceptADR(id: string): ADR | null {
  const adr = state.adrs.get(id);
  if (!adr || adr.status !== 'proposed') {
    return null;
  }

  return updateADR(id, { status: 'accepted' });
}

export function deprecateADR(id: string, reason?: string): ADR | null {
  const adr = state.adrs.get(id);
  if (!adr || adr.status !== 'accepted') {
    return null;
  }

  return updateADR(id, {
    status: 'deprecated',
    metadata: { ...adr.metadata, deprecationReason: reason },
  });
}

export function supersedeADR(id: string, newADRId: string): ADR | null {
  const adr = state.adrs.get(id);
  const newADR = state.adrs.get(newADRId);

  if (!adr || !newADR || adr.status !== 'accepted') {
    return null;
  }

  return updateADR(id, {
    status: 'superseded',
    supersededBy: newADRId,
  });
}

export function rejectADR(id: string, reason?: string): ADR | null {
  const adr = state.adrs.get(id);
  if (!adr || adr.status !== 'proposed') {
    return null;
  }

  return updateADR(id, {
    status: 'rejected',
    metadata: { ...adr.metadata, rejectionReason: reason },
  });
}

// ============================================================================
// Updates
// ============================================================================

export function updateADR(
  id: string,
  updates: Partial<Omit<ADR, 'id' | 'number' | 'createdAt'>>
): ADR | null {
  const adr = state.adrs.get(id);
  if (!adr) {
    return null;
  }

  // Monotonic timestamp: ensure updatedAt > createdAt even within same millisecond
  const now = Date.now();
  const minTimestamp = Math.max(adr.createdAt + 1, lastTimestamp + 1, now);
  lastTimestamp = minTimestamp;

  const updated: ADR = {
    ...adr,
    ...updates,
    id: adr.id,
    number: adr.number,
    createdAt: adr.createdAt,
    updatedAt: minTimestamp,
  };

  const newADRs = new Map(state.adrs);
  newADRs.set(id, updated);

  state = {
    ...state,
    adrs: newADRs,
  };

  return updated;
}

export function addConsequence(id: string, consequence: string): ADR | null {
  const adr = state.adrs.get(id);
  if (!adr) {
    return null;
  }

  return updateADR(id, {
    consequences: [...adr.consequences, consequence],
  });
}

export function addAlternative(id: string, alternative: Alternative): ADR | null {
  const adr = state.adrs.get(id);
  if (!adr) {
    return null;
  }

  return updateADR(id, {
    alternatives: [...adr.alternatives, alternative],
  });
}

export function addRelatedADR(id: string, relatedId: string): ADR | null {
  const adr = state.adrs.get(id);
  const related = state.adrs.get(relatedId);

  if (!adr || !related || adr.relatedADRs.includes(relatedId)) {
    return null;
  }

  return updateADR(id, {
    relatedADRs: [...adr.relatedADRs, relatedId],
  });
}

export function addTag(id: string, tag: string): ADR | null {
  const adr = state.adrs.get(id);
  if (!adr || adr.tags.includes(tag)) {
    return null;
  }

  return updateADR(id, {
    tags: [...adr.tags, tag],
  });
}

export function removeTag(id: string, tag: string): ADR | null {
  const adr = state.adrs.get(id);
  if (!adr) {
    return null;
  }

  return updateADR(id, {
    tags: adr.tags.filter(t => t !== tag),
  });
}

// ============================================================================
// Query Functions
// ============================================================================

export function queryADRs(query: ADRQuery): readonly ADR[] {
  let results = getAllADRs();

  if (query.status !== undefined) {
    results = results.filter(adr => adr.status === query.status);
  }

  if (query.category !== undefined) {
    results = results.filter(adr => adr.category === query.category);
  }

  if (query.tags !== undefined && query.tags.length > 0) {
    results = results.filter(adr =>
      query.tags!.some(tag => adr.tags.includes(tag))
    );
  }

  if (query.fromDate !== undefined) {
    results = results.filter(adr => adr.createdAt >= query.fromDate!);
  }

  if (query.toDate !== undefined) {
    results = results.filter(adr => adr.createdAt <= query.toDate!);
  }

  if (query.searchText !== undefined && query.searchText.trim()) {
    const searchLower = query.searchText.toLowerCase();
    results = results.filter(adr =>
      adr.title.toLowerCase().includes(searchLower) ||
      adr.context.toLowerCase().includes(searchLower) ||
      adr.decision.toLowerCase().includes(searchLower)
    );
  }

  return results;
}

export function getADRsByStatus(status: ADRStatus): readonly ADR[] {
  return queryADRs({ status });
}

export function getADRsByCategory(category: ADRCategory): readonly ADR[] {
  return queryADRs({ category });
}

export function getAcceptedADRs(): readonly ADR[] {
  return getADRsByStatus('accepted');
}

export function getProposedADRs(): readonly ADR[] {
  return getADRsByStatus('proposed');
}

export function getRelatedADRs(id: string): readonly ADR[] {
  const adr = state.adrs.get(id);
  if (!adr) {
    return [];
  }

  return adr.relatedADRs
    .map(relatedId => state.adrs.get(relatedId))
    .filter((a): a is ADR => a !== undefined);
}

// ============================================================================
// Summary and Statistics
// ============================================================================

export function getSummary(): ADRSummary {
  const all = getAllADRs();

  const byStatus: Record<ADRStatus, number> = {
    proposed: 0,
    accepted: 0,
    deprecated: 0,
    superseded: 0,
    rejected: 0,
  };

  const byCategory: Record<ADRCategory, number> = {
    architecture: 0,
    'agentic-loop': 0,
    'tool-selection': 0,
    hmr: 0,
    performance: 0,
    security: 0,
    integration: 0,
    other: 0,
  };

  for (const adr of all) {
    byStatus[adr.status]++;
    byCategory[adr.category]++;
  }

  const recentlyUpdated = [...all]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  return {
    total: all.length,
    byStatus,
    byCategory,
    recentlyUpdated,
  };
}

// ============================================================================
// Predefined ADRs for Major Decisions
// ============================================================================

export function initializeDefaultADRs(): void {
  // ADR 1: Agentic Loop Design
  const agenticLoop = createADR(
    'Agentic Loop Design',
    'The system needs an iterative generation loop that can self-correct errors and improve output quality through multiple passes.',
    'Implement a self-correcting agentic loop with configurable iteration limits, error detection, and automatic retry mechanisms.',
    {
      category: 'agentic-loop',
      consequences: [
        'System can automatically recover from generation errors',
        'Quality improves through iterative refinement',
        'Higher compute cost due to potential multiple iterations',
        'Need to implement iteration limits to prevent infinite loops',
      ],
      alternatives: [
        {
          name: 'Single-pass generation',
          description: 'Generate output in a single pass without iteration',
          pros: ['Simpler implementation', 'Lower latency', 'Predictable compute cost'],
          cons: ['No error recovery', 'Lower quality on complex tasks', 'No self-improvement'],
          rejected: true,
          rejectionReason: 'Insufficient quality for complex website generation tasks',
        },
        {
          name: 'Human-in-the-loop',
          description: 'Require human approval for each iteration',
          pros: ['High quality control', 'Human oversight'],
          cons: ['Slow iteration', 'Poor user experience', 'Not scalable'],
          rejected: true,
          rejectionReason: 'Does not meet the goal of autonomous generation',
        },
      ],
      tags: ['core', 'generation', 'quality'],
    }
  );
  acceptADR(agenticLoop.id);

  // ADR 2: Tool Selection
  const toolSelection = createADR(
    'Tool Selection Strategy',
    'The agent needs to select appropriate tools for different generation tasks (code generation, styling, component creation, etc.).',
    'Implement a context-aware tool selection system that analyzes user intent and available tools to choose the optimal tool chain.',
    {
      category: 'tool-selection',
      consequences: [
        'Better task-tool matching improves generation quality',
        'System can handle diverse generation requests',
        'Need to maintain tool registry and capabilities metadata',
        'Tool selection logic adds latency to request processing',
      ],
      alternatives: [
        {
          name: 'Fixed tool pipeline',
          description: 'Use a predefined sequence of tools for all tasks',
          pros: ['Simple implementation', 'Predictable behavior'],
          cons: ['Inflexible', 'Suboptimal for many task types'],
          rejected: true,
          rejectionReason: 'Cannot handle diverse website generation requirements',
        },
        {
          name: 'User-specified tools',
          description: 'Let users explicitly select which tools to use',
          pros: ['Full user control', 'Transparent'],
          cons: ['Poor UX', 'Requires user expertise', 'Error-prone'],
          rejected: true,
          rejectionReason: 'Contradicts goal of AI-driven autonomous generation',
        },
      ],
      tags: ['core', 'tools', 'intelligence'],
    }
  );
  acceptADR(toolSelection.id);

  // ADR 3: HMR Approach
  const hmrApproach = createADR(
    'Hot Module Replacement (HMR) Approach',
    'Live preview needs to update instantly when code changes are made, without full page reloads.',
    'Use Vite-based HMR with WebSocket connection for real-time updates. Implement partial component replacement for React components.',
    {
      category: 'hmr',
      consequences: [
        'Instant visual feedback during development',
        'State preservation during updates improves UX',
        'WebSocket connection required for preview',
        'HMR boundaries need careful handling to avoid full reloads',
      ],
      alternatives: [
        {
          name: 'Full page reload',
          description: 'Reload entire page on any change',
          pros: ['Simple implementation', 'Always consistent state'],
          cons: ['Slow feedback loop', 'Loses application state', 'Poor UX'],
          rejected: true,
          rejectionReason: 'Unacceptable latency for interactive development experience',
        },
        {
          name: 'Custom HMR implementation',
          description: 'Build custom hot reloading system',
          pros: ['Full control', 'Tailored to our needs'],
          cons: ['High development cost', 'Maintenance burden', 'Reinventing the wheel'],
          rejected: true,
          rejectionReason: 'Vite HMR is mature and well-suited to our React stack',
        },
      ],
      tags: ['preview', 'performance', 'dx'],
    }
  );
  acceptADR(hmrApproach.id);
}

// ============================================================================
// Export and Display
// ============================================================================

export function formatADR(adr: ADR): string {
  const lines = [
    `# ADR-${adr.number}: ${adr.title}`,
    '',
    `**Status:** ${adr.status}`,
    `**Category:** ${adr.category}`,
    `**Date:** ${new Date(adr.createdAt).toISOString().split('T')[0]}`,
    '',
    '## Context',
    adr.context,
    '',
    '## Decision',
    adr.decision,
    '',
  ];

  if (adr.consequences.length > 0) {
    lines.push('## Consequences');
    for (const consequence of adr.consequences) {
      lines.push(`- ${consequence}`);
    }
    lines.push('');
  }

  if (adr.alternatives.length > 0) {
    lines.push('## Alternatives Considered');
    for (const alt of adr.alternatives) {
      lines.push(`### ${alt.name}${alt.rejected ? ' (Rejected)' : ''}`);
      lines.push(alt.description);
      if (alt.rejectionReason) {
        lines.push(`*Rejection reason: ${alt.rejectionReason}*`);
      }
      lines.push('');
    }
  }

  if (adr.tags.length > 0) {
    lines.push(`**Tags:** ${adr.tags.join(', ')}`);
  }

  return lines.join('\n');
}

export function exportADRs(): string {
  const all = getAllADRs();
  return all.map(formatADR).join('\n\n---\n\n');
}

export function exportAsJSON(): string {
  return JSON.stringify({
    exportedAt: Date.now(),
    adrs: getAllADRs(),
    summary: getSummary(),
  }, null, 2);
}

// ============================================================================
// State Access
// ============================================================================

export function getState(): ADRState {
  return {
    ...state,
    adrs: new Map(state.adrs),
  };
}

// ============================================================================
// Remove and Clear
// ============================================================================

export function removeADR(id: string): boolean {
  if (!state.adrs.has(id)) {
    return false;
  }

  const newADRs = new Map(state.adrs);
  newADRs.delete(id);

  // Remove from related ADRs
  for (const [adrId, adr] of newADRs) {
    if (adr.relatedADRs.includes(id)) {
      newADRs.set(adrId, {
        ...adr,
        relatedADRs: adr.relatedADRs.filter(r => r !== id),
      });
    }
  }

  state = {
    ...state,
    adrs: newADRs,
  };

  return true;
}

export function clearADRs(): void {
  state = {
    adrs: new Map(),
    nextNumber: 1,
  };
  lastTimestamp = 0;
}

// ============================================================================
// Reset
// ============================================================================

export function resetArchitectureDecisions(): void {
  state = {
    adrs: new Map(),
    nextNumber: 1,
  };
  lastTimestamp = 0;
}

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return `adr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createAlternative(
  name: string,
  description: string,
  options: {
    pros?: readonly string[];
    cons?: readonly string[];
    rejected?: boolean;
    rejectionReason?: string;
  } = {}
): Alternative {
  return {
    name,
    description,
    pros: options.pros ?? [],
    cons: options.cons ?? [],
    rejected: options.rejected ?? false,
    rejectionReason: options.rejectionReason ?? null,
  };
}

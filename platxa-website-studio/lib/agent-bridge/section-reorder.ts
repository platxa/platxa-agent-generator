/**
 * Section Reorder — Drag-and-Drop Section Management
 *
 * Provides logic for reordering page sections with live position
 * feedback and QWeb template synchronization.
 */

// =============================================================================
// Types
// =============================================================================

/** A page section with position tracking */
export interface PageSection {
  /** Unique section ID (e.g. "s_hero", "s_features") */
  id: string;
  /** Section type */
  type: string;
  /** Display label */
  label: string;
  /** Current position (0-based) */
  position: number;
  /** Whether the section is currently being dragged */
  isDragging?: boolean;
}

/** Result of a drag operation */
export interface DragResult {
  /** Updated section list */
  sections: PageSection[];
  /** The moved section ID */
  movedSectionId: string;
  /** Original position */
  fromIndex: number;
  /** New position */
  toIndex: number;
  /** Whether the order actually changed */
  changed: boolean;
}

/** Position feedback during drag */
export interface DragFeedback {
  /** Section being dragged */
  draggedId: string;
  /** Current hover target index */
  targetIndex: number;
  /** Direction of movement */
  direction: "up" | "down" | "none";
  /** Preview of resulting order (section IDs) */
  previewOrder: string[];
}

/** QWeb template section reference */
export interface QWebSectionRef {
  /** Section snippet ID */
  snippetId: string;
  /** The t-call or section tag in QWeb */
  templateTag: string;
}

// =============================================================================
// Section List Management
// =============================================================================

/**
 * Creates a normalized section list with sequential positions.
 */
export function normalizeSections(sections: PageSection[]): PageSection[] {
  return sections.map((s, i) => ({ ...s, position: i, isDragging: false }));
}

/**
 * Moves a section from one position to another, updating all positions.
 */
export function moveSection(
  sections: PageSection[],
  fromIndex: number,
  toIndex: number,
): DragResult {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 ||
      fromIndex >= sections.length || toIndex >= sections.length) {
    return {
      sections: normalizeSections(sections),
      movedSectionId: sections[fromIndex]?.id ?? "",
      fromIndex,
      toIndex,
      changed: false,
    };
  }

  const result = [...sections];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);

  return {
    sections: normalizeSections(result),
    movedSectionId: moved.id,
    fromIndex,
    toIndex,
    changed: true,
  };
}

/**
 * Generates live drag feedback showing preview of resulting order.
 */
export function getDragFeedback(
  sections: PageSection[],
  draggedId: string,
  targetIndex: number,
): DragFeedback {
  const currentIndex = sections.findIndex((s) => s.id === draggedId);
  if (currentIndex === -1) {
    return {
      draggedId,
      targetIndex,
      direction: "none",
      previewOrder: sections.map((s) => s.id),
    };
  }

  const direction = targetIndex > currentIndex ? "down" : targetIndex < currentIndex ? "up" : "none";

  // Simulate the move to get preview order
  const preview = [...sections];
  const [moved] = preview.splice(currentIndex, 1);
  preview.splice(targetIndex, 0, moved);

  return {
    draggedId,
    targetIndex,
    direction,
    previewOrder: preview.map((s) => s.id),
  };
}

/**
 * Swaps two adjacent sections (for keyboard-based reordering).
 */
export function swapSections(
  sections: PageSection[],
  index: number,
  direction: "up" | "down",
): DragResult {
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  return moveSection(sections, index, targetIndex);
}

// =============================================================================
// QWeb Template Synchronization
// =============================================================================

/**
 * Extracts section references from a QWeb template string.
 * Looks for <section> tags with data-snippet or t-call attributes.
 */
export function extractQWebSections(template: string): QWebSectionRef[] {
  const refs: QWebSectionRef[] = [];
  const sectionRe = /<(?:section|t)\s[^>]*(?:data-snippet|t-call)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = sectionRe.exec(template)) !== null) {
    refs.push({
      snippetId: match[1],
      templateTag: match[0],
    });
  }

  return refs;
}

/**
 * Reorders sections in a QWeb template string to match the new order.
 * Preserves all content within each section block.
 */
export function reorderQWebTemplate(
  template: string,
  newOrder: string[],
): string {
  // Extract section blocks (from opening tag to closing </section> or self-closing)
  const blockRe = /(<(?:section|t)\s[^>]*(?:data-snippet|t-call)\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/(?:section|t)>|<(?:section|t)\s[^>]*(?:data-snippet|t-call)\s*=\s*["']([^"']+)["'][^>]*\/>)/gi;

  const blocks = new Map<string, string>();
  let match: RegExpExecArray | null;
  const allMatches: Array<{ id: string; full: string; start: number; end: number }> = [];

  while ((match = blockRe.exec(template)) !== null) {
    const id = match[2] || match[3];
    blocks.set(id, match[0]);
    allMatches.push({ id, full: match[0], start: match.index, end: match.index + match[0].length });
  }

  if (allMatches.length === 0) return template;

  // Build result: replace the range containing all sections with reordered blocks
  const firstStart = allMatches[0].start;
  const lastEnd = allMatches[allMatches.length - 1].end;

  // Get whitespace/separators between sections
  const before = template.substring(0, firstStart);
  const after = template.substring(lastEnd);

  // Determine separator (newlines between sections)
  let separator = "\n";
  if (allMatches.length >= 2) {
    const gap = template.substring(allMatches[0].end, allMatches[1].start);
    if (gap.trim() === "") separator = gap;
  }

  // Reorder
  const orderedBlocks: string[] = [];
  for (const id of newOrder) {
    const block = blocks.get(id);
    if (block) orderedBlocks.push(block);
  }
  // Append any sections not in newOrder (shouldn't happen but safety)
  for (const [id, block] of blocks) {
    if (!newOrder.includes(id)) orderedBlocks.push(block);
  }

  return before + orderedBlocks.join(separator) + after;
}

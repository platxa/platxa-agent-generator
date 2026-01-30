/**
 * Multi-Fix Batching for Related Errors
 *
 * Feature #150: Add multi-fix batching for related errors
 * Verification: Related errors (same file, same cause) fixed together
 */

// ============================================================================
// Types
// ============================================================================

/** Error relation type */
export type RelationType =
  | "same-file"
  | "same-cause"
  | "same-type"
  | "cascading"
  | "dependency"
  | "conflicting";

/** Error for batching */
export interface BatchableError {
  /** Unique error ID */
  id: string;
  /** Error message */
  message: string;
  /** Error type */
  type?: string;
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Error code */
  code?: string;
  /** Root cause identifier */
  causeId?: string;
  /** Stack trace */
  stack?: string;
  /** Timestamp */
  timestamp: number;
}

/** Fix suggestion for batching */
export interface BatchableFix {
  /** Unique fix ID */
  id: string;
  /** Associated error ID */
  errorId: string;
  /** Fix description */
  description: string;
  /** Target file */
  file?: string;
  /** Start line */
  startLine?: number;
  /** End line */
  endLine?: number;
  /** Fix code/content */
  code?: string;
  /** Fix priority (lower = higher priority) */
  priority?: number;
  /** Dependencies on other fixes */
  dependsOn?: string[];
  /** Conflicts with other fixes */
  conflictsWith?: string[];
}

/** Error relation */
export interface ErrorRelation {
  /** First error ID */
  errorA: string;
  /** Second error ID */
  errorB: string;
  /** Relation type */
  type: RelationType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Description of relation */
  description: string;
}

/** Error group (related errors) */
export interface ErrorGroup {
  /** Group ID */
  id: string;
  /** Group name/description */
  name: string;
  /** Error IDs in group */
  errorIds: string[];
  /** Primary relation type */
  relationType: RelationType;
  /** Shared file (if same-file) */
  sharedFile?: string;
  /** Shared cause (if same-cause) */
  sharedCause?: string;
  /** Group confidence */
  confidence: number;
}

/** Batched fix */
export interface BatchedFix {
  /** Batch ID */
  id: string;
  /** Batch description */
  description: string;
  /** Error group this batch fixes */
  groupId: string;
  /** Individual fixes in order */
  fixes: BatchableFix[];
  /** Files affected */
  files: string[];
  /** Total lines changed */
  totalLinesChanged: number;
  /** Has conflicts */
  hasConflicts: boolean;
  /** Conflict descriptions */
  conflicts: string[];
  /** Execution order matters */
  orderMatters: boolean;
}

/** Batch result */
export interface BatchResult {
  /** All error groups found */
  groups: ErrorGroup[];
  /** All batched fixes */
  batches: BatchedFix[];
  /** Errors that couldn't be grouped */
  ungroupedErrors: string[];
  /** Fixes that couldn't be batched */
  unbatchedFixes: string[];
  /** Statistics */
  stats: BatchStats;
}

/** Batch statistics */
export interface BatchStats {
  /** Total errors */
  totalErrors: number;
  /** Grouped errors */
  groupedErrors: number;
  /** Total groups */
  totalGroups: number;
  /** Total fixes */
  totalFixes: number;
  /** Batched fixes */
  batchedFixes: number;
  /** Total batches */
  totalBatches: number;
  /** Grouping ratio */
  groupingRatio: number;
  /** Batching ratio */
  batchingRatio: number;
}

/** Batcher options */
export interface MultiFixBatcherOptions {
  /** Minimum confidence for grouping */
  minGroupConfidence?: number;
  /** Maximum group size */
  maxGroupSize?: number;
  /** Enable cascading detection */
  detectCascading?: boolean;
  /** Enable conflict detection */
  detectConflicts?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default minimum group confidence */
export const DEFAULT_MIN_CONFIDENCE = 0.6;

/** Default maximum group size */
export const DEFAULT_MAX_GROUP_SIZE = 10;

/** Relation type priorities (lower = higher priority) */
export const RELATION_PRIORITY: Record<RelationType, number> = {
  "same-cause": 0,
  "cascading": 1,
  "same-file": 2,
  "same-type": 3,
  "dependency": 4,
  "conflicting": 5,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if two errors are in the same file
 */
export function isSameFile(a: BatchableError, b: BatchableError): boolean {
  return !!(a.file && b.file && a.file === b.file);
}

/**
 * Check if two errors have the same cause.
 * Returns true for explicit causeId match OR same type with highly similar messages.
 * Threshold of 0.7 allows for variable name differences in error messages.
 */
export function isSameCause(a: BatchableError, b: BatchableError): boolean {
  // Explicit cause ID
  if (a.causeId && b.causeId && a.causeId === b.causeId) return true;

  // Same error type and highly similar message (Jaccard > 0.7)
  // 0.7 threshold catches "Cannot read 'foo'" vs "Cannot read 'bar'" patterns
  if (a.type && b.type && a.type === b.type) {
    const similarity = messageSimilarity(a.message, b.message);
    return similarity > 0.7;
  }

  return false;
}

/**
 * Check if two errors are the same type
 */
export function isSameType(a: BatchableError, b: BatchableError): boolean {
  return !!(a.type && b.type && a.type === b.type);
}

/**
 * Check if error B cascades from error A
 */
export function isCascading(a: BatchableError, b: BatchableError): boolean {
  // B occurred after A
  if (b.timestamp <= a.timestamp) return false;

  // Same file, A's line comes before B's line
  if (a.file && b.file && a.file === b.file) {
    if (a.line && b.line && a.line < b.line) {
      // Similar type or message indicates cascade
      if (a.type === b.type) return true;
      if (messageSimilarity(a.message, b.message) > 0.5) return true;
    }
  }

  return false;
}

/**
 * Calculate message similarity (0-1)
 * Uses Jaccard similarity on word sets.
 * Empty strings are considered 0 similarity (not 1).
 */
export function messageSimilarity(a: string, b: string): number {
  // IMPORTANT: Check empty BEFORE equality - empty strings should return 0
  if (!a || !b) return 0;
  if (a === b) return 1;

  const aWords = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const bWords = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));

  if (aWords.size === 0 || bWords.size === 0) return 0;

  let intersection = 0;
  for (const word of aWords) {
    if (bWords.has(word)) intersection++;
  }

  const union = aWords.size + bWords.size - intersection;
  return intersection / union; // Jaccard similarity
}

/**
 * Detect relation between two errors
 */
export function detectRelation(
  a: BatchableError,
  b: BatchableError
): ErrorRelation | null {
  // Check same cause first (highest priority)
  if (isSameCause(a, b)) {
    return {
      errorA: a.id,
      errorB: b.id,
      type: "same-cause",
      confidence: 0.9,
      description: `Both errors share the same root cause: ${a.causeId || a.type}`,
    };
  }

  // Check cascading
  if (isCascading(a, b)) {
    return {
      errorA: a.id,
      errorB: b.id,
      type: "cascading",
      confidence: 0.8,
      description: `Error "${b.message.slice(0, 30)}..." cascades from "${a.message.slice(0, 30)}..."`,
    };
  }

  // Check same file
  if (isSameFile(a, b)) {
    return {
      errorA: a.id,
      errorB: b.id,
      type: "same-file",
      confidence: 0.7,
      description: `Both errors occur in ${a.file}`,
    };
  }

  // Check same type
  if (isSameType(a, b)) {
    return {
      errorA: a.id,
      errorB: b.id,
      type: "same-type",
      confidence: 0.5,
      description: `Both are ${a.type} errors`,
    };
  }

  return null;
}

/**
 * Detect all relations between errors
 */
export function detectAllRelations(errors: BatchableError[]): ErrorRelation[] {
  const relations: ErrorRelation[] = [];

  for (let i = 0; i < errors.length; i++) {
    for (let j = i + 1; j < errors.length; j++) {
      const relation = detectRelation(errors[i], errors[j]);
      if (relation) {
        relations.push(relation);
      }
    }
  }

  return relations;
}

/**
 * Check if two fixes conflict
 */
export function detectFixConflict(
  a: BatchableFix,
  b: BatchableFix
): { conflicts: boolean; reason?: string } {
  // Explicit conflict declaration
  if (a.conflictsWith?.includes(b.id) || b.conflictsWith?.includes(a.id)) {
    return { conflicts: true, reason: "Explicitly declared conflict" };
  }

  // Same file, overlapping lines
  if (a.file && b.file && a.file === b.file) {
    if (a.startLine !== undefined && a.endLine !== undefined &&
        b.startLine !== undefined && b.endLine !== undefined) {
      const aStart = a.startLine;
      const aEnd = a.endLine;
      const bStart = b.startLine;
      const bEnd = b.endLine;

      // Check overlap
      if (!(aEnd < bStart || bEnd < aStart)) {
        return {
          conflicts: true,
          reason: `Overlapping line ranges: ${aStart}-${aEnd} and ${bStart}-${bEnd}`,
        };
      }
    }
  }

  return { conflicts: false };
}

/**
 * Sort fixes by dependency order
 */
export function sortFixesByDependency(fixes: BatchableFix[]): BatchableFix[] {
  const sorted: BatchableFix[] = [];
  const remaining = new Set(fixes.map((f) => f.id));
  const fixMap = new Map(fixes.map((f) => [f.id, f]));

  // Topological sort
  while (remaining.size > 0) {
    let added = false;

    for (const id of remaining) {
      const fix = fixMap.get(id)!;
      const deps = fix.dependsOn ?? [];

      // Check if all dependencies are satisfied
      if (deps.every((d) => !remaining.has(d))) {
        sorted.push(fix);
        remaining.delete(id);
        added = true;
      }
    }

    // Circular dependency detected
    if (!added && remaining.size > 0) {
      // Add remaining in priority order
      const rest = Array.from(remaining)
        .map((id) => fixMap.get(id)!)
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      sorted.push(...rest);
      break;
    }
  }

  return sorted;
}

/**
 * Group errors by relation
 */
export function groupErrors(
  errors: BatchableError[],
  relations: ErrorRelation[],
  minConfidence: number = DEFAULT_MIN_CONFIDENCE
): ErrorGroup[] {
  // Filter by confidence
  const validRelations = relations.filter((r) => r.confidence >= minConfidence);

  // Build adjacency list
  const adjacency = new Map<string, Set<string>>();
  const relationMap = new Map<string, ErrorRelation>();

  for (const error of errors) {
    adjacency.set(error.id, new Set());
  }

  for (const relation of validRelations) {
    adjacency.get(relation.errorA)?.add(relation.errorB);
    adjacency.get(relation.errorB)?.add(relation.errorA);
    relationMap.set(`${relation.errorA}-${relation.errorB}`, relation);
    relationMap.set(`${relation.errorB}-${relation.errorA}`, relation);
  }

  // Find connected components (groups)
  const visited = new Set<string>();
  const groups: ErrorGroup[] = [];

  for (const error of errors) {
    if (visited.has(error.id)) continue;

    const component: string[] = [];
    const queue = [error.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      component.push(current);

      const neighbors = adjacency.get(current) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    if (component.length > 1) {
      // Determine group properties
      const componentErrors = component.map(
        (id) => errors.find((e) => e.id === id)!
      );

      // Find primary relation type
      let primaryType: RelationType = "same-type";
      let maxConfidence = 0;
      let sharedFile: string | undefined;
      let sharedCause: string | undefined;

      for (let i = 0; i < component.length; i++) {
        for (let j = i + 1; j < component.length; j++) {
          const key = `${component[i]}-${component[j]}`;
          const relation = relationMap.get(key);
          if (relation && relation.confidence > maxConfidence) {
            maxConfidence = relation.confidence;
            primaryType = relation.type;
          }
        }
      }

      // Extract shared properties
      const files = componentErrors.map((e) => e.file).filter(Boolean);
      if (files.length > 0 && files.every((f) => f === files[0])) {
        sharedFile = files[0];
      }

      const causes = componentErrors.map((e) => e.causeId).filter(Boolean);
      if (causes.length > 0 && causes.every((c) => c === causes[0])) {
        sharedCause = causes[0];
      }

      groups.push({
        id: `grp-${generateId()}`,
        name: sharedCause
          ? `Errors from ${sharedCause}`
          : sharedFile
          ? `Errors in ${sharedFile}`
          : `Related ${primaryType} errors`,
        errorIds: component,
        relationType: primaryType,
        sharedFile,
        sharedCause,
        confidence: maxConfidence,
      });
    }
  }

  return groups;
}

/**
 * Create batched fix from group
 */
export function createBatchedFix(
  group: ErrorGroup,
  fixes: BatchableFix[],
  detectConflicts: boolean = true
): BatchedFix {
  // Get fixes for errors in this group
  const groupFixes = fixes.filter((f) => group.errorIds.includes(f.errorId));

  // Sort by dependency
  const sortedFixes = sortFixesByDependency(groupFixes);

  // Detect conflicts
  const conflicts: string[] = [];
  if (detectConflicts) {
    for (let i = 0; i < sortedFixes.length; i++) {
      for (let j = i + 1; j < sortedFixes.length; j++) {
        const result = detectFixConflict(sortedFixes[i], sortedFixes[j]);
        if (result.conflicts) {
          conflicts.push(
            `${sortedFixes[i].description} conflicts with ${sortedFixes[j].description}: ${result.reason}`
          );
        }
      }
    }
  }

  // Calculate total lines
  let totalLines = 0;
  for (const fix of sortedFixes) {
    if (fix.startLine !== undefined && fix.endLine !== undefined) {
      totalLines += fix.endLine - fix.startLine + 1;
    }
  }

  // Get unique files
  const files = [...new Set(sortedFixes.map((f) => f.file).filter(Boolean))] as string[];

  // Check if order matters (has dependencies)
  const orderMatters = sortedFixes.some((f) => f.dependsOn && f.dependsOn.length > 0);

  return {
    id: `batch-${generateId()}`,
    description: `Batch fix for ${group.name} (${sortedFixes.length} fixes)`,
    groupId: group.id,
    fixes: sortedFixes,
    files,
    totalLinesChanged: totalLines,
    hasConflicts: conflicts.length > 0,
    conflicts,
    orderMatters,
  };
}

// ============================================================================
// MultiFixBatcher Class
// ============================================================================

/**
 * Batcher for related error fixes
 */
export class MultiFixBatcher {
  private minConfidence: number;
  private maxGroupSize: number;
  private detectCascading: boolean;
  private detectConflicts: boolean;
  private disposed = false;

  constructor(options: MultiFixBatcherOptions = {}) {
    this.minConfidence = options.minGroupConfidence ?? DEFAULT_MIN_CONFIDENCE;
    this.maxGroupSize = options.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;
    this.detectCascading = options.detectCascading ?? true;
    this.detectConflicts = options.detectConflicts ?? true;
  }

  /**
   * Batch fixes for related errors
   */
  batch(errors: BatchableError[], fixes: BatchableFix[]): BatchResult {
    if (this.disposed) {
      throw new Error("MultiFixBatcher is disposed");
    }

    // Detect relations
    const relations = detectAllRelations(errors);

    // Group errors
    let groups = groupErrors(errors, relations, this.minConfidence);

    // Enforce max group size
    groups = groups.filter((g) => g.errorIds.length <= this.maxGroupSize);

    // Create batched fixes
    const batches = groups.map((group) =>
      createBatchedFix(group, fixes, this.detectConflicts)
    );

    // Find ungrouped errors
    const groupedErrorIds = new Set(groups.flatMap((g) => g.errorIds));
    const ungroupedErrors = errors
      .filter((e) => !groupedErrorIds.has(e.id))
      .map((e) => e.id);

    // Find unbatched fixes
    const batchedFixIds = new Set(batches.flatMap((b) => b.fixes.map((f) => f.id)));
    const unbatchedFixes = fixes
      .filter((f) => !batchedFixIds.has(f.id))
      .map((f) => f.id);

    // Calculate stats
    const stats: BatchStats = {
      totalErrors: errors.length,
      groupedErrors: groupedErrorIds.size,
      totalGroups: groups.length,
      totalFixes: fixes.length,
      batchedFixes: batchedFixIds.size,
      totalBatches: batches.length,
      groupingRatio: errors.length > 0 ? groupedErrorIds.size / errors.length : 0,
      batchingRatio: fixes.length > 0 ? batchedFixIds.size / fixes.length : 0,
    };

    return {
      groups,
      batches,
      ungroupedErrors,
      unbatchedFixes,
      stats,
    };
  }

  /**
   * Find related errors for a given error
   */
  findRelated(
    error: BatchableError,
    allErrors: BatchableError[]
  ): Array<{ error: BatchableError; relation: ErrorRelation }> {
    if (this.disposed) {
      throw new Error("MultiFixBatcher is disposed");
    }

    const related: Array<{ error: BatchableError; relation: ErrorRelation }> = [];

    for (const other of allErrors) {
      if (other.id === error.id) continue;

      const relation = detectRelation(error, other);
      if (relation && relation.confidence >= this.minConfidence) {
        related.push({ error: other, relation });
      }
    }

    // Sort by confidence
    return related.sort((a, b) => b.relation.confidence - a.relation.confidence);
  }

  /**
   * Group errors by file
   */
  groupByFile(errors: BatchableError[]): Map<string, BatchableError[]> {
    const byFile = new Map<string, BatchableError[]>();

    for (const error of errors) {
      if (error.file) {
        const list = byFile.get(error.file) ?? [];
        list.push(error);
        byFile.set(error.file, list);
      }
    }

    return byFile;
  }

  /**
   * Group errors by cause
   */
  groupByCause(errors: BatchableError[]): Map<string, BatchableError[]> {
    const byCause = new Map<string, BatchableError[]>();

    for (const error of errors) {
      const cause = error.causeId ?? error.type ?? "unknown";
      const list = byCause.get(cause) ?? [];
      list.push(error);
      byCause.set(cause, list);
    }

    return byCause;
  }

  /**
   * Merge multiple batches if they share files
   */
  mergeBatches(batches: BatchedFix[]): BatchedFix[] {
    if (batches.length <= 1) return batches;

    // Group by shared files
    const merged: BatchedFix[] = [];
    const used = new Set<string>();

    for (const batch of batches) {
      if (used.has(batch.id)) continue;

      // Find batches that share files
      const toMerge = [batch];
      used.add(batch.id);

      for (const other of batches) {
        if (used.has(other.id)) continue;

        const sharedFiles = batch.files.filter((f) => other.files.includes(f));
        if (sharedFiles.length > 0) {
          toMerge.push(other);
          used.add(other.id);
        }
      }

      if (toMerge.length === 1) {
        merged.push(batch);
      } else {
        // Merge batches
        const allFixes = toMerge.flatMap((b) => b.fixes);
        const allFiles = [...new Set(toMerge.flatMap((b) => b.files))];
        const allConflicts = toMerge.flatMap((b) => b.conflicts);
        const totalLines = toMerge.reduce((sum, b) => sum + b.totalLinesChanged, 0);

        merged.push({
          id: `batch-merged-${generateId()}`,
          description: `Merged batch (${toMerge.length} groups, ${allFixes.length} fixes)`,
          groupId: toMerge[0].groupId,
          fixes: sortFixesByDependency(allFixes),
          files: allFiles,
          totalLinesChanged: totalLines,
          hasConflicts: allConflicts.length > 0,
          conflicts: allConflicts,
          orderMatters: toMerge.some((b) => b.orderMatters),
        });
      }
    }

    return merged;
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MultiFixBatcher instance
 */
export function createMultiFixBatcher(
  options?: MultiFixBatcherOptions
): MultiFixBatcher {
  return new MultiFixBatcher(options);
}

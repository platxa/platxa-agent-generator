/**
 * Incremental Analyzer
 *
 * Analyzes only changed files to minimize redundant work.
 * Tracks file states using hashes and modification times,
 * and maintains a dependency graph to determine affected files.
 *
 * @module incremental-analyzer
 */

import type {
  Language,
  NormalizedError,
  ModuleAnalysisResult,
  AnalysisContext,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * File change type
 */
export type FileChangeType = 'added' | 'modified' | 'deleted' | 'unchanged';

/**
 * File state
 */
export interface FileState {
  /** File path */
  path: string;
  /** Content hash */
  hash: string;
  /** Last modification time */
  mtime: number;
  /** File size */
  size: number;
  /** Detected language */
  language: Language;
  /** Last analysis timestamp */
  lastAnalyzedAt?: Date;
  /** Dependencies (files this file imports/requires) */
  dependencies: string[];
  /** Dependents (files that import/require this file) */
  dependents: string[];
}

/**
 * File change
 */
export interface FileChange {
  /** File path */
  path: string;
  /** Change type */
  type: FileChangeType;
  /** Previous state */
  previousState?: FileState;
  /** Current state */
  currentState?: FileState;
  /** Whether this is a direct change or affected by dependency */
  isDirect: boolean;
}

/**
 * Change set
 */
export interface ChangeSet {
  /** Direct file changes */
  directChanges: FileChange[];
  /** Affected files (via dependencies) */
  affectedFiles: FileChange[];
  /** All files to analyze */
  filesToAnalyze: string[];
  /** Summary */
  summary: {
    added: number;
    modified: number;
    deleted: number;
    affected: number;
    total: number;
  };
}

/**
 * Incremental analysis result
 */
export interface IncrementalAnalysisResult {
  /** Analysis results by file */
  resultsByFile: Map<string, ModuleAnalysisResult>;
  /** Files that were skipped (unchanged) */
  skippedFiles: string[];
  /** Files that were analyzed */
  analyzedFiles: string[];
  /** Errors found */
  errors: NormalizedError[];
  /** Total time saved (estimated ms) */
  timeSavedMs: number;
  /** Analysis time */
  analysisTimeMs: number;
}

/**
 * Dependency resolver function
 */
export type DependencyResolver = (
  filePath: string,
  content: string,
  language: Language
) => string[];

/**
 * Incremental analyzer configuration
 */
export interface IncrementalAnalyzerConfig {
  /** Enable dependency tracking */
  trackDependencies: boolean;
  /** Include affected files in analysis */
  analyzeAffectedFiles: boolean;
  /** Maximum dependency depth */
  maxDependencyDepth: number;
  /** Use modification time for quick checks */
  useMtime: boolean;
  /** Average analysis time per file (ms) for time-saved estimation */
  avgAnalysisTimeMs: number;
  /** Verbose logging */
  verbose: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: IncrementalAnalyzerConfig = {
  trackDependencies: true,
  analyzeAffectedFiles: true,
  maxDependencyDepth: 5,
  useMtime: true,
  avgAnalysisTimeMs: 500,
  verbose: false,
};

// =============================================================================
// Hash Function
// =============================================================================

/**
 * Simple string hash using djb2 algorithm
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// =============================================================================
// Default Dependency Resolvers
// =============================================================================

const DEFAULT_DEPENDENCY_RESOLVERS: Record<Language, DependencyResolver> = {
  python: (filePath, content) => {
    const deps: string[] = [];
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    // Match import statements
    const importPatterns = [
      /^import\s+(\w+)/gm,
      /^from\s+([.\w]+)\s+import/gm,
    ];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const module = match[1];
        if (module) {
          // Convert module path to file path
          if (module.startsWith('.')) {
            const relativePath = module.replace(/\./g, '/') + '.py';
            deps.push(`${dir}/${relativePath}`);
          }
        }
      }
    }

    return deps;
  },

  javascript: (filePath, content) => {
    const deps: string[] = [];
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    // Match require and import statements
    const patterns = [
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
      /import\s*['"]([^'"]+)['"]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const module = match[1];
        if (module && module.startsWith('.')) {
          let resolved = `${dir}/${module}`;
          if (!resolved.match(/\.(js|jsx|ts|tsx|mjs|cjs)$/)) {
            resolved += '.js';
          }
          deps.push(resolved);
        }
      }
    }

    return deps;
  },

  typescript: (filePath, content, language) => {
    // TypeScript uses same patterns as JavaScript
    return DEFAULT_DEPENDENCY_RESOLVERS.javascript(filePath, content, language).map(
      (dep) => dep.replace(/\.js$/, '.ts')
    );
  },

  css: (filePath, content) => {
    const deps: string[] = [];
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    // Match @import statements
    const pattern = /@import\s+(?:url\s*\(\s*)?['"]?([^'")\s]+)['"]?\)?/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const imported = match[1];
      if (imported && !imported.startsWith('http')) {
        deps.push(`${dir}/${imported}`);
      }
    }

    return deps;
  },

  scss: (filePath, content) => {
    const deps: string[] = [];
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));

    // Match @import and @use statements
    const patterns = [
      /@import\s+['"]([^'"]+)['"]/g,
      /@use\s+['"]([^'"]+)['"]/g,
      /@forward\s+['"]([^'"]+)['"]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const imported = match[1];
        if (imported) {
          let resolved = `${dir}/${imported}`;
          if (!resolved.endsWith('.scss') && !resolved.endsWith('.css')) {
            resolved += '.scss';
          }
          deps.push(resolved);
        }
      }
    }

    return deps;
  },

  tailwind: () => [],
  html: () => [],
  json: () => [],
  yaml: () => [],
  markdown: () => [],
  unknown: () => [],
};

// =============================================================================
// Incremental Analyzer Class
// =============================================================================

/**
 * Incremental Analyzer
 *
 * Tracks file changes and analyzes only modified files and their dependents.
 */
export class IncrementalAnalyzer {
  private config: IncrementalAnalyzerConfig;
  private fileStates: Map<string, FileState>;
  private dependencyResolvers: Map<Language, DependencyResolver>;
  private analysisFunction:
    | ((files: string[], context: AnalysisContext) => Promise<ModuleAnalysisResult[]>)
    | null;

  constructor(config: Partial<IncrementalAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fileStates = new Map();
    this.dependencyResolvers = new Map(
      Object.entries(DEFAULT_DEPENDENCY_RESOLVERS) as [Language, DependencyResolver][]
    );
    this.analysisFunction = null;
  }

  /**
   * Set the analysis function to use
   */
  setAnalysisFunction(
    fn: (files: string[], context: AnalysisContext) => Promise<ModuleAnalysisResult[]>
  ): void {
    this.analysisFunction = fn;
  }

  /**
   * Register a custom dependency resolver
   */
  registerDependencyResolver(
    language: Language,
    resolver: DependencyResolver
  ): void {
    this.dependencyResolvers.set(language, resolver);
  }

  /**
   * Update file state
   */
  updateFileState(
    path: string,
    content: string,
    language: Language,
    mtime?: number
  ): FileState {
    const hash = hashString(content);
    const size = content.length;

    // Resolve dependencies if tracking is enabled
    let dependencies: string[] = [];
    if (this.config.trackDependencies) {
      const resolver = this.dependencyResolvers.get(language);
      if (resolver) {
        dependencies = resolver(path, content, language);
      }
    }

    const state: FileState = {
      path,
      hash,
      mtime: mtime ?? Date.now(),
      size,
      language,
      dependencies,
      dependents: [],
    };

    // Update dependents of dependencies
    for (const dep of dependencies) {
      const depState = this.fileStates.get(dep);
      if (depState && !depState.dependents.includes(path)) {
        depState.dependents.push(path);
      }
    }

    // Remove from old dependencies' dependents
    const oldState = this.fileStates.get(path);
    if (oldState) {
      for (const oldDep of oldState.dependencies) {
        if (!dependencies.includes(oldDep)) {
          const depState = this.fileStates.get(oldDep);
          if (depState) {
            depState.dependents = depState.dependents.filter((d) => d !== path);
          }
        }
      }
    }

    this.fileStates.set(path, state);
    return state;
  }

  /**
   * Remove file from tracking
   */
  removeFile(path: string): void {
    const state = this.fileStates.get(path);
    if (state) {
      // Update dependents of our dependencies
      for (const dep of state.dependencies) {
        const depState = this.fileStates.get(dep);
        if (depState) {
          depState.dependents = depState.dependents.filter((d) => d !== path);
        }
      }
      this.fileStates.delete(path);
    }
  }

  /**
   * Check if file has changed
   */
  hasFileChanged(path: string, content: string, mtime?: number): boolean {
    const state = this.fileStates.get(path);
    if (!state) {
      return true; // New file
    }

    // Quick check using mtime if enabled
    if (this.config.useMtime && mtime !== undefined) {
      if (mtime <= state.mtime) {
        return false;
      }
    }

    // Hash check
    return hashString(content) !== state.hash;
  }

  /**
   * Detect changes in a set of files
   */
  detectChanges(
    currentFiles: Map<string, { content: string; language: Language; mtime?: number }>
  ): ChangeSet {
    const directChanges: FileChange[] = [];
    const currentPaths = new Set(currentFiles.keys());
    const previousPaths = new Set(this.fileStates.keys());

    // Check for added and modified files
    for (const [path, file] of currentFiles) {
      const previousState = this.fileStates.get(path);

      if (!previousState) {
        // Added file
        directChanges.push({
          path,
          type: 'added',
          currentState: this.createTempState(path, file.content, file.language, file.mtime),
          isDirect: true,
        });
      } else if (this.hasFileChanged(path, file.content, file.mtime)) {
        // Modified file
        directChanges.push({
          path,
          type: 'modified',
          previousState,
          currentState: this.createTempState(path, file.content, file.language, file.mtime),
          isDirect: true,
        });
      }
    }

    // Check for deleted files
    for (const path of previousPaths) {
      if (!currentPaths.has(path)) {
        const previousState = this.fileStates.get(path);
        const change: FileChange = {
          path,
          type: 'deleted',
          isDirect: true,
        };
        if (previousState) {
          change.previousState = previousState;
        }
        directChanges.push(change);
      }
    }

    // Find affected files
    const affectedFiles: FileChange[] = [];
    if (this.config.analyzeAffectedFiles) {
      const affectedPaths = this.findAffectedFiles(
        directChanges.map((c) => c.path)
      );

      for (const affectedPath of affectedPaths) {
        const directChange = directChanges.find((c) => c.path === affectedPath);
        if (!directChange) {
          const state = this.fileStates.get(affectedPath);
          if (state) {
            affectedFiles.push({
              path: affectedPath,
              type: 'unchanged',
              previousState: state,
              currentState: state,
              isDirect: false,
            });
          }
        }
      }
    }

    // Compile files to analyze
    const filesToAnalyze = [
      ...directChanges.filter((c) => c.type !== 'deleted').map((c) => c.path),
      ...affectedFiles.map((c) => c.path),
    ];

    return {
      directChanges,
      affectedFiles,
      filesToAnalyze,
      summary: {
        added: directChanges.filter((c) => c.type === 'added').length,
        modified: directChanges.filter((c) => c.type === 'modified').length,
        deleted: directChanges.filter((c) => c.type === 'deleted').length,
        affected: affectedFiles.length,
        total: filesToAnalyze.length,
      },
    };
  }

  /**
   * Find files affected by changes (via dependency graph)
   */
  private findAffectedFiles(changedPaths: string[]): Set<string> {
    const affected = new Set<string>();
    const visited = new Set<string>();

    const traverse = (path: string, depth: number): void => {
      if (
        depth > this.config.maxDependencyDepth ||
        visited.has(path)
      ) {
        return;
      }
      visited.add(path);

      const state = this.fileStates.get(path);
      if (state) {
        for (const dependent of state.dependents) {
          affected.add(dependent);
          traverse(dependent, depth + 1);
        }
      }
    };

    for (const path of changedPaths) {
      traverse(path, 0);
    }

    return affected;
  }

  /**
   * Create temporary state without storing
   */
  private createTempState(
    path: string,
    content: string,
    language: Language,
    mtime?: number
  ): FileState {
    const hash = hashString(content);
    let dependencies: string[] = [];

    if (this.config.trackDependencies) {
      const resolver = this.dependencyResolvers.get(language);
      if (resolver) {
        dependencies = resolver(path, content, language);
      }
    }

    return {
      path,
      hash,
      mtime: mtime ?? Date.now(),
      size: content.length,
      language,
      dependencies,
      dependents: [],
    };
  }

  /**
   * Perform incremental analysis
   */
  async analyze(
    currentFiles: Map<string, { content: string; language: Language; mtime?: number }>,
    context: AnalysisContext
  ): Promise<IncrementalAnalysisResult> {
    if (!this.analysisFunction) {
      throw new Error('No analysis function set. Call setAnalysisFunction first.');
    }

    const startTime = Date.now();

    // Detect changes
    const changeSet = this.detectChanges(currentFiles);

    // Skip if no changes
    if (changeSet.filesToAnalyze.length === 0) {
      return {
        resultsByFile: new Map(),
        skippedFiles: Array.from(currentFiles.keys()),
        analyzedFiles: [],
        errors: [],
        timeSavedMs: currentFiles.size * this.config.avgAnalysisTimeMs,
        analysisTimeMs: Date.now() - startTime,
      };
    }

    // Run analysis on changed files
    const results = await this.analysisFunction(changeSet.filesToAnalyze, context);

    // Update file states for analyzed files
    for (const change of changeSet.directChanges) {
      if (change.type === 'deleted') {
        this.removeFile(change.path);
      } else if (change.currentState) {
        const file = currentFiles.get(change.path);
        if (file) {
          const state = this.updateFileState(
            change.path,
            file.content,
            file.language,
            file.mtime
          );
          state.lastAnalyzedAt = new Date();
        }
      }
    }

    // Collect results
    const resultsByFile = new Map<string, ModuleAnalysisResult>();
    const errors: NormalizedError[] = [];

    for (const result of results) {
      // Map results to files
      for (const error of result.errors) {
        if (error.location?.file) {
          const existing = resultsByFile.get(error.location.file);
          if (existing) {
            existing.errors.push(error);
          } else {
            resultsByFile.set(error.location.file, {
              ...result,
              errors: [error],
            });
          }
        }
        errors.push(error);
      }
    }

    // Calculate skipped files
    const analyzedSet = new Set(changeSet.filesToAnalyze);
    const skippedFiles = Array.from(currentFiles.keys()).filter(
      (f) => !analyzedSet.has(f)
    );

    // Estimate time saved
    const timeSavedMs = skippedFiles.length * this.config.avgAnalysisTimeMs;

    return {
      resultsByFile,
      skippedFiles,
      analyzedFiles: changeSet.filesToAnalyze,
      errors,
      timeSavedMs,
      analysisTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get file state
   */
  getFileState(path: string): FileState | undefined {
    return this.fileStates.get(path);
  }

  /**
   * Get all tracked files
   */
  getTrackedFiles(): string[] {
    return Array.from(this.fileStates.keys());
  }

  /**
   * Get dependency graph for a file
   */
  getDependencyGraph(path: string, depth: number = 3): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();

    const traverse = (currentPath: string, currentDepth: number): void => {
      if (currentDepth > depth || visited.has(currentPath)) {
        return;
      }
      visited.add(currentPath);

      const state = this.fileStates.get(currentPath);
      if (state) {
        graph.set(currentPath, state.dependencies);
        for (const dep of state.dependencies) {
          traverse(dep, currentDepth + 1);
        }
      }
    };

    traverse(path, 0);
    return graph;
  }

  /**
   * Get reverse dependency graph for a file
   */
  getReverseDependencyGraph(path: string, depth: number = 3): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();

    const traverse = (currentPath: string, currentDepth: number): void => {
      if (currentDepth > depth || visited.has(currentPath)) {
        return;
      }
      visited.add(currentPath);

      const state = this.fileStates.get(currentPath);
      if (state) {
        graph.set(currentPath, state.dependents);
        for (const dep of state.dependents) {
          traverse(dep, currentDepth + 1);
        }
      }
    };

    traverse(path, 0);
    return graph;
  }

  /**
   * Clear all tracked states
   */
  clear(): void {
    this.fileStates.clear();
  }

  /**
   * Get analyzer statistics
   */
  getStats(): {
    trackedFiles: number;
    totalDependencies: number;
    avgDependenciesPerFile: number;
    filesNeedingAnalysis: number;
  } {
    let totalDependencies = 0;
    let staleFiles = 0;
    const now = Date.now();

    for (const state of this.fileStates.values()) {
      totalDependencies += state.dependencies.length;
      if (
        !state.lastAnalyzedAt ||
        now - state.lastAnalyzedAt.getTime() > 3600000
      ) {
        staleFiles++;
      }
    }

    return {
      trackedFiles: this.fileStates.size,
      totalDependencies,
      avgDependenciesPerFile:
        this.fileStates.size > 0
          ? totalDependencies / this.fileStates.size
          : 0,
      filesNeedingAnalysis: staleFiles,
    };
  }

  /**
   * Export state for persistence
   */
  exportState(): Map<string, FileState> {
    return new Map(this.fileStates);
  }

  /**
   * Import state from persistence
   */
  importState(state: Map<string, FileState>): void {
    this.fileStates = new Map(state);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an incremental analyzer
 */
export function createIncrementalAnalyzer(
  config?: Partial<IncrementalAnalyzerConfig>
): IncrementalAnalyzer {
  return new IncrementalAnalyzer(config);
}

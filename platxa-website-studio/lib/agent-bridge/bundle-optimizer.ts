/**
 * Bundle Size Optimization
 *
 * Provides utilities for tree shaking and code splitting to keep
 * the main bundle under 300KB with dynamic imports for heavy features.
 */

// ============================================================================
// Types
// ============================================================================

export interface BundleChunk {
  readonly name: string;
  readonly modules: readonly string[];
  readonly size: number;
  readonly isEntry: boolean;
  readonly isDynamic: boolean;
}

export interface BundleAnalysis {
  readonly totalSize: number;
  readonly mainBundleSize: number;
  readonly chunks: readonly BundleChunk[];
  readonly dynamicImports: readonly DynamicImportInfo[];
  readonly treeShakingResults: TreeShakingResults;
  readonly recommendations: readonly string[];
  readonly passesThreshold: boolean;
}

export interface DynamicImportInfo {
  readonly modulePath: string;
  readonly chunkName: string;
  readonly estimatedSize: number;
  readonly loadTrigger: LoadTrigger;
  readonly priority: ImportPriority;
}

export type LoadTrigger =
  | 'user-interaction'
  | 'route-change'
  | 'viewport-visible'
  | 'idle'
  | 'prefetch';

export type ImportPriority = 'critical' | 'high' | 'medium' | 'low';

export interface TreeShakingResults {
  readonly originalSize: number;
  readonly optimizedSize: number;
  readonly removedExports: readonly string[];
  readonly sideEffectModules: readonly string[];
  readonly savings: number;
  readonly savingsPercent: number;
}

export interface CodeSplitConfig {
  readonly maxChunkSize: number;
  readonly minChunkSize: number;
  readonly splitVendors: boolean;
  readonly vendorChunks: readonly VendorChunkConfig[];
  readonly dynamicImportPatterns: readonly DynamicImportPattern[];
}

export interface VendorChunkConfig {
  readonly name: string;
  readonly test: RegExp;
  readonly priority: number;
}

export interface DynamicImportPattern {
  readonly pattern: RegExp;
  readonly chunkName: string;
  readonly loadTrigger: LoadTrigger;
}

export interface OptimizationResult {
  readonly success: boolean;
  readonly analysis: BundleAnalysis;
  readonly appliedOptimizations: readonly AppliedOptimization[];
  readonly warnings: readonly string[];
}

export interface AppliedOptimization {
  readonly type: OptimizationType;
  readonly description: string;
  readonly sizeSaved: number;
  readonly affectedModules: readonly string[];
}

export type OptimizationType =
  | 'tree-shaking'
  | 'code-splitting'
  | 'dynamic-import'
  | 'vendor-extraction'
  | 'dead-code-elimination'
  | 'module-concatenation';

// ============================================================================
// Constants
// ============================================================================

const MAIN_BUNDLE_THRESHOLD = 300 * 1024; // 300KB

const DEFAULT_CODE_SPLIT_CONFIG: CodeSplitConfig = {
  maxChunkSize: 250 * 1024,
  minChunkSize: 20 * 1024,
  splitVendors: true,
  vendorChunks: [
    // Flexible regex: matches with or without leading separator (e.g., /node_modules/ or node_modules/)
    { name: 'react-vendor', test: /(?:^|[\\/])node_modules[\\/](react|react-dom)[\\/]/, priority: 20 },
    { name: 'monaco-vendor', test: /(?:^|[\\/])node_modules[\\/]monaco-editor[\\/]/, priority: 15 },
    { name: 'utils-vendor', test: /(?:^|[\\/])node_modules[\\/](lodash|date-fns|uuid)[\\/]/, priority: 10 },
  ],
  dynamicImportPatterns: [
    // Flexible patterns: match module names in various path formats
    { pattern: /monaco/, chunkName: 'monaco', loadTrigger: 'user-interaction' },
    { pattern: /device-frame/, chunkName: 'device-frames', loadTrigger: 'viewport-visible' },
    { pattern: /diff-viewer/, chunkName: 'diff-viewer', loadTrigger: 'user-interaction' },
    { pattern: /chart|graph/, chunkName: 'charts', loadTrigger: 'viewport-visible' },
    { pattern: /pdf|document/, chunkName: 'documents', loadTrigger: 'user-interaction' },
  ],
};

const HEAVY_MODULES = new Map<string, number>([
  ['monaco-editor', 2500 * 1024],
  ['@monaco-editor/react', 50 * 1024],
  ['react-dom', 130 * 1024],
  ['lodash', 70 * 1024],
  ['date-fns', 80 * 1024],
  ['chart.js', 200 * 1024],
  ['framer-motion', 150 * 1024],
  ['three', 600 * 1024],
  ['pdf-lib', 300 * 1024],
]);

// ============================================================================
// State
// ============================================================================

interface BundleOptimizerState {
  readonly config: CodeSplitConfig;
  readonly moduleGraph: Map<string, ModuleNode>;
  readonly chunks: Map<string, BundleChunk>;
  readonly analysisCache: BundleAnalysis | null;
}

interface ModuleNode {
  readonly path: string;
  readonly size: number;
  readonly imports: readonly string[];
  readonly exports: readonly string[];
  readonly usedExports: readonly string[];
  readonly hasSideEffects: boolean;
  readonly isDynamicImport: boolean;
  readonly dynamicImportInfo: DynamicImportInfo | null;
}

let state: BundleOptimizerState = {
  config: DEFAULT_CODE_SPLIT_CONFIG,
  moduleGraph: new Map(),
  chunks: new Map(),
  analysisCache: null,
};

// ============================================================================
// Configuration
// ============================================================================

export function configureCodeSplitting(config: Partial<CodeSplitConfig>): CodeSplitConfig {
  const newConfig: CodeSplitConfig = {
    ...state.config,
    ...config,
    vendorChunks: config.vendorChunks ?? state.config.vendorChunks,
    dynamicImportPatterns: config.dynamicImportPatterns ?? state.config.dynamicImportPatterns,
  };

  state = {
    ...state,
    config: newConfig,
    analysisCache: null,
  };

  return newConfig;
}

export function getCodeSplitConfig(): CodeSplitConfig {
  return state.config;
}

// ============================================================================
// Module Graph
// ============================================================================

export function registerModule(
  path: string,
  size: number,
  imports: readonly string[],
  exports: readonly string[],
  hasSideEffects: boolean = false
): ModuleNode {
  const node: ModuleNode = {
    path,
    size,
    imports,
    exports,
    usedExports: [],
    hasSideEffects,
    isDynamicImport: false,
    dynamicImportInfo: null,
  };

  const newGraph = new Map(state.moduleGraph);
  newGraph.set(path, node);

  state = {
    ...state,
    moduleGraph: newGraph,
    analysisCache: null,
  };

  return node;
}

export function markExportUsed(modulePath: string, exportName: string): boolean {
  const module = state.moduleGraph.get(modulePath);
  if (!module) {
    return false;
  }

  if (!module.exports.includes(exportName)) {
    return false;
  }

  if (module.usedExports.includes(exportName)) {
    return true;
  }

  const updatedModule: ModuleNode = {
    ...module,
    usedExports: [...module.usedExports, exportName],
  };

  const newGraph = new Map(state.moduleGraph);
  newGraph.set(modulePath, updatedModule);

  state = {
    ...state,
    moduleGraph: newGraph,
    analysisCache: null,
  };

  return true;
}

export function markAsDynamicImport(modulePath: string): boolean {
  const module = state.moduleGraph.get(modulePath);
  if (!module) {
    return false;
  }

  // Already marked - no need to update
  if (module.isDynamicImport) {
    return true;
  }

  const updatedModule: ModuleNode = {
    ...module,
    isDynamicImport: true,
    // Preserve existing dynamicImportInfo if set
    dynamicImportInfo: module.dynamicImportInfo,
  };

  const newGraph = new Map(state.moduleGraph);
  newGraph.set(modulePath, updatedModule);

  state = {
    ...state,
    moduleGraph: newGraph,
    analysisCache: null,
  };

  return true;
}

// ============================================================================
// Tree Shaking
// ============================================================================

export function analyzeTreeShaking(): TreeShakingResults {
  let originalSize = 0;
  let optimizedSize = 0;
  const removedExports: string[] = [];
  const sideEffectModules: string[] = [];

  for (const [path, module] of state.moduleGraph) {
    originalSize += module.size;

    if (module.hasSideEffects) {
      sideEffectModules.push(path);
      optimizedSize += module.size;
      continue;
    }

    const unusedExports = module.exports.filter(
      exp => !module.usedExports.includes(exp)
    );

    if (unusedExports.length > 0) {
      removedExports.push(...unusedExports.map(exp => `${path}:${exp}`));
    }

    // Estimate size reduction based on unused exports
    const usedRatio = module.exports.length > 0
      ? module.usedExports.length / module.exports.length
      : 1;

    optimizedSize += Math.ceil(module.size * usedRatio);
  }

  const savings = originalSize - optimizedSize;
  const savingsPercent = originalSize > 0 ? (savings / originalSize) * 100 : 0;

  return {
    originalSize,
    optimizedSize,
    removedExports,
    sideEffectModules,
    savings,
    savingsPercent: Math.round(savingsPercent * 100) / 100,
  };
}

export function getUnusedExports(modulePath: string): readonly string[] {
  const module = state.moduleGraph.get(modulePath);
  if (!module) {
    return [];
  }

  return module.exports.filter(exp => !module.usedExports.includes(exp));
}

// ============================================================================
// Code Splitting
// ============================================================================

export function createChunk(
  name: string,
  modules: readonly string[],
  isEntry: boolean = false,
  isDynamic: boolean = false
): BundleChunk {
  let size = 0;

  for (const modulePath of modules) {
    const module = state.moduleGraph.get(modulePath);
    if (module) {
      size += module.size;
    } else {
      // Check if it's a known heavy module
      for (const [pattern, moduleSize] of HEAVY_MODULES) {
        if (modulePath.includes(pattern)) {
          size += moduleSize;
          break;
        }
      }
    }
  }

  const chunk: BundleChunk = {
    name,
    modules,
    size,
    isEntry,
    isDynamic,
  };

  const newChunks = new Map(state.chunks);
  newChunks.set(name, chunk);

  state = {
    ...state,
    chunks: newChunks,
    analysisCache: null,
  };

  return chunk;
}

export function splitChunk(chunkName: string, splitPoint: number): readonly BundleChunk[] {
  const chunk = state.chunks.get(chunkName);
  if (!chunk || chunk.modules.length <= 1) {
    return chunk ? [chunk] : [];
  }

  const modules1 = chunk.modules.slice(0, splitPoint);
  const modules2 = chunk.modules.slice(splitPoint);

  const chunk1 = createChunk(`${chunkName}-1`, modules1, chunk.isEntry, chunk.isDynamic);
  const chunk2 = createChunk(`${chunkName}-2`, modules2, false, true);

  // Remove original chunk
  const newChunks = new Map(state.chunks);
  newChunks.delete(chunkName);

  state = {
    ...state,
    chunks: newChunks,
  };

  return [chunk1, chunk2];
}

export function extractVendorChunk(modulePath: string): string | null {
  for (const vendorConfig of state.config.vendorChunks) {
    if (vendorConfig.test.test(modulePath)) {
      return vendorConfig.name;
    }
  }
  return null;
}

// ============================================================================
// Dynamic Imports
// ============================================================================

export function createDynamicImport(
  modulePath: string,
  loadTrigger: LoadTrigger = 'user-interaction',
  priority: ImportPriority = 'medium'
): DynamicImportInfo {
  let chunkName = 'dynamic';
  let finalLoadTrigger = loadTrigger;

  // Find matching pattern (only override if using defaults)
  for (const pattern of state.config.dynamicImportPatterns) {
    if (pattern.pattern.test(modulePath)) {
      chunkName = pattern.chunkName;
      // Only use pattern's loadTrigger if caller used default
      if (loadTrigger === 'user-interaction') {
        finalLoadTrigger = pattern.loadTrigger;
      }
      break;
    }
  }

  // Estimate size
  let estimatedSize = 50 * 1024; // Default 50KB
  for (const [pattern, size] of HEAVY_MODULES) {
    if (modulePath.includes(pattern)) {
      estimatedSize = size;
      break;
    }
  }

  const info: DynamicImportInfo = {
    modulePath,
    chunkName,
    estimatedSize,
    loadTrigger: finalLoadTrigger,
    priority,
  };

  // Store the info in module node for later retrieval
  const module = state.moduleGraph.get(modulePath);
  if (module) {
    const updatedModule: ModuleNode = {
      ...module,
      isDynamicImport: true,
      dynamicImportInfo: info,
    };

    const newGraph = new Map(state.moduleGraph);
    newGraph.set(modulePath, updatedModule);

    state = {
      ...state,
      moduleGraph: newGraph,
      analysisCache: null,
    };
  } else {
    // Module not registered yet - just mark as dynamic via markAsDynamicImport
    markAsDynamicImport(modulePath);
  }

  return info;
}

export function getDynamicImportCode(modulePath: string, chunkName?: string): string {
  const webpackChunkName = chunkName ?? modulePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'chunk';
  return `import(/* webpackChunkName: "${webpackChunkName}" */ '${modulePath}')`;
}

export function shouldDynamicImport(modulePath: string, currentBundleSize: number): boolean {
  // Always dynamic import heavy modules
  for (const [pattern, size] of HEAVY_MODULES) {
    if (modulePath.includes(pattern) && size > 100 * 1024) {
      return true;
    }
  }

  // Check if current bundle is approaching threshold
  if (currentBundleSize > MAIN_BUNDLE_THRESHOLD * 0.8) {
    return true;
  }

  // Check dynamic import patterns
  for (const pattern of state.config.dynamicImportPatterns) {
    if (pattern.pattern.test(modulePath)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Bundle Analysis
// ============================================================================

export function analyzeBundle(): BundleAnalysis {
  if (state.analysisCache) {
    return state.analysisCache;
  }

  const chunks = Array.from(state.chunks.values());
  const treeShakingResults = analyzeTreeShaking();

  let totalSize = 0;
  let mainBundleSize = 0;
  const dynamicImports: DynamicImportInfo[] = [];

  for (const chunk of chunks) {
    totalSize += chunk.size;
    if (chunk.isEntry && !chunk.isDynamic) {
      mainBundleSize += chunk.size;
    }
  }

  // Collect dynamic import info - use stored info if available to preserve priority
  for (const [path, module] of state.moduleGraph) {
    if (module.isDynamicImport) {
      if (module.dynamicImportInfo) {
        // Use stored info to preserve priority and other settings
        dynamicImports.push(module.dynamicImportInfo);
      } else {
        // Fallback: create new info with defaults
        dynamicImports.push(createDynamicImport(path));
      }
    }
  }

  const recommendations = generateRecommendations(mainBundleSize, chunks, treeShakingResults);
  const passesThreshold = mainBundleSize <= MAIN_BUNDLE_THRESHOLD;

  const analysis: BundleAnalysis = {
    totalSize,
    mainBundleSize,
    chunks,
    dynamicImports,
    treeShakingResults,
    recommendations,
    passesThreshold,
  };

  state = {
    ...state,
    analysisCache: analysis,
  };

  return analysis;
}

function generateRecommendations(
  mainBundleSize: number,
  chunks: readonly BundleChunk[],
  treeShaking: TreeShakingResults
): readonly string[] {
  const recommendations: string[] = [];

  if (mainBundleSize > MAIN_BUNDLE_THRESHOLD) {
    recommendations.push(
      `Main bundle (${formatSize(mainBundleSize)}) exceeds ${formatSize(MAIN_BUNDLE_THRESHOLD)} threshold. ` +
      `Consider dynamic imports for heavy features.`
    );
  }

  if (treeShaking.savingsPercent > 20) {
    recommendations.push(
      `Tree shaking can save ${treeShaking.savingsPercent}% (${formatSize(treeShaking.savings)}). ` +
      `Ensure sideEffects:false in package.json.`
    );
  }

  if (treeShaking.sideEffectModules.length > 5) {
    recommendations.push(
      `${treeShaking.sideEffectModules.length} modules have side effects. ` +
      `Review and mark pure modules appropriately.`
    );
  }

  for (const chunk of chunks) {
    if (chunk.size > state.config.maxChunkSize && !chunk.isEntry) {
      recommendations.push(
        `Chunk "${chunk.name}" (${formatSize(chunk.size)}) exceeds max size. ` +
        `Consider splitting further.`
      );
    }
  }

  return recommendations;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================================================
// Optimization
// ============================================================================

export function optimizeBundle(): OptimizationResult {
  const appliedOptimizations: AppliedOptimization[] = [];
  const warnings: string[] = [];

  // Apply tree shaking
  const treeShaking = analyzeTreeShaking();
  if (treeShaking.savings > 0) {
    appliedOptimizations.push({
      type: 'tree-shaking',
      description: `Removed ${treeShaking.removedExports.length} unused exports`,
      sizeSaved: treeShaking.savings,
      affectedModules: treeShaking.removedExports.map(exp => exp.split(':')[0]),
    });
  }

  // Extract vendor chunks
  const vendorModules: Map<string, string[]> = new Map();
  for (const [path] of state.moduleGraph) {
    const vendorChunk = extractVendorChunk(path);
    if (vendorChunk) {
      const existing = vendorModules.get(vendorChunk) ?? [];
      vendorModules.set(vendorChunk, [...existing, path]);
    }
  }

  for (const [chunkName, modules] of vendorModules) {
    const chunk = createChunk(chunkName, modules, false, false);
    appliedOptimizations.push({
      type: 'vendor-extraction',
      description: `Extracted ${modules.length} modules to ${chunkName}`,
      sizeSaved: 0, // Already accounted for
      affectedModules: modules,
    });
  }

  // Dynamic imports for heavy modules
  for (const [path, module] of state.moduleGraph) {
    if (shouldDynamicImport(path, getMainBundleSize())) {
      if (!module.isDynamicImport) {
        markAsDynamicImport(path);
        appliedOptimizations.push({
          type: 'dynamic-import',
          description: `Converted ${path} to dynamic import`,
          sizeSaved: module.size,
          affectedModules: [path],
        });
      }
    }
  }

  // Check for side effect warnings
  if (treeShaking.sideEffectModules.length > 0) {
    warnings.push(
      `${treeShaking.sideEffectModules.length} modules have side effects and cannot be tree-shaken`
    );
  }

  const analysis = analyzeBundle();

  return {
    success: analysis.passesThreshold,
    analysis,
    appliedOptimizations,
    warnings,
  };
}

function getMainBundleSize(): number {
  let size = 0;
  for (const chunk of state.chunks.values()) {
    if (chunk.isEntry && !chunk.isDynamic) {
      size += chunk.size;
    }
  }
  return size;
}

// ============================================================================
// Webpack Config Helpers
// ============================================================================

export interface WebpackSplitChunksConfig {
  readonly chunks: 'all' | 'async' | 'initial';
  readonly maxSize: number;
  readonly minSize: number;
  readonly cacheGroups: Record<string, {
    readonly test: RegExp;
    readonly name: string;
    readonly priority: number;
    readonly chunks: 'all' | 'async' | 'initial';
  }>;
}

export function generateWebpackSplitChunksConfig(): WebpackSplitChunksConfig {
  const cacheGroups: Record<string, {
    readonly test: RegExp;
    readonly name: string;
    readonly priority: number;
    readonly chunks: 'all' | 'async' | 'initial';
  }> = {};

  for (const vendor of state.config.vendorChunks) {
    cacheGroups[vendor.name] = {
      test: vendor.test,
      name: vendor.name,
      priority: vendor.priority,
      chunks: 'all',
    };
  }

  return {
    chunks: 'all',
    maxSize: state.config.maxChunkSize,
    minSize: state.config.minChunkSize,
    cacheGroups,
  };
}

export function generateDynamicImportHints(): readonly string[] {
  const hints: string[] = [];

  for (const pattern of state.config.dynamicImportPatterns) {
    hints.push(
      `/* Modules matching ${pattern.pattern} should use: */\n` +
      `const Component = lazy(() => import(/* webpackChunkName: "${pattern.chunkName}" */ './path'));`
    );
  }

  return hints;
}

// ============================================================================
// Preload/Prefetch Hints
// ============================================================================

export interface PreloadHint {
  readonly href: string;
  readonly as: 'script' | 'style' | 'font';
  readonly type: 'preload' | 'prefetch' | 'modulepreload';
  readonly crossOrigin?: 'anonymous' | 'use-credentials';
}

export function generatePreloadHints(priority: ImportPriority): readonly PreloadHint[] {
  const hints: PreloadHint[] = [];
  const analysis = analyzeBundle();

  for (const dynamicImport of analysis.dynamicImports) {
    if (dynamicImport.priority === priority ||
        (priority === 'critical' && dynamicImport.priority === 'high')) {
      hints.push({
        href: `/chunks/${dynamicImport.chunkName}.js`,
        as: 'script',
        type: priority === 'critical' ? 'preload' : 'prefetch',
      });
    }
  }

  return hints;
}

// ============================================================================
// Metrics
// ============================================================================

export interface BundleMetrics {
  readonly mainBundleSize: number;
  readonly threshold: number;
  readonly passesThreshold: boolean;
  readonly totalChunks: number;
  readonly dynamicChunks: number;
  readonly treeShakingSavings: number;
  readonly largestChunk: { name: string; size: number } | null;
}

export function getBundleMetrics(): BundleMetrics {
  const analysis = analyzeBundle();
  const chunks = Array.from(state.chunks.values());

  let largestChunk: { name: string; size: number } | null = null;
  for (const chunk of chunks) {
    if (!largestChunk || chunk.size > largestChunk.size) {
      largestChunk = { name: chunk.name, size: chunk.size };
    }
  }

  return {
    mainBundleSize: analysis.mainBundleSize,
    threshold: MAIN_BUNDLE_THRESHOLD,
    passesThreshold: analysis.passesThreshold,
    totalChunks: chunks.length,
    dynamicChunks: chunks.filter(c => c.isDynamic).length,
    treeShakingSavings: analysis.treeShakingResults.savings,
    largestChunk,
  };
}

// ============================================================================
// Reset
// ============================================================================

export function resetBundleOptimizer(): void {
  state = {
    config: DEFAULT_CODE_SPLIT_CONFIG,
    moduleGraph: new Map(),
    chunks: new Map(),
    analysisCache: null,
  };
}

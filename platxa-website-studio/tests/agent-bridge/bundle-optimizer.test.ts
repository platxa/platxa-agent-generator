/**
 * Tests for Bundle Size Optimization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureCodeSplitting,
  getCodeSplitConfig,
  registerModule,
  markExportUsed,
  markAsDynamicImport,
  analyzeTreeShaking,
  getUnusedExports,
  createChunk,
  splitChunk,
  extractVendorChunk,
  createDynamicImport,
  getDynamicImportCode,
  shouldDynamicImport,
  analyzeBundle,
  optimizeBundle,
  generateWebpackSplitChunksConfig,
  generateDynamicImportHints,
  generatePreloadHints,
  getBundleMetrics,
  resetBundleOptimizer,
  type CodeSplitConfig,
  type BundleChunk,
  type DynamicImportInfo,
  type TreeShakingResults,
  type BundleAnalysis,
  type OptimizationResult,
  type BundleMetrics,
} from '../../lib/agent-bridge/bundle-optimizer';

describe('Bundle Optimizer', () => {
  beforeEach(() => {
    resetBundleOptimizer();
  });

  describe('Configuration', () => {
    it('should return default configuration', () => {
      const config = getCodeSplitConfig();

      expect(config.maxChunkSize).toBe(250 * 1024);
      expect(config.minChunkSize).toBe(20 * 1024);
      expect(config.splitVendors).toBe(true);
      expect(config.vendorChunks.length).toBeGreaterThan(0);
      expect(config.dynamicImportPatterns.length).toBeGreaterThan(0);
    });

    it('should allow custom configuration', () => {
      const customConfig = configureCodeSplitting({
        maxChunkSize: 100 * 1024,
        minChunkSize: 10 * 1024,
      });

      expect(customConfig.maxChunkSize).toBe(100 * 1024);
      expect(customConfig.minChunkSize).toBe(10 * 1024);
      expect(customConfig.splitVendors).toBe(true); // Default preserved
    });

    it('should preserve vendor chunks when not overridden', () => {
      const originalConfig = getCodeSplitConfig();
      const originalVendorCount = originalConfig.vendorChunks.length;

      configureCodeSplitting({ maxChunkSize: 150 * 1024 });

      const newConfig = getCodeSplitConfig();
      expect(newConfig.vendorChunks.length).toBe(originalVendorCount);
    });

    it('should allow custom vendor chunks', () => {
      const customVendors = [
        { name: 'custom-vendor', test: /custom-lib/, priority: 100 },
      ];

      configureCodeSplitting({ vendorChunks: customVendors });

      const config = getCodeSplitConfig();
      expect(config.vendorChunks).toEqual(customVendors);
    });
  });

  describe('Module Graph', () => {
    it('should register modules', () => {
      const module = registerModule(
        'src/components/App.tsx',
        5000,
        ['react', 'react-dom'],
        ['App', 'AppProps'],
        false
      );

      expect(module.path).toBe('src/components/App.tsx');
      expect(module.size).toBe(5000);
      expect(module.imports).toEqual(['react', 'react-dom']);
      expect(module.exports).toEqual(['App', 'AppProps']);
      expect(module.hasSideEffects).toBe(false);
    });

    it('should track used exports', () => {
      registerModule('src/utils.ts', 1000, [], ['foo', 'bar', 'baz'], false);

      expect(markExportUsed('src/utils.ts', 'foo')).toBe(true);
      expect(markExportUsed('src/utils.ts', 'bar')).toBe(true);

      const unused = getUnusedExports('src/utils.ts');
      expect(unused).toEqual(['baz']);
    });

    it('should return false for non-existent module', () => {
      expect(markExportUsed('nonexistent.ts', 'foo')).toBe(false);
    });

    it('should return false for non-existent export', () => {
      registerModule('src/utils.ts', 1000, [], ['foo'], false);
      expect(markExportUsed('src/utils.ts', 'bar')).toBe(false);
    });

    it('should mark module as dynamic import', () => {
      registerModule('src/heavy.ts', 100000, [], ['Heavy'], false);

      expect(markAsDynamicImport('src/heavy.ts')).toBe(true);
      expect(markAsDynamicImport('nonexistent.ts')).toBe(false);
    });

    it('should not duplicate used exports', () => {
      registerModule('src/utils.ts', 1000, [], ['foo', 'bar'], false);

      markExportUsed('src/utils.ts', 'foo');
      markExportUsed('src/utils.ts', 'foo'); // Duplicate

      const unused = getUnusedExports('src/utils.ts');
      expect(unused).toEqual(['bar']);
    });
  });

  describe('Tree Shaking', () => {
    it('should analyze tree shaking potential', () => {
      registerModule('src/utils.ts', 10000, [], ['a', 'b', 'c', 'd'], false);
      markExportUsed('src/utils.ts', 'a');
      markExportUsed('src/utils.ts', 'b');

      const results = analyzeTreeShaking();

      expect(results.originalSize).toBe(10000);
      expect(results.optimizedSize).toBeLessThan(results.originalSize);
      expect(results.removedExports).toContain('src/utils.ts:c');
      expect(results.removedExports).toContain('src/utils.ts:d');
      expect(results.savings).toBeGreaterThan(0);
    });

    it('should not tree-shake modules with side effects', () => {
      registerModule('src/polyfill.ts', 5000, [], ['init'], true);

      const results = analyzeTreeShaking();

      expect(results.sideEffectModules).toContain('src/polyfill.ts');
      expect(results.optimizedSize).toBe(5000);
    });

    it('should calculate savings percentage', () => {
      registerModule('src/large.ts', 10000, [], ['a', 'b', 'c', 'd', 'e'], false);
      markExportUsed('src/large.ts', 'a');

      const results = analyzeTreeShaking();

      expect(results.savingsPercent).toBeGreaterThan(0);
      expect(results.savingsPercent).toBeLessThanOrEqual(100);
    });

    it('should handle empty module graph', () => {
      const results = analyzeTreeShaking();

      expect(results.originalSize).toBe(0);
      expect(results.optimizedSize).toBe(0);
      expect(results.savings).toBe(0);
      expect(results.savingsPercent).toBe(0);
    });

    it('should return empty array for non-existent module', () => {
      const unused = getUnusedExports('nonexistent.ts');
      expect(unused).toEqual([]);
    });
  });

  describe('Code Splitting', () => {
    it('should create chunks', () => {
      registerModule('src/app.ts', 50000, [], [], false);
      registerModule('src/utils.ts', 10000, [], [], false);

      const chunk = createChunk('main', ['src/app.ts', 'src/utils.ts'], true, false);

      expect(chunk.name).toBe('main');
      expect(chunk.modules).toEqual(['src/app.ts', 'src/utils.ts']);
      expect(chunk.size).toBe(60000);
      expect(chunk.isEntry).toBe(true);
      expect(chunk.isDynamic).toBe(false);
    });

    it('should split chunks', () => {
      registerModule('src/a.ts', 30000, [], [], false);
      registerModule('src/b.ts', 30000, [], [], false);
      registerModule('src/c.ts', 30000, [], [], false);

      createChunk('large', ['src/a.ts', 'src/b.ts', 'src/c.ts'], false, false);

      const [chunk1, chunk2] = splitChunk('large', 2);

      expect(chunk1.name).toBe('large-1');
      expect(chunk1.modules).toEqual(['src/a.ts', 'src/b.ts']);
      expect(chunk2.name).toBe('large-2');
      expect(chunk2.modules).toEqual(['src/c.ts']);
      expect(chunk2.isDynamic).toBe(true);
    });

    it('should return empty array for non-existent chunk', () => {
      const result = splitChunk('nonexistent', 1);
      expect(result).toEqual([]);
    });

    it('should return single chunk if only one module', () => {
      registerModule('src/single.ts', 10000, [], [], false);
      createChunk('single', ['src/single.ts'], false, false);

      const result = splitChunk('single', 1);
      expect(result).toHaveLength(1);
    });

    it('should estimate size for known heavy modules', () => {
      const chunk = createChunk('vendor', ['node_modules/monaco-editor/index.js'], false, false);

      expect(chunk.size).toBeGreaterThan(1000 * 1024); // Monaco is large
    });
  });

  describe('Vendor Extraction', () => {
    it('should identify react vendor chunk', () => {
      const chunkName = extractVendorChunk('/node_modules/react/index.js');
      expect(chunkName).toBe('react-vendor');
    });

    it('should identify monaco vendor chunk', () => {
      const chunkName = extractVendorChunk('/node_modules/monaco-editor/esm/index.js');
      expect(chunkName).toBe('monaco-vendor');
    });

    it('should identify utils vendor chunk', () => {
      const chunkName = extractVendorChunk('/node_modules/lodash/index.js');
      expect(chunkName).toBe('utils-vendor');
    });

    it('should return null for non-vendor modules', () => {
      const chunkName = extractVendorChunk('src/components/App.tsx');
      expect(chunkName).toBeNull();
    });

    it('should return null for unknown vendor', () => {
      const chunkName = extractVendorChunk('/node_modules/unknown-package/index.js');
      expect(chunkName).toBeNull();
    });
  });

  describe('Dynamic Imports', () => {
    it('should create dynamic import info', () => {
      const info = createDynamicImport('src/monaco-editor/Editor.tsx');

      expect(info.modulePath).toBe('src/monaco-editor/Editor.tsx');
      expect(info.chunkName).toBe('monaco');
      expect(info.loadTrigger).toBe('user-interaction');
    });

    it('should match device frame pattern', () => {
      const info = createDynamicImport('src/components/device-frame/Frame.tsx');

      expect(info.chunkName).toBe('device-frames');
      expect(info.loadTrigger).toBe('viewport-visible');
    });

    it('should match diff viewer pattern', () => {
      const info = createDynamicImport('src/diff-viewer/DiffViewer.tsx');

      expect(info.chunkName).toBe('diff-viewer');
    });

    it('should generate dynamic import code', () => {
      const code = getDynamicImportCode('./components/Heavy', 'heavy-component');

      expect(code).toBe(
        "import(/* webpackChunkName: \"heavy-component\" */ './components/Heavy')"
      );
    });

    it('should auto-generate chunk name from path', () => {
      const code = getDynamicImportCode('./components/MyComponent.tsx');

      expect(code).toContain('webpackChunkName: "MyComponent"');
    });

    it('should recommend dynamic import for heavy modules', () => {
      expect(shouldDynamicImport('node_modules/monaco-editor/index.js', 100000)).toBe(true);
    });

    it('should recommend dynamic import when approaching threshold', () => {
      expect(shouldDynamicImport('src/feature.ts', 250 * 1024)).toBe(true);
    });

    it('should recommend dynamic import for matching patterns', () => {
      expect(shouldDynamicImport('src/charts/LineChart.tsx', 50000)).toBe(true);
    });

    it('should not recommend dynamic import for small modules', () => {
      expect(shouldDynamicImport('src/utils/format.ts', 50000)).toBe(false);
    });
  });

  describe('Bundle Analysis', () => {
    it('should analyze bundle', () => {
      registerModule('src/main.ts', 100000, [], ['main'], false);
      createChunk('main', ['src/main.ts'], true, false);

      const analysis = analyzeBundle();

      expect(analysis.mainBundleSize).toBe(100000);
      expect(analysis.totalSize).toBe(100000);
      expect(analysis.chunks.length).toBe(1);
      expect(analysis.passesThreshold).toBe(true);
    });

    it('should fail threshold for large bundle', () => {
      registerModule('src/huge.ts', 400 * 1024, [], [], false);
      createChunk('main', ['src/huge.ts'], true, false);

      const analysis = analyzeBundle();

      expect(analysis.passesThreshold).toBe(false);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('should track dynamic imports', () => {
      registerModule('src/heavy.ts', 100000, [], [], false);
      markAsDynamicImport('src/heavy.ts');

      const analysis = analyzeBundle();

      expect(analysis.dynamicImports.length).toBe(1);
    });

    it('should cache analysis results', () => {
      registerModule('src/app.ts', 50000, [], [], false);
      createChunk('main', ['src/app.ts'], true, false);

      const analysis1 = analyzeBundle();
      const analysis2 = analyzeBundle();

      expect(analysis1).toBe(analysis2); // Same reference (cached)
    });

    it('should invalidate cache on module registration', () => {
      registerModule('src/app.ts', 50000, [], [], false);
      createChunk('main', ['src/app.ts'], true, false);

      const analysis1 = analyzeBundle();

      registerModule('src/new.ts', 10000, [], [], false);

      const analysis2 = analyzeBundle();

      expect(analysis1).not.toBe(analysis2);
    });

    it('should generate tree shaking recommendations', () => {
      registerModule('src/bloat.ts', 100000, [], ['a', 'b', 'c', 'd', 'e'], false);
      markExportUsed('src/bloat.ts', 'a');
      createChunk('main', ['src/bloat.ts'], true, false);

      const analysis = analyzeBundle();

      expect(analysis.treeShakingResults.savingsPercent).toBeGreaterThan(20);
      expect(analysis.recommendations.some(r => r.includes('Tree shaking'))).toBe(true);
    });
  });

  describe('Optimization', () => {
    it('should optimize bundle', () => {
      registerModule('src/app.ts', 50000, [], ['App'], false);
      registerModule('node_modules/react/index.js', 130000, [], [], false);
      markExportUsed('src/app.ts', 'App');
      createChunk('main', ['src/app.ts', 'node_modules/react/index.js'], true, false);

      const result = optimizeBundle();

      expect(result.success).toBe(true);
      expect(result.appliedOptimizations.length).toBeGreaterThan(0);
    });

    it('should extract vendor chunks', () => {
      registerModule('node_modules/react/index.js', 130000, [], [], false);
      registerModule('node_modules/lodash/index.js', 70000, [], [], false);

      const result = optimizeBundle();

      const vendorOptimizations = result.appliedOptimizations.filter(
        opt => opt.type === 'vendor-extraction'
      );
      expect(vendorOptimizations.length).toBeGreaterThan(0);
    });

    it('should apply tree shaking', () => {
      registerModule('src/utils.ts', 10000, [], ['a', 'b', 'c'], false);
      markExportUsed('src/utils.ts', 'a');

      const result = optimizeBundle();

      const treeShaking = result.appliedOptimizations.find(
        opt => opt.type === 'tree-shaking'
      );
      expect(treeShaking).toBeDefined();
      expect(treeShaking!.sizeSaved).toBeGreaterThan(0);
    });

    it('should convert heavy modules to dynamic imports', () => {
      registerModule('src/monaco-editor/Editor.ts', 100000, [], [], false);

      const result = optimizeBundle();

      const dynamicImport = result.appliedOptimizations.find(
        opt => opt.type === 'dynamic-import'
      );
      expect(dynamicImport).toBeDefined();
    });

    it('should include warnings for side effects', () => {
      registerModule('src/polyfill.ts', 10000, [], [], true);

      const result = optimizeBundle();

      expect(result.warnings.some(w => w.includes('side effects'))).toBe(true);
    });
  });

  describe('Webpack Config Generation', () => {
    it('should generate split chunks config', () => {
      const config = generateWebpackSplitChunksConfig();

      expect(config.chunks).toBe('all');
      expect(config.maxSize).toBe(250 * 1024);
      expect(config.minSize).toBe(20 * 1024);
      expect(config.cacheGroups).toBeDefined();
    });

    it('should include vendor cache groups', () => {
      const config = generateWebpackSplitChunksConfig();

      expect(config.cacheGroups['react-vendor']).toBeDefined();
      expect(config.cacheGroups['monaco-vendor']).toBeDefined();
    });

    it('should generate dynamic import hints', () => {
      const hints = generateDynamicImportHints();

      expect(hints.length).toBeGreaterThan(0);
      expect(hints.some(h => h.includes('webpackChunkName'))).toBe(true);
    });
  });

  describe('Preload Hints', () => {
    it('should generate preload hints for critical imports', () => {
      registerModule('src/critical.ts', 50000, [], [], false);
      markAsDynamicImport('src/critical.ts');
      createDynamicImport('src/critical.ts', 'user-interaction', 'critical');

      const hints = generatePreloadHints('critical');

      expect(hints.length).toBeGreaterThan(0);
      expect(hints[0].type).toBe('preload');
    });

    it('should generate prefetch hints for low priority', () => {
      registerModule('src/optional.ts', 30000, [], [], false);
      markAsDynamicImport('src/optional.ts');
      createDynamicImport('src/optional.ts', 'idle', 'low');

      const hints = generatePreloadHints('low');

      expect(hints.some(h => h.type === 'prefetch')).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should return bundle metrics', () => {
      registerModule('src/app.ts', 150000, [], [], false);
      registerModule('src/feature.ts', 50000, [], [], false);
      createChunk('main', ['src/app.ts'], true, false);
      createChunk('feature', ['src/feature.ts'], false, true);

      const metrics = getBundleMetrics();

      expect(metrics.mainBundleSize).toBe(150000);
      expect(metrics.threshold).toBe(300 * 1024);
      expect(metrics.passesThreshold).toBe(true);
      expect(metrics.totalChunks).toBe(2);
      expect(metrics.dynamicChunks).toBe(1);
    });

    it('should identify largest chunk', () => {
      registerModule('src/small.ts', 10000, [], [], false);
      registerModule('src/large.ts', 100000, [], [], false);
      createChunk('small', ['src/small.ts'], false, false);
      createChunk('large', ['src/large.ts'], false, false);

      const metrics = getBundleMetrics();

      expect(metrics.largestChunk).toEqual({ name: 'large', size: 100000 });
    });

    it('should handle empty state', () => {
      const metrics = getBundleMetrics();

      expect(metrics.mainBundleSize).toBe(0);
      expect(metrics.totalChunks).toBe(0);
      expect(metrics.largestChunk).toBeNull();
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      registerModule('src/app.ts', 50000, [], [], false);
      createChunk('main', ['src/app.ts'], true, false);
      configureCodeSplitting({ maxChunkSize: 100000 });

      resetBundleOptimizer();

      const config = getCodeSplitConfig();
      expect(config.maxChunkSize).toBe(250 * 1024); // Back to default

      const analysis = analyzeBundle();
      expect(analysis.totalSize).toBe(0);
      expect(analysis.chunks.length).toBe(0);
    });
  });

  describe('Verification: Main bundle < 300KB', () => {
    it('should pass when main bundle under threshold', () => {
      registerModule('src/main.ts', 200 * 1024, [], [], false);
      createChunk('main', ['src/main.ts'], true, false);

      const analysis = analyzeBundle();

      expect(analysis.mainBundleSize).toBeLessThan(300 * 1024);
      expect(analysis.passesThreshold).toBe(true);
    });

    it('should fail when main bundle over threshold', () => {
      registerModule('src/bloated.ts', 350 * 1024, [], [], false);
      createChunk('main', ['src/bloated.ts'], true, false);

      const analysis = analyzeBundle();

      expect(analysis.mainBundleSize).toBeGreaterThan(300 * 1024);
      expect(analysis.passesThreshold).toBe(false);
    });

    it('should not count dynamic chunks in main bundle', () => {
      registerModule('src/main.ts', 200 * 1024, [], [], false);
      registerModule('src/heavy.ts', 500 * 1024, [], [], false);
      createChunk('main', ['src/main.ts'], true, false);
      createChunk('heavy', ['src/heavy.ts'], false, true);

      const analysis = analyzeBundle();

      expect(analysis.mainBundleSize).toBe(200 * 1024);
      expect(analysis.passesThreshold).toBe(true);
    });
  });

  describe('Verification: Dynamic imports for heavy features', () => {
    it('should recommend dynamic import for Monaco editor', () => {
      expect(shouldDynamicImport('monaco-editor', 0)).toBe(true);
    });

    it('should recommend dynamic import for charts', () => {
      expect(shouldDynamicImport('src/components/chart.tsx', 100000)).toBe(true);
    });

    it('should recommend dynamic import for PDF handling', () => {
      expect(shouldDynamicImport('src/pdf-viewer/document.tsx', 100000)).toBe(true);
    });

    it('should convert heavy features to dynamic imports during optimization', () => {
      registerModule('src/monaco-wrapper.ts', 100000, [], [], false);
      registerModule('src/device-frame-viewer.ts', 80000, [], [], false);

      const result = optimizeBundle();

      const dynamicImports = result.appliedOptimizations.filter(
        opt => opt.type === 'dynamic-import'
      );
      expect(dynamicImports.length).toBeGreaterThanOrEqual(2);
    });

    it('should generate correct dynamic import syntax', () => {
      const code = getDynamicImportCode('@monaco-editor/react', 'monaco');

      expect(code).toBe(
        "import(/* webpackChunkName: \"monaco\" */ '@monaco-editor/react')"
      );
    });
  });
});

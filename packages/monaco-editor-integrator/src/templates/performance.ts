/**
 * Performance Template Generator
 *
 * Generates performance optimization utilities for Monaco Editor.
 */

/**
 * Options for performance template generation.
 */
export interface PerformanceTemplateOptions {
  /** Whether to use TypeScript */
  useTypeScript: boolean;
  /** Large file size threshold in bytes */
  largeFileThreshold: number;
  /** Maximum file size in bytes */
  maxFileSize: number;
}

/**
 * Default options for performance template.
 */
const DEFAULT_OPTIONS: PerformanceTemplateOptions = {
  useTypeScript: true,
  largeFileThreshold: 1024 * 1024, // 1MB
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

/**
 * Generates lazy loading wrapper for Monaco Editor.
 *
 * @param options - Template options
 * @returns Lazy loading component file content
 */
export function generateLazyEditorTemplate(
  options: Partial<PerformanceTemplateOptions> = {}
): string {
  const mergedOptions: PerformanceTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const typeAnnotations = mergedOptions.useTypeScript;

  let content = `/**
 * Lazy Monaco Editor
 *
 * Dynamically imports Monaco Editor to reduce initial bundle size.
 * Shows a skeleton loader while the editor loads.
 */

'use client';

import { Suspense, lazy } from 'react';
`;

  if (typeAnnotations) {
    content += `import type { ComponentProps } from 'react';

// Lazy load the Monaco Editor component
const MonacoEditor = lazy(() => import('./MonacoEditor'));

type MonacoEditorProps = ComponentProps<typeof MonacoEditor>;

`;
  } else {
    content += `
// Lazy load the Monaco Editor component
const MonacoEditor = lazy(() => import('./MonacoEditor'));

`;
  }

  content += `/**
 * Editor skeleton loader component.
 */
function EditorSkeleton({ height = '100%' }${typeAnnotations ? ': { height?: string | number }' : ''}) {
  return (
    <div
      style={{
        height,
        backgroundColor: '#1e1e1e',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          height: '32px',
          backgroundColor: '#252526',
          borderBottom: '1px solid #3c3c3c',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '12px',
            backgroundColor: '#3c3c3c',
            borderRadius: '2px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>

      {/* Content skeleton */}
      <div style={{ padding: '16px' }}>
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            style={{
              height: '16px',
              marginBottom: '8px',
              backgroundColor: '#2d2d2d',
              borderRadius: '2px',
              width: \`\${Math.random() * 40 + 40}%\`,
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: \`\${i * 0.1}s\`,
            }}
          />
        ))}
      </div>

      <style>{\`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      \`}</style>
    </div>
  );
}

/**
 * Lazy-loaded Monaco Editor with Suspense.
 *
 * Reduces initial bundle size by ~2-3MB by deferring
 * Monaco Editor loading until needed.
 */
export function LazyMonacoEditor(props${typeAnnotations ? ': MonacoEditorProps' : ''}) {
  return (
    <Suspense fallback={<EditorSkeleton height={props.height} />}>
      <MonacoEditor {...props} />
    </Suspense>
  );
}

export default LazyMonacoEditor;
`;

  return content;
}

/**
 * Generates large file handling utilities.
 *
 * @param options - Template options
 * @returns Large file utilities file content
 */
export function generateLargeFileUtilities(
  options: Partial<PerformanceTemplateOptions> = {}
): string {
  const mergedOptions: PerformanceTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const typeAnnotations = mergedOptions.useTypeScript;
  const largeThreshold = mergedOptions.largeFileThreshold;
  const maxSize = mergedOptions.maxFileSize;

  let content = `/**
 * Large File Handling Utilities
 *
 * Utilities for detecting and handling large files in Monaco Editor.
 */

`;

  if (typeAnnotations) {
    content += `/**
 * File size analysis result.
 */
export interface FileSizeAnalysis {
  /** File size in bytes */
  sizeBytes: number;
  /** Human-readable size string */
  sizeFormatted: string;
  /** Whether the file is considered large */
  isLarge: boolean;
  /** Whether the file exceeds maximum size */
  exceedsMax: boolean;
  /** Warning message if applicable */
  warning: string | null;
  /** Recommended action */
  recommendation: 'allow' | 'warn' | 'block';
}

/**
 * Options for file size analysis.
 */
export interface FileSizeOptions {
  largeFileThreshold?: number;
  maxFileSize?: number;
}

`;
  }

  content += `/**
 * Default thresholds for file size handling.
 */
export const FILE_SIZE_THRESHOLDS = {
  LARGE: ${largeThreshold},
  MAX: ${maxSize},
} as const;

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes${typeAnnotations ? ': number' : ''}, decimals${typeAnnotations ? ': number' : ''} = 2)${typeAnnotations ? ': string' : ''} {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Analyze file size for editor compatibility.
 */
export function analyzeFileSize(
  sizeBytes${typeAnnotations ? ': number' : ''},
  options${typeAnnotations ? ': FileSizeOptions' : ''} = {}
)${typeAnnotations ? ': FileSizeAnalysis' : ''} {
  const {
    largeFileThreshold = FILE_SIZE_THRESHOLDS.LARGE,
    maxFileSize = FILE_SIZE_THRESHOLDS.MAX,
  } = options;

  const sizeFormatted = formatBytes(sizeBytes);
  const isLarge = sizeBytes > largeFileThreshold;
  const exceedsMax = sizeBytes > maxFileSize;

  let warning${typeAnnotations ? ': string | null' : ''} = null;
  let recommendation${typeAnnotations ? ": 'allow' | 'warn' | 'block'" : ''} = 'allow';

  if (exceedsMax) {
    warning = \`File size (\${sizeFormatted}) exceeds maximum limit (\${formatBytes(maxFileSize)}). The file cannot be opened in the editor.\`;
    recommendation = 'block';
  } else if (isLarge) {
    warning = \`Large file detected (\${sizeFormatted}). Editor performance may be affected. Consider using read-only mode or a specialized viewer.\`;
    recommendation = 'warn';
  }

  return {
    sizeBytes,
    sizeFormatted,
    isLarge,
    exceedsMax,
    warning,
    recommendation,
  };
}

/**
 * Get optimized editor options for large files.
 */
export function getLargeFileEditorOptions(sizeBytes${typeAnnotations ? ': number' : ''})${typeAnnotations ? ': Record<string, unknown>' : ''} {
  const analysis = analyzeFileSize(sizeBytes);

  if (analysis.exceedsMax) {
    return { readOnly: true };
  }

  if (analysis.isLarge) {
    return {
      // Disable expensive features for large files
      minimap: { enabled: false },
      folding: false,
      wordWrap: 'off',
      renderWhitespace: 'none',
      renderControlCharacters: false,
      renderLineHighlight: 'none',
      quickSuggestions: false,
      parameterHints: { enabled: false },
      suggestOnTriggerCharacters: false,
      acceptSuggestionOnEnter: 'off',
      tabCompletion: 'off',
      wordBasedSuggestions: 'off',
      // Optimize rendering
      maxTokenizationLineLength: 5000,
      stopRenderingLineAfter: 5000,
      largeFileOptimizations: true,
    };
  }

  return {};
}

/**
 * Estimate line count from file size.
 */
export function estimateLineCount(sizeBytes${typeAnnotations ? ': number' : ''}, avgBytesPerLine${typeAnnotations ? ': number' : ''} = 80)${typeAnnotations ? ': number' : ''} {
  return Math.ceil(sizeBytes / avgBytesPerLine);
}

export default { analyzeFileSize, getLargeFileEditorOptions, formatBytes };
`;

  return content;
}

/**
 * Generates bundle optimization documentation.
 *
 * @returns Bundle optimization documentation content
 */
export function generateBundleOptimizationDocs(): string {
  return `# Monaco Editor Bundle Optimization

## Overview

Monaco Editor adds approximately **2-3MB (gzipped)** to your bundle.
This guide covers strategies to minimize the impact on your application.

## Strategies

### 1. Code Splitting (Recommended)

Use dynamic imports to load Monaco only when needed:

\`\`\`tsx
import { lazy, Suspense } from 'react';

const MonacoEditor = lazy(() => import('./MonacoEditor'));

function App() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <MonacoEditor />
    </Suspense>
  );
}
\`\`\`

### 2. Language Subsetting

Only include languages you need:

\`\`\`javascript
// vite.config.js
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default {
  plugins: [
    monacoEditorPlugin({
      languageWorkers: ['typescript', 'json', 'css'],
    }),
  ],
};
\`\`\`

### 3. Feature Removal

Exclude unused features in webpack/Next.js:

\`\`\`javascript
// next.config.js
new MonacoWebpackPlugin({
  languages: ['typescript', 'javascript', 'json'],
  features: [
    '!accessibilityHelp',
    '!bracketMatching',
    '!caretOperations',
    '!clipboard',
    '!codeAction',
    '!codelens',
    '!colorDetector',
    // Add more features to exclude
  ],
});
\`\`\`

### 4. External CDN Loading

Load Monaco from CDN to leverage browser caching:

\`\`\`tsx
import Editor from '@monaco-editor/react';

<Editor
  defaultLanguage="typescript"
  loading={<EditorSkeleton />}
/>
\`\`\`

The \`@monaco-editor/react\` package loads Monaco from jsDelivr CDN by default.

## Bundle Size Reference

| Configuration | Gzipped Size |
|--------------|--------------|
| Full Monaco | ~2.5MB |
| JS/TS only | ~1.8MB |
| Minimal (no languages) | ~800KB |
| CDN (jsDelivr) | 0KB (loaded externally) |

## Monitoring Bundle Size

Add bundle analysis to your build:

\`\`\`bash
# Next.js
ANALYZE=true npm run build

# Vite
npx vite-bundle-visualizer
\`\`\`

## Best Practices

1. **Always lazy load** Monaco in production
2. **Limit languages** to those actually needed
3. **Use CDN** for public-facing applications
4. **Monitor bundle size** in CI/CD pipeline
5. **Consider read-only mode** for viewing-only use cases
`;
}

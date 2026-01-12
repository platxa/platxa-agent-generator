/**
 * Vite Configuration Generator
 *
 * Generates Vite configuration for Monaco Editor integration
 * with proper worker support and bundle optimization.
 */

import type { ProjectAnalysis } from '../types/index.js';

/**
 * Options for Vite config generation.
 */
export interface ViteConfigOptions {
  /** Whether to use TypeScript (.ts) extension */
  useTypeScript: boolean;
  /** Whether the project uses React */
  useReact: boolean;
  /** Languages to include (for bundle optimization) */
  languages?: string[];
  /** Whether to use the official monaco-vite-plugin */
  useMonacoPlugin: boolean;
}

/**
 * Default languages to include in the bundle.
 */
const DEFAULT_LANGUAGES = [
  'javascript',
  'typescript',
  'json',
  'html',
  'css',
  'markdown',
  'python',
  'xml',
];

/**
 * Generates imports for Vite config.
 *
 * @param options - Configuration options
 * @returns Import statements string
 */
function generateImports(options: ViteConfigOptions): string {
  const imports: string[] = [
    `import { defineConfig } from 'vite';`,
  ];

  if (options.useReact) {
    imports.push(`import react from '@vitejs/plugin-react';`);
  }

  if (options.useMonacoPlugin) {
    imports.push(`import monacoEditorPlugin from 'vite-plugin-monaco-editor';`);
  }

  return imports.join('\n');
}

/**
 * Generates the plugins array for Vite config.
 *
 * @param options - Configuration options
 * @returns Plugins array string
 */
function generatePlugins(options: ViteConfigOptions): string {
  const plugins: string[] = [];

  if (options.useReact) {
    plugins.push('react()');
  }

  if (options.useMonacoPlugin) {
    const languages = options.languages ?? DEFAULT_LANGUAGES;
    const languagesList = languages.map((l) => `'${l}'`).join(', ');

    plugins.push(`monacoEditorPlugin({
      languageWorkers: [${languagesList}],
    })`);
  }

  if (plugins.length === 0) {
    return '[]';
  }

  return `[
    ${plugins.join(',\n    ')},
  ]`;
}

/**
 * Generates optimizeDeps configuration for Monaco.
 *
 * @returns optimizeDeps config string
 */
function generateOptimizeDeps(): string {
  return `{
    include: [
      'monaco-editor',
      'monaco-editor/esm/vs/editor/editor.worker',
      'monaco-editor/esm/vs/language/json/json.worker',
      'monaco-editor/esm/vs/language/css/css.worker',
      'monaco-editor/esm/vs/language/html/html.worker',
      'monaco-editor/esm/vs/language/typescript/ts.worker',
    ],
  }`;
}

/**
 * Generates worker configuration for Vite.
 *
 * @returns Worker config string
 */
function generateWorkerConfig(): string {
  return `{
    format: 'es',
  }`;
}

/**
 * Generates a complete Vite config file for Monaco integration.
 *
 * @param options - Configuration options
 * @returns Complete vite.config.ts/js content
 */
export function generateViteConfig(options: ViteConfigOptions): string {
  const imports = generateImports(options);
  const plugins = generatePlugins(options);
  const optimizeDeps = generateOptimizeDeps();
  const worker = generateWorkerConfig();

  return `${imports}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: ${plugins},
  optimizeDeps: ${optimizeDeps},
  worker: ${worker},
});
`;
}

/**
 * Generates Vite config without the monaco plugin (manual worker setup).
 *
 * @param options - Configuration options
 * @returns Complete vite.config.ts/js content
 */
export function generateViteConfigManual(options: ViteConfigOptions): string {
  const imports: string[] = [
    `import { defineConfig } from 'vite';`,
  ];

  if (options.useReact) {
    imports.push(`import react from '@vitejs/plugin-react';`);
  }

  const plugins = options.useReact ? `[react()]` : `[]`;

  return `${imports.join('\n')}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: ${plugins},
  optimizeDeps: {
    include: [
      'monaco-editor',
      'monaco-editor/esm/vs/editor/editor.worker',
      'monaco-editor/esm/vs/language/json/json.worker',
      'monaco-editor/esm/vs/language/css/css.worker',
      'monaco-editor/esm/vs/language/html/html.worker',
      'monaco-editor/esm/vs/language/typescript/ts.worker',
    ],
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        },
      },
    },
  },
});
`;
}

/**
 * Generates the Monaco worker setup file for Vite.
 *
 * @returns Monaco worker setup content
 */
export function generateMonacoWorkerSetup(): string {
  return `/**
 * Monaco Editor Worker Setup
 *
 * This file configures Monaco Editor workers for Vite.
 * Import this file in your main entry point before using Monaco.
 */

import * as monaco from 'monaco-editor';

// Import workers
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Configure Monaco environment
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

export { monaco };
`;
}

/**
 * Generates TypeScript declaration for Vite worker imports.
 *
 * @returns TypeScript declaration content
 */
export function generateViteWorkerDeclaration(): string {
  return `/// <reference types="vite/client" />

declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module 'monaco-editor/esm/vs/language/json/json.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module 'monaco-editor/esm/vs/language/css/css.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module 'monaco-editor/esm/vs/language/html/html.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

declare module 'monaco-editor/esm/vs/language/typescript/ts.worker?worker' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
`;
}

/**
 * Determines the appropriate config generator based on project analysis.
 *
 * @param analysis - Project analysis result
 * @returns Generated config content and filename
 */
export function generateConfigForProject(
  analysis: ProjectAnalysis
): { content: string; filename: string } | null {
  if (analysis.buildTool !== 'vite') {
    return null;
  }

  const options: ViteConfigOptions = {
    useTypeScript: analysis.hasTypeScript,
    useReact: analysis.projectType === 'vite-react',
    useMonacoPlugin: true,
  };

  const filename = analysis.hasTypeScript ? 'vite.config.ts' : 'vite.config.js';

  return {
    content: generateViteConfig(options),
    filename,
  };
}

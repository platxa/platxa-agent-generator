/**
 * Next.js Configuration Generator
 *
 * Generates Next.js configuration for Monaco Editor integration
 * with proper webpack configuration and worker support.
 */

import type { ProjectAnalysis } from '../types/index.js';

/**
 * Options for Next.js config generation.
 */
export interface NextjsConfigOptions {
  /** Whether to use TypeScript (.ts) extension */
  useTypeScript: boolean;
  /** Whether to preserve existing config */
  preserveExisting: boolean;
  /** Languages to include (for bundle optimization) */
  languages?: string[];
  /** Features to exclude (for bundle optimization) */
  excludeFeatures?: string[];
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
 * Generates the Monaco Webpack Plugin import statement.
 *
 * @returns Import statement string
 */
function generateImports(): string {
  return `const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');`;
}

/**
 * Generates the webpack configuration for Monaco.
 *
 * @param options - Configuration options
 * @returns Webpack config string
 */
function generateWebpackConfig(options: NextjsConfigOptions): string {
  const languages = options.languages ?? DEFAULT_LANGUAGES;
  const languagesList = languages.map((l) => `'${l}'`).join(', ');

  return `
    webpack: (config, { isServer }) => {
      if (!isServer) {
        config.plugins.push(
          new MonacoWebpackPlugin({
            languages: [${languagesList}],
            filename: 'static/[name].worker.js',
          })
        );
      }
      return config;
    },`;
}

/**
 * Generates transpilePackages configuration.
 *
 * @returns transpilePackages config string
 */
function generateTranspilePackages(): string {
  return `
    transpilePackages: ['monaco-editor'],`;
}

/**
 * Generates experimental configuration for App Router.
 *
 * @returns Experimental config string
 */
function generateExperimentalConfig(): string {
  return `
    experimental: {
      // Required for Monaco workers in App Router
      esmExternals: 'loose',
    },`;
}

/**
 * Generates a complete Next.js config file for Monaco integration.
 *
 * @param options - Configuration options
 * @returns Complete next.config.js/ts content
 */
export function generateNextjsConfig(options: NextjsConfigOptions): string {
  const typeAnnotation = options.useTypeScript ? ': import("next").NextConfig' : '';

  const imports = generateImports();
  const webpackConfig = generateWebpackConfig(options);
  const transpilePackages = generateTranspilePackages();
  const experimental = generateExperimentalConfig();

  return `/** @type {import('next').NextConfig} */
${imports}

const nextConfig${typeAnnotation} = {${transpilePackages}${experimental}${webpackConfig}
};

module.exports = nextConfig;
`;
}

/**
 * Generates a next.config.mjs (ES modules) variant.
 *
 * @param options - Configuration options
 * @returns Complete next.config.mjs content
 */
export function generateNextjsConfigMjs(options: NextjsConfigOptions): string {
  const languages = options.languages ?? DEFAULT_LANGUAGES;
  const languagesList = languages.map((l) => `'${l}'`).join(', ');

  return `import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['monaco-editor'],
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: [${languagesList}],
          filename: 'static/[name].worker.js',
        })
      );
    }
    return config;
  },
};

export default nextConfig;
`;
}

/**
 * Generates webpack config snippet to merge with existing config.
 *
 * @param options - Configuration options
 * @returns Webpack config snippet
 */
export function generateWebpackSnippet(options: NextjsConfigOptions): string {
  const languages = options.languages ?? DEFAULT_LANGUAGES;
  const languagesList = languages.map((l) => `'${l}'`).join(', ');

  return `// Add to your existing next.config.js webpack function:
// 1. Add import at top:
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

// 2. Add to transpilePackages array:
transpilePackages: ['monaco-editor', /* ...existing packages */],

// 3. Add inside webpack function, before return config:
if (!isServer) {
  config.plugins.push(
    new MonacoWebpackPlugin({
      languages: [${languagesList}],
      filename: 'static/[name].worker.js',
    })
  );
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
  if (analysis.buildTool !== 'nextjs') {
    return null;
  }

  const options: NextjsConfigOptions = {
    useTypeScript: analysis.hasTypeScript,
    preserveExisting: false,
  };

  // Prefer .mjs for modern projects
  return {
    content: generateNextjsConfigMjs(options),
    filename: 'next.config.mjs',
  };
}

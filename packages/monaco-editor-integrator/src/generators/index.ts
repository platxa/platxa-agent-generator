/**
 * Monaco Editor Integrator - Config Generators
 *
 * Build configuration generators for Next.js, Vite, and CSP headers.
 */

// Next.js configuration
export {
  generateNextjsConfig,
  generateNextjsConfigMjs,
  generateWebpackSnippet,
  generateConfigForProject as generateNextjsConfigForProject,
  type NextjsConfigOptions,
} from './nextjsConfig.js';

// Vite configuration
export {
  generateViteConfig,
  generateViteConfigManual,
  generateMonacoWorkerSetup,
  generateViteWorkerDeclaration,
  generateConfigForProject as generateViteConfigForProject,
  type ViteConfigOptions,
} from './viteConfig.js';

// CSP headers
export {
  generateCspDirectives,
  generateCspHeader,
  generateNextjsHeaders,
  generateCspMiddleware,
  generateCspMetaTag,
  generateCspDocumentation,
  generateCspForBuildTool,
  directivesToString,
  type CspDirectives,
  type CspOptions,
} from './cspHeaders.js';

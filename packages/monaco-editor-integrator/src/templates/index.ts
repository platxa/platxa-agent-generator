/**
 * Monaco Editor Integrator - Templates
 *
 * Code generation templates for Monaco Editor + Yjs integration.
 */

// Monaco Editor component
export {
  generateMonacoEditorTemplate,
  generateMinimalMonacoEditorTemplate,
  type MonacoEditorTemplateOptions,
} from './MonacoEditor.js';

// Yjs Provider
export {
  generateYjsProviderTemplate,
  type YjsProviderTemplateOptions,
} from './YjsProvider.js';

// useYjsDocument hook
export {
  generateUseYjsDocumentTemplate,
  type UseYjsDocumentTemplateOptions,
} from './useYjsDocument.js';

// useMonacoBinding hook
export {
  generateUseMonacoBindingTemplate,
  type UseMonacoBindingTemplateOptions,
} from './useMonacoBinding.js';

// Editor options
export {
  generateEditorOptionsTemplate,
  type EditorOptionsTemplateOptions,
} from './editorOptions.js';

// Theme definitions
export {
  generateThemeTemplate,
  type ThemeTemplateOptions,
} from './theme.js';

// Language configuration
export {
  generateLanguagesTemplate,
  type LanguagesTemplateOptions,
} from './languages.js';

// Error handling
export {
  generateWebSocketErrorHandler,
  generateEditorErrorBoundary,
  generateConflictResolution,
  type ErrorHandlingTemplateOptions,
} from './errorHandling.js';

// Performance utilities
export {
  generateLazyEditorTemplate,
  generateLargeFileUtilities,
  generateBundleOptimizationDocs,
  type PerformanceTemplateOptions,
} from './performance.js';

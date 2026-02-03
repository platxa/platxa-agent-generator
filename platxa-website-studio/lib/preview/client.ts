/**
 * Client-safe preview exports
 *
 * This module exports only the client-compatible parts of the preview system.
 * Use this in client components (app/layout.tsx, etc.) to avoid bundling
 * server-only dependencies like sass.
 *
 * For server-side code, import from './index' instead.
 */

// Streaming preview context and hooks (client-safe)
export {
  StreamingPreviewProvider,
  useStreamingPreview,
  useStreamingPreviewSafe,
  useIsStreaming,
  useStreamingProgress,
  type StreamingPreviewState,
  type StreamingPreviewContextValue,
} from "./streaming-preview-context";

// Incremental QWeb parser (client-safe)
export {
  IncrementalQWebParser,
  isQWebContent,
  extractCssFromScss,
  type ParseResult,
} from "./incremental-qweb-parser";

// QWeb Runtime simulator (client-safe)
export {
  QWebRuntime,
  createQWebRuntime,
  renderQWeb,
  type QWebContext,
  type TemplateRegistry,
} from "./qweb-runtime";

// Snippet registry (client-safe)
export {
  SNIPPET_TEMPLATES,
  getSnippet,
  getSnippetsByCategory,
  getAllSnippets,
  detectSnippets,
  expandSnippets,
  type SnippetDefinition,
} from "./snippet-registry";

// Placeholder images (client-safe)
export {
  generatePlaceholderSVG,
  generatePlaceholderDataURL,
  generateGradientPlaceholder,
  generateGradientPlaceholderDataURL,
  replaceImagesWithPlaceholders,
  getPlaceholder,
  PLACEHOLDER_SIZES,
  PLACEHOLDER_URLS,
  type PlaceholderConfig,
  type PlaceholderType,
} from "./placeholder-images";

/**
 * Double-Streaming Module
 *
 * Implements Backend→API→Client streaming with output sanitization.
 * Provides dual-layer protection: backend escaping + client DOMPurify.
 *
 * @example Basic usage with fetch
 * ```typescript
 * import { createDoubleStream } from 'platxa-frontend-agent/streaming';
 *
 * const stream = createDoubleStream({
 *   source: {
 *     type: 'fetch',
 *     source: '/api/chat',
 *     fetchOptions: { method: 'POST', body: JSON.stringify({ message }) },
 *   },
 *   sanitization: { contentType: 'html' },
 *   onChunk: (chunk) => console.log('Received:', chunk),
 *   onComplete: (finish) => console.log('Done:', finish),
 * });
 *
 * await stream.start();
 * const content = stream.getSanitizedContent();
 * ```
 *
 * @example Using transform stream
 * ```typescript
 * import { pipeWithSanitization } from 'platxa-frontend-agent/streaming';
 *
 * const response = await fetch('/api/chat');
 * const sanitizedStream = pipeWithSanitization(response.body!, {
 *   contentType: 'html',
 * });
 *
 * // Use sanitizedStream safely
 * ```
 *
 * @module react-agent/streaming
 */

// Pipeline exports
export {
  createDoubleStream,
  createSanitizingTransform,
  pipeWithSanitization,
} from './double-stream.js';

// Sanitization exports
export {
  // Backend sanitization
  escapeHtml,
  escapeXml,
  escapeJson,
  escapeMarkdown,
  stripHtml,
  backendSanitize,
  // Client sanitization
  clientSanitize,
  clientSanitizeSync,
  // Combined sanitization
  sanitize,
  sanitizeSync,
  preloadDOMPurify,
  // Constants
  DEFAULT_ALLOWED_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
  SAFE_URI_REGEX,
} from './sanitize.js';

// Type exports
export type {
  // Chunk types
  ChunkType,
  StreamChunk,
  TextChunk,
  MetadataChunk,
  FinishChunk,
  ErrorChunk,
  AnyChunk,
  // Metadata types
  StreamMetadata,
  StreamPhase,
  FinishData,
  StreamError,
  // Sanitization types
  ContentType,
  SanitizeOptions,
  SanitizeResult,
  DOMPurifyConfig,
  // Pipeline types
  StreamSource,
  StreamTransform,
  StreamPipelineConfig,
  StreamPipelineState,
  DoubleStreamPipeline,
  // React hook types
  UseDoubleStreamOptions,
  UseDoubleStreamReturn,
} from './types.js';

export { PROTOCOL_CODES } from './types.js';

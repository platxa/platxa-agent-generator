/**
 * Double-Streaming Types
 *
 * Type definitions for the double-streaming pattern that handles
 * Backend→API→Client streaming with output sanitization.
 *
 * @module react-agent/streaming/types
 */

// =============================================================================
// STREAM CHUNK TYPES
// =============================================================================

/**
 * AI SDK-compatible chunk types
 * Based on Vercel AI SDK v3 data stream protocol
 */
export type ChunkType =
  | 'text'      // 0: Text content
  | 'metadata'  // 2: Metadata/progress
  | 'finish'    // d: Completion signal
  | 'error';    // 3: Error signal

/**
 * Protocol codes for AI SDK format
 */
export const PROTOCOL_CODES: Record<ChunkType, string> = {
  text: '0',
  metadata: '2',
  finish: 'd',
  error: '3',
};

/**
 * Base chunk structure
 */
export interface StreamChunk<T = unknown> {
  /** Chunk type */
  type: ChunkType;
  /** Chunk payload */
  data: T;
  /** Timestamp when chunk was created */
  timestamp: number;
  /** Sequence number for ordering */
  sequence: number;
}

/**
 * Text chunk containing generated content
 */
export interface TextChunk extends StreamChunk<string> {
  type: 'text';
}

/**
 * Metadata chunk for progress updates
 */
export interface MetadataChunk extends StreamChunk<StreamMetadata> {
  type: 'metadata';
}

/**
 * Finish chunk sent at end of stream
 */
export interface FinishChunk extends StreamChunk<FinishData> {
  type: 'finish';
}

/**
 * Error chunk for stream errors
 */
export interface ErrorChunk extends StreamChunk<StreamError> {
  type: 'error';
}

/**
 * Union type for all chunk types
 */
export type AnyChunk = TextChunk | MetadataChunk | FinishChunk | ErrorChunk;

// =============================================================================
// METADATA TYPES
// =============================================================================

/**
 * Stream metadata for progress tracking
 */
export interface StreamMetadata {
  /** Generation progress (0-100) */
  progress?: number;
  /** Current generation phase */
  phase?: StreamPhase;
  /** Quality score if available */
  qualityScore?: number;
  /** Token count */
  tokenCount?: number;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Stream generation phases
 */
export type StreamPhase =
  | 'initializing'
  | 'generating'
  | 'validating'
  | 'sanitizing'
  | 'correcting'
  | 'complete';

/**
 * Finish data sent at stream completion
 */
export interface FinishData {
  /** Total tokens used */
  totalTokens: number;
  /** Generation duration in ms */
  durationMs: number;
  /** Final quality score */
  qualityScore?: number;
  /** Whether content was corrected */
  wasCorrected?: boolean;
  /** Number of correction iterations */
  correctionIterations?: number;
  /** Finish reason */
  reason: 'complete' | 'error' | 'cancelled' | 'max_tokens';
}

/**
 * Stream error information
 */
export interface StreamError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Retry suggestion */
  retryAfterMs?: number;
}

// =============================================================================
// SANITIZATION TYPES
// =============================================================================

/**
 * Content types that require different sanitization
 */
export type ContentType = 'html' | 'markdown' | 'code' | 'json' | 'text';

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  /** Content type to sanitize */
  contentType: ContentType;
  /** Allow certain HTML tags (for html/markdown) */
  allowedTags?: string[];
  /** Allow certain HTML attributes */
  allowedAttributes?: Record<string, string[]>;
  /** Allow data attributes */
  allowDataAttributes?: boolean;
  /** Strip all HTML (for text output) */
  stripHtml?: boolean;
  /** Custom sanitization function */
  customSanitizer?: (content: string) => string;
}

/**
 * DOMPurify configuration subset
 */
export interface DOMPurifyConfig {
  /** Allowed HTML tags */
  ALLOWED_TAGS?: string[];
  /** Allowed HTML attributes */
  ALLOWED_ATTR?: string[];
  /** Allow data-* attributes */
  ALLOW_DATA_ATTR?: boolean;
  /** Return DOM instead of string */
  RETURN_DOM?: boolean;
  /** Return DOM fragment */
  RETURN_DOM_FRAGMENT?: boolean;
  /** Force string return */
  FORCE_BODY?: boolean;
  /** Sanitize in place */
  IN_PLACE?: boolean;
  /** Allow unknown protocols */
  ALLOW_UNKNOWN_PROTOCOLS?: boolean;
  /** URI safe protocols */
  ALLOWED_URI_REGEXP?: RegExp;
}

/**
 * Sanitization result
 */
export interface SanitizeResult {
  /** Sanitized content */
  content: string;
  /** Whether content was modified */
  wasModified: boolean;
  /** Items that were removed */
  removedItems?: string[];
  /** Warnings generated */
  warnings?: string[];
}

// =============================================================================
// STREAMING PIPELINE TYPES
// =============================================================================

/**
 * Stream source configuration
 */
export interface StreamSource {
  /** Source type */
  type: 'fetch' | 'websocket' | 'readable';
  /** Source URL or stream */
  source: string | ReadableStream<Uint8Array>;
  /** Request options for fetch */
  fetchOptions?: RequestInit;
  /** WebSocket protocols */
  protocols?: string[];
}

/**
 * Stream transform function
 */
export type StreamTransform = (chunk: AnyChunk) => AnyChunk | null;

/**
 * Stream pipeline configuration
 */
export interface StreamPipelineConfig {
  /** Stream source */
  source: StreamSource;
  /** Transforms to apply */
  transforms?: StreamTransform[];
  /** Sanitization options */
  sanitization?: SanitizeOptions;
  /** Enable backend sanitization */
  backendSanitize?: boolean;
  /** Enable client sanitization */
  clientSanitize?: boolean;
  /** Buffer size for chunks */
  bufferSize?: number;
  /** Timeout for stream in ms */
  timeoutMs?: number;
  /** Callback for chunk processing */
  onChunk?: (chunk: AnyChunk) => void;
  /** Callback for errors */
  onError?: (error: StreamError) => void;
  /** Callback for completion */
  onComplete?: (finish: FinishData) => void;
}

/**
 * Stream pipeline state
 */
export interface StreamPipelineState {
  /** Whether stream is active */
  isActive: boolean;
  /** Whether stream is paused */
  isPaused: boolean;
  /** Total chunks received */
  chunksReceived: number;
  /** Total bytes received */
  bytesReceived: number;
  /** Current buffer size */
  bufferSize: number;
  /** Accumulated text content */
  accumulatedText: string;
  /** Current metadata */
  metadata: StreamMetadata;
  /** Stream start time */
  startTime: number;
  /** Last chunk time */
  lastChunkTime: number;
}

/**
 * Double-stream pipeline interface
 */
export interface DoubleStreamPipeline {
  /** Start the stream */
  start: () => Promise<void>;
  /** Pause the stream */
  pause: () => void;
  /** Resume the stream */
  resume: () => void;
  /** Cancel the stream */
  cancel: () => void;
  /** Get current state */
  getState: () => StreamPipelineState;
  /** Get accumulated content */
  getContent: () => string;
  /** Get sanitized content */
  getSanitizedContent: () => string;
}

// =============================================================================
// REACT HOOKS TYPES
// =============================================================================

/**
 * useDoubleStream hook options
 */
export interface UseDoubleStreamOptions {
  /** API endpoint */
  endpoint: string;
  /** Request body */
  body?: Record<string, unknown>;
  /** Sanitization options */
  sanitization?: SanitizeOptions;
  /** Auto-start on mount */
  autoStart?: boolean;
  /** Callback for each text chunk */
  onText?: (text: string, accumulated: string) => void;
  /** Callback for metadata */
  onMetadata?: (metadata: StreamMetadata) => void;
  /** Callback for completion */
  onComplete?: (finish: FinishData, content: string) => void;
  /** Callback for errors */
  onError?: (error: StreamError) => void;
}

/**
 * useDoubleStream hook return type
 */
export interface UseDoubleStreamReturn {
  /** Raw content (unsanitized) */
  rawContent: string;
  /** Sanitized content (safe for DOM) */
  content: string;
  /** Whether stream is loading */
  isLoading: boolean;
  /** Whether stream is complete */
  isComplete: boolean;
  /** Current error if any */
  error: StreamError | null;
  /** Current metadata */
  metadata: StreamMetadata;
  /** Start/restart the stream */
  start: (body?: Record<string, unknown>) => Promise<void>;
  /** Cancel the stream */
  cancel: () => void;
}

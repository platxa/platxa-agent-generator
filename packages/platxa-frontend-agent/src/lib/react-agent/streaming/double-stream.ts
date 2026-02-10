/**
 * Double-Streaming Implementation
 *
 * Implements the Backend→API→Client streaming pattern with
 * dual-layer sanitization for secure content delivery.
 *
 * @module react-agent/streaming/double-stream
 */

import {
  backendSanitize,
  clientSanitizeSync,
  preloadDOMPurify,
} from './sanitize.js';
import type {
  StreamPipelineConfig,
  StreamPipelineState,
  DoubleStreamPipeline,
  AnyChunk,
  TextChunk,
  MetadataChunk,
  FinishChunk,
  ErrorChunk,
  StreamError,
  ChunkType,
  SanitizeOptions,
} from './types.js';

// =============================================================================
// PROTOCOL PARSING
// =============================================================================

/** Protocol code to type mapping */
const CODE_TO_TYPE: Record<string, ChunkType> = {
  '0': 'text',
  '2': 'metadata',
  'd': 'finish',
  '3': 'error',
};

/**
 * Parse AI SDK protocol chunk
 * Format: `{code}:{json}\n`
 */
function parseChunk(line: string, sequence: number): AnyChunk | null {
  if (!line || line.length < 3) return null;

  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return null;

  const code = line.slice(0, colonIndex);
  const type = CODE_TO_TYPE[code];
  if (!type) return null;

  try {
    const jsonStr = line.slice(colonIndex + 1);
    const data = JSON.parse(jsonStr);

    return {
      type,
      data,
      timestamp: Date.now(),
      sequence,
    } as AnyChunk;
  } catch {
    return null;
  }
}

/**
 * Encode chunk to AI SDK protocol format
 */
function encodeChunk(chunk: AnyChunk): string {
  const codes: Record<ChunkType, string> = {
    text: '0',
    metadata: '2',
    finish: 'd',
    error: '3',
  };

  return `${codes[chunk.type]}:${JSON.stringify(chunk.data)}\n`;
}

// =============================================================================
// DOUBLE STREAM PIPELINE
// =============================================================================

/**
 * Create a double-streaming pipeline
 */
export function createDoubleStream(
  config: StreamPipelineConfig
): DoubleStreamPipeline {
  // State
  let state: StreamPipelineState = {
    isActive: false,
    isPaused: false,
    chunksReceived: 0,
    bytesReceived: 0,
    bufferSize: 0,
    accumulatedText: '',
    metadata: {},
    startTime: 0,
    lastChunkTime: 0,
  };

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let abortController: AbortController | null = null;
  let sanitizedContent = '';

  const sanitizeOptions = config.sanitization ?? { contentType: 'html' };
  const shouldBackendSanitize = config.backendSanitize ?? true;
  const shouldClientSanitize = config.clientSanitize ?? true;

  /**
   * Process a single chunk through transforms and sanitization
   */
  function processChunk(chunk: AnyChunk): AnyChunk | null {
    let processed: AnyChunk | null = chunk;

    // Apply transforms
    if (config.transforms) {
      for (const transform of config.transforms) {
        if (processed === null) break;
        processed = transform(processed);
      }
    }

    if (processed === null) return null;

    // Sanitize text chunks
    if (processed.type === 'text' && typeof processed.data === 'string') {
      let sanitizedData = processed.data;

      // Backend sanitization
      if (shouldBackendSanitize) {
        const result = backendSanitize(sanitizedData, sanitizeOptions.contentType);
        sanitizedData = result.content;
      }

      // Client sanitization
      if (shouldClientSanitize) {
        const result = clientSanitizeSync(sanitizedData, sanitizeOptions);
        sanitizedData = result.content;
      }

      return {
        ...processed,
        data: sanitizedData,
      } as TextChunk;
    }

    return processed;
  }

  /**
   * Handle text chunk
   */
  function handleTextChunk(chunk: TextChunk): void {
    state.accumulatedText += chunk.data;
    sanitizedContent += chunk.data; // Already sanitized in processChunk
    config.onChunk?.(chunk);
  }

  /**
   * Handle metadata chunk
   */
  function handleMetadataChunk(chunk: MetadataChunk): void {
    state.metadata = { ...state.metadata, ...chunk.data };
    config.onChunk?.(chunk);
  }

  /**
   * Handle finish chunk
   */
  function handleFinishChunk(chunk: FinishChunk): void {
    state.isActive = false;
    config.onComplete?.(chunk.data);
    config.onChunk?.(chunk);
  }

  /**
   * Handle error chunk
   */
  function handleErrorChunk(chunk: ErrorChunk): void {
    state.isActive = false;
    config.onError?.(chunk.data);
    config.onChunk?.(chunk);
  }

  /**
   * Process incoming stream data
   */
  async function processStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sequence = 0;

    try {
      while (state.isActive && !state.isPaused) {
        const { done, value } = await reader.read();

        if (done) {
          // Process remaining buffer
          if (buffer.trim()) {
            const chunk = parseChunk(buffer.trim(), sequence++);
            if (chunk) {
              const processed = processChunk(chunk);
              if (processed) {
                switch (processed.type) {
                  case 'text':
                    handleTextChunk(processed as TextChunk);
                    break;
                  case 'metadata':
                    handleMetadataChunk(processed as MetadataChunk);
                    break;
                  case 'finish':
                    handleFinishChunk(processed as FinishChunk);
                    break;
                  case 'error':
                    handleErrorChunk(processed as ErrorChunk);
                    break;
                }
              }
            }
          }
          break;
        }

        state.bytesReceived += value.length;
        state.lastChunkTime = Date.now();
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          state.chunksReceived++;
          const chunk = parseChunk(line, sequence++);

          if (chunk) {
            const processed = processChunk(chunk);
            if (processed) {
              switch (processed.type) {
                case 'text':
                  handleTextChunk(processed as TextChunk);
                  break;
                case 'metadata':
                  handleMetadataChunk(processed as MetadataChunk);
                  break;
                case 'finish':
                  handleFinishChunk(processed as FinishChunk);
                  break;
                case 'error':
                  handleErrorChunk(processed as ErrorChunk);
                  break;
              }
            }
          }
        }

        state.bufferSize = buffer.length;
      }
    } finally {
      reader.releaseLock();
      reader = null;
    }
  }

  /**
   * Start the stream from a fetch source
   */
  async function startFromFetch(
    url: string,
    options?: RequestInit
  ): Promise<void> {
    abortController = new AbortController();

    const response = await fetch(url, {
      ...options,
      signal: abortController.signal,
    });

    if (!response.ok) {
      const error: StreamError = {
        code: `HTTP_${response.status}`,
        message: response.statusText,
        recoverable: response.status >= 500,
      };
      config.onError?.(error);
      return;
    }

    if (!response.body) {
      const error: StreamError = {
        code: 'NO_BODY',
        message: 'Response has no body',
        recoverable: false,
      };
      config.onError?.(error);
      return;
    }

    await processStream(response.body);
  }

  /**
   * Start the stream from a WebSocket
   */
  async function startFromWebSocket(
    url: string,
    protocols?: string[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, protocols);
      let sequence = 0;

      ws.onopen = () => {
        state.isActive = true;
      };

      ws.onmessage = (event) => {
        if (!state.isActive || state.isPaused) return;

        const data = typeof event.data === 'string' ? event.data : '';
        state.bytesReceived += data.length;
        state.lastChunkTime = Date.now();

        const lines = data.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;

          state.chunksReceived++;
          const chunk = parseChunk(line, sequence++);

          if (chunk) {
            const processed = processChunk(chunk);
            if (processed) {
              switch (processed.type) {
                case 'text':
                  handleTextChunk(processed as TextChunk);
                  break;
                case 'metadata':
                  handleMetadataChunk(processed as MetadataChunk);
                  break;
                case 'finish':
                  handleFinishChunk(processed as FinishChunk);
                  ws.close();
                  resolve();
                  break;
                case 'error':
                  handleErrorChunk(processed as ErrorChunk);
                  ws.close();
                  resolve();
                  break;
              }
            }
          }
        }
      };

      ws.onerror = () => {
        const error: StreamError = {
          code: 'WS_ERROR',
          message: 'WebSocket error',
          recoverable: true,
        };
        config.onError?.(error);
        reject(new Error('WebSocket error'));
      };

      ws.onclose = () => {
        state.isActive = false;
        resolve();
      };
    });
  }

  /**
   * Start the stream from a ReadableStream
   */
  async function startFromReadable(
    stream: ReadableStream<Uint8Array>
  ): Promise<void> {
    await processStream(stream);
  }

  return {
    async start(): Promise<void> {
      // Preload DOMPurify if client sanitization is enabled
      if (shouldClientSanitize) {
        await preloadDOMPurify();
      }

      // Reset state
      state = {
        isActive: true,
        isPaused: false,
        chunksReceived: 0,
        bytesReceived: 0,
        bufferSize: 0,
        accumulatedText: '',
        metadata: {},
        startTime: Date.now(),
        lastChunkTime: Date.now(),
      };
      sanitizedContent = '';

      const { source } = config;

      try {
        switch (source.type) {
          case 'fetch':
            await startFromFetch(
              source.source as string,
              source.fetchOptions
            );
            break;
          case 'websocket':
            await startFromWebSocket(
              source.source as string,
              source.protocols
            );
            break;
          case 'readable':
            await startFromReadable(
              source.source as ReadableStream<Uint8Array>
            );
            break;
        }
      } catch (error) {
        state.isActive = false;
        const streamError: StreamError = {
          code: 'STREAM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false,
        };
        config.onError?.(streamError);
      }
    },

    pause(): void {
      state.isPaused = true;
    },

    resume(): void {
      state.isPaused = false;
    },

    cancel(): void {
      state.isActive = false;
      state.isPaused = false;

      if (abortController) {
        abortController.abort();
        abortController = null;
      }

      if (reader) {
        reader.cancel();
        reader = null;
      }
    },

    getState(): StreamPipelineState {
      return { ...state };
    },

    getContent(): string {
      return state.accumulatedText;
    },

    getSanitizedContent(): string {
      return sanitizedContent;
    },
  };
}

// =============================================================================
// TRANSFORM STREAM UTILITIES
// =============================================================================

/**
 * Create a TransformStream for double-streaming
 */
export function createSanitizingTransform(
  options?: SanitizeOptions
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const sanitizeOpts = options ?? { contentType: 'html' };
  let buffer = '';
  let sequence = 0;

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) {
          controller.enqueue(encoder.encode('\n'));
          continue;
        }

        const parsed = parseChunk(line, sequence++);
        if (!parsed) {
          controller.enqueue(encoder.encode(line + '\n'));
          continue;
        }

        if (parsed.type === 'text' && typeof parsed.data === 'string') {
          // Sanitize text chunks
          const backendResult = backendSanitize(parsed.data, sanitizeOpts.contentType);
          const clientResult = clientSanitizeSync(backendResult.content, sanitizeOpts);

          const sanitizedChunk: TextChunk = {
            ...parsed,
            data: clientResult.content,
          };

          controller.enqueue(encoder.encode(encodeChunk(sanitizedChunk)));
        } else {
          // Pass through other chunk types
          controller.enqueue(encoder.encode(line + '\n'));
        }
      }
    },

    flush(controller) {
      if (buffer.trim()) {
        const parsed = parseChunk(buffer, sequence++);
        if (parsed && parsed.type === 'text' && typeof parsed.data === 'string') {
          const backendResult = backendSanitize(parsed.data, sanitizeOpts.contentType);
          const clientResult = clientSanitizeSync(backendResult.content, sanitizeOpts);

          const sanitizedChunk: TextChunk = {
            ...parsed,
            data: clientResult.content,
          };

          controller.enqueue(encoder.encode(encodeChunk(sanitizedChunk)));
        } else if (buffer.trim()) {
          controller.enqueue(encoder.encode(buffer));
        }
      }
    },
  });
}

/**
 * Pipe a stream through sanitization
 */
export function pipeWithSanitization(
  source: ReadableStream<Uint8Array>,
  options?: SanitizeOptions
): ReadableStream<Uint8Array> {
  return source.pipeThrough(createSanitizingTransform(options));
}

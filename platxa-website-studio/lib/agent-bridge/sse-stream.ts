/**
 * SSE (Server-Sent Events) Streaming for Real-Time Generation Progress
 *
 * Provides a typed SSE event emitter and client consumer for streaming
 * generation progress updates and token-by-token output to the chat UI.
 */

// =============================================================================
// Types
// =============================================================================

/** SSE event types for generation progress */
export type SSEEventType =
  | "progress"      // Phase/step progress update
  | "token"         // Individual token from LLM
  | "section"       // Completed section result
  | "error"         // Error during generation
  | "done"          // Generation complete
  | "heartbeat";    // Keep-alive ping

/** Base SSE event */
export interface SSEEvent<T = unknown> {
  /** Event type */
  type: SSEEventType;
  /** Event payload */
  data: T;
  /** ISO timestamp */
  timestamp: string;
  /** Unique event ID */
  id: string;
}

/** Progress event data - emitted every 500ms during execution */
export interface ProgressData {
  /** Current phase label */
  phase: string;
  /** Current step description */
  step: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Human-readable status message */
  message: string;
}

/** Token event data */
export interface TokenData {
  /** The token text */
  token: string;
  /** Target: "html" | "scss" | "chat" */
  target: string;
  /** Section being generated (if applicable) */
  sectionId?: string;
  /** Cumulative token count */
  tokenIndex: number;
}

/** Section complete event data */
export interface SectionCompleteData {
  /** Section type */
  sectionType: string;
  /** Snippet ID */
  snippetId: string;
  /** Generated HTML */
  html: string;
  /** Generated SCSS */
  scss: string;
  /** Whether section passed validation */
  isValid: boolean;
}

/** Error event data */
export interface ErrorData {
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
}

/** Done event data */
export interface DoneData {
  /** Total sections generated */
  totalSections: number;
  /** Total tokens generated */
  totalTokens: number;
  /** Total duration in ms */
  durationMs: number;
  /** Whether generation succeeded */
  success: boolean;
}

// =============================================================================
// SSE Formatter
// =============================================================================

let eventCounter = 0;

/**
 * Resets the event ID counter (for testing).
 */
export function resetEventCounter(): void {
  eventCounter = 0;
}

/**
 * Creates a typed SSE event with auto-generated ID and timestamp.
 */
export function createSSEEvent<T>(type: SSEEventType, data: T): SSEEvent<T> {
  eventCounter++;
  return {
    type,
    data,
    timestamp: new Date().toISOString(),
    id: `evt_${eventCounter}`,
  };
}

/**
 * Formats an SSE event into the wire format (text/event-stream).
 * Follows the SSE specification: https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export function formatSSE(event: SSEEvent): string {
  const lines: string[] = [];
  lines.push(`id: ${event.id}`);
  lines.push(`event: ${event.type}`);

  const jsonData = JSON.stringify(event.data);
  // Split multi-line data per SSE spec
  for (const line of jsonData.split("\n")) {
    lines.push(`data: ${line}`);
  }

  lines.push(""); // Trailing newline to separate events
  return lines.join("\n") + "\n";
}

/**
 * Parses an SSE wire-format string back into an SSEEvent.
 */
export function parseSSE(raw: string): SSEEvent | null {
  const lines = raw.trim().split("\n");
  let id = "";
  let type: SSEEventType = "heartbeat";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("id: ")) {
      id = line.slice(4);
    } else if (line.startsWith("event: ")) {
      type = line.slice(7) as SSEEventType;
    } else if (line.startsWith("data: ")) {
      dataLines.push(line.slice(6));
    }
  }

  if (!id && dataLines.length === 0) return null;

  let data: unknown = null;
  if (dataLines.length > 0) {
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      data = dataLines.join("\n");
    }
  }

  return { id, type, data, timestamp: new Date().toISOString() };
}

// =============================================================================
// SSE Emitter (Server-side)
// =============================================================================

/** Callback that sends raw SSE text to the client */
export type SSEWriter = (chunk: string) => void;

/**
 * Creates an SSE emitter that formats and sends typed events.
 */
export function createSSEEmitter(writer: SSEWriter) {
  let tokenCount = 0;
  let closed = false;

  return {
    /** Send a progress update */
    progress(phase: string, step: string, percentage: number, message: string): void {
      if (closed) return;
      const event = createSSEEvent<ProgressData>("progress", { phase, step, percentage, message });
      writer(formatSSE(event));
    },

    /** Send a token */
    token(token: string, target: string, sectionId?: string): void {
      if (closed) return;
      tokenCount++;
      const event = createSSEEvent<TokenData>("token", {
        token, target, sectionId, tokenIndex: tokenCount,
      });
      writer(formatSSE(event));
    },

    /** Send a completed section */
    section(data: SectionCompleteData): void {
      if (closed) return;
      const event = createSSEEvent<SectionCompleteData>("section", data);
      writer(formatSSE(event));
    },

    /** Send an error */
    error(message: string, code: string, recoverable = false): void {
      if (closed) return;
      const event = createSSEEvent<ErrorData>("error", { message, code, recoverable });
      writer(formatSSE(event));
    },

    /** Send done and close */
    done(totalSections: number, durationMs: number, success: boolean): void {
      if (closed) return;
      const event = createSSEEvent<DoneData>("done", {
        totalSections, totalTokens: tokenCount, durationMs, success,
      });
      writer(formatSSE(event));
      closed = true;
    },

    /** Send heartbeat */
    heartbeat(): void {
      if (closed) return;
      const event = createSSEEvent("heartbeat", { alive: true });
      writer(formatSSE(event));
    },

    /** Get current token count */
    getTokenCount(): number {
      return tokenCount;
    },

    /** Whether the emitter is closed */
    isClosed(): boolean {
      return closed;
    },
  };
}

// =============================================================================
// SSE Consumer (Client-side)
// =============================================================================

/** Event handler map for the SSE consumer */
export interface SSEHandlers {
  onProgress?: (data: ProgressData) => void;
  onToken?: (data: TokenData) => void;
  onSection?: (data: SectionCompleteData) => void;
  onError?: (data: ErrorData) => void;
  onDone?: (data: DoneData) => void;
}

/**
 * Creates an SSE consumer that parses incoming events and dispatches
 * to typed handlers. Works with EventSource or manual fetch streaming.
 */
export function createSSEConsumer(handlers: SSEHandlers) {
  return {
    /** Process a raw SSE event string */
    processEvent(raw: string): void {
      const event = parseSSE(raw);
      if (!event) return;
      this.dispatch(event);
    },

    /** Dispatch a parsed event to handlers */
    dispatch(event: SSEEvent): void {
      switch (event.type) {
        case "progress":
          handlers.onProgress?.(event.data as ProgressData);
          break;
        case "token":
          handlers.onToken?.(event.data as TokenData);
          break;
        case "section":
          handlers.onSection?.(event.data as SectionCompleteData);
          break;
        case "error":
          handlers.onError?.(event.data as ErrorData);
          break;
        case "done":
          handlers.onDone?.(event.data as DoneData);
          break;
      }
    },
  };
}

// =============================================================================
// Progress Interval Emitter (500ms)
// =============================================================================

/** Progress state for interval emission */
export interface ProgressState {
  phase: string;
  step: string;
  percentage: number;
  message: string;
}

/** Default progress emission interval in milliseconds */
export const PROGRESS_INTERVAL_MS = 500;

/**
 * Creates a progress emitter that streams updates every 500ms.
 * Wraps an SSE emitter and provides state management for progress tracking.
 */
export function createProgressIntervalEmitter(writer: SSEWriter) {
  const emitter = createSSEEmitter(writer);
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let currentState: ProgressState = {
    phase: "init",
    step: "",
    percentage: 0,
    message: "Initializing...",
  };

  return {
    /**
     * Start emitting progress events every 500ms.
     * Events contain { phase, step, percentage, message }.
     */
    start(): void {
      if (intervalId) return; // Already running

      // Emit immediately on start
      emitter.progress(
        currentState.phase,
        currentState.step,
        currentState.percentage,
        currentState.message
      );

      // Then emit every 500ms
      intervalId = setInterval(() => {
        if (!emitter.isClosed()) {
          emitter.progress(
            currentState.phase,
            currentState.step,
            currentState.percentage,
            currentState.message
          );
        }
      }, PROGRESS_INTERVAL_MS);
    },

    /**
     * Update the current progress state.
     * Next interval emission will use these values.
     */
    update(state: Partial<ProgressState>): void {
      currentState = { ...currentState, ...state };
    },

    /**
     * Stop the interval emission.
     */
    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },

    /**
     * Get the current progress state.
     */
    getState(): ProgressState {
      return { ...currentState };
    },

    /**
     * Get the underlying SSE emitter for other event types.
     */
    getEmitter() {
      return emitter;
    },

    /**
     * Check if interval emission is active.
     */
    isRunning(): boolean {
      return intervalId !== null;
    },
  };
}

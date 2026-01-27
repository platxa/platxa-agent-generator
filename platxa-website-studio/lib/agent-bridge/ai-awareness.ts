/**
 * AI Awareness Protocol
 *
 * Manages Yjs awareness state to show AI editing indicators to users.
 * When the AI agent is actively editing a document, this sets awareness
 * fields (cursor position, editing status, phase) that connected clients
 * can render as pulsing indicators in the editor UI.
 *
 * Uses the standard Yjs awareness protocol from y-protocols.
 */

import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

// =============================================================================
// Types
// =============================================================================

/** AI editing phases visible to users */
export type AiEditingPhase =
  | "idle"
  | "analyzing"
  | "generating"
  | "writing"
  | "complete";

/** AI awareness state broadcast to all connected clients */
export interface AiAwarenessState {
  /** Identifies this client as the AI agent */
  isAi: true;
  /** Display name shown in collaboration UI */
  name: string;
  /** Hex color for the AI cursor/indicator */
  color: string;
  /** Current editing phase */
  phase: AiEditingPhase;
  /** Human-readable status message */
  message: string;
  /** File path being edited (null when idle) */
  filePath: string | null;
  /** Cursor position in the document (character offset) */
  cursorPosition: number | null;
  /** Selection range (start, end) when AI is highlighting code */
  selectionRange: { start: number; end: number } | null;
  /** Timestamp of last activity */
  lastActivity: string;
}

/** Configuration for the AI awareness manager */
export interface AiAwarenessConfig {
  /** Display name for the AI agent (default: "Platxa AI") */
  name?: string;
  /** Cursor color for the AI agent (default: "#7c3aed") */
  color?: string;
  /** Auto-clear idle state after ms (default: 30000) */
  idleTimeoutMs?: number;
}

// =============================================================================
// AI Awareness Manager
// =============================================================================

/**
 * Manages AI editing awareness state on a Yjs document.
 *
 * Usage:
 * ```typescript
 * const doc = new Y.Doc();
 * const awareness = new Awareness(doc);
 * const aiAwareness = new AiAwarenessManager(awareness);
 *
 * aiAwareness.setEditing("views/pages.xml", "generating", "Generating hero section...");
 * // ... AI writes content ...
 * aiAwareness.setComplete("views/pages.xml");
 * // ... after timeout, automatically goes idle
 * aiAwareness.dispose();
 * ```
 */
export class AiAwarenessManager {
  private awareness: Awareness;
  private config: Required<AiAwarenessConfig>;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(awareness: Awareness, config?: AiAwarenessConfig) {
    this.awareness = awareness;
    this.config = {
      name: config?.name ?? "Platxa AI",
      color: config?.color ?? "#7c3aed",
      idleTimeoutMs: config?.idleTimeoutMs ?? 30000,
    };

    // Set initial idle state
    this.setIdle();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Sets the AI as actively editing a file.
   * Connected clients will see a pulsing indicator at the cursor position.
   */
  setEditing(
    filePath: string,
    phase: AiEditingPhase,
    message: string,
    cursorPosition?: number,
    selectionRange?: { start: number; end: number },
  ): void {
    this.clearIdleTimer();

    const state: AiAwarenessState = {
      isAi: true,
      name: this.config.name,
      color: this.config.color,
      phase,
      message,
      filePath,
      cursorPosition: cursorPosition ?? null,
      selectionRange: selectionRange ?? null,
      lastActivity: new Date().toISOString(),
    };

    this.awareness.setLocalState(state);
  }

  /**
   * Marks the AI as having completed editing a file.
   * Starts the idle timeout to auto-clear the indicator.
   */
  setComplete(filePath: string, message?: string): void {
    const state: AiAwarenessState = {
      isAi: true,
      name: this.config.name,
      color: this.config.color,
      phase: "complete",
      message: message ?? `Finished editing ${filePath}`,
      filePath,
      cursorPosition: null,
      selectionRange: null,
      lastActivity: new Date().toISOString(),
    };

    this.awareness.setLocalState(state);
    this.scheduleIdle();
  }

  /**
   * Sets the AI to idle (no active editing).
   * Clears cursor position and file path.
   */
  setIdle(): void {
    this.clearIdleTimer();

    const state: AiAwarenessState = {
      isAi: true,
      name: this.config.name,
      color: this.config.color,
      phase: "idle",
      message: "",
      filePath: null,
      cursorPosition: null,
      selectionRange: null,
      lastActivity: new Date().toISOString(),
    };

    this.awareness.setLocalState(state);
  }

  /**
   * Returns the current AI awareness state.
   */
  getState(): AiAwarenessState | null {
    const state = this.awareness.getLocalState();
    if (state && typeof state === "object" && "isAi" in state) {
      return state as AiAwarenessState;
    }
    return null;
  }

  /**
   * Returns all awareness states from connected clients.
   * Useful for checking if other users are viewing the same file.
   */
  getAllStates(): Map<number, AiAwarenessState> {
    const result = new Map<number, AiAwarenessState>();
    for (const [clientId, state] of this.awareness.getStates()) {
      if (state && typeof state === "object" && "isAi" in state) {
        result.set(clientId, state as AiAwarenessState);
      }
    }
    return result;
  }

  /**
   * Returns the underlying Yjs Awareness instance.
   */
  getAwareness(): Awareness {
    return this.awareness;
  }

  /**
   * Cleans up timers and sets state to idle.
   */
  dispose(): void {
    this.clearIdleTimer();
    this.setIdle();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private scheduleIdle(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.setIdle();
    }, this.config.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

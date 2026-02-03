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

import { Y, Awareness, type AwarenessType } from "@/lib/yjs-singleton";

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

/** User type for awareness state */
export type AwarenessUserType = "human" | "agent";

/** AI awareness state broadcast to all connected clients */
export interface AiAwarenessState {
  /** Identifies this client as the AI agent */
  isAi: true;
  /** User type for explicit distinction */
  userType: "agent";
  /** Unique session ID for this agent instance */
  sessionId: string;
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

/** Human user awareness state (for type distinction) */
export interface HumanAwarenessState {
  /** Identifies this client as a human user */
  isAi?: false;
  /** User type for explicit distinction */
  userType: "human";
  /** Display name */
  name: string;
  /** Cursor color */
  color: string;
  /** User ID (optional) */
  userId?: string;
}

/** Configuration for the AI awareness manager */
export interface AiAwarenessConfig {
  /** Display name for the AI agent (default: "Platxa AI") */
  name?: string;
  /** Cursor color for the AI agent (default: "#7c3aed") */
  color?: string;
  /** Auto-clear idle state after ms (default: 30000) */
  idleTimeoutMs?: number;
  /** Custom session ID (auto-generated if not provided) */
  sessionId?: string;
}

// =============================================================================
// Session ID Generation
// =============================================================================

/**
 * Generates a unique session ID for an agent instance.
 * Format: "agent_<timestamp>_<random>"
 */
export function generateAgentSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `agent_${timestamp}_${random}`;
}

/**
 * Checks if a session ID belongs to an agent.
 */
export function isAgentSessionId(sessionId: string): boolean {
  return sessionId.startsWith("agent_");
}

/**
 * Checks if an awareness state belongs to an AI agent.
 */
export function isAgentAwarenessState(
  state: unknown
): state is AiAwarenessState {
  return (
    state !== null &&
    typeof state === "object" &&
    "isAi" in state &&
    (state as AiAwarenessState).isAi === true &&
    "userType" in state &&
    (state as AiAwarenessState).userType === "agent" &&
    "sessionId" in state &&
    typeof (state as AiAwarenessState).sessionId === "string"
  );
}

/**
 * Checks if an awareness state belongs to a human user.
 */
export function isHumanAwarenessState(
  state: unknown
): state is HumanAwarenessState {
  if (state === null || typeof state !== "object") return false;

  // Explicitly marked as human
  if ("userType" in state && (state as HumanAwarenessState).userType === "human") {
    return true;
  }

  // Not an AI agent (legacy compatibility)
  if (!("isAi" in state) || (state as { isAi?: boolean }).isAi !== true) {
    return true;
  }

  return false;
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
  private awareness: AwarenessType;
  private config: Required<AiAwarenessConfig>;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly sessionId: string;

  constructor(awareness: AwarenessType, config?: AiAwarenessConfig) {
    this.awareness = awareness;
    this.sessionId = config?.sessionId ?? generateAgentSessionId();
    this.config = {
      name: config?.name ?? "Platxa AI",
      color: config?.color ?? "#7c3aed",
      idleTimeoutMs: config?.idleTimeoutMs ?? 30000,
      sessionId: this.sessionId,
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
      userType: "agent",
      sessionId: this.sessionId,
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
      userType: "agent",
      sessionId: this.sessionId,
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
      userType: "agent",
      sessionId: this.sessionId,
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
  getAwareness(): AwarenessType {
    return this.awareness;
  }

  /**
   * Returns the unique session ID for this agent instance.
   * This distinguishes this agent from other agents and human users.
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Returns the Yjs client ID for this awareness instance.
   * This is the internal Yjs identifier used in the awareness protocol.
   */
  getClientId(): number {
    return this.awareness.clientID;
  }

  /**
   * Checks if a given awareness state belongs to this agent instance.
   */
  isOwnState(state: unknown): boolean {
    return (
      isAgentAwarenessState(state) &&
      state.sessionId === this.sessionId
    );
  }

  /**
   * Returns all human user awareness states (excluding AI agents).
   */
  getHumanStates(): Map<number, HumanAwarenessState> {
    const result = new Map<number, HumanAwarenessState>();
    for (const [clientId, state] of this.awareness.getStates()) {
      if (isHumanAwarenessState(state)) {
        result.set(clientId, state as HumanAwarenessState);
      }
    }
    return result;
  }

  /**
   * Returns all AI agent awareness states (excluding human users).
   */
  getAgentStates(): Map<number, AiAwarenessState> {
    const result = new Map<number, AiAwarenessState>();
    for (const [clientId, state] of this.awareness.getStates()) {
      if (isAgentAwarenessState(state)) {
        result.set(clientId, state as AiAwarenessState);
      }
    }
    return result;
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

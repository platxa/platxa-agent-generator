/**
 * Mode Manager — Chat/Agent/Visual Mode State Machine
 *
 * Manages operational mode transitions for Lovable-style workflow:
 * - Chat Mode: Read-only planning, no code changes
 * - Agent Mode: Autonomous implementation with file writes
 * - Visual Mode: Direct DOM manipulation with property panels
 *
 * Persists state to localStorage and emits events on transitions.
 */

// =============================================================================
// Types
// =============================================================================

/** Operational modes matching Lovable's three-mode system */
export type OperationalMode = "chat" | "agent" | "visual";

/** Mode transition event */
export interface ModeChangeEvent {
  previousMode: OperationalMode;
  currentMode: OperationalMode;
  /** Alias for currentMode (for backwards compatibility) */
  to: OperationalMode;
  /** Alias for previousMode (for backwards compatibility) */
  from: OperationalMode;
  timestamp: number;
  triggeredBy: "user" | "system" | "auto";
}

/** Mode capabilities - what each mode can do */
export interface ModeCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canSearch: boolean;
  canInspectLogs: boolean;
  canInspectNetwork: boolean;
  canGenerateImages: boolean;
  canEditVisually: boolean;
  canExecutePlans: boolean;
}

/** Mode configuration */
export interface ModeConfig {
  mode: OperationalMode;
  label: string;
  description: string;
  icon: string;
  shortcut: string;
  capabilities: ModeCapabilities;
}

/** Mode manager state */
export interface ModeManagerState {
  currentMode: OperationalMode;
  previousMode: OperationalMode | null;
  modeHistory: ModeChangeEvent[];
  lastTransition: number;
  isTransitioning: boolean;
}

/** Event listener type */
export type ModeChangeListener = (event: ModeChangeEvent) => void;

// =============================================================================
// Constants
// =============================================================================

/** Mode configurations with capabilities */
export const MODE_CONFIGS: Record<OperationalMode, ModeConfig> = {
  chat: {
    mode: "chat",
    label: "Chat",
    description: "Plan and discuss without making changes",
    icon: "💬",
    shortcut: "⌘1",
    capabilities: {
      canRead: true,
      canWrite: false,
      canSearch: true,
      canInspectLogs: true,
      canInspectNetwork: true,
      canGenerateImages: false,
      canEditVisually: false,
      canExecutePlans: false,
    },
  },
  agent: {
    mode: "agent",
    label: "Agent",
    description: "AI implements changes autonomously",
    icon: "🤖",
    shortcut: "⌘2",
    capabilities: {
      canRead: true,
      canWrite: true,
      canSearch: true,
      canInspectLogs: true,
      canInspectNetwork: true,
      canGenerateImages: true,
      canEditVisually: false,
      canExecutePlans: true,
    },
  },
  visual: {
    mode: "visual",
    label: "Visual",
    description: "Edit elements directly in the preview",
    icon: "🎨",
    shortcut: "⌘3",
    capabilities: {
      canRead: true,
      canWrite: true,
      canSearch: false,
      canInspectLogs: false,
      canInspectNetwork: false,
      canGenerateImages: false,
      canEditVisually: true,
      canExecutePlans: false,
    },
  },
};

/** Default mode when starting fresh */
export const DEFAULT_MODE: OperationalMode = "chat";

/** Storage key for persistence */
const STORAGE_KEY = "platxa-mode-manager-state";

/** Maximum history entries to keep */
const MAX_HISTORY_ENTRIES = 50;

// =============================================================================
// ModeManager Class
// =============================================================================

/**
 * ModeManager handles operational mode state transitions with persistence.
 *
 * Usage:
 * ```ts
 * const manager = new ModeManager();
 *
 * // Listen for mode changes
 * manager.on("modeChange", (event) => {
 *   console.log(`Mode changed: ${event.previousMode} → ${event.currentMode}`);
 * });
 *
 * // Switch modes
 * manager.setMode("agent");
 *
 * // Check capabilities
 * if (manager.can("write")) {
 *   // Perform write operation
 * }
 * ```
 */
export class ModeManager {
  private state: ModeManagerState;
  private listeners: Set<ModeChangeListener> = new Set();
  private storage: Storage | null = null;

  constructor(initialMode?: OperationalMode) {
    // Initialize storage (client-side only)
    if (typeof window !== "undefined") {
      this.storage = window.localStorage;
    }

    // Load persisted state or create fresh
    const persisted = this.loadState();
    this.state = persisted || {
      currentMode: initialMode || DEFAULT_MODE,
      previousMode: null,
      modeHistory: [],
      lastTransition: Date.now(),
      isTransitioning: false,
    };

    // Persist initial state if new
    if (!persisted) {
      this.saveState();
    }
  }

  // ---------------------------------------------------------------------------
  // State Access
  // ---------------------------------------------------------------------------

  /** Get current operational mode */
  getMode(): OperationalMode {
    return this.state.currentMode;
  }

  /** Alias for getMode() (for backwards compatibility) */
  getCurrentMode(): OperationalMode {
    return this.state.currentMode;
  }

  /** Get previous mode (null if first mode) */
  getPreviousMode(): OperationalMode | null {
    return this.state.previousMode;
  }

  /** Get current mode configuration */
  getModeConfig(): ModeConfig {
    return MODE_CONFIGS[this.state.currentMode];
  }

  /** Get all mode configurations */
  getAllModeConfigs(): ModeConfig[] {
    return Object.values(MODE_CONFIGS);
  }

  /** Get mode history (most recent first) */
  getHistory(): ModeChangeEvent[] {
    return [...this.state.modeHistory].reverse();
  }

  /** Check if currently transitioning */
  isTransitioning(): boolean {
    return this.state.isTransitioning;
  }

  // ---------------------------------------------------------------------------
  // Capability Checks
  // ---------------------------------------------------------------------------

  /** Check if current mode has a specific capability */
  can(capability: keyof ModeCapabilities): boolean {
    const config = MODE_CONFIGS[this.state.currentMode];
    return config.capabilities[capability];
  }

  /** Get all capabilities for current mode */
  getCapabilities(): ModeCapabilities {
    return { ...MODE_CONFIGS[this.state.currentMode].capabilities };
  }

  /** Check if a mode transition is valid */
  canTransitionTo(targetMode: OperationalMode): boolean {
    // All transitions are valid in this implementation
    // Could add restrictions here (e.g., can't go from visual to agent directly)
    return targetMode !== this.state.currentMode && !this.state.isTransitioning;
  }

  // ---------------------------------------------------------------------------
  // Mode Transitions
  // ---------------------------------------------------------------------------

  /**
   * Set the operational mode.
   * @param mode - Target mode
   * @param triggeredBy - What triggered the transition
   * @returns true if transition succeeded
   */
  setMode(
    mode: OperationalMode,
    triggeredBy: "user" | "system" | "auto" = "user"
  ): boolean {
    if (!this.canTransitionTo(mode)) {
      return false;
    }

    const previousMode = this.state.currentMode;
    const timestamp = Date.now();

    // Create transition event
    const event: ModeChangeEvent = {
      previousMode,
      currentMode: mode,
      to: mode,
      from: previousMode,
      timestamp,
      triggeredBy,
    };

    // Update state
    this.state = {
      ...this.state,
      currentMode: mode,
      previousMode,
      modeHistory: [...this.state.modeHistory, event].slice(-MAX_HISTORY_ENTRIES),
      lastTransition: timestamp,
      isTransitioning: false,
    };

    // Persist state
    this.saveState();

    // Emit event to listeners
    this.emit(event);

    return true;
  }

  /** Switch to Chat mode */
  toChatMode(triggeredBy: "user" | "system" | "auto" = "user"): boolean {
    return this.setMode("chat", triggeredBy);
  }

  /** Switch to Agent mode */
  toAgentMode(triggeredBy: "user" | "system" | "auto" = "user"): boolean {
    return this.setMode("agent", triggeredBy);
  }

  /** Switch to Visual mode */
  toVisualMode(triggeredBy: "user" | "system" | "auto" = "user"): boolean {
    return this.setMode("visual", triggeredBy);
  }

  /** Toggle between Chat and Agent modes */
  toggleChatAgent(): boolean {
    if (this.state.currentMode === "chat") {
      return this.setMode("agent", "user");
    } else {
      return this.setMode("chat", "user");
    }
  }

  /** Return to previous mode */
  goBack(): boolean {
    if (this.state.previousMode) {
      return this.setMode(this.state.previousMode, "user");
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  /** Subscribe to mode change events */
  on(event: "modeChange", listener: ModeChangeListener): () => void;
  on(listener: ModeChangeListener): () => void;
  on(
    eventOrListener: "modeChange" | ModeChangeListener,
    listener?: ModeChangeListener
  ): () => void {
    const actualListener = typeof eventOrListener === "function" ? eventOrListener : listener!;
    this.listeners.add(actualListener);
    return () => this.listeners.delete(actualListener);
  }

  /** Unsubscribe from mode change events */
  off(event: "modeChange", listener: ModeChangeListener): void {
    this.listeners.delete(listener);
  }

  /** Emit mode change event to all listeners */
  private emit(event: ModeChangeEvent): void {
    // Convert Set to array for ES5 compatibility
    const listeners = Array.from(this.listeners);
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[ModeManager] Listener error:", error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /** Load state from storage */
  private loadState(): ModeManagerState | null {
    if (!this.storage) return null;

    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as ModeManagerState;

      // Validate loaded state structure
      if (!this.isValidState(parsed)) {
        console.warn("[ModeManager] Invalid persisted state, using defaults");
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn("[ModeManager] Failed to load persisted state:", error);
      return null;
    }
  }

  /** Validate state structure */
  private isValidState(state: unknown): state is ModeManagerState {
    if (!state || typeof state !== "object") return false;
    const s = state as Record<string, unknown>;

    // Required: valid currentMode
    if (typeof s.currentMode !== "string" || !MODE_CONFIGS[s.currentMode as OperationalMode]) {
      return false;
    }

    // Optional: previousMode must be valid if present
    if (s.previousMode !== null && typeof s.previousMode !== "undefined") {
      if (typeof s.previousMode !== "string" || !MODE_CONFIGS[s.previousMode as OperationalMode]) {
        return false;
      }
    }

    // Required: modeHistory must be array
    if (!Array.isArray(s.modeHistory)) return false;

    // Required: timestamps must be numbers
    if (typeof s.lastTransition !== "number") return false;
    if (typeof s.isTransitioning !== "boolean") return false;

    return true;
  }

  /** Save state to storage */
  private saveState(): void {
    if (!this.storage) return;

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error("[ModeManager] Failed to save state:", error);
    }
  }

  /** Clear persisted state */
  clearPersistedState(): void {
    if (this.storage) {
      this.storage.removeItem(STORAGE_KEY);
    }
  }

  /** Reset to default state */
  reset(): void {
    this.state = {
      currentMode: DEFAULT_MODE,
      previousMode: null,
      modeHistory: [],
      lastTransition: Date.now(),
      isTransitioning: false,
    };
    this.saveState();
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  /** Export state for debugging or backup */
  toJSON(): ModeManagerState {
    return { ...this.state };
  }

  /** Import state from JSON */
  fromJSON(state: ModeManagerState): void {
    if (this.isValidState(state)) {
      // Truncate history if too long
      const truncatedHistory = state.modeHistory.slice(-MAX_HISTORY_ENTRIES);
      this.state = { ...state, modeHistory: truncatedHistory };
      this.saveState();
    } else {
      console.warn("[ModeManager] Invalid state provided to fromJSON, ignoring");
    }
  }

  /** Clear all listeners (useful for testing) */
  clearAllListeners(): void {
    this.listeners.clear();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: ModeManager | null = null;

/**
 * Get the global ModeManager instance.
 * Creates one if it doesn't exist.
 */
export function getModeManager(): ModeManager {
  if (!_instance) {
    _instance = new ModeManager();
  }
  return _instance;
}

/**
 * Reset the global ModeManager instance.
 * Useful for testing.
 */
export function resetModeManager(): void {
  if (_instance) {
    _instance.clearPersistedState();
    _instance = null;
  }
}

// =============================================================================
// React Hook (for use in components)
// =============================================================================

/**
 * React hook for using ModeManager in components.
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { mode, setMode, can } = useModeManager();
 *
 *   return (
 *     <div>
 *       <p>Current mode: {mode}</p>
 *       <button onClick={() => setMode("agent")}>
 *         Switch to Agent
 *       </button>
 *       {can("write") && <button>Save</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function createModeManagerHook() {
  // This will be imported in a React context
  // Returns a factory for the actual hook to avoid React import issues in Node
  return function useModeManagerFactory(
    useState: <T>(initial: T | (() => T)) => [T, (v: T) => void],
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => void
  ) {
    return function useModeManager() {
      const manager = getModeManager();
      const [mode, setModeState] = useState<OperationalMode>(manager.getMode());

      useEffect(() => {
        const unsubscribe = manager.on("modeChange", (event) => {
          setModeState(event.currentMode);
        });
        return unsubscribe;
      }, []);

      return {
        mode,
        previousMode: manager.getPreviousMode(),
        config: manager.getModeConfig(),
        allConfigs: manager.getAllModeConfigs(),
        setMode: (m: OperationalMode) => manager.setMode(m, "user"),
        toChatMode: () => manager.toChatMode("user"),
        toAgentMode: () => manager.toAgentMode("user"),
        toVisualMode: () => manager.toVisualMode("user"),
        toggleChatAgent: () => manager.toggleChatAgent(),
        goBack: () => manager.goBack(),
        can: (capability: keyof ModeCapabilities) => manager.can(capability),
        capabilities: manager.getCapabilities(),
        isTransitioning: manager.isTransitioning(),
        history: manager.getHistory(),
      };
    };
  };
}

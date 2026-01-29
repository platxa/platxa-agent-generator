/**
 * Edit Conflict Prevention
 *
 * Prevents conflicts between human and AI concurrent edits:
 * - Detects human editing activity per file
 * - Pauses AI edits while human is active
 * - Resumes AI edits after human stops (debounced)
 */

// =============================================================================
// Types
// =============================================================================

/** Edit activity source */
export type EditSource = "human" | "ai";

/** File edit state */
export interface FileEditState {
  /** File path */
  filePath: string;
  /** Whether human is currently editing */
  humanActive: boolean;
  /** Whether AI is currently editing */
  aiActive: boolean;
  /** Whether AI is paused due to conflict */
  aiPaused: boolean;
  /** Timestamp of last human edit */
  lastHumanEdit: number;
  /** Timestamp of last AI edit */
  lastAIEdit: number;
  /** Number of times AI was paused for this file */
  pauseCount: number;
}

/** Conflict event types */
export type ConflictEventType =
  | "human:start"
  | "human:stop"
  | "ai:pause"
  | "ai:resume"
  | "conflict:detected"
  | "conflict:resolved";

/** Conflict event */
export interface ConflictEvent {
  /** Event type */
  type: ConflictEventType;
  /** File path */
  filePath: string;
  /** File state at event time */
  state: FileEditState;
  /** Event timestamp */
  timestamp: number;
}

/** Conflict event callback */
export type ConflictEventCallback = (event: ConflictEvent) => void;

/** Conflict prevention configuration */
export interface ConflictPreventionConfig {
  /** Debounce time before considering human stopped (ms) */
  humanStopDebounce: number;
  /** Grace period before AI resumes after human stops (ms) */
  resumeGracePeriod: number;
  /** Whether to auto-pause AI on human activity */
  autoPauseAI: boolean;
  /** Whether to auto-resume AI after human stops */
  autoResumeAI: boolean;
  /** Max time AI can be paused before alerting (ms, 0 = no limit) */
  maxPauseTime: number;
}

/** Pause request */
export interface PauseRequest {
  /** File path */
  filePath: string;
  /** Reason for pause */
  reason: string;
  /** Timestamp */
  timestamp: number;
}

/** Resume request */
export interface ResumeRequest {
  /** File path */
  filePath: string;
  /** Whether resume was automatic */
  automatic: boolean;
  /** Timestamp */
  timestamp: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: ConflictPreventionConfig = {
  humanStopDebounce: 1500, // 1.5 seconds of no edits = human stopped
  resumeGracePeriod: 500, // 0.5 seconds after debounce before AI resumes
  autoPauseAI: true,
  autoResumeAI: true,
  maxPauseTime: 30000, // 30 seconds max pause
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates initial file edit state.
 */
export function createFileEditState(filePath: string): FileEditState {
  return {
    filePath,
    humanActive: false,
    aiActive: false,
    aiPaused: false,
    lastHumanEdit: 0,
    lastAIEdit: 0,
    pauseCount: 0,
  };
}

/**
 * Clones file edit state (for immutability).
 */
export function cloneFileEditState(state: FileEditState): FileEditState {
  return { ...state };
}

/**
 * Checks if there's an active conflict.
 */
export function hasActiveConflict(state: FileEditState): boolean {
  return state.humanActive && state.aiActive;
}

/**
 * Checks if AI should be paused.
 */
export function shouldPauseAI(state: FileEditState): boolean {
  return state.humanActive && !state.aiPaused;
}

/**
 * Checks if AI can resume.
 */
export function canResumeAI(state: FileEditState): boolean {
  return state.aiPaused && !state.humanActive;
}

/**
 * Gets time since last human edit.
 */
export function timeSinceHumanEdit(state: FileEditState): number {
  return Date.now() - state.lastHumanEdit;
}

/**
 * Gets time AI has been paused.
 */
export function getAIPauseDuration(state: FileEditState): number {
  if (!state.aiPaused) return 0;
  return Date.now() - state.lastHumanEdit;
}

// =============================================================================
// ConflictPreventionManager Class
// =============================================================================

/**
 * Manages conflict prevention between human and AI edits.
 */
export class ConflictPreventionManager {
  private config: ConflictPreventionConfig;
  private fileStates: Map<string, FileEditState> = new Map();
  private callbacks: ConflictEventCallback[] = [];
  private humanStopTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private resumeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pauseCheckTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(config: Partial<ConflictPreventionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Records human edit activity.
   */
  recordHumanEdit(filePath: string): void {
    let state = this.getOrCreateState(filePath);
    const wasActive = state.humanActive;

    state.humanActive = true;
    state.lastHumanEdit = Date.now();
    this.fileStates.set(filePath, state);

    // Cancel any pending resume
    this.clearResumeTimer(filePath);

    // Reset human stop debounce
    this.resetHumanStopTimer(filePath);

    // Emit start event if newly active
    if (!wasActive) {
      this.emit({
        type: "human:start",
        filePath,
        state: cloneFileEditState(state),
        timestamp: Date.now(),
      });
    }

    // Check for conflict
    if (state.aiActive) {
      this.emit({
        type: "conflict:detected",
        filePath,
        state: cloneFileEditState(state),
        timestamp: Date.now(),
      });

      if (this.config.autoPauseAI) {
        this.pauseAI(filePath, "Human editing same file");
      }
    }
  }

  /**
   * Records AI edit activity.
   */
  recordAIEdit(filePath: string): void {
    let state = this.getOrCreateState(filePath);

    // Don't record if paused
    if (state.aiPaused) {
      return;
    }

    state.aiActive = true;
    state.lastAIEdit = Date.now();
    this.fileStates.set(filePath, state);

    // Check for conflict
    if (state.humanActive) {
      this.emit({
        type: "conflict:detected",
        filePath,
        state: cloneFileEditState(state),
        timestamp: Date.now(),
      });

      if (this.config.autoPauseAI) {
        this.pauseAI(filePath, "Human editing same file");
      }
    }
  }

  /**
   * Pauses AI editing for a file.
   */
  pauseAI(filePath: string, reason: string): PauseRequest {
    const state = this.getOrCreateState(filePath);

    if (!state.aiPaused) {
      state.aiPaused = true;
      state.pauseCount++;
      this.fileStates.set(filePath, state);

      this.emit({
        type: "ai:pause",
        filePath,
        state: cloneFileEditState(state),
        timestamp: Date.now(),
      });

      // Set up max pause time check
      if (this.config.maxPauseTime > 0) {
        this.schedulePauseCheck(filePath);
      }
    }

    return {
      filePath,
      reason,
      timestamp: Date.now(),
    };
  }

  /**
   * Resumes AI editing for a file.
   */
  resumeAI(filePath: string, automatic: boolean = false): ResumeRequest {
    const state = this.fileStates.get(filePath);

    if (state && state.aiPaused) {
      state.aiPaused = false;
      this.fileStates.set(filePath, state);

      this.clearPauseCheckTimer(filePath);

      this.emit({
        type: "ai:resume",
        filePath,
        state: cloneFileEditState(state),
        timestamp: Date.now(),
      });

      // Emit conflict resolved if human no longer active
      if (!state.humanActive) {
        this.emit({
          type: "conflict:resolved",
          filePath,
          state: cloneFileEditState(state),
          timestamp: Date.now(),
        });
      }
    }

    return {
      filePath,
      automatic,
      timestamp: Date.now(),
    };
  }

  /**
   * Marks AI as done editing a file.
   */
  endAIEdit(filePath: string): void {
    const state = this.fileStates.get(filePath);
    if (state) {
      state.aiActive = false;
      state.aiPaused = false;
      this.fileStates.set(filePath, state);
      this.clearPauseCheckTimer(filePath);
    }
  }

  /**
   * Checks if AI can edit a file.
   */
  canAIEdit(filePath: string): boolean {
    const state = this.fileStates.get(filePath);
    if (!state) return true;
    return !state.humanActive && !state.aiPaused;
  }

  /**
   * Checks if AI is paused for a file.
   */
  isAIPaused(filePath: string): boolean {
    return this.fileStates.get(filePath)?.aiPaused ?? false;
  }

  /**
   * Checks if human is editing a file.
   */
  isHumanEditing(filePath: string): boolean {
    return this.fileStates.get(filePath)?.humanActive ?? false;
  }

  /**
   * Gets file edit state.
   */
  getFileState(filePath: string): FileEditState | null {
    const state = this.fileStates.get(filePath);
    return state ? cloneFileEditState(state) : null;
  }

  /**
   * Gets all file states.
   */
  getAllFileStates(): FileEditState[] {
    return Array.from(this.fileStates.values()).map(cloneFileEditState);
  }

  /**
   * Gets files with active conflicts.
   */
  getConflictingFiles(): string[] {
    return Array.from(this.fileStates.entries())
      .filter(([_, state]) => hasActiveConflict(state))
      .map(([filePath]) => filePath);
  }

  /**
   * Gets files where AI is paused.
   */
  getPausedFiles(): string[] {
    return Array.from(this.fileStates.entries())
      .filter(([_, state]) => state.aiPaused)
      .map(([filePath]) => filePath);
  }

  /**
   * Clears state for a file.
   */
  clearFileState(filePath: string): void {
    this.fileStates.delete(filePath);
    this.clearHumanStopTimer(filePath);
    this.clearResumeTimer(filePath);
    this.clearPauseCheckTimer(filePath);
  }

  /**
   * Clears all state.
   */
  clearAllState(): void {
    this.fileStates.clear();
    this.humanStopTimers.forEach((timer) => clearTimeout(timer));
    this.humanStopTimers.clear();
    this.resumeTimers.forEach((timer) => clearTimeout(timer));
    this.resumeTimers.clear();
    this.pauseCheckTimers.forEach((timer) => clearTimeout(timer));
    this.pauseCheckTimers.clear();
  }

  /**
   * Registers event callback.
   */
  onEvent(callback: ConflictEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: ConflictEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<ConflictPreventionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): ConflictPreventionConfig {
    return { ...this.config };
  }

  /**
   * Gets statistics.
   */
  getStats(): {
    totalFiles: number;
    conflictingFiles: number;
    pausedFiles: number;
    totalPauseCount: number;
  } {
    const states = Array.from(this.fileStates.values());
    return {
      totalFiles: states.length,
      conflictingFiles: states.filter(hasActiveConflict).length,
      pausedFiles: states.filter((s) => s.aiPaused).length,
      totalPauseCount: states.reduce((sum, s) => sum + s.pauseCount, 0),
    };
  }

  // Private methods

  private getOrCreateState(filePath: string): FileEditState {
    let state = this.fileStates.get(filePath);
    if (!state) {
      state = createFileEditState(filePath);
      this.fileStates.set(filePath, state);
    }
    return state;
  }

  private emit(event: ConflictEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private resetHumanStopTimer(filePath: string): void {
    this.clearHumanStopTimer(filePath);

    const timer = setTimeout(() => {
      this.handleHumanStop(filePath);
    }, this.config.humanStopDebounce);

    this.humanStopTimers.set(filePath, timer);
  }

  private clearHumanStopTimer(filePath: string): void {
    const timer = this.humanStopTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.humanStopTimers.delete(filePath);
    }
  }

  private handleHumanStop(filePath: string): void {
    const state = this.fileStates.get(filePath);
    if (!state) return;

    state.humanActive = false;
    this.fileStates.set(filePath, state);

    this.emit({
      type: "human:stop",
      filePath,
      state: cloneFileEditState(state),
      timestamp: Date.now(),
    });

    // Schedule AI resume if paused and auto-resume enabled
    if (state.aiPaused && this.config.autoResumeAI) {
      this.scheduleResume(filePath);
    }
  }

  private scheduleResume(filePath: string): void {
    this.clearResumeTimer(filePath);

    const timer = setTimeout(() => {
      const state = this.fileStates.get(filePath);
      // Only resume if still paused and human not active again
      if (state && state.aiPaused && !state.humanActive) {
        this.resumeAI(filePath, true);
      }
    }, this.config.resumeGracePeriod);

    this.resumeTimers.set(filePath, timer);
  }

  private clearResumeTimer(filePath: string): void {
    const timer = this.resumeTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.resumeTimers.delete(filePath);
    }
  }

  private schedulePauseCheck(filePath: string): void {
    this.clearPauseCheckTimer(filePath);

    const timer = setTimeout(() => {
      const state = this.fileStates.get(filePath);
      if (state && state.aiPaused) {
        // Emit a special event for long pause (could trigger alert)
        this.emit({
          type: "ai:pause",
          filePath,
          state: cloneFileEditState(state),
          timestamp: Date.now(),
        });
      }
    }, this.config.maxPauseTime);

    this.pauseCheckTimers.set(filePath, timer);
  }

  private clearPauseCheckTimer(filePath: string): void {
    const timer = this.pauseCheckTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.pauseCheckTimers.delete(filePath);
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a ConflictPreventionManager instance.
 */
export function createConflictPreventionManager(
  config?: Partial<ConflictPreventionConfig>
): ConflictPreventionManager {
  return new ConflictPreventionManager(config);
}

// =============================================================================
// Hook Integration
// =============================================================================

/**
 * Creates an edit handler that integrates with conflict prevention.
 */
export function createConflictAwareEditHandler(
  manager: ConflictPreventionManager,
  options: {
    onPause?: (filePath: string) => void;
    onResume?: (filePath: string) => void;
  } = {}
): {
  beforeHumanEdit: (filePath: string) => void;
  beforeAIEdit: (filePath: string) => boolean;
  afterAIEdit: (filePath: string) => void;
} {
  manager.onEvent((event) => {
    if (event.type === "ai:pause" && options.onPause) {
      options.onPause(event.filePath);
    }
    if (event.type === "ai:resume" && options.onResume) {
      options.onResume(event.filePath);
    }
  });

  return {
    beforeHumanEdit: (filePath: string) => {
      manager.recordHumanEdit(filePath);
    },

    beforeAIEdit: (filePath: string) => {
      if (!manager.canAIEdit(filePath)) {
        return false;
      }
      manager.recordAIEdit(filePath);
      return true;
    },

    afterAIEdit: (filePath: string) => {
      manager.endAIEdit(filePath);
    },
  };
}

/**
 * Creates a promise that resolves when AI can edit a file.
 */
export function waitForAIEditPermission(
  manager: ConflictPreventionManager,
  filePath: string,
  timeout: number = 30000
): Promise<boolean> {
  return new Promise((resolve) => {
    // If can already edit, resolve immediately
    if (manager.canAIEdit(filePath)) {
      resolve(true);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    const callback: ConflictEventCallback = (event) => {
      if (event.filePath === filePath && event.type === "ai:resume") {
        clearTimeout(timeoutId);
        manager.offEvent(callback);
        resolve(true);
      }
    };

    manager.onEvent(callback);

    timeoutId = setTimeout(() => {
      manager.offEvent(callback);
      resolve(false);
    }, timeout);
  });
}

/**
 * Exploration Session - Isolated context per plan mode session
 *
 * Feature #58: Implement exploration session isolation (separate context per session)
 * Verification: Each plan session has unique ID and isolated context
 *
 * Provides session management for plan mode explorations with:
 * - Unique session IDs
 * - Isolated context that doesn't bleed between sessions
 * - Session lifecycle management
 * - Session state persistence
 *
 * @module agentic-core/exploration-session
 */

import { ContextManager, type ContextManagerOptions } from './context-manager';
import type { AgentContext } from './agent-engine';

// ============================================================================
// Types
// ============================================================================

/** Session status */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'abandoned';

/** Session metadata */
export interface SessionMetadata {
  /** Session ID */
  id: string;
  /** Session name (optional, for display) */
  name?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Session status */
  status: SessionStatus;
  /** Associated goal/objective */
  goal?: string;
  /** Tags for organization */
  tags?: string[];
  /** Parent session ID (for nested explorations) */
  parentSessionId?: string;
}

/** Session snapshot for persistence */
export interface SessionSnapshot {
  /** Metadata */
  metadata: SessionMetadata;
  /** Serialized context */
  context: SerializedContext;
  /** Session notes */
  notes: string[];
  /** Checkpoint history */
  checkpoints: SessionCheckpoint[];
}

/** Serialized context for storage */
export interface SerializedContext {
  /** Files read (path -> content) */
  files: Record<string, string>;
  /** Search results (query -> serialized results) */
  searches: Record<string, string>;
  /** User preferences */
  preferences: Record<string, unknown>;
  /** Odoo context */
  odoo: Record<string, unknown>;
  /** Design tokens */
  designTokens: Record<string, unknown>;
  /** Plan mode flag */
  planMode: boolean;
}

/** Session checkpoint for recovery */
export interface SessionCheckpoint {
  /** Checkpoint ID */
  id: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Description */
  description: string;
  /** Serialized state at checkpoint */
  state: SerializedContext;
}

/** Options for creating a session */
export interface CreateSessionOptions {
  /** Optional session name */
  name?: string;
  /** Initial goal/objective */
  goal?: string;
  /** Tags for organization */
  tags?: string[];
  /** Parent session ID */
  parentSessionId?: string;
  /** Context manager options */
  contextOptions?: ContextManagerOptions;
  /** Initial context to load */
  initialContext?: Partial<AgentContext>;
}

/** Options for the session registry */
export interface SessionRegistryOptions {
  /** Maximum concurrent sessions (default: 10) */
  maxSessions?: number;
  /** Session timeout in milliseconds (default: 1 hour) */
  sessionTimeout?: number;
  /** Auto-cleanup abandoned sessions (default: true) */
  autoCleanup?: boolean;
  /** Cleanup interval in milliseconds (default: 5 minutes) */
  cleanupInterval?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_SESSIONS = 10;
const DEFAULT_SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
const DEFAULT_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// ExplorationSession Class
// ============================================================================

/**
 * ExplorationSession - Isolated context for a single plan mode exploration
 *
 * Each session has:
 * - Unique ID
 * - Isolated ContextManager instance
 * - Independent state that doesn't affect other sessions
 *
 * @example
 * ```typescript
 * const session = new ExplorationSession({
 *   name: 'Header redesign',
 *   goal: 'Explore options for redesigning the header',
 * });
 *
 * // Session has unique ID
 * console.log(session.getId()); // 'es_1706621234567_abc123'
 *
 * // Access isolated context
 * session.getContext().addFileContent('src/header.tsx', content);
 *
 * // Other sessions are completely isolated
 * const session2 = new ExplorationSession({ name: 'Footer work' });
 * session2.getContext().hasFile('src/header.tsx'); // false - isolated!
 * ```
 */
export class ExplorationSession {
  private readonly sessionId: string;
  private readonly context: ContextManager;
  private metadata: SessionMetadata;
  private notes: string[];
  private checkpoints: SessionCheckpoint[];

  constructor(options: CreateSessionOptions = {}) {
    // Generate unique session ID
    this.sessionId = this.generateSessionId();

    // Create isolated context manager
    this.context = new ContextManager(options.contextOptions);

    // Initialize with provided context if any
    if (options.initialContext) {
      this.context.initializeFrom(options.initialContext);
    }

    // Enable plan mode by default for exploration sessions
    this.context.setPlanMode(true);

    // Initialize metadata
    const now = new Date();
    this.metadata = {
      id: this.sessionId,
      name: options.name,
      createdAt: now,
      lastActivityAt: now,
      status: 'active',
      goal: options.goal,
      tags: options.tags,
      parentSessionId: options.parentSessionId,
    };

    this.notes = [];
    this.checkpoints = [];
  }

  // ==========================================================================
  // Identity
  // ==========================================================================

  /**
   * Get the unique session ID
   */
  getId(): string {
    return this.sessionId;
  }

  /**
   * Get session metadata
   */
  getMetadata(): SessionMetadata {
    return { ...this.metadata };
  }

  /**
   * Update session metadata
   */
  updateMetadata(update: Partial<Pick<SessionMetadata, 'name' | 'goal' | 'tags'>>): void {
    if (update.name !== undefined) this.metadata.name = update.name;
    if (update.goal !== undefined) this.metadata.goal = update.goal;
    if (update.tags !== undefined) this.metadata.tags = update.tags;
    this.touchActivity();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const random2 = Math.random().toString(36).substring(2, 6);
    return `es_${timestamp}_${random}${random2}`;
  }

  // ==========================================================================
  // Context Access (Isolated)
  // ==========================================================================

  /**
   * Get the isolated context manager for this session
   */
  getContext(): ContextManager {
    this.touchActivity();
    return this.context;
  }

  /**
   * Export current context as AgentContext
   */
  toAgentContext(): AgentContext {
    this.touchActivity();
    return this.context.toAgentContext();
  }

  /**
   * Check if context has any data
   */
  hasContext(): boolean {
    const stats = this.context.getStats();
    return stats.totalEntries > 0 || stats.filesCount > 0;
  }

  /**
   * Get context statistics
   */
  getContextStats() {
    return this.context.getStats();
  }

  // ==========================================================================
  // Session Status
  // ==========================================================================

  /**
   * Get current session status
   */
  getStatus(): SessionStatus {
    return this.metadata.status;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.metadata.status === 'active';
  }

  /**
   * Pause the session
   */
  pause(): void {
    this.metadata.status = 'paused';
    this.touchActivity();
  }

  /**
   * Resume a paused session
   */
  resume(): void {
    if (this.metadata.status === 'paused') {
      this.metadata.status = 'active';
      this.touchActivity();
    }
  }

  /**
   * Mark session as completed
   */
  complete(): void {
    this.metadata.status = 'completed';
    this.touchActivity();
  }

  /**
   * Mark session as abandoned
   */
  abandon(): void {
    this.metadata.status = 'abandoned';
    this.touchActivity();
  }

  /**
   * Update last activity timestamp
   */
  private touchActivity(): void {
    this.metadata.lastActivityAt = new Date();
  }

  // ==========================================================================
  // Notes
  // ==========================================================================

  /**
   * Add a note to the session
   */
  addNote(note: string): void {
    this.notes.push(note);
    this.touchActivity();
  }

  /**
   * Get all session notes
   */
  getNotes(): string[] {
    return [...this.notes];
  }

  /**
   * Clear all notes
   */
  clearNotes(): void {
    this.notes = [];
  }

  // ==========================================================================
  // Checkpoints
  // ==========================================================================

  /**
   * Create a checkpoint of current state
   */
  createCheckpoint(description: string): string {
    const checkpointId = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const checkpoint: SessionCheckpoint = {
      id: checkpointId,
      createdAt: new Date(),
      description,
      state: this.serializeContext(),
    };

    this.checkpoints.push(checkpoint);
    this.touchActivity();

    return checkpointId;
  }

  /**
   * Restore from a checkpoint
   */
  restoreCheckpoint(checkpointId: string): boolean {
    const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) return false;

    this.restoreContext(checkpoint.state);
    this.touchActivity();
    return true;
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): SessionCheckpoint[] {
    return this.checkpoints.map(cp => ({
      ...cp,
      state: { ...cp.state },
    }));
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Serialize current context for storage
   */
  private serializeContext(): SerializedContext {
    const agentContext = this.context.toAgentContext();

    return {
      files: Object.fromEntries(agentContext.filesRead),
      searches: Object.fromEntries(
        Array.from(agentContext.searchResults.entries()).map(
          ([k, v]) => [k, JSON.stringify(v)]
        )
      ),
      preferences: agentContext.userPreferences,
      odoo: agentContext.odooContext,
      designTokens: agentContext.designTokens || {},
      planMode: agentContext.planMode ?? true,
    };
  }

  /**
   * Restore context from serialized state
   */
  private restoreContext(state: SerializedContext): void {
    this.context.reset();

    const agentContext: Partial<AgentContext> = {
      filesRead: new Map(Object.entries(state.files)),
      searchResults: new Map(
        Object.entries(state.searches).map(
          ([k, v]) => [k, JSON.parse(v) as unknown[]]
        )
      ),
      userPreferences: state.preferences,
      odooContext: state.odoo as AgentContext['odooContext'],
      designTokens: state.designTokens,
      planMode: state.planMode,
    };

    this.context.initializeFrom(agentContext);
  }

  /**
   * Export session snapshot for persistence
   */
  toSnapshot(): SessionSnapshot {
    return {
      metadata: { ...this.metadata },
      context: this.serializeContext(),
      notes: [...this.notes],
      checkpoints: this.checkpoints.map(cp => ({
        ...cp,
        state: { ...cp.state },
      })),
    };
  }

  /**
   * Restore session from snapshot
   */
  static fromSnapshot(snapshot: SessionSnapshot): ExplorationSession {
    const session = new ExplorationSession();

    // Restore metadata (except ID which was set in constructor, but override it)
    (session as { sessionId: string }).sessionId = snapshot.metadata.id;
    session.metadata = { ...snapshot.metadata };

    // Restore context
    session.restoreContext(snapshot.context);

    // Restore notes and checkpoints
    session.notes = [...snapshot.notes];
    session.checkpoints = snapshot.checkpoints.map(cp => ({
      ...cp,
      state: { ...cp.state },
    }));

    return session;
  }
}

// ============================================================================
// SessionRegistry Class
// ============================================================================

/**
 * SessionRegistry - Manages multiple isolated exploration sessions
 *
 * Ensures complete isolation between sessions and provides lifecycle management.
 *
 * @example
 * ```typescript
 * const registry = new SessionRegistry();
 *
 * // Create isolated sessions
 * const session1 = registry.createSession({ name: 'Header work' });
 * const session2 = registry.createSession({ name: 'Footer work' });
 *
 * // Sessions are completely isolated
 * session1.getContext().addFileContent('file1.ts', 'content1');
 * session2.getContext().hasFile('file1.ts'); // false
 *
 * // Get session by ID
 * const retrieved = registry.getSession(session1.getId());
 *
 * // List all sessions
 * const all = registry.listSessions();
 * ```
 */
export class SessionRegistry {
  private sessions: Map<string, ExplorationSession>;
  private options: Required<SessionRegistryOptions>;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(options: SessionRegistryOptions = {}) {
    this.sessions = new Map();
    this.options = {
      maxSessions: options.maxSessions ?? DEFAULT_MAX_SESSIONS,
      sessionTimeout: options.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT,
      autoCleanup: options.autoCleanup ?? true,
      cleanupInterval: options.cleanupInterval ?? DEFAULT_CLEANUP_INTERVAL,
    };

    if (this.options.autoCleanup) {
      this.startCleanupTimer();
    }
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Create a new isolated session
   */
  createSession(options: CreateSessionOptions = {}): ExplorationSession {
    // Check session limit
    if (this.sessions.size >= this.options.maxSessions) {
      // Try to clean up completed/abandoned sessions first
      this.cleanupInactiveSessions();

      if (this.sessions.size >= this.options.maxSessions) {
        throw new Error(
          `Maximum sessions (${this.options.maxSessions}) reached. ` +
          'Complete or abandon existing sessions first.'
        );
      }
    }

    const session = new ExplorationSession(options);
    this.sessions.set(session.getId(), session);

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ExplorationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.isActive()).length;
  }

  /**
   * List all sessions
   */
  listSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values()).map(s => s.getMetadata());
  }

  /**
   * List sessions by status
   */
  listSessionsByStatus(status: SessionStatus): SessionMetadata[] {
    return Array.from(this.sessions.values())
      .filter(s => s.getStatus() === status)
      .map(s => s.getMetadata());
  }

  /**
   * Get the most recently active session
   */
  getMostRecent(): ExplorationSession | undefined {
    let mostRecent: ExplorationSession | undefined;
    let latestTime = 0;

    for (const session of this.sessions.values()) {
      const meta = session.getMetadata();
      const time = meta.lastActivityAt.getTime();
      if (time > latestTime) {
        latestTime = time;
        mostRecent = session;
      }
    }

    return mostRecent;
  }

  // ==========================================================================
  // Session Lifecycle
  // ==========================================================================

  /**
   * Complete and remove a session
   */
  completeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.complete();
    return true;
  }

  /**
   * Abandon and remove a session
   */
  abandonSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.abandon();
    return true;
  }

  /**
   * Remove a session from the registry
   */
  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    this.sessions.clear();
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up timed-out and inactive sessions
   */
  cleanupInactiveSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      const meta = session.getMetadata();

      // Remove completed/abandoned sessions
      if (meta.status === 'completed' || meta.status === 'abandoned') {
        this.sessions.delete(id);
        cleaned++;
        continue;
      }

      // Remove timed-out sessions
      const timeSinceActivity = now - meta.lastActivityAt.getTime();
      if (timeSinceActivity > this.options.sessionTimeout) {
        session.abandon();
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveSessions();
    }, this.options.cleanupInterval);
  }

  /**
   * Stop automatic cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  /**
   * Export all sessions for persistence
   */
  exportAll(): SessionSnapshot[] {
    return Array.from(this.sessions.values()).map(s => s.toSnapshot());
  }

  /**
   * Import sessions from snapshots
   */
  importAll(snapshots: SessionSnapshot[]): number {
    let imported = 0;

    for (const snapshot of snapshots) {
      if (this.sessions.size >= this.options.maxSessions) break;

      try {
        const session = ExplorationSession.fromSnapshot(snapshot);
        this.sessions.set(session.getId(), session);
        imported++;
      } catch {
        // Skip invalid snapshots
      }
    }

    return imported;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Get registry options
   */
  getOptions(): typeof this.options {
    return { ...this.options };
  }

  /**
   * Get total session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Destroy the registry (cleanup resources)
   */
  destroy(): void {
    this.stopCleanup();
    this.clearAll();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new exploration session
 */
export function createExplorationSession(
  options?: CreateSessionOptions
): ExplorationSession {
  return new ExplorationSession(options);
}

/**
 * Create a new session registry
 */
export function createSessionRegistry(
  options?: SessionRegistryOptions
): SessionRegistry {
  return new SessionRegistry(options);
}

// ============================================================================
// Singleton Registry (for convenience)
// ============================================================================

let globalRegistry: SessionRegistry | undefined;

/**
 * Get the global session registry
 */
export function getGlobalRegistry(): SessionRegistry {
  if (!globalRegistry) {
    globalRegistry = new SessionRegistry();
  }
  return globalRegistry;
}

/**
 * Create a new session in the global registry
 */
export function createGlobalSession(
  options?: CreateSessionOptions
): ExplorationSession {
  return getGlobalRegistry().createSession(options);
}

/**
 * Get a session from the global registry
 */
export function getGlobalSession(sessionId: string): ExplorationSession | undefined {
  return getGlobalRegistry().getSession(sessionId);
}

// ============================================================================
// Exports
// ============================================================================

export default ExplorationSession;

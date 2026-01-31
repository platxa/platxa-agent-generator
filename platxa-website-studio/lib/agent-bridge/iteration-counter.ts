/**
 * Iteration Counter for Self-Correction Loops
 *
 * Tracks iterations in self-correction loops and displays completion status.
 * Shows 'Completed in N iterations' after multiple passes.
 */

// ============================================================================
// Types
// ============================================================================

export interface IterationSession {
  readonly id: string;
  readonly name: string;
  readonly startTime: number;
  readonly endTime: number | null;
  readonly iterations: number;
  readonly maxIterations: number;
  readonly status: IterationStatus;
  readonly history: readonly IterationRecord[];
  readonly creationOrder: number;
}

export type IterationStatus = 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';

export interface IterationRecord {
  readonly iteration: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
  readonly result: IterationResult;
  readonly notes: string;
}

export type IterationResult = 'success' | 'correction_needed' | 'error' | 'skipped';

export interface IterationCounterState {
  readonly sessions: Map<string, IterationSession>;
  readonly activeSessionId: string | null;
  readonly defaultMaxIterations: number;
  readonly totalIterations: number;
  readonly totalSessions: number;
}

export interface IterationEvent {
  readonly sessionId: string;
  readonly iteration: number;
  readonly result: IterationResult;
  readonly timestamp: number;
}

export type IterationHandler = (event: IterationEvent) => void;

export interface CompletionMessage {
  readonly text: string;
  readonly iterations: number;
  readonly duration: number;
  readonly formattedDuration: string;
  readonly status: IterationStatus;
}

export interface SessionSummary {
  readonly id: string;
  readonly name: string;
  readonly iterations: number;
  readonly status: IterationStatus;
  readonly duration: number | null;
  readonly formattedDuration: string;
  readonly completionText: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 10;

// ============================================================================
// State
// ============================================================================

let state: IterationCounterState = {
  sessions: new Map(),
  activeSessionId: null,
  defaultMaxIterations: DEFAULT_MAX_ITERATIONS,
  totalIterations: 0,
  totalSessions: 0,
};

let iterationHandlers: IterationHandler[] = [];

// Monotonic counter for stable ordering
let creationOrderCounter = 0;

// ============================================================================
// Session Management
// ============================================================================

export function startSession(name: string, maxIterations?: number): IterationSession {
  const id = generateId();
  const now = Date.now();

  const session: IterationSession = {
    id,
    name,
    startTime: now,
    endTime: null,
    iterations: 0,
    maxIterations: maxIterations ?? state.defaultMaxIterations,
    status: 'running',
    history: [],
    creationOrder: creationOrderCounter++,
  };

  const newSessions = new Map(state.sessions);
  newSessions.set(id, session);

  state = {
    ...state,
    sessions: newSessions,
    activeSessionId: id,
    totalSessions: state.totalSessions + 1,
  };

  return session;
}

export function getSession(id: string): IterationSession | null {
  return state.sessions.get(id) ?? null;
}

export function getActiveSession(): IterationSession | null {
  if (!state.activeSessionId) {
    return null;
  }
  return state.sessions.get(state.activeSessionId) ?? null;
}

export function getAllSessions(): readonly IterationSession[] {
  return Array.from(state.sessions.values()).sort((a, b) => {
    const timeDiff = b.startTime - a.startTime;
    return timeDiff !== 0 ? timeDiff : b.creationOrder - a.creationOrder;
  });
}

export function endSession(id: string, status: IterationStatus = 'completed'): IterationSession | null {
  const session = state.sessions.get(id);
  if (!session) {
    return null;
  }

  const now = Date.now();
  const updated: IterationSession = {
    ...session,
    endTime: now,
    status,
  };

  const newSessions = new Map(state.sessions);
  newSessions.set(id, updated);

  state = {
    ...state,
    sessions: newSessions,
    activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
  };

  return updated;
}

export function cancelSession(id: string): IterationSession | null {
  return endSession(id, 'cancelled');
}

export function deleteSession(id: string): boolean {
  if (!state.sessions.has(id)) {
    return false;
  }

  const newSessions = new Map(state.sessions);
  newSessions.delete(id);

  state = {
    ...state,
    sessions: newSessions,
    activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
  };

  return true;
}

// ============================================================================
// Iteration Tracking
// ============================================================================

export function incrementIteration(
  sessionId: string,
  result: IterationResult = 'success',
  notes: string = ''
): IterationRecord | null {
  const session = state.sessions.get(sessionId);
  if (!session || session.status !== 'running') {
    return null;
  }

  const now = Date.now();
  const iterationNumber = session.iterations + 1;

  // Calculate iteration duration (time since last iteration or session start)
  const lastRecord = session.history[session.history.length - 1];
  const iterationStart = lastRecord ? lastRecord.endTime : session.startTime;

  const record: IterationRecord = {
    iteration: iterationNumber,
    startTime: iterationStart,
    endTime: now,
    duration: now - iterationStart,
    result,
    notes,
  };

  // Check if max iterations reached
  const newStatus = iterationNumber >= session.maxIterations ? 'timeout' : 'running';

  const updated: IterationSession = {
    ...session,
    iterations: iterationNumber,
    history: [...session.history, record],
    status: newStatus,
    endTime: newStatus === 'timeout' ? now : null,
  };

  const newSessions = new Map(state.sessions);
  newSessions.set(sessionId, updated);

  state = {
    ...state,
    sessions: newSessions,
    totalIterations: state.totalIterations + 1,
  };

  // Notify handlers
  notifyIteration({
    sessionId,
    iteration: iterationNumber,
    result,
    timestamp: now,
  });

  return record;
}

export function getCurrentIteration(sessionId: string): number {
  const session = state.sessions.get(sessionId);
  return session?.iterations ?? 0;
}

export function getIterationHistory(sessionId: string): readonly IterationRecord[] {
  const session = state.sessions.get(sessionId);
  return session?.history ?? [];
}

export function getLastIteration(sessionId: string): IterationRecord | null {
  const session = state.sessions.get(sessionId);
  if (!session || session.history.length === 0) {
    return null;
  }
  return session.history[session.history.length - 1];
}

// ============================================================================
// Active Session Shortcuts
// ============================================================================

export function increment(result: IterationResult = 'success', notes: string = ''): IterationRecord | null {
  if (!state.activeSessionId) {
    return null;
  }
  return incrementIteration(state.activeSessionId, result, notes);
}

export function complete(): IterationSession | null {
  if (!state.activeSessionId) {
    return null;
  }
  return endSession(state.activeSessionId, 'completed');
}

export function fail(): IterationSession | null {
  if (!state.activeSessionId) {
    return null;
  }
  return endSession(state.activeSessionId, 'failed');
}

export function cancel(): IterationSession | null {
  if (!state.activeSessionId) {
    return null;
  }
  return cancelSession(state.activeSessionId);
}

// ============================================================================
// Completion Messages
// ============================================================================

export function getCompletionMessage(sessionId: string): CompletionMessage | null {
  const session = state.sessions.get(sessionId);
  if (!session) {
    return null;
  }

  const duration = session.endTime
    ? session.endTime - session.startTime
    : Date.now() - session.startTime;

  return {
    text: formatCompletionText(session.iterations, session.status),
    iterations: session.iterations,
    duration,
    formattedDuration: formatDuration(duration),
    status: session.status,
  };
}

export function formatCompletionText(iterations: number, status: IterationStatus): string {
  switch (status) {
    case 'completed':
      if (iterations === 1) {
        return 'Completed in 1 iteration';
      }
      return `Completed in ${iterations} iterations`;

    case 'failed':
      return `Failed after ${iterations} iteration${iterations === 1 ? '' : 's'}`;

    case 'timeout':
      return `Timed out after ${iterations} iterations`;

    case 'cancelled':
      return `Cancelled after ${iterations} iteration${iterations === 1 ? '' : 's'}`;

    case 'running':
      return `Running (iteration ${iterations})`;

    default:
      return `${iterations} iteration${iterations === 1 ? '' : 's'}`;
  }
}

export function getActiveCompletionMessage(): CompletionMessage | null {
  if (!state.activeSessionId) {
    return null;
  }
  return getCompletionMessage(state.activeSessionId);
}

// ============================================================================
// Session Summary
// ============================================================================

export function getSessionSummary(sessionId: string): SessionSummary | null {
  const session = state.sessions.get(sessionId);
  if (!session) {
    return null;
  }

  const duration = session.endTime
    ? session.endTime - session.startTime
    : null;

  return {
    id: session.id,
    name: session.name,
    iterations: session.iterations,
    status: session.status,
    duration,
    formattedDuration: duration !== null ? formatDuration(duration) : 'In progress',
    completionText: formatCompletionText(session.iterations, session.status),
  };
}

export function getAllSessionSummaries(): readonly SessionSummary[] {
  return getAllSessions().map(session => ({
    id: session.id,
    name: session.name,
    iterations: session.iterations,
    status: session.status,
    duration: session.endTime ? session.endTime - session.startTime : null,
    formattedDuration: session.endTime
      ? formatDuration(session.endTime - session.startTime)
      : 'In progress',
    completionText: formatCompletionText(session.iterations, session.status),
  }));
}

// ============================================================================
// Statistics
// ============================================================================

export function getTotalIterations(): number {
  return state.totalIterations;
}

export function getTotalSessions(): number {
  return state.totalSessions;
}

export function getAverageIterations(): number {
  const completedSessions = Array.from(state.sessions.values())
    .filter(s => s.status === 'completed');

  if (completedSessions.length === 0) {
    return 0;
  }

  const total = completedSessions.reduce((sum, s) => sum + s.iterations, 0);
  return total / completedSessions.length;
}

export function getSuccessRate(): number {
  const finishedSessions = Array.from(state.sessions.values())
    .filter(s => s.status !== 'running');

  if (finishedSessions.length === 0) {
    return 0;
  }

  const completed = finishedSessions.filter(s => s.status === 'completed').length;
  return (completed / finishedSessions.length) * 100;
}

export function getSessionsByStatus(status: IterationStatus): readonly IterationSession[] {
  return Array.from(state.sessions.values())
    .filter(s => s.status === status)
    .sort((a, b) => {
      const timeDiff = b.startTime - a.startTime;
      return timeDiff !== 0 ? timeDiff : b.creationOrder - a.creationOrder;
    });
}

// ============================================================================
// Configuration
// ============================================================================

export function setDefaultMaxIterations(max: number): number {
  const validated = Math.max(1, Math.floor(max));
  state = {
    ...state,
    defaultMaxIterations: validated,
  };
  return validated;
}

export function getDefaultMaxIterations(): number {
  return state.defaultMaxIterations;
}

export function setSessionMaxIterations(sessionId: string, max: number): IterationSession | null {
  const session = state.sessions.get(sessionId);
  if (!session) {
    return null;
  }

  const validated = Math.max(1, Math.floor(max));
  const updated: IterationSession = {
    ...session,
    maxIterations: validated,
  };

  const newSessions = new Map(state.sessions);
  newSessions.set(sessionId, updated);

  state = {
    ...state,
    sessions: newSessions,
  };

  return updated;
}

// ============================================================================
// Display Helpers
// ============================================================================

export interface IterationDisplayState {
  readonly sessionName: string;
  readonly currentIteration: number;
  readonly maxIterations: number;
  readonly progress: number;
  readonly status: IterationStatus;
  readonly statusText: string;
  readonly isActive: boolean;
  readonly canIncrement: boolean;
  readonly canComplete: boolean;
}

export function getDisplayState(sessionId: string): IterationDisplayState | null {
  const session = state.sessions.get(sessionId);
  if (!session) {
    return null;
  }

  const progress = (session.iterations / session.maxIterations) * 100;

  return {
    sessionName: session.name,
    currentIteration: session.iterations,
    maxIterations: session.maxIterations,
    progress: Math.min(100, progress),
    status: session.status,
    statusText: formatCompletionText(session.iterations, session.status),
    isActive: state.activeSessionId === sessionId,
    canIncrement: session.status === 'running',
    canComplete: session.status === 'running' && session.iterations > 0,
  };
}

export function getActiveDisplayState(): IterationDisplayState | null {
  if (!state.activeSessionId) {
    return null;
  }
  return getDisplayState(state.activeSessionId);
}

export function getProgressBar(sessionId: string, width: number = 20): string {
  const session = state.sessions.get(sessionId);
  if (!session) {
    return '';
  }

  const progress = Math.min(1, session.iterations / session.maxIterations);
  const filled = Math.round(progress * width);
  const empty = width - filled;

  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

// ============================================================================
// Event Handlers
// ============================================================================

export function onIteration(handler: IterationHandler): () => void {
  iterationHandlers.push(handler);

  return () => {
    iterationHandlers = iterationHandlers.filter(h => h !== handler);
  };
}

function notifyIteration(event: IterationEvent): void {
  for (const handler of iterationHandlers) {
    handler(event);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `iter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ============================================================================
// State Inspection
// ============================================================================

export function getState(): IterationCounterState {
  return {
    ...state,
    sessions: new Map(state.sessions),
  };
}

export function hasActiveSession(): boolean {
  return state.activeSessionId !== null;
}

export function getActiveSessionId(): string | null {
  return state.activeSessionId;
}

// ============================================================================
// Reset
// ============================================================================

export function resetIterationCounter(): void {
  state = {
    sessions: new Map(),
    activeSessionId: null,
    defaultMaxIterations: DEFAULT_MAX_ITERATIONS,
    totalIterations: 0,
    totalSessions: 0,
  };
  iterationHandlers = [];
  creationOrderCounter = 0;
}

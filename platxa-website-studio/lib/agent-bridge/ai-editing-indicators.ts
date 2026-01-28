/**
 * AI Editing Indicators — Visual Feedback for AI-Modified Sections
 *
 * Manages pulsing highlight state for sections the AI agent is actively
 * modifying, with completion flash animations.
 */

// =============================================================================
// Types
// =============================================================================

/** Indicator visual state */
export type IndicatorState = "idle" | "editing" | "completed" | "error";

/** A single section's editing indicator */
export interface SectionIndicator {
  /** Section selector or ID */
  sectionId: string;
  /** Current visual state */
  state: IndicatorState;
  /** ISO timestamp when state last changed */
  updatedAt: string;
  /** Optional message shown alongside the indicator */
  message?: string;
}

/** CSS class names for each state */
export interface IndicatorClasses {
  idle: string;
  editing: string;
  completed: string;
  error: string;
}

/** Full indicator manager state */
export interface IndicatorManagerState {
  /** All tracked sections */
  sections: Map<string, SectionIndicator>;
  /** CSS class mappings */
  classes: IndicatorClasses;
}

/** CSS keyframes definition */
export interface KeyframesDefinition {
  name: string;
  css: string;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_CLASSES: IndicatorClasses = {
  idle: "ai-indicator--idle",
  editing: "ai-indicator--editing",
  completed: "ai-indicator--completed",
  error: "ai-indicator--error",
};

/** Pulsing border animation for editing state */
export const PULSE_KEYFRAMES: KeyframesDefinition = {
  name: "ai-pulse",
  css: `@keyframes ai-pulse {
  0%, 100% { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); }
  50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.8); }
}`,
};

/** Green flash animation for completed state */
export const COMPLETE_KEYFRAMES: KeyframesDefinition = {
  name: "ai-complete-flash",
  css: `@keyframes ai-complete-flash {
  0% { box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.9); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}`,
};

/** Error flash animation */
export const ERROR_KEYFRAMES: KeyframesDefinition = {
  name: "ai-error-flash",
  css: `@keyframes ai-error-flash {
  0%, 100% { box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.5); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.8); }
}`,
};

/** Full CSS for all indicator styles */
export function generateIndicatorCSS(classes: IndicatorClasses = DEFAULT_CLASSES): string {
  return `${PULSE_KEYFRAMES.css}
${COMPLETE_KEYFRAMES.css}
${ERROR_KEYFRAMES.css}

.${classes.idle} {
  transition: box-shadow 0.3s ease;
}

.${classes.editing} {
  animation: ${PULSE_KEYFRAMES.name} 1.5s ease-in-out infinite;
  border-radius: inherit;
}

.${classes.completed} {
  animation: ${COMPLETE_KEYFRAMES.name} 0.8s ease-out forwards;
}

.${classes.error} {
  animation: ${ERROR_KEYFRAMES.name} 0.5s ease-in-out 3;
}`;
}

// =============================================================================
// State Management
// =============================================================================

/** Creates a new indicator manager state. */
export function createIndicatorManager(
  classes: IndicatorClasses = DEFAULT_CLASSES,
): IndicatorManagerState {
  return { sections: new Map(), classes };
}

/** Sets a section to editing state (pulsing highlight). */
export function markEditing(
  state: IndicatorManagerState,
  sectionId: string,
  message?: string,
): IndicatorManagerState {
  const sections = new Map(state.sections);
  sections.set(sectionId, {
    sectionId,
    state: "editing",
    updatedAt: new Date().toISOString(),
    message,
  });
  return { ...state, sections };
}

/** Sets a section to completed state (green flash). */
export function markCompleted(
  state: IndicatorManagerState,
  sectionId: string,
  message?: string,
): IndicatorManagerState {
  const sections = new Map(state.sections);
  sections.set(sectionId, {
    sectionId,
    state: "completed",
    updatedAt: new Date().toISOString(),
    message,
  });
  return { ...state, sections };
}

/** Sets a section to error state. */
export function markError(
  state: IndicatorManagerState,
  sectionId: string,
  message?: string,
): IndicatorManagerState {
  const sections = new Map(state.sections);
  sections.set(sectionId, {
    sectionId,
    state: "error",
    updatedAt: new Date().toISOString(),
    message,
  });
  return { ...state, sections };
}

/** Resets a section to idle state. */
export function markIdle(
  state: IndicatorManagerState,
  sectionId: string,
): IndicatorManagerState {
  const sections = new Map(state.sections);
  sections.set(sectionId, {
    sectionId,
    state: "idle",
    updatedAt: new Date().toISOString(),
  });
  return { ...state, sections };
}

/** Removes a section from tracking. */
export function removeIndicator(
  state: IndicatorManagerState,
  sectionId: string,
): IndicatorManagerState {
  const sections = new Map(state.sections);
  sections.delete(sectionId);
  return { ...state, sections };
}

/** Resets all sections to idle. */
export function resetAll(state: IndicatorManagerState): IndicatorManagerState {
  const sections = new Map(state.sections);
  for (const [id, indicator] of sections) {
    sections.set(id, { ...indicator, state: "idle", updatedAt: new Date().toISOString() });
  }
  return { ...state, sections };
}

/** Clears all tracked sections. */
export function clearAll(state: IndicatorManagerState): IndicatorManagerState {
  return { ...state, sections: new Map() };
}

// =============================================================================
// Queries
// =============================================================================

/** Gets the indicator for a section. */
export function getIndicator(
  state: IndicatorManagerState,
  sectionId: string,
): SectionIndicator | null {
  return state.sections.get(sectionId) ?? null;
}

/** Gets the CSS class for a section's current state. */
export function getIndicatorClass(
  state: IndicatorManagerState,
  sectionId: string,
): string {
  const indicator = state.sections.get(sectionId);
  if (!indicator) return state.classes.idle;
  return state.classes[indicator.state];
}

/** Returns all sections currently in editing state. */
export function getEditingSections(state: IndicatorManagerState): SectionIndicator[] {
  return Array.from(state.sections.values()).filter((s) => s.state === "editing");
}

/** Returns all sections currently in completed state. */
export function getCompletedSections(state: IndicatorManagerState): SectionIndicator[] {
  return Array.from(state.sections.values()).filter((s) => s.state === "completed");
}

/** Returns all sections currently in error state. */
export function getErrorSections(state: IndicatorManagerState): SectionIndicator[] {
  return Array.from(state.sections.values()).filter((s) => s.state === "error");
}

/** Returns a summary of all indicators for display. */
export function getIndicatorSummary(state: IndicatorManagerState): Array<{
  sectionId: string;
  state: IndicatorState;
  className: string;
  message?: string;
}> {
  return Array.from(state.sections.values()).map((s) => ({
    sectionId: s.sectionId,
    state: s.state,
    className: state.classes[s.state],
    message: s.message,
  }));
}

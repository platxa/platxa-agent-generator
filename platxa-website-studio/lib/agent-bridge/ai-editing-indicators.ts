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

// =============================================================================
// Line-Level Indicators (Monaco Editor Integration)
// =============================================================================

/** A single line's editing indicator */
export interface LineIndicator {
  /** File path this line belongs to */
  filePath: string;
  /** Line number (1-based) */
  lineNumber: number;
  /** Current visual state */
  state: IndicatorState;
  /** ISO timestamp when state last changed */
  updatedAt: string;
  /** Optional message for tooltip */
  message?: string;
}

/** Line range for multi-line highlights */
export interface LineRange {
  startLine: number;
  endLine: number;
}

/** Line-level indicator manager state */
export interface LineIndicatorManagerState {
  /** Map of filePath -> Map of lineNumber -> indicator */
  lines: Map<string, Map<number, LineIndicator>>;
}

/** Monaco decoration options for line highlights */
export interface MonacoLineDecoration {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  options: {
    isWholeLine: boolean;
    className: string;
    glyphMarginClassName?: string;
    linesDecorationsClassName?: string;
  };
}

/** CSS class names for line-level indicators */
export const LINE_INDICATOR_CLASSES = {
  editing: "ai-line-editing",
  completed: "ai-line-completed",
  error: "ai-line-error",
  glyph: "ai-line-glyph",
} as const;

/** Line-level pulsing background animation */
export const LINE_PULSE_KEYFRAMES: KeyframesDefinition = {
  name: "ai-line-pulse",
  css: `@keyframes ai-line-pulse {
  0%, 100% { background-color: rgba(59, 130, 246, 0.15); }
  50% { background-color: rgba(59, 130, 246, 0.3); }
}`,
};

/** Line-level completion flash animation */
export const LINE_COMPLETE_KEYFRAMES: KeyframesDefinition = {
  name: "ai-line-complete",
  css: `@keyframes ai-line-complete {
  0% { background-color: rgba(34, 197, 94, 0.4); }
  100% { background-color: rgba(34, 197, 94, 0); }
}`,
};

/** Line-level error flash animation */
export const LINE_ERROR_KEYFRAMES: KeyframesDefinition = {
  name: "ai-line-error",
  css: `@keyframes ai-line-error {
  0%, 100% { background-color: rgba(239, 68, 68, 0.15); }
  50% { background-color: rgba(239, 68, 68, 0.3); }
}`,
};

/** Generates CSS for Monaco line-level indicators */
export function generateLineIndicatorCSS(): string {
  return `${LINE_PULSE_KEYFRAMES.css}
${LINE_COMPLETE_KEYFRAMES.css}
${LINE_ERROR_KEYFRAMES.css}

.${LINE_INDICATOR_CLASSES.editing} {
  animation: ${LINE_PULSE_KEYFRAMES.name} 1.5s ease-in-out infinite;
}

.${LINE_INDICATOR_CLASSES.completed} {
  animation: ${LINE_COMPLETE_KEYFRAMES.name} 0.8s ease-out forwards;
}

.${LINE_INDICATOR_CLASSES.error} {
  animation: ${LINE_ERROR_KEYFRAMES.name} 0.5s ease-in-out 3;
}

.${LINE_INDICATOR_CLASSES.glyph} {
  background-color: rgba(59, 130, 246, 0.8);
  width: 4px !important;
  margin-left: 3px;
  border-radius: 2px;
}

.${LINE_INDICATOR_CLASSES.glyph}.completed {
  background-color: rgba(34, 197, 94, 0.8);
}

.${LINE_INDICATOR_CLASSES.glyph}.error {
  background-color: rgba(239, 68, 68, 0.8);
}`;
}

// =============================================================================
// Line-Level State Management
// =============================================================================

/** Creates a new line indicator manager state. */
export function createLineIndicatorManager(): LineIndicatorManagerState {
  return { lines: new Map() };
}

/** Marks lines as being edited (pulsing highlight). */
export function markLinesEditing(
  state: LineIndicatorManagerState,
  filePath: string,
  lineNumbers: number[],
  message?: string,
): LineIndicatorManagerState {
  const lines = new Map(state.lines);
  const fileLines = new Map(lines.get(filePath) || new Map());

  const now = new Date().toISOString();
  for (const lineNumber of lineNumbers) {
    fileLines.set(lineNumber, {
      filePath,
      lineNumber,
      state: "editing",
      updatedAt: now,
      message,
    });
  }

  lines.set(filePath, fileLines);
  return { lines };
}

/** Marks a range of lines as being edited. */
export function markLineRangeEditing(
  state: LineIndicatorManagerState,
  filePath: string,
  range: LineRange,
  message?: string,
): LineIndicatorManagerState {
  const lineNumbers: number[] = [];
  for (let i = range.startLine; i <= range.endLine; i++) {
    lineNumbers.push(i);
  }
  return markLinesEditing(state, filePath, lineNumbers, message);
}

/** Marks lines as completed (green flash). */
export function markLinesCompleted(
  state: LineIndicatorManagerState,
  filePath: string,
  lineNumbers: number[],
  message?: string,
): LineIndicatorManagerState {
  const lines = new Map(state.lines);
  const fileLines = new Map(lines.get(filePath) || new Map());

  const now = new Date().toISOString();
  for (const lineNumber of lineNumbers) {
    fileLines.set(lineNumber, {
      filePath,
      lineNumber,
      state: "completed",
      updatedAt: now,
      message,
    });
  }

  lines.set(filePath, fileLines);
  return { lines };
}

/** Marks lines as error (red flash). */
export function markLinesError(
  state: LineIndicatorManagerState,
  filePath: string,
  lineNumbers: number[],
  message?: string,
): LineIndicatorManagerState {
  const lines = new Map(state.lines);
  const fileLines = new Map(lines.get(filePath) || new Map());

  const now = new Date().toISOString();
  for (const lineNumber of lineNumbers) {
    fileLines.set(lineNumber, {
      filePath,
      lineNumber,
      state: "error",
      updatedAt: now,
      message,
    });
  }

  lines.set(filePath, fileLines);
  return { lines };
}

/** Clears line indicators for a file. */
export function clearFileLineIndicators(
  state: LineIndicatorManagerState,
  filePath: string,
): LineIndicatorManagerState {
  const lines = new Map(state.lines);
  lines.delete(filePath);
  return { lines };
}

/** Clears specific line indicators. */
export function clearLineIndicators(
  state: LineIndicatorManagerState,
  filePath: string,
  lineNumbers: number[],
): LineIndicatorManagerState {
  const lines = new Map(state.lines);
  const fileLines = new Map(lines.get(filePath) || new Map());

  for (const lineNumber of lineNumbers) {
    fileLines.delete(lineNumber);
  }

  if (fileLines.size === 0) {
    lines.delete(filePath);
  } else {
    lines.set(filePath, fileLines);
  }

  return { lines };
}

/** Clears all line indicators. */
export function clearAllLineIndicators(
  state: LineIndicatorManagerState,
): LineIndicatorManagerState {
  return { lines: new Map() };
}

// =============================================================================
// Monaco Decoration Generation
// =============================================================================

/** Generates Monaco decoration options for a file's line indicators. */
export function getMonacoDecorations(
  state: LineIndicatorManagerState,
  filePath: string,
): MonacoLineDecoration[] {
  const fileLines = state.lines.get(filePath);
  if (!fileLines) return [];

  const decorations: MonacoLineDecoration[] = [];

  for (const indicator of fileLines.values()) {
    const className = getLineIndicatorClass(indicator.state);
    const glyphClass = getGlyphClass(indicator.state);

    decorations.push({
      range: {
        startLineNumber: indicator.lineNumber,
        startColumn: 1,
        endLineNumber: indicator.lineNumber,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className,
        glyphMarginClassName: glyphClass,
        linesDecorationsClassName: glyphClass,
      },
    });
  }

  return decorations;
}

/** Gets the CSS class for a line's state. */
function getLineIndicatorClass(state: IndicatorState): string {
  switch (state) {
    case "editing":
      return LINE_INDICATOR_CLASSES.editing;
    case "completed":
      return LINE_INDICATOR_CLASSES.completed;
    case "error":
      return LINE_INDICATOR_CLASSES.error;
    default:
      return "";
  }
}

/** Gets the glyph margin class for a line's state. */
function getGlyphClass(state: IndicatorState): string {
  switch (state) {
    case "editing":
      return LINE_INDICATOR_CLASSES.glyph;
    case "completed":
      return `${LINE_INDICATOR_CLASSES.glyph} completed`;
    case "error":
      return `${LINE_INDICATOR_CLASSES.glyph} error`;
    default:
      return "";
  }
}

/** Gets all lines currently being edited for a file. */
export function getEditingLines(
  state: LineIndicatorManagerState,
  filePath: string,
): number[] {
  const fileLines = state.lines.get(filePath);
  if (!fileLines) return [];

  return Array.from(fileLines.values())
    .filter((l) => l.state === "editing")
    .map((l) => l.lineNumber);
}

/** Gets a summary of line indicators for a file. */
export function getLineIndicatorSummary(
  state: LineIndicatorManagerState,
  filePath: string,
): LineIndicator[] {
  const fileLines = state.lines.get(filePath);
  if (!fileLines) return [];
  return Array.from(fileLines.values());
}

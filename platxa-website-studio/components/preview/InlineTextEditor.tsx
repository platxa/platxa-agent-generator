"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types
// =============================================================================

interface InlineTextEditorProps {
  /** Current text content */
  value: string;
  /** Called when text changes and is saved */
  onChange: (value: string) => void;
  /** Element tag for semantic display */
  tag?: keyof JSX.IntrinsicElements;
  /** Element ID for tracking */
  elementId?: string;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional class name */
  className?: string;
  /** Style object for preview */
  style?: React.CSSProperties;
  /** Called when edit starts */
  onEditStart?: () => void;
  /** Called when edit ends (save or cancel) */
  onEditEnd?: (saved: boolean) => void;
}

interface TextEditState {
  /** Whether currently editing */
  isEditing: boolean;
  /** Original value before editing (for cancel) */
  originalValue: string;
  /** Current draft value */
  draftValue: string;
}

export interface TextEditEvent {
  /** Element that was edited */
  elementId: string;
  /** Previous text */
  previousValue: string;
  /** New text */
  newValue: string;
  /** Whether change was saved (false if cancelled) */
  saved: boolean;
  /** Timestamp */
  timestamp: number;
}

// =============================================================================
// Hook for inline text editing
// =============================================================================

/**
 * Hook to manage inline text editing state and behavior.
 */
export function useInlineTextEdit(
  initialValue: string,
  onSave?: (value: string) => void
) {
  const [state, setState] = useState<TextEditState>({
    isEditing: false,
    originalValue: initialValue,
    draftValue: initialValue,
  });

  // Update when external value changes
  useEffect(() => {
    if (!state.isEditing) {
      setState((s) => ({
        ...s,
        originalValue: initialValue,
        draftValue: initialValue,
      }));
    }
  }, [initialValue, state.isEditing]);

  const startEdit = useCallback(() => {
    setState((s) => ({
      ...s,
      isEditing: true,
      originalValue: s.draftValue,
    }));
  }, []);

  const updateDraft = useCallback((value: string) => {
    setState((s) => ({ ...s, draftValue: value }));
  }, []);

  const save = useCallback(() => {
    setState((s) => {
      if (s.draftValue !== s.originalValue) {
        onSave?.(s.draftValue);
      }
      return { ...s, isEditing: false };
    });
  }, [onSave]);

  const cancel = useCallback(() => {
    setState((s) => ({
      ...s,
      isEditing: false,
      draftValue: s.originalValue,
    }));
  }, []);

  return {
    isEditing: state.isEditing,
    value: state.draftValue,
    originalValue: state.originalValue,
    startEdit,
    updateDraft,
    save,
    cancel,
    hasChanges: state.draftValue !== state.originalValue,
  };
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * InlineTextEditor - Double-click to edit text content directly.
 *
 * Feature #23: Visual Edit Mode - Direct text editing
 *
 * @example
 * ```tsx
 * <InlineTextEditor
 *   value="Hello World"
 *   onChange={(text) => updateElement(text)}
 *   tag="h1"
 *   editable
 * />
 * ```
 */
export function InlineTextEditor({
  value,
  onChange,
  tag: Tag = "span",
  elementId = "",
  editable = true,
  placeholder = "Double-click to edit",
  className,
  style,
  onEditStart,
  onEditEnd,
}: InlineTextEditorProps) {
  const {
    isEditing,
    value: draftValue,
    originalValue,
    startEdit,
    updateDraft,
    save,
    cancel,
  } = useInlineTextEdit(value, onChange);

  const inputRef = useRef<HTMLDivElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(inputRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [isEditing]);

  // Handle double-click to start editing
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      startEdit();
      onEditStart?.();
    },
    [editable, startEdit, onEditStart]
  );

  // Handle blur to save
  const handleBlur = useCallback(() => {
    save();
    onEditEnd?.(draftValue !== originalValue);
  }, [save, onEditEnd, draftValue, originalValue]);

  // Handle keydown for save (Enter) and cancel (Escape)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        save();
        onEditEnd?.(draftValue !== originalValue);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        onEditEnd?.(false);
      }
    },
    [save, cancel, onEditEnd, draftValue, originalValue]
  );

  // Handle input changes
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLDivElement>) => {
      updateDraft(e.currentTarget.textContent || "");
    },
    [updateDraft]
  );

  // Render editing state
  if (isEditing) {
    return (
      <div
        ref={inputRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        className={cn(
          "outline-none ring-2 ring-primary rounded px-1 -mx-1",
          "min-w-[20px] cursor-text",
          className
        )}
        style={style}
        data-element-id={elementId}
        data-editing="true"
      >
        {draftValue}
      </div>
    );
  }

  // Render display state with double-click hint
  const displayValue = value || placeholder;
  const isEmpty = !value;

  return (
    <Tag
      onDoubleClick={handleDoubleClick}
      className={cn(
        editable && "cursor-pointer hover:ring-2 hover:ring-primary/30 hover:rounded",
        editable && "transition-all duration-150",
        isEmpty && "text-muted-foreground italic",
        className
      )}
      style={style}
      data-element-id={elementId}
      data-editable={editable}
      title={editable ? "Double-click to edit" : undefined}
    >
      {displayValue}
    </Tag>
  );
}

// =============================================================================
// Text Edit Manager (Global State)
// =============================================================================

/** Event listener type */
type TextEditListener = (event: TextEditEvent) => void;

/**
 * TextEditManager tracks all text edits for undo/redo and sync.
 */
class TextEditManager {
  private history: TextEditEvent[] = [];
  private listeners: TextEditListener[] = [];
  private maxHistory = 100;

  /** Record a text edit */
  recordEdit(event: Omit<TextEditEvent, "timestamp">): void {
    const fullEvent: TextEditEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.history.push(fullEvent);

    // Trim history if too long
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(fullEvent);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /** Get edit history */
  getHistory(): TextEditEvent[] {
    return [...this.history];
  }

  /** Get edits for a specific element */
  getElementHistory(elementId: string): TextEditEvent[] {
    return this.history.filter((e) => e.elementId === elementId);
  }

  /** Get last edit */
  getLastEdit(): TextEditEvent | null {
    return this.history[this.history.length - 1] || null;
  }

  /** Clear history */
  clearHistory(): void {
    this.history = [];
  }

  /** Add event listener */
  on(listener: TextEditListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }
}

// Singleton instance
let _textEditManager: TextEditManager | null = null;

/** Get the global TextEditManager instance */
export function getTextEditManager(): TextEditManager {
  if (!_textEditManager) {
    _textEditManager = new TextEditManager();
  }
  return _textEditManager;
}

/** Reset the global TextEditManager instance */
export function resetTextEditManager(): void {
  if (_textEditManager) {
    _textEditManager.clearHistory();
  }
  _textEditManager = null;
}

// =============================================================================
// Wrapper Component with Manager Integration
// =============================================================================

interface TrackedTextEditorProps extends InlineTextEditorProps {
  /** Whether to track edits in the global manager */
  tracked?: boolean;
}

/**
 * TrackedTextEditor - InlineTextEditor with automatic edit tracking.
 *
 * @example
 * ```tsx
 * <TrackedTextEditor
 *   value={element.textContent}
 *   onChange={(text) => updateElement(text)}
 *   elementId={element.id}
 *   tracked
 * />
 * ```
 */
export function TrackedTextEditor({
  tracked = true,
  elementId = "",
  value,
  onChange,
  ...props
}: TrackedTextEditorProps) {
  const handleChange = useCallback(
    (newValue: string) => {
      if (tracked && elementId) {
        getTextEditManager().recordEdit({
          elementId,
          previousValue: value,
          newValue,
          saved: true,
        });
      }
      onChange(newValue);
    },
    [tracked, elementId, value, onChange]
  );

  const handleEditEnd = useCallback(
    (saved: boolean) => {
      if (tracked && elementId && !saved) {
        // Record cancelled edit for analytics
        getTextEditManager().recordEdit({
          elementId,
          previousValue: value,
          newValue: value,
          saved: false,
        });
      }
      props.onEditEnd?.(saved);
    },
    [tracked, elementId, value, props]
  );

  return (
    <InlineTextEditor
      {...props}
      value={value}
      onChange={handleChange}
      elementId={elementId}
      onEditEnd={handleEditEnd}
    />
  );
}

export default InlineTextEditor;

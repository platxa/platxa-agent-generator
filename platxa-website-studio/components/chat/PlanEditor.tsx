"use client";

/**
 * PlanEditor Component
 *
 * Allows users to edit, reorder, and remove plan steps before execution.
 * Provides inline editing, drag-drop reordering, and step management.
 *
 * Features:
 * - Inline step editing (title and description)
 * - Drag-and-drop reordering
 * - Step removal with confirmation
 * - Add new steps
 * - Undo/redo support
 * - Validation before execution
 *
 * Feature #11: Chat Mode System - Plan modification
 */

import * as React from "react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Undo2,
  Redo2,
  Play,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// =============================================================================
// Types
// =============================================================================

/** Plan step */
export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  order: number;
  estimatedDuration?: number;
}

/** Plan editor props */
export interface PlanEditorProps {
  /** Initial steps */
  steps: PlanStep[];
  /** Called when steps change */
  onStepsChange: (steps: PlanStep[]) => void;
  /** Called when execution is requested */
  onExecute?: (steps: PlanStep[]) => void;
  /** Whether plan is currently executing */
  isExecuting?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Show execute button */
  showExecuteButton?: boolean;
  /** Additional class name */
  className?: string;
}

/** History entry for undo/redo */
interface HistoryEntry {
  steps: PlanStep[];
  timestamp: number;
}

/** Drag state */
interface DragState {
  draggedId: string | null;
  dragOverId: string | null;
  dragPosition: "above" | "below" | null;
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function reorderSteps(
  steps: PlanStep[],
  fromIndex: number,
  toIndex: number
): PlanStep[] {
  const result = [...steps];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result.map((step, index) => ({ ...step, order: index }));
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Inline editable text field */
function InlineEdit({
  value,
  onChange,
  onCancel,
  placeholder,
  multiline = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onChange(editValue.trim());
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleBlur = () => {
    if (editValue.trim()) {
      onChange(editValue.trim());
    } else {
      onCancel();
    }
  };

  const commonProps = {
    value: editValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setEditValue(e.target.value),
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
    placeholder,
    className: cn(
      "w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary",
      className
    ),
  };

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        rows={2}
        {...commonProps}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      {...commonProps}
    />
  );
}

/** Single step item */
function StepItem({
  step,
  index,
  isEditing,
  isDragging,
  isDragOver,
  dragPosition,
  onEdit,
  onUpdate,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onDuplicate,
  readOnly,
}: {
  step: PlanStep;
  index: number;
  isEditing: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  dragPosition: "above" | "below" | null;
  onEdit: () => void;
  onUpdate: (updates: Partial<PlanStep>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, position: "above" | "below") => void;
  onDrop: () => void;
  onDuplicate: () => void;
  readOnly: boolean;
}) {
  const [editingField, setEditingField] = useState<"title" | "description" | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleTitleSave = (title: string) => {
    onUpdate({ title });
    setEditingField(null);
  };

  const handleDescriptionSave = (description: string) => {
    onUpdate({ description });
    setEditingField(null);
  };

  return (
    <div
      draggable={!readOnly && !editingField}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = e.clientY < midY ? "above" : "below";
        onDragOver(e, position);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        "relative group border rounded-lg transition-all duration-200",
        isDragging && "opacity-50 scale-95",
        isDragOver && dragPosition === "above" && "border-t-4 border-t-primary",
        isDragOver && dragPosition === "below" && "border-b-4 border-b-primary",
        step.status === "completed" && "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800",
        step.status === "failed" && "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800",
        step.status === "in_progress" && "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",
        step.status === "pending" && "bg-background border-border"
      )}
    >
      <div className="flex items-start gap-2 p-3">
        {/* Drag handle */}
        {!readOnly && (
          <div
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Step number */}
        <div
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
            step.status === "completed" && "bg-green-500 text-white",
            step.status === "failed" && "bg-red-500 text-white",
            step.status === "in_progress" && "bg-blue-500 text-white",
            step.status === "pending" && "bg-muted text-muted-foreground"
          )}
        >
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          {editingField === "title" ? (
            <InlineEdit
              value={step.title}
              onChange={handleTitleSave}
              onCancel={() => setEditingField(null)}
              placeholder="Step title"
            />
          ) : (
            <div
              className={cn(
                "font-medium text-sm",
                !readOnly && "cursor-pointer hover:text-primary"
              )}
              onClick={() => !readOnly && setEditingField("title")}
            >
              {step.title}
            </div>
          )}

          {/* Description */}
          {(step.description || editingField === "description") && (
            <div className="mt-1">
              {editingField === "description" ? (
                <InlineEdit
                  value={step.description || ""}
                  onChange={handleDescriptionSave}
                  onCancel={() => setEditingField(null)}
                  placeholder="Add description..."
                  multiline
                />
              ) : (
                <div
                  className={cn(
                    "text-xs text-muted-foreground",
                    !readOnly && "cursor-pointer hover:text-foreground"
                  )}
                  onClick={() => !readOnly && setEditingField("description")}
                >
                  {step.description}
                </div>
              )}
            </div>
          )}

          {/* Add description button */}
          {!step.description && !editingField && !readOnly && (
            <button
              onClick={() => setEditingField("description")}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
            >
              + Add description
            </button>
          )}

          {/* Duration estimate */}
          {step.estimatedDuration && (
            <div className="mt-1 text-xs text-muted-foreground">
              ~{step.estimatedDuration}min
            </div>
          )}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setEditingField("title")}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditingField("title")}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function PlanEditor({
  steps: initialSteps,
  onStepsChange,
  onExecute,
  isExecuting = false,
  readOnly = false,
  showExecuteButton = true,
  className,
}: PlanEditorProps) {
  const [steps, setSteps] = useState<PlanStep[]>(initialSteps);
  const [history, setHistory] = useState<HistoryEntry[]>([{ steps: initialSteps, timestamp: Date.now() }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    dragOverId: null,
    dragPosition: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newStepMode, setNewStepMode] = useState(false);

  // Sync with parent
  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  // Push to history
  const pushHistory = useCallback((newSteps: PlanStep[]) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, { steps: newSteps, timestamp: Date.now() }].slice(-50);
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Update steps
  const updateSteps = useCallback(
    (newSteps: PlanStep[]) => {
      setSteps(newSteps);
      pushHistory(newSteps);
      onStepsChange(newSteps);
    },
    [pushHistory, onStepsChange]
  );

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const newSteps = history[newIndex].steps;
      setSteps(newSteps);
      onStepsChange(newSteps);
    }
  }, [history, historyIndex, onStepsChange]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const newSteps = history[newIndex].steps;
      setSteps(newSteps);
      onStepsChange(newSteps);
    }
  }, [history, historyIndex, onStepsChange]);

  // Update single step
  const updateStep = useCallback(
    (stepId: string, updates: Partial<PlanStep>) => {
      const newSteps = steps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s
      );
      updateSteps(newSteps);
    },
    [steps, updateSteps]
  );

  // Delete step
  const deleteStep = useCallback(
    (stepId: string) => {
      const newSteps = steps
        .filter((s) => s.id !== stepId)
        .map((s, i) => ({ ...s, order: i }));
      updateSteps(newSteps);
      setDeleteConfirm(null);
    },
    [steps, updateSteps]
  );

  // Duplicate step
  const duplicateStep = useCallback(
    (stepId: string) => {
      const stepIndex = steps.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) return;

      const step = steps[stepIndex];
      const newStep: PlanStep = {
        ...step,
        id: generateId(),
        title: `${step.title} (copy)`,
        status: "pending",
      };

      const newSteps = [
        ...steps.slice(0, stepIndex + 1),
        newStep,
        ...steps.slice(stepIndex + 1),
      ].map((s, i) => ({ ...s, order: i }));

      updateSteps(newSteps);
    },
    [steps, updateSteps]
  );

  // Add new step
  const addStep = useCallback(
    (title: string, description?: string) => {
      const newStep: PlanStep = {
        id: generateId(),
        title,
        description,
        status: "pending",
        order: steps.length,
      };
      updateSteps([...steps, newStep]);
      setNewStepMode(false);
    },
    [steps, updateSteps]
  );

  // Drag handlers
  const handleDragStart = useCallback((stepId: string) => {
    setDragState((prev) => ({ ...prev, draggedId: stepId }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({ draggedId: null, dragOverId: null, dragPosition: null });
  }, []);

  const handleDragOver = useCallback(
    (stepId: string, position: "above" | "below") => {
      setDragState((prev) => ({
        ...prev,
        dragOverId: stepId,
        dragPosition: position,
      }));
    },
    []
  );

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragState.draggedId || dragState.draggedId === targetId) {
        handleDragEnd();
        return;
      }

      const fromIndex = steps.findIndex((s) => s.id === dragState.draggedId);
      let toIndex = steps.findIndex((s) => s.id === targetId);

      if (dragState.dragPosition === "below") {
        toIndex += 1;
      }

      if (fromIndex < toIndex) {
        toIndex -= 1;
      }

      const newSteps = reorderSteps(steps, fromIndex, toIndex);
      updateSteps(newSteps);
      handleDragEnd();
    },
    [dragState, steps, updateSteps, handleDragEnd]
  );

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (steps.length === 0) {
      errors.push("Plan must have at least one step");
    }

    steps.forEach((step, index) => {
      if (!step.title.trim()) {
        errors.push(`Step ${index + 1} has no title`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [steps]);

  // Execute handler
  const handleExecute = useCallback(() => {
    if (validation.isValid && onExecute) {
      onExecute(steps);
    }
  }, [validation.isValid, onExecute, steps]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{steps.length} steps</span>
          {!readOnly && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                disabled={historyIndex === 0}
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={redo}
                disabled={historyIndex === history.length - 1}
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewStepMode(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Step
            </Button>
          )}

          {showExecuteButton && onExecute && (
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={isExecuting || !validation.isValid}
            >
              <Play className="w-4 h-4 mr-1" />
              {isExecuting ? "Executing..." : "Execute Plan"}
            </Button>
          )}
        </div>
      </div>

      {/* Validation errors */}
      {!validation.isValid && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Plan needs attention</span>
          </div>
          <ul className="mt-2 text-sm text-amber-600 dark:text-amber-500 list-disc list-inside">
            {validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps list */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            index={index}
            isEditing={false}
            isDragging={dragState.draggedId === step.id}
            isDragOver={dragState.dragOverId === step.id}
            dragPosition={dragState.dragOverId === step.id ? dragState.dragPosition : null}
            onEdit={() => {}}
            onUpdate={(updates) => updateStep(step.id, updates)}
            onDelete={() => setDeleteConfirm(step.id)}
            onDragStart={() => handleDragStart(step.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e, pos) => handleDragOver(step.id, pos)}
            onDrop={() => handleDrop(step.id)}
            onDuplicate={() => duplicateStep(step.id)}
            readOnly={readOnly}
          />
        ))}

        {/* Empty state */}
        {steps.length === 0 && !newStepMode && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">No steps in this plan</p>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={() => setNewStepMode(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add First Step
              </Button>
            )}
          </div>
        )}

        {/* New step input */}
        {newStepMode && (
          <div className="border rounded-lg p-3">
            <InlineEdit
              value=""
              onChange={(title) => addStep(title)}
              onCancel={() => setNewStepMode(false)}
              placeholder="Enter step title and press Enter..."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Press Enter to add, Escape to cancel
            </p>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Step?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this step from the plan. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteStep(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PlanEditor;

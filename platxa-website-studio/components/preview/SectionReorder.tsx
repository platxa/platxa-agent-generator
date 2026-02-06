"use client";

/**
 * SectionReorder — Visual Drag-to-Reorder Component
 *
 * Production-grade drag-and-drop interface for reordering page sections.
 * Uses HTML5 Drag and Drop API with Framer Motion for smooth animations.
 *
 * Features:
 * - Native drag-drop with visual feedback
 * - Framer Motion layout animations
 * - Keyboard reordering (Alt+Up/Down)
 * - Live preview of new positions
 * - Smooth spring physics
 * - Touch device support
 * - ARIA accessibility
 * - Reduced motion support
 */

import { useState, useCallback, useRef } from "react";
import { GripVertical, ChevronUp, ChevronDown, Layers } from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import {
  springSnappy,
  springSmooth,
  fadeScaleVariants,
  prefersReducedMotion,
} from "@/lib/animations";
import {
  type PageSection,
  type DragResult,
  moveSection,
  swapSections,
  getDragFeedback,
  normalizeSections,
} from "@/lib/agent-bridge/section-reorder";

// =============================================================================
// Types
// =============================================================================

export interface SectionReorderProps {
  /** List of sections to reorder */
  sections: PageSection[];
  /** Callback when sections are reordered */
  onReorder: (result: DragResult) => void;
  /** Callback when a section is selected */
  onSelect?: (sectionId: string) => void;
  /** Currently selected section ID */
  selectedId?: string;
  /** Whether reordering is disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

interface DragState {
  isDragging: boolean;
  draggedId: string | null;
  dragOverId: string | null;
  dragOverPosition: "above" | "below" | null;
}

// =============================================================================
// Component
// =============================================================================

export function SectionReorder({
  sections,
  onReorder,
  onSelect,
  selectedId,
  disabled = false,
  className,
}: SectionReorderProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedId: null,
    dragOverId: null,
    dragOverPosition: null,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Normalize sections on mount
  const normalizedSections = normalizeSections(sections);

  // -------------------------------------------------------------------------
  // Drag Handlers
  // -------------------------------------------------------------------------

  const handleDragStart = useCallback(
    (e: React.DragEvent, sectionId: string) => {
      if (disabled) return;

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", sectionId);

      // Set drag image
      const element = itemRefs.current.get(sectionId);
      if (element) {
        e.dataTransfer.setDragImage(element, 20, 20);
      }

      setDragState({
        isDragging: true,
        draggedId: sectionId,
        dragOverId: null,
        dragOverPosition: null,
      });
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, sectionId: string) => {
      if (disabled || !dragState.isDragging || dragState.draggedId === sectionId) {
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Determine if cursor is above or below center of element
      const element = itemRefs.current.get(sectionId);
      if (element) {
        const rect = element.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = e.clientY < midY ? "above" : "below";

        setDragState((prev) => ({
          ...prev,
          dragOverId: sectionId,
          dragOverPosition: position,
        }));
      }
    },
    [disabled, dragState.isDragging, dragState.draggedId]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the container entirely
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setDragState((prev) => ({
        ...prev,
        dragOverId: null,
        dragOverPosition: null,
      }));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetSectionId: string) => {
      e.preventDefault();

      if (disabled || !dragState.draggedId || dragState.draggedId === targetSectionId) {
        setDragState({
          isDragging: false,
          draggedId: null,
          dragOverId: null,
          dragOverPosition: null,
        });
        return;
      }

      const fromIndex = normalizedSections.findIndex((s) => s.id === dragState.draggedId);
      let toIndex = normalizedSections.findIndex((s) => s.id === targetSectionId);

      // Adjust target index based on drop position
      if (dragState.dragOverPosition === "below" && fromIndex < toIndex) {
        // Already correct
      } else if (dragState.dragOverPosition === "above" && fromIndex > toIndex) {
        // Already correct
      } else if (dragState.dragOverPosition === "below") {
        toIndex = Math.min(toIndex + 1, normalizedSections.length - 1);
      }

      const result = moveSection(normalizedSections, fromIndex, toIndex);
      if (result.changed) {
        onReorder(result);
      }

      setDragState({
        isDragging: false,
        draggedId: null,
        dragOverId: null,
        dragOverPosition: null,
      });
    },
    [disabled, dragState.draggedId, dragState.dragOverPosition, normalizedSections, onReorder]
  );

  const handleDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedId: null,
      dragOverId: null,
      dragOverPosition: null,
    });
  }, []);

  // -------------------------------------------------------------------------
  // Keyboard Handlers
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, sectionId: string, index: number) => {
      if (disabled) return;

      // Alt+Up/Down to reorder
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const direction = e.key === "ArrowUp" ? "up" : "down";
        const result = swapSections(normalizedSections, index, direction);
        if (result.changed) {
          onReorder(result);
          // Focus the moved item after reorder
          requestAnimationFrame(() => {
            const newIndex = direction === "up" ? index - 1 : index + 1;
            const newSection = normalizedSections[newIndex];
            if (newSection) {
              itemRefs.current.get(newSection.id)?.focus();
            }
          });
        }
      }

      // Enter/Space to select
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.(sectionId);
      }
    },
    [disabled, normalizedSections, onReorder, onSelect]
  );

  // -------------------------------------------------------------------------
  // Touch Support
  // -------------------------------------------------------------------------

  const [touchState, setTouchState] = useState<{
    active: boolean;
    startY: number;
    currentId: string | null;
  }>({ active: false, startY: 0, currentId: null });

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, sectionId: string) => {
      if (disabled) return;
      setTouchState({
        active: true,
        startY: e.touches[0].clientY,
        currentId: sectionId,
      });
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchState.active || !touchState.currentId) return;

      const deltaY = e.touches[0].clientY - touchState.startY;
      const threshold = 50; // Pixels to trigger reorder

      if (Math.abs(deltaY) > threshold) {
        const currentIndex = normalizedSections.findIndex((s) => s.id === touchState.currentId);
        const direction = deltaY < 0 ? "up" : "down";
        const result = swapSections(normalizedSections, currentIndex, direction);

        if (result.changed) {
          onReorder(result);
          setTouchState((prev) => ({
            ...prev,
            startY: e.touches[0].clientY,
          }));
        }
      }
    },
    [touchState, normalizedSections, onReorder]
  );

  const handleTouchEnd = useCallback(() => {
    setTouchState({ active: false, startY: 0, currentId: null });
  }, []);

  // -------------------------------------------------------------------------
  // Animation Config
  // -------------------------------------------------------------------------

  const reducedMotion = prefersReducedMotion();

  const itemVariants = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: reducedMotion ? { duration: 0.01 } : springSnappy,
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.98,
      transition: reducedMotion ? { duration: 0.01 } : { duration: 0.15 },
    },
    dragging: {
      scale: 1.02,
      boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
      zIndex: 50,
      transition: reducedMotion ? { duration: 0.01 } : springSnappy,
    },
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (normalizedSections.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn("p-4 text-center text-muted-foreground", className)}
      >
        <Layers className="mx-auto h-8 w-8 opacity-50" />
        <p className="mt-2 text-sm">No sections to reorder</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("space-y-1", className)}
      role="listbox"
      aria-label="Page sections"
      aria-describedby="reorder-instructions"
    >
      <span id="reorder-instructions" className="sr-only">
        Use Alt+Up and Alt+Down to reorder sections. Press Enter to select.
      </span>

      <AnimatePresence mode="popLayout">
        {normalizedSections.map((section, index) => {
          const isDragged = dragState.draggedId === section.id;
          const isDragOver = dragState.dragOverId === section.id;
          const isSelected = selectedId === section.id;

          return (
            <motion.div
              key={section.id}
              ref={(el) => {
                if (el) itemRefs.current.set(section.id, el);
              }}
              layout={!reducedMotion}
              layoutId={reducedMotion ? undefined : section.id}
              variants={itemVariants}
              initial="initial"
              animate={isDragged ? "dragging" : "animate"}
              exit="exit"
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, section.id)}
              onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, section.id)}
              onDragLeave={handleDragLeave as unknown as React.DragEventHandler}
              onDrop={(e) => handleDrop(e as unknown as React.DragEvent, section.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e as unknown as React.TouchEvent, section.id)}
              onTouchMove={handleTouchMove as unknown as React.TouchEventHandler}
              onTouchEnd={handleTouchEnd}
              onKeyDown={(e) => handleKeyDown(e as unknown as React.KeyboardEvent, section.id, index)}
              onClick={() => onSelect?.(section.id)}
              tabIndex={disabled ? -1 : 0}
              role="option"
              aria-selected={isSelected}
              aria-grabbed={isDragged}
              whileHover={reducedMotion || disabled ? undefined : { scale: 1.01 }}
              whileTap={reducedMotion || disabled ? undefined : { scale: 0.99 }}
              className={cn(
                "group relative flex items-center gap-2 rounded-lg border px-3 py-2",
                "cursor-grab",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isDragged && "cursor-grabbing",
                isDragOver && dragState.dragOverPosition === "above" && "border-t-2 border-t-primary",
                isDragOver && dragState.dragOverPosition === "below" && "border-b-2 border-b-primary",
                isSelected && "border-primary bg-primary/5",
                !isSelected && "border-border bg-card hover:bg-accent/50",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {/* Drag Handle */}
              <motion.div
                className={cn(
                  "flex-shrink-0 text-muted-foreground",
                  !disabled && "cursor-grab group-hover:text-foreground"
                )}
                whileHover={reducedMotion ? undefined : { scale: 1.1 }}
              >
                <GripVertical className="h-4 w-4" />
              </motion.div>

              {/* Section Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{section.label}</div>
                <div className="text-xs text-muted-foreground truncate">{section.type}</div>
              </div>

              {/* Position Indicator */}
              <motion.div
                key={`pos-${index}`}
                initial={reducedMotion ? {} : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-shrink-0 text-xs text-muted-foreground font-mono"
              >
                {index + 1}
              </motion.div>

              {/* Quick Reorder Buttons (visible on hover/focus) */}
              {!disabled && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  className="flex-shrink-0 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <motion.button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const result = swapSections(normalizedSections, index, "up");
                      if (result.changed) onReorder(result);
                    }}
                    disabled={index === 0}
                    whileHover={reducedMotion || index === 0 ? undefined : { scale: 1.2, y: -1 }}
                    whileTap={reducedMotion || index === 0 ? undefined : { scale: 0.9 }}
                    className={cn(
                      "p-0.5 rounded hover:bg-accent",
                      index === 0 && "opacity-30 cursor-not-allowed"
                    )}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const result = swapSections(normalizedSections, index, "down");
                      if (result.changed) onReorder(result);
                    }}
                    disabled={index === normalizedSections.length - 1}
                    whileHover={reducedMotion || index === normalizedSections.length - 1 ? undefined : { scale: 1.2, y: 1 }}
                    whileTap={reducedMotion || index === normalizedSections.length - 1 ? undefined : { scale: 0.9 }}
                    className={cn(
                      "p-0.5 rounded hover:bg-accent",
                      index === normalizedSections.length - 1 && "opacity-30 cursor-not-allowed"
                    )}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// Export
// =============================================================================

export default SectionReorder;

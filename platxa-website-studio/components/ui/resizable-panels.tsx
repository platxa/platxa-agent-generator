"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types
// =============================================================================

/** Panel direction */
export type PanelDirection = "horizontal" | "vertical";

/** Panel constraints */
export interface PanelConstraints {
  /** Minimum size in pixels or percentage */
  minSize?: number;
  /** Maximum size in pixels or percentage */
  maxSize?: number;
  /** Default size in pixels or percentage */
  defaultSize?: number;
  /** Whether size is in percentage (true) or pixels (false) */
  isPercentage?: boolean;
}

/** Panel configuration */
export interface PanelConfig {
  id: string;
  constraints?: PanelConstraints;
}

/** Panel group context */
interface PanelGroupContextValue {
  direction: PanelDirection;
  panelSizes: Record<string, number>;
  registerPanel: (id: string, constraints?: PanelConstraints) => void;
  unregisterPanel: (id: string) => void;
  startResize: (handleIndex: number, e: ReactMouseEvent) => void;
  getPanelSize: (id: string) => number;
}

/** Resize handle state */
interface ResizeState {
  isResizing: boolean;
  handleIndex: number;
  startPosition: number;
  startSizes: number[];
}

// =============================================================================
// Constants
// =============================================================================

/** Default panel constraints */
export const DEFAULT_CONSTRAINTS: Required<PanelConstraints> = {
  minSize: 10,
  maxSize: 90,
  defaultSize: 50,
  isPercentage: true,
};

/** Resize handle width in pixels */
export const HANDLE_SIZE = 8;

/** Collapse threshold - panels below this are considered collapsed */
export const COLLAPSE_THRESHOLD = 5;

// =============================================================================
// Context
// =============================================================================

const PanelGroupContext = createContext<PanelGroupContextValue | null>(null);

function usePanelGroup() {
  const context = useContext(PanelGroupContext);
  if (!context) {
    throw new Error("Panel components must be used within a PanelGroup");
  }
  return context;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Clamps a value between min and max.
 */
export function clampSize(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates the new sizes after a resize operation.
 */
export function calculateResizedSizes(
  sizes: number[],
  handleIndex: number,
  delta: number,
  constraints: PanelConstraints[]
): number[] {
  const newSizes = [...sizes];
  const leftIndex = handleIndex;
  const rightIndex = handleIndex + 1;

  if (leftIndex < 0 || rightIndex >= sizes.length) {
    return newSizes;
  }

  const leftConstraints = constraints[leftIndex] || DEFAULT_CONSTRAINTS;
  const rightConstraints = constraints[rightIndex] || DEFAULT_CONSTRAINTS;

  const leftMin = leftConstraints.minSize ?? DEFAULT_CONSTRAINTS.minSize;
  const leftMax = leftConstraints.maxSize ?? DEFAULT_CONSTRAINTS.maxSize;
  const rightMin = rightConstraints.minSize ?? DEFAULT_CONSTRAINTS.minSize;
  const rightMax = rightConstraints.maxSize ?? DEFAULT_CONSTRAINTS.maxSize;

  // Calculate new sizes
  let newLeftSize = sizes[leftIndex] + delta;
  let newRightSize = sizes[rightIndex] - delta;

  // Apply constraints
  if (newLeftSize < leftMin) {
    newLeftSize = leftMin;
    newRightSize = sizes[leftIndex] + sizes[rightIndex] - leftMin;
  } else if (newLeftSize > leftMax) {
    newLeftSize = leftMax;
    newRightSize = sizes[leftIndex] + sizes[rightIndex] - leftMax;
  }

  if (newRightSize < rightMin) {
    newRightSize = rightMin;
    newLeftSize = sizes[leftIndex] + sizes[rightIndex] - rightMin;
  } else if (newRightSize > rightMax) {
    newRightSize = rightMax;
    newLeftSize = sizes[leftIndex] + sizes[rightIndex] - rightMax;
  }

  newSizes[leftIndex] = newLeftSize;
  newSizes[rightIndex] = newRightSize;

  return newSizes;
}

/**
 * Distributes sizes evenly among panels.
 */
export function distributeEvenSizes(count: number): number[] {
  const size = 100 / count;
  return Array(count).fill(size);
}

/**
 * Checks if a panel is collapsed based on its size.
 */
export function isPanelCollapsed(size: number): boolean {
  return size < COLLAPSE_THRESHOLD;
}

/**
 * Gets cursor style for resize handle based on direction.
 */
export function getResizeCursor(direction: PanelDirection): string {
  return direction === "horizontal" ? "col-resize" : "row-resize";
}

// =============================================================================
// Components
// =============================================================================

interface PanelGroupProps {
  /** Direction of panel layout */
  direction?: PanelDirection;
  /** Initial sizes as percentages */
  initialSizes?: number[];
  /** Callback when sizes change */
  onSizesChange?: (sizes: number[]) => void;
  /** Children (Panel and ResizeHandle components) */
  children: ReactNode;
  /** Optional className */
  className?: string;
}

/**
 * PanelGroup - Container for resizable panels.
 *
 * @example
 * ```tsx
 * <PanelGroup direction="horizontal">
 *   <Panel id="sidebar" minSize={15} maxSize={40}>
 *     <Sidebar />
 *   </Panel>
 *   <ResizeHandle />
 *   <Panel id="main">
 *     <MainContent />
 *   </Panel>
 * </PanelGroup>
 * ```
 */
export function PanelGroup({
  direction = "horizontal",
  initialSizes,
  onSizesChange,
  children,
  className,
}: PanelGroupProps) {
  const [panelIds, setPanelIds] = useState<string[]>([]);
  const [panelConstraints, setPanelConstraints] = useState<Record<string, PanelConstraints>>({});
  const [panelSizes, setPanelSizes] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<ResizeState>({
    isResizing: false,
    handleIndex: -1,
    startPosition: 0,
    startSizes: [],
  });

  // Register a panel
  const registerPanel = useCallback((id: string, constraints?: PanelConstraints) => {
    setPanelIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    if (constraints) {
      setPanelConstraints((prev) => ({ ...prev, [id]: constraints }));
    }
  }, []);

  // Unregister a panel
  const unregisterPanel = useCallback((id: string) => {
    setPanelIds((prev) => prev.filter((p) => p !== id));
    setPanelConstraints((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPanelSizes((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Initialize sizes when panels change
  useEffect(() => {
    if (panelIds.length === 0) return;

    setPanelSizes((prev) => {
      const sizes: Record<string, number> = {};
      const unassigned: string[] = [];
      let assignedTotal = 0;

      // Use initial sizes if provided
      if (initialSizes && initialSizes.length === panelIds.length) {
        panelIds.forEach((id, i) => {
          sizes[id] = initialSizes[i];
        });
        return sizes;
      }

      // Check for existing sizes or defaults
      panelIds.forEach((id, index) => {
        if (prev[id] !== undefined) {
          sizes[id] = prev[id];
          assignedTotal += prev[id];
        } else {
          const constraints = panelConstraints[id];
          if (constraints?.defaultSize !== undefined) {
            sizes[id] = constraints.defaultSize;
            assignedTotal += constraints.defaultSize;
          } else {
            unassigned.push(id);
          }
        }
      });

      // Distribute remaining space to unassigned panels
      if (unassigned.length > 0) {
        const remaining = 100 - assignedTotal;
        const perPanel = remaining / unassigned.length;
        unassigned.forEach((id) => {
          sizes[id] = perPanel;
        });
      }

      return sizes;
    });
  }, [panelIds, panelConstraints, initialSizes]);

  // Get panel size
  const getPanelSize = useCallback(
    (id: string) => panelSizes[id] ?? 0,
    [panelSizes]
  );

  // Start resize operation
  const startResize = useCallback(
    (handleIndex: number, e: ReactMouseEvent) => {
      e.preventDefault();
      const position = direction === "horizontal" ? e.clientX : e.clientY;
      const sizes = panelIds.map((id) => panelSizes[id] ?? 0);

      resizeStateRef.current = {
        isResizing: true,
        handleIndex,
        startPosition: position,
        startSizes: sizes,
      };

      document.body.style.cursor = getResizeCursor(direction);
      document.body.style.userSelect = "none";
    },
    [direction, panelIds, panelSizes]
  );

  // Handle mouse move during resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state.isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerSize =
        direction === "horizontal" ? containerRect.width : containerRect.height;
      const position = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = position - state.startPosition;
      const deltaPercent = (delta / containerSize) * 100;

      const constraints = panelIds.map((id) => panelConstraints[id] || DEFAULT_CONSTRAINTS);
      const newSizes = calculateResizedSizes(
        state.startSizes,
        state.handleIndex,
        deltaPercent,
        constraints
      );

      const newPanelSizes: Record<string, number> = {};
      panelIds.forEach((id, i) => {
        newPanelSizes[id] = newSizes[i];
      });

      setPanelSizes(newPanelSizes);
      onSizesChange?.(newSizes);
    };

    const handleMouseUp = () => {
      if (resizeStateRef.current.isResizing) {
        resizeStateRef.current.isResizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction, panelIds, panelConstraints, onSizesChange]);

  const contextValue: PanelGroupContextValue = {
    direction,
    panelSizes,
    registerPanel,
    unregisterPanel,
    startResize,
    getPanelSize,
  };

  return (
    <PanelGroupContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          "flex h-full w-full overflow-hidden",
          direction === "horizontal" ? "flex-row" : "flex-col",
          className
        )}
        data-panel-group
        data-direction={direction}
      >
        {children}
      </div>
    </PanelGroupContext.Provider>
  );
}

interface PanelProps {
  /** Unique panel ID */
  id: string;
  /** Minimum size (percentage) */
  minSize?: number;
  /** Maximum size (percentage) */
  maxSize?: number;
  /** Default size (percentage) */
  defaultSize?: number;
  /** Panel content */
  children: ReactNode;
  /** Optional className */
  className?: string;
}

/**
 * Panel - A resizable panel within a PanelGroup.
 */
export function Panel({
  id,
  minSize,
  maxSize,
  defaultSize,
  children,
  className,
}: PanelProps) {
  const { direction, registerPanel, unregisterPanel, getPanelSize } = usePanelGroup();

  useEffect(() => {
    registerPanel(id, { minSize, maxSize, defaultSize, isPercentage: true });
    return () => unregisterPanel(id);
  }, [id, minSize, maxSize, defaultSize, registerPanel, unregisterPanel]);

  const size = getPanelSize(id);
  const isCollapsed = isPanelCollapsed(size);

  const style =
    direction === "horizontal"
      ? { width: `${size}%`, minWidth: 0 }
      : { height: `${size}%`, minHeight: 0 };

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        isCollapsed && "opacity-0 pointer-events-none",
        className
      )}
      style={style}
      data-panel
      data-panel-id={id}
      data-collapsed={isCollapsed}
    >
      {children}
    </div>
  );
}

interface ResizeHandleProps {
  /** Handle index (position between panels) */
  index?: number;
  /** Optional className */
  className?: string;
  /** Whether to show the handle visually */
  showHandle?: boolean;
}

/**
 * ResizeHandle - Draggable handle between panels.
 */
export function ResizeHandle({
  index = 0,
  className,
  showHandle = true,
}: ResizeHandleProps) {
  const { direction, startResize } = usePanelGroup();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: ReactMouseEvent) => {
    setIsDragging(true);
    startResize(index, e);

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        "transition-colors duration-150",
        direction === "horizontal"
          ? "w-2 cursor-col-resize hover:bg-primary/10"
          : "h-2 cursor-row-resize hover:bg-primary/10",
        (isHovered || isDragging) && "bg-primary/20",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-resize-handle
      data-direction={direction}
      role="separator"
      aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
    >
      {showHandle && (
        <div
          className={cn(
            "rounded-full bg-border transition-all duration-150",
            direction === "horizontal"
              ? "w-1 h-8"
              : "h-1 w-8",
            (isHovered || isDragging) && "bg-primary"
          )}
        />
      )}
    </div>
  );
}

// =============================================================================
// Exports
// =============================================================================

export { usePanelGroup };

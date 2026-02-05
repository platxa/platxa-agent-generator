"use client";

/**
 * ElementTree Component
 *
 * Hierarchical view of page structure with selection synchronization.
 * Shows element tree with expand/collapse, selection sync with canvas.
 *
 * Features:
 * - Hierarchical element display
 * - Expand/collapse nodes
 * - Click to select element
 * - Selection sync with canvas
 * - Element type icons
 * - Search/filter elements
 * - Drag to reorder (optional)
 * - Context menu actions
 *
 * Feature #25: Visual Edit Mode - ElementTree
 */

import * as React from "react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Box,
  Type,
  Image,
  Link,
  List,
  Table,
  FormInput,
  Square,
  Circle,
  Minus,
  LayoutGrid,
  Columns,
  Rows,
  Code,
  FileText,
  Video,
  Music,
  Search,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// Types
// =============================================================================

/** Element node in the tree */
export interface ElementNode {
  id: string;
  type: string;
  tagName: string;
  label?: string;
  className?: string;
  children?: ElementNode[];
  isVisible?: boolean;
  isLocked?: boolean;
  depth?: number;
}

/** ElementTree props */
export interface ElementTreeProps {
  /** Root element nodes */
  elements: ElementNode[];
  /** Currently selected element ID */
  selectedId?: string | null;
  /** Called when an element is selected */
  onSelect?: (elementId: string | null) => void;
  /** Called when element visibility is toggled */
  onToggleVisibility?: (elementId: string) => void;
  /** Called when element lock state is toggled */
  onToggleLock?: (elementId: string) => void;
  /** Called when element is deleted */
  onDelete?: (elementId: string) => void;
  /** Called when element is duplicated */
  onDuplicate?: (elementId: string) => void;
  /** Called when elements are reordered */
  onReorder?: (sourceId: string, targetId: string, position: "before" | "after" | "inside") => void;
  /** Enable drag-and-drop reordering */
  enableReorder?: boolean;
  /** Show visibility toggle */
  showVisibilityToggle?: boolean;
  /** Show lock toggle */
  showLockToggle?: boolean;
  /** Additional class name */
  className?: string;
}

/** Tree node state */
interface NodeState {
  expanded: Set<string>;
  hovered: string | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Element type to icon mapping */
const ELEMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Layout
  div: Box,
  section: LayoutGrid,
  article: FileText,
  header: Rows,
  footer: Rows,
  nav: Columns,
  aside: Columns,
  main: Box,
  // Text
  h1: Type,
  h2: Type,
  h3: Type,
  h4: Type,
  h5: Type,
  h6: Type,
  p: Type,
  span: Type,
  label: Type,
  // Media
  img: Image,
  video: Video,
  audio: Music,
  svg: Circle,
  canvas: Square,
  // Interactive
  a: Link,
  button: Square,
  input: FormInput,
  textarea: FormInput,
  select: FormInput,
  form: FormInput,
  // Lists
  ul: List,
  ol: List,
  li: Minus,
  // Tables
  table: Table,
  tr: Rows,
  td: Box,
  th: Box,
  // Other
  iframe: Code,
  code: Code,
  pre: Code,
};

// =============================================================================
// Helper Functions
// =============================================================================

function getElementIcon(tagName: string): React.ComponentType<{ className?: string }> {
  return ELEMENT_ICONS[tagName.toLowerCase()] || Box;
}

function getElementLabel(node: ElementNode): string {
  if (node.label) return node.label;

  // Try to create a meaningful label
  const tag = node.tagName.toLowerCase();

  if (node.className) {
    const firstClass = node.className.split(" ")[0];
    if (firstClass && firstClass.length < 20) {
      return `${tag}.${firstClass}`;
    }
  }

  return tag;
}

function flattenTree(nodes: ElementNode[], depth = 0): Array<ElementNode & { depth: number }> {
  const result: Array<ElementNode & { depth: number }> = [];

  for (const node of nodes) {
    result.push({ ...node, depth });
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }

  return result;
}

function filterTree(nodes: ElementNode[], query: string): ElementNode[] {
  const lowerQuery = query.toLowerCase();

  return nodes
    .map((node) => {
      const label = getElementLabel(node).toLowerCase();
      const matches = label.includes(lowerQuery) || node.tagName.toLowerCase().includes(lowerQuery);

      const filteredChildren = node.children ? filterTree(node.children, query) : [];

      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        };
      }

      return null;
    })
    .filter(Boolean) as ElementNode[];
}

function findParentIds(nodes: ElementNode[], targetId: string, path: string[] = []): string[] {
  for (const node of nodes) {
    if (node.id === targetId) {
      return path;
    }

    if (node.children) {
      const result = findParentIds(node.children, targetId, [...path, node.id]);
      if (result.length > 0) {
        return result;
      }
    }
  }

  return [];
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Single tree node */
function TreeNode({
  node,
  depth,
  isSelected,
  isExpanded,
  isHovered,
  hasChildren,
  onSelect,
  onToggleExpand,
  onHover,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onDuplicate,
  showVisibilityToggle,
  showLockToggle,
}: {
  node: ElementNode;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  isHovered: boolean;
  hasChildren: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onHover: (hover: boolean) => void;
  onToggleVisibility?: () => void;
  onToggleLock?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  showVisibilityToggle: boolean;
  showLockToggle: boolean;
}) {
  const Icon = getElementIcon(node.tagName);
  const label = getElementLabel(node);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            "group flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer transition-colors",
            "hover:bg-accent",
            isSelected && "bg-accent text-accent-foreground",
            isHovered && !isSelected && "bg-accent/50",
            node.isVisible === false && "opacity-50"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={onSelect}
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
        >
          {/* Expand/collapse button */}
          <button
            className={cn(
              "w-4 h-4 flex items-center justify-center",
              !hasChildren && "invisible"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          {/* Element icon */}
          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

          {/* Label */}
          <span className="flex-1 text-sm truncate">{label}</span>

          {/* Lock indicator */}
          {node.isLocked && (
            <Lock className="w-3 h-3 text-muted-foreground" />
          )}

          {/* Action buttons (visible on hover) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            {showVisibilityToggle && onToggleVisibility && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="p-1 hover:bg-background rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisibility();
                      }}
                    >
                      {node.isVisible === false ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {node.isVisible === false ? "Show" : "Hide"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {showLockToggle && onToggleLock && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="p-1 hover:bg-background rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLock();
                      }}
                    >
                      {node.isLocked ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <Unlock className="w-3 h-3" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {node.isLocked ? "Unlock" : "Lock"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onSelect}>
          <Box className="w-4 h-4 mr-2" />
          Select
        </ContextMenuItem>
        {onDuplicate && (
          <ContextMenuItem onClick={onDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </ContextMenuItem>
        )}
        {showVisibilityToggle && onToggleVisibility && (
          <ContextMenuItem onClick={onToggleVisibility}>
            {node.isVisible === false ? (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Show
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Hide
              </>
            )}
          </ContextMenuItem>
        )}
        {showLockToggle && onToggleLock && (
          <ContextMenuItem onClick={onToggleLock}>
            {node.isLocked ? (
              <>
                <Unlock className="w-4 h-4 mr-2" />
                Unlock
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Lock
              </>
            )}
          </ContextMenuItem>
        )}
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ElementTree({
  elements,
  selectedId,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
  onDuplicate,
  onReorder,
  enableReorder = false,
  showVisibilityToggle = true,
  showLockToggle = true,
  className,
}: ElementTreeProps) {
  const [state, setState] = useState<NodeState>({
    expanded: new Set<string>(),
    hovered: null,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const treeRef = useRef<HTMLDivElement>(null);

  // Auto-expand to show selected element
  useEffect(() => {
    if (selectedId && elements.length > 0) {
      const parentIds = findParentIds(elements, selectedId);
      if (parentIds.length > 0) {
        setState((prev) => ({
          ...prev,
          expanded: new Set([...prev.expanded, ...parentIds]),
        }));
      }
    }
  }, [selectedId, elements]);

  // Filter elements by search query
  const filteredElements = useMemo(() => {
    if (!searchQuery.trim()) return elements;
    return filterTree(elements, searchQuery.trim());
  }, [elements, searchQuery]);

  // Toggle expand/collapse
  const toggleExpand = useCallback((nodeId: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expanded);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return { ...prev, expanded: newExpanded };
    });
  }, []);

  // Set hover state
  const setHovered = useCallback((nodeId: string | null) => {
    setState((prev) => ({ ...prev, hovered: nodeId }));
  }, []);

  // Expand all
  const expandAll = useCallback(() => {
    const allIds = flattenTree(elements).map((n) => n.id);
    setState((prev) => ({ ...prev, expanded: new Set(allIds) }));
  }, [elements]);

  // Collapse all
  const collapseAll = useCallback(() => {
    setState((prev) => ({ ...prev, expanded: new Set() }));
  }, []);

  // Render tree recursively
  const renderTree = useCallback(
    (nodes: ElementNode[], depth = 0): React.ReactNode => {
      return nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = state.expanded.has(node.id);
        const isSelected = selectedId === node.id;
        const isHovered = state.hovered === node.id;

        return (
          <React.Fragment key={node.id}>
            <TreeNode
              node={node}
              depth={depth}
              isSelected={isSelected}
              isExpanded={isExpanded}
              isHovered={isHovered}
              hasChildren={!!hasChildren}
              onSelect={() => onSelect?.(node.id)}
              onToggleExpand={() => toggleExpand(node.id)}
              onHover={(hover) => setHovered(hover ? node.id : null)}
              onToggleVisibility={onToggleVisibility ? () => onToggleVisibility(node.id) : undefined}
              onToggleLock={onToggleLock ? () => onToggleLock(node.id) : undefined}
              onDelete={onDelete ? () => onDelete(node.id) : undefined}
              onDuplicate={onDuplicate ? () => onDuplicate(node.id) : undefined}
              showVisibilityToggle={showVisibilityToggle}
              showLockToggle={showLockToggle}
            />
            {hasChildren && isExpanded && renderTree(node.children!, depth + 1)}
          </React.Fragment>
        );
      });
    },
    [
      state.expanded,
      state.hovered,
      selectedId,
      onSelect,
      onToggleVisibility,
      onToggleLock,
      onDelete,
      onDuplicate,
      toggleExpand,
      setHovered,
      showVisibilityToggle,
      showLockToggle,
    ]
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header with search and actions */}
      <div className="p-2 border-b space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search elements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {flattenTree(filteredElements).length} elements
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Expand All
            </button>
            <span className="text-muted-foreground">|</span>
            <button
              onClick={collapseAll}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Tree content */}
      <div ref={treeRef} className="flex-1 overflow-auto p-1">
        {filteredElements.length > 0 ? (
          renderTree(filteredElements)
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {searchQuery ? "No matching elements" : "No elements"}
          </div>
        )}
      </div>

      {/* Selection info */}
      {selectedId && (
        <div className="p-2 border-t bg-muted/50">
          <div className="text-xs text-muted-foreground">
            Selected: <span className="font-mono">{selectedId}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ElementTree;

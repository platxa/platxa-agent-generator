"use client";

import { useState, useCallback } from "react";
import {
  Layout,
  Grid3X3,
  FileText,
  Zap,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import {
  getAllSnippets,
  getSnippetsByCategory,
  type SnippetDefinition,
} from "@/lib/preview/snippet-registry";

export interface SnippetPaletteProps {
  onInsertSnippet?: (snippet: SnippetDefinition) => void;
  className?: string;
}

interface CategoryConfig {
  id: SnippetDefinition["category"];
  name: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryConfig[] = [
  { id: "structure", name: "Structure", icon: <Layout className="w-4 h-4" /> },
  { id: "features", name: "Features", icon: <Zap className="w-4 h-4" /> },
  { id: "content", name: "Content", icon: <FileText className="w-4 h-4" /> },
  { id: "dynamic", name: "Dynamic", icon: <Grid3X3 className="w-4 h-4" /> },
];

/**
 * Snippet card component
 */
function SnippetCard({
  snippet,
  onInsert,
}: {
  snippet: SnippetDefinition;
  onInsert?: (snippet: SnippetDefinition) => void;
}) {
  const handleClick = useCallback(() => {
    onInsert?.(snippet);
  }, [snippet, onInsert]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", snippet.id);
      e.dataTransfer.setData("application/x-snippet", JSON.stringify(snippet));
      e.dataTransfer.effectAllowed = "copy";
    },
    [snippet]
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "group relative flex items-center gap-2 w-full p-2 rounded-md",
            "border border-transparent hover:border-border",
            "bg-muted/30 hover:bg-muted/50",
            "transition-colors cursor-grab active:cursor-grabbing",
            "text-left text-sm"
          )}
          onClick={handleClick}
          draggable
          onDragStart={handleDragStart}
        >
          <GripVertical className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{snippet.name}</div>
            {snippet.description && (
              <div className="text-xs text-muted-foreground truncate">
                {snippet.description}
              </div>
            )}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="font-medium">{snippet.name}</div>
        <div className="text-xs text-muted-foreground">
          {snippet.description || `Insert ${snippet.name} snippet`}
        </div>
        <div className="text-xs text-muted-foreground/70 mt-1">
          Click to insert or drag to position
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Category section component
 */
function CategorySection({
  category,
  snippets,
  onInsertSnippet,
  defaultOpen = true,
}: {
  category: CategoryConfig;
  snippets: SnippetDefinition[];
  onInsertSnippet?: (snippet: SnippetDefinition) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (snippets.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 w-full p-2 rounded-md",
          "hover:bg-muted/50 transition-colors",
          "text-sm font-medium"
        )}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {category.icon}
        <span className="flex-1 text-left">{category.name}</span>
        <span className="text-xs text-muted-foreground">
          {snippets.length}
        </span>
      </button>
      {isOpen && (
        <div className="space-y-1 pl-6 py-1">
          {snippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              onInsert={onInsertSnippet}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SnippetPalette component
 *
 * Displays available Odoo snippets organized by category.
 * Supports drag-and-drop and click-to-insert.
 */
export function SnippetPalette({ onInsertSnippet, className }: SnippetPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const allSnippets = getAllSnippets();

  // Filter snippets by search query
  const filteredSnippets = searchQuery.trim()
    ? allSnippets.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex-none p-3 border-b">
        <h3 className="font-semibold text-sm mb-2">Snippets</h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Snippet list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredSnippets ? (
            // Search results
            <div className="space-y-1">
              {filteredSnippets.length > 0 ? (
                filteredSnippets.map((snippet) => (
                  <SnippetCard
                    key={snippet.id}
                    snippet={snippet}
                    onInsert={onInsertSnippet}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No snippets found for &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          ) : (
            // Category view
            <div className="space-y-1">
              {CATEGORIES.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  snippets={getSnippetsByCategory(category.id)}
                  onInsertSnippet={onInsertSnippet}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex-none p-3 border-t">
        <div className="text-xs text-muted-foreground text-center">
          {allSnippets.length} snippets available
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing snippet insertion
 */
export function useSnippetInsertion() {
  const [lastInserted, setLastInserted] = useState<SnippetDefinition | null>(null);

  const insertSnippet = useCallback((snippet: SnippetDefinition) => {
    setLastInserted(snippet);
    // Additional insertion logic would go here
    // e.g., inserting into editor, updating preview, etc.
  }, []);

  const clearLastInserted = useCallback(() => {
    setLastInserted(null);
  }, []);

  return {
    lastInserted,
    insertSnippet,
    clearLastInserted,
  };
}

/**
 * Compact snippet button for toolbar
 */
export function SnippetButton({
  onClick,
  isActive,
}: {
  onClick?: () => void;
  isActive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={onClick}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Snippets</TooltipContent>
    </Tooltip>
  );
}

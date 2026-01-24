"use client";

import { X, Palette, Layout, Type, Component } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { DesignSuggestion } from "@/lib/stores/chat-store";

interface DesignSuggestionsProps {
  suggestions: DesignSuggestion[];
  onSelect: (action: string) => void;
  onDismiss: () => void;
}

const typeIcons = {
  color: Palette,
  layout: Layout,
  typography: Type,
  component: Component,
};

export function DesignSuggestions({
  suggestions,
  onSelect,
  onDismiss,
}: DesignSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="px-4 py-3 border-t bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          Design Suggestions
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onDismiss}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion) => {
          const Icon = typeIcons[suggestion.type];

          return (
            <button
              key={suggestion.id}
              onClick={() => onSelect(suggestion.action || suggestion.title)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border",
                "bg-background hover:bg-muted/50 transition-colors",
                "text-left"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-lg",
                  "flex items-center justify-center",
                  "bg-primary/10 text-primary"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{suggestion.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {suggestion.description}
                </p>
              </div>
              {suggestion.preview && (
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: suggestion.preview }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Type, Palette, Space, RotateCcw } from "lucide-react";
import { useEditorStore } from "@/lib/stores";
import { cn } from "@/lib/utils/cn";

// =============================================================================
// Types
// =============================================================================

/** A style change emitted by the floating editor */
export interface StyleEdit {
  snippetId: string;
  property: string;
  value: string;
}

/** Color preset matching Odoo's color palette */
export interface ColorPreset {
  name: string;
  value: string;
  cssVar: string;
}

/** Font preset */
export interface FontPreset {
  label: string;
  value: string;
}

/** Spacing preset */
export interface SpacingPreset {
  label: string;
  cssClass: string;
  value: string;
}

// =============================================================================
// Presets
// =============================================================================

export const COLOR_PRESETS: ColorPreset[] = [
  { name: "Primary", value: "#7c3aed", cssVar: "var(--o-color-1)" },
  { name: "Secondary", value: "#6c757d", cssVar: "var(--o-color-2)" },
  { name: "Accent", value: "#ec4899", cssVar: "var(--o-color-3)" },
  { name: "Light", value: "#f8f9fa", cssVar: "var(--o-color-4)" },
  { name: "Dark", value: "#212529", cssVar: "var(--o-color-5)" },
  { name: "White", value: "#ffffff", cssVar: "#ffffff" },
  { name: "Success", value: "#10b981", cssVar: "var(--bs-success)" },
  { name: "Warning", value: "#f59e0b", cssVar: "var(--bs-warning)" },
];

export const FONT_PRESETS: FontPreset[] = [
  { label: "System Default", value: "system-ui, sans-serif" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Open Sans", value: "'Open Sans', sans-serif" },
  { label: "Lora", value: "'Lora', serif" },
  { label: "Monospace", value: "ui-monospace, monospace" },
];

export const SPACING_PRESETS: SpacingPreset[] = [
  { label: "None", cssClass: "pt0 pb0", value: "0" },
  { label: "Small", cssClass: "pt16 pb16", value: "1rem" },
  { label: "Medium", cssClass: "pt32 pb32", value: "2rem" },
  { label: "Large", cssClass: "pt48 pb48", value: "3rem" },
  { label: "XL", cssClass: "pt64 pb64", value: "4rem" },
  { label: "XXL", cssClass: "pt96 pb96", value: "6rem" },
];

// =============================================================================
// Component
// =============================================================================

type TabId = "colors" | "fonts" | "spacing";

interface FloatingStyleEditorProps {
  onStyleEdit: (edit: StyleEdit) => void;
}

/**
 * Floating panel that appears when a snippet is selected in the preview.
 * Provides color pickers, font selectors, and spacing controls.
 */
export function FloatingStyleEditor({ onStyleEdit }: FloatingStyleEditorProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedSnippetId = useEditorStore((s) => s.selectedSnippetId);
  const clearSelection = useEditorStore((s) => s.clearSnippetSelection);
  const [activeTab, setActiveTab] = useState<TabId>("colors");
  const [customColor, setCustomColor] = useState("#7c3aed");

  // Close on Escape
  useEffect(() => {
    if (!selectedSnippetId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [selectedSnippetId, clearSelection]);

  const emitEdit = useCallback(
    (property: string, value: string) => {
      if (!selectedSnippetId) return;
      onStyleEdit({ snippetId: selectedSnippetId, property, value });
    },
    [selectedSnippetId, onStyleEdit],
  );

  if (!selectedSnippetId) return null;

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "colors", label: "Colors", icon: <Palette className="w-3.5 h-3.5" /> },
    { id: "fonts", label: "Fonts", icon: <Type className="w-3.5 h-3.5" /> },
    { id: "spacing", label: "Spacing", icon: <Space className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      ref={panelRef}
      className="absolute right-4 top-16 z-50 w-64 bg-popover border border-border rounded-xl shadow-xl animate-in slide-in-from-right-2 fade-in-0"
      data-testid="floating-style-editor"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">
            {selectedSnippetId}
          </span>
        </div>
        <button
          onClick={clearSelection}
          className="p-1 rounded hover:bg-accent transition-colors"
          aria-label="Close style editor"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors",
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3 max-h-72 overflow-y-auto">
        {activeTab === "colors" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Background Color
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    title={preset.name}
                    className="w-full aspect-square rounded-lg border border-border hover:ring-2 hover:ring-primary/50 transition-all"
                    style={{ backgroundColor: preset.value }}
                    onClick={() => emitEdit("background-color", preset.cssVar)}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Text Color
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={`text-${preset.name}`}
                    title={preset.name}
                    className="w-full aspect-square rounded-lg border border-border hover:ring-2 hover:ring-primary/50 transition-all flex items-center justify-center"
                    onClick={() => emitEdit("color", preset.cssVar)}
                  >
                    <span style={{ color: preset.value }} className="text-sm font-bold">
                      A
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Custom Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-8 h-8 rounded border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="flex-1 h-8 px-2 text-xs font-mono bg-muted rounded border-0"
                  placeholder="#000000"
                />
                <button
                  onClick={() => emitEdit("background-color", customColor)}
                  className="h-8 px-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "fonts" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Font Family
              </label>
              <div className="space-y-1">
                {FONT_PRESETS.map((font) => (
                  <button
                    key={font.label}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                    style={{ fontFamily: font.value }}
                    onClick={() => emitEdit("font-family", font.value)}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Font Size
              </label>
              <div className="grid grid-cols-4 gap-1">
                {["0.875rem", "1rem", "1.25rem", "1.5rem", "2rem", "2.5rem", "3rem", "4rem"].map(
                  (size) => (
                    <button
                      key={size}
                      className="px-1 py-1 text-xs text-center rounded hover:bg-accent border border-transparent hover:border-border transition-colors"
                      onClick={() => emitEdit("font-size", size)}
                    >
                      {size}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "spacing" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Padding
              </label>
              <div className="space-y-1">
                {SPACING_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors"
                    onClick={() => emitEdit("padding", preset.value)}
                  >
                    <span>{preset.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {preset.cssClass}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Margin Top
              </label>
              <div className="grid grid-cols-3 gap-1">
                {["0", "1rem", "2rem", "3rem", "4rem", "6rem"].map((val) => (
                  <button
                    key={val}
                    className="px-1 py-1 text-xs text-center rounded hover:bg-accent border border-transparent hover:border-border transition-colors"
                    onClick={() => emitEdit("margin-top", val)}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t">
        <button
          onClick={() => emitEdit("reset", "all")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
        <span className="text-[10px] text-muted-foreground">
          Visual Editing
        </span>
      </div>
    </div>
  );
}

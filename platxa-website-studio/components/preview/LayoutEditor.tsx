"use client";

import { useCallback } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Grid3X3,
  LayoutGrid,
  Rows,
  Columns,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// Types
// =============================================================================

interface LayoutEditorProps {
  /** Current layout values */
  value: LayoutValue;
  /** Called when values change */
  onChange: (value: LayoutValue) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

export interface LayoutValue {
  display?: string;
  flexDirection?: string;
  flexWrap?: string;
  justifyContent?: string;
  alignItems?: string;
  alignContent?: string;
  gap?: string;
  rowGap?: string;
  columnGap?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
}

type AlignOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
};

// =============================================================================
// Constants
// =============================================================================

const DISPLAY_OPTIONS = [
  { value: "block", label: "Block" },
  { value: "flex", label: "Flex" },
  { value: "grid", label: "Grid" },
  { value: "inline", label: "Inline" },
  { value: "inline-block", label: "Inline Block" },
  { value: "inline-flex", label: "Inline Flex" },
  { value: "none", label: "None" },
];

const FLEX_DIRECTION_OPTIONS: AlignOption[] = [
  { value: "row", label: "Row", icon: <ArrowRight className="w-4 h-4" /> },
  { value: "row-reverse", label: "Row Reverse", icon: <ArrowLeft className="w-4 h-4" /> },
  { value: "column", label: "Column", icon: <ArrowDown className="w-4 h-4" /> },
  { value: "column-reverse", label: "Column Reverse", icon: <ArrowUp className="w-4 h-4" /> },
];

const FLEX_WRAP_OPTIONS = [
  { value: "nowrap", label: "No Wrap" },
  { value: "wrap", label: "Wrap" },
  { value: "wrap-reverse", label: "Wrap Reverse" },
];

const JUSTIFY_OPTIONS: AlignOption[] = [
  { value: "flex-start", label: "Start", icon: <AlignLeft className="w-4 h-4" /> },
  { value: "center", label: "Center", icon: <AlignCenter className="w-4 h-4" /> },
  { value: "flex-end", label: "End", icon: <AlignRight className="w-4 h-4" /> },
  { value: "space-between", label: "Space Between", icon: <AlignJustify className="w-4 h-4" /> },
  { value: "space-around", label: "Space Around" },
  { value: "space-evenly", label: "Space Evenly" },
];

const ALIGN_ITEMS_OPTIONS: AlignOption[] = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "stretch", label: "Stretch" },
  { value: "baseline", label: "Baseline" },
];

const GRID_PRESETS = [
  { value: "repeat(2, 1fr)", label: "2 Columns", icon: <Columns className="w-4 h-4" /> },
  { value: "repeat(3, 1fr)", label: "3 Columns", icon: <Grid3X3 className="w-4 h-4" /> },
  { value: "repeat(4, 1fr)", label: "4 Columns", icon: <LayoutGrid className="w-4 h-4" /> },
  { value: "repeat(auto-fit, minmax(200px, 1fr))", label: "Auto Fit" },
];

// =============================================================================
// Sub-Components
// =============================================================================

function OptionButtonGroup({
  options,
  value,
  onChange,
  disabled,
}: {
  options: AlignOption[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {options.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <Button
                variant={value === option.value ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  value === option.value && "bg-primary/10 border border-primary/50"
                )}
                onClick={() => onChange(option.value)}
                disabled={disabled}
              >
                {option.icon || option.label.charAt(0)}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {option.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

function AlignmentGrid({
  justifyContent,
  alignItems,
  onChange,
  disabled,
}: {
  justifyContent?: string;
  alignItems?: string;
  onChange: (key: "justifyContent" | "alignItems", value: string) => void;
  disabled?: boolean;
}) {
  const justifyOptions = ["flex-start", "center", "flex-end"];
  const alignOptions = ["flex-start", "center", "flex-end"];

  return (
    <div className="grid grid-cols-3 gap-1 p-2 bg-muted rounded-lg w-fit">
      {alignOptions.map((align) =>
        justifyOptions.map((justify) => {
          const isSelected =
            (justifyContent === justify || (!justifyContent && justify === "flex-start")) &&
            (alignItems === align || (!alignItems && align === "flex-start"));
          return (
            <button
              key={`${justify}-${align}`}
              className={cn(
                "w-6 h-6 rounded border transition-all",
                isSelected
                  ? "bg-primary border-primary"
                  : "bg-background border-border hover:border-primary/50"
              )}
              onClick={() => {
                onChange("justifyContent", justify);
                onChange("alignItems", align);
              }}
              disabled={disabled}
              title={`${justify} / ${align}`}
            >
              <span
                className={cn(
                  "block w-2 h-2 rounded-sm mx-auto",
                  isSelected ? "bg-primary-foreground" : "bg-muted-foreground"
                )}
                style={{
                  marginLeft: justify === "flex-start" ? "2px" : justify === "flex-end" ? "auto" : "auto",
                  marginRight: justify === "flex-start" ? "auto" : justify === "flex-end" ? "2px" : "auto",
                  marginTop: align === "flex-start" ? "2px" : align === "flex-end" ? "auto" : "auto",
                  marginBottom: align === "flex-start" ? "auto" : align === "flex-end" ? "2px" : "auto",
                }}
              />
            </button>
          );
        })
      )}
    </div>
  );
}

function GapInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16">{label}</span>
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="h-7 w-20 text-xs"
        disabled={disabled}
      />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * LayoutEditor - Display and flex/grid layout controls
 *
 * Feature #22: Visual Edit Mode - Layout editor
 *
 * @example
 * ```tsx
 * <LayoutEditor
 *   value={{
 *     display: "flex",
 *     flexDirection: "row",
 *     justifyContent: "center",
 *     alignItems: "center",
 *     gap: "16px",
 *   }}
 *   onChange={(value) => updateLayout(value)}
 * />
 * ```
 */
export function LayoutEditor({
  value,
  onChange,
  disabled = false,
  className,
}: LayoutEditorProps) {
  const handleChange = useCallback(
    (key: keyof LayoutValue, newValue: string) => {
      onChange({ ...value, [key]: newValue });
    },
    [value, onChange]
  );

  const isFlex = value.display === "flex" || value.display === "inline-flex";
  const isGrid = value.display === "grid";

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        {/* Display Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Display</label>
          <Select
            value={value.display || "block"}
            onValueChange={(v) => handleChange("display", v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISPLAY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Flex Controls */}
        {isFlex && (
          <>
            {/* Direction */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Direction</label>
              <OptionButtonGroup
                options={FLEX_DIRECTION_OPTIONS}
                value={value.flexDirection}
                onChange={(v) => handleChange("flexDirection", v)}
                disabled={disabled}
              />
            </div>

            {/* Wrap */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Wrap</label>
              <Select
                value={value.flexWrap || "nowrap"}
                onValueChange={(v) => handleChange("flexWrap", v)}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLEX_WRAP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alignment Grid */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Alignment</label>
              <AlignmentGrid
                justifyContent={value.justifyContent}
                alignItems={value.alignItems}
                onChange={handleChange}
                disabled={disabled}
              />
            </div>

            {/* Justify Content (expanded) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Justify Content</label>
              <OptionButtonGroup
                options={JUSTIFY_OPTIONS}
                value={value.justifyContent}
                onChange={(v) => handleChange("justifyContent", v)}
                disabled={disabled}
              />
            </div>

            {/* Gap */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Gap</label>
              <GapInput
                label="Gap"
                value={value.gap}
                onChange={(v) => handleChange("gap", v)}
                disabled={disabled}
              />
            </div>
          </>
        )}

        {/* Grid Controls */}
        {isGrid && (
          <>
            {/* Grid Template Columns */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Columns</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {GRID_PRESETS.map((preset) => (
                  <Tooltip key={preset.value}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={value.gridTemplateColumns === preset.value ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleChange("gridTemplateColumns", preset.value)}
                        disabled={disabled}
                      >
                        {preset.icon || preset.label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{preset.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <Input
                value={value.gridTemplateColumns || ""}
                onChange={(e) => handleChange("gridTemplateColumns", e.target.value)}
                placeholder="e.g., 1fr 2fr 1fr"
                className="h-7 text-xs"
                disabled={disabled}
              />
            </div>

            {/* Grid Gap */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Gap</label>
              <div className="space-y-2">
                <GapInput
                  label="Row Gap"
                  value={value.rowGap}
                  onChange={(v) => handleChange("rowGap", v)}
                  disabled={disabled}
                />
                <GapInput
                  label="Col Gap"
                  value={value.columnGap}
                  onChange={(v) => handleChange("columnGap", v)}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Alignment */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Alignment</label>
              <AlignmentGrid
                justifyContent={value.justifyContent}
                alignItems={value.alignItems}
                onChange={handleChange}
                disabled={disabled}
              />
            </div>
          </>
        )}

        {/* Preview */}
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground mb-2">Preview</div>
          <div
            className="border border-dashed border-border rounded p-2 min-h-[60px]"
            style={{
              display: value.display || "block",
              flexDirection: value.flexDirection as React.CSSProperties["flexDirection"],
              flexWrap: value.flexWrap as React.CSSProperties["flexWrap"],
              justifyContent: value.justifyContent,
              alignItems: value.alignItems,
              gap: value.gap,
              gridTemplateColumns: value.gridTemplateColumns,
            }}
          >
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center text-xs"
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default LayoutEditor;

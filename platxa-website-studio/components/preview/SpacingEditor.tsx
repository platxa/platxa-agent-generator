"use client";

import { useState, useCallback } from "react";
import { Link, Unlink } from "lucide-react";
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

interface SpacingEditorProps {
  /** Spacing type to edit */
  type: "margin" | "padding";
  /** Current values per side */
  value: SpacingValue;
  /** Called when values change */
  onChange: (value: SpacingValue) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

export interface SpacingValue {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

type Side = keyof SpacingValue;

// =============================================================================
// Constants
// =============================================================================

/** Common spacing presets */
const SPACING_PRESETS = [
  "0",
  "4px",
  "8px",
  "12px",
  "16px",
  "20px",
  "24px",
  "32px",
  "40px",
  "48px",
  "64px",
  "auto",
];

/** Unit options */
const UNITS = ["px", "rem", "em", "%", "vh", "vw"];

/** Side labels */
const SIDE_LABELS: Record<Side, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

// =============================================================================
// Helpers
// =============================================================================

/** Parse value into number and unit */
function parseValue(value: string): { num: string; unit: string } {
  if (value === "auto") return { num: "auto", unit: "" };
  const match = value.match(/^(-?\d*\.?\d*)(.*)$/);
  if (match) {
    return { num: match[1] || "0", unit: match[2] || "px" };
  }
  return { num: "0", unit: "px" };
}

/** Check if all sides have the same value */
function allSidesEqual(value: SpacingValue): boolean {
  return (
    value.top === value.right &&
    value.right === value.bottom &&
    value.bottom === value.left
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

function SideInput({
  side,
  value,
  onChange,
  disabled,
}: {
  side: Side;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { num, unit } = parseValue(value);
  const [inputValue, setInputValue] = useState(num);

  const handleNumChange = (newNum: string) => {
    setInputValue(newNum);
    if (newNum === "auto") {
      onChange("auto");
    } else if (/^-?\d*\.?\d*$/.test(newNum)) {
      onChange(`${newNum}${unit || "px"}`);
    }
  };

  const handleUnitChange = (newUnit: string) => {
    if (num !== "auto") {
      onChange(`${num}${newUnit}`);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        value={inputValue}
        onChange={(e) => handleNumChange(e.target.value)}
        className="h-7 w-14 text-xs text-center px-1"
        disabled={disabled}
        placeholder="0"
      />
      {num !== "auto" && (
        <Select value={unit || "px"} onValueChange={handleUnitChange} disabled={disabled}>
          <SelectTrigger className="h-7 w-14 text-xs px-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u} value={u} className="text-xs">
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function BoxModelVisual({
  type,
  value,
  onChange,
  linked,
  disabled,
}: {
  type: "margin" | "padding";
  value: SpacingValue;
  onChange: (side: Side, val: string) => void;
  linked: boolean;
  disabled?: boolean;
}) {
  const isMargin = type === "margin";
  const outerColor = isMargin ? "bg-orange-100 dark:bg-orange-900/30" : "bg-green-100 dark:bg-green-900/30";
  const innerColor = isMargin ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30";
  const borderColor = isMargin ? "border-orange-300 dark:border-orange-700" : "border-green-300 dark:border-green-700";

  return (
    <div className={cn("relative p-6 rounded-lg", outerColor)}>
      {/* Type label */}
      <span className="absolute top-1 left-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {type}
      </span>

      {/* Top input */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2">
        <SideInput
          side="top"
          value={value.top}
          onChange={(v) => onChange("top", v)}
          disabled={disabled}
        />
      </div>

      {/* Right input */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2">
        <SideInput
          side="right"
          value={value.right}
          onChange={(v) => onChange("right", v)}
          disabled={disabled}
        />
      </div>

      {/* Bottom input */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
        <SideInput
          side="bottom"
          value={value.bottom}
          onChange={(v) => onChange("bottom", v)}
          disabled={disabled}
        />
      </div>

      {/* Left input */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2">
        <SideInput
          side="left"
          value={value.left}
          onChange={(v) => onChange("left", v)}
          disabled={disabled}
        />
      </div>

      {/* Inner box (content/padding representation) */}
      <div
        className={cn(
          "w-24 h-16 mx-auto rounded border-2 border-dashed flex items-center justify-center",
          innerColor,
          borderColor
        )}
      >
        <span className="text-[10px] text-muted-foreground">
          {isMargin ? "border" : "content"}
        </span>
      </div>
    </div>
  );
}

function PresetButtons({
  onSelect,
  disabled,
}: {
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {SPACING_PRESETS.slice(0, 8).map((preset) => (
        <Button
          key={preset}
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onSelect(preset)}
          disabled={disabled}
        >
          {preset}
        </Button>
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * SpacingEditor - Visual margin/padding editor with box model
 *
 * Feature #21: Visual Edit Mode - Spacing editor
 *
 * @example
 * ```tsx
 * <SpacingEditor
 *   type="padding"
 *   value={{ top: "16px", right: "24px", bottom: "16px", left: "24px" }}
 *   onChange={(value) => updatePadding(value)}
 * />
 * ```
 */
export function SpacingEditor({
  type,
  value,
  onChange,
  disabled = false,
  className,
}: SpacingEditorProps) {
  const [linked, setLinked] = useState(allSidesEqual(value));

  const handleSideChange = useCallback(
    (side: Side, newValue: string) => {
      if (linked) {
        // Update all sides when linked
        onChange({
          top: newValue,
          right: newValue,
          bottom: newValue,
          left: newValue,
        });
      } else {
        onChange({ ...value, [side]: newValue });
      }
    },
    [linked, value, onChange]
  );

  const handlePresetSelect = useCallback(
    (preset: string) => {
      onChange({
        top: preset,
        right: preset,
        bottom: preset,
        left: preset,
      });
      setLinked(true);
    },
    [onChange]
  );

  const toggleLinked = useCallback(() => {
    if (!linked) {
      // When linking, set all sides to top value
      onChange({
        top: value.top,
        right: value.top,
        bottom: value.top,
        left: value.top,
      });
    }
    setLinked(!linked);
  }, [linked, value, onChange]);

  return (
    <TooltipProvider>
      <div className={cn("space-y-3", className)}>
        {/* Header with link toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium capitalize">{type}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 w-7 p-0", linked && "text-primary")}
                onClick={toggleLinked}
                disabled={disabled}
              >
                {linked ? (
                  <Link className="w-4 h-4" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {linked ? "Unlink sides" : "Link all sides"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Box model visualization */}
        <BoxModelVisual
          type={type}
          value={value}
          onChange={handleSideChange}
          linked={linked}
          disabled={disabled}
        />

        {/* Preset buttons */}
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Presets</span>
          <PresetButtons onSelect={handlePresetSelect} disabled={disabled} />
        </div>

        {/* Current value display */}
        <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
          {type}: {value.top} {value.right} {value.bottom} {value.left}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default SpacingEditor;

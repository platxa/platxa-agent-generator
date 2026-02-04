"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Pipette, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// =============================================================================
// Types
// =============================================================================

interface ColorPickerProps {
  /** Current color value (hex, rgb, or token reference) */
  value: string;
  /** Called when color changes */
  onChange: (value: string) => void;
  /** Design tokens to display */
  tokens?: DesignToken[];
  /** Recently used colors */
  recentColors?: string[];
  /** Whether to show opacity slider */
  showOpacity?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

interface DesignToken {
  /** Token name (e.g., "primary", "brand-500") */
  name: string;
  /** Token value (hex color) */
  value: string;
  /** Display label */
  label?: string;
  /** Token category */
  category?: string;
}

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default design tokens (Platxa brand colors) */
const DEFAULT_TOKENS: DesignToken[] = [
  { name: "primary", value: "#6366f1", label: "Primary", category: "Brand" },
  { name: "primary-light", value: "#818cf8", label: "Primary Light", category: "Brand" },
  { name: "primary-dark", value: "#4f46e5", label: "Primary Dark", category: "Brand" },
  { name: "secondary", value: "#ec4899", label: "Secondary", category: "Brand" },
  { name: "accent", value: "#14b8a6", label: "Accent", category: "Brand" },
  { name: "success", value: "#22c55e", label: "Success", category: "Status" },
  { name: "warning", value: "#f59e0b", label: "Warning", category: "Status" },
  { name: "error", value: "#ef4444", label: "Error", category: "Status" },
  { name: "info", value: "#3b82f6", label: "Info", category: "Status" },
  { name: "neutral-50", value: "#fafafa", label: "Gray 50", category: "Neutral" },
  { name: "neutral-100", value: "#f4f4f5", label: "Gray 100", category: "Neutral" },
  { name: "neutral-200", value: "#e4e4e7", label: "Gray 200", category: "Neutral" },
  { name: "neutral-300", value: "#d4d4d8", label: "Gray 300", category: "Neutral" },
  { name: "neutral-400", value: "#a1a1aa", label: "Gray 400", category: "Neutral" },
  { name: "neutral-500", value: "#71717a", label: "Gray 500", category: "Neutral" },
  { name: "neutral-600", value: "#52525b", label: "Gray 600", category: "Neutral" },
  { name: "neutral-700", value: "#3f3f46", label: "Gray 700", category: "Neutral" },
  { name: "neutral-800", value: "#27272a", label: "Gray 800", category: "Neutral" },
  { name: "neutral-900", value: "#18181b", label: "Gray 900", category: "Neutral" },
];

// =============================================================================
// Helpers
// =============================================================================

/** Parse color string to RGBA */
function parseColor(color: string): RgbaColor {
  // Handle rgba
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // Handle hex
  let hex = color.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  if (hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: parseInt(hex.slice(6, 8), 16) / 255,
    };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

/** Convert RGBA to hex string */
function rgbaToHex(color: RgbaColor, includeAlpha = false): string {
  const r = color.r.toString(16).padStart(2, "0");
  const g = color.g.toString(16).padStart(2, "0");
  const b = color.b.toString(16).padStart(2, "0");
  if (includeAlpha && color.a < 1) {
    const a = Math.round(color.a * 255).toString(16).padStart(2, "0");
    return `#${r}${g}${b}${a}`;
  }
  return `#${r}${g}${b}`;
}

/** Convert RGBA to rgba string */
function rgbaToString(color: RgbaColor): string {
  if (color.a < 1) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a.toFixed(2)})`;
  }
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/** Check if color is a token reference */
function isTokenReference(value: string): boolean {
  return value.startsWith("var(--") || value.startsWith("$");
}

/** Get hex from token reference */
function resolveToken(value: string, tokens: DesignToken[]): string | null {
  // Extract token name from var(--name) or $name
  const match = value.match(/var\(--([^)]+)\)/) || value.match(/\$(.+)/);
  if (!match) return null;

  const tokenName = match[1];
  const token = tokens.find((t) => t.name === tokenName);
  return token?.value || null;
}

// =============================================================================
// Sub-Components
// =============================================================================

function ColorSwatch({
  color,
  selected,
  onClick,
  label,
  size = "md",
}: {
  color: string;
  selected?: boolean;
  onClick?: () => void;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={label || color}
      className={cn(
        "relative rounded-md border transition-all",
        "hover:scale-110 hover:z-10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-primary ring-offset-2",
        sizeClasses[size]
      )}
      style={{ backgroundColor: color }}
    >
      {selected && (
        <Check
          className={cn(
            "absolute inset-0 m-auto text-white drop-shadow",
            size === "sm" ? "w-3 h-3" : "w-4 h-4"
          )}
        />
      )}
    </button>
  );
}

function TokenGrid({
  tokens,
  selectedToken,
  onSelect,
}: {
  tokens: DesignToken[];
  selectedToken?: string;
  onSelect: (token: DesignToken) => void;
}) {
  // Group tokens by category
  const grouped = useMemo(() => {
    const groups = new Map<string, DesignToken[]>();
    for (const token of tokens) {
      const category = token.category || "Other";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(token);
    }
    return groups;
  }, [tokens]);

  return (
    <div className="space-y-3">
      {Array.from(grouped.entries()).map(([category, categoryTokens]) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            {category}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {categoryTokens.map((token) => (
              <ColorSwatch
                key={token.name}
                color={token.value}
                selected={selectedToken === token.name}
                onClick={() => onSelect(token)}
                label={token.label || token.name}
                size="md"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomColorPicker({
  color,
  onChange,
  showOpacity,
}: {
  color: RgbaColor;
  onChange: (color: RgbaColor) => void;
  showOpacity: boolean;
}) {
  const [hexInput, setHexInput] = useState(rgbaToHex(color));

  useEffect(() => {
    setHexInput(rgbaToHex(color));
  }, [color]);

  const handleHexChange = (value: string) => {
    setHexInput(value);
    if (/^#?[0-9a-fA-F]{6}$/.test(value)) {
      const parsed = parseColor(value);
      onChange({ ...parsed, a: color.a });
    }
  };

  const handleRgbChange = (channel: "r" | "g" | "b", value: number) => {
    onChange({ ...color, [channel]: Math.max(0, Math.min(255, value)) });
  };

  const handleOpacityChange = (value: number[]) => {
    onChange({ ...color, a: value[0] / 100 });
  };

  return (
    <div className="space-y-4">
      {/* Color preview */}
      <div
        className="h-24 rounded-lg border"
        style={{
          background: `
            linear-gradient(${rgbaToString(color)}, ${rgbaToString(color)}),
            repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 16px 16px
          `,
        }}
      />

      {/* Hex input */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-8">HEX</span>
        <Input
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          className="h-8 text-xs font-mono"
          placeholder="#000000"
        />
      </div>

      {/* RGB inputs */}
      <div className="grid grid-cols-3 gap-2">
        {(["r", "g", "b"] as const).map((channel) => (
          <div key={channel}>
            <label className="text-xs text-muted-foreground uppercase">
              {channel}
            </label>
            <Input
              type="number"
              min={0}
              max={255}
              value={color[channel]}
              onChange={(e) => handleRgbChange(channel, parseInt(e.target.value) || 0)}
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>

      {/* Opacity slider */}
      {showOpacity && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Opacity</span>
            <span className="text-xs font-mono">{Math.round(color.a * 100)}%</span>
          </div>
          <Slider
            value={[color.a * 100]}
            onValueChange={handleOpacityChange}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ColorPicker - Color selection with design tokens and custom colors
 *
 * Feature #19: Visual Edit Mode - Color picker
 *
 * @example
 * ```tsx
 * <ColorPicker
 *   value="#6366f1"
 *   onChange={(color) => setColor(color)}
 *   tokens={brandTokens}
 *   showOpacity
 * />
 * ```
 */
export function ColorPicker({
  value,
  onChange,
  tokens = DEFAULT_TOKENS,
  recentColors = [],
  showOpacity = true,
  disabled = false,
  className,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tokens" | "custom">("tokens");

  // Parse current color
  const parsedColor = useMemo(() => {
    // Check if it's a token reference
    if (isTokenReference(value)) {
      const resolved = resolveToken(value, tokens);
      return parseColor(resolved || "#000000");
    }
    return parseColor(value);
  }, [value, tokens]);

  // Find selected token
  const selectedToken = useMemo(() => {
    if (isTokenReference(value)) {
      const match = value.match(/var\(--([^)]+)\)/) || value.match(/\$(.+)/);
      return match?.[1];
    }
    return tokens.find((t) => t.value.toLowerCase() === value.toLowerCase())?.name;
  }, [value, tokens]);

  // Handle token selection
  const handleTokenSelect = useCallback(
    (token: DesignToken) => {
      onChange(`var(--${token.name})`);
      setOpen(false);
    },
    [onChange]
  );

  // Handle custom color change
  const handleCustomColorChange = useCallback(
    (color: RgbaColor) => {
      if (color.a < 1) {
        onChange(rgbaToString(color));
      } else {
        onChange(rgbaToHex(color));
      }
    },
    [onChange]
  );

  // Handle recent color selection
  const handleRecentSelect = useCallback(
    (color: string) => {
      onChange(color);
      setOpen(false);
    },
    [onChange]
  );

  const displayColor = rgbaToHex(parsedColor);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start gap-2 h-9", className)}
        >
          <div
            className="w-5 h-5 rounded border"
            style={{ backgroundColor: displayColor }}
          />
          <span className="flex-1 text-left text-xs font-mono truncate">
            {selectedToken ? `--${selectedToken}` : value}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="tokens" className="text-xs">
              Design Tokens
            </TabsTrigger>
            <TabsTrigger value="custom" className="text-xs">
              Custom
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tokens" className="mt-0">
            <TokenGrid
              tokens={tokens}
              selectedToken={selectedToken}
              onSelect={handleTokenSelect}
            />
          </TabsContent>

          <TabsContent value="custom" className="mt-0">
            <CustomColorPicker
              color={parsedColor}
              onChange={handleCustomColorChange}
              showOpacity={showOpacity}
            />
          </TabsContent>
        </Tabs>

        {/* Recent colors */}
        {recentColors.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              Recent
            </h4>
            <div className="flex flex-wrap gap-1">
              {recentColors.slice(0, 10).map((color, i) => (
                <ColorSwatch
                  key={`${color}-${i}`}
                  color={color}
                  onClick={() => handleRecentSelect(color)}
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}

        {/* Eyedropper (future enhancement) */}
        <div className="mt-3 pt-3 border-t flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            Current: <code className="font-mono">{displayColor}</code>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            title="Pick from screen (coming soon)"
            disabled
          >
            <Pipette className="w-4 h-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ColorPicker;

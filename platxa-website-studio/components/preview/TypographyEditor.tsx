"use client";

import { useState, useCallback, useMemo } from "react";
import { Type, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// =============================================================================
// Types
// =============================================================================

interface TypographyEditorProps {
  /** Current typography values */
  value: TypographyValue;
  /** Called when any value changes */
  onChange: (value: TypographyValue) => void;
  /** Available font families */
  fontFamilies?: FontOption[];
  /** Compact mode (single row) */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

export interface TypographyValue {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
}

interface FontOption {
  /** Font family value */
  value: string;
  /** Display label */
  label: string;
  /** Font category */
  category?: "sans" | "serif" | "mono" | "display" | "custom";
  /** Google Fonts URL (if applicable) */
  googleFont?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Default font families */
const DEFAULT_FONTS: FontOption[] = [
  { value: "Inter", label: "Inter", category: "sans", googleFont: true },
  { value: "Roboto", label: "Roboto", category: "sans", googleFont: true },
  { value: "Open Sans", label: "Open Sans", category: "sans", googleFont: true },
  { value: "Lato", label: "Lato", category: "sans", googleFont: true },
  { value: "Poppins", label: "Poppins", category: "sans", googleFont: true },
  { value: "Montserrat", label: "Montserrat", category: "sans", googleFont: true },
  { value: "Source Sans Pro", label: "Source Sans Pro", category: "sans", googleFont: true },
  { value: "Playfair Display", label: "Playfair Display", category: "serif", googleFont: true },
  { value: "Merriweather", label: "Merriweather", category: "serif", googleFont: true },
  { value: "Lora", label: "Lora", category: "serif", googleFont: true },
  { value: "Georgia", label: "Georgia", category: "serif" },
  { value: "Times New Roman", label: "Times New Roman", category: "serif" },
  { value: "JetBrains Mono", label: "JetBrains Mono", category: "mono", googleFont: true },
  { value: "Fira Code", label: "Fira Code", category: "mono", googleFont: true },
  { value: "Source Code Pro", label: "Source Code Pro", category: "mono", googleFont: true },
  { value: "Courier New", label: "Courier New", category: "mono" },
  { value: "system-ui", label: "System UI", category: "sans" },
  { value: "inherit", label: "Inherit", category: "custom" },
];

/** Font weight options */
const FONT_WEIGHTS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra Light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

/** Common font sizes */
const FONT_SIZES = [
  "10px", "11px", "12px", "13px", "14px", "15px", "16px", "18px",
  "20px", "24px", "28px", "32px", "36px", "40px", "48px", "56px",
  "64px", "72px", "80px", "96px",
];

/** Common line heights */
const LINE_HEIGHTS = [
  { value: "1", label: "1 (tight)" },
  { value: "1.25", label: "1.25" },
  { value: "1.375", label: "1.375" },
  { value: "1.5", label: "1.5 (normal)" },
  { value: "1.625", label: "1.625" },
  { value: "1.75", label: "1.75" },
  { value: "2", label: "2 (loose)" },
  { value: "normal", label: "Normal" },
  { value: "inherit", label: "Inherit" },
];

/** Common letter spacings */
const LETTER_SPACINGS = [
  { value: "-0.05em", label: "-0.05em (tighter)" },
  { value: "-0.025em", label: "-0.025em" },
  { value: "0", label: "0 (normal)" },
  { value: "0.025em", label: "0.025em" },
  { value: "0.05em", label: "0.05em" },
  { value: "0.1em", label: "0.1em (wider)" },
  { value: "0.15em", label: "0.15em" },
  { value: "inherit", label: "Inherit" },
];

// =============================================================================
// Helper Components
// =============================================================================

function FontFamilySelect({
  value,
  onChange,
  fonts,
  disabled,
}: {
  value?: string;
  onChange: (value: string) => void;
  fonts: FontOption[];
  disabled?: boolean;
}) {
  // Group fonts by category
  const grouped = useMemo(() => {
    const groups = new Map<string, FontOption[]>();
    for (const font of fonts) {
      const category = font.category || "custom";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(font);
    }
    return groups;
  }, [fonts]);

  const categoryLabels: Record<string, string> = {
    sans: "Sans Serif",
    serif: "Serif",
    mono: "Monospace",
    display: "Display",
    custom: "Other",
  };

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select font" />
      </SelectTrigger>
      <SelectContent>
        {Array.from(grouped.entries()).map(([category, categoryFonts]) => (
          <div key={category}>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {categoryLabels[category] || category}
            </div>
            {categoryFonts.map((font) => (
              <SelectItem
                key={font.value}
                value={font.value}
                className="text-xs"
                style={{ fontFamily: font.value }}
              >
                {font.label}
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

function FontSizeInput({
  value,
  onChange,
  disabled,
}: {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState(value || "16px");

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    // Only trigger onChange if it looks like a valid size
    if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(newValue) || /^\d+$/.test(newValue)) {
      onChange(newValue.includes("px") || newValue.includes("rem") || newValue.includes("em") || newValue.includes("%")
        ? newValue
        : `${newValue}px`
      );
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        className="h-8 w-20 text-xs"
        disabled={disabled}
      />
      <Select
        value={value || ""}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-8 p-0">
          <ChevronDown className="h-3 w-3" />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((size) => (
            <SelectItem key={size} value={size} className="text-xs">
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FontWeightSelect({
  value,
  onChange,
  disabled,
}: {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value || "400"} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FONT_WEIGHTS.map((weight) => (
          <SelectItem
            key={weight.value}
            value={weight.value}
            className="text-xs"
            style={{ fontWeight: weight.value }}
          >
            {weight.label} ({weight.value})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LineHeightSelect({
  value,
  onChange,
  disabled,
}: {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value || "1.5"} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LINE_HEIGHTS.map((lh) => (
          <SelectItem key={lh.value} value={lh.value} className="text-xs">
            {lh.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LetterSpacingSelect({
  value,
  onChange,
  disabled,
}: {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value || "0"} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LETTER_SPACINGS.map((ls) => (
          <SelectItem key={ls.value} value={ls.value} className="text-xs">
            {ls.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * TypographyEditor - Complete typography control panel
 *
 * Feature #20: Visual Edit Mode - Typography editor
 *
 * @example
 * ```tsx
 * <TypographyEditor
 *   value={{
 *     fontFamily: "Inter",
 *     fontSize: "16px",
 *     fontWeight: "400",
 *     lineHeight: "1.5",
 *     letterSpacing: "0",
 *   }}
 *   onChange={(value) => updateTypography(value)}
 * />
 * ```
 */
export function TypographyEditor({
  value,
  onChange,
  fontFamilies = DEFAULT_FONTS,
  compact = false,
  disabled = false,
  className,
}: TypographyEditorProps) {
  const handleChange = useCallback(
    (key: keyof TypographyValue, newValue: string) => {
      onChange({ ...value, [key]: newValue });
    },
    [value, onChange]
  );

  // Compact popover variant
  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn("w-full justify-start gap-2 h-9", className)}
          >
            <Type className="w-4 h-4" />
            <span className="flex-1 text-left text-xs truncate">
              {value.fontFamily || "Select font"} • {value.fontSize || "16px"}
            </span>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <TypographyEditorContent
            value={value}
            onChange={handleChange}
            fontFamilies={fontFamilies}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <TypographyEditorContent
        value={value}
        onChange={handleChange}
        fontFamilies={fontFamilies}
        disabled={disabled}
      />
    </div>
  );
}

function TypographyEditorContent({
  value,
  onChange,
  fontFamilies,
  disabled,
}: {
  value: TypographyValue;
  onChange: (key: keyof TypographyValue, value: string) => void;
  fontFamilies: FontOption[];
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Preview */}
      <div
        className="p-4 bg-muted rounded-lg text-center"
        style={{
          fontFamily: value.fontFamily,
          fontSize: value.fontSize,
          fontWeight: value.fontWeight,
          lineHeight: value.lineHeight,
          letterSpacing: value.letterSpacing,
        }}
      >
        The quick brown fox jumps over the lazy dog
      </div>

      {/* Font Family */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Font Family
        </label>
        <FontFamilySelect
          value={value.fontFamily}
          onChange={(v) => onChange("fontFamily", v)}
          fonts={fontFamilies}
          disabled={disabled}
        />
      </div>

      {/* Font Size & Weight */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Size
          </label>
          <FontSizeInput
            value={value.fontSize}
            onChange={(v) => onChange("fontSize", v)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Weight
          </label>
          <FontWeightSelect
            value={value.fontWeight}
            onChange={(v) => onChange("fontWeight", v)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Line Height & Letter Spacing */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Line Height
          </label>
          <LineHeightSelect
            value={value.lineHeight}
            onChange={(v) => onChange("lineHeight", v)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Letter Spacing
          </label>
          <LetterSpacingSelect
            value={value.letterSpacing}
            onChange={(v) => onChange("letterSpacing", v)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

export default TypographyEditor;

"use client";

/**
 * ThemeCustomizer - Edit colors, fonts, spacing, and radius
 *
 * Provides real-time theme property editing with:
 * - Color picker for all theme colors
 * - Font family selection
 * - Spacing controls
 * - Border radius adjustment
 * - Live preview updates
 *
 * Feature #66: Theme System - ThemeCustomizer Component
 */

import { useState, useCallback, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Palette,
  Type,
  Ruler,
  Square,
  ChevronDown,
  RotateCcw,
  Copy,
  Check,
} from "lucide-react";
import type { ColorScheme, Typography, Spacing } from "@/lib/themes";

// =============================================================================
// Types
// =============================================================================

/** Theme customization values */
export interface ThemeValues {
  colors: ColorScheme;
  typography: {
    headingFont: string;
    bodyFont: string;
    baseFontSize: number;
    lineHeight: number;
    headingWeight: string;
  };
  spacing: {
    sectionPadding: number;
    containerWidth: number;
    gap: number;
    borderRadius: number;
  };
}

/** ThemeCustomizer props */
export interface ThemeCustomizerProps {
  /** Initial theme values */
  initialValues: ThemeValues;
  /** Callback when values change */
  onChange?: (values: ThemeValues) => void;
  /** Callback for real-time preview updates */
  onPreviewUpdate?: (cssVariables: string) => void;
  /** Whether to show reset button */
  showReset?: boolean;
  /** Whether to show export button */
  showExport?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Color input props */
interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

// =============================================================================
// Constants
// =============================================================================

const FONT_OPTIONS = [
  { value: "Inter, system-ui, sans-serif", label: "Inter" },
  { value: "Roboto, system-ui, sans-serif", label: "Roboto" },
  { value: "Open Sans, system-ui, sans-serif", label: "Open Sans" },
  { value: "Poppins, system-ui, sans-serif", label: "Poppins" },
  { value: "Montserrat, system-ui, sans-serif", label: "Montserrat" },
  { value: "Lato, system-ui, sans-serif", label: "Lato" },
  { value: "Source Sans 3, system-ui, sans-serif", label: "Source Sans" },
  { value: "Nunito, system-ui, sans-serif", label: "Nunito" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Playfair Display, serif", label: "Playfair Display" },
  { value: "Merriweather, serif", label: "Merriweather" },
  { value: "Lora, serif", label: "Lora" },
  { value: "system-ui, sans-serif", label: "System UI" },
];

const FONT_WEIGHT_OPTIONS = [
  { value: "300", label: "Light (300)" },
  { value: "400", label: "Regular (400)" },
  { value: "500", label: "Medium (500)" },
  { value: "600", label: "Semibold (600)" },
  { value: "700", label: "Bold (700)" },
  { value: "800", label: "Extrabold (800)" },
];

const DEFAULT_VALUES: ThemeValues = {
  colors: {
    primary: "#2563eb",
    secondary: "#7c3aed",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#1e293b",
    textMuted: "#64748b",
    border: "#e2e8f0",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
  },
  typography: {
    headingFont: "Inter, system-ui, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    baseFontSize: 16,
    lineHeight: 1.6,
    headingWeight: "600",
  },
  spacing: {
    sectionPadding: 80,
    containerWidth: 1280,
    gap: 24,
    borderRadius: 8,
  },
};

// =============================================================================
// Sub-components
// =============================================================================

/** Color input with picker */
function ColorInput({ label, value, onChange, description }: ColorInputProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground font-mono">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="w-10 h-10 rounded-md border border-border shadow-sm"
            style={{ backgroundColor: value }}
          />
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-sm"
          placeholder="#000000"
        />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** Collapsible section */
function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-3 text-sm font-medium hover:bg-muted/50 rounded-lg px-2 -mx-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{title}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-4 space-y-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ThemeCustomizer allows editing all theme properties with real-time preview.
 *
 * @example
 * ```tsx
 * <ThemeCustomizer
 *   initialValues={currentTheme}
 *   onChange={handleThemeChange}
 *   onPreviewUpdate={injectPreviewStyles}
 *   showReset
 *   showExport
 * />
 * ```
 */
export function ThemeCustomizer({
  initialValues,
  onChange,
  onPreviewUpdate,
  showReset = true,
  showExport = true,
  className = "",
}: ThemeCustomizerProps) {
  const [values, setValues] = useState<ThemeValues>(initialValues);
  const [copied, setCopied] = useState(false);

  // Generate CSS variables from current values
  const generateCSSVariables = useCallback((v: ThemeValues): string => {
    return `
:root {
  /* Colors */
  --theme-primary: ${v.colors.primary};
  --theme-secondary: ${v.colors.secondary};
  --theme-background: ${v.colors.background};
  --theme-surface: ${v.colors.surface};
  --theme-text: ${v.colors.text};
  --theme-text-muted: ${v.colors.textMuted};
  --theme-border: ${v.colors.border};
  --theme-success: ${v.colors.success};
  --theme-warning: ${v.colors.warning};
  --theme-error: ${v.colors.error};

  /* Typography */
  --theme-font-heading: ${v.typography.headingFont};
  --theme-font-body: ${v.typography.bodyFont};
  --theme-font-size-base: ${v.typography.baseFontSize}px;
  --theme-line-height: ${v.typography.lineHeight};
  --theme-heading-weight: ${v.typography.headingWeight};

  /* Spacing */
  --theme-section-padding: ${v.spacing.sectionPadding}px;
  --theme-container-width: ${v.spacing.containerWidth}px;
  --theme-gap: ${v.spacing.gap}px;
  --theme-border-radius: ${v.spacing.borderRadius}px;
}
    `.trim();
  }, []);

  // Update values and notify listeners
  const updateValues = useCallback(
    (newValues: ThemeValues) => {
      setValues(newValues);
      onChange?.(newValues);
      onPreviewUpdate?.(generateCSSVariables(newValues));
    },
    [onChange, onPreviewUpdate, generateCSSVariables]
  );

  // Color update helper
  const updateColor = useCallback(
    (key: keyof ColorScheme, value: string) => {
      updateValues({
        ...values,
        colors: { ...values.colors, [key]: value },
      });
    },
    [values, updateValues]
  );

  // Typography update helper
  const updateTypography = useCallback(
    (key: keyof ThemeValues["typography"], value: string | number) => {
      updateValues({
        ...values,
        typography: { ...values.typography, [key]: value },
      });
    },
    [values, updateValues]
  );

  // Spacing update helper
  const updateSpacing = useCallback(
    (key: keyof ThemeValues["spacing"], value: number) => {
      updateValues({
        ...values,
        spacing: { ...values.spacing, [key]: value },
      });
    },
    [values, updateValues]
  );

  // Reset to initial values
  const handleReset = useCallback(() => {
    updateValues(initialValues);
  }, [initialValues, updateValues]);

  // Copy CSS variables to clipboard
  const handleCopyCSS = useCallback(async () => {
    const css = generateCSSVariables(values);
    await navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [values, generateCSSVariables]);

  // Initial preview update
  useEffect(() => {
    onPreviewUpdate?.(generateCSSVariables(values));
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Theme Customizer</h3>
        <div className="flex items-center gap-2">
          {showReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
          {showExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCSS}
              className="h-8 text-xs"
            >
              {copied ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              {copied ? "Copied!" : "Copy CSS"}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="colors" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="colors" className="text-xs">
            <Palette className="h-3 w-3 mr-1" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography" className="text-xs">
            <Type className="h-3 w-3 mr-1" />
            Fonts
          </TabsTrigger>
          <TabsTrigger value="spacing" className="text-xs">
            <Ruler className="h-3 w-3 mr-1" />
            Spacing
          </TabsTrigger>
          <TabsTrigger value="radius" className="text-xs">
            <Square className="h-3 w-3 mr-1" />
            Radius
          </TabsTrigger>
        </TabsList>

        {/* Colors Tab */}
        <TabsContent value="colors" className="mt-4 space-y-2">
          <Section title="Brand Colors" icon={Palette}>
            <ColorInput
              label="Primary"
              value={values.colors.primary}
              onChange={(v) => updateColor("primary", v)}
              description="Main brand color for buttons and accents"
            />
            <ColorInput
              label="Secondary"
              value={values.colors.secondary}
              onChange={(v) => updateColor("secondary", v)}
              description="Secondary accent color"
            />
          </Section>

          <Section title="Background Colors" icon={Palette} defaultOpen={false}>
            <ColorInput
              label="Background"
              value={values.colors.background}
              onChange={(v) => updateColor("background", v)}
              description="Page background color"
            />
            <ColorInput
              label="Surface"
              value={values.colors.surface}
              onChange={(v) => updateColor("surface", v)}
              description="Cards and elevated surfaces"
            />
          </Section>

          <Section title="Text Colors" icon={Type} defaultOpen={false}>
            <ColorInput
              label="Text"
              value={values.colors.text}
              onChange={(v) => updateColor("text", v)}
              description="Primary text color"
            />
            <ColorInput
              label="Text Muted"
              value={values.colors.textMuted}
              onChange={(v) => updateColor("textMuted", v)}
              description="Secondary/muted text"
            />
            <ColorInput
              label="Border"
              value={values.colors.border}
              onChange={(v) => updateColor("border", v)}
              description="Border and divider color"
            />
          </Section>

          <Section title="Status Colors" icon={Palette} defaultOpen={false}>
            <ColorInput
              label="Success"
              value={values.colors.success}
              onChange={(v) => updateColor("success", v)}
            />
            <ColorInput
              label="Warning"
              value={values.colors.warning}
              onChange={(v) => updateColor("warning", v)}
            />
            <ColorInput
              label="Error"
              value={values.colors.error}
              onChange={(v) => updateColor("error", v)}
            />
          </Section>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Heading Font</Label>
            <Select
              value={values.typography.headingFont}
              onValueChange={(v) => updateTypography("headingFont", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Body Font</Label>
            <Select
              value={values.typography.bodyFont}
              onValueChange={(v) => updateTypography("bodyFont", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Heading Weight</Label>
            <Select
              value={values.typography.headingWeight}
              onValueChange={(v) => updateTypography("headingWeight", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_WEIGHT_OPTIONS.map((weight) => (
                  <SelectItem key={weight.value} value={weight.value}>
                    {weight.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Base Font Size</Label>
              <span className="text-sm text-muted-foreground">
                {values.typography.baseFontSize}px
              </span>
            </div>
            <Slider
              value={[values.typography.baseFontSize]}
              onValueChange={([v]) => updateTypography("baseFontSize", v)}
              min={12}
              max={20}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Line Height</Label>
              <span className="text-sm text-muted-foreground">
                {values.typography.lineHeight}
              </span>
            </div>
            <Slider
              value={[values.typography.lineHeight]}
              onValueChange={([v]) => updateTypography("lineHeight", v)}
              min={1.2}
              max={2}
              step={0.05}
            />
          </div>
        </TabsContent>

        {/* Spacing Tab */}
        <TabsContent value="spacing" className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Section Padding</Label>
              <span className="text-sm text-muted-foreground">
                {values.spacing.sectionPadding}px
              </span>
            </div>
            <Slider
              value={[values.spacing.sectionPadding]}
              onValueChange={([v]) => updateSpacing("sectionPadding", v)}
              min={24}
              max={160}
              step={8}
            />
            <p className="text-xs text-muted-foreground">
              Vertical padding for page sections
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Container Width</Label>
              <span className="text-sm text-muted-foreground">
                {values.spacing.containerWidth}px
              </span>
            </div>
            <Slider
              value={[values.spacing.containerWidth]}
              onValueChange={([v]) => updateSpacing("containerWidth", v)}
              min={720}
              max={1600}
              step={40}
            />
            <p className="text-xs text-muted-foreground">
              Maximum width of content container
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Component Gap</Label>
              <span className="text-sm text-muted-foreground">
                {values.spacing.gap}px
              </span>
            </div>
            <Slider
              value={[values.spacing.gap]}
              onValueChange={([v]) => updateSpacing("gap", v)}
              min={8}
              max={48}
              step={4}
            />
            <p className="text-xs text-muted-foreground">
              Space between components in grids
            </p>
          </div>
        </TabsContent>

        {/* Border Radius Tab */}
        <TabsContent value="radius" className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Border Radius</Label>
              <span className="text-sm text-muted-foreground">
                {values.spacing.borderRadius}px
              </span>
            </div>
            <Slider
              value={[values.spacing.borderRadius]}
              onValueChange={([v]) => updateSpacing("borderRadius", v)}
              min={0}
              max={24}
              step={1}
            />
          </div>

          {/* Preview boxes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Preview
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <div
                className="h-16 bg-primary/20 border border-primary"
                style={{ borderRadius: `${values.spacing.borderRadius}px` }}
              />
              <div
                className="h-16 bg-secondary/20 border border-secondary"
                style={{ borderRadius: `${values.spacing.borderRadius}px` }}
              />
              <div
                className="h-16 bg-muted border"
                style={{ borderRadius: `${values.spacing.borderRadius}px` }}
              />
            </div>
          </div>

          {/* Preset buttons */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Presets
            </Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Sharp", value: 0 },
                { label: "Subtle", value: 4 },
                { label: "Rounded", value: 8 },
                { label: "Smooth", value: 12 },
                { label: "Pill", value: 24 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant={
                    values.spacing.borderRadius === preset.value
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => updateSpacing("borderRadius", preset.value)}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ThemeCustomizer;

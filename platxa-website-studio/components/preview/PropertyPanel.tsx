"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Type,
  Palette,
  Layout,
  Settings,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getVisualEditor,
  type SelectedElement,
  type EditableProperty,
  type PropertyType,
} from "@/lib/agent-bridge/visual-editor";

// =============================================================================
// Types
// =============================================================================

interface PropertyPanelProps {
  /** Currently selected element */
  selection: SelectedElement | null;
  /** Called when a property value changes */
  onPropertyChange?: (propertyId: string, value: string) => void;
  /** Called when changes are applied */
  onApply?: () => void;
  /** Called when changes are discarded */
  onDiscard?: () => void;
  /** Additional class name */
  className?: string;
}

interface PropertyGroupProps {
  title: string;
  properties: EditableProperty[];
  onPropertyChange: (propertyId: string, value: string) => void;
  defaultExpanded?: boolean;
}

interface PropertyRowProps {
  property: EditableProperty;
  onChange: (value: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const TAB_CONFIG = [
  { id: "text", label: "Text", icon: Type },
  { id: "style", label: "Style", icon: Palette },
  { id: "layout", label: "Layout", icon: Layout },
  { id: "advanced", label: "Advanced", icon: Settings },
] as const;

type TabId = (typeof TAB_CONFIG)[number]["id"];

/** Map property types to tabs */
const PROPERTY_TAB_MAP: Record<PropertyType, TabId> = {
  text: "text",
  font: "text",
  color: "style",
  border: "style",
  shadow: "style",
  size: "layout",
  spacing: "layout",
  visibility: "layout",
  class: "advanced",
  attribute: "advanced",
  style: "advanced",
};

// =============================================================================
// Property Input Components
// =============================================================================

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value.startsWith("#") ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded border cursor-pointer"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-8 text-xs font-mono"
        placeholder="#000000"
      />
    </div>
  );
}

function SizeInput({
  value,
  onChange,
  unit = "px",
}: {
  value: string;
  onChange: (v: string) => void;
  unit?: string;
}) {
  // Parse numeric value
  const numMatch = value.match(/^(\d+(?:\.\d+)?)/);
  const numValue = numMatch ? numMatch[1] : "";
  const unitMatch = value.match(/[a-z%]+$/i);
  const currentUnit = unitMatch ? unitMatch[0] : unit;

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={numValue}
        onChange={(e) => onChange(`${e.target.value}${currentUnit}`)}
        className="flex-1 h-8 text-xs"
        min={0}
      />
      <select
        value={currentUnit}
        onChange={(e) => onChange(`${numValue}${e.target.value}`)}
        className="h-8 px-2 text-xs border rounded bg-background"
      >
        <option value="px">px</option>
        <option value="rem">rem</option>
        <option value="em">em</option>
        <option value="%">%</option>
        <option value="vh">vh</option>
        <option value="vw">vw</option>
      </select>
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-8 px-2 text-xs border rounded bg-background"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

// =============================================================================
// Property Row
// =============================================================================

function PropertyRow({ property, onChange }: PropertyRowProps) {
  const renderInput = () => {
    // Color picker for color properties
    if (property.type === "color" || property.cssProperty?.includes("color")) {
      return <ColorInput value={property.value} onChange={onChange} />;
    }

    // Size input for size/spacing properties
    if (property.type === "size" || property.type === "spacing") {
      return <SizeInput value={property.value} onChange={onChange} />;
    }

    // Select for properties with allowed values
    if (property.allowedValues && property.allowedValues.length > 0) {
      return (
        <SelectInput
          value={property.value}
          onChange={onChange}
          options={property.allowedValues}
        />
      );
    }

    // Font weight select
    if (property.cssProperty === "font-weight") {
      return (
        <SelectInput
          value={property.value}
          onChange={onChange}
          options={["100", "200", "300", "400", "500", "600", "700", "800", "900"]}
        />
      );
    }

    // Text align select
    if (property.cssProperty === "text-align") {
      return (
        <SelectInput
          value={property.value}
          onChange={onChange}
          options={["left", "center", "right", "justify"]}
        />
      );
    }

    // Display select
    if (property.cssProperty === "display") {
      return (
        <SelectInput
          value={property.value}
          onChange={onChange}
          options={["block", "flex", "grid", "inline", "inline-block", "none"]}
        />
      );
    }

    // Default text input
    return (
      <Input
        value={property.value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
        placeholder="Enter value"
      />
    );
  };

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <label className="text-xs text-muted-foreground min-w-[80px] truncate">
        {property.name}
      </label>
      <div className="flex-1 max-w-[140px]">{renderInput()}</div>
    </div>
  );
}

// =============================================================================
// Property Group
// =============================================================================

function PropertyGroup({
  title,
  properties,
  onPropertyChange,
  defaultExpanded = true,
}: PropertyGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (properties.length === 0) return null;

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium hover:bg-muted/50"
        type="button"
      >
        <span>{title}</span>
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {properties.map((prop) => (
            <PropertyRow
              key={prop.id}
              property={prop}
              onChange={(value) => onPropertyChange(prop.id, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Tab Content Components
// =============================================================================

interface TabContentProps {
  properties: EditableProperty[];
  onPropertyChange: (propertyId: string, value: string) => void;
}

function TextTabContent({ properties, onPropertyChange }: TabContentProps) {
  const textProps = properties.filter(
    (p) => p.type === "text" || p.type === "font"
  );

  const fontProps = textProps.filter((p) =>
    ["font-family", "font-size", "font-weight", "font-style"].includes(
      p.cssProperty || ""
    )
  );
  const alignProps = textProps.filter((p) =>
    ["text-align", "line-height", "letter-spacing"].includes(p.cssProperty || "")
  );
  const otherProps = textProps.filter(
    (p) => !fontProps.includes(p) && !alignProps.includes(p)
  );

  return (
    <div className="divide-y">
      <PropertyGroup
        title="Font"
        properties={fontProps}
        onPropertyChange={onPropertyChange}
      />
      <PropertyGroup
        title="Alignment"
        properties={alignProps}
        onPropertyChange={onPropertyChange}
      />
      {otherProps.length > 0 && (
        <PropertyGroup
          title="Other"
          properties={otherProps}
          onPropertyChange={onPropertyChange}
        />
      )}
      {textProps.length === 0 && (
        <div className="px-3 py-8 text-xs text-center text-muted-foreground">
          No text properties available
        </div>
      )}
    </div>
  );
}

function StyleTabContent({ properties, onPropertyChange }: TabContentProps) {
  const styleProps = properties.filter(
    (p) => p.type === "color" || p.type === "border" || p.type === "shadow"
  );

  const colorProps = styleProps.filter((p) => p.type === "color");
  const borderProps = styleProps.filter((p) => p.type === "border");
  const shadowProps = styleProps.filter((p) => p.type === "shadow");

  return (
    <div className="divide-y">
      <PropertyGroup
        title="Colors"
        properties={colorProps}
        onPropertyChange={onPropertyChange}
      />
      <PropertyGroup
        title="Border"
        properties={borderProps}
        onPropertyChange={onPropertyChange}
      />
      <PropertyGroup
        title="Shadow"
        properties={shadowProps}
        onPropertyChange={onPropertyChange}
      />
      {styleProps.length === 0 && (
        <div className="px-3 py-8 text-xs text-center text-muted-foreground">
          No style properties available
        </div>
      )}
    </div>
  );
}

function LayoutTabContent({ properties, onPropertyChange }: TabContentProps) {
  const layoutProps = properties.filter(
    (p) => p.type === "size" || p.type === "spacing" || p.type === "visibility"
  );

  const sizeProps = layoutProps.filter((p) => p.type === "size");
  const spacingProps = layoutProps.filter((p) => p.type === "spacing");
  const displayProps = layoutProps.filter((p) => p.type === "visibility");

  return (
    <div className="divide-y">
      <PropertyGroup
        title="Size"
        properties={sizeProps}
        onPropertyChange={onPropertyChange}
      />
      <PropertyGroup
        title="Spacing"
        properties={spacingProps}
        onPropertyChange={onPropertyChange}
      />
      <PropertyGroup
        title="Display"
        properties={displayProps}
        onPropertyChange={onPropertyChange}
      />
      {layoutProps.length === 0 && (
        <div className="px-3 py-8 text-xs text-center text-muted-foreground">
          No layout properties available
        </div>
      )}
    </div>
  );
}

function AdvancedTabContent({ properties, onPropertyChange }: TabContentProps) {
  const advancedProps = properties.filter(
    (p) => p.type === "class" || p.type === "attribute" || p.type === "style"
  );

  const classProps = advancedProps.filter((p) => p.type === "class");
  const attrProps = advancedProps.filter((p) => p.type === "attribute");
  const styleProps = advancedProps.filter((p) => p.type === "style");

  return (
    <div className="divide-y">
      <PropertyGroup
        title="Classes"
        properties={classProps}
        onPropertyChange={onPropertyChange}
      />
      <PropertyGroup
        title="Attributes"
        properties={attrProps}
        onPropertyChange={onPropertyChange}
      />
      <PropertyGroup
        title="Inline Styles"
        properties={styleProps}
        onPropertyChange={onPropertyChange}
      />
      {advancedProps.length === 0 && (
        <div className="px-3 py-8 text-xs text-center text-muted-foreground">
          No advanced properties available
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * PropertyPanel - Tabbed property editor for visual editing
 *
 * Feature #18: Visual Edit Mode - Property editing panel
 *
 * @example
 * ```tsx
 * <PropertyPanel
 *   selection={selectedElement}
 *   onPropertyChange={(propId, value) => editor.setProperty(propId, value)}
 *   onApply={() => editor.applyPendingEdits()}
 * />
 * ```
 */
export function PropertyPanel({
  selection,
  onPropertyChange,
  onApply,
  onDiscard,
  className,
}: PropertyPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("text");
  const visualEditor = getVisualEditor();

  const handlePropertyChange = useCallback(
    (propertyId: string, value: string) => {
      visualEditor.setProperty(propertyId, value);
      onPropertyChange?.(propertyId, value);
    },
    [visualEditor, onPropertyChange]
  );

  const pendingCount = visualEditor.getPendingEditCount();

  // No selection state
  if (!selection) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-6 text-center",
          className
        )}
      >
        <Layout className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No element selected</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Click an element in the preview to edit its properties
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="truncate">
            <span className="text-xs font-medium">
              &lt;{selection.element.tagName}&gt;
            </span>
            {selection.element.attributes["class"] && (
              <span className="text-xs text-muted-foreground ml-1 truncate">
                .{selection.element.attributes["class"].split(" ")[0]}
              </span>
            )}
          </div>
          {pendingCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
          {selection.element.file}:{selection.element.range.start.line}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabId)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid grid-cols-4 h-9 mx-2 mt-2">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="text-xs gap-1 data-[state=active]:bg-background"
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto mt-2">
          <TabsContent value="text" className="m-0">
            <TextTabContent
              properties={selection.properties}
              onPropertyChange={handlePropertyChange}
            />
          </TabsContent>

          <TabsContent value="style" className="m-0">
            <StyleTabContent
              properties={selection.properties}
              onPropertyChange={handlePropertyChange}
            />
          </TabsContent>

          <TabsContent value="layout" className="m-0">
            <LayoutTabContent
              properties={selection.properties}
              onPropertyChange={handlePropertyChange}
            />
          </TabsContent>

          <TabsContent value="advanced" className="m-0">
            <AdvancedTabContent
              properties={selection.properties}
              onPropertyChange={handlePropertyChange}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Action buttons */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 p-2 border-t bg-muted/30">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={onDiscard}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Discard
          </Button>
          <Button size="sm" className="flex-1 h-8 text-xs" onClick={onApply}>
            Apply Changes
          </Button>
        </div>
      )}
    </div>
  );
}

export default PropertyPanel;

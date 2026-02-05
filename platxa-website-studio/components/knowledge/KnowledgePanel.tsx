"use client";

import { useState, useCallback, useEffect } from "react";
import {
  BookOpen,
  Palette,
  Code2,
  Users,
  Shield,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  ProjectKnowledge,
  Guidelines,
  BrandAssets,
  CodingConventions,
  Personas,
  Security,
  Persona,
  BrandColor,
} from "@/lib/knowledge/schema";
import { validateProjectKnowledge, createEmptyProjectKnowledge } from "@/lib/knowledge/schema";

// =============================================================================
// Types
// =============================================================================

interface KnowledgePanelProps {
  /** Current project knowledge */
  knowledge: ProjectKnowledge | null;
  /** Called when knowledge changes */
  onChange: (knowledge: ProjectKnowledge) => void;
  /** Called when save is requested */
  onSave?: (knowledge: ProjectKnowledge) => Promise<void>;
  /** Project ID for new knowledge */
  projectId: string;
  /** Whether the panel is read-only */
  readOnly?: boolean;
  /** Additional class name */
  className?: string;
}

type KnowledgeSection = "guidelines" | "brandAssets" | "codingConventions" | "personas" | "security";

interface SectionConfig {
  id: KnowledgeSection;
  label: string;
  icon: React.ElementType;
  description: string;
}

// =============================================================================
// Constants
// =============================================================================

const SECTIONS: SectionConfig[] = [
  {
    id: "guidelines",
    label: "Guidelines",
    icon: BookOpen,
    description: "Design philosophy, content tone, dos and don'ts",
  },
  {
    id: "brandAssets",
    label: "Brand Assets",
    icon: Palette,
    description: "Logos, colors, typography, visual identity",
  },
  {
    id: "codingConventions",
    label: "Code Conventions",
    icon: Code2,
    description: "Naming, style, framework-specific rules",
  },
  {
    id: "personas",
    label: "Personas",
    icon: Users,
    description: "User personas and target audience",
  },
  {
    id: "security",
    label: "Security",
    icon: Shield,
    description: "Auth, data handling, security policies",
  },
];

// =============================================================================
// Field Components
// =============================================================================

interface TextFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  readOnly?: boolean;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  readOnly,
}: TextFieldProps) {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  if (multiline) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <textarea
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={readOnly}
          className={cn(
            "w-full min-h-[80px] px-3 py-2 text-sm rounded-md border",
            "bg-background resize-y",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            readOnly && "opacity-60 cursor-not-allowed"
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={readOnly}
      />
    </div>
  );
}

interface ArrayFieldProps {
  label: string;
  values: string[] | undefined;
  onChange: (values: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
}

function ArrayField({
  label,
  values = [],
  onChange,
  placeholder,
  readOnly,
}: ArrayFieldProps) {
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (newItem.trim()) {
      onChange([...values, newItem.trim()]);
      setNewItem("");
    }
  };

  const handleRemove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="space-y-1">
        {values.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="flex-1 text-sm px-2 py-1 bg-muted rounded">
              {item}
            </span>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleRemove(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Add item..."}
            className="h-8"
          />
          <Button size="sm" onClick={handleAdd} disabled={!newItem.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Section Editors
// =============================================================================

interface GuidelinesSectionProps {
  guidelines: Guidelines | undefined;
  onChange: (guidelines: Guidelines) => void;
  readOnly?: boolean;
}

function GuidelinesSection({ guidelines = {}, onChange, readOnly }: GuidelinesSectionProps) {
  const update = (key: keyof Guidelines, value: unknown) => {
    onChange({ ...guidelines, [key]: value });
  };

  return (
    <div className="space-y-4">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronDown className="h-4 w-4" />
          Design Guidelines
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          <TextField
            label="Philosophy"
            value={guidelines.design?.philosophy}
            onChange={(v) => update("design", { ...guidelines.design, philosophy: v })}
            placeholder="e.g., Minimal and clean, user-focused..."
            multiline
            readOnly={readOnly}
          />
          <TextField
            label="Visual Style"
            value={guidelines.design?.visualStyle}
            onChange={(v) => update("design", { ...guidelines.design, visualStyle: v })}
            placeholder="e.g., Modern, playful, corporate..."
            readOnly={readOnly}
          />
          <TextField
            label="Motion Guidelines"
            value={guidelines.design?.motionGuidelines}
            onChange={(v) => update("design", { ...guidelines.design, motionGuidelines: v })}
            placeholder="e.g., Subtle animations, 200ms duration..."
            readOnly={readOnly}
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronDown className="h-4 w-4" />
          Content Guidelines
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          <TextField
            label="Tone"
            value={guidelines.content?.tone}
            onChange={(v) => update("content", { ...guidelines.content, tone: v })}
            placeholder="e.g., Friendly, professional, casual..."
            readOnly={readOnly}
          />
          <TextField
            label="Voice"
            value={guidelines.content?.voice}
            onChange={(v) => update("content", { ...guidelines.content, voice: v })}
            placeholder="e.g., We speak as a trusted advisor..."
            multiline
            readOnly={readOnly}
          />
          <ArrayField
            label="Preferred Terms"
            values={guidelines.content?.preferredTerms}
            onChange={(v) => update("content", { ...guidelines.content, preferredTerms: v })}
            placeholder="Add preferred term..."
            readOnly={readOnly}
          />
          <ArrayField
            label="Avoided Terms"
            values={guidelines.content?.avoidedTerms}
            onChange={(v) => update("content", { ...guidelines.content, avoidedTerms: v })}
            placeholder="Add term to avoid..."
            readOnly={readOnly}
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronDown className="h-4 w-4" />
          Do's and Don'ts
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          <ArrayField
            label="Do's"
            values={guidelines.dos}
            onChange={(v) => update("dos", v)}
            placeholder="Add a 'do'..."
            readOnly={readOnly}
          />
          <ArrayField
            label="Don'ts"
            values={guidelines.donts}
            onChange={(v) => update("donts", v)}
            placeholder="Add a 'don't'..."
            readOnly={readOnly}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface BrandAssetsSectionProps {
  brandAssets: BrandAssets | undefined;
  onChange: (brandAssets: BrandAssets) => void;
  readOnly?: boolean;
}

function BrandAssetsSection({ brandAssets, onChange, readOnly }: BrandAssetsSectionProps) {
  const assets = brandAssets || { brandName: "" };

  const update = (key: keyof BrandAssets, value: unknown) => {
    onChange({ ...assets, [key]: value });
  };

  const updateColor = (index: number, color: Partial<BrandColor>) => {
    const colors = [...(assets.colors || [])];
    colors[index] = { ...colors[index], ...color };
    update("colors", colors);
  };

  const addColor = () => {
    const colors = [...(assets.colors || [])];
    colors.push({ name: "New Color", hex: "#000000" });
    update("colors", colors);
  };

  const removeColor = (index: number) => {
    const colors = (assets.colors || []).filter((_, i) => i !== index);
    update("colors", colors);
  };

  return (
    <div className="space-y-4">
      <TextField
        label="Brand Name"
        value={assets.brandName}
        onChange={(v) => update("brandName", v)}
        placeholder="Your brand name"
        readOnly={readOnly}
      />
      <TextField
        label="Tagline"
        value={assets.tagline}
        onChange={(v) => update("tagline", v)}
        placeholder="Your brand tagline"
        readOnly={readOnly}
      />

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronDown className="h-4 w-4" />
          Brand Colors
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          {(assets.colors || []).map((color, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border rounded">
              <input
                type="color"
                value={color.hex}
                onChange={(e) => updateColor(index, { hex: e.target.value })}
                disabled={readOnly}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <Input
                value={color.name}
                onChange={(e) => updateColor(index, { name: e.target.value })}
                placeholder="Color name"
                className="flex-1 h-8"
                disabled={readOnly}
              />
              <code className="text-xs bg-muted px-2 py-1 rounded">{color.hex}</code>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeColor(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={addColor}>
              <Plus className="h-4 w-4 mr-1" />
              Add Color
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronRight className="h-4 w-4" />
          Typography
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          <TextField
            label="Heading Font Family"
            value={assets.typography?.headingFamily}
            onChange={(v) => update("typography", { ...assets.typography, headingFamily: v })}
            placeholder="e.g., Inter, Roboto..."
            readOnly={readOnly}
          />
          <TextField
            label="Body Font Family"
            value={assets.typography?.bodyFamily}
            onChange={(v) => update("typography", { ...assets.typography, bodyFamily: v })}
            placeholder="e.g., Inter, Open Sans..."
            readOnly={readOnly}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface CodingConventionsSectionProps {
  conventions: CodingConventions | undefined;
  onChange: (conventions: CodingConventions) => void;
  readOnly?: boolean;
}

function CodingConventionsSection({
  conventions = {},
  onChange,
  readOnly,
}: CodingConventionsSectionProps) {
  const update = (key: keyof CodingConventions, value: unknown) => {
    onChange({ ...conventions, [key]: value });
  };

  return (
    <div className="space-y-4">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronDown className="h-4 w-4" />
          Naming Conventions
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Components"
              value={conventions.naming?.components}
              onChange={(v) =>
                update("naming", { ...conventions.naming, components: v as "PascalCase" })
              }
              placeholder="e.g., PascalCase"
              readOnly={readOnly}
            />
            <TextField
              label="Files"
              value={conventions.naming?.files}
              onChange={(v) =>
                update("naming", { ...conventions.naming, files: v as "kebab-case" })
              }
              placeholder="e.g., kebab-case"
              readOnly={readOnly}
            />
            <TextField
              label="Variables"
              value={conventions.naming?.variables}
              onChange={(v) =>
                update("naming", { ...conventions.naming, variables: v as "camelCase" })
              }
              placeholder="e.g., camelCase"
              readOnly={readOnly}
            />
            <TextField
              label="CSS Classes"
              value={conventions.naming?.cssClasses}
              onChange={(v) => update("naming", { ...conventions.naming, cssClasses: v })}
              placeholder="e.g., BEM, utility-first"
              readOnly={readOnly}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronRight className="h-4 w-4" />
          Code Style
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Indent Size"
              value={conventions.style?.indentSize?.toString()}
              onChange={(v) =>
                update("style", { ...conventions.style, indentSize: parseInt(v) || 2 })
              }
              placeholder="e.g., 2"
              readOnly={readOnly}
            />
            <TextField
              label="Quotes"
              value={conventions.style?.quotes}
              onChange={(v) =>
                update("style", { ...conventions.style, quotes: v as "single" | "double" })
              }
              placeholder="e.g., single"
              readOnly={readOnly}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <TextField
        label="File Organization"
        value={conventions.fileOrganization}
        onChange={(v) => update("fileOrganization", v)}
        placeholder="Describe your file/folder structure..."
        multiline
        readOnly={readOnly}
      />

      <ArrayField
        label="Additional Rules"
        values={conventions.additionalRules}
        onChange={(v) => update("additionalRules", v)}
        placeholder="Add coding rule..."
        readOnly={readOnly}
      />
    </div>
  );
}

interface PersonasSectionProps {
  personas: Personas | undefined;
  onChange: (personas: Personas) => void;
  readOnly?: boolean;
}

function PersonasSection({ personas, onChange, readOnly }: PersonasSectionProps) {
  const data = personas || { personas: [] };

  const updatePersona = (index: number, persona: Partial<Persona>) => {
    const updated = [...data.personas];
    updated[index] = { ...updated[index], ...persona };
    onChange({ ...data, personas: updated });
  };

  const addPersona = () => {
    const newPersona: Persona = {
      id: `persona-${Date.now()}`,
      name: "New Persona",
      description: "",
    };
    onChange({ ...data, personas: [...data.personas, newPersona] });
  };

  const removePersona = (index: number) => {
    onChange({ ...data, personas: data.personas.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <TextField
        label="Target Audience"
        value={data.targetAudience}
        onChange={(v) => onChange({ ...data, targetAudience: v })}
        placeholder="Describe your target audience..."
        multiline
        readOnly={readOnly}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">User Personas</Label>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={addPersona}>
              <Plus className="h-4 w-4 mr-1" />
              Add Persona
            </Button>
          )}
        </div>

        {data.personas.map((persona, index) => (
          <Collapsible key={persona.id} defaultOpen={index === 0}>
            <div className="border rounded-lg">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{persona.name}</span>
                  {persona.priority && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">
                      {persona.priority}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePersona(index);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-3">
                <TextField
                  label="Name"
                  value={persona.name}
                  onChange={(v) => updatePersona(index, { name: v })}
                  readOnly={readOnly}
                />
                <TextField
                  label="Description"
                  value={persona.description}
                  onChange={(v) => updatePersona(index, { description: v })}
                  multiline
                  readOnly={readOnly}
                />
                <ArrayField
                  label="Goals"
                  values={persona.goals}
                  onChange={(v) => updatePersona(index, { goals: v })}
                  placeholder="Add goal..."
                  readOnly={readOnly}
                />
                <ArrayField
                  label="Pain Points"
                  values={persona.painPoints}
                  onChange={(v) => updatePersona(index, { painPoints: v })}
                  placeholder="Add pain point..."
                  readOnly={readOnly}
                />
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

interface SecuritySectionProps {
  security: Security | undefined;
  onChange: (security: Security) => void;
  readOnly?: boolean;
}

function SecuritySection({ security = {}, onChange, readOnly }: SecuritySectionProps) {
  const update = (key: keyof Security, value: unknown) => {
    onChange({ ...security, [key]: value });
  };

  return (
    <div className="space-y-4">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronDown className="h-4 w-4" />
          Authentication
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          <ArrayField
            label="Auth Methods"
            values={security.authentication?.methods as string[] | undefined}
            onChange={(v) =>
              update("authentication", { ...security.authentication, methods: v })
            }
            placeholder="e.g., password, oauth, mfa..."
            readOnly={readOnly}
          />
          <TextField
            label="Session Timeout (minutes)"
            value={security.authentication?.session?.timeout?.toString()}
            onChange={(v) =>
              update("authentication", {
                ...security.authentication,
                session: { ...security.authentication?.session, timeout: parseInt(v) || 30 },
              })
            }
            placeholder="e.g., 30"
            readOnly={readOnly}
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronRight className="h-4 w-4" />
          Data Handling
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          <TextField
            label="PII Handling"
            value={security.dataHandling?.piiHandling}
            onChange={(v) =>
              update("dataHandling", { ...security.dataHandling, piiHandling: v })
            }
            placeholder="Describe PII handling policy..."
            multiline
            readOnly={readOnly}
          />
          <TextField
            label="Retention Policy"
            value={security.dataHandling?.retentionPolicy}
            onChange={(v) =>
              update("dataHandling", { ...security.dataHandling, retentionPolicy: v })
            }
            placeholder="Describe data retention policy..."
            multiline
            readOnly={readOnly}
          />
          <ArrayField
            label="Compliance Standards"
            values={security.dataHandling?.complianceStandards}
            onChange={(v) =>
              update("dataHandling", { ...security.dataHandling, complianceStandards: v })
            }
            placeholder="e.g., GDPR, SOC2, HIPAA..."
            readOnly={readOnly}
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
          <ChevronRight className="h-4 w-4" />
          Input Validation
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pl-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            {["xssPrevention", "csrfProtection", "sqlInjectionPrevention"].map((key) => {
              const isEnabled = security.inputValidation?.[key as keyof typeof security.inputValidation];
              return (
                <Button
                  key={key}
                  variant={isEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    !readOnly &&
                    update("inputValidation", {
                      ...security.inputValidation,
                      [key]: !isEnabled,
                    })
                  }
                  disabled={readOnly}
                >
                  {isEnabled && <Check className="h-3 w-3 mr-1" />}
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </Button>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ArrayField
        label="Security Notes"
        values={security.notes}
        onChange={(v) => update("notes", v)}
        placeholder="Add security note..."
        readOnly={readOnly}
      />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * KnowledgePanel - UI for viewing and editing project knowledge
 *
 * Feature #31: Custom Knowledge Panel
 *
 * @example
 * ```tsx
 * <KnowledgePanel
 *   knowledge={projectKnowledge}
 *   onChange={setProjectKnowledge}
 *   onSave={saveKnowledge}
 *   projectId="my-project"
 * />
 * ```
 */
export function KnowledgePanel({
  knowledge,
  onChange,
  onSave,
  projectId,
  readOnly = false,
  className,
}: KnowledgePanelProps) {
  const [activeTab, setActiveTab] = useState<KnowledgeSection>("guidelines");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Initialize knowledge if null
  const currentKnowledge = knowledge || createEmptyProjectKnowledge(projectId);

  // Validate on change
  useEffect(() => {
    const result = validateProjectKnowledge(currentKnowledge);
    if (!result.success && result.errors) {
      setValidationErrors(result.errors.errors.map((e) => e.message));
    } else {
      setValidationErrors([]);
    }
  }, [currentKnowledge]);

  // Handle section updates
  const updateSection = useCallback(
    <K extends KnowledgeSection>(section: K, value: ProjectKnowledge[K]) => {
      const updated = {
        ...currentKnowledge,
        [section]: value,
        updatedAt: new Date().toISOString(),
      };
      onChange(updated);
    },
    [currentKnowledge, onChange]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave || readOnly) return;

    setIsSaving(true);
    setSaveStatus("idle");

    try {
      await onSave(currentKnowledge);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  }, [onSave, currentKnowledge, readOnly]);

  const renderSectionContent = () => {
    switch (activeTab) {
      case "guidelines":
        return (
          <GuidelinesSection
            guidelines={currentKnowledge.guidelines}
            onChange={(v) => updateSection("guidelines", v)}
            readOnly={readOnly}
          />
        );
      case "brandAssets":
        return (
          <BrandAssetsSection
            brandAssets={currentKnowledge.brandAssets}
            onChange={(v) => updateSection("brandAssets", v)}
            readOnly={readOnly}
          />
        );
      case "codingConventions":
        return (
          <CodingConventionsSection
            conventions={currentKnowledge.codingConventions}
            onChange={(v) => updateSection("codingConventions", v)}
            readOnly={readOnly}
          />
        );
      case "personas":
        return (
          <PersonasSection
            personas={currentKnowledge.personas}
            onChange={(v) => updateSection("personas", v)}
            readOnly={readOnly}
          />
        );
      case "security":
        return (
          <SecuritySection
            security={currentKnowledge.security}
            onChange={(v) => updateSection("security", v)}
            readOnly={readOnly}
          />
        );
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h2 className="font-semibold">Project Knowledge</h2>
          <p className="text-xs text-muted-foreground">
            Configure AI generation context
          </p>
        </div>
        {onSave && !readOnly && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || validationErrors.length > 0}
          >
            {isSaving ? (
              "Saving..."
            ) : saveStatus === "success" ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save
              </>
            )}
          </Button>
        )}
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="px-4 py-2 bg-destructive/10 border-b">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>{validationErrors.length} validation error(s)</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as KnowledgeSection)}
        className="flex-1 flex flex-col"
      >
        <TabsList className="grid grid-cols-5 mx-4 mt-3">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="flex-col gap-1 py-2"
                title={section.description}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{section.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {SECTIONS.map((section) => (
              <TabsContent key={section.id} value={section.id} className="mt-0">
                {renderSectionContent()}
              </TabsContent>
            ))}
          </div>
        </ScrollArea>
      </Tabs>

      {/* Footer */}
      <div className="px-4 py-2 border-t text-xs text-muted-foreground">
        Last updated: {currentKnowledge.updatedAt
          ? new Date(currentKnowledge.updatedAt).toLocaleString()
          : "Never"}
      </div>
    </div>
  );
}

export default KnowledgePanel;

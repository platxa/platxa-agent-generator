"use client";

/**
 * CodingConventionsEditor Component
 *
 * Editor for managing coding conventions with presets and custom rules.
 * Supports language-specific conventions, naming patterns, and file organization.
 *
 * Features:
 * - Preset configurations (Odoo, Standard, Airbnb, Google)
 * - Language-specific convention sections
 * - Naming pattern rules (camelCase, snake_case, etc.)
 * - File organization rules
 * - Custom text area for additional rules
 * - Import/export conventions as JSON
 * - Validation and linting hints
 *
 * Feature #33: Custom Knowledge - Coding conventions editor
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  FileCode2,
  Settings2,
  FileText,
  FolderTree,
  Tag,
  Download,
  Upload,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  AlertCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

/** Supported languages */
export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp"
  | "php"
  | "ruby"
  | "xml";

/** Naming convention styles */
export type NamingStyle =
  | "camelCase"
  | "PascalCase"
  | "snake_case"
  | "SCREAMING_SNAKE_CASE"
  | "kebab-case"
  | "flatcase";

/** Naming rule for specific element types */
export interface NamingRule {
  /** Element type (function, class, variable, etc.) */
  elementType: string;
  /** Required naming style */
  style: NamingStyle;
  /** Optional prefix */
  prefix?: string;
  /** Optional suffix */
  suffix?: string;
  /** Regex pattern for validation */
  pattern?: string;
  /** Example of valid name */
  example?: string;
}

/** File organization rule */
export interface FileOrganizationRule {
  /** Pattern or glob for file types */
  filePattern: string;
  /** Target directory */
  directory: string;
  /** Description of the rule */
  description: string;
  /** Whether subdirectories are allowed */
  allowSubdirectories?: boolean;
}

/** Language-specific conventions */
export interface LanguageConventions {
  /** Target language */
  language: Language;
  /** Whether this language section is enabled */
  enabled: boolean;
  /** Naming rules for this language */
  namingRules: NamingRule[];
  /** Import ordering preferences */
  importOrder?: string[];
  /** Maximum line length */
  maxLineLength?: number;
  /** Indentation style */
  indentation: "tabs" | "spaces";
  /** Indentation size (for spaces) */
  indentSize: number;
  /** Quote style preference */
  quoteStyle?: "single" | "double";
  /** Semicolon preference */
  semicolons?: boolean;
  /** Trailing comma preference */
  trailingComma?: "none" | "es5" | "all";
  /** Additional language-specific rules as text */
  customRules?: string;
}

/** Complete conventions configuration */
export interface ConventionsConfig {
  /** Configuration name */
  name: string;
  /** Configuration version */
  version: string;
  /** Base preset used */
  preset: ConventionPreset;
  /** Language-specific conventions */
  languages: LanguageConventions[];
  /** Global naming rules */
  globalNamingRules: NamingRule[];
  /** File organization rules */
  fileOrganization: FileOrganizationRule[];
  /** Custom conventions text (freeform) */
  customConventions: string;
  /** Last modified timestamp */
  lastModified: number;
}

/** Available presets */
export type ConventionPreset = "odoo" | "standard" | "airbnb" | "google" | "custom";

/** Preset metadata */
export interface PresetInfo {
  id: ConventionPreset;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  languages: Language[];
}

/** Editor props */
export interface CodingConventionsEditorProps {
  /** Initial configuration */
  initialConfig?: ConventionsConfig;
  /** Callback when configuration changes */
  onChange?: (config: ConventionsConfig) => void;
  /** Callback when saving */
  onSave?: (config: ConventionsConfig) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Constants & Presets
// =============================================================================

/** Available presets */
export const PRESETS: PresetInfo[] = [
  {
    id: "odoo",
    name: "Odoo",
    description: "Odoo framework conventions with Python and XML standards",
    icon: FileCode2,
    languages: ["python", "xml", "javascript"],
  },
  {
    id: "standard",
    name: "Standard",
    description: "Common industry standards for web development",
    icon: FileText,
    languages: ["typescript", "javascript", "python"],
  },
  {
    id: "airbnb",
    name: "Airbnb",
    description: "Airbnb JavaScript/React style guide",
    icon: Settings2,
    languages: ["typescript", "javascript"],
  },
  {
    id: "google",
    name: "Google",
    description: "Google style guides for multiple languages",
    icon: Tag,
    languages: ["typescript", "javascript", "python", "java", "go"],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Start from scratch with custom conventions",
    icon: Settings2,
    languages: [],
  },
];

/** Default naming rules for Odoo preset */
const ODOO_NAMING_RULES: NamingRule[] = [
  { elementType: "model", style: "snake_case", prefix: "", example: "sale_order" },
  { elementType: "field", style: "snake_case", example: "partner_id" },
  { elementType: "method", style: "snake_case", example: "action_confirm" },
  { elementType: "compute_method", style: "snake_case", prefix: "_compute_", example: "_compute_amount" },
  { elementType: "onchange_method", style: "snake_case", prefix: "_onchange_", example: "_onchange_partner" },
  { elementType: "constraint_method", style: "snake_case", prefix: "_check_", example: "_check_dates" },
  { elementType: "xml_id", style: "snake_case", example: "view_order_form" },
  { elementType: "template", style: "snake_case", example: "portal_my_orders" },
];

/** Default naming rules for Standard preset */
const STANDARD_NAMING_RULES: NamingRule[] = [
  { elementType: "class", style: "PascalCase", example: "UserService" },
  { elementType: "interface", style: "PascalCase", prefix: "I", example: "IUserRepository" },
  { elementType: "type", style: "PascalCase", example: "UserResponse" },
  { elementType: "function", style: "camelCase", example: "getUserById" },
  { elementType: "variable", style: "camelCase", example: "userName" },
  { elementType: "constant", style: "SCREAMING_SNAKE_CASE", example: "MAX_RETRIES" },
  { elementType: "enum", style: "PascalCase", example: "UserStatus" },
  { elementType: "enum_member", style: "SCREAMING_SNAKE_CASE", example: "ACTIVE" },
];

/** Default file organization for Odoo */
const ODOO_FILE_ORGANIZATION: FileOrganizationRule[] = [
  { filePattern: "*.py", directory: "models/", description: "Python model files" },
  { filePattern: "*_controller.py", directory: "controllers/", description: "HTTP controllers" },
  { filePattern: "*_wizard.py", directory: "wizard/", description: "Transient model wizards" },
  { filePattern: "*.xml", directory: "views/", description: "View definitions" },
  { filePattern: "*_data.xml", directory: "data/", description: "Master data files" },
  { filePattern: "*_demo.xml", directory: "demo/", description: "Demo data files" },
  { filePattern: "ir.model.access.csv", directory: "security/", description: "Access control" },
  { filePattern: "*_security.xml", directory: "security/", description: "Record rules" },
  { filePattern: "*.js", directory: "static/src/js/", description: "JavaScript files" },
  { filePattern: "*.scss", directory: "static/src/scss/", description: "SCSS styles" },
];

/** Default file organization for Standard */
const STANDARD_FILE_ORGANIZATION: FileOrganizationRule[] = [
  { filePattern: "*.tsx", directory: "components/", description: "React components", allowSubdirectories: true },
  { filePattern: "*.ts", directory: "lib/", description: "Utility libraries", allowSubdirectories: true },
  { filePattern: "*.test.ts", directory: "__tests__/", description: "Test files" },
  { filePattern: "*.hook.ts", directory: "hooks/", description: "React hooks" },
  { filePattern: "*.store.ts", directory: "stores/", description: "State stores" },
  { filePattern: "*.type.ts", directory: "types/", description: "Type definitions" },
  { filePattern: "*.api.ts", directory: "api/", description: "API handlers" },
];

/** Create default language conventions */
function createLanguageConventions(language: Language, preset: ConventionPreset): LanguageConventions {
  const base: LanguageConventions = {
    language,
    enabled: true,
    namingRules: [],
    indentation: "spaces",
    indentSize: 2,
  };

  switch (language) {
    case "python":
      return {
        ...base,
        indentSize: 4,
        maxLineLength: preset === "odoo" ? 120 : 88,
        quoteStyle: "double",
        namingRules: preset === "odoo" ? ODOO_NAMING_RULES.filter(r =>
          ["model", "field", "method", "compute_method", "onchange_method", "constraint_method"].includes(r.elementType)
        ) : [
          { elementType: "class", style: "PascalCase", example: "MyClass" },
          { elementType: "function", style: "snake_case", example: "my_function" },
          { elementType: "variable", style: "snake_case", example: "my_variable" },
          { elementType: "constant", style: "SCREAMING_SNAKE_CASE", example: "MY_CONSTANT" },
        ],
        importOrder: preset === "odoo"
          ? ["odoo", "odoo.addons", "third_party", "local"]
          : ["stdlib", "third_party", "local"],
      };

    case "typescript":
    case "javascript":
      return {
        ...base,
        quoteStyle: preset === "airbnb" ? "single" : "double",
        semicolons: preset !== "standard",
        trailingComma: preset === "airbnb" ? "all" : "es5",
        maxLineLength: 100,
        namingRules: STANDARD_NAMING_RULES,
        importOrder: ["react", "next", "third_party", "@/", "./"],
      };

    case "xml":
      return {
        ...base,
        indentSize: 4,
        namingRules: preset === "odoo" ? ODOO_NAMING_RULES.filter(r =>
          ["xml_id", "template"].includes(r.elementType)
        ) : [],
      };

    case "go":
      return {
        ...base,
        indentation: "tabs",
        indentSize: 4,
        namingRules: [
          { elementType: "exported", style: "PascalCase", example: "PublicFunc" },
          { elementType: "unexported", style: "camelCase", example: "privateFunc" },
          { elementType: "constant", style: "PascalCase", example: "MaxRetries" },
          { elementType: "package", style: "flatcase", example: "mypackage" },
        ],
      };

    default:
      return base;
  }
}

/** Create default config for a preset */
function createPresetConfig(preset: ConventionPreset): ConventionsConfig {
  const presetInfo = PRESETS.find(p => p.id === preset) || PRESETS[0];

  return {
    name: `${presetInfo.name} Conventions`,
    version: "1.0.0",
    preset,
    languages: presetInfo.languages.map(lang => createLanguageConventions(lang, preset)),
    globalNamingRules: preset === "odoo" ? ODOO_NAMING_RULES : STANDARD_NAMING_RULES,
    fileOrganization: preset === "odoo" ? ODOO_FILE_ORGANIZATION : STANDARD_FILE_ORGANIZATION,
    customConventions: "",
    lastModified: Date.now(),
  };
}

// =============================================================================
// Sub-components
// =============================================================================

/** Collapsible section */
interface SectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  badge?: string | number;
}

function Section({ title, icon: Icon, defaultExpanded = true, children, badge }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-medium">{title}</span>
        {badge !== undefined && (
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </button>
      {expanded && <div className="p-4 border-t">{children}</div>}
    </div>
  );
}

/** Naming rule editor row */
interface NamingRuleRowProps {
  rule: NamingRule;
  onChange: (rule: NamingRule) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

function NamingRuleRow({ rule, onChange, onDelete, readOnly }: NamingRuleRowProps) {
  const namingStyles: NamingStyle[] = [
    "camelCase",
    "PascalCase",
    "snake_case",
    "SCREAMING_SNAKE_CASE",
    "kebab-case",
    "flatcase",
  ];

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
      <input
        type="text"
        value={rule.elementType}
        onChange={(e) => onChange({ ...rule, elementType: e.target.value })}
        placeholder="Element type"
        disabled={readOnly}
        className="flex-1 min-w-[120px] px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
      />
      <select
        value={rule.style}
        onChange={(e) => onChange({ ...rule, style: e.target.value as NamingStyle })}
        disabled={readOnly}
        className="px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
      >
        {namingStyles.map((style) => (
          <option key={style} value={style}>
            {style}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={rule.prefix || ""}
        onChange={(e) => onChange({ ...rule, prefix: e.target.value || undefined })}
        placeholder="Prefix"
        disabled={readOnly}
        className="w-20 px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
      />
      <input
        type="text"
        value={rule.example || ""}
        onChange={(e) => onChange({ ...rule, example: e.target.value || undefined })}
        placeholder="Example"
        disabled={readOnly}
        className="w-32 px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
      />
      {!readOnly && (
        <button
          onClick={onDelete}
          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** File organization rule row */
interface FileRuleRowProps {
  rule: FileOrganizationRule;
  onChange: (rule: FileOrganizationRule) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

function FileRuleRow({ rule, onChange, onDelete, readOnly }: FileRuleRowProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
      <input
        type="text"
        value={rule.filePattern}
        onChange={(e) => onChange({ ...rule, filePattern: e.target.value })}
        placeholder="*.tsx"
        disabled={readOnly}
        className="w-32 px-2 py-1 text-sm border rounded bg-background font-mono disabled:opacity-50"
      />
      <span className="text-muted-foreground">→</span>
      <input
        type="text"
        value={rule.directory}
        onChange={(e) => onChange({ ...rule, directory: e.target.value })}
        placeholder="components/"
        disabled={readOnly}
        className="w-40 px-2 py-1 text-sm border rounded bg-background font-mono disabled:opacity-50"
      />
      <input
        type="text"
        value={rule.description}
        onChange={(e) => onChange({ ...rule, description: e.target.value })}
        placeholder="Description"
        disabled={readOnly}
        className="flex-1 px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
      />
      {!readOnly && (
        <button
          onClick={onDelete}
          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Language conventions panel */
interface LanguagePanelProps {
  conventions: LanguageConventions;
  onChange: (conventions: LanguageConventions) => void;
  readOnly?: boolean;
}

function LanguagePanel({ conventions, onChange, readOnly }: LanguagePanelProps) {
  const updateNamingRule = (index: number, rule: NamingRule) => {
    const newRules = [...conventions.namingRules];
    newRules[index] = rule;
    onChange({ ...conventions, namingRules: newRules });
  };

  const deleteNamingRule = (index: number) => {
    onChange({
      ...conventions,
      namingRules: conventions.namingRules.filter((_, i) => i !== index),
    });
  };

  const addNamingRule = () => {
    onChange({
      ...conventions,
      namingRules: [
        ...conventions.namingRules,
        { elementType: "", style: "camelCase", example: "" },
      ],
    });
  };

  return (
    <div className="space-y-4">
      {/* Basic settings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Indentation</label>
          <select
            value={conventions.indentation}
            onChange={(e) =>
              onChange({ ...conventions, indentation: e.target.value as "tabs" | "spaces" })
            }
            disabled={readOnly}
            className="w-full mt-1 px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
          >
            <option value="spaces">Spaces</option>
            <option value="tabs">Tabs</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Indent Size</label>
          <input
            type="number"
            min={1}
            max={8}
            value={conventions.indentSize}
            onChange={(e) =>
              onChange({ ...conventions, indentSize: parseInt(e.target.value) || 2 })
            }
            disabled={readOnly}
            className="w-full mt-1 px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Max Line Length</label>
          <input
            type="number"
            min={40}
            max={200}
            value={conventions.maxLineLength || 100}
            onChange={(e) =>
              onChange({ ...conventions, maxLineLength: parseInt(e.target.value) || 100 })
            }
            disabled={readOnly}
            className="w-full mt-1 px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Quote Style</label>
          <select
            value={conventions.quoteStyle || "double"}
            onChange={(e) =>
              onChange({ ...conventions, quoteStyle: e.target.value as "single" | "double" })
            }
            disabled={readOnly}
            className="w-full mt-1 px-2 py-1 text-sm border rounded bg-background disabled:opacity-50"
          >
            <option value="single">Single</option>
            <option value="double">Double</option>
          </select>
        </div>
      </div>

      {/* Naming rules */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Naming Rules</label>
          {!readOnly && (
            <button
              onClick={addNamingRule}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Add Rule
            </button>
          )}
        </div>
        <div className="space-y-2">
          {conventions.namingRules.map((rule, index) => (
            <NamingRuleRow
              key={index}
              rule={rule}
              onChange={(r) => updateNamingRule(index, r)}
              onDelete={() => deleteNamingRule(index)}
              readOnly={readOnly}
            />
          ))}
          {conventions.namingRules.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No naming rules defined</p>
          )}
        </div>
      </div>

      {/* Custom rules */}
      <div>
        <label className="text-sm font-medium">Additional Rules</label>
        <textarea
          value={conventions.customRules || ""}
          onChange={(e) => onChange({ ...conventions, customRules: e.target.value })}
          placeholder="Add any additional language-specific rules or notes..."
          disabled={readOnly}
          rows={3}
          className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background resize-y disabled:opacity-50"
        />
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CodingConventionsEditor({
  initialConfig,
  onChange,
  onSave,
  readOnly = false,
  className,
}: CodingConventionsEditorProps) {
  // State
  const [config, setConfig] = useState<ConventionsConfig>(
    initialConfig || createPresetConfig("standard")
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<Language | null>(
    config.languages[0]?.language || null
  );

  // Update config helper
  const updateConfig = useCallback(
    (updates: Partial<ConventionsConfig>) => {
      const newConfig = {
        ...config,
        ...updates,
        lastModified: Date.now(),
      };
      setConfig(newConfig);
      setHasChanges(true);
      onChange?.(newConfig);
    },
    [config, onChange]
  );

  // Switch preset
  const switchPreset = useCallback(
    (preset: ConventionPreset) => {
      const newConfig = createPresetConfig(preset);
      setConfig(newConfig);
      setHasChanges(true);
      setActiveLanguage(newConfig.languages[0]?.language || null);
      onChange?.(newConfig);
    },
    [onChange]
  );

  // Export config
  const exportConfig = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [config]);

  // Import config
  const importConfig = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text) as ConventionsConfig;
        setConfig(imported);
        setHasChanges(true);
        setActiveLanguage(imported.languages[0]?.language || null);
        onChange?.(imported);
      } catch {
        console.error("Failed to import config");
      }
    };
    input.click();
  }, [onChange]);

  // Update language conventions
  const updateLanguage = useCallback(
    (language: Language, conventions: LanguageConventions) => {
      const newLanguages = config.languages.map((l) =>
        l.language === language ? conventions : l
      );
      updateConfig({ languages: newLanguages });
    },
    [config.languages, updateConfig]
  );

  // Add file organization rule
  const addFileRule = useCallback(() => {
    updateConfig({
      fileOrganization: [
        ...config.fileOrganization,
        { filePattern: "", directory: "", description: "" },
      ],
    });
  }, [config.fileOrganization, updateConfig]);

  // Update file rule
  const updateFileRule = useCallback(
    (index: number, rule: FileOrganizationRule) => {
      const newRules = [...config.fileOrganization];
      newRules[index] = rule;
      updateConfig({ fileOrganization: newRules });
    },
    [config.fileOrganization, updateConfig]
  );

  // Delete file rule
  const deleteFileRule = useCallback(
    (index: number) => {
      updateConfig({
        fileOrganization: config.fileOrganization.filter((_, i) => i !== index),
      });
    },
    [config.fileOrganization, updateConfig]
  );

  // Active language conventions
  const activeConventions = useMemo(
    () => config.languages.find((l) => l.language === activeLanguage),
    [config.languages, activeLanguage]
  );

  // Available languages to add
  const availableLanguages = useMemo(() => {
    const existing = new Set(config.languages.map((l) => l.language));
    const all: Language[] = [
      "typescript",
      "javascript",
      "python",
      "go",
      "rust",
      "java",
      "csharp",
      "php",
      "ruby",
      "xml",
    ];
    return all.filter((l) => !existing.has(l));
  }, [config.languages]);

  // Add language
  const addLanguage = useCallback(
    (language: Language) => {
      const newConventions = createLanguageConventions(language, config.preset);
      updateConfig({ languages: [...config.languages, newConventions] });
      setActiveLanguage(language);
    },
    [config.languages, config.preset, updateConfig]
  );

  // Remove language
  const removeLanguage = useCallback(
    (language: Language) => {
      const newLanguages = config.languages.filter((l) => l.language !== language);
      updateConfig({ languages: newLanguages });
      if (activeLanguage === language) {
        setActiveLanguage(newLanguages[0]?.language || null);
      }
    },
    [config.languages, activeLanguage, updateConfig]
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <FileCode2 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Coding Conventions</h2>
            <p className="text-xs text-muted-foreground">
              {config.preset !== "custom" ? `Based on ${config.preset}` : "Custom configuration"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={importConfig}
            disabled={readOnly}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Import"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            onClick={exportConfig}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="Export"
          >
            <Download className="h-4 w-4" />
          </button>
          {hasChanges && onSave && !readOnly && (
            <button
              onClick={() => {
                onSave(config);
                setHasChanges(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
            >
              <Check className="h-4 w-4" />
              Save
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Preset selector */}
        <Section title="Preset" icon={Settings2} badge={config.preset}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isActive = config.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => !readOnly && switchPreset(preset.id)}
                  disabled={readOnly}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors",
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                    readOnly && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-sm font-medium", isActive && "text-primary")}>
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {PRESETS.find((p) => p.id === config.preset)?.description}
          </p>
        </Section>

        {/* Language-specific conventions */}
        <Section
          title="Language Conventions"
          icon={FileCode2}
          badge={config.languages.length}
        >
          {/* Language tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {config.languages.map((lang) => (
              <button
                key={lang.language}
                onClick={() => setActiveLanguage(lang.language)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1",
                  activeLanguage === lang.language
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {lang.language}
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLanguage(lang.language);
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </button>
            ))}
            {!readOnly && availableLanguages.length > 0 && (
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addLanguage(e.target.value as Language);
                    e.target.value = "";
                  }
                }}
                className="px-2 py-1.5 text-sm border rounded bg-background"
                defaultValue=""
              >
                <option value="" disabled>
                  + Add language
                </option>
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Active language panel */}
          {activeConventions ? (
            <LanguagePanel
              conventions={activeConventions}
              onChange={(c) => updateLanguage(activeLanguage!, c)}
              readOnly={readOnly}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Select or add a language to configure conventions
            </p>
          )}
        </Section>

        {/* File organization */}
        <Section
          title="File Organization"
          icon={FolderTree}
          badge={config.fileOrganization.length}
        >
          <div className="space-y-2">
            {config.fileOrganization.map((rule, index) => (
              <FileRuleRow
                key={index}
                rule={rule}
                onChange={(r) => updateFileRule(index, r)}
                onDelete={() => deleteFileRule(index)}
                readOnly={readOnly}
              />
            ))}
            {config.fileOrganization.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                No file organization rules defined
              </p>
            )}
          </div>
          {!readOnly && (
            <button
              onClick={addFileRule}
              className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="h-4 w-4" />
              Add Rule
            </button>
          )}
        </Section>

        {/* Custom conventions */}
        <Section title="Custom Conventions" icon={FileText} defaultExpanded={!!config.customConventions}>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Add any additional conventions or rules that aren&apos;t covered by the structured options above.
            </p>
            <textarea
              value={config.customConventions}
              onChange={(e) => updateConfig({ customConventions: e.target.value })}
              placeholder="Example:
- Always use descriptive variable names
- Group related imports together
- Use early returns to reduce nesting
- Document public APIs with JSDoc comments"
              disabled={readOnly}
              rows={8}
              className="w-full px-3 py-2 text-sm border rounded bg-background resize-y font-mono disabled:opacity-50"
            />
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>
          Last modified: {new Date(config.lastModified).toLocaleString()}
        </span>
        <span>v{config.version}</span>
      </div>
    </div>
  );
}

export default CodingConventionsEditor;

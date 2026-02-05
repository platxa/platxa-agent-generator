"use client";

/**
 * ModelConfigPanel Component
 *
 * Settings panel for configuring AI model preferences per task type.
 * Allows users to select which models to use for different operations.
 *
 * Features:
 * - Task type categorization (code generation, chat, analysis, etc.)
 * - Model selection dropdowns per task type
 * - Model capability indicators
 * - Cost/speed tradeoff display
 * - Custom model endpoint configuration
 * - Preset configurations (balanced, fast, quality)
 *
 * Feature #39: Multi-Model Orchestration - Model configuration UI
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  Settings2,
  Cpu,
  Zap,
  Brain,
  DollarSign,
  Clock,
  Sparkles,
  Code2,
  MessageSquare,
  Search,
  FileEdit,
  Bug,
  Lightbulb,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  RotateCcw,
  Save,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

/** Available AI models */
export type ModelId =
  | "claude-3-opus"
  | "claude-3-sonnet"
  | "claude-3-haiku"
  | "gpt-4-turbo"
  | "gpt-4"
  | "gpt-3.5-turbo"
  | "gemini-pro"
  | "gemini-pro-vision"
  | "mistral-large"
  | "mistral-medium"
  | "llama-3-70b"
  | "codellama-34b"
  | "custom";

/** Model provider */
export type ModelProvider = "anthropic" | "openai" | "google" | "mistral" | "meta" | "custom";

/** Task types that can be configured */
export type TaskType =
  | "code-generation"
  | "code-review"
  | "chat"
  | "analysis"
  | "documentation"
  | "debugging"
  | "refactoring"
  | "testing"
  | "planning";

/** Model metadata */
export interface ModelInfo {
  id: ModelId;
  name: string;
  provider: ModelProvider;
  description: string;
  capabilities: string[];
  contextWindow: number;
  costTier: "low" | "medium" | "high";
  speedTier: "fast" | "medium" | "slow";
  qualityTier: "good" | "great" | "excellent";
  supportsVision?: boolean;
  supportsCode?: boolean;
}

/** Task type metadata */
export interface TaskTypeInfo {
  id: TaskType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  recommendedModels: ModelId[];
  defaultModel: ModelId;
}

/** Model configuration for a task */
export interface TaskModelConfig {
  taskType: TaskType;
  primaryModel: ModelId;
  fallbackModel?: ModelId;
  customEndpoint?: string;
  maxTokens?: number;
  temperature?: number;
}

/** Full configuration */
export interface ModelConfig {
  preset: "balanced" | "fast" | "quality" | "custom";
  tasks: TaskModelConfig[];
  globalSettings: {
    defaultTemperature: number;
    defaultMaxTokens: number;
    enableFallback: boolean;
    rateLimitRetries: number;
  };
  customEndpoints: {
    name: string;
    url: string;
    apiKeyEnvVar: string;
  }[];
}

/** Component props */
export interface ModelConfigPanelProps {
  initialConfig?: ModelConfig;
  onChange?: (config: ModelConfig) => void;
  onSave?: (config: ModelConfig) => void;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Available models */
export const MODELS: ModelInfo[] = [
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    provider: "anthropic",
    description: "Most capable Claude model for complex tasks",
    capabilities: ["reasoning", "analysis", "code", "vision", "writing"],
    contextWindow: 200000,
    costTier: "high",
    speedTier: "slow",
    qualityTier: "excellent",
    supportsVision: true,
    supportsCode: true,
  },
  {
    id: "claude-3-sonnet",
    name: "Claude 3 Sonnet",
    provider: "anthropic",
    description: "Balanced performance and cost",
    capabilities: ["reasoning", "code", "vision", "writing"],
    contextWindow: 200000,
    costTier: "medium",
    speedTier: "medium",
    qualityTier: "great",
    supportsVision: true,
    supportsCode: true,
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    description: "Fast and efficient for simple tasks",
    capabilities: ["code", "writing"],
    contextWindow: 200000,
    costTier: "low",
    speedTier: "fast",
    qualityTier: "good",
    supportsCode: true,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "openai",
    description: "Latest GPT-4 with improved speed",
    capabilities: ["reasoning", "code", "vision", "writing"],
    contextWindow: 128000,
    costTier: "high",
    speedTier: "medium",
    qualityTier: "excellent",
    supportsVision: true,
    supportsCode: true,
  },
  {
    id: "gpt-4",
    name: "GPT-4",
    provider: "openai",
    description: "Powerful reasoning and code generation",
    capabilities: ["reasoning", "code", "writing"],
    contextWindow: 8192,
    costTier: "high",
    speedTier: "slow",
    qualityTier: "excellent",
    supportsCode: true,
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    provider: "openai",
    description: "Fast and cost-effective",
    capabilities: ["code", "writing"],
    contextWindow: 16385,
    costTier: "low",
    speedTier: "fast",
    qualityTier: "good",
    supportsCode: true,
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    provider: "google",
    description: "Google's advanced multimodal model",
    capabilities: ["reasoning", "code", "writing"],
    contextWindow: 32000,
    costTier: "medium",
    speedTier: "medium",
    qualityTier: "great",
    supportsCode: true,
  },
  {
    id: "gemini-pro-vision",
    name: "Gemini Pro Vision",
    provider: "google",
    description: "Multimodal with image understanding",
    capabilities: ["vision", "reasoning"],
    contextWindow: 32000,
    costTier: "medium",
    speedTier: "medium",
    qualityTier: "great",
    supportsVision: true,
  },
  {
    id: "mistral-large",
    name: "Mistral Large",
    provider: "mistral",
    description: "Mistral's flagship model",
    capabilities: ["reasoning", "code", "writing"],
    contextWindow: 32000,
    costTier: "medium",
    speedTier: "medium",
    qualityTier: "great",
    supportsCode: true,
  },
  {
    id: "mistral-medium",
    name: "Mistral Medium",
    provider: "mistral",
    description: "Balanced Mistral model",
    capabilities: ["code", "writing"],
    contextWindow: 32000,
    costTier: "low",
    speedTier: "fast",
    qualityTier: "good",
    supportsCode: true,
  },
  {
    id: "llama-3-70b",
    name: "Llama 3 70B",
    provider: "meta",
    description: "Meta's open-source large model",
    capabilities: ["reasoning", "code", "writing"],
    contextWindow: 8192,
    costTier: "low",
    speedTier: "medium",
    qualityTier: "great",
    supportsCode: true,
  },
  {
    id: "codellama-34b",
    name: "Code Llama 34B",
    provider: "meta",
    description: "Specialized for code tasks",
    capabilities: ["code"],
    contextWindow: 16384,
    costTier: "low",
    speedTier: "fast",
    qualityTier: "great",
    supportsCode: true,
  },
];

/** Task type definitions */
export const TASK_TYPES: TaskTypeInfo[] = [
  {
    id: "code-generation",
    name: "Code Generation",
    description: "Generate new code from descriptions",
    icon: Code2,
    recommendedModels: ["claude-3-opus", "gpt-4-turbo", "claude-3-sonnet"],
    defaultModel: "claude-3-sonnet",
  },
  {
    id: "code-review",
    name: "Code Review",
    description: "Review and suggest improvements",
    icon: Search,
    recommendedModels: ["claude-3-opus", "gpt-4-turbo", "claude-3-sonnet"],
    defaultModel: "claude-3-sonnet",
  },
  {
    id: "chat",
    name: "Chat / Q&A",
    description: "General conversation and questions",
    icon: MessageSquare,
    recommendedModels: ["claude-3-haiku", "gpt-3.5-turbo", "mistral-medium"],
    defaultModel: "claude-3-haiku",
  },
  {
    id: "analysis",
    name: "Code Analysis",
    description: "Deep analysis of code structure",
    icon: Brain,
    recommendedModels: ["claude-3-opus", "gpt-4-turbo", "gemini-pro"],
    defaultModel: "claude-3-sonnet",
  },
  {
    id: "documentation",
    name: "Documentation",
    description: "Generate docs and comments",
    icon: FileEdit,
    recommendedModels: ["claude-3-sonnet", "gpt-4-turbo", "mistral-large"],
    defaultModel: "claude-3-haiku",
  },
  {
    id: "debugging",
    name: "Debugging",
    description: "Find and fix bugs",
    icon: Bug,
    recommendedModels: ["claude-3-opus", "gpt-4-turbo", "claude-3-sonnet"],
    defaultModel: "claude-3-sonnet",
  },
  {
    id: "refactoring",
    name: "Refactoring",
    description: "Improve code structure",
    icon: Sparkles,
    recommendedModels: ["claude-3-opus", "gpt-4", "claude-3-sonnet"],
    defaultModel: "claude-3-sonnet",
  },
  {
    id: "testing",
    name: "Test Generation",
    description: "Create unit and integration tests",
    icon: Check,
    recommendedModels: ["claude-3-sonnet", "gpt-4-turbo", "codellama-34b"],
    defaultModel: "claude-3-sonnet",
  },
  {
    id: "planning",
    name: "Planning",
    description: "Architecture and implementation planning",
    icon: Lightbulb,
    recommendedModels: ["claude-3-opus", "gpt-4-turbo", "gemini-pro"],
    defaultModel: "claude-3-opus",
  },
];

/** Preset configurations */
const PRESETS: Record<"balanced" | "fast" | "quality", Partial<TaskModelConfig>[]> = {
  balanced: TASK_TYPES.map((t) => ({ taskType: t.id, primaryModel: t.defaultModel })),
  fast: TASK_TYPES.map((t) => ({
    taskType: t.id,
    primaryModel: "claude-3-haiku" as ModelId,
  })),
  quality: TASK_TYPES.map((t) => ({
    taskType: t.id,
    primaryModel: "claude-3-opus" as ModelId,
  })),
};

/** Create default config */
function createDefaultConfig(): ModelConfig {
  return {
    preset: "balanced",
    tasks: TASK_TYPES.map((t) => ({
      taskType: t.id,
      primaryModel: t.defaultModel,
    })),
    globalSettings: {
      defaultTemperature: 0.7,
      defaultMaxTokens: 4096,
      enableFallback: true,
      rateLimitRetries: 3,
    },
    customEndpoints: [],
  };
}

/** Get model info by ID */
function getModelInfo(id: ModelId): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

/** Get task info by ID */
function getTaskInfo(id: TaskType): TaskTypeInfo | undefined {
  return TASK_TYPES.find((t) => t.id === id);
}

// =============================================================================
// Sub-components
// =============================================================================

/** Tier badge display */
interface TierBadgeProps {
  type: "cost" | "speed" | "quality";
  value: string;
}

function TierBadge({ type, value }: TierBadgeProps) {
  const colors = {
    cost: {
      low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    speed: {
      fast: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      slow: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    quality: {
      good: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      great: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      excellent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
  };

  const icons = {
    cost: DollarSign,
    speed: Clock,
    quality: Sparkles,
  };

  const Icon = icons[type];
  const colorClass = colors[type][value as keyof (typeof colors)[typeof type]] || "bg-muted";

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs", colorClass)}>
      <Icon className="h-3 w-3" />
      {value}
    </span>
  );
}

/** Model selector dropdown */
interface ModelSelectorProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
  recommended?: ModelId[];
  disabled?: boolean;
}

function ModelSelector({ value, onChange, recommended = [], disabled }: ModelSelectorProps) {
  const selectedModel = getModelInfo(value);

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ModelId)}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm border rounded bg-background disabled:opacity-50"
      >
        {recommended.length > 0 && (
          <optgroup label="Recommended">
            {recommended.map((id) => {
              const model = getModelInfo(id);
              return model ? (
                <option key={id} value={id}>
                  {model.name} ({model.provider})
                </option>
              ) : null;
            })}
          </optgroup>
        )}
        <optgroup label="All Models">
          {MODELS.filter((m) => !recommended.includes(m.id)).map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.provider})
            </option>
          ))}
        </optgroup>
      </select>

      {selectedModel && (
        <div className="flex flex-wrap gap-2">
          <TierBadge type="cost" value={selectedModel.costTier} />
          <TierBadge type="speed" value={selectedModel.speedTier} />
          <TierBadge type="quality" value={selectedModel.qualityTier} />
        </div>
      )}
    </div>
  );
}

/** Task configuration row */
interface TaskConfigRowProps {
  taskType: TaskType;
  config: TaskModelConfig;
  onChange: (config: TaskModelConfig) => void;
  expanded: boolean;
  onToggle: () => void;
}

function TaskConfigRow({ taskType, config, onChange, expanded, onToggle }: TaskConfigRowProps) {
  const taskInfo = getTaskInfo(taskType);
  if (!taskInfo) return null;

  const Icon = taskInfo.icon;
  const selectedModel = getModelInfo(config.primaryModel);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className="h-5 w-5 text-primary" />
        <div className="flex-1 text-left">
          <div className="font-medium">{taskInfo.name}</div>
          <div className="text-xs text-muted-foreground">{taskInfo.description}</div>
        </div>
        {selectedModel && (
          <span className="text-sm text-muted-foreground">
            {selectedModel.name}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 border-t bg-muted/30 space-y-4">
          <div>
            <label className="text-sm font-medium">Primary Model</label>
            <div className="mt-1">
              <ModelSelector
                value={config.primaryModel}
                onChange={(model) => onChange({ ...config, primaryModel: model })}
                recommended={taskInfo.recommendedModels}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Fallback Model (optional)</label>
            <div className="mt-1">
              <select
                value={config.fallbackModel || ""}
                onChange={(e) =>
                  onChange({
                    ...config,
                    fallbackModel: e.target.value ? (e.target.value as ModelId) : undefined,
                  })
                }
                className="w-full px-3 py-2 text-sm border rounded bg-background"
              >
                <option value="">No fallback</option>
                {MODELS.filter((m) => m.id !== config.primaryModel).map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Max Tokens</label>
              <input
                type="number"
                min={256}
                max={32000}
                value={config.maxTokens || 4096}
                onChange={(e) =>
                  onChange({ ...config, maxTokens: parseInt(e.target.value) || 4096 })
                }
                className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Temperature</label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={config.temperature || 0.7}
                onChange={(e) =>
                  onChange({ ...config, temperature: parseFloat(e.target.value) || 0.7 })
                }
                className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ModelConfigPanel({
  initialConfig,
  onChange,
  onSave,
  className,
}: ModelConfigPanelProps) {
  // State
  const [config, setConfig] = useState<ModelConfig>(initialConfig || createDefaultConfig());
  const [expandedTasks, setExpandedTasks] = useState<Set<TaskType>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Update config helper
  const updateConfig = useCallback(
    (updates: Partial<ModelConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      setHasChanges(true);
      onChange?.(newConfig);
    },
    [config, onChange]
  );

  // Apply preset
  const applyPreset = useCallback(
    (preset: "balanced" | "fast" | "quality") => {
      const presetTasks = PRESETS[preset];
      const newTasks = config.tasks.map((task) => {
        const presetTask = presetTasks.find((p) => p.taskType === task.taskType);
        return presetTask ? { ...task, primaryModel: presetTask.primaryModel! } : task;
      });
      updateConfig({ preset, tasks: newTasks });
    },
    [config.tasks, updateConfig]
  );

  // Update task config
  const updateTaskConfig = useCallback(
    (taskType: TaskType, taskConfig: TaskModelConfig) => {
      const newTasks = config.tasks.map((t) =>
        t.taskType === taskType ? taskConfig : t
      );
      updateConfig({ tasks: newTasks, preset: "custom" });
    },
    [config.tasks, updateConfig]
  );

  // Toggle task expansion
  const toggleTask = useCallback((taskType: TaskType) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskType)) {
        next.delete(taskType);
      } else {
        next.add(taskType);
      }
      return next;
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const defaultConfig = createDefaultConfig();
    setConfig(defaultConfig);
    setHasChanges(true);
    onChange?.(defaultConfig);
  }, [onChange]);

  // Get task config
  const getTaskConfig = (taskType: TaskType): TaskModelConfig => {
    return (
      config.tasks.find((t) => t.taskType === taskType) || {
        taskType,
        primaryModel: "claude-3-sonnet",
      }
    );
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Model Configuration</h2>
            <p className="text-xs text-muted-foreground">
              Configure AI models for each task type
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefaults}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          {hasChanges && onSave && (
            <button
              onClick={() => {
                onSave(config);
                setHasChanges(false);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Presets */}
        <div>
          <h3 className="text-sm font-medium mb-3">Quick Presets</h3>
          <div className="grid grid-cols-3 gap-3">
            {(["balanced", "fast", "quality"] as const).map((preset) => {
              const isActive = config.preset === preset;
              const icons = {
                balanced: Settings2,
                fast: Zap,
                quality: Brain,
              };
              const descriptions = {
                balanced: "Best balance of cost and quality",
                fast: "Fastest responses, lower cost",
                quality: "Highest quality, higher cost",
              };
              const Icon = icons[preset];

              return (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Icon className={cn("h-6 w-6", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("font-medium capitalize", isActive && "text-primary")}>
                    {preset}
                  </span>
                  <span className="text-xs text-muted-foreground text-center">
                    {descriptions[preset]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Task configurations */}
        <div>
          <h3 className="text-sm font-medium mb-3">Task-Specific Models</h3>
          <div className="space-y-2">
            {TASK_TYPES.map((taskType) => (
              <TaskConfigRow
                key={taskType.id}
                taskType={taskType.id}
                config={getTaskConfig(taskType.id)}
                onChange={(c) => updateTaskConfig(taskType.id, c)}
                expanded={expandedTasks.has(taskType.id)}
                onToggle={() => toggleTask(taskType.id)}
              />
            ))}
          </div>
        </div>

        {/* Global settings */}
        <div>
          <h3 className="text-sm font-medium mb-3">Global Settings</h3>
          <div className="p-4 border rounded-lg space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Default Temperature</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={config.globalSettings.defaultTemperature}
                  onChange={(e) =>
                    updateConfig({
                      globalSettings: {
                        ...config.globalSettings,
                        defaultTemperature: parseFloat(e.target.value) || 0.7,
                      },
                    })
                  }
                  className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Default Max Tokens</label>
                <input
                  type="number"
                  min={256}
                  max={32000}
                  value={config.globalSettings.defaultMaxTokens}
                  onChange={(e) =>
                    updateConfig({
                      globalSettings: {
                        ...config.globalSettings,
                        defaultMaxTokens: parseInt(e.target.value) || 4096,
                      },
                    })
                  }
                  className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Enable Fallback Models</label>
                <p className="text-xs text-muted-foreground">
                  Automatically use fallback when primary fails
                </p>
              </div>
              <button
                onClick={() =>
                  updateConfig({
                    globalSettings: {
                      ...config.globalSettings,
                      enableFallback: !config.globalSettings.enableFallback,
                    },
                  })
                }
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  config.globalSettings.enableFallback ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    config.globalSettings.enableFallback ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium">Rate Limit Retries</label>
              <input
                type="number"
                min={0}
                max={10}
                value={config.globalSettings.rateLimitRetries}
                onChange={(e) =>
                  updateConfig({
                    globalSettings: {
                      ...config.globalSettings,
                      rateLimitRetries: parseInt(e.target.value) || 3,
                    },
                  })
                }
                className="w-full mt-1 px-3 py-2 text-sm border rounded bg-background"
              />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            Model configurations affect how AI tasks are processed. Higher quality models
            provide better results but may be slower and more expensive. Use presets for
            quick configuration or customize individual task types.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>Preset: {config.preset}</span>
        <span>{TASK_TYPES.length} task types configured</span>
      </div>
    </div>
  );
}

export default ModelConfigPanel;

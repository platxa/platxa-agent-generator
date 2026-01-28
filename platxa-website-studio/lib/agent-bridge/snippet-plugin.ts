/**
 * Snippet Plugin Architecture
 *
 * Extensible plugin system for custom snippet types beyond built-in ones.
 * Plugins register new snippet types with schema, QWeb generator, and AI tool definition.
 */

// =============================================================================
// Types
// =============================================================================

export interface SnippetFieldDef {
  /** Field name */
  name: string;
  /** Field type */
  type: "string" | "number" | "boolean" | "color" | "image" | "rich_text" | "select";
  /** Display label */
  label: string;
  /** Required */
  required: boolean;
  /** Default value */
  defaultValue?: string | number | boolean;
  /** Options for select type */
  options?: string[];
  /** Description for AI */
  description?: string;
}

export interface SnippetPluginDef {
  /** Unique type ID (e.g. "pricing_table") */
  typeId: string;
  /** Display name */
  name: string;
  /** Category (e.g. "commerce", "content", "interactive") */
  category: string;
  /** Description */
  description: string;
  /** Configurable fields */
  fields: SnippetFieldDef[];
  /** QWeb template generator */
  generateQWeb: (values: Record<string, unknown>) => string;
  /** SCSS generator */
  generateScss?: (values: Record<string, unknown>) => string;
}

export interface RegisteredPlugin {
  def: SnippetPluginDef;
  registeredAt: number;
}

export interface AiToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
}

export interface AiToolSchema {
  name: string;
  description: string;
  parameters: AiToolParam[];
}

export interface PluginRegistryState {
  plugins: Record<string, RegisteredPlugin>;
}

// =============================================================================
// State
// =============================================================================

export function createPluginRegistry(): PluginRegistryState {
  return { plugins: {} };
}

// =============================================================================
// Registration
// =============================================================================

export function registerPlugin(
  state: PluginRegistryState,
  def: SnippetPluginDef,
  timestamp: number = Date.now(),
): PluginRegistryState {
  if (state.plugins[def.typeId]) {
    throw new Error(`Plugin "${def.typeId}" is already registered`);
  }
  return {
    plugins: {
      ...state.plugins,
      [def.typeId]: { def, registeredAt: timestamp },
    },
  };
}

export function unregisterPlugin(
  state: PluginRegistryState,
  typeId: string,
): PluginRegistryState {
  const { [typeId]: _, ...rest } = state.plugins;
  return { plugins: rest };
}

// =============================================================================
// Queries
// =============================================================================

export function getPlugin(
  state: PluginRegistryState,
  typeId: string,
): SnippetPluginDef | undefined {
  return state.plugins[typeId]?.def;
}

export function listPlugins(state: PluginRegistryState): SnippetPluginDef[] {
  return Object.values(state.plugins).map((p) => p.def);
}

export function listPluginsByCategory(
  state: PluginRegistryState,
  category: string,
): SnippetPluginDef[] {
  return listPlugins(state).filter((p) => p.category === category);
}

export function getPluginCount(state: PluginRegistryState): number {
  return Object.keys(state.plugins).length;
}

// =============================================================================
// AI Tool Schema Generation
// =============================================================================

function fieldTypeToJsonType(type: SnippetFieldDef["type"]): string {
  switch (type) {
    case "number": return "number";
    case "boolean": return "boolean";
    default: return "string";
  }
}

export function generateAiToolSchema(def: SnippetPluginDef): AiToolSchema {
  const params: AiToolParam[] = def.fields.map((f) => {
    const param: AiToolParam = {
      name: f.name,
      type: fieldTypeToJsonType(f.type),
      description: f.description ?? f.label,
      required: f.required,
    };
    if (f.type === "select" && f.options) {
      param.enum = f.options;
    }
    return param;
  });

  return {
    name: `generate_${def.typeId}`,
    description: `Generate a ${def.name} snippet. ${def.description}`,
    parameters: params,
  };
}

export function generateAllToolSchemas(state: PluginRegistryState): AiToolSchema[] {
  return listPlugins(state).map(generateAiToolSchema);
}

// =============================================================================
// QWeb Generation
// =============================================================================

export function generateSnippetQWeb(
  state: PluginRegistryState,
  typeId: string,
  values: Record<string, unknown>,
): string {
  const plugin = getPlugin(state, typeId);
  if (!plugin) {
    throw new Error(`Unknown snippet type: "${typeId}"`);
  }
  return plugin.generateQWeb(values);
}

export function generateSnippetScss(
  state: PluginRegistryState,
  typeId: string,
  values: Record<string, unknown>,
): string | null {
  const plugin = getPlugin(state, typeId);
  if (!plugin || !plugin.generateScss) return null;
  return plugin.generateScss(values);
}

// =============================================================================
// Validation
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export function validateValues(
  def: SnippetPluginDef,
  values: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of def.fields) {
    const val = values[field.name];

    if (field.required && (val === undefined || val === null || val === "")) {
      errors.push({ field: field.name, message: `${field.label} is required` });
      continue;
    }

    if (val === undefined || val === null) continue;

    if (field.type === "number" && typeof val !== "number") {
      errors.push({ field: field.name, message: `${field.label} must be a number` });
    }

    if (field.type === "boolean" && typeof val !== "boolean") {
      errors.push({ field: field.name, message: `${field.label} must be a boolean` });
    }

    if (field.type === "select" && field.options && !field.options.includes(String(val))) {
      errors.push({ field: field.name, message: `${field.label} must be one of: ${field.options.join(", ")}` });
    }
  }

  return errors;
}

// =============================================================================
// Default Values
// =============================================================================

export function getDefaultValues(def: SnippetPluginDef): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (field.defaultValue !== undefined) {
      defaults[field.name] = field.defaultValue;
    }
  }
  return defaults;
}

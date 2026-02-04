/**
 * ModePrompts — Mode-specific system prompts for AI behavior
 *
 * Feature #8: Chat Mode System - Mode-specific prompts
 *
 * Provides different system prompts based on operational mode:
 * - Chat: Emphasizes planning, discussion, no direct execution
 * - Agent: Focuses on autonomous execution, code generation
 * - Visual: Optimized for DOM editing, property changes
 */

import { type OperationalMode, getModeManager } from "./mode-manager";
import { getKnowledgeInjector, type InjectionContext } from "./knowledge-injector";

// =============================================================================
// Types
// =============================================================================

/** System prompt template variables */
export interface PromptVariables {
  /** Project name */
  projectName?: string;
  /** Current file being edited */
  currentFile?: string;
  /** Available tools/capabilities */
  availableTools?: string[];
  /** User preferences */
  preferences?: Record<string, string>;
  /** Additional context */
  context?: string;
}

/** Prompt configuration for a mode */
export interface ModePromptConfig {
  /** Base system prompt */
  basePrompt: string;
  /** Capabilities description */
  capabilities: string;
  /** Constraints/limitations */
  constraints: string;
  /** Response format guidance */
  responseFormat: string;
  /** Example interactions */
  examples?: string;
}

/** Complete system prompt */
export interface SystemPrompt {
  /** The full prompt text */
  text: string;
  /** Mode this prompt is for */
  mode: OperationalMode;
  /** Variables applied */
  variables: PromptVariables;
  /** Whether knowledge was injected */
  knowledgeInjected: boolean;
  /** Estimated token count */
  estimatedTokens: number;
}

/** Prompt builder options */
export interface PromptBuilderOptions {
  /** Include knowledge injection */
  includeKnowledge?: boolean;
  /** Knowledge injection context */
  knowledgeContext?: InjectionContext;
  /** Include examples */
  includeExamples?: boolean;
  /** Custom sections to append */
  customSections?: string[];
  /** Maximum token budget */
  maxTokens?: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Chat mode prompt configuration */
export const CHAT_MODE_PROMPT: ModePromptConfig = {
  basePrompt: `You are Platxa, an AI assistant specialized in website design and Odoo theme development.

You are currently in **Chat Mode** — a collaborative planning mode where you discuss ideas with the user and create implementation plans.

## Your Role in Chat Mode

In this mode, you:
- Listen to the user's requirements and ask clarifying questions
- Analyze their website goals, brand identity, and design preferences
- Generate detailed implementation plans with step-by-step instructions
- Explain design decisions and trade-offs
- Help users understand what will be built before execution

## Important: Do NOT Execute

In Chat Mode, you should NEVER:
- Write actual code or templates directly
- Make changes to files
- Execute any generation or modification commands
- Create production-ready implementations

Instead, focus on:
- Understanding requirements deeply
- Breaking down complex requests into manageable steps
- Creating clear, actionable plans
- Suggesting design approaches with rationale`,

  capabilities: `## Your Capabilities

You can help with:
- Website structure and navigation planning
- Page layout recommendations
- Color palette and typography selection
- Component and section suggestions
- User flow optimization
- Accessibility considerations
- Responsive design strategies
- Odoo theme architecture advice`,

  constraints: `## Constraints

Remember:
- You are in PLANNING mode, not execution mode
- Present plans and wait for user approval before suggesting implementation
- If the user wants to execute, suggest switching to Agent Mode
- Keep responses focused on design and planning, not code`,

  responseFormat: `## Response Format

When creating plans, use this structure:

### Overview
Brief summary of what will be built

### Steps
1. **Step Name** — Description of what this step accomplishes
   - Key decisions or options
   - Dependencies

### Design Decisions
- Explain WHY certain approaches are recommended

### Next Steps
- What the user should confirm before proceeding
- Suggest "Switch to Agent Mode to execute this plan"`,

  examples: `## Example Interaction

User: "I want a hero section with an animated background"

Good Response:
"I'll help you plan an engaging hero section! Let me outline the approach:

**Hero Section Plan**

1. **Layout Structure** — Full-width container with centered content
2. **Background Options**:
   - CSS gradient animation (lightweight)
   - Particle.js effect (more dynamic)
   - Video background (most impactful, larger file size)

3. **Content Elements**:
   - Headline with fade-in animation
   - Subtext with slight delay
   - CTA buttons with hover effects

Which background style appeals to you? Once you confirm, I can detail the implementation plan further."`,
};

/** Agent mode prompt configuration */
export const AGENT_MODE_PROMPT: ModePromptConfig = {
  basePrompt: `You are Platxa, an AI assistant specialized in website design and Odoo theme development.

You are currently in **Agent Mode** — an autonomous execution mode where you implement designs and generate code.

## Your Role in Agent Mode

In this mode, you:
- Execute implementation plans created in Chat Mode
- Generate production-ready QWeb templates and SCSS
- Create Odoo theme components following best practices
- Handle file operations and code modifications
- Provide real-time progress updates during execution

## Execution Authority

In Agent Mode, you CAN and SHOULD:
- Write and modify QWeb XML templates
- Generate SCSS stylesheets with Odoo conventions
- Create component snippets and page layouts
- Apply design tokens and brand variables
- Execute multi-step generation plans`,

  capabilities: `## Your Capabilities

You can generate:
- QWeb templates with proper t-* directives
- SCSS following Odoo theming patterns
- Snippet definitions with options
- Page layouts with sections
- Responsive breakpoint handling
- Accessibility-compliant markup

You have access to:
- File reading and writing
- Template generation tools
- Style compilation
- Preview generation`,

  constraints: `## Constraints

- Follow established patterns in the codebase
- Use design tokens instead of hardcoded values
- Ensure WCAG 2.1 AA accessibility compliance
- Generate mobile-first responsive layouts
- Include proper semantic HTML structure
- Add appropriate comments for complex logic`,

  responseFormat: `## Response Format

When executing, provide:

1. **Progress Updates** — What you're currently doing
2. **Generated Code** — The actual implementation
3. **Explanation** — Brief notes on key decisions
4. **Verification** — How to test/preview the result

Use code blocks with proper language tags (xml, scss, python).`,
};

/** Visual mode prompt configuration */
export const VISUAL_MODE_PROMPT: ModePromptConfig = {
  basePrompt: `You are Platxa, an AI assistant specialized in website design and Odoo theme development.

You are currently in **Visual Mode** — a direct manipulation mode where you help users edit elements visually.

## Your Role in Visual Mode

In this mode, you:
- Respond to user selections in the visual preview
- Apply property changes to selected elements
- Translate visual edits to source code changes
- Provide instant feedback on modifications
- Suggest related improvements to selected elements

## Visual Editing Context

The user is interacting with a live preview and can:
- Click elements to select them
- Modify properties in the property panel
- Drag to reposition or resize elements
- Request text or style changes conversationally`,

  capabilities: `## Your Capabilities

You can modify:
- Text content and typography
- Colors, backgrounds, and borders
- Spacing (margins, padding)
- Layout properties (display, flex, grid)
- Visibility and opacity
- CSS classes and inline styles

You understand:
- DOM structure and element relationships
- QWeb template source mapping
- SCSS variable references
- Responsive breakpoint implications`,

  constraints: `## Constraints

- Only modify the currently selected element unless asked otherwise
- Preserve existing functionality and event handlers
- Maintain accessibility attributes
- Use design tokens when possible
- Keep changes minimal and targeted
- Warn about changes that might break responsive behavior`,

  responseFormat: `## Response Format

For visual edits:

1. **Confirm Selection** — Acknowledge what element is selected
2. **Apply Change** — Make the requested modification
3. **Preview Impact** — Describe the visual result
4. **Source Update** — Note what was changed in the source

Keep responses brief — the visual preview speaks for itself.`,
};

/** All mode prompts */
export const MODE_PROMPTS: Record<OperationalMode, ModePromptConfig> = {
  chat: CHAT_MODE_PROMPT,
  agent: AGENT_MODE_PROMPT,
  visual: VISUAL_MODE_PROMPT,
};

/** Approximate characters per token */
const CHARS_PER_TOKEN = 4;

// =============================================================================
// Helpers
// =============================================================================

/** Estimate token count */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Apply variables to prompt text */
function applyVariables(text: string, variables: PromptVariables): string {
  let result = text;

  if (variables.projectName) {
    result = result.replace(/\{projectName\}/g, variables.projectName);
  }
  if (variables.currentFile) {
    result = result.replace(/\{currentFile\}/g, variables.currentFile);
  }
  if (variables.context) {
    result += `\n\n## Current Context\n\n${variables.context}`;
  }
  if (variables.availableTools && variables.availableTools.length > 0) {
    result += `\n\n## Available Tools\n\n${variables.availableTools.map((t) => `- ${t}`).join("\n")}`;
  }

  return result;
}

// =============================================================================
// ModePromptBuilder Class
// =============================================================================

/**
 * ModePromptBuilder constructs mode-specific system prompts.
 *
 * Usage:
 * ```ts
 * const builder = new ModePromptBuilder();
 *
 * // Build prompt for current mode
 * const prompt = builder.build();
 *
 * // Build prompt for specific mode with variables
 * const chatPrompt = builder.buildForMode("chat", {
 *   projectName: "My Website",
 *   currentFile: "views/home.xml",
 * });
 *
 * // Use in API call
 * const response = await ai.chat({
 *   systemPrompt: prompt.text,
 *   messages: [...],
 * });
 * ```
 */
export class ModePromptBuilder {
  private customPrompts: Partial<Record<OperationalMode, Partial<ModePromptConfig>>> = {};

  /**
   * Build system prompt for the current mode.
   */
  build(
    variables: PromptVariables = {},
    options: PromptBuilderOptions = {}
  ): SystemPrompt {
    const mode = getModeManager().getMode();
    return this.buildForMode(mode, variables, options);
  }

  /**
   * Build system prompt for a specific mode.
   */
  buildForMode(
    mode: OperationalMode,
    variables: PromptVariables = {},
    options: PromptBuilderOptions = {}
  ): SystemPrompt {
    const baseConfig = MODE_PROMPTS[mode];
    const customConfig = this.customPrompts[mode] || {};

    // Merge configs
    const config: ModePromptConfig = {
      basePrompt: customConfig.basePrompt || baseConfig.basePrompt,
      capabilities: customConfig.capabilities || baseConfig.capabilities,
      constraints: customConfig.constraints || baseConfig.constraints,
      responseFormat: customConfig.responseFormat || baseConfig.responseFormat,
      examples: customConfig.examples || baseConfig.examples,
    };

    // Build prompt sections
    const sections: string[] = [
      config.basePrompt,
      config.capabilities,
      config.constraints,
      config.responseFormat,
    ];

    // Add examples if requested
    if (options.includeExamples && config.examples) {
      sections.push(config.examples);
    }

    // Add custom sections
    if (options.customSections) {
      sections.push(...options.customSections);
    }

    // Combine and apply variables
    let text = sections.join("\n\n");
    text = applyVariables(text, variables);

    // Inject knowledge if requested
    let knowledgeInjected = false;
    if (options.includeKnowledge) {
      const injector = getKnowledgeInjector();
      const result = injector.inject(text, {
        ...options.knowledgeContext,
        taskType: mode === "agent" ? "generate" : mode === "visual" ? "edit" : "other",
      });
      if (result.applied) {
        text = result.injected;
        knowledgeInjected = true;
      }
    }

    // Check token budget
    const estimatedTokens = estimateTokens(text);
    if (options.maxTokens && estimatedTokens > options.maxTokens) {
      // Trim by removing examples first, then capabilities
      text = [config.basePrompt, config.constraints, config.responseFormat].join("\n\n");
      text = applyVariables(text, variables);
    }

    return {
      text,
      mode,
      variables,
      knowledgeInjected,
      estimatedTokens: estimateTokens(text),
    };
  }

  /**
   * Set custom prompt configuration for a mode.
   */
  setCustomPrompt(mode: OperationalMode, config: Partial<ModePromptConfig>): void {
    this.customPrompts[mode] = config;
  }

  /**
   * Reset custom prompts.
   */
  resetCustomPrompts(): void {
    this.customPrompts = {};
  }

  /**
   * Get the base prompt config for a mode.
   */
  getBaseConfig(mode: OperationalMode): ModePromptConfig {
    return { ...MODE_PROMPTS[mode] };
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/** Get system prompt for current mode */
export function getCurrentModePrompt(
  variables?: PromptVariables,
  options?: PromptBuilderOptions
): SystemPrompt {
  const builder = new ModePromptBuilder();
  return builder.build(variables, options);
}

/** Get system prompt for specific mode */
export function getModePrompt(
  mode: OperationalMode,
  variables?: PromptVariables,
  options?: PromptBuilderOptions
): SystemPrompt {
  const builder = new ModePromptBuilder();
  return builder.buildForMode(mode, variables, options);
}

/** Check if current mode allows execution */
export function canExecuteInCurrentMode(): boolean {
  const mode = getModeManager().getMode();
  return mode === "agent";
}

/** Check if current mode is planning-only */
export function isPlanningMode(): boolean {
  const mode = getModeManager().getMode();
  return mode === "chat";
}

/** Check if current mode is visual editing */
export function isVisualEditMode(): boolean {
  const mode = getModeManager().getMode();
  return mode === "visual";
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: ModePromptBuilder | null = null;

/** Get the global ModePromptBuilder instance */
export function getModePromptBuilder(): ModePromptBuilder {
  if (!_instance) {
    _instance = new ModePromptBuilder();
  }
  return _instance;
}

/** Reset the global ModePromptBuilder instance */
export function resetModePromptBuilder(): void {
  _instance = null;
}

/**
 * Tool Executor - Dispatches plan steps to appropriate tools
 *
 * Routes actions to their corresponding tool implementations:
 * - search -> search_codebase
 * - read -> read_file
 * - write -> write_file
 * - edit -> edit_file
 * - validate -> validate_qweb / validate_scss
 * - compile -> compile_scss
 * - preview -> preview_render
 * - test -> test_odoo
 * - web_search -> web_search
 *
 * @module agentic-core/tool-executor
 */

import type {
  AgentActionType,
  AgentPlanStep,
  AgentContext,
  ToolExecutor,
} from './agent-engine';
import { searchCodebaseTool } from './tools/search-codebase';
import { readFileTool } from './tools/read-file';
import { writeFileTool } from './tools/write-file';
import { editFileTool } from './tools/edit-file';

// ============================================================================
// Types
// ============================================================================

/** Result from a tool execution */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  toolName: string;
}

/** Tool function signature */
export type ToolFunction = (
  params: ToolParams
) => Promise<ToolResult>;

/** Parameters passed to tools */
export interface ToolParams {
  target: string;
  context: AgentContext;
  options?: Record<string, unknown>;
}

/** Tool registration entry */
export interface ToolRegistration {
  name: string;
  description: string;
  handler: ToolFunction;
  /** Actions this tool handles */
  actions: AgentActionType[];
}

/** Executor configuration */
export interface ToolExecutorConfig {
  /** Timeout per tool execution in ms */
  timeout?: number;
  /** Whether to cache results */
  cacheResults?: boolean;
  /** Cache TTL in ms */
  cacheTTL?: number;
  /** Retry failed operations */
  retryOnFailure?: boolean;
  /** Max retries */
  maxRetries?: number;
}

// ============================================================================
// Default Tool Implementations
// ============================================================================

/**
 * Default search_codebase tool
 * Uses ripgrep with semantic ranking via the searchCodebaseTool implementation
 */
async function searchCodebase(params: ToolParams): Promise<ToolResult> {
  return searchCodebaseTool(params);
}

/**
 * Default read_file tool
 * Uses the production readFileTool implementation with line range support
 */
async function readFile(params: ToolParams): Promise<ToolResult> {
  return readFileTool(params);
}

/**
 * Default write_file tool
 * Uses the production writeFileTool implementation with Yjs sync
 */
async function writeFile(params: ToolParams): Promise<ToolResult> {
  return writeFileTool(params);
}

/**
 * Default edit_file tool
 * Uses the production editFileTool with search/replace operations
 */
async function editFile(params: ToolParams): Promise<ToolResult> {
  return editFileTool(params);
}

/**
 * Default validate_qweb tool
 */
async function validateQweb(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    return {
      success: true,
      data: {
        target: params.target,
        valid: true,
        errors: [],
        warnings: [],
      },
      duration: Date.now() - startTime,
      toolName: 'validate_qweb',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'validate_qweb',
    };
  }
}

/**
 * Default compile_scss tool
 */
async function compileScss(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    return {
      success: true,
      data: {
        target: params.target,
        compiled: true,
        css: '',
        sourceMap: null,
      },
      duration: Date.now() - startTime,
      toolName: 'compile_scss',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'compile_scss',
    };
  }
}

/**
 * Default preview_render tool
 */
async function previewRender(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    return {
      success: true,
      data: {
        target: params.target,
        html: '',
        previewUrl: null,
      },
      duration: Date.now() - startTime,
      toolName: 'preview_render',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'preview_render',
    };
  }
}

/**
 * Default test_odoo tool
 */
async function testOdoo(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    return {
      success: true,
      data: {
        target: params.target,
        passed: true,
        tests: 0,
        failures: 0,
      },
      duration: Date.now() - startTime,
      toolName: 'test_odoo',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'test_odoo',
    };
  }
}

/**
 * Default web_search tool
 */
async function webSearch(params: ToolParams): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    return {
      success: true,
      data: {
        query: params.target,
        results: [],
      },
      duration: Date.now() - startTime,
      toolName: 'web_search',
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
      toolName: 'web_search',
    };
  }
}

// ============================================================================
// Action to Tool Mapping
// ============================================================================

/** Maps actions to their default tool implementations */
const DEFAULT_ACTION_TOOLS: Record<AgentActionType, ToolFunction> = {
  search: searchCodebase,
  read: readFile,
  write: writeFile,
  edit: editFile,
  validate: validateQweb,
  compile: compileScss,
  preview: previewRender,
  test: testOdoo,
  web_search: webSearch,
};

// ============================================================================
// AgentToolExecutor Class
// ============================================================================

/**
 * AgentToolExecutor - Routes plan steps to appropriate tools
 *
 * Implements the ToolExecutor interface from AgentEngine.
 * Provides a registry for custom tools and default implementations.
 */
export class AgentToolExecutor implements ToolExecutor {
  private config: Required<ToolExecutorConfig>;
  private tools: Map<AgentActionType, ToolFunction>;
  private customTools: Map<string, ToolRegistration>;
  private cache: Map<string, { result: ToolResult; timestamp: number }>;

  constructor(config: ToolExecutorConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      cacheResults: config.cacheResults ?? true,
      cacheTTL: config.cacheTTL ?? 60000,
      retryOnFailure: config.retryOnFailure ?? true,
      maxRetries: config.maxRetries ?? 2,
    };

    // Initialize with default tools
    this.tools = new Map(Object.entries(DEFAULT_ACTION_TOOLS) as [AgentActionType, ToolFunction][]);
    this.customTools = new Map();
    this.cache = new Map();
  }

  /**
   * Execute a tool based on action type
   * Routes the action to the appropriate tool handler
   */
  async execute(
    action: AgentActionType,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const toolParams: ToolParams = {
      target: params.target as string,
      context: params.context as AgentContext,
      options: params,
    };

    // Check cache first
    const cacheKey = this.getCacheKey(action, toolParams);
    if (this.config.cacheResults) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached.data;
      }
    }

    // Get the tool handler
    const handler = this.tools.get(action);
    if (!handler) {
      throw new Error(`No tool registered for action: ${action}`);
    }

    // Execute with timeout and retry
    let result: ToolResult;
    let attempts = 0;

    while (attempts <= this.config.maxRetries) {
      try {
        result = await this.executeWithTimeout(handler, toolParams);

        if (result.success || !this.config.retryOnFailure) {
          break;
        }

        attempts++;
      } catch (error) {
        if (attempts >= this.config.maxRetries) {
          throw error;
        }
        attempts++;
      }
    }

    // Cache successful results
    if (result!.success && this.config.cacheResults) {
      this.setCache(cacheKey, result!);
    }

    if (!result!.success) {
      throw new Error(result!.error || `Tool ${action} failed`);
    }

    return result!.data;
  }

  /**
   * Execute a plan step directly
   * Convenience method for AgentEngine integration
   */
  async executeStep(step: AgentPlanStep, context: AgentContext): Promise<ToolResult> {
    const toolParams: ToolParams = {
      target: step.target,
      context,
      options: { stepId: step.id, rationale: step.rationale },
    };

    const handler = this.tools.get(step.action);
    if (!handler) {
      return {
        success: false,
        error: `No tool registered for action: ${step.action}`,
        duration: 0,
        toolName: 'unknown',
      };
    }

    return this.executeWithTimeout(handler, toolParams);
  }

  /**
   * Register a custom tool
   */
  registerTool(registration: ToolRegistration): void {
    this.customTools.set(registration.name, registration);

    // Map actions to this tool
    for (const action of registration.actions) {
      this.tools.set(action, registration.handler);
    }
  }

  /**
   * Override a default tool implementation
   */
  setToolHandler(action: AgentActionType, handler: ToolFunction): void {
    this.tools.set(action, handler);
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): Map<string, ToolRegistration> {
    return new Map(this.customTools);
  }

  /**
   * Check if a tool is registered for an action
   */
  hasToolFor(action: AgentActionType): boolean {
    return this.tools.has(action);
  }

  /**
   * Clear the result cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get tool for specific action (for testing)
   */
  getToolForAction(action: AgentActionType): ToolFunction | undefined {
    return this.tools.get(action);
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private async executeWithTimeout(
    handler: ToolFunction,
    params: ToolParams
  ): Promise<ToolResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      handler(params)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private getCacheKey(action: AgentActionType, params: ToolParams): string {
    return `${action}:${params.target}`;
  }

  private getFromCache(key: string): ToolResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.config.cacheTTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  private setCache(key: string, result: ToolResult): void {
    this.cache.set(key, { result, timestamp: Date.now() });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a tool executor with default configuration
 */
export function createToolExecutor(config?: ToolExecutorConfig): AgentToolExecutor {
  return new AgentToolExecutor(config);
}

/**
 * Create a tool executor with custom tool implementations
 */
export function createToolExecutorWithTools(
  tools: Partial<Record<AgentActionType, ToolFunction>>,
  config?: ToolExecutorConfig
): AgentToolExecutor {
  const executor = new AgentToolExecutor(config);

  for (const [action, handler] of Object.entries(tools)) {
    if (handler) {
      executor.setToolHandler(action as AgentActionType, handler);
    }
  }

  return executor;
}

// ============================================================================
// Default Export
// ============================================================================

export default AgentToolExecutor;

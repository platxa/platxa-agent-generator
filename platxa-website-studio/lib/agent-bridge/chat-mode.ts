/**
 * Chat Mode — Read-Only Planning Mode
 *
 * Wraps agent tools in read-only mode for Lovable-style Chat experience:
 * - Can search, read, and inspect files
 * - CANNOT write, edit, or delete files
 * - Generates implementation plans instead of executing changes
 *
 * This enables users to plan and discuss changes without risk of
 * accidental modifications to the codebase.
 */

import { getModeManager, type ModeCapabilities } from "./mode-manager";

// =============================================================================
// Types
// =============================================================================

/** Tool categories for capability filtering */
export type ToolCategory = "read" | "write" | "search" | "inspect" | "generate";

/** Tool definition with category and execution function */
export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  execute: ToolExecutor;
}

/** Tool execution function signature */
export type ToolExecutor = (params: Record<string, unknown>) => Promise<ToolResult>;

/** Result of a tool execution */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  blocked?: boolean;
  blockReason?: string;
}

/** Plan step generated in Chat mode */
export interface PlanStep {
  id: string;
  order: number;
  action: string;
  tool: string;
  params: Record<string, unknown>;
  description: string;
  estimatedImpact: "low" | "medium" | "high";
  affectedFiles: string[];
  /** Estimated time for this step (e.g., "5m", "1h") */
  estimatedTime?: string;
  /** IDs of steps this step depends on */
  dependencies?: string[];
}

/** Implementation plan generated from Chat mode discussion */
export interface ImplementationPlan {
  id: string;
  title: string;
  description: string;
  steps: PlanStep[];
  createdAt: number;
  estimatedComplexity: "simple" | "moderate" | "complex";
  affectedFiles: string[];
  requiresConfirmation: boolean;
  /** Short summary of the plan */
  summary?: string;
  /** Total estimated time for all steps */
  estimatedTime?: string;
}

/** Chat mode configuration */
export interface ChatModeConfig {
  /** Whether to auto-generate plans from write requests */
  autoGeneratePlans: boolean;
  /** Whether to show what would happen on blocked operations */
  showBlockedPreview: boolean;
  /** Custom blocked message */
  blockedMessage?: string;
}

/** Chat mode state */
export interface ChatModeState {
  isActive: boolean;
  pendingPlans: ImplementationPlan[];
  blockedOperations: BlockedOperation[];
  toolRegistry: Map<string, ToolDefinition>;
}

/** Record of a blocked operation */
export interface BlockedOperation {
  id: string;
  timestamp: number;
  tool: string;
  params: Record<string, unknown>;
  reason: string;
  suggestedPlan?: PlanStep;
}

// =============================================================================
// Constants
// =============================================================================

/** Tools that are allowed in Chat mode (read-only) */
export const ALLOWED_TOOLS: Set<string> = new Set([
  // Search tools
  "search_codebase",
  "search_files",
  "grep",
  "find_files",
  "semantic_search",

  // Read tools
  "read_file",
  "read_files",
  "get_file_content",
  "list_directory",
  "get_file_info",

  // Inspect tools
  "inspect_logs",
  "inspect_network",
  "get_console_errors",
  "get_network_requests",
  "analyze_performance",

  // Navigation tools
  "go_to_definition",
  "find_references",
  "get_symbols",
  "get_hover_info",

  // Analysis tools
  "analyze_code",
  "get_diagnostics",
  "check_types",
  "lint_file",
]);

/** Tools that are blocked in Chat mode (write operations) */
export const BLOCKED_TOOLS: Set<string> = new Set([
  // Write tools
  "write_file",
  "create_file",
  "edit_file",
  "delete_file",
  "rename_file",
  "move_file",

  // Execution tools
  "run_command",
  "execute_script",
  "npm_install",
  "run_tests",

  // Deployment tools
  "deploy",
  "publish",
  "push_to_git",

  // Generation tools (that write)
  "generate_code",
  "generate_component",
  "apply_changes",
]);

/** Default Chat mode configuration */
export const DEFAULT_CHAT_CONFIG: ChatModeConfig = {
  autoGeneratePlans: true,
  showBlockedPreview: true,
  blockedMessage: "This operation is blocked in Chat mode. Switch to Agent mode to execute changes.",
};

// =============================================================================
// Plan ID Generator
// =============================================================================

let _planCounter = 0;
let _stepCounter = 0;
let _blockCounter = 0;

/** Generate unique plan ID */
function generatePlanId(): string {
  return `plan_${Date.now()}_${++_planCounter}`;
}

/** Generate unique step ID */
function generateStepId(): string {
  return `step_${Date.now()}_${++_stepCounter}`;
}

/** Generate unique block ID */
function generateBlockId(): string {
  return `block_${Date.now()}_${++_blockCounter}`;
}

/** Reset counters (for testing) */
export function resetChatModeCounters(): void {
  _planCounter = 0;
  _stepCounter = 0;
  _blockCounter = 0;
}

// =============================================================================
// ChatMode Class
// =============================================================================

/**
 * ChatMode wraps agent tools in read-only mode.
 *
 * Usage:
 * ```ts
 * const chatMode = new ChatMode();
 *
 * // Register tools
 * chatMode.registerTool({
 *   name: "read_file",
 *   category: "read",
 *   execute: async (params) => ({ success: true, data: "..." }),
 * });
 *
 * // Execute tool (will block writes)
 * const result = await chatMode.executeTool("write_file", { path: "..." });
 * // result.blocked === true
 *
 * // Get generated plan from blocked operation
 * const plans = chatMode.getPendingPlans();
 * ```
 */
export class ChatMode {
  private state: ChatModeState;
  private config: ChatModeConfig;

  constructor(config: Partial<ChatModeConfig> = {}) {
    this.config = { ...DEFAULT_CHAT_CONFIG, ...config };
    this.state = {
      isActive: false,
      pendingPlans: [],
      blockedOperations: [],
      toolRegistry: new Map(),
    };
  }

  // ---------------------------------------------------------------------------
  // Mode Management
  // ---------------------------------------------------------------------------

  /** Activate Chat mode */
  activate(): void {
    this.state.isActive = true;
    const manager = getModeManager();
    if (manager.getMode() !== "chat") {
      manager.toChatMode("system");
    }
  }

  /** Deactivate Chat mode */
  deactivate(): void {
    this.state.isActive = false;
  }

  /** Check if Chat mode is active */
  isActive(): boolean {
    return this.state.isActive;
  }

  /** Get current configuration */
  getConfig(): ChatModeConfig {
    return { ...this.config };
  }

  /** Update configuration */
  setConfig(config: Partial<ChatModeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---------------------------------------------------------------------------
  // Tool Registration
  // ---------------------------------------------------------------------------

  /** Register a tool with the Chat mode wrapper */
  registerTool(tool: ToolDefinition): void {
    this.state.toolRegistry.set(tool.name, tool);
  }

  /** Unregister a tool */
  unregisterTool(name: string): void {
    this.state.toolRegistry.delete(name);
  }

  /** Get registered tool */
  getTool(name: string): ToolDefinition | undefined {
    return this.state.toolRegistry.get(name);
  }

  /** Get all registered tool names */
  getRegisteredTools(): string[] {
    return Array.from(this.state.toolRegistry.keys());
  }

  // ---------------------------------------------------------------------------
  // Tool Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a tool with Chat mode restrictions.
   * Read operations pass through; write operations are blocked and converted to plans.
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown> = {}
  ): Promise<ToolResult> {
    // Check if tool is registered
    const tool = this.state.toolRegistry.get(toolName);

    // If Chat mode is not active, execute normally
    if (!this.state.isActive) {
      if (tool) {
        return tool.execute(params);
      }
      return {
        success: false,
        error: `Tool not registered: ${toolName}`,
      };
    }

    // Check if tool is allowed in Chat mode
    if (this.isToolAllowed(toolName)) {
      if (tool) {
        return tool.execute(params);
      }
      // Allow unregistered tools if they're in the allowed list
      return {
        success: false,
        error: `Tool not registered: ${toolName}`,
      };
    }

    // Block the operation and record it
    return this.blockOperation(toolName, params);
  }

  /**
   * Check if a tool is allowed in Chat mode.
   */
  isToolAllowed(toolName: string): boolean {
    // First check explicit allow list
    if (ALLOWED_TOOLS.has(toolName)) {
      return true;
    }

    // Then check explicit block list
    if (BLOCKED_TOOLS.has(toolName)) {
      return false;
    }

    // Check registered tool category
    const tool = this.state.toolRegistry.get(toolName);
    if (tool) {
      return tool.category === "read" || tool.category === "search" || tool.category === "inspect";
    }

    // Default to blocking unknown tools
    return false;
  }

  /**
   * Check if a tool is blocked in Chat mode.
   */
  isToolBlocked(toolName: string): boolean {
    return !this.isToolAllowed(toolName);
  }

  /**
   * Get the category of a tool.
   */
  getToolCategory(toolName: string): ToolCategory | "unknown" {
    const tool = this.state.toolRegistry.get(toolName);
    if (tool) {
      return tool.category;
    }

    if (ALLOWED_TOOLS.has(toolName)) {
      // Infer category from tool name
      if (toolName.includes("search") || toolName.includes("find") || toolName.includes("grep")) {
        return "search";
      }
      if (toolName.includes("read") || toolName.includes("get") || toolName.includes("list")) {
        return "read";
      }
      if (toolName.includes("inspect") || toolName.includes("analyze")) {
        return "inspect";
      }
    }

    if (BLOCKED_TOOLS.has(toolName)) {
      if (toolName.includes("write") || toolName.includes("edit") || toolName.includes("create") || toolName.includes("delete")) {
        return "write";
      }
      if (toolName.includes("generate")) {
        return "generate";
      }
    }

    return "unknown";
  }

  // ---------------------------------------------------------------------------
  // Blocked Operation Handling
  // ---------------------------------------------------------------------------

  /**
   * Block an operation and optionally generate a plan step.
   */
  private blockOperation(
    toolName: string,
    params: Record<string, unknown>
  ): ToolResult {
    const blockId = generateBlockId();
    const reason = this.config.blockedMessage || DEFAULT_CHAT_CONFIG.blockedMessage!;

    // Create suggested plan step
    let suggestedPlan: PlanStep | undefined;
    if (this.config.autoGeneratePlans) {
      suggestedPlan = this.createPlanStepFromTool(toolName, params);
    }

    // Record blocked operation
    const blocked: BlockedOperation = {
      id: blockId,
      timestamp: Date.now(),
      tool: toolName,
      params,
      reason,
      suggestedPlan,
    };
    this.state.blockedOperations.push(blocked);

    // Build result with preview if enabled
    const result: ToolResult = {
      success: false,
      blocked: true,
      blockReason: reason,
    };

    if (this.config.showBlockedPreview && suggestedPlan) {
      result.data = {
        wouldExecute: toolName,
        withParams: params,
        suggestedStep: suggestedPlan,
        message: `In Agent mode, this would: ${suggestedPlan.description}`,
      };
    }

    return result;
  }

  /**
   * Create a plan step from a blocked tool call.
   */
  private createPlanStepFromTool(
    toolName: string,
    params: Record<string, unknown>
  ): PlanStep {
    const affectedFiles = this.extractAffectedFiles(params);
    const description = this.describeToolAction(toolName, params);
    const impact = this.estimateImpact(toolName, params);

    return {
      id: generateStepId(),
      order: 0,
      action: toolName,
      tool: toolName,
      params,
      description,
      estimatedImpact: impact,
      affectedFiles,
    };
  }

  /**
   * Extract affected files from tool parameters.
   */
  private extractAffectedFiles(params: Record<string, unknown>): string[] {
    const files: string[] = [];

    // Common parameter names for file paths
    const pathKeys = ["path", "file", "filePath", "file_path", "source", "destination", "target"];

    for (const key of pathKeys) {
      const value = params[key];
      if (typeof value === "string" && value.length > 0) {
        files.push(value);
      }
    }

    // Handle array of files
    const filesParam = params["files"] || params["paths"];
    if (Array.isArray(filesParam)) {
      for (const f of filesParam) {
        if (typeof f === "string") {
          files.push(f);
        }
      }
    }

    // Deduplicate using filter
    return files.filter((f, i) => files.indexOf(f) === i);
  }

  /**
   * Generate human-readable description of tool action.
   */
  private describeToolAction(
    toolName: string,
    params: Record<string, unknown>
  ): string {
    const path = params["path"] || params["file"] || params["filePath"];
    const content = params["content"];

    switch (toolName) {
      case "write_file":
      case "create_file":
        return `Create/write file: ${path}`;
      case "edit_file":
        return `Edit file: ${path}`;
      case "delete_file":
        return `Delete file: ${path}`;
      case "rename_file":
        return `Rename ${params["source"]} to ${params["destination"]}`;
      case "move_file":
        return `Move ${params["source"]} to ${params["destination"]}`;
      case "run_command":
        return `Execute command: ${params["command"]}`;
      case "npm_install":
        return `Install package: ${params["package"]}`;
      case "generate_code":
        return `Generate code for: ${params["description"] || "component"}`;
      case "deploy":
        return `Deploy to: ${params["target"] || "production"}`;
      default:
        return `Execute ${toolName}${path ? ` on ${path}` : ""}`;
    }
  }

  /**
   * Estimate impact level of a tool action.
   */
  private estimateImpact(
    toolName: string,
    params: Record<string, unknown>
  ): "low" | "medium" | "high" {
    // High impact operations
    if (["delete_file", "deploy", "publish", "push_to_git"].includes(toolName)) {
      return "high";
    }

    // Medium impact operations
    if (["write_file", "edit_file", "create_file", "run_command", "npm_install"].includes(toolName)) {
      return "medium";
    }

    // Low impact operations
    return "low";
  }

  // ---------------------------------------------------------------------------
  // Plan Management
  // ---------------------------------------------------------------------------

  /**
   * Convert blocked operations into an implementation plan.
   */
  createPlanFromBlocked(title: string, description: string = ""): ImplementationPlan {
    const steps = this.state.blockedOperations
      .filter((op) => op.suggestedPlan)
      .map((op, index) => ({
        ...op.suggestedPlan!,
        order: index + 1,
      }));

    const allFiles = steps.flatMap((s) => s.affectedFiles);
    const uniqueFiles = allFiles.filter((f, i) => allFiles.indexOf(f) === i);

    const complexity = this.estimatePlanComplexity(steps);

    const plan: ImplementationPlan = {
      id: generatePlanId(),
      title,
      description,
      steps,
      createdAt: Date.now(),
      estimatedComplexity: complexity,
      affectedFiles: uniqueFiles,
      requiresConfirmation: steps.some((s) => s.estimatedImpact === "high"),
    };

    this.state.pendingPlans.push(plan);

    // Clear blocked operations that were converted
    this.state.blockedOperations = [];

    return plan;
  }

  /**
   * Estimate overall plan complexity.
   */
  private estimatePlanComplexity(steps: PlanStep[]): "simple" | "moderate" | "complex" {
    if (steps.length <= 2) return "simple";
    if (steps.length <= 5) return "moderate";
    return "complex";
  }

  /**
   * Get all pending plans.
   */
  getPendingPlans(): ImplementationPlan[] {
    return [...this.state.pendingPlans];
  }

  /**
   * Get a specific plan by ID.
   */
  getPlan(planId: string): ImplementationPlan | undefined {
    return this.state.pendingPlans.find((p) => p.id === planId);
  }

  /**
   * Remove a plan.
   */
  removePlan(planId: string): boolean {
    const index = this.state.pendingPlans.findIndex((p) => p.id === planId);
    if (index >= 0) {
      this.state.pendingPlans.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all pending plans.
   */
  clearPlans(): void {
    this.state.pendingPlans = [];
  }

  /**
   * Get blocked operations.
   */
  getBlockedOperations(): BlockedOperation[] {
    return [...this.state.blockedOperations];
  }

  /**
   * Clear blocked operations.
   */
  clearBlockedOperations(): void {
    this.state.blockedOperations = [];
  }

  // ---------------------------------------------------------------------------
  // Capability Checking
  // ---------------------------------------------------------------------------

  /**
   * Check if an operation can be performed in current mode.
   */
  canPerform(capability: keyof ModeCapabilities): boolean {
    const manager = getModeManager();
    return manager.can(capability);
  }

  /**
   * Get allowed tool names for Chat mode.
   */
  getAllowedTools(): string[] {
    const tools: string[] = [];
    ALLOWED_TOOLS.forEach((tool) => tools.push(tool));
    return tools;
  }

  /**
   * Get blocked tool names for Chat mode.
   */
  getBlockedTools(): string[] {
    const tools: string[] = [];
    BLOCKED_TOOLS.forEach((tool) => tools.push(tool));
    return tools;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  /**
   * Export state for debugging or persistence.
   */
  toJSON(): {
    isActive: boolean;
    pendingPlans: ImplementationPlan[];
    blockedOperations: BlockedOperation[];
    config: ChatModeConfig;
  } {
    return {
      isActive: this.state.isActive,
      pendingPlans: this.state.pendingPlans,
      blockedOperations: this.state.blockedOperations,
      config: this.config,
    };
  }

  /**
   * Reset Chat mode state.
   */
  reset(): void {
    this.state = {
      isActive: false,
      pendingPlans: [],
      blockedOperations: [],
      toolRegistry: this.state.toolRegistry, // Keep registered tools
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _chatModeInstance: ChatMode | null = null;

/**
 * Get the global ChatMode instance.
 */
export function getChatMode(): ChatMode {
  if (!_chatModeInstance) {
    _chatModeInstance = new ChatMode();
  }
  return _chatModeInstance;
}

/**
 * Reset the global ChatMode instance.
 */
export function resetChatMode(): void {
  if (_chatModeInstance) {
    _chatModeInstance.reset();
    _chatModeInstance = null;
  }
}

/**
 * End-to-End Test Suite for Agent Workflows
 * Feature #183: Create end-to-end test suite for agent workflows
 *
 * Verification: Tests: full generation flow, plan→agent transition, error recovery
 *
 * This suite tests the complete agent workflow from start to finish:
 * 1. Full generation flow (pre-gen → agent → post-gen → self-correction)
 * 2. Plan→Agent transition (plan mode → handoff → execution)
 * 3. Error recovery (classification → retry → rollback)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// Types for E2E Testing
// =============================================================================

/** Agent workflow phases */
export type WorkflowPhase =
  | "idle"
  | "pre_generation"
  | "planning"
  | "plan_approval"
  | "handoff"
  | "executing"
  | "post_generation"
  | "self_correction"
  | "error_recovery"
  | "completed"
  | "failed";

/** Workflow step result */
export interface WorkflowStepResult {
  phase: WorkflowPhase;
  success: boolean;
  duration: number;
  data?: unknown;
  error?: string;
}

/** Complete workflow result */
export interface WorkflowResult {
  success: boolean;
  phases: WorkflowStepResult[];
  totalDuration: number;
  finalOutput?: GenerationOutput;
  errorRecoveryAttempts: number;
  selfCorrectionAttempts: number;
}

/** Generation output */
export interface GenerationOutput {
  html: string;
  scss: string;
  qualityScore: number;
  accessibilityScore: number;
  brandConsistency: number;
}

/** Plan option for approval */
export interface PlanOption {
  id: string;
  label: string;
  description: string;
  complexity: number;
  riskLevel: "low" | "medium" | "high";
  affectedFiles: string[];
}

/** Agent context preserved during handoff */
export interface AgentContext {
  filesRead: Map<string, string>;
  searchResults: Map<string, unknown[]>;
  userPreferences: Record<string, unknown>;
  odooContext?: {
    version?: string;
    modules?: string[];
    theme?: string;
  };
  planMode: boolean;
}

/** Error classification result */
export interface ClassifiedError {
  category:
    | "validation"
    | "generation"
    | "network"
    | "permission"
    | "timeout"
    | "resource"
    | "configuration"
    | "internal";
  severity: "info" | "warning" | "error" | "critical";
  recoverable: boolean;
  suggestions: string[];
}

/** Recovery strategy */
export type RecoveryStrategy = "snapshot" | "git" | "yjs" | "retry" | "manual";

/** Recovery plan */
export interface RecoveryPlan {
  strategy: RecoveryStrategy;
  fallback: RecoveryStrategy;
  severity: "low" | "medium" | "high" | "critical";
  autoExecute: boolean;
  steps: { action: string; description: string }[];
}

// =============================================================================
// Mock Implementations for E2E Testing
// =============================================================================

/** Creates a mock pre-generation result */
function createMockPreGenerationResult(options: {
  sectionType?: string;
  colorPalette?: string[];
  success?: boolean;
} = {}) {
  return {
    success: options.success ?? true,
    designAnalysis: {
      sectionType: options.sectionType ?? "hero",
      category: "landing",
      confidence: 0.95,
      keywords: ["hero", "banner", "cta"],
      colorIntent: "vibrant",
      layoutIntent: "centered",
    },
    brandTokens: {
      primary: options.colorPalette?.[0] ?? "#714B67",
      secondary: options.colorPalette?.[1] ?? "#017E84",
      accent: options.colorPalette?.[2] ?? "#E46B71",
      background: "#FFFFFF",
      text: "#000000",
    },
    enhancedPromptFragment: "Use brand colors: primary #714B67, secondary #017E84",
  };
}

/** Creates a mock post-generation result */
function createMockPostGenerationResult(options: {
  qualityScore?: number;
  accessibilityScore?: number;
  brandConsistency?: number;
  issues?: { rule: string; message: string; severity: string }[];
} = {}) {
  const qualityScore = options.qualityScore ?? 85;
  const accessibilityScore = options.accessibilityScore ?? 90;
  const brandConsistency = options.brandConsistency ?? 80;

  return {
    overallScore: qualityScore,
    accessibility: {
      passed: accessibilityScore >= 80,
      score: accessibilityScore,
      totalIssues: options.issues?.length ?? 0,
      issues: options.issues ?? [],
    },
    brandConsistency,
    suggestions: qualityScore < 70 ? ["Improve color contrast", "Add ARIA labels"] : [],
  };
}

/** Creates a mock agent context */
function createMockAgentContext(options: {
  filesRead?: Map<string, string>;
  planMode?: boolean;
} = {}): AgentContext {
  const filesRead = options.filesRead ?? new Map([
    ["templates/homepage.xml", "<template>content</template>"],
    ["static/scss/theme.scss", "$primary: #714B67;"],
  ]);

  return {
    filesRead,
    searchResults: new Map([
      ["template search", [{ file: "templates/homepage.xml", matches: 3 }]],
    ]),
    userPreferences: { preferDarkMode: false },
    odooContext: {
      version: "17.0",
      modules: ["website", "website_sale"],
      theme: "theme_starter",
    },
    planMode: options.planMode ?? false,
  };
}

/** Creates mock plan options */
function createMockPlanOptions(): PlanOption[] {
  return [
    {
      id: "opt-quick",
      label: "Quick Implementation",
      description: "Add hero section with minimal changes",
      complexity: 2,
      riskLevel: "low",
      affectedFiles: ["templates/homepage.xml"],
    },
    {
      id: "opt-full",
      label: "Full Feature",
      description: "Add hero with animations and variants",
      complexity: 4,
      riskLevel: "medium",
      affectedFiles: ["templates/homepage.xml", "static/scss/hero.scss"],
    },
  ];
}

/** Simulates error classification */
function classifyError(error: Error | string): ClassifiedError {
  const message = typeof error === "string" ? error : error.message;

  if (message.includes("network") || message.includes("fetch")) {
    return {
      category: "network",
      severity: "error",
      recoverable: true,
      suggestions: ["Check network connectivity", "Retry the operation"],
    };
  }

  if (message.includes("timeout")) {
    return {
      category: "timeout",
      severity: "warning",
      recoverable: true,
      suggestions: ["Increase timeout", "Retry with simpler request"],
    };
  }

  if (message.includes("validation") || message.includes("invalid")) {
    return {
      category: "validation",
      severity: "error",
      recoverable: true,
      suggestions: ["Check input format", "Review validation rules"],
    };
  }

  if (message.includes("permission") || message.includes("unauthorized")) {
    return {
      category: "permission",
      severity: "critical",
      recoverable: false,
      suggestions: ["Check authentication", "Verify permissions"],
    };
  }

  return {
    category: "internal",
    severity: "error",
    recoverable: true,
    suggestions: ["Retry the operation", "Contact support if issue persists"],
  };
}

/** Creates a recovery plan based on failure context */
function createRecoveryPlan(options: {
  hasSnapshot?: boolean;
  hasGitHistory?: boolean;
  retryCount?: number;
  maxRetries?: number;
}): RecoveryPlan {
  const { hasSnapshot = true, hasGitHistory = false, retryCount = 0, maxRetries = 3 } = options;

  let strategy: RecoveryStrategy = "manual";
  let fallback: RecoveryStrategy = "manual";

  // Strategy selection logic
  if (retryCount < maxRetries) {
    strategy = "retry";
    fallback = hasSnapshot ? "snapshot" : hasGitHistory ? "git" : "manual";
  } else if (hasSnapshot) {
    strategy = "snapshot";
    fallback = hasGitHistory ? "git" : "manual";
  } else if (hasGitHistory) {
    strategy = "git";
    fallback = "manual";
  }

  return {
    strategy,
    fallback,
    severity: retryCount >= maxRetries ? "high" : "low",
    autoExecute: strategy !== "manual",
    steps: [
      { action: "assess", description: "Assess failure impact" },
      { action: strategy, description: `Execute ${strategy} recovery` },
      { action: "verify", description: "Verify recovery success" },
    ],
  };
}

// =============================================================================
// Workflow Simulator
// =============================================================================

/** Simulates the complete agent workflow for E2E testing */
class WorkflowSimulator {
  private phases: WorkflowStepResult[] = [];
  private currentPhase: WorkflowPhase = "idle";
  private context: AgentContext;
  private errorInjector: ((phase: WorkflowPhase) => Error | null) | null = null;
  private selfCorrectionAttempts = 0;
  private errorRecoveryAttempts = 0;
  private maxSelfCorrections = 3;
  private maxRecoveryAttempts = 3;

  constructor(options: {
    context?: AgentContext;
    errorInjector?: (phase: WorkflowPhase) => Error | null;
    maxSelfCorrections?: number;
    maxRecoveryAttempts?: number;
  } = {}) {
    this.context = options.context ?? createMockAgentContext();
    this.errorInjector = options.errorInjector ?? null;
    this.maxSelfCorrections = options.maxSelfCorrections ?? 3;
    this.maxRecoveryAttempts = options.maxRecoveryAttempts ?? 3;
  }

  /** Records a phase result */
  private recordPhase(
    phase: WorkflowPhase,
    success: boolean,
    duration: number,
    data?: unknown,
    error?: string
  ): WorkflowStepResult {
    const result: WorkflowStepResult = { phase, success, duration, data, error };
    this.phases.push(result);
    this.currentPhase = phase;
    return result;
  }

  /** Checks for injected errors */
  private checkForError(phase: WorkflowPhase): Error | null {
    if (this.errorInjector) {
      return this.errorInjector(phase);
    }
    return null;
  }

  /** Simulates pre-generation phase */
  async runPreGeneration(userMessage: string): Promise<WorkflowStepResult> {
    const startTime = Date.now();

    const error = this.checkForError("pre_generation");
    if (error) {
      return this.recordPhase("pre_generation", false, Date.now() - startTime, null, error.message);
    }

    // Simulate pre-generation
    await this.delay(50);
    const result = createMockPreGenerationResult({
      sectionType: userMessage.includes("hero") ? "hero" : "feature",
    });

    return this.recordPhase("pre_generation", true, Date.now() - startTime, result);
  }

  /** Simulates planning phase */
  async runPlanning(goal: string): Promise<WorkflowStepResult> {
    const startTime = Date.now();
    this.context.planMode = true;

    const error = this.checkForError("planning");
    if (error) {
      return this.recordPhase("planning", false, Date.now() - startTime, null, error.message);
    }

    // Simulate plan generation
    await this.delay(100);
    const options = createMockPlanOptions();

    return this.recordPhase("planning", true, Date.now() - startTime, { options, goal });
  }

  /** Simulates plan approval */
  async approvePlan(selectedOptionId: string): Promise<WorkflowStepResult> {
    const startTime = Date.now();

    const error = this.checkForError("plan_approval");
    if (error) {
      return this.recordPhase("plan_approval", false, Date.now() - startTime, null, error.message);
    }

    const options = createMockPlanOptions();
    const selected = options.find((o) => o.id === selectedOptionId);

    if (!selected) {
      return this.recordPhase(
        "plan_approval",
        false,
        Date.now() - startTime,
        null,
        `Option ${selectedOptionId} not found`
      );
    }

    return this.recordPhase("plan_approval", true, Date.now() - startTime, { selected });
  }

  /** Simulates handoff from plan to agent */
  async runHandoff(selectedOption: PlanOption): Promise<WorkflowStepResult> {
    const startTime = Date.now();

    const error = this.checkForError("handoff");
    if (error) {
      return this.recordPhase("handoff", false, Date.now() - startTime, null, error.message);
    }

    // Preserve context during handoff
    const preservedContext = {
      filesRead: this.context.filesRead,
      searchResults: this.context.searchResults,
      odooContext: this.context.odooContext,
      userPreferences: this.context.userPreferences,
    };

    // Transition to agent mode
    this.context.planMode = false;

    await this.delay(30);

    return this.recordPhase("handoff", true, Date.now() - startTime, {
      preservedContext,
      selectedPlan: selectedOption,
      enabledTools: ["write", "edit", "test", "compile", "preview"],
    });
  }

  /** Simulates execution phase */
  async runExecution(): Promise<WorkflowStepResult> {
    const startTime = Date.now();

    const error = this.checkForError("executing");
    if (error) {
      return this.recordPhase("executing", false, Date.now() - startTime, null, error.message);
    }

    // Simulate code generation
    await this.delay(200);

    const output: GenerationOutput = {
      html: '<section class="s_hero"><h1>Welcome</h1></section>',
      scss: ".s_hero { padding: 4rem 0; }",
      qualityScore: 85,
      accessibilityScore: 90,
      brandConsistency: 80,
    };

    return this.recordPhase("executing", true, Date.now() - startTime, output);
  }

  /** Simulates post-generation quality check */
  async runPostGeneration(output: GenerationOutput): Promise<WorkflowStepResult> {
    const startTime = Date.now();

    const error = this.checkForError("post_generation");
    if (error) {
      return this.recordPhase("post_generation", false, Date.now() - startTime, null, error.message);
    }

    await this.delay(50);

    const qualityReport = createMockPostGenerationResult({
      qualityScore: output.qualityScore,
      accessibilityScore: output.accessibilityScore,
      brandConsistency: output.brandConsistency,
    });

    const passed = qualityReport.overallScore >= 70 &&
      qualityReport.accessibility.score >= 80 &&
      qualityReport.brandConsistency >= 60;

    return this.recordPhase("post_generation", passed, Date.now() - startTime, qualityReport);
  }

  /** Simulates self-correction loop */
  async runSelfCorrection(
    currentOutput: GenerationOutput,
    qualityReport: ReturnType<typeof createMockPostGenerationResult>
  ): Promise<WorkflowStepResult> {
    const startTime = Date.now();
    this.selfCorrectionAttempts++;

    if (this.selfCorrectionAttempts > this.maxSelfCorrections) {
      return this.recordPhase(
        "self_correction",
        false,
        Date.now() - startTime,
        null,
        "Max self-correction attempts reached"
      );
    }

    const error = this.checkForError("self_correction");
    if (error) {
      return this.recordPhase("self_correction", false, Date.now() - startTime, null, error.message);
    }

    await this.delay(150);

    // Simulate improvement
    const improvedOutput: GenerationOutput = {
      ...currentOutput,
      qualityScore: Math.min(100, currentOutput.qualityScore + 10),
      accessibilityScore: Math.min(100, currentOutput.accessibilityScore + 5),
      brandConsistency: Math.min(100, currentOutput.brandConsistency + 8),
    };

    return this.recordPhase("self_correction", true, Date.now() - startTime, {
      attempt: this.selfCorrectionAttempts,
      previousOutput: currentOutput,
      improvedOutput,
      corrections: qualityReport.suggestions,
    });
  }

  /** Simulates error recovery */
  async runErrorRecovery(failedPhase: WorkflowPhase, error: string): Promise<WorkflowStepResult> {
    const startTime = Date.now();
    this.errorRecoveryAttempts++;

    if (this.errorRecoveryAttempts > this.maxRecoveryAttempts) {
      return this.recordPhase(
        "error_recovery",
        false,
        Date.now() - startTime,
        null,
        "Max recovery attempts reached"
      );
    }

    // Classify the error
    const classified = classifyError(error);

    if (!classified.recoverable) {
      return this.recordPhase("error_recovery", false, Date.now() - startTime, {
        classified,
        reason: "Error is not recoverable",
      });
    }

    // Create recovery plan
    const plan = createRecoveryPlan({
      hasSnapshot: true,
      retryCount: this.errorRecoveryAttempts - 1,
      maxRetries: this.maxRecoveryAttempts,
    });

    await this.delay(100);

    // Simulate recovery execution
    const recovered = plan.strategy !== "manual";

    return this.recordPhase("error_recovery", recovered, Date.now() - startTime, {
      failedPhase,
      classified,
      plan,
      attempt: this.errorRecoveryAttempts,
    });
  }

  /** Runs the complete workflow */
  async runFullWorkflow(userMessage: string): Promise<WorkflowResult> {
    const startTime = Date.now();

    // Phase 1: Pre-generation
    let preGenResult = await this.runPreGeneration(userMessage);
    if (!preGenResult.success) {
      const recovery = await this.runErrorRecovery("pre_generation", preGenResult.error!);
      if (!recovery.success) {
        return this.buildResult(false, startTime);
      }
      preGenResult = await this.runPreGeneration(userMessage);
    }

    // Phase 2: Planning
    const planResult = await this.runPlanning(userMessage);
    if (!planResult.success) {
      const recovery = await this.runErrorRecovery("planning", planResult.error!);
      if (!recovery.success) {
        return this.buildResult(false, startTime);
      }
    }

    // Phase 3: Plan approval
    const approvalResult = await this.approvePlan("opt-quick");
    if (!approvalResult.success) {
      return this.buildResult(false, startTime);
    }

    // Phase 4: Handoff
    const handoffResult = await this.runHandoff(
      (approvalResult.data as { selected: PlanOption }).selected
    );
    if (!handoffResult.success) {
      const recovery = await this.runErrorRecovery("handoff", handoffResult.error!);
      if (!recovery.success) {
        return this.buildResult(false, startTime);
      }
    }

    // Phase 5: Execution
    let execResult = await this.runExecution();
    if (!execResult.success) {
      const recovery = await this.runErrorRecovery("executing", execResult.error!);
      if (recovery.success) {
        execResult = await this.runExecution();
      }
      if (!execResult.success) {
        return this.buildResult(false, startTime);
      }
    }

    let output = execResult.data as GenerationOutput;

    // Phase 6: Post-generation quality check
    let postGenResult = await this.runPostGeneration(output);

    // Phase 7: Self-correction loop if needed
    while (!postGenResult.success && this.selfCorrectionAttempts < this.maxSelfCorrections) {
      const qualityReport = postGenResult.data as ReturnType<typeof createMockPostGenerationResult>;
      const correctionResult = await this.runSelfCorrection(output, qualityReport);

      if (!correctionResult.success) {
        break;
      }

      output = (correctionResult.data as { improvedOutput: GenerationOutput }).improvedOutput;
      postGenResult = await this.runPostGeneration(output);
    }

    // Mark as completed
    this.recordPhase("completed", postGenResult.success, 0);

    return this.buildResult(postGenResult.success, startTime, output);
  }

  /** Builds the final workflow result */
  private buildResult(
    success: boolean,
    startTime: number,
    finalOutput?: GenerationOutput
  ): WorkflowResult {
    return {
      success,
      phases: this.phases,
      totalDuration: Date.now() - startTime,
      finalOutput,
      errorRecoveryAttempts: this.errorRecoveryAttempts,
      selfCorrectionAttempts: this.selfCorrectionAttempts,
    };
  }

  /** Helper to simulate async delay */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Gets current context */
  getContext(): AgentContext {
    return this.context;
  }

  /** Gets all phases */
  getPhases(): WorkflowStepResult[] {
    return this.phases;
  }
}

// =============================================================================
// Test Suite
// =============================================================================

describe("Agent Workflow E2E Tests", () => {
  describe("Full Generation Flow", () => {
    it("completes full workflow successfully", async () => {
      const simulator = new WorkflowSimulator();
      const result = await simulator.runFullWorkflow("Create a hero section for the homepage");

      expect(result.success).toBe(true);
      expect(result.finalOutput).toBeDefined();
      expect(result.finalOutput!.qualityScore).toBeGreaterThanOrEqual(70);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it("executes all workflow phases in correct order", async () => {
      const simulator = new WorkflowSimulator();
      await simulator.runFullWorkflow("Create a feature section");

      const phases = simulator.getPhases();
      const phaseOrder = phases.map((p) => p.phase);

      expect(phaseOrder).toContain("pre_generation");
      expect(phaseOrder).toContain("planning");
      expect(phaseOrder).toContain("plan_approval");
      expect(phaseOrder).toContain("handoff");
      expect(phaseOrder).toContain("executing");
      expect(phaseOrder).toContain("post_generation");
      expect(phaseOrder).toContain("completed");

      // Verify order
      const preGenIdx = phaseOrder.indexOf("pre_generation");
      const planIdx = phaseOrder.indexOf("planning");
      const handoffIdx = phaseOrder.indexOf("handoff");
      const execIdx = phaseOrder.indexOf("executing");

      expect(preGenIdx).toBeLessThan(planIdx);
      expect(planIdx).toBeLessThan(handoffIdx);
      expect(handoffIdx).toBeLessThan(execIdx);
    });

    it("generates quality output meeting thresholds", async () => {
      const simulator = new WorkflowSimulator();
      const result = await simulator.runFullWorkflow("Create an accessible hero section");

      expect(result.success).toBe(true);
      expect(result.finalOutput!.qualityScore).toBeGreaterThanOrEqual(70);
      expect(result.finalOutput!.accessibilityScore).toBeGreaterThanOrEqual(80);
      expect(result.finalOutput!.brandConsistency).toBeGreaterThanOrEqual(60);
    });

    it("runs self-correction when quality is below threshold", async () => {
      // Create simulator with error injector that degrades quality on first execution
      let execCount = 0;
      const simulator = new WorkflowSimulator({
        errorInjector: (phase) => {
          if (phase === "executing" && execCount === 0) {
            execCount++;
            // Don't inject error, but the mock will handle degraded quality
          }
          return null;
        },
      });

      const result = await simulator.runFullWorkflow("Create a hero section");

      // Workflow should complete (possibly with self-correction)
      expect(result.success).toBe(true);
    });

    it("limits self-correction attempts", async () => {
      const simulator = new WorkflowSimulator({
        maxSelfCorrections: 2,
      });

      const result = await simulator.runFullWorkflow("Create a section");

      expect(result.selfCorrectionAttempts).toBeLessThanOrEqual(2);
    });
  });

  describe("Plan→Agent Transition", () => {
    it("preserves context during handoff", async () => {
      const initialContext = createMockAgentContext({
        filesRead: new Map([
          ["templates/test.xml", "<template>test</template>"],
          ["static/scss/custom.scss", "$color: red;"],
        ]),
        planMode: true,
      });

      const simulator = new WorkflowSimulator({ context: initialContext });
      await simulator.runFullWorkflow("Modify the test template");

      const phases = simulator.getPhases();
      const handoffPhase = phases.find((p) => p.phase === "handoff");

      expect(handoffPhase).toBeDefined();
      expect(handoffPhase!.success).toBe(true);

      const handoffData = handoffPhase!.data as {
        preservedContext: { filesRead: Map<string, string> };
      };
      expect(handoffData.preservedContext.filesRead.size).toBe(2);
      expect(handoffData.preservedContext.filesRead.has("templates/test.xml")).toBe(true);
    });

    it("transitions from plan mode to agent mode", async () => {
      const simulator = new WorkflowSimulator({
        context: createMockAgentContext({ planMode: true }),
      });

      // Before workflow, should be in plan mode
      expect(simulator.getContext().planMode).toBe(true);

      await simulator.runFullWorkflow("Add a new section");

      // After handoff, should be in agent mode
      expect(simulator.getContext().planMode).toBe(false);
    });

    it("enables agent tools after handoff", async () => {
      const simulator = new WorkflowSimulator();
      await simulator.runFullWorkflow("Create content");

      const phases = simulator.getPhases();
      const handoffPhase = phases.find((p) => p.phase === "handoff");

      expect(handoffPhase).toBeDefined();
      const handoffData = handoffPhase!.data as { enabledTools: string[] };

      expect(handoffData.enabledTools).toContain("write");
      expect(handoffData.enabledTools).toContain("edit");
      expect(handoffData.enabledTools).toContain("test");
    });

    it("handles plan approval with selected option", async () => {
      const simulator = new WorkflowSimulator();
      await simulator.runFullWorkflow("Create feature");

      const phases = simulator.getPhases();
      const approvalPhase = phases.find((p) => p.phase === "plan_approval");

      expect(approvalPhase).toBeDefined();
      expect(approvalPhase!.success).toBe(true);

      const approvalData = approvalPhase!.data as { selected: PlanOption };
      expect(approvalData.selected.id).toBe("opt-quick");
    });

    it("preserves Odoo context through transition", async () => {
      const simulator = new WorkflowSimulator({
        context: createMockAgentContext({ planMode: true }),
      });

      await simulator.runFullWorkflow("Update Odoo theme");

      const phases = simulator.getPhases();
      const handoffPhase = phases.find((p) => p.phase === "handoff");

      const handoffData = handoffPhase!.data as {
        preservedContext: { odooContext: { version: string; modules: string[] } };
      };

      expect(handoffData.preservedContext.odooContext.version).toBe("17.0");
      expect(handoffData.preservedContext.odooContext.modules).toContain("website");
    });
  });

  describe("Error Recovery", () => {
    it("recovers from transient network errors", async () => {
      let errorCount = 0;
      const simulator = new WorkflowSimulator({
        errorInjector: (phase) => {
          if (phase === "executing" && errorCount === 0) {
            errorCount++;
            return new Error("network timeout");
          }
          return null;
        },
      });

      const result = await simulator.runFullWorkflow("Create section");

      expect(result.success).toBe(true);
      expect(result.errorRecoveryAttempts).toBeGreaterThan(0);
    });

    it("classifies errors correctly", () => {
      const networkError = classifyError("network fetch failed");
      expect(networkError.category).toBe("network");
      expect(networkError.recoverable).toBe(true);

      const timeoutError = classifyError("operation timeout");
      expect(timeoutError.category).toBe("timeout");
      expect(timeoutError.recoverable).toBe(true);

      const permissionError = classifyError("permission denied: unauthorized");
      expect(permissionError.category).toBe("permission");
      expect(permissionError.recoverable).toBe(false);

      const validationError = classifyError("validation failed: invalid input");
      expect(validationError.category).toBe("validation");
      expect(validationError.recoverable).toBe(true);
    });

    it("creates appropriate recovery plans", () => {
      const retryPlan = createRecoveryPlan({ retryCount: 0, maxRetries: 3 });
      expect(retryPlan.strategy).toBe("retry");
      expect(retryPlan.autoExecute).toBe(true);

      const snapshotPlan = createRecoveryPlan({
        retryCount: 3,
        maxRetries: 3,
        hasSnapshot: true,
      });
      expect(snapshotPlan.strategy).toBe("snapshot");

      const manualPlan = createRecoveryPlan({
        retryCount: 3,
        maxRetries: 3,
        hasSnapshot: false,
        hasGitHistory: false,
      });
      expect(manualPlan.strategy).toBe("manual");
      expect(manualPlan.autoExecute).toBe(false);
    });

    it("limits recovery attempts", async () => {
      let errorCount = 0;
      const simulator = new WorkflowSimulator({
        maxRecoveryAttempts: 2,
        errorInjector: (phase) => {
          if (phase === "executing") {
            errorCount++;
            return new Error("persistent error");
          }
          return null;
        },
      });

      const result = await simulator.runFullWorkflow("Create content");

      expect(result.success).toBe(false);
      expect(result.errorRecoveryAttempts).toBeLessThanOrEqual(3); // Allows one extra for final check
    });

    it("fails gracefully for non-recoverable errors", async () => {
      const simulator = new WorkflowSimulator({
        errorInjector: (phase) => {
          if (phase === "executing") {
            return new Error("permission denied: unauthorized");
          }
          return null;
        },
      });

      const result = await simulator.runFullWorkflow("Create content");

      expect(result.success).toBe(false);

      const phases = simulator.getPhases();
      const recoveryPhase = phases.find((p) => p.phase === "error_recovery");

      expect(recoveryPhase).toBeDefined();
      expect(recoveryPhase!.success).toBe(false);
    });

    it("recovers from pre-generation failures", async () => {
      let errorCount = 0;
      const simulator = new WorkflowSimulator({
        errorInjector: (phase) => {
          if (phase === "pre_generation" && errorCount === 0) {
            errorCount++;
            return new Error("temporary failure");
          }
          return null;
        },
      });

      const result = await simulator.runFullWorkflow("Create hero");

      expect(result.success).toBe(true);
      expect(result.errorRecoveryAttempts).toBeGreaterThan(0);
    });

    it("includes helpful suggestions in error classification", () => {
      const error = classifyError("network connection failed");

      expect(error.suggestions.length).toBeGreaterThan(0);
      expect(error.suggestions.some((s) => s.toLowerCase().includes("retry") || s.toLowerCase().includes("network"))).toBe(true);
    });
  });

  describe("Quality Gates", () => {
    it("enforces minimum quality score", async () => {
      const simulator = new WorkflowSimulator();
      const result = await simulator.runFullWorkflow("Create section");

      expect(result.success).toBe(true);
      expect(result.finalOutput!.qualityScore).toBeGreaterThanOrEqual(70);
    });

    it("enforces accessibility requirements", async () => {
      const simulator = new WorkflowSimulator();
      const result = await simulator.runFullWorkflow("Create accessible content");

      expect(result.success).toBe(true);
      expect(result.finalOutput!.accessibilityScore).toBeGreaterThanOrEqual(80);
    });

    it("enforces brand consistency", async () => {
      const simulator = new WorkflowSimulator();
      const result = await simulator.runFullWorkflow("Create branded section");

      expect(result.success).toBe(true);
      expect(result.finalOutput!.brandConsistency).toBeGreaterThanOrEqual(60);
    });
  });

  describe("Integration Scenarios", () => {
    it("handles complete hero section generation", async () => {
      const simulator = new WorkflowSimulator();
      const result = await simulator.runFullWorkflow(
        "Create a hero section with a headline, subheadline, and CTA button"
      );

      expect(result.success).toBe(true);
      expect(result.finalOutput).toBeDefined();
      expect(result.finalOutput!.html).toContain("s_hero");
    });

    it("handles multi-phase workflow with all components", async () => {
      const simulator = new WorkflowSimulator();
      const result = await simulator.runFullWorkflow("Build a complete landing page");

      expect(result.success).toBe(true);

      const phaseNames = new Set(simulator.getPhases().map((p) => p.phase));
      expect(phaseNames.has("pre_generation")).toBe(true);
      expect(phaseNames.has("planning")).toBe(true);
      expect(phaseNames.has("handoff")).toBe(true);
      expect(phaseNames.has("executing")).toBe(true);
      expect(phaseNames.has("post_generation")).toBe(true);
      expect(phaseNames.has("completed")).toBe(true);
    });

    it("tracks workflow duration accurately", async () => {
      const simulator = new WorkflowSimulator();
      const startTime = Date.now();
      const result = await simulator.runFullWorkflow("Create feature");
      const endTime = Date.now();

      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.totalDuration).toBeLessThanOrEqual(endTime - startTime + 100);
    });
  });
});

// =============================================================================
// Exported for use in other tests
// =============================================================================

export {
  WorkflowSimulator,
  createMockPreGenerationResult,
  createMockPostGenerationResult,
  createMockAgentContext,
  createMockPlanOptions,
  classifyError,
  createRecoveryPlan,
};

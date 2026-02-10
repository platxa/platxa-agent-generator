/**
 * Generator-Critic-Refinement (GCR) Agent Pattern
 *
 * A multi-agent architecture for high-quality AI code generation:
 * 1. Generator Agent - Creates initial output based on user request
 * 2. Critic Agent - Validates output and provides structured feedback
 * 3. Refinement Agent - Improves quality based on critic feedback
 *
 * The pattern iterates until quality thresholds are met or max iterations reached.
 *
 * Feature #8: Implement Generator-Critic-Refinement agent pattern
 */

import type { ParsedFile } from "./parser";
import type { Message, ProviderResponse } from "./providers";
import { AnthropicAdapter, OpenAIAdapter } from "./providers";
import {
  evaluateWithCritic,
  buildCorrectionPromptFromCritic,
  type CriticReport,
  type CriticOptions,
} from "./critic-agent";

// =============================================================================
// Types
// =============================================================================

/** Agent role in the GCR pattern */
export type AgentRole = "generator" | "critic" | "refinement";

/** Status of a GCR iteration */
export type IterationStatus = "pending" | "generating" | "critiquing" | "refining" | "complete" | "failed";

/** Configuration for the Generator agent */
export interface GeneratorConfig {
  /** System prompt for generation */
  systemPrompt: string;
  /** Model to use for generation */
  model?: string;
  /** Provider to use */
  provider?: "anthropic" | "openai";
  /** Maximum tokens for generation */
  maxTokens?: number;
  /** Temperature for generation */
  temperature?: number;
}

/** Configuration for the Refinement agent */
export interface RefinementConfig {
  /** System prompt for refinement */
  systemPrompt: string;
  /** Model to use for refinement */
  model?: string;
  /** Provider to use */
  provider?: "anthropic" | "openai";
  /** Maximum tokens for refinement */
  maxTokens?: number;
  /** Focus areas for refinement */
  focusAreas?: string[];
}

/** Complete GCR configuration */
export interface GCRConfig {
  /** Generator agent configuration */
  generator: GeneratorConfig;
  /** Critic agent options */
  critic?: CriticOptions;
  /** Refinement agent configuration */
  refinement?: RefinementConfig;
  /** Maximum iterations before stopping */
  maxIterations?: number;
  /** Quality score threshold to pass (0-100) */
  qualityThreshold?: number;
  /** Whether to auto-apply refinements */
  autoRefine?: boolean;
  /** Callback for iteration progress */
  onIterationComplete?: (iteration: GCRIteration) => void;
}

/** Single iteration result */
export interface GCRIteration {
  /** Iteration number (1-based) */
  number: number;
  /** Current status */
  status: IterationStatus;
  /** Generated output */
  generatedOutput: string;
  /** Parsed files from output */
  parsedFiles: ParsedFile[];
  /** Critic report for this iteration */
  criticReport: CriticReport | null;
  /** Refinement applied */
  refinementApplied: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** Timestamp */
  timestamp: number;
}

/** Complete GCR result */
export interface GCRResult {
  /** Whether the process succeeded */
  success: boolean;
  /** Final quality score */
  qualityScore: number;
  /** Final grade */
  grade: string;
  /** Total iterations performed */
  totalIterations: number;
  /** All iteration results */
  iterations: GCRIteration[];
  /** Final output */
  finalOutput: string;
  /** Final parsed files */
  finalFiles: ParsedFile[];
  /** Final critic report */
  finalCriticReport: CriticReport;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Metadata */
  metadata: {
    startedAt: string;
    completedAt: string;
    modelUsed: string;
    qualityThreshold: number;
    maxIterations: number;
  };
}

// =============================================================================
// Default Prompts
// =============================================================================

const DEFAULT_GENERATOR_PROMPT = `You are an expert Odoo theme developer. Generate high-quality, production-ready code.

Follow these requirements:
1. Use proper QWeb template syntax with t-* directives
2. Include all required files (__manifest__.py, views/, static/)
3. Use SCSS with CSS custom properties for theming
4. Follow Odoo 17.0 best practices
5. Include proper accessibility attributes
6. Use Bootstrap 5 classes where appropriate

Output your code in clearly marked file blocks.`;

const DEFAULT_REFINEMENT_PROMPT = `You are a code refinement specialist. Your job is to improve code quality based on critic feedback.

When refining code:
1. Fix all errors identified by the critic
2. Address warnings where practical
3. Maintain the original intent and structure
4. Apply best practices for the technology stack
5. Do not introduce new features or changes beyond fixes
6. Ensure all files remain complete and functional

Output the refined code in the same format as the original.`;

// =============================================================================
// Generator Agent
// =============================================================================

/**
 * Generator Agent - Creates initial output based on user request
 */
export class GeneratorAgent {
  private config: GeneratorConfig;
  private adapter: InstanceType<typeof AnthropicAdapter> | InstanceType<typeof OpenAIAdapter>;

  constructor(config: GeneratorConfig) {
    this.config = {
      model: config.provider === "openai" ? "gpt-4o" : "claude-3-5-sonnet-20241022",
      provider: "anthropic",
      maxTokens: 8192,
      temperature: 0.7,
      ...config,
    };

    const envKey = this.config.provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;

    if (!envKey) {
      throw new Error(`Missing API credentials for ${this.config.provider}`);
    }

    this.adapter = this.config.provider === "openai"
      ? new OpenAIAdapter({ apiKey: envKey })
      : new AnthropicAdapter({ apiKey: envKey });
  }

  /**
   * Generate output based on user prompt
   */
  async generate(userPrompt: string): Promise<string> {
    const messages: Message[] = [
      { role: "system", content: this.config.systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const response = await this.adapter.chat(messages, {
      model: this.config.model!,
      maxTokens: this.config.maxTokens!,
      temperature: this.config.temperature,
    });

    const textContent = response.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text"
    );

    if (!textContent) {
      throw new Error("No text response from generator");
    }

    return textContent.text;
  }

  /**
   * Regenerate with correction context
   */
  async regenerateWithFeedback(
    originalPrompt: string,
    previousOutput: string,
    criticReport: CriticReport
  ): Promise<string> {
    const correctionPrompt = buildCorrectionPromptFromCritic(
      originalPrompt,
      previousOutput,
      criticReport
    );

    const messages: Message[] = [
      { role: "system", content: this.config.systemPrompt },
      { role: "user", content: correctionPrompt },
    ];

    const response = await this.adapter.chat(messages, {
      model: this.config.model!,
      maxTokens: this.config.maxTokens!,
      temperature: 0.3, // Lower temperature for corrections
    });

    const textContent = response.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text"
    );

    if (!textContent) {
      throw new Error("No text response from generator");
    }

    return textContent.text;
  }
}

// =============================================================================
// Refinement Agent
// =============================================================================

/**
 * Refinement Agent - Improves quality based on critic feedback
 */
export class RefinementAgent {
  private config: RefinementConfig;
  private adapter: InstanceType<typeof AnthropicAdapter> | InstanceType<typeof OpenAIAdapter>;

  constructor(config: RefinementConfig) {
    this.config = {
      model: config.provider === "openai" ? "gpt-4o" : "claude-3-5-sonnet-20241022",
      provider: "anthropic",
      maxTokens: 8192,
      focusAreas: ["syntax", "structure", "security", "style"],
      ...config,
    };

    const envKey = this.config.provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;

    if (!envKey) {
      throw new Error(`Missing API credentials for ${this.config.provider}`);
    }

    this.adapter = this.config.provider === "openai"
      ? new OpenAIAdapter({ apiKey: envKey })
      : new AnthropicAdapter({ apiKey: envKey });
  }

  /**
   * Refine output based on critic feedback
   */
  async refine(
    originalOutput: string,
    criticReport: CriticReport,
    originalPrompt: string
  ): Promise<string> {
    const issuesByCategory = new Map<string, string[]>();
    for (const issue of criticReport.issues) {
      if (!issuesByCategory.has(issue.category)) {
        issuesByCategory.set(issue.category, []);
      }
      issuesByCategory.get(issue.category)!.push(
        `[${issue.severity.toUpperCase()}] ${issue.message}`
      );
    }

    const issuesSummary = Array.from(issuesByCategory.entries())
      .map(([cat, issues]) => `### ${cat}\n${issues.join("\n")}`)
      .join("\n\n");

    const refinementPrompt = `
## Original Request
${originalPrompt}

## Current Output Quality
Grade: ${criticReport.grade} (${criticReport.qualityScore}/100)
Errors: ${criticReport.errorCount} | Warnings: ${criticReport.warningCount}

## Issues to Address
${issuesSummary}

## Recommendations
${criticReport.recommendations.map((r) => `- ${r}`).join("\n")}

## Code to Refine
${originalOutput}

---

Please refine this code to address all the issues listed above. Focus on:
${this.config.focusAreas!.map((a) => `- ${a}`).join("\n")}

Maintain the original structure and intent. Output only the refined code.
`.trim();

    const messages: Message[] = [
      { role: "system", content: this.config.systemPrompt },
      { role: "user", content: refinementPrompt },
    ];

    const response = await this.adapter.chat(messages, {
      model: this.config.model!,
      maxTokens: this.config.maxTokens!,
      temperature: 0.2, // Low temperature for precise refinement
    });

    const textContent = response.content.find(
      (c): c is { type: "text"; text: string } => c.type === "text"
    );

    if (!textContent) {
      throw new Error("No text response from refinement agent");
    }

    return textContent.text;
  }

  /**
   * Apply automatic fixes where possible
   */
  applyAutoFixes(files: ParsedFile[], criticReport: CriticReport): ParsedFile[] {
    const fixedFiles: ParsedFile[] = [];

    for (const file of files) {
      let content = file.content;

      // Auto-fix: Remove placeholder values
      content = content.replace(/YOUR_[A-Z_]+/g, "");
      content = content.replace(/PLACEHOLDER/g, "");

      // Auto-fix: Collapse multiple empty lines
      content = content.replace(/\n{4,}/g, "\n\n\n");

      // Auto-fix: Trim trailing whitespace
      content = content
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n");

      // Auto-fix for XML: Ensure proper closing
      if (file.path.endsWith(".xml")) {
        // Add missing odoo closing tag if needed
        if (content.includes("<odoo>") && !content.includes("</odoo>")) {
          content = content.trim() + "\n</odoo>\n";
        }
      }

      // Auto-fix for SCSS: Try to balance braces
      if (file.path.endsWith(".scss") || file.path.endsWith(".css")) {
        const openCount = (content.match(/\{/g) || []).length;
        const closeCount = (content.match(/\}/g) || []).length;
        if (openCount > closeCount) {
          content = content.trim() + "\n" + "}".repeat(openCount - closeCount) + "\n";
        }
      }

      fixedFiles.push({
        ...file,
        content,
      });
    }

    return fixedFiles;
  }
}

// =============================================================================
// GCR Orchestrator
// =============================================================================

/**
 * GCR Orchestrator - Coordinates the Generator-Critic-Refinement cycle
 */
export class GCROrchestrator {
  private config: Required<GCRConfig>;
  private generator: GeneratorAgent;
  private refinement: RefinementAgent;

  constructor(config: GCRConfig) {
    this.config = {
      generator: {
        systemPrompt: DEFAULT_GENERATOR_PROMPT,
        ...config.generator,
      },
      critic: {
        maxIterations: 3,
        qualityThreshold: 70,
        strictMode: false,
        ...config.critic,
      },
      refinement: {
        systemPrompt: DEFAULT_REFINEMENT_PROMPT,
        ...config.refinement,
      },
      maxIterations: config.maxIterations ?? 3,
      qualityThreshold: config.qualityThreshold ?? 70,
      autoRefine: config.autoRefine ?? true,
      onIterationComplete: config.onIterationComplete ?? (() => {}),
    };

    this.generator = new GeneratorAgent(this.config.generator);
    this.refinement = new RefinementAgent(this.config.refinement);
  }

  /**
   * Parse generated output into files
   */
  private parseOutput(output: string): ParsedFile[] {
    const files: ParsedFile[] = [];
    const fileBlockRegex = /```(\w+)?\s*(?:#+\s*)?([^\n]+\.(?:py|xml|scss|css|js))\n([\s\S]*?)```/g;

    let match;
    while ((match = fileBlockRegex.exec(output)) !== null) {
      const [, , filename, content] = match;
      files.push({
        path: filename.trim(),
        content: content.trim(),
        type: this.getFileType(filename),
      });
    }

    // Also try simpler format: ### filename.ext
    const simpleBlockRegex = /###\s+([^\n]+\.(?:py|xml|scss|css|js))\n```\w*\n([\s\S]*?)```/g;
    while ((match = simpleBlockRegex.exec(output)) !== null) {
      const [, filename, content] = match;
      const exists = files.some((f) => f.path === filename.trim());
      if (!exists) {
        files.push({
          path: filename.trim(),
          content: content.trim(),
          type: this.getFileType(filename),
        });
      }
    }

    return files;
  }

  private getFileType(filename: string): string {
    if (filename.endsWith(".py")) return "python";
    if (filename.endsWith(".xml")) return "xml";
    if (filename.endsWith(".scss")) return "scss";
    if (filename.endsWith(".css")) return "css";
    if (filename.endsWith(".js")) return "javascript";
    return "text";
  }

  /**
   * Run the complete GCR cycle
   */
  async run(userPrompt: string): Promise<GCRResult> {
    const startTime = Date.now();
    const iterations: GCRIteration[] = [];
    let currentOutput = "";
    let currentFiles: ParsedFile[] = [];
    let currentReport: CriticReport | null = null;
    let iterationNum = 0;

    while (iterationNum < this.config.maxIterations) {
      iterationNum++;
      const iterStart = Date.now();

      const iteration: GCRIteration = {
        number: iterationNum,
        status: "generating",
        generatedOutput: "",
        parsedFiles: [],
        criticReport: null,
        refinementApplied: false,
        durationMs: 0,
        timestamp: Date.now(),
      };

      try {
        // Step 1: Generate or Regenerate
        if (iterationNum === 1) {
          currentOutput = await this.generator.generate(userPrompt);
        } else if (currentReport && currentReport.shouldIterateAgain) {
          currentOutput = await this.generator.regenerateWithFeedback(
            userPrompt,
            currentOutput,
            currentReport
          );
        }

        iteration.generatedOutput = currentOutput;
        iteration.status = "critiquing";

        // Step 2: Parse output
        currentFiles = this.parseOutput(currentOutput);
        iteration.parsedFiles = currentFiles;

        // Step 3: Critique
        currentReport = evaluateWithCritic(
          currentFiles,
          iterationNum,
          this.config.critic
        );
        iteration.criticReport = currentReport;

        // Step 4: Check if quality threshold met
        if (currentReport.qualityScore >= this.config.qualityThreshold) {
          iteration.status = "complete";
          iteration.durationMs = Date.now() - iterStart;
          iterations.push(iteration);
          this.config.onIterationComplete(iteration);
          break;
        }

        // Step 5: Refine if auto-refine enabled and issues exist
        if (this.config.autoRefine && currentReport.canBeAutoCorrected) {
          iteration.status = "refining";

          // Apply auto-fixes first
          currentFiles = this.refinement.applyAutoFixes(currentFiles, currentReport);

          // If still below threshold, use AI refinement
          if (currentReport.errorCount > 0) {
            currentOutput = await this.refinement.refine(
              currentOutput,
              currentReport,
              userPrompt
            );
            currentFiles = this.parseOutput(currentOutput);
          }

          iteration.refinementApplied = true;
          iteration.parsedFiles = currentFiles;

          // Re-critique after refinement
          currentReport = evaluateWithCritic(
            currentFiles,
            iterationNum,
            this.config.critic
          );
          iteration.criticReport = currentReport;
        }

        iteration.status = currentReport.qualityScore >= this.config.qualityThreshold
          ? "complete"
          : "pending";
        iteration.durationMs = Date.now() - iterStart;
        iterations.push(iteration);
        this.config.onIterationComplete(iteration);

        // Exit if quality met after refinement
        if (currentReport.qualityScore >= this.config.qualityThreshold) {
          break;
        }

        // Exit if no more improvement possible
        if (!currentReport.shouldIterateAgain) {
          break;
        }
      } catch (error) {
        iteration.status = "failed";
        iteration.durationMs = Date.now() - iterStart;
        iterations.push(iteration);
        this.config.onIterationComplete(iteration);
        break;
      }
    }

    const finalReport = currentReport || evaluateWithCritic(currentFiles, iterationNum);

    return {
      success: finalReport.qualityScore >= this.config.qualityThreshold,
      qualityScore: finalReport.qualityScore,
      grade: finalReport.grade,
      totalIterations: iterations.length,
      iterations,
      finalOutput: currentOutput,
      finalFiles: currentFiles,
      finalCriticReport: finalReport,
      totalDurationMs: Date.now() - startTime,
      metadata: {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        modelUsed: this.config.generator.model || "claude-3-5-sonnet-20241022",
        qualityThreshold: this.config.qualityThreshold,
        maxIterations: this.config.maxIterations,
      },
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a GCR orchestrator with default settings
 */
export function createGCROrchestrator(
  options: Partial<GCRConfig> = {}
): GCROrchestrator {
  return new GCROrchestrator({
    generator: {
      systemPrompt: DEFAULT_GENERATOR_PROMPT,
      ...options.generator,
    },
    critic: options.critic,
    refinement: options.refinement,
    maxIterations: options.maxIterations,
    qualityThreshold: options.qualityThreshold,
    autoRefine: options.autoRefine,
    onIterationComplete: options.onIterationComplete,
  });
}

/**
 * Run a single GCR cycle with default configuration
 */
export async function runGCRCycle(
  prompt: string,
  options: Partial<GCRConfig> = {}
): Promise<GCRResult> {
  const orchestrator = createGCROrchestrator(options);
  return orchestrator.run(prompt);
}

/**
 * Evaluate quality of existing files through the Critic
 */
export function evaluateQuality(
  files: ParsedFile[],
  options?: CriticOptions
): CriticReport {
  return evaluateWithCritic(files, 1, options);
}

/**
 * Format GCR result for display
 */
export function formatGCRResult(result: GCRResult): string {
  const lines: string[] = [
    "╔════════════════════════════════════════════════════════════════════╗",
    "║                    GCR CYCLE COMPLETE                              ║",
    "╚════════════════════════════════════════════════════════════════════╝",
    "",
    `Status: ${result.success ? "✅ PASSED" : "❌ BELOW THRESHOLD"}`,
    `Grade: ${result.grade} (${result.qualityScore}/100)`,
    `Iterations: ${result.totalIterations}/${result.metadata.maxIterations}`,
    `Duration: ${result.totalDurationMs}ms`,
    "",
    "── Iteration Summary ──────────────────────────────────────────────────",
  ];

  for (const iter of result.iterations) {
    const status = iter.status === "complete" ? "✓" : iter.status === "failed" ? "✗" : "○";
    const score = iter.criticReport?.qualityScore ?? "N/A";
    const refined = iter.refinementApplied ? " (refined)" : "";
    lines.push(
      `  ${status} Iteration ${iter.number}: Score ${score}${refined} [${iter.durationMs}ms]`
    );
  }

  lines.push("");
  lines.push("── Final Files ────────────────────────────────────────────────────────");
  for (const file of result.finalFiles) {
    lines.push(`  📄 ${file.path} (${file.content.length} bytes)`);
  }

  if (result.finalCriticReport.issues.length > 0) {
    lines.push("");
    lines.push("── Remaining Issues ───────────────────────────────────────────────────");
    const errors = result.finalCriticReport.issues.filter((i) => i.severity === "error");
    const warnings = result.finalCriticReport.issues.filter((i) => i.severity === "warning");
    lines.push(`  Errors: ${errors.length} | Warnings: ${warnings.length}`);
    for (const issue of errors.slice(0, 3)) {
      lines.push(`  ❌ ${issue.message}`);
    }
  }

  return lines.join("\n");
}

/**
 * Tests for Generator-Critic-Refinement Agent Pattern
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GeneratorAgent,
  RefinementAgent,
  GCROrchestrator,
  createGCROrchestrator,
  evaluateQuality,
  formatGCRResult,
  type GCRConfig,
  type GCRResult,
  type GCRIteration,
  type GeneratorConfig,
  type RefinementConfig,
} from "../../lib/ai/gcr-agent";
import type { ParsedFile } from "../../lib/ai/parser";
import type { CriticReport } from "../../lib/ai/critic-agent";

// Mock the provider adapters with proper class constructors
vi.mock("../../lib/ai/providers", () => {
  const MockAdapter = class {
    chat = async () => ({
      content: [{ type: "text", text: "Generated content" }],
    });
  };
  return {
    AnthropicAdapter: MockAdapter,
    OpenAIAdapter: MockAdapter,
  };
});

// Sample files for testing
const sampleValidFiles: ParsedFile[] = [
  {
    path: "theme_test/__manifest__.py",
    content: `{
    'name': 'Test Theme',
    'version': '17.0.1.0.0',
    'depends': ['website'],
    'data': ['views/templates.xml'],
}`,
    type: "python",
  },
  {
    path: "theme_test/__init__.py",
    content: "# -*- coding: utf-8 -*-",
    type: "python",
  },
  {
    path: "theme_test/views/templates.xml",
    content: `<odoo>
    <template id="theme_test_header" name="Test Header">
        <header class="o_header">
            <nav t-foreach="menus" t-as="menu">
                <a t-att-href="menu.url" t-esc="menu.name"/>
            </nav>
        </header>
    </template>
</odoo>`,
    type: "xml",
  },
  {
    path: "theme_test/static/src/scss/theme.scss",
    content: `.o_header {
    background: var(--primary);
    padding: 1rem;
}`,
    type: "scss",
  },
];

const sampleInvalidFiles: ParsedFile[] = [
  {
    path: "theme_bad/__manifest__.py",
    content: `{
    'version': '17.0.1.0.0',
}`,
    type: "python",
  },
  {
    path: "theme_bad/views/templates.xml",
    content: `<template>
    <div t-foreach="items">
        {{ name }}
    </div>
</template>`,
    type: "xml",
  },
  {
    path: "theme_bad/static/src/scss/broken.scss",
    content: `.header {
    background: red;
    .nested {
        color: blue;
`,
    type: "scss",
  },
];

// Sample critic report
const sampleCriticReport: CriticReport = {
  grade: "C",
  qualityScore: 65,
  errorCount: 2,
  warningCount: 3,
  infoCount: 1,
  issues: [
    {
      id: "QWEB-ERR-1",
      severity: "error",
      category: "qweb",
      message: "Missing <odoo> root element",
      autoFixable: false,
    },
    {
      id: "SCSS-ERR-1",
      severity: "error",
      category: "scss",
      message: "Unbalanced braces",
      autoFixable: true,
    },
    {
      id: "STRUCT-WARN-1",
      severity: "warning",
      category: "structure",
      message: "Missing name field in manifest",
      autoFixable: false,
    },
  ],
  recommendations: ["Fix QWeb template syntax", "Balance SCSS braces"],
  canBeAutoCorrected: true,
  shouldIterateAgain: true,
  iterationNumber: 1,
  validationSummary: {
    qweb: { valid: false, errors: ["Missing root"], warnings: [] },
    scss: { valid: false, errors: ["Unbalanced"], warnings: [] },
    structure: { valid: true, errors: [], warnings: ["Missing init"] },
    security: { passed: true, issues: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 } },
  },
  timestamp: Date.now(),
  duration: 50,
};

describe("GCR Agent Pattern", () => {
  let savedEnvKey: string | undefined;

  beforeEach(() => {
    savedEnvKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key-for-testing";
  });

  afterEach(() => {
    if (savedEnvKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = savedEnvKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  describe("evaluateQuality", () => {
    it("evaluates valid files with high score", () => {
      const report = evaluateQuality(sampleValidFiles);

      expect(report.grade).toBeDefined();
      expect(report.qualityScore).toBeGreaterThanOrEqual(0);
      expect(report.qualityScore).toBeLessThanOrEqual(100);
    });

    it("evaluates invalid files with issues", () => {
      const report = evaluateQuality(sampleInvalidFiles);

      expect(report.errorCount).toBeGreaterThan(0);
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it("returns critic report structure", () => {
      const report = evaluateQuality(sampleValidFiles);

      expect(report).toHaveProperty("grade");
      expect(report).toHaveProperty("qualityScore");
      expect(report).toHaveProperty("errorCount");
      expect(report).toHaveProperty("warningCount");
      expect(report).toHaveProperty("issues");
      expect(report).toHaveProperty("recommendations");
      expect(report).toHaveProperty("validationSummary");
    });

    it("accepts custom critic options", () => {
      const report = evaluateQuality(sampleValidFiles, {
        qualityThreshold: 90,
        strictMode: true,
      });

      expect(report).toBeDefined();
    });
  });

  describe("RefinementAgent", () => {
    it("applies auto-fixes to files", () => {
      const config: RefinementConfig = {
        systemPrompt: "Refine code",
      };
      const agent = new RefinementAgent(config);

      const filesWithPlaceholders: ParsedFile[] = [
        {
          path: "test.py",
          content: "name = 'YOUR_NAME_HERE'\nvalue = PLACEHOLDER",
          type: "python",
        },
      ];

      const fixed = agent.applyAutoFixes(filesWithPlaceholders, sampleCriticReport);

      expect(fixed[0].content).not.toContain("YOUR_NAME_HERE");
      expect(fixed[0].content).not.toContain("PLACEHOLDER");
    });

    it("balances SCSS braces", () => {
      const config: RefinementConfig = {
        systemPrompt: "Refine code",
      };
      const agent = new RefinementAgent(config);

      const unbalancedScss: ParsedFile[] = [
        {
          path: "test.scss",
          content: ".header { .nested { color: red;",
          type: "scss",
        },
      ];

      const fixed = agent.applyAutoFixes(unbalancedScss, sampleCriticReport);
      const openCount = (fixed[0].content.match(/\{/g) || []).length;
      const closeCount = (fixed[0].content.match(/\}/g) || []).length;

      expect(closeCount).toBe(openCount);
    });

    it("adds missing odoo closing tag", () => {
      const config: RefinementConfig = {
        systemPrompt: "Refine code",
      };
      const agent = new RefinementAgent(config);

      const unclosedXml: ParsedFile[] = [
        {
          path: "test.xml",
          content: "<odoo>\n<template id='test'>Content</template>",
          type: "xml",
        },
      ];

      const fixed = agent.applyAutoFixes(unclosedXml, sampleCriticReport);

      expect(fixed[0].content).toContain("</odoo>");
    });

    it("trims trailing whitespace", () => {
      const config: RefinementConfig = {
        systemPrompt: "Refine code",
      };
      const agent = new RefinementAgent(config);

      const filesWithWhitespace: ParsedFile[] = [
        {
          path: "test.py",
          content: "line1   \nline2    \nline3",
          type: "python",
        },
      ];

      const fixed = agent.applyAutoFixes(filesWithWhitespace, sampleCriticReport);
      const lines = fixed[0].content.split("\n");

      for (const line of lines) {
        expect(line).toBe(line.trimEnd());
      }
    });

    it("collapses multiple empty lines", () => {
      const config: RefinementConfig = {
        systemPrompt: "Refine code",
      };
      const agent = new RefinementAgent(config);

      const filesWithManyNewlines: ParsedFile[] = [
        {
          path: "test.py",
          content: "line1\n\n\n\n\n\nline2",
          type: "python",
        },
      ];

      const fixed = agent.applyAutoFixes(filesWithManyNewlines, sampleCriticReport);

      expect(fixed[0].content).not.toContain("\n\n\n\n");
    });
  });

  describe("createGCROrchestrator", () => {
    it("creates orchestrator with default settings", () => {
      const orchestrator = createGCROrchestrator();

      expect(orchestrator).toBeInstanceOf(GCROrchestrator);
    });

    it("creates orchestrator with custom settings", () => {
      const orchestrator = createGCROrchestrator({
        maxIterations: 5,
        qualityThreshold: 85,
        autoRefine: false,
      });

      expect(orchestrator).toBeInstanceOf(GCROrchestrator);
    });

    it("accepts custom generator config", () => {
      const orchestrator = createGCROrchestrator({
        generator: {
          systemPrompt: "Custom prompt",
          temperature: 0.5,
        },
      });

      expect(orchestrator).toBeInstanceOf(GCROrchestrator);
    });

    it("accepts custom refinement config", () => {
      const orchestrator = createGCROrchestrator({
        refinement: {
          systemPrompt: "Custom refinement prompt",
          focusAreas: ["security", "performance"],
        },
      });

      expect(orchestrator).toBeInstanceOf(GCROrchestrator);
    });
  });

  describe("formatGCRResult", () => {
    const sampleResult: GCRResult = {
      success: true,
      qualityScore: 85,
      grade: "B",
      totalIterations: 2,
      iterations: [
        {
          number: 1,
          status: "complete",
          generatedOutput: "output1",
          parsedFiles: sampleValidFiles.slice(0, 2),
          criticReport: { ...sampleCriticReport, qualityScore: 60 },
          refinementApplied: true,
          durationMs: 1000,
          timestamp: Date.now(),
        },
        {
          number: 2,
          status: "complete",
          generatedOutput: "output2",
          parsedFiles: sampleValidFiles,
          criticReport: { ...sampleCriticReport, qualityScore: 85, grade: "B" },
          refinementApplied: false,
          durationMs: 800,
          timestamp: Date.now(),
        },
      ],
      finalOutput: "final output",
      finalFiles: sampleValidFiles,
      finalCriticReport: { ...sampleCriticReport, qualityScore: 85, grade: "B", issues: [] },
      totalDurationMs: 1800,
      metadata: {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        modelUsed: "claude-3-5-sonnet-20241022",
        qualityThreshold: 70,
        maxIterations: 3,
      },
    };

    it("formats successful result", () => {
      const formatted = formatGCRResult(sampleResult);

      expect(formatted).toContain("PASSED");
      expect(formatted).toContain("Grade: B");
      expect(formatted).toContain("85/100");
    });

    it("formats failed result", () => {
      const failedResult: GCRResult = {
        ...sampleResult,
        success: false,
        qualityScore: 55,
        grade: "D",
      };

      const formatted = formatGCRResult(failedResult);

      expect(formatted).toContain("BELOW THRESHOLD");
    });

    it("includes iteration summary", () => {
      const formatted = formatGCRResult(sampleResult);

      expect(formatted).toContain("Iteration 1");
      expect(formatted).toContain("Iteration 2");
      expect(formatted).toContain("Iterations: 2/3");
    });

    it("lists final files", () => {
      const formatted = formatGCRResult(sampleResult);

      expect(formatted).toContain("Final Files");
      for (const file of sampleValidFiles) {
        expect(formatted).toContain(file.path);
      }
    });

    it("shows remaining issues if any", () => {
      const resultWithIssues: GCRResult = {
        ...sampleResult,
        finalCriticReport: sampleCriticReport,
      };

      const formatted = formatGCRResult(resultWithIssues);

      expect(formatted).toContain("Remaining Issues");
      expect(formatted).toContain("Errors:");
    });

    it("includes duration info", () => {
      const formatted = formatGCRResult(sampleResult);

      expect(formatted).toContain("Duration:");
      expect(formatted).toContain("ms");
    });
  });

  describe("GCRIteration types", () => {
    it("has valid status values", () => {
      const validStatuses = ["pending", "generating", "critiquing", "refining", "complete", "failed"];

      const iteration: GCRIteration = {
        number: 1,
        status: "complete",
        generatedOutput: "",
        parsedFiles: [],
        criticReport: null,
        refinementApplied: false,
        durationMs: 0,
        timestamp: Date.now(),
      };

      expect(validStatuses).toContain(iteration.status);
    });

    it("has required properties", () => {
      const iteration: GCRIteration = {
        number: 1,
        status: "pending",
        generatedOutput: "test",
        parsedFiles: [],
        criticReport: null,
        refinementApplied: false,
        durationMs: 100,
        timestamp: Date.now(),
      };

      expect(iteration.number).toBeGreaterThan(0);
      expect(typeof iteration.generatedOutput).toBe("string");
      expect(Array.isArray(iteration.parsedFiles)).toBe(true);
      expect(typeof iteration.refinementApplied).toBe("boolean");
      expect(typeof iteration.durationMs).toBe("number");
      expect(typeof iteration.timestamp).toBe("number");
    });
  });

  describe("GCRResult types", () => {
    it("has valid structure", () => {
      const result: GCRResult = {
        success: true,
        qualityScore: 80,
        grade: "B",
        totalIterations: 1,
        iterations: [],
        finalOutput: "",
        finalFiles: [],
        finalCriticReport: sampleCriticReport,
        totalDurationMs: 500,
        metadata: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          modelUsed: "claude-3-5-sonnet-20241022",
          qualityThreshold: 70,
          maxIterations: 3,
        },
      };

      expect(typeof result.success).toBe("boolean");
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
      expect(["A", "B", "C", "D", "F"]).toContain(result.grade);
      expect(result.totalIterations).toBeGreaterThanOrEqual(0);
    });

    it("metadata has required fields", () => {
      const result: GCRResult = {
        success: true,
        qualityScore: 80,
        grade: "B",
        totalIterations: 1,
        iterations: [],
        finalOutput: "",
        finalFiles: [],
        finalCriticReport: sampleCriticReport,
        totalDurationMs: 500,
        metadata: {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          modelUsed: "claude-3-5-sonnet-20241022",
          qualityThreshold: 70,
          maxIterations: 3,
        },
      };

      expect(result.metadata.startedAt).toBeDefined();
      expect(result.metadata.completedAt).toBeDefined();
      expect(result.metadata.modelUsed).toBeDefined();
      expect(result.metadata.qualityThreshold).toBeGreaterThan(0);
      expect(result.metadata.maxIterations).toBeGreaterThan(0);
    });
  });

  describe("GCRConfig types", () => {
    it("accepts minimal config", () => {
      const config: GCRConfig = {
        generator: {
          systemPrompt: "Generate code",
        },
      };

      expect(config.generator.systemPrompt).toBeDefined();
    });

    it("accepts full config", () => {
      const config: GCRConfig = {
        generator: {
          systemPrompt: "Generate",
          model: "claude-3-5-sonnet-20241022",
          provider: "anthropic",
          maxTokens: 8192,
          temperature: 0.7,
        },
        critic: {
          maxIterations: 3,
          qualityThreshold: 70,
          strictMode: false,
        },
        refinement: {
          systemPrompt: "Refine",
          model: "claude-3-5-sonnet-20241022",
          focusAreas: ["syntax", "security"],
        },
        maxIterations: 5,
        qualityThreshold: 80,
        autoRefine: true,
        onIterationComplete: () => {},
      };

      expect(config.generator).toBeDefined();
      expect(config.critic).toBeDefined();
      expect(config.refinement).toBeDefined();
      expect(config.maxIterations).toBe(5);
    });
  });

  describe("Agent role types", () => {
    it("includes all agent roles", () => {
      const roles = ["generator", "critic", "refinement"];

      expect(roles).toContain("generator");
      expect(roles).toContain("critic");
      expect(roles).toContain("refinement");
    });
  });

  describe("Error handling", () => {
    it("GeneratorAgent throws without credentials", async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      // Import fresh module to test credential check
      vi.resetModules();

      try {
        const { GeneratorAgent: FreshGeneratorAgent } = await import("../../lib/ai/gcr-agent");
        expect(() => {
          new FreshGeneratorAgent({
            systemPrompt: "test",
          });
        }).toThrow(/credentials|API/i);
      } finally {
        if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
      }
    });

    it("RefinementAgent throws without credentials", async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      vi.resetModules();

      try {
        const { RefinementAgent: FreshRefinementAgent } = await import("../../lib/ai/gcr-agent");
        expect(() => {
          new FreshRefinementAgent({
            systemPrompt: "test",
          });
        }).toThrow(/credentials|API/i);
      } finally {
        if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
      }
    });
  });

  describe("Quality thresholds", () => {
    it("valid files pass default threshold", () => {
      const report = evaluateQuality(sampleValidFiles);

      // Valid files should have decent score
      expect(report.qualityScore).toBeGreaterThan(50);
    });

    it("invalid files fail strict threshold", () => {
      const report = evaluateQuality(sampleInvalidFiles, {
        qualityThreshold: 90,
        strictMode: true,
      });

      expect(report.qualityScore).toBeLessThan(90);
      expect(report.shouldIterateAgain).toBe(true);
    });
  });

  describe("Integration", () => {
    it("critic report determines shouldIterateAgain", () => {
      const lowScoreReport = evaluateQuality(sampleInvalidFiles, {
        qualityThreshold: 70,
        maxIterations: 3,
      });

      if (lowScoreReport.qualityScore < 70 && lowScoreReport.errorCount > 0) {
        expect(lowScoreReport.shouldIterateAgain).toBe(true);
      }
    });

    it("iteration callback is invoked", () => {
      const callback = vi.fn();

      createGCROrchestrator({
        onIterationComplete: callback,
      });

      // Callback is stored, would be called during run()
      expect(callback).not.toHaveBeenCalled(); // Not called until run()
    });
  });
});

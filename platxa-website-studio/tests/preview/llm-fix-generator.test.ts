import { describe, it, expect, beforeEach } from "vitest";
import {
  LLMFixGenerator,
  createLLMFixGenerator,
  createErrorContext,
  buildUserPrompt,
  createLLMRequest,
  parseConfidence,
  extractCodeBlock,
  extractSection,
  parseLLMResponse,
  getMockResponse,
  sendToLLM,
  formatGeneratedFix,
  isHighConfidenceFix,
  hasCodeSuggestion,
  combineFixes,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_FIX_GENERATOR_CONFIG,
  MOCK_LLM_RESPONSES,
  type LLMErrorContext,
  type LLMGeneratedFix,
  type LLMResponse,
} from "@/lib/preview/llm-fix-generator";

describe("LLMFixGenerator", () => {
  describe("unknown errors sent to LLM with context (Feature #147)", () => {
    it("sends error message to LLM", async () => {
      // Feature #147: Unknown errors sent to LLM with context
      const generator = createLLMFixGenerator();
      const context = createErrorContext("Cannot read property 'x' of undefined");

      const fix = await generator.generateFix(context);

      expect(fix.isLLMGenerated).toBe(true);
      expect(fix.description).toBeTruthy();
    });

    it("includes file path in context", async () => {
      // Feature #147: Unknown errors sent to LLM with context
      const context: LLMErrorContext = {
        errorMessage: "Syntax error",
        filePath: "/app/src/component.tsx",
        lineNumber: 42,
      };

      const prompt = buildUserPrompt(context);

      expect(prompt).toContain("/app/src/component.tsx");
      expect(prompt).toContain("42");
    });

    it("includes source context in prompt", async () => {
      // Feature #147: Unknown errors sent to LLM with context
      const context: LLMErrorContext = {
        errorMessage: "Type error",
        sourceContext: "const x: string = 123;",
      };

      const prompt = buildUserPrompt(context);

      expect(prompt).toContain("const x: string = 123;");
      expect(prompt).toContain("SOURCE CONTEXT");
    });

    it("includes stack trace when available", async () => {
      // Feature #147: Unknown errors sent to LLM with context
      const context: LLMErrorContext = {
        errorMessage: "Runtime error",
        stackTrace: "at Function.run (app.js:10)",
      };

      const prompt = buildUserPrompt(context);

      expect(prompt).toContain("at Function.run");
      expect(prompt).toContain("STACK TRACE");
    });
  });

  describe("fix generated from LLM response (Feature #147)", () => {
    it("generates fix description", async () => {
      // Feature #147: Fix generated from response
      const generator = createLLMFixGenerator();
      const context = createErrorContext("Cannot read property of undefined");

      const fix = await generator.generateFix(context);

      expect(fix.description).toBeTruthy();
      expect(fix.description.length).toBeGreaterThan(0);
    });

    it("generates explanation", async () => {
      // Feature #147: Fix generated from response
      const generator = createLLMFixGenerator();
      const context = createErrorContext("Module not found: 'lodash'");

      const fix = await generator.generateFix(context);

      expect(fix.explanation).toBeTruthy();
    });

    it("generates code suggestion when applicable", async () => {
      // Feature #147: Fix generated from response
      const generator = createLLMFixGenerator();
      const context = createErrorContext("undefined variable access");

      const fix = await generator.generateFix(context);

      expect(fix.suggestedCode).toBeDefined();
    });

    it("includes confidence score", async () => {
      // Feature #147: Fix generated from response
      const generator = createLLMFixGenerator();
      const context = createErrorContext("Type error in assignment");

      const fix = await generator.generateFix(context);

      expect(fix.confidence).toBeGreaterThan(0);
      expect(fix.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("buildUserPrompt", () => {
    it("includes error message", () => {
      const context = createErrorContext("Test error");
      const prompt = buildUserPrompt(context);

      expect(prompt).toContain("ERROR: Test error");
    });

    it("includes error type when provided", () => {
      const context: LLMErrorContext = {
        errorMessage: "Error",
        errorType: "TypeError",
      };
      const prompt = buildUserPrompt(context);

      expect(prompt).toContain("TYPE: TypeError");
    });

    it("formats file location correctly", () => {
      const context: LLMErrorContext = {
        errorMessage: "Error",
        filePath: "/src/app.ts",
        lineNumber: 10,
        columnNumber: 5,
      };
      const prompt = buildUserPrompt(context);

      expect(prompt).toContain("FILE: /src/app.ts:10:5");
    });

    it("asks for fix at the end", () => {
      const context = createErrorContext("Error");
      const prompt = buildUserPrompt(context);

      expect(prompt).toContain("Please provide a fix");
    });
  });

  describe("createLLMRequest", () => {
    it("includes system prompt", () => {
      const context = createErrorContext("Error");
      const request = createLLMRequest(context, DEFAULT_FIX_GENERATOR_CONFIG);

      expect(request.systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT);
    });

    it("includes user prompt with context", () => {
      const context = createErrorContext("Test error");
      const request = createLLMRequest(context, DEFAULT_FIX_GENERATOR_CONFIG);

      expect(request.userPrompt).toContain("Test error");
    });

    it("includes LLM config", () => {
      const context = createErrorContext("Error");
      const request = createLLMRequest(context, DEFAULT_FIX_GENERATOR_CONFIG);

      expect(request.config).toBeDefined();
      expect(request.config.provider).toBe("mock");
    });
  });

  describe("parseConfidence", () => {
    it("parses 'high' confidence", () => {
      expect(parseConfidence("high")).toBe(0.9);
      expect(parseConfidence("HIGH confidence")).toBe(0.9);
    });

    it("parses 'medium' confidence", () => {
      expect(parseConfidence("medium")).toBe(0.7);
      expect(parseConfidence("Medium level")).toBe(0.7);
    });

    it("parses 'low' confidence", () => {
      expect(parseConfidence("low")).toBe(0.4);
      expect(parseConfidence("LOW confidence")).toBe(0.4);
    });

    it("parses numeric percentage", () => {
      expect(parseConfidence("85%")).toBeCloseTo(0.85);
      expect(parseConfidence("0.75")).toBeCloseTo(0.75);
    });

    it("returns default for unknown", () => {
      expect(parseConfidence("unknown")).toBe(0.6);
    });
  });

  describe("extractCodeBlock", () => {
    it("extracts fenced code block", () => {
      const text = "Some text\n```javascript\nconst x = 1;\n```\nMore text";
      const code = extractCodeBlock(text);

      expect(code).toBe("const x = 1;");
    });

    it("extracts code block without language", () => {
      const text = "Text\n```\ncode here\n```";
      const code = extractCodeBlock(text);

      expect(code).toBe("code here");
    });

    it("extracts indented code", () => {
      const text = "Description:\n    const x = 1;\n    const y = 2;\nEnd";
      const code = extractCodeBlock(text);

      expect(code).toContain("const x = 1;");
    });

    it("returns undefined for no code", () => {
      const text = "No code here, just text.";
      const code = extractCodeBlock(text);

      expect(code).toBeUndefined();
    });
  });

  describe("extractSection", () => {
    it("extracts labeled section", () => {
      const text = "DESCRIPTION: This is a fix\nEXPLANATION: Because reasons";
      const desc = extractSection(text, "DESCRIPTION");

      expect(desc).toBe("This is a fix");
    });

    it("extracts markdown bold section", () => {
      const text = "**DESCRIPTION**: Bold section content\n**NEXT**";
      const desc = extractSection(text, "DESCRIPTION");

      expect(desc).toContain("Bold section content");
    });

    it("returns empty for missing section", () => {
      const text = "Some text without sections";
      const section = extractSection(text, "MISSING");

      expect(section).toBe("");
    });
  });

  describe("parseLLMResponse", () => {
    it("parses successful response", () => {
      const response: LLMResponse = {
        text: MOCK_LLM_RESPONSES["undefined"],
        success: true,
      };

      const fix = parseLLMResponse(response);

      expect(fix.description).toBeTruthy();
      expect(fix.explanation).toBeTruthy();
      expect(fix.confidence).toBeGreaterThan(0);
      expect(fix.isLLMGenerated).toBe(true);
    });

    it("handles failed response", () => {
      const response: LLMResponse = {
        text: "",
        success: false,
        error: "API error",
      };

      const fix = parseLLMResponse(response);

      expect(fix.confidence).toBe(0);
      expect(fix.explanation).toContain("API error");
    });

    it("extracts code suggestion", () => {
      const response: LLMResponse = {
        text: MOCK_LLM_RESPONSES["undefined"],
        success: true,
      };

      const fix = parseLLMResponse(response);

      expect(fix.suggestedCode).toBeDefined();
    });

    it("preserves raw response", () => {
      const response: LLMResponse = {
        text: "Raw response text",
        success: true,
      };

      const fix = parseLLMResponse(response);

      expect(fix.rawResponse).toBe("Raw response text");
    });
  });

  describe("getMockResponse", () => {
    it("returns undefined fix for null/undefined errors", () => {
      const context = createErrorContext("Cannot read property of undefined");
      const response = getMockResponse(context);

      expect(response.success).toBe(true);
      expect(response.text).toContain("null check");
    });

    it("returns syntax fix for syntax errors", () => {
      const context = createErrorContext("SyntaxError: Unexpected token");
      const response = getMockResponse(context);

      expect(response.text).toContain("syntax");
    });

    it("returns import fix for module errors", () => {
      const context = createErrorContext("Cannot find module 'lodash'");
      const response = getMockResponse(context);

      expect(response.text).toContain("npm install");
    });

    it("returns type fix for type errors", () => {
      const context = createErrorContext("Type 'string' is not assignable");
      const response = getMockResponse(context);

      expect(response.text).toContain("type");
    });

    it("returns default for unknown errors", () => {
      const context = createErrorContext("Some completely random error");
      const response = getMockResponse(context);

      expect(response.success).toBe(true);
    });
  });

  describe("sendToLLM", () => {
    it("handles mock provider", async () => {
      const request = {
        systemPrompt: "System",
        userPrompt: "ERROR: undefined error",
        config: { provider: "mock" as const },
      };

      const response = await sendToLLM(request);

      expect(response.success).toBe(true);
      expect(response.text).toBeTruthy();
    });

    it("returns error for unimplemented providers", async () => {
      const request = {
        systemPrompt: "System",
        userPrompt: "ERROR: test",
        config: { provider: "openai" as const, apiKey: "test" },
      };

      const response = await sendToLLM(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain("requires API integration");
    });
  });

  describe("LLMFixGenerator class", () => {
    let generator: LLMFixGenerator;

    beforeEach(() => {
      generator = createLLMFixGenerator();
    });

    it("generates fix asynchronously", async () => {
      const context = createErrorContext("Test error with undefined");
      const fix = await generator.generateFix(context);

      expect(fix.isLLMGenerated).toBe(true);
      expect(fix.description).toBeTruthy();
    });

    it("generates fix synchronously with mock", () => {
      const context = createErrorContext("Syntax error in code");
      const fix = generator.generateFixSync(context);

      expect(fix.description).toBeTruthy();
    });

    it("caches results", async () => {
      const context = createErrorContext("Cache test error");

      const fix1 = await generator.generateFix(context);
      const fix2 = await generator.generateFix(context);

      expect(fix1).toBe(fix2);
    });

    it("clears cache", async () => {
      const context = createErrorContext("Test");
      await generator.generateFix(context);

      generator.clearCache();

      expect(generator.getCacheStats().size).toBe(0);
    });

    it("shouldUseLLM returns true when no pattern match", () => {
      expect(generator.shouldUseLLM(false)).toBe(true);
      expect(generator.shouldUseLLM(true)).toBe(false);
    });

    it("updates config", () => {
      generator.updateConfig({ minConfidence: 0.8 });

      const config = generator.getConfig();
      expect(config.minConfidence).toBe(0.8);
    });

    it("gets cache stats", async () => {
      await generator.generateFix(createErrorContext("Error 1"));
      await generator.generateFix(createErrorContext("Error 2"));

      const stats = generator.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(100);
    });

    it("marks low confidence fixes", async () => {
      generator.updateConfig({ minConfidence: 0.95 });
      const context = createErrorContext("Unknown error xyz123");

      const fix = await generator.generateFix(context);

      // Most mock responses have < 0.95 confidence
      if (fix.confidence < 0.95) {
        expect(fix.description).toContain("[Low confidence]");
      }
    });
  });

  describe("formatGeneratedFix", () => {
    it("formats fix for display", () => {
      const fix: LLMGeneratedFix = {
        description: "Add null check",
        explanation: "The value might be null",
        suggestedCode: "if (x) { use(x); }",
        confidence: 0.85,
        isLLMGenerated: true,
      };

      const formatted = formatGeneratedFix(fix);

      expect(formatted).toContain("Add null check");
      expect(formatted).toContain("85%");
      expect(formatted).toContain("if (x)");
      expect(formatted).toContain("[Generated by AI]");
    });

    it("includes alternatives when present", () => {
      const fix: LLMGeneratedFix = {
        description: "Primary fix",
        explanation: "Main explanation",
        confidence: 0.9,
        isLLMGenerated: true,
        alternatives: [{ description: "Alternative approach" }],
      };

      const formatted = formatGeneratedFix(fix);

      expect(formatted).toContain("Alternatives:");
      expect(formatted).toContain("Alternative approach");
    });
  });

  describe("isHighConfidenceFix", () => {
    it("returns true for high confidence", () => {
      const fix: LLMGeneratedFix = {
        description: "Fix",
        explanation: "Explanation",
        confidence: 0.9,
        isLLMGenerated: true,
      };

      expect(isHighConfidenceFix(fix)).toBe(true);
    });

    it("returns false for low confidence", () => {
      const fix: LLMGeneratedFix = {
        description: "Fix",
        explanation: "Explanation",
        confidence: 0.5,
        isLLMGenerated: true,
      };

      expect(isHighConfidenceFix(fix)).toBe(false);
    });
  });

  describe("hasCodeSuggestion", () => {
    it("returns true when code present", () => {
      const fix: LLMGeneratedFix = {
        description: "Fix",
        explanation: "Explanation",
        suggestedCode: "const x = 1;",
        confidence: 0.8,
        isLLMGenerated: true,
      };

      expect(hasCodeSuggestion(fix)).toBe(true);
    });

    it("returns false when no code", () => {
      const fix: LLMGeneratedFix = {
        description: "Fix",
        explanation: "Explanation",
        confidence: 0.8,
        isLLMGenerated: true,
      };

      expect(hasCodeSuggestion(fix)).toBe(false);
    });

    it("returns false for empty code", () => {
      const fix: LLMGeneratedFix = {
        description: "Fix",
        explanation: "Explanation",
        suggestedCode: "   ",
        confidence: 0.8,
        isLLMGenerated: true,
      };

      expect(hasCodeSuggestion(fix)).toBe(false);
    });
  });

  describe("combineFixes", () => {
    it("returns empty fix for no inputs", () => {
      const combined = combineFixes([]);

      expect(combined.description).toContain("No fixes");
      expect(combined.confidence).toBe(0);
    });

    it("returns single fix unchanged", () => {
      const fix: LLMGeneratedFix = {
        description: "Single fix",
        explanation: "Explanation",
        confidence: 0.9,
        isLLMGenerated: true,
      };

      const combined = combineFixes([fix]);

      expect(combined).toBe(fix);
    });

    it("combines multiple fixes with highest confidence first", () => {
      const fixes: LLMGeneratedFix[] = [
        { description: "Low", explanation: "", confidence: 0.5, isLLMGenerated: true },
        { description: "High", explanation: "", confidence: 0.9, isLLMGenerated: true },
        { description: "Medium", explanation: "", confidence: 0.7, isLLMGenerated: true },
      ];

      const combined = combineFixes(fixes);

      expect(combined.description).toBe("High");
      expect(combined.alternatives).toHaveLength(2);
    });
  });

  describe("createErrorContext", () => {
    it("creates context with message", () => {
      const context = createErrorContext("Test error");

      expect(context.errorMessage).toBe("Test error");
    });

    it("includes optional fields", () => {
      const context = createErrorContext("Error", {
        filePath: "/app.ts",
        lineNumber: 10,
        errorType: "TypeError",
      });

      expect(context.filePath).toBe("/app.ts");
      expect(context.lineNumber).toBe(10);
      expect(context.errorType).toBe("TypeError");
    });
  });

  describe("DEFAULT_FIX_GENERATOR_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_FIX_GENERATOR_CONFIG.llmConfig.provider).toBe("mock");
      expect(DEFAULT_FIX_GENERATOR_CONFIG.enableCache).toBe(true);
      expect(DEFAULT_FIX_GENERATOR_CONFIG.maxCacheSize).toBe(100);
      expect(DEFAULT_FIX_GENERATOR_CONFIG.minConfidence).toBe(0.5);
    });
  });

  describe("MOCK_LLM_RESPONSES", () => {
    it("has responses for common error types", () => {
      expect(MOCK_LLM_RESPONSES["undefined"]).toBeDefined();
      expect(MOCK_LLM_RESPONSES["syntax"]).toBeDefined();
      expect(MOCK_LLM_RESPONSES["import"]).toBeDefined();
      expect(MOCK_LLM_RESPONSES["type"]).toBeDefined();
      expect(MOCK_LLM_RESPONSES["default"]).toBeDefined();
    });
  });
});

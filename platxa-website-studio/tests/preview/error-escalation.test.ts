// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ErrorEscalationManager,
  createEscalationManager,
  createEscalationManagerWithCallback,
  determineSeverity,
  generateSyntaxSuggestions,
  generateStructureSuggestions,
  generateReferenceSuggestions,
  generateTypeSuggestions,
  generateGenericSuggestions,
  formatEscalatedError,
  formatSuggestion,
  shouldEscalateError,
  getTopSuggestion,
  filterSuggestionsByCategory,
  createEscalationSummary,
  type EscalatedError,
  type ManualSuggestion,
  type EscalationSeverity,
} from "@/lib/preview/error-escalation";
import {
  createErrorIdentifier,
  createRetryState,
  recordAttempt,
  type RetryAttempt,
  type RetryState,
} from "@/lib/preview/error-retry-logic";

describe("ErrorEscalation", () => {
  // Helper to create a failed retry state
  function createExhaustedRetryState(): RetryState {
    const error = createErrorIdentifier("Test error");
    let state = createRetryState(error);

    const approaches = ["pattern_match", "fuzzy_match", "llm_generation"] as const;
    for (let i = 0; i < 3; i++) {
      state = recordAttempt(state, {
        attemptNumber: i + 1,
        approach: approaches[i],
        success: false,
        errorMessage: `Attempt ${i + 1} failed`,
        timestamp: Date.now(),
        duration: 10,
      });
    }

    return state;
  }

  describe("escalation after 3 failed attempts (Feature #154)", () => {
    it("escalates when retry state is exhausted", () => {
      // Feature #154: After 3 failed attempts, shows error to user
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Syntax error: unexpected token");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalateIfNeeded(error, retryState);

      expect(escalation).not.toBeNull();
      expect(escalation!.error).toBe(error);
      expect(escalation!.attempts.length).toBe(3);
    });

    it("does not escalate when retry state is not exhausted", () => {
      // Feature #154: Only escalates after ALL attempts fail
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Test error");
      const retryState = createRetryState(error); // Fresh state, not exhausted

      const escalation = manager.escalateIfNeeded(error, retryState);

      expect(escalation).toBeNull();
    });

    it("does not escalate when error was resolved", () => {
      // Feature #154: No escalation if error was fixed
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Test error");
      let state = createRetryState(error);
      state = recordAttempt(state, {
        attemptNumber: 1,
        approach: "pattern_match",
        success: true, // Resolved!
        timestamp: Date.now(),
        duration: 10,
      });

      const escalation = manager.escalateIfNeeded(error, state);

      expect(escalation).toBeNull();
    });

    it("includes display message for user", () => {
      // Feature #154: Shows error to user with readable message
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Cannot read property 'x' of undefined", {
        filePath: "/app/test.ts",
        lineNumber: 42,
      });
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);

      expect(escalation.displayMessage).toContain("Cannot read property");
      expect(escalation.displayMessage).toContain("/app/test.ts");
      expect(escalation.displayMessage).toContain("42");
      expect(escalation.displayMessage).toContain("manual attention");
    });
  });

  describe("suggested manual fixes (Feature #154)", () => {
    it("provides suggestions for syntax errors", () => {
      // Feature #154: Suggested manual fix for syntax errors
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Syntax error: unexpected token '}'");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);

      expect(escalation.suggestions.length).toBeGreaterThan(0);
      const syntaxSuggestion = escalation.suggestions.find((s) => s.category === "syntax");
      expect(syntaxSuggestion).toBeDefined();
    });

    it("provides suggestions for reference errors", () => {
      // Feature #154: Suggested manual fix for reference errors
      const manager = createEscalationManager();
      const error = createErrorIdentifier("ReferenceError: myVariable is not defined");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);

      const refSuggestion = escalation.suggestions.find((s) => s.category === "reference");
      expect(refSuggestion).toBeDefined();
      expect(refSuggestion!.steps.length).toBeGreaterThan(0);
    });

    it("provides generic suggestions when no specific match", () => {
      // Feature #154: Always provides some suggestions
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Some unusual error");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);

      expect(escalation.suggestions.length).toBeGreaterThan(0);
    });

    it("sorts suggestions by confidence", () => {
      // Feature #154: Best suggestions first
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Multiple issue error: undefined, missing, parse");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);

      for (let i = 1; i < escalation.suggestions.length; i++) {
        expect(escalation.suggestions[i - 1].confidence)
          .toBeGreaterThanOrEqual(escalation.suggestions[i].confidence);
      }
    });

    it("includes tried approaches in escalation", () => {
      // Feature #154: Shows what was already attempted
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Test error");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);

      expect(escalation.triedApproaches).toContain("pattern_match");
      expect(escalation.triedApproaches).toContain("fuzzy_match");
      expect(escalation.triedApproaches).toContain("llm_generation");
    });
  });

  describe("determineSeverity", () => {
    it("returns critical for security errors", () => {
      expect(determineSeverity(createErrorIdentifier("SQL injection detected"))).toBe("critical");
      expect(determineSeverity(createErrorIdentifier("XSS vulnerability"))).toBe("critical");
    });

    it("returns high for exceptions", () => {
      expect(determineSeverity(createErrorIdentifier("Unhandled exception"))).toBe("high");
      expect(determineSeverity(createErrorIdentifier("TypeError: cannot read"))).toBe("high");
    });

    it("returns medium for warnings", () => {
      expect(determineSeverity(createErrorIdentifier("Warning: deprecated API"))).toBe("medium");
      expect(determineSeverity(createErrorIdentifier("Missing optional field"))).toBe("medium");
    });

    it("returns low for generic errors", () => {
      expect(determineSeverity(createErrorIdentifier("Something went wrong"))).toBe("low");
    });
  });

  describe("generateSyntaxSuggestions", () => {
    it("generates suggestion for unexpected token", () => {
      const error = createErrorIdentifier("Unexpected token '}'");
      const suggestions = generateSyntaxSuggestions(error);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe("syntax");
    });

    it("generates suggestion for unclosed blocks", () => {
      const error = createErrorIdentifier("Unclosed bracket at line 10");
      const suggestions = generateSyntaxSuggestions(error);

      expect(suggestions.some((s) => s.title.toLowerCase().includes("unclosed"))).toBe(true);
    });

    it("returns empty for non-syntax errors", () => {
      const error = createErrorIdentifier("Network timeout");
      const suggestions = generateSyntaxSuggestions(error);

      expect(suggestions.length).toBe(0);
    });
  });

  describe("generateStructureSuggestions", () => {
    it("generates suggestion for missing elements", () => {
      const error = createErrorIdentifier("Missing required attribute 'id'");
      const suggestions = generateStructureSuggestions(error);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe("structure");
    });

    it("generates suggestion for invalid structure", () => {
      const error = createErrorIdentifier("Invalid structure: element out of place");
      const suggestions = generateStructureSuggestions(error);

      expect(suggestions.some((s) => s.title.toLowerCase().includes("structure"))).toBe(true);
    });
  });

  describe("generateReferenceSuggestions", () => {
    it("generates suggestion for undefined references", () => {
      const error = createErrorIdentifier("myFunction is not defined");
      const suggestions = generateReferenceSuggestions(error);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe("reference");
    });

    it("generates suggestion for not found errors", () => {
      const error = createErrorIdentifier("Cannot find module './utils'");
      const suggestions = generateReferenceSuggestions(error);

      expect(suggestions.some((s) => s.title.toLowerCase().includes("reference"))).toBe(true);
    });
  });

  describe("generateTypeSuggestions", () => {
    it("generates suggestion for type errors", () => {
      const error = createErrorIdentifier("Type error: expected string, got number");
      const suggestions = generateTypeSuggestions(error);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].category).toBe("logic");
    });

    it("generates suggestion for type mismatch", () => {
      const error = createErrorIdentifier("Type mismatch in assignment");
      const suggestions = generateTypeSuggestions(error);

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe("generateGenericSuggestions", () => {
    it("always provides at least one suggestion", () => {
      const error = createErrorIdentifier("Unknown error");
      const suggestions = generateGenericSuggestions(error, []);

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it("includes file location in steps when available", () => {
      const error = createErrorIdentifier("Error", { filePath: "/app/file.ts", lineNumber: 10 });
      const suggestions = generateGenericSuggestions(error, []);

      const hasFileReference = suggestions.some((s) =>
        s.steps.some((step) => step.includes("/app/file.ts"))
      );
      expect(hasFileReference).toBe(true);
    });

    it("includes attempt information when available", () => {
      const error = createErrorIdentifier("Error");
      const attempts: RetryAttempt[] = [
        {
          attemptNumber: 1,
          approach: "pattern_match",
          success: false,
          errorMessage: "Pattern not found",
          timestamp: Date.now(),
          duration: 10,
        },
      ];

      const suggestions = generateGenericSuggestions(error, attempts);

      const hasAttemptInfo = suggestions.some((s) =>
        s.description.includes("Pattern not found") || s.title.includes("attempt")
      );
      expect(hasAttemptInfo).toBe(true);
    });
  });

  describe("formatEscalatedError", () => {
    it("includes severity indicator", () => {
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Critical security issue");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);
      const formatted = formatEscalatedError(escalation);

      expect(formatted).toContain("manual attention");
    });

    it("includes error message", () => {
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Specific error message");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);
      const formatted = formatEscalatedError(escalation);

      expect(formatted).toContain("Specific error message");
    });

    it("includes suggestion titles", () => {
      const manager = createEscalationManager();
      const error = createErrorIdentifier("Parse error");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);
      const formatted = formatEscalatedError(escalation);

      if (escalation.suggestions.length > 0) {
        expect(formatted).toContain("Suggested fixes");
      }
    });
  });

  describe("formatSuggestion", () => {
    it("includes title and description", () => {
      const suggestion: ManualSuggestion = {
        id: "test-1",
        category: "syntax",
        title: "Fix syntax error",
        description: "The code has a syntax problem.",
        steps: ["Step 1", "Step 2"],
        confidence: 0.8,
      };

      const formatted = formatSuggestion(suggestion);

      expect(formatted).toContain("Fix syntax error");
      expect(formatted).toContain("The code has a syntax problem");
    });

    it("includes numbered steps", () => {
      const suggestion: ManualSuggestion = {
        id: "test-2",
        category: "structure",
        title: "Test",
        description: "Test desc",
        steps: ["First step", "Second step", "Third step"],
        confidence: 0.5,
      };

      const formatted = formatSuggestion(suggestion);

      expect(formatted).toContain("1. First step");
      expect(formatted).toContain("2. Second step");
      expect(formatted).toContain("3. Third step");
    });

    it("includes code example when provided", () => {
      const suggestion: ManualSuggestion = {
        id: "test-3",
        category: "syntax",
        title: "Test",
        description: "Test desc",
        steps: ["Step"],
        codeExample: "const x = 1;",
        confidence: 0.6,
      };

      const formatted = formatSuggestion(suggestion);

      expect(formatted).toContain("const x = 1;");
    });

    it("includes estimated effort when provided", () => {
      const suggestion: ManualSuggestion = {
        id: "test-4",
        category: "syntax",
        title: "Test",
        description: "Test desc",
        steps: ["Step"],
        confidence: 0.7,
        estimatedEffort: 15,
      };

      const formatted = formatSuggestion(suggestion);

      expect(formatted).toContain("15 minutes");
    });
  });

  describe("ErrorEscalationManager", () => {
    let manager: ErrorEscalationManager;

    beforeEach(() => {
      manager = createEscalationManager();
    });

    it("stores escalations", () => {
      const error = createErrorIdentifier("Test error");
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);

      expect(manager.getEscalation(escalation.id)).toBe(escalation);
    });

    it("gets all escalations", () => {
      const retryState = createExhaustedRetryState();

      manager.escalate(createErrorIdentifier("Error 1"), retryState);
      manager.escalate(createErrorIdentifier("Error 2"), retryState);

      expect(manager.getAllEscalations().length).toBe(2);
    });

    it("gets escalations by severity", () => {
      const retryState = createExhaustedRetryState();

      manager.escalate(createErrorIdentifier("SQL injection risk"), retryState); // critical
      manager.escalate(createErrorIdentifier("Minor issue"), retryState); // low

      const critical = manager.getEscalationsBySeverity("critical");
      expect(critical.length).toBe(1);
    });

    it("resolves escalations", () => {
      const retryState = createExhaustedRetryState();
      const escalation = manager.escalate(createErrorIdentifier("Test"), retryState);

      const resolved = manager.resolveEscalation(escalation.id);

      expect(resolved).toBe(true);
      expect(manager.getEscalation(escalation.id)).toBeUndefined();
    });

    it("returns false when resolving non-existent escalation", () => {
      expect(manager.resolveEscalation("non-existent")).toBe(false);
    });

    it("counts active escalations", () => {
      const retryState = createExhaustedRetryState();

      manager.escalate(createErrorIdentifier("Error 1"), retryState);
      manager.escalate(createErrorIdentifier("Error 2"), retryState);

      expect(manager.getActiveCount()).toBe(2);
    });

    it("clears all escalations", () => {
      const retryState = createExhaustedRetryState();

      manager.escalate(createErrorIdentifier("Error 1"), retryState);
      manager.escalate(createErrorIdentifier("Error 2"), retryState);
      manager.clear();

      expect(manager.getActiveCount()).toBe(0);
    });

    it("provides statistics", () => {
      const retryState = createExhaustedRetryState();

      manager.escalate(createErrorIdentifier("Critical crash issue"), retryState);
      manager.escalate(createErrorIdentifier("Minor problem"), retryState);

      const stats = manager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.bySeverity.critical).toBeGreaterThanOrEqual(0);
    });

    it("calls escalation callbacks", () => {
      const callback = vi.fn();
      manager.onEscalation(callback);

      const retryState = createExhaustedRetryState();
      manager.escalate(createErrorIdentifier("Test"), retryState);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("handles callback errors gracefully", () => {
      manager.onEscalation(() => {
        throw new Error("Callback error");
      });

      const retryState = createExhaustedRetryState();

      // Should not throw
      expect(() => {
        manager.escalate(createErrorIdentifier("Test"), retryState);
      }).not.toThrow();
    });

    it("uses custom suggestion generator", () => {
      manager.registerGenerator("CustomError", () => [
        {
          id: "custom-1",
          category: "other",
          title: "Custom suggestion",
          description: "From custom generator",
          steps: ["Custom step"],
          confidence: 1.0,
        },
      ]);

      const error = createErrorIdentifier("Problem", { errorType: "CustomError" });
      const retryState = createExhaustedRetryState();

      const escalation = manager.escalate(error, retryState);

      expect(escalation.suggestions.some((s) => s.title === "Custom suggestion")).toBe(true);
    });
  });

  describe("createEscalationManagerWithCallback", () => {
    it("creates manager with callback pre-registered", () => {
      const callback = vi.fn();
      const manager = createEscalationManagerWithCallback(callback);

      const retryState = createExhaustedRetryState();
      manager.escalate(createErrorIdentifier("Test"), retryState);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("shouldEscalateError", () => {
    it("returns true for exhausted, unresolved state", () => {
      const state = createExhaustedRetryState();

      expect(shouldEscalateError(state)).toBe(true);
    });

    it("returns false for fresh state", () => {
      const state = createRetryState(createErrorIdentifier("Test"));

      expect(shouldEscalateError(state)).toBe(false);
    });

    it("returns false for resolved state", () => {
      let state = createRetryState(createErrorIdentifier("Test"));
      state = recordAttempt(state, {
        attemptNumber: 1,
        approach: "pattern_match",
        success: true,
        timestamp: Date.now(),
        duration: 10,
      });

      expect(shouldEscalateError(state)).toBe(false);
    });
  });

  describe("getTopSuggestion", () => {
    it("returns first suggestion", () => {
      const manager = createEscalationManager();
      const retryState = createExhaustedRetryState();
      const escalation = manager.escalate(createErrorIdentifier("Parse error"), retryState);

      const top = getTopSuggestion(escalation);

      expect(top).toBe(escalation.suggestions[0]);
    });

    it("returns undefined for no suggestions", () => {
      const escalation: EscalatedError = {
        id: "test",
        error: createErrorIdentifier("Test"),
        severity: "low",
        reason: "Test",
        attempts: [],
        suggestions: [],
        timestamp: Date.now(),
        displayMessage: "",
        triedApproaches: [],
      };

      expect(getTopSuggestion(escalation)).toBeUndefined();
    });
  });

  describe("filterSuggestionsByCategory", () => {
    it("filters by category", () => {
      const suggestions: ManualSuggestion[] = [
        { id: "1", category: "syntax", title: "A", description: "", steps: [], confidence: 0.5 },
        { id: "2", category: "reference", title: "B", description: "", steps: [], confidence: 0.5 },
        { id: "3", category: "syntax", title: "C", description: "", steps: [], confidence: 0.5 },
      ];

      const syntaxOnly = filterSuggestionsByCategory(suggestions, "syntax");

      expect(syntaxOnly.length).toBe(2);
      expect(syntaxOnly.every((s) => s.category === "syntax")).toBe(true);
    });
  });

  describe("createEscalationSummary", () => {
    it("creates summary string", () => {
      const manager = createEscalationManager();
      const retryState = createExhaustedRetryState();
      const escalation = manager.escalate(createErrorIdentifier("Test error"), retryState);

      const summary = createEscalationSummary(escalation);

      expect(summary).toContain("Test error");
      expect(summary).toContain("suggestion");
    });

    it("includes severity in uppercase", () => {
      const manager = createEscalationManager();
      const retryState = createExhaustedRetryState();
      const escalation = manager.escalate(createErrorIdentifier("Critical crash"), retryState);

      const summary = createEscalationSummary(escalation);

      expect(summary).toMatch(/CRITICAL|HIGH|MEDIUM|LOW/);
    });
  });
});

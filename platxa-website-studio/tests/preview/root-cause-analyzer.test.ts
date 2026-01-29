import { describe, it, expect, beforeEach } from "vitest";
import {
  RootCauseAnalyzer,
  createRootCauseAnalyzer,
  analyzeError,
  traceUndefinedVariable,
  traceTCallError,
  extractVariableName,
  extractTemplateName,
  formatRootCause,
  getConfidenceScore,
  isMissingImportError,
  isMissingTemplateError,
  UNDEFINED_VARIABLE_PATTERNS,
  TEMPLATE_ERROR_PATTERNS,
  MISSING_FILE_PATTERNS,
  SYNTAX_ERROR_PATTERNS,
  TYPE_ERROR_PATTERNS,
  ALL_ROOT_CAUSE_PATTERNS,
  CATEGORY_CONFIG,
  type RootCause,
  type ErrorInput,
  type RootCauseCategory,
  type ConfidenceLevel,
} from "@/lib/preview/root-cause-analyzer";

describe("RootCauseAnalyzer", () => {
  describe("traces 'undefined variable' to missing import (Feature #134)", () => {
    it("identifies NameError as missing import", () => {
      // Feature #134: Traces undefined variable → missing import
      const error: ErrorInput = {
        message: "NameError: name 'pandas' is not defined",
        file: "analysis.py",
        line: 15,
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("missing_import");
      expect(result!.confidence).toBe("high");
      expect(result!.source).toBe("pandas");
      expect(result!.suggestedFix).toContain("import");
    });

    it("identifies ReferenceError as missing import", () => {
      // Feature #134: Traces undefined variable → missing import
      const error: ErrorInput = {
        message: "ReferenceError: 'lodash' is not defined",
        file: "utils.js",
        line: 42,
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("missing_import");
      expect(result!.source).toBe("lodash");
    });

    it("identifies 'undefined variable' pattern", () => {
      // Feature #134: Traces undefined variable → missing import
      const error: ErrorInput = {
        message: "undefined variable 'myFunction'",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("missing_import");
      expect(result!.source).toBe("myFunction");
    });

    it("traceUndefinedVariable creates proper root cause", () => {
      // Feature #134: Traces undefined variable → missing import
      const error: ErrorInput = {
        message: "ReferenceError: React is not defined",
        file: "component.tsx",
        line: 1,
      };

      const result = traceUndefinedVariable("React", error);

      expect(result.category).toBe("missing_import");
      expect(result.confidence).toBe("high");
      expect(result.source).toBe("React");
      expect(result.description).toContain("React");
      expect(result.description).toContain("undefined");
      expect(result.suggestedFix).toContain("import");
      expect(result.filePath).toBe("component.tsx");
      expect(result.lineNumber).toBe(1);
    });
  });

  describe("traces 't-call' to missing template (Feature #134)", () => {
    it("identifies t-call not found error", () => {
      // Feature #134: Traces t-call → missing template
      const error: ErrorInput = {
        message: "t-call 'web.external_layout' not found in templates",
        file: "report.xml",
        line: 25,
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("missing_template");
      expect(result!.confidence).toBe("high");
      expect(result!.source).toBe("web.external_layout");
      expect(result!.suggestedFix).toContain("template");
    });

    it("identifies template does not exist error", () => {
      // Feature #134: Traces t-call → missing template
      const error: ErrorInput = {
        message: "template 'custom_report.header' does not exist",
        file: "views/templates.xml",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("missing_template");
      expect(result!.source).toBe("custom_report.header");
    });

    it("identifies QWeb template error", () => {
      // Feature #134: Traces t-call → missing template
      const error: ErrorInput = {
        message: "QWeb error: template 'portal.layout' could not be rendered",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("missing_template");
      expect(result!.source).toBe("portal.layout");
    });

    it("traceTCallError creates proper root cause", () => {
      // Feature #134: Traces t-call → missing template
      const error: ErrorInput = {
        message: "t-call template not found",
        file: "views/report.xml",
        line: 50,
      };

      const result = traceTCallError("sale.report_saleorder_document", error);

      expect(result.category).toBe("missing_template");
      expect(result.confidence).toBe("high");
      expect(result.source).toBe("sale.report_saleorder_document");
      expect(result.description).toContain("t-call");
      expect(result.description).toContain("sale.report_saleorder_document");
      expect(result.suggestedFix).toContain("template");
      expect(result.filePath).toBe("views/report.xml");
      expect(result.lineNumber).toBe(50);
    });
  });

  describe("extractVariableName", () => {
    it("extracts from NameError format", () => {
      expect(extractVariableName("NameError: name 'numpy' is not defined")).toBe("numpy");
    });

    it("extracts from ReferenceError format", () => {
      expect(extractVariableName("ReferenceError: 'axios' is not defined")).toBe("axios");
    });

    it("extracts from undefined variable format", () => {
      expect(extractVariableName("undefined variable 'config'")).toBe("config");
    });

    it("extracts from simple 'is not defined' format", () => {
      expect(extractVariableName("myVar is not defined")).toBe("myVar");
    });

    it("returns null for non-matching messages", () => {
      expect(extractVariableName("SyntaxError: unexpected token")).toBeNull();
      expect(extractVariableName("Build completed successfully")).toBeNull();
    });
  });

  describe("extractTemplateName", () => {
    it("extracts from t-call format", () => {
      expect(extractTemplateName("t-call 'web.assets_frontend'")).toBe("web.assets_frontend");
    });

    it("extracts from template format", () => {
      expect(extractTemplateName("template 'portal.layout' not found")).toBe("portal.layout");
    });

    it("extracts from view format", () => {
      expect(extractTemplateName("view 'sale.order_form' cannot be found")).toBe("sale.order_form");
    });

    it("extracts from QWeb error format", () => {
      expect(extractTemplateName("QWeb error: template 'website.layout'")).toBe("website.layout");
    });

    it("returns null for non-matching messages", () => {
      expect(extractTemplateName("TypeError: undefined is not a function")).toBeNull();
    });
  });

  describe("analyzeError", () => {
    it("returns null for unrecognized errors", () => {
      const error: ErrorInput = {
        message: "Some random error message with no pattern",
      };

      expect(analyzeError(error)).toBeNull();
    });

    it("includes file path from error input", () => {
      const error: ErrorInput = {
        message: "NameError: name 'test' is not defined",
        file: "/app/src/module.py",
        line: 100,
      };

      const result = analyzeError(error);

      expect(result!.filePath).toBe("/app/src/module.py");
      expect(result!.lineNumber).toBe(100);
    });

    it("searches in both message and stack", () => {
      const error: ErrorInput = {
        message: "Error occurred",
        stack: "NameError: name 'hidden' is not defined\n  at module.py:10",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.source).toBe("hidden");
    });
  });

  describe("UNDEFINED_VARIABLE_PATTERNS coverage", () => {
    it("matches Python NameError", () => {
      const message = "NameError: name 'requests' is not defined";
      expect(isMissingImportError(message)).toBe(true);
    });

    it("matches JavaScript ReferenceError", () => {
      const message = "ReferenceError: 'fetch' is not defined";
      expect(isMissingImportError(message)).toBe(true);
    });

    it("matches 'cannot find name' pattern", () => {
      const message = "Cannot find name 'Component'";
      expect(isMissingImportError(message)).toBe(true);
    });

    it("matches 'resolve symbol' pattern", () => {
      const message = "Cannot resolve symbol 'Logger'";
      expect(isMissingImportError(message)).toBe(true);
    });
  });

  describe("TEMPLATE_ERROR_PATTERNS coverage", () => {
    it("matches t-call not found", () => {
      const message = "t-call 'web.layout' not found";
      expect(isMissingTemplateError(message)).toBe(true);
    });

    it("matches template missing", () => {
      const message = "template 'report.header' is missing";
      expect(isMissingTemplateError(message)).toBe(true);
    });

    it("matches QWeb exception", () => {
      const message = "QWeb exception: template 'sale.order'";
      expect(isMissingTemplateError(message)).toBe(true);
    });

    it("matches view cannot be found", () => {
      const message = "view 'product.form' cannot be found";
      expect(isMissingTemplateError(message)).toBe(true);
    });

    it("matches invalid XPath", () => {
      const message = "invalid XPath expression '//field[@name='invalid']'";
      expect(isMissingTemplateError(message)).toBe(true);
    });
  });

  describe("MISSING_FILE_PATTERNS", () => {
    it("matches file not found", () => {
      const error: ErrorInput = {
        message: "file 'config.json' not found",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("missing_file");
      expect(result!.source).toBe("config.json");
    });

    it("matches cannot open file", () => {
      const error: ErrorInput = {
        message: "cannot open '/etc/app/settings.yaml'",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("missing_file");
    });
  });

  describe("SYNTAX_ERROR_PATTERNS", () => {
    it("matches SyntaxError with details", () => {
      const error: ErrorInput = {
        message: "SyntaxError: unexpected EOF at 'script.py' line 42",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("syntax_error");
      expect(result!.lineNumber).toBe(42);
    });

    it("matches unexpected token", () => {
      const error: ErrorInput = {
        message: "unexpected token '}'",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("syntax_error");
      expect(result!.source).toBe("}");
    });
  });

  describe("TYPE_ERROR_PATTERNS", () => {
    it("matches TypeError not callable", () => {
      const error: ErrorInput = {
        message: "TypeError: 'dict' is not callable",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("type_error");
      expect(result!.source).toBe("dict");
    });

    it("matches cannot read property of undefined", () => {
      const error: ErrorInput = {
        message: "Cannot read property 'map' of undefined",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("type_error");
      expect(result!.source).toBe("map");
    });

    it("matches Python AttributeError", () => {
      const error: ErrorInput = {
        message: "AttributeError: 'NoneType' object has no attribute 'split'",
      };

      const result = analyzeError(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("type_error");
      expect(result!.source).toBe("split");
    });
  });

  describe("formatRootCause", () => {
    it("formats root cause with all details", () => {
      const rootCause: RootCause = {
        category: "missing_import",
        confidence: "high",
        description: "Variable 'lodash' is not defined",
        source: "lodash",
        suggestedFix: "Add: import lodash from 'lodash'",
        filePath: "/app/utils.js",
        lineNumber: 10,
      };

      const formatted = formatRootCause(rootCause);

      expect(formatted).toContain("[Missing Import]");
      expect(formatted).toContain("lodash");
      expect(formatted).toContain("/app/utils.js:10");
      expect(formatted).toContain("import lodash");
      expect(formatted).toContain("Confidence: high");
    });

    it("formats root cause without file path", () => {
      const rootCause: RootCause = {
        category: "syntax_error",
        confidence: "medium",
        description: "Unexpected token",
      };

      const formatted = formatRootCause(rootCause);

      expect(formatted).toContain("[Syntax Error]");
      expect(formatted).not.toContain("File:");
    });
  });

  describe("getConfidenceScore", () => {
    it("returns correct scores", () => {
      expect(getConfidenceScore("high")).toBe(3);
      expect(getConfidenceScore("medium")).toBe(2);
      expect(getConfidenceScore("low")).toBe(1);
    });
  });

  describe("CATEGORY_CONFIG", () => {
    it("provides config for all categories", () => {
      const categories: RootCauseCategory[] = [
        "missing_import",
        "missing_template",
        "missing_variable",
        "missing_file",
        "syntax_error",
        "type_error",
        "configuration_error",
        "dependency_error",
        "unknown",
      ];

      for (const category of categories) {
        expect(CATEGORY_CONFIG[category]).toBeDefined();
        expect(CATEGORY_CONFIG[category].label).toBeTruthy();
        expect(CATEGORY_CONFIG[category].icon).toBeTruthy();
        expect(CATEGORY_CONFIG[category].color).toBeTruthy();
      }
    });
  });

  describe("RootCauseAnalyzer class", () => {
    let analyzer: RootCauseAnalyzer;

    beforeEach(() => {
      analyzer = createRootCauseAnalyzer();
    });

    it("analyzes single error", () => {
      const error: ErrorInput = {
        message: "NameError: name 'numpy' is not defined",
      };

      const result = analyzer.analyze(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("missing_import");
    });

    it("caches analysis results", () => {
      const error: ErrorInput = {
        message: "NameError: name 'cached' is not defined",
        file: "test.py",
        line: 1,
      };

      const result1 = analyzer.analyze(error);
      const result2 = analyzer.analyze(error);

      expect(result1).toBe(result2); // Same reference from cache
    });

    it("clears cache", () => {
      const error: ErrorInput = {
        message: "NameError: name 'test' is not defined",
      };

      analyzer.analyze(error);
      analyzer.clearCache();

      // After clearing, analyzing again should still work
      const result = analyzer.analyze(error);
      expect(result).not.toBeNull();
    });

    it("analyzes multiple errors", () => {
      const errors: ErrorInput[] = [
        { message: "NameError: name 'pandas' is not defined" },
        { message: "t-call 'web.layout' not found" },
        { message: "SyntaxError: unexpected token" },
        { message: "Some random message" }, // Should be filtered out
      ];

      const results = analyzer.analyzeAll(errors);

      expect(results.length).toBe(3); // Only 3 matched
      expect(results.map((r) => r.category)).toContain("missing_import");
      expect(results.map((r) => r.category)).toContain("missing_template");
      expect(results.map((r) => r.category)).toContain("syntax_error");
    });

    it("gets most likely cause by confidence", () => {
      const errors: ErrorInput[] = [
        { message: "Cannot find name 'maybe'" }, // medium confidence
        { message: "NameError: name 'definitely' is not defined" }, // high confidence
      ];

      const mostLikely = analyzer.getMostLikelyCause(errors);

      expect(mostLikely).not.toBeNull();
      expect(mostLikely!.confidence).toBe("high");
      expect(mostLikely!.source).toBe("definitely");
    });

    it("returns null for no matching errors", () => {
      const errors: ErrorInput[] = [
        { message: "Random message 1" },
        { message: "Random message 2" },
      ];

      expect(analyzer.getMostLikelyCause(errors)).toBeNull();
    });

    it("accepts custom patterns", () => {
      const customAnalyzer = createRootCauseAnalyzer([
        {
          pattern: /custom error:\s*(\w+)/i,
          category: "configuration_error",
          confidence: "high",
          extract: (m) => ({
            source: m[1],
            description: `Custom error: ${m[1]}`,
          }),
        },
      ]);

      const error: ErrorInput = {
        message: "custom error: MyConfig",
      };

      const result = customAnalyzer.analyze(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("configuration_error");
      expect(result!.source).toBe("MyConfig");
    });

    it("can add patterns after construction", () => {
      analyzer.addPatterns([
        {
          pattern: /added pattern:\s*(\w+)/i,
          category: "dependency_error",
          confidence: "medium",
          extract: (m) => ({
            source: m[1],
            description: `Added: ${m[1]}`,
          }),
        },
      ]);

      const error: ErrorInput = {
        message: "added pattern: NewDep",
      };

      const result = analyzer.analyze(error);

      expect(result).not.toBeNull();
      expect(result!.category).toBe("dependency_error");
    });
  });

  describe("pattern arrays", () => {
    it("ALL_ROOT_CAUSE_PATTERNS contains all pattern sets", () => {
      const expectedCount =
        UNDEFINED_VARIABLE_PATTERNS.length +
        TEMPLATE_ERROR_PATTERNS.length +
        MISSING_FILE_PATTERNS.length +
        SYNTAX_ERROR_PATTERNS.length +
        TYPE_ERROR_PATTERNS.length;

      expect(ALL_ROOT_CAUSE_PATTERNS.length).toBe(expectedCount);
    });

    it("all patterns have required fields", () => {
      for (const pattern of ALL_ROOT_CAUSE_PATTERNS) {
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(typeof pattern.category).toBe("string");
        expect(["high", "medium", "low"]).toContain(pattern.confidence);
      }
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  ErrorAnalyzer,
  createErrorAnalyzer,
  analyzeError,
  analyzeErrorObject,
  formatStructuredError,
  isErrorMessage,
  type StructuredError,
  type ErrorType,
} from "@/lib/preview/error-analyzer";

describe("ErrorAnalyzer", () => {
  describe("TypeScript error parsing", () => {
    it("parses TypeScript error with parentheses format", () => {
      const raw = "src/app.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.";
      const result = analyzeError(raw);

      expect(result.type).toBe("typescript");
      expect(result.file).toBe("src/app.ts");
      expect(result.line).toBe(10);
      expect(result.column).toBe(5);
      expect(result.message).toContain("Type 'string' is not assignable");
      expect(result.context.code).toBe("TS2322");
    });

    it("parses TypeScript error with colon format", () => {
      const raw = "src/components/Button.tsx:25:10 - error TS2339: Property 'onClick' does not exist.";
      const result = analyzeError(raw);

      expect(result.type).toBe("typescript");
      expect(result.file).toBe("src/components/Button.tsx");
      expect(result.line).toBe(25);
      expect(result.column).toBe(10);
      expect(result.context.code).toBe("TS2339");
    });

    it("captures TypeScript error code", () => {
      const raw = "index.ts(1,1): error TS1005: ';' expected.";
      const result = analyzeError(raw);

      expect(result.context.code).toBe("TS1005");
    });
  });

  describe("SCSS error parsing", () => {
    it("parses SCSS error with file and line", () => {
      const raw = "Error: Undefined variable: $primary on line 15 of styles/theme.scss";
      const result = analyzeError(raw);

      expect(result.type).toBe("scss");
      expect(result.message).toContain("Undefined variable");
      expect(result.line).toBe(15);
    });

    it("parses dart-sass style error", () => {
      const raw = "styles/main.scss:42:10: Error: expected selector.";
      const result = analyzeError(raw);

      expect(result.type).toBe("scss");
      expect(result.file).toBe("styles/main.scss");
      expect(result.line).toBe(42);
      expect(result.column).toBe(10);
    });
  });

  describe("QWeb error parsing", () => {
    it("parses QWeb error format", () => {
      const raw = "[QWeb ERROR] templates/widget.xml:15:8 [my.widget] (t-foreach): Missing t-as directive";
      const result = analyzeError(raw);

      expect(result.type).toBe("qweb");
      expect(result.file).toBe("templates/widget.xml");
      expect(result.line).toBe(15);
      expect(result.column).toBe(8);
      expect(result.message).toContain("Missing t-as");
      expect(result.context.code).toBe("t-foreach");
      expect(result.context.related).toContain("template: my.widget");
    });

    it("parses QWeb warning format", () => {
      const raw = "[QWeb WARNING] snippet.xml:5 (t-raw): Deprecated directive";
      const result = analyzeError(raw);

      expect(result.type).toBe("qweb");
      expect(result.file).toBe("snippet.xml");
      expect(result.line).toBe(5);
    });
  });

  describe("JavaScript error parsing", () => {
    it("parses ESLint style error", () => {
      const raw = "src/utils/helpers.ts:30:15: Unexpected token ';'";
      const result = analyzeError(raw);

      expect(result.type).toBe("javascript");
      expect(result.file).toBe("src/utils/helpers.ts");
      expect(result.line).toBe(30);
      expect(result.column).toBe(15);
    });

    it("parses ReferenceError", () => {
      const raw = "ReferenceError: myVariable is not defined at eval (app.js:10:5)";
      const result = analyzeError(raw);

      expect(result.type).toBe("reference");
      expect(result.message).toContain("myVariable is not defined");
      expect(result.file).toBe("app.js");
      expect(result.line).toBe(10);
    });

    it("parses TypeError", () => {
      const raw = "TypeError: Cannot read property 'length' of undefined at Array.map (utils.js:25:12)";
      const result = analyzeError(raw);

      expect(result.type).toBe("type");
      expect(result.message).toContain("Cannot read property");
    });

    it("parses SyntaxError", () => {
      const raw = "SyntaxError: Unexpected token '{' at parse (script.js:5:1)";
      const result = analyzeError(raw);

      expect(result.type).toBe("syntax");
      expect(result.message).toContain("Unexpected token");
    });
  });

  describe("network error parsing", () => {
    it("detects network errors", () => {
      const raw = "Failed to load resource: net::ERR_CONNECTION_REFUSED";
      const result = analyzeError(raw);

      expect(result.type).toBe("network");
    });

    it("detects CORS errors", () => {
      const raw = "CORS policy blocked: No 'Access-Control-Allow-Origin' header";
      const result = analyzeError(raw);

      expect(result.type).toBe("network");
    });
  });

  describe("fallback parsing", () => {
    it("extracts location from unknown format", () => {
      const raw = "Something went wrong in myfile.ts:100:20";
      const result = analyzeError(raw);

      expect(result.file).toBe("myfile.ts");
      expect(result.line).toBe(100);
      expect(result.column).toBe(20);
    });

    it("returns unknown type for unrecognized errors", () => {
      const raw = "Something completely unexpected happened";
      const result = analyzeError(raw);

      expect(result.type).toBe("unknown");
      expect(result.message).toBeTruthy();
    });

    it("preserves raw error string", () => {
      const raw = "Custom error message here";
      const result = analyzeError(raw);

      expect(result.raw).toBe(raw);
    });
  });

  describe("Error object analysis", () => {
    it("analyzes Error object", () => {
      const error = new Error("Test error message");
      const result = analyzeErrorObject(error);

      expect(result.message).toContain("Test error message");
    });

    it("includes stack trace when enabled", () => {
      const error = new Error("With stack");
      const result = analyzeErrorObject(error, { includeStack: true });

      expect(result.context.stack).toBeTruthy();
    });

    it("detects type from TypeError", () => {
      const error = new TypeError("Type error message");
      const result = analyzeErrorObject(error);

      expect(result.type).toBe("type");
    });

    it("detects type from ReferenceError", () => {
      const error = new ReferenceError("Reference error message");
      const result = analyzeErrorObject(error);

      expect(result.type).toBe("reference");
    });

    it("detects type from SyntaxError", () => {
      const error = new SyntaxError("Syntax error message");
      const result = analyzeErrorObject(error);

      expect(result.type).toBe("syntax");
    });
  });

  describe("multiple error analysis", () => {
    it("parses multiple errors from combined output", () => {
      const raw = `src/app.ts(10,5): error TS2322: Type error
src/utils.ts(20,10): error TS2339: Property error
src/index.ts(5,1): error TS1005: Syntax error`;

      const analyzer = new ErrorAnalyzer();
      const results = analyzer.analyzeMultiple(raw);

      expect(results.length).toBe(3);
      expect(results[0].file).toBe("src/app.ts");
      expect(results[1].file).toBe("src/utils.ts");
      expect(results[2].file).toBe("src/index.ts");
    });

    it("handles mixed error types", () => {
      const raw = `src/app.ts(10,5): error TS2322: Type error
Error: SCSS compilation failed on line 5 of theme.scss`;

      const analyzer = new ErrorAnalyzer();
      const results = analyzer.analyzeMultiple(raw);

      expect(results.length).toBe(2);
      expect(results[0].type).toBe("typescript");
      expect(results[1].type).toBe("scss");
    });
  });

  describe("context extraction", () => {
    it("extracts suggestion from 'Did you mean'", () => {
      const raw = "Error: Unknown property 'colour'. Did you mean 'color'?";
      const result = analyzeError(raw);

      expect(result.context.suggestion).toBe("color");
    });

    it("extracts suggestion from 'Try'", () => {
      const raw = "Error: Missing module. Try: npm install lodash";
      const result = analyzeError(raw);

      expect(result.context.suggestion).toBe("npm install lodash");
    });

    it("extracts source snippet with line numbers", () => {
      const raw = `Error on line 10:
  10 | const x = y + z;
     |           ^
Undefined variable 'y'`;

      const result = analyzeError(raw, { extractSnippets: true });

      expect(result.context.sourceSnippet).toBeTruthy();
    });
  });

  describe("location extraction from snippets", () => {
    it("extracts location from caret indicator", () => {
      const raw = `  const x = broken code;
                   ^^^^^`;

      const analyzer = new ErrorAnalyzer();
      const location = analyzer.extractLocationFromSnippet(raw);

      expect(location).not.toBeNull();
      expect(location!.column).toBeGreaterThan(1);
    });

    it("extracts location from line number indicator", () => {
      const raw = `  10 | const x = y;
       |           ^`;

      const analyzer = new ErrorAnalyzer();
      const location = analyzer.extractLocationFromSnippet(raw);

      expect(location).not.toBeNull();
      expect(location!.line).toBe(10);
    });
  });
});

describe("createErrorAnalyzer", () => {
  it("creates analyzer instance", () => {
    const analyzer = createErrorAnalyzer();
    expect(analyzer).toBeInstanceOf(ErrorAnalyzer);
  });

  it("passes options through", () => {
    const analyzer = createErrorAnalyzer({ defaultFile: "default.ts" });
    const result = analyzer.analyze("Unknown error");

    expect(result.file).toBe("default.ts");
  });
});

describe("formatStructuredError", () => {
  it("formats complete error", () => {
    const error: StructuredError = {
      type: "typescript",
      file: "src/app.ts",
      line: 10,
      column: 5,
      message: "Type error occurred",
      context: {
        code: "TS2322",
        stack: null,
        sourceSnippet: null,
        related: [],
        suggestion: null,
        endLine: null,
        endColumn: null,
      },
      raw: "original",
    };

    const formatted = formatStructuredError(error);

    expect(formatted).toContain("[TYPESCRIPT]");
    expect(formatted).toContain("src/app.ts:10:5");
    expect(formatted).toContain("(TS2322)");
    expect(formatted).toContain("Type error occurred");
  });

  it("formats error with suggestion", () => {
    const error: StructuredError = {
      type: "unknown",
      file: null,
      line: null,
      column: null,
      message: "Unknown property",
      context: {
        code: null,
        stack: null,
        sourceSnippet: null,
        related: [],
        suggestion: "Use 'color' instead",
        endLine: null,
        endColumn: null,
      },
      raw: "original",
    };

    const formatted = formatStructuredError(error);

    expect(formatted).toContain("Suggestion:");
    expect(formatted).toContain("Use 'color' instead");
  });

  it("handles missing location", () => {
    const error: StructuredError = {
      type: "runtime",
      file: null,
      line: null,
      column: null,
      message: "Runtime error",
      context: {
        code: null,
        stack: null,
        sourceSnippet: null,
        related: [],
        suggestion: null,
        endLine: null,
        endColumn: null,
      },
      raw: "original",
    };

    const formatted = formatStructuredError(error);

    expect(formatted).toContain("[RUNTIME]");
    expect(formatted).toContain("Runtime error");
    expect(formatted).not.toContain("null");
  });
});

describe("isErrorMessage", () => {
  it("detects error keywords", () => {
    expect(isErrorMessage("Error: something failed")).toBe(true);
    expect(isErrorMessage("TypeError occurred")).toBe(true);
    expect(isErrorMessage("Cannot read property")).toBe(true);
    expect(isErrorMessage("Undefined variable")).toBe(true);
  });

  it("returns false for non-error text", () => {
    expect(isErrorMessage("Everything is working fine")).toBe(false);
    expect(isErrorMessage("Success!")).toBe(false);
  });
});

describe("verification: parses raw error into { type, file, line, message, context }", () => {
  it("captures all required fields from TypeScript error", () => {
    const raw = "src/components/Widget.tsx(42,15): error TS2345: Argument of type 'string' is not assignable.";
    const result = analyzeError(raw);

    // Type captured
    expect(result.type).toBe("typescript");

    // File captured
    expect(result.file).toBe("src/components/Widget.tsx");

    // Line captured
    expect(result.line).toBe(42);

    // Message captured
    expect(result.message).toBeTruthy();
    expect(result.message).toContain("Argument of type");

    // Context captured
    expect(result.context).toBeDefined();
    expect(result.context.code).toBe("TS2345");
  });

  it("captures all required fields from SCSS error", () => {
    const raw = "styles/theme.scss:25:10: Error: Undefined variable $primary-color";
    const result = analyzeError(raw);

    expect(result.type).toBe("scss");
    expect(result.file).toBe("styles/theme.scss");
    expect(result.line).toBe(25);
    expect(result.message).toBeTruthy();
    expect(result.context).toBeDefined();
  });

  it("captures all required fields from QWeb error", () => {
    const raw = "[QWeb ERROR] templates/page.xml:100:5 [website.page] (t-foreach): Directive requires t-as";
    const result = analyzeError(raw);

    expect(result.type).toBe("qweb");
    expect(result.file).toBe("templates/page.xml");
    expect(result.line).toBe(100);
    expect(result.message).toContain("Directive requires");
    expect(result.context).toBeDefined();
    expect(result.context.code).toBe("t-foreach");
    expect(result.context.related).toContain("template: website.page");
  });

  it("captures all required fields from JavaScript runtime error", () => {
    const raw = "TypeError: Cannot read properties of undefined (reading 'map') at render (app.js:55:20)";
    const result = analyzeError(raw);

    expect(result.type).toBe("type");
    expect(result.file).toBe("app.js");
    expect(result.line).toBe(55);
    expect(result.message).toContain("Cannot read properties");
    expect(result.context).toBeDefined();
  });
});

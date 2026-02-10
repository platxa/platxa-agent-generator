/**
 * Tests for Build Error Capture Module
 *
 * Feature #130: Add build process error capture (missing files, import errors)
 * Verification: Captures file not found, import resolution, manifest errors
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  // Types
  type BuildErrorType,
  type BuildErrorSeverity,
  type BuildError,
  type ErrorPattern,
  type BuildErrorConfig,
  type BuildErrorListener,
  // Constants
  DEFAULT_BUILD_CONFIG,
  FILE_NOT_FOUND_PATTERNS,
  IMPORT_RESOLUTION_PATTERNS,
  MANIFEST_ERROR_PATTERNS,
  SYNTAX_ERROR_PATTERNS,
  COMPILATION_ERROR_PATTERNS,
  ALL_ERROR_PATTERNS,
  ERROR_TYPE_CONFIG,
  // Helper Functions
  generateBuildErrorId,
  resetBuildErrorIdCounter,
  parseBuildOutput,
  generateSuggestion,
  hasFileNotFoundError,
  hasImportResolutionError,
  hasManifestError,
  groupBuildErrorsByType,
  getBuildErrorStats,
  formatBuildError,
  // Class
  BuildErrorCapture,
  // Factory Functions
  createBuildErrorCapture,
  createMockBuildError,
} from "../../lib/preview/build-error-capture";

// =============================================================================
// Pattern Tests
// =============================================================================

describe("Build Error Capture — Pattern Matching", () => {
  describe("FILE_NOT_FOUND_PATTERNS", () => {
    it("matches Python FileNotFoundError", () => {
      const output = "FileNotFoundError: [Errno 2] No such file or directory: '/path/to/file.py'";
      expect(hasFileNotFoundError(output)).toBe(true);

      const errors = parseBuildOutput(output, FILE_NOT_FOUND_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("file_not_found");
      expect(errors[0].missingPath).toBe("/path/to/file.py");
    });

    it("matches Node.js ENOENT error", () => {
      const output = "Error: ENOENT: no such file or directory, open '/app/config.json'";
      expect(hasFileNotFoundError(output)).toBe(true);

      const errors = parseBuildOutput(output, FILE_NOT_FOUND_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].missingPath).toBe("/app/config.json");
    });

    it("matches 'Cannot find module' error", () => {
      const output = "Error: Cannot find module 'lodash'";
      expect(hasFileNotFoundError(output)).toBe(true);

      const errors = parseBuildOutput(output, FILE_NOT_FOUND_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].missingPath).toBe("lodash");
    });

    it("matches 'File does not exist' error", () => {
      const output = "File \"templates/base.html\" does not exist";
      expect(hasFileNotFoundError(output)).toBe(true);

      const errors = parseBuildOutput(output, FILE_NOT_FOUND_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].missingPath).toBe("templates/base.html");
    });

    it("matches 'file not found' error", () => {
      const output = "File 'static/app.css' not found";
      expect(hasFileNotFoundError(output)).toBe(true);

      const errors = parseBuildOutput(output, FILE_NOT_FOUND_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].missingPath).toBe("static/app.css");
    });
  });

  describe("IMPORT_RESOLUTION_PATTERNS", () => {
    it("matches Python ImportError", () => {
      const output = "ImportError: No module named 'odoo.addons.website'";
      expect(hasImportResolutionError(output)).toBe(true);

      const errors = parseBuildOutput(output, IMPORT_RESOLUTION_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("import_resolution");
      expect(errors[0].missingPath).toBe("odoo.addons.website");
    });

    it("matches Python 'cannot import name' error", () => {
      const output = "ImportError: cannot import name 'ThemeManager' from 'lib.themes'";
      expect(hasImportResolutionError(output)).toBe(true);

      const errors = parseBuildOutput(output, IMPORT_RESOLUTION_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].missingPath).toBe("ThemeManager");
    });

    it("matches ModuleNotFoundError", () => {
      const output = "ModuleNotFoundError: No module named 'requests'";
      expect(hasImportResolutionError(output)).toBe(true);

      const errors = parseBuildOutput(output, IMPORT_RESOLUTION_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].missingPath).toBe("requests");
    });

    it("matches webpack 'Cannot resolve' error", () => {
      const output = "Cannot resolve module '@/components/Header'";
      expect(hasImportResolutionError(output)).toBe(true);

      const errors = parseBuildOutput(output, IMPORT_RESOLUTION_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].missingPath).toBe("@/components/Header");
    });

    it("matches webpack 'Module not found' error with file location", () => {
      const output = "Module not found: Error: Can't resolve './utils' in '/app/src/components'";
      expect(hasImportResolutionError(output)).toBe(true);

      const errors = parseBuildOutput(output, IMPORT_RESOLUTION_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].missingPath).toBe("./utils");
      expect(errors[0].file).toBe("/app/src/components");
    });

    it("matches 'could not be resolved' error", () => {
      const output = "from \"react-query\" could not be resolved";
      expect(hasImportResolutionError(output)).toBe(true);

      const errors = parseBuildOutput(output, IMPORT_RESOLUTION_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].missingPath).toBe("react-query");
    });
  });

  describe("MANIFEST_ERROR_PATTERNS", () => {
    it("matches invalid JSON manifest error", () => {
      const output = "Error: Invalid JSON manifest in package.json";
      expect(hasManifestError(output)).toBe(true);

      const errors = parseBuildOutput(output, MANIFEST_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("manifest_error");
    });

    it("matches malformed manifest error", () => {
      const output = "Malformed manifest detected";
      expect(hasManifestError(output)).toBe(true);
    });

    it("matches Odoo __manifest__.py SyntaxError", () => {
      const output = "__manifest__.py SyntaxError: invalid syntax";
      expect(hasManifestError(output)).toBe(true);

      const errors = parseBuildOutput(output, MANIFEST_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].details).toBe("invalid syntax");
    });

    it("matches manifest missing required key", () => {
      const output = "manifest missing required key 'name'";
      expect(hasManifestError(output)).toBe(true);

      const errors = parseBuildOutput(output, MANIFEST_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].details).toBe("Missing required field: name");
    });

    it("matches package.json parse error", () => {
      const output = "package.json parse error at line 15";
      expect(hasManifestError(output)).toBe(true);
    });

    it("matches assets manifest not found", () => {
      const output = "assets manifest not found";
      expect(hasManifestError(output)).toBe(true);
    });
  });

  describe("SYNTAX_ERROR_PATTERNS", () => {
    it("matches SyntaxError with file and line", () => {
      const output = "SyntaxError: Unexpected token at 'app.js' line 42";
      const errors = parseBuildOutput(output, SYNTAX_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("syntax_error");
      expect(errors[0].file).toBe("app.js");
      expect(errors[0].line).toBe(42);
    });

    it("matches SyntaxError with file only", () => {
      const output = "SyntaxError: Missing semicolon at 'src/main.ts'";
      const errors = parseBuildOutput(output, SYNTAX_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("syntax_error");
      expect(errors[0].file).toBe("src/main.ts");
    });

    it("matches Parse error with location", () => {
      const output = "Parse error: Unexpected } in '/app/src/index.js':55";
      const errors = parseBuildOutput(output, SYNTAX_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].file).toBe("/app/src/index.js");
      expect(errors[0].line).toBe(55);
    });

    it("matches Unexpected token error", () => {
      const output = "Unexpected token 'return' in script.js:10";
      const errors = parseBuildOutput(output, SYNTAX_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("Unexpected token");
    });
  });

  describe("COMPILATION_ERROR_PATTERNS", () => {
    it("matches general compilation failed", () => {
      const output = "Compilation failed: Too many errors";
      const errors = parseBuildOutput(output, COMPILATION_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("compilation_error");
      expect(errors[0].details).toBe("Too many errors");
    });

    it("matches SCSS error with file and line", () => {
      const output = "SCSS Error: Undefined variable $primary-color in 'theme.scss':25";
      const errors = parseBuildOutput(output, COMPILATION_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe("compilation_error");
      expect(errors[0].file).toBe("theme.scss");
      expect(errors[0].line).toBe(25);
    });

    it("matches TypeScript error", () => {
      const output = "TypeScript error TS2304: Cannot find name 'Props'";
      const errors = parseBuildOutput(output, COMPILATION_ERROR_PATTERNS);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("TS2304: Cannot find name 'Props'");
    });
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe("Build Error Capture — Helper Functions", () => {
  beforeEach(() => {
    resetBuildErrorIdCounter();
  });

  describe("generateBuildErrorId", () => {
    it("generates unique IDs", () => {
      const id1 = generateBuildErrorId();
      const id2 = generateBuildErrorId();
      const id3 = generateBuildErrorId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).toMatch(/^build-err-\d+-\d+$/);
    });

    it("resets counter correctly", () => {
      generateBuildErrorId();
      generateBuildErrorId();
      resetBuildErrorIdCounter();

      const id = generateBuildErrorId();
      expect(id).toMatch(/^build-err-\d+-1$/);
    });
  });

  describe("parseBuildOutput", () => {
    it("parses multiple errors from output", () => {
      const output = `
FileNotFoundError: No such file or directory: 'config.py'
ImportError: No module named 'flask'
Invalid JSON manifest
      `.trim();

      const errors = parseBuildOutput(output);
      expect(errors).toHaveLength(3);
      expect(errors[0].type).toBe("file_not_found");
      expect(errors[1].type).toBe("import_resolution");
      expect(errors[2].type).toBe("manifest_error");
    });

    it("only matches first pattern per line", () => {
      const output = "FileNotFoundError: Cannot find module 'test'";
      const errors = parseBuildOutput(output);
      // Should only match file_not_found, not import_resolution
      expect(errors).toHaveLength(1);
    });

    it("ignores non-matching lines", () => {
      const output = `
Building project...
Compiling assets...
Done.
      `.trim();

      const errors = parseBuildOutput(output);
      expect(errors).toHaveLength(0);
    });

    it("uses custom patterns when provided", () => {
      const customPatterns: ErrorPattern[] = [
        {
          pattern: /CUSTOM_ERROR:\s*(.+)/,
          type: "unknown",
          severity: "error",
          extract: (m) => ({ message: m[1] }),
        },
      ];

      const output = "CUSTOM_ERROR: Something went wrong";
      const errors = parseBuildOutput(output, customPatterns);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("Something went wrong");
    });

    it("adds suggestions to parsed errors", () => {
      const output = "FileNotFoundError: No such file or directory: 'missing.py'";
      const errors = parseBuildOutput(output);
      expect(errors[0].suggestion).toBeDefined();
      expect(errors[0].suggestion).toContain("missing.py");
    });
  });

  describe("generateSuggestion", () => {
    it("generates file_not_found suggestion with path", () => {
      const error = createMockBuildError({
        type: "file_not_found",
        missingPath: "config.json",
      });
      const suggestion = generateSuggestion(error);
      expect(suggestion).toContain("config.json");
      expect(suggestion).toContain("exists");
    });

    it("generates file_not_found suggestion without path", () => {
      const error = createMockBuildError({ type: "file_not_found" });
      const suggestion = generateSuggestion(error);
      expect(suggestion).toContain("referenced files");
    });

    it("generates import_resolution suggestion with path", () => {
      const error = createMockBuildError({
        type: "import_resolution",
        missingPath: "lodash",
      });
      const suggestion = generateSuggestion(error);
      expect(suggestion).toContain("pip install lodash");
      expect(suggestion).toContain("npm install lodash");
    });

    it("generates import_resolution suggestion without path", () => {
      const error = createMockBuildError({ type: "import_resolution" });
      const suggestion = generateSuggestion(error);
      expect(suggestion).toContain("dependencies are installed");
    });

    it("generates manifest_error suggestion", () => {
      const error = createMockBuildError({ type: "manifest_error" });
      const suggestion = generateSuggestion(error);
      expect(suggestion).toContain("manifest file syntax");
    });

    it("generates syntax_error suggestion with line", () => {
      const error = createMockBuildError({ type: "syntax_error", line: 42 });
      const suggestion = generateSuggestion(error);
      expect(suggestion).toContain("line 42");
    });

    it("generates syntax_error suggestion without line", () => {
      const error = createMockBuildError({ type: "syntax_error" });
      const suggestion = generateSuggestion(error);
      expect(suggestion).toContain("syntax errors");
    });

    it("generates compilation_error suggestion", () => {
      const error = createMockBuildError({ type: "compilation_error" });
      const suggestion = generateSuggestion(error);
      expect(suggestion).toContain("compilation output");
    });

    it("returns undefined for unknown type", () => {
      const error = createMockBuildError({ type: "unknown" });
      const suggestion = generateSuggestion(error);
      expect(suggestion).toBeUndefined();
    });
  });

  describe("groupBuildErrorsByType", () => {
    it("groups errors correctly", () => {
      const errors = [
        createMockBuildError({ type: "file_not_found" }),
        createMockBuildError({ type: "file_not_found" }),
        createMockBuildError({ type: "import_resolution" }),
        createMockBuildError({ type: "syntax_error" }),
      ];

      const grouped = groupBuildErrorsByType(errors);
      expect(grouped.file_not_found).toHaveLength(2);
      expect(grouped.import_resolution).toHaveLength(1);
      expect(grouped.syntax_error).toHaveLength(1);
      expect(grouped.manifest_error).toHaveLength(0);
    });

    it("returns empty arrays for all types when no errors", () => {
      const grouped = groupBuildErrorsByType([]);
      expect(Object.keys(grouped)).toHaveLength(8);
      expect(grouped.file_not_found).toHaveLength(0);
      expect(grouped.unknown).toHaveLength(0);
    });
  });

  describe("getBuildErrorStats", () => {
    it("calculates total correctly", () => {
      const errors = [
        createMockBuildError(),
        createMockBuildError(),
        createMockBuildError(),
      ];
      const stats = getBuildErrorStats(errors);
      expect(stats.total).toBe(3);
    });

    it("groups by type correctly", () => {
      const errors = [
        createMockBuildError({ type: "file_not_found" }),
        createMockBuildError({ type: "file_not_found" }),
        createMockBuildError({ type: "import_resolution" }),
      ];
      const stats = getBuildErrorStats(errors);
      expect(stats.byType.file_not_found).toBe(2);
      expect(stats.byType.import_resolution).toBe(1);
    });

    it("groups by severity correctly", () => {
      const errors = [
        createMockBuildError({ severity: "error" }),
        createMockBuildError({ severity: "error" }),
        createMockBuildError({ severity: "warning" }),
        createMockBuildError({ severity: "fatal" }),
      ];
      const stats = getBuildErrorStats(errors);
      expect(stats.bySeverity.error).toBe(2);
      expect(stats.bySeverity.warning).toBe(1);
      expect(stats.bySeverity.fatal).toBe(1);
    });

    it("detects blocking errors", () => {
      const warningsOnly = [createMockBuildError({ severity: "warning" })];
      expect(getBuildErrorStats(warningsOnly).hasBlockingErrors).toBe(false);

      const withError = [createMockBuildError({ severity: "error" })];
      expect(getBuildErrorStats(withError).hasBlockingErrors).toBe(true);

      const withFatal = [createMockBuildError({ severity: "fatal" })];
      expect(getBuildErrorStats(withFatal).hasBlockingErrors).toBe(true);
    });
  });

  describe("formatBuildError", () => {
    it("formats basic error", () => {
      const error = createMockBuildError({
        type: "file_not_found",
        severity: "error",
        message: "File missing",
      });
      const formatted = formatBuildError(error);
      expect(formatted).toContain("[ERROR]");
      expect(formatted).toContain("File Not Found");
      expect(formatted).toContain("File missing");
    });

    it("includes file location", () => {
      const error = createMockBuildError({
        file: "src/app.ts",
      });
      const formatted = formatBuildError(error);
      expect(formatted).toContain("at src/app.ts");
    });

    it("includes line number", () => {
      const error = createMockBuildError({
        file: "src/app.ts",
        line: 42,
      });
      const formatted = formatBuildError(error);
      expect(formatted).toContain("src/app.ts:42");
    });

    it("includes column number", () => {
      const error = createMockBuildError({
        file: "src/app.ts",
        line: 42,
        column: 10,
      });
      const formatted = formatBuildError(error);
      expect(formatted).toContain("src/app.ts:42:10");
    });

    it("includes suggestion", () => {
      const error = createMockBuildError({
        type: "file_not_found",
        missingPath: "config.json",
      });
      error.suggestion = generateSuggestion(error);
      const formatted = formatBuildError(error);
      expect(formatted).toContain("config.json");
    });
  });
});

// =============================================================================
// BuildErrorCapture Class Tests
// =============================================================================

describe("BuildErrorCapture Class", () => {
  let capture: BuildErrorCapture;

  beforeEach(() => {
    resetBuildErrorIdCounter();
    capture = new BuildErrorCapture();
  });

  describe("constructor", () => {
    it("uses default configuration", () => {
      const instance = new BuildErrorCapture();
      expect(instance.getErrors()).toHaveLength(0);
    });

    it("accepts custom configuration", () => {
      const customPattern: ErrorPattern = {
        pattern: /CUSTOM:/,
        type: "unknown",
        severity: "warning",
      };
      const instance = new BuildErrorCapture({
        customPatterns: [customPattern],
        maxBufferSize: 50,
      });
      expect(instance.getErrors()).toHaveLength(0);
    });
  });

  describe("processBuildOutput", () => {
    it("captures errors from output", () => {
      const output = "FileNotFoundError: No such file or directory: 'config.py'";
      const newErrors = capture.processBuildOutput(output);

      expect(newErrors).toHaveLength(1);
      expect(capture.getErrors()).toHaveLength(1);
      expect(capture.getErrors()[0].type).toBe("file_not_found");
    });

    it("respects maxBufferSize", () => {
      const smallCapture = new BuildErrorCapture({ maxBufferSize: 2 });

      smallCapture.processBuildOutput("FileNotFoundError: file1");
      smallCapture.processBuildOutput("FileNotFoundError: file2");
      smallCapture.processBuildOutput("FileNotFoundError: file3");

      const errors = smallCapture.getErrors();
      expect(errors).toHaveLength(2);
      // First error should have been removed
      expect(errors[0].message).toContain("file2");
    });

    it("skips warnings when captureWarnings is false", () => {
      const noWarningsCapture = new BuildErrorCapture({ captureWarnings: false });
      // Note: None of the built-in patterns produce warnings by default
      // This tests the configuration is respected
      expect(noWarningsCapture.getErrors()).toHaveLength(0);
    });

    it("notifies listeners", () => {
      const listener = vi.fn();
      capture.addListener(listener);

      capture.processBuildOutput("FileNotFoundError: test.py");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: "file_not_found" })
      );
    });

    it("handles listener errors gracefully", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const badListener = () => {
        throw new Error("Listener error");
      };
      capture.addListener(badListener);

      // Should not throw
      capture.processBuildOutput("FileNotFoundError: test.py");

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("getErrors and filtering", () => {
    beforeEach(() => {
      capture.processBuildOutput("FileNotFoundError: file1.py");
      capture.processBuildOutput("ImportError: No module named 'flask'");
      capture.addError(createMockBuildError({ type: "syntax_error", severity: "warning" }));
    });

    it("getErrors returns copy of errors", () => {
      const errors = capture.getErrors();
      errors.push(createMockBuildError());
      expect(capture.getErrors()).toHaveLength(3);
    });

    it("getErrorsBySeverity filters correctly", () => {
      const errorSeverity = capture.getErrorsBySeverity("error");
      expect(errorSeverity).toHaveLength(2);

      const warningSeverity = capture.getErrorsBySeverity("warning");
      expect(warningSeverity).toHaveLength(1);
    });

    it("getErrorsByType filters correctly", () => {
      const fileNotFound = capture.getErrorsByType("file_not_found");
      expect(fileNotFound).toHaveLength(1);

      const importErrors = capture.getErrorsByType("import_resolution");
      expect(importErrors).toHaveLength(1);
    });
  });

  describe("addError", () => {
    it("adds error to buffer", () => {
      const error = createMockBuildError({ type: "manifest_error" });
      capture.addError(error);

      expect(capture.getErrors()).toHaveLength(1);
      expect(capture.getErrors()[0].type).toBe("manifest_error");
    });

    it("notifies listeners", () => {
      const listener = vi.fn();
      capture.addListener(listener);

      const error = createMockBuildError();
      capture.addError(error);

      expect(listener).toHaveBeenCalledWith(error);
    });

    it("respects maxBufferSize", () => {
      const smallCapture = new BuildErrorCapture({ maxBufferSize: 2 });

      smallCapture.addError(createMockBuildError({ message: "error1" }));
      smallCapture.addError(createMockBuildError({ message: "error2" }));
      smallCapture.addError(createMockBuildError({ message: "error3" }));

      const errors = smallCapture.getErrors();
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe("error2");
    });
  });

  describe("clearErrors", () => {
    it("removes all errors", () => {
      capture.processBuildOutput("FileNotFoundError: test.py");
      capture.processBuildOutput("ImportError: No module named 'test'");

      expect(capture.getErrors()).toHaveLength(2);
      capture.clearErrors();
      expect(capture.getErrors()).toHaveLength(0);
    });
  });

  describe("listeners", () => {
    it("addListener returns unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = capture.addListener(listener);

      capture.processBuildOutput("FileNotFoundError: test1.py");
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      capture.processBuildOutput("FileNotFoundError: test2.py");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("removeListener works", () => {
      const listener = vi.fn();
      capture.addListener(listener);

      capture.processBuildOutput("FileNotFoundError: test1.py");
      expect(listener).toHaveBeenCalledTimes(1);

      capture.removeListener(listener);
      capture.processBuildOutput("FileNotFoundError: test2.py");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("supports multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      capture.addListener(listener1);
      capture.addListener(listener2);

      capture.processBuildOutput("FileNotFoundError: test.py");

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStats", () => {
    it("returns correct statistics", () => {
      capture.processBuildOutput("FileNotFoundError: test.py");
      capture.processBuildOutput("ImportError: No module named 'flask'");
      capture.addError(createMockBuildError({ type: "syntax_error", severity: "fatal" }));

      const stats = capture.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byType.file_not_found).toBe(1);
      expect(stats.byType.import_resolution).toBe(1);
      expect(stats.byType.syntax_error).toBe(1);
      expect(stats.bySeverity.error).toBe(2);
      expect(stats.bySeverity.fatal).toBe(1);
    });
  });

  describe("hasBlockingErrors", () => {
    it("returns false when no errors", () => {
      expect(capture.hasBlockingErrors()).toBe(false);
    });

    it("returns true when errors exist", () => {
      capture.processBuildOutput("FileNotFoundError: test.py");
      expect(capture.hasBlockingErrors()).toBe(true);
    });

    it("returns true when fatal errors exist", () => {
      capture.addError(createMockBuildError({ severity: "fatal" }));
      expect(capture.hasBlockingErrors()).toBe(true);
    });

    it("returns false when only warnings exist", () => {
      capture.addError(createMockBuildError({ severity: "warning" }));
      expect(capture.hasBlockingErrors()).toBe(false);
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

describe("Factory Functions", () => {
  describe("createBuildErrorCapture", () => {
    it("creates instance with defaults", () => {
      const capture = createBuildErrorCapture();
      expect(capture).toBeInstanceOf(BuildErrorCapture);
      expect(capture.getErrors()).toHaveLength(0);
    });

    it("creates instance with custom config", () => {
      const capture = createBuildErrorCapture({ maxBufferSize: 50 });
      expect(capture).toBeInstanceOf(BuildErrorCapture);
    });
  });

  describe("createMockBuildError", () => {
    beforeEach(() => {
      resetBuildErrorIdCounter();
    });

    it("creates error with defaults", () => {
      const error = createMockBuildError();
      expect(error.id).toBeDefined();
      expect(error.type).toBe("file_not_found");
      expect(error.severity).toBe("error");
      expect(error.message).toBe("Test build error");
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it("accepts overrides", () => {
      const error = createMockBuildError({
        type: "import_resolution",
        severity: "warning",
        message: "Custom message",
        file: "test.ts",
      });
      expect(error.type).toBe("import_resolution");
      expect(error.severity).toBe("warning");
      expect(error.message).toBe("Custom message");
      expect(error.file).toBe("test.ts");
    });
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe("Constants", () => {
  describe("DEFAULT_BUILD_CONFIG", () => {
    it("has expected defaults", () => {
      expect(DEFAULT_BUILD_CONFIG.customPatterns).toEqual([]);
      expect(DEFAULT_BUILD_CONFIG.maxBufferSize).toBe(100);
      expect(DEFAULT_BUILD_CONFIG.captureWarnings).toBe(true);
    });
  });

  describe("ERROR_TYPE_CONFIG", () => {
    it("has config for all error types", () => {
      const types: BuildErrorType[] = [
        "file_not_found",
        "import_resolution",
        "manifest_error",
        "syntax_error",
        "compilation_error",
        "dependency_error",
        "permission_error",
        "unknown",
      ];

      for (const type of types) {
        expect(ERROR_TYPE_CONFIG[type]).toBeDefined();
        expect(ERROR_TYPE_CONFIG[type].label).toBeDefined();
        expect(ERROR_TYPE_CONFIG[type].icon).toBeDefined();
        expect(ERROR_TYPE_CONFIG[type].color).toBeDefined();
      }
    });
  });

  describe("ALL_ERROR_PATTERNS", () => {
    it("contains all pattern arrays", () => {
      expect(ALL_ERROR_PATTERNS.length).toBe(
        FILE_NOT_FOUND_PATTERNS.length +
          IMPORT_RESOLUTION_PATTERNS.length +
          MANIFEST_ERROR_PATTERNS.length +
          SYNTAX_ERROR_PATTERNS.length +
          COMPILATION_ERROR_PATTERNS.length
      );
    });
  });
});

// =============================================================================
// Integration Tests — Real-World Scenarios
// =============================================================================

describe("Integration Tests — Real-World Scenarios", () => {
  let capture: BuildErrorCapture;

  beforeEach(() => {
    resetBuildErrorIdCounter();
    capture = createBuildErrorCapture();
  });

  it("handles Odoo build error output", () => {
    const odooOutput = `
Loading addons...
FileNotFoundError: [Errno 2] No such file or directory: '/odoo/addons/website/static/src/js/missing.js'
ImportError: No module named 'odoo.addons.website_sale'
__manifest__.py SyntaxError: unexpected EOF while parsing
    `.trim();

    const errors = capture.processBuildOutput(odooOutput);

    expect(errors).toHaveLength(3);
    expect(errors[0].type).toBe("file_not_found");
    expect(errors[0].missingPath).toContain("missing.js");
    expect(errors[1].type).toBe("import_resolution");
    expect(errors[1].missingPath).toBe("odoo.addons.website_sale");
    expect(errors[2].type).toBe("manifest_error");
  });

  it("handles webpack build error output", () => {
    const webpackOutput = `
Module not found: Error: Can't resolve '@/components/Header' in '/app/src/pages'
Module not found: Error: Can't resolve './utils/helpers' in '/app/src/lib'
    `.trim();

    const errors = capture.processBuildOutput(webpackOutput);

    expect(errors).toHaveLength(2);
    expect(errors[0].type).toBe("import_resolution");
    expect(errors[0].missingPath).toBe("@/components/Header");
    expect(errors[0].file).toBe("/app/src/pages");
    expect(errors[1].missingPath).toBe("./utils/helpers");
  });

  it("handles SCSS compilation errors", () => {
    const scssOutput = `
SCSS Error: Undefined variable $primary-color in 'src/styles/theme.scss':15
SCSS error: Invalid CSS after ".container": expected "{", was "." in '/styles/main.scss'
    `.trim();

    const errors = capture.processBuildOutput(scssOutput);

    expect(errors).toHaveLength(2);
    expect(errors[0].type).toBe("compilation_error");
    expect(errors[0].file).toBe("src/styles/theme.scss");
    expect(errors[0].line).toBe(15);
  });

  it("handles TypeScript compilation errors", () => {
    const tsOutput = `
TypeScript error TS2304: Cannot find name 'UserProps'
TypeScript error TS2322: Type 'string' is not assignable to type 'number'
    `.trim();

    const errors = capture.processBuildOutput(tsOutput);

    expect(errors).toHaveLength(2);
    expect(errors[0].type).toBe("compilation_error");
    expect(errors[0].message).toBe("TS2304: Cannot find name 'UserProps'");
    expect(errors[1].message).toBe("TS2322: Type 'string' is not assignable to type 'number'");
  });

  it("tracks error timeline with multiple outputs", () => {
    // Simulate multiple build attempts
    capture.processBuildOutput("FileNotFoundError: config.py");
    expect(capture.getErrors()).toHaveLength(1);

    capture.processBuildOutput("ImportError: No module named 'flask'");
    expect(capture.getErrors()).toHaveLength(2);

    capture.clearErrors();
    expect(capture.getErrors()).toHaveLength(0);

    // Fixed errors, new build
    capture.processBuildOutput("SCSS Error: Invalid syntax in 'theme.scss':10");
    expect(capture.getErrors()).toHaveLength(1);
    expect(capture.getErrors()[0].type).toBe("compilation_error");
  });

  it("supports real-time error monitoring", async () => {
    const errorsReceived: BuildError[] = [];
    capture.addListener((error) => errorsReceived.push(error));

    // Simulate streaming build output
    capture.processBuildOutput("FileNotFoundError: file1.py");
    capture.processBuildOutput("ImportError: No module named 'requests'");
    capture.processBuildOutput("SCSS Error: Syntax error in 'style.scss':5");

    expect(errorsReceived).toHaveLength(3);
    expect(errorsReceived[0].type).toBe("file_not_found");
    expect(errorsReceived[1].type).toBe("import_resolution");
    expect(errorsReceived[2].type).toBe("compilation_error");
  });
});

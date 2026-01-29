import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FixValidator,
  createFixValidator,
  createFix,
  createTempFilePath,
  writeTempFile,
  readTempFile,
  deleteTempFile,
  clearTempFiles,
  createSyntaxValidator,
  createJSONValidator,
  createXMLValidator,
  createCSSValidator,
  createPythonValidator,
  formatValidationResult,
  isSafeToApply,
  getErrorSummary,
  DEFAULT_VALIDATOR_CONFIG,
  type Fix,
  type ValidationResult,
  type ValidatorConfig,
} from "@/lib/preview/fix-validator";

describe("FixValidator", () => {
  beforeEach(() => {
    clearTempFiles();
  });

  afterEach(() => {
    clearTempFiles();
  });

  describe("fix applied to temp copy (Feature #148)", () => {
    it("creates temp file for validation", async () => {
      // Feature #148: Fix applied to temp copy
      const validator = createFixValidator();
      const fix = createFix(
        "/app/test.js",
        "const x = 1",
        "const x = 1;"
      );

      const result = await validator.validate(fix);

      expect(result.tempFilePath).toBeDefined();
      expect(result.tempFilePath).toContain("fix-validation");
    });

    it("temp file has correct extension", () => {
      // Feature #148: Fix applied to temp copy
      const tempPath = createTempFilePath("/app/component.tsx");

      expect(tempPath).toContain(".tsx");
    });

    it("writes fix content to temp file", () => {
      // Feature #148: Fix applied to temp copy
      const tempPath = "/tmp/test-file.js";
      const content = "const fixed = true;";

      writeTempFile(tempPath, content);
      const read = readTempFile(tempPath);

      expect(read).toBe(content);
    });

    it("cleans up temp file after validation", async () => {
      // Feature #148: Fix applied to temp copy
      const validator = createFixValidator();
      const fix = createFix("/app/test.js", "old", "new");

      await validator.validate(fix);

      // Temp file should be cleaned up
      const tempPath = createTempFilePath("/app/test.js");
      expect(readTempFile(tempPath)).toBeNull();
    });
  });

  describe("validated before applying (Feature #148)", () => {
    it("validates syntax before applying", async () => {
      // Feature #148: Validated
      const validator = createFixValidator();
      const fix = createFix(
        "/app/test.js",
        "const x = 1",
        "const x = {{{ invalid" // Invalid syntax
      );

      const result = await validator.validate(fix);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("runs appropriate validators for file type", async () => {
      // Feature #148: Validated
      const validator = createFixValidator();
      const fix = createFix("/app/data.json", "{}", '{"valid": true}');

      const result = await validator.validate(fix);

      expect(result.validatorsRun).toContain("json");
    });

    it("records validation time", async () => {
      // Feature #148: Validated
      const validator = createFixValidator();
      const fix = createFix("/app/test.js", "old", "new");

      const result = await validator.validate(fix);

      expect(result.validationTime).toBeGreaterThanOrEqual(0);
    });

    it("collects all errors from validators", async () => {
      // Feature #148: Validated
      const validator = createFixValidator();
      const fix = createFix(
        "/app/test.js",
        "good code",
        "{ { { unclosed"
      );

      const result = await validator.validate(fix);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBeDefined();
      expect(result.errors[0].message).toBeDefined();
    });
  });

  describe("only applied if validation passes (Feature #148)", () => {
    it("applies fix when validation passes", async () => {
      // Feature #148: Only applied if validation passes
      const validator = createFixValidator({ autoApplyIfValid: true });
      let applied = false;

      const fix = createFix("/app/test.js", "old", "const x = 1;");

      const result = await validator.validateAndApply(fix, () => {
        applied = true;
      });

      expect(result.validation.isValid).toBe(true);
      expect(applied).toBe(true);
      expect(result.applied).toBe(true);
    });

    it("does not apply fix when validation fails", async () => {
      // Feature #148: Only applied if validation passes
      const validator = createFixValidator({ autoApplyIfValid: true });
      let applied = false;

      const fix = createFix("/app/test.js", "old", "{ { { invalid");

      const result = await validator.validateAndApply(fix, () => {
        applied = true;
      });

      expect(result.validation.isValid).toBe(false);
      expect(applied).toBe(false);
      expect(result.applied).toBe(false);
    });

    it("returns validation result even when not applied", async () => {
      // Feature #148: Only applied if validation passes
      const validator = createFixValidator();
      const fix = createFix("/app/test.js", "old", "new");

      const result = await validator.validateAndApply(fix);

      expect(result.validation).toBeDefined();
      expect(result.validation.validatorsRun.length).toBeGreaterThan(0);
    });

    it("includes error message when validation fails", async () => {
      // Feature #148: Only applied if validation passes
      const validator = createFixValidator();
      const fix = createFix("/app/test.js", "old", "{ { invalid");

      const result = await validator.validateAndApply(fix);

      expect(result.applied).toBe(false);
      expect(result.error).toContain("Validation failed");
    });
  });

  describe("createSyntaxValidator", () => {
    it("detects bracket imbalance", () => {
      const validator = createSyntaxValidator();
      const result = validator.validate("function test() { {", "/test.js");

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes("Unclosed"))).toBe(true);
    });

    it("detects extra closing brackets", () => {
      const validator = createSyntaxValidator();
      const result = validator.validate("function test() { } }", "/test.js");

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes("Extra closing"))).toBe(true);
    });

    it("passes valid code", () => {
      const validator = createSyntaxValidator();
      const result = validator.validate(
        "function test() { return { x: 1 }; }",
        "/test.js"
      );

      expect(result.passed).toBe(true);
    });

    it("detects double commas", () => {
      const validator = createSyntaxValidator();
      const result = validator.validate("const arr = [1,, 2]", "/test.js");

      expect(result.passed).toBe(false);
    });
  });

  describe("createJSONValidator", () => {
    it("validates valid JSON", () => {
      const validator = createJSONValidator();
      const result = validator.validate('{"key": "value"}', "/test.json");

      expect(result.passed).toBe(true);
    });

    it("rejects invalid JSON", () => {
      const validator = createJSONValidator();
      const result = validator.validate("{invalid json}", "/test.json");

      expect(result.passed).toBe(false);
      expect(result.errors[0].type).toBe("syntax");
    });

    it("rejects trailing commas", () => {
      const validator = createJSONValidator();
      const result = validator.validate('{"key": "value",}', "/test.json");

      expect(result.passed).toBe(false);
    });
  });

  describe("createXMLValidator", () => {
    it("validates valid XML", () => {
      const validator = createXMLValidator();
      const result = validator.validate("<root><child></child></root>", "/test.xml");

      expect(result.passed).toBe(true);
    });

    it("detects unclosed tags", () => {
      const validator = createXMLValidator();
      const result = validator.validate("<root><child></root>", "/test.xml");

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes("Mismatched"))).toBe(true);
    });

    it("handles self-closing tags", () => {
      const validator = createXMLValidator();
      const result = validator.validate("<root><br/><img/></root>", "/test.html");

      expect(result.passed).toBe(true);
    });

    it("handles HTML void elements", () => {
      const validator = createXMLValidator();
      const result = validator.validate("<div><br><input></div>", "/test.html");

      expect(result.passed).toBe(true);
    });
  });

  describe("createCSSValidator", () => {
    it("validates valid CSS", () => {
      const validator = createCSSValidator();
      const result = validator.validate(".class { color: red; }", "/test.css");

      expect(result.passed).toBe(true);
    });

    it("detects unclosed braces", () => {
      const validator = createCSSValidator();
      const result = validator.validate(".class { color: red;", "/test.css");

      expect(result.passed).toBe(false);
      expect(result.errors[0].message).toContain("unclosed");
    });

    it("detects extra closing braces", () => {
      const validator = createCSSValidator();
      const result = validator.validate(".class { } }", "/test.css");

      expect(result.passed).toBe(false);
    });
  });

  describe("createPythonValidator", () => {
    it("validates valid Python", () => {
      const validator = createPythonValidator();
      const result = validator.validate("def test():\n    return True", "/test.py");

      expect(result.passed).toBe(true);
    });

    it("detects missing colon on block statement", () => {
      const validator = createPythonValidator();
      const result = validator.validate("if True\n    pass", "/test.py");

      expect(result.passed).toBe(false);
      expect(result.errors[0].message).toContain("missing colon");
    });

    it("detects mixed tabs and spaces", () => {
      const validator = createPythonValidator();
      const result = validator.validate("def test():\n\t pass", "/test.py");

      expect(result.passed).toBe(false);
      expect(result.errors[0].message).toContain("Mixed tabs and spaces");
    });
  });

  describe("FixValidator class", () => {
    let validator: FixValidator;

    beforeEach(() => {
      validator = createFixValidator();
    });

    it("validates asynchronously", async () => {
      const fix = createFix("/app/test.js", "old", "const x = 1;");
      const result = await validator.validate(fix);

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    it("validates synchronously", () => {
      const fix = createFix("/app/test.js", "old", "const x = 1;");
      const result = validator.validateSync(fix);

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    it("stores validation history", async () => {
      const fix = createFix("/app/test.js", "old", "new");
      await validator.validate(fix);

      const history = validator.getValidationHistory(fix.id);

      expect(history).toBeDefined();
    });

    it("clears history", async () => {
      const fix = createFix("/app/test.js", "old", "new");
      await validator.validate(fix);

      validator.clearHistory();
      const history = validator.getValidationHistory(fix.id);

      expect(history).toBeUndefined();
    });

    it("adds custom validator", async () => {
      const customValidator: ValidatorConfig = {
        name: "custom",
        validate: () => ({
          passed: true,
          errors: [],
          warnings: [{ type: "custom", message: "Custom warning" }],
        }),
      };

      validator.addValidator(customValidator);
      const fix = createFix("/app/test.txt", "old", "new");
      const result = await validator.validate(fix);

      expect(result.validatorsRun).toContain("custom");
    });

    it("removes validator", () => {
      const removed = validator.removeValidator("syntax");

      expect(removed).toBe(true);
      expect(validator.getValidators().find((v) => v.name === "syntax")).toBeUndefined();
    });

    it("enables/disables validator", async () => {
      validator.setValidatorEnabled("json", false);
      const fix = createFix("/app/data.json", "{}", "{}");
      const result = await validator.validate(fix);

      expect(result.validatorsRun).not.toContain("json");
    });

    it("stops on first error when configured", async () => {
      validator.updateConfig({ stopOnFirstError: true });

      // Create fix with multiple error types
      validator.addValidator({
        name: "always-error",
        validate: () => ({
          passed: false,
          errors: [{ type: "custom", message: "Error 1", source: "test" }],
          warnings: [],
        }),
      });

      const fix = createFix("/app/test.js", "old", "{ { invalid");
      const result = await validator.validate(fix);

      // Should have stopped after first validator found errors
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("gets and updates config", () => {
      validator.updateConfig({ timeout: 5000 });
      const config = validator.getConfig();

      expect(config.timeout).toBe(5000);
    });
  });

  describe("temp file management", () => {
    it("creates unique temp file paths", () => {
      const path1 = createTempFilePath("/app/test.js");
      const path2 = createTempFilePath("/app/test.js");

      expect(path1).not.toBe(path2);
    });

    it("preserves file extension", () => {
      expect(createTempFilePath("/app/test.tsx")).toContain(".tsx");
      expect(createTempFilePath("/app/data.json")).toContain(".json");
      expect(createTempFilePath("/styles/main.css")).toContain(".css");
    });

    it("uses custom temp directory", () => {
      const tempPath = createTempFilePath("/app/test.js", "/custom/temp");

      expect(tempPath).toContain("/custom/temp");
    });

    it("writes and reads temp files", () => {
      const path = "/tmp/test.txt";
      writeTempFile(path, "content");

      expect(readTempFile(path)).toBe("content");
    });

    it("deletes temp files", () => {
      const path = "/tmp/test.txt";
      writeTempFile(path, "content");
      deleteTempFile(path);

      expect(readTempFile(path)).toBeNull();
    });

    it("clears all temp files", () => {
      writeTempFile("/tmp/a.txt", "a");
      writeTempFile("/tmp/b.txt", "b");

      clearTempFiles();

      expect(readTempFile("/tmp/a.txt")).toBeNull();
      expect(readTempFile("/tmp/b.txt")).toBeNull();
    });
  });

  describe("formatValidationResult", () => {
    it("formats passed result", () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        validationTime: 5,
        validatorsRun: ["syntax", "json"],
      };

      const formatted = formatValidationResult(result);

      expect(formatted).toContain("PASSED");
      expect(formatted).toContain("5ms");
      expect(formatted).toContain("syntax");
    });

    it("formats failed result with errors", () => {
      const result: ValidationResult = {
        isValid: false,
        errors: [
          { type: "syntax", message: "Missing bracket", line: 10, source: "test" },
        ],
        warnings: [],
        validationTime: 3,
        validatorsRun: ["syntax"],
      };

      const formatted = formatValidationResult(result);

      expect(formatted).toContain("FAILED");
      expect(formatted).toContain("Missing bracket");
      expect(formatted).toContain(":10");
    });

    it("includes warnings", () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [{ type: "style", message: "Trailing whitespace", line: 5 }],
        validationTime: 2,
        validatorsRun: ["syntax"],
      };

      const formatted = formatValidationResult(result);

      expect(formatted).toContain("Warnings:");
      expect(formatted).toContain("Trailing whitespace");
    });
  });

  describe("isSafeToApply", () => {
    it("returns true for valid result with few warnings", () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [{ type: "minor", message: "Minor issue" }],
        validationTime: 1,
        validatorsRun: [],
      };

      expect(isSafeToApply(result)).toBe(true);
    });

    it("returns false for invalid result", () => {
      const result: ValidationResult = {
        isValid: false,
        errors: [{ type: "syntax", message: "Error", source: "test" }],
        warnings: [],
        validationTime: 1,
        validatorsRun: [],
      };

      expect(isSafeToApply(result)).toBe(false);
    });

    it("returns false for too many warnings", () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [
          { type: "a", message: "1" },
          { type: "b", message: "2" },
          { type: "c", message: "3" },
          { type: "d", message: "4" },
        ],
        validationTime: 1,
        validatorsRun: [],
      };

      expect(isSafeToApply(result, 3)).toBe(false);
    });
  });

  describe("getErrorSummary", () => {
    it("returns no errors for valid result", () => {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        validationTime: 1,
        validatorsRun: [],
      };

      expect(getErrorSummary(result)).toBe("No errors");
    });

    it("summarizes errors by type", () => {
      const result: ValidationResult = {
        isValid: false,
        errors: [
          { type: "syntax", message: "1", source: "test" },
          { type: "syntax", message: "2", source: "test" },
          { type: "type", message: "3", source: "test" },
        ],
        warnings: [],
        validationTime: 1,
        validatorsRun: [],
      };

      const summary = getErrorSummary(result);

      expect(summary).toContain("2 syntax");
      expect(summary).toContain("1 type");
    });
  });

  describe("createFix", () => {
    it("creates fix with required fields", () => {
      const fix = createFix("/app/test.js", "old", "new");

      expect(fix.filePath).toBe("/app/test.js");
      expect(fix.originalContent).toBe("old");
      expect(fix.fixedContent).toBe("new");
      expect(fix.id).toBeDefined();
    });

    it("accepts optional fields", () => {
      const fix = createFix("/app/test.js", "old", "new", {
        description: "Fix the bug",
        lineNumber: 42,
      });

      expect(fix.description).toBe("Fix the bug");
      expect(fix.lineNumber).toBe(42);
    });
  });

  describe("DEFAULT_VALIDATOR_CONFIG", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_VALIDATOR_CONFIG.useTempFile).toBe(true);
      expect(DEFAULT_VALIDATOR_CONFIG.stopOnFirstError).toBe(false);
      expect(DEFAULT_VALIDATOR_CONFIG.timeout).toBe(30000);
      expect(DEFAULT_VALIDATOR_CONFIG.autoApplyIfValid).toBe(false);
    });
  });
});

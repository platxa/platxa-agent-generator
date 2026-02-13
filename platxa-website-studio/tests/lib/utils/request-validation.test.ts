import { describe, it, expect } from "vitest";
import {
  validateFiles,
  requireValidFiles,
  FILE_LIMITS,
} from "@/lib/utils/request-validation";

describe("request-validation", () => {
  const validFile = {
    path: "static/src/scss/theme.scss",
    name: "theme.scss",
    content: ".test { color: red; }",
    language: "scss",
  };

  describe("validateFiles", () => {
    it("accepts valid files array", () => {
      const result = validateFiles([validFile]);
      expect(result.valid).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files![0].path).toBe(validFile.path);
    });

    it("accepts multiple valid files", () => {
      const files = Array.from({ length: 5 }, (_, i) => ({
        ...validFile,
        path: `file${i}.scss`,
        name: `file${i}.scss`,
      }));
      const result = validateFiles(files);
      expect(result.valid).toBe(true);
      expect(result.files).toHaveLength(5);
    });

    it("rejects null/undefined input", () => {
      expect(validateFiles(null).valid).toBe(false);
      expect(validateFiles(undefined).valid).toBe(false);
    });

    it("rejects non-array input", () => {
      expect(validateFiles("not-array").valid).toBe(false);
      expect(validateFiles({}).valid).toBe(false);
    });

    it("rejects empty array", () => {
      const result = validateFiles([]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("At least one file");
    });

    it("rejects empty path", () => {
      const result = validateFiles([{ ...validFile, path: "" }]);
      expect(result.valid).toBe(false);
    });

    it("rejects empty name", () => {
      const result = validateFiles([{ ...validFile, name: "" }]);
      expect(result.valid).toBe(false);
    });

    it("rejects single file content exceeding 5MB", () => {
      const bigContent = "x".repeat(FILE_LIMITS.MAX_FILE_SIZE + 1);
      const result = validateFiles([{ ...validFile, content: bigContent }]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("bytes or less");
    });

    it("accepts file content at exactly 5MB boundary", () => {
      const content = "x".repeat(FILE_LIMITS.MAX_FILE_SIZE);
      const result = validateFiles([{ ...validFile, content }]);
      expect(result.valid).toBe(true);
    });

    it("rejects more than 100 files", () => {
      const files = Array.from({ length: FILE_LIMITS.MAX_FILES + 1 }, (_, i) => ({
        ...validFile,
        path: `file${i}.scss`,
        name: `file${i}.scss`,
      }));
      const result = validateFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`${FILE_LIMITS.MAX_FILES}`);
    });

    it("rejects total payload exceeding 20MB", () => {
      // Create files that individually pass but together exceed 20MB
      const contentSize = Math.floor(FILE_LIMITS.MAX_FILE_SIZE * 0.9); // ~4.5MB each
      const files = Array.from({ length: 5 }, (_, i) => ({
        ...validFile,
        path: `file${i}.scss`,
        name: `file${i}.scss`,
        content: "x".repeat(contentSize),
      }));
      const result = validateFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Total payload size");
    });

    it("exports FILE_LIMITS constants", () => {
      expect(FILE_LIMITS.MAX_FILES).toBe(100);
      expect(FILE_LIMITS.MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
      expect(FILE_LIMITS.MAX_TOTAL_SIZE).toBe(20 * 1024 * 1024);
    });
  });

  describe("requireValidFiles", () => {
    it("returns validated files on success", () => {
      const files = requireValidFiles([validFile]);
      expect(files).toHaveLength(1);
    });

    it("throws on invalid input", () => {
      expect(() => requireValidFiles(null)).toThrow("Invalid files");
    });

    it("throws on empty array", () => {
      expect(() => requireValidFiles([])).toThrow("Invalid files");
    });
  });
});

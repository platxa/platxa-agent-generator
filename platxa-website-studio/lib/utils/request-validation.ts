/**
 * Request validation utilities for input size limits and schema validation.
 *
 * Uses zod for schema validation to prevent DoS via oversized payloads.
 */

import { z } from "zod";

/** Configurable limits for file validation */
export const FILE_LIMITS = {
  /** Maximum number of files per request */
  MAX_FILES: 100,
  /** Maximum size of a single file's content in bytes */
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  /** Maximum total payload size across all files in bytes */
  MAX_TOTAL_SIZE: 20 * 1024 * 1024, // 20MB
  /** Maximum file path length */
  MAX_PATH_LENGTH: 500,
  /** Maximum file name length */
  MAX_NAME_LENGTH: 255,
  /** Maximum language string length */
  MAX_LANGUAGE_LENGTH: 50,
} as const;

/** Schema for a single file */
const fileSchema = z.object({
  path: z
    .string()
    .min(1, "File path is required")
    .max(FILE_LIMITS.MAX_PATH_LENGTH, `File path must be ${FILE_LIMITS.MAX_PATH_LENGTH} characters or less`),
  name: z
    .string()
    .min(1, "File name is required")
    .max(FILE_LIMITS.MAX_NAME_LENGTH, `File name must be ${FILE_LIMITS.MAX_NAME_LENGTH} characters or less`),
  content: z
    .string()
    .max(FILE_LIMITS.MAX_FILE_SIZE, `File content must be ${FILE_LIMITS.MAX_FILE_SIZE} bytes or less`),
  language: z
    .string()
    .min(1, "Language is required")
    .max(FILE_LIMITS.MAX_LANGUAGE_LENGTH, `Language must be ${FILE_LIMITS.MAX_LANGUAGE_LENGTH} characters or less`),
});

/** Schema for files array */
const filesArraySchema = z
  .array(fileSchema)
  .min(1, "At least one file is required")
  .max(FILE_LIMITS.MAX_FILES, `Maximum ${FILE_LIMITS.MAX_FILES} files allowed`);

export type ValidatedFile = z.infer<typeof fileSchema>;

export interface FilesValidationResult {
  valid: boolean;
  files?: ValidatedFile[];
  error?: string;
}

/**
 * Validates an array of files against size and schema constraints.
 */
export function validateFiles(files: unknown): FilesValidationResult {
  // First check if it's an array at all
  if (!files || !Array.isArray(files)) {
    return { valid: false, error: "Files array is required" };
  }

  // Validate against zod schema
  const result = filesArraySchema.safeParse(files);
  if (!result.success) {
    const firstError = result.error.errors[0];
    return { valid: false, error: firstError.message };
  }

  // Check total payload size
  const totalSize = result.data.reduce((sum, file) => sum + file.content.length, 0);
  if (totalSize > FILE_LIMITS.MAX_TOTAL_SIZE) {
    return {
      valid: false,
      error: `Total payload size (${totalSize} bytes) exceeds maximum of ${FILE_LIMITS.MAX_TOTAL_SIZE} bytes`,
    };
  }

  return { valid: true, files: result.data };
}

/**
 * Validates files and throws on invalid input.
 * Convenience wrapper for inline use.
 */
export function requireValidFiles(files: unknown): ValidatedFile[] {
  const result = validateFiles(files);
  if (!result.valid) {
    throw new Error(`Invalid files: ${result.error}`);
  }
  return result.files!;
}

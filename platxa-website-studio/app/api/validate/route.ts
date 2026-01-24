/**
 * POST /api/validate
 * Validates theme files before export
 *
 * Request body:
 * {
 *   files: Array<{ path: string, content: string, type: string }>
 * }
 *
 * Response: ValidationResult
 */

import {
  validateTheme,
  validateQWebTemplate,
  validateManifest,
  validateScss,
  validateJavaScript,
  formatValidationResult,
} from "@/lib/odoo-skills";
import type { GeneratedFile, ValidationResult } from "@/lib/odoo-skills";

// =============================================================================
// TYPES
// =============================================================================

interface ValidateRequestBody {
  files?: Array<{
    path: string;
    content: string;
    type: string;
  }>;
  // Single file validation
  file?: {
    path: string;
    content: string;
    type: string;
  };
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * POST /api/validate - Validate theme files
 */
export async function POST(req: Request) {
  try {
    // Parse request body
    let body: ValidateRequestBody;
    try {
      const text = await req.text();
      if (!text || text.trim() === "") {
        return errorResponse("Request body is empty", 400);
      }
      body = JSON.parse(text);
    } catch {
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Single file validation
    if (body.file) {
      const result = validateSingleFile(body.file);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Multiple files validation
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return errorResponse(
        "Either 'files' array or single 'file' object is required",
        400
      );
    }

    // Convert to GeneratedFile format
    const files: GeneratedFile[] = body.files.map((f) => ({
      path: f.path,
      content: f.content,
      type: f.type as GeneratedFile["type"],
    }));

    // Validate all files
    const validation = validateTheme(files);

    return new Response(
      JSON.stringify({
        ...validation,
        formatted: formatValidationResult(validation),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Validate API error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Validation failed",
      500
    );
  }
}

/**
 * GET /api/validate - Get validation endpoint info
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      endpoint: "/api/validate",
      methods: {
        POST: {
          description: "Validate theme files",
          body: {
            files: "Array<{ path, content, type }> - validate multiple files",
            file: "{ path, content, type } - validate single file",
          },
          response: {
            valid: "boolean",
            issues: "Array<ValidationIssue>",
            stats: "{ errors, warnings, info }",
            formatted: "string - human readable output",
          },
        },
      },
      supportedTypes: {
        xml: "QWeb template validation",
        py: "Manifest validation (for __manifest__.py)",
        scss: "SCSS/CSS validation",
        css: "CSS validation",
        js: "JavaScript validation",
      },
      validationRules: {
        qweb: [
          "XML declaration check",
          "Odoo root element",
          "Unclosed tags",
          "Deprecated patterns (t-raw)",
          "Security patterns (XSS)",
          "t-foreach/t-as pairing",
          "Template inheritance",
        ],
        manifest: [
          "Required fields (name, version, category, depends, license)",
          "Recommended fields",
          "Version format (XX.Y.Z.A.B)",
          "License validation",
          "Dependencies check",
        ],
        scss: [
          "Brace matching",
          "!important overuse",
          "Deprecated variables",
          "Hardcoded colors",
        ],
        js: [
          "Odoo module declaration",
          "Console statements",
          "Deprecated jQuery",
        ],
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Validate a single file
 */
function validateSingleFile(file: {
  path: string;
  content: string;
  type: string;
}): ValidationResult {
  let issues: ReturnType<typeof validateQWebTemplate> = [];

  switch (file.type) {
    case "xml":
      issues = validateQWebTemplate(file.content, file.path);
      break;
    case "py":
      if (file.path.endsWith("__manifest__.py")) {
        issues = validateManifest(file.content, file.path);
      }
      break;
    case "scss":
    case "css":
      issues = validateScss(file.content, file.path);
      break;
    case "js":
      issues = validateJavaScript(file.content, file.path);
      break;
    default:
      // No validation for unknown types
      break;
  }

  const stats = {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  };

  return {
    valid: stats.errors === 0,
    issues,
    stats,
  };
}

/**
 * Helper to create error responses
 */
function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({
      error: message,
      code: "VALIDATION_ERROR",
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

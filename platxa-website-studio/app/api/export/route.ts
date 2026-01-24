/**
 * POST /api/export
 * Exports theme files as a downloadable ZIP
 *
 * Request body:
 * {
 *   themeName: string,
 *   files: Array<{ path: string, content: string, type: string }>,
 *   options?: {
 *     validate?: boolean,
 *     includeReadme?: boolean,
 *     includeGitignore?: boolean,
 *     author?: string,
 *     website?: string
 *   }
 * }
 *
 * Response: ZIP file blob or JSON error
 */

import { exportTheme, validateBeforeExport, exportAsJson } from "@/lib/export";
import type { GeneratedFile } from "@/lib/odoo-skills";

// =============================================================================
// TYPES
// =============================================================================

interface ExportRequestBody {
  themeName: string;
  files: Array<{
    path: string;
    content: string;
    type: string;
  }>;
  options?: {
    validate?: boolean;
    includeReadme?: boolean;
    includeGitignore?: boolean;
    author?: string;
    website?: string;
    format?: "zip" | "json";
  };
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * POST /api/export - Export theme as ZIP
 */
export async function POST(req: Request) {
  try {
    // Parse request body
    let body: ExportRequestBody;
    try {
      const text = await req.text();
      if (!text || text.trim() === "") {
        return errorResponse("Request body is empty", 400);
      }
      body = JSON.parse(text);
    } catch {
      return errorResponse("Invalid JSON in request body", 400);
    }

    // Validate required fields
    if (!body.themeName || typeof body.themeName !== "string") {
      return errorResponse("themeName is required and must be a string", 400);
    }

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return errorResponse("files array is required and cannot be empty", 400);
    }

    // Validate theme name format (snake_case, starts with theme_)
    const themeNamePattern = /^theme_[a-z][a-z0-9_]*$/;
    if (!themeNamePattern.test(body.themeName)) {
      return errorResponse(
        "themeName must be in format 'theme_name' (lowercase, underscores only)",
        400
      );
    }

    // Convert to GeneratedFile format
    const files: GeneratedFile[] = body.files.map((f) => ({
      path: f.path,
      content: f.content,
      type: f.type as GeneratedFile["type"],
    }));

    // Check if JSON format requested
    if (body.options?.format === "json") {
      const result = exportAsJson(body.themeName, files);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Pre-validate if strict validation is requested
    if (body.options?.validate !== false) {
      const preCheck = validateBeforeExport(files);
      if (!preCheck.canExport) {
        return new Response(
          JSON.stringify({
            error: preCheck.message,
            validation: preCheck.validation,
          }),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Export as ZIP
    const result = await exportTheme({
      themeName: body.themeName,
      files,
      validate: body.options?.validate ?? true,
      includeReadme: body.options?.includeReadme ?? true,
      includeGitignore: body.options?.includeGitignore ?? true,
      author: body.options?.author,
      website: body.options?.website,
    });

    if (!result.success || !result.blob) {
      return errorResponse(result.error || "Export failed", 500);
    }

    // Return ZIP file
    return new Response(result.blob, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${body.themeName}.zip"`,
        "X-Export-Stats": JSON.stringify(result.stats),
        "X-Validation-Errors": String(result.stats.validationErrors),
        "X-Validation-Warnings": String(result.stats.validationWarnings),
      },
    });
  } catch (error) {
    console.error("Export API error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Export failed",
      500
    );
  }
}

/**
 * GET /api/export - Validate files without exporting
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const themeName = url.searchParams.get("themeName");

  if (!themeName) {
    return new Response(
      JSON.stringify({
        endpoint: "/api/export",
        methods: {
          POST: {
            description: "Export theme files as ZIP",
            body: {
              themeName: "string (required, format: theme_name)",
              files: "Array<{ path, content, type }> (required)",
              options: {
                validate: "boolean (default: true)",
                includeReadme: "boolean (default: true)",
                includeGitignore: "boolean (default: true)",
                author: "string (optional)",
                website: "string (optional)",
                format: "'zip' | 'json' (default: 'zip')",
              },
            },
          },
          GET: {
            description: "Get export endpoint info",
          },
        },
        supportedTypes: ["xml", "py", "scss", "css", "js", "po", "pot", "png", "svg"],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // If themeName provided, this could be used for status check
  return new Response(
    JSON.stringify({
      status: "ready",
      themeName,
      message: "Use POST to export theme files",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Helper to create error responses
 */
function errorResponse(message: string, status: number, code?: string) {
  return new Response(
    JSON.stringify({
      error: message,
      code: code || "EXPORT_ERROR",
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

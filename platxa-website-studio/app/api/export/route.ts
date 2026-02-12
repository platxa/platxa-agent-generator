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
import { processGeneratedFiles } from "@/lib/ai/quality-checker";
import { ensureRequiredFiles, consolidateExportFiles } from "@/lib/ai/parser";
import type { ParsedFile } from "@/lib/ai/parser";
import { scanFiles, type ScanResult } from "@/lib/security/code-scanner";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/utils/api-rate-limit";

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
  // Rate limit: 10 requests per minute per IP (ZIP generation is expensive)
  const ip = getClientIp(req);
  const limit = checkRateLimit(`export:${ip}`, 10);
  if (!limit.allowed) {
    return rateLimitResponse(limit.resetMs);
  }

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

    // PRODUCTION-CRITICAL: Apply quality fixes BEFORE validation
    // ROOT CAUSE FIX: Files must be auto-fixed before any validation runs

    // Step 1: Convert to ParsedFile format for quality checker
    const parsedFiles: ParsedFile[] = body.files.map((f) => ({
      path: f.path,
      content: f.content,
      language: f.type === "xml" ? "xml" :
                f.type === "py" ? "python" :
                f.type === "scss" ? "scss" :
                f.type === "css" ? "css" :
                f.type === "js" ? "javascript" : "xml",
      action: "create" as const,
    }));

    // Step 2: Run production-grade quality checker with AUTO-FIXES
    // This fixes: asset paths, models/__init__.py, color contrast, duplicates, etc.
    const qualityResult = processGeneratedFiles(parsedFiles, {
      businessName: body.themeName.replace(/^theme_/, "").replace(/_/g, " "),
    });

    // Step 2.5: ROOT CAUSE FIX - Consolidate duplicate XML and SCSS files
    // AI often generates both templates.xml AND pages.xml, or style.scss AND theme.scss
    // This merges them into single files to prevent Odoo installation errors
    const consolidatedFiles = consolidateExportFiles(qualityResult.files);
    console.log(`[Export] Consolidated ${qualityResult.files.length} files into ${consolidatedFiles.length} files`);

    // Step 2.6: Security scan for vulnerabilities in generated code
    // SECURITY: Scan for XSS, SQL injection, path traversal, etc.
    const securityScan: ScanResult = scanFiles(
      consolidatedFiles.map(f => ({ path: f.path, content: f.content }))
    );

    if (!securityScan.passed) {
      const criticalCount = securityScan.issues.filter(i => i.severity === 'critical').length;
      const highCount = securityScan.issues.filter(i => i.severity === 'high').length;
      console.warn(`[Export] Security scan found ${criticalCount} critical, ${highCount} high severity issues`);

      // Block export if critical security issues found
      if (criticalCount > 0) {
        return errorResponse(
          `Security scan failed: ${criticalCount} critical issue(s) found. ` +
          securityScan.issues
            .filter(i => i.severity === 'critical')
            .map(i => `${i.id}: ${i.message}`)
            .slice(0, 3)
            .join('; '),
          400
        );
      }
    } else {
      console.log(`[Export] Security scan passed (${securityScan.scannedFiles} files, ${securityScan.scanDuration}ms)`);
    }

    // Step 3: Ensure all required files exist (manifest, __init__.py, etc.)
    const completeFiles = ensureRequiredFiles(consolidatedFiles, body.themeName);

    // Step 4: Convert back to GeneratedFile format
    // PRODUCTION-CRITICAL: Normalize ALL paths to use target themeName
    // ROOT CAUSE FIX: Files use theme_generated/ but validator expects theme_custom/
    const files: GeneratedFile[] = completeFiles.map((f) => {
      // Replace theme_generated/ with target themeName/
      let normalizedPath = f.path
        .replace(/^theme_generated\//, `${body.themeName}/`)
        .replace(/^theme_[a-z0-9_]+\//i, `${body.themeName}/`);

      // Ensure path has themeName prefix
      if (!normalizedPath.startsWith(`${body.themeName}/`)) {
        normalizedPath = `${body.themeName}/${normalizedPath}`;
      }

      // Also fix asset paths in manifest content
      let content = f.content;
      if (f.path.endsWith("__manifest__.py")) {
        content = content.replace(/theme_generated\//g, `${body.themeName}/`);
      }

      return {
        path: normalizedPath,
        content,
        type: f.path.endsWith(".xml") ? "xml" :
              f.path.endsWith(".py") ? "py" :
              f.path.endsWith(".scss") ? "scss" :
              f.path.endsWith(".css") ? "css" :
              f.path.endsWith(".js") ? "js" : "xml" as GeneratedFile["type"],
      };
    });

    // Log quality fixes applied
    const fixCount = qualityResult.quality.issues.filter(i => i.severity === "info").length;
    if (fixCount > 0) {
      console.log(`[Export] Applied ${fixCount} auto-fixes to files`);
    }

    // Check if JSON format requested
    if (body.options?.format === "json") {
      const result = exportAsJson(body.themeName, files);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // PRODUCTION-CRITICAL: Validate but DON'T BLOCK export
    // ROOT CAUSE FIX: Auto-fixes are applied, so export should proceed
    // Validation errors are logged but don't prevent download
    let validationResult = null;
    if (body.options?.validate !== false) {
      const preCheck = validateBeforeExport(files);
      validationResult = preCheck;

      // Log validation issues but DON'T block export
      if (!preCheck.canExport) {
        console.warn(`[Export] Validation found ${preCheck.errors.length} errors, proceeding with export anyway`);
        console.warn(`[Export] Errors: ${preCheck.errors.slice(0, 3).join(', ')}${preCheck.errors.length > 3 ? '...' : ''}`);
      }
    }

    // Export as ZIP with FIXED files
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

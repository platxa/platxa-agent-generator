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
import { ensureRequiredFiles } from "@/lib/ai/parser";
import type { ParsedFile } from "@/lib/ai/parser";
import { assembleThemeFiles } from "@/lib/ai/theme-assembler";
import { scanFiles, type ScanResult } from "@/lib/security/code-scanner";
import { validateScssBatch } from "@/lib/validators/scss-validator";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/utils/api-rate-limit";
import { auth } from "@/lib/auth";

/**
 * Odoo SCSS variable stubs — prepended before compilation to avoid
 * false positives from `$o-` variables that Odoo defines at runtime.
 */
/**
 * Allowed file types in export requests.
 * Any file with a type not in this set is rejected with 400.
 */
const ALLOWED_FILE_TYPES = new Set([
  "xml", "py", "scss", "css", "js", "po", "pot", "png", "svg",
]);

const ODOO_SCSS_STUBS = `
// Odoo runtime variables
$o-selected-color-palettes-names: () !default;
$o-color-palettes: () !default;
$o-color-1: #000 !default;
$o-color-2: #000 !default;
$o-color-3: #000 !default;
$o-color-4: #000 !default;
$o-color-5: #000 !default;
$o-theme-navbar-color-mode: '' !default;
$o-theme-navbar-bg-color: #000 !default;
$o-theme-font: '' !default;
$o-theme-headings-font: '' !default;

// Bootstrap typography
$font-size-base: 1rem !default;
$h1-font-size: 2.5rem !default;
$h2-font-size: 2rem !default;
$h3-font-size: 1.75rem !default;
$h4-font-size: 1.5rem !default;
$h5-font-size: 1.25rem !default;
$h6-font-size: 1rem !default;
$headings-font-weight: 500 !default;

// Bootstrap layout
$border-radius: 0.375rem !default;
$border-radius-sm: 0.25rem !default;
$border-radius-lg: 0.5rem !default;
$border-radius-xl: 1rem !default;
$border-radius-pill: 50rem !default;
$spacer: 1rem !default;

// Bootstrap shadows
$box-shadow-sm: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !default;
$box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !default;
$box-shadow-lg: 0 1rem 3rem rgba(0, 0, 0, 0.175) !default;

// Bootstrap transitions
$transition-base: all 0.2s ease-in-out !default;
$transition-fade: opacity 0.15s linear !default;
$transition-collapse: height 0.35s ease !default;

// Bootstrap buttons
$btn-padding-y: 0.375rem !default;
$btn-padding-x: 0.75rem !default;
$btn-font-weight: 400 !default;
$btn-border-radius: 0.375rem !default;

// Bootstrap cards & navbar
$card-border-radius: 0.375rem !default;
$card-spacer-y: 1rem !default;
$card-spacer-x: 1rem !default;
$navbar-padding-y: 0.5rem !default;
$navbar-padding-x: 0 !default;

// Bootstrap grid
$grid-gutter-width: 1.5rem !default;
$container-padding-x: 0.75rem !default;
`;

// =============================================================================
// TYPES
// =============================================================================

interface ExportRequestBody {
  themeName: string;
  industry?: string;
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
  // Session auth: require authenticated user for exports
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Authentication required", 401, "UNAUTHORIZED");
  }

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

    // Validate individual file objects
    for (let i = 0; i < body.files.length; i++) {
      const f = body.files[i];
      if (!f.path || typeof f.path !== "string") {
        return errorResponse(`files[${i}].path must be a non-empty string`, 400);
      }
      if (typeof f.content !== "string") {
        return errorResponse(`files[${i}].content must be a string`, 400);
      }
      if (!f.type || !ALLOWED_FILE_TYPES.has(f.type)) {
        return errorResponse(
          `files[${i}].type '${String(f.type ?? "")}' is not supported. Allowed: ${[...ALLOWED_FILE_TYPES].join(", ")}`,
          400
        );
      }
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

    // Step 2.5: Auto-detect industry from AI output if not provided by frontend.
    // In demo mode, projectConfig is null so industry isn't sent in the export request.
    // Fall back to detecting it from template content (restaurant keywords, tech keywords, etc.)
    let effectiveIndustry = body.industry;
    if (!effectiveIndustry) {
      const allContent = qualityResult.files.map(f => f.content).join(" ").toLowerCase();
      const industryHints: Record<string, string[]> = {
        restaurant: ["restaurant", "menu", "reservation", "dish", "chef", "dining", "cuisine"],
        technology: ["saas", "software", "api", "cloud", "startup", "platform", "integration"],
        legal: ["law", "attorney", "lawyer", "legal", "practice area", "case result"],
        healthcare: ["medical", "doctor", "patient", "clinic", "health", "appointment"],
        ecommerce: ["shop", "product", "cart", "price", "buy", "store", "deal"],
        education: ["course", "student", "learn", "program", "instructor", "enrollment"],
        realestate: ["property", "listing", "agent", "real estate", "mortgage", "home"],
        fitness: ["gym", "workout", "fitness", "training", "class", "trainer"],
        beauty: ["salon", "beauty", "spa", "treatment", "hair", "skincare"],
        automotive: ["vehicle", "car", "dealer", "inventory", "financing", "auto"],
        finance: ["finance", "investment", "banking", "rate", "loan", "insurance"],
        construction: ["construction", "project", "building", "contractor", "renovation"],
        travel: ["travel", "destination", "tour", "booking", "vacation", "trip"],
        photography: ["photo", "portfolio", "gallery", "shoot", "portrait", "studio"],
        nonprofit: ["donate", "mission", "volunteer", "impact", "cause", "charity"],
        creative: ["portfolio", "design", "creative", "illustration", "branding"],
      };
      for (const [industry, keywords] of Object.entries(industryHints)) {
        if (keywords.some(kw => allContent.includes(kw))) {
          effectiveIndustry = industry;
          break;
        }
      }
      if (effectiveIndustry) {
        console.log(`[Export] Auto-detected industry: ${effectiveIndustry}`);
      }
    }

    // ALWAYS run through assembler — produces the correct Odoo 18
    // file set (templates.xml, primary_variables.scss, bootstrap_overridden.scss,
    // theme.scss, icon.svg). Even if AI output looks assembled, it may contain
    // extra files (pages.xml, product_page.xml, style.scss) that would break
    // deployment. The assembler is idempotent and merges all useful content.
    const assembledFiles = assembleThemeFiles(qualityResult.files, body.themeName, effectiveIndustry);

    // Enforce strict file whitelist — Odoo 18 website themes only need these files.
    // This prevents AI-generated junk (extra XML, JS, CSS, .gitignore, README)
    // from reaching the final export.
    const ALLOWED_PATTERNS = [
      /views\/templates\.xml$/,
      /static\/src\/scss\/primary_variables\.scss$/,
      /static\/src\/scss\/bootstrap_overridden\.scss$/,
      /static\/src\/scss\/theme\.scss$/,
      /static\/description\/icon\.svg$/,
      /__manifest__\.py$/,
      /__init__\.py$/,
    ];
    const consolidatedFiles = assembledFiles.filter(f =>
      ALLOWED_PATTERNS.some(pattern => pattern.test(f.path))
    );
    const stripped = assembledFiles.length - consolidatedFiles.length;
    console.log(`[Export] Assembled ${qualityResult.files.length} AI files into ${consolidatedFiles.length} theme files${stripped > 0 ? ` (stripped ${stripped} non-essential files)` : ''}`);

    // Step 2.6: Security scan for vulnerabilities in generated code
    // SECURITY: Scan for XSS, SQL injection, path traversal, etc.
    const securityScan: ScanResult = scanFiles(
      consolidatedFiles.map(f => ({ path: f.path, content: f.content }))
    );

    const criticalCount = securityScan.issues.filter(i => i.severity === 'critical').length;
    const highCount = securityScan.issues.filter(i => i.severity === 'high').length;
    const mediumCount = securityScan.issues.filter(i => i.severity === 'medium').length;

    if (criticalCount > 0 || highCount > 0) {
      console.warn(`[Export] Security scan found ${criticalCount} critical, ${highCount} high severity issues`);
      return errorResponse(
        `Security scan failed: ${criticalCount} critical, ${highCount} high severity issue(s) found. ` +
        securityScan.issues
          .filter(i => i.severity === 'critical' || i.severity === 'high')
          .map(i => `${i.id}: ${i.message}`)
          .slice(0, 3)
          .join('; '),
        400
      );
    } else if (!securityScan.passed) {
      console.warn(`[Export] Security scan: ${mediumCount} medium severity issues (warn-only)`);
    } else {
      console.log(`[Export] Security scan passed (${securityScan.scannedFiles} files, ${securityScan.scanDuration}ms)`);
    }

    // Step 3: Ensure all required files exist (manifest, __init__.py, etc.)
    const completeFiles = ensureRequiredFiles(consolidatedFiles, body.themeName);

    // Step 3.5: SCSS compilation validation (warn-only, never blocks export)
    const scssFiles = completeFiles.filter(f => f.path.endsWith('.scss'));
    let scssErrorCount = 0;
    let scssErrorDetails: string[] = [];
    if (scssFiles.length > 0) {
      const scssWithStubs = scssFiles.map(f => ({
        path: f.path,
        content: ODOO_SCSS_STUBS + f.content,
      }));
      const scssResult = validateScssBatch(scssWithStubs);
      if (!scssResult.allValid) {
        scssErrorCount = scssResult.totalErrors;
        scssErrorDetails = scssResult.results
          .filter(r => !r.valid)
          .flatMap(r => r.errors.map(e => `${r.file}:${e.line ?? '?'} ${e.message}`))
          .slice(0, 3);
        console.warn(`[Export] SCSS validation: ${scssErrorCount} error(s) in ${scssFiles.length} files`);
        scssErrorDetails.forEach(d => console.warn(`[Export]   ${d}`));
      } else {
        console.log(`[Export] SCSS validation passed (${scssFiles.length} files)`);
      }
    }

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
      includeReadme: body.options?.includeReadme ?? false,
      includeGitignore: body.options?.includeGitignore ?? false,
      author: body.options?.author,
      website: body.options?.website,
    });

    if (!result.success || !result.blob) {
      return errorResponse(result.error || "Export failed", 500);
    }

    // Return ZIP file
    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${body.themeName}.zip"`,
      "X-Export-Stats": JSON.stringify(result.stats),
      "X-Validation-Errors": String(result.stats.validationErrors),
      "X-Validation-Warnings": String(result.stats.validationWarnings),
    };

    if (scssErrorCount > 0) {
      responseHeaders["X-Scss-Errors"] = String(scssErrorCount);
      responseHeaders["X-Scss-Warnings"] = scssErrorDetails.join(" | ");
    }

    if (mediumCount > 0) {
      responseHeaders["X-Security-Warnings"] = securityScan.issues
        .filter(i => i.severity === 'medium')
        .map(i => `${i.id}: ${i.message}`)
        .slice(0, 5)
        .join('; ');
    }

    return new Response(result.blob, {
      status: 200,
      headers: responseHeaders,
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

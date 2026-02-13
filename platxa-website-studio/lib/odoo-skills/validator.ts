/**
 * Odoo Theme Validator
 *
 * Production-grade validation for Odoo themes including:
 * - QWeb template syntax validation
 * - Manifest file validation
 * - SCSS/CSS validation
 * - File structure validation
 * - Best practices checks
 */

import type {
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
  GeneratedFile,
} from "./types";

// =============================================================================
// VALIDATION RULES
// =============================================================================

/**
 * QWeb directive patterns
 */
const QWEB_DIRECTIVES = [
  "t-if",
  "t-elif",
  "t-else",
  "t-foreach",
  "t-as",
  "t-esc",
  "t-raw",
  "t-out",
  "t-field",
  "t-call",
  "t-set",
  "t-value",
  "t-att",
  "t-attf",
  "t-ref",
  "t-key",
  "t-cache",
  "t-nocache",
  "t-debug",
  "t-log",
  "t-js",
  "t-tag",
  "t-component",
  "t-slot",
  "t-slot-scope",
  "t-props",
  "t-portal",
  "t-translation",
];

/**
 * Required manifest fields
 */
const REQUIRED_MANIFEST_FIELDS = [
  "name",
  "version",
  "category",
  "depends",
  "license",
];

/**
 * Recommended manifest fields
 */
const RECOMMENDED_MANIFEST_FIELDS = [
  "summary",
  "description",
  "author",
  "website",
  "data",
  "assets",
];

/**
 * Valid Odoo licenses
 */
const VALID_LICENSES = [
  "LGPL-3",
  "AGPL-3",
  "GPL-3",
  "GPL-2",
  "OEEL-1",
  "OPL-1",
  "Other proprietary",
];

/**
 * Valid Odoo 18 asset bundle names
 */
export const VALID_ASSET_BUNDLES = [
  "web.assets_frontend",
  "web._assets_primary_variables",
  "web._assets_frontend_helpers",
  "website.assets_frontend",
  "website.assets_editor",
  "web.assets_backend",
  "web.assets_common",
  "web.assets_frontend_minimal",
  "web.assets_frontend_lazy",
];

/**
 * Bundles that MUST use (prepend, path) tuple format
 */
export const PREPEND_ONLY_BUNDLES = [
  "web._assets_primary_variables",
  "web._assets_frontend_helpers",
];

/**
 * Deprecated QWeb patterns to avoid
 */
const DEPRECATED_PATTERNS = [
  { pattern: /t-raw=/g, message: "t-raw is deprecated, use t-out instead", replacement: "t-out" },
  { pattern: /t-esc="0"/g, message: "Use t-out=\"0\" for content injection", replacement: "t-out=\"0\"" },
  { pattern: /<t t-name=/g, message: "t-name on <t> is deprecated for top-level templates", replacement: "template id=" },
];

/**
 * Security patterns to check
 */
const SECURITY_PATTERNS = [
  { pattern: /t-raw=.*request\./g, message: "Potential XSS: raw output of request data", severity: "error" as ValidationSeverity },
  { pattern: /eval\s*\(/g, message: "Avoid using eval() for security reasons", severity: "error" as ValidationSeverity },
  { pattern: /innerHTML\s*=/g, message: "Avoid innerHTML, use safer DOM methods", severity: "warning" as ValidationSeverity },
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract the content of a dict block (e.g. 'assets': { ... }) from Python-ish
 * manifest content using balanced brace counting.
 *
 * Handles any indentation (2-space, 4-space, tabs, minified) and skips braces
 * inside string literals so they don't break the count.
 *
 * @returns The inner content between the braces, or null if the key is not found
 *          or braces are unbalanced.
 */
export function extractDictBlock(content: string, key: string): string | null {
  // Find the key followed by a colon and opening brace
  const keyPattern = new RegExp(`['"]${key}['"]\\s*:\\s*\\{`);
  const keyMatch = keyPattern.exec(content);
  if (!keyMatch) return null;

  // Start scanning right after the opening brace
  const startIdx = keyMatch.index + keyMatch[0].length;
  let depth = 1;
  let i = startIdx;

  while (i < content.length && depth > 0) {
    const ch = content[i];

    // Skip string literals (single or double quoted, including triple-quoted)
    if (ch === "'" || ch === '"') {
      const triple = content.slice(i, i + 3);
      if (triple === "'''" || triple === '"""') {
        // Triple-quoted string
        const endTriple = content.indexOf(triple, i + 3);
        if (endTriple === -1) return null; // Unterminated
        i = endTriple + 3;
        continue;
      }
      // Single-quoted string — scan to matching close, respecting backslash escapes
      const quote = ch;
      i++;
      while (i < content.length && content[i] !== quote) {
        if (content[i] === '\\') i++; // skip escaped char
        i++;
      }
      i++; // skip closing quote
      continue;
    }

    if (ch === '{') depth++;
    else if (ch === '}') depth--;

    if (depth > 0) i++;
    // When depth === 0 we've found the matching close brace; don't advance past it
  }

  if (depth !== 0) return null; // Unbalanced

  return content.slice(startIdx, i);
}

// =============================================================================
// VALIDATORS
// =============================================================================

/**
 * Validate QWeb XML template
 */
export function validateQWebTemplate(
  content: string,
  filePath: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = content.split("\n");

  // Check XML declaration
  if (!content.trim().startsWith("<?xml")) {
    issues.push({
      severity: "warning",
      code: "QWEB001",
      message: "Missing XML declaration",
      file: filePath,
      line: 1,
      suggestion: "Add <?xml version=\"1.0\" encoding=\"utf-8\"?> at the start",
    });
  }

  // Check for odoo root element
  if (!content.includes("<odoo>") && !content.includes("<odoo ")) {
    issues.push({
      severity: "error",
      code: "QWEB002",
      message: "Missing <odoo> root element",
      file: filePath,
      suggestion: "Wrap content in <odoo>...</odoo>",
    });
  }

  // Check for unclosed tags
  const tagStack: Array<{ tag: string; line: number }> = [];
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/?>/g;

  lines.forEach((line, lineIndex) => {
    let match;
    const lineNum = lineIndex + 1;

    while ((match = tagPattern.exec(line)) !== null) {
      const fullMatch = match[0];
      const tagName = match[1].toLowerCase();

      // Skip self-closing tags and comments
      if (fullMatch.endsWith("/>") || fullMatch.startsWith("<!") || fullMatch.startsWith("<?")) {
        continue;
      }

      if (fullMatch.startsWith("</")) {
        // Closing tag
        const lastOpen = tagStack.pop();
        if (lastOpen && lastOpen.tag !== tagName) {
          issues.push({
            severity: "error",
            code: "QWEB003",
            message: `Mismatched closing tag: expected </${lastOpen.tag}>, found </${tagName}>`,
            file: filePath,
            line: lineNum,
            suggestion: `Close <${lastOpen.tag}> from line ${lastOpen.line} before closing <${tagName}>`,
          });
        }
      } else {
        // Opening tag (for non-void elements)
        const voidElements = ["br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "param", "source", "track", "wbr"];
        if (!voidElements.includes(tagName)) {
          tagStack.push({ tag: tagName, line: lineNum });
        }
      }
    }
  });

  // Report unclosed tags
  tagStack.forEach((unclosed) => {
    issues.push({
      severity: "error",
      code: "QWEB004",
      message: `Unclosed tag: <${unclosed.tag}>`,
      file: filePath,
      line: unclosed.line,
      suggestion: `Add closing </${unclosed.tag}> tag`,
    });
  });

  // Check deprecated patterns
  DEPRECATED_PATTERNS.forEach((dp) => {
    let match;
    while ((match = dp.pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      issues.push({
        severity: "warning",
        code: "QWEB005",
        message: dp.message,
        file: filePath,
        line: lineNum,
        suggestion: `Use ${dp.replacement} instead`,
      });
    }
  });

  // Check security patterns
  SECURITY_PATTERNS.forEach((sp) => {
    let match;
    while ((match = sp.pattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      issues.push({
        severity: sp.severity,
        code: "QWEB006",
        message: sp.message,
        file: filePath,
        line: lineNum,
      });
    }
  });

  // Check for t-foreach without t-as
  const foreachPattern = /t-foreach="[^"]+"/g;
  let foreachMatch;
  while ((foreachMatch = foreachPattern.exec(content)) !== null) {
    const context = content.substring(Math.max(0, foreachMatch.index - 100), foreachMatch.index + foreachMatch[0].length + 50);
    if (!context.includes("t-as=")) {
      const lineNum = content.substring(0, foreachMatch.index).split("\n").length;
      issues.push({
        severity: "error",
        code: "QWEB007",
        message: "t-foreach requires t-as attribute",
        file: filePath,
        line: lineNum,
        suggestion: "Add t-as=\"item\" to specify the loop variable",
      });
    }
  }

  // Check template inheritance
  const inheritPattern = /inherit_id="([^"]+)"/g;
  let inheritMatch;
  while ((inheritMatch = inheritPattern.exec(content)) !== null) {
    const inheritId = inheritMatch[1];
    if (!content.includes("<xpath")) {
      const lineNum = content.substring(0, inheritMatch.index).split("\n").length;
      issues.push({
        severity: "warning",
        code: "QWEB008",
        message: `Template inherits from ${inheritId} but has no xpath expressions`,
        file: filePath,
        line: lineNum,
        suggestion: "Add xpath expressions to modify the inherited template",
      });
    }
  }

  return issues;
}

/**
 * Validate asset bundle names in a manifest file.
 * Checks that bundle names are valid Odoo 18 bundles and that
 * prepend-only bundles use the tuple format.
 */
export function validateAssetBundles(
  content: string,
  filePath: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Extract the 'assets' dict block using balanced brace counting
  const assetsBlock = extractDictBlock(content, "assets");
  if (!assetsBlock) return issues;

  // Find where the assets block starts in the original content for line numbers
  const assetsBlockStart = content.indexOf(assetsBlock);

  // Find all bundle name keys: 'web.assets_frontend': [...]
  const bundlePattern = /['"]([a-z_][a-z0-9_.]*)['"]\s*:\s*\[/g;
  let match;
  while ((match = bundlePattern.exec(assetsBlock)) !== null) {
    const bundleName = match[1];
    const bundleOffset = assetsBlockStart + match.index;
    const lineNum = content.substring(0, bundleOffset).split("\n").length;

    // Check if bundle name is valid
    if (!VALID_ASSET_BUNDLES.includes(bundleName)) {
      issues.push({
        severity: "warning",
        code: "MANIFEST007",
        message: `Unknown asset bundle: '${bundleName}'`,
        file: filePath,
        line: lineNum,
        suggestion: `Valid bundles: ${VALID_ASSET_BUNDLES.join(", ")}`,
      });
    }

    // Check prepend-only bundles have tuple format
    if (PREPEND_ONLY_BUNDLES.includes(bundleName)) {
      // Find the content of this bundle's array
      const afterKey = assetsBlock.substring(match.index + match[0].length);
      const arrayEnd = afterKey.indexOf("]");
      if (arrayEnd !== -1) {
        const arrayContent = afterKey.substring(0, arrayEnd);
        // Tuple format: ('prepend', 'path/to/file.scss') or ("prepend", ...)
        const hasPrependTuple = /\(\s*['"]prepend['"]\s*,/.test(arrayContent);
        // Plain string format: 'path/to/file.scss'
        const hasPlainString = /^\s*['"][^(]/.test(arrayContent.trim());

        if (hasPlainString && !hasPrependTuple) {
          issues.push({
            severity: "error",
            code: "MANIFEST008",
            message: `Bundle '${bundleName}' requires (prepend, path) tuple format`,
            file: filePath,
            line: lineNum,
            suggestion: `Use ('prepend', 'path/to/file.scss') instead of plain strings for ${bundleName}`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Validate manifest file
 */
export function validateManifest(
  content: string,
  filePath: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check required fields
  REQUIRED_MANIFEST_FIELDS.forEach((field) => {
    const pattern = new RegExp(`['"]${field}['"]\\s*:`);
    if (!pattern.test(content)) {
      issues.push({
        severity: "error",
        code: "MANIFEST001",
        message: `Missing required field: ${field}`,
        file: filePath,
        suggestion: `Add '${field}': ... to the manifest`,
      });
    }
  });

  // Check recommended fields
  RECOMMENDED_MANIFEST_FIELDS.forEach((field) => {
    const pattern = new RegExp(`['"]${field}['"]\\s*:`);
    if (!pattern.test(content)) {
      issues.push({
        severity: "info",
        code: "MANIFEST002",
        message: `Missing recommended field: ${field}`,
        file: filePath,
        suggestion: `Consider adding '${field}' for better module documentation`,
      });
    }
  });

  // Validate version format
  const versionMatch = content.match(/['"]version['"]:\s*['"]([^'"]+)['"]/);
  if (versionMatch) {
    const version = versionMatch[1];
    if (!/^\d+\.\d+\.\d+\.\d+\.\d+$/.test(version)) {
      const lineNum = content.substring(0, versionMatch.index).split("\n").length;
      issues.push({
        severity: "warning",
        code: "MANIFEST003",
        message: `Invalid version format: ${version}`,
        file: filePath,
        line: lineNum,
        suggestion: "Use format: XX.Y.Z.A.B (e.g., 18.0.1.0.0)",
      });
    }
  }

  // Validate license
  const licenseMatch = content.match(/['"]license['"]:\s*['"]([^'"]+)['"]/);
  if (licenseMatch) {
    const license = licenseMatch[1];
    if (!VALID_LICENSES.includes(license)) {
      const lineNum = content.substring(0, licenseMatch.index).split("\n").length;
      issues.push({
        severity: "warning",
        code: "MANIFEST004",
        message: `Unknown license: ${license}`,
        file: filePath,
        line: lineNum,
        suggestion: `Use one of: ${VALID_LICENSES.join(", ")}`,
      });
    }
  }

  // Check depends list
  const dependsMatch = content.match(/['"]depends['"]:\s*\[([^\]]*)\]/);
  if (dependsMatch) {
    const depends = dependsMatch[1];
    if (!depends.includes("website") && !depends.includes("web")) {
      const lineNum = content.substring(0, dependsMatch.index).split("\n").length;
      issues.push({
        severity: "warning",
        code: "MANIFEST005",
        message: "Theme should depend on 'website' module",
        file: filePath,
        line: lineNum,
        suggestion: "Add 'website' to depends list",
      });
    }
  }

  // Check for installable flag
  if (!content.includes("'installable'") && !content.includes("\"installable\"")) {
    issues.push({
      severity: "info",
      code: "MANIFEST006",
      message: "Missing 'installable' flag (defaults to True)",
      file: filePath,
      suggestion: "Add 'installable': True for clarity",
    });
  }

  // Validate asset bundle names
  issues.push(...validateAssetBundles(content, filePath));

  return issues;
}

/**
 * Validate SCSS/CSS file
 */
export function validateScss(
  content: string,
  filePath: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = content.split("\n");

  // Check for balanced braces
  let braceCount = 0;
  let lastOpenBrace = 0;

  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === "{") {
        braceCount++;
        lastOpenBrace = lineNum;
      } else if (line[i] === "}") {
        braceCount--;
        if (braceCount < 0) {
          issues.push({
            severity: "error",
            code: "SCSS001",
            message: "Unexpected closing brace",
            file: filePath,
            line: lineNum,
          });
          braceCount = 0;
        }
      }
    }
  });

  if (braceCount > 0) {
    issues.push({
      severity: "error",
      code: "SCSS002",
      message: `Unclosed brace (opened around line ${lastOpenBrace})`,
      file: filePath,
      line: lastOpenBrace,
      suggestion: "Add missing closing brace }",
    });
  }

  // Check for !important overuse
  const importantMatches = content.match(/!important/g);
  if (importantMatches && importantMatches.length > 5) {
    issues.push({
      severity: "warning",
      code: "SCSS003",
      message: `Excessive use of !important (${importantMatches.length} occurrences)`,
      file: filePath,
      suggestion: "Consider using more specific selectors instead of !important",
    });
  }

  // Check for deprecated Odoo SCSS variables
  const deprecatedVars = ["$o-colors", "$o-theme-colors"];
  deprecatedVars.forEach((varName) => {
    if (content.includes(varName)) {
      const lineNum = content.substring(0, content.indexOf(varName)).split("\n").length;
      issues.push({
        severity: "warning",
        code: "SCSS004",
        message: `Deprecated variable: ${varName}`,
        file: filePath,
        line: lineNum,
        suggestion: "Use $o-color-palettes instead",
      });
    }
  });

  // Check for hardcoded colors (could use variables)
  const hardcodedColorPattern = /#[0-9a-fA-F]{3,8}\b/g;
  const colorMatches = content.match(hardcodedColorPattern);
  if (colorMatches && colorMatches.length > 20) {
    issues.push({
      severity: "info",
      code: "SCSS005",
      message: `Many hardcoded colors found (${colorMatches.length})`,
      file: filePath,
      suggestion: "Consider using SCSS variables for colors for better maintainability",
    });
  }

  return issues;
}

/**
 * Validate JavaScript file
 */
export function validateJavaScript(
  content: string,
  filePath: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for Odoo module declaration
  if (!content.includes("@odoo-module") && !content.includes("odoo.define")) {
    issues.push({
      severity: "warning",
      code: "JS001",
      message: "Missing Odoo module declaration",
      file: filePath,
      suggestion: "Add /** @odoo-module **/ at the start for Odoo 18",
    });
  }

  // Check for console.log statements
  const consolePattern = /console\.(log|warn|error|info|debug)\s*\(/g;
  let consoleMatch;
  while ((consoleMatch = consolePattern.exec(content)) !== null) {
    const lineNum = content.substring(0, consoleMatch.index).split("\n").length;
    issues.push({
      severity: "info",
      code: "JS002",
      message: `Console statement found: ${consoleMatch[0]}`,
      file: filePath,
      line: lineNum,
      suggestion: "Remove console statements in production code",
    });
  }

  // Check for deprecated jQuery usage
  const deprecatedJquery = ["$.ajax", "$.get", "$.post", "$.getJSON"];
  deprecatedJquery.forEach((fn) => {
    if (content.includes(fn)) {
      const lineNum = content.substring(0, content.indexOf(fn)).split("\n").length;
      issues.push({
        severity: "info",
        code: "JS003",
        message: `Legacy jQuery function: ${fn}`,
        file: filePath,
        line: lineNum,
        suggestion: "Consider using fetch API or Odoo's rpc module",
      });
    }
  });

  return issues;
}

/**
 * Validate file structure
 */
export function validateFileStructure(
  files: GeneratedFile[],
  themeName: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const filePaths = files.map((f) => f.path);

  // Normalize paths - check if files have theme prefix or not
  const hasThemePrefix = filePaths.some((p) => p.startsWith(`${themeName}/`));

  // Helper to check if a file exists (with or without theme prefix)
  const fileExists = (relativePath: string): boolean => {
    const withPrefix = `${themeName}/${relativePath}`;
    return filePaths.includes(relativePath) || filePaths.includes(withPrefix);
  };

  // Required files (check without prefix)
  const requiredFiles = ["__manifest__.py", "__init__.py"];

  requiredFiles.forEach((reqFile) => {
    if (!fileExists(reqFile)) {
      const displayPath = hasThemePrefix ? `${themeName}/${reqFile}` : reqFile;
      issues.push({
        severity: "error",
        code: "STRUCT001",
        message: `Missing required file: ${displayPath}`,
        file: displayPath,
      });
    }
  });

  // Check for assets references in manifest
  const manifestFile = files.find((f) => f.path.endsWith("__manifest__.py"));
  if (manifestFile) {
    // Extract asset bundles using balanced brace counting
    const assetsContent = extractDictBlock(manifestFile.content, "assets");
    if (assetsContent) {
      const assetPaths = assetsContent.match(/['"]([^'"]+\.(scss|css|js))['"]/g);

      assetPaths?.forEach((assetPath) => {
        const cleanPath = assetPath.replace(/['"]/g, "");
        // Strip theme name prefix if present in the manifest reference
        const relativePath = cleanPath.startsWith(`${themeName}/`)
          ? cleanPath.slice(themeName.length + 1)
          : cleanPath;
        const fileName = relativePath.split("/").pop() || "";

        if (!filePaths.some((fp) => fp.endsWith(fileName))) {
          issues.push({
            severity: "warning",
            code: "STRUCT002",
            message: `Asset file referenced but not found: ${cleanPath}`,
            file: manifestFile.path,
            suggestion: `Create the file or remove from manifest`,
          });
        }
      });
    }
  }

  // Check for data file references
  if (manifestFile) {
    const dataMatch = manifestFile.content.match(/['"]data['"]\s*:\s*\[([^\]]+)\]/s);
    if (dataMatch) {
      const dataContent = dataMatch[1];
      const dataFiles = dataContent.match(/['"]([^'"]+\.xml)['"]/g);

      dataFiles?.forEach((dataFile) => {
        const cleanPath = dataFile.replace(/['"]/g, "");

        if (!fileExists(cleanPath)) {
          issues.push({
            severity: "error",
            code: "STRUCT003",
            message: `Data file referenced but not found: ${cleanPath}`,
            file: manifestFile.path,
            suggestion: `Create ${cleanPath} or remove from manifest`,
          });
        }
      });
    }
  }

  return issues;
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Validate all generated files
 */
export function validateTheme(files: GeneratedFile[]): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  // Handle empty files array
  if (!files || files.length === 0) {
    return {
      valid: false,
      issues: [{
        code: "STRUCT000",
        severity: "error",
        file: "",
        message: "No files provided for validation",
        suggestion: "Generate theme files before validating",
      }],
      stats: { errors: 1, warnings: 0, info: 0 },
    };
  }

  // Determine theme name from first file
  const themeName = files[0]?.path?.split("/")[0] || "theme_unknown";

  // Validate each file based on type
  files.forEach((file) => {
    switch (file.type) {
      case "xml":
        allIssues.push(...validateQWebTemplate(file.content, file.path));
        break;
      case "py":
        if (file.path.endsWith("__manifest__.py")) {
          allIssues.push(...validateManifest(file.content, file.path));
        }
        break;
      case "scss":
      case "css":
        allIssues.push(...validateScss(file.content, file.path));
        break;
      case "js":
        allIssues.push(...validateJavaScript(file.content, file.path));
        break;
    }
  });

  // Validate file structure
  allIssues.push(...validateFileStructure(files, themeName));

  // Calculate stats
  const stats = {
    errors: allIssues.filter((i) => i.severity === "error").length,
    warnings: allIssues.filter((i) => i.severity === "warning").length,
    info: allIssues.filter((i) => i.severity === "info").length,
  };

  return {
    valid: stats.errors === 0,
    issues: allIssues,
    stats,
  };
}

/**
 * Quick validation check
 */
export function quickValidate(content: string, fileType: string): boolean {
  let issues: ValidationIssue[] = [];

  switch (fileType) {
    case "xml":
      issues = validateQWebTemplate(content, "temp.xml");
      break;
    case "py":
      issues = validateManifest(content, "temp.py");
      break;
    case "scss":
    case "css":
      issues = validateScss(content, "temp.scss");
      break;
    case "js":
      issues = validateJavaScript(content, "temp.js");
      break;
  }

  return issues.filter((i) => i.severity === "error").length === 0;
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push("✅ Validation passed");
  } else {
    lines.push("❌ Validation failed");
  }

  lines.push(`   Errors: ${result.stats.errors}, Warnings: ${result.stats.warnings}, Info: ${result.stats.info}`);
  lines.push("");

  if (result.issues.length > 0) {
    lines.push("Issues:");
    result.issues.forEach((issue) => {
      const icon = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️";
      const location = issue.line ? `:${issue.line}` : "";
      lines.push(`  ${icon} [${issue.code}] ${issue.file}${location}`);
      lines.push(`     ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`     💡 ${issue.suggestion}`);
      }
    });
  }

  return lines.join("\n");
}


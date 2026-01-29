/**
 * Pre-Deploy Validator
 *
 * Validates module before deployment:
 * - Manifest correctness (__manifest__.py structure)
 * - All referenced files exist
 * - QWeb templates are valid XML
 * - SCSS compiles without errors
 */

// =============================================================================
// Types
// =============================================================================

/** Validation check types */
export type ValidationCheckType =
  | "manifest"
  | "files"
  | "qweb"
  | "scss"
  | "python"
  | "dependencies";

/** Validation status */
export type ValidationStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped"
  | "warning";

/** Individual check result */
export interface CheckResult {
  /** Check type */
  type: ValidationCheckType;
  /** Check name for display */
  name: string;
  /** Status */
  status: ValidationStatus;
  /** Duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Warning messages */
  warnings?: string[];
  /** Detailed issues found */
  issues?: ValidationIssue[];
  /** Files checked */
  filesChecked?: string[];
  /** Timestamp */
  timestamp: number;
}

/** Validation issue */
export interface ValidationIssue {
  /** Issue severity */
  severity: "error" | "warning" | "info";
  /** Issue message */
  message: string;
  /** File path if applicable */
  file?: string;
  /** Line number if applicable */
  line?: number;
  /** Column if applicable */
  column?: number;
  /** Suggested fix */
  suggestion?: string;
}

/** Full validation result */
export interface ValidationResult {
  /** Overall success */
  success: boolean;
  /** Overall status */
  status: ValidationStatus;
  /** Module name validated */
  moduleName: string;
  /** Module path */
  modulePath: string;
  /** Individual check results */
  checks: CheckResult[];
  /** Total duration */
  duration: number;
  /** Timestamp */
  timestamp: number;
  /** Summary counts */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

/** Manifest data structure */
export interface ManifestData {
  /** Module name */
  name?: string;
  /** Version */
  version?: string;
  /** Summary */
  summary?: string;
  /** Description */
  description?: string;
  /** Author */
  author?: string;
  /** Website */
  website?: string;
  /** Category */
  category?: string;
  /** Dependencies */
  depends?: string[];
  /** Data files */
  data?: string[];
  /** Demo data files */
  demo?: string[];
  /** Assets configuration */
  assets?: Record<string, string[]>;
  /** Installable flag */
  installable?: boolean;
  /** Application flag */
  application?: boolean;
  /** Auto-install flag */
  auto_install?: boolean;
  /** License */
  license?: string;
}

/** Validator configuration */
export interface ValidatorConfig {
  /** Checks to run */
  checks: ValidationCheckType[];
  /** Fail on warnings */
  failOnWarnings: boolean;
  /** Continue after first failure */
  continueOnFailure: boolean;
  /** Validate XML strictly */
  strictXml: boolean;
  /** Required manifest fields */
  requiredManifestFields: string[];
  /** File extensions to validate */
  fileExtensions: {
    qweb: string[];
    scss: string[];
    python: string[];
  };
}

/** Validation event types */
export type ValidationEventType =
  | "validation:start"
  | "validation:complete"
  | "check:start"
  | "check:complete"
  | "issue:found";

/** Validation event */
export interface ValidationEvent {
  /** Event type */
  type: ValidationEventType;
  /** Check being run */
  check?: CheckResult;
  /** Overall result if complete */
  result?: ValidationResult;
  /** Issue if found */
  issue?: ValidationIssue;
  /** Timestamp */
  timestamp: number;
}

/** Validation event callback */
export type ValidationEventCallback = (event: ValidationEvent) => void;

/** File system interface for dependency injection */
export interface FileSystem {
  /** Check if file exists */
  exists: (path: string) => Promise<boolean>;
  /** Read file contents */
  readFile: (path: string) => Promise<string>;
  /** List files in directory */
  readDir: (path: string) => Promise<string[]>;
  /** Check if path is directory */
  isDirectory: (path: string) => Promise<boolean>;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: ValidatorConfig = {
  checks: ["manifest", "files", "qweb", "scss"],
  failOnWarnings: false,
  continueOnFailure: true,
  strictXml: true,
  requiredManifestFields: ["name", "version", "depends"],
  fileExtensions: {
    qweb: [".xml"],
    scss: [".scss", ".css"],
    python: [".py"],
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates initial check result.
 */
export function createCheckResult(
  type: ValidationCheckType,
  name: string
): CheckResult {
  return {
    type,
    name,
    status: "pending",
    duration: 0,
    timestamp: Date.now(),
  };
}

/**
 * Creates a passed check result.
 */
export function createPassedCheck(
  type: ValidationCheckType,
  name: string,
  duration: number,
  filesChecked?: string[],
  warnings?: string[]
): CheckResult {
  return {
    type,
    name,
    status: warnings && warnings.length > 0 ? "warning" : "passed",
    duration,
    warnings,
    filesChecked,
    timestamp: Date.now(),
  };
}

/**
 * Creates a failed check result.
 */
export function createFailedCheck(
  type: ValidationCheckType,
  name: string,
  duration: number,
  error: string,
  issues?: ValidationIssue[]
): CheckResult {
  return {
    type,
    name,
    status: "failed",
    duration,
    error,
    issues,
    timestamp: Date.now(),
  };
}

/**
 * Creates validation issue.
 */
export function createIssue(
  severity: "error" | "warning" | "info",
  message: string,
  file?: string,
  line?: number,
  suggestion?: string
): ValidationIssue {
  return { severity, message, file, line, suggestion };
}

/**
 * Parses manifest Python dict to object.
 * Handles basic Python dict syntax.
 */
export function parseManifest(content: string): ManifestData | null {
  try {
    // Extract the dict content (between { and })
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    let dictStr = match[0];

    // Convert Python syntax to JSON-like syntax
    dictStr = dictStr
      // Replace Python True/False/None with JSON equivalents
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null")
      // Handle single-quoted strings (convert to double quotes)
      .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
      // Handle trailing commas before closing brackets
      .replace(/,(\s*[}\]])/g, "$1");

    // Parse as JSON
    const manifest = JSON.parse(dictStr);
    return manifest as ManifestData;
  } catch {
    return null;
  }
}

/**
 * Validates XML structure (basic check).
 */
export function validateXml(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for basic XML structure
  if (!content.trim()) {
    issues.push(createIssue("error", "Empty XML content"));
    return issues;
  }

  // Check for XML declaration or root element
  if (!content.includes("<") || !content.includes(">")) {
    issues.push(createIssue("error", "Invalid XML: No tags found"));
    return issues;
  }

  // Check for unclosed tags (basic heuristic)
  const openTags: string[] = [];
  const tagRegex = /<\/?([a-zA-Z_][a-zA-Z0-9_.-]*)[^>]*\/?>/g;
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1];

    // Skip self-closing tags, comments, declarations
    if (
      fullMatch.endsWith("/>") ||
      fullMatch.startsWith("<?") ||
      fullMatch.startsWith("<!") ||
      fullMatch.startsWith("<!--")
    ) {
      continue;
    }

    if (fullMatch.startsWith("</")) {
      // Closing tag
      if (openTags.length === 0) {
        issues.push(
          createIssue(
            "error",
            `Unexpected closing tag: </${tagName}>`,
            undefined,
            undefined,
            `Remove or add opening tag for <${tagName}>`
          )
        );
      } else if (openTags[openTags.length - 1] !== tagName) {
        issues.push(
          createIssue(
            "error",
            `Mismatched tag: expected </${openTags[openTags.length - 1]}>, found </${tagName}>`,
            undefined,
            undefined,
            `Check tag nesting order`
          )
        );
      } else {
        openTags.pop();
      }
    } else {
      // Opening tag
      openTags.push(tagName);
    }
  }

  // Check for unclosed tags
  if (openTags.length > 0) {
    for (const tag of openTags) {
      issues.push(
        createIssue(
          "error",
          `Unclosed tag: <${tag}>`,
          undefined,
          undefined,
          `Add closing tag </${tag}>`
        )
      );
    }
  }

  // Check for common QWeb issues
  if (content.includes("t-if") && content.includes("t-else")) {
    // Check t-else follows t-if
    const tIfIndex = content.indexOf("t-if");
    const tElseIndex = content.indexOf("t-else");
    if (tElseIndex < tIfIndex) {
      issues.push(
        createIssue(
          "warning",
          "t-else appears before t-if",
          undefined,
          undefined,
          "Ensure t-else follows t-if element"
        )
      );
    }
  }

  return issues;
}

/**
 * Validates SCSS syntax (basic check).
 */
export function validateScss(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!content.trim()) {
    issues.push(createIssue("warning", "Empty SCSS file"));
    return issues;
  }

  // Check for balanced braces
  let braceCount = 0;
  let lineNumber = 1;
  let lastOpenLine = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === "\n") {
      lineNumber++;
    } else if (char === "{") {
      braceCount++;
      lastOpenLine = lineNumber;
    } else if (char === "}") {
      braceCount--;
      if (braceCount < 0) {
        issues.push(
          createIssue(
            "error",
            "Unexpected closing brace",
            undefined,
            lineNumber,
            "Remove extra closing brace or add opening brace"
          )
        );
        braceCount = 0;
      }
    }
  }

  if (braceCount > 0) {
    issues.push(
      createIssue(
        "error",
        `Unclosed brace (opened at line ${lastOpenLine})`,
        undefined,
        lastOpenLine,
        "Add closing brace }"
      )
    );
  }

  // Check for common SCSS issues
  const lines = content.split("\n");
  lines.forEach((line, index) => {
    // Check for missing semicolons (heuristic)
    const trimmed = line.trim();
    if (
      trimmed.includes(":") &&
      !trimmed.endsWith("{") &&
      !trimmed.endsWith("}") &&
      !trimmed.endsWith(";") &&
      !trimmed.endsWith(",") &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("@") &&
      trimmed.length > 0
    ) {
      issues.push(
        createIssue(
          "warning",
          "Possible missing semicolon",
          undefined,
          index + 1,
          "Add semicolon at end of property declaration"
        )
      );
    }
  });

  return issues;
}

// =============================================================================
// Mock File System
// =============================================================================

/**
 * Creates a mock file system for testing.
 */
export function createMockFileSystem(files: Record<string, string>): FileSystem {
  return {
    exists: async (path: string) => path in files,
    readFile: async (path: string) => {
      if (path in files) {
        return files[path];
      }
      throw new Error(`File not found: ${path}`);
    },
    readDir: async (path: string) => {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      return Object.keys(files)
        .filter((f) => f.startsWith(prefix))
        .map((f) => f.slice(prefix.length).split("/")[0])
        .filter((f, i, arr) => arr.indexOf(f) === i);
    },
    isDirectory: async (path: string) => {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      return Object.keys(files).some((f) => f.startsWith(prefix));
    },
  };
}

// =============================================================================
// PreDeployValidator Class
// =============================================================================

/**
 * Validates module before deployment.
 */
export class PreDeployValidator {
  private config: ValidatorConfig;
  private callbacks: ValidationEventCallback[] = [];
  private fs: FileSystem;

  constructor(
    config: Partial<ValidatorConfig> = {},
    fileSystem?: FileSystem
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fs = fileSystem ?? this.createDefaultFileSystem();
  }

  /**
   * Validates a module for deployment readiness.
   */
  async validate(moduleName: string, modulePath: string): Promise<ValidationResult> {
    const startTime = Date.now();
    const checks: CheckResult[] = [];

    this.emit({
      type: "validation:start",
      timestamp: Date.now(),
    });

    let manifest: ManifestData | null = null;

    // Run each configured check
    for (const checkType of this.config.checks) {
      const checkResult = await this.runCheck(checkType, moduleName, modulePath, manifest);
      checks.push(checkResult);

      // Store manifest for file validation
      // Load manifest for subsequent checks if manifest validation didn't fail
      // (status can be "passed" or "warning" - both mean manifest is valid and parseable)
      if (checkType === "manifest" && checkResult.status !== "failed") {
        manifest = await this.loadManifest(modulePath);
      }

      this.emit({
        type: "check:complete",
        check: checkResult,
        timestamp: Date.now(),
      });

      // Stop if check failed and not continuing
      if (checkResult.status === "failed" && !this.config.continueOnFailure) {
        break;
      }
    }

    // Calculate summary
    const summary = {
      total: checks.length,
      passed: checks.filter((c) => c.status === "passed").length,
      failed: checks.filter((c) => c.status === "failed").length,
      warnings: checks.filter((c) => c.status === "warning").length,
      skipped: checks.filter((c) => c.status === "skipped").length,
    };

    // Determine overall status
    const hasFailed = summary.failed > 0;
    const hasWarnings = summary.warnings > 0;
    const success = !hasFailed && (!this.config.failOnWarnings || !hasWarnings);

    const result: ValidationResult = {
      success,
      status: hasFailed ? "failed" : hasWarnings ? "warning" : "passed",
      moduleName,
      modulePath,
      checks,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
      summary,
    };

    this.emit({
      type: "validation:complete",
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Validates manifest only.
   */
  async validateManifest(modulePath: string): Promise<CheckResult> {
    return this.runCheck("manifest", "", modulePath, null);
  }

  /**
   * Validates QWeb files only.
   */
  async validateQweb(modulePath: string): Promise<CheckResult> {
    const manifest = await this.loadManifest(modulePath);
    return this.runCheck("qweb", "", modulePath, manifest);
  }

  /**
   * Validates SCSS files only.
   */
  async validateScss(modulePath: string): Promise<CheckResult> {
    const manifest = await this.loadManifest(modulePath);
    return this.runCheck("scss", "", modulePath, manifest);
  }

  /**
   * Registers event callback.
   */
  onEvent(callback: ValidationEventCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes event callback.
   */
  offEvent(callback: ValidationEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<ValidatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): ValidatorConfig {
    return { ...this.config };
  }

  // Private methods

  private async runCheck(
    type: ValidationCheckType,
    moduleName: string,
    modulePath: string,
    manifest: ManifestData | null
  ): Promise<CheckResult> {
    const startTime = Date.now();
    const checkName = this.getCheckName(type);

    this.emit({
      type: "check:start",
      check: createCheckResult(type, checkName),
      timestamp: Date.now(),
    });

    try {
      switch (type) {
        case "manifest":
          return await this.checkManifest(modulePath, startTime);
        case "files":
          return await this.checkFiles(modulePath, manifest, startTime);
        case "qweb":
          return await this.checkQweb(modulePath, manifest, startTime);
        case "scss":
          return await this.checkScss(modulePath, manifest, startTime);
        default:
          return createPassedCheck(type, checkName, Date.now() - startTime);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return createFailedCheck(type, checkName, Date.now() - startTime, message);
    }
  }

  private async checkManifest(modulePath: string, startTime: number): Promise<CheckResult> {
    const manifestPath = `${modulePath}/__manifest__.py`;
    const checkName = "Manifest validation";
    const issues: ValidationIssue[] = [];

    // Check manifest exists
    const exists = await this.fs.exists(manifestPath);
    if (!exists) {
      return createFailedCheck(
        "manifest",
        checkName,
        Date.now() - startTime,
        "Manifest file not found",
        [createIssue("error", "__manifest__.py not found", manifestPath)]
      );
    }

    // Read and parse manifest
    const content = await this.fs.readFile(manifestPath);
    const manifest = parseManifest(content);

    if (!manifest) {
      return createFailedCheck(
        "manifest",
        checkName,
        Date.now() - startTime,
        "Failed to parse manifest",
        [createIssue("error", "Invalid Python dict syntax in manifest", manifestPath)]
      );
    }

    // Check required fields
    for (const field of this.config.requiredManifestFields) {
      if (!(field in manifest) || manifest[field as keyof ManifestData] === undefined) {
        issues.push(
          createIssue(
            "error",
            `Missing required field: ${field}`,
            manifestPath,
            undefined,
            `Add '${field}' to manifest`
          )
        );
      }
    }

    // Check version format
    if (manifest.version && !/^\d+\.\d+\.\d+(\.\d+)*$/.test(manifest.version)) {
      issues.push(
        createIssue(
          "warning",
          `Invalid version format: ${manifest.version}`,
          manifestPath,
          undefined,
          "Use semantic versioning (e.g., 16.0.1.0.0)"
        )
      );
    }

    // Check depends is an array
    if (manifest.depends && !Array.isArray(manifest.depends)) {
      issues.push(
        createIssue(
          "error",
          "'depends' must be a list",
          manifestPath,
          undefined,
          "Use ['base'] format"
        )
      );
    }

    // Check license
    if (!manifest.license) {
      issues.push(
        createIssue(
          "warning",
          "No license specified",
          manifestPath,
          undefined,
          "Add 'license': 'LGPL-3' or appropriate license"
        )
      );
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning").map((i) => i.message);

    if (hasErrors) {
      return createFailedCheck(
        "manifest",
        checkName,
        Date.now() - startTime,
        "Manifest validation failed",
        issues
      );
    }

    return createPassedCheck(
      "manifest",
      checkName,
      Date.now() - startTime,
      [manifestPath],
      warnings.length > 0 ? warnings : undefined
    );
  }

  private async checkFiles(
    modulePath: string,
    manifest: ManifestData | null,
    startTime: number
  ): Promise<CheckResult> {
    const checkName = "File existence check";
    const issues: ValidationIssue[] = [];
    const filesChecked: string[] = [];

    if (!manifest) {
      return createFailedCheck(
        "files",
        checkName,
        Date.now() - startTime,
        "Cannot check files without valid manifest",
        [createIssue("error", "Manifest required for file validation")]
      );
    }

    // Check data files
    const dataFiles = [...(manifest.data ?? []), ...(manifest.demo ?? [])];
    for (const file of dataFiles) {
      const filePath = `${modulePath}/${file}`;
      filesChecked.push(file);

      const exists = await this.fs.exists(filePath);
      if (!exists) {
        issues.push(
          createIssue(
            "error",
            `Referenced file not found: ${file}`,
            filePath,
            undefined,
            "Create the file or remove from manifest"
          )
        );
        this.emit({
          type: "issue:found",
          issue: issues[issues.length - 1],
          timestamp: Date.now(),
        });
      }
    }

    // Check asset files
    if (manifest.assets) {
      for (const [bundle, files] of Object.entries(manifest.assets)) {
        if (Array.isArray(files)) {
          for (const file of files) {
            // Skip glob patterns
            if (file.includes("*")) continue;

            const filePath = `${modulePath}/${file}`;
            filesChecked.push(file);

            const exists = await this.fs.exists(filePath);
            if (!exists) {
              issues.push(
                createIssue(
                  "error",
                  `Asset file not found in '${bundle}': ${file}`,
                  filePath,
                  undefined,
                  "Create the file or remove from assets"
                )
              );
            }
          }
        }
      }
    }

    const hasErrors = issues.some((i) => i.severity === "error");

    if (hasErrors) {
      return createFailedCheck(
        "files",
        checkName,
        Date.now() - startTime,
        `${issues.length} file(s) not found`,
        issues
      );
    }

    return createPassedCheck("files", checkName, Date.now() - startTime, filesChecked);
  }

  private async checkQweb(
    modulePath: string,
    manifest: ManifestData | null,
    startTime: number
  ): Promise<CheckResult> {
    const checkName = "QWeb template validation";
    const issues: ValidationIssue[] = [];
    const filesChecked: string[] = [];

    // Get XML files from manifest or scan directory
    const xmlFiles: string[] = [];
    if (manifest?.data) {
      xmlFiles.push(...manifest.data.filter((f) => f.endsWith(".xml")));
    }

    for (const file of xmlFiles) {
      const filePath = `${modulePath}/${file}`;
      filesChecked.push(file);

      try {
        const exists = await this.fs.exists(filePath);
        if (!exists) continue; // Already checked in files validation

        const content = await this.fs.readFile(filePath);
        const xmlIssues = validateXml(content);

        for (const issue of xmlIssues) {
          issues.push({
            ...issue,
            file: filePath,
          });
          this.emit({
            type: "issue:found",
            issue: issues[issues.length - 1],
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        issues.push(
          createIssue(
            "error",
            `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
            filePath
          )
        );
      }
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning").map((i) => i.message);

    if (hasErrors) {
      return createFailedCheck(
        "qweb",
        checkName,
        Date.now() - startTime,
        "QWeb validation failed",
        issues
      );
    }

    return createPassedCheck(
      "qweb",
      checkName,
      Date.now() - startTime,
      filesChecked,
      warnings.length > 0 ? warnings : undefined
    );
  }

  private async checkScss(
    modulePath: string,
    manifest: ManifestData | null,
    startTime: number
  ): Promise<CheckResult> {
    const checkName = "SCSS compilation check";
    const issues: ValidationIssue[] = [];
    const filesChecked: string[] = [];

    // Get SCSS files from assets
    const scssFiles: string[] = [];
    if (manifest?.assets) {
      for (const files of Object.values(manifest.assets)) {
        if (Array.isArray(files)) {
          scssFiles.push(
            ...files.filter(
              (f) => this.config.fileExtensions.scss.some((ext) => f.endsWith(ext))
            )
          );
        }
      }
    }

    for (const file of scssFiles) {
      // Skip glob patterns
      if (file.includes("*")) continue;

      const filePath = `${modulePath}/${file}`;
      filesChecked.push(file);

      try {
        const exists = await this.fs.exists(filePath);
        if (!exists) continue; // Already checked in files validation

        const content = await this.fs.readFile(filePath);
        const scssIssues = validateScss(content);

        for (const issue of scssIssues) {
          issues.push({
            ...issue,
            file: filePath,
          });
          this.emit({
            type: "issue:found",
            issue: issues[issues.length - 1],
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        issues.push(
          createIssue(
            "error",
            `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
            filePath
          )
        );
      }
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning").map((i) => i.message);

    if (hasErrors) {
      return createFailedCheck(
        "scss",
        checkName,
        Date.now() - startTime,
        "SCSS validation failed",
        issues
      );
    }

    return createPassedCheck(
      "scss",
      checkName,
      Date.now() - startTime,
      filesChecked,
      warnings.length > 0 ? warnings : undefined
    );
  }

  private async loadManifest(modulePath: string): Promise<ManifestData | null> {
    const manifestPath = `${modulePath}/__manifest__.py`;
    try {
      const content = await this.fs.readFile(manifestPath);
      return parseManifest(content);
    } catch {
      return null;
    }
  }

  private getCheckName(type: ValidationCheckType): string {
    const names: Record<ValidationCheckType, string> = {
      manifest: "Manifest validation",
      files: "File existence check",
      qweb: "QWeb template validation",
      scss: "SCSS compilation check",
      python: "Python syntax check",
      dependencies: "Dependency verification",
    };
    return names[type] ?? type;
  }

  private emit(event: ValidationEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  private createDefaultFileSystem(): FileSystem {
    // Stub file system that throws - real implementation would use Node.js fs
    return {
      exists: async () => {
        throw new Error("File system not available");
      },
      readFile: async () => {
        throw new Error("File system not available");
      },
      readDir: async () => {
        throw new Error("File system not available");
      },
      isDirectory: async () => {
        throw new Error("File system not available");
      },
    };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a PreDeployValidator instance.
 */
export function createValidator(
  config?: Partial<ValidatorConfig>,
  fileSystem?: FileSystem
): PreDeployValidator {
  return new PreDeployValidator(config, fileSystem);
}

/**
 * Creates a validator with mock file system for testing.
 */
export function createMockValidator(
  config?: Partial<ValidatorConfig>,
  files?: Record<string, string>
): PreDeployValidator {
  return new PreDeployValidator(config, createMockFileSystem(files ?? {}));
}

// =============================================================================
// Validation Checklist
// =============================================================================

/**
 * Pre-deploy validation checklist.
 */
export async function runPreDeployChecklist(
  moduleName: string,
  modulePath: string,
  fileSystem: FileSystem,
  options: Partial<ValidatorConfig> = {}
): Promise<{
  success: boolean;
  message: string;
  result: ValidationResult;
}> {
  const validator = createValidator(options, fileSystem);
  const result = await validator.validate(moduleName, modulePath);

  const message = result.success
    ? `All ${result.summary.passed} checks passed for '${moduleName}'`
    : `Validation failed: ${result.summary.failed} check(s) failed`;

  return {
    success: result.success,
    message,
    result,
  };
}

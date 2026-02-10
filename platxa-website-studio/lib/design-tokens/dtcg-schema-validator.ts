/**
 * DTCG Schema Validator
 *
 * Validates design token files against the W3C DTCG (Design Tokens Community Group)
 * v1 specification. Reports detailed errors for schema violations.
 *
 * References:
 * - https://tr.designtokens.org/format/
 * - https://second-editors-draft.tr.designtokens.org/format/
 *
 * Feature #13: Add DTCG schema validation for brand token files
 */

// =============================================================================
// Types
// =============================================================================

/** DTCG token types per the specification */
export type DtcgTokenType =
  | "color"
  | "dimension"
  | "fontFamily"
  | "fontWeight"
  | "duration"
  | "cubicBezier"
  | "number"
  | "strokeStyle"
  | "border"
  | "transition"
  | "shadow"
  | "gradient"
  | "typography"
  | "fontStyle";

/** Severity level for validation issues */
export type ValidationSeverity = "error" | "warning" | "info";

/** A single validation issue */
export interface DtcgValidationIssue {
  path: string;
  message: string;
  severity: ValidationSeverity;
  code: DtcgErrorCode;
  expected?: string;
  actual?: string;
}

/** Error codes for validation issues */
export type DtcgErrorCode =
  | "INVALID_JSON"
  | "MISSING_VALUE"
  | "MISSING_TYPE"
  | "INVALID_TYPE"
  | "INVALID_VALUE"
  | "TYPE_MISMATCH"
  | "INVALID_REFERENCE"
  | "CIRCULAR_REFERENCE"
  | "INVALID_COLOR"
  | "INVALID_DIMENSION"
  | "INVALID_FONT_WEIGHT"
  | "INVALID_DURATION"
  | "INVALID_CUBIC_BEZIER"
  | "INVALID_SHADOW"
  | "INVALID_GRADIENT"
  | "RESERVED_KEY"
  | "EMPTY_GROUP";

/** Result of schema validation */
export interface DtcgValidationResult {
  valid: boolean;
  errors: DtcgValidationIssue[];
  warnings: DtcgValidationIssue[];
  info: DtcgValidationIssue[];
  tokenCount: number;
  groupCount: number;
}

/** Options for validation */
export interface DtcgValidationOptions {
  /** Validate color format (hex, rgb, hsl, oklch) */
  validateColors?: boolean;
  /** Validate dimension units (px, rem, em, %) */
  validateDimensions?: boolean;
  /** Validate token references exist */
  validateReferences?: boolean;
  /** Allow custom token types */
  allowCustomTypes?: boolean;
  /** Strict mode - warnings become errors */
  strict?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Valid DTCG token types */
const VALID_TOKEN_TYPES: Set<string> = new Set([
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "strokeStyle",
  "border",
  "transition",
  "shadow",
  "gradient",
  "typography",
  "fontStyle",
]);

/** Reserved keys that start with $ */
const RESERVED_KEYS = new Set(["$value", "$type", "$description", "$extensions"]);

/** Color format patterns */
const COLOR_PATTERNS = {
  hex3: /^#[0-9a-fA-F]{3}$/,
  hex6: /^#[0-9a-fA-F]{6}$/,
  hex8: /^#[0-9a-fA-F]{8}$/,
  rgb: /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/,
  hsl: /^hsla?\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+\s*)?\)$/,
  oklch: /^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+\s*(\/\s*[\d.]+%?)?\s*\)$/,
};

/** Dimension format patterns */
const DIMENSION_PATTERN = /^-?[\d.]+\s*(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|cap|ic|lh|rlh|vi|vb|svw|svh|lvw|lvh|dvw|dvh)$/;

/** Duration format pattern */
const DURATION_PATTERN = /^[\d.]+\s*(ms|s)$/;

/** Reference pattern */
const REFERENCE_PATTERN = /^\{[\w.]+\}$/;

// =============================================================================
// Main Validator
// =============================================================================

/**
 * Validates a design token file against the W3C DTCG v1 schema.
 *
 * @param json - The parsed JSON object or JSON string to validate
 * @param options - Validation options
 * @returns Validation result with errors, warnings, and stats
 */
export function validateDtcgSchema(
  json: unknown,
  options: DtcgValidationOptions = {}
): DtcgValidationResult {
  const opts: Required<DtcgValidationOptions> = {
    validateColors: true,
    validateDimensions: true,
    validateReferences: true,
    allowCustomTypes: false,
    strict: false,
    ...options,
  };

  const issues: DtcgValidationIssue[] = [];
  let tokenCount = 0;
  let groupCount = 0;

  // Handle string input
  let data: unknown;
  if (typeof json === "string") {
    try {
      data = JSON.parse(json);
    } catch (e) {
      issues.push({
        path: "$",
        message: `Invalid JSON: ${e instanceof Error ? e.message : "Parse error"}`,
        severity: "error",
        code: "INVALID_JSON",
      });
      return buildResult(issues, opts.strict, 0, 0);
    }
  } else {
    data = json;
  }

  // Must be an object
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    issues.push({
      path: "$",
      message: "Root must be a JSON object",
      severity: "error",
      code: "INVALID_JSON",
      expected: "object",
      actual: Array.isArray(data) ? "array" : typeof data,
    });
    return buildResult(issues, opts.strict, 0, 0);
  }

  // Collect all token paths for reference validation
  const tokenPaths = new Set<string>();

  // Recursively validate
  const counts = validateNode(data as Record<string, unknown>, "$", null, issues, opts, tokenPaths);
  tokenCount = counts.tokens;
  groupCount = counts.groups;

  // Validate references if enabled
  if (opts.validateReferences) {
    validateReferences(data as Record<string, unknown>, "$", tokenPaths, issues);
  }

  return buildResult(issues, opts.strict, tokenCount, groupCount);
}

/**
 * Validates a single node (token or group) recursively.
 */
function validateNode(
  node: Record<string, unknown>,
  path: string,
  inheritedType: string | null,
  issues: DtcgValidationIssue[],
  opts: Required<DtcgValidationOptions>,
  tokenPaths: Set<string>
): { tokens: number; groups: number } {
  let tokens = 0;
  let groups = 0;

  // Check for $type at group level (type inheritance)
  const groupType = node.$type as string | undefined;
  const effectiveType = groupType || inheritedType;

  // Check if this is a token (has $value)
  if ("$value" in node) {
    tokens++;
    tokenPaths.add(path);
    validateToken(node, path, effectiveType, issues, opts);
    return { tokens, groups };
  }

  // Check for malformed token: has $type but no $value and no children
  // This is likely a token with forgotten $value, not an empty group
  const childKeys = Object.keys(node).filter((k) => !k.startsWith("$"));
  if (groupType && childKeys.length === 0) {
    tokens++;
    issues.push({
      path: `${path}.$value`,
      message: "Token has $type but missing required $value",
      severity: "error",
      code: "MISSING_VALUE",
    });
    return { tokens, groups };
  }

  // This is a group
  groups++;

  // Validate group-level $type if present
  if (groupType !== undefined && typeof groupType !== "string") {
    issues.push({
      path: `${path}.$type`,
      message: "$type must be a string",
      severity: "error",
      code: "INVALID_TYPE",
      expected: "string",
      actual: typeof groupType,
    });
  }

  // Check for empty groups (warning) - childKeys already computed above
  if (childKeys.length === 0) {
    issues.push({
      path,
      message: "Empty token group",
      severity: "warning",
      code: "EMPTY_GROUP",
    });
  }

  // Validate each child
  for (const key of Object.keys(node)) {
    // Skip $ prefixed keys (they're metadata)
    if (key.startsWith("$")) {
      // Validate reserved keys
      if (!RESERVED_KEYS.has(key) && !key.startsWith("$extensions")) {
        issues.push({
          path: `${path}.${key}`,
          message: `Unknown reserved key "${key}"`,
          severity: "warning",
          code: "RESERVED_KEY",
        });
      }
      continue;
    }

    const child = node[key];
    if (typeof child === "object" && child !== null && !Array.isArray(child)) {
      const childCounts = validateNode(
        child as Record<string, unknown>,
        `${path}.${key}`,
        effectiveType,
        issues,
        opts,
        tokenPaths
      );
      tokens += childCounts.tokens;
      groups += childCounts.groups;
    } else if (child !== undefined) {
      // Non-object values at non-token level
      issues.push({
        path: `${path}.${key}`,
        message: "Token groups must contain objects",
        severity: "error",
        code: "INVALID_VALUE",
        expected: "object",
        actual: typeof child,
      });
    }
  }

  return { tokens, groups };
}

/**
 * Validates a single token node.
 */
function validateToken(
  token: Record<string, unknown>,
  path: string,
  inheritedType: string | null,
  issues: DtcgValidationIssue[],
  opts: Required<DtcgValidationOptions>
): void {
  const value = token.$value;
  const explicitType = token.$type as string | undefined;
  const effectiveType = explicitType || inheritedType;

  // $value is required
  if (value === undefined) {
    issues.push({
      path: `${path}.$value`,
      message: "Token missing required $value",
      severity: "error",
      code: "MISSING_VALUE",
    });
    return;
  }

  // Type should be defined (either explicit or inherited)
  if (!effectiveType) {
    issues.push({
      path: `${path}.$type`,
      message: "Token missing $type (and no inherited type from parent group)",
      severity: "warning",
      code: "MISSING_TYPE",
    });
  } else {
    // Validate type is known
    if (!VALID_TOKEN_TYPES.has(effectiveType) && !opts.allowCustomTypes) {
      issues.push({
        path: `${path}.$type`,
        message: `Unknown token type "${effectiveType}"`,
        severity: "warning",
        code: "INVALID_TYPE",
        expected: Array.from(VALID_TOKEN_TYPES).join(", "),
        actual: effectiveType,
      });
    }

    // Validate value matches type
    validateValueForType(value, effectiveType, path, issues, opts);
  }

  // Validate $description if present
  if (token.$description !== undefined && typeof token.$description !== "string") {
    issues.push({
      path: `${path}.$description`,
      message: "$description must be a string",
      severity: "error",
      code: "INVALID_VALUE",
      expected: "string",
      actual: typeof token.$description,
    });
  }
}

/**
 * Validates a token value matches its declared type.
 */
function validateValueForType(
  value: unknown,
  type: string,
  path: string,
  issues: DtcgValidationIssue[],
  opts: Required<DtcgValidationOptions>
): void {
  // Check for reference
  if (typeof value === "string" && REFERENCE_PATTERN.test(value)) {
    // References are validated separately
    return;
  }

  switch (type) {
    case "color":
      if (opts.validateColors) {
        validateColorValue(value, path, issues);
      }
      break;

    case "dimension":
      if (opts.validateDimensions) {
        validateDimensionValue(value, path, issues);
      }
      break;

    case "fontFamily":
      validateFontFamilyValue(value, path, issues);
      break;

    case "fontWeight":
      validateFontWeightValue(value, path, issues);
      break;

    case "duration":
      validateDurationValue(value, path, issues);
      break;

    case "cubicBezier":
      validateCubicBezierValue(value, path, issues);
      break;

    case "number":
      if (typeof value !== "number") {
        issues.push({
          path: `${path}.$value`,
          message: "Number token must have numeric value",
          severity: "error",
          code: "TYPE_MISMATCH",
          expected: "number",
          actual: typeof value,
        });
      }
      break;

    case "shadow":
      validateShadowValue(value, path, issues, opts);
      break;

    case "gradient":
      validateGradientValue(value, path, issues);
      break;

    case "typography":
      validateTypographyValue(value, path, issues);
      break;

    case "border":
      validateBorderValue(value, path, issues);
      break;

    case "transition":
      validateTransitionValue(value, path, issues);
      break;

    case "strokeStyle":
      validateStrokeStyleValue(value, path, issues);
      break;

    case "fontStyle":
      if (typeof value !== "string" || !["normal", "italic", "oblique"].includes(value)) {
        issues.push({
          path: `${path}.$value`,
          message: "fontStyle must be 'normal', 'italic', or 'oblique'",
          severity: "error",
          code: "INVALID_VALUE",
          expected: "normal | italic | oblique",
          actual: String(value),
        });
      }
      break;
  }
}

// =============================================================================
// Type-Specific Validators
// =============================================================================

function validateColorValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  if (typeof value !== "string") {
    issues.push({
      path: `${path}.$value`,
      message: "Color value must be a string",
      severity: "error",
      code: "INVALID_COLOR",
      expected: "string (hex, rgb, hsl, or oklch)",
      actual: typeof value,
    });
    return;
  }

  const isValid =
    COLOR_PATTERNS.hex3.test(value) ||
    COLOR_PATTERNS.hex6.test(value) ||
    COLOR_PATTERNS.hex8.test(value) ||
    COLOR_PATTERNS.rgb.test(value) ||
    COLOR_PATTERNS.hsl.test(value) ||
    COLOR_PATTERNS.oklch.test(value);

  if (!isValid) {
    issues.push({
      path: `${path}.$value`,
      message: `Invalid color format: "${value}"`,
      severity: "error",
      code: "INVALID_COLOR",
      expected: "#RGB, #RRGGBB, #RRGGBBAA, rgb(), hsl(), or oklch()",
      actual: value,
    });
  }
}

function validateDimensionValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  if (typeof value !== "string") {
    issues.push({
      path: `${path}.$value`,
      message: "Dimension value must be a string",
      severity: "error",
      code: "INVALID_DIMENSION",
      expected: "string with unit (px, rem, em, %)",
      actual: typeof value,
    });
    return;
  }

  // Allow 0 without unit
  if (value === "0") return;

  if (!DIMENSION_PATTERN.test(value)) {
    issues.push({
      path: `${path}.$value`,
      message: `Invalid dimension format: "${value}"`,
      severity: "error",
      code: "INVALID_DIMENSION",
      expected: "number with unit (px, rem, em, %, vw, vh, etc.)",
      actual: value,
    });
  }
}

function validateFontFamilyValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  if (typeof value !== "string" && !Array.isArray(value)) {
    issues.push({
      path: `${path}.$value`,
      message: "fontFamily must be a string or array of strings",
      severity: "error",
      code: "TYPE_MISMATCH",
      expected: "string | string[]",
      actual: typeof value,
    });
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== "string") {
        issues.push({
          path: `${path}.$value[${i}]`,
          message: "fontFamily array items must be strings",
          severity: "error",
          code: "TYPE_MISMATCH",
          expected: "string",
          actual: typeof value[i],
        });
      }
    }
  }
}

function validateFontWeightValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  const validWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  const validKeywords = ["thin", "hairline", "extralight", "ultralight", "light", "normal", "regular", "medium", "semibold", "demibold", "bold", "extrabold", "ultrabold", "black", "heavy"];

  if (typeof value === "number") {
    if (!validWeights.includes(value)) {
      issues.push({
        path: `${path}.$value`,
        message: `Invalid font weight: ${value}`,
        severity: "warning",
        code: "INVALID_FONT_WEIGHT",
        expected: validWeights.join(", "),
        actual: String(value),
      });
    }
  } else if (typeof value === "string") {
    if (!validKeywords.includes(value.toLowerCase())) {
      issues.push({
        path: `${path}.$value`,
        message: `Invalid font weight keyword: "${value}"`,
        severity: "warning",
        code: "INVALID_FONT_WEIGHT",
        expected: validKeywords.join(", "),
        actual: value,
      });
    }
  } else {
    issues.push({
      path: `${path}.$value`,
      message: "fontWeight must be a number or string",
      severity: "error",
      code: "TYPE_MISMATCH",
      expected: "number (100-900) | string keyword",
      actual: typeof value,
    });
  }
}

function validateDurationValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  if (typeof value !== "string") {
    issues.push({
      path: `${path}.$value`,
      message: "Duration must be a string",
      severity: "error",
      code: "INVALID_DURATION",
      expected: "string (e.g., '200ms', '0.3s')",
      actual: typeof value,
    });
    return;
  }

  if (!DURATION_PATTERN.test(value)) {
    issues.push({
      path: `${path}.$value`,
      message: `Invalid duration format: "${value}"`,
      severity: "error",
      code: "INVALID_DURATION",
      expected: "number with ms or s unit",
      actual: value,
    });
  }
}

function validateCubicBezierValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push({
      path: `${path}.$value`,
      message: "cubicBezier must be an array of 4 numbers",
      severity: "error",
      code: "INVALID_CUBIC_BEZIER",
      expected: "[number, number, number, number]",
      actual: typeof value,
    });
    return;
  }

  if (value.length !== 4) {
    issues.push({
      path: `${path}.$value`,
      message: `cubicBezier must have exactly 4 values, got ${value.length}`,
      severity: "error",
      code: "INVALID_CUBIC_BEZIER",
      expected: "[x1, y1, x2, y2]",
      actual: `[${value.join(", ")}]`,
    });
    return;
  }

  for (let i = 0; i < 4; i++) {
    if (typeof value[i] !== "number") {
      issues.push({
        path: `${path}.$value[${i}]`,
        message: "cubicBezier values must be numbers",
        severity: "error",
        code: "INVALID_CUBIC_BEZIER",
        expected: "number",
        actual: typeof value[i],
      });
    }
  }

  // x1 and x2 should be between 0 and 1
  const [x1, , x2] = value as number[];
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    issues.push({
      path: `${path}.$value`,
      message: "cubicBezier x values (index 0 and 2) should be between 0 and 1",
      severity: "warning",
      code: "INVALID_CUBIC_BEZIER",
      expected: "x1 and x2 in range [0, 1]",
      actual: `x1=${x1}, x2=${x2}`,
    });
  }
}

function validateShadowValue(
  value: unknown,
  path: string,
  issues: DtcgValidationIssue[],
  opts: Required<DtcgValidationOptions>
): void {
  // Shadow can be a single object or array of objects
  const shadows = Array.isArray(value) ? value : [value];

  for (let i = 0; i < shadows.length; i++) {
    const shadow = shadows[i];
    const shadowPath = Array.isArray(value) ? `${path}.$value[${i}]` : `${path}.$value`;

    if (typeof shadow !== "object" || shadow === null) {
      issues.push({
        path: shadowPath,
        message: "Shadow must be an object",
        severity: "error",
        code: "INVALID_SHADOW",
        expected: "{ color, offsetX, offsetY, blur, spread? }",
        actual: typeof shadow,
      });
      continue;
    }

    const s = shadow as Record<string, unknown>;

    // Required properties
    for (const prop of ["color", "offsetX", "offsetY", "blur"]) {
      if (!(prop in s)) {
        issues.push({
          path: `${shadowPath}.${prop}`,
          message: `Shadow missing required property "${prop}"`,
          severity: "error",
          code: "INVALID_SHADOW",
        });
      }
    }

    // Validate color
    if (s.color !== undefined && opts.validateColors) {
      validateColorValue(s.color, `${shadowPath}.color`.replace(".$value", ""), issues);
    }

    // Validate dimensions
    if (opts.validateDimensions) {
      for (const prop of ["offsetX", "offsetY", "blur", "spread"]) {
        if (s[prop] !== undefined) {
          validateDimensionValue(s[prop], `${shadowPath}.${prop}`.replace(".$value", ""), issues);
        }
      }
    }
  }
}

function validateGradientValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push({
      path: `${path}.$value`,
      message: "Gradient must be an array of color stops",
      severity: "error",
      code: "INVALID_GRADIENT",
      expected: "[{ color, position }, ...]",
      actual: typeof value,
    });
    return;
  }

  if (value.length < 2) {
    issues.push({
      path: `${path}.$value`,
      message: "Gradient must have at least 2 color stops",
      severity: "error",
      code: "INVALID_GRADIENT",
      expected: "2+ color stops",
      actual: `${value.length} stops`,
    });
  }

  for (let i = 0; i < value.length; i++) {
    const stop = value[i];
    if (typeof stop !== "object" || stop === null) {
      issues.push({
        path: `${path}.$value[${i}]`,
        message: "Gradient stop must be an object",
        severity: "error",
        code: "INVALID_GRADIENT",
        expected: "{ color, position }",
        actual: typeof stop,
      });
      continue;
    }

    const s = stop as Record<string, unknown>;
    if (!("color" in s)) {
      issues.push({
        path: `${path}.$value[${i}].color`,
        message: "Gradient stop missing color",
        severity: "error",
        code: "INVALID_GRADIENT",
      });
    }
    if (!("position" in s)) {
      issues.push({
        path: `${path}.$value[${i}].position`,
        message: "Gradient stop missing position",
        severity: "error",
        code: "INVALID_GRADIENT",
      });
    } else if (typeof s.position !== "number" || s.position < 0 || s.position > 1) {
      issues.push({
        path: `${path}.$value[${i}].position`,
        message: "Gradient position must be a number between 0 and 1",
        severity: "error",
        code: "INVALID_GRADIENT",
        expected: "number in [0, 1]",
        actual: String(s.position),
      });
    }
  }
}

function validateTypographyValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  if (typeof value !== "object" || value === null) {
    issues.push({
      path: `${path}.$value`,
      message: "Typography must be an object",
      severity: "error",
      code: "TYPE_MISMATCH",
      expected: "{ fontFamily, fontSize, fontWeight, ... }",
      actual: typeof value,
    });
    return;
  }

  const t = value as Record<string, unknown>;

  // Required: fontFamily
  if (!("fontFamily" in t)) {
    issues.push({
      path: `${path}.$value.fontFamily`,
      message: "Typography missing required fontFamily",
      severity: "error",
      code: "MISSING_VALUE",
    });
  }
}

function validateBorderValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  if (typeof value !== "object" || value === null) {
    issues.push({
      path: `${path}.$value`,
      message: "Border must be an object",
      severity: "error",
      code: "TYPE_MISMATCH",
      expected: "{ color, width, style }",
      actual: typeof value,
    });
    return;
  }

  const b = value as Record<string, unknown>;

  for (const prop of ["color", "width", "style"]) {
    if (!(prop in b)) {
      issues.push({
        path: `${path}.$value.${prop}`,
        message: `Border missing required property "${prop}"`,
        severity: "error",
        code: "MISSING_VALUE",
      });
    }
  }
}

function validateTransitionValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  if (typeof value !== "object" || value === null) {
    issues.push({
      path: `${path}.$value`,
      message: "Transition must be an object",
      severity: "error",
      code: "TYPE_MISMATCH",
      expected: "{ duration, delay?, timingFunction }",
      actual: typeof value,
    });
    return;
  }

  const t = value as Record<string, unknown>;

  if (!("duration" in t)) {
    issues.push({
      path: `${path}.$value.duration`,
      message: "Transition missing required duration",
      severity: "error",
      code: "MISSING_VALUE",
    });
  }

  if (!("timingFunction" in t)) {
    issues.push({
      path: `${path}.$value.timingFunction`,
      message: "Transition missing required timingFunction",
      severity: "error",
      code: "MISSING_VALUE",
    });
  }
}

function validateStrokeStyleValue(value: unknown, path: string, issues: DtcgValidationIssue[]): void {
  const validStyles = ["solid", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset", "none"];

  if (typeof value === "string") {
    if (!validStyles.includes(value)) {
      issues.push({
        path: `${path}.$value`,
        message: `Invalid stroke style: "${value}"`,
        severity: "error",
        code: "INVALID_VALUE",
        expected: validStyles.join(", "),
        actual: value,
      });
    }
  } else if (typeof value === "object" && value !== null) {
    // Complex stroke style with dashArray
    const s = value as Record<string, unknown>;
    if (!("dashArray" in s)) {
      issues.push({
        path: `${path}.$value.dashArray`,
        message: "Complex strokeStyle missing dashArray",
        severity: "error",
        code: "MISSING_VALUE",
      });
    }
  } else {
    issues.push({
      path: `${path}.$value`,
      message: "strokeStyle must be a string or object",
      severity: "error",
      code: "TYPE_MISMATCH",
      expected: "string | { dashArray, lineCap? }",
      actual: typeof value,
    });
  }
}

// =============================================================================
// Reference Validation
// =============================================================================

function validateReferences(
  node: Record<string, unknown>,
  path: string,
  tokenPaths: Set<string>,
  issues: DtcgValidationIssue[]
): void {
  for (const [key, value] of Object.entries(node)) {
    const currentPath = path === "$" ? key : `${path}.${key}`;

    if (key === "$value" && typeof value === "string" && REFERENCE_PATTERN.test(value)) {
      // Extract reference path
      const refPath = value.slice(1, -1); // Remove { and }
      const fullRefPath = `$.${refPath}`;

      if (!tokenPaths.has(fullRefPath)) {
        issues.push({
          path: currentPath,
          message: `Invalid reference: "${value}" - target token not found`,
          severity: "error",
          code: "INVALID_REFERENCE",
          expected: `Valid token path`,
          actual: refPath,
        });
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      validateReferences(value as Record<string, unknown>, currentPath, tokenPaths, issues);
    }
  }
}

// =============================================================================
// Helpers
// =============================================================================

function buildResult(
  issues: DtcgValidationIssue[],
  strict: boolean,
  tokenCount: number,
  groupCount: number
): DtcgValidationResult {
  const errors = issues.filter((i) => i.severity === "error" || (strict && i.severity === "warning"));
  const warnings = strict ? [] : issues.filter((i) => i.severity === "warning");
  const info = issues.filter((i) => i.severity === "info");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
    tokenCount,
    groupCount,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Formats validation result for display.
 */
export function formatValidationResult(result: DtcgValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push("✓ DTCG Schema Valid");
  } else {
    lines.push("✗ DTCG Schema Invalid");
  }

  lines.push(`  Tokens: ${result.tokenCount}, Groups: ${result.groupCount}`);
  lines.push("");

  if (result.errors.length > 0) {
    lines.push(`Errors (${result.errors.length}):`);
    for (const error of result.errors.slice(0, 10)) {
      lines.push(`  ✗ [${error.code}] ${error.path}: ${error.message}`);
      if (error.expected) {
        lines.push(`    Expected: ${error.expected}`);
      }
      if (error.actual) {
        lines.push(`    Actual: ${error.actual}`);
      }
    }
    if (result.errors.length > 10) {
      lines.push(`  ... and ${result.errors.length - 10} more errors`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push(`Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings.slice(0, 5)) {
      lines.push(`  ⚠ [${warning.code}] ${warning.path}: ${warning.message}`);
    }
    if (result.warnings.length > 5) {
      lines.push(`  ... and ${result.warnings.length - 5} more warnings`);
    }
  }

  return lines.join("\n");
}

/**
 * Validates a token file from a file path (for CLI usage).
 */
export async function validateTokenFile(
  filePath: string,
  options?: DtcgValidationOptions
): Promise<DtcgValidationResult> {
  const fs = await import("fs/promises");
  const content = await fs.readFile(filePath, "utf-8");
  return validateDtcgSchema(content, options);
}

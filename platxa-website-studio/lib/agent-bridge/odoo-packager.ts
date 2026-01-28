/**
 * Odoo Module Packager
 *
 * Produces an installable Odoo theme module with the proper directory
 * structure: __manifest__.py, __init__.py, views/, static/, data/.
 * Output is a virtual file map suitable for ZIP generation.
 */

// =============================================================================
// Types
// =============================================================================

/** Input files for packaging */
export interface PackagerInput {
  /** Theme name (used as module technical name, e.g. "theme_flavor") */
  themeName: string;
  /** Human-readable display name */
  displayName: string;
  /** Theme description */
  description?: string;
  /** Author name */
  author?: string;
  /** Theme version (default "16.0.1.0.0") */
  version?: string;
  /** Odoo version (default "16.0") */
  odooVersion?: string;
  /** Category (default "Theme") */
  category?: string;
  /** Website URL */
  website?: string;
  /** License (default "LGPL-3") */
  license?: string;
  /** QWeb template XML files: path → content */
  templates: Record<string, string>;
  /** SCSS/CSS files: path → content */
  styles: Record<string, string>;
  /** JavaScript files: path → content */
  scripts?: Record<string, string>;
  /** Image/asset files: path → base64 content */
  assets?: Record<string, string>;
  /** Data XML files (e.g. ir.asset records): path → content */
  dataFiles?: Record<string, string>;
  /** Additional dependencies (default ["website"]) */
  depends?: string[];
}

/** A file entry in the packaged module */
export interface PackagedFile {
  /** Full path relative to module root */
  path: string;
  /** File content (string for text, base64 for binary) */
  content: string;
  /** Whether content is base64-encoded binary */
  isBinary: boolean;
}

/** Result of packaging */
export interface PackagerResult {
  /** Module technical name */
  moduleName: string;
  /** All files in the module */
  files: PackagedFile[];
  /** File map: path → content (text files only) */
  fileMap: Record<string, string>;
  /** Directory structure summary */
  directories: string[];
  /** Validation warnings */
  warnings: string[];
}

// =============================================================================
// Generators
// =============================================================================

/**
 * Generates __manifest__.py content.
 */
function generateManifest(input: PackagerInput): string {
  const {
    displayName,
    description = displayName,
    author = "Platxa Studio",
    version = "16.0.1.0.0",
    category = "Theme",
    website = "",
    license = "LGPL-3",
    depends = ["website"],
  } = input;

  const dataFiles = collectDataPaths(input);
  const assetPaths = collectAssetPaths(input);

  const lines = [
    `{`,
    `    "name": ${pyStr(displayName)},`,
    `    "description": ${pyStr(description)},`,
    `    "author": ${pyStr(author)},`,
    `    "version": ${pyStr(version)},`,
    `    "category": ${pyStr(category)},`,
  ];

  if (website) {
    lines.push(`    "website": ${pyStr(website)},`);
  }

  lines.push(
    `    "license": ${pyStr(license)},`,
    `    "depends": [${depends.map(pyStr).join(", ")}],`,
    `    "data": [`,
  );

  for (const dp of dataFiles) {
    lines.push(`        ${pyStr(dp)},`);
  }

  lines.push(`    ],`);

  if (assetPaths.length > 0) {
    lines.push(`    "assets": {`);
    lines.push(`        "web.assets_frontend": [`);
    for (const ap of assetPaths) {
      lines.push(`            ${pyStr(ap)},`);
    }
    lines.push(`        ],`);
    lines.push(`    },`);
  }

  lines.push(
    `    "images": [`,
    `        "static/description/banner.png",`,
    `    ],`,
    `    "installable": True,`,
    `    "auto_install": False,`,
    `    "application": False,`,
    `}`,
  );

  return lines.join("\n");
}

/** Python string literal */
function pyStr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Collects data file paths for __manifest__.py.
 */
function collectDataPaths(input: PackagerInput): string[] {
  const paths: string[] = [];

  // Template views
  for (const key of Object.keys(input.templates)) {
    const name = sanitizeFilename(key);
    paths.push(`views/${name}`);
  }

  // Data files
  if (input.dataFiles) {
    for (const key of Object.keys(input.dataFiles)) {
      const name = sanitizeFilename(key);
      paths.push(`data/${name}`);
    }
  }

  return paths;
}

/**
 * Collects asset paths for __manifest__.py assets key.
 */
function collectAssetPaths(input: PackagerInput): string[] {
  const paths: string[] = [];
  const mod = input.themeName;

  for (const key of Object.keys(input.styles)) {
    const name = sanitizeFilename(key);
    paths.push(`/${mod}/static/src/scss/${name}`);
  }

  if (input.scripts) {
    for (const key of Object.keys(input.scripts)) {
      const name = sanitizeFilename(key);
      paths.push(`/${mod}/static/src/js/${name}`);
    }
  }

  return paths;
}

/**
 * Sanitizes a filename: keeps only alphanumeric, dash, underscore, dot.
 */
function sanitizeFilename(name: string): string {
  // Strip directory prefixes, keep only filename
  const base = name.split("/").pop() || name;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// =============================================================================
// Packager
// =============================================================================

/**
 * Packages input files into a complete Odoo theme module structure.
 *
 * Output structure:
 * ```
 * theme_name/
 * ├── __manifest__.py
 * ├── __init__.py
 * ├── views/
 * │   └── *.xml
 * ├── static/
 * │   ├── description/
 * │   │   └── banner.png (placeholder)
 * │   └── src/
 * │       ├── scss/
 * │       │   └── *.scss
 * │       ├── js/
 * │       │   └── *.js
 * │       └── img/
 * │           └── *
 * └── data/
 *     └── *.xml
 * ```
 */
export function packageOdooModule(input: PackagerInput): PackagerResult {
  const mod = input.themeName;
  const files: PackagedFile[] = [];
  const warnings: string[] = [];
  const dirSet = new Set<string>();

  const addFile = (path: string, content: string, isBinary = false) => {
    const fullPath = `${mod}/${path}`;
    files.push({ path: fullPath, content, isBinary });
    // Track directory
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    if (dir) dirSet.add(dir);
  };

  // __manifest__.py
  addFile("__manifest__.py", generateManifest(input));

  // __init__.py (empty for themes)
  addFile("__init__.py", "");

  // views/
  for (const [key, content] of Object.entries(input.templates)) {
    const name = sanitizeFilename(key);
    addFile(`views/${name}`, content);
  }

  // static/src/scss/
  for (const [key, content] of Object.entries(input.styles)) {
    const name = sanitizeFilename(key);
    addFile(`static/src/scss/${name}`, content);
  }

  // static/src/js/
  if (input.scripts) {
    for (const [key, content] of Object.entries(input.scripts)) {
      const name = sanitizeFilename(key);
      addFile(`static/src/js/${name}`, content);
    }
  }

  // static/src/img/
  if (input.assets) {
    for (const [key, content] of Object.entries(input.assets)) {
      const name = sanitizeFilename(key);
      addFile(`static/src/img/${name}`, content, true);
    }
  }

  // static/description/ (placeholder banner)
  addFile("static/description/banner.png", "", true);

  // data/
  if (input.dataFiles) {
    for (const [key, content] of Object.entries(input.dataFiles)) {
      const name = sanitizeFilename(key);
      addFile(`data/${name}`, content);
    }
  }

  // Validate
  if (Object.keys(input.templates).length === 0) {
    warnings.push("No template XML files provided — module will have no views");
  }
  if (Object.keys(input.styles).length === 0) {
    warnings.push("No SCSS/CSS files provided — module will have no styles");
  }
  if (!input.themeName.startsWith("theme_")) {
    warnings.push(`Module name "${input.themeName}" does not follow Odoo convention (should start with "theme_")`);
  }

  // Build fileMap (text files only)
  const fileMap: Record<string, string> = {};
  for (const f of files) {
    if (!f.isBinary) {
      fileMap[f.path] = f.content;
    }
  }

  return {
    moduleName: mod,
    files,
    fileMap,
    directories: [...dirSet].sort(),
    warnings,
  };
}

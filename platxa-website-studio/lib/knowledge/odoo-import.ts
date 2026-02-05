/**
 * Odoo Knowledge Import
 *
 * Import knowledge from existing Odoo theme or project files including
 * __manifest__.py, SCSS variables, and JSON exports.
 */

// ============================================================================
// Types
// ============================================================================

export interface OdooManifest {
  name: string;
  version: string;
  category?: string;
  summary?: string;
  description?: string;
  author?: string;
  website?: string;
  license?: string;
  depends?: string[];
  data?: string[];
  assets?: Record<string, string[]>;
  images?: string[];
  installable?: boolean;
  application?: boolean;
  autoInstall?: boolean;
}

export interface ScssVariables {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  spacing: Record<string, string>;
  breakpoints: Record<string, string>;
  borders: Record<string, string>;
  shadows: Record<string, string>;
  custom: Record<string, string>;
}

export interface ThemeExport {
  version: string;
  exportDate: string;
  manifest?: OdooManifest;
  scss?: ScssVariables;
  templates?: TemplateInfo[];
  snippets?: SnippetInfo[];
  assets?: AssetInfo[];
  settings?: ThemeSettings;
}

export interface TemplateInfo {
  id: string;
  name: string;
  inherit?: string;
  content?: string;
  type: 'page' | 'snippet' | 'layout' | 'component';
}

export interface SnippetInfo {
  id: string;
  name: string;
  category: string;
  thumbnail?: string;
  content: string;
  options?: SnippetOption[];
}

export interface SnippetOption {
  name: string;
  selector: string;
  type: 'select' | 'colorpicker' | 'toggle' | 'input';
  values?: string[];
}

export interface AssetInfo {
  path: string;
  bundle: string;
  type: 'scss' | 'css' | 'js' | 'xml';
  content?: string;
}

export interface ThemeSettings {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  headingFont?: string;
  headerStyle?: string;
  footerStyle?: string;
  buttonStyle?: string;
  customSettings?: Record<string, unknown>;
}

export interface ImportResult {
  success: boolean;
  source: 'manifest' | 'scss' | 'json' | 'directory';
  data: Partial<ThemeExport>;
  warnings: string[];
  errors: string[];
}

export interface ImportOptions {
  parseScss?: boolean;
  parseTemplates?: boolean;
  parseSnippets?: boolean;
  includeContent?: boolean;
  validateManifest?: boolean;
}

// ============================================================================
// Manifest Parser
// ============================================================================

/**
 * Parse Odoo __manifest__.py file content
 */
export function parseManifest(content: string): OdooManifest | null {
  try {
    // Remove Python comments
    const cleanContent = content
      .split('\n')
      .map((line) => {
        const commentIndex = line.indexOf('#');
        if (commentIndex === -1) return line;
        // Check if # is inside a string
        const beforeHash = line.substring(0, commentIndex);
        const singleQuotes = (beforeHash.match(/'/g) || []).length;
        const doubleQuotes = (beforeHash.match(/"/g) || []).length;
        if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');

    // Extract the dictionary
    const dictMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!dictMatch) return null;

    let dictStr = dictMatch[0];

    // Convert Python syntax to JSON-compatible
    dictStr = dictStr
      // Replace Python True/False/None
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      // Handle single quotes
      .replace(/'/g, '"')
      // Handle trailing commas
      .replace(/,(\s*[}\]])/g, '$1')
      // Handle tuple-like structures (convert to arrays)
      .replace(/\(([^)]+)\)/g, '[$1]');

    const manifest = JSON.parse(dictStr);

    return {
      name: manifest.name || 'Unknown',
      version: manifest.version || '1.0.0',
      category: manifest.category,
      summary: manifest.summary,
      description: manifest.description,
      author: manifest.author,
      website: manifest.website,
      license: manifest.license,
      depends: manifest.depends || [],
      data: manifest.data || [],
      assets: manifest.assets,
      images: manifest.images,
      installable: manifest.installable !== false,
      application: manifest.application || false,
      autoInstall: manifest.auto_install || false,
    };
  } catch (error) {
    console.error('Failed to parse manifest:', error);
    return null;
  }
}

// ============================================================================
// SCSS Parser
// ============================================================================

/**
 * Parse SCSS variables from content
 */
export function parseScssVariables(content: string): ScssVariables {
  const variables: ScssVariables = {
    colors: {},
    fonts: {},
    spacing: {},
    breakpoints: {},
    borders: {},
    shadows: {},
    custom: {},
  };

  // Match SCSS variable declarations
  const variableRegex = /\$([a-zA-Z_-][a-zA-Z0-9_-]*)\s*:\s*([^;]+);/g;
  let match;

  while ((match = variableRegex.exec(content)) !== null) {
    const name = match[1];
    const value = match[2].trim();

    // Categorize variables
    if (isColorValue(value) || name.includes('color') || name.includes('bg') || name.includes('text')) {
      variables.colors[name] = value;
    } else if (name.includes('font') || name.includes('family') || name.includes('size')) {
      variables.fonts[name] = value;
    } else if (name.includes('spacing') || name.includes('margin') || name.includes('padding') || name.includes('gap')) {
      variables.spacing[name] = value;
    } else if (name.includes('breakpoint') || name.includes('screen') || name.includes('media')) {
      variables.breakpoints[name] = value;
    } else if (name.includes('border') || name.includes('radius')) {
      variables.borders[name] = value;
    } else if (name.includes('shadow') || name.includes('elevation')) {
      variables.shadows[name] = value;
    } else {
      variables.custom[name] = value;
    }
  }

  // Also parse Odoo-specific o_ prefixed variables
  const odooVarRegex = /\$o[_-]([a-zA-Z_-][a-zA-Z0-9_-]*)\s*:\s*([^;]+);/g;
  while ((match = odooVarRegex.exec(content)) !== null) {
    const name = `o-${match[1]}`;
    const value = match[2].trim();

    if (isColorValue(value)) {
      variables.colors[name] = value;
    } else {
      variables.custom[name] = value;
    }
  }

  return variables;
}

/**
 * Check if a value is a color
 */
function isColorValue(value: string): boolean {
  // Hex colors
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return true;
  // RGB/RGBA
  if (/^rgba?\s*\(/.test(value)) return true;
  // HSL/HSLA
  if (/^hsla?\s*\(/.test(value)) return true;
  // Named colors
  const namedColors = ['white', 'black', 'red', 'blue', 'green', 'yellow', 'transparent', 'inherit'];
  if (namedColors.includes(value.toLowerCase())) return true;
  // SCSS color functions
  if (/^(lighten|darken|saturate|desaturate|mix|rgba|adjust-color)\s*\(/.test(value)) return true;

  return false;
}

/**
 * Extract SCSS maps
 */
export function parseScssMap(content: string, mapName: string): Record<string, string> {
  const mapRegex = new RegExp(`\\$${mapName}\\s*:\\s*\\(([^)]+)\\)`, 's');
  const match = content.match(mapRegex);

  if (!match) return {};

  const mapContent = match[1];
  const result: Record<string, string> = {};

  // Parse key-value pairs
  const pairRegex = /["']?([a-zA-Z0-9_-]+)["']?\s*:\s*([^,]+)/g;
  let pairMatch;

  while ((pairMatch = pairRegex.exec(mapContent)) !== null) {
    result[pairMatch[1]] = pairMatch[2].trim();
  }

  return result;
}

// ============================================================================
// JSON Export Parser
// ============================================================================

/**
 * Parse JSON theme export
 */
export function parseJsonExport(content: string): ThemeExport | null {
  try {
    const data = JSON.parse(content);

    // Validate structure
    if (!data.version) {
      console.warn('JSON export missing version field');
    }

    return {
      version: data.version || '1.0.0',
      exportDate: data.exportDate || new Date().toISOString(),
      manifest: data.manifest,
      scss: data.scss,
      templates: data.templates,
      snippets: data.snippets,
      assets: data.assets,
      settings: data.settings,
    };
  } catch (error) {
    console.error('Failed to parse JSON export:', error);
    return null;
  }
}

// ============================================================================
// Template Parser
// ============================================================================

/**
 * Parse QWeb templates from XML content
 */
export function parseTemplates(content: string): TemplateInfo[] {
  const templates: TemplateInfo[] = [];

  // Match template tags
  const templateRegex = /<template\s+([^>]+)>([\s\S]*?)<\/template>/g;
  let match;

  while ((match = templateRegex.exec(content)) !== null) {
    const attributes = match[1];
    const templateContent = match[2];

    // Extract attributes
    const id = extractAttribute(attributes, 'id');
    const name = extractAttribute(attributes, 'name');
    const inherit = extractAttribute(attributes, 'inherit_id');

    if (id) {
      templates.push({
        id,
        name: name || id,
        inherit: inherit || undefined,
        content: templateContent.trim(),
        type: determineTemplateType(id, templateContent),
      });
    }
  }

  return templates;
}

/**
 * Extract attribute value from XML attributes string
 */
function extractAttribute(attributes: string, name: string): string | null {
  const regex = new RegExp(`${name}=["']([^"']+)["']`);
  const match = attributes.match(regex);
  return match ? match[1] : null;
}

/**
 * Determine template type based on ID and content
 */
function determineTemplateType(id: string, content: string): TemplateInfo['type'] {
  if (id.includes('snippet') || content.includes('data-snippet')) {
    return 'snippet';
  }
  if (id.includes('layout') || id.includes('header') || id.includes('footer')) {
    return 'layout';
  }
  if (id.includes('page') || content.includes('t-call="website.layout"')) {
    return 'page';
  }
  return 'component';
}

// ============================================================================
// Snippet Parser
// ============================================================================

/**
 * Parse snippet definitions from XML
 */
export function parseSnippets(content: string): SnippetInfo[] {
  const snippets: SnippetInfo[] = [];

  // Match snippet templates
  const snippetRegex = /<template\s+id="([^"]+)"[^>]*data-snippet="([^"]*)"[^>]*>([\s\S]*?)<\/template>/g;
  let match;

  while ((match = snippetRegex.exec(content)) !== null) {
    const id = match[1];
    const snippetName = match[2] || id;
    const snippetContent = match[3];

    // Try to extract name from template
    const nameMatch = snippetContent.match(/data-name="([^"]+)"/);

    snippets.push({
      id,
      name: nameMatch ? nameMatch[1] : snippetName,
      category: determineSnippetCategory(id, snippetContent),
      content: snippetContent.trim(),
      options: parseSnippetOptions(content, id),
    });
  }

  return snippets;
}

/**
 * Determine snippet category
 */
function determineSnippetCategory(id: string, content: string): string {
  if (id.includes('header') || content.includes('navbar')) return 'Header';
  if (id.includes('footer')) return 'Footer';
  if (id.includes('banner') || id.includes('hero')) return 'Banner';
  if (id.includes('feature') || id.includes('service')) return 'Features';
  if (id.includes('testimonial') || id.includes('review')) return 'Testimonials';
  if (id.includes('team') || id.includes('about')) return 'About';
  if (id.includes('contact') || id.includes('form')) return 'Contact';
  if (id.includes('pricing') || id.includes('plan')) return 'Pricing';
  if (id.includes('gallery') || id.includes('image')) return 'Gallery';
  if (id.includes('text') || id.includes('content')) return 'Content';
  return 'Custom';
}

/**
 * Parse snippet options
 */
function parseSnippetOptions(content: string, snippetId: string): SnippetOption[] {
  const options: SnippetOption[] = [];

  // Look for options defined for this snippet
  const optionRegex = new RegExp(
    `<we-select[^>]*data-snippet="${snippetId}"[^>]*>([\\s\\S]*?)</we-select>`,
    'g'
  );
  let match;

  while ((match = optionRegex.exec(content)) !== null) {
    const optionContent = match[1];
    const nameMatch = optionContent.match(/string="([^"]+)"/);
    const selectorMatch = optionContent.match(/data-select-class="([^"]+)"/);

    if (nameMatch) {
      options.push({
        name: nameMatch[1],
        selector: selectorMatch ? selectorMatch[1] : '',
        type: 'select',
        values: extractSelectValues(optionContent),
      });
    }
  }

  return options;
}

/**
 * Extract select option values
 */
function extractSelectValues(content: string): string[] {
  const values: string[] = [];
  const valueRegex = /data-select-class="([^"]+)"/g;
  let match;

  while ((match = valueRegex.exec(content)) !== null) {
    values.push(match[1]);
  }

  return values;
}

// ============================================================================
// Main Import Functions
// ============================================================================

/**
 * Import from manifest file
 */
export function importFromManifest(content: string): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const manifest = parseManifest(content);

  if (!manifest) {
    return {
      success: false,
      source: 'manifest',
      data: {},
      warnings,
      errors: ['Failed to parse __manifest__.py file'],
    };
  }

  // Validate required fields
  if (!manifest.name) {
    warnings.push('Manifest missing "name" field');
  }
  if (!manifest.depends || manifest.depends.length === 0) {
    warnings.push('Manifest has no dependencies');
  }
  if (manifest.depends && !manifest.depends.includes('website')) {
    warnings.push('Manifest does not depend on "website" module');
  }

  return {
    success: true,
    source: 'manifest',
    data: { manifest },
    warnings,
    errors,
  };
}

/**
 * Import from SCSS files
 */
export function importFromScss(content: string): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const scss = parseScssVariables(content);

  const totalVariables =
    Object.keys(scss.colors).length +
    Object.keys(scss.fonts).length +
    Object.keys(scss.spacing).length +
    Object.keys(scss.breakpoints).length +
    Object.keys(scss.borders).length +
    Object.keys(scss.shadows).length +
    Object.keys(scss.custom).length;

  if (totalVariables === 0) {
    warnings.push('No SCSS variables found in the file');
  }

  // Check for Odoo-specific variables
  const odooVars = Object.keys(scss.colors).filter((k) => k.startsWith('o-'));
  if (odooVars.length === 0) {
    warnings.push('No Odoo-specific (o-*) variables found');
  }

  return {
    success: true,
    source: 'scss',
    data: { scss },
    warnings,
    errors,
  };
}

/**
 * Import from JSON export
 */
export function importFromJson(content: string): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const data = parseJsonExport(content);

  if (!data) {
    return {
      success: false,
      source: 'json',
      data: {},
      warnings,
      errors: ['Failed to parse JSON export file'],
    };
  }

  // Validate structure
  if (!data.scss && !data.manifest && !data.templates) {
    warnings.push('JSON export contains no recognizable theme data');
  }

  return {
    success: true,
    source: 'json',
    data,
    warnings,
    errors,
  };
}

/**
 * Auto-detect and import from file content
 */
export function importFromFile(
  filename: string,
  content: string,
  options: ImportOptions = {}
): ImportResult {
  const ext = filename.split('.').pop()?.toLowerCase();
  const basename = filename.split('/').pop()?.toLowerCase() || '';

  // Detect file type
  if (basename === '__manifest__.py' || basename === '__openerp__.py') {
    return importFromManifest(content);
  }

  if (ext === 'scss' || ext === 'sass') {
    return importFromScss(content);
  }

  if (ext === 'json') {
    return importFromJson(content);
  }

  if (ext === 'xml' && options.parseTemplates) {
    const templates = parseTemplates(content);
    const snippets = options.parseSnippets ? parseSnippets(content) : [];

    return {
      success: true,
      source: 'directory',
      data: { templates, snippets },
      warnings: [],
      errors: [],
    };
  }

  return {
    success: false,
    source: 'directory',
    data: {},
    warnings: [],
    errors: [`Unsupported file type: ${ext}`],
  };
}

// ============================================================================
// Directory Import
// ============================================================================

export interface DirectoryImportResult extends ImportResult {
  files: string[];
  skipped: string[];
}

/**
 * Import from multiple files (directory structure)
 */
export function importFromDirectory(
  files: Array<{ path: string; content: string }>,
  options: ImportOptions = {}
): DirectoryImportResult {
  const result: DirectoryImportResult = {
    success: true,
    source: 'directory',
    data: {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
    },
    warnings: [],
    errors: [],
    files: [],
    skipped: [],
  };

  const allScss: string[] = [];
  const allTemplates: TemplateInfo[] = [];
  const allSnippets: SnippetInfo[] = [];
  const allAssets: AssetInfo[] = [];

  for (const file of files) {
    const ext = file.path.split('.').pop()?.toLowerCase();
    const basename = file.path.split('/').pop()?.toLowerCase() || '';

    // Handle manifest
    if (basename === '__manifest__.py' || basename === '__openerp__.py') {
      const importResult = importFromManifest(file.content);
      if (importResult.success && importResult.data.manifest) {
        result.data.manifest = importResult.data.manifest;
        result.files.push(file.path);
      } else {
        result.warnings.push(...importResult.warnings);
        result.errors.push(...importResult.errors);
      }
      continue;
    }

    // Handle SCSS
    if (ext === 'scss' || ext === 'sass') {
      allScss.push(file.content);
      allAssets.push({
        path: file.path,
        bundle: 'web.assets_frontend',
        type: 'scss',
        content: options.includeContent ? file.content : undefined,
      });
      result.files.push(file.path);
      continue;
    }

    // Handle XML
    if (ext === 'xml') {
      if (options.parseTemplates) {
        const templates = parseTemplates(file.content);
        allTemplates.push(...templates);
      }
      if (options.parseSnippets) {
        const snippets = parseSnippets(file.content);
        allSnippets.push(...snippets);
      }
      allAssets.push({
        path: file.path,
        bundle: 'web.assets_frontend',
        type: 'xml',
        content: options.includeContent ? file.content : undefined,
      });
      result.files.push(file.path);
      continue;
    }

    // Handle JS
    if (ext === 'js') {
      allAssets.push({
        path: file.path,
        bundle: 'web.assets_frontend',
        type: 'js',
        content: options.includeContent ? file.content : undefined,
      });
      result.files.push(file.path);
      continue;
    }

    // Handle CSS
    if (ext === 'css') {
      allAssets.push({
        path: file.path,
        bundle: 'web.assets_frontend',
        type: 'css',
        content: options.includeContent ? file.content : undefined,
      });
      result.files.push(file.path);
      continue;
    }

    // Skip unrecognized files
    result.skipped.push(file.path);
  }

  // Merge all SCSS variables
  if (allScss.length > 0) {
    const combinedScss = allScss.join('\n\n');
    result.data.scss = parseScssVariables(combinedScss);
  }

  // Set templates, snippets, and assets
  if (allTemplates.length > 0) {
    result.data.templates = allTemplates;
  }
  if (allSnippets.length > 0) {
    result.data.snippets = allSnippets;
  }
  if (allAssets.length > 0) {
    result.data.assets = allAssets;
  }

  return result;
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export theme data to JSON
 */
export function exportToJson(data: Partial<ThemeExport>): string {
  return JSON.stringify(
    {
      version: data.version || '1.0.0',
      exportDate: new Date().toISOString(),
      ...data,
    },
    null,
    2
  );
}

/**
 * Export SCSS variables to file content
 */
export function exportToScss(scss: ScssVariables): string {
  const lines: string[] = [
    '// Auto-generated SCSS variables',
    `// Exported: ${new Date().toISOString()}`,
    '',
  ];

  const categories: Array<[string, Record<string, string>]> = [
    ['Colors', scss.colors],
    ['Fonts', scss.fonts],
    ['Spacing', scss.spacing],
    ['Breakpoints', scss.breakpoints],
    ['Borders', scss.borders],
    ['Shadows', scss.shadows],
    ['Custom', scss.custom],
  ];

  for (const [name, vars] of categories) {
    const entries = Object.entries(vars);
    if (entries.length === 0) continue;

    lines.push(`// ${name}`);
    for (const [varName, value] of entries) {
      lines.push(`$${varName}: ${value};`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export default {
  parseManifest,
  parseScssVariables,
  parseJsonExport,
  parseTemplates,
  parseSnippets,
  importFromManifest,
  importFromScss,
  importFromJson,
  importFromFile,
  importFromDirectory,
  exportToJson,
  exportToScss,
};

/**
 * Odoo Module Exporter
 *
 * Exports website projects as valid Odoo module ZIP files for download.
 * Generates proper module structure compatible with Odoo 14-17.
 *
 * Features:
 * - Complete Odoo module structure generation
 * - Proper __manifest__.py with dependencies
 * - SCSS/CSS asset compilation
 * - XML template generation
 * - Static file organization
 * - ZIP archive creation
 *
 * Feature #82: Deployment - Odoo Module Export with ZIP Download
 */

// =============================================================================
// Types
// =============================================================================

/** Odoo version for module compatibility */
export type OdooModuleVersion = "14.0" | "15.0" | "16.0" | "17.0";

/** Module category */
export type ModuleCategory = "Theme/Website" | "Website" | "Hidden";

/** Export configuration */
export interface OdooModuleExportConfig {
  /** Module technical name (snake_case) */
  technicalName: string;
  /** Module display name */
  displayName: string;
  /** Module description */
  description: string;
  /** Module version (e.g., "1.0.0") */
  version: string;
  /** Target Odoo version */
  odooVersion: OdooModuleVersion;
  /** Module author */
  author: string;
  /** Module website */
  website?: string;
  /** Module category */
  category?: ModuleCategory;
  /** Module license */
  license?: "LGPL-3" | "GPL-3" | "AGPL-3" | "OPL-1";
  /** Module dependencies */
  depends?: string[];
  /** Preview image path */
  previewImage?: string;
  /** Include demo data */
  includeDemoData?: boolean;
}

/** File entry for module */
export interface ModuleFile {
  path: string;
  content: string | Uint8Array;
  encoding?: "utf-8" | "binary";
}

/** Page template data */
export interface PageTemplate {
  name: string;
  xmlId: string;
  content: string;
  isHomepage?: boolean;
}

/** Asset file data */
export interface AssetFile {
  filename: string;
  content: string | Uint8Array;
  type: "scss" | "css" | "js" | "image" | "font";
}

/** Export result */
export interface OdooModuleExportResult {
  success: boolean;
  blob?: Blob;
  filename?: string;
  files?: ModuleFile[];
  errors?: string[];
  warnings?: string[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_DEPENDS = ["website"];
const DEFAULT_LICENSE = "LGPL-3";
const DEFAULT_CATEGORY = "Theme/Website";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert display name to technical name
 */
function toTechnicalName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 50);
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format Python value for manifest
 */
function formatPythonValue(value: unknown, indent: number = 0): string {
  const spaces = " ".repeat(indent);

  if (value === null || value === undefined) {
    return "None";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    // Use triple quotes for multiline strings
    if (value.includes("\n")) {
      return `"""${value}"""`;
    }
    return `'${value.replace(/'/g, "\\'")}'`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map(v => formatPythonValue(v, indent + 4));
    return `[\n${spaces}    ${items.join(`,\n${spaces}    `)},\n${spaces}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const items = entries.map(([k, v]) => `'${k}': ${formatPythonValue(v, indent + 4)}`);
    return `{\n${spaces}    ${items.join(`,\n${spaces}    `)},\n${spaces}}`;
  }

  return String(value);
}

// =============================================================================
// Module File Generators
// =============================================================================

/**
 * Generate __manifest__.py content
 */
function generateManifest(config: OdooModuleExportConfig, dataFiles: string[], assets: Record<string, string[]>): string {
  const manifest: Record<string, unknown> = {
    name: config.displayName,
    summary: config.description.split("\n")[0].substring(0, 100),
    description: config.description,
    category: config.category || DEFAULT_CATEGORY,
    version: config.version,
    author: config.author,
    website: config.website || "",
    license: config.license || DEFAULT_LICENSE,
    depends: config.depends || DEFAULT_DEPENDS,
    data: dataFiles,
    assets,
    images: config.previewImage ? [config.previewImage] : [],
    installable: true,
    application: false,
    auto_install: false,
  };

  if (config.includeDemoData) {
    manifest.demo = ["demo/demo_data.xml"];
  }

  const lines = ["# -*- coding: utf-8 -*-", "{"];

  for (const [key, value] of Object.entries(manifest)) {
    lines.push(`    '${key}': ${formatPythonValue(value, 4)},`);
  }

  lines.push("}");

  return lines.join("\n");
}

/**
 * Generate __init__.py content
 */
function generateInit(): string {
  return "# -*- coding: utf-8 -*-\n";
}

/**
 * Generate views/templates.xml content
 */
function generateTemplatesXml(moduleName: string, pages: PageTemplate[]): string {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<odoo>",
  ];

  for (const page of pages) {
    lines.push("");
    lines.push(`    <!-- ${page.name} Page Template -->`);
    lines.push(`    <template id="${page.xmlId}" name="${escapeXml(page.name)}">`);

    // Wrap content in t-call to website layout
    lines.push('        <t t-call="website.layout">');
    lines.push('            <div id="wrap" class="oe_structure">');
    lines.push(`                ${page.content}`);
    lines.push("            </div>");
    lines.push("        </t>");
    lines.push("    </template>");

    // Add page record
    lines.push("");
    lines.push(`    <record id="page_${page.xmlId}" model="website.page">`);
    lines.push(`        <field name="name">${escapeXml(page.name)}</field>`);
    lines.push(`        <field name="url">/${page.xmlId === "homepage" ? "" : page.xmlId}</field>`);
    lines.push(`        <field name="view_id" ref="${page.xmlId}"/>`);
    lines.push(`        <field name="website_indexed" eval="True"/>`);
    lines.push(`        <field name="is_published" eval="True"/>`);
    if (page.isHomepage) {
      lines.push('        <field name="header_overlay" eval="True"/>');
    }
    lines.push("    </record>");
  }

  lines.push("");
  lines.push("</odoo>");

  return lines.join("\n");
}

/**
 * Generate views/snippets.xml content
 */
function generateSnippetsXml(moduleName: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Custom Snippets for ${moduleName} -->

    <!-- Snippet options and customizations can be added here -->

</odoo>`;
}

/**
 * Generate views/options.xml content
 */
function generateOptionsXml(moduleName: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Theme Options for ${moduleName} -->

    <!-- Website configuration options can be added here -->

</odoo>`;
}

// =============================================================================
// OdooModuleExporter Class
// =============================================================================

/**
 * Exports website projects as Odoo module ZIP files
 */
export class OdooModuleExporter {
  /**
   * Export project as Odoo module
   */
  async exportModule(
    config: OdooModuleExportConfig,
    pages: PageTemplate[],
    assets: AssetFile[],
    additionalFiles?: ModuleFile[]
  ): Promise<OdooModuleExportResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const files: ModuleFile[] = [];

    try {
      // Validate config
      if (!config.technicalName || !/^[a-z][a-z0-9_]*$/.test(config.technicalName)) {
        errors.push("Invalid technical name. Must start with letter and contain only lowercase letters, numbers, and underscores.");
        return { success: false, errors };
      }

      const moduleName = config.technicalName;

      // Organize assets by type
      const scssFiles: AssetFile[] = [];
      const cssFiles: AssetFile[] = [];
      const jsFiles: AssetFile[] = [];
      const imageFiles: AssetFile[] = [];
      const fontFiles: AssetFile[] = [];

      for (const asset of assets) {
        switch (asset.type) {
          case "scss":
            scssFiles.push(asset);
            break;
          case "css":
            cssFiles.push(asset);
            break;
          case "js":
            jsFiles.push(asset);
            break;
          case "image":
            imageFiles.push(asset);
            break;
          case "font":
            fontFiles.push(asset);
            break;
        }
      }

      // Build asset paths for manifest
      const assetPaths: Record<string, string[]> = {
        "web.assets_frontend": [],
      };

      // Add SCSS files
      for (const scss of scssFiles) {
        const path = `/${moduleName}/static/src/scss/${scss.filename}`;
        assetPaths["web.assets_frontend"].push(path);
        files.push({
          path: `static/src/scss/${scss.filename}`,
          content: typeof scss.content === "string" ? scss.content : new TextDecoder().decode(scss.content),
        });
      }

      // Add CSS files
      for (const css of cssFiles) {
        const path = `/${moduleName}/static/src/css/${css.filename}`;
        assetPaths["web.assets_frontend"].push(path);
        files.push({
          path: `static/src/css/${css.filename}`,
          content: typeof css.content === "string" ? css.content : new TextDecoder().decode(css.content),
        });
      }

      // Add JS files
      for (const js of jsFiles) {
        const path = `/${moduleName}/static/src/js/${js.filename}`;
        assetPaths["web.assets_frontend"].push(path);
        files.push({
          path: `static/src/js/${js.filename}`,
          content: typeof js.content === "string" ? js.content : new TextDecoder().decode(js.content),
        });
      }

      // Add image files
      for (const img of imageFiles) {
        files.push({
          path: `static/src/img/${img.filename}`,
          content: img.content,
          encoding: "binary",
        });
      }

      // Add font files
      for (const font of fontFiles) {
        files.push({
          path: `static/src/fonts/${font.filename}`,
          content: font.content,
          encoding: "binary",
        });
      }

      // Build data files list
      const dataFiles = [
        "views/templates.xml",
        "views/snippets.xml",
        "views/options.xml",
      ];

      // Generate core module files
      files.push({
        path: "__manifest__.py",
        content: generateManifest(config, dataFiles, assetPaths),
      });

      files.push({
        path: "__init__.py",
        content: generateInit(),
      });

      // Generate view files
      files.push({
        path: "views/templates.xml",
        content: generateTemplatesXml(moduleName, pages),
      });

      files.push({
        path: "views/snippets.xml",
        content: generateSnippetsXml(moduleName),
      });

      files.push({
        path: "views/options.xml",
        content: generateOptionsXml(moduleName),
      });

      // Add preview image placeholder if specified
      if (config.previewImage) {
        warnings.push("Preview image path specified but not included in assets");
      }

      // Add any additional files
      if (additionalFiles) {
        files.push(...additionalFiles);
      }

      // Create ZIP blob
      const zipBlob = await this.createZipBlob(moduleName, files);

      return {
        success: true,
        blob: zipBlob,
        filename: `${moduleName}.zip`,
        files,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown error during export");
      return { success: false, errors };
    }
  }

  /**
   * Create ZIP blob from files
   */
  private async createZipBlob(moduleName: string, files: ModuleFile[]): Promise<Blob> {
    // Use a more complete ZIP implementation
    const encoder = new TextEncoder();
    const parts: { header: Uint8Array; data: Uint8Array; name: string }[] = [];

    let offset = 0;
    const centralDirectory: Uint8Array[] = [];

    for (const file of files) {
      const fullPath = `${moduleName}/${file.path}`;
      const pathBytes = encoder.encode(fullPath);

      let data: Uint8Array;
      if (typeof file.content === "string") {
        data = encoder.encode(file.content);
      } else {
        data = file.content;
      }

      // CRC32 calculation (simplified)
      const crc = this.crc32(data);

      // Local file header
      const localHeader = new Uint8Array(30 + pathBytes.length);
      const view = new DataView(localHeader.buffer);

      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true); // Version needed
      view.setUint16(6, 0, true); // General purpose flag
      view.setUint16(8, 0, true); // Compression method (stored)
      view.setUint16(10, 0, true); // File last mod time
      view.setUint16(12, 0, true); // File last mod date
      view.setUint32(14, crc, true); // CRC-32
      view.setUint32(18, data.length, true); // Compressed size
      view.setUint32(22, data.length, true); // Uncompressed size
      view.setUint16(26, pathBytes.length, true); // File name length
      view.setUint16(28, 0, true); // Extra field length

      localHeader.set(pathBytes, 30);

      // Central directory entry
      const centralEntry = new Uint8Array(46 + pathBytes.length);
      const centralView = new DataView(centralEntry.buffer);

      centralView.setUint32(0, 0x02014b50, true); // Central directory signature
      centralView.setUint16(4, 20, true); // Version made by
      centralView.setUint16(6, 20, true); // Version needed
      centralView.setUint16(8, 0, true); // General purpose flag
      centralView.setUint16(10, 0, true); // Compression method
      centralView.setUint16(12, 0, true); // File last mod time
      centralView.setUint16(14, 0, true); // File last mod date
      centralView.setUint32(16, crc, true); // CRC-32
      centralView.setUint32(20, data.length, true); // Compressed size
      centralView.setUint32(24, data.length, true); // Uncompressed size
      centralView.setUint16(28, pathBytes.length, true); // File name length
      centralView.setUint16(30, 0, true); // Extra field length
      centralView.setUint16(32, 0, true); // File comment length
      centralView.setUint16(34, 0, true); // Disk number start
      centralView.setUint16(36, 0, true); // Internal file attributes
      centralView.setUint32(38, 0, true); // External file attributes
      centralView.setUint32(42, offset, true); // Relative offset of local header

      centralEntry.set(pathBytes, 46);
      centralDirectory.push(centralEntry);

      parts.push({ header: localHeader, data, name: fullPath });
      offset += localHeader.length + data.length;
    }

    // Calculate total central directory size
    const centralDirSize = centralDirectory.reduce((sum, entry) => sum + entry.length, 0);
    const centralDirOffset = offset;

    // End of central directory
    const endOfCentral = new Uint8Array(22);
    const endView = new DataView(endOfCentral.buffer);

    endView.setUint32(0, 0x06054b50, true); // End of central directory signature
    endView.setUint16(4, 0, true); // Number of this disk
    endView.setUint16(6, 0, true); // Disk where central directory starts
    endView.setUint16(8, files.length, true); // Number of central directory records on this disk
    endView.setUint16(10, files.length, true); // Total number of central directory records
    endView.setUint32(12, centralDirSize, true); // Size of central directory
    endView.setUint32(16, centralDirOffset, true); // Offset of start of central directory
    endView.setUint16(20, 0, true); // Comment length

    // Combine all parts
    const totalSize = offset + centralDirSize + 22;
    const result = new Uint8Array(totalSize);

    let pos = 0;
    for (const part of parts) {
      result.set(part.header, pos);
      pos += part.header.length;
      result.set(part.data, pos);
      pos += part.data.length;
    }

    for (const entry of centralDirectory) {
      result.set(entry, pos);
      pos += entry.length;
    }

    result.set(endOfCentral, pos);

    return new Blob([result], { type: "application/zip" });
  }

  /**
   * Calculate CRC32 checksum
   */
  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    const table = this.getCrc32Table();

    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Get CRC32 lookup table
   */
  private getCrc32Table(): Uint32Array {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }

    return table;
  }

  /**
   * Quick export with defaults
   */
  async quickExport(
    displayName: string,
    pages: PageTemplate[],
    scssContent: string,
    odooVersion: OdooModuleVersion = "17.0"
  ): Promise<OdooModuleExportResult> {
    const technicalName = toTechnicalName(displayName);

    return this.exportModule(
      {
        technicalName,
        displayName,
        description: `${displayName} - Custom website theme`,
        version: "1.0.0",
        odooVersion,
        author: "Platxa Studio",
      },
      pages,
      [
        {
          filename: "theme.scss",
          content: scssContent,
          type: "scss",
        },
      ]
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let exporterInstance: OdooModuleExporter | null = null;

/**
 * Get OdooModuleExporter singleton
 */
export function getModuleExporter(): OdooModuleExporter {
  if (!exporterInstance) {
    exporterInstance = new OdooModuleExporter();
  }
  return exporterInstance;
}

/**
 * Create new OdooModuleExporter instance
 */
export function createModuleExporter(): OdooModuleExporter {
  return new OdooModuleExporter();
}

// =============================================================================
// Utility Exports
// =============================================================================

export { toTechnicalName, escapeXml };

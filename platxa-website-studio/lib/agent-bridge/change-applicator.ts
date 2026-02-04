/**
 * Change Applicator — Translates visual edits to QWeb/SCSS modifications
 *
 * Feature #26: Visual Edit Mode - Change application
 *
 * Converts property changes from VisualEditor into actual source edits:
 * - Attribute changes → QWeb template edits
 * - Style changes → Inline style or SCSS class modifications
 * - Class changes → QWeb class attribute edits
 */

import {
  type MappedElement,
  type SourcePosition,
  getSourceMapper,
} from "./source-mapper";
import { type EditableProperty, type PropertyType } from "./visual-editor";

// =============================================================================
// Types
// =============================================================================

/** Type of source edit */
export type EditType =
  | "attribute"      // Edit element attribute
  | "inline_style"   // Edit inline style attribute
  | "class_add"      // Add a class
  | "class_remove"   // Remove a class
  | "scss_property"  // Edit SCSS property
  | "scss_variable"; // Edit SCSS variable

/** A source file edit operation */
export interface SourceEdit {
  /** Unique edit ID */
  id: string;
  /** Edit type */
  type: EditType;
  /** Target file path */
  file: string;
  /** Start position */
  start: SourcePosition;
  /** End position */
  end: SourcePosition;
  /** Original text to replace */
  oldText: string;
  /** New text */
  newText: string;
  /** Property that triggered this edit */
  propertyId: string;
  /** Element being edited */
  elementId: string;
}

/** Result of applying edits */
export interface ApplyResult {
  /** Whether application succeeded */
  success: boolean;
  /** Number of edits applied */
  appliedCount: number;
  /** Failed edits */
  failed: Array<{ edit: SourceEdit; error: string }>;
  /** Modified files */
  modifiedFiles: string[];
}

/** SCSS context for a file */
export interface ScssContext {
  /** File path */
  file: string;
  /** Variables defined */
  variables: Map<string, { value: string; line: number }>;
  /** Classes defined */
  classes: Map<string, { line: number; properties: Map<string, number> }>;
}

/** Configuration for change applicator */
export interface ChangeApplicatorConfig {
  /** Prefer inline styles vs SCSS classes */
  preferInlineStyles: boolean;
  /** Auto-create SCSS classes for repeated styles */
  autoCreateClasses: boolean;
  /** SCSS file for new styles */
  defaultScssFile: string;
  /** Minimum reuse count to create class */
  classCreationThreshold: number;
}

/** File writer function */
export type FileWriter = (
  file: string,
  content: string
) => Promise<boolean>;

/** File reader function */
export type FileReader = (file: string) => Promise<string>;

// =============================================================================
// Constants
// =============================================================================

/** Default configuration */
export const DEFAULT_APPLICATOR_CONFIG: ChangeApplicatorConfig = {
  preferInlineStyles: true,
  autoCreateClasses: false,
  defaultScssFile: "static/src/scss/custom.scss",
  classCreationThreshold: 3,
};

// =============================================================================
// Helpers
// =============================================================================

let _editCounter = 0;

/** Reset counters (for testing) */
export function resetApplicatorCounters(): void {
  _editCounter = 0;
}

/** Generate edit ID */
function generateEditId(): string {
  return `source-edit-${_editCounter++}`;
}

/** Parse inline style string into map */
function parseInlineStyles(style: string): Map<string, string> {
  const styles = new Map<string, string>();
  if (!style) return styles;

  const parts = style.split(";");
  for (const part of parts) {
    const [prop, val] = part.split(":").map((s) => s.trim());
    if (prop && val) {
      styles.set(prop, val);
    }
  }
  return styles;
}

/** Serialize style map to inline string */
function serializeInlineStyles(styles: Map<string, string>): string {
  const parts: string[] = [];
  styles.forEach((val, prop) => {
    parts.push(`${prop}: ${val}`);
  });
  return parts.join("; ");
}

/** Parse class string into array */
function parseClasses(classStr: string): string[] {
  if (!classStr) return [];
  return classStr.split(/\s+/).filter((c) => c.length > 0);
}

/** Serialize class array to string */
function serializeClasses(classes: string[]): string {
  return classes.join(" ");
}

/** Find attribute in element source */
function findAttributeInSource(
  source: string,
  element: MappedElement,
  attrName: string
): { start: number; end: number; value: string } | null {
  // Find the opening tag
  const lines = source.split("\n");
  const startLine = element.range.start.line - 1;
  const endLine = Math.min(element.range.end.line, lines.length);

  // Build tag content
  let tagContent = "";
  for (let i = startLine; i < endLine; i++) {
    tagContent += lines[i] + "\n";
    if (lines[i].includes(">")) break;
  }

  // Find attribute pattern
  const patterns = [
    new RegExp(`(${attrName})="([^"]*)"`, "i"),
    new RegExp(`(${attrName})='([^']*)'`, "i"),
  ];

  for (const pattern of patterns) {
    const match = tagContent.match(pattern);
    if (match) {
      const attrStart = tagContent.indexOf(match[0]);
      return {
        start: attrStart,
        end: attrStart + match[0].length,
        value: match[2],
      };
    }
  }

  return null;
}

/** Calculate position in file from line content */
function calculatePosition(
  lines: string[],
  lineNum: number,
  offset: number
): SourcePosition {
  let col = 1;
  const line = lines[lineNum - 1] || "";

  // Find actual column from offset within line
  col = offset + 1;

  return { line: lineNum, column: col };
}

// =============================================================================
// ChangeApplicator Class
// =============================================================================

/**
 * ChangeApplicator translates visual property changes into source edits.
 *
 * Usage:
 * ```ts
 * const applicator = new ChangeApplicator(fileReader, fileWriter);
 *
 * // Generate edits for a property change
 * const edits = await applicator.generateEdits(element, property, newValue);
 *
 * // Apply edits to files
 * const result = await applicator.applyEdits(edits);
 * ```
 */
export class ChangeApplicator {
  private config: ChangeApplicatorConfig;
  private fileReader: FileReader;
  private fileWriter: FileWriter;
  private fileCache: Map<string, string> = new Map();
  private scssContexts: Map<string, ScssContext> = new Map();

  constructor(
    fileReader: FileReader,
    fileWriter: FileWriter,
    config: Partial<ChangeApplicatorConfig> = {}
  ) {
    this.config = { ...DEFAULT_APPLICATOR_CONFIG, ...config };
    this.fileReader = fileReader;
    this.fileWriter = fileWriter;
  }

  // ---------------------------------------------------------------------------
  // Edit Generation
  // ---------------------------------------------------------------------------

  /**
   * Generate source edits for a property change.
   */
  async generateEdits(
    element: MappedElement,
    property: EditableProperty,
    newValue: string
  ): Promise<SourceEdit[]> {
    const edits: SourceEdit[] = [];

    // Load file content
    const content = await this.loadFile(element.file);
    if (!content) return edits;

    switch (property.type) {
      case "class":
        edits.push(...this.generateClassEdit(element, property, newValue, content));
        break;

      case "style":
      case "color":
      case "size":
      case "spacing":
      case "font":
      case "border":
      case "shadow":
      case "visibility":
        if (this.config.preferInlineStyles || property.attributeName === "style") {
          edits.push(...this.generateStyleEdit(element, property, newValue, content));
        } else {
          edits.push(...await this.generateScssEdit(element, property, newValue));
        }
        break;

      case "attribute":
      case "text":
      default:
        edits.push(...this.generateAttributeEdit(element, property, newValue, content));
        break;
    }

    return edits;
  }

  /**
   * Generate edit for class attribute change.
   */
  private generateClassEdit(
    element: MappedElement,
    property: EditableProperty,
    newValue: string,
    content: string
  ): SourceEdit[] {
    const edits: SourceEdit[] = [];
    const lines = content.split("\n");

    const attrInfo = findAttributeInSource(content, element, "class");

    if (attrInfo) {
      // Update existing class attribute
      const lineIdx = element.range.start.line - 1;
      const line = lines[lineIdx];
      const attrStart = line.indexOf('class="');

      if (attrStart !== -1) {
        const valueStart = attrStart + 7; // 'class="'.length
        const valueEnd = line.indexOf('"', valueStart);

        edits.push({
          id: generateEditId(),
          type: "attribute",
          file: element.file,
          start: { line: element.range.start.line, column: valueStart + 1 },
          end: { line: element.range.start.line, column: valueEnd + 1 },
          oldText: attrInfo.value,
          newText: newValue,
          propertyId: property.id,
          elementId: element.id,
        });
      }
    } else {
      // Need to add class attribute - find insertion point after tag name
      edits.push(this.createAttributeInsertEdit(element, "class", newValue, property.id, content));
    }

    return edits;
  }

  /**
   * Generate edit for inline style change.
   */
  private generateStyleEdit(
    element: MappedElement,
    property: EditableProperty,
    newValue: string,
    content: string
  ): SourceEdit[] {
    const edits: SourceEdit[] = [];
    const lines = content.split("\n");

    // Get current styles
    const currentStyle = element.attributes["style"] || "";
    const styles = parseInlineStyles(currentStyle);

    // Update the specific CSS property
    if (property.cssProperty) {
      if (newValue) {
        styles.set(property.cssProperty, newValue);
      } else {
        styles.delete(property.cssProperty);
      }
    } else {
      // Full style replacement
      return this.generateAttributeEdit(element, property, newValue, content);
    }

    const newStyle = serializeInlineStyles(styles);

    // Find or create style attribute
    const attrInfo = findAttributeInSource(content, element, "style");

    if (attrInfo) {
      // Update existing style attribute
      const lineIdx = element.range.start.line - 1;
      const line = lines[lineIdx];
      const attrStart = line.indexOf('style="');

      if (attrStart !== -1) {
        const valueStart = attrStart + 7;
        const valueEnd = line.indexOf('"', valueStart);

        edits.push({
          id: generateEditId(),
          type: "inline_style",
          file: element.file,
          start: { line: element.range.start.line, column: valueStart + 1 },
          end: { line: element.range.start.line, column: valueEnd + 1 },
          oldText: attrInfo.value,
          newText: newStyle,
          propertyId: property.id,
          elementId: element.id,
        });
      }
    } else if (newStyle) {
      // Need to add style attribute
      edits.push(this.createAttributeInsertEdit(element, "style", newStyle, property.id, content));
    }

    return edits;
  }

  /**
   * Generate edit for generic attribute change.
   */
  private generateAttributeEdit(
    element: MappedElement,
    property: EditableProperty,
    newValue: string,
    content: string
  ): SourceEdit[] {
    const edits: SourceEdit[] = [];
    const attrName = property.attributeName || property.name;
    const lines = content.split("\n");

    const attrInfo = findAttributeInSource(content, element, attrName);

    if (attrInfo) {
      // Update existing attribute
      const lineIdx = element.range.start.line - 1;
      const line = lines[lineIdx];
      const pattern = new RegExp(`${attrName}="[^"]*"`, "i");
      const match = line.match(pattern);

      if (match) {
        const attrStart = line.indexOf(match[0]);
        const valueStart = attrStart + attrName.length + 2;
        const valueEnd = line.indexOf('"', valueStart);

        edits.push({
          id: generateEditId(),
          type: "attribute",
          file: element.file,
          start: { line: element.range.start.line, column: valueStart + 1 },
          end: { line: element.range.start.line, column: valueEnd + 1 },
          oldText: attrInfo.value,
          newText: newValue,
          propertyId: property.id,
          elementId: element.id,
        });
      }
    } else if (newValue) {
      // Add new attribute
      edits.push(this.createAttributeInsertEdit(element, attrName, newValue, property.id, content));
    }

    return edits;
  }

  /**
   * Generate SCSS edit for style property.
   */
  private async generateScssEdit(
    element: MappedElement,
    property: EditableProperty,
    newValue: string
  ): Promise<SourceEdit[]> {
    const edits: SourceEdit[] = [];

    // For now, fall back to inline styles
    // Full SCSS editing would require more complex class tracking
    const content = await this.loadFile(element.file);
    if (content) {
      edits.push(...this.generateStyleEdit(element, property, newValue, content));
    }

    return edits;
  }

  /**
   * Create an attribute insertion edit.
   */
  private createAttributeInsertEdit(
    element: MappedElement,
    attrName: string,
    value: string,
    propertyId: string,
    content: string
  ): SourceEdit {
    const lines = content.split("\n");
    const lineIdx = element.range.start.line - 1;
    const line = lines[lineIdx];

    // Find position after tag name
    const tagMatch = line.match(new RegExp(`<${element.tagName}`, "i"));
    const insertCol = tagMatch
      ? line.indexOf(tagMatch[0]) + tagMatch[0].length + 1
      : element.range.start.column + element.tagName.length + 1;

    return {
      id: generateEditId(),
      type: "attribute",
      file: element.file,
      start: { line: element.range.start.line, column: insertCol },
      end: { line: element.range.start.line, column: insertCol },
      oldText: "",
      newText: ` ${attrName}="${value}"`,
      propertyId,
      elementId: element.id,
    };
  }

  // ---------------------------------------------------------------------------
  // Edit Application
  // ---------------------------------------------------------------------------

  /**
   * Apply edits to source files.
   */
  async applyEdits(edits: SourceEdit[]): Promise<ApplyResult> {
    const result: ApplyResult = {
      success: true,
      appliedCount: 0,
      failed: [],
      modifiedFiles: [],
    };

    // Group edits by file
    const editsByFile = new Map<string, SourceEdit[]>();
    for (const edit of edits) {
      const fileEdits = editsByFile.get(edit.file) || [];
      fileEdits.push(edit);
      editsByFile.set(edit.file, fileEdits);
    }

    // Apply edits file by file
    const fileEntries: Array<[string, SourceEdit[]]> = [];
    editsByFile.forEach((v, k) => fileEntries.push([k, v]));

    for (const [file, fileEdits] of fileEntries) {
      try {
        const content = await this.loadFile(file);
        if (!content) {
          for (const edit of fileEdits) {
            result.failed.push({ edit, error: "File not found" });
          }
          continue;
        }

        // Sort edits by position (reverse order for safe application)
        const sortedEdits = fileEdits.sort((a, b) => {
          if (a.start.line !== b.start.line) {
            return b.start.line - a.start.line;
          }
          return b.start.column - a.start.column;
        });

        // Apply edits
        let modifiedContent = content;
        for (const edit of sortedEdits) {
          try {
            modifiedContent = this.applyEditToContent(modifiedContent, edit);
            result.appliedCount++;
          } catch (error) {
            result.failed.push({ edit, error: String(error) });
          }
        }

        // Write modified file
        const writeSuccess = await this.fileWriter(file, modifiedContent);
        if (writeSuccess) {
          result.modifiedFiles.push(file);
          this.fileCache.set(file, modifiedContent);
        } else {
          result.success = false;
        }
      } catch (error) {
        result.success = false;
        for (const edit of fileEdits) {
          result.failed.push({ edit, error: String(error) });
        }
      }
    }

    result.success = result.failed.length === 0;
    return result;
  }

  /**
   * Apply a single edit to content string.
   */
  private applyEditToContent(content: string, edit: SourceEdit): string {
    const lines = content.split("\n");

    if (edit.start.line === edit.end.line) {
      // Single-line edit
      const lineIdx = edit.start.line - 1;
      if (lineIdx >= lines.length) {
        throw new Error(`Line ${edit.start.line} out of range`);
      }

      const line = lines[lineIdx];
      const startCol = edit.start.column - 1;
      const endCol = edit.end.column - 1;

      const newLine =
        line.slice(0, startCol) + edit.newText + line.slice(endCol);
      lines[lineIdx] = newLine;
    } else {
      // Multi-line edit (more complex)
      const startLineIdx = edit.start.line - 1;
      const endLineIdx = edit.end.line - 1;
      const startCol = edit.start.column - 1;
      const endCol = edit.end.column - 1;

      const beforeEdit = lines[startLineIdx].slice(0, startCol);
      const afterEdit = lines[endLineIdx].slice(endCol);

      const newLines = edit.newText.split("\n");
      newLines[0] = beforeEdit + newLines[0];
      newLines[newLines.length - 1] += afterEdit;

      lines.splice(startLineIdx, endLineIdx - startLineIdx + 1, ...newLines);
    }

    return lines.join("\n");
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  /**
   * Load file content with caching.
   */
  private async loadFile(file: string): Promise<string | null> {
    if (this.fileCache.has(file)) {
      return this.fileCache.get(file)!;
    }

    try {
      const content = await this.fileReader(file);
      this.fileCache.set(file, content);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Clear file cache.
   */
  clearCache(): void {
    this.fileCache.clear();
  }

  /**
   * Invalidate cache for specific file.
   */
  invalidateFile(file: string): void {
    this.fileCache.delete(file);
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /** Get current configuration */
  getConfig(): ChangeApplicatorConfig {
    return { ...this.config };
  }

  /** Update configuration */
  setConfig(config: Partial<ChangeApplicatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a ChangeApplicator with in-memory file storage.
 * Useful for testing.
 */
export function createMockApplicator(
  initialFiles: Record<string, string> = {}
): {
  applicator: ChangeApplicator;
  files: Map<string, string>;
} {
  const files = new Map<string, string>(Object.entries(initialFiles));

  const reader: FileReader = async (file) => {
    return files.get(file) || "";
  };

  const writer: FileWriter = async (file, content) => {
    files.set(file, content);
    return true;
  };

  return {
    applicator: new ChangeApplicator(reader, writer),
    files,
  };
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _instance: ChangeApplicator | null = null;
let _reader: FileReader | null = null;
let _writer: FileWriter | null = null;

/** Set the global file reader/writer */
export function setApplicatorIO(reader: FileReader, writer: FileWriter): void {
  _reader = reader;
  _writer = writer;
  _instance = null; // Reset instance to use new IO
}

/** Get the global ChangeApplicator instance */
export function getChangeApplicator(): ChangeApplicator {
  if (!_instance) {
    if (!_reader || !_writer) {
      // Create no-op instance
      _reader = async () => "";
      _writer = async () => false;
    }
    _instance = new ChangeApplicator(_reader, _writer);
  }
  return _instance;
}

/** Reset the global ChangeApplicator instance */
export function resetChangeApplicator(): void {
  if (_instance) {
    _instance.clearCache();
    _instance = null;
  }
  resetApplicatorCounters();
}

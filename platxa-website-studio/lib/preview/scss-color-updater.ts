/**
 * SCSS Color Variable Updater
 *
 * Maps color picker changes to Odoo SCSS variable updates.
 * Modifies $o-color-N variables in SCSS source and triggers
 * live-reload by updating the editor store file contents.
 */

// =============================================================================
// Types
// =============================================================================

/** Odoo color palette variable mapping (1-indexed) */
export interface OdooColorPalette {
  [index: number]: string;
}

/** Result of applying a color change to SCSS source */
export interface ScssColorUpdateResult {
  /** Updated SCSS source */
  updatedSource: string;
  /** Whether the source was actually changed */
  changed: boolean;
  /** The variable name that was updated */
  variableName: string;
  /** Previous value (null if variable didn't exist) */
  previousValue: string | null;
  /** New value */
  newValue: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Standard Odoo color palette variable prefix */
export const ODOO_COLOR_VAR_PREFIX = "$o-color-";

/** Number of standard Odoo palette colors */
export const ODOO_PALETTE_SIZE = 5;

/** Maps CSS var references to palette index */
export const CSS_VAR_TO_PALETTE: Record<string, number> = {
  "var(--o-color-1)": 1,
  "var(--o-color-2)": 2,
  "var(--o-color-3)": 3,
  "var(--o-color-4)": 4,
  "var(--o-color-5)": 5,
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Extracts the current Odoo color palette from SCSS source.
 * Reads $o-color-1 through $o-color-5 variables.
 */
export function extractColorPalette(scssSource: string): OdooColorPalette {
  const palette: OdooColorPalette = {};
  const regex = /\$o-color-(\d+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = regex.exec(scssSource)) !== null) {
    const index = parseInt(match[1], 10);
    palette[index] = match[2].trim();
  }

  return palette;
}

/**
 * Updates a single $o-color-N variable in SCSS source.
 * If the variable doesn't exist, appends it at the top of the file.
 */
export function updateColorVariable(
  scssSource: string,
  colorIndex: number,
  newValue: string,
): ScssColorUpdateResult {
  const variableName = `${ODOO_COLOR_VAR_PREFIX}${colorIndex}`;
  const varRegex = new RegExp(
    `(\\$o-color-${colorIndex}\\s*:\\s*)([^;]+)(;)`,
  );
  const match = scssSource.match(varRegex);

  if (match) {
    const previousValue = match[2].trim();
    if (previousValue === newValue) {
      return {
        updatedSource: scssSource,
        changed: false,
        variableName,
        previousValue,
        newValue,
      };
    }

    const updatedSource = scssSource.replace(varRegex, `$1${newValue}$3`);
    return {
      updatedSource,
      changed: true,
      variableName,
      previousValue,
      newValue,
    };
  }

  // Variable doesn't exist — prepend it
  const declaration = `${variableName}: ${newValue};\n`;
  return {
    updatedSource: declaration + scssSource,
    changed: true,
    variableName,
    previousValue: null,
    newValue,
  };
}

/**
 * Resolves a CSS variable reference (e.g. "var(--o-color-1)") or hex value
 * to a palette index and hex color for SCSS update.
 *
 * Returns null if the value is not a palette color reference.
 */
export function resolveColorToPalette(
  cssValue: string,
): { paletteIndex: number; hexValue: string } | null {
  // Direct CSS var reference
  const paletteIndex = CSS_VAR_TO_PALETTE[cssValue];
  if (paletteIndex != null) {
    // Caller must provide the actual hex — this just identifies the slot
    return { paletteIndex, hexValue: cssValue };
  }

  // Hex color — not a palette ref, but can be applied directly
  if (/^#[0-9a-fA-F]{3,8}$/.test(cssValue)) {
    return null; // Custom hex, not a palette mapping
  }

  return null;
}

/**
 * Applies a color picker change to all SCSS files in the editor.
 * Finds the file containing $o-color-N and updates it.
 *
 * Returns the path of the modified file and the update result,
 * or null if no matching file was found.
 */
export function applyColorChange(
  fileContents: Record<string, string>,
  paletteIndex: number,
  newHexValue: string,
): { path: string; result: ScssColorUpdateResult } | null {
  // Find the SCSS file containing color palette variables
  for (const [path, content] of Object.entries(fileContents)) {
    if (!path.endsWith(".scss")) continue;

    const varRegex = new RegExp(`\\$o-color-${paletteIndex}\\s*:`);
    if (varRegex.test(content)) {
      const result = updateColorVariable(content, paletteIndex, newHexValue);
      return { path, result };
    }
  }

  // No existing file with the variable — find any SCSS file to prepend
  const scssFiles = Object.keys(fileContents).filter((p) => p.endsWith(".scss"));
  if (scssFiles.length > 0) {
    const path = scssFiles[0];
    const result = updateColorVariable(fileContents[path], paletteIndex, newHexValue);
    return { path, result };
  }

  return null;
}

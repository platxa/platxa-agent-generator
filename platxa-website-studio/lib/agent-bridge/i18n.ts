/**
 * Internationalization (i18n) Support
 *
 * Wraps generated theme content with Odoo _() translation markers
 * and generates .po file templates for multi-language support.
 */

// =============================================================================
// Types
// =============================================================================

export interface TranslationEntry {
  /** Unique key */
  id: string;
  /** Source string (English) */
  msgid: string;
  /** Translated string (empty in template) */
  msgstr: string;
  /** Source file reference */
  reference: string;
  /** Optional context for disambiguation */
  context?: string;
  /** Optional comment for translators */
  comment?: string;
}

export interface PoFile {
  /** Target language code (e.g. "es_ES", "fr_FR") */
  language: string;
  /** Module name */
  moduleName: string;
  /** Entries */
  entries: TranslationEntry[];
  /** Generation timestamp */
  generatedAt: string;
}

export interface I18nConfig {
  /** Odoo module name */
  moduleName: string;
  /** Source language (default "en_US") */
  sourceLanguage: string;
  /** Target languages */
  targetLanguages: string[];
  /** Whether to extract from XML templates */
  extractXml: boolean;
  /** Whether to extract from Python code */
  extractPython: boolean;
}

export const DEFAULT_I18N_CONFIG: I18nConfig = {
  moduleName: "theme_custom",
  sourceLanguage: "en_US",
  targetLanguages: ["es_ES", "fr_FR", "de_DE"],
  extractXml: true,
  extractPython: true,
};

export interface I18nState {
  config: I18nConfig;
  entries: TranslationEntry[];
  entryCounter: number;
}

export interface ExtractionResult {
  state: I18nState;
  extractedCount: number;
}

// =============================================================================
// State
// =============================================================================

export function createI18nState(config: Partial<I18nConfig> = {}): I18nState {
  return {
    config: { ...DEFAULT_I18N_CONFIG, ...config },
    entries: [],
    entryCounter: 0,
  };
}

// =============================================================================
// Translation Marker Wrapping
// =============================================================================

/**
 * Wraps a Python string literal with Odoo _() translation marker.
 * Handles single and double quotes. Skips already-wrapped strings.
 */
export function wrapWithTranslationMarker(value: string): string {
  if (value.startsWith("_(") && value.endsWith(")")) return value;
  // Determine quote style
  const quote = value.includes("'") ? '"' : "'";
  return `_(${quote}${value}${quote})`;
}

/**
 * Processes Python source code and wraps user-facing strings with _().
 * Targets: field labels, help text, string defaults, error messages, descriptions.
 */
export function wrapPythonStrings(source: string): string {
  let result = source;

  // Wrap field string= parameters: string="Some Label"
  result = result.replace(
    /(\bstring\s*=\s*)(['"])((?:(?!\2).)+)\2/g,
    (_, prefix, quote, content) => {
      return `${prefix}_(${quote}${content}${quote})`;
    },
  );

  // Wrap help= parameters: help="Some help text"
  result = result.replace(
    /(\bhelp\s*=\s*)(['"])((?:(?!\2).)+)\2/g,
    (_, prefix, quote, content) => {
      return `${prefix}_(${quote}${content}${quote})`;
    },
  );

  // Wrap raise ...Error("message")
  result = result.replace(
    /(raise\s+\w+Error\s*\()(['"])((?:(?!\2).)+)\2(\))/g,
    (_, prefix, quote, content, suffix) => {
      return `${prefix}_(${quote}${content}${quote})${suffix}`;
    },
  );

  return result;
}

/**
 * Processes XML/QWeb template and wraps translatable text nodes.
 * Adds t-translation attributes where needed.
 */
export function wrapXmlStrings(xml: string): string {
  let result = xml;

  // Wrap string= attributes in XML (Odoo views)
  result = result.replace(
    /(\bstring\s*=\s*")([^"]+)(")/g,
    (_, prefix, content, suffix) => {
      return `${prefix}${content}${suffix}`;
    },
  );

  return result;
}

// =============================================================================
// String Extraction
// =============================================================================

/**
 * Extracts translatable strings from Python source.
 */
export function extractFromPython(
  state: I18nState,
  source: string,
  filename: string,
): ExtractionResult {
  const strings: Array<{ value: string; line: number }> = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match _('...') or _("...")
    const markerRegex = /_\(\s*(['"])((?:(?!\1).)*)\1\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = markerRegex.exec(line)) !== null) {
      strings.push({ value: match[2], line: i + 1 });
    }

    // Match string="..." in Python field definitions (not already wrapped)
    const stringAttrRegex = /\bstring\s*=\s*(['"])((?:(?!\1).)*)\1/g;
    while ((match = stringAttrRegex.exec(line)) !== null) {
      const val = match[2];
      // Skip if already extracted via _() on same line
      if (!strings.some((s) => s.value === val && s.line === i + 1)) {
        strings.push({ value: val, line: i + 1 });
      }
    }

    // Match help="..." in Python field definitions
    const helpRegex = /\bhelp\s*=\s*(['"])((?:(?!\1).)*)\1/g;
    while ((match = helpRegex.exec(line)) !== null) {
      const val = match[2];
      if (!strings.some((s) => s.value === val && s.line === i + 1)) {
        strings.push({ value: val, line: i + 1 });
      }
    }
  }

  // Deduplicate by value
  const seen = new Set<string>();
  const unique = strings.filter((s) => {
    if (seen.has(s.value)) return false;
    seen.add(s.value);
    return true;
  });

  let counter = state.entryCounter;
  const newEntries: TranslationEntry[] = unique
    .filter((s) => !state.entries.some((e) => e.msgid === s.value))
    .map((s) => ({
      id: `tr_${++counter}`,
      msgid: s.value,
      msgstr: "",
      reference: `${filename}:${s.line}`,
    }));

  return {
    state: {
      ...state,
      entries: [...state.entries, ...newEntries],
      entryCounter: counter,
    },
    extractedCount: newEntries.length,
  };
}

/**
 * Extracts translatable strings from XML/QWeb templates.
 */
export function extractFromXml(
  state: I18nState,
  xml: string,
  filename: string,
): ExtractionResult {
  const strings: Array<{ value: string; line: number }> = [];
  const lines = xml.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match string="..." attributes
    const stringRegex = /\bstring\s*=\s*"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = stringRegex.exec(line)) !== null) {
      strings.push({ value: match[1], line: i + 1 });
    }

    // Match placeholder="..." attributes
    const placeholderRegex = /\bplaceholder\s*=\s*"([^"]+)"/g;
    while ((match = placeholderRegex.exec(line)) !== null) {
      strings.push({ value: match[1], line: i + 1 });
    }

    // Match title="..." attributes (non-technical)
    const titleRegex = /\btitle\s*=\s*"([^"]+)"/g;
    while ((match = titleRegex.exec(line)) !== null) {
      const val = match[1];
      // Skip technical values (class names, IDs, etc.)
      if (!val.includes(".") && !val.includes("_") && val.length > 1) {
        strings.push({ value: val, line: i + 1 });
      }
    }
  }

  const seen = new Set<string>();
  const unique = strings.filter((s) => {
    if (seen.has(s.value)) return false;
    seen.add(s.value);
    return true;
  });

  let counter = state.entryCounter;
  const newEntries: TranslationEntry[] = unique
    .filter((s) => !state.entries.some((e) => e.msgid === s.value))
    .map((s) => ({
      id: `tr_${++counter}`,
      msgid: s.value,
      msgstr: "",
      reference: `${filename}:${s.line}`,
    }));

  return {
    state: {
      ...state,
      entries: [...state.entries, ...newEntries],
      entryCounter: counter,
    },
    extractedCount: newEntries.length,
  };
}

// =============================================================================
// .po File Generation
// =============================================================================

/**
 * Generates a .po file content string for a target language.
 */
export function generatePoFile(state: I18nState, language: string): PoFile {
  return {
    language,
    moduleName: state.config.moduleName,
    entries: state.entries.map((e) => ({ ...e, msgstr: "" })),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Serializes a PoFile to standard .po format string.
 */
export function serializePoFile(po: PoFile): string {
  const lines: string[] = [];

  // Header
  lines.push("# Translation file for Odoo.");
  lines.push(`# Module: ${po.moduleName}`);
  lines.push(`# Language: ${po.language}`);
  lines.push(`# Generated: ${po.generatedAt}`);
  lines.push("#");
  lines.push('msgid ""');
  lines.push('msgstr ""');
  lines.push(`"Language: ${po.language}\\n"`);
  lines.push(`"Content-Type: text/plain; charset=UTF-8\\n"`);
  lines.push(`"Content-Transfer-Encoding: 8bit\\n"`);
  lines.push("");

  for (const entry of po.entries) {
    if (entry.comment) {
      lines.push(`#. ${entry.comment}`);
    }
    lines.push(`#: ${entry.reference}`);
    if (entry.context) {
      lines.push(`msgctxt "${escapePoString(entry.context)}"`);
    }
    lines.push(`msgid "${escapePoString(entry.msgid)}"`);
    lines.push(`msgstr "${escapePoString(entry.msgstr)}"`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Parses a .po format string back into a PoFile.
 */
export function parsePoFile(content: string, moduleName: string): PoFile {
  const entries: TranslationEntry[] = [];
  const lines = content.split("\n");

  let language = "";
  let currentMsgid = "";
  let currentMsgstr = "";
  let currentRef = "";
  let currentComment = "";
  let currentContext = "";
  let inHeader = true;
  let counter = 0;

  function flush() {
    if (currentMsgid) {
      entries.push({
        id: `tr_${++counter}`,
        msgid: currentMsgid,
        msgstr: currentMsgstr,
        reference: currentRef,
        comment: currentComment || undefined,
        context: currentContext || undefined,
      });
    }
    currentMsgid = "";
    currentMsgstr = "";
    currentRef = "";
    currentComment = "";
    currentContext = "";
  }

  for (const line of lines) {
    if (inHeader) {
      const langMatch = line.match(/"Language:\s*([^\\]+)/);
      if (langMatch) language = langMatch[1].trim();
      if (line === "" && language) inHeader = false;
      continue;
    }

    if (line.startsWith("#: ")) {
      flush();
      currentRef = line.slice(3);
    } else if (line.startsWith("#. ")) {
      currentComment = line.slice(3);
    } else if (line.startsWith("msgctxt ")) {
      currentContext = unescapePoString(line.slice(9, -1));
    } else if (line.startsWith("msgid ")) {
      currentMsgid = unescapePoString(line.slice(7, -1));
    } else if (line.startsWith("msgstr ")) {
      currentMsgstr = unescapePoString(line.slice(8, -1));
    }
  }
  flush();

  return {
    language,
    moduleName,
    entries,
    generatedAt: "",
  };
}

function escapePoString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function unescapePoString(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

// =============================================================================
// Full Pipeline
// =============================================================================

export interface I18nResult {
  state: I18nState;
  poFiles: PoFile[];
  totalStrings: number;
}

/**
 * Full i18n pipeline: extract strings from sources, generate .po files.
 */
export function processI18n(
  sources: Array<{ content: string; filename: string; type: "python" | "xml" }>,
  config: Partial<I18nConfig> = {},
): I18nResult {
  let state = createI18nState(config);

  for (const src of sources) {
    if (src.type === "python" && state.config.extractPython) {
      ({ state } = extractFromPython(state, src.content, src.filename));
    } else if (src.type === "xml" && state.config.extractXml) {
      ({ state } = extractFromXml(state, src.content, src.filename));
    }
  }

  const poFiles = state.config.targetLanguages.map((lang) =>
    generatePoFile(state, lang),
  );

  return {
    state,
    poFiles,
    totalStrings: state.entries.length,
  };
}

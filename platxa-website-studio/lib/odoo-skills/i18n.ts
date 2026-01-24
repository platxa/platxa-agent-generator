/**
 * Odoo Theme i18n Support
 *
 * Production-grade internationalization for Odoo themes including:
 * - String extraction from QWeb templates
 * - PO/POT file generation
 * - Language configuration
 * - RTL support
 * - Number and date formatting
 */

import type {
  LanguageConfig,
  TranslationEntry,
  TranslationFile,
  GeneratedFile,
} from "./types";

// =============================================================================
// LANGUAGE CONFIGURATIONS
// =============================================================================

/**
 * Pre-configured languages with their settings
 */
export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  en_US: {
    code: "en_US",
    name: "English (US)",
    nativeName: "English",
    rtl: false,
    dateFormat: "MM/DD/YYYY",
    numberFormat: { decimal: ".", thousand: "," },
  },
  en_GB: {
    code: "en_GB",
    name: "English (UK)",
    nativeName: "English",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ".", thousand: "," },
  },
  es_ES: {
    code: "es_ES",
    name: "Spanish (Spain)",
    nativeName: "Español",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousand: "." },
  },
  es_MX: {
    code: "es_MX",
    name: "Spanish (Mexico)",
    nativeName: "Español",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ".", thousand: "," },
  },
  fr_FR: {
    code: "fr_FR",
    name: "French",
    nativeName: "Français",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousand: " " },
  },
  de_DE: {
    code: "de_DE",
    name: "German",
    nativeName: "Deutsch",
    rtl: false,
    dateFormat: "DD.MM.YYYY",
    numberFormat: { decimal: ",", thousand: "." },
  },
  it_IT: {
    code: "it_IT",
    name: "Italian",
    nativeName: "Italiano",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousand: "." },
  },
  pt_BR: {
    code: "pt_BR",
    name: "Portuguese (Brazil)",
    nativeName: "Português",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousand: "." },
  },
  pt_PT: {
    code: "pt_PT",
    name: "Portuguese (Portugal)",
    nativeName: "Português",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousand: " " },
  },
  nl_NL: {
    code: "nl_NL",
    name: "Dutch",
    nativeName: "Nederlands",
    rtl: false,
    dateFormat: "DD-MM-YYYY",
    numberFormat: { decimal: ",", thousand: "." },
  },
  ru_RU: {
    code: "ru_RU",
    name: "Russian",
    nativeName: "Русский",
    rtl: false,
    dateFormat: "DD.MM.YYYY",
    numberFormat: { decimal: ",", thousand: " " },
  },
  zh_CN: {
    code: "zh_CN",
    name: "Chinese (Simplified)",
    nativeName: "简体中文",
    rtl: false,
    dateFormat: "YYYY-MM-DD",
    numberFormat: { decimal: ".", thousand: "," },
  },
  zh_TW: {
    code: "zh_TW",
    name: "Chinese (Traditional)",
    nativeName: "繁體中文",
    rtl: false,
    dateFormat: "YYYY/MM/DD",
    numberFormat: { decimal: ".", thousand: "," },
  },
  ja_JP: {
    code: "ja_JP",
    name: "Japanese",
    nativeName: "日本語",
    rtl: false,
    dateFormat: "YYYY/MM/DD",
    numberFormat: { decimal: ".", thousand: "," },
  },
  ko_KR: {
    code: "ko_KR",
    name: "Korean",
    nativeName: "한국어",
    rtl: false,
    dateFormat: "YYYY.MM.DD",
    numberFormat: { decimal: ".", thousand: "," },
  },
  ar_SA: {
    code: "ar_SA",
    name: "Arabic (Saudi Arabia)",
    nativeName: "العربية",
    rtl: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: "٫", thousand: "٬" },
  },
  ar_EG: {
    code: "ar_EG",
    name: "Arabic (Egypt)",
    nativeName: "العربية",
    rtl: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: "٫", thousand: "٬" },
  },
  he_IL: {
    code: "he_IL",
    name: "Hebrew",
    nativeName: "עברית",
    rtl: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ".", thousand: "," },
  },
  hi_IN: {
    code: "hi_IN",
    name: "Hindi",
    nativeName: "हिन्दी",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ".", thousand: "," },
  },
  tr_TR: {
    code: "tr_TR",
    name: "Turkish",
    nativeName: "Türkçe",
    rtl: false,
    dateFormat: "DD.MM.YYYY",
    numberFormat: { decimal: ",", thousand: "." },
  },
  pl_PL: {
    code: "pl_PL",
    name: "Polish",
    nativeName: "Polski",
    rtl: false,
    dateFormat: "DD.MM.YYYY",
    numberFormat: { decimal: ",", thousand: " " },
  },
  uk_UA: {
    code: "uk_UA",
    name: "Ukrainian",
    nativeName: "Українська",
    rtl: false,
    dateFormat: "DD.MM.YYYY",
    numberFormat: { decimal: ",", thousand: " " },
  },
  th_TH: {
    code: "th_TH",
    name: "Thai",
    nativeName: "ไทย",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ".", thousand: "," },
  },
  vi_VN: {
    code: "vi_VN",
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousand: "." },
  },
  id_ID: {
    code: "id_ID",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    rtl: false,
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousand: "." },
  },
};

// =============================================================================
// STRING EXTRACTION
// =============================================================================

/**
 * Patterns for extracting translatable strings from QWeb templates
 */
const TRANSLATION_PATTERNS = [
  // Text content
  { pattern: />([^<]+)</g, type: "text" },
  // Attribute values (title, alt, placeholder, aria-label)
  { pattern: /title="([^"]+)"/g, type: "attribute" },
  { pattern: /alt="([^"]+)"/g, type: "attribute" },
  { pattern: /placeholder="([^"]+)"/g, type: "attribute" },
  { pattern: /aria-label="([^"]+)"/g, type: "attribute" },
  // t-att-title with string
  { pattern: /t-att-title="'([^']+)'"/g, type: "dynamic" },
  // t-esc with string
  { pattern: /t-esc="'([^']+)'"/g, type: "expression" },
];

/**
 * Strings to ignore during extraction
 */
const IGNORE_PATTERNS = [
  /^\s*$/,           // Empty or whitespace
  /^\d+$/,           // Numbers only
  /^[a-z_]+$/,       // Variable names
  /^#[0-9a-fA-F]+$/, // Color codes
  /^https?:\/\//,    // URLs
  /^[<>&]+$/,        // HTML entities
  /^\s*[{}()[\]]\s*$/,  // Brackets only
  /^[.,;:!?-]+$/,    // Punctuation only
];

/**
 * Check if a string should be translated
 */
function isTranslatable(text: string): boolean {
  const trimmed = text.trim();

  if (trimmed.length < 2) return false;
  if (IGNORE_PATTERNS.some(p => p.test(trimmed))) return false;

  // Must contain at least one letter
  if (!/[a-zA-Z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]/.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Extract translatable strings from QWeb template content
 */
export function extractStrings(
  content: string,
  filePath: string
): TranslationEntry[] {
  const entries: TranslationEntry[] = [];
  const seen = new Set<string>();
  const lines = content.split("\n");

  TRANSLATION_PATTERNS.forEach(({ pattern }) => {
    let match;
    // Reset regex lastIndex
    pattern.lastIndex = 0;

    while ((match = pattern.exec(content)) !== null) {
      const text = match[1].trim();

      if (isTranslatable(text) && !seen.has(text)) {
        seen.add(text);

        // Calculate line number
        const lineNum = content.substring(0, match.index).split("\n").length;

        entries.push({
          key: generateTranslationKey(text),
          source: text,
          translation: "",
          file: filePath,
          line: lineNum,
        });
      }
    }
  });

  return entries;
}

/**
 * Generate a unique key for a translation
 */
function generateTranslationKey(text: string): string {
  // Create a short, readable key from the text
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 50);

  return slug || `str_${hashString(text)}`;
}

/**
 * Simple string hash for unique keys
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract all strings from a theme's files
 */
export function extractThemeStrings(files: GeneratedFile[]): TranslationEntry[] {
  const allEntries: TranslationEntry[] = [];
  const seen = new Set<string>();

  files.forEach((file) => {
    if (file.type === "xml") {
      const entries = extractStrings(file.content, file.path);
      entries.forEach((entry) => {
        if (!seen.has(entry.source)) {
          seen.add(entry.source);
          allEntries.push(entry);
        }
      });
    }
  });

  // Sort by source for consistency
  return allEntries.sort((a, b) => a.source.localeCompare(b.source));
}

// =============================================================================
// PO/POT FILE GENERATION
// =============================================================================

/**
 * Generate POT (template) file header
 */
function generatePotHeader(themeName: string): string {
  const now = new Date().toISOString().replace("T", " ").substring(0, 19) + "+0000";

  return `# Translation template for ${themeName}
# This file is distributed under the same license as the ${themeName} package.
# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR.
#
#, fuzzy
msgid ""
msgstr ""
"Project-Id-Version: ${themeName} 18.0.1.0.0\\n"
"Report-Msgid-Bugs-To: \\n"
"POT-Creation-Date: ${now}\\n"
"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\\n"
"Last-Translator: FULL NAME <EMAIL@ADDRESS>\\n"
"Language-Team: LANGUAGE <LL@li.org>\\n"
"Language: \\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
`;
}

/**
 * Generate PO file header for a specific language
 */
function generatePoHeader(themeName: string, langConfig: LanguageConfig): string {
  const now = new Date().toISOString().replace("T", " ").substring(0, 19) + "+0000";

  return `# ${langConfig.name} translation for ${themeName}
# This file is distributed under the same license as the ${themeName} package.
#
msgid ""
msgstr ""
"Project-Id-Version: ${themeName} 18.0.1.0.0\\n"
"Report-Msgid-Bugs-To: \\n"
"POT-Creation-Date: ${now}\\n"
"PO-Revision-Date: ${now}\\n"
"Last-Translator: \\n"
"Language-Team: ${langConfig.name}\\n"
"Language: ${langConfig.code}\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
`;
}

/**
 * Escape string for PO file format
 */
function escapePoString(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

/**
 * Format a translation entry for PO file
 */
function formatPoEntry(entry: TranslationEntry): string {
  const lines: string[] = [];

  // Add file reference comment
  if (entry.file) {
    const location = entry.line ? `${entry.file}:${entry.line}` : entry.file;
    lines.push(`#: ${location}`);
  }

  // Add context if present
  if (entry.context) {
    lines.push(`msgctxt "${escapePoString(entry.context)}"`);
  }

  // Source string
  lines.push(`msgid "${escapePoString(entry.source)}"`);

  // Translation (empty for POT, filled for PO)
  lines.push(`msgstr "${escapePoString(entry.translation || "")}"`);

  return lines.join("\n");
}

/**
 * Generate POT (template) file
 */
export function generatePotFile(
  themeName: string,
  entries: TranslationEntry[]
): GeneratedFile {
  const content = [
    generatePotHeader(themeName),
    "",
    ...entries.map((entry) => formatPoEntry(entry)),
    "",
  ].join("\n");

  return {
    path: `${themeName}/i18n/${themeName}.pot`,
    content,
    type: "pot",
  };
}

/**
 * Generate PO file for a specific language
 */
export function generatePoFile(
  themeName: string,
  langCode: string,
  entries: TranslationEntry[]
): GeneratedFile {
  const langConfig = SUPPORTED_LANGUAGES[langCode];

  if (!langConfig) {
    throw new Error(`Unsupported language: ${langCode}`);
  }

  const content = [
    generatePoHeader(themeName, langConfig),
    "",
    ...entries.map((entry) => formatPoEntry(entry)),
    "",
  ].join("\n");

  return {
    path: `${themeName}/i18n/${langCode}.po`,
    content,
    type: "po",
  };
}

/**
 * Generate all i18n files for a theme
 */
export function generateI18nFiles(
  themeName: string,
  files: GeneratedFile[],
  languages: string[] = ["es_ES", "fr_FR", "de_DE"]
): GeneratedFile[] {
  const entries = extractThemeStrings(files);
  const i18nFiles: GeneratedFile[] = [];

  // Generate POT template
  i18nFiles.push(generatePotFile(themeName, entries));

  // Generate PO files for each language
  languages.forEach((langCode) => {
    if (SUPPORTED_LANGUAGES[langCode]) {
      i18nFiles.push(generatePoFile(themeName, langCode, entries));
    }
  });

  return i18nFiles;
}

// =============================================================================
// TRANSLATION FILE PARSING
// =============================================================================

/**
 * Parse PO file content into TranslationFile structure
 */
export function parsePoFile(content: string, langCode: string): TranslationFile {
  const langConfig = SUPPORTED_LANGUAGES[langCode] || {
    code: langCode,
    name: langCode,
    nativeName: langCode,
    rtl: false,
    dateFormat: "YYYY-MM-DD",
    numberFormat: { decimal: ".", thousand: "," },
  };

  const entries: TranslationEntry[] = [];
  const lines = content.split("\n");

  let currentEntry: Partial<TranslationEntry> = {};
  let inMsgid = false;
  let inMsgstr = false;
  let currentFile = "";
  let currentLine: number | undefined;

  for (const line of lines) {
    // Skip empty lines and comments (except file references)
    if (line.startsWith("#:")) {
      const location = line.substring(3).trim();
      const [file, lineNum] = location.split(":");
      currentFile = file;
      currentLine = lineNum ? parseInt(lineNum, 10) : undefined;
      continue;
    }

    if (line.startsWith("#") || line.trim() === "") {
      // Save previous entry if complete
      if (currentEntry.source) {
        entries.push({
          key: generateTranslationKey(currentEntry.source),
          source: currentEntry.source,
          translation: currentEntry.translation || "",
          file: currentFile,
          line: currentLine,
        });
        currentEntry = {};
        currentFile = "";
        currentLine = undefined;
      }
      continue;
    }

    // Parse msgid
    if (line.startsWith("msgid ")) {
      inMsgid = true;
      inMsgstr = false;
      currentEntry.source = unescapePoString(line.substring(6).trim());
    } else if (line.startsWith("msgstr ")) {
      inMsgid = false;
      inMsgstr = true;
      currentEntry.translation = unescapePoString(line.substring(7).trim());
    } else if (line.startsWith('"')) {
      // Continuation line
      const text = unescapePoString(line.trim());
      if (inMsgid) {
        currentEntry.source = (currentEntry.source || "") + text;
      } else if (inMsgstr) {
        currentEntry.translation = (currentEntry.translation || "") + text;
      }
    }
  }

  // Don't forget the last entry
  if (currentEntry.source) {
    entries.push({
      key: generateTranslationKey(currentEntry.source),
      source: currentEntry.source,
      translation: currentEntry.translation || "",
      file: currentFile,
      line: currentLine,
    });
  }

  // Filter out empty msgid (header)
  const filteredEntries = entries.filter((e) => e.source.length > 0);

  return {
    language: langConfig,
    entries: filteredEntries,
    metadata: {
      creationDate: new Date().toISOString(),
      revisionDate: new Date().toISOString(),
    },
  };
}

/**
 * Unescape PO string format
 */
function unescapePoString(text: string): string {
  // Remove surrounding quotes
  let result = text;
  if (result.startsWith('"') && result.endsWith('"')) {
    result = result.slice(1, -1);
  }

  return result
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

// =============================================================================
// RTL SUPPORT
// =============================================================================

/**
 * Check if a language is RTL
 */
export function isRtlLanguage(langCode: string): boolean {
  return SUPPORTED_LANGUAGES[langCode]?.rtl || false;
}

/**
 * Get RTL languages list
 */
export function getRtlLanguages(): LanguageConfig[] {
  return Object.values(SUPPORTED_LANGUAGES).filter((lang) => lang.rtl);
}

/**
 * Generate RTL CSS overrides for a theme
 */
export function generateRtlScss(themeName: string): GeneratedFile {
  const content = `// RTL (Right-to-Left) overrides for ${themeName}
// Auto-generated for RTL language support

// Base direction
html[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

// Flip margins and paddings
html[dir="rtl"] {
  // Utility classes
  .ms-auto { margin-left: 0 !important; margin-right: auto !important; }
  .me-auto { margin-right: 0 !important; margin-left: auto !important; }
  .ps-0 { padding-left: initial !important; padding-right: 0 !important; }
  .pe-0 { padding-right: initial !important; padding-left: 0 !important; }

  // Text alignment
  .text-start { text-align: right !important; }
  .text-end { text-align: left !important; }

  // Flexbox
  .flex-row { flex-direction: row-reverse !important; }
  .justify-content-start { justify-content: flex-end !important; }
  .justify-content-end { justify-content: flex-start !important; }

  // Float
  .float-start { float: right !important; }
  .float-end { float: left !important; }

  // Border radius
  .rounded-start {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
    border-top-right-radius: var(--bs-border-radius) !important;
    border-bottom-right-radius: var(--bs-border-radius) !important;
  }
  .rounded-end {
    border-top-right-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    border-top-left-radius: var(--bs-border-radius) !important;
    border-bottom-left-radius: var(--bs-border-radius) !important;
  }

  // List markers
  ul, ol {
    padding-right: 2rem;
    padding-left: 0;
  }

  // Forms
  .form-check {
    padding-left: 0;
    padding-right: 1.5rem;

    .form-check-input {
      float: right;
      margin-left: 0;
      margin-right: -1.5rem;
    }
  }

  // Icons that need flipping
  .fa-arrow-left::before { content: "\\f061"; } // arrow-right
  .fa-arrow-right::before { content: "\\f060"; } // arrow-left
  .fa-chevron-left::before { content: "\\f054"; } // chevron-right
  .fa-chevron-right::before { content: "\\f053"; } // chevron-left
  .fa-angle-left::before { content: "\\f105"; } // angle-right
  .fa-angle-right::before { content: "\\f104"; } // angle-left
}

// Navigation
html[dir="rtl"] {
  .navbar-nav {
    flex-direction: row-reverse;
  }

  .dropdown-menu {
    text-align: right;

    &.dropdown-menu-end {
      right: auto;
      left: 0;
    }
  }

  .breadcrumb-item + .breadcrumb-item::before {
    content: "\\\\";
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}

// Carousel
html[dir="rtl"] {
  .carousel-control-prev {
    right: 0;
    left: auto;
  }
  .carousel-control-next {
    left: 0;
    right: auto;
  }
  .carousel-indicators {
    flex-direction: row-reverse;
  }
}
`;

  return {
    path: `${themeName}/static/src/scss/rtl.scss`,
    content,
    type: "scss",
  };
}

// =============================================================================
// TRANSLATION HELPERS
// =============================================================================

/**
 * Get language display name
 */
export function getLanguageName(langCode: string, native: boolean = false): string {
  const lang = SUPPORTED_LANGUAGES[langCode];
  if (!lang) return langCode;
  return native ? lang.nativeName : lang.name;
}

/**
 * Get language list for dropdown
 */
export function getLanguageOptions(): Array<{ value: string; label: string; native: string }> {
  return Object.values(SUPPORTED_LANGUAGES).map((lang) => ({
    value: lang.code,
    label: lang.name,
    native: lang.nativeName,
  }));
}

/**
 * Format number according to language
 */
export function formatNumber(num: number, langCode: string): string {
  const lang = SUPPORTED_LANGUAGES[langCode] || SUPPORTED_LANGUAGES.en_US;
  const parts = num.toFixed(2).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, lang.numberFormat.thousand);
  const decPart = parts[1];
  return `${intPart}${lang.numberFormat.decimal}${decPart}`;
}

/**
 * Get translation statistics
 */
export function getTranslationStats(translationFile: TranslationFile): {
  total: number;
  translated: number;
  untranslated: number;
  percentComplete: number;
} {
  const total = translationFile.entries.length;
  const translated = translationFile.entries.filter((e) => e.translation.length > 0).length;
  const untranslated = total - translated;
  const percentComplete = total > 0 ? Math.round((translated / total) * 100) : 0;

  return {
    total,
    translated,
    untranslated,
    percentComplete,
  };
}

/**
 * Merge translations from an existing PO file
 */
export function mergeTranslations(
  baseEntries: TranslationEntry[],
  existingTranslations: TranslationEntry[]
): TranslationEntry[] {
  const translationMap = new Map<string, string>();

  existingTranslations.forEach((entry) => {
    if (entry.translation) {
      translationMap.set(entry.source, entry.translation);
    }
  });

  return baseEntries.map((entry) => ({
    ...entry,
    translation: translationMap.get(entry.source) || entry.translation || "",
  }));
}

// =============================================================================
// COMPATIBILITY ALIASES
// =============================================================================

/**
 * Extract strings from QWeb template (alias for extractStrings)
 */
export function extractStringsFromQWeb(template: string): string[] {
  const entries = extractStrings(template, "template.xml");
  return entries.map((e) => e.source);
}

/**
 * Generate PO file (uppercase alias for generatePoFile)
 */
export function generatePOFile(
  langCode: string,
  themeName: string,
  translations: Map<string, string>
): string {
  const entries: TranslationEntry[] = [];
  translations.forEach((translation, source) => {
    entries.push({
      key: source.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_").substring(0, 50),
      source,
      translation,
    });
  });

  const file = generatePoFile(themeName, langCode, entries);
  return file.content;
}

/**
 * Parse PO file (uppercase alias for parsePoFile)
 */
export function parsePOFile(content: string): Map<string, string> {
  const result = parsePoFile(content, "unknown");
  const map = new Map<string, string>();
  result.entries.forEach((entry) => {
    if (entry.translation) {
      map.set(entry.source, entry.translation);
    }
  });
  return map;
}

// =============================================================================
// I18N MANAGER CLASS
// =============================================================================

/**
 * I18nManager class for managing theme translations
 */
export class I18nManager {
  private themeName: string;
  private translations: Map<string, Map<string, string>> = new Map();

  constructor(themeName: string) {
    this.themeName = themeName;
  }

  /**
   * Add a translation
   */
  addTranslation(langCode: string, source: string, translation: string): void {
    if (!this.translations.has(langCode)) {
      this.translations.set(langCode, new Map());
    }
    this.translations.get(langCode)!.set(source, translation);
  }

  /**
   * Get a translation
   */
  getTranslation(langCode: string, source: string): string {
    const langTranslations = this.translations.get(langCode);
    if (!langTranslations) {
      return source;
    }
    return langTranslations.get(source) || source;
  }

  /**
   * Get translation statistics
   */
  getStats(): {
    languages: string[];
    totalStrings: number;
    translatedByLanguage: Record<string, number>;
  } {
    const languages = Array.from(this.translations.keys());
    const allSources = new Set<string>();

    this.translations.forEach((langMap) => {
      langMap.forEach((_, source) => {
        allSources.add(source);
      });
    });

    const translatedByLanguage: Record<string, number> = {};
    languages.forEach((lang) => {
      translatedByLanguage[lang] = this.translations.get(lang)?.size || 0;
    });

    return {
      languages,
      totalStrings: allSources.size,
      translatedByLanguage,
    };
  }

  /**
   * Export PO files for all languages
   */
  exportPOFiles(): Array<{ language: string; content: string }> {
    const files: Array<{ language: string; content: string }> = [];

    this.translations.forEach((langMap, langCode) => {
      const entries: TranslationEntry[] = [];
      langMap.forEach((translation, source) => {
        entries.push({
          key: source.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "_").substring(0, 50),
          source,
          translation,
        });
      });

      const file = generatePoFile(this.themeName, langCode, entries);
      files.push({
        language: langCode,
        content: file.content,
      });
    });

    return files;
  }

  /**
   * Import translations from PO file content
   */
  importPOFile(langCode: string, content: string): void {
    const parsed = parsePoFile(content, langCode);
    parsed.entries.forEach((entry) => {
      if (entry.translation) {
        this.addTranslation(langCode, entry.source, entry.translation);
      }
    });
  }
}

/**
 * Languages Template Generator
 *
 * Generates language configuration for Monaco Editor with file extension mapping.
 */

/**
 * Options for languages template generation.
 */
export interface LanguagesTemplateOptions {
  /** Whether to use TypeScript */
  useTypeScript: boolean;
  /** Languages to include */
  languages: string[];
}

/**
 * Language configuration data.
 */
interface LanguageData {
  id: string;
  extensions: string[];
  aliases: string[];
  mimeTypes: string[];
}

/**
 * Full language configuration database.
 */
const LANGUAGE_DATABASE: Record<string, LanguageData> = {
  javascript: {
    id: 'javascript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    aliases: ['JavaScript', 'js'],
    mimeTypes: ['text/javascript'],
  },
  typescript: {
    id: 'typescript',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    aliases: ['TypeScript', 'ts'],
    mimeTypes: ['text/typescript'],
  },
  json: {
    id: 'json',
    extensions: ['.json', '.jsonc'],
    aliases: ['JSON'],
    mimeTypes: ['application/json'],
  },
  html: {
    id: 'html',
    extensions: ['.html', '.htm'],
    aliases: ['HTML'],
    mimeTypes: ['text/html'],
  },
  css: {
    id: 'css',
    extensions: ['.css'],
    aliases: ['CSS'],
    mimeTypes: ['text/css'],
  },
  markdown: {
    id: 'markdown',
    extensions: ['.md', '.markdown'],
    aliases: ['Markdown', 'md'],
    mimeTypes: ['text/markdown'],
  },
  python: {
    id: 'python',
    extensions: ['.py', '.pyw'],
    aliases: ['Python', 'py'],
    mimeTypes: ['text/x-python'],
  },
  xml: {
    id: 'xml',
    extensions: ['.xml', '.xsl', '.svg'],
    aliases: ['XML'],
    mimeTypes: ['text/xml'],
  },
  yaml: {
    id: 'yaml',
    extensions: ['.yaml', '.yml'],
    aliases: ['YAML', 'yml'],
    mimeTypes: ['text/yaml'],
  },
  shell: {
    id: 'shell',
    extensions: ['.sh', '.bash', '.zsh'],
    aliases: ['Shell', 'bash'],
    mimeTypes: ['text/x-sh'],
  },
};

/**
 * Default languages to include.
 */
const DEFAULT_LANGUAGES = [
  'javascript',
  'typescript',
  'json',
  'html',
  'css',
  'markdown',
  'python',
  'xml',
  'yaml',
  'shell',
];

/**
 * Default options for languages template.
 */
const DEFAULT_OPTIONS: LanguagesTemplateOptions = {
  useTypeScript: true,
  languages: DEFAULT_LANGUAGES,
};

/**
 * Generates languages configuration file.
 *
 * @param options - Template options
 * @returns Complete languages file content
 */
export function generateLanguagesTemplate(
  options: Partial<LanguagesTemplateOptions> = {}
): string {
  const mergedOptions: LanguagesTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const selectedLanguages = mergedOptions.languages
    .filter((lang) => lang in LANGUAGE_DATABASE)
    .map((lang) => LANGUAGE_DATABASE[lang]);

  // Build extension map
  const extensionMap: Record<string, string> = {};
  for (const lang of selectedLanguages) {
    for (const ext of lang.extensions) {
      extensionMap[ext] = lang.id;
    }
  }

  const typeAnnotation = mergedOptions.useTypeScript ? ': string' : '';
  const returnType = mergedOptions.useTypeScript ? ': string' : '';
  const boolReturn = mergedOptions.useTypeScript ? ': boolean' : '';
  const arrayReturn = mergedOptions.useTypeScript ? ': string[]' : '';

  let content = `/**
 * Monaco Editor Language Configuration
 *
 * Maps file extensions to Monaco language identifiers.
 */

`;

  if (mergedOptions.useTypeScript) {
    content += `/**
 * Language configuration interface.
 */
export interface LanguageConfig {
  id: string;
  extensions: string[];
  aliases: string[];
  mimeTypes: string[];
}

`;
  }

  content += `/**
 * Supported language configurations.
 */
export const languageConfigs${mergedOptions.useTypeScript ? ': LanguageConfig[]' : ''} = ${JSON.stringify(selectedLanguages, null, 2)};

/**
 * Extension to language ID mapping.
 */
export const extensionToLanguage${mergedOptions.useTypeScript ? ': Record<string, string>' : ''} = ${JSON.stringify(extensionMap, null, 2)};

/**
 * Get the Monaco language ID for a file path or extension.
 *
 * @param filePathOrExtension - File path or extension
 * @returns Monaco language ID or 'plaintext' if not found
 */
export function getLanguageForFile(filePathOrExtension${typeAnnotation})${returnType} {
  let ext = filePathOrExtension;

  // Extract extension from path
  if (ext.includes('/') || ext.includes('\\\\')) {
    const parts = ext.split(/[\\\\/]/);
    const filename = parts[parts.length - 1];
    const dotIndex = filename.lastIndexOf('.');
    ext = dotIndex >= 0 ? filename.slice(dotIndex) : '';
  }

  // Normalize extension
  if (ext.length > 0 && !ext.startsWith('.')) {
    ext = '.' + ext;
  }
  ext = ext.toLowerCase();

  return extensionToLanguage[ext] ?? 'plaintext';
}

/**
 * Get all supported extensions.
 */
export function getSupportedExtensions()${arrayReturn} {
  return Object.keys(extensionToLanguage);
}

/**
 * Check if a file extension is supported.
 */
export function isExtensionSupported(extension${typeAnnotation})${boolReturn} {
  let ext = extension.toLowerCase();
  if (ext.length > 0 && !ext.startsWith('.')) {
    ext = '.' + ext;
  }
  return ext in extensionToLanguage;
}

export default { languageConfigs, extensionToLanguage, getLanguageForFile };
`;

  return content;
}

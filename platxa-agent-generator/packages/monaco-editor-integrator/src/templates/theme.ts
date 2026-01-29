/**
 * Theme Template Generator
 *
 * Generates Monaco Editor theme definitions for dark and light modes.
 */

/**
 * Options for theme template generation.
 */
export interface ThemeTemplateOptions {
  /** Whether to use TypeScript */
  useTypeScript: boolean;
  /** Include dark theme */
  includeDarkTheme: boolean;
  /** Include light theme */
  includeLightTheme: boolean;
  /** Custom theme name prefix */
  themePrefix: string;
}

/**
 * Default options for theme template.
 */
const DEFAULT_OPTIONS: ThemeTemplateOptions = {
  useTypeScript: true,
  includeDarkTheme: true,
  includeLightTheme: true,
  themePrefix: 'custom',
};

/**
 * Generates theme configuration file.
 *
 * @param options - Template options
 * @returns Complete theme file content
 */
export function generateThemeTemplate(
  options: Partial<ThemeTemplateOptions> = {}
): string {
  const mergedOptions: ThemeTemplateOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const typeAnnotation = mergedOptions.useTypeScript
    ? `: import('monaco-editor').editor.IStandaloneThemeData`
    : '';

  const darkTheme = generateDarkTheme(mergedOptions.themePrefix, typeAnnotation);
  const lightTheme = generateLightTheme(mergedOptions.themePrefix, typeAnnotation);

  let content = `/**
 * Monaco Editor Theme Definitions
 *
 * Custom themes optimized for code readability and reduced eye strain.
 */

`;

  if (mergedOptions.useTypeScript) {
    content += `import type * as Monaco from 'monaco-editor';

/**
 * Register custom themes with Monaco Editor.
 *
 * @param monaco - Monaco editor instance
 */
export function registerThemes(monaco: typeof Monaco): void {
`;
  } else {
    content += `/**
 * Register custom themes with Monaco Editor.
 *
 * @param monaco - Monaco editor instance
 */
export function registerThemes(monaco) {
`;
  }

  if (mergedOptions.includeDarkTheme) {
    content += `  monaco.editor.defineTheme('${mergedOptions.themePrefix}-dark', ${mergedOptions.themePrefix}DarkTheme);
`;
  }

  if (mergedOptions.includeLightTheme) {
    content += `  monaco.editor.defineTheme('${mergedOptions.themePrefix}-light', ${mergedOptions.themePrefix}LightTheme);
`;
  }

  content += `}

`;

  if (mergedOptions.includeDarkTheme) {
    content += darkTheme;
  }

  if (mergedOptions.includeLightTheme) {
    content += lightTheme;
  }

  const exports: string[] = [];
  if (mergedOptions.includeDarkTheme) {
    exports.push(`${mergedOptions.themePrefix}DarkTheme`);
  }
  if (mergedOptions.includeLightTheme) {
    exports.push(`${mergedOptions.themePrefix}LightTheme`);
  }

  content += `export default { ${exports.join(', ')} };
`;

  return content;
}

/**
 * Generates dark theme definition.
 */
function generateDarkTheme(prefix: string, typeAnnotation: string): string {
  return `/**
 * Dark theme definition.
 * Based on VS Code Dark+ with enhanced contrast.
 */
export const ${prefix}DarkTheme${typeAnnotation} = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'C586C0' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'constant', foreground: '4FC1FF' },
    { token: 'tag', foreground: '569CD6' },
    { token: 'operator', foreground: 'D4D4D4' },
  ],
  colors: {
    'editor.background': '#1E1E1E',
    'editor.foreground': '#D4D4D4',
    'editor.lineHighlightBackground': '#2A2D2E',
    'editor.selectionBackground': '#264F78',
    'editorCursor.foreground': '#AEAFAD',
    'editorLineNumber.foreground': '#858585',
    'editorBracketMatch.background': '#0D3A58',
  },
};

`;
}

/**
 * Generates light theme definition.
 */
function generateLightTheme(prefix: string, typeAnnotation: string): string {
  return `/**
 * Light theme definition.
 * Based on VS Code Light+ with enhanced readability.
 */
export const ${prefix}LightTheme${typeAnnotation} = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '008000', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'AF00DB' },
    { token: 'string', foreground: 'A31515' },
    { token: 'number', foreground: '098658' },
    { token: 'type', foreground: '267F99' },
    { token: 'function', foreground: '795E26' },
    { token: 'variable', foreground: '001080' },
    { token: 'constant', foreground: '0000FF' },
    { token: 'tag', foreground: '800000' },
    { token: 'operator', foreground: '000000' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#000000',
    'editor.lineHighlightBackground': '#F3F3F3',
    'editor.selectionBackground': '#ADD6FF',
    'editorCursor.foreground': '#000000',
    'editorLineNumber.foreground': '#237893',
    'editorBracketMatch.background': '#D5EBF9',
  },
};

`;
}

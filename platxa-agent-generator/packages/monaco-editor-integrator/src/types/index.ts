/**
 * Monaco Editor Integrator - Type Definitions
 *
 * Core TypeScript types for project detection, configuration generation,
 * and Monaco + Yjs integration.
 */

// =============================================================================
// Project Detection Types
// =============================================================================

/**
 * Supported package managers for dependency installation.
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

/**
 * Supported build tools and frameworks.
 */
export type BuildTool = 'nextjs' | 'vite' | 'cra' | 'webpack' | 'unknown';

/**
 * Project type classification based on framework and configuration.
 */
export type ProjectType = 'react' | 'nextjs' | 'vite-react' | 'cra' | 'unknown';

/**
 * Result of project analysis for Monaco integration.
 */
export interface ProjectAnalysis {
  /** Detected project type */
  projectType: ProjectType;
  /** Detected package manager */
  packageManager: PackageManager;
  /** Detected build tool */
  buildTool: BuildTool;
  /** React version if detected (e.g., "18.3.1") */
  reactVersion: string | null;
  /** TypeScript version if detected */
  typescriptVersion: string | null;
  /** Whether the project uses TypeScript */
  hasTypeScript: boolean;
  /** Root directory of the project */
  rootDir: string;
  /** Path to package.json */
  packageJsonPath: string;
  /** Existing Monaco-related dependencies */
  existingDeps: ExistingDependencies;
}

/**
 * Existing Monaco/Yjs dependencies found in the project.
 */
export interface ExistingDependencies {
  /** Monaco Editor version if installed */
  monacoEditor: string | null;
  /** @monaco-editor/react version if installed */
  monacoReact: string | null;
  /** yjs version if installed */
  yjs: string | null;
  /** y-monaco version if installed */
  yMonaco: string | null;
  /** y-websocket version if installed */
  yWebsocket: string | null;
  /** y-indexeddb version if installed */
  yIndexeddb: string | null;
}

/**
 * Lockfile detection result.
 */
export interface LockfileInfo {
  /** Type of lockfile found */
  type: PackageManager;
  /** Path to the lockfile */
  path: string;
  /** Whether the lockfile exists */
  exists: boolean;
}

// =============================================================================
// Monaco Configuration Types
// =============================================================================

/**
 * Monaco Editor configuration options.
 * Subset of monaco.editor.IStandaloneEditorConstructionOptions.
 */
export interface EditorOptions {
  /** Enable automatic layout adjustment */
  automaticLayout: boolean;
  /** Allow scrolling beyond the last line */
  scrollBeyondLastLine: boolean;
  /** Word wrap mode */
  wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  /** Font size in pixels */
  fontSize: number;
  /** Font family */
  fontFamily: string;
  /** Enable font ligatures */
  fontLigatures: boolean;
  /** Line height multiplier */
  lineHeight: number;
  /** Minimap configuration */
  minimap: MinimapOptions;
  /** Cursor style */
  cursorStyle: 'line' | 'block' | 'underline' | 'line-thin' | 'block-outline' | 'underline-thin';
  /** Cursor blinking animation */
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  /** Enable bracket pair colorization */
  bracketPairColorization: { enabled: boolean };
  /** Accessibility support mode */
  accessibilitySupport: 'auto' | 'off' | 'on';
  /** ARIA label for the editor */
  ariaLabel: string;
  /** Read-only mode */
  readOnly?: boolean;
}

/**
 * Monaco minimap configuration.
 */
export interface MinimapOptions {
  /** Enable minimap */
  enabled: boolean;
  /** Maximum column width */
  maxColumn?: number;
  /** Render actual characters */
  renderCharacters: boolean;
  /** Scale factor */
  scale?: number;
}

/**
 * Monaco theme configuration.
 */
export interface ThemeConfig {
  /** Theme name */
  name: string;
  /** Base theme to inherit from */
  base: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';
  /** Whether to inherit from base theme */
  inherit: boolean;
  /** Token colorization rules */
  rules: ThemeRule[];
  /** Editor colors */
  colors: Record<string, string>;
}

/**
 * Monaco theme tokenization rule.
 */
export interface ThemeRule {
  /** Token type to match */
  token: string;
  /** Foreground color (hex without #) */
  foreground?: string;
  /** Background color (hex without #) */
  background?: string;
  /** Font style */
  fontStyle?: 'italic' | 'bold' | 'underline' | 'strikethrough';
}

/**
 * Language configuration for file extension mapping.
 */
export interface LanguageConfig {
  /** Language identifier for Monaco */
  languageId: string;
  /** File extensions (with dot) */
  extensions: string[];
  /** MIME type */
  mimeType: string;
  /** Optional aliases */
  aliases?: string[];
}

// =============================================================================
// Yjs Integration Types
// =============================================================================

/**
 * Yjs WebSocket provider configuration.
 */
export interface YjsProviderConfig {
  /** WebSocket server URL */
  websocketUrl: string;
  /** Room name for collaboration */
  roomName: string;
  /** Authentication token (optional) */
  token?: string;
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Enable awareness protocol */
  enableAwareness?: boolean;
}

/**
 * Monaco binding options for Yjs.
 */
export interface MonacoBindingOptions {
  /** Yjs text instance to bind */
  yText: unknown; // Y.Text
  /** Monaco editor model */
  model: unknown; // monaco.editor.ITextModel
  /** Set of Monaco editors to bind */
  editors: Set<unknown>; // Set<monaco.editor.IStandaloneCodeEditor>
  /** Awareness instance for cursor sync */
  awareness?: unknown; // Awareness
}

/**
 * User awareness state for collaborative editing.
 */
export interface AwarenessState {
  /** User identifier */
  id: string;
  /** Display name */
  name: string;
  /** User color (hex) */
  color: string;
  /** Light variant of color for selections */
  colorLight: string;
  /** Current cursor position */
  cursor?: CursorPosition;
  /** Current selection range */
  selection?: SelectionRange;
}

/**
 * Cursor position in the editor.
 */
export interface CursorPosition {
  /** Line number (1-based) */
  lineNumber: number;
  /** Column number (1-based) */
  column: number;
}

/**
 * Selection range in the editor.
 */
export interface SelectionRange {
  /** Start position */
  start: CursorPosition;
  /** End position */
  end: CursorPosition;
}

/**
 * Connection state for WebSocket provider.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * WebSocket connection event.
 */
export interface ConnectionEvent {
  /** Current connection state */
  state: ConnectionState;
  /** Error if connection failed */
  error?: Error;
  /** Number of reconnection attempts */
  reconnectAttempts?: number;
}

// =============================================================================
// Agent Output Types
// =============================================================================

/**
 * Result of agent validation check.
 */
export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error detail.
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** File path if applicable */
  file?: string;
  /** Line number if applicable */
  line?: number;
}

/**
 * Validation warning detail.
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Generated file from the agent.
 */
export interface GeneratedFile {
  /** Relative file path */
  path: string;
  /** File content */
  content: string;
  /** File type */
  type: 'component' | 'hook' | 'config' | 'types' | 'util';
  /** Whether this overwrites an existing file */
  overwrites: boolean;
}

/**
 * Integration report produced by the agent.
 */
export interface IntegrationReport {
  /** Report status */
  status: 'success' | 'failure' | 'partial';
  /** Project analysis results */
  projectAnalysis: ProjectAnalysis;
  /** Files created or modified */
  filesCreated: GeneratedFile[];
  /** Files that were modified (not created) */
  filesModified: string[];
  /** Validation results */
  validation: ValidationResult;
  /** Installation command to run */
  installCommand: string;
  /** Next steps for the user */
  nextSteps: string[];
  /** Error details if failed */
  error?: IntegrationError;
}

/**
 * Integration error detail.
 */
export interface IntegrationError {
  /** Error code */
  code: IntegrationErrorCode;
  /** Error message */
  message: string;
  /** Detailed error information */
  details?: string;
  /** Suggested resolution */
  resolution?: string;
}

/**
 * Integration error codes.
 */
export type IntegrationErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'PACKAGE_JSON_NOT_FOUND'
  | 'UNSUPPORTED_PROJECT_TYPE'
  | 'REACT_VERSION_INCOMPATIBLE'
  | 'EXISTING_MONACO_CONFLICT'
  | 'CONFIG_GENERATION_FAILED'
  | 'TEMPLATE_GENERATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'UNKNOWN_ERROR';

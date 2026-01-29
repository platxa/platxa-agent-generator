/**
 * VS Code Integration
 *
 * Provides integration layer for VS Code extension development.
 * Includes diagnostic providers, code actions, hover information,
 * and real-time debugging session management.
 *
 * @module vscode-integration
 */

import type {
  NormalizedError,
  RootCauseHypothesis,
  FixSuggestion,
  SourceLocation,
  Language,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * VS Code diagnostic severity mapping
 */
export type VSCodeSeverity = 'Error' | 'Warning' | 'Information' | 'Hint';

/**
 * VS Code position (0-based)
 */
export interface VSCodePosition {
  /** Line number (0-based) */
  line: number;
  /** Character offset (0-based) */
  character: number;
}

/**
 * VS Code range
 */
export interface VSCodeRange {
  /** Start position */
  start: VSCodePosition;
  /** End position */
  end: VSCodePosition;
}

/**
 * VS Code diagnostic
 */
export interface VSCodeDiagnostic {
  /** Range of the diagnostic */
  range: VSCodeRange;
  /** Diagnostic message */
  message: string;
  /** Severity level */
  severity: VSCodeSeverity;
  /** Source of the diagnostic */
  source: string;
  /** Diagnostic code */
  code?: string | number;
  /** Related information */
  relatedInformation?: Array<{
    location: {
      uri: string;
      range: VSCodeRange;
    };
    message: string;
  }>;
  /** Tags (deprecated, unnecessary) */
  tags?: Array<'Unnecessary' | 'Deprecated'>;
}

/**
 * VS Code code action
 */
export interface VSCodeCodeAction {
  /** Action title */
  title: string;
  /** Kind of action */
  kind: 'quickfix' | 'refactor' | 'source';
  /** Diagnostic this action fixes */
  diagnostics?: VSCodeDiagnostic[];
  /** Is preferred action */
  isPreferred?: boolean;
  /** Edit to apply */
  edit?: VSCodeWorkspaceEdit;
  /** Command to execute */
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
}

/**
 * VS Code workspace edit
 */
export interface VSCodeWorkspaceEdit {
  /** Changes by URI */
  changes: Map<string, VSCodeTextEdit[]>;
}

/**
 * VS Code text edit
 */
export interface VSCodeTextEdit {
  /** Range to replace */
  range: VSCodeRange;
  /** New text */
  newText: string;
}

/**
 * VS Code hover content
 */
export interface VSCodeHover {
  /** Hover contents (markdown supported) */
  contents: string[];
  /** Range to highlight */
  range?: VSCodeRange;
}

/**
 * VS Code document link
 */
export interface VSCodeDocumentLink {
  /** Range of the link */
  range: VSCodeRange;
  /** Target URI */
  target: string;
  /** Tooltip */
  tooltip?: string;
}

/**
 * Debug session status
 */
export type DebugSessionStatus =
  | 'idle'
  | 'analyzing'
  | 'hypothesis'
  | 'fixing'
  | 'validating'
  | 'complete'
  | 'error';

/**
 * Real-time debug session
 */
export interface RealTimeDebugSession {
  /** Session ID */
  id: string;
  /** Session status */
  status: DebugSessionStatus;
  /** Current file being analyzed */
  currentFile?: string;
  /** Detected language */
  language?: Language;
  /** Active diagnostics */
  diagnostics: Map<string, VSCodeDiagnostic[]>;
  /** Available code actions */
  codeActions: Map<string, VSCodeCodeAction[]>;
  /** Current hypotheses */
  hypotheses: RootCauseHypothesis[];
  /** Suggested fixes */
  fixes: FixSuggestion[];
  /** Session start time */
  startedAt: Date;
  /** Last update time */
  updatedAt: Date;
  /** Progress percentage (0-100) */
  progress: number;
  /** Progress message */
  progressMessage?: string;
}

/**
 * Extension message types
 */
export type ExtensionMessageType =
  | 'analyze'
  | 'fix'
  | 'hover'
  | 'codeAction'
  | 'diagnostic'
  | 'progress'
  | 'cancel'
  | 'config';

/**
 * Message from extension to agent
 */
export interface ExtensionMessage {
  /** Message type */
  type: ExtensionMessageType;
  /** Message ID for correlation */
  id: string;
  /** Payload */
  payload: unknown;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Response from agent to extension
 */
export interface AgentResponse {
  /** Original message ID */
  messageId: string;
  /** Success flag */
  success: boolean;
  /** Response data */
  data?: unknown;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * File analysis request
 */
export interface AnalyzeRequest {
  /** File URI */
  uri: string;
  /** File content */
  content: string;
  /** Language ID */
  languageId: string;
  /** Analysis options */
  options?: {
    /** Include hypotheses */
    includeHypotheses?: boolean;
    /** Include fixes */
    includeFixes?: boolean;
    /** Maximum diagnostics */
    maxDiagnostics?: number;
  };
}

/**
 * File analysis response
 */
export interface AnalyzeResponse {
  /** File URI */
  uri: string;
  /** Diagnostics */
  diagnostics: VSCodeDiagnostic[];
  /** Hypotheses if requested */
  hypotheses?: RootCauseHypothesis[];
  /** Fixes if requested */
  fixes?: FixSuggestion[];
  /** Analysis duration (ms) */
  durationMs: number;
}

/**
 * VS Code integration configuration
 */
export interface VSCodeIntegrationConfig {
  /** Source name for diagnostics */
  sourceName: string;
  /** Maximum diagnostics per file */
  maxDiagnosticsPerFile: number;
  /** Enable code actions */
  enableCodeActions: boolean;
  /** Enable hover information */
  enableHover: boolean;
  /** Enable document links (stack traces) */
  enableDocumentLinks: boolean;
  /** Debounce delay for analysis (ms) */
  debounceDelayMs: number;
  /** Auto-fix on save */
  autoFixOnSave: boolean;
  /** Severity threshold */
  severityThreshold: VSCodeSeverity;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: VSCodeIntegrationConfig = {
  sourceName: 'Platxa Debug',
  maxDiagnosticsPerFile: 100,
  enableCodeActions: true,
  enableHover: true,
  enableDocumentLinks: true,
  debounceDelayMs: 500,
  autoFixOnSave: false,
  severityThreshold: 'Hint',
};

// =============================================================================
// Severity Mapping
// =============================================================================

const SEVERITY_ORDER: Record<VSCodeSeverity, number> = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

// =============================================================================
// VS Code Integration Class
// =============================================================================

/**
 * VS Code Integration
 *
 * Provides the integration layer between the debug agent and VS Code extension.
 */
export class VSCodeIntegration {
  private config: VSCodeIntegrationConfig;
  private sessions: Map<string, RealTimeDebugSession>;
  private messageHandlers: Map<ExtensionMessageType, (msg: ExtensionMessage) => Promise<AgentResponse>>;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>>;
  private onDiagnosticsUpdated?: (uri: string, diagnostics: VSCodeDiagnostic[]) => void;
  private onProgressUpdated?: (session: RealTimeDebugSession) => void;

  constructor(config: Partial<VSCodeIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessions = new Map();
    this.messageHandlers = new Map();
    this.debounceTimers = new Map();
    this.setupMessageHandlers();
  }

  /**
   * Set diagnostics update callback
   */
  onDiagnostics(callback: (uri: string, diagnostics: VSCodeDiagnostic[]) => void): void {
    this.onDiagnosticsUpdated = callback;
  }

  /**
   * Set progress update callback
   */
  onProgress(callback: (session: RealTimeDebugSession) => void): void {
    this.onProgressUpdated = callback;
  }

  /**
   * Handle message from extension
   */
  async handleMessage(message: ExtensionMessage): Promise<AgentResponse> {
    const handler = this.messageHandlers.get(message.type);

    if (!handler) {
      return {
        messageId: message.id,
        success: false,
        error: `Unknown message type: ${message.type}`,
        timestamp: new Date(),
      };
    }

    try {
      return await handler(message);
    } catch (error) {
      return {
        messageId: message.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Convert normalized errors to VS Code diagnostics
   */
  convertToDiagnostics(errors: NormalizedError[]): VSCodeDiagnostic[] {
    const diagnostics: VSCodeDiagnostic[] = [];
    const threshold = SEVERITY_ORDER[this.config.severityThreshold];

    for (const error of errors) {
      const severity = this.mapSeverity(error.severity);

      if (SEVERITY_ORDER[severity] > threshold) {
        continue;
      }

      const diagnostic = this.createDiagnostic(error, severity);
      diagnostics.push(diagnostic);

      if (diagnostics.length >= this.config.maxDiagnosticsPerFile) {
        break;
      }
    }

    return diagnostics;
  }

  /**
   * Generate code actions for a diagnostic
   */
  generateCodeActions(
    diagnostic: VSCodeDiagnostic,
    fixes: FixSuggestion[]
  ): VSCodeCodeAction[] {
    if (!this.config.enableCodeActions) {
      return [];
    }

    const actions: VSCodeCodeAction[] = [];

    for (const fix of fixes) {
      if (!fix.changes || fix.changes.length === 0) {
        continue;
      }

      const edit = this.createWorkspaceEdit(fix);

      const action: VSCodeCodeAction = {
        title: fix.description,
        kind: 'quickfix',
        diagnostics: [diagnostic],
        edit,
      };

      // Mark first high-confidence fix as preferred
      if (actions.length === 0 && fix.confidence >= 0.8) {
        action.isPreferred = true;
      }

      actions.push(action);
    }

    return actions;
  }

  /**
   * Generate hover content for an error
   */
  generateHover(
    error: NormalizedError,
    hypothesis?: RootCauseHypothesis
  ): VSCodeHover | null {
    if (!this.config.enableHover) {
      return null;
    }

    const contents: string[] = [];

    // Error information
    contents.push(`**${error.type}**`);
    contents.push(error.message);

    // Hypothesis if available
    if (hypothesis) {
      contents.push('---');
      contents.push(`**Root Cause Analysis** (${Math.round(hypothesis.confidence * 100)}% confidence)`);
      contents.push(hypothesis.description);

      if (hypothesis.evidence.length > 0) {
        contents.push('');
        contents.push('**Evidence:**');
        for (const evidence of hypothesis.evidence.slice(0, 3)) {
          contents.push(`- ${evidence.description}`);
        }
      }
    }

    const result: VSCodeHover = { contents };
    if (error.location) {
      result.range = this.createRange(error.location);
    }

    return result;
  }

  /**
   * Generate document links from stack traces
   */
  generateDocumentLinks(stackTrace: string): VSCodeDocumentLink[] {
    if (!this.config.enableDocumentLinks) {
      return [];
    }

    const links: VSCodeDocumentLink[] = [];
    const lines = stackTrace.split('\n');

    // Common stack trace patterns
    const patterns = [
      // Python: File "path", line N
      /File "([^"]+)", line (\d+)/,
      // JavaScript/TypeScript: at path:line:col
      /at\s+(?:.*?\s+\()?([^:()]+):(\d+)(?::(\d+))?\)?/,
      // Generic: path:line:col
      /^([^\s:]+):(\d+)(?::(\d+))?/,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      for (const pattern of patterns) {
        const match = pattern.exec(line);
        if (match && match[1] && match[2]) {
          const filePath = match[1];
          const lineNum = parseInt(match[2], 10);

          // Create range for the match
          const startIdx = line.indexOf(match[0]);
          const range: VSCodeRange = {
            start: { line: i, character: startIdx },
            end: { line: i, character: startIdx + match[0].length },
          };

          links.push({
            range,
            target: `file://${filePath}#${lineNum}`,
            tooltip: `Go to ${filePath}:${lineNum}`,
          });

          break;
        }
      }
    }

    return links;
  }

  /**
   * Create or get debug session
   */
  getOrCreateSession(uri: string): RealTimeDebugSession {
    let session = this.sessions.get(uri);

    if (!session) {
      session = {
        id: `vscode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'idle',
        currentFile: uri,
        diagnostics: new Map(),
        codeActions: new Map(),
        hypotheses: [],
        fixes: [],
        startedAt: new Date(),
        updatedAt: new Date(),
        progress: 0,
      };
      this.sessions.set(uri, session);
    }

    return session;
  }

  /**
   * Update session status
   */
  updateSessionStatus(
    uri: string,
    status: DebugSessionStatus,
    progress?: number,
    message?: string
  ): void {
    const session = this.sessions.get(uri);
    if (!session) {
      return;
    }

    session.status = status;
    session.updatedAt = new Date();

    if (progress !== undefined) {
      session.progress = progress;
    }

    if (message !== undefined) {
      session.progressMessage = message;
    }

    this.onProgressUpdated?.(session);
  }

  /**
   * Update session diagnostics
   */
  updateSessionDiagnostics(
    uri: string,
    diagnostics: VSCodeDiagnostic[]
  ): void {
    const session = this.sessions.get(uri);
    if (!session) {
      return;
    }

    session.diagnostics.set(uri, diagnostics);
    session.updatedAt = new Date();

    this.onDiagnosticsUpdated?.(uri, diagnostics);
  }

  /**
   * Clear session
   */
  clearSession(uri: string): void {
    const session = this.sessions.get(uri);
    if (session) {
      session.diagnostics.clear();
      session.codeActions.clear();
      session.hypotheses = [];
      session.fixes = [];
      session.status = 'idle';
      session.progress = 0;
      session.updatedAt = new Date();
    }
    this.sessions.delete(uri);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): RealTimeDebugSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status !== 'idle' && s.status !== 'complete'
    );
  }

  /**
   * Schedule debounced analysis
   */
  scheduleAnalysis(
    uri: string,
    content: string,
    languageId: string,
    analyzer: (request: AnalyzeRequest) => Promise<AnalyzeResponse>
  ): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(uri);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new analysis
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(uri);

      const session = this.getOrCreateSession(uri);
      session.status = 'analyzing';
      session.progress = 0;
      this.onProgressUpdated?.(session);

      try {
        const response = await analyzer({
          uri,
          content,
          languageId,
          options: {
            includeHypotheses: true,
            includeFixes: true,
          },
        });

        session.diagnostics.set(uri, response.diagnostics);
        if (response.hypotheses) {
          session.hypotheses = response.hypotheses;
        }
        if (response.fixes) {
          session.fixes = response.fixes;
        }
        session.status = 'complete';
        session.progress = 100;

        this.onDiagnosticsUpdated?.(uri, response.diagnostics);
        this.onProgressUpdated?.(session);
      } catch (error) {
        session.status = 'error';
        this.onProgressUpdated?.(session);
      }
    }, this.config.debounceDelayMs);

    this.debounceTimers.set(uri, timer);
  }

  /**
   * Cancel pending analysis
   */
  cancelAnalysis(uri: string): void {
    const timer = this.debounceTimers.get(uri);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(uri);
    }

    const session = this.sessions.get(uri);
    if (session && session.status === 'analyzing') {
      session.status = 'idle';
      session.progress = 0;
      this.onProgressUpdated?.(session);
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    this.messageHandlers.set('analyze', async (msg) => {
      const request = msg.payload as AnalyzeRequest;
      // Actual analysis would be delegated to the debug agent
      return {
        messageId: msg.id,
        success: true,
        data: { uri: request.uri, diagnostics: [] },
        timestamp: new Date(),
      };
    });

    this.messageHandlers.set('cancel', async (msg) => {
      const { uri } = msg.payload as { uri: string };
      this.cancelAnalysis(uri);
      return {
        messageId: msg.id,
        success: true,
        timestamp: new Date(),
      };
    });

    this.messageHandlers.set('config', async (msg) => {
      const newConfig = msg.payload as Partial<VSCodeIntegrationConfig>;
      this.config = { ...this.config, ...newConfig };
      return {
        messageId: msg.id,
        success: true,
        data: this.config,
        timestamp: new Date(),
      };
    });
  }

  /**
   * Map error severity to VS Code severity
   */
  private mapSeverity(severity: NormalizedError['severity']): VSCodeSeverity {
    switch (severity) {
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Information';
      case 'hint':
        return 'Hint';
      default:
        return 'Information';
    }
  }

  /**
   * Create a VS Code diagnostic from a normalized error
   */
  private createDiagnostic(
    error: NormalizedError,
    severity: VSCodeSeverity
  ): VSCodeDiagnostic {
    const range = error.location
      ? this.createRange(error.location)
      : { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

    const diagnostic: VSCodeDiagnostic = {
      range,
      message: error.message,
      severity,
      source: this.config.sourceName,
    };

    if (error.type) {
      diagnostic.code = error.type;
    }

    // Add related information from stack trace
    if (error.stackTrace && error.stackTrace.length > 1) {
      diagnostic.relatedInformation = error.stackTrace.slice(1, 4).map((frame) => ({
        location: {
          uri: `file://${frame.location.file}`,
          range: {
            start: { line: (frame.location.line ?? 1) - 1, character: (frame.location.column ?? 1) - 1 },
            end: { line: (frame.location.line ?? 1) - 1, character: (frame.location.column ?? 1) + 10 },
          },
        },
        message: frame.functionName ?? 'anonymous',
      }));
    }

    return diagnostic;
  }

  /**
   * Create VS Code range from source location
   */
  private createRange(location: SourceLocation): VSCodeRange {
    // Convert 1-based to 0-based
    const startLine = Math.max(0, (location.line ?? 1) - 1);
    const startChar = Math.max(0, (location.column ?? 1) - 1);
    const endLine = location.endLine ? location.endLine - 1 : startLine;
    const endChar = location.endColumn ? location.endColumn - 1 : startChar + 1;

    return {
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar },
    };
  }

  /**
   * Create workspace edit from fix suggestion
   */
  private createWorkspaceEdit(fix: FixSuggestion): VSCodeWorkspaceEdit {
    const changes = new Map<string, VSCodeTextEdit[]>();

    for (const change of fix.changes) {
      const uri = `file://${change.file}`;
      const edits = changes.get(uri) ?? [];

      const range: VSCodeRange = {
        start: {
          line: (change.start.line ?? 1) - 1,
          character: (change.start.column ?? 1) - 1,
        },
        end: {
          line: (change.end?.line ?? change.start.line ?? 1) - 1,
          character: (change.end?.column ?? 100) - 1,
        },
      };

      edits.push({
        range,
        newText: change.newContent ?? '',
      });

      changes.set(uri, edits);
    }

    return { changes };
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeSessions: number;
    totalDiagnostics: number;
    pendingAnalysis: number;
  } {
    let totalDiagnostics = 0;

    for (const session of this.sessions.values()) {
      for (const diags of session.diagnostics.values()) {
        totalDiagnostics += diags.length;
      }
    }

    return {
      activeSessions: this.getActiveSessions().length,
      totalDiagnostics,
      pendingAnalysis: this.debounceTimers.size,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create VS Code integration
 */
export function createVSCodeIntegration(
  config?: Partial<VSCodeIntegrationConfig>
): VSCodeIntegration {
  return new VSCodeIntegration(config);
}

// =============================================================================
// Language ID Mapping
// =============================================================================

/**
 * Map VS Code language ID to internal language type
 */
export function mapLanguageId(languageId: string): Language | null {
  const mapping: Record<string, Language> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    typescriptreact: 'typescript',
    javascriptreact: 'javascript',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'css',
    html: 'html',
    json: 'json',
    yaml: 'yaml',
    markdown: 'markdown',
    // Map tailwind config files
    tailwindcss: 'tailwind',
  };

  return mapping[languageId.toLowerCase()] ?? null;
}

/**
 * Get VS Code language ID from internal language
 */
export function getLanguageId(language: Language): string {
  const mapping: Record<Language, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    css: 'css',
    scss: 'scss',
    tailwind: 'css',
    html: 'html',
    json: 'json',
    yaml: 'yaml',
    markdown: 'markdown',
    unknown: 'plaintext',
  };

  return mapping[language] ?? 'plaintext';
}

/**
 * MCP Browser Integration
 *
 * Provides integration with MCP (Model Context Protocol) for browser debugging.
 * Captures console errors, network failures, and runtime exceptions from
 * browser environments through MCP browser tools.
 *
 * @module mcp-browser-integration
 */

import type {
  Language,
  NormalizedError,
  StackFrame,
  ErrorSource,
  ErrorSeverity,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Browser console message level
 */
export type ConsoleLevel = 'error' | 'warning' | 'info' | 'debug' | 'log';

/**
 * Browser console message
 */
export interface ConsoleMessage {
  /** Message level */
  level: ConsoleLevel;
  /** Message text */
  text: string;
  /** Source URL */
  url?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Timestamp */
  timestamp: Date;
  /** Stack trace if available */
  stackTrace?: string;
}

/**
 * Network request status
 */
export type NetworkRequestStatus = 'success' | 'failed' | 'blocked' | 'aborted';

/**
 * Browser network request
 */
export interface NetworkRequest {
  /** Request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Response status code */
  statusCode?: number;
  /** Request status */
  status: NetworkRequestStatus;
  /** Resource type */
  resourceType: string;
  /** Error message if failed */
  error?: string;
  /** Response time in ms */
  responseTimeMs?: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Browser page snapshot
 */
export interface PageSnapshot {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Accessibility tree content */
  content: string;
  /** Screenshot path if taken */
  screenshotPath?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * MCP browser tool interface
 */
export interface MCPBrowserTool {
  /** Get console messages */
  getConsoleMessages: (level?: ConsoleLevel) => Promise<ConsoleMessage[]>;
  /** Get network requests */
  getNetworkRequests: (includeStatic?: boolean) => Promise<NetworkRequest[]>;
  /** Take page snapshot */
  takeSnapshot: () => Promise<PageSnapshot>;
  /** Take screenshot */
  takeScreenshot: (options?: ScreenshotOptions) => Promise<string>;
  /** Navigate to URL */
  navigate: (url: string) => Promise<void>;
  /** Execute JavaScript */
  evaluate: (code: string) => Promise<unknown>;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  /** Full page screenshot */
  fullPage?: boolean;
  /** Image format */
  type?: 'png' | 'jpeg';
  /** File name */
  filename?: string;
}

/**
 * Browser debug context
 */
export interface BrowserDebugContext {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Console messages */
  consoleMessages: ConsoleMessage[];
  /** Network requests */
  networkRequests: NetworkRequest[];
  /** Page snapshot */
  snapshot?: PageSnapshot;
  /** Screenshots */
  screenshots: string[];
  /** Extracted errors */
  errors: NormalizedError[];
  /** Timestamp */
  timestamp: Date;
}

/**
 * MCP browser integration configuration
 */
export interface MCPBrowserIntegrationConfig {
  /** Console level to capture */
  consoleLevel: ConsoleLevel;
  /** Include static resources in network requests */
  includeStaticResources: boolean;
  /** Auto-capture screenshots on error */
  screenshotOnError: boolean;
  /** Max console messages to keep */
  maxConsoleMessages: number;
  /** Max network requests to keep */
  maxNetworkRequests: number;
  /** Verbose logging */
  verbose: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: MCPBrowserIntegrationConfig = {
  consoleLevel: 'error',
  includeStaticResources: false,
  screenshotOnError: true,
  maxConsoleMessages: 100,
  maxNetworkRequests: 200,
  verbose: false,
};

// =============================================================================
// Console Level Mapping
// =============================================================================

const CONSOLE_LEVEL_TO_SEVERITY: Record<ConsoleLevel, ErrorSeverity> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'hint',
  log: 'info',
};

// =============================================================================
// MCP Browser Integration Class
// =============================================================================

/**
 * MCP Browser Integration
 *
 * Integrates with MCP browser tools for debugging web applications.
 */
export class MCPBrowserIntegration {
  private config: MCPBrowserIntegrationConfig;
  private browserTool: MCPBrowserTool | null;
  private debugContexts: BrowserDebugContext[];

  constructor(
    config: Partial<MCPBrowserIntegrationConfig> = {},
    browserTool?: MCPBrowserTool
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.browserTool = browserTool ?? null;
    this.debugContexts = [];
  }

  /**
   * Set the browser tool
   */
  setBrowserTool(tool: MCPBrowserTool): void {
    this.browserTool = tool;
  }

  /**
   * Check if browser tool is available
   */
  hasBrowserTool(): boolean {
    return this.browserTool !== null;
  }

  /**
   * Capture browser debug context
   */
  async captureContext(): Promise<BrowserDebugContext> {
    if (!this.browserTool) {
      throw new Error('No browser tool configured');
    }

    const timestamp = new Date();

    // Gather all browser data in parallel
    const [consoleMessages, networkRequests, snapshot] = await Promise.all([
      this.browserTool.getConsoleMessages(this.config.consoleLevel),
      this.browserTool.getNetworkRequests(this.config.includeStaticResources),
      this.browserTool.takeSnapshot(),
    ]);

    // Extract errors from console messages
    const errors = this.extractErrors(consoleMessages, networkRequests);

    // Take screenshot if errors found and configured
    const screenshots: string[] = [];
    if (this.config.screenshotOnError && errors.length > 0) {
      const screenshotPath = await this.browserTool.takeScreenshot({
        type: 'png',
        filename: `error-${Date.now()}.png`,
      });
      screenshots.push(screenshotPath);
    }

    const context: BrowserDebugContext = {
      url: snapshot.url,
      title: snapshot.title,
      consoleMessages: this.limitArray(
        consoleMessages,
        this.config.maxConsoleMessages
      ),
      networkRequests: this.limitArray(
        networkRequests,
        this.config.maxNetworkRequests
      ),
      snapshot,
      screenshots,
      errors,
      timestamp,
    };

    this.debugContexts.push(context);
    return context;
  }

  /**
   * Extract normalized errors from browser data
   */
  private extractErrors(
    consoleMessages: ConsoleMessage[],
    networkRequests: NetworkRequest[]
  ): NormalizedError[] {
    const errors: NormalizedError[] = [];

    // Extract from console messages
    for (const msg of consoleMessages) {
      if (msg.level === 'error' || msg.level === 'warning') {
        errors.push(this.consoleMessageToError(msg));
      }
    }

    // Extract from failed network requests
    for (const req of networkRequests) {
      if (req.status === 'failed' || req.status === 'blocked') {
        errors.push(this.networkRequestToError(req));
      }
    }

    return errors;
  }

  /**
   * Convert console message to normalized error
   */
  private consoleMessageToError(msg: ConsoleMessage): NormalizedError {
    const language = this.detectLanguage(msg.text, msg.url);
    const errorType = this.extractErrorType(msg.text);
    const stackFrames = msg.stackTrace
      ? this.parseStackTrace(msg.stackTrace)
      : undefined;

    const result: NormalizedError = {
      id: `browser-console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: errorType,
      message: msg.text,
      severity: CONSOLE_LEVEL_TO_SEVERITY[msg.level],
      source: 'console' as ErrorSource,
      language,
      raw: msg.stackTrace ?? msg.text,
      timestamp: msg.timestamp,
    };

    if (msg.url && msg.line) {
      result.location = {
        file: msg.url,
        line: msg.line,
      };
      if (msg.column !== undefined) {
        result.location.column = msg.column;
      }
    }

    if (stackFrames && stackFrames.length > 0) {
      result.stackTrace = stackFrames;
    }

    return result;
  }

  /**
   * Convert network request to normalized error
   */
  private networkRequestToError(req: NetworkRequest): NormalizedError {
    const errorType =
      req.status === 'failed'
        ? 'NetworkError'
        : req.status === 'blocked'
          ? 'BlockedRequest'
          : 'RequestAborted';

    const message =
      req.error ??
      `${req.method} ${req.url} - ${req.status} (${req.statusCode ?? 'unknown'})`;

    return {
      id: `browser-network-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: errorType,
      message,
      severity: 'error',
      source: 'runtime' as ErrorSource,
      language: this.detectLanguageFromUrl(req.url),
      raw: JSON.stringify(req),
      timestamp: req.timestamp,
    };
  }

  /**
   * Parse browser stack trace
   */
  private parseStackTrace(stackTrace: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stackTrace.split('\n');

    // Chrome/V8 format: at functionName (url:line:column)
    // Firefox format: functionName@url:line:column
    const chromePattern = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/;
    const firefoxPattern = /^(.+?)@(.+?):(\d+):(\d+)$/;

    for (const line of lines) {
      let match = chromePattern.exec(line);
      if (match) {
        const functionName = match[1];
        const file = match[2];
        const lineNum = match[3];
        const column = match[4];

        if (file && lineNum && column) {
          const frame: StackFrame = {
            location: {
              file,
              line: parseInt(lineNum, 10),
              column: parseInt(column, 10),
            },
            raw: line,
            isUserCode: this.isUserCode(file),
          };
          if (functionName) {
            frame.functionName = functionName;
          }
          frames.push(frame);
        }
        continue;
      }

      match = firefoxPattern.exec(line);
      if (match) {
        const functionName = match[1];
        const file = match[2];
        const lineNum = match[3];
        const column = match[4];

        if (file && lineNum && column) {
          const frame: StackFrame = {
            location: {
              file,
              line: parseInt(lineNum, 10),
              column: parseInt(column, 10),
            },
            raw: line,
            isUserCode: this.isUserCode(file),
          };
          if (functionName && functionName !== 'anonymous') {
            frame.functionName = functionName;
          }
          frames.push(frame);
        }
      }
    }

    return frames;
  }

  /**
   * Check if a file URL is user code
   */
  private isUserCode(file: string): boolean {
    const libraryPatterns = [
      /node_modules/,
      /vendor/,
      /cdn\./,
      /unpkg\.com/,
      /jsdelivr/,
      /cloudflare/,
      /googleapis/,
      /gstatic/,
      /react.*\.production/,
      /angular.*\.min/,
      /vue.*\.min/,
    ];

    return !libraryPatterns.some((pattern) => pattern.test(file));
  }

  /**
   * Detect language from error text and URL
   */
  private detectLanguage(text: string, url?: string): Language {
    // Check URL extension
    if (url) {
      const lang = this.detectLanguageFromUrl(url);
      if (lang !== 'unknown') {
        return lang;
      }
    }

    // Check error patterns
    if (text.includes('TypeError') || text.includes('ReferenceError')) {
      return 'javascript';
    }
    if (text.includes('CSS') || text.includes('style')) {
      return 'css';
    }
    if (text.includes('<') && text.includes('>')) {
      return 'html';
    }

    return 'javascript'; // Default for browser errors
  }

  /**
   * Detect language from URL
   */
  private detectLanguageFromUrl(url: string): Language {
    const extensionMap: Record<string, Language> = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.css': 'css',
      '.scss': 'scss',
      '.html': 'html',
      '.htm': 'html',
      '.json': 'json',
    };

    for (const [ext, lang] of Object.entries(extensionMap)) {
      if (url.includes(ext)) {
        return lang;
      }
    }

    return 'unknown';
  }

  /**
   * Extract error type from message
   */
  private extractErrorType(message: string): string {
    // Common browser error patterns
    const patterns = [
      /^(TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError):/,
      /^(Uncaught\s+)?(TypeError|ReferenceError|SyntaxError|Error):/,
      /^(Failed to load|NetworkError)/,
      /^(SecurityError|DOMException)/,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(message);
      if (match) {
        const captured = match[match.length - 1];
        if (captured) {
          return captured;
        }
      }
    }

    // Check for CSS errors
    if (
      message.includes('CSS') ||
      message.includes('stylesheet') ||
      message.includes('style')
    ) {
      return 'CSSError';
    }

    // Check for DOM errors
    if (message.includes('DOM') || message.includes('element')) {
      return 'DOMError';
    }

    return 'BrowserError';
  }

  /**
   * Limit array to max items (keep most recent)
   */
  private limitArray<T>(array: T[], max: number): T[] {
    if (array.length <= max) {
      return array;
    }
    return array.slice(-max);
  }

  /**
   * Get console errors from current page
   */
  async getConsoleErrors(): Promise<NormalizedError[]> {
    if (!this.browserTool) {
      return [];
    }

    const messages = await this.browserTool.getConsoleMessages('error');
    return messages.map((msg) => this.consoleMessageToError(msg));
  }

  /**
   * Get network errors from current page
   */
  async getNetworkErrors(): Promise<NormalizedError[]> {
    if (!this.browserTool) {
      return [];
    }

    const requests = await this.browserTool.getNetworkRequests(false);
    return requests
      .filter((req) => req.status === 'failed' || req.status === 'blocked')
      .map((req) => this.networkRequestToError(req));
  }

  /**
   * Analyze page for potential issues
   */
  async analyzePage(): Promise<{
    errors: NormalizedError[];
    warnings: string[];
    suggestions: string[];
  }> {
    if (!this.browserTool) {
      throw new Error('No browser tool configured');
    }

    const context = await this.captureContext();
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for console errors
    if (context.errors.length > 0) {
      warnings.push(`Found ${context.errors.length} browser errors`);
    }

    // Check for failed network requests
    const failedRequests = context.networkRequests.filter(
      (r) => r.status === 'failed'
    );
    if (failedRequests.length > 0) {
      warnings.push(`${failedRequests.length} network requests failed`);
      suggestions.push('Check network connectivity and CORS settings');
    }

    // Check for slow requests
    const slowRequests = context.networkRequests.filter(
      (r) => (r.responseTimeMs ?? 0) > 3000
    );
    if (slowRequests.length > 0) {
      warnings.push(`${slowRequests.length} requests took over 3 seconds`);
      suggestions.push('Consider optimizing slow API calls or adding caching');
    }

    // Check for mixed content
    const mixedContent = context.consoleMessages.filter((m) =>
      m.text.toLowerCase().includes('mixed content')
    );
    if (mixedContent.length > 0) {
      warnings.push('Mixed content warnings detected');
      suggestions.push('Ensure all resources are loaded over HTTPS');
    }

    // Check for deprecated APIs
    const deprecations = context.consoleMessages.filter(
      (m) =>
        m.text.toLowerCase().includes('deprecated') ||
        m.text.toLowerCase().includes('will be removed')
    );
    if (deprecations.length > 0) {
      warnings.push(`${deprecations.length} deprecation warnings`);
      suggestions.push('Update deprecated APIs before they are removed');
    }

    return {
      errors: context.errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Execute JavaScript in browser and capture errors
   */
  async executeAndCapture(code: string): Promise<{
    result: unknown;
    errors: NormalizedError[];
  }> {
    if (!this.browserTool) {
      throw new Error('No browser tool configured');
    }

    // Get initial console messages
    const beforeMessages = await this.browserTool.getConsoleMessages('error');
    const beforeCount = beforeMessages.length;

    // Execute code
    let result: unknown;
    try {
      result = await this.browserTool.evaluate(code);
    } catch (error) {
      const normalizedError: NormalizedError = {
        id: `browser-eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'EvaluationError',
        message: error instanceof Error ? error.message : String(error),
        severity: 'error',
        source: 'runtime',
        language: 'javascript',
        raw: String(error),
        timestamp: new Date(),
      };
      return { result: undefined, errors: [normalizedError] };
    }

    // Get new console errors
    const afterMessages = await this.browserTool.getConsoleMessages('error');
    const newMessages = afterMessages.slice(beforeCount);
    const errors = newMessages.map((msg) => this.consoleMessageToError(msg));

    return { result, errors };
  }

  /**
   * Get all captured debug contexts
   */
  getDebugContexts(): BrowserDebugContext[] {
    return this.debugContexts;
  }

  /**
   * Get the most recent debug context
   */
  getLatestContext(): BrowserDebugContext | undefined {
    return this.debugContexts[this.debugContexts.length - 1];
  }

  /**
   * Clear captured contexts
   */
  clearContexts(): void {
    this.debugContexts = [];
  }

  /**
   * Create MCP tool adapter from function references
   *
   * This creates an adapter that can be used with Claude Code's MCP browser tools.
   */
  static createToolAdapter(tools: {
    getConsoleMessages: (level?: string) => Promise<unknown[]>;
    getNetworkRequests: (includeStatic?: boolean) => Promise<unknown[]>;
    takeSnapshot: () => Promise<unknown>;
    takeScreenshot: (options?: unknown) => Promise<string>;
    navigate: (url: string) => Promise<void>;
    evaluate: (code: string) => Promise<unknown>;
  }): MCPBrowserTool {
    return {
      getConsoleMessages: async (level?: ConsoleLevel) => {
        const messages = await tools.getConsoleMessages(level);
        return messages.map((m) => {
          const msg = m as Record<string, unknown>;
          const result: ConsoleMessage = {
            level: (msg.level as ConsoleLevel) ?? 'log',
            text: String(msg.text ?? msg.message ?? ''),
            timestamp: msg.timestamp
              ? new Date(msg.timestamp as string)
              : new Date(),
          };
          if (typeof msg.url === 'string') {
            result.url = msg.url;
          }
          if (typeof msg.line === 'number') {
            result.line = msg.line;
          }
          if (typeof msg.column === 'number') {
            result.column = msg.column;
          }
          if (typeof msg.stackTrace === 'string') {
            result.stackTrace = msg.stackTrace;
          }
          return result;
        });
      },
      getNetworkRequests: async (includeStatic?: boolean) => {
        const requests = await tools.getNetworkRequests(includeStatic);
        return requests.map((r) => {
          const req = r as Record<string, unknown>;
          const result: NetworkRequest = {
            url: String(req.url ?? ''),
            method: String(req.method ?? 'GET'),
            status: (req.status as NetworkRequestStatus) ?? 'success',
            resourceType: String(req.resourceType ?? 'other'),
            timestamp: req.timestamp
              ? new Date(req.timestamp as string)
              : new Date(),
          };
          if (typeof req.statusCode === 'number') {
            result.statusCode = req.statusCode;
          }
          if (typeof req.error === 'string') {
            result.error = req.error;
          }
          if (typeof req.responseTimeMs === 'number') {
            result.responseTimeMs = req.responseTimeMs;
          }
          return result;
        });
      },
      takeSnapshot: async () => {
        const snapshot = (await tools.takeSnapshot()) as Record<
          string,
          unknown
        >;
        const result: PageSnapshot = {
          url: String(snapshot.url ?? ''),
          title: String(snapshot.title ?? ''),
          content: String(snapshot.content ?? ''),
          timestamp: snapshot.timestamp
            ? new Date(snapshot.timestamp as string)
            : new Date(),
        };
        if (typeof snapshot.screenshotPath === 'string') {
          result.screenshotPath = snapshot.screenshotPath;
        }
        return result;
      },
      takeScreenshot: tools.takeScreenshot,
      navigate: tools.navigate,
      evaluate: tools.evaluate,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create MCP browser integration
 */
export function createMCPBrowserIntegration(
  config?: Partial<MCPBrowserIntegrationConfig>,
  browserTool?: MCPBrowserTool
): MCPBrowserIntegration {
  return new MCPBrowserIntegration(config, browserTool);
}

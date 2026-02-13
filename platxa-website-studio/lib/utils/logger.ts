/**
 * Structured logging utility for production observability.
 *
 * Provides leveled, structured logging with request context tracking.
 * - Development: human-readable colored output
 * - Production: JSON one-liner for log aggregation
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogContext {
  requestId?: string;
  userId?: string;
  source?: string;
  [key: string]: unknown;
}

export interface LoggerConfig {
  /** Minimum log level (default: "warn" in production, "debug" in development) */
  minLevel?: LogLevel;
  /** Additional context merged into every log entry */
  context?: LogContext;
}

const isProduction = () => process.env.NODE_ENV === "production";

function getDefaultMinLevel(): LogLevel {
  return isProduction() ? "warn" : "debug";
}

export class Logger {
  private minLevel: LogLevel;
  private context: LogContext;

  constructor(config: LoggerConfig = {}) {
    this.minLevel = config.minLevel ?? getDefaultMinLevel();
    this.context = config.context ?? {};
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log("warn", message, meta);
  }

  error(message: string, err?: Error | null, meta?: Record<string, unknown>): void {
    const errorMeta: Record<string, unknown> = { ...meta };
    if (err) {
      errorMeta.errorName = err.name;
      errorMeta.errorMessage = err.message;
      errorMeta.stack = err.stack;
    }
    this.log("error", message, errorMeta);
  }

  /**
   * Creates a child logger with merged context.
   * Child inherits parent's context and config, with overrides.
   */
  child(context: LogContext): Logger {
    return new Logger({
      minLevel: this.minLevel,
      context: { ...this.context, ...context },
    });
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.minLevel]) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };

    if (isProduction()) {
      // JSON format for log aggregation
      const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      consoleFn(JSON.stringify(entry));
    } else {
      // Human-readable format for development
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
      const source = this.context.source ? ` [${this.context.source}]` : "";
      const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
      const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : level === "debug" ? console.debug : console.log;
      consoleFn(`${prefix}${source} ${message}${metaStr}`);
    }
  }
}

/**
 * Generates a unique request ID.
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a logger with the given context.
 */
export function createLogger(context: LogContext = {}): Logger {
  return new Logger({ context });
}

/**
 * Creates a logger from an incoming Request object.
 * Extracts method and pathname, generates a request ID.
 */
export function loggerFromRequest(req: Request, source: string): Logger {
  let pathname = "";
  let method = "UNKNOWN";
  try {
    const url = new URL(req.url);
    pathname = url.pathname;
    method = req.method;
  } catch {
    // URL parsing can fail in edge cases
  }

  return new Logger({
    context: {
      requestId: generateRequestId(),
      source,
      method,
      pathname,
    },
  });
}

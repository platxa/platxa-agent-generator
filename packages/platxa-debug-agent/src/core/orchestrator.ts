/**
 * Debug Agent Orchestrator
 *
 * The central coordination component that routes errors to language-specific modules,
 * manages debug sessions, and aggregates analysis results.
 *
 * Architecture:
 * - Receives raw error input
 * - Detects language using LanguageDetector
 * - Routes to appropriate language module
 * - Aggregates results and generates fixes
 */

import { randomUUID } from 'crypto';
import {
  type AnalysisContext,
  type DebugEvent,
  type DebugSession,
  type FixSuggestion,
  type Language,
  type LanguageModule,
  type ModuleAnalysisResult,
  type NormalizedError,
  type OrchestratorConfig,
  type RootCauseHypothesis,
  type ValidationResult,
} from './types.js';
import { LanguageDetector } from './language-detector.js';

// =============================================================================
// Event Emitter Type
// =============================================================================

type EventListener = (event: DebugEvent) => void;

// =============================================================================
// Orchestrator Class
// =============================================================================

/**
 * Main orchestrator for the debug agent.
 * Coordinates between language modules, manages sessions, and emits events.
 */
export class Orchestrator {
  private readonly config: Required<OrchestratorConfig>;
  private readonly languageDetector: LanguageDetector;
  private readonly modules: Map<Language, LanguageModule> = new Map();
  private readonly sessions: Map<string, DebugSession> = new Map();
  private readonly eventListeners: Set<EventListener> = new Set();

  constructor(config: OrchestratorConfig) {
    this.config = {
      workingDir: config.workingDir,
      verbose: config.verbose ?? false,
      maxAnalysisTimeMs: config.maxAnalysisTimeMs ?? 30000,
      parallelExecution: config.parallelExecution ?? true,
      moduleConfigs: config.moduleConfigs ?? {},
    };
    this.languageDetector = new LanguageDetector();
  }

  // ===========================================================================
  // Module Registration
  // ===========================================================================

  /**
   * Register a language module with the orchestrator
   */
  registerModule(module: LanguageModule): void {
    this.modules.set(module.language, module);

    if (this.config.verbose) {
      this.log(`Registered module: ${module.language}`);
    }
  }

  /**
   * Get a registered module by language
   */
  getModule(language: Language): LanguageModule | undefined {
    return this.modules.get(language);
  }

  /**
   * Get all registered modules
   */
  getRegisteredModules(): Language[] {
    return Array.from(this.modules.keys());
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Create a new debug session
   */
  private createSession(input: string, language: Language): DebugSession {
    const session: DebugSession = {
      id: randomUUID(),
      startedAt: new Date(),
      input,
      language,
      errors: [],
      status: 'parsing',
    };

    this.sessions.set(session.id, session);
    this.emit({
      type: 'session_started',
      timestamp: new Date(),
      sessionId: session.id,
      data: { language, inputLength: input.length },
    });

    return session;
  }

  /**
   * Update session status
   */
  private updateSessionStatus(
    sessionId: string,
    status: DebugSession['status'],
    updates?: Partial<DebugSession>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session !== undefined) {
      session.status = status;
      if (updates !== undefined) {
        Object.assign(session, updates);
      }
    }
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): DebugSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): DebugSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status !== 'complete' && s.status !== 'failed'
    );
  }

  // ===========================================================================
  // Event System
  // ===========================================================================

  /**
   * Subscribe to debug events
   */
  on(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  /**
   * Emit a debug event
   */
  private emit(event: DebugEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        this.log(`Event listener error: ${String(error)}`);
      }
    }
  }

  // ===========================================================================
  // Core Debug Flow
  // ===========================================================================

  /**
   * Main entry point: Debug the given error input
   *
   * @param input - Raw error text, stack trace, or log output
   * @param options - Optional settings for this debug session
   * @returns Debug session with analysis results
   */
  async debug(
    input: string,
    options?: {
      /** Hint for language if known */
      languageHint?: Language;
      /** File path context */
      filePath?: string;
      /** Additional files to consider */
      relevantFiles?: string[];
    }
  ): Promise<DebugSession> {
    // Step 1: Detect language
    const detection = this.detectLanguage(input, options?.languageHint, options?.filePath);
    const language = detection.language;

    // Step 2: Create session
    const session = this.createSession(input, language);

    this.emit({
      type: 'language_detected',
      timestamp: new Date(),
      sessionId: session.id,
      data: detection,
    });

    try {
      // Step 3: Get the appropriate module
      const module = this.getModuleForLanguage(language);

      if (module === undefined) {
        this.updateSessionStatus(session.id, 'failed');
        this.emit({
          type: 'error',
          timestamp: new Date(),
          sessionId: session.id,
          data: { message: `No module registered for language: ${language}` },
        });
        return session;
      }

      // Step 4: Parse errors
      this.updateSessionStatus(session.id, 'parsing');
      const errors = await this.parseErrors(module, input, session.id);
      session.errors = errors;

      if (errors.length === 0) {
        this.updateSessionStatus(session.id, 'complete');
        return session;
      }

      // Step 5: Analyze errors
      this.updateSessionStatus(session.id, 'analyzing');
      const context = await this.buildAnalysisContext(options?.relevantFiles ?? []);
      const analysisResults = await this.analyzeErrors(module, errors, context, session.id);
      session.analysisResults = [analysisResults];

      // Step 6: Generate fixes
      this.updateSessionStatus(session.id, 'fixing');
      const fixes = await this.generateFixes(
        module,
        errors,
        analysisResults.hypotheses,
        session.id
      );

      // Update analysis results with fixes
      analysisResults.fixes = fixes;

      // Select best hypothesis
      if (analysisResults.hypotheses.length > 0) {
        session.selectedHypothesis = this.selectBestHypothesis(analysisResults.hypotheses);
      }

      this.updateSessionStatus(session.id, 'complete');
      this.emit({
        type: 'session_complete',
        timestamp: new Date(),
        sessionId: session.id,
        data: {
          errorCount: errors.length,
          hypothesisCount: analysisResults.hypotheses.length,
          fixCount: fixes.length,
        },
      });

      return session;
    } catch (error) {
      this.updateSessionStatus(session.id, 'failed');
      this.emit({
        type: 'error',
        timestamp: new Date(),
        sessionId: session.id,
        data: { error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Apply a fix from the session
   */
  async applyFix(sessionId: string, fixId: string): Promise<ValidationResult> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const fix = this.findFix(session, fixId);
    if (fix === undefined) {
      throw new Error(`Fix not found: ${fixId}`);
    }

    const module = this.modules.get(session.language);
    if (module === undefined) {
      throw new Error(`No module for language: ${session.language}`);
    }

    this.updateSessionStatus(sessionId, 'validating');

    const result = await module.validateFix(fix);

    this.emit({
      type: 'fix_validated',
      timestamp: new Date(),
      sessionId,
      data: { fixId, passed: result.passed },
    });

    if (result.passed) {
      session.appliedFix = fix;
    }

    this.updateSessionStatus(sessionId, 'complete');

    return result;
  }

  // ===========================================================================
  // Multi-Language Support
  // ===========================================================================

  /**
   * Debug input that may contain multiple languages
   * (e.g., HTML with embedded JS/CSS)
   */
  async debugMultiLanguage(
    input: string,
    options?: {
      primaryLanguage?: Language;
      relevantFiles?: string[];
    }
  ): Promise<DebugSession[]> {
    const sessions: DebugSession[] = [];

    // Detect all languages present
    const detectionResult = this.languageDetector.detect({ content: input });
    const languages = [
      detectionResult.language,
      ...(detectionResult.secondaryLanguages ?? []),
    ];

    // Build debug options - only include defined properties (exactOptionalPropertyTypes)
    const buildDebugOptions = (lang: Language): Parameters<typeof this.debug>[1] => {
      const opts: { languageHint: Language; relevantFiles?: string[] } = {
        languageHint: lang,
      };
      if (options?.relevantFiles !== undefined) {
        opts.relevantFiles = options.relevantFiles;
      }
      return opts;
    };

    // Run debug for each language in parallel or sequence
    if (this.config.parallelExecution) {
      const promises = languages.map((lang) =>
        this.debug(input, buildDebugOptions(lang))
      );
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          sessions.push(result.value);
        }
      }
    } else {
      for (const lang of languages) {
        const session = await this.debug(input, buildDebugOptions(lang));
        sessions.push(session);
      }
    }

    return sessions;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Detect language from input
   */
  private detectLanguage(
    input: string,
    hint?: Language,
    filePath?: string
  ): ReturnType<LanguageDetector['detect']> {
    if (hint !== undefined) {
      return {
        language: hint,
        confidence: 'high',
        score: 1.0,
        detectionMethod: 'pattern' as const,
      };
    }

    // Build detection input - only include defined properties
    const detectionInput: Parameters<LanguageDetector['detect']>[0] = {
      content: input,
    };
    if (filePath !== undefined) {
      detectionInput.filePath = filePath;
    }

    return this.languageDetector.detect(detectionInput);
  }

  /**
   * Get appropriate module for a language
   */
  private getModuleForLanguage(language: Language): LanguageModule | undefined {
    // Direct match
    if (this.modules.has(language)) {
      return this.modules.get(language);
    }

    // Fallback mappings
    const fallbacks: Partial<Record<Language, Language[]>> = {
      scss: ['css'],
      tailwind: ['css'],
      typescript: ['javascript'],
    };

    const fallbackLangs = fallbacks[language];
    if (fallbackLangs !== undefined) {
      for (const fallback of fallbackLangs) {
        const module = this.modules.get(fallback);
        if (module !== undefined) {
          return module;
        }
      }
    }

    return undefined;
  }

  /**
   * Parse errors using the language module
   */
  private async parseErrors(
    module: LanguageModule,
    input: string,
    sessionId: string
  ): Promise<NormalizedError[]> {
    const errors = await module.parseError(input);

    for (const error of errors) {
      this.emit({
        type: 'error_parsed',
        timestamp: new Date(),
        sessionId,
        data: { errorId: error.id, type: error.type, message: error.message },
      });
    }

    return errors;
  }

  /**
   * Build analysis context
   */
  private async buildAnalysisContext(relevantFiles: string[]): Promise<AnalysisContext> {
    return {
      workingDir: this.config.workingDir,
      relevantFiles,
      fileContents: new Map(),
      // Git info and project config would be populated by file system utilities
    };
  }

  /**
   * Analyze errors with the language module
   */
  private async analyzeErrors(
    module: LanguageModule,
    errors: NormalizedError[],
    context: AnalysisContext,
    sessionId: string
  ): Promise<ModuleAnalysisResult> {
    this.emit({
      type: 'analysis_started',
      timestamp: new Date(),
      sessionId,
      data: { errorCount: errors.length },
    });

    const result = await module.analyze(errors, context);

    for (const hypothesis of result.hypotheses) {
      this.emit({
        type: 'hypothesis_generated',
        timestamp: new Date(),
        sessionId,
        data: {
          hypothesisId: hypothesis.id,
          description: hypothesis.description,
          confidence: hypothesis.confidence,
        },
      });
    }

    return result;
  }

  /**
   * Generate fix suggestions
   */
  private async generateFixes(
    module: LanguageModule,
    errors: NormalizedError[],
    hypotheses: RootCauseHypothesis[],
    sessionId: string
  ): Promise<FixSuggestion[]> {
    const fixes = await module.suggestFixes(errors, hypotheses);

    for (const fix of fixes) {
      this.emit({
        type: 'fix_suggested',
        timestamp: new Date(),
        sessionId,
        data: { fixId: fix.id, description: fix.description, confidence: fix.confidence },
      });
    }

    return fixes;
  }

  /**
   * Select the best hypothesis based on confidence and evidence
   */
  private selectBestHypothesis(hypotheses: RootCauseHypothesis[]): RootCauseHypothesis {
    return hypotheses.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Find a fix by ID in a session
   */
  private findFix(session: DebugSession, fixId: string): FixSuggestion | undefined {
    if (session.analysisResults === undefined) {
      return undefined;
    }

    for (const result of session.analysisResults) {
      const fix = result.fixes.find((f) => f.id === fixId);
      if (fix !== undefined) {
        return fix;
      }
    }

    return undefined;
  }

  /**
   * Log a message (respects verbose setting)
   */
  private log(message: string): void {
    if (this.config.verbose) {
      // eslint-disable-next-line no-console
      console.log(`[Orchestrator] ${message}`);
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clear completed sessions
   */
  clearCompletedSessions(): number {
    let cleared = 0;
    for (const [id, session] of this.sessions) {
      if (session.status === 'complete' || session.status === 'failed') {
        this.sessions.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    failedSessions: number;
    registeredModules: number;
  } {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(
        (s) => s.status !== 'complete' && s.status !== 'failed'
      ).length,
      completedSessions: sessions.filter((s) => s.status === 'complete').length,
      failedSessions: sessions.filter((s) => s.status === 'failed').length,
      registeredModules: this.modules.size,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new orchestrator instance with default configuration
 */
export function createOrchestrator(
  workingDir: string,
  options?: Partial<Omit<OrchestratorConfig, 'workingDir'>>
): Orchestrator {
  return new Orchestrator({
    workingDir,
    ...options,
  });
}

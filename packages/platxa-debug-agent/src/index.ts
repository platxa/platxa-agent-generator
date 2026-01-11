/**
 * Platxa Debug Agent
 *
 * Production-grade multi-language AI debugging agent for Claude Code.
 * Supports Python, JavaScript, TypeScript, CSS, SCSS, Tailwind, HTML, and more.
 *
 * @packageDocumentation
 */

// Core types
export type {
  Language,
  ConfidenceLevel,
  LanguageDetectionResult,
  ErrorSeverity,
  ErrorSource,
  SourceLocation,
  StackFrame,
  NormalizedError,
  RootCauseHypothesis,
  Evidence,
  FixSuggestion,
  CodeChange,
  ValidationStep,
  ModuleAnalysisResult,
  LanguageModule,
  AnalysisContext,
  ValidationResult,
  OrchestratorConfig,
  DebugSession,
  DebugEvent,
} from './core/types.js';

// Language detection
export { LanguageDetector } from './core/language-detector.js';

// Error parsing
export { ErrorParser, createErrorParser } from './core/error-parser.js';
export type { ErrorParserConfig } from './core/error-parser.js';

// Orchestrator
export { Orchestrator, createOrchestrator } from './core/orchestrator.js';

// Context Engine
export { ContextEngine, createContextEngine } from './core/context-engine.js';
export type {
  ASTNode,
  SymbolInfo,
  ParameterInfo,
  ImportInfo,
  ImportedName,
  CodeContext,
  FileContext,
  ContextExtractionOptions,
} from './core/context-engine.js';

// Language Modules
export { PythonModule, createPythonModule } from './modules/python-module.js';
export {
  JavaScriptModule,
  createJavaScriptModule,
  createTypeScriptModule,
} from './modules/javascript-module.js';
export {
  CSSModule,
  createCSSModule,
  createSCSSModule,
  createTailwindModule,
} from './modules/css-module.js';

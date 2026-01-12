/**
 * Adapters module
 *
 * Output adapters for formatting debug results for different consumers.
 *
 * @module adapters
 */

export {
  ClaudeAdapter,
  createClaudeAdapter,
  claudeAdapter,
  type ClaudeAdapterOptions,
  type DebugResults,
} from './claude-adapter.js';

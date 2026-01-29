/**
 * Tests for inspect-logs tool
 * Feature #24: Aggregate errors from SCSS, QWeb, Odoo, and preview sources
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  inspectLogsTool,
  inspectLogsImpl,
  getLogInspector,
  resetLogInspector,
  getRecentLogs,
  getAllErrors,
  getLogsBySource,
  hasErrors,
  clearLogs,
  type InspectLogsOptions,
} from '@/lib/agentic-core/tools/inspect-logs';
import type { AgentContext } from '@/lib/agentic-core/agent-engine';

describe('inspect-logs tool', () => {
  beforeEach(() => {
    resetLogInspector();
  });

  afterEach(() => {
    resetLogInspector();
  });

  describe('inspectLogsImpl', () => {
    it('returns empty result when no logs exist', () => {
      const result = inspectLogsImpl();

      expect(result.entries).toEqual([]);
      expect(result.count).toBe(0);
      expect(result.hasErrors).toBe(false);
      expect(result.errorCount).toBe(0);
      expect(result.stats).toBeDefined();
      expect(result.stats?.total).toBe(0);
    });

    it('aggregates logs from SCSS source', () => {
      const inspector = getLogInspector();
      inspector.addScssResult({
        success: false,
        error: 'Invalid SCSS syntax',
        file: 'theme.scss',
      });

      const result = inspectLogsImpl({ source: ['scss'] });

      expect(result.count).toBe(1);
      expect(result.hasErrors).toBe(true);
      expect(result.entries[0].source).toBe('scss');
      expect(result.entries[0].severity).toBe('error');
      expect(result.entries[0].message).toBe('Invalid SCSS syntax');
    });

    it('aggregates logs from QWeb source', () => {
      const inspector = getLogInspector();
      inspector.addQwebErrors(['Missing closing tag'], 'template.xml');

      const result = inspectLogsImpl({ source: ['qweb'] });

      expect(result.count).toBe(1);
      expect(result.hasErrors).toBe(true);
      expect(result.entries[0].source).toBe('qweb');
      expect(result.entries[0].message).toBe('Missing closing tag');
    });

    it('aggregates logs from Odoo source', () => {
      const inspector = getLogInspector();
      inspector.addOdooError('Runtime error in snippet', {
        snippetId: 's_banner',
      });

      const result = inspectLogsImpl({ source: ['odoo'] });

      expect(result.count).toBe(1);
      expect(result.entries[0].source).toBe('odoo');
      expect(result.entries[0].message).toBe('Runtime error in snippet');
    });

    it('aggregates logs from preview source', () => {
      const inspector = getLogInspector();
      inspector.addPreviewError('Preview iframe error', {
        url: '/shop',
        snippetId: 's_product',
      });

      const result = inspectLogsImpl({ source: ['preview'] });

      expect(result.count).toBe(1);
      expect(result.entries[0].source).toBe('preview');
      expect(result.entries[0].message).toBe('Preview iframe error');
    });

    it('filters by severity', () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'Error 1', file: 'a.scss' });
      inspector.addQwebWarning('Warning 1', 'template.xml');

      const errorsOnly = inspectLogsImpl({ severity: ['error'] });
      const warningsOnly = inspectLogsImpl({ severity: ['warning'] });

      expect(errorsOnly.count).toBe(1);
      expect(errorsOnly.entries[0].severity).toBe('error');
      expect(warningsOnly.count).toBe(1);
      expect(warningsOnly.entries[0].severity).toBe('warning');
    });

    it('filters by multiple sources', () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'SCSS error', file: 'a.scss' });
      inspector.addQwebErrors(['QWeb error'], 'template.xml');
      inspector.addOdooError('Odoo error');

      const result = inspectLogsImpl({ source: ['scss', 'qweb'] });

      expect(result.count).toBe(2);
      expect(result.entries.some(e => e.source === 'scss')).toBe(true);
      expect(result.entries.some(e => e.source === 'qweb')).toBe(true);
      expect(result.entries.some(e => e.source === 'odoo')).toBe(false);
    });

    it('respects limit option', () => {
      const inspector = getLogInspector();
      for (let i = 0; i < 10; i++) {
        inspector.addScssResult({ success: false, error: `Error ${i}`, file: `file${i}.scss` });
      }

      const result = inspectLogsImpl({ limit: 5 });

      expect(result.count).toBe(5);
    });

    it('includes statistics when requested', () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'SCSS error', file: 'a.scss' });
      inspector.addQwebWarning('Warning', 'template.xml');

      const result = inspectLogsImpl({ includeStats: true });

      expect(result.stats).toBeDefined();
      expect(result.stats?.total).toBe(2);
      expect(result.stats?.bySeverity.error).toBe(1);
      expect(result.stats?.bySeverity.warning).toBe(1);
      expect(result.stats?.bySource.scss).toBe(1);
      expect(result.stats?.bySource.qweb).toBe(1);
    });

    it('exports in text format', () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'Test error', file: 'test.scss' });

      const result = inspectLogsImpl({ exportFormat: 'text' });

      expect(result.exported).toBeDefined();
      expect(result.exported).toContain('ERROR');
      expect(result.exported).toContain('scss');
      expect(result.exported).toContain('Test error');
    });

    it('exports in JSON format', () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'Test error', file: 'test.scss' });

      const result = inspectLogsImpl({ exportFormat: 'json' });

      expect(result.exported).toBeDefined();
      const parsed = JSON.parse(result.exported!);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe('Test error');
    });
  });

  describe('helper functions', () => {
    it('getRecentLogs returns recent entries', () => {
      const inspector = getLogInspector();
      for (let i = 0; i < 10; i++) {
        inspector.addScssResult({ success: false, error: `Error ${i}`, file: `file${i}.scss` });
      }

      const recent = getRecentLogs(3);

      expect(recent.length).toBe(3);
    });

    it('getAllErrors returns only errors', () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'Error', file: 'a.scss' });
      inspector.addQwebWarning('Warning', 'template.xml');

      const errors = getAllErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].severity).toBe('error');
    });

    it('getLogsBySource filters by source', () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'SCSS error', file: 'a.scss' });
      inspector.addQwebErrors(['QWeb error'], 'template.xml');

      const scssLogs = getLogsBySource('scss');
      const qwebLogs = getLogsBySource('qweb');

      expect(scssLogs.length).toBe(1);
      expect(qwebLogs.length).toBe(1);
    });

    it('hasErrors returns true when errors exist', () => {
      expect(hasErrors()).toBe(false);

      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'Error', file: 'a.scss' });

      expect(hasErrors()).toBe(true);
    });

    it('clearLogs removes all entries', () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'Error', file: 'a.scss' });

      expect(hasErrors()).toBe(true);
      clearLogs();
      expect(hasErrors()).toBe(false);
    });
  });

  describe('inspectLogsTool', () => {
    const mockContext: AgentContext = {
      workspaceRoot: '/test/workspace',
      goal: 'Test goal',
      iteration: 1,
      maxIterations: 5,
      planMode: false,
    };

    it('returns successful result with log data', async () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'SCSS error', file: 'theme.scss' });

      const result = await inspectLogsTool({
        target: 'all',
        context: mockContext,
      });

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('inspect_logs');
      expect(result.data).toBeDefined();
      expect((result.data as any).count).toBe(1);
      expect((result.data as any).hasErrors).toBe(true);
    });

    it('filters by target source', async () => {
      const inspector = getLogInspector();
      inspector.addScssResult({ success: false, error: 'SCSS error', file: 'a.scss' });
      inspector.addQwebErrors(['QWeb error'], 'template.xml');

      const result = await inspectLogsTool({
        target: 'scss',
        context: mockContext,
      });

      expect(result.success).toBe(true);
      expect((result.data as any).count).toBe(1);
      expect((result.data as any).entries[0].source).toBe('scss');
    });

    it('passes options through params', async () => {
      const inspector = getLogInspector();
      for (let i = 0; i < 10; i++) {
        inspector.addScssResult({ success: false, error: `Error ${i}`, file: `file${i}.scss` });
      }

      const result = await inspectLogsTool({
        target: 'all',
        context: mockContext,
        options: { limit: 3 },
      });

      expect(result.success).toBe(true);
      expect((result.data as any).count).toBe(3);
    });

    it('handles errors gracefully', async () => {
      // Force an error by passing invalid options
      const result = await inspectLogsTool({
        target: 'all',
        context: mockContext,
        options: {},
      });

      // Should still succeed with empty/default results
      expect(result.success).toBe(true);
    });

    it('includes stats by default', async () => {
      const result = await inspectLogsTool({
        target: 'all',
        context: mockContext,
      });

      expect(result.success).toBe(true);
      expect((result.data as any).stats).toBeDefined();
    });
  });

  describe('Feature #24 verification', () => {
    it('returns recent logs from ALL sources with severity classification', () => {
      const inspector = getLogInspector();

      // Add logs from all sources
      inspector.addScssResult({ success: false, error: 'SCSS compilation error', file: 'theme.scss' });
      inspector.addQwebErrors(['QWeb parse error'], 'template.xml');
      inspector.addOdooError('Odoo runtime error', { snippetId: 's_banner' });
      inspector.addPreviewError('Preview render error', { url: '/shop' });
      inspector.addBridgeError({ message: 'Bridge communication error', code: 'BRIDGE_ERR' });
      inspector.addHmrLog('error', 'HMR update failed', { updateType: 'css' });
      inspector.addQwebWarning('QWeb deprecation warning', 'old_template.xml');

      const result = inspectLogsImpl();

      // Verify all sources are represented
      const sources = new Set(result.entries.map(e => e.source));
      expect(sources.has('scss')).toBe(true);
      expect(sources.has('qweb')).toBe(true);
      expect(sources.has('odoo')).toBe(true);
      expect(sources.has('preview')).toBe(true);
      expect(sources.has('bridge')).toBe(true);
      expect(sources.has('hmr')).toBe(true);

      // Verify severity classification
      const severities = new Set(result.entries.map(e => e.severity));
      expect(severities.has('error')).toBe(true);
      expect(severities.has('warning')).toBe(true);

      // Verify stats reflect all sources
      expect(result.stats?.bySource.scss).toBe(1);
      expect(result.stats?.bySource.qweb).toBe(2); // error + warning
      expect(result.stats?.bySource.odoo).toBe(1);
      expect(result.stats?.bySource.preview).toBe(1);
      expect(result.stats?.bySource.bridge).toBe(1);
      expect(result.stats?.bySource.hmr).toBe(1);

      // Verify error count
      expect(result.errorCount).toBe(6);
      expect(result.hasErrors).toBe(true);
    });
  });
});

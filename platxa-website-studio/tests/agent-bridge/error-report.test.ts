/**
 * Tests for Error Report
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createReport,
  createReportFromError,
  getReport,
  getActiveReport,
  getAllReports,
  getReportsByStatus,
  getReportsBySeverity,
  getOpenReports,
  setActiveReport,
  deleteReport,
  updateStatus,
  resolveReport,
  setSeverity,
  addAttemptedFix,
  getAttemptedFixes,
  getFixCount,
  getSuccessfulFixes,
  updateContext,
  addContextData,
  getReportSummary,
  getAllSummaries,
  exportReport,
  exportAllReports,
  formatReportAsText,
  getReportCount,
  getOpenCount,
  getResolvedCount,
  getCountByType,
  getCountBySeverity,
  cleanupOldReports,
  setMaxReports,
  setRetentionMs,
  setAutoCleanup,
  onReport,
  getState,
  resetErrorReport,
  type ErrorReport,
} from '../../lib/agent-bridge/error-report';

describe('Error Report', () => {
  beforeEach(() => {
    resetErrorReport();
  });

  describe('Report Creation', () => {
    it('should create report with error details', () => {
      const report = createReport({
        message: 'Test error',
        type: 'runtime',
        code: 'ERR_001',
      });

      expect(report.id).toBeDefined();
      expect(report.error.message).toBe('Test error');
      expect(report.error.type).toBe('runtime');
      expect(report.error.code).toBe('ERR_001');
    });

    it('should create report with context', () => {
      const report = createReport(
        { message: 'Error' },
        {
          component: 'TestComponent',
          action: 'testAction',
          userInput: 'test input',
        }
      );

      expect(report.context.component).toBe('TestComponent');
      expect(report.context.action).toBe('testAction');
      expect(report.context.userInput).toBe('test input');
    });

    it('should create report from Error object', () => {
      const error = new Error('Native error');
      const report = createReportFromError(error);

      expect(report.error.message).toBe('Native error');
      expect(report.error.type).toBe('runtime');
      expect(report.error.stack).toBeDefined();
    });

    it('should set default values', () => {
      const report = createReport({ message: 'Error' });

      expect(report.error.code).toBeNull();
      expect(report.error.type).toBe('unknown');
      expect(report.status).toBe('open');
      expect(report.attemptedFixes).toEqual([]);
    });

    it('should set timestamps', () => {
      const before = Date.now();
      const report = createReport({ message: 'Error' });
      const after = Date.now();

      expect(report.timestamps.occurred).toBeGreaterThanOrEqual(before);
      expect(report.timestamps.occurred).toBeLessThanOrEqual(after);
      expect(report.timestamps.reported).toBe(report.timestamps.occurred);
      expect(report.timestamps.resolved).toBeNull();
    });

    it('should determine severity from error type', () => {
      const syntaxReport = createReport({ message: 'Error', type: 'syntax' });
      const validationReport = createReport({ message: 'Error', type: 'validation' });

      expect(syntaxReport.severity).toBe('high');
      expect(validationReport.severity).toBe('low');
    });

    it('should set as active report', () => {
      const report = createReport({ message: 'Error' });

      expect(getActiveReport()?.id).toBe(report.id);
    });
  });

  describe('Report Management', () => {
    it('should get report by id', () => {
      const created = createReport({ message: 'Error' });
      const retrieved = getReport(created.id);

      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent report', () => {
      expect(getReport('nonexistent')).toBeNull();
    });

    it('should get all reports sorted by newest first', () => {
      createReport({ message: 'First' });
      createReport({ message: 'Second' });
      createReport({ message: 'Third' });

      const reports = getAllReports();

      expect(reports.length).toBe(3);
      expect(reports[0].error.message).toBe('Third');
    });

    it('should get reports by status', () => {
      createReport({ message: 'Open' });
      const resolved = createReport({ message: 'Resolved' });
      resolveReport(resolved.id);

      expect(getReportsByStatus('open').length).toBe(1);
      expect(getReportsByStatus('resolved').length).toBe(1);
    });

    it('should get reports by severity', () => {
      createReport({ message: 'Error', type: 'syntax' }); // high
      createReport({ message: 'Error', type: 'validation' }); // low

      expect(getReportsBySeverity('high').length).toBe(1);
      expect(getReportsBySeverity('low').length).toBe(1);
    });

    it('should get open reports', () => {
      createReport({ message: 'Open 1' });
      createReport({ message: 'Open 2' });
      const resolved = createReport({ message: 'Resolved' });
      resolveReport(resolved.id);

      expect(getOpenReports().length).toBe(2);
    });

    it('should set active report', () => {
      const r1 = createReport({ message: 'First' });
      const r2 = createReport({ message: 'Second' });

      setActiveReport(r1.id);

      expect(getActiveReport()?.id).toBe(r1.id);
    });

    it('should return false for non-existent active report', () => {
      expect(setActiveReport('nonexistent')).toBe(false);
    });

    it('should delete report', () => {
      const report = createReport({ message: 'Error' });
      expect(deleteReport(report.id)).toBe(true);
      expect(getReport(report.id)).toBeNull();
    });

    it('should return false when deleting non-existent report', () => {
      expect(deleteReport('nonexistent')).toBe(false);
    });
  });

  describe('Status Updates', () => {
    it('should update status', () => {
      const report = createReport({ message: 'Error' });
      updateStatus(report.id, 'investigating');

      expect(getReport(report.id)?.status).toBe('investigating');
    });

    it('should resolve report', () => {
      const report = createReport({ message: 'Error' });
      resolveReport(report.id);

      const updated = getReport(report.id);
      expect(updated?.status).toBe('resolved');
      expect(updated?.timestamps.resolved).not.toBeNull();
    });

    it('should set severity', () => {
      const report = createReport({ message: 'Error' });
      setSeverity(report.id, 'critical');

      expect(getReport(report.id)?.severity).toBe('critical');
    });

    it('should update lastUpdated timestamp', () => {
      const report = createReport({ message: 'Error' });
      const originalTime = report.timestamps.lastUpdated;

      // Small delay to ensure time difference
      updateStatus(report.id, 'fixing');

      const updated = getReport(report.id);
      expect(updated?.timestamps.lastUpdated).toBeGreaterThanOrEqual(originalTime);
    });
  });

  describe('Attempted Fixes', () => {
    it('should add attempted fix', () => {
      const report = createReport({ message: 'Error' });
      const fix = addAttemptedFix(report.id, 'Tried restarting', false, 'Did not work');

      expect(fix).not.toBeNull();
      expect(fix?.description).toBe('Tried restarting');
      expect(fix?.success).toBe(false);
      expect(fix?.notes).toBe('Did not work');
    });

    it('should track fix timestamp and duration', () => {
      const report = createReport({ message: 'Error' });
      const fix = addAttemptedFix(report.id, 'Fix', true, '', 5000);

      expect(fix?.timestamp).toBeGreaterThan(0);
      expect(fix?.duration).toBe(5000);
    });

    it('should resolve report on successful fix', () => {
      const report = createReport({ message: 'Error' });
      addAttemptedFix(report.id, 'Fixed it', true);

      expect(getReport(report.id)?.status).toBe('resolved');
    });

    it('should set status to fixing on failed fix', () => {
      const report = createReport({ message: 'Error' });
      addAttemptedFix(report.id, 'Tried', false);

      expect(getReport(report.id)?.status).toBe('fixing');
    });

    it('should get attempted fixes', () => {
      const report = createReport({ message: 'Error' });
      addAttemptedFix(report.id, 'Fix 1', false);
      addAttemptedFix(report.id, 'Fix 2', false);
      addAttemptedFix(report.id, 'Fix 3', true);

      expect(getAttemptedFixes(report.id).length).toBe(3);
    });

    it('should get fix count', () => {
      const report = createReport({ message: 'Error' });
      addAttemptedFix(report.id, 'Fix 1', false);
      addAttemptedFix(report.id, 'Fix 2', true);

      expect(getFixCount(report.id)).toBe(2);
    });

    it('should get successful fixes', () => {
      const report = createReport({ message: 'Error' });
      addAttemptedFix(report.id, 'Failed', false);
      addAttemptedFix(report.id, 'Success', true);

      expect(getSuccessfulFixes(report.id).length).toBe(1);
    });

    it('should return null for non-existent report', () => {
      expect(addAttemptedFix('nonexistent', 'Fix', true)).toBeNull();
    });
  });

  describe('Context Updates', () => {
    it('should update context', () => {
      const report = createReport({ message: 'Error' });
      updateContext(report.id, { component: 'NewComponent' });

      expect(getReport(report.id)?.context.component).toBe('NewComponent');
    });

    it('should merge environment', () => {
      const report = createReport(
        { message: 'Error' },
        { environment: { NODE_ENV: 'test' } }
      );
      updateContext(report.id, { environment: { DEBUG: 'true' } });

      const updated = getReport(report.id);
      expect(updated?.context.environment.NODE_ENV).toBe('test');
      expect(updated?.context.environment.DEBUG).toBe('true');
    });

    it('should add context data', () => {
      const report = createReport({ message: 'Error' });
      addContextData(report.id, 'customKey', { value: 42 });

      expect(getReport(report.id)?.context.additionalData.customKey).toEqual({ value: 42 });
    });

    it('should return null for non-existent report', () => {
      expect(updateContext('nonexistent', {})).toBeNull();
    });
  });

  describe('Report Summary', () => {
    it('should get report summary', () => {
      const report = createReport({ message: 'Test error', type: 'runtime' });
      addAttemptedFix(report.id, 'Fix 1', false);

      const summary = getReportSummary(report.id);

      expect(summary?.errorMessage).toBe('Test error');
      expect(summary?.errorType).toBe('runtime');
      expect(summary?.fixAttempts).toBe(1);
      expect(summary?.formattedTime).toBeDefined();
      expect(summary?.age).toBeDefined();
    });

    it('should return null for non-existent report', () => {
      expect(getReportSummary('nonexistent')).toBeNull();
    });

    it('should get all summaries', () => {
      createReport({ message: 'Error 1' });
      createReport({ message: 'Error 2' });

      expect(getAllSummaries().length).toBe(2);
    });
  });

  describe('Report Export', () => {
    it('should export report', () => {
      const report = createReport(
        { message: 'Error', type: 'syntax' },
        { component: 'Test' }
      );

      const exported = exportReport(report.id);

      expect(exported?.error.message).toBe('Error');
      expect(exported?.context.component).toBe('Test');
    });

    it('should return null for non-existent report', () => {
      expect(exportReport('nonexistent')).toBeNull();
    });

    it('should export all reports', () => {
      createReport({ message: 'Error 1' });
      createReport({ message: 'Error 2' });

      expect(exportAllReports().length).toBe(2);
    });

    it('should format report as text', () => {
      const report = createReport(
        { message: 'Test error', type: 'runtime', code: 'ERR_001' },
        { component: 'TestComp' }
      );
      addAttemptedFix(report.id, 'Tried fix', false, 'Did not work');

      const text = formatReportAsText(report.id);

      expect(text).toContain('Error Report');
      expect(text).toContain('Test error');
      expect(text).toContain('runtime');
      expect(text).toContain('ERR_001');
      expect(text).toContain('TestComp');
      expect(text).toContain('Tried fix');
      expect(text).toContain('FAILED');
    });

    it('should return null for non-existent report', () => {
      expect(formatReportAsText('nonexistent')).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should get report count', () => {
      createReport({ message: 'Error 1' });
      createReport({ message: 'Error 2' });
      createReport({ message: 'Error 3' });

      expect(getReportCount()).toBe(3);
    });

    it('should get open count', () => {
      createReport({ message: 'Open 1' });
      createReport({ message: 'Open 2' });
      const resolved = createReport({ message: 'Resolved' });
      resolveReport(resolved.id);

      expect(getOpenCount()).toBe(2);
    });

    it('should get resolved count', () => {
      createReport({ message: 'Open' });
      const r1 = createReport({ message: 'Resolved 1' });
      const r2 = createReport({ message: 'Resolved 2' });
      resolveReport(r1.id);
      resolveReport(r2.id);

      expect(getResolvedCount()).toBe(2);
    });

    it('should get count by type', () => {
      createReport({ message: 'Error', type: 'syntax' });
      createReport({ message: 'Error', type: 'syntax' });
      createReport({ message: 'Error', type: 'runtime' });

      const counts = getCountByType();

      expect(counts.syntax).toBe(2);
      expect(counts.runtime).toBe(1);
    });

    it('should get count by severity', () => {
      createReport({ message: 'Error', type: 'syntax' }); // high
      createReport({ message: 'Error', type: 'runtime' }); // high
      createReport({ message: 'Error', type: 'validation' }); // low

      const counts = getCountBySeverity();

      expect(counts.high).toBe(2);
      expect(counts.low).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old reports', () => {
      setAutoCleanup(false);
      setRetentionMs(0); // Immediate expiry

      createReport({ message: 'Old' });
      createReport({ message: 'Old 2' });

      const cleaned = cleanupOldReports();

      expect(cleaned).toBe(2);
      expect(getReportCount()).toBe(0);
    });

    it('should respect max reports', () => {
      setAutoCleanup(false);
      setMaxReports(2);

      createReport({ message: 'Error 1' });
      createReport({ message: 'Error 2' });
      createReport({ message: 'Error 3' });

      cleanupOldReports();

      expect(getReportCount()).toBe(2);
    });
  });

  describe('Event Handlers', () => {
    it('should notify on report creation', () => {
      const reports: ErrorReport[] = [];
      onReport(report => reports.push(report));

      createReport({ message: 'Error' });

      expect(reports.length).toBe(1);
      expect(reports[0].error.message).toBe('Error');
    });

    it('should unsubscribe handler', () => {
      const reports: ErrorReport[] = [];
      const unsubscribe = onReport(report => reports.push(report));

      createReport({ message: 'Error 1' });
      unsubscribe();
      createReport({ message: 'Error 2' });

      expect(reports.length).toBe(1);
    });
  });

  describe('State', () => {
    it('should return state copy', () => {
      createReport({ message: 'Error' });
      const stateCopy = getState();

      expect(stateCopy.reports.size).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      createReport({ message: 'Error' });
      setMaxReports(5);

      resetErrorReport();

      expect(getReportCount()).toBe(0);
      expect(getState().maxReports).toBe(100);
    });
  });

  describe('Verification: Report includes error, context, attempted fixes, timestamps', () => {
    it('should include error details', () => {
      const report = createReport({
        message: 'Syntax error in component',
        type: 'syntax',
        code: 'SYNTAX_001',
        source: 'Component.tsx',
        line: 42,
        column: 10,
      });

      expect(report.error.message).toBe('Syntax error in component');
      expect(report.error.type).toBe('syntax');
      expect(report.error.code).toBe('SYNTAX_001');
      expect(report.error.source).toBe('Component.tsx');
      expect(report.error.line).toBe(42);
      expect(report.error.column).toBe(10);
    });

    it('should include context information', () => {
      const report = createReport(
        { message: 'Error' },
        {
          component: 'UserForm',
          action: 'submitForm',
          userInput: 'Invalid email format',
          sessionId: 'session_123',
          environment: { NODE_ENV: 'production' },
          additionalData: { userId: 456 },
        }
      );

      expect(report.context.component).toBe('UserForm');
      expect(report.context.action).toBe('submitForm');
      expect(report.context.userInput).toBe('Invalid email format');
      expect(report.context.sessionId).toBe('session_123');
      expect(report.context.environment.NODE_ENV).toBe('production');
      expect(report.context.additionalData.userId).toBe(456);
    });

    it('should include attempted fixes', () => {
      const report = createReport({ message: 'Error' });

      addAttemptedFix(report.id, 'Cleared cache', false, 'Cache was not the issue', 1000);
      addAttemptedFix(report.id, 'Updated dependencies', false, 'Still failing', 5000);
      addAttemptedFix(report.id, 'Fixed import path', true, 'Issue resolved', 2000);

      const fixes = getAttemptedFixes(report.id);

      expect(fixes.length).toBe(3);
      expect(fixes[0].description).toBe('Cleared cache');
      expect(fixes[0].success).toBe(false);
      expect(fixes[0].notes).toBe('Cache was not the issue');
      expect(fixes[0].duration).toBe(1000);
      expect(fixes[2].success).toBe(true);
    });

    it('should include timestamps', () => {
      const beforeCreate = Date.now();
      const report = createReport({ message: 'Error' });
      const afterCreate = Date.now();

      expect(report.timestamps.occurred).toBeGreaterThanOrEqual(beforeCreate);
      expect(report.timestamps.occurred).toBeLessThanOrEqual(afterCreate);
      expect(report.timestamps.reported).toBe(report.timestamps.occurred);
      expect(report.timestamps.lastUpdated).toBe(report.timestamps.occurred);
      expect(report.timestamps.resolved).toBeNull();

      // Resolve and check resolved timestamp
      const beforeResolve = Date.now();
      resolveReport(report.id);
      const afterResolve = Date.now();

      const resolved = getReport(report.id);
      expect(resolved?.timestamps.resolved).toBeGreaterThanOrEqual(beforeResolve);
      expect(resolved?.timestamps.resolved).toBeLessThanOrEqual(afterResolve);
    });

    it('should generate complete text report with all information', () => {
      const report = createReport(
        {
          message: 'Failed to compile',
          type: 'syntax',
          code: 'COMPILE_ERR',
          source: 'App.tsx',
          line: 15,
        },
        {
          component: 'App',
          action: 'compile',
        }
      );

      addAttemptedFix(report.id, 'Fixed syntax', false, 'Wrong fix');
      addAttemptedFix(report.id, 'Correct fix applied', true, 'Resolved');

      const text = formatReportAsText(report.id);

      // Verify all sections present
      expect(text).toContain('Error Report');
      expect(text).toContain('Error');
      expect(text).toContain('Context');
      expect(text).toContain('Attempted Fixes');
      expect(text).toContain('Timestamps');

      // Verify error details
      expect(text).toContain('Failed to compile');
      expect(text).toContain('syntax');
      expect(text).toContain('COMPILE_ERR');
      expect(text).toContain('App.tsx');

      // Verify context
      expect(text).toContain('App');
      expect(text).toContain('compile');

      // Verify fixes
      expect(text).toContain('Fixed syntax');
      expect(text).toContain('FAILED');
      expect(text).toContain('Correct fix applied');
      expect(text).toContain('SUCCESS');
    });
  });
});

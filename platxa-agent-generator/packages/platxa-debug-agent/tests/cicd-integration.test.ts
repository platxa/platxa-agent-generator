/**
 * Tests for CICDIntegration
 *
 * Verifies CI/CD environment detection and report generation.
 * Features #28-30
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  CICDIntegration,
  createCICDIntegration,
  cicdIntegration,
} from '../src/reporting/cicd-integration.js';
import type { DebugResults } from '../src/reporting/report-generator.js';

// =============================================================================
// Test Data
// =============================================================================

function createTestResults(): DebugResults {
  return {
    sessionId: 'test-session-123',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    errors: [
      {
        id: 'err-1',
        message: 'Error in utils',
        type: 'TypeError',
        severity: 'error',
        location: { file: 'src/utils.ts', line: 10 },
      },
      {
        id: 'err-2',
        message: 'Warning in index',
        type: 'Warning',
        severity: 'warning',
        location: { file: 'src/index.ts', line: 20 },
      },
      {
        id: 'err-3',
        message: 'Info message',
        type: 'Info',
        severity: 'info',
        location: { file: 'src/utils.ts', line: 30 },
      },
    ],
    hypotheses: [
      {
        id: 'hyp-1',
        errorId: 'err-1',
        description: 'Variable not defined',
        confidence: 0.9,
        evidence: ['No declaration found'],
      },
    ],
    fixes: [
      {
        id: 'fix-1',
        errorId: 'err-1',
        description: 'Add variable declaration',
        confidence: 0.85,
        autoApplicable: true,
      },
    ],
  };
}

// =============================================================================
// Environment Variable Helpers
// =============================================================================

const originalEnv = { ...process.env };

function setEnv(vars: Record<string, string>): void {
  // Clear CI-related vars first
  clearCIEnv();
  Object.assign(process.env, vars);
}

function clearCIEnv(): void {
  const ciVars = [
    'CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'JENKINS_URL', 'BUILD_ID',
    'CIRCLECI', 'TRAVIS', 'TF_BUILD', 'BITBUCKET_BUILD_NUMBER',
    'TEAMCITY_VERSION', 'DRONE',
    // GitHub
    'GITHUB_RUN_ID', 'GITHUB_RUN_NUMBER', 'GITHUB_REF_NAME', 'GITHUB_SHA',
    'GITHUB_EVENT_NAME', 'GITHUB_REF', 'GITHUB_SERVER_URL', 'GITHUB_REPOSITORY',
    'GITHUB_JOB', 'RUNNER_NAME', 'GITHUB_WORKFLOW', 'GITHUB_ACTOR',
    // GitLab
    'CI_PIPELINE_ID', 'CI_COMMIT_REF_NAME', 'CI_COMMIT_SHA',
    // Jenkins
    'BUILD_NUMBER', 'GIT_BRANCH', 'GIT_COMMIT',
  ];
  for (const v of ciVars) {
    delete process.env[v];
  }
}

function restoreEnv(): void {
  process.env = { ...originalEnv };
}

// =============================================================================
// Tests
// =============================================================================

describe('CICDIntegration', () => {
  beforeEach(() => {
    clearCIEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  // ===========================================================================
  // Feature #28: createCICDIntegration factory
  // ===========================================================================

  describe('Feature #28: createCICDIntegration factory', () => {
    it('should create instance with factory function', () => {
      const integration = createCICDIntegration();
      expect(integration).toBeInstanceOf(CICDIntegration);
    });

    it('should create instance with merged config', () => {
      const integration = createCICDIntegration({
        defaultFormat: 'json',
        errorThreshold: 5,
      });

      expect(integration).toBeInstanceOf(CICDIntegration);

      // Verify config is applied by generating a report
      const results = createTestResults();
      const report = integration.generateReport(results);
      expect(report.format).toBe('json');
    });

    it('should merge config with defaults', () => {
      const integration = createCICDIntegration({
        errorThreshold: 10,
      });

      // Default format should still be checkstyle
      const results = createTestResults();
      const report = integration.generateReport(results);
      expect(report.format).toBe('checkstyle');
    });

    it('should export default instance', () => {
      expect(cicdIntegration).toBeInstanceOf(CICDIntegration);
    });
  });

  // ===========================================================================
  // Feature #29: Environment info in report metadata
  // ===========================================================================

  describe('Feature #29: Environment info in metadata', () => {
    it('should detect local environment when no CI vars set', () => {
      const integration = new CICDIntegration();
      const env = integration.getEnvironment();

      expect(env.name).toBe('local');
      expect(env.isCI).toBe(false);
    });

    it('should detect GitHub Actions', () => {
      setEnv({
        GITHUB_ACTIONS: 'true',
        GITHUB_RUN_ID: '12345',
        GITHUB_RUN_NUMBER: '42',
        GITHUB_REF_NAME: 'main',
        GITHUB_SHA: 'abc123',
        GITHUB_JOB: 'build',
      });

      const integration = new CICDIntegration();
      const env = integration.getEnvironment();

      expect(env.name).toBe('github-actions');
      expect(env.isCI).toBe(true);
      expect(env.buildId).toBe('12345');
      expect(env.buildNumber).toBe('42');
      expect(env.branch).toBe('main');
      expect(env.commit).toBe('abc123');
    });

    it('should detect GitLab CI', () => {
      setEnv({
        GITLAB_CI: 'true',
        CI_PIPELINE_ID: '67890',
        CI_COMMIT_REF_NAME: 'develop',
        CI_COMMIT_SHA: 'def456',
      });

      const integration = new CICDIntegration();
      const env = integration.getEnvironment();

      expect(env.name).toBe('gitlab-ci');
      expect(env.isCI).toBe(true);
      expect(env.buildId).toBe('67890');
      expect(env.branch).toBe('develop');
    });

    it('should detect Jenkins', () => {
      setEnv({
        JENKINS_URL: 'http://jenkins.example.com',
        BUILD_ID: 'jenkins-123',
        BUILD_NUMBER: '100',
        GIT_BRANCH: 'feature/test',
      });

      const integration = new CICDIntegration();
      const env = integration.getEnvironment();

      expect(env.name).toBe('jenkins');
      expect(env.isCI).toBe(true);
      expect(env.buildNumber).toBe('100');
      expect(env.branch).toBe('feature/test');
    });

    it('should detect CircleCI', () => {
      setEnv({
        CIRCLECI: 'true',
        CIRCLE_BUILD_NUM: '55',
        CIRCLE_BRANCH: 'main',
      });

      const integration = new CICDIntegration();
      const env = integration.getEnvironment();

      expect(env.name).toBe('circleci');
      expect(env.isCI).toBe(true);
    });

    it('should detect Travis CI', () => {
      setEnv({
        TRAVIS: 'true',
        TRAVIS_BUILD_NUMBER: '77',
        TRAVIS_BRANCH: 'master',
      });

      const integration = new CICDIntegration();
      const env = integration.getEnvironment();

      expect(env.name).toBe('travis');
      expect(env.isCI).toBe(true);
    });

    it('should detect unknown CI when only CI=true is set', () => {
      setEnv({
        CI: 'true',
        BRANCH: 'test-branch',
      });

      const integration = new CICDIntegration();
      const env = integration.getEnvironment();

      expect(env.name).toBe('unknown');
      expect(env.isCI).toBe(true);
      expect(env.branch).toBe('test-branch');
    });

    it('should include environment in generated report', () => {
      setEnv({
        GITHUB_ACTIONS: 'true',
        GITHUB_RUN_ID: '999',
      });

      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.environment).toBeDefined();
      expect(report.environment.name).toBe('github-actions');
      expect(report.environment.isCI).toBe(true);
    });

    it('should apply environment overrides', () => {
      const integration = new CICDIntegration({
        environmentOverrides: {
          branch: 'custom-branch',
          commit: 'custom-sha',
        },
      });

      const env = integration.getEnvironment();
      expect(env.branch).toBe('custom-branch');
      expect(env.commit).toBe('custom-sha');
    });
  });

  // ===========================================================================
  // Feature #30: Correct counts in report metadata
  // ===========================================================================

  describe('Feature #30: Correct counts in metadata', () => {
    it('should have correct errorCount', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.errorCount).toBe(1); // 1 error severity
    });

    it('should have correct warningCount', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.warningCount).toBe(1); // 1 warning severity
    });

    it('should have correct infoCount', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.infoCount).toBe(1); // 1 info severity
    });

    it('should have correct totalIssues', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.totalIssues).toBe(3); // Total of all errors
    });

    it('should have correct filesAnalyzed', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.filesAnalyzed).toBe(2); // src/utils.ts and src/index.ts
    });

    it('should include timestamp', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.timestamp).toBeInstanceOf(Date);
    });

    it('should include sessionId', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.sessionId).toBe('test-session-123');
    });

    it('should handle empty results', () => {
      const integration = new CICDIntegration();
      const results: DebugResults = {
        sessionId: 'empty',
        timestamp: new Date(),
        errors: [],
        hypotheses: [],
        fixes: [],
      };
      const report = integration.generateReport(results);

      expect(report.errorCount).toBe(0);
      expect(report.warningCount).toBe(0);
      expect(report.infoCount).toBe(0);
      expect(report.totalIssues).toBe(0);
      expect(report.filesAnalyzed).toBe(0);
    });
  });

  // ===========================================================================
  // Report Generation
  // ===========================================================================

  describe('generateReport()', () => {
    it('should generate report in default format', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.format).toBe('checkstyle');
      expect(report.content).toContain('<checkstyle');
    });

    it('should generate report in specified format', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.generateReport(results, 'json');

      expect(report.format).toBe('json');
      expect(() => JSON.parse(report.content)).not.toThrow();
    });

    it('should use configured default format', () => {
      const integration = new CICDIntegration({ defaultFormat: 'sarif' });
      const results = createTestResults();
      const report = integration.generateReport(results);

      expect(report.format).toBe('sarif');
    });
  });

  // ===========================================================================
  // Build Failure Detection
  // ===========================================================================

  describe('shouldFailBuild()', () => {
    it('should not fail with default thresholds and no errors', () => {
      const integration = new CICDIntegration();
      const results: DebugResults = {
        sessionId: 'test',
        timestamp: new Date(),
        errors: [],
        hypotheses: [],
        fixes: [],
      };

      expect(integration.shouldFailBuild(results)).toBe(false);
    });

    it('should fail when errors exceed threshold', () => {
      const integration = new CICDIntegration({ errorThreshold: 0 });
      const results = createTestResults();

      expect(integration.shouldFailBuild(results)).toBe(true);
    });

    it('should not fail when errors at threshold', () => {
      const integration = new CICDIntegration({ errorThreshold: 1 });
      const results = createTestResults();

      expect(integration.shouldFailBuild(results)).toBe(false);
    });

    it('should fail when warnings exceed threshold', () => {
      const integration = new CICDIntegration({ warningThreshold: 0 });
      const results = createTestResults();

      expect(integration.shouldFailBuild(results)).toBe(true);
    });
  });

  describe('getExitCode()', () => {
    it('should return 0 when exitOnErrors is false', () => {
      const integration = new CICDIntegration({ exitOnErrors: false });
      const results = createTestResults();

      expect(integration.getExitCode(results)).toBe(0);
    });

    it('should return 1 when exitOnErrors is true and has errors', () => {
      const integration = new CICDIntegration({
        exitOnErrors: true,
        errorThreshold: 0,
      });
      const results = createTestResults();

      expect(integration.getExitCode(results)).toBe(1);
    });

    it('should return 0 when exitOnErrors is true but below threshold', () => {
      const integration = new CICDIntegration({
        exitOnErrors: true,
        errorThreshold: 10,
      });
      const results = createTestResults();

      expect(integration.getExitCode(results)).toBe(0);
    });
  });

  // ===========================================================================
  // CI-Specific Output
  // ===========================================================================

  describe('outputGitHubAnnotations()', () => {
    it('should generate GitHub Actions annotations', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const annotations = integration.outputGitHubAnnotations(results);

      expect(annotations.length).toBe(3);
      expect(annotations[0]).toContain('::error file=src/utils.ts');
      expect(annotations[1]).toContain('::warning file=src/index.ts');
      expect(annotations[2]).toContain('::notice file=src/utils.ts');
    });
  });

  describe('outputGitLabCodeQuality()', () => {
    it('should generate GitLab Code Quality report', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.outputGitLabCodeQuality(results);

      const parsed = JSON.parse(report);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(3);
      expect(parsed[0].severity).toBe('critical');
      expect(parsed[1].severity).toBe('major');
      expect(parsed[2].severity).toBe('minor');
    });
  });

  describe('getCISpecificReport()', () => {
    it('should return GitHub annotations for GitHub Actions', () => {
      setEnv({ GITHUB_ACTIONS: 'true' });

      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.getCISpecificReport(results);

      expect(report.format).toBe('github-annotations');
      expect(report.content).toContain('::error');
    });

    it('should return GitLab Code Quality for GitLab CI', () => {
      setEnv({ GITLAB_CI: 'true' });

      const integration = new CICDIntegration();
      const results = createTestResults();
      const report = integration.getCISpecificReport(results);

      expect(report.format).toBe('gitlab-code-quality');
      expect(() => JSON.parse(report.content)).not.toThrow();
    });

    it('should return default format for other CI systems', () => {
      setEnv({ CI: 'true' });

      const integration = new CICDIntegration({ defaultFormat: 'checkstyle' });
      const results = createTestResults();
      const report = integration.getCISpecificReport(results);

      expect(report.format).toBe('checkstyle');
    });
  });

  // ===========================================================================
  // PR Comments
  // ===========================================================================

  describe('generatePRComments()', () => {
    it('should delegate to ReportGenerator', () => {
      const integration = new CICDIntegration();
      const results = createTestResults();
      const comments = integration.generatePRComments(results);

      expect(Array.isArray(comments)).toBe(true);
      expect(comments.length).toBeGreaterThan(0);
    });
  });
});

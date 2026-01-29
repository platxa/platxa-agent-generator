/**
 * CI/CD Integration
 *
 * Provides integration with CI/CD pipelines for automated debugging.
 * Supports GitHub Actions, GitLab CI, Jenkins, and other CI platforms.
 * Generates machine-readable reports and integrates with PR comments.
 *
 * @module cicd-integration
 */

import type {
  NormalizedError,
  RootCauseHypothesis,
  FixSuggestion,
  ModuleAnalysisResult,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * CI/CD platform type
 */
export type CICDPlatform =
  | 'github-actions'
  | 'gitlab-ci'
  | 'jenkins'
  | 'circleci'
  | 'azure-devops'
  | 'travis-ci'
  | 'generic';

/**
 * Report format
 */
export type ReportFormat = 'json' | 'sarif' | 'junit' | 'markdown' | 'checkstyle';

/**
 * Severity level for CI/CD reporting
 */
export type CICDSeverity = 'error' | 'warning' | 'note' | 'none';

/**
 * CI/CD environment info
 */
export interface CICDEnvironment {
  /** Platform type */
  platform: CICDPlatform;
  /** CI build ID */
  buildId?: string;
  /** Pipeline/workflow name */
  pipelineName?: string;
  /** Job name */
  jobName?: string;
  /** Branch name */
  branch?: string;
  /** Commit SHA */
  commitSha?: string;
  /** Pull request number */
  pullRequestNumber?: number;
  /** Repository */
  repository?: string;
  /** Additional metadata */
  metadata: Record<string, string>;
}

/**
 * SARIF result
 */
export interface SARIFResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: {
        startLine: number;
        startColumn?: number;
        endLine?: number;
        endColumn?: number;
      };
    };
  }>;
  fixes?: Array<{
    description: { text: string };
    artifactChanges: Array<{
      artifactLocation: { uri: string };
      replacements: Array<{
        deletedRegion: {
          startLine: number;
          startColumn: number;
          endLine: number;
          endColumn: number;
        };
        insertedContent: { text: string };
      }>;
    }>;
  }>;
}

/**
 * SARIF report structure
 */
export interface SARIFReport {
  $schema: string;
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: { text: string };
          fullDescription?: { text: string };
          defaultConfiguration: { level: string };
          helpUri?: string;
        }>;
      };
    };
    results: SARIFResult[];
    invocations?: Array<{
      executionSuccessful: boolean;
      exitCode?: number;
    }>;
  }>;
}

/**
 * JUnit test case
 */
export interface JUnitTestCase {
  name: string;
  classname: string;
  time: number;
  failure?: {
    message: string;
    type: string;
    content: string;
  };
}

/**
 * JUnit test suite
 */
export interface JUnitTestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  testcases: JUnitTestCase[];
}

/**
 * Debug report
 */
export interface DebugReport {
  /** Report format */
  format: ReportFormat;
  /** Report content */
  content: string;
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
  /** Files analyzed */
  filesAnalyzed: number;
  /** Total issues */
  totalIssues: number;
  /** Generation timestamp */
  generatedAt: Date;
  /** CI/CD environment */
  environment?: CICDEnvironment;
}

/**
 * PR comment structure
 */
export interface PRComment {
  /** Comment body in markdown */
  body: string;
  /** File path for inline comment */
  path?: string;
  /** Line number for inline comment */
  line?: number;
  /** Comment type */
  type: 'general' | 'inline' | 'review';
}

/**
 * CI/CD integration configuration
 */
export interface CICDIntegrationConfig {
  /** Platform type */
  platform: CICDPlatform;
  /** Report formats to generate */
  reportFormats: ReportFormat[];
  /** Exit code on errors */
  failOnErrors: boolean;
  /** Exit code on warnings */
  failOnWarnings: boolean;
  /** Minimum severity to report */
  minSeverity: CICDSeverity;
  /** Maximum issues before failure */
  maxIssues?: number;
  /** Generate PR comments */
  generatePRComments: boolean;
  /** Tool name for reports */
  toolName: string;
  /** Tool version */
  toolVersion: string;
  /** Verbose logging */
  verbose: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: CICDIntegrationConfig = {
  platform: 'generic',
  reportFormats: ['sarif', 'markdown'],
  failOnErrors: true,
  failOnWarnings: false,
  minSeverity: 'warning',
  generatePRComments: true,
  toolName: 'platxa-debug-agent',
  toolVersion: '0.1.0',
  verbose: false,
};

// =============================================================================
// Environment Detection
// =============================================================================

/**
 * Build environment object with optional properties
 */
function buildEnvironment(
  platform: CICDPlatform,
  values: {
    buildId?: string | undefined;
    pipelineName?: string | undefined;
    jobName?: string | undefined;
    branch?: string | undefined;
    commitSha?: string | undefined;
    pullRequestNumber?: number | undefined;
    repository?: string | undefined;
  }
): CICDEnvironment {
  const result: CICDEnvironment = {
    platform,
    metadata: {},
  };

  if (values.buildId) result.buildId = values.buildId;
  if (values.pipelineName) result.pipelineName = values.pipelineName;
  if (values.jobName) result.jobName = values.jobName;
  if (values.branch) result.branch = values.branch;
  if (values.commitSha) result.commitSha = values.commitSha;
  if (values.pullRequestNumber !== undefined) result.pullRequestNumber = values.pullRequestNumber;
  if (values.repository) result.repository = values.repository;

  return result;
}

/**
 * Detect CI/CD environment from environment variables
 */
function detectEnvironment(): CICDEnvironment {
  const env = process.env;

  // GitHub Actions
  if (env.GITHUB_ACTIONS === 'true') {
    let prNumber: number | undefined;
    if (env.GITHUB_EVENT_NAME === 'pull_request' && env.GITHUB_REF) {
      const parsed = parseInt(env.GITHUB_REF.split('/')[2] ?? '0', 10);
      if (parsed > 0) prNumber = parsed;
    }

    return buildEnvironment('github-actions', {
      buildId: env.GITHUB_RUN_ID,
      pipelineName: env.GITHUB_WORKFLOW,
      jobName: env.GITHUB_JOB,
      branch: env.GITHUB_REF_NAME ?? env.GITHUB_HEAD_REF,
      commitSha: env.GITHUB_SHA,
      pullRequestNumber: prNumber,
      repository: env.GITHUB_REPOSITORY,
    });
  }

  // GitLab CI
  if (env.GITLAB_CI === 'true') {
    return buildEnvironment('gitlab-ci', {
      buildId: env.CI_PIPELINE_ID,
      pipelineName: env.CI_PIPELINE_NAME,
      jobName: env.CI_JOB_NAME,
      branch: env.CI_COMMIT_REF_NAME,
      commitSha: env.CI_COMMIT_SHA,
      pullRequestNumber: env.CI_MERGE_REQUEST_IID
        ? parseInt(env.CI_MERGE_REQUEST_IID, 10)
        : undefined,
      repository: env.CI_PROJECT_PATH,
    });
  }

  // Jenkins
  if (env.JENKINS_URL) {
    return buildEnvironment('jenkins', {
      buildId: env.BUILD_ID,
      pipelineName: env.JOB_NAME,
      branch: env.GIT_BRANCH ?? env.BRANCH_NAME,
      commitSha: env.GIT_COMMIT,
      pullRequestNumber: env.CHANGE_ID
        ? parseInt(env.CHANGE_ID, 10)
        : undefined,
      repository: env.GIT_URL,
    });
  }

  // CircleCI
  if (env.CIRCLECI === 'true') {
    const repoName = env.CIRCLE_PROJECT_REPONAME;
    const repoUser = env.CIRCLE_PROJECT_USERNAME;
    return buildEnvironment('circleci', {
      buildId: env.CIRCLE_BUILD_NUM,
      pipelineName: repoName,
      jobName: env.CIRCLE_JOB,
      branch: env.CIRCLE_BRANCH,
      commitSha: env.CIRCLE_SHA1,
      pullRequestNumber: env.CIRCLE_PR_NUMBER
        ? parseInt(env.CIRCLE_PR_NUMBER, 10)
        : undefined,
      repository: repoUser && repoName ? `${repoUser}/${repoName}` : undefined,
    });
  }

  // Azure DevOps
  if (env.TF_BUILD === 'True') {
    return buildEnvironment('azure-devops', {
      buildId: env.BUILD_BUILDID,
      pipelineName: env.BUILD_DEFINITIONNAME,
      branch: env.BUILD_SOURCEBRANCHNAME,
      commitSha: env.BUILD_SOURCEVERSION,
      pullRequestNumber: env.SYSTEM_PULLREQUEST_PULLREQUESTID
        ? parseInt(env.SYSTEM_PULLREQUEST_PULLREQUESTID, 10)
        : undefined,
      repository: env.BUILD_REPOSITORY_NAME,
    });
  }

  // Travis CI
  if (env.TRAVIS === 'true') {
    return buildEnvironment('travis-ci', {
      buildId: env.TRAVIS_BUILD_ID,
      branch: env.TRAVIS_BRANCH,
      commitSha: env.TRAVIS_COMMIT,
      pullRequestNumber:
        env.TRAVIS_PULL_REQUEST && env.TRAVIS_PULL_REQUEST !== 'false'
          ? parseInt(env.TRAVIS_PULL_REQUEST, 10)
          : undefined,
      repository: env.TRAVIS_REPO_SLUG,
    });
  }

  // Generic CI
  return buildEnvironment('generic', {
    buildId: env.CI_BUILD_ID ?? env.BUILD_NUMBER,
    branch: env.CI_BRANCH ?? env.GIT_BRANCH ?? env.BRANCH,
    commitSha: env.CI_COMMIT ?? env.GIT_COMMIT ?? env.COMMIT_SHA,
  });
}

// =============================================================================
// CI/CD Integration Class
// =============================================================================

/**
 * CI/CD Integration
 *
 * Provides integration with CI/CD pipelines for automated debugging.
 */
export class CICDIntegration {
  private config: CICDIntegrationConfig;
  private environment: CICDEnvironment;
  private results: ModuleAnalysisResult[];
  private errors: NormalizedError[];
  private hypotheses: RootCauseHypothesis[];
  private fixes: FixSuggestion[];

  constructor(config: Partial<CICDIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.environment = detectEnvironment();
    this.results = [];
    this.errors = [];
    this.hypotheses = [];
    this.fixes = [];
  }

  /**
   * Get detected environment
   */
  getEnvironment(): CICDEnvironment {
    return this.environment;
  }

  /**
   * Add analysis results
   */
  addResults(results: ModuleAnalysisResult[]): void {
    this.results.push(...results);
    for (const result of results) {
      this.errors.push(...result.errors);
      this.hypotheses.push(...result.hypotheses);
      this.fixes.push(...result.fixes);
    }
  }

  /**
   * Add errors directly
   */
  addErrors(errors: NormalizedError[]): void {
    this.errors.push(...errors);
  }

  /**
   * Generate reports in all configured formats
   */
  generateReports(): DebugReport[] {
    const reports: DebugReport[] = [];

    for (const format of this.config.reportFormats) {
      const report = this.generateReport(format);
      reports.push(report);
    }

    return reports;
  }

  /**
   * Generate report in specific format
   */
  generateReport(format: ReportFormat): DebugReport {
    let content: string;

    switch (format) {
      case 'sarif':
        content = this.generateSARIF();
        break;
      case 'junit':
        content = this.generateJUnit();
        break;
      case 'checkstyle':
        content = this.generateCheckstyle();
        break;
      case 'markdown':
        content = this.generateMarkdown();
        break;
      case 'json':
      default:
        content = this.generateJSON();
        break;
    }

    const errorCount = this.errors.filter((e) => e.severity === 'error').length;
    const warningCount = this.errors.filter(
      (e) => e.severity === 'warning'
    ).length;

    return {
      format,
      content,
      errorCount,
      warningCount,
      filesAnalyzed: this.getUniqueFiles().size,
      totalIssues: this.errors.length,
      generatedAt: new Date(),
      environment: this.environment,
    };
  }

  /**
   * Generate SARIF format report
   */
  private generateSARIF(): string {
    const rules = this.getUniqueRules();
    const results = this.errors.map((error) => this.errorToSARIF(error));

    const report: SARIFReport = {
      $schema:
        'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: this.config.toolName,
              version: this.config.toolVersion,
              informationUri: 'https://github.com/platxa/debug-agent',
              rules,
            },
          },
          results,
          invocations: [
            {
              executionSuccessful: this.errors.filter((e) => e.severity === 'error').length === 0,
            },
          ],
        },
      ],
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Convert error to SARIF result
   */
  private errorToSARIF(error: NormalizedError): SARIFResult {
    const result: SARIFResult = {
      ruleId: error.type,
      level: this.mapSeverityToSARIF(error.severity),
      message: { text: error.message },
      locations: [],
    };

    if (error.location) {
      const location: SARIFResult['locations'][0] = {
        physicalLocation: {
          artifactLocation: { uri: error.location.file },
        },
      };

      location.physicalLocation.region = {
        startLine: error.location.line,
      };

      if (error.location.column !== undefined) {
        location.physicalLocation.region.startColumn = error.location.column;
      }
      if (error.location.endLine !== undefined) {
        location.physicalLocation.region.endLine = error.location.endLine;
      }
      if (error.location.endColumn !== undefined) {
        location.physicalLocation.region.endColumn = error.location.endColumn;
      }

      result.locations.push(location);
    }

    return result;
  }

  /**
   * Map severity to SARIF level
   */
  private mapSeverityToSARIF(
    severity: string
  ): 'error' | 'warning' | 'note' | 'none' {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
      case 'hint':
        return 'note';
      default:
        return 'none';
    }
  }

  /**
   * Get unique rules from errors
   */
  private getUniqueRules(): SARIFReport['runs'][0]['tool']['driver']['rules'] {
    const ruleMap = new Map<string, typeof this.errors[0]>();

    for (const error of this.errors) {
      if (!ruleMap.has(error.type)) {
        ruleMap.set(error.type, error);
      }
    }

    return Array.from(ruleMap.entries()).map(([id, error]) => ({
      id,
      name: id,
      shortDescription: { text: error.message.split('\n')[0] ?? error.message },
      defaultConfiguration: {
        level: this.mapSeverityToSARIF(error.severity),
      },
    }));
  }

  /**
   * Generate JUnit format report
   */
  private generateJUnit(): string {
    const fileGroups = this.groupErrorsByFile();
    const suites: JUnitTestSuite[] = [];

    for (const [file, errors] of fileGroups) {
      const testcases: JUnitTestCase[] = errors.map((error) => {
        const testcase: JUnitTestCase = {
          name: `${error.type} at line ${error.location?.line ?? 'unknown'}`,
          classname: file,
          time: 0,
        };

        if (error.severity === 'error') {
          testcase.failure = {
            message: error.message,
            type: error.type,
            content: error.raw,
          };
        }

        return testcase;
      });

      suites.push({
        name: file,
        tests: testcases.length,
        failures: errors.filter((e) => e.severity === 'error').length,
        errors: 0,
        skipped: 0,
        time: 0,
        testcases,
      });
    }

    return this.junitToXML(suites);
  }

  /**
   * Convert JUnit suites to XML
   */
  private junitToXML(suites: JUnitTestSuite[]): string {
    const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
    lines.push('<testsuites>');

    for (const suite of suites) {
      lines.push(
        `  <testsuite name="${this.escapeXML(suite.name)}" tests="${suite.tests}" failures="${suite.failures}" errors="${suite.errors}" skipped="${suite.skipped}" time="${suite.time}">`
      );

      for (const testcase of suite.testcases) {
        if (testcase.failure) {
          lines.push(
            `    <testcase name="${this.escapeXML(testcase.name)}" classname="${this.escapeXML(testcase.classname)}" time="${testcase.time}">`
          );
          lines.push(
            `      <failure message="${this.escapeXML(testcase.failure.message)}" type="${this.escapeXML(testcase.failure.type)}">`
          );
          lines.push(`        ${this.escapeXML(testcase.failure.content)}`);
          lines.push('      </failure>');
          lines.push('    </testcase>');
        } else {
          lines.push(
            `    <testcase name="${this.escapeXML(testcase.name)}" classname="${this.escapeXML(testcase.classname)}" time="${testcase.time}" />`
          );
        }
      }

      lines.push('  </testsuite>');
    }

    lines.push('</testsuites>');
    return lines.join('\n');
  }

  /**
   * Generate Checkstyle format report
   */
  private generateCheckstyle(): string {
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<checkstyle version="8.0">',
    ];

    const fileGroups = this.groupErrorsByFile();

    for (const [file, errors] of fileGroups) {
      lines.push(`  <file name="${this.escapeXML(file)}">`);

      for (const error of errors) {
        const severity =
          error.severity === 'error'
            ? 'error'
            : error.severity === 'warning'
              ? 'warning'
              : 'info';
        lines.push(
          `    <error line="${error.location?.line ?? 1}" column="${error.location?.column ?? 1}" severity="${severity}" message="${this.escapeXML(error.message)}" source="${this.escapeXML(error.type)}" />`
        );
      }

      lines.push('  </file>');
    }

    lines.push('</checkstyle>');
    return lines.join('\n');
  }

  /**
   * Generate Markdown format report
   */
  private generateMarkdown(): string {
    const lines: string[] = [];
    const errorCount = this.errors.filter((e) => e.severity === 'error').length;
    const warningCount = this.errors.filter(
      (e) => e.severity === 'warning'
    ).length;

    // Header
    lines.push('# Debug Analysis Report');
    lines.push('');
    lines.push(`Generated by **${this.config.toolName}** v${this.config.toolVersion}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Errors | ${errorCount} |`);
    lines.push(`| Warnings | ${warningCount} |`);
    lines.push(`| Files Analyzed | ${this.getUniqueFiles().size} |`);
    lines.push(`| Total Issues | ${this.errors.length} |`);
    lines.push('');

    // Environment info
    if (this.environment.platform !== 'generic') {
      lines.push('## CI/CD Environment');
      lines.push('');
      lines.push(`- **Platform**: ${this.environment.platform}`);
      if (this.environment.branch) {
        lines.push(`- **Branch**: ${this.environment.branch}`);
      }
      if (this.environment.commitSha) {
        lines.push(`- **Commit**: \`${this.environment.commitSha.slice(0, 8)}\``);
      }
      if (this.environment.pullRequestNumber) {
        lines.push(`- **PR**: #${this.environment.pullRequestNumber}`);
      }
      lines.push('');
    }

    // Errors
    if (errorCount > 0) {
      lines.push('## Errors');
      lines.push('');
      for (const error of this.errors.filter((e) => e.severity === 'error')) {
        lines.push(`### ${error.type}`);
        lines.push('');
        if (error.location) {
          lines.push(
            `**Location**: \`${error.location.file}:${error.location.line}\``
          );
        }
        lines.push('');
        lines.push('```');
        lines.push(error.message);
        lines.push('```');
        lines.push('');
      }
    }

    // Warnings
    if (warningCount > 0) {
      lines.push('## Warnings');
      lines.push('');
      for (const error of this.errors.filter((e) => e.severity === 'warning')) {
        lines.push(
          `- **${error.type}** at \`${error.location?.file ?? 'unknown'}:${error.location?.line ?? '?'}\`: ${error.message}`
        );
      }
      lines.push('');
    }

    // Hypotheses
    if (this.hypotheses.length > 0) {
      lines.push('## Root Cause Analysis');
      lines.push('');
      for (const hypothesis of this.hypotheses.slice(0, 5)) {
        lines.push(
          `- **${hypothesis.description}** (confidence: ${Math.round(hypothesis.confidence * 100)}%)`
        );
      }
      lines.push('');
    }

    // Suggested fixes
    if (this.fixes.length > 0) {
      lines.push('## Suggested Fixes');
      lines.push('');
      for (const fix of this.fixes.slice(0, 5)) {
        lines.push(
          `- **${fix.description}** (confidence: ${Math.round(fix.confidence * 100)}%)`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate JSON format report
   */
  private generateJSON(): string {
    return JSON.stringify(
      {
        toolName: this.config.toolName,
        toolVersion: this.config.toolVersion,
        environment: this.environment,
        summary: {
          errorCount: this.errors.filter((e) => e.severity === 'error').length,
          warningCount: this.errors.filter((e) => e.severity === 'warning')
            .length,
          filesAnalyzed: this.getUniqueFiles().size,
          totalIssues: this.errors.length,
        },
        errors: this.errors,
        hypotheses: this.hypotheses,
        fixes: this.fixes,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Generate PR comments
   */
  generatePRComments(): PRComment[] {
    if (!this.config.generatePRComments) {
      return [];
    }

    const comments: PRComment[] = [];

    // General summary comment
    const summary = this.generateMarkdown();
    comments.push({
      body: summary,
      type: 'general',
    });

    // Inline comments for errors
    for (const error of this.errors.filter((e) => e.severity === 'error')) {
      if (error.location) {
        comments.push({
          body: `**${error.type}**: ${error.message}`,
          path: error.location.file,
          line: error.location.line,
          type: 'inline',
        });
      }
    }

    return comments;
  }

  /**
   * Determine exit code based on results
   */
  getExitCode(): number {
    const errorCount = this.errors.filter((e) => e.severity === 'error').length;
    const warningCount = this.errors.filter(
      (e) => e.severity === 'warning'
    ).length;

    if (this.config.failOnErrors && errorCount > 0) {
      return 1;
    }

    if (this.config.failOnWarnings && warningCount > 0) {
      return 1;
    }

    if (
      this.config.maxIssues !== undefined &&
      this.errors.length > this.config.maxIssues
    ) {
      return 1;
    }

    return 0;
  }

  /**
   * Group errors by file
   */
  private groupErrorsByFile(): Map<string, NormalizedError[]> {
    const groups = new Map<string, NormalizedError[]>();

    for (const error of this.errors) {
      const file = error.location?.file ?? 'unknown';
      const existing = groups.get(file) ?? [];
      existing.push(error);
      groups.set(file, existing);
    }

    return groups;
  }

  /**
   * Get unique files
   */
  private getUniqueFiles(): Set<string> {
    const files = new Set<string>();
    for (const error of this.errors) {
      if (error.location?.file) {
        files.add(error.location.file);
      }
    }
    return files;
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results = [];
    this.errors = [];
    this.hypotheses = [];
    this.fixes = [];
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    platform: CICDPlatform;
    errors: number;
    warnings: number;
    files: number;
    hypotheses: number;
    fixes: number;
    exitCode: number;
  } {
    return {
      platform: this.environment.platform,
      errors: this.errors.filter((e) => e.severity === 'error').length,
      warnings: this.errors.filter((e) => e.severity === 'warning').length,
      files: this.getUniqueFiles().size,
      hypotheses: this.hypotheses.length,
      fixes: this.fixes.length,
      exitCode: this.getExitCode(),
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create CI/CD integration
 */
export function createCICDIntegration(
  config?: Partial<CICDIntegrationConfig>
): CICDIntegration {
  return new CICDIntegration(config);
}

/**
 * Detect current CI/CD environment
 */
export function detectCICDEnvironment(): CICDEnvironment {
  return detectEnvironment();
}

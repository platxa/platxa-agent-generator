/**
 * CI/CD Integration
 *
 * High-level integration for CI/CD pipelines with environment detection,
 * report generation, and pipeline-specific features.
 *
 * Features #28-30: CI/CD pipeline integration
 *
 * @module reporting/cicd-integration
 */

import {
  ReportGenerator,
  type DebugResults,
  type ReportFormat,
  type PRComment,
  type ReportGeneratorOptions,
} from './report-generator.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported CI/CD environments
 */
export type CIEnvironment =
  | 'github-actions'
  | 'gitlab-ci'
  | 'jenkins'
  | 'circleci'
  | 'travis'
  | 'azure-pipelines'
  | 'bitbucket-pipelines'
  | 'teamcity'
  | 'drone'
  | 'local'
  | 'unknown';

/**
 * Detected CI environment information
 */
export interface CIEnvironmentInfo {
  /** CI system name */
  name: CIEnvironment;
  /** Whether running in CI */
  isCI: boolean;
  /** Build/job ID */
  buildId?: string;
  /** Build number */
  buildNumber?: string;
  /** Branch name */
  branch?: string;
  /** Commit SHA */
  commit?: string;
  /** Pull/Merge request number */
  pullRequest?: string;
  /** Repository URL */
  repoUrl?: string;
  /** Job/workflow name */
  jobName?: string;
  /** Runner/agent name */
  runnerName?: string;
  /** Additional environment-specific data */
  extra?: Record<string, string>;
}

/**
 * Debug report with metadata
 */
export interface DebugReport {
  /** Report content */
  content: string;
  /** Report format */
  format: ReportFormat;
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
  /** Info count */
  infoCount: number;
  /** Total issues */
  totalIssues: number;
  /** Files analyzed */
  filesAnalyzed: number;
  /** Detected CI environment */
  environment: CIEnvironmentInfo;
  /** Generation timestamp */
  timestamp: Date;
  /** Session ID */
  sessionId: string;
}

/**
 * CI/CD integration configuration
 */
export interface CICDIntegrationConfig {
  /** Default report format */
  defaultFormat?: ReportFormat;
  /** Report generator options */
  reportOptions?: ReportGeneratorOptions;
  /** Whether to auto-detect CI environment */
  autoDetectEnvironment?: boolean;
  /** Custom environment overrides */
  environmentOverrides?: Partial<CIEnvironmentInfo>;
  /** Exit code on errors */
  exitOnErrors?: boolean;
  /** Error threshold for failure */
  errorThreshold?: number;
  /** Warning threshold for failure */
  warningThreshold?: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Required<CICDIntegrationConfig> = {
  defaultFormat: 'checkstyle',
  reportOptions: {},
  autoDetectEnvironment: true,
  environmentOverrides: {},
  exitOnErrors: false,
  errorThreshold: 0,
  warningThreshold: Infinity,
};

// =============================================================================
// CI/CD Integration Class
// =============================================================================

/**
 * CI/CD Integration for automated debugging pipelines
 */
export class CICDIntegration {
  private config: Required<CICDIntegrationConfig>;
  private reportGenerator: ReportGenerator;
  private environmentInfo: CIEnvironmentInfo | null = null;

  constructor(config: CICDIntegrationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.reportGenerator = new ReportGenerator(this.config.reportOptions);

    if (this.config.autoDetectEnvironment) {
      this.environmentInfo = this.detectEnvironment();
    }
  }

  // ===========================================================================
  // Environment Detection (Feature #29)
  // ===========================================================================

  /**
   * Detect CI environment from environment variables
   */
  detectEnvironment(): CIEnvironmentInfo {
    const env = process.env;

    // Check for GitHub Actions
    if (env.GITHUB_ACTIONS === 'true') {
      return this.getGitHubActionsInfo(env);
    }

    // Check for GitLab CI
    if (env.GITLAB_CI === 'true') {
      return this.getGitLabCIInfo(env);
    }

    // Check for Jenkins
    if (env.JENKINS_URL || env.BUILD_ID) {
      return this.getJenkinsInfo(env);
    }

    // Check for CircleCI
    if (env.CIRCLECI === 'true') {
      return this.getCircleCIInfo(env);
    }

    // Check for Travis CI
    if (env.TRAVIS === 'true') {
      return this.getTravisCIInfo(env);
    }

    // Check for Azure Pipelines
    if (env.TF_BUILD === 'True') {
      return this.getAzurePipelinesInfo(env);
    }

    // Check for Bitbucket Pipelines
    if (env.BITBUCKET_BUILD_NUMBER) {
      return this.getBitbucketPipelinesInfo(env);
    }

    // Check for TeamCity
    if (env.TEAMCITY_VERSION) {
      return this.getTeamCityInfo(env);
    }

    // Check for Drone CI
    if (env.DRONE === 'true') {
      return this.getDroneCIInfo(env);
    }

    // Check generic CI indicator
    if (env.CI === 'true' || env.CI === '1') {
      const info: CIEnvironmentInfo = { name: 'unknown', isCI: true };
      const branch = env.BRANCH || env.GIT_BRANCH;
      const commit = env.COMMIT || env.GIT_COMMIT;
      if (branch) info.branch = branch;
      if (commit) info.commit = commit;
      return info;
    }

    // Local development
    return { name: 'local', isCI: false };
  }

  private getGitHubActionsInfo(env: NodeJS.ProcessEnv): CIEnvironmentInfo {
    const info: CIEnvironmentInfo = { name: 'github-actions', isCI: true };
    if (env.GITHUB_RUN_ID) info.buildId = env.GITHUB_RUN_ID;
    if (env.GITHUB_RUN_NUMBER) info.buildNumber = env.GITHUB_RUN_NUMBER;
    const branch = env.GITHUB_REF_NAME || env.GITHUB_HEAD_REF;
    if (branch) info.branch = branch;
    if (env.GITHUB_SHA) info.commit = env.GITHUB_SHA;
    if (env.GITHUB_EVENT_NAME === 'pull_request' && env.GITHUB_REF) {
      const prNum = env.GITHUB_REF.split('/')[2];
      if (prNum) info.pullRequest = prNum;
    }
    if (env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY) {
      info.repoUrl = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}`;
    }
    if (env.GITHUB_JOB) info.jobName = env.GITHUB_JOB;
    if (env.RUNNER_NAME) info.runnerName = env.RUNNER_NAME;
    info.extra = {
      workflow: env.GITHUB_WORKFLOW ?? '',
      actor: env.GITHUB_ACTOR ?? '',
      eventName: env.GITHUB_EVENT_NAME ?? '',
    };
    return info;
  }

  private getGitLabCIInfo(env: NodeJS.ProcessEnv): CIEnvironmentInfo {
    const info: CIEnvironmentInfo = { name: 'gitlab-ci', isCI: true };
    if (env.CI_PIPELINE_ID) info.buildId = env.CI_PIPELINE_ID;
    if (env.CI_PIPELINE_IID) info.buildNumber = env.CI_PIPELINE_IID;
    if (env.CI_COMMIT_REF_NAME) info.branch = env.CI_COMMIT_REF_NAME;
    if (env.CI_COMMIT_SHA) info.commit = env.CI_COMMIT_SHA;
    if (env.CI_MERGE_REQUEST_IID) info.pullRequest = env.CI_MERGE_REQUEST_IID;
    if (env.CI_PROJECT_URL) info.repoUrl = env.CI_PROJECT_URL;
    if (env.CI_JOB_NAME) info.jobName = env.CI_JOB_NAME;
    if (env.CI_RUNNER_DESCRIPTION) info.runnerName = env.CI_RUNNER_DESCRIPTION;
    info.extra = {
      projectName: env.CI_PROJECT_NAME ?? '',
      pipelineSource: env.CI_PIPELINE_SOURCE ?? '',
    };
    return info;
  }

  private getJenkinsInfo(env: NodeJS.ProcessEnv): CIEnvironmentInfo {
    const info: CIEnvironmentInfo = { name: 'jenkins', isCI: true };
    if (env.BUILD_ID) info.buildId = env.BUILD_ID;
    if (env.BUILD_NUMBER) info.buildNumber = env.BUILD_NUMBER;
    const branch = env.GIT_BRANCH || env.BRANCH_NAME;
    if (branch) info.branch = branch;
    if (env.GIT_COMMIT) info.commit = env.GIT_COMMIT;
    if (env.CHANGE_ID) info.pullRequest = env.CHANGE_ID;
    if (env.GIT_URL) info.repoUrl = env.GIT_URL;
    if (env.JOB_NAME) info.jobName = env.JOB_NAME;
    if (env.NODE_NAME) info.runnerName = env.NODE_NAME;
    info.extra = {
      jenkinsUrl: env.JENKINS_URL ?? '',
      buildUrl: env.BUILD_URL ?? '',
    };
    return info;
  }

  private getCircleCIInfo(env: NodeJS.ProcessEnv): CIEnvironmentInfo {
    const info: CIEnvironmentInfo = { name: 'circleci', isCI: true };
    if (env.CIRCLE_WORKFLOW_ID) info.buildId = env.CIRCLE_WORKFLOW_ID;
    if (env.CIRCLE_BUILD_NUM) info.buildNumber = env.CIRCLE_BUILD_NUM;
    if (env.CIRCLE_BRANCH) info.branch = env.CIRCLE_BRANCH;
    if (env.CIRCLE_SHA1) info.commit = env.CIRCLE_SHA1;
    if (env.CIRCLE_PULL_REQUEST) {
      const prNum = env.CIRCLE_PULL_REQUEST.split('/').pop();
      if (prNum) info.pullRequest = prNum;
    }
    if (env.CIRCLE_REPOSITORY_URL) info.repoUrl = env.CIRCLE_REPOSITORY_URL;
    if (env.CIRCLE_JOB) info.jobName = env.CIRCLE_JOB;
    info.extra = {
      projectReponame: env.CIRCLE_PROJECT_REPONAME ?? '',
      username: env.CIRCLE_PROJECT_USERNAME ?? '',
    };
    return info;
  }

  private getTravisCIInfo(env: NodeJS.ProcessEnv): CIEnvironmentInfo {
    const info: CIEnvironmentInfo = { name: 'travis', isCI: true };
    if (env.TRAVIS_BUILD_ID) info.buildId = env.TRAVIS_BUILD_ID;
    if (env.TRAVIS_BUILD_NUMBER) info.buildNumber = env.TRAVIS_BUILD_NUMBER;
    if (env.TRAVIS_BRANCH) info.branch = env.TRAVIS_BRANCH;
    if (env.TRAVIS_COMMIT) info.commit = env.TRAVIS_COMMIT;
    if (env.TRAVIS_PULL_REQUEST && env.TRAVIS_PULL_REQUEST !== 'false') {
      info.pullRequest = env.TRAVIS_PULL_REQUEST;
    }
    if (env.TRAVIS_REPO_SLUG) {
      info.repoUrl = `https://github.com/${env.TRAVIS_REPO_SLUG}`;
    }
    if (env.TRAVIS_JOB_NAME) info.jobName = env.TRAVIS_JOB_NAME;
    info.extra = {
      jobId: env.TRAVIS_JOB_ID ?? '',
      eventType: env.TRAVIS_EVENT_TYPE ?? '',
    };
    return info;
  }

  private getAzurePipelinesInfo(env: NodeJS.ProcessEnv): CIEnvironmentInfo {
    const info: CIEnvironmentInfo = { name: 'azure-pipelines', isCI: true };
    if (env.BUILD_BUILDID) info.buildId = env.BUILD_BUILDID;
    if (env.BUILD_BUILDNUMBER) info.buildNumber = env.BUILD_BUILDNUMBER;
    if (env.BUILD_SOURCEBRANCH) {
      info.branch = env.BUILD_SOURCEBRANCH.replace('refs/heads/', '');
    }
    if (env.BUILD_SOURCEVERSION) info.commit = env.BUILD_SOURCEVERSION;
    if (env.SYSTEM_PULLREQUEST_PULLREQUESTID) info.pullRequest = env.SYSTEM_PULLREQUEST_PULLREQUESTID;
    if (env.BUILD_REPOSITORY_URI) info.repoUrl = env.BUILD_REPOSITORY_URI;
    if (env.SYSTEM_JOBDISPLAYNAME) info.jobName = env.SYSTEM_JOBDISPLAYNAME;
    if (env.AGENT_NAME) info.runnerName = env.AGENT_NAME;
    info.extra = {
      definitionName: env.BUILD_DEFINITIONNAME ?? '',
      reason: env.BUILD_REASON ?? '',
    };
    return info;
  }

  private getBitbucketPipelinesInfo(env: NodeJS.ProcessEnv): CIEnvironmentInfo {
    const info: CIEnvironmentInfo = { name: 'bitbucket-pipelines', isCI: true };
    if (env.BITBUCKET_BUILD_NUMBER) info.buildNumber = env.BITBUCKET_BUILD_NUMBER;
    if (env.BITBUCKET_BRANCH) info.branch = env.BITBUCKET_BRANCH;
    if (env.BITBUCKET_COMMIT) info.commit = env.BITBUCKET_COMMIT;
    if (env.BITBUCKET_PR_ID) info.pullRequest = env.BITBUCKET_PR_ID;
    if (env.BITBUCKET_GIT_HTTP_ORIGIN) info.repoUrl = env.BITBUCKET_GIT_HTTP_ORIGIN;
    info.extra = {
      workspace: env.BITBUCKET_WORKSPACE ?? '',
      repoSlug: env.BITBUCKET_REPO_SLUG ?? '',
    };
    return info;
  }

  private getTeamCityInfo(env: NodeJS.ProcessEnv): CIEnvironmentInfo {
    const info: CIEnvironmentInfo = { name: 'teamcity', isCI: true };
    if (env.BUILD_VCS_NUMBER) info.buildId = env.BUILD_VCS_NUMBER;
    if (env.BUILD_NUMBER) info.buildNumber = env.BUILD_NUMBER;
    if (env.TEAMCITY_BUILD_BRANCH) info.branch = env.TEAMCITY_BUILD_BRANCH;
    if (env.TEAMCITY_BUILDCONF_NAME) info.jobName = env.TEAMCITY_BUILDCONF_NAME;
    info.extra = {
      projectName: env.TEAMCITY_PROJECT_NAME ?? '',
    };
    return info;
  }

  private getDroneCIInfo(env: NodeJS.ProcessEnv): CIEnvironmentInfo {
    const info: CIEnvironmentInfo = { name: 'drone', isCI: true };
    if (env.DRONE_BUILD_NUMBER) info.buildId = env.DRONE_BUILD_NUMBER;
    if (env.DRONE_BRANCH) info.branch = env.DRONE_BRANCH;
    if (env.DRONE_COMMIT_SHA) info.commit = env.DRONE_COMMIT_SHA;
    if (env.DRONE_PULL_REQUEST) info.pullRequest = env.DRONE_PULL_REQUEST;
    if (env.DRONE_REPO_LINK) info.repoUrl = env.DRONE_REPO_LINK;
    info.extra = {
      repoName: env.DRONE_REPO_NAME ?? '',
      buildEvent: env.DRONE_BUILD_EVENT ?? '',
    };
    return info;
  }

  /**
   * Get current environment info
   */
  getEnvironment(): CIEnvironmentInfo {
    if (!this.environmentInfo) {
      this.environmentInfo = this.detectEnvironment();
    }

    // Apply overrides
    return {
      ...this.environmentInfo,
      ...this.config.environmentOverrides,
    };
  }

  // ===========================================================================
  // Report Generation (Features #28, #30)
  // ===========================================================================

  /**
   * Generate a debug report with metadata
   * Feature #30: Include correct counts in report metadata
   */
  generateReport(results: DebugResults, format?: ReportFormat): DebugReport {
    const reportFormat = format ?? this.config.defaultFormat;
    const content = this.reportGenerator.generateReport(results, reportFormat);

    // Calculate counts (Feature #30)
    const errorCount = results.errors.filter((e) => e.severity === 'error').length;
    const warningCount = results.errors.filter((e) => e.severity === 'warning').length;
    const infoCount = results.errors.filter((e) => e.severity === 'info').length;
    const totalIssues = results.errors.length;

    // Count unique files
    const uniqueFiles = new Set(results.errors.map((e) => e.location.file));
    const filesAnalyzed = uniqueFiles.size;

    return {
      content,
      format: reportFormat,
      errorCount,
      warningCount,
      infoCount,
      totalIssues,
      filesAnalyzed,
      environment: this.getEnvironment(),
      timestamp: new Date(),
      sessionId: results.sessionId,
    };
  }

  /**
   * Generate PR comments
   */
  generatePRComments(results: DebugResults): PRComment[] {
    return this.reportGenerator.generatePRComments(results);
  }

  /**
   * Check if results should fail the build
   */
  shouldFailBuild(results: DebugResults): boolean {
    const errorCount = results.errors.filter((e) => e.severity === 'error').length;
    const warningCount = results.errors.filter((e) => e.severity === 'warning').length;

    if (errorCount > this.config.errorThreshold) {
      return true;
    }

    if (warningCount > this.config.warningThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Get exit code based on results
   */
  getExitCode(results: DebugResults): number {
    if (!this.config.exitOnErrors) {
      return 0;
    }

    return this.shouldFailBuild(results) ? 1 : 0;
  }

  // ===========================================================================
  // CI-Specific Output
  // ===========================================================================

  /**
   * Output GitHub Actions annotations
   */
  outputGitHubAnnotations(results: DebugResults): string[] {
    const annotations: string[] = [];

    for (const error of results.errors) {
      const level = error.severity === 'error' ? 'error' : error.severity === 'warning' ? 'warning' : 'notice';
      const file = error.location.file;
      const line = error.location.line;
      const col = error.location.column ?? 1;
      const endLine = error.location.endLine ?? line;
      const endCol = error.location.endColumn ?? col;

      annotations.push(
        `::${level} file=${file},line=${line},endLine=${endLine},col=${col},endColumn=${endCol}::${error.message}`
      );
    }

    return annotations;
  }

  /**
   * Output GitLab CI report artifacts format
   */
  outputGitLabCodeQuality(results: DebugResults): string {
    const issues = results.errors.map((error) => ({
      description: error.message,
      check_name: error.ruleId ?? error.type,
      fingerprint: `${error.location.file}:${error.location.line}:${error.type}`,
      severity: error.severity === 'error' ? 'critical' : error.severity === 'warning' ? 'major' : 'minor',
      location: {
        path: error.location.file,
        lines: {
          begin: error.location.line,
          end: error.location.endLine ?? error.location.line,
        },
      },
    }));

    return JSON.stringify(issues, null, 2);
  }

  /**
   * Get CI-specific report format
   */
  getCISpecificReport(results: DebugResults): { format: string; content: string } {
    const env = this.getEnvironment();

    switch (env.name) {
      case 'github-actions':
        return {
          format: 'github-annotations',
          content: this.outputGitHubAnnotations(results).join('\n'),
        };
      case 'gitlab-ci':
        return {
          format: 'gitlab-code-quality',
          content: this.outputGitLabCodeQuality(results),
        };
      default:
        return {
          format: this.config.defaultFormat,
          content: this.reportGenerator.generateReport(results, this.config.defaultFormat),
        };
    }
  }
}

// =============================================================================
// Factory Function (Feature #28)
// =============================================================================

/**
 * Create a CI/CD integration instance with configuration
 * Feature #28: Factory creates instance with merged config
 */
export function createCICDIntegration(
  config?: CICDIntegrationConfig
): CICDIntegration {
  return new CICDIntegration(config);
}

// =============================================================================
// Default Instance
// =============================================================================

/** Default CI/CD integration instance */
export const cicdIntegration = new CICDIntegration();

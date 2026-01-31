/**
 * Troubleshooting Guide for Common Issues
 *
 * Provides structured troubleshooting information for common problems
 * encountered during agent operation, preview rendering, and deployment.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Issue category for troubleshooting.
 */
export type IssueCategory = 'agent' | 'preview' | 'deploy' | 'general';

/**
 * Severity level of an issue.
 */
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * A single troubleshooting step.
 */
export interface TroubleshootingStep {
  /** Step number */
  step: number;
  /** Action to take */
  action: string;
  /** Expected result after this step */
  expectedResult: string;
  /** Command to run (if applicable) */
  command?: string;
}

/**
 * A diagnostic check to identify an issue.
 */
export interface DiagnosticCheck {
  /** Check name */
  name: string;
  /** Description of what this check verifies */
  description: string;
  /** How to perform the check */
  howToCheck: string;
  /** What indicates a problem */
  failureIndicator: string;
}

/**
 * A troubleshooting issue entry.
 */
export interface TroubleshootingIssue {
  /** Unique issue ID */
  id: string;
  /** Issue title */
  title: string;
  /** Issue category */
  category: IssueCategory;
  /** Severity level */
  severity: IssueSeverity;
  /** Symptoms of this issue */
  symptoms: string[];
  /** Possible causes */
  causes: string[];
  /** Diagnostic checks */
  diagnostics: DiagnosticCheck[];
  /** Steps to resolve */
  resolution: TroubleshootingStep[];
  /** Prevention tips */
  prevention: string[];
  /** Related issues */
  relatedIssues?: string[];
}

/**
 * Guide section grouping related issues.
 */
export interface GuideSection {
  /** Section title */
  title: string;
  /** Section description */
  description: string;
  /** Issues in this section */
  issues: TroubleshootingIssue[];
}

/**
 * Complete troubleshooting guide.
 */
export interface TroubleshootingGuide {
  /** Guide version */
  version: string;
  /** Last updated timestamp */
  lastUpdated: string;
  /** Guide sections */
  sections: GuideSection[];
}

// =============================================================================
// Agent Stuck Issues
// =============================================================================

/**
 * Issues related to agent being stuck or unresponsive.
 */
export const agentStuckIssues: TroubleshootingIssue[] = [
  {
    id: 'agent-infinite-loop',
    title: 'Agent Stuck in Infinite Loop',
    category: 'agent',
    severity: 'high',
    symptoms: [
      'Agent repeatedly generates the same output',
      'CPU usage remains high for extended periods',
      'No progress indicator movement',
      'Same error message appearing repeatedly',
    ],
    causes: [
      'Circular dependency in generation logic',
      'Invalid state causing retry loop',
      'Unhandled edge case in prompt processing',
      'Context window exceeded without proper handling',
    ],
    diagnostics: [
      {
        name: 'Check generation logs',
        description: 'Review agent logs for repeated patterns',
        howToCheck: 'Open the agent log panel and look for duplicate entries',
        failureIndicator: 'Same log entry appears more than 5 times in sequence',
      },
      {
        name: 'Monitor context usage',
        description: 'Check if context window is being exceeded',
        howToCheck: 'Check the context meter in the agent status bar',
        failureIndicator: 'Context usage at or above 95%',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Cancel the current operation',
        expectedResult: 'Agent stops processing',
        command: 'Press Ctrl+C or click the Stop button',
      },
      {
        step: 2,
        action: 'Clear the agent context',
        expectedResult: 'Context meter resets to 0%',
        command: 'agent.clearContext()',
      },
      {
        step: 3,
        action: 'Reset agent state',
        expectedResult: 'Agent returns to idle state',
        command: 'agent.reset()',
      },
      {
        step: 4,
        action: 'Retry with simplified prompt',
        expectedResult: 'Agent processes request normally',
      },
    ],
    prevention: [
      'Keep prompts concise and specific',
      'Monitor context usage during long sessions',
      'Use incremental generation for large outputs',
      'Enable automatic context summarization',
    ],
    relatedIssues: ['agent-timeout', 'agent-context-exceeded'],
  },
  {
    id: 'agent-timeout',
    title: 'Agent Request Timeout',
    category: 'agent',
    severity: 'medium',
    symptoms: [
      'Request takes longer than expected',
      'Timeout error message appears',
      'Progress bar stops moving',
      'No response from agent for 60+ seconds',
    ],
    causes: [
      'Network connectivity issues',
      'Server overload or high latency',
      'Request payload too large',
      'Rate limiting applied',
    ],
    diagnostics: [
      {
        name: 'Check network status',
        description: 'Verify network connectivity',
        howToCheck: 'Test connection to API endpoint',
        failureIndicator: 'Connection refused or DNS resolution failure',
      },
      {
        name: 'Review rate limits',
        description: 'Check if rate limits are being applied',
        howToCheck: 'Check response headers for rate limit info',
        failureIndicator: 'X-RateLimit-Remaining is 0',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Wait for timeout to complete',
        expectedResult: 'Timeout error is displayed',
      },
      {
        step: 2,
        action: 'Check network connectivity',
        expectedResult: 'Network is operational',
      },
      {
        step: 3,
        action: 'Retry the request',
        expectedResult: 'Request completes successfully',
      },
      {
        step: 4,
        action: 'If persistent, reduce request size',
        expectedResult: 'Smaller requests complete faster',
      },
    ],
    prevention: [
      'Use smaller, incremental requests',
      'Implement request queuing',
      'Monitor rate limit headers',
      'Set appropriate timeout values',
    ],
    relatedIssues: ['agent-infinite-loop', 'agent-context-exceeded'],
  },
  {
    id: 'agent-context-exceeded',
    title: 'Agent Context Window Exceeded',
    category: 'agent',
    severity: 'high',
    symptoms: [
      'Context exceeded error message',
      'Agent truncates input or output',
      'Incomplete generations',
      'Agent forgets earlier context',
    ],
    causes: [
      'Conversation history too long',
      'Large code files included in context',
      'Multiple large documents referenced',
      'No context management strategy',
    ],
    diagnostics: [
      {
        name: 'Check context size',
        description: 'Measure current context usage',
        howToCheck: 'Call agent.getContextUsage()',
        failureIndicator: 'Usage exceeds 90% of limit',
      },
      {
        name: 'Identify large context items',
        description: 'Find what is consuming context',
        howToCheck: 'Review context breakdown in debug panel',
        failureIndicator: 'Single item using more than 50% of context',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Summarize conversation history',
        expectedResult: 'Context usage reduced',
        command: 'agent.summarizeContext()',
      },
      {
        step: 2,
        action: 'Remove unnecessary context items',
        expectedResult: 'Context freed up for new content',
        command: 'agent.pruneContext({ keepRecent: 5 })',
      },
      {
        step: 3,
        action: 'Start a new session if needed',
        expectedResult: 'Fresh context available',
        command: 'agent.newSession()',
      },
    ],
    prevention: [
      'Enable automatic context summarization',
      'Use context pruning strategies',
      'Reference files by path instead of including content',
      'Break large tasks into smaller sessions',
    ],
    relatedIssues: ['agent-infinite-loop'],
  },
];

// =============================================================================
// Preview Not Updating Issues
// =============================================================================

/**
 * Issues related to preview not updating correctly.
 */
export const previewNotUpdatingIssues: TroubleshootingIssue[] = [
  {
    id: 'preview-stale',
    title: 'Preview Shows Stale Content',
    category: 'preview',
    severity: 'medium',
    symptoms: [
      'Changes not reflected in preview',
      'Preview shows old version of content',
      'Refresh does not update preview',
      'Preview differs from saved file',
    ],
    causes: [
      'Browser cache holding old content',
      'Hot module reload not triggered',
      'File watcher not detecting changes',
      'Build process not completing',
    ],
    diagnostics: [
      {
        name: 'Check file modification time',
        description: 'Verify file was actually saved',
        howToCheck: 'Check file timestamp in file explorer',
        failureIndicator: 'Timestamp is older than recent edit',
      },
      {
        name: 'Check build status',
        description: 'Verify build process completed',
        howToCheck: 'Check build output in terminal',
        failureIndicator: 'Build error or warning present',
      },
      {
        name: 'Check HMR connection',
        description: 'Verify hot reload is connected',
        howToCheck: 'Look for HMR status in browser console',
        failureIndicator: 'HMR disconnected or error messages',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Force refresh the preview',
        expectedResult: 'Preview reloads with fresh content',
        command: 'Ctrl+Shift+R or Cmd+Shift+R',
      },
      {
        step: 2,
        action: 'Clear browser cache',
        expectedResult: 'Cached content is cleared',
        command: 'Clear cache in browser dev tools',
      },
      {
        step: 3,
        action: 'Restart the development server',
        expectedResult: 'Server restarts with fresh state',
        command: 'pnpm dev',
      },
      {
        step: 4,
        action: 'Verify file watcher is running',
        expectedResult: 'Changes are detected automatically',
      },
    ],
    prevention: [
      'Keep development server running during edits',
      'Use incremental builds when possible',
      'Monitor build output for errors',
      'Disable aggressive caching in development',
    ],
    relatedIssues: ['preview-blank', 'preview-error'],
  },
  {
    id: 'preview-blank',
    title: 'Preview Shows Blank Page',
    category: 'preview',
    severity: 'high',
    symptoms: [
      'Preview iframe is completely white',
      'No content renders in preview',
      'Browser console shows errors',
      'Loading indicator never completes',
    ],
    causes: [
      'JavaScript runtime error',
      'Missing required dependencies',
      'Invalid HTML structure',
      'CORS or CSP blocking resources',
    ],
    diagnostics: [
      {
        name: 'Check browser console',
        description: 'Look for JavaScript errors',
        howToCheck: 'Open browser developer tools console',
        failureIndicator: 'Red error messages present',
      },
      {
        name: 'Check network requests',
        description: 'Verify all resources load',
        howToCheck: 'Check Network tab in dev tools',
        failureIndicator: 'Failed requests (4xx or 5xx status)',
      },
      {
        name: 'Validate HTML output',
        description: 'Check if HTML is valid',
        howToCheck: 'View page source or use validator',
        failureIndicator: 'Malformed or empty HTML',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Check browser console for errors',
        expectedResult: 'Error message identifies the problem',
      },
      {
        step: 2,
        action: 'Fix any JavaScript errors',
        expectedResult: 'No errors in console',
      },
      {
        step: 3,
        action: 'Verify all dependencies are installed',
        expectedResult: 'All imports resolve correctly',
        command: 'pnpm install',
      },
      {
        step: 4,
        action: 'Check for CORS/CSP issues',
        expectedResult: 'Resources load without security blocks',
      },
    ],
    prevention: [
      'Use TypeScript for type safety',
      'Implement error boundaries in React',
      'Test components in isolation',
      'Monitor console for warnings during development',
    ],
    relatedIssues: ['preview-stale', 'preview-error'],
  },
  {
    id: 'preview-error',
    title: 'Preview Shows Error Message',
    category: 'preview',
    severity: 'medium',
    symptoms: [
      'Error overlay displayed in preview',
      'Red error message with stack trace',
      'Component fails to render',
      'Build error prevents preview',
    ],
    causes: [
      'Syntax error in code',
      'Type error in TypeScript',
      'Missing or incorrect props',
      'Import path resolution failure',
    ],
    diagnostics: [
      {
        name: 'Read error message',
        description: 'Parse the error overlay text',
        howToCheck: 'Read the error message in the preview',
        failureIndicator: 'Error message indicates specific issue',
      },
      {
        name: 'Check file location',
        description: 'Find the file causing the error',
        howToCheck: 'Look at file path in stack trace',
        failureIndicator: 'Stack trace points to specific line',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Read the error message carefully',
        expectedResult: 'Understand what went wrong',
      },
      {
        step: 2,
        action: 'Navigate to the error location',
        expectedResult: 'Find the problematic code',
      },
      {
        step: 3,
        action: 'Fix the error',
        expectedResult: 'Error overlay disappears',
      },
      {
        step: 4,
        action: 'Save the file to trigger rebuild',
        expectedResult: 'Preview updates correctly',
      },
    ],
    prevention: [
      'Enable strict TypeScript checks',
      'Use ESLint for early error detection',
      'Write unit tests for components',
      'Review changes before saving',
    ],
    relatedIssues: ['preview-stale', 'preview-blank'],
  },
];

// =============================================================================
// Deploy Failing Issues
// =============================================================================

/**
 * Issues related to deployment failures.
 */
export const deployFailingIssues: TroubleshootingIssue[] = [
  {
    id: 'deploy-build-failure',
    title: 'Deployment Fails During Build',
    category: 'deploy',
    severity: 'high',
    symptoms: [
      'Deploy process stops at build step',
      'Build error in deployment logs',
      'CI/CD pipeline fails',
      'Asset generation incomplete',
    ],
    causes: [
      'TypeScript compilation errors',
      'Missing environment variables',
      'Incompatible dependency versions',
      'Memory limit exceeded during build',
    ],
    diagnostics: [
      {
        name: 'Check build logs',
        description: 'Review deployment build output',
        howToCheck: 'Open deployment logs in CI/CD dashboard',
        failureIndicator: 'Error message in build output',
      },
      {
        name: 'Test local build',
        description: 'Verify build works locally',
        howToCheck: 'Run pnpm build locally',
        failureIndicator: 'Build fails locally too',
      },
      {
        name: 'Check environment variables',
        description: 'Verify all env vars are set',
        howToCheck: 'Compare local .env with deployment config',
        failureIndicator: 'Missing required variables',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Run build locally to reproduce',
        expectedResult: 'Same error appears locally',
        command: 'pnpm build',
      },
      {
        step: 2,
        action: 'Fix any compilation errors',
        expectedResult: 'Build completes without errors',
      },
      {
        step: 3,
        action: 'Verify environment variables',
        expectedResult: 'All required vars are set',
      },
      {
        step: 4,
        action: 'Retry deployment',
        expectedResult: 'Deployment succeeds',
      },
    ],
    prevention: [
      'Always test build locally before deploying',
      'Use CI to catch build errors early',
      'Pin dependency versions',
      'Document required environment variables',
    ],
    relatedIssues: ['deploy-timeout', 'deploy-permission-denied'],
  },
  {
    id: 'deploy-timeout',
    title: 'Deployment Times Out',
    category: 'deploy',
    severity: 'high',
    symptoms: [
      'Deployment hangs for extended period',
      'Timeout error in deployment logs',
      'Health check fails',
      'Container fails to start',
    ],
    causes: [
      'Application fails to start',
      'Health check endpoint not responding',
      'Resource limits too low',
      'Database connection issues',
    ],
    diagnostics: [
      {
        name: 'Check application startup',
        description: 'Verify app starts locally',
        howToCheck: 'Run app with production settings locally',
        failureIndicator: 'App fails to start or hangs',
      },
      {
        name: 'Check health endpoint',
        description: 'Verify health check responds',
        howToCheck: 'Curl the health endpoint',
        failureIndicator: 'No response or error status',
      },
      {
        name: 'Check resource usage',
        description: 'Monitor memory and CPU',
        howToCheck: 'Check container metrics',
        failureIndicator: 'Resources at 100%',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Check application logs',
        expectedResult: 'Find what is blocking startup',
      },
      {
        step: 2,
        action: 'Verify health check endpoint exists',
        expectedResult: 'Health endpoint returns 200',
      },
      {
        step: 3,
        action: 'Increase resource limits if needed',
        expectedResult: 'Sufficient resources available',
      },
      {
        step: 4,
        action: 'Check external service connections',
        expectedResult: 'Database and services accessible',
      },
    ],
    prevention: [
      'Implement proper health checks',
      'Set appropriate resource limits',
      'Use connection pooling for databases',
      'Add startup logging for debugging',
    ],
    relatedIssues: ['deploy-build-failure', 'deploy-permission-denied'],
  },
  {
    id: 'deploy-permission-denied',
    title: 'Deployment Permission Denied',
    category: 'deploy',
    severity: 'critical',
    symptoms: [
      'Permission denied error in logs',
      'Authentication failure during deploy',
      'Cannot push to registry',
      'Access denied to deployment target',
    ],
    causes: [
      'Expired or invalid credentials',
      'Insufficient permissions for service account',
      'API token revoked',
      'IP not whitelisted',
    ],
    diagnostics: [
      {
        name: 'Check credentials',
        description: 'Verify deployment credentials',
        howToCheck: 'Test authentication manually',
        failureIndicator: 'Auth fails with same credentials',
      },
      {
        name: 'Check permissions',
        description: 'Verify account permissions',
        howToCheck: 'Review IAM or access settings',
        failureIndicator: 'Required permissions missing',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Verify credentials are valid',
        expectedResult: 'Credentials authenticate successfully',
      },
      {
        step: 2,
        action: 'Check and renew tokens if expired',
        expectedResult: 'Fresh token generated',
      },
      {
        step: 3,
        action: 'Verify permissions are sufficient',
        expectedResult: 'All required permissions granted',
      },
      {
        step: 4,
        action: 'Retry deployment',
        expectedResult: 'Deployment proceeds without auth errors',
      },
    ],
    prevention: [
      'Use service accounts with minimal permissions',
      'Set up credential rotation',
      'Monitor for expiring credentials',
      'Document required permissions',
    ],
    relatedIssues: ['deploy-build-failure', 'deploy-timeout'],
  },
  {
    id: 'deploy-odoo-validation',
    title: 'Odoo Module Validation Fails',
    category: 'deploy',
    severity: 'medium',
    symptoms: [
      'Module validation errors',
      'Manifest file issues',
      'Missing required fields',
      'Incompatible Odoo version',
    ],
    causes: [
      'Invalid manifest.py format',
      'Missing required module metadata',
      'Incompatible dependencies declared',
      'File structure does not match Odoo requirements',
    ],
    diagnostics: [
      {
        name: 'Validate manifest',
        description: 'Check __manifest__.py structure',
        howToCheck: 'Run module validator',
        failureIndicator: 'Validation errors reported',
      },
      {
        name: 'Check file structure',
        description: 'Verify module directory layout',
        howToCheck: 'Compare against Odoo module template',
        failureIndicator: 'Missing required directories or files',
      },
    ],
    resolution: [
      {
        step: 1,
        action: 'Run the module validator',
        expectedResult: 'Get list of validation errors',
        command: 'validateSubmission(modulePath)',
      },
      {
        step: 2,
        action: 'Fix manifest issues',
        expectedResult: 'Manifest passes validation',
      },
      {
        step: 3,
        action: 'Verify file structure',
        expectedResult: 'All required files present',
      },
      {
        step: 4,
        action: 'Retry deployment',
        expectedResult: 'Module deploys successfully',
      },
    ],
    prevention: [
      'Use module templates',
      'Run validation before deployment',
      'Test in staging Odoo instance first',
      'Keep dependencies up to date',
    ],
    relatedIssues: ['deploy-build-failure'],
  },
];

// =============================================================================
// Complete Guide
// =============================================================================

/**
 * Complete troubleshooting guide with all sections.
 */
export const TROUBLESHOOTING_GUIDE: TroubleshootingGuide = {
  version: '1.0.0',
  lastUpdated: '2026-01-31',
  sections: [
    {
      title: 'Agent Issues',
      description: 'Problems related to the AI agent being stuck, timing out, or not responding correctly.',
      issues: agentStuckIssues,
    },
    {
      title: 'Preview Issues',
      description: 'Problems with the live preview not updating, showing blank content, or displaying errors.',
      issues: previewNotUpdatingIssues,
    },
    {
      title: 'Deployment Issues',
      description: 'Problems during the deployment process including build failures, timeouts, and permission errors.',
      issues: deployFailingIssues,
    },
  ],
};

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Gets all issues from the guide.
 */
export function getAllIssues(): TroubleshootingIssue[] {
  return TROUBLESHOOTING_GUIDE.sections.flatMap((s) => s.issues);
}

/**
 * Gets an issue by ID.
 */
export function getIssueById(id: string): TroubleshootingIssue | undefined {
  return getAllIssues().find((issue) => issue.id === id);
}

/**
 * Gets issues by category.
 */
export function getIssuesByCategory(category: IssueCategory): TroubleshootingIssue[] {
  return getAllIssues().filter((issue) => issue.category === category);
}

/**
 * Gets issues by severity.
 */
export function getIssuesBySeverity(severity: IssueSeverity): TroubleshootingIssue[] {
  return getAllIssues().filter((issue) => issue.severity === severity);
}

/**
 * Searches issues by symptom text.
 */
export function searchBySymptom(symptomText: string): TroubleshootingIssue[] {
  const lower = symptomText.toLowerCase();
  return getAllIssues().filter((issue) =>
    issue.symptoms.some((s) => s.toLowerCase().includes(lower)),
  );
}

/**
 * Searches issues by keyword in title, symptoms, or causes.
 */
export function searchIssues(query: string): TroubleshootingIssue[] {
  const lower = query.toLowerCase();
  return getAllIssues().filter((issue) =>
    issue.title.toLowerCase().includes(lower) ||
    issue.symptoms.some((s) => s.toLowerCase().includes(lower)) ||
    issue.causes.some((c) => c.toLowerCase().includes(lower)),
  );
}

/**
 * Gets related issues for a given issue.
 */
export function getRelatedIssues(issueId: string): TroubleshootingIssue[] {
  const issue = getIssueById(issueId);
  if (!issue || !issue.relatedIssues) return [];
  return issue.relatedIssues
    .map((id) => getIssueById(id))
    .filter((i): i is TroubleshootingIssue => i !== undefined);
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Formats an issue as markdown.
 */
export function formatIssueAsMarkdown(issue: TroubleshootingIssue): string {
  const lines: string[] = [];

  lines.push(`## ${issue.title}`);
  lines.push('');
  lines.push(`**Category:** ${issue.category} | **Severity:** ${issue.severity}`);
  lines.push('');

  lines.push('### Symptoms');
  for (const symptom of issue.symptoms) {
    lines.push(`- ${symptom}`);
  }
  lines.push('');

  lines.push('### Possible Causes');
  for (const cause of issue.causes) {
    lines.push(`- ${cause}`);
  }
  lines.push('');

  lines.push('### Diagnostics');
  for (const diag of issue.diagnostics) {
    lines.push(`#### ${diag.name}`);
    lines.push(diag.description);
    lines.push(`- **How to check:** ${diag.howToCheck}`);
    lines.push(`- **Failure indicator:** ${diag.failureIndicator}`);
    lines.push('');
  }

  lines.push('### Resolution Steps');
  for (const step of issue.resolution) {
    lines.push(`${step.step}. **${step.action}**`);
    lines.push(`   - Expected: ${step.expectedResult}`);
    if (step.command) {
      lines.push(`   - Command: \`${step.command}\``);
    }
  }
  lines.push('');

  lines.push('### Prevention');
  for (const tip of issue.prevention) {
    lines.push(`- ${tip}`);
  }

  if (issue.relatedIssues && issue.relatedIssues.length > 0) {
    lines.push('');
    lines.push('### Related Issues');
    lines.push(issue.relatedIssues.join(', '));
  }

  return lines.join('\n');
}

/**
 * Formats the entire guide as markdown.
 */
export function formatGuideAsMarkdown(): string {
  const lines: string[] = [];

  lines.push('# Troubleshooting Guide');
  lines.push('');
  lines.push(`Version: ${TROUBLESHOOTING_GUIDE.version} | Last Updated: ${TROUBLESHOOTING_GUIDE.lastUpdated}`);
  lines.push('');

  lines.push('## Table of Contents');
  lines.push('');
  for (const section of TROUBLESHOOTING_GUIDE.sections) {
    lines.push(`### ${section.title}`);
    for (const issue of section.issues) {
      lines.push(`- [${issue.title}](#${issue.id})`);
    }
  }
  lines.push('');

  for (const section of TROUBLESHOOTING_GUIDE.sections) {
    lines.push('---');
    lines.push('');
    lines.push(`# ${section.title}`);
    lines.push('');
    lines.push(section.description);
    lines.push('');

    for (const issue of section.issues) {
      lines.push(formatIssueAsMarkdown(issue));
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Formats issue as compact string for quick reference.
 */
export function formatIssueCompact(issue: TroubleshootingIssue): string {
  const severityIcon = {
    low: '○',
    medium: '◐',
    high: '●',
    critical: '◉',
  };
  return `${severityIcon[issue.severity]} [${issue.category}] ${issue.title} - ${issue.symptoms[0]}`;
}

// =============================================================================
// Diagnostic Runner
// =============================================================================

/**
 * Result of running diagnostics.
 */
export interface DiagnosticResult {
  /** Issue being diagnosed */
  issueId: string;
  /** Check name */
  checkName: string;
  /** Whether the check passed */
  passed: boolean;
  /** Result message */
  message: string;
}

/**
 * Runs diagnostics for symptoms and returns matching issues.
 */
export function diagnoseSymptoms(symptoms: string[]): TroubleshootingIssue[] {
  const matchedIssues = new Map<string, number>();

  for (const symptom of symptoms) {
    const matches = searchBySymptom(symptom);
    for (const match of matches) {
      matchedIssues.set(match.id, (matchedIssues.get(match.id) || 0) + 1);
    }
  }

  // Sort by number of matching symptoms
  const sorted = [...matchedIssues.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => getIssueById(id))
    .filter((i): i is TroubleshootingIssue => i !== undefined);

  return sorted;
}

/**
 * Gets quick fixes for an issue.
 */
export function getQuickFixes(issueId: string): string[] {
  const issue = getIssueById(issueId);
  if (!issue) return [];

  return issue.resolution
    .filter((step) => step.command)
    .map((step) => step.command!);
}

// =============================================================================
// Summary Statistics
// =============================================================================

/**
 * Guide statistics.
 */
export interface GuideStats {
  /** Total issues documented */
  totalIssues: number;
  /** Issues by category */
  byCategory: Record<IssueCategory, number>;
  /** Issues by severity */
  bySeverity: Record<IssueSeverity, number>;
  /** Total resolution steps */
  totalSteps: number;
  /** Total diagnostic checks */
  totalDiagnostics: number;
}

/**
 * Computes guide statistics.
 */
export function computeGuideStats(): GuideStats {
  const issues = getAllIssues();

  const byCategory: Record<IssueCategory, number> = {
    agent: 0,
    preview: 0,
    deploy: 0,
    general: 0,
  };

  const bySeverity: Record<IssueSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  let totalSteps = 0;
  let totalDiagnostics = 0;

  for (const issue of issues) {
    byCategory[issue.category]++;
    bySeverity[issue.severity]++;
    totalSteps += issue.resolution.length;
    totalDiagnostics += issue.diagnostics.length;
  }

  return {
    totalIssues: issues.length,
    byCategory,
    bySeverity,
    totalSteps,
    totalDiagnostics,
  };
}

/**
 * Security Code Scanner - Detect vulnerabilities in AI-generated code
 *
 * Scans generated Odoo themes for common security issues:
 * - XSS vulnerabilities
 * - SQL injection patterns
 * - Path traversal attempts
 * - Dangerous function calls
 * - Hardcoded credentials
 */

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityIssue {
  id: string;
  severity: SeverityLevel;
  category: string;
  message: string;
  file: string;
  line?: number;
  column?: number;
  snippet?: string;
  recommendation: string;
}

export interface ScanResult {
  passed: boolean;
  issues: SecurityIssue[];
  scannedFiles: number;
  scanDuration: number;
}

interface ScanRule {
  id: string;
  name: string;
  severity: SeverityLevel;
  category: string;
  pattern: RegExp;
  message: string;
  recommendation: string;
  fileTypes?: string[];
}

/**
 * Security scanning rules
 */
const SCAN_RULES: ScanRule[] = [
  // XSS Vulnerabilities
  {
    id: 'XSS-001',
    name: 'Unescaped Output (t-raw)',
    severity: 'high',
    category: 'XSS',
    pattern: /t-raw\s*=\s*["'][^"']*\b(user|input|request|param|query)/gi,
    message: 'Potentially unsafe t-raw with user-controlled data',
    recommendation: 'Use t-esc instead of t-raw for user-controlled content',
    fileTypes: ['.xml'],
  },
  {
    id: 'XSS-005',
    name: 'Unescaped Output (t-out)',
    severity: 'high',
    category: 'XSS',
    pattern: /t-out\s*=\s*["'][^"']*\b(user|input|request|param|query|record\.\w+_html)/gi,
    message: 'Potentially unsafe t-out with user-controlled or HTML data',
    recommendation: 'Use t-esc for user content or sanitize HTML fields before output',
    fileTypes: ['.xml'],
  },
  {
    id: 'XSS-006',
    name: 'Raw HTML Field Output',
    severity: 'medium',
    category: 'XSS',
    pattern: /t-(?:raw|out)\s*=\s*["'](?:record|object|doc)\.\w*(?:html|content|body|description)/gi,
    message: 'Outputting HTML field without sanitization check',
    recommendation: 'Ensure HTML fields are sanitized in the model or use t-field with widget',
    fileTypes: ['.xml'],
  },
  {
    id: 'XSS-002',
    name: 'Inline Event Handler',
    severity: 'medium',
    category: 'XSS',
    pattern: /\bon\w+\s*=\s*["'][^"']*\$/gi,
    message: 'Inline event handler with dynamic content',
    recommendation: 'Move event handlers to external JavaScript files',
    fileTypes: ['.xml', '.html'],
  },
  {
    id: 'XSS-003',
    name: 'JavaScript URL',
    severity: 'high',
    category: 'XSS',
    pattern: /href\s*=\s*["']javascript:/gi,
    message: 'JavaScript URL protocol can lead to XSS',
    recommendation: 'Use proper event handlers instead of javascript: URLs',
    fileTypes: ['.xml', '.html'],
  },
  {
    id: 'XSS-004',
    name: 'Unsafe innerHTML Pattern',
    severity: 'high',
    category: 'XSS',
    pattern: /\.innerHTML\s*=|\.outerHTML\s*=/gi,
    message: 'Direct innerHTML assignment can lead to XSS',
    recommendation: 'Use textContent or sanitize HTML before insertion',
    fileTypes: ['.js', '.ts'],
  },

  // SQL Injection
  {
    id: 'SQL-001',
    name: 'Raw SQL Query',
    severity: 'critical',
    category: 'SQL Injection',
    pattern: /\.execute\s*\(\s*["'`].*(%s|%d|\+\s*\w+|'\s*\+)/gi,
    message: 'Potential SQL injection via string concatenation',
    recommendation: 'Use parameterized queries with proper escaping',
    fileTypes: ['.py'],
  },
  {
    id: 'SQL-002',
    name: 'ORM Raw Query',
    severity: 'high',
    category: 'SQL Injection',
    pattern: /\._cr\.execute\s*\(\s*["'`].*\+/gi,
    message: 'Raw cursor query with string concatenation',
    recommendation: 'Use ORM methods or parameterized queries',
    fileTypes: ['.py'],
  },
  {
    id: 'SQL-003',
    name: 'Unsafe Search Domain',
    severity: 'medium',
    category: 'SQL Injection',
    pattern: /\.search\s*\(\s*\[\s*\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]+['"]\s*,\s*\w+\s*\+/gi,
    message: 'Dynamic value in search domain without validation',
    recommendation: 'Validate and sanitize domain values',
    fileTypes: ['.py'],
  },

  // Path Traversal
  {
    id: 'PATH-001',
    name: 'Path Traversal Pattern',
    severity: 'critical',
    category: 'Path Traversal',
    pattern: /\.\.\//g,
    message: 'Path traversal pattern detected',
    recommendation: 'Remove or sanitize path traversal sequences',
    fileTypes: ['.py', '.js', '.ts', '.xml'],
  },
  {
    id: 'PATH-002',
    name: 'Absolute Path Reference',
    severity: 'medium',
    category: 'Path Traversal',
    pattern: /["'](\/etc\/|\/var\/|\/tmp\/|C:\\|\/home\/)/gi,
    message: 'Hardcoded absolute path detected',
    recommendation: 'Use relative paths or configuration variables',
    fileTypes: ['.py', '.js', '.ts'],
  },

  // Dangerous Functions
  {
    id: 'EXEC-001',
    name: 'Code Execution',
    severity: 'critical',
    category: 'Code Execution',
    pattern: /\beval\s*\(|\bexec\s*\(|\bcompile\s*\(/gi,
    message: 'Dynamic code execution detected',
    recommendation: 'Avoid eval/exec; use safer alternatives',
    fileTypes: ['.py', '.js', '.ts'],
  },
  {
    id: 'EXEC-002',
    name: 'Shell Command',
    severity: 'critical',
    category: 'Code Execution',
    pattern: /subprocess\.(call|run|Popen)\s*\(|os\.system\s*\(|os\.popen\s*\(/gi,
    message: 'Shell command execution detected',
    recommendation: 'Validate and sanitize all shell command inputs',
    fileTypes: ['.py'],
  },
  {
    id: 'EXEC-003',
    name: 'Unsafe Deserialization',
    severity: 'critical',
    category: 'Code Execution',
    pattern: /pickle\.loads?\s*\(|yaml\.load\s*\([^,)]+\)/gi,
    message: 'Unsafe deserialization can lead to RCE',
    recommendation: 'Use yaml.safe_load() or avoid pickle for untrusted data',
    fileTypes: ['.py'],
  },

  // Credentials
  {
    id: 'CRED-001',
    name: 'Hardcoded Password',
    severity: 'critical',
    category: 'Credentials',
    pattern: /password\s*[:=]\s*["'][^"']{4,}["']/gi,
    message: 'Hardcoded password detected',
    recommendation: 'Use environment variables or secrets management',
  },
  {
    id: 'CRED-002',
    name: 'Hardcoded API Key',
    severity: 'critical',
    category: 'Credentials',
    pattern: /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9_-]{20,}["']/gi,
    message: 'Hardcoded API key detected',
    recommendation: 'Use environment variables for API keys',
  },
  {
    id: 'CRED-003',
    name: 'Private Key Material',
    severity: 'critical',
    category: 'Credentials',
    pattern: /-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
    message: 'Private key material in code',
    recommendation: 'Store private keys securely outside codebase',
  },

  // Odoo-Specific
  {
    id: 'ODOO-001',
    name: 'Unsafe sudo()',
    severity: 'high',
    category: 'Authorization',
    pattern: /\.sudo\(\)\.(?!browse|search|read|exists)/gi,
    message: 'sudo() with write operations bypasses access controls',
    recommendation: 'Verify sudo() usage is intentional and necessary',
    fileTypes: ['.py'],
  },
  {
    id: 'ODOO-002',
    name: 'Missing Access Rights',
    severity: 'medium',
    category: 'Authorization',
    pattern: /<record[^>]*model\s*=\s*["']ir\.model\.access["'][^>]*>[^<]*<\/record>/gi,
    message: 'Access rights record should have proper permissions',
    recommendation: 'Verify access rights are correctly configured',
    fileTypes: ['.xml'],
  },

  // Information Disclosure
  {
    id: 'INFO-001',
    name: 'Debug Mode',
    severity: 'medium',
    category: 'Information Disclosure',
    pattern: /DEBUG\s*=\s*True|debug\s*=\s*true/gi,
    message: 'Debug mode enabled',
    recommendation: 'Disable debug mode in production',
  },
  {
    id: 'INFO-002',
    name: 'Stack Trace Exposure',
    severity: 'medium',
    category: 'Information Disclosure',
    pattern: /traceback\.print_exc|print\(.*traceback|console\.log\(.*error\.stack/gi,
    message: 'Stack trace may be exposed to users',
    recommendation: 'Log errors server-side, show generic messages to users',
  },
];

/**
 * Scan a single file for security issues
 */
export function scanFile(
  filePath: string,
  content: string
): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  const extension = '.' + (filePath.split('.').pop() || '');
  const lines = content.split('\n');

  for (const rule of SCAN_RULES) {
    // Check if rule applies to this file type
    if (rule.fileTypes && !rule.fileTypes.includes(extension)) {
      continue;
    }

    // Scan each line
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const matches = line.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags));

      for (const match of matches) {
        issues.push({
          id: rule.id,
          severity: rule.severity,
          category: rule.category,
          message: rule.message,
          file: filePath,
          line: lineNum + 1,
          column: match.index,
          snippet: line.trim().substring(0, 100),
          recommendation: rule.recommendation,
        });
      }
    }
  }

  return issues;
}

/**
 * Scan multiple files for security issues
 */
export function scanFiles(
  files: Array<{ path: string; content: string }>
): ScanResult {
  const startTime = Date.now();
  const allIssues: SecurityIssue[] = [];

  for (const file of files) {
    const fileIssues = scanFile(file.path, file.content);
    allIssues.push(...fileIssues);
  }

  // Sort by severity
  const severityOrder: Record<SeverityLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const hasCritical = allIssues.some(i => i.severity === 'critical');
  const hasHigh = allIssues.some(i => i.severity === 'high');

  return {
    passed: !hasCritical && !hasHigh,
    issues: allIssues,
    scannedFiles: files.length,
    scanDuration: Date.now() - startTime,
  };
}

/**
 * Get summary statistics for scan results
 */
export function getScanSummary(result: ScanResult): Record<SeverityLevel, number> {
  const summary: Record<SeverityLevel, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const issue of result.issues) {
    summary[issue.severity]++;
  }

  return summary;
}

/**
 * Format scan results as a report
 */
export function formatScanReport(result: ScanResult): string {
  const summary = getScanSummary(result);
  const lines: string[] = [
    '=== Security Scan Report ===',
    `Files scanned: ${result.scannedFiles}`,
    `Duration: ${result.scanDuration}ms`,
    `Status: ${result.passed ? 'PASSED' : 'FAILED'}`,
    '',
    'Issues by severity:',
    `  Critical: ${summary.critical}`,
    `  High: ${summary.high}`,
    `  Medium: ${summary.medium}`,
    `  Low: ${summary.low}`,
    `  Info: ${summary.info}`,
  ];

  if (result.issues.length > 0) {
    lines.push('', 'Details:');
    for (const issue of result.issues) {
      lines.push(`  [${issue.severity.toUpperCase()}] ${issue.id}: ${issue.message}`);
      lines.push(`    File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
      if (issue.snippet) {
        lines.push(`    Code: ${issue.snippet}`);
      }
      lines.push(`    Fix: ${issue.recommendation}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

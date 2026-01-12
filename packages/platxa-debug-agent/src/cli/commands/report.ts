/**
 * Report command - Generate a debugging report
 */

import { writeFileSync } from 'node:fs';
import { getSharedDashboard } from '../../core/metrics-dashboard.js';
import type { MetricsPeriod } from '../../core/metrics-dashboard.js';

export interface ReportOptions {
  format?: 'html' | 'markdown' | 'json' | 'sarif';
  output?: string;
  session?: string;
  all?: boolean;
}

export async function reportCommand(
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as ReportOptions;
  const format = opts.format ?? 'markdown';

  // Get dashboard and generate metrics
  const dashboard = getSharedDashboard();
  const period: MetricsPeriod = opts.all ? 'day' : 'hour';

  let reportContent: string;

  if (format === 'json') {
    reportContent = dashboard.export('json', period);
  } else if (format === 'markdown') {
    reportContent = dashboard.export('markdown', period);
  } else if (format === 'html') {
    reportContent = generateHTMLReport(dashboard, period);
  } else if (format === 'sarif') {
    reportContent = JSON.stringify(generateSARIFReport(dashboard), null, 2);
  } else {
    reportContent = dashboard.export('markdown', period);
  }

  if (opts.output) {
    writeFileSync(opts.output, reportContent);
    console.log(`Report written to: ${opts.output}`);
  } else {
    console.log(reportContent);
  }
}

function generateHTMLReport(
  dashboard: ReturnType<typeof getSharedDashboard>,
  period: MetricsPeriod
): string {
  const stats = dashboard.getStats();
  const markdownContent = dashboard.export('markdown', period);

  return `<!DOCTYPE html>
<html>
<head>
  <title>Platxa Debug Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.6; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { color: #555; margin-top: 2rem; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .stat-card { background: #f9f9f9; padding: 1rem; border-radius: 4px; border-left: 4px solid #007bff; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #007bff; }
    .stat-label { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Platxa Debug Agent Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${stats.totalSessions}</div>
      <div class="stat-label">Total Sessions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.errorPatterns}</div>
      <div class="stat-label">Error Patterns</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.fixPatterns}</div>
      <div class="stat-label">Fix Patterns</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.performanceSamples}</div>
      <div class="stat-label">Performance Samples</div>
    </div>
  </div>

  <h2>Detailed Metrics</h2>
  <pre>${escapeHtml(markdownContent)}</pre>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateSARIFReport(
  dashboard: ReturnType<typeof getSharedDashboard>
): object {
  const stats = dashboard.getStats();

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'platxa-debug-agent',
          version: '0.1.0',
          informationUri: 'https://github.com/platxa/platxa-debug-agent',
          properties: {
            totalSessions: stats.totalSessions,
            errorPatterns: stats.errorPatterns,
            fixPatterns: stats.fixPatterns,
          },
        },
      },
      results: [],
    }],
  };
}

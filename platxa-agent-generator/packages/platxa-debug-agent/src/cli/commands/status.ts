/**
 * Status command - Show current debugging session status
 */

import { getSharedDashboard } from '../../core/metrics-dashboard.js';

export interface StatusOptions {
  metrics?: boolean;
  history?: boolean;
}

export async function statusCommand(
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as StatusOptions;

  const dashboard = getSharedDashboard();
  const stats = dashboard.getStats();

  console.log(`\n=== Platxa Debug Agent Status ===\n`);
  console.log(`Version: 0.1.0`);
  console.log(`Status: Ready`);

  console.log(`\n--- Session Summary ---`);
  console.log(`Total sessions: ${stats.totalSessions}`);
  console.log(`Error patterns tracked: ${stats.errorPatterns}`);
  console.log(`Fix patterns tracked: ${stats.fixPatterns}`);

  if (opts.metrics) {
    console.log(`\n--- Detailed Metrics ---`);
    console.log(`Performance samples: ${stats.performanceSamples}`);
    console.log(`Last cleanup: ${stats.lastCleanup.toISOString()}`);

    // Export full dashboard metrics
    const dashboardExport = dashboard.export('markdown', 'hour');
    console.log(`\n${dashboardExport}`);
  }

  if (opts.history) {
    console.log(`\n--- Session History ---`);
    const historyExport = dashboard.export('markdown', 'day');
    console.log(historyExport);
  }

  console.log(`\n--- Available Commands ---`);
  console.log(`  analyze  - Analyze an error message`);
  console.log(`  rca      - Root cause analysis`);
  console.log(`  fix      - Generate fix suggestions`);
  console.log(`  watch    - Watch logs in real-time`);
  console.log(`  report   - Generate debugging report`);
  console.log(`  init     - Initialize project configuration`);
  console.log(`  config   - Manage configuration`);
}

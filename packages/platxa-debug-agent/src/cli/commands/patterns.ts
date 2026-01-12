/**
 * Patterns command - Manage error patterns and fix templates
 *
 * Lists, exports, and manages error patterns tracked by the debug agent.
 * Patterns are used to improve fix suggestions and analysis.
 */

import { writeFileSync } from 'node:fs';
import { getSharedDashboard } from '../../core/metrics-dashboard.js';
import type { MetricsPeriod, ErrorPatternMetrics, FixEffectivenessMetrics } from '../../core/metrics-dashboard.js';

export interface PatternsOptions {
  action?: 'list' | 'export' | 'clear' | 'stats';
  format?: 'json' | 'text' | 'csv';
  output?: string;
  period?: 'hour' | 'day' | 'week' | 'all';
}

export async function patternsCommand(
  options: Record<string, unknown>
): Promise<void> {
  const opts = options as PatternsOptions;
  const action = opts.action ?? 'list';
  const format = opts.format ?? 'text';
  const period: MetricsPeriod = (opts.period as MetricsPeriod) ?? 'day';

  const dashboard = getSharedDashboard();
  const metrics = dashboard.generateDashboard(period);

  console.log(`\n=== Error Patterns ===\n`);

  if (action === 'stats') {
    const stats = dashboard.getStats();
    console.log(`Total Sessions: ${stats.totalSessions}`);
    console.log(`Error Patterns Tracked: ${stats.errorPatterns}`);
    console.log(`Fix Patterns Tracked: ${stats.fixPatterns}`);
    console.log(`Performance Samples: ${stats.performanceSamples}`);
    return;
  }

  if (action === 'clear') {
    console.log(`Pattern clearing is not implemented in this version.`);
    console.log(`Patterns are reset when the process restarts.`);
    return;
  }

  if (action === 'export' || action === 'list') {
    const patterns = metrics.topErrorPatterns;

    if (patterns.length === 0) {
      console.log(`No error patterns recorded yet.`);
      console.log(`Run 'platxa-debug analyze' on some errors to start tracking patterns.`);
      return;
    }

    let output: string;

    if (format === 'json') {
      output = JSON.stringify({
        period,
        timestamp: new Date().toISOString(),
        patterns: patterns.map((p: ErrorPatternMetrics) => ({
          errorType: p.errorType,
          count: p.count,
          fixSuccessRate: Math.round(p.fixSuccessRate * 100),
          avgTimeToFixMs: Math.round(p.avgTimeToFixMs),
          trend: p.trend,
        })),
        fixPatterns: metrics.fixEffectiveness.map((f: FixEffectivenessMetrics) => ({
          patternId: f.patternId,
          description: f.description,
          timesApplied: f.timesApplied,
          successRate: Math.round(f.successRate * 100),
          avgConfidence: Math.round(f.avgConfidence * 100),
        })),
      }, null, 2);
    } else if (format === 'csv') {
      const lines = [
        'error_type,count,fix_success_rate,avg_time_to_fix_ms,trend',
        ...patterns.map((p: ErrorPatternMetrics) =>
          `${p.errorType},${p.count},${(p.fixSuccessRate * 100).toFixed(1)}%,${Math.round(p.avgTimeToFixMs)},${p.trend}`
        ),
      ];
      output = lines.join('\n');
    } else {
      // Text format
      const lines = [
        `Period: ${period}`,
        ``,
        `--- Error Patterns (${patterns.length}) ---`,
        ``,
      ];

      for (const pattern of patterns) {
        const trendIcon = pattern.trend === 'increasing' ? '↑' :
                         pattern.trend === 'decreasing' ? '↓' : '→';
        lines.push(`  ${pattern.errorType}`);
        lines.push(`    Count: ${pattern.count} ${trendIcon}`);
        lines.push(`    Fix Success Rate: ${(pattern.fixSuccessRate * 100).toFixed(1)}%`);
        lines.push(`    Avg Time to Fix: ${Math.round(pattern.avgTimeToFixMs)}ms`);
        lines.push(``);
      }

      if (metrics.fixEffectiveness.length > 0) {
        lines.push(`--- Fix Patterns (${metrics.fixEffectiveness.length}) ---`);
        lines.push(``);

        for (const fix of metrics.fixEffectiveness) {
          lines.push(`  ${fix.patternId}: ${fix.description}`);
          lines.push(`    Times Applied: ${fix.timesApplied}`);
          lines.push(`    Success Rate: ${(fix.successRate * 100).toFixed(1)}%`);
          lines.push(`    Avg Confidence: ${(fix.avgConfidence * 100).toFixed(1)}%`);
          lines.push(``);
        }
      }

      output = lines.join('\n');
    }

    if (opts.output) {
      writeFileSync(opts.output, output);
      console.log(`Patterns exported to: ${opts.output}`);
    } else {
      console.log(output);
    }
  }
}

import { describe, it, expect } from 'vitest';
import {
  TROUBLESHOOTING_GUIDE,
  agentStuckIssues,
  previewNotUpdatingIssues,
  deployFailingIssues,
  getAllIssues,
  getIssueById,
  getIssuesByCategory,
  getIssuesBySeverity,
  searchBySymptom,
  searchIssues,
  getRelatedIssues,
  formatIssueAsMarkdown,
  formatGuideAsMarkdown,
  formatIssueCompact,
  diagnoseSymptoms,
  getQuickFixes,
  computeGuideStats,
  type TroubleshootingIssue,
} from '@/lib/agent-bridge/troubleshooting-guide';

describe('Troubleshooting Guide', () => {
  // ===========================================================================
  // Verification: Guide covers agent stuck, preview not updating, deploy failing
  // ===========================================================================

  describe('Verification: Required Coverage', () => {
    it('covers agent stuck issues', () => {
      expect(agentStuckIssues.length).toBeGreaterThan(0);
      const agentIssues = getIssuesByCategory('agent');
      expect(agentIssues.length).toBeGreaterThan(0);

      // Check for specific agent stuck scenarios
      const infiniteLoop = getIssueById('agent-infinite-loop');
      expect(infiniteLoop).toBeDefined();
      expect(infiniteLoop?.symptoms).toContain('Agent repeatedly generates the same output');

      const timeout = getIssueById('agent-timeout');
      expect(timeout).toBeDefined();

      const contextExceeded = getIssueById('agent-context-exceeded');
      expect(contextExceeded).toBeDefined();
    });

    it('covers preview not updating issues', () => {
      expect(previewNotUpdatingIssues.length).toBeGreaterThan(0);
      const previewIssues = getIssuesByCategory('preview');
      expect(previewIssues.length).toBeGreaterThan(0);

      // Check for specific preview scenarios
      const stale = getIssueById('preview-stale');
      expect(stale).toBeDefined();
      expect(stale?.symptoms).toContain('Changes not reflected in preview');

      const blank = getIssueById('preview-blank');
      expect(blank).toBeDefined();

      const error = getIssueById('preview-error');
      expect(error).toBeDefined();
    });

    it('covers deploy failing issues', () => {
      expect(deployFailingIssues.length).toBeGreaterThan(0);
      const deployIssues = getIssuesByCategory('deploy');
      expect(deployIssues.length).toBeGreaterThan(0);

      // Check for specific deploy scenarios
      const buildFailure = getIssueById('deploy-build-failure');
      expect(buildFailure).toBeDefined();
      expect(buildFailure?.symptoms).toContain('Deploy process stops at build step');

      const timeout = getIssueById('deploy-timeout');
      expect(timeout).toBeDefined();

      const permission = getIssueById('deploy-permission-denied');
      expect(permission).toBeDefined();
    });
  });

  // ===========================================================================
  // Guide Structure
  // ===========================================================================

  describe('Guide Structure', () => {
    it('has version and last updated', () => {
      expect(TROUBLESHOOTING_GUIDE.version).toBeTruthy();
      expect(TROUBLESHOOTING_GUIDE.lastUpdated).toBeTruthy();
    });

    it('has three main sections', () => {
      expect(TROUBLESHOOTING_GUIDE.sections).toHaveLength(3);
      const titles = TROUBLESHOOTING_GUIDE.sections.map((s) => s.title);
      expect(titles).toContain('Agent Issues');
      expect(titles).toContain('Preview Issues');
      expect(titles).toContain('Deployment Issues');
    });

    it('each section has description', () => {
      for (const section of TROUBLESHOOTING_GUIDE.sections) {
        expect(section.description).toBeTruthy();
        expect(section.description.length).toBeGreaterThan(20);
      }
    });

    it('each section has issues', () => {
      for (const section of TROUBLESHOOTING_GUIDE.sections) {
        expect(section.issues.length).toBeGreaterThan(0);
      }
    });
  });

  // ===========================================================================
  // Issue Completeness
  // ===========================================================================

  describe('Issue Completeness', () => {
    it('each issue has unique ID', () => {
      const issues = getAllIssues();
      const ids = issues.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each issue has title', () => {
      for (const issue of getAllIssues()) {
        expect(issue.title, `${issue.id} missing title`).toBeTruthy();
      }
    });

    it('each issue has category', () => {
      const validCategories = ['agent', 'preview', 'deploy', 'general'];
      for (const issue of getAllIssues()) {
        expect(validCategories, `${issue.id} has invalid category`).toContain(issue.category);
      }
    });

    it('each issue has severity', () => {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      for (const issue of getAllIssues()) {
        expect(validSeverities, `${issue.id} has invalid severity`).toContain(issue.severity);
      }
    });

    it('each issue has at least 2 symptoms', () => {
      for (const issue of getAllIssues()) {
        expect(issue.symptoms.length, `${issue.id} needs more symptoms`).toBeGreaterThanOrEqual(2);
      }
    });

    it('each issue has at least 2 causes', () => {
      for (const issue of getAllIssues()) {
        expect(issue.causes.length, `${issue.id} needs more causes`).toBeGreaterThanOrEqual(2);
      }
    });

    it('each issue has diagnostics', () => {
      for (const issue of getAllIssues()) {
        expect(issue.diagnostics.length, `${issue.id} needs diagnostics`).toBeGreaterThan(0);
      }
    });

    it('each diagnostic has required fields', () => {
      for (const issue of getAllIssues()) {
        for (const diag of issue.diagnostics) {
          expect(diag.name, `${issue.id} diag missing name`).toBeTruthy();
          expect(diag.description, `${issue.id} diag missing description`).toBeTruthy();
          expect(diag.howToCheck, `${issue.id} diag missing howToCheck`).toBeTruthy();
          expect(diag.failureIndicator, `${issue.id} diag missing failureIndicator`).toBeTruthy();
        }
      }
    });

    it('each issue has resolution steps', () => {
      for (const issue of getAllIssues()) {
        expect(issue.resolution.length, `${issue.id} needs resolution steps`).toBeGreaterThan(0);
      }
    });

    it('each resolution step has required fields', () => {
      for (const issue of getAllIssues()) {
        for (const step of issue.resolution) {
          expect(step.step, `${issue.id} step missing number`).toBeGreaterThan(0);
          expect(step.action, `${issue.id} step missing action`).toBeTruthy();
          expect(step.expectedResult, `${issue.id} step missing expectedResult`).toBeTruthy();
        }
      }
    });

    it('each issue has prevention tips', () => {
      for (const issue of getAllIssues()) {
        expect(issue.prevention.length, `${issue.id} needs prevention tips`).toBeGreaterThan(0);
      }
    });
  });

  // ===========================================================================
  // Query Functions
  // ===========================================================================

  describe('getAllIssues', () => {
    it('returns all issues from all sections', () => {
      const issues = getAllIssues();
      const expected = agentStuckIssues.length +
        previewNotUpdatingIssues.length +
        deployFailingIssues.length;
      expect(issues.length).toBe(expected);
    });
  });

  describe('getIssueById', () => {
    it('finds existing issue', () => {
      const issue = getIssueById('agent-infinite-loop');
      expect(issue).toBeDefined();
      expect(issue?.title).toBe('Agent Stuck in Infinite Loop');
    });

    it('returns undefined for unknown ID', () => {
      const issue = getIssueById('nonexistent-issue');
      expect(issue).toBeUndefined();
    });
  });

  describe('getIssuesByCategory', () => {
    it('filters by agent category', () => {
      const issues = getIssuesByCategory('agent');
      expect(issues.length).toBe(agentStuckIssues.length);
      expect(issues.every((i) => i.category === 'agent')).toBe(true);
    });

    it('filters by preview category', () => {
      const issues = getIssuesByCategory('preview');
      expect(issues.length).toBe(previewNotUpdatingIssues.length);
    });

    it('filters by deploy category', () => {
      const issues = getIssuesByCategory('deploy');
      expect(issues.length).toBe(deployFailingIssues.length);
    });

    it('returns empty for unused category', () => {
      const issues = getIssuesByCategory('general');
      expect(issues).toHaveLength(0);
    });
  });

  describe('getIssuesBySeverity', () => {
    it('filters by high severity', () => {
      const issues = getIssuesBySeverity('high');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((i) => i.severity === 'high')).toBe(true);
    });

    it('filters by critical severity', () => {
      const issues = getIssuesBySeverity('critical');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((i) => i.severity === 'critical')).toBe(true);
    });
  });

  describe('searchBySymptom', () => {
    it('finds issues by symptom text', () => {
      const results = searchBySymptom('timeout');
      expect(results.length).toBeGreaterThan(0);
    });

    it('is case insensitive', () => {
      const lower = searchBySymptom('error');
      const upper = searchBySymptom('ERROR');
      expect(lower.length).toBe(upper.length);
    });

    it('returns empty for no matches', () => {
      const results = searchBySymptom('xyznonexistent123');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchIssues', () => {
    it('searches title', () => {
      const results = searchIssues('Infinite Loop');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('agent-infinite-loop');
    });

    it('searches symptoms', () => {
      const results = searchIssues('CPU usage');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searches causes', () => {
      const results = searchIssues('Network connectivity');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getRelatedIssues', () => {
    it('returns related issues', () => {
      const related = getRelatedIssues('agent-infinite-loop');
      expect(related.length).toBeGreaterThan(0);
      const ids = related.map((i) => i.id);
      expect(ids).toContain('agent-timeout');
    });

    it('returns empty for issue without related', () => {
      // Find an issue without related issues or nonexistent
      const related = getRelatedIssues('nonexistent');
      expect(related).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Formatting Functions
  // ===========================================================================

  describe('formatIssueAsMarkdown', () => {
    it('includes title as heading', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const md = formatIssueAsMarkdown(issue);
      expect(md).toContain('## Agent Stuck in Infinite Loop');
    });

    it('includes category and severity', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const md = formatIssueAsMarkdown(issue);
      expect(md).toContain('agent');
      expect(md).toContain('high');
    });

    it('includes symptoms section', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const md = formatIssueAsMarkdown(issue);
      expect(md).toContain('### Symptoms');
      expect(md).toContain('Agent repeatedly generates the same output');
    });

    it('includes causes section', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const md = formatIssueAsMarkdown(issue);
      expect(md).toContain('### Possible Causes');
    });

    it('includes diagnostics section', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const md = formatIssueAsMarkdown(issue);
      expect(md).toContain('### Diagnostics');
    });

    it('includes resolution steps', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const md = formatIssueAsMarkdown(issue);
      expect(md).toContain('### Resolution Steps');
      expect(md).toContain('1.');
    });

    it('includes prevention section', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const md = formatIssueAsMarkdown(issue);
      expect(md).toContain('### Prevention');
    });
  });

  describe('formatGuideAsMarkdown', () => {
    it('includes main title', () => {
      const md = formatGuideAsMarkdown();
      expect(md).toContain('# Troubleshooting Guide');
    });

    it('includes version info', () => {
      const md = formatGuideAsMarkdown();
      expect(md).toContain(TROUBLESHOOTING_GUIDE.version);
    });

    it('includes table of contents', () => {
      const md = formatGuideAsMarkdown();
      expect(md).toContain('## Table of Contents');
    });

    it('includes all sections', () => {
      const md = formatGuideAsMarkdown();
      expect(md).toContain('# Agent Issues');
      expect(md).toContain('# Preview Issues');
      expect(md).toContain('# Deployment Issues');
    });

    it('includes all issues', () => {
      const md = formatGuideAsMarkdown();
      for (const issue of getAllIssues()) {
        expect(md).toContain(issue.title);
      }
    });

    it('generates substantial content', () => {
      const md = formatGuideAsMarkdown();
      expect(md.length).toBeGreaterThan(5000);
    });
  });

  describe('formatIssueCompact', () => {
    it('includes severity icon', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const compact = formatIssueCompact(issue);
      expect(compact).toContain('●'); // high severity
    });

    it('includes category', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const compact = formatIssueCompact(issue);
      expect(compact).toContain('[agent]');
    });

    it('includes title', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const compact = formatIssueCompact(issue);
      expect(compact).toContain('Agent Stuck in Infinite Loop');
    });

    it('includes first symptom', () => {
      const issue = getIssueById('agent-infinite-loop')!;
      const compact = formatIssueCompact(issue);
      expect(compact).toContain(issue.symptoms[0]);
    });
  });

  // ===========================================================================
  // Diagnostic Functions
  // ===========================================================================

  describe('diagnoseSymptoms', () => {
    it('returns matching issues sorted by match count', () => {
      const symptoms = [
        'Agent repeatedly generates the same output',
        'CPU usage remains high',
      ];
      const matches = diagnoseSymptoms(symptoms);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].id).toBe('agent-infinite-loop');
    });

    it('returns empty for no matching symptoms', () => {
      const matches = diagnoseSymptoms(['xyz nonexistent symptom 123']);
      expect(matches).toHaveLength(0);
    });
  });

  describe('getQuickFixes', () => {
    it('returns commands from resolution steps', () => {
      const fixes = getQuickFixes('agent-infinite-loop');
      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes).toContain('agent.clearContext()');
    });

    it('returns empty for unknown issue', () => {
      const fixes = getQuickFixes('nonexistent');
      expect(fixes).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Statistics
  // ===========================================================================

  describe('computeGuideStats', () => {
    it('returns total issues count', () => {
      const stats = computeGuideStats();
      expect(stats.totalIssues).toBe(getAllIssues().length);
    });

    it('returns count by category', () => {
      const stats = computeGuideStats();
      expect(stats.byCategory.agent).toBe(agentStuckIssues.length);
      expect(stats.byCategory.preview).toBe(previewNotUpdatingIssues.length);
      expect(stats.byCategory.deploy).toBe(deployFailingIssues.length);
    });

    it('returns count by severity', () => {
      const stats = computeGuideStats();
      const total = stats.bySeverity.low +
        stats.bySeverity.medium +
        stats.bySeverity.high +
        stats.bySeverity.critical;
      expect(total).toBe(stats.totalIssues);
    });

    it('returns total steps count', () => {
      const stats = computeGuideStats();
      expect(stats.totalSteps).toBeGreaterThan(0);
    });

    it('returns total diagnostics count', () => {
      const stats = computeGuideStats();
      expect(stats.totalDiagnostics).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Related Issues Integrity
  // ===========================================================================

  describe('Related Issues Integrity', () => {
    it('all related issue references exist', () => {
      const allIds = new Set(getAllIssues().map((i) => i.id));
      for (const issue of getAllIssues()) {
        if (issue.relatedIssues) {
          for (const relatedId of issue.relatedIssues) {
            expect(allIds.has(relatedId), `${issue.id} references unknown: ${relatedId}`).toBe(true);
          }
        }
      }
    });
  });
});

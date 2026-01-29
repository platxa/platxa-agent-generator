/**
 * Tests for PlanPreviewGenerator
 *
 * Verifies:
 * - Preview shows numbered steps
 * - File paths are included
 * - Estimated duration is calculated
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlanPreviewGenerator,
  createPlanPreviewGenerator,
  generatePlanPreview,
  generateOptionPreview,
  type PlanPreview,
  type StepPreview,
  type FilePreview,
  type DurationEstimate,
} from '../../lib/agentic-core/plan-preview';
import type { AgentPlan, AgentPlanStep } from '../../lib/agentic-core/agent-engine';
import type { DesignOption } from '../../lib/agentic-core/option-generator';

describe('PlanPreviewGenerator', () => {
  let generator: PlanPreviewGenerator;

  beforeEach(() => {
    generator = new PlanPreviewGenerator();
  });

  // Helper to create test plans
  function createTestPlan(steps: Partial<AgentPlanStep>[]): AgentPlan {
    return {
      id: 'test-plan',
      goal: 'Test Plan Goal',
      steps: steps.map((s, i) => ({
        id: s.id ?? `step-${i + 1}`,
        action: s.action ?? 'read_file',
        target: s.target ?? 'test.xml',
        rationale: s.rationale ?? 'Test rationale',
        status: s.status ?? 'pending',
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // ==========================================================================
  // Numbered Steps (Verification Requirement)
  // ==========================================================================

  describe('numbered steps', () => {
    it('generates numbered steps starting from 1', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'file1.xml' },
        { action: 'edit_file', target: 'file1.xml' },
        { action: 'validate', target: 'file1.xml' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.steps.length).toBe(3);
      expect(preview.steps[0].number).toBe(1);
      expect(preview.steps[1].number).toBe(2);
      expect(preview.steps[2].number).toBe(3);
    });

    it('each step has a number property', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'a.xml' },
        { action: 'write_file', target: 'b.xml' },
      ]);

      const preview = generator.generate(plan);

      for (const step of preview.steps) {
        expect(step.number).toBeDefined();
        expect(typeof step.number).toBe('number');
        expect(step.number).toBeGreaterThan(0);
      }
    });

    it('steps are in sequential order', () => {
      const plan = createTestPlan([
        { id: 'first', action: 'read_file' },
        { id: 'second', action: 'edit_file' },
        { id: 'third', action: 'validate' },
        { id: 'fourth', action: 'write_file' },
      ]);

      const preview = generator.generate(plan);

      for (let i = 0; i < preview.steps.length; i++) {
        expect(preview.steps[i].number).toBe(i + 1);
      }
    });

    it('includes step count in preview', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'edit_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.stepCount).toBe(2);
      expect(preview.stepCount).toBe(preview.steps.length);
    });
  });

  // ==========================================================================
  // File Paths (Verification Requirement)
  // ==========================================================================

  describe('file paths', () => {
    it('extracts file paths from steps', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'templates/homepage.xml' },
        { action: 'edit_file', target: 'static/css/style.scss' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.files.length).toBeGreaterThan(0);

      const paths = preview.files.map(f => f.path);
      expect(paths).toContain('templates/homepage.xml');
      expect(paths).toContain('static/css/style.scss');
    });

    it('each file has path property', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'test/path/file.xml' },
      ]);

      const preview = generator.generate(plan);

      for (const file of preview.files) {
        expect(file.path).toBeDefined();
        expect(typeof file.path).toBe('string');
        expect(file.path.length).toBeGreaterThan(0);
      }
    });

    it('extracts file name from path', () => {
      const plan = createTestPlan([
        { action: 'edit_file', target: 'path/to/myfile.xml' },
      ]);

      const preview = generator.generate(plan);
      const file = preview.files.find(f => f.path === 'path/to/myfile.xml');

      expect(file).toBeDefined();
      expect(file?.name).toBe('myfile.xml');
    });

    it('extracts directory from path', () => {
      const plan = createTestPlan([
        { action: 'edit_file', target: 'templates/pages/home.xml' },
      ]);

      const preview = generator.generate(plan);
      const file = preview.files.find(f => f.path === 'templates/pages/home.xml');

      expect(file).toBeDefined();
      expect(file?.directory).toBe('templates/pages');
    });

    it('extracts file extension', () => {
      const plan = createTestPlan([
        { action: 'edit_file', target: 'styles/main.scss' },
      ]);

      const preview = generator.generate(plan);
      const file = preview.files.find(f => f.path === 'styles/main.scss');

      expect(file).toBeDefined();
      expect(file?.extension).toBe('scss');
    });

    it('includes file count in preview', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'file1.xml' },
        { action: 'edit_file', target: 'file2.xml' },
        { action: 'write_file', target: 'file3.xml' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.fileCount).toBe(preview.files.length);
    });

    it('deduplicates files affected by multiple steps', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'same.xml' },
        { action: 'edit_file', target: 'same.xml' },
        { action: 'validate', target: 'same.xml' },
      ]);

      const preview = generator.generate(plan);

      const sameFiles = preview.files.filter(f => f.path === 'same.xml');
      expect(sameFiles.length).toBe(1);
    });

    it('tracks which steps affect each file', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'shared.xml' },
        { action: 'edit_file', target: 'shared.xml' },
      ]);

      const preview = generator.generate(plan);
      const sharedFile = preview.files.find(f => f.path === 'shared.xml');

      expect(sharedFile).toBeDefined();
      expect(sharedFile?.affectedBySteps).toContain(1);
      expect(sharedFile?.affectedBySteps).toContain(2);
    });
  });

  // ==========================================================================
  // Estimated Duration (Verification Requirement)
  // ==========================================================================

  describe('estimated duration', () => {
    it('calculates total duration', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'edit_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.duration).toBeDefined();
      expect(preview.duration.totalSec).toBeGreaterThan(0);
    });

    it('provides formatted duration string', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'edit_file' },
        { action: 'validate' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.duration.totalFormatted).toBeDefined();
      expect(typeof preview.duration.totalFormatted).toBe('string');
      // Should be in format like "14s" or "1m 30s"
      expect(preview.duration.totalFormatted).toMatch(/^\d+s$|^\d+m(\s\d+s)?$/);
    });

    it('calculates per-step duration', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'write_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.duration.perStep).toBeDefined();
      expect(preview.duration.perStep.length).toBe(2);

      for (const stepDuration of preview.duration.perStep) {
        expect(stepDuration.stepNumber).toBeDefined();
        expect(stepDuration.durationSec).toBeGreaterThan(0);
      }
    });

    it('calculates average step duration', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'edit_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.duration.averageStepSec).toBeDefined();
      expect(preview.duration.averageStepSec).toBeGreaterThan(0);
    });

    it('includes confidence level', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.duration.confidence).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(preview.duration.confidence);
    });

    it('each step has estimated duration', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'edit_file' },
        { action: 'execute' },
      ]);

      const preview = generator.generate(plan);

      for (const step of preview.steps) {
        expect(step.estimatedDurationSec).toBeDefined();
        expect(step.estimatedDurationSec).toBeGreaterThan(0);
      }
    });

    it('different action types have different durations', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'execute' },
      ]);

      const preview = generator.generate(plan);

      const readStep = preview.steps.find(s => s.action === 'read_file');
      const executeStep = preview.steps.find(s => s.action === 'execute');

      expect(readStep?.estimatedDurationSec).not.toBe(executeStep?.estimatedDurationSec);
    });

    it('formats duration under 60 seconds correctly', () => {
      const plan = createTestPlan([
        { action: 'read_file' }, // ~2s
      ]);

      const preview = generator.generate(plan);

      expect(preview.duration.totalFormatted).toMatch(/^\d+s$/);
    });

    it('formats duration over 60 seconds with minutes', () => {
      // Create enough steps to exceed 60 seconds
      const steps = Array(10).fill({ action: 'execute' }); // 10 * 10s = 100s
      const plan = createTestPlan(steps);

      const preview = generator.generate(plan);

      expect(preview.duration.totalFormatted).toMatch(/^\d+m/);
    });
  });

  // ==========================================================================
  // Step Details
  // ==========================================================================

  describe('step details', () => {
    it('includes action type', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'edit_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.steps[0].action).toBe('read_file');
      expect(preview.steps[1].action).toBe('edit_file');
    });

    it('includes human-readable action label', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'write_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.steps[0].actionLabel).toBe('Read file');
      expect(preview.steps[1].actionLabel).toBe('Create file');
    });

    it('includes target', () => {
      const plan = createTestPlan([
        { action: 'edit_file', target: 'my/target/file.xml' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.steps[0].target).toBe('my/target/file.xml');
    });

    it('includes description/rationale', () => {
      const plan = createTestPlan([
        { action: 'edit_file', rationale: 'Update the header component' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.steps[0].description).toContain('Update the header component');
    });

    it('includes step status', () => {
      const plan = createTestPlan([
        { action: 'read_file', status: 'completed' },
        { action: 'edit_file', status: 'pending' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.steps[0].status).toBe('completed');
      expect(preview.steps[1].status).toBe('pending');
    });

    it('assesses step risk level', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'execute' },
      ]);

      const preview = generator.generate(plan);

      // Read is low risk, execute is high risk
      expect(preview.steps[0].riskLevel).toBe('low');
      expect(preview.steps[1].riskLevel).toBe('high');
    });
  });

  // ==========================================================================
  // File Details
  // ==========================================================================

  describe('file details', () => {
    it('determines change type from action', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'read.xml' },
        { action: 'write_file', target: 'write.xml' },
        { action: 'edit_file', target: 'edit.xml' },
      ]);

      const preview = generator.generate(plan);

      const readFile = preview.files.find(f => f.path === 'read.xml');
      const writeFile = preview.files.find(f => f.path === 'write.xml');
      const editFile = preview.files.find(f => f.path === 'edit.xml');

      expect(readFile?.changeType).toBe('read');
      expect(writeFile?.changeType).toBe('create');
      expect(editFile?.changeType).toBe('modify');
    });

    it('upgrades change type when file is read then edited', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'file.xml' },
        { action: 'edit_file', target: 'file.xml' },
      ]);

      const preview = generator.generate(plan);
      const file = preview.files.find(f => f.path === 'file.xml');

      // Should be 'modify' not 'read' since it's also edited
      expect(file?.changeType).toBe('modify');
    });

    it('includes change description', () => {
      const plan = createTestPlan([
        { action: 'edit_file', target: 'file.xml', rationale: 'Fix the bug' },
      ]);

      const preview = generator.generate(plan);
      const file = preview.files.find(f => f.path === 'file.xml');

      expect(file?.description).toBeDefined();
      expect(file?.description.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Risk Assessment
  // ==========================================================================

  describe('risk assessment', () => {
    it('assesses overall risk level', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'edit_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(preview.riskLevel);
    });

    it('read-only plans are low risk', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'a.xml' },
        { action: 'read_file', target: 'b.xml' },
        { action: 'search', target: 'query' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.riskLevel).toBe('low');
    });

    it('plans with execute are higher risk', () => {
      const plan = createTestPlan([
        { action: 'execute', target: 'command' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.riskLevel).toBe('high');
    });
  });

  // ==========================================================================
  // Summary
  // ==========================================================================

  describe('summary', () => {
    it('generates a summary string', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'a.xml' },
        { action: 'edit_file', target: 'b.xml' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.summary).toBeDefined();
      expect(typeof preview.summary).toBe('string');
      expect(preview.summary.length).toBeGreaterThan(0);
    });

    it('summary includes step count', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
        { action: 'edit_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.summary).toContain('2');
      expect(preview.summary).toMatch(/step/i);
    });

    it('summary includes duration', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.summary).toMatch(/\d+s|\d+m/);
    });
  });

  // ==========================================================================
  // Rendering
  // ==========================================================================

  describe('rendering', () => {
    it('renders to text format', () => {
      const plan = createTestPlan([
        { action: 'read_file', target: 'file.xml' },
        { action: 'edit_file', target: 'file.xml' },
      ]);

      const preview = generator.generate(plan);
      const text = generator.renderText(preview);

      expect(text).toContain('Plan:');
      expect(text).toContain('Steps:');
      expect(text).toContain('1.');
      expect(text).toContain('2.');
      expect(text).toContain('file.xml');
    });

    it('renders to markdown format', () => {
      const plan = createTestPlan([
        { action: 'edit_file', target: 'test.xml' },
      ]);

      const preview = generator.generate(plan);
      const markdown = generator.renderMarkdown(preview);

      expect(markdown).toContain('##');
      expect(markdown).toContain('**');
      expect(markdown).toContain('`test.xml`');
    });

    it('renders to JSON format', () => {
      const plan = createTestPlan([
        { action: 'read_file' },
      ]);

      const preview = generator.generate(plan);
      const json = generator.render(preview, 'json');

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed.planId).toBe('test-plan');
    });

    it('render method accepts format parameter', () => {
      const plan = createTestPlan([{ action: 'read_file' }]);
      const preview = generator.generate(plan);

      const text = generator.render(preview, 'text');
      const md = generator.render(preview, 'markdown');

      expect(text).not.toBe(md);
    });
  });

  // ==========================================================================
  // Configuration
  // ==========================================================================

  describe('configuration', () => {
    it('accepts custom action durations', () => {
      const customGenerator = new PlanPreviewGenerator({
        actionDurations: { read_file: 100 },
      });

      const plan = createTestPlan([
        { action: 'read_file' },
      ]);

      const preview = customGenerator.generate(plan);

      expect(preview.steps[0].estimatedDurationSec).toBe(100);
    });

    it('accepts custom action labels', () => {
      const customGenerator = new PlanPreviewGenerator({
        actionLabels: { read_file: 'Load content' },
      });

      const plan = createTestPlan([
        { action: 'read_file' },
      ]);

      const preview = customGenerator.generate(plan);

      expect(preview.steps[0].actionLabel).toBe('Load content');
    });

    it('setActionDuration updates duration', () => {
      generator.setActionDuration('read_file', 50);

      const plan = createTestPlan([{ action: 'read_file' }]);
      const preview = generator.generate(plan);

      expect(preview.steps[0].estimatedDurationSec).toBe(50);
    });

    it('setActionLabel updates label', () => {
      generator.setActionLabel('edit_file', 'Modify content');

      const plan = createTestPlan([{ action: 'edit_file' }]);
      const preview = generator.generate(plan);

      expect(preview.steps[0].actionLabel).toBe('Modify content');
    });
  });

  // ==========================================================================
  // DesignOption Integration
  // ==========================================================================

  describe('DesignOption integration', () => {
    it('generates preview from DesignOption', () => {
      const option: DesignOption = {
        id: 'opt-1',
        name: 'Test Option',
        description: 'Test description',
        category: 'standard',
        pros: [],
        cons: [],
        effort: { level: 'medium', fileCount: 2 },
        filesAffected: [
          { path: 'a.xml', changeType: 'modify', description: 'Update' },
        ],
        plan: createTestPlan([{ action: 'edit_file', target: 'a.xml' }]),
        riskLevel: 'low',
      };

      const preview = generator.generateFromOption(option);

      expect(preview.title).toBe('Test Option');
      expect(preview.description).toBe('Test description');
      expect(preview.riskLevel).toBe('low');
    });

    it('includes affected files from option', () => {
      const option: DesignOption = {
        id: 'opt-1',
        name: 'Test',
        description: 'Test',
        category: 'standard',
        pros: [],
        cons: [],
        effort: { level: 'medium', fileCount: 2 },
        filesAffected: [
          { path: 'extra.xml', changeType: 'create', description: 'New file' },
        ],
        plan: createTestPlan([{ action: 'read_file', target: 'other.xml' }]),
        riskLevel: 'low',
      };

      const preview = generator.generateFromOption(option);

      const extraFile = preview.files.find(f => f.path === 'extra.xml');
      expect(extraFile).toBeDefined();
    });
  });

  // ==========================================================================
  // Factory Functions
  // ==========================================================================

  describe('factory functions', () => {
    it('createPlanPreviewGenerator creates instance', () => {
      const instance = createPlanPreviewGenerator();
      expect(instance).toBeInstanceOf(PlanPreviewGenerator);
    });

    it('createPlanPreviewGenerator accepts config', () => {
      const instance = createPlanPreviewGenerator({
        actionDurations: { read_file: 99 },
      });

      const plan = createTestPlan([{ action: 'read_file' }]);
      const preview = instance.generate(plan);

      expect(preview.steps[0].estimatedDurationSec).toBe(99);
    });

    it('generatePlanPreview is a convenience function', () => {
      const plan = createTestPlan([{ action: 'read_file' }]);
      const preview = generatePlanPreview(plan);

      expect(preview).toBeDefined();
      expect(preview.steps.length).toBe(1);
    });

    it('generateOptionPreview is a convenience function', () => {
      const option: DesignOption = {
        id: 'opt-1',
        name: 'Quick Test',
        description: 'Test',
        category: 'minimal',
        pros: [],
        cons: [],
        effort: { level: 'small', fileCount: 1 },
        filesAffected: [],
        plan: createTestPlan([{ action: 'read_file' }]),
        riskLevel: 'low',
      };

      const preview = generateOptionPreview(option);

      expect(preview.title).toBe('Quick Test');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles empty plan', () => {
      const plan = createTestPlan([]);
      const preview = generator.generate(plan);

      expect(preview.steps.length).toBe(0);
      expect(preview.stepCount).toBe(0);
      expect(preview.duration.totalSec).toBe(0);
    });

    it('handles plan with unknown action', () => {
      const plan = createTestPlan([
        { action: 'unknown' as any, target: 'test' },
      ]);

      const preview = generator.generate(plan);

      expect(preview.steps.length).toBe(1);
      expect(preview.steps[0].actionLabel).toBe('Process');
    });

    it('handles files without extension', () => {
      const plan = createTestPlan([
        { action: 'edit_file', target: 'Makefile' },
      ]);

      const preview = generator.generate(plan);
      const file = preview.files.find(f => f.path === 'Makefile');

      expect(file?.name).toBe('Makefile');
      expect(file?.extension).toBe('');
    });

    it('handles deeply nested paths', () => {
      const plan = createTestPlan([
        { action: 'edit_file', target: 'a/b/c/d/e/file.xml' },
      ]);

      const preview = generator.generate(plan);
      const file = preview.files.find(f => f.path === 'a/b/c/d/e/file.xml');

      expect(file?.directory).toBe('a/b/c/d/e');
      expect(file?.name).toBe('file.xml');
    });

    it('includes timestamp', () => {
      const plan = createTestPlan([{ action: 'read_file' }]);
      const preview = generator.generate(plan);

      expect(preview.generatedAt).toBeInstanceOf(Date);
    });
  });
});

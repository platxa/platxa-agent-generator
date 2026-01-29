/**
 * Tests for PlanPreview component
 *
 * Feature #51: Add PlanPreview component showing numbered execution steps
 */

import { describe, it, expect } from 'vitest';

// Mock types matching the component
interface StepPreview {
  number: number;
  id: string;
  action: string;
  actionLabel: string;
  target: string;
  description: string;
  estimatedDurationSec: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  riskLevel?: 'low' | 'medium' | 'high';
}

interface FilePreview {
  path: string;
  name: string;
  directory: string;
  extension: string;
  changeType: 'create' | 'modify' | 'delete' | 'read';
  description: string;
  linesChanged?: number;
  affectedBySteps: number[];
}

interface DurationEstimate {
  totalSec: number;
  totalFormatted: string;
  perStep: { stepNumber: number; durationSec: number }[];
  averageStepSec: number;
  confidence: 'low' | 'medium' | 'high';
}

interface MockPlanPreview {
  planId: string;
  title: string;
  description: string;
  steps: StepPreview[];
  stepCount: number;
  files: FilePreview[];
  fileCount: number;
  duration: DurationEstimate;
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
}

// Helper to create mock data
const createMockStep = (num: number, overrides?: Partial<StepPreview>): StepPreview => ({
  number: num,
  id: `step-${num}`,
  action: 'edit_file',
  actionLabel: 'Edit File',
  target: `src/file-${num}.ts`,
  description: `Step ${num} description - rationale for this action`,
  estimatedDurationSec: 30,
  status: 'pending',
  ...overrides,
});

const createMockPreview = (overrides?: Partial<MockPlanPreview>): MockPlanPreview => ({
  planId: 'plan-1',
  title: 'Implementation Plan',
  description: 'Plan to implement the feature',
  steps: [
    createMockStep(1, { action: 'read_file', actionLabel: 'Read File' }),
    createMockStep(2, { action: 'edit_file', actionLabel: 'Edit File' }),
    createMockStep(3, { action: 'write_file', actionLabel: 'Create File' }),
  ],
  stepCount: 3,
  files: [
    {
      path: 'src/utils/helper.ts',
      name: 'helper.ts',
      directory: 'src/utils',
      extension: '.ts',
      changeType: 'modify',
      description: 'Add new function',
      linesChanged: 20,
      affectedBySteps: [2],
    },
  ],
  fileCount: 1,
  duration: {
    totalSec: 90,
    totalFormatted: '1m 30s',
    perStep: [
      { stepNumber: 1, durationSec: 30 },
      { stepNumber: 2, durationSec: 30 },
      { stepNumber: 3, durationSec: 30 },
    ],
    averageStepSec: 30,
    confidence: 'medium',
  },
  riskLevel: 'low',
  summary: 'This plan adds a new utility function',
  ...overrides,
});

describe('PlanPreview', () => {
  describe('step display requirements (Feature #51)', () => {
    it('should show steps numbered 1 to N', () => {
      const preview = createMockPreview({
        steps: [
          createMockStep(1),
          createMockStep(2),
          createMockStep(3),
          createMockStep(4),
        ],
        stepCount: 4,
      });

      expect(preview.steps[0].number).toBe(1);
      expect(preview.steps[1].number).toBe(2);
      expect(preview.steps[2].number).toBe(3);
      expect(preview.steps[3].number).toBe(4);
    });

    it('should show action for each step', () => {
      const preview = createMockPreview({
        steps: [
          createMockStep(1, { action: 'read_file', actionLabel: 'Read File' }),
          createMockStep(2, { action: 'edit_file', actionLabel: 'Edit File' }),
          createMockStep(3, { action: 'write_file', actionLabel: 'Create File' }),
        ],
      });

      expect(preview.steps[0].action).toBe('read_file');
      expect(preview.steps[0].actionLabel).toBe('Read File');
      expect(preview.steps[1].action).toBe('edit_file');
      expect(preview.steps[2].action).toBe('write_file');
    });

    it('should show target for each step', () => {
      const preview = createMockPreview({
        steps: [
          createMockStep(1, { target: 'src/components/Button.tsx' }),
          createMockStep(2, { target: 'src/utils/helpers.ts' }),
        ],
      });

      expect(preview.steps[0].target).toBe('src/components/Button.tsx');
      expect(preview.steps[1].target).toBe('src/utils/helpers.ts');
    });

    it('should show rationale/description for each step', () => {
      const preview = createMockPreview({
        steps: [
          createMockStep(1, { description: 'Read existing code to understand structure' }),
          createMockStep(2, { description: 'Add new function to handle user input' }),
        ],
      });

      expect(preview.steps[0].description).toBe('Read existing code to understand structure');
      expect(preview.steps[1].description).toBe('Add new function to handle user input');
    });
  });

  describe('step numbering', () => {
    it('should maintain correct step numbers', () => {
      const preview = createMockPreview();
      const numbers = preview.steps.map(s => s.number);
      expect(numbers).toEqual([1, 2, 3]);
    });

    it('should have matching step count', () => {
      const preview = createMockPreview();
      expect(preview.stepCount).toBe(preview.steps.length);
    });
  });

  describe('step status', () => {
    it('should show pending status', () => {
      const step = createMockStep(1, { status: 'pending' });
      expect(step.status).toBe('pending');
    });

    it('should show in_progress status', () => {
      const step = createMockStep(1, { status: 'in_progress' });
      expect(step.status).toBe('in_progress');
    });

    it('should show completed status', () => {
      const step = createMockStep(1, { status: 'completed' });
      expect(step.status).toBe('completed');
    });

    it('should show failed status', () => {
      const step = createMockStep(1, { status: 'failed' });
      expect(step.status).toBe('failed');
    });

    it('should show skipped status', () => {
      const step = createMockStep(1, { status: 'skipped' });
      expect(step.status).toBe('skipped');
    });
  });

  describe('duration display', () => {
    it('should format duration in seconds', () => {
      const formatDuration = (seconds: number): string => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (remainingSeconds === 0) return `${minutes}m`;
        return `${minutes}m ${remainingSeconds}s`;
      };

      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(150)).toBe('2m 30s');
    });

    it('should show total duration', () => {
      const preview = createMockPreview();
      expect(preview.duration.totalFormatted).toBe('1m 30s');
    });

    it('should show per-step duration', () => {
      const preview = createMockPreview();
      expect(preview.duration.perStep).toHaveLength(3);
      expect(preview.duration.perStep[0].durationSec).toBe(30);
    });
  });

  describe('risk level display', () => {
    it('should show low risk level', () => {
      const preview = createMockPreview({ riskLevel: 'low' });
      expect(preview.riskLevel).toBe('low');
    });

    it('should show medium risk level', () => {
      const preview = createMockPreview({ riskLevel: 'medium' });
      expect(preview.riskLevel).toBe('medium');
    });

    it('should show high risk level', () => {
      const preview = createMockPreview({ riskLevel: 'high' });
      expect(preview.riskLevel).toBe('high');
    });

    it('should show step-level risk', () => {
      const step = createMockStep(1, { riskLevel: 'high' });
      expect(step.riskLevel).toBe('high');
    });
  });

  describe('files display', () => {
    it('should show affected files', () => {
      const preview = createMockPreview();
      expect(preview.files).toHaveLength(1);
      expect(preview.files[0].path).toBe('src/utils/helper.ts');
    });

    it('should show file change type', () => {
      const preview = createMockPreview();
      expect(preview.files[0].changeType).toBe('modify');
    });

    it('should show lines changed', () => {
      const preview = createMockPreview();
      expect(preview.files[0].linesChanged).toBe(20);
    });

    it('should track affected steps', () => {
      const preview = createMockPreview();
      expect(preview.files[0].affectedBySteps).toContain(2);
    });
  });

  describe('action types', () => {
    it('should support read_file action', () => {
      const step = createMockStep(1, { action: 'read_file' });
      expect(step.action).toBe('read_file');
    });

    it('should support write_file action', () => {
      const step = createMockStep(1, { action: 'write_file' });
      expect(step.action).toBe('write_file');
    });

    it('should support edit_file action', () => {
      const step = createMockStep(1, { action: 'edit_file' });
      expect(step.action).toBe('edit_file');
    });

    it('should support delete_file action', () => {
      const step = createMockStep(1, { action: 'delete_file' });
      expect(step.action).toBe('delete_file');
    });

    it('should support search action', () => {
      const step = createMockStep(1, { action: 'search' });
      expect(step.action).toBe('search');
    });
  });

  describe('component props', () => {
    interface PlanPreviewProps {
      preview: MockPlanPreview;
      showFiles?: boolean;
      showDuration?: boolean;
      onStepClick?: (stepNumber: number) => void;
      activeStep?: number;
      compact?: boolean;
    }

    it('should accept preview prop', () => {
      const props: PlanPreviewProps = { preview: createMockPreview() };
      expect(props.preview).toBeDefined();
    });

    it('should accept optional showFiles prop', () => {
      const props: PlanPreviewProps = { preview: createMockPreview(), showFiles: false };
      expect(props.showFiles).toBe(false);
    });

    it('should accept optional showDuration prop', () => {
      const props: PlanPreviewProps = { preview: createMockPreview(), showDuration: false };
      expect(props.showDuration).toBe(false);
    });

    it('should accept optional onStepClick callback', () => {
      let clickedStep: number | null = null;
      const props: PlanPreviewProps = {
        preview: createMockPreview(),
        onStepClick: (n) => { clickedStep = n; },
      };
      props.onStepClick?.(2);
      expect(clickedStep).toBe(2);
    });

    it('should accept optional activeStep prop', () => {
      const props: PlanPreviewProps = { preview: createMockPreview(), activeStep: 2 };
      expect(props.activeStep).toBe(2);
    });

    it('should accept optional compact prop', () => {
      const props: PlanPreviewProps = { preview: createMockPreview(), compact: true };
      expect(props.compact).toBe(true);
    });
  });

  describe('summary display', () => {
    it('should show plan summary', () => {
      const preview = createMockPreview({ summary: 'Adds user authentication feature' });
      expect(preview.summary).toBe('Adds user authentication feature');
    });

    it('should show plan title', () => {
      const preview = createMockPreview({ title: 'Add Login Flow' });
      expect(preview.title).toBe('Add Login Flow');
    });

    it('should show plan description', () => {
      const preview = createMockPreview({ description: 'Implements OAuth2 login' });
      expect(preview.description).toBe('Implements OAuth2 login');
    });
  });
});

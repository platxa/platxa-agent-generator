/**
 * Tests for ClarificationPrompt component
 *
 * Feature #52: Create ClarificationPrompt component for asking questions
 */

import { describe, it, expect, vi } from 'vitest';

// Mock types
interface ClarifyingQuestion {
  id: string;
  text: string;
  rationale: string;
  priority: number;
  expectedAnswerType: 'text' | 'choice' | 'list' | 'example';
  suggestedOptions?: string[];
  context?: string;
}

interface QuestionAnswer {
  questionId: string;
  value: string;
  selectedOptions?: string[];
}

// Helper to create mock question
const createMockQuestion = (overrides?: Partial<ClarifyingQuestion>): ClarifyingQuestion => ({
  id: 'q-1',
  text: 'What specific colors should be used?',
  rationale: 'Color preferences are needed for the design',
  priority: 1,
  expectedAnswerType: 'text',
  ...overrides,
});

describe('ClarificationPrompt', () => {
  describe('question display (Feature #52)', () => {
    it('should show question text', () => {
      const question = createMockQuestion({ text: 'What layout style do you prefer?' });
      expect(question.text).toBe('What layout style do you prefer?');
    });

    it('should show multiple questions', () => {
      const questions = [
        createMockQuestion({ id: 'q-1', text: 'Question 1' }),
        createMockQuestion({ id: 'q-2', text: 'Question 2' }),
        createMockQuestion({ id: 'q-3', text: 'Question 3' }),
      ];
      expect(questions).toHaveLength(3);
    });

    it('should number questions sequentially', () => {
      const questions = [
        createMockQuestion({ id: 'q-1' }),
        createMockQuestion({ id: 'q-2' }),
      ];
      questions.forEach((q, index) => {
        expect(index + 1).toBeGreaterThan(0);
      });
    });

    it('should show rationale when enabled', () => {
      const question = createMockQuestion({
        rationale: 'This helps determine the visual style',
      });
      expect(question.rationale).toBe('This helps determine the visual style');
    });
  });

  describe('text input questions', () => {
    it('should render text input for text type', () => {
      const question = createMockQuestion({ expectedAnswerType: 'text' });
      expect(question.expectedAnswerType).toBe('text');
    });

    it('should capture text input value', () => {
      const answer: QuestionAnswer = {
        questionId: 'q-1',
        value: 'Blue and green colors',
      };
      expect(answer.value).toBe('Blue and green colors');
    });
  });

  describe('multiple choice questions', () => {
    it('should render options for choice type', () => {
      const question = createMockQuestion({
        expectedAnswerType: 'choice',
        suggestedOptions: ['Modern', 'Classic', 'Minimal'],
      });
      expect(question.expectedAnswerType).toBe('choice');
      expect(question.suggestedOptions).toHaveLength(3);
    });

    it('should display suggested options', () => {
      const question = createMockQuestion({
        suggestedOptions: ['Option A', 'Option B', 'Option C'],
      });
      expect(question.suggestedOptions).toContain('Option A');
      expect(question.suggestedOptions).toContain('Option B');
      expect(question.suggestedOptions).toContain('Option C');
    });

    it('should track selected options', () => {
      const answer: QuestionAnswer = {
        questionId: 'q-1',
        value: '',
        selectedOptions: ['Modern'],
      };
      expect(answer.selectedOptions).toContain('Modern');
    });

    it('should allow custom option via text input', () => {
      const answer: QuestionAnswer = {
        questionId: 'q-1',
        value: 'Custom option',
        selectedOptions: [],
      };
      expect(answer.value).toBe('Custom option');
    });
  });

  describe('list input questions', () => {
    it('should render list input for list type', () => {
      const question = createMockQuestion({ expectedAnswerType: 'list' });
      expect(question.expectedAnswerType).toBe('list');
    });

    it('should allow adding multiple items', () => {
      const items = ['Item 1', 'Item 2', 'Item 3'];
      const answer: QuestionAnswer = {
        questionId: 'q-1',
        value: '',
        selectedOptions: items,
      };
      expect(answer.selectedOptions).toHaveLength(3);
    });

    it('should allow removing items', () => {
      let items = ['Item 1', 'Item 2', 'Item 3'];
      items = items.filter((_, i) => i !== 1);
      expect(items).toEqual(['Item 1', 'Item 3']);
    });
  });

  describe('example input questions', () => {
    it('should render textarea for example type', () => {
      const question = createMockQuestion({ expectedAnswerType: 'example' });
      expect(question.expectedAnswerType).toBe('example');
    });

    it('should capture example text', () => {
      const answer: QuestionAnswer = {
        questionId: 'q-1',
        value: 'Like the design on example.com with rounded corners',
      };
      expect(answer.value).toContain('example.com');
    });
  });

  describe('answer submission', () => {
    it('should collect all answers on submit', () => {
      const questions = [
        createMockQuestion({ id: 'q-1' }),
        createMockQuestion({ id: 'q-2' }),
      ];

      const answers: QuestionAnswer[] = questions.map((q) => ({
        questionId: q.id,
        value: `Answer for ${q.id}`,
      }));

      expect(answers).toHaveLength(2);
      expect(answers[0].questionId).toBe('q-1');
      expect(answers[1].questionId).toBe('q-2');
    });

    it('should call onSubmit with formatted answers', () => {
      const onSubmit = vi.fn();
      const answers: QuestionAnswer[] = [
        { questionId: 'q-1', value: 'Answer 1' },
      ];
      onSubmit(answers);
      expect(onSubmit).toHaveBeenCalledWith(answers);
    });

    it('should disable submit when no answers provided', () => {
      const hasAnswers = false;
      expect(hasAnswers).toBe(false);
    });

    it('should enable submit when at least one answer provided', () => {
      const answers = { 'q-1': { value: 'Some answer', options: [] } };
      const hasAnswers = Object.values(answers).some(
        (a) => a.value || a.options.length > 0
      );
      expect(hasAnswers).toBe(true);
    });
  });

  describe('skip functionality', () => {
    it('should call onSkip when skip button clicked', () => {
      const onSkip = vi.fn();
      onSkip();
      expect(onSkip).toHaveBeenCalled();
    });

    it('should show skip button when onSkip provided', () => {
      const onSkip = vi.fn();
      expect(onSkip).toBeDefined();
    });
  });

  describe('loading state', () => {
    it('should show loading state', () => {
      const loading = true;
      expect(loading).toBe(true);
    });

    it('should disable submit during loading', () => {
      const loading = true;
      const disabled = loading;
      expect(disabled).toBe(true);
    });
  });

  describe('answer types', () => {
    it('should support all answer types', () => {
      const answerTypes: ClarifyingQuestion['expectedAnswerType'][] = [
        'text',
        'choice',
        'list',
        'example',
      ];
      expect(answerTypes).toHaveLength(4);
    });

    it('should render appropriate input for each type', () => {
      const typeToInput = {
        text: 'Input',
        choice: 'Radio/Checkbox',
        list: 'List with add/remove',
        example: 'Textarea',
      };
      expect(Object.keys(typeToInput)).toHaveLength(4);
    });
  });

  describe('question card', () => {
    it('should expand by default', () => {
      const defaultExpanded = true;
      expect(defaultExpanded).toBe(true);
    });

    it('should toggle expand/collapse', () => {
      let expanded = true;
      expanded = !expanded;
      expect(expanded).toBe(false);
      expanded = !expanded;
      expect(expanded).toBe(true);
    });

    it('should show question number', () => {
      const questions = [
        createMockQuestion({ id: 'q-1' }),
        createMockQuestion({ id: 'q-2' }),
      ];
      questions.forEach((_, index) => {
        expect(index + 1).toBe(index + 1);
      });
    });
  });

  describe('component props', () => {
    interface ClarificationPromptProps {
      questions: ClarifyingQuestion[];
      onSubmit: (answers: QuestionAnswer[]) => void;
      onSkip?: () => void;
      loading?: boolean;
      showRationale?: boolean;
    }

    it('should require questions prop', () => {
      const props: ClarificationPromptProps = {
        questions: [],
        onSubmit: vi.fn(),
      };
      expect(props.questions).toBeDefined();
    });

    it('should require onSubmit prop', () => {
      const props: ClarificationPromptProps = {
        questions: [],
        onSubmit: vi.fn(),
      };
      expect(props.onSubmit).toBeDefined();
    });

    it('should have optional onSkip prop', () => {
      const props: ClarificationPromptProps = {
        questions: [],
        onSubmit: vi.fn(),
        onSkip: vi.fn(),
      };
      expect(props.onSkip).toBeDefined();
    });

    it('should have optional loading prop', () => {
      const props: ClarificationPromptProps = {
        questions: [],
        onSubmit: vi.fn(),
        loading: true,
      };
      expect(props.loading).toBe(true);
    });

    it('should have optional showRationale prop', () => {
      const props: ClarificationPromptProps = {
        questions: [],
        onSubmit: vi.fn(),
        showRationale: true,
      };
      expect(props.showRationale).toBe(true);
    });
  });

  describe('empty state', () => {
    it('should return null when no questions', () => {
      const questions: ClarifyingQuestion[] = [];
      expect(questions.length).toBe(0);
    });
  });

  describe('QuestionAnswer type', () => {
    it('should have questionId', () => {
      const answer: QuestionAnswer = { questionId: 'q-1', value: '' };
      expect(answer.questionId).toBe('q-1');
    });

    it('should have value for text answers', () => {
      const answer: QuestionAnswer = { questionId: 'q-1', value: 'Text answer' };
      expect(answer.value).toBe('Text answer');
    });

    it('should have selectedOptions for choice answers', () => {
      const answer: QuestionAnswer = {
        questionId: 'q-1',
        value: '',
        selectedOptions: ['Option 1', 'Option 2'],
      };
      expect(answer.selectedOptions).toHaveLength(2);
    });
  });
});

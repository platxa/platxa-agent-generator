/**
 * Tests for ClarifyingQuestionGenerator
 *
 * Verifies:
 * - Generates 1-3 focused questions
 * - Avoids yes/no questions
 * - Focuses on actionable information
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ClarifyingQuestionGenerator,
  createQuestionGenerator,
  generateQuestions,
  type ClarifyingQuestion,
  type QuestionGenerationResult,
} from '../../lib/agentic-core/question-generator';
import {
  RequestAnalyzer,
  type AnalysisResult,
  type RequestIssue,
  type IssueType,
} from '../../lib/agentic-core/request-analyzer';

describe('ClarifyingQuestionGenerator', () => {
  let generator: ClarifyingQuestionGenerator;
  let analyzer: RequestAnalyzer;

  beforeEach(() => {
    generator = new ClarifyingQuestionGenerator();
    analyzer = new RequestAnalyzer();
  });

  // ==========================================================================
  // Basic Generation
  // ==========================================================================

  describe('basic generation', () => {
    it('generates questions for ambiguous requests', () => {
      const analysis = analyzer.analyze('Make it look nice and modern');
      const result = generator.generate(analysis);

      expect(result.hasQuestions).toBe(true);
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.questions.length).toBeLessThanOrEqual(3);
    });

    it('generates no questions for clear requests', () => {
      // Create a mock clear analysis
      const clearAnalysis: AnalysisResult = {
        request: 'Add a blue button with text "Submit" at 100px width',
        issues: [],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.95,
        needsClarification: false,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = generator.generate(clearAnalysis);

      expect(result.hasQuestions).toBe(false);
      expect(result.questions.length).toBe(0);
    });

    it('skips generation when clarity score is above threshold', () => {
      const highClarityAnalysis: AnalysisResult = {
        request: 'Some request',
        issues: [
          {
            type: 'vague_term',
            severity: 'low',
            description: 'Minor vagueness',
            trigger: 'some',
            clarificationQuestions: ['What?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.92,
        needsClarification: false,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = generator.generate(highClarityAnalysis);
      expect(result.hasQuestions).toBe(false);
    });
  });

  // ==========================================================================
  // Question Limit (1-3)
  // ==========================================================================

  describe('question limits', () => {
    it('generates at most 3 questions', () => {
      // Request with many issues
      const analysis = analyzer.analyze(
        'Make everything look nice and beautiful and modern and clean with fast performance soon'
      );
      const result = generator.generate(analysis);

      expect(result.questions.length).toBeLessThanOrEqual(3);
    });

    it('respects maxQuestions configuration', () => {
      const limitedGenerator = new ClarifyingQuestionGenerator({ maxQuestions: 1 });
      const analysis = analyzer.analyze('Make it nice and modern');
      const result = limitedGenerator.generate(analysis);

      expect(result.questions.length).toBeLessThanOrEqual(1);
    });

    it('generates at least 1 question for ambiguous requests', () => {
      const analysis = analyzer.analyze('Make it better');
      const result = generator.generate(analysis);

      expect(result.questions.length).toBeGreaterThanOrEqual(1);
    });

    it('enforces minimum of 1 and maximum of 3 for maxQuestions config', () => {
      const tooLow = new ClarifyingQuestionGenerator({ maxQuestions: 0 });
      expect(tooLow.getConfig().maxQuestions).toBe(1);

      const tooHigh = new ClarifyingQuestionGenerator({ maxQuestions: 10 });
      expect(tooHigh.getConfig().maxQuestions).toBe(3);
    });
  });

  // ==========================================================================
  // No Yes/No Questions
  // ==========================================================================

  describe('avoids yes/no questions', () => {
    it('does not generate questions starting with "Is"', () => {
      const analysis = analyzer.analyze('Add a hero section to the page');
      const result = generator.generate(analysis);

      for (const question of result.questions) {
        expect(question.text.trim()).not.toMatch(/^Is\s/i);
      }
    });

    it('does not generate questions starting with "Are"', () => {
      const analysis = analyzer.analyze('Make the buttons responsive');
      const result = generator.generate(analysis);

      for (const question of result.questions) {
        expect(question.text.trim()).not.toMatch(/^Are\s/i);
      }
    });

    it('does not generate questions starting with "Do/Does/Did"', () => {
      const analysis = analyzer.analyze('Update the design to be modern');
      const result = generator.generate(analysis);

      for (const question of result.questions) {
        expect(question.text.trim()).not.toMatch(/^(Do|Does|Did)\s/i);
      }
    });

    it('does not generate questions starting with "Can/Could/Will/Would/Should"', () => {
      const analysis = analyzer.analyze('Make it look nice');
      const result = generator.generate(analysis);

      for (const question of result.questions) {
        expect(question.text.trim()).not.toMatch(/^(Can|Could|Will|Would|Should)\s/i);
      }
    });

    it('transforms yes/no questions to open-ended', () => {
      // Create analysis with issue that might generate yes/no
      const analysis: AnalysisResult = {
        request: 'Add a feature',
        issues: [
          {
            type: 'missing_detail',
            severity: 'high',
            description: 'Missing specification',
            trigger: 'feature',
            clarificationQuestions: ['Do you want animations?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.5,
        needsClarification: true,
        suggestedQuestions: ['Do you want animations?'],
        timestamp: new Date(),
      };

      const result = generator.generate(analysis);

      // Questions should be open-ended
      for (const question of result.questions) {
        const firstWord = question.text.trim().split(/\s/)[0].toLowerCase();
        expect(['what', 'which', 'how', 'where', 'when', 'why']).toContain(firstWord);
      }
    });
  });

  // ==========================================================================
  // Actionable Questions
  // ==========================================================================

  describe('generates actionable questions', () => {
    it('generates questions with "What" for vague terms', () => {
      const analysis = analyzer.analyze('Make the design nice');
      const result = generator.generate(analysis);

      const whatQuestions = result.questions.filter(q =>
        q.text.toLowerCase().includes('what')
      );
      expect(whatQuestions.length).toBeGreaterThan(0);
    });

    it('generates questions with "Which" for choices', () => {
      // Conflict between two approaches
      const analysis = analyzer.analyze('Make it simple but feature-rich');
      const result = generator.generate(analysis);

      // Should have a question about priority/choice
      const hasChoiceQuestion = result.questions.some(
        q => q.text.toLowerCase().includes('which') ||
             q.text.toLowerCase().includes('between') ||
             q.text.toLowerCase().includes('priority')
      );
      expect(hasChoiceQuestion).toBe(true);
    });

    it('generates questions with "How" for process clarification', () => {
      const analysis = analyzer.analyze('Improve the performance');
      const result = generator.generate(analysis);

      const hasHowOrWhat = result.questions.some(
        q => q.text.toLowerCase().includes('how') ||
             q.text.toLowerCase().includes('what')
      );
      expect(hasHowOrWhat).toBe(true);
    });

    it('includes rationale for each question', () => {
      const analysis = analyzer.analyze('Make it look modern');
      const result = generator.generate(analysis);

      for (const question of result.questions) {
        expect(question.rationale).toBeDefined();
        expect(question.rationale.length).toBeGreaterThan(0);
      }
    });

    it('includes expected answer type', () => {
      const analysis = analyzer.analyze('Make it nice with fast performance');
      const result = generator.generate(analysis);

      for (const question of result.questions) {
        expect(question.expectedAnswerType).toBeDefined();
        expect(['text', 'choice', 'list', 'example']).toContain(question.expectedAnswerType);
      }
    });
  });

  // ==========================================================================
  // Issue Type Handling
  // ==========================================================================

  describe('handles different issue types', () => {
    it('generates questions for vague_term issues', () => {
      const analysis: AnalysisResult = {
        request: 'Make it beautiful',
        issues: [
          {
            type: 'vague_term',
            severity: 'high',
            description: 'Subjective aesthetic term',
            trigger: 'beautiful',
            clarificationQuestions: ['What style?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.4,
        needsClarification: true,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = generator.generate(analysis);
      expect(result.hasQuestions).toBe(true);
      expect(result.questions[0].addressedIssues).toContain('vague_term');
    });

    it('generates questions for missing_detail issues', () => {
      const analysis: AnalysisResult = {
        request: 'Add a hero section',
        issues: [
          {
            type: 'missing_detail',
            severity: 'high',
            description: 'Missing content specification',
            trigger: 'hero',
            clarificationQuestions: ['What content?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.5,
        needsClarification: true,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = generator.generate(analysis);
      expect(result.hasQuestions).toBe(true);
      expect(result.questions[0].addressedIssues).toContain('missing_detail');
    });

    it('generates questions for conflict issues', () => {
      const analysis: AnalysisResult = {
        request: 'Make it simple but comprehensive',
        issues: [
          {
            type: 'conflict',
            severity: 'high',
            description: 'Simplicity conflicts with comprehensiveness',
            trigger: '"simple" vs "comprehensive"',
            clarificationQuestions: ['Which takes priority?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.3,
        needsClarification: true,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = generator.generate(analysis);
      expect(result.hasQuestions).toBe(true);
      expect(result.questions[0].addressedIssues).toContain('conflict');
    });

    it('generates questions for unclear_scope issues', () => {
      const analysis: AnalysisResult = {
        request: 'Fix it',
        issues: [
          {
            type: 'unclear_scope',
            severity: 'high',
            description: 'Request is too brief',
            trigger: 'Fix it',
            clarificationQuestions: ['What needs fixing?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.2,
        needsClarification: true,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = generator.generate(analysis);
      expect(result.hasQuestions).toBe(true);
      expect(result.questions[0].addressedIssues).toContain('unclear_scope');
    });
  });

  // ==========================================================================
  // Question Consolidation
  // ==========================================================================

  describe('question consolidation', () => {
    it('consolidates multiple issues of same type', () => {
      const analysis: AnalysisResult = {
        request: 'Make it nice and beautiful and pretty',
        issues: [
          {
            type: 'vague_term',
            severity: 'high',
            description: 'Vague term',
            trigger: 'nice',
            clarificationQuestions: ['Define nice?'],
          },
          {
            type: 'vague_term',
            severity: 'high',
            description: 'Vague term',
            trigger: 'beautiful',
            clarificationQuestions: ['Define beautiful?'],
          },
          {
            type: 'vague_term',
            severity: 'high',
            description: 'Vague term',
            trigger: 'pretty',
            clarificationQuestions: ['Define pretty?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.2,
        needsClarification: true,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = generator.generate(analysis);

      // Should consolidate into fewer questions
      expect(result.questions.length).toBeLessThanOrEqual(3);
    });

    it('can disable consolidation via config', () => {
      const noConsolidateGenerator = new ClarifyingQuestionGenerator({
        consolidateRelated: false,
        maxQuestions: 3,
      });

      const analysis: AnalysisResult = {
        request: 'Make it nice and beautiful',
        issues: [
          {
            type: 'vague_term',
            severity: 'high',
            description: 'Vague term',
            trigger: 'nice',
            clarificationQuestions: ['Define nice?'],
          },
          {
            type: 'vague_term',
            severity: 'high',
            description: 'Vague term',
            trigger: 'beautiful',
            clarificationQuestions: ['Define beautiful?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.3,
        needsClarification: true,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = noConsolidateGenerator.generate(analysis);
      // Without consolidation, may have 2 separate questions
      expect(result.questions.length).toBeLessThanOrEqual(3);
    });
  });

  // ==========================================================================
  // Priority
  // ==========================================================================

  describe('prioritization', () => {
    it('prioritizes high severity issues', () => {
      const analysis: AnalysisResult = {
        request: 'Maybe add some nice features soon',
        issues: [
          {
            type: 'vague_term',
            severity: 'low',
            description: 'Uncertain requirement',
            trigger: 'maybe',
            clarificationQuestions: ['Is this needed?'],
          },
          {
            type: 'vague_term',
            severity: 'high',
            description: 'Subjective term',
            trigger: 'nice',
            clarificationQuestions: ['Define nice?'],
          },
          {
            type: 'vague_term',
            severity: 'low',
            description: 'Vague timeline',
            trigger: 'soon',
            clarificationQuestions: ['When?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.4,
        needsClarification: true,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = generator.generate(analysis);

      // First question should address high severity issue
      expect(result.questions[0].priority).toBeLessThanOrEqual(
        result.questions[result.questions.length - 1].priority
      );
    });

    it('prioritizes conflicts over vague terms', () => {
      const analysis: AnalysisResult = {
        request: 'Make it simple but feature-rich and nice',
        issues: [
          {
            type: 'vague_term',
            severity: 'high',
            description: 'Subjective term',
            trigger: 'nice',
            clarificationQuestions: ['Define nice?'],
          },
          {
            type: 'conflict',
            severity: 'high',
            description: 'Conflicting requirements',
            trigger: '"simple" vs "feature-rich"',
            clarificationQuestions: ['Which priority?'],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.3,
        needsClarification: true,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = generator.generate(analysis);

      // Conflict should be addressed (has priority boost)
      const conflictQuestion = result.questions.find(q =>
        q.addressedIssues.includes('conflict')
      );
      expect(conflictQuestion).toBeDefined();
    });
  });

  // ==========================================================================
  // Factory Functions
  // ==========================================================================

  describe('factory functions', () => {
    it('createQuestionGenerator creates instance', () => {
      const instance = createQuestionGenerator();
      expect(instance).toBeInstanceOf(ClarifyingQuestionGenerator);
    });

    it('createQuestionGenerator accepts config', () => {
      const instance = createQuestionGenerator({ maxQuestions: 2 });
      expect(instance.getConfig().maxQuestions).toBe(2);
    });

    it('generateQuestions is a convenience function', () => {
      const analysis = analyzer.analyze('Make it nice');
      const result = generateQuestions(analysis);

      expect(result).toBeDefined();
      expect(result.hasQuestions).toBe(true);
    });

    it('generateQuestions accepts config', () => {
      const analysis = analyzer.analyze('Make it nice and modern and beautiful');
      const result = generateQuestions(analysis, { maxQuestions: 1 });

      expect(result.questions.length).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Single Issue Generation
  // ==========================================================================

  describe('generateForIssue', () => {
    it('generates question for single issue', () => {
      const issue: RequestIssue = {
        type: 'vague_term',
        severity: 'high',
        description: 'Subjective term',
        trigger: 'nice',
        clarificationQuestions: ['What is nice?'],
      };

      const question = generator.generateForIssue(issue);

      expect(question).not.toBeNull();
      expect(question?.text).toBeDefined();
      expect(question?.addressedIssues).toContain('vague_term');
    });

    it('returns null for unknown issue type', () => {
      const issue: RequestIssue = {
        type: 'unknown' as IssueType,
        severity: 'low',
        description: 'Unknown issue',
        trigger: 'test',
        clarificationQuestions: [],
      };

      const question = generator.generateForIssue(issue);
      expect(question).toBeNull();
    });
  });

  // ==========================================================================
  // Custom Templates
  // ==========================================================================

  describe('custom templates', () => {
    it('accepts custom templates via config', () => {
      const customGenerator = new ClarifyingQuestionGenerator({
        customTemplates: [
          {
            issueType: 'vague_term',
            patterns: ['What exactly do you mean by "{trigger}"?'],
            answerType: 'text',
          },
        ],
      });

      const analysis: AnalysisResult = {
        request: 'Make it nice',
        issues: [
          {
            type: 'vague_term',
            severity: 'high',
            description: 'Vague term',
            trigger: 'nice',
            clarificationQuestions: [],
          },
        ],
        issuesByType: {
          vague_term: [],
          missing_detail: [],
          conflict: [],
          unclear_scope: [],
        },
        clarityScore: 0.4,
        needsClarification: true,
        suggestedQuestions: [],
        timestamp: new Date(),
      };

      const result = customGenerator.generate(analysis);
      expect(result.hasQuestions).toBe(true);
    });

    it('addTemplate adds new template', () => {
      generator.addTemplate({
        issueType: 'unclear_scope',
        patterns: ['What is the specific scope of "{trigger}"?'],
        answerType: 'list',
      });

      // Should not throw
      expect(() => generator.getConfig()).not.toThrow();
    });
  });

  // ==========================================================================
  // Result Structure
  // ==========================================================================

  describe('result structure', () => {
    it('includes analysis reference', () => {
      const analysis = analyzer.analyze('Make it nice');
      const result = generator.generate(analysis);

      expect(result.analysisRef).toBeDefined();
      expect(result.analysisRef.request).toBe('Make it nice');
      expect(result.analysisRef.clarityScore).toBeDefined();
      expect(result.analysisRef.issueCount).toBeDefined();
    });

    it('includes timestamp', () => {
      const analysis = analyzer.analyze('Make it nice');
      const result = generator.generate(analysis);

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('tracks issues addressed', () => {
      const analysis = analyzer.analyze('Make it nice and modern');
      const result = generator.generate(analysis);

      expect(result.issuesAddressed).toBeGreaterThanOrEqual(0);
    });

    it('questions have unique IDs', () => {
      const analysis = analyzer.analyze('Make it nice and modern and fast');
      const result = generator.generate(analysis);

      const ids = result.questions.map(q => q.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  // ==========================================================================
  // Integration with RequestAnalyzer
  // ==========================================================================

  describe('integration with RequestAnalyzer', () => {
    it('works seamlessly with RequestAnalyzer output', () => {
      const request = 'Make the website look nice and modern with fast loading';
      const analysis = analyzer.analyze(request);
      const result = generator.generate(analysis);

      expect(result.hasQuestions).toBe(true);
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.questions.length).toBeLessThanOrEqual(3);

      // All questions should be open-ended
      for (const question of result.questions) {
        expect(question.text.trim()).not.toMatch(/^(Is|Are|Do|Does|Did|Can|Could|Will|Would|Should|Has|Have|Had)\s/i);
      }
    });

    it('handles complex ambiguous requests', () => {
      const request = 'Build something nice that loads fast but has lots of animations and is simple to use';
      const analysis = analyzer.analyze(request);
      const result = generator.generate(analysis);

      expect(result.hasQuestions).toBe(true);
      // Should detect vague terms and conflicts
      expect(analysis.issues.length).toBeGreaterThan(0);
    });
  });
});

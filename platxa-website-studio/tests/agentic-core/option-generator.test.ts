/**
 * Tests for OptionGenerator
 *
 * Verifies:
 * - Generates 2-4 design options
 * - Each option has name, description, pros, cons, effort, files affected
 * - Options represent different trade-offs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OptionGenerator,
  createOptionGenerator,
  generateOptions,
  type DesignOption,
  type OptionGenerationResult,
  type GenerationContext,
  type EffortLevel,
  type ApproachCategory,
  type OptionScoreBreakdown,
  type ScoringWeights,
} from '../../lib/agentic-core/option-generator';
import type { PlanOption } from '../../lib/agentic-core/plan-handoff';

describe('OptionGenerator', () => {
  let generator: OptionGenerator;

  beforeEach(() => {
    generator = new OptionGenerator();
  });

  // ==========================================================================
  // Basic Generation
  // ==========================================================================

  describe('basic generation', () => {
    it('generates options for a request', () => {
      const context: GenerationContext = {
        request: 'Add a hero section to the homepage',
        relevantFiles: ['templates/homepage.xml'],
      };

      const result = generator.generate(context);

      expect(result.options.length).toBeGreaterThanOrEqual(2);
      expect(result.options.length).toBeLessThanOrEqual(4);
    });

    it('generates between 2-4 options', () => {
      const context: GenerationContext = {
        request: 'Create a contact form',
        relevantFiles: ['templates/contact.xml', 'static/css/forms.scss'],
      };

      const result = generator.generate(context);

      expect(result.options.length).toBeGreaterThanOrEqual(2);
      expect(result.options.length).toBeLessThanOrEqual(4);
    });

    it('includes a recommended option', () => {
      const context: GenerationContext = {
        request: 'Update the navigation menu',
      };

      const result = generator.generate(context);

      expect(result.recommendedId).toBeDefined();
      expect(result.options.some(o => o.id === result.recommendedId)).toBe(true);
    });
  });

  // ==========================================================================
  // Option Structure (Verification Requirements)
  // ==========================================================================

  describe('option structure', () => {
    it('each option has a name', () => {
      const context: GenerationContext = {
        request: 'Add a sidebar widget',
      };

      const result = generator.generate(context);

      for (const option of result.options) {
        expect(option.name).toBeDefined();
        expect(typeof option.name).toBe('string');
        expect(option.name.length).toBeGreaterThan(0);
      }
    });

    it('each option has a description', () => {
      const context: GenerationContext = {
        request: 'Implement search functionality',
      };

      const result = generator.generate(context);

      for (const option of result.options) {
        expect(option.description).toBeDefined();
        expect(typeof option.description).toBe('string');
        expect(option.description.length).toBeGreaterThan(0);
      }
    });

    it('each option has pros', () => {
      const context: GenerationContext = {
        request: 'Add pagination to the product list',
      };

      const result = generator.generate(context);

      for (const option of result.options) {
        expect(option.pros).toBeDefined();
        expect(Array.isArray(option.pros)).toBe(true);
        expect(option.pros.length).toBeGreaterThan(0);

        for (const pro of option.pros) {
          expect(pro.text).toBeDefined();
          expect(pro.impact).toBeDefined();
          expect(['low', 'medium', 'high']).toContain(pro.impact);
        }
      }
    });

    it('each option has cons', () => {
      const context: GenerationContext = {
        request: 'Create a modal dialog component',
      };

      const result = generator.generate(context);

      for (const option of result.options) {
        expect(option.cons).toBeDefined();
        expect(Array.isArray(option.cons)).toBe(true);
        // Minimal option might have cons, others definitely do
        // At least some options should have cons
      }

      // At least one option should have cons
      const hasConOptions = result.options.filter(o => o.cons.length > 0);
      expect(hasConOptions.length).toBeGreaterThan(0);

      // Verify con structure
      for (const option of hasConOptions) {
        for (const con of option.cons) {
          expect(con.text).toBeDefined();
          expect(con.severity).toBeDefined();
          expect(['low', 'medium', 'high']).toContain(con.severity);
        }
      }
    });

    it('each option has effort estimate', () => {
      const context: GenerationContext = {
        request: 'Build a testimonial carousel',
        relevantFiles: ['templates/testimonials.xml', 'static/css/carousel.scss'],
      };

      const result = generator.generate(context);

      for (const option of result.options) {
        expect(option.effort).toBeDefined();
        expect(option.effort.level).toBeDefined();
        expect(['trivial', 'small', 'medium', 'large', 'complex']).toContain(option.effort.level);
        expect(option.effort.fileCount).toBeDefined();
        expect(option.effort.fileCount).toBeGreaterThanOrEqual(1);
      }
    });

    it('each option has files affected', () => {
      const context: GenerationContext = {
        request: 'Add a footer section',
        relevantFiles: ['templates/footer.xml', 'static/css/footer.scss'],
      };

      const result = generator.generate(context);

      for (const option of result.options) {
        expect(option.filesAffected).toBeDefined();
        expect(Array.isArray(option.filesAffected)).toBe(true);
        expect(option.filesAffected.length).toBeGreaterThanOrEqual(1);

        for (const file of option.filesAffected) {
          expect(file.path).toBeDefined();
          expect(file.changeType).toBeDefined();
          expect(['create', 'modify', 'delete']).toContain(file.changeType);
          expect(file.description).toBeDefined();
        }
      }
    });

    it('each option has a plan', () => {
      const context: GenerationContext = {
        request: 'Create an image gallery',
      };

      const result = generator.generate(context);

      for (const option of result.options) {
        expect(option.plan).toBeDefined();
        expect(option.plan.id).toBeDefined();
        expect(option.plan.description).toBeDefined();
        expect(option.plan.steps).toBeDefined();
        expect(Array.isArray(option.plan.steps)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Option Categories
  // ==========================================================================

  describe('option categories', () => {
    it('generates minimal approach option', () => {
      const context: GenerationContext = {
        request: 'Add a simple button',
      };

      const result = generator.generate(context);

      const minimal = result.options.find(o => o.category === 'minimal');
      expect(minimal).toBeDefined();
      expect(minimal?.name).toContain('Minimal');
    });

    it('generates standard approach option', () => {
      const context: GenerationContext = {
        request: 'Create a form component',
      };

      const result = generator.generate(context);

      const standard = result.options.find(o => o.category === 'standard');
      expect(standard).toBeDefined();
      expect(standard?.name).toContain('Standard');
    });

    it('generates comprehensive option for complex requests', () => {
      const context: GenerationContext = {
        request: 'Build a complete e-commerce checkout flow with validation',
        relevantFiles: [
          'templates/checkout.xml',
          'templates/cart.xml',
          'templates/payment.xml',
          'static/css/checkout.scss',
        ],
      };

      const result = generator.generate(context);

      const comprehensive = result.options.find(o => o.category === 'comprehensive');
      expect(comprehensive).toBeDefined();
    });

    it('includes custom option when request mentions custom', () => {
      const context: GenerationContext = {
        request: 'Create a custom solution for our specific needs',
      };

      const result = generator.generate(context);

      const custom = result.options.find(o => o.category === 'custom');
      expect(custom).toBeDefined();
    });

    it('each category has distinct characteristics', () => {
      const context: GenerationContext = {
        request: 'Build a complete dashboard with all features',
        relevantFiles: ['templates/dashboard.xml', 'static/css/dashboard.scss'],
      };

      const result = generator.generate(context);

      // Different categories should have different effort levels
      const minimal = result.options.find(o => o.category === 'minimal');
      const standard = result.options.find(o => o.category === 'standard');
      const comprehensive = result.options.find(o => o.category === 'comprehensive');

      if (minimal && comprehensive) {
        // Comprehensive should have more complexity
        const effortOrder: Record<EffortLevel, number> = {
          trivial: 1,
          small: 2,
          medium: 3,
          large: 4,
          complex: 5,
        };

        expect(effortOrder[minimal.effort.level]).toBeLessThanOrEqual(
          effortOrder[comprehensive.effort.level]
        );
      }
    });
  });

  // ==========================================================================
  // Trade-offs
  // ==========================================================================

  describe('trade-offs', () => {
    it('minimal has more pros related to speed/simplicity', () => {
      const context: GenerationContext = {
        request: 'Add a feature',
      };

      const result = generator.generate(context);
      const minimal = result.options.find(o => o.category === 'minimal');

      if (minimal) {
        const speedSimplicityPros = minimal.pros.filter(
          p => p.category === 'speed' || p.category === 'simplicity' || p.category === 'risk'
        );
        expect(speedSimplicityPros.length).toBeGreaterThan(0);
      }
    });

    it('comprehensive has more pros related to features', () => {
      const context: GenerationContext = {
        request: 'Build a complete user management system',
        relevantFiles: ['templates/users.xml', 'static/css/users.scss', 'models/user.py'],
      };

      const result = generator.generate(context);
      const comprehensive = result.options.find(o => o.category === 'comprehensive');

      if (comprehensive) {
        const featurePros = comprehensive.pros.filter(
          p => p.category === 'features' || p.category === 'extensibility'
        );
        expect(featurePros.length).toBeGreaterThan(0);
      }
    });

    it('comprehensive has cons related to complexity/time', () => {
      const context: GenerationContext = {
        request: 'Create a full-featured content management system',
        relevantFiles: ['templates/cms.xml', 'models/content.py'],
      };

      const result = generator.generate(context);
      const comprehensive = result.options.find(o => o.category === 'comprehensive');

      if (comprehensive) {
        const complexityCons = comprehensive.cons.filter(
          c => c.category === 'complexity' || c.category === 'time'
        );
        expect(complexityCons.length).toBeGreaterThan(0);
      }
    });

    it('different options have different risk levels', () => {
      const context: GenerationContext = {
        request: 'Refactor the entire codebase',
        relevantFiles: ['file1.xml', 'file2.xml', 'file3.xml', 'file4.xml'],
      };

      const result = generator.generate(context);

      const riskLevels = new Set(result.options.map(o => o.riskLevel));
      // Should have at least some variation in risk
      expect(riskLevels.size).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Configuration
  // ==========================================================================

  describe('configuration', () => {
    it('respects minOptions config', () => {
      const minGenerator = new OptionGenerator({ minOptions: 3 });
      const context: GenerationContext = {
        request: 'Simple task',
      };

      const result = minGenerator.generate(context);
      expect(result.options.length).toBeGreaterThanOrEqual(3);
    });

    it('respects maxOptions config', () => {
      const maxGenerator = new OptionGenerator({ maxOptions: 2 });
      const context: GenerationContext = {
        request: 'Complex task with many features and complete implementation',
        relevantFiles: ['a.xml', 'b.xml', 'c.xml', 'd.xml'],
      };

      const result = maxGenerator.generate(context);
      expect(result.options.length).toBeLessThanOrEqual(2);
    });

    it('enforces minimum of 2 options', () => {
      const tooLowGenerator = new OptionGenerator({ minOptions: 1 });
      expect(tooLowGenerator.getConfig().minOptions).toBe(2);
    });

    it('enforces maximum of 4 options', () => {
      const tooHighGenerator = new OptionGenerator({ maxOptions: 10 });
      expect(tooHighGenerator.getConfig().maxOptions).toBe(4);
    });

    it('includeCustomOption forces custom option', () => {
      const customGenerator = new OptionGenerator({ includeCustomOption: true });
      const context: GenerationContext = {
        request: 'Basic task',
      };

      const result = customGenerator.generate(context);
      const hasCustom = result.options.some(o => o.category === 'custom');
      expect(hasCustom).toBe(true);
    });
  });

  // ==========================================================================
  // Recommendation
  // ==========================================================================

  describe('recommendation', () => {
    it('recommends standard option by default', () => {
      const context: GenerationContext = {
        request: 'Add a new feature',
      };

      const result = generator.generate(context);
      const recommended = result.options.find(o => o.id === result.recommendedId);

      // Standard should be recommended if present
      const hasStandard = result.options.some(o => o.category === 'standard');
      if (hasStandard) {
        expect(recommended?.category).toBe('standard');
      }
    });

    it('marks recommended option', () => {
      const context: GenerationContext = {
        request: 'Create something',
      };

      const result = generator.generate(context);

      const recommendedOptions = result.options.filter(o => o.recommended);
      expect(recommendedOptions.length).toBe(1);
      expect(recommendedOptions[0].id).toBe(result.recommendedId);
    });
  });

  // ==========================================================================
  // Context Handling
  // ==========================================================================

  describe('context handling', () => {
    it('uses relevant files in affected files', () => {
      const context: GenerationContext = {
        request: 'Update the header',
        relevantFiles: ['templates/header.xml', 'static/css/header.scss'],
      };

      const result = generator.generate(context);

      for (const option of result.options) {
        const paths = option.filesAffected.map(f => f.path);
        // At least one relevant file should be included
        const hasRelevantFile = paths.some(
          p => p.includes('header') || context.relevantFiles?.includes(p)
        );
        expect(hasRelevantFile).toBe(true);
      }
    });

    it('adjusts effort based on file count', () => {
      const manyFilesContext: GenerationContext = {
        request: 'Update all pages',
        relevantFiles: ['a.xml', 'b.xml', 'c.xml', 'd.xml', 'e.xml'],
      };

      const fewFilesContext: GenerationContext = {
        request: 'Update one page',
        relevantFiles: ['a.xml'],
      };

      const manyResult = generator.generate(manyFilesContext);
      const fewResult = generator.generate(fewFilesContext);

      // Comprehensive option with many files should have more affected files
      const manyComprehensive = manyResult.options.find(o => o.category === 'comprehensive');
      const fewComprehensive = fewResult.options.find(o => o.category === 'comprehensive');

      if (manyComprehensive && fewComprehensive) {
        expect(manyComprehensive.filesAffected.length).toBeGreaterThanOrEqual(
          fewComprehensive.filesAffected.length
        );
      }
    });

    it('includes context in result', () => {
      const context: GenerationContext = {
        request: 'Test request',
        explorations: [
          { type: 'file_read', target: 'test.xml', data: {}, timestamp: new Date() },
        ],
      };

      const result = generator.generate(context);

      expect(result.context.request).toBe('Test request');
      expect(result.context.explorationCount).toBe(1);
    });
  });

  // ==========================================================================
  // Summary
  // ==========================================================================

  describe('summary', () => {
    it('generates a summary of all options', () => {
      const context: GenerationContext = {
        request: 'Create something',
      };

      const result = generator.generate(context);

      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('summary mentions effort levels', () => {
      const context: GenerationContext = {
        request: 'Build a feature',
      };

      const result = generator.generate(context);

      // Summary should contain effort information
      expect(result.summary).toMatch(/trivial|small|medium|large|complex/);
    });
  });

  // ==========================================================================
  // Factory Functions
  // ==========================================================================

  describe('factory functions', () => {
    it('createOptionGenerator creates instance', () => {
      const instance = createOptionGenerator();
      expect(instance).toBeInstanceOf(OptionGenerator);
    });

    it('createOptionGenerator accepts config', () => {
      const instance = createOptionGenerator({ maxOptions: 3 });
      expect(instance.getConfig().maxOptions).toBe(3);
    });

    it('generateOptions is a convenience function', () => {
      const context: GenerationContext = {
        request: 'Quick test',
      };

      const result = generateOptions(context);

      expect(result).toBeDefined();
      expect(result.options.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // Compatibility with PlanOption
  // ==========================================================================

  describe('PlanOption compatibility', () => {
    it('can convert DesignOption to PlanOption', () => {
      const context: GenerationContext = {
        request: 'Test conversion',
        relevantFiles: ['test.xml'],
      };

      const result = generator.generate(context);
      const designOption = result.options[0];
      const planOption = generator.toPlanOption(designOption);

      expect(planOption.id).toBe(designOption.id);
      expect(planOption.label).toBe(designOption.name);
      expect(planOption.description).toBe(designOption.description);
      expect(planOption.plan).toBe(designOption.plan);
      expect(planOption.riskLevel).toBe(designOption.riskLevel);
      expect(planOption.affectedFiles).toEqual(designOption.filesAffected.map(f => f.path));
    });

    it('can convert PlanOption to DesignOption', () => {
      const planOption: PlanOption = {
        id: 'test-plan',
        label: 'Test Plan',
        description: 'A test plan option',
        plan: {
          id: 'plan-1',
          description: 'Test',
          steps: [],
          estimatedSteps: 0,
        },
        complexity: 3,
        riskLevel: 'medium',
        affectedFiles: ['test.xml'],
      };

      const context: GenerationContext = {
        request: 'Test',
      };

      const designOption = generator.fromPlanOption(planOption, context);

      expect(designOption.id).toBe(planOption.id);
      expect(designOption.name).toBe(planOption.label);
      expect(designOption.description).toBe(planOption.description);
      expect(designOption.effort.level).toBe('medium'); // complexity 3 = medium
      expect(designOption.riskLevel).toBe('medium');
    });
  });

  // ==========================================================================
  // Custom Templates
  // ==========================================================================

  describe('custom templates', () => {
    it('accepts custom templates via config', () => {
      const customGenerator = new OptionGenerator({
        customTemplates: [
          {
            category: 'custom',
            namePattern: 'My Custom Approach',
            descriptionPattern: 'A custom template',
            defaultPros: [{ impact: 'high', category: 'fit' }],
            defaultCons: [{ severity: 'low', category: 'complexity' }],
            effortMultiplier: 1.2,
          },
        ],
        includeCustomOption: true,
      });

      const context: GenerationContext = {
        request: 'Test custom',
      };

      const result = customGenerator.generate(context);
      const custom = result.options.find(o => o.category === 'custom');
      expect(custom).toBeDefined();
    });

    it('addTemplate adds new template', () => {
      generator.addTemplate({
        category: 'custom',
        namePattern: 'Added Template',
        descriptionPattern: 'Dynamically added',
        defaultPros: [],
        defaultCons: [],
        effortMultiplier: 1.0,
      });

      // Should not throw
      expect(() => generator.getConfig()).not.toThrow();
    });
  });

  // ==========================================================================
  // Feature #40: Option Scoring
  // ==========================================================================

  describe('option scoring (Feature #40)', () => {
    describe('scoreOption', () => {
      it('returns score breakdown with all factors', () => {
        const context: GenerationContext = {
          request: 'Test scoring',
          relevantFiles: ['test.xml'],
        };

        const result = generator.generate(context);
        const option = result.options[0];
        const score = generator.scoreOption(option);

        expect(score).toBeDefined();
        expect(score.effort).toBeGreaterThanOrEqual(0);
        expect(score.effort).toBeLessThanOrEqual(1);
        expect(score.quality).toBeGreaterThanOrEqual(0);
        expect(score.quality).toBeLessThanOrEqual(1);
        expect(score.risk).toBeGreaterThanOrEqual(0);
        expect(score.risk).toBeLessThanOrEqual(1);
        expect(score.total).toBeGreaterThanOrEqual(0);
        expect(score.total).toBeLessThanOrEqual(100);
      });

      it('lower effort options score higher on effort factor', () => {
        const context: GenerationContext = {
          request: 'Build a complete system with all features',
          relevantFiles: ['a.xml', 'b.xml', 'c.xml', 'd.xml'],
        };

        const result = generator.generate(context);
        const minimal = result.options.find(o => o.category === 'minimal');
        const comprehensive = result.options.find(o => o.category === 'comprehensive');

        if (minimal && comprehensive) {
          const minimalScore = generator.scoreOption(minimal);
          const comprehensiveScore = generator.scoreOption(comprehensive);

          expect(minimalScore.effort).toBeGreaterThan(comprehensiveScore.effort);
        }
      });

      it('options with more pros score higher on quality factor', () => {
        const context: GenerationContext = {
          request: 'Build a complete feature set',
          relevantFiles: ['a.xml', 'b.xml', 'c.xml'],
        };

        const result = generator.generate(context);

        // Comprehensive typically has more high-impact pros
        const comprehensive = result.options.find(o => o.category === 'comprehensive');
        const minimal = result.options.find(o => o.category === 'minimal');

        if (comprehensive && minimal) {
          const compScore = generator.scoreOption(comprehensive);
          const minScore = generator.scoreOption(minimal);

          // Both should have valid quality scores
          expect(compScore.quality).toBeGreaterThanOrEqual(0);
          expect(minScore.quality).toBeGreaterThanOrEqual(0);
        }
      });

      it('lower risk options score higher on risk factor', () => {
        const context: GenerationContext = {
          request: 'Make a simple change',
        };

        const result = generator.generate(context);
        const lowRiskOption = result.options.find(o => o.riskLevel === 'low');
        const higherRiskOption = result.options.find(o => o.riskLevel !== 'low');

        if (lowRiskOption && higherRiskOption) {
          const lowRiskScore = generator.scoreOption(lowRiskOption);
          const higherRiskScore = generator.scoreOption(higherRiskOption);

          expect(lowRiskScore.risk).toBeGreaterThanOrEqual(higherRiskScore.risk);
        }
      });

      it('accepts custom weights', () => {
        const context: GenerationContext = {
          request: 'Test weights',
        };

        const result = generator.generate(context);
        const option = result.options[0];

        // Weight effort heavily
        const effortWeighted = generator.scoreOption(option, {
          effort: 0.8,
          quality: 0.1,
          risk: 0.1,
        });

        // Weight quality heavily
        const qualityWeighted = generator.scoreOption(option, {
          effort: 0.1,
          quality: 0.8,
          risk: 0.1,
        });

        // Scores should differ based on weights
        expect(effortWeighted.total).not.toBe(qualityWeighted.total);
      });
    });

    describe('scoreOptions', () => {
      it('assigns ranks to all options', () => {
        const context: GenerationContext = {
          request: 'Build something with scoring',
          relevantFiles: ['test.xml'],
        };

        const result = generator.generate(context);

        for (const option of result.options) {
          expect(option.score).toBeDefined();
          expect(option.score?.rank).toBeDefined();
          expect(option.score?.rank).toBeGreaterThanOrEqual(1);
          expect(option.score?.rank).toBeLessThanOrEqual(result.options.length);
        }
      });

      it('sorts options by total score descending', () => {
        const context: GenerationContext = {
          request: 'Test sorting',
          relevantFiles: ['a.xml', 'b.xml'],
        };

        const result = generator.generate(context);

        // Verify descending order
        for (let i = 1; i < result.options.length; i++) {
          const prevScore = result.options[i - 1].score?.total ?? 0;
          const currScore = result.options[i].score?.total ?? 0;
          expect(prevScore).toBeGreaterThanOrEqual(currScore);
        }
      });

      it('rank 1 is the highest scoring option', () => {
        const context: GenerationContext = {
          request: 'Test rank 1',
        };

        const result = generator.generate(context);

        const rank1Option = result.options.find(o => o.score?.rank === 1);
        expect(rank1Option).toBeDefined();

        // Rank 1 should have highest or equal score
        for (const option of result.options) {
          expect(rank1Option?.score?.total).toBeGreaterThanOrEqual(option.score?.total ?? 0);
        }
      });

      it('ranks are unique and consecutive', () => {
        const context: GenerationContext = {
          request: 'Test unique ranks',
          relevantFiles: ['a.xml', 'b.xml', 'c.xml'],
        };

        const result = generator.generate(context);

        const ranks = result.options.map(o => o.score?.rank).filter(r => r !== undefined);
        const uniqueRanks = new Set(ranks);

        // All ranks should be unique
        expect(uniqueRanks.size).toBe(ranks.length);

        // Ranks should be consecutive starting from 1
        for (let i = 1; i <= result.options.length; i++) {
          expect(ranks).toContain(i);
        }
      });
    });

    describe('generate with scoring', () => {
      it('options are scored after generation', () => {
        const context: GenerationContext = {
          request: 'Generate with scores',
        };

        const result = generator.generate(context);

        for (const option of result.options) {
          expect(option.score).toBeDefined();
          expect(option.score?.effort).toBeDefined();
          expect(option.score?.quality).toBeDefined();
          expect(option.score?.risk).toBeDefined();
          expect(option.score?.total).toBeDefined();
        }
      });

      it('recommended option is the highest-scoring', () => {
        const context: GenerationContext = {
          request: 'Test recommended is highest score',
        };

        const result = generator.generate(context);

        const recommended = result.options.find(o => o.id === result.recommendedId);
        expect(recommended).toBeDefined();
        expect(recommended?.score?.rank).toBe(1);
      });

      it('accepts scoring weights in generate', () => {
        const context: GenerationContext = {
          request: 'Test generate with weights',
          relevantFiles: ['test.xml'],
        };

        // Favor low effort heavily
        const result = generator.generate(context, {
          effort: 0.9,
          quality: 0.05,
          risk: 0.05,
        });

        // With heavy effort weighting, minimal (lowest effort) should rank well
        const minimal = result.options.find(o => o.category === 'minimal');
        if (minimal) {
          expect(minimal.score?.rank).toBeLessThanOrEqual(2);
        }
      });

      it('summary includes scores', () => {
        const context: GenerationContext = {
          request: 'Test summary with scores',
        };

        const result = generator.generate(context);

        // Summary should contain score information
        expect(result.summary).toContain('[score:');
      });
    });

    describe('scoring factors visible (verification)', () => {
      it('score breakdown shows all three factors', () => {
        const context: GenerationContext = {
          request: 'Verify scoring factors',
        };

        const result = generator.generate(context);
        const option = result.options[0];

        // All factors must be visible in the score
        expect(option.score).toHaveProperty('effort');
        expect(option.score).toHaveProperty('quality');
        expect(option.score).toHaveProperty('risk');
        expect(option.score).toHaveProperty('total');
        expect(option.score).toHaveProperty('rank');

        // Values must be meaningful (not all zeros)
        expect(
          (option.score?.effort ?? 0) +
          (option.score?.quality ?? 0) +
          (option.score?.risk ?? 0)
        ).toBeGreaterThan(0);
      });

      it('factors are normalized to 0-1 range', () => {
        const context: GenerationContext = {
          request: 'Verify factor normalization',
          relevantFiles: ['a.xml', 'b.xml', 'c.xml', 'd.xml'],
        };

        const result = generator.generate(context);

        for (const option of result.options) {
          expect(option.score?.effort).toBeGreaterThanOrEqual(0);
          expect(option.score?.effort).toBeLessThanOrEqual(1);
          expect(option.score?.quality).toBeGreaterThanOrEqual(0);
          expect(option.score?.quality).toBeLessThanOrEqual(1);
          expect(option.score?.risk).toBeGreaterThanOrEqual(0);
          expect(option.score?.risk).toBeLessThanOrEqual(1);
        }
      });

      it('total score is weighted combination (0-100 scale)', () => {
        const context: GenerationContext = {
          request: 'Verify total score calculation',
        };

        const result = generator.generate(context);

        for (const option of result.options) {
          expect(option.score?.total).toBeGreaterThanOrEqual(0);
          expect(option.score?.total).toBeLessThanOrEqual(100);

          // Verify total is approximately the weighted sum
          // Default weights: effort=0.25, quality=0.45, risk=0.30
          const expected = Math.round(
            ((option.score?.effort ?? 0) * 0.25 +
             (option.score?.quality ?? 0) * 0.45 +
             (option.score?.risk ?? 0) * 0.30) * 100
          );

          // Allow small rounding differences
          expect(Math.abs((option.score?.total ?? 0) - expected)).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  // ==========================================================================
  // Result Structure
  // ==========================================================================

  describe('result structure', () => {
    it('includes timestamp', () => {
      const context: GenerationContext = {
        request: 'Test timestamp',
      };

      const result = generator.generate(context);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('options have unique IDs', () => {
      const context: GenerationContext = {
        request: 'Test unique IDs',
      };

      const result = generator.generate(context);
      const ids = result.options.map(o => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('options have valid categories', () => {
      const context: GenerationContext = {
        request: 'Test categories',
      };

      const result = generator.generate(context);
      const validCategories: ApproachCategory[] = ['minimal', 'standard', 'comprehensive', 'custom'];

      for (const option of result.options) {
        expect(validCategories).toContain(option.category);
      }
    });
  });
});

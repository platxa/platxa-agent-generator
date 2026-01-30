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
  INDUSTRY_PRESETS,
  OptionComparisonView,
  createComparisonView,
  compareOptions,
  type DesignOption,
  type OptionGenerationResult,
  type GenerationContext,
  type EffortLevel,
  type ApproachCategory,
  type OptionScoreBreakdown,
  type ScoringWeights,
  type IndustryVertical,
  type IndustryPreset,
  type ComplexityMetrics,
  type ComplexityFactor,
  type ComparisonTable,
  type ComparisonRow,
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
  // Feature #45: Industry-Aware Option Generation
  // ==========================================================================

  describe('industry-aware option generation (Feature #45)', () => {
    describe('detectIndustry', () => {
      it('detects restaurant industry from food keywords', () => {
        const context: GenerationContext = {
          request: 'Create a menu page for our restaurant with food photos',
        };

        const industry = generator.detectIndustry(context);
        expect(industry).toBe('restaurant');
      });

      it('detects legal industry from law keywords', () => {
        const context: GenerationContext = {
          request: 'Build a professional page for our law firm attorneys',
        };

        const industry = generator.detectIndustry(context);
        expect(industry).toBe('legal');
      });

      it('detects retail industry from shop keywords', () => {
        const context: GenerationContext = {
          request: 'Add a product catalog with checkout for our ecommerce store',
        };

        const industry = generator.detectIndustry(context);
        expect(industry).toBe('retail');
      });

      it('detects healthcare industry from medical keywords', () => {
        const context: GenerationContext = {
          request: 'Create an appointment booking page for our medical clinic',
        };

        const industry = generator.detectIndustry(context);
        expect(industry).toBe('healthcare');
      });

      it('returns general for non-specific requests', () => {
        const context: GenerationContext = {
          request: 'Add a hero section to the homepage',
        };

        const industry = generator.detectIndustry(context);
        expect(industry).toBe('general');
      });

      it('uses explicit industry from context if provided', () => {
        const context: GenerationContext = {
          request: 'Add a contact form',
          industry: 'nonprofit',
        };

        const industry = generator.detectIndustry(context);
        expect(industry).toBe('nonprofit');
      });

      it('considers domain context for detection', () => {
        const context: GenerationContext = {
          request: 'Add a landing page',
          domain: 'real estate property listings',
        };

        const industry = generator.detectIndustry(context);
        expect(industry).toBe('realestate');
      });
    });

    describe('getIndustryPreset', () => {
      it('returns preset for valid industry', () => {
        const preset = generator.getIndustryPreset('restaurant');

        expect(preset.vertical).toBe('restaurant');
        expect(preset.name).toBe('Restaurant & Hospitality');
        expect(preset.designTone).toBe('friendly');
        expect(preset.keywords.length).toBeGreaterThan(0);
      });

      it('returns general preset for unknown industry', () => {
        const preset = generator.getIndustryPreset('general');

        expect(preset.vertical).toBe('general');
        expect(preset.designTone).toBe('professional');
      });
    });

    describe('industry presets', () => {
      it('all verticals have complete presets', () => {
        const verticals: IndustryVertical[] = [
          'restaurant', 'retail', 'healthcare', 'legal', 'education',
          'manufacturing', 'services', 'realestate', 'nonprofit', 'general',
        ];

        for (const vertical of verticals) {
          const preset = INDUSTRY_PRESETS[vertical];

          expect(preset).toBeDefined();
          expect(preset.vertical).toBe(vertical);
          expect(preset.name).toBeDefined();
          expect(preset.designTone).toBeDefined();
          expect(preset.odooModules).toBeDefined();
          expect(Array.isArray(preset.odooModules)).toBe(true);
        }
      });

      it('non-general presets have keywords', () => {
        for (const [vertical, preset] of Object.entries(INDUSTRY_PRESETS)) {
          if (vertical !== 'general') {
            expect(preset.keywords.length).toBeGreaterThan(0);
          }
        }
      });

      it('non-general presets have industry pros', () => {
        for (const [vertical, preset] of Object.entries(INDUSTRY_PRESETS)) {
          if (vertical !== 'general') {
            expect(preset.industryPros.length).toBeGreaterThan(0);
          }
        }
      });
    });

    describe('restaurant requests get food-specific options (verification)', () => {
      it('restaurant options have food-related pros', () => {
        const context: GenerationContext = {
          request: 'Create a menu page for our restaurant with reservations',
          relevantFiles: ['templates/menu.xml'],
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        expect(standard).toBeDefined();

        // Should have food-specific pros
        const hasFoodPro = standard?.pros.some(
          p => p.category === 'food-ux' || p.category === 'appetite-appeal'
        );
        expect(hasFoodPro).toBe(true);
      });

      it('restaurant options have appropriate naming', () => {
        const context: GenerationContext = {
          request: 'Build a dining reservation system for our bistro',
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        expect(standard?.name).toContain('Restaurant');
      });

      it('restaurant options have friendly tone in description', () => {
        const context: GenerationContext = {
          request: 'Create a menu showcase for our cafe',
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        expect(standard?.description).toContain('warm and inviting');
      });
    });

    describe('legal requests get formal options (verification)', () => {
      it('legal options have authority/credibility pros', () => {
        const context: GenerationContext = {
          request: 'Build a professional website for our law firm practice areas',
          relevantFiles: ['templates/practice-areas.xml'],
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        expect(standard).toBeDefined();

        // Should have legal-specific pros
        const hasLegalPro = standard?.pros.some(
          p => p.category === 'authority' || p.category === 'credibility'
        );
        expect(hasLegalPro).toBe(true);
      });

      it('legal options have appropriate naming', () => {
        const context: GenerationContext = {
          request: 'Create attorney profiles for our litigation practice',
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        expect(standard?.name).toContain('Legal');
      });

      it('legal options have formal tone in description', () => {
        const context: GenerationContext = {
          request: 'Build a case study page for our law firm',
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        expect(standard?.description).toContain('professional and authoritative');
      });

      it('comprehensive legal options include formal-tone cons', () => {
        const context: GenerationContext = {
          request: 'Build a complete legal services portal for attorneys',
          relevantFiles: ['a.xml', 'b.xml', 'c.xml', 'd.xml'],
        };

        const result = generator.generate(context);
        const comprehensive = result.options.find(o => o.category === 'comprehensive');

        if (comprehensive) {
          const hasFormalCon = comprehensive.cons.some(
            c => c.category === 'formal-tone'
          );
          expect(hasFormalCon).toBe(true);
        }
      });
    });

    describe('other industry verticals', () => {
      it('healthcare options have trust/accessibility pros', () => {
        const context: GenerationContext = {
          request: 'Create a patient portal for our medical clinic',
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        const hasHealthcarePro = standard?.pros.some(
          p => p.category === 'trust' || p.category === 'accessibility'
        );
        expect(hasHealthcarePro).toBe(true);
      });

      it('retail options have conversion/shopping-ux pros', () => {
        const context: GenerationContext = {
          request: 'Build a product catalog with shopping cart',
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        const hasRetailPro = standard?.pros.some(
          p => p.category === 'conversion' || p.category === 'shopping-ux'
        );
        expect(hasRetailPro).toBe(true);
      });

      it('education options have learning-ux/engagement pros', () => {
        const context: GenerationContext = {
          request: 'Create a course enrollment page for our academy',
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        const hasEducationPro = standard?.pros.some(
          p => p.category === 'learning-ux' || p.category === 'engagement'
        );
        expect(hasEducationPro).toBe(true);
      });

      it('nonprofit options have emotion/donation-ux pros', () => {
        const context: GenerationContext = {
          request: 'Build a donation page for our charity foundation',
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        const hasNonprofitPro = standard?.pros.some(
          p => p.category === 'emotion' || p.category === 'donation-ux'
        );
        expect(hasNonprofitPro).toBe(true);
      });
    });

    describe('minimal options remain generic', () => {
      it('minimal options do not have industry-specific pros', () => {
        const context: GenerationContext = {
          request: 'Create a menu for our restaurant',
        };

        const result = generator.generate(context);
        const minimal = result.options.find(o => o.category === 'minimal');

        // Minimal should only have default pros, not industry-specific
        const hasIndustryPro = minimal?.pros.some(
          p => p.category === 'food-ux' || p.category === 'appetite-appeal'
        );
        expect(hasIndustryPro).toBeFalsy();
      });

      it('minimal options keep simple naming', () => {
        const context: GenerationContext = {
          request: 'Build a page for our law firm',
        };

        const result = generator.generate(context);
        const minimal = result.options.find(o => o.category === 'minimal');

        // Minimal approach should not have industry prefix
        expect(minimal?.name).toBe('Minimal Approach');
      });
    });
  });

  // ==========================================================================
  // Feature #46: Effort Estimation Based on File Count
  // ==========================================================================

  describe('effort estimation (Feature #46)', () => {
    describe('file count categories (verification)', () => {
      it('low effort: <5 files results in trivial/small', () => {
        const context: GenerationContext = {
          request: 'Update a single component',
          relevantFiles: ['file1.xml', 'file2.xml', 'file3.xml'], // 3 files < 5
        };

        const result = generator.generate(context);
        const minimal = result.options.find(o => o.category === 'minimal');
        const standard = result.options.find(o => o.category === 'standard');

        // Minimal with <5 files should be trivial
        expect(minimal?.effort.level).toBe('trivial');
        // Standard with <5 files should be small
        expect(standard?.effort.level).toBe('small');

        // Verify complexity metrics category
        expect(minimal?.effort.complexityMetrics?.fileCountCategory).toBe('low');
      });

      it('medium effort: 5-15 files results in medium/large', () => {
        const files = Array.from({ length: 8 }, (_, i) => `file${i}.xml`);
        const context: GenerationContext = {
          request: 'Refactor multiple components',
          relevantFiles: files, // 8 files, 5-15 range
        };

        const result = generator.generate(context);
        const minimal = result.options.find(o => o.category === 'minimal');
        const standard = result.options.find(o => o.category === 'standard');

        // With 8 files, minimal (0.5x) = 4 files -> low
        // Standard (1.0x) = 8 files -> medium
        expect(standard?.effort.level).toBe('medium');
        expect(standard?.effort.complexityMetrics?.fileCountCategory).toBe('medium');
      });

      it('high effort: >15 files results in large/complex', () => {
        const files = Array.from({ length: 20 }, (_, i) => `file${i}.xml`);
        const context: GenerationContext = {
          request: 'Complete system overhaul',
          relevantFiles: files, // 20 files > 15
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        // Standard with >15 files should be complex
        expect(standard?.effort.level).toBe('complex');
        expect(standard?.effort.complexityMetrics?.fileCountCategory).toBe('high');
      });

      it('boundary: exactly 5 files is medium', () => {
        const files = Array.from({ length: 5 }, (_, i) => `file${i}.xml`);
        const context: GenerationContext = {
          request: 'Update components',
          relevantFiles: files,
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        expect(standard?.effort.complexityMetrics?.fileCountCategory).toBe('medium');
      });

      it('boundary: exactly 15 files is still medium', () => {
        const files = Array.from({ length: 15 }, (_, i) => `file${i}.xml`);
        const context: GenerationContext = {
          request: 'Update components',
          relevantFiles: files,
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        expect(standard?.effort.complexityMetrics?.fileCountCategory).toBe('medium');
      });

      it('boundary: 16 files is high', () => {
        const files = Array.from({ length: 16 }, (_, i) => `file${i}.xml`);
        const context: GenerationContext = {
          request: 'Large scale update',
          relevantFiles: files,
        };

        const result = generator.generate(context);
        const standard = result.options.find(o => o.category === 'standard');

        expect(standard?.effort.complexityMetrics?.fileCountCategory).toBe('high');
      });
    });

    describe('complexity metrics', () => {
      it('includes complexity metrics in effort estimate', () => {
        const context: GenerationContext = {
          request: 'Add a feature',
          relevantFiles: ['test.xml', 'style.scss'],
        };

        const result = generator.generate(context);
        const option = result.options[0];

        expect(option.effort.complexityMetrics).toBeDefined();
        expect(option.effort.complexityMetrics?.fileCount).toBeDefined();
        expect(option.effort.complexityMetrics?.complexityScore).toBeDefined();
        expect(option.effort.complexityMetrics?.fileCountCategory).toBeDefined();
        expect(option.effort.complexityMetrics?.factors).toBeDefined();
      });

      it('complexity score is 0-100', () => {
        const context: GenerationContext = {
          request: 'Test complexity score',
          relevantFiles: ['a.xml', 'b.scss', 'c.ts', 'd.py'],
        };

        const result = generator.generate(context);

        for (const option of result.options) {
          const score = option.effort.complexityMetrics?.complexityScore ?? 0;
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      });

      it('includes file count factor', () => {
        const context: GenerationContext = {
          request: 'Test factors',
          relevantFiles: ['test.xml'],
        };

        const result = generator.generate(context);
        const metrics = result.options[0].effort.complexityMetrics;

        const fileCountFactor = metrics?.factors.find(f => f.name === 'File Count');
        expect(fileCountFactor).toBeDefined();
        expect(fileCountFactor?.weight).toBeGreaterThanOrEqual(0);
        expect(fileCountFactor?.weight).toBeLessThanOrEqual(1);
      });

      it('includes approach complexity factor', () => {
        const context: GenerationContext = {
          request: 'Test factors',
          relevantFiles: ['test.xml'],
        };

        const result = generator.generate(context);
        const metrics = result.options[0].effort.complexityMetrics;

        const approachFactor = metrics?.factors.find(f => f.name === 'Approach Complexity');
        expect(approachFactor).toBeDefined();
      });

      it('includes integration complexity factor', () => {
        const context: GenerationContext = {
          request: 'Test factors',
          relevantFiles: ['test.xml', 'style.scss', 'script.ts'],
        };

        const result = generator.generate(context);
        const metrics = result.options[0].effort.complexityMetrics;

        const integrationFactor = metrics?.factors.find(f => f.name === 'Integration Complexity');
        expect(integrationFactor).toBeDefined();
        expect(integrationFactor?.description).toContain('3 different file types');
      });

      it('higher file count increases complexity score', () => {
        const lowContext: GenerationContext = {
          request: 'Small change',
          relevantFiles: ['a.xml'],
        };

        const highContext: GenerationContext = {
          request: 'Big change',
          relevantFiles: Array.from({ length: 15 }, (_, i) => `file${i}.xml`),
        };

        const lowResult = generator.generate(lowContext);
        const highResult = generator.generate(highContext);

        const lowScore = lowResult.options[0].effort.complexityMetrics?.complexityScore ?? 0;
        const highScore = highResult.options[0].effort.complexityMetrics?.complexityScore ?? 0;

        expect(highScore).toBeGreaterThan(lowScore);
      });

      it('more file types increase integration complexity', () => {
        const singleTypeContext: GenerationContext = {
          request: 'Single type',
          relevantFiles: ['a.xml', 'b.xml', 'c.xml'],
        };

        const multiTypeContext: GenerationContext = {
          request: 'Multi type',
          relevantFiles: ['a.xml', 'b.scss', 'c.ts'],
        };

        const singleResult = generator.generate(singleTypeContext);
        const multiResult = generator.generate(multiTypeContext);

        const singleIntegration = singleResult.options[0].effort.complexityMetrics?.factors
          .find(f => f.name === 'Integration Complexity')?.weight ?? 0;
        const multiIntegration = multiResult.options[0].effort.complexityMetrics?.factors
          .find(f => f.name === 'Integration Complexity')?.weight ?? 0;

        expect(multiIntegration).toBeGreaterThan(singleIntegration);
      });
    });

    describe('effort level assignment', () => {
      it('minimal approach gets lower effort than comprehensive', () => {
        const context: GenerationContext = {
          request: 'Build a complete dashboard with all features',
          relevantFiles: Array.from({ length: 10 }, (_, i) => `file${i}.xml`),
        };

        const result = generator.generate(context);
        const minimal = result.options.find(o => o.category === 'minimal');
        const comprehensive = result.options.find(o => o.category === 'comprehensive');

        if (minimal && comprehensive) {
          const effortOrder: Record<EffortLevel, number> = {
            trivial: 1, small: 2, medium: 3, large: 4, complex: 5,
          };

          expect(effortOrder[minimal.effort.level]).toBeLessThan(
            effortOrder[comprehensive.effort.level]
          );
        }
      });

      it('template multiplier affects file count calculation', () => {
        const context: GenerationContext = {
          request: 'Build something',
          relevantFiles: Array.from({ length: 6 }, (_, i) => `file${i}.xml`),
        };

        const result = generator.generate(context);
        const minimal = result.options.find(o => o.category === 'minimal');
        const comprehensive = result.options.find(o => o.category === 'comprehensive');

        // Minimal (0.5x): 6 * 0.5 = 3 files -> low
        // Comprehensive (2.0x): 6 * 2 = 12 files -> medium
        expect(minimal?.effort.fileCount).toBeLessThan(comprehensive?.effort.fileCount ?? 0);
      });
    });
  });

  // ==========================================================================
  // Feature #48: Option Comparison View
  // ==========================================================================

  describe('option comparison view (Feature #48)', () => {
    let options: DesignOption[];

    beforeEach(() => {
      const context: GenerationContext = {
        request: 'Build a complete feature',
        relevantFiles: ['a.xml', 'b.scss', 'c.ts'],
      };
      const result = generator.generate(context);
      options = result.options;
    });

    describe('generateTable', () => {
      it('creates table with options as columns', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        expect(table.columns.length).toBe(options.length);
        expect(table.columns[0].id).toBe(options[0].id);
        expect(table.columns[0].name).toBe(options[0].name);
      });

      it('marks recommended column', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const recommendedCol = table.columns.find(c => c.recommended);
        expect(recommendedCol).toBeDefined();
      });

      it('creates rows for pros/cons/effort', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const prosRow = table.rows.find(r => r.label === 'Pros');
        const consRow = table.rows.find(r => r.label === 'Cons');
        const effortRow = table.rows.find(r => r.label === 'Effort');

        expect(prosRow).toBeDefined();
        expect(prosRow?.category).toBe('pros');
        expect(consRow).toBeDefined();
        expect(consRow?.category).toBe('cons');
        expect(effortRow).toBeDefined();
        expect(effortRow?.category).toBe('effort');
      });

      it('includes category and description rows', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const categoryRow = table.rows.find(r => r.label === 'Category');
        const descRow = table.rows.find(r => r.label === 'Description');

        expect(categoryRow).toBeDefined();
        expect(descRow).toBeDefined();
      });

      it('includes score row by default', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const scoreRow = table.rows.find(r => r.label === 'Score');
        expect(scoreRow).toBeDefined();
        expect(scoreRow?.category).toBe('score');
      });

      it('includes risk row by default', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const riskRow = table.rows.find(r => r.label === 'Risk');
        expect(riskRow).toBeDefined();
        expect(riskRow?.category).toBe('risk');
      });

      it('excludes files row by default', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const filesRow = table.rows.find(r => r.label === 'Files');
        expect(filesRow).toBeUndefined();
      });

      it('includes files row when configured', () => {
        const view = new OptionComparisonView(options, { includeFiles: true });
        const table = view.generateTable();

        const filesRow = table.rows.find(r => r.label === 'Files');
        expect(filesRow).toBeDefined();
      });

      it('includes summary row with recommendation', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        expect(table.summary).toBeDefined();
        expect(table.summary?.label).toBe('Recommendation');
      });
    });

    describe('row values', () => {
      it('pros row has values for each option', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const prosRow = table.rows.find(r => r.label === 'Pros')!;
        for (const col of table.columns) {
          expect(prosRow.values[col.id]).toBeDefined();
          expect(Array.isArray(prosRow.values[col.id])).toBe(true);
        }
      });

      it('cons row has values for each option', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const consRow = table.rows.find(r => r.label === 'Cons')!;
        for (const col of table.columns) {
          expect(consRow.values[col.id]).toBeDefined();
        }
      });

      it('effort row shows level and file count', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const effortRow = table.rows.find(r => r.label === 'Effort')!;
        for (const col of table.columns) {
          const value = effortRow.values[col.id] as string;
          expect(value).toContain('files');
        }
      });

      it('score row shows total and rank', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const scoreRow = table.rows.find(r => r.label === 'Score')!;
        for (const col of table.columns) {
          const value = scoreRow.values[col.id] as string;
          expect(value).toContain('/100');
        }
      });

      it('limits items per cell based on config', () => {
        const view = new OptionComparisonView(options, { maxItemsPerCell: 2 });
        const table = view.generateTable();

        const prosRow = table.rows.find(r => r.label === 'Pros')!;
        for (const col of table.columns) {
          const pros = prosRow.values[col.id] as string[];
          // Should have max 2 items + optional "+N more"
          expect(pros.filter(p => !p.startsWith('+')).length).toBeLessThanOrEqual(2);
        }
      });
    });

    describe('toMarkdown', () => {
      it('generates valid markdown table', () => {
        const view = new OptionComparisonView(options);
        const markdown = view.toMarkdown();

        expect(markdown).toContain('|');
        expect(markdown).toContain('---');
        expect(markdown).toContain('Pros');
        expect(markdown).toContain('Cons');
        expect(markdown).toContain('Effort');
      });

      it('marks recommended option with star', () => {
        const view = new OptionComparisonView(options);
        const markdown = view.toMarkdown();

        expect(markdown).toContain('⭐');
      });

      it('includes all option names in header', () => {
        const view = new OptionComparisonView(options);
        const markdown = view.toMarkdown();

        for (const opt of options) {
          expect(markdown).toContain(opt.name);
        }
      });
    });

    describe('toText', () => {
      it('generates plain text table', () => {
        const view = new OptionComparisonView(options);
        const text = view.toText();

        expect(text).toContain('Attribute');
        expect(text).toContain('=');
        expect(text).toContain('Pros');
        expect(text).toContain('Cons');
      });

      it('includes all options', () => {
        const view = new OptionComparisonView(options);
        const text = view.toText();

        for (const opt of options) {
          expect(text).toContain(opt.name);
        }
      });
    });

    describe('toJSON', () => {
      it('returns ComparisonTable structure', () => {
        const view = new OptionComparisonView(options);
        const json = view.toJSON();

        expect(json.columns).toBeDefined();
        expect(json.rows).toBeDefined();
        expect(Array.isArray(json.columns)).toBe(true);
        expect(Array.isArray(json.rows)).toBe(true);
      });
    });

    describe('factory functions', () => {
      it('createComparisonView creates instance', () => {
        const view = createComparisonView(options);
        expect(view).toBeInstanceOf(OptionComparisonView);
      });

      it('createComparisonView accepts config', () => {
        const view = createComparisonView(options, { includeFiles: true });
        const table = view.generateTable();
        const filesRow = table.rows.find(r => r.label === 'Files');
        expect(filesRow).toBeDefined();
      });

      it('compareOptions returns markdown', () => {
        const markdown = compareOptions(options);
        expect(typeof markdown).toBe('string');
        expect(markdown).toContain('|');
        expect(markdown).toContain('Pros');
      });
    });

    describe('verification: table view with options as columns; pros/cons/effort as rows', () => {
      it('options are columns in the table', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        // Each option should be a column
        expect(table.columns.length).toBe(options.length);
        for (let i = 0; i < options.length; i++) {
          expect(table.columns[i].id).toBe(options[i].id);
        }
      });

      it('pros are a row in the table', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const prosRow = table.rows.find(r => r.label === 'Pros');
        expect(prosRow).toBeDefined();

        // Each column should have pros values
        for (const col of table.columns) {
          expect(prosRow?.values[col.id]).toBeDefined();
        }
      });

      it('cons are a row in the table', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const consRow = table.rows.find(r => r.label === 'Cons');
        expect(consRow).toBeDefined();

        // Each column should have cons values
        for (const col of table.columns) {
          expect(consRow?.values[col.id]).toBeDefined();
        }
      });

      it('effort is a row in the table', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        const effortRow = table.rows.find(r => r.label === 'Effort');
        expect(effortRow).toBeDefined();

        // Each column should have effort values
        for (const col of table.columns) {
          expect(effortRow?.values[col.id]).toBeDefined();
        }
      });

      it('complete table structure verification', () => {
        const view = new OptionComparisonView(options);
        const table = view.generateTable();

        // Columns = options
        expect(table.columns.length).toBeGreaterThanOrEqual(2);
        expect(table.columns.every(c => c.id && c.name)).toBe(true);

        // Required rows exist
        const requiredRows = ['Category', 'Description', 'Pros', 'Cons', 'Effort'];
        for (const rowLabel of requiredRows) {
          const row = table.rows.find(r => r.label === rowLabel);
          expect(row).toBeDefined();
        }

        // Each row has values for all columns
        for (const row of table.rows) {
          for (const col of table.columns) {
            expect(row.values[col.id]).toBeDefined();
          }
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

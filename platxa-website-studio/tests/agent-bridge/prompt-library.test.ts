import { describe, it, expect } from 'vitest';
import {
  PROMPT_LIBRARY,
  themeCreationExamples,
  pageAdditionExamples,
  styleModificationExamples,
  promptTemplates,
  getAllExamples,
  getExampleById,
  getExamplesByCategory,
  getExamplesByDifficulty,
  searchByTag,
  searchExamples,
  getRelatedExamples,
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  fillTemplate,
  getUnfilledPlaceholders,
  validateTemplateValues,
  formatExampleAsMarkdown,
  formatTemplateAsMarkdown,
  formatLibraryAsMarkdown,
  formatExampleCompact,
  computeLibraryStats,
  getBeginnerRecommendations,
  getSimilarExamples,
} from '@/lib/agent-bridge/prompt-library';

describe('Prompt Library', () => {
  // ===========================================================================
  // Verification: Library includes theme creation, page addition, style modification
  // ===========================================================================

  describe('Verification: Required Categories', () => {
    it('includes theme creation examples', () => {
      expect(themeCreationExamples.length).toBeGreaterThan(0);
      const themeExamples = getExamplesByCategory('theme');
      expect(themeExamples.length).toBeGreaterThan(0);

      // Check for specific theme examples
      const modernMinimal = getExampleById('theme-modern-minimal');
      expect(modernMinimal).toBeDefined();
      expect(modernMinimal?.prompt).toContain('modern minimal');

      const darkMode = getExampleById('theme-dark-mode');
      expect(darkMode).toBeDefined();

      const corporate = getExampleById('theme-corporate');
      expect(corporate).toBeDefined();
    });

    it('includes page addition examples', () => {
      expect(pageAdditionExamples.length).toBeGreaterThan(0);
      const pageExamples = getExamplesByCategory('page');
      expect(pageExamples.length).toBeGreaterThan(0);

      // Check for specific page examples
      const landingPage = getExampleById('page-landing-hero');
      expect(landingPage).toBeDefined();
      expect(landingPage?.prompt).toContain('landing page');

      const aboutPage = getExampleById('page-about-company');
      expect(aboutPage).toBeDefined();

      const pricingPage = getExampleById('page-pricing');
      expect(pricingPage).toBeDefined();
    });

    it('includes style modification examples', () => {
      expect(styleModificationExamples.length).toBeGreaterThan(0);
      const styleExamples = getExamplesByCategory('style');
      expect(styleExamples.length).toBeGreaterThan(0);

      // Check for specific style examples
      const buttonVariants = getExampleById('style-button-variants');
      expect(buttonVariants).toBeDefined();
      expect(buttonVariants?.prompt).toContain('button');

      const cardShadows = getExampleById('style-card-shadows');
      expect(cardShadows).toBeDefined();

      const typography = getExampleById('style-typography-scale');
      expect(typography).toBeDefined();
    });
  });

  // ===========================================================================
  // Library Structure
  // ===========================================================================

  describe('Library Structure', () => {
    it('has version', () => {
      expect(PROMPT_LIBRARY.version).toBeTruthy();
    });

    it('has examples array', () => {
      expect(Array.isArray(PROMPT_LIBRARY.examples)).toBe(true);
      expect(PROMPT_LIBRARY.examples.length).toBeGreaterThan(0);
    });

    it('has templates array', () => {
      expect(Array.isArray(PROMPT_LIBRARY.templates)).toBe(true);
      expect(PROMPT_LIBRARY.templates.length).toBeGreaterThan(0);
    });

    it('combines all example arrays', () => {
      const expected = themeCreationExamples.length +
        pageAdditionExamples.length +
        styleModificationExamples.length;
      expect(PROMPT_LIBRARY.examples.length).toBe(expected);
    });
  });

  // ===========================================================================
  // Example Completeness
  // ===========================================================================

  describe('Example Completeness', () => {
    it('each example has unique ID', () => {
      const examples = getAllExamples();
      const ids = examples.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each example has title', () => {
      for (const example of getAllExamples()) {
        expect(example.title, `${example.id} missing title`).toBeTruthy();
      }
    });

    it('each example has valid category', () => {
      const validCategories = ['theme', 'page', 'style', 'component', 'layout', 'animation'];
      for (const example of getAllExamples()) {
        expect(validCategories, `${example.id} has invalid category`).toContain(example.category);
      }
    });

    it('each example has valid difficulty', () => {
      const validDifficulties = ['beginner', 'intermediate', 'advanced'];
      for (const example of getAllExamples()) {
        expect(validDifficulties, `${example.id} has invalid difficulty`).toContain(example.difficulty);
      }
    });

    it('each example has substantial prompt', () => {
      for (const example of getAllExamples()) {
        expect(example.prompt.length, `${example.id} prompt too short`).toBeGreaterThan(50);
      }
    });

    it('each example has description', () => {
      for (const example of getAllExamples()) {
        expect(example.description, `${example.id} missing description`).toBeTruthy();
      }
    });

    it('each example has expected result', () => {
      for (const example of getAllExamples()) {
        expect(example.expectedResult, `${example.id} missing expectedResult`).toBeTruthy();
      }
    });

    it('each example has at least 3 tags', () => {
      for (const example of getAllExamples()) {
        expect(example.tags.length, `${example.id} needs more tags`).toBeGreaterThanOrEqual(3);
      }
    });
  });

  // ===========================================================================
  // Template Completeness
  // ===========================================================================

  describe('Template Completeness', () => {
    it('each template has unique ID', () => {
      const templates = getAllTemplates();
      const ids = templates.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('each template has name', () => {
      for (const template of getAllTemplates()) {
        expect(template.name, `${template.id} missing name`).toBeTruthy();
      }
    });

    it('each template has valid category', () => {
      const validCategories = ['theme', 'page', 'style', 'component', 'layout', 'animation'];
      for (const template of getAllTemplates()) {
        expect(validCategories, `${template.id} has invalid category`).toContain(template.category);
      }
    });

    it('each template has placeholders', () => {
      for (const template of getAllTemplates()) {
        expect(template.placeholders.length, `${template.id} needs placeholders`).toBeGreaterThan(0);
      }
    });

    it('each placeholder has required fields', () => {
      for (const template of getAllTemplates()) {
        for (const placeholder of template.placeholders) {
          expect(placeholder.name, `${template.id} placeholder missing name`).toBeTruthy();
          expect(placeholder.description, `${template.id} placeholder missing description`).toBeTruthy();
          expect(placeholder.example, `${template.id} placeholder missing example`).toBeTruthy();
        }
      }
    });

    it('each template has instructions', () => {
      for (const template of getAllTemplates()) {
        expect(template.instructions, `${template.id} missing instructions`).toBeTruthy();
      }
    });

    it('template placeholders match template markers', () => {
      for (const template of getAllTemplates()) {
        for (const placeholder of template.placeholders) {
          const marker = `{{${placeholder.name}}}`;
          expect(
            template.template.includes(marker),
            `${template.id} template missing marker for ${placeholder.name}`,
          ).toBe(true);
        }
      }
    });
  });

  // ===========================================================================
  // Query Functions
  // ===========================================================================

  describe('getAllExamples', () => {
    it('returns all examples', () => {
      const examples = getAllExamples();
      expect(examples.length).toBeGreaterThan(15);
    });
  });

  describe('getExampleById', () => {
    it('finds existing example', () => {
      const example = getExampleById('theme-modern-minimal');
      expect(example).toBeDefined();
      expect(example?.title).toBe('Modern Minimal Theme');
    });

    it('returns undefined for unknown ID', () => {
      const example = getExampleById('nonexistent');
      expect(example).toBeUndefined();
    });
  });

  describe('getExamplesByCategory', () => {
    it('filters by theme category', () => {
      const examples = getExamplesByCategory('theme');
      expect(examples.length).toBe(themeCreationExamples.length);
      expect(examples.every((e) => e.category === 'theme')).toBe(true);
    });

    it('filters by page category', () => {
      const examples = getExamplesByCategory('page');
      expect(examples.length).toBe(pageAdditionExamples.length);
    });

    it('filters by style category', () => {
      const examples = getExamplesByCategory('style');
      expect(examples.length).toBe(styleModificationExamples.length);
    });

    it('returns empty for unused category', () => {
      const examples = getExamplesByCategory('animation');
      expect(examples).toHaveLength(0);
    });
  });

  describe('getExamplesByDifficulty', () => {
    it('filters by beginner difficulty', () => {
      const examples = getExamplesByDifficulty('beginner');
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every((e) => e.difficulty === 'beginner')).toBe(true);
    });

    it('filters by intermediate difficulty', () => {
      const examples = getExamplesByDifficulty('intermediate');
      expect(examples.length).toBeGreaterThan(0);
    });

    it('filters by advanced difficulty', () => {
      const examples = getExamplesByDifficulty('advanced');
      expect(examples.length).toBeGreaterThan(0);
    });
  });

  describe('searchByTag', () => {
    it('finds examples by tag', () => {
      const results = searchByTag('modern');
      expect(results.length).toBeGreaterThan(0);
    });

    it('is case insensitive', () => {
      const lower = searchByTag('gradient');
      const upper = searchByTag('GRADIENT');
      expect(lower.length).toBe(upper.length);
    });

    it('returns empty for no matches', () => {
      const results = searchByTag('xyznonexistent123');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchExamples', () => {
    it('searches title', () => {
      const results = searchExamples('Dark Mode');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('theme-dark-mode');
    });

    it('searches description', () => {
      const results = searchExamples('conversion');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searches prompt text', () => {
      const results = searchExamples('gradient');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getRelatedExamples', () => {
    it('returns related examples', () => {
      const related = getRelatedExamples('theme-modern-minimal');
      expect(related.length).toBeGreaterThan(0);
    });

    it('returns empty for example without related', () => {
      const related = getRelatedExamples('nonexistent');
      expect(related).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Template Functions
  // ===========================================================================

  describe('getAllTemplates', () => {
    it('returns all templates', () => {
      const templates = getAllTemplates();
      expect(templates.length).toBe(promptTemplates.length);
    });
  });

  describe('getTemplateById', () => {
    it('finds existing template', () => {
      const template = getTemplateById('template-theme-basic');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Basic Theme Creation');
    });

    it('returns undefined for unknown ID', () => {
      const template = getTemplateById('nonexistent');
      expect(template).toBeUndefined();
    });
  });

  describe('getTemplatesByCategory', () => {
    it('filters templates by category', () => {
      const templates = getTemplatesByCategory('theme');
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.every((t) => t.category === 'theme')).toBe(true);
    });
  });

  describe('fillTemplate', () => {
    it('fills template placeholders', () => {
      const result = fillTemplate('template-theme-basic', {
        style: 'modern',
        primary_color: '#2563EB',
        secondary_color: '#10B981',
        background: 'white',
        font: 'Inter',
        mood: 'professional',
      });
      expect(result).toContain('modern');
      expect(result).toContain('#2563EB');
      expect(result).not.toContain('{{');
    });

    it('returns null for unknown template', () => {
      const result = fillTemplate('nonexistent', {});
      expect(result).toBeNull();
    });

    it('leaves unfilled placeholders as-is', () => {
      const result = fillTemplate('template-theme-basic', {
        style: 'modern',
      });
      expect(result).toContain('modern');
      expect(result).toContain('{{primary_color}}');
    });
  });

  describe('getUnfilledPlaceholders', () => {
    it('returns unfilled placeholder names', () => {
      const unfilled = getUnfilledPlaceholders('template-theme-basic', {
        style: 'modern',
      });
      expect(unfilled).toContain('primary_color');
      expect(unfilled).not.toContain('style');
    });

    it('returns empty when all filled', () => {
      const unfilled = getUnfilledPlaceholders('template-theme-basic', {
        style: 'modern',
        primary_color: '#2563EB',
        secondary_color: '#10B981',
        background: 'white',
        font: 'Inter',
        mood: 'professional',
      });
      expect(unfilled).toHaveLength(0);
    });
  });

  describe('validateTemplateValues', () => {
    it('validates complete values', () => {
      const result = validateTemplateValues('template-theme-basic', {
        style: 'modern',
        primary_color: '#2563EB',
        secondary_color: '#10B981',
        background: 'white',
        font: 'Inter',
        mood: 'professional',
      });
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('reports missing values', () => {
      const result = validateTemplateValues('template-theme-basic', {
        style: 'modern',
      });
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Formatting Functions
  // ===========================================================================

  describe('formatExampleAsMarkdown', () => {
    it('includes title as heading', () => {
      const example = getExampleById('theme-modern-minimal')!;
      const md = formatExampleAsMarkdown(example);
      expect(md).toContain('## Modern Minimal Theme');
    });

    it('includes category and difficulty', () => {
      const example = getExampleById('theme-modern-minimal')!;
      const md = formatExampleAsMarkdown(example);
      expect(md).toContain('theme');
      expect(md).toContain('beginner');
    });

    it('includes prompt in code block', () => {
      const example = getExampleById('theme-modern-minimal')!;
      const md = formatExampleAsMarkdown(example);
      expect(md).toContain('### Prompt');
      expect(md).toContain('```');
    });

    it('includes description', () => {
      const example = getExampleById('theme-modern-minimal')!;
      const md = formatExampleAsMarkdown(example);
      expect(md).toContain('### Description');
    });

    it('includes expected result', () => {
      const example = getExampleById('theme-modern-minimal')!;
      const md = formatExampleAsMarkdown(example);
      expect(md).toContain('### Expected Result');
    });

    it('includes tags', () => {
      const example = getExampleById('theme-modern-minimal')!;
      const md = formatExampleAsMarkdown(example);
      expect(md).toContain('### Tags');
    });
  });

  describe('formatTemplateAsMarkdown', () => {
    it('includes name as heading', () => {
      const template = getTemplateById('template-theme-basic')!;
      const md = formatTemplateAsMarkdown(template);
      expect(md).toContain('## Basic Theme Creation');
    });

    it('includes template in code block', () => {
      const template = getTemplateById('template-theme-basic')!;
      const md = formatTemplateAsMarkdown(template);
      expect(md).toContain('### Template');
      expect(md).toContain('```');
    });

    it('includes placeholders table', () => {
      const template = getTemplateById('template-theme-basic')!;
      const md = formatTemplateAsMarkdown(template);
      expect(md).toContain('### Placeholders');
      expect(md).toContain('| Name | Description | Example |');
    });

    it('includes instructions', () => {
      const template = getTemplateById('template-theme-basic')!;
      const md = formatTemplateAsMarkdown(template);
      expect(md).toContain('### Instructions');
    });
  });

  describe('formatLibraryAsMarkdown', () => {
    it('includes main title', () => {
      const md = formatLibraryAsMarkdown();
      expect(md).toContain('# Prompt Library');
    });

    it('includes version', () => {
      const md = formatLibraryAsMarkdown();
      expect(md).toContain(PROMPT_LIBRARY.version);
    });

    it('includes table of contents', () => {
      const md = formatLibraryAsMarkdown();
      expect(md).toContain('## Table of Contents');
    });

    it('includes all category sections', () => {
      const md = formatLibraryAsMarkdown();
      expect(md).toContain('# Theme Creation Examples');
      expect(md).toContain('# Page Addition Examples');
      expect(md).toContain('# Style Modification Examples');
    });

    it('includes all examples', () => {
      const md = formatLibraryAsMarkdown();
      for (const example of getAllExamples()) {
        expect(md).toContain(example.title);
      }
    });

    it('generates substantial content', () => {
      const md = formatLibraryAsMarkdown();
      expect(md.length).toBeGreaterThan(10000);
    });
  });

  describe('formatExampleCompact', () => {
    it('includes difficulty icon', () => {
      const example = getExampleById('theme-modern-minimal')!;
      const compact = formatExampleCompact(example);
      expect(compact).toContain('🟢'); // beginner
    });

    it('includes category', () => {
      const example = getExampleById('theme-modern-minimal')!;
      const compact = formatExampleCompact(example);
      expect(compact).toContain('[theme]');
    });

    it('includes title', () => {
      const example = getExampleById('theme-modern-minimal')!;
      const compact = formatExampleCompact(example);
      expect(compact).toContain('Modern Minimal Theme');
    });
  });

  // ===========================================================================
  // Statistics
  // ===========================================================================

  describe('computeLibraryStats', () => {
    it('returns total examples count', () => {
      const stats = computeLibraryStats();
      expect(stats.totalExamples).toBe(getAllExamples().length);
    });

    it('returns count by category', () => {
      const stats = computeLibraryStats();
      expect(stats.byCategory.theme).toBe(themeCreationExamples.length);
      expect(stats.byCategory.page).toBe(pageAdditionExamples.length);
      expect(stats.byCategory.style).toBe(styleModificationExamples.length);
    });

    it('returns count by difficulty', () => {
      const stats = computeLibraryStats();
      const total = stats.byDifficulty.beginner +
        stats.byDifficulty.intermediate +
        stats.byDifficulty.advanced;
      expect(total).toBe(stats.totalExamples);
    });

    it('returns total templates count', () => {
      const stats = computeLibraryStats();
      expect(stats.totalTemplates).toBe(promptTemplates.length);
    });

    it('returns all unique tags', () => {
      const stats = computeLibraryStats();
      expect(stats.allTags.length).toBeGreaterThan(20);
      expect(new Set(stats.allTags).size).toBe(stats.allTags.length);
    });
  });

  // ===========================================================================
  // Recommendation Functions
  // ===========================================================================

  describe('getBeginnerRecommendations', () => {
    it('returns beginner examples', () => {
      const recommendations = getBeginnerRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.every((r) => r.difficulty === 'beginner')).toBe(true);
    });

    it('returns at most 5 examples', () => {
      const recommendations = getBeginnerRecommendations();
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getSimilarExamples', () => {
    it('returns similar examples based on tags', () => {
      const similar = getSimilarExamples('theme-modern-minimal');
      expect(similar.length).toBeGreaterThan(0);
      // Should not include the original
      expect(similar.every((s) => s.id !== 'theme-modern-minimal')).toBe(true);
    });

    it('returns empty for unknown example', () => {
      const similar = getSimilarExamples('nonexistent');
      expect(similar).toHaveLength(0);
    });

    it('respects limit parameter', () => {
      const similar = getSimilarExamples('theme-modern-minimal', 2);
      expect(similar.length).toBeLessThanOrEqual(2);
    });
  });

  // ===========================================================================
  // Related Examples Integrity
  // ===========================================================================

  describe('Related Examples Integrity', () => {
    it('all related example references exist', () => {
      const allIds = new Set(getAllExamples().map((e) => e.id));
      for (const example of getAllExamples()) {
        if (example.relatedPrompts) {
          for (const relatedId of example.relatedPrompts) {
            expect(
              allIds.has(relatedId),
              `${example.id} references unknown: ${relatedId}`,
            ).toBe(true);
          }
        }
      }
    });
  });
});

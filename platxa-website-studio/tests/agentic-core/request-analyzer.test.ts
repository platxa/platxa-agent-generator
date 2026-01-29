/**
 * Tests for RequestAnalyzer
 * Feature #37: Implement request analysis detecting ambiguity and missing information
 *
 * Verification: Identifies vague terms, missing details, conflicting requirements
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RequestAnalyzer,
  createRequestAnalyzer,
  analyzeRequest,
  type AnalysisResult,
  type RequestIssue,
} from '@/lib/agentic-core/request-analyzer';

// ============================================================================
// Tests
// ============================================================================

describe('RequestAnalyzer', () => {
  describe('constructor', () => {
    it('creates instance with default config', () => {
      const analyzer = new RequestAnalyzer();
      expect(analyzer).toBeInstanceOf(RequestAnalyzer);
    });

    it('accepts custom config', () => {
      const analyzer = createRequestAnalyzer({
        clarityThreshold: 0.5,
        domain: 'odoo',
      });
      expect(analyzer).toBeInstanceOf(RequestAnalyzer);
      expect(analyzer.getConfig().clarityThreshold).toBe(0.5);
    });

    it('accepts custom patterns', () => {
      const analyzer = new RequestAnalyzer({
        vagueTermPatterns: [{
          pattern: /\bcustom-vague\b/gi,
          severity: 'high',
          reason: 'Custom vague term',
          clarifications: ['What do you mean?'],
        }],
      });

      const result = analyzer.analyze('Add a custom-vague feature');
      expect(result.issues.some(i => i.trigger === 'custom-vague')).toBe(true);
    });
  });

  describe('detectVagueTerms', () => {
    let analyzer: RequestAnalyzer;

    beforeEach(() => {
      analyzer = new RequestAnalyzer();
    });

    it('detects "nice" as vague', () => {
      const issues = analyzer.detectVagueTerms('Make it look nice');

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('vague_term');
      expect(issues[0].trigger.toLowerCase()).toBe('nice');
    });

    it('detects "better" as vague', () => {
      const issues = analyzer.detectVagueTerms('Make the website better');

      expect(issues.some(i => i.trigger.toLowerCase() === 'better')).toBe(true);
    });

    it('detects "modern" as vague', () => {
      const issues = analyzer.detectVagueTerms('Create a modern design');

      expect(issues.some(i => i.trigger.toLowerCase() === 'modern')).toBe(true);
    });

    it('detects "fast" as vague', () => {
      const issues = analyzer.detectVagueTerms('Make it fast');

      expect(issues.some(i => i.trigger.toLowerCase() === 'fast')).toBe(true);
    });

    it('detects multiple vague terms', () => {
      const issues = analyzer.detectVagueTerms('Make it nice, modern, and fast');

      expect(issues.length).toBeGreaterThanOrEqual(3);
    });

    it('detects "etc" as incomplete list', () => {
      const issues = analyzer.detectVagueTerms('Add buttons, links, etc');

      expect(issues.some(i => i.trigger.toLowerCase() === 'etc')).toBe(true);
    });

    it('detects "simple" as vague complexity', () => {
      const issues = analyzer.detectVagueTerms('Keep it simple');

      expect(issues.some(i => i.trigger.toLowerCase() === 'simple')).toBe(true);
    });

    it('detects "something like" as approximate', () => {
      const issues = analyzer.detectVagueTerms('Add something like a hero section');

      expect(issues.some(i => i.trigger.toLowerCase() === 'something like')).toBe(true);
    });

    it('provides clarification questions for vague terms', () => {
      const issues = analyzer.detectVagueTerms('Make it look nice');

      expect(issues[0].clarificationQuestions.length).toBeGreaterThan(0);
    });

    it('includes position in text', () => {
      const issues = analyzer.detectVagueTerms('The design should be nice');

      expect(issues[0].position).toBeDefined();
      expect(issues[0].position).toBeGreaterThan(0);
    });
  });

  describe('detectMissingDetails', () => {
    let analyzer: RequestAnalyzer;

    beforeEach(() => {
      analyzer = new RequestAnalyzer();
    });

    it('detects missing color when designing', () => {
      const issues = analyzer.detectMissingDetails('Create a new theme design');

      expect(issues.some(i =>
        i.type === 'missing_detail' && i.description.includes('color')
      )).toBe(true);
    });

    it('detects missing content for hero section', () => {
      const issues = analyzer.detectMissingDetails('Add a hero section');

      expect(issues.some(i =>
        i.type === 'missing_detail' && i.description.includes('content')
      )).toBe(true);
    });

    it('detects missing CTA for landing page', () => {
      const issues = analyzer.detectMissingDetails('Create a landing page');

      expect(issues.some(i =>
        i.type === 'missing_detail' && i.description.includes('cta')
      )).toBe(true);
    });

    it('detects missing images for banner', () => {
      const issues = analyzer.detectMissingDetails('Add a banner section');

      expect(issues.some(i =>
        i.type === 'missing_detail' && i.description.includes('image')
      )).toBe(true);
    });

    it('does not flag missing detail if present', () => {
      const issues = analyzer.detectMissingDetails(
        'Add a hero section with a blue color scheme and "Shop Now" button'
      );

      // Should have fewer missing detail issues since color and CTA are mentioned
      const colorIssue = issues.find(i =>
        i.type === 'missing_detail' && i.description.includes('color')
      );
      expect(colorIssue).toBeUndefined();
    });

    it('detects missing responsive consideration', () => {
      const issues = analyzer.detectMissingDetails('Create a new page layout');

      expect(issues.some(i =>
        i.type === 'missing_detail' && i.description.includes('responsive')
      )).toBe(true);
    });
  });

  describe('detectConflicts', () => {
    let analyzer: RequestAnalyzer;

    beforeEach(() => {
      analyzer = new RequestAnalyzer();
    });

    it('detects simple vs feature-rich conflict', () => {
      const issues = analyzer.detectConflicts(
        'Create a simple page with comprehensive features'
      );

      expect(issues.some(i => i.type === 'conflict')).toBe(true);
    });

    it('detects fast vs animation conflict', () => {
      const issues = analyzer.detectConflicts(
        'Make it fast with lots of animations'
      );

      expect(issues.some(i => i.type === 'conflict')).toBe(true);
    });

    it('detects unique vs template conflict', () => {
      const issues = analyzer.detectConflicts(
        'Create a unique design using the standard template'
      );

      expect(issues.some(i => i.type === 'conflict')).toBe(true);
    });

    it('detects urgent vs perfect conflict', () => {
      const issues = analyzer.detectConflicts(
        'I need this asap but it must be perfect'
      );

      expect(issues.some(i => i.type === 'conflict')).toBe(true);
    });

    it('detects mobile-first vs desktop-first conflict', () => {
      const issues = analyzer.detectConflicts(
        'Make it mobile-first but also desktop-focused'
      );

      expect(issues.some(i => i.type === 'conflict')).toBe(true);
    });

    it('provides resolution suggestion for conflicts', () => {
      const issues = analyzer.detectConflicts(
        'Create a simple page with all features'
      );

      const conflict = issues.find(i => i.type === 'conflict');
      expect(conflict).toBeDefined();
      expect(conflict!.clarificationQuestions.length).toBeGreaterThan(0);
    });

    it('no conflict when terms do not conflict', () => {
      const issues = analyzer.detectConflicts(
        'Create a simple and clean design'
      );

      expect(issues.filter(i => i.type === 'conflict')).toHaveLength(0);
    });
  });

  describe('detectUnclearScope', () => {
    let analyzer: RequestAnalyzer;

    beforeEach(() => {
      analyzer = new RequestAnalyzer();
    });

    it('detects very short requests', () => {
      const issues = analyzer.detectUnclearScope('Fix it');

      expect(issues.some(i => i.type === 'unclear_scope')).toBe(true);
      expect(issues[0].description).toContain('too brief');
    });

    it('detects "everything" as unclear scope', () => {
      const issues = analyzer.detectUnclearScope(
        'Update everything on the website'
      );

      expect(issues.some(i =>
        i.type === 'unclear_scope' && i.trigger.toLowerCase() === 'everything'
      )).toBe(true);
    });

    it('detects "all" as unclear scope', () => {
      const issues = analyzer.detectUnclearScope(
        'Change all the colors'
      );

      expect(issues.some(i =>
        i.type === 'unclear_scope' && i.trigger.toLowerCase() === 'all'
      )).toBe(true);
    });

    it('does not flag clear scoped requests', () => {
      const issues = analyzer.detectUnclearScope(
        'Add a blue hero section with a video background to the homepage, including a CTA button that says "Get Started" and links to the pricing page'
      );

      // Should not have scope issues for detailed request
      expect(issues.filter(i => i.description.includes('too brief'))).toHaveLength(0);
    });
  });

  describe('analyze (full analysis)', () => {
    let analyzer: RequestAnalyzer;

    beforeEach(() => {
      analyzer = new RequestAnalyzer();
    });

    it('returns complete analysis result', () => {
      const result = analyzer.analyze('Make the website better');

      expect(result.request).toBe('Make the website better');
      expect(result.issues).toBeDefined();
      expect(result.issuesByType).toBeDefined();
      expect(result.clarityScore).toBeGreaterThanOrEqual(0);
      expect(result.clarityScore).toBeLessThanOrEqual(1);
      expect(result.needsClarification).toBeDefined();
      expect(result.suggestedQuestions).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('groups issues by type', () => {
      const result = analyzer.analyze('Make it nice and fast with everything');

      expect(result.issuesByType.vague_term.length).toBeGreaterThan(0);
      expect(result.issuesByType.unclear_scope.length).toBeGreaterThan(0);
    });

    it('calculates clarity score', () => {
      const vagueResult = analyzer.analyze('Make it nice');
      const clearResult = analyzer.analyze(
        'Add a hero section with a blue background (#3498db), centered heading "Welcome", and a green "Get Started" button linking to /signup'
      );

      expect(vagueResult.clarityScore).toBeLessThan(clearResult.clarityScore);
    });

    it('sets needsClarification based on threshold', () => {
      const vagueResult = analyzer.analyze('Nice');

      expect(vagueResult.needsClarification).toBe(true);
    });

    it('prioritizes clarification questions by severity', () => {
      const result = analyzer.analyze(
        'Make it nice and simple with comprehensive features asap'
      );

      // High severity questions should come first
      expect(result.suggestedQuestions.length).toBeGreaterThan(0);
    });

    it('clears request has high clarity score', () => {
      const result = analyzer.analyze(
        'Create a contact form with name (text input), email (email input), message (textarea), and a blue submit button. The form should validate inputs before submission and show success/error messages.'
      );

      expect(result.clarityScore).toBeGreaterThan(0.5);
    });
  });

  describe('utility methods', () => {
    let analyzer: RequestAnalyzer;

    beforeEach(() => {
      analyzer = new RequestAnalyzer();
    });

    it('hasIssueType checks for specific issue type', () => {
      const result = analyzer.analyze('Make it nice');

      expect(analyzer.hasIssueType(result, 'vague_term')).toBe(true);
    });

    it('getHighSeverityIssues filters correctly', () => {
      const result = analyzer.analyze('Make it nice and beautiful');

      const highSeverity = analyzer.getHighSeverityIssues(result);
      expect(highSeverity.every(i => i.severity === 'high')).toBe(true);
    });

    it('addVaguePattern adds custom pattern', () => {
      analyzer.addVaguePattern({
        pattern: /\bcustom-word\b/gi,
        severity: 'high',
        reason: 'Custom vague term',
        clarifications: ['Clarify custom-word'],
      });

      const result = analyzer.analyze('Add custom-word feature');
      expect(result.issues.some(i => i.trigger === 'custom-word')).toBe(true);
    });

    it('addRequiredDetail adds custom detail check', () => {
      analyzer.addRequiredDetail({
        name: 'custom_detail',
        keywords: ['special'],
        clarification: 'What custom detail is needed?',
        severity: 'high',
      });

      const result = analyzer.analyze('Add a special feature');
      expect(result.issues.some(i =>
        i.type === 'missing_detail' && i.description.includes('custom_detail')
      )).toBe(true);
    });

    it('addConflictPattern adds custom conflict check', () => {
      analyzer.addConflictPattern({
        termA: ['red'],
        termB: ['blue'],
        reason: 'Color conflict',
        resolution: 'Choose one color',
        severity: 'medium',
      });

      const result = analyzer.analyze('Make it red and blue');
      expect(result.issues.some(i => i.type === 'conflict')).toBe(true);
    });
  });

  describe('factory functions', () => {
    it('createRequestAnalyzer creates instance', () => {
      const analyzer = createRequestAnalyzer({ clarityThreshold: 0.5 });
      expect(analyzer).toBeInstanceOf(RequestAnalyzer);
    });

    it('analyzeRequest performs quick analysis', () => {
      const result = analyzeRequest('Make it better');

      expect(result.request).toBe('Make it better');
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Feature #37 Verification Tests
  // ==========================================================================

  describe('Feature #37 verification: Identifies vague terms, missing details, conflicting requirements', () => {
    const analyzer = new RequestAnalyzer();

    it('identifies vague terms accurately', () => {
      const testCases = [
        { request: 'Make it look nice', expected: 'nice' },
        { request: 'Create a modern design', expected: 'modern' },
        { request: 'Make the website better', expected: 'better' },
        { request: 'Keep it simple', expected: 'simple' },
        { request: 'Make it fast', expected: 'fast' },
        { request: 'Add a clean look', expected: 'clean' },
        { request: 'Make it professional', expected: 'professional' },
      ];

      for (const { request, expected } of testCases) {
        const result = analyzer.analyze(request);
        const vagueIssues = result.issuesByType.vague_term;

        expect(vagueIssues.some(i =>
          i.trigger.toLowerCase() === expected.toLowerCase()
        )).toBe(true);
      }
    });

    it('identifies missing details for different contexts', () => {
      // Hero section should trigger content and image checks
      const heroResult = analyzer.analyze('Add a hero section to the homepage');
      expect(heroResult.issuesByType.missing_detail.some(i =>
        i.description.includes('content')
      )).toBe(true);

      // Landing page should trigger CTA check
      const landingResult = analyzer.analyze('Create a landing page');
      expect(landingResult.issuesByType.missing_detail.some(i =>
        i.description.includes('cta')
      )).toBe(true);

      // Design request should trigger color check
      const designResult = analyzer.analyze('Create a new theme design');
      expect(designResult.issuesByType.missing_detail.some(i =>
        i.description.includes('color')
      )).toBe(true);
    });

    it('identifies conflicting requirements', () => {
      const conflictCases = [
        'Make it simple but with all features',
        'I want it fast with heavy animations',
        'Create a unique design from the template',
        'Need it asap and it must be perfect',
        'Mobile-first but desktop-focused',
      ];

      for (const request of conflictCases) {
        const result = analyzer.analyze(request);
        expect(result.issuesByType.conflict.length).toBeGreaterThan(0);
      }
    });

    it('provides actionable clarification questions', () => {
      const result = analyzer.analyze('Make the website look nice and modern');

      // Should have clarification questions
      expect(result.suggestedQuestions.length).toBeGreaterThan(0);

      // Questions should be actionable (not just "clarify")
      const hasActionableQuestions = result.suggestedQuestions.some(q =>
        q.includes('?') && (
          q.includes('Can you') ||
          q.includes('What') ||
          q.includes('How') ||
          q.includes('Are there')
        )
      );
      expect(hasActionableQuestions).toBe(true);
    });

    it('correctly assesses clarity score', () => {
      // Very vague request
      const vagueResult = analyzer.analyze('Fix it');
      expect(vagueResult.clarityScore).toBeLessThan(0.5);
      expect(vagueResult.needsClarification).toBe(true);

      // Somewhat vague request
      const mediumResult = analyzer.analyze('Make the homepage look better');
      expect(mediumResult.clarityScore).toBeLessThan(0.8);

      // Clear, specific request
      const clearResult = analyzer.analyze(
        'Add a blue (#0066cc) hero section to templates/homepage.xml with the heading "Welcome to Our Store", subheading "Shop the latest collection", and a green "Shop Now" button that links to /shop. The hero should have a gradient background and be responsive for mobile devices.'
      );
      expect(clearResult.clarityScore).toBeGreaterThan(0.7);
    });

    it('handles complex requests with multiple issue types', () => {
      const complexRequest = 'I need everything on the website to look nice and modern, make it fast but add lots of animations, and I need it asap but it has to be perfect';

      const result = analyzer.analyze(complexRequest);

      // Should identify vague terms
      expect(result.issuesByType.vague_term.length).toBeGreaterThan(0);

      // Should identify conflicts
      expect(result.issuesByType.conflict.length).toBeGreaterThan(0);

      // Should identify unclear scope
      expect(result.issuesByType.unclear_scope.length).toBeGreaterThan(0);

      // Clarity score should be low
      expect(result.clarityScore).toBeLessThan(0.5);

      // Should need clarification
      expect(result.needsClarification).toBe(true);
    });
  });
});

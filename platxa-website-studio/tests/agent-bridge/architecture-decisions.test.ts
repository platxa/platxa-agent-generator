/**
 * Tests for Architecture Decision Records (ADRs)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createADR,
  getADR,
  getADRByNumber,
  getAllADRs,
  getADRCount,
  acceptADR,
  deprecateADR,
  supersedeADR,
  rejectADR,
  updateADR,
  addConsequence,
  addAlternative,
  addRelatedADR,
  addTag,
  removeTag,
  queryADRs,
  getADRsByStatus,
  getADRsByCategory,
  getAcceptedADRs,
  getProposedADRs,
  getRelatedADRs,
  getSummary,
  initializeDefaultADRs,
  formatADR,
  exportADRs,
  exportAsJSON,
  getState,
  removeADR,
  clearADRs,
  resetArchitectureDecisions,
  createAlternative,
  type ADR,
  type Alternative,
} from '../../lib/agent-bridge/architecture-decisions';

describe('Architecture Decision Records (ADRs)', () => {
  beforeEach(() => {
    resetArchitectureDecisions();
  });

  describe('Core Functions', () => {
    describe('createADR', () => {
      it('should create an ADR with basic info', () => {
        const adr = createADR(
          'Test Decision',
          'We need to make a decision',
          'We decided to do X'
        );

        expect(adr.id).toBeDefined();
        expect(adr.number).toBe(1);
        expect(adr.title).toBe('Test Decision');
        expect(adr.context).toBe('We need to make a decision');
        expect(adr.decision).toBe('We decided to do X');
        expect(adr.status).toBe('proposed');
      });

      it('should create ADR with options', () => {
        const adr = createADR(
          'Test Decision',
          'Context',
          'Decision',
          {
            consequences: ['Consequence 1', 'Consequence 2'],
            category: 'agentic-loop',
            tags: ['core', 'important'],
            metadata: { owner: 'team-a' },
          }
        );

        expect(adr.consequences).toEqual(['Consequence 1', 'Consequence 2']);
        expect(adr.category).toBe('agentic-loop');
        expect(adr.tags).toContain('core');
        expect(adr.metadata.owner).toBe('team-a');
      });

      it('should auto-increment ADR numbers', () => {
        const adr1 = createADR('ADR 1', 'Context', 'Decision');
        const adr2 = createADR('ADR 2', 'Context', 'Decision');
        const adr3 = createADR('ADR 3', 'Context', 'Decision');

        expect(adr1.number).toBe(1);
        expect(adr2.number).toBe(2);
        expect(adr3.number).toBe(3);
      });

      it('should create ADR with alternatives', () => {
        const adr = createADR(
          'Test Decision',
          'Context',
          'Decision',
          {
            alternatives: [
              createAlternative('Option A', 'Description A', {
                pros: ['Pro 1'],
                cons: ['Con 1'],
                rejected: true,
                rejectionReason: 'Too expensive',
              }),
            ],
          }
        );

        expect(adr.alternatives.length).toBe(1);
        expect(adr.alternatives[0].name).toBe('Option A');
        expect(adr.alternatives[0].rejected).toBe(true);
      });
    });

    describe('getADR', () => {
      it('should return ADR by ID', () => {
        const created = createADR('Test', 'Context', 'Decision');
        const retrieved = getADR(created.id);

        expect(retrieved).toEqual(created);
      });

      it('should return null for unknown ID', () => {
        expect(getADR('unknown')).toBeNull();
      });
    });

    describe('getADRByNumber', () => {
      it('should return ADR by number', () => {
        createADR('ADR 1', 'Context', 'Decision');
        const adr2 = createADR('ADR 2', 'Context', 'Decision');

        const retrieved = getADRByNumber(2);
        expect(retrieved).toEqual(adr2);
      });

      it('should return null for unknown number', () => {
        expect(getADRByNumber(999)).toBeNull();
      });
    });

    describe('getAllADRs', () => {
      it('should return all ADRs sorted by number', () => {
        createADR('ADR 1', 'Context', 'Decision');
        createADR('ADR 2', 'Context', 'Decision');
        createADR('ADR 3', 'Context', 'Decision');

        const all = getAllADRs();

        expect(all.length).toBe(3);
        expect(all[0].number).toBe(1);
        expect(all[1].number).toBe(2);
        expect(all[2].number).toBe(3);
      });
    });

    describe('getADRCount', () => {
      it('should return correct count', () => {
        expect(getADRCount()).toBe(0);

        createADR('ADR 1', 'Context', 'Decision');
        createADR('ADR 2', 'Context', 'Decision');

        expect(getADRCount()).toBe(2);
      });
    });
  });

  describe('Status Management', () => {
    let adr: ADR;

    beforeEach(() => {
      adr = createADR('Test Decision', 'Context', 'Decision');
    });

    describe('acceptADR', () => {
      it('should accept a proposed ADR', () => {
        const accepted = acceptADR(adr.id);

        expect(accepted).not.toBeNull();
        expect(accepted!.status).toBe('accepted');
      });

      it('should return null for non-proposed ADR', () => {
        acceptADR(adr.id);
        expect(acceptADR(adr.id)).toBeNull();
      });
    });

    describe('deprecateADR', () => {
      it('should deprecate an accepted ADR', () => {
        acceptADR(adr.id);
        const deprecated = deprecateADR(adr.id, 'No longer relevant');

        expect(deprecated).not.toBeNull();
        expect(deprecated!.status).toBe('deprecated');
        expect(deprecated!.metadata.deprecationReason).toBe('No longer relevant');
      });

      it('should return null for non-accepted ADR', () => {
        expect(deprecateADR(adr.id)).toBeNull();
      });
    });

    describe('supersedeADR', () => {
      it('should supersede an accepted ADR', () => {
        acceptADR(adr.id);
        const newADR = createADR('New Decision', 'Context', 'Better decision');
        const superseded = supersedeADR(adr.id, newADR.id);

        expect(superseded).not.toBeNull();
        expect(superseded!.status).toBe('superseded');
        expect(superseded!.supersededBy).toBe(newADR.id);
      });

      it('should return null for non-accepted ADR', () => {
        const newADR = createADR('New', 'Context', 'Decision');
        expect(supersedeADR(adr.id, newADR.id)).toBeNull();
      });
    });

    describe('rejectADR', () => {
      it('should reject a proposed ADR', () => {
        const rejected = rejectADR(adr.id, 'Not feasible');

        expect(rejected).not.toBeNull();
        expect(rejected!.status).toBe('rejected');
        expect(rejected!.metadata.rejectionReason).toBe('Not feasible');
      });

      it('should return null for non-proposed ADR', () => {
        acceptADR(adr.id);
        expect(rejectADR(adr.id)).toBeNull();
      });
    });
  });

  describe('Updates', () => {
    let adr: ADR;

    beforeEach(() => {
      adr = createADR('Test Decision', 'Context', 'Decision');
    });

    describe('updateADR', () => {
      it('should update ADR fields', () => {
        const updated = updateADR(adr.id, {
          title: 'Updated Title',
          context: 'Updated context',
        });

        expect(updated).not.toBeNull();
        expect(updated!.title).toBe('Updated Title');
        expect(updated!.context).toBe('Updated context');
        expect(updated!.updatedAt).toBeGreaterThan(adr.createdAt);
      });

      it('should preserve immutable fields', () => {
        const updated = updateADR(adr.id, { title: 'New' });

        expect(updated!.id).toBe(adr.id);
        expect(updated!.number).toBe(adr.number);
        expect(updated!.createdAt).toBe(adr.createdAt);
      });

      it('should return null for unknown ADR', () => {
        expect(updateADR('unknown', { title: 'New' })).toBeNull();
      });
    });

    describe('addConsequence', () => {
      it('should add a consequence', () => {
        const updated = addConsequence(adr.id, 'New consequence');

        expect(updated).not.toBeNull();
        expect(updated!.consequences).toContain('New consequence');
      });
    });

    describe('addAlternative', () => {
      it('should add an alternative', () => {
        const alt = createAlternative('Option B', 'Description');
        const updated = addAlternative(adr.id, alt);

        expect(updated).not.toBeNull();
        expect(updated!.alternatives.length).toBe(1);
        expect(updated!.alternatives[0].name).toBe('Option B');
      });
    });

    describe('addRelatedADR', () => {
      it('should add a related ADR', () => {
        const related = createADR('Related', 'Context', 'Decision');
        const updated = addRelatedADR(adr.id, related.id);

        expect(updated).not.toBeNull();
        expect(updated!.relatedADRs).toContain(related.id);
      });

      it('should not duplicate related ADRs', () => {
        const related = createADR('Related', 'Context', 'Decision');
        addRelatedADR(adr.id, related.id);
        const updated = addRelatedADR(adr.id, related.id);

        expect(updated).toBeNull();
      });
    });

    describe('addTag / removeTag', () => {
      it('should add a tag', () => {
        const updated = addTag(adr.id, 'important');

        expect(updated).not.toBeNull();
        expect(updated!.tags).toContain('important');
      });

      it('should not duplicate tags', () => {
        addTag(adr.id, 'important');
        expect(addTag(adr.id, 'important')).toBeNull();
      });

      it('should remove a tag', () => {
        addTag(adr.id, 'important');
        const updated = removeTag(adr.id, 'important');

        expect(updated).not.toBeNull();
        expect(updated!.tags).not.toContain('important');
      });
    });
  });

  describe('Query Functions', () => {
    beforeEach(() => {
      const adr1 = createADR('Agentic Loop', 'Context', 'Decision', {
        category: 'agentic-loop',
        tags: ['core'],
      });
      acceptADR(adr1.id);

      const adr2 = createADR('Tool Selection', 'Context', 'Decision', {
        category: 'tool-selection',
        tags: ['core', 'tools'],
      });
      acceptADR(adr2.id);

      createADR('HMR Approach', 'Context', 'Decision', {
        category: 'hmr',
        tags: ['performance'],
      });
    });

    describe('queryADRs', () => {
      it('should filter by status', () => {
        const results = queryADRs({ status: 'accepted' });
        expect(results.length).toBe(2);
      });

      it('should filter by category', () => {
        const results = queryADRs({ category: 'agentic-loop' });
        expect(results.length).toBe(1);
      });

      it('should filter by tags', () => {
        const results = queryADRs({ tags: ['core'] });
        expect(results.length).toBe(2);
      });

      it('should search by text', () => {
        const results = queryADRs({ searchText: 'Loop' });
        expect(results.length).toBe(1);
        expect(results[0].title).toBe('Agentic Loop');
      });
    });

    describe('getADRsByStatus', () => {
      it('should return ADRs by status', () => {
        const accepted = getADRsByStatus('accepted');
        expect(accepted.length).toBe(2);

        const proposed = getADRsByStatus('proposed');
        expect(proposed.length).toBe(1);
      });
    });

    describe('getADRsByCategory', () => {
      it('should return ADRs by category', () => {
        const hmr = getADRsByCategory('hmr');
        expect(hmr.length).toBe(1);
      });
    });

    describe('getAcceptedADRs / getProposedADRs', () => {
      it('should return accepted ADRs', () => {
        expect(getAcceptedADRs().length).toBe(2);
      });

      it('should return proposed ADRs', () => {
        expect(getProposedADRs().length).toBe(1);
      });
    });

    describe('getRelatedADRs', () => {
      it('should return related ADRs', () => {
        const all = getAllADRs();
        addRelatedADR(all[0].id, all[1].id);

        const related = getRelatedADRs(all[0].id);
        expect(related.length).toBe(1);
        expect(related[0].id).toBe(all[1].id);
      });

      it('should return empty for ADR with no relations', () => {
        const all = getAllADRs();
        expect(getRelatedADRs(all[0].id)).toEqual([]);
      });
    });
  });

  describe('Summary and Statistics', () => {
    describe('getSummary', () => {
      it('should return correct summary', () => {
        const adr1 = createADR('ADR 1', 'Context', 'Decision', { category: 'agentic-loop' });
        acceptADR(adr1.id);

        createADR('ADR 2', 'Context', 'Decision', { category: 'tool-selection' });
        createADR('ADR 3', 'Context', 'Decision', { category: 'hmr' });

        const summary = getSummary();

        expect(summary.total).toBe(3);
        expect(summary.byStatus.accepted).toBe(1);
        expect(summary.byStatus.proposed).toBe(2);
        expect(summary.byCategory['agentic-loop']).toBe(1);
        expect(summary.byCategory['tool-selection']).toBe(1);
        expect(summary.byCategory.hmr).toBe(1);
        expect(summary.recentlyUpdated.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Default ADRs', () => {
    describe('initializeDefaultADRs', () => {
      it('should create default ADRs for major decisions', () => {
        initializeDefaultADRs();

        const all = getAllADRs();
        expect(all.length).toBe(3);

        const agenticLoop = getADRByNumber(1);
        expect(agenticLoop!.title).toBe('Agentic Loop Design');
        expect(agenticLoop!.status).toBe('accepted');
        expect(agenticLoop!.category).toBe('agentic-loop');

        const toolSelection = getADRByNumber(2);
        expect(toolSelection!.title).toBe('Tool Selection Strategy');
        expect(toolSelection!.status).toBe('accepted');
        expect(toolSelection!.category).toBe('tool-selection');

        const hmr = getADRByNumber(3);
        expect(hmr!.title).toBe('Hot Module Replacement (HMR) Approach');
        expect(hmr!.status).toBe('accepted');
        expect(hmr!.category).toBe('hmr');
      });

      it('should include alternatives in default ADRs', () => {
        initializeDefaultADRs();

        const agenticLoop = getADRByNumber(1);
        expect(agenticLoop!.alternatives.length).toBeGreaterThan(0);
        expect(agenticLoop!.alternatives[0].rejected).toBe(true);
      });

      it('should include consequences in default ADRs', () => {
        initializeDefaultADRs();

        const toolSelection = getADRByNumber(2);
        expect(toolSelection!.consequences.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Export and Display', () => {
    describe('formatADR', () => {
      it('should format ADR as markdown', () => {
        const adr = createADR('Test Decision', 'Test context', 'Test decision', {
          consequences: ['Consequence 1'],
          tags: ['test'],
        });

        const formatted = formatADR(adr);

        expect(formatted).toContain('# ADR-1: Test Decision');
        expect(formatted).toContain('**Status:** proposed');
        expect(formatted).toContain('## Context');
        expect(formatted).toContain('Test context');
        expect(formatted).toContain('## Decision');
        expect(formatted).toContain('Test decision');
        expect(formatted).toContain('## Consequences');
        expect(formatted).toContain('- Consequence 1');
        expect(formatted).toContain('**Tags:** test');
      });
    });

    describe('exportADRs', () => {
      it('should export all ADRs as formatted text', () => {
        createADR('ADR 1', 'Context 1', 'Decision 1');
        createADR('ADR 2', 'Context 2', 'Decision 2');

        const exported = exportADRs();

        expect(exported).toContain('ADR-1');
        expect(exported).toContain('ADR-2');
        expect(exported).toContain('---');
      });
    });

    describe('exportAsJSON', () => {
      it('should export as JSON string', () => {
        createADR('Test ADR', 'Context', 'Decision');

        const json = exportAsJSON();
        const parsed = JSON.parse(json);

        expect(parsed.exportedAt).toBeGreaterThan(0);
        expect(parsed.adrs.length).toBe(1);
        expect(parsed.summary.total).toBe(1);
      });
    });
  });

  describe('State and Cleanup', () => {
    describe('getState', () => {
      it('should return current state', () => {
        createADR('Test', 'Context', 'Decision');

        const currentState = getState();
        expect(currentState.adrs.size).toBe(1);
        expect(currentState.nextNumber).toBe(2);
      });
    });

    describe('removeADR', () => {
      it('should remove ADR', () => {
        const adr = createADR('Test', 'Context', 'Decision');
        expect(removeADR(adr.id)).toBe(true);
        expect(getADR(adr.id)).toBeNull();
      });

      it('should remove from related ADRs', () => {
        const adr1 = createADR('ADR 1', 'Context', 'Decision');
        const adr2 = createADR('ADR 2', 'Context', 'Decision');
        addRelatedADR(adr1.id, adr2.id);

        removeADR(adr2.id);

        const updated = getADR(adr1.id);
        expect(updated!.relatedADRs).not.toContain(adr2.id);
      });

      it('should return false for unknown ADR', () => {
        expect(removeADR('unknown')).toBe(false);
      });
    });

    describe('clearADRs', () => {
      it('should clear all ADRs', () => {
        createADR('ADR 1', 'Context', 'Decision');
        createADR('ADR 2', 'Context', 'Decision');

        clearADRs();

        expect(getADRCount()).toBe(0);
      });

      it('should reset number sequence', () => {
        createADR('ADR 1', 'Context', 'Decision');
        clearADRs();

        const newADR = createADR('New ADR', 'Context', 'Decision');
        expect(newADR.number).toBe(1);
      });
    });
  });

  describe('resetArchitectureDecisions', () => {
    it('should reset all state', () => {
      createADR('Test', 'Context', 'Decision');

      resetArchitectureDecisions();

      expect(getADRCount()).toBe(0);
      expect(getState().nextNumber).toBe(1);
    });
  });

  describe('Utility Functions', () => {
    describe('createAlternative', () => {
      it('should create alternative with defaults', () => {
        const alt = createAlternative('Option A', 'Description');

        expect(alt.name).toBe('Option A');
        expect(alt.description).toBe('Description');
        expect(alt.pros).toEqual([]);
        expect(alt.cons).toEqual([]);
        expect(alt.rejected).toBe(false);
        expect(alt.rejectionReason).toBeNull();
      });

      it('should create alternative with options', () => {
        const alt = createAlternative('Option A', 'Description', {
          pros: ['Pro 1', 'Pro 2'],
          cons: ['Con 1'],
          rejected: true,
          rejectionReason: 'Too complex',
        });

        expect(alt.pros).toEqual(['Pro 1', 'Pro 2']);
        expect(alt.cons).toEqual(['Con 1']);
        expect(alt.rejected).toBe(true);
        expect(alt.rejectionReason).toBe('Too complex');
      });
    });
  });

  describe('ADRs for Major Decisions', () => {
    it('should document agentic loop design decision', () => {
      initializeDefaultADRs();
      const adr = getADRsByCategory('agentic-loop')[0];

      expect(adr).toBeDefined();
      expect(adr.title).toContain('Agentic Loop');
      expect(adr.decision).toContain('self-correct');
      expect(adr.alternatives.length).toBeGreaterThan(0);
    });

    it('should document tool selection decision', () => {
      initializeDefaultADRs();
      const adr = getADRsByCategory('tool-selection')[0];

      expect(adr).toBeDefined();
      expect(adr.title).toContain('Tool Selection');
      expect(adr.decision).toContain('context-aware');
    });

    it('should document HMR approach decision', () => {
      initializeDefaultADRs();
      const adr = getADRsByCategory('hmr')[0];

      expect(adr).toBeDefined();
      expect(adr.title).toContain('HMR');
      expect(adr.decision).toContain('Vite');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty ADR list', () => {
      expect(getAllADRs()).toEqual([]);
      expect(getSummary().total).toBe(0);
    });

    it('should handle ADR with no consequences', () => {
      const adr = createADR('Test', 'Context', 'Decision');
      const formatted = formatADR(adr);

      expect(formatted).not.toContain('## Consequences');
    });

    it('should handle ADR with no alternatives', () => {
      const adr = createADR('Test', 'Context', 'Decision');
      const formatted = formatADR(adr);

      expect(formatted).not.toContain('## Alternatives');
    });

    it('should handle search with no matches', () => {
      createADR('Test', 'Context', 'Decision');
      const results = queryADRs({ searchText: 'nonexistent' });

      expect(results).toEqual([]);
    });
  });
});

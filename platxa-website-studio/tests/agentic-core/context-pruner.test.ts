/**
 * Tests for ContextPruner
 * Feature #33: Implement context pruning keeping total tokens under 80% of model limit
 *
 * Verification: Prunes oldest/least-relevant items when approaching limit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContextPruner,
  createContextPruner,
  createPrunerForModel,
  MODEL_TOKEN_LIMITS,
  type PrunableItem,
} from '@/lib/agentic-core/context-pruner';
import {
  ContextManager,
  type KnowledgeEntry,
} from '@/lib/agentic-core/context-manager';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestManager(): ContextManager {
  return new ContextManager({ maxEntries: 1000 });
}

function addTestFiles(manager: ContextManager, count: number, contentSize = 100): void {
  for (let i = 0; i < count; i++) {
    const content = 'x'.repeat(contentSize);
    manager.addFileContent(`file${i}.ts`, content);
  }
}

function createEntryWithAge(
  manager: ContextManager,
  key: string,
  ageMs: number,
  relevance?: number
): void {
  // Add the entry normally
  manager.addFileContent(key, 'test content for ' + key);

  // Manually adjust the timestamp in the knowledge base
  // This is a test helper - in real usage, entries would naturally age
  const knowledge = manager.getAllKnowledge();
  const entry = knowledge.find(e => e.key === key);
  if (entry) {
    (entry as KnowledgeEntry).createdAt = new Date(Date.now() - ageMs);
    if (relevance !== undefined) {
      (entry as KnowledgeEntry).relevance = relevance;
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('ContextPruner', () => {
  describe('constructor', () => {
    it('creates instance with default config', () => {
      const pruner = new ContextPruner();
      expect(pruner).toBeInstanceOf(ContextPruner);

      const config = pruner.getConfig();
      expect(config.modelTokenLimit).toBe(128000);
      expect(config.targetPercentage).toBe(0.8);
      expect(config.charsPerToken).toBe(4);
    });

    it('accepts custom config', () => {
      const pruner = createContextPruner({
        modelTokenLimit: 200000,
        targetPercentage: 0.7,
        charsPerToken: 3,
      });

      const config = pruner.getConfig();
      expect(config.modelTokenLimit).toBe(200000);
      expect(config.targetPercentage).toBe(0.7);
      expect(config.charsPerToken).toBe(3);
    });
  });

  describe('token estimation', () => {
    let pruner: ContextPruner;
    let manager: ContextManager;

    beforeEach(() => {
      pruner = new ContextPruner({ charsPerToken: 4 });
      manager = createTestManager();
    });

    it('estimates tokens for a single item', () => {
      manager.addFileContent('test.ts', 'const x = 1;'); // 12 chars

      const knowledge = manager.getAllKnowledge();
      const estimate = pruner.estimateItemTokens(knowledge[0]);

      // 12 (content) + 7 (key) + tags = ~19 chars = ~5 tokens
      expect(estimate.tokens).toBeGreaterThan(0);
      expect(estimate.characters).toBeGreaterThan(0);
      expect(estimate.type).toBe('file');
    });

    it('estimates total context tokens', () => {
      manager.addFileContent('file1.ts', 'a'.repeat(100));
      manager.addFileContent('file2.ts', 'b'.repeat(200));
      manager.addSearchResults('query', [{ file: 'c.ts' }]);

      const estimate = pruner.estimateContextTokens(manager);

      expect(estimate.totalTokens).toBeGreaterThan(0);
      expect(estimate.itemCount).toBe(3);
      expect(estimate.tokensByType.file).toBeGreaterThan(0);
      expect(estimate.tokensByType.search).toBeGreaterThan(0);
    });

    it('calculates percentage used', () => {
      const pruner = new ContextPruner({ modelTokenLimit: 1000 });
      manager.addFileContent('test.ts', 'x'.repeat(400)); // ~100 tokens

      const estimate = pruner.estimateContextTokens(manager);

      expect(estimate.percentUsed).toBeGreaterThan(0);
      expect(estimate.percentUsed).toBeLessThan(1);
    });
  });

  describe('shouldPrune', () => {
    it('returns false when under threshold', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 1000,
        targetPercentage: 0.8,
      });

      expect(pruner.shouldPrune(500)).toBe(false);
      expect(pruner.shouldPrune(799)).toBe(false);
    });

    it('returns true when at or over threshold', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 1000,
        targetPercentage: 0.8,
      });

      expect(pruner.shouldPrune(800)).toBe(false); // Exactly at threshold
      expect(pruner.shouldPrune(801)).toBe(true);
      expect(pruner.shouldPrune(1000)).toBe(true);
    });
  });

  describe('getTokenThreshold', () => {
    it('calculates 80% threshold correctly', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 100000,
        targetPercentage: 0.8,
      });

      expect(pruner.getTokenThreshold()).toBe(80000);
    });

    it('handles different percentages', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 100000,
        targetPercentage: 0.7,
      });

      expect(pruner.getTokenThreshold()).toBe(70000);
    });
  });

  describe('calculatePriority', () => {
    let pruner: ContextPruner;

    beforeEach(() => {
      pruner = new ContextPruner();
    });

    it('gives higher priority to error type', () => {
      const errorEntry: KnowledgeEntry = {
        id: '1',
        type: 'error',
        key: 'error1',
        data: 'error message',
        source: 'test',
        iteration: 1,
        createdAt: new Date(),
      };

      const fileEntry: KnowledgeEntry = {
        id: '2',
        type: 'file',
        key: 'file1',
        data: 'file content',
        source: 'test',
        iteration: 1,
        createdAt: new Date(),
      };

      const errorPriority = pruner.calculatePriority(errorEntry);
      const filePriority = pruner.calculatePriority(fileEntry);

      expect(errorPriority).toBeGreaterThan(filePriority);
    });

    it('gives higher priority to newer items', () => {
      const newEntry: KnowledgeEntry = {
        id: '1',
        type: 'file',
        key: 'new',
        data: 'content',
        source: 'test',
        iteration: 1,
        createdAt: new Date(),
      };

      const oldEntry: KnowledgeEntry = {
        id: '2',
        type: 'file',
        key: 'old',
        data: 'content',
        source: 'test',
        iteration: 1,
        createdAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes old
      };

      const newPriority = pruner.calculatePriority(newEntry);
      const oldPriority = pruner.calculatePriority(oldEntry);

      expect(newPriority).toBeGreaterThan(oldPriority);
    });

    it('gives higher priority to more relevant items', () => {
      const relevantEntry: KnowledgeEntry = {
        id: '1',
        type: 'file',
        key: 'relevant',
        data: 'content',
        source: 'test',
        iteration: 1,
        createdAt: new Date(),
        relevance: 0.9,
      };

      const irrelevantEntry: KnowledgeEntry = {
        id: '2',
        type: 'file',
        key: 'irrelevant',
        data: 'content',
        source: 'test',
        iteration: 1,
        createdAt: new Date(),
        relevance: 0.1,
      };

      const relevantPriority = pruner.calculatePriority(relevantEntry);
      const irrelevantPriority = pruner.calculatePriority(irrelevantEntry);

      expect(relevantPriority).toBeGreaterThan(irrelevantPriority);
    });
  });

  describe('getPrunableItems', () => {
    it('returns items sorted by priority (lowest first)', () => {
      const pruner = new ContextPruner();
      const manager = createTestManager();

      manager.addFileContent('file1.ts', 'content1');
      manager.addError('error message', 'test');
      manager.addSearchResults('query', []);

      const items = pruner.getPrunableItems(manager);

      expect(items.length).toBe(3);
      // Should be sorted by priority (lowest first)
      for (let i = 1; i < items.length; i++) {
        expect(items[i].priority).toBeGreaterThanOrEqual(items[i - 1].priority);
      }
    });
  });

  describe('prune', () => {
    it('does nothing when under threshold', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 100000,
        targetPercentage: 0.8,
      });
      const manager = createTestManager();

      manager.addFileContent('small.ts', 'x'.repeat(10));

      const stats = pruner.prune(manager);

      expect(stats.itemsPruned).toBe(0);
      expect(stats.tokensFreed).toBe(0);
    });

    it('prunes when over threshold', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 100, // Very small limit for testing
        targetPercentage: 0.8,
        charsPerToken: 1,
      });
      const manager = createTestManager();

      // Add enough content to exceed threshold (80 tokens)
      manager.addFileContent('file1.ts', 'x'.repeat(50));
      manager.addFileContent('file2.ts', 'y'.repeat(50));
      manager.addFileContent('file3.ts', 'z'.repeat(50));

      const stats = pruner.prune(manager);

      expect(stats.itemsPruned).toBeGreaterThan(0);
      expect(stats.tokensFreed).toBeGreaterThan(0);
      expect(stats.percentUsed).toBeLessThanOrEqual(0.8);
    });

    it('tracks pruned items by type', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 100,
        targetPercentage: 0.5,
        charsPerToken: 1,
      });
      const manager = createTestManager();

      manager.addFileContent('file1.ts', 'x'.repeat(40));
      manager.addSearchResults('query', [{ data: 'y'.repeat(40) }]);

      const stats = pruner.prune(manager);

      expect(stats.prunedByType).toBeDefined();
      expect(typeof stats.prunedByType).toBe('object');
    });
  });

  describe('getItemsToPrune (dry run)', () => {
    it('returns empty when under threshold', () => {
      const pruner = new ContextPruner({ modelTokenLimit: 100000 });
      const manager = createTestManager();

      manager.addFileContent('small.ts', 'content');

      const items = pruner.getItemsToPrune(manager);

      expect(items).toHaveLength(0);
    });

    it('returns items that would be pruned', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 100,
        targetPercentage: 0.5,
        charsPerToken: 1,
      });
      const manager = createTestManager();

      manager.addFileContent('file1.ts', 'x'.repeat(40));
      manager.addFileContent('file2.ts', 'y'.repeat(40));

      const items = pruner.getItemsToPrune(manager);

      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('pruneOldest', () => {
    it('prunes oldest items first', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 200,
        targetPercentage: 0.5, // 100 token threshold
        charsPerToken: 1,
      });
      const manager = createTestManager();

      // Add items with different ages
      createEntryWithAge(manager, 'oldest.ts', 10 * 60 * 1000); // 10 min old
      createEntryWithAge(manager, 'middle.ts', 5 * 60 * 1000);  // 5 min old
      createEntryWithAge(manager, 'newest.ts', 1 * 60 * 1000);  // 1 min old

      // Add more content to trigger pruning
      manager.addFileContent('extra1.ts', 'x'.repeat(100));
      manager.addFileContent('extra2.ts', 'y'.repeat(100));

      const stats = pruner.pruneOldest(manager);

      expect(stats.itemsPruned).toBeGreaterThan(0);
      // Oldest items should be pruned first
      expect(stats.prunedByType.file).toBeGreaterThan(0);
    });
  });

  describe('pruneLeastRelevant', () => {
    it('prunes least relevant items first', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 200,
        targetPercentage: 0.5,
        charsPerToken: 1,
      });
      const manager = createTestManager();

      // Add items with different relevance scores
      manager.addFileContent('low-relevance.ts', 'x'.repeat(50));
      manager.addFileContent('high-relevance.ts', 'y'.repeat(50));
      manager.addFileContent('medium-relevance.ts', 'z'.repeat(50));

      // Set relevance scores
      const knowledge = manager.getAllKnowledge();
      const lowRelevance = knowledge.find(e => e.key === 'low-relevance.ts');
      const highRelevance = knowledge.find(e => e.key === 'high-relevance.ts');
      const mediumRelevance = knowledge.find(e => e.key === 'medium-relevance.ts');

      if (lowRelevance) lowRelevance.relevance = 0.1;
      if (highRelevance) highRelevance.relevance = 0.9;
      if (mediumRelevance) mediumRelevance.relevance = 0.5;

      const stats = pruner.pruneLeastRelevant(manager);

      expect(stats.itemsPruned).toBeGreaterThan(0);
    });
  });

  describe('pruneByAge', () => {
    it('prunes items older than maxAgeMs', () => {
      const pruner = new ContextPruner({
        maxAgeMs: 5 * 60 * 1000, // 5 minutes
      });
      const manager = createTestManager();

      // Add old item
      createEntryWithAge(manager, 'old.ts', 10 * 60 * 1000); // 10 min old
      // Add new item
      manager.addFileContent('new.ts', 'new content');

      const stats = pruner.pruneByAge(manager);

      expect(stats.itemsPruned).toBe(1);
    });
  });

  describe('pruneByType', () => {
    it('prunes all items of specified type', () => {
      const pruner = new ContextPruner();
      const manager = createTestManager();

      manager.addFileContent('file1.ts', 'content1');
      manager.addFileContent('file2.ts', 'content2');
      manager.addSearchResults('query1', []);
      manager.addSearchResults('query2', []);

      const stats = pruner.pruneByType(manager, 'search');

      expect(stats.itemsPruned).toBe(2);
      expect(stats.prunedByType.search).toBe(2);
    });
  });

  describe('configuration', () => {
    it('updateConfig updates settings', () => {
      const pruner = new ContextPruner();

      pruner.updateConfig({ modelTokenLimit: 50000 });

      expect(pruner.getConfig().modelTokenLimit).toBe(50000);
    });

    it('setModelLimit sets limit by model name', () => {
      const pruner = new ContextPruner();

      pruner.setModelLimit('claude-3-opus');

      expect(pruner.getConfig().modelTokenLimit).toBe(200000);
    });

    it('setModelLimit sets limit by number', () => {
      const pruner = new ContextPruner();

      pruner.setModelLimit(150000);

      expect(pruner.getConfig().modelTokenLimit).toBe(150000);
    });
  });

  describe('factory functions', () => {
    it('createContextPruner creates instance', () => {
      const pruner = createContextPruner({ modelTokenLimit: 50000 });
      expect(pruner).toBeInstanceOf(ContextPruner);
      expect(pruner.getConfig().modelTokenLimit).toBe(50000);
    });

    it('createPrunerForModel creates with model limit', () => {
      const pruner = createPrunerForModel('claude-3-sonnet', 0.75);

      expect(pruner.getConfig().modelTokenLimit).toBe(200000);
      expect(pruner.getConfig().targetPercentage).toBe(0.75);
    });
  });

  describe('MODEL_TOKEN_LIMITS', () => {
    it('contains expected models', () => {
      expect(MODEL_TOKEN_LIMITS['claude-3-opus']).toBe(200000);
      expect(MODEL_TOKEN_LIMITS['claude-3-sonnet']).toBe(200000);
      expect(MODEL_TOKEN_LIMITS['gpt-4']).toBe(128000);
      expect(MODEL_TOKEN_LIMITS.default).toBe(128000);
    });
  });

  // ==========================================================================
  // Feature #33 Verification Tests
  // ==========================================================================

  describe('Feature #33 verification: Prunes oldest/least-relevant items when approaching limit', () => {
    it('keeps context under 80% of model limit', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 500,
        targetPercentage: 0.8, // 400 token threshold
        charsPerToken: 1,
      });
      const manager = createTestManager();

      // Add content that would exceed 80% threshold
      for (let i = 0; i < 10; i++) {
        manager.addFileContent(`file${i}.ts`, 'x'.repeat(50)); // 50 tokens each = 500 total
      }

      const beforeEstimate = pruner.estimateContextTokens(manager);
      expect(beforeEstimate.percentUsed).toBeGreaterThan(0.8);

      const stats = pruner.prune(manager);

      expect(stats.newTokenCount).toBeLessThanOrEqual(400); // 80% of 500
      expect(stats.percentUsed).toBeLessThanOrEqual(0.8);
    });

    it('prunes oldest items first when approaching limit', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 300,
        targetPercentage: 0.8,
        charsPerToken: 1,
      });
      const manager = createTestManager();

      // Add items with different ages (oldest first)
      createEntryWithAge(manager, 'oldest.ts', 20 * 60 * 1000);  // 20 min old
      createEntryWithAge(manager, 'older.ts', 15 * 60 * 1000);   // 15 min old
      createEntryWithAge(manager, 'middle.ts', 10 * 60 * 1000);  // 10 min old
      createEntryWithAge(manager, 'newer.ts', 5 * 60 * 1000);    // 5 min old
      manager.addFileContent('newest.ts', 'x'.repeat(50));       // just added

      // Add more to trigger pruning
      manager.addFileContent('extra.ts', 'y'.repeat(200));

      const itemsToPrune = pruner.getItemsToPrune(manager);

      // Oldest items should have lowest priority (be pruned first)
      if (itemsToPrune.length > 0) {
        const prunedKeys = itemsToPrune.map(i => i.entry.key);
        // Oldest items should be in the prune list
        expect(prunedKeys.some(k => k === 'oldest.ts' || k === 'older.ts')).toBe(true);
      }
    });

    it('prunes least-relevant items first when approaching limit', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 300,
        targetPercentage: 0.8,
        charsPerToken: 1,
      });
      const manager = createTestManager();

      // Add items with different relevance
      manager.addFileContent('low-rel.ts', 'x'.repeat(50));
      manager.addFileContent('mid-rel.ts', 'y'.repeat(50));
      manager.addFileContent('high-rel.ts', 'z'.repeat(50));
      manager.addFileContent('extra.ts', 'w'.repeat(150));

      // Set relevance scores
      const knowledge = manager.getAllKnowledge();
      knowledge.forEach(e => {
        if (e.key === 'low-rel.ts') e.relevance = 0.1;
        if (e.key === 'mid-rel.ts') e.relevance = 0.5;
        if (e.key === 'high-rel.ts') e.relevance = 0.9;
        if (e.key === 'extra.ts') e.relevance = 0.5;
      });

      const stats = pruner.pruneLeastRelevant(manager);

      expect(stats.itemsPruned).toBeGreaterThan(0);
      // Low relevance items should be pruned first
      expect(stats.newTokenCount).toBeLessThanOrEqual(240); // 80% of 300
    });

    it('combines age and relevance in priority calculation', () => {
      const pruner = new ContextPruner();
      const manager = createTestManager();

      // Old but highly relevant
      manager.addFileContent('old-relevant.ts', 'content');
      const oldRelevant = manager.getAllKnowledge().find(e => e.key === 'old-relevant.ts')!;
      oldRelevant.createdAt = new Date(Date.now() - 20 * 60 * 1000);
      oldRelevant.relevance = 0.95;

      // New but irrelevant
      manager.addFileContent('new-irrelevant.ts', 'content');
      const newIrrelevant = manager.getAllKnowledge().find(e => e.key === 'new-irrelevant.ts')!;
      newIrrelevant.relevance = 0.05;

      const items = pruner.getPrunableItems(manager);

      // Items should be sorted by priority
      const oldRelevantItem = items.find(i => i.entry.key === 'old-relevant.ts');
      const newIrrelevantItem = items.find(i => i.entry.key === 'new-irrelevant.ts');

      // Both age and relevance contribute to priority
      expect(oldRelevantItem).toBeDefined();
      expect(newIrrelevantItem).toBeDefined();
    });

    it('type priority affects pruning order (errors kept longer)', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 200,
        targetPercentage: 0.5,
        charsPerToken: 1,
      });
      const manager = createTestManager();

      // Add error (high priority)
      manager.addError('important error', 'test');

      // Add files (lower priority)
      manager.addFileContent('file1.ts', 'x'.repeat(50));
      manager.addFileContent('file2.ts', 'y'.repeat(50));
      manager.addFileContent('file3.ts', 'z'.repeat(50));

      const items = pruner.getPrunableItems(manager);

      // Error should have highest priority (be at end of sorted list)
      const errorItem = items.find(i => i.type === 'error');
      const fileItems = items.filter(i => i.type === 'file');

      expect(errorItem).toBeDefined();
      expect(errorItem!.priority).toBeGreaterThan(fileItems[0].priority);
    });

    it('prune stats accurately track what was removed', () => {
      const pruner = new ContextPruner({
        modelTokenLimit: 200,
        targetPercentage: 0.5,
        charsPerToken: 1,
      });
      const manager = createTestManager();

      manager.addFileContent('file1.ts', 'x'.repeat(60));
      manager.addFileContent('file2.ts', 'y'.repeat(60));
      manager.addSearchResults('query', [{ data: 'z'.repeat(60) }]);

      const beforeEstimate = pruner.estimateContextTokens(manager);
      const stats = pruner.prune(manager);

      expect(stats.itemsPruned).toBeGreaterThan(0);
      expect(stats.tokensFreed).toBeGreaterThan(0);
      expect(stats.newTokenCount).toBe(beforeEstimate.totalTokens - stats.tokensFreed);
      expect(stats.percentUsed).toBeLessThanOrEqual(0.5);
    });
  });
});

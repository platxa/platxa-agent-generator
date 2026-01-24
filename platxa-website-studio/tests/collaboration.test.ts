/**
 * Collaboration Features Comprehensive Tests
 * Tests templates, snippet library, history, and share
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAllTemplates,
  getTemplateById,
  getTemplatesByCategory,
  templateToThemeConfig,
  PROJECT_TEMPLATES,
  TEMPLATE_CATEGORIES,
} from '../lib/templates/project-templates';
import {
  getAllSnippets,
  getSnippetById,
  getSnippetsByCategory,
  searchSnippets,
  getCategories,
  applySnippetOptions,
  generateSnippetRegistration,
} from '../lib/components/snippet-library';
import {
  HistoryManager,
  createHistoryState,
  setupHistoryShortcuts,
  type HistoryAction,
} from '../lib/history';
import {
  ShareManager,
  copyToClipboard,
  generateShortUrl,
  parseShareUrl,
} from '../lib/share';

// =============================================================================
// PROJECT TEMPLATES TESTS
// =============================================================================

describe('Project Templates', () => {
  describe('Template Registry', () => {
    it('should have all industry templates defined', () => {
      const templates = getAllTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(10);
    });

    it('should have required properties for each template', () => {
      const templates = getAllTemplates();
      templates.forEach((template) => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.category).toBeDefined();
        expect(template.colors).toBeDefined();
        expect(template.typography).toBeDefined();
      });
    });

    it('should have unique template IDs', () => {
      const templates = getAllTemplates();
      const ids = templates.map((t) => t.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('Template Retrieval', () => {
    it('should get template by ID', () => {
      const template = getTemplateById('restaurant_modern');
      expect(template).toBeDefined();
      expect(template?.name).toContain('Restaurant');
    });

    it('should return undefined for invalid ID', () => {
      const template = getTemplateById('nonexistent_template');
      expect(template).toBeUndefined();
    });

    it('should get templates by category', () => {
      const restaurantTemplates = getTemplatesByCategory('restaurant');
      expect(restaurantTemplates.length).toBeGreaterThan(0);
      restaurantTemplates.forEach((t) => {
        expect(t.category).toBe('restaurant');
      });
    });
  });

  describe('Template Categories', () => {
    it('should have all categories defined', () => {
      expect(TEMPLATE_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('should have id and label for each category', () => {
      TEMPLATE_CATEGORIES.forEach((cat) => {
        expect(cat.id).toBeDefined();
        expect(cat.label).toBeDefined();
      });
    });
  });

  describe('Template to ThemeConfig Conversion', () => {
    it('should convert template to valid ThemeConfig', () => {
      const template = getTemplateById('tech_saas');
      expect(template).toBeDefined();

      const config = templateToThemeConfig(template!, 'my_custom_theme');
      expect(config.name).toBe('my_custom_theme');
      expect(config.colors).toEqual(template!.colors);
      expect(config.typography).toEqual(template!.typography);
    });

    it('should include features from template', () => {
      const template = getTemplateById('minimal_starter');
      expect(template).toBeDefined();

      const config = templateToThemeConfig(template!, 'test_theme');
      expect(config.features).toBeDefined();
    });
  });
});

// =============================================================================
// SNIPPET LIBRARY TESTS
// =============================================================================

describe('Snippet Library', () => {
  describe('Snippet Registry', () => {
    it('should have snippets in all categories', () => {
      const categories = getCategories();
      expect(categories.length).toBeGreaterThan(0);

      categories.forEach((cat) => {
        expect(cat.count).toBeGreaterThan(0);
      });
    });

    it('should have unique snippet IDs', () => {
      const snippets = getAllSnippets();
      const ids = snippets.map((s) => s.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('should have required properties for each snippet', () => {
      const snippets = getAllSnippets();
      snippets.forEach((snippet) => {
        expect(snippet.id).toBeDefined();
        expect(snippet.name).toBeDefined();
        expect(snippet.category).toBeDefined();
        expect(snippet.template).toBeDefined();
        expect(snippet.styles).toBeDefined();
      });
    });
  });

  describe('Snippet Retrieval', () => {
    it('should get snippet by ID', () => {
      const snippet = getSnippetById('hero_centered');
      expect(snippet).toBeDefined();
      expect(snippet?.category).toBe('hero');
    });

    it('should return undefined for invalid ID', () => {
      const snippet = getSnippetById('nonexistent_snippet');
      expect(snippet).toBeUndefined();
    });

    it('should get snippets by category', () => {
      const heroSnippets = getSnippetsByCategory('hero');
      expect(heroSnippets.length).toBeGreaterThan(0);
      heroSnippets.forEach((s) => {
        expect(s.category).toBe('hero');
      });
    });
  });

  describe('Snippet Search', () => {
    it('should search by name', () => {
      const results = searchSnippets('hero');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search by tags', () => {
      const results = searchSnippets('pricing');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should be case insensitive', () => {
      const upper = searchSnippets('HERO');
      const lower = searchSnippets('hero');
      expect(upper.length).toBe(lower.length);
    });

    it('should return empty for no matches', () => {
      const results = searchSnippets('xyznonexistent123');
      expect(results.length).toBe(0);
    });
  });

  describe('Snippet Options', () => {
    it('should have variants defined', () => {
      const snippet = getSnippetById('hero_centered');
      expect(snippet?.variants).toBeDefined();
      expect(snippet?.variants.length).toBeGreaterThan(0);
    });

    it('should have options defined', () => {
      const snippet = getSnippetById('hero_centered');
      expect(snippet?.options).toBeDefined();
    });

    it('should apply options to snippet', () => {
      const snippet = getSnippetById('hero_centered');
      expect(snippet).toBeDefined();

      const result = applySnippetOptions(snippet!, {
        'Background Type': 'solid',
      });

      expect(result.template).toBeDefined();
      expect(result.styles).toBeDefined();
    });
  });

  describe('Snippet Registration', () => {
    it('should generate Odoo snippet registration', () => {
      const registration = generateSnippetRegistration(['hero_centered', 'features_grid']);

      expect(registration).toContain('odoo.define');
      expect(registration).toContain('web_editor.snippets.options');
    });

    it('should handle empty snippet list', () => {
      const registration = generateSnippetRegistration([]);
      expect(registration).toBeDefined();
    });
  });

  describe('Categories', () => {
    it('should return categories with counts', () => {
      const categories = getCategories();

      categories.forEach((cat) => {
        expect(cat.id).toBeDefined();
        expect(cat.name).toBeDefined();
        expect(typeof cat.count).toBe('number');
      });
    });

    it('should have accurate counts', () => {
      const categories = getCategories();

      categories.forEach((cat) => {
        const snippetsInCategory = getSnippetsByCategory(cat.id);
        expect(snippetsInCategory.length).toBe(cat.count);
      });
    });
  });
});

// =============================================================================
// HISTORY SYSTEM TESTS
// =============================================================================

describe('History System', () => {
  describe('HistoryManager', () => {
    let history: HistoryManager;

    beforeEach(() => {
      history = new HistoryManager({ maxHistory: 50 });
    });

    it('should start with empty history', () => {
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });

    it('should record actions', () => {
      history.record({
        type: 'file_create',
        description: 'Created new file',
        before: null,
        after: { content: 'Hello' },
        affectedPaths: ['test.txt'],
      });

      expect(history.canUndo()).toBe(true);
    });

    it('should undo actions', () => {
      history.record({
        type: 'file_create',
        description: 'Created new file',
        before: null,
        after: { content: 'Hello' },
        affectedPaths: ['test.txt'],
      });

      const undone = history.undo();
      expect(undone).toBeDefined();
      expect(undone?.type).toBe('file_create');
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
    });

    it('should redo actions', () => {
      history.record({
        type: 'file_update',
        description: 'Updated file',
        before: { content: 'Old' },
        after: { content: 'New' },
        affectedPaths: ['test.txt'],
      });

      history.undo();
      const redone = history.redo();

      expect(redone).toBeDefined();
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
    });

    it('should truncate forward history on new action', () => {
      history.record({ type: 'file_create', description: 'Action 1', before: null, after: 1, affectedPaths: [] });
      history.record({ type: 'file_create', description: 'Action 2', before: null, after: 2, affectedPaths: [] });
      history.record({ type: 'file_create', description: 'Action 3', before: null, after: 3, affectedPaths: [] });

      history.undo();
      history.undo();

      history.record({ type: 'file_create', description: 'New Action', before: null, after: 4, affectedPaths: [] });

      expect(history.canRedo()).toBe(false);
      expect(history.getHistory().length).toBe(2);
    });

    it('should enforce max history limit', () => {
      const maxHistory = 5;
      const historyLimited = new HistoryManager({ maxHistory });

      for (let i = 0; i < 10; i++) {
        historyLimited.record({
          type: 'file_update',
          description: `Action ${i}`,
          before: i - 1,
          after: i,
          affectedPaths: [],
        });
      }

      expect(historyLimited.getHistory().length).toBe(maxHistory);
    });

    it('should record batch actions', () => {
      const batch = history.recordBatch('Batch operation', [
        { type: 'file_create', description: 'Create 1', before: null, after: 1, affectedPaths: ['a.txt'] },
        { type: 'file_create', description: 'Create 2', before: null, after: 2, affectedPaths: ['b.txt'] },
      ]);

      expect(batch.type).toBe('batch');
      expect(batch.affectedPaths).toContain('a.txt');
      expect(batch.affectedPaths).toContain('b.txt');
    });

    it('should peek undo/redo without executing', () => {
      history.record({ type: 'file_create', description: 'Test', before: null, after: 1, affectedPaths: [] });

      const peeked = history.peekUndo();
      expect(peeked?.description).toBe('Test');
      expect(history.canUndo()).toBe(true);
    });
  });

  describe('Snapshots', () => {
    let history: HistoryManager;

    beforeEach(() => {
      history = new HistoryManager();
    });

    it('should create named snapshots', () => {
      const snapshot = history.createSnapshot('Before refactor', { files: ['a.txt'] });

      expect(snapshot.name).toBe('Before refactor');
      expect(snapshot.isAuto).toBe(false);
    });

    it('should retrieve snapshots', () => {
      history.createSnapshot('Snapshot 1', { v: 1 });
      history.createSnapshot('Snapshot 2', { v: 2 });

      const snapshots = history.getSnapshots();
      expect(snapshots.length).toBe(2);
    });

    it('should get snapshot by ID', () => {
      const created = history.createSnapshot('Test', { data: 'test' });
      const retrieved = history.getSnapshot(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test');
    });

    it('should delete snapshots', () => {
      const snapshot = history.createSnapshot('To Delete', {});
      expect(history.getSnapshots().length).toBe(1);

      const deleted = history.deleteSnapshot(snapshot.id);
      expect(deleted).toBe(true);
      expect(history.getSnapshots().length).toBe(0);
    });

    it('should restore to snapshot', () => {
      const snapshot = history.createSnapshot('Restore Point', { version: 1 });

      history.record({ type: 'config_change', description: 'Change', before: 1, after: 2, affectedPaths: [] });

      const restored = history.restoreSnapshot(snapshot.id);
      expect(restored).toBeDefined();
    });
  });

  describe('Timeline', () => {
    let history: HistoryManager;

    beforeEach(() => {
      history = new HistoryManager();
    });

    it('should return timeline grouped by period', () => {
      history.record({ type: 'file_create', description: 'Recent', before: null, after: 1, affectedPaths: [] });

      const timeline = history.getTimeline();
      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[0].period).toBeDefined();
    });

    it('should jump to specific action', () => {
      const action1 = history.record({ type: 'file_create', description: 'Action 1', before: null, after: 1, affectedPaths: [] });
      history.record({ type: 'file_create', description: 'Action 2', before: null, after: 2, affectedPaths: [] });
      history.record({ type: 'file_create', description: 'Action 3', before: null, after: 3, affectedPaths: [] });

      const jumped = history.jumpTo(action1.id);
      expect(jumped).toBeDefined();
      expect(jumped?.description).toBe('Action 1');
    });
  });

  describe('Branches', () => {
    let history: HistoryManager;

    beforeEach(() => {
      history = new HistoryManager();
    });

    it('should create branches', () => {
      history.record({ type: 'file_create', description: 'Base', before: null, after: 1, affectedPaths: [] });

      const branch = history.createBranch('experiment');
      expect(branch.name).toBe('experiment');
    });

    it('should list all branches', () => {
      history.createBranch('feature-a');
      history.createBranch('feature-b');

      const branches = history.getBranches();
      expect(branches.length).toBe(3); // main + 2 new
    });

    it('should switch branches', () => {
      history.createBranch('new-branch');
      const switched = history.switchBranch('new-branch');
      expect(switched).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should return accurate stats', () => {
      const history = new HistoryManager();

      history.record({ type: 'file_create', description: 'A', before: null, after: 1, affectedPaths: [] });
      history.record({ type: 'file_create', description: 'B', before: null, after: 2, affectedPaths: [] });
      history.undo();
      history.createSnapshot('Test', {});

      const stats = history.getStats();
      expect(stats.totalActions).toBe(2);
      expect(stats.undoableCount).toBe(1);
      expect(stats.redoableCount).toBe(1);
      expect(stats.snapshotsCount).toBe(1);
    });
  });

  describe('Events', () => {
    it('should emit events on actions', () => {
      const history = new HistoryManager();
      const events: string[] = [];

      history.subscribe((event) => {
        events.push(event.type);
      });

      history.record({ type: 'file_create', description: 'Test', before: null, after: 1, affectedPaths: [] });
      history.undo();
      history.redo();

      expect(events).toContain('action_recorded');
      expect(events).toContain('undo');
      expect(events).toContain('redo');
    });

    it('should allow unsubscribe', () => {
      const history = new HistoryManager();
      let count = 0;

      const unsubscribe = history.subscribe(() => {
        count++;
      });

      history.record({ type: 'file_create', description: 'Test', before: null, after: 1, affectedPaths: [] });
      expect(count).toBe(1);

      unsubscribe();
      history.record({ type: 'file_create', description: 'Test 2', before: null, after: 2, affectedPaths: [] });
      expect(count).toBe(1);
    });
  });

  describe('Export/Import', () => {
    it('should export and import state', () => {
      const history = new HistoryManager();

      history.record({ type: 'file_create', description: 'Action', before: null, after: 1, affectedPaths: ['test.txt'] });
      history.createSnapshot('Checkpoint', { v: 1 });
      history.createBranch('feature');

      const exported = history.export();

      const newHistory = new HistoryManager();
      newHistory.import(exported);

      expect(newHistory.getHistory().length).toBe(1);
      expect(newHistory.getSnapshots().length).toBe(1);
      expect(newHistory.getBranches().length).toBe(2);
    });
  });

  describe('History State Wrapper', () => {
    it('should create history-enabled state', () => {
      const history = new HistoryManager();
      const state = createHistoryState({ count: 0 }, history);

      expect(state.getState().count).toBe(0);
    });

    it('should record state changes', () => {
      const history = new HistoryManager();
      const state = createHistoryState({ count: 0 }, history);

      state.setState({ count: 1 }, 'Increment count');

      expect(state.getState().count).toBe(1);
      expect(history.canUndo()).toBe(true);
    });

    it('should support function updater', () => {
      const history = new HistoryManager();
      const state = createHistoryState({ count: 5 }, history);

      state.setState((prev) => ({ count: prev.count + 1 }), 'Increment');

      expect(state.getState().count).toBe(6);
    });
  });
});

// =============================================================================
// SHARE SYSTEM TESTS
// =============================================================================

describe('Share System', () => {
  describe('ShareManager', () => {
    let share: ShareManager;

    beforeEach(() => {
      share = new ShareManager('https://platxa.studio');
    });

    describe('Share Links', () => {
      it('should create share link', () => {
        const link = share.createShareLink({
          projectId: 'project-123',
          permission: 'view',
          createdBy: 'user-1',
        });

        expect(link.id).toBeDefined();
        expect(link.token).toBeDefined();
        expect(link.permission).toBe('view');
        expect(link.isActive).toBe(true);
      });

      it('should generate share URL', () => {
        const link = share.createShareLink({
          projectId: 'project-123',
          permission: 'view',
          createdBy: 'user-1',
        });

        const url = share.getShareUrl(link);
        expect(url).toContain('https://platxa.studio/share/');
        expect(url).toContain(link.token);
      });

      it('should use custom slug in URL', () => {
        const link = share.createShareLink({
          projectId: 'project-123',
          permission: 'view',
          createdBy: 'user-1',
          customSlug: 'my-theme',
        });

        const url = share.getShareUrl(link);
        expect(url).toContain('my-theme');
      });

      it('should validate and use share link', () => {
        const link = share.createShareLink({
          projectId: 'project-123',
          permission: 'view',
          createdBy: 'user-1',
        });

        const result = share.useShareLink(link.token);
        expect(result.valid).toBe(true);
        expect(result.link).toBeDefined();
      });

      it('should reject invalid token', () => {
        const result = share.useShareLink('invalid-token');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should enforce max uses', () => {
        const link = share.createShareLink({
          projectId: 'project-123',
          permission: 'view',
          createdBy: 'user-1',
          maxUses: 2,
        });

        share.useShareLink(link.token);
        share.useShareLink(link.token);
        const result = share.useShareLink(link.token);

        expect(result.valid).toBe(false);
        expect(result.error).toContain('maximum');
      });

      it('should check expiration', () => {
        const link = share.createShareLink({
          projectId: 'project-123',
          permission: 'view',
          createdBy: 'user-1',
          expiresAt: new Date(Date.now() - 1000), // Already expired
        });

        const result = share.useShareLink(link.token);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('expired');
      });

      it('should revoke share link', () => {
        const link = share.createShareLink({
          projectId: 'project-123',
          permission: 'view',
          createdBy: 'user-1',
        });

        share.revokeShareLink(link.id);

        const result = share.useShareLink(link.token);
        expect(result.valid).toBe(false);
      });

      it('should get project links', () => {
        share.createShareLink({ projectId: 'project-1', permission: 'view', createdBy: 'user-1' });
        share.createShareLink({ projectId: 'project-1', permission: 'edit', createdBy: 'user-1' });
        share.createShareLink({ projectId: 'project-2', permission: 'view', createdBy: 'user-1' });

        const links = share.getProjectLinks('project-1');
        expect(links.length).toBe(2);
      });

      it('should update share link', () => {
        const link = share.createShareLink({
          projectId: 'project-123',
          permission: 'view',
          createdBy: 'user-1',
        });

        const updated = share.updateShareLink(link.id, { permission: 'edit' });
        expect(updated?.permission).toBe('edit');
      });
    });

    describe('Invites', () => {
      it('should send invite', () => {
        const invite = share.sendInvite({
          projectId: 'project-123',
          email: 'user@example.com',
          permission: 'edit',
          invitedBy: 'user-1',
        });

        expect(invite.id).toBeDefined();
        expect(invite.status).toBe('pending');
      });

      it('should accept invite', () => {
        const invite = share.sendInvite({
          projectId: 'project-123',
          email: 'user@example.com',
          permission: 'edit',
          invitedBy: 'user-1',
        });

        const result = share.acceptInvite(invite.id, 'new-user-id');
        expect(result.success).toBe(true);
      });

      it('should decline invite', () => {
        const invite = share.sendInvite({
          projectId: 'project-123',
          email: 'user@example.com',
          permission: 'view',
          invitedBy: 'user-1',
        });

        const declined = share.declineInvite(invite.id);
        expect(declined).toBe(true);
      });

      it('should get pending invites', () => {
        share.sendInvite({ projectId: 'project-1', email: 'a@test.com', permission: 'view', invitedBy: 'user-1' });
        share.sendInvite({ projectId: 'project-1', email: 'b@test.com', permission: 'view', invitedBy: 'user-1' });

        const pending = share.getPendingInvites('project-1');
        expect(pending.length).toBe(2);
      });
    });

    describe('Collaborators', () => {
      it('should add collaborator', () => {
        const collab = share.addCollaborator('project-123', {
          userId: 'user-2',
          email: 'collab@test.com',
          name: 'Collaborator',
          permission: 'edit',
          joinedAt: new Date(),
        });

        expect(collab.userId).toBe('user-2');
      });

      it('should get collaborators', () => {
        share.addCollaborator('project-123', {
          userId: 'user-2',
          email: 'a@test.com',
          name: 'User A',
          permission: 'edit',
          joinedAt: new Date(),
        });
        share.addCollaborator('project-123', {
          userId: 'user-3',
          email: 'b@test.com',
          name: 'User B',
          permission: 'view',
          joinedAt: new Date(),
        });

        const collaborators = share.getCollaborators('project-123');
        expect(collaborators.length).toBe(2);
      });

      it('should remove collaborator', () => {
        share.addCollaborator('project-123', {
          userId: 'user-2',
          email: 'test@test.com',
          name: 'Test',
          permission: 'edit',
          joinedAt: new Date(),
        });

        const removed = share.removeCollaborator('project-123', 'user-2');
        expect(removed).toBe(true);
        expect(share.getCollaborators('project-123').length).toBe(0);
      });

      it('should update collaborator permission', () => {
        share.addCollaborator('project-123', {
          userId: 'user-2',
          email: 'test@test.com',
          name: 'Test',
          permission: 'view',
          joinedAt: new Date(),
        });

        const updated = share.updateCollaboratorPermission('project-123', 'user-2', 'admin');
        expect(updated).toBe(true);

        const collaborators = share.getCollaborators('project-123');
        expect(collaborators[0].permission).toBe('admin');
      });

      it('should track online status', () => {
        share.addCollaborator('project-123', {
          userId: 'user-2',
          email: 'test@test.com',
          name: 'Test',
          permission: 'view',
          joinedAt: new Date(),
        });

        share.setOnlineStatus('project-123', 'user-2', true);

        const collaborators = share.getCollaborators('project-123');
        expect(collaborators[0].isOnline).toBe(true);
      });
    });

    describe('Embed Generation', () => {
      it('should generate embed code', () => {
        const config = share.getDefaultEmbedConfig();
        const embed = share.generateEmbedCode('project-123', 'share-token', config);

        expect(embed.iframe).toContain('<iframe');
        expect(embed.script).toContain('PlatxaEmbed');
        expect(embed.react).toContain('PlatxaEmbed');
        expect(embed.vue).toContain('PlatxaEmbed');
        expect(embed.url).toContain('share-token');
      });

      it('should include config options in embed URL', () => {
        const config = {
          ...share.getDefaultEmbedConfig(),
          showHeader: false,
          interactive: false,
        };

        const embed = share.generateEmbedCode('project-123', 'token', config);
        expect(embed.url).toContain('header=0');
        expect(embed.url).toContain('interactive=0');
      });
    });

    describe('Social Sharing', () => {
      it('should generate social share URLs', () => {
        const urls = share.generateSocialShareUrls({
          title: 'My Odoo Theme',
          description: 'A beautiful theme',
          url: 'https://platxa.studio/share/abc',
          hashtags: ['odoo', 'theme'],
        });

        expect(urls.twitter).toContain('twitter.com');
        expect(urls.facebook).toContain('facebook.com');
        expect(urls.linkedin).toContain('linkedin.com');
        expect(urls.email).toContain('mailto:');
      });

      it('should generate Open Graph tags', () => {
        const tags = share.generateOGTags({
          title: 'My Theme',
          description: 'Description',
          url: 'https://example.com',
          imageUrl: 'https://example.com/image.png',
        });

        expect(tags).toContain('og:title');
        expect(tags).toContain('og:description');
        expect(tags).toContain('og:image');
        expect(tags).toContain('twitter:card');
      });
    });
  });

  describe('Clipboard Utilities', () => {
    it('should copy to clipboard', async () => {
      const result = await copyToClipboard('test content');
      expect(result).toBe(true);
    });
  });

  describe('URL Utilities', () => {
    it('should generate short URL', () => {
      const shortUrl = generateShortUrl('https://platxa.studio/share/very-long-token-here');
      expect(shortUrl).toContain('pltx.io');
    });

    it('should use custom slug', () => {
      const shortUrl = generateShortUrl('https://example.com', 'custom');
      expect(shortUrl).toContain('custom');
    });

    it('should parse share URL', () => {
      const parsed = parseShareUrl('https://platxa.studio/share/abc123?p=edit&embed');
      expect(parsed.token).toBe('abc123');
    });
  });
});

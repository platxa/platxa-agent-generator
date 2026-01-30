/**
 * Tests for ExplorationSession and SessionRegistry
 *
 * Feature #58: Implement exploration session isolation (separate context per session)
 * Verification: Each plan session has unique ID and isolated context
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ExplorationSession,
  SessionRegistry,
  createExplorationSession,
  createSessionRegistry,
  getGlobalRegistry,
  createGlobalSession,
  getGlobalSession,
  type SessionStatus,
  type CreateSessionOptions,
} from '@/lib/agentic-core/exploration-session';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestSession(options?: CreateSessionOptions): ExplorationSession {
  return new ExplorationSession(options);
}

// ============================================================================
// Tests
// ============================================================================

describe('ExplorationSession', () => {
  describe('constructor', () => {
    it('creates session with unique ID', () => {
      const session = createTestSession();
      expect(session.getId()).toBeDefined();
      expect(session.getId()).toMatch(/^es_\d+_[a-z0-9]+$/);
    });

    it('creates session with different IDs each time', () => {
      const session1 = createTestSession();
      const session2 = createTestSession();
      expect(session1.getId()).not.toBe(session2.getId());
    });

    it('accepts optional name and goal', () => {
      const session = createTestSession({
        name: 'Test Session',
        goal: 'Test something',
      });

      const meta = session.getMetadata();
      expect(meta.name).toBe('Test Session');
      expect(meta.goal).toBe('Test something');
    });

    it('starts in active status', () => {
      const session = createTestSession();
      expect(session.getStatus()).toBe('active');
      expect(session.isActive()).toBe(true);
    });

    it('initializes with plan mode enabled', () => {
      const session = createTestSession();
      const context = session.toAgentContext();
      expect(context.planMode).toBe(true);
    });
  });

  describe('unique ID', () => {
    it('generates IDs with timestamp component', () => {
      const before = Date.now();
      const session = createTestSession();
      const after = Date.now();

      // Extract timestamp from ID (format: es_TIMESTAMP_RANDOM)
      const parts = session.getId().split('_');
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('generates IDs with random component', () => {
      const ids = new Set<string>();

      // Generate multiple IDs quickly
      for (let i = 0; i < 100; i++) {
        const session = createTestSession();
        ids.add(session.getId());
      }

      // All IDs should be unique
      expect(ids.size).toBe(100);
    });
  });

  describe('isolated context', () => {
    it('provides isolated context manager', () => {
      const session = createTestSession();
      const context = session.getContext();

      expect(context).toBeDefined();
      expect(typeof context.addFileContent).toBe('function');
    });

    it('contexts are isolated between sessions', () => {
      const session1 = createTestSession();
      const session2 = createTestSession();

      // Add file to session1
      session1.getContext().addFileContent('test.ts', 'content1');

      // Session2 should NOT have this file
      expect(session1.getContext().hasFile('test.ts')).toBe(true);
      expect(session2.getContext().hasFile('test.ts')).toBe(false);
    });

    it('modifications in one session do not affect another', () => {
      const session1 = createTestSession();
      const session2 = createTestSession();

      // Add different content to each session
      session1.getContext().addFileContent('shared.ts', 'version1');
      session2.getContext().addFileContent('shared.ts', 'version2');

      // Each session should have its own version
      expect(session1.getContext().getFileContent('shared.ts')).toBe('version1');
      expect(session2.getContext().getFileContent('shared.ts')).toBe('version2');
    });

    it('search results are isolated', () => {
      const session1 = createTestSession();
      const session2 = createTestSession();

      session1.getContext().addSearchResults('query1', [{ result: 1 }]);
      session2.getContext().addSearchResults('query2', [{ result: 2 }]);

      expect(session1.getContext().getSearchResults('query1')).toBeDefined();
      expect(session1.getContext().getSearchResults('query2')).toBeUndefined();

      expect(session2.getContext().getSearchResults('query2')).toBeDefined();
      expect(session2.getContext().getSearchResults('query1')).toBeUndefined();
    });
  });

  describe('session status', () => {
    it('can pause and resume', () => {
      const session = createTestSession();

      session.pause();
      expect(session.getStatus()).toBe('paused');
      expect(session.isActive()).toBe(false);

      session.resume();
      expect(session.getStatus()).toBe('active');
      expect(session.isActive()).toBe(true);
    });

    it('can complete', () => {
      const session = createTestSession();
      session.complete();
      expect(session.getStatus()).toBe('completed');
    });

    it('can abandon', () => {
      const session = createTestSession();
      session.abandon();
      expect(session.getStatus()).toBe('abandoned');
    });
  });

  describe('metadata', () => {
    it('tracks creation time', () => {
      const before = new Date();
      const session = createTestSession();
      const after = new Date();

      const meta = session.getMetadata();
      expect(meta.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(meta.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('updates last activity time', () => {
      const session = createTestSession();
      const initialActivity = session.getMetadata().lastActivityAt;

      // Perform some activity
      session.getContext().addFileContent('test.ts', 'content');

      const newActivity = session.getMetadata().lastActivityAt;
      expect(newActivity.getTime()).toBeGreaterThanOrEqual(initialActivity.getTime());
    });

    it('can update name and goal', () => {
      const session = createTestSession({ name: 'Old Name' });

      session.updateMetadata({ name: 'New Name', goal: 'New Goal' });

      const meta = session.getMetadata();
      expect(meta.name).toBe('New Name');
      expect(meta.goal).toBe('New Goal');
    });
  });

  describe('notes', () => {
    it('can add and retrieve notes', () => {
      const session = createTestSession();

      session.addNote('First note');
      session.addNote('Second note');

      const notes = session.getNotes();
      expect(notes).toHaveLength(2);
      expect(notes[0]).toBe('First note');
      expect(notes[1]).toBe('Second note');
    });

    it('can clear notes', () => {
      const session = createTestSession();
      session.addNote('Note');
      session.clearNotes();

      expect(session.getNotes()).toHaveLength(0);
    });
  });

  describe('checkpoints', () => {
    it('can create checkpoint', () => {
      const session = createTestSession();
      session.getContext().addFileContent('test.ts', 'original');

      const checkpointId = session.createCheckpoint('Before changes');

      expect(checkpointId).toMatch(/^cp_\d+_[a-z0-9]+$/);
      expect(session.getCheckpoints()).toHaveLength(1);
    });

    it('can restore from checkpoint', () => {
      const session = createTestSession();
      session.getContext().addFileContent('test.ts', 'original');

      const checkpointId = session.createCheckpoint('Original state');

      // Make changes
      session.getContext().addFileContent('test.ts', 'modified');
      expect(session.getContext().getFileContent('test.ts')).toBe('modified');

      // Restore
      const restored = session.restoreCheckpoint(checkpointId);
      expect(restored).toBe(true);
      expect(session.getContext().getFileContent('test.ts')).toBe('original');
    });
  });

  describe('serialization', () => {
    it('can export to snapshot', () => {
      const session = createTestSession({ name: 'Test', goal: 'Goal' });
      session.getContext().addFileContent('file.ts', 'content');
      session.addNote('A note');

      const snapshot = session.toSnapshot();

      expect(snapshot.metadata.name).toBe('Test');
      expect(snapshot.metadata.goal).toBe('Goal');
      expect(snapshot.context.files['file.ts']).toBe('content');
      expect(snapshot.notes).toContain('A note');
    });

    it('can restore from snapshot', () => {
      const original = createTestSession({ name: 'Original' });
      original.getContext().addFileContent('test.ts', 'content');
      original.addNote('Note');

      const snapshot = original.toSnapshot();
      const restored = ExplorationSession.fromSnapshot(snapshot);

      expect(restored.getId()).toBe(original.getId());
      expect(restored.getMetadata().name).toBe('Original');
      expect(restored.getContext().getFileContent('test.ts')).toBe('content');
      expect(restored.getNotes()).toContain('Note');
    });
  });
});

describe('SessionRegistry', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = createSessionRegistry({ autoCleanup: false });
  });

  afterEach(() => {
    registry.destroy();
  });

  describe('session creation', () => {
    it('creates sessions with unique IDs', () => {
      const session1 = registry.createSession();
      const session2 = registry.createSession();

      expect(session1.getId()).not.toBe(session2.getId());
    });

    it('tracks created sessions', () => {
      registry.createSession({ name: 'Session 1' });
      registry.createSession({ name: 'Session 2' });

      expect(registry.getSessionCount()).toBe(2);
    });

    it('enforces max session limit', () => {
      const smallRegistry = createSessionRegistry({
        maxSessions: 2,
        autoCleanup: false,
      });

      smallRegistry.createSession();
      smallRegistry.createSession();

      expect(() => smallRegistry.createSession()).toThrow(/Maximum sessions/);

      smallRegistry.destroy();
    });
  });

  describe('session retrieval', () => {
    it('can get session by ID', () => {
      const created = registry.createSession({ name: 'Test' });
      const retrieved = registry.getSession(created.getId());

      expect(retrieved).toBe(created);
    });

    it('returns undefined for unknown ID', () => {
      const retrieved = registry.getSession('unknown_id');
      expect(retrieved).toBeUndefined();
    });

    it('can check if session exists', () => {
      const session = registry.createSession();

      expect(registry.hasSession(session.getId())).toBe(true);
      expect(registry.hasSession('unknown')).toBe(false);
    });

    it('can list all sessions', () => {
      registry.createSession({ name: 'A' });
      registry.createSession({ name: 'B' });

      const list = registry.listSessions();
      expect(list).toHaveLength(2);
      expect(list.map(m => m.name)).toContain('A');
      expect(list.map(m => m.name)).toContain('B');
    });

    it('can get most recent session', () => {
      const session1 = registry.createSession({ name: 'First' });
      const session2 = registry.createSession({ name: 'Second' });

      // Touch session1 to make it most recent
      session1.getContext().addFileContent('test.ts', 'content');

      const mostRecent = registry.getMostRecent();
      expect(mostRecent?.getId()).toBe(session1.getId());
    });
  });

  describe('session isolation in registry', () => {
    it('sessions from same registry are isolated', () => {
      const session1 = registry.createSession();
      const session2 = registry.createSession();

      session1.getContext().addFileContent('file1.ts', 'content1');
      session2.getContext().addFileContent('file2.ts', 'content2');

      expect(session1.getContext().hasFile('file1.ts')).toBe(true);
      expect(session1.getContext().hasFile('file2.ts')).toBe(false);

      expect(session2.getContext().hasFile('file2.ts')).toBe(true);
      expect(session2.getContext().hasFile('file1.ts')).toBe(false);
    });
  });

  describe('session lifecycle', () => {
    it('can complete session', () => {
      const session = registry.createSession();
      registry.completeSession(session.getId());

      expect(session.getStatus()).toBe('completed');
    });

    it('can abandon session', () => {
      const session = registry.createSession();
      registry.abandonSession(session.getId());

      expect(session.getStatus()).toBe('abandoned');
    });

    it('can remove session', () => {
      const session = registry.createSession();
      const id = session.getId();

      expect(registry.hasSession(id)).toBe(true);

      registry.removeSession(id);

      expect(registry.hasSession(id)).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('cleans up completed sessions', () => {
      const session1 = registry.createSession();
      const session2 = registry.createSession();

      session1.complete();

      const cleaned = registry.cleanupInactiveSessions();

      expect(cleaned).toBe(1);
      expect(registry.hasSession(session1.getId())).toBe(false);
      expect(registry.hasSession(session2.getId())).toBe(true);
    });

    it('cleans up abandoned sessions', () => {
      const session = registry.createSession();
      session.abandon();

      registry.cleanupInactiveSessions();

      expect(registry.hasSession(session.getId())).toBe(false);
    });
  });

  describe('persistence', () => {
    it('can export all sessions', () => {
      registry.createSession({ name: 'A' });
      registry.createSession({ name: 'B' });

      const exported = registry.exportAll();

      expect(exported).toHaveLength(2);
    });

    it('can import sessions', () => {
      const session = registry.createSession({ name: 'Original' });
      session.getContext().addFileContent('test.ts', 'content');

      const exported = registry.exportAll();

      const newRegistry = createSessionRegistry({ autoCleanup: false });
      const imported = newRegistry.importAll(exported);

      expect(imported).toBe(1);
      expect(newRegistry.getSessionCount()).toBe(1);

      const importedSession = newRegistry.getSession(session.getId());
      expect(importedSession?.getMetadata().name).toBe('Original');

      newRegistry.destroy();
    });
  });
});

describe('Global Registry', () => {
  afterEach(() => {
    // Clean up global registry
    const registry = getGlobalRegistry();
    registry.clearAll();
  });

  it('provides singleton registry', () => {
    const registry1 = getGlobalRegistry();
    const registry2 = getGlobalRegistry();

    expect(registry1).toBe(registry2);
  });

  it('can create sessions via global function', () => {
    const session = createGlobalSession({ name: 'Global Test' });

    expect(session.getMetadata().name).toBe('Global Test');
    expect(getGlobalRegistry().hasSession(session.getId())).toBe(true);
  });

  it('can retrieve sessions via global function', () => {
    const created = createGlobalSession();
    const retrieved = getGlobalSession(created.getId());

    expect(retrieved).toBe(created);
  });
});

// =============================================================================
// Feature #58 Verification Tests
// =============================================================================

describe('Feature #58 verification: Each plan session has unique ID and isolated context', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = createSessionRegistry({ autoCleanup: false });
  });

  afterEach(() => {
    registry.destroy();
  });

  describe('each plan session has unique ID', () => {
    it('generates unique ID for every session', () => {
      const sessions: ExplorationSession[] = [];

      // Create many sessions
      for (let i = 0; i < 50; i++) {
        sessions.push(createExplorationSession());
      }

      // Collect all IDs
      const ids = sessions.map(s => s.getId());
      const uniqueIds = new Set(ids);

      // All IDs must be unique
      expect(uniqueIds.size).toBe(50);
    });

    it('session ID follows consistent format', () => {
      const session = createExplorationSession();
      const id = session.getId();

      // Format: es_<timestamp>_<random>
      expect(id).toMatch(/^es_\d+_[a-z0-9]+$/);

      // ID parts
      const parts = id.split('_');
      expect(parts[0]).toBe('es'); // prefix
      expect(parseInt(parts[1])).toBeGreaterThan(0); // timestamp
      expect(parts[2].length).toBeGreaterThan(5); // random component
    });

    it('session ID is immutable', () => {
      const session = createExplorationSession();
      const originalId = session.getId();

      // Perform various operations
      session.getContext().addFileContent('test.ts', 'content');
      session.pause();
      session.resume();
      session.createCheckpoint('test');

      // ID should remain the same
      expect(session.getId()).toBe(originalId);
    });

    it('session ID persists through serialization', () => {
      const original = createExplorationSession();
      const originalId = original.getId();

      const snapshot = original.toSnapshot();
      const restored = ExplorationSession.fromSnapshot(snapshot);

      expect(restored.getId()).toBe(originalId);
    });
  });

  describe('isolated context per session', () => {
    it('file reads are isolated between sessions', () => {
      const session1 = registry.createSession({ name: 'Session 1' });
      const session2 = registry.createSession({ name: 'Session 2' });

      // Add file to session 1
      session1.getContext().addFileContent('src/auth.ts', 'auth code');

      // Session 1 has the file
      expect(session1.getContext().hasFile('src/auth.ts')).toBe(true);
      expect(session1.getContext().getFileContent('src/auth.ts')).toBe('auth code');

      // Session 2 does NOT have the file (isolated)
      expect(session2.getContext().hasFile('src/auth.ts')).toBe(false);
      expect(session2.getContext().getFileContent('src/auth.ts')).toBeUndefined();
    });

    it('search results are isolated between sessions', () => {
      const session1 = registry.createSession();
      const session2 = registry.createSession();

      // Add search results to session 1
      session1.getContext().addSearchResults('findAuth', [
        { file: 'auth.ts', line: 10 },
      ]);

      // Session 1 has results
      expect(session1.getContext().getSearchResults('findAuth')).toBeDefined();

      // Session 2 does NOT have results (isolated)
      expect(session2.getContext().getSearchResults('findAuth')).toBeUndefined();
    });

    it('user preferences are isolated between sessions', () => {
      const session1 = registry.createSession();
      const session2 = registry.createSession();

      // Add preference to session 1
      session1.getContext().addUserInput('theme', 'dark');

      // Export contexts
      const context1 = session1.toAgentContext();
      const context2 = session2.toAgentContext();

      // Only session 1 has the preference
      expect(context1.userPreferences['theme']).toBe('dark');
      expect(context2.userPreferences['theme']).toBeUndefined();
    });

    it('iterations are isolated between sessions', () => {
      const session1 = registry.createSession();
      const session2 = registry.createSession();

      // Advance iterations in session 1
      session1.getContext().startIteration();
      session1.getContext().startIteration();
      session1.getContext().startIteration();

      // Session 1 is at iteration 3
      expect(session1.getContext().getCurrentIteration()).toBe(3);

      // Session 2 is still at iteration 0 (isolated)
      expect(session2.getContext().getCurrentIteration()).toBe(0);
    });

    it('modifications do not cross-pollinate', () => {
      const session1 = registry.createSession();
      const session2 = registry.createSession();

      // Both sessions work on "same" file
      session1.getContext().addFileContent('config.ts', 'version1');
      session2.getContext().addFileContent('config.ts', 'version2');

      // Each has their own version
      expect(session1.getContext().getFileContent('config.ts')).toBe('version1');
      expect(session2.getContext().getFileContent('config.ts')).toBe('version2');

      // Modify session 1's version
      session1.getContext().addFileContent('config.ts', 'version1-modified');

      // Session 2 is unaffected
      expect(session2.getContext().getFileContent('config.ts')).toBe('version2');
    });

    it('Odoo context is isolated between sessions', () => {
      const session1 = registry.createSession();
      const session2 = registry.createSession();

      session1.getContext().updateOdooContext({ version: '16.0' });
      session2.getContext().updateOdooContext({ version: '17.0' });

      const ctx1 = session1.toAgentContext();
      const ctx2 = session2.toAgentContext();

      expect(ctx1.odooContext.version).toBe('16.0');
      expect(ctx2.odooContext.version).toBe('17.0');
    });

    it('design tokens are isolated between sessions', () => {
      const session1 = registry.createSession();
      const session2 = registry.createSession();

      session1.getContext().updateDesignTokens({ primaryColor: '#ff0000' });
      session2.getContext().updateDesignTokens({ primaryColor: '#00ff00' });

      const ctx1 = session1.toAgentContext();
      const ctx2 = session2.toAgentContext();

      expect(ctx1.designTokens?.['primaryColor']).toBe('#ff0000');
      expect(ctx2.designTokens?.['primaryColor']).toBe('#00ff00');
    });
  });

  describe('complete verification scenario', () => {
    it('demonstrates full session isolation for concurrent explorations', () => {
      // Create two exploration sessions for different features
      const headerSession = registry.createSession({
        name: 'Header Redesign',
        goal: 'Explore header component options',
      });

      const footerSession = registry.createSession({
        name: 'Footer Implementation',
        goal: 'Implement new footer design',
      });

      // Verify unique IDs
      expect(headerSession.getId()).not.toBe(footerSession.getId());

      // Header session explores header files
      headerSession.getContext().addFileContent(
        'components/Header.tsx',
        'export function Header() { return <header>Old Header</header>; }'
      );
      headerSession.getContext().addSearchResults('header styles', [
        { file: 'styles/header.css', line: 1 },
      ]);

      // Footer session explores footer files
      footerSession.getContext().addFileContent(
        'components/Footer.tsx',
        'export function Footer() { return <footer>Footer</footer>; }'
      );
      footerSession.getContext().addSearchResults('footer links', [
        { file: 'config/footerLinks.ts', line: 5 },
      ]);

      // Header session should ONLY have header-related context
      expect(headerSession.getContext().hasFile('components/Header.tsx')).toBe(true);
      expect(headerSession.getContext().hasFile('components/Footer.tsx')).toBe(false);
      expect(headerSession.getContext().getSearchResults('header styles')).toBeDefined();
      expect(headerSession.getContext().getSearchResults('footer links')).toBeUndefined();

      // Footer session should ONLY have footer-related context
      expect(footerSession.getContext().hasFile('components/Footer.tsx')).toBe(true);
      expect(footerSession.getContext().hasFile('components/Header.tsx')).toBe(false);
      expect(footerSession.getContext().getSearchResults('footer links')).toBeDefined();
      expect(footerSession.getContext().getSearchResults('header styles')).toBeUndefined();

      // Completing one session doesn't affect the other
      headerSession.complete();
      expect(footerSession.isActive()).toBe(true);
      expect(footerSession.getContext().hasFile('components/Footer.tsx')).toBe(true);
    });
  });
});

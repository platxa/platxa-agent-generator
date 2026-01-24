/**
 * Deployment Features Comprehensive Tests
 * Tests export, git, assets, and Odoo connection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportTheme,
  validateBeforeExport,
  exportAsJson,
  type ExportOptions,
} from '../lib/export';
import {
  GitService,
  InMemoryGitRepo,
  generateCommitMessage,
  parseCommitMessage,
  formatCommit,
} from '../lib/git';
import {
  AssetManager,
  optimizeImage,
  generatePlaceholder,
} from '../lib/assets';
import {
  OdooClient,
  OdooDeploymentService,
  validateOdooUrl,
  formatOdooVersion,
  isVersionSupported,
  getInstallInstructions,
  createEnvTokenProvider,
} from '../lib/odoo-connect';

// =============================================================================
// EXPORT TESTS
// =============================================================================

describe('Export System', () => {
  const mockFiles = [
    { path: 'theme_test/__manifest__.py', content: "{'name': 'Test'}", type: 'py' as const },
    { path: 'theme_test/static/src/scss/style.scss', content: '$color: red;', type: 'scss' as const },
    { path: 'theme_test/views/template.xml', content: '<odoo></odoo>', type: 'xml' as const },
  ];

  describe('validateBeforeExport', () => {
    it('should validate files before export', () => {
      const result = validateBeforeExport(mockFiles);
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return validation errors and warnings', () => {
      const result = validateBeforeExport(mockFiles);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('exportTheme', () => {
    it('should export theme as ZIP blob', async () => {
      const options: ExportOptions = {
        themeName: 'theme_test',
        files: mockFiles,
        includeReadme: true,
        includeGitignore: true,
      };

      const result = await exportTheme(options);
      expect(result.success).toBe(true);
      expect(result.blob).toBeDefined();
      expect(result.blob instanceof Blob).toBe(true);
    });

    it('should include README when requested', async () => {
      const options: ExportOptions = {
        themeName: 'theme_test',
        files: mockFiles,
        includeReadme: true,
      };

      const result = await exportTheme(options);
      expect(result.success).toBe(true);
      expect(result.stats?.fileCount).toBeGreaterThan(mockFiles.length);
    });

    it('should return export statistics', async () => {
      const options: ExportOptions = {
        themeName: 'theme_test',
        files: mockFiles,
      };

      const result = await exportTheme(options);
      expect(result.stats).toBeDefined();
      expect(result.stats?.fileCount).toBeGreaterThan(0);
      expect(result.stats?.totalSize).toBeGreaterThan(0);
    });

    it('should validate theme name', async () => {
      const options: ExportOptions = {
        themeName: 'invalid name with spaces!',
        files: mockFiles,
      };

      const result = await exportTheme(options);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('exportAsJson', () => {
    it('should export as JSON structure', () => {
      const result = exportAsJson('theme_test', mockFiles);
      expect(result.themeName).toBe('theme_test');
      expect(result.files).toBeDefined();
      expect(result.files.length).toBe(mockFiles.length);
    });

    it('should include metadata', () => {
      const result = exportAsJson('theme_test', mockFiles);
      expect(result.exportedAt).toBeDefined();
      expect(result.version).toBeDefined();
    });
  });
});

// =============================================================================
// GIT INTEGRATION TESTS
// =============================================================================

describe('Git Integration', () => {
  describe('InMemoryGitRepo', () => {
    let repo: InMemoryGitRepo;

    beforeEach(() => {
      repo = new InMemoryGitRepo({
        authorName: 'Test User',
        authorEmail: 'test@example.com',
      });
    });

    it('should initialize with default branch', () => {
      const branches = repo.listBranches();
      expect(branches.length).toBe(1);
      expect(branches[0].name).toBe('main');
      expect(branches[0].current).toBe(true);
    });

    it('should initialize repository with files', () => {
      const files = [
        { path: 'file1.txt', content: 'content1', type: 'xml' as const },
        { path: 'file2.txt', content: 'content2', type: 'xml' as const },
      ];

      const result = repo.init(files);
      expect(result.success).toBe(true);
      expect(result.data?.fileCount).toBe(2);
    });

    it('should create commits', () => {
      repo.init([{ path: 'file.txt', content: 'content', type: 'xml' as const }]);
      repo.updateFile('file.txt', 'new content');
      repo.add(['file.txt']);

      const result = repo.commit('Update file');
      expect(result.success).toBe(true);
      expect(result.data?.commit).toBeDefined();
    });

    it('should track commit history', () => {
      repo.init([{ path: 'file.txt', content: 'content', type: 'xml' as const }]);

      const history = repo.log();
      expect(history.length).toBe(1);
      expect(history[0].message).toContain('Initial commit');
    });

    it('should create and switch branches', () => {
      repo.init([{ path: 'file.txt', content: 'content', type: 'xml' as const }]);

      const branchResult = repo.branch('feature', true);
      expect(branchResult.success).toBe(true);

      const branches = repo.listBranches();
      const featureBranch = branches.find((b) => b.name === 'feature');
      expect(featureBranch?.current).toBe(true);
    });

    it('should report correct status', () => {
      repo.init([{ path: 'file.txt', content: 'content', type: 'xml' as const }]);

      const status = repo.status();
      expect(status.branch).toBe('main');
      expect(status.clean).toBe(true);
    });

    it('should export and import state', () => {
      repo.init([{ path: 'file.txt', content: 'content', type: 'xml' as const }]);
      repo.branch('develop');

      const exported = repo.export();
      expect(exported.commits.length).toBe(1);
      expect(Object.keys(exported.branches).length).toBe(2);

      const newRepo = new InMemoryGitRepo();
      newRepo.import(exported);

      const branches = newRepo.listBranches();
      expect(branches.length).toBe(2);
    });
  });

  describe('GitService', () => {
    let service: GitService;

    beforeEach(() => {
      service = new GitService({ authorName: 'Test' });
    });

    it('should initialize repository', () => {
      const files = [{ path: 'test.xml', content: '<xml/>', type: 'xml' as const }];
      const result = service.initRepository(files);
      expect(result.success).toBe(true);
    });

    it('should save changes with commit', () => {
      service.initRepository([{ path: 'test.xml', content: '<xml/>', type: 'xml' as const }]);

      const result = service.saveChanges(
        [{ path: 'test.xml', content: '<xml>updated</xml>', type: 'xml' as const }],
        'feat: update xml'
      );

      expect(result.success).toBe(true);
    });

    it('should get commit history', () => {
      service.initRepository([{ path: 'test.xml', content: '<xml/>', type: 'xml' as const }]);
      const history = service.getHistory();
      expect(history.length).toBe(1);
    });
  });

  describe('Commit Message Helpers', () => {
    it('should generate conventional commit message', () => {
      const message = generateCommitMessage('feat', 'theme', 'add dark mode');
      expect(message).toBe('feat(theme): add dark mode');
    });

    it('should parse conventional commit message', () => {
      const parsed = parseCommitMessage('fix(header): resolve sticky issue');
      expect(parsed.type).toBe('fix');
      expect(parsed.scope).toBe('header');
      expect(parsed.description).toBe('resolve sticky issue');
    });

    it('should handle non-conventional messages', () => {
      const parsed = parseCommitMessage('Simple commit message');
      expect(parsed.type).toBeUndefined();
      expect(parsed.description).toBe('Simple commit message');
    });

    it('should format commit for display', () => {
      const commit = {
        hash: 'abc123def456',
        shortHash: 'abc123d',
        message: 'Test commit',
        author: 'Test User',
        email: 'test@example.com',
        timestamp: new Date('2024-01-15'),
        files: ['file.txt'],
      };

      const formatted = formatCommit(commit);
      expect(formatted).toContain('abc123d');
      expect(formatted).toContain('Test commit');
      expect(formatted).toContain('Test User');
    });
  });
});

// =============================================================================
// ASSET MANAGEMENT TESTS
// =============================================================================

describe('Asset Management', () => {
  describe('AssetManager', () => {
    let manager: AssetManager;

    beforeEach(() => {
      manager = new AssetManager('theme_test');
    });

    it('should initialize with default folders', () => {
      const tree = manager.getFolderTree();
      expect(tree.length).toBeGreaterThan(0);
    });

    it('should create folders', () => {
      const folder = manager.createFolder('static/src/img/custom');
      expect(folder.name).toBe('custom');
      expect(folder.path).toContain('theme_test');
    });

    it('should upload base64 assets', () => {
      const result = manager.uploadBase64(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'test.png',
        'image/png'
      );

      expect(result.success).toBe(true);
      expect(result.asset).toBeDefined();
      expect(result.asset?.type).toBe('image');
    });

    it('should reject unsupported file types', () => {
      const result = manager.uploadBase64('data', 'file.exe', 'application/x-executable');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    it('should get assets by type', () => {
      manager.uploadBase64('base64data', 'image1.png', 'image/png');
      manager.uploadBase64('base64data', 'image2.jpg', 'image/jpeg');

      const images = manager.getAssetsByType('image');
      expect(images.length).toBe(2);
    });

    it('should search assets', () => {
      manager.uploadBase64('data', 'header-logo.png', 'image/png');
      manager.uploadBase64('data', 'footer-logo.png', 'image/png');

      const results = manager.searchAssets('logo');
      expect(results.length).toBe(2);
    });

    it('should delete assets', () => {
      const result = manager.uploadBase64('data', 'temp.png', 'image/png');
      expect(result.asset).toBeDefined();

      const deleted = manager.deleteAsset(result.asset!.id);
      expect(deleted).toBe(true);

      const asset = manager.getAsset(result.asset!.id);
      expect(asset).toBeUndefined();
    });

    it('should rename assets', () => {
      const result = manager.uploadBase64('data', 'old-name.png', 'image/png');
      expect(result.asset).toBeDefined();

      const renamed = manager.renameAsset(result.asset!.id, 'new-name.png');
      expect(renamed).toBe(true);

      const asset = manager.getAsset(result.asset!.id);
      expect(asset?.name).toBe('new-name.png');
    });

    it('should add tags to assets', () => {
      const result = manager.uploadBase64('data', 'hero.png', 'image/png');
      expect(result.asset).toBeDefined();

      manager.addTags(result.asset!.id, ['hero', 'banner', 'homepage']);

      const asset = manager.getAsset(result.asset!.id);
      expect(asset?.tags).toContain('hero');
      expect(asset?.tags).toContain('banner');
    });

    it('should get storage statistics', () => {
      manager.uploadBase64('a'.repeat(1000), 'file1.png', 'image/png');
      manager.uploadBase64('b'.repeat(2000), 'file2.png', 'image/png');

      const stats = manager.getStats();
      expect(stats.totalAssets).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.byType.image).toBeDefined();
    });

    it('should export for theme generation', () => {
      manager.uploadBase64('base64content', 'logo.png', 'image/png');

      const exports = manager.exportForTheme();
      expect(exports.length).toBeGreaterThan(0);
    });
  });

  describe('Image Utilities', () => {
    it('should generate placeholder images', () => {
      const placeholder = generatePlaceholder(300, 200, 'Test');
      expect(placeholder).toContain('data:image/svg+xml;base64,');
    });

    it('should use default text if not provided', () => {
      const placeholder = generatePlaceholder(400, 300);
      expect(placeholder).toContain('data:image/svg+xml;base64,');
    });

    it('should accept custom colors', () => {
      const placeholder = generatePlaceholder(100, 100, 'Custom', '#ff0000', '#00ff00');
      expect(placeholder).toBeDefined();
    });
  });
});

// =============================================================================
// ODOO CONNECTION TESTS
// =============================================================================

describe('Odoo Connection', () => {
  describe('URL Validation', () => {
    it('should validate correct URLs', () => {
      expect(validateOdooUrl('https://myodoo.com').valid).toBe(true);
      expect(validateOdooUrl('http://localhost:8069').valid).toBe(true);
      expect(validateOdooUrl('https://odoo.example.com:8069').valid).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateOdooUrl('not-a-url').valid).toBe(false);
      expect(validateOdooUrl('ftp://odoo.com').valid).toBe(false);
      expect(validateOdooUrl('').valid).toBe(false);
    });

    it('should return error message for invalid URLs', () => {
      const result = validateOdooUrl('invalid');
      expect(result.error).toBeDefined();
    });
  });

  describe('Version Formatting', () => {
    it('should format Odoo version', () => {
      expect(formatOdooVersion('17.0.1.0.0')).toBe('Odoo 17.0');
      expect(formatOdooVersion('16.0.2.3.4')).toBe('Odoo 16.0');
    });

    it('should handle non-standard versions', () => {
      expect(formatOdooVersion('custom')).toBe('custom');
    });
  });

  describe('Version Support Check', () => {
    it('should support Odoo 17+', () => {
      expect(isVersionSupported('17.0.1.0.0')).toBe(true);
      expect(isVersionSupported('18.0.0.0.0')).toBe(true);
    });

    it('should not support older versions', () => {
      expect(isVersionSupported('16.0.1.0.0')).toBe(false);
      expect(isVersionSupported('14.0.1.0.0')).toBe(false);
    });
  });

  describe('Install Instructions', () => {
    it('should generate install instructions', () => {
      const instructions = getInstallInstructions('theme_custom');
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions.some((i) => i.includes('theme_custom'))).toBe(true);
    });

    it('should include URL when provided', () => {
      const instructions = getInstallInstructions('theme_custom', 'https://myodoo.com');
      expect(instructions.some((i) => i.includes('myodoo.com'))).toBe(true);
    });
  });

  describe('Token Provider', () => {
    it('should create env token provider', () => {
      const provider = createEnvTokenProvider('ODOO_API_KEY');
      expect(typeof provider).toBe('function');
    });

    it('should throw when env var not set', async () => {
      const provider = createEnvTokenProvider('NONEXISTENT_VAR');
      await expect(provider()).rejects.toThrow();
    });
  });

  describe('OdooClient', () => {
    let client: OdooClient;
    const mockTokenProvider = vi.fn().mockResolvedValue('test-token');

    beforeEach(() => {
      client = new OdooClient(
        {
          url: 'https://test.odoo.com',
          database: 'test_db',
          username: 'admin',
        },
        mockTokenProvider
      );

      vi.mocked(global.fetch).mockReset();
    });

    it('should not be authenticated initially', () => {
      expect(client.isAuthenticated()).toBe(false);
      expect(client.getUid()).toBeNull();
    });

    it('should test connection', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            server_version: '17.0',
            server_version_info: [17, 0, 0, 'final', 0],
            server_serie: '17.0',
            protocol_version: 1,
          },
        }),
        headers: new Headers(),
      } as Response);

      const status = await client.testConnection();
      expect(status.connected).toBe(true);
      expect(status.version).toBe('17.0');
    });

    it('should handle connection errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const status = await client.testConnection();
      expect(status.connected).toBe(false);
      expect(status.error).toBeDefined();
    });

    it('should clear session', () => {
      client.clearSession();
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe('OdooDeploymentService', () => {
    let service: OdooDeploymentService;
    const mockTokenProvider = vi.fn().mockResolvedValue('test-token');

    beforeEach(() => {
      service = new OdooDeploymentService(
        {
          url: 'https://test.odoo.com',
          database: 'test_db',
          username: 'admin',
        },
        mockTokenProvider
      );
    });

    it('should expose client', () => {
      const client = service.getClient();
      expect(client).toBeDefined();
    });

    it('should disconnect and clear session', () => {
      service.disconnect();
      expect(service.getClient().isAuthenticated()).toBe(false);
    });
  });
});

/**
 * Tests for test-odoo tool
 * Feature #26: Docker-based module installation and snippet testing
 */

import { describe, it, expect, vi } from 'vitest';
import {
  testOdooTool,
  testOdooImpl,
  isDockerAvailable,
  checkDockerImages,
  generateTestCommands,
  type TestOdooOptions,
  type CommandExecutor,
  type HttpFetcher,
} from '@/lib/agentic-core/tools/test-odoo';
import {
  generateDockerCommands,
  DEFAULT_DOCKER_CONFIG,
} from '@/lib/agent-bridge/odoo-docker-tester';
import type { AgentContext } from '@/lib/agentic-core/agent-engine';

// ============================================================================
// Test Fixtures - Injectable mock executors (no module mocking needed)
// ============================================================================

/** Mock executor that simulates Docker not being available */
const mockDockerUnavailable: CommandExecutor = async (cmd: string) => ({
  stdout: '',
  stderr: 'Cannot connect to the Docker daemon',
  exitCode: 1,
});

/** Mock executor that simulates Docker being available */
const mockDockerAvailable: CommandExecutor = async (cmd: string) => {
  if (cmd.includes('docker info')) {
    return { stdout: 'Docker version 24.0.0', stderr: '', exitCode: 0 };
  }
  if (cmd.includes('docker image inspect')) {
    return { stdout: '[]', stderr: '', exitCode: 0 };
  }
  if (cmd.includes('docker network create')) {
    return { stdout: 'network_id', stderr: '', exitCode: 0 };
  }
  if (cmd.includes('docker run')) {
    return { stdout: 'container_id', stderr: '', exitCode: 0 };
  }
  if (cmd.includes('pg_isready')) {
    return { stdout: 'accepting connections', stderr: '', exitCode: 0 };
  }
  if (cmd.includes('odoo -d')) {
    return { stdout: 'Module installed successfully', stderr: '', exitCode: 0 };
  }
  if (cmd.includes('docker stop') || cmd.includes('docker rm') || cmd.includes('docker network rm')) {
    return { stdout: '', stderr: '', exitCode: 0 };
  }
  return { stdout: '', stderr: '', exitCode: 0 };
};

/** Mock HTTP fetcher that simulates successful page renders */
const mockSuccessfulFetch: HttpFetcher = async (url: string) => ({
  status: 200,
  body: '<html><body class="o_website"><section class="s_banner">Theme content</section></body></html>',
});

/** Mock HTTP fetcher that simulates render errors */
const mockErrorFetch: HttpFetcher = async (url: string) => ({
  status: 500,
  body: '<html>Internal Server Error - Traceback</html>',
});

describe('test-odoo tool', () => {
  const mockContext: AgentContext = {
    workspaceRoot: '/test/workspace',
    goal: 'Test theme installation',
    iteration: 1,
    maxIterations: 5,
    planMode: false,
  };

  describe('generateTestCommands', () => {
    it('generates Docker setup commands', () => {
      const options: TestOdooOptions = {
        moduleName: 'theme_test',
        themePath: '/path/to/theme',
      };

      const commands = generateTestCommands(options);

      expect(commands.setup).toHaveLength(4);
      expect(commands.setup[0]).toContain('docker network create');
      expect(commands.setup[1]).toContain('docker run');
      expect(commands.setup[1]).toContain('postgres');
      expect(commands.setup[3]).toContain('odoo');
      expect(commands.setup[3]).toContain('/path/to/theme');
    });

    it('generates install command with module name', () => {
      const options: TestOdooOptions = {
        moduleName: 'theme_platxa',
        themePath: '/workspace/theme',
      };

      const commands = generateTestCommands(options);

      expect(commands.install).toContain('theme_platxa');
      expect(commands.install).toContain('-i');
      expect(commands.install).toContain('--stop-after-init');
    });

    it('generates teardown commands', () => {
      const options: TestOdooOptions = {
        moduleName: 'theme_test',
        themePath: '/path/to/theme',
      };

      const commands = generateTestCommands(options);

      expect(commands.teardown).toHaveLength(3);
      expect(commands.teardown[0]).toContain('docker stop');
      expect(commands.teardown[1]).toContain('docker rm');
      expect(commands.teardown[2]).toContain('docker network rm');
    });

    it('respects custom Docker config', () => {
      const options: TestOdooOptions = {
        moduleName: 'theme_test',
        themePath: '/path/to/theme',
        dockerConfig: {
          port: 9069,
          database: 'custom_db',
          image: 'odoo:17.0',
        },
      };

      const commands = generateTestCommands(options);

      expect(commands.setup[3]).toContain('9069:8069');
      expect(commands.install).toContain('custom_db');
      expect(commands.setup[3]).toContain('odoo:17.0');
    });
  });

  describe('isDockerAvailable', () => {
    it('returns true when Docker is available', async () => {
      const result = await isDockerAvailable(mockDockerAvailable);
      expect(result).toBe(true);
    });

    it('returns false when Docker is unavailable', async () => {
      const result = await isDockerAvailable(mockDockerUnavailable);
      expect(result).toBe(false);
    });
  });

  describe('checkDockerImages', () => {
    it('checks for required Docker images', async () => {
      const result = await checkDockerImages({}, mockDockerAvailable);
      expect(result.available).toBe(true);
      expect(result.odooImage).toBe(true);
      expect(result.postgresImage).toBe(true);
    });

    it('reports missing images', async () => {
      const mockMissingImages: CommandExecutor = async (cmd: string) => ({
        stdout: '',
        stderr: 'No such image',
        exitCode: 1,
      });

      const result = await checkDockerImages({}, mockMissingImages);
      expect(result.available).toBe(false);
      expect(result.odooImage).toBe(false);
      expect(result.postgresImage).toBe(false);
    });
  });

  describe('testOdooImpl', () => {
    it('returns graceful degradation when Docker unavailable', async () => {
      const options: TestOdooOptions = {
        moduleName: 'theme_test',
        themePath: '/path/to/theme',
        exec: mockDockerUnavailable,
        fetch: mockSuccessfulFetch,
      };

      const result = await testOdooImpl(options);

      expect(result.success).toBe(true);
      expect(result.moduleInstalled).toBe(false);
      expect(result.snippetsRendered).toBe(false);
      expect(result.summary).toContain('Docker not available');
    });

    it('includes Docker check step when unavailable', async () => {
      const options: TestOdooOptions = {
        moduleName: 'theme_test',
        themePath: '/path/to/theme',
        exec: mockDockerUnavailable,
        fetch: mockSuccessfulFetch,
      };

      const result = await testOdooImpl(options);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].name).toBe('Docker check');
      expect(result.steps[0].passed).toBe(false);
      expect(result.steps[0].error).toContain('Docker');
    });

    it('runs full test when Docker is available', async () => {
      const options: TestOdooOptions = {
        moduleName: 'theme_test',
        themePath: '/path/to/theme',
        exec: mockDockerAvailable,
        fetch: mockSuccessfulFetch,
      };

      const result = await testOdooImpl(options);

      expect(result.success).toBe(true);
      expect(result.moduleInstalled).toBe(true);
      expect(result.steps.length).toBeGreaterThan(1);
    });

    it('tracks onStep callbacks', async () => {
      const steps: string[] = [];
      const options: TestOdooOptions = {
        moduleName: 'theme_test',
        themePath: '/path/to/theme',
        exec: mockDockerAvailable,
        fetch: mockSuccessfulFetch,
        onStep: (step) => steps.push(step.name),
      };

      await testOdooImpl(options);

      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe('testOdooTool', () => {
    it('returns successful result with graceful degradation', async () => {
      const result = await testOdooTool({
        target: '/workspace/theme',
        context: mockContext,
        options: {
          moduleName: 'theme_platxa',
          exec: mockDockerUnavailable,
          fetch: mockSuccessfulFetch,
        },
      });

      expect(result.success).toBe(true);
      expect(result.toolName).toBe('test_odoo');
      expect(result.data).toBeDefined();
    });

    it('uses target as theme path', async () => {
      const result = await testOdooTool({
        target: '/custom/theme/path',
        context: mockContext,
        options: {
          moduleName: 'theme_custom',
          exec: mockDockerUnavailable,
          fetch: mockSuccessfulFetch,
        },
      });

      expect(result.success).toBe(true);
    });

    it('passes custom options through', async () => {
      const result = await testOdooTool({
        target: '/workspace/theme',
        context: mockContext,
        options: {
          moduleName: 'theme_test',
          checkUrls: ['/shop', '/blog'],
          dockerConfig: {
            port: 9069,
          },
          exec: mockDockerUnavailable,
          fetch: mockSuccessfulFetch,
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('DEFAULT_DOCKER_CONFIG', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_DOCKER_CONFIG.image).toBe('odoo:16.0');
      expect(DEFAULT_DOCKER_CONFIG.postgresImage).toBe('postgres:15');
      expect(DEFAULT_DOCKER_CONFIG.port).toBe(8069);
      expect(DEFAULT_DOCKER_CONFIG.database).toBe('test_theme');
      expect(DEFAULT_DOCKER_CONFIG.themeMountPath).toBe('/mnt/extra-addons');
      expect(DEFAULT_DOCKER_CONFIG.timeoutMs).toBe(120000);
    });
  });

  describe('Feature #26 verification', () => {
    it('tool installs theme on Docker Odoo and verifies module loads and snippets render', async () => {
      // Use injectable mocks to verify full flow
      const result = await testOdooImpl({
        moduleName: 'theme_platxa',
        themePath: '/workspace/theme',
        exec: mockDockerAvailable,
        fetch: mockSuccessfulFetch,
      });

      // Verify module installation
      expect(result.moduleInstalled).toBe(true);

      // Verify snippet rendering
      expect(result.snippetsRendered).toBe(true);

      // Verify render checks include theme elements
      expect(result.renderChecks.some(r => r.themeElementsFound)).toBe(true);

      // Verify all steps completed
      expect(result.steps.some(s => s.name === 'Install theme module')).toBe(true);
    });

    it('detects render errors and reports them', async () => {
      const result = await testOdooImpl({
        moduleName: 'theme_platxa',
        themePath: '/workspace/theme',
        exec: mockDockerAvailable,
        fetch: mockErrorFetch,
      });

      // Should fail due to render errors
      expect(result.success).toBe(false);

      // Should report render errors
      expect(result.renderChecks.some(r => !r.noErrors)).toBe(true);
    });

    it('generates proper Docker commands for theme installation', () => {
      const commands = generateTestCommands({
        moduleName: 'theme_platxa',
        themePath: '/workspace/theme_platxa',
        checkUrls: ['/', '/shop'],
      });

      // Verify setup includes PostgreSQL and Odoo containers
      expect(commands.setup.some(c => c.includes('postgres'))).toBe(true);
      expect(commands.setup.some(c => c.includes('odoo'))).toBe(true);

      // Verify install command installs the theme module
      expect(commands.install).toContain('theme_platxa');
      expect(commands.install).toContain('-i');

      // Verify theme path is mounted
      expect(commands.setup.some(c => c.includes('/workspace/theme_platxa'))).toBe(true);

      // Verify cleanup commands exist
      expect(commands.teardown.some(c => c.includes('docker stop'))).toBe(true);
      expect(commands.teardown.some(c => c.includes('docker rm'))).toBe(true);
    });
  });
});

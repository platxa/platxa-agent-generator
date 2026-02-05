/**
 * GitHub Repository Initialization
 *
 * Create and initialize new GitHub repositories for projects
 * without existing repos, with initial commit and setup.
 */

// ============================================================================
// Types
// ============================================================================

export interface GitHubCredentials {
  token: string;
  username?: string;
}

export interface RepoConfig {
  name: string;
  description?: string;
  private: boolean;
  autoInit: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
  homepage?: string;
  hasIssues?: boolean;
  hasProjects?: boolean;
  hasWiki?: boolean;
  hasDiscussions?: boolean;
  teamId?: number;
  isTemplate?: boolean;
  allowSquashMerge?: boolean;
  allowMergeCommit?: boolean;
  allowRebaseMerge?: boolean;
  deleteBranchOnMerge?: boolean;
}

export interface InitialCommit {
  message: string;
  files: CommitFile[];
  branch?: string;
}

export interface CommitFile {
  path: string;
  content: string;
  mode?: '100644' | '100755' | '040000' | '160000' | '120000';
}

export interface RepoInitResult {
  success: boolean;
  repoUrl?: string;
  cloneUrl?: string;
  sshUrl?: string;
  defaultBranch?: string;
  initialCommitSha?: string;
  error?: string;
}

export interface RepoTemplate {
  id: string;
  name: string;
  description: string;
  files: CommitFile[];
  gitignore?: string;
  license?: string;
}

export interface BranchProtection {
  pattern: string;
  requiredReviews?: number;
  requireCodeOwners?: boolean;
  requireStatusChecks?: string[];
  enforceAdmins?: boolean;
  allowForcePushes?: boolean;
  allowDeletions?: boolean;
}

// ============================================================================
// GitHub API Client
// ============================================================================

export class GitHubRepoInitializer {
  private credentials: GitHubCredentials;
  private apiBase = 'https://api.github.com';

  constructor(credentials: GitHubCredentials) {
    this.credentials = credentials;
  }

  /**
   * Create a new GitHub repository
   */
  async createRepository(config: RepoConfig, org?: string): Promise<RepoInitResult> {
    try {
      const endpoint = org ? `/orgs/${org}/repos` : '/user/repos';

      const response = await this.apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          name: config.name,
          description: config.description,
          private: config.private,
          auto_init: config.autoInit,
          gitignore_template: config.gitignoreTemplate,
          license_template: config.licenseTemplate,
          homepage: config.homepage,
          has_issues: config.hasIssues ?? true,
          has_projects: config.hasProjects ?? true,
          has_wiki: config.hasWiki ?? true,
          has_discussions: config.hasDiscussions ?? false,
          team_id: config.teamId,
          is_template: config.isTemplate ?? false,
          allow_squash_merge: config.allowSquashMerge ?? true,
          allow_merge_commit: config.allowMergeCommit ?? true,
          allow_rebase_merge: config.allowRebaseMerge ?? true,
          delete_branch_on_merge: config.deleteBranchOnMerge ?? false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || `Failed to create repository: ${response.status}`,
        };
      }

      const repo = await response.json();

      return {
        success: true,
        repoUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        defaultBranch: repo.default_branch,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating repository',
      };
    }
  }

  /**
   * Initialize repository with initial commit
   */
  async initializeWithCommit(
    owner: string,
    repo: string,
    commit: InitialCommit
  ): Promise<RepoInitResult> {
    try {
      const branch = commit.branch || 'main';

      // Get or create the branch reference
      let baseSha: string | null = null;

      try {
        const refResponse = await this.apiRequest(`/repos/${owner}/${repo}/git/refs/heads/${branch}`);
        if (refResponse.ok) {
          const ref = await refResponse.json();
          baseSha = ref.object.sha;
        }
      } catch {
        // Branch doesn't exist, will create it
      }

      // Create blobs for each file
      const blobs = await Promise.all(
        commit.files.map(async (file) => {
          const blobResponse = await this.apiRequest(`/repos/${owner}/${repo}/git/blobs`, {
            method: 'POST',
            body: JSON.stringify({
              content: Buffer.from(file.content).toString('base64'),
              encoding: 'base64',
            }),
          });

          if (!blobResponse.ok) {
            throw new Error(`Failed to create blob for ${file.path}`);
          }

          const blob = await blobResponse.json();
          return {
            path: file.path,
            mode: file.mode || '100644',
            type: 'blob' as const,
            sha: blob.sha,
          };
        })
      );

      // Create tree
      const treeResponse = await this.apiRequest(`/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseSha,
          tree: blobs,
        }),
      });

      if (!treeResponse.ok) {
        throw new Error('Failed to create tree');
      }

      const tree = await treeResponse.json();

      // Create commit
      const commitBody: Record<string, unknown> = {
        message: commit.message,
        tree: tree.sha,
      };

      if (baseSha) {
        commitBody.parents = [baseSha];
      }

      const commitResponse = await this.apiRequest(`/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        body: JSON.stringify(commitBody),
      });

      if (!commitResponse.ok) {
        throw new Error('Failed to create commit');
      }

      const newCommit = await commitResponse.json();

      // Update or create branch reference
      const refEndpoint = baseSha
        ? `/repos/${owner}/${repo}/git/refs/heads/${branch}`
        : `/repos/${owner}/${repo}/git/refs`;

      const refBody = baseSha
        ? { sha: newCommit.sha, force: false }
        : { ref: `refs/heads/${branch}`, sha: newCommit.sha };

      const refUpdateResponse = await this.apiRequest(refEndpoint, {
        method: baseSha ? 'PATCH' : 'POST',
        body: JSON.stringify(refBody),
      });

      if (!refUpdateResponse.ok) {
        throw new Error('Failed to update branch reference');
      }

      return {
        success: true,
        repoUrl: `https://github.com/${owner}/${repo}`,
        cloneUrl: `https://github.com/${owner}/${repo}.git`,
        sshUrl: `git@github.com:${owner}/${repo}.git`,
        defaultBranch: branch,
        initialCommitSha: newCommit.sha,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error initializing repository',
      };
    }
  }

  /**
   * Create repository and initialize with files in one operation
   */
  async createAndInitialize(
    config: RepoConfig,
    initialFiles: CommitFile[],
    org?: string
  ): Promise<RepoInitResult> {
    // First create the repo without auto_init to have full control
    const createResult = await this.createRepository(
      { ...config, autoInit: false },
      org
    );

    if (!createResult.success) {
      return createResult;
    }

    // Then initialize with our files
    const owner = org || this.credentials.username!;
    const initResult = await this.initializeWithCommit(owner, config.name, {
      message: 'Initial commit from Platxa',
      files: initialFiles,
    });

    if (!initResult.success) {
      // Repo was created but init failed
      return {
        ...createResult,
        error: `Repository created but initialization failed: ${initResult.error}`,
      };
    }

    return {
      ...createResult,
      initialCommitSha: initResult.initialCommitSha,
    };
  }

  /**
   * Set up branch protection rules
   */
  async setupBranchProtection(
    owner: string,
    repo: string,
    branch: string,
    protection: BranchProtection
  ): Promise<boolean> {
    try {
      const response = await this.apiRequest(
        `/repos/${owner}/${repo}/branches/${branch}/protection`,
        {
          method: 'PUT',
          body: JSON.stringify({
            required_status_checks: protection.requireStatusChecks
              ? {
                  strict: true,
                  contexts: protection.requireStatusChecks,
                }
              : null,
            enforce_admins: protection.enforceAdmins ?? false,
            required_pull_request_reviews: protection.requiredReviews
              ? {
                  required_approving_review_count: protection.requiredReviews,
                  require_code_owner_reviews: protection.requireCodeOwners ?? false,
                }
              : null,
            restrictions: null,
            allow_force_pushes: protection.allowForcePushes ?? false,
            allow_deletions: protection.allowDeletions ?? false,
          }),
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Add collaborator to repository
   */
  async addCollaborator(
    owner: string,
    repo: string,
    username: string,
    permission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage' = 'push'
  ): Promise<boolean> {
    try {
      const response = await this.apiRequest(
        `/repos/${owner}/${repo}/collaborators/${username}`,
        {
          method: 'PUT',
          body: JSON.stringify({ permission }),
        }
      );

      return response.ok || response.status === 204;
    } catch {
      return false;
    }
  }

  /**
   * Create webhook for repository
   */
  async createWebhook(
    owner: string,
    repo: string,
    url: string,
    events: string[] = ['push'],
    secret?: string
  ): Promise<{ id: number; url: string } | null> {
    try {
      const response = await this.apiRequest(`/repos/${owner}/${repo}/hooks`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'web',
          active: true,
          events,
          config: {
            url,
            content_type: 'json',
            secret,
            insecure_ssl: '0',
          },
        }),
      });

      if (!response.ok) return null;

      const hook = await response.json();
      return { id: hook.id, url: hook.url };
    } catch {
      return null;
    }
  }

  /**
   * Check if repository name is available
   */
  async isRepoNameAvailable(name: string, org?: string): Promise<boolean> {
    try {
      const owner = org || this.credentials.username;
      const response = await this.apiRequest(`/repos/${owner}/${name}`);
      return response.status === 404;
    } catch {
      return true; // Assume available if error
    }
  }

  /**
   * Get authenticated user info
   */
  async getAuthenticatedUser(): Promise<{ login: string; name: string; email: string } | null> {
    try {
      const response = await this.apiRequest('/user');
      if (!response.ok) return null;

      const user = await response.json();
      return {
        login: user.login,
        name: user.name || user.login,
        email: user.email || `${user.login}@users.noreply.github.com`,
      };
    } catch {
      return null;
    }
  }

  /**
   * List user organizations
   */
  async listOrganizations(): Promise<Array<{ login: string; name: string }>> {
    try {
      const response = await this.apiRequest('/user/orgs');
      if (!response.ok) return [];

      const orgs = await response.json();
      return orgs.map((org: { login: string; name?: string }) => ({
        login: org.login,
        name: org.name || org.login,
      }));
    } catch {
      return [];
    }
  }

  // Private helper for API requests
  private async apiRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiBase}${endpoint}`;

    return fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.credentials.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });
  }
}

// ============================================================================
// Project Templates
// ============================================================================

export const PROJECT_TEMPLATES: Record<string, RepoTemplate> = {
  'odoo-theme': {
    id: 'odoo-theme',
    name: 'Odoo Website Theme',
    description: 'Basic Odoo website theme structure',
    gitignore: 'Python',
    license: 'LGPL-3.0',
    files: [
      {
        path: '__manifest__.py',
        content: `# -*- coding: utf-8 -*-
{
    'name': 'My Theme',
    'version': '1.0.0',
    'category': 'Website/Theme',
    'summary': 'A custom Odoo website theme',
    'description': """
        Custom website theme created with Platxa.
    """,
    'author': 'Platxa',
    'website': 'https://platxa.com',
    'license': 'LGPL-3',
    'depends': ['website'],
    'data': [
        'views/templates.xml',
        'views/snippets.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            '/theme_name/static/src/scss/theme.scss',
            '/theme_name/static/src/js/theme.js',
        ],
    },
    'images': [
        'static/description/banner.png',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
`,
      },
      {
        path: '__init__.py',
        content: '# -*- coding: utf-8 -*-\n',
      },
      {
        path: 'views/templates.xml',
        content: `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Theme templates will be added here -->
</odoo>
`,
      },
      {
        path: 'views/snippets.xml',
        content: `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Theme snippets will be added here -->
</odoo>
`,
      },
      {
        path: 'static/src/scss/theme.scss',
        content: `// Theme Variables
$o-color-primary: #4f46e5;
$o-color-secondary: #6b7280;

// Import Odoo defaults
@import "web.assets_frontend";

// Custom styles
.o_theme_custom {
    // Add custom styles here
}
`,
      },
      {
        path: 'static/src/js/theme.js',
        content: `/** @odoo-module **/

// Theme JavaScript
console.log('Theme loaded');
`,
      },
      {
        path: 'static/description/icon.png',
        content: '', // Would be actual image data
      },
      {
        path: 'README.md',
        content: `# My Odoo Theme

Custom website theme created with Platxa.

## Installation

1. Copy this module to your Odoo addons directory
2. Update the app list
3. Install the theme from Website settings

## Features

- Modern responsive design
- Custom snippets
- Configurable colors

## License

LGPL-3.0
`,
      },
    ],
  },

  'nextjs-app': {
    id: 'nextjs-app',
    name: 'Next.js Application',
    description: 'Next.js 14+ application with TypeScript',
    gitignore: 'Node',
    license: 'MIT',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify(
          {
            name: 'my-app',
            version: '0.1.0',
            private: true,
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
              lint: 'next lint',
            },
            dependencies: {
              next: '^14.0.0',
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@types/node': '^20.0.0',
              '@types/react': '^18.2.0',
              '@types/react-dom': '^18.2.0',
              typescript: '^5.0.0',
              eslint: '^8.0.0',
              'eslint-config-next': '^14.0.0',
            },
          },
          null,
          2
        ),
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify(
          {
            compilerOptions: {
              lib: ['dom', 'dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: 'esnext',
              moduleResolution: 'bundler',
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: 'preserve',
              incremental: true,
              plugins: [{ name: 'next' }],
              paths: { '@/*': ['./*'] },
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
            exclude: ['node_modules'],
          },
          null,
          2
        ),
      },
      {
        path: 'app/layout.tsx',
        content: `import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'My App',
  description: 'Created with Platxa',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
      },
      {
        path: 'app/page.tsx',
        content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to My App</h1>
      <p className="mt-4 text-gray-600">Created with Platxa</p>
    </main>
  )
}
`,
      },
      {
        path: 'app/globals.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
      },
      {
        path: 'README.md',
        content: `# My App

A Next.js application created with Platxa.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Platxa Documentation](https://platxa.com/docs)
`,
      },
    ],
  },

  'empty': {
    id: 'empty',
    name: 'Empty Repository',
    description: 'Minimal repository with just README',
    files: [
      {
        path: 'README.md',
        content: `# Project Name

Description of your project.

## Getting Started

Add your setup instructions here.

## License

Add your license here.
`,
      },
      {
        path: '.gitignore',
        content: `# Dependencies
node_modules/
__pycache__/
*.pyc

# Build outputs
dist/
build/
.next/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`,
      },
    ],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a valid repository name from a project name
 */
export function sanitizeRepoName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

/**
 * Generate initial files from a template
 */
export function getTemplateFiles(
  templateId: string,
  variables?: Record<string, string>
): CommitFile[] {
  const template = PROJECT_TEMPLATES[templateId];
  if (!template) return PROJECT_TEMPLATES['empty'].files;

  if (!variables) return template.files;

  // Replace variables in file contents
  return template.files.map((file) => ({
    ...file,
    content: Object.entries(variables).reduce(
      (content, [key, value]) => content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
      file.content
    ),
  }));
}

/**
 * Create a new repository with template
 */
export async function createRepoFromTemplate(
  credentials: GitHubCredentials,
  config: RepoConfig,
  templateId: string,
  variables?: Record<string, string>,
  org?: string
): Promise<RepoInitResult> {
  const initializer = new GitHubRepoInitializer(credentials);
  const files = getTemplateFiles(templateId, variables);

  return initializer.createAndInitialize(config, files, org);
}

export default GitHubRepoInitializer;

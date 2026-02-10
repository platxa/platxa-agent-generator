/**
 * GitHub Sync API - Push/Pull operations
 *
 * POST /api/github/sync - Sync project with GitHub repository
 * Body: { projectId, action: 'push' | 'pull' | 'sync', message?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decryptToken } from '@/lib/auth/crypto';
import { GitHubSync, type FileChange } from '@/lib/agent-bridge/github-sync';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { projectId, action, message } = body;

    if (!projectId || !action) {
      return NextResponse.json(
        { error: 'Missing projectId or action' },
        { status: 400 }
      );
    }

    if (!['push', 'pull', 'sync'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be push, pull, or sync' },
        { status: 400 }
      );
    }

    // Get GitHub connection
    const connection = await db.gitHubConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    // Get linked repository
    const repository = await db.gitHubRepository.findUnique({
      where: { projectId },
    });

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not linked to project' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId },
      include: { files: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Decrypt access token
    const accessToken = decryptToken(connection.accessToken);

    // Create sync instance
    const sync = new GitHubSync();

    // Connect to repository
    const connected = await sync.connect(
      { token: accessToken, type: 'bearer' },
      { owner: repository.owner, repo: repository.repo, branch: repository.branch }
    );

    if (!connected) {
      return NextResponse.json(
        { error: 'Failed to connect to repository' },
        { status: 500 }
      );
    }

    // Track local changes for push
    if (action === 'push' || action === 'sync') {
      for (const file of project.files) {
        const change: FileChange = {
          path: file.path,
          type: 'modify',
          content: file.content,
        };
        sync.trackChange(change);
      }
    }

    // Perform sync action
    let result: Awaited<ReturnType<typeof sync.push>>;
    if (action === 'push') {
      result = await sync.push(message || `Update from Platxa: ${new Date().toISOString()}`);
    } else if (action === 'pull') {
      result = await sync.pull();
    } else {
      result = await sync.sync();
    }

    // Update repository sync status
    await db.gitHubRepository.update({
      where: { projectId },
      data: {
        lastSyncAt: new Date(),
        lastCommitSha: result.commitSha || repository.lastCommitSha,
        syncStatus: result.success ? 'UP_TO_DATE' : (result.conflicts.length > 0 ? 'CONFLICT' : 'ERROR'),
      },
    });

    // If pull/sync, update project files with pulled content
    if ((action === 'pull' || action === 'sync') && result.pulled.length > 0) {
      // Fetch pulled file contents and update database
      for (const filePath of result.pulled) {
        const fileContent = await fetchFileContent(accessToken, repository.owner, repository.repo, repository.branch, filePath);
        if (fileContent) {
          await db.projectFile.upsert({
            where: { projectId_path: { projectId, path: filePath } },
            update: { content: fileContent, updatedAt: new Date() },
            create: {
              projectId,
              path: filePath,
              name: filePath.split('/').pop() || filePath,
              content: fileContent,
              language: getLanguageFromPath(filePath),
              isGenerated: false,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: result.success,
      action,
      pushed: result.pushed,
      pulled: result.pulled,
      conflicts: result.conflicts,
      commitSha: result.commitSha,
      error: result.error,
    });
  } catch (error) {
    console.error('GitHub sync error:', error);
    return NextResponse.json(
      { error: 'Sync operation failed' },
      { status: 500 }
    );
  }
}

/**
 * Fetch file content from GitHub
 */
async function fetchFileContent(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

/**
 * Determine language from file path
 */
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    xml: 'xml',
    scss: 'scss',
    css: 'css',
    py: 'python',
    js: 'javascript',
    ts: 'typescript',
    json: 'json',
    html: 'html',
  };
  return langMap[ext || ''] || 'text';
}

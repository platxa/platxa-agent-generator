/**
 * GitHub API - Connection status and management
 *
 * GET /api/github - Get GitHub connection status
 * DELETE /api/github - Disconnect GitHub account
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get GitHub connection
    const connection = await db.gitHubConnection.findUnique({
      where: { userId },
      select: {
        id: true,
        githubLogin: true,
        githubEmail: true,
        githubAvatar: true,
        scope: true,
        obtainedAt: true,
        expiresAt: true,
      },
    });

    // Get linked repositories
    const repositories = await db.gitHubRepository.findMany({
      where: {
        project: {
          userId,
        },
      },
      select: {
        id: true,
        projectId: true,
        owner: true,
        repo: true,
        branch: true,
        fullName: true,
        isPrivate: true,
        lastSyncAt: true,
        lastCommitSha: true,
        syncStatus: true,
      },
    });

    return NextResponse.json({
      connected: !!connection,
      connection: connection || null,
      repositories,
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitHub status' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Delete GitHub connection (cascade deletes repos)
    await db.gitHubConnection.delete({
      where: { userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect GitHub' },
      { status: 500 }
    );
  }
}

/**
 * GitHub Repositories API - List and link repositories
 *
 * GET /api/github/repos - List user's repositories
 * POST /api/github/repos - Link repository to project
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decryptToken } from '@/lib/auth/crypto';
import { setCacheHeaders, PRIVATE_MEDIUM } from '@/lib/utils/http-cache';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get GitHub connection
    const connection = await db.gitHubConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    // Decrypt access token
    const accessToken = decryptToken(connection.accessToken);

    // Fetch user's repositories
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch repositories' },
        { status: 500 }
      );
    }

    const repos = await response.json();

    // Map to simplified format
    const repositories = repos.map((repo: {
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      default_branch: string;
      description: string | null;
      html_url: string;
      updated_at: string;
    }) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch,
      description: repo.description,
      url: repo.html_url,
      updatedAt: repo.updated_at,
    }));

    // Cache-Control: private, max-age=300, stale-while-revalidate=600
    // Reduces GitHub API calls ~95% for repeated listings
    const response = NextResponse.json({ repositories });
    return setCacheHeaders(response, PRIVATE_MEDIUM);
  } catch (error) {
    console.error('GitHub repos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}

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
    const { projectId, owner, repo, branch } = body;

    if (!projectId || !owner || !repo) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
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

    // Decrypt access token and verify repo access
    const accessToken = decryptToken(connection.accessToken);

    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!repoResponse.ok) {
      return NextResponse.json(
        { error: 'Repository not found or access denied' },
        { status: 404 }
      );
    }

    const repoData = await repoResponse.json();

    // Create or update repository link
    const repository = await db.gitHubRepository.upsert({
      where: { projectId },
      update: {
        owner,
        repo,
        branch: branch || repoData.default_branch,
        fullName: repoData.full_name,
        isPrivate: repoData.private,
        syncStatus: 'IDLE',
      },
      create: {
        projectId,
        owner,
        repo,
        branch: branch || repoData.default_branch,
        fullName: repoData.full_name,
        isPrivate: repoData.private,
      },
    });

    return NextResponse.json({
      success: true,
      repository: {
        id: repository.id,
        owner: repository.owner,
        repo: repository.repo,
        branch: repository.branch,
        fullName: repository.fullName,
      },
    });
  } catch (error) {
    console.error('GitHub link error:', error);
    return NextResponse.json(
      { error: 'Failed to link repository' },
      { status: 500 }
    );
  }
}

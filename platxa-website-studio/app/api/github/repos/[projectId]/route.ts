/**
 * DELETE /api/github/repos/[projectId] - Unlink a GitHub repository from a project
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    const { projectId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Find and delete the linked repository
    const repository = await db.gitHubRepository.findUnique({
      where: { projectId },
    });

    if (!repository) {
      return NextResponse.json(
        { error: 'No repository linked to this project' },
        { status: 404 }
      );
    }

    await db.gitHubRepository.delete({
      where: { projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GitHub unlink error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink repository' },
      { status: 500 }
    );
  }
}

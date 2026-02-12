/**
 * GET /api/projects/[projectId] - Get project details
 * PATCH /api/projects/[projectId] - Update project
 * DELETE /api/projects/[projectId] - Delete project
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getProject,
  getProjectWithFiles,
  updateProject,
  deleteProject,
} from "@/lib/services/project-service";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    const { projectId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await getProjectWithFiles(projectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    const { projectId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership before update
    const existing = await getProject(projectId);
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, industry, colorPalette, settings, status } = body;

    const project = await updateProject(projectId, {
      name,
      description,
      industry,
      colorPalette,
      settings,
      status,
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    const { projectId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership before delete
    const existing = await getProject(projectId);
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteProject(projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}

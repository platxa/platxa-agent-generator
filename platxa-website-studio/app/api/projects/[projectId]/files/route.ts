/**
 * GET /api/projects/[projectId]/files - Get all project files
 * POST /api/projects/[projectId]/files - Save files to project
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getProjectFiles,
  saveFiles,
  getProject,
} from "@/lib/services/project-service";
import { validateFiles } from "@/lib/utils/request-validation";

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

    const project = await getProject(projectId);

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const files = await getProjectFiles(projectId);

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    const { projectId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await getProject(projectId);

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();

    const validation = validateFiles(body.files);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const savedFiles = await saveFiles(projectId, validation.files!);

    return NextResponse.json({ files: savedFiles }, { status: 201 });
  } catch (error) {
    console.error("Error saving files:", error);
    return NextResponse.json(
      { error: "Failed to save files" },
      { status: 500 }
    );
  }
}

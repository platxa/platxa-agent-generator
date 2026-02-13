/**
 * GET /api/projects/[projectId]/files - Get project files (with optional pagination)
 * POST /api/projects/[projectId]/files - Save files to project
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getProjectFiles,
  saveFiles,
  getProject,
  type PaginatedResult,
} from "@/lib/services/project-service";
import { validateFiles } from "@/lib/utils/request-validation";
import { setCacheHeaders } from "@/lib/utils/http-cache";
import type { ProjectFile } from "@prisma/client";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

const FILES_CACHE = {
  maxAge: 60,
  staleWhileRevalidate: 120,
  scope: "private" as const,
};

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

    // Parse optional pagination params
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor") || undefined;

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const paginationOptions = limit ? { limit, cursor } : undefined;

    const result = await getProjectFiles(projectId, paginationOptions);

    let response: NextResponse;
    if (paginationOptions && !Array.isArray(result)) {
      const paginated = result as PaginatedResult<ProjectFile>;
      response = NextResponse.json({
        files: paginated.items,
        nextCursor: paginated.nextCursor,
        hasMore: paginated.hasMore,
      });
    } else {
      response = NextResponse.json({ files: result });
    }

    return setCacheHeaders(response, FILES_CACHE);
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

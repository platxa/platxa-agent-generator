/**
 * GET /api/projects - List user's projects (with optional pagination)
 * POST /api/projects - Create new project
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createProject, getUserProjects, type PaginatedResult } from "@/lib/services/project-service";
import { generateETag, isNotModified, notModifiedResponse, setCacheHeaders, PRIVATE_SHORT } from "@/lib/utils/http-cache";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse optional pagination params
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const cursor = url.searchParams.get("cursor") || undefined;

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const paginationOptions = limit ? { limit, cursor } : undefined;

    const result = await getUserProjects(session.user.id, paginationOptions);

    // Generate ETag for conditional requests
    const etag = generateETag(result);
    if (isNotModified(req, etag)) {
      return notModifiedResponse(etag, PRIVATE_SHORT);
    }

    // Return paginated or flat shape depending on whether pagination was requested
    let response: NextResponse;
    if (paginationOptions && !Array.isArray(result)) {
      const paginated = result as PaginatedResult<unknown>;
      response = NextResponse.json({
        projects: paginated.items,
        nextCursor: paginated.nextCursor,
        hasMore: paginated.hasMore,
      });
    } else {
      response = NextResponse.json({ projects: result });
    }

    // Cache-Control: private, max-age=30, stale-while-revalidate=60
    return setCacheHeaders(response, PRIVATE_SHORT, etag);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, industry, colorPalette } = body;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const project = await createProject({
      name,
      userId: session.user.id,
      description,
      industry,
      colorPalette,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

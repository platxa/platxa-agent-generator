/**
 * GET /api/projects/[projectId]/deployments - Get deployment history
 * POST /api/projects/[projectId]/deployments - Create new deployment
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProject } from "@/lib/services/project-service";
import {
  getDeploymentHistory,
  deployToOdoo,
} from "@/lib/services/deployment-service";

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

    const deployments = await getDeploymentHistory(projectId);

    return NextResponse.json({ deployments });
  } catch (error) {
    console.error("Error fetching deployments:", error);
    return NextResponse.json(
      { error: "Failed to fetch deployments" },
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
    const { odooUrl, odooDatabase, odooUsername, odooApiKey, moduleName } = body;

    if (!odooUrl || !odooDatabase || !odooUsername || !odooApiKey) {
      return NextResponse.json(
        { error: "Odoo connection details are required" },
        { status: 400 }
      );
    }

    const result = await deployToOdoo({
      projectId,
      userId: session.user.id,
      odooUrl,
      odooDatabase,
      odooUsername,
      odooPassword: odooApiKey,
      moduleName,
    });

    return NextResponse.json(result, { status: result.success ? 201 : 500 });
  } catch (error) {
    console.error("Error creating deployment:", error);
    return NextResponse.json(
      { error: "Failed to create deployment" },
      { status: 500 }
    );
  }
}

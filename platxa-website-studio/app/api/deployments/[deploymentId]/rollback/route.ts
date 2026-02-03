/**
 * POST /api/deployments/[deploymentId]/rollback - Rollback a deployment
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getDeployment,
  rollbackDeployment,
} from "@/lib/services/deployment-service";

interface RouteParams {
  params: Promise<{ deploymentId: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    const { deploymentId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user owns the deployment
    const deployment = await getDeployment(deploymentId);

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    if (deployment.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Perform rollback
    const result = await rollbackDeployment(deploymentId, session.user.id);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("Error rolling back deployment:", error);
    return NextResponse.json(
      { error: "Failed to rollback deployment" },
      { status: 500 }
    );
  }
}

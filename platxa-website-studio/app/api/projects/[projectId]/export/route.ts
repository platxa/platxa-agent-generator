/**
 * GET /api/projects/[projectId]/export - Export project as ZIP file
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProjectWithFiles } from "@/lib/services/project-service";
import JSZip from "jszip";

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

    if (!project.files || project.files.length === 0) {
      return NextResponse.json(
        { error: "No files to export" },
        { status: 400 }
      );
    }

    // Create ZIP file
    const zip = new JSZip();

    // Add all project files to ZIP
    for (const file of project.files) {
      zip.file(file.path, file.content);
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    // Generate filename
    const safeName = project.name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const filename = `${safeName}_${new Date().toISOString().split("T")[0]}.zip`;

    // Return ZIP file (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error exporting project:", error);
    return NextResponse.json(
      { error: "Failed to export project" },
      { status: 500 }
    );
  }
}

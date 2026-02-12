"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { StudioLayout } from "@/components/layout";
import { useProjectStore, useEditorStore } from "@/lib/stores";

interface StudioPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function StudioPage({ params }: StudioPageProps) {
  // Unwrap params Promise (Next.js 15 requirement)
  const { projectId } = use(params);

  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") || undefined;
  const { setProject, setProjectConfig, setFiles, projectId: currentProjectId } = useProjectStore();
  const { openGeneratedFiles } = useEditorStore();
  const [isLoading, setIsLoading] = useState(currentProjectId !== projectId);

  // Initialize project on mount - try loading from DB first
  useEffect(() => {
    // Skip if already loaded for this project
    if (currentProjectId === projectId) {
      setIsLoading(false);
      return;
    }

    async function loadProject() {
      try {
        // Try loading from database (requires auth)
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const { project } = await res.json();
          setProject(projectId, project.name || `Project ${projectId.slice(-6)}`);

          if (project.industry || project.colorPalette) {
            setProjectConfig({
              themeName: `theme_${(project.name || "custom").replace(/\s+/g, "_").toLowerCase()}`,
              displayName: project.name || "Untitled",
              industry: project.industry,
              colorPalette: project.colorPalette,
            });
          }

          // Load files from DB
          if (project.files && project.files.length > 0) {
            const fileNodes = project.files.map((f: { path: string; name: string; content: string; language: string }) => ({
              id: f.path,
              name: f.name || f.path.split("/").pop() || f.path,
              path: f.path,
              type: "file" as const,
              content: f.content,
            }));
            setFiles(fileNodes);

            // Also open in editor
            openGeneratedFiles(
              project.files.map((f: { path: string; content: string; language: string }) => ({
                path: f.path,
                content: f.content,
                language: f.language || "xml",
              }))
            );
          }
          setIsLoading(false);
          return;
        }
      } catch {
        // Auth not available or API error - fall through to demo mode
      }

      // Fallback: demo mode with local-only project
      setProject(projectId, `Project ${projectId.slice(-6)}`);
      setIsLoading(false);
    }

    loadProject();
  }, [projectId, currentProjectId, setProject, setProjectConfig, setFiles, openGeneratedFiles]);

  // Show loading state until project is initialized
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <StudioLayout
      projectId={projectId}
      initialPrompt={initialPrompt}
    />
  );
}

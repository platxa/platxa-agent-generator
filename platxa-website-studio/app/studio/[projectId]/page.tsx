"use client";

import { use, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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

  // Initialize project on mount - try loading from DB first
  useEffect(() => {
    // Skip if already loaded for this project
    if (currentProjectId === projectId) return;

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
          return;
        }
      } catch {
        // Auth not available or API error - fall through to demo mode
      }

      // Fallback: demo mode with local-only project
      setProject(projectId, `Project ${projectId.slice(-6)}`);
    }

    loadProject();
  }, [projectId, currentProjectId, setProject, setProjectConfig, setFiles, openGeneratedFiles]);

  return (
    <StudioLayout
      projectId={projectId}
      initialPrompt={initialPrompt}
    />
  );
}

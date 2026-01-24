"use client";

import { use, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { StudioLayout } from "@/components/layout";
import { useProjectStore } from "@/lib/stores";

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
  const { setProject } = useProjectStore();

  // Initialize project on mount
  useEffect(() => {
    setProject(projectId, `Project ${projectId.slice(-6)}`);
  }, [projectId, setProject]);

  return (
    <StudioLayout
      projectId={projectId}
      initialPrompt={initialPrompt}
    />
  );
}

"use client";

/**
 * DeploymentPanelWrapper - Connects DeploymentPanel to project store and deploy API
 */

import { useState, useCallback } from "react";
import { DeploymentPanel } from "./DeploymentPanel";
import { useProjectStore, useEditorStore } from "@/lib/stores";
import type { DeploymentTarget, DeploymentHistoryEntry } from "./DeploymentPanel";

interface DeploymentPanelWrapperProps {
  projectId: string;
}

export function DeploymentPanelWrapper({ projectId }: DeploymentPanelWrapperProps) {
  const { projectName, odooUrl, odooStatus } = useProjectStore();
  const fileContents = useEditorStore((s) => s.fileContents);
  const [targets, setTargets] = useState<DeploymentTarget[]>(() => {
    if (odooUrl) {
      return [{
        id: "default",
        name: "Local Odoo",
        url: odooUrl,
        database: "odoo",
        odooVersion: "18.0",
        status: odooStatus === "connected" ? "connected" : "disconnected",
        isDefault: true,
      }];
    }
    return [];
  });
  const [history, setHistory] = useState<DeploymentHistoryEntry[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [currentDeploymentId, setCurrentDeploymentId] = useState<string>();

  const themeName = projectName?.replace(/\s+/g, "_").toLowerCase() || "theme_custom";

  const handleAddTarget = useCallback(() => {
    const url = prompt("Enter Odoo server URL (e.g., http://localhost:8069):");
    if (!url) return;
    const name = prompt("Enter a name for this target:") || "Odoo Server";
    setTargets(prev => [...prev, {
      id: `target-${Date.now()}`,
      name,
      url,
      database: "odoo",
      odooVersion: "18.0",
      status: "disconnected" as const,
      isDefault: prev.length === 0,
    }]);
  }, []);

  const handleRemoveTarget = useCallback((targetId: string) => {
    setTargets(prev => prev.filter(t => t.id !== targetId));
  }, []);

  const handleTestConnection = useCallback(async (targetId: string) => {
    const target = targets.find(t => t.id === targetId);
    if (!target) return;

    setTargets(prev => prev.map(t =>
      t.id === targetId ? { ...t, status: "checking" as const } : t
    ));

    try {
      const res = await fetch(`/api/deploy?url=${encodeURIComponent(target.url)}`);
      const data = await res.json();
      setTargets(prev => prev.map(t =>
        t.id === targetId
          ? {
              ...t,
              status: data.connected ? "connected" as const : "error" as const,
              lastChecked: new Date(),
            }
          : t
      ));
    } catch {
      setTargets(prev => prev.map(t =>
        t.id === targetId ? { ...t, status: "error" as const } : t
      ));
    }
  }, [targets]);

  const handleDeploy = useCallback(async (targetId: string) => {
    const target = targets.find(t => t.id === targetId);
    if (!target || isDeploying) return;

    const deployId = `deploy-${Date.now()}`;
    setIsDeploying(true);
    setCurrentDeploymentId(deployId);

    const files = Object.entries(fileContents).map(([path, content]) => ({
      path,
      content,
      type: path.endsWith(".xml") ? "xml" :
            path.endsWith(".py") ? "py" :
            path.endsWith(".scss") ? "scss" :
            path.endsWith(".css") ? "css" :
            path.endsWith(".js") ? "js" : "xml",
    }));

    const now = new Date();
    const newEntry: DeploymentHistoryEntry = {
      id: deployId,
      targetId,
      targetName: target.name,
      status: "deploying",
      deployedAt: now,
      deployedBy: "current-user",
      version: "1.0.0",
      moduleName: themeName,
      canRollback: false,
    };

    setHistory(prev => [newEntry, ...prev]);

    try {
      const exportRes = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeName,
          files,
          options: { validate: true, format: "json" },
        }),
      });

      if (!exportRes.ok) {
        throw new Error("Export failed");
      }

      const deployRes = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleName: themeName,
          moduleArchive: "",
          odooUrl: target.url,
          database: target.database,
          activateTheme: true,
        }),
      });

      const result = await deployRes.json();

      setHistory(prev => prev.map(h =>
        h.id === deployId
          ? {
              ...h,
              status: result.success ? "success" as const : "failed" as const,
              completedAt: new Date(),
              duration: Date.now() - now.getTime(),
              error: result.error,
              canRollback: result.success,
            }
          : h
      ));
    } catch (error) {
      setHistory(prev => prev.map(h =>
        h.id === deployId
          ? {
              ...h,
              status: "failed" as const,
              completedAt: new Date(),
              duration: Date.now() - now.getTime(),
              error: error instanceof Error ? error.message : "Deploy failed",
            }
          : h
      ));
    } finally {
      setIsDeploying(false);
      setCurrentDeploymentId(undefined);
    }
  }, [targets, isDeploying, fileContents, themeName]);

  const handleSetDefault = useCallback((targetId: string) => {
    setTargets(prev => prev.map(t => ({
      ...t,
      isDefault: t.id === targetId,
    })));
  }, []);

  return (
    <div className="h-full overflow-auto">
      <DeploymentPanel
        projectId={projectId}
        projectName={projectName || "Untitled"}
        targets={targets}
        history={history}
        isDeploying={isDeploying}
        currentDeploymentId={currentDeploymentId}
        onAddTarget={handleAddTarget}
        onRemoveTarget={handleRemoveTarget}
        onTestConnection={handleTestConnection}
        onDeploy={handleDeploy}
        onSetDefault={handleSetDefault}
      />
    </div>
  );
}

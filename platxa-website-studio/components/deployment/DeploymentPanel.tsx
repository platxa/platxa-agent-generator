"use client";

/**
 * DeploymentPanel Component
 *
 * UI for managing deployment targets and deployment history.
 * Allows deploying to Odoo servers, viewing history, and rollback.
 *
 * Features:
 * - Deployment target management
 * - One-click deploy button
 * - Deployment history with status
 * - Rollback to previous deployments
 * - Connection status indicators
 *
 * Feature #84: Deployment - DeploymentPanel UI
 */

import * as React from "react";
import { useState, useCallback } from "react";
import {
  Cloud,
  CloudUpload,
  Server,
  Plus,
  MoreHorizontal,
  Check,
  X,
  Clock,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings,
  Link as LinkIcon,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

/** Deployment target status */
export type TargetStatus = "connected" | "disconnected" | "error" | "checking";

/** Deployment status */
export type DeploymentStatus = "pending" | "deploying" | "success" | "failed" | "rolled_back";

/** Deployment target */
export interface DeploymentTarget {
  id: string;
  name: string;
  url: string;
  database: string;
  odooVersion: string;
  status: TargetStatus;
  lastChecked?: Date;
  isDefault?: boolean;
}

/** Deployment history entry */
export interface DeploymentHistoryEntry {
  id: string;
  targetId: string;
  targetName: string;
  status: DeploymentStatus;
  version: string;
  moduleName: string;
  deployedAt: Date;
  completedAt?: Date;
  duration?: number;
  deployedBy: string;
  websiteUrl?: string;
  error?: string;
  canRollback?: boolean;
}

/** DeploymentPanel props */
export interface DeploymentPanelProps {
  projectId: string;
  projectName: string;
  targets: DeploymentTarget[];
  history: DeploymentHistoryEntry[];
  isDeploying?: boolean;
  currentDeploymentId?: string;
  onAddTarget?: () => void;
  onEditTarget?: (targetId: string) => void;
  onRemoveTarget?: (targetId: string) => void;
  onTestConnection?: (targetId: string) => void;
  onDeploy?: (targetId: string) => void;
  onRollback?: (deploymentId: string) => void;
  onSetDefault?: (targetId: string) => void;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Status badge component */
function StatusBadge({ status }: { status: TargetStatus | DeploymentStatus }) {
  const config: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
    connected: {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30",
      label: "Connected",
    },
    disconnected: {
      icon: <XCircle className="w-3.5 h-3.5" />,
      color: "text-gray-500",
      bg: "bg-gray-100 dark:bg-gray-800",
      label: "Disconnected",
    },
    error: {
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
      label: "Error",
    },
    checking: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      label: "Checking",
    },
    pending: {
      icon: <Clock className="w-3.5 h-3.5" />,
      color: "text-gray-500",
      bg: "bg-gray-100 dark:bg-gray-800",
      label: "Pending",
    },
    deploying: {
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      label: "Deploying",
    },
    success: {
      icon: <Check className="w-3.5 h-3.5" />,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30",
      label: "Success",
    },
    failed: {
      icon: <X className="w-3.5 h-3.5" />,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
      label: "Failed",
    },
    rolled_back: {
      icon: <RotateCcw className="w-3.5 h-3.5" />,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      label: "Rolled Back",
    },
  };

  const cfg = config[status] || config.error;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

/** Target card component */
function TargetCard({
  target,
  isDeploying,
  onDeploy,
  onTest,
  onEdit,
  onRemove,
  onSetDefault,
}: {
  target: DeploymentTarget;
  isDeploying?: boolean;
  onDeploy?: () => void;
  onTest?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onSetDefault?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={`p-4 rounded-lg border ${
      target.isDefault
        ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10"
        : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            target.status === "connected"
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-gray-100 dark:bg-gray-800"
          }`}>
            <Server className={`w-5 h-5 ${
              target.status === "connected"
                ? "text-green-600 dark:text-green-400"
                : "text-gray-500"
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                {target.name}
              </h4>
              {target.isDefault && (
                <span className="px-1.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded">
                  Default
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate max-w-[200px]">
              {target.url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={target.status} />

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                  {onTest && (
                    <button
                      onClick={() => { onTest(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800 first:rounded-t-lg"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Test Connection
                    </button>
                  )}
                  {onSetDefault && !target.isDefault && (
                    <button
                      onClick={() => { onSetDefault(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Check className="w-4 h-4" />
                      Set as Default
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => { onEdit(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Settings className="w-4 h-4" />
                      Edit Settings
                    </button>
                  )}
                  {onRemove && (
                    <button
                      onClick={() => { onRemove(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 last:rounded-b-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>Odoo {target.odooVersion}</span>
        <span>DB: {target.database}</span>
      </div>

      <button
        onClick={onDeploy}
        disabled={isDeploying || target.status !== "connected"}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          isDeploying || target.status !== "connected"
            ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
            : "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
        }`}
      >
        {isDeploying ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Deploying...
          </>
        ) : (
          <>
            <CloudUpload className="w-4 h-4" />
            Deploy
          </>
        )}
      </button>
    </div>
  );
}

/** History item component */
function HistoryItem({
  entry,
  onRollback,
}: {
  entry: DeploymentHistoryEntry;
  onRollback?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {entry.targetName}
            </span>
            <StatusBadge status={entry.status} />
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>v{entry.version}</span>
            <span>{formatTimeAgo(entry.deployedAt)}</span>
            {entry.duration && <span>{formatDuration(entry.duration)}</span>}
          </div>
        </div>

        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Module:</span>{" "}
              <span className="text-gray-900 dark:text-gray-100">{entry.moduleName}</span>
            </div>
            <div>
              <span className="text-gray-500">Deployed by:</span>{" "}
              <span className="text-gray-900 dark:text-gray-100">{entry.deployedBy}</span>
            </div>
          </div>

          {entry.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{entry.error}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            {entry.websiteUrl && (
              <a
                href={entry.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
              >
                <ExternalLink className="w-4 h-4" />
                View Site
              </a>
            )}

            {entry.canRollback && entry.status === "success" && onRollback && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRollback();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md"
              >
                <RotateCcw className="w-4 h-4" />
                Rollback
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DeploymentPanel({
  projectId,
  projectName,
  targets,
  history,
  isDeploying = false,
  currentDeploymentId,
  onAddTarget,
  onEditTarget,
  onRemoveTarget,
  onTestConnection,
  onDeploy,
  onRollback,
  onSetDefault,
  className = "",
}: DeploymentPanelProps) {
  const [activeTab, setActiveTab] = useState<"targets" | "history">("targets");

  const handleDeploy = useCallback((targetId: string) => {
    if (confirm(`Deploy ${projectName} to this server?`)) {
      onDeploy?.(targetId);
    }
  }, [projectName, onDeploy]);

  const handleRollback = useCallback((deploymentId: string) => {
    if (confirm("Are you sure you want to rollback this deployment?")) {
      onRollback?.(deploymentId);
    }
  }, [onRollback]);

  const handleRemoveTarget = useCallback((targetId: string) => {
    if (confirm("Remove this deployment target?")) {
      onRemoveTarget?.(targetId);
    }
  }, [onRemoveTarget]);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Cloud className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Deployment
            </h2>
            <p className="text-sm text-gray-500">
              Deploy {projectName} to Odoo servers
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            onClick={() => setActiveTab("targets")}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "targets"
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            Targets ({targets.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "history"
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            History ({history.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "targets" ? (
          <div className="space-y-4">
            {targets.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 mb-4">No deployment targets configured</p>
                {onAddTarget && (
                  <button
                    onClick={onAddTarget}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                    Add Target
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-4">
                  {targets.map(target => (
                    <TargetCard
                      key={target.id}
                      target={target}
                      isDeploying={isDeploying}
                      onDeploy={() => handleDeploy(target.id)}
                      onTest={onTestConnection ? () => onTestConnection(target.id) : undefined}
                      onEdit={onEditTarget ? () => onEditTarget(target.id) : undefined}
                      onRemove={onRemoveTarget ? () => handleRemoveTarget(target.id) : undefined}
                      onSetDefault={onSetDefault ? () => onSetDefault(target.id) : undefined}
                    />
                  ))}
                </div>

                {onAddTarget && (
                  <button
                    onClick={onAddTarget}
                    className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Target
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div>
            {history.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500">No deployment history yet</p>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                {history.map(entry => (
                  <HistoryItem
                    key={entry.id}
                    entry={entry}
                    onRollback={entry.canRollback ? () => handleRollback(entry.id) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DeploymentPanel;

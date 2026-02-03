"use client";

/**
 * CollaboratorAvatars
 *
 * Displays a stack of avatar circles for connected collaborators.
 * Shows up to N avatars with overflow indicator.
 */

import { useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CollaboratorInfo } from "@/lib/collaboration";

// =============================================================================
// Types
// =============================================================================

export interface CollaboratorAvatarsProps {
  /** List of collaborators to display */
  collaborators: CollaboratorInfo[];
  /** Maximum avatars to show before overflow */
  maxVisible?: number;
  /** Avatar size in pixels */
  size?: "sm" | "md" | "lg";
  /** Show status indicator dot */
  showStatus?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Size Configuration
// =============================================================================

const SIZES = {
  sm: { avatar: 24, text: 10, overlap: -6, status: 6 },
  md: { avatar: 32, text: 12, overlap: -8, status: 8 },
  lg: { avatar: 40, text: 14, overlap: -10, status: 10 },
};

// =============================================================================
// Component
// =============================================================================

export function CollaboratorAvatars({
  collaborators,
  maxVisible = 4,
  size = "md",
  showStatus = true,
  className,
}: CollaboratorAvatarsProps) {
  const sizeConfig = SIZES[size];

  // Filter out local user and sort by activity
  const remoteCollaborators = useMemo(() => {
    return collaborators
      .filter((c) => !c.isLocal)
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }, [collaborators]);

  const visibleCollaborators = remoteCollaborators.slice(0, maxVisible);
  const overflowCount = remoteCollaborators.length - maxVisible;

  if (remoteCollaborators.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn("flex items-center", className)}>
        {visibleCollaborators.map((collaborator, index) => (
          <Tooltip key={collaborator.clientId}>
            <TooltipTrigger asChild>
              <div
                className="relative"
                style={{
                  marginLeft: index > 0 ? sizeConfig.overlap : 0,
                  zIndex: visibleCollaborators.length - index,
                }}
              >
                <Avatar
                  name={collaborator.name}
                  avatar={collaborator.avatar}
                  color={collaborator.color}
                  size={sizeConfig.avatar}
                  textSize={sizeConfig.text}
                  isAi={collaborator.isAi}
                />
                {showStatus && (
                  <StatusDot
                    status={collaborator.status}
                    size={sizeConfig.status}
                  />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{collaborator.name}</span>
                <span className="text-muted-foreground capitalize">
                  {collaborator.status}
                  {collaborator.currentFile && ` in ${getFileName(collaborator.currentFile)}`}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {overflowCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="relative flex items-center justify-center rounded-full bg-muted border-2 border-background text-muted-foreground font-medium"
                style={{
                  width: sizeConfig.avatar,
                  height: sizeConfig.avatar,
                  marginLeft: sizeConfig.overlap,
                  fontSize: sizeConfig.text,
                  zIndex: 0,
                }}
              >
                +{overflowCount}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div className="flex flex-col gap-1">
                {remoteCollaborators.slice(maxVisible).map((c) => (
                  <span key={c.clientId}>{c.name}</span>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// =============================================================================
// Avatar Component
// =============================================================================

interface AvatarProps {
  name: string;
  avatar?: string;
  color: string;
  size: number;
  textSize: number;
  isAi?: boolean;
}

function Avatar({ name, avatar, color, size, textSize, isAi }: AvatarProps) {
  const initials = getInitials(name);

  return (
    <div
      className="relative flex items-center justify-center rounded-full border-2 border-background font-medium text-white overflow-hidden"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: textSize,
      }}
    >
      {avatar ? (
        <Image
          src={avatar}
          alt={name}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <span>{isAi ? "AI" : initials}</span>
      )}
    </div>
  );
}

// =============================================================================
// Status Dot Component
// =============================================================================

interface StatusDotProps {
  status: CollaboratorInfo["status"];
  size: number;
}

function StatusDot({ status, size }: StatusDotProps) {
  const colors: Record<CollaboratorInfo["status"], string> = {
    idle: "bg-gray-400",
    viewing: "bg-blue-400",
    editing: "bg-green-400",
    typing: "bg-yellow-400",
  };

  const animations: Record<CollaboratorInfo["status"], string> = {
    idle: "",
    viewing: "",
    editing: "animate-pulse",
    typing: "animate-bounce",
  };

  return (
    <div
      className={cn(
        "absolute bottom-0 right-0 rounded-full border-2 border-background",
        colors[status],
        animations[status]
      )}
      style={{ width: size, height: size }}
    />
  );
}

// =============================================================================
// Utilities
// =============================================================================

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

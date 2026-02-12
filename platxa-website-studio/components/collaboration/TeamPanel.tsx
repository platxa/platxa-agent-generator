"use client";

/**
 * TeamPanel Component
 *
 * UI for managing workspace members and roles.
 * Allows admins to view members, change roles, and remove members.
 *
 * Features:
 * - Member list with avatar, name, email, role
 * - Role change dropdown for admins
 * - Remove member functionality
 * - Invite new member button
 * - Search/filter members
 * - Pending invitations list
 *
 * Feature #73: Collaboration - TeamPanel UI
 */

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Search,
  Shield,
  Edit3,
  Eye,
  Crown,
  Mail,
  Trash2,
  Clock,
  X,
  Check,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

/** Member role */
export type MemberRole = "owner" | "admin" | "editor" | "viewer";

/** Team member */
export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: MemberRole;
  joinedAt: Date;
  lastActiveAt?: Date;
  isCurrentUser?: boolean;
}

/** Pending invitation */
export interface PendingInvitation {
  id: string;
  email: string;
  role: MemberRole;
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
}

/** TeamPanel props */
export interface TeamPanelProps {
  workspaceId: string;
  workspaceName: string;
  members: TeamMember[];
  pendingInvitations?: PendingInvitation[];
  currentUserRole: MemberRole;
  currentUserId: string;
  onRoleChange?: (memberId: string, newRole: MemberRole) => void;
  onRemoveMember?: (memberId: string) => void;
  onInviteMember?: () => void;
  onCancelInvitation?: (invitationId: string) => void;
  onResendInvitation?: (invitationId: string) => void;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const ROLE_INFO: Record<MemberRole, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  owner: {
    label: "Owner",
    icon: <Crown className="w-4 h-4" />,
    color: "text-amber-500",
    description: "Full control over workspace",
  },
  admin: {
    label: "Admin",
    icon: <Shield className="w-4 h-4" />,
    color: "text-blue-500",
    description: "Can manage members and settings",
  },
  editor: {
    label: "Editor",
    icon: <Edit3 className="w-4 h-4" />,
    color: "text-green-500",
    description: "Can edit projects and pages",
  },
  viewer: {
    label: "Viewer",
    icon: <Eye className="w-4 h-4" />,
    color: "text-gray-500",
    description: "Can only view content",
  },
};

const ASSIGNABLE_ROLES: MemberRole[] = ["admin", "editor", "viewer"];

// =============================================================================
// Helper Functions
// =============================================================================

function canChangeRole(currentUserRole: MemberRole, targetRole: MemberRole): boolean {
  if (currentUserRole === "owner") return true;
  if (currentUserRole === "admin" && targetRole !== "owner" && targetRole !== "admin") return true;
  return false;
}

function canRemoveMember(currentUserRole: MemberRole, memberRole: MemberRole): boolean {
  if (memberRole === "owner") return false;
  if (currentUserRole === "owner") return true;
  if (currentUserRole === "admin" && memberRole !== "admin") return true;
  return false;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(part => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Avatar component */
function Avatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external avatar URLs with unknown dimensions
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-medium text-gray-600 dark:text-gray-300`}
    >
      {getInitials(name)}
    </div>
  );
}

/** Role badge component */
function RoleBadge({ role }: { role: MemberRole }) {
  const info = ROLE_INFO[role];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 ${info.color}`}>
      {info.icon}
      {info.label}
    </span>
  );
}

/** Role selector dropdown */
function RoleSelector({
  currentRole,
  onChange,
  disabled,
}: {
  currentRole: MemberRole;
  onChange: (role: MemberRole) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors
          ${disabled
            ? "bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
            : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          }
          border-gray-200 dark:border-gray-700`}
      >
        <span className={ROLE_INFO[currentRole].color}>{ROLE_INFO[currentRole].icon}</span>
        {ROLE_INFO[currentRole].label}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
            {ASSIGNABLE_ROLES.map(role => (
              <button
                key={role}
                onClick={() => {
                  onChange(role);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg
                  ${role === currentRole ? "bg-gray-50 dark:bg-gray-800" : ""}`}
              >
                <span className={ROLE_INFO[role].color}>{ROLE_INFO[role].icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{ROLE_INFO[role].label}</div>
                  <div className="text-xs text-gray-500">{ROLE_INFO[role].description}</div>
                </div>
                {role === currentRole && <Check className="w-4 h-4 ml-auto text-green-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Member row component */
function MemberRow({
  member,
  currentUserRole,
  currentUserId,
  onRoleChange,
  onRemove,
}: {
  member: TeamMember;
  currentUserRole: MemberRole;
  currentUserId: string;
  onRoleChange?: (newRole: MemberRole) => void;
  onRemove?: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const isCurrentUser = member.userId === currentUserId;
  const canChange = canChangeRole(currentUserRole, member.role) && !isCurrentUser && member.role !== "owner";
  const canRemove = canRemoveMember(currentUserRole, member.role) && !isCurrentUser;

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors">
      <Avatar name={member.name} avatarUrl={member.avatarUrl} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {member.name}
          </span>
          {isCurrentUser && (
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
              You
            </span>
          )}
        </div>
        <div className="text-sm text-gray-500 truncate">{member.email}</div>
      </div>

      <div className="flex items-center gap-3">
        {member.lastActiveAt && (
          <span className="text-xs text-gray-400 hidden sm:block">
            Active {formatRelativeTime(member.lastActiveAt)}
          </span>
        )}

        {canChange && onRoleChange ? (
          <RoleSelector
            currentRole={member.role}
            onChange={onRoleChange}
          />
        ) : (
          <RoleBadge role={member.role} />
        )}

        {canRemove && onRemove && (
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                  <button
                    onClick={() => {
                      onRemove();
                      setShowActions(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove member
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Pending invitation row */
function InvitationRow({
  invitation,
  onCancel,
  onResend,
}: {
  invitation: PendingInvitation;
  onCancel?: () => void;
  onResend?: () => void;
}) {
  const isExpired = new Date() > invitation.expiresAt;

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
        <Mail className="w-5 h-5 text-gray-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {invitation.email}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-3 h-3" />
          {isExpired ? (
            <span className="text-red-500">Expired</span>
          ) : (
            <span>Expires {formatDate(invitation.expiresAt)}</span>
          )}
        </div>
      </div>

      <RoleBadge role={invitation.role} />

      <div className="flex items-center gap-2">
        {onResend && !isExpired && (
          <button
            onClick={onResend}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Resend
          </button>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TeamPanel({
  workspaceId,
  workspaceName,
  members,
  pendingInvitations = [],
  currentUserRole,
  currentUserId,
  onRoleChange,
  onRemoveMember,
  onInviteMember,
  onCancelInvitation,
  onResendInvitation,
  className = "",
}: TeamPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showInvitations, setShowInvitations] = useState(false);

  const canInvite = currentUserRole === "owner" || currentUserRole === "admin";

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;

    const query = searchQuery.toLowerCase();
    return members.filter(
      member =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  // Sort members: owner first, then by name
  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      if (a.role === "owner") return -1;
      if (b.role === "owner") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredMembers]);

  const handleRoleChange = useCallback(
    (memberId: string) => (newRole: MemberRole) => {
      onRoleChange?.(memberId, newRole);
    },
    [onRoleChange]
  );

  const handleRemoveMember = useCallback(
    (memberId: string) => () => {
      if (confirm("Are you sure you want to remove this member from the workspace?")) {
        onRemoveMember?.(memberId);
      }
    },
    [onRemoveMember]
  );

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Team Members
              </h2>
              <p className="text-sm text-gray-500">
                {members.length} member{members.length !== 1 ? "s" : ""} in {workspaceName}
              </p>
            </div>
          </div>

          {canInvite && onInviteMember && (
            <button
              onClick={onInviteMember}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
          />
        </div>
      </div>

      {/* Member list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {sortedMembers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery ? "No members found matching your search" : "No members yet"}
          </div>
        ) : (
          sortedMembers.map(member => (
            <MemberRow
              key={member.id}
              member={member}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId}
              onRoleChange={onRoleChange ? handleRoleChange(member.id) : undefined}
              onRemove={onRemoveMember ? handleRemoveMember(member.id) : undefined}
            />
          ))
        )}
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && canInvite && (
        <div className="border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setShowInvitations(!showInvitations)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Pending Invitations
              </span>
              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400">
                {pendingInvitations.length}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showInvitations ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showInvitations && (
            <div className="px-4 pb-4 space-y-2">
              {pendingInvitations.map(invitation => (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  onCancel={onCancelInvitation ? () => onCancelInvitation(invitation.id) : undefined}
                  onResend={onResendInvitation ? () => onResendInvitation(invitation.id) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TeamPanel;

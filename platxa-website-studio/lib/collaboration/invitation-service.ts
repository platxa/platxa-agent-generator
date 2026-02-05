/**
 * Invitation Service
 *
 * Handles team invitation system with email invites and accept flow.
 * Manages secure token generation, email dispatch, and invitation acceptance.
 *
 * Features:
 * - Secure invitation token generation
 * - Email invitation dispatch
 * - Invitation link validation
 * - Accept/decline flow
 * - Expiration handling
 * - Resend functionality
 *
 * Feature #71: Collaboration - Team Invitation System
 */

import type {
  WorkspaceInvitation,
  WorkspaceRole,
  InvitationStatus,
} from "./workspace-manager";

// =============================================================================
// Types
// =============================================================================

/** Email provider interface for sending invitations */
export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<EmailResult>;
}

/** Email sending options */
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/** Email send result */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Invitation token payload */
export interface InvitationTokenPayload {
  invitationId: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: number;
}

/** Invitation details for display */
export interface InvitationDetails {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceLogo?: string;
  inviterName: string;
  inviterEmail: string;
  role: WorkspaceRole;
  email: string;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
  isExpired: boolean;
  isValid: boolean;
}

/** Invitation service configuration */
export interface InvitationServiceConfig {
  baseUrl: string;
  tokenSecret: string;
  defaultExpiryDays: number;
  emailProvider?: EmailProvider;
  fromEmail?: string;
  fromName?: string;
}

/** Invitation creation options */
export interface CreateInvitationOptions {
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: WorkspaceRole;
  inviterId: string;
  inviterName: string;
  inviterEmail: string;
  message?: string;
  expiryDays?: number;
}

/** Invitation accept result */
export interface AcceptInvitationResult {
  success: boolean;
  workspaceId?: string;
  memberId?: string;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_EXPIRY_DAYS = 7;
const TOKEN_VERSION = "v1";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate secure random token
 */
function generateSecureToken(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * Generate invitation ID
 */
function generateInvitationId(): string {
  return `inv_${Date.now().toString(36)}_${generateSecureToken(12)}`;
}

/**
 * Encode token payload to base64
 */
function encodeTokenPayload(payload: InvitationTokenPayload): string {
  const json = JSON.stringify(payload);
  if (typeof btoa !== "undefined") {
    return btoa(json);
  }
  return Buffer.from(json).toString("base64");
}

/**
 * Decode token payload from base64
 */
function decodeTokenPayload(encoded: string): InvitationTokenPayload | null {
  try {
    let json: string;
    if (typeof atob !== "undefined") {
      json = atob(encoded);
    } else {
      json = Buffer.from(encoded, "base64").toString("utf-8");
    }
    return JSON.parse(json) as InvitationTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Simple HMAC-like signature (for demo purposes - use proper crypto in production)
 */
function generateSignature(payload: string, secret: string): string {
  let hash = 0;
  const combined = payload + secret;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// =============================================================================
// Email Templates
// =============================================================================

/**
 * Generate invitation email HTML
 */
function generateInvitationEmailHtml(options: {
  workspaceName: string;
  workspaceLogo?: string;
  inviterName: string;
  role: WorkspaceRole;
  inviteUrl: string;
  message?: string;
  expiresAt: Date;
}): string {
  const roleDisplay = options.role.charAt(0).toUpperCase() + options.role.slice(1);
  const expiryDate = options.expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to join ${options.workspaceName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background-color: #714B67;">
              ${options.workspaceLogo
                ? `<img src="${options.workspaceLogo}" alt="${options.workspaceName}" style="height: 48px; margin-bottom: 16px;">`
                : `<div style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">${options.workspaceName.charAt(0)}</div>`
              }
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">
                You're invited!
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                <strong>${options.inviterName}</strong> has invited you to join
                <strong>${options.workspaceName}</strong> as ${roleDisplay === "Admin" ? "an" : "a"} <strong>${roleDisplay}</strong>.
              </p>

              ${options.message ? `
              <div style="margin: 0 0 24px; padding: 16px; background-color: #f9f9f9; border-left: 4px solid #714B67; border-radius: 0 4px 4px 0;">
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #666666; font-style: italic;">
                  "${options.message}"
                </p>
              </div>
              ` : ""}

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${options.inviteUrl}"
                       style="display: inline-block; padding: 14px 32px; background-color: #714B67; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.5; color: #888888; text-align: center;">
                This invitation expires on ${expiryDate}.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9f9f9; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #888888; text-align: center;">
                If you didn't expect this invitation, you can safely ignore this email.
                <br>
                <a href="${options.inviteUrl}" style="color: #714B67; word-break: break-all;">${options.inviteUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate invitation email plain text
 */
function generateInvitationEmailText(options: {
  workspaceName: string;
  inviterName: string;
  role: WorkspaceRole;
  inviteUrl: string;
  message?: string;
  expiresAt: Date;
}): string {
  const roleDisplay = options.role.charAt(0).toUpperCase() + options.role.slice(1);
  const expiryDate = options.expiresAt.toLocaleDateString();

  let text = `You're invited to join ${options.workspaceName}!\n\n`;
  text += `${options.inviterName} has invited you to join ${options.workspaceName} as a ${roleDisplay}.\n\n`;

  if (options.message) {
    text += `Message from ${options.inviterName}:\n"${options.message}"\n\n`;
  }

  text += `Accept the invitation by clicking this link:\n${options.inviteUrl}\n\n`;
  text += `This invitation expires on ${expiryDate}.\n\n`;
  text += `If you didn't expect this invitation, you can safely ignore this email.`;

  return text;
}

// =============================================================================
// InvitationService Class
// =============================================================================

/**
 * Service for managing team invitations
 */
export class InvitationService {
  private config: InvitationServiceConfig;
  private invitations: Map<string, WorkspaceInvitation & { token: string }> = new Map();
  private tokenIndex: Map<string, string> = new Map(); // token -> invitationId

  constructor(config: InvitationServiceConfig) {
    this.config = {
      ...config,
      defaultExpiryDays: config.defaultExpiryDays || DEFAULT_EXPIRY_DAYS,
    };
  }

  /**
   * Create and send invitation
   */
  async createAndSendInvitation(
    options: CreateInvitationOptions
  ): Promise<{ invitation: WorkspaceInvitation; token: string; inviteUrl: string }> {
    const invitationId = generateInvitationId();
    const expiryDays = options.expiryDays || this.config.defaultExpiryDays;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create token payload
    const payload: InvitationTokenPayload = {
      invitationId,
      workspaceId: options.workspaceId,
      email: options.email,
      role: options.role,
      expiresAt: expiresAt.getTime(),
    };

    // Generate secure token
    const encodedPayload = encodeTokenPayload(payload);
    const signature = generateSignature(encodedPayload, this.config.tokenSecret);
    const token = `${TOKEN_VERSION}.${encodedPayload}.${signature}`;

    // Create invitation record
    const invitation: WorkspaceInvitation = {
      id: invitationId,
      workspaceId: options.workspaceId,
      email: options.email,
      role: options.role,
      invitedBy: options.inviterId,
      status: "pending",
      createdAt: new Date(),
      expiresAt,
    };

    // Store invitation
    this.invitations.set(invitationId, { ...invitation, token });
    this.tokenIndex.set(token, invitationId);

    // Generate invite URL
    const inviteUrl = `${this.config.baseUrl}/invite/accept?token=${encodeURIComponent(token)}`;

    // Send email if provider configured
    if (this.config.emailProvider) {
      const emailHtml = generateInvitationEmailHtml({
        workspaceName: options.workspaceName,
        inviterName: options.inviterName,
        role: options.role,
        inviteUrl,
        message: options.message,
        expiresAt,
      });

      const emailText = generateInvitationEmailText({
        workspaceName: options.workspaceName,
        inviterName: options.inviterName,
        role: options.role,
        inviteUrl,
        message: options.message,
        expiresAt,
      });

      await this.config.emailProvider.sendEmail({
        to: options.email,
        subject: `You're invited to join ${options.workspaceName}`,
        html: emailHtml,
        text: emailText,
        from: this.config.fromEmail,
      });
    }

    return { invitation, token, inviteUrl };
  }

  /**
   * Validate invitation token
   */
  validateToken(token: string): InvitationTokenPayload | null {
    // Parse token
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
      return null;
    }

    const [, encodedPayload, signature] = parts;

    // Verify signature
    const expectedSignature = generateSignature(encodedPayload, this.config.tokenSecret);
    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload = decodeTokenPayload(encodedPayload);
    if (!payload) {
      return null;
    }

    // Check expiration
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  }

  /**
   * Get invitation details from token
   */
  getInvitationDetails(
    token: string,
    workspaceName: string,
    workspaceLogo: string | undefined,
    inviterName: string,
    inviterEmail: string
  ): InvitationDetails | null {
    const payload = this.validateToken(token);
    if (!payload) return null;

    const invitationId = this.tokenIndex.get(token);
    if (!invitationId) return null;

    const stored = this.invitations.get(invitationId);
    if (!stored) return null;

    const isExpired = new Date() > stored.expiresAt;

    return {
      id: stored.id,
      workspaceId: stored.workspaceId,
      workspaceName,
      workspaceLogo,
      inviterName,
      inviterEmail,
      role: stored.role,
      email: stored.email,
      status: isExpired ? "expired" : stored.status,
      createdAt: stored.createdAt,
      expiresAt: stored.expiresAt,
      isExpired,
      isValid: !isExpired && stored.status === "pending",
    };
  }

  /**
   * Accept invitation
   */
  acceptInvitation(
    token: string,
    userId: string,
    userEmail: string
  ): AcceptInvitationResult {
    const payload = this.validateToken(token);
    if (!payload) {
      return { success: false, error: "Invalid or expired invitation token" };
    }

    // Verify email matches
    if (payload.email.toLowerCase() !== userEmail.toLowerCase()) {
      return { success: false, error: "Email does not match invitation" };
    }

    const invitationId = this.tokenIndex.get(token);
    if (!invitationId) {
      return { success: false, error: "Invitation not found" };
    }

    const stored = this.invitations.get(invitationId);
    if (!stored) {
      return { success: false, error: "Invitation not found" };
    }

    if (stored.status !== "pending") {
      return { success: false, error: `Invitation has already been ${stored.status}` };
    }

    // Mark as accepted
    stored.status = "accepted";
    stored.acceptedAt = new Date();

    // Generate member ID
    const memberId = `mem_${Date.now().toString(36)}_${generateSecureToken(8)}`;

    return {
      success: true,
      workspaceId: payload.workspaceId,
      memberId,
    };
  }

  /**
   * Decline invitation
   */
  declineInvitation(token: string, userEmail: string): boolean {
    const payload = this.validateToken(token);
    if (!payload) return false;

    if (payload.email.toLowerCase() !== userEmail.toLowerCase()) {
      return false;
    }

    const invitationId = this.tokenIndex.get(token);
    if (!invitationId) return false;

    const stored = this.invitations.get(invitationId);
    if (!stored || stored.status !== "pending") return false;

    stored.status = "declined";
    return true;
  }

  /**
   * Resend invitation
   */
  async resendInvitation(
    invitationId: string,
    workspaceName: string,
    inviterName: string
  ): Promise<boolean> {
    const stored = this.invitations.get(invitationId);
    if (!stored || stored.status !== "pending") return false;

    // Update expiration
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + this.config.defaultExpiryDays);
    stored.expiresAt = newExpiresAt;

    // Generate new token
    const payload: InvitationTokenPayload = {
      invitationId: stored.id,
      workspaceId: stored.workspaceId,
      email: stored.email,
      role: stored.role,
      expiresAt: newExpiresAt.getTime(),
    };

    const encodedPayload = encodeTokenPayload(payload);
    const signature = generateSignature(encodedPayload, this.config.tokenSecret);
    const newToken = `${TOKEN_VERSION}.${encodedPayload}.${signature}`;

    // Remove old token index
    this.tokenIndex.delete(stored.token);

    // Update with new token
    stored.token = newToken;
    this.tokenIndex.set(newToken, invitationId);

    // Generate invite URL
    const inviteUrl = `${this.config.baseUrl}/invite/accept?token=${encodeURIComponent(newToken)}`;

    // Send email if provider configured
    if (this.config.emailProvider) {
      const emailHtml = generateInvitationEmailHtml({
        workspaceName,
        inviterName,
        role: stored.role,
        inviteUrl,
        expiresAt: newExpiresAt,
      });

      const emailText = generateInvitationEmailText({
        workspaceName,
        inviterName,
        role: stored.role,
        inviteUrl,
        expiresAt: newExpiresAt,
      });

      await this.config.emailProvider.sendEmail({
        to: stored.email,
        subject: `Reminder: You're invited to join ${workspaceName}`,
        html: emailHtml,
        text: emailText,
        from: this.config.fromEmail,
      });
    }

    return true;
  }

  /**
   * Cancel invitation
   */
  cancelInvitation(invitationId: string): boolean {
    const stored = this.invitations.get(invitationId);
    if (!stored || stored.status !== "pending") return false;

    stored.status = "expired";
    this.tokenIndex.delete(stored.token);
    return true;
  }

  /**
   * Get pending invitations for workspace
   */
  getPendingInvitations(workspaceId: string): WorkspaceInvitation[] {
    const pending: WorkspaceInvitation[] = [];

    for (const stored of this.invitations.values()) {
      if (stored.workspaceId === workspaceId && stored.status === "pending") {
        const { token: _token, ...invitation } = stored;
        pending.push(invitation);
      }
    }

    return pending;
  }

  /**
   * Cleanup expired invitations
   */
  cleanupExpired(): number {
    let cleaned = 0;
    const now = new Date();

    for (const [id, stored] of this.invitations) {
      if (stored.status === "pending" && now > stored.expiresAt) {
        stored.status = "expired";
        this.tokenIndex.delete(stored.token);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create invitation service instance
 */
export function createInvitationService(
  config: InvitationServiceConfig
): InvitationService {
  return new InvitationService(config);
}

// =============================================================================
// Exports
// =============================================================================

export {
  generateInvitationEmailHtml,
  generateInvitationEmailText,
};

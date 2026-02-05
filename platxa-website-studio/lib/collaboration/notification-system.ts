/**
 * Notification System
 *
 * Provides in-app and email notifications for mentions, comments,
 * and other important collaboration events.
 *
 * Feature #78: Collaboration - Notification system
 */

// =============================================================================
// Types
// =============================================================================

export type NotificationType =
  | "mention"
  | "comment"
  | "reply"
  | "resolve"
  | "invite"
  | "join"
  | "leave"
  | "edit"
  | "commit"
  | "merge"
  | "conflict"
  | "approval"
  | "rejection"
  | "deadline"
  | "system";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationChannel = "in_app" | "email" | "push" | "slack";

export interface NotificationUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface Notification {
  /** Unique notification ID */
  id: string;
  /** Notification type */
  type: NotificationType;
  /** Priority level */
  priority: NotificationPriority;
  /** Title/headline */
  title: string;
  /** Detailed message */
  message: string;
  /** User who triggered the notification */
  actor?: NotificationUser;
  /** User receiving the notification */
  recipient: NotificationUser;
  /** Related resource */
  resource?: {
    type: "comment" | "file" | "project" | "workspace" | "commit" | "user";
    id: string;
    name: string;
    url?: string;
  };
  /** Channels to deliver through */
  channels: NotificationChannel[];
  /** Whether notification has been read */
  read: boolean;
  /** Whether notification has been dismissed */
  dismissed: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Read timestamp */
  readAt?: Date;
  /** Action URL */
  actionUrl?: string;
  /** Action label */
  actionLabel?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Expiration timestamp */
  expiresAt?: Date;
  /** Group ID for batching similar notifications */
  groupId?: string;
}

export interface NotificationPreferences {
  /** User ID */
  userId: string;
  /** Email notifications enabled */
  emailEnabled: boolean;
  /** Push notifications enabled */
  pushEnabled: boolean;
  /** In-app notifications enabled */
  inAppEnabled: boolean;
  /** Notification types to receive */
  enabledTypes: NotificationType[];
  /** Quiet hours (no notifications) */
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;
    timezone: string;
  };
  /** Email digest frequency */
  emailDigest: "immediate" | "hourly" | "daily" | "weekly" | "none";
  /** Minimum priority for email */
  emailMinPriority: NotificationPriority;
  /** Muted projects/workspaces */
  mutedResources: string[];
}

export interface NotificationFilter {
  types?: NotificationType[];
  priority?: NotificationPriority[];
  read?: boolean;
  dismissed?: boolean;
  since?: Date;
  until?: Date;
  resourceType?: string;
  resourceId?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}

// =============================================================================
// Email Templates
// =============================================================================

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Generate email notification content
 */
export function generateEmailNotification(notification: Notification): EmailNotification {
  const { title, message, actor, resource, actionUrl, actionLabel, type } = notification;

  const subject = `[Platxa] ${title}`;

  const actorName = actor?.name || "Someone";
  const resourceName = resource?.name || "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
    .content { background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
    .title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .message { color: #4b5563; }
    .actor { display: flex; align-items: center; margin-bottom: 16px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 12px; }
    .resource { background: #e2e8f0; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-size: 14px; margin: 16px 0; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .footer { font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    .unsubscribe { color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Platxa Studio</div>
    </div>

    <div class="content">
      ${actor ? `
      <div class="actor">
        <div class="avatar">${getInitials(actorName)}</div>
        <div>
          <strong>${actorName}</strong>
          <div style="font-size: 14px; color: #6b7280;">${getNotificationVerb(type)}</div>
        </div>
      </div>
      ` : ""}

      <div class="title">${title}</div>
      <div class="message">${message}</div>

      ${resourceName ? `<div class="resource">${resourceName}</div>` : ""}

      ${actionUrl ? `
      <div style="margin-top: 24px;">
        <a href="${actionUrl}" class="button">${actionLabel || "View"}</a>
      </div>
      ` : ""}
    </div>

    <div class="footer">
      <p>You're receiving this because you're a member of a Platxa workspace.</p>
      <p><a href="#" class="unsubscribe">Manage notification preferences</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
${title}

${actor ? `${actorName} ${getNotificationVerb(type)}` : ""}

${message}

${resourceName ? `Resource: ${resourceName}` : ""}

${actionUrl ? `View: ${actionUrl}` : ""}

---
You're receiving this because you're a member of a Platxa workspace.
  `.trim();

  return {
    to: notification.recipient.email || "",
    subject,
    html,
    text,
  };
}

function getNotificationVerb(type: NotificationType): string {
  const verbs: Record<NotificationType, string> = {
    mention: "mentioned you",
    comment: "left a comment",
    reply: "replied to your comment",
    resolve: "resolved a thread",
    invite: "invited you",
    join: "joined the workspace",
    leave: "left the workspace",
    edit: "made changes",
    commit: "pushed a commit",
    merge: "merged changes",
    conflict: "detected a conflict",
    approval: "approved your changes",
    rejection: "requested changes",
    deadline: "deadline reminder",
    system: "system notification",
  };
  return verbs[type];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// =============================================================================
// Notification Manager
// =============================================================================

export type NotificationEventType =
  | "notification:created"
  | "notification:read"
  | "notification:dismissed"
  | "notification:cleared";

export type NotificationEventCallback = (
  event: NotificationEventType,
  data: Notification | Notification[]
) => void;

/**
 * NotificationManager handles creating, storing, and delivering notifications
 */
export class NotificationManager {
  private notifications: Map<string, Notification> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private callbacks: NotificationEventCallback[] = [];
  private emailProvider?: (email: EmailNotification) => Promise<boolean>;

  constructor() {}

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Set email provider for sending notifications
   */
  setEmailProvider(provider: (email: EmailNotification) => Promise<boolean>): void {
    this.emailProvider = provider;
  }

  /**
   * Set user notification preferences
   */
  setPreferences(userId: string, prefs: Partial<NotificationPreferences>): void {
    const existing = this.preferences.get(userId) || getDefaultPreferences(userId);
    this.preferences.set(userId, { ...existing, ...prefs });
  }

  /**
   * Get user notification preferences
   */
  getPreferences(userId: string): NotificationPreferences {
    return this.preferences.get(userId) || getDefaultPreferences(userId);
  }

  // ---------------------------------------------------------------------------
  // Notification CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create and send a notification
   */
  async notify(
    options: Omit<Notification, "id" | "createdAt" | "read" | "dismissed">
  ): Promise<Notification> {
    const notification: Notification = {
      ...options,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date(),
      read: false,
      dismissed: false,
    };

    // Check user preferences
    const prefs = this.getPreferences(notification.recipient.id);

    // Check if notification type is enabled
    if (!prefs.enabledTypes.includes(notification.type)) {
      return notification;
    }

    // Check quiet hours
    if (prefs.quietHours?.enabled && isQuietHours(prefs.quietHours)) {
      // Still store but don't deliver immediately
      notification.channels = notification.channels.filter((c) => c === "in_app");
    }

    // Check muted resources
    if (
      notification.resource &&
      prefs.mutedResources.includes(notification.resource.id)
    ) {
      return notification;
    }

    // Store notification
    this.notifications.set(notification.id, notification);

    // Deliver through channels
    await this.deliver(notification, prefs);

    // Emit event
    this.emit("notification:created", notification);

    return notification;
  }

  /**
   * Get notifications for a user
   */
  getNotifications(
    userId: string,
    filter?: NotificationFilter
  ): Notification[] {
    let results = Array.from(this.notifications.values()).filter(
      (n) => n.recipient.id === userId
    );

    if (filter) {
      if (filter.types) {
        results = results.filter((n) => filter.types!.includes(n.type));
      }
      if (filter.priority) {
        results = results.filter((n) => filter.priority!.includes(n.priority));
      }
      if (filter.read !== undefined) {
        results = results.filter((n) => n.read === filter.read);
      }
      if (filter.dismissed !== undefined) {
        results = results.filter((n) => n.dismissed === filter.dismissed);
      }
      if (filter.since) {
        results = results.filter((n) => n.createdAt >= filter.since!);
      }
      if (filter.until) {
        results = results.filter((n) => n.createdAt <= filter.until!);
      }
      if (filter.resourceType) {
        results = results.filter((n) => n.resource?.type === filter.resourceType);
      }
      if (filter.resourceId) {
        results = results.filter((n) => n.resource?.id === filter.resourceId);
      }
    }

    // Sort by date, newest first
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get notification statistics
   */
  getStats(userId: string): NotificationStats {
    const notifications = this.getNotifications(userId, { dismissed: false });

    const stats: NotificationStats = {
      total: notifications.length,
      unread: notifications.filter((n) => !n.read).length,
      byType: {} as Record<NotificationType, number>,
      byPriority: {} as Record<NotificationPriority, number>,
    };

    for (const n of notifications) {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      stats.byPriority[n.priority] = (stats.byPriority[n.priority] || 0) + 1;
    }

    return stats;
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      notification.readAt = new Date();
      this.emit("notification:read", notification);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead(userId: string): void {
    const notifications = this.getNotifications(userId, { read: false });
    for (const n of notifications) {
      n.read = true;
      n.readAt = new Date();
    }
    if (notifications.length > 0) {
      this.emit("notification:read", notifications);
    }
  }

  /**
   * Dismiss a notification
   */
  dismiss(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.dismissed = true;
      this.emit("notification:dismissed", notification);
    }
  }

  /**
   * Clear all notifications for a user
   */
  clearAll(userId: string): void {
    const notifications = this.getNotifications(userId);
    for (const n of notifications) {
      this.notifications.delete(n.id);
    }
    this.emit("notification:cleared", notifications);
  }

  // ---------------------------------------------------------------------------
  // Delivery
  // ---------------------------------------------------------------------------

  /**
   * Deliver notification through configured channels
   */
  private async deliver(
    notification: Notification,
    prefs: NotificationPreferences
  ): Promise<void> {
    const channels = notification.channels.filter((c) => {
      switch (c) {
        case "in_app":
          return prefs.inAppEnabled;
        case "email":
          return (
            prefs.emailEnabled &&
            prefs.emailDigest === "immediate" &&
            getPriorityLevel(notification.priority) >=
              getPriorityLevel(prefs.emailMinPriority)
          );
        case "push":
          return prefs.pushEnabled;
        default:
          return false;
      }
    });

    for (const channel of channels) {
      switch (channel) {
        case "email":
          await this.sendEmail(notification);
          break;
        case "push":
          await this.sendPush(notification);
          break;
        // in_app is handled by storage
      }
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(notification: Notification): Promise<boolean> {
    if (!this.emailProvider || !notification.recipient.email) {
      return false;
    }

    try {
      const email = generateEmailNotification(notification);
      return await this.emailProvider(email);
    } catch (error) {
      console.error("Failed to send email notification:", error);
      return false;
    }
  }

  /**
   * Send push notification (placeholder)
   */
  private async sendPush(notification: Notification): Promise<boolean> {
    // Push notification implementation would go here
    // (e.g., using Web Push API or a service like Firebase)
    console.log("Push notification:", notification.title);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to notification events
   */
  on(callback: NotificationEventCallback): () => void {
    this.callbacks.push(callback);
    return () => this.off(callback);
  }

  /**
   * Unsubscribe from notification events
   */
  off(callback: NotificationEventCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event to all subscribers
   */
  private emit(
    event: NotificationEventType,
    data: Notification | Notification[]
  ): void {
    for (const callback of this.callbacks) {
      try {
        callback(event, data);
      } catch (error) {
        console.error("Notification event callback error:", error);
      }
    }
  }
}

// =============================================================================
// Notification Builders
// =============================================================================

/**
 * Helper functions to create common notification types
 */
export const NotificationBuilders = {
  mention: (
    actor: NotificationUser,
    recipient: NotificationUser,
    context: string,
    resourceUrl?: string
  ): Omit<Notification, "id" | "createdAt" | "read" | "dismissed"> => ({
    type: "mention",
    priority: "high",
    title: `${actor.name} mentioned you`,
    message: context,
    actor,
    recipient,
    channels: ["in_app", "email"],
    actionUrl: resourceUrl,
    actionLabel: "View",
  }),

  comment: (
    actor: NotificationUser,
    recipient: NotificationUser,
    commentPreview: string,
    resourceName: string,
    resourceUrl?: string
  ): Omit<Notification, "id" | "createdAt" | "read" | "dismissed"> => ({
    type: "comment",
    priority: "normal",
    title: `New comment from ${actor.name}`,
    message: commentPreview,
    actor,
    recipient,
    resource: { type: "comment", id: resourceUrl || "", name: resourceName },
    channels: ["in_app", "email"],
    actionUrl: resourceUrl,
    actionLabel: "View comment",
  }),

  reply: (
    actor: NotificationUser,
    recipient: NotificationUser,
    replyPreview: string,
    resourceUrl?: string
  ): Omit<Notification, "id" | "createdAt" | "read" | "dismissed"> => ({
    type: "reply",
    priority: "normal",
    title: `${actor.name} replied to your comment`,
    message: replyPreview,
    actor,
    recipient,
    channels: ["in_app", "email"],
    actionUrl: resourceUrl,
    actionLabel: "View reply",
  }),

  invite: (
    actor: NotificationUser,
    recipient: NotificationUser,
    workspaceName: string,
    inviteUrl: string
  ): Omit<Notification, "id" | "createdAt" | "read" | "dismissed"> => ({
    type: "invite",
    priority: "high",
    title: `${actor.name} invited you to ${workspaceName}`,
    message: `You've been invited to collaborate on ${workspaceName}`,
    actor,
    recipient,
    resource: { type: "workspace", id: workspaceName, name: workspaceName },
    channels: ["in_app", "email"],
    actionUrl: inviteUrl,
    actionLabel: "Accept invitation",
  }),

  conflict: (
    recipient: NotificationUser,
    fileName: string,
    fileUrl?: string
  ): Omit<Notification, "id" | "createdAt" | "read" | "dismissed"> => ({
    type: "conflict",
    priority: "urgent",
    title: "Merge conflict detected",
    message: `There's a conflict in ${fileName} that needs to be resolved`,
    recipient,
    resource: { type: "file", id: fileName, name: fileName },
    channels: ["in_app", "email", "push"],
    actionUrl: fileUrl,
    actionLabel: "Resolve conflict",
  }),

  deadline: (
    recipient: NotificationUser,
    taskName: string,
    dueDate: Date,
    taskUrl?: string
  ): Omit<Notification, "id" | "createdAt" | "read" | "dismissed"> => ({
    type: "deadline",
    priority: "high",
    title: "Upcoming deadline",
    message: `"${taskName}" is due ${formatDate(dueDate)}`,
    recipient,
    channels: ["in_app", "email"],
    actionUrl: taskUrl,
    actionLabel: "View task",
  }),
};

// =============================================================================
// Utilities
// =============================================================================

function getDefaultPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    emailEnabled: true,
    pushEnabled: true,
    inAppEnabled: true,
    enabledTypes: [
      "mention",
      "comment",
      "reply",
      "resolve",
      "invite",
      "conflict",
      "approval",
      "rejection",
      "deadline",
    ],
    emailDigest: "immediate",
    emailMinPriority: "normal",
    mutedResources: [],
  };
}

function getPriorityLevel(priority: NotificationPriority): number {
  const levels: Record<NotificationPriority, number> = {
    low: 0,
    normal: 1,
    high: 2,
    urgent: 3,
  };
  return levels[priority];
}

function isQuietHours(quietHours: NonNullable<NotificationPreferences["quietHours"]>): boolean {
  // Simplified check - proper implementation would use timezone
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMin] = quietHours.start.split(":").map(Number);
  const [endHour, endMin] = quietHours.end.split(":").map(Number);
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Overnight quiet hours
    return currentTime >= startTime || currentTime <= endTime;
  }
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  return date.toLocaleDateString();
}

// =============================================================================
// Singleton
// =============================================================================

let notificationManager: NotificationManager | null = null;

/**
 * Get the singleton NotificationManager instance
 */
export function getNotificationManager(): NotificationManager {
  if (!notificationManager) {
    notificationManager = new NotificationManager();
  }
  return notificationManager;
}

/**
 * Create a new NotificationManager instance
 */
export function createNotificationManager(): NotificationManager {
  return new NotificationManager();
}

// =============================================================================
// Export
// =============================================================================

export default NotificationManager;

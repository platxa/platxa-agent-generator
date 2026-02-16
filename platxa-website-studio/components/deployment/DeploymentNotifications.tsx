'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

// ============================================================================
// Types
// ============================================================================

export type DeploymentStatus =
  | 'queued'
  | 'building'
  | 'deploying'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'rollback';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'progress';

export interface DeploymentEvent {
  id: string;
  projectId: string;
  projectName: string;
  environment: 'preview' | 'staging' | 'production';
  status: DeploymentStatus;
  url?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  duration?: number;
  error?: string;
  timestamp: Date;
  triggeredBy?: string;
}

export interface ToastNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  progress?: number;
  deployment?: DeploymentEvent;
  createdAt: Date;
}

export interface NotificationPreferences {
  showSuccess: boolean;
  showFailure: boolean;
  showProgress: boolean;
  playSound: boolean;
  desktopNotifications: boolean;
  autoHideDuration: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

// ============================================================================
// Context
// ============================================================================

interface NotificationContextValue {
  notifications: ToastNotification[];
  preferences: NotificationPreferences;
  addNotification: (notification: Omit<ToastNotification, 'id' | 'createdAt'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  notifyDeployment: (event: DeploymentEvent) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ============================================================================
// Notification Provider
// ============================================================================

const DEFAULT_PREFERENCES: NotificationPreferences = {
  showSuccess: true,
  showFailure: true,
  showProgress: true,
  playSound: true,
  desktopNotifications: false,
  autoHideDuration: 5000,
  position: 'top-right',
};

export function DeploymentNotificationProvider({
  children,
  initialPreferences,
}: {
  children: React.ReactNode;
  initialPreferences?: Partial<NotificationPreferences>;
}) {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    ...DEFAULT_PREFERENCES,
    ...initialPreferences,
  });

  const addNotification = useCallback(
    (notification: Omit<ToastNotification, 'id' | 'createdAt'>): string => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newNotification: ToastNotification = {
        ...notification,
        id,
        createdAt: new Date(),
        dismissible: notification.dismissible ?? true,
        duration: notification.duration ?? preferences.autoHideDuration,
      };

      setNotifications((prev) => [...prev, newNotification]);

      // Play sound if enabled
      if (preferences.playSound && (notification.type === 'success' || notification.type === 'error')) {
        playNotificationSound(notification.type);
      }

      // Show desktop notification if enabled
      if (preferences.desktopNotifications && Notification.permission === 'granted') {
        showDesktopNotification(newNotification);
      }

      return id;
    },
    [preferences]
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...prefs }));
  }, []);

  const notifyDeployment = useCallback(
    (event: DeploymentEvent) => {
      const notification = createDeploymentNotification(event, preferences);
      if (notification) {
        addNotification(notification);
      }
    },
    [addNotification, preferences]
  );

  // Request desktop notification permission
  useEffect(() => {
    if (preferences.desktopNotifications && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [preferences.desktopNotifications]);

  const value: NotificationContextValue = {
    notifications,
    preferences,
    addNotification,
    removeNotification,
    clearAll,
    updatePreferences,
    notifyDeployment,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useDeploymentNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useDeploymentNotifications must be used within DeploymentNotificationProvider');
  }
  return context;
}

// ============================================================================
// Notification Container
// ============================================================================

function NotificationContainer() {
  const { notifications, preferences, removeNotification } = useDeploymentNotifications();

  const positionClasses: Record<NotificationPreferences['position'], string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={`notification-container fixed z-50 ${positionClasses[preferences.position]}`}
      style={{ maxWidth: '420px', width: '100%' }}
    >
      <div className="flex flex-col gap-3">
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            notification={notification}
            onDismiss={() => removeNotification(notification.id)}
          />
        ))}
      </div>

      <style jsx>{`
        .notification-container {
          pointer-events: none;
        }
        .notification-container > div {
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Toast Component
// ============================================================================

interface ToastProps {
  notification: ToastNotification;
  onDismiss: () => void;
}

function Toast({ notification, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  }, [onDismiss]);

  // Auto dismiss
  useEffect(() => {
    if (notification.duration && notification.duration > 0 && notification.type !== 'progress') {
      const startTime = Date.now();
      const duration = notification.duration;

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setProgress(remaining);

        if (remaining === 0) {
          clearInterval(interval);
          handleDismiss();
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [notification.duration, notification.type, handleDismiss]);

  // Update progress for progress type
  useEffect(() => {
    if (notification.type === 'progress' && notification.progress !== undefined) {
      setProgress(notification.progress);
    }
  }, [notification.progress, notification.type]);

  const typeStyles: Record<NotificationType, { bg: string; border: string; icon: string }> = {
    success: { bg: 'bg-green-50', border: 'border-green-200', icon: '✓' },
    error: { bg: 'bg-red-50', border: 'border-red-200', icon: '✕' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: '⚠' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'ℹ' },
    progress: { bg: 'bg-purple-50', border: 'border-purple-200', icon: '◐' },
  };

  const iconColors: Record<NotificationType, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500',
    progress: 'bg-purple-500',
  };

  const style = typeStyles[notification.type];

  return (
    <div
      className={`toast ${style.bg} ${style.border} border rounded-lg shadow-lg overflow-hidden
        transition-all duration-200 ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100'}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`${iconColors[notification.type]} w-6 h-6 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0`}
          >
            {notification.type === 'progress' ? (
              <span className="animate-spin">◐</span>
            ) : (
              style.icon
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 text-sm">{notification.title}</h4>
            <p className="text-gray-600 text-sm mt-0.5">{notification.message}</p>

            {/* Deployment details */}
            {notification.deployment && (
              <DeploymentDetails deployment={notification.deployment} />
            )}

            {/* Action button */}
            {notification.action && (
              <button
                onClick={notification.action.onClick}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                {notification.action.label}
              </button>
            )}
          </div>

          {/* Dismiss button */}
          {notification.dismissible && (
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(notification.duration || notification.type === 'progress') && (
        <div className="h-1 bg-gray-100">
          <div
            className={`h-full ${iconColors[notification.type]} transition-all duration-100`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Deployment Details Component
// ============================================================================

function DeploymentDetails({ deployment }: { deployment: DeploymentEvent }) {
  return (
    <div className="mt-2 text-xs space-y-1">
      <div className="flex items-center gap-2 text-gray-500">
        <span className="font-medium">{deployment.projectName}</span>
        <span>•</span>
        <span className="capitalize">{deployment.environment}</span>
      </div>

      {deployment.branch && (
        <div className="flex items-center gap-1 text-gray-500">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"/>
          </svg>
          <span>{deployment.branch}</span>
        </div>
      )}

      {deployment.commitMessage && (
        <div className="text-gray-600 truncate" title={deployment.commitMessage}>
          &ldquo;{deployment.commitMessage}&rdquo;
        </div>
      )}

      {deployment.duration && (
        <div className="text-gray-500">
          Completed in {formatDuration(deployment.duration)}
        </div>
      )}

      {deployment.url && deployment.status === 'success' && (
        <a
          href={deployment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
        >
          <span>View deployment</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}

      {deployment.error && (
        <div className="text-red-600 bg-red-50 p-2 rounded text-xs">
          {deployment.error}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function createDeploymentNotification(
  event: DeploymentEvent,
  preferences: NotificationPreferences
): Omit<ToastNotification, 'id' | 'createdAt'> | null {
  const envLabel = event.environment === 'production' ? '🚀 Production' :
    event.environment === 'staging' ? '🧪 Staging' : '👁️ Preview';

  switch (event.status) {
    case 'success':
      if (!preferences.showSuccess) return null;
      return {
        type: 'success',
        title: 'Deployment Successful',
        message: `${envLabel} deployment for ${event.projectName} completed`,
        deployment: event,
        action: event.url ? {
          label: 'View Site →',
          onClick: () => window.open(event.url, '_blank'),
        } : undefined,
      };

    case 'failed':
      if (!preferences.showFailure) return null;
      return {
        type: 'error',
        title: 'Deployment Failed',
        message: `${envLabel} deployment for ${event.projectName} failed`,
        deployment: event,
        duration: 0, // Don't auto-dismiss errors
        action: {
          label: 'View Logs',
          onClick: () => console.log('View logs for', event.id),
        },
      };

    case 'building':
    case 'deploying':
      if (!preferences.showProgress) return null;
      return {
        type: 'progress',
        title: event.status === 'building' ? 'Building...' : 'Deploying...',
        message: `${envLabel} deployment for ${event.projectName}`,
        deployment: event,
        progress: event.status === 'building' ? 30 : 70,
        dismissible: false,
      };

    case 'canceled':
      return {
        type: 'warning',
        title: 'Deployment Canceled',
        message: `${envLabel} deployment for ${event.projectName} was canceled`,
        deployment: event,
      };

    case 'rollback':
      return {
        type: 'warning',
        title: 'Rollback Initiated',
        message: `Rolling back ${envLabel} deployment for ${event.projectName}`,
        deployment: event,
      };

    default:
      return null;
  }
}

function playNotificationSound(type: 'success' | 'error') {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
    } else {
      oscillator.frequency.setValueAtTime(293.66, audioContext.currentTime); // D4
      oscillator.frequency.setValueAtTime(261.63, audioContext.currentTime + 0.15); // C4
    }

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch {
    // Audio not supported
  }
}

function showDesktopNotification(notification: ToastNotification) {
  const icon = notification.type === 'success' ? '✓' :
    notification.type === 'error' ? '✕' : 'ℹ';

  new Notification(notification.title, {
    body: notification.message,
    icon: `/icons/${notification.type}.png`,
    badge: icon,
    tag: notification.id,
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Standalone Toast Function
// ============================================================================

export function showDeploymentToast(
  event: DeploymentEvent,
  preferences?: Partial<NotificationPreferences>
): void {
  const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
  const notification = createDeploymentNotification(event, prefs);

  if (!notification) return;

  // Create a temporary container
  const container = document.createElement('div');
  container.id = `toast-${Date.now()}`;
  container.className = 'fixed top-4 right-4 z-50';
  container.style.maxWidth = '420px';
  document.body.appendChild(container);

  // Render toast
  const root = document.createElement('div');
  container.appendChild(root);

  // Safe DOM-based toast rendering (no innerHTML to prevent XSS)
  const toast = document.createElement('div');
  toast.className = `p-4 rounded-lg shadow-lg border ${
    notification.type === 'success' ? 'bg-green-50 border-green-200' :
    notification.type === 'error' ? 'bg-red-50 border-red-200' :
    'bg-blue-50 border-blue-200'
  }`;

  const row = document.createElement('div');
  row.className = 'flex items-start gap-3';

  const icon = document.createElement('div');
  icon.className = `w-6 h-6 rounded-full flex items-center justify-center text-white text-sm ${
    notification.type === 'success' ? 'bg-green-500' :
    notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  }`;
  icon.textContent = notification.type === 'success' ? '\u2713' : notification.type === 'error' ? '\u2715' : '\u2139';

  const body = document.createElement('div');
  body.className = 'flex-1';
  const title = document.createElement('h4');
  title.className = 'font-semibold text-gray-900 text-sm';
  title.textContent = notification.title;
  const msg = document.createElement('p');
  msg.className = 'text-gray-600 text-sm mt-0.5';
  msg.textContent = notification.message;
  body.appendChild(title);
  body.appendChild(msg);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'text-gray-400 hover:text-gray-600';
  closeBtn.addEventListener('click', () => container.remove());
  closeBtn.setAttribute('aria-label', 'Close notification');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'w-4 h-4');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('d', 'M6 18L18 6M6 6l12 12');
  svg.appendChild(path);
  closeBtn.appendChild(svg);

  row.appendChild(icon);
  row.appendChild(body);
  row.appendChild(closeBtn);
  toast.appendChild(row);

  root.appendChild(toast);

  // Auto remove
  if (notification.duration && notification.duration > 0) {
    setTimeout(() => {
      container.remove();
    }, notification.duration);
  }

  // Play sound
  if (prefs.playSound && (notification.type === 'success' || notification.type === 'error')) {
    playNotificationSound(notification.type);
  }
}

// ============================================================================
// Export Hook for Deployment Monitoring
// ============================================================================

export function useDeploymentMonitor(
  onStatusChange?: (event: DeploymentEvent) => void
) {
  const { notifyDeployment } = useDeploymentNotifications();

  const handleDeploymentEvent = useCallback(
    (event: DeploymentEvent) => {
      notifyDeployment(event);
      onStatusChange?.(event);
    },
    [notifyDeployment, onStatusChange]
  );

  return {
    notifySuccess: (event: Omit<DeploymentEvent, 'status'>) =>
      handleDeploymentEvent({ ...event, status: 'success' }),
    notifyFailure: (event: Omit<DeploymentEvent, 'status'>) =>
      handleDeploymentEvent({ ...event, status: 'failed' }),
    notifyBuilding: (event: Omit<DeploymentEvent, 'status'>) =>
      handleDeploymentEvent({ ...event, status: 'building' }),
    notifyDeploying: (event: Omit<DeploymentEvent, 'status'>) =>
      handleDeploymentEvent({ ...event, status: 'deploying' }),
    notifyCanceled: (event: Omit<DeploymentEvent, 'status'>) =>
      handleDeploymentEvent({ ...event, status: 'canceled' }),
    notifyRollback: (event: Omit<DeploymentEvent, 'status'>) =>
      handleDeploymentEvent({ ...event, status: 'rollback' }),
  };
}

export default DeploymentNotificationProvider;

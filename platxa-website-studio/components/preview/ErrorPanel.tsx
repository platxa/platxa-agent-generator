"use client";

/**
 * ErrorPanel Component
 *
 * Displays current issues in a sidebar panel:
 * - Lists errors with severity icons
 * - Expandable details for each error
 * - Filters by severity level
 */

import React, { useState, useMemo, useCallback } from "react";

// =============================================================================
// Types
// =============================================================================

/** Error severity levels */
export type ErrorSeverity = "critical" | "high" | "medium" | "low";

/** Error item for display */
export interface ErrorItem {
  /** Unique identifier */
  id: string;
  /** Error message */
  message: string;
  /** Severity level */
  severity: ErrorSeverity;
  /** File path where error occurred */
  filePath?: string;
  /** Line number */
  lineNumber?: number;
  /** Column number */
  column?: number;
  /** Error type/category */
  errorType?: string;
  /** Detailed description */
  details?: string;
  /** Suggested fixes */
  suggestions?: string[];
  /** Timestamp */
  timestamp: number;
  /** Number of retry attempts */
  retryAttempts?: number;
  /** Whether error is being fixed */
  isFixing?: boolean;
}

/** Panel configuration */
export interface ErrorPanelConfig {
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Show file location */
  showLocation?: boolean;
  /** Show retry count */
  showRetryCount?: boolean;
  /** Allow filtering */
  allowFilter?: boolean;
  /** Allow sorting */
  allowSort?: boolean;
  /** Max errors to display */
  maxErrors?: number;
  /** Collapsed by default */
  defaultCollapsed?: boolean;
}

/** Sort options */
export type SortOption = "severity" | "timestamp" | "file";

/** Filter state */
export interface FilterState {
  severity: ErrorSeverity[];
  search: string;
}

/** Panel props */
export interface ErrorPanelProps {
  /** List of errors to display */
  errors: ErrorItem[];
  /** Panel title */
  title?: string;
  /** Configuration options */
  config?: ErrorPanelConfig;
  /** Callback when error is clicked */
  onErrorClick?: (error: ErrorItem) => void;
  /** Callback when fix is requested */
  onRequestFix?: (error: ErrorItem) => void;
  /** Callback when error is dismissed */
  onDismiss?: (error: ErrorItem) => void;
  /** Custom class name */
  className?: string;
  /** Whether panel is loading */
  isLoading?: boolean;
}

// =============================================================================
// Severity Icons and Colors
// =============================================================================

/** Severity icon mapping */
const SEVERITY_ICONS: Record<ErrorSeverity, string> = {
  critical: "🚨",
  high: "❌",
  medium: "⚠️",
  low: "ℹ️",
};

/** Severity color classes */
const SEVERITY_COLORS: Record<ErrorSeverity, string> = {
  critical: "error-severity-critical",
  high: "error-severity-high",
  medium: "error-severity-medium",
  low: "error-severity-low",
};

/** Severity labels */
const SEVERITY_LABELS: Record<ErrorSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Severity order for sorting */
const SEVERITY_ORDER: Record<ErrorSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Required<ErrorPanelConfig> = {
  showTimestamp: true,
  showLocation: true,
  showRetryCount: true,
  allowFilter: true,
  allowSort: true,
  maxErrors: 100,
  defaultCollapsed: false,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Formats a timestamp for display.
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

/**
 * Formats file location for display.
 */
function formatLocation(error: ErrorItem): string {
  if (!error.filePath) return "";
  let location = error.filePath;
  if (error.lineNumber) {
    location += `:${error.lineNumber}`;
    if (error.column) {
      location += `:${error.column}`;
    }
  }
  return location;
}

/**
 * Truncates message to max length.
 */
function truncateMessage(message: string, maxLength: number = 100): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength - 3) + "...";
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Props for ErrorItemRow */
interface ErrorItemRowProps {
  error: ErrorItem;
  isExpanded: boolean;
  onToggle: () => void;
  config: Required<ErrorPanelConfig>;
  onErrorClick?: (error: ErrorItem) => void;
  onRequestFix?: (error: ErrorItem) => void;
  onDismiss?: (error: ErrorItem) => void;
}

/**
 * Single error row component.
 */
function ErrorItemRow({
  error,
  isExpanded,
  onToggle,
  config,
  onErrorClick,
  onRequestFix,
  onDismiss,
}: ErrorItemRowProps) {
  const handleClick = useCallback(() => {
    onToggle();
    onErrorClick?.(error);
  }, [onToggle, onErrorClick, error]);

  const handleFix = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRequestFix?.(error);
    },
    [onRequestFix, error]
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss?.(error);
    },
    [onDismiss, error]
  );

  return (
    <div
      className={`error-panel-item ${SEVERITY_COLORS[error.severity]} ${isExpanded ? "expanded" : ""}`}
      data-testid={`error-item-${error.id}`}
      data-severity={error.severity}
    >
      {/* Header Row */}
      <div
        className="error-panel-item-header"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
      >
        {/* Severity Icon */}
        <span className="error-severity-icon" aria-label={SEVERITY_LABELS[error.severity]}>
          {SEVERITY_ICONS[error.severity]}
        </span>

        {/* Message */}
        <span className="error-message" title={error.message}>
          {truncateMessage(error.message)}
        </span>

        {/* Fixing indicator */}
        {error.isFixing && (
          <span className="error-fixing-indicator" aria-label="Fixing">
            ⏳
          </span>
        )}

        {/* Expand/Collapse indicator */}
        <span className="error-expand-icon" aria-hidden="true">
          {isExpanded ? "▼" : "▶"}
        </span>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="error-panel-item-details" data-testid={`error-details-${error.id}`}>
          {/* Full message */}
          <div className="error-detail-row">
            <span className="error-detail-label">Message:</span>
            <span className="error-detail-value">{error.message}</span>
          </div>

          {/* Location */}
          {config.showLocation && error.filePath && (
            <div className="error-detail-row">
              <span className="error-detail-label">Location:</span>
              <span className="error-detail-value error-location">
                {formatLocation(error)}
              </span>
            </div>
          )}

          {/* Error type */}
          {error.errorType && (
            <div className="error-detail-row">
              <span className="error-detail-label">Type:</span>
              <span className="error-detail-value">{error.errorType}</span>
            </div>
          )}

          {/* Timestamp */}
          {config.showTimestamp && (
            <div className="error-detail-row">
              <span className="error-detail-label">Time:</span>
              <span className="error-detail-value">{formatTimestamp(error.timestamp)}</span>
            </div>
          )}

          {/* Retry count */}
          {config.showRetryCount && error.retryAttempts !== undefined && (
            <div className="error-detail-row">
              <span className="error-detail-label">Retry attempts:</span>
              <span className="error-detail-value">{error.retryAttempts}/3</span>
            </div>
          )}

          {/* Details */}
          {error.details && (
            <div className="error-detail-row">
              <span className="error-detail-label">Details:</span>
              <span className="error-detail-value">{error.details}</span>
            </div>
          )}

          {/* Suggestions */}
          {error.suggestions && error.suggestions.length > 0 && (
            <div className="error-suggestions">
              <span className="error-detail-label">Suggestions:</span>
              <ul className="error-suggestions-list">
                {error.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="error-actions">
            {onRequestFix && !error.isFixing && (
              <button
                className="error-action-btn error-action-fix"
                onClick={handleFix}
                aria-label="Attempt fix"
              >
                🔧 Fix
              </button>
            )}
            {onDismiss && (
              <button
                className="error-action-btn error-action-dismiss"
                onClick={handleDismiss}
                aria-label="Dismiss error"
              >
                ✕ Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Props for FilterBar */
interface FilterBarProps {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  config: Required<ErrorPanelConfig>;
}

/**
 * Filter and sort bar component.
 */
function FilterBar({ filter, onFilterChange, sortBy, onSortChange, config }: FilterBarProps) {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filter, search: e.target.value });
    },
    [filter, onFilterChange]
  );

  const handleSeverityToggle = useCallback(
    (severity: ErrorSeverity) => {
      const newSeverity = filter.severity.includes(severity)
        ? filter.severity.filter((s) => s !== severity)
        : [...filter.severity, severity];
      onFilterChange({ ...filter, severity: newSeverity });
    },
    [filter, onFilterChange]
  );

  return (
    <div className="error-panel-filter-bar" data-testid="error-filter-bar">
      {/* Search */}
      {config.allowFilter && (
        <input
          type="text"
          className="error-filter-search"
          placeholder="Search errors..."
          value={filter.search}
          onChange={handleSearchChange}
          aria-label="Search errors"
        />
      )}

      {/* Severity filters */}
      {config.allowFilter && (
        <div className="error-filter-severity">
          {(["critical", "high", "medium", "low"] as ErrorSeverity[]).map((severity) => (
            <button
              key={severity}
              className={`error-filter-btn ${filter.severity.includes(severity) ? "active" : ""}`}
              onClick={() => handleSeverityToggle(severity)}
              aria-pressed={filter.severity.includes(severity)}
              title={`Filter ${SEVERITY_LABELS[severity]}`}
            >
              {SEVERITY_ICONS[severity]}
            </button>
          ))}
        </div>
      )}

      {/* Sort */}
      {config.allowSort && (
        <select
          className="error-sort-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          aria-label="Sort errors"
        >
          <option value="severity">Sort by Severity</option>
          <option value="timestamp">Sort by Time</option>
          <option value="file">Sort by File</option>
        </select>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ErrorPanel component for displaying current issues in sidebar.
 */
export function ErrorPanel({
  errors,
  title = "Issues",
  config: userConfig,
  onErrorClick,
  onRequestFix,
  onDismiss,
  className = "",
  isLoading = false,
}: ErrorPanelProps) {
  // Merge config with defaults
  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...userConfig }),
    [userConfig]
  );

  // State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterState>({
    severity: ["critical", "high", "medium", "low"],
    search: "",
  });
  const [sortBy, setSortBy] = useState<SortOption>("severity");
  const [isCollapsed, setIsCollapsed] = useState(config.defaultCollapsed);

  // Toggle expanded state
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Filter and sort errors
  const filteredErrors = useMemo(() => {
    let result = errors;

    // Apply severity filter
    result = result.filter((e) => filter.severity.includes(e.severity));

    // Apply search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.message.toLowerCase().includes(searchLower) ||
          e.filePath?.toLowerCase().includes(searchLower) ||
          e.errorType?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "severity":
          return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        case "timestamp":
          return b.timestamp - a.timestamp;
        case "file":
          return (a.filePath ?? "").localeCompare(b.filePath ?? "");
        default:
          return 0;
      }
    });

    // Apply max limit
    if (config.maxErrors && result.length > config.maxErrors) {
      result = result.slice(0, config.maxErrors);
    }

    return result;
  }, [errors, filter, sortBy, config.maxErrors]);

  // Count by severity
  const severityCounts = useMemo(() => {
    const counts: Record<ErrorSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const error of errors) {
      counts[error.severity]++;
    }
    return counts;
  }, [errors]);

  return (
    <div
      className={`error-panel ${className} ${isCollapsed ? "collapsed" : ""}`}
      data-testid="error-panel"
      role="region"
      aria-label={title}
    >
      {/* Header */}
      <div
        className="error-panel-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        onKeyDown={(e) => e.key === "Enter" && setIsCollapsed(!isCollapsed)}
      >
        <span className="error-panel-title">{title}</span>
        <span className="error-panel-count">
          {errors.length > 0 && (
            <>
              {severityCounts.critical > 0 && (
                <span className="count-badge critical">{severityCounts.critical}</span>
              )}
              {severityCounts.high > 0 && (
                <span className="count-badge high">{severityCounts.high}</span>
              )}
              {severityCounts.medium > 0 && (
                <span className="count-badge medium">{severityCounts.medium}</span>
              )}
              {severityCounts.low > 0 && (
                <span className="count-badge low">{severityCounts.low}</span>
              )}
            </>
          )}
        </span>
        <span className="error-panel-toggle" aria-hidden="true">
          {isCollapsed ? "▶" : "▼"}
        </span>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="error-panel-content">
          {/* Filter Bar */}
          {(config.allowFilter || config.allowSort) && (
            <FilterBar
              filter={filter}
              onFilterChange={setFilter}
              sortBy={sortBy}
              onSortChange={setSortBy}
              config={config}
            />
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="error-panel-loading" data-testid="error-panel-loading">
              Loading...
            </div>
          )}

          {/* Error List */}
          {!isLoading && (
            <div className="error-panel-list" role="list">
              {filteredErrors.length === 0 ? (
                <div className="error-panel-empty" data-testid="error-panel-empty">
                  {errors.length === 0 ? "No issues found" : "No matching issues"}
                </div>
              ) : (
                filteredErrors.map((error) => (
                  <ErrorItemRow
                    key={error.id}
                    error={error}
                    isExpanded={expandedIds.has(error.id)}
                    onToggle={() => toggleExpanded(error.id)}
                    config={config}
                    onErrorClick={onErrorClick}
                    onRequestFix={onRequestFix}
                    onDismiss={onDismiss}
                  />
                ))
              )}
            </div>
          )}

          {/* Footer with count */}
          {filteredErrors.length > 0 && (
            <div className="error-panel-footer">
              Showing {filteredErrors.length} of {errors.length} issues
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default ErrorPanel;

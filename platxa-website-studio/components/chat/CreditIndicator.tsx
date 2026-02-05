'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ChatMode = 'chat' | 'agent';

export interface CreditPricing {
  chat: {
    creditsPerMessage: number;
    description: string;
  };
  agent: {
    creditsPerToken: number;
    estimatedPerMessage: { min: number; max: number };
    description: string;
  };
}

export interface CreditBalance {
  available: number;
  used: number;
  total: number;
  resetDate?: Date;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
}

export interface CreditUsage {
  messageCount: number;
  tokensUsed: number;
  creditsUsed: number;
  sessionStart: Date;
}

export interface CreditIndicatorProps {
  mode: ChatMode;
  balance: CreditBalance;
  usage?: CreditUsage;
  pricing?: CreditPricing;
  onModeChange?: (mode: ChatMode) => void;
  showModeToggle?: boolean;
  showUsageDetails?: boolean;
  compact?: boolean;
  className?: string;
}

// ============================================================================
// Default Pricing Configuration
// ============================================================================

export const DEFAULT_PRICING: CreditPricing = {
  chat: {
    creditsPerMessage: 1,
    description: 'Simple, predictable pricing',
  },
  agent: {
    creditsPerToken: 0.001, // 1 credit per 1000 tokens
    estimatedPerMessage: { min: 2, max: 10 },
    description: 'Usage-based, varies by complexity',
  },
};

// ============================================================================
// Sub-Components
// ============================================================================

interface BalanceDisplayProps {
  balance: CreditBalance;
  compact?: boolean;
}

function BalanceDisplay({ balance, compact }: BalanceDisplayProps) {
  const percentUsed = Math.round((balance.used / balance.total) * 100);
  const isLow = balance.available < balance.total * 0.2;
  const isCritical = balance.available < balance.total * 0.05;

  return (
    <div className={`balance-display ${compact ? 'compact' : ''}`}>
      <div className="balance-header">
        <span className="balance-icon">💳</span>
        <span className="balance-amount" data-low={isLow} data-critical={isCritical}>
          {balance.available.toLocaleString()}
        </span>
        <span className="balance-label">credits</span>
      </div>

      {!compact && (
        <>
          <div className="balance-bar">
            <div
              className="balance-bar-fill"
              style={{ width: `${100 - percentUsed}%` }}
              data-low={isLow}
              data-critical={isCritical}
            />
          </div>
          <div className="balance-details">
            <span>{balance.used.toLocaleString()} used</span>
            <span>{balance.total.toLocaleString()} total</span>
          </div>
        </>
      )}

      {balance.resetDate && !compact && (
        <div className="balance-reset">
          Resets {formatResetDate(balance.resetDate)}
        </div>
      )}

      <style jsx>{`
        .balance-display {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .balance-display.compact {
          flex-direction: row;
          align-items: center;
          gap: 6px;
        }

        .balance-header {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .balance-icon {
          font-size: 14px;
        }

        .balance-amount {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary, #111);
        }

        .balance-amount[data-low="true"] {
          color: var(--warning, #f59e0b);
        }

        .balance-amount[data-critical="true"] {
          color: var(--danger, #ef4444);
        }

        .compact .balance-amount {
          font-size: 14px;
        }

        .balance-label {
          font-size: 13px;
          color: var(--text-muted, #666);
        }

        .compact .balance-label {
          font-size: 12px;
        }

        .balance-bar {
          height: 6px;
          background: var(--bg-tertiary, #e5e5e5);
          border-radius: 3px;
          overflow: hidden;
        }

        .balance-bar-fill {
          height: 100%;
          background: var(--success, #22c55e);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .balance-bar-fill[data-low="true"] {
          background: var(--warning, #f59e0b);
        }

        .balance-bar-fill[data-critical="true"] {
          background: var(--danger, #ef4444);
        }

        .balance-details {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted, #888);
        }

        .balance-reset {
          font-size: 11px;
          color: var(--text-muted, #888);
          text-align: center;
        }
      `}</style>
    </div>
  );
}

interface PricingBadgeProps {
  mode: ChatMode;
  pricing: CreditPricing;
  compact?: boolean;
}

function PricingBadge({ mode, pricing, compact }: PricingBadgeProps) {
  const isChat = mode === 'chat';

  return (
    <div className={`pricing-badge ${mode} ${compact ? 'compact' : ''}`}>
      <div className="pricing-mode">
        <span className="mode-icon">{isChat ? '💬' : '🤖'}</span>
        <span className="mode-name">{isChat ? 'Chat' : 'Agent'}</span>
      </div>

      <div className="pricing-cost">
        {isChat ? (
          <>
            <span className="cost-value">{pricing.chat.creditsPerMessage}</span>
            <span className="cost-unit">credit/message</span>
          </>
        ) : (
          <>
            <span className="cost-value">
              {pricing.agent.estimatedPerMessage.min}-{pricing.agent.estimatedPerMessage.max}
            </span>
            <span className="cost-unit">credits/message</span>
          </>
        )}
      </div>

      {!compact && (
        <div className="pricing-description">
          {isChat ? pricing.chat.description : pricing.agent.description}
        </div>
      )}

      <style jsx>{`
        .pricing-badge {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 10px 14px;
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 8px;
          border: 1px solid var(--border, #e5e5e5);
        }

        .pricing-badge.compact {
          flex-direction: row;
          align-items: center;
          padding: 6px 10px;
          gap: 8px;
        }

        .pricing-badge.chat {
          border-color: var(--success, #22c55e);
          background: rgba(34, 197, 94, 0.05);
        }

        .pricing-badge.agent {
          border-color: var(--accent, #06b6d4);
          background: rgba(6, 182, 212, 0.05);
        }

        .pricing-mode {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .mode-icon {
          font-size: 14px;
        }

        .mode-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #111);
        }

        .pricing-cost {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }

        .cost-value {
          font-size: 16px;
          font-weight: 700;
        }

        .chat .cost-value {
          color: var(--success, #22c55e);
        }

        .agent .cost-value {
          color: var(--accent, #06b6d4);
        }

        .compact .cost-value {
          font-size: 14px;
        }

        .cost-unit {
          font-size: 11px;
          color: var(--text-muted, #666);
        }

        .pricing-description {
          font-size: 11px;
          color: var(--text-muted, #888);
        }
      `}</style>
    </div>
  );
}

interface ModeToggleProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  pricing: CreditPricing;
  disabled?: boolean;
}

function ModeToggle({ mode, onChange, pricing, disabled }: ModeToggleProps) {
  return (
    <div className="mode-toggle">
      <button
        className={`toggle-option ${mode === 'chat' ? 'active' : ''}`}
        onClick={() => onChange('chat')}
        disabled={disabled}
      >
        <span className="toggle-icon">💬</span>
        <span className="toggle-label">Chat</span>
        <span className="toggle-price">{pricing.chat.creditsPerMessage} cr/msg</span>
      </button>
      <button
        className={`toggle-option ${mode === 'agent' ? 'active' : ''}`}
        onClick={() => onChange('agent')}
        disabled={disabled}
      >
        <span className="toggle-icon">🤖</span>
        <span className="toggle-label">Agent</span>
        <span className="toggle-price">~{pricing.agent.estimatedPerMessage.min}-{pricing.agent.estimatedPerMessage.max} cr</span>
      </button>

      <style jsx>{`
        .mode-toggle {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 10px;
        }

        .toggle-option {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .toggle-option:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toggle-option.active {
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .toggle-option:not(.active):hover:not(:disabled) {
          background: var(--bg-tertiary, #e5e5e5);
        }

        .toggle-icon {
          font-size: 18px;
        }

        .toggle-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #111);
        }

        .toggle-price {
          font-size: 10px;
          color: var(--text-muted, #888);
        }

        .toggle-option.active .toggle-price {
          color: var(--accent, #4f46e5);
        }
      `}</style>
    </div>
  );
}

interface UsageStatsProps {
  usage: CreditUsage;
  mode: ChatMode;
  pricing: CreditPricing;
}

function UsageStats({ usage, mode, pricing }: UsageStatsProps) {
  const sessionDuration = Math.round((Date.now() - usage.sessionStart.getTime()) / 60000);

  return (
    <div className="usage-stats">
      <div className="usage-header">
        <span>Session Usage</span>
        <span className="session-duration">{formatDuration(sessionDuration)}</span>
      </div>

      <div className="usage-grid">
        <div className="usage-item">
          <span className="usage-value">{usage.messageCount}</span>
          <span className="usage-label">Messages</span>
        </div>
        {mode === 'agent' && (
          <div className="usage-item">
            <span className="usage-value">{formatTokens(usage.tokensUsed)}</span>
            <span className="usage-label">Tokens</span>
          </div>
        )}
        <div className="usage-item highlight">
          <span className="usage-value">{usage.creditsUsed.toFixed(1)}</span>
          <span className="usage-label">Credits Used</span>
        </div>
      </div>

      <div className="usage-estimate">
        {mode === 'chat' ? (
          <span>Next message: {pricing.chat.creditsPerMessage} credit</span>
        ) : (
          <span>Next message: ~{pricing.agent.estimatedPerMessage.min}-{pricing.agent.estimatedPerMessage.max} credits</span>
        )}
      </div>

      <style jsx>{`
        .usage-stats {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
          background: var(--bg-secondary, #f9f9f9);
          border-radius: 8px;
        }

        .usage-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #666);
        }

        .session-duration {
          font-weight: 400;
          color: var(--text-muted, #888);
        }

        .usage-grid {
          display: flex;
          gap: 16px;
        }

        .usage-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .usage-item.highlight .usage-value {
          color: var(--accent, #4f46e5);
        }

        .usage-value {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary, #111);
        }

        .usage-label {
          font-size: 11px;
          color: var(--text-muted, #888);
        }

        .usage-estimate {
          font-size: 12px;
          color: var(--text-secondary, #666);
          padding-top: 8px;
          border-top: 1px solid var(--border, #e5e5e5);
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CreditIndicator({
  mode,
  balance,
  usage,
  pricing = DEFAULT_PRICING,
  onModeChange,
  showModeToggle = false,
  showUsageDetails = false,
  compact = false,
  className = '',
}: CreditIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const estimatedMessagesRemaining = useMemo(() => {
    if (mode === 'chat') {
      return Math.floor(balance.available / pricing.chat.creditsPerMessage);
    }
    const avgCost = (pricing.agent.estimatedPerMessage.min + pricing.agent.estimatedPerMessage.max) / 2;
    return Math.floor(balance.available / avgCost);
  }, [mode, balance.available, pricing]);

  const handleModeChange = useCallback(
    (newMode: ChatMode) => {
      onModeChange?.(newMode);
    },
    [onModeChange]
  );

  if (compact) {
    return (
      <div className={`credit-indicator compact ${className}`}>
        <BalanceDisplay balance={balance} compact />
        <span className="divider">•</span>
        <PricingBadge mode={mode} pricing={pricing} compact />

        <style jsx>{`
          .credit-indicator.compact {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: var(--bg-secondary, #f5f5f5);
            border-radius: 20px;
            font-size: 13px;
          }

          .divider {
            color: var(--text-muted, #ccc);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`credit-indicator ${className}`}>
      <div className="indicator-header" onClick={() => setIsExpanded(!isExpanded)}>
        <BalanceDisplay balance={balance} />
        <button className="expand-toggle">
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      <PricingBadge mode={mode} pricing={pricing} />

      <div className="messages-remaining">
        <span className="remaining-icon">📨</span>
        <span>~{estimatedMessagesRemaining.toLocaleString()} messages remaining</span>
      </div>

      {isExpanded && (
        <div className="indicator-expanded">
          {showModeToggle && onModeChange && (
            <div className="mode-section">
              <h4>Select Mode</h4>
              <ModeToggle
                mode={mode}
                onChange={handleModeChange}
                pricing={pricing}
              />
            </div>
          )}

          {showUsageDetails && usage && (
            <UsageStats usage={usage} mode={mode} pricing={pricing} />
          )}

          <div className="pricing-comparison">
            <h4>Pricing Comparison</h4>
            <div className="comparison-grid">
              <div className="comparison-item">
                <span className="comparison-mode">💬 Chat Mode</span>
                <span className="comparison-price">{pricing.chat.creditsPerMessage} credit/message</span>
                <span className="comparison-desc">{pricing.chat.description}</span>
              </div>
              <div className="comparison-item">
                <span className="comparison-mode">🤖 Agent Mode</span>
                <span className="comparison-price">
                  {pricing.agent.estimatedPerMessage.min}-{pricing.agent.estimatedPerMessage.max} credits/message
                </span>
                <span className="comparison-desc">{pricing.agent.description}</span>
              </div>
            </div>
          </div>

          {balance.available < balance.total * 0.2 && (
            <div className="low-balance-warning">
              <span className="warning-icon">⚠️</span>
              <span>Running low on credits!</span>
              <a href="/pricing" className="upgrade-link">Upgrade Plan</a>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .credit-indicator {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border, #e5e5e5);
          border-radius: 12px;
        }

        .indicator-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          cursor: pointer;
        }

        .expand-toggle {
          padding: 4px 8px;
          background: transparent;
          border: none;
          color: var(--text-muted, #888);
          cursor: pointer;
          font-size: 10px;
        }

        .expand-toggle:hover {
          color: var(--text-primary, #111);
        }

        .messages-remaining {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-secondary, #666);
        }

        .remaining-icon {
          font-size: 14px;
        }

        .indicator-expanded {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--border, #e5e5e5);
        }

        .mode-section h4,
        .pricing-comparison h4 {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #666);
          margin: 0 0 8px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .comparison-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .comparison-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 10px;
          background: var(--bg-secondary, #f9f9f9);
          border-radius: 6px;
        }

        .comparison-mode {
          font-size: 13px;
          font-weight: 600;
        }

        .comparison-price {
          font-size: 14px;
          color: var(--accent, #4f46e5);
          font-weight: 500;
        }

        .comparison-desc {
          font-size: 11px;
          color: var(--text-muted, #888);
        }

        .low-balance-warning {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid var(--warning, #f59e0b);
          border-radius: 8px;
          font-size: 13px;
        }

        .warning-icon {
          font-size: 14px;
        }

        .upgrade-link {
          margin-left: auto;
          color: var(--accent, #4f46e5);
          text-decoration: none;
          font-weight: 500;
        }

        .upgrade-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Hook for Credit Management
// ============================================================================

export interface UseCreditManagementOptions {
  initialBalance: CreditBalance;
  pricing?: CreditPricing;
  onBalanceUpdate?: (balance: CreditBalance) => void;
  onLowBalance?: (balance: CreditBalance) => void;
  lowBalanceThreshold?: number;
}

export interface UseCreditManagementReturn {
  balance: CreditBalance;
  usage: CreditUsage;
  deductCredits: (amount: number) => boolean;
  addCredits: (amount: number) => void;
  resetUsage: () => void;
  estimateCost: (mode: ChatMode, tokenCount?: number) => number;
  canAfford: (mode: ChatMode) => boolean;
  recordMessage: (mode: ChatMode, tokens?: number) => void;
}

export function useCreditManagement(
  options: UseCreditManagementOptions
): UseCreditManagementReturn {
  const {
    initialBalance,
    pricing = DEFAULT_PRICING,
    onBalanceUpdate,
    onLowBalance,
    lowBalanceThreshold = 0.1,
  } = options;

  const [balance, setBalance] = useState<CreditBalance>(initialBalance);
  const [usage, setUsage] = useState<CreditUsage>({
    messageCount: 0,
    tokensUsed: 0,
    creditsUsed: 0,
    sessionStart: new Date(),
  });

  // Check for low balance
  useEffect(() => {
    if (balance.available < balance.total * lowBalanceThreshold) {
      onLowBalance?.(balance);
    }
  }, [balance, lowBalanceThreshold, onLowBalance]);

  const deductCredits = useCallback(
    (amount: number): boolean => {
      if (balance.available < amount) {
        return false;
      }

      const newBalance = {
        ...balance,
        available: balance.available - amount,
        used: balance.used + amount,
      };

      setBalance(newBalance);
      onBalanceUpdate?.(newBalance);
      return true;
    },
    [balance, onBalanceUpdate]
  );

  const addCredits = useCallback(
    (amount: number): void => {
      const newBalance = {
        ...balance,
        available: balance.available + amount,
        total: balance.total + amount,
      };

      setBalance(newBalance);
      onBalanceUpdate?.(newBalance);
    },
    [balance, onBalanceUpdate]
  );

  const resetUsage = useCallback((): void => {
    setUsage({
      messageCount: 0,
      tokensUsed: 0,
      creditsUsed: 0,
      sessionStart: new Date(),
    });
  }, []);

  const estimateCost = useCallback(
    (mode: ChatMode, tokenCount?: number): number => {
      if (mode === 'chat') {
        return pricing.chat.creditsPerMessage;
      }

      if (tokenCount) {
        return tokenCount * pricing.agent.creditsPerToken;
      }

      // Return average estimate
      return (pricing.agent.estimatedPerMessage.min + pricing.agent.estimatedPerMessage.max) / 2;
    },
    [pricing]
  );

  const canAfford = useCallback(
    (mode: ChatMode): boolean => {
      const cost = estimateCost(mode);
      return balance.available >= cost;
    },
    [balance.available, estimateCost]
  );

  const recordMessage = useCallback(
    (mode: ChatMode, tokens?: number): void => {
      const cost = estimateCost(mode, tokens);
      const success = deductCredits(cost);

      if (success) {
        setUsage((prev) => ({
          ...prev,
          messageCount: prev.messageCount + 1,
          tokensUsed: prev.tokensUsed + (tokens || 0),
          creditsUsed: prev.creditsUsed + cost,
        }));
      }
    },
    [estimateCost, deductCredits]
  );

  return {
    balance,
    usage,
    deductCredits,
    addCredits,
    resetUsage,
    estimateCost,
    canAfford,
    recordMessage,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatResetDate(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000000).toFixed(2)}M`;
}

// ============================================================================
// Inline Credit Display Component
// ============================================================================

export interface InlineCreditDisplayProps {
  mode: ChatMode;
  creditsAvailable: number;
  pricing?: CreditPricing;
  className?: string;
}

export function InlineCreditDisplay({
  mode,
  creditsAvailable,
  pricing = DEFAULT_PRICING,
  className = '',
}: InlineCreditDisplayProps) {
  const cost = mode === 'chat'
    ? pricing.chat.creditsPerMessage
    : `${pricing.agent.estimatedPerMessage.min}-${pricing.agent.estimatedPerMessage.max}`;

  return (
    <span className={`inline-credit-display ${className}`}>
      <span className="credit-icon">💳</span>
      <span className="credit-amount">{creditsAvailable}</span>
      <span className="credit-divider">•</span>
      <span className="credit-cost">{cost} cr/{mode === 'chat' ? 'msg' : 'msg~'}</span>

      <style jsx>{`
        .inline-credit-display {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--text-muted, #888);
        }

        .credit-icon {
          font-size: 11px;
        }

        .credit-amount {
          font-weight: 600;
          color: var(--text-secondary, #666);
        }

        .credit-divider {
          opacity: 0.5;
        }

        .credit-cost {
          color: var(--accent, #4f46e5);
        }
      `}</style>
    </span>
  );
}

export default CreditIndicator;

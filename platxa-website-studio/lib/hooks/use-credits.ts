/**
 * useCredits Hook - Fetches and manages real credit data from the API
 *
 * Provides real-time credit balance, usage statistics, and transaction history
 * with automatic refresh and optimistic updates.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CREDIT_COSTS } from '@/lib/services/credit-service';

// Types matching the API response
export interface CreditBalance {
  available: number;
  used: number;
  total: number;
  plan: 'FREE' | 'STARTER' | 'TEAM' | 'BUSINESS' | 'ENTERPRISE';
  monthlyAllowance: number;
  resetDate: Date | null;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  projectId: string | null;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
}

export interface CreditUsageStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  byType: Record<string, number>;
}

export interface UseCreditsOptions {
  /** Auto-refresh interval in milliseconds (default: 30000 = 30s) */
  refreshInterval?: number;
  /** Whether to fetch on mount (default: true) */
  fetchOnMount?: boolean;
  /** Include transaction history (default: false) */
  includeHistory?: boolean;
  /** Include usage stats (default: false) */
  includeStats?: boolean;
  /** Number of transactions to fetch */
  historyLimit?: number;
}

export interface UseCreditsReturn {
  /** Current credit balance */
  balance: CreditBalance | null;
  /** Transaction history (if requested) */
  transactions: CreditTransaction[];
  /** Usage statistics (if requested) */
  stats: CreditUsageStats | null;
  /** Credit costs for different operations */
  costs: typeof CREDIT_COSTS;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refresh credit data */
  refresh: () => Promise<void>;
  /** Check if user can afford an operation */
  canAfford: (operationType: keyof typeof CREDIT_COSTS) => boolean;
  /** Get estimated cost for an operation */
  estimateCost: (operationType: keyof typeof CREDIT_COSTS, quantity?: number) => number;
  /** Optimistically update balance (for immediate UI feedback) */
  optimisticDeduct: (amount: number) => void;
}

const DEFAULT_BALANCE: CreditBalance = {
  available: 0,
  used: 0,
  total: 0,
  plan: 'FREE',
  monthlyAllowance: 100,
  resetDate: null,
};

export function useCredits(options: UseCreditsOptions = {}): UseCreditsReturn {
  const {
    refreshInterval = 30000,
    fetchOnMount = true,
    includeHistory = false,
    includeStats = false,
    historyLimit = 50,
  } = options;

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [stats, setStats] = useState<CreditUsageStats | null>(null);
  const [costs, setCosts] = useState<typeof CREDIT_COSTS>(CREDIT_COSTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const fetchCredits = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (includeHistory) {
        params.set('history', 'true');
        params.set('limit', historyLimit.toString());
      }
      if (includeStats) {
        params.set('stats', 'true');
      }

      const url = `/api/credits${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated - use default balance
          if (isMountedRef.current) {
            setBalance(DEFAULT_BALANCE);
            setError(null);
          }
          return;
        }
        throw new Error(`Failed to fetch credits: ${response.statusText}`);
      }

      const data = await response.json();

      if (isMountedRef.current) {
        setBalance({
          ...data.balance,
          resetDate: data.balance.resetDate ? new Date(data.balance.resetDate) : null,
        });

        if (data.transactions) {
          setTransactions(
            data.transactions.map((t: CreditTransaction) => ({
              ...t,
              createdAt: new Date(t.createdAt),
            }))
          );
        }

        if (data.stats) {
          setStats(data.stats);
        }

        if (data.costs) {
          setCosts(data.costs);
        }

        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch credits');
        // Don't clear balance on error - keep stale data
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [includeHistory, includeStats, historyLimit]);

  // Refresh function exposed to consumers
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchCredits();
  }, [fetchCredits]);

  // Check if user can afford an operation
  const canAfford = useCallback(
    (operationType: keyof typeof CREDIT_COSTS): boolean => {
      if (!balance) return false;
      return balance.available >= costs[operationType];
    },
    [balance, costs]
  );

  // Estimate cost for an operation
  const estimateCost = useCallback(
    (operationType: keyof typeof CREDIT_COSTS, quantity = 1): number => {
      return costs[operationType] * quantity;
    },
    [costs]
  );

  // Optimistically update balance for immediate UI feedback
  const optimisticDeduct = useCallback(
    (amount: number) => {
      if (!balance) return;

      setBalance((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          available: Math.max(0, prev.available - amount),
          used: prev.used + amount,
        };
      });
    },
    [balance]
  );

  // Initial fetch
  useEffect(() => {
    isMountedRef.current = true;

    if (fetchOnMount) {
      fetchCredits();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchOnMount, fetchCredits]);

  // Set up auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      refreshRef.current = setInterval(fetchCredits, refreshInterval);
    }

    return () => {
      if (refreshRef.current) {
        clearInterval(refreshRef.current);
      }
    };
  }, [refreshInterval, fetchCredits]);

  return {
    balance,
    transactions,
    stats,
    costs,
    isLoading,
    error,
    refresh,
    canAfford,
    estimateCost,
    optimisticDeduct,
  };
}

/**
 * Lightweight hook just for checking credit balance
 * Use when you only need to check if user can afford an action
 */
export function useCreditCheck(): {
  canAfford: (operationType: keyof typeof CREDIT_COSTS) => boolean;
  balance: number;
  isLoading: boolean;
} {
  const { balance, isLoading, canAfford } = useCredits({
    refreshInterval: 60000, // Less frequent updates
    includeHistory: false,
    includeStats: false,
  });

  return {
    canAfford,
    balance: balance?.available ?? 0,
    isLoading,
  };
}

export default useCredits;

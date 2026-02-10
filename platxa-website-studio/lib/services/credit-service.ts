/**
 * Credit Service - Manages user credits for theme generation
 *
 * Handles credit balance tracking, consumption, and transaction history.
 * Integrates with the billing system and provides real-time balance updates.
 */

import { db } from '@/lib/db';

// Define types locally since Prisma types may not be generated yet
export type TransactionType =
  | 'SIGNUP_BONUS'
  | 'PLAN_ALLOWANCE'
  | 'PURCHASE'
  | 'REFERRAL_BONUS'
  | 'PROMO_CODE'
  | 'ADMIN_ADJUSTMENT'
  | 'REFUND'
  | 'THEME_GENERATION'
  | 'THEME_ITERATION'
  | 'EXPORT'
  | 'DEPLOYMENT'
  | 'API_CALL';

export type PlanType = 'FREE' | 'STARTER' | 'TEAM' | 'BUSINESS' | 'ENTERPRISE';

// Credit costs for different operations
export const CREDIT_COSTS = {
  THEME_GENERATION: 10,      // Full theme generation
  THEME_ITERATION: 3,        // Iterative refinement
  EXPORT: 2,                 // Export to ZIP
  DEPLOYMENT: 5,             // Deploy to Odoo
  API_CALL: 1,               // Generic API call
} as const;

// Plan allowances (monthly credits)
export const PLAN_ALLOWANCES: Record<PlanType, number> = {
  FREE: 100,
  STARTER: 1000,
  TEAM: 5000,
  BUSINESS: 20000,
  ENTERPRISE: 100000,
};

export interface CreditBalance {
  available: number;
  used: number;
  total: number;
  plan: PlanType;
  monthlyAllowance: number;
  resetDate: Date | null;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  description: string;
  projectId: string | null;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
}

export interface DeductResult {
  success: boolean;
  newBalance: number;
  transactionId: string | null;
  error?: string;
}

export interface CreditUsageStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  byType: Record<string, number>;
}

/**
 * Get or create a credit account for a user
 */
export async function getOrCreateCreditAccount(userId: string) {
  let account = await db.creditAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    // Create new account with signup bonus
    account = await db.$transaction(async (tx) => {
      const newAccount = await tx.creditAccount.create({
        data: {
          userId,
          balance: PLAN_ALLOWANCES.FREE,
          lifetimeCredits: PLAN_ALLOWANCES.FREE,
          usedThisMonth: 0,
          plan: 'FREE',
          monthlyAllowance: PLAN_ALLOWANCES.FREE,
          billingCycleStart: new Date(),
          billingCycleEnd: getNextBillingDate(),
        },
      });

      // Record signup bonus transaction
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: PLAN_ALLOWANCES.FREE,
          type: 'SIGNUP_BONUS',
          description: 'Welcome bonus credits',
          balanceBefore: 0,
          balanceAfter: PLAN_ALLOWANCES.FREE,
        },
      });

      return newAccount;
    });
  }

  return account;
}

/**
 * Get user's current credit balance
 */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const account = await getOrCreateCreditAccount(userId);

  return {
    available: account.balance,
    used: account.usedThisMonth,
    total: account.monthlyAllowance,
    plan: account.plan,
    monthlyAllowance: account.monthlyAllowance,
    resetDate: account.billingCycleEnd,
  };
}

/**
 * Check if user has enough credits for an operation
 */
export async function hasCredits(userId: string, amount: number): Promise<boolean> {
  const account = await getOrCreateCreditAccount(userId);
  return account.balance >= amount;
}

/**
 * Check if user can afford a specific operation type
 */
export async function canAfford(
  userId: string,
  operationType: keyof typeof CREDIT_COSTS
): Promise<boolean> {
  return hasCredits(userId, CREDIT_COSTS[operationType]);
}

/**
 * Deduct credits from user's account
 */
export async function deductCredits(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
  projectId?: string,
  metadata?: Record<string, unknown>
): Promise<DeductResult> {
  try {
    const result = await db.$transaction(async (tx) => {
      const account = await tx.creditAccount.findUnique({
        where: { userId },
      });

      if (!account) {
        throw new Error('Credit account not found');
      }

      if (account.balance < amount) {
        throw new Error('Insufficient credits');
      }

      const newBalance = account.balance - amount;

      // Update account
      await tx.creditAccount.update({
        where: { userId },
        data: {
          balance: newBalance,
          usedThisMonth: account.usedThisMonth + amount,
        },
      });

      // Record transaction
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type,
          description,
          projectId: projectId || null,
          metadata: metadata || null,
          balanceBefore: account.balance,
          balanceAfter: newBalance,
        },
      });

      return {
        success: true,
        newBalance,
        transactionId: transaction.id,
      };
    });

    return result;
  } catch (error) {
    return {
      success: false,
      newBalance: 0,
      transactionId: null,
      error: error instanceof Error ? error.message : 'Failed to deduct credits',
    };
  }
}

/**
 * Add credits to user's account
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
  metadata?: Record<string, unknown>
): Promise<DeductResult> {
  try {
    const result = await db.$transaction(async (tx) => {
      const account = await getOrCreateCreditAccount(userId);

      const newBalance = account.balance + amount;

      // Update account
      await tx.creditAccount.update({
        where: { userId },
        data: {
          balance: newBalance,
          lifetimeCredits: account.lifetimeCredits + amount,
        },
      });

      // Record transaction
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type,
          description,
          metadata: metadata || null,
          balanceBefore: account.balance,
          balanceAfter: newBalance,
        },
      });

      return {
        success: true,
        newBalance,
        transactionId: transaction.id,
      };
    });

    return result;
  } catch (error) {
    return {
      success: false,
      newBalance: 0,
      transactionId: null,
      error: error instanceof Error ? error.message : 'Failed to add credits',
    };
  }
}

/**
 * Get user's transaction history
 */
export async function getTransactionHistory(
  userId: string,
  limit = 50,
  offset = 0
): Promise<CreditTransaction[]> {
  const transactions = await db.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return transactions;
}

/**
 * Get usage statistics for a user
 */
export async function getUsageStats(userId: string): Promise<CreditUsageStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayUsage, weekUsage, monthUsage, typeBreakdown] = await Promise.all([
    // Today's usage
    db.creditTransaction.aggregate({
      where: {
        userId,
        amount: { lt: 0 },
        createdAt: { gte: todayStart },
      },
      _sum: { amount: true },
    }),

    // This week's usage
    db.creditTransaction.aggregate({
      where: {
        userId,
        amount: { lt: 0 },
        createdAt: { gte: weekStart },
      },
      _sum: { amount: true },
    }),

    // This month's usage
    db.creditTransaction.aggregate({
      where: {
        userId,
        amount: { lt: 0 },
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),

    // Usage by type
    db.creditTransaction.groupBy({
      by: ['type'],
      where: {
        userId,
        amount: { lt: 0 },
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    }),
  ]);

  const byType: Record<string, number> = {};
  for (const item of typeBreakdown) {
    byType[item.type] = Math.abs(item._sum.amount || 0);
  }

  return {
    today: Math.abs(todayUsage._sum.amount || 0),
    thisWeek: Math.abs(weekUsage._sum.amount || 0),
    thisMonth: Math.abs(monthUsage._sum.amount || 0),
    byType,
  };
}

/**
 * Reset monthly credits for a user (called on billing cycle reset)
 */
export async function resetMonthlyCycle(userId: string): Promise<void> {
  const account = await db.creditAccount.findUnique({
    where: { userId },
  });

  if (!account) return;

  const newBalance = account.balance + account.monthlyAllowance;

  await db.$transaction(async (tx) => {
    await tx.creditAccount.update({
      where: { userId },
      data: {
        balance: newBalance,
        lifetimeCredits: account.lifetimeCredits + account.monthlyAllowance,
        usedThisMonth: 0,
        billingCycleStart: new Date(),
        billingCycleEnd: getNextBillingDate(),
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: account.monthlyAllowance,
        type: 'PLAN_ALLOWANCE',
        description: `Monthly ${account.plan} plan credits`,
        balanceBefore: account.balance,
        balanceAfter: newBalance,
      },
    });
  });
}

/**
 * Upgrade user's plan
 */
export async function upgradePlan(
  userId: string,
  newPlan: PlanType
): Promise<void> {
  const newAllowance = PLAN_ALLOWANCES[newPlan];

  const account = await db.creditAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    throw new Error('Credit account not found');
  }

  // Calculate prorated credits to add
  const currentAllowance = PLAN_ALLOWANCES[account.plan];
  const additionalCredits = newAllowance - currentAllowance;

  if (additionalCredits > 0) {
    await db.$transaction(async (tx) => {
      await tx.creditAccount.update({
        where: { userId },
        data: {
          plan: newPlan,
          monthlyAllowance: newAllowance,
          balance: account.balance + additionalCredits,
          lifetimeCredits: account.lifetimeCredits + additionalCredits,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: additionalCredits,
          type: 'PLAN_ALLOWANCE',
          description: `Plan upgrade to ${newPlan}`,
          balanceBefore: account.balance,
          balanceAfter: account.balance + additionalCredits,
        },
      });
    });
  } else {
    await db.creditAccount.update({
      where: { userId },
      data: {
        plan: newPlan,
        monthlyAllowance: newAllowance,
      },
    });
  }
}

/**
 * Get next billing date (30 days from now)
 */
function getNextBillingDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}

/**
 * Deduct credits for theme generation
 */
export async function deductForThemeGeneration(
  userId: string,
  projectId: string,
  tokensUsed?: number
): Promise<DeductResult> {
  return deductCredits(
    userId,
    CREDIT_COSTS.THEME_GENERATION,
    'THEME_GENERATION',
    'AI theme generation',
    projectId,
    tokensUsed ? { tokensUsed } : undefined
  );
}

/**
 * Deduct credits for theme iteration
 */
export async function deductForIteration(
  userId: string,
  projectId: string,
  iterationNumber?: number
): Promise<DeductResult> {
  return deductCredits(
    userId,
    CREDIT_COSTS.THEME_ITERATION,
    'THEME_ITERATION',
    `Theme iteration${iterationNumber ? ` #${iterationNumber}` : ''}`,
    projectId,
    iterationNumber ? { iterationNumber } : undefined
  );
}

/**
 * Deduct credits for export
 */
export async function deductForExport(
  userId: string,
  projectId: string
): Promise<DeductResult> {
  return deductCredits(
    userId,
    CREDIT_COSTS.EXPORT,
    'EXPORT',
    'Theme export to ZIP',
    projectId
  );
}

/**
 * Deduct credits for deployment
 */
export async function deductForDeployment(
  userId: string,
  projectId: string,
  targetUrl?: string
): Promise<DeductResult> {
  return deductCredits(
    userId,
    CREDIT_COSTS.DEPLOYMENT,
    'DEPLOYMENT',
    `Deployment${targetUrl ? ` to ${targetUrl}` : ''}`,
    projectId,
    targetUrl ? { targetUrl } : undefined
  );
}

/**
 * Estimate credit cost for an operation
 */
export function estimateCost(
  operationType: keyof typeof CREDIT_COSTS,
  quantity = 1
): number {
  return CREDIT_COSTS[operationType] * quantity;
}

/**
 * Check if the user's billing cycle should be reset
 */
export async function checkAndResetBillingCycle(userId: string): Promise<boolean> {
  const account = await db.creditAccount.findUnique({
    where: { userId },
  });

  if (!account || !account.billingCycleEnd) return false;

  if (new Date() > account.billingCycleEnd) {
    await resetMonthlyCycle(userId);
    return true;
  }

  return false;
}

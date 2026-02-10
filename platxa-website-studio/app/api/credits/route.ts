/**
 * Credits API - Get balance and transaction history
 *
 * GET /api/credits - Get current credit balance
 * GET /api/credits?history=true - Get transaction history
 * GET /api/credits?stats=true - Get usage statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getCreditBalance,
  getTransactionHistory,
  getUsageStats,
  checkAndResetBillingCycle,
  CREDIT_COSTS,
} from '@/lib/services/credit-service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';
    const includeStats = searchParams.get('stats') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Check if billing cycle needs reset
    await checkAndResetBillingCycle(userId);

    // Get credit balance
    const balance = await getCreditBalance(userId);

    const response: Record<string, unknown> = {
      balance,
      costs: CREDIT_COSTS,
    };

    // Include transaction history if requested
    if (includeHistory) {
      const transactions = await getTransactionHistory(userId, limit, offset);
      response.transactions = transactions;
    }

    // Include usage stats if requested
    if (includeStats) {
      const stats = await getUsageStats(userId);
      response.stats = stats;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Credits API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit information' },
      { status: 500 }
    );
  }
}

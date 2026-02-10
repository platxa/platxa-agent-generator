/**
 * Transactions API - Get detailed credit transaction history
 *
 * GET /api/credits/transactions - Get paginated transaction history
 * GET /api/credits/transactions?type=THEME_GENERATION - Filter by type
 * GET /api/credits/transactions?from=2024-01-01&to=2024-02-01 - Date range
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// Transaction types (matching Prisma schema)
type TransactionType =
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

    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Filters
    const type = searchParams.get('type') as TransactionType | null;
    const projectId = searchParams.get('projectId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build where clause
    const where: Record<string, unknown> = { userId };

    if (type) {
      where.type = type;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        (where.createdAt as Record<string, Date>).gte = new Date(from);
      }
      if (to) {
        (where.createdAt as Record<string, Date>).lte = new Date(to);
      }
    }

    // Fetch transactions with count
    const [transactions, total] = await Promise.all([
      db.creditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          projectId: true,
          balanceBefore: true,
          balanceAfter: true,
          metadata: true,
          createdAt: true,
        },
      }),
      db.creditTransaction.count({ where }),
    ]);

    // Calculate summary for the filtered period
    const summary = await db.creditTransaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
      _count: true,
    });

    const summaryByType: Record<string, { total: number; count: number }> = {};
    for (const item of summary) {
      summaryByType[item.type] = {
        total: Math.abs(item._sum.amount || 0),
        count: item._count,
      };
    }

    return NextResponse.json({
      transactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + transactions.length < total,
      },
      summary: summaryByType,
    });
  } catch (error) {
    console.error('Transactions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

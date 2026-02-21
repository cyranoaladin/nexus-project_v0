export const dynamic = 'force-dynamic';

import { requireRole, isErrorResponse } from '@/lib/guards';
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@/types/enums';
import { 
  getDashboardStats,
  getUserGrowthMetrics,
  getRevenueMetrics,
  getRecentActivities,
  getSystemHealth
} from '@/lib/analytics/metrics';

/**
 * Admin Dashboard API Route (Refactored)
 * 
 * GET /api/admin/dashboard
 * Returns comprehensive platform statistics, metrics, and recent activity.
 * 
 * Business logic extracted to @/lib/analytics/metrics for reusability.
 */
export async function GET(request: NextRequest) {
  try {
    // ─── Authorization ──────────────────────────────────────────────────
    const session = await requireRole(UserRole.ADMIN);
    if (isErrorResponse(session)) return session;

    // ─── Fetch All Metrics (Parallelized) ──────────────────────────────
    const [
      stats,
      userGrowth,
      revenueGrowth,
      recentActivities
    ] = await Promise.all([
      getDashboardStats(),
      getUserGrowthMetrics(6),
      getRevenueMetrics(6),
      getRecentActivities(20)
    ]);

    // ─── System Health Check ────────────────────────────────────────────
    const systemHealth = await getSystemHealth(
      stats.thisMonthSessions,
      stats.currentMonthRevenue,
      stats.activeSubscriptions
    );

    // ─── Build Response ─────────────────────────────────────────────────
    const dashboardData = {
      stats,
      systemHealth,
      recentActivities,
      userGrowth,
      revenueGrowth
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching admin dashboard data:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

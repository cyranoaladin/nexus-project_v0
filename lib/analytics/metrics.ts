/**
 * Analytics Metrics Module
 * 
 * Centralized business logic for calculating platform metrics and KPIs.
 * Extracted from API routes for reusability, testability, and caching.
 * 
 * @module lib/analytics/metrics
 */

import { prisma } from '@/lib/prisma';
import type { Prisma, User } from '@prisma/client';

// ─── Types ──────────────────────────────────────────────────────────────────

type RecentSession = Prisma.SessionBookingGetPayload<{
  include: {
    student: { include: { student: true } };
    coach: { include: { coachProfile: true } };
  };
}>;

type RecentSubscription = Prisma.SubscriptionGetPayload<{
  include: { student: { include: { user: true } } };
}>;

type RecentCreditTransaction = Prisma.CreditTransactionGetPayload<{
  include: { student: { include: { user: true } } };
}>;

export interface UserGrowthMetric {
  month: string;
  count: number;
}

export interface RevenueMetric {
  month: string;
  amount: number;
}

export interface DashboardStats {
  totalUsers: number;
  totalStudents: number;
  totalCoaches: number;
  totalAssistants: number;
  totalParents: number;
  currentMonthRevenue: number;
  currentMonthPaymentRevenue: number;
  currentMonthSubscriptionRevenue: number;
  lastMonthRevenue: number;
  lastMonthPaymentRevenue: number;
  lastMonthSubscriptionRevenue: number;
  revenueGrowthPercent: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalSessions: number;
  thisMonthSessions: number;
  lastMonthSessions: number;
  sessionGrowthPercent: number;
}

export interface SystemHealth {
  database: 'healthy' | 'degraded' | 'down';
  sessions: 'active' | 'inactive';
  payments: 'active' | 'inactive';
  subscriptions: 'active' | 'inactive';
}

// ─── Aggregation Helpers ────────────────────────────────────────────────────

/**
 * Aggregate an array of records with createdAt into monthly counts.
 */
export function aggregateByMonth(items: { createdAt: Date }[]): UserGrowthMetric[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Aggregate an array of payment records into monthly revenue totals.
 */
export function aggregateRevenueByMonth(items: { createdAt: Date; amount: number }[]): RevenueMetric[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item.createdAt.toISOString().slice(0, 7);
    map.set(key, (map.get(key) || 0) + item.amount);
  }
  return Array.from(map.entries())
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ─── User Metrics ───────────────────────────────────────────────────────────

/**
 * Get user growth data for the last N months.
 */
export async function getUserGrowthMetrics(months: number = 6): Promise<UserGrowthMetric[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
  
  const users = await prisma.user.findMany({
    where: {
      createdAt: { gte: startDate }
    },
    select: { createdAt: true }
  });
  
  return aggregateByMonth(users);
}

/**
 * Get user counts by role.
 */
export async function getUserCountsByRole() {
  const [totalUsers, totalStudents, totalCoaches, totalAssistants, totalParents] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.coachProfile.count(),
    prisma.user.count({ where: { role: 'ASSISTANTE' } }),
    prisma.parentProfile.count(),
  ]);
  
  return { totalUsers, totalStudents, totalCoaches, totalAssistants, totalParents };
}

// ─── Revenue Metrics ────────────────────────────────────────────────────────

/**
 * Get revenue growth data for the last N months.
 */
export async function getRevenueMetrics(months: number = 6): Promise<RevenueMetric[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);
  
  const payments = await prisma.payment.findMany({
    where: {
      status: 'COMPLETED',
      createdAt: { gte: startDate }
    },
    select: { createdAt: true, amount: true }
  });
  
  return aggregateRevenueByMonth(payments);
}

/**
 * Get current and last month revenue breakdown.
 */
export async function getRevenueBreakdown() {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const [
    currentMonthPaymentRevenue,
    lastMonthPaymentRevenue,
    currentMonthSubscriptionRevenue,
    lastMonthSubscriptionRevenue
  ] = await Promise.all([
    // Current month payment revenue
    prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: currentMonth }
      },
      _sum: { amount: true }
    }),
    
    // Last month payment revenue
    prisma.payment.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: lastMonth, lt: currentMonth }
      },
      _sum: { amount: true }
    }),
    
    // Current month subscription revenue
    prisma.subscription.aggregate({
      where: {
        status: 'ACTIVE',
        startDate: { gte: currentMonth }
      },
      _sum: { monthlyPrice: true }
    }),
    
    // Last month subscription revenue
    prisma.subscription.aggregate({
      where: {
        status: 'ACTIVE',
        startDate: { gte: lastMonth, lt: currentMonth }
      },
      _sum: { monthlyPrice: true }
    })
  ]);
  
  const currentMonthPaymentAmount = currentMonthPaymentRevenue._sum.amount || 0;
  const currentMonthSubscriptionAmount = currentMonthSubscriptionRevenue._sum.monthlyPrice || 0;
  const currentRevenue = currentMonthPaymentAmount + currentMonthSubscriptionAmount;
  
  const lastMonthPaymentAmount = lastMonthPaymentRevenue._sum.amount || 0;
  const lastMonthSubscriptionAmount = lastMonthSubscriptionRevenue._sum.monthlyPrice || 0;
  const lastRevenue = lastMonthPaymentAmount + lastMonthSubscriptionAmount;
  
  const revenueGrowthPercent = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;
  
  return {
    currentMonthPaymentRevenue: currentMonthPaymentAmount,
    currentMonthSubscriptionRevenue: currentMonthSubscriptionAmount,
    currentRevenue,
    lastMonthPaymentRevenue: lastMonthPaymentAmount,
    lastMonthSubscriptionRevenue: lastMonthSubscriptionAmount,
    lastRevenue,
    revenueGrowthPercent: Math.round(revenueGrowthPercent * 100) / 100
  };
}

// ─── Session Metrics ────────────────────────────────────────────────────────

/**
 * Get session counts for current and last month.
 */
export async function getSessionMetrics() {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const [totalSessions, thisMonthSessions, lastMonthSessions] = await Promise.all([
    prisma.sessionBooking.count(),
    prisma.sessionBooking.count({
      where: { scheduledDate: { gte: currentMonth } }
    }),
    prisma.sessionBooking.count({
      where: { scheduledDate: { gte: lastMonth, lt: currentMonth } }
    })
  ]);
  
  const sessionGrowthPercent = lastMonthSessions > 0 
    ? ((thisMonthSessions - lastMonthSessions) / lastMonthSessions) * 100 
    : 0;
  
  return {
    totalSessions,
    thisMonthSessions,
    lastMonthSessions,
    sessionGrowthPercent: Math.round(sessionGrowthPercent * 100) / 100
  };
}

// ─── Subscription Metrics ───────────────────────────────────────────────────

/**
 * Get subscription counts.
 */
export async function getSubscriptionMetrics() {
  const [totalSubscriptions, activeSubscriptions] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } })
  ]);
  
  return { totalSubscriptions, activeSubscriptions };
}

// ─── Recent Activity ────────────────────────────────────────────────────────

/**
 * Get recent platform activities (sessions, users, subscriptions, credits).
 */
export async function getRecentActivities(limit: number = 20) {
  const [sessions, users, subscriptions, creditTransactions] = await Promise.all([
    // Recent sessions
    prisma.sessionBooking.findMany({
      take: 10,
      orderBy: [{ scheduledDate: 'desc' }, { startTime: 'desc' }],
      include: {
        student: { include: { student: true } },
        coach: { include: { coachProfile: true } }
      }
    }),
    
    // New users
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    }),
    
    // New subscriptions
    prisma.subscription.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { include: { user: true } }
      }
    }),
    
    // Credit transactions
    prisma.creditTransaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { include: { user: true } }
      }
    })
  ]);
  
  // Format and merge all activities
  const formattedActivities = [
    ...sessions.map((activity: RecentSession) => ({
      id: activity.id,
      type: 'session' as const,
      title: `Session ${activity.subject}`,
      description: `${activity.student?.firstName || 'Unknown'} ${activity.student?.lastName || 'Student'} avec ${activity.coach?.coachProfile?.pseudonym || activity.coach?.firstName || 'Unknown Coach'}`,
      time: activity.createdAt,
      status: activity.status,
      studentName: `${activity.student?.firstName || 'Unknown'} ${activity.student?.lastName || 'Student'}`,
      coachName: activity.coach?.coachProfile?.pseudonym || activity.coach?.firstName || 'Unknown Coach',
      subject: activity.subject,
      action: activity.status === 'COMPLETED' ? 'Session terminée' :
        activity.status === 'SCHEDULED' ? 'Session programmée' :
          activity.status === 'CANCELLED' ? 'Session annulée' : 'Session en cours'
    })),
    
    ...users.map((user: User) => ({
      id: user.id,
      type: 'user' as const,
      title: `Nouvel utilisateur: ${user.firstName} ${user.lastName}`,
      description: `${user.firstName} ${user.lastName} (${user.role})`,
      time: user.createdAt,
      status: 'CREATED',
      studentName: `${user.firstName} ${user.lastName}`,
      coachName: '',
      subject: user.role,
      action: 'Utilisateur créé'
    })),
    
    ...subscriptions.map((subscription: RecentSubscription) => ({
      id: subscription.id,
      type: 'subscription' as const,
      title: `Nouvel abonnement: ${subscription.planName}`,
      description: `${subscription.student?.user?.firstName || 'Unknown'} ${subscription.student?.user?.lastName || 'Student'} - ${subscription.planName}`,
      time: subscription.createdAt,
      status: subscription.status,
      studentName: `${subscription.student?.user?.firstName || 'Unknown'} ${subscription.student?.user?.lastName || 'Student'}`,
      coachName: '',
      subject: subscription.planName,
      action: 'Abonnement créé'
    })),
    
    ...creditTransactions.map((transaction: RecentCreditTransaction) => ({
      id: transaction.id,
      type: 'credit' as const,
      title: `Transaction crédit: ${transaction.type}`,
      description: `${transaction.student?.user?.firstName || 'Unknown'} ${transaction.student?.user?.lastName || 'Student'} - ${transaction.amount} crédits`,
      time: transaction.createdAt,
      status: 'COMPLETED',
      studentName: `${transaction.student?.user?.firstName || 'Unknown'} ${transaction.student?.user?.lastName || 'Student'}`,
      coachName: '',
      subject: transaction.type,
      action: `Transaction ${transaction.type}`
    }))
  ];
  
  // Sort by time and limit
  return formattedActivities
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, limit);
}

// ─── System Health ──────────────────────────────────────────────────────────

/**
 * Check system health status.
 */
export async function getSystemHealth(thisMonthSessions: number, currentRevenue: number, activeSubscriptions: number): Promise<SystemHealth> {
  return {
    database: 'healthy', // Could add actual DB ping check
    sessions: thisMonthSessions > 0 ? 'active' : 'inactive',
    payments: currentRevenue > 0 ? 'active' : 'inactive',
    subscriptions: activeSubscriptions > 0 ? 'active' : 'inactive'
  };
}

// ─── Comprehensive Dashboard Stats ─────────────────────────────────────────

/**
 * Get all dashboard statistics in one call.
 * Optimized with parallel queries.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    userCounts,
    revenueBreakdown,
    sessionMetrics,
    subscriptionMetrics
  ] = await Promise.all([
    getUserCountsByRole(),
    getRevenueBreakdown(),
    getSessionMetrics(),
    getSubscriptionMetrics()
  ]);
  
  return {
    ...userCounts,
    currentMonthRevenue: revenueBreakdown.currentRevenue,
    currentMonthPaymentRevenue: revenueBreakdown.currentMonthPaymentRevenue,
    currentMonthSubscriptionRevenue: revenueBreakdown.currentMonthSubscriptionRevenue,
    lastMonthRevenue: revenueBreakdown.lastRevenue,
    lastMonthPaymentRevenue: revenueBreakdown.lastMonthPaymentRevenue,
    lastMonthSubscriptionRevenue: revenueBreakdown.lastMonthSubscriptionRevenue,
    revenueGrowthPercent: revenueBreakdown.revenueGrowthPercent,
    ...subscriptionMetrics,
    ...sessionMetrics
  };
}

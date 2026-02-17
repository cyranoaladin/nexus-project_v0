/**
 * GET /api/admin/directeur/stats
 *
 * Dashboard Directeur — KPI and analytics data.
 * Protected: ADMIN role only.
 *
 * Returns: KPIs, SSN distribution, cohort progression, alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface KPIData {
  totalAssessments: number;
  completedAssessments: number;
  averageSSN: number | null;
  averageGlobalScore: number | null;
  activeStudents: number;
  stageConversionRate: number | null;
}

interface SSNDistribution {
  excellence: number;
  tres_solide: number;
  stable: number;
  fragile: number;
  prioritaire: number;
}

interface AlertEntry {
  studentName: string;
  studentEmail: string;
  ssn: number;
  subject: string;
  assessmentId: string;
}

export async function GET(request: NextRequest) {
  try {
    // RBAC Guard: ADMIN only
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string })?.role;

    if (!session || userRole !== 'ADMIN') {
      console.warn(`[directeur/stats] 403 — unauthorized access attempt, role=${userRole ?? 'none'}, userId=${(session?.user as { id?: string })?.id ?? 'anonymous'}`);
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé. Rôle ADMIN requis.' },
        { status: 403 }
      );
    }

    console.log(`[directeur/stats] Admin access by userId=${(session.user as { id?: string })?.id}`);

    // ─── KPIs ─────────────────────────────────────────────────────────────

    const [totalAssessments, completedAssessments, activeStudents] = await Promise.all([
      prisma.assessment.count(),
      prisma.assessment.count({ where: { status: 'COMPLETED' } }),
      prisma.student.count(),
    ]);

    // Average globalScore
    const avgScoreResult = await prisma.assessment.aggregate({
      _avg: { globalScore: true },
      where: { status: 'COMPLETED', globalScore: { not: null } },
    });

    // Average SSN via raw query
    let averageSSN: number | null = null;
    try {
      const avgSSNRows = await prisma.$queryRawUnsafe<{ avg: number | null }[]>(
        `SELECT AVG("ssn") as avg FROM "assessments" WHERE "ssn" IS NOT NULL`
      );
      averageSSN = avgSSNRows[0]?.avg ? Math.round(avgSSNRows[0].avg * 10) / 10 : null;
    } catch {
      // Table column may not exist yet
    }

    // Stage conversion rate
    let stageConversionRate: number | null = null;
    try {
      const totalReservations = await prisma.stageReservation.count();
      const confirmedReservations = await prisma.stageReservation.count({
        where: { status: { in: ['CONFIRMED', 'PAID'] } },
      });
      stageConversionRate = totalReservations > 0
        ? Math.round((confirmedReservations / totalReservations) * 100)
        : null;
    } catch {
      // Graceful fallback
    }

    const kpis: KPIData = {
      totalAssessments,
      completedAssessments,
      averageSSN,
      averageGlobalScore: avgScoreResult._avg.globalScore
        ? Math.round(avgScoreResult._avg.globalScore * 10) / 10
        : null,
      activeStudents,
      stageConversionRate,
    };

    // ─── SSN Distribution ─────────────────────────────────────────────────

    const distribution: SSNDistribution = {
      excellence: 0,
      tres_solide: 0,
      stable: 0,
      fragile: 0,
      prioritaire: 0,
    };

    try {
      const ssnRows = await prisma.$queryRawUnsafe<{ ssn: number }[]>(
        `SELECT "ssn" FROM "assessments" WHERE "ssn" IS NOT NULL`
      );
      for (const row of ssnRows) {
        if (row.ssn >= 85) distribution.excellence++;
        else if (row.ssn >= 70) distribution.tres_solide++;
        else if (row.ssn >= 55) distribution.stable++;
        else if (row.ssn >= 40) distribution.fragile++;
        else distribution.prioritaire++;
      }
    } catch {
      // Graceful fallback
    }

    // ─── SSN by Subject (for radar) ───────────────────────────────────────

    let subjectAverages: { subject: string; avgSSN: number }[] = [];
    try {
      subjectAverages = await prisma.$queryRawUnsafe<{ subject: string; avgSSN: number }[]>(
        `SELECT "subject", AVG("ssn") as "avgSSN" FROM "assessments" WHERE "ssn" IS NOT NULL GROUP BY "subject"`
      );
      subjectAverages = subjectAverages.map((s) => ({
        subject: s.subject,
        avgSSN: Math.round(Number(s.avgSSN) * 10) / 10,
      }));
    } catch {
      // Graceful fallback
    }

    // ─── Pedagogical Alerts (SSN < 40 = prioritaire) ──────────────────────

    let alerts: AlertEntry[] = [];
    try {
      alerts = await prisma.$queryRawUnsafe<AlertEntry[]>(
        `SELECT "studentName", "studentEmail", "ssn", "subject", "id" as "assessmentId"
         FROM "assessments"
         WHERE "ssn" IS NOT NULL AND "ssn" < 40
         ORDER BY "ssn" ASC
         LIMIT 20`
      );
    } catch {
      // Graceful fallback
    }

    // ─── Monthly progression (last 6 months) ─────────────────────────────

    let monthlyProgression: { month: string; avgSSN: number; count: number }[] = [];
    try {
      monthlyProgression = await prisma.$queryRawUnsafe<{ month: string; avgSSN: number; count: number }[]>(
        `SELECT
           TO_CHAR("createdAt", 'YYYY-MM') as month,
           AVG("ssn") as "avgSSN",
           COUNT(*)::int as count
         FROM "assessments"
         WHERE "ssn" IS NOT NULL AND "createdAt" >= NOW() - INTERVAL '6 months'
         GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
         ORDER BY month ASC`
      );
      monthlyProgression = monthlyProgression.map((m) => ({
        month: m.month,
        avgSSN: Math.round(Number(m.avgSSN) * 10) / 10,
        count: Number(m.count),
      }));
    } catch {
      // Graceful fallback
    }

    return NextResponse.json({
      success: true,
      kpis,
      distribution,
      subjectAverages,
      alerts,
      monthlyProgression,
    });
  } catch (error) {
    console.error('[directeur/stats] Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

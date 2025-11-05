import { cache } from "react";

import { prisma } from "@/lib/prisma";

export type DashboardSearchParams = Record<string, string | string[] | undefined>;

type ResolutionSource = "query" | "env" | "profile" | "none";

interface ResolutionResult {
  studentId: string | null;
  source: ResolutionSource;
}

function pickFirstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    const [first] = value;
    return typeof first === "string" && first.trim().length > 0 ? first.trim() : null;
  }
  return null;
}

async function fetchDashboardStudentId(userId: string): Promise<string | null> {
  if (!userId) {
    return null;
  }
  const record = await prisma.student.findUnique({
    where: { userId },
    select: { dashboardStudentId: true },
  });
  return record?.dashboardStudentId ?? null;
}

/**
 * Resolve the dashboard student identifier used when calling the FastAPI backend.
 *
 * Precedence order:
 *   1. Explicit `student_id` query string parameter.
 *   2. NEXT_PUBLIC_DASHBOARD_STUDENT_ID environment override.
 *   3. Prisma linkage (`student.dashboardStudentId`) for the authenticated user (ELEVE role).
 */
export const resolveDashboardStudentId = cache(async (
  sessionUserId: string,
  role: string,
  searchParams: DashboardSearchParams,
): Promise<ResolutionResult> => {
  const fromQuery = pickFirstParam(searchParams?.student_id);
  if (fromQuery) {
    return { studentId: fromQuery, source: "query" };
  }

  const fromEnv = process.env.NEXT_PUBLIC_DASHBOARD_STUDENT_ID;
  if (fromEnv && fromEnv.length > 0) {
    return { studentId: fromEnv, source: "env" };
  }

  if (role?.toUpperCase() === "ELEVE") {
    const linkedId = await fetchDashboardStudentId(sessionUserId);
    if (linkedId) {
      return { studentId: linkedId, source: "profile" };
    }
  }

  return { studentId: null, source: "none" };
});

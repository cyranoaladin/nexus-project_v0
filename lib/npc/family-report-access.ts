import 'server-only';

import { prisma } from '@/lib/prisma';
import { familyReportAccess, type FamilyReportAudience } from '@/lib/npc/report-visibility';

/**
 * Charge un diagnostic NPC complet pour une famille (élève ou parent).
 * Conditions cumulatives : rapport visible en entier par la famille (COACH_AND_STUDENT),
 * copie terminée, lecteur = l'élève concerné ou l'un de ses parents.
 * Tout autre cas renvoie null, sans distinguer « absent » et « interdit ».
 * Les notes internes du coach ne sont jamais renvoyées.
 */
export async function loadFamilyReport({
  reportId,
  audience,
  userId,
}: {
  reportId: string;
  audience: FamilyReportAudience;
  userId: string;
}) {
  const report = await prisma.pedagogicalReport.findUnique({
    where: { id: reportId },
    include: {
      copySubmission: {
        select: {
          id: true,
          title: true,
          status: true,
          studentId: true,
          student: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
      competenceMatrix: true,
      remediationRoadmap: { include: { tasks: true } },
    },
  });

  if (!report || !report.copySubmission) return null;
  if (familyReportAccess(audience, report.visibility) !== 'full') return null;
  if (report.copySubmission.status !== 'COMPLETED') return null;

  const studentId = report.copySubmission.studentId;
  const lecteurAutorise =
    audience === 'parent'
      ? await prisma.parentProfile.findFirst({ where: { userId, children: { some: { id: studentId } } }, select: { id: true } })
      : await prisma.student.findFirst({ where: { id: studentId, userId }, select: { id: true } });
  if (!lecteurAutorise) return null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { coachNotes, rawAiOutput, ...visibleParLaFamille } = report as typeof report & { rawAiOutput?: unknown };
  return visibleParLaFamille;
}

export type FamilyPedagogicalReport = NonNullable<Awaited<ReturnType<typeof loadFamilyReport>>>;

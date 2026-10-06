/** Aides serveur des pages enseignant : ce que cet enseignant enseigne, et les messages d'erreur. */
import type { Subject } from '@prisma/client';

import { ACTIVITIES, POO_ACTIVITY_SLUG, type ActivityDef } from '@/lib/espace/catalog';
import type { EspaceActor } from '@/lib/espace/guards';
import { SUBJECT_LABELS } from '@/lib/espace/overview';
import { prisma } from '@/lib/prisma';

export interface TeachingPair {
  groupId: string;
  groupName: string;
  subject: Subject;
  subjectLabel: string;
}

export interface TeacherScope {
  pairs: TeachingPair[];
  subjects: Subject[];
  activities: ActivityDef[];
}

/** COACH : ses affectations. ADMIN : tous les couples groupe × matière où des élèves sont inscrits. */
export async function getTeacherScope(actor: EspaceActor): Promise<TeacherScope> {
  const rows =
    actor.role === 'ADMIN'
      ? await prisma.espaceEnrollment.findMany({ distinct: ['groupId', 'subject'], select: { groupId: true, subject: true, group: { select: { name: true } } } })
      : await prisma.espaceTeacherAssignment.findMany({ where: { teacherId: actor.id }, select: { groupId: true, subject: true, group: { select: { name: true } } } });

  const pairs = rows
    .map((r) => ({ groupId: r.groupId, groupName: r.group.name, subject: r.subject, subjectLabel: SUBJECT_LABELS[r.subject] }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName, 'fr') || a.subjectLabel.localeCompare(b.subjectLabel, 'fr'));
  const subjects = [...new Set(pairs.map((p) => p.subject))];
  return { pairs, subjects, activities: ACTIVITIES.filter((a) => subjects.includes(a.subject)) };
}

/** Activité affichée : le paramètre s'il est enseigné, sinon le TP POO si disponible, sinon la première. */
export function pickActivity(scope: TeacherScope, requested: string | undefined): ActivityDef | null {
  return (
    scope.activities.find((a) => a.slug === requested) ??
    scope.activities.find((a) => a.slug === POO_ACTIVITY_SLUG) ??
    scope.activities[0] ??
    null
  );
}

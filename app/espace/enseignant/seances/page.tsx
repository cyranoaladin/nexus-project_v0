import type { Metadata } from 'next';

import { SessionManager } from '@/components/espace/teacher/SessionManager';
import { requireActorForPage } from '@/lib/espace/page-guard';
import { SUBJECT_LABELS } from '@/lib/espace/overview';
import { listSessionsForTeacher } from '@/lib/espace/sessions';
import { getOrganizationTimezone } from '@/lib/timezone';

import { getTeacherScope } from '../_server';

export const metadata: Metadata = { title: 'Séances' };
export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const actor = await requireActorForPage(['COACH', 'ADMIN'], '/espace/enseignant/seances');
  const [scope, sessions] = await Promise.all([getTeacherScope(actor), listSessionsForTeacher(actor)]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-50">Séances</h1>
      <p className="max-w-prose text-sm text-neutral-300">
        Une séance publiée apparaît automatiquement chez les élèves inscrits à cette matière dans le groupe : ils n’ont aucun code à saisir.
      </p>
      <SessionManager
        timezone={getOrganizationTimezone()}
        pairs={scope.pairs.map((p) => ({ groupId: p.groupId, groupName: p.groupName, subject: p.subject, subjectLabel: p.subjectLabel }))}
        activities={scope.activities.map((a) => ({ slug: a.slug, title: a.title, subject: a.subject }))}
        sessions={sessions.map((s) => ({
          id: s.id,
          title: s.title,
          subjectLabel: SUBJECT_LABELS[s.subject],
          groupName: s.group.name,
          activityTitle: s.activity.title,
          status: s.status,
          scheduledAt: s.scheduledAt?.toISOString() ?? null,
          participants: s._count.participants,
        }))}
      />
    </div>
  );
}

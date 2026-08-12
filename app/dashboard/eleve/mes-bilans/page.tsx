import Link from 'next/link';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { bilanPackSubjectLabel } from '@/lib/bilans/catalog/subjects';
import { bilanPackLevelLabel } from '@/lib/bilans/render/stage-label';
import { prisma } from '@/lib/prisma';

/**
 * « Mes bilans » — consultation durable côté élève : l'historique de ses
 * bilans de positionnement publiés, à lire en ligne ou à télécharger en PDF.
 * Le document interne Nexus n'apparaît jamais ici : la route de consultation
 * ne sert à un élève que sa propre audience.
 */

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Tunis' }).format(date);
}

export default async function StudentBilansPage() {
  const session = await auth();
  if (session?.user?.id === undefined || session.user.role !== 'ELEVE') notFound();

  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (student === null) notFound();

  const attempts = await prisma.canonicalAssessmentAttempt.findMany({
    where: {
      studentId: student.id,
      status: 'PUBLISHED',
      reportArtifacts: { some: { status: 'PUBLISHED', currentPublishedRevisionId: { not: null } } },
    },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, assessmentPackId: true, gradeLevel: true, subject: true, submittedAt: true },
  });

  return (
    <main className="luxury min-h-screen bg-lux-paper px-4 py-10 text-lux-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-lux-line pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lux-gold-deep">Mes bilans</p>
          <h1 className="mt-3 font-fraunces text-3xl font-semibold text-lux-ink">Tes bilans de positionnement</h1>
          <p className="mt-3 text-sm leading-6 text-lux-slate">
            Chaque bilan est une carte, pas une note : il te dit où appuyer l’effort. Tu peux le relire en ligne ou le télécharger.
          </p>
        </header>

        {attempts.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-lux-line bg-lux-white p-8 text-sm text-lux-slate">
            Aucun bilan publié pour l’instant. Ton prochain bilan apparaîtra ici dès sa diffusion.
          </section>
        ) : (
          <ol className="mt-8 space-y-4">
            {attempts.map((attempt) => {
              const packLabel = /^entree-([a-z]+)-/.exec(attempt.assessmentPackId) === null
                ? attempt.assessmentPackId
                : `${bilanPackLevelLabel(attempt.gradeLevel)} · ${(() => { try { return bilanPackSubjectLabel(attempt.subject === 'MATHEMATIQUES' ? 'MATHS' : attempt.subject); } catch { return attempt.subject; } })()}`;
              return (
                <li key={attempt.id} className="rounded-2xl border border-lux-line bg-lux-white p-5 lux-shadow">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-fraunces text-lg font-semibold text-lux-ink">Bilan de positionnement — {packLabel}</h2>
                      {attempt.submittedAt !== null && (
                        <p className="mt-1 text-xs text-lux-slate">Passé le {dateLabel(attempt.submittedAt)}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/api/bilans/attempts/${encodeURIComponent(attempt.id)}/report?format=html`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-lux-ink px-3 py-2 text-sm font-semibold text-white"
                      >
                        Lire mon bilan
                      </a>
                      <a
                        href={`/api/bilans/attempts/${encodeURIComponent(attempt.id)}/report?format=pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-lux-gold-deep px-3 py-2 text-sm font-semibold text-lux-gold-deep"
                      >
                        Télécharger le PDF
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <Link href="/dashboard/eleve" className="mt-8 inline-block text-sm font-semibold text-lux-gold-deep underline">
          Retour à mon tableau de bord
        </Link>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { PaperEntryGrid } from '@/components/bilans/PaperEntryGrid';
import { listEnabledPacks } from '@/lib/bilans/api/pack-access';
import { bilanPackSubjectLabel } from '@/lib/bilans/catalog/subjects';
import { bilanPackLevelLabel } from '@/lib/bilans/render/stage-label';
import { isStaffRole } from '@/lib/bilans/saisie-papier/access';
import { projectPaperEntryItems } from '@/lib/bilans/saisie-papier/projection';
import { prisma } from '@/lib/prisma';

import { PaperEntryFamilyForm } from './family-form';

/**
 * Saisie papier — écran staff.
 *
 * Un parent ou un élève qui atteindrait cette URL reçoit un 404 : la surface
 * ne se révèle pas.
 *
 * NOTE sur ADMIN. Le garde accepte ASSISTANTE et ADMIN, et la route d'API les
 * accepte tous deux — c'est l'énoncé d'autorisation correct. En pratique,
 * `middleware.ts` renvoie tout ADMIN de `/dashboard/assistante/*` vers
 * `/dashboard/admin` (`rolePrefixMap`), donc **cet écran n'est ouvrable que
 * par une assistante** ; un ADMIN ne peut passer que par l'API. C'est une
 * convention de la plateforme, partagée par toutes les pages assistante — la
 * lever se déciderait pour l'ensemble du tableau de bord, pas au détour de
 * cette fonctionnalité.
 *
 * Le pack et ses items sont résolus côté serveur ; le composant client ne
 * reçoit que la projection sans corrigé (voir `projection.ts`).
 */

export const dynamic = 'force-dynamic';

type SearchParams = Readonly<{ studentId?: string; packSlug?: string; q?: string }>;

function packLabel(level: string, subject: string): string {
  return `${bilanPackLevelLabel(level)} · ${bilanPackSubjectLabel(subject)}`;
}

export default async function SaisiePapierPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const session = await auth();
  if (session?.user?.id === undefined || !isStaffRole(session.user.role)) notFound();

  const { studentId = '', packSlug = '', q = '' } = await searchParams;
  const search = q.trim();

  const students = await prisma.student.findMany({
    where: search.length > 0
      ? {
        OR: [
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { parent: { user: { email: { contains: search, mode: 'insensitive' } } } },
        ],
      }
      : undefined,
    select: {
      id: true,
      gradeLevel: true,
      user: { select: { firstName: true, lastName: true } },
      parent: { select: { user: { select: { email: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  const selected = studentId.trim().length > 0
    ? students.find((student) => student.id === studentId)
      ?? await prisma.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          gradeLevel: true,
          user: { select: { firstName: true, lastName: true } },
          parent: { select: { user: { select: { email: true } } } },
        },
      })
    : null;

  const packsForStudent = selected === null
    ? []
    : listEnabledPacks().filter(({ pack }) => pack.level === selected.gradeLevel);

  const chosenPack = packSlug.trim().length > 0
    ? packsForStudent.find(({ pack }) => pack.slug === packSlug) ?? null
    : null;

  const studentName = selected === null
    ? ''
    : `${selected.user.firstName ?? ''} ${selected.user.lastName ?? ''}`.trim() || 'Élève';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-white/10 pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Saisie papier</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-white sm:text-4xl">
            Saisir un bilan passé sur copie
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Pour les élèves ayant déjà composé sur papier. La saisie produit le même bilan qu’une passation en
            ligne — même barème, même profil — et reste identifiée comme une transcription faite par le staff.
          </p>
          <Link href="/dashboard/assistante/bilans" className="mt-4 inline-block text-sm text-amber-200 underline">
            ← Revenir aux bilans en attente de diffusion
          </Link>
        </header>

        {chosenPack !== null && selected !== null ? (
          <>
            <Link
              href={`/dashboard/assistante/bilans/saisie-papier?studentId=${encodeURIComponent(selected.id)}`}
              className="mt-6 inline-block text-sm text-amber-200 underline"
            >
              ← Changer de matière
            </Link>
            <PaperEntryGrid
              studentId={selected.id}
              studentName={studentName}
              packSlug={chosenPack.pack.slug}
              packTitle={packLabel(chosenPack.pack.level, chosenPack.pack.subject)}
              items={projectPaperEntryItems(chosenPack)}
            />
          </>
        ) : selected !== null ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-lg font-semibold text-white">
              {studentName} · {bilanPackLevelLabel(selected.gradeLevel)}
            </h2>
            <p className="mt-1 text-sm text-slate-400">Choisissez la matière de la copie.</p>
            {packsForStudent.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-5 text-sm text-amber-100">
                Aucun questionnaire validé n’est ouvert pour ce niveau. Rien ne peut être saisi tant qu’un pack n’est
                pas activé.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {packsForStudent.map(({ pack }) => (
                  <Link
                    key={pack.slug}
                    href={`/dashboard/assistante/bilans/saisie-papier?studentId=${encodeURIComponent(selected.id)}&packSlug=${encodeURIComponent(pack.slug)}`}
                    className="block rounded-2xl bg-slate-900 px-5 py-4 font-semibold text-white ring-1 ring-white/10"
                  >
                    {packLabel(pack.level, pack.subject)}
                  </Link>
                ))}
              </div>
            )}
            <Link href="/dashboard/assistante/bilans/saisie-papier" className="mt-5 inline-block text-sm text-amber-200 underline">
              ← Changer d’élève
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-lg font-semibold text-white">1. Choisir l’élève</h2>
              <form method="GET" className="mt-4 flex flex-wrap gap-3">
                <input
                  type="search"
                  name="q"
                  defaultValue={search}
                  placeholder="Nom de l’élève ou adresse du parent"
                  className="min-w-64 flex-1 rounded-xl border border-white/15 bg-slate-950 px-4 py-2.5 text-sm text-white"
                />
                <button type="submit" className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-100">
                  Rechercher
                </button>
              </form>

              {students.length === 0 ? (
                <p className="mt-5 text-sm text-slate-400">Aucun élève ne correspond. Créez le foyer ci-dessous.</p>
              ) : (
                <ul className="mt-5 divide-y divide-white/10">
                  {students.map((student) => (
                    <li key={student.id}>
                      <Link
                        href={`/dashboard/assistante/bilans/saisie-papier?studentId=${encodeURIComponent(student.id)}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
                      >
                        <span className="font-semibold text-white">
                          {`${student.user.firstName ?? ''} ${student.user.lastName ?? ''}`.trim() || 'Élève'}
                        </span>
                        <span className="text-slate-400">
                          {bilanPackLevelLabel(student.gradeLevel)} · {student.parent?.user.email ?? '—'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-lg font-semibold text-white">2. Ou créer le foyer</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                Le parent reçoit un lien d’activation et choisit lui-même son mot de passe. Personne ne le fixe à sa
                place.
              </p>
              <PaperEntryFamilyForm />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

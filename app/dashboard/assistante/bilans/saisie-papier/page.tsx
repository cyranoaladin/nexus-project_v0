import Link from 'next/link';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { PaperEntryGrid } from '@/components/bilans/PaperEntryGrid';
import { PaperEntryStudentSearch } from '@/components/bilans/PaperEntryStudentSearch';
import { PaperEntryWorkflowSteps } from '@/components/bilans/PaperEntryWorkflowSteps';
import { listEnabledPacks } from '@/lib/bilans/api/pack-access';
import { bilanPackSubjectLabel } from '@/lib/bilans/catalog/subjects';
import { bilanPackLevelLabel } from '@/lib/bilans/render/stage-label';
import { isStaffRole } from '@/lib/bilans/saisie-papier/access';
import { projectPaperEntryItems } from '@/lib/bilans/saisie-papier/projection';
import {
  isVisiblePaperEntryHousehold,
  paperEntryVisibleStudentWhere,
} from '@/lib/bilans/saisie-papier/test-account-filter';
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

type SearchParams = Readonly<{
  studentId?: string;
  packSlug?: string;
  q?: string;
  flow?: string;
  parentId?: string;
}>;

function packLabel(level: string, subject: string): string {
  return `${bilanPackLevelLabel(level)} · ${bilanPackSubjectLabel(subject)}`;
}

export default async function SaisiePapierPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const session = await auth();
  if (session?.user?.id === undefined || !isStaffRole(session.user.role)) notFound();

  const { studentId = '', packSlug = '', q = '', flow = '', parentId = '' } = await searchParams;
  const search = q.trim();
  const searchTerms = search.split(/\s+/).filter(Boolean).slice(0, 5);
  const visibilityWhere = paperEntryVisibleStudentWhere();
  const childStep = search.length > 0 || flow === 'create';

  const studentRows = search.length > 0
    ? await prisma.student.findMany({
      where: {
        AND: [
          visibilityWhere,
          ...searchTerms.map((term) => ({
            OR: [
              { user: { firstName: { contains: term, mode: 'insensitive' as const } } },
              { user: { lastName: { contains: term, mode: 'insensitive' as const } } },
              { parent: { user: { email: { contains: term, mode: 'insensitive' as const } } } },
              { parent: { user: { phone: { contains: term } } } },
              { parent: { user: { phoneNormalized: { contains: term } } } },
            ],
          })),
        ],
      },
      select: {
        id: true,
        gradeLevel: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        parent: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    })
    : [];
  const students = studentRows.filter((student) => isVisiblePaperEntryHousehold({
    studentEmail: student.user.email,
    parentEmail: student.parent.user.email,
  }));

  const selectedCandidate = studentId.trim().length > 0
    ? students.find((student) => student.id === studentId)
      ?? await prisma.student.findFirst({
        where: { AND: [{ id: studentId }, visibilityWhere] },
        select: {
          id: true,
          gradeLevel: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          parent: { select: { user: { select: { email: true } } } },
        },
      })
    : null;
  const selected = selectedCandidate !== null && selectedCandidate !== undefined
    && isVisiblePaperEntryHousehold({
      studentEmail: selectedCandidate.user.email,
      parentEmail: selectedCandidate.parent.user.email,
    })
    ? selectedCandidate
    : null;

  const targetParent = parentId.trim().length > 0
    ? await prisma.user.findFirst({
      where: {
        id: parentId,
        role: 'PARENT',
        mergedIntoUserId: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
    })
    : null;

  const existingParent = targetParent && isVisiblePaperEntryHousehold({
    studentEmail: null,
    parentEmail: targetParent.email,
  }) ? {
    parentUserId: targetParent.id,
    parentFirstName: targetParent.firstName ?? '',
    parentLastName: targetParent.lastName ?? '',
    parentPhone: targetParent.phone ?? '',
    parentEmail: targetParent.email,
  } : undefined;

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

        {chosenPack === null && (
          <PaperEntryWorkflowSteps
            currentStep={selected !== null ? 3 : childStep ? 2 : 1}
            stepHrefs={{
              1: '/dashboard/assistante/bilans/saisie-papier',
              ...(selected !== null
                ? { 2: search.length > 0
                  ? `/dashboard/assistante/bilans/saisie-papier?q=${encodeURIComponent(search)}`
                  : '/dashboard/assistante/bilans/saisie-papier' }
                : {}),
            }}
          />
        )}

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
              childSelectionHref={search.length > 0
                ? `/dashboard/assistante/bilans/saisie-papier?q=${encodeURIComponent(search)}`
                : '/dashboard/assistante/bilans/saisie-papier'}
            />
          </>
        ) : selected !== null ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Étape 3</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Choisir la matière</h2>
            <p className="mt-1 text-sm text-slate-300">{studentName} · {bilanPackLevelLabel(selected.gradeLevel)}</p>
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
                    href={`/dashboard/assistante/bilans/saisie-papier?studentId=${encodeURIComponent(selected.id)}&packSlug=${encodeURIComponent(pack.slug)}${search.length > 0 ? `&q=${encodeURIComponent(search)}` : ''}`}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-slate-900 px-5 py-4 font-semibold text-white ring-1 ring-white/10"
                  >
                    <span>{packLabel(pack.level, pack.subject)}</span>
                    <span className="text-sm text-amber-200">Choisir cette matière →</span>
                  </Link>
                ))}
              </div>
            )}
            <Link
              href={search.length > 0
                ? `/dashboard/assistante/bilans/saisie-papier?q=${encodeURIComponent(search)}`
                : '/dashboard/assistante/bilans/saisie-papier'}
              className="mt-5 inline-block text-sm text-amber-200 underline"
            >
              ← Revenir au choix de l’enfant
            </Link>
          </section>
        ) : flow === 'create' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Étape 2</p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {existingParent ? `Ajouter un enfant au foyer de ${existingParent.parentFirstName} ${existingParent.parentLastName}` : 'Créer le foyer et ajouter l’enfant'}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              {existingParent
                ? 'Le nouvel enfant sera rattaché à ce foyer. Vous pourrez ensuite choisir la matière et saisir sa copie.'
                : 'Le téléphone parent est obligatoire. L\'e-mail peut être ajouté plus tard : le parent recevra alors son lien d\'activation et choisira lui-même son mot de passe.'}
            </p>
            <PaperEntryFamilyForm existingParent={existingParent} />
            <Link
              href={search.length > 0 ? `/dashboard/assistante/bilans/saisie-papier?q=${encodeURIComponent(search)}` : '/dashboard/assistante/bilans/saisie-papier'}
              className="mt-6 inline-block text-sm text-amber-200 underline"
            >
              ← Annuler et revenir {search.length > 0 ? 'à la recherche' : 'au choix du foyer'}
            </Link>
          </section>
        ) : childStep ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Étape 2</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Ajouter ou sélectionner l’enfant</h2>
            <PaperEntryStudentSearch initialQuery={search} />

            {search.length > 0 && students.length === 0 ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm text-slate-400">Aucun élève ne correspond. Vous pouvez créer un nouveau foyer.</p>
                <Link
                  href={`/dashboard/assistante/bilans/saisie-papier?flow=create&q=${encodeURIComponent(search)}`}
                  className="inline-block rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950"
                >
                  Créer un foyer et ajouter l’enfant
                </Link>
              </div>
            ) : search.length > 0 ? (
              <ul className="mt-5 divide-y divide-white/10">
                {students.map((student) => {
                  const parentUser = student.parent?.user;
                  const parentName = `${parentUser?.firstName ?? ''} ${parentUser?.lastName ?? ''}`.trim() || 'Parent';
                  return (
                    <li key={student.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <div>
                          <span className="font-semibold text-white">
                            {`${student.user.firstName ?? ''} ${student.user.lastName ?? ''}`.trim() || 'Élève'}
                          </span>
                          <span className="ml-3 text-slate-400">
                            {bilanPackLevelLabel(student.gradeLevel)} · {parentName} ({parentUser?.phone ?? parentUser?.email ?? '—'})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {parentUser?.id && (
                            <Link
                              href={`/dashboard/assistante/bilans/saisie-papier?flow=create&parentId=${encodeURIComponent(parentUser.id)}&q=${encodeURIComponent(search)}`}
                              className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-300/20"
                            >
                              + Ajouter un enfant à ce foyer
                            </Link>
                          )}
                          <Link
                            href={`/dashboard/assistante/bilans/saisie-papier?studentId=${encodeURIComponent(student.id)}&q=${encodeURIComponent(search)}`}
                            className="rounded-xl border border-amber-300 px-4 py-2 font-semibold text-amber-100"
                          >
                            Choisir cet enfant
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link href="/dashboard/assistante/bilans/saisie-papier" className="text-sm text-amber-200 underline">
                ← Revenir au choix du foyer
              </Link>
              <span className="text-slate-600">|</span>
              <Link
                href={`/dashboard/assistante/bilans/saisie-papier?flow=create${search.length > 0 ? `&q=${encodeURIComponent(search)}` : ''}`}
                className="text-sm text-slate-300 hover:text-white"
              >
                Créer un autre foyer
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.06] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">Étape 1</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Créer ou sélectionner le foyer</h2>
            <p className="mt-1 text-sm text-slate-400">
              Recherchez par nom d’élève, téléphone ou e-mail parent, ou créez un nouveau foyer.
            </p>
            <PaperEntryStudentSearch initialQuery={search} />
            <Link
              href="/dashboard/assistante/bilans/saisie-papier?flow=create"
              className="mt-5 inline-block rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950"
            >
              Créer un nouveau foyer
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

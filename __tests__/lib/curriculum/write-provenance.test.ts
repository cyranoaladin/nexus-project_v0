/**
 * Provenance des écritures d'inscription.
 *
 * L'ancien contrat acceptait `(source, actor?)` indépendamment : on pouvait
 * exprimer « ADMIN sans auteur » ou « SEED avec auteur », deux états qui ne
 * correspondent à rien. Le type discriminé rend ces combinaisons
 * inexprimables ; ces tests vérifient qu'elles sont aussi refusées à
 * l'exécution, pour un appelant non typé.
 */

import { prisma } from '@/lib/prisma';
import {
  AcademicEnrollmentError,
  setStudentChosenCourses,
  type EnrollmentWriteProvenance,
} from '@/lib/curriculum/enrollment';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    studentAcademicEnrollment: { findMany: jest.fn(async () => []), deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        studentAcademicEnrollment: { deleteMany: jest.fn(), createMany: jest.fn() },
      }),
    ),
  },
}));

const TERMINALE = {
  gradeLevel: 'TERMINALE',
  academicTrack: 'EDS_GENERALE',
  stmgPathway: null,
};
const COURSES = ['eds-maths-terminale'];

/** Contourne le typage comme le ferait un appelant JavaScript ou une désérialisation. */
function untyped(value: unknown): EnrollmentWriteProvenance {
  return value as EnrollmentWriteProvenance;
}

beforeEach(() => jest.clearAllMocks());

describe('provenances acceptées', () => {
  it.each([
    ['ADMIN', { source: 'ADMIN', verifiedById: 'user-1' }],
    ['ASSISTANTE', { source: 'ASSISTANTE', verifiedById: 'user-2' }],
    ['SEED', { source: 'SEED' }],
  ])('accepte %s correctement formée', async (_label, provenance) => {
    await expect(
      setStudentChosenCourses('s1', TERMINALE, COURSES, provenance as EnrollmentWriteProvenance),
    ).resolves.toBeDefined();
  });

  it('horodate et attribue une saisie humaine, jamais un seed', async () => {
    const captured: Record<string, unknown>[] = [];
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          studentAcademicEnrollment: {
            deleteMany: jest.fn(),
            createMany: jest.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
              captured.push(...data);
            }),
          },
        }),
    );

    await setStudentChosenCourses('s1', TERMINALE, COURSES, {
      source: 'ADMIN',
      verifiedById: 'user-1',
    });
    expect(captured[0]).toMatchObject({ source: 'ADMIN', verifiedById: 'user-1' });
    expect(captured[0].verifiedAt).toBeInstanceOf(Date);

    captured.length = 0;
    await setStudentChosenCourses('s1', TERMINALE, COURSES, { source: 'SEED' });
    expect(captured[0]).toMatchObject({ source: 'SEED' });
    expect(captured[0].verifiedById).toBeUndefined();
    expect(captured[0].verifiedAt).toBeUndefined();
  });
});

describe('provenances refusées', () => {
  it('RUNTIME_BACKFILL_WRITE_PATHS=0 : refuse la provenance de reprise historique', async () => {
    // Cette provenance n'appartient qu'au SQL de migration. Si un chemin
    // applicatif pouvait la produire, la barrière de migration comparerait son
    // ensemble attendu à des lignes qu'aucune reprise n'a écrites.
    await expect(
      setStudentChosenCourses(
        's1',
        TERMINALE,
        COURSES,
        untyped({ source: 'BACKFILL_LEGACY_SPECIALTIES' }),
      ),
    ).rejects.toBeInstanceOf(AcademicEnrollmentError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse une saisie ADMIN sans auteur', async () => {
    await expect(
      setStudentChosenCourses('s1', TERMINALE, COURSES, untyped({ source: 'ADMIN' })),
    ).rejects.toThrow(/doit désigner son auteur/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse une saisie ASSISTANTE sans auteur', async () => {
    await expect(
      setStudentChosenCourses('s1', TERMINALE, COURSES, untyped({ source: 'ASSISTANTE' })),
    ).rejects.toThrow(/doit désigner son auteur/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse un SEED prétendant avoir un auteur', async () => {
    await expect(
      setStudentChosenCourses(
        's1',
        TERMINALE,
        COURSES,
        untyped({ source: 'SEED', verifiedById: 'user-1' }),
      ),
    ).rejects.toThrow(/pas d'auteur humain/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('WRITE_PROVENANCE_AMBIGUITY=0 au niveau du type', () => {
  it('rend les combinaisons absurdes inexprimables', () => {
    // @ts-expect-error ADMIN sans verifiedById n'est pas assignable.
    const a: EnrollmentWriteProvenance = { source: 'ADMIN' };
    // @ts-expect-error SEED avec verifiedById n'est pas assignable.
    const b: EnrollmentWriteProvenance = { source: 'SEED', verifiedById: 'user-1' };
    // @ts-expect-error La provenance de reprise n'appartient pas au contrat runtime.
    const c: EnrollmentWriteProvenance = { source: 'BACKFILL_LEGACY_SPECIALTIES' };
    expect([a, b, c]).toHaveLength(3);
  });
});

/**
 * Commande atomique et révisionnée de la fiche scolaire d'un élève.
 *
 * `updateStudentAcademicProfile` doit changer, en une seule transaction :
 * l'identité scolaire (niveau, voie, voie STMG, statut de scolarisation) ET
 * les enseignements choisis (`StudentAcademicEnrollment`) ET incrémenter
 * `Student.academicRevision` — avec un contrôle de concurrence optimiste
 * (CAS) sur cette révision. Une révision périmée doit échouer avec
 * `ACADEMIC_REVISION_CONFLICT` SANS RIEN écrire.
 */

import {
  AcademicRevisionConflictError,
  updateStudentAcademicProfile,
} from '@/lib/curriculum/student-academic-profile';
import { AcademicEnrollmentError } from '@/lib/curriculum/enrollment';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));

interface FakeStudentRow {
  id: string;
  gradeLevel: string;
  academicTrack: string;
  stmgPathway: string | null;
  schoolingStatus: string | null;
  academicRevision: number;
}

interface FakeEnrollmentRow {
  studentId: string;
  courseKey: string;
  kind: string;
  source: string;
  verifiedById?: string;
  verifiedAt?: Date;
}

/**
 * Simule fidèlement la sémantique transactionnelle réelle : les écritures
 * n'atteignent l'état "committed" que si le callback résout ; une exception
 * annule tout (comme un vrai `prisma.$transaction`). Sans ceci, un test
 * unitaire naïf ne prouverait rien sur l'atomicité.
 */
function buildFakeDb(initialRow: FakeStudentRow, initialEnrollments: FakeEnrollmentRow[] = []) {
  let committedRow = { ...initialRow };
  let committedEnrollments = [...initialEnrollments];

  const $transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    let draftRow = { ...committedRow };
    let draftEnrollments = [...committedEnrollments];

    const tx = {
      student: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
          where.id === draftRow.id ? { ...draftRow } : null,
        ),
        updateMany: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string; academicRevision: number };
            data: Record<string, unknown>;
          }) => {
            if (where.id !== draftRow.id || where.academicRevision !== draftRow.academicRevision) {
              return { count: 0 };
            }
            draftRow = { ...draftRow, ...(data as Partial<FakeStudentRow>) };
            return { count: 1 };
          },
        ),
      },
      studentAcademicEnrollment: {
        findMany: jest.fn(async ({ where }: { where: { studentId: string } }) =>
          draftEnrollments
            .filter((row) => row.studentId === where.studentId)
            .map(({ courseKey, kind, source }) => ({ courseKey, kind, source }))
            .sort((a, b) => a.courseKey.localeCompare(b.courseKey)),
        ),
        deleteMany: jest.fn(async ({ where }: { where: { studentId: string } }) => {
          const before = draftEnrollments.length;
          draftEnrollments = draftEnrollments.filter((row) => row.studentId !== where.studentId);
          return { count: before - draftEnrollments.length };
        }),
        createMany: jest.fn(async ({ data }: { data: FakeEnrollmentRow[] }) => {
          draftEnrollments.push(...data);
          return { count: data.length };
        }),
      },
    };

    const result = await fn(tx);
    // Commit : le callback a résolu sans lever.
    committedRow = draftRow;
    committedEnrollments = draftEnrollments;
    return result;
  });

  return {
    $transaction,
    getRow: () => committedRow,
    getEnrollments: () => committedEnrollments,
  };
}

const TERMINALE_EDS_ROW: FakeStudentRow = {
  id: 'student-1',
  gradeLevel: 'TERMINALE',
  academicTrack: 'EDS_GENERALE',
  stmgPathway: null,
  schoolingStatus: 'SCOLARISE',
  academicRevision: 0,
};

beforeEach(() => jest.clearAllMocks());

describe('updateStudentAcademicProfile — identité + choix en une transaction atomique', () => {
  it('met à jour la fiche scolaire et remplace les enseignements choisis dans la même transaction', async () => {
    const db = buildFakeDb(TERMINALE_EDS_ROW, [
      { studentId: 'student-1', courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ]);
    (prisma.$transaction as jest.Mock).mockImplementation(db.$transaction);

    const result = await updateStudentAcademicProfile(
      'student-1',
      {},
      ['eds-nsi-terminale'],
      0,
      { source: 'ADMIN', verifiedById: 'staff-1' },
    );

    expect(result.academicRevision).toBe(1);
    expect(db.getRow().academicRevision).toBe(1);

    const courseKeys = db.getEnrollments().map((row) => row.courseKey);
    expect(courseKeys).toEqual(['eds-nsi-terminale']);

    const view = result.courses.find((v) => v.course.courseKey === 'eds-nsi-terminale');
    expect(view?.academicStatus).toBe('ENROLLED');
    const previousView = result.courses.find((v) => v.course.courseKey === 'eds-maths-terminale');
    expect(previousView?.academicStatus).toBe('NOT_ENROLLED');
  });

  it('valide les nouveaux choix contre la NOUVELLE identité, pas l’ancienne', async () => {
    // stmg-sgn-premiere n'existe qu'en voie STMG : invalide pour EDS_GENERALE
    // actuel, mais l'appel bascule justement vers STMG.
    const db = buildFakeDb(TERMINALE_EDS_ROW);
    (prisma.$transaction as jest.Mock).mockImplementation(db.$transaction);

    const result = await updateStudentAcademicProfile(
      'student-1',
      { gradeLevel: 'PREMIERE' as never, academicTrack: 'STMG' as never, stmgPathway: 'GF' as never },
      [],
      0,
      { source: 'ADMIN', verifiedById: 'staff-1' },
    );

    expect(result.gradeLevel).toBe('PREMIERE');
    expect(result.academicTrack).toBe('STMG');
    expect(result.stmgPathway).toBe('GF');
    const stmgModule = result.courses.find((v) => v.course.courseKey === 'stmg-sgn-premiere');
    expect(stmgModule?.academicStatus).toBe('DERIVED');
  });

  it('rejette un choix incohérent avec la nouvelle identité — AUCUNE écriture', async () => {
    const db = buildFakeDb(TERMINALE_EDS_ROW);
    (prisma.$transaction as jest.Mock).mockImplementation(db.$transaction);

    await expect(
      updateStudentAcademicProfile(
        'student-1',
        {},
        ['enseignement-inconnu'],
        0,
        { source: 'ADMIN', verifiedById: 'staff-1' },
      ),
    ).rejects.toBeInstanceOf(AcademicEnrollmentError);

    // La transaction entière a été annulée : la révision n'a pas bougé.
    expect(db.getRow().academicRevision).toBe(0);
    expect(db.getEnrollments()).toHaveLength(0);
  });
});

describe('updateStudentAcademicProfile — provenance de l’auteur', () => {
  it('rejette une saisie ADMIN sans auteur et n’écrit rien', async () => {
    const db = buildFakeDb(TERMINALE_EDS_ROW);
    (prisma.$transaction as jest.Mock).mockImplementation(db.$transaction);

    await expect(
      updateStudentAcademicProfile(
        'student-1',
        {},
        ['eds-nsi-terminale'],
        0,
        { source: 'ADMIN' } as never,
      ),
    ).rejects.toBeInstanceOf(AcademicEnrollmentError);

    expect(db.getRow().academicRevision).toBe(0);
    expect(db.getEnrollments()).toHaveLength(0);
  });

  it('rejette une saisie ASSISTANTE sans auteur et n’écrit rien', async () => {
    const db = buildFakeDb(TERMINALE_EDS_ROW);
    (prisma.$transaction as jest.Mock).mockImplementation(db.$transaction);

    await expect(
      updateStudentAcademicProfile(
        'student-1',
        {},
        ['eds-nsi-terminale'],
        0,
        { source: 'ASSISTANTE' } as never,
      ),
    ).rejects.toBeInstanceOf(AcademicEnrollmentError);

    expect(db.getRow().academicRevision).toBe(0);
  });
});

describe('updateStudentAcademicProfile — CAS de révision', () => {
  it('échoue avec ACADEMIC_REVISION_CONFLICT quand la révision attendue est périmée, sans rien écrire', async () => {
    const db = buildFakeDb({ ...TERMINALE_EDS_ROW, academicRevision: 3 }, [
      { studentId: 'student-1', courseKey: 'eds-maths-terminale', kind: 'SPECIALTY', source: 'ADMIN' },
    ]);
    (prisma.$transaction as jest.Mock).mockImplementation(db.$transaction);

    await expect(
      updateStudentAcademicProfile(
        'student-1',
        {},
        ['eds-nsi-terminale'],
        0, // périmée : la vraie révision est 3
        { source: 'ADMIN', verifiedById: 'staff-1' },
      ),
    ).rejects.toBeInstanceOf(AcademicRevisionConflictError);

    // Zéro mutation : ni la révision, ni les enseignements n'ont bougé.
    expect(db.getRow().academicRevision).toBe(3);
    expect(db.getEnrollments().map((row) => row.courseKey)).toEqual(['eds-maths-terminale']);
  });

  it('expose un code stable ACADEMIC_REVISION_CONFLICT', async () => {
    const db = buildFakeDb({ ...TERMINALE_EDS_ROW, academicRevision: 3 });
    (prisma.$transaction as jest.Mock).mockImplementation(db.$transaction);

    await expect(
      updateStudentAcademicProfile('student-1', {}, [], 0, {
        source: 'ADMIN',
        verifiedById: 'staff-1',
      }),
    ).rejects.toMatchObject({ code: 'ACADEMIC_REVISION_CONFLICT' });
  });
});

describe('updateStudentAcademicProfile — carte scolaire recalculée', () => {
  it('retourne les sections obligatoire (DERIVED) / spécialité / option depuis la même transaction', async () => {
    const db = buildFakeDb(TERMINALE_EDS_ROW);
    (prisma.$transaction as jest.Mock).mockImplementation(db.$transaction);

    const result = await updateStudentAcademicProfile(
      'student-1',
      {},
      ['eds-maths-terminale', 'opt-maths-expertes-terminale'],
      0,
      { source: 'ADMIN', verifiedById: 'staff-1' },
    );

    const core = result.courses.find((v) => v.course.courseKey === 'tc-philosophie-terminale');
    expect(core?.academicStatus).toBe('DERIVED');
    const specialty = result.courses.find((v) => v.course.courseKey === 'eds-maths-terminale');
    expect(specialty?.academicStatus).toBe('ENROLLED');
    const option = result.courses.find((v) => v.course.courseKey === 'opt-maths-expertes-terminale');
    expect(option?.academicStatus).toBe('ENROLLED');
  });
});

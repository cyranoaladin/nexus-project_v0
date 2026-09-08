jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(async () => ({ user: { id: 'staff', role: 'ASSISTANTE' } })),
  isErrorResponse: jest.fn(() => false),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachProfile: { findUnique: jest.fn() },
    student: { findMany: jest.fn() },
    studentAcademicEnrollment: { findMany: jest.fn() },
    coachStudentAssignment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { POST } from '@/app/api/assistante/assignments/route';
import { PATCH } from '@/app/api/assistante/assignments/[id]/route';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const NOW = new Date('2030-01-15T12:00:00Z');
const COURSE = 'tc-maths-anticipees-premiere';
const FRENCH = 'tc-francais-premiere';
const coach = { id: 'coach', subjects: ['MATHEMATIQUES', 'FRANCAIS'], user: { firstName: 'Coach', lastName: 'Test' } };
const student = { id: 'student', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', stmgPathway: null, user: { firstName: 'Eleve', lastName: 'Test' } };

function current(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assignment', coachId: coach.id, studentId: student.id, assignmentType: 'PRIMARY',
    status: 'ACTIVE', startsAt: new Date('2030-01-01T00:00:00Z'), endsAt: null as Date | null,
    academicCourseKeys: [COURSE], subjects: ['MATHEMATIQUES'], courseScopeState: 'STAFF_VERIFIED',
    coach, student, ...overrides,
  };
}
function request(body: unknown) {
  return new Request('http://localhost/api/assistante/assignments', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
function patch(body: unknown) {
  return PATCH(request(body), { params: Promise.resolve({ id: 'assignment' }) });
}
function load(row: ReturnType<typeof current>) {
  (prisma.coachStudentAssignment.findUnique as jest.Mock).mockResolvedValue(row);
  (prisma.coachStudentAssignment.update as jest.Mock).mockImplementation(async ({ data }) => ({ ...row, ...data }));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  load(current());
  (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue(coach);
  (prisma.student.findMany as jest.Mock).mockResolvedValue([student]);
  (prisma.studentAcademicEnrollment.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.coachStudentAssignment.create as jest.Mock).mockImplementation(async ({ data }) => ({ id: 'created', ...data }));
  (prisma.$transaction as jest.Mock).mockImplementation(async (operation) =>
    typeof operation === 'function' ? operation(prisma) : Promise.all(operation),
  );
});
afterEach(() => jest.useRealTimers());

describe('historique terminal', () => {
  it.each([
    { courseKeys: [FRENCH] }, { status: 'ACTIVE' }, { status: 'SUSPENDED' }, { endsAt: null },
    { endsAt: '2030-02-01T00:00:00Z' },
  ])('refuse de réécrire une assignation ENDED : %j', async (body) => {
    load(current({ status: 'ENDED', endsAt: new Date('2030-01-10T00:00:00Z') }));
    const response = await patch(body);
    expect(response.status).toBe(409);
    expect(prisma.coachStudentAssignment.update).not.toHaveBeenCalled();
  });

  it.each([{ status: 'ENDED' }, { notes: 'Précision administrative' }])(
    'préserve le scope et la fin lors de la répétition/clôture %j', async (body) => {
      const previous = current({ status: 'ENDED', endsAt: new Date('2029-01-01T00:00:00Z'), academicCourseKeys: [], courseScopeState: 'BACKFILL_UNRESOLVED' });
      load(previous);
      const response = await patch(body);
      expect(response.status).toBe(200);
      expect((await response.json()).assignment).toMatchObject({
        status: 'ENDED', endsAt: previous.endsAt!.toISOString(), academicCourseKeys: [], courseScopeState: 'BACKFILL_UNRESOLVED', subjects: previous.subjects,
      });
    },
  );

  it('la clôture ne remplace pas simultanément le périmètre', async () => {
    const response = await patch({ status: 'ENDED', courseKeys: [FRENCH] });
    expect(response.status).toBe(409);
    expect(prisma.coachStudentAssignment.update).not.toHaveBeenCalled();
  });

  it('une affectation future peut être terminée immédiatement', async () => {
    load(current({ startsAt: new Date('2030-02-01T00:00:00Z') }));
    const response = await patch({ status: 'ENDED' });
    expect(response.status).toBe(200);
    expect((await response.json()).assignment.endsAt).toBe(NOW.toISOString());
  });
});

describe('expiration et dates', () => {
  it.each([{ status: 'ACTIVE', endsAt: null }, { endsAt: '2030-03-01T00:00:00Z' }, { courseKeys: [FRENCH] }])(
    'une assignation expirée ne peut être prolongée/réécrite : %j', async (body) => {
      load(current({ endsAt: new Date('2030-01-10T00:00:00Z') }));
      expect((await patch(body)).status).toBe(409);
      expect(prisma.coachStudentAssignment.update).not.toHaveBeenCalled();
    },
  );

  it('terminer une assignation expirée conserve sa fin historique', async () => {
    const previous = current({ endsAt: new Date('2030-01-10T00:00:00Z') });
    load(previous);
    const response = await patch({ status: 'ENDED' });
    expect(response.status).toBe(200);
    expect((await response.json()).assignment.endsAt).toBe(previous.endsAt!.toISOString());
  });

  it.each(['2029-12-31T00:00:00Z', '2030-01-10T00:00:00Z'])(
    'refuse une nouvelle fin passée/inversée %s sans mutation', async (endsAt) => {
      expect((await patch({ endsAt })).status).toBe(400);
      expect(prisma.coachStudentAssignment.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    { startsAt: '2030-03-01T00:00:00Z', endsAt: '2030-02-01T00:00:00Z' },
    { endsAt: '2030-01-10T00:00:00Z' },
  ])('POST refuse une fenêtre invalide %j', async (dates) => {
    const response = await POST(request({ coachId: coach.id, studentIds: [student.id], courseKeys: [COURSE], ...dates }));
    expect(response.status).toBe(400);
    expect(prisma.coachStudentAssignment.create).not.toHaveBeenCalled();
  });
});

describe('suspension et réactivation', () => {
  it('refuse de réactiver une fenêtre historique inversée sans correction explicite', async () => {
    load(current({ status: 'SUSPENDED', startsAt: new Date('2030-03-01T00:00:00Z'), endsAt: new Date('2030-02-01T00:00:00Z') }));
    expect((await patch({ status: 'ACTIVE' })).status).toBe(400);
    expect(prisma.coachStudentAssignment.update).not.toHaveBeenCalled();
  });

  it('permet de corriger la fin future inversée lors de la réactivation', async () => {
    load(current({ status: 'SUSPENDED', startsAt: new Date('2030-03-01T00:00:00Z'), endsAt: new Date('2030-02-01T00:00:00Z') }));
    expect((await patch({ status: 'ACTIVE', endsAt: '2030-04-01T00:00:00Z' })).status).toBe(200);
  });

  it('permet un changement de scope valide en restant SUSPENDED', async () => {
    load(current({ status: 'SUSPENDED' }));
    const response = await patch({ courseKeys: [FRENCH] });
    expect(response.status).toBe(200);
    expect((await response.json()).assignment).toMatchObject({ status: 'SUSPENDED', academicCourseKeys: [FRENCH], courseScopeState: 'STAFF_VERIFIED' });
  });

  it.each([
    { academicCourseKeys: [] },
    { courseScopeState: 'BACKFILL_UNRESOLVED' },
    { courseScopeState: 'BACKFILL_AMBIGUOUS' },
    { academicCourseKeys: ['unknown-course'] },
    { student: { ...student, gradeLevel: 'TERMINALE' } },
    { coach: { ...coach, subjects: ['FRANCAIS'] } },
  ])('refuse une réactivation avec scope effectif invalide %j', async (invalid) => {
    load(current({ status: 'SUSPENDED', ...invalid }));
    expect((await patch({ status: 'ACTIVE' })).status).toBe(400);
    expect(prisma.coachStudentAssignment.update).not.toHaveBeenCalled();
  });

  it('réactive un BACKFILL_AUTO valide sans le transformer en décision staff', async () => {
    load(current({ status: 'SUSPENDED', courseScopeState: 'BACKFILL_AUTO' }));
    const response = await patch({ status: 'ACTIVE' });
    expect(response.status).toBe(200);
    expect((await response.json()).assignment).toMatchObject({ status: 'ACTIVE', academicCourseKeys: [COURSE], courseScopeState: 'BACKFILL_AUTO', subjects: ['MATHEMATIQUES'] });
  });

  it('permet une correction explicite et une réactivation atomique', async () => {
    load(current({ status: 'SUSPENDED', academicCourseKeys: [], courseScopeState: 'BACKFILL_UNRESOLVED' }));
    const response = await patch({ status: 'ACTIVE', courseKeys: [FRENCH] });
    expect(response.status).toBe(200);
    expect((await response.json()).assignment).toMatchObject({ status: 'ACTIVE', academicCourseKeys: [FRENCH], courseScopeState: 'STAFF_VERIFIED', subjects: ['FRANCAIS'] });
  });

  it.each(['PRIMARY', 'SECONDARY'])('refuse la réactivation créant un doublon actif %s', async (assignmentType) => {
    load(current({ status: 'SUSPENDED' }));
    (prisma.coachStudentAssignment.findMany as jest.Mock).mockResolvedValue([{ id: 'other', coachId: coach.id, studentId: student.id, assignmentType, status: 'ACTIVE' }]);
    expect((await patch({ status: 'ACTIVE' })).status).toBe(409);
    expect(prisma.coachStudentAssignment.update).not.toHaveBeenCalled();
  });
});

describe('conflits de transaction', () => {
  it.each(['P2002', 'P2034'])('PATCH traduit %s en 409', async (code) => {
    const error = Object.assign(new Error('concurrent assignment mutation'), { code });
    Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);
    (prisma.$transaction as jest.Mock).mockRejectedValue(error);
    (prisma.coachStudentAssignment.update as jest.Mock).mockRejectedValue(error);
    expect((await patch({ notes: 'Suivi' })).status).toBe(409);
  });
});

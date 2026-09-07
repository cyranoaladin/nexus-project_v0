/**
 * Tâche 13 — GET /api/parent/dashboard doit scoper les séances de CHAQUE
 * enfant par sa propre identité canonique (`SessionBooking.studentProfileId
 * = Student.id`), jamais par l'ancienne relation `User.studentSessions`, et
 * jamais laisser fuiter les séances d'un enfant vers un autre — même quand
 * elles se chevauchent délibérément en date/heure/matière (deux coachs
 * différents, mêmes créneau et matière, pour prouver que le filtrage
 * fonctionne par construction et pas par coïncidence de planning).
 *
 * Prouve aussi qu'un parent ÉTRANGER (aucun lien avec ces deux enfants) ne
 * reçoit jamais leurs séances : `parentProfile.findUnique` est déjà scopé par
 * `userId: session.user.id`, donc `parentProfile.children` ne peut structurellement
 * contenir que les enfants du parent appelant — ce test le vérifie contre un
 * vrai Postgres plutôt que de le supposer.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { randomUUID } from 'node:crypto';
import { GET } from '@/app/api/parent/dashboard/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';

const mockAuth = auth as jest.Mock;

const prefix = `parent-cross-child-${randomUUID()}`;
const SCHEDULED_DATE = new Date('2027-05-10T00:00:00.000Z');

let verified = false;

let parent1Id = '';
let parent1UserId = '';
let parent2Id = '';
let parent2UserId = '';

let studentAId = '';
let studentAUserId = '';
let studentBId = '';
let studentBUserId = '';

let coachAId = '';
let coachAUserId = '';
let coachBId = '';
let coachBUserId = '';

let bookingAId = '';
let bookingBId = '';

beforeAll(async () => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  verified = true;

  // ── Parent 1 : possède les deux enfants A et B ───────────────────────────
  const parent1User = await prisma.user.create({
    data: {
      email: `${prefix}-parent1@test.example`,
      role: 'PARENT',
      firstName: 'Karim',
      lastName: prefix,
    },
  });
  parent1UserId = parent1User.id;
  const parent1Profile = await prisma.parentProfile.create({ data: { userId: parent1UserId } });
  parent1Id = parent1Profile.id;

  // ── Parent 2 : étranger, aucun lien avec A ni B ──────────────────────────
  const parent2User = await prisma.user.create({
    data: {
      email: `${prefix}-parent2@test.example`,
      role: 'PARENT',
      firstName: 'Foreign',
      lastName: prefix,
    },
  });
  parent2UserId = parent2User.id;
  const parent2Profile = await prisma.parentProfile.create({ data: { userId: parent2UserId } });
  parent2Id = parent2Profile.id;

  // ── Élève A (parent 1) ────────────────────────────────────────────────────
  const studentAUser = await prisma.user.create({
    data: {
      email: `${prefix}-student-a@test.example`,
      role: 'ELEVE',
      firstName: 'Amine',
      lastName: prefix,
    },
  });
  studentAUserId = studentAUser.id;
  const studentA = await prisma.student.create({
    data: { userId: studentAUserId, parentId: parent1Id, gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' },
  });
  studentAId = studentA.id;

  // ── Élève B (parent 1) ────────────────────────────────────────────────────
  const studentBUser = await prisma.user.create({
    data: {
      email: `${prefix}-student-b@test.example`,
      role: 'ELEVE',
      firstName: 'Bilel',
      lastName: prefix,
    },
  });
  studentBUserId = studentBUser.id;
  const studentB = await prisma.student.create({
    data: { userId: studentBUserId, parentId: parent1Id, gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE' },
  });
  studentBId = studentB.id;

  // ── Coach A et Coach B — DEUX coachs distincts, pour permettre un
  // chevauchement EXACT date/heure/matière entre A et B sans violer la
  // contrainte d'exclusion PostgreSQL (clé sur coachId, séparément sur
  // studentProfileId — jamais un chevauchement global).
  const coachAUser = await prisma.user.create({
    data: { email: `${prefix}-coach-a@test.example`, role: 'COACH', lastName: prefix },
  });
  coachAUserId = coachAUser.id;
  const coachA = await prisma.coachProfile.create({
    data: { userId: coachAUserId, pseudonym: `${prefix}-coach-a`, subjects: JSON.stringify(['MATHEMATIQUES']) },
  });
  coachAId = coachA.id;

  const coachBUser = await prisma.user.create({
    data: { email: `${prefix}-coach-b@test.example`, role: 'COACH', lastName: prefix },
  });
  coachBUserId = coachBUser.id;
  const coachB = await prisma.coachProfile.create({
    data: { userId: coachBUserId, pseudonym: `${prefix}-coach-b`, subjects: JSON.stringify(['MATHEMATIQUES']) },
  });
  coachBId = coachB.id;

  // ── Séances délibérément chevauchantes (même date, même heure, même
  // matière) pour A et B — seul `studentProfileId` (et le coach distinct)
  // les distingue, afin que le test ne passe jamais "par chance".
  const bookingA = await prisma.sessionBooking.create({
    data: {
      studentId: studentAUserId,
      coachId: coachAUserId,
      studentProfileId: studentAId,
      coachProfileId: coachAId,
      subject: 'MATHEMATIQUES',
      title: `Séance A — ${prefix}`,
      scheduledDate: SCHEDULED_DATE,
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      status: 'SCHEDULED',
      modality: 'ONLINE',
      type: 'INDIVIDUAL',
    },
  });
  bookingAId = bookingA.id;

  const bookingB = await prisma.sessionBooking.create({
    data: {
      studentId: studentBUserId,
      coachId: coachBUserId,
      studentProfileId: studentBId,
      coachProfileId: coachBId,
      subject: 'MATHEMATIQUES',
      title: `Séance B — ${prefix}`,
      scheduledDate: SCHEDULED_DATE,
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      status: 'SCHEDULED',
      modality: 'IN_PERSON',
      location: 'Centre Nexus',
      type: 'INDIVIDUAL',
    },
  });
  bookingBId = bookingB.id;
});

afterAll(async () => {
  if (!verified) return;
  await prisma.sessionBooking.deleteMany({ where: { id: { in: [bookingAId, bookingBId].filter(Boolean) } } });
  await prisma.coachProfile.deleteMany({ where: { id: { in: [coachAId, coachBId].filter(Boolean) } } });
  await prisma.student.deleteMany({ where: { id: { in: [studentAId, studentBId].filter(Boolean) } } });
  await prisma.parentProfile.deleteMany({ where: { id: { in: [parent1Id, parent2Id].filter(Boolean) } } });
  await prisma.user.deleteMany({ where: { lastName: prefix } });
  await prisma.$disconnect();
});

describe('GET /api/parent/dashboard — cross-child isolation (real Postgres)', () => {
  it("returns each child's sessions scoped to its own studentProfileId, with zero cross-contamination", async () => {
    mockAuth.mockResolvedValue({
      user: { id: parent1UserId, role: 'PARENT', firstName: 'Karim', lastName: prefix, email: `${prefix}-parent1@test.example` },
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.children).toHaveLength(2);

    const childA = body.children.find((c: any) => c.id === studentAId);
    const childB = body.children.find((c: any) => c.id === studentBId);
    expect(childA).toBeDefined();
    expect(childB).toBeDefined();

    // Chevauchement délibéré date/heure/matière — seule l'identité
    // studentProfileId doit distinguer les deux flux.
    expect(childA.sessions).toHaveLength(1);
    expect(childA.sessions[0].id).toBe(bookingAId);
    expect(childA.sessions[0].modality).toBe('ONLINE');
    expect(childA.sessions[0].location).toBeNull();

    expect(childB.sessions).toHaveLength(1);
    expect(childB.sessions[0].id).toBe(bookingBId);
    expect(childB.sessions[0].modality).toBe('IN_PERSON');
    expect(childB.sessions[0].location).toBe('Centre Nexus');

    // Aucune contamination croisée.
    expect(childA.sessions.map((s: any) => s.id)).not.toContain(bookingBId);
    expect(childB.sessions.map((s: any) => s.id)).not.toContain(bookingAId);
  });

  it('denies a foreign parent access to another family sessions — never leaks studentA/studentB', async () => {
    mockAuth.mockResolvedValue({
      user: { id: parent2UserId, role: 'PARENT', firstName: 'Foreign', lastName: prefix, email: `${prefix}-parent2@test.example` },
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.children).toEqual([]);

    const childIds = body.children.map((c: any) => c.id);
    expect(childIds).not.toContain(studentAId);
    expect(childIds).not.toContain(studentBId);
  });
});

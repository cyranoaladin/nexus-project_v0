/**
 * P0 initial student activation against a real, isolated PostgreSQL database.
 * No production database and no real minor identity may be used by this suite.
 *
 * Amendement 7 (Task 4): `POST /api/bilan-gratuit` and `POST /api/parent/
 * children` no longer create any account directly -- they only capture a
 * `FamilyRequest` (+ children). The account graph this suite exercises is
 * only ever produced by a staff (ADMIN/ASSISTANTE) conversion, via
 * `POST /api/assistante/family-requests/[requestId]/convert`, which calls
 * `createFamily()` / `addChildToExistingFamily()`. Every assertion below
 * about the resulting account, its activation token, its ownership, and its
 * concurrency/replay behaviour still applies unchanged to that real account
 * once created -- only *how* the account comes to exist has moved.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/email', () => ({ sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/email/mailer', () => ({ sendMail: jest.fn().mockResolvedValue(undefined) }));

import { POST as registerBilan } from '@/app/api/bilan-gratuit/route';
import { POST as createChild } from '@/app/api/parent/children/route';
import { POST as convertFamilyRequest } from '@/app/api/assistante/family-requests/[requestId]/convert/route';
import { POST as issueActivation } from '@/app/api/parent/children/[studentId]/activation/route';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { completeStudentActivation } from '@/lib/services/student-activation.service';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

const PREFIX = 'p0-initial-activation-';
const parentEmail = `${PREFIX}parent@example.test`;
let staffUserId: string;

function safeTestDatabase(): void {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  assertDisposablePostgresUrl(target);
}

function registrationRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/bilan-gratuit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      Host: 'localhost:3000',
    },
    body: JSON.stringify({
      parentFirstName: 'Parent',
      parentLastName: 'Synthétique',
      parentEmail,
      parentPhone: '+21699000001',
      studentFirstName: 'Élève',
      studentLastName: 'Synthétique',
      studentGrade: 'Seconde',
      studentSchool: 'Établissement de test',
      subjects: ['MATHEMATIQUES'],
      objectives: 'Vérifier uniquement le parcours technique synthétique.',
      acceptTerms: true,
    }),
  });
}

function convertRequest(requestId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/assistante/family-requests/${requestId}/convert`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Host: 'localhost:3000',
    },
  });
}

function activationRequest(studentId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/parent/children/${studentId}/activation`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Host: 'localhost:3000',
    },
  });
}

function childCreationRequest(firstName: string, lastName: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/parent/children', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      Host: 'localhost:3000',
    },
    body: JSON.stringify({ firstName, lastName, grade: 'Seconde', school: '' }),
  });
}

/** La `FamilyRequest` (encore non traitée) laissée par une soumission. */
async function fetchSubmittedFamilyRequestId(contactEmail: string): Promise<string> {
  const record = await prisma.familyRequest.findFirstOrThrow({
    where: { contactEmail, status: 'SUBMITTED' },
    orderBy: { createdAt: 'desc' },
  });
  return record.id;
}

async function asStaff<T>(action: () => Promise<T>): Promise<T> {
  (auth as jest.Mock).mockResolvedValue({ user: { id: staffUserId, role: 'ASSISTANTE' } });
  return action();
}

async function cleanup(): Promise<void> {
  await prisma.familyRequest.deleteMany({ where: { contactEmail: { contains: PREFIX } } });

  const parents = await prisma.user.findMany({
    where: { email: { contains: PREFIX } },
    include: { parentProfile: { include: { children: true } } },
  });
  const parentUserIds = parents.map((user) => user.id);
  const studentIds = parents.flatMap((user) => user.parentProfile?.children.map((child) => child.id) ?? []);
  const childUserIds = parents.flatMap((user) => user.parentProfile?.children.map((child) => child.userId) ?? []);
  const userIds = [...new Set([...parentUserIds, ...childUserIds])];
  if (userIds.length === 0) return;

  await prisma.parentStudentLink.deleteMany({
    where: {
      OR: [
        { parentUserId: { in: parentUserIds } },
        { studentId: { in: studentIds } },
      ],
    },
  });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.parentProfile.deleteMany({ where: { userId: { in: parentUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('P0 initial student activation — real PostgreSQL', () => {
  beforeAll(async () => {
    safeTestDatabase();
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    await cleanup();
    const staff = await prisma.user.create({
      data: { role: 'ASSISTANTE', firstName: 'StaffActor', lastName: `${PREFIX}staff` },
      select: { id: true },
    });
    staffUserId = staff.id;
  });

  afterAll(async () => {
    await cleanup();
    if (staffUserId) await prisma.user.deleteMany({ where: { id: staffUserId } });
    await prisma.$disconnect();
  });

  it('registers, issues from the owner, activates once and rejects replay/concurrency', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const registration = await registerBilan(registrationRequest());
    expect(registration.status).toBe(200);
    const registrationBody = await registration.json();
    expect(registrationBody).toEqual(expect.objectContaining({ success: true }));
    expect(registrationBody).not.toHaveProperty('parentId');
    expect(registrationBody).not.toHaveProperty('studentId');

    // Amendement 7 : la soumission publique ne crée qu'une FamilyRequest --
    // aucun compte n'existe avant qu'un membre du staff la convertisse.
    const requests = await prisma.familyRequest.findMany({ where: { contactEmail: parentEmail } });
    expect(requests).toHaveLength(1);
    expect(await prisma.user.count({ where: { email: parentEmail } })).toBe(0);

    const bilanRequestId = await fetchSubmittedFamilyRequestId(parentEmail);
    const conversion = await asStaff(() => convertFamilyRequest(
      convertRequest(bilanRequestId),
      { params: Promise.resolve({ requestId: bilanRequestId }) },
    ));
    expect(conversion.status).toBe(200);
    const conversionBody = await conversion.json();
    expect(conversionBody.success).toBe(true);

    const parent = await prisma.user.findUniqueOrThrow({
      where: { email: parentEmail },
      include: {
        parentProfile: {
          include: { children: { include: { user: true } } },
        },
      },
    });
    expect(parent.id).toBe(conversionBody.parentUserId);
    const child = parent.parentProfile?.children[0];
    expect(child?.id).toEqual(expect.any(String));
    // La conversion (createFamily() -> createChildren()) émet déjà un jeton
    // d'activation pour l'enfant, dès lors que l'e-mail du parent est connu
    // (comportement voulu de la saisie papier : le foyer reçoit le lien
    // immédiatement) -- contrairement à l'ancienne inscription publique, qui
    // laissait ce jeton `null` jusqu'à un appel explicite à cette route.
    // Cette route réémet toujours un jeton frais tant que l'élève n'est pas
    // encore activé (voir initiateParentOwnedStudentActivation), donc ce que
    // cette suite vérifie plus bas (hash, expiration, usage unique) porte
    // sans ambiguïté sur le jeton réémis par l'appel ci-dessous.
    expect(child?.user).toEqual(expect.objectContaining({
      role: 'ELEVE',
      password: null,
      activatedAt: null,
    }));

    const originalUserId = child!.userId;
    const originalStudentId = child!.id;
    const originalParentId = child!.parentId;
    await prisma.user.update({
      where: { id: originalUserId },
      data: { email: 'élève.synthétique@nexus-student.local' },
    });
    const countsBeforeRepair = {
      users: await prisma.user.count(),
      students: await prisma.student.count(),
    };

    (auth as jest.Mock).mockResolvedValue({
      user: { id: parent.id, role: 'PARENT', email: parent.email },
    });
    const issuance = await issueActivation(
      activationRequest(child!.id),
      { params: Promise.resolve({ studentId: child!.id }) },
    );
    expect(issuance.status).toBe(200);
    const issuanceBody = await issuance.json();
    expect(issuanceBody.activation.loginIdentifier).toMatch(
      /^eleve\.synthetique\.[a-z0-9]+@nexus-student\.local$/,
    );
    const rawToken = new URL(issuanceBody.activation.activationUrl).searchParams.get('token');
    expect(rawToken).toMatch(/^sact_/);

    const pendingChild = await prisma.user.findUniqueOrThrow({ where: { id: child!.userId } });
    expect(pendingChild.id).toBe(originalUserId);
    expect(pendingChild.email).toBe(issuanceBody.activation.loginIdentifier);
    const preservedStudent = await prisma.student.findUniqueOrThrow({ where: { id: originalStudentId } });
    expect(preservedStudent.userId).toBe(originalUserId);
    expect(preservedStudent.parentId).toBe(originalParentId);
    expect(await prisma.user.count()).toBe(countsBeforeRepair.users);
    expect(await prisma.student.count()).toBe(countsBeforeRepair.students);
    expect(pendingChild.activationToken).toBe(
      crypto.createHash('sha256').update(rawToken!).digest('hex'),
    );
    expect(pendingChild.activationToken).not.toContain(rawToken!);
    expect(pendingChild.activationExpiry!.getTime()).toBeGreaterThan(Date.now());

    const otherParent = await prisma.user.create({
      data: { email: `${PREFIX}other-parent@example.test`, role: 'PARENT' },
    });
    await prisma.parentProfile.create({ data: { userId: otherParent.id } });
    (auth as jest.Mock).mockResolvedValue({
      user: { id: otherParent.id, role: 'PARENT', email: otherParent.email },
    });
    const forbidden = await issueActivation(
      activationRequest(child!.id),
      { params: Promise.resolve({ studentId: child!.id }) },
    );
    expect(forbidden.status).toBe(404);

    // Deux enfants homonymes : sous l'ancienne architecture, deux appels
    // concurrents à POST /api/parent/children créaient directement les deux
    // comptes élève et la concurrence se jouait sur l'identifiant de
    // connexion généré. Amendement 7 : ce POST ne fait plus que capturer
    // deux FamilyRequest (type ADD_CHILD) -- la création réelle, et donc la
    // même fenêtre de concurrence sur l'identifiant, ne se joue plus qu'à la
    // conversion, dans addChildToExistingFamily(). On reproduit donc la
    // course à cet endroit précis : deux conversions concurrentes du même
    // foyer, chacune ajoutant un enfant homonyme.
    (auth as jest.Mock).mockResolvedValue({
      user: { id: parent.id, role: 'PARENT', email: parent.email },
    });
    const homonymSubmissions = await Promise.all([
      createChild(childCreationRequest('Élève', 'Homonyme')),
      createChild(childCreationRequest('Eleve', 'Homonyme')),
    ]);
    expect(homonymSubmissions.map((response) => response.status)).toEqual([200, 200]);

    const homonymFamilyRequests = await prisma.familyRequest.findMany({
      where: {
        type: 'ADD_CHILD',
        requestingParentProfileId: parent.parentProfile!.id,
        status: 'SUBMITTED',
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(homonymFamilyRequests).toHaveLength(2);

    const homonymConversions = await asStaff(() => Promise.all(homonymFamilyRequests.map((request) =>
      convertFamilyRequest(convertRequest(request.id), { params: Promise.resolve({ requestId: request.id }) }),
    )));
    expect(homonymConversions.map((response) => response.status)).toEqual([200, 200]);
    const homonymBodies = await Promise.all(homonymConversions.map((response) => response.json()));
    const homonymStudentIds = homonymBodies.flatMap((body) => body.studentIds as string[]);
    expect(homonymStudentIds).toHaveLength(2);
    const homonymStudents = await prisma.student.findMany({
      where: { id: { in: homonymStudentIds } },
      include: { user: true },
    });
    const homonymIdentifiers = homonymStudents.map((student) => student.user.email);
    expect(new Set(homonymIdentifiers).size).toBe(2);
    expect(homonymIdentifiers).toEqual(expect.arrayContaining([
      expect.stringMatching(/^[a-z0-9]+(?:\.[a-z0-9]+)*@nexus-student\.local$/),
      expect.stringMatching(/^[a-z0-9]+(?:\.[a-z0-9]+)*@nexus-student\.local$/),
    ]));

    const password = 'P0Synthetic!2026';
    const concurrent = await Promise.all([
      completeStudentActivation(rawToken!, password),
      completeStudentActivation(rawToken!, password),
    ]);
    expect(concurrent.filter((result) => result.success)).toHaveLength(1);
    expect(concurrent.filter((result) => !result.success)).toHaveLength(1);

    const activatedChild = await prisma.user.findUniqueOrThrow({ where: { id: child!.userId } });
    expect(activatedChild.activatedAt).toBeInstanceOf(Date);
    expect(activatedChild.activationToken).toBeNull();
    expect(activatedChild.activationExpiry).toBeNull();
    expect(await bcrypt.compare(password, activatedChild.password!)).toBe(true);
    expect(activatedChild.password).not.toBe(password);

    await expect(completeStudentActivation(rawToken!, password)).resolves.toEqual({
      success: false,
      error: "Lien d'activation invalide ou expiré",
    });

    // Une resoumission du même bilan gratuit ne crée jamais de second compte
    // parent : sous l'ancienne architecture, la route court-circuitait sur
    // l'e-mail déjà connu ; désormais, elle capture toujours une nouvelle
    // FamilyRequest (l'intention brute est préservée pour le staff), mais
    // tant que personne ne la convertit, aucun second compte n'apparaît --
    // la garantie « jamais de doublon » se déplace, elle ne disparaît pas.
    (auth as jest.Mock).mockResolvedValue(null);
    const retry = await registerBilan(registrationRequest());
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(registrationBody);
    expect(await prisma.user.count({ where: { email: parentEmail } })).toBe(1);
  });
});

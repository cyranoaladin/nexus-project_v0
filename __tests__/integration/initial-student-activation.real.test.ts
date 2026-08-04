/**
 * P0 initial student activation against a real, isolated PostgreSQL database.
 * No production database and no real minor identity may be used by this suite.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({ guardRateLimitAsync: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/email', () => ({ sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/email/mailer', () => ({ sendMail: jest.fn().mockResolvedValue(undefined) }));

import { POST as registerBilan } from '@/app/api/bilan-gratuit/route';
import { POST as createChild } from '@/app/api/parent/children/route';
import { POST as issueActivation } from '@/app/api/parent/children/[studentId]/activation/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { completeStudentActivation } from '@/lib/services/student-activation.service';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

const PREFIX = 'p0-initial-activation-';
const parentEmail = `${PREFIX}parent@example.test`;

function safeTestDatabase(): void {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  expect(target).toMatch(/(?:localhost|127\.0\.0\.1)/);
  expect(target).toMatch(/nexus_(?:p0_identity_test|test|e2e|bilan_runtime_test)/);
  expect(target).not.toMatch(/nexus_prod|production/i);
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

async function cleanup(): Promise<void> {
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
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('registers, issues from the owner, activates once and rejects replay/concurrency', async () => {
    const registration = await registerBilan(registrationRequest());
    expect(registration.status).toBe(200);
    const registrationBody = await registration.json();
    expect(registrationBody).toEqual(expect.objectContaining({ success: true }));
    expect(registrationBody).not.toHaveProperty('parentId');
    expect(registrationBody).not.toHaveProperty('studentId');

    const parent = await prisma.user.findUniqueOrThrow({
      where: { email: parentEmail },
      include: {
        parentProfile: {
          include: { children: { include: { user: true } } },
        },
      },
    });
    const child = parent.parentProfile?.children[0];
    expect(child?.id).toEqual(expect.any(String));
    expect(child?.user).toEqual(expect.objectContaining({
      role: 'ELEVE',
      password: null,
      activatedAt: null,
      activationToken: null,
      activationExpiry: null,
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

    (auth as jest.Mock).mockResolvedValue({
      user: { id: parent.id, role: 'PARENT', email: parent.email },
    });
    const homonyms = await Promise.all([
      createChild(childCreationRequest('Élève', 'Homonyme')),
      createChild(childCreationRequest('Eleve', 'Homonyme')),
    ]);
    expect(homonyms.map((response) => response.status)).toEqual([200, 200]);
    const homonymBodies = await Promise.all(homonyms.map((response) => response.json()));
    const homonymIdentifiers = homonymBodies.map((body) => body.child.email);
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

    const retry = await registerBilan(registrationRequest());
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(registrationBody);
    expect(await prisma.user.count({ where: { email: parentEmail } })).toBe(1);
  });
});

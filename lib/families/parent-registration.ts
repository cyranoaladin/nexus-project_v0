import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createParentStudentConsentContext } from '@/lib/bilans/parent-student-consent';

export const parentRegistrationSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  children: z.array(z.object({ studentId: z.string().min(1).max(128), confirmed: z.literal(true) }).strict()).min(1).max(100),
  consentStudentIds: z.array(z.string().min(1).max(128)).max(100).default([]),
}).strict();

export class ParentRegistrationError extends Error {
  constructor(readonly code: 'NOT_FOUND' | 'FAMILY_CHANGED' | 'INVALID_INPUT') { super(code); }
}

const registrationSelect = {
  id: true, role: true, activatedAt: true, mergedIntoUserId: true,
  firstName: true, lastName: true, phone: true, email: true, registrationCompletedAt: true,
  parentProfile: { select: { id: true, children: {
    orderBy: { id: 'asc' },
    select: { id: true, gradeLevel: true, academicTrack: true, schoolingStatus: true, school: true,
      user: { select: { firstName: true, lastName: true } } },
  } } },
} satisfies Prisma.UserSelect;

type RegistrationDatabase = Pick<PrismaClient, 'user' | 'parentStudentLink' | '$transaction'>;
async function currentParent(userId: string, database: Pick<Prisma.TransactionClient, 'user'>) {
  const parent = await database.user.findUnique({ where: { id: userId }, select: registrationSelect });
  if (!parent || parent.role !== 'PARENT' || !parent.activatedAt || parent.mergedIntoUserId || !parent.parentProfile) {
    throw new ParentRegistrationError('NOT_FOUND');
  }
  return parent;
}

// Optimistic concurrency for the information displayed to the parent. This is
// an opaque change detector, never an authorization or possession credential.
function registrationRevision(parent: Awaited<ReturnType<typeof currentParent>>) {
  const snapshot = {
    firstName: parent.firstName ?? '', lastName: parent.lastName ?? '',
    phone: parent.phone, email: parent.email,
    children: [...parent.parentProfile!.children].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(child => ({
      id: child.id, firstName: child.user.firstName ?? '', lastName: child.user.lastName ?? '',
      gradeLevel: child.gradeLevel, school: child.school, schoolingStatus: child.schoolingStatus,
    })),
  };
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export async function loadParentRegistration(userId: string, database: RegistrationDatabase = prisma) {
  const parent = await currentParent(userId, database);
  const now = new Date();
  const links = await database.parentStudentLink.findMany({
    where: { parentUserId: userId, studentId: { in: parent.parentProfile!.children.map(child => child.id) },
      state: 'VERIFIED', verifiedAt: { not: null }, revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    }, select: { studentId: true },
  });
  const verified = new Set(links.map(link => link.studentId));
  return {
    revision: registrationRevision(parent),
    firstName: parent.firstName ?? '', lastName: parent.lastName ?? '', phone: parent.phone,
    email: parent.email, completedAt: parent.registrationCompletedAt?.toISOString() ?? null,
    children: parent.parentProfile!.children.map(child => ({
      id: child.id, firstName: child.user.firstName ?? '', lastName: child.user.lastName ?? '',
      gradeLevel: child.gradeLevel, academicTrack: child.academicTrack, school: child.school,
      schoolingStatus: child.schoolingStatus, consentVerified: verified.has(child.id),
    })),
  };
}

export async function completeParentRegistration(userId: string, input: unknown, database: RegistrationDatabase = prisma) {
  const parsed = parentRegistrationSchema.safeParse(input);
  if (!parsed.success) throw new ParentRegistrationError('INVALID_INPUT');
  const data = parsed.data;
  const submitted = new Set(data.children.map(child => child.studentId));
  if (submitted.size !== data.children.length || new Set(data.consentStudentIds).size !== data.consentStudentIds.length) {
    throw new ParentRegistrationError('INVALID_INPUT');
  }
  return database.$transaction(async tx => {
    const parent = await currentParent(userId, tx);
    if (data.revision !== registrationRevision(parent)) throw new ParentRegistrationError('FAMILY_CHANGED');
    const children = parent.parentProfile!.children;
    const owned = new Set(children.map(child => child.id));
    if (submitted.size !== owned.size || children.some(child => !submitted.has(child.id)) || data.consentStudentIds.some(id => !owned.has(id))) {
      throw new ParentRegistrationError('FAMILY_CHANGED');
    }
    const now = new Date();
    if (data.consentStudentIds.length) {
      const consent = createParentStudentConsentContext(tx);
      for (const studentId of [...data.consentStudentIds].sort()) {
        await consent.verify({ parentUserId: userId, studentId, now });
      }
    }
    const result = await tx.user.updateMany({
      where: { id: userId, role: 'PARENT', activatedAt: { not: null }, mergedIntoUserId: null },
      data: { firstName: data.firstName, lastName: data.lastName, registrationCompletedAt: parent.registrationCompletedAt ?? now },
    });
    if (result.count !== 1) throw new ParentRegistrationError('NOT_FOUND');
    return { completedAt: (parent.registrationCompletedAt ?? now).toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

import 'server-only';

import { randomBytes } from 'crypto';
import type { GradeLevel, Prisma, Subject } from '@prisma/client';

import type { BilanChildInput } from '@/lib/bilans/requests/schemas';

type AttachChildInput = Readonly<{
  parentUserId: string;
  parentProfileId: string;
  child: BilanChildInput;
  level: GradeLevel;
  subject: Subject;
}>;

export type AttachedNewChild = Readonly<{
  studentId: string;
  studentUserId: string;
}>;

function opaqueChildEmail(): string {
  return `child+${randomBytes(12).toString('hex')}@nexus-student.local`;
}

export async function attachChildToNewParent(
  transaction: Prisma.TransactionClient,
  input: AttachChildInput,
): Promise<AttachedNewChild> {
  const studentUser = await transaction.user.create({
    data: {
      email: opaqueChildEmail(),
      role: 'ELEVE',
      firstName: input.child.firstName,
      lastName: input.child.lastName ?? null,
      password: null,
      activatedAt: null,
    },
    select: {
      id: true,
    },
  });

  const student = await transaction.student.create({
    data: {
      parentId: input.parentProfileId,
      userId: studentUser.id,
      grade: input.level,
      gradeLevel: input.level,
      academicTrack: 'EDS_GENERALE',
      specialties: [input.subject],
      school: input.child.schoolName ?? null,
    },
    select: {
      id: true,
    },
  });

  await transaction.parentStudentLink.create({
    data: {
      parentUserId: input.parentUserId,
      studentId: student.id,
      state: 'PENDING_PARENT_CONSENT',
    },
  });

  return {
    studentId: student.id,
    studentUserId: studentUser.id,
  };
}

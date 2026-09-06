/**
 * Student Activation Service (Modèle B)
 *
 * Flow:
 * 1. Assistante/parent triggers activation for a student
 * 2. System generates a hashed activation token + sets real email
 * 3. Activation email sent to student with magic link
 * 4. Student clicks link → sets password → account activated
 *
 * Security:
 * - Token is hashed (SHA-256) before storage
 * - Token expires after 72h
 * - Token invalidated after use
 * - Rate limited
 */

import { prisma } from '@/lib/prisma';
import { setStudentChosenCourses } from '@/lib/curriculum/enrollment';
import bcrypt from 'bcryptjs';
import { Prisma, type AcademicTrack, type GradeLevel, type StmgPathway } from '@prisma/client';
import { SYSTEM_PARENT_EMAIL } from '@/lib/constants';
import {
  buildStudentLoginIdentifier,
  isStudentLoginIdentifierCompatible,
} from '@/lib/services/student-login-identifier';
import {
  activationTokenMatchesPurpose,
  createActivationToken,
  hashActivationToken,
  type ActivationPurpose,
} from '@/lib/auth/activation-token';
import { buildTrustedActivationUrl } from '@/lib/auth/parent-activation';
import { hasUserEmail, normalizeUserEmail } from '@/lib/contact/user-email';

export interface ActivationResult {
  success: boolean;
  error?: string;
  activationUrl?: string;
  studentName?: string;
}

export interface SetPasswordResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
}

export type ParentOwnedActivationResult =
  | Readonly<{
      success: true;
      activationUrl: string;
      expiresAt: Date;
      loginIdentifier: string;
      studentName: string;
    }>
  | Readonly<{
      success: false;
      error: 'NOT_FOUND' | 'ALREADY_ACTIVATED';
    }>;

export type StudentTrackMetadata = {
  gradeLevel: GradeLevel;
  academicTrack: AcademicTrack;
  /**
   * Enseignements CHOISIS, en clés du catalogue versionné. Les enseignements
   * obligatoires ne se déclarent pas ici : ils sont dérivés du niveau et de la
   * voie.
   */
  academicCourseKeys: string[];
  stmgPathway?: StmgPathway;
  survivalMode?: boolean;
  survivalModeReason?: string;
};

type ActivationUserRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  activatedAt?: Date | null;
  student?: { id: string } | null;
};

type ActivationReservationRecord = {
  id: string;
  email: string;
  studentName: string | null;
  parentName: string;
  studentId: string | null;
};

function buildDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null
): string {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || fallback || 'Élève Nexus';
}

async function findPendingUserActivation(
  hashedToken: string,
  purpose: ActivationPurpose,
): Promise<ActivationUserRecord | null> {
  const user = await prisma.user.findFirst({
    where: {
      activationToken: hashedToken,
      activationExpiry: { gt: new Date() },
      activatedAt: null,
      role: purpose === 'parent' ? 'PARENT' : 'ELEVE',
      ...(purpose === 'parent' ? { mergedIntoUserId: null } : {}),
    },
    include: {
      student: { select: { id: true } },
    },
  });
  if (user === null || !hasUserEmail(user.email)) return null;
  return { ...user, email: user.email };
}

async function findPendingStageReservation(
  hashedToken: string
): Promise<ActivationReservationRecord | null> {
  return prisma.stageReservation.findFirst({
    where: {
      activationToken: hashedToken,
      activationTokenExpiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      studentName: true,
      parentName: true,
      studentId: true,
    },
  });
}

/**
 * Initiate student activation.
 * Called by assistante or parent.
 *
 * @param studentUserId - The User.id of the student to activate
 * @param studentEmail - The real email to set for the student
 * @param initiatorRole - Role of the person initiating (ADMIN, ASSISTANTE, PARENT)
 */
export async function initiateStudentActivation(
  studentUserId: string,
  studentEmail: string,
  initiatorRole: string,
  initiatorId: string,
  trackMetadata?: StudentTrackMetadata
): Promise<ActivationResult> {
  const normalizedStudentEmail = normalizeUserEmail(studentEmail);
  // Validate initiator role
  const allowedRoles = ['ADMIN', 'ASSISTANTE', 'PARENT'];
  if (!allowedRoles.includes(initiatorRole)) {
    return { success: false, error: 'Rôle non autorisé pour cette action' };
  }

  // Find the student user
  const studentUser = await prisma.user.findUnique({
    where: { id: studentUserId },
    include: { student: true },
  });

  if (!studentUser) {
    return { success: false, error: 'Élève introuvable' };
  }

  if (studentUser.role !== 'ELEVE') {
    return { success: false, error: 'Cet utilisateur n\'est pas un élève' };
  }

  if (studentUser.activatedAt) {
    return { success: false, error: 'Ce compte élève est déjà activé' };
  }

  // Vérification parentalité pour PARENT
  if (initiatorRole === 'PARENT') {
    const parentProfile = await prisma.parentProfile.findFirst({
      where: { userId: initiatorId },
      include: { children: { where: { userId: studentUserId } } },
    });
    if (!parentProfile || parentProfile.children.length === 0) {
      return { success: false, error: 'Vous n\'êtes pas le parent de cet élève' };
    }
  }

  // Check email uniqueness (skip if same as current)
  if (normalizedStudentEmail !== studentUser.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedStudentEmail },
    });
    if (existingEmail) {
      return { success: false, error: 'Cet email est déjà utilisé par un autre compte' };
    }
  }

  // Generate activation token
  const { rawToken, tokenHash, expiresAt } = createActivationToken('student');

  // Update student user with real email + activation token
  await prisma.user.update({
    where: { id: studentUserId },
    data: {
      email: normalizedStudentEmail,
      activationToken: tokenHash,
      activationExpiry: expiresAt,
      ...(normalizedStudentEmail !== studentUser.email ? { sessionVersion: { increment: 1 } } : {}),
    },
  });

  if (trackMetadata) {
    const { gradeLevel, academicTrack, academicCourseKeys, stmgPathway, survivalMode, survivalModeReason } = trackMetadata;
    const isStmg = academicTrack === 'STMG' || academicTrack === 'STMG_NON_LYCEEN';

    // Get parentId for create block
    let parentId = studentUser.student?.parentId;
    if (!parentId && initiatorRole === 'PARENT') {
      const parentProfile = await prisma.parentProfile.findFirst({
        where: { userId: initiatorId }
      });
      parentId = parentProfile?.id;
    }

    if (!parentId) {
      // Fallback to admin parent if still missing (edge case for orphaned students being activated by admin)
      const adminParent = await prisma.user.findFirst({
        where: { email: SYSTEM_PARENT_EMAIL },
        include: { parentProfile: true }
      });
      parentId = adminParent?.parentProfile?.id;
    }

    if (!parentId) {
      throw new Error('Impossible de trouver un profil parent pour cet élève');
    }

    const student = await prisma.student.upsert({
      where: { userId: studentUserId },
      update: {
        gradeLevel: gradeLevel as GradeLevel,
        academicTrack: academicTrack as AcademicTrack,
        stmgPathway: isStmg ? (stmgPathway ?? 'INDETERMINE') : null,
        survivalMode: isStmg ? Boolean(survivalMode) : false,
        survivalModeReason: isStmg && survivalMode ? (survivalModeReason ?? null) : null,
        survivalModeBy: isStmg && survivalMode ? initiatorId : null,
        survivalModeAt: isStmg && survivalMode ? new Date() : null,
        updatedTrackAt: new Date(),
        grade: gradeLevel.toString(), // Sync legacy grade
      },
      create: {
        userId: studentUserId,
        gradeLevel: gradeLevel as GradeLevel,
        academicTrack: academicTrack as AcademicTrack,
        stmgPathway: isStmg ? (stmgPathway ?? 'INDETERMINE') : null,
        survivalMode: isStmg ? Boolean(survivalMode) : false,
        survivalModeReason: isStmg && survivalMode ? (survivalModeReason ?? null) : null,
        survivalModeBy: isStmg && survivalMode ? initiatorId : null,
        survivalModeAt: isStmg && survivalMode ? new Date() : null,
        updatedTrackAt: new Date(),
        grade: gradeLevel.toString(), // Sync legacy grade
        parentId: parentId,
      },
    });

    // Les enseignements choisis passent par le service canonique : c'est lui
    // qui valide la cohérence avec le niveau et la voie, et il est le seul à
    // écrire des inscriptions. L'upsert ci-dessus renvoie déjà l'élève : pas
    // besoin d'une seconde lecture.
    if (student?.id) {
      await setStudentChosenCourses(
        student.id,
        {
          gradeLevel,
          academicTrack,
          stmgPathway: isStmg ? (stmgPathway ?? 'INDETERMINE') : null,
        },
        academicCourseKeys,
        { source: 'ASSISTANTE', verifiedById: initiatorId },
      );
    }
  }

  // Build activation URL
  const activationUrl = buildTrustedActivationUrl(rawToken, undefined, 'student').toString();

  return {
    success: true,
    activationUrl,
    studentName: `${studentUser.firstName} ${studentUser.lastName}`,
  };
}

/**
 * Issue or reissue an activation link for a child owned by the authenticated parent.
 * Ownership and token replacement are resolved in one transaction. Reissuing replaces
 * the stored hash, which revokes every previously issued raw token.
 */
/**
 * Lock the student row for the duration of the transaction so two concurrent
 * issuance calls for the SAME student (e.g. a double-click) are fully
 * serialized: the second call only starts reading once the first has
 * committed its new token, instead of both racing to overwrite the stored
 * hash independently (which would silently invalidate whichever response the
 * parent receives first, despite each request returning HTTP 200).
 */
async function lockOwnedStudentRowForActivation(
  transaction: Prisma.TransactionClient,
  parentProfileId: string,
  studentId: string,
): Promise<boolean> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "students"
    WHERE "id" = ${studentId} AND "parentId" = ${parentProfileId}
    FOR UPDATE
  `);
  return rows.length === 1;
}

export async function initiateParentOwnedStudentActivation(input: Readonly<{
  parentUserId: string;
  studentId: string;
}>): Promise<ParentOwnedActivationResult> {
  const prepared = await prisma.$transaction(async (transaction) => {
    const parent = await transaction.parentProfile.findUnique({
      where: { userId: input.parentUserId },
      select: { id: true },
    });
    if (parent === null) return { success: false, error: 'NOT_FOUND' } as const;

    const locked = await lockOwnedStudentRowForActivation(transaction, parent.id, input.studentId);
    if (!locked) return { success: false, error: 'NOT_FOUND' } as const;

    const student = await transaction.student.findFirst({
      where: {
        id: input.studentId,
        parentId: parent.id,
      },
      select: {
        user: {
          select: {
            id: true,
            role: true,
            email: true,
            firstName: true,
            lastName: true,
            activatedAt: true,
          },
        },
      },
    });
    if (student === null || student.user.role !== 'ELEVE') {
      return { success: false, error: 'NOT_FOUND' } as const;
    }
    if (student.user.activatedAt !== null) {
      return { success: false, error: 'ALREADY_ACTIVATED' } as const;
    }

    const { rawToken, tokenHash, expiresAt } = createActivationToken('student');
    const currentEmail = student.user.email;
    const loginIdentifier = hasUserEmail(currentEmail) && isStudentLoginIdentifierCompatible(currentEmail)
      ? currentEmail
      : buildStudentLoginIdentifier({
          firstName: student.user.firstName ?? 'eleve',
          lastName: student.user.lastName ?? 'nexus',
          uniqueSuffix: student.user.id,
        });
    const transition = await transaction.user.updateMany({
      where: {
        id: student.user.id,
        role: 'ELEVE',
        activatedAt: null,
      },
      data: {
        ...(loginIdentifier !== currentEmail ? { email: loginIdentifier } : {}),
        activationToken: tokenHash,
        activationExpiry: expiresAt,
        ...(loginIdentifier !== currentEmail ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    if (transition.count !== 1) {
      return { success: false, error: 'ALREADY_ACTIVATED' } as const;
    }

    return {
      success: true,
      rawToken,
      expiresAt,
      loginIdentifier,
      studentName: buildDisplayName(student.user.firstName, student.user.lastName),
    } as const;
  });

  if (!prepared.success) return prepared;
  return {
    success: true,
    activationUrl: buildTrustedActivationUrl(prepared.rawToken, undefined, 'student').toString(),
    expiresAt: prepared.expiresAt,
    loginIdentifier: prepared.loginIdentifier,
    studentName: prepared.studentName,
  };
}

/**
 * Complete student activation by setting password.
 * Called when student clicks the activation link.
 *
 * @param token - The raw activation token from the URL
 * @param password - The new password chosen by the student
 */
export async function completeStudentActivation(
  token: string,
  password: string,
  purpose: ActivationPurpose = 'student',
): Promise<SetPasswordResult> {
  // Validate password strength
  if (!password || password.length < 8) {
    return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
  }

  if (!activationTokenMatchesPurpose(token, purpose)) {
    return { success: false, error: 'Lien d\'activation invalide ou expiré' };
  }

  // Hash the token to find the matching role-bound user.
  const hashedToken = hashActivationToken(token);

  const user = await findPendingUserActivation(hashedToken, purpose);

  if (user) {
    // Hash password and activate
    const hashedPassword = await bcrypt.hash(password, 12);
    const activatedAt = new Date();
    const transition = await prisma.user.updateMany({
      where: {
        id: user.id,
        email: user.email,
        role: purpose === 'parent' ? 'PARENT' : 'ELEVE',
        ...(purpose === 'parent' ? { mergedIntoUserId: null } : {}),
        activationToken: hashedToken,
        activationExpiry: { gt: activatedAt },
        activatedAt: null,
      },
      data: {
        password: hashedPassword,
        activatedAt,
        ...(purpose === 'parent' ? { emailVerifiedAt: activatedAt } : {}),
        activationToken: null,
        activationExpiry: null,
        sessionVersion: { increment: 1 },
      },
    });
    if (transition.count !== 1) {
      return { success: false, error: 'Lien d\'activation invalide ou expiré' };
    }

    // Centre de notifications assistante : un parent qui active son espace
    // est un événement clé du suivi des bilans. Confort, jamais bloquant.
    if (purpose === 'parent') {
      try {
        const assistants = await prisma.user.findMany({
          where: { role: 'ASSISTANTE' },
          select: { id: true },
        });
        if (assistants.length > 0) {
          await prisma.notification.createMany({
            data: assistants.map(({ id }) => ({
              userId: id,
              userRole: 'ASSISTANTE' as const,
              type: 'BILAN_PARENT_ACTIVATED',
              title: 'Un parent a activé son espace',
              message: 'Un parent vient d’activer son espace Nexus : son accès aux bilans diffusés est désormais ouvert.',
              data: { parentUserId: user.id },
            })),
          });
        }
      } catch (error) {
        console.error(JSON.stringify({
          event: 'BILAN_PARENT_ACTIVATION_NOTIFICATION_FAILED',
          code: error instanceof Error ? error.name : 'UNKNOWN',
        }));
      }
    }

    return {
      success: true,
      redirectUrl: purpose === 'student'
        ? '/auth/signin?activated=true&callbackUrl=%2Fbilan-gratuit%2Fassessment'
        : '/auth/signin?activated=true',
    };
  }

  if (purpose !== 'student') {
    return { success: false, error: 'Lien d\'activation invalide ou expiré' };
  }

  const reservation = await findPendingStageReservation(hashedToken);
  if (!reservation) {
    return { success: false, error: 'Lien d\'activation invalide ou expiré' };
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const existingUser = await prisma.user.findFirst({
    where: {
      email: reservation.email,
      role: 'ELEVE',
    },
    include: {
      student: { select: { id: true } },
    },
  });

  const activatedAt = new Date();
  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        activatedAt,
        sessionVersion: { increment: 1 },
      },
    });
  } else {
    await prisma.user.create({
      data: {
        email: reservation.email,
        role: 'ELEVE',
        firstName: reservation.studentName?.split(' ')[0] ?? reservation.parentName.split(' ')[0],
        lastName: reservation.studentName?.split(' ').slice(1).join(' ') || reservation.parentName.split(' ').slice(1).join(' '),
        password: hashedPassword,
        activatedAt,
      },
    });
  }

  await prisma.stageReservation.update({
    where: { id: reservation.id },
    data: {
      activationToken: null,
      activationTokenExpiresAt: null,
      studentId: reservation.studentId ?? existingUser?.student?.id ?? null,
    },
  });

  return {
    success: true,
    redirectUrl: '/auth/signin?activated=true',
  };
}

/**
 * Verify an activation token without consuming it.
 * Used to show the set-password form.
 *
 * @param token - The raw activation token from the URL
 */
export async function verifyActivationToken(
  token: string,
  purpose: ActivationPurpose = 'student',
): Promise<{ valid: boolean; studentName?: string; email?: string; accountRole?: string }> {
  if (!activationTokenMatchesPurpose(token, purpose)) return { valid: false };

  const hashedToken = hashActivationToken(token);

  const user = await findPendingUserActivation(hashedToken, purpose);
  if (user) {
    return {
      valid: true,
      studentName: buildDisplayName(user.firstName, user.lastName),
      email: user.email,
      accountRole: user.role,
    };
  }

  if (purpose !== 'student') return { valid: false };

  const reservation = await findPendingStageReservation(hashedToken);
  if (!reservation) {
    return { valid: false };
  }

  return {
    valid: true,
    studentName: buildDisplayName(null, null, reservation.studentName || reservation.parentName),
    email: reservation.email,
    accountRole: 'ELEVE',
  };
}

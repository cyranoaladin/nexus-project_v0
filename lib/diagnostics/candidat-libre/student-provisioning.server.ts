import 'server-only';

import type { GradeLevel } from '@prisma/client';

import { createActivationToken } from '@/lib/auth/activation-token';
import { prisma } from '@/lib/prisma';

/**
 * Provisionnement de l'élève candidat libre.
 *
 * Aucun chemin existant ne permet à un élève d'avoir une adresse réelle **et**
 * de choisir son mot de passe : les routes de création forcent l'identifiant
 * synthétique `@nexus-student.local`, et la route admin impose un mot de passe
 * choisi par un tiers puis laisse le compte inactivable. Pour un mineur dont on
 * traitera la pièce d'identité, aucune des deux situations n'est acceptable.
 *
 * Ce chemin est **délibérément isolé** du flux add-child du bilan gratuit, qui
 * tourne en production et sert les familles : la duplication d'une poignée de
 * lignes coûte moins cher qu'une régression sur du live. Il ne réutilise que
 * `createActivationToken`, une primitive pure sans effet de bord.
 *
 * Il ne pose jamais de mot de passe et n'en retourne aucun. L'activation
 * elle-même reste assurée par `completeStudentActivation`, inchangée : elle
 * retrouve le compte par empreinte du token et enregistre le mot de passe que
 * l'élève choisit.
 */

export class StudentProvisioningError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'StudentProvisioningError';
  }
}

/** Domaine synthétique du flux add-child : interdit ici, on veut une vraie adresse. */
const SYNTHETIC_STUDENT_DOMAIN = '@nexus-student.local';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeRealEmail(value: string): string {
  const email = (value ?? '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new StudentProvisioningError('INVALID_EMAIL');
  if (email.endsWith(SYNTHETIC_STUDENT_DOMAIN)) {
    throw new StudentProvisioningError('SYNTHETIC_EMAIL_REJECTED');
  }
  return email;
}

export type ProvisionedCandidateStudent = Readonly<{
  studentId: string;
  userId: string;
  /**
   * Token en clair, à transmettre **uniquement** par le lien d'activation
   * envoyé à l'élève. Seule son empreinte est stockée.
   */
  activationToken: string;
  activationTokenExpiresAt: Date;
}>;

export async function provisionCandidateLibreStudent(input: Readonly<{
  parentUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  gradeLevel: GradeLevel;
  school?: string;
}>): Promise<ProvisionedCandidateStudent> {
  const email = normalizeRealEmail(input.email);
  const token = createActivationToken('student');

  return prisma.$transaction(async (transaction) => {
    const parentProfile = await transaction.parentProfile.findUnique({
      where: { userId: input.parentUserId },
      select: { id: true },
    });
    if (!parentProfile) throw new StudentProvisioningError('PARENT_NOT_FOUND');

    const existing = await transaction.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) throw new StudentProvisioningError('EMAIL_ALREADY_USED');

    const user = await transaction.user.create({
      data: {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: 'ELEVE',
        // Le compte reste sans mot de passe et inactif : l'élève le choisira
        // lui-même à l'activation. Personne d'autre ne le fixe.
        password: null,
        activationToken: token.tokenHash,
        activationExpiry: token.expiresAt,
      },
    });

    const student = await transaction.student.create({
      data: {
        userId: user.id,
        parentId: parentProfile.id,
        gradeLevel: input.gradeLevel,
        school: input.school ?? null,
      },
    });

    return Object.freeze({
      studentId: student.id,
      userId: user.id,
      activationToken: token.rawToken,
      activationTokenExpiresAt: token.expiresAt,
    });
  });
}

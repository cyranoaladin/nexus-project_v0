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
import { createId } from '@paralleldrive/cuid2';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/** Hash an activation token for safe storage */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Generate a secure random activation token */
function generateActivationToken(): { raw: string; hashed: string } {
  const raw = `act_${createId()}_${crypto.randomBytes(16).toString('hex')}`;
  return { raw, hashed: hashToken(raw) };
}

/** Token validity duration: 72 hours */
const TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000;

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
  initiatorRole: string
): Promise<ActivationResult> {
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

  // Check email uniqueness (skip if same as current)
  if (studentEmail !== studentUser.email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email: studentEmail },
    });
    if (existingEmail) {
      return { success: false, error: 'Cet email est déjà utilisé par un autre compte' };
    }
  }

  // Generate activation token
  const { raw, hashed } = generateActivationToken();
  const expiry = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Update student user with real email + activation token
  await prisma.user.update({
    where: { id: studentUserId },
    data: {
      email: studentEmail,
      activationToken: hashed,
      activationExpiry: expiry,
    },
  });

  // Build activation URL
  const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';
  const activationUrl = `${baseUrl}/auth/activate?token=${encodeURIComponent(raw)}`;

  return {
    success: true,
    activationUrl,
    studentName: `${studentUser.firstName} ${studentUser.lastName}`,
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
  password: string
): Promise<SetPasswordResult> {
  // Validate password strength
  if (!password || password.length < 8) {
    return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
  }

  // Hash the token to find the matching user
  const hashedToken = hashToken(token);

  const user = await prisma.user.findFirst({
    where: {
      activationToken: hashedToken,
      activationExpiry: { gt: new Date() }, // Not expired
      activatedAt: null, // Not already activated
    },
  });

  if (!user) {
    return { success: false, error: 'Lien d\'activation invalide ou expiré' };
  }

  // Hash password and activate
  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      activatedAt: new Date(),
      activationToken: null, // Invalidate token after use
      activationExpiry: null,
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
  token: string
): Promise<{ valid: boolean; studentName?: string; email?: string }> {
  const hashedToken = hashToken(token);

  const user = await prisma.user.findFirst({
    where: {
      activationToken: hashedToken,
      activationExpiry: { gt: new Date() },
      activatedAt: null,
    },
  });

  if (!user) {
    return { valid: false };
  }

  return {
    valid: true,
    studentName: `${user.firstName} ${user.lastName}`,
    email: user.email,
  };
}

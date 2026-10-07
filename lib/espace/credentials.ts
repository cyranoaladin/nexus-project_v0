/**
 * Changement autonome du code personnel (élève) / du mot de passe (enseignant) et réinitialisation d'un
 * élève par son enseignant.
 *
 * Principes :
 *  - l'identité vient UNIQUEMENT de la session (jamais d'un identifiant envoyé par le client) ;
 *  - le secret actuel est exigé pour tout changement autonome ;
 *  - on réutilise les mécanismes existants : bcrypt (code : `hashPin`, mot de passe : coût 12 comme le reste de Nexus) ;
 *  - aucune valeur secrète (ni hash) n'est journalisée ni inscrite dans le journal de sécurité ;
 *  - l'enseignant ne peut JAMAIS lire un code : il ne peut que le réinitialiser (code temporaire affiché une seule fois) ;
 *  - toute modification révoque les sessions existantes (`sessionVersion`), y compris la session courante.
 */
import bcrypt from 'bcryptjs';

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

import { checkStudentCode, checkTeacherPassword, rejectionMessage, type CredentialKind } from './credential-rules';
import { EspaceError } from './errors';
import type { EspaceActor } from './guards';
import { formatPin, generatePin, hashPin, verifyPin } from './pin';

export const SECURITY_EVENT = {
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_BY_TEACHER: 'PASSWORD_RESET_BY_TEACHER',
} as const;

const TEACHER_BCRYPT_COST = 12;

export interface ChangeCredentialInput {
  current: unknown;
  next: unknown;
  confirm: unknown;
}

async function recordEvent(tx: Pick<typeof prisma, 'espaceSecurityEvent'>, input: { userId: string; actorId: string | null; type: string }) {
  // Jamais de secret ni de hash ici : identité, auteur, nature, date.
  await tx.espaceSecurityEvent.create({ data: { userId: input.userId, actorId: input.actorId, type: input.type } });
}

/** Change le secret de l'utilisateur AUTHENTIFIÉ. Lève une `EspaceError` au message sobre en cas de refus. */
export async function changeOwnCredential(actor: EspaceActor, input: ChangeCredentialInput): Promise<{ kind: CredentialKind }> {
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, role: true, username: true, email: true, firstName: true, lastName: true, pinHash: true, password: true, disabledAt: true },
  });
  if (!user || user.disabledAt) throw new EspaceError('UNAUTHENTICATED', 'Connexion requise');

  const isStudent = user.role === 'ELEVE';
  const kind: CredentialKind = isStudent ? 'code' : 'password';
  const noun = isStudent ? 'code personnel' : 'mot de passe';

  if (typeof input.current !== 'string' || typeof input.next !== 'string' || typeof input.confirm !== 'string') {
    throw new EspaceError('INVALID_INPUT', 'Requête invalide');
  }

  // 1. Le secret actuel est exigé (même pour une session ouverte).
  const storedHash = isStudent ? user.pinHash : user.password;
  const currentOk = storedHash
    ? isStudent
      ? await verifyPin(input.current, storedHash)
      : input.current.length > 0 && input.current.length <= 200 && (await bcrypt.compare(input.current, storedHash))
    : false;
  if (!currentOk) {
    throw new EspaceError('INVALID_INPUT', `Le ${noun} actuel est incorrect.`, { field: 'current' });
  }

  // 2. Confirmation identique.
  if (input.next !== input.confirm) {
    throw new EspaceError('INVALID_INPUT', `Les deux nouveaux ${isStudent ? 'codes' : 'mots de passe'} ne correspondent pas.`, { field: 'confirm' });
  }

  // 3. Force du nouveau secret.
  const ctx = { username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email };
  let newHash: string;
  if (isStudent) {
    const checked = checkStudentCode(input.next, ctx);
    if (!checked.ok) throw new EspaceError('INVALID_INPUT', rejectionMessage(checked.reason, kind), { field: 'next', reason: checked.reason });
    if (await verifyPin(input.next, user.pinHash!)) {
      throw new EspaceError('INVALID_INPUT', rejectionMessage('SAME_AS_CURRENT', kind), { field: 'next', reason: 'SAME_AS_CURRENT' });
    }
    newHash = await hashPin(checked.normalized);
  } else {
    const checked = checkTeacherPassword(input.next, ctx);
    if (!checked.ok) throw new EspaceError('INVALID_INPUT', rejectionMessage(checked.reason, kind), { field: 'next', reason: checked.reason });
    if (input.next === input.current) {
      throw new EspaceError('INVALID_INPUT', rejectionMessage('SAME_AS_CURRENT', kind), { field: 'next', reason: 'SAME_AS_CURRENT' });
    }
    newHash = await bcrypt.hash(input.next, TEACHER_BCRYPT_COST);
  }

  // 4. Écriture atomique : nouveau hash, sessions révoquées, événement de sécurité.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: isStudent
          ? { pinHash: newHash, pinSetAt: new Date(), pinMustChange: false, sessionVersion: { increment: 1 } }
          : { password: newHash, sessionVersion: { increment: 1 } },
        select: { id: true },
      });
      await recordEvent(tx, { userId: user.id, actorId: user.id, type: SECURITY_EVENT.PASSWORD_CHANGED });
    });
  } catch (e) {
    logger.error({ errorName: e instanceof Error ? e.name : 'unknown' }, '[ESPACE] Credential change failed');
    throw new EspaceError('INVALID_INPUT', `Le changement n’a pas pu être enregistré. Votre ${noun} actuel reste valide.`, { field: 'server' });
  }
  logger.info({ event: SECURITY_EVENT.PASSWORD_CHANGED, role: user.role }, '[ESPACE] Credential changed');
  return { kind };
}

/** L'enseignant (ou l'admin) enseigne-t-il à cet élève, dans au moins un couple groupe × matière ? */
export async function teacherHasStudent(actor: EspaceActor, studentId: string): Promise<boolean> {
  if (actor.role === 'ADMIN') return true;
  if (actor.role !== 'COACH') return false;
  const assignments = await prisma.espaceTeacherAssignment.findMany({
    where: { teacherId: actor.id },
    select: { groupId: true, subject: true },
  });
  if (assignments.length === 0) return false;
  const row = await prisma.espaceEnrollment.findFirst({
    where: { userId: studentId, OR: assignments.map((a) => ({ groupId: a.groupId, subject: a.subject })) },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Réinitialise le code d'un élève affecté à l'enseignant : code temporaire aléatoire, hash seul stocké,
 * l'élève devra choisir son propre code à la connexion suivante. Le code n'est renvoyé qu'ici, une seule fois.
 */
export async function resetStudentCodeByTeacher(actor: EspaceActor, studentId: string): Promise<{ code: string }> {
  if (actor.role !== 'COACH' && actor.role !== 'ADMIN') throw new EspaceError('FORBIDDEN', 'Accès refusé');
  // 404 indiscernable : un enseignant ne sonde pas l'existence d'élèves hors de son périmètre.
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: 'ELEVE', username: { not: null }, disabledAt: null, mergedIntoUserId: null },
    select: { id: true },
  });
  if (!student || !(await teacherHasStudent(actor, student.id))) throw new EspaceError('NOT_FOUND', 'Élève introuvable');

  const code = generatePin();
  const pinHash = await hashPin(code);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: student.id },
        data: { pinHash, pinSetAt: new Date(), pinMustChange: true, sessionVersion: { increment: 1 } },
        select: { id: true },
      });
      await recordEvent(tx, { userId: student.id, actorId: actor.id, type: SECURITY_EVENT.PASSWORD_RESET_BY_TEACHER });
    });
  } catch (e) {
    logger.error({ errorName: e instanceof Error ? e.name : 'unknown' }, '[ESPACE] Student code reset failed');
    throw new EspaceError('INVALID_INPUT', 'La réinitialisation n’a pas pu être enregistrée. Le code actuel reste valide.');
  }
  logger.info({ event: SECURITY_EVENT.PASSWORD_RESET_BY_TEACHER, actorRole: actor.role }, '[ESPACE] Student code reset');
  return { code: formatPin(code) };
}

/**
 * Connexion de l'espace pédagogique : identifiant + secret, sans email.
 *
 *  - ELEVE  : `username` + code personnel (comparé à `User.pinHash`).
 *  - COACH  : `username` + mot de passe (comparé à `User.password`).
 *  - tout autre rôle (dont ADMIN) est refusé ici : ils passent par le flux
 *    email existant, qui reste inchangé.
 *
 * Toute cause d'échec renvoie le même `null` (identifiant inconnu, mauvais
 * secret, compte désactivé, non activé, mauvais rôle) : l'appelant ne peut pas
 * en déduire quels identifiants existent. Une comparaison bcrypt factice est
 * exécutée quand le compte est absent ou inutilisable, pour que le temps de
 * réponse ne l'indique pas non plus.
 */
import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { PIN_BCRYPT_COST, normalizePin } from '@/lib/espace/pin';
import { normalizeUsername } from '@/lib/espace/username';

export interface EspaceAuthorizedUser {
  id: string;
  email: string | null;
  role: 'ELEVE' | 'COACH';
  firstName?: string;
  lastName?: string;
  sessionVersion: number;
  authority: 'V1';
}

const MAX_SECRET_LENGTH = 200;
let dummyHash: string | null = null;

async function burnComparison(secret: string): Promise<null> {
  // Valeur aléatoire propre au processus : aucun secret factice fixe à deviner.
  dummyHash ??= await bcrypt.hash(randomBytes(24).toString('hex'), PIN_BCRYPT_COST);
  await bcrypt.compare(secret, dummyHash);
  return null;
}

export async function authorizeEspaceCredentials(
  credentials: Partial<Record<'username' | 'secret', unknown>>,
): Promise<EspaceAuthorizedUser | null> {
  const username = normalizeUsername(credentials.username);
  const secret = credentials.secret;
  if (!username || typeof secret !== 'string' || secret.length === 0 || secret.length > MAX_SECRET_LENGTH) return null;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      sessionVersion: true,
      activatedAt: true,
      disabledAt: true,
      mergedIntoUserId: true,
      pinHash: true,
      password: true,
    },
  });

  if (!user || user.disabledAt || user.mergedIntoUserId) return burnComparison(secret);

  let hash: string | null;
  let candidate: string | null;
  if (user.role === 'ELEVE') {
    if (!user.activatedAt) return burnComparison(secret);
    hash = user.pinHash;
    candidate = normalizePin(secret);
  } else if (user.role === 'COACH') {
    hash = user.password;
    candidate = secret;
  } else {
    return burnComparison(secret);
  }

  if (!hash || !candidate) return burnComparison(secret);
  if (!(await bcrypt.compare(candidate, hash))) return null;

  logger.info({ role: user.role, authority: 'V1', channel: 'espace' }, '[AUTH] Login success');
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    sessionVersion: user.sessionVersion,
    authority: 'V1',
  };
}

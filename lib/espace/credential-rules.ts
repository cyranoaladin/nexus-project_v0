/**
 * Règles de choix d'un code personnel (élève) ou d'un mot de passe (enseignant).
 * Fonctions pures : testées sans base. Aucune valeur n'est journalisée.
 */
import { normalizePin } from './pin';

export const STUDENT_CODE_MIN = 6;
export const STUDENT_CODE_MAX = 32;
export const TEACHER_PASSWORD_MIN = 12;
export const TEACHER_PASSWORD_MAX = 128;

export type CredentialRejection = 'EMPTY' | 'TOO_SHORT' | 'TOO_LONG' | 'BAD_CHARACTERS' | 'TOO_WEAK' | 'SAME_AS_CURRENT';

export interface CredentialContext {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

const STUDENT_TRIVIAL = new Set([
  '123456', '1234567', '12345678', '123456789', '654321', '000000', '00000000', '111111', '222222', '333333', '444444',
  '555555', '666666', '777777', '888888', '999999', '121212', '112233', '123123', '147258', '159753', '102030',
  'ABCDEF', 'ABCDEFG', 'ABCDEFGH', 'AZERTY', 'AZERTYUIOP', 'QWERTY', 'QWERTYUI', 'AAAAAA', 'PASSWORD', 'PASSWORD1',
  'MOTDEPASSE', 'NEXUS', 'NEXUS2026', 'NEXUS123', 'NEXUSREUSSITE', 'ELEVE123', 'CODE123', 'BONJOUR', 'SOLEIL', 'TUNISIE',
]);

const TEACHER_TRIVIAL = [
  'password', 'motdepasse', 'azertyuiop', 'qwertyuiop', '123456789012', 'nexus2026', 'nexusreussite', 'administrateur',
  'azerty123456', 'password1234', 'changeme', 'letmein',
];

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function personalTokens(ctx: CredentialContext): string[] {
  const parts = [ctx.username, ctx.firstName, ctx.lastName, ctx.email?.split('@')[0]]
    .map((p) => (p ? fold(p) : ''))
    .filter((p) => p.length >= 3);
  const full = ctx.firstName && ctx.lastName ? fold(`${ctx.firstName}${ctx.lastName}`) : '';
  const email = ctx.email ? fold(ctx.email) : '';
  return [...parts, ...(full ? [full] : []), ...(email.length >= 3 ? [email] : [])];
}

function isSequence(value: string): boolean {
  if (value.length < 4) return false;
  let up = true;
  let down = true;
  for (let i = 1; i < value.length; i += 1) {
    const d = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
  }
  return up || down;
}

/** Code personnel d'élève : lettres et chiffres, 6 à 32 caractères, casse et tirets sans effet (comme à la connexion). */
export function checkStudentCode(raw: unknown, ctx: CredentialContext): { ok: true; normalized: string } | { ok: false; reason: CredentialRejection } {
  if (typeof raw !== 'string' || raw.trim().length === 0) return { ok: false, reason: 'EMPTY' };
  const normalized = normalizePin(raw);
  if (!normalized) return { ok: false, reason: 'EMPTY' };
  if (!/^[A-Z0-9]+$/.test(normalized)) return { ok: false, reason: 'BAD_CHARACTERS' };
  if (normalized.length < STUDENT_CODE_MIN) return { ok: false, reason: 'TOO_SHORT' };
  if (normalized.length > STUDENT_CODE_MAX) return { ok: false, reason: 'TOO_LONG' };
  if (STUDENT_TRIVIAL.has(normalized)) return { ok: false, reason: 'TOO_WEAK' };
  if (/^(.)\1+$/.test(normalized)) return { ok: false, reason: 'TOO_WEAK' };
  if (isSequence(normalized)) return { ok: false, reason: 'TOO_WEAK' };
  if (new Set(normalized).size <= 2) return { ok: false, reason: 'TOO_WEAK' };
  const folded = fold(normalized);
  for (const token of personalTokens(ctx)) {
    // Le code ne peut pas être (ou presque) l'identifiant, le prénom ou le nom.
    if (folded === token || (token.length >= 4 && folded.includes(token) && folded.length <= token.length + 3)) {
      return { ok: false, reason: 'TOO_WEAK' };
    }
  }
  return { ok: true, normalized };
}

/** Mot de passe enseignant : au moins 12 caractères, phrases de passe acceptées, aucune règle de composition absurde. */
export function checkTeacherPassword(raw: unknown, ctx: CredentialContext): { ok: true } | { ok: false; reason: CredentialRejection } {
  if (typeof raw !== 'string' || raw.trim().length === 0) return { ok: false, reason: 'EMPTY' };
  if (raw.length > TEACHER_PASSWORD_MAX) return { ok: false, reason: 'TOO_LONG' };
  if (raw.trim().length < TEACHER_PASSWORD_MIN) return { ok: false, reason: 'TOO_SHORT' };
  const folded = fold(raw);
  if (folded.length < 8) return { ok: false, reason: 'TOO_WEAK' };
  if (new Set(folded).size <= 3) return { ok: false, reason: 'TOO_WEAK' };
  if (TEACHER_TRIVIAL.some((t) => folded === t || folded === `${t}${t}`)) return { ok: false, reason: 'TOO_WEAK' };
  for (const token of personalTokens(ctx)) {
    if (folded === token || (token.length >= 4 && folded.includes(token) && folded.length <= token.length + 4)) {
      return { ok: false, reason: 'TOO_WEAK' };
    }
  }
  return { ok: true };
}

export type CredentialKind = 'code' | 'password';

export function rejectionMessage(reason: CredentialRejection, kind: CredentialKind): string {
  const noun = kind === 'code' ? 'code' : 'mot de passe';
  switch (reason) {
    case 'EMPTY':
      return `Saisissez le nouveau ${noun}.`;
    case 'TOO_SHORT':
      return kind === 'code'
        ? `Le nouveau code est trop court : ${STUDENT_CODE_MIN} caractères au minimum.`
        : `Le nouveau mot de passe est trop court : ${TEACHER_PASSWORD_MIN} caractères au minimum (une phrase de passe convient).`;
    case 'TOO_LONG':
      return `Le nouveau ${noun} est trop long.`;
    case 'BAD_CHARACTERS':
      return 'Utilisez uniquement des lettres et des chiffres.';
    case 'TOO_WEAK':
      return kind === 'code' ? 'Choisissez un code personnel plus difficile à deviner.' : 'Choisissez un mot de passe plus difficile à deviner.';
    case 'SAME_AS_CURRENT':
      return `Le nouveau ${noun} doit être différent de l’actuel.`;
  }
}

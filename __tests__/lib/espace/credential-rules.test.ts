import { checkStudentCode, checkTeacherPassword, rejectionMessage } from '@/lib/espace/credential-rules';
import { RateLimitPresets } from '@/lib/rate-limit/runtime';
import { SENSITIVE_RATE_LIMIT_POLICIES } from '@/lib/rate-limit/sensitive';

const student = { username: 'adam.c', firstName: 'Adam', lastName: 'CHARPENTIER' };
const teacher = { username: 'alaeddine', firstName: 'Alaeddine', lastName: 'BEN RHOUMA', email: 'prof.exemple@example.test' };

describe('code personnel de l’élève', () => {
  it('accepte un code de 6 caractères ou plus, lettres et chiffres, casse et tirets sans effet', () => {
    expect(checkStudentCode('Lune8Fox', student)).toEqual({ ok: true, normalized: 'LUNE8FOX' });
    expect(checkStudentCode('ab-12 cd', student)).toEqual({ ok: true, normalized: 'AB12CD' });
    expect(checkStudentCode('K7m2Qp', student)).toMatchObject({ ok: true });
  });

  it.each([
    ['123456'], ['000000'], ['111111'], ['abcdef'], ['password'], ['nexus'], ['654321'], ['azerty'], ['qwerty'],
    ['aaaaaa'], ['12345678'], ['ababab'], ['NEXUS2026'],
  ])('refuse la valeur triviale %s', (value) => {
    expect(checkStudentCode(value, student).ok).toBe(false);
  });

  it('refuse trop court, vide, espaces seuls, caractères spéciaux et trop long', () => {
    expect(checkStudentCode('ab12', student)).toEqual({ ok: false, reason: 'TOO_SHORT' });
    expect(checkStudentCode('', student)).toEqual({ ok: false, reason: 'EMPTY' });
    expect(checkStudentCode('      ', student)).toEqual({ ok: false, reason: 'EMPTY' });
    expect(checkStudentCode('abc!@#def', student)).toEqual({ ok: false, reason: 'BAD_CHARACTERS' });
    expect(checkStudentCode('A1'.repeat(20), student)).toEqual({ ok: false, reason: 'TOO_LONG' });
    expect(checkStudentCode(undefined, student)).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('refuse l’identifiant, le prénom ou le nom (seuls ou presque)', () => {
    expect(checkStudentCode('adamc', student).ok).toBe(false);
    expect(checkStudentCode('Adam', { ...student, firstName: 'Adam' }).ok).toBe(false);
    expect(checkStudentCode('charpentier', student).ok).toBe(false);
    expect(checkStudentCode('charpentier1', student).ok).toBe(false);
    expect(checkStudentCode('adamcharpentier', student).ok).toBe(false);
    // Un code qui n'a qu'un lien lointain avec le nom reste accepté.
    expect(checkStudentCode('Charpentier-Lune-77', student).ok).toBe(true);
  });

  it('les messages sont sobres et distincts', () => {
    expect(rejectionMessage('TOO_WEAK', 'code')).toBe('Choisissez un code personnel plus difficile à deviner.');
    expect(rejectionMessage('TOO_SHORT', 'password')).toContain('12 caractères');
  });
});

describe('mot de passe de l’enseignant', () => {
  it('accepte une phrase de passe sans règle de composition', () => {
    expect(checkTeacherPassword('le cheval gris traverse la vallée', teacher).ok).toBe(true);
    expect(checkTeacherPassword('XBJ466-5CEt9W-E4GVLY-GEbtZJ', teacher).ok).toBe(true);
    expect(checkTeacherPassword('motsdepassetreslongs mais memorisables', teacher).ok).toBe(true);
  });

  it('refuse moins de 12 caractères, vide, trop long et valeurs triviales', () => {
    expect(checkTeacherPassword('court1234', teacher)).toEqual({ ok: false, reason: 'TOO_SHORT' });
    expect(checkTeacherPassword('', teacher)).toEqual({ ok: false, reason: 'EMPTY' });
    expect(checkTeacherPassword('x'.repeat(129), teacher)).toEqual({ ok: false, reason: 'TOO_LONG' });
    expect(checkTeacherPassword('aaaaaaaaaaaaaa', teacher).ok).toBe(false);
    expect(checkTeacherPassword('password', teacher).ok).toBe(false);
    expect(checkTeacherPassword('Nexus2026', teacher).ok).toBe(false);
    expect(checkTeacherPassword('administrateur', teacher).ok).toBe(false);
  });

  it('refuse l’identifiant, le nom ou l’e-mail comme mot de passe', () => {
    expect(checkTeacherPassword('alaeddine.benrhouma', teacher).ok).toBe(false);
    expect(checkTeacherPassword('prof.exemple@example.test', teacher).ok).toBe(false);
    expect(checkTeacherPassword('Alaeddine BEN RHOUMA', teacher).ok).toBe(false);
  });
});

describe('limiteur du changement de secret', () => {
  it('borne le devinage de l’ancien secret par utilisateur authentifié (6 essais / 15 min)', () => {
    expect(SENSITIVE_RATE_LIMIT_POLICIES['espace-credential']).toMatchObject({ identityPreset: 'espaceCredentialIdentity' });
    expect(RateLimitPresets.espaceCredentialIdentity).toEqual({ limit: 6, windowMs: 15 * 60_000 });
    expect(SENSITIVE_RATE_LIMIT_POLICIES['espace-credential-reset']).toMatchObject({ identityPreset: 'espaceCredentialResetIdentity' });
  });
});

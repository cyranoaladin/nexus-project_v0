/**
 * Amorçage du premier ADMIN Core depuis un ADMIN Core v1 existant.
 *
 * Contrat : jamais d'invitation, jamais de credential Core, identité désignée
 * par son identifiant immuable et non par son adresse, et rien d'autre créé que
 * l'acteur, son rôle et un reçu.
 *
 * Ce test couvre l'éligibilité et l'empreinte du manifeste sans base : ce sont
 * des décisions pures, et elles doivent rester vraies indépendamment du schéma.
 */
import { fingerprintOfBootstrapManifest, parseBootstrapManifest } from '@/lib/core-v2/accounts/bootstrap-manifest';
import { assertEligibleV1Admin, type V1AdminSnapshot } from '@/lib/core-v2/accounts/bootstrap-v1-admin';
import { InvalidStateError, NotFoundError, ValidationError } from '@/lib/core-v2/errors';

const ID = 'ckv1admin0000000000000001';

function snapshot(patch: Partial<V1AdminSnapshot> = {}): V1AdminSnapshot {
  return {
    id: ID,
    role: 'ADMIN',
    activatedAt: new Date('2026-04-01T09:00:00.000Z'),
    disabledAt: null,
    mergedIntoUserId: null,
    ...patch,
  };
}

describe('éligibilité de l’identité V1', () => {
  test('un ADMIN activé, non désactivé et non fusionné est éligible', () => {
    expect(assertEligibleV1Admin(snapshot(), ID)).toMatchObject({ id: ID, role: 'ADMIN' });
  });

  test('une identité absente est refusée', () => {
    expect(() => assertEligibleV1Admin(null, ID)).toThrow(NotFoundError);
  });

  test.each([
    ['rôle non ADMIN', { role: 'ASSISTANTE' }, 'V1_NOT_ADMIN'],
    ['non activé', { activatedAt: null }, 'V1_NOT_ACTIVATED'],
    ['désactivé', { disabledAt: new Date('2026-09-01T00:00:00.000Z') }, 'V1_DISABLED'],
    ['fusionné', { mergedIntoUserId: 'autre' }, 'V1_MERGED'],
  ])('%s est refusé fermé', (_label, patch, code) => {
    try {
      assertEligibleV1Admin(snapshot(patch as Partial<V1AdminSnapshot>), ID);
      throw new Error('aurait dû refuser');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidStateError);
      expect(JSON.stringify((error as InvalidStateError).details)).toContain(code);
    }
  });

  test('une adresse e-mail ne peut pas servir d’identifiant', () => {
    // Une adresse peut changer de porteur : elle ne désigne pas une identité.
    expect(() => assertEligibleV1Admin(snapshot({ id: 'admin@example.test' }), 'admin@example.test'))
      .toThrow(ValidationError);
  });

  test('un identifiant trop court est refusé', () => {
    expect(() => assertEligibleV1Admin(snapshot({ id: 'court' }), 'court')).toThrow(ValidationError);
  });

  test('une identité résolue qui ne porte pas l’identifiant attendu est refusée', () => {
    expect(() => assertEligibleV1Admin(snapshot({ id: 'ckv1admin0000000000000999' }), ID))
      .toThrow(ValidationError);
  });
});

describe('empreinte du manifeste', () => {
  const base = {
    finalSha: 'a'.repeat(40),
    databaseIdentity: '68f7f918-36ec-4261-a5e4-4c1f986164c7',
    migrationHead: '0027_core_v2_job_outbox_aria_closed_key_set',
    v1UserId: ID,
    expectedV1State: { role: 'ADMIN' as const, activated: true as const, disabled: false as const, merged: false as const },
    capability: 'ADMIN' as const,
    nonce: 'n'.repeat(24),
    expiresAt: '2026-12-31T00:00:00.000Z',
    reason: 'CORE_V2_GO_LIVE',
  };

  test('l’empreinte est stable pour un contenu identique', () => {
    expect(fingerprintOfBootstrapManifest({ ...base, fingerprint: 'x' })).toBe(fingerprintOfBootstrapManifest({ ...base, fingerprint: 'y' }));
  });

  test('nested state is covered by the real parser, and corruption is rejected', () => {
    const manifest = { ...base, fingerprint: fingerprintOfBootstrapManifest(base) };
    expect(parseBootstrapManifest(manifest)).toEqual(manifest);
    expect(() => parseBootstrapManifest({ ...manifest, expectedV1State: { ...base.expectedV1State, activated: false } })).toThrow('MANIFEST_INVALID');
    expect(() => parseBootstrapManifest({ ...manifest, reason: 'CHANGED_REASON' })).toThrow('MANIFEST_FINGERPRINT_MISMATCH');
  });

  test('changer le moindre champ change l’empreinte', () => {
    const reference = fingerprintOfBootstrapManifest({ ...base, fingerprint: '' });
    for (const patch of [
      { finalSha: 'b'.repeat(40) },
      { reason: 'OTHER_REASON' },
      { expectedV1State: { ...base.expectedV1State, disabled: true } },
      { v1UserId: 'ckv1admin0000000000000999' },
      { capability: 'ASSISTANTE' },
      { nonce: 'm'.repeat(24) },
      { expiresAt: '2027-01-01T00:00:00.000Z' },
      { databaseIdentity: 'autre-base' },
      { migrationHead: '0026_core_v2_account_v1_provisioning' },
    ]) {
      expect(fingerprintOfBootstrapManifest({ ...base, ...patch, fingerprint: '' } as typeof base & { fingerprint: string })).not.toBe(reference);
    }
  });
});

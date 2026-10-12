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
import { createHash } from 'node:crypto';
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
  /** Reproduit le calcul de la commande : tout le manifeste SAUF l'empreinte. */
  function fingerprintOf(manifest: Record<string, unknown>): string {
    const { fingerprint: _ignored, ...rest } = manifest;
    return createHash('sha256').update(JSON.stringify(rest, Object.keys(rest).sort())).digest('hex');
  }

  const base = {
    finalSha: 'a'.repeat(40),
    databaseIdentity: 'nexus-core-v2',
    migrationHead: '0027_core_v2_job_outbox_aria_closed_key_set',
    v1UserId: ID,
    expectedV1State: { role: 'ADMIN', activated: true, disabled: false, merged: false },
    capability: 'ADMIN',
    nonce: 'n'.repeat(24),
    expiresAt: '2026-12-31T00:00:00.000Z',
  };

  test('l’empreinte est stable pour un contenu identique', () => {
    expect(fingerprintOf({ ...base, fingerprint: 'x' })).toBe(fingerprintOf({ ...base, fingerprint: 'y' }));
  });

  test('changer le moindre champ change l’empreinte', () => {
    const reference = fingerprintOf({ ...base, fingerprint: '' });
    for (const patch of [
      { v1UserId: 'ckv1admin0000000000000999' },
      { capability: 'ASSISTANTE' },
      { nonce: 'm'.repeat(24) },
      { expiresAt: '2027-01-01T00:00:00.000Z' },
      { databaseIdentity: 'autre-base' },
      { migrationHead: '0026_core_v2_account_v1_provisioning' },
    ]) {
      expect(fingerprintOf({ ...base, ...patch, fingerprint: '' })).not.toBe(reference);
    }
  });
});

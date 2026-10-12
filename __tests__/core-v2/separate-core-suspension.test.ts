/**
 * Contrat d'accès effectif, décision owner :
 *
 *   V1 authentifié ET actif  ET  adhésion Core ACTIVE  ET  capacité Core accordée
 *
 * Les trois facteurs sont indépendants et doivent tous être exigés. Et la
 * suspension est SÉPARÉE : suspendre l'accès Core ne touche ni le mot de passe,
 * ni l'activation, ni les sessions, ni l'accès V1 ; inversement un utilisateur
 * V1 suspendu ne doit jamais atteindre Core, même avec une adhésion Core ACTIVE.
 *
 * Aucune propagation automatique dans un sens ni dans l'autre : une
 * réactivation Core ne réactive jamais V1, une réactivation V1 ne réactive
 * jamais Core.
 *
 * Ce test épingle le contrat au niveau des fonctions d'autorité, sans base :
 * il doit rester vrai quelle que soit l'évolution du câblage HTTP.
 */
import { resolveActor } from '@/lib/core-v2/http/actor';
import { assertCapability, capabilitiesForRole } from '@/lib/core-v2/rbac';
import { ForbiddenError } from '@/lib/core-v2/errors';

/** Client Core v2 minimal : seule la ligne `users` nous intéresse ici. */
function coreClientWith(row: Record<string, unknown> | null) {
  return { user: { findUnique: async () => row } } as never;
}

describe('facteur 2 — adhésion Core : toute valeur autre qu’ACTIVE est refusée', () => {
  test('un acteur ACTIVE est résolu', async () => {
    const actor = await resolveActor(coreClientWith({ id: 'u1', role: 'ADMIN', accountStatus: 'ACTIVE' }), 'u1');
    expect(actor).toEqual({ userId: 'u1', role: 'ADMIN' });
  });

  test.each(['SUSPENDED', 'DISABLED', 'PENDING_ACTIVATION'] as const)(
    'un acteur %s est refusé', async (accountStatus) => {
      await expect(resolveActor(coreClientWith({ id: 'u1', role: 'ADMIN', accountStatus }), 'u1'))
        .rejects.toThrow(ForbiddenError);
    });

  test('un acteur absent de Core est refusé', async () => {
    await expect(resolveActor(coreClientWith(null), 'u1')).rejects.toThrow(ForbiddenError);
  });

  test('le refus ne révèle ni rôle ni identifiant', async () => {
    try {
      await resolveActor(coreClientWith({ id: 'u1', role: 'ADMIN', accountStatus: 'SUSPENDED' }), 'u1');
      throw new Error('aurait dû refuser');
    } catch (error) {
      const serialized = JSON.stringify({
        message: (error as Error).message,
        details: (error as ForbiddenError).details ?? null,
      });
      expect(serialized).not.toContain('ADMIN');
      expect(serialized).not.toContain('u1');
    }
  });
});

describe('facteur 3 — capacité Core : indépendante de l’adhésion', () => {
  test('un acteur ACTIVE sans la capacité est refusé', () => {
    expect(() => assertCapability({ userId: 'u1', role: 'ELEVE' }, 'ACCOUNT_INVITE')).toThrow(ForbiddenError);
  });

  test('COACH, PARENT et ÉLÈVE ne portent aucune capacité back-office', () => {
    for (const role of ['COACH', 'PARENT', 'ELEVE'] as const) {
      expect(capabilitiesForRole(role)).toEqual([]);
    }
  });

  test('une adhésion ACTIVE ne confère à elle seule aucune capacité', () => {
    // Le facteur 2 satisfait n'implique pas le facteur 3 : c'est tout l'objet
    // d'un contrat à trois facteurs.
    expect(capabilitiesForRole('PARENT')).toEqual([]);
  });
});

describe('la suspension Core ne touche aucune donnée V1', () => {
  test('transitionAccount n’écrit que sur le client Core v2', () => {
    // Garde structurelle : le service de cycle de vie ne doit jamais importer le
    // client V1. Une propagation Core -> V1 commencerait par cet import.
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'lib/core-v2/services/account.ts'), 'utf8') as string;
    const lifecycle = source.slice(source.indexOf('async function transitionAccount'));
    const body = lifecycle.slice(0, lifecycle.indexOf('\n}\n') + 1);
    for (const forbidden of ['password', 'activatedAt', 'activationToken', 'disabledAt']) {
      expect(body).not.toContain(`${forbidden}:`);
    }
  });

  test('le service de cycle de vie n’importe pas le client V1', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'lib/core-v2/services/account.ts'), 'utf8') as string;
    // `@/lib/prisma` est le client V1 : Core ne doit pas l'atteindre ici.
    expect(source).not.toContain("from '@/lib/prisma'");
  });
});

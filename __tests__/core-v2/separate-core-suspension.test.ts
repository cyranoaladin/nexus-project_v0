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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Parcours récursif, en ignorant ce qui n'est pas du code du dépôt. */
function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}
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
  test('transitionAccount n’écrit aucun champ de credential', () => {
    const source = readFileSync(join(process.cwd(), 'lib/core-v2/services/account.ts'), 'utf8');
    const start = source.indexOf('async function transitionAccount');
    // Sans cette assertion, un renommage faisait retourner -1 à `indexOf`, puis
    // `slice(-1)` rendait le DERNIER caractère du fichier, et le corps analysé
    // devenait la chaîne vide : les quatre assertions passaient alors sur du
    // vide, sans aucun signal. La garde doit échouer si elle perd sa cible.
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('\n}\n', start);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body.length).toBeGreaterThan(200);
    for (const forbidden of ['password', 'activatedAt', 'activationToken', 'disabledAt']) {
      // Tolère l'espace avant le deux-points, que la forme précédente laissait passer.
      expect(body).not.toMatch(new RegExp(`${forbidden}\\s*:`));
    }
    // Et aucun étalement d'objet non littéral, qui masquerait un champ interdit.
    expect(body).not.toMatch(/data:\s*\{\s*\.\.\./);
  });

  test('le service de cycle de vie n’importe pas le client V1', () => {
    const source = readFileSync(join(process.cwd(), 'lib/core-v2/services/account.ts'), 'utf8');
    // `@/lib/prisma` est le client V1 : Core ne doit pas l'atteindre ici.
    expect(source).not.toContain("from '@/lib/prisma'");
  });
});

describe('facteur 1 — V1 authentifié ET ACTIF', () => {
  test('le seul écrit qui désactive un compte V1 incrémente sessionVersion', () => {
    // Le validateur de session ne lit PAS `disabledAt` : il compare
    // `sessionVersion`. Une désactivation qui n'incrémente pas laisserait donc
    // vivre les sessions déjà émises, et le facteur 1 ne tiendrait que pour les
    // connexions futures. Cette garde mesure le code, elle ne le suppose pas.
    const roots = ['lib', 'app', 'scripts'];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(join(process.cwd(), root))) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
        const source = readFileSync(file, 'utf8');
        let at = source.indexOf('disabledAt: new Date()');
        while (at !== -1) {
          // Fenêtre autour de l'écriture : l'incrément doit être dans le MÊME
          // objet `data`, donc à quelques lignes.
          const window = source.slice(Math.max(0, at - 400), at + 400);
          if (!window.includes('sessionVersion')) {
            offenders.push(`${file.slice(process.cwd().length + 1)} @${at}`);
          }
          at = source.indexOf('disabledAt: new Date()', at + 1);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('la garde ci-dessus voit réellement des écritures (sinon elle serait vide)', () => {
    // Contrôle positif : sans ce plancher, un dépôt où le motif aurait été
    // renommé passerait avec zéro contrevenant et zéro couverture.
    let seen = 0;
    for (const file of walk(join(process.cwd(), 'lib'))) {
      if (file.endsWith('.ts')) seen += readFileSync(file, 'utf8').split('disabledAt: new Date()').length - 1;
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('aucune propagation automatique, dans aucun sens', () => {
  test('le cycle de vie Core n’atteint pas le client V1 (Core -> V1)', () => {
    const source = readFileSync(join(process.cwd(), 'lib/core-v2/services/account.ts'), 'utf8');
    expect(source).not.toContain("from '@/lib/prisma'");
    expect(source).not.toContain('from "@/lib/prisma"');
  });

  test('la réactivation V1 n’atteint pas le client Core (V1 -> Core)', () => {
    // Symétrie : réactiver en V1 ne doit pas remettre une adhésion Core à
    // ACTIVE. Le sens V1 -> Core n'était testé nulle part.
    for (const file of ['lib/espace/provisioning.ts', 'lib/auth/staff-activation.ts']) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toContain("from '@/lib/core-v2/client'");
      expect(source).not.toMatch(/accountStatus:\s*'ACTIVE'/);
    }
  });
});

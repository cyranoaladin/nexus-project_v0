import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Propriété des specs E2E — garde statique.
 *
 * Une spec qu'aucune configuration Playwright ne collecte ne s'exécute jamais.
 * Elle ne protège rien tout en donnant l'apparence d'une couverture, et rien
 * ne le signale : c'est la définition d'un test dormant.
 *
 * L'inventaire complet (spec → voie → job CI) est produit par
 * `npm run test:e2e-ownership`, qui interroge réellement chaque configuration.
 * Ce test-ci garde l'invariant à coût nul : le registre ne doit pas pourrir, et
 * le nombre de specs dormantes ne doit pas augmenter.
 */

const root = process.cwd();
const registryPath = join(root, 'e2e/ownership.registry.json');

/**
 * Plafond à cliquet. Il vaut le nombre de specs dormantes constaté lorsque
 * l'inventaire a été mis en place. Il peut DIMINUER — chaque baisse est une
 * spec promue à une voie — mais toute augmentation fait échouer ce test :
 * une nouvelle spec doit naître avec une voie, pas avec une dispense.
 */
const DORMANT_CEILING = 64;

function trackedSpecs(): string[] {
  return execFileSync('git', ['ls-files', 'e2e'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('.spec.ts'));
}

describe('E2E_SPEC_OWNERSHIP', () => {
  const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
    notPromoted: Record<string, string>;
    intentionalDuplicates: string[];
  };

  test('le registre existe et porte sa raison d’être', () => {
    expect(existsSync(registryPath)).toBe(true);
    expect(Array.isArray(registry.intentionalDuplicates)).toBe(true);
    expect(typeof registry.notPromoted).toBe('object');
  });

  test('chaque spec déclarée dormante existe réellement', () => {
    const tracked = new Set(trackedSpecs());
    const missing = Object.keys(registry.notPromoted).filter((s) => !tracked.has(s));
    // Une entrée qui ne correspond plus à un fichier masque le fait que la
    // spec a été supprimée ou déplacée : le registre doit suivre le dépôt.
    expect(missing).toEqual([]);
  });

  test('chaque dispense porte un motif écrit', () => {
    const empty = Object.entries(registry.notPromoted)
      .filter(([, reason]) => typeof reason !== 'string' || reason.trim().length < 20)
      .map(([spec]) => spec);
    expect(empty).toEqual([]);
  });

  test('le nombre de specs dormantes ne peut que diminuer', () => {
    const count = Object.keys(registry.notPromoted).length;
    expect(count).toBeLessThanOrEqual(DORMANT_CEILING);
  });

  test('le plafond suit la réalité : il n’est jamais laissé au-dessus du compte', () => {
    // Sans cette assertion, le plafond resterait à 64 après une promotion et
    // autoriserait silencieusement une régression jusqu'à l'ancien niveau.
    const count = Object.keys(registry.notPromoted).length;
    expect(DORMANT_CEILING).toBe(count);
  });
});

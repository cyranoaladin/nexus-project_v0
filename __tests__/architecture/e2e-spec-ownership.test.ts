import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Propriété des specs E2E — garde statique.
 *
 * Une spec qu'aucune configuration Playwright ne collecte ne s'exécute jamais.
 * Elle ne protège rien tout en donnant l'apparence d'une couverture, et rien ne
 * le signale : c'est la définition d'un test dormant.
 *
 * L'inventaire complet — quelle voie collecte quelle spec — est produit par
 * `npm run check:e2e-ownership`, qui interroge réellement chaque configuration.
 * Ce test-ci garde à coût nul les invariants qu'une lecture de fichiers suffit
 * à établir, pour qu'une dérive soit visible dès la voie unitaire.
 */

const root = process.cwd();

function trackedSpecs(): string[] {
  return execFileSync('git', ['ls-files', 'e2e'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('.spec.ts'));
}

describe('E2E_SPEC_OWNERSHIP', () => {
  const authConfig = readFileSync(join(root, 'playwright.auth.config.ts'), 'utf8');

  test('la voie authentifiée liste exhaustivement les specs de son répertoire', () => {
    // Cette liste était incrémentale : 61 des 80 specs présentes n'y figuraient
    // pas et ne s'exécutaient donc jamais. Elle est désormais l'inventaire
    // intentionnel du répertoire, et ce test empêche qu'elle en diverge —
    // ajouter un fichier sans l'y inscrire recrée un test dormant.
    const onDisk = trackedSpecs()
      .filter((s) => s.startsWith('e2e/auth/'))
      .map((s) => s.replace('e2e/auth/', ''))
      .sort();
    const listed = [...authConfig.matchAll(/^\s*'([^']+\.spec\.ts)',/gm)].map((m) => m[1]).sort();

    expect(onDisk.filter((s) => !listed.includes(s))).toEqual([]);
    expect(listed.filter((s) => !onDisk.includes(s))).toEqual([]);
  });

  test('aucun registre de dispense ne subsiste', () => {
    // Le cliquet qui déclarait les specs dormantes était une mesure de
    // migration. Le laisser en place rouvrirait la porte qu'il servait à
    // fermer : une spec sans voie redeviendrait justifiable par une ligne.
    expect(existsSync(join(root, 'e2e/ownership.registry.json'))).toBe(false);
  });

  test('aucune spec ne se déclare outil de mise au point', () => {
    const suspicious = trackedSpecs().filter((s) => /(debug|manual|generate-state)/i.test(s));
    expect(suspicious).toEqual([]);
  });

  test('aucune spec n’écrit hors du dépôt', () => {
    // Un fichier qui produit des captures ou un rapport dans /tmp est un outil
    // d'audit : sa place est dans scripts/, avec une commande explicite.
    const offenders = trackedSpecs().filter((spec) => {
      const text = readFileSync(join(root, spec), 'utf8');
      return /(writeFileSync|mkdirSync)\(\s*['"`]\/(tmp|var)\//.test(text);
    });
    expect(offenders).toEqual([]);
  });

  test('chaque spec porte une preuve vérifiable', () => {
    // Règle non naïve : une assertion peut vivre dans un helper. Une spec est
    // en règle si elle assure elle-même OU si elle appelle un helper qui assure.
    const helpers = execFileSync('git', ['ls-files', 'e2e/helpers'], { cwd: root, encoding: 'utf8' })
      .split('\n').map((l) => l.trim()).filter((l) => /\.[jt]s$/.test(l));
    const asserting = helpers
      .filter((h) => /\bexpect\s*\(/.test(readFileSync(join(root, h), 'utf8')))
      .map((h) => h.replace(/^e2e\/helpers\//, '').replace(/\.[jt]s$/, ''));

    const withoutProof = trackedSpecs().filter((spec) => {
      const text = readFileSync(join(root, spec), 'utf8');
      if (/\bexpect\s*\(/.test(text)) return false;
      return !asserting.some((h) => text.includes(`helpers/${h}`));
    });
    expect(withoutProof).toEqual([]);
  });
});

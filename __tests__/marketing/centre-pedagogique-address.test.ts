import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { LEGAL } from '@/lib/legal';

/**
 * Adresse du centre pédagogique — décision du propriétaire du 13/10/2026 :
 * les cours, stages et rendez-vous ont lieu au 17 rue Ali Zlitni, Manar III, Tunis.
 * Le siège social (Centre Urbain Nord) reste une adresse distincte.
 * Les pages et composants lisent l'adresse dans LEGAL : aucun quartier écrit en dur.
 */

const ROOT = path.resolve(__dirname, '../..');
const SCANNED_PREFIXES = ['app/', 'components/', 'lib/', 'content/marketing/'];

function trackedSources(): string[] {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.ts', '*.tsx'], {
    cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\0').filter(Boolean).filter((file) => SCANNED_PREFIXES.some((prefix) => file.startsWith(prefix)));
}

describe('Centre pédagogique — 17 rue Ali Zlitni, Manar III', () => {
  it('LEGAL porte la nouvelle adresse du centre pédagogique', () => {
    expect(LEGAL.addresses.pedagogique.full).toBe('17 rue Ali Zlitni, Manar III, Tunis');
    expect(LEGAL.addresses.pedagogique.street).toBe('17 rue Ali Zlitni');
    expect(LEGAL.addresses.pedagogique.neighborhood).toBe('Manar III');
    expect(LEGAL.addresses.pedagogique.city).toBe('Tunis');
  });

  it('le siège social reste au Centre Urbain Nord, distinct du centre pédagogique', () => {
    expect(LEGAL.addresses.siege.full).toContain('Centre Urbain Nord');
    expect(LEGAL.addresses.siege.full).not.toBe(LEGAL.addresses.pedagogique.full);
  });

  it('plus aucune mention de Mutuelleville dans les pages, composants et bibliothèques', () => {
    const offenders = trackedSources().filter((file) => {
      const absolute = path.join(ROOT, file);
      return fs.existsSync(absolute) && fs.readFileSync(absolute, 'utf-8').includes('Mutuelleville');
    });
    expect(offenders).toEqual([]);
  });

  /**
   * Les dossiers « Inscription 2027 » sont des documents audités servis tels
   * quels, par un rewrite : ils ne peuvent pas lire LEGAL, et l'adresse y est
   * forcément littérale. Le garde s'inverse donc pour eux — l'adresse
   * canonique doit y être écrite, l'ancienne absente.
   *
   * Ce garde est né d'une erreur réelle. Les deux dossiers ont été publiés le
   * 16/10/2026 en portant encore « Centre pédagogique Mutuelleville, Tunis »,
   * parce qu'ils vivent hors des quatre préfixes scannés plus haut : un garde
   * dont la portée s'arrête avant le fichier fautif ne protège personne.
   */
  it('les documents servis tels quels portent l’adresse canonique, et pas l’ancienne', () => {
    const dossiers = ['content/inscription-2027/source', 'public/inscription-bac-2027'];
    const documents = dossiers.flatMap((dossier) => {
      const absolu = path.join(ROOT, dossier);
      if (!fs.existsSync(absolu)) return [];
      return fs.readdirSync(absolu).filter((f) => f.endsWith('.html')).map((f) => path.join(dossier, f));
    });
    // Le compte protège contre un garde qui ne trouverait plus rien à scanner.
    expect(documents.length).toBeGreaterThanOrEqual(4);
    for (const chemin of documents) {
      const texte = fs.readFileSync(path.join(ROOT, chemin), 'utf-8');
      expect(`${chemin} porte Mutuelleville : ${texte.includes('Mutuelleville')}`)
        .toBe(`${chemin} porte Mutuelleville : false`);
      expect(`${chemin} porte l’adresse canonique : ${texte.includes(LEGAL.addresses.pedagogique.full)}`)
        .toBe(`${chemin} porte l’adresse canonique : true`);
    }
  });

  it('aucun quartier du centre écrit en dur : les pages lisent LEGAL', () => {
    const offenders = trackedSources().filter((file) => {
      if (file === 'lib/legal.ts') return false;
      const absolute = path.join(ROOT, file);
      return fs.existsSync(absolute) && /Manar III|Ali Zlitni/.test(fs.readFileSync(absolute, 'utf-8'));
    });
    expect(offenders).toEqual([]);
  });
});

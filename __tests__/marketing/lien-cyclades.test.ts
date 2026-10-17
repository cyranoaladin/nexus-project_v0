/**
 * Le lien vers Cyclades, une seule adresse pour tout le site.
 *
 * L'adresse du portail est écrite dans les deux dossiers audités, sous
 * « Les deux seules adresses utiles ». La page /bac-candidat-libre ne la
 * recopie pas : elle la lit dans le manifeste engendré depuis ces documents.
 * Une adresse recopiée devient fausse le jour où le portail déménage et où
 * seul le dossier est corrigé ; celle qui vient du document reste vraie.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAGES, lienCyclades, manifeste } from '@/scripts/inscription-2027/build-pages.mjs';

const racine = process.cwd();
const lire = (chemin: string) => readFileSync(join(racine, chemin), 'utf8');

describe('lien Cyclades', () => {
  test('les deux dossiers audités déclarent la même adresse', () => {
    const adresses = PAGES.map((page: { slug: string }) =>
      lienCyclades(lire(`content/inscription-2027/source/${page.slug}.html`)));
    expect(adresses).toHaveLength(2);
    expect(new Set(adresses).size).toBe(1);
    expect(adresses[0]).toMatch(/^https:\/\/candidat\.examens-concours\.gouv\.fr\//);
  });

  test('le manifeste porte cette adresse, et les pages servies la servent', () => {
    for (const page of manifeste()) {
      const servi = lire(`public/inscription-bac-2027/${page.slug}.html`);
      expect(page.cyclades).toBe(lienCyclades(lire(`content/inscription-2027/source/${page.slug}.html`)));
      expect(servi).toContain(`href="${page.cyclades}"`);
    }
  });

  test('un document sans l’adresse arrête la fabrication, il ne la devine pas', () => {
    const source = lire('content/inscription-2027/source/general.html');
    const ampute = source.replace(/<a href="https:\/\/candidat\.examens-concours\.gouv\.fr[^"]*">/, '<a href="#">');
    expect(ampute).not.toBe(source);
    expect(() => lienCyclades(ampute)).toThrow('LIEN_CYCLADES_INTROUVABLE');
  });

  test('/bac-candidat-libre affiche le lien sans recopier l’adresse', () => {
    const page = lire('app/bac-candidat-libre/page.tsx');
    expect(page).toContain('lienCycladesOfficiel');
    expect(page).not.toContain('examens-concours.gouv.fr');
  });

  test('le fichier du manifeste committé est à jour', () => {
    const fichier = JSON.parse(lire('content/inscription-2027/pages.generated.json'));
    expect(fichier).toEqual(manifeste());
  });
});

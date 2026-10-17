/**
 * Les deux adresses officielles, une seule source pour tout le site.
 *
 * Elles sont écrites dans les deux dossiers audités, sous « Les deux seules
 * adresses utiles » : Cyclades pour s'inscrire, l'Institut français de Tunisie
 * pour suivre la session. Les pages publiques ne les recopient pas : elles les
 * lisent dans le manifeste engendré depuis ces documents. Une adresse recopiée
 * devient fausse le jour où le portail déménage et où seul le dossier est
 * corrigé ; celle qui vient du document reste vraie.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { render, screen } from '@testing-library/react';

import CandidatLibreBacFrancaisPage from '@/app/candidat-libre-bac-francais/page';
import { PAGES, lienCyclades, lienInstitutFrancais, manifeste } from '@/scripts/inscription-2027/build-pages.mjs';

jest.mock('next/navigation', () => ({ usePathname: () => '/candidat-libre-bac-francais' }));

const racine = process.cwd();
const lire = (chemin: string) => readFileSync(join(racine, chemin), 'utf8');
const source = (slug: string) => lire(`content/inscription-2027/source/${slug}.html`);

const ADRESSES = [
  { nom: 'Cyclades', lecteur: lienCyclades, champ: 'cyclades', hote: 'candidat.examens-concours.gouv.fr', erreur: 'LIEN_CYCLADES_INTROUVABLE' },
  { nom: 'Institut français', lecteur: lienInstitutFrancais, champ: 'institut_francais', hote: 'www.institutfrancais-tunisie.com', erreur: 'LIEN_IFT_INTROUVABLE' },
] as const;

describe.each(ADRESSES)('adresse officielle — $nom', ({ lecteur, champ, hote, erreur }) => {
  test('les deux dossiers audités déclarent la même adresse', () => {
    const adresses = PAGES.map((page: { slug: string }) => lecteur(source(page.slug)));
    expect(adresses).toHaveLength(2);
    expect(new Set(adresses).size).toBe(1);
    expect(new URL(adresses[0]).host).toBe(hote);
    expect(new URL(adresses[0]).protocol).toBe('https:');
  });

  test('le manifeste porte cette adresse, et les pages servies la servent', () => {
    for (const page of manifeste()) {
      expect(page[champ]).toBe(lecteur(source(page.slug)));
      expect(lire(`public/inscription-bac-2027/${page.slug}.html`)).toContain(`href="${page[champ]}"`);
    }
  });

  test('un document sans l’adresse arrête la fabrication, il ne la devine pas', () => {
    const document = source('general');
    const motif = new RegExp(`<a href="https://${hote.replace(/\./g, '\\.')}[^"]*">`, 'g');
    const ampute = document.replace(motif, '<a href="#">');
    expect(ampute).not.toBe(document);
    expect(() => lecteur(ampute)).toThrow(erreur);
  });

  test('deux adresses qui divergent dans un même document arrêtent la fabrication', () => {
    const document = source('general');
    // Un second lien vers le même hôte, mais ailleurs : le cas d'une relecture
    // qui corrige une occurrence et oublie l'autre.
    const divergent = `${document}<a href="https://${hote}/un-autre-chemin">doublon</a>`;
    expect(() => lecteur(divergent)).toThrow(/_DIVERGENT_DANS_LE_DOCUMENT$/);
  });
});

describe('les pages publiques affichent ces adresses sans les recopier', () => {
  test('le manifeste committé est celui que le générateur produit', () => {
    expect(JSON.parse(lire('content/inscription-2027/pages.generated.json'))).toEqual(manifeste());
  });

  test('/bac-candidat-libre mène aux deux portails, en nouvel onglet annoncé', () => {
    const page = lire('app/bac-candidat-libre/page.tsx');
    expect(page).toContain('lienCycladesOfficiel');
    expect(page).toContain('lienInstitutFrancaisOfficiel');
    // Aucune adresse en dur : le jour où le portail déménage, le dossier suffit.
    expect(page).not.toContain('examens-concours.gouv.fr');
    expect(page).not.toContain('institutfrancais-tunisie.com');
    // Deux sorties annoncées aux lecteurs d'écran, comme ailleurs sur le site.
    expect(page.match(/\(nouvel onglet\)/g) ?? []).toHaveLength(2);
    expect(page.match(/rel="noopener noreferrer"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  test('/candidat-libre-bac-francais mène à Cyclades, en nouvel onglet annoncé', () => {
    render(React.createElement(CandidatLibreBacFrancaisPage));
    const lien = screen.getByRole('link', { name: /Cyclades[\s\S]*nouvel onglet/ });
    expect(lien).toHaveAttribute('href', lienCyclades(source('general')));
    expect(lien).toHaveAttribute('target', '_blank');
    expect(lien).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

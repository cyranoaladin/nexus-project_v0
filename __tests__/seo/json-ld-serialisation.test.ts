/**
 * Un bloc JSON-LD vit dans un <script> : le premier « </script> » rencontré
 * par l'analyseur ferme la balise, quelle que soit la validité du JSON. Un
 * chevron venu d'une réponse de FAQ suffirait à casser la page entière.
 *
 * Une seule fonction sérialise donc tous les blocs du site, et ce garde
 * interdit qu'un nouveau bloc revienne à `JSON.stringify` nu.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import React from 'react';
import { render } from '@testing-library/react';

import CandidatLibreBacFrancaisPage from '@/app/candidat-libre-bac-francais/page';
import GrandOralPage from '@/app/grand-oral/page';
import { serialiserJsonLd } from '@/lib/seo';

jest.mock('next/navigation', () => ({ usePathname: () => '/candidat-libre-bac-francais' }));

const racine = process.cwd();

type Maillon = { '@type': 'ListItem'; position: number; name: string; item: string };
type Noeud = { '@type': string } & Record<string, unknown>;

function fichiers(dossier: string): string[] {
  const absolu = join(racine, dossier);
  return readdirSync(absolu).flatMap((entree) => {
    if (entree === 'node_modules' || entree.startsWith('.')) return [];
    const chemin = `${dossier}/${entree}`;
    if (statSync(join(racine, chemin)).isDirectory()) return fichiers(chemin);
    return ['.ts', '.tsx'].includes(extname(chemin)) ? [chemin] : [];
  });
}

describe('sérialisation des données structurées', () => {
  test('le chevron est échappé, le reste est intact', () => {
    const serialise = serialiserJsonLd({ texte: 'a </script> b', nombre: 12 });
    expect(serialise).not.toContain('<');
    expect(serialise).toContain('\\u003c/script> b');
    expect(JSON.parse(serialise)).toEqual({ texte: 'a </script> b', nombre: 12 });
  });

  test('aucun bloc du site n’échappe à cette fonction', () => {
    const fautifs = ['app', 'components']
      .flatMap(fichiers)
      .filter((chemin) => {
        const code = readFileSync(join(racine, chemin), 'utf8');
        if (!code.includes('application/ld+json')) return false;
        return !code.includes('serialiserJsonLd');
      });
    expect(fautifs).toEqual([]);
  });
});

describe('fil d’Ariane des pages de préparation', () => {
  test.each([
    ['/candidat-libre-bac-francais', CandidatLibreBacFrancaisPage],
    ['/grand-oral', GrandOralPage],
  ])('%s déclare son fil', (chemin, Page) => {
    const { container } = render(React.createElement(Page as () => JSX.Element));
    const blocs = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((n) => JSON.parse(n.textContent!) as Noeud);
    const fil = blocs.find((b) => b['@type'] === 'BreadcrumbList');
    expect(fil).toBeDefined();
    expect((fil!.itemListElement as Maillon[]).map((e) => e.item)).toEqual([
      'https://nexusreussite.academy/',
      `https://nexusreussite.academy${chemin}`,
    ]);
  });
});

describe('couverture des requêtes visées', () => {
  const lireFichier = (chemin: string) => readFileSync(join(racine, chemin), 'utf8');

  test('une page porte « Cyclades » dans son titre et son premier titre visible', () => {
    const page = lireFichier('app/inscription-bac-2027/page.tsx');
    const titre = /const TITRE =\s*\n?\s*'([^']+)'/.exec(page)![1];
    expect(titre).toContain('Cyclades');
    expect(titre.length).toBeLessThanOrEqual(70);
    // Le terme officiel et le terme cherché par les familles, tous deux présents.
    expect(page).toContain('candidat individuel');
    expect(page).toContain('candidat libre');
    const h1 = /<h1[\s\S]*?>([\s\S]*?)<\/h1>/.exec(page)![1];
    expect(h1).toContain('Cyclades');
  });
});

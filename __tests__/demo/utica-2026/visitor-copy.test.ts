/**
 * Hotfix branding salon §16 — le vocabulaire de "démonstrateur/maquette"
 * ne doit plus apparaître dans le RENDU réellement vu par le visiteur sur
 * les 5 routes. Vise le HTML produit par React (DemoChrome + chaque page),
 * jamais les noms de fichiers/dossiers/commentaires internes (autorisés à
 * garder "demo"/"utica" — brief §2).
 *
 * Le popover volontaire de transparence (OptionsMenu → InfoDisclosureDialog)
 * est fermé par défaut : son texte ("profil d'exemple") n'apparaît donc pas
 * dans ce rendu initial, ce qui est le comportement attendu (§8 : jamais
 * affiché automatiquement).
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DemoChrome } from '@/components/demo/utica-2026/DemoChrome';
import UticaDemoLandingPage from '@/app/demo/utica-2026/page';
import UticaDemoParentPage from '@/app/demo/utica-2026/parent/page';
import UticaDemoElevePage from '@/app/demo/utica-2026/eleve/page';
import UticaDemoAriaPage from '@/app/demo/utica-2026/aria/page';
import UticaDemo360Page from '@/app/demo/utica-2026/360/page';

const BANNED_PHRASES = [
  'Démonstrateur UTICA',
  'Démonstrateur',
  'Données de démonstration',
  'profil fictif',
  'exemple de démonstration',
  'Recommencer la démonstration',
  'Aperçu illustratif',
  'non connecté au moteur ARIA réel',
  // Trouvé en QA visuelle post-hotfix : badge de provenance "Démo" dans
  // AdministrativeCockpitCard, aussi révélateur qu'un texte long.
  '>Démo<',
];

// P3 : la page ARIA est désormais un server component async (searchParams
// en Promise, Next.js 15) — `renderToString` ne sait pas résoudre un
// composant async lui-même, donc chaque route est un thunk résolu
// (`await`) AVANT de construire l'arbre passé à renderToString. `await` sur
// une valeur déjà synchrone (les 4 autres pages) est un no-op.
const ROUTES: Array<[string, () => React.ReactElement | Promise<React.ReactElement>]> = [
  ['landing', () => UticaDemoLandingPage()],
  ['parent', () => UticaDemoParentPage()],
  ['eleve', () => UticaDemoElevePage()],
  ['aria', () => UticaDemoAriaPage({ searchParams: Promise.resolve({}) })],
  ['360', () => UticaDemo360Page()],
];

describe('Rendu visiteur — vocabulaire de démonstrateur banni (hotfix branding salon §16)', () => {
  test.each(ROUTES)('%s : aucune des phrases bannies dans le HTML rendu', async (_name, resolvePage) => {
    const pageElement = await resolvePage();
    const html = renderToString(React.createElement(DemoChrome, null, pageElement));
    for (const phrase of BANNED_PHRASES) {
      expect(html).not.toContain(phrase);
    }
  });

  test('la transparence opt-in (popover fermé par défaut) ne fuit pas "profil d\'exemple" dans le rendu initial', () => {
    const html = renderToString(
      React.createElement(DemoChrome, null, React.createElement(UticaDemoLandingPage)),
    );
    expect(html).not.toContain("profil d'exemple");
  });
});

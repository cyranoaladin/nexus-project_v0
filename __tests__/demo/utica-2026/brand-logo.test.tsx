/**
 * Hotfix branding salon §17 — une vraie image de marque Nexus Réussite doit
 * être rendue sur les 5 routes (chrome partagé par toutes), avec
 * alt="Nexus Réussite", des dimensions explicites (layout stable, pas de
 * CLS notable), et un asset local uniquement (jamais une requête externe).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DemoChrome } from '@/components/demo/utica-2026/DemoChrome';
import UticaDemoLandingPage from '@/app/demo/utica-2026/page';
import UticaDemoParentPage from '@/app/demo/utica-2026/parent/page';
import UticaDemoElevePage from '@/app/demo/utica-2026/eleve/page';
import UticaDemoAriaPage from '@/app/demo/utica-2026/aria/page';
import UticaDemo360Page from '@/app/demo/utica-2026/360/page';

// P3 : la page ARIA est désormais un server component async (searchParams
// en Promise) — chaque route est résolue (`await`) avant d'être rendue ;
// no-op pour les 4 autres pages, restées synchrones.
const ROUTES: Array<[string, () => React.ReactElement | Promise<React.ReactElement>]> = [
  ['landing', () => UticaDemoLandingPage()],
  ['parent', () => UticaDemoParentPage()],
  ['eleve', () => UticaDemoElevePage()],
  ['aria', () => UticaDemoAriaPage({ searchParams: Promise.resolve({}) })],
  ['360', () => UticaDemo360Page()],
];

describe('Logo Nexus Réussite — présent sur les 5 routes (hotfix branding salon §17)', () => {
  test.each(ROUTES)('%s : logo rendu, alt correct, dimensions explicites, asset local', async (_name, resolvePage) => {
    const pageElement = await resolvePage();
    render(React.createElement(DemoChrome, null, pageElement));
    const logo = screen.getByAltText('Nexus Réussite');
    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('src')).toMatch(/^\/images\/[^/]+$/);
    expect(logo.getAttribute('src')).not.toMatch(/^https?:\/\//);
    expect(logo.getAttribute('width')).toBeTruthy();
    expect(logo.getAttribute('height')).toBeTruthy();
  });
});

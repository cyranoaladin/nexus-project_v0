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

const ROUTES: Array<[string, React.ComponentType]> = [
  ['landing', UticaDemoLandingPage],
  ['parent', UticaDemoParentPage],
  ['eleve', UticaDemoElevePage],
  ['aria', UticaDemoAriaPage],
  ['360', UticaDemo360Page],
];

describe('Logo Nexus Réussite — présent sur les 5 routes (hotfix branding salon §17)', () => {
  test.each(ROUTES)('%s : logo rendu, alt correct, dimensions explicites, asset local', (_name, Page) => {
    render(React.createElement(DemoChrome, null, React.createElement(Page)));
    const logo = screen.getByAltText('Nexus Réussite');
    expect(logo.tagName).toBe('IMG');
    expect(logo.getAttribute('src')).toMatch(/^\/images\/[^/]+$/);
    expect(logo.getAttribute('src')).not.toMatch(/^https?:\/\//);
    expect(logo.getAttribute('width')).toBeTruthy();
    expect(logo.getAttribute('height')).toBeTruthy();
  });
});

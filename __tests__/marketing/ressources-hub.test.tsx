import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { existsSync } from 'fs';
import { join } from 'path';

import RessourcesPage from '@/app/ressources/page';

/**
 * /ressources : hub réel des ressources déjà publiées (guides, révisions, documents),
 * et non plus une page d'attente. Chaque lien pointe vers une route existante.
 */
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href, ...p }: any) => <a href={href} {...p}>{children}</a> }));
jest.mock('@/components/layout/CorporateNavbar', () => ({ CorporateNavbar: () => <nav /> }));
jest.mock('@/components/layout/CorporateFooter', () => ({ CorporateFooter: () => <footer /> }));

const ROOT = process.cwd();
const routeExiste = (href: string) => {
  const chemin = href.split('#')[0];
  if (chemin.startsWith('/api/')) return existsSync(join(ROOT, 'app', chemin, 'route.ts'));
  return existsSync(join(ROOT, 'app', chemin, 'page.tsx'));
};

describe('/ressources', () => {
  test('la révision de maths, réservée aux élèves connectés, est signalée comme telle', () => {
    render(<RessourcesPage />);
    const tuile = screen.getByRole('link', { name: /Mathématiques de Première/ });
    expect(tuile).toHaveTextContent(/réservé aux élèves accompagnés/i);
  });

  test('n’est plus une page d’attente', () => {
    render(<RessourcesPage />);
    expect(document.body.textContent).not.toMatch(/arrivent|bientôt|prochainement/i);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  test('propose les guides, la révision interactive et le corrigé DNB, vers des routes existantes', () => {
    render(<RessourcesPage />);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
    for (const attendu of [
      '/candidat-libre-bac-francais',
      '/bac-candidat-libre',
      '/reussir-eaf',
      '/grand-oral',
      '/preparation-bac-francais-tunis',
      '/programme/maths-1ere',
      '/api/public-documents/corrige-dnb-maths-2026',
    ]) {
      expect(hrefs).toContain(attendu);
    }
    for (const href of hrefs.filter((h) => h.startsWith('/'))) {
      expect({ href, existe: routeExiste(href) }).toEqual({ href, existe: true });
    }
  });
});

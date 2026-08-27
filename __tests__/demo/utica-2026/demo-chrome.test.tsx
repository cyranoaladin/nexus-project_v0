/**
 * P2 §8/§10 — reset manuel toujours accessible, navigation mobile utilisable
 * à 390 px sans refonte du desktop.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { DemoChrome } from '@/components/demo/utica-2026/DemoChrome';

describe('DemoChrome — reset manuel', () => {
  test('un bouton "Recommencer" est présent (nav desktop) et ramène vers /demo/utica-2026', () => {
    render(<DemoChrome>contenu</DemoChrome>);
    const resetButton = screen.getByRole('button', { name: /recommencer/i });
    fireEvent.click(resetButton);
    expect(window.location.href).toContain('/demo/utica-2026');
  });
});

describe('DemoChrome — navigation mobile (P2 §10)', () => {
  test('le menu mobile est fermé par défaut', () => {
    render(<DemoChrome>contenu</DemoChrome>);
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();
  });

  test("le bouton menu ouvre un panneau contenant les 5 destinations, dont Vue 360°", () => {
    render(<DemoChrome>contenu</DemoChrome>);
    const toggle = screen.getByLabelText('Ouvrir le menu');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    const mobileNav = screen.getByRole('navigation', { name: /mobile/i });
    expect(mobileNav).toBeInTheDocument();
    for (const label of ['Accueil', 'Parent', 'Élève', 'ARIA', 'Vue 360°']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  test('le panneau mobile porte aussi un bouton de reset', () => {
    render(<DemoChrome>contenu</DemoChrome>);
    fireEvent.click(screen.getByLabelText('Ouvrir le menu'));
    expect(screen.getByRole('button', { name: /recommencer la démonstration/i })).toBeInTheDocument();
  });

  test('cliquer sur le bouton menu à nouveau referme le panneau', () => {
    render(<DemoChrome>contenu</DemoChrome>);
    const openToggle = screen.getByLabelText('Ouvrir le menu');
    fireEvent.click(openToggle);
    const closeToggle = screen.getByLabelText('Fermer le menu');
    fireEvent.click(closeToggle);
    expect(screen.queryByRole('navigation', { name: /mobile/i })).not.toBeInTheDocument();
  });
});

describe('DemoChrome — mode kiosque (P2 §7)', () => {
  test("aucun lien de la navigation ne pointe hors de /demo/utica-2026", () => {
    render(<DemoChrome>contenu</DemoChrome>);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href).toMatch(/^\/demo\/utica-2026/);
    }
  });
});

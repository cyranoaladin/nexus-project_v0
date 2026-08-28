/**
 * P2 §8/§10, hotfix branding salon §8/§9 — reset manuel toujours
 * accessible (désormais via le menu Options desktop / bouton direct
 * mobile), transparence discrète opt-in, navigation mobile utilisable à
 * 390 px sans refonte du desktop.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { DemoChrome } from '@/components/demo/utica-2026/DemoChrome';

describe('DemoChrome — identité de marque', () => {
  test('le logo Nexus Réussite est rendu avec un alt correct', () => {
    render(<DemoChrome>contenu</DemoChrome>);
    const logo = screen.getByAltText('Nexus Réussite');
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('src')).toMatch(/^\/images\//);
  });

  test("le libellé « Espace Candidat Individuel » est visible dans l'en-tête", () => {
    render(<DemoChrome>contenu</DemoChrome>);
    expect(screen.getByText('Espace Candidat Individuel')).toBeInTheDocument();
  });
});

describe('DemoChrome — reset manuel (menu Options desktop)', () => {
  test('le menu Options contient "Réinitialiser l\'espace" et ramène vers /demo/utica-2026', () => {
    render(<DemoChrome>contenu</DemoChrome>);
    fireEvent.click(screen.getByLabelText('Options'));
    const resetButton = screen.getByRole('menuitem', { name: /réinitialiser l'espace/i });
    fireEvent.click(resetButton);
    expect(window.location.href).toContain('/demo/utica-2026');
  });

  test('le menu Options ouvre la transparence sur les données affichées', () => {
    render(<DemoChrome>contenu</DemoChrome>);
    fireEvent.click(screen.getByLabelText('Options'));
    fireEvent.click(screen.getByRole('menuitem', { name: /à propos des données affichées/i }));
    expect(screen.getByRole('dialog', { name: /à propos des données affichées/i })).toBeInTheDocument();
    expect(screen.getByText(/profil d'exemple/i)).toBeInTheDocument();
  });

  test("la transparence n'est jamais affichée automatiquement", () => {
    render(<DemoChrome>contenu</DemoChrome>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

  test('le panneau mobile porte un bouton "Réinitialiser l\'espace" (jamais "démonstration")', () => {
    render(<DemoChrome>contenu</DemoChrome>);
    fireEvent.click(screen.getByLabelText('Ouvrir le menu'));
    expect(screen.getByRole('button', { name: /réinitialiser l'espace/i })).toBeInTheDocument();
    expect(screen.queryByText(/recommencer la démonstration/i)).not.toBeInTheDocument();
  });

  test('le panneau mobile porte aussi un accès direct à la transparence sur les données', () => {
    render(<DemoChrome>contenu</DemoChrome>);
    fireEvent.click(screen.getByLabelText('Ouvrir le menu'));
    fireEvent.click(screen.getByRole('button', { name: /à propos des données affichées/i }));
    expect(screen.getByRole('dialog', { name: /à propos des données affichées/i })).toBeInTheDocument();
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

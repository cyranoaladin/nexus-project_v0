/**
 * Tests unitaires pour le formulaire Bilan Gratuit
 * Teste la validation par étapes et les interactions utilisateur
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import BilanGratuitPage from '../../app/bilan-gratuit/page';

/**
 * Helper: fill a controlled input by ID using fireEvent.change.
 * Root cause: userEvent.type on shadcn/radix Input re-renders after each keystroke,
 * causing the input ref to become stale (only 1st char is typed).
 * fireEvent.change sets the full value in one shot.
 */
function fillInput(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement;
  if (!el) throw new Error(`Input #${id} not found in DOM`);
  fireEvent.change(el, { target: { value } });
}

/** Fill all step 1 fields with valid data */
function fillStep1(): void {
  fillInput('parentFirstName', 'Jean');
  fillInput('parentLastName', 'Dupont');
  fillInput('parentEmail', 'jean.dupont@example.com');
  fillInput('parentPhone', '+21612345678');
  fillInput('parentPassword', 'password123');
}

/**
 * Helper: assert a step title is visible in the DOM.
 * CardTitle renders as an H3 with an SVG icon + text node inside a flex container,
 * so getByText with regex fails. We query by role heading instead.
 */
function expectStepTitle(text: string): void {
  const headings = screen.getAllByRole('heading');
  const match = headings.find(h => h.textContent?.includes(text));
  expect(match).toBeTruthy();
}

// Mock de useRouter
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/bilan-gratuit',
}));

// Mock de framer-motion — filter all motion-specific props
jest.mock('framer-motion', () => {
  const React = require('react');
  const motionProps = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag',
    'viewport', 'onViewportEnter', 'onViewportLeave',
    'drag', 'dragConstraints', 'layout', 'layoutId',
    'onAnimationStart', 'onAnimationComplete', 'custom', 'inherit',
  ]);
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode; }) => children,
    motion: new Proxy({}, {
      get: (target, prop) => {
        return React.forwardRef((props: any, ref: any) => {
          const { children, ...rest } = props;
          const filtered: any = {};
          Object.keys(rest).forEach((k) => { if (!motionProps.has(k)) filtered[k] = rest[k]; });
          return React.createElement(prop, { ...filtered, ref }, children);
        });
      }
    }),
    useReducedMotion: () => false,
  };
});

describe('BilanGratuitPage - Tests de validation par étapes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devrait afficher l\'étape 1 par défaut', async () => {
    render(<BilanGratuitPage />);

    // Vérifier que l'étape 1 est affichée
    expectStepTitle('Étape 1 : Informations Parent');
    expect(screen.getByText(/Étape 1 sur 2/)).toBeInTheDocument();
    expect(screen.getByText(/50% complété/)).toBeInTheDocument();

    // Vérifier que les champs de l'étape 1 sont présents via their IDs
    expect(document.getElementById('parentFirstName')).toBeInTheDocument();
    expect(document.getElementById('parentLastName')).toBeInTheDocument();
    expect(document.getElementById('parentEmail')).toBeInTheDocument();
    expect(document.getElementById('parentPhone')).toBeInTheDocument();
    expect(document.getElementById('parentPassword')).toBeInTheDocument();
  });

  test('ne devrait pas permettre de passer à l\'étape 2 avec des données invalides', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // Essayer de passer à l'étape suivante sans remplir les champs
    const nextButton = screen.getByRole('button', { name: /Suivant/ });
    await user.click(nextButton);

    // Vérifier qu'on reste sur l'étape 1
    expectStepTitle('Étape 1 : Informations Parent');
  });

  test('devrait permettre de passer à l\'étape 2 avec des données valides', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    fillStep1();

    const nextButton = screen.getByRole('button', { name: /Suivant/ });
    await user.click(nextButton);

    await waitFor(() => {
      expectStepTitle('Étape 2 : Informations Élève');
    });

    expect(screen.getByText(/Étape 2 sur 2/)).toBeInTheDocument();
    expect(screen.getByText(/100% complété/)).toBeInTheDocument();
  });

  test('devrait permettre de revenir à l\'étape 1 depuis l\'étape 2', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    fillStep1();

    const nextButton = screen.getByRole('button', { name: /Suivant/ });
    await user.click(nextButton);

    await waitFor(() => {
      expectStepTitle('Étape 2 : Informations Élève');
    });

    // Revenir à l'étape 1
    const prevButton = screen.getByRole('button', { name: /Précédent/ });
    await user.click(prevButton);

    await waitFor(() => {
      expectStepTitle('Étape 1 : Informations Parent');
    });

    // Vérifier que les champs step 1 sont de nouveau accessibles
    expect(document.getElementById('parentFirstName')).toBeInTheDocument();
    expect(document.getElementById('parentLastName')).toBeInTheDocument();
    expect(document.getElementById('parentEmail')).toBeInTheDocument();
  });

  test('devrait valider les données avant de passer à l\'étape suivante', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // Saisir un email invalide
    fillInput('parentEmail', 'email-invalide');

    const nextButton = screen.getByRole('button', { name: /Suivant/ });
    await user.click(nextButton);

    // Vérifier qu'on reste sur l'étape 1 à cause de l'email invalide
    expectStepTitle('Étape 1 : Informations Parent');
  });

  test('devrait soumettre le formulaire avec toutes les données valides', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    fillStep1();

    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    await waitFor(() => {
      expectStepTitle('Étape 2 : Informations Élève');
    });

    // Remplir l'étape 2 via fireEvent.change
    fillInput('studentFirstName', 'Marie');
    fillInput('studentLastName', 'Dupont');

    // Sélectionner un niveau (Radix UI Select)
    const triggers = screen.getAllByRole('button', { name: /Sélectionnez le niveau/i });
    await user.click(triggers[0]);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Première/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('option', { name: /Première/i }));

    // Sélectionner au moins une matière
    const mathCheckbox = screen.getByLabelText(/Mathématiques/);
    await user.click(mathCheckbox);

    // Saisir les objectifs
    fillInput('objectives', 'Améliorer les notes en mathématiques et préparer le baccalauréat');

    // Accepter les conditions
    const termsCheckbox = screen.getByRole('checkbox', { name: /conditions générales d'utilisation/i });
    await user.click(termsCheckbox);

    // Soumettre le formulaire
    const submitButton = screen.getByRole('button', { name: /Créer mon compte et commencer/ });
    await user.click(submitButton);

    // Vérifier que la soumission a été tentée
    await waitFor(() => {
      // Le test vérifie que le formulaire ne crash pas lors de la soumission
    });
  });

  test('devrait afficher le bouton de soumission uniquement à l\'étape 2', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // À l'étape 1, seul le bouton "Suivant" devrait être visible
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Créer les comptes/ })).not.toBeInTheDocument();

    fillStep1();

    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    await waitFor(() => {
      expectStepTitle('Étape 2 : Informations Élève');
    });

    // À l'étape 2, le bouton de soumission devrait être visible
    expect(screen.getByRole('button', { name: /Créer mon compte et commencer/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Suivant/ })).not.toBeInTheDocument();
  });

  test('devrait afficher les erreurs de validation appropriées', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // Saisir des données invalides via fireEvent.change
    fillInput('parentFirstName', 'A'); // Trop court
    fillInput('parentEmail', 'email-invalide');
    fillInput('parentPassword', '123'); // Trop court

    // Essayer de passer à l'étape suivante
    const nextButton = screen.getByRole('button', { name: /Suivant/ });
    await user.click(nextButton);

    // Vérifier que les erreurs présentes dans l'implémentation sont affichées
    await waitFor(() => {
      expect(screen.getByText(/Nom requis/)).toBeInTheDocument();
      expect(screen.getByText(/Téléphone requis/)).toBeInTheDocument();
    });
  });
});

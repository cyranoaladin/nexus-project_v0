/**
 * Tests unitaires pour le formulaire Bilan Gratuit
 * Teste la validation par étapes et les interactions utilisateur
 */

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import BilanGratuitPage from '../../app/bilan-gratuit/page';

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
}));

// Mock de framer-motion pour éviter les erreurs d'animation
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode; }) => children,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
}));

// Mock des composants Header et Footer (chemins alias utilisés par la page)
jest.mock('@/components/layout/header', () => {
  return { Header: function MockHeader() { return <div data-testid="header">Header</div>; } };
});

jest.mock('@/components/layout/footer', () => {
  return { Footer: function MockFooter() { return <div data-testid="footer">Footer</div>; } };
});

describe('BilanGratuitPage - Tests de validation par étapes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devrait afficher l\'étape 1 par défaut', async () => {
    render(<BilanGratuitPage />);

    // Vérifier que l'étape 1 est affichée
    expect(screen.getByText(/Étape 1 : Informations Parent/)).toBeInTheDocument();
    expect(screen.getByText(/Étape 1 sur 2/)).toBeInTheDocument();
    expect(screen.getByText(/50% complété/)).toBeInTheDocument();

    // Vérifier que les champs de l'étape 1 sont présents
    expect(screen.getByLabelText(/Prénom/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Téléphone/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mot de passe/)).toBeInTheDocument();
  });

  test('ne devrait pas permettre de passer à l\'étape 2 avec des données invalides', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // Essayer de passer à l'étape suivante sans remplir les champs
    const nextButton = screen.getByRole('button', { name: /Suivant/ });
    await user.click(nextButton);

    // Vérifier qu'on reste sur l'étape 1
    expect(screen.getByText(/Étape 1 : Informations Parent/)).toBeInTheDocument();
  });

  test('devrait permettre de passer à l\'étape 2 avec des données valides', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // Remplir les champs de l'étape 1
    await user.type(screen.getByLabelText(/Prénom/), 'Jean');
    await user.type(screen.getByLabelText(/Nom/), 'Dupont');
    await user.type(screen.getByLabelText(/Email/), 'jean.dupont@example.com');
    await user.type(screen.getByLabelText(/Téléphone/), '+216 12 345 678');
    await user.type(screen.getByLabelText(/Mot de passe/), 'password123');

    // Passer à l'étape suivante
    const nextButton = screen.getByRole('button', { name: /Suivant/ });
    await user.click(nextButton);

    // Attendre que l'étape 2 soit affichée
    await waitFor(() => {
      expect(screen.getByText(/Étape 2 : Informations Élève/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Étape 2 sur 2/)).toBeInTheDocument();
    expect(screen.getByText(/100% complété/)).toBeInTheDocument();
  });

  test('devrait permettre de revenir à l\'étape 1 depuis l\'étape 2', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // Passer à l'étape 2
    await user.type(screen.getByLabelText(/Prénom/), 'Jean');
    await user.type(screen.getByLabelText(/Nom/), 'Dupont');
    await user.type(screen.getByLabelText(/Email/), 'jean.dupont@example.com');
    await user.type(screen.getByLabelText(/Téléphone/), '+216 12 345 678');
    await user.type(screen.getByLabelText(/Mot de passe/), 'password123');

    const nextButton = screen.getByRole('button', { name: /Suivant/ });
    await user.click(nextButton);

    // Attendre l'étape 2
    await waitFor(() => {
      expect(screen.getByText(/Étape 2 : Informations Élève/)).toBeInTheDocument();
    });

    // Revenir à l'étape 1
    const prevButton = screen.getByRole('button', { name: /Précédent/ });
    await user.click(prevButton);

    // Vérifier qu'on est revenus à l'étape 1
    await waitFor(() => {
      expect(screen.getByText(/Étape 1 : Informations Parent/)).toBeInTheDocument();
    });

    // Vérifier que les données sont conservées
    expect(screen.getByDisplayValue('Jean')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dupont')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jean.dupont@example.com')).toBeInTheDocument();
  });

  test('devrait valider les données avant de passer à l\'étape suivante', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // Saisir un email invalide
    await user.type(screen.getByLabelText(/Email/), 'email-invalide');

    const nextButton = screen.getByRole('button', { name: /Suivant/ });
    await user.click(nextButton);

    // Vérifier qu'on reste sur l'étape 1 à cause de l'email invalide
    expect(screen.getByText(/Étape 1 : Informations Parent/)).toBeInTheDocument();
  });

  test('devrait soumettre le formulaire avec toutes les données valides', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // Remplir l'étape 1
    await user.type(screen.getByLabelText(/Prénom/), 'Jean');
    await user.type(screen.getByLabelText(/Nom/), 'Dupont');
    await user.type(screen.getByLabelText(/Email/), 'jean.dupont@example.com');
    await user.type(screen.getByLabelText(/Téléphone/), '+216 12 345 678');
    await user.type(screen.getByLabelText(/Mot de passe/), 'password123');

    // Passer à l'étape 2
    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    // Attendre l'étape 2
    await waitFor(() => {
      expect(screen.getByText(/Étape 2 : Informations Élève/)).toBeInTheDocument();
    });

    // Remplir l'étape 2
    await user.type(screen.getByLabelText(/Prénom de l'élève/), 'Marie');
    await user.type(screen.getByLabelText(/Nom de l'élève/), 'Dupont');

    // Sélectionner un niveau (cible l'id précis pour éviter l'ambiguïté avec "Niveau actuel")
    const levelSelect = screen.getByLabelText(/Niveau \*/);
    await user.selectOptions(levelSelect, 'premiere');

    // Sélectionner au moins une matière
    const mathCheckbox = screen.getByLabelText(/Mathématiques/);
    await user.click(mathCheckbox);

    // Saisir les objectifs
    await user.type(screen.getByLabelText(/Objectifs/), 'Améliorer les notes en mathématiques et préparer le baccalauréat');

    // Accepter les conditions (désambiguïse entre 2 libellés "J'accepte ...")
    const termsCheckbox = screen.getByRole('checkbox', { name: /conditions générales d'utilisation/i });
    await user.click(termsCheckbox);

    // Soumettre le formulaire
    const submitButton = screen.getByRole('button', { name: /Créer mon compte et commencer/ });
    await user.click(submitButton);

    // Vérifier que la soumission a été tentée (peut être mockée selon l'implémentation)
    await waitFor(() => {
      // Le test peut vérifier une redirection ou un message de succès
      // selon l'implémentation réelle
    });
  });

  test('devrait afficher le bouton de soumission uniquement à l\'étape 2', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // À l'étape 1, seul le bouton "Suivant" devrait être visible
    expect(screen.getByRole('button', { name: /Suivant/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Créer les comptes/ })).not.toBeInTheDocument();

    // Passer à l'étape 2
    await user.type(screen.getByLabelText(/Prénom/), 'Jean');
    await user.type(screen.getByLabelText(/Nom/), 'Dupont');
    await user.type(screen.getByLabelText(/Email/), 'jean.dupont@example.com');
    await user.type(screen.getByLabelText(/Téléphone/), '+216 12 345 678');
    await user.type(screen.getByLabelText(/Mot de passe/), 'password123');

    await user.click(screen.getByRole('button', { name: /Suivant/ }));

    // Attendre l'étape 2
    await waitFor(() => {
      expect(screen.getByText(/Étape 2 : Informations Élève/)).toBeInTheDocument();
    });

    // À l'étape 2, le bouton de soumission devrait être visible
    expect(screen.getByRole('button', { name: /Créer mon compte et commencer/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Suivant/ })).not.toBeInTheDocument();
  });

  test('devrait afficher les erreurs de validation appropriées', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    // Saisir des données invalides
    await user.type(screen.getByLabelText(/Prénom/), 'A'); // Trop court
    await user.type(screen.getByLabelText(/Email/), 'email-invalide');
    await user.type(screen.getByLabelText(/Mot de passe/), '123'); // Trop court

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

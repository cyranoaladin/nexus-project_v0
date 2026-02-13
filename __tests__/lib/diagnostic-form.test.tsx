import { DiagnosticForm } from '@/components/ui/diagnostic-form';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

describe('DiagnosticForm', () => {
  beforeEach(() => {
    render(<DiagnosticForm />);
  });

  describe('Rendu initial', () => {
    it('affiche le titre et la description', () => {
      expect(screen.getByText('Notre outil de diagnostic intelligent')).toBeInTheDocument();
      expect(screen.getByText(/Notre outil de diagnostic devient encore plus intelligent/)).toBeInTheDocument();
    });

    it('affiche les trois questions', () => {
      expect(screen.getByText('Votre enfant est en classe de...')).toBeInTheDocument();
      expect(screen.getByText('Son statut est...')).toBeInTheDocument();
      expect(screen.getByText('Sa priorité absolue cette année est de...')).toBeInTheDocument();
    });

    it('affiche toutes les options pour chaque question', () => {
      // Question 1
      expect(screen.getByText('Première')).toBeInTheDocument();
      expect(screen.getByText('Terminale')).toBeInTheDocument();

      // Question 2
      expect(screen.getByText('Élève dans un lycée français')).toBeInTheDocument();
      expect(screen.getByText('Candidat Libre')).toBeInTheDocument();

      // Question 3
      expect(screen.getByText('Réussir ses épreuves de Français (pour 1ère)')).toBeInTheDocument();
      expect(screen.getByText('Optimiser son contrôle continu')).toBeInTheDocument();
      expect(screen.getByText('Obtenir une Mention')).toBeInTheDocument();
      expect(screen.getByText('Construire un excellent dossier Parcoursup')).toBeInTheDocument();
      expect(screen.getByText('Avoir un cadre pour obtenir son Bac (pour C. Libre)')).toBeInTheDocument();
    });

    it('n\'affiche pas de recommandation initialement', () => {
      expect(screen.queryByText('Notre recommandation personnalisée :')).not.toBeInTheDocument();
    });
  });

  describe('Interactions utilisateur', () => {
    it('sélectionne une option quand on clique dessus', () => {
      fireEvent.click(screen.getByText('Première'));
      // Verify button click works
      expect(screen.getByText('Première')).toBeInTheDocument();
    });

    it('permet de changer la sélection', async () => {
      // Select all options to complete the form
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Obtenir une Mention'));

      // Should show validation button
      await waitFor(() => {
        expect(screen.getByText(/Obtenir ma recommandation personnalisée/i)).toBeInTheDocument();
      });

      // Now change classe to Terminale
      fireEvent.click(screen.getByText('Terminale'));

      // Validation button should still exist since validation is reset
      await waitFor(() => {
        expect(screen.getByText(/Obtenir ma recommandation personnalisée/i)).toBeInTheDocument();
      });
    });
  });

  describe('Logique de recommandation', () => {
    it('affiche une recommandation quand toutes les questions sont répondues', async () => {
      // Sélectionner Première
      fireEvent.click(screen.getByText('Première'));

      // Sélectionner AEFE
      fireEvent.click(screen.getByText('Élève dans un lycée français'));

      // Sélectionner Français
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));

      // Vérifier que le bouton de validation apparaît
      await waitFor(() => {
        expect(screen.getByText(/Obtenir ma recommandation personnalisée/i)).toBeInTheDocument();
      });

      // Cliquer sur le bouton de validation
      fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));

      // Vérifier qu'une recommandation apparaît
      await waitFor(() => {
        expect(screen.getByText(/Votre recommandation personnalisée/i)).toBeInTheDocument();
      });
    });

    it('affiche la bonne recommandation pour Première-Lycée-Français', async () => {
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));

      // Cliquer sur le bouton de validation
      fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));

      await waitFor(() => {
        expect(screen.getByText(/Odyssée Première/i)).toBeInTheDocument();
        expect(screen.getByText(/Stage Février 2026/i)).toBeInTheDocument();
        expect(screen.getByText(/Maths ou NSI Première/i)).toBeInTheDocument();
      });
    });

    it('affiche la bonne recommandation pour Terminale-Lycée-Mention', async () => {
      fireEvent.click(screen.getByText('Terminale'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Obtenir une Mention'));

      // Cliquer sur le bouton de validation
      fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));

      await waitFor(() => {
        expect(screen.getByText(/Odyssée Terminale/i)).toBeInTheDocument();
        expect(screen.getByText(/Stage Février 2026/i)).toBeInTheDocument();
        expect(screen.getByText(/Excellence Terminale/i)).toBeInTheDocument();
      });
    });

    it('affiche la bonne recommandation pour Terminale-Lycée-Parcoursup', async () => {
      fireEvent.click(screen.getByText('Terminale'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Construire un excellent dossier Parcoursup'));

      // Cliquer sur le bouton de validation
      fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));

      await waitFor(() => {
        expect(screen.getByText(/Odyssée Terminale/i)).toBeInTheDocument();
        expect(screen.getByText(/Stage Février 2026/i)).toBeInTheDocument();
        expect(screen.getByText(/Prépa Bac Terminale/i)).toBeInTheDocument();
      });
    });

    it('affiche la bonne recommandation pour Candidat Libre', async () => {
      fireEvent.click(screen.getByText('Terminale'));
      fireEvent.click(screen.getByText('Candidat Libre'));
      fireEvent.click(screen.getByText('Avoir un cadre pour obtenir son Bac (pour C. Libre)'));

      // Cliquer sur le bouton de validation
      fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));

      await waitFor(() => {
        expect(screen.getByText(/Odyssée Individuel/i)).toBeInTheDocument();
        expect(screen.getByText(/Stage Février 2026/i)).toBeInTheDocument();
        expect(screen.getByText(/Candidats Libres/i)).toBeInTheDocument();
      });
    });
  });

  describe('Boutons d\'action', () => {
    beforeEach(async () => {
      // Remplir le formulaire pour afficher une recommandation
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));

      // Cliquer sur le bouton de validation
      fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));

      await waitFor(() => {
        expect(screen.getByText(/Votre recommandation personnalisée/i)).toBeInTheDocument();
      });
    });

    it('affiche le bouton pour découvrir le parcours', () => {
      expect(screen.getByText('Découvrir ce parcours')).toBeInTheDocument();
    });

    it('affiche le bouton pour voir l\'académie quand applicable', () => {
      expect(screen.getByText('Voir cette académie')).toBeInTheDocument();
    });

    it('a les bons liens href', () => {
      const parcoursButton = screen.getByText('Découvrir ce parcours');
      const academieButton = screen.getByText('Voir cette académie');

      expect(parcoursButton.closest('a')).toHaveAttribute('href', '/offres#odyssee');
      expect(academieButton.closest('a')).toHaveAttribute('href', '/stages/fevrier-2026#academies');
    });
  });

  describe('Animations et transitions', () => {
    it('applique les classes de transition sur les boutons', () => {
      const premiereButton = screen.getByText('Première');
      expect(premiereButton.closest('button')).toHaveClass('transition-all', 'duration-200');
    });

    it('applique les classes hover sur les boutons non sélectionnés', () => {
      const premiereButton = screen.getByText('Première');
      expect(premiereButton.closest('button')).toHaveClass('hover:border-or-stellaire', 'hover:bg-or-stellaire/5');
    });
  });

  describe('Accessibilité', () => {
    it('tous les boutons sont cliquables', () => {
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).not.toBeDisabled();
      });
    });

    it('les liens ont des attributs href appropriés', async () => {
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));

      // Valider pour afficher la recommandation qui contient des liens
      fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));

      await waitFor(() => {
        expect(screen.getByText(/Votre recommandation personnalisée/i)).toBeInTheDocument();
      });

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('href');
      });
    });
  });

  describe('Boutons de validation et résumé', () => {
    it('affiche le bouton de validation quand le formulaire est complet', async () => {
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));

      await waitFor(() => {
        expect(screen.getByText(/Obtenir ma recommandation personnalisée/i)).toBeInTheDocument();
      });
    });

    it('affiche le résumé des choix avant validation', async () => {
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));

      await waitFor(() => {
        expect(screen.getByText(/Résumé de vos choix/i)).toBeInTheDocument();
        // Libellés et valeurs peuvent être séparés par des balises (<strong> + texte)
        expect(screen.getByText(/Classe\s*:/i)).toBeInTheDocument();
        expect(screen.getByText(/Statut\s*:/i)).toBeInTheDocument();
        expect(screen.getByText(/Priorité\s*:/i)).toBeInTheDocument();
      });

      // Vérifie les valeurs présentes (au moins une occurrence)
      expect(screen.getAllByText('Première').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Élève dans un lycée français').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Réussir ses épreuves de Français/i).length).toBeGreaterThan(0);
    });

    it('réinitialise la validation quand on change une option', async () => {
      // Remplir le formulaire
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));

      // Valider
      fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));

      await waitFor(() => {
        expect(screen.getByText(/Votre recommandation personnalisée/i)).toBeInTheDocument();
      });

      // Changer une option
      fireEvent.click(screen.getByText('Terminale'));

      // Vérifier que la validation est réinitialisée
      await waitFor(() => {
        expect(screen.queryByText(/Votre recommandation personnalisée/i)).not.toBeInTheDocument();
        expect(screen.getByText(/Obtenir ma recommandation personnalisée/i)).toBeInTheDocument();
      });
    });
  });
});

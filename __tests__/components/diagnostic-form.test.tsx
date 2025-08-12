import { DiagnosticForm } from '@/components/ui/diagnostic-form';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
      const premiereButton = screen.getByText('Première');
      fireEvent.click(premiereButton);

      // Vérifier que le bouton est maintenant sélectionné (avec l'icône Check)
      expect(premiereButton.closest('button')).toHaveClass('bg-or-stellaire');
    });

    it('permet de changer la sélection', () => {
      const premiereButton = screen.getByText('Première');
      const terminaleButton = screen.getByText('Terminale');

      fireEvent.click(premiereButton);
      expect(premiereButton.closest('button')).toHaveClass('bg-or-stellaire');

      fireEvent.click(terminaleButton);
      expect(terminaleButton.closest('button')).toHaveClass('bg-or-stellaire');
      expect(premiereButton.closest('button')).not.toHaveClass('bg-or-stellaire');
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

      await waitFor(() => {
        expect(screen.getByText('Notre recommandation personnalisée :')).toBeInTheDocument();
      });
    });

    it('affiche la bonne recommandation pour Première-Lycée-Français', async () => {
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));

      await waitFor(() => {
        expect(screen.getByText('Odyssée Première : Le Parcours Anticipé')).toBeInTheDocument();
        expect(screen.getByText('Académie du Français')).toBeInTheDocument();
      });
    });

    it('affiche la bonne recommandation pour Terminale-Lycée-Mention', async () => {
      fireEvent.click(screen.getByText('Terminale'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Obtenir une Mention'));

      await waitFor(() => {
        expect(screen.getByText('Odyssée Terminale : La Stratégie Mention')).toBeInTheDocument();
        expect(screen.getByText('Académie de Février')).toBeInTheDocument();
      });
    });

    it('affiche la bonne recommandation pour Terminale-Lycée-Parcoursup', async () => {
      fireEvent.click(screen.getByText('Terminale'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Construire un excellent dossier Parcoursup'));

      await waitFor(() => {
        expect(screen.getByText('Odyssée Terminale : La Stratégie Mention')).toBeInTheDocument();
        expect(screen.getByText('Académie Python')).toBeInTheDocument();
      });
    });

    it('affiche la bonne recommandation pour Candidat Libre', async () => {
      fireEvent.click(screen.getByText('Terminale'));
      fireEvent.click(screen.getByText('Candidat Libre'));
      fireEvent.click(screen.getByText('Avoir un cadre pour obtenir son Bac (pour C. Libre)'));

      await waitFor(() => {
        expect(screen.getByText('Odyssée Individuel : La Préparation Intégrale')).toBeInTheDocument();
      });
    });
  });

  describe('Boutons d\'action', () => {
    beforeEach(async () => {
      // Remplir le formulaire pour afficher une recommandation
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));

      await waitFor(() => {
        expect(screen.getByText('Notre recommandation personnalisée :')).toBeInTheDocument();
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
      expect(academieButton.closest('a')).toHaveAttribute('href', '/offres#academies');
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

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        links.forEach(link => {
          expect(link).toHaveAttribute('href');
        });
      });
    });
  });
});

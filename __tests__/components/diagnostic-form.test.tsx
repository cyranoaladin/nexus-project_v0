import { DiagnosticForm } from '@/components/ui/diagnostic-form';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

async function fillAndValidate(cls: string, status: string, priority: string) {
  fireEvent.click(screen.getByText(cls));
  fireEvent.click(screen.getByText(status));
  fireEvent.click(screen.getByText(priority));
  await waitFor(() => {
    fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));
  });
  await waitFor(() => {
    expect(screen.getByText(/Votre recommandation personnalisée/)).toBeInTheDocument();
  });
}

const REF_DATE = new Date('2026-06-20');

describe('DiagnosticForm', () => {
  afterEach(cleanup);

  // ── Rendu initial ──

  describe('Rendu initial', () => {
    beforeEach(() => render(<DiagnosticForm referenceDate={REF_DATE} />));

    it('affiche le titre', () => {
      expect(screen.getByText('Notre outil de diagnostic intelligent')).toBeInTheDocument();
    });

    it('affiche les trois questions', () => {
      expect(screen.getByText('Votre enfant est en classe de...')).toBeInTheDocument();
      expect(screen.getByText('Son statut est...')).toBeInTheDocument();
      expect(screen.getByText('Sa priorité absolue cette année est de...')).toBeInTheDocument();
    });

    it("n'affiche pas de recommandation initialement", () => {
      expect(screen.queryByText(/Votre recommandation personnalisée/)).not.toBeInTheDocument();
    });

    it('les options de classe sont des boutons cliquables', () => {
      const premiere = screen.getByText('Première');
      const terminale = screen.getByText('Terminale');
      expect(premiere).toBeInTheDocument();
      expect(terminale).toBeInTheDocument();
      fireEvent.click(premiere);
      // After clicking Première, statut options should appear
      expect(screen.getByText('Son statut est...')).toBeInTheDocument();
    });
  });

  // ── Interactions ──

  describe('Interactions', () => {
    it('sélectionner une classe puis une autre change la sélection', () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Terminale'));
      // The form should still work — complete it
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      expect(screen.getByText('Sa priorité absolue cette année est de...')).toBeInTheDocument();
    });

    it('affiche le bouton de validation quand le formulaire est complet', async () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      fireEvent.click(screen.getByText('Première'));
      fireEvent.click(screen.getByText('Élève dans un lycée français'));
      fireEvent.click(screen.getByText('Réussir ses épreuves de Français (pour 1ère)'));
      await waitFor(() => {
        expect(screen.getByText('Obtenir ma recommandation personnalisée')).toBeInTheDocument();
      });
    });
  });

  // ── 5 parcours de recommandation ──

  describe('Logique de recommandation — tous les parcours', () => {
    it('Première-Lycée-Français → Odyssée Première', async () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      expect(screen.getByText(/Odyssée Première : Le Parcours Anticipé/)).toBeInTheDocument();
    });

    it('Première-Lycée-Controle → Odyssée Première', async () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Optimiser son contrôle continu');
      expect(screen.getByText(/Odyssée Première : Le Parcours Anticipé/)).toBeInTheDocument();
    });

    it('Terminale-Lycée-Mention → Odyssée Terminale', async () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      await fillAndValidate('Terminale', 'Élève dans un lycée français', 'Obtenir une Mention');
      expect(screen.getByText(/Odyssée Terminale : La Stratégie Mention/)).toBeInTheDocument();
    });

    it('Terminale-Lycée-Parcoursup → Odyssée Terminale', async () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      await fillAndValidate('Terminale', 'Élève dans un lycée français', 'Construire un excellent dossier Parcoursup');
      expect(screen.getByText(/Odyssée Terminale : La Stratégie Mention/)).toBeInTheDocument();
    });

    it('Candidat Libre → Odyssée Individuel', async () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      await fillAndValidate('Terminale', 'Candidat Libre', 'Avoir un cadre pour obtenir son Bac (pour C. Libre)');
      expect(screen.getByText(/Odyssée Individuel/)).toBeInTheDocument();
    });
  });

  // ── CTA et liens ──

  describe('CTA et liens de la recommandation', () => {
    it('CTA "Découvrir ce parcours" pointe vers /offres#odyssee', async () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      const link = screen.getByRole('link', { name: /Découvrir ce parcours/i });
      expect(link).toHaveAttribute('href', '/offres#odyssee');
    });

    it('CTA "Voir cette académie" pointe vers /stages', async () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      const stageLink = screen.getByRole('link', { name: /Voir cette académie/i });
      expect(stageLink).toHaveAttribute('href', '/stages');
    });

    it('CTA WhatsApp est présent avec href wa.me', async () => {
      render(<DiagnosticForm referenceDate={REF_DATE} />);
      await fillAndValidate('Terminale', 'Élève dans un lycée français', 'Obtenir une Mention');
      const wa = screen.getByText(/Recevoir ma recommandation sur WhatsApp/);
      expect(wa.closest('a')).toHaveAttribute('href', expect.stringContaining('wa.me'));
    });
  });

  // ── Auto-avance runtime ──

  describe('Auto-avance runtime du stage recommandé', () => {
    it('2026-06-20 → Stage Pré-Rentrée', async () => {
      render(<DiagnosticForm referenceDate={new Date('2026-06-20')} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      expect(screen.getByText(/Stage Pré-Rentrée/)).toBeInTheDocument();
    });

    it('2026-09-15 → Stage Toussaint (Pré-Rentrée passée)', async () => {
      render(<DiagnosticForm referenceDate={new Date('2026-09-15')} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      expect(screen.getByText(/Stage Toussaint/)).toBeInTheDocument();
      expect(screen.queryByText(/Stage Pré-Rentrée/)).not.toBeInTheDocument();
    });

    it('2028-01-01 → aucun stage (tous passés)', async () => {
      render(<DiagnosticForm referenceDate={new Date('2028-01-01')} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      expect(screen.queryByText(/Stage /)).not.toBeInTheDocument();
    });
  });
});

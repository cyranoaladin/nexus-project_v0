import { DiagnosticForm } from '@/components/ui/diagnostic-form';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

// Helper: complete the form and get recommendation
async function fillAndValidate(
  classOption: string,
  statusOption: string,
  priorityOption: string,
) {
  fireEvent.click(screen.getByText(classOption));
  fireEvent.click(screen.getByText(statusOption));
  fireEvent.click(screen.getByText(priorityOption));
  await waitFor(() => {
    fireEvent.click(screen.getByText('Obtenir ma recommandation personnalisée'));
  });
  await waitFor(() => {
    expect(screen.getByText(/Votre recommandation personnalisée/)).toBeInTheDocument();
  });
}

describe('DiagnosticForm', () => {
  describe('Rendu initial', () => {
    beforeEach(() => {
      render(<DiagnosticForm />);
    });

    it('affiche le titre et la description', () => {
      expect(screen.getByText('Notre outil de diagnostic intelligent')).toBeInTheDocument();
    });

    it('affiche les trois questions', () => {
      expect(screen.getByText('Votre enfant est en classe de...')).toBeInTheDocument();
      expect(screen.getByText('Son statut est...')).toBeInTheDocument();
    });

    it("n'affiche pas de recommandation initialement", () => {
      expect(screen.queryByText(/Votre recommandation personnalisée/)).not.toBeInTheDocument();
    });
  });

  describe('Logique de recommandation', () => {
    afterEach(cleanup);

    it('affiche le parcours correct pour Première-Lycée-Français', async () => {
      render(<DiagnosticForm referenceDate={new Date('2026-06-20')} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      expect(screen.getByText(/Odyssée Première : Le Parcours Anticipé/)).toBeInTheDocument();
    });

    it('affiche le parcours correct pour Terminale-Lycée-Mention', async () => {
      render(<DiagnosticForm referenceDate={new Date('2026-06-20')} />);
      await fillAndValidate('Terminale', 'Élève dans un lycée français', 'Obtenir une Mention');
      expect(screen.getByText(/Odyssée Terminale : La Stratégie Mention/)).toBeInTheDocument();
    });

    it('affiche le parcours correct pour Candidat Libre', async () => {
      render(<DiagnosticForm referenceDate={new Date('2026-06-20')} />);
      await fillAndValidate('Terminale', 'Candidat Libre', 'Avoir un cadre pour obtenir son Bac (pour C. Libre)');
      expect(screen.getByText(/Odyssée Individuel/)).toBeInTheDocument();
    });
  });

  describe('Auto-avance runtime du stage recommandé', () => {
    afterEach(cleanup);

    it('2026-06-20 → recommande Stage Pré-Rentrée', async () => {
      render(<DiagnosticForm referenceDate={new Date('2026-06-20')} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      expect(screen.getByText(/Stage Pré-Rentrée/)).toBeInTheDocument();
    });

    it('2026-09-15 → recommande Stage Toussaint (Pré-Rentrée passée)', async () => {
      render(<DiagnosticForm referenceDate={new Date('2026-09-15')} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      expect(screen.getByText(/Stage Toussaint/)).toBeInTheDocument();
      expect(screen.queryByText(/Stage Pré-Rentrée/)).not.toBeInTheDocument();
    });

    it('2028-01-01 → aucun stage affiché (tous passés)', async () => {
      render(<DiagnosticForm referenceDate={new Date('2028-01-01')} />);
      await fillAndValidate('Première', 'Élève dans un lycée français', 'Réussir ses épreuves de Français (pour 1ère)');
      expect(screen.queryByText(/Stage /)).not.toBeInTheDocument();
    });

    it('CTA WhatsApp est présent au résultat', async () => {
      render(<DiagnosticForm referenceDate={new Date('2026-06-20')} />);
      await fillAndValidate('Terminale', 'Élève dans un lycée français', 'Obtenir une Mention');
      expect(screen.getByText(/Recevoir ma recommandation sur WhatsApp/)).toBeInTheDocument();
    });
  });
});

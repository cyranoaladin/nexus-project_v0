import { render, screen, waitFor } from '@testing-library/react';
import { EafStageQuestionnaireCard } from '@/components/dashboard/eleve/EafStageQuestionnaireCard';
import '@testing-library/jest-dom';

// Mock fetch
global.fetch = jest.fn();

describe('EafStageQuestionnaireCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with "À compléter" status when no bilan exists', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ bilan: null }),
    });

    render(<EafStageQuestionnaireCard />);

    await waitFor(() => {
      expect(screen.getByText('À compléter')).toBeInTheDocument();
    });
    expect(screen.getByText('Compléter le questionnaire')).toBeInTheDocument();
  });

  it('should render with "Brouillon enregistré" status when bilan is PENDING', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ bilan: { status: 'PENDING' } }),
    });

    render(<EafStageQuestionnaireCard />);

    await waitFor(() => {
      expect(screen.getByText('Brouillon enregistré')).toBeInTheDocument();
    });
  });

  it('should render with "Envoyé" status when bilan is COMPLETED', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ bilan: { status: 'COMPLETED' } }),
    });

    render(<EafStageQuestionnaireCard />);

    await waitFor(() => {
      expect(screen.getByText('Envoyé')).toBeInTheDocument();
      expect(screen.getByText('Voir mon bilan')).toBeInTheDocument();
    });
  });
});

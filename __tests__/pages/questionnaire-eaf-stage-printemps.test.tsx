import { render, screen, waitFor } from '@testing-library/react';
import QuestionnaireEAFStagePrintempsPage from '@/app/dashboard/eleve/questionnaires/eaf-stage-printemps/page';
import '@testing-library/jest-dom';

// Mock fetch
global.fetch = jest.fn();

// Mock window.scrollTo
window.scrollTo = jest.fn();

describe('QuestionnaireEAFStagePrintempsPage Render', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the questionnaire shell and initial step', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ bilan: null }),
    });

    render(<QuestionnaireEAFStagePrintempsPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText(/Questionnaire bilan/i)).toBeInTheDocument();
    });
    
    // Check first step title
    expect(screen.getByText('Informations générales')).toBeInTheDocument();
    expect(screen.getByText('Continuer')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { SurvivalDashboard } from '@/components/dashboard/eleve/survival';

describe('SurvivalDashboard', () => {
  it('renders the survival-only tactical zones', () => {
    render(
      <SurvivalDashboard
        progress={{
          examDate: new Date('2026-06-08'),
          reflexesState: { reflex_1: 'ACQUIS', reflex_2: 'REVOIR' },
          phrasesState: { phrase_1: 3 },
          qcmAttempts: 0,
          qcmCorrect: 0,
          rituals: [],
        }}
      />,
    );

    expect(screen.getByLabelText('Mode Survie STMG')).toBeInTheDocument();
    expect(screen.getByText('Coffre des 7 reflexes')).toBeInTheDocument();
    expect(screen.getByText('8 phrases magiques')).toBeInTheDocument();
    expect(screen.getByText("Le jour J, tu remplis 100 % du QCM.")).toBeInTheDocument();
  });
});

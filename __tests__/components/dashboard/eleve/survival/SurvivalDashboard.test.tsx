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
    expect(screen.getByText('Coffre des 7 réflexes')).toBeInTheDocument();
    expect(screen.getByText('8 phrases magiques')).toBeInTheDocument();
    expect(screen.getAllByText("Le jour J, tu remplis 100 % du QCM.")[0]).toBeInTheDocument();
  });

  it('does not use dark-generic or red tokens anywhere in the rendered tree', () => {
    const { container } = render(
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
    const html = container.innerHTML;
    expect(html).not.toMatch(/text-red|bg-red|border-red|text-danger|bg-danger/);
    expect(html).not.toMatch(/text-neutral-[2-4]00/);
  });
});

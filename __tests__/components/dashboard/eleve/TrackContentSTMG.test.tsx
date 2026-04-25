import { render, screen } from '@testing-library/react';
import { TrackContentSTMG } from '@/components/dashboard/eleve';

describe('TrackContentSTMG', () => {
  it('renders STMG modules from the API payload', () => {
    render(
      <TrackContentSTMG
        modules={[
          {
            module: 'MATHS_STMG',
            label: 'Mathématiques STMG',
            skillGraphRef: 'maths_premiere_stmg',
            progress: { totalXp: 80, completedChapters: ['pourcentages'], masteredChapters: [], totalChaptersInProgram: 8, bestCombo: 0, streak: 0 },
          },
        ]}
      />
    );

    expect(screen.getByText('Programme Première STMG')).toBeInTheDocument();
    expect(screen.getByText('Mathématiques STMG')).toBeInTheDocument();
    expect(screen.getByText('maths_premiere_stmg')).toBeInTheDocument();
  });
});

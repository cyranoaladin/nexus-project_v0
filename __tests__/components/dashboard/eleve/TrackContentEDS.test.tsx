import { render, screen } from '@testing-library/react';
import { TrackContentEDS } from '@/components/dashboard/eleve';

describe('TrackContentEDS', () => {
  it('renders specialty cards from the API payload', () => {
    render(
      <TrackContentEDS
        specialties={[
          {
            subject: 'MATHEMATIQUES',
            skillGraphRef: 'maths_premiere',
            progress: { totalXp: 120, completedChapters: ['suites'], masteredChapters: [], totalChaptersInProgram: 10, bestCombo: 0, streak: 0 },
          },
        ]}
      />
    );

    expect(screen.getByText('Mes spécialités')).toBeInTheDocument();
    expect(screen.getByText('MATHEMATIQUES')).toBeInTheDocument();
    expect(screen.getByText('maths_premiere')).toBeInTheDocument();
  });
});

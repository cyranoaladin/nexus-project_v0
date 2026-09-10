import { render, screen } from '@testing-library/react';
import { AriaAssessmentsPanel } from '@/components/aria/cockpit';
import type { AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';

function cockpit(assessments: AriaCockpitDTO['assessments']): AriaCockpitDTO {
  return { assessments } as unknown as AriaCockpitDTO;
}

describe('AriaAssessmentsPanel', () => {
  it('shows an empty state with no assessments', () => {
    render(<AriaAssessmentsPanel cockpit={cockpit([])} />);
    expect(screen.getByText('Aucun bilan pour l’instant')).toBeInTheDocument();
  });

  it('groups assessments by state, in A_FAIRE → RECENT → TERMINE order, with score and date', () => {
    render(
      <AriaAssessmentsPanel
        cockpit={cockpit([
          {
            id: 't1', title: 'Bilan terminé', state: 'TERMINE',
            date: '2026-03-01T00:00:00.000Z', globalScore: 82, href: '/bilan/t1',
          },
          {
            id: 'a1', title: 'Bilan à faire', state: 'A_FAIRE',
            date: null, globalScore: null, href: null,
          },
        ] as unknown as AriaCockpitDTO['assessments'])}
      />,
    );
    const headings = screen.getAllByText(/À faire|Terminé/);
    expect(headings.map((el) => el.textContent)).toEqual(['À faire', 'Terminé']);
    expect(screen.getByText('Bilan à faire')).toBeInTheDocument();
    expect(screen.getByText('Bilan terminé')).toBeInTheDocument();
    expect(screen.getByText('Date inconnue')).toBeInTheDocument();
    expect(screen.getByText(/score 82\/100/)).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { AriaTodayPanel } from '@/components/aria/cockpit';
import type { AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';

function cockpit(overrides: Partial<AriaCockpitDTO> = {}): AriaCockpitDTO {
  return {
    today: {
      items: [],
      weeklyGoalMinutes: 180,
      plannedMinutes: null,
    },
    nextSession: null,
    ...overrides,
  } as unknown as AriaCockpitDTO;
}

describe('AriaTodayPanel', () => {
  it('shows an empty state when there is nothing planned', () => {
    render(<AriaTodayPanel cockpit={cockpit()} />);
    expect(screen.getByText('Rien de planifié pour l’instant')).toBeInTheDocument();
    expect(screen.getByText('Aucune séance programmée.')).toBeInTheDocument();
  });

  it('lists pending and done items, and the next session when present', () => {
    render(
      <AriaTodayPanel
        cockpit={cockpit({
          today: {
            items: [
              {
                id: 'a',
                title: 'Réviser les suites',
                done: false,
                estimatedMinutes: 30,
                origin: 'FEUILLE_DE_ROUTE',
              },
              {
                id: 'b',
                title: 'Exercice fait',
                done: true,
                origin: 'NEXT_STEP',
              },
            ],
            weeklyGoalMinutes: 180,
            plannedMinutes: 30,
          },
          nextSession: {
            id: 's1',
            title: 'Suivi mathématiques',
            subject: 'MATHEMATICS',
            scheduledAt: '2026-09-15T14:00:00.000Z',
            coachName: 'Nadia',
          },
        } as unknown as Partial<AriaCockpitDTO>)}
      />,
    );
    expect(screen.getByText('Réviser les suites')).toBeInTheDocument();
    expect(screen.getByText('Exercice fait')).toBeInTheDocument();
    expect(screen.getByText('30 min planifiées dans ta feuille de route')).toBeInTheDocument();
    expect(screen.getByText('Suivi mathématiques')).toBeInTheDocument();
    expect(screen.getByText(/Nadia/)).toBeInTheDocument();
  });

  it('shows the next session without a coach name when none is set', () => {
    render(
      <AriaTodayPanel
        cockpit={cockpit({
          nextSession: {
            id: 's1',
            title: 'Séance libre',
            subject: 'MATHEMATICS',
            scheduledAt: '2026-09-15T14:00:00.000Z',
            coachName: null,
          },
        } as unknown as Partial<AriaCockpitDTO>)}
      />,
    );
    expect(screen.getByText('Séance libre')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('shows the all-done message once every item is completed', () => {
    render(
      <AriaTodayPanel
        cockpit={cockpit({
          today: {
            items: [
              { id: 'a', title: 'Fait', done: true, origin: 'NEXT_STEP' },
            ],
            weeklyGoalMinutes: 180,
            plannedMinutes: 0,
          },
        } as unknown as Partial<AriaCockpitDTO>)}
      />,
    );
    expect(screen.getByText('Tout est fait pour aujourd’hui.')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { AriaTrajectoryPanel } from '@/components/aria/cockpit';
import type { AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';

function cockpit(overrides: Partial<AriaCockpitDTO> = {}): AriaCockpitDTO {
  return {
    trajectory: null,
    examContext: null,
    ...overrides,
  } as unknown as AriaCockpitDTO;
}

describe('AriaTrajectoryPanel', () => {
  it('shows an empty state when there is no active trajectory, and nothing exam-related', () => {
    render(<AriaTrajectoryPanel cockpit={cockpit()} />);
    expect(screen.getByText('Aucune trajectoire active')).toBeInTheDocument();
    expect(screen.queryByText(/Session d’examen/)).not.toBeInTheDocument();
  });

  it('renders full trajectory progress, next milestone with a date, and days remaining', () => {
    render(
      <AriaTrajectoryPanel
        cockpit={cockpit({
          trajectory: {
            id: 't1',
            title: 'Cap Terminale',
            progress: 40,
            daysRemaining: 120,
            nextMilestone: { title: 'Bac blanc', targetDate: '2026-12-01T00:00:00.000Z' },
            milestoneCount: 5,
            completedMilestoneCount: 2,
          },
        } as unknown as Partial<AriaCockpitDTO>)}
      />,
    );
    expect(screen.getByText('Cap Terminale')).toBeInTheDocument();
    expect(screen.getByText('2/5 jalons')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText(/Bac blanc/)).toBeInTheDocument();
    expect(screen.getByText('120 jours restants sur l’horizon défini.')).toBeInTheDocument();
  });

  it('omits the next-milestone date when absent, and the milestone/days-remaining blocks when null', () => {
    render(
      <AriaTrajectoryPanel
        cockpit={cockpit({
          trajectory: {
            id: 't1',
            title: 'Cap Terminale',
            progress: 100,
            daysRemaining: null,
            nextMilestone: { title: 'Dernier jalon', targetDate: null },
            milestoneCount: 5,
            completedMilestoneCount: 5,
          },
        } as unknown as Partial<AriaCockpitDTO>)}
      />,
    );
    expect(screen.getByText(/Dernier jalon/)).toBeInTheDocument();
    expect(screen.queryByText(/jours restants/)).not.toBeInTheDocument();
  });

  it('shows the unsupported-session message when the exam context is not yet covered', () => {
    render(
      <AriaTrajectoryPanel
        cockpit={cockpit({
          examContext: { targetSession: 2027, supported: false, epreuves: [] },
        } as unknown as Partial<AriaCockpitDTO>)}
      />,
    );
    expect(screen.getByText(/Session d’examen visée/)).toBeInTheDocument();
    expect(
      screen.getByText('Le référentiel réglementaire de cette session n’est pas encore disponible.'),
    ).toBeInTheDocument();
  });

  it('lists épreuves with and without a coefficient when the exam context is supported', () => {
    render(
      <AriaTrajectoryPanel
        cockpit={cockpit({
          examContext: {
            targetSession: 2027,
            supported: true,
            epreuves: [
              { id: 'e1', label: 'Philosophie', type: 'ECRIT', coefficient: 8 },
              { id: 'e2', label: 'Grand oral', type: 'ORAL', coefficient: null },
            ],
          },
        } as unknown as Partial<AriaCockpitDTO>)}
      />,
    );
    expect(screen.getByText('Philosophie')).toBeInTheDocument();
    expect(screen.getByText(/coef\. 8/)).toBeInTheDocument();
    expect(screen.getByText('Grand oral')).toBeInTheDocument();
  });
});

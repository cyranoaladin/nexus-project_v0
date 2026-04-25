import React from 'react';
import { render, screen } from '@testing-library/react';
import { EleveTrajectory } from '@/components/dashboard/eleve/EleveTrajectory';
import type { TrajectoireDataProp } from '@/components/dashboard/TrajectoireCard';

// TrajectoireCard renders TrajectoireTimeline which uses Link — mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeTrajectory = (overrides: Partial<TrajectoireDataProp> = {}): TrajectoireDataProp => ({
  id: 'traj-1',
  title: 'Objectif Bac 2026',
  progress: 35,
  daysRemaining: 120,
  milestones: [],
  ...overrides,
});

describe('EleveTrajectory', () => {
  it('renders a section with accessible label', () => {
    render(<EleveTrajectory trajectory={makeTrajectory()} />);
    const section = document.getElementById('trajectory');
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('aria-labelledby', 'eleve-trajectory-title');
  });

  it('shows trajectory title when id and title are set', () => {
    render(<EleveTrajectory trajectory={makeTrajectory({ title: 'Objectif Terminale' })} />);
    expect(screen.getByText(/Objectif Terminale/)).toBeInTheDocument();
  });

  it('shows "Définir ma trajectoire" empty state when id is null', () => {
    render(
      <EleveTrajectory
        trajectory={makeTrajectory({ id: null, title: null, progress: 0, daysRemaining: 0, milestones: [] })}
      />
    );
    expect(screen.getByText(/Définir ma trajectoire/i)).toBeInTheDocument();
  });

  it('renders milestones when present', () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    render(
      <EleveTrajectory
        trajectory={makeTrajectory({
          milestones: [
            { id: 'm1', title: 'Bilan pallier 2', targetDate: futureDate, completed: false, completedAt: null },
          ],
        })}
      />
    );
    expect(screen.getByText('Bilan pallier 2')).toBeInTheDocument();
  });

  it('does NOT call fetch() internally — data mode', () => {
    const spy = jest.spyOn(global, 'fetch');
    render(<EleveTrajectory trajectory={makeTrajectory()} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows progress percentage', () => {
    render(<EleveTrajectory trajectory={makeTrajectory({ progress: 42, milestones: [
      { id: 'm1', title: 'Bilan', targetDate: new Date(Date.now() + 10000).toISOString(), completed: false, completedAt: null }
    ] })} />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });
});

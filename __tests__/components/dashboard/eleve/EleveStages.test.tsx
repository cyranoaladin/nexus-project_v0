import React from 'react';
import { render, screen } from '@testing-library/react';
import { EleveStages } from '@/components/dashboard/eleve/EleveStages';
import type { EleveStageItem } from '@/components/dashboard/eleve/types';

const makeStage = (overrides: Partial<EleveStageItem> = {}): EleveStageItem => ({
  stageId: 's1',
  stageSlug: 'stage-maths-avril',
  title: 'Stage Maths Intensif',
  startDate: '2026-04-20T08:00:00.000Z',
  endDate: '2026-04-25T18:00:00.000Z',
  location: 'Tunis',
  reservationId: 'res-1',
  reservationStatus: 'CONFIRMED',
  hasBilan: false,
  bilanUrl: null,
  ...overrides,
});

describe('EleveStages', () => {
  it('renders empty state when no stages', () => {
    render(<EleveStages upcomingStages={[]} pastStages={[]} />);
    expect(screen.getByText(/Aucun stage réservé/i)).toBeInTheDocument();
  });

  it('renders an upcoming stage with title and status badge', () => {
    render(<EleveStages upcomingStages={[makeStage()]} pastStages={[]} />);
    expect(screen.getByText('Stage Maths Intensif')).toBeInTheDocument();
    expect(screen.getByText('Confirmé')).toBeInTheDocument();
    expect(screen.getByText(/À venir/i)).toBeInTheDocument();
  });

  it('renders a past stage in "Passés" section', () => {
    const past = makeStage({ reservationStatus: 'COMPLETED', title: 'Stage Passé' });
    render(<EleveStages upcomingStages={[]} pastStages={[past]} />);
    expect(screen.getByText('Stage Passé')).toBeInTheDocument();
    expect(screen.getByText(/Passés/i)).toBeInTheDocument();
    expect(screen.getByText('Terminé')).toBeInTheDocument();
  });

  it('shows reservation status badge "En attente" for PENDING', () => {
    render(<EleveStages upcomingStages={[makeStage({ reservationStatus: 'PENDING' })]} pastStages={[]} />);
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('shows bilan link when hasBilan=true and bilanUrl is set', () => {
    const stage = makeStage({
      hasBilan: true,
      bilanUrl: '/bilan-pallier2-maths/resultat/share-xyz',
      reservationStatus: 'COMPLETED',
    });
    render(<EleveStages upcomingStages={[]} pastStages={[stage]} />);
    const link = screen.getByRole('link', { name: /Voir le bilan du stage/i });
    expect(link).toHaveAttribute('href', '/bilan-pallier2-maths/resultat/share-xyz');
  });

  it('does not show bilan link when hasBilan=false', () => {
    render(<EleveStages upcomingStages={[makeStage({ hasBilan: false })]} pastStages={[]} />);
    expect(screen.queryByRole('link', { name: /bilan du stage/i })).not.toBeInTheDocument();
  });

  it('renders location in date line', () => {
    render(<EleveStages upcomingStages={[makeStage({ location: 'Sousse' })]} pastStages={[]} />);
    expect(screen.getByText(/Sousse/)).toBeInTheDocument();
  });

  it('renders both upcoming and past sections when both have items', () => {
    render(
      <EleveStages
        upcomingStages={[makeStage({ reservationId: 'res-1', title: 'Stage Futur' })]}
        pastStages={[makeStage({ reservationId: 'res-2', reservationStatus: 'COMPLETED', title: 'Stage Ancien' })]}
      />
    );
    expect(screen.getByText(/À venir/i)).toBeInTheDocument();
    expect(screen.getByText(/Passés/i)).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { EleveBilans } from '@/components/dashboard/eleve/EleveBilans';
import type { EleveBilan } from '@/components/dashboard/eleve/types';

const makeBilan = (overrides: Partial<EleveBilan> = {}): EleveBilan => ({
  id: 'b1',
  publicShareId: 'share-1',
  type: 'DIAGNOSTIC_PRE_STAGE',
  subject: 'MATHEMATIQUES',
  subjectLabel: 'Mathématiques',
  status: 'COMPLETED',
  globalScore: 72,
  ssn: null,
  confidenceIndex: null,
  trustLevel: 'high',
  topPriorities: ['Fonctions', 'Dérivées'],
  hasParentsRender: false,
  createdAt: '2026-03-15T10:00:00.000Z',
  resultUrl: '/bilan-pallier2-maths/resultat/share-1',
  ...overrides,
});

describe('EleveBilans', () => {
  it('renders empty state when no bilans', () => {
    render(<EleveBilans recentBilans={[]} lastBilan={null} />);
    expect(screen.getByText(/Aucun bilan disponible/i)).toBeInTheDocument();
  });

  it('renders lastBilan with score and subject label', () => {
    const bilan = makeBilan();
    render(<EleveBilans recentBilans={[bilan]} lastBilan={bilan} />);
    expect(screen.getByText('Mathématiques')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('shows trustLevel badge "Fiable" for high', () => {
    const bilan = makeBilan({ trustLevel: 'high' });
    render(<EleveBilans recentBilans={[bilan]} lastBilan={bilan} />);
    expect(screen.getByText('Fiable')).toBeInTheDocument();
  });

  it('shows trustLevel badge "Moyen" for medium', () => {
    const bilan = makeBilan({ trustLevel: 'medium' });
    render(<EleveBilans recentBilans={[bilan]} lastBilan={bilan} />);
    expect(screen.getByText('Moyen')).toBeInTheDocument();
  });

  it('shows trustLevel badge "Partiel" for low', () => {
    const bilan = makeBilan({ trustLevel: 'low' });
    render(<EleveBilans recentBilans={[bilan]} lastBilan={bilan} />);
    expect(screen.getByText('Partiel')).toBeInTheDocument();
  });

  it('does not render trustLevel badge when trustLevel is null', () => {
    const bilan = makeBilan({ trustLevel: null });
    render(<EleveBilans recentBilans={[bilan]} lastBilan={bilan} />);
    expect(screen.queryByText('Fiable')).not.toBeInTheDocument();
    expect(screen.queryByText('Moyen')).not.toBeInTheDocument();
  });

  it('renders up to 2 top priorities', () => {
    const bilan = makeBilan({ topPriorities: ['Fonctions', 'Dérivées', 'Intégrales'] });
    render(<EleveBilans recentBilans={[bilan]} lastBilan={bilan} />);
    expect(screen.getByText('Fonctions')).toBeInTheDocument();
    expect(screen.getByText('Dérivées')).toBeInTheDocument();
    expect(screen.getByText('Intégrales')).toBeInTheDocument();
  });

  it('renders result link pointing to resultUrl', () => {
    const bilan = makeBilan();
    render(<EleveBilans recentBilans={[bilan]} lastBilan={bilan} />);
    const link = screen.getByRole('link', { name: /Voir le bilan/i });
    expect(link).toHaveAttribute('href', '/bilan-pallier2-maths/resultat/share-1');
  });

  it('renders history section when more than one bilan', () => {
    const b1 = makeBilan({ id: 'b1', subjectLabel: 'Mathématiques' });
    const b2 = makeBilan({ id: 'b2', subjectLabel: 'NSI', subject: 'NSI', publicShareId: 'share-2', resultUrl: '/bilan/share-2' });
    render(<EleveBilans recentBilans={[b1, b2]} lastBilan={b1} />);
    expect(screen.getByText(/Historique/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Voir le bilan/i)).toHaveLength(2);
  });
});

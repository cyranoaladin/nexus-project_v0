/**
 * F52: BilanViewer Component Tests — Preuve minimale
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BilanViewer, { BilanViewerData } from '@/components/bilan/BilanViewer';
import { BilanType } from '@/lib/bilan/types';

const mockBilan: BilanViewerData = {
  id: 'test-bilan-123',
  publicShareId: 'share-abc',
  type: BilanType.DIAGNOSTIC_PRE_STAGE,
  subject: 'MATHS',
  studentName: 'Jean Dupont',
  studentEmail: 'jean@example.com',
  globalScore: 75,
  confidenceIndex: 82,
  status: 'COMPLETED',
  isPublished: true,
  studentMarkdown: '# Bilan Élève\n\nTrès bon travail en **algèbre**.',
  parentsMarkdown: '# Bilan Parents\n\nVotre enfant progresse bien.',
  nexusMarkdown: '# Bilan Pédagogique\n\nAnalyse technique.',
  domainScores: [
    { domain: 'algèbre', score: 85 },
    { domain: 'géométrie', score: 65 },
  ],
  strengths: ['Raisonnement logique', 'Méthodologie'],
  areasForGrowth: ['Calcul littéral'],
  createdAt: '2026-04-22T10:00:00Z',
  updatedAt: '2026-04-22T10:30:00Z',
  publishedAt: '2026-04-22T10:30:00Z',
  ragUsed: true,
  ragCollections: ['maths-premiere', 'methodologie'],
};

describe('F52: BilanViewer', () => {
  it('should render student audience by default', () => {
    render(<BilanViewer data={mockBilan} />);
    expect(screen.getByText('Bilan Personnel')).toBeInTheDocument();
    expect(screen.getByText('MATHS — DIAGNOSTIC_PRE_STAGE')).toBeInTheDocument();
  });

  it('should render parents audience when specified', () => {
    render(<BilanViewer data={mockBilan} audience="parents" />);
    expect(screen.getByText('Bilan Famille')).toBeInTheDocument();
  });

  it('should render nexus audience when specified', () => {
    render(<BilanViewer data={mockBilan} audience="nexus" />);
    expect(screen.getByText('Bilan Pédagogique')).toBeInTheDocument();
  });

  it('should display global score when provided', () => {
    render(<BilanViewer data={mockBilan} />);
    expect(screen.getByText('Score Global')).toBeInTheDocument();
    expect(screen.getByText('75/100')).toBeInTheDocument();
  });

  it('should display confidence index when provided', () => {
    render(<BilanViewer data={mockBilan} />);
    expect(screen.getByText('Indice de Confiance')).toBeInTheDocument();
    expect(screen.getByText('82/100')).toBeInTheDocument();
  });

  it('should display domain scores when provided', () => {
    render(<BilanViewer data={mockBilan} />);
    expect(screen.getByText('Résultats par domaine')).toBeInTheDocument();
    // Domain names appear in list and possibly elsewhere, use getAllByText
    expect(screen.getAllByText('algèbre').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('géométrie').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('65%').length).toBeGreaterThanOrEqual(1);
  });

  it('should show export/print buttons by default', () => {
    render(<BilanViewer data={mockBilan} />);
    expect(screen.getByText('Imprimer')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('should hide export buttons when showExport is false', () => {
    render(<BilanViewer data={mockBilan} showExport={false} />);
    expect(screen.queryByText('Imprimer')).not.toBeInTheDocument();
    expect(screen.queryByText('PDF')).not.toBeInTheDocument();
  });

  it('should show share button when showShare is true', () => {
    render(<BilanViewer data={mockBilan} showShare={true} />);
    expect(screen.getByText('Partager')).toBeInTheDocument();
  });

  it('should call onPrint when print button clicked', () => {
    const onPrint = jest.fn();
    render(<BilanViewer data={mockBilan} onPrint={onPrint} />);
    fireEvent.click(screen.getByText('Imprimer'));
    expect(onPrint).toHaveBeenCalled();
  });

  it('should call onExport when PDF button clicked', () => {
    const onExport = jest.fn();
    render(<BilanViewer data={mockBilan} onExport={onExport} />);
    fireEvent.click(screen.getByText('PDF'));
    expect(onExport).toHaveBeenCalledWith('pdf');
  });

  it('should display fallback text when markdown is missing', () => {
    const bilanWithoutMarkdown = { ...mockBilan, studentMarkdown: undefined };
    render(<BilanViewer data={bilanWithoutMarkdown} />);
    expect(screen.getByText(/Bilan en cours de génération/)).toBeInTheDocument();
  });

  it('should show RAG metadata in footer when ragUsed', () => {
    render(<BilanViewer data={mockBilan} />);
    expect(screen.getByText(/Contexte RAG utilisé/)).toBeInTheDocument();
    expect(screen.getByText(/maths-premiere/)).toBeInTheDocument();
  });

  it('should show public share link when publicShareId exists', () => {
    render(<BilanViewer data={mockBilan} />);
    expect(screen.getByText(/Lien public/)).toBeInTheDocument();
    expect(screen.getByText(/share-abc/)).toBeInTheDocument();
  });
});
